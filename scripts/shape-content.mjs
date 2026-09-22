import { readFile } from 'node:fs/promises';
import { shapeLevel } from '../dist/shape-level.js';
export const release = JSON.parse(await readFile(new URL('../content/release.json',import.meta.url)));
export const packs = await Promise.all([51,61,71,81,91].map(async from =>
  JSON.parse(await readFile(new URL(`../content/stages-${from}-${from+9}.json`,import.meta.url)))));
export const preparedShapes = packs.flat();
export const preparedLevels = preparedShapes.map(shapeLevel);
export const shapeChapters = ['가로와 세로','좁은 열의 길','계단의 별','모양의 합주','백 번째 별'].map((name,i)=>
  ({id:`shapes-${i}`,name,subtitle:'모양과 낙하로 이어지는 별',symbol:'✧'}));
export function publishedSource(through) {
  if(![50,60,70,80,90,100].includes(through))throw Error('Release must end at a ten-stage boundary from 50 to 100');
  const data=preparedShapes.filter(l=>l.id<=through).map(({solution,minimumMoves,legalFirstMoves,winningFirstMoves,gravitySteps,boundarySteps,mixedSequences,pacing,designIntent,...runtime})=>runtime);
  return '// Generated release payload. Unreleased packs are kept outside dist.\n'+
    `export const publishedThrough = ${through};\nexport const publishedShapes = ${JSON.stringify(data,null,2)};\nexport const publishedChapters = ${JSON.stringify(shapeChapters.slice(0,(through-50)/10),null,2)};\n`;
}
export function nextRelease(current,target) {
  if(!Number.isInteger(target)||target!==current+10||target>100||current<50||current%10)throw Error('Only the next ten-stage pack can be released; no skips or rollback');
  return target;
}
