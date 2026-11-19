/**
 * 起動時の引っ越しの失敗を、操縦席の上の帯の警告にする（配信の組み直し Domain E・Undine の追認: ログだけでなく上の帯
 * にも出す）。失敗が無ければ空。文言は短く、詳しい行はログのタブの「起動時の知らせ」に出る。
 * @param {{ roles: { status: string }; memories: { status: string } }} result  runStartupMigration の結果。
 * @returns {Array<{ kind: string; severity: "warn" | "alert"; message: string; detail?: string | null }>}
 */
export function startupMigrationWarnings(result) {
  /** @type {Array<{ kind: string; severity: "warn" | "alert"; message: string; detail?: string | null }>} */
  const out = [];
  if (result && result.memories && result.memories.status === "failed") {
    out.push({
      kind: "memory-migration-failed",
      severity: "alert",
      message: "記憶の引っ越しに失敗した（この起動では記憶を読み書きしない）",
      detail: typeof (/** @type {any} */ (result.memories).error) === "string" ? /** @type {any} */ (result.memories).error : null
    });
  }
  if (result && result.roles && result.roles.status === "failed") {
    out.push({
      kind: "role-migration-failed",
      severity: "alert",
      message: "ロールへの引っ越しに失敗した（この起動は既定のロールで動く）",
      detail: typeof (/** @type {any} */ (result.roles).error) === "string" ? /** @type {any} */ (result.roles).error : null
    });
  }
  return out;
}
