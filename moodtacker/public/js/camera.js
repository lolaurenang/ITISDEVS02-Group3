// public/js/camera.js
// ─── CAMERA EMOTION RECOGNITION TOOL ─────────────────────────────────────────
// Uses face-api.js to detect the child's emotion via webcam.
// When a dominant emotion is detected, it auto-selects it on the mood form.
//
// REQUIRES: face-api.js models downloaded into /public/models/
// Download from: https://github.com/justadudewhohacks/face-api.js/tree/master/weights
// Files needed in /public/models/:
//   - tiny_face_detector_model-weights_manifest.json + shard
//   - face_expression_model-weights_manifest.json + shard

const EMOTION_MAP = {
  happy:    'Happiness',
  sad:      'Sadness',
  angry:    'Anger',
  fearful:  'Fear',
  surprised:'Surprise',
  disgusted:'Disgust',
  neutral:  null  // neutral won't auto-select
};

let stream       = null;
let detectionLoop= null;
let isRunning    = false;

// ── Load face-api models ──────────────────────────────────────────────────────
async function loadModels() {
  const MODEL_URL = '/models';
  await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
  await faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL);
  console.log('✅ Face-api models loaded');
}

// ── Start webcam ──────────────────────────────────────────────────────────────
async function startCamera() {
  const video   = document.getElementById('cameraFeed');
  const overlay = document.getElementById('cameraOverlay');
  const btn     = document.getElementById('cameraToggleBtn');
  const status  = document.getElementById('cameraStatus');

  if (isRunning) {
    stopCamera();
    return;
  }

  try {
    status.textContent = '📷 Starting camera...';
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
    video.srcObject = stream;
    await video.play();

    btn.textContent   = '⏹ Stop Camera';
    btn.style.background = '#ef4444';
    status.textContent   = '🔍 Detecting emotion...';
    isRunning = true;

    overlay.style.display = 'block';
    await loadModels();
    startDetectionLoop(video, status);
  } catch (err) {
    status.textContent = '❌ Camera access denied. Please allow camera in browser settings.';
    console.error('Camera error:', err);
  }
}

// ── Continuous detection loop ─────────────────────────────────────────────────
function startDetectionLoop(video, status) {
  detectionLoop = setInterval(async () => {
    const result = await faceapi
      .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
      .withFaceExpressions();

    if (!result) {
      status.textContent = '👀 No face detected — move closer';
      return;
    }

    // Find the dominant expression
    const expressions = result.expressions;
    const dominant    = Object.entries(expressions)
      .sort((a, b) => b[1] - a[1])[0];

    const [expressionKey, confidence] = dominant;
    const pct = Math.round(confidence * 100);

    const mappedEmotion = EMOTION_MAP[expressionKey];
    status.textContent  = mappedEmotion
      ? `😊 Detected: ${mappedEmotion} (${pct}% confident)`
      : `😐 Detected: Neutral (${pct}%) — please select manually`;

    // Auto-select the emotion button if confidence is high enough
    if (mappedEmotion && confidence > 0.6) {
      autoSelectEmotion(mappedEmotion);
    }
  }, 1000); // detect every second
}

// ── Auto-select the matching emotion button ───────────────────────────────────
function autoSelectEmotion(emotionName) {
  const btn = document.querySelector(`.emo-btn[data-emotion="${emotionName}"]`);
  if (btn) {
    // Highlight the detected button
    document.querySelectorAll('.emo-btn').forEach(b => b.classList.remove('camera-detected'));
    btn.classList.add('camera-detected');
  }
}

// ── Stop webcam ───────────────────────────────────────────────────────────────
function stopCamera() {
  if (stream) {
    stream.getTracks().forEach(t => t.stop());
    stream = null;
  }
  if (detectionLoop) {
    clearInterval(detectionLoop);
    detectionLoop = null;
  }
  isRunning = false;

  const video  = document.getElementById('cameraFeed');
  const overlay= document.getElementById('cameraOverlay');
  const btn    = document.getElementById('cameraToggleBtn');
  const status = document.getElementById('cameraStatus');

  if (video)   video.srcObject = null;
  if (overlay) overlay.style.display = 'none';

  btn.textContent      = '📷 Detect Emotion via Camera';
  btn.style.background = '';
  status.textContent   = 'Camera stopped.';
}

// ── Confirm the camera-detected emotion ──────────────────────────────────────
function confirmCameraEmotion() {
  const detected = document.querySelector('.emo-btn.camera-detected');
  if (detected) {
    stopCamera();
    pickEmotion(detected); // calls the existing pickEmotion from new.ejs
  } else {
    alert('No emotion detected yet — please wait a moment or select manually.');
  }
}
