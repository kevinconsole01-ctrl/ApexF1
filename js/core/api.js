import { API_BASE, CACHE_PREFIX, MIN_REQUEST_INTERVAL, LS_MAX_BYTES, LS_MAX_ENTRIES } from '../config.js';

const memory = new Map();
const inflight = new Map();
const fallbackListeners = new Set();
let lastRequestAt = 0;
let blockedUntil = 0;
let queue = Promise.resolve();

const LIVE_PATHS = new Set(['position', 'intervals', 'weather', 'race_control', 'team_radio', 'car_data', 'location', 'pit', 'stints']);
const FAST_PATHS = new Set(['sessions', 'meetings', 'drivers', 'championship_drivers', 'championship_teams', 'session_result']);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function isLivePath(path) {
  return LIVE_PATHS.has(path);
}

function ttlFor(path) {
  if (path === 'weather') return 20000;
  if (path === 'race_control') return 12000;
  if (isLivePath(path)) return 8000;
  if (FAST_PATHS.has(path)) return 10 * 60 * 1000;
  return 30 * 60 * 1000;
}

function localTtlFor(path) {
  if (isLivePath(path)) return 45000;
  return 12 * 60 * 60 * 1000;
}

function buildUrl(path, params = {}) {
  const search = new URLSearchParams();
  Object.keys(params)
    .filter((key) => params[key] !== undefined && params[key] !== null && params[key] !== '')
    .sort()
    .forEach((key) => search.set(key, String(params[key])));
  const query = search.toString();
  return `${API_BASE}/${path}${query ? `?${query}` : ''}`;
}

function readMemory(url, ttl) {
  const entry = memory.get(url);
  if (!entry) return null;
  if (Date.now() - entry.ts > ttl) return null;
  return entry.data;
}

function readMemoryStale(url) {
  return memory.get(url) || null;
}

function storageAvailable() {
  try {
    const key = `${CACHE_PREFIX}probe`;
    localStorage.setItem(key, '1');
    localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

const hasStorage = storageAvailable();

function readLocal(url, ttl) {
  if (!hasStorage) return null;
  try {
    const rawValue = localStorage.getItem(CACHE_PREFIX + url);
    if (!rawValue) return null;
    const entry = JSON.parse(rawValue);
    if (!entry || !('data' in entry)) return null;
    if (Date.now() - entry.ts > ttl) return null;
    return entry;
  } catch {
    return null;
  }
}

function pruneStorage(force = false) {
  if (!hasStorage) return;
  try {
    const keys = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key && key.startsWith(CACHE_PREFIX) && key !== `${CACHE_PREFIX}probe`) keys.push(key);
    }
    if (!force && keys.length <= LS_MAX_ENTRIES) return;
    const entries = keys.map((key) => {
      try {
        return { key, ts: JSON.parse(localStorage.getItem(key))?.ts || 0 };
      } catch {
        return { key, ts: 0 };
      }
    });
    entries.sort((a, b) => a.ts - b.ts);
    const removeCount = force ? Math.ceil(entries.length / 2) : entries.length - LS_MAX_ENTRIES;
    entries.slice(0, removeCount).forEach((entry) => localStorage.removeItem(entry.key));
  } catch {
    /* storage non disponibile: pazienza */
  }
}

function writeLocal(url, path, data) {
  if (!hasStorage || data == null) return;
  try {
    const payload = JSON.stringify({ ts: Date.now(), ttl: localTtlFor(path), data });
    if (payload.length > LS_MAX_BYTES) return;
    localStorage.setItem(CACHE_PREFIX + url, payload);
    pruneStorage();
  } catch {
    pruneStorage(true);
  }
}

function notifyFallback(url) {
  fallbackListeners.forEach((listener) => {
    try {
      listener(url);
    } catch {
      /* noop */
    }
  });
}

function waitForSlot() {
  const intervalWait = MIN_REQUEST_INTERVAL - (Date.now() - lastRequestAt);
  const blockWait = blockedUntil - Date.now();
  const wait = Math.max(intervalWait, blockWait);
  return wait > 0 ? sleep(wait) : Promise.resolve();
}

