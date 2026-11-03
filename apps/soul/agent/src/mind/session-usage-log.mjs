// @ts-check
/**
 * 頭の文脈の記録（起動ごと 1 ファイルの JSONL）— apps/soul/agent（長い配信の文脈・context-growth-2026-10.md §5・§6）。
 *
 * 発火ごとに 1 行（発火番号・頭・今回と累計の入力トークン・キャッシュ分・扱える最大量・最初の文字までの時間・
 * 画像の有無・渡した行数と文字数）と、圧縮の開始・終了を 1 行ずつ `session-usage/<起動時刻>.jsonl` に追記する。
 * **会話の本文は書かない**（数字と種類だけ）。配信を通して読み返し、圧縮のしきい値を決める材料にする。
 *
 * 応答の遅れの直し（latency-fix-plan.md §2-5）: 返事ごとの遅延の内訳（type: "latency"・文字起こし・判定・画面・
 * 最初の文字・最初の文・TTS・声・その他・合計、きっかけの種類、頭・文字起こし・声のエンジン名）も 1 行ずつ足す。
 * 操縦席の SSE "latency" と同じレコード（cockpit-server の onReplyLatency）から作る。配信どうしで比べる材料。
 *
 * 操縦席の fast の切り替え（2026-10-27）: fire と latency の行に serviceTier（その返事の turn/start に送った Codex の
 * 速さの段・"priority" = fast / "default"・送っていなければ null）を足す（既存のキーはそのまま）。
 *
 * Discord モード Domain H（discord-mode.md §13.7・人間ゲート 2 の「応答やのに黙った」の切り分け）: 判定ごとの行
 * （type: "judgment"）・発火の要求を断った行（type: "fire-refused"）・つまみの切り替えの行（type: "control"）を足す。
 * どれも拾う欄を決めた純関数で作り、会話の中身・人の名前・Discord の id・コメントの id・エラー文は書かない（エラーは
 * 種類だけ）。頭の種類に関係なく書く（fire の行は Codex のときだけだが、この 3 つは場の記録）。ふるまいは変えない。
 *
 * fire-diagnostics.mjs と同じ流儀: ディスク I/O は直列の非同期キューで行い、発火の経路は待たない・止めない
 * （書けなくても握る）。ファイルは最初の 1 行で作り、そのときに古いものを消して直近 SESSION_USAGE_RETENTION
 * 個（今回の分を含む）だけ残す。置き場は apps/soul/agent/.gitignore 済み。
 */
import { appendFile, mkdir, readdir, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
export const DEFAULT_SESSION_USAGE_DIR = join(here, "..", "..", "session-usage");
/** 残すファイルの数（起動 20 回分・今回を含む）。 */
export const SESSION_USAGE_RETENTION = 20;
export const SESSION_USAGE_MAX_QUEUE = 256;
export const SESSION_USAGE_SCHEMA = "soul-session-usage-v1";

const FILE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z\.jsonl$/;

/** @param {number} startedAtMs */
export function sessionUsageFileName(startedAtMs) {
  return `${new Date(startedAtMs).toISOString().replace(/[:.]/g, "-")}.jsonl`;
}

/** @param {unknown} v */
const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);

/**
 * 発火の orchestrator の onAskRecord（本文なし）から、記録の 1 行を作る（純関数）。
 * @param {any} info
 * @returns {Record<string, unknown>}
 */
export function fireUsageRecord(info) {
  const tokenUsage = info?.tokenUsage ?? null;
  const last = tokenUsage?.last ?? null;
  const total = tokenUsage?.total ?? null;
  return {
    type: "fire",
    fireId: num(info?.fireId),
    brain: typeof info?.brain === "string" ? info.brain : null,
    lastInputTokens: num(last?.inputTokens),
    lastCachedInputTokens: num(last?.cachedInputTokens),
    totalInputTokens: num(total?.inputTokens),
    totalCachedInputTokens: num(total?.cachedInputTokens),
    modelContextWindow: num(tokenUsage?.modelContextWindow),
    ttftMs: num(info?.ttftMs),
    vision: info?.vision === true,
    windowMode: typeof info?.windowMode === "string" ? info.windowMode : null,
    includedCount: num(info?.includedCount),
    injectedChars: num(info?.injectedChars),
    // その返事の turn/start に送った Codex の速さの段（"priority" = fast / "default"・送っていなければ null）。
    serviceTier: typeof info?.serviceTier === "string" ? info.serviceTier : null
  };
}

