class HandTracker {
    constructor() {
        this.hands = null;
        this.camera = null;
        this.onResults = null;
        this.isInitialized = false;
        this.isRunning = false;
        
        // Configurazione per performance mobile
        this.config = {
            maxNumHands: 2,
            modelComplexity: 0, // 0 = lite, 1 = full
            minDetectionConfidence: 0.7,
            minTrackingConfidence: 0.5
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
    
    async start() {
        if (!this.isInitialized) {
            throw new Error('HandTracker non inizializzato');
        }
        
        try {
            // Inizializza camera
            this.camera = new Camera(document.getElementById('video'), {
                onFrame: async () => {
                    if (this.isRunning) {
                        await this.hands.send({ image: document.getElementById('video') });
                    }
                },
                width: 1280,
                height: 720
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