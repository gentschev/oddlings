import { BLOCKED_WINDOW, INTERLEAVE_ACCURACY, RESPONSE_LOG_LIMIT, SESSION_BREAK_MS, SESSION_STOP_MS, WARMUP_TAPS } from './constants';
import { calibrate } from './learner';
import type { Response, Save, Session } from './types';

export function currentSession(save: Save): Session {
  const session = save.sessions.at(-1);
  if (!session) throw new Error('Start a session first');
  return session;
}
/** Call at app start with force=true, and on resume with force=false. */
export function startSession(save: Save, now: number, force = true): Session {
  const previous = save.sessions.at(-1);
  if (!force && previous && now - previous.end < SESSION_BREAK_MS) {
    previous.end = now;
    return previous;
  }
  const session: Session = { id: `session-${save.sessions.length + 1}`, start: now, end: now,
    questions: 0, firstTryCorrect: 0, accuracy: 0, enteredReview: [], becameFluent: [],
    encounters: 0, retries: [], warmupTaps: 0 };
  save.sessions.push(session);
  return session;
}
export function touchSession(save: Save, now: number): void { currentSession(save).end = now; }
export function stoppingPlace(save: Save, now: number): boolean {
  return now - currentSession(save).start >= SESSION_STOP_MS;
}
export function recordWarmupTap(save: Save, latency: number): boolean {
  const session = currentSession(save);
  if (session.warmupTaps >= WARMUP_TAPS) return false;
  const { history, baseline } = calibrate(save.profile.tapHistory, latency);
  save.profile.tapHistory = history;
  save.profile.tapBaseline = baseline;
  session.warmupTaps++;
  return true;
}
export function logResponse(save: Save, response: Response, enteredReview: boolean, becameFluent: boolean): void {
  const session = currentSession(save);
  session.questions++;
  session.firstTryCorrect += Number(response.firstTryCorrect);
  session.accuracy = session.firstTryCorrect / session.questions;
  session.end = response.time;
  if (enteredReview && !session.enteredReview.includes(response.factId)) session.enteredReview.push(response.factId);
  if (becameFluent && !session.becameFluent.includes(response.factId)) session.becameFluent.push(response.factId);
  save.responses.push(response);
  if (save.responses.length > RESPONSE_LOG_LIMIT) save.responses.splice(0, save.responses.length - RESPONSE_LOG_LIMIT);
  const history = [...(save.practice.setHistory[response.setId] ?? []), response.firstTryCorrect].slice(-BLOCKED_WINDOW);
  save.practice.setHistory[response.setId] = history;
  if (history.length === BLOCKED_WINDOW && history.filter(Boolean).length / BLOCKED_WINDOW >= INTERLEAVE_ACCURACY && !save.practice.interleaved.includes(response.setId)) {
    save.practice.interleaved.push(response.setId);
  }
}