/**
 * 圧縮の開始・終了（context-compactor の onEvent）から、記録の 1 行を作る（純関数）。
 * @param {any} event
 * @param {string | null} brain
 * @returns {Record<string, unknown>}
 */
export function compactionUsageRecord(event, brain) {
  if (event?.type === "started") {
    return {
      type: "compactStarted",
      brain,
      ratio: num(event.ratio),
      lastInputTokens: num(event.lastInputTokens),
      totalInputTokens: num(event.totalInputTokens),
      modelContextWindow: num(event.modelContextWindow)
    };
  }
  return {
    type: "compactFinished",
    brain,
    ok: event?.ok === true,
    durationMs: num(event?.durationMs),
    reason: typeof event?.reason === "string" ? event.reason : null,
    personaInjected: event?.personaInjected === true,
    personaDeferred: event?.personaDeferred === true,
    compactionInputTokens: num(event?.compactionInputTokens)
  };
}

/**
 * 返事の遅延（cockpit-server の onReplyLatency が渡す、SSE "latency" と同じレコード）から、記録の 1 行を作る（純関数）。
 * 数字・種類・エンジン名だけを拾う（きっかけはコメントの ID や確率などを落とし、種類と speak-now の選択だけ）。
 * 体なしの返事（レコードの `bodyless: true`・配信の組み直し Domain C）には `bodyless: true` を足す（声の区間に器の
 * 往復が入らない印）。体があるときの行の形は変えない（キーを足さない）。
 * @param {any} record
 * @returns {Record<string, unknown>}
 */
export function replyLatencyUsageRecord(record) {
  const segments = record?.segments ?? {};
  const cause = record?.cause && typeof record.cause === "object" ? record.cause : null;
  const str = (/** @type {unknown} */ v) => (typeof v === "string" ? v : null);
  return {
    type: "latency",
    fireId: num(record?.fireId),
    causeType: str(cause?.type),
    causeChoice: str(cause?.choice),
    spoken: record?.spoken === true,
    vision: record?.vision === true,
    level: str(record?.level),
    brain: str(record?.brain),
    sttEngine: str(record?.stt),
    voiceEngine: str(record?.voice),
    transcribeMs: num(segments.transcribeMs),
    judgeMs: num(segments.judgeMs),
    screenMs: num(segments.screenMs),
    llmFirstMs: num(segments.llmFirstMs),
    firstSentenceMs: num(segments.firstSentenceMs),
    ttsMs: num(segments.ttsMs),
    voiceMs: num(segments.voiceMs),
    otherMs: num(record?.otherMs),
    totalMs: num(record?.totalMs),
    // その返事の turn/start に送った Codex の速さの段（fire の行と同じ・Claude 等は null）。
    serviceTier: str(record?.serviceTier),
    ...(record?.bodyless === true ? { bodyless: true } : {})
  };
}

// ── Discord モード Domain H: 判定・発火の断り・つまみの記録（discord-mode.md §13.7）──────────────────────────

/**
 * 記録に載せてよい語（コードが決めた短い語: trigger・action・きっかけの種類・断った理由）。英小文字で始まり、
 * 英小文字・数字・- だけの 40 文字まで。これに合わない値（文・名前・id が紛れ込んだもの）は null に落とす。
 * @param {unknown} v
 * @returns {string | null}
 */
const token = (v) => (typeof v === "string" && /^[a-z][a-z0-9-]{0,39}$/.test(v) ? v : null);

/** 判定の選択肢（speak-now の 5 択・speak-now.mjs の buildChoices と同じ）。確率はこの名前だけ拾う。 */
export const JUDGMENT_CHOICES = Object.freeze(["wait", "backchannel", "respond", "initiate", "look"]);

