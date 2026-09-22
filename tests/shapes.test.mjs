import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { levels } from '../dist/levels.js';
import { shapeLevel } from '../dist/shape-level.js';
import { packs, preparedShapes, preparedLevels, release, publishedSource, nextRelease } from '../scripts/shape-content.mjs';
import { shapeProfiles } from '../scripts/generate-shapes.mjs';
import { analyze } from '../scripts/generate-campaign.mjs';
import { valid, remove, stars, solveDetailed, paths } from '../dist/engine.js';
import { GameSession } from '../dist/session.js';
import { dragTargets, dragHits } from '../dist/drag-hit.js';
import { saveRun, restoreRun, readProgress, campaignComplete, nextStageIndex, progressKey } from '../dist/progress.js';

const original=levels.slice(0,50), all=[...original,...preparedLevels];
test('original 1–50 content and stable identities remain byte-for-byte identical',()=>{
  assert.equal(createHash('sha256').update(JSON.stringify(original)).digest('hex'),'adc927909316f65c31566852ac5a7b49f0cf7b504c1b8e0c5940544847a70e8b');
});
test('exactly five distinct ten-stage packs are prepared, without frost or oversized grids',()=>{
  assert.deepEqual(packs.map(pack=>pack.length),[10,10,10,10,10]);
  assert.deepEqual(preparedShapes.map(l=>l.id),Array.from({length:50},(_,i)=>i+51));
  assert.equal(new Set(all.map(l=>l.key)).size,100);
  assert.equal(new Set(all.map(l=>JSON.stringify(l.board.map(c=>c?[c.v,c.star]:null)))).size,100);
  for(const d of preparedShapes){
    assert.ok(d.rows>=3&&d.rows<=5&&d.cols>=3&&d.cols<=5);
    assert.equal(d.values.length,d.rows*d.cols);
    assert.equal(d.values.filter(v=>v!==null).length>=d.minimumMoves*3,true);
    assert.equal('frost' in d,false);
    if(d.mask){
      assert.equal(d.mask.length,d.values.length);
      for(let c=0;c<d.cols;c++){
        let started=false;
        for(let r=0;r<d.rows;r++){
          const on=d.mask[r*d.cols+c];
          if(started)assert.ok(on,'no internal holes');
          started ||= on;
          assert.equal(d.values[r*d.cols+c]!==null,on);
        }
      }
    }
  }
  assert.deepEqual(preparedShapes.filter(d=>d.rows===5&&d.cols===5).map(d=>d.id),[95,99]);
});

for(const [index,d] of preparedShapes.entries())test(`prepared stage ${d.id}: exhaustive depth, openings, engine replay, mask, restart and hint`,()=>{
  const l=preparedLevels[index],p=shapeProfiles[index];
  const metrics=analyze(l.board,l.n,d.minimumMoves);
  assert.ok(metrics,'search must complete; exhausted budget is not proof of impossibility');
  assert.equal(metrics.openings,d.legalFirstMoves);
  assert.equal(metrics.winning.length,d.winningFirstMoves);
  assert.ok(metrics.winning.length>0&&metrics.winning.length<=p.maxWins);
  if(p.setup)assert.ok(metrics.winning.every(w=>w.path.every(i=>!l.board[i].star)));
  const game=new GameSession(all);game.start(d.id-1);
  let gravity=0,mixedA=false,mixedG=false;
  for(const path of d.solution){
    assert.ok(valid(game.board,path,l.n));
    const before=path.map(i=>l.board.findIndex(c=>c?.id===game.board[i].id));
    if(!valid(l.board,before,l.n))gravity++;
    const vs=path.map(i=>game.board[i].v);
    mixedA ||= vs[1]!==vs[0]&&vs[2]-vs[1]===vs[1]-vs[0];
    mixedG ||= vs[1]!==vs[0]&&vs[2]*vs[0]===vs[1]*vs[1];
    assert.ok(game.play(path));
    if(l.mask)assert.ok(game.board.every((cell,i)=>l.mask[i]||cell===null));
  }
  assert.equal(game.status,'cleared');assert.equal(stars(game.board),0);
  assert.equal(game.moves,l.moves-d.minimumMoves);
  assert.equal(gravity,d.gravitySteps);assert.ok(gravity>=p.gravity);
  assert.equal(mixedA&&mixedG,d.mixedSequences);
  if(p.mixed)assert.ok(mixedA&&mixedG);
  if(l.mask)assert.ok(d.boundarySteps>0);
  game.restart();game.play(d.solution[0]);
  const store=new Map(),storage={getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v)};
  saveRun(storage,game);const restored=restoreRun(storage,all);
  assert.equal(restored.level.key,l.key);assert.deepEqual(restored.board,l.board);assert.equal(restored.moves,l.moves);
  // Hints use the same full solver as release generation, independently of the saved solution.
  const hint=solveDetailed(l.board,l.n,l.moves,20000000);
  assert.equal(hint.status,'solved');game.restart();
  for(const path of hint.solution)assert.ok(game.play(path));
  assert.equal(game.status,'cleared');
});

