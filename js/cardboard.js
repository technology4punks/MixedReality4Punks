class CardboardEffect {
    constructor(renderer) {
        this.renderer = renderer;
        this.enabled = false;
        
        // Configurazione stereoscopica
        this.eyeSeparation = 0.064; // 64mm - distanza media tra gli occhi
        this.focalLength = 0.5;     // Lunghezza focale
        this.screenDistance = 0.1;  // Distanza schermo
        
        // Cameras per occhi sinistro e destro
        this.cameraL = new THREE.PerspectiveCamera();
        this.cameraR = new THREE.PerspectiveCamera();
        
        // Render targets per ogni occhio
        this.renderTargetL = null;
        this.renderTargetR = null;
        
        // Materiali e geometrie per compositing
        this.scene2D = new THREE.Scene();
        this.camera2D = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        
        // Shader per distorsione barrel (correzione lenti Cardboard)
        this.distortionShader = {
            uniforms: {
                'textureL': { value: null },
                'textureR': { value: null },
                'distortion': { value: 0.1 },
                'aberration': { value: 0.02 }
            },
            vertexShader: `
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform sampler2D textureL;
                uniform sampler2D textureR;
                uniform float distortion;
                uniform float aberration;
                varying vec2 vUv;
                
                vec2 distort(vec2 uv, float k) {
                    vec2 center = vec2(0.5, 0.5);
                    vec2 delta = uv - center;
                    float r2 = dot(delta, delta);
                    float factor = 1.0 + k * r2;
                    return center + delta * factor;
                }
                
                void main() {
                    vec2 uv = vUv;
                    vec4 color;
                    
                    if (uv.x < 0.5) {
                        // Occhio sinistro
                        vec2 leftUV = vec2(uv.x * 2.0, uv.y);
                        vec2 distortedUV = distort(leftUV, distortion);
                        
                        if (distortedUV.x >= 0.0 && distortedUV.x <= 1.0 && 
                            distortedUV.y >= 0.0 && distortedUV.y <= 1.0) {
                            
                            // Aberrazione cromatica
                            float r = texture2D(textureL, distort(leftUV, distortion + aberration)).r;
                            float g = texture2D(textureL, distort(leftUV, distortion)).g;
                            float b = texture2D(textureL, distort(leftUV, distortion - aberration)).b;
                            color = vec4(r, g, b, 1.0);
                        } else {
                            color = vec4(0.0, 0.0, 0.0, 1.0);
                        }
                    } else {
                        // Occhio destro
                        vec2 rightUV = vec2((uv.x - 0.5) * 2.0, uv.y);
                        vec2 distortedUV = distort(rightUV, distortion);
                        
                        if (distortedUV.x >= 0.0 && distortedUV.x <= 1.0 && 
                            distortedUV.y >= 0.0 && distortedUV.y <= 1.0) {
                            
                            // Aberrazione cromatica
                            float r = texture2D(textureR, distort(rightUV, distortion + aberration)).r;
                            float g = texture2D(textureR, distort(rightUV, distortion)).g;
                            float b = texture2D(textureR, distort(rightUV, distortion - aberration)).b;
                            color = vec4(r, g, b, 1.0);
                        } else {
                            color = vec4(0.0, 0.0, 0.0, 1.0);
                        }
                    }
                    
                    gl_FragColor = color;
                }
            `
        };
        
        this.distortionMaterial = null;
        this.quad = null;
        
        // Configurazione device
        this.deviceConfig = {
            screenWidth: window.innerWidth,
            screenHeight: window.innerHeight,
            screenDPI: window.devicePixelRatio * 160,
            viewerLensDistance: 0.035, // 35mm
            viewerScreenDistance: 0.042, // 42mm
            viewerIPD: 0.064 // 64mm
        };
    }
    
    async init() {
        try {
            this.setupRenderTargets();
            this.setupDistortionMaterial();
            this.setupCompositeQuad();
            this.updateCameras();
            
            console.log('CardboardEffect inizializzato');
            
        } catch (error) {
            console.error('Errore inizializzazione CardboardEffect:', error);
            throw error;
        }
    }
    
    setupRenderTargets() {
        const width = Math.floor(window.innerWidth / 2);
        const height = window.innerHeight;
        
        // Render target per occhio sinistro
        this.renderTargetL = new THREE.WebGLRenderTarget(width, height, {
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter,
            format: THREE.RGBAFormat,
            stencilBuffer: false
        });
        
        // Render target per occhio destro
        this.renderTargetR = new THREE.WebGLRenderTarget(width, height, {
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter,
            format: THREE.RGBAFormat,
            stencilBuffer: false
        });
    }
    
    setupDistortionMaterial() {
        this.distortionMaterial = new THREE.ShaderMaterial(this.distortionShader);
        this.distortionMaterial.uniforms.textureL.value = this.renderTargetL.texture;
        this.distortionMaterial.uniforms.textureR.value = this.renderTargetR.texture;
    }
    
    setupCompositeQuad() {
        const geometry = new THREE.PlaneGeometry(2, 2);
        this.quad = new THREE.Mesh(geometry, this.distortionMaterial);
        this.scene2D.add(this.quad);
    }
    
    updateCameras() {
        const aspect = (window.innerWidth / 2) / window.innerHeight;
        const fov = 75;
        const near = 0.01;
        const far = 100;
        
        // Configura camera sinistra
        this.cameraL.fov = fov;
        this.cameraL.aspect = aspect;
        this.cameraL.near = near;
        this.cameraL.far = far;
        this.cameraL.updateProjectionMatrix();
        
        // Configura camera destra
        this.cameraR.fov = fov;
        this.cameraR.aspect = aspect;
        this.cameraR.near = near;
        this.cameraR.far = far;
        this.cameraR.updateProjectionMatrix();
    }
    
    enable() {
        this.enabled = true;
        
        // Forza orientamento landscape per Cardboard
        if (screen.orientation && screen.orientation.lock) {
            screen.orientation.lock('landscape').catch(e => {
                console.warn('Impossibile bloccare orientamento:', e);
            });
        }
        
        // Entra in fullscreen
        this.enterFullscreen();
        
        console.log('Modalità Cardboard abilitata');
    }
    
    disable() {
        this.enabled = false;
        
        // Sblocca orientamento
        if (screen.orientation && screen.orientation.unlock) {
            screen.orientation.unlock();
        }
        
        // Esci da fullscreen
        this.exitFullscreen();
        
        console.log('Modalità Cardboard disabilitata');
    }
    
    render(scene, camera) {
        if (!this.enabled) {
            this.renderer.render(scene, camera);
            return;
        }
        
        // Aggiorna posizioni cameras stereoscopiche
        this.updateStereoCameras(camera);
        
        // Render occhio sinistro
        this.renderer.setRenderTarget(this.renderTargetL);
        this.renderer.render(scene, this.cameraL);
        
        // Render occhio destro
        this.renderer.setRenderTarget(this.renderTargetR);
        this.renderer.render(scene, this.cameraR);
        
        // Compositing finale con distorsione
        this.renderer.setRenderTarget(null);
        this.renderer.render(this.scene2D, this.camera2D);
    }
    
    updateStereoCameras(baseCamera) {
        // Copia trasformazioni dalla camera base
        this.cameraL.position.copy(baseCamera.position);
        this.cameraR.position.copy(baseCamera.position);
        
        this.cameraL.quaternion.copy(baseCamera.quaternion);
        this.cameraR.quaternion.copy(baseCamera.quaternion);
        
        // Applica separazione oculare
        const eyeOffset = this.eyeSeparation / 2;
        
        // Calcola offset laterale basato su orientamento camera
        const rightVector = new THREE.Vector3(1, 0, 0);
        rightVector.applyQuaternion(baseCamera.quaternion);
        
        // Sposta cameras
        this.cameraL.position.add(rightVector.clone().multiplyScalar(-eyeOffset));
        this.cameraR.position.add(rightVector.clone().multiplyScalar(eyeOffset));
        
        // Aggiorna matrici
        this.cameraL.updateMatrixWorld();
        this.cameraR.updateMatrixWorld();
    }
    
    setSize(width, height) {
        if (!this.enabled) return;
        
        // Aggiorna render targets
        const eyeWidth = Math.floor(width / 2);
        this.renderTargetL.setSize(eyeWidth, height);
        this.renderTargetR.setSize(eyeWidth, height);
        
        // Aggiorna cameras
        this.updateCameras();
        
        // Aggiorna configurazione device
        this.deviceConfig.screenWidth = width;
        this.deviceConfig.screenHeight = height;
    }
    
    enterFullscreen() {
        const element = document.documentElement;
        
        if (element.requestFullscreen) {
            element.requestFullscreen();
        } else if (element.webkitRequestFullscreen) {
            element.webkitRequestFullscreen();
        } else if (element.mozRequestFullScreen) {
            element.mozRequestFullScreen();
        } else if (element.msRequestFullscreen) {
            element.msRequestFullscreen();
        }
    }
    
    exitFullscreen() {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        } else if (document.mozCancelFullScreen) {
            document.mozCancelFullScreen();
        } else if (document.msExitFullscreen) {
            document.msExitFullscreen();
        }
    }
    
    // Calibrazione per diversi dispositivi
    calibrateForDevice(deviceType) {
        const calibrations = {
            'iphone': {
                distortion: 0.12,
                aberration: 0.025,
                eyeSeparation: 0.062
            },
            'android': {
                distortion: 0.10,
                aberration: 0.020,
                eyeSeparation: 0.064
            },
            'default': {
                distortion: 0.10,
                aberration: 0.020,
                eyeSeparation: 0.064
            }
        };
        
        const config = calibrations[deviceType] || calibrations.default;
        
        this.eyeSeparation = config.eyeSeparation;
        if (this.distortionMaterial) {
            this.distortionMaterial.uniforms.distortion.value = config.distortion;
            this.distortionMaterial.uniforms.aberration.value = config.aberration;
        }
        
        console.log(`Calibrato per dispositivo: ${deviceType}`);
    }
    
    // Auto-detect device type
    detectDevice() {
        const userAgent = navigator.userAgent.toLowerCase();
        
        if (userAgent.includes('iphone') || userAgent.includes('ipad')) {
            return 'iphone';
        } else if (userAgent.includes('android')) {
            return 'android';
        }
        
        return 'default';
    }
    
    // Applica calibrazione automatica
    autoCalibrate() {
        const deviceType = this.detectDevice();
        this.calibrateForDevice(deviceType);
    }
    
    // Getters per debug
    getEyeSeparation() {
        return this.eyeSeparation;
    }
    
    getDistortionValue() {
        return this.distortionMaterial ? this.distortionMaterial.uniforms.distortion.value : 0;
    }
    
    // Setters per fine-tuning
    setEyeSeparation(value) {
        this.eyeSeparation = Math.max(0.05, Math.min(0.08, value));
    }
    
    setDistortion(value) {
        if (this.distortionMaterial) {
            this.distortionMaterial.uniforms.distortion.value = Math.max(0, Math.min(0.3, value));
        }
    }
    
    setAberration(value) {
        if (this.distortionMaterial) {
            this.distortionMaterial.uniforms.aberration.value = Math.max(0, Math.min(0.05, value));
        }
    }
}