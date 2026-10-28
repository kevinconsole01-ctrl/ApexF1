import { html, icon } from '../core/dom.js';
import {
  formatDate,
  formatLapTime,
  formatSector,
  meetingTitle,
  sessionLabel,
  shortSessionLabel,
  teamColor,
} from '../core/format.js';
import { navigate } from '../core/router.js';
import { state } from '../core/store.js';
import {
  asyncSection,
  cardHead,
  chartNode,
  emptyState,
  pageHead,
  skeletonChart,
  skeletonRows,
  skeletonStats,
  tableNode,
} from '../core/page.js';
import { getSessionLaps, driverLapStats } from '../data/laps.js';
import { fallbackDriver, getMeetingDrivers } from '../data/drivers.js';
import { driverAvatar, normalizeDriver } from '../components/driver.js';
import { statCard } from '../components/stats.js';

function lapsHref(sessionKey, driverNumber) {
  const params = new URLSearchParams();
  params.set('session', String(sessionKey));
  if (driverNumber) params.set('driver', String(driverNumber));
  return `/laps?${params.toString()}`;
}

function driverEntries(lapsData, driverMap) {
  return [...lapsData.bestByDriver.entries()]
    .map(([number, lap]) => ({
      driver: driverMap.get(number) || fallbackDriver(number),
      best: lap,
    }))
    .sort((a, b) => a.best.lap_duration - b.best.lap_duration);
}

function driverStripContent(lapsData, driverMap, sessionKey, selectedDriver) {
  const entries = driverEntries(lapsData, driverMap);
  return html`<a class="chip ${selectedDriver ? '' : 'is-active'}" href="#${lapsHref(sessionKey)}">
      <span class="chip__num">T</span> Tutti
    </a>
    ${entries.map(({ driver }) => {
      const data = normalizeDriver(driver);
      const active = Number(selectedDriver) === Number(data.driver_number);
      return html`<a class="chip ${active ? 'is-active' : ''}" href="#${lapsHref(sessionKey, data.driver_number)}" style="--team:${teamColor(data.team_colour)}">
        <span class="chip__num">${data.driver_number}</span>${data.name_acronym}
      </a>`;
    })}`;
}

function sessionStats(lapsData, driverMap) {
  const best = lapsData.sessionBest;
  const bestDriver = best ? normalizeDriver(driverMap.get(best.driver_number) || fallbackDriver(best.driver_number)) : null;
  const speed = lapsData.topSpeed;
  const speedDriver = speed ? normalizeDriver(driverMap.get(speed.driver_number) || fallbackDriver(speed.driver_number)) : null;
  const timedLaps = lapsData.rows.filter((lap) => lap.lap_duration != null).length;

  return html`<div class="stats-grid">
    ${statCard({
      label: 'Giro più veloce',
      value: html`${formatLapTime(best?.lap_duration)} <small>${bestDriver?.name_acronym || ''}</small>`,
      hint: best ? `${bestDriver?.team_name || ''} · giro ${best.lap_number}` : 'Nessun tempo registrato',
      iconName: 'timer',
    })}
    ${statCard({
      label: 'Velocità massima',
      value: html`${speed ? Math.round(speed.value) : '—'} <small>km/h</small>`,
      hint: speedDriver ? `${speedDriver.name_acronym} · giro ${speed.lap_number}` : 'Dato non disponibile',
      iconName: 'gauge',
      accent: '#58a6ff',
      accentSoft: 'rgba(88,166,255,.13)',
    })}
    ${statCard({
      label: 'Giri registrati',
      value: lapsData.totalLaps,
      hint: `${timedLaps} con tempo valido`,
      iconName: 'list',
      accent: '#2ee6a8',
      accentSoft: 'rgba(46,230,168,.12)',
    })}
    ${statCard({
      label: 'Piloti in pista',
      value: lapsData.byDriver.size,
      hint: best ? `Miglior tempo ${formatLapTime(best.lap_duration)}` : 'Sessione senza tempi',
      iconName: 'users',
      accent: '#c084fc',
      accentSoft: 'rgba(192,132,252,.13)',
    })}
  </div>`;
}

