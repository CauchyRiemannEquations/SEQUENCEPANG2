export function kind(values){if(values.length<3)return null;const d=values[1]-values[0];if(values.every((v,i)=>i<1||v-values[i-1]===d))return '등차수열';if(values.every((v,i)=>i<2||v*values[i-2]===values[i-1]*values[i-1]))return '등비수열';return null;}
export function adjacent(a,b,n){return a!==b&&Math.abs(a%n-b%n)<=1&&Math.abs(Math.floor(a/n)-Math.floor(b/n))<=1;}
export function valid(board,path,n){return path.length>=3&&new Set(path).size===path.length&&path.every((p,i)=>Number.isInteger(p)&&!!board[p]&&(!i||adjacent(p,path[i-1],n)))&&!!kind(path.map(p=>board[p].v));}
// n is the column count. Shaped boards have bottom-aligned contiguous columns:
// gravity cannot fill their missing top cells because tiles are never spawned.
export function remove(board,path,n){const rows=board.length/n;const next=board.map(c=>c?{...c}:null);for(const p of path)next[p]=null;for(let c=0;c<n;c++){const col=[];for(let r=0;r<rows;r++)if(next[r*n+c])col.push(next[r*n+c]);for(let r=rows-1;r>=0;r--)next[r*n+c]=col.pop()||null;}return next;}
export const stars=board=>board.filter(c=>c?.star).length;
const exhausted = Symbol('search limit');
function spend(budget) { if (--budget.left < 0) throw exhausted; }

// Reverse paths and paths removing the same cells produce identical next boards.
export function paths(board, n, budget = { left: 200000 }) {
  const out = [], seen = new Set();
  const neighbors = board.map((cell, i) => cell ? board.flatMap((c, j) => c && adjacent(i, j, n) ? [j] : []) : []);
  function walk(path) {
    spend(budget);
    if (path.length >= 3) {
      if (!kind(path.map(i => board[i].v))) return;
      const key = [...path].sort((a, b) => a - b).join(',');
      if (!seen.has(key)) { seen.add(key); out.push(path); }
    }
    for (const j of neighbors[path.at(-1)]) if (!path.includes(j)) walk([...path, j]);
  }
  for (let i = 0; i < board.length; i++) if (board[i]) walk([i]);
  return out;
}

// An interrupted search must never be reported as proof that a puzzle is unsolvable.
export function solveDetailed(board, n, moves, limit = 200000) {
  const budget = { left: limit }, memo = new Set();
  function search(board, moves) {
    if (!stars(board)) return [];
    if (!moves) return null;
    spend(budget);
    const key = board.map(c => c ? `${c.v}${c.star ? 's' : ''}` : '_').join(',') + ':' + moves;
    if (memo.has(key)) return null;
    memo.add(key);
    const options = paths(board, n, budget).sort((a, b) => b.filter(i => board[i].star).length - a.filter(i => board[i].star).length);
    for (const path of options) {
      const tail = search(remove(board, path, n), moves - 1);
      if (tail) return [path, ...tail];
    }
    return null;
  }
  try {
    const solution = search(board, moves);
    return { status: solution ? 'solved' : 'unsolvable', solution, visited: limit - budget.left };
  } catch (error) {
    if (error !== exhausted) throw error;
    return { status: 'budget-exceeded', solution: null, visited: limit };
  }
}
export function solve(board, n, moves) { return solveDetailed(board, n, moves).solution; }
