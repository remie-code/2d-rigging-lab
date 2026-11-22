import {groupDialogueRows, lineAffinity, referenceHeight, referenceWidth} from "./game-dialogue-grouping.mjs";

function comparableText(text) {
  return text.normalize("NFKC").replace(/[^\p{L}\p{N}]/gu, "") || text;
}

function similarText(left, right, minimum = 0.85) {
  if (Math.min(left.length, right.length) >= 4 && (left.includes(right) || right.includes(left))) return true;
  if (Math.min(left.length, right.length) < 3) return false;

  // A shared sequence tolerates OCR substitutions and missing characters in a growing line.
  const lengths = new Uint32Array(right.length + 1);
  for (const char of left.split("")) {
    let diagonal = 0;
    for (let index = 0; index < right.length; index += 1) {
      const previous = lengths[index + 1];
      lengths[index + 1] = char === right[index] ? diagonal + 1 : Math.max(previous, lengths[index]);
      diagonal = previous;
    }
  }
  const shared = lengths.at(-1);
  return 2 * shared >= minimum * (left.length + right.length)
    || (left[0] === right[0] && shared >= Math.max(3, Math.min(left.length, right.length) - 1));
}

function matchRows(previous, current) {
  const candidates = [];
  for (const [before, {row}] of previous.entries()) {
    for (const [after, next] of current.entries()) {
      const affinity = lineAffinity(row, next);
      if (affinity >= 0.35) candidates.push({before, after, affinity});
    }
  }
  candidates.sort((a, b) => b.affinity - a.affinity);
  const beforeUsed = new Set();
  const afterUsed = new Set();
  return candidates.filter(({before, after}) => {
    if (beforeUsed.has(before) || afterUsed.has(after)) return false;
    beforeUsed.add(before);
    afterUsed.add(after);
    return true;
  });
}

function strokeOverlap(previous, current, row) {
  if (!previous || !current || previous.width !== current.width || previous.height !== current.height) return null;
  const {width, height} = current;
  const left = Math.max(0, Math.floor(row.x * width / referenceWidth));
  const right = Math.min(width, Math.ceil((row.x + row.w) * width / referenceWidth));
  const top = Math.max(0, Math.floor(row.y * height / referenceHeight));
  const bottom = Math.min(height, Math.ceil((row.y + row.h) * height / referenceHeight));
  let both = 0;
  let previousCount = 0;
  let currentCount = 0;
  for (let y = top; y < bottom; y += 1) {
    for (let index = y * width + left; index < y * width + right; index += 1) {
      const bit = 1 << (index & 7);
      const a = (previous.data[index >>> 3] & bit) !== 0;
      const b = (current.data[index >>> 3] & bit) !== 0;
      previousCount += a;
      currentCount += b;
      both += a && b;
    }
  }
  const visible = Math.min(previousCount, currentCount);
  return visible >= 12 ? both / visible : null;
}

function validPixelTiles(tiles, width, height) {
  return tiles && tiles.width === width && tiles.height === height
    && Number.isSafeInteger(tiles.tileSize) && tiles.tileSize > 0
    && tiles.data instanceof Uint8Array
    && tiles.data.length === Math.ceil(width / tiles.tileSize) * Math.ceil(height / tiles.tileSize) * 8;
}

function observePixelTiles(tiles, row) {
  if (!tiles) return null;
  const {width, height, tileSize} = tiles;
  const left = Math.floor(Math.max(0, row.x * width / referenceWidth) / tileSize);
  const top = Math.floor(Math.max(0, row.y * height / referenceHeight) / tileSize);
  const right = Math.ceil(Math.min(width, (row.x + row.w) * width / referenceWidth) / tileSize);
  const bottom = Math.ceil(Math.min(height, (row.y + row.h) * height / referenceHeight) / tileSize);
  if (left >= right || top >= bottom) return null;
  const region = {width, height, tileSize, left, top, right, bottom};
  // Keep only the observed row's tile bytes beyond this frame.
  return {...region, data: Buffer.concat([...tileRows(tiles, region)])};
}

function* tileRows(tiles, {left, top, right, bottom}) {
  const stride = Math.ceil(tiles.width / tiles.tileSize);
  for (let row = top; row < bottom; row += 1) {
    yield tiles.data.subarray((row * stride + left) * 8, (row * stride + right) * 8);
  }
}

function hasUnchangedPixels(previous, tiles) {
  if (!previous || !tiles || previous.width !== tiles.width || previous.height !== tiles.height
    || previous.tileSize !== tiles.tileSize) return false;
  let offset = 0;
  for (const row of tileRows(tiles, previous)) {
    if (!previous.data.subarray(offset, offset + row.length).equals(row)) return false;
    offset += row.length;
  }
  return offset === previous.data.length;
}

function rowObservation(row, mask, pixelTiles, previous) {
  const recent = [...(previous?.recent ?? []), row.text].slice(-5);
  const votes = new Map();
  for (const text of recent) votes.set(text, (votes.get(text) ?? 0) + 1);
  let best = previous?.text ?? row.text;
  for (const text of recent) {
    const length = comparableText(text).length;
    const bestLength = comparableText(best).length;
    if (length > bestLength || (length === bestLength && votes.get(text) > (votes.get(best) ?? 0))) {
      best = text;
    }
  }
  return {row, mask, pixelTiles: observePixelTiles(pixelTiles, row), text: best, recent};
}

