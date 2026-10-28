import { html, icon } from '../core/dom.js';
import {
  countryFlag,
  countryName,
  formatCountdownShort,
  formatDate,
  formatDateRange,
  formatTime,
  meetingTitle,
  pct,
  sessionLabel,
} from '../core/format.js';
import { state } from '../core/store.js';
import { cardHead, emptyState, miniStat, pageHead } from '../core/page.js';

function monthKey(iso) {
  const date = new Date(iso);
  return `${date.getFullYear()}-${date.getMonth()}`;
}

function monthLabel(iso) {
  return new Intl.DateTimeFormat('it-IT', { month: 'long', year: 'numeric' }).format(new Date(iso));
}

function statusBadge(meeting, nextRace) {
  if (meeting.cancelled) return html`<span class="badge badge--dnf">Annullato</span>`;
  if (meeting.testing) return html`<span class="badge badge--dark">Test</span>`;
  if (meeting.status === 'live') return html`<span class="badge badge--live">Live</span>`;
  if (meeting.status === 'completed') return html`<span class="badge">Concluso</span>`;
  if (nextRace && meeting.meeting_key === nextRace.meeting_key) return html`<span class="badge badge--accent">Prossimo</span>`;
  return html`<span class="faint small">${formatCountdownShort(meeting.race?.date_start || meeting.date_start)}</span>`;
}

function calendarRow(meeting, nextRace) {
  const statusClass = meeting.cancelled ? 'calendar-row--cancelled' : meeting.meeting_key === nextRace?.meeting_key ? 'calendar-row--next' : '';
  return html`<a class="calendar-row ${statusClass}" href="#/schedule?meeting=${meeting.meeting_key}" aria-label="${meetingTitle(meeting)}, ${formatDateRange(meeting.date_start, meeting.date_end)}">
    <span class="calendar-row__round">${meeting.round ?? '—'}</span>
    <span class="calendar-row__flag" aria-hidden="true">${countryFlag(meeting.country_code)}</span>
    <span class="calendar-row__main">
      <span class="calendar-row__name">${meetingTitle(meeting)}</span>
      <span class="calendar-row__meta">
        <span>${meeting.circuit_short_name || meeting.location || '—'}</span>
        <span>${countryName(meeting.country_name)}</span>
        ${meeting.sprint ? html`<span class="badge badge--sprint">Sprint</span>` : null}
        ${meeting.testing ? html`<span class="badge badge--dark">Test</span>` : null}
      </span>
    </span>
    <span class="calendar-row__date">${formatDateRange(meeting.date_start, meeting.date_end)}</span>
    <span class="calendar-row__status">${statusBadge(meeting, nextRace)}</span>
  </a>`;
}

function calendarMarkup(meetings, nextRace) {
  let currentMonth = null;
  const parts = [];
  meetings.forEach((meeting) => {
    const key = monthKey(meeting.date_start);
    if (key !== currentMonth) {
      currentMonth = key;
      parts.push(html`<p class="calendar-month">${monthLabel(meeting.date_start)}</p>`);
    }
    parts.push(calendarRow(meeting, nextRace));
  });
  return html`<div class="calendar-list">${parts}</div>`;
}

