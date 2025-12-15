export function mapYToSentenceIndex(y, rects) {
  if (!rects || rects.length === 0) return null;
  const absY = y + window.scrollY;

  for (const r of rects) {
    if (absY >= r.top && absY <= r.bottom) {
      return r.idx;
    }
  }
  return null;
}
