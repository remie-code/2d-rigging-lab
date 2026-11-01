// @ts-check
/**
 * 偽の @discordjs/voice の音を流す部品（Discord モード Domain E・設計 §7・外部 §1.1）。src/test-support/fake-discord.mjs の
 * voice の束に足して使う（単独でも使える）。本物の Discord・網・Opus のエンコードには触れない。
 *
 * 本物（0.19.2 の dist/index.js）の AudioPlayer の状態の動きを、20ms の 1 周期ずつ `step()` で進める形で写した:
 *  - play(resource): 1 フレーム（20ms・48kHz・ステレオ = 3840 バイト）が溜まるか流れが終わるまで Buffering、溜まったら Playing。
 *    鳴っている resource があれば Idle を挟まず差し替え（前の resource は壊す）。
 *  - step(): 接続（購読者）が Ready でなければ AutoPaused（Ready に戻れば Playing）。Playing では 1 フレーム読む。読めなければ
 *    無音を送って missedFrames を数え、`maxMissedFrames` に達したら stop()。流れが終わって端数しか無ければ無音の詰め物を
 *    5 フレーム送ってから Idle。
 *  - stop(force): force か詰め物 0 なら即 Idle。そうでなければ次の周期から無音を 5 フレーム送ってから Idle。
 *  - 'error': resource の流れが失敗したら AudioPlayerError 相当（`{ resource }` 付き）を出して Idle。
 *
 * 送ったフレームは record に数える（実音のフレーム・無音のフレーム）。音そのものは保存しない（バイト数だけ）。
 */

import { EventEmitter } from "node:events";

export const FAKE_AUDIO_PLAYER_STATUS = Object.freeze({
  Idle: "idle",
  Buffering: "buffering",
  Playing: "playing",
  AutoPaused: "autopaused",
  Paused: "paused"
});
export const FAKE_STREAM_TYPE = Object.freeze({ Arbitrary: "arbitrary", Raw: "raw", OggOpus: "ogg/opus", WebmOpus: "webm/opus", Opus: "opus" });
export const FAKE_NO_SUBSCRIBER_BEHAVIOR = Object.freeze({ Play: "play", Pause: "pause", Stop: "stop" });
/** 1 フレーム（20ms・48kHz・ステレオ・16bit）。 */
export const FAKE_FRAME_BYTES = 3840;
const SILENCE = Buffer.from([0xf8, 0xff, 0xfe]);

/** 偽の Raw の resource（入力の流れを読み、フレームの単位で取り出す）。 */
export class FakeAudioResource {
  /** @param {import("node:stream").Readable} input @param {any} options */
  constructor(input, options = {}) {
    this.input = input;
    this.options = options;
    this.inputType = options.inputType;
    /** 溜まっているバイト数（まだ読んでいない分）。 */
    this.buffered = 0;
    /** 受け取った合計のバイト数。 */
    this.received = 0;
    /** 受け取った PCM（変換の確かめ用。テストは短い音だけを流す）。 @type {Buffer[]} */
    this.chunks = [];
    this.inputEnded = false;
    this.destroyed = false;
    this.playbackDuration = 0;
    this.silencePaddingFrames = options.silencePaddingFrames ?? 5;
    this.silenceRemaining = -1;
    /** @type {any} */
    this.audioPlayer = undefined;
    /** @type {(() => void) | null} */
    this.onChange = null;
    input.on("data", (/** @type {Buffer} */ chunk) => {
      const b = Buffer.from(chunk);
      this.chunks.push(b);
      this.buffered += b.length;
      this.received += b.length;
      this.onChange?.();
    });
    input.on("end", () => {
      this.inputEnded = true;
      this.onChange?.();
    });
    input.on("error", (/** @type {unknown} */ error) => {
      this.onError?.(error);
    });
    /** @type {((error: unknown) => void) | null} */
    this.onError = null;
  }
  get hasFrame() {
    return this.buffered >= FAKE_FRAME_BYTES;
  }
  /** 本物の AudioResource#readable と同じ考え方（流れが終わったら詰め物を数え始める）。 */
  get readable() {
    if (this.silenceRemaining === 0) return false;
    const real = !this.destroyed && !(this.inputEnded && this.buffered < FAKE_FRAME_BYTES);
    if (!real) {
      if (this.silenceRemaining === -1) this.silenceRemaining = this.silencePaddingFrames;
      return this.silenceRemaining !== 0;
    }
    return true;
  }
  get ended() {
    return this.destroyed || this.silenceRemaining === 0 || (this.inputEnded && this.buffered < FAKE_FRAME_BYTES && this.silenceRemaining === 0);
  }
  read() {
    if (this.silenceRemaining === 0) return null;
    if (this.silenceRemaining > 0) {
      this.silenceRemaining -= 1;
      return SILENCE;
    }
    if (this.buffered >= FAKE_FRAME_BYTES) {
      this.buffered -= FAKE_FRAME_BYTES;
      this.playbackDuration += 20;
      return Buffer.alloc(8, 1);
    }
    return null;
  }
  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    try {
      /** @type {any} */ (this.input).destroy?.();
    } catch {
      // best-effort
    }
  }
}

