import * as SPLAT from "https://cdn.jsdelivr.net/npm/gsplat@latest";

const canvas = document.getElementById("canvas");
const progressDialog = document.getElementById("progress-dialog");
const progressIndicator = document.getElementById("progress-indicator");

const renderer = new SPLAT.WebGLRenderer(canvas);
const scene = new SPLAT.Scene();
const camera = new SPLAT.Camera();
const controls = new SPLAT.OrbitControls(camera, canvas);

const format = "";

async function loadFromURL(url) {
    progressDialog.show();
    if (url.endsWith(".splat")) {
        await SPLAT.Loader.LoadAsync(url, scene, (progress) => (progressIndicator.value = progress * 100));
    } else if (url.endsWith(".ply")) {
        await SPLAT.PLYLoader.LoadAsync(url, scene, (progress) => (progressIndicator.value = progress * 100), format);
        scene.saveToFile(url.split("/").pop()?.replace(".ply", ".splat"));
    }
    progressDialog.close();
}

let loading = false;
async function selectFile(file) {
    if (loading) return;
    loading = true;

    if (file.name.endsWith(".splat")) {
        await SPLAT.Loader.LoadFromFileAsync(file, scene, (progress) => (progressIndicator.value = progress * 100));
    } else if (file.name.endsWith(".ply")) {
        await SPLAT.PLYLoader.LoadFromFileAsync(file, scene, (progress) => (progressIndicator.value = progress * 100), format);
        scene.saveToFile(file.name.replace(".ply", ".splat"));
    }

    loading = false;
}

document.addEventListener("drop", (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer?.files.length) selectFile(e.dataTransfer.files[0]);
});
document.addEventListener("dragover", (e) => e.preventDefault());


function renderLoop() {
    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(renderLoop);
}


const btnSplat = document.getElementById("load-splat");
const btnPLY = document.getElementById("load-ply");

btnSplat.addEventListener("click", () => {
    const url = "https://huggingface.co/datasets/dylanebert/3dgs/resolve/main/bonsai/bonsai-7k-mini.splat";
    loadFromURL(url);
});

btnPLY.addEventListener("click", () => {
    const url = "https://huggingface.co/datasets/dylanebert/3dgs/resolve/main/bonsai/point_cloud/iteration_7000/point_cloud.ply";
    loadFromURL(url);
});


function main() {
    renderLoop();

    const handleResize = () => renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    window.addEventListener("resize", handleResize);
    handleResize();
}

main();

