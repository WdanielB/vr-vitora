const listContainer = document.querySelector("[data-marker-list]");
const countBadge = document.querySelector("[data-count]");
const form = document.querySelector("[data-marker-form]");
const resetButton = document.querySelector("[data-reset]");
const previewCode = document.querySelector("[data-active-code]");
const previewName = document.querySelector("[data-active-name]");
const previewDescription = document.querySelector("[data-active-description]");
const previewVideo = document.querySelector("[data-active-video]");
const template = document.querySelector("#marker-row");

const DEFAULT_MARKER = {
  id: "cuadro-demo",
  name: "Cuadro de demostración",
  description: "Cuadro de prueba para verificar la experiencia AR.",
  code: "DEMO",
  videoUrl: "/ar-experience/assets/experience.mp4",
};

const API = {
  markers: "/api/markers",
  activate: (id) => `/api/markers/${id}/activate`,
  update: (id) => `/api/markers/${id}`,
  destroy: (id) => `/api/markers/${id}`,
  reset: "/api/reset",
};

const state = {
  markers: [],
  activeMarker: null,
};

const request = async (url, options = {}) => {
  const config = { ...options };
  if (config.body && !config.headers?.["Content-Type"]) {
    config.headers = { ...(config.headers || {}), "Content-Type": "application/json" };
  }
  const response = await fetch(url, config);
  let payload = null;
  try {
    payload = await response.json();
  } catch (error) {
    payload = null;
  }
  if (!response.ok) {
    const message = payload?.error || response.statusText || "Solicitud fallida";
    throw new Error(message);
  }
  return payload;
};

const setPlaceholder = (message) => {
  listContainer.innerHTML = `<div class="marker-empty">${message}</div>`;
};

const resolveActiveMarker = () =>
  state.activeMarker || state.markers.find((marker) => marker.active) || state.markers[0] || null;

const renderPreview = () => {
  const marker = resolveActiveMarker() || DEFAULT_MARKER;
  previewName.textContent = marker.name;
  previewDescription.textContent = marker.description || "Sin notas";
  previewVideo.textContent = marker.videoUrl || "—";
  previewCode.textContent = marker.code || "----";
};

const renderList = () => {
  if (!state.markers.length) {
    setPlaceholder("No hay cuadros registrados. Agrega el primer cuadro de tu florería.");
    return;
  }

  listContainer.innerHTML = "";

  state.markers.forEach((marker) => {
    const node = template.content.cloneNode(true);
    const row = node.querySelector("[data-marker-item]");
    row.dataset.id = marker.id;
    row.dataset.code = marker.code;

    node.querySelector("[data-row-code]").textContent = marker.code || "----";
    node.querySelector("[data-row-name]").textContent = marker.name;
    node.querySelector("[data-row-description]").textContent = marker.description || "Sin notas";
    node.querySelector("[data-row-video]").textContent = marker.videoUrl;

    listContainer.appendChild(node);
  });
};

