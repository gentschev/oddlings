import { execFileSync } from 'node:child_process';

/** CI supplies its deploy commit. Local builds use the repository, with a safe fallback. */
export function buildVersion(env: { GITHUB_SHA?: string } = process.env, now = new Date(),
  git = () => execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()): string {
  let hash = env.GITHUB_SHA;
  if (!hash) { try { hash = git(); } catch { hash = 'dev'; } }
  const short = /^[a-f0-9]{7,40}$/i.test(hash) ? hash.slice(0, 7) : 'dev';
  return `${now.toISOString().slice(0, 10)} · ${short}`;
}