function chartContent(lapsData, driverMap, selectedDriver) {
  const entries = driverEntries(lapsData, driverMap);
  if (!entries.length) {
    return emptyState('Nessun giro completato', 'OpenF1 non ha registrato tempi sul giro per questa sessione.', 'timer');
  }

  let series;
  let highlightX = null;
  let foot;

  if (selectedDriver) {
    const entry = entries.find((item) => Number(item.driver.driver_number) === Number(selectedDriver));
    const driver = normalizeDriver(entry?.driver || fallbackDriver(selectedDriver));
    const driverBest = entry?.best?.lap_duration ?? lapsData.sessionBest?.lap_duration;
    const cutoff = driverBest ? driverBest * 1.08 : Number.POSITIVE_INFINITY;
    const laps = (lapsData.byDriver.get(Number(selectedDriver)) || []).filter(
      (lap) => lap.lap_duration != null && lap.lap_duration <= cutoff,
    );
    series = [
      {
        name: driver.name_acronym,
        color: teamColor(driver.team_colour),
        points: laps.map((lap) => ({ x: lap.lap_number, y: lap.lap_duration })),
      },
    ];
    highlightX = entry?.best?.lap_number ?? null;
    foot = `${driver.full_name} · ${laps.length} giri nel ritmo gara (entro l'8% dal miglior tempo). Il punto evidenziato è il giro migliore.`;
  } else {
    const top = entries.slice(0, 5);
    const cutoff = lapsData.sessionBest ? lapsData.sessionBest.lap_duration * 1.08 : Number.POSITIVE_INFINITY;
    series = top.map(({ driver }) => {
      const data = normalizeDriver(driver);
      const laps = (lapsData.byDriver.get(Number(data.driver_number)) || []).filter(
        (lap) => lap.lap_duration != null && !lap.is_pit_out_lap && lap.lap_duration <= cutoff,
      );
      return {
        name: data.name_acronym,
        color: teamColor(data.team_colour),
        points: laps.map((lap) => ({ x: lap.lap_number, y: lap.lap_duration })),
      };
    });
    foot = "I cinque piloti più veloci della sessione · giri nel ritmo gara, esclusi pit-out e giri oltre l'8% dal miglior tempo.";
  }

  const totalPoints = series.reduce((sum, item) => sum + item.points.length, 0);

  return chartNode({
    series,
    height: 286,
    ariaLabel: 'Andamento dei tempi sul giro',
    xFormat: (value) => `G${value}`,
    yFormat: (value) => formatLapTime(value),
    tipTitle: (value) => `Giro ${value}`,
    highlightX,
    showDots: totalPoints <= 70,
    foot,
  });
}

function sectorBlock(label, sector, driverMap) {
  const driver = sector ? normalizeDriver(driverMap.get(sector.driver_number) || fallbackDriver(sector.driver_number)) : null;
  return html`<div class="mini-stat">
    <p class="mini-stat__label">${label}</p>
    <p class="mini-stat__value">${formatSector(sector?.value)}</p>
    <p class="faint small" style="margin-top:3px">${driver ? `${driver.name_acronym} · giro ${sector.lap_number}` : 'Non disponibile'}</p>
  </div>`;
}

function sectorsContent(lapsData, driverMap) {
  return html`<div class="weather-grid">
    ${lapsData.bestSectors.map((sector, index) => sectorBlock(`Settore ${index + 1}`, sector, driverMap))}
    ${lapsData.topSpeed
      ? html`<div class="mini-stat">
          <p class="mini-stat__label">Velocità punta</p>
          <p class="mini-stat__value">${Math.round(lapsData.topSpeed.value)}<small> km/h</small></p>
          <p class="faint small" style="margin-top:3px">${normalizeDriver(driverMap.get(lapsData.topSpeed.driver_number) || fallbackDriver(lapsData.topSpeed.driver_number)).name_acronym} · giro ${lapsData.topSpeed.lap_number}</p>
        </div>`
      : null}
  </div>`;
}

