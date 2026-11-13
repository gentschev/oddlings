export const STARTERS = ['tenny', 'domi', 'inch'] as const;
export type FriendId = typeof STARTERS[number] | 'fivel' | 'twoot' | 'bix';
/** The stable, complete pattern for each pal when no question is being modeled. */
export const FRIEND_PATTERNS: Record<FriendId, number> = { tenny: 10, domi: 10, inch: 10, fivel: 5, twoot: 2, bix: 6 };
