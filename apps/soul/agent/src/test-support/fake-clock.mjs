// @ts-check
/**
 * 決定論の偽の時計（setTimeoutImpl / clearTimeoutImpl の替え玉・機械テスト専用）— apps/soul/agent。
 *
 * 種類の違うタイマ（keep_alive・つなぎ直し・待ちの上限など）が同時にあるときのために、予約時刻つきで持ち、
 * `advance(ms)` で時計を進めて期限の来たものを期限順に走らせる（走らせた中で予約されたものも、期限内なら走る）。
 * 実時間は待たない。
 */

/**
 * @returns {{
 *   setTimeoutImpl: any;
 *   clearTimeoutImpl: any;
 *   now: () => number;
 *   advance: (ms: number) => void;
 *   pending: () => Array<{ id: number; dueMs: number; delayMs: number }>;
 * }}
 */
export function createFakeClock() {
  let nowMs = 0;
  let nextId = 1;
  /** @type {Map<number, { fn: Function; dueMs: number; delayMs: number; order: number }>} */
  const timers = new Map();
  let order = 0;
  return {
    setTimeoutImpl: (/** @type {Function} */ fn, /** @type {number} */ ms) => {
      const id = nextId;
      nextId += 1;
      const delayMs = Math.max(0, Number(ms) || 0);
      order += 1;
      timers.set(id, { fn, dueMs: nowMs + delayMs, delayMs, order });
      return id;
    },
    clearTimeoutImpl: (/** @type {number} */ id) => {
      timers.delete(id);
    },
    now: () => nowMs,
    advance(ms) {
      const target = nowMs + ms;
      for (;;) {
        let best = null;
        for (const [id, timer] of timers) {
          if (timer.dueMs > target) continue;
          if (best === null || timer.dueMs < best.timer.dueMs || (timer.dueMs === best.timer.dueMs && timer.order < best.timer.order)) {
            best = { id, timer };
          }
        }
        if (best === null) break;
        timers.delete(best.id);
        nowMs = best.timer.dueMs;
        best.timer.fn();
      }
      nowMs = target;
    },
    pending: () => [...timers.entries()].map(([id, t]) => ({ id, dueMs: t.dueMs, delayMs: t.delayMs }))
  };
}
