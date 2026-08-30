// @ts-check
/**
 * 動的 audio_ctx 対応の /inference 呼び出し（S2 Domain C・レイテンシチューニングの本体）
 * — apps/soul/agent。
 *
 * ── なぜ whisper-client.mjs と別モジュールか ─────────────────────────────
 *  whisper の CPU 推論コストは 30s 固定窓のエンコーダが支配的で、**音声長に依らずほぼ一定**
 *  （Domain B 実測 warm ≈6.6s@8T）。whisper.cpp の audio_ctx を発話長に比例して絞ると、
 *  同じ音声で warm ≈1.5s@8T まで縮む（S2 Domain C 実測・転写品質は全窓と一致）。
 *  `/inference` は multipart フィールド `audio_ctx` を受けることを実機照合済み（サーバ再起動
 *  不要の**リクエスト単位の動的設定**が可能）。whisper-client.mjs（Domain B 成果・変更禁止）は
 *  追加フィールドの注入点を持たないため、audio_ctx 付き呼び出しをこの新規モジュールに置く。
 *  タイムアウト/abort の規律（unref しない + finally で必ず clear）は whisper-client と同一。
 *  ※ 将来 whisper-client へ統合するのが素直（s2-followup に記録）。
 *
 * ── audio_ctx の式（実測に基づく・2026-07-12）───────────────────────────
 *  whisper のエンコーダ出力は 30s = 1500 トークン（= 50 トークン/秒）。発話長ちょうど
 *  （margin 0）では反復・繰り返しアーティファクトが出る（4.4s 音声に ac=220 で実測）。
 *  margin +96 と下限 256 で全計測ケース（1.7s〜14.6s の TTS 日本語）の転写が全窓と一致した:
 *    audioCtx = clamp(ceil(durationSec * 50) + 96, 256, 1500)
 *  下限 256 が要るのは短発話で相対 margin が薄くなるため（1.7s 音声に ac=124 で「そうだね」→
 *  「そうだに?に」の劣化を実測。ac=192 以上でクリーン）。1500 以上は全窓と同じなので cap。
 */

import { parseInferenceResponse, normalizeTranscript } from "./whisper-client.mjs";

/** whisper のエンコーダ出力トークン数/秒（30s 窓 = 1500）。 */
export const WHISPER_TOKENS_PER_SECOND = 50;
/** 全窓の audio_ctx（= 縮小なし）。 */
export const WHISPER_FULL_AUDIO_CTX = 1500;

/** 実測で品質が全窓一致した既定（margin +96・下限 256）。 */
export const DEFAULT_AUDIO_CTX_OPTIONS = Object.freeze({
  tokensPerSecond: WHISPER_TOKENS_PER_SECOND,
  marginTokens: 96,
  minTokens: 256,
  maxTokens: WHISPER_FULL_AUDIO_CTX
});

/**
 * 耳の器官の刷り込み prompt（v0・コード内定数・wave-plan §2 裁定B）。
 *
 * Whisper の `prompt`（initial prompt）は**デコード前の語彙バイアス**——サンプリング開始点の
 * 文脈として使われるだけで、転写バッファ/セグメンタ/VAD の一切を通らない（それらは音声側の
 * パイプラインで prompt を知らない）。つまり prompt を注入しても**転写正本の形は不変**
 * （返り値 `{text, rawText}` は常にサーバ応答由来）。AI 相方の名前「コーディ」をここで刷り込み、
 * 転写での固有名詞認識を上げる（inventory §B-1・出自 s6-followup.md §2）。
 */
export const DEFAULT_WHISPER_PROMPT = "こーでぃー、コーディ。";

/**
 * 発話長 → audio_ctx を計算する純関数。
 * @param {number} durationMs  発話の長さ（ms）。
 * @param {Partial<typeof DEFAULT_AUDIO_CTX_OPTIONS>} [options]
 * @returns {number}
 */
export function computeAudioCtx(durationMs, options = {}) {
  if (typeof durationMs !== "number" || !Number.isFinite(durationMs) || durationMs < 0) {
    throw new TypeError(`computeAudioCtx: durationMs must be a finite number >= 0; got ${durationMs}.`);
  }
  const cfg = { ...DEFAULT_AUDIO_CTX_OPTIONS, ...options };
  // ms のまま乗算してから除算（(durationMs/1000)*tok の浮動小数誤差で ceil が 1 ずれるのを防ぐ）。
  const raw = Math.ceil((durationMs * cfg.tokensPerSecond) / 1000) + cfg.marginTokens;
  return Math.min(Math.max(raw, cfg.minTokens), cfg.maxTokens);
}

