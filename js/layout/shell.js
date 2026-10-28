import { html, icon, logoMark } from '../core/dom.js';
import { seasonLabel, state, setSeason, yearOptions } from '../core/store.js';
import { formatCountdownShort, meetingTitle, shortSessionLabel } from '../core/format.js';
import { toast } from '../core/overlay.js';
import { errorText } from '../core/page.js';
import {
  dismissInstall,
  installAvailable,
  installDismissed,
  isStandalone,
  promptInstall,
  subscribeInstall,
} from '../core/install.js';

const NAV_ITEMS = [
  { path: '/dashboard', label: 'Dashboard', icon: 'grid' },
  { path: '/standings', label: 'Classifiche', icon: 'trophy' },
  { path: '/results', label: 'Risultati', icon: 'flag' },
  { path: '/laps', label: 'Tempi sul giro', icon: 'timer', short: 'Giri' },
  { path: '/drivers', label: 'Piloti', icon: 'users' },
  { path: '/schedule', label: 'Calendario', icon: 'calendar', short: 'Calendario' },
  { path: '/live', label: 'Live', icon: 'radio', badge: 'LIVE' },
];

const MOBILE_NAV = ['/dashboard', '/standings', '/results', '/laps', '/drivers', '/schedule'];

function navLink(item) {
  return html`<a class="nav__link" href="#${item.path}" data-nav="${item.path}">
    ${icon(item.icon)}
    <span>${item.label}</span>
    ${item.badge ? html`<span class="nav__badge" data-nav-badge hidden>${item.badge}</span>` : null}
  </a>`;
}

function bottomLink(item) {
  return html`<a class="bottom-nav__link" href="#${item.path}" data-nav="${item.path}">
    ${icon(item.icon)}
    <span>${item.short || item.label}</span>
  </a>`;
}