test('every public boundary ends at Coming Soon and the next ten preserve completion',async()=>{
  for(const through of [50,60,70,80,90,100]){
    const payload=await import('data:text/javascript,'+encodeURIComponent(publishedSource(through)));
    const publicLevels=[...original,...payload.publishedShapes.map(shapeLevel)];
    assert.equal(publicLevels.length,through);
    assert.ok(payload.publishedShapes.every(d=>d.id<=through&&!('solution' in d)));
    const g=new GameSession(publicLevels);assert.throws(()=>g.start(through),RangeError);
    const completed=Object.fromEntries(publicLevels.map(l=>[l.key,true]));
    assert.ok(campaignComplete(publicLevels,completed));
    if(through<100){
      const expanded=all.slice(0,through+10);
      const saved=readProgress({getItem:k=>k===progressKey?JSON.stringify(completed):null},expanded);
      assert.deepEqual(saved,completed);assert.equal(campaignComplete(expanded,saved),false);
      assert.equal(nextStageIndex(expanded,saved),through);
    }
  }
  assert.equal(levels.length,release.publishedThrough);
  assert.equal(release.batchSize,10);assert.equal(release.preparedThrough,100);
  for(const [from,to] of [[50,51],[50,70],[60,50],[100,110],[50,NaN]])assert.throws(()=>nextRelease(from,to));
  for(const from of [50,60,70,80,90])assert.equal(nextRelease(from,from+10),from+10);
  const sw=await readFile(new URL('../dist/sw.js',import.meta.url),'utf8');
  assert.doesNotMatch(sw,/content\/|stages-51-60|stages-91-100/);
});

test('rectangular gravity preserves the column stride and never spawns tiles',()=>{
  const board=Array.from({length:15},(_,i)=>({v:i+1,id:String(i),star:i===0}));
  const next=remove(board,[6,10,14],3);
  assert.equal(next.length,15);assert.equal(next.filter(Boolean).length,12);
  assert.equal(next[3].id,'0');assert.equal(next[6].id,'3');assert.equal(next[12].id,'12');
  assert.equal(next[13].id,'13');assert.equal(next[14].id,'11');
});

test('rectangular and staircase dragging uses actual rows and ignores missing cells',()=>{
  for(const l of preparedLevels){
    const rows=l.board.length/l.n,w=l.n*50+(l.n-1)*7,h=rows*50+(rows-1)*7;
    const targets=dragTargets({left:10,top:20,width:w,height:h},l.n,7,7,l.board);
    assert.equal(targets.length,l.board.filter(Boolean).length);
    for(const t of targets){assert.equal(t.x,35+t.index%l.n*57);assert.equal(t.y,45+Math.floor(t.index/l.n)*57);assert.equal(t.radius,17);}
    const path=preparedShapes[l.id-51].solution[0],points=path.map(i=>targets.find(t=>t.index===i));
    for(let i=1;i<points.length;i++)assert.deepEqual(dragHits(points[i-1],points[i],targets),path.slice(i-1,i+1));
  }
  const l=preparedLevels.find(l=>l.mask),missing=l.mask.findIndex(on=>!on);
  assert.equal(valid(l.board,[missing,missing+1,missing+2],l.n),false);
});

test('a legal losing branch fails and retry restores a shaped board',()=>{
  let checked=0;
  for(const l of preparedLevels.filter(l=>l.mask)){
    for(const path of paths(l.board,l.n)){
      if(solveDetailed(remove(l.board,path,l.n),l.n,l.moves-1,2000000).status!=='unsolvable')continue;
      const game=new GameSession([l]);game.start(0);game.play(path);
      while(game.status==='playing')game.play(paths(game.board,l.n)[0]);
      assert.equal(game.status,'failed');assert.equal(game.retry(),true);assert.deepEqual(game.board,l.board);checked++;break;
    }
  }
  assert.ok(checked>=10);
});
