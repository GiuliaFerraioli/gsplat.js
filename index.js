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
  
  console.log("=== CONVERT SPLAT TO THREE ===");
  console.log("Input scene:", scene);
  
  const sceneProps = Object.getOwnPropertyNames(scene);
  console.log("Scene properties:", sceneProps);
  
  sceneProps.forEach(prop => {
    const value = scene[prop];
    if (value && typeof value === 'object' && Array.isArray(value)) {
      console.log(`${prop}: Array with ${value.length} items`);
    } else if (value && typeof value === 'object') {
      console.log(`${prop}: Object (${value.constructor?.name})`);
    } else {
      console.log(`${prop}: ${typeof value} = ${value}`);
    }
  });
  
  debug(`Scene structure: children=${scene.children?.length}, pointClouds=${scene.pointClouds?.length}, passes=${scene.passes?.length}`);

  let sources = [];
  
  if (scene._objects && scene._objects.length > 0) {
    sources = scene._objects;
    debug(`Using scene._objects (${sources.length} items)`);
    console.log("Objects items:", scene._objects);
  }
  else if (scene.objects && scene.objects.length > 0) {
    sources = scene.objects;
    debug(`Using scene.objects (${sources.length} items)`);
    console.log("Objects items:", scene.objects);
  }
  else if (scene.children && scene.children.length > 0) {
    sources = scene.children;
    debug(`Using scene.children (${sources.length} items)`);
    console.log("Children items:", scene.children);
  }
  else if (scene.pointClouds && scene.pointClouds.length > 0) {
    sources = scene.pointClouds;
    debug(`Using scene.pointClouds (${sources.length} items)`);
    console.log("PointClouds items:", scene.pointClouds);
  }
  else if (scene.passes && scene.passes.length > 0) {
    sources = scene.passes;
    debug(`Using scene.passes (${sources.length} items)`);
    console.log("Passes items:", scene.passes);
  }
  
  if (sources.length === 0) {
    debug("No point data found in any expected location");
    console.log("Checking scene for direct vertex data...");
    
    if (scene.vertices && scene.colors) {
      debug("Found vertex data directly on scene object");
      console.log("Direct vertices:", scene.vertices?.length, "colors:", scene.colors?.length);
      sources = [scene];
    } else {
      debug("No vertex data found anywhere - checking for other data patterns");
      
      ['splats', 'data', 'pointData', 'geometry', 'buffer', 'points'].forEach(prop => {
        if (scene[prop]) {
          console.log(`Found potential data in scene.${prop}:`, scene[prop]);
        }
      });
      
      console.log("No usable data found - returning empty scene");
      return threeScene;
    }
  }

  sources.forEach((pc, idx) => {
    console.log(`=== PROCESSING ITEM ${idx} ===`);
    console.log("Item:", pc);
    console.log("Item properties:", Object.getOwnPropertyNames(pc));
    
    debug(`Processing item ${idx}: vertices=${pc.vertices?.length}, colors=${pc.colors?.length}`);
    
    let vertices = pc.vertices;
    let colors = pc.colors;
    
    console.log("Initial vertices:", vertices?.length, "colors:", colors?.length);
    
    if (!vertices && pc.geometry) {
      vertices = pc.geometry.vertices;
      colors = pc.geometry.colors;
      console.log("From geometry - vertices:", vertices?.length, "colors:", colors?.length);
    }
    
    if (!vertices && pc.attributes) {
      vertices = pc.attributes.position?.array || pc.attributes.vertices?.array;
      colors = pc.attributes.color?.array || pc.attributes.colors?.array;
      console.log("From attributes - vertices:", vertices?.length, "colors:", colors?.length);
    }
    
    ['data', 'buffer', 'positions', 'coords', 'xyz'].forEach(prop => {
      if (pc[prop] && !vertices) {
        console.log(`Checking pc.${prop}:`, pc[prop]);
        
        if (pc[prop]._positions) {
          vertices = pc[prop]._positions;
          console.log(`Found vertices in pc.${prop}._positions:`, vertices?.length);
        }
        
        if (pc[prop]._colors) {
          colors = pc[prop]._colors;
          console.log(`Found colors in pc.${prop}._colors:`, colors?.length);
        } else if (pc[prop]._rgb || pc[prop].rgb) {
          colors = pc[prop]._rgb || pc[prop].rgb;
          console.log(`Found colors in pc.${prop}._rgb/rgb:`, colors?.length);
        } else if (pc[prop]._color || pc[prop].color) {
          colors = pc[prop]._color || pc[prop].color;
          console.log(`Found colors in pc.${prop}._color/color:`, colors?.length);
        }
        
        if (pc[prop] && typeof pc[prop] === 'object') {
          const dataProps = Object.getOwnPropertyNames(pc[prop]);
          console.log(`Properties of pc.${prop}:`, dataProps);
          
          dataProps.forEach(dataProp => {
            if (dataProp.toLowerCase().includes('color') || 
                dataProp.toLowerCase().includes('rgb') || 
                dataProp.toLowerCase().includes('red') || 
                dataProp.toLowerCase().includes('green') || 
                dataProp.toLowerCase().includes('blue')) {
              console.log(`  Color-related property ${dataProp}:`, pc[prop][dataProp]?.length || pc[prop][dataProp]);
            }
          });
        }
      }
    });

    if (vertices && colors) {
      console.log(`Creating Three.js points with ${vertices.length/3} vertices`);
      console.log(`Color array info: length=${colors.length}, expected=${vertices.length}`);
      
      const geometry = new THREE.BufferGeometry();
      
      const vertexArray = vertices instanceof Float32Array ? vertices : new Float32Array(vertices);
      
      let colorArray;
      const expectedColorLength = vertices.length; 
      
      if (colors.length === expectedColorLength) {
        colorArray = colors instanceof Float32Array ? colors : new Float32Array(colors);
        console.log("Colors are in RGB format, using directly");
      } else if (colors.length === vertices.length / 3 * 4) {
        console.log("Colors appear to be RGBA, converting to RGB");
        
        let minColor = Infinity, maxColor = -Infinity;
        for (let i = 0; i < Math.min(100, colors.length); i++) {
          minColor = Math.min(minColor, colors[i]);
          maxColor = Math.max(maxColor, colors[i]);
        }
        console.log(`Color value range: ${minColor} to ${maxColor}`);
        
        const rgbColors = new Float32Array(vertices.length);
        for (let i = 0; i < vertices.length / 3; i++) {
          let r = colors[i * 4];     
          let g = colors[i * 4 + 1]; 
          let b = colors[i * 4 + 2]; 
          
          if (maxColor > 1.0) {
            r = r / 255.0;
            g = g / 255.0;
            b = b / 255.0;
          }
          
          rgbColors[i * 3] = r;
          rgbColors[i * 3 + 1] = g;
          rgbColors[i * 3 + 2] = b;
        }
        colorArray = rgbColors;
        console.log(`Converted RGBA to RGB, sample colors: R=${rgbColors[0]}, G=${rgbColors[1]}, B=${rgbColors[2]}`);
      } else {
        console.log("Unknown color format, trying to extract RGB");
        const numVertices = vertices.length / 3;
        colorArray = new Float32Array(vertices.length);
        
        for (let i = 0; i < numVertices; i++) {
          if (i * 3 < colors.length) {
            colorArray[i * 3] = colors[i * 3] || 1.0;
            colorArray[i * 3 + 1] = colors[i * 3 + 1] || 1.0; 
            colorArray[i * 3 + 2] = colors[i * 3 + 2] || 1.0; 
          } else {

            colorArray[i * 3] = 1.0;
            colorArray[i * 3 + 1] = 1.0;
            colorArray[i * 3 + 2] = 1.0;
          }
        }
      }
      
      console.log("Final arrays - vertices:", vertexArray.length, "colors:", colorArray.length);
      
      geometry.setAttribute('position', new THREE.BufferAttribute(vertexArray, 3));
      geometry.setAttribute('color', new THREE.BufferAttribute(colorArray, 3));

      const material = new THREE.PointsMaterial({ 
          size: 0.2, 
          vertexColors: true,
          sizeAttenuation: false, 
          transparent: false,
          alphaTest: 0.1
      });

      const points = new THREE.Points(geometry, material);

      geometry.computeBoundingBox();
      const box = geometry.boundingBox;
      if (box) {
        console.log("Bounding box:", box);
        const centerX = (box.max.x + box.min.x) / 2;
        const centerY = (box.max.y + box.min.y) / 2;
        const centerZ = (box.max.z + box.min.z) / 2;
        geometry.translate(-centerX, -centerY, -centerZ);

        const maxSize = Math.max(box.max.x - box.min.x, box.max.y - box.min.y, box.max.z - box.min.z);
        if (maxSize > 0) {
          const scale = 2.0 / maxSize; 
          points.scale.set(scale, scale, scale);
          console.log(`Scaled by ${scale}, max size was ${maxSize}`);
        }
      }

      threeScene.add(points);
      debug(`Point cloud ${idx} added: ${vertexArray.length/3} points`);
      console.log("Successfully added to Three.js scene");
    } else {
      debug(`Item ${idx} has no usable vertex/color data`);
      console.log(`  - vertices:`, vertices);
      console.log(`  - colors:`, colors);
      debug(`  - vertices type: ${typeof vertices}, length: ${vertices?.length}`);
      debug(`  - colors type: ${typeof colors}, length: ${colors?.length}`);
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
    const hasObjects = scene._objects?.length > 0 || scene.objects?.length > 0;
    const hasChildren = scene.children?.length > 0;
    const hasPointClouds = scene.pointClouds?.length > 0;
    const hasPasses = scene.passes?.length > 0;
    const hasVertices = scene.vertices && scene.vertices.length > 0;
    
    debug(`Scene check: _objects=${scene._objects?.length}, objects=${scene.objects?.length}, children=${hasChildren}, pointClouds=${hasPointClouds}, passes=${hasPasses}, vertices=${hasVertices}`);
    
    if (!scene || (!hasObjects && !hasChildren && !hasPointClouds && !hasPasses && !hasVertices)) {
      alert("Please wait for the PLY file to load first.");
      debug("Scene not ready for VR");
      return;
    }
    
    debug("Scene validation passed - entering VR");

    controls.update();
    renderer.render(scene, camera);

    vrCanvas = document.createElement("canvas");
    vrCanvas.style.position = "absolute";
    vrCanvas.style.top = "0";
    vrCanvas.style.left = "0";
    vrCanvas.style.width = "100%";
    vrCanvas.style.height = "100%";
    vrCanvas.style.zIndex = "1000";
    document.body.appendChild(vrCanvas);

    const vrGl = vrCanvas.getContext("webgl2", { xrCompatible: true }) || 
                 vrCanvas.getContext("webgl", { xrCompatible: true });
    await vrGl.makeXRCompatible();

    vrRenderer = new THREE.WebGLRenderer({ 
      canvas: vrCanvas, 
      context: vrGl, 
      antialias: true,
      alpha: false
    });
    vrRenderer.xr.enabled = true;
    vrRenderer.setSize(window.innerWidth, window.innerHeight);
    vrRenderer.setClearColor(0x000000, 1.0); 

    vrCamera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 100);
    vrCamera.position.set(0, 1.6, 3);

    const session = await navigator.xr.requestSession("immersive-vr", {
      optionalFeatures: ["local-floor", "bounded-floor"]
    });
    vrRenderer.xr.setSession(session);

    inVR = true;

    debug("Converting SPLAT scene to Three.js...");
    const vrThreeScene = convertSplatToThree(scene);
    
    const ambientLight = new THREE.AmbientLight(0x404040, 0.4);
    vrThreeScene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(1, 1, 1);
    vrThreeScene.add(directionalLight);

    addTestPoints(vrThreeScene);

    vrRenderer.setAnimationLoop(() => {
      vrRenderer.render(vrThreeScene, vrCamera);
    });

    session.addEventListener('end', () => {
      inVR = false;
      if (vrCanvas) {
        document.body.removeChild(vrCanvas);
        vrCanvas = null;
      }
      debug("VR session ended");
    });

    debug("VR session started successfully");

  } catch (err) {
    console.error("Failed to start VR session:", err);
    alert("Failed to start VR session: " + err.message);
    debug("VR start error: " + err.message);
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

// --- Load test scene ---
//const testURL = "https://huggingface.co/datasets/dylanebert/3dgs/resolve/main/bonsai/bonsai-7k-mini.splat";
//loadScene(testURL);

// Add this function to inspect your scene structure
function inspectSceneDetailed(scene) {
    console.log("=== DETAILED SCENE INSPECTION ===");
    console.log("Scene object:", scene);
    console.log("Scene type:", typeof scene);
    console.log("Scene constructor:", scene.constructor?.name);
    
    const props = Object.getOwnPropertyNames(scene);
    console.log("Scene properties:", props);
    
    props.forEach(prop => {
        const value = scene[prop];
        if (value && typeof value === 'object') {
            if (Array.isArray(value)) {
                console.log(`${prop}: Array with ${value.length} items`);
                if (value.length > 0) {
                    console.log(`  First item:`, value[0]);
                    console.log(`  First item properties:`, Object.getOwnPropertyNames(value[0]));
                }
            } else {
                console.log(`${prop}:`, typeof value, value.constructor?.name);
            }
        } else {
            console.log(`${prop}:`, typeof value, value);
        }
    });
    
    let proto = Object.getPrototypeOf(scene);
    let level = 0;
    while (proto && level < 3) {
        console.log(`Prototype level ${level}:`, proto.constructor?.name);
        console.log(`Prototype properties:`, Object.getOwnPropertyNames(proto));
        proto = Object.getPrototypeOf(proto);
        level++;
    }
}

const localPLY = "./point_cloud_2.ply"; 

async function loadLocalPLYScene() {
    try {
        progressDialog.show();
       
        const response = await fetch(localPLY);
        if (!response.ok) throw new Error("Local PLY not found");

        const buffer = await response.arrayBuffer();
        await SPLAT.PLYLoader.LoadFromArrayBuffer(buffer, scene);

        console.log("=== AFTER PLY LOADING ===");
        inspectSceneDetailed(scene);
        
        debug(`Local PLY loaded: ${localPLY}`);
        
        console.log("Looking for point cloud data...");
        
        if (typeof scene.getPointClouds === 'function') {
            console.log("Found getPointClouds method");
            const clouds = scene.getPointClouds();
            console.log("Point clouds from method:", clouds);
        }
        
        if (typeof scene.getData === 'function') {
            console.log("Found getData method");
            const data = scene.getData();
            console.log("Data from method:", data);
        }
        
        console.log("Triggering a render to populate data...");
        controls.update();
        renderer.render(scene, camera);
        
        console.log("=== AFTER FIRST RENDER ===");
        inspectSceneDetailed(scene);
        
    } catch (err) {
        debug(`Failed to load local PLY: ${err}`);
        alert("Failed to load local PLY file.");
        console.error("PLY loading error:", err);
    } finally {
        progressDialog.close();
    }
}

loadLocalPLYScene();
