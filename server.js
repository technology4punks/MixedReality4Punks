#!/usr/bin/env node

/**
 * Server di sviluppo locale per AR Mobile Cardboard Experience
 * Supporta HTTPS per WebRTC e Service Workers
 */

const express = require('express');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const compression = require('compression');

const app = express();
const PORT = process.env.PORT || 8443;
const HTTP_PORT = 8080;

// Middleware
app.use(compression());
app.use(express.static('.', {
    maxAge: '1d',
    etag: true,
    lastModified: true
}));

// Headers di sicurezza per PWA e WebRTC
app.use((req, res, next) => {
    // CORS per sviluppo
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    
    // Headers di sicurezza
    res.header('X-Content-Type-Options', 'nosniff');
    res.header('X-Frame-Options', 'DENY');
    res.header('X-XSS-Protection', '1; mode=block');
    
    // Permissions Policy per camera e sensori
    res.header('Permissions-Policy', 'camera=*, microphone=*, accelerometer=*, gyroscope=*, magnetometer=*, fullscreen=*');
    
    // Feature Policy (fallback)
    res.header('Feature-Policy', 'camera *; microphone *; accelerometer *; gyroscope *; magnetometer *; fullscreen *');
    
    // Service Worker
    if (req.url.endsWith('.js') && req.url.includes('sw')) {
        res.header('Service-Worker-Allowed', '/');
        res.header('Cache-Control', 'no-cache');
    }
    
    // Manifest
    if (req.url.endsWith('.json')) {
        res.header('Content-Type', 'application/manifest+json');
    }
    
    next();
});

// Route per la pagina principale
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Route per il manifest
app.get('/manifest.json', (req, res) => {
    res.sendFile(path.join(__dirname, 'manifest.json'));
});

// Route per il service worker
app.get('/sw.js', (req, res) => {
    res.sendFile(path.join(__dirname, 'sw.js'));
});

// Route per informazioni del server
app.get('/api/info', (req, res) => {
    res.json({
        name: 'AR Mobile Cardboard Server',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        https: req.secure,
        userAgent: req.get('User-Agent'),
        ip: req.ip
    });
});

// Gestione errori 404
app.use((req, res) => {
    res.status(404).sendFile(path.join(__dirname, 'index.html'));
});

// Funzione per creare certificati self-signed per sviluppo
function createSelfSignedCert() {
    const selfsigned = require('selfsigned');
    const attrs = [{ name: 'commonName', value: 'localhost' }];
    const pems = selfsigned.generate(attrs, { 
        days: 365,
        keySize: 2048,
        extensions: [{
            name: 'subjectAltName',
            altNames: [
                { type: 2, value: 'localhost' },
                { type: 2, value: '127.0.0.1' },
                { type: 7, ip: '127.0.0.1' },
                { type: 7, ip: '::1' }
            ]
        }]
    });
    
    return {
        key: pems.private,
        cert: pems.cert
    };
}

// Avvio server
function startServer() {
    // Server HTTP (redirect a HTTPS)
    const httpApp = express();
    httpApp.use((req, res) => {
        res.redirect(`https://${req.headers.host.replace(HTTP_PORT, PORT)}${req.url}`);
    });
    
    http.createServer(httpApp).listen(HTTP_PORT, () => {
        console.log(`🌐 HTTP Server running on http://localhost:${HTTP_PORT}`);
        console.log(`   (Redirects to HTTPS)`);
    });
    
    // Server HTTPS
    let httpsOptions;
    
    try {
        // Prova a usare certificati esistenti
        httpsOptions = {
            key: fs.readFileSync('server.key'),
            cert: fs.readFileSync('server.crt')
        };
        console.log('📜 Using existing SSL certificates');
    } catch (error) {
        // Crea certificati self-signed
        console.log('🔐 Creating self-signed certificates for development...');
        try {
            httpsOptions = createSelfSignedCert();
            
            // Salva i certificati per riutilizzo
            fs.writeFileSync('server.key', httpsOptions.key);
            fs.writeFileSync('server.crt', httpsOptions.cert);
            console.log('💾 Certificates saved to server.key and server.crt');
        } catch (certError) {
            console.error('❌ Error creating certificates:', certError.message);
            console.log('📦 Install selfsigned package: npm install selfsigned');
            process.exit(1);
        }
    }
    
    https.createServer(httpsOptions, app).listen(PORT, () => {
        console.log(`\n🚀 AR Mobile Cardboard Server started!`);
        console.log(`📱 HTTPS: https://localhost:${PORT}`);
        console.log(`🌍 Network: https://[your-ip]:${PORT}`);
        console.log(`\n📋 Features enabled:`);
        console.log(`   ✅ HTTPS (required for camera access)`);
        console.log(`   ✅ Service Worker support`);
        console.log(`   ✅ PWA installation`);
        console.log(`   ✅ WebRTC camera access`);
        console.log(`   ✅ Compression enabled`);
        console.log(`\n🔧 Development tips:`);
        console.log(`   • Accept the self-signed certificate warning`);
        console.log(`   • Use Chrome DevTools for debugging`);
        console.log(`   • Test on mobile: connect to your computer's IP`);
        console.log(`   • For production, use real SSL certificates`);
        console.log(`\n⚠️  Note: Camera access requires HTTPS!`);
    });
}

// Gestione errori del server
process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error.message);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

// Gestione chiusura graceful
process.on('SIGINT', () => {
    console.log('\n👋 Shutting down server...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n👋 Shutting down server...');
    process.exit(0);
});

// Avvia il server
if (require.main === module) {
    startServer();
}

module.exports = app;