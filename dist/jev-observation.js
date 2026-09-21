// Debug-only, page-memory observations. No player identity or raw input trace.
export class PlayObservation {
  constructor(now = () => performance.now()) { this.now = now; this.reset(); }
  reset() {
    this.key = null; this.active = false; this.lastTick = this.now();
    this.elapsed = 0; this.lastAction = 0; this.attempts = 0;
    this.invalid = 0; this.repeated = 0; this.valid = 0;
    this.seen = new Set(); this.hintSeen = 'NONE';
  }
  tick() {
    const time = this.now();
    if (this.active) this.elapsed += Math.max(0, time - this.lastTick);
    this.lastTick = time;
  }
  setActive(active) { this.tick(); this.active = active; }
  start(level) {
    if (this.key !== level.key) { this.reset(); this.key = level.key; }
    this.attempts++; this.lastAction = this.elapsed;
  }
  record(board, path, valid) {
    this.tick(); this.lastAction = this.elapsed;
    // A short accidental drag is not evidence of a failed mathematical attempt.
    if (path.length < 3) return;
    const signature = JSON.stringify([board.map(c => c ? [c.v, !!c.star] : null), path]);
    if (this.seen.has(signature)) this.repeated++;
    this.seen.add(signature);
    if (this.seen.size > 80) this.seen.delete(this.seen.values().next().value);
    if (valid) this.valid++; else this.invalid++;
  }
  snapshot(session, failures) {
    this.tick();
    const count = board => board.filter(c => c?.star).length;
    const cap = value => Math.min(10000, value);
    return {
      stage: session.level.id, size: session.level.n, status: session.status,
      moveLimit: session.level.moves, movesLeft: session.moves,
      starsTotal: count(session.level.board), starsLeft: count(session.board),
      failures: Math.min(5, failures), attempts: cap(this.attempts),
      activeSeconds: cap(Math.floor(this.elapsed / 1000)),
      secondsSinceAction: cap(Math.floor((this.elapsed - this.lastAction) / 1000)),
      invalidSequences: cap(this.invalid), repeatedSequences: cap(this.repeated),
      validSequences: cap(this.valid), hintSeen: this.hintSeen,
    };
  }
}
