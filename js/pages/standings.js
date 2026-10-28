import { html, icon } from '../core/dom.js';
import { formatPoints, meetingTitle, pct, teamColor } from '../core/format.js';
import { navigate } from '../core/router.js';
import { state } from '../core/store.js';
import {
  asyncSection,
  cardHead,
  chartNode,
  emptyState,
  miniStat,
  pageHead,
  segmentedNode,
  skeletonChart,
  skeletonRows,
  tableNode,
} from '../core/page.js';
import {
  getDriverStandings,
  getStandingsHistory,
  getTeamStandings,
  pointsSeriesForDrivers,
} from '../data/standings.js';
import { driverAvatar, driverCell, normalizeDriver, teamBadge } from '../components/driver.js';

function initials(name) {
  return String(name || '')
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 3)
    .toUpperCase();
}

function deltaBadge(value) {
  if (!value) return html`<span class="delta delta--flat" title="Posizione invariata">${icon('minus')}</span>`;
  const positive = value > 0;
  return html`<span class="delta ${positive ? 'delta--up' : 'delta--down'}" title="${positive ? 'Guadagnate' : 'Perse'} ${Math.abs(value)} posizioni">
    ${icon(positive ? 'arrowUp' : 'arrowDown')}${Math.abs(value)}
  </span>`;
}

function posMark(position) {
  const tone = position === 1 ? 'pos--1' : position === 2 ? 'pos--2' : position === 3 ? 'pos--3' : '';
  return html`<span class="pos ${tone}">${position ?? '—'}</span>`;
}

function leaderCard(data, isTeam) {
  const leader = data.leader;
  if (!leader) return emptyState('Classifica non disponibile', 'OpenF1 non ha ancora pubblicato i dati di questa stagione.', 'trophy');

  const second = data.rows[1];
  const meeting = data.meeting;
  const color = isTeam ? leader.color : leader.teamColor;
  const name = isTeam ? leader.team_name : normalizeDriver(leader.driver).full_name;
  const team = isTeam ? `${data.rows.length} squadre in classifica` : leader.driver.team_name;

  return html`<div class="standings-leader" style="--team:${teamColor(color?.replace('#', ''))}">
    ${isTeam
      ? html`<span class="avatar avatar--lg" style="--team:${color}"><span>${initials(leader.team_name)}</span></span>`
      : driverAvatar(leader.driver, { size: 'lg' })}
    <div class="standings-leader__info">
      <p class="standings-leader__eyebrow">Leader ${isTeam ? 'costruttori' : 'piloti'}${meeting ? ` · dopo ${meetingTitle(meeting)}` : ''}</p>
      <p class="standings-leader__name">${name}</p>
      <p class="standings-leader__meta">${team}${second ? ` · ${formatPoints(leader.points - second.points)} punti di vantaggio` : ''}</p>
    </div>
    <div class="standings-leader__points">
      <strong>${formatPoints(leader.points)}</strong>
      <span>punti</span>
    </div>
  </div>`;
}

function driverColumns() {
  return [
    {
      key: 'position',
      label: 'Pos',
      width: '54px',
      sortable: true,
      sortValue: (row) => row.position ?? 999,
      render: (row) => posMark(row.position),
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
      render: (row) => teamBadge(row.driver?.team_name, row.teamColor),
    },
    {
      key: 'points',
      label: 'Punti',
      align: 'right',
      sortable: true,
      sortValue: (row) => row.points,
      render: (row) => html`<strong class="num">${formatPoints(row.points)}</strong>`,
    },
    {
      key: 'gap',
      label: 'Distacco',
      align: 'right',
      hideSm: true,
      sortable: true,
      sortValue: (row) => row.gapToLeader,
      render: (row) => (row.gapToLeader ? html`<span class="num muted">−${formatPoints(row.gapToLeader)}</span>` : html`<span class="muted">—</span>`),
    },
    {
      key: 'delta',
      label: '+/−',
      align: 'center',
      hideSm: true,
      sortable: true,
      sortValue: (row) => row.positionDelta,
      render: (row) => deltaBadge(row.positionDelta),
    },
  ];
}

