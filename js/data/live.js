import { apiGet } from '../core/api.js';

function latestByDriver(rows, selector = (row) => new Date(row.date).getTime()) {
  const map = new Map();
  (rows || []).forEach((row) => {
    const driverNumber = Number(row.driver_number);
    if (!driverNumber) return;
    const current = map.get(driverNumber);
    if (!current || selector(row) >= selector(current)) map.set(driverNumber, row);
  });
  return map;
}

export async function getLiveSnapshot(sessionKey) {
  const [positionRows, intervalRows, weatherRows] = await Promise.all([
    apiGet('position', { session_key: sessionKey }),
    apiGet('intervals', { session_key: sessionKey }).catch(() => []),
    apiGet('weather', { session_key: sessionKey }).catch(() => []),
  ]);

  const positions = latestByDriver(positionRows);
  const intervals = latestByDriver(intervalRows);

  const rows = [...positions.values()]
    .map((row) => {
      const interval = intervals.get(Number(row.driver_number));
      return {
        driver_number: Number(row.driver_number),
        position: row.position == null ? null : Number(row.position),
        interval: interval?.interval ?? null,
        gapToLeader: interval?.gap_to_leader ?? null,
        date: row.date,
      };
    })
    .filter((row) => row.position != null)
    .sort((a, b) => a.position - b.position);

  const weather = weatherRows?.length
    ? [...weatherRows].sort((a, b) => new Date(b.date) - new Date(a.date))[0]
    : null;

  return { rows, weather, fetchedAt: Date.now() };
}

export async function getLiveStints(sessionKey) {
  const rows = await apiGet('stints', { session_key: sessionKey }).catch(() => []);
  const map = new Map();
  (rows || []).forEach((row) => {
    const driverNumber = Number(row.driver_number);
    if (!driverNumber) return;
    const current = map.get(driverNumber);
    if (!current || Number(row.stint_number) > Number(current.stint_number)) {
      map.set(driverNumber, row);
    }
  });
  return map;
}
