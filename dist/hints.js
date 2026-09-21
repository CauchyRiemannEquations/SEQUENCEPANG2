import { hintData } from './hint-data.js';
import { valid } from './engine.js';

export const hintKey = 'sequencepang2-hints-v1';
export const hintTier = count => count >= 5 ? 2 : count >= 3 ? 1 : 0;
export const puzzleSignature = level => JSON.stringify([level.n, level.moves, level.board.map(c => c ? [c.v, !!c.star] : null)]);

// Precomputed, verified first moves keep expensive search off mobile devices.
export function firstHint(level) {
  const entry = hintData[level.key];
  if (level.id < 11 || !entry || entry.signature !== puzzleSignature(level) || !valid(level.board, entry.path, level.n)) return null;
  return [...entry.path];
}

export class MangoHints {
  constructor(storage, levels) {
    this.storage = storage;
    this.counts = {};
    this.counted = new WeakSet();
    try {
      const saved = JSON.parse(storage?.getItem(hintKey) || '{}');
      for (const level of levels) {
        const entry = saved?.[level.key];
        if (firstHint(level) && entry?.signature === puzzleSignature(level) && Number.isInteger(entry.failures) && entry.failures >= 0) {
          this.counts[level.key] = { signature: entry.signature, failures: Math.min(5, entry.failures), aiTier: [1,2].includes(entry.aiTier) ? entry.aiTier : 0, ripeness: [1,2,3].includes(entry.ripeness) ? entry.ripeness : 0 };
        }
      }
    } catch {}
  }
  failures(level) { return this.counts[level.key]?.failures || 0; }
  tier(level) { return Math.max(hintTier(this.failures(level)), this.counts[level.key]?.aiTier || 0); }
  ripeness(level) { return Math.max(Math.min(3,this.failures(level)), this.counts[level.key]?.ripeness || 0, this.tier(level) ? 3 : 0); }
  grant(level, tier, ripeness = 0) {
    if (!firstHint(level) || ![0,1,2].includes(tier) || ![0,1,2,3].includes(ripeness)) return false;
    const old = this.counts[level.key] || {};
    const entry = {signature:puzzleSignature(level), failures:this.failures(level),
      aiTier:Math.max(old.aiTier || 0,tier), ripeness:Math.max(old.ripeness || 0,ripeness,tier ? 3 : 0)};
    if (JSON.stringify(old) === JSON.stringify(entry)) return false;
    this.counts[level.key] = entry;
    try { this.storage?.setItem(hintKey,JSON.stringify(this.counts)); } catch {}
    return true;
  }
  recordFailure(session) {
    if (session.status !== 'failed' || !session.history.length || !firstHint(session.level) || this.counted.has(session.history)) return false;
    this.counted.add(session.history);
    this.counts[session.level.key] = { ...this.counts[session.level.key], signature: puzzleSignature(session.level), failures: Math.min(5, this.failures(session.level) + 1) };
    try { this.storage?.setItem(hintKey, JSON.stringify(this.counts)); } catch {}
    return true;
  }
}
