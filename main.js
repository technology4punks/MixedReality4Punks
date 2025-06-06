import * as THREE from 'https://cdn.skypack.dev/three@0.158.0';
import { ARButton } from 'https://cdn.skypack.dev/three@0.158.0/examples/jsm/webxr/ARButton.js';
import * as handPoseDetection from 'https://cdn.skypack.dev/@tensorflow-models/hand-pose-detection';
import '@tensorflow/tfjs-backend-webgl';

// Setup scena, camera, renderer
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 20);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.xr.enabled = true;
document.body.appendChild(renderer.domElement);

// Bottone AR WebXR
document.body.appendChild(ARButton.createButton(renderer, {
  requiredFeatures: ['hit-test'],
  optionalFeatures: ['dom-overlay'],
  domOverlay: { root: document.body }
}));

// Cubo rosso
const geometry = new THREE.BoxGeometry(0.2, 0.2, 0.2);
const material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
const cube = new THREE.Mesh(geometry, material);
cube.position.set(0, 0, -0.5);
scene.add(cube);

// Luce
const light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1);
scene.add(light);

// Video per la fotocamera
const video = document.getElementById('video');

let detector;
let handDetected = false;
let gestureValue = 0;

// Setup MediaPipe Hands
async function initHandTracking() {
  const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
  video.srcObject = stream;

  detector = await handPoseDetection.createDetector(handPoseDetection.SupportedModels.MediaPipeHands, {
    runtime: 'tfjs',
    modelType: 'lite',
    maxHands: 1
  });

  detectHands();
}

// Loop di rilevamento mani
async function detectHands() {
  if (!detector) return;
  const predictions = await detector.estimateHands(video);
  if (predictions.length > 0) {
    handDetected = true;
    const hand = predictions[0];
    const indexFingerTip = hand.keypoints.find(p => p.name === 'index_finger_tip');
    if (indexFingerTip) {
      gestureValue = indexFingerTip.x;
    }
  } else {
    handDetected = false;
  }
  requestAnimationFrame(detectHands);
}

// Interazione gestuale
function handleHandInteraction() {
  if (handDetected) {
    cube.rotation.y = gestureValue * 0.01;
  }
}

// Loop di animazione
function animate() {
  renderer.setAnimationLoop(() => {
    handleHandInteraction();
    renderer.render(scene, camera);
  });
}

animate();
initHandTracking();

// Responsività
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
