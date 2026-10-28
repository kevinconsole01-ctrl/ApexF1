import { html, icon } from '../core/dom.js';
import {
  countryFlag,
  formatDate,
  formatLapTime,
  formatPoints,
  meetingTitle,
  shortDriverName,
  teamColor,
} from '../core/format.js';
import { state } from '../core/store.js';
import {
  asyncSection,
  cardHead,
  chartNode,
  emptyState,
  miniStat,
  pageHead,
  skeletonChart,
  skeletonRows,
  tableNode,
} from '../core/page.js';
import { getDriverInfoAnywhere, getMeetingDrivers } from '../data/drivers.js';
import { getDriverStandings } from '../data/standings.js';
import { getDriverRecentResults } from '../data/results.js';
import { driverLapStats, getSessionLaps } from '../data/laps.js';
import { driverAvatar, normalizeDriver } from '../components/driver.js';
import { positionBadge } from '../components/race.js';

function driverHero(data) {
  const driver = normalizeDriver(data.driver);
  const standing = data.standing;
  const color = teamColor(driver.team_colour);
  const gap = standing?.gapToLeader;

  return html`<section class="driver-hero" style="--team:${color}" data-number="${driver.driver_number}">
    <div class="driver-hero__photo">
      ${driver.headshot_url
        ? html`<img src="${driver.headshot_url}" alt="${driver.full_name}" loading="eager" referrerpolicy="no-referrer" onerror="this.remove()">`
        : driverAvatar(driver, { size: 'xl' })}
    </div>
    <div class="driver-hero__info">
      <div class="driver-hero__eyebrow">
        ${driver.country_code
          ? html`<span>${countryFlag(driver.country_code)} ${driver.country_code}</span>
              <span>·</span>`
          : null}
        <span>#${driver.driver_number}</span>
        <span>·</span>
        <span>${driver.name_acronym}</span>
      </div>
      <h1 class="driver-hero__name">${driver.first_name || ''} <span>${driver.last_name || driver.name_acronym}</span></h1>
      <div class="driver-hero__team"><span class="dot" style="--team:${color}"></span>${driver.team_name}</div>
    </div>
    <div class="driver-hero__stats">
      <div class="driver-hero__stat"><span>Posizione</span><strong>${standing?.position ? `${standing.position}°` : '—'}</strong></div>
      <div class="driver-hero__stat"><span>Punti</span><strong>${standing ? formatPoints(standing.points) : '—'}</strong></div>
      <div class="driver-hero__stat"><span>Dal leader</span><strong>${gap ? `−${formatPoints(gap)}` : gap === 0 ? 'Leader' : '—'}</strong></div>
    </div>
  </section>`;
}

function recentContent(results) {
  if (!results.length) {
    return emptyState('Nessun risultato recente', 'Il pilota non ha ancora preso parte a Gran Premi completati in questa stagione.', 'flag');
  }

  return tableNode({
    columns: [
      {
        key: 'meeting',
        label: 'Gran Premio',
        sortable: true,
        sortValue: (item) => item.meeting.round ?? 0,
        render: (item) => html`<span class="team-name"><span>${countryFlag(item.meeting.country_code)}</span>${meetingTitle(item.meeting)}</span>`,
      },
      {
        key: 'date',
        label: 'Data',
        hideSm: true,
        render: (item) => html`<span class="muted">${formatDate(item.meeting.date_start, { year: true })}</span>`,
      },
      {
        key: 'grid',
        label: 'Griglia',
        align: 'center',
        hideSm: true,
        render: (item) => html`<span class="muted">${item.row.gridPosition ?? '—'}</span>`,
      },
      {
        key: 'position',
        label: 'Pos',
        align: 'center',
        sortable: true,
        sortValue: (item) => item.row.position ?? 999,
        render: (item) => positionBadge(item.row.position),
      },
      {
        key: 'points',
        label: 'Punti',
        align: 'right',
        sortable: true,
        sortValue: (item) => item.row.points ?? 0,
        render: (item) => html`<span class="num">${item.row.points ? `+${item.row.points}` : '—'}</span>`,
      },
      {
        key: 'time',
        label: 'Tempo',
        align: 'right',
        render: (item) => html`<span class="mono">${item.row.displayTime}</span>`,
      },
    ],
    rows: results,
    ariaLabel: 'Ultimi risultati del pilota',
    rowHref: (item) => `#/results?meeting=${item.meeting.meeting_key}&session=${item.meeting.race?.session_key || ''}`,
    dense: true,
    caption: 'Gli ultimi cinque Gran Premi disputati · tocca una riga per il risultato completo',
  });
}

