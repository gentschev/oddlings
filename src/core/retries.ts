import { RETRY_GAPS } from './constants';
import { currentSession } from './sessions';
import type { Retry, Save } from './types';

export function scheduleRetry(save: Save, factId: string): void {
  const session = currentSession(save);
  session.retries = session.retries.filter(r => r.factId !== factId);
  session.retries.push({ factId, step: 0, afterQuestion: session.questions + RETRY_GAPS[0], afterEncounter: session.encounters });
}
export function readyRetries(save: Save, questions = currentSession(save).questions, encounter = currentSession(save).encounters): Retry[] {
  return currentSession(save).retries.filter(r => r.afterQuestion <= questions && r.afterEncounter <= encounter)
    .sort((a, b) => a.afterQuestion - b.afterQuestion);
}
/** Advance the retry chain only when its scheduled showing was actually delivered. */
export function consumeRetry(save: Save, factId: string): void {
  const session = currentSession(save);
  const retry = readyRetries(save).find(r => r.factId === factId);
  if (!retry) return;
  session.retries = session.retries.filter(r => r !== retry);
  if (retry.step === 0) session.retries.push({ factId, step: 1, afterQuestion: session.questions + RETRY_GAPS[1] + 1, afterEncounter: session.encounters });
  if (retry.step === 1) session.retries.push({ factId, step: 2, afterQuestion: session.questions + 1, afterEncounter: session.encounters + 1 });
}
