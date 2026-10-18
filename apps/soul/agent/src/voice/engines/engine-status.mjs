// @ts-check
/**
 * 声の差し替え口（VoiceEngine）の状態の入れ物（声の差し替え Wave 2 Domain C）— apps/soul/agent。
 *
 * 状態の語彙は STT と同じ `connecting | up | reconnecting | down`（wave-plan §0）。engine ごとに
 * `status` / `onStatus` を同じ作りで持てるよう、値と購読者だけをここに閉じる（I/O なし）。
 * 同じ値への set は通知しない。購読者の失敗は engine を壊さない。
 */

/** engine の状態の語彙（STT と同じ）。 */
export const VOICE_ENGINE_STATUSES = Object.freeze(["connecting", "up", "reconnecting", "down"]);

/**
 * @typedef {"connecting" | "up" | "reconnecting" | "down"} VoiceEngineStatus
 */

/**
 * @param {VoiceEngineStatus} initial
 * @returns {{ get: () => VoiceEngineStatus; set: (next: VoiceEngineStatus) => void; onStatus: (listener: (status: VoiceEngineStatus) => void) => () => void; clear: () => void }}
 */
export function createEngineStatusCell(initial) {
  if (!VOICE_ENGINE_STATUSES.includes(initial)) {
    throw new RangeError(`unknown voice engine status: ${String(initial)}`);
  }
  /** @type {VoiceEngineStatus} */
  let status = initial;
  /** @type {Set<(status: VoiceEngineStatus) => void>} */
  const listeners = new Set();
  return {
    get: () => status,
    set(next) {
      if (!VOICE_ENGINE_STATUSES.includes(next)) {
        throw new RangeError(`unknown voice engine status: ${String(next)}`);
      }
      if (next === status) return;
      status = next;
      for (const listener of [...listeners]) {
        try {
          listener(status);
        } catch {
          // 購読者の失敗で engine の状態を壊さない。
        }
      }
    },
    onStatus(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    clear() {
      listeners.clear();
    }
  };
}
