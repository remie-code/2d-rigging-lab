import { isCodexBrainId } from "../../mind/brains.mjs";
import { compactionUsageRecord } from "../../mind/session-usage-log.mjs";
import { resolveLatencyThresholds } from "../../mind/fire-latency.mjs";
import { MCP_CONFIG_READ_FAILED_WARNING } from "../../mind/codex-session.mjs";

/**
 * Codex の頭の警告が「MCP の名前の読み取り（config/read）に失敗した」ものか（codex-session.mjs の
 * MCP_CONFIG_READ_FAILED_WARNING との一致で判定する・文言の一部の一致はやめた＝Wave 2 からの申し送り 2）。
 * 操縦席の上の帯に alert として出す（ユーザー決定 2026-10-21: 続けるが目立たせる）。
 * @param {unknown} warning
 * @returns {boolean}
 */
export function isMcpConfigReadFailureWarning(warning) {
  return warning === MCP_CONFIG_READ_FAILED_WARNING;
}

/**
 * 思い出しの係の出来事のターミナル 1 行（記憶の作り直し Wave 3・頼みごと・記憶の中身は書かない）。
 * @param {{ phase?: string; avoidProbability?: number | null; judgeFailed?: boolean; reason?: string | null; silent?: boolean; failed?: boolean }} event
 * @returns {string}
 */
export function formatRecallEventLine(event) {
  const parts = [`[cockpit] recall: ${typeof event?.phase === "string" ? event.phase : "?"}`];
  if (typeof event?.avoidProbability === "number" && Number.isFinite(event.avoidProbability)) {
    parts.push(`avoid=${event.avoidProbability.toFixed(2)}`);
  }
  if (event?.judgeFailed === true) parts.push("judge=error");
  if (typeof event?.reason === "string" && event.reason.length > 0) parts.push(`reason=${event.reason}`);
  // Wave 3 仕上げ: 自発 OFF で黙って渡した（silent）・④の失敗を届けた（failed）。
  if (event?.silent === true) parts.push("silent");
  if (event?.failed === true) parts.push("failed");
  return `${parts.join(" ")}\n`;
}

/**
 * 文字起こしの遅延ログ 1 行（操縦席の標準出力・数字だけ・文字起こし本文は書かない）。
 * 物差しは whisper が「speechEnd → 転写到着」、ElevenLabs が「直前の commit 以降で最後の speechEnd →
 * commit 到着」（ear-pipeline.mjs）。物差しが無い commit（直前の commit 以降に speechEnd が無い）は "-"。
 * @param {{ engine: string; latencyMs: number | null }} info
 * @returns {string}
 */
export function formatSttLatencyLine(info) {
  const ms = typeof info.latencyMs === "number" && Number.isFinite(info.latencyMs) ? String(Math.round(info.latencyMs)) : "-";
  return `[cockpit] stt latency: engine=${info.engine} ms=${ms}\n`;
}

/**
 * 画面キャプチャの撮る係（常駐 PowerShell・src/eyes/resident-capture.mjs）の記録 1 行（操縦席の標準出力）。
 * 数字と種類だけ（窓タイトル・画像は書かない）。撮影 1 回ごとの `capture:` 行の ms が撮影の待ち時間
 * （via=resident が撮る係・via=spawn が毎回起動に戻った回。fallback= は戻った理由）。
 * @param {import("../../eyes/resident-capture.mjs").ResidentCaptureEvent} event
 * @returns {string}
 */
export function formatCaptureEventLine(event) {
  const ms = (/** @type {unknown} */ value) =>
    typeof value === "number" && Number.isFinite(value) ? String(Math.round(value)) : "-";
  switch (event.type) {
    case "capture": {
      const result = event.ok ? "ok" : (event.kind ?? "error");
      const fallback = event.via === "spawn" && event.fallbackReason ? ` fallback=${event.fallbackReason}` : "";
      return `[cockpit] capture: via=${event.via} ms=${ms(event.elapsedMs)} result=${result}${fallback}\n`;
    }
    case "starting":
      return "[cockpit] capture helper: starting\n";
    case "ready":
      return `[cockpit] capture helper: ready ms=${ms(event.startupMs)}\n`;
    case "exited":
      return `[cockpit] capture helper: exited code=${event.code ?? "-"} restart=${event.willRestart ? "yes" : "no"} reason=${event.reason}\n`;
    case "gaveUp":
      return `[cockpit] capture helper: gave up after ${event.failures} failed starts (captures use one-shot powershell until next ears Start)\n`;
    case "stopped":
      return "[cockpit] capture helper: stopped\n";
    default:
      return "";
  }
}

