// @ts-check
/**
 * AivisSpeech クライアント（S1 Domain B）— apps/soul/agent。
 *
 * AivisSpeech engine（実機 http://127.0.0.1:10101, engine 1.1.0-dev）の 2 エンドポイントを
 * 叩く薄いクライアント。組み込み `fetch` のみ（依存ゼロ・agent-sdk 以外の追加依存なし）。
 *
 *  - `POST /audio_query?text=<text>&speaker=<id>` → query JSON（moras + prePhonemeLength 等）。
 *  - `POST /synthesis?speaker=<id>`（body = query JSON）→ WAV バイト列（RIFF/WAVE PCM）。
 *
 * ── 純関数部分（テスト可能に切り出し）─────────────────────────────────────
 *  `flattenMoras` / `parseAudioQuery` は audio_query JSON から写像の入力材料
 *  （moras 平坦化列・prePhonemeSec・postPhonemeSec）を取り出す純関数。I/O を持たないので
 *  fixture で単体検証できる（GOLDEN_MORAS_KONNICHIWA が平坦化後の形の前例）。
 *
 * ── 実機構造の事実（2026-07-12 実測・fixtures.mjs と整合）─────────────────
 *  「こんにちは、テストです」の audio_query は accent_phrases 2 要素:
 *    AP0.moras = コ:o ン:N ニ:i チ:i ワ:a ,:pau （句読点「、」が moras 内に vowel="pau" で出る）
 *    AP1.moras = テ:e ス:u ト:o デ:e ス:u
 *    両 AP とも pause_mora=null。prePhonemeLength=0.1, postPhonemeLength=0.1。
 *  → このエンジンでは pause_mora を使わないが、VOICEVOX 系互換のため pause_mora が非 null の
 *    場合は当該 accent_phrase の末尾モーラとして平坦化列に加える（両対応）。
 */

const DEFAULT_BASE_URL = "http://127.0.0.1:10101";
/** 話者 ID 既定 = まお（ノーマル）。s1-planning-inventory §3 の実測値。 */
export const DEFAULT_SPEAKER_ID = 888753760;

/**
 * audio_query の accent_phrases を平坦なモーラ列に畳む純関数。
 * 各 accent_phrase の moras を順に連結し、pause_mora が非 null ならその accent_phrase の
 * 末尾（次フレーズとの境界の「間」）としてモーラ列に加える。返す各要素は audio_query の
 * moras 要素そのもの（写像が使う `vowel` を持つ生オブジェクト）。
 *
 * @param {{ accent_phrases?: unknown }} audioQuery
 * @returns {Array<{ text?: unknown; vowel?: unknown }>}
 * @throws {TypeError} accent_phrases が配列でない / moras が配列でない。
 */
export function flattenMoras(audioQuery) {
  if (audioQuery == null || typeof audioQuery !== "object") {
    throw new TypeError("audio_query must be an object.");
  }
  const accentPhrases = /** @type {any} */ (audioQuery).accent_phrases;
  if (!Array.isArray(accentPhrases)) {
    throw new TypeError("audio_query.accent_phrases must be an array.");
  }
  /** @type {Array<{ text?: unknown; vowel?: unknown }>} */
  const moras = [];
  for (const phrase of accentPhrases) {
    if (phrase == null || typeof phrase !== "object") {
      throw new TypeError("each accent_phrase must be an object.");
    }
    const phraseMoras = /** @type {any} */ (phrase).moras;
    if (!Array.isArray(phraseMoras)) {
      throw new TypeError("accent_phrase.moras must be an array.");
    }
    for (const mora of phraseMoras) {
      moras.push(mora);
    }
    // VOICEVOX 系互換: pause_mora（フレーズ間の無音モーラ）が非 null なら平坦化列に加える。
    // このエンジン（AivisSpeech 1.1.0-dev）では null。加わっても vowel は enum 外（pau 等）で
    // buildSpeechTimeline が脱落させ時間ギャップとして残す。
    const pauseMora = /** @type {any} */ (phrase).pause_mora;
    if (pauseMora != null) {
      moras.push(pauseMora);
    }
  }
  return moras;
}

