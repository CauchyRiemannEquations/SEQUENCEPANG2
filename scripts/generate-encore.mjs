import { writeFile } from 'node:fs/promises';
import { paths, remove, stars, valid } from '../dist/engine.js';
import { analyze } from './generate-campaign.mjs';

// Fixed seed and solver checks make the release reproducible. These are new
// layouts, rather than rotated or renumbered copies of the first 50 puzzles.
export const profiles = [
  { pacing: 'breather', n: 4, moves: 3, maxWins: 6, ratio: .55, gravity: 1 },
  { pacing: 'choice', n: 4, moves: 4, maxWins: 4, ratio: .4, gravity: 1 },
  { pacing: 'setup', n: 5, moves: 4, maxWins: 4, ratio: .35, gravity: 2 },
  { pacing: 'gravity', n: 5, moves: 5, maxWins: 3, ratio: .3, gravity: 2 },
  { pacing: 'peak', n: 5, moves: 5, maxWins: 2, ratio: .2, gravity: 2 },
];

if (process.argv[1] === new URL(import.meta.url).pathname) {
  let seed = 20261001;
  const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);
  const pick = xs => xs[Math.floor(random() * xs.length)];
  const output = [];
  for (let attempt = 0; output.length < 50 && attempt < 500000; attempt++) {
    const index = output.length, profile = profiles[index % profiles.length];
    const { n, moves } = profile;
    const board = Array.from({ length: n * n }, (_, i) => ({ v: 1 + Math.floor(random() * 9), star: false, id: String(i) }));
    let current = board;
    const removed = [];
    for (let step = 0; step < moves; step++) {
      let options;
      try { options = paths(current, n).filter(p => p.length <= 5); } catch { break; }
      if (!options.length) break;
      const path = pick(options);
      removed.push(path.map(i => current[i].id));
      current = remove(current, path, n);
    }
    if (removed.length !== moves) continue;
    const setup = profile.pacing === 'setup';
    for (let step = setup ? 1 : 0; step < moves; step++) {
      for (const id of removed[step].filter(() => random() < .65)) board[+id].star = true;
      board[+pick(removed[step])].star = true;
    }
    if (stars(board) < (moves === 3 ? 4 : 6)) continue;
    const result = analyze(board, n, moves, 6500);
    if (!result?.winning.length || result.winning.length > profile.maxWins || result.winning.length / result.openings > profile.ratio) continue;
    if (setup && result.winning.some(w => w.path.some(i => board[i].star))) continue;
    let shifted = 0;
    current = board;
    const solution = result.winning[0].solution;
    for (const path of solution) {
      const original = path.map(i => +current[i].id);
      if (!valid(board, original, n)) shifted++;
      current = remove(current, path, n);
    }
    if (shifted < profile.gravity) continue;
    output.push({ n, moves, values: board.map(c => c.v), stars: board.flatMap((c, i) => c.star ? [i] : []),
      objective: setup ? 'setup' : 'order', pacing: profile.pacing, solution,
      winningFirstMoves: result.winning.length, legalFirstMoves: result.openings, gravitySteps: shifted });
    console.log(`Stage ${index + 51}: ${profile.pacing}, ${result.winning.length}/${result.openings} openings; candidate ${attempt}`);
  }
  if (output.length !== 50) throw Error(`Only ${output.length} of 50 verified stages generated`);
  await writeFile(new URL('../dist/encore-data.js', import.meta.url),
    `// Fixed, solver-verified puzzles 51–100. Regenerate with npm run generate:encore.\nexport const encoreData = ${JSON.stringify(output, null, 2)};\n`);
}