function hasContinuity(previous, next, mask) {
  const priorText = comparableText(previous.row.text);
  const bestText = comparableText(previous.text);
  const nextText = comparableText(next.text);
  if (priorText.startsWith(nextText) || nextText.startsWith(priorText)
    || bestText.startsWith(nextText) || nextText.startsWith(bestText)) return true;
  const overlap = strokeOverlap(previous.mask, mask, previous.row);
  if (overlap >= 0.55) return true;
  if (overlap !== null && overlap < 0.12) return false;
  return similarText(priorText, nextText) || similarText(bestText, nextText);
}

function isRecoveredFragment(previous, next, mask) {
  const {row} = previous;
  const padding = row.h / 3;
  return lineAffinity(row, next) >= 0.5 && next.w >= row.w * 1.25
    && row.x >= next.x - padding && row.x + row.w <= next.x + next.w + padding
    && hasContinuity(previous, next, mask);
}

function isSameVisibleRow(previous, next, mask) {
  return lineAffinity(previous.row, next) >= 0.65
    && similarText(comparableText(previous.text), comparableText(next.text), 0.75)
    && strokeOverlap(previous.mask, mask, previous.row) >= 0.75;
}

function snapshot(track, closedAt = null, closeReason = null) {
  return {
    text: track.rows.map(({text}) => text).join("\n"),
    displayOrder: track.displayOrder,
    startedAt: track.startedAt,
    lastSeenAt: track.lastSeenAt,
    closedAt,
    closeReason,
  };
}

/** update emits finalized records as they close. displayOrder records when each display began. */
export function createGameDialogueTracker({missingFrames = 2} = {}) {
  if (!Number.isInteger(missingFrames) || missingFrames < 1) throw new RangeError("missingFrames must be a positive integer");
  const active = new Set();
  let nextOrder = 1;

  function update(frame) {
    const {capturedAtMs: time, strokeMask} = frame;
    const pixelTiles = validPixelTiles(frame.pixelTiles, frame.width, frame.height) ? frame.pixelTiles : null;
    const priorRows = [...active].flatMap((track) => track.rows);
    const blocks = groupDialogueRows(frame, priorRows, (previous, part) => {
      const fragment = comparableText(part.text);
      return comparableText(previous.text).includes(fragment)
        || strokeOverlap(previous.mask, strokeMask, part) >= 0.55;
    });
    const candidates = [];
    for (const track of active) {
      for (const block of blocks) {
        const pairs = matchRows(track.rows, block);
        if (pairs.length === 0) continue;
        const score = pairs.reduce((sum, {affinity}) => sum + affinity, 0)
          / Math.max(track.rows.length, block.length);
        candidates.push({track, block, pairs, score});
      }
    }
    candidates.sort((a, b) => b.score - a.score);
    const assigned = new Map();
    const consumed = new Set();
    for (const candidate of candidates) {
      if (assigned.has(candidate.track) || consumed.has(candidate.block)) continue;
      assigned.set(candidate.track, candidate);
      consumed.add(candidate.block);
    }

    // A later complete OCR block can reunite partial or temporarily separated rows.
    for (const [track, match] of assigned) {
      if (match.pairs.some(({before, after}) => !hasContinuity(track.rows[before], match.block[after], strokeMask))) continue;
      for (const fragment of active) {
        if (assigned.has(fragment)) continue;
        const rejoinedRow = fragment.rows.length === 1 && match.block.length > 1
          && match.block.some((next) => isSameVisibleRow(fragment.rows[0], next, strokeMask));
        const recoveredFragments = fragment.rows.every((previous) =>
          match.block.some((next) => isRecoveredFragment(previous, next, strokeMask)));
        if (!rejoinedRow && !recoveredFragments) continue;
        track.startedAt = Math.min(track.startedAt, fragment.startedAt);
        track.displayOrder = Math.min(track.displayOrder, fragment.displayOrder);
        active.delete(fragment);
      }
    }

    const closed = [];
    function close(track, reason) {
      closed.push(snapshot(track, time, reason));
      active.delete(track);
    }
    for (const track of active) {
      const match = assigned.get(track);
      if (!match) {
        const persists = track.rows.some((previous) => strokeOverlap(previous.mask, strokeMask, previous.row) >= 0.55
          || hasUnchangedPixels(previous.pixelTiles, pixelTiles));
        if (persists) {
          track.misses = 0;
          track.lastSeenAt = time;
        } else if (++track.misses >= missingFrames) {
          close(track, "disappeared");
        }
        continue;
      }

      const {block, pairs} = match;
      const replaced = pairs.some(({before, after}) => !hasContinuity(track.rows[before], block[after], strokeMask));
      if (replaced) {
        close(track, "replaced");
        consumed.delete(block);
        continue;
      }
      const matched = new Map(pairs.map(({before, after}) => [after, track.rows[before]]));
      const matchedBefore = new Set(pairs.map(({before}) => before));
      const observed = block.map((row, index) => rowObservation(row, strokeMask, pixelTiles, matched.get(index)));
      track.rows = [...observed, ...track.rows.filter((_, index) => !matchedBefore.has(index))]
        .sort((a, b) => a.row.y - b.row.y || a.row.x - b.row.x);
      track.lastSeenAt = time;
      track.misses = 0;
    }
    for (const block of blocks) {
      if (consumed.has(block)) continue;
      active.add({
        rows: block.map((row) => rowObservation(row, strokeMask, pixelTiles)),
        displayOrder: nextOrder++,
        startedAt: time,
        lastSeenAt: time,
        misses: 0,
      });
    }
    return closed.sort((a, b) => a.displayOrder - b.displayOrder);
  }

  return {
    update,
    clearPending: () => active.clear(),
    pending: () => [...active].map((track) => snapshot(track)).sort((a, b) => a.displayOrder - b.displayOrder)
  };
}
