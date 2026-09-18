import test from 'node:test';
import assert from 'node:assert/strict';
import { levels, chapters } from '../dist/levels.js';
import { paths, remove, stars, solveDetailed, valid } from '../dist/engine.js';
import { readProgress, saveProgress, progressKey } from '../dist/progress.js';
import { GameSession } from '../dist/session.js';

test('campaign has 30 distinct boards and stable identities across three chapters', () => {
  assert.equal(levels.length, 30);
  assert.equal(new Set(levels.map(l => l.key)).size, 30);
  const boards = levels.map(l => JSON.stringify(l.board.map(c => [c.v, c.star])));
  assert.equal(new Set(boards).size, 30);
  for (const level of levels) {
    assert.ok(chapters.some(c => c.id === level.chapter));
    assert.equal(level.board.length, level.n ** 2);
    assert.ok(stars(level.board) > 0);
  }
});

for (const level of levels.filter(l => ['setup', 'order'].includes(l.objective))) {
  test(`stage ${level.id} requires ${level.moves} moves and its intended opening strategy`, () => {
    assert.equal(solveDetailed(level.board, level.n, level.moves - 1).status, 'unsolvable');
    let wins = 0, losses = 0;
    for (const path of paths(level.board, level.n)) {
      const result = solveDetailed(remove(level.board, path, level.n), level.n, level.moves - 1);
      assert.notEqual(result.status, 'budget-exceeded');
      if (result.status === 'solved') {
        wins++;
        if (level.objective === 'setup') assert.equal(path.some(i => level.board[i].star), false);
      } else losses++;
    }
    assert.ok(wins > 0 && losses > 0);
  });
}

test('solver distinguishes exhausted search from impossible board', () => {
  assert.equal(solveDetailed(levels[0].board, 3, 1, 0).status, 'budget-exceeded');
  assert.equal(solveDetailed(levels[0].board, 3, 0).status, 'unsolvable');
});

test('solver supports legal sequences longer than seven tiles', () => {
  const board = Array.from({length: 9}, (_, i) => ({v:i+1, star:true, id:String(i)}));
  // Snake the values across a 3x3 board.
  [board[3], board[5]] = [board[5], board[3]];
  const result = solveDetailed(board, 3, 1);
  assert.equal(result.status, 'solved');
  assert.equal(result.solution[0].length, 9);
  assert.ok(valid(board, result.solution[0], 3));
});

test('legacy completion follows the eight original puzzles, not their old stage numbers', () => {
  const data = new Map([['sequencepang2-v1', JSON.stringify({0:true,7:true})]]);
  const storage = {getItem: key => data.get(key), setItem: (key,value) => data.set(key,value)};
  const progress = readProgress(storage, levels);
  assert.deepEqual(progress, {'original-1':true, 'original-8':true});
  progress['intro-1'] = true;
  saveProgress(storage, progress);
  assert.ok(data.has(progressKey));
  assert.deepEqual(readProgress(storage, [...levels].reverse()), progress);
  assert.equal(JSON.parse(data.get('sequencepang2-v1'))[0], true);
});

test('unavailable or malformed storage does not prevent playing', () => {
  assert.deepEqual(readProgress({getItem: () => '{'}, levels), {});
  assert.deepEqual(readProgress({getItem: () => {throw Error('blocked');}}, levels), {});
  assert.doesNotThrow(() => saveProgress({setItem: () => {throw Error('full');}}, {}));
});

test('settings restart restores a partially played board and full move count', () => {
  const session = new GameSession(levels);
  assert.equal(session.restart(), false);
  session.start(20);
  const solution = solveDetailed(session.board, session.level.n, session.moves).solution;
  session.play(solution[0]);
  assert.equal(session.status, 'playing');
  assert.equal(session.moves, 1);
  assert.equal(session.restart(), true);
  assert.equal(session.index, 20);
  assert.equal(session.moves, 2);
  assert.deepEqual(session.board, levels[20].board);
});
