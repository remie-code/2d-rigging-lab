// @ts-check
/**
 * 耳パイプライン常駐結線（S2 Domain C の本丸）— apps/soul/agent。
 *
 * ffmpeg（マイク→16kHz mono s16le）→ PCM フレーマ → Silero VAD → 発話セグメンタ →
 * PCM リングバッファ切り出し → encodeWav → whisper /inference → 転写バッファ（正本）、
 * の常駐結線。Domain A/B の部品を一切変えず、結線とライフサイクルだけをここに置く。
 *
 * ── ストリーム時計 ─────────────────────────────────────────────────
 *  リングバッファに書いた総サンプル数が唯一の時計。フレームの tMs も speechEnd の範囲も
 *  同じサンプル数由来なので、切り出しがズレない（壁時計は転写レイテンシ計測にのみ使う）。
 *
 * ── 常駐既定（Domain C 裁定・実測根拠は experiments/s2-ears.md）────────────────
 *  - maxSpeechMs = 20000: whisper 30s 窓に pad 込みで収まり、長話でも 20s ごとに転写が
 *    追いつく（Orch 提案・Undine 裁定範囲 15000〜30000 内）。
 *  - threads = 6: 実測で 8T 比 +9〜11% の最小スレッド数（配信中は器の二体と CPU 共有）。
 *  - audio_ctx 動的設定: 発話長比例（whisper-inference.mjs の式）。warm ≈6.6s → ≈1.5〜1.8s。
 *  - minSilenceMs = 400: セグメンタ既定 100ms だと読点程度の間で発話が細切れになり ASR 呼び出しが
 *    増えるため、常駐では「一呼吸の区切り」を狙う 400ms を既定にする（設定で上書き可）。
 *
 * ── whisper-server の死の監視（2 経路・Domain B レビュー note 2）───────────────
 *  spawn 失敗は onExit に乗らないため、(1) start() 中の `ready` reject と (2) ready 後の
 *  `onExit` の両方で監視する。**死んだら再起動せず ASR を止めて診断表示**（設計判断）:
 *  ASR サーバの死は systemic（ポート衝突・OOM・モデル破損）でありがちで、530ms とはいえ
 *  512MB のモデルロードを自動で繰り返すのは配信中の CPU を荒らすだけになり得る。VAD イベント
 *  だけは生かし続け（S6 barge-in の土台は死なない）、CLI に whisperDown を出して人間の再起動に
 *  委ねる。復旧の自動化が要ることが運用で分かったら、その時に根拠付きで足す。
 *
 * ── ASR 直列化（設計判断）────────────────────────────────────────────
 *  speechEnd が推論中に重なったら **FIFO キューで直列**に流す（whisper-server は 1 スレッド
 *  プールを共有するので並行に投げても速くならない）。キュー上限 asrQueueMax（既定 4）超過時は
 *  **最古を捨てる**（診断イベント付き）: 会話の追従が目的なので、詰まったときに優先すべきは
 *  新しい発話。チューニング後の warm ≈1.5〜1.8s では通常溢れない。
 *
 * ── 1 発話の外側見張り（Domain B レビュー note 1）───────────────────────────
 *  transcribe→append の全体に utteranceTimeoutMs の見張りを置く。whisper-client のタイマは
 *  fetch 完了までしか覆わない懸念があったが、本結線の転写呼び出しは whisper-inference.mjs
 *  （本文読み取りまでタイマの内側）を使い、さらにこの外側見張りで二重に有界化する。
 *  タイムアウト/失敗は**その 1 発話を落として常駐は続く**（診断イベント）。
 *
 * ── 転写バッファの listener 例外契約（Domain B レビュー note 4 の線引き）─────────
 *  transcript-buffer の契約 = 「listener は throw しない」（transcript-buffer.mjs の JSDoc に
 *  明文化済み。throw は append 呼び出し元へ伝播し残り listener がスキップされる）。結線層は
 *  この伝播を **1 発話の失敗と同じ扱いで吸収**する: パイプライン自身の onTranscript 通知は
 *  最初に登録した自前 listener で行うため外部購読者（S3 等）の throw に巻き込まれず、外部の
 *  throw は診断イベント（listenerError）になって常駐は続く。正本は壊れない（push 済み）。
 *
 *  注意（S3 追撃 domain-c で接地）: この onAppend は **話者無差別**（you も soul も同じ列に積まれる）。
 *  S3 の soul 発話（speaker:"soul"）も同じ transcriptBuffer に append されるため onTranscript を
 *  必ず通る。you のみを転写経路として扱いたい購読者（cockpit の SSE transcript 放送など）は、
 *  受け側で speaker:"soul" を除外すること（soul の正経路は orchestrator の onSoulTranscript）。
 *
 * ── 文字起こしの分岐（whisper / ElevenLabs・操縦席の文字起こし選択）──────────────
 *  合意: discussion/ai-cohost/implementation/screens/cockpit-stt-selection.md §3・§8。
 *  ffmpeg → フレーマ → VAD → セグメンタ（speechStart/End/Cancel の合図）は engine に関わらず同じ。
 *  分岐するのは転写だけ:
 *   - "whisper"（既定・従来どおり）: speechEnd ごとにリングを切り出して whisper-server へ。
 *   - "elevenlabs": whisper-server を起動しない。マイクの PCM をそのまま ElevenLabs リアルタイム
 *     STT（elevenlabs-stt.mjs）へ流し続け、**commit 1 件を転写 1 件**として転写バッファへ積む
 *     （partial は積まない）。speechEnd は転写のきっかけにはならず、遅延の物差しの起点にだけ使う
 *     （「直前の commit 以降で最後の speechEnd → commit 到着」）。転写の startMs/endMs は commit
 *     到着時点のストリーム時刻（start = end。本番でこの値を読む処理は無い）。空の commit は
 *     転写バッファの既存の規則どおり discarded として数える。
 *   - "parakeet" / "zipformer"（ローカルの文字起こし・local-stt-wave-plan.md §1）: whisper-server を
 *     起動せず、sherpa-onnx を子プロセス（src/ears/local-stt/）で動かす。**親（このプロセス）では
 *     sherpa-onnx-node を import しない**（耳の VAD の onnxruntime.dll と版がぶつかるため）。転写の継ぎ目
 *     （transcribe(wavBytes)）・ASR キュー・転写バッファ・遅延の物差し（speechEnd → 転写）は whisper の経路の
 *     まま。違うのは渡す音の余白だけ: (a) 本物の音を前に preRollMs（既定 200ms）広げて切り出す（ring.slice の
 *     startMs。セグメンタの speechPadMs と合図のタイミングは変えない）、(b) 作り物の無音を前後に silencePadMs
 *     （既定 300ms）足してから encode する。転写の startMs/endMs はセグメンタの範囲のまま（余白を含めない）。
 *     子が落ちたら whisper の死と同じく ASR を止めて診断（localSttDown）を出し、再起動しない。
 *
 * ── 咳払いの落とし（ローカルの文字起こしだけ・cough-filter-stage2-plan.md §1・§2 の 3〜6）──────────────
 *  子は、文字起こしが stt.local.coughMaxChars（既定 4）文字以下の区間だけを音の種類の判定（CED-tiny）にかけ、Speech の
 *  確率（speech）を返す（local-stt-worker-core.mjs）。落とすか通すかを比べるのはここ（transcribeAndAppend・正本に積む前）:
 *  speech が有限の数で、線 stt.local.coughSpeechThreshold（既定 0.1）が 0 より大きく、speech < 線なら、正本に積まずに
 *  `buffer.discard({ ..., reason: "cough", speech })` で捨て、診断 transcriptDiscarded（reason "cough"）を出す。線が 0・speech が
 *  null（判定にかけていない・失敗した・上限を超えた）なら今までどおり積む。whisper / ElevenLabs には掛けない（子を持たない）。
 *  **診断に文字起こしの文字と確率を載せない**（診断は ears-cli が丸ごと stderr に出す・画面のログにも流れる）。文字と確率が
 *  行くのは正本の onDiscard（場の SSE discard）だけ。
 *  判定なし（CED-tiny が無い・読み込めない）でも Start は失敗しない。子の ready の理由は診断 audioTaggingOff の reason に
 *  決まった 4 つの語（not-configured / disabled / model-not-found / failed-to-load）にして渡す（子の理由の文言〔sherpa の
 *  エラー文・パスを含みうる〕は出さない）。警告にするかは場（cockpit-server）が決める。
 *
 * ── クリーンシャットダウン ─────────────────────────────────────────
 *  dispose() 一発で ffmpeg・VAD セッション・whisper-server（または ElevenLabs 接続）・キュー・タイマが全部畳まれる。
 *  見張りタイマは各発話処理の finally で必ず clear（unref しない規律は S2 §6.1 の教訓）。
 */

