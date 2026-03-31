/* ==============================================
   Facial Emotion Recognition — Application Logic
   ============================================== */

(() => {
  'use strict';

  // ── Emotion Config ──────────────────────────
  const EMOTIONS = {
    happy:     { emoji: '😊', color: '#fbbf24' },
    sad:       { emoji: '😢', color: '#60a5fa' },
    angry:     { emoji: '😠', color: '#f87171' },
    surprised: { emoji: '😲', color: '#a78bfa' },
    fearful:   { emoji: '😨', color: '#34d399' },
    disgusted: { emoji: '🤢', color: '#fb923c' },
    neutral:   { emoji: '😐', color: '#94a3b8' },
  };

  const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model';

  // ── DOM References ──────────────────────────
  const $ = (sel) => document.querySelector(sel);
  const loadingScreen     = $('#loading-screen');
  const progressBar       = $('.loading-progress-bar');
  const appContainer      = $('.app-container');
  const video             = $('#webcam-video');
  const canvas            = $('#overlay-canvas');
  const ctx               = canvas.getContext('2d');
  const cameraPlaceholder = $('.camera-placeholder');
  const noFaceIndicator   = $('.no-face-indicator');
  const statusDot         = $('.status-dot');
  const statusText        = $('#status-text');
  const toggleBtn         = $('#toggle-btn');
  const dominantEmoji     = $('#dominant-emoji');
  const dominantName      = $('#dominant-name');
  const dominantConfidence = $('#dominant-confidence');
  const statFaces         = $('#stat-faces');
  const statFPS           = $('#stat-fps');
  const errorBanner       = $('#error-banner');

  // ── State ───────────────────────────────────
  let stream = null;
  let detecting = false;
  let animFrameId = null;
  let lastDominant = '';
  let frameCount = 0;
  let lastFpsTime = performance.now();
  let currentFps = 0;

  // ── Initialize ──────────────────────────────
  async function init() {
    try {
      await loadModels();
      hideLoading();
      showApp();
      // Auto-start the camera
      await startCamera();
    } catch (err) {
      console.error('Initialization failed:', err);
      showError('Failed to load AI models. Please check your connection and reload.');
    }
  }

  // ── Model Loading ───────────────────────────
  async function loadModels() {
    setProgress(10);

    await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
    setProgress(50);

    await faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL);
    setProgress(100);
  }

  function setProgress(pct) {
    progressBar.style.width = pct + '%';
  }

  // ── Loading / App Visibility ────────────────
  function hideLoading() {
    loadingScreen.classList.add('hidden');
  }

  function showApp() {
    setTimeout(() => appContainer.classList.add('visible'), 100);
  }

  // ── Camera ──────────────────────────────────
  async function startCamera() {
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      video.srcObject = stream;
      await video.play();

      // Match canvas to actual video dimensions
      video.addEventListener('loadedmetadata', () => {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      });

      cameraPlaceholder.classList.add('hidden');
      statusDot.classList.add('active');
      statusText.textContent = 'Detecting';
      toggleBtn.textContent = '⏹ Stop';
      toggleBtn.className = 'btn btn-danger';

      detecting = true;
      lastFpsTime = performance.now();
      frameCount = 0;
      detectLoop();
    } catch (err) {
      console.error('Camera error:', err);
      if (err.name === 'NotAllowedError') {
        showError('Camera access denied. Please allow camera permissions and reload.');
      } else if (err.name === 'NotFoundError') {
        showError('No camera found. Please connect a webcam and reload.');
      } else {
        showError('Could not access camera: ' + err.message);
      }
    }
  }

  function stopCamera() {
    detecting = false;
    if (animFrameId) {
      cancelAnimationFrame(animFrameId);
      animFrameId = null;
    }
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      stream = null;
    }
    video.srcObject = null;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    cameraPlaceholder.classList.remove('hidden');
    statusDot.classList.remove('active');
    statusText.textContent = 'Stopped';
    toggleBtn.textContent = '▶ Start';
    toggleBtn.className = 'btn btn-primary';
    noFaceIndicator.classList.remove('visible');

    // Reset sidebar
    resetSidebar();
  }

  // ── Detection Loop ──────────────────────────
  async function detectLoop() {
    if (!detecting) return;

    const detections = await faceapi
      .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.4 }))
      .withFaceExpressions();

    // FPS counter
    frameCount++;
    const now = performance.now();
    if (now - lastFpsTime >= 1000) {
      currentFps = frameCount;
      frameCount = 0;
      lastFpsTime = now;
      statFPS.textContent = currentFps;
    }

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (detections.length === 0) {
      noFaceIndicator.classList.add('visible');
      statFaces.textContent = '0';
    } else {
      noFaceIndicator.classList.remove('visible');
      statFaces.textContent = detections.length;

      // Use first face for sidebar
      const primary = detections[0];
      updateEmotionBars(primary.expressions);
      updateDominantEmotion(primary.expressions);

      // Draw all faces
      for (const det of detections) {
        drawDetection(det);
      }
    }

    animFrameId = requestAnimationFrame(detectLoop);
  }

  // ── Drawing ─────────────────────────────────
  function drawDetection(det) {
    const { x, y, width, height } = det.detection.box;

    // Mirror the x coordinate (since video is mirrored via CSS)
    const mx = canvas.width - x - width;

    // Get dominant emotion
    const expressions = det.expressions;
    const sorted = Object.entries(expressions).sort((a, b) => b[1] - a[1]);
    const [topEmotion, topScore] = sorted[0];
    const emotionConfig = EMOTIONS[topEmotion] || EMOTIONS.neutral;

    // Draw bounding box
    ctx.strokeStyle = emotionConfig.color;
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    roundRect(ctx, mx, y, width, height, 8);
    ctx.stroke();

    // Draw label background
    const label = `${emotionConfig.emoji} ${capitalize(topEmotion)} ${Math.round(topScore * 100)}%`;
    ctx.font = '600 14px Inter, sans-serif';
    const textMetrics = ctx.measureText(label);
    const labelW = textMetrics.width + 16;
    const labelH = 26;
    const labelX = mx;
    const labelY = y - labelH - 4;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.beginPath();
    roundRect(ctx, labelX, labelY, labelW, labelH, 6);
    ctx.fill();

    ctx.fillStyle = '#fff';
    ctx.fillText(label, labelX + 8, labelY + 18);
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }

  // ── Sidebar Updates ─────────────────────────
  function updateEmotionBars(expressions) {
    for (const [emotion, score] of Object.entries(expressions)) {
      const fill = document.querySelector(`.bar-${emotion} .emotion-bar-fill`);
      const value = document.querySelector(`.bar-${emotion} .emotion-bar-value`);
      if (fill && value) {
        fill.style.width = (score * 100).toFixed(0) + '%';
        value.textContent = (score * 100).toFixed(0) + '%';
      }
    }
  }

  function updateDominantEmotion(expressions) {
    const sorted = Object.entries(expressions).sort((a, b) => b[1] - a[1]);
    const [topEmotion, topScore] = sorted[0];
    const config = EMOTIONS[topEmotion] || EMOTIONS.neutral;

    dominantName.textContent = capitalize(topEmotion);
    dominantConfidence.textContent = (topScore * 100).toFixed(1) + '% confidence';

    if (topEmotion !== lastDominant) {
      dominantEmoji.textContent = config.emoji;
      dominantEmoji.classList.remove('pop');
      // Trigger reflow to restart animation
      void dominantEmoji.offsetWidth;
      dominantEmoji.classList.add('pop');
      lastDominant = topEmotion;
    }
  }

  function resetSidebar() {
    dominantEmoji.textContent = '🔍';
    dominantName.textContent = 'Waiting...';
    dominantConfidence.textContent = '—';
    statFaces.textContent = '0';
    statFPS.textContent = '0';
    lastDominant = '';

    for (const emotion of Object.keys(EMOTIONS)) {
      const fill = document.querySelector(`.bar-${emotion} .emotion-bar-fill`);
      const value = document.querySelector(`.bar-${emotion} .emotion-bar-value`);
      if (fill && value) {
        fill.style.width = '0%';
        value.textContent = '0%';
      }
    }
  }

  // ── Helpers ─────────────────────────────────
  function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  function showError(msg) {
    errorBanner.textContent = '⚠ ' + msg;
    errorBanner.classList.add('visible');
    setTimeout(() => errorBanner.classList.remove('visible'), 8000);
  }

  // ── Event Listeners ─────────────────────────
  toggleBtn.addEventListener('click', () => {
    if (detecting) {
      stopCamera();
    } else {
      startCamera();
    }
  });

  // ── Boot ────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
