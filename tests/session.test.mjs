import test from 'node:test';
import assert from 'node:assert/strict';
import { GameSession, hasMove } from '../dist/session.js';

const makeLevel = (moves, starIndex = 3) => ({
  n: 2, moves, board: [1, 2, 3, 5].map((v, i) => ({ v, star: i === starIndex, id: `tile-${i}` }))
});

test('invalid selection neither consumes a move nor changes the board', () => {
  const game = new GameSession([makeLevel(2)]);
  game.start(0);
  const before = structuredClone(game.board);
  assert.equal(game.play([0, 1, 3]), null);
  assert.equal(game.moves, 2);
  assert.deepEqual(game.board, before);
  assert.equal(game.status, 'playing');
});

test('exhausted moves fail and cannot accept further input', () => {
  const game = new GameSession([makeLevel(1)]);
  game.start(0);
  assert.equal(game.play([0, 1, 2]).status, 'failed');
  assert.equal(game.moves, 0);
  const before = structuredClone(game.board);
  assert.equal(game.play([0, 1, 2]), null);
  assert.deepEqual(game.board, before);
});

test('retry restores the same stage, full move budget and all stars', () => {
  const levels = [makeLevel(1), makeLevel(3)];
  const game = new GameSession(levels);
  game.start(1);
  assert.equal(game.retry(), false);
  game.play([0, 1, 2]);
  assert.equal(game.status, 'failed');
  assert.equal(game.retry(), true);
  assert.equal(game.index, 1);
  assert.equal(game.moves, 3);
  assert.equal(game.status, 'playing');
  assert.deepEqual(game.board, levels[1].board);
  assert.notEqual(game.board, levels[1].board);
});

test('no legal sequence ends a run even with moves left', () => {
  const game = new GameSession([makeLevel(5)]);
  game.start(0);
  assert.equal(hasMove(game.board, 2), true);
  game.play([0, 1, 2]);
  assert.equal(game.moves, 4);
  assert.equal(hasMove(game.board, 2), false);
  assert.equal(game.status, 'failed');
});

test('collecting the last star on the last move wins rather than fails', () => {
  const game = new GameSession([makeLevel(1, 0)]);
  game.start(0);
  assert.equal(game.play([0, 1, 2]).status, 'cleared');
  assert.equal(game.moves, 0);
  assert.equal(game.retry(), false);
});
