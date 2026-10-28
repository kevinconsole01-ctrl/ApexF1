import { html, icon } from '../core/dom.js';
import {
  countryFlag,
  countryName,
  formatDateRange,
  formatLapTime,
  formatTime,
  meetingTitle,
  sessionLabel,
} from '../core/format.js';
import { navigate } from '../core/router.js';
import { state } from '../core/store.js';
import {
  asyncSection,
  cardHead,
  emptyState,
  miniStat,
  pageHead,
  podiumNode,
  skeletonRows,
  tableNode,
} from '../core/page.js';
import { getRaceControl, getSessionClassification, getWeather } from '../data/results.js';
import { fastestLaps, getSessionLaps } from '../data/laps.js';
import { getMeetingDrivers } from '../data/drivers.js';
import { driverAvatar, driverCell, normalizeDriver } from '../components/driver.js';
import { positionBadge, weatherTile } from '../components/race.js';

const RACE_LIKE = new Set(['Race', 'Sprint']);

function resultsHref(meetingKey, sessionKey) {
  const params = new URLSearchParams();
  params.set('meeting', String(meetingKey));
  if (sessionKey) params.set('session', String(sessionKey));
  return `/results?${params.toString()}`;
}

function classificationColumns(data) {
  const qualifying = data.isQualifying;
  const columns = [
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
      sortable: true,
      sortValue: (row) => row.driver?.team_name || '',
      render: (row) => html`<span class="team-name"><span class="dot" style="--team:${row.teamColor}"></span>${row.driver?.team_name || '—'}</span>`,
    },
  ];

  if (qualifying) {
    columns.push(
      {
        key: 'bestLap',
        label: 'Miglior giro',
        align: 'right',
        sortable: true,
        sortValue: (row) => row.bestLap ?? Number.POSITIVE_INFINITY,
        render: (row) => html`<span class="mono ${row.bestLap === data.leader?.bestLap ? 'accent' : ''}">${formatLapTime(row.bestLap)}</span>`,
      },
      {
        key: 'qualifyingGap',
        label: 'Distacco',
        align: 'right',
        hideSm: true,
        sortable: true,
        sortValue: (row) => row.qualifyingGap ?? Number.POSITIVE_INFINITY,
        render: (row) => (row.qualifyingGap == null
          ? html`<span class="muted">—</span>`
          : row.qualifyingGap === 0
            ? html`<span class="mono accent">Leader</span>`
            : html`<span class="mono muted">+${formatLapTime(row.qualifyingGap)}</span>`),
      },
    );
    return columns;
  }

  columns.push(
    {
      key: 'gridPosition',
      label: 'Griglia',
      align: 'center',
      hideSm: true,
      sortable: true,
      sortValue: (row) => row.gridPosition ?? 999,
      render: (row) => html`<span class="muted">${row.gridPosition ?? '—'}</span>`,
    },
    {
      key: 'positionsGained',
      label: '+/−',
      align: 'center',
      hideSm: true,
      sortable: true,
      sortValue: (row) => row.positionsGained ?? 0,
      render: (row) => {
        if (row.positionsGained == null) return html`<span class="muted">—</span>`;
        if (!row.positionsGained) return html`<span class="delta delta--flat">${icon('minus')}</span>`;
        const up = row.positionsGained > 0;
        return html`<span class="delta ${up ? 'delta--up' : 'delta--down'}">${icon(up ? 'arrowUp' : 'arrowDown')}${Math.abs(row.positionsGained)}</span>`;
      },
    },
    {
      key: 'number_of_laps',
      label: 'Giri',
      align: 'right',
      hideSm: true,
      sortable: true,
      sortValue: (row) => row.number_of_laps ?? 0,
      render: (row) => html`<span class="num muted">${row.number_of_laps ?? '—'}</span>`,
    },
    {
      key: 'displayTime',
      label: 'Tempo / distacco',
      align: 'right',
      sortable: true,
      sortValue: (row) => row.position ?? 999,
      render: (row) => html`<span class="mono">${row.displayTime}</span>`,
    },
    {
      key: 'points',
      label: 'PT',
      align: 'right',
      hideSm: true,
      sortable: true,
      sortValue: (row) => row.points ?? 0,
      render: (row) => html`<span class="num ${row.points ? '' : 'muted'}">${row.points ? `+${row.points}` : '—'}</span>`,
    },
  );
  return columns;
}

