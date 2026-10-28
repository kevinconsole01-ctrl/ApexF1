import { fetchSeasonCatalog } from '../data/season.js';
import { SEASON_MIN } from '../config.js';

const YEAR_KEY = 'apex:season';

function initialYear() {
  try {
    const saved = Number(localStorage.getItem(YEAR_KEY));
    if (Number.isInteger(saved) && saved >= SEASON_MIN && saved <= 2100) return saved;
  } catch {
    /* noop */
  }
  return new Date().getFullYear();
}

export const state = {
  year: initialYear(),
  catalog: null,
  status: 'idle',
  error: null,
  updatedAt: null,
};

const listeners = new Set();

function emit() {
  listeners.forEach((listener) => {
    try {
      listener(state);
    } catch {
      /* noop */
    }
  });
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

async function load(year, { allowFallback = false } = {}) {
  const previousYear = state.year;
  const previousCatalog = state.catalog;
  state.year = year;
  state.status = 'loading';
  state.error = null;
  emit();

  try {
    let catalog = await fetchSeasonCatalog(year);

    if (allowFallback && catalog.meetings.length === 0 && year > SEASON_MIN) {
      catalog = await fetchSeasonCatalog(year - 1);
      state.year = year - 1;
    }

    if (catalog.meetings.length === 0) {
      throw new Error(`Nessun dato disponibile per la stagione ${state.year}.`);
    }

    state.catalog = catalog;
    state.status = 'ready';
    state.updatedAt = Date.now();
    try {
      localStorage.setItem(YEAR_KEY, String(state.year));
    } catch {
      /* noop */
    }
    emit();
    return catalog;
  } catch (error) {
    // Se il cambio stagione fallisce, non lasciamo l'app in uno stato misto:
    // ripristiniamo la stagione e il catalogo che erano già visibili.
    state.year = previousYear;
    state.catalog = previousCatalog;
    state.status = 'error';
    state.error = error;
    emit();
    throw error;
  }
}

export function initSeason() {
  return load(state.year, { allowFallback: true });
}

export async function setSeason(year) {
  const value = Number(year);
  if (!Number.isInteger(value)) return state.catalog;
  if (value === state.year && state.catalog) return state.catalog;
  return load(value);
}

export async function retrySeason() {
  return load(state.year, { allowFallback: true });
}

export function yearOptions() {
  const current = new Date().getFullYear();
  const max = Math.max(current, state.year);
  const years = [];
  for (let year = max; year >= SEASON_MIN; year -= 1) years.push(year);
  return years;
}

export function seasonLabel(year = state.year) {
  return `Stagione ${year}`;
}
