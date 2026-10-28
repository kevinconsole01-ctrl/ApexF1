import { apiGet } from '../core/api.js';

const TESTING = /testing/i;

function toTime(value) {
  return value ? new Date(value).getTime() : 0;
}

function sortByDate(a, b) {
  return toTime(a.date_start) - toTime(b.date_start);
}

/**
 * Costruisce il catalogo della stagione: meeting, sessioni, round e stato.
 * Le gare annullate e i test restano nel calendario ma non nelle classifiche.
 */
export async function fetchSeasonCatalog(year, { now = Date.now() } = {}) {
  const [meetingsRaw, sessionsRaw] = await Promise.all([
    apiGet('meetings', { year }),
    apiGet('sessions', { year }),
  ]);

  const meetings = (meetingsRaw || []).map((meeting) => ({
    ...meeting,
    sessions: [],
    cancelled: Boolean(meeting.is_cancelled),
    testing: TESTING.test(meeting.meeting_name || ''),
    status: 'upcoming',
    round: null,
  }));

  const byKey = new Map(meetings.map((meeting) => [meeting.meeting_key, meeting]));

  (sessionsRaw || []).forEach((session) => {
    if (session.is_cancelled) return;
    const meeting = byKey.get(session.meeting_key);
    if (!meeting) return;
    meeting.sessions.push({ ...session, cancelled: false });
  });

  meetings.forEach((meeting) => {
    meeting.sessions.sort(sortByDate);
    meeting.race = meeting.sessions.find((session) => session.session_name === 'Race') || null;
    meeting.sprint = meeting.sessions.find((session) => session.session_name === 'Sprint') || null;
    meeting.qualifying = meeting.sessions.find((session) => session.session_name === 'Qualifying') || null;
    meeting.sprintQualifying = meeting.sessions.find((session) => session.session_name === 'Sprint Qualifying') || null;
    meeting.firstSession = meeting.sessions[0] || null;
    meeting.lastSession = meeting.sessions[meeting.sessions.length - 1] || null;

    if (!meeting.cancelled) {
      const live = meeting.sessions.find(
        (session) => toTime(session.date_start) <= now && toTime(session.date_end) >= now,
      );
      meeting.liveSession = live || null;
    }

    if (meeting.cancelled) meeting.status = 'cancelled';
    else if (meeting.liveSession) meeting.status = 'live';
    else if (meeting.race && toTime(meeting.race.date_end) < now) meeting.status = 'completed';
    else if (!meeting.race && meeting.lastSession && toTime(meeting.lastSession.date_end) < now) meeting.status = 'completed';
    else meeting.status = 'upcoming';
  });

  meetings.sort(sortByDate);

  let round = 0;
  meetings.forEach((meeting) => {
    if (meeting.cancelled || meeting.testing || !meeting.race) return;
    round += 1;
    meeting.round = round;
  });

  const races = meetings.filter((meeting) => !meeting.cancelled && !meeting.testing && meeting.race);
  const completedRaces = races.filter((meeting) => meeting.status === 'completed').sort((a, b) => toTime(b.race.date_end) - toTime(a.race.date_end));
  const upcomingRaces = races.filter((meeting) => meeting.status === 'upcoming');
  const liveMeeting = meetings.find((meeting) => meeting.status === 'live') || null;
  const liveSession = liveMeeting?.liveSession || null;
  const latestCompleted = completedRaces[0] || null;
  const nextRace = upcomingRaces[0] || null;
  const nextMeeting = liveMeeting || nextRace;

  const allSessions = meetings
    .flatMap((meeting) => meeting.sessions.map((session) => ({ ...session, meeting })))
    .sort(sortByDate);

  const nextSession = allSessions.find((session) => toTime(session.date_start) > now) || null;

  const recentSessions = allSessions
    .filter((session) => ['Race', 'Qualifying', 'Sprint', 'Sprint Qualifying'].includes(session.session_name))
    .filter((session) => toTime(session.date_start) <= now)
    .sort((a, b) => toTime(b.date_start) - toTime(a.date_start));

  return {
    year,
    meetings,
    byKey,
    races,
    completedRaces,
    upcomingRaces,
    latestCompleted,
    nextRace,
    nextMeeting,
    nextSession,
    liveMeeting,
    liveSession,
    allSessions,
    recentSessions,
    totalRounds: races.length,
    completedCount: completedRaces.length,
  };
}

export function sessionsOfMeeting(meeting, { includePractices = true } = {}) {
  if (!meeting) return [];
  return meeting.sessions.filter((session) => includePractices || !String(session.session_type).includes('Practice'));
}

export function raceSessionOf(meeting) {
  return meeting?.race || null;
}

export function findSession(catalog, sessionKey) {
  const key = Number(sessionKey);
  const session = catalog.allSessions.find((item) => item.session_key === key);
  if (!session) return null;
  return { session, meeting: session.meeting };
}
