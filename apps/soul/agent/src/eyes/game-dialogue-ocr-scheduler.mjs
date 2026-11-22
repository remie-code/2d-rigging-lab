import { createGameDialogueTracker } from "./game-dialogue-tracker.mjs";
import { captureWindow } from "./window-capture.mjs";
import { recognizeScreenText } from "./windows-ocr.mjs";

export const DEFAULT_STREAM_GAME_OCR_INTERVAL_MS = 1000;
const MAX_TIMER_DELAY_MS = 2_147_483_647;
const OCR_CAPTURE_MAX_SIDE = 1474;

export function resolveStreamGameOcrInterval(raw) {
  const value = typeof raw === "string" && /^\d+$/.test(raw.trim()) ? Number(raw) : NaN;
  return value > 0 && value <= MAX_TIMER_DELAY_MS ? value : DEFAULT_STREAM_GAME_OCR_INTERVAL_MS;
}

/**
 * Keep a single capture/recognition in flight across target changes and venue
 * restarts. Missed sampling opportunities are dropped.
 */
export function createGameDialogueOcrScheduler({
  intervalMs = DEFAULT_STREAM_GAME_OCR_INTERVAL_MS,
  captureImpl = captureWindow,
  recognizeImpl = recognizeScreenText,
  nowImpl = Date.now,
  setIntervalImpl = setInterval,
  clearIntervalImpl = clearInterval
} = {}) {
  let buffer = null;
  let title = null;
  let tracker = null;
  let windowIdentity = null;
  let timer = null;
  let inFlight = null;

  async function sample() {
    if (!title || inFlight) return;
    const controller = new AbortController();
    inFlight = controller;
    const { signal } = controller;
    const capturedAtMs = nowImpl();
    try {
      const capture = await captureImpl(title, { signal, maxSide: OCR_CAPTURE_MAX_SIDE, includeWindowIdentity: true });
      if (signal.aborted) return;
      if (capture.error) {
        if (capture.error.kind === "notFound" || capture.error.kind === "minimized") {
          windowIdentity = null;
          tracker.clearPending();
        }
        return;
      }
      if (capture.windowIdentity !== windowIdentity) {
        windowIdentity = capture.windowIdentity;
        tracker.clearPending();
      }
      const frame = await recognizeImpl({ jpegBase64: capture.jpegBase64, capturedAtMs }, { signal });
      if (signal.aborted || frame.error) return;
      for (const block of tracker.update(frame)) {
        if (signal.aborted) break;
        buffer.addGameScreen(block);
      }
    } catch {
      // Capture or OCR failure leaves the venue running and is retried on the next tick.
    } finally {
      inFlight = null;
    }
  }

  function setSource(nextBuffer, nextTitle = null) {
    if (nextBuffer === buffer && nextTitle === title) return;
    if (timer !== null) clearIntervalImpl(timer);
    timer = null;
    inFlight?.abort();
    if (nextBuffer !== buffer) tracker = nextBuffer ? createGameDialogueTracker() : null;
    else tracker?.clearPending();
    buffer = nextBuffer;
    title = nextTitle;
    windowIdentity = null;
    if (buffer && title) {
      timer = setIntervalImpl(sample, intervalMs);
      timer?.unref?.();
      void sample();
    }
  }

  return { setSource };
}
