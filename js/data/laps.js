import { apiGet } from '../core/api.js';

function num(value) {
  return value == null || Number.isNaN(Number(value)) ? null : Number(value);
}

export async function getSessionLaps(sessionKey) {
  const raw = await apiGet('laps', { session_key: sessionKey });

  const rows = (raw || [])
    .map((row) => ({
      ...row,
      driver_number: Number(row.driver_number),
      lap_number: Number(row.lap_number),
      lap_duration: num(row.lap_duration),
      duration_sector_1: num(row.duration_sector_1),
      duration_sector_2: num(row.duration_sector_2),
      duration_sector_3: num(row.duration_sector_3),
      i1_speed: num(row.i1_speed),
      i2_speed: num(row.i2_speed),
      st_speed: num(row.st_speed),
      is_pit_out_lap: Boolean(row.is_pit_out_lap),
    }))
    .filter((row) => row.driver_number && row.lap_number)
    .sort((a, b) => a.lap_number - b.lap_number);

  const byDriver = new Map();
  const bestByDriver = new Map();

  rows.forEach((lap) => {
    if (!byDriver.has(lap.driver_number)) byDriver.set(lap.driver_number, []);
    byDriver.get(lap.driver_number).push(lap);

    if (lap.lap_duration != null) {
      const current = bestByDriver.get(lap.driver_number);
      if (!current || lap.lap_duration < current.lap_duration) {
        bestByDriver.set(lap.driver_number, lap);
      }
    }
  });

  let sessionBest = null;
  bestByDriver.forEach((lap) => {
    if (!sessionBest || lap.lap_duration < sessionBest.lap_duration) sessionBest = lap;
  });

  const sectorKeys = ['duration_sector_1', 'duration_sector_2', 'duration_sector_3'];
  const bestSectors = sectorKeys.map((key) => {
    let best = null;
    rows.forEach((lap) => {
      const value = lap[key];
      if (value != null && (!best || value < best.value)) {
        best = {
          value,
          driver_number: lap.driver_number,
          lap_number: lap.lap_number,
        };
      }
    });
    return best;
  });

  let topSpeed = null;
  rows.forEach((lap) => {
    if (lap.st_speed != null && (!topSpeed || lap.st_speed > topSpeed.value)) {
      topSpeed = { value: lap.st_speed, driver_number: lap.driver_number, lap_number: lap.lap_number };
    }
  });

  return {
    sessionKey,
    rows,
    byDriver,
    bestByDriver,
    sessionBest,
    bestSectors,
    topSpeed,
    totalLaps: rows.length,
  };
}

export function driverLapStats(laps = []) {
  const valid = laps.filter((lap) => lap.lap_duration != null && !lap.is_pit_out_lap);
  const best = valid.reduce((current, lap) => (!current || lap.lap_duration < current.lap_duration ? lap : current), null);
  const average = valid.length ? valid.reduce((sum, lap) => sum + lap.lap_duration, 0) / valid.length : null;
  const topSpeed = laps.reduce((current, lap) => (lap.st_speed != null && (!current || lap.st_speed > current) ? lap.st_speed : current), null);
  const finished = laps.filter((lap) => lap.lap_duration != null);

  const sectors = ['duration_sector_1', 'duration_sector_2', 'duration_sector_3'].map((key) => {
    let bestSector = null;
    laps.forEach((lap) => {
      if (lap[key] != null && (!bestSector || lap[key] < bestSector.value)) {
        bestSector = { value: lap[key], lap_number: lap.lap_number };
      }
    });
    return bestSector;
  });

  return {
    best,
    average,
    topSpeed,
    laps: finished.length,
    sectors,
  };
}

export function fastestLaps(lapsData, driverMap, limit = 10) {
  if (!lapsData) return [];
  const rows = [];
  lapsData.bestByDriver.forEach((lap, driverNumber) => {
    rows.push({
      ...lap,
      driver: driverMap?.get(driverNumber) || null,
      gap: lapsData.sessionBest ? lap.lap_duration - lapsData.sessionBest.lap_duration : null,
    });
  });
  return rows.sort((a, b) => a.lap_duration - b.lap_duration).slice(0, limit);
}
