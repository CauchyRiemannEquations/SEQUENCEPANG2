import test from 'node:test';
import assert from 'node:assert/strict';
import { levels } from '../dist/levels.js';
import { encoreData } from '../dist/encore-data.js';
import { profiles } from '../scripts/generate-encore.mjs';
import { analyze } from '../scripts/generate-campaign.mjs';
import { GameSession } from '../dist/session.js';
import { stars, valid } from '../dist/engine.js';
import { playableLevels, hundredStageRelease } from '../dist/release.js';
import { nextStageIndex, readProgress, progressKey } from '../dist/progress.js';

test('midnight October 1 in Korea opens stages 51–100 without changing saved progress', () => {
  const before = playableLevels(levels, hundredStageRelease - 1);
  const after = playableLevels(levels, hundredStageRelease);
  assert.equal(before.length, 50);
  assert.equal(after.length, 100);
  const record = Object.fromEntries(before.map(level => [level.key, true]));
  const storage = { getItem: key => key === progressKey ? JSON.stringify(record) : null };
  const progress = readProgress(storage, after);
  assert.deepEqual(progress, record);
  assert.equal(nextStageIndex(after, progress), 50);
});

test('new chapters contain 50 distinct solver-verified layouts with fixed stage keys', () => {
  assert.equal(encoreData.length, 50);
  for (const [i, data] of encoreData.entries()) {
    const level = levels[i + 50], profile = profiles[i % profiles.length];
    assert.equal(level.id, i + 51);
    assert.equal(level.key, `encore-v1-${i + 51}`);
    assert.equal(level.n, profile.n);
    assert.equal(data.pacing, profile.pacing);
    assert.ok(level.n <= 5);
  }
});

for (const [i, data] of encoreData.entries()) test(`stage ${i + 51}: exact depth and playable solution`, () => {
  const level = levels[i + 50], profile = profiles[i % profiles.length];
  const result = analyze(level.board, level.n, level.moves, 30000);
  assert.ok(result);
  assert.equal(result.openings, data.legalFirstMoves);
  assert.equal(result.winning.length, data.winningFirstMoves);
  assert.ok(result.winning.length <= profile.maxWins);
  assert.ok(result.winning.length / result.openings <= profile.ratio);
  if (data.objective === 'setup') assert.ok(result.winning.every(w => w.path.every(j => !level.board[j].star)));
  const game = new GameSession(levels);
  game.start(i + 50);
  for (const path of data.solution) assert.ok(valid(game.board, path, level.n) && game.play(path));
  assert.equal(game.status, 'cleared');
  assert.equal(game.moves, 0);
  assert.equal(stars(game.board), 0);
});
