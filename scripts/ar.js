// === DOM Elements ===
const codeScreen = document.querySelector("[data-code-screen]");
const codeInput = document.querySelector("[data-code-input]");
const submitBtn = document.querySelector("[data-submit]");
const codeError = document.querySelector("[data-code-error]");

const arScreen = document.querySelector("[data-ar-screen]");
const arName = document.querySelector("[data-ar-name]");
const statusBadge = document.querySelector("[data-status]");
const hintEl = document.querySelector("[data-hint]");
const detectedEl = document.querySelector("[data-detected]");
const sceneContainer = document.querySelector("[data-scene-container]");
const backBtn = document.querySelector("[data-back-ar]");

const helpBtn = document.querySelector("[data-help]");
const helpModal = document.querySelector("[data-help-modal]");
const helpClose = document.querySelector("[data-help-close]");
const playVideoBtn = document.querySelector("[data-play-video]");
const fullscreenBtn = document.querySelector("[data-fullscreen]");

// === State ===
let currentMarker = null;
let sceneEl = null;
let isTracking = false;
let videoPlaying = false;
let isFullscreen = false;

// === API ===
const API = {
  byCode: (code) => `/api/markers/code/${code}`,
};

const fetchMarkerByCode = async (code) => {
  try {
    const response = await fetch(API.byCode(code));
    if (!response.ok) {
      if (response.status === 404) return { error: "not_found" };
      throw new Error("API error");
    }
    const data = await response.json();
    return { marker: data.marker };
  } catch (error) {
    console.error("Error fetching marker:", error);
    return { error: "network" };
  }
};

// === UI Helpers ===
const showError = (show = true) => {
  if (codeError) codeError.hidden = !show;
  if (show && codeInput) {
    codeInput.classList.add("is-error");
    codeInput.focus();
  } else if (codeInput) {
    codeInput.classList.remove("is-error");
  }
};

const setLoading = (loading) => {
  if (!submitBtn) return;
  submitBtn.disabled = loading || (codeInput && codeInput.value.length !== 4);
  const span = submitBtn.querySelector("span");
  if (span) {
    span.textContent = loading ? "Buscando..." : "Activar camara";
  }
};

const setStatus = (message, state = "idle") => {
  if (!statusBadge) return;
  statusBadge.textContent = message;
  statusBadge.classList.remove("is-ready", "is-error");
  if (state === "ready") statusBadge.classList.add("is-ready");
  if (state === "error") statusBadge.classList.add("is-error");
};

const showDetected = (show) => {
  if (detectedEl) detectedEl.hidden = !show;
  if (hintEl) hintEl.hidden = show;
};

// === AR Scene Creation ===
const createARScene = (marker) => {
  // Remove existing scene if any
  if (sceneEl) {
    sceneEl.remove();
    sceneEl = null;
  }

  // Create scene with innerHTML for proper MindAR setup
  const sceneHTML = `
    <a-scene
      mindar-image="imageTargetSrc: ${marker.imageUrl}; autoStart: true; uiLoading: no; uiScanning: no; uiError: no"
      vr-mode-ui="enabled: false"
      device-orientation-permission-ui="enabled: false"
      loading-screen="enabled: false"
      embedded
    >
      <a-assets>
        <video 
          id="ar-video" 
          src="${marker.videoUrl}" 
          preload="auto" 
          loop 
          crossorigin="anonymous"
          playsinline
          webkit-playsinline
        ></video>
      </a-assets>

      <a-camera position="0 0 0" look-controls="enabled: false"></a-camera>

      <a-entity id="ar-anchor" mindar-image-target="targetIndex: 0">
        <a-video
          id="video-plane"
          src="#ar-video"
          position="0 0 0"
          width="1"
          height="0.552"
          rotation="0 0 0"
        ></a-video>
      </a-entity>
    </a-scene>
  `;

  sceneContainer.innerHTML = sceneHTML;
  sceneEl = sceneContainer.querySelector("a-scene");

  // Wait for scene to load before adding listeners
  sceneEl.addEventListener("loaded", () => {
    const anchor = document.getElementById("ar-anchor");
    
    sceneEl.addEventListener("arReady", () => {
      setStatus("Buscando cuadro...");
      console.log("AR Ready");
    });

    sceneEl.addEventListener("arError", (e) => {
      console.error("AR error", e.detail);
      setStatus("Error de camara", "error");
    });

    if (anchor) {
      anchor.addEventListener("targetFound", () => {
        console.log("Target Found!");
        isTracking = true;
        setStatus("Detectado!", "ready");
        showDetected(true);
        // Hide hint when detected
        if (hintEl) hintEl.hidden = true;
        // Show play button instead of auto-playing
        if (playVideoBtn && !videoPlaying) {
          playVideoBtn.hidden = false;
        }
        setTimeout(() => {
          if (isTracking && detectedEl) detectedEl.hidden = true;
        }, 2500);
      });

      anchor.addEventListener("targetLost", () => {
        console.log("Target Lost");
        isTracking = false;
        setStatus("Buscando cuadro...");
        showDetected(false);
        // Show hint again when lost, hide play button if not playing
        if (hintEl && !videoPlaying) hintEl.hidden = false;
        // Hide play button when target lost
        if (playVideoBtn && !videoPlaying) {
          playVideoBtn.hidden = true;
        }
      });
    }
  });

  // Touch/click to unlock video on iOS - removed auto-play
};

