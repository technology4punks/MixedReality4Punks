# AR Cardboard - Mixed Reality Web Application

Una web application mobile all'avanguardia che offre un'esperienza di mixed reality utilizzando Google Cardboard. L'applicazione combina realtà aumentata, tracciamento delle mani e visione stereoscopica per creare un'esperienza immersiva accessibile direttamente dal browser mobile.

## 🚀 Caratteristiche Principali

- **Realtà Aumentata**: Utilizza WebXR API per AR immersiva
- **Tracciamento Mani**: Riconoscimento gesti tramite MediaPipe Hands
- **Visione Stereoscopica**: Supporto completo per Google Cardboard
- **Interazione 3D**: Manipolazione oggetti virtuali con gesti delle mani
- **Performance Ottimizzate**: Progettata per dispositivi mobile mid-range
- **Zero Installazioni**: Funziona completamente da browser

## 🛠️ Tecnologie Utilizzate

- **Three.js** - Rendering 3D e gestione scena
- **WebXR API** - Supporto realtà aumentata
- **MediaPipe Hands** - Tracciamento mani via camera
- **WebGL** - Rendering hardware-accelerated
- **Shader personalizzati** - Effetti distorsione Cardboard

## 📱 Requisiti di Sistema

### Browser Supportati
- Chrome Mobile 79+
- Firefox Mobile 70+
- Safari Mobile 13+ (supporto limitato)
- Samsung Internet 10+

### Hardware Minimo
- Smartphone con giroscopio e accelerometro
- Camera posteriore
- RAM: 3GB+
- GPU: Adreno 530+ / Mali-G71+ / A10+

### Accessori
- Google Cardboard o visore VR compatibile
- Cuffie (opzionale, per audio immersivo)

## 🚀 Avvio Rapido

### 1. Setup Locale

```bash
# Clona o scarica il progetto
cd "AR SMARTPHONE"

# Avvia server locale (Python)
python3 -m http.server 8000

# Oppure con Node.js
npx serve .

# Oppure con PHP
php -S localhost:8000
```

### 2. Accesso da Mobile

1. Connetti smartphone alla stessa rete del computer
2. Trova l'IP del computer: `ipconfig` (Windows) o `ifconfig` (Mac/Linux)
3. Apri browser mobile e vai a: `http://[IP_COMPUTER]:8000`
4. Esempio: `http://192.168.1.100:8000`

### 3. Utilizzo dell'App

1. **Avvia AR**: Tocca "Avvia AR" e concedi permessi camera
2. **Test Interazione**: Muovi le mani davanti alla camera
3. **Modalità Cardboard**: Tocca "Modalità Cardboard" e inserisci phone nel visore
4. **Interazione**: Usa gesti per manipolare il cubo rosso

## 🎮 Gesti Supportati

### Manipolazione Oggetti
- **Pugno Chiuso** 👊: Afferra e muovi il cubo rosso
- **Mano Aperta** ✋: Rilascia l'oggetto
- **Pizzico (2 mani)** 🤏: Scala il cubo (avvicina/allontana le mani)

### Controlli Aggiuntivi
- **Reset Scena**: Riporta il cubo alla posizione iniziale
- **Toggle Cardboard**: Attiva/disattiva visione stereoscopica

## 🔧 Configurazione Avanzata

### Calibrazione Cardboard

L'app si calibra automaticamente in base al dispositivo, ma puoi personalizzare:

```javascript
// In console browser (modalità sviluppatore)
window.arApp.cardboard.setEyeSeparation(0.065); // Distanza occhi (m)
window.arApp.cardboard.setDistortion(0.12);     // Distorsione lenti
window.arApp.cardboard.setAberration(0.025);    // Aberrazione cromatica
```

### Performance Tuning

```javascript
// Riduce qualità per performance migliori
window.arApp.handTracker.updateConfig({
    modelComplexity: 0,           // 0=lite, 1=full
    minDetectionConfidence: 0.6,  // Soglia detection
    maxNumHands: 1                // Max mani rilevate
});
```

## 🐛 Risoluzione Problemi

### Camera Non Funziona
- Verifica permessi camera nel browser
- Assicurati di usare HTTPS o localhost
- Riavvia browser e riprova

### Performance Scarse
- Chiudi altre app in background
- Riduci luminosità schermo
- Usa modalità "Performance" se disponibile
- Verifica connessione di rete stabile

### Tracciamento Mani Impreciso
- Migliora illuminazione ambiente
- Mantieni mani ben visibili alla camera
- Evita sfondi complessi o in movimento
- Pulisci lente camera

### Cardboard Non Funziona
- Verifica orientamento landscape
- Controlla che il visore sia calibrato
- Assicurati che lo schermo sia centrato
- Prova calibrazione manuale

## 📁 Struttura Progetto

```
AR SMARTPHONE/
├── index.html              # Pagina principale
├── README.md              # Questa documentazione
└── js/
    ├── app.js             # Controller principale
    ├── handTracking.js    # Gestione MediaPipe Hands
    ├── arScene.js         # Scena 3D e interazioni
    └── cardboard.js       # Effetto stereoscopico
```

## 🔒 Privacy e Sicurezza

- **Camera**: Usata solo per tracciamento mani, nessun dato salvato
- **Sensori**: Giroscopio/accelerometro per orientamento
- **Rete**: Nessun dato inviato a server esterni
- **Storage**: Nessun dato persistente salvato

## 🚀 Sviluppo Futuro

### Funzionalità Pianificate
- [ ] Più oggetti interattivi
- [ ] Riconoscimento gesti avanzati
- [ ] Multiplayer locale
- [ ] Effetti audio spaziali
- [ ] Supporto WebXR nativo
- [ ] Modalità AR passthrough

### Contributi
Contributi benvenuti! Aree di interesse:
- Ottimizzazioni performance
- Nuovi gesti e interazioni
- Supporto dispositivi aggiuntivi
- Miglioramenti UI/UX

## 📄 Licenza

MIT License - Vedi file LICENSE per dettagli

## 🆘 Supporto

Per problemi o domande:
1. Controlla la sezione "Risoluzione Problemi"
2. Verifica compatibilità browser/dispositivo
3. Testa con dispositivo diverso se possibile

---

**Nota**: Questa è una demo tecnologica. Per uso in produzione, considera ottimizzazioni aggiuntive e test estensivi su vari dispositivi.

**Buona esperienza AR! 🥽✨**