function analysisContent(lapsData, driverMap, selectedDriver) {
  if (!selectedDriver) {
    const best = lapsData.sessionBest;
    if (!best) return emptyState('Nessuna analisi', 'Seleziona una sessione con tempi registrati.', 'timer');
    const driver = normalizeDriver(driverMap.get(best.driver_number) || fallbackDriver(best.driver_number));
    return html`<div class="row" style="gap:12px;align-items:flex-start">
      ${driverAvatar(driver, { size: 'lg' })}
      <div style="min-width:0">
        <p style="font-weight:650;font-size:13px">${driver.full_name}</p>
        <p class="muted small">${driver.team_name} · giro ${best.lap_number}</p>
        <p class="mono" style="margin-top:7px;font-size:1.1rem">${formatLapTime(best.lap_duration)}</p>
      </div>
    </div>
    <p class="faint small" style="margin-top:12px">Seleziona un pilota dalla striscia qui sopra per vedere analisi, settori e tutti i suoi giri.</p>`;
  }

  const driver = normalizeDriver(driverMap.get(Number(selectedDriver)) || fallbackDriver(selectedDriver));
  const laps = lapsData.byDriver.get(Number(selectedDriver)) || [];
  const stats = driverLapStats(laps);

  return html`<div class="row" style="gap:12px;margin-bottom:12px">
      ${driverAvatar(driver, { size: 'lg' })}
      <div style="min-width:0">
        <p style="font-weight:650;font-size:13px">${driver.full_name}</p>
        <p class="muted small">${driver.team_name}</p>
      </div>
    </div>
    <div class="weather-grid">
      ${[{ label: 'Miglior giro', value: formatLapTime(stats.best?.lap_duration), hint: stats.best ? `Giro ${stats.best.lap_number}` : '—' },
        { label: 'Media', value: formatLapTime(stats.average), hint: 'Giri con tempo' },
        { label: 'Velocità max', value: stats.topSpeed != null ? `${Math.round(stats.topSpeed)}` : '—', hint: 'km/h' },
        { label: 'Giri completati', value: stats.laps, hint: 'Tempi validi' }].map((item) => html`<div class="mini-stat">
          <p class="mini-stat__label">${item.label}</p>
          <p class="mini-stat__value">${item.value}</p>
          <p class="faint small" style="margin-top:3px">${item.hint}</p>
        </div>`)}
    </div>`;
}

function lapTableContent(lapsData, driverMap, selectedDriver, sessionKey) {
  if (!selectedDriver) {
    return html`<section class="card">${cardHead({ title: 'Giro per giro', sub: 'Seleziona un pilota', iconName: 'list' })}
      ${emptyState('Nessun pilota selezionato', 'Tocca un pilota nella striscia in alto o nella tabella dei tempi per vedere tutti i suoi giri.', 'user')}
    </section>`;
  }

  const driver = normalizeDriver(driverMap.get(Number(selectedDriver)) || fallbackDriver(selectedDriver));
  const laps = [...(lapsData.byDriver.get(Number(selectedDriver)) || [])].sort((a, b) => a.lap_number - b.lap_number);
  const stats = driverLapStats(laps);
  const bestLap = stats.best?.lap_number;

  const table = tableNode({
    columns: [
      {
        key: 'lap_number',
        label: 'Giro',
        width: '54px',
        sortable: true,
        render: (lap) => html`<strong class="num">${lap.lap_number}</strong>`,
      },
      {
        key: 'lap_duration',
        label: 'Tempo',
        align: 'right',
        sortable: true,
        sortValue: (lap) => lap.lap_duration ?? Number.POSITIVE_INFINITY,
        render: (lap) => html`<span class="mono ${lap.lap_number === bestLap ? 'accent' : ''}">${formatLapTime(lap.lap_duration)}</span>`,
      },
      {
        key: 'duration_sector_1',
        label: 'S1',
        align: 'right',
        hideSm: true,
        sortable: true,
        render: (lap) => html`<span class="mono muted">${formatSector(lap.duration_sector_1)}</span>`,
      },
      {
        key: 'duration_sector_2',
        label: 'S2',
        align: 'right',
        hideSm: true,
        sortable: true,
        render: (lap) => html`<span class="mono muted">${formatSector(lap.duration_sector_2)}</span>`,
      },
      {
        key: 'duration_sector_3',
        label: 'S3',
        align: 'right',
        hideSm: true,
        sortable: true,
        render: (lap) => html`<span class="mono muted">${formatSector(lap.duration_sector_3)}</span>`,
      },
      {
        key: 'st_speed',
        label: 'Vel. oc.',
        align: 'right',
        hideSm: true,
        sortable: true,
        sortValue: (lap) => lap.st_speed ?? 0,
        render: (lap) => html`<span class="num muted">${lap.st_speed != null ? Math.round(lap.st_speed) : '—'}</span>`,
      },
      {
        key: 'is_pit_out_lap',
        label: 'Nota',
        render: (lap) => (lap.is_pit_out_lap ? html`<span class="badge">Out lap</span>` : html`<span class="faint">—</span>`),
      },
    ],
    rows: laps,
    ariaLabel: `Tutti i giri di ${driver.full_name}`,
    rowClass: (lap) => [lap.lap_number === bestLap ? 'is-fastest' : '', lap.is_pit_out_lap ? 'is-pitout' : ''].filter(Boolean).join(' '),
    sort: { key: 'lap_number', dir: 'asc' },
    dense: true,
    caption: `${driver.full_name} · ${laps.length} giri · dati OpenF1`,
  });

  const section = document.createElement('section');
  section.className = 'card lap-table';
  section.innerHTML = html`${cardHead({
    title: `Giro per giro · ${driver.name_acronym}`,
    sub: `${driver.team_name} · miglior giro ${formatLapTime(stats.best?.lap_duration)}`,
    action: html`<a class="card__link" href="#${lapsHref(sessionKey)}">Tutti i piloti${icon('chevronRight')}</a>`,
  })}`;
  section.append(table);
  return section;
}