function enqueue(task) {
  const run = queue.then(async () => {
    await waitForSlot();
    lastRequestAt = Date.now();
    return task();
  });
  queue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

async function fetchJson(url, attempt = 0) {
  let response;
  try {
    response = await fetch(url, { headers: { Accept: 'application/json' }, cache: 'no-store' });
  } catch (error) {
    if (attempt < 1) {
      await sleep(650);
      return fetchJson(url, attempt + 1);
    }
    const networkError = new Error('Impossibile raggiungere OpenF1. Controlla la connessione.');
    networkError.code = 'network';
    networkError.cause = error;
    throw networkError;
  }

  if (response.status === 429) {
    const retryAfter = Number(response.headers.get('retry-after'));
    const backoff = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 1200 * (attempt + 1);
    blockedUntil = Math.max(blockedUntil, Date.now() + backoff);
    if (attempt < 2) {
      await sleep(backoff);
      return fetchJson(url, attempt + 1);
    }
    const limitError = new Error('OpenF1 ha temporaneamente bloccato le richieste (limite di 3/secondo).');
    limitError.code = 'rate-limit';
    throw limitError;
  }

  if (!response.ok) {
    const error = new Error(`Errore OpenF1 (${response.status}).`);
    error.code = 'http';
    error.status = response.status;
    throw error;
  }

  const text = await response.text();
  if (!text) return [];

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    const error = new Error('Risposta di OpenF1 non valida.');
    error.code = 'parse';
    throw error;
  }

  if (data && !Array.isArray(data)) {
    if (typeof data.detail === 'string' && /no results found/i.test(data.detail)) return [];
    const error = new Error(data.detail || 'Risposta di OpenF1 non valida.');
    error.code = 'api';
    throw error;
  }

  return data;
}

/**
 * Richiesta con cache, deduplica e coda globale (max ~2,6 req/s).
 * @param {string} path endpoint OpenF1, es. "drivers"
 * @param {Record<string, string|number>} params
 * @param {{force?: boolean}} options
 */
export function apiGet(path, params = {}, options = {}) {
  const url = buildUrl(path, params);
  const ttl = ttlFor(path);

  if (!options.force) {
    const cached = readMemory(url, ttl);
    if (cached) return Promise.resolve(cached);
  }

  if (inflight.has(url)) return inflight.get(url);

  const promise = enqueue(() => fetchJson(url))
    .then((data) => {
      memory.set(url, { ts: Date.now(), data });
      writeLocal(url, path, data);
      return data;
    })
    .catch((error) => {
      const staleMemory = readMemoryStale(url);
      if (staleMemory) {
        notifyFallback(url);
        return staleMemory.data;
      }
      const staleLocal = readLocal(url, Number.POSITIVE_INFINITY);
      if (staleLocal) {
        memory.set(url, staleLocal);
        notifyFallback(url);
        return staleLocal.data;
      }
      throw error;
    })
    .finally(() => {
      inflight.delete(url);
    });

  inflight.set(url, promise);
  return promise;
}

/** Invalida solo i dati live, mantenendo la cache storica. */
export function invalidateLive() {
  for (const url of [...memory.keys()]) {
    const path = new URL(url).pathname.split('/').pop();
    if (isLivePath(path)) memory.delete(url);
  }
  if (hasStorage) {
    try {
      const keys = [];
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (key && key.startsWith(CACHE_PREFIX)) {
          try {
            const path = new URL(key.slice(CACHE_PREFIX.length)).pathname.split('/').pop();
            if (isLivePath(path)) keys.push(key);
          } catch {
            /* ignora */
          }
        }
      }
      keys.forEach((key) => localStorage.removeItem(key));
    } catch {
      /* noop */
    }
  }
}

export function onApiFallback(listener) {
  fallbackListeners.add(listener);
  return () => fallbackListeners.delete(listener);
}
