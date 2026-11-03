// @ts-check
/**
 * Discord の人ごとの音を耳へ流す小さな部品（Discord モード Domain D・discord-mode.md §6.2・§6.4）— apps/soul/agent。
 *
 *  - isOpusSilenceFrame: 3 バイトの無音のフレーム（`F8 FF FE`）。デコードの前に捨てる（§6.4 の 1）。
 *  - createOpusDecoder16k: 人ごとに 1 つの Opus のデコーダ。**直に 16kHz モノラルにデコードする**（外部 §3.1 の実測）。
 *  - createSpeakerAudioSource: 耳（ear-pipeline）の音の入口 `captureFactory` と同じ形の口。耳が start の中で captureFactory を
 *    呼ぶまで（whisper のモデル読み込み・ElevenLabs の接続の間）は音を溜め、呼ばれたら溜めた分から順に `onPcm` へ流す。
 *    溜める量には上限がある（古い方から捨てる）。畳んだら何も流さない。
 *  - silencePcm: 購読の終わり（黙った）に足す短い無音（§6.2【推測】: Discord は黙っている間は音を送らないので、耳の区切りが
 *    閉じるよう、こちらで無音を流す）。
 *
 * 声（音声データ）はどこにも保存しない（設計 §10）。溜めるのは耳が起きるまでのメモリの中だけ。
 */

/** 耳に流す音の形（ear-pipeline の既定と同じ 16kHz・モノラル・s16le）。 */
export const DISCORD_EAR_SAMPLE_RATE = 16000;

/** 16kHz モノラル s16le の 1ms あたりのバイト数。 */
const BYTES_PER_MS = (DISCORD_EAR_SAMPLE_RATE * 2) / 1000;

/** 耳が起きるまでに溜める音の上限（既定 10 秒ぶん）。 */
export const DISCORD_PENDING_AUDIO_MAX_MS = 10_000;

/**
 * 3 バイトの Opus の無音のフレーム（`F8 FF FE`）か。
 * @param {unknown} packet
 * @returns {boolean}
 */
export function isOpusSilenceFrame(packet) {
  return (
    packet instanceof Uint8Array && packet.length === 3 && packet[0] === 0xf8 && packet[1] === 0xff && packet[2] === 0xfe
  );
}

/**
 * 人ごとに 1 つの Opus のデコーダ（16kHz・モノラル）。opusscript の形（`new OpusScript(rate, channels, application)`・
 * `decode(packet)`・`delete()`）を受け取る。
 * @param {any} OpusScript
 */
export function createOpusDecoder16k(OpusScript) {
  const application = OpusScript && OpusScript.Application ? OpusScript.Application.AUDIO : undefined;
  return new OpusScript(DISCORD_EAR_SAMPLE_RATE, 1, application);
}

/**
 * デコーダの返り値（Buffer か TypedArray）を Buffer にする。
 * @param {any} pcm
 * @returns {Buffer}
 */
export function toPcmBuffer(pcm) {
  if (Buffer.isBuffer(pcm)) return pcm;
  if (pcm instanceof Uint8Array || ArrayBuffer.isView(pcm)) {
    return Buffer.from(pcm.buffer, pcm.byteOffset, pcm.byteLength);
  }
  return Buffer.alloc(0);
}

/**
 * 16kHz モノラル s16le の無音（ms ぶん・偶数バイト）。
 * @param {number} ms
 * @returns {Buffer}
 */
export function silencePcm(ms) {
  const samples = Math.max(0, Math.round((ms * DISCORD_EAR_SAMPLE_RATE) / 1000));
  return Buffer.alloc(samples * 2);
}

/**
 * 耳の音の入口（captureFactory 互換）。
 * @param {{ maxPendingMs?: number }} [options]
 */
export function createSpeakerAudioSource(options = {}) {
  const maxPendingBytes = Math.max(0, Math.round((options.maxPendingMs ?? DISCORD_PENDING_AUDIO_MAX_MS) * BYTES_PER_MS));
  /** @type {((chunk: Buffer) => void) | null} */
  let sink = null;
  /** @type {Buffer[]} */
  let pending = [];
  let pendingBytes = 0;
  let disposed = false;
  const counters = { pushedBytes: 0, droppedBytes: 0 };

  const dispose = () => {
    disposed = true;
    sink = null;
    pending = [];
    pendingBytes = 0;
  };

  return {
    /**
     * ear-pipeline が start の中で呼ぶ（ffmpeg の代わり）。溜めた音を順に流してから、以後は届くたびに流す。
     * @param {{ onPcm: (chunk: Buffer) => void }} captureOptions
     */
    captureFactory(captureOptions) {
      const onPcm = captureOptions && typeof captureOptions.onPcm === "function" ? captureOptions.onPcm : null;
      if (!disposed && onPcm) {
        sink = onPcm;
        const queued = pending;
        pending = [];
        pendingBytes = 0;
        for (const chunk of queued) {
          if (sink !== onPcm) break;
          onPcm(chunk);
        }
      }
      return {
        restartCount: () => 0,
        isDisposed: () => disposed || sink !== onPcm,
        currentChild: () => null,
        dispose: () => {
          if (sink === onPcm) sink = null;
          disposed = true;
          pending = [];
          pendingBytes = 0;
        }
      };
    },
    /**
     * 16kHz モノラル s16le の音を 1 塊流す（耳が起きる前は溜める）。
     * @param {Buffer} chunk
     */
    push(chunk) {
      if (disposed || !chunk || chunk.length === 0) return;
      counters.pushedBytes += chunk.length;
      if (sink) {
        sink(chunk);
        return;
      }
      pending.push(chunk);
      pendingBytes += chunk.length;
      while (pendingBytes > maxPendingBytes && pending.length > 0) {
        const dropped = /** @type {Buffer} */ (pending.shift());
        pendingBytes -= dropped.length;
        counters.droppedBytes += dropped.length;
      }
    },
    /** 耳につながっているか（captureFactory が呼ばれて、まだ畳まれていない）。 */
    isAttached: () => sink != null,
    pendingBytes: () => pendingBytes,
    stats: () => ({ ...counters }),
    dispose
  };
}
