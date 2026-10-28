import { html } from './dom.js';
import { openModal, toast } from './overlay.js';

const DISMISS_KEY = 'apex:install-dismissed';
const listeners = new Set();
let deferredPrompt = null;

export function isStandalone() {
  return window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

export function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}

export function installDismissed() {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

export function dismissInstall() {
  try {
    localStorage.setItem(DISMISS_KEY, '1');
  } catch {
    /* noop */
  }
  emit();
}

export function canPrompt() {
  return Boolean(deferredPrompt);
}

export function installAvailable() {
  return !isStandalone() && (canPrompt() || isIOS());
}

function emit() {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch {
      /* noop */
    }
  });
}

export function subscribeInstall(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function showInstallHelp() {
  const steps = isIOS()
    ? html`<ol>
        <li>Apri <strong>APEX</strong> in <strong>Safari</strong> su iPhone o iPad.</li>
        <li>Tocca il pulsante <strong>Condividi</strong> nella barra in basso.</li>
        <li>Scorri e seleziona <strong>Aggiungi alla schermata Home</strong>.</li>
        <li>Conferma con <strong>Aggiungi</strong>: l'app comparirà tra le icone e si aprirà a schermo intero.</li>
      </ol>`
    : html`<ol>
        <li>Apri <strong>APEX</strong> in Chrome, Edge o Safari (desktop).</li>
        <li>Tocca l'icona <strong>Installa</strong> nella barra degli indirizzi, oppure il menu del browser.</li>
        <li>Seleziona <strong>Installa app</strong> o <strong>Aggiungi alla schermata Home</strong>.</li>
      </ol>
      <p style="margin-top:12px">L'installazione richiede una connessione <strong>HTTPS</strong> (o localhost).</p>`;

  openModal({
    eyebrow: 'App installabile',
    title: 'Installa APEX sul dispositivo',
    body: html`${steps}
      <p style="margin-top:14px;color:var(--faint);font-size:11px">APEX funziona anche offline con i dati già caricati.</p>`,
    actions: [{ label: 'Ho capito', primary: true }],
  });
}

export async function promptInstall() {
  if (!deferredPrompt) {
    showInstallHelp();
    return 'help';
  }

  deferredPrompt.prompt();
  const choice = await deferredPrompt.userChoice;
  deferredPrompt = null;
  emit();
  if (choice.outcome === 'accepted') {
    toast('APEX installata. La trovi nella schermata Home.');
  }
  return choice.outcome;
}

export function initInstall() {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event;
    emit();
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    emit();
    toast('APEX installata con successo.');
  });
}
