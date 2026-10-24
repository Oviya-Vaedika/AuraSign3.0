
"use strict";

/*
 * AURA SIGN — LOCAL FRONTEND
 * No backend API calls and no API key.
 *
 * Features:
 * - Text input, examples, copy, clear and speech
 * - Browser-local text-to-fingerspelling output
 * - Camera hand tracking using MediaPipe Hands
 * - Hand landmark overlay
 * - Camera start/stop controls
 * - Three.js idle avatar
 *
 * NOTE:
 * Landmark tracking alone is not a trained ISL recognition model.
 */

const $ = (id) => document.getElementById(id);

let toastTimer;
let cameraStream = null;
let handsModel = null;
let cameraRunning = false;
let processingFrame = false;
let lastDetection = "";
let animationFrameId = null;

let threeRenderer = null;
let threeScene = null;
let threeCamera = null;
let avatarGroup = null;
let resizeObserver = null;

const NO_RECOGNITION = "No sign recognised yet.";

function showToast(message) {
  const toast = $("toast");
  if (!toast) return;

  toast.textContent = message;
  toast.classList.add("show");

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 3000);
}

function setResult(text, note = "") {
  if ($("resultText")) $("resultText").textContent = text;
  if ($("resultNote")) $("resultNote").textContent = note;
}

function setTextIfPresent(id, text) {
  const element = $(id);
  if (element) element.textContent = text;
}

function setDisabled(id, disabled) {
  const element = $(id);
  if (element) element.disabled = disabled;
}

/* ---------------- MODE SWITCHING ---------------- */

function setMode(mode) {
  const textMode = mode === "text";

  $("textTab")?.classList.toggle("active", textMode);
  $("cameraTab")?.classList.toggle("active", !textMode);

  $("textTab")?.setAttribute("aria-selected", String(textMode));
  $("cameraTab")?.setAttribute("aria-selected", String(!textMode));

  $("textSection")?.classList.toggle("hidden", !textMode);
  $("cameraSection")?.classList.toggle("hidden", textMode);
  $("avatarPanel")?.classList.toggle("hidden", !textMode);

  setTextIfPresent("inputHeading", textMode ? "Text to sign" : "Sign to text");
  setTextIfPresent("modeStatus", textMode ? "TEXT MODE" : "CAMERA MODE");

  if (!textMode) {
    stopCamera();
    setTextIfPresent("avatarMode", "IDLE MODE");
  }
}

$("textTab")?.addEventListener("click", () => setMode("text"));
$("cameraTab")?.addEventListener("click", () => setMode("camera"));

/* ---------------- TEXT INPUT ---------------- */

function updateCharacterCount() {
  const input = $("textInput");
  if (!input) return;

  setTextIfPresent("charCount", `${input.value.length} / 500`);
}

$("textInput")?.addEventListener("input", updateCharacterCount);

document.querySelectorAll("[data-example]").forEach((button) => {
  button.addEventListener("click", () => {
    const input = $("textInput");
    if (!input) return;

    input.value = button.dataset.example || "";
    updateCharacterCount();
    input.focus();
  });
});

/*
 * Local fingerspelling output.
 * This displays the letters of the typed message.
 * It does NOT claim that English fingerspelling is a complete ISL translation.
 */
