import {
  normalizeCompactThresholdTokens,
  DEFAULT_COMPACT_THRESHOLD_TOKENS,
  DEFAULT_COMPACT_QUIET_MS,
  DEFAULT_COMPACT_MIN_INTERVAL_MS
} from "./context-compactor.mjs";

/**
 * settings の圧縮の目安（compactThresholdTokens / compactQuietSec / compactMinIntervalMin）→ 圧縮の部品の
 * options（未設定・読めなければ既定 20 万トークン / 3 秒 / 10 分・context-growth-2026-10.md §6・§8）。
 * @param {{ getContextCompaction?: () => { thresholdTokens: number | null; quietSec: number | null; minIntervalMin: number | null } }} settings
 * @returns {{ thresholdTokens: number; quietMs: number; minIntervalMs: number }}
 */
export function resolveContextCompactionOptions(settings) {
  let raw = null;
  try {
    raw = typeof settings.getContextCompaction === "function" ? settings.getContextCompaction() : null;
  } catch {
    raw = null;
  }
  return {
    thresholdTokens: normalizeCompactThresholdTokens(raw?.thresholdTokens) ?? DEFAULT_COMPACT_THRESHOLD_TOKENS,
    quietMs: raw?.quietSec != null ? raw.quietSec * 1000 : DEFAULT_COMPACT_QUIET_MS,
    minIntervalMs: raw?.minIntervalMin != null ? raw.minIntervalMin * 60_000 : DEFAULT_COMPACT_MIN_INTERVAL_MS
  };
}

/**
 * 操縦席の設定（頭脳・会話のタブ）の「圧縮を始める大きさ」を、cockpit-server の口（onSetCompactThresholdTokens /
 * contextCompactionStatus）へ橋渡しする（createBargeInHooks と同じ流儀の薄い配線層）。変えたら settings へ保存し
 * （次回起動で復元）、走っている compactor の目安をその場で差し替える（次の確認 = 数秒以内から効く）。
 * 目安の正本は compactor（サーバは二重に持たない）。
 * @param {{ setCompactThresholdTokens?: (tokens: number | null) => void }} settings
 * @param {{ getThresholdTokens: () => number; setThresholdTokens: (tokens: number) => number }} compactor
 * @returns {{ onSetCompactThresholdTokens: (tokens: number) => void; contextCompactionStatus: () => { thresholdTokens: number } }}
 */
export function createContextCompactionHooks(settings, compactor) {
  return {
    /** cockpit-server の onSetCompactThresholdTokens（POST /api/compact-threshold が呼ぶ・値は検証済み）。 */
    onSetCompactThresholdTokens: (tokens) => {
      compactor.setThresholdTokens(tokens);
      try {
        if (typeof settings.setCompactThresholdTokens === "function") settings.setCompactThresholdTokens(tokens);
      } catch {
        // 永続化失敗は操作を止めない（走っている compactor には効いている）。
      }
    },
    /** state snapshot の compaction。 */
    contextCompactionStatus: () => ({ thresholdTokens: compactor.getThresholdTokens() })
  };
}
