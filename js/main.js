import { html, icon } from './core/dom.js';
import { errorText } from './core/page.js';
import { toast } from './core/overlay.js';
import { initSeason } from './core/store.js';
import { createRouter } from './core/router.js';
import { onApiFallback } from './core/api.js';
import { initInstall } from './core/install.js';
import { initNetworkStatus, registerServiceWorker } from './core/pwa.js';
import { createShell } from './layout/shell.js';
import './components/table.js';
import './components/chart.js';
import './components/ui.js';
import { dashboardPage } from './pages/dashboard.js';
import { standingsPage } from './pages/standings.js';
import { resultsPage } from './pages/results.js';
import { lapsPage } from './pages/laps.js';
import { driversPage } from './pages/drivers.js';
import { driverPage } from './pages/driver.js';
import { schedulePage } from './pages/schedule.js';
import { livePage } from './pages/live.js';

const ROUTES = [
  { pattern: /^\/dashboard\/?$/, factory: dashboardPage, title: 'Dashboard' },
  { pattern: /^\/standings\/?$/, factory: standingsPage, title: 'Classifiche' },
  { pattern: /^\/results\/?$/, factory: resultsPage, title: 'Risultati' },
  { pattern: /^\/laps\/?$/, factory: lapsPage, title: 'Tempi sul giro' },
  { pattern: /^\/drivers\/?$/, factory: driversPage, title: 'Piloti' },
  { pattern: /^\/drivers\/(\d+)\/?$/, factory: driverPage, title: 'Pilota' },
  { pattern: /^\/schedule\/?$/, factory: schedulePage, title: 'Calendario' },
  { pattern: /^\/live\/?$/, factory: livePage, title: 'Live' },
];

function showBootError(error) {
  const boot = document.getElementById('boot');
  if (!boot) return;
  boot.innerHTML = html`<div class="fatal">
    <h1>Impossibile caricare APEX</h1>
    <p>${errorText(error)}</p>
    <button class="btn btn--primary" type="button" data-retry>${icon('refresh')} Riprova</button>
  </div>`.value;
  boot.querySelector('[data-retry]')?.addEventListener('click', () => window.location.reload());
  document.documentElement.setAttribute('data-boot-error', error?.message || 'unknown');
}

function hideBoot() {
  const boot = document.getElementById('boot');
  if (!boot) return;
  boot.classList.add('is-done');
  window.setTimeout(() => boot.remove(), 600);
}

async function bootApp() {
  initInstall();
  initNetworkStatus();

  const app = document.getElementById('app');
  if (!app) {
    showBootError(new Error('Contenitore applicazione non trovato.'));
    return;
  }

  try {
    await initSeason();
  } catch (error) {
    showBootError(error);
    return;
  }

  app.removeAttribute('aria-busy');

  let router = null;
  const shell = createShell({
    mount: app,
    onReload: async () => {
      router?.render();
      shell.updateContext();
    },
  });

  let fallbackWarned = false;
  onApiFallback(() => {
    if (fallbackWarned) return;
    fallbackWarned = true;
    toast('OpenF1 non risponde: mostro i dati salvati sul dispositivo.');
  });

  router = createRouter({
    outlet: shell.outlet,
    routes: ROUTES,
    onChange: ({ path }) => {
      shell.setActive(path);
      shell.updateContext();
    },
    onError: (error) => {
      console.error(error);
      const outlet = shell.outlet;
      if (outlet) {
        outlet.innerHTML = html`<div class="page">${html`<div class="state state--error">
          <span class="state__icon">${icon('warning')}</span>
          <p class="state__title">Errore di navigazione</p>
          <p class="state__text">${errorText(error)}</p>
          <button class="btn btn--sm" type="button" data-reload>${icon('refresh')} Ricarica</button>
        </div>`}</div>`.value;
        outlet.querySelector('[data-reload]')?.addEventListener('click', () => window.location.reload());
      }
    },
  });

  router.start();
  shell.setActive(window.location.hash.replace(/^#/, '').split('?')[0] || '/dashboard');
  hideBoot();
  document.documentElement.setAttribute('data-boot-ready', '1');
  registerServiceWorker();
}

bootApp().catch((error) => {
  console.error(error);
  showBootError(error);
});
