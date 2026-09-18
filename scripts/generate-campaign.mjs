import { writeFile } from 'node:fs/promises';
import { paths, remove, solveDetailed } from '../dist/engine.js';

// Offline authoring only. Output is fixed data, never randomized during play.
let seed = 20260918;
const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);
const output = [];
let attempts = 0;
while (output.length < 14 && attempts++ < 50000) {
  const index = output.length, moves = index < 10 ? 2 : 3;
  const board = Array.from({ length: 16 }, (_, i) => ({ v: 1 + Math.floor(random() * 9), star: false, id: `new-${index}-${i}` }));
  const starred = new Set();
  while (starred.size < (index < 4 ? 4 : 3)) starred.add(Math.floor(random() * 16));
  for (const i of starred) board[i].star = true;
  const shorter = solveDetailed(board, 4, moves - 1, 50000);
  if (shorter.status !== 'unsolvable') continue;
  const result = solveDetailed(board, 4, moves, 100000);
  if (result.status !== 'solved') continue;
  const firstMoves = paths(board, 4);
  const winning = [];
  let incomplete = false;
  for (const path of firstMoves) {
    const tail = solveDetailed(remove(board, path, 4), 4, moves - 1, 100000);
    if (tail.status === 'budget-exceeded') { incomplete = true; break; }
    if (tail.status === 'solved') winning.push(path);
  }
  if (incomplete || !winning.length) continue;
  const setup = index >= 4;
  if (setup && winning.some(path => path.some(i => board[i].star))) continue;
  if (!setup && (winning.length > 3 || winning.length === firstMoves.length)) continue;
  output.push({ n: 4, moves, values: board.map(c => c.v), stars: [...starred], objective: setup ? 'setup' : 'order', solution: result.solution, winningFirstMoves: winning.length });
  console.log(`Accepted stage ${17 + index}, ${moves} moves, ${winning.length}/${firstMoves.length} winning openings (${attempts} candidates)`);
}
if (output.length !== 14) throw Error('Not enough verified candidates');
await writeFile(new URL('../dist/campaign-data.js', import.meta.url), `// Fixed, solver-verified campaign boards. Regenerate with npm run generate:campaign.\nexport const campaignData = ${JSON.stringify(output, null, 2)};\n`);
