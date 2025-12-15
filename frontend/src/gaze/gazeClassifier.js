export function classifyGazeWindow(samples) {
  if (!samples || samples.length < 5) return "idle";

  const valid = samples.filter((s) => s.sentenceIndex !== null);
  if (valid.length < 3) return "idle";

  let segments = [];
  let current = { sentenceIndex: valid[0].sentenceIndex, start: valid[0].t, end: valid[0].t };

  for (let i = 1; i < valid.length; i++) {
    const s = valid[i];
    if (s.sentenceIndex === current.sentenceIndex) {
      current.end = s.t;
    } else {
      segments.push(current);
      current = { sentenceIndex: s.sentenceIndex, start: s.t, end: s.t };
    }
  }
  segments.push(current);

  const dwellTimes = segments.map((seg) => seg.end - seg.start); 
  const avgDwellMs =
    dwellTimes.reduce((a, b) => a + b, 0) / Math.max(dwellTimes.length, 1);

  let jumps = [];
  let backwardCount = 0;
  for (let i = 1; i < segments.length; i++) {
    const prev = segments[i - 1].sentenceIndex;
    const cur = segments[i].sentenceIndex;
    const diff = cur - prev;
    jumps.push(Math.abs(diff));
    if (diff < 0) backwardCount += 1;
  }
  const avgJump = jumps.length
    ? jumps.reduce((a, b) => a + b, 0) / jumps.length
    : 0;

  const READING_DWELL_MS = 300;
  const SKIM_DWELL_MS = 150;
  const SKIM_JUMP_SENTENCES = 2;
  const REREAD_BACKWARD_THRESHOLD = 2;

  if (backwardCount >= REREAD_BACKWARD_THRESHOLD && avgDwellMs > SKIM_DWELL_MS) {
    return "rereading";
  }

  if (avgDwellMs < SKIM_DWELL_MS && avgJump >= SKIM_JUMP_SENTENCES) {
    return "skimming";
  }

  if (avgDwellMs >= READING_DWELL_MS && avgJump <= 1.5) {
    return "reading";
  }

  if (backwardCount > 0) return "rereading";

  return "reading";
}
