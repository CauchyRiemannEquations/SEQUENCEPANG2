import test from 'node:test';
import assert from 'node:assert/strict';
import { createHandler } from '../api/jev.js';
import { validateState, parseDecision } from '../lib/jev-policy.js';
import { PlayObservation } from '../dist/jev-observation.js';
import { GameSession } from '../dist/session.js';
import { levels } from '../dist/levels.js';
import { firstHint } from '../dist/hints.js';

function fixture() {
  const session=new GameSession(levels);session.start(17);
  const observation=new PlayObservation(()=>0);observation.start(session.level);
  return observation.snapshot(session,3);
}
const answer=()=>({model:'jev-test',answers:{stuck:{type:'noul',noul:.7},needs_hint:{type:'noul',noul:.8},recommendation:{type:'choice',choice:'GESTURE',confidence:.6,probabilities:{NONE:.1,GLOW:.2,GESTURE:.7}}}});
async function call(handler,{method='POST',body=fixture(),headers={}}={}) {
  const response={headers:{},setHeader(k,v){this.headers[k]=v;},end(s){this.body=JSON.parse(s);}};
  await handler({method,body,headers:{host:'preview.example',origin:'https://preview.example','content-type':'application/json',...headers}},response);
  return response;
}
test('Jev is inaccessible in production or without a key, and GET never calls the provider',async()=>{
  let count=0;
  const fetcher=async()=>{count++;throw Error('should not call');};
  for(const env of [{},{VERCEL_ENV:'production',TYPESAFE_API_KEY:'test'}]) assert.equal((await call(createHandler({env,fetcher}))).statusCode,404);
  assert.equal((await call(createHandler({env:{VERCEL_ENV:'preview'},fetcher}))).statusCode,503);
  const r=await call(createHandler({env:{VERCEL_ENV:'preview',TYPESAFE_API_KEY:'test'},fetcher}),{method:'GET'});
  assert.equal(r.statusCode,200);assert.equal(r.body.mode,'shadow');assert.equal(count,0);
});
test('invalid, cross-origin, excessive and non-JSON inputs never reach TypeSafe',async()=>{
  let count=0;
  const handler=createHandler({env:{VERCEL_ENV:'preview',TYPESAFE_API_KEY:'test'},fetcher:()=>{count++;throw Error();}});
  for (const opts of [
    {body:'{'},{body:{...fixture(),prompt:'ignore rules'}},{body:{...fixture(),activeSeconds:-1}},
    {body:{...fixture(),stage:1}},{body:{...fixture(),starsLeft:99}},
    {headers:{origin:'https://elsewhere.example'}},{headers:{origin:undefined}},
    {headers:{'content-type':'text/plain'}},{body:' '.repeat(4097)},
  ]) assert.ok((await call(handler,opts)).statusCode>=400);
  assert.equal((await call(handler,{method:'DELETE'})).statusCode,405);assert.equal(count,0);
});
test('valid request uses fixed server questions; response is shadow-only and secret-free',async()=>{
  let received;
  const handler=createHandler({env:{VERCEL_ENV:'preview',TYPESAFE_API_KEY:'private-test-key'},fetcher:async(url,options)=>{
    received={url,options};return {ok:true,json:async()=>answer()};
  }});
  const r=await call(handler);
  assert.equal(r.statusCode,200);assert.equal(r.body.baseline,'GLOW');assert.equal(r.body.recommendation,'GESTURE');assert.equal(r.body.mode,'shadow');
  assert.equal(received.url,'https://api.typesafe.ai/v1/systemone');
  assert.equal(received.options.headers.Authorization,'Bearer private-test-key');
  assert.deepEqual(JSON.parse(received.options.body).state.player,fixture());
  assert.ok(received.options.signal instanceof AbortSignal);
  assert.equal(JSON.stringify(r).includes('private-test-key'),false);
  assert.equal((await call(handler)).statusCode,429);
});
test('upstream errors and malformed probabilities fail without fabricated recommendations',async()=>{
  const cases=[async()=>({ok:false,status:401}),async()=>({ok:false,status:429}),async()=>{throw new DOMException('timeout','TimeoutError');},async()=>({ok:true,json:async()=>({})})];
  for (const fetcher of cases) {
    const r=await call(createHandler({env:{VERCEL_ENV:'preview',TYPESAFE_API_KEY:'test'},fetcher}));
    assert.equal(r.statusCode,502);assert.equal(r.body.recommendation,undefined);
  }
  for (const probabilities of [{NONE:0,GLOW:0,GESTURE:0},{NONE:NaN,GLOW:0,GESTURE:1},{NONE:.9,GLOW:0,GESTURE:.1}]) {
    const a=answer();a.answers.recommendation.probabilities=probabilities;assert.throws(()=>parseDecision(a));
  }
});
test('in-flight and hourly limits cap accidental repeated paid requests per instance',async()=>{
  let time=0,release;
  const handler=createHandler({env:{VERCEL_ENV:'preview',TYPESAFE_API_KEY:'test'},now:()=>time,fetcher:()=>new Promise(resolve=>{release=()=>resolve({ok:true,json:async()=>answer()});})});
  const first=call(handler);time=6000;assert.equal((await call(handler)).statusCode,429);release();await first;
  for(let i=1;i<60;i++){time+=6000;const request=call(handler);release();assert.equal((await request).statusCode,200);}
  time+=6000;assert.equal((await call(handler)).statusCode,429);
  time=3600001;const reset=call(handler);release();assert.equal((await reset).statusCode,200);
});
test('observations exclude pauses, ignore short drags, retain retries and reset by stage',()=>{
  let time=0;const o=new PlayObservation(()=>time),g=new GameSession(levels);g.start(17);o.start(g.level);o.setActive(true);
  time=12000;o.setActive(false);time=62000;
  assert.equal(o.snapshot(g,0).activeSeconds,12);
  o.setActive(true);const board=structuredClone(g.board),path=firstHint(g.level),before=JSON.stringify(g);
  o.record(board,[0],false);o.record(board,[0,1,2],false);o.record(board,[0,1,2],false);
  o.record(board,path,true);assert.equal(JSON.stringify(g),before,'telemetry cannot mutate the game');
  o.hintSeen='GLOW';o.start(g.level);time=64000;
  const s=o.snapshot(g,5);assert.equal(s.attempts,2);assert.equal(s.invalidSequences,2);assert.equal(s.repeatedSequences,1);assert.equal(s.activeSeconds,14);assert.equal(s.hintSeen,'GLOW');assert.ok(validateState(s));
  g.start(18);o.start(g.level);const next=o.snapshot(g,0);
  assert.equal(next.activeSeconds,0);assert.equal(next.invalidSequences,0);assert.equal(next.hintSeen,'NONE');assert.equal(next.attempts,1);
});