function detailCard(meeting) {
  const race = meeting.race;
  return html`
    <section class="result-hero">
      <div class="result-hero__race">
        <p class="result-hero__round">${meeting.testing ? 'Test prestagionali' : meeting.cancelled ? 'Evento annullato' : `Round ${meeting.round ?? '—'}`} ${meeting.sprint ? '· Weekend Sprint' : ''}</p>
        <h2 class="result-hero__title">${meetingTitle(meeting)}</h2>
        <div class="result-hero__meta">
          <span>${icon('calendar')} ${formatDateRange(meeting.date_start, meeting.date_end)}</span>
          <span>${icon('mapPin')} ${meeting.circuit_short_name || meeting.location || '—'}</span>
          <span>${icon('flag')} ${countryName(meeting.country_name)}</span>
          ${race ? html`<span>${icon('clock')} Gara ${formatDate(race.date_start, { weekday: true })} · ${formatTime(race.date_start)}</span>` : null}
        </div>
      </div>
      <div class="result-hero__flag" aria-hidden="true">${countryFlag(meeting.country_code)}</div>
    </section>

    <div class="dash-grid">
      <section class="card span-7">
        ${cardHead({ title: 'Sessioni del weekend', sub: `${meeting.sessions.length} sessioni in programma`, iconName: 'calendar' })}
        ${meeting.sessions.length
          ? html`<div class="session-list">
              ${meeting.sessions.map((session) => html`<div class="session-row ${session.session_key === meeting.liveSession?.session_key ? 'is-live' : ''}">
                <span class="session-row__time">${formatTime(session.date_start)}</span>
                <span class="session-row__name">${sessionLabel(session.session_name)}</span>
                <span class="session-row__date">${formatDate(session.date_start, { weekday: true })}</span>
                ${session.session_key === meeting.liveSession?.session_key ? html`<span class="badge badge--live">Live</span>` : null}
              </div>`)}
            </div>`
          : emptyState('Nessuna sessione', 'Gli orari delle sessioni non sono ancora disponibili.', 'calendar')}
        <div class="row" style="margin-top:14px;flex-wrap:wrap">
          ${meeting.status === 'completed' && race
            ? html`<a class="btn btn--primary" href="#/results?meeting=${meeting.meeting_key}&session=${race.session_key}">${icon('flag')} Risultati del GP</a>`
            : null}
          ${meeting.status === 'live'
            ? html`<a class="btn btn--primary" href="#/live">${icon('radio')} Segui il live</a>`
            : null}
          <a class="btn" href="#/schedule">${icon('arrowLeft')} Torna al calendario</a>
        </div>
      </section>

      <div class="dash-col span-5">
        <section class="card">
          ${cardHead({ title: 'Weekend', sub: 'Informazioni rapide', iconName: 'info' })}
          <div class="weather-grid">
            ${miniStat('Round', meeting.round ?? '—')}
            ${miniStat('Sessioni', meeting.sessions.length)}
            ${miniStat('Format', meeting.sprint ? 'Sprint' : meeting.testing ? 'Test' : 'Classico')}
            ${miniStat('Stato', meeting.cancelled ? 'Annullato' : meeting.status === 'completed' ? 'Concluso' : meeting.status === 'live' ? 'In corso' : 'In arrivo')}
          </div>
        </section>

        ${meeting.status === 'upcoming' && race
          ? html`<section class="card">
              ${cardHead({ title: 'Al via tra', sub: `${meetingTitle(meeting)} · gara`, iconName: 'clock' })}
              <f1-countdown end="${race.date_start}"></f1-countdown>
              <p class="faint small" style="margin-top:12px">Orari mostrati nel tuo fuso locale.</p>
            </section>`
          : null}

        ${meeting.cancelled
          ? html`<section class="card">${emptyState('Evento annullato', 'Questo appuntamento è stato rimosso dal calendario ufficiale.', 'warning')}</section>`
          : null}
      </div>
    </div>
  `;
}

