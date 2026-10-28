import { html, icon } from '../core/dom.js';
import {
  countryFlag,
  countryName,
  formatDate,
  formatDateRange,
  formatTime,
  meetingTitle,
  relativeUpdated,
  sessionLabel,
  shortSessionLabel,
} from '../core/format.js';
import { LIVE_POLL_MS } from '../config.js';
import { state } from '../core/store.js';
import {
  asyncSection,
  cardHead,
  emptyState,
  pageHead,
  podiumNode,
  skeletonRows,
  stateMessage,
  tableNode,
} from '../core/page.js';
import { getLiveSnapshot, getLiveStints } from '../data/live.js';
import { fallbackDriver, getMeetingDrivers } from '../data/drivers.js';
import { getRaceControl, getSessionClassification } from '../data/results.js';
import { driverCell } from '../components/driver.js';
import { positionBadge, tyreBadge, weatherTile } from '../components/race.js';

function weatherMarkup(weather) {
  if (!weather) {
    return html`<p class="muted small">Dati meteo non disponibili.</p>`;
  }
  return html`<div class="weather-grid">
    ${weatherTile('thermometer', weather.air_temperature != null ? `${Math.round(weather.air_temperature)}°` : '—', 'Aria')}
    ${weatherTile('gauge', weather.track_temperature != null ? `${Math.round(weather.track_temperature)}°` : '—', 'Asfalto')}
    ${weatherTile('droplet', weather.humidity != null ? `${Math.round(weather.humidity)}%` : '—', 'Umidità')}
    ${weatherTile('wind', weather.wind_speed != null ? `${Number(weather.wind_speed).toFixed(1)} m/s` : '—', 'Vento')}
    ${weatherTile('rain', weather.rainfall ? 'Sì' : 'No', 'Pioggia')}
    ${weatherTile('activity', weather.pressure != null ? `${Math.round(weather.pressure)} hPa` : '—', 'Pressione')}
  </div>`;
}

function intervalText(value, leader = false) {
  if (value == null) return '—';
  if (typeof value === 'string') return value;
  if (Number(value) === 0) return leader ? 'Leader' : '—';
  return `+${Number(value).toFixed(3)}`;
}

function liveTableConfig(rows) {
  return {
    columns: [
      {
        key: 'position',
        label: 'Pos',
        width: '54px',
        sortable: true,
        sortValue: (row) => row.position ?? 999,
        render: (row) => positionBadge(row.position),
      },
      {
        key: 'driver',
        label: 'Pilota',
        sortable: true,
        sortValue: (row) => row.driver?.last_name || '',
        render: (row) => driverCell(row.driver, { showTeam: false }),
      },
      {
        key: 'team',
        label: 'Team',
        hideSm: true,
        render: (row) => html`<span class="team-name"><span class="dot" style="--team:${row.teamColor}"></span>${row.driver?.team_name || '—'}</span>`,
      },
      {
        key: 'interval',
        label: 'Intervallo',
        align: 'right',
        sortable: true,
        sortValue: (row) => (typeof row.interval === 'number' ? row.interval : 999),
        render: (row) => html`<span class="mono">${intervalText(row.interval)}</span>`,
      },
      {
        key: 'gapToLeader',
        label: 'Dal leader',
        align: 'right',
        hideSm: true,
        sortable: true,
        sortValue: (row) => (typeof row.gapToLeader === 'number' ? row.gapToLeader : 999),
        render: (row) => html`<span class="mono muted">${intervalText(row.gapToLeader, true)}</span>`,
      },
      {
        key: 'tyre',
        label: 'Gomma',
        align: 'center',
        render: (row) => tyreBadge(row.stint?.compound),
      },
    ],
    rows,
    ariaLabel: 'Ordine in pista in tempo reale',
    rowHref: (row) => `#/drivers/${row.driver_number}`,
    dense: true,
    sort: { key: 'position', dir: 'asc' },
    caption: 'Posizioni e distacchi aggiornati automaticamente ogni 15 secondi · OpenF1',
  };
}

function sessionListMarkup(sessions, liveSessionKey) {
  return html`<div class="session-list">
    ${sessions.map((session) => html`<div class="session-row ${session.session_key === liveSessionKey ? 'is-live' : ''}">
      <span class="session-row__time">${formatTime(session.date_start)}</span>
      <span class="session-row__name">${sessionLabel(session.session_name)}</span>
      <span class="session-row__date">${formatDate(session.date_start, { weekday: true })}</span>
      ${session.session_key === liveSessionKey ? html`<span class="badge badge--live">Live</span>` : null}
    </div>`)}
  </div>`;
}