function teamColumns() {
  return [
    {
      key: 'position',
      label: 'Pos',
      width: '54px',
      sortable: true,
      sortValue: (row) => row.position ?? 999,
      render: (row) => posMark(row.position),
    },
    {
      key: 'team',
      label: 'Costruttore',
      sortable: true,
      sortValue: (row) => row.team_name || '',
      render: (row) => html`<span class="team-name"><span class="team-key" style="--team:${row.color}"></span><strong>${row.team_name}</strong></span>`,
    },
    {
      key: 'points',
      label: 'Punti',
      align: 'right',
      sortable: true,
      sortValue: (row) => row.points,
      render: (row) => html`<strong class="num">${formatPoints(row.points)}</strong>`,
    },
    {
      key: 'gap',
      label: 'Distacco',
      align: 'right',
      sortable: true,
      sortValue: (row) => row.gapToLeader,
      render: (row) => (row.gapToLeader ? html`<span class="num muted">−${formatPoints(row.gapToLeader)}</span>` : html`<span class="muted">—</span>`),
    },
    {
      key: 'delta',
      label: '+/−',
      align: 'center',
      hideSm: true,
      sortable: true,
      sortValue: (row) => row.positionDelta,
      render: (row) => deltaBadge(row.positionDelta),
    },
  ];
}

function pointsStrength(rows) {
  const leaderPoints = rows[0]?.points || 1;
  return html`<div class="rank-list">
    ${rows.slice(0, 6).map((row) => html`<div class="rank-row">
      <span class="pos-badge ${row.position === 1 ? 'pos-badge--1' : row.position === 2 ? 'pos-badge--2' : row.position === 3 ? 'pos-badge--3' : ''}">${row.position ?? '—'}</span>
      <div class="rank-row__main">
        <div class="rank-row__top">
          <span class="rank-row__name"><span class="dot" style="--team:${row.color}"></span> ${row.team_name}</span>
          <span class="mono" style="font-size:11px">${formatPoints(row.points)} PT</span>
        </div>
        <div class="bar" style="margin-top:6px"><span class="bar__fill" style="--team:${row.color};width:${pct(row.points, leaderPoints)}%"></span></div>
      </div>
    </div>`)}
  </div>`;
}

function trendContent(data, history) {
  if (!history.length || !data.rows.length) {
    return emptyState('Andamento non disponibile', 'Servono almeno due Gran Premi completati per disegnare il trend.', 'activity');
  }

  const seriesData = pointsSeriesForDrivers(history, data.rows, 5);
  if (!seriesData.series.length) {
    return emptyState('Andamento non disponibile', 'Non ci sono abbastanza dati per questa stagione.', 'activity');
  }

  const node = document.createElement('div');
  node.className = 'trend-card';
  node.append(
    chartNode({
      series: seriesData.series,
      height: 222,
      ariaLabel: 'Andamento punti dei primi cinque piloti nelle ultime gare',
      xFormat: (value) => seriesData.labels[value - 1] || `R${value}`,
      yFormat: (value) => formatPoints(value),
      tipTitle: (value) => {
        const meeting = seriesData.meetings[value - 1];
        return meeting ? `Round ${meeting.round} · ${meetingTitle(meeting)}` : `Round ${value}`;
      },
      showDots: seriesData.series[0]?.points.length <= 12,
      foot: 'Punti cumulati nelle ultime gare concluse',
    }),
  );
  return node;
}

