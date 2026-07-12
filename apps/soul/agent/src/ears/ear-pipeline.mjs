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
 * ── クリーンシャットダウン ─────────────────────────────────────────
 *  dispose() 一発で ffmpeg・VAD セッション・whisper-server・キュー・タイマが全部畳まれる。
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
 *   whisper-server.mjs 参照）/ extraArgs / readyTimeoutMs）。
 * @param {object} [options.asr]      { queueMax=4, utteranceTimeoutMs=45000, timeoutMs=30000,
 *   dynamicAudioCtx=true, audioCtxOptions }。
 * @param {number} [options.ringMs=40000]  PCM リングバッファ保持長。
 * @param {(event: object) => void} [options.onVadEvent]     speechStart/End/Cancel（全部）。
 * @param {(entry: object, meta: { latencyMs: number; audioCtx: number | null }) => void} [options.onTranscript]
 *   転写がバッファに積まれた（正経路）。
 * @param {(diag: object) => void} [options.onDiagnostic]    落とした発話・死・破棄などの診断。
 * @param {() => number} [options.nowImpl]  壁時計（レイテンシ計測用）。既定 Date.now。
 * @param {typeof setTimeout} [options.setTimeoutImpl]
 * @param {typeof clearTimeout} [options.clearTimeoutImpl]
 * @param {typeof createFfmpegCapture} [options.captureFactory]   テスト注入。
 * @param {typeof createSileroVad} [options.vadFactory]           テスト注入。
 * @param {typeof createWhisperServer} [options.serverFactory]    テスト注入。
 * @param {(wavBytes: Uint8Array, opts?: { audioCtx?: number }) => Promise<{ text: string; rawText: string }>} [options.transcribeImpl]
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

  const onVadEvent = options.onVadEvent ?? (() => {});
  const onTranscript = options.onTranscript ?? (() => {});
  const onDiagnostic = options.onDiagnostic ?? (() => {});

  const buffer = createTranscriptBuffer({ nowImpl });
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
  /** @type {(wavBytes: Uint8Array, opts?: { audioCtx?: number }) => Promise<{ text: string; rawText: string }>} */
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
    vadErrors: 0
  };

  /** 現在処理中ジョブのメタ（ワーカーは直列なので 1 個で足りる）。 */
  /** @type {{ latencyMs: number; audioCtx: number | null } | null} */
  let currentMeta = null;
  // パイプライン自身の転写通知は「最初に登録した自前 listener」で受ける。
  // transcript-buffer の listener は登録順に呼ばれるため、後から登録された外部購読者（S3 等）が
  // throw しても、この通知は既に配信済み＝外部の契約違反に巻き込まれない（note 4 の線引き）。
  buffer.onAppend((entry) => {
    onTranscript(entry, currentMeta ?? { latencyMs: NaN, audioCtx: null });
  });

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
    // [0, 実データ末尾] への clamp はリングバッファの契約（flush 時 pad 超過・maxSpeech 分割の
    // 2×pad 重なり・容量超過破棄のどれが来ても安全）。
    const cut = ring.slice({ startMs: event.startMs, endMs: event.endMs });
    if (cut.samples.length === 0) {
      onDiagnostic({ type: "emptyCut", startMs: event.startMs, endMs: event.endMs });
      return;
    }
    if (asrDown) {
      counters.asrSkipped += 1;
      onDiagnostic({ type: "asrSkipped", reason: "whisperDown", startMs: cut.startMs, endMs: cut.endMs });
      return;
    }
    const wav = encodeWav(cut.samples, { sampleRate, channels: 1, bitsPerSample: 16 });
    asrQueue.push({
      wav,
      startMs: cut.startMs,
      endMs: cut.endMs,
      durationMs: cut.endMs - cut.startMs,
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
    const audioCtx = asrOptions.dynamicAudioCtx
      ? computeAudioCtx(job.durationMs, asrOptions.audioCtxOptions)
      : null;
    const { text } = await transcribe(job.wav, audioCtx != null ? { audioCtx } : undefined);
    if (disposed) return;
    currentMeta = { latencyMs: nowImpl() - job.endWallMs, audioCtx };
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
    }
  }

  /** ffmpeg からの PCM チャンク → フレーム化 → リング書き込み + VAD 直列チェーン。 */
  function handlePcm(chunk) {
    if (disposed) return;
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
          timeoutMs: asrOptions.timeoutMs
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
      return { ...counters, asrQueue: asrQueue.length, asrDown, buffer: buffer.stats() };
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
    }
  };
}
