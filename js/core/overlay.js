import { html, icon, setHTML } from '../core/dom.js';

function overlayRoot() {
  let root = document.getElementById('overlay-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'overlay-root';
    document.body.append(root);
  }
  return root;
}

export function toast(message, { actionLabel, onAction, duration = 4500 } = {}) {
  const root = overlayRoot();
  let stack = root.querySelector('.toast-stack');
  if (!stack) {
    stack = document.createElement('div');
    stack.className = 'toast-stack';
    root.append(stack);
  }

  const element = document.createElement('div');
  element.className = 'toast';
  element.setAttribute('role', 'status');
  element.innerHTML = html`<span class="toast__dot"></span>
    <span>${message}</span>
    ${actionLabel ? html`<button class="toast__action" type="button">${actionLabel}</button>` : null}
    <button class="toast__close" type="button" aria-label="Chiudi">×</button>`.value;

  const remove = () => {
    element.style.opacity = '0';
    element.style.transform = 'translateY(6px)';
    element.style.transition = 'opacity 180ms ease, transform 180ms ease';
    setTimeout(() => element.remove(), 190);
  };

  element.querySelector('.toast__close')?.addEventListener('click', remove);
  element.querySelector('.toast__action')?.addEventListener('click', () => {
    onAction?.();
    remove();
  });

  stack.append(element);
  if (duration > 0) setTimeout(remove, duration);
  return { close: remove };
}

export function openModal({ title, body, actions = [], onClose, eyebrow }) {
  const root = overlayRoot();
  const previousFocus = document.activeElement;

  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  overlay.innerHTML = html`<section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
    <div class="modal__head">
      <div>
        ${eyebrow ? html`<p class="eyebrow" style="margin-bottom:5px">${eyebrow}</p>` : null}
        <h2 class="modal__title" id="modal-title">${title}</h2>
      </div>
      <button class="modal__close" type="button" aria-label="Chiudi">${icon('x')}</button>
    </div>
    <div class="modal__body"></div>
    ${actions.length
      ? html`<div class="row" style="justify-content:flex-end;margin-top:18px;flex-wrap:wrap">
          ${actions.map((action, index) => html`<button class="btn ${action.primary ? 'btn--primary' : ''}" type="button" data-action="${index}">${action.label}</button>`)}
        </div>`
      : null}
  </section>`.value;

  const bodyElement = overlay.querySelector('.modal__body');
  if (body instanceof Node) bodyElement.replaceChildren(body);
  else setHTML(bodyElement, body || '');

  const close = () => {
    overlay.remove();
    document.removeEventListener('keydown', onKeyDown);
    if (previousFocus instanceof HTMLElement) previousFocus.focus({ preventScroll: true });
    onClose?.();
  };

  const onKeyDown = (event) => {
    if (event.key === 'Escape') close();
    if (event.key !== 'Tab') return;
    const focusable = [...overlay.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter(
      (element) => !element.disabled,
    );
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) close();
  });
  overlay.querySelector('.modal__close')?.addEventListener('click', close);
  actions.forEach((action, index) => {
    overlay.querySelector(`[data-action="${index}"]`)?.addEventListener('click', () => {
      action.onClick?.(close);
      if (action.close !== false) close();
    });
  });
  document.addEventListener('keydown', onKeyDown);

  root.append(overlay);
  overlay.querySelector('.modal__close')?.focus({ preventScroll: true });
  return close;
}
