// @ts-check
/**
 * 咳払いの聞き取り実験（段階 1）の純関数 — apps/soul/agent。
 *
 * 計画: discussion/ai-cohost/implementation/orchestration/cough-experiment-plan.md §3。
 * 調査: discussion/ai-cohost/research/cough-filter-audio-tagging-2026-11.md §1〜§3・§7。
 *
 * **sherpa-onnx-node を import しない**（親の道具 `cough-experiment.mjs` と実験の子の中身
 * `cough-experiment-worker-core.mjs` の両方から読む。sherpa を読むのは実験の子の入口
 * `cough-experiment-worker.mjs` だけ）。音のサンプルは扱うが、ファイルには書かない（記録の形は数と文字だけ）。
 *
 * 中身:
 *  - 音の種類の判定（CED-tiny int8）のモデルの置き場・存在の確かめ・設定・結果の要約・無音でのばす
 *  - 合図（4 種類 × 10 回を混ぜた順）
 *  - 合図の進め方（区間を合図に結びつける・区間なし・複数）の状態機械
 *  - 記録の 1 行の形・終わりのまとめ
 */

import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { DEFAULT_LOCAL_STT_MODELS_DIR, LOCAL_STT_SAMPLE_RATE } from "../src/ears/local-stt/local-stt-engines.mjs";

// ── 音の種類の判定（CED-tiny）のモデル ───────────────────────────────────────

/**
 * CED-tiny（int8）の置き場（`vendor/models/` の下・git 外）。取得は
 * `scripts/fetch-local-stt-models.mjs --only ced-tiny`（配布元 k2-fsa/sherpa-onnx の Releases `audio-tagging-models`
 * の `sherpa-onnx-ced-tiny-audio-tagging-2024-04-19.tar.bz2` から 2 つだけ取り出す）。
 */
export const CED_TINY_MODEL_LAYOUT = Object.freeze({
  dir: "ced-tiny-audio-tagging-2024-04-19-int8",
  files: Object.freeze({ model: "model.int8.onnx", labels: "class_labels_indices.csv" })
});

/** 取得のコマンド（モデルが無いときに 1 行で出す）。 */
export const CED_TINY_FETCH_COMMAND = "node apps/soul/agent/scripts/fetch-local-stt-models.mjs --only ced-tiny";

/**
 * @param {{ modelsDir?: string }} [opts]
 * @returns {{ dir: string; files: { model: string; labels: string } }}
 */
export function resolveCedTinyModel(opts = {}) {
  const dir = path.join(opts.modelsDir ?? DEFAULT_LOCAL_STT_MODELS_DIR, CED_TINY_MODEL_LAYOUT.dir);
  return {
    dir,
    files: {
      model: path.join(dir, CED_TINY_MODEL_LAYOUT.files.model),
      labels: path.join(dir, CED_TINY_MODEL_LAYOUT.files.labels)
    }
  };
}

/**
 * CED-tiny が揃っているか（無ければ取得の仕方を含む 1 行の理由）。
 * @param {{ modelsDir?: string; existsImpl?: (p: string) => boolean }} [opts]
 * @returns {{ ok: true } | { ok: false; reason: string; missing: string[] }}
 */
export function checkCedTinyModel(opts = {}) {
  const existsImpl = opts.existsImpl ?? fileHasBytes;
  const { dir, files } = resolveCedTinyModel(opts);
  const missing = Object.values(files).filter((p) => !existsImpl(p));
  if (missing.length === 0) return { ok: true };
  const names = missing.map((p) => path.basename(p)).join(", ");
  return {
    ok: false,
    missing,
    reason: `CED-tiny（音の種類の判定）のモデルが見つからない（${dir} に ${names} が無い）。\`${CED_TINY_FETCH_COMMAND}\` で取得できる`
  };
}

/** @param {string} p */
function fileHasBytes(p) {
  try {
    return existsSync(p) && statSync(p).isFile() && statSync(p).size > 0;
  } catch {
    return false;
  }
}