/**
 * コメント判定のログ 1 行（操縦席の標準出力・コメント反応の合意 §3「遅延・判定結果」。コメント本文は書かない）。
 * 弾く判定（stage:"guard"）: 遅延・ID・通した/弾いた（種類）・4 択の選択・乗っ取りの確率・判定できなかった理由。
 * 反応する判定（stage:"react"）: 遅延・ID・選択・確率・行き先・きっかけ。判定しなかったコメントは行き先だけ。
 * @param {any} info  cockpit-server の onCommentJudgment が渡す記録。
 * @returns {string}
 */
export function formatCommentJudgmentLine(info) {
  const ms = typeof info?.latencyMs === "number" && Number.isFinite(info.latencyMs) ? String(Math.round(info.latencyMs)) : "-";
  const id = info?.commentId ?? "-";
  if (info?.stage === "guard") {
    const action = info.pass ? "pass" : `reject:${info.kind ?? "error"}`;
    const reason = info.pass || !info.error ? "" : ` reason=${info.error}`;
    return (
      `[cockpit] comment-guard: ms=${ms} id=${id} action=${action} verdict=${info.verdict ?? "-"} ` +
      `hijack=${fmtProb(info.hijackProbability)}${reason}\n`
    );
  }
  if (info?.skipped) return `[cockpit] comment-react: id=${id} action=${info.action ?? "-"}\n`;
  if (!info || info.ok !== true) {
    return `[cockpit] comment-react: error ms=${ms} id=${id} trigger=${info?.trigger ?? "-"} reason=${info?.error ?? "unknown"}\n`;
  }
  return (
    `[cockpit] comment-react: ms=${ms} id=${id} choice=${info.choice} p=${fmtProb(info.probability)} ` +
    `action=${info.action ?? "-"} trigger=${info.trigger ?? "-"}\n`
  );
}

/** @param {unknown} v */
function fmtProb(v) {
  return typeof v === "number" && Number.isFinite(v) ? v.toFixed(2) : "-";
}

/**
 * speak-now の判定ログ 1 行（操縦席の標準出力・合意 §5「遅延・選択・確率」。会話の本文は書かない）。
 * 成功: 遅延・選択・その確率・行き先（fire / drop-busy / drop-inactive / skip-interval / none）・きっかけ・全選択肢の確率。
 * skip-interval は相槌どうしの歯止めで流した相槌（backchannel.md §2・フィードには判定行だけ）。
 * 失敗: 遅延（分かれば）・きっかけ・理由（キー欠落・タイムアウト等。キー値は judge 側で含めない）。
 * @param {any} info  cockpit-server の onSpeakNowJudgment が渡す記録。
 * @returns {string}
 */
export function formatSpeakNowLine(info) {
  const ms = typeof info?.latencyMs === "number" && Number.isFinite(info.latencyMs) ? String(Math.round(info.latencyMs)) : "-";
  const trigger = info?.trigger ?? "-";
  if (!info || info.ok !== true) {
    return `[cockpit] speak-now: error ms=${ms} trigger=${trigger} reason=${info?.error ?? "unknown"}\n`;
  }
  const probs = info.probs && typeof info.probs === "object" ? info.probs : {};
  const all = ["wait", "backchannel", "respond", "initiate", "look"].map((k) => `${k}:${fmtProb(probs[k])}`).join(",");
  return (
    `[cockpit] speak-now: ms=${ms} choice=${info.choice} p=${fmtProb(info.probability)} ` +
    `action=${info.action ?? "-"} trigger=${trigger} probs=${all}\n`
  );
}

/**
 * Codex の使用率の読み口（残量の監視が呼ぶ）。頭が Codex で、今のセッションが App Server を持つ
 * （readRateLimits がある）ときだけ読む。それ以外は null（不明）。セッションは起動していなければ自分で null を返す
 * （読むためだけに App Server を起こさない）。
 * @param {{ getBrain: () => string; getSession: () => any }} deps
 * @returns {() => Promise<any | null>}
 */
export function createCodexQuotaReader(deps) {
  return async () => {
    if (!isCodexBrainId(deps.getBrain())) return null;
    const session = deps.getSession();
    if (!session || typeof session.readRateLimits !== "function") return null;
    return session.readRateLimits();
  };
}

