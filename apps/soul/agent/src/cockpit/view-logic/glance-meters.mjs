// @ts-check
/**
 * view-logic: 横目で見る操縦席の計器の表示導出（preact 非依存の純関数）。
 *
 * 合意: discussion/ai-cohost/implementation/screens/cockpit-glance-redesign.md §3・§7〜§9 /
 * cockpit-glance-data-contract.md。
 *  - 遅延の棒（latencyBarView）: 長さは固定、中の区間は segments と otherMs の比（§8）。色は 8 種（凡例も 8 つ・
 *    §9.3）。合計の数字は latencyThresholds で 4 秒超を琥珀・6 秒超を赤（§9.1）。
 *  - 残量のゲージ（quotaGaugeView）: 「残り」の割合（§8）。20% 未満で琥珀・5% 未満で赤・不明は「—」（§9.2）。
 *  - 上の帯の警告（warningsView）: 異常があるときだけ（warnings の一覧・alert が先）。
 *  - 状態のピル（statusPillView）: 聞いてる / 考えてる / 喋ってる / 圧縮中（頭の会話の圧縮の最中）。
 *  - 下の帯の運転設定の表示（driveSummaryView）: 自発・口数・話し始め・忙しい間のコメント。
 *  - 配信前（isPreStream）: 耳が止まっている間は会話の場所の中央に「準備・設定を開く」。
 */

/** 残量が少ない（琥珀）の境目（残り %・cockpit/quota.mjs の QUOTA_LOW_PERCENT と同じ。UI は quota.mjs を import しない）。 */
export const QUOTA_LOW_PERCENT = 20;
/** 残量がとても少ない（赤）の境目（残り %・QUOTA_CRITICAL_PERCENT と同じ）。 */
export const QUOTA_CRITICAL_PERCENT = 5;

/** 遅延のしきい値の既定（snapshot の latencyThresholds が来るまで・§9.1）。 */
export const DEFAULT_LATENCY_THRESHOLDS = Object.freeze({ warnSec: 4, alertSec: 6 });

/**
 * 遅延の区間（棒の並び順 = 凡例の並び順・§9.3 の 8 つ）。key は latency の segments のキー（その他は otherMs）。
 * className は色（styles.mjs の .lat-seg.<className> と凡例の .legend-swatch.<className>）。
 * hint は凡例に添える区間の定義（声の差し替え Wave 2 で TTS / 声の区間が engine に依存しない定義になった:
 * TTS = 声を頼んでから最初の音のかたまりが届くまで、声 = 最初の音のかたまりから実際に鳴り始める（STARTED）まで。
 * 旧定義の「audio_query → synthesis 完了」「合成完了 → 再生開始」ではない）。
 */
export const LATENCY_SEGMENTS = Object.freeze([
  Object.freeze({ key: "transcribeMs", label: "文字起こし", className: "seg-transcribe" }),
  Object.freeze({ key: "judgeMs", label: "判定", className: "seg-judge" }),
  Object.freeze({ key: "screenMs", label: "画面", className: "seg-screen" }),
  Object.freeze({ key: "llmFirstMs", label: "LLM 最初の文字", className: "seg-llm-first" }),
  Object.freeze({ key: "firstSentenceMs", label: "最初の文", className: "seg-first-sentence" }),
  Object.freeze({ key: "ttsMs", label: "TTS", className: "seg-tts", hint: "声を頼んでから最初の音が届くまで" }),
  Object.freeze({ key: "voiceMs", label: "声", className: "seg-voice", hint: "最初の音が届いてから鳴り始めるまで" }),
  Object.freeze({ key: "otherMs", label: "その他", className: "seg-other" })
]);

/** 遅延の棒の title に添える声の engine の表示名（health.mjs の TTS_ENGINE_LABELS と同じ語彙）。 */
const VOICE_ENGINE_TITLES = Object.freeze(/** @type {Record<string, string>} */ ({ aivis: "AivisSpeech", elevenlabs: "ElevenLabs" }));

/** @param {unknown} v @returns {v is number} */
function isNum(v) {
  return typeof v === "number" && Number.isFinite(v);
}

/** 秒の表示（"1.8 秒"）。 @param {number} ms */
export function secondsText(ms) {
  return (ms / 1000).toFixed(1) + " 秒";
}

/**
 * 遅延の区分（payload の level があればそれ・無ければしきい値で決める）。
 * @param {any} rec  SSE latency のレコード。
 * @param {{ warnSec?: number; alertSec?: number } | null | undefined} thresholds
 * @returns {"ok" | "warn" | "alert" | null}
 */
