// @ts-check
/**
 * whisper-server `/inference` クライアント（S2 Domain B）— apps/soul/agent。
 *
 * 発話単位 WAV（Uint8Array）を multipart/form-data で POST し、転写テキストを得る薄い
 * クライアント。whisper-server にストリーミング WS は無く、発話単位 WAV の往復のみ
 * （s2-planning-inventory §1）。tts-client.mjs と同型の fetchImpl 注入で機械テストは
 * 実サーバ非依存。実機疎通は preflight-asr.mjs の領分。
 *
 * ── multipart 契約（whisper.cpp examples/server README 既知仕様・preflight で実機照合）──
 *  - field `file`: WAV バイト列（filename 付き）。
 *  - field `temperature`: サンプリング温度（既定 "0.0" = 決定論寄り）。
 *  - field `response_format`: "json" → レスポンス `{"text": "..."}`。
 *  multipart の組み立ては Node 組み込み FormData/Blob（Node 18+ グローバル・本環境 v22.14.0）。
 *  依存追加なし。
 *
 * ── 転写後処理 ─────────────────────────────────────────────────────
 *  `normalizeTranscript` = 前後空白トリムのみ（whisper 出力は先頭スペース・末尾改行が付く癖
 *  がある）。それ以上の正規化（句読点・フィラー除去等）は S3 の領分なのでやらない。
 */

/** 既定の /inference タイムアウト。kotoba q5_0 CPU の発話単位転写は数百 ms〜数秒想定。 */
const DEFAULT_TIMEOUT_MS = 30000;
const DEFAULT_INFERENCE_PATH = "/inference";

/**
 * whisper-server `/inference` レスポンス JSON → `{ text }`。純関数（fixture テスト対象）。
 * @param {unknown} json
 * @returns {{ text: string }}
 * @throws {TypeError} オブジェクトでない / text フィールドが文字列でない。
 */
export function parseInferenceResponse(json) {
  if (json == null || typeof json !== "object") {
    throw new TypeError(`whisper /inference response must be an object; got ${typeof json}.`);
  }
  const text = /** @type {any} */ (json).text;
  if (typeof text !== "string") {
    throw new TypeError(
      `whisper /inference response is missing a string "text" field; got ${typeof text}.`
    );
  }
  return { text };
}

/**
 * 転写テキストの後処理純関数。前後空白（whisper の先頭スペース・末尾改行の癖）のみトリム。
 * それ以上の正規化は S3 の領分（過剰にいじらない）。
 * @param {string} text
 * @returns {string}
 */
export function normalizeTranscript(text) {
  if (typeof text !== "string") {
    throw new TypeError(`normalizeTranscript: text must be a string; got ${typeof text}.`);
  }
  return text.trim();
}

/**
 * whisper-server クライアントを作る。
 * @param {object} [options]
 * @param {string} [options.baseUrl]  既定 http://127.0.0.1:8178（whisper-server.mjs の魂既定と対）。
 * @param {string} [options.inferencePath="/inference"]
 * @param {number} [options.timeoutMs=30000]  1 リクエストのタイムアウト（超過で abort → reject）。
 * @param {number} [options.temperature=0]
 * @param {typeof fetch} [options.fetchImpl]  fetch の差し替え（テスト用）。既定 globalThis.fetch。
 * @param {typeof setTimeout} [options.setTimeoutImpl]  タイムアウトタイマの差し替え（テスト用）。
 * @param {typeof clearTimeout} [options.clearTimeoutImpl]
 * @returns {{
 *   baseUrl: string;
 *   transcribe: (wavBytes: Uint8Array) => Promise<{ text: string; rawText: string }>;
 * }}
 */
export function createWhisperClient(options = {}) {
  const baseUrl = (options.baseUrl ?? "http://127.0.0.1:8178").replace(/\/+$/, "");
  const inferencePath = options.inferencePath ?? DEFAULT_INFERENCE_PATH;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const temperature = options.temperature ?? 0;
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const setTimeoutImpl = options.setTimeoutImpl ?? setTimeout;
  const clearTimeoutImpl = options.clearTimeoutImpl ?? clearTimeout;
  if (typeof fetchImpl !== "function") {
    throw new TypeError("createWhisperClient: no fetch implementation available (pass options.fetchImpl).");
  }

  /**
   * 発話単位 WAV → 転写テキスト。
   * @param {Uint8Array} wavBytes  RIFF/WAVE PCM バイト列（encodeWav の出力等）。
   * @returns {Promise<{ text: string; rawText: string }>}  text = トリム済み / rawText = サーバ出力そのまま。
   * @throws 非 200（HTTP エラー本文込み）/ タイムアウト / 接続拒否 / レスポンス構造不正。
   */
  async function transcribe(wavBytes) {
    if (!(wavBytes instanceof Uint8Array)) {
      throw new TypeError("transcribe(wavBytes): wavBytes must be a Uint8Array.");
    }
    const url = `${baseUrl}${inferencePath}`;

    const form = new FormData();
    form.append("file", new Blob([wavBytes], { type: "audio/wav" }), "speech.wav");
    form.append("temperature", String(temperature));
    form.append("response_format", "json");

    const controller = new AbortController();
    // タイムアウトタイマは unref しない: リクエスト待機中は event loop を保持するのが正しく、
    // unref すると「タイマだけが残った瞬間に loop が干上がり abort が発火しない」レースになる
    // （node:test の cancelledByParent で実際に観測）。finally で必ず clear するため残留しない。
    const timer = setTimeoutImpl(() => {
      controller.abort(new Error(`whisper /inference timed out after ${timeoutMs}ms.`));
    }, timeoutMs);

    let response;
    try {
      response = await fetchImpl(url, {
        method: "POST",
        body: form,
        signal: controller.signal
      });
    } catch (error) {
      // abort 理由（タイムアウト Error）があればそちらを伝播する。
      if (controller.signal.aborted && controller.signal.reason instanceof Error) {
        throw controller.signal.reason;
      }
      throw error;
    } finally {
      clearTimeoutImpl(/** @type {any} */ (timer));
    }

    if (!response.ok) {
      const body = await safeReadText(response);
      throw new Error(
        `whisper /inference failed: HTTP ${response.status} ${response.statusText}` +
          (body ? ` — ${body}` : "")
      );
    }
    const json = await response.json();
    const { text: rawText } = parseInferenceResponse(json);
    return { text: normalizeTranscript(rawText), rawText };
  }

  return { baseUrl, transcribe };
}

/**
 * エラー本文の読み取りは best-effort（失敗しても元のエラー報告を優先）。tts-client と同型。
 * @param {Response} response
 * @returns {Promise<string>}
 */
async function safeReadText(response) {
  try {
    const text = await response.text();
    return text.slice(0, 500);
  } catch {
    return "";
  }
}
