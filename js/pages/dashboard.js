import { html, icon } from '../core/dom.js';
import {
  countryFlag,
  countryName,
  formatCountdownShort,
  formatDateRange,
  formatDate,
  formatLapTime,
  formatPoints,
  formatTime,
  meetingTitle,
  pct,
  shortSessionLabel,
} from '../core/format.js';
import { state } from '../core/store.js';
import { asyncSection, cardHead, emptyState, pageHead } from '../core/page.js';
import { getDriverStandings, getTeamStandings } from '../data/standings.js';
import { fetchRecentRaces } from '../data/results.js';
import { fastestLaps, getSessionLaps } from '../data/laps.js';
import { getMeetingDrivers } from '../data/drivers.js';
import { raceCard } from '../components/race.js';
import { driverName, normalizeDriver } from '../components/driver.js';
import { statCard, statSkeleton } from '../components/stats.js';

function heroMarkup(catalog) {
  const live = catalog.liveMeeting;
  if (live) {
    const session = catalog.liveSession;
    return html`<section class="hero hero--live">
      <span class="hero__flag" aria-hidden="true">${countryFlag(live.country_code)}</span>
      <div class="hero__content">
        <div class="hero__eyebrow">
          <span class="live-dot">Live</span>
          <span class="eyebrow">${session ? shortSessionLabel(session.session_name) : 'Sessione in corso'}</span>
        </div>
        <h2 class="hero__title">${meetingTitle(live)}</h2>
        <div class="hero__meta">
          <span>${icon('mapPin')} ${live.circuit_short_name || live.location}</span>
          <span>${icon('calendar')} ${formatDateRange(live.date_start, live.date_end)}</span>
          ${session ? html`<span>${icon('clock')} Iniziata alle ${formatTime(session.date_start)}</span>` : null}
        </div>
        <div class="hero__actions">
          <a class="btn btn--primary" href="#/live">${icon('radio')} Segui il live</a>
          <a class="btn" href="#/results">Ultimi risultati</a>
        </div>
      </div>
      <div class="hero__side">
        <div class="hero__side-label"><span>Stato sessione</span><span class="badge badge--live">In corso</span></div>
        <p style="font-family:var(--font-display);font-size:1.6rem;font-weight:740;letter-spacing:-.02em">${session ? shortSessionLabel(session.session_name) : 'Live'}</p>
        <p class="hero__note"><strong>${meetingTitle(live)}</strong> · ${live.circuit_short_name || ''}. Posizioni e distacchi si aggiornano automaticamente ogni 15 secondi.</p>
        <a class="btn btn--sm" href="#/live">Apri la diretta ${icon('chevronRight')}</a>
      </div>
    </section>`;
  }

  const next = catalog.nextRace;
  if (!next) {
    const last = catalog.latestCompleted;
    return html`<section class="hero">
      <span class="hero__flag" aria-hidden="true">${last ? countryFlag(last.country_code) : '🏁'}</span>
      <div class="hero__content">
        <div class="hero__eyebrow"><span class="badge">Stagione ${catalog.year}</span></div>
        <h2 class="hero__title">${last ? meetingTitle(last) : 'Stagione conclusa'}</h2>
        <p class="page-head__sub" style="margin-top:12px">Il calendario ${catalog.year} è terminato. Rivivi l'ultimo Gran Premio o consulta le classifiche finali.</p>
        <div class="hero__actions">
          <a class="btn btn--primary" href="#/results">Ultimo Gran Premio</a>
          <a class="btn" href="#/standings">Classifiche finali</a>
        </div>
      </div>
    </section>`;
  }

  const raceDate = next.race?.date_start;
  return html`<section class="hero">
    <span class="hero__flag" aria-hidden="true">${countryFlag(next.country_code)}</span>
    <div class="hero__content">
      <div class="hero__eyebrow">
        <span class="badge badge--accent">Round ${next.round} / ${catalog.totalRounds}</span>
        <span class="eyebrow">Prossimo Gran Premio</span>
      </div>
      <h2 class="hero__title">${meetingTitle(next)}</h2>
      <div class="hero__meta">
        <span>${icon('mapPin')} ${next.circuit_short_name || next.location}</span>
        <span>${icon('calendar')} ${formatDateRange(next.date_start, next.date_end)}</span>
        ${raceDate ? html`<span>${icon('clock')} Gara ${formatTime(raceDate)}</span>` : null}
      </div>
      <div class="hero__actions">
        <a class="btn btn--primary" href="#/schedule">Dettagli weekend</a>
        <a class="btn" href="#/standings">${icon('trophy')} Classifiche</a>
      </div>
    </div>
    <div class="hero__side">
      <div class="hero__side-label"><span>Al via tra</span><span>${countryName(next.country_name)}</span></div>
      <f1-countdown end="${raceDate || next.date_start}"></f1-countdown>
      <p class="hero__note">Il weekend prevede ${next.sessions.length} sessioni${next.sprint ? ' con format Sprint' : ''}. Orari nel tuo fuso locale.</p>
      <a class="card__link" href="#/live">Vai al centro live ${icon('chevronRight')}</a>
    </div>
  </section>`;
}

