import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { paths, remove, stars, valid } from '../dist/engine.js';
import { analyze } from './generate-campaign.mjs';

// [rows, columns, optional bottom-aligned column heights], ten stages per pack.
const shapes = [
  [[3,4],[3,4],[4,3],[3,4],[4,3],[4,4],[3,5],[5,3],[4,5],[4,5]],
  [[3,4],[4,3],[5,3],[4,3],[5,3],[3,4],[4,4],[4,5],[5,3],[4,5]],
  [[4,4,[3,4,4,4]],[4,4,[4,4,4,3]],[4,4,[2,3,4,4]],[4,4,[4,4,3,2]],[5,4,[2,3,4,5]],[3,4],[4,4,[2,3,4,4]],[4,5,[2,3,3,4,4]],[5,4,[5,4,3,2]],[4,5,[2,3,4,4,4]]],
  [[4,4],[3,4],[4,4,[2,3,4,4]],[4,5],[5,4,[5,4,3,2]],[4,4],[4,3],[4,5,[2,3,3,4,4]],[4,4],[4,5,[4,4,3,3,2]]],
  [[3,4],[4,4,[3,3,4,4]],[4,5],[5,4,[2,3,4,5]],[5,5],[3,4],[4,5,[2,3,4,4,4]],[5,4],[5,5,[3,3,4,5,5]],[4,5]],
];
const titles = [
  '넓어진 별밭','가로로 한 걸음','세로로 한 걸음','넓고 짧은 길','좁고 깊은 길','익숙한 쉼표','긴 가로의 낙하','좁은 열의 낙하','다른 높이의 별','직사각형 별자리',
  '다시 만난 가로','다시 만난 세로','좁은 열의 순서','아래를 먼저','별보다 먼저','짧은 숨 고르기','정사각형으로 돌아와','넓어진 갈림길','기다리는 세로','열의 높이 맞추기',
  '첫 번째 계단','반대쪽 계단','짧은 열 긴 열','거꾸로 선 계단','계단 아래의 준비','반듯한 쉼표','경계에서 꺾기','이어지는 층','한 칸 낮은 별','계단의 별자리',
  '반듯한 출발','가로의 기억','계단의 기억','다시 넓게','낙하의 갈림길','익숙한 작은 판','먼저 지울 수열','경계 너머 다음 수','순서를 바꾸면','모양들의 합주',
  '처음 배운 가로','계단 다시 읽기','곱과 차의 길','빈손으로 한 걸음','작은 고비','마지막 쉼표','두 번 내다보기','낙하와 전환','정상 앞의 계단','백 번째 별자리',
];
const setupIds = new Set([59,65,69,75,79,85,89,94,99,100]);
const mixedIds = new Set([55,60,68,70,78,80,84,88,90,93,95,97,98,100]);
export const shapeProfiles = shapes.flatMap((pack,batch) => pack.map(([rows,cols,heights],offset) => {
  const id=51+batch*10+offset, relief=offset===5, intro=offset<2;
  const minimumMoves=intro||relief?2:offset===9||id>=95&& !relief?4:3;
  return { id,rows,cols,heights,title:titles[id-51],minimumMoves,
    moves:minimumMoves+(intro||relief?1:0),
    pacing:relief?'relief':intro?'intro':offset===9?'finale':offset>=6?'challenge':'practice',
    setup:setupIds.has(id),mixed:mixedIds.has(id),
    gravity:intro||relief?1:minimumMoves===4?2:1,
    maxWins:intro||relief?8:offset===9?2:4,
    ratio:intro||relief?1:offset===9?0.3:0.5 };
}));