function nextHero(catalog) {
  const next = catalog.liveMeeting || catalog.nextRace;
  if (!next) {
    const last = catalog.latestCompleted;
    return html`<section class="hero">
      <span class="hero__flag" aria-hidden="true">${last ? countryFlag(last.country_code) : '🏁'}</span>
      <div class="hero__content">
        <div class="hero__eyebrow"><span class="badge">Stagione ${catalog.year}</span></div>
        <h2 class="hero__title">${last ? meetingTitle(last) : 'Stagione conclusa'}</h2>
        <p class="page-head__sub" style="margin-top:12px">Il calendario ${catalog.year} è terminato. Consulta i risultati dell'ultimo Gran Premio o le classifiche finali.</p>
        <div class="hero__actions">
          <a class="btn btn--primary" href="#/results">Ultimo Gran Premio</a>
          <a class="btn" href="#/standings">Classifiche finali</a>
        </div>
      </div>
    </section>`;
  }

  const isLive = next.status === 'live';
  const session = isLive ? next.liveSession : next.race || next.firstSession;
  return html`<section class="hero ${isLive ? 'hero--live' : ''}">
    <span class="hero__flag" aria-hidden="true">${countryFlag(next.country_code)}</span>
    <div class="hero__content">
      <div class="hero__eyebrow">
        ${isLive ? html`<span class="live-dot">Live</span>` : html`<span class="badge badge--accent">Round ${next.round ?? '—'} / ${catalog.totalRounds}</span>`}
        <span class="eyebrow">${isLive ? 'Sessione in corso' : 'Prossimo appuntamento'}</span>
      </div>
      <h2 class="hero__title">${meetingTitle(next)}</h2>
      <div class="hero__meta">
        <span>${icon('mapPin')} ${next.circuit_short_name || next.location || '—'}</span>
        <span>${icon('calendar')} ${formatDateRange(next.date_start, next.date_end)}</span>
        ${session ? html`<span>${icon('clock')} ${sessionLabel(session.session_name)} · ${formatTime(session.date_start)}</span>` : null}
      </div>
      <div class="hero__actions">
        <a class="btn btn--primary" href="#/schedule?meeting=${next.meeting_key}">${icon('calendar')} Dettagli weekend</a>
        <a class="btn" href="${isLive ? '#/live' : '#/standings'}">${isLive ? 'Segui il live' : 'Classifiche'}</a>
      </div>
    </div>
    <div class="hero__side">
      <div class="hero__side-label"><span>${isLive ? 'Sessione' : 'Al via tra'}</span><span>${countryName(next.country_name)}</span></div>
      ${isLive
        ? html`<p style="font-family:var(--font-display);font-size:1.6rem;font-weight:740;letter-spacing:-.02em">${session ? sessionLabel(session.session_name) : 'Live'}</p>`
        : html`<f1-countdown end="${next.race?.date_start || next.date_start}"></f1-countdown>`}
      <p class="hero__note"><strong>${meetingTitle(next)}</strong> · ${next.sessions.length} sessioni${next.sprint ? ' con format Sprint' : ''}. Orari nel tuo fuso locale.</p>
    </div>
  </section>`;
}

export function schedulePage({ query } = {}) {
  const catalog = state.catalog;
  const params = query || new URLSearchParams();
  const el = document.createElement('div');
  el.className = 'page page-enter';
  if (!catalog) {
    el.innerHTML = html`${emptyState('Dati non disponibili', 'Ricarica la pagina per recuperare il calendario.', 'warning')}`;
    return { el, destroy() {} };
  }

  const selectedKey = Number(params.get('meeting'));
  const selected = catalog.byKey.get(selectedKey) || null;
  const progress = catalog.totalRounds ? Math.round(pct(catalog.completedCount, catalog.totalRounds)) : 0;

  el.innerHTML = html`
    ${pageHead({
      eyebrow: `Stagione ${catalog.year} · Calendario`,
      title: 'Calendario',
      subtitle: `${catalog.totalRounds} Gran Premi in programma · ${catalog.completedCount} conclusi. Seleziona un appuntamento per vedere le sessioni.`,
      actions: html`<a class="btn" href="#/results">${icon('flag')} Risultati</a><a class="btn" href="#/standings">${icon('trophy')} Classifiche</a>`,
    })}

    <section class="calendar-progress" aria-label="Avanzamento stagione">
      <span class="calendar-progress__label">${catalog.completedCount} / ${catalog.totalRounds} GP</span>
      <div class="calendar-progress__bar"><span style="width:${progress}%"></span></div>
      <span class="calendar-progress__label">${progress}%</span>
    </section>

    ${selected ? detailCard(selected) : nextHero(catalog)}

    <section class="card">
      ${cardHead({
        title: 'Tutti gli appuntamenti',
        sub: 'Calendario ufficiale della stagione',
        iconName: 'list',
      })}
      ${catalog.meetings.length
        ? calendarMarkup(catalog.meetings, catalog.nextRace)
        : emptyState('Calendario non disponibile', 'OpenF1 non ha pubblicato il calendario per questa stagione.', 'calendar')}
    </section>
  `;

  return { el, destroy() {} };
}