function raceStats(data) {
  const rows = data.rows;
  const classified = rows.filter((row) => !row.dnf && !row.dns && !row.dsq).length;
  const retired = rows.filter((row) => row.dnf || row.dsq).length;
  const points = rows.reduce((total, row) => total + (Number(row.points) || 0), 0);
  const laps = rows.reduce((max, row) => Math.max(max, Number(row.number_of_laps) || 0), 0);
  const pole = rows.find((row) => row.gridPosition === 1) || rows[0];
  const leader = data.leader;

  if (data.isQualifying) {
    const second = rows[1];
    return html`<div class="result-stats">
      ${miniStat('Piloti', rows.length)}
      ${miniStat('Tempo pole', formatLapTime(leader?.bestLap), { rawValue: true })}
      ${miniStat('Pole', leader?.driver?.name_acronym || '—')}
      ${miniStat('Distacco 2°', leader?.bestLap != null && second?.bestLap != null ? `+${formatLapTime(second.bestLap - leader.bestLap)}` : '—')}
      ${miniStat('Team pole', leader?.driver?.team_name || '—')}
      ${miniStat('Conclusi', rows.length, { suffix: 'piloti' })}
    </div>`;
  }

  return html`<div class="result-stats">
    ${miniStat('Piloti', rows.length)}
    ${miniStat('Classificati', classified)}
    ${miniStat('Ritiri', retired)}
    ${miniStat('Giri', laps || '—')}
    ${miniStat('Punti assegnati', points ? `+${points}` : '—')}
    ${miniStat('Pole', pole?.driver?.name_acronym || '—')}
  </div>`;
}

function weatherContent(weather) {
  if (!weather) {
    return emptyState('Meteo non disponibile', 'OpenF1 non ha registrato dati meteo per questa sessione.', 'rain');
  }
  const temperature = weather.air_temperature != null ? `${Math.round(weather.air_temperature)}°` : '—';
  const track = weather.track_temperature != null ? `${Math.round(weather.track_temperature)}°` : '—';
  const humidity = weather.humidity != null ? `${Math.round(weather.humidity)}%` : '—';
  const wind = weather.wind_speed != null ? `${Number(weather.wind_speed).toFixed(1)} m/s` : '—';
  const rain = weather.rainfall ? 'Sì' : 'No';
  const pressure = weather.pressure != null ? `${Math.round(weather.pressure)} hPa` : '—';

  return html`<div class="weather-grid">
    ${weatherTile('thermometer', temperature, 'Aria')}
    ${weatherTile('gauge', track, 'Asfalto')}
    ${weatherTile('droplet', humidity, 'Umidità')}
    ${weatherTile('wind', wind, 'Vento')}
    ${weatherTile('rain', rain, 'Pioggia')}
    ${weatherTile('activity', pressure, 'Pressione')}
  </div>`;
}

function raceControlContent(rows) {
  if (!rows.length) {
    return emptyState('Nessun messaggio', 'La direzione gara non ha pubblicato comunicazioni per questa sessione.', 'radio');
  }
  return html`<div class="rc-feed">
    ${rows.map((row) => html`<div class="rc-item">
      <span class="rc-item__lap">${row.lap_number ? `G${row.lap_number}` : '—'}</span>
      <div>
        <p class="rc-item__message">${row.message || 'Comunicazione direzione gara'}</p>
        <div class="rc-item__meta">
          ${row.category ? html`<span class="badge">${row.category}</span>` : null}
          ${row.flag ? html`<span class="badge badge--warning">${row.flag}</span>` : null}
          ${row.scope ? html`<span>${row.scope}</span>` : null}
          <span>${formatTime(row.date)}</span>
        </div>
      </div>
    </div>`)}
  </div>`;
}

function fastestLapContent(data) {
  if (!data) {
    return emptyState('Nessun dato', 'Il giro più veloce non è disponibile per questa sessione.', 'timer');
  }
  const driver = normalizeDriver(data.driver || {});
  return html`<div class="row" style="gap:12px">
    ${driverAvatar(driver, { size: 'lg' })}
    <div style="min-width:0;flex:1">
      <p style="font-size:12.5px;font-weight:650">${driver.full_name}</p>
      <p class="muted small">${driver.team_name} · giro ${data.lap_number}</p>
    </div>
    <div style="text-align:right">
      <p class="mono" style="font-size:1.05rem;font-weight:700">${formatLapTime(data.lap_duration)}</p>
      ${data.st_speed != null ? html`<p class="faint small">${Math.round(data.st_speed)} km/h</p>` : null}
    </div>
  </div>`;
}

