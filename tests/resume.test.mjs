import test from 'node:test';
import assert from 'node:assert/strict';
import { GameSession } from '../dist/session.js';
import { levels } from '../dist/levels.js';
import { solveDetailed } from '../dist/engine.js';
import { saveRun, restoreRun, runKey, readProgress, saveProgress, progressKey, nextStageIndex, resetProgress, campaignComplete } from '../dist/progress.js';
const storage=()=>{const data=new Map();return {getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};};

test('every stage restarts with its original board and full moves after leaving mid-puzzle',()=>{
  for(const level of levels){
    const store=storage(),game=new GameSession(levels);game.start(level.id-1);
    saveRun(store,game);
    assert.deepEqual(restoreRun(store,levels).board,game.board);
    const plan=solveDetailed(game.board,level.n,game.moves,20000000).solution;
    for(const path of plan.slice(0,-1)){
      game.play(path);saveRun(store,game);const restored=restoreRun(store,levels);
      assert.deepEqual(restored.board,level.board);assert.equal(restored.moves,level.moves);
      assert.deepEqual(restored.history,[]);assert.equal(restored.index,game.index);
      assert.deepEqual(JSON.parse(store.getItem(runKey)),{version:2,key:level.key});
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
test('corrupt, removed or unsupported stage records cannot create a broken game',()=>{
  for(const saved of ['{','null',JSON.stringify({version:8,key:levels[0].key}),JSON.stringify({version:2,key:'missing'}),JSON.stringify({version:2})]){
    const store=storage();store.setItem(runKey,saved);assert.equal(restoreRun(store,levels),null);
  }
});
test('old partial-run saves migrate to the same fresh stage and discard move histories',()=>{
  for(const history of [[[0,1,2]],[[0,0,0]],'corrupt']) {
    const store=storage();store.setItem(runKey,JSON.stringify({version:1,key:levels[8].key,history}));
    saveProgress(store,{[levels[0].key]:true});
    const restored=restoreRun(store,levels);
    assert.equal(restored.index,8);assert.deepEqual(restored.board,levels[8].board);
    assert.equal(restored.moves,levels[8].moves);assert.deepEqual(restored.history,[]);
    assert.deepEqual(JSON.parse(store.getItem(runKey)),{version:2,key:levels[8].key});
    assert.deepEqual(readProgress(store,levels),{[levels[0].key]:true});
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


test('campaign completion waits for every stage and reopens when new stages are released',()=>{
  const progress=Object.fromEntries(levels.slice(0,-1).map(level=>[level.key,true]));
  assert.equal(campaignComplete(levels,progress),false);
  progress[levels.at(-1).key]=true;
  assert.equal(campaignComplete(levels,progress),true);
  const expanded=[...levels,{key:'future-stage-51'}];
  assert.equal(campaignComplete(expanded,progress),false);
  assert.equal(nextStageIndex(expanded,progress),levels.length);
  assert.equal(campaignComplete(levels,{}),false);
  assert.equal(campaignComplete([],{}),false);
});