function livePageContent(catalog, meeting, session) {
  const el = document.createElement('div');
  el.className = 'page page-enter';

  el.innerHTML = html`
    ${pageHead({
      eyebrow: `Stagione ${catalog.year} · Diretta`,
      title: 'Live',
      subtitle: `${meetingTitle(meeting)} · ${sessionLabel(session.session_name)}. Posizioni, distacchi e condizioni in pista si aggiornano da soli.`,
      actions: html`<a class="btn" href="#/results?meeting=${meeting.meeting_key}&session=${session.session_key}">${icon('flag')} Risultati</a><a class="btn" href="#/laps?session=${session.session_key}">${icon('timer')} Giri</a>`,
    })}

    <div class="row spread">
      <span class="live-dot">In diretta</span>
      <span class="standings-meta" data-updated>Connessione ai dati OpenF1…</span>
    </div>

    <section class="hero hero--live">
      <span class="hero__flag" aria-hidden="true">${countryFlag(meeting.country_code)}</span>
      <div class="hero__content">
        <div class="hero__eyebrow">
          <span class="badge badge--live">Live</span>
          <span class="eyebrow">${shortSessionLabel(session.session_name)}</span>
        </div>
        <h2 class="hero__title">${meetingTitle(meeting)}</h2>
        <div class="hero__meta">
          <span>${icon('mapPin')} ${meeting.circuit_short_name || meeting.location || '—'}</span>
          <span>${icon('calendar')} ${formatDateRange(meeting.date_start, meeting.date_end)}</span>
          <span>${icon('clock')} Iniziata alle ${formatTime(session.date_start)}</span>
        </div>
        <div class="hero__actions">
          <a class="btn btn--primary" href="#/laps?session=${session.session_key}">${icon('timer')} Tempi sul giro</a>
          <a class="btn" href="#/results?meeting=${meeting.meeting_key}&session=${session.session_key}">${icon('flag')} Classifica</a>
        </div>
      </div>
      <div class="hero__side">
        <div class="hero__side-label"><span>Sessione</span><span>${countryName(meeting.country_name)}</span></div>
        <p style="font-family:var(--font-display);font-size:1.6rem;font-weight:740;letter-spacing:-.02em">${sessionLabel(session.session_name)}</p>
        <p class="hero__note"><strong>${meetingTitle(meeting)}</strong> · aggiornamento automatico ogni 15 secondi. Se chiudi la pagina il live si ferma.</p>
        <a class="card__link" href="#/schedule?meeting=${meeting.meeting_key}">Programma weekend ${icon('chevronRight')}</a>
      </div>
    </section>

    <div class="live-layout">
      <section class="card card--flush">
        ${cardHead({
          title: 'Ordine in pista',
          sub: 'Posizioni, intervalli e gomme',
          action: html`<span class="live-dot">Live</span>`,
        })}
        <div data-slot="live-table" style="padding:0 20px 20px">${skeletonRows(8)}</div>
      </section>

      <aside class="live-side">
        <section class="card">
          ${cardHead({ title: 'Meteo', sub: 'Condizioni attuali', iconName: 'thermometer' })}
          <div data-slot="live-weather">${weatherMarkup(null)}</div>
        </section>

        <section class="card">
          ${cardHead({ title: 'Sessione', sub: 'Programma del weekend', iconName: 'calendar' })}
          ${sessionListMarkup(meeting.sessions, session.session_key)}
        </section>

        <section class="card">
          ${cardHead({ title: 'Direzione gara', sub: 'Ultimi messaggi', iconName: 'radio' })}
          <div data-slot="live-rc">${skeletonRows(4)}</div>
        </section>
      </aside>
    </div>
  `;

  const tableSlot = el.querySelector('[data-slot="live-table"]');
  const weatherSlot = el.querySelector('[data-slot="live-weather"]');
  const updatedSlot = el.querySelector('[data-updated]');
  let tableEl = null;
  let disposed = false;
  let timer = null;

  const renderRows = (rows, fetchedAt) => {
    if (!rows.length) {
      tableSlot.innerHTML = html`${stateMessage({
        title: 'In attesa dei dati',
        text: 'La sessione è in corso ma OpenF1 non ha ancora pubblicato le posizioni. Riproveremo tra pochi secondi.',
        iconName: 'radio',
      })}`.value;
      tableEl = null;
      return;
    }
    if (!tableEl) {
      tableEl = tableNode(liveTableConfig(rows));
      tableSlot.replaceChildren(tableEl);
    } else {
      tableEl.config = liveTableConfig(rows);
    }
    if (updatedSlot) updatedSlot.textContent = `Aggiornato ${relativeUpdated(fetchedAt)} · ${rows.length} piloti in pista`;
  };

  const tick = async () => {
    if (disposed) return;
    if (document.visibilityState === 'visible') {
      try {
        const [snapshot, driverMap, stints] = await Promise.all([
          getLiveSnapshot(session.session_key),
          getMeetingDrivers(meeting.meeting_key),
          getLiveStints(session.session_key),
        ]);
        if (disposed) return;

        const rows = snapshot.rows
          .map((row) => {
            const driver = driverMap.get(Number(row.driver_number)) || fallbackDriver(row.driver_number);
            return {
              ...row,
              driver,
              teamColor: driver.team_colour ? `#${driver.team_colour}` : '#9aa3b2',
              stint: stints.get(Number(row.driver_number)) || null,
            };
          })
          .sort((a, b) => (a.position ?? 99) - (b.position ?? 99));

        renderRows(rows, snapshot.fetchedAt);
        if (weatherSlot) weatherSlot.innerHTML = weatherMarkup(snapshot.weather).value;
      } catch (error) {
        if (disposed) return;
        tableSlot.innerHTML = html`${stateMessage({
          title: 'Live momentaneamente non disponibile',
          text: error?.code === 'rate-limit' ? 'OpenF1 ha raggiunto il limite di richieste. Riproveremo automaticamente.' : 'Impossibile aggiornare i dati live. Riproveremo tra pochi secondi.',
          iconName: 'warning',
          action: true,
        })}`.value;
        tableSlot.querySelector('[data-retry]')?.addEventListener('click', () => {
          if (timer) clearTimeout(timer);
          tick();
        });
        if (updatedSlot) updatedSlot.textContent = 'Aggiornamento in pausa';
      }
    }
    if (!disposed) timer = setTimeout(tick, LIVE_POLL_MS);
  };

  const onVisibility = () => {
    if (document.visibilityState === 'visible' && !disposed) {
      if (timer) clearTimeout(timer);
      tick();
    }
  };

  document.addEventListener('visibilitychange', onVisibility);
  tick();

  const rcDispose = asyncSection(
    el.querySelector('[data-slot="live-rc"]'),
    () => getRaceControl(session.session_key, 7),
    (rows) => {
      if (!rows.length) return emptyState('Nessun messaggio', 'La direzione gara non ha ancora pubblicato comunicazioni.', 'radio');
      return html`<div class="rc-feed">
        ${rows.map((row) => html`<div class="rc-item">
          <span class="rc-item__lap">${row.lap_number ? `G${row.lap_number}` : '—'}</span>
          <div>
            <p class="rc-item__message">${row.message || 'Comunicazione direzione gara'}</p>
            <div class="rc-item__meta">
              ${row.category ? html`<span class="badge">${row.category}</span>` : null}
              ${row.flag ? html`<span class="badge badge--warning">${row.flag}</span>` : null}
              <span>${formatTime(row.date)}</span>
            </div>
          </div>
        </div>`)}
      </div>`;
    },
    { skeleton: skeletonRows(4) },
  );

  return {
    el,
    destroy() {
      disposed = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibility);
      rcDispose();
    },
  };
}

