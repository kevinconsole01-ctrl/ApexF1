export class F1Element extends HTMLElement {
  constructor() {
    super();
    this._connected = false;
    this._disposers = [];
  }

  connectedCallback() {
    if (this._connected) return;
    this._connected = true;
    this.onConnect?.();
    this.update();
  }

  disconnectedCallback() {
    this._connected = false;
    this._disposers.forEach((dispose) => {
      try {
        dispose();
      } catch {
        /* noop */
      }
    });
    this._disposers = [];
    this.onDisconnect?.();
  }

  update() {
    if (!this._connected) return;
    const template = this.template?.();
    if (template == null) return;
    this.innerHTML = template instanceof Object && 'value' in template ? template.value : String(template);
    this.onUpdate?.();
  }

  listen(target, event, handler, options) {
    target.addEventListener(event, handler, options);
    this._disposers.push(() => target.removeEventListener(event, handler, options));
  }

  attr(name, fallback = null) {
    return this.hasAttribute(name) ? this.getAttribute(name) : fallback;
  }

  numAttr(name, fallback = null) {
    const value = Number(this.getAttribute(name));
    return Number.isFinite(value) ? value : fallback;
  }
}

export function define(name, Class) {
  if (!customElements.get(name)) customElements.define(name, Class);
  return Class;
}
