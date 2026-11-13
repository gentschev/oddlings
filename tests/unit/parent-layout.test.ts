import { describe, expect, it } from 'vitest';
import { taxonomy, createSave } from '../../src/core';
import { skillTree } from '../../src/parent/model';
import { recoveryBanner } from '../../src/parent/recovery';
import { treeLayout, TREE_LAYOUT } from '../../src/parent/treeLayout';
import { contains, overlaps } from '../../src/game/layout';

describe('layered parent skill graph', () => {
  it('uses longest paths, keeps cards disjoint and routes every curve downward outside other cards', () => {
    const tree = skillTree(createSave());
    for (const [i, node] of tree.nodes.entries()) {
      expect(contains({ x: 0, y: 0, width: tree.width, height: tree.height }, node)).toBe(true);
      for (const other of tree.nodes.slice(i + 1)) expect(overlaps(node, other)).toBe(false);
      const parents = tree.edges.filter(e => e.topicId === node.id).map(e => tree.nodes.find(n => n.id === e.prerequisiteId)!);
      expect(node.layer).toBe(parents.length ? 1 + Math.max(...parents.map(n => n.layer)) : 0);
    }
    for (const edge of tree.edges) {
      expect(edge.end.y).toBeGreaterThan(edge.start.y);
      for (const segment of edge.segments) {
        expect(segment.control1.y).toBeGreaterThan(segment.start.y);
        expect(segment.control2.y).toBeLessThan(segment.end.y);
        for (let sample = 1; sample < 100; sample++) {
          const t = sample / 100, u = 1 - t;
          const point = { x: u ** 3 * segment.start.x + 3 * u ** 2 * t * segment.control1.x + 3 * u * t ** 2 * segment.control2.x + t ** 3 * segment.end.x,
            y: u ** 3 * segment.start.y + 3 * u ** 2 * t * segment.control1.y + 3 * u * t ** 2 * segment.control2.y + t ** 3 * segment.end.y,
            width: 1, height: 1 };
          for (const node of tree.nodes.filter(n => n.id !== edge.prerequisiteId && n.id !== edge.topicId)) expect(overlaps(node, point), `${edge.prerequisiteId} to ${edge.topicId} crosses ${node.id}`).toBe(false);
        }
      }
    }
    for (const node of tree.nodes) {
      const outgoing = tree.edges.filter(e => e.prerequisiteId === node.id);
      const incoming = tree.edges.filter(e => e.topicId === node.id);
      expect(new Set(outgoing.map(e => e.start.x)).size).toBe(outgoing.length);
      expect(new Set(incoming.map(e => e.end.x)).size).toBe(incoming.length);
    }
    expect(treeLayout(taxonomy.topics.map(t => t.id), taxonomy.prerequisites)).toEqual(treeLayout(taxonomy.topics.map(t => t.id), taxonomy.prerequisites));
  });
  it('centres layers and reduces a simple crossing with barycentres', () => {
    const tree = treeLayout(['a', 'b', 'c', 'd'], [{ prerequisiteId: 'a', topicId: 'd' }, { prerequisiteId: 'b', topicId: 'c' }]);
    const node = (id: string) => tree.nodes.find(n => n.id === id)!;
    expect(Math.sign(node('a').x - node('b').x)).toBe(Math.sign(node('d').x - node('c').x));
    for (const layer of [0, 1]) {
      const nodes = tree.nodes.filter(n => n.layer === layer);
      expect(Math.min(...nodes.map(n => n.x)) + Math.max(...nodes.map(n => n.x + n.width))).toBe(tree.width);
    }
    expect(node('a').height).toBe(TREE_LAYOUT.nodeHeight);
  });
});
it('shows the dated recovery banner only when storage reports a restored backup', () => {
  expect(recoveryBanner(undefined)).toBe('');
  expect(recoveryBanner('2026-11-10')).toContain('Restored from backup of 2026-11-10.');
  expect(recoveryBanner('2026-11-10')).toContain('role="status"');
  expect(recoveryBanner('<script>')).not.toContain('<script>');
});
