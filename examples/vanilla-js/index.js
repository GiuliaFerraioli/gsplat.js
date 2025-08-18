import * as SPLAT from "https://cdn.jsdelivr.net/npm/gsplat@latest";

const canvas = document.getElementById("canvas");
const progressDialog = document.getElementById("progress-dialog");
const progressIndicator = document.getElementById("progress-indicator");

let scene = new SPLAT.Scene();
const camera = new SPLAT.Camera();
const controls = new SPLAT.OrbitControls(camera, canvas);
const renderer = new SPLAT.WebGLRenderer(canvas);

const format = ""; 


async function loadScene(source) {
    progressDialog.show();
    scene = new SPLAT.Scene(); 

    let isSplat = false;
    let isPly = false;

    if (typeof source === "string") {

        isSplat = source.endsWith(".splat");
        isPly = source.endsWith(".ply");

        if (isSplat) {
            await SPLAT.Loader.LoadAsync(source, scene, (progress) => progressIndicator.value = progress * 100);
        } else if (isPly) {
            await SPLAT.PLYLoader.LoadAsync(source, scene, (progress) => progressIndicator.value = progress * 100, format);
            scene.saveToFile(source.split("/").pop()?.replace(".ply", ".splat"));
        }
    } else if (source instanceof File) {

        isSplat = source.name.endsWith(".splat");
        isPly = source.name.endsWith(".ply");

        if (isSplat) {
            await SPLAT.Loader.LoadFromFileAsync(source, scene, (progress) => progressIndicator.value = progress * 100);
        } else if (isPly) {
            await SPLAT.PLYLoader.LoadFromFileAsync(source, scene, (progress) => progressIndicator.value = progress * 100, format);
            scene.saveToFile(source.name.replace(".ply", ".splat"));
        }
    } else {
        console.error("Unknown source type");
    }

    progressDialog.close();
}


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

