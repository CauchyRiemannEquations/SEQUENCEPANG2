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
