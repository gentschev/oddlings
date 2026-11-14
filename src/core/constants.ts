/** Milliseconds in a spacing day. Local date labels are supplied separately. */
export const DAY_MS = 86_400_000;
/** Increasing delays after acquisition and successful due reviews. */
export const REVIEW_INTERVALS_DAYS = [1, 3, 7, 16, 35, 90] as const;
/** Weight of the latest response in the strength estimate. */
export const STRENGTH_ALPHA = 0.3;
/** Correct streak required to acquire a fact. */
export const ACQUISITION_STREAK = 3;
/** Separate encounters required within the acquisition streak. */
export const ACQUISITION_ENCOUNTERS = 2;
/** Ladder steps lost on a lapse. */
export const LAPSE_STEPS = 2;
/** Default motor response estimate until warm-up data is available. */
export const DEFAULT_TAP_BASELINE = 1500;
/** Extra time allowed for recalling an answer after finding its button. */
export const RECALL_ALLOWANCE = 2000;
/** Bounds on the fast-answer threshold. */
export const FAST_BOUNDS = [2500, 5000] as const;
/** Warm-up taps per session. */
export const WARMUP_TAPS = 5;
/** Retained calibration history across sessions. */
export const TAP_HISTORY_SIZE = 15;
/** Retained correct-answer timings per fact. */
export const LATENCY_HISTORY_SIZE = 5;
/** Distinct fast dates required for fluency, also the retained date count. */
export const FLUENT_DAYS = 3;
/** Longer or hidden responses are excluded from timing evidence. */
export const MAX_LATENCY_MS = 20_000;
/** Delay before pulsing a hint. */
export const HINT_PULSE_MS = 8000;
/** Delay before automatically revealing a model. */
export const AUTO_MODEL_MS = 20_000;
/** Fraction of a set that must be confirmed accurate or fluent. */
export const SET_MASTERY_RATIO = 0.9;
/** Limit on unfinished sets available for introduction at once. */
export const MAX_SETS_IN_INTRO = 2;
/** Accuracy history length before mixing unfinished sets. */
export const BLOCKED_WINDOW = 10;
/** Required accuracy to start interleaving a set. */
export const INTERLEAVE_ACCURACY = 0.8;
/** Adaptive acquisition window: low, normal and high accuracy. */
export const LEARNING_WINDOW = { low: 2, normal: 3, high: 4 } as const;
/** Minimum sample size for adjusting the learning window. */
export const WINDOW_MIN_ANSWERS = 12;
/** Shrink the window below this first-try accuracy. */
export const WINDOW_LOW_ACCURACY = 0.75;
/** Grow the window above this first-try accuracy. */
export const WINDOW_HIGH_ACCURACY = 0.9;
/** Encounter size bounds and default. */
export const ENCOUNTER_LENGTH = { min: 6, default: 8, max: 10 } as const;
/** Maximum fraction of slots filled with scheduled due reviews. */
export const MAX_DUE_RATIO = 0.6;
/** Minimum fraction of slots filled with already acquired facts. */
export const MIN_KNOWN_RATIO = 0.7;
/** Known share for sessions with sustained high first-try accuracy. */
export const MIN_KNOWN_RATIO_HIGH = 0.4;
/** Different independent recalls needed to skip unseen facts in a learned set. */
export const SET_STREAK_PASS = 5;
/** Other questions before each within-session retry. */
export const RETRY_GAPS = [2, 6] as const;
/** Correct answers remove one puff, or two for quick recall. */
export const MUDDLE_MOVE = { correct: 1, fast: 2 } as const;
/** Hardest facts sampled per placement set. Both must be first-try correct. */
export const PLACEMENT_PROBES = 2;
/** Provisional confirmations per encounter while unseen material or entry checks remain. */
export const PLACEMENT_CONFIRMATION_LIMIT = 2;
/** Space confirmations between probes, once every three placement questions. */
export const PLACEMENT_CONFIRMATION_GAP = 3;
/** Absence that starts a new session. */
export const SESSION_BREAK_MS = 5 * 60_000;
/** Duration at which camp offers a natural stopping place. */
export const SESSION_STOP_MS = 10 * 60_000;
/** Parent-view response history cap. */
export const RESPONSE_LOG_LIMIT = 2000;
/** Current save version. Version zero is the migration scaffold. */
export const SAVE_VERSION = 2;
/** Unsigned 32-bit generator modulus. */
export const RNG_MODULUS = 0x1_0000_0000;
/** Nonzero fallback for the xorshift generator's absorbing zero state. */
export const RNG_FALLBACK_SEED = 0x9e3779b9;

/** Other scored questions before checking a slipped placement set again. */
export const PLACEMENT_RECHECK_GAP = 2;
/** A second missed probe, rather than a single slip, stops a placement set. */
export const PLACEMENT_MISS_LIMIT = 2;
/** Confirmed due facts needed to show a cloud on an already completed stop. */
export const STOP_HELP_DUE = 3;

/** Largest answer on the current number pad. */
export const ANSWER_MAX = 20;
