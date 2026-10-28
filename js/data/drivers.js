import { apiGet } from '../core/api.js';

const cache = new Map();

const TEAM_COLORS = {
  'Red Bull Racing': '#4781D7',
  'Red Bull': '#4781D7',
  Ferrari: '#ED1131',
  Mercedes: '#00D7B6',
  McLaren: '#F47600',
  'Aston Martin': '#229971',
  Alpine: '#00A1E8',
  Williams: '#1868DB',
  'Racing Bulls': '#6C98FF',
  RB: '#6C98FF',
  'Haas F1 Team': '#9C9FA2',
  Haas: '#9C9FA2',
  'Kick Sauber': '#52E252',
  Sauber: '#52E252',
  Audi: '#F50537',
  Cadillac: '#909090',
  'Alfa Romeo': '#C92D4B',
  AlphaTauri: '#5E8FAA',
  'Alpha Tauri': '#5E8FAA',
  'Prema Racing': '#E8002D',
};

const FALLBACK_PALETTE = ['#ff5a5f', '#58a6ff', '#2ee6a8', '#ffc857', '#c084fc', '#f97316', '#22d3ee', '#a3e635'];

function paletteColor(name) {
  let hash = 0;
  for (let index = 0; index < (name || '').length; index += 1) {
    hash = (hash * 31 + name.charCodeAt(index)) % 9973;
  }
  return FALLBACK_PALETTE[hash % FALLBACK_PALETTE.length];
}

export function fallbackDriver(driverNumber) {
  return {
    driver_number: Number(driverNumber) || 0,
    name_acronym: `#${driverNumber}`,
    full_name: `Pilota #${driverNumber}`,
    first_name: '',
    last_name: `#${driverNumber}`,
    team_name: '—',
    team_colour: '',
    headshot_url: null,
    country_code: null,
  };
}

export async function getMeetingDrivers(meetingKey) {
  if (!meetingKey) return new Map();
  if (cache.has(meetingKey)) return cache.get(meetingKey);

  const rows = await apiGet('drivers', { meeting_key: meetingKey });
  const map = new Map();
  (rows || []).forEach((row) => {
    const existing = map.get(row.driver_number);
    if (!existing || row.session_key >= existing.session_key) {
      map.set(row.driver_number, row);
    }
  });

  cache.set(meetingKey, map);
  return map;
}

const driverInfoCache = new Map();

/** Recupera le info di un pilota anche se non ha corso nell'ultimo weekend. */
export async function getDriverInfoAnywhere(driverNumber) {
  if (driverInfoCache.has(driverNumber)) return driverInfoCache.get(driverNumber);
  try {
    const rows = await apiGet('drivers', { driver_number: driverNumber });
    if (!rows?.length) return null;
    const sorted = [...rows].sort((a, b) => Number(b.session_key) - Number(a.session_key));
    const driver = { ...sorted[0], meeting_key: undefined };
    driverInfoCache.set(driverNumber, driver);
    return driver;
  } catch {
    return null;
  }
}

export function teamColorsFromDrivers(driverMap) {
  const colors = new Map(Object.entries(TEAM_COLORS));
  driverMap?.forEach((driver) => {
    if (driver.team_name) {
      colors.set(driver.team_name, driver.team_colour ? `#${driver.team_colour}` : colors.get(driver.team_name) || paletteColor(driver.team_name));
    }
  });
  return colors;
}

export function colorForTeam(teamName, colors) {
  if (!teamName) return '#9aa3b2';
  if (colors?.has(teamName)) return colors.get(teamName);
  if (TEAM_COLORS[teamName]) return TEAM_COLORS[teamName];
  return paletteColor(teamName);
}