export function latencyLevelOf(rec, thresholds) {
  if (!rec || !isNum(rec.totalMs)) return null;
  if (rec.level === "ok" || rec.level === "warn" || rec.level === "alert") return rec.level;
  const warnSec = thresholds && isNum(thresholds.warnSec) ? thresholds.warnSec : DEFAULT_LATENCY_THRESHOLDS.warnSec;
  const alertSec = thresholds && isNum(thresholds.alertSec) ? thresholds.alertSec : DEFAULT_LATENCY_THRESHOLDS.alertSec;
  const sec = rec.totalMs / 1000;
  if (sec > alertSec) return "alert";
  if (sec > warnSec) return "warn";
  return "ok";
}

/**
 * 遅延の棒の表示（長さ固定・区間は比）。鳴らなかった返事（totalMs が無い）は null（棒を出さない）。
 * @param {any} rec  SSE latency（{ segments, otherMs, totalMs, level, spoken }）。
 * @param {{ warnSec?: number; alertSec?: number } | null | undefined} [thresholds]
 * @returns {{ parts: Array<{ key: string; className: string; percent: number }>; totalText: string;
 *   levelClassName: string; title: string } | null}
 */
export function latencyBarView(rec, thresholds) {
  if (!rec || !isNum(rec.totalMs)) return null;
  const segs = rec.segments && typeof rec.segments === "object" ? rec.segments : {};
  /** @type {Array<{ key: string; className: string; label: string; ms: number }>} */
  const present = [];
  for (const s of LATENCY_SEGMENTS) {
    const ms = s.key === "otherMs" ? rec.otherMs : segs[s.key];
    if (isNum(ms) && ms > 0) present.push({ key: s.key, className: s.className, label: s.label, ms });
  }
  const sum = present.reduce((a, p) => a + p.ms, 0);
  const parts = sum > 0
    ? present.map((p) => ({ key: p.key, className: p.className, percent: Math.round((p.ms / sum) * 1000) / 10 }))
    : [];
  const level = latencyLevelOf(rec, thresholds);
  return {
    parts,
    totalText: secondsText(rec.totalMs),
    levelClassName: "lat-total" + (level === "warn" ? " warn" : level === "alert" ? " alert" : ""),
    // 鳴らした声の engine（latency の voice・声の差し替え Wave 3）があれば添える（TTS / 声の区間を engine ごとに見比べる）。
    title:
      present.map((p) => p.label + " " + (p.ms / 1000).toFixed(2) + " 秒").join(" / ") +
      (typeof rec.voice === "string" && rec.voice ? "（声: " + (VOICE_ENGINE_TITLES[rec.voice] ?? rec.voice) + "）" : "") +
      // その返事を Codex の fast（service tier "priority"）で頼んだなら小さく添える（fast の比較の材料）。
      (rec.serviceTier === "priority" ? "（fast）" : "")
  };
}

/**
 * 残量のゲージの表示（「残り」の割合）。
 * @param {string} label  "Codex 週" / "ElevenLabs 月"
 * @param {{ remainingPercent?: number | null; resetsAtMs?: number | null } | null | undefined} q
 * @returns {{ label: string; valueText: string; percent: number | null; className: string; title: string }}
 */
export function quotaGaugeView(label, q) {
  if (!q || !isNum(q.remainingPercent)) {
    return { label, valueText: "—", percent: null, className: "gauge unknown", title: label + ": 不明" };
  }
  const r = Math.max(0, Math.min(100, q.remainingPercent));
  const level = r < QUOTA_CRITICAL_PERCENT ? " critical" : r < QUOTA_LOW_PERCENT ? " low" : "";
  const reset = isNum(q.resetsAtMs) ? "・リセット " + resetText(q.resetsAtMs) : "";
  return {
    label,
    valueText: Math.floor(r) + "%",
    percent: r,
    className: "gauge" + level,
    title: label + " 残り " + r.toFixed(1) + "%" + reset
  };
}

/** リセット時刻の短い表示（ローカルの M/D HH:MM）。 @param {number} ms */
function resetText(ms) {
  const d = new Date(ms);
  const pad = (/** @type {number} */ n) => (n < 10 ? "0" : "") + n;
  return d.getMonth() + 1 + "/" + d.getDate() + " " + pad(d.getHours()) + ":" + pad(d.getMinutes());
}