// === Play Video Handler ===
const handlePlayVideo = () => {
  const vid = document.getElementById("ar-video");
  if (vid) {
    vid.muted = false;
    vid.play().then(() => {
      videoPlaying = true;
      if (playVideoBtn) playVideoBtn.hidden = true;
      setStatus("Reproduciendo", "ready");
    }).catch((e) => {
      console.log("Video play error:", e);
      // Try muted if unmuted fails
      vid.muted = true;
      vid.play().then(() => {
        videoPlaying = true;
        if (playVideoBtn) playVideoBtn.hidden = true;
        setStatus("Reproduciendo (sin audio)", "ready");
      }).catch(() => {});
    });
  }
};

// === Screen Navigation ===
const showARScreen = (marker) => {
  currentMarker = marker;
  
  if (arName) arName.textContent = marker.name;
  setStatus("Iniciando camara...");
  
  if (codeScreen) codeScreen.hidden = true;
  if (arScreen) arScreen.hidden = false;
  
  // Create and start AR scene
  createARScene(marker);
};

const showCodeScreen = () => {
  // Stop and remove AR scene
  if (sceneEl) {
    const arSystem = sceneEl.systems && sceneEl.systems["mindar-image-system"];
    if (arSystem && arSystem.stop) {
      try { arSystem.stop(); } catch (e) {}
    }
    sceneEl.remove();
    sceneEl = null;
  }
  
  currentMarker = null;
  isTracking = false;
  
  if (arScreen) arScreen.hidden = true;
  if (codeScreen) codeScreen.hidden = false;
  
  if (codeInput) {
    codeInput.value = "";
    codeInput.focus();
  }
  if (submitBtn) submitBtn.disabled = true;
  showError(false);
};

// === Event Handlers ===
const handleCodeInput = () => {
  if (!codeInput) return;
  const value = codeInput.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  codeInput.value = value;
  if (submitBtn) submitBtn.disabled = value.length !== 4;
  showError(false);
};

const handleSubmit = async () => {
  if (!codeInput) return;
  const code = codeInput.value.toUpperCase().trim();
  if (code.length !== 4) return;
  
  showError(false);
  setLoading(true);
  
  const result = await fetchMarkerByCode(code);
  
  setLoading(false);
  
  if (result.error) {
    showError(true);
    return;
  }
  
  showARScreen(result.marker);
};

// === Event Listeners ===
if (codeInput) {
  codeInput.addEventListener("input", handleCodeInput);
  codeInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && codeInput.value.length === 4) {
      handleSubmit();
    }
  });
}

if (submitBtn) submitBtn.addEventListener("click", handleSubmit);
if (backBtn) backBtn.addEventListener("click", showCodeScreen);
if (playVideoBtn) playVideoBtn.addEventListener("click", handlePlayVideo);

// Fullscreen functionality
const toggleFullscreen = async () => {
  try {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
      isFullscreen = true;
      if (fullscreenBtn) fullscreenBtn.classList.add("is-active");
    } else {
      await document.exitFullscreen();
      isFullscreen = false;
      if (fullscreenBtn) fullscreenBtn.classList.remove("is-active");
    }
  } catch (e) {
    console.log("Fullscreen error:", e);
  }
};

document.addEventListener("fullscreenchange", () => {
  isFullscreen = !!document.fullscreenElement;
  if (fullscreenBtn) {
    fullscreenBtn.classList.toggle("is-active", isFullscreen);
  }
});

if (fullscreenBtn) fullscreenBtn.addEventListener("click", toggleFullscreen);

// Help modal
const helpBackdrop = document.querySelector("[data-help-backdrop]");
const helpContent = document.querySelector(".help-modal__content");

if (helpBtn) {
  helpBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (helpModal) helpModal.hidden = false;
  });
}

if (helpClose) {
  helpClose.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    console.log("Close button clicked");
    if (helpModal) {
      helpModal.hidden = true;
      console.log("Modal closed");
    }
  });
}

// Prevent clicks on content from closing the modal
if (helpContent) {
  helpContent.addEventListener("click", (e) => {
    e.stopPropagation();
  });
}

if (helpBackdrop) {
  helpBackdrop.addEventListener("click", () => {
    if (helpModal) helpModal.hidden = true;
  });
}

if (helpModal) {
  helpModal.addEventListener("click", (e) => {
    // Close if clicking the modal itself (backdrop)
    if (e.target === helpModal) {
      helpModal.hidden = true;
    }
  });
}

// === Initialize ===
if (codeInput) codeInput.focus();

// Deep linking: check URL for code parameter
const urlParams = new URLSearchParams(window.location.search);
const urlCode = urlParams.get("code") || urlParams.get("c");
if (urlCode && urlCode.length === 4 && codeInput) {
  codeInput.value = urlCode.toUpperCase();
  handleCodeInput();
  handleSubmit();
}