function trendContent(results, driver) {
  const points = [...results]
    .reverse()
    .filter((item) => item.row.position)
    .map((item, index) => ({ x: index + 1, y: item.row.position }));

  if (points.length < 2) {
    return emptyState('Andamento non disponibile', 'Servono almeno due gare per disegnare il trend delle posizioni.', 'activity');
  }

  const labels = [...results].reverse();

  return chartNode({
    series: [{ name: driver.name_acronym, color: teamColor(driver.team_colour), points }],
    height: 220,
    ariaLabel: 'Posizioni del pilota negli ultimi Gran Premi',
    xFormat: (value) => {
      const item = labels[value - 1];
      return item?.meeting.round ? `R${item.meeting.round}` : `G${value}`;
    },
    yFormat: (value) => `P${value}`,
    invertY: true,
    minY: 1,
    maxY: Math.max(3, ...points.map((point) => point.y)),
    showDots: true,
    baseline: 1,
    baselineLabel: 'P1',
    foot: 'Posizione in gara · più in alto è meglio',
  });
}

function lapsContent(lapsData, driverNumber, raceMeeting, color) {
  const timed = (lapsData.byDriver.get(Number(driverNumber)) || []).filter((lap) => lap.lap_duration != null);
  if (!timed.length) {
    return emptyState('Nessun tempo sul giro', 'OpenF1 non ha registrato giri per questo pilota nell\'ultima gara.', 'timer');
  }

  const bestLap = Math.min(...timed.map((lap) => lap.lap_duration));
  const laps = timed.filter((lap) => lap.lap_duration <= bestLap * 1.08);
  const stats = driverLapStats(laps);
  const wrap = document.createElement('div');
  wrap.className = 'stack';
  wrap.style.gap = '12px';
  wrap.innerHTML = html`<div class="weather-grid">
    ${miniStat('Miglior giro', formatLapTime(stats.best?.lap_duration))}
    ${miniStat('Media', formatLapTime(stats.average))}
    ${miniStat('Velocità max', stats.topSpeed != null ? Math.round(stats.topSpeed) : '—', { suffix: 'km/h' })}
    ${miniStat('Giri', stats.laps, { suffix: 'con tempo' })}
  </div>`;

  wrap.append(
    chartNode({
      series: [
        {
          name: 'Tempo sul giro',
          color: color || '#ff2d16',
          points: laps.map((lap) => ({ x: lap.lap_number, y: lap.lap_duration })),
        },
      ],
      height: 210,
      ariaLabel: 'Tempi sul giro nell\'ultima gara',
      xFormat: (value) => `G${value}`,
      yFormat: (value) => formatLapTime(value),
      tipTitle: (value) => `Giro ${value}`,
      highlightX: stats.best?.lap_number,
      showDots: laps.length <= 70,
      foot: raceMeeting ? `${meetingTitle(raceMeeting)} · ${laps.length} giri nel ritmo gara (esclusi pit stop e giri anomali)` : undefined,
    }),
  );

  return wrap;
}

function teammateContent(data) {
  const teammate = data.teammate;
  if (!teammate) {
    return emptyState('Nessun compagno', 'Non è stato possibile individuare il compagno di squadra in questa stagione.', 'users');
  }
  const driver = normalizeDriver(teammate.driver);
  const standing = teammate.standing;
  return html`<a class="teammate-card" href="#/drivers/${driver.driver_number}" style="--team:${teamColor(driver.team_colour)}">
    ${driverAvatar(driver, { size: 'lg' })}
    <div class="teammate-card__info">
      <p class="teammate-card__name">${shortDriverName(driver)}</p>
      <p class="teammate-card__points">${driver.team_name} · ${standing?.position ? `${standing.position}° in classifica` : '—'}</p>
    </div>
    <div style="text-align:right">
      <p data-teammate-points style="font-family:var(--font-display);font-size:1.05rem;font-weight:760">${standing ? formatPoints(standing.points) : '—'}</p>
      <p class="faint small">PT</p>
    </div>
    ${icon('chevronRight')}
  </a>`;
}

