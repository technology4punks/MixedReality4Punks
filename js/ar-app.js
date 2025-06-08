class ARMobileApp {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.cube = null;
        this.hands = null;
        this.video = null;
        this.canvas = null;
        this.canvasCtx = null;
        this.isCardboardMode = false;
        this.handLandmarks = [];
        this.lastFrameTime = 0;
        this.frameCount = 0;
        
        // Parametri per l'interazione
        this.pinchThreshold = 0.05;
        this.lastPinchDistance = 0;
        this.cubeScale = 1;
        this.cubeRotation = { x: 0, y: 0, z: 0 };
        
        // Performance monitoring
        this.performanceMonitor = null;
        this.deviceInfo = null;
        this.wakeLock = null;
        
        // UI elements
        this.statusIndicator = null;
        this.instructionsOverlay = null;
        
        this.init();
    }
    
    initUI() {
        this.statusIndicator = document.getElementById('status-indicator');
        this.instructionsOverlay = document.getElementById('instructions');
    }
    
    checkWebGLSupport() {
        try {
            const canvas = document.createElement('canvas');
            const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
            return !!gl;
        } catch (e) {
            return false;
        }
    }

    showErrorMessage(message) {
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(255, 0, 0, 0.9);
            color: white;
            padding: 20px;
            border-radius: 10px;
            text-align: center;
            z-index: 10000;
            max-width: 80%;
            font-size: 16px;
        `;
        errorDiv.innerHTML = `
            <h3>⚠️ Errore</h3>
            <p>${message}</p>
            <p><small>Prova con un browser diverso o aggiorna il tuo dispositivo</small></p>
        `;
        document.body.appendChild(errorDiv);
        
        // Remove after 10 seconds
        setTimeout(() => {
            if (errorDiv.parentNode) {
                errorDiv.parentNode.removeChild(errorDiv);
            }
        }, 10000);
    }

    checkCompatibility() {
        // Check for required APIs
        const requiredAPIs = {
            'WebGL': this.checkWebGLSupport(),
            'getUserMedia': !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
            'Service Worker': 'serviceWorker' in navigator
        };
        
        const missingAPIs = Object.entries(requiredAPIs)
            .filter(([name, supported]) => !supported)
            .map(([name]) => name);
        
        if (missingAPIs.length > 0) {
            console.warn('APIs mancanti:', missingAPIs);
            this.updateStatus(`APIs non supportate: ${missingAPIs.join(', ')}`, 'warning');
        }
        
        if (!this.deviceInfo.supportsWebGL) {
            throw new Error('WebGL non supportato su questo dispositivo');
        }
        
        if (!this.deviceInfo.supportsWebRTC) {
            throw new Error('WebRTC non supportato su questo dispositivo');
        }
        
        console.log('Dispositivo rilevato:', this.deviceInfo);
    }
    
    updateStatus(message, type = 'loading') {
        document.getElementById('status').textContent = message;
        
        if (this.statusIndicator) {
            this.statusIndicator.className = `status-indicator ${type}`;
        }
    }
    
    async init() {
        try {
            // Inizializza utilità mobile
            this.deviceInfo = MobileUtils.optimizeForDevice();
            this.performanceMonitor = MobileUtils.measurePerformance();
            this.performanceMonitor.start();
            
            // Inizializza UI
            this.initUI();
            
            // Check WebGL support first
            if (!this.checkWebGLSupport()) {
                throw new Error('WebGL non supportato su questo dispositivo');
            }
            
            // Verifica compatibilità
            this.checkCompatibility();
            
            // Prevenire standby
            try {
                this.wakeLock = await MobileUtils.preventSleep();
            } catch (e) {
                console.warn('Wake lock non supportato:', e);
            }
            
            await this.setupCamera();
            this.setupThreeJS();
            await this.setupMediaPipe();
            this.setupEventListeners();
            this.animate();
            
            this.updateStatus('AR Attivo', 'active');
            document.getElementById('loading').style.display = 'none';
            
            // Nascondi istruzioni dopo 5 secondi
            setTimeout(() => {
                this.instructionsOverlay.classList.add('hidden');
            }, 5000);
            
        } catch (error) {
            console.error('Errore inizializzazione:', error);
            this.updateStatus('Errore: ' + error.message, 'error');
            this.showErrorMessage(error.message);
        }
    }
    
    async setupCamera() {
        this.video = document.getElementById('video');
        this.canvas = document.getElementById('canvas');
        this.canvasCtx = this.canvas.getContext('2d');
        
        const constraints = MobileUtils.getOptimalCameraConstraints();
        
        try {
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            this.video.srcObject = stream;
            
            return new Promise((resolve) => {
                this.video.onloadedmetadata = () => {
                    this.canvas.width = this.video.videoWidth;
                    this.canvas.height = this.video.videoHeight;
                    resolve();
                };
            });
        } catch (error) {
            throw new Error('Impossibile accedere alla camera: ' + error.message);
        }
    }
    
    setupThreeJS() {
        // Scena
        this.scene = new THREE.Scene();
        
        // Camera
        const aspect = window.innerWidth / window.innerHeight;
        this.camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);
        this.camera.position.z = 5;
        
        // Renderer with error handling
        try {
            this.renderer = new THREE.WebGLRenderer({ 
                canvas: this.canvas,
                alpha: true,
                antialias: this.mobileUtils.isLowEndDevice() ? false : true,
                powerPreference: this.mobileUtils.isLowEndDevice() ? 'low-power' : 'high-performance'
            });
        } catch (error) {
            console.warn('WebGL not supported, trying fallback options:', error);
            // Try without antialias
            try {
                this.renderer = new THREE.WebGLRenderer({ 
                    canvas: this.canvas,
                    alpha: true,
                    antialias: false
                });
            } catch (fallbackError) {
                throw new Error('WebGL not supported on this device: ' + fallbackError.message);
            }
        }
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setClearColor(0x000000, 0); // Trasparente per AR
        
        // Luci
        const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
        this.scene.add(ambientLight);
        
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(1, 1, 1);
        this.scene.add(directionalLight);
        
        // Cubo rosso interattivo
        const geometry = new THREE.BoxGeometry(1, 1, 1);
        const material = new THREE.MeshLambertMaterial({ 
            color: 0xff0000,
            transparent: true,
            opacity: 0.8
        });
        this.cube = new THREE.Mesh(geometry, material);
        this.cube.position.set(0, 0, 0);
        this.scene.add(this.cube);
        
        // Aggiungi bordi al cubo per migliore visibilità
        const edges = new THREE.EdgesGeometry(geometry);
        const lineMaterial = new THREE.LineBasicMaterial({ color: 0xffffff });
        const wireframe = new THREE.LineSegments(edges, lineMaterial);
        this.cube.add(wireframe);
    }
    
    async setupMediaPipe() {
        this.hands = new Hands({
            locateFile: (file) => {
                return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
            }
        });
        
        this.hands.setOptions({
            maxNumHands: 2,
            modelComplexity: 1,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5
        });
        
        this.hands.onResults((results) => {
            this.onHandsResults(results);
        });
        
        const camera = new Camera(this.video, {
            onFrame: async () => {
                await this.hands.send({ image: this.video });
            },
            width: 1280,
            height: 720
        });
        
        camera.start();
    }
    
    onHandsResults(results) {
        this.handLandmarks = results.multiHandLandmarks || [];
        document.getElementById('hands-count').textContent = this.handLandmarks.length;
        
        // Feedback visivo per rilevamento mani
        if (this.handLandmarks.length > 0) {
            this.processHandGestures(this.handLandmarks[0]);
            this.canvas.classList.add('hand-detected');
            
            // Vibrazione leggera per feedback
            MobileUtils.vibrate([50]);
            
            // Nascondi istruzioni quando le mani sono rilevate
            this.instructionsOverlay.classList.add('hidden');
        } else {
            this.canvas.classList.remove('hand-detected');
        }
        
        // Disegna landmarks delle mani (opzionale, per debug)
        this.drawHandLandmarks(results);
    }
    
    processHandGestures(landmarks) {
        // Calcola distanza tra pollice e indice per rilevare pinch
        const thumb = landmarks[4];
        const index = landmarks[8];
        
        const distance = Math.sqrt(
            Math.pow(thumb.x - index.x, 2) + 
            Math.pow(thumb.y - index.y, 2)
        );
        
        // Rilevamento pinch per scalare il cubo
        if (distance < this.pinchThreshold) {
            if (this.lastPinchDistance > 0) {
                const scaleFactor = distance / this.lastPinchDistance;
                this.cubeScale *= scaleFactor;
                this.cubeScale = Math.max(0.5, Math.min(3, this.cubeScale));
                this.cube.scale.setScalar(this.cubeScale);
            }
        }
        this.lastPinchDistance = distance;
        
        // Rotazione basata sulla posizione della mano
        const handCenter = this.getHandCenter(landmarks);
        this.cubeRotation.y = (handCenter.x - 0.5) * Math.PI * 2;
        this.cubeRotation.x = (handCenter.y - 0.5) * Math.PI * 2;
        
        this.cube.rotation.x = this.cubeRotation.x;
        this.cube.rotation.y = this.cubeRotation.y;
    }
    
    getHandCenter(landmarks) {
        let centerX = 0, centerY = 0;
        landmarks.forEach(landmark => {
            centerX += landmark.x;
            centerY += landmark.y;
        });
        return {
            x: centerX / landmarks.length,
            y: centerY / landmarks.length
        };
    }
    
    drawHandLandmarks(results) {
        this.canvasCtx.save();
        this.canvasCtx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        if (results.multiHandLandmarks) {
            for (const landmarks of results.multiHandLandmarks) {
                drawConnectors(this.canvasCtx, landmarks, HAND_CONNECTIONS, {
                    color: '#00FF00',
                    lineWidth: 2
                });
                drawLandmarks(this.canvasCtx, landmarks, {
                    color: '#FF0000',
                    lineWidth: 1,
                    radius: 3
                });
            }
        }
        
        this.canvasCtx.restore();
    }
    
    setupEventListeners() {
        window.addEventListener('resize', () => {
            this.onWindowResize();
        });
        
        // Prevenire zoom su mobile
        document.addEventListener('touchstart', (e) => {
            if (e.touches.length > 1) {
                e.preventDefault();
            }
        }, { passive: false });
        
        document.addEventListener('touchmove', (e) => {
            e.preventDefault();
        }, { passive: false });
    }
    
    onWindowResize() {
        if (!this.isCardboardMode) {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        }
    }
    
    toggleCardboardMode() {
        this.isCardboardMode = !this.isCardboardMode;
        
        if (this.isCardboardMode) {
            this.enableCardboardMode();
        } else {
            this.disableCardboardMode();
        }
    }
    
    enableCardboardMode() {
        // Modalità stereoscopica per Cardboard
        document.getElementById('cardboard-btn').textContent = '📱 Normale';
        document.getElementById('mode').textContent = 'Cardboard';
        
        // Nascondi controlli per immersione completa
        document.getElementById('controls').style.display = 'none';
        this.instructionsOverlay.style.display = 'none';
        
        // Aggiungi classe CSS per modalità Cardboard
        document.body.classList.add('cardboard-mode');
        
        // Configura rendering stereoscopico
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        
        // Forza orientamento landscape e fullscreen
        try {
            MobileUtils.lockOrientation('landscape');
            MobileUtils.requestFullscreen();
        } catch (e) {
            console.warn('Impossibile bloccare orientamento o attivare fullscreen:', e);
        }
        
        // Vibrazione per conferma
        MobileUtils.vibrate([100, 50, 100]);
    }
    
    disableCardboardMode() {
        document.getElementById('cardboard-btn').textContent = '📱 Cardboard';
        document.getElementById('mode').textContent = 'Normale';
        document.getElementById('controls').style.display = 'block';
        this.instructionsOverlay.style.display = 'block';
        
        // Rimuovi classe CSS per modalità Cardboard
        document.body.classList.remove('cardboard-mode');
        
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        
        // Sblocca orientamento ed esci da fullscreen
        try {
            MobileUtils.unlockOrientation();
            MobileUtils.exitFullscreen();
        } catch (e) {
            console.warn('Impossibile sbloccare orientamento o uscire da fullscreen:', e);
        }
        
        // Vibrazione per conferma
        MobileUtils.vibrate([50]);
    }
    
    renderStereo() {
        const eyeSeparation = 0.064; // 64mm distanza media tra gli occhi
        const halfWidth = window.innerWidth / 2;
        
        // Occhio sinistro
        this.camera.position.x = -eyeSeparation / 2;
        this.camera.updateProjectionMatrix();
        this.renderer.setViewport(0, 0, halfWidth, window.innerHeight);
        this.renderer.render(this.scene, this.camera);
        
        // Occhio destro
        this.camera.position.x = eyeSeparation / 2;
        this.camera.updateProjectionMatrix();
        this.renderer.setViewport(halfWidth, 0, halfWidth, window.innerHeight);
        this.renderer.render(this.scene, this.camera);
        
        // Ripristina posizione camera
        this.camera.position.x = 0;
    }
    
    animate() {
        requestAnimationFrame(() => this.animate());
        
        // Monitoraggio performance
        const fps = this.performanceMonitor.frame();
        if (fps !== null) {
            document.getElementById('fps').textContent = fps;
            
            // Ottimizzazione automatica qualità
            if (fps < 20 && this.renderer.getPixelRatio() > 1) {
                this.renderer.setPixelRatio(Math.max(1, this.renderer.getPixelRatio() * 0.8));
                console.log('Ridotta qualità rendering per migliorare performance');
            }
        }
        
        // Animazione automatica del cubo quando non ci sono mani
        if (this.handLandmarks.length === 0) {
            this.cube.rotation.x += 0.01;
            this.cube.rotation.y += 0.01;
        }
        
        // Rendering
        if (this.isCardboardMode) {
            this.renderStereo();
        } else {
            this.renderer.render(this.scene, this.camera);
        }
    }
}

// Funzioni globali
function toggleCardboardMode() {
    if (window.arApp) {
        window.arApp.toggleCardboardMode();
    }
}

// Inizializza l'app quando la pagina è caricata
window.addEventListener('DOMContentLoaded', () => {
    window.arApp = new ARMobileApp();
});

// Gestione errori globali
window.addEventListener('error', (e) => {
    console.error('Errore globale:', e.error);
    document.getElementById('status').textContent = 'Errore: ' + e.error.message;
});