import * as SPLAT from "https://cdn.jsdelivr.net/npm/gsplat@latest";

const canvas = document.getElementById("canvas");
const progressDialog = document.getElementById("progress-dialog");
const progressIndicator = document.getElementById("progress-indicator");

let scene = new SPLAT.Scene();
const camera = new SPLAT.Camera();
const controls = new SPLAT.OrbitControls(camera, canvas);
const renderer = new SPLAT.WebGLRenderer(canvas);

let currentFileName = "";
let currentFormat = "";
const format = "";


async function loadScene(source) {
  progressDialog.show();
  scene = new SPLAT.Scene();

  if (typeof source === "string") {
    currentFileName = source.split("/").pop();
    if (currentFileName.endsWith(".splat")) {
      currentFormat = "splat";
      await SPLAT.Loader.LoadAsync(source, scene, (progress) => progressIndicator.value = progress * 100);
    } else if (currentFileName.endsWith(".ply")) {
      currentFormat = "ply";
      await SPLAT.PLYLoader.LoadAsync(source, scene, (progress) => progressIndicator.value = progress * 100, format);
    }
  } else if (source instanceof File) {
    currentFileName = source.name;
    if (currentFileName.endsWith(".splat")) {
      currentFormat = "splat";
      await SPLAT.Loader.LoadFromFileAsync(source, scene, (progress) => progressIndicator.value = progress * 100);
    } else if (currentFileName.endsWith(".ply")) {
      currentFormat = "ply";
      await SPLAT.PLYLoader.LoadFromFileAsync(source, scene, (progress) => progressIndicator.value = progress * 100, format);
    }
  }

  progressDialog.close();
}


let xrSession = null;
let gl = null;


const vrButton = document.getElementById("enter-vr");
vrButton.style.display = "block";

vrButton.addEventListener("click", async () => {
  if (!navigator.xr) {
    alert("WebXR not available in this browser.");
    return;
  }

  try {
    xrSession = await navigator.xr.requestSession("immersive-vr", {
      optionalFeatures: ["local-floor", "bounded-floor"]
    });

    gl = canvas.getContext("webgl", { xrCompatible: true });
    await gl.makeXRCompatible();

    const xrLayer = new XRWebGLLayer(xrSession, gl);
    xrSession.updateRenderState({ baseLayer: xrLayer });

    const xrReferenceSpace = await xrSession.requestReferenceSpace("local");

    const onXRFrame = (time, frame) => {
      const session = frame.session;
      controls.update();
      renderer.render(scene, camera);
      session.requestAnimationFrame(onXRFrame);
    };

    xrSession.requestAnimationFrame(onXRFrame);
  } catch (err) {
    console.warn("Error entering VR:", err);
    alert("Failed to start VR session.");
  }
});

function renderLoop() {
  if (!xrSession) {
    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(renderLoop);
  }
}


function handleResize() {
  renderer.setSize(canvas.clientWidth, canvas.clientHeight);
}
window.addEventListener("resize", handleResize);
handleResize();

renderLoop();


const testURL = "https://huggingface.co/datasets/dylanebert/3dgs/resolve/main/bonsai/bonsai-7k-mini.splat";
loadScene(testURL);