/** AudioSet のラベルの番号（調査 §3・class_labels_indices.csv）。 */
export const AUDIO_TAGGING_LABEL_INDEX = Object.freeze({ speech: 0, cough: 47, throatClearing: 48 });

/** AudioSet の種類の数（ラベルの表が読めないときの既定）。 */
export const AUDIOSET_CLASS_COUNT = 527;

/** 判定に渡す前にのばす長さ（調査 §1・§7: 1 秒未満のまま渡すと壊れる・2 秒は揺れた・5 秒で意味のある結果）。 */
export const AUDIO_TAGGING_TARGET_MS = 5000;

/**
 * class_labels_indices.csv の本文 → ラベルの数（見出しの行を除く空でない行）。
 * @param {string} text
 * @returns {number}
 */
export function countLabels(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const body = lines.length > 0 && /^index\s*,/i.test(lines[0]) ? lines.slice(1) : lines;
  return body.length;
}

/**
 * sherpa の AudioTagging の設定（CED）。
 * @param {{ model: string; labels: string }} files
 * @param {{ threads: number; topK: number }} opts
 * @returns {Record<string, any>}
 */
export function buildAudioTaggingConfig(files, opts) {
  return {
    model: { ced: files.model, numThreads: opts.threads, provider: "cpu", debug: 0 },
    labels: files.labels,
    topK: opts.topK
  };
}

/**
 * 前後に同じだけ作り物の無音（0）を足して targetMs にのばす（もとから長ければそのまま）。
 * @param {Float32Array} samples
 * @param {number} [targetMs=AUDIO_TAGGING_TARGET_MS]
 * @param {number} [sampleRate=16000]
 * @returns {Float32Array}
 */
export function padToDuration(samples, targetMs = AUDIO_TAGGING_TARGET_MS, sampleRate = LOCAL_STT_SAMPLE_RATE) {
  if (!(samples instanceof Float32Array)) throw new TypeError("padToDuration: samples must be a Float32Array");
  const target = Math.max(0, Math.round((targetMs / 1000) * sampleRate));
  if (samples.length >= target) return samples;
  const out = new Float32Array(target);
  out.set(samples, Math.floor((target - samples.length) / 2));
  return out;
}

/**
 * @typedef {{ speech: number; cough: number; throatClearing: number; topLabel: string | null; topIndex: number | null; topProb: number | null }} TagSummary
 */

/**
 * AudioTagging.compute の結果（`[{ name, prob, index }]`）→ 記録に要る数だけ。番号で引く（表記の揺れに左右されない）。
 * 結果に無い番号は 0（topK で切られた = 上位に入らなかった）。
 * @param {Array<{ name?: unknown; prob?: unknown; index?: unknown }>} events
 * @returns {TagSummary}
 */
export function summarizeAudioEvents(events) {
  const list = Array.isArray(events) ? events : [];
  /** @param {number} index */
  const probOf = (index) => {
    const e = list.find((x) => x && x.index === index);
    return e && typeof e.prob === "number" && Number.isFinite(e.prob) ? e.prob : 0;
  };
  /** @type {{ name: string; prob: number; index: number } | null} */
  let top = null;
  for (const e of list) {
    if (!e || typeof e.prob !== "number" || !Number.isFinite(e.prob)) continue;
    if (top === null || e.prob > top.prob) {
      top = { name: typeof e.name === "string" ? e.name : String(e.name), prob: e.prob, index: typeof e.index === "number" ? e.index : -1 };
    }
  }
  return {
    speech: probOf(AUDIO_TAGGING_LABEL_INDEX.speech),
    cough: probOf(AUDIO_TAGGING_LABEL_INDEX.cough),
    throatClearing: probOf(AUDIO_TAGGING_LABEL_INDEX.throatClearing),
    topLabel: top ? top.name : null,
    topIndex: top ? top.index : null,
    topProb: top ? top.prob : null
  };
}

