# AR Mobile Cardboard Experience

Una web application mobile all'avanguardia che offre un'esperienza di realtà aumentata (AR) accessibile da browser su smartphone, con supporto per visori Google Cardboard e riconoscimento delle mani.

## 🚀 Caratteristiche Principali

- **Realtà Aumentata Mobile**: Esperienza AR completa accessibile da qualsiasi browser mobile
- **Supporto Google Cardboard**: Modalità stereoscopica per visori VR economici
- **Riconoscimento Mani**: Tracciamento delle mani tramite MediaPipe per interazioni naturali
- **Cubo Interattivo**: Oggetto 3D manipolabile con gesti delle mani
- **Performance Ottimizzate**: Funziona su dispositivi mid-range Android e iOS
- **Responsive Design**: Interfaccia adattiva per diverse dimensioni di schermo

## 🛠️ Tecnologie Utilizzate

- **Three.js**: Rendering 3D e gestione della scena
- **MediaPipe Hands**: Riconoscimento e tracciamento delle mani
- **WebGL**: Accelerazione hardware per rendering 3D
- **WebRTC**: Accesso alla fotocamera del dispositivo
- **CSS3**: Animazioni e layout responsive
- **JavaScript ES6+**: Logica dell'applicazione

## 📱 Compatibilità

### Browser Supportati
- **Android**: Chrome 80+, Firefox 75+, Samsung Internet 12+
- **iOS**: Safari 13+, Chrome 80+, Firefox 75+

### Requisiti Hardware
- Fotocamera posteriore
- Accelerometro e giroscopio (per Cardboard)
- WebGL supportato
- Almeno 2GB di RAM

## 🎮 Come Utilizzare

### Modalità Normale
1. Apri `index.html` nel browser del tuo smartphone
2. Concedi i permessi per l'accesso alla fotocamera
3. Punta la fotocamera verso l'ambiente circostante
4. Muovi la mano davanti alla fotocamera per vedere il cubo rosso
5. Usa gesti di pinch (pollice e indice) per scalare il cubo
6. Muovi la mano per ruotare il cubo

### Modalità Cardboard
1. Tocca il pulsante "📱 Cardboard" in basso a destra
2. Inserisci lo smartphone nel visore Google Cardboard
3. L'app passerà automaticamente in modalità fullscreen e orientamento landscape
4. Goditi l'esperienza AR stereoscopica immersiva

## 🎯 Gesti Supportati

- **Pinch (Pollice + Indice)**: Scala il cubo rosso
- **Movimento della Mano**: Ruota il cubo lungo gli assi X e Y
- **Presenza della Mano**: Ferma l'animazione automatica del cubo

## 📁 Struttura del Progetto

```
AR SMARTPHONE/
├── index.html              # Pagina principale
├── css/
│   └── mobile-ar.css      # Stili ottimizzati per mobile
├── js/
│   ├── ar-app.js          # Logica principale dell'app AR
│   └── mobile-utils.js    # Utilità per ottimizzazione mobile
└── README.md              # Documentazione
```

## ⚙️ Configurazione

### Parametri Personalizzabili

Nel file `js/ar-app.js` puoi modificare:

```javascript
// Soglia per rilevamento pinch
this.pinchThreshold = 0.05;

// Scala minima e massima del cubo
this.cubeScale = Math.max(0.5, Math.min(3, this.cubeScale));

// Velocità di rotazione automatica
this.cube.rotation.x += 0.01;
this.cube.rotation.y += 0.01;
```

### Ottimizzazioni Performance

L'app include ottimizzazioni automatiche:
- Riduzione automatica della qualità rendering se FPS < 20
- Configurazione camera ottimizzata per dispositivo
- Prevenzione standby del dispositivo
- Gestione memoria efficiente

## 🔧 Risoluzione Problemi

### Problemi Comuni

**La fotocamera non si attiva**
- Verifica i permessi del browser per la fotocamera
- Assicurati di utilizzare HTTPS (richiesto per WebRTC)
- Ricarica la pagina e concedi nuovamente i permessi

**Performance scarse**
- Chiudi altre app in background
- Riduci la luminosità dello schermo
- L'app si ottimizza automaticamente riducendo la qualità

**Il riconoscimento mani non funziona**
- Assicurati di avere buona illuminazione
- Mantieni la mano a 30-60cm dalla fotocamera
- Evita sfondi troppo complessi

**Modalità Cardboard non funziona**
- Verifica che il dispositivo supporti l'orientamento landscape
- Alcuni browser potrebbero bloccare il fullscreen automatico
- Attiva manualmente il fullscreen se necessario

## 🚀 Deployment

### Server Locale
```bash
# Con Python 3
python -m http.server 8000

# Con Node.js
npx serve .

# Con PHP
php -S localhost:8000
```

### Hosting Web
- Carica tutti i file su un server web con supporto HTTPS
- Assicurati che i file CSS e JS siano accessibili
- Testa su diversi dispositivi mobili

## 📊 Monitoraggio Performance

L'app include un sistema di monitoraggio integrato che mostra:
- **FPS**: Frame per secondo in tempo reale
- **Mani Rilevate**: Numero di mani attualmente tracciate
- **Stato**: Stato corrente dell'applicazione
- **Modalità**: Normale o Cardboard

## 🔮 Sviluppi Futuri

- [ ] Supporto per più oggetti 3D
- [ ] Gesti aggiuntivi (rotazione con due mani)
- [ ] Salvataggio configurazioni utente
- [ ] Modalità multiplayer
- [ ] Integrazione con sensori del dispositivo
- [ ] Supporto per modelli 3D personalizzati

## 📄 Licenza

Questo progetto è rilasciato sotto licenza MIT. Vedi il file LICENSE per i dettagli.

## 🤝 Contributi

I contributi sono benvenuti! Per contribuire:
1. Fai un fork del progetto
2. Crea un branch per la tua feature
3. Committa le tue modifiche
4. Pusha il branch
5. Apri una Pull Request

## 📞 Supporto

Per supporto tecnico o domande:
- Apri un issue su GitHub
- Controlla la sezione "Risoluzione Problemi"
- Verifica la compatibilità del tuo dispositivo

---

**Nota**: Questa applicazione richiede HTTPS per funzionare correttamente a causa delle restrizioni di sicurezza dei browser moderni per l'accesso alla fotocamera.