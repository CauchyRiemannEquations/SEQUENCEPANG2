import test from 'node:test';
import assert from 'node:assert/strict';
import {AdaptiveHints,hintOffer} from '../dist/jev-adaptive.js';
import {MangoHints,hintKey,puzzleSignature} from '../dist/hints.js';
import {levels} from '../dist/levels.js';
import {resetProgress} from '../dist/progress.js';
const decision=(action='GLOW')=>({recommendation:action,confidence:.85,needsHint:.9,stuck:.8,probabilities:{NONE:action==='NONE'?.9:.05,GLOW:action==='GLOW'?.9:.05,GESTURE:action==='GESTURE'?.9:.05}});
const memory=()=>{const m=new Map();return{getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)};};
function setup(fetcher){
 let time=0,online=true,token=1;
 const store=memory(),hints=new MangoHints(store,levels),level=levels[17];
 const state={stage:18,status:'playing',attempts:1,invalidSequences:0,repeatedSequences:0,activeSeconds:10,secondsSinceAction:10};
 const a=new AdaptiveHints({fetcher:fetcher|| (async()=>({ok:true,json:async()=>decision()})),now:()=>time,online:()=>online,
   capture:()=>({state:{...state},key:level.key,level,token,tier:hints.tier(level)}),
   isCurrent:s=>s.token===token,grant:(l,o)=>hints.grant(l,o.tier,o.ripeness)});
 a.ready=true;
 return{a,hints,store,state,level,advance:()=>time+=45001,invalidate:()=>token++,offline:()=>online=false};
}
test('confident recommendations unlock optional hints; uncertain ones only ripen the mango',()=>{
 assert.deepEqual(hintOffer(decision()),{tier:1,ripeness:3});
 assert.deepEqual(hintOffer(decision('GESTURE')),{tier:2,ripeness:3});
 assert.deepEqual(hintOffer({...decision(),confidence:.2}),{tier:0,ripeness:2});
 assert.deepEqual(hintOffer({...decision('NONE'),stuck:.1}),{tier:0,ripeness:0});
 for(const bad of [null,{}, {...decision(),confidence:NaN},{...decision(),probabilities:{NONE:1,GLOW:1,GESTURE:1}}]) assert.deepEqual(hintOffer(bad),{tier:0,ripeness:0});
});
test('AI unlocks before three losses, survives reload, and later failures do not relock it',async()=>{
 const t=setup();await t.a.consider('failed');
 assert.equal(t.hints.failures(t.level),0);assert.equal(t.hints.tier(t.level),1);
 const restored=new MangoHints(t.store,levels);assert.equal(restored.tier(t.level),1);assert.equal(restored.ripeness(t.level),3);
 restored.recordFailure({level:t.level,status:'failed',history:[[0,1,2]]});
 assert.equal(restored.tier(t.level),1);assert.equal(restored.failures(t.level),1);
 restored.grant(t.level,0,1);assert.equal(restored.ripeness(t.level),3);
 assert.equal(resetProgress(t.store),true);assert.equal(t.store.getItem(hintKey),null);
 assert.equal(new MangoHints(t.store,levels).tier(t.level),0);
});
test('ripeness never decreases and changed puzzle signatures cannot restore AI grants',()=>{
 const t=setup();t.hints.grant(t.level,0,2);t.hints.grant(t.level,0,1);
 assert.equal(t.hints.ripeness(t.level),2);assert.equal(t.hints.tier(t.level),0);
 t.hints.grant(t.level,2,3);t.hints.grant(t.level,1,1);assert.equal(t.hints.tier(t.level),2);
 const stale={...t.level,moves:t.level.moves+1};assert.equal(new MangoHints(t.store,[stale]).tier(stale),0);
});
test('ordinary thinking, short attempt counts and offline play never call the model',async()=>{
 let calls=0;const t=setup(async()=>{calls++;return{ok:true,json:async()=>decision()};});
 for(const reason of ['thinking','invalid','repeat','retry'])await t.a.consider(reason);
 assert.equal(calls,0);t.state.invalidSequences=2;await t.a.consider('invalid');assert.equal(calls,0);
 t.offline();t.state.invalidSequences=3;await t.a.consider('invalid');assert.equal(calls,0);
});
test('repeated invalid connections can unlock without losing the stage; cooldown limits calls',async()=>{
 let calls=0;const t=setup(async()=>{calls++;return{ok:true,json:async()=>decision()};});
 t.state.invalidSequences=3;await t.a.consider('invalid');assert.equal(t.hints.tier(t.level),1);assert.equal(calls,1);
 t.state.invalidSequences=6;await t.a.consider('invalid');assert.equal(calls,1);
 t.advance();await t.a.consider('invalid');assert.equal(calls,2);
 for(let i=0;i<5;i++){t.advance();await t.a.consider('failed');}assert.equal(calls,4);
});
test('stale or reset responses cannot unlock a new board and overlapping requests are suppressed',async()=>{
 let resolve,calls=0;const t=setup(()=>{calls++;return new Promise(r=>resolve=r);});
 const first=t.a.consider('failed');t.advance();await t.a.consider('failed');assert.equal(calls,1);
 t.invalidate();resolve({ok:true,json:async()=>decision('GESTURE')});await first;assert.equal(t.hints.tier(t.level),0);
 t.advance();const second=t.a.consider('failed');t.a.reset();resolve({ok:true,json:async()=>decision()});await second;assert.equal(t.hints.tier(t.level),0);
});
test('bad HTTP, timeouts, missing key and bad data retain deterministic fallback',async()=>{
 const fetchers=[async()=>{throw new DOMException('timeout','TimeoutError');},async()=>({ok:false,json:async()=>({error:'upstream_auth'})}),async()=>({ok:true,json:async()=>({})})];
 for(const fetcher of fetchers){const t=setup(fetcher);await t.a.consider('failed');assert.equal(t.hints.tier(t.level),0);
   t.hints.counts[t.level.key]={signature:puzzleSignature(t.level),failures:3};assert.equal(t.hints.tier(t.level),1);
   t.hints.counts[t.level.key].failures=5;assert.equal(t.hints.tier(t.level),2);
 }
 const t=setup(async()=>({ok:false,json:async()=>({error:'missing_key'})}));await t.a.connect();assert.equal(t.a.ready,false);
});
