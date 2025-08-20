import * as SPLAT from "https://cdn.jsdelivr.net/npm/gsplat@latest";
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";

const canvas = document.getElementById("canvas");
const progressDialog = document.getElementById("progress-dialog");
const progressIndicator = document.getElementById("progress-indicator");

let scene = new SPLAT.Scene();
const camera = new SPLAT.Camera();
const controls = new SPLAT.OrbitControls(camera, canvas);
const renderer = new SPLAT.WebGLRenderer(canvas);

let vrRenderer = null;
let vrCamera = null;
let vrCanvas = null;
let inVR = false;

const debugDiv = document.createElement("div");
debugDiv.style.position = "fixed";
debugDiv.style.top = "10px";
debugDiv.style.left = "10px";
debugDiv.style.background = "rgba(0,0,0,0.5)";
debugDiv.style.color = "white";
debugDiv.style.padding = "5px";
debugDiv.style.zIndex = "9999";
debugDiv.innerText = "Debug messages:";
document.body.appendChild(debugDiv);

function debug(msg) {
  debugDiv.innerText = "Debug messages:\n" + msg;
}

async function loadScene(source) {
  progressDialog.show();
  scene.children = [];

  if (typeof source === "string") {
    const fileName = source.split("/").pop();
    if (fileName.endsWith(".splat")) {
      await SPLAT.Loader.LoadAsync(source, scene, (p) => progressIndicator.value = p*100);
    } else if (fileName.endsWith(".ply")) {
      await SPLAT.PLYLoader.LoadAsync(source, scene, (p) => progressIndicator.value = p*100);
    }
  } else if (source instanceof File) {
    const fileName = source.name;
    if (fileName.endsWith(".splat")) {
      await SPLAT.Loader.LoadFromFileAsync(source, scene, (p) => progressIndicator.value = p*100);
    } else if (fileName.endsWith(".ply")) {
      await SPLAT.PLYLoader.LoadFromFileAsync(source, scene, (p) => progressIndicator.value = p*100);
    }
  }

  progressDialog.close();
}

function renderLoop() {
  if (!inVR) {
    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(renderLoop);
  }
}
renderLoop();

function convertSplatToThree(scene) {
  const threeScene = new THREE.Scene();

  const sources = scene.pointClouds?.length ? scene.pointClouds : scene.passes;
  if (!sources || sources.length === 0) {
    debug("No point data found in scene after initial render");
    return threeScene;
  }

  sources.forEach((pc, idx) => {
    if (pc.vertices && pc.colors) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(pc.vertices, 3));
      geometry.setAttribute('color', new THREE.Float32BufferAttribute(pc.colors, 3));
      const material = new THREE.PointsMaterial({ size: 0.01, vertexColors: true });
      const points = new THREE.Points(geometry, material);

      geometry.computeBoundingBox();
      const box = geometry.boundingBox;
      const centerX = (box.max.x + box.min.x)/2;
      const centerY = (box.max.y + box.min.y)/2;
      const centerZ = (box.max.z + box.min.z)/2;
      geometry.translate(-centerX, -centerY, -centerZ);

      threeScene.add(points);
      debug(`Point cloud ${idx} added to Three.js scene, points: ${pc.vertices.length/3}`);
    }
  });

  return threeScene;
}



const vrButton = document.getElementById("enter-vr");
vrButton.style.display = "block";

vrButton.addEventListener("click", async () => {
  if (!navigator.xr) {
    alert("WebXR not available in this browser.");
    return;
  }

  try {
    controls.update();
    renderer.render(scene, camera);

    vrCanvas = document.createElement("canvas");
    vrCanvas.style.width = "100%";
    vrCanvas.style.height = "100%";
    document.body.appendChild(vrCanvas);

    const vrGl = vrCanvas.getContext("webgl", { xrCompatible: true });
    await vrGl.makeXRCompatible();

    vrRenderer = new THREE.WebGLRenderer({ canvas: vrCanvas, context: vrGl, antialias: true });
    vrRenderer.xr.enabled = true;
    vrRenderer.setSize(window.innerWidth, window.innerHeight);

    vrCamera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1000);
    vrCamera.position.set(0, 1.6, 3);

    const session = await navigator.xr.requestSession("immersive-vr", {
      optionalFeatures: ["local-floor", "bounded-floor"]
    });
    vrRenderer.xr.setSession(session);

    inVR = true;

    const vrThreeScene = convertSplatToThree(scene);
    addTestPoints(vrThreeScene);

    vrRenderer.setAnimationLoop(() => {
      vrRenderer.render(vrThreeScene, vrCamera);
    });

    debug("VR session started, rendering Three.js scene...");

  } catch (err) {
    console.warn("Failed to start VR session:", err);
    alert("Failed to start VR session.");
    debug("VR start error: " + err);
  }
});

function addTestPoints(scene) {
    const geometry = new THREE.BufferGeometry();
    const numPoints = 50;
    const positions = [];
    const colors = [];

    for (let i = 0; i < numPoints; i++) {
        positions.push((Math.random() - 0.5) * 2); // x
        positions.push(Math.random() * 2);           // y
        positions.push((Math.random() - 0.5) * 2); // z

        colors.push(Math.random());
        colors.push(Math.random());
        colors.push(Math.random());
    }

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({ size: 0.05, vertexColors: true });
    const points = new THREE.Points(geometry, material);
    scene.add(points);
}

function handleResize() {
  renderer.setSize(canvas.clientWidth, canvas.clientHeight);

  if (inVR && vrRenderer && vrCamera) {
    vrCamera.aspect = window.innerWidth / window.innerHeight;
    vrCamera.updateProjectionMatrix();
    vrRenderer.setSize(window.innerWidth, window.innerHeight);
  }
}
window.addEventListener("resize", handleResize);
handleResize();

const testURL = "https://huggingface.co/datasets/dylanebert/3dgs/resolve/main/bonsai/bonsai-7k-mini.splat";
loadScene(testURL);