export function createShell({ mount, onReload }) {
  mount.innerHTML = html`<div class="shell">
    <aside class="sidebar">
      <a class="brand" href="#/dashboard" aria-label="APEX, vai alla dashboard">
        <span class="brand__mark">${logoMark()}</span>
        <span class="brand__text"><span class="brand__name">APEX</span><span class="brand__sub">F1 STATS</span></span>
      </a>
      <div class="season-control">
        <label for="season-desktop">Stagione</label>
        <select class="select" id="season-desktop" data-season></select>
      </div>
      <nav class="nav" aria-label="Navigazione principale">
        ${NAV_ITEMS.map(navLink)}
      </nav>
      <div class="sidebar__spacer"></div>
      <div class="sidebar-card" data-install-card>
        <button class="sidebar-card__dismiss" type="button" data-install-dismiss aria-label="Chiudi suggerimento">${icon('x')}</button>
        <span class="sidebar-card__icon">${icon('download')}</span>
        <h3>Installa APEX</h3>
        <p>Classifiche, risultati e tempi sul giro sempre con te. Anche offline.</p>
        <button class="btn btn--primary btn--sm" type="button" data-install>${icon('download')} Installa app</button>
      </div>
      <div class="sidebar-foot">
        <span>Dati <a href="https://openf1.org" target="_blank" rel="noopener noreferrer">OpenF1</a></span>
        <span>v1.2</span>
      </div>
    </aside>

    <div class="main-wrap">
      <div class="offline-banner">${icon('wifiOff')} Sei offline: mostro i dati salvati sul dispositivo.</div>
      <header class="topbar">
        <div class="topbar__context">
          <a class="topbar__mobile-brand" href="#/dashboard" aria-label="APEX, vai alla dashboard">${logoMark()} APEX</a>
          <span class="topbar__label" data-topbar-label>Formula 1 · ${seasonLabel()}</span>
          <span class="topbar__dot"></span>
          <span class="topbar__status" data-topbar-status>Dati OpenF1</span>
        </div>
        <div class="topbar__actions">
          <select class="select select--sm season-mobile" data-season aria-label="Seleziona stagione"></select>
          <a class="live-pill" href="#/live" data-live-pill>
            <span class="live-pill__dot"></span>
            <span data-live-text>Live</span>
            <span class="live-pill__short" data-live-short>—</span>
          </a>
          <button class="btn btn--icon btn--ghost topbar-refresh" type="button" data-refresh aria-label="Aggiorna i dati" title="Aggiorna i dati">
            ${icon('refresh')}
          </button>
          <button class="btn btn--ghost btn--install" type="button" data-install aria-label="Installa APEX">
            ${icon('download')}<span>Installa</span>
          </button>
        </div>
      </header>
      <main id="main" class="main" tabindex="-1"></main>
      <footer class="page-footer">
        <span>APEX · progetto non ufficiale, non affiliato alla Formula 1. Dati aperti <a href="https://openf1.org" target="_blank" rel="noopener noreferrer">OpenF1</a>.</span>
        <span>Aggiornamento automatico · installabile su mobile</span>
      </footer>
    </div>

    <nav class="bottom-nav" aria-label="Navigazione mobile">
      ${MOBILE_NAV.map((path) => bottomLink(NAV_ITEMS.find((item) => item.path === path)))}
    </nav>
  </div>`;

  const outlet = mount.querySelector('#main');
  const seasonSelects = [...mount.querySelectorAll('[data-season]')];
  const topbarLabel = mount.querySelector('[data-topbar-label]');
  const statusLabel = mount.querySelector('[data-topbar-status]');
  const livePill = mount.querySelector('[data-live-pill]');
  const liveText = mount.querySelector('[data-live-text]');
  const liveShort = mount.querySelector('[data-live-short]');
  const navBadge = mount.querySelector('[data-nav-badge]');
  const refreshButton = mount.querySelector('[data-refresh]');
  const installCard = mount.querySelector('[data-install-card]');
  const installButtons = [...mount.querySelectorAll('[data-install]')];
  const installDismiss = mount.querySelector('[data-install-dismiss]');
  let busy = false;

  function renderOptions() {
    const years = yearOptions();
    seasonSelects.forEach((select) => {
      select.innerHTML = years
        .map((year) => `<option value="${year}" ${year === state.year ? 'selected' : ''}>${year}</option>`)
        .join('');
    });
  }

  function refreshInstallUi() {
    const hidden = isStandalone();
    installButtons.forEach((button) => {
      button.hidden = hidden;
    });
    if (installCard) {
      installCard.hidden = hidden || installDismissed() || !installAvailable();
      installCard.style.display = installCard.hidden ? 'none' : '';
    }
  }

  function updateContext() {
    const catalog = state.catalog;
    topbarLabel.textContent = `Formula 1 · ${seasonLabel()}`;
    renderOptions();
    if (navBadge) navBadge.hidden = !catalog?.liveSession;

    if (!catalog) {
      statusLabel.textContent = 'Dati OpenF1';
      if (liveShort) liveShort.textContent = '—';
      refreshInstallUi();
      return;
    }

    const completed = catalog.completedCount;
    const total = catalog.totalRounds;
    statusLabel.textContent = catalog.liveSession
      ? `Sessione in corso · ${shortSessionLabel(catalog.liveSession.session_name)}`
      : `${completed} di ${total} gare concluse · ${catalog.latestCompleted ? meetingTitle(catalog.latestCompleted) : 'stagione'}`;
    statusLabel.classList.toggle('is-live', Boolean(catalog.liveSession));

    if (catalog.liveSession) {
      livePill.classList.add('is-live');
      liveText.textContent = `LIVE · ${shortSessionLabel(catalog.liveSession.session_name)}`;
      if (liveShort) liveShort.textContent = 'LIVE';
    } else if (catalog.nextRace) {
      livePill.classList.remove('is-live');
      const countdown = formatCountdownShort(catalog.nextRace.race?.date_start);
      liveText.innerHTML = `${meetingTitle(catalog.nextRace)} <span class="live-pill__time">· ${countdown}</span>`;
      if (liveShort) liveShort.textContent = countdown;
    } else {
      livePill.classList.remove('is-live');
      liveText.textContent = 'Stagione conclusa';
      if (liveShort) liveShort.textContent = 'Fine';
    }

    refreshInstallUi();
  }

  async function changeSeason(value) {
    const year = Number(value);
    if (busy || !Number.isInteger(year) || year === state.year) {
      updateContext();
      return;
    }

    busy = true;
    seasonSelects.forEach((select) => {
      select.disabled = true;
    });
    const toastHandle = toast(`Caricamento stagione ${year}…`, { duration: 0 });

    try {
      await setSeason(year);
      updateContext();
      await onReload?.();
      toastHandle.close();
      toast(`${seasonLabel()} caricata.`);
    } catch (error) {
      toastHandle.close();
      toast(`Stagione ${year} non disponibile: ${errorText(error)}`);
      updateContext();
    } finally {
      busy = false;
      seasonSelects.forEach((select) => {
        select.disabled = false;
      });
    }
  }

  seasonSelects.forEach((select) => {
    select.addEventListener('change', (event) => changeSeason(event.target.value));
  });

  refreshButton?.addEventListener('click', async () => {
    if (busy) return;
    busy = true;
    refreshButton.classList.add('is-loading');
    refreshButton.disabled = true;
    try {
      if (!state.catalog) {
        const { retrySeason } = await import('../core/store.js');
        await retrySeason();
      }
      const { invalidateLive } = await import('../core/api.js');
      invalidateLive();
      updateContext();
      await onReload?.();
      toast('Dati aggiornati.');
    } catch (error) {
      toast(errorText(error));
    } finally {
      busy = false;
      refreshButton.classList.remove('is-loading');
      refreshButton.disabled = false;
    }
  });

  installButtons.forEach((button) => {
    button.addEventListener('click', () => promptInstall());
  });
  installDismiss?.addEventListener('click', () => {
    dismissInstall();
    refreshInstallUi();
  });

  const unsubscribeInstall = subscribeInstall(refreshInstallUi);

  function setActive(path) {
    const links = [...mount.querySelectorAll('[data-nav]')];
    links.forEach((link) => {
      const target = link.dataset.nav;
      const active = path === target || (target !== '/dashboard' && path.startsWith(`${target}/`));
      link.classList.toggle('is-active', active);
      if (active) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
  }

  renderOptions();
  updateContext();
  refreshInstallUi();

  const contextTimer = setInterval(updateContext, 60_000);

  return {
    outlet,
    setActive,
    updateContext,
    destroy() {
      clearInterval(contextTimer);
      unsubscribeInstall();
    },
  };
}