export async function generateShapes() {
  const output=[], signatures=new Set();
  for(const p of shapeProfiles) {
    let seed=20260922+p.id*100003;
    const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/2**32);
    const pick=xs=>xs[Math.floor(random()*xs.length)];
    const mask=Array.from({length:p.rows*p.cols},(_,i)=>!p.heights||Math.floor(i/p.cols)>=p.rows-p.heights[i%p.cols]);
    let accepted;
    for(let attempt=0;attempt<150000&&!accepted;attempt++) {
      const board=mask.map((on,i)=>on?{v:1+Math.floor(random()*9),star:false,id:String(i)}:null);
      let b=board;const removed=[];
      for(let step=0;step<p.minimumMoves;step++) {
        let options;try{options=paths(b,p.cols).filter(path=>path.length<=4);}catch{break;}
        if(!options.length)break;
        const path=pick(options);removed.push(path.map(i=>b[i].id));b=remove(b,path,p.cols);
      }
      if(removed.length!==p.minimumMoves)continue;
      for(let step=p.setup?1:0;step<removed.length;step++) {
        for(const id of removed[step].filter(()=>random()<0.65))board[+id].star=true;
        board[+pick(removed[step])].star=true;
      }
      if(stars(board)<(p.minimumMoves===2?3:4))continue;
      const result=analyze(board,p.cols,p.minimumMoves,6000);
      if(!result?.winning.length||result.winning.length>p.maxWins||result.winning.length/result.openings>p.ratio)continue;
      if(p.setup&&result.winning.some(w=>w.path.some(i=>board[i].star)))continue;
      let gravitySteps=0,arithmetic=false,geometric=false,boundarySteps=0;
      const solution=result.winning[0].solution;b=board;
      for(const path of solution) {
        if(!valid(board,path.map(i=>+b[i].id),p.cols))gravitySteps++;
        const vs=path.map(i=>b[i].v);
        arithmetic ||= vs[1]!==vs[0]&&vs[2]-vs[1]===vs[1]-vs[0];
        geometric ||= vs[1]!==vs[0]&&vs[2]*vs[0]===vs[1]*vs[1];
        // Use an edge beside the staircase and cross columns of different heights.
        if(p.heights&&path.some(i=>Math.floor(i/p.cols)===p.rows-p.heights[i%p.cols])&&new Set(path.map(i=>p.heights[i%p.cols])).size>1)boundarySteps++;
        b=remove(b,path,p.cols);
      }
      if(gravitySteps<p.gravity||p.mixed&&!(arithmetic&&geometric)||p.heights&&!boundarySteps)continue;
      const signature=JSON.stringify(board.map(c=>c?[c.v,c.star]:null));
      if(signatures.has(signature))continue;signatures.add(signature);
      accepted={id:p.id,rows:p.rows,cols:p.cols,...(p.heights?{mask}:{}),moves:p.moves,minimumMoves:p.minimumMoves,
        title:p.title,lesson:p.id===51?'가로로 넓어져도 연결 방법은 같아요.':p.id===71?'빠진 칸은 건너뛸 수 없어요. 숫자는 같은 열에서 아래로 내려와요.':undefined,
        objective:p.setup?'setup':p.mixed?'mixed':'order',pacing:p.pacing,
        designIntent:p.setup?'별 없는 수열을 먼저 지워 다음 연결을 만든다.':p.heights?'길이가 다른 열의 계단 경계에서 연결하고 낙하를 이용한다.':p.mixed?'낙하로 새 이웃을 만든 뒤 등차와 등비를 전환한다.':'판의 폭과 열의 높이에 맞춰 다음 연결을 준비한다.',
        values:board.map(c=>c?.v??null),stars:board.flatMap((c,i)=>c?.star?[i]:[]),solution,
        legalFirstMoves:result.openings,winningFirstMoves:result.winning.length,gravitySteps,boundarySteps,mixedSequences:arithmetic&&geometric};
      console.log(`Stage ${p.id}: ${p.rows}x${p.cols}${p.heights?' stairs':''}, ${p.minimumMoves}/${p.moves} moves, ${result.winning.length}/${result.openings} openings; candidate ${attempt}`);
    }
    if(!accepted)throw Error(`No verified candidate for ${p.id}; committed packs unchanged`);
    output.push(accepted);
  }
  const root=new URL('../content/',import.meta.url);await mkdir(root,{recursive:true});
  for(let batch=0;batch<5;batch++) {
    const from=51+batch*10,to=from+9;
    await writeFile(new URL(`stages-${from}-${to}.json`,root),JSON.stringify(output.slice(batch*10,batch*10+10),null,2)+'\n');
  }
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await generateShapes();