const notify = (message, stateName = "info") => {
  const toast = document.createElement("div");
  toast.className = `toast toast--${stateName}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("is-visible"));
  setTimeout(() => {
    toast.classList.remove("is-visible");
    setTimeout(() => toast.remove(), 300);
  }, 2800);
};

let currentRequest = null;
const loadMarkers = async (force = false) => {
  if (currentRequest) {
    if (!force) return currentRequest;
    try {
      await currentRequest;
    } catch (error) {
      console.warn("Última sincronización fallida", error);
    }
  }

  if (!state.markers.length) {
    setPlaceholder("Cargando marcadores…");
  }

  currentRequest = (async () => {
    try {
      const data = await request(API.markers);
      state.markers = data.markers || [];
      state.activeMarker = data.activeMarker || state.markers.find((marker) => marker.active) || null;
      countBadge.textContent = `${state.markers.length} cuadros`;
      renderList();
      renderPreview();
    } catch (error) {
      setPlaceholder("No se pudo cargar la base.");
      notify(error.message || "No se pudo cargar la base", "error");
    } finally {
      currentRequest = null;
    }
  })();

  return currentRequest;
};

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(form);
  const payload = {
    name: formData.get("name"),
    imageUrl: formData.get("imageUrl"),
    videoUrl: formData.get("videoUrl"),
    description: formData.get("description"),
  };

  try {
    const result = await request(API.markers, { method: "POST", body: JSON.stringify(payload) });
    form.reset();
    const newCode = result.marker?.code || "????";
    notify(`¡Cuadro creado! Código: ${newCode}`, "success");
    await loadMarkers(true);
  } catch (error) {
    notify(error.message || "No se pudo guardar", "error");
  }
});

// Edit modal elements
const editModal = document.querySelector("[data-edit-modal]");
const editForm = document.querySelector("[data-edit-form]");
const modalBackdrop = document.querySelector("[data-modal-backdrop]");
const modalClose = document.querySelector("[data-modal-close]");
const modalCancel = document.querySelector("[data-modal-cancel]");

const openEditModal = (marker) => {
  editForm.querySelector('[name="id"]').value = marker.id;
  editForm.querySelector('[name="name"]').value = marker.name;
  editForm.querySelector('[name="imageUrl"]').value = marker.imageUrl;
  editForm.querySelector('[name="videoUrl"]').value = marker.videoUrl;
  editForm.querySelector('[name="description"]').value = marker.description || "";
  editModal.hidden = false;
};

const closeEditModal = () => {
  editModal.hidden = true;
  editForm.reset();
};

if (modalBackdrop) modalBackdrop.addEventListener("click", closeEditModal);
if (modalClose) modalClose.addEventListener("click", closeEditModal);
if (modalCancel) modalCancel.addEventListener("click", closeEditModal);

editForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(editForm);
  const id = formData.get("id");
  const payload = {
    name: formData.get("name"),
    imageUrl: formData.get("imageUrl"),
    videoUrl: formData.get("videoUrl"),
    description: formData.get("description"),
  };

  try {
    await request(API.update(id), { method: "PUT", body: JSON.stringify(payload) });
    closeEditModal();
    notify("Cuadro actualizado", "success");
    await loadMarkers(true);
  } catch (error) {
    notify(error.message || "No se pudo actualizar", "error");
  }
});

const copyToClipboard = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    // Fallback for older browsers
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand("copy");
      return true;
    } catch (e) {
      return false;
    } finally {
      document.body.removeChild(textarea);
    }
  }
};

listContainer.addEventListener("click", async (event) => {
  const target = event.target.closest("[data-action]");
  if (!target) return;
  const row = target.closest("[data-marker-item]");
  if (!row) return;
  const markerId = row.dataset.id;
  const markerCode = row.dataset.code;

  try {
    if (target.dataset.action === "delete") {
      if (!confirm("¿Eliminar este cuadro?")) return;
      await request(API.destroy(markerId), { method: "DELETE" });
      notify("Cuadro eliminado", "success");
      await loadMarkers(true);
    } else if (target.dataset.action === "copy") {
      const success = await copyToClipboard(markerCode);
      if (success) {
        notify(`Código ${markerCode} copiado al portapapeles`, "success");
      } else {
        notify(`Código: ${markerCode}`, "info");
      }
    } else if (target.dataset.action === "edit") {
      const marker = state.markers.find((m) => m.id === markerId);
      if (marker) openEditModal(marker);
    }
  } catch (error) {
    notify(error.message || "Operación no disponible", "error");
  }
});

resetButton.addEventListener("click", async () => {
  if (!confirm("Esto eliminará todos los cuadros y cargará uno de demostración. ¿Continuar?")) return;
  try {
    await request(API.reset, { method: "POST" });
    notify("Base restablecida correctamente", "success");
    await loadMarkers(true);
  } catch (error) {
    notify(error.message || "No se pudo restablecer", "error");
  }
});

const sync = () => {
  loadMarkers();
  setInterval(() => loadMarkers(), 8000);
  window.addEventListener("focus", () => loadMarkers(true));
};

sync();
