class ARCardboardApp {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.handTracker = null;
        this.cardboard = null;
        this.arScene = null;
        
        this.isARActive = false;
        this.isCardboardMode = false;
        this.frameCount = 0;
        this.lastTime = performance.now();
        
        this.elements = {
            video: document.getElementById('video'),
            canvas: document.getElementById('canvas'),
            startBtn: document.getElementById('startBtn'),
            cardboardBtn: document.getElementById('cardboardBtn'),
            resetBtn: document.getElementById('resetBtn'),
            debugBtn: document.getElementById('debugBtn'),
            status: document.getElementById('status'),
            gestureCount: document.getElementById('gesture-count'),
            leftHand: document.getElementById('left-hand'),
            rightHand: document.getElementById('right-hand'),
            cubeState: document.getElementById('cube-state'),
            debugInfo: document.getElementById('debug-info'),
            deviceInfo: document.getElementById('device-info'),
            cameraInfo: document.getElementById('camera-info'),
            webglInfo: document.getElementById('webgl-info'),
            trackingInfo: document.getElementById('tracking-info'),
            distanceInfo: document.getElementById('distance-info'),
            scaleInfo: document.getElementById('scale-info'),
            fpsInfo: document.getElementById('fps-info'),
            collisionIndicator: document.getElementById('collision-indicator')
        };
        
        // Debug state
        this.debugMode = false;
        this.lastFrameTime = 0;
        this.frameCount = 0;
        this.fps = 0;
        