function makeLocalFingerspelling(text) {
  const cleaned = text
    .toUpperCase()
    .replace(/[^A-Z0-9 .,?!']/g, "");

  if (!cleaned) return "";

  return cleaned
    .split("")
    .map((character) => {
      if (character === " ") return "/";
      if (character === ",") return ",";
      if (character === ".") return ".";
      if (character === "?") return "?";
      if (character === "!") return "!";
      if (character === "'") return "'";
      return character;
    })
    .join(" ");
}

$("translateButton")?.addEventListener("click", () => {
  const input = $("textInput");
  const text = input?.value.trim() || "";

  if (!text) {
    showToast("Enter a message first.");
    input?.focus();
    return;
  }

  if (text.length > 500) {
    showToast("Please keep your message within 500 characters.");
    return;
  }

  const output = makeLocalFingerspelling(text);

  setResult(
    output,
    "Local fingerspelling preview only. This is not a verified ISL sentence translation or animated sign sequence."
  );

  setTextIfPresent("modeStatus", "LOCAL PREVIEW");
  setTextIfPresent("avatarMode", "IDLE PREVIEW");

  showToast("Local fingerspelling preview created.");
});

$("copyButton")?.addEventListener("click", async () => {
  const text = $("resultText")?.textContent || "";

  try {
    if (!navigator.clipboard?.writeText) {
      throw new Error("Clipboard unavailable");
    }

    await navigator.clipboard.writeText(text);
    showToast("Result copied.");
  } catch {
    showToast("Copy failed. Select the result and copy it manually.");
  }
});

$("clearButton")?.addEventListener("click", () => {
  setResult(
    "Enter a message and select Translate to Sign.",
    "Local fingerspelling preview; verified ISL animations are not connected."
  );

  setTextIfPresent("modeStatus", "TEXT MODE");
});

$("speakButton")?.addEventListener("click", () => {
  const text = $("resultText")?.textContent?.trim() || "";

  if (!text || !("speechSynthesis" in window)) {
    showToast("Speech is not available in this browser.");
    return;
  }

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.9;
  window.speechSynthesis.speak(utterance);
});

/* ---------------- CAMERA STATUS ---------------- */

function detectionStatus(title, message) {
  setTextIfPresent("detectionTitle", title);
  setTextIfPresent("detectionMessage", message);
}

function clearOverlay() {
  const canvas = $("cameraOverlay");
  const ctx = canvas?.getContext("2d");

  if (ctx && canvas) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
}

function drawLandmarks(points) {
  const video = $("cameraVideo");
  const canvas = $("cameraOverlay");

  if (!video || !canvas || !video.videoWidth || !video.videoHeight) {
    return;
  }

  if (
    canvas.width !== video.videoWidth ||
    canvas.height !== video.videoHeight
  ) {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
  }

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Mirror the skeleton so it matches a selfie-style camera preview.
  ctx.save();
  ctx.translate(canvas.width, 0);
  ctx.scale(-1, 1);

  ctx.strokeStyle = "#22d3ee";
  ctx.fillStyle = "#a78bfa";
  ctx.lineWidth = Math.max(2, canvas.width / 400);

  const connections = [
    [0, 1], [1, 2], [2, 3], [3, 4],
    [0, 5], [5, 6], [6, 7], [7, 8],
    [5, 9], [9, 10], [10, 11], [11, 12],
    [9, 13], [13, 14], [14, 15], [15, 16],
    [13, 17], [17, 18], [18, 19], [19, 20],
    [0, 17]
  ];

  for (const [a, b] of connections) {
    if (!points[a] || !points[b]) continue;

    ctx.beginPath();
    ctx.moveTo(
      points[a].x * canvas.width,
      points[a].y * canvas.height
    );
    ctx.lineTo(
      points[b].x * canvas.width,
      points[b].y * canvas.height
    );
    ctx.stroke();
  }

  for (const point of points) {
    ctx.beginPath();
    ctx.arc(
      point.x * canvas.width,
      point.y * canvas.height,
      Math.max(2.5, canvas.width / 220),
      0,
      Math.PI * 2
    );
    ctx.fill();
  }

  ctx.restore();
}

/* ---------------- MEDIAPIPE HAND TRACKING ---------------- */

async function initialiseHandDetector() {
  if (handsModel) return handsModel;

  if (typeof window.Hands === "undefined") {
    throw new Error(
      "MediaPipe Hands did not load. Check the library script in index.html and refresh."
    );
  }

  handsModel = new window.Hands({
    locateFile: (file) =>
      `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
  });

  handsModel.setOptions({
    maxNumHands: 2,
    modelComplexity: 1,
    minDetectionConfidence: 0.7,
    minTrackingConfidence: 0.65
  });

  handsModel.onResults((results) => {
    const hands = results.multiHandLandmarks || [];
    const points = hands[0];

    if (points) {
      drawLandmarks(points);

      const handCount = hands.length;
      setTextIfPresent("cameraLabel", `${handCount} HAND${handCount > 1 ? "S" : ""} TRACKED`);

      if (lastDetection !== "hand") {
        detectionStatus(
          "Hand detected",
          "Landmarks are tracking. ISL letter recognition requires a validated ISL-trained classifier."
        );

        if (
          $("recognisedText") &&
          $("recognisedText").textContent === NO_RECOGNITION
        ) {
          $("recognisedText").textContent = "Hand detected — tracking landmarks.";
        }

        lastDetection = "hand";
      }
    } else {
      clearOverlay();
      setTextIfPresent("cameraLabel", "LOOKING FOR HAND");

      if (lastDetection !== "none") {
        detectionStatus(
          "No hand detected",
          "Keep your hand visible in the frame and try brighter, even lighting."
        );
        lastDetection = "none";
      }
    }
  });

  return handsModel;
}

/* ---------------- CAMERA FRAME LOOP ---------------- */

async function frameLoop() {
  if (!cameraRunning) return;

  const video = $("cameraVideo");

  if (
    !processingFrame &&
    video &&
    video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
    handsModel
  ) {
    processingFrame = true;

    try {
      await handsModel.send({ image: video });
    } catch (error) {
      console.error("Hand tracking frame failed:", error);
      detectionStatus(
        "Tracking error",
        "Could not process the camera frame. Try stopping and restarting the camera."
      );
    } finally {
      processingFrame = false;
    }
  }

  if (cameraRunning) {
    animationFrameId = requestAnimationFrame(frameLoop);
  }
}

/* ---------------- CAMERA START / STOP ---------------- */

$("startCameraButton")?.addEventListener("click", async () => {
  if (cameraRunning) return;

  const button = $("startCameraButton");
  if (button) button.disabled = true;

  detectionStatus("Starting camera…", "Allow camera permission when prompted.");

  try {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("Camera access requires HTTPS or localhost.");
    }

    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: "user",
        width: { ideal: 1280 },
        height: { ideal: 720 }
      },
      audio: false
    });

    const video = $("cameraVideo");

    if (!video) {
      throw new Error("The cameraVideo element is missing from index.html.");
    }

    video.srcObject = cameraStream;
    video.muted = true;
    video.playsInline = true;

    await video.play();
    await initialiseHandDetector();

    cameraRunning = true;
    processingFrame = false;
    lastDetection = "";

    setDisabled("stopCameraButton", false);
    setTextIfPresent("cameraLabel", "CAMERA ACTIVE");

    detectionStatus(
      "Camera active",
      "Looking for hands. Landmark tracking is active; sign recognition is not yet trained."
    );

    frameLoop();
  } catch (error) {
    console.error("Camera startup failed:", error);
    stopCamera();

    detectionStatus("Camera unavailable", error.message || "Could not start the camera.");
    showToast(error.message || "Could not start the camera.");
  } finally {
    if (button) button.disabled = cameraRunning;
  }
});

function stopCamera() {
  cameraRunning = false;
  processingFrame = false;

  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }

  if (cameraStream) {
    cameraStream.getTracks().forEach((track) => track.stop());
    cameraStream = null;
  }

  const video = $("cameraVideo");

  if (video) {
    video.pause();
    video.srcObject = null;
  }

  clearOverlay();

  setTextIfPresent("cameraLabel", "CAMERA OFF");
  setDisabled("startCameraButton", false);
  setDisabled("stopCameraButton", true);

  lastDetection = "";
}

$("stopCameraButton")?.addEventListener("click", () => {
  stopCamera();
  detectionStatus("Camera stopped", "Start the camera whenever you are ready.");
});

$("clearRecognisedButton")?.addEventListener("click", () => {
  setTextIfPresent("recognisedText", NO_RECOGNITION);
});

$("speakRecognisedButton")?.addEventListener("click", () => {
  const text = $("recognisedText")?.textContent?.trim() || "";

  if (!text || text === NO_RECOGNITION) {
    showToast("There is no recognised text to speak.");
    return;
  }

  if (!("speechSynthesis" in window)) {
    showToast("Speech is not available in this browser.");
    return;
  }

  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
});

window.addEventListener("pagehide", stopCamera);

/* ---------------- 3D AVATAR PREVIEW ---------------- */

function createPart(parent, geometry, material, position, scale) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);

  if (scale) {
    mesh.scale.set(...scale);
  }

  parent.add(mesh);
  return mesh;
}

function createAvatar() {
  const fallback = $("avatarFallback");
  const canvas = $("avatarCanvas");

  if (!canvas || !window.THREE) {
    if (fallback) {
      fallback.textContent =
        "3D preview unavailable. Check that Three.js is loaded in index.html.";
    }
    return;
  }

  try {
    threeScene = new THREE.Scene();
    threeScene.background = new THREE.Color("#0c1020");

    threeCamera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
    threeCamera.position.set(0, 1.25, 5.5);
    threeCamera.lookAt(0, 1.1, 0);

    threeRenderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true
    });

    threeRenderer.setPixelRatio(
      Math.min(window.devicePixelRatio || 1, 2)
    );

    threeScene.add(
      new THREE.HemisphereLight(0xe3eaff, 0x24133f, 2)
    );

    const mainLight = new THREE.DirectionalLight(0xffffff, 2.5);
    mainLight.position.set(3, 5, 4);
    threeScene.add(mainLight);

    const rimLight = new THREE.PointLight(0x22d3ee, 18, 10);
    rimLight.position.set(-2, 2, -2);
    threeScene.add(rimLight);

    avatarGroup = new THREE.Group();
    threeScene.add(avatarGroup);

    const material = (color) =>
      new THREE.MeshStandardMaterial({
        color,
        roughness: 0.65
      });

    const skin = material("#d89b7c");
    const hair = material("#20182f");
    const shirt = material("#6550c9");
    const sleeve = material("#8b5cf6");
    const pants = material("#25324f");
    const dark = material("#171426");

    createPart(
      avatarGroup,
      new THREE.CapsuleGeometry(0.42, 0.58, 5, 12),
      shirt,
      [0, 1.12, 0],
      [1, 1, 0.75]
    );

    createPart(
      avatarGroup,
      new THREE.CylinderGeometry(0.12, 0.13, 0.22, 16),
      skin,
      [0, 1.67, 0]
    );

    createPart(
      avatarGroup,
      new THREE.SphereGeometry(0.37, 24, 20),
      skin,
      [0, 2.02, 0]
    );

    createPart(
      avatarGroup,
      new THREE.SphereGeometry(0.375, 24, 18),
      hair,
      [0, 2.22, -0.035],
      [1.02, 0.65, 0.98]
    );

    createPart(
      avatarGroup,
      new THREE.SphereGeometry(0.045, 12, 10),
      dark,
      [-0.125, 2.04, 0.327]
    );

    createPart(
      avatarGroup,
      new THREE.SphereGeometry(0.045, 12, 10),
      dark,
      [0.125, 2.04, 0.327]
    );

    const leftArm = new THREE.Group();
    leftArm.position.set(-0.42, 1.42, 0);
    avatarGroup.add(leftArm);

    createPart(
      leftArm,
      new THREE.CapsuleGeometry(0.105, 0.36, 4, 10),
      sleeve,
      [0, -0.24, 0]
    );

    createPart(
      leftArm,
      new THREE.SphereGeometry(0.11, 14, 12),
      skin,
      [0, -0.52, 0.03]
    );

    const rightArm = new THREE.Group();
    rightArm.position.set(0.42, 1.42, 0);
    avatarGroup.add(rightArm);

    createPart(
      rightArm,
      new THREE.CapsuleGeometry(0.105, 0.36, 4, 10),
      sleeve,
      [0, -0.24, 0]
    );

    createPart(
      rightArm,
      new THREE.SphereGeometry(0.11, 14, 12),
      skin,
      [0, -0.52, 0.03]
    );

    createPart(
      avatarGroup,
      new THREE.CapsuleGeometry(0.16, 0.5, 4, 10),
      pants,
      [-0.19, 0.35, 0]
    );

    createPart(
      avatarGroup,
      new THREE.CapsuleGeometry(0.16, 0.5, 4, 10),
      pants,
      [0.19, 0.35, 0]
    );

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.8, 0.012, 8, 80),
      new THREE.MeshBasicMaterial({ color: 0x22d3ee })
    );

    ring.rotation.x = -Math.PI / 2;
    ring.position.y = -0.04;
    ring.scale.set(1.15, 1, 1);
    avatarGroup.add(ring);

    fallback?.classList.add("hidden");

    function resizeAvatar() {
      const width = canvas.clientWidth || 500;
      const height = canvas.clientHeight || 350;

      threeRenderer.setSize(width, height, false);
      threeCamera.aspect = width / height;
      threeCamera.updateProjectionMatrix();
    }

    resizeAvatar();

    if ("ResizeObserver" in window && $("avatarStage")) {
      resizeObserver = new ResizeObserver(resizeAvatar);
      resizeObserver.observe($("avatarStage"));
    } else {
      window.addEventListener("resize", resizeAvatar);
    }

    function animateAvatar() {
      requestAnimationFrame(animateAvatar);

      if (!avatarGroup || !threeRenderer || !threeScene || !threeCamera) {
        return;
      }

      const time = performance.now() / 1000;

      avatarGroup.position.y = Math.sin(time * 1.2) * 0.025;
      avatarGroup.rotation.y = Math.sin(time * 0.4) * 0.1;

      threeRenderer.render(threeScene, threeCamera);
    }

    animateAvatar();
  } catch (error) {
    console.error("Avatar startup failed:", error);

    fallback?.classList.remove("hidden");

    if (fallback) {
      fallback.textContent =
        "The 3D avatar could not load. Check the Three.js script and refresh.";
    }
  }
}

createAvatar();

/* ---------------- INITIAL PAGE STATE ---------------- */

updateCharacterCount();
setDisabled("stopCameraButton", true);

if ($("recognisedText") && !$("recognisedText").textContent.trim()) {
  $("recognisedText").textContent = NO_RECOGNITION;
}

setResult(
  "Enter a message and select Translate to Sign.",
  "Local fingerspelling preview only. Verified ISL translation and signing animations are not connected."
);
