import { apiGet } from '../core/api.js';
import { fallbackDriver, getMeetingDrivers, colorForTeam, teamColorsFromDrivers } from './drivers.js';
import { formatLapTime, formatRaceTime } from '../core/format.js';

function bestQualifyingLap(durations) {
  if (!Array.isArray(durations)) return null;
  const values = durations.map(Number).filter((value) => Number.isFinite(value) && value > 0);
  return values.length ? Math.min(...values) : null;
}

function timeTextFor(row, sessionName, leaderBest) {
  const isQualifying = sessionName === 'Qualifying' || sessionName === 'Sprint Qualifying';

  if (row.dsq) return 'DSQ';
  if (row.dns) return 'DNS';
  if (row.dnf) return 'DNF';

  if (isQualifying) {
    const best = bestQualifyingLap(row.duration);
    if (best == null) return '—';
    return formatLapTime(best);
  }

  if (row.position === 1 && row.duration != null) return formatRaceTime(row.duration);
  if (typeof row.gap_to_leader === 'string') return row.gap_to_leader;
  if (row.gap_to_leader != null) {
    return row.gap_to_leader === 0 ? 'Leader' : `+${Number(row.gap_to_leader).toFixed(3)}`;
  }
  if (leaderBest != null && row.duration != null) return formatRaceTime(row.duration);
  return '—';
}

export async function getSessionClassification(session, meeting, { withGrid = true } = {}) {
  if (!session?.session_key || !meeting) return { rows: [], meeting, session, hasGrid: false };

  const gridSession =
    session.session_name === 'Race'
      ? meeting.qualifying
      : session.session_name === 'Sprint'
        ? meeting.sprintQualifying || meeting.qualifying
        : null;

  const [resultRows, driverMap, gridRows] = await Promise.all([
    apiGet('session_result', { session_key: session.session_key }),
    getMeetingDrivers(meeting.meeting_key),
    withGrid && gridSession
      ? apiGet('starting_grid', { session_key: gridSession.session_key }).catch(() => [])
      : Promise.resolve([]),
  ]);

  const isQualifying = session.session_name === 'Qualifying' || session.session_name === 'Sprint Qualifying';
  const teamColors = teamColorsFromDrivers(driverMap);

  const baseRows = (resultRows || []).map((row) => {
    const driver = driverMap.get(row.driver_number) || fallbackDriver(row.driver_number);
    const bestLap = isQualifying ? bestQualifyingLap(row.duration) : null;
    return {
      ...row,
      driver,
      bestLap,
      teamColor: colorForTeam(driver.team_name, teamColors),
    };
  });

  const leaderBest = isQualifying
    ? baseRows.reduce((current, row) => (row.bestLap != null && (current == null || row.bestLap < current) ? row.bestLap : current), null)
    : null;

  const gridMap = new Map();
  (gridRows || []).forEach((row) => {
    if (row.driver_number != null && row.position != null) gridMap.set(Number(row.driver_number), Number(row.position));
  });

  const rows = baseRows
    .map((row) => {
      const gridPosition = gridMap.get(Number(row.driver_number)) ?? null;
      return {
        ...row,
        points: row.points ?? 0,
        gridPosition,
        positionsGained: gridPosition != null && row.position != null ? gridPosition - row.position : null,
        qualifyingGap:
          isQualifying && row.bestLap != null && leaderBest != null ? row.bestLap - leaderBest : null,
        displayTime:
          isQualifying && row.bestLap != null
            ? formatLapTime(row.bestLap)
            : timeTextFor(row, session.session_name, leaderBest),
      };
    })
    .sort((a, b) => {
      if (a.position == null && b.position == null) return a.driver_number - b.driver_number;
      if (a.position == null) return 1;
      if (b.position == null) return -1;
      return a.position - b.position;
    });

  return {
    rows,
    meeting,
    session,
    hasGrid: gridMap.size > 0,
    leader: rows[0] || null,
    isQualifying,
  };
}

export async function fetchRecentRaces(catalog, count = 3) {
  const meetings = catalog?.completedRaces?.slice(0, count) || [];
  return Promise.all(
    meetings.map(async (meeting) => {
      try {
        const classification = await getSessionClassification(meeting.race, meeting, { withGrid: false });
        return { meeting, rows: classification.rows };
      } catch {
        return { meeting, rows: [] };
      }
    }),
  );
}

export async function getWeather(sessionKey) {
  const rows = await apiGet('weather', { session_key: sessionKey });
  if (!rows?.length) return null;
  return [...rows].sort((a, b) => new Date(b.date) - new Date(a.date))[0];
}

export async function getRaceControl(sessionKey, limit = 8) {
  const rows = await apiGet('race_control', { session_key: sessionKey });
  if (!rows?.length) return [];
  return [...rows]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, limit);
}

export async function getDriverRecentResults(catalog, driverNumber, count = 5) {
  const meetings = catalog?.completedRaces?.slice(0, count) || [];
  const results = await Promise.all(
    meetings.map(async (meeting) => {
      try {
        const classification = await getSessionClassification(meeting.race, meeting, { withGrid: false });
        const row = classification.rows.find((item) => Number(item.driver_number) === Number(driverNumber));
        return row ? { meeting, row } : null;
      } catch {
        return null;
      }
    }),
  );
  return results.filter(Boolean);
}
