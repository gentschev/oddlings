/** Cycle through different adult questions. A repeat hold never reuses the last one. */
const CHALLENGES = [[7, 8], [6, 9], [8, 9], [7, 6], [9, 9], [8, 8], [6, 6], [7, 7]] as const;
export function nextParentChallenge(previous: number) {
  const index = (previous + 1) % CHALLENGES.length;
  const [a, b] = CHALLENGES[index]!;
  return { index, a, b, answer: a * b };
}