/**
 * 判定のエラーの種類（speak-now-decisions.mjs の SpeakNowJudgeError の kind と同じ語）。これ以外は "unknown"。
 *  - no-key: キーが無い / network: 通信失敗 / auth: 認証失敗（401・403） / http: そのほかの HTTP エラー /
 *    timeout: 時間切れ / shape: 応答の形が想定外。
 */
export const JUDGMENT_ERROR_KINDS = Object.freeze(["no-key", "network", "auth", "http", "timeout", "shape"]);

/**
 * 判定ごとの 1 行（cockpit-server の onSpeakNowJudgment が渡す info から作る純関数）。成功なら選択・確率・行き先、
 * 失敗ならエラーの種類（と HTTP の状態の数）だけ。**エラー文（info.error）は書かない**（通信失敗・HTTP エラーの文には
 * 相手の文が入りうる・gate-2-silence-investigation.md §1.2 #9）。
 * @param {any} info  成功: `{ ok: true, trigger, triggerSeq, choice, probability, probs, latencyMs, action }`。
 *   失敗: `{ ok: false, trigger, error, latencyMs, errorKind?, errorStatus? }`。
 * @returns {Record<string, unknown>}
 */
export function judgmentUsageRecord(info) {
  const ok = info?.ok === true;
  const probsIn = ok && info?.probs && typeof info.probs === "object" ? info.probs : null;
  /** @type {Record<string, number | null> | null} */
  let probs = null;
  if (probsIn) {
    probs = {};
    for (const key of JUDGMENT_CHOICES) probs[key] = num(probsIn[key]);
  }
  const choice = ok && typeof info?.choice === "string" && JUDGMENT_CHOICES.includes(info.choice) ? info.choice : null;
  const errorKind = ok
    ? null
    : typeof info?.errorKind === "string" && JUDGMENT_ERROR_KINDS.includes(info.errorKind)
      ? info.errorKind
      : "unknown";
  return {
    type: "judgment",
    ok,
    trigger: token(info?.trigger),
    triggerSeq: num(info?.triggerSeq),
    choice,
    p: ok ? num(info?.probability) : null,
    probs,
    action: ok ? token(info?.action) : null,
    latencyMs: num(info?.latencyMs),
    errorKind,
    errorStatus: ok ? null : num(info?.errorStatus)
  };
}

/**
 * 発火の要求を断った 1 行（cockpit-server の onFireRefused が渡す info から作る純関数）。きっかけの種類
 * （speak-now・manual・recall・silence・comment-react など）と断った理由（stream-not-open・busy・killed・
 * ears-not-running・empty-window・vision-no-target など）・視覚の発火か、だけ。きっかけのほかの欄
 * （確率・コメントの id・転写の seq など）は拾わない。
 * @param {any} info  `{ cause: string | null; reason: string | null; vision?: boolean }`
 * @returns {Record<string, unknown>}
 */
export function fireRefusedUsageRecord(info) {
  return {
    type: "fire-refused",
    cause: token(info?.cause),
    reason: token(info?.reason),
    vision: info?.vision === true
  };
}

/**
 * control の行に書いてよいつまみ・出来事の名前（許す一覧）。Domain H は自発・かぶり判定・KILL の 3 つ。
 * Domain I〜K が VC に入る・抜ける・移る・切れたを足すときに使う名前も先に置く（呼ぶだけで済むように）。
 *  - self-fire: 自発的にしゃべる（POST /api/self-fire） / barge-in: かぶり判定（POST /api/barge-in） /
 *    kill: KILL（POST /api/kill）。この 3 つは from / to に前後の真偽を載せる。
 *  - vc-join: VC に入った（体験を開いたとき・パネル / API から） / vc-leave: 自分で VC から抜けた（移る先に入れなかったときも） /
 *    vc-move: 自分で別の VC へ移った / vc-disconnect: 切れた（つなぎ直しを待つ切れ・猶予のあいだ戻らなかった）。
 *  - Domain I で足した: vc-moved: Discord の画面で別の VC へ動かされた（動いた先を追った） / vc-kicked: 外から切られた
 *    （閉じのコード 4014 = キック・チャンネルの削除・Bot 自身が VC の外へ。VC の外で待っている）。
 *    VC の名前・Discord の id は載せない（from / to は null のまま）。
 */
