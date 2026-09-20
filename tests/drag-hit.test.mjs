import test from 'node:test';
import assert from 'node:assert/strict';
import { dragTargets, dragHits } from '../dist/drag-hit.js';
import { adjacent } from '../dist/engine.js';

const board = Array(9).fill({ v: 1 });
const targets = dragTargets({ left: 0, top: 0, width: 292, height: 292 }, 3, 8, 8, board);
const center = i => ({ x: targets[i].x, y: targets[i].y });
function trace(points, first, cells = targets, n = 3) {
  const selected = [first];
  for (let step = 1; step < points.length; step++) {
    for (const i of dragHits(points[step - 1], points[step], cells)) {
      if (selected.length > 1 && selected.at(-2) === i) selected.pop();
      else if (!selected.includes(i) && adjacent(selected.at(-1), i, n)) selected.push(i);
    }
  }
  return selected;
}

test('diagonal drag ignores a brief incursion into the side tile corner', () => {
  // (105,85) lies inside tile 1: old elementFromPoint selected it accidentally.
  assert.deepEqual(trace([center(0), { x: 105, y: 85 }, center(4), { x: 205, y: 185 }, center(8)], 0), [0, 4, 8]);
  assert.deepEqual(trace([center(0), { x: 85, y: 105 }, center(4), center(8)], 0), [0, 4, 8]);
});
test('fast strokes retain the middle tile in every diagonal direction', () => {
  for (const [a, b, path] of [[0,8,[0,4,8]], [8,0,[8,4,0]], [2,6,[2,4,6]], [6,2,[6,4,2]]]) {
    assert.deepEqual(trace([center(a), center(b)], a), path);
  }
});
test('horizontal, vertical and bent connections still follow the actual path', () => {
  assert.deepEqual(trace([center(0), center(2)], 0), [0,1,2]);
  assert.deepEqual(trace([center(0), center(6)], 0), [0,3,6]);
  assert.deepEqual(trace([center(0), center(1), center(5)], 0), [0,1,5]);
});
test('returning over the previous center backtracks without duplicate selection', () => {
  assert.deepEqual(trace([center(0), center(8), center(4)], 0), [0,4]);
  assert.deepEqual(trace([center(0), center(8), center(0)], 0), [0]);
  assert.deepEqual(trace([center(0), center(0), center(0)], 0), [0]);
});
test('gaps, empty cells and nonadjacent jumps do not add a tile', () => {
  assert.deepEqual(dragHits({x:96,y:0},{x:96,y:292},targets), []);
  const sparse = dragTargets({left:0,top:0,width:292,height:292},3,8,8,board.map((c,i)=>i===4?null:c));
  assert.deepEqual(trace([center(0), center(8)],0,sparse),[0]);
});
test('small 5 by 5 boards and viewport offsets preserve diagonal geometry', () => {
  const cells=dragTargets({left:18,top:210,width:250,height:250},5,7,7,Array(25).fill({v:1}));
  assert.deepEqual(trace([cells[0],cells[24]],0,cells,5),[0,6,12,18,24]);
  assert.deepEqual(dragHits(cells[24],cells[0],cells),[24,18,12,6,0]);
});
