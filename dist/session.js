import { kind, valid, remove, stars, adjacent } from './engine.js';

// A legal sequence always contains a legal three-tile prefix.
export function hasMove(board, n) {
  for (let a = 0; a < board.length; a++) {
    if (!board[a]) continue;
    for (let b = 0; b < board.length; b++) {
      if (!board[b] || !adjacent(a, b, n)) continue;
      for (let c = 0; c < board.length; c++) {
        if (c !== a && board[c] && adjacent(b, c, n) &&
            kind([board[a].v, board[b].v, board[c].v])) return true;
      }
    }
  }
  return false;
}

export class GameSession {
  constructor(levels) {
    this.levels = levels;
    this.index = 0;
    this.status = 'idle';
    this.history = [];
    this.board = [];
    this.moves = 0;
  }

  get level() { return this.levels[this.index]; }

  start(index) {
    if (!Number.isInteger(index) || !this.levels[index]) throw new RangeError('Unknown stage');
    this.index = index;
    this.board = structuredClone(this.level.board);
    this.moves = this.level.moves;
    this.history = [];
    this.status = 'playing';
  }

  play(path) {
    if (this.status !== 'playing' || !valid(this.board, path, this.level.n)) return null;
    const sequence = kind(path.map(i => this.board[i].v));
    this.history.push([...path]);
    this.board = remove(this.board, path, this.level.n);
    this.moves--;
    if (!stars(this.board)) this.status = 'cleared';
    else if (!this.moves || !hasMove(this.board, this.level.n)) this.status = 'failed';
    return { sequence, status: this.status };
  }

  retry() {
    if (this.status !== 'failed') return false;
    this.start(this.index);
    return true;
  }

  restart() {
    if (this.status === 'idle') return false;
    this.start(this.index);
    return true;
  }
}