        this.init();
    }
    
    async init() {
        try {
            this.updateStatus('Inizializzazione renderer...');
            await this.initRenderer();
            
            this.updateStatus('Inizializzazione hand tracking...');
            await this.initHandTracking();
            
            this.updateStatus('Inizializzazione scena AR...');
            await this.initARScene();
            
            this.updateStatus('Inizializzazione Cardboard...');
            await this.initCardboard();
            
            this.setupEventListeners();
            this.hideLoading();
            this.updateStatus('Pronto - Tocca "Avvia AR"');
            
        } catch (error) {
            console.error('Errore durante l\'inizializzazione:', error);
            this.updateStatus('Errore: ' + error.message);
        }
    }
    
    async initRenderer() {
        // Configurazioni specifiche per Safari
        const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        
        const rendererConfig = {
            canvas: this.elements.canvas,
            antialias: !isSafari, // Disabilita antialiasing su Safari per performance
            alpha: true,
            powerPreference: isSafari ? 'default' : 'high-performance',
            preserveDrawingBuffer: isSafari, // Necessario per Safari
            premultipliedAlpha: false
        };
        
        // Configurazioni aggiuntive per iOS
        if (isIOS) {
            rendererConfig.precision = 'mediump';
            rendererConfig.stencil = false;
        }
        
        this.renderer = new THREE.WebGLRenderer(rendererConfig);
        
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        
        // PixelRatio più conservativo per Safari
        const pixelRatio = isSafari ? 1 : Math.min(window.devicePixelRatio, 2);
        this.renderer.setPixelRatio(pixelRatio);
        
        this.renderer.xr.enabled = true;
        
        // Ombre più conservative per Safari
        if (isSafari) {
            this.renderer.shadowMap.enabled = false; // Disabilita ombre su Safari
        } else {
            this.renderer.shadowMap.enabled = true;
            this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        }
        
        // Configurazioni di rendering conservative per Safari
        if (isSafari) {
            this.renderer.outputEncoding = THREE.LinearEncoding;
            this.renderer.toneMapping = THREE.NoToneMapping;
        } else {
            this.renderer.outputEncoding = THREE.sRGBEncoding;
            this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
            this.renderer.toneMappingExposure = 1.0;
        }
        
        // Configura per performance mobile
        this.renderer.powerPreference = isSafari ? 'default' : 'high-performance';
        this.renderer.precision = 'mediump';
        
        console.log('Renderer inizializzato per', isSafari ? 'Safari' : 'browser standard');
    }
    
    async initHandTracking() {
        this.handTracker = new HandTracker();
        await this.handTracker.init();
        
        // Inizializza canvas per avatar delle dita
        this.handTracker.initCanvas();
        
        this.handTracker.onResults = (results) => {
            this.onHandResults(results);
        };
    }
    
    async initARScene() {
        this.arScene = new ARScene(this.renderer);
        await this.arScene.init();
        
        this.scene = this.arScene.scene;
        this.camera = this.arScene.camera;
    }
    
    async initCardboard() {
        this.cardboard = new CardboardEffect(this.renderer);
        await this.cardboard.init();
    }
    
    setupEventListeners() {
        // Gestione eventi con supporto touch per Safari/iOS
        const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        
        if (isSafari || isIOS) {
            // Per Safari/iOS, usa eventi touch per migliore responsività
            this.elements.startBtn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                this.startAR();
            });
            this.elements.cardboardBtn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                this.toggleCardboard();
            });
            this.elements.resetBtn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                this.resetScene();
            });
            this.elements.debugBtn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                this.toggleDebug();
            });
        }
        
        // Eventi click standard per tutti i browser
        this.elements.startBtn.addEventListener('click', () => this.startAR());
        this.elements.cardboardBtn.addEventListener('click', () => this.toggleCardboard());
        this.elements.resetBtn.addEventListener('click', () => this.resetScene());
        this.elements.debugBtn.addEventListener('click', () => this.toggleDebug());
        
        window.addEventListener('resize', () => this.onWindowResize());
        
        // Gestione orientamento dispositivo
        window.addEventListener('orientationchange', () => {
            setTimeout(() => this.onWindowResize(), 100);
        });
        
        // Prevenzione sleep del dispositivo
        document.addEventListener('touchstart', (e) => {
            e.preventDefault();
        }, { passive: false });
    }
    
    async startAR() {
        this.elements.startBtn.disabled = true;
        this.updateStatus('Avvio AR...');
        
        try {
            // Controllo specifico per Safari
            const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
            const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
            
            if (isSafari || isIOS) {
                this.updateStatus('Safari rilevato - Applicando configurazioni specifiche...');
                console.warn('Safari/iOS rilevato - Prestazioni potrebbero essere limitate');
                
                // Avviso specifico per Safari
                if (confirm('Safari rilevato!\n\nPer migliori prestazioni:\n1. Assicurati di avere Safari aggiornato\n2. Chiudi altre schede/app\n3. Considera Chrome se disponibile\n\nContinuare comunque?')) {
                    console.log('Utente ha confermato di continuare con Safari');
                } else {
                    this.elements.startBtn.disabled = false;
                    this.updateStatus('Avvio annullato dall\'utente');
                    return;
                }
            }
            
            // Verifica supporto dispositivo
            this.checkDeviceSupport();
            
            this.updateStatus('Richiesta permessi camera...');
            // Richiedi permessi camera
            await this.requestCameraPermission();
            
            this.updateStatus('Inizializzazione hand tracking...');
            // Avvia hand tracking
            await this.handTracker.start();
            
            this.updateStatus('Avvio rendering...');
            // Avvia rendering loop
            this.isARActive = true;
            this.animate();
            
            this.elements.cardboardBtn.disabled = false;
            this.updateStatus('AR attivo - Muovi le mani davanti alla camera');
            
            console.log('AR avviato con successo su dispositivo:', this.getDeviceInfo());
            
        } catch (error) {
            console.error('Errore avvio AR:', error);
            const errorMsg = this.getDetailedErrorMessage(error);
            this.updateStatus('Errore AR: ' + errorMsg);
            this.elements.startBtn.disabled = false;
        }
    }
    
    checkDeviceSupport() {
        // Verifica supporto WebGL
        if (!this.renderer || !this.renderer.getContext()) {
            throw new Error('WebGL non supportato su questo dispositivo');
        }
        
        // Verifica supporto MediaDevices
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error('Accesso camera non supportato su questo browser');
        }
        
        // Verifica supporto WASM per MediaPipe
        if (typeof WebAssembly === 'undefined') {
            throw new Error('WebAssembly non supportato - necessario per hand tracking');
        }
        
        // Controlli specifici per Safari
        const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
        if (isSafari) {
            console.warn('Safari rilevato - applicando workaround specifici');
            
            // Verifica supporto WebRTC su Safari
            if (!window.RTCPeerConnection) {
                throw new Error('WebRTC non supportato su questa versione di Safari');
            }
            
            // Verifica versione iOS Safari
            const iosVersion = this.getIOSVersion();
            if (iosVersion && iosVersion < 14) {
                throw new Error('iOS 14+ richiesto per questa applicazione');
            }
        }
    }
    
    getIOSVersion() {
        const match = navigator.userAgent.match(/OS (\d+)_(\d+)_?(\d+)?/);
        if (match) {
            return parseInt(match[1], 10);
        }
        return null;
    }
    
    getDeviceInfo() {
        return {
            userAgent: navigator.userAgent,
            platform: navigator.platform,
            screenSize: `${window.innerWidth}x${window.innerHeight}`,
            pixelRatio: window.devicePixelRatio,
            webgl: this.renderer ? this.renderer.capabilities : 'non disponibile'
        };
    }
    
    getDetailedErrorMessage(error) {
        const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        
        if (error.name === 'NotAllowedError') {
            if (isSafari || isIOS) {
                return 'Permesso camera negato su Safari. Assicurati di:\n1. Permettere accesso camera quando richiesto\n2. Verificare impostazioni privacy Safari\n3. Provare in modalità privata';
            }
            return 'Permesso camera negato. Abilita la camera nelle impostazioni del browser.';
        }
        if (error.name === 'NotFoundError') {
            if (isSafari || isIOS) {
                return 'Camera non trovata su Safari. Verifica:\n1. Che il dispositivo abbia una camera\n2. Che Safari abbia accesso alla camera\n3. Riavvia Safari se necessario';
            }
            return 'Nessuna camera trovata su questo dispositivo.';
        }
        if (error.name === 'NotSupportedError') {
            if (isSafari || isIOS) {
                return 'Camera non supportata su questa versione Safari. Aggiorna Safari o prova Chrome.';
            }
            return 'Camera non supportata su questo dispositivo.';
        }
        if (error.name === 'NotReadableError') {
            if (isSafari || isIOS) {
                return 'Camera occupata su Safari. Chiudi altre app/schede che usano la camera e riprova.';
            }
            return 'Camera in uso da altra applicazione.';
        }
        if (error.message.includes('WebGL')) {
            if (isSafari || isIOS) {
                return 'WebGL limitato su Safari. Prova:\n1. Abilitare WebGL nelle impostazioni Safari\n2. Usare Chrome o Firefox se disponibili\n3. Aggiornare iOS/Safari';
            }
            return 'WebGL non supportato. Prova con un browser più recente.';
        }
        if (error.message.includes('MediaPipe') || error.message.includes('WASM')) {
            if (isSafari || isIOS) {
                return 'Hand tracking limitato su Safari. Aggiorna Safari o prova Chrome per prestazioni migliori.';
            }
            return 'Hand tracking non supportato su questo dispositivo.';
        }
        
        if (isSafari || isIOS) {
            return `Errore Safari: ${error.message}\n\nSuggerimenti:\n1. Aggiorna Safari all'ultima versione\n2. Prova in modalità privata\n3. Usa Chrome se disponibile`;
        }
        
        return error.message;
    }
    
    async requestCameraPermission() {
        try {
            console.log('Richiesta accesso camera...');
            
            // Rileva browser e dispositivo
            const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
            const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
            const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
            
            // Configurazioni specifiche per Safari/iOS
            let constraints = {
                video: {
                    width: { ideal: isMobile ? (isSafari ? 480 : 640) : 1280 },
                    height: { ideal: isMobile ? (isSafari ? 360 : 480) : 720 },
                    frameRate: { ideal: isSafari ? 10 : (isMobile ? 15 : 30) },
                    facingMode: 'environment'
                },
                audio: false
            };
            
            // Configurazioni aggiuntive per Safari
            if (isSafari) {
                constraints.video.aspectRatio = 4/3;
                constraints.video.resizeMode = 'crop-and-scale';
                
                // Su iOS Safari, usa configurazioni più conservative
                if (isIOS) {
                    constraints.video.width = { ideal: 320, max: 640 };
                    constraints.video.height = { ideal: 240, max: 480 };
                    constraints.video.frameRate = { ideal: 8, max: 15 };
                }
            }
            
            let stream;
            try {
                // Prova prima con camera environment
                stream = await navigator.mediaDevices.getUserMedia(constraints);
                console.log('Camera environment ottenuta');
            } catch (envError) {
                console.warn('Camera environment non disponibile, provo user camera:', envError.message);
                // Fallback a camera frontale
                constraints.video.facingMode = 'user';
                
                try {
                    stream = await navigator.mediaDevices.getUserMedia(constraints);
                    console.log('Camera user ottenuta');
                } catch (userError) {
                    // Ultimo tentativo con configurazioni minime
                    console.warn('Provo configurazioni minime:', userError.message);
                    constraints = {
                        video: {
                            width: { ideal: 320 },
                            height: { ideal: 240 },
                            frameRate: { ideal: 8 }
                        },
                        audio: false
                    };
                    stream = await navigator.mediaDevices.getUserMedia(constraints);
                    console.log('Camera con configurazioni minime ottenuta');
                }
            }
            
            this.elements.video.srcObject = stream;
            
            // Configurazioni specifiche per Safari
            if (isSafari) {
                this.elements.video.setAttribute('playsinline', 'true');
                this.elements.video.setAttribute('webkit-playsinline', 'true');
                this.elements.video.muted = true;
            }
            
            // Aspetta che il video sia pronto
            return new Promise((resolve, reject) => {
                this.elements.video.onloadedmetadata = () => {
                    // Per Safari, aggiungi un piccolo delay
                    const playVideo = () => {
                        this.elements.video.play()
                            .then(() => {
                                console.log('Video stream attivo:', stream.getVideoTracks()[0].getSettings());
                                resolve(stream);
                            })
                            .catch(reject);
                    };
                    
                    if (isSafari) {
                        setTimeout(playVideo, 100);
                    } else {
                        playVideo();
                    }
                };
                
                this.elements.video.onerror = () => {
                    reject(new Error('Errore caricamento video'));
                };
                
                // Timeout più lungo per Safari
                const timeout = isSafari ? 15000 : 10000;
                setTimeout(() => {
                    reject(new Error('Timeout caricamento video'));
                }, timeout);
            });
            
        } catch (error) {
            console.error('Errore accesso camera:', error);
            throw new Error('Impossibile accedere alla camera: ' + error.message);
        }
    }
    
    toggleCardboard() {
        this.isCardboardMode = !this.isCardboardMode;
        
        if (this.isCardboardMode) {
            this.cardboard.enable();
            this.elements.cardboardBtn.textContent = 'Esci Cardboard';
            this.updateStatus('Modalità Cardboard attiva');
            
            // Nascondi UI per immersione completa
            document.getElementById('ui').style.display = 'none';
            document.getElementById('controls').style.display = 'none';
            document.querySelector('.hand-info').style.display = 'none';
            
        } else {
            this.cardboard.disable();
            this.elements.cardboardBtn.textContent = 'Modalità Cardboard';
            this.updateStatus('Modalità normale');
            
            // Mostra UI
            document.getElementById('ui').style.display = 'block';
            document.getElementById('controls').style.display = 'flex';
            document.querySelector('.hand-info').style.display = 'block';
        }
    }
    
    resetScene() {
        if (this.arScene) {
            this.arScene.reset();
            this.updateStatus('Scena resettata');
        }
    }
    
    onHandResults(results) {
        if (this.arScene) {
            this.arScene.updateHandInteraction(results);
        }
        
        // Aggiorna UI
        const handCount = results.multiHandLandmarks ? results.multiHandLandmarks.length : 0;
        this.elements.gestureCount.textContent = handCount;
        
        // Aggiorna informazioni mani
        if (results.multiHandLandmarks && results.multiHandedness) {
            let leftHand = '-';
            let rightHand = '-';
            
            for (let i = 0; i < results.multiHandedness.length; i++) {
                const handedness = results.multiHandedness[i].label;
                const landmarks = results.multiHandLandmarks[i];
                
                if (handedness === 'Left') {
                    leftHand = 'Rilevata';
                } else if (handedness === 'Right') {
                    rightHand = 'Rilevata';
                }
            }
            
            this.elements.leftHand.textContent = leftHand;
            this.elements.rightHand.textContent = rightHand;
        } else {
            this.elements.leftHand.textContent = '-';
            this.elements.rightHand.textContent = '-';
        }
    }
    
    animate() {
        if (!this.isARActive) return;
        
        requestAnimationFrame(() => this.animate());
        
        // Calcola FPS
        this.frameCount++;
        const currentTime = performance.now();
        if (currentTime - this.lastFrameTime >= 1000) {
            this.fps = Math.round((this.frameCount * 1000) / (currentTime - this.lastFrameTime));
            this.frameCount = 0;
            this.lastFrameTime = currentTime;
        }
        
        // Aggiorna debug info
        if (this.debugMode) {
            this.updateDebugInfo();
        }
        
        // Aggiorna scena
        if (this.arScene) {
            this.arScene.update();
        }
        
        // Render
        if (this.isCardboardMode) {
            this.cardboard.render(this.scene, this.camera);
        } else {
            this.renderer.render(this.scene, this.camera);
        }
    }
    
    toggleDebug() {
        this.debugMode = !this.debugMode;
        if (this.debugMode) {
            this.elements.debugInfo.classList.add('show');
            this.elements.debugBtn.textContent = 'Nascondi Debug';
            this.initDebugInfo();
        } else {
            this.elements.debugInfo.classList.remove('show');
            this.elements.debugBtn.textContent = 'Debug';
        }
    }
    
    initDebugInfo() {
        // Informazioni dispositivo
        const deviceInfo = this.getDeviceInfo();
        this.elements.deviceInfo.textContent = deviceInfo.type;
        
        // Informazioni WebGL
        const gl = this.renderer.getContext();
        const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
        const renderer = debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : 'Unknown';
        this.elements.webglInfo.textContent = renderer.substring(0, 30) + '...';
        
        // Informazioni camera
        if (this.elements.video.srcObject) {
            const track = this.elements.video.srcObject.getVideoTracks()[0];
            const settings = track.getSettings();
            this.elements.cameraInfo.textContent = `${settings.width}x${settings.height}`;
        }
    }
    
    updateDebugInfo() {
        // FPS
        this.elements.fpsInfo.textContent = this.fps;
        
        // Hand tracking status
        const trackingStatus = this.handTracker && this.handTracker.isActive ? 'Attivo' : 'Inattivo';
        this.elements.trackingInfo.textContent = trackingStatus;
        
        // Cube info
        if (this.arScene && this.arScene.cube) {
            const scale = this.arScene.cube.scale.x;
            this.elements.scaleInfo.textContent = scale.toFixed(2) + 'x';
            
            // Distance and collision info
            if (this.arScene.lastHandPosition) {
                const distance = this.arScene.cube.position.distanceTo(this.arScene.lastHandPosition);
                this.elements.distanceInfo.textContent = distance.toFixed(2);
                
                // Update collision indicator
                const indicator = this.elements.collisionIndicator;
                if (this.arScene.isInContact) {
                    indicator.className = 'collision-indicator contact';
                } else if (distance < this.arScene.collisionDistance * 2) {
                    indicator.className = 'collision-indicator proximity';
                } else {
                    indicator.className = 'collision-indicator';
                }
            }
        }
    }
    
    onWindowResize() {
        const width = window.innerWidth;
        const height = window.innerHeight;
        
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        
        this.renderer.setSize(width, height);
        
        if (this.cardboard) {
            this.cardboard.setSize(width, height);
        }
    }
    
    updateStatus(message) {
        this.elements.status.textContent = message;
        console.log('Status:', message);
    }
    
    hideLoading() {
        this.elements.loading.style.display = 'none';
    }
}

// Inizializza app quando DOM è pronto
document.addEventListener('DOMContentLoaded', () => {
    // Verifica supporto WebGL
    if (!window.WebGLRenderingContext) {
        alert('WebGL non supportato su questo dispositivo');
        return;
    }
    
    // Verifica supporto MediaDevices
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert('Camera non supportata su questo dispositivo');
        return;
    }
    
    // Avvia app
    window.arApp = new ARCardboardApp();
});