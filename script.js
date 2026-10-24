
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="theme-color" content="#080b16">
  <title>Aura Sign — Sign Language Studio</title>
  <meta name="description" content="An experimental sign language interface focused on accessibility and Indian Sign Language learning.">

  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="style.css">

  <style>
    body {
      font-family: "DM Sans", sans-serif;
    }

    h1, h2, h3, h4, .brand-name {
      font-family: "Space Grotesk", sans-serif;
    }

    .app-container {
      width: min(1240px, 92%);
    }

    .topbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 20px;
      padding: 20px 0;
      border-bottom: 1px solid rgba(148,163,184,.14);
      margin-bottom: 45px;
    }

    .brand-mark {
      width: 44px;
      height: 44px;
      display: grid;
      place-items: center;
      border-radius: 14px;
      color: white;
      font-size: 22px;
      background: linear-gradient(135deg,#8b5cf6,#22d3ee);
    }

    .brand-lockup {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .brand-name {
      font-weight: 700;
      font-size: 1.25rem;
      letter-spacing: -.5px;
    }

    .brand-subtitle {
      color: #94a3b8;
      font-size: .75rem;
    }

    .topbar-label {
      color: #a5b4fc;
      font-size: .78rem;
      border: 1px solid rgba(167,139,250,.25);
      background: rgba(139,92,246,.08);
      padding: 8px 12px;
      border-radius: 999px;
    }

    .hero-layout {
      display: grid;
      grid-template-columns: 1.1fr .9fr;
      align-items: center;
      gap: 35px;
      margin: 48px 0 38px;
    }

    .eyebrow {
      display: inline-flex;
      align-items: center;
      gap: 9px;
      color: #67e8f9;
      font-size: .78rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 2px;
      margin-bottom: 18px;
    }

    .eyebrow::before {
      content: "";
      width: 23px;
      height: 2px;
      background: #22d3ee;
    }

    .hero-title {
      font-size: clamp(2.7rem, 6vw, 5rem);
      line-height: 1.02;
      letter-spacing: -3px;
      margin: 0 0 22px;
    }

    .hero-copy {
      color: #9caec5;
      max-width: 550px;
      line-height: 1.85;
    }

    .hero-art {
      min-height: 270px;
      display: grid;
      place-items: center;
      position: relative;
      overflow: hidden;
      border: 1px solid rgba(139,92,246,.22);
      border-radius: 28px;
      background:
        radial-gradient(ellipse at 50% 50%,rgba(124,58,237,.22),transparent 55%),
        linear-gradient(145deg,#11162a,#090d18);
    }

    .hero-orbit {
      width: 190px;
      height: 190px;
      border: 1px solid rgba(34,211,238,.35);
      border-radius: 50%;
      display: grid;
      place-items: center;
      box-shadow: 0 0 60px rgba(139,92,246,.12);
      animation: orbit-pulse 4s ease-in-out infinite;
    }

    .hero-symbol {
      width: 125px;
      height: 125px;
      display: grid;
      place-items: center;
      border-radius: 35px;
      font-size: 58px;
      background: linear-gradient(145deg,rgba(139,92,246,.3),rgba(34,211,238,.1));
      border: 1px solid rgba(167,139,250,.4);
      box-shadow: 0 0 40px rgba(139,92,246,.16);
    }

    @keyframes orbit-pulse {
      50% { transform: scale(1.04); }
    }

    .hero-art-label {
      position: absolute;
      bottom: 18px;
      color: #a5b4fc;
      font-size: .75rem;
      letter-spacing: 1px;
    }

    .workspace-heading {
      display: flex;
      align-items: end;
      justify-content: space-between;
      gap: 20px;
      margin: 40px 0 20px;
    }

    .workspace-heading h2 {
      font-size: 1.65rem;
      margin: 0;
    }

    .workspace-heading p {
      color: #94a3b8;
      margin: 5px 0 0;
      font-size: .88rem;
    }

    .workspace-grid {
      display: grid;
      grid-template-columns: minmax(0,1.1fr) minmax(290px,.9fr);
      gap: 20px;
      align-items: start;
    }

    .workspace-card {
      min-width: 0;
      padding: 24px;
      border: 1px solid rgba(148,163,184,.16);
      border-radius: 22px;
      background: linear-gradient(145deg,rgba(18,25,43,.97),rgba(10,14,26,.97));
      box-shadow: 0 20px 55px rgba(0,0,0,.16);
    }

    .workspace-card-head {
      display: flex;
      justify-content: space-between;
      gap: 14px;
      align-items: flex-start;
      margin-bottom: 22px;
    }

    .workspace-card-head h3 {
      margin: 0;
      font-size: 1.1rem;
    }

    .workspace-card-head p {
      margin: 5px 0 0;
      color: #94a3b8;
      font-size: .82rem;
    }

    .mini-tag {
      font-size: .7rem;
      padding: 6px 9px;
      border: 1px solid rgba(34,211,238,.23);
      border-radius: 8px;
      color: #67e8f9;
      white-space: nowrap;
    }

    .mode-tabs {
      margin: 0 0 22px;
      width: 100%;
    }

    .mode-tabs button {
      flex: 1;
    }

    #textInput {
      min-height: 150px;
      font-family: "DM Sans", sans-serif;
      line-height: 1.7;
    }

    #translateButton {
      flex: 1;
    }

    .camera-stage {
      margin-bottom: 15px;
    }

    .camera-help {
      margin: 0;
      color: #94a3b8;
      font-size: .78rem;
      line-height: 1.7;
    }

    .avatar-card {
      margin-top: 20px;
    }

    #avatarStage {
      min-height: 270px;
    }

    .info-strip {
      display: grid;
      grid-template-columns: repeat(3,1fr);
      gap: 12px;
      margin-top: 28px;
    }

    .info-item {
      padding: 17px;
      border: 1px solid rgba(148,163,184,.13);
      border-radius: 15px;
      background: rgba(17,24,39,.55);
    }

    .info-item strong {
      display: block;
      margin-bottom: 4px;
      font-size: .88rem;
    }

    .info-item span {
      color: #94a3b8;
      font-size: .76rem;
      line-height: 1.6;
    }

    footer {
      border-top: 1px solid rgba(148,163,184,.12);
      padding-top: 22px;
    }

    @media(max-width:850px) {
      .hero-layout,
      .workspace-grid {
        grid-template-columns: 1fr;
      }

      .hero-art {
        min-height: 240px;
      }

      .hero-title {
        letter-spacing: -2px;
      }
    }

    @media(max-width:520px) {
      .app-container {
        width: calc(100% - 24px);
      }

      .topbar {
        margin-bottom: 25px;
      }

      .topbar-label {
        font-size: .68rem;
      }

      .hero-layout {
        margin-top: 28px;
      }

      .workspace-card {
        padding: 17px;
      }

      .info-strip {
        grid-template-columns: 1fr;
      }
    }
  </style>
