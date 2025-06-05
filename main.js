// === Configurazione base Three.js e WebXR ===
let scene, camera, renderer, cube;
let xrSession = null;

// === Setup MediaPipe Hands ===
let hands, videoElement, cameraUtils;
let handLandmarks = [];

// === Parametri stereoscopici ===
const EYE_SEPARATION = 0.065; // distanza interpupillare media in metri

// === Inizializzazione ===
window.onload = () => {
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

  // Mostra pulsante per avviare AR
  showARButton();

  // Avvia MediaPipe Hands
  setupMediaPipeHands();
};

function showARButton() {
  if (!navigator.xr) {
    showError('WebXR non disponibile su questo browser/dispositivo.');
    return;
  }
  const btn = document.createElement('button');
  btn.innerText = 'Avvia AR';
  btn.id = 'ar-start-btn';
  btn.style.position = 'absolute';
  btn.style.top = '50%';
  btn.style.left = '50%';
  btn.style.transform = 'translate(-50%, -50%)';
  btn.style.padding = '1em 2em';
  btn.style.fontSize = '1.2em';
  btn.style.zIndex = 10;
  btn.style.background = '#ff2222';
  btn.style.color = '#fff';
  btn.style.border = 'none';
  btn.style.borderRadius = '8px';
  btn.style.cursor = 'pointer';
  document.body.appendChild(btn);
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    btn.innerText = 'Avvio...';
    try {
      await startAR();
      btn.remove();
    } catch (e) {
      showError('Impossibile avviare la sessione AR.\n' + e.message);
      btn.disabled = false;
      btn.innerText = 'Avvia AR';
    }
  });
}

function showError(msg) {
  let err = document.getElementById('ar-error-msg');
  if (!err) {
    err = document.createElement('div');
    err.id = 'ar-error-msg';
    err.style.position = 'absolute';
    err.style.top = '10%';
    err.style.left = '50%';
    err.style.transform = 'translateX(-50%)';
    err.style.background = 'rgba(0,0,0,0.8)';
    err.style.color = '#fff';
    err.style.padding = '1em 2em';
    err.style.borderRadius = '8px';
    err.style.zIndex = 20;
    err.style.fontSize = '1.1em';
    document.body.appendChild(err);
  }
  err.innerText = msg;
}

// === Avvio sessione AR ===
async function startAR() {
  try {
    xrSession = await navigator.xr.requestSession('immersive-ar', {
      requiredFeatures: ['local', 'hit-test']
    });
    renderer.xr.enabled = true;
    renderer.xr.setReferenceSpaceType('local');
    await renderer.xr.setSession(xrSession);
    renderer.setAnimationLoop(onXRFrame);
  } catch (e) {
    throw new Error('WebXR AR non supportato o permessi negati.');
  }
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