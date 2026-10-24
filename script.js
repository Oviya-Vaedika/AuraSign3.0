
"use strict";

// ============================================================
// AURA SIGN
// Local camera tracking — no API keys or backend API calls.
// MediaPipe Hands must be loaded by index.html.
// ============================================================

const $ = (id) => document.getElementById(id);

let toastTimer = null;
let cameraStream = null;
let handsModel = null;
let cameraRunning = false;
let processingFrame = false;
let animationFrameId = null;
let lastPose = "";
let lastPoseTime = 0;
let modelInitializing = false;

// ------------------------------------------------------------
// GENERAL HELPERS
// ------------------------------------------------------------

function showToast(message) {
  const toast = $("toast");
  if (!toast) {
    console.log(message);
    return;
  }

  toast.textContent = message;
  toast.classList.add("show");

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 3000);
}

function setResult(text, note = "") {
  const result = $("resultText");
  const resultNote = $("resultNote");

  if (result) result.textContent = text;
  if (resultNote) resultNote.textContent = note;
}

function detectionStatus(title, message) {
  const titleElement = $("detectionTitle");
  const messageElement = $("detectionMessage");

  if (titleElement) titleElement.textContent = title;
  if (messageElement) messageElement.textContent = message;
}

function setModeStatus(message) {
  const element = $("modeStatus");
  if (element) element.textContent = message;
}

// ------------------------------------------------------------
// MODE SWITCHING
// ------------------------------------------------------------

function setMode(mode) {
  const textMode = mode === "text";

  $("textTab")?.classList.toggle("active", textMode);
  $("cameraTab")?.classList.toggle("active", !textMode);

  $("textTab")?.setAttribute("aria-selected", String(textMode));
  $("cameraTab")?.setAttribute("aria-selected", String(!textMode));

  $("textSection")?.classList.toggle("hidden", !textMode);
  $("cameraSection")?.classList.toggle("hidden", textMode);
  $("avatarPanel")?.classList.toggle("hidden", !textMode);

  const heading = $("inputHeading");
  if (heading) {
    heading.textContent = textMode ? "Text to sign" : "Sign to text";
  }

  setModeStatus(textMode ? "TEXT MODE" : "CAMERA MODE");

  if (textMode) {
    stopCamera();
    if ($("avatarMode")) $("avatarMode").textContent = "IDLE MODE";
  } else {
    startCamera();
  }
}

$("textTab")?.addEventListener("click", () => setMode("text"));
$("cameraTab")?.addEventListener("click", () => setMode("camera"));

// ------------------------------------------------------------
// TEXT INPUT
// ------------------------------------------------------------

function updateCharacterCount() {
  const input = $("textInput");
  const count = $("charCount");

  if (input && count) {
    count.textContent = `${input.value.length} / 500`;
  }
}

$("textInput")?.addEventListener("input", updateCharacterCount);

document.querySelectorAll("[data-example]").forEach((button) => {
  button.addEventListener("click", () => {
    const input = $("textInput");
    if (!input) return;

    input.value = button.dataset.example || "";
    updateCharacterCount();
  });
});

// ------------------------------------------------------------
// LOCAL TEXT HANDLING
//
// This does not generate sign-language translations or
// verified sign animations. It provides a local text preview.
// ------------------------------------------------------------

$("translateButton")?.addEventListener("click", () => {
  const input = $("textInput");
  if (!input) return;

  const text = input.value.trim();

  if (!text) {
    showToast("Enter a message first.");
    input.focus();
    return;
  }

  const language = $("languageSelect")?.value || "ISL";
  const characters = [...text.toUpperCase()]
    .filter((character) => /[A-Z0-9]/.test(character));

  setResult(
    text,
    `Local preview only. Selected mode: ${language}. ` +
    `${characters.length} letters/numbers can be examined individually. ` +
    "This is not a sign-language translation; verified sign animations " +
    "are not connected."
  );

  setModeStatus("LOCAL PREVIEW");
});

// ------------------------------------------------------------
// COPY RESULT
// ------------------------------------------------------------

$("copyButton")?.addEventListener("click", async () => {
  const text = $("resultText")?.textContent || "";

  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
    } else {
      const temporary = document.createElement("textarea");
      temporary.value = text;
      temporary.style.position = "fixed";
      temporary.style.opacity = "0";

      document.body.appendChild(temporary);
      temporary.select();

      const copied = document.execCommand("copy");
      temporary.remove();

      if (!copied) throw new Error("Copy unavailable");
    }

    showToast("Result copied.");
  } catch {
    showToast("Copy failed. Select the result and copy it manually.");
  }
});

