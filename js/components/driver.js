import { html } from '../core/dom.js';
import { teamColor, ordinal, formatPoints, clamp } from '../core/format.js';

export function normalizeDriver(driver = {}) {
  const fullName = driver.full_name || '';
  const nameParts = fullName.trim().split(/\s+/);
  return {
    driver_number: Number(driver.driver_number) || 0,
    name_acronym: driver.name_acronym || driver.acronym || '—',
    first_name: driver.first_name || (nameParts.length > 1 ? nameParts.slice(0, -1).join(' ') : ''),
    last_name: driver.last_name || (nameParts.length ? nameParts[nameParts.length - 1] : ''),
    full_name: fullName || `${driver.first_name || ''} ${driver.last_name || ''}`.trim(),
    team_name: driver.team_name || driver.team || '—',
    team_colour: driver.team_colour || driver.teamColor || '',
    headshot_url: driver.headshot_url || null,
    country_code: driver.country_code || null,
  };
}

export function driverAvatar(driver, { size = '', photo = false, number = false } = {}) {
  const data = normalizeDriver(driver);
  const color = teamColor(data.team_colour);
  const sizeClass = size ? `avatar--${size}` : '';
  return html`<span class="avatar ${sizeClass}" style="--team:${color}" aria-hidden="true">
    ${photo && data.headshot_url ? html`<img src="${data.headshot_url}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : null}
    <span>${data.name_acronym}</span>
    ${number ? html`<span class="avatar__num">${data.driver_number}</span>` : null}
  </span>`;
}

export function driverName(driver, { short = false } = {}) {
  const data = normalizeDriver(driver);
  const first = data.first_name;
  const last = data.last_name;
  if (short) return last || data.name_acronym;
  if (first && last) {
    return html`${first} <strong>${last}</strong>`;
  }
  return html`<strong>${data.full_name || data.name_acronym}</strong>`;
}

export function driverCell(driver, { showTeam = true, compact = false, showNumber = false } = {}) {
  const data = normalizeDriver(driver);
  const color = teamColor(data.team_colour);
  return html`<div class="driver-cell ${compact ? 'driver-cell--compact' : ''}">
    ${driverAvatar(data, { size: 'sm', number: showNumber })}
    <div class="driver-cell__text">
      <div class="driver-cell__name">${driverName(data)}</div>
      ${showTeam
        ? html`<div class="driver-cell__meta"><span class="dot" style="--team:${color}"></span>${data.team_name}</div>`
        : null}
    </div>
  </div>`;
}

export function teamBadge(name, color) {
  return html`<span class="team-name"><span class="dot" style="--team:${teamColor(color)}"></span>${name || '—'}</span>`;
}

export function driverCard(driver, { position = null, points = null } = {}) {
  const data = normalizeDriver(driver);
  const color = teamColor(data.team_colour);
  const pos = position ?? driver.position_current ?? null;
  const pts = points ?? driver.points_current ?? null;
  const posClass = pos === 1 ? 'pos-badge--1' : pos === 2 ? 'pos-badge--2' : pos === 3 ? 'pos-badge--3' : '';
  return html`<a class="driver-card" href="#/drivers/${data.driver_number}" style="--team:${color}" aria-label="${data.full_name}, ${data.team_name}">
    <span class="driver-card__num" aria-hidden="true">${data.driver_number}</span>
    <div class="driver-card__top">
      ${driverAvatar(data, { size: 'lg' })}
      ${pos ? html`<span class="pos-badge ${posClass}">${pos}°</span>` : null}
    </div>
    <div>
      <p class="driver-card__name">${data.full_name}</p>
      <p class="driver-card__team">${data.team_name}</p>
    </div>
    <div class="driver-card__bottom">
      <p class="driver-card__points">${formatPoints(pts)}<span> PT</span></p>
      <span class="driver-card__pos">${ordinal(pos || '—')} in classifica</span>
    </div>
  </a>`;
}

export function pointsBar(points, max, color, { showLabel = false } = {}) {
  const width = clamp(max > 0 ? (points / max) * 100 : 0, 0, 100);
  return html`<div class="points-bar" style="--team:${teamColor(color)}">
    <div class="points-bar__top">
      <span class="points">${formatPoints(points)}</span>
      ${showLabel ? html`<small class="faint">PT</small>` : null}
    </div>
    <div class="bar"><span class="bar__fill" style="width:${width}%"></span></div>
  </div>`;
}