import { createFfmpegCapture } from "./ffmpeg-capture.mjs";
import { createPcmFramer, int16ToFloat32 } from "./pcm-framing.mjs";
import { createSileroVad } from "./silero-vad.mjs";
import { createSpeechSegmenter } from "./speech-segmenter.mjs";
import { createPcmRingBuffer } from "./pcm-ring-buffer.mjs";
import { encodeWav } from "../voice/wav-encode.mjs";
import { createWhisperServer } from "./whisper-server.mjs";
import { createWhisperInference, computeAudioCtx } from "./whisper-inference.mjs";
import { createTranscriptBuffer } from "./transcript-buffer.mjs";
import { createElevenLabsRealtimeStt } from "./elevenlabs-stt.mjs";
// 親で読むのは fork する係と純関数だけ（sherpa-onnx-node は子プロセスの local-stt-worker.mjs だけが読む）。
import { createLocalSttClient } from "./local-stt/local-stt-client.mjs";
import { createHaasLocalSttClient } from "./local-stt/haas-local-stt.mjs";
import { isLocalSttEngine, normalizeLocalSttSettings, padWithSilence } from "./local-stt/local-stt-engines.mjs";
import { shouldTagTranscript } from "./local-stt/audio-tagging.mjs";

/** 文字起こしの方式（操縦席の選択肢）。既定は whisper（従来どおり）。parakeet / zipformer はローカル（子プロセス）。 */
export const STT_ENGINES = Object.freeze(["whisper", "elevenlabs", "parakeet", "zipformer", "haas"]);

