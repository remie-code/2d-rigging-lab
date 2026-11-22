const japanese = /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u;
const japaneseSpacing = /(?<=[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}、。！？「」『』・ー])\s+|\s+(?=[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}、。！？「」『』・ー])/gu;

// Relative dimensions for the geometry thresholds below, independent of the source resolution.
export const referenceWidth = 1474;
export const referenceHeight = 829;

export function lineAffinity(a, b) {
  const height = Math.max(a.h, b.h);
  const dy = Math.min(Math.abs(a.y - b.y), Math.abs(a.y + a.h / 2 - b.y - b.h / 2));
  const sharedWidth = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  if (dy > height / 2 || sharedWidth <= 0) return 0;
  return (sharedWidth / Math.min(a.w, b.w)) * (1 - dy / height);
}

function mergeRow(parts) {
  const x = parts[0].x;
  const y = Math.min(...parts.map((part) => part.y));
  return {
    text: parts.map((part) => part.text).join(""),
    x, y,
    w: Math.max(...parts.map((part) => part.x + part.w)) - x,
    h: Math.max(...parts.map((part) => part.y + part.h)) - y,
  };
}

function restoreSplitRows(lines, priorRows, isSameFragment) {
  const proposals = [];
  const claims = new Map();
  for (const observation of priorRows) {
    const {row: anchor} = observation;
    const parts = lines.filter((part) => lineAffinity(anchor, part) >= 0.5
      && part.x >= anchor.x - anchor.h / 2
      && part.x + part.w <= anchor.x + anchor.w + anchor.h / 2
      && isSameFragment(observation, part))
      .sort((a, b) => a.x - b.x);
    if (parts.length < 2) continue;
    const last = parts.at(-1);
    if (Math.abs(parts[0].x - anchor.x) > anchor.h
      || Math.abs(last.x + last.w - anchor.x - anchor.w) > anchor.h
      || parts.some((part, index) => {
        if (index === 0) return false;
        const left = parts[index - 1];
        const gap = part.x - left.x - left.w;
        return gap < -anchor.h / 4 || gap > anchor.h * 3;
      })) continue;
    proposals.push(parts);
    for (const part of parts) claims.set(part, (claims.get(part) ?? 0) + 1);
  }
  const consumed = new Set();
  const restored = [];
  for (const parts of proposals) {
    if (parts.some((part) => claims.get(part) > 1)) continue;
    restored.push(mergeRow(parts));
    for (const part of parts) consumed.add(part);
  }
  return [...lines.filter((line) => !consumed.has(line)), ...restored];
}

function verticalDistance(upper, lower) {
  const gap = lower.y - upper.y - upper.h;
  if (gap < -2 || gap > 42) return Infinity;
  const leftDelta = Math.abs(upper.x - lower.x);
  const centerDelta = Math.abs(upper.x + upper.w / 2 - lower.x - lower.w / 2);
  if (leftDelta > 24 && centerDelta > 42) return Infinity;
  return Math.max(0, gap) + Math.min(leftDelta, centerDelta);
}

export function groupDialogueRows({width, height, lines}, priorRows, isSameFragment) {
  if (!(width > 0 && height > 0)) throw new RangeError("OCR frame dimensions must be positive");
  // Normalize coordinates so resizing the capture window does not reset its active displays.
  const rows = lines.filter(({text, x, y, w, h}) => typeof text === "string"
    && [x, y, w, h].every(Number.isFinite) && w > 0 && h > 0)
    .map(({text, x, y, w, h}) => ({
      text: text.trim().replace(japaneseSpacing, ""),
      x: x * referenceWidth / width, y: y * referenceHeight / height,
      w: w * referenceWidth / width, h: h * referenceHeight / height,
    }))
    .filter(({text}) => text.length > 0);
  const ordered = restoreSplitRows(rows, priorRows, isSameFragment)
    .filter(({text}) => japanese.test(text))
    .sort((a, b) => a.y - b.y || a.x - b.x);
  const candidates = [];
  for (const [index, upper] of ordered.entries()) {
    for (let below = index + 1; below < ordered.length; below += 1) {
      const lower = ordered[below];
      if (lower.y - upper.y - upper.h > 42) break;
      const distance = verticalDistance(upper, lower);
      if (Number.isFinite(distance)) candidates.push({upper, lower, distance});
    }
  }
  candidates.sort((a, b) => a.distance - b.distance);
  const next = new Map();
  const hasPrevious = new Set();
  for (const {upper, lower} of candidates) {
    if (next.has(upper) || hasPrevious.has(lower)) continue;
    next.set(upper, lower);
    hasPrevious.add(lower);
  }
  return ordered.filter((row) => !hasPrevious.has(row)).map((first) => {
    const block = [];
    for (let row = first; row; row = next.get(row)) block.push(row);
    return block;
  });
}
