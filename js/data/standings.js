import { apiGet } from '../core/api.js';
import { fallbackDriver, getDriverInfoAnywhere, getMeetingDrivers, teamColorsFromDrivers, colorForTeam } from './drivers.js';

function standingsMeeting(catalog) {
  return catalog?.latestCompleted || catalog?.liveMeeting || null;
}

async function enrichMissingDrivers(driverMap, numbers) {
  const missing = [...new Set(numbers)].filter((number) => !driverMap.has(number));
  if (!missing.length) return;
  const results = await Promise.all(missing.map((number) => getDriverInfoAnywhere(number)));
  results.forEach((driver, index) => {
    if (driver) driverMap.set(missing[index], driver);
  });
}

export async function getDriverStandings(catalog) {
  const meeting = standingsMeeting(catalog);
  if (!meeting) {
    return { rows: [], meeting: null, leader: null, sessionKey: null };
  }

  const [champRows, initialDrivers] = await Promise.all([
    apiGet('championship_drivers', { meeting_key: meeting.meeting_key }),
    getMeetingDrivers(meeting.meeting_key),
  ]);

  if (!champRows?.length) {
    return { rows: [], meeting, leader: null, sessionKey: null };
  }

  const driverMap = new Map(initialDrivers);
  await enrichMissingDrivers(driverMap, champRows.map((row) => row.driver_number));
  const teamColors = teamColorsFromDrivers(driverMap);

  const rows = champRows
    .map((row) => {
      const driver = driverMap.get(row.driver_number) || fallbackDriver(row.driver_number);
      const position = row.position_current ?? row.position_start ?? null;
      return {
        ...row,
        driver,
        position,
        points: row.points_current ?? 0,
        pointsStart: row.points_start ?? 0,
        pointsGain: (row.points_current ?? 0) - (row.points_start ?? 0),
        positionDelta:
          row.position_start != null && row.position_current != null
            ? row.position_start - row.position_current
            : 0,
        teamColor: colorForTeam(driver.team_name, teamColors),
      };
    })
    .sort((a, b) => (a.position ?? 99) - (b.position ?? 99));

  const leader = rows[0] || null;
  rows.forEach((row) => {
    row.gapToLeader = leader ? leader.points - row.points : 0;
  });

  return {
    rows,
    meeting,
    leader,
    sessionKey: champRows[0]?.session_key ?? null,
  };
}

export async function getTeamStandings(catalog) {
  const meeting = standingsMeeting(catalog);
  if (!meeting) {
    return { rows: [], meeting: null, leader: null };
  }

  const [champRows, driverMap] = await Promise.all([
    apiGet('championship_teams', { meeting_key: meeting.meeting_key }),
    getMeetingDrivers(meeting.meeting_key),
  ]);

  if (!champRows?.length) {
    return { rows: [], meeting, leader: null };
  }

  const teamColors = teamColorsFromDrivers(driverMap);
  const rows = champRows
    .map((row) => {
      const position = row.position_current ?? row.position_start ?? null;
      return {
        ...row,
        position,
        points: row.points_current ?? 0,
        pointsStart: row.points_start ?? 0,
        pointsGain: (row.points_current ?? 0) - (row.points_start ?? 0),
        positionDelta:
          row.position_start != null && row.position_current != null
            ? row.position_start - row.position_current
            : 0,
        color: colorForTeam(row.team_name, teamColors),
      };
    })
    .sort((a, b) => (a.position ?? 99) - (b.position ?? 99));

  const leader = rows[0] || null;
  rows.forEach((row) => {
    row.gapToLeader = leader ? leader.points - row.points : 0;
  });

  return { rows, meeting, leader };
}

export async function getStandingsHistory(catalog, rounds = 6) {
  const meetings = catalog?.completedRaces?.slice(0, rounds).reverse() || [];
  if (!meetings.length) return [];

  const results = await Promise.all(
    meetings.map(async (meeting) => {
      try {
        const rows = await apiGet('championship_drivers', { meeting_key: meeting.meeting_key });
        if (!rows?.length) return null;
        const byDriver = new Map();
        rows.forEach((row) => byDriver.set(row.driver_number, row));
        return { meeting, byDriver };
      } catch {
        return null;
      }
    }),
  );

  return results.filter(Boolean);
}

export function pointsSeriesForDrivers(history, rows, limit = 5) {
  const top = rows.slice(0, limit);
  const series = top.map((row) => {
    let lastValue = 0;
    const points = history.map((snapshot, index) => {
      const entry = snapshot.byDriver.get(row.driver_number);
      if (entry) lastValue = entry.points_current ?? lastValue;
      return { x: index + 1, y: lastValue };
    });
    return {
      name: row.driver?.name_acronym || row.driver?.last_name || '—',
      color: row.teamColor,
      points,
      fullName: row.driver?.full_name,
    };
  });

  return {
    series,
    labels: history.map((snapshot) => snapshot.meeting.country_code || `R${snapshot.meeting.round}`),
    meetings: history.map((snapshot) => snapshot.meeting),
  };
}
