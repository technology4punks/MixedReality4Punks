/**
 * Utilità per ottimizzazione mobile e compatibilità cross-browser
 */

class MobileUtils {
    static detectDevice() {
        const userAgent = navigator.userAgent;
        return {
            isIOS: /iPad|iPhone|iPod/.test(userAgent),
            isAndroid: /Android/.test(userAgent),
            isMobile: /Mobi|Android/i.test(userAgent),
            isTablet: /iPad|Android(?!.*Mobile)/.test(userAgent),
            hasGyroscope: 'DeviceOrientationEvent' in window,
            hasAccelerometer: 'DeviceMotionEvent' in window,
            supportsWebGL: this.checkWebGLSupport(),
            supportsWebRTC: this.checkWebRTCSupport()
        };
    }
    
    static checkWebGLSupport() {
        try {
            const canvas = document.createElement('canvas');
            return !!(window.WebGLRenderingContext && 
                     (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
        } catch (e) {
            return false;
        }
    }
    
    static checkWebRTCSupport() {
        return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    }
    
    static optimizeForDevice() {
        const device = this.detectDevice();
        
        // Ottimizzazioni specifiche per iOS
        if (device.isIOS) {
            // Prevenire zoom su double-tap
            document.addEventListener('touchstart', function(e) {
                if (e.touches.length > 1) {
                    e.preventDefault();
                }
            }, { passive: false });
            
            let lastTouchEnd = 0;
            document.addEventListener('touchend', function(e) {
                const now = (new Date()).getTime();
                if (now - lastTouchEnd <= 300) {
                    e.preventDefault();
                }
                lastTouchEnd = now;
            }, false);
        }
        
        // Ottimizzazioni per Android
        if (device.isAndroid) {
            // Gestione orientamento
            window.addEventListener('orientationchange', () => {
                setTimeout(() => {
                    window.scrollTo(0, 1);
                }, 100);
            });
        }
        
        return device;
    }
    
    static requestFullscreen(element = document.documentElement) {
        if (element.requestFullscreen) {
            return element.requestFullscreen();
        } else if (element.webkitRequestFullscreen) {
            return element.webkitRequestFullscreen();
        } else if (element.mozRequestFullScreen) {
            return element.mozRequestFullScreen();
        } else if (element.msRequestFullscreen) {
            return element.msRequestFullscreen();
        }
        return Promise.reject('Fullscreen not supported');
    }
    
    static exitFullscreen() {
        if (document.exitFullscreen) {
            return document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
            return document.webkitExitFullscreen();
        } else if (document.mozCancelFullScreen) {
            return document.mozCancelFullScreen();
        } else if (document.msExitFullscreen) {
            return document.msExitFullscreen();
        }
        return Promise.reject('Exit fullscreen not supported');
    }
    
    static lockOrientation(orientation = 'landscape') {
        if (screen.orientation && screen.orientation.lock) {
            return screen.orientation.lock(orientation);
        } else if (screen.lockOrientation) {
            return screen.lockOrientation(orientation);
        } else if (screen.webkitLockOrientation) {
            return screen.webkitLockOrientation(orientation);
        } else if (screen.mozLockOrientation) {
            return screen.mozLockOrientation(orientation);
        }
        return Promise.reject('Orientation lock not supported');
    }
    
    static unlockOrientation() {
        if (screen.orientation && screen.orientation.unlock) {
            return screen.orientation.unlock();
        } else if (screen.unlockOrientation) {
            return screen.unlockOrientation();
        } else if (screen.webkitUnlockOrientation) {
            return screen.webkitUnlockOrientation();
        } else if (screen.mozUnlockOrientation) {
            return screen.mozUnlockOrientation();
        }
        return Promise.reject('Orientation unlock not supported');
    }
    
    static preventSleep() {
        // Prevenire standby del dispositivo
        if ('wakeLock' in navigator) {
            return navigator.wakeLock.request('screen');
        }
        
        // Fallback: video invisibile per mantenere attivo lo schermo
        const video = document.createElement('video');
        video.setAttribute('muted', '');
        video.setAttribute('playsinline', '');
        video.style.position = 'absolute';
        video.style.top = '-1px';
        video.style.left = '-1px';
        video.style.width = '1px';
        video.style.height = '1px';
        video.style.opacity = '0';
        
        // Crea un canvas con un singolo pixel
        const canvas = document.createElement('canvas');
        canvas.width = 1;
        canvas.height = 1;
        const ctx = canvas.getContext('2d');
        ctx.fillRect(0, 0, 1, 1);
        
        video.srcObject = canvas.captureStream(1);
        document.body.appendChild(video);
        
        return video.play().then(() => video);
    }
    
    static getOptimalCameraConstraints() {
        const device = this.detectDevice();
        
        let constraints = {
            video: {
                facingMode: 'environment',
                width: { ideal: 1280, max: 1920 },
                height: { ideal: 720, max: 1080 },
                frameRate: { ideal: 30, max: 60 }
            }
        };
        
        // Ottimizzazioni per dispositivi meno potenti
        if (device.isAndroid) {
            constraints.video.width = { ideal: 960, max: 1280 };
            constraints.video.height = { ideal: 540, max: 720 };
            constraints.video.frameRate = { ideal: 24, max: 30 };
        }
        
        return constraints;
    }
    
    static measurePerformance() {
        const startTime = performance.now();
        let frameCount = 0;
        let lastTime = startTime;
        
        return {
            start: () => {
                frameCount = 0;
                lastTime = performance.now();
            },
            
            frame: () => {
                frameCount++;
                const currentTime = performance.now();
                const deltaTime = currentTime - lastTime;
                
                if (deltaTime >= 1000) {
                    const fps = Math.round((frameCount * 1000) / deltaTime);
                    frameCount = 0;
                    lastTime = currentTime;
                    return fps;
                }
                return null;
            },
            
            memory: () => {
                if (performance.memory) {
                    return {
                        used: Math.round(performance.memory.usedJSHeapSize / 1048576),
                        total: Math.round(performance.memory.totalJSHeapSize / 1048576),
                        limit: Math.round(performance.memory.jsHeapSizeLimit / 1048576)
                    };
                }
                return null;
            }
        };
    }
    
    static vibrate(pattern = [100]) {
        if ('vibrate' in navigator) {
            navigator.vibrate(pattern);
        }
    }
    
    static showNotification(title, options = {}) {
        if ('Notification' in window && Notification.permission === 'granted') {
            return new Notification(title, {
                icon: '/icon-192.png',
                badge: '/icon-72.png',
                ...options
            });
        }
        return null;
    }
    
    static requestNotificationPermission() {
        if ('Notification' in window && Notification.permission === 'default') {
            return Notification.requestPermission();
        }
        return Promise.resolve(Notification.permission);
    }
    
    static addToHomeScreen() {
        // Gestione PWA install prompt
        if (window.deferredPrompt) {
            window.deferredPrompt.prompt();
            return window.deferredPrompt.userChoice;
        }
        return Promise.reject('Install prompt not available');
    }
    
    static getDeviceMotion() {
        return new Promise((resolve, reject) => {
            if ('DeviceMotionEvent' in window) {
                const handleMotion = (event) => {
                    window.removeEventListener('devicemotion', handleMotion);
                    resolve({
                        acceleration: event.acceleration,
                        accelerationIncludingGravity: event.accelerationIncludingGravity,
                        rotationRate: event.rotationRate,
                        interval: event.interval
                    });
                };
                
                window.addEventListener('devicemotion', handleMotion);
                
                // Timeout dopo 5 secondi
                setTimeout(() => {
                    window.removeEventListener('devicemotion', handleMotion);
                    reject('Device motion timeout');
                }, 5000);
            } else {
                reject('Device motion not supported');
            }
        });
    }
    
    static getDeviceOrientation() {
        return new Promise((resolve, reject) => {
            if ('DeviceOrientationEvent' in window) {
                const handleOrientation = (event) => {
                    window.removeEventListener('deviceorientation', handleOrientation);
                    resolve({
                        alpha: event.alpha,
                        beta: event.beta,
                        gamma: event.gamma,
                        absolute: event.absolute
                    });
                };
                
                window.addEventListener('deviceorientation', handleOrientation);
                
                // Timeout dopo 5 secondi
                setTimeout(() => {
                    window.removeEventListener('deviceorientation', handleOrientation);
                    reject('Device orientation timeout');
                }, 5000);
            } else {
                reject('Device orientation not supported');
            }
        });
    }
}

// Esporta per uso globale
window.MobileUtils = MobileUtils;