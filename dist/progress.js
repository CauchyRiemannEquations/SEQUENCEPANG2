import { GameSession } from './session.js';

export const progressKey = 'sequenstar-campaign-v2';

// Stable stage keys keep completion attached to the puzzle when chapters move.
export function readProgress(storage, levels) {
  try {
    const current = JSON.parse(storage.getItem(progressKey) || 'null');
    if (current && typeof current === 'object' && !Array.isArray(current)) {
      return Object.fromEntries(levels.filter(l => current[l.key] === true).map(l => [l.key, true]));
    }
    const legacy = JSON.parse(storage.getItem('sequencepang2-v1') || '{}');
    return Object.fromEntries(levels.filter(l => l.legacyIndex !== undefined && legacy?.[l.legacyIndex] === true).map(l => [l.key, true]));
  } catch { return {}; }
}

export function saveProgress(storage, progress) {
  try { storage.setItem(progressKey, JSON.stringify(progress)); } catch {}
}

// Keep the old completion key to preserve existing players' records.
export const runKey = 'sequencepang2-active-v1';
export function saveRun(storage, session) {
  try {
    if (!['playing', 'failed'].includes(session.status)) { storage.removeItem(runKey); return; }
    storage.setItem(runKey, JSON.stringify({ version: 2, key: session.level.key }));
  } catch {}
}

// Remember the stage only. Old v1 move histories are deliberately discarded.
export function restoreRun(storage, levels) {
  try {
    const saved = JSON.parse(storage.getItem(runKey) || 'null');
    if (!saved || ![1, 2].includes(saved.version)) return null;
    const index = levels.findIndex(level => level.key === saved.key);
    if (index < 0) return null;
    const game = new GameSession(levels); game.start(index);
    saveRun(storage, game);
    return game;
  } catch { return null; }
}

export function campaignComplete(levels, progress) {
  return levels.length > 0 && levels.every(level => progress[level.key] === true);
}

export function nextStageIndex(levels, progress) {
  const next = levels.findIndex(level => progress[level.key] !== true);
  return next < 0 ? 0 : next;
}

// Reset this game's progress only; unrelated site data and sound preferences stay.
// Write an empty current record first so legacy completion cannot be reimported.
export function resetProgress(storage) {
  try {
    storage.setItem(progressKey, '{}');
    storage.removeItem(runKey);
    storage.removeItem('sequencepang2-v1');
    return true;
  } catch { return false; }
}