function leaderStat({ label, value, hint, iconName, accent, accentSoft }) {
  return statCard({ label, value, hint, iconName, accent, accentSoft });
}

function driverRankRow(row, leaderPoints) {
  const driver = normalizeDriver(row.driver);
  const width = pct(row.points, leaderPoints);
  return html`<a class="rank-row" href="#/drivers/${driver.driver_number}">
    <span class="pos-badge ${row.position === 1 ? 'pos-badge--1' : row.position === 2 ? 'pos-badge--2' : row.position === 3 ? 'pos-badge--3' : ''}">${row.position ?? '—'}</span>
    <div class="rank-row__main">
      <div class="rank-row__top"><span class="rank-row__name">${driverName(driver)}</span></div>
      <div class="rank-row__sub"><span class="dot" style="--team:${row.teamColor}"></span> ${driver.team_name}${row.pointsGain > 0 ? ` · +${formatPoints(row.pointsGain)} nell'ultimo GP` : ''}</div>
      <div class="bar" style="margin-top:6px"><span class="bar__fill" style="width:${width}%"></span></div>
    </div>
    <span class="rank-row__value">${formatPoints(row.points)}<small>PT</small></span>
  </a>`;
}

function teamRankRow(row, leaderPoints) {
  const width = pct(row.points, leaderPoints);
  return html`<a class="rank-row" href="#/standings">
    <span class="pos-badge ${row.position === 1 ? 'pos-badge--1' : row.position === 2 ? 'pos-badge--2' : row.position === 3 ? 'pos-badge--3' : ''}">${row.position ?? '—'}</span>
    <div class="rank-row__main">
      <div class="rank-row__top"><span class="rank-row__name"><span class="dot" style="--team:${row.color}"></span> ${row.team_name}</span></div>
      <div class="bar" style="margin-top:6px"><span class="bar__fill" style="--team:${row.color};width:${width}%"></span></div>
    </div>
    <span class="rank-row__value">${formatPoints(row.points)}<small>PT</small></span>
  </a>`;
}

function upcomingMarkup(catalog) {
  const meetings = catalog.upcomingRaces.slice(0, 3);
  if (!meetings.length) {
    return emptyState('Nessuna gara in programma', 'Il calendario della stagione è terminato.', 'flag');
  }
  return html`<div class="upcoming-list">
    ${meetings.map((meeting) => html`<a class="upcoming-row" href="#/schedule">
      <span class="upcoming-row__flag" aria-hidden="true">${countryFlag(meeting.country_code)}</span>
      <span class="upcoming-row__main">
        <span class="upcoming-row__name">${meetingTitle(meeting)}</span>
        <span class="upcoming-row__date">${meeting.circuit_short_name || meeting.location} · ${formatDate(meeting.date_start)}</span>
      </span>
      <span class="upcoming-row__when">${formatCountdownShort(meeting.race?.date_start || meeting.date_start)}</span>
    </a>`)}
  </div>`;
}

export function dashboardPage() {
  const { catalog } = state;
  if (!catalog) {
    return { el: Object.assign(document.createElement('div'), { className: 'page', innerHTML: '<p>Dati non disponibili.</p>' }) };
  }

  const latest = catalog.latestCompleted;
  const el = document.createElement('div');
  el.className = 'page page-enter';
  const disposers = [];

  el.innerHTML = html`
    ${pageHead({
      eyebrow: `Stagione ${catalog.year} · ${catalog.completedCount} di ${catalog.totalRounds} GP`,
      title: 'Panoramica stagione',
      subtitle: 'Classifiche aggiornate, risultati degli ultimi Gran Premi e migliori tempi sul giro. Dati aperti OpenF1.',
      actions: html`<a class="btn" href="#/results">${icon('flag')} Ultimi risultati</a><a class="btn btn--primary" href="#/standings">${icon('trophy')} Classifiche</a>`,
    })}
    ${heroMarkup(catalog)}

    <div class="stats-grid">
      <div data-slot="stat-races">
        ${statCard({
          label: 'Gare disputate',
          value: html`${catalog.completedCount}<small>/ ${catalog.totalRounds}</small>`,
          hint: latest ? `Ultima: ${meetingTitle(latest)}` : 'Stagione non ancora iniziata',
          iconName: 'flag',
        })}
      </div>
      <div data-slot="stat-driver">${statSkeleton('Leader piloti')}</div>
      <div data-slot="stat-team">${statSkeleton('Leader costruttori')}</div>
      <div>
        ${statCard({
          label: catalog.liveSession ? 'Sessione live' : 'Prossimo GP',
          value: catalog.liveSession
            ? shortSessionLabel(catalog.liveSession.session_name)
            : catalog.nextRace
              ? meetingTitle(catalog.nextRace)
              : 'Stagione conclusa',
          hint: catalog.liveSession
            ? `${meetingTitle(catalog.liveMeeting)} · in corso`
            : catalog.nextRace
              ? `${formatCountdownShort(catalog.nextRace.race?.date_start)} · ${formatDate(catalog.nextRace.date_start)}`
              : 'Nessuna gara in programma',
          iconName: catalog.liveSession ? 'radio' : 'calendar',
          accent: catalog.liveSession ? '#2ee6a8' : '#58a6ff',
          accentSoft: catalog.liveSession ? 'rgba(46,230,168,.12)' : 'rgba(88,166,255,.12)',
        })}
      </div>
    </div>

    <div class="dash-grid">
      <section class="card span-6">
        ${cardHead({
          title: 'Classifica piloti',
          sub: latest ? `Dopo il ${meetingTitle(latest)}` : 'Stagione non iniziata',
          href: '#/standings',
          linkLabel: 'Tutte',
          iconName: 'trophy',
        })}
        <div data-slot="driver-ranks"></div>
      </section>

      <section class="card span-6">
        ${cardHead({
          title: 'Classifica costruttori',
          sub: latest ? `Dopo il ${meetingTitle(latest)}` : 'Stagione non iniziata',
          href: '#/standings',
          linkLabel: 'Tutte',
          iconName: 'layers',
        })}
        <div data-slot="team-ranks"></div>
      </section>

      <section class="card span-7">
        ${cardHead({
          title: 'Ultimi Gran Premi',
          sub: 'Gli ultimi tre appuntamenti del calendario',
          href: '#/results',
          linkLabel: 'Tutti i risultati',
          iconName: 'flag',
        })}
        <div data-slot="recent-races"></div>
      </section>

      <div class="dash-col span-5">
        <section class="card">
          ${cardHead({
            title: 'Giro più veloce',
            sub: latest ? meetingTitle(latest) : 'Nessun GP completato',
            href: latest?.race ? `#/laps?session=${latest.race.session_key}` : '#/laps',
            linkLabel: 'Tempi sul giro',
            iconName: 'timer',
          })}
          <div data-slot="fastest-laps"></div>
        </section>
        <section class="card">
          ${cardHead({
            title: 'Prossime gare',
            sub: 'Il calendario che verrà',
            href: '#/schedule',
            linkLabel: 'Calendario',
            iconName: 'calendar',
          })}
          ${upcomingMarkup(catalog)}
        </section>
      </div>
    </div>
  `;

  const statDriverSlot = el.querySelector('[data-slot="stat-driver"]');
  const statTeamSlot = el.querySelector('[data-slot="stat-team"]');
  const driverSlot = el.querySelector('[data-slot="driver-ranks"]');
  const teamSlot = el.querySelector('[data-slot="team-ranks"]');
  const recentSlot = el.querySelector('[data-slot="recent-races"]');
  const fastestSlot = el.querySelector('[data-slot="fastest-laps"]');

  disposers.push(
    asyncSection(
      statDriverSlot,
      () => getDriverStandings(catalog),
      (data) => {
        if (!data.leader) return statCard({ label: 'Leader piloti', value: '—', hint: 'Classifica non disponibile', iconName: 'trophy' });
        const driver = normalizeDriver(data.leader.driver);
        const second = data.rows[1];
        return leaderStat({
          label: 'Leader piloti',
          value: html`<span style="color:${data.leader.teamColor}">${driver.name_acronym}</span> <small>${formatPoints(data.leader.points)} PT</small>`,
          hint: second ? `${driver.last_name} · ${formatPoints(data.leader.points - second.points)} punti sul 2°` : driver.team_name,
          iconName: 'trophy',
          accent: data.leader.teamColor,
          accentSoft: 'rgba(255,255,255,.05)',
        });
      },
      { skeleton: statSkeleton('Leader piloti') },
    ),
  );

  disposers.push(
    asyncSection(
      statTeamSlot,
      () => getTeamStandings(catalog),
      (data) => {
        if (!data.leader) return statCard({ label: 'Leader costruttori', value: '—', hint: 'Classifica non disponibile', iconName: 'layers' });
        const second = data.rows[1];
        return statCard({
          label: 'Leader costruttori',
          value: html`<span class="dot" style="--team:${data.leader.color};display:inline-block;vertical-align:3px;margin-right:6px"></span>${data.leader.team_name}`,
          hint: second ? `${formatPoints(data.leader.points - second.points)} punti sul 2° · ${formatPoints(data.leader.points)} PT` : `${formatPoints(data.leader.points)} PT`,
          iconName: 'layers',
          accent: data.leader.color,
          accentSoft: 'rgba(255,255,255,.05)',
        });
      },
      { skeleton: statSkeleton('Leader costruttori') },
    ),
  );

  disposers.push(
    asyncSection(driverSlot, () => getDriverStandings(catalog), (data) => {
      if (!data.rows.length) return emptyState('Classifica non disponibile', 'OpenF1 non ha ancora pubblicato i dati per questa stagione.', 'trophy');
      const leaderPoints = data.rows[0].points || 1;
      return html`<div class="rank-list">${data.rows.slice(0, 5).map((row) => driverRankRow(row, leaderPoints))}</div>`;
    }),
  );

  disposers.push(
    asyncSection(teamSlot, () => getTeamStandings(catalog), (data) => {
      if (!data.rows.length) return emptyState('Classifica non disponibile', 'OpenF1 non ha ancora pubblicato i dati per questa stagione.', 'layers');
      const leaderPoints = data.rows[0].points || 1;
      return html`<div class="rank-list">${data.rows.slice(0, 5).map((row) => teamRankRow(row, leaderPoints))}</div>`;
    }),
  );

  disposers.push(
    asyncSection(recentSlot, () => fetchRecentRaces(catalog, 3), (races) => {
      if (!races.length) return emptyState('Nessun GP completato', 'I risultati compariranno dopo il primo Gran Premio della stagione.', 'flag');
      return html`<div class="race-stack">${races.map(({ meeting, rows }) => raceCard(meeting, rows))}</div>`;
    }),
  );

  disposers.push(
    asyncSection(
      fastestSlot,
      async () => {
        if (!latest?.race) return null;
        const [lapsData, driverMap] = await Promise.all([
          getSessionLaps(latest.race.session_key),
          getMeetingDrivers(latest.meeting_key),
        ]);
        return { lapsData, driverMap, meeting: latest };
      },
      (data) => {
        if (!data?.lapsData) return emptyState('Nessun dato sui giri', 'I tempi sul giro non sono disponibili per l\'ultimo GP.', 'timer');
        const rows = fastestLaps(data.lapsData, data.driverMap, 5);
        if (!rows.length) return emptyState('Nessun giro completato', 'OpenF1 non ha registrato tempi sul giro.', 'timer');
        return html`<div class="rank-list">
          ${rows.map((row, index) => {
            const driver = normalizeDriver(row.driver);
            return html`<a class="rank-row" href="#/laps?session=${data.meeting.race.session_key}&driver=${row.driver_number}">
              <span class="pos pos--${index + 1}" style="font-size:12px">${index + 1}</span>
              <div class="rank-row__main">
                <div class="rank-row__top">
                  <span class="rank-row__name">${driverName(driver)}</span>
                  <span class="mono" style="font-size:11px">${formatLapTime(row.lap_duration)}</span>
                </div>
                <div class="rank-row__sub"><span class="dot" style="--team:${driver.team_colour ? `#${driver.team_colour}` : '#9aa3b2'}"></span> ${driver.team_name} · giro ${row.lap_number}</div>
              </div>
              <span class="rank-row__value">${row.gap === 0 ? html`<span class="badge badge--accent">Best</span>` : `+${row.gap.toFixed(3)}`}</span>
            </a>`;
          })}
        </div>`;
      },
      { skeleton: html`<div class="skeleton-stack">${Array.from({ length: 5 }, () => html`<div class="skeleton skeleton--row"></div>`)}</div>` },
    ),
  );

  return {
    el,
    destroy() {
      disposers.forEach((dispose) => dispose());
    },
  };
}
