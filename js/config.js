export const API_BASE = 'https://api.openf1.org/v1';
export const APP_VERSION = '1.0.0';
export const CACHE_PREFIX = 'apex:v1:';

/** OpenF1 dichiara 3 req/s ma il limite effettivo è più severo: restiamo prudenti. */
export const MIN_REQUEST_INTERVAL = 550;

export const SEASON_MIN = 2023;
export const LIVE_POLL_MS = 15000;
export const LS_MAX_BYTES = 140000;
export const LS_MAX_ENTRIES = 40;

export const REPO_LINKS = {
  api: 'https://openf1.org',
  docs: 'https://openf1.org/docs',
};