export function resultsPage({ query } = {}) {
  const catalog = state.catalog;
  const params = query || new URLSearchParams();
  const el = document.createElement('div');
  el.className = 'page page-enter';
  if (!catalog) {
    el.innerHTML = html`${emptyState('Dati non disponibili', 'Ricarica la pagina per recuperare la stagione.', 'warning')}`;
    return { el, destroy() {} };
  }

  const meetingOptions = [...catalog.completedRaces];
  if (catalog.liveMeeting && !meetingOptions.some((meeting) => meeting.meeting_key === catalog.liveMeeting.meeting_key)) {
    meetingOptions.unshift(catalog.liveMeeting);
  }
  catalog.upcomingRaces.forEach((meeting) => {
    if (!meetingOptions.some((item) => item.meeting_key === meeting.meeting_key)) meetingOptions.push(meeting);
  });

  const requestedMeeting = Number(params.get('meeting'));
  const meeting =
    catalog.byKey.get(requestedMeeting) ||
    catalog.latestCompleted ||
    catalog.liveMeeting ||
    catalog.nextRace ||
    catalog.races[catalog.races.length - 1] ||
    null;

  const sessions = meeting ? meeting.sessions.filter((session) => !session.cancelled) : [];
  const requestedSession = Number(params.get('session'));
  const session =
    sessions.find((item) => Number(item.session_key) === requestedSession) ||
    meeting?.race ||
    meeting?.sprint ||
    meeting?.qualifying ||
    sessions[sessions.length - 1] ||
    null;

  const sessionKey = session?.session_key;
  const isRaceLike = RACE_LIKE.has(session?.session_name);
  const title = meeting ? meetingTitle(meeting) : 'Risultati';
  const subtitle = meeting
    ? `Round ${meeting.round ?? '—'} · ${meeting.circuit_short_name || meeting.location || ''} · ${session ? sessionLabel(session.session_name) : 'Sessione'}.`
    : 'Seleziona un Gran Premio per consultare i risultati.';

  const meetingSelect = meeting
    ? html`<select class="select" data-meeting aria-label="Seleziona Gran Premio">
        ${meetingOptions.map((item) => html`<option value="${item.meeting_key}" ${item.meeting_key === meeting.meeting_key ? 'selected' : ''}>
          ${item.status === 'completed' ? '' : item.status === 'live' ? 'LIVE · ' : 'Prossimo · '}${item.round ? `R${item.round} · ` : ''}${meetingTitle(item)}
        </option>`)}
      </select>`
    : null;

  const sessionSelect = meeting
    ? html`<select class="select" data-session aria-label="Seleziona sessione">
        ${sessions.map((item) => html`<option value="${item.session_key}" ${item.session_key === session?.session_key ? 'selected' : ''}>
          ${sessionLabel(item.session_name)}${item.session_name === 'Race' ? '' : ''}
        </option>`)}
      </select>`
    : null;

  el.innerHTML = html`
    ${pageHead({
      eyebrow: `Stagione ${catalog.year} · Risultati`,
      title: 'Risultati',
      subtitle,
      actions: html`<a class="btn" href="#/laps${sessionKey ? `?session=${sessionKey}` : ''}">${icon('timer')} Tempi sul giro</a><a class="btn" href="#/standings">${icon('trophy')} Classifiche</a>`,
    })}
    <div class="laps-head">
      <div class="session-picker">${meetingSelect}${sessionSelect}</div>
      <p class="standings-meta">${meeting ? `${countryName(meeting.country_name)} · ${formatDateRange(meeting.date_start, meeting.date_end)}` : ''}</p>
    </div>

    ${meeting && session
      ? html`<section class="result-hero">
          <div class="result-hero__race">
            <p class="result-hero__round">Round ${meeting.round ?? '—'} · ${sessionLabel(session.session_name)}${meeting.sprint && session.session_name === 'Race' ? ' · Weekend Sprint' : ''}</p>
            <h2 class="result-hero__title">${title}</h2>
            <div class="result-hero__meta">
              <span>${icon('calendar')} ${formatDateRange(meeting.date_start, meeting.date_end)}</span>
              <span>${icon('mapPin')} ${meeting.circuit_short_name || meeting.location || '—'}</span>
              <span>${icon('clock')} ${formatTime(session.date_start)}</span>
              <span>${icon('flag')} ${countryName(meeting.country_name)}</span>
            </div>
          </div>
          <div class="result-hero__flag" aria-hidden="true">${countryFlag(meeting.country_code)}</div>
        </section>`
      : null}

    ${isRaceLike ? html`<div data-slot="podium"></div>` : null}

    ${meeting && session
      ? html`<div class="result-grid">
          <section class="card card--flush">
            ${cardHead({
              title: 'Classifica della sessione',
              sub: sessionLabel(session.session_name),
              iconName: 'list',
            })}
            <div data-slot="classification" class="result-classification">${skeletonRows(8)}</div>
          </section>

          <aside class="result-side">
            <section class="card">
              ${cardHead({ title: 'Dati gara', sub: 'Numeri della sessione', iconName: 'activity' })}
              <div data-slot="race-stats">${skeletonRows(4)}</div>
            </section>

            <section class="card">
              ${cardHead({ title: 'Giro più veloce', sub: 'Miglior tempo assoluto', iconName: 'timer' })}
              <div data-slot="fastest">${skeletonRows(2)}</div>
            </section>

            <section class="card">
              ${cardHead({ title: 'Meteo', sub: 'Condizioni in pista', iconName: 'thermometer' })}
              <div data-slot="weather">${skeletonRows(3)}</div>
            </section>

            <section class="card">
              ${cardHead({ title: 'Direzione gara', sub: 'Ultimi messaggi', iconName: 'radio' })}
              <div data-slot="race-control">${skeletonRows(4)}</div>
            </section>
          </aside>
        </div>`
      : emptyState('Nessuna sessione disponibile', 'Questo Gran Premio non ha ancora sessioni registrate su OpenF1.', 'flag')}
  `;

  const meetingSelectEl = el.querySelector('[data-meeting]');
  const sessionSelectEl = el.querySelector('[data-session]');
  if (meetingSelectEl && meeting) {
    meetingSelectEl.addEventListener('change', (event) => {
      const nextMeeting = catalog.byKey.get(Number(event.target.value));
      if (!nextMeeting) return;
      navigate(resultsHref(nextMeeting.meeting_key, nextMeeting.race?.session_key));
    });
  }
  if (sessionSelectEl && meeting) {
    sessionSelectEl.addEventListener('change', (event) => {
      navigate(resultsHref(meeting.meeting_key, Number(event.target.value)));
    });
  }

  const disposers = [];
  if (!meeting || !session) {
    return { el, destroy() {} };
  }

  const loadClassification = () => getSessionClassification(session, meeting);

  const podiumSlot = el.querySelector('[data-slot="podium"]');
  if (podiumSlot) {
    disposers.push(
      asyncSection(
        podiumSlot,
        loadClassification,
        (data) => {
          const entries = data.rows
            .filter((row) => row.position && row.position <= 3)
            .map((row) => ({ ...row, timeText: row.displayTime }));
          return podiumNode(entries, { labels: session.session_name === 'Race' ? ['Vincitore', 'Secondo', 'Terzo'] : ['Vincitore Sprint', 'Secondo', 'Terzo'] });
        },
        { skeleton: html`<div class="skeleton" style="height:190px;border-radius:16px"></div>` },
      ),
    );
  }

  disposers.push(
    asyncSection(
      el.querySelector('[data-slot="classification"]'),
      loadClassification,
      (data) => {
        if (!data.rows.length) {
          return emptyState('Nessun risultato', 'OpenF1 non ha ancora pubblicato la classifica di questa sessione.', 'list');
        }
        return tableNode({
          columns: classificationColumns(data),
          rows: data.rows,
          ariaLabel: `Classifica ${sessionLabel(session.session_name)} · ${title}`,
          rowHref: (row) => `#/drivers/${row.driver_number}`,
          highlightRow: (row) => row.position === 1,
          sort: { key: 'position', dir: 'asc' },
          dense: true,
          caption: 'Dati OpenF1 · tocca una riga per il profilo del pilota',
        });
      },
      { skeleton: skeletonRows(8) },
    ),
  );

  disposers.push(
    asyncSection(
      el.querySelector('[data-slot="race-stats"]'),
      loadClassification,
      (data) => (data.rows.length ? raceStats(data) : emptyState('Nessun dato', 'Statistiche non disponibili.', 'activity')),
      { skeleton: skeletonRows(4) },
    ),
  );

  disposers.push(
    asyncSection(
      el.querySelector('[data-slot="fastest"]'),
      async () => {
        if (!isRaceLike) return null;
        const [lapsData, driverMap] = await Promise.all([
          getSessionLaps(sessionKey),
          getMeetingDrivers(meeting.meeting_key),
        ]);
        return fastestLaps(lapsData, driverMap, 1)[0] || null;
      },
      (row) => fastestLapContent(row),
      { skeleton: skeletonRows(2) },
    ),
  );

  disposers.push(
    asyncSection(
      el.querySelector('[data-slot="weather"]'),
      () => getWeather(sessionKey),
      (weather) => weatherContent(weather),
      { skeleton: skeletonRows(3) },
    ),
  );

  disposers.push(
    asyncSection(
      el.querySelector('[data-slot="race-control"]'),
      () => getRaceControl(sessionKey, 7),
      (rows) => raceControlContent(rows),
      { skeleton: skeletonRows(4) },
    ),
  );

  return {
    el,
    destroy() {
      disposers.forEach((dispose) => dispose());
    },
  };
}
