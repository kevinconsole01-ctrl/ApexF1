import { html, icon } from '../core/dom.js';

export function statCard({ label, value, hint, iconName = 'info', accent = '#ff2d16', accentSoft = 'rgba(255, 45, 22, 0.13)' }) {
  return html`<div class="stat" style="--stat-accent:${accent};--stat-accent-soft:${accentSoft}">
    <div class="stat__top">
      <span class="stat__label">${label}</span>
      <span class="stat__icon">${icon(iconName)}</span>
    </div>
    <div class="stat__value">${value}</div>
    ${hint ? html`<div class="stat__hint">${hint}</div>` : null}
  </div>`;
}

export function statSkeleton(label = 'Caricamento') {
  return html`<div class="stat">
    <div class="stat__top">
      <span class="stat__label">${label}</span>
      <span class="stat__icon">${icon('activity')}</span>
    </div>
    <span class="skeleton skeleton--title" style="width:70%;height:22px"></span>
    <span class="skeleton skeleton--text" style="width:50%"></span>
  </div>`;
}
