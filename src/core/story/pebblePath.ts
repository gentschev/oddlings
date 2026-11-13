/** Compatibility exports for older tests and tools. The registry owns the area data. */
export * from './characters';
import { AREAS, type PathDefinition } from '../areas';
export const PEBBLE_STOPS = AREAS[0].stops;
export type PebbleStop = PathDefinition;
export type { SkillStop } from '../areas';
export const STORY_LINES = { welcome: AREAS[0].stories.welcome.lines, ring: AREAS[0].stories.ring.lines };
