import test from 'node:test';
import assert from 'node:assert/strict';
import { GameSession } from '../dist/session.js';
import { levels } from '../dist/levels.js';
import { solveDetailed, paths } from '../dist/engine.js';
import { saveRun, restoreRun, runKey, readProgress, saveProgress, progressKey, nextStageIndex, resetProgress } from '../dist/progress.js';
const storage=()=>{const data=new Map();return {getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};};

test('every stage resumes the exact remaining board and move count after a refresh',()=>{
  for(const level of levels){
    const store=storage(),game=new GameSession(levels);game.start(level.id-1);
    saveRun(store,game);
    assert.deepEqual(restoreRun(store,levels).board,game.board);
    const plan=solveDetailed(game.board,level.n,game.moves,20000000).solution;
    for(const path of plan.slice(0,-1)){
      game.play(path);saveRun(store,game);const restored=restoreRun(store,levels);
      assert.deepEqual(restored.board,game.board);assert.equal(restored.moves,game.moves);
      assert.deepEqual(restored.history,game.history);assert.equal(restored.index,game.index);
    }
  }
});
test('clearing removes active run and start advances using existing completion records',()=>{
  const store=storage(),game=new GameSession(levels);game.start(0);saveRun(store,game);
  game.play([6,7,8]);const progress={[levels[0].key]:true};saveProgress(store,progress);saveRun(store,game);
  assert.equal(store.getItem(runKey),null);assert.equal(restoreRun(store,levels),null);
  assert.equal(nextStageIndex(levels,readProgress(store,levels)),1);
  assert.equal(nextStageIndex(levels,{}),0);
  assert.equal(nextStageIndex(levels,Object.fromEntries(levels.map(l=>[l.key,true]))),0);
});
test('failure and refresh restart the same stage without preserving a dead board',()=>{
  const small={key:'test',n:2,moves:1,board:[1,2,3,5].map((v,i)=>({v,star:i===3,id:String(i)}))};
  const store=storage(),game=new GameSession([small]);game.start(0);game.play([0,1,2]);assert.equal(game.status,'failed');
  saveRun(store,game);const restored=restoreRun(store,[small]);assert.equal(restored.status,'playing');
  assert.equal(restored.moves,1);assert.deepEqual(restored.board,small.board);assert.deepEqual(restored.history,[]);
});
test('corrupt, removed or illegal cached paths cannot create a broken game',()=>{
  for(const saved of ['{',JSON.stringify({version:8,key:levels[0].key,history:[]}),JSON.stringify({version:1,key:'missing',history:[]}),JSON.stringify({version:1,key:levels[0].key,history:[[0,0,0]]}),JSON.stringify({version:1,key:levels[0].key,history:[[6,7,8],[6,7,8]]})]){
    const store=storage();store.setItem(runKey,saved);assert.equal(restoreRun(store,levels),null);
  }
});
test('blocked storage remains playable and old completion keys retain their meaning',()=>{
  const blocked={getItem:()=>{throw Error('blocked')},setItem:()=>{throw Error('full')},removeItem:()=>{throw Error('blocked')}};
  const game=new GameSession(levels);game.start(16);
  assert.doesNotThrow(()=>saveRun(blocked,game));assert.equal(restoreRun(blocked,levels),null);
  const store=storage();store.setItem(progressKey,JSON.stringify({[levels[16].key]:true,[levels[29].key]:true}));
  assert.deepEqual(readProgress(store,levels),{[levels[16].key]:true,[levels[29].key]:true});
});
test('stage identity, not position, is used to resume and invalid moves never enter the history',()=>{
  const store=storage(),game=new GameSession(levels);game.start(16);game.play([0,0,0]);
  assert.deepEqual(game.history,[]);saveRun(store,game);
  const reordered=[...levels].reverse();const restored=restoreRun(store,reordered);
  assert.equal(restored.level.key,levels[16].key);
  assert.deepEqual(restored.board,game.board);
});


test('reset removes current, legacy and active progress without touching preferences or other data',()=>{
  const store=storage(),game=new GameSession(levels);game.start(8);game.play([0,1,2]);
  saveRun(store,game);saveProgress(store,{[levels[0].key]:true});
  store.setItem('sequencepang2-v1',JSON.stringify({0:true,1:true}));
  store.setItem('sequencepang2-sound','on');store.setItem('another-game','keep');
  assert.equal(resetProgress(store),true);
  assert.deepEqual(readProgress(store,levels),{});
  assert.equal(restoreRun(store,levels),null);
  assert.equal(nextStageIndex(levels,readProgress(store,levels)),0);
  assert.equal(store.getItem('sequencepang2-v1'),null);
  assert.equal(store.getItem('sequencepang2-sound'),'on');
  assert.equal(store.getItem('another-game'),'keep');
  assert.equal(resetProgress(store),true);
});
test('reset reports unavailable storage instead of claiming success',()=>{
  const blocked={setItem:()=>{throw Error('blocked')},removeItem:()=>{throw Error('blocked')}};
  assert.equal(resetProgress(blocked),false);
});
