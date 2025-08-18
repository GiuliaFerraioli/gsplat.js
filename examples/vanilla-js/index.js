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


async function loadScene(source) {
    progressDialog.show();
    scene = new SPLAT.Scene();

    if (typeof source === "string") {
        // URL
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


document.getElementById("convert-download").addEventListener("click", () => {
    if (!currentFileName || !scene) {
        alert("No scene loaded to convert!");
        return;
    }

    if (currentFormat === "ply") {

        scene.saveToFile(currentFileName.replace(".ply", ".splat"));
    } else if (currentFormat === "splat") {

        scene.saveToFile(currentFileName.replace(".splat", ".ply"), "ply");
    }
});


document.getElementById("load-url").addEventListener("click", () => {
    const url = document.getElementById("url-input").value.trim();
    if (url) loadScene(url);
});


document.getElementById("file-input").addEventListener("change", (e) => {
    const files = e.target.files;
    if (files.length) loadScene(files[0]);
});


document.addEventListener("drop", (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer?.files.length) loadScene(e.dataTransfer.files[0]);
});
document.addEventListener("dragover", (e) => e.preventDefault());


function renderLoop() {
    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(renderLoop);
}


function handleResize() {
    renderer.setSize(canvas.clientWidth, canvas.clientHeight);
}
window.addEventListener("resize", handleResize);
handleResize();


renderLoop();