/**
 * audio_ctx 対応の /inference 呼び出しを作る。
 * @param {object} [options]
 * @param {string} [options.baseUrl]  既定 http://127.0.0.1:8178（whisper-server.mjs の魂既定と対）。
 * @param {string} [options.inferencePath="/inference"]
 * @param {number} [options.timeoutMs=30000]
 * @param {number} [options.temperature=0]
 * @param {string} [options.prompt=DEFAULT_WHISPER_PROMPT]  Whisper initial prompt（語彙バイアス）。
 *   省略時は既定の刷り込み文が常時注入される。`""`（空文字）を明示指定すると無効化（テスト用の逃げ道）。
 * @param {() => string} [options.promptProvider]  Whisper initial prompt をリクエスト時に解決する getter。
 *   指定時は推論器の生成時に値を固定せず、各 `transcribe()` 呼び出しで 1 回だけ評価する。
 *   非関数または非文字列の結果は `options.prompt`（未指定なら既定値）へフォールバックする。
 * @param {typeof fetch} [options.fetchImpl]
 * @param {typeof setTimeout} [options.setTimeoutImpl]
 * @param {typeof clearTimeout} [options.clearTimeoutImpl]
 * @returns {{
 *   baseUrl: string;
 *   transcribe: (wavBytes: Uint8Array, opts?: { audioCtx?: number }) => Promise<{ text: string; rawText: string }>;
 * }}
 */
export function createWhisperInference(options = {}) {
  const baseUrl = (options.baseUrl ?? "http://127.0.0.1:8178").replace(/\/+$/, "");
  const inferencePath = options.inferencePath ?? "/inference";
  const timeoutMs = options.timeoutMs ?? 30000;
  const temperature = options.temperature ?? 0;
  // `prompt` は従来どおり生成時に決める literal。provider があればリクエスト時に上書きするが、
  // provider 未指定/非関数（または getter が非文字列を返す）では literal/既定へ戻る。
  const prompt = typeof options.prompt === "string" ? options.prompt : DEFAULT_WHISPER_PROMPT;
  const promptProvider = typeof options.promptProvider === "function" ? options.promptProvider : null;
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const setTimeoutImpl = options.setTimeoutImpl ?? setTimeout;
  const clearTimeoutImpl = options.clearTimeoutImpl ?? clearTimeout;
  if (typeof fetchImpl !== "function") {
    throw new TypeError("createWhisperInference: no fetch implementation available (pass options.fetchImpl).");
  }

  /**
   * 発話単位 WAV → 転写テキスト（audio_ctx をリクエスト単位で注入できる）。
   * @param {Uint8Array} wavBytes
   * @param {{ audioCtx?: number }} [opts]  audioCtx 省略/null で全窓（フィールド不送出）。
   */
  async function transcribe(wavBytes, opts = {}) {
    if (!(wavBytes instanceof Uint8Array)) {
      throw new TypeError("transcribe(wavBytes): wavBytes must be a Uint8Array.");
    }
    const audioCtx = opts.audioCtx;
    if (audioCtx != null && (!Number.isInteger(audioCtx) || audioCtx <= 0)) {
      throw new RangeError(`transcribe: audioCtx must be a positive integer; got ${audioCtx}.`);
    }
    // 現在の identity を含む動的 prompt は、器の生成時ではなく発話ごとに読む。
    const resolvedPrompt = promptProvider ? promptProvider() : prompt;
    const requestPrompt = typeof resolvedPrompt === "string" ? resolvedPrompt : prompt;
    const form = new FormData();
    form.append("file", new Blob([wavBytes], { type: "audio/wav" }), "speech.wav");
    form.append("temperature", String(temperature));
    form.append("response_format", "json");
    if (audioCtx != null) {
      form.append("audio_ctx", String(audioCtx));
    }
    if (requestPrompt) {
      // リクエスト毎の常時注入（whisper.cpp v1.9.1 server は /inference の `prompt` マルチパート
      // form field を毎回受理・inventory §B-1）。デコード前の語彙バイアスのみで、転写バッファ/
      // セグメンタ/VAD は一切通らない（正本の形は不変・戻り値はサーバ応答のテキストのみ由来）。
      form.append("prompt", requestPrompt);
    }

    const controller = new AbortController();
    // タイムアウトタイマは unref しない + finally で必ず clear（whisper-client と同じ規律・
    // unref だけが loop に残ると pending Promise が未決着になるレースの回避）。
    const timer = setTimeoutImpl(() => {
      controller.abort(new Error(`whisper /inference timed out after ${timeoutMs}ms.`));
    }, timeoutMs);

    let response;
    try {
      response = await fetchImpl(`${baseUrl}${inferencePath}`, {
        method: "POST",
        body: form,
        signal: controller.signal
      });
      if (!response.ok) {
        const body = await response
          .text()
          .then((t) => t.slice(0, 500))
          .catch(() => "");
        throw new Error(
          `whisper /inference failed: HTTP ${response.status} ${response.statusText}` +
            (body ? ` — ${body}` : "")
        );
      }
      const json = await response.json();
      const { text: rawText } = parseInferenceResponse(json);
      return { text: normalizeTranscript(rawText), rawText };
    } catch (error) {
      if (controller.signal.aborted && controller.signal.reason instanceof Error) {
        throw controller.signal.reason;
      }
      throw error;
    } finally {
      // 本文読み取りまで含めて timer の覆いの内側に置く（whisper-client note 1 の教訓を
      // このモジュールでは構造で回収: clear は try 全体の finally にのみある）。
      clearTimeoutImpl(/** @type {any} */ (timer));
    }
  }

  return { baseUrl, transcribe };
}
