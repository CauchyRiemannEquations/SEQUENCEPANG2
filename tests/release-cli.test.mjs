import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, cp, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

test('release CLI rejects skipped packs without writes and releases exactly ten at a time in a disposable checkout',async()=>{
  const root=fileURLToPath(new URL('../',import.meta.url));
  await mkdir(join(root,'work'),{recursive:true});
  const scratch=await mkdtemp(join(root,'work','release-check-'));
  for(const name of ['dist','content','scripts','package.json','vercel.json'])await cp(join(root,name),join(scratch,name),{recursive:true});
  const run=(...args)=>spawnSync(process.execPath,args,{cwd:scratch,encoding:'utf8'});
  const initial=JSON.parse(await readFile(join(scratch,'content/release.json'))).publishedThrough;
  const before=await readFile(join(scratch,'dist/published-shapes.js'),'utf8');
  assert.notEqual(run('scripts/release-stages.mjs','--to',String(initial+20)).status,0);
  assert.equal(await readFile(join(scratch,'dist/published-shapes.js'),'utf8'),before);
  assert.equal(JSON.parse(await readFile(join(scratch,'content/release.json'))).publishedThrough,initial);
  for(let through=initial+10;through<=100;through+=10){
    const result=run('scripts/release-stages.mjs','--to',String(through));
    assert.equal(result.status,0,result.stderr);
    assert.equal(run('scripts/release-stages.mjs','--check').status,0);
    assert.equal(run('scripts/build-sw.mjs','--check').status,0);
    const check=run('--input-type=module','-e',`import assert from 'node:assert/strict';import {levels} from './dist/levels.js';import {hintData} from './dist/hint-data.js';import {firstHint} from './dist/hints.js';assert.equal(levels.length,${through});assert.equal(Object.keys(hintData).length,${through}-10);assert.ok(levels.slice(10).every(l=>firstHint(l)));`);
    assert.equal(check.status,0,check.stderr);
    const payload=await readFile(join(scratch,'dist/published-shapes.js'),'utf8');
    if(through<100)assert.ok(!payload.includes(`"id": ${through+1},`));
  }
  assert.equal(JSON.parse(await readFile(join(root,'content/release.json'))).publishedThrough,initial,'verification never releases the real checkout');
});
