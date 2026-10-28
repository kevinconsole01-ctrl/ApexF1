const LOCALE = 'it-IT';

const pad = (value, size = 2) => String(value).padStart(size, '0');

export function formatLapTime(seconds, { decimals = 3 } = {}) {
  if (seconds == null || Number.isNaN(Number(seconds))) return '—';
  const total = Number(seconds);
  if (!Number.isFinite(total) || total < 0) return '—';
  const minutes = Math.floor(total / 60);
  const rest = total - minutes * 60;
  const restText = rest.toFixed(decimals).padStart(decimals > 0 ? 3 + decimals : 2, '0');
  return minutes > 0 ? `${minutes}:${restText}` : restText;
}

export function formatSector(seconds) {
  if (seconds == null || Number.isNaN(Number(seconds))) return '—';
  return Number(seconds).toFixed(3);
}

export function formatRaceTime(seconds) {
  if (seconds == null || Number.isNaN(Number(seconds))) return '—';
  const total = Number(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const rest = total % 60;
  const restText = rest.toFixed(3).padStart(6, '0');
  if (hours > 0) return `${hours}:${pad(minutes)}:${restText}`;
  if (minutes > 0) return `${minutes}:${restText}`;
  return restText;
}

export function formatGap(value, { leader = 'Leader' } = {}) {
  if (value == null || value === '') return '—';
  if (typeof value === 'string') return value;
  if (Number(value) === 0) return leader;
  return `+${Number(value).toFixed(3)}`;
}

export function formatPoints(value, { decimals } = {}) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  const number = Number(value);
  const digits = decimals ?? (Number.isInteger(number) ? 0 : 1);
  return new Intl.NumberFormat(LOCALE, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(number);
}

export function formatInt(value) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return new Intl.NumberFormat(LOCALE).format(Number(value));
}

export function formatSigned(value, digits = 0) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  const number = Number(value);
  if (number === 0) return '0';
  return `${number > 0 ? '+' : '−'}${Math.abs(number).toFixed(digits)}`;
}

export function formatSpeed(value) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return `${Math.round(Number(value))}`;
}

export function formatDelta(start, current) {
  if (start == null || current == null) return 0;
  return Number(start) - Number(current);
}

export function timeParts(target) {
  const end = target instanceof Date ? target.getTime() : new Date(target).getTime();
  const diff = Math.max(0, end - Date.now());
  return {
    total: diff,
    done: diff <= 0,
    days: Math.floor(diff / 86400000),
    hours: Math.floor((diff % 86400000) / 3600000),
    minutes: Math.floor((diff % 3600000) / 60000),
    seconds: Math.floor((diff % 60000) / 1000),
  };
}

export function formatCountdownShort(target) {
  const parts = timeParts(target);
  if (parts.done) return 'Ora';
  if (parts.days > 0) return `${parts.days}g ${parts.hours}h`;
  if (parts.hours > 0) return `${parts.hours}h ${parts.minutes}m`;
  if (parts.minutes > 0) return `${parts.minutes}m`;
  return `${parts.seconds}s`;
}

const dateFmt = (options) => new Intl.DateTimeFormat(LOCALE, options);

export function formatDate(iso, { weekday = false, year = false } = {}) {
  if (!iso) return '—';
  const options = { day: 'numeric', month: 'short' };
  if (weekday) options.weekday = 'short';
  if (year) options.year = 'numeric';
  return dateFmt(options).format(new Date(iso));
}

export function formatDateLong(iso, { weekday = true, year = true } = {}) {
  if (!iso) return '—';
  const options = { day: 'numeric', month: 'long' };
  if (weekday) options.weekday = 'long';
  if (year) options.year = 'numeric';
  return dateFmt(options).format(new Date(iso));
}

export function formatTime(iso, { seconds = false } = {}) {
  if (!iso) return '—';
  return dateFmt({
    hour: '2-digit',
    minute: '2-digit',
    ...(seconds ? { second: '2-digit' } : {}),
  }).format(new Date(iso));
}

