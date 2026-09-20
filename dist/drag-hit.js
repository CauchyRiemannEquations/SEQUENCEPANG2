// Use untransformed grid geometry: selected/falling tile animations must not
// move the touch targets. Corner grazes between diagonal cells are ignored.
export function dragTargets(bounds, n, columnGap, rowGap, board) {
  const width = (bounds.width - columnGap * (n - 1)) / n;
  const height = (bounds.height - rowGap * (n - 1)) / n;
  const radius = Math.min(width, height) * 0.34;
  if (!(radius > 0)) return [];
  return board.flatMap((cell, index) => cell ? [{
    index,
    x: bounds.left + (index % n) * (width + columnGap) + width / 2,
    y: bounds.top + Math.floor(index / n) * (height + rowGap) + height / 2,
    radius,
  }] : []);
}

// Intersect the whole movement segment, not just the last pointer coordinate,
// so fast drags still visit intermediate tile centers in order.
export function dragHits(from, to, targets) {
  const dx = to.x - from.x, dy = to.y - from.y;
  const length2 = dx * dx + dy * dy;
  const hits = [];
  for (const target of targets) {
    const ox = from.x - target.x, oy = from.y - target.y;
    const outside = ox * ox + oy * oy - target.radius * target.radius;
    if (outside <= 0) { hits.push({ index: target.index, t: 0 }); continue; }
    if (!length2) continue;
    const projection = ox * dx + oy * dy;
    const discriminant = projection * projection - length2 * outside;
    if (discriminant < 0) continue;
    const t = (-projection - Math.sqrt(discriminant)) / length2;
    if (t >= 0 && t <= 1) hits.push({ index: target.index, t });
  }
  return hits.sort((a, b) => a.t - b.t).map(hit => hit.index);
}