/**
 * 咳払いの落としの比べ方（純関数・ヘッダの「咳払いの落とし」）。落とすなら Speech の確率、通すなら null。
 * @param {{ text: string; speech?: unknown }} transcribed  文字起こしの戻り（ローカルの子は speech を持つ）。
 * @param {{ coughMaxChars: number; coughSpeechThreshold: number }} settings  normalizeLocalSttSettings の値。
 * @returns {number | null}
 */
export function coughSpeechToDrop(transcribed, settings) {
  const threshold = settings.coughSpeechThreshold;
  if (!(typeof threshold === "number" && threshold > 0)) return null;
  const speech = transcribed ? transcribed.speech : null;
  if (typeof speech !== "number" || !Number.isFinite(speech)) return null;
  // 判定にかける長さの区間だけ（子と同じ数え方。上限を超えた区間は子も判定しないが、ここでも通す側に倒す）。
  if (!shouldTagTranscript(typeof transcribed.text === "string" ? transcribed.text : "", settings.coughMaxChars)) return null;
  return speech < threshold ? speech : null;
}

/**
 * 子の ready の判定なしの理由 → 決まった語（診断 audioTaggingOff の reason）。理由の文言そのものは外へ出さない。
 * @param {unknown} reason  local-stt-client の `ready.audioTagging.reason`。
 * @returns {"not-configured" | "disabled" | "model-not-found" | "failed-to-load"}
 */
export function audioTaggingOffCause(reason) {
  if (reason === "not configured") return "not-configured";
  if (typeof reason === "string" && reason.startsWith("disabled")) return "disabled";
  if (typeof reason === "string" && reason.startsWith("audio tagging model not found")) return "model-not-found";
  return "failed-to-load";
}

/** 常駐の既定（根拠は上記ヘッダと experiments/s2-ears.md）。 */
export const EAR_DEFAULTS = Object.freeze({
  sampleRate: 16000,
  maxSpeechMs: 20000,
  minSilenceMs: 400,
  threads: 6,
  ringMs: 40000,
  asrQueueMax: 4,
  utteranceTimeoutMs: 45000
});

/**
 * 耳パイプラインを作る（start() で常駐開始・dispose() で全畳み）。
 *
 * @param {object} [options]
 * @param {object} [options.capture]  ffmpeg 設定（device / inputFormat / ffmpegPath / …
 *   createFfmpegCapture にそのまま渡る。onPcm/onExit/onError は結線層が握る）。
 * @param {object} [options.vad]      createSileroVad へのオプション（modelPath 等）。
 * @param {object} [options.segmenter] セグメンタ設定の上書き（threshold / minSpeechMs /
 *   minSilenceMs / speechPadMs / maxSpeechMs。既定は EAR_DEFAULTS の常駐値）。
 * @param {object} [options.whisper]  whisper-server 設定（serverPath / modelPath / port / host /
 *   language / threads（既定 6）/ flashAttn（既定 false = `-nfa`。長発話決定論的崩壊の実機診断済み・
 *   whisper-server.mjs 参照）/ extraArgs / readyTimeoutMs）。`promptProvider` を関数で渡した場合は
 *   Whisper の initial prompt を発話ごとに解決する（推論器生成時には値を固定しない）。
 * @param {object} [options.asr]      { queueMax=4, utteranceTimeoutMs=45000, timeoutMs=30000,
 *   dynamicAudioCtx=true, audioCtxOptions }。
 * @param {number} [options.ringMs=40000]  PCM リングバッファ保持長。
 * @param {{ engine?: "whisper" | "elevenlabs" | "parakeet" | "zipformer" | "haas"; apiKey?: string; elevenLabs?: object;
 *   local?: { threads?: number; preRollMs?: number; silencePadMs?: number; hotwords?: string[]; hotwordsScore?: number; coughMaxChars?: number; coughSpeechThreshold?: number; modelsDir?: string; client?: object } }} [options.stt]
 *   文字起こしの方式（既定 whisper）。elevenlabs のときは apiKey が要り（呼び出し側が env ファイルから
 *   読んで渡す）、elevenLabs は createElevenLabsRealtimeStt への追加設定（WebSocketImpl 等）。
 *   parakeet / zipformer のときは local（範囲外は既定・normalizeLocalSttSettings）。local.client は
 *   createLocalSttClient への追加設定（テスト注入の forkImpl / workerPath 等）。
 * @param {typeof createLocalSttClient} [options.localSttFactory]  テスト注入（既定 createLocalSttClient）。
 * @param {(status: string, info: { reason: string | null }) => void} [options.onSttStatus]
 *   ElevenLabs 接続の状態遷移（connecting / up / reconnecting / down）。whisper では呼ばれない。
 * @param {(event: object) => void} [options.onVadEvent]     speechStart/End/Cancel（全部）。
 * @param {ReturnType<typeof createTranscriptBuffer>} [options.transcriptBuffer]  会話の正本（積む口・Discord モード
 *   Domain A）。場が作って渡す。渡されなければ耳が自分で作る（従来どおり）。渡されたときは耳は onAppend を張らない。
 * @param {(entry: object, meta: { latencyMs: number | null; audioCtx: number | null }) => void} [options.onTranscript]
 *   転写がバッファに積まれた（正経路）。latencyMs は whisper が「speechEnd → 転写」、ElevenLabs が
 *   「直前の commit 以降で最後の speechEnd → commit 到着」（その間に speechEnd が無ければ null）。
 *   自前の正本のときは onAppend 経由で**正本のすべての行**（soul / viewer も）で呼ぶ（従来どおり）。外から渡された
 *   正本のときは**この耳が積んだ行だけ**で呼ぶ（ほかの行の購読は正本の持ち主の場が 1 回だけ張る）。
 * @param {(diag: object) => void} [options.onDiagnostic]    落とした発話・死・破棄などの診断。
 * @param {() => number} [options.nowImpl]  壁時計（レイテンシ計測用）。既定 Date.now。
 * @param {typeof setTimeout} [options.setTimeoutImpl]
 * @param {typeof clearTimeout} [options.clearTimeoutImpl]
 * @param {typeof createFfmpegCapture} [options.captureFactory]   テスト注入。
 * @param {typeof createSileroVad} [options.vadFactory]           テスト注入。
 * @param {typeof createWhisperServer} [options.serverFactory]    テスト注入。
 * @param {typeof createElevenLabsRealtimeStt} [options.sttFactory]  テスト注入（既定 createElevenLabsRealtimeStt）。
 * @param {(wavBytes: Uint8Array, opts?: { audioCtx?: number }) => Promise<{ text: string; rawText: string; speech?: number | null }>} [options.transcribeImpl]
 *   転写呼び出しの差し替え（テスト注入。既定は whisper-inference を server.baseUrl で構築）。
 * @returns {{
 *   start: () => Promise<void>;
 *   dispose: () => Promise<void>;
 *   isDisposed: () => boolean;
 *   transcriptBuffer: ReturnType<typeof createTranscriptBuffer>;
 *   streamMs: () => number;
 *   stats: () => object;
 * }}
 */