function seasonContent(data) {
  const standing = data.standing;
  const latest = data.latestResult;
  return html`<div class="weather-grid">
    ${miniStat('Posizione', standing?.position ? `${standing.position}°` : '—')}
    ${miniStat('Punti', standing ? formatPoints(standing.points) : '—', { suffix: 'PT' })}
    ${miniStat('Ultimo GP', latest ? `${latest.row.position ?? '—'}°` : '—', { suffix: latest ? meetingTitle(latest.meeting) : '' })}
    ${miniStat('Variazione', standing ? `${standing.positionDelta > 0 ? '+' : ''}${standing.positionDelta}` : '—', { suffix: 'posizioni' })}
  </div>`;
}

function profileContent(driver) {
  const data = normalizeDriver(driver);
  return html`<div class="weather-grid">
    ${miniStat('Numero', `#${data.driver_number}`)}
    ${miniStat('Acronimo', data.name_acronym)}
    ${miniStat('Paese', data.country_code ? `${countryFlag(data.country_code)} ${data.country_code}` : '—')}
    ${miniStat('Team', data.team_name)}
  </div>`;
}

export function driverPage({ params } = {}) {
  const catalog = state.catalog;
  const driverNumber = Number(params?.[0]);
  const el = document.createElement('div');
  el.className = 'page page-enter';

  if (!catalog) {
    el.innerHTML = html`${emptyState('Dati non disponibili', 'Ricarica la pagina per recuperare la stagione.', 'warning')}`;
    return { el, destroy() {} };
  }
  if (!Number.isFinite(driverNumber) || driverNumber <= 0) {
    el.innerHTML = html`${pageHead({ eyebrow: 'Piloti', title: 'Pilota non valido' })}
      ${emptyState('Numero pilota non valido', 'Torna alla lista piloti e seleziona un pilota.', 'user')}
      <a class="btn" href="#/drivers">${icon('arrowLeft')} Tutti i piloti</a>`;
    return { el, destroy() {} };
  }

  el.innerHTML = html`
    <div class="row spread">
      <a class="card__link" href="#/drivers">${icon('arrowLeft')} Tutti i piloti</a>
      <p class="standings-meta">Stagione ${catalog.year} · profilo pilota</p>
    </div>
    <div data-slot="driver">${html`<div class="skeleton" style="height:210px;border-radius:28px"></div>`}</div>
  `;

  const disposers = [];

  disposers.push(
    asyncSection(
      el.querySelector('[data-slot="driver"]'),
      async () => {
        const meeting = catalog.latestCompleted || catalog.liveMeeting || catalog.nextRace;
        let driverMap = new Map();
        let standingsRows = [];

        if (meeting) {
          const [map, standings] = await Promise.all([
            getMeetingDrivers(meeting.meeting_key),
            getDriverStandings(catalog).catch(() => ({ rows: [] })),
          ]);
          driverMap = map;
          standingsRows = standings.rows;
        }

        const standing = standingsRows.find((row) => Number(row.driver_number) === driverNumber) || null;

        let driver = driverMap.get(driverNumber);
        if (!driver) driver = await getDriverInfoAnywhere(driverNumber);
        if (!driver) return null;

        // Un pilota può cambiare numero a stagione in corso (es. da #4 a #1 da campione).
        // Riallinea all'identità attuale tramite l'acronimo, così statistiche e compagno restano coerenti.
        const current = [...driverMap.values()].find(
          (item) => item.name_acronym && item.name_acronym === driver.name_acronym,
        );
        if (current) driver = current;
        const effectiveNumber = Number(driver.driver_number) || driverNumber;
        const currentStanding = standing && Number(standing.driver_number) === effectiveNumber
          ? standing
          : standingsRows.find((row) => Number(row.driver_number) === effectiveNumber) || null;

        let teammate = null;
        if (driverMap.has(effectiveNumber) && driver.team_name) {
          const colleague = [...driverMap.values()].find(
            (item) => item.team_name === driver.team_name && Number(item.driver_number) !== effectiveNumber,
          );
          if (colleague) {
            teammate = {
              driver: colleague,
              standing: standingsRows.find((row) => Number(row.driver_number) === Number(colleague.driver_number)) || null,
            };
          }
        }

        return {
          driver,
          driverNumber: effectiveNumber,
          driverMap,
          meeting,
          standing: currentStanding,
          teammate,
          standingsRows,
        };
      },
      (data) => {
        if (!data) {
          return html`${emptyState('Pilota non trovato', 'Il numero richiesto non corrisponde a un pilota presente nei dati OpenF1.', 'user')}
            <a class="btn" href="#/drivers">${icon('arrowLeft')} Torna ai piloti</a>`;
        }

        const driver = data.driver;
        const wrapper = document.createElement('div');
        wrapper.className = 'stack';
        wrapper.style.gap = '20px';
        wrapper.innerHTML = html`
          ${driverHero(data)}
          <div class="driver-layout">
            <div class="stack">
              <section class="card">
                ${cardHead({
                  title: 'Ultimi Gran Premi',
                  sub: 'Gli ultimi cinque risultati in gara',
                  href: '#/results',
                  linkLabel: 'Tutti i risultati',
                  iconName: 'flag',
                })}
                <div data-slot="recent">${skeletonRows(5)}</div>
              </section>

              <section class="card">
                ${cardHead({
                  title: 'Andamento posizioni',
                  sub: 'Posizione in gara negli ultimi appuntamenti',
                  iconName: 'activity',
                })}
                <div data-slot="trend">${skeletonChart(220)}</div>
              </section>

              <section class="card">
                ${cardHead({
                  title: 'Tempi sul giro',
                  sub: data.meeting?.race ? meetingTitle(data.meeting) : 'Ultima gara',
                  href: '#/laps',
                  linkLabel: 'Analisi giri',
                  iconName: 'timer',
                })}
                <div data-slot="laps">${skeletonChart(210)}</div>
              </section>
            </div>

            <aside class="stack">
              <section class="card">
                ${cardHead({ title: 'Compagno di squadra', sub: 'Confronto in squadra', iconName: 'users' })}
                ${teammateContent(data)}
              </section>

              <section class="card">
                ${cardHead({ title: 'Stagione', sub: `Dopo ${catalog.completedCount} Gran Premi`, iconName: 'trophy' })}
                <div data-slot="season">${seasonContent(data)}</div>
              </section>

              <section class="card">
                ${cardHead({ title: 'Profilo', sub: 'Dati del pilota', iconName: 'user' })}
                ${profileContent(driver)}
              </section>
            </aside>
          </div>
        `;

        disposers.push(
          asyncSection(
            wrapper.querySelector('[data-slot="recent"]'),
            () => getDriverRecentResults(catalog, data.driverNumber, 5),
            (results) => recentContent(results),
            { skeleton: skeletonRows(5) },
          ),
        );

        disposers.push(
          asyncSection(
            wrapper.querySelector('[data-slot="trend"]'),
            () => getDriverRecentResults(catalog, data.driverNumber, 5),
            (results) => trendContent(results, normalizeDriver(driver)),
            { skeleton: skeletonChart(220) },
          ),
        );

        disposers.push(
          asyncSection(
            wrapper.querySelector('[data-slot="laps"]'),
            async () => {
              const race = catalog.latestCompleted?.race;
              if (!race) return null;
              const [lapsData] = await Promise.all([getSessionLaps(race.session_key)]);
              return { lapsData, meeting: catalog.latestCompleted };
            },
            (payload) => (payload
              ? lapsContent(payload.lapsData, data.driverNumber, payload.meeting, teamColor(driver.team_colour))
              : emptyState('Nessuna gara', 'I tempi sul giro compariranno dopo il primo Gran Premio.', 'timer')),
            { skeleton: skeletonChart(210) },
          ),
        );

        return wrapper;
      },
      { skeleton: html`<div class="skeleton" style="height:210px;border-radius:28px"></div>` },
    ),
  );

  return {
    el,
    destroy() {
      disposers.forEach((dispose) => dispose());
    },
  };
}