/** 偽の AudioPlayer。 */
export class FakeAudioPlayer extends EventEmitter {
  /** @param {any} [options] @param {any} [record] */
  constructor(options = {}, record = null) {
    super();
    this.behaviors = { noSubscriber: FAKE_NO_SUBSCRIBER_BEHAVIOR.Pause, maxMissedFrames: 5, ...(options.behaviors ?? {}) };
    /** @type {any} */
    this._state = { status: FAKE_AUDIO_PLAYER_STATUS.Idle };
    /** @type {Array<{ connection: any; player: FakeAudioPlayer; unsubscribe: () => boolean }>} */
    this.subscribers = [];
    this.record = record ?? { framesSent: 0, silenceSent: 0, stops: [], plays: 0 };
    /** 状態の移り変わり（"buffering" → "playing" など）。 @type {string[]} */
    this.transitions = [];
  }
  get state() {
    return this._state;
  }
  set state(newState) {
    const oldState = this._state;
    if (oldState.status !== FAKE_AUDIO_PLAYER_STATUS.Idle && oldState.resource !== newState.resource) {
      oldState.resource.onChange = null;
      oldState.resource.onError = null;
      oldState.resource.audioPlayer = undefined;
      oldState.resource.destroy();
    }
    this._state = newState;
    this.transitions.push(newState.status);
    this.emit("stateChange", oldState, newState);
    if (oldState.status !== newState.status) this.emit(newState.status, oldState, newState);
  }
  get playable() {
    return this.subscribers.filter(({ connection }) => connection.state?.status === "ready").map(({ connection }) => connection);
  }
  /** @param {FakeAudioResource} resource */
  play(resource) {
    if (resource.ended) throw new Error("Cannot play a resource that has already ended.");
    if (resource.audioPlayer) {
      if (resource.audioPlayer === this) return;
      throw new Error("Resource is already being played by another audio player.");
    }
    resource.audioPlayer = this;
    this.record.plays += 1;
    resource.onError = (error) => {
      if (this._state.status !== FAKE_AUDIO_PLAYER_STATUS.Idle) this.emit("error", Object.assign(new Error("fake resource error"), { resource: this._state.resource, cause: error }));
      if (this._state.status !== FAKE_AUDIO_PLAYER_STATUS.Idle && this._state.resource === resource) this.state = { status: FAKE_AUDIO_PLAYER_STATUS.Idle };
    };
    if (resource.hasFrame) {
      this.state = { status: FAKE_AUDIO_PLAYER_STATUS.Playing, missedFrames: 0, playbackDuration: 0, resource };
      return;
    }
    resource.onChange = () => {
      if (this._state.status !== FAKE_AUDIO_PLAYER_STATUS.Buffering || this._state.resource !== resource) return;
      if (resource.hasFrame || resource.inputEnded) {
        resource.onChange = null;
        // 本物: 流れが読めるようになったら（または終わったら）Playing。
        this.state = { status: FAKE_AUDIO_PLAYER_STATUS.Playing, missedFrames: 0, playbackDuration: 0, resource };
      }
    };
    this.state = { status: FAKE_AUDIO_PLAYER_STATUS.Buffering, resource };
  }
  /** @param {boolean} [force] */
  stop(force = false) {
    this.record.stops.push(force);
    if (this._state.status === FAKE_AUDIO_PLAYER_STATUS.Idle) return false;
    if (force || this._state.resource.silencePaddingFrames === 0) {
      this.state = { status: FAKE_AUDIO_PLAYER_STATUS.Idle };
    } else if (this._state.resource.silenceRemaining === -1) {
      this._state.resource.silenceRemaining = this._state.resource.silencePaddingFrames;
    }
    return true;
  }
  /** 本物の checkPlayable + _stepPrepare（20ms の 1 周期）。 */
  step() {
    const state = this._state;
    if (state.status === FAKE_AUDIO_PLAYER_STATUS.Idle || state.status === FAKE_AUDIO_PLAYER_STATUS.Buffering) return;
    if (!state.resource.readable) {
      this.state = { status: FAKE_AUDIO_PLAYER_STATUS.Idle };
      return;
    }
    const playable = this.playable;
    if (state.status === FAKE_AUDIO_PLAYER_STATUS.AutoPaused && playable.length > 0) {
      this.state = { ...state, status: FAKE_AUDIO_PLAYER_STATUS.Playing, missedFrames: 0 };
    }
    const s = this._state;
    if (s.status === FAKE_AUDIO_PLAYER_STATUS.AutoPaused || s.status === FAKE_AUDIO_PLAYER_STATUS.Paused) return;
    if (playable.length === 0) {
      if (this.behaviors.noSubscriber === FAKE_NO_SUBSCRIBER_BEHAVIOR.Pause) {
        this.state = { ...s, status: FAKE_AUDIO_PLAYER_STATUS.AutoPaused };
        return;
      }
      if (this.behaviors.noSubscriber === FAKE_NO_SUBSCRIBER_BEHAVIOR.Stop) {
        this.stop(true);
        return;
      }
    }
    const packet = s.resource.read();
    if (packet && packet !== SILENCE) {
      this.record.framesSent += 1;
      s.missedFrames = 0;
    } else {
      this.record.silenceSent += 1;
      if (!packet) {
        s.missedFrames += 1;
        if (s.missedFrames >= this.behaviors.maxMissedFrames) this.stop();
      }
    }
  }
}

