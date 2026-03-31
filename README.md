# Facial Emotion Recognition

Real-time facial emotion recognition powered by AI — right in your browser. Detects 7 emotions: **happy, sad, angry, surprised, fearful, disgusted, and neutral**.

Built with [@vladmandic/face-api](https://github.com/vladmandic/face-api) (TensorFlow.js). All processing happens locally — no data is sent to any server.

### 🚀 [Live Demo → facial-emotion-recognition1.netlify.app](https://facial-emotion-recognition1.netlify.app)

> **📌 Previously built with Python** (OpenCV + FER library). Migrated to a pure web-based solution for better reliability, zero setup, and cross-platform support. The original Python version had dependency issues with the `fer` library and required a full Python/pip environment. This updated version runs entirely in the browser with no installation needed.

## Features

- 🎥 Real-time webcam face detection
- 🧠 AI-powered emotion classification (7 emotions)
- 📊 Live animated emotion bar charts
- 🎯 Dominant emotion display with confidence score
- 📱 Responsive — works on desktop and mobile
- 🔒 Privacy-first — everything runs in your browser
- ⚡ Zero installation — just open in a browser

## Quick Start

### Option 1: Open directly
Simply open `index.html` in your browser.

> **Note**: Some browsers require HTTPS or localhost to access the webcam. If the camera doesn't work, use Option 2.

### Option 2: Local server (recommended)
```bash
# Python
python3 -m http.server 8000

# Node.js
npx serve .
```
Then open [http://localhost:8000](http://localhost:8000)

## How It Works

1. AI models are loaded from CDN on first visit (~2MB)
2. Your webcam feed is processed frame-by-frame using TensorFlow.js
3. Face detection uses the TinyFaceDetector model for real-time performance
4. Emotion classification outputs probability scores for all 7 emotions
5. Everything runs on your GPU via WebGL — no server needed

## Tech Stack

| Version | Stack | Status |
|---------|-------|--------|
| **v2 (Current)** | HTML/CSS/JS + face-api.js (TensorFlow.js) | ✅ Active |
| v1 (Legacy) | Python + OpenCV + FER library | ❌ Deprecated |

### Current Stack
- **face-api.js** (vladmandic fork) — Face detection & emotion recognition
- **TensorFlow.js** — ML inference in the browser
- **Vanilla HTML/CSS/JS** — No framework dependencies

### Why the Migration?
The original Python version had several issues:
- `fer` library import errors and dependency conflicts
- Required Python, pip, virtual environments, and native OpenCV bindings
- Only worked on desktop with a Python environment set up
- Raw OpenCV window with no polished UI

The web version solves all of these — just open a browser and it works.

## License

MIT