/**
 * audio_query JSON → buildSpeechTimeline の入力材料（moras 平坦化列 + pre/post 無音秒）。
 * @param {{ accent_phrases?: unknown; prePhonemeLength?: unknown; postPhonemeLength?: unknown }} audioQuery
 * @returns {{ moras: Array<{ text?: unknown; vowel?: unknown }>; prePhonemeSec: number; postPhonemeSec: number }}
 * @throws {TypeError} 構造不正 / prePhonemeLength・postPhonemeLength が有限数でない。
 */
export function parseAudioQuery(audioQuery) {
  const moras = flattenMoras(audioQuery);
  const pre = /** @type {any} */ (audioQuery).prePhonemeLength;
  const post = /** @type {any} */ (audioQuery).postPhonemeLength;
  if (typeof pre !== "number" || !Number.isFinite(pre)) {
    throw new TypeError(
      `audio_query.prePhonemeLength must be a finite number; got ${String(pre)}.`
    );
  }
  if (typeof post !== "number" || !Number.isFinite(post)) {
    throw new TypeError(
      `audio_query.postPhonemeLength must be a finite number; got ${String(post)}.`
    );
  }
  return { moras, prePhonemeSec: pre, postPhonemeSec: post };
}

/**
 * AivisSpeech クライアントを作る。
 * @param {object} [options]
 * @param {string} [options.baseUrl]  既定 http://127.0.0.1:10101。
 * @param {number|string} [options.speaker]  話者 ID。既定 888753760（まお ノーマル）。
 * @param {typeof fetch} [options.fetchImpl]  fetch の差し替え（テスト用）。既定 globalThis.fetch。
 * @returns {{
 *   baseUrl: string;
 *   speaker: number|string;
 *   audioQuery: (text: string) => Promise<any>;
 *   synthesis: (query: any) => Promise<Uint8Array>;
 * }}
 */
export function createTtsClient(options = {}) {
  const baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
  const speaker = options.speaker ?? DEFAULT_SPEAKER_ID;
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  if (typeof fetchImpl !== "function") {
    throw new TypeError("no fetch implementation available (pass options.fetchImpl).");
  }

  /**
   * `POST /audio_query?text=..&speaker=..` → query JSON。
   * @param {string} text  合成する一文。空文字は投げる。
   * @returns {Promise<any>}
   */
  async function audioQuery(text) {
    if (typeof text !== "string" || text.length === 0) {
      throw new TypeError("audioQuery(text): text must be a non-empty string.");
    }
    const url =
      `${baseUrl}/audio_query?text=${encodeURIComponent(text)}` +
      `&speaker=${encodeURIComponent(String(speaker))}`;
    const response = await fetchImpl(url, {
      method: "POST",
      headers: { accept: "application/json" }
    });
    if (!response.ok) {
      const body = await safeReadText(response);
      throw new Error(
        `AivisSpeech /audio_query failed: HTTP ${response.status} ${response.statusText}` +
          (body ? ` — ${body}` : "")
      );
    }
    return response.json();
  }

  /**
   * `POST /synthesis?speaker=..`（body = query JSON）→ WAV バイト列。
   * @param {any} query  audioQuery の返り（そのまま body に載せる）。
   * @returns {Promise<Uint8Array>}  RIFF/WAVE PCM のバイト列。
   */
  async function synthesis(query) {
    if (query == null || typeof query !== "object") {
      throw new TypeError("synthesis(query): query must be the audio_query object.");
    }
    const url = `${baseUrl}/synthesis?speaker=${encodeURIComponent(String(speaker))}`;
    const response = await fetchImpl(url, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "audio/wav" },
      body: JSON.stringify(query)
    });
    if (!response.ok) {
      const body = await safeReadText(response);
      throw new Error(
        `AivisSpeech /synthesis failed: HTTP ${response.status} ${response.statusText}` +
          (body ? ` — ${body}` : "")
      );
    }
    const buffer = await response.arrayBuffer();
    return new Uint8Array(buffer);
  }

  return { baseUrl, speaker, audioQuery, synthesis };
}

/**
 * エラー本文の読み取りは best-effort（失敗しても元のエラー報告を優先）。
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
