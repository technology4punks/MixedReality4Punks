class HandTracker {
    constructor() {
        this.hands = null;
        this.camera = null;
        this.onResults = null;
        this.isInitialized = false;
        this.isRunning = false;
        
        // Canvas per disegnare landmarks delle mani
        this.canvasElement = null;
        this.canvasCtx = null;
        
        // Configurazione per performance mobile
        this.config = {
            maxNumHands: 2,
            modelComplexity: 0, // 0 = lite, 1 = full
            minDetectionConfidence: 0.6, // Ridotto per mobile
            minTrackingConfidence: 0.4   // Ridotto per mobile
        };
        
        // Stato delle mani per gesture recognition
        this.handStates = {
            left: { isGrabbing: false, isPinching: false, confidence: 0 },
            right: { isGrabbing: false, isPinching: false, confidence: 0 }
        };
        
        // Soglie per gesture recognition
        this.thresholds = {
            grab: 0.15,      // Distanza per pugno chiuso
            pinch: 0.08,     // Distanza per pizzico
            confidence: 0.8   // Confidenza minima
        };
    }
    
    async init() {
        try {
            // Inizializza canvas per landmarks
            this.initCanvas();
            
            // Inizializza MediaPipe Hands
            this.hands = new Hands({
                locateFile: (file) => {
                    return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
                }
            });
            
            // Configura opzioni
            this.hands.setOptions(this.config);
            
            // Imposta callback per risultati
            this.hands.onResults((results) => {
                this.processResults(results);
            });
            
            this.isInitialized = true;
            console.log('HandTracker inizializzato');
            
        } catch (error) {
            console.error('Errore inizializzazione HandTracker:', error);
            throw error;
        }
    }
    
    initCanvas() {
        // Crea canvas overlay per disegnare landmarks
        this.canvasElement = document.createElement('canvas');
        this.canvasElement.id = 'hand-landmarks';
        this.canvasElement.style.position = 'absolute';
        this.canvasElement.style.top = '0';
        this.canvasElement.style.left = '0';
        this.canvasElement.style.width = '100%';
        this.canvasElement.style.height = '100%';
        this.canvasElement.style.pointerEvents = 'none';
        this.canvasElement.style.zIndex = '10';
        
        document.getElementById('container').appendChild(this.canvasElement);
        this.canvasCtx = this.canvasElement.getContext('2d');
        
        // Ridimensiona canvas
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
    }
    
    resizeCanvas() {
        this.canvasElement.width = window.innerWidth;
        this.canvasElement.height = window.innerHeight;
    }
    
    async start() {
        if (!this.isInitialized) {
            throw new Error('HandTracker non inizializzato');
        }
        
        try {
            // Configurazione camera ottimizzata per mobile
            const videoElement = document.getElementById('video');
            
            // Inizializza camera con fallback per mobile
            this.camera = new Camera(videoElement, {
                onFrame: async () => {
                    if (this.isRunning && this.hands) {
                        try {
                            await this.hands.send({ image: videoElement });
                        } catch (error) {
                            console.warn('Errore invio frame:', error);
                        }
                    }
                },
                width: window.innerWidth > 768 ? 1280 : 640,  // Risoluzione adattiva
                height: window.innerWidth > 768 ? 720 : 480
            });
            
            await this.camera.start();
            this.isRunning = true;
            
            console.log('HandTracker avviato');
            
        } catch (error) {
            console.error('Errore avvio HandTracker:', error);
            throw error;
        }
    }
    
    stop() {
        this.isRunning = false;
        if (this.camera) {
            this.camera.stop();
        }
    }
    
    processResults(results) {
        // Pulisci canvas
        this.clearCanvas();
        
        // Disegna landmarks delle mani
        this.drawHandLandmarks(results);
        
        // Aggiorna stati delle mani
        this.updateHandStates(results);
        
        // Chiama callback se definito
        if (this.onResults) {
            this.onResults({
                ...results,
                handStates: this.handStates,
                gestures: this.detectGestures(results)
            });
        }
    }
    
    clearCanvas() {
        if (this.canvasCtx) {
            this.canvasCtx.clearRect(0, 0, this.canvasElement.width, this.canvasElement.height);
        }
    }
    
    drawHandLandmarks(results) {
        if (!this.canvasCtx || !results.multiHandLandmarks) return;
        
        const ctx = this.canvasCtx;
        const width = this.canvasElement.width;
        const height = this.canvasElement.height;
        
        // Disegna ogni mano rilevata
        for (let i = 0; i < results.multiHandLandmarks.length; i++) {
            const landmarks = results.multiHandLandmarks[i];
            const handedness = results.multiHandedness[i];
            const isLeft = handedness.label === 'Left';
            
            // Colore diverso per mano sinistra e destra
            const handColor = isLeft ? '#00ff00' : '#ff0000';
            const jointColor = isLeft ? '#00aa00' : '#aa0000';
            
            // Disegna connessioni tra landmarks
            this.drawHandConnections(ctx, landmarks, width, height, handColor);
            
            // Disegna landmarks (punti delle dita)
            this.drawHandPoints(ctx, landmarks, width, height, jointColor);
            
            // Disegna etichetta mano
            this.drawHandLabel(ctx, landmarks, width, height, handedness.label, handColor);
        }
    }
    
    drawHandConnections(ctx, landmarks, width, height, color) {
        // Connessioni delle dita
        const connections = [
            // Pollice
            [0, 1], [1, 2], [2, 3], [3, 4],
            // Indice
            [0, 5], [5, 6], [6, 7], [7, 8],
            // Medio
            [0, 9], [9, 10], [10, 11], [11, 12],
            // Anulare
            [0, 13], [13, 14], [14, 15], [15, 16],
            // Mignolo
            [0, 17], [17, 18], [18, 19], [19, 20],
            // Palmo
            [5, 9], [9, 13], [13, 17]
        ];
        
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        
        connections.forEach(([start, end]) => {
            const startPoint = landmarks[start];
            const endPoint = landmarks[end];
            
            ctx.beginPath();
            ctx.moveTo(startPoint.x * width, startPoint.y * height);
            ctx.lineTo(endPoint.x * width, endPoint.y * height);
            ctx.stroke();
        });
    }
    
    drawHandPoints(ctx, landmarks, width, height, color) {
        ctx.fillStyle = color;
        
        landmarks.forEach((landmark, index) => {
            const x = landmark.x * width;
            const y = landmark.y * height;
            
            // Dimensione diversa per punti importanti
            const radius = [0, 4, 8, 12, 16, 20].includes(index) ? 6 : 4;
            
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, 2 * Math.PI);
            ctx.fill();
            
            // Bordo bianco per visibilità
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1;
            ctx.stroke();
        });
    }
    
    drawHandLabel(ctx, landmarks, width, height, label, color) {
        const wrist = landmarks[0];
        const x = wrist.x * width;
        const y = wrist.y * height - 20;
        
        ctx.fillStyle = color;
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(label, x, y);
    }
    
    updateHandStates(results) {
        // Reset stati
        this.handStates.left = { isGrabbing: false, isPinching: false, confidence: 0 };
        this.handStates.right = { isGrabbing: false, isPinching: false, confidence: 0 };
        
        if (!results.multiHandLandmarks || !results.multiHandedness) {
            return;
        }
        
        // Analizza ogni mano rilevata
        for (let i = 0; i < results.multiHandLandmarks.length; i++) {
            const landmarks = results.multiHandLandmarks[i];
            const handedness = results.multiHandedness[i];
            const label = handedness.label.toLowerCase();
            
            // Calcola gesti per questa mano
            const gestures = this.analyzeHandGestures(landmarks);
            
            // Aggiorna stato
            if (this.handStates[label]) {
                this.handStates[label] = {
                    isGrabbing: gestures.isGrabbing,
                    isPinching: gestures.isPinching,
                    confidence: handedness.score,
                    landmarks: landmarks,
                    position: this.getHandPosition(landmarks)
                };
            }
        }
    }
    
    analyzeHandGestures(landmarks) {
        // Indici dei landmark delle dita
        const fingerTips = [4, 8, 12, 16, 20]; // Pollice, Indice, Medio, Anulare, Mignolo
        const fingerMCPs = [2, 5, 9, 13, 17]; // Metacarpo delle dita
        
        // Calcola se le dita sono chiuse (per grab gesture)
        let closedFingers = 0;
        
        // Controlla pollice (diverso dalle altre dita)
        const thumbTip = landmarks[4];
        const thumbMCP = landmarks[2];
        const thumbDistance = this.calculateDistance(thumbTip, thumbMCP);
        if (thumbDistance < this.thresholds.grab) closedFingers++;
        
        // Controlla altre dita
        for (let i = 1; i < fingerTips.length; i++) {
            const tip = landmarks[fingerTips[i]];
            const mcp = landmarks[fingerMCPs[i]];
            const distance = this.calculateDistance(tip, mcp);
            if (distance < this.thresholds.grab) closedFingers++;
        }
        
        // Gesture grab: almeno 4 dita chiuse
        const isGrabbing = closedFingers >= 4;
        
        // Gesture pinch: distanza tra pollice e indice
        const thumbTipPos = landmarks[4];
        const indexTipPos = landmarks[8];
        const pinchDistance = this.calculateDistance(thumbTipPos, indexTipPos);
        const isPinching = pinchDistance < this.thresholds.pinch;
        
        return {
            isGrabbing,
            isPinching,
            closedFingers,
            pinchDistance
        };
    }
    
    getHandPosition(landmarks) {
        // Calcola posizione centrale della mano (polso)
        const wrist = landmarks[0];
        return {
            x: wrist.x,
            y: wrist.y,
            z: wrist.z || 0
        };
    }
    
    detectGestures(results) {
        const gestures = [];
        
        // Analizza gesti per ogni mano
        Object.keys(this.handStates).forEach(hand => {
            const state = this.handStates[hand];
            if (state.confidence > this.thresholds.confidence) {
                
                if (state.isGrabbing) {
                    gestures.push({
                        type: 'grab',
                        hand: hand,
                        position: state.position,
                        confidence: state.confidence
                    });
                }
                
                if (state.isPinching) {
                    gestures.push({
                        type: 'pinch',
                        hand: hand,
                        position: state.position,
                        confidence: state.confidence
                    });
                }
                
                // Gesture di mano aperta
                if (!state.isGrabbing && !state.isPinching) {
                    gestures.push({
                        type: 'open',
                        hand: hand,
                        position: state.position,
                        confidence: state.confidence
                    });
                }
            }
        });
        
        return gestures;
    }
    
    calculateDistance(point1, point2) {
        const dx = point1.x - point2.x;
        const dy = point1.y - point2.y;
        const dz = (point1.z || 0) - (point2.z || 0);
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }
    
    // Converte coordinate normalizzate in coordinate 3D
    normalizedToWorld(normalizedPos, camera) {
        // Converte da coordinate normalizzate (0-1) a coordinate mondo
        const vector = new THREE.Vector3(
            (normalizedPos.x - 0.5) * 2,
            -(normalizedPos.y - 0.5) * 2,
            normalizedPos.z || 0
        );
        
        vector.unproject(camera);
        return vector;
    }
    
    // Ottiene la posizione 3D della mano nello spazio mondo
    getWorldHandPosition(hand, camera) {
        const state = this.handStates[hand];
        if (!state || !state.position) return null;
        
        return this.normalizedToWorld(state.position, camera);
    }
    
    // Verifica se una mano sta eseguendo un gesto specifico
    isHandGesture(hand, gestureType) {
        const state = this.handStates[hand];
        if (!state || state.confidence < this.thresholds.confidence) {
            return false;
        }
        
        switch (gestureType) {
            case 'grab':
                return state.isGrabbing;
            case 'pinch':
                return state.isPinching;
            case 'open':
                return !state.isGrabbing && !state.isPinching;
            default:
                return false;
        }
    }
    
    // Aggiorna configurazione
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        if (this.hands) {
            this.hands.setOptions(this.config);
        }
    }
}