export const USAGE_CONTROL_KINDS = Object.freeze([
  "self-fire",
  "barge-in",
  "kill",
  "vc-join",
  "vc-leave",
  "vc-move",
  "vc-disconnect",
  "vc-moved",
  "vc-kicked"
]);

/**
 * つまみの切り替え・VC の出来事の 1 行（純関数）。名前が許す一覧に無ければ null（呼び出し側は書かない）。
 * 新旧の値は真偽だけ（真偽でなければ null）。名前・id・VC の名前を受ける欄は無い。
 * @param {any} info  `{ control: string; from?: boolean; to?: boolean }`
 * @returns {Record<string, unknown> | null}
 */
export function controlUsageRecord(info) {
  const control = typeof info?.control === "string" && USAGE_CONTROL_KINDS.includes(info.control) ? info.control : null;
  if (control == null) return null;
  const bool = (/** @type {unknown} */ v) => (typeof v === "boolean" ? v : null);
  return { type: "control", control, from: bool(info?.from), to: bool(info?.to) };
}

/**
 * @param {{ dir?: string; startedAtMs?: number; nowImpl?: () => number; retention?: number; maxQueue?: number; fs?: { appendFile: Function; mkdir: Function; readdir: Function; rm: Function } }} [options]
 */
export function createSessionUsageLog(options = {}) {
  const dir = options.dir ?? DEFAULT_SESSION_USAGE_DIR;
  const nowImpl = options.nowImpl ?? Date.now;
  const startedAtMs = options.startedAtMs ?? nowImpl();
  const retention = options.retention ?? SESSION_USAGE_RETENTION;
  const maxQueue = options.maxQueue ?? SESSION_USAGE_MAX_QUEUE;
  const fs = options.fs ?? { appendFile, mkdir, readdir, rm };
  const fileName = sessionUsageFileName(startedAtMs);
  const path = join(dir, fileName);
  let pruned = false;
  let dropped = 0;
  /** @type {Array<() => Promise<void>>} */
  const queue = [];
  let draining = false;
  /** @type {Array<(value?: unknown) => void>} */
  const idleWaiters = [];

  const notifyIdle = () => {
    if (draining || queue.length > 0) return;
    for (const resolve of idleWaiters.splice(0)) resolve();
  };
  const drain = () => {
    if (draining) return;
    draining = true;
    void (async () => {
      while (queue.length > 0) {
        const task = queue.shift();
        try {
          await task?.();
        } catch {
          // 書けなくても次の行は試す（記録は発火を止めない）。
        }
      }
      draining = false;
      notifyIdle();
    })();
  };
  const prune = async () => {
    const files = (await fs.readdir(dir)).filter((name) => FILE_RE.test(name) && name !== fileName).sort().reverse();
    for (const file of files.slice(Math.max(0, retention - 1))) {
      await fs.rm(join(dir, file), { force: true });
    }
  };

  return {
    path,
    /**
     * 1 行追記する（待たない・throw しない）。record に本文を入れないのは呼び出し側の規律（fireUsageRecord /
     * compactionUsageRecord は数字と種類だけを拾う）。
     * @param {Record<string, unknown>} record
     */
    append(record) {
      if (queue.length >= maxQueue) {
        dropped += 1;
        return;
      }
      const line = `${JSON.stringify({ schema: SESSION_USAGE_SCHEMA, wallTimeMs: nowImpl(), ...record })}\n`;
      queue.push(async () => {
        await fs.mkdir(dir, { recursive: true });
        if (!pruned) {
          pruned = true;
          try {
            await prune();
          } catch {
            // 古いファイルを消せなくても記録は続ける。
          }
        }
        await fs.appendFile(path, line, "utf8");
      });
      drain();
    },
    /** テスト・終了時用（発火の経路からは呼ばない）。 */
    flush() {
      if (!draining && queue.length === 0) return Promise.resolve();
      return new Promise((resolve) => idleWaiters.push(resolve));
    },
    getStats() {
      return { queued: queue.length, draining, dropped };
    }
  };
}
