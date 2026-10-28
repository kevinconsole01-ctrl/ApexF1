function parseHash() {
  const hash = window.location.hash || '';
  if (!hash || !hash.startsWith('#/')) return null;
  const rawPath = hash.slice(1);
  const [pathPart, queryPart = ''] = rawPath.split('?');
  const path = pathPart || '/';
  return { path, query: new URLSearchParams(queryPart) };
}

export function navigate(path, { replace = false } = {}) {
  const target = `#${path.startsWith('/') ? path : `/${path}`}`;
  if (window.location.hash === target) return;
  if (replace) {
    window.history.replaceState(null, '', target);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } else {
    window.location.hash = target;
  }
}

export function currentPath() {
  return parseHash()?.path || '/dashboard';
}

export function currentQuery() {
  return parseHash()?.query || new URLSearchParams();
}

export function createRouter({ outlet, routes, onChange, onError }) {
  let active = null;
  let renderToken = 0;

  function cleanup() {
    if (active?.destroy) {
      try {
        active.destroy();
      } catch {
        /* noop */
      }
    }
    active = null;
  }

  function render() {
    const parsed = parseHash();

    if (!parsed) {
      navigate('/dashboard', { replace: true });
      return;
    }

    const token = ++renderToken;
    const route = routes.find((item) => item.pattern.test(parsed.path)) || routes[0];
    const match = parsed.path.match(route.pattern);

    cleanup();

    let page;
    try {
      page = route.factory({
        params: match ? match.slice(1) : [],
        query: parsed.query,
        path: parsed.path,
      });
    } catch (error) {
      if (onError) onError(error);
      return;
    }

    if (!page) return;

    if (token !== renderToken) {
      page.destroy?.();
      return;
    }

    active = page;
    outlet.replaceChildren(page.el);
    if (route.title) document.title = `${route.title} · APEX F1`;
    if (onChange) onChange({ route, path: parsed.path, query: parsed.query });

    window.scrollTo({ top: 0, behavior: 'instant' in document.documentElement.style ? 'instant' : 'auto' });
    const heading = outlet.querySelector('h1');
    if (heading) {
      heading.setAttribute('tabindex', '-1');
      heading.focus({ preventScroll: true });
    }
  }

  const onHashChange = () => render();
  window.addEventListener('hashchange', onHashChange);

  return {
    start() {
      if (!parseHash()) {
        window.history.replaceState(null, '', '#/dashboard');
      }
      render();
    },
    render,
    reload() {
      render();
    },
    destroy() {
      cleanup();
      window.removeEventListener('hashchange', onHashChange);
    },
  };
}