export function standingsPage({ query } = {}) {
  const catalog = state.catalog;
  const params = query || new URLSearchParams();
  const view = params.get('view') === 'teams' ? 'teams' : 'drivers';
  const isTeam = view === 'teams';

  const el = document.createElement('div');
  el.className = 'page page-enter';
  if (!catalog) {
    el.innerHTML = html`${emptyState('Dati non disponibili', 'Ricarica la pagina per recuperare la stagione.', 'warning')}`;
    return { el, destroy() {} };
  }

  const loadStandings = () => (isTeam ? getTeamStandings(catalog) : getDriverStandings(catalog));
  const latest = catalog.latestCompleted;
  const subtitle = latest
    ? `Dopo ${catalog.completedCount} di ${catalog.totalRounds} Gran Premi · ultimo aggiornamento ${meetingTitle(latest)}.`
    : 'La stagione non è ancora iniziata: le classifiche compariranno dopo il primo Gran Premio.';

  el.innerHTML = html`
    ${pageHead({
      eyebrow: `Stagione ${catalog.year} · ${catalog.completedCount} GP conclusi`,
      title: 'Classifiche',
      subtitle,
      actions: html`<a class="btn" href="#/results">${icon('flag')} Risultati</a><a class="btn" href="#/schedule">${icon('calendar')} Calendario</a>`,
    })}
    <div class="row spread" data-slot="segmented">
      <p class="standings-meta">${latest ? `Aggiornata dopo ${meetingTitle(latest)}` : 'In attesa del primo GP'}</p>
    </div>

    <div data-slot="leader">${html`<div class="skeleton" style="height:108px;border-radius:16px"></div>`}</div>

    <div class="dash-grid">
      <section class="card span-7">
        ${cardHead({
          title: isTeam ? 'Classifica costruttori' : 'Classifica piloti',
          sub: isTeam ? 'Punti sommati dai due piloti di ogni squadra' : 'Punteggio iridato piloti',
          iconName: isTeam ? 'layers' : 'trophy',
        })}
        <div data-slot="table">${skeletonRows(8)}</div>
      </section>

      <div class="dash-col span-5">
        <section class="card">
          ${cardHead({
            title: isTeam ? 'Forza delle squadre' : 'Andamento in campionato',
            sub: isTeam ? 'Punti e distacco dal leader' : 'Ultimi cinque Gran Premi',
            iconName: isTeam ? 'layers' : 'activity',
          })}
          <div data-slot="trend">${isTeam ? skeletonRows(6) : skeletonChart(222)}</div>
        </section>

        <section class="card">
          ${cardHead({ title: 'Dettagli stagione', sub: 'Il quadro del campionato', iconName: 'info' })}
          <div data-slot="info">${skeletonRows(4)}</div>
        </section>
      </div>
    </div>
  `;

  const segmentedSlot = el.querySelector('[data-slot="segmented"]');
  segmentedSlot?.prepend(
    segmentedNode({
      options: [
        { label: 'Piloti', value: 'drivers' },
        { label: 'Costruttori', value: 'teams' },
      ],
      value: view,
      onChange: (value) => navigate(value === 'teams' ? '/standings?view=teams' : '/standings'),
      ariaLabel: 'Tipo di classifica',
    }),
  );

  const leaderSlot = el.querySelector('[data-slot="leader"]');
  const tableSlot = el.querySelector('[data-slot="table"]');
  const trendSlot = el.querySelector('[data-slot="trend"]');
  const infoSlot = el.querySelector('[data-slot="info"]');
  const disposers = [];

  disposers.push(
    asyncSection(leaderSlot, loadStandings, (data) => leaderCard(data, isTeam), {
      skeleton: html`<div class="skeleton" style="height:108px;border-radius:16px"></div>`,
    }),
  );

  disposers.push(
    asyncSection(
      tableSlot,
      loadStandings,
      (data) => {
        if (!data.rows.length) {
          return emptyState(
            'Classifica non disponibile',
            'OpenF1 non ha ancora pubblicato i dati per questa stagione.',
            'trophy',
          );
        }
        return tableNode({
          columns: isTeam ? teamColumns() : driverColumns(),
          rows: data.rows,
          ariaLabel: isTeam ? 'Classifica costruttori' : 'Classifica piloti',
          rowHref: isTeam ? null : (row) => `#/drivers/${row.driver_number}`,
          highlightRow: (row) => row.position === 1,
          sort: { key: 'position', dir: 'asc' },
          caption: latest ? `Dopo il ${meetingTitle(latest)} · dati OpenF1` : 'Dati OpenF1',
        });
      },
      { skeleton: skeletonRows(8) },
    ),
  );

  disposers.push(
    asyncSection(
      trendSlot,
      async () => {
        const [data, history] = await Promise.all([
          loadStandings(),
          isTeam ? Promise.resolve([]) : getStandingsHistory(catalog, 5),
        ]);
        return { data, history };
      },
      ({ data, history }) => (isTeam ? pointsStrength(data.rows) : trendContent(data, history)),
      { skeleton: isTeam ? skeletonRows(6) : skeletonChart(222) },
    ),
  );

  disposers.push(
    asyncSection(
      infoSlot,
      loadStandings,
      (data) => {
        if (!data.rows.length) return emptyState('Nessun dato', 'Le statistiche compariranno con la stagione.', 'info');
        const leader = data.leader;
        const second = data.rows[1];
        return html`<div class="weather-grid">
          ${miniStat('Leader', isTeam ? leader?.team_name || '—' : leader?.driver?.name_acronym || '—')}
          ${miniStat('Punti leader', leader ? formatPoints(leader.points) : '—', { suffix: 'PT' })}
          ${miniStat('Vantaggio 2°', second ? formatPoints(leader.points - second.points) : '—', { suffix: 'PT' })}
          ${miniStat(isTeam ? 'Squadre' : 'Piloti', data.rows.length, { suffix: 'in classifica' })}
        </div>`;
      },
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
