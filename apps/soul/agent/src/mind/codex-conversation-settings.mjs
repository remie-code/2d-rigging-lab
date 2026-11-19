import { isCodexBrainId } from "./brains.mjs";

/**
 * ①チャッピーの返事の turn/start に送る速さの段（service tier）。Codex の頭なら fast の ON で "priority"・OFF で
 * "default"（OFF に戻したとき同じ thread を通常へ戻すため、OFF でも明示して送る）。Claude の頭は null（送らない）。
 * @param {unknown} brainId
 * @param {boolean} fastEnabled
 * @returns {"priority" | "default" | null}
 */
export function resolveCodexServiceTier(brainId, fastEnabled) {
  if (!isCodexBrainId(brainId)) return null;
  return fastEnabled === true ? "priority" : "default";
}

/**
 * 操縦席の設定（頭脳・会話のタブ）の「Codex の fast」（①チャッピーの Codex の頭だけ・service tier "priority"・
 * 2026-10-27 合意）を、cockpit-server の口（onSetCodexFastMode / codexFastStatus）へ橋渡しする
 * （createBargeInHooks と同じ流儀の薄い配線層）。設定の正本はここ（ON/OFF）で、次の受理の configuration に
 * serviceTierFor の値を載せる＝次の返事から効く（セッションは作り直さない）。②書き出し役・④思い出し役は通らない。
 * モデルが priority を持つかは、codex-session が model/list で読んだ結果（noteServiceTiers）を頭ごとに覚える。
 * @param {{ getCodexFastMode?: () => boolean | null; setCodexFastMode?: (enabled: boolean) => void }} settings
 * @param {boolean} [defaultEnabled=false]  未記憶時のフォールバック（既定 OFF）。
 */
export function createCodexFastHooks(settings, defaultEnabled = false) {
  let enabled = defaultEnabled;
  try {
    const remembered = typeof settings.getCodexFastMode === "function" ? settings.getCodexFastMode() : null;
    if (typeof remembered === "boolean") enabled = remembered;
  } catch {
    // 読めなければ既定。
  }
  /** @type {Map<string, boolean | null>} 頭 → そのモデルが priority を持つか（読めなければ null）。 */
  const support = new Map();
  return {
    isEnabled: () => enabled,
    /** cockpit-server の onSetCodexFastMode（POST /api/codex-fast が呼ぶ・値は検証済みの boolean）。 */
    onSetCodexFastMode: (/** @type {boolean} */ next) => {
      enabled = next === true;
      try {
        if (typeof settings.setCodexFastMode === "function") settings.setCodexFastMode(enabled);
      } catch {
        // 永続化失敗は操作を止めない（次の返事には効いている）。
      }
    },
    /** 次の受理で①へ渡す段（resolveCodexServiceTier）。 */
    serviceTierFor: (/** @type {unknown} */ brainId) => resolveCodexServiceTier(brainId, enabled),
    /**
     * codex-session の onServiceTiers（model/list で読んだ今のモデルの段）を覚える。変わったら true。
     * @param {string} brainId
     * @param {unknown} serviceTiers
     */
    noteServiceTiers: (brainId, serviceTiers) => {
      const value = Array.isArray(serviceTiers) ? serviceTiers.includes("priority") : null;
      const changed = !support.has(brainId) || support.get(brainId) !== value;
      support.set(brainId, value);
      return changed;
    },
    /**
     * state snapshot の codexFast（enabled = 設定・applicable = 今の頭が Codex か・supported = priority を持つか
     * （まだ確かめていない・Claude の頭なら null））。
     * @param {unknown} brainId
     */
    codexFastStatus: (brainId) => {
      const applicable = isCodexBrainId(brainId);
      const supported = applicable && typeof brainId === "string" && support.has(brainId) ? support.get(brainId) ?? null : null;
      return { enabled, applicable, supported };
    }
  };
}