export function formatDateTime(iso) {
  if (!iso) return '—';
  return `${formatDate(iso, { weekday: true })} · ${formatTime(iso)}`;
}

export function formatDateRange(start, end) {
  if (!start) return '—';
  const startDate = new Date(start);
  const endDate = end ? new Date(end) : startDate;
  const sameDay = startDate.toDateString() === endDate.toDateString();
  const sameMonth = startDate.getMonth() === endDate.getMonth();
  if (sameDay) return formatDate(start, { year: true });
  if (sameMonth) {
    return `${startDate.getDate()}–${formatDate(end, { year: true })}`;
  }
  return `${formatDate(start)} – ${formatDate(end, { year: true })}`;
}

export function formatRelative(iso) {
  if (!iso) return '—';
  const diff = new Date(iso).getTime() - Date.now();
  const abs = Math.abs(diff);
  const formatter = new Intl.RelativeTimeFormat(LOCALE, { numeric: 'auto' });
  if (abs < 3600000) return formatter.format(Math.round(diff / 60000), 'minute');
  if (abs < 86400000) return formatter.format(Math.round(diff / 3600000), 'hour');
  if (abs < 2592000000) return formatter.format(Math.round(diff / 86400000), 'day');
  return formatter.format(Math.round(diff / 2592000000), 'month');
}