function offlinePageContent(catalog) {
  const el = document.createElement('div');
  el.className = 'page page-enter';
  const next = catalog.nextRace;
  const nextSession = next?.race || next?.firstSession || catalog.nextSession;
  const last = catalog.latestCompleted;

  el.innerHTML = html`
    ${pageHead({
      eyebrow: `Stagione ${catalog.year} · Diretta`,
      title: 'Live',
      subtitle: 'Nessuna sessione in corso. Qui troverai il live timing non appena i piloti scenderanno in pista.',
      actions: html`<a class="btn" href="#/schedule">${icon('calendar')} Calendario</a><a class="btn" href="#/results">${icon('flag')} Risultati</a>`,
    })}

    ${next
      ? html`<section class="hero">
          <span class="hero__flag" aria-hidden="true">${countryFlag(next.country_code)}</span>
          <div class="hero__content">
            <div class="hero__eyebrow">
              <span class="badge badge--accent">Prossimo evento</span>
              <span class="eyebrow">${nextSession ? sessionLabel(nextSession.session_name) : 'Gran Premio'}</span>
            </div>
            <h2 class="hero__title">${meetingTitle(next)}</h2>
            <div class="hero__meta">
              <span>${icon('mapPin')} ${next.circuit_short_name || next.location || '—'}</span>
              <span>${icon('calendar')} ${formatDateRange(next.date_start, next.date_end)}</span>
              ${nextSession ? html`<span>${icon('clock')} ${formatTime(nextSession.date_start)}</span>` : null}
            </div>
            <div class="hero__actions">
              <a class="btn btn--primary" href="#/schedule?meeting=${next.meeting_key}">${icon('calendar')} Dettagli weekend</a>
              <a class="btn" href="#/standings">${icon('trophy')} Classifiche</a>
            </div>
          </div>
          <div class="hero__side">
            <div class="hero__side-label"><span>Al via tra</span><span>${countryName(next.country_name)}</span></div>
            <f1-countdown end="${nextSession?.date_start || next.date_start}"></f1-countdown>
            <p class="hero__note">Il live si attiva automaticamente durante le sessioni. Torna qui quando il semaforo diventa verde.</p>
          </div>
        </section>`
      : emptyState('Stagione conclusa', 'Non ci sono altre sessioni in programma. Consulta i risultati dell\'ultimo Gran Premio.', 'flag')}

    <div class="live-layout">
      <section class="card">
        ${cardHead({ title: 'Ultimo Gran Premio', sub: last ? meetingTitle(last) : 'Nessun GP completato', href: last ? `#/results?meeting=${last.meeting_key}` : '#/results', linkLabel: 'Risultati', iconName: 'flag' })}
        <div data-slot="last-podium">${last ? skeletonRows(4) : emptyState('Nessun risultato', 'La stagione non è ancora iniziata.', 'flag')}</div>
      </section>

      <aside class="live-side">
        <section class="card">
          ${cardHead({ title: 'Prossime sessioni', sub: 'I prossimi appuntamenti in pista', iconName: 'calendar' })}
          ${next
            ? sessionListMarkup(catalog.upcomingRaces.flatMap((meeting) => meeting.sessions.map((session) => ({ ...session, meeting }))).slice(0, 6), null)
            : emptyState('Nessuna sessione', 'Il calendario è terminato.', 'calendar')}
        </section>

        <section class="card">
          ${cardHead({ title: 'Come funziona', sub: 'Il live timing di APEX', iconName: 'info' })}
          <p class="muted small" style="line-height:1.6">Durante una sessione la pagina si aggiorna ogni 15 secondi con posizioni, intervalli, gomme e meteo. Se apri la pagina fuori sessione vedrai il conto alla rovescia per il prossimo appuntamento.</p>
        </section>
      </aside>
    </div>
  `;

  const disposers = [];
  if (last?.race) {
    disposers.push(
      asyncSection(
        el.querySelector('[data-slot="last-podium"]'),
        () => getSessionClassification(last.race, last),
        (data) => {
          const entries = data.rows.filter((row) => row.position && row.position <= 3).map((row) => ({ ...row, timeText: row.displayTime }));
          return entries.length ? podiumNode(entries) : emptyState('Podio non disponibile', 'I risultati non sono ancora pubblicati.', 'flag');
        },
        { skeleton: skeletonRows(4) },
      ),
    );
  }

  return {
    el,
    destroy() {
      disposers.forEach((dispose) => dispose());
    },
  };
}

export function livePage() {
  const catalog = state.catalog;
  const el = document.createElement('div');
  el.className = 'page page-enter';
  if (!catalog) {
    el.innerHTML = html`${emptyState('Dati non disponibili', 'Ricarica la pagina per recuperare la stagione.', 'warning')}`;
    return { el, destroy() {} };
  }

  if (catalog.liveMeeting && catalog.liveSession) {
    return livePageContent(catalog, catalog.liveMeeting, catalog.liveSession);
  }
  return offlinePageContent(catalog);
}
