const statusPill = document.querySelector("[data-status]");
const toggleButtons = document.querySelectorAll("[data-mode]");
const videoEntity = document.querySelector("#target-video");
const modelEntity = document.querySelector("#target-model");
const anchor = document.querySelector("#frame-anchor");
const sceneEl = document.querySelector("a-scene");
const videoAsset = document.querySelector("#experience-video");
const markerTitle = document.querySelector("[data-marker-title]");
const markerDescription = document.querySelector("[data-marker-description]");
const markerVideoLabel = document.querySelector("[data-marker-video]");
const markerPreview = document.querySelector("[data-marker-preview]");
const markerDownloadLink = document.querySelector("[data-marker-link]");

let activeMode = "video";
let activeMarker = null;
let currentVideoSource = videoAsset?.getAttribute("src");

const DEFAULT_MARKER = {
  id: "mindar-demo",
  name: "Marcador demo MindAR",
  description: "Usa este marcador mientras defines la textura final.",
  imageUrl:
    "https://cdn.jsdelivr.net/gh/hiukim/mind-ar-js@1.2.5/examples/image-tracking/assets/card-example.jpg",
  videoUrl: "/ar-experience/assets/experience.mp4",
};

const API = {
  active: "/api/markers/active",
};

const request = async (url, options = {}) => {
  const response = await fetch(url, options);
  let payload = null;
  try {
    payload = await response.json();
  } catch (error) {
    payload = null;
  }
  if (!response.ok) {
    const message = payload?.error || response.statusText || "No se pudo obtener la información";
    throw new Error(message);
  }
  return payload;
};

const updateVideoSource = (src) => {
  if (!videoAsset || !src || src === currentVideoSource) return;
  currentVideoSource = src;
  videoAsset.pause();
  videoAsset.src = src;
  videoAsset.load();
  if (activeMode === "video") {
    videoAsset.play().catch(() => null);
  }
};

const applyMarker = (marker = DEFAULT_MARKER) => {
  activeMarker = marker || DEFAULT_MARKER;
  markerTitle.textContent = activeMarker.name || "Sin marcador";
  markerDescription.textContent =
    activeMarker.description || "Configura imágenes permitidas desde el panel admin.";
  markerVideoLabel.textContent = activeMarker.videoUrl || "—";
  markerPreview.src = activeMarker.imageUrl || DEFAULT_MARKER.imageUrl;
  markerPreview.alt = activeMarker.name || "Marcador activo";
  if (markerDownloadLink) {
    markerDownloadLink.href = activeMarker.imageUrl || DEFAULT_MARKER.imageUrl;
  }
  updateVideoSource(activeMarker.videoUrl || DEFAULT_MARKER.videoUrl);
};

const syncActiveMarker = async () => {
  try {
    const data = await request(API.active);
    const nextMarker = data?.marker || DEFAULT_MARKER;
    const hasChanged =
      !activeMarker ||
      nextMarker.id !== activeMarker.id ||
      nextMarker.videoUrl !== activeMarker.videoUrl ||
      nextMarker.imageUrl !== activeMarker.imageUrl;

    if (hasChanged) {
      applyMarker(nextMarker);
      if (activeMode === "video") {
        videoAsset.play().catch(() => null);
      }
    }
  } catch (error) {
    console.warn("No se pudo sincronizar el marcador activo", error);
    if (!activeMarker) {
      applyMarker(DEFAULT_MARKER);
    }
  }
};

const setStatus = (message, state = "idle") => {
  statusPill.textContent = message;
  statusPill.classList.remove("is-ready", "is-error");

  if (state === "ready") statusPill.classList.add("is-ready");
  if (state === "error") statusPill.classList.add("is-error");
};

const setMode = (mode) => {
  activeMode = mode;
  toggleButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.mode === mode);
  });

  const isVideo = mode === "video";
  videoEntity.setAttribute("visible", isVideo);
  modelEntity.setAttribute("visible", !isVideo);

  if (isVideo) {
    videoAsset.play().catch(() => null);
  }
};

const unlockVideo = () => {
  videoAsset.play().catch(() => null);
  window.removeEventListener("touchstart", unlockVideo);
};

window.addEventListener("touchstart", unlockVideo, { passive: true });
window.addEventListener("click", unlockVideo, { passive: true });

toggleButtons.forEach((button) => {
  button.addEventListener("click", () => setMode(button.dataset.mode));
});

if (sceneEl) {
  sceneEl.addEventListener("arReady", () => {
    setStatus("Cámara lista. Busca el marco.", "ready");
    videoAsset.play().catch(() => null);
  });

  sceneEl.addEventListener("arError", (event) => {
    setStatus(`Error AR: ${event.detail?.error || "permiso denegado"}`, "error");
  });
}

if (anchor) {
  anchor.addEventListener("targetFound", () => {
    setStatus("Marcador detectado", "ready");
    if (activeMode === "video") {
      videoAsset.play().catch(() => null);
    }
  });

  anchor.addEventListener("targetLost", () => {
    setStatus("Marcador no detectado");
    if (activeMode === "video") {
      videoAsset.pause();
    }
  });
}

applyMarker(DEFAULT_MARKER);
syncActiveMarker();
setMode(activeMode);
setInterval(syncActiveMarker, 8000);
window.addEventListener("focus", syncActiveMarker);