/**
 * settings の遅延の「遅い」しきい値（latencyWarnSec / latencyAlertSec）→ cockpit-server の latencyThresholds
 * （未設定・読めなければ既定 4 / 6 秒）。
 * @param {{ getLatencyThresholds?: () => { warnSec: number | null; alertSec: number | null } }} settings
 * @returns {{ warnSec: number; alertSec: number }}
 */
export function resolveLatencyThresholdsFromSettings(settings) {
  let raw = null;
  try {
    raw = typeof settings.getLatencyThresholds === "function" ? settings.getLatencyThresholds() : null;
  } catch {
    raw = null;
  }
  return resolveLatencyThresholds({ warnSec: raw?.warnSec ?? undefined, alertSec: raw?.alertSec ?? undefined });
}

/**
 * 圧縮の開始・終了の記録 1 行（session-usage/）。compactionUsageRecord の形（ratio = 窓に対する割合・
 * lastInputTokens・totalInputTokens・modelContextWindow）に、開始のときだけそのときの目安 thresholdTokens を足す
 * （目安は操縦席から変えられるので、記録の行だけで「どの目安で走ったか」が読めるように・追加のキーだけ）。
 * @param {any} event  context-compactor の onEvent。
 * @param {string | null} brain
 * @returns {Record<string, unknown>}
 */
export function contextCompactionUsageRecord(event, brain) {
  const record = compactionUsageRecord(event, brain);
  if (event?.type !== "started") return record;
  return { ...record, thresholdTokens: typeof event.thresholdTokens === "number" ? event.thresholdTokens : null };
}

/**
 * 頭の会話の圧縮の開始・終了のターミナル 1 行（数字と理由だけ・本文は書かない）。開始は量（直近の入力トークンと
 * そのときの目安）を主に、窓に対する割合を参考で添える。
 * @param {any} event  context-compactor の onEvent。
 * @returns {string}
 */
export function formatContextCompactionLine(event) {
  if (event?.type === "started") {
    const pct = typeof event.ratio === "number" ? `${Math.round(event.ratio * 100)}%` : "-";
    return (
      `[cockpit] context compaction started: last input ${event.lastInputTokens ?? "-"} tokens > threshold ${event.thresholdTokens ?? "-"} ` +
      `(${pct} of window ${event.modelContextWindow ?? "-"}, total ${event.totalInputTokens ?? "-"})\n`
    );
  }
  const secs = typeof event?.durationMs === "number" ? `${(event.durationMs / 1000).toFixed(1)}s` : "-";
  if (event?.ok === true) {
    const persona = event.personaInjected ? "persona re-injected" : event.personaDeferred ? "persona deferred to next turn" : "persona not injected";
    return `[cockpit] context compaction finished: ${secs} (${persona})\n`;
  }
  return `[cockpit] context compaction failed: ${secs} reason=${event?.reason ?? "unknown"}${event?.message ? ` — ${event.message}` : ""}\n`;
}

/**
 * 返事の遅延のログ 1 行（操縦席の標準出力・数字ときっかけの種類だけ・本文は書かない）。
 * @param {any} record  cockpit-server の onReplyLatency が渡すレコード。
 * @returns {string}
 */
export function formatReplyLatencyLine(record) {
  const ms = (/** @type {unknown} */ v) => (typeof v === "number" && Number.isFinite(v) ? String(Math.round(v)) : "-");
  const seg = record && record.segments ? record.segments : {};
  const cause = record && record.cause && typeof record.cause.type === "string" ? record.cause.type : "-";
  return (
    `[cockpit] latency: fire=${record?.fireId ?? "-"} cause=${cause} total=${ms(record?.totalMs)} level=${record?.level ?? "-"} ` +
    `stt=${ms(seg.transcribeMs)} judge=${ms(seg.judgeMs)} screen=${ms(seg.screenMs)} llm=${ms(seg.llmFirstMs)} ` +
    `sentence=${ms(seg.firstSentenceMs)} tts=${ms(seg.ttsMs)} voice=${ms(seg.voiceMs)} other=${ms(record?.otherMs)}` +
    `${typeof record?.voice === "string" ? ` voiceEngine=${record.voice}` : ""}` +
    `${record?.spoken === false ? " spoken=no" : ""}` +
    // 体なしの返事（声の区間に器の往復が入らない・配信の組み直し Domain C）。体があるときは今と同じ行。
    `${record?.bodyless === true ? " body=none" : ""}\n`
  );
}
