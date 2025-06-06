class ARCardboardApp {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.cube = null;
        this.hands = null;
        this.video = null;
        this.canvas = null;
        this.isCardboardMode = false;
        this.handLandmarks = null;
        this.currentCameraFacing = 'environment';
        
        // Proprietà per comportamento naturale - MIGLIORATO
        this.handVisualizers = [];
        this.interactionState = {
            isNearCube: false,
            isGrabbing: false,
            grabDistance: 0.8, // AUMENTATO per mobile
            hoverDistance: 1.2, // AUMENTATO per mobile
            grabHand: null,
            grabOffset: new THREE.Vector3(),
            lastGrabPosition: new THREE.Vector3(),
            twoHandsRequired: false,
            bothHandsNear: false,
            handsDetected: false,
            rotationMode: false // AGGIUNTO per rotazione
        };
        
        this.cubePhysics = {
            velocity: new THREE.Vector3(),
            angularVelocity: new THREE.Vector3(),
            damping: 0.95, // AUMENTATO per stabilità
            gravity: 0, // DISABILITATO completamente
            restPosition: new THREE.Vector3(0, 0, 0),
            isResting: false,
            enableGravity: false
        };
        
        this.handHistory = [];
        this.gestureState = 'none';
        this.proximityIndicator = null;
        this.lastHandUpdate = 0; // AGGIUNTO per debug tracking
        
        this.init();
    }
    
    async init() {
        await this.setupCamera();
        this.setupThreeJS();
        this.setupMediaPipe();
        this.setupEventListeners();
        this.animate();
    }
    
    async setupCamera() {
        this.video = document.getElementById('video');
        
        try {
            await this.initializeCamera(this.currentCameraFacing);
            console.log('✅ Camera attivata:', this.video.srcObject.getVideoTracks()[0].getSettings());
        } catch (error) {
            console.error('❌ Errore accesso camera:', error);
            alert('Impossibile accedere alla camera. Assicurati di aver dato i permessi.');
        }
    }
    
    async initializeCamera(facingMode) {
        const constraints = {
            video: {
                facingMode: facingMode === 'environment' ? { exact: 'environment' } : 'user',
                width: { ideal: 1920, min: 1280 },
                height: { ideal: 1080, min: 720 },
                frameRate: { ideal: 60, min: 30 }
            }
        };
        
        let stream;
        try {
            stream = await navigator.mediaDevices.getUserMedia(constraints);
        } catch (error) {
            console.warn(`Camera ${facingMode} non disponibile, uso camera alternativa`);
            const fallbackConstraints = {
                video: {
                    facingMode: facingMode === 'environment' ? 'user' : { exact: 'environment' },
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                }
            };
            stream = await navigator.mediaDevices.getUserMedia(fallbackConstraints);
            this.currentCameraFacing = facingMode === 'environment' ? 'user' : 'environment';
        }
        
        if (this.video.srcObject) {
            this.video.srcObject.getTracks().forEach(track => track.stop());
        }
        
        this.video.srcObject = stream;
        await new Promise(resolve => {
            this.video.onloadedmetadata = resolve;
        });
    }
    
    setupThreeJS() {
        this.canvas = document.getElementById('canvas');
        
        this.scene = new THREE.Scene();
        
        this.camera = new THREE.PerspectiveCamera(
            75, // AUMENTATO FOV per mobile
            window.innerWidth / window.innerHeight,
            0.01,
            1000
        );
        this.camera.position.set(0, 0, 2); // AVVICINATO per mobile
        
        // MIGLIORATO per mobile
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            alpha: true,
            antialias: !isMobile, // Disabilita antialiasing su mobile
            powerPreference: 'high-performance'
        });
        
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2));
        this.renderer.setClearColor(0x000000, 0);
        
        // Ombre semplificate per mobile
        if (!isMobile) {
            this.renderer.shadowMap.enabled = true;
            this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        }
        
        // Illuminazione migliorata
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6); // AUMENTATO
        this.scene.add(ambientLight);
        
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0); // AUMENTATO
        directionalLight.position.set(5, 5, 5);
        if (!isMobile) {
            directionalLight.castShadow = true;
            directionalLight.shadow.mapSize.width = 512; // RIDOTTO per performance
            directionalLight.shadow.mapSize.height = 512;
        }
        this.scene.add(directionalLight);
        
        // Cubo più grande e visibile
        const geometry = new THREE.BoxGeometry(0.8, 0.8, 0.8); // AUMENTATO
        const material = new THREE.MeshPhongMaterial({ 
            color: 0xff3030,
            shininess: 100,
            specular: 0x222222,
            transparent: true,
            opacity: 1.0 // AUMENTATO per visibilità
        });
        
        this.cube = new THREE.Mesh(geometry, material);
        this.cube.position.copy(this.cubePhysics.restPosition);
        if (!isMobile) {
            this.cube.castShadow = true;
            this.cube.receiveShadow = true;
        }
        this.scene.add(this.cube);
        
        // Wireframe più visibile
        const edges = new THREE.EdgesGeometry(geometry);
        const lineMaterial = new THREE.LineBasicMaterial({ 
            color: 0xffffff, 
            linewidth: 3, // AUMENTATO
            transparent: true,
            opacity: 0.8 // AUMENTATO
        });
        const wireframe = new THREE.LineSegments(edges, lineMaterial);
        this.cube.add(wireframe);
        
        this.createProximityIndicator();
        this.createHandVisualizers();
    }
    
    createProximityIndicator() {
        const ringGeometry = new THREE.RingGeometry(0.8, 1.0, 32);
        const ringMaterial = new THREE.MeshBasicMaterial({ 
            color: 0x00ff00,
            transparent: true,
            opacity: 0,
            side: THREE.DoubleSide
        });
        
        this.proximityIndicator = new THREE.Mesh(ringGeometry, ringMaterial);
        this.proximityIndicator.rotation.x = -Math.PI / 2;
        this.scene.add(this.proximityIndicator);
    }
    
    createHandVisualizers() {
        for (let i = 0; i < 2; i++) {
            const handGroup = new THREE.Group();
            
            const keyPoints = [0, 4, 8, 12, 16, 20];
            
            keyPoints.forEach((pointIndex, idx) => {
                const geometry = new THREE.SphereGeometry(0.015, 8, 8);
                const material = new THREE.MeshBasicMaterial({ 
                    color: idx === 0 ? 0x00ff00 : 0xff00ff,
                    transparent: true,
                    opacity: 0.7
                });
                const sphere = new THREE.Mesh(geometry, material);
                sphere.userData = { pointIndex };
                handGroup.add(sphere);
            });
            
            const lineGeometry = new THREE.BufferGeometry();
            const lineMaterial = new THREE.LineBasicMaterial({ 
                color: 0x00ffff, 
                transparent: true, 
                opacity: 0.5 
            });
            const lines = new THREE.LineSegments(lineGeometry, lineMaterial);
            handGroup.add(lines);
            handGroup.userData = { lines };
            
            handGroup.visible = false;
            this.scene.add(handGroup);
            this.handVisualizers.push(handGroup);
        }
    }
    
    setupMediaPipe() {
        this.hands = new Hands({
            locateFile: (file) => {
                return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
            }
        });
        
        // MIGLIORATO per stabilità
        this.hands.setOptions({
            maxNumHands: 2,
            modelComplexity: 0, // RIDOTTO per performance mobile
            minDetectionConfidence: 0.6, // RIDOTTO per sensibilità
            minTrackingConfidence: 0.6 // RIDOTTO per sensibilità
        });
        
        this.hands.onResults(this.onHandsResults.bind(this));
        
        const camera = new Camera(this.video, {
            onFrame: async () => {
                try {
                    await this.hands.send({ image: this.video });
                    this.lastHandUpdate = Date.now(); // AGGIUNTO per debug
                } catch (error) {
                    console.warn('Errore MediaPipe:', error);
                    // Riprova dopo un breve delay
                    setTimeout(() => {
                        this.setupMediaPipe();
                    }, 1000);
                }
            },
            width: 640, // RIDOTTO per performance
            height: 480
        });
        camera.start();
    }
    
    onHandsResults(results) {
        this.handLandmarks = results.multiHandLandmarks;
        this.lastHandUpdate = Date.now();
        
        // Aggiorna lo stato di rilevamento mani
        this.interactionState.handsDetected = this.handLandmarks && this.handLandmarks.length > 0;
        
        this.handVisualizers.forEach(hand => hand.visible = false);
        
        if (this.interactionState.handsDetected) {
            this.updateHandVisualizers();
            this.processNaturalHandGestures();
            
            const handCount = this.handLandmarks.length;
            const gestureInfo = this.getGestureDescription();
            const proximityInfo = this.getProximityInfo();
            
            document.getElementById('handInfo').innerHTML = 
                `🖐️ Mani: ${handCount} | ${proximityInfo} | 🎯 ${gestureInfo} | ⏱️ ${Date.now() - this.lastHandUpdate}ms`;
        } else {
            // MIGLIORATO: Controlla se il tracking è bloccato
            const timeSinceLastUpdate = Date.now() - this.lastHandUpdate;
            if (timeSinceLastUpdate > 3000) {
                document.getElementById('handInfo').innerHTML = 
                    '⚠️ Tracking bloccato - Riavvio in corso...';
                this.restartMediaPipe();
            } else {
                document.getElementById('handInfo').textContent = 
                    '👋 Posiziona le mani davanti alla camera';
            }
            this.resetInteractionState();
        }
    }
    
    // AGGIUNTO: Riavvio MediaPipe
    restartMediaPipe() {
        if (this.hands) {
            this.hands.close();
        }
        setTimeout(() => {
            this.setupMediaPipe();
        }, 1000);
    }
    
    resetInteractionState() {
        this.gestureState = 'none';
        this.interactionState.isGrabbing = false;
        this.interactionState.isNearCube = false;
        this.interactionState.grabHand = null;
        this.interactionState.bothHandsNear = false;
        this.interactionState.twoHandsRequired = false;
        
        // Disabilita la gravità quando non ci sono mani
        this.cubePhysics.enableGravity = false;
        
        // Ferma il movimento del cubo
        this.cubePhysics.velocity.set(0, 0, 0);
        this.cubePhysics.angularVelocity.set(0, 0, 0);
        
        this.resetCubeAppearance();
    }
    
    resetCubeAppearance() {
        this.cube.scale.lerp(new THREE.Vector3(1, 1, 1), 0.05);
        this.cube.material.opacity = 0.9;
        this.cube.material.color.setHex(0xff3030);
    }
    
    updateHandVisualizers() {
        this.handLandmarks.forEach((landmarks, handIndex) => {
            if (handIndex >= this.handVisualizers.length) return;
            
            const handGroup = this.handVisualizers[handIndex];
            handGroup.visible = true;
            
            const keyPoints = [0, 4, 8, 12, 16, 20];
            keyPoints.forEach((pointIndex, idx) => {
                const landmark = landmarks[pointIndex];
                const sphere = handGroup.children[idx];
                
                const x = (landmark.x - 0.5) * 6;
                const y = -(landmark.y - 0.5) * 4;
                const z = -landmark.z * 2;
                
                sphere.position.set(x, y, z);
            });
            
            this.updateHandLines(handGroup, landmarks);
        });
    }
    
    updateHandLines(handGroup, landmarks) {
        const lines = handGroup.userData.lines;
        const connections = [
            [0, 1], [1, 2], [2, 3], [3, 4],
            [0, 5], [5, 6], [6, 7], [7, 8],
            [0, 9], [9, 10], [10, 11], [11, 12],
            [0, 13], [13, 14], [14, 15], [15, 16],
            [0, 17], [17, 18], [18, 19], [19, 20]
        ];
        
        const positions = [];
        connections.forEach(([start, end]) => {
            const startLandmark = landmarks[start];
            const endLandmark = landmarks[end];
            
            positions.push(
                (startLandmark.x - 0.5) * 6,
                -(startLandmark.y - 0.5) * 4,
                -startLandmark.z * 2
            );
            
            positions.push(
                (endLandmark.x - 0.5) * 6,
                -(endLandmark.y - 0.5) * 4,
                -endLandmark.z * 2
            );
        });
        
        lines.geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    }
    
    processNaturalHandGestures() {
        if (!this.handLandmarks || this.handLandmarks.length === 0) {
            this.resetInteractionState();
            return;
        }
        
        // GRAVITÀ DISABILITATA COMPLETAMENTE quando ci sono mani
        this.cubePhysics.enableGravity = false;
        
        if (this.handLandmarks.length === 2) {
            this.processTwoHandGestures();
            return;
        }
        
        if (this.handLandmarks.length === 1) {
            this.processSingleHandGesture();
        }
        
        // Applica fisica solo se non si sta afferrando
        if (!this.interactionState.isGrabbing) {
            this.updateCubePhysics();
        }
        
        this.updateProximityIndicator();
    }
    
    processTwoHandGestures() {
        const hand1 = this.handLandmarks[0];
        const hand2 = this.handLandmarks[1];
        
        const hand1Center = this.getHandCenter(hand1);
        const hand2Center = this.getHandCenter(hand2);
        
        const hand1Distance = hand1Center.distanceTo(this.cube.position);
        const hand2Distance = hand2Center.distanceTo(this.cube.position);
        
        // DISTANZE AUMENTATE per due mani
        const bothHandsNear = hand1Distance < 1.5 && hand2Distance < 1.5;
        
        this.interactionState.bothHandsNear = bothHandsNear;
        
        if (bothHandsNear) {
            const hand1Pinching = this.isPinching(hand1);
            const hand2Pinching = this.isPinching(hand2);
            
            if (hand1Pinching && hand2Pinching) {
                this.gestureState = 'two_hand_scale_rotate';
                this.handleTwoHandScaleRotate(hand1Center, hand2Center);
            } else {
                this.gestureState = 'two_hands_near';
                this.cube.material.color.setHex(0xffaa00);
                this.cube.scale.lerp(new THREE.Vector3(1.1, 1.1, 1.1), 0.1);
            }
        } else {
            this.gestureState = 'two_hands_far';
            this.resetCubeAppearance();
        }
    }
    
    processSingleHandGesture() {
        const hand = this.handLandmarks[0];
        const handCenter = this.getHandCenter(hand);
        const distance = handCenter.distanceTo(this.cube.position);
        
        if (distance < this.interactionState.grabDistance) {
            this.interactionState.isNearCube = true;
            
            if (this.isGrabbing(hand)) {
                this.gestureState = 'grab';
                if (!this.interactionState.isGrabbing) {
                    this.startGrabbing({ landmarks: hand, center: handCenter, distance });
                } else {
                    this.handleActiveGrab({ landmarks: hand, center: handCenter, distance });
                }
            } else {
                this.gestureState = 'point';
                this.handlePointGesture({ center: handCenter });
            }
        } else if (distance < this.interactionState.hoverDistance) {
            this.interactionState.isNearCube = true;
            this.gestureState = 'hover';
            this.cube.material.opacity = 0.95;
            this.cube.scale.lerp(new THREE.Vector3(1.05, 1.05, 1.05), 0.1);
        } else {
            this.interactionState.isNearCube = false;
            this.gestureState = 'none';
            this.resetCubeAppearance();
        }
    }
    
    getHandCenter(landmarks) {
        const wrist = landmarks[0];
        return new THREE.Vector3(
            (wrist.x - 0.5) * 6,
            -(wrist.y - 0.5) * 4,
            -wrist.z * 2
        );
    }
    
    isPinching(landmarks) {
        const thumb = landmarks[4];
        const index = landmarks[8];
        const distance = this.calculateDistance(thumb, index);
        return distance < 0.04;
    }
    
    isGrabbing(landmarks) {
        const fingerTips = [8, 12, 16, 20];
        const fingerBases = [6, 10, 14, 18];
        
        let closedCount = 0;
        fingerTips.forEach((tip, i) => {
            const base = fingerBases[i];
            if (landmarks[tip].y > landmarks[base].y) {
                closedCount++;
            }
        });
        
        return closedCount >= 3;
    }
    
    startGrabbing(handData) {
        this.interactionState.isGrabbing = true;
        this.interactionState.grabHand = handData;
        
        this.interactionState.grabOffset.copy(this.cube.position).sub(handData.center);
        this.interactionState.lastGrabPosition.copy(handData.center);
        
        this.cube.scale.setScalar(0.85);
        this.cube.material.opacity = 0.7;
        
        this.cubePhysics.velocity.set(0, 0, 0);
        this.cubePhysics.angularVelocity.set(0, 0, 0);
    }
    
    handleActiveGrab(handData) {
        const targetPosition = handData.center.clone().add(this.interactionState.grabOffset);
        this.cube.position.lerp(targetPosition, 0.4); // AUMENTATO per responsività
        
        const velocity = handData.center.clone().sub(this.interactionState.lastGrabPosition);
        this.cubePhysics.velocity.copy(velocity.multiplyScalar(0.15)); // AUMENTATO
        
        this.interactionState.lastGrabPosition.copy(handData.center);
        
        // MIGLIORATO: Rotazione più fluida
        const deltaMovement = velocity.length();
        if (deltaMovement > 0.005) { // RIDOTTA soglia
            // Rotazione basata sul movimento della mano
            const rotationSpeed = Math.min(deltaMovement * 5, 0.2); // LIMITATO
            this.cube.rotation.x += velocity.y * rotationSpeed * 10;
            this.cube.rotation.y += velocity.x * rotationSpeed * 10;
            this.cube.rotation.z += (velocity.x + velocity.y) * rotationSpeed * 5;
        }
    }
    
    handlePointGesture(handData) {
        if (!this.interactionState.isNearCube) return;
        
        const direction = handData.center.clone().sub(this.cube.position).normalize();
        const attraction = direction.multiplyScalar(0.002);
        
        this.cubePhysics.velocity.add(attraction);
        
        this.cube.material.opacity = 0.95;
        this.cube.scale.lerp(new THREE.Vector3(1.05, 1.05, 1.05), 0.1);
    }
    
    handleTwoHandScaleRotate(hand1Center, hand2Center) {
        const distance = hand1Center.distanceTo(hand2Center);
        const scale = Math.max(0.3, Math.min(2.5, distance / 1.5));
        
        this.cube.scale.setScalar(scale);
        
        const center = hand1Center.clone().add(hand2Center).multiplyScalar(0.5);
        this.cube.position.lerp(center, 0.15);
        
        const direction = hand2Center.clone().sub(hand1Center).normalize();
        const rotationY = Math.atan2(direction.x, direction.z);
        const rotationX = Math.atan2(direction.y, Math.sqrt(direction.x * direction.x + direction.z * direction.z));
        
        this.cube.rotation.y = THREE.MathUtils.lerp(this.cube.rotation.y, rotationY, 0.1);
        this.cube.rotation.x = THREE.MathUtils.lerp(this.cube.rotation.x, rotationX, 0.1);
        
        this.cube.material.color.setHSL(0.6, 1, 0.5);
        this.cube.material.opacity = 0.8;
    }
    
    updateProximityIndicator() {
        if (!this.interactionState.isNearCube && !this.interactionState.bothHandsNear) {
            this.proximityIndicator.material.opacity = 0;
            return;
        }
        
        this.proximityIndicator.position.x = this.cube.position.x;
        this.proximityIndicator.position.z = this.cube.position.z;
        this.proximityIndicator.position.y = this.cube.position.y - 0.5;
        
        let color = 0x00ff00;
        let opacity = 0.3;
        
        if (this.gestureState === 'two_hand_scale_rotate') {
            color = 0x0066ff;
            opacity = 0.8;
        } else if (this.interactionState.isGrabbing) {
            color = 0xff0000;
            opacity = 0.6;
        } else if (this.interactionState.bothHandsNear) {
            color = 0xffaa00;
            opacity = 0.5;
        } else if (this.interactionState.isNearCube) {
            color = 0xffff00;
            opacity = 0.4;
        }
        
        this.proximityIndicator.material.color.setHex(color);
        this.proximityIndicator.material.opacity = opacity;
    }
    
    updateCubePhysics() {
        // Proprietà per comportamento naturale - DISTANZE AUMENTATE
        this.handVisualizers = [];
        this.interactionState = {
            isNearCube: false,
            isGrabbing: false,
            grabDistance: 1.2, // AUMENTATA da 0.5 a 1.2
            hoverDistance: 1.8, // AUMENTATA da 0.7 a 1.8
            grabHand: null,
            grabOffset: new THREE.Vector3(),
            lastGrabPosition: new THREE.Vector3(),
            twoHandsRequired: false,
            bothHandsNear: false,
            handsDetected: false
        };
        
        this.cubePhysics = {
            velocity: new THREE.Vector3(),
            angularVelocity: new THREE.Vector3(),
            damping: 0.98, // AUMENTATO per fermare più velocemente
            gravity: -0.001, // RIDOTTA da -0.002 a -0.001
            restPosition: new THREE.Vector3(0, 0, 0),
            isResting: false,
            enableGravity: false // Gravità disabilitata di default
        };
        
        // Applica la gravità solo se abilitata
        if (this.cubePhysics.enableGravity) {
            this.cubePhysics.velocity.y += this.cubePhysics.gravity;
        }
        
        this.cube.position.add(this.cubePhysics.velocity);
        this.cube.rotation.x += this.cubePhysics.angularVelocity.x;
        this.cube.rotation.y += this.cubePhysics.angularVelocity.y;
        this.cube.rotation.z += this.cubePhysics.angularVelocity.z;
        
        this.cubePhysics.velocity.multiplyScalar(this.cubePhysics.damping);
        this.cubePhysics.angularVelocity.multiplyScalar(this.cubePhysics.damping);
        
        // Collisione con il pavimento solo se la gravità è abilitata
        if (this.cubePhysics.enableGravity && this.cube.position.y < -1.5) {
            this.cube.position.y = -1.5;
            this.cubePhysics.velocity.y *= -0.6;
            this.cubePhysics.angularVelocity.multiplyScalar(0.8);
        }
        
        if (!this.interactionState.isNearCube) {
            this.resetCubeAppearance();
        }
    }
    
    calculateDistance(point1, point2) {
        return Math.sqrt(
            Math.pow(point1.x - point2.x, 2) + 
            Math.pow(point1.y - point2.y, 2) + 
            Math.pow(point1.z - point2.z, 2)
        );
    }
    
    getGestureDescription() {
        switch (this.gestureState) {
            case 'grab': return this.interactionState.isGrabbing ? '✊ Afferrando' : '✊ Pronto ad afferrare';
            case 'two_hand_scale_rotate': return '🤏🤏 Ridimensiona/Ruota';
            case 'two_hands_near': return '👐 Due mani vicine - pizzica per modificare';
            case 'two_hands_far': return '👐 Due mani - avvicinati al cubo';
            case 'point': return '👉 Puntando';
            case 'hover': return '✋ In zona hover';
            default: return '✋ In attesa';
        }
    }
    
    getProximityInfo() {
        if (this.gestureState === 'two_hand_scale_rotate') {
            return '🔵 Controllo a due mani';
        } else if (this.interactionState.isGrabbing) {
            return '🔴 Afferrato';
        } else if (this.interactionState.bothHandsNear) {
            return '🟠 Due mani vicine';
        } else if (this.interactionState.isNearCube) {
            return '🟡 Vicino';
        } else {
            return '🟢 Lontano';
        }
    }
    
    async switchCamera() {
        try {
            const newFacing = this.currentCameraFacing === 'environment' ? 'user' : 'environment';
            await this.initializeCamera(newFacing);
            this.currentCameraFacing = newFacing;
            
            const cameraBtn = document.getElementById('cameraBtn');
            if (cameraBtn) {
                cameraBtn.textContent = this.currentCameraFacing === 'environment' ? '📷 Camera Frontale' : '📷 Camera Posteriore';
            }
            
            console.log(`✅ Camera cambiata a: ${this.currentCameraFacing}`);
        } catch (error) {
            console.error('❌ Errore nel cambio camera:', error);
            alert('Impossibile cambiare camera');
        }
    }
    
    setupEventListeners() {
        document.getElementById('cardboardBtn').addEventListener('click', () => {
            this.toggleCardboardMode();
        });
        
        const cameraBtn = document.getElementById('cameraBtn');
        if (cameraBtn) {
            cameraBtn.addEventListener('click', () => {
                this.switchCamera();
            });
        }
        
        window.addEventListener('resize', () => {
            this.onWindowResize();
        });
        
        window.addEventListener('deviceorientation', (event) => {
            this.handleDeviceOrientation(event);
        });
    }
    
    toggleCardboardMode() {
        this.isCardboardMode = !this.isCardboardMode;
        
        if (this.isCardboardMode) {
            this.enableCardboardMode();
            document.getElementById('cardboardBtn').textContent = '📱 Esci da Cardboard';
        } else {
            this.disableCardboardMode();
            document.getElementById('cardboardBtn').textContent = '📱 Modalità Cardboard';
        }
    }
    
    enableCardboardMode() {
        this.cameraL = this.camera.clone();
        this.cameraL.position.x -= 0.032;
        
        this.cameraR = this.camera.clone();
        this.cameraR.position.x += 0.032;
        
        // Imposta il rendering per vista stereoscopica
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setScissorTest(true);
        this.renderer.autoClear = false; // AGGIUNTO per controllo manuale del clear
        
        // Fullscreen e orientamento
        if (document.documentElement.requestFullscreen) {
            document.documentElement.requestFullscreen();
        }
        
        if (screen.orientation && screen.orientation.lock) {
            screen.orientation.lock('landscape');
        }
        
        // Ottimizzazioni mobile
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    }
    
    disableCardboardMode() {
        this.renderer.setScissorTest(false);
        this.renderer.autoClear = true; // RIPRISTINA il clear automatico
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        
        if (document.exitFullscreen) {
            document.exitFullscreen();
        }
    }
    
    handleDeviceOrientation(event) {
        // MIGLIORATO: Orientamento limitato per stabilità AR
        if (!this.camera || this.isCardboardMode) return;
        
        const alpha = event.alpha ? THREE.MathUtils.degToRad(event.alpha) : 0;
        const beta = event.beta ? THREE.MathUtils.degToRad(event.beta) : 0;
        const gamma = event.gamma ? THREE.MathUtils.degToRad(event.gamma) : 0;
        
        // Applica rotazione limitata per stabilità
        const dampingFactor = 0.1;
        this.camera.rotation.x = THREE.MathUtils.lerp(this.camera.rotation.x, beta * 0.5, dampingFactor);
        this.camera.rotation.y = THREE.MathUtils.lerp(this.camera.rotation.y, alpha * 0.3, dampingFactor);
        this.camera.rotation.z = THREE.MathUtils.lerp(this.camera.rotation.z, -gamma * 0.2, dampingFactor);
    }
    
    // FUNZIONE MANCANTE - AGGIUNTA
    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        
        // Aggiorna anche le camere Cardboard se esistono
        if (this.cameraL && this.cameraR) {
            this.cameraL.aspect = window.innerWidth / window.innerHeight;
            this.cameraL.updateProjectionMatrix();
            this.cameraR.aspect = window.innerWidth / window.innerHeight;
            this.cameraR.updateProjectionMatrix();
        }
    }
    
    // FUNZIONE MANCANTE - AGGIUNTA
    animate() {
        requestAnimationFrame(() => this.animate());
        
        if (this.isCardboardMode) {
            this.renderCardboard();
        } else {
            this.renderNormal();
        }
    }
    
    // FUNZIONE MANCANTE - AGGIUNTA
    renderNormal() {
        this.renderer.render(this.scene, this.camera);
    }
    
    renderCardboard() {
        const width = window.innerWidth / 2;
        const height = window.innerHeight;
        
        // Clear manuale per entrambi gli occhi
        this.renderer.clear();
        
        // Occhio sinistro
        this.renderer.setScissor(0, 0, width, height);
        this.renderer.setViewport(0, 0, width, height);
        this.renderer.render(this.scene, this.cameraL);
        
        // Occhio destro
        this.renderer.setScissor(width, 0, width, height);
        this.renderer.setViewport(width, 0, width, height);
        this.renderer.render(this.scene, this.cameraR);
        
        // Reset viewport per il prossimo frame
        this.renderer.setViewport(0, 0, window.innerWidth, window.innerHeight);
    }
}

window.addEventListener('DOMContentLoaded', () => {
    new ARCardboardApp();
});