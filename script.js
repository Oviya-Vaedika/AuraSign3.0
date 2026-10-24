
"use strict";

/* =========================================================
   AURA SIGN 3.0
   Browser-only JavaScript — no API key, no backend calls.
   MediaPipe detects hand landmarks; it does not automatically
   translate arbitrary ISL signs into correct words.
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {
  const $ = (id) => document.getElementById(id);

  const el = {
    toast: $("toast"),

    textTab: $("textTab"),
    cameraTab: $("cameraTab"),
    textSection: $("textSection"),
    cameraSection: $("cameraSection"),

    inputHeading: $("inputHeading"),
    modeStatus: $("modeStatus"),
    textInput: $("textInput"),
    charCount: $("charCount"),
    translateButton: $("translateButton"),
    resultText: $("resultText"),
    resultNote: $("resultNote"),
    copyButton: $("copyButton"),
    clearButton: $("clearButton"),
    speakButton: $("speakButton"),

    cameraVideo: $("cameraVideo"),
    cameraOverlay: $("cameraOverlay"),
    detectionTitle: $("detectionTitle"),
    detectionMessage: $("detectionMessage"),
    cameraLabel: $("cameraLabel"),
    startCameraButton: $("startCameraButton"),
    stopCameraButton: $("stopCameraButton"),
    recognisedText: $("recognisedText"),
    clearRecognisedButton: $("clearRecognisedButton"),
    speakRecognisedButton: $("speakRecognisedButton"),

    avatarPanel: $("avatarPanel"),
    avatarMode: $("avatarMode"),
    avatarStage: $("avatarStage"),
    avatarCanvas: $("avatarCanvas"),
    avatarFallback: $("avatarFallback")
  };

  let cameraStream = null;
  let handsDetector = null;
  let cameraRunning = false;
  let processingFrame = false;
  let animationFrameId = null;
  let lastToastTimeout = null;

  // Used to avoid flooding the screen with repeated messages.
  let lastDetectionMessage = "";
  let lastDetectionTime = 0;

  function showToast(message) {
    if (!el.toast) {
      console.log(message);
      return;
    }

    el.toast.textContent = message;
    el.toast.classList.add("show");

    clearTimeout(lastToastTimeout);
    lastToastTimeout = setTimeout(() => {
      el.toast.classList.remove("show");
    }, 2600);
  }

  function setStatus(message) {
    if (el.modeStatus) el.modeStatus.textContent = message;
  }

  function setCameraStatus(title, message) {
    if (el.detectionTitle) el.detectionTitle.textContent = title;
    if (el.detectionMessage) el.detectionMessage.textContent = message;
  }

  function resizeOverlay() {
    if (!el.cameraVideo || !el.cameraOverlay) return;

    const rect = el.cameraVideo.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));

    if (
      el.cameraOverlay.width !== width ||
      el.cameraOverlay.height !== height
    ) {
      el.cameraOverlay.width = width;
      el.cameraOverlay.height = height;
    }
  }

  function clearOverlay() {
    if (!el.cameraOverlay) return;

    const context = el.cameraOverlay.getContext("2d");
    if (context) {
      context.clearRect(
        0,
        0,
        el.cameraOverlay.width,
        el.cameraOverlay.height
      );
    }
  }

  function announceDetection(title, message) {
    const now = Date.now();
    const combined = `${title}|${message}`;

    if (
      combined === lastDetectionMessage &&
      now - lastDetectionTime < 1800
    ) {
      return;
    }

    lastDetectionMessage = combined;
    lastDetectionTime = now;
    setCameraStatus(title, message);
  }

  /* -------------------- TAB SWITCHING -------------------- */

  function switchTab(tab) {
    const showText = tab === "text";

    if (el.textSection) {
      el.textSection.hidden = !showText;
    }

    if (el.cameraSection) {
      el.cameraSection.hidden = showText;
    }

    if (el.textTab) {
      el.textTab.classList.toggle("active", showText);
      el.textTab.setAttribute("aria-selected", String(showText));
    }

    if (el.cameraTab) {
      el.cameraTab.classList.toggle("active", !showText);
      el.cameraTab.setAttribute("aria-selected", String(!showText));
    }

    if (el.inputHeading) {
      el.inputHeading.textContent = showText
        ? "Enter text to explore"
        : "Camera sign detection";
    }

    if (el.avatarPanel) {
      el.avatarPanel.hidden = !showText;
    }

    setStatus(
      showText
        ? "Text workspace"
        : "Camera workspace"
    );

    if (!showText) {
      stopAvatarMotionIfAvailable();
    } else {
      startAvatarMotionIfAvailable();
    }
  }

  el.textTab?.addEventListener("click", () => switchTab("text"));
  el.cameraTab?.addEventListener("click", () => switchTab("camera"));

  /* -------------------- TEXT WORKSPACE -------------------- */

  function updateCharacterCount() {
    if (!el.textInput || !el.charCount) return;

    const length = el.textInput.value.length;
    el.charCount.textContent = `${length} character${length === 1 ? "" : "s"}`;
  }

  el.textInput?.addEventListener("input", updateCharacterCount);

  document.querySelectorAll("[data-example]").forEach((button) => {
    button.addEventListener("click", () => {
      const example = button.getAttribute("data-example") || "";

      if (el.textInput) {
        el.textInput.value = example;
        updateCharacterCount();
        el.textInput.focus();
      }
    });
  });

  /*
   * This is a local text helper, not an ISL translation engine.
   * It intentionally avoids claiming that English text has been
   * converted into authentic Indian Sign Language.
   */
  function createTextResult(text) {
    const cleaned = text.trim();

    if (!cleaned) {
      return {
        result: "",
        note: "Enter some text first."
      };
    }

    return {
      result: cleaned,
      note:
        "Text prepared locally. Authentic ISL translation and sign animation require a verified ISL vocabulary and motion dataset."
    };
  }

  el.translateButton?.addEventListener("click", () => {
    const input = el.textInput?.value || "";
    const output = createTextResult(input);

    if (el.resultText) {
      el.resultText.textContent =
        output.result || "Your result will appear here.";
    }

    if (el.resultNote) {
      el.resultNote.textContent = output.note;
    }

    if (output.result) {
      showToast("Text prepared");
    } else {
      showToast("Please enter text first");
    }
  });

  el.clearButton?.addEventListener("click", () => {
    if (el.textInput) el.textInput.value = "";
    if (el.resultText) {
      el.resultText.textContent = "Your result will appear here.";
    }
    if (el.resultNote) {
      el.resultNote.textContent =
        "Your text is processed locally in this browser.";
    }

    updateCharacterCount();
    showToast("Text cleared");
  });

  el.copyButton?.addEventListener("click", async () => {
    const text = el.resultText?.textContent?.trim() || "";

    if (!text || text === "Your result will appear here.") {
      showToast("There is no result to copy");
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      showToast("Copied to clipboard");
    } catch {
      // Clipboard access may be blocked on non-secure origins.
      const temporary = document.createElement("textarea");
      temporary.value = text;
      temporary.style.position = "fixed";
      temporary.style.opacity = "0";
      document.body.appendChild(temporary);
      temporary.select();

      const copied = document.execCommand("copy");
      temporary.remove();

      showToast(copied ? "Copied to clipboard" : "Copy was blocked");
    }
  });

  function speakText(text) {
    if (!("speechSynthesis" in window)) {
      showToast("Speech is not supported in this browser");
      return;
    }

    const cleaned = (text || "").trim();

    if (!cleaned) {
      showToast("There is no text to speak");
      return;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(cleaned);
    utterance.lang = "en-IN";
    utterance.rate = 0.92;
    window.speechSynthesis.speak(utterance);
  }

  el.speakButton?.addEventListener("click", () => {
    speakText(el.resultText?.textContent || "");
  });

  /* -------------------- CAMERA LANDMARK DRAWING -------------------- */

  function drawConnections(context, landmarks, connections, width, height) {
    if (!Array.isArray(connections)) return;

    context.beginPath();

    connections.forEach((connection) => {
      const startIndex = connection.start;
      const endIndex = connection.end;

      const start = landmarks[startIndex];
      const end = landmarks[endIndex];

      if (!start || !end) return;

      context.moveTo(start.x * width, start.y * height);
      context.lineTo(end.x * width, end.y * height);
    });

    context.stroke();
  }

  function drawHandLandmarks(landmarks) {
    if (!el.cameraOverlay || !landmarks) return;

    resizeOverlay();

    const context = el.cameraOverlay.getContext("2d");
    if (!context) return;

    const width = el.cameraOverlay.width;
    const height = el.cameraOverlay.height;

    context.clearRect(0, 0, width, height);

    const connections = window.HAND_CONNECTIONS;

    context.lineWidth = 3;
    context.strokeStyle = "#8b5cf6";
    context.lineCap = "round";
    context.lineJoin = "round";

    drawConnections(context, landmarks, connections, width, height);

    landmarks.forEach((point) => {
      context.beginPath();
      context.arc(
        point.x * width,
        point.y * height,
        4,
        0,
        Math.PI * 2
      );
      context.fillStyle = "#22d3ee";
      context.fill();
    });
  }

  function clearHandLandmarks() {
    clearOverlay();
    announceDetection("No hand detected", "Place one hand clearly inside the camera frame.");
  }

  function onHandsResults(results) {
    if (!cameraRunning) return;

    const hands = results?.multiHandLandmarks || [];

    if (hands.length > 0) {
      drawHandLandmarks(hands[0]);

      const handCount = hands.length;
      announceDetection(
        `${handCount} hand${handCount === 1 ? "" : "s"} detected`,
        "Hand landmarks are visible. Sign-to-text classification is not enabled yet."
      );

      if (el.cameraLabel) {
        el.cameraLabel.textContent = "Hand landmarks detected";
      }
    } else {
      clearHandLandmarks();

      if (el.cameraLabel) {
        el.cameraLabel.textContent = "Waiting for a hand";
      }
    }
  }

  async function processCameraFrame() {
    if (!cameraRunning || !el.cameraVideo) return;

    if (
      handsDetector &&
      el.cameraVideo.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
      !processingFrame
    ) {
      processingFrame = true;

      try {
        await handsDetector.send({ image: el.cameraVideo });
      } catch (error) {
        console.error("Hand detection error:", error);
      } finally {
        processingFrame = false;
      }
    }

    if (cameraRunning) {
      animationFrameId = requestAnimationFrame(processCameraFrame);
    }
  }

  /* -------------------- START / STOP CAMERA -------------------- */

  async function startCamera() {
    if (cameraRunning) return;

    if (!navigator.mediaDevices?.getUserMedia) {
      showToast("Camera needs HTTPS or localhost");
      setCameraStatus(
        "Camera unavailable",
        "Open the website using HTTPS or run it on localhost."
      );
      return;
    }

    if (typeof window.Hands !== "function") {
      showToast("Hand detection library did not load");
      setCameraStatus(
        "Detector unavailable",
        "Check your internet connection and reload the page."
      );
      return;
    }

    try {
      setCameraStatus("Starting camera", "Please allow camera access.");

      cameraStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: "user",
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });

      if (!el.cameraVideo) {
        throw new Error("Camera video element was not found in index.html.");
      }

      el.cameraVideo.srcObject = cameraStream;
      el.cameraVideo.playsInline = true;
      el.cameraVideo.muted = true;

      await el.cameraVideo.play();

      handsDetector = new window.Hands({
        locateFile: (file) =>
          `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
      });

      handsDetector.setOptions({
        maxNumHands: 2,
        modelComplexity: 1,
        minDetectionConfidence: 0.65,
        minTrackingConfidence: 0.6
      });

      handsDetector.onResults(onHandsResults);

      cameraRunning = true;
      processingFrame = false;

      if (el.startCameraButton) el.startCameraButton.disabled = true;
      if (el.stopCameraButton) el.stopCameraButton.disabled = false;

      if (el.cameraLabel) el.cameraLabel.textContent = "Camera is active";

      setCameraStatus(
        "Camera active",
        "Show your hand clearly. Keep it inside the frame with good lighting."
      );

      showToast("Camera started");
      animationFrameId = requestAnimationFrame(processCameraFrame);
    } catch (error) {
      console.error("Could not start camera:", error);

      stopCamera();

      let message = "Could not start the camera.";

      if (error?.name === "NotAllowedError") {
        message = "Camera permission was denied. Allow camera access in your browser settings.";
      } else if (error?.name === "NotFoundError") {
        message = "No camera was found on this device.";
      } else if (error?.name === "NotReadableError") {
        message = "The camera may already be in use by another application.";
      } else if (error?.message) {
        message = error.message;
      }

      setCameraStatus("Camera error", message);
      showToast("Camera could not start");
    }
  }

  async function stopCamera() {
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

    if (el.cameraVideo) {
      el.cameraVideo.pause();
      el.cameraVideo.srcObject = null;
    }

    if (handsDetector) {
      try {
        await handsDetector.close();
      } catch (error) {
        console.warn("Detector cleanup:", error);
      }

      handsDetector = null;
    }

    clearOverlay();

    if (el.startCameraButton) el.startCameraButton.disabled = false;
    if (el.stopCameraButton) el.stopCameraButton.disabled = true;

    if (el.cameraLabel) el.cameraLabel.textContent = "Camera is off";

    setCameraStatus(
      "Camera stopped",
      "Start the camera whenever you're ready."
    );
  }

  el.startCameraButton?.addEventListener("click", startCamera);
  el.stopCameraButton?.addEventListener("click", () => {
    stopCamera();
    showToast("Camera stopped");
  });

  el.clearRecognisedButton?.addEventListener("click", () => {
    if (el.recognisedText) {
      el.recognisedText.textContent = "No sign translation available yet.";
    }

    showToast("Recognition area cleared");
  });

  el.speakRecognisedButton?.addEventListener("click", () => {
    speakText(el.recognisedText?.textContent || "");
  });

  /* -------------------- AVATAR PLACEHOLDER -------------------- */

  /*
   * This small helper does not invent signing motions.
   * It only manages the avatar panel if the existing HTML/JS
   * provides an avatar animation implementation.
   */

  function startAvatarMotionIfAvailable() {
    if (el.avatarMode) {
      el.avatarMode.textContent = "Ready";
    }
  }

  function stopAvatarMotionIfAvailable() {
    if (el.avatarMode) {
      el.avatarMode.textContent = "Paused";
    }
  }

  /* -------------------- INITIAL STATE -------------------- */

  updateCharacterCount();

  if (el.stopCameraButton) {
    el.stopCameraButton.disabled = true;
  }

  if (el.resultNote) {
    el.resultNote.textContent =
      "Text stays in your browser. This demo does not yet provide verified ISL translation.";
  }

  if (el.recognisedText) {
    el.recognisedText.textContent =
      "Hand landmarks will appear here; words are not classified yet.";
  }

  switchTab("text");

  // Release the camera if the user navigates away from the page.
  window.addEventListener("pagehide", () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
    }
  });
});
