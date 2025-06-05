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
            loading: document.getElementById('loading'),
            status: document.getElementById('status'),
            handsCount: document.getElementById('handsCount'),
            fps: document.getElementById('fps'),
            startBtn: document.getElementById('startBtn'),
            cardboardBtn: document.getElementById('cardboardBtn'),
            resetBtn: document.getElementById('resetBtn'),
            canvas: document.getElementById('canvas'),
            video: document.getElementById('video')
        };
        
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
        // Inizializza Three.js renderer
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.elements.canvas,
            antialias: true,
            alpha: true
        });
        
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.xr.enabled = true;
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        
        // Configura per performance mobile
        this.renderer.powerPreference = 'high-performance';
        this.renderer.precision = 'mediump';
    }
    
    async initHandTracking() {
        this.handTracker = new HandTracker();
        await this.handTracker.init();
        
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
        this.elements.startBtn.addEventListener('click', () => this.startAR());
        this.elements.cardboardBtn.addEventListener('click', () => this.toggleCardboard());
        this.elements.resetBtn.addEventListener('click', () => this.resetScene());
        
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
        try {
            this.updateStatus('Avvio AR...');
            this.elements.startBtn.disabled = true;
            
            // Richiedi permessi camera
            await this.requestCameraPermission();
            
            // Avvia hand tracking
            await this.handTracker.start();
            
            // Avvia rendering loop
            this.isARActive = true;
            this.animate();
            
            this.elements.cardboardBtn.disabled = false;
            this.updateStatus('AR attivo');
            
        } catch (error) {
            console.error('Errore avvio AR:', error);
            this.updateStatus('Errore AR: ' + error.message);
            this.elements.startBtn.disabled = false;
        }
    }
    
    async requestCameraPermission() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'environment',
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                }
            });
            
            this.elements.video.srcObject = stream;
            return stream;
            
        } catch (error) {
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
        this.elements.handsCount.textContent = handCount;
    }
    
    animate() {
        if (!this.isARActive) return;
        
        requestAnimationFrame(() => this.animate());
        
        // Calcola FPS
        this.frameCount++;
        const currentTime = performance.now();
        if (currentTime - this.lastTime >= 1000) {
            const fps = Math.round((this.frameCount * 1000) / (currentTime - this.lastTime));
            this.elements.fps.textContent = fps;
            this.frameCount = 0;
            this.lastTime = currentTime;
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