# APEX · F1 Stats

Dashboard non ufficiale di Formula 1, responsive e installabile come app (PWA). Mostra classifiche piloti e costruttori, risultati dei Gran Premi, tempi sul giro, calendario e live timing usando i dati aperti di [OpenF1](https://openf1.org).

## Funzionalità

- **Dashboard** con prossimo GP (o sessione live), conto alla rovescia, leader del campionato, ultimi Gran Premi e giri più veloci.
- **Classifiche** piloti e costruttori con punti, distacco, variazione di posizione e andamento nelle ultime gare.
- **Risultati** per Gran Premio e sessione: podio, classifica completa, griglia, punti, meteo, messaggi della direzione gara e giro più veloce.
- **Tempi sul giro** sessione per sessione: confronto tra piloti, migliori settori, velocità di punta e tabella giro per giro.
- **Piloti** con griglia filtrabile per nome/numero/team e profilo dettagliato con risultati recenti, trend e compagno di squadra.
- **Calendario** con avanzamento della stagione, weekend Sprint, eventi annullati, test e dettaglio delle sessioni.
- **Live** con aggiornamento automatico ogni 15 secondi di posizioni, intervalli, gomme, meteo e race control.
- **PWA**: manifest, service worker, icona maskable, funzionamento offline con i dati già caricati e prompt di installazione.

## Stack

Nessun build step e nessuna dipendenza npm: solo HTML, CSS e JavaScript ES modules con Web Components nativi.

```
.
├── index.html                 # entry point + boot screen
├── manifest.webmanifest       # metadati PWA
├── sw.js                      # service worker (shell + cache API)
├── serve.py                   # server statico locale, solo stdlib
├── css/
│   ├── tokens.css             # design token e tema
│   ├── base.css               # reset, tipografia, utilità
│   ├── layout.css             # shell, sidebar, topbar, responsive
│   ├── components.css         # card, tabelle, grafici, componenti UI
│   └── pages.css              # layout delle singole pagine
├── icons/                     # favicon, icone PWA e apple-touch
└── js/
    ├── main.js                # boot, rotte, service worker
    ├── config.js              # endpoint e costanti
    ├── core/                  # API, store, router, formattazione, DOM
    ├── data/                  # adapter OpenF1 (stagione, classifiche, giri…)
    ├── components/            # Web Components e componenti riusabili
    ├── layout/shell.js        # sidebar, topbar, navigazione mobile
    └── pages/                 # dashboard, standings, results, laps…
```

## Avvio locale

Serve solo Python 3.9 o superiore:

```bash
python3 serve.py
```

Apri [http://localhost:8000](http://localhost:8000). Per provarla da telefono sulla stessa rete Wi-Fi, usa l'indirizzo mostrato dal server (es. `http://192.168.1.20:8000`).

Opzioni:

```bash
python3 serve.py --port 8080
python3 serve.py --bind 127.0.0.1
python3 serve.py --dir /percorso/della/cartella
```

> Non aprire `index.html` con `file://`: i moduli ES e il service worker richiedono un server HTTP.

## Installazione su mobile

La PWA funziona al meglio se servita in **HTTPS** (o da `localhost`).

- **Android / Chrome**: menu del browser → *Installa app* (oppure il pulsante **Installa** in APEX).
- **iPhone / Safari**: pulsante **Condividi** → *Aggiungi alla schermata Home*.
- **Desktop**: icona di installazione nella barra degli indirizzi di Chrome/Edge, oppure menu → *Installa APEX*.

In locale via HTTP l'installazione può essere bloccata dal browser: per la prova completa pubblica il progetto su un host HTTPS.

## Pubblicazione

Il progetto è statico: basta caricare la cartella su Netlify, Vercel, GitHub Pages, Cloudflare Pages o qualsiasi hosting statico. Non servono redirect particolari perché il router usa l'hash (`#/dashboard`, `#/standings`, …), quindi funziona anche in una sottocartella.

Se usi GitHub Pages, pubblica la radice del repository (o la cartella che contiene `index.html`).

## Dati e limite di richieste

I dati arrivano da `https://api.openf1.org/v1`. L'API consente circa **3 richieste al secondo** (in pratica il limite è più severo): il client (`js/core/api.js`) mette in coda le chiamate con un intervallo di 550 ms, deduplica le richieste identiche, riprova in caso di `429` con un cooldown globale e usa cache in memoria + `localStorage`.

Le stagioni disponibili partono dal 2023. La stagione predefinita è quella corrente; se non ci sono ancora dati, l'app ripiega automaticamente sull'anno precedente.

## Note sul service worker

- `sw.js` mette in cache la shell (HTML, CSS, JS, icone) e i dati OpenF1 già scaricati.
- Dopo una modifica importante ad asset o logica, incrementa `VERSION` in `sw.js` per invalidare le cache precedenti.
- In sviluppo `serve.py` invia `Cache-Control: no-store` per evitare file obsoleti.
- Alla prima visita il service worker si installa; quando è disponibile una nuova versione compare un toast con **Aggiorna**.

## Personalizzazione

- Colori, raggi e tipografia: `css/tokens.css`.
- Velocità di aggiornamento live: `LIVE_POLL_MS` in `js/config.js`.
- Anni disponibili: `SEASON_MIN` in `js/config.js`.
- Testi italiani e nomi dei GP: `js/core/format.js`.
- Colori squadra di fallback: `js/data/drivers.js`.

## Disclaimer

Progetto non ufficiale, non affiliato a Formula 1, FIA o alle scuderie. I dati sono forniti da OpenF1 e restano dei rispettivi proprietari. Le immagini dei piloti sono caricate dai CDN ufficiali e possono non essere disponibili.
