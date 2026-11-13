import { RNG_FALLBACK_SEED, RNG_MODULUS } from './constants';

export interface Random { next(): number; state(): number }

/** Xorshift32. Persist state() to continue the same stream after reloading. */
export function seededRandom(seed: number): Random {
  let value = (seed >>> 0) || RNG_FALLBACK_SEED;
  return {
    next() {
      value ^= value << 13;
      value ^= value >>> 17;
      value ^= value << 5;
      value >>>= 0;
      return value / RNG_MODULUS;
    },
    state: () => value,
  };
}

export function shuffled<T>(values: readonly T[], rng: Random): T[] {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
}
