export type Mode = 'modeled' | 'plain';
export interface FactState {
  id: string;
  stage: 'new' | 'learning' | 'review';
  seen: number;
  firstTryCorrect: number;
  strength: number;
  streak: number;
  ladder: number;
  dueAt: number | null;
  lastSeenAt: number | null;
  latencies: number[];
  fastDays: string[];
  lapses: number;
  provisional: boolean;
  streakEncounters: string[];
  needsModel: boolean;
}
export interface Retry {
  factId: string;
  step: 0 | 1 | 2;
  afterQuestion: number;
  afterEncounter: number;
}
export interface Session {
  id: string;
  start: number;
  end: number;
  questions: number;
  firstTryCorrect: number;
  accuracy: number;
  enteredReview: string[];
  becameFluent: string[];
  encounters: number;
  retries: Retry[];
  warmupTaps: number;
  campOffered?: boolean;
}
export interface Response {
  factId: string;
  time: number;
  correct: boolean;
  firstTryCorrect: boolean;
  neededHelp: boolean;
  latency: number | null;
  mode: Mode;
  score: 0 | 0.5 | 1;
  encounterId: string;
  setId: string;
}
/** Legacy summary retained for save and parent-view compatibility. SetCheck holds the evidence. */
export interface Placement {
  active: boolean;
  setIndex: number;
  probes: string[];
  results: boolean[];
  recheckGap?: number;
}
export interface SetCheck {
  status: 'checking' | 'learning' | 'passed';
  probes: string[]; results: boolean[]; recheckGap: number;
}
export interface Save {
  version: 2;
  profile: { name: string; tapBaseline: number; tapHistory: number[] };
  facts: Record<string, FactState>;
  team: { partner: string | null; friends: string[]; helped: string[] };
  map: { area: number; clearedSpots: string[]; position?: string; gatePracticeIndex?: number; encounteredPals?: string[]; deferredStops?: string[] };
  story: { completedBeats: string[]; introComplete: boolean };
  sessions: Session[];
  responses: Response[];
  settings: { sound: boolean; voice: boolean };
  practice: { checks?: Record<string, SetCheck>; streaks?: Record<string, string[]>; placement: Placement; setHistory: Record<string, boolean[]>; interleaved: string[] };
}
export interface AnswerEvidence {
  mode?: Mode;
  now: number;
  localDate: string;
  encounterId: string;
  correct: boolean;
  hintUsed: boolean;
  latency: number;
  hidden: boolean;
}
export interface Slot {
  factId: string;
  setId: string;
  mode: Mode;
  source: 'retry' | 'due' | 'learning' | 'new' | 'known' | 'placement';
}
