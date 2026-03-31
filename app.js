/* ============================================
   FER — Application Logic (Redesigned)
   ============================================ */

(() => {
  'use strict';

  // ── Emotion palette — warm, intentional hues ──
  const EMO = {
    happy:     { emoji: '😊', hue: 45,  sat: '80%', light: '55%', color: '#e2b340' },
    sad:       { emoji: '😢', hue: 207, sat: '40%', light: '50%', color: '#5b8fb9' },
    angry:     { emoji: '😠', hue: 3,   sat: '55%', light: '50%', color: '#c9524c' },
    surprised: { emoji: '😲', hue: 270, sat: '45%', light: '55%', color: '#9b72cf' },
    fearful:   { emoji: '😨', hue: 155, sat: '40%', light: '45%', color: '#45a882' },
    disgusted: { emoji: '🤢', hue: 28,  sat: '55%', light: '48%', color: '#c47d3a' },
    neutral:   { emoji: '😐', hue: 0,   sat: '0%',  light: '48%', color: '#777' },
  };
  const EMO_KEYS = Object.keys(EMO);

  const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model';

  // ── DOM ──
  const el = (s) => document.querySelector(s);
  const loadScreen   = el('#loading-screen');
  const progressBar  = el('#progress-bar');
  const shell        = el('#shell');
  const video        = el('#webcam');
  const canvas       = el('#canvas');
  const ctx          = canvas.getContext('2d');
  const placeholder  = el('#placeholder');
  const noFacePill   = el('#no-face');
  const statusPip    = el('#status-pip');
  const statusLabel  = el('#status-label');
  const btn          = el('#btn');
  const dEmoji       = el('#d-emoji');
  const dName        = el('#d-name');
  const dScore       = el('#d-score');
  const vFaces       = el('#v-faces');
  const vFps         = el('#v-fps');
  const toast        = el('#toast');
  const brandMark    = el('#brand-mark');
  const radarCanvas  = el('#radar-canvas');
  const rctx         = radarCanvas.getContext('2d');
  const root         = document.documentElement;

  // ── State ──
  let stream = null;
  let running = false;
  let raf = null;
  let prevDominant = '';
  let frames = 0;
  let fpsTime = performance.now();
  let smoothedValues = {};
  EMO_KEYS.forEach(k => smoothedValues[k] = 0);

  // ── Boot ──
  async function boot() {
    try {
      await loadModels();
      loadScreen.classList.add('hidden');
      setTimeout(() => shell.classList.add('visible'), 80);
      await startCam();
    } catch (e) {
      console.error(e);
      showToast('Failed to load AI models — check your connection.');
    }
  }

  async function loadModels() {
    progressBar.style.width = '15%';
    await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
    progressBar.style.width = '55%';
    await faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL);
    progressBar.style.width = '100%';
  }

  // ── Camera ──
  async function startCam() {
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      video.srcObject = stream;
      await video.play();
      video.addEventListener('loadedmetadata', () => {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }, { once: true });

      placeholder.classList.add('gone');
      statusPip.classList.add('live');
      statusLabel.textContent = 'detecting';
      btn.textContent = 'Stop';
      btn.classList.add('stop');
      running = true;
      fpsTime = performance.now();
      frames = 0;
      tick();
    } catch (e) {
      if (e.name === 'NotAllowedError') showToast('Camera access denied.');
      else if (e.name === 'NotFoundError') showToast('No camera found.');
      else showToast('Camera error: ' + e.message);
    }
  }

  function stopCam() {
    running = false;
    if (raf) { cancelAnimationFrame(raf); raf = null; }
    if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
    video.srcObject = null;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    placeholder.classList.remove('gone');
    statusPip.classList.remove('live');
    statusLabel.textContent = 'offline';
    btn.textContent = 'Start';
    btn.classList.remove('stop');
    noFacePill.classList.remove('show');
    resetPanel();
  }

  // ── Detection loop ──
  async function tick() {
    if (!running) return;
    const dets = await faceapi
      .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.4 }))
      .withFaceExpressions();

    // FPS
    frames++;
    const now = performance.now();
    if (now - fpsTime >= 1000) { vFps.textContent = frames; frames = 0; fpsTime = now; }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!dets.length) {
      noFacePill.classList.add('show');
      vFaces.textContent = '0';
    } else {
      noFacePill.classList.remove('show');
      vFaces.textContent = dets.length;

      const primary = dets[0].expressions;
      // Smooth values (lerp)
      for (const k of EMO_KEYS) {
        smoothedValues[k] += (primary[k] - smoothedValues[k]) * 0.3;
      }
      updateBars(smoothedValues);
      updateDominant(smoothedValues);
      drawRadar(smoothedValues);

      for (const d of dets) drawBox(d);
    }

    raf = requestAnimationFrame(tick);
  }

  // ── Drawing ──
  function drawBox(det) {
    const { x, y, width: w, height: h } = det.detection.box;
    const mx = canvas.width - x - w; // mirror

    const sorted = Object.entries(det.expressions).sort((a, b) => b[1] - a[1]);
    const [topE, topS] = sorted[0];
    const cfg = EMO[topE] || EMO.neutral;

    // Box — thin, minimal
    ctx.strokeStyle = cfg.color;
    ctx.lineWidth = 1.5;
    ctx.lineJoin = 'round';
    rr(ctx, mx, y, w, h, 6);
    ctx.stroke();

    // Corner accents
    const corner = Math.min(w, h) * 0.15;
    ctx.strokeStyle = cfg.color;
    ctx.lineWidth = 2.5;
    // top-left
    ctx.beginPath(); ctx.moveTo(mx, y + corner); ctx.lineTo(mx, y); ctx.lineTo(mx + corner, y); ctx.stroke();
    // top-right
    ctx.beginPath(); ctx.moveTo(mx + w - corner, y); ctx.lineTo(mx + w, y); ctx.lineTo(mx + w, y + corner); ctx.stroke();
    // bottom-left
    ctx.beginPath(); ctx.moveTo(mx, y + h - corner); ctx.lineTo(mx, y + h); ctx.lineTo(mx + corner, y + h); ctx.stroke();
    // bottom-right
    ctx.beginPath(); ctx.moveTo(mx + w - corner, y + h); ctx.lineTo(mx + w, y + h); ctx.lineTo(mx + w, y + h - corner); ctx.stroke();

    // Label — minimal, below box
    const label = `${topE} ${Math.round(topS * 100)}%`;
    ctx.font = '500 11px "Space Grotesk", system-ui';
    const tw = ctx.measureText(label).width;
    const lx = mx + (w - tw) / 2;
    const ly = y + h + 18;

    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    rr(ctx, lx - 6, ly - 12, tw + 12, 16, 3);
    ctx.fill();

    ctx.fillStyle = cfg.color;
    ctx.fillText(label, lx, ly);
  }

  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h); ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }

  // ── Panel updates ──
  function updateBars(vals) {
    for (const k of EMO_KEYS) {
      const row = document.querySelector(`.emo-${k}`);
      if (!row) continue;
      const pct = Math.round(vals[k] * 100);
      row.querySelector('.emo-fill').style.width = pct + '%';
      row.querySelector('.emo-pct').textContent = pct + '%';
    }
  }

  function updateDominant(vals) {
    const sorted = Object.entries(vals).sort((a, b) => b[1] - a[1]);
    const [topE, topS] = sorted[0];
    const cfg = EMO[topE] || EMO.neutral;

    dName.textContent = topE;
    dScore.textContent = Math.round(topS * 100) + '%';
    dName.style.color = cfg.color;

    // Ambient glow color shift
    root.style.setProperty('--emotion-hue', cfg.hue);
    root.style.setProperty('--emotion-sat', cfg.sat);
    root.style.setProperty('--emotion-light', cfg.light);

    // Brand mark
    brandMark.style.background = cfg.color;

    if (topE !== prevDominant) {
      dEmoji.textContent = cfg.emoji;
      dEmoji.classList.remove('bounce');
      void dEmoji.offsetWidth;
      dEmoji.classList.add('bounce');
      prevDominant = topE;
    }
  }

  // ── Radar chart (canvas) ──
  function drawRadar(vals) {
    const W = radarCanvas.width;
    const H = radarCanvas.height;
    const cx = W / 2;
    const cy = H / 2;
    const maxR = Math.min(cx, cy) * 0.78;
    const n = EMO_KEYS.length;
    const step = (Math.PI * 2) / n;

    rctx.clearRect(0, 0, W, H);

    // Grid rings
    for (let ring = 1; ring <= 4; ring++) {
      const r = maxR * (ring / 4);
      rctx.beginPath();
      rctx.arc(cx, cy, r, 0, Math.PI * 2);
      rctx.strokeStyle = ring === 4 ? '#333' : '#222';
      rctx.lineWidth = 1;
      rctx.stroke();
    }

    // Axis lines
    for (let i = 0; i < n; i++) {
      const a = step * i - Math.PI / 2;
      rctx.beginPath();
      rctx.moveTo(cx, cy);
      rctx.lineTo(cx + Math.cos(a) * maxR, cy + Math.sin(a) * maxR);
      rctx.strokeStyle = '#222';
      rctx.lineWidth = 1;
      rctx.stroke();
    }

    // Data shape — fill
    rctx.beginPath();
    for (let i = 0; i < n; i++) {
      const a = step * i - Math.PI / 2;
      const v = Math.max(vals[EMO_KEYS[i]] || 0, 0.02);
      const r = v * maxR;
      const px = cx + Math.cos(a) * r;
      const py = cy + Math.sin(a) * r;
      if (i === 0) rctx.moveTo(px, py);
      else rctx.lineTo(px, py);
    }
    rctx.closePath();

    // Gradient fill
    const topE = Object.entries(vals).sort((a, b) => b[1] - a[1])[0][0];
    const cfg = EMO[topE] || EMO.neutral;
    rctx.fillStyle = hexToRGBA(cfg.color, 0.12);
    rctx.fill();
    rctx.strokeStyle = hexToRGBA(cfg.color, 0.6);
    rctx.lineWidth = 1.5;
    rctx.stroke();

    // Data dots
    for (let i = 0; i < n; i++) {
      const a = step * i - Math.PI / 2;
      const v = Math.max(vals[EMO_KEYS[i]] || 0, 0.02);
      const r = v * maxR;
      const px = cx + Math.cos(a) * r;
      const py = cy + Math.sin(a) * r;

      rctx.beginPath();
      rctx.arc(px, py, 3, 0, Math.PI * 2);
      rctx.fillStyle = EMO[EMO_KEYS[i]].color;
      rctx.fill();
    }

    // Labels
    for (let i = 0; i < n; i++) {
      const a = step * i - Math.PI / 2;
      const lr = maxR + 24;
      const lx = cx + Math.cos(a) * lr;
      const ly = cy + Math.sin(a) * lr;

      rctx.font = '500 26px "Space Grotesk", system-ui';
      rctx.fillStyle = '#666';
      rctx.textAlign = 'center';
      rctx.textBaseline = 'middle';
      rctx.fillText(EMO[EMO_KEYS[i]].emoji, lx, ly);
    }
  }

  function hexToRGBA(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  function resetPanel() {
    dEmoji.textContent = '–';
    dName.textContent = 'Waiting';
    dName.style.color = '';
    dScore.textContent = '—';
    vFaces.textContent = '0';
    vFps.textContent = '0';
    prevDominant = '';
    EMO_KEYS.forEach(k => smoothedValues[k] = 0);
    for (const k of EMO_KEYS) {
      const row = document.querySelector(`.emo-${k}`);
      if (!row) continue;
      row.querySelector('.emo-fill').style.width = '0%';
      row.querySelector('.emo-pct').textContent = '0%';
    }
    // Clear radar
    rctx.clearRect(0, 0, radarCanvas.width, radarCanvas.height);
    // Reset ambient
    root.style.setProperty('--emotion-hue', '0');
    root.style.setProperty('--emotion-sat', '0%');
    root.style.setProperty('--emotion-light', '50%');
    brandMark.style.background = '';
  }

  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 6000);
  }

  // ── Events ──
  btn.addEventListener('click', () => running ? stopCam() : startCam());

  // ── Init ──
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