/**
 * 偽の音の部品の束（voice の束に足す口と、時計を進める step）。
 */
export function createFakeDiscordAudio() {
  const record = { framesSent: 0, silenceSent: 0, /** @type {boolean[]} */ stops: [], plays: 0 };
  /** @type {FakeAudioPlayer[]} */
  const players = [];
  /** @type {FakeAudioResource[]} */
  const resources = [];
  return {
    record,
    players,
    resources,
    /** @param {any} [options] */
    createAudioPlayer(options) {
      const player = new FakeAudioPlayer(options, record);
      players.push(player);
      return player;
    },
    /** @param {any} input @param {any} [options] */
    createAudioResource(input, options) {
      const resource = new FakeAudioResource(input, options);
      resources.push(resource);
      return resource;
    },
    StreamType: FAKE_STREAM_TYPE,
    AudioPlayerStatus: FAKE_AUDIO_PLAYER_STATUS,
    NoSubscriberBehavior: FAKE_NO_SUBSCRIBER_BEHAVIOR,
    /** すべてのプレイヤーを 20ms の周期で n 回進める。 @param {number} [frames] */
    step(frames = 1) {
      for (let i = 0; i < frames; i += 1) for (const player of [...players]) player.step();
    }
  };
}

/**
 * 偽の接続に購読の口を足す（本物の VoiceConnection#subscribe と同じく、同じプレイヤーは 1 回だけ）。
 * @param {any} connection
 * @param {FakeAudioPlayer} player
 */
export function fakeSubscribe(connection, player) {
  const existing = player.subscribers.find((s) => s.connection === connection);
  if (existing) return existing;
  const subscription = {
    connection,
    player,
    unsubscribe: () => {
      const index = player.subscribers.indexOf(subscription);
      if (index === -1) return false;
      player.subscribers.splice(index, 1);
      return true;
    }
  };
  player.subscribers.push(subscription);
  return subscription;
}