/** 上の帯に並べる警告の数（それ以上は「+N」にまとめる）。 */
export const WARNINGS_SHOWN = 3;

/**
 * 上の帯の警告の表示（異常があるときだけ・alert が先・期限を過ぎた出来事は落とす）。
 * @param {any[] | null | undefined} list  snapshot / SSE warnings の一覧。
 * @param {number} nowMs
 * @returns {{ items: Array<{ key: string; text: string; className: string; title: string }>; moreText: string | null;
 *   moreTitle: string }}
 */
export function warningsView(list, nowMs) {
  const live = (Array.isArray(list) ? list : []).filter(
    (w) => w && typeof w.message === "string" && !(isNum(w.expiresAtMs) && w.expiresAtMs <= nowMs)
  );
  const sorted = [...live.filter((w) => w.severity === "alert"), ...live.filter((w) => w.severity !== "alert")];
  const toItem = (/** @type {any} */ w) => ({
    key: String(w.id ?? w.kind ?? w.message),
    text: w.message + (isNum(w.count) && w.count > 1 ? " ×" + w.count : ""),
    className: "warn-chip " + (w.severity === "alert" ? "alert" : "warn"),
    title: typeof w.detail === "string" && w.detail ? w.detail : w.message
  });
  const items = sorted.slice(0, WARNINGS_SHOWN).map(toItem);
  const rest = sorted.slice(WARNINGS_SHOWN);
  return {
    items,
    moreText: rest.length > 0 ? "+" + rest.length : null,
    moreTitle: rest.map((w) => w.message).join(" / ")
  };
}

/**
 * 状態のピル（聞いてる / 考えてる / 喋ってる / 圧縮中）。耳が止まっている間に暇なら「止まってる」（配信前）。
 * 優先順位: 喋ってる > 圧縮中 > 考えてる > （場の）始めてる・記録中 > 聞いてる > 起動中 > 止まってる。圧縮中に届いた発火は圧縮の終わりまで
 * （最大 60 秒）待たされるので、その間は「考えてる」ではなく「圧縮中」を見せる（2026-10-18 合意）。
 * @param {string | null | undefined} soul  SSE soul の state。
 * @param {string | null | undefined} ears  snapshot の ears。
 * @param {boolean | null | undefined} [compacting]  snapshot の compacting（頭の会話の圧縮の最中か）。
 * @param {{ phase?: string } | null | undefined} [stream]  snapshot の stream（配信の組み直し Domain E: 考えてる の次に
 *   開きかけ「始めてる」・閉じかけ「記録中」を出す。開いている・閉じている・無いときは今のまま）。
 * @returns {{ text: string; className: string }}
 */
export function statusPillView(soul, ears, compacting, stream) {
  if (soul === "speaking") return { text: "喋ってる", className: "status-pill speaking" };
  if (compacting === true) return { text: "圧縮中", className: "status-pill compacting" };
  if (soul === "thinking") return { text: "考えてる", className: "status-pill thinking" };
  // 配信の組み直し Domain E: 場の開きかけ・閉じかけ（記憶の最後の保存を待つ間）だけ場の状態を出す（それ以外は今のまま）。
  const phase = stream && typeof stream.phase === "string" ? stream.phase : null;
  if (phase === "opening") return { text: "始めてる", className: "status-pill starting" };
  if (phase === "closing") return { text: "記録中", className: "status-pill recording" };
  if (ears === "listening") return { text: "聞いてる", className: "status-pill listening" };
  if (ears === "starting") return { text: "起動中", className: "status-pill starting" };
  return { text: "止まってる", className: "status-pill stopped" };
}

/**
 * 場の状態（配信の組み直し Domain D・snapshot の stream.phase）。stream を持たない古いサーバは耳の状態から読む
 * （聞いている・起動中 = 開いている）。
 * @param {{ phase?: string } | null | undefined} stream
 * @param {string | null | undefined} [ears]
 * @returns {"closed" | "opening" | "open" | "closing"}
 */
export function streamPhaseOf(stream, ears) {
  const phase = stream && typeof stream.phase === "string" ? stream.phase : null;
  if (phase === "closed" || phase === "opening" || phase === "open" || phase === "closing") return phase;
  return ears === "listening" || ears === "starting" ? "open" : "closed";
}

/**
 * 配信前か（メイン画面の中央に「配信を始める」を出す間）。配信の組み直し Domain D: stream を渡せば場が開いていない間
 * （閉じている・開きかけ・閉じかけ）。stream を渡さなければ今までどおり耳が止まっている間（起動中は配信前に数えない）。
 * @param {string | null | undefined} ears
 * @param {{ phase?: string } | null} [stream]
 */
