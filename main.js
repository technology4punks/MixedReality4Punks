// === Configurazione base Three.js e WebXR ===
let scene, camera, renderer, cube;
let xrSession = null;
let isARSupported = false;

// === Setup MediaPipe Hands ===
let hands, videoElement, cameraUtils;
let handLandmarks = [];

// === Parametri stereoscopici ===
const EYE_SEPARATION = 0.065; // distanza interpupillare media in metri

// === Inizializzazione ===
window.onload = async () => {
  // Setup video per MediaPipe Hands
  videoElement = document.createElement('video');
  videoElement.style.display = 'none';
  document.body.appendChild(videoElement);

  // Setup Three.js
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 20);
  renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('ar-canvas'), alpha: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);

  // Cubo rosso
  const geometry = new THREE.BoxGeometry(0.15, 0.15, 0.15);
  const material = new THREE.MeshStandardMaterial({ color: 0xff2222 });
  cube = new THREE.Mesh(geometry, material);
  cube.position.set(0, 0, -0.7);
  scene.add(cube);

  // Luce
  const light = new THREE.HemisphereLight(0xffffff, 0x444444, 1.2);
  scene.add(light);

  // WebXR AR
  if (navigator.xr) {
    isARSupported = await navigator.xr.isSessionSupported('immersive-ar');
    if (isARSupported) {
      startAR();
    } else {
      alert('WebXR AR non supportato su questo dispositivo/browser.');
    }
  } else {
    alert('WebXR non disponibile.');
  }

  // Avvia MediaPipe Hands
  setupMediaPipeHands();
};

// === Avvio sessione AR ===
async function startAR() {
  xrSession = await navigator.xr.requestSession('immersive-ar', {
    requiredFeatures: ['local', 'hit-test']
  });
  renderer.xr.enabled = true;
  renderer.xr.setReferenceSpaceType('local');
  await renderer.xr.setSession(xrSession);
  renderer.setAnimationLoop(onXRFrame);
}

// === Rendering stereoscopico split screen ===
function onXRFrame(time, frame) {
  // Ottieni pose XR
  const session = renderer.xr.getSession();
  if (!session) return;

  // Aggiorna logica cubo in base alle mani
  updateCubeWithHands();

  // Split screen: sinistra/destra
  const width = window.innerWidth / 2;
  const height = window.innerHeight;

  // Occhio sinistro
  renderer.setScissorTest(true);
  renderer.setScissor(0, 0, width, height);
  renderer.setViewport(0, 0, width, height);
  camera.position.x = -EYE_SEPARATION / 2;
  renderer.render(scene, camera);

  // Occhio destro
  renderer.setScissor(width, 0, width, height);
  renderer.setViewport(width, 0, width, height);
  camera.position.x = EYE_SEPARATION / 2;
  renderer.render(scene, camera);

  // Reset camera
  camera.position.x = 0;
  renderer.setScissorTest(false);
}

// === MediaPipe Hands setup ===
function setupMediaPipeHands() {
  hands = new Hands({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
  });
  hands.setOptions({
    maxNumHands: 2,
    modelComplexity: 1,
    minDetectionConfidence: 0.7,
    minTrackingConfidence: 0.7
  });
  hands.onResults(onHandsResults);

  cameraUtils = new CameraUtils.Camera(videoElement, {
    onFrame: async () => {
      await hands.send({ image: videoElement });
    },
    width: 640,
    height: 480
  });
  cameraUtils.start();
}

function onHandsResults(results) {
  handLandmarks = results.multiHandLandmarks || [];
}

// === Logica manipolazione cubo ===
let lastDistance = null;
let lastRotation = null;

function updateCubeWithHands() {
  if (handLandmarks.length === 1) {
    // Rotazione con una mano (es. indice e pollice)
    const hand = handLandmarks[0];
    const index = hand[8]; // indice
    const thumb = hand[4]; // pollice
    const dx = index.x - thumb.x;
    const dy = index.y - thumb.y;
    const angle = Math.atan2(dy, dx);
    if (lastRotation !== null) {
      const delta = angle - lastRotation;
      cube.rotation.y += delta * 2.0;
    }
    lastRotation = angle;
    lastDistance = null;
  } else if (handLandmarks.length === 2) {
    // Scala con due mani (distanza tra palmi)
    const hand1 = handLandmarks[0][0]; // palmo mano 1
    const hand2 = handLandmarks[1][0]; // palmo mano 2
    const dx = hand1.x - hand2.x;
    const dy = hand1.y - hand2.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (lastDistance !== null) {
      const scale = cube.scale.x * (distance / lastDistance);
      cube.scale.setScalar(THREE.MathUtils.clamp(scale, 0.5, 2.5));
    }
    lastDistance = distance;
    lastRotation = null;
  } else {
    lastDistance = null;
    lastRotation = null;
  }
}

// === Resize handler ===
window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}); 