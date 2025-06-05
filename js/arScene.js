class ARScene {
    constructor(renderer) {
        this.renderer = renderer;
        this.scene = null;
        this.camera = null;
        this.cube = null;
        this.lights = [];
        
        // Stato interazione
        this.isGrabbing = false;
        this.grabbingHand = null;
        this.grabOffset = new THREE.Vector3();
        this.initialCubeScale = 1;
        this.pinchStartDistance = 0;
        
        // Configurazione cubo
        this.cubeConfig = {
            size: 0.2,
            color: 0xff0000,
            position: { x: 0, y: 0, z: -1 },
            metalness: 0.3,
            roughness: 0.4
        };
        
        // Limiti movimento cubo
        this.bounds = {
            x: { min: -2, max: 2 },
            y: { min: -1, max: 2 },
            z: { min: -3, max: -0.5 }
        };
        
        // Performance tracking
        this.lastUpdateTime = 0;
        this.updateInterval = 16; // ~60fps
    }
    
    async init() {
        try {
            this.createScene();
            this.createCamera();
            this.createLights();
            this.createCube();
            this.createEnvironment();
            
            console.log('ARScene inizializzata');
            
        } catch (error) {
            console.error('Errore inizializzazione ARScene:', error);
            throw error;
        }
    }
    
    createScene() {
        this.scene = new THREE.Scene();
        
        // Background trasparente per AR
        this.scene.background = null;
        
        // Fog per profondità
        this.scene.fog = new THREE.Fog(0x000000, 1, 10);
    }
    
    createCamera() {
        this.camera = new THREE.PerspectiveCamera(
            75, // FOV
            window.innerWidth / window.innerHeight,
            0.01, // Near
            100   // Far
        );
        
        this.camera.position.set(0, 0, 0);
        this.camera.lookAt(0, 0, -1);
    }
    
    createLights() {
        // Luce ambientale
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);
        this.lights.push(ambientLight);
        
        // Luce direzionale principale
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(1, 1, 0.5);
        directionalLight.castShadow = true;
        
        // Configurazione ombre
        directionalLight.shadow.mapSize.width = 1024;
        directionalLight.shadow.mapSize.height = 1024;
        directionalLight.shadow.camera.near = 0.1;
        directionalLight.shadow.camera.far = 10;
        directionalLight.shadow.camera.left = -2;
        directionalLight.shadow.camera.right = 2;
        directionalLight.shadow.camera.top = 2;
        directionalLight.shadow.camera.bottom = -2;
        
        this.scene.add(directionalLight);
        this.lights.push(directionalLight);
        
        // Luce di riempimento
        const fillLight = new THREE.DirectionalLight(0x4488ff, 0.3);
        fillLight.position.set(-1, 0.5, 1);
        this.scene.add(fillLight);
        this.lights.push(fillLight);
    }
    
    createCube() {
        // Geometria cubo
        const geometry = new THREE.BoxGeometry(
            this.cubeConfig.size,
            this.cubeConfig.size,
            this.cubeConfig.size
        );
        
        // Materiale PBR per realismo
        const material = new THREE.MeshStandardMaterial({
            color: this.cubeConfig.color,
            metalness: this.cubeConfig.metalness,
            roughness: this.cubeConfig.roughness,
            transparent: false
        });
        
        // Crea mesh
        this.cube = new THREE.Mesh(geometry, material);
        this.cube.position.set(
            this.cubeConfig.position.x,
            this.cubeConfig.position.y,
            this.cubeConfig.position.z
        );
        
        this.cube.castShadow = true;
        this.cube.receiveShadow = true;
        
        // Aggiungi proprietà per interazione
        this.cube.userData = {
            isInteractable: true,
            originalPosition: this.cube.position.clone(),
            originalScale: this.cube.scale.clone()
        };
        
        this.scene.add(this.cube);
        
        console.log('Cubo rosso creato');
    }
    
    createEnvironment() {
        // Piano di supporto invisibile per ombre
        const planeGeometry = new THREE.PlaneGeometry(4, 4);
        const planeMaterial = new THREE.ShadowMaterial({ opacity: 0.3 });
        const plane = new THREE.Mesh(planeGeometry, planeMaterial);
        
        plane.rotation.x = -Math.PI / 2;
        plane.position.y = -0.5;
        plane.receiveShadow = true;
        
        this.scene.add(plane);
        
        // Griglia di riferimento (opzionale, per debug)
        if (false) { // Disabilitata per produzione
            const gridHelper = new THREE.GridHelper(2, 10, 0x444444, 0x444444);
            gridHelper.position.y = -0.5;
            this.scene.add(gridHelper);
        }
    }
    
    updateHandInteraction(handResults) {
        const currentTime = performance.now();
        if (currentTime - this.lastUpdateTime < this.updateInterval) {
            return; // Throttle per performance
        }
        this.lastUpdateTime = currentTime;
        
        if (!handResults.gestures || handResults.gestures.length === 0) {
            this.releaseGrab();
            return;
        }
        
        // Trova gesti di grab e pinch
        const grabGestures = handResults.gestures.filter(g => g.type === 'grab');
        const pinchGestures = handResults.gestures.filter(g => g.type === 'pinch');
        
        // Gestisci grab (movimento cubo)
        if (grabGestures.length > 0) {
            this.handleGrabGesture(grabGestures[0], handResults);
        } else {
            this.releaseGrab();
        }
        
        // Gestisci pinch (scala cubo)
        if (pinchGestures.length > 0) {
            this.handlePinchGesture(pinchGestures, handResults);
        }
    }
    
    handleGrabGesture(grabGesture, handResults) {
        const handPosition = this.getHandWorldPosition(grabGesture.position);
        
        if (!this.isGrabbing) {
            // Inizia grab se mano è vicina al cubo
            const distance = handPosition.distanceTo(this.cube.position);
            if (distance < 0.3) {
                this.startGrab(grabGesture.hand, handPosition);
            }
        } else if (this.grabbingHand === grabGesture.hand) {
            // Continua movimento
            this.updateGrab(handPosition);
        }
    }
    
    startGrab(hand, handPosition) {
        this.isGrabbing = true;
        this.grabbingHand = hand;
        this.grabOffset.copy(this.cube.position).sub(handPosition);
        
        // Feedback visivo
        this.cube.material.emissive.setHex(0x330000);
        
        console.log(`Grab iniziato con mano ${hand}`);
    }
    
    updateGrab(handPosition) {
        if (!this.isGrabbing) return;
        
        // Calcola nuova posizione
        const newPosition = handPosition.clone().add(this.grabOffset);
        
        // Applica limiti
        newPosition.x = Math.max(this.bounds.x.min, Math.min(this.bounds.x.max, newPosition.x));
        newPosition.y = Math.max(this.bounds.y.min, Math.min(this.bounds.y.max, newPosition.y));
        newPosition.z = Math.max(this.bounds.z.min, Math.min(this.bounds.z.max, newPosition.z));
        
        // Aggiorna posizione cubo
        this.cube.position.copy(newPosition);
    }
    
    releaseGrab() {
        if (this.isGrabbing) {
            this.isGrabbing = false;
            this.grabbingHand = null;
            
            // Rimuovi feedback visivo
            this.cube.material.emissive.setHex(0x000000);
            
            console.log('Grab rilasciato');
        }
    }
    
    handlePinchGesture(pinchGestures, handResults) {
        if (pinchGestures.length >= 2) {
            // Pinch con due mani - scala cubo
            const hand1Pos = this.getHandWorldPosition(pinchGestures[0].position);
            const hand2Pos = this.getHandWorldPosition(pinchGestures[1].position);
            const distance = hand1Pos.distanceTo(hand2Pos);
            
            if (this.pinchStartDistance === 0) {
                this.pinchStartDistance = distance;
                this.initialCubeScale = this.cube.scale.x;
            }
            
            // Calcola scala basata su distanza mani
            const scaleRatio = distance / this.pinchStartDistance;
            const newScale = Math.max(0.5, Math.min(3, this.initialCubeScale * scaleRatio));
            
            this.cube.scale.setScalar(newScale);
            
            // Feedback visivo
            this.cube.material.emissive.setHex(0x001133);
            
        } else {
            // Reset pinch
            this.pinchStartDistance = 0;
            if (!this.isGrabbing) {
                this.cube.material.emissive.setHex(0x000000);
            }
        }
    }
    
    getHandWorldPosition(normalizedPos) {
        // Converte posizione normalizzata in coordinate mondo
        const vector = new THREE.Vector3(
            (normalizedPos.x - 0.5) * 4, // Scala X
            -(normalizedPos.y - 0.5) * 3, // Scala Y (invertita)
            -1.5 // Profondità fissa
        );
        
        return vector;
    }
    
    update() {
        // Animazione idle del cubo
        if (!this.isGrabbing) {
            const time = Date.now() * 0.001;
            this.cube.rotation.x = Math.sin(time * 0.5) * 0.1;
            this.cube.rotation.y += 0.005;
        }
        
        // Aggiorna luci se necessario
        this.updateLights();
    }
    
    updateLights() {
        // Aggiorna posizione luci basata su camera (opzionale)
        if (this.lights.length > 1) {
            const mainLight = this.lights[1]; // Luce direzionale
            // Mantieni luce relativa alla camera
            // mainLight.position.copy(this.camera.position).add(new THREE.Vector3(1, 1, 1));
        }
    }
    
    reset() {
        // Reset posizione cubo
        this.cube.position.copy(this.cube.userData.originalPosition);
        this.cube.scale.copy(this.cube.userData.originalScale);
        this.cube.rotation.set(0, 0, 0);
        
        // Reset stato interazione
        this.releaseGrab();
        this.pinchStartDistance = 0;
        
        // Reset materiale
        this.cube.material.emissive.setHex(0x000000);
        
        console.log('Scena AR resettata');
    }
    
    // Metodi di utilità
    getCubePosition() {
        return this.cube.position.clone();
    }
    
    setCubeColor(color) {
        this.cube.material.color.setHex(color);
    }
    
    addObject(object) {
        this.scene.add(object);
    }
    
    removeObject(object) {
        this.scene.remove(object);
    }
    
    // Gestione resize
    onWindowResize(width, height) {
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
    }
}