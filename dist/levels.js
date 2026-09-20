import { campaignData } from './campaign-data.js';
import { expansionData } from './expansion-data.js';

const specs = [
  [4,2,[1,2,3,8, 7,9,5,2, 2,4,6,9, 9,5,8,7],[0,2,8,10]],
  [4,2,[2,5,9,7, 8,4,2,1, 3,6,9,5, 7,2,5,8],[4,7,8,10]],
];
export const chapters = [
  { id: 'first', name: '첫 번째 별', subtitle: '연결의 즐거움을 알아가요', symbol: '✦' },
  { id: 'grove', name: '망고 숲', subtitle: '나만의 수열을 찾아요', symbol: '❋' },
  { id: 'orbit', name: '별의 궤도', subtitle: '다음 움직임을 생각해요', symbol: '✧' },
  { id: 'weave', name: '별의 갈림길', subtitle: '남겨 둔 숫자를 다시 만나요', symbol: '✶' },
  { id: 'summit', name: '별의 정상', subtitle: '마지막 연결까지 내다봐요', symbol: '✷' },
];

const tutorials = [
  [3, 1, [7,9,5, 8,5,9, 1,2,3], [6,8], '첫 연결', '이웃한 숫자 3개 이상을 누른 채 이어요. 같은 간격의 수열로 별을 모두 모으세요.'],
  [3, 1, [9,1,8, 5,9,1, 2,4,6], [6,8], '같은 간격', '숫자가 2씩, 3씩 커져도 같은 간격이면 연결할 수 있어요.'],
  [3, 1, [1,7,5, 8,2,7, 9,6,3], [6,8], '거꾸로도 좋아', '같은 간격으로 작아지는 수열도 연결돼요.'],
  [3, 1, [1,9,7, 8,2,9, 5,7,3], [0,4,8], '비스듬한 길', '모서리가 맞닿은 대각선 타일도 이웃이에요.'],
  [3, 1, [8,2,9, 1,3,8, 9,7,5], [3,4,8], '꺾이는 길', '이어지는 숫자가 수열이면 중간에 방향을 꺾어도 괜찮아요.'],
  [3, 1, [9,3,7, 5,9,1, 2,4,8], [6,8], '곱하는 수열', '같은 수를 계속 곱하는 등비수열도 연결할 수 있어요.'],
  [3, 1, [1,8,6, 9,2,7, 3,3,3], [6,8], '같아도 수열', '같은 숫자 세 개도 간격이 0인 수열이에요.'],
  [4, 1, [7,9,5,8, 9,5,8,6, 6,8,9,7, 1,2,3,4], [12,15], '길게 한 번', '3개보다 길게 이어도 한 번! 남은 횟수 안에 별을 모두 모으세요.'],
];

const make = (n, moves, values, ss, key, extra) => ({ n, moves, key, ...extra,
  board: values.map((v, j) => v === null ? null : ({ v, star: ss.includes(j), id: `${key}-${j}` })) });
const originalNames = ['두 번의 연결', '새로운 간격'];
const campaignNames = ['갈림길', '남겨 둔 숫자', '연결의 순서', '두 가지 수열', '한 수 먼저', '숲의 마지막 길', '연쇄 낙하', '엇갈린 수열', '남겨야 할 별', '숲의 미로', '새로운 궤도', '교차하는 길', '별의 자리', '네 번의 생각', '다섯 걸음', '멀리 있는 별', '빈자리의 의미', '이어지는 별', '마지막 갈림길', '별자리 완성'];
const expansionNames = ['다시 한 걸음', '두 가지 간격', '빈손의 시작', '겹친 궤도', '첫 번째 고개', '작은 쉼표', '곱과 차', '기다리는 별', '엇갈린 낙하', '두 번째 고개', '작은 별밭', '바뀌는 간격', '보이지 않는 길', '다섯 번의 선택', '세 번째 고개', '잠깐의 여유', '맞물린 수열', '마지막 준비', '정상으로', '쉰 번째 별'];
export const levels = [
  ...tutorials.map(([n,m,v,s,title,lesson], i) => make(n,m,v,s,`intro-${i+1}`, { chapter: 'first', title, lesson, objective: 'tutorial' })),
  ...specs.map(([n,m,v,s], i) => make(n,m,v,s,`original-${i+1}`, { chapter: 'first', title: originalNames[i], legacyIndex: i, objective: 'practice', ...(i === 0 ? { lesson: '타일을 지우면 위의 숫자가 내려와요. 새 타일은 생기지 않아요.' } : {}) })),
  ...campaignData.map((l,i) => make(l.n,l.moves,l.values,l.stars,`complex-v3-${i+11}`, { chapter: i < 10 ? 'grove' : 'orbit', title: campaignNames[i], objective: l.objective })),
  ...expansionData.map((l,i) => make(l.n,l.moves,l.values,l.stars,`expansion-v1-${i+31}`, { chapter: i < 10 ? 'weave' : 'summit', title: expansionNames[i], objective: l.objective })),
].map((level, i) => ({ ...level, id: i + 1 }));