</head>

<body>
  <div class="app-container">

    <header class="topbar">
      <div class="brand-lockup">
        <div class="brand-mark">✳</div>
        <div>
          <div class="brand-name">AURA SIGN</div>
          <div class="brand-subtitle">SIGN LANGUAGE STUDIO</div>
        </div>
      </div>
      <div class="topbar-label">✦ ISL-FOCUSED EXPERIMENT</div>
    </header>

    <main>
      <section class="hero-layout">
        <div>
          <div class="eyebrow">Communication without barriers</div>
          <h1 class="hero-title">
            Let your<br>
            <span class="gradient-text">hands speak.</span>
          </h1>
          <p class="hero-copy">
            Explore sign-language accessibility through an experimental
            digital workspace for text, camera input, and visual feedback.
            Built with Indian Sign Language as the priority.
          </p>
        </div>

        <div class="hero-art" aria-label="Decorative sign language symbol">
          <div class="hero-orbit">
            <div class="hero-symbol">✋</div>
          </div>
          <div class="hero-art-label">ACCESSIBILITY • CONNECTION • EXPRESSION</div>
        </div>
      </section>

      <section>
        <div class="workspace-heading">
          <div>
            <h2>Your workspace</h2>
            <p>Choose an input method to get started.</p>
          </div>
        </div>

        <div class="workspace-grid">
          <section class="workspace-card" aria-label="Translation workspace">
            <div class="workspace-card-head">
              <div>
                <h3>Translation studio</h3>
                <p>Enter text or explore camera input.</p>
              </div>
              <span class="mini-tag">STUDIO 01</span>
            </div>

            <div class="mode-tabs">
              <button id="textTab" class="active" type="button">⌨ Text mode</button>
              <button id="cameraTab" type="button">◎ Camera mode</button>
            </div>

            <section id="textSection">
              <div class="section-heading">
                <div>
                  <h3 id="inputHeading">Text workspace</h3>
                  <p>Enter a message to process.</p>
                </div>
              </div>

              <label for="textInput">Your message</label>
              <textarea id="textInput" maxlength="500"
                placeholder="Type something here..."></textarea>
              <div class="character-count"><span id="charCount">0</span>/500</div>

              <div class="examples">
                <button class="example-chip" data-example="Hello" type="button">Hello</button>
                <button class="example-chip" data-example="Thank you" type="button">Thank you</button>
                <button class="example-chip" data-example="How are you?" type="button">How are you?</button>
              </div>

              <div class="button-row">
                <button id="translateButton" class="primary-button" type="button">✦ Process text</button>
                <button id="clearButton" class="secondary-button" type="button">Clear</button>
              </div>

              <div class="result-panel">
                <div class="result-header">
                  <h3>Output</h3>
                  <span class="mini-tag">RESULT</span>
                </div>
                <p id="resultText">Your output will appear here.</p>
                <p id="resultNote" class="result-note">
                  Experimental interface. Text processing is not proof of accurate ISL translation.
                </p>
                <div class="button-row">
                  <button id="copyButton" class="secondary-button" type="button">Copy</button>
                  <button id="speakButton" class="secondary-button" type="button">Speak text</button>
                </div>
              </div>
            </section>

            <section id="cameraSection" class="hidden">
              <div class="section-heading">
                <div>
                  <h3>Camera workspace</h3>
                  <p>Position one hand inside the camera view.</p>
                </div>
              </div>

              <div class="camera-stage">
                <video id="cameraVideo" autoplay muted playsinline></video>
                <canvas id="cameraOverlay"></canvas>
              </div>

              <div class="detection-status">
                <span class="status-dot"></span>
                <span id="detectionTitle">Camera not started</span>
              </div>
              <p id="detectionMessage" class="camera-help">
                Start the camera to view hand landmarks. Landmark tracking alone
                does not identify ISL signs.
              </p>
              <p id="cameraLabel" class="camera-help">Waiting for camera.</p>

              <div class="camera-controls" style="margin-top:15px">
                <button id="startCameraButton" class="primary-button" type="button">Start camera</button>
                <button id="stopCameraButton" class="secondary-button" type="button">Stop camera</button>
              </div>

              <div class="recogn
