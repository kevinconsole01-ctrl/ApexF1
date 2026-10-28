import { F1Element, define } from './base.js';
import { html } from '../core/dom.js';
import { timeParts, teamColor } from '../core/format.js';
import { driverAvatar, driverName, normalizeDriver } from './driver.js';

class Segmented extends F1Element {
  constructor() {
    super();
    this._config = { options: [], value: null, ariaLabel: 'Seleziona vista' };
  }

  set config(value) {
    this._config = { ...this._config, ...(value || {}) };
    this.update();
  }

  get config() {
    return this._config;
  }

  onConnect() {
    this.listen(this, 'click', (event) => {
      const button = event.target.closest('[data-value]');
      if (!button || button.disabled) return;
      const value = button.dataset.value;
      if (value === String(this._config.value)) return;
      this._config = { ...this._config, value };
      this.update();
      this.dispatchEvent(new CustomEvent('change', { detail: { value }, bubbles: true }));
    });
  }

  template() {
    const { options = [], value, ariaLabel } = this._config;
    return html`<div class="segmented" role="group" aria-label="${ariaLabel || 'Seleziona vista'}">
      ${options.map((option) => {
        const optionValue = String(option.value);
        const active = String(value) === optionValue;
        return html`<button class="segmented__btn ${active ? 'is-active' : ''}" type="button" data-value="${optionValue}" aria-pressed="${active}">
          ${option.label}
          ${option.count != null ? html`<span class="segmented__count">${option.count}</span>` : null}
        </button>`;
      })}
    </div>`;
  }
}

class Countdown extends F1Element {
  onConnect() {
    const timer = setInterval(() => {
      if (this.isConnected) this.update();
    }, 1000);
    this._disposers.push(() => clearInterval(timer));
  }

  template() {
    const end = this.getAttribute('end');
    if (!end) return html`<span class="mono muted">—</span>`;
    const parts = timeParts(end);
    const blocks = [
      { value: parts.days, label: 'giorni' },
      { value: parts.hours, label: 'ore' },
      { value: parts.minutes, label: 'min' },
      { value: parts.seconds, label: 'sec' },
    ];
    const summary = parts.done
      ? 'Evento in corso o concluso'
      : `Mancano ${parts.days} giorni, ${parts.hours} ore e ${parts.minutes} minuti`;

    return html`<div class="countdown" role="timer" aria-label="${summary}">
      ${blocks.map((block) => html`<div class="countdown__block">
        <span class="countdown__value">${String(block.value).padStart(2, '0')}</span>
        <span class="countdown__label">${block.label}</span>
      </div>`)}
    </div>`;
  }
}

class Podium extends F1Element {
  set entries(value) {
    this._entries = Array.isArray(value) ? value : [];
    this.update();
  }

  get entries() {
    return this._entries || [];
  }

  /** Etichette opzionali per posizione: es. ["Pole", "2° tempo", "3° tempo"]. */
  set labels(value) {
    this._labels = Array.isArray(value) ? value : null;
    this.update();
  }

  get labels() {
    return this._labels || null;
  }

  template() {
    const entries = [...(this._entries || [])]
      .filter((entry) => entry && entry.position)
      .sort((a, b) => a.position - b.position)
      .slice(0, 3);

    if (!entries.length) {
      return html`<p class="muted small">Podio non disponibile.</p>`;
    }

    return html`<div class="podium">
      ${entries.map((entry) => {
        const driver = normalizeDriver(entry.driver || entry);
        const color = teamColor(driver.team_colour);
        const fallbackLabel = entry.position === 1 ? 'Vincitore' : entry.position === 2 ? 'Secondo' : 'Terzo';
        return html`<div class="podium__item podium__item--${entry.position}" style="--team:${color}">
          <div class="podium__rank">
            <span>${this._labels?.[entry.position - 1] || fallbackLabel}</span>
            <strong>P${entry.position}</strong>
          </div>
          <div class="podium__avatar">
            ${driverAvatar(driver, { size: 'lg', photo: true, number: false })}
            <div class="podium__name">${driverName(driver)}<span>${driver.team_name}</span></div>
          </div>
          <p class="podium__time">${entry.timeText || entry.time || '—'}</p>
        </div>`;
      })}
    </div>`;
  }
}

define('f1-segmented', Segmented);
define('f1-countdown', Countdown);
define('f1-podium', Podium);

export { Segmented, Countdown, Podium };