export function isPreStream(ears, stream) {
  if (stream === undefined) return ears !== "listening" && ears !== "starting";
  return streamPhaseOf(stream, ears) !== "open";
}

/**
 * 場が開いていない間のメイン画面の中央（配信の組み直し Domain D・stream-restructure.md §6）。閉じているときは「配信を始める」
 * （押せる）と始められなかった理由、開きかけは押せない「配信を始めています…」、閉じかけ（記憶の最後の保存を待つ間）は
 * 押せない「配信を終えています…」と「記録中…」。「準備・設定」はいつも横に出す（描く側）。
 * @param {{ phase?: string; error?: string | null } | null | undefined} stream  snapshot の stream。
 * @param {string} [requestError]  始めるの要求そのものの失敗（通信の失敗・409 など・サーバの stream.error に残らないもの）。
 * @returns {{ phase: "closed" | "opening" | "open" | "closing"; startText: string; startDisabled: boolean; noteText: string; errorText: string }}
 */
export function streamStartView(stream, requestError = "") {
  const phase = streamPhaseOf(stream, null);
  const serverError = stream && typeof stream.error === "string" ? stream.error : "";
  return {
    phase,
    startText: phase === "opening" ? "配信を始めています…" : phase === "closing" ? "配信を終えています…" : "配信を始める",
    startDisabled: phase !== "closed",
    noteText: phase === "closing" ? "記録中…" : "",
    errorText: phase === "closed" ? requestError || serverError : ""
  };
}

/**
 * 下の帯の「配信を終える」（配信の組み直し Domain D）。場が開いている間だけ出す。誤って押しにくいよう、1 回目の押下で
 * 「もう一度押すと配信を終える」に変わり（armed）、続けて押したときだけ終える（描く側が数秒で armed を戻す）。
 * @param {{ phase?: string } | null | undefined} stream
 * @param {boolean} armed
 * @returns {{ show: boolean; text: string; className: string }}
 */
export function endStreamButtonView(stream, armed) {
  const show = streamPhaseOf(stream, null) === "open";
  return {
    show,
    text: armed ? "もう一度押すと配信を終える" : "配信を終える",
    className: "stream-end" + (armed ? " armed" : "")
  };
}

/** 口数の表示名（運転タブの選択肢もここから作る）。 */
export const VERBOSITY_LABELS = Object.freeze({ quiet: "控えめ", normal: "ふつう", chatty: "おしゃべり" });
/** 話し始めの表示名。 */
export const SPEAK_START_LABELS = Object.freeze({ classic: "従来", "speak-now": "speak-now" });
/** 忙しい間のコメントの表示名。 */
export const COMMENT_BUSY_LABELS = Object.freeze({ hold: "あとで拾う", drop: "見逃す" });

/**
 * 下の帯の運転設定の表示（自発・口数・話し始め・忙しい間のコメント）。使えない（null）は「—」。
 * @param {{ selfFire?: { enabled?: boolean } | null; verbosity?: string | null; speakStart?: string | null;
 *   commentBusy?: string | null } | null | undefined} settings
 * @returns {Array<{ label: string; value: string }>}
 */
export function driveSummaryView(settings) {
  const s = settings || {};
  const pick = (/** @type {Record<string, string>} */ labels, /** @type {any} */ v) =>
    typeof v === "string" ? labels[v] ?? v : "—";
  // 配信の組み直し Domain E: 口数・話し始めはロールの値（snapshot の role.verbosity / role.speakStartMode）。ロールが
  // 持っていない古いサーバは今までどおり scheduler の現況（verbosity / speakStart）。
  const role = /** @type {any} */ (s).role;
  const verbosity = role && typeof role.verbosity === "string" ? role.verbosity : s.verbosity;
  const speakStart = role && typeof role.speakStartMode === "string" ? role.speakStartMode : s.speakStart;
  return [
    { label: "自発", value: s.selfFire ? (s.selfFire.enabled ? "ON" : "OFF") : "—" },
    { label: "口数", value: pick(VERBOSITY_LABELS, verbosity) },
    { label: "話し始め", value: pick(SPEAK_START_LABELS, speakStart) },
    { label: "忙しい間のコメント", value: pick(COMMENT_BUSY_LABELS, s.commentBusy) }
  ];
}