/**
 * 子から来た判定の結果を記録に要る形へ（数と短い文字列だけを通す・音やほかの欄は通さない）。
 * @param {any} msg
 * @returns {TagSummary | null}
 */
export function sanitizeTagMessage(msg) {
  if (!msg || typeof msg !== "object" || msg.error) return null;
  const num = (/** @type {unknown} */ v) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  const speech = num(msg.speech);
  const cough = num(msg.cough);
  const throatClearing = num(msg.throatClearing);
  if (speech === null || cough === null || throatClearing === null) return null;
  return {
    speech,
    cough,
    throatClearing,
    topLabel: typeof msg.topLabel === "string" ? msg.topLabel.slice(0, 80) : null,
    topIndex: num(msg.topIndex),
    topProb: num(msg.topProb)
  };
}

// ── 合図 ─────────────────────────────────────────────────────────────

/** 合図の種類（計画 §1: 咳払い・「うん」・「うーん」・軽い咳）。 */
export const CUE_KINDS = Object.freeze([
  Object.freeze({ id: "throat_clear", label: "咳払い", prompt: "咳払いを 1 回してください" }),
  Object.freeze({ id: "un", label: "「うん」", prompt: "「うん」と 1 回言ってください" }),
  Object.freeze({ id: "uun", label: "「うーん」", prompt: "「うーん」と 1 回言ってください" }),
  Object.freeze({ id: "light_cough", label: "軽い咳", prompt: "軽い咳を 1 回してください" })
]);

/** 1 種類あたりの回数の既定（計画 §1）。 */
export const CUES_PER_KIND = 10;

/**
 * @typedef {{ seq: number; total: number; kind: string; label: string; prompt: string; round: number }} Cue
 */

/**
 * 合図の順（各種類 perKind 回を Fisher–Yates で混ぜる・乱数は注入）。seq は通し番号（1 から）、round はその種類の何回目か。
 * @param {{ perKind?: number; rng?: () => number; kinds?: ReadonlyArray<{ id: string; label: string; prompt: string }> }} [opts]
 * @returns {Cue[]}
 */
