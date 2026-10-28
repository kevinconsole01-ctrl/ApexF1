import { toast } from './overlay.js';

export function initNetworkStatus() {
  const update = () => {
    document.body.classList.toggle('is-offline', !navigator.onLine);
  };
  window.addEventListener('online', () => {
    update();
    toast('Connessione ripristinata.');
  });
  window.addEventListener('offline', update);
  update();
}

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;

  const start = async () => {
    try {
      const registration = await navigator.serviceWorker.register('./sw.js', { scope: './' });
      let reloading = false;

      const offerUpdate = (worker) => {
        toast('Nuova versione di APEX disponibile.', {
          actionLabel: 'Aggiorna',
          duration: 0,
          onAction: () => {
            reloading = true;
            worker.postMessage({ type: 'SKIP_WAITING' });
          },
        });
      };

      registration.addEventListener('updatefound', () => {
        const worker = registration.installing;
        if (!worker) return;
        worker.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) offerUpdate(worker);
        });
      });

      if (registration.waiting && navigator.serviceWorker.controller) {
        offerUpdate(registration.waiting);
      }

      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (reloading) window.location.reload();
      });

      setInterval(() => registration.update().catch(() => {}), 30 * 60 * 1000);
    } catch (error) {
      console.warn('Service worker non registrato:', error);
    }
  };

  if (document.readyState === 'complete') start();
  else window.addEventListener('load', start, { once: true });
}
