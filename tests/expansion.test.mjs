import test from 'node:test';
import assert from 'node:assert/strict';
import { levels } from '../dist/levels.js';
import { expansionData } from '../dist/expansion-data.js';
import { profiles } from '../scripts/generate-expansion.mjs';
import { analyze } from '../scripts/generate-campaign.mjs';
import { valid, stars } from '../dist/engine.js';
import { GameSession } from '../dist/session.js';
import { readProgress, progressKey } from '../dist/progress.js';

test('expansion uses four five-stage waves, no board larger than 5x5', () => {
  assert.equal(expansionData.length,20);
  assert.ok(levels.every(l => l.n <= 5));
  for(let i=0;i<20;i++) {
    const p=profiles[i%5], l=levels[i+30], data=expansionData[i];
    assert.equal(l.n,p.n);assert.equal(l.moves,p.moves);assert.equal(data.pacing,p.pacing);
    assert.equal(l.id,i+31);
    assert.equal(l.key,`expansion-v1-${i+31}`);
  }
});
for(const [i,data] of expansionData.entries())test(`stage ${i+31}: minimum depth, openings, gravity, complete playthrough`, () => {
  const l=levels[i+30], p=profiles[i%5];
  const result=analyze(l.board,l.n,l.moves);
  assert.ok(result,'must prove shorter solutions impossible without exhausting search');
  assert.equal(result.openings,data.legalFirstMoves);
  assert.equal(result.winning.length,data.winningFirstMoves);
  assert.ok(result.winning.length>0 && result.winning.length<=p.maxWins);
  assert.ok(result.winning.length/result.openings<=p.ratio);
  if(p.pacing==='relief')assert.ok(result.winning.length>=2);
  if(data.objective==='setup')assert.ok(result.winning.every(w=>w.path.every(i=>!l.board[i].star)));
  const g=new GameSession(levels);g.start(i+30);
  let shifted=0,geometric=false,arithmetic=false;
  for(const path of data.solution) {
    assert.ok(valid(g.board,path,l.n));
    const original=path.map(i=>l.board.findIndex(c=>c.id===g.board[i].id));
    if(!valid(l.board,original,l.n))shifted++;
    const v=path.map(i=>g.board[i].v);
    geometric ||= v[1]!==v[0] && v[2]*v[0]===v[1]*v[1];
    arithmetic ||= v[1]!==v[0] && v[2]-v[1]===v[1]-v[0];
    assert.ok(g.play(path));
  }
  assert.equal(shifted,data.gravitySteps);assert.ok(shifted>=p.gravity);
  if(p.pacing==='variation')assert.ok(geometric && arithmetic);
  assert.equal(g.status,'cleared');assert.equal(g.moves,0);assert.equal(stars(g.board),0);
});
test('all existing progress survives and stage 31 is the next unfinished stage', () => {
  const saved=Object.fromEntries(levels.slice(0,30).map(l=>[l.key,true]));
  const progress=readProgress({getItem:k=>k===progressKey?JSON.stringify(saved):null},levels);
  assert.deepEqual(progress,saved);
  assert.equal(levels.find(l=>!progress[l.key]).id,31);
});
test('stage 50 is playable and restart restores the final board', () => {
  const g=new GameSession(levels);g.start(49);g.play(expansionData[19].solution[0]);
  assert.equal(g.restart(),true);assert.equal(g.index,49);
  assert.deepEqual(g.board,levels[49].board);assert.equal(g.moves,levels[49].moves);
});
