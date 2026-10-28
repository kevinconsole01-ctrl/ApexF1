import { html, raw, setHTML, icon } from './dom.js';

export function fill(target, content) {
  if (!target) return;
  if (content instanceof Node) {
    target.replaceChildren(content);
  } else if (content instanceof DocumentFragment) {
    target.replaceChildren(content);
  } else {
    setHTML(target, content);
  }
}

export function skeletonRows(count = 6) {
  return html`<div class="skeleton-stack" aria-hidden="true">
    ${Array.from({ length: count }, (_, index) => html`<div class="skeleton skeleton--row" style="width:${index === count - 1 ? 80 : 100}%"></div>`)}
  </div>`;
}

export function skeletonStats(count = 4) {
  return html`<div class="stats-grid" aria-hidden="true">
    ${Array.from({ length: count }, () => html`<div class="skeleton skeleton--stat"></div>`)}
  </div>`;
}

export function skeletonChart(height = 220) {
  return html`<div class="skeleton" style="height:${height}px;border-radius:12px" aria-hidden="true"></div>`;
}

export function skeletonHero() {
  return html`<div class="skeleton" style="height:250px;border-radius:28px" aria-hidden="true"></div>`;
}

export function errorText(error) {
  if (!error) return 'Si è verificato un errore inatteso.';
  if (error.code === 'network') return 'Connessione assente o OpenF1 non raggiungibile.';
  if (error.code === 'rate-limit') return 'OpenF1 ha raggiunto il limite di richieste. Riprova tra qualche secondo.';
  return error.message || 'Impossibile caricare i dati.';
}

export function stateMessage({ title, text, iconName = 'info', action = false, tone = '' } = {}) {
  return html`<div class="state ${tone ? `state--${tone}` : ''}">
    <span class="state__icon">${icon(iconName)}</span>
    <p class="state__title">${title}</p>
    ${text ? html`<p class="state__text">${text}</p>` : null}
    ${action ? html`<button class="btn btn--sm" type="button" data-retry>${icon('refresh')} Riprova</button>` : null}
  </div>`;
}

export function emptyState(title = 'Nessun dato', text = 'Non ci sono dati disponibili per questa selezione.', iconName = 'info') {
  return stateMessage({ title, text, iconName });
}

/**
 * Riempie uno slot in modo asincrono, con skeleton, gestione errori e retry.
 */
export function asyncSection(target, loader, render, options = {}) {
  if (!target) return () => {};

  let disposed = false;
  let running = false;

  const run = async () => {
    if (running) return;
    running = true;
    target.setAttribute('aria-busy', 'true');
    fill(target, options.skeleton ?? skeletonRows(options.skeletonRows ?? 5));

    try {
      const data = await loader();
      if (disposed) return;
      fill(target, render(data));
    } catch (error) {
      if (disposed) return;
      fill(
        target,
        options.errorRender
          ? options.errorRender(error)
          : stateMessage({
              title: options.errorTitle || 'Dati non disponibili',
              text: errorText(error),
              iconName: 'warning',
              action: true,
            }),
      );
    } finally {
      running = false;
      if (!disposed) target.removeAttribute('aria-busy');
    }
  };

  const onClick = (event) => {
    const retry = event.target.closest('[data-retry]');
    if (retry) run();
  };

  target.addEventListener('click', onClick);
  run();

  return () => {
    disposed = true;
    target.removeEventListener('click', onClick);
  };
}

export function pageHead({ eyebrow, title, subtitle, actions, id = 'page-title' }) {
  return html`<header class="page-head">
    <div class="page-head__main">
      ${eyebrow ? html`<p class="eyebrow">${eyebrow}</p>` : null}
      <h1 id="${id}">${title}</h1>
      ${subtitle ? html`<p class="page-head__sub">${subtitle}</p>` : null}
    </div>
    ${actions ? html`<div class="page-head__actions">${actions}</div>` : null}
  </header>`;
}

export function cardHead({ title, sub, href, linkLabel = 'Vedi tutto', iconName, action }) {
  return html`<div class="card__head">
    <div>
      <h2 class="card__title">${iconName ? icon(iconName) : null}${title}</h2>
      ${sub ? html`<p class="card__sub">${sub}</p>` : null}
    </div>
    ${action || (href ? html`<a class="card__link" href="${href}">${linkLabel}${icon('chevronRight')}</a>` : null)}
  </div>`;
}

export function notice(text, { iconName = 'info', accent = 'warning' } = {}) {
  return html`<div class="notice" style="${accent === 'warning' ? '' : 'border-color:var(--border);background:rgba(255,255,255,.025)'}">${icon(iconName)}<div>${text}</div></div>`;
}

export function miniStat(label, value, { suffix = '', rawValue = false } = {}) {
  return html`<div class="mini-stat">
    <p class="mini-stat__label">${label}</p>
    <p class="mini-stat__value">${rawValue ? raw(value) : value}${suffix ? html`<small>${suffix}</small>` : null}</p>
  </div>`;
}

export function loadingButton(label, { iconName = 'refresh' } = {}) {
  return html`<span>${icon(iconName)} ${label}</span>`;
}

export function tableNode(config) {
  const element = document.createElement('f1-data-table');
  element.config = config;
  return element;
}

export function chartNode(config) {
  const element = document.createElement('f1-line-chart');
  element.config = config;
  return element;
}

export function segmentedNode({ options, value, onChange, ariaLabel = 'Seleziona vista' }) {
  const element = document.createElement('f1-segmented');
  element.config = { options, value, ariaLabel };
  if (onChange) element.addEventListener('change', (event) => onChange(event.detail.value));
  return element;
}

export function countdownNode(end, { compact = false } = {}) {
  const element = document.createElement('f1-countdown');
  element.setAttribute('end', end);
  if (compact) element.setAttribute('compact', '');
  return element;
}

export function podiumNode(entries, { labels } = {}) {
  const element = document.createElement('f1-podium');
  element.entries = entries;
  if (labels) element.labels = labels;
  return element;
}
