import test from 'node:test';
import assert from 'node:assert/strict';
import { levels } from '../dist/levels.js';
import { GameSession } from '../dist/session.js';
import { paths, solveDetailed, remove, stars } from '../dist/engine.js';
import { MangoHints, firstHint, hintTier, hintKey, puzzleSignature } from '../dist/hints.js';
import { resetProgress, saveRun, restoreRun } from '../dist/progress.js';

const storage = () => { const data = new Map(); return { getItem: k => data.get(k) ?? null, setItem: (k,v) => data.set(k,v), removeItem: k => data.delete(k) }; };
function fail(game) {
  while (game.status === 'playing') {
    const options = paths(game.board, game.level.n);
    const path = options.find(p => stars(remove(game.board,p,game.level.n)) > 0);
    assert.ok(path, 'fixture must have a legal losing choice');
    game.play(path);
  }
  assert.equal(game.status, 'failed');
}

test('every unlocked-stage hint leads to a solution within the original move limit', () => {
  for (const level of levels) {
    const path = firstHint(level);
    if (level.id < 11) { assert.equal(path, null); continue; }
    assert.ok(path, `stage ${level.id} has a first move`);
    const game = new GameSession([level]); game.start(0);
    assert.ok(game.play(path));
    const result = solveDetailed(game.board,level.n,game.moves,20000000);
    assert.equal(result.status,'solved',`stage ${level.id} hint must remain solvable`);
    for (const next of result.solution) game.play(next);
    assert.equal(game.status,'cleared');
  }
});
test('only completed failed attempts count, once each; tiers unlock at 3 and 5', () => {
  const store = storage(), hints = new MangoHints(store,levels), game = new GameSession(levels); game.start(10);
  assert.equal(hints.recordFailure(game),false);
  game.play([0,0,0]); assert.equal(hints.recordFailure(game),false);
  game.restart(); assert.equal(hints.recordFailure(game),false);
  for (let count=1; count<=6; count++) {
    fail(game); assert.equal(hints.recordFailure(game),true);
    assert.equal(hints.recordFailure(game),false);
    assert.equal(hints.failures(game.level),Math.min(5,count));
    assert.equal(hintTier(hints.failures(game.level)),count<3?0:count<5?1:2);
    game.retry();
  }
  assert.equal(hints.failures(levels[11]),0);
  game.start(0);game.play([6,7,8]);assert.equal(hints.recordFailure(game),false);
});
test('reload retains unlocked hints by stage identity but restarts the board; reset clears both', () => {
  const store=storage(), game=new GameSession(levels), hints=new MangoHints(store,levels);game.start(10);
  for(let i=0;i<3;i++){fail(game);hints.recordFailure(game);game.retry();}
  game.play(firstHint(game.level));saveRun(store,game);
  const restored=restoreRun(store,levels), loaded=new MangoHints(store,[...levels].reverse());
  assert.deepEqual(restored.board,game.level.board);assert.equal(restored.moves,game.level.moves);
  assert.equal(hintTier(loaded.failures(game.level)),1);
  assert.equal(resetProgress(store),true);assert.equal(store.getItem(hintKey),null);
  assert.equal(new MangoHints(store,levels).failures(game.level),0);
});
test('changed puzzles, malformed records and unavailable storage never grant invalid hints', () => {
  const level=levels[10], store=storage();
  for(const raw of ['{','null','[]',JSON.stringify({[level.key]:{signature:puzzleSignature(level),failures:'5'}}),JSON.stringify({[level.key]:{signature:'old',failures:5}})]) {
    store.setItem(hintKey,raw);assert.equal(new MangoHints(store,levels).failures(level),0);
  }
  assert.equal(firstHint({...level,moves:level.moves+1}),null);
  assert.equal(firstHint({...level,key:'future-stage'}),null);
  const blocked={getItem(){throw Error();},setItem(){throw Error();}};
  const hints=new MangoHints(blocked,levels), game=new GameSession(levels);game.start(10);
  for(let i=0;i<3;i++){fail(game);hints.recordFailure(game);game.retry();}
  assert.equal(hintTier(hints.failures(level)),1);
});
