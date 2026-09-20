import { writeFile } from 'node:fs/promises';
import { paths, remove, stars, valid } from '../dist/engine.js';
import { analyze } from './generate-campaign.mjs';

// Four five-stage waves: relief, variation, discovery, challenge, finale.
export const profiles = [
  { pacing:'relief', n:4, moves:3, maxWins:5, ratio:0.5, gravity:1 },
  { pacing:'variation', n:4, moves:4, maxWins:3, ratio:0.35, gravity:2 },
  { pacing:'discovery', n:5, moves:4, maxWins:3, ratio:0.25, gravity:2 },
  { pacing:'challenge', n:5, moves:5, maxWins:2, ratio:0.2, gravity:2 },
  { pacing:'finale', n:5, moves:5, maxWins:1, ratio:0.1, gravity:3 },
];
if (process.argv[1] === new URL(import.meta.url).pathname) {
  let seed=20260921;
  const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/2**32);
  const pick=xs=>xs[Math.floor(random()*xs.length)];
  const output=[];
  for(let attempt=0;output.length<20 && attempt<100000;attempt++) {
    const index=output.length, profile=profiles[index%5], {n,moves}=profile;
    const setup=index%5===2;
    const board=Array.from({length:n*n},(_,i)=>({v:1+Math.floor(random()*9),star:false,id:String(i)}));
    let b=board; const removed=[];
    for(let step=0;step<moves;step++) {
      let options; try {options=paths(b,n).filter(p=>p.length<=5);}catch{break;}
      if(!options.length)break;
      const path=pick(options);removed.push(path.map(i=>b[i].id));b=remove(b,path,n);
    }
    if(removed.length!==moves)continue;
    for(let step=setup?1:0;step<moves;step++) {
      for(const id of removed[step].filter(()=>random()<0.65))board[+id].star=true;
      board[+pick(removed[step])].star=true;
    }
    if(stars(board)<(moves===3?4:6))continue;
    const result=analyze(board,n,moves,5000);
    if(!result?.winning.length || result.winning.length>profile.maxWins || result.winning.length/result.openings>profile.ratio)continue;
    if(index%5===0 && result.winning.length<2)continue;
    if(setup && result.winning.some(w=>w.path.some(i=>board[i].star)))continue;
    const solution=result.winning[0].solution;
    let gravitySteps=0, geometric=false, arithmetic=false;b=board;
    for(const path of solution) {
      if(!valid(board,path.map(i=>+b[i].id),n))gravitySteps++;
      const vs=path.map(i=>b[i].v);
      if(vs[1]!==vs[0] && vs[2]*vs[0]===vs[1]*vs[1])geometric=true;
      if(vs[1]!==vs[0] && vs[2]-vs[1]===vs[1]-vs[0])arithmetic=true;
      b=remove(b,path,n);
    }
    if(gravitySteps<profile.gravity)continue;
    if(index%5===1 && !(geometric && arithmetic))continue;
    output.push({n,moves,values:board.map(c=>c.v),stars:board.flatMap((c,i)=>c.star?[i]:[]),objective:setup?'setup':'order',pacing:profile.pacing,solution,winningFirstMoves:result.winning.length,legalFirstMoves:result.openings,gravitySteps,mixedSequences:geometric&&arithmetic});
    console.log(`Stage ${index+31}: ${profile.pacing}, ${n}x${n}, ${moves} moves, ${result.winning.length}/${result.openings} openings, gravity ${gravitySteps}; candidate ${attempt}`);
  }
  if(output.length!==20)throw Error('Not enough verified candidates; existing data unchanged');
  await writeFile(new URL('../dist/expansion-data.js',import.meta.url),`// Fixed puzzles 31–50. Regenerate with npm run generate:expansion.\nexport const expansionData = ${JSON.stringify(output,null,2)};\n`);
}