// ------------------------------------------------------------
// CLEAR RESULT
// ------------------------------------------------------------

$("clearButton")?.addEventListener("click", () => {
  setResult(
    "Enter a message and select Translate to Sign.",
    "Local preview mode. Verified sign animations are not connected."
  );

  setModeStatus("READY");
});

// ------------------------------------------------------------
// SPEECH OUTPUT
// ------------------------------------------------------------

$("speakButton")?.addEventListener("click", () => {
  const text = $("resultText")?.textContent?.trim() || "";

  if (!text || !("speechSynthesis" in window)) {
    showToast("Speech is not available in this browser.");
    return;
  }

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  window.speechSynthesis.speak(utterance);
});

// ------------------------------------------------------------
// CAMERA OVERLAY
// ------------------------------------------------------------

function clearOverlay() {
  const canvas = $("cameraOverlay");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function drawLandmarks(points) {
  const video = $("cameraVideo");
  const canvas = $("cameraOverlay");

  if (!video || !canvas || !points || points.length < 21) return;
  if (!video.videoWidth || !video.videoHeight) return;

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

  // Mirror the overlay to match a mirrored camera preview.
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

// ------------------------------------------------------------
// FINGER-POSE ESTIMATION
//
// MediaPipe landmark indices:
// Thumb: 1-4
// Index: 5-8
// Middle: 9-12
// Ring: 13-16
// Little: 17-20
//
// These are approximate visual rules, NOT an ISL classifier.
// ------------------------------------------------------------

function distance3D(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = (a.z || 0) - (b.z || 0);

  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function estimateFingerStates(points) {
  if (!points || points.length < 21) return null;

  // Finger extension is estimated using fingertip distance
  // from the wrist, compared with the middle joint.
  // This is more tolerant of camera tilt than checking y alone.
  const wrist = points[0];

  const fingers = [
    { name: "Thumb", tip: 4, middle: 2, base: 5 },
    { name: "Index", tip: 8, middle: 6, base: 5 },
    { name: "Middle", tip: 12, middle: 10, base: 9 },
    { name: "Ring", tip: 16, middle: 14, base: 13 },
    { name: "Little", tip: 20, middle: 18, base: 17 }
  ];

  const states = {};

  for (const finger of fingers) {
    const tipDistance = distance3D(points[finger.tip], wrist);
    const jointDistance = distance3D(points[finger.middle], wrist);

    if (finger.name === "Thumb") {
      // Thumb orientation varies with hand rotation.
      const thumbTip = points[4];
      const thumbJoint = points[3];
      const indexBase = points[5];

      const thumbToIndex = distance3D(thumbTip, indexBase);
      const thumbJointToIndex = distance3D(thumbJoint, indexBase);

      states.Thumb =
        thumbToIndex > thumbJointToIndex * 1.12;
    } else {
      states[finger.name] = tipDistance > jointDistance * 1.12;
    }
  }

  return states;
}

function describeFingerPose(states) {
  if (!states) return "Hand landmarks unavailable";

  const names = ["Thumb", "Index", "Middle", "Ring", "Little"];
  const extended = names.filter((name) => states[name]);
  const count = extended.length;

  const pattern = names
    .map((name) => states[name] ? "1" : "0")
    .join("");

  let description;

  if (count === 5) {
    description = "Open hand — approximately 5 fingers extended";
  } else if (count === 0) {
    description = "Closed-hand-like pose — few fingers extended";
  } else {
    description =
      `${count} finger(s) appear extended: ` +
      (extended.length ? extended.join(", ") : "none");
  }

  return { description, pattern, count, extended };
}

// ------------------------------------------------------------
// PROCESS MEDIAPIPE RESULTS
// ------------------------------------------------------------

function handleHandResults(results) {
  if (!cameraRunning) return;

  const video = $("cameraVideo");
  const allHands = results.multiHandLandmarks || [];

  if (!allHands.length) {
    clearOverlay();
    lastPose = "";

    detectionStatus(
      "No hand detected",
      "Place one hand inside the camera frame with good lighting."
    );

    return;
  }

  // Draw every detected hand.
  for (const landmarks of allHands) {
    drawLandmarks(landmarks);
  }

  // Report the first hand only, avoiding duplicate output
  // when two hands are visible.
  const points = allHands[0];
  const states = estimateFingerStates(points);
  const pose = describeFingerPose(states);

  if (!pose || typeof pose === "string") {
    detectionStatus("Detecting hand", "Please hold your hand steady.");
    return;
  }

  const now = performance.now();

  if (pose.pattern !== lastPose || now - lastPoseTime > 1200) {
    lastPose = pose.pattern;
    lastPoseTime = now;

    detectionStatus(
      "Hand detected",
      `${pose.description}. Pattern: ${pose.pattern}. ` +
      "Experimental finger estimate — not an ISL letter prediction."
    );

    setResult(
      pose.description,
      `Finger pattern (Thumb, Index, Middle, Ring, Little): ` +
      `${pose.pattern}. This experimental estimate is not a verified ` +
      "ISL sign or alphabet translation."
    );
  }

  if (video && video.readyState < 2) {
    detectionStatus("Hand detected", "Preparing camera frame...");
  }
}

// ------------------------------------------------------------
// INITIALIZE MEDIAPIPE HANDS
// ------------------------------------------------------------

async function initializeHands() {
  if (handsModel) return handsModel;

  if (modelInitializing) {
    throw new Error("Hand tracking is already initializing.");
  }

  modelInitializing = true;

  try {
    if (typeof window.Hands !== "function") {
      throw new Error(
        "MediaPipe Hands was not found. Check the MediaPipe script " +
        "in index.html and reload the page."
      );
    }

    handsModel = new window.Hands({
      locateFile: (file) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
    });

    handsModel.setOptions({
      maxNumHands: 2,
      modelComplexity: 1,
      minDetectionConfidence: 0.65,
      minTrackingConfidence: 0.65
    });

    handsModel.onResults(handleHandResults);

    return handsModel;
  } catch (error) {
    handsModel = null;
    throw error;
  } finally {
    modelInitializing = false;
  }
}

// ------------------------------------------------------------
// CAMERA START / STOP
// ------------------------------------------------------------

async function startCamera() {
  if (cameraRunning) return;

  const video = $("cameraVideo");

  if (!video) {
    showToast("Camera video element is missing from index.html.");
    return;
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    detectionStatus(
      "Camera unavailable",
      "Use HTTPS or localhost and a browser that supports camera access."
    );
    showToast("Camera access is not supported here.");
    return;
  }

  try {
    detectionStatus("Starting camera", "Requesting camera permission...");
    setModeStatus("STARTING CAMERA");

    const model = await initializeHands();

    cameraStream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: "user",
        width: { ideal: 1280 },
        height: { ideal: 720 }
      }
    });

    video.srcObject = cameraStream;
    video.playsInline = true;
    video.muted = true;

    await video.play();

    cameraRunning = true;
    processingFrame = false;
    setModeStatus("CAMERA ACTIVE");

    detectionStatus(
      "Camera active",
      "Show your hand clearly inside the frame."
    );

    async function processFrame() {
      if (!cameraRunning) return;

      if (
        !processingFrame &&
        video.readyState >= 2 &&
        video.videoWidth > 0
      ) {
        processingFrame = true;

        try {
          await model.send({ image: video });
        } catch (error) {
          console.error("Hand tracking frame error:", error);
        } finally {
          processingFrame = false;
        }
      }

      if (cameraRunning) {
        animationFrameId = requestAnimationFrame(processFrame);
      }
    }

    animationFrameId = requestAnimationFrame(processFrame);
  } catch (error) {
    console.error("Aura Sign camera error:", error);

    stopCamera();

    detectionStatus(
      "Camera could not start",
      error.message || "Check camera permission and try again."
    );

    setModeStatus("CAMERA ERROR");
    showToast(error.message || "Could not start the camera.");
  }
}

