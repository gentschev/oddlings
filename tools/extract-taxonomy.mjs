// Copies the topics we use, and the prerequisite edges among them, from a local clone of
// withmarbleapp/os-taxonomy into src/core/curriculum/taxonomy.json.
// Usage: node tools/extract-taxonomy.mjs /path/to/os-taxonomy
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const src = process.argv[2];
if (!src) throw new Error('pass the path to a clone of os-taxonomy');

const IDS = [
  'mt_t9BICauBSI', 'mt_BK5xwkrD5C', 'mt_ghF3Vv6taM', 'mt_7XcCG43ZZW', 'mt_e8CZ7E5qW7',
  'mt_PpWSHA-0kv', 'mt_ezc2m_0dzN', 'mt__we2TDqnJx', 'mt_xmmgAzxe5j', 'mt_m1W6nTQJ2b',
  'mt__t4afSyZRm',
];
// The dataset names the bonds-to-10 topic "Number bonds to 9"; its description says bonds to 10.
const DISPLAY_NAME = { mt_e8CZ7E5qW7: 'Number bonds to 10', 'mt_PpWSHA-0kv': 'Counting on and back' };

const topics = JSON.parse(readFileSync(join(src, 'data/topics.json'), 'utf8')).topics;
const deps = JSON.parse(readFileSync(join(src, 'data/dependencies.json'), 'utf8')).dependencies;
const byId = new Map(topics.map((t) => [t.id, t]));
const commit = execFileSync('git', ['-C', src, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();

const out = {
  source: 'https://github.com/withmarbleapp/os-taxonomy',
  sourceCommit: commit,
  licence: 'Data: ODbL 1.0. Text: CC BY-SA 4.0. (c) Marble.',
  topics: IDS.map((id) => {
    const t = byId.get(id);
    if (!t) throw new Error(`topic ${id} not found`);
    return {
      id,
      name: DISPLAY_NAME[id] ?? t.name,
      sourceName: t.name,
      description: t.description,
      domain: t.domain,
      ageRangeStart: t.ageRangeStart,
      ageRangeEnd: t.ageRangeEnd,
      evidence: t.evidence,
      commonCore: (t.standards ?? []).filter((s) => s.startsWith('ccss-math:')).map((s) => s.split(':')[1]),
    };
  }),
  prerequisites: deps
    .filter((d) => IDS.includes(d.topicId) && IDS.includes(d.prerequisiteId))
    .map(({ topicId, prerequisiteId, strength, reason }) => ({ topicId, prerequisiteId, strength, reason })),
};
writeFileSync('src/core/curriculum/taxonomy.json', JSON.stringify(out, null, 2) + '\n');
console.log(`${out.topics.length} topics, ${out.prerequisites.length} edges from ${commit.slice(0, 8)}`);