export function createEarPipeline(options = {}) {
  const sampleRate = options.capture?.sampleRate ?? EAR_DEFAULTS.sampleRate;
  const segmenterOptions = {
    minSilenceMs: EAR_DEFAULTS.minSilenceMs,
    ...(options.segmenter ?? {}),
    maxSpeechMs: options.segmenter?.maxSpeechMs ?? EAR_DEFAULTS.maxSpeechMs
  };
  const whisperOptions = { threads: EAR_DEFAULTS.threads, ...(options.whisper ?? {}) };
  const asrOptions = {
    queueMax: EAR_DEFAULTS.asrQueueMax,
    utteranceTimeoutMs: EAR_DEFAULTS.utteranceTimeoutMs,
    timeoutMs: 30000,
    dynamicAudioCtx: true,
    audioCtxOptions: undefined,
    ...(options.asr ?? {})
  };
  const ringMs = options.ringMs ?? EAR_DEFAULTS.ringMs;
  const nowImpl = options.nowImpl ?? Date.now;
  const setTimeoutImpl = options.setTimeoutImpl ?? setTimeout;
  const clearTimeoutImpl = options.clearTimeoutImpl ?? clearTimeout;
  const captureFactory = options.captureFactory ?? createFfmpegCapture;
  const vadFactory = options.vadFactory ?? createSileroVad;
  const serverFactory = options.serverFactory ?? createWhisperServer;
  const sttFactory = options.sttFactory ?? createElevenLabsRealtimeStt;
  const sttEngine = options.stt?.engine ?? "whisper";
  if (!STT_ENGINES.includes(sttEngine)) {
    throw new RangeError(`createEarPipeline: unknown stt engine ${JSON.stringify(sttEngine)}.`);
  }
  const useElevenLabs = sttEngine === "elevenlabs";
  const useLocal = isLocalSttEngine(sttEngine);
  const localSettings = normalizeLocalSttSettings(options.stt?.local ?? null);
  const localSttFactory = options.localSttFactory ?? (sttEngine === "haas" ? createHaasLocalSttClient : createLocalSttClient);
  const onSttStatus = options.onSttStatus ?? (() => {});

  const onVadEvent = options.onVadEvent ?? (() => {});
  const onTranscript = options.onTranscript ?? (() => {});
  const onDiagnostic = options.onDiagnostic ?? (() => {});

  // 会話の正本（Discord モード Domain A・discord-mode.md §3.1）: 場が作って渡す（積む口）。渡されなければ自分で作る
  // （従来どおり・テストの互換）。渡された正本には onAppend を張らない（張るのは持ち主の場が 1 回だけ。耳が N 本でも
  // N 重にならない）。そのとき onTranscript は「この耳が積んだ行」にだけ、遅延と audioCtx を添えて直に呼ぶ（耳ごとの口）。
  const externalBuffer = options.transcriptBuffer ?? null;
  const buffer = externalBuffer ?? createTranscriptBuffer({ nowImpl });
  const ring = createPcmRingBuffer({ capacityMs: ringMs, sampleRate });
  const framer = createPcmFramer();

  let started = false;
  let disposed = false;
  let asrDown = false;
  /** @type {ReturnType<typeof createSileroVad> | null} */
  let vad = null;
  /** @type {ReturnType<typeof createWhisperServer> | null} */
  let server = null;
  /** @type {ReturnType<typeof createFfmpegCapture> | null} */
  let capture = null;
  /** @type {ReturnType<typeof createElevenLabsRealtimeStt> | null} */
  let stt = null;
  /** @type {ReturnType<typeof createLocalSttClient> | null} */
  let localStt = null;
  /** ElevenLabs: 直前の commit 以降で最後の speechEnd の壁時計（遅延の物差しの起点）。 */
  /** @type {number | null} */
  let lastSpeechEndWallMs = null;
  /** @type {(wavBytes: Uint8Array, opts?: { audioCtx?: number }) => Promise<{ text: string; rawText: string; speech?: number | null }>} */
  let transcribe = options.transcribeImpl ?? (() => Promise.reject(new Error("not started")));

  /** VAD 推論の直列化チェーン（フレームは到着順に 1 個ずつモデルへ）。 */
  let vadChain = Promise.resolve();
  /** ASR ジョブの FIFO キューと直列ワーカー。 */
  /** @type {Array<{ wav: Uint8Array; startMs: number; endMs: number; durationMs: number; reason: string; endWallMs: number }>} */
  const asrQueue = [];
  let pumping = false;

  const counters = {
    frames: 0,
    speechStarts: 0,
    speechEnds: 0,
    speechCancels: 0,
    asrDone: 0,
    asrFailed: 0,
    asrDropped: 0,
    asrSkipped: 0,
    vadErrors: 0,
    sttCommits: 0,
    coughDropped: 0
  };

  /** 現在処理中ジョブのメタ（ワーカーは直列なので 1 個で足りる）。 */
  /** @type {{ latencyMs: number; audioCtx: number | null } | null} */
  let currentMeta = null;
  // パイプライン自身の転写通知は「最初に登録した自前 listener」で受ける。
  // transcript-buffer の listener は登録順に呼ばれるため、後から登録された外部購読者（S3 等）が
  // throw しても、この通知は既に配信済み＝外部の契約違反に巻き込まれない（note 4 の線引き）。
  if (!externalBuffer) {
    buffer.onAppend((entry) => {
      onTranscript(entry, currentMeta ?? { latencyMs: NaN, audioCtx: null });
    });
  }

  /**
   * 外から渡された正本に積んだとき、この耳が積んだ行だけを onTranscript へ渡す（自前の正本では onAppend が渡すので
   * 何もしない）。onTranscript の throw は、自前の正本のときの listener の throw と同じく listenerError の診断に落とす。
   * @param {{ appended: boolean; entry: any }} result
   * @param {{ latencyMs: number | null; audioCtx: number | null }} meta
   * @param {{ startMs: number; endMs: number }} range
   */
  function notifyOwnAppend(result, meta, range) {
    if (!externalBuffer || !result.appended || !result.entry) return;
    try {
      onTranscript(result.entry, meta);
    } catch (error) {
      onDiagnostic({
        type: "listenerError",
        message: error instanceof Error ? error.message : String(error),
        startMs: range.startMs,
        endMs: range.endMs
      });
    }
  }

  const segmenter = createSpeechSegmenter(segmenterOptions, (event) => {
    if (disposed) return;
    if (event.type === "speechStart") counters.speechStarts += 1;
    else if (event.type === "speechCancel") counters.speechCancels += 1;
    onVadEvent(event);
    if (event.type === "speechEnd") {
      counters.speechEnds += 1;
      handleSpeechEnd(/** @type {any} */ (event));
    }
  });

  /** speechEnd → リング切り出し（clamp）→ WAV → ASR キュー。 */
  function handleSpeechEnd(event) {
    if (useElevenLabs) {
      // ElevenLabs では転写は commit が担う。speechEnd は遅延の物差しの起点だけ（whisper の endWallMs と同じ壁時計）。
      lastSpeechEndWallMs = nowImpl();
      return;
    }
    // [0, 実データ末尾] への clamp はリングバッファの契約（flush 時 pad 超過・maxSpeech 分割の
    // 2×pad 重なり・容量超過破棄のどれが来ても安全）。
    // ローカルの文字起こし: 余白 (a) = 本物の音を前に preRollMs 広げて切り出す（セグメンタの範囲は変えない）。
    const preRollMs = useLocal ? localSettings.preRollMs : 0;
    const cut = ring.slice({ startMs: Math.max(0, event.startMs - preRollMs), endMs: event.endMs });
    // 転写の範囲はセグメンタの範囲（余白を含めない）。whisper は preRoll 0 なので cut の範囲そのもの。
    const rangeStartMs = Math.min(Math.max(cut.startMs, event.startMs), cut.endMs);
    if (cut.samples.length === 0 || cut.endMs <= rangeStartMs) {
      onDiagnostic({ type: "emptyCut", startMs: event.startMs, endMs: event.endMs });
      return;
    }
    if (asrDown) {
      counters.asrSkipped += 1;
      onDiagnostic({
        type: "asrSkipped",
        reason: useLocal ? "localSttDown" : "whisperDown",
        startMs: rangeStartMs,
        endMs: cut.endMs
      });
      return;
    }
    // 余白 (b) = 作り物の無音を前後に足す（ローカルのときだけ）。
    const samples = useLocal ? padWithSilence(cut.samples, localSettings.silencePadMs, sampleRate) : cut.samples;
    const wav = encodeWav(samples, { sampleRate, channels: 1, bitsPerSample: 16 });
    asrQueue.push({
      wav,
      startMs: rangeStartMs,
      endMs: cut.endMs,
      durationMs: cut.endMs - rangeStartMs,
      reason: event.reason,
      endWallMs: nowImpl()
    });
    // キュー溢れは最古を捨てる（新しい発話への追従を優先・設計判断はヘッダ参照）。
    while (asrQueue.length > asrOptions.queueMax) {
      const dropped = asrQueue.shift();
      counters.asrDropped += 1;
      onDiagnostic({
        type: "asrDropped",
        reason: "queueOverflow",
        startMs: dropped?.startMs,
        endMs: dropped?.endMs
      });
    }
    void pump();
  }

  /** ASR ワーカー（直列・1 発話ずつ）。 */
  async function pump() {
    if (pumping) return;
    pumping = true;
    try {
      while (!disposed && !asrDown && asrQueue.length > 0) {
        const job = asrQueue.shift();
        if (!job) break;
        await runJob(job);
      }
    } finally {
      pumping = false;
    }
  }

  /** 1 発話: transcribe → append を外側見張り付きで。失敗しても常駐は続く。 */
  async function runJob(job) {
    /** @type {ReturnType<typeof setTimeout> | undefined} */
    let watchdog;
    try {
      const guarded = new Promise((_resolve, reject) => {
        watchdog = setTimeoutImpl(() => {
          if (sttEngine === "haas") job.expired = true;
          reject(new Error(`utterance transcription exceeded ${asrOptions.utteranceTimeoutMs}ms (outer watchdog).`));
        }, asrOptions.utteranceTimeoutMs);
      });
      await Promise.race([transcribeAndAppend(job), guarded]);
      counters.asrDone += 1;
    } catch (error) {
      counters.asrFailed += 1;
      onDiagnostic({
        type: "asrFailure",
        message: error instanceof Error ? error.message : String(error),
        startMs: job.startMs,
        endMs: job.endMs
      });
    } finally {
      if (watchdog !== undefined) clearTimeoutImpl(/** @type {any} */ (watchdog));
      currentMeta = null;
    }
  }

  async function transcribeAndAppend(job) {
    // audio_ctx は whisper だけの話（ローカルの文字起こしには渡さない）。
    const audioCtx = asrOptions.dynamicAudioCtx && !useLocal
      ? computeAudioCtx(job.durationMs, asrOptions.audioCtxOptions)
      : null;
    const transcribed = await transcribe(job.wav, audioCtx != null ? { audioCtx } : undefined);
    const { text } = transcribed;
    if (disposed || (sttEngine === "haas" && (asrDown || job.expired))) return;
    currentMeta = { latencyMs: nowImpl() - job.endWallMs, audioCtx };
    // 咳払いの落とし（ローカルの文字起こしだけ・ヘッダ参照）: 正本に積む前に比べる。
    const coughSpeech = useLocal ? coughSpeechToDrop(transcribed, localSettings) : null;
    if (coughSpeech !== null) {
      dropCough(job, text, coughSpeech, currentMeta.latencyMs);
      return;
    }
    /** @type {ReturnType<typeof buffer.append>} */
    let result;
    try {
      result = buffer.append({ startMs: job.startMs, endMs: job.endMs, text });
    } catch (error) {
      // 外部購読者（S3 等）の listener 契約違反（transcript-buffer.mjs の契約: listener は
      // throw しない）。エントリ自体は push 済みで、パイプライン自前の onTranscript 通知も
      // 配信済み（最初に登録した listener）なので、診断に落として発話成功として続ける。
      onDiagnostic({
        type: "listenerError",
        message: error instanceof Error ? error.message : String(error),
        startMs: job.startMs,
        endMs: job.endMs
      });
      return;
    }
    if (!result.appended) {
      onDiagnostic({
        type: "transcriptDiscarded",
        reason: result.reason,
        startMs: job.startMs,
        endMs: job.endMs,
        latencyMs: currentMeta.latencyMs
      });
      return;
    }
    notifyOwnAppend(result, currentMeta, job);
  }

  /**
   * 咳払いと判じた区間を正本に積まずに捨てる（正本の discard = blank と同じ口・discarded の数と onDiscard）。
   * 診断には文字と確率を載せない（ヘッダ参照）。
   * @param {{ startMs: number; endMs: number }} job  @param {string} text  @param {number} speech  @param {number} latencyMs
   */
  function dropCough(job, text, speech, latencyMs) {
    counters.coughDropped += 1;
    try {
      if (typeof buffer.discard === "function") {
        buffer.discard({ startMs: job.startMs, endMs: job.endMs, text, reason: "cough", speech });
      }
    } catch (error) {
      // 外部購読者の listener 契約違反（append の throw と同じ扱い）。
      onDiagnostic({
        type: "listenerError",
        message: error instanceof Error ? error.message : String(error),
        startMs: job.startMs,
        endMs: job.endMs
      });
      return;
    }
    onDiagnostic({ type: "transcriptDiscarded", reason: "cough", startMs: job.startMs, endMs: job.endMs, latencyMs });
  }

  /**
   * ElevenLabs の commit 1 件 → 転写バッファへ 1 件（空は既存規則どおり discarded）。
   * @param {{ text: string }} commit
   */
  function handleCommit(commit) {
    if (disposed) return;
    counters.sttCommits += 1;
    const tMs = ring.totalMs(); // commit 到着時点のストリーム時刻（start = end・合意 §8）。
    const latencyMs = lastSpeechEndWallMs != null ? nowImpl() - lastSpeechEndWallMs : null;
    lastSpeechEndWallMs = null; // 物差しは「直前の commit 以降で最後の speechEnd」。
    currentMeta = { latencyMs: /** @type {any} */ (latencyMs), audioCtx: null };
    try {
      const result = buffer.append({ startMs: tMs, endMs: tMs, text: typeof commit.text === "string" ? commit.text : "" });
      if (!result.appended) {
        onDiagnostic({ type: "transcriptDiscarded", reason: result.reason, startMs: tMs, endMs: tMs, latencyMs });
      } else {
        notifyOwnAppend(result, currentMeta, { startMs: tMs, endMs: tMs });
      }
    } catch (error) {
      // 外部購読者の listener 契約違反（whisper 経路の transcribeAndAppend と同じ扱い）。
      onDiagnostic({
        type: "listenerError",
        message: error instanceof Error ? error.message : String(error),
        startMs: tMs,
        endMs: tMs
      });
    } finally {
      currentMeta = null;
    }
  }

  /** ffmpeg からの PCM チャンク → フレーム化 → リング書き込み + VAD 直列チェーン（+ ElevenLabs へ送信）。 */
  function handlePcm(chunk) {
    if (disposed) return;
    // ElevenLabs へは取り込みのバイト列をそのまま流す（繋ぎ直し中は stt 側で捨てる）。
    if (stt) stt.sendPcm(chunk);
    const frames = framer.push(chunk);
    for (const frame of frames) {
      const tMs = ring.totalMs(); // このフレームの開始時刻 = 書き込み前のストリーム末尾。
      ring.write(frame);
      counters.frames += 1;
      const f32 = int16ToFloat32(frame);
      vadChain = vadChain.then(async () => {
        if (disposed || !vad) return;
        try {
          const prob = await vad.process(f32);
          segmenter.push(prob, tMs);
        } catch (error) {
          counters.vadErrors += 1;
          onDiagnostic({
            type: "vadError",
            message: error instanceof Error ? error.message : String(error),
            tMs
          });
        }
      });
    }
  }

  /** ffmpeg の exit（再起動耐性は capture 自身が持つ）。持ち越し状態だけ仕切り直す。 */
  function handleCaptureExit(info) {
    if (disposed) return;
    onDiagnostic({ type: "ffmpegExit", ...info });
    framer.reset(); // 半端バイトはプロセス境界をまたがない。
    vad?.reset(); // 再帰状態と入力文脈を仕切り直す（ストリーム時計とリングは単調のまま）。
  }

  /** whisper-server の ready 後の死（2 経路目）。再起動しない設計判断はヘッダ参照。 */
  function handleServerExit(info) {
    if (disposed) return;
    asrDown = true;
    onDiagnostic({ type: "whisperDown", phase: "runtime", code: info.code, signal: info.signal });
    while (asrQueue.length > 0) {
      const dropped = asrQueue.shift();
      counters.asrDropped += 1;
      onDiagnostic({ type: "asrDropped", reason: "whisperDown", startMs: dropped?.startMs, endMs: dropped?.endMs });
    }
  }

  /** ローカルの文字起こしの子プロセスの ready 後の死。whisper の死と同じく再起動せず ASR を止める。 */
  function handleLocalSttExit(info) {
    if (disposed) return;
    asrDown = true;
    onDiagnostic({ type: "localSttDown", phase: "runtime", engine: sttEngine, code: info.code, signal: info.signal });
    while (asrQueue.length > 0) {
      const dropped = asrQueue.shift();
      counters.asrDropped += 1;
      onDiagnostic({ type: "asrDropped", reason: "localSttDown", startMs: dropped?.startMs, endMs: dropped?.endMs });
    }
  }

  return {
    transcriptBuffer: buffer,

    /**
     * 常駐開始: VAD init + whisper-server ready を待ってから ffmpeg を開く
     * （耳が聞こえる前にマイクを開けない＝ストリーム先頭から VAD が効く）。
     * 起動失敗（spawn 失敗を含む ready の reject = 監視 1 経路目）は部分的に開いた
     * リソースを畳んでから throw する。
     */
    async start() {
      if (started) throw new Error("earPipeline.start: already started.");
      if (disposed) throw new Error("earPipeline.start: already disposed.");
      started = true;

      if (useElevenLabs) {
        // ElevenLabs: whisper-server は起動しない。VAD 準備 → 接続（session_started）→ マイクを開く。
        vad = vadFactory(options.vad ?? {});
        stt = sttFactory({
          ...(/** @type {any} */ (options.stt?.elevenLabs) ?? {}),
          apiKey: /** @type {string} */ (options.stt?.apiKey),
          setTimeoutImpl,
          clearTimeoutImpl,
          onCommit: handleCommit,
          onStatus: (status, info) => onSttStatus(status, info),
          onDiagnostic: (d) => onDiagnostic(d)
        });
        try {
          await vad.init();
          await stt.connect();
        } catch (error) {
          await this.dispose();
          throw new Error(
            `earPipeline.start: failed to bring up ears (${error instanceof Error ? error.message : String(error)})`,
            { cause: error }
          );
        }
        if (disposed) return;
        capture = captureFactory({
          ...(options.capture ?? {}),
          sampleRate,
          channels: 1,
          onPcm: handlePcm,
          onError: (line) => onDiagnostic({ type: "ffmpegStderr", line }),
          onExit: handleCaptureExit
        });
        return;
      }

      if (useLocal) {
        // ローカル: whisper-server は起動しない。VAD 準備 → 子プロセスの ready（モデル読み込み）→ マイクを開く。
        vad = vadFactory(options.vad ?? {});
        localStt = localSttFactory({
          ...(/** @type {any} */ (options.stt?.local?.client) ?? {}),
          engine: /** @type {"parakeet" | "zipformer" | "haas"} */ (sttEngine),
          modelsDir: options.stt?.local?.modelsDir,
          threads: localSettings.threads,
          hotwords: localSettings.hotwords,
          hotwordsScore: localSettings.hotwordsScore,
          // 咳払いの落とし: 判定にかける文字数の上限（0 = 判定しない・子に AudioTagging を作らせない）。
          audioTaggingMaxChars: localSettings.coughMaxChars,
          setTimeoutImpl,
          clearTimeoutImpl,
          onExit: handleLocalSttExit,
          onReady: (info) => {
            const tagging = info && typeof info.audioTagging === "object" && info.audioTagging ? info.audioTagging : null;
            onDiagnostic({
              type: "localSttReady",
              engine: sttEngine,
              loadMs: info.loadMs,
              decodingMethod: info.decodingMethod,
              hotwordsUsed: info.hotwordsUsed.length,
              hotwordsDropped: info.hotwordsDropped,
              audioTagging: tagging ? tagging.enabled === true : false
            });
            // 判定なし: 理由は決まった語だけ（子の文言は出さない）。警告にするかは場が決める。
            if (tagging && tagging.enabled !== true) {
              onDiagnostic({ type: "audioTaggingOff", engine: sttEngine, reason: audioTaggingOffCause(tagging.reason) });
            }
          }
        });
        try {
          await vad.init();
          await localStt.ready;
        } catch (error) {
          await this.dispose();
          throw new Error(
            `earPipeline.start: failed to bring up ears (${error instanceof Error ? error.message : String(error)})`,
            { cause: error }
          );
        }
        if (disposed) return;
        if (options.transcribeImpl == null) {
          const client = localStt;
          transcribe = (wavBytes) => client.transcribe(wavBytes);
        }
        capture = captureFactory({
          ...(options.capture ?? {}),
          sampleRate,
          channels: 1,
          onPcm: handlePcm,
          onError: (line) => onDiagnostic({ type: "ffmpegStderr", line }),
          onExit: handleCaptureExit
        });
        return;
      }

      vad = vadFactory(options.vad ?? {});
      server = serverFactory({
        ...whisperOptions,
        onExit: handleServerExit,
        onStderr: whisperOptions.onStderr ?? (() => {})
      });
      try {
        await vad.init();
        await server.ready;
      } catch (error) {
        await this.dispose();
        throw new Error(
          `earPipeline.start: failed to bring up ears (${error instanceof Error ? error.message : String(error)})`,
          { cause: error }
        );
      }
      if (options.transcribeImpl == null) {
        transcribe = createWhisperInference({
          baseUrl: server.baseUrl,
          timeoutMs: asrOptions.timeoutMs,
          prompt: whisperOptions.prompt,
          promptProvider: whisperOptions.promptProvider
        }).transcribe;
      }

      capture = captureFactory({
        ...(options.capture ?? {}),
        sampleRate,
        channels: 1,
        onPcm: handlePcm,
        onError: (line) => onDiagnostic({ type: "ffmpegStderr", line }),
        onExit: handleCaptureExit
      });
    },

    isDisposed: () => disposed,

    /** ストリーム時計の現在値（= 取り込んだ音声の総 ms）。 */
    streamMs: () => ring.totalMs(),

    stats() {
      return { ...counters, sttEngine, asrQueue: asrQueue.length, asrDown, buffer: buffer.stats() };
    },

    /**
     * 全畳み（冪等）: ffmpeg → キュー → VAD → whisper-server。
     * 見張りタイマは各 runJob の finally で clear されるため、ここでは待たずに畳んでよい
     * （処理中の transcribe は server kill で速やかに reject → finally が回収する）。
     */
    async dispose() {
      if (disposed) return;
      disposed = true;
      capture?.dispose();
      asrQueue.length = 0;
      try {
        await vad?.dispose();
      } catch {
        // best-effort
      }
      server?.dispose();
      stt?.dispose();
      localStt?.dispose();
    }
  };
}
