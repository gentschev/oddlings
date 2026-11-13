import { mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'vite';

const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false, ws: false, watch: null }, appType: 'custom' });
try {
  const { speechLines } = await server.ssrLoadModule('/src/game/speechLines.ts');
  const lines = speechLines();
  const ids = new Set();
  for (const line of lines) {
    if (!/^[a-zA-Z0-9._-]+$/.test(line.id) || ids.has(line.id) || !line.text.trim()) throw new Error(`Invalid speech line: ${line.id}`);
    ids.add(line.id);
  }
  await mkdir('tools/speech', { recursive: true });
  await writeFile('tools/speech/lines.json', `${JSON.stringify(lines, null, 2)}\n`);
  console.log(`Exported ${lines.length} speech lines to tools/speech/lines.json`);
} finally { await server.close(); }
