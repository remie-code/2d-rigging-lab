// @ts-check
/**
 * 声の差し替え口の代役（声の差し替え Wave 2 のテスト用）— apps/soul/agent。
 *
 * VoiceEngine の形（engines/voice-engine.mjs）を持ち、文ごとに決まったかたまりを返す。既定は
 * format(24000Hz mono) → timeline(1 要素) → audio(480 byte) → end。`chunksFor` で文ごとの中身を、
 * `synthesizeImpl` で列そのもの（遅らせる・途中で投げる等）を差し替えられる。頼まれた文と signal を記録する。
 * 実 TTS は叩かない。
 */

import { createEngineStatusCell } from "../voice/engines/engine-status.mjs";

/** @param {string} _text */
export function defaultFakeChunks(_text) {
  return [
    { type: "format", sampleRate: 24000, channels: 1 },
    { type: "timeline", entries: [{ timeMs: 0, vowel: "a", s: 0.5 }] },
    { type: "audio", pcm: new Uint8Array(480) },
    { type: "end" }
  ];
}

/**
 * @param {object} [options]
 * @param {(text: string, callIndex: number) => Array<any>} [options.chunksFor]
 * @param {(text: string, options: { signal?: AbortSignal; onTrace?: Function }, callIndex: number) => AsyncIterable<any>} [options.synthesizeImpl]
 * @param {string} [options.kind]
 */
export function createFakeVoiceEngine(options = {}) {
  const status = createEngineStatusCell("up");
  /** @type {Array<{ text: string; signal: AbortSignal | undefined }>} */
  const requests = [];
  let disposed = false;
  const chunksFor = options.chunksFor ?? defaultFakeChunks;
  return {
    kind: options.kind ?? "fake",
    requests,
    get status() {
      return status.get();
    },
    onStatus: (/** @type {any} */ listener) => status.onStatus(listener),
    setStatus: (/** @type {any} */ next) => status.set(next),
    /** @param {string} text @param {{ signal?: AbortSignal; onTrace?: Function }} [synthOptions] */
    synthesize(text, synthOptions = {}) {
      const callIndex = requests.length;
      requests.push({ text, signal: synthOptions.signal });
      if (options.synthesizeImpl) return options.synthesizeImpl(text, synthOptions, callIndex);
      const chunks = chunksFor(text, callIndex);
      return (async function* () {
        for (const chunk of chunks) {
          await Promise.resolve();
          yield chunk;
        }
      })();
    },
    get disposed() {
      return disposed;
    },
    dispose() {
      disposed = true;
      status.set("down");
    }
  };
}

/**
 * 器への接続の代役（intent.speechStream の 3 つ + 口の release）。送ったものを記録し、既定は全部 accepted。
 * @param {object} [options]
 * @param {(op: "open" | "append" | "end", utteranceId: string, timeline?: unknown) => any} [options.reply]
 *   返りを差し替える（throw も可・Promise も可）。未指定の op は accepted。
 */
export function createFakeSpeechChannel(options = {}) {
  /** @type {Array<{ op: string; utteranceId?: string; timeline?: any; intent?: any }>} */
  const sent = [];
  let requestNumber = 0;
  const accepted = () => {
    requestNumber += 1;
    return { result: "accepted", error: null, rttMs: 1, requestId: `req-${requestNumber}`, serializedUtf8Bytes: 100 + requestNumber };
  };
  /** @param {"open" | "append" | "end"} op @param {string} utteranceId @param {unknown} [timeline] */
  const reply = async (op, utteranceId, timeline) => {
    sent.push({ op, utteranceId, ...(timeline === undefined ? {} : { timeline }) });
    if (options.reply) {
      const custom = await options.reply(op, utteranceId, timeline);
      if (custom !== undefined) return custom;
    }
    return accepted();
  };
  return {
    sent,
    /** @param {string} utteranceId */
    openSpeech: (utteranceId) => reply("open", utteranceId),
    /** @param {string} utteranceId @param {unknown} timeline */
    appendSpeech: (utteranceId, timeline) => reply("append", utteranceId, timeline),
    /** @param {string} utteranceId */
    endSpeech: (utteranceId) => reply("end", utteranceId),
    /** @param {any} intent */
    async sendSet(intent) {
      sent.push({ op: "set", intent });
      return { result: "accepted", error: null, rttMs: 1 };
    },
    async sendEnvelope() {
      return { result: "accepted", error: null, rttMs: 1 };
    },
    ops: () => sent.map((entry) => entry.op)
  };
}
