import { html, icon } from '../core/dom.js';
import {
  countryFlag,
  formatDateRange,
  formatGap,
  formatLapTime,
  meetingTitle,
  shortDriverName,
  teamColor,
} from '../core/format.js';
import { driverAvatar, normalizeDriver } from './driver.js';

export function raceCard(meeting, rows = []) {
  if (!meeting) return null;
  const podium = rows.filter((row) => row.position && row.position <= 3).slice(0, 3);
  const winner = podium[0] || rows[0] || null;
  const winnerDriver = winner?.driver ? normalizeDriver(winner.driver) : null;

  return html`<a class="race-card" href="#/results?meeting=${meeting.meeting_key}">
    <div class="race-card__head">
      <div>
        <p class="race-card__round">${meeting.round ? `Round ${meeting.round}` : 'Gran Premio'}</p>
        <p class="race-card__name">${meetingTitle(meeting)}</p>
        <p class="race-card__meta">${meeting.circuit_short_name || meeting.location || ''} · ${formatDateRange(meeting.date_start, meeting.date_end)}</p>
      </div>
      <span class="race-card__flag" aria-hidden="true">${countryFlag(meeting.country_code)}</span>
    </div>
    ${winner && winnerDriver
      ? html`<div class="race-card__winner">
          ${driverAvatar(winnerDriver, { size: 'sm' })}
          <div class="race-card__winner-text">
            <span>Vincitore</span>
            <strong>${shortDriverName(winnerDriver)}</strong>
          </div>
          <span class="race-card__flag" aria-hidden="true" style="margin-left:auto;font-size:15px">🏆</span>
        </div>`
      : null}
    ${podium.length > 1
      ? html`<div class="race-card__podium">
          ${podium.map((row) => html`<div class="race-card__podium-row">
            <span class="pos pos--${row.position}">${row.position}</span>
            <span class="dot" style="--team:${teamColor(row.driver?.team_colour)}"></span>
            <span>${shortDriverName(row.driver)}</span>
            <span class="muted" style="margin-left:auto">${row.position === 1 ? '—' : formatGap(row.gap_to_leader, { leader: '—' })}</span>
          </div>`)}
        </div>`
      : null}
  </a>`;
}

const TYRE_INFO = {
  SOFT: { key: 'soft', letter: 'S', label: 'Soft' },
  MEDIUM: { key: 'medium', letter: 'M', label: 'Medium' },
  HARD: { key: 'hard', letter: 'H', label: 'Hard' },
  INTERMEDIATE: { key: 'intermediate', letter: 'I', label: 'Inter' },
  WET: { key: 'wet', letter: 'W', label: 'Wet' },
};

export function tyreBadge(compound) {
  if (!compound) return html`<span class="muted">—</span>`;
  const info = TYRE_INFO[String(compound).toUpperCase()] || { key: 'unknown', letter: '?', label: compound };
  return html`<span class="tyre tyre--${info.key}"><span class="tyre__ring">${info.letter}</span>${info.label}</span>`;
}

export function positionBadge(position) {
  if (!position) return html`<span class="pos-badge">—</span>`;
  const cls = position === 1 ? 'pos-badge--1' : position === 2 ? 'pos-badge--2' : position === 3 ? 'pos-badge--3' : '';
  return html`<span class="pos-badge ${cls}">${position}</span>`;
}

export function gapOrStatus(row) {
  if (row.dsq) return html`<span class="badge badge--dnf">DSQ</span>`;
  if (row.dns) return html`<span class="badge">DNS</span>`;
  if (row.dnf) return html`<span class="badge badge--dnf">DNF</span>`;
  if (row.gap_to_leader === 0) return html`<span class="muted">—</span>`;
  if (typeof row.gap_to_leader === 'string') return html`<span class="badge badge--warning">${row.gap_to_leader}</span>`;
  if (row.gap_to_leader == null) return html`<span class="muted">—</span>`;
  return html`<span class="mono">${formatGap(row.gap_to_leader, { leader: '—' })}</span>`;
}

export function weatherTile(iconName, value, label) {
  return html`<div class="weather-item">
    ${icon(iconName)}
    <div>
      <p class="weather-item__value">${value}</p>
      <p class="weather-item__label">${label}</p>
    </div>
  </div>`;
}

export function lapTimeCell(seconds, { highlight = false } = {}) {
  return html`<span class="mono ${highlight ? 'accent' : ''}">${formatLapTime(seconds)}</span>`;
}

export function sessionBadge(name) {
  if (!name) return null;
  if (name === 'Sprint') return html`<span class="badge badge--sprint">Sprint</span>`;
  if (name === 'Sprint Qualifying') return html`<span class="badge badge--sprint">Qual. Sprint</span>`;
  if (name === 'Race') return html`<span class="badge badge--accent">Gara</span>`;
  if (name === 'Qualifying') return html`<span class="badge">Qualifica</span>`;
  return html`<span class="badge">${name}</span>`;
}