export function lapsPage({ query } = {}) {
  const catalog = state.catalog;
  const params = query || new URLSearchParams();
  const el = document.createElement('div');
  el.className = 'page page-enter';
  if (!catalog) {
    el.innerHTML = html`${emptyState('Dati non disponibili', 'Ricarica la pagina per recuperare la stagione.', 'warning')}`;
    return { el, destroy() {} };
  }

  const pastSessions = catalog.allSessions
    .filter((session) => new Date(session.date_start).getTime() <= Date.now())
    .slice(-40)
    .reverse();

  const requestedSession = Number(params.get('session'));
  const selectedSession =
    catalog.allSessions.find((session) => Number(session.session_key) === requestedSession) ||
    pastSessions.find((session) => session.session_name === 'Race') ||
    catalog.latestCompleted?.race ||
    pastSessions[0] ||
    null;

  const selectedDriver = Number(params.get('driver')) || null;

  if (!selectedSession) {
    el.innerHTML = html`
      ${pageHead({ eyebrow: `Stagione ${catalog.year}`, title: 'Tempi sul giro', subtitle: 'Nessuna sessione con dati disponibili.' })}
      ${emptyState('Nessun dato sui giri', 'OpenF1 non ha ancora registrato sessioni per questa stagione.', 'timer')}
    `;
    return { el, destroy() {} };
  }

  const meeting = selectedSession.meeting || catalog.byKey.get(selectedSession.meeting_key);
  const sessionKey = selectedSession.session_key;

  const sessionOptions = pastSessions.length ? pastSessions : [selectedSession];
  if (!sessionOptions.some((session) => Number(session.session_key) === Number(sessionKey))) {
    sessionOptions.unshift(selectedSession);
  }

  const selectOptions = sessionOptions.map((session) => {
    const sessionMeeting = session.meeting || catalog.byKey.get(session.meeting_key);
    const prefix = sessionMeeting?.round ? `R${sessionMeeting.round} · ` : '';
    const date = sessionMeeting ? formatDate(session.date_start) : '';
    return html`<option value="${session.session_key}" ${Number(session.session_key) === Number(sessionKey) ? 'selected' : ''}>
      ${prefix}${sessionMeeting ? meetingTitle(sessionMeeting) : ''} · ${shortSessionLabel(session.session_name)}${date ? ` · ${date}` : ''}
    </option>`;
  });

  el.innerHTML = html`
    ${pageHead({
      eyebrow: `Stagione ${catalog.year} · Analisi giri`,
      title: 'Tempi sul giro',
      subtitle: meeting ? `${meetingTitle(meeting)} · ${sessionLabel(selectedSession.session_name)} · ${formatDate(selectedSession.date_start, { weekday: true, year: true })}.` : 'Analizza i tempi sul giro sessione per sessione.',
      actions: html`<a class="btn" href="#/results?meeting=${meeting?.meeting_key || ''}&session=${sessionKey}">${icon('flag')} Risultati</a>`,
    })}
    <div class="laps-head">
      <div class="session-picker">
        <select class="select" data-session aria-label="Seleziona sessione">${selectOptions}</select>
      </div>
      <p class="standings-meta">${selectedDriver ? 'Filtro pilota attivo' : 'Tutti i piloti'} · ${sessionLabel(selectedSession.session_name)}</p>
    </div>

    <div class="driver-strip" data-slot="drivers">
      ${Array.from({ length: 8 }, () => html`<span class="skeleton" style="width:64px;height:32px;border-radius:999px"></span>`)}
    </div>

    <div data-slot="stats">${skeletonStats(4)}</div>

    <div class="lap-layout">
      <section class="card lap-chart-card">
        ${cardHead({
          title: 'Andamento dei tempi',
          sub: selectedDriver ? 'Tutti i giri del pilota selezionato' : 'Confronto tra i cinque piloti più veloci',
          iconName: 'activity',
        })}
        <div data-slot="chart">${skeletonChart(286)}</div>
      </section>

      <aside class="dash-col">
        <section class="card">
          ${cardHead({ title: 'Migliori settori', sub: 'Record della sessione', iconName: 'zap' })}
          <div data-slot="sectors">${skeletonRows(4)}</div>
        </section>
        <section class="card">
          ${cardHead({ title: 'Analisi pilota', sub: selectedDriver ? 'Statistiche del pilota' : 'Miglior tempo della sessione', iconName: 'user' })}
          <div data-slot="analysis">${skeletonRows(4)}</div>
        </section>
      </aside>
    </div>

    <div data-slot="lap-table">${skeletonRows(8)}</div>
  `;

  const sessionSelect = el.querySelector('[data-session]');
  sessionSelect?.addEventListener('change', (event) => {
    navigate(lapsHref(Number(event.target.value)));
  });

  const loadLaps = async () => {
    const [lapsData, driverMap] = await Promise.all([
      getSessionLaps(sessionKey),
      getMeetingDrivers(meeting?.meeting_key || selectedSession.meeting_key),
    ]);
    return { lapsData, driverMap };
  };

  const disposers = [];

  disposers.push(
    asyncSection(
      el.querySelector('[data-slot="drivers"]'),
      loadLaps,
      ({ lapsData, driverMap }) => (lapsData.byDriver.size
        ? driverStripContent(lapsData, driverMap, sessionKey, selectedDriver)
        : html`<span class="muted small">Nessun pilota con tempi registrati.</span>`),
      { skeleton: html`<span class="skeleton" style="width:60px;height:32px;border-radius:999px"></span>` },
    ),
  );

  disposers.push(
    asyncSection(
      el.querySelector('[data-slot="stats"]'),
      loadLaps,
      ({ lapsData, driverMap }) => (lapsData.totalLaps ? sessionStats(lapsData, driverMap) : emptyState('Nessun giro', 'Non ci sono tempi sul giro per questa sessione.', 'timer')),
      { skeleton: skeletonStats(4) },
    ),
  );

  disposers.push(
    asyncSection(
      el.querySelector('[data-slot="chart"]'),
      loadLaps,
      ({ lapsData, driverMap }) => chartContent(lapsData, driverMap, selectedDriver),
      { skeleton: skeletonChart(286) },
    ),
  );

  disposers.push(
    asyncSection(
      el.querySelector('[data-slot="sectors"]'),
      loadLaps,
      ({ lapsData, driverMap }) => sectorsContent(lapsData, driverMap),
      { skeleton: skeletonRows(4) },
    ),
  );

  disposers.push(
    asyncSection(
      el.querySelector('[data-slot="analysis"]'),
      loadLaps,
      ({ lapsData, driverMap }) => analysisContent(lapsData, driverMap, selectedDriver),
      { skeleton: skeletonRows(4) },
    ),
  );

  disposers.push(
    asyncSection(
      el.querySelector('[data-slot="lap-table"]'),
      loadLaps,
      ({ lapsData, driverMap }) => lapTableContent(lapsData, driverMap, selectedDriver, sessionKey),
      { skeleton: skeletonRows(8) },
    ),
  );

  return {
    el,
    destroy() {
      disposers.forEach((dispose) => dispose());
    },
  };
}
