/** Layers include narrow waypoints for long edges, keeping curves out of unrelated cards. */
export const TREE_LAYOUT = { minWidth: 1020, nodeWidth: 308, nodeHeight: 142, gapX: 48,
  gapY: 96, margin: 24, laneWidth: 26, portGap: 18, sweeps: 6 } as const;
interface Edge { prerequisiteId: string; topicId: string }
interface Vertex { id: string; layer: number; width: number; dummy: boolean; x: number; y: number }
interface Point { x: number; y: number }
export function treeLayout(ids: readonly string[], edges: readonly Edge[]) {
  const c = TREE_LAYOUT, ranks = new Map<string, number>(), visiting = new Set<string>();
  const rank = (id: string): number => {
    if (ranks.has(id)) return ranks.get(id)!;
    if (visiting.has(id)) throw new Error('Cyclic skill graph');
    visiting.add(id);
    const parents = edges.filter(e => e.topicId === id);
    const value = parents.length ? Math.max(...parents.map(e => rank(e.prerequisiteId))) + 1 : 0;
    visiting.delete(id); ranks.set(id, value); return value;
  };
  const vertices = new Map<string, Vertex>(ids.map(id => [id, { id, layer: rank(id), width: c.nodeWidth, dummy: false, x: 0, y: 0 }]));
  const chains = edges.map((edge, i) => {
    const chain = [vertices.get(edge.prerequisiteId)!];
    for (let layer = chain[0]!.layer + 1; layer < ranks.get(edge.topicId)!; layer++) {
      const vertex = { id: `@edge-${i}-${layer}`, layer, width: c.laneWidth, dummy: true, x: 0, y: 0 };
      vertices.set(vertex.id, vertex); chain.push(vertex);
    }
    chain.push(vertices.get(edge.topicId)!); return chain;
  });
  const layers = Array.from({ length: Math.max(...ranks.values()) + 1 }, (_, layer) => [...vertices.values()].filter(v => v.layer === layer));
  const rowWidth = (row: Vertex[]) => row.reduce((sum, v) => sum + v.width, 0) + Math.max(0, row.length - 1) * c.gapX;
  const width = Math.max(c.minWidth, ...layers.map(rowWidth).map(w => w + c.margin * 2));
  const position = () => {
    for (const row of layers) {
      let x = (width - rowWidth(row)) / 2;
      for (const v of row) { v.x = x; v.y = c.margin + v.layer * (c.nodeHeight + c.gapY); x += v.width + c.gapX; }
    }
  };
  position();
  const pairs = chains.flatMap(chain => chain.slice(1).map((to, i) => ({ from: chain[i]!, to })));
  for (let sweep = 0; sweep < c.sweeps; sweep++) for (const down of [true, false]) {
    const order = down ? layers.slice(1) : layers.slice(0, -1).reverse();
    for (const row of order) {
      const barycentre = (v: Vertex) => {
        const neighbours = pairs.filter(p => (down ? p.to : p.from) === v).map(p => down ? p.from : p.to);
        return neighbours.length ? neighbours.reduce((sum, n) => sum + n.x + n.width / 2, 0) / neighbours.length : v.x + v.width / 2;
      };
      const scores = new Map(row.map(v => [v.id, barycentre(v)]));
      row.sort((a, b) => scores.get(a.id)! - scores.get(b.id)!); position();
    }
  }
  const routes = chains.map((chain, i) => {
    const from = chain[0]!, to = chain.at(-1)!;
    const outgoing = chains.filter(r => r[0] === from).sort((a, b) => a[1]!.x - b[1]!.x);
    const incoming = chains.filter(r => r.at(-1) === to).sort((a, b) => a.at(-2)!.x - b.at(-2)!.x);
    const start: Point = { x: from.x + from.width / 2 + (outgoing.indexOf(chain) - (outgoing.length - 1) / 2) * c.portGap, y: from.y + c.nodeHeight };
    const end: Point = { x: to.x + to.width / 2 + (incoming.indexOf(chain) - (incoming.length - 1) / 2) * c.portGap, y: to.y };
    const segments: { start: Point; control1: Point; control2: Point; end: Point }[] = [];
    let current = start;
    const curve = (next: Point) => {
      const mid = (current.y + next.y) / 2;
      const control1 = { x: current.x, y: mid }, control2 = { x: next.x, y: mid };
      segments.push({ start: current, control1, control2, end: next }); current = next;
    };
    for (const waypoint of chain.slice(1, -1)) {
      const x = waypoint.x + waypoint.width / 2;
      curve({ x, y: waypoint.y }); curve({ x, y: waypoint.y + c.nodeHeight });
    }
    curve(end);
    const path = `M ${start.x} ${start.y} ` + segments.map(s => `C ${s.control1.x} ${s.control1.y}, ${s.control2.x} ${s.control2.y}, ${s.end.x} ${s.end.y}`).join(' ');
    return { ...edges[i]!, start, end, segments, path };
  });
  return { nodes: ids.map(id => ({ ...vertices.get(id)!, height: c.nodeHeight })), edges: routes,
    width, height: c.margin * 2 + layers.length * c.nodeHeight + (layers.length - 1) * c.gapY };
}
