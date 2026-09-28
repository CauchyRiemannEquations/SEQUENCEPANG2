// The date is an instant, so it opens at midnight October 1 in Korea even
// when the device itself uses another timezone.
export const hundredStageRelease = Date.parse('2026-10-01T00:00:00+09:00');
export function playableLevels(allLevels, now = Date.now()) {
  return now >= hundredStageRelease ? allLevels : allLevels.slice(0, 50);
}