export function buildCuePlan(opts = {}) {
  const perKind = opts.perKind ?? CUES_PER_KIND;
  const rng = opts.rng ?? Math.random;
  const kinds = opts.kinds ?? CUE_KINDS;
  if (!(Number.isInteger(perKind) && perKind >= 1)) throw new RangeError(`buildCuePlan: perKind must be a positive integer; got ${perKind}`);
  /** @type {Array<{ id: string; label: string; prompt: string }>} */
  const bag = [];
  for (const k of kinds) for (let i = 0; i < perKind; i += 1) bag.push(k);
  for (let i = bag.length - 1; i > 0; i -= 1) {
    const r = rng();
    const j = Math.min(i, Math.max(0, Math.floor(r * (i + 1))));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  /** @type {Record<string, number>} */
  const rounds = {};
  return bag.map((k, i) => {
    rounds[k.id] = (rounds[k.id] ?? 0) + 1;
    return { seq: i + 1, total: bag.length, kind: k.id, label: k.label, prompt: k.prompt, round: rounds[k.id] };
  });
}

/**
 * 再現できる乱数（mulberry32・テストや --seed 用）。
 * @param {number} seed
 * @returns {() => number}
 */
export function seededRng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── 記録 ─────────────────────────────────────────────────────────────

/**
 * 文字数（空白を除いたコードポイントの数）。
 * @param {string} text
 */
export function countChars(text) {
  return [...String(text).replace(/\s+/g, "")].length;
}

/**
 * @typedef {{
 *   cue: string; cueLabel: string; round: number; seq: number;
 *   outcome: "segment" | "no_segment" | "failed";
 *   text: string | null; chars: number | null; durationMs: number | null;
 *   speech: number | null; cough: number | null; throatClearing: number | null;
 *   topLabel: string | null; topProb: number | null;
 *   reason?: string;
 *   at: string;
 * }} ExperimentRecord
 */

/**
 * @typedef {{ outcome: "segment"; text: string; durationMs: number; tags: TagSummary | null }
 *   | { outcome: "failed"; durationMs: number | null; reason: string }} SegmentResult
 */

/**
 * 記録の 1 行（音は持たない: 文字・数・時刻だけ）。
 * @param {Cue} cue
 * @param {SegmentResult | { outcome: "no_segment" }} result
 * @param {Date} at
 * @returns {ExperimentRecord}
 */
export function buildRecord(cue, result, at) {
  /** @type {ExperimentRecord} */
  const rec = {
    cue: cue.kind,
    cueLabel: cue.label,
    round: cue.round,
    seq: cue.seq,
    outcome: result.outcome,
    text: null,
    chars: null,
    durationMs: null,
    speech: null,
    cough: null,
    throatClearing: null,
    topLabel: null,
    topProb: null,
    at: at.toISOString()
  };
  if (result.outcome === "segment") {
    const text = String(result.text ?? "").trim();
    rec.text = text;
    rec.chars = countChars(text);
    rec.durationMs = Math.round(result.durationMs);
    if (result.tags) {
      rec.speech = round4(result.tags.speech);
      rec.cough = round4(result.tags.cough);
      rec.throatClearing = round4(result.tags.throatClearing);
      rec.topLabel = result.tags.topLabel;
      rec.topProb = result.tags.topProb === null ? null : round4(result.tags.topProb);
    }
  } else if (result.outcome === "failed") {
    rec.durationMs = typeof result.durationMs === "number" && Number.isFinite(result.durationMs) ? Math.round(result.durationMs) : null;
    rec.reason = result.reason;
  }
  return rec;
}

/** @param {number} v */
function round4(v) {
  return Math.round(v * 10000) / 10000;
}

/**
 * 結果のファイルの名前（ローカルの日時・`2026-11-06T21-05-09.jsonl`）。
 * @param {Date} date
 */
export function experimentFileName(date) {
  const p = (/** @type {number} */ n) => String(n).padStart(2, "0");
  return (
    `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}` +
    `T${p(date.getHours())}-${p(date.getMinutes())}-${p(date.getSeconds())}.jsonl`
  );
}

// ── 合図の進め方（状態機械・時計は注入）──────────────────────────────────────

/**
 * @typedef {{ cueTimeoutMs: number; settleMs: number; maxCueMs: number; tickMs: number }} CueTiming
 */

/** 進め方の既定。 @type {Readonly<CueTiming>} */
export const CUE_TIMING_DEFAULTS = Object.freeze({
  /** 区間が 1 つも来ないとき、合図からこの時間で「区間なし」にする。 */
  cueTimeoutMs: 8000,
  /** 最後の動き（話し始め・区切り・結果）からこの時間静かなら次の合図へ（1 つの合図の間の 2 つ目以降の区間を拾う）。 */
  settleMs: 1500,
  /** 1 つの合図の上限（話し続けても次へ進む安全弁）。 */
  maxCueMs: 30000,
  /** 進め方を見る間隔。 */
  tickMs: 100
});

/**
 * 合図を 1 つずつ進め、区間を合図に結びつける。
 *  - 区間は「話し始めた（speechStart）ときに出ていた合図」のもの（合図の前に話し始めた区間は記録しない）。
 *    区切り（speechEnd）の endMs で、あとから来る文字起こしの結果と突き合わせる（耳の転写の endMs と同じ値）。
 *  - 次の合図へ進むのは: 話していない・その合図の区間の結果が全部来た・settleMs 静か、かつ（区間が 1 つ以上来た
 *    または cueTimeoutMs たった）。maxCueMs で必ず進む。区間が 1 つも無いまま進むときは「区間なし」を記録する。
 *  - 1 つの合図の間に区間が複数来たら、全部その合図の印で記録する。
 * @param {{
 *   cues: Cue[];
 *   timing?: Partial<CueTiming>;
 *   nowImpl?: () => number;
 *   dateImpl?: () => Date;
 *   onCue?: (cue: Cue) => void;
 *   onRecord: (record: ExperimentRecord) => void;
 * }} opts
 */
export function createCueSession(opts) {
  const timing = { ...CUE_TIMING_DEFAULTS, ...(opts.timing ?? {}) };
  const nowImpl = opts.nowImpl ?? Date.now;
  const dateImpl = opts.dateImpl ?? (() => new Date());
  const onCue = opts.onCue ?? (() => {});
  /**
   * @typedef {{ cue: Cue; startedAt: number; lastActivityAt: number; recorded: number; pending: number; finished: boolean }} CueState
   */
  let index = -1;
  /** @type {CueState | null} */
  let active = null;
  let done = false;
  let speaking = false;
  /** 今の話の区間が属する合図（speechStart のときの合図・合図の前なら null）。 */
  /** @type {CueState | null} */
  let speechCue = null;
  /** 区切りの endMs → 合図（null = 合図の前に話し始めた区間で、記録しない）。 */
  /** @type {Map<number, Array<CueState | null>>} */
  const byEnd = new Map();

  const touch = () => {
    if (active) active.lastActivityAt = nowImpl();
  };

  function next() {
    index += 1;
    if (index >= opts.cues.length) {
      active = null;
      done = true;
      return;
    }
    const t = nowImpl();
    active = { cue: opts.cues[index], startedAt: t, lastActivityAt: t, recorded: 0, pending: 0, finished: false };
    onCue(active.cue);
  }

  /** @param {CueState} state @param {SegmentResult | { outcome: "no_segment" }} result */
  function record(state, result) {
    opts.onRecord(buildRecord(state.cue, result, dateImpl()));
  }

  function finishActive() {
    if (!active) return;
    active.finished = true;
    if (active.recorded === 0 && active.pending === 0) record(active, { outcome: "no_segment" });
    next();
  }

  return {
    /** 最初の合図を出す。 */
    begin() {
      if (index === -1 && !done) next();
    },
    isDone: () => done,
    /** 今の合図（無ければ null）。 */
    current: () => (active ? active.cue : null),

    /** @param {{ type: string; endMs?: number; reason?: string }} event */
    onVadEvent(event) {
      if (!event || typeof event !== "object") return;
      if (event.type === "speechStart") {
        speaking = true;
        speechCue = active;
        touch();
      } else if (event.type === "speechEnd") {
        if (event.reason !== "maxSpeech") speaking = false;
        if (typeof event.endMs === "number") {
          const list = byEnd.get(event.endMs) ?? [];
          list.push(speechCue);
          byEnd.set(event.endMs, list);
          if (speechCue) speechCue.pending += 1;
        }
        touch();
      } else if (event.type === "speechCancel") {
        speaking = false;
        touch();
      }
    },

    /**
     * 区間の結果（文字起こしの結果か失敗）。記録した合図（または null = 記録しない）を返す。
     * @param {number} endMs
     * @param {SegmentResult} result
     * @returns {Cue | null}
     */
    onSegment(endMs, result) {
      /** @type {CueState | null} */
      let state = null;
      const list = byEnd.get(endMs);
      if (list && list.length > 0) {
        state = /** @type {CueState | null} */ (list.shift() ?? null);
        if (list.length === 0) byEnd.delete(endMs);
        if (state) state.pending = Math.max(0, state.pending - 1);
      } else {
        // 突き合わせられない区間（耳の範囲の端の切り詰め等）: 今の合図のものとする。
        state = active;
      }
      touch();
      if (!state) return null;
      state.recorded += 1;
      record(state, result);
      return state.cue;
    },

    /** 時間で進める。進め終わったら true。 */
    tick() {
      if (done) return true;
      if (!active) return false;
      const t = nowImpl();
      const elapsed = t - active.startedAt;
      const quiet = t - active.lastActivityAt;
      if (elapsed >= timing.maxCueMs) {
        finishActive();
      } else if (
        !speaking &&
        active.pending === 0 &&
        quiet >= timing.settleMs &&
        (active.recorded > 0 || elapsed >= timing.cueTimeoutMs)
      ) {
        finishActive();
      }
      return done;
    }
  };
}

// ── 終わりのまとめ ───────────────────────────────────────────────────────

/**
 * @param {number[]} values
 * @returns {number | null}
 */
export function median(values) {
  const v = values.filter((x) => typeof x === "number" && Number.isFinite(x)).sort((a, b) => a - b);
  if (v.length === 0) return null;
  const mid = Math.floor(v.length / 2);
  return v.length % 2 === 1 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

/** @param {number[]} values */
function stats(values) {
  const v = values.filter((x) => typeof x === "number" && Number.isFinite(x));
  if (v.length === 0) return { n: 0, min: null, median: null, max: null };
  return { n: v.length, min: Math.min(...v), median: median(v), max: Math.max(...v) };
}

/** 空の文字起こしの表示。 */
export const EMPTY_TEXT_LABEL = "（空）";

/**
 * 合図の種類ごとのまとめ（文字の内訳と 3 つの確率の最小・中央・最大）。
 * @param {ExperimentRecord[]} records
 * @param {ReadonlyArray<{ id: string; label: string }>} [kinds=CUE_KINDS]
 */
export function summarizeRecords(records, kinds = CUE_KINDS) {
  return kinds.map((k) => {
    const mine = records.filter((r) => r.cue === k.id);
    const segments = mine.filter((r) => r.outcome === "segment");
    /** @type {Map<string, number>} */
    const texts = new Map();
    for (const r of segments) {
      const key = r.text && r.text.length > 0 ? r.text : EMPTY_TEXT_LABEL;
      texts.set(key, (texts.get(key) ?? 0) + 1);
    }
    const textCounts = [...texts.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
    return {
      kind: k.id,
      label: k.label,
      cues: new Set(mine.map((r) => r.seq)).size,
      segments: segments.length,
      noSegment: mine.filter((r) => r.outcome === "no_segment").length,
      failed: mine.filter((r) => r.outcome === "failed").length,
      texts: textCounts,
      speech: stats(segments.map((r) => /** @type {number} */ (r.speech))),
      cough: stats(segments.map((r) => /** @type {number} */ (r.cough))),
      throatClearing: stats(segments.map((r) => /** @type {number} */ (r.throatClearing)))
    };
  });
}

/**
 * まとめをターミナル向けの文字にする。
 * @param {ReturnType<typeof summarizeRecords>} summary
 * @returns {string}
 */
export function formatSummary(summary) {
  const f = (/** @type {number | null} */ v) => (v === null ? "-" : v.toFixed(3));
  /** @param {string} name @param {{ n: number; min: number | null; median: number | null; max: number | null }} s */
  const line = (name, s) =>
    s.n === 0 ? `  ${name.padEnd(16)} （値なし）` : `  ${name.padEnd(16)} 最小 ${f(s.min)} / 中央 ${f(s.median)} / 最大 ${f(s.max)}（${s.n} 件）`;
  const out = ["── まとめ ──"];
  for (const s of summary) {
    out.push(`${s.label}: 合図 ${s.cues} 回・区間 ${s.segments}・区間なし ${s.noSegment}・失敗 ${s.failed}`);
    out.push(`  文字: ${s.texts.length === 0 ? "（なし）" : s.texts.map(([t, n]) => `${t === EMPTY_TEXT_LABEL ? t : `「${t}」`}×${n}`).join("、")}`);
    out.push(line("Speech", s.speech));
    out.push(line("Cough", s.cough));
    out.push(line("Throat clearing", s.throatClearing));
  }
  return `${out.join("\n")}\n`;
}