export function relativeUpdated(date = Date.now()) {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(date).getTime()) / 1000));
  if (seconds < 10) return 'adesso';
  if (seconds < 60) return `${seconds}s fa`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m fa`;
  return `${Math.round(minutes / 60)}h fa`;
}

const FLAGS = {
  AUS: '🇦🇺', AUT: '🇦🇹', AZE: '🇦🇿', BAH: '🇧🇭', BRN: '🇧🇭', BEL: '🇧🇪', BRA: '🇧🇷',
  CAN: '🇨🇦', CHN: '🇨🇳', ESP: '🇪🇸', FRA: '🇫🇷', GBR: '🇬🇧', GER: '🇩🇪', HUN: '🇭🇺',
  IND: '🇮🇳', ITA: '🇮🇹', JPN: '🇯🇵', KOR: '🇰🇷', KSA: '🇸🇦', MEX: '🇲🇽', MON: '🇲🇨',
  NED: '🇳🇱', POR: '🇵🇹', QAT: '🇶🇦', RSA: '🇿🇦', RUS: '🇷🇺', SGP: '🇸🇬', SWE: '🇸🇪',
  TUR: '🇹🇷', UAE: '🇦🇪', USA: '🇺🇸', ARG: '🇦🇷', CHL: '🇨🇱', COL: '🇨🇴', THA: '🇹🇭',
  VIE: '🇻🇳', NLD: '🇳🇱', DEU: '🇩🇪', CHE: '🇨🇭', FIN: '🇫🇮', DEN: '🇩🇰', NZL: '🇳🇿',
};

export function countryFlag(code) {
  if (!code) return '🏁';
  return FLAGS[String(code).toUpperCase()] || '🏁';
}

const COUNTRY_IT = {
  Australia: 'Australia', Austria: 'Austria', Azerbaijan: 'Azerbaigian', Bahrain: 'Bahrein',
  Belgium: 'Belgio', Brazil: 'Brasile', Canada: 'Canada', China: 'Cina', Spain: 'Spagna',
  France: 'Francia', 'United Kingdom': 'Gran Bretagna', Germany: 'Germania', Hungary: 'Ungheria',
  Italy: 'Italia', Japan: 'Giappone', Mexico: 'Messico', Monaco: 'Monaco', Netherlands: 'Paesi Bassi',
  Portugal: 'Portogallo', Qatar: 'Qatar', 'Saudi Arabia': 'Arabia Saudita', Singapore: 'Singapore',
  'South Africa': 'Sudafrica', Russia: 'Russia', Sweden: 'Svezia', Turkey: 'Turchia',
  'United Arab Emirates': 'Emirati Arabi Uniti', 'United States': 'Stati Uniti',
};

export function countryName(name) {
  return COUNTRY_IT[name] || name || '—';
}

const MEETING_IT = {
  'Australian Grand Prix': "GP d'Australia",
  'Chinese Grand Prix': 'GP di Cina',
  'Japanese Grand Prix': 'GP del Giappone',
  'Bahrain Grand Prix': 'GP del Bahrein',
  'Saudi Arabian Grand Prix': "GP dell'Arabia Saudita",
  'Miami Grand Prix': 'GP di Miami',
  'Canadian Grand Prix': 'GP del Canada',
  'Monaco Grand Prix': 'GP di Monaco',
  'Barcelona Grand Prix': 'GP di Barcellona',
  'Spanish Grand Prix': 'GP di Spagna',
  'Austrian Grand Prix': "GP d'Austria",
  'British Grand Prix': 'GP di Gran Bretagna',
  'Belgian Grand Prix': 'GP del Belgio',
  'Hungarian Grand Prix': "GP d'Ungheria",
  'Dutch Grand Prix': "GP d'Olanda",
  'Italian Grand Prix': "GP d'Italia",
  'Azerbaijan Grand Prix': "GP dell'Azerbaigian",
  'Singapore Grand Prix': 'GP di Singapore',
  'United States Grand Prix': 'GP degli Stati Uniti',
  'Mexico City Grand Prix': 'GP di Città del Messico',
  'Mexico Grand Prix': 'GP del Messico',
  'São Paulo Grand Prix': 'GP di São Paulo',
  'Brazilian Grand Prix': 'GP del Brasile',
  'Las Vegas Grand Prix': 'GP di Las Vegas',
  'Qatar Grand Prix': 'GP del Qatar',
  'Abu Dhabi Grand Prix': 'GP di Abu Dhabi',
  'Emilia-Romagna Grand Prix': "GP dell'Emilia-Romagna",
  'French Grand Prix': 'GP di Francia',
  'German Grand Prix': 'GP di Germania',
  'Portuguese Grand Prix': 'GP del Portogallo',
  'Turkish Grand Prix': 'GP di Turchia',
  'Russian Grand Prix': 'GP di Russia',
  'Pre-Season Testing': 'Test prestagionali',
};

export function meetingTitle(meeting) {
  if (!meeting) return '—';
  return MEETING_IT[meeting.meeting_name] || meeting.meeting_name?.replace('Grand Prix', 'GP') || 'Gran Premio';
}

const SESSION_LABELS = {
  Race: 'Gara',
  Sprint: 'Sprint',
  Qualifying: 'Qualifica',
  'Sprint Qualifying': 'Qualifica Sprint',
  'Practice 1': 'Prove libere 1',
  'Practice 2': 'Prove libere 2',
  'Practice 3': 'Prove libere 3',
};

export function sessionLabel(name) {
  return SESSION_LABELS[name] || name || 'Sessione';
}

export function shortSessionLabel(name) {
  const map = {
    Race: 'Gara',
    Sprint: 'Sprint',
    Qualifying: 'Qualifica',
    'Sprint Qualifying': 'Qual. Sprint',
    'Practice 1': 'PL1',
    'Practice 2': 'PL2',
    'Practice 3': 'PL3',
  };
  return map[name] || name || 'Sessione';
}

export function shortDriverName(driver) {
  if (!driver) return '—';
  const first = driver.first_name || '';
  const last = driver.last_name || driver.full_name?.split(' ').slice(-1)[0] || '';
  if (!first && !last) return driver.name_acronym || `#${driver.driver_number}`;
  return last ? `${first} ${last}`.trim() : first || last;
}

export function driverFullName(driver) {
  return driver?.full_name || shortDriverName(driver);
}

export function teamColor(color) {
  return /^[0-9a-f]{6}$/i.test(color || '') ? `#${color}` : '#9aa3b2';
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function ordinal(value) {
  return `${value}°`;
}

export function plural(count, singular, pluralForm) {
  return count === 1 ? singular : pluralForm;
}

export function pct(value, total) {
  if (!total) return 0;
  return clamp((value / total) * 100, 0, 100);
}