function stopCamera() {
  cameraRunning = false;
  processingFrame = false;

  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }

  if (cameraStream) {
    for (const track of cameraStream.getTracks()) {
      track.stop();
    }
    cameraStream = null;
  }

  const video = $("cameraVideo");

  if (video) {
    video.pause();
    video.srcObject = null;
  }

  clearOverlay();

  lastPose = "";
  lastPoseTime = 0;
}

// ------------------------------------------------------------
// OPTIONAL CAMERA BUTTONS
//
// These handlers are attached only when matching elements exist.
// ------------------------------------------------------------

[
  "startCameraButton",
  "startCamera",
  "enableCameraButton"
].forEach((id) => {
  $(id)?.addEventListener("click", startCamera);
});

[
  "stopCameraButton",
  "stopCamera",
  "disableCameraButton"
].forEach((id) => {
  $(id)?.addEventListener("click", stopCamera);
});

// ------------------------------------------------------------
// CLEANUP
// ------------------------------------------------------------

window.addEventListener("pagehide", stopCamera);

// Initial page state
updateCharacterCount();

setResult(
  "Enter a message and select Translate to Sign.",
  "Local preview mode. Verified sign animations are not connected."
);

detectionStatus(
  "Camera ready",
  "Switch to camera mode to start hand tracking."
);

setModeStatus("READY");
