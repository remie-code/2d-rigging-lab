// @ts-check
/**
 * Discord 向けの再生器（Discord モード Domain E・discord-mode.md §7）— apps/soul/agent。
 *
 * 運び手（src/voice/speech-streamer.mjs）は再生器の `open / write / end / stop / onEvent` だけを確かめる。今の手元の再生器
 * （src/voice/stream-player.mjs の createStreamPlayer）と同じ口・同じ事象の形で、声を Discord の VC に流す。運び手と
 * orchestrator は変えない。cockpit.mjs が使う `isAlive()`・`dispose()`・`whenReady()`・`current()` も持つ。
 *
 * @discordjs/voice の部品は**引数で受け取る**（Discord の体験の口が src/discord/discord-libraries.mjs で動的 import した束。
 * このファイルは Discord の部品を import しない・テストは偽の束 src/test-support/fake-discord-audio.mjs を渡す）。
 *
 * ── 呼ばれ方とすること（設計 §7.1 の表）───────────────────────────────────────────
 *  - 作るとき: `createAudioPlayer({ behaviors: { noSubscriber: Pause, maxMissedFrames } })` を作り、その場のロールの Bot の接続に
 *    結ぶ（`connection.subscribe(player)`）。
 *  - open(id, { sampleRate, channels }): 発話ごとに 1 本の流れ（PassThrough）と Raw の resource（`StreamType.Raw`）を作り、
 *    プレイヤーで鳴らし始める（前の発話が残っていれば置き換える・置き換えた発話の事象は出さない。手元の再生器と同じ）。
 *  - write(id, pcm): 48kHz ステレオ s16le に変えて（discord-pcm48.mjs・状態を持つ）流す。今の発話でない id・end の後は false。
 *  - end(id): 変換の残りと 20ms の端数の無音を流して流れを閉じる。鳴り終わって Idle になったら `ended`。音の無い発話は
 *    鳴らさずに `ended` だけ（STARTED なし・手元の再生器と同じ）。
 *  - stop(): `player.stop()`（実際の音はすぐ止め、無音を 100ms 流してから Idle・公式が勧める止め方）。鳴っていない
 *    （Buffering・AutoPaused）ときはすぐ Idle にする。`stopped`（止めた発話の id・無ければ null）。
 *  - onEvent: `started`（その resource で Playing になった時刻 + 決まった遅れ）・`ended`・`stopped`・`error`。
 *
 * ── 途切れで Idle になる落とし穴（設計 §7.3・外部 §1.1）───────────────────────────────────
 *  送る音が `maxMissedFrames` フレーム（既定 5 = 100ms）途切れると、プレイヤーは自分で止まって Idle になり、その resource には
 *  足せなくなる。手当て: 発話ごとに 1 resource・`maxMissedFrames` を大きく（既定 75 フレーム = 1.5 秒）・終わりは end() で明示。
 *  それでも end の前に Idle になったら（1.5 秒より長い途切れ・流れの失敗）、その発話は `error` にする（運び手が世代を閉じる）。
 *
 * ── 割り込みの「どこまで声に出たか」（設計 §7.4 の a）──────────────────────────────────────
 *  Discord の Playing は「送り始めた」時刻で、相手の耳に届くまでの網の遅れを含まない（「言った」と数える量が多めに出る）。
 *  `started` の atMs に決まった遅れ（既定 {@link DEFAULT_DISCORD_STARTED_DELAY_MS}・`startedDelayMs` で替える）を足して出す。
 *  切断点は運び手と orchestrator の今の計算（割り込みの時刻 − started の時刻）のまま、少なめに数える側へ寄る。
 *
 * ── 畳む ─────────────────────────────────────────────────────────────────
 *  dispose(): 鳴っている発話があれば `stopped` を出してから（運び手が見張りの時間切れを待たずに世代を閉じられるように）、
 *  プレイヤーを止めて接続から外す。以後のイベントは届けない。dispose の後の open / write / end は投げる（手元の再生器と同じ）。
 *  stop() は投げない（場を閉じる途中の割り込み・キルの声止めを落とさないため）。
 *
 * ── 守り ─────────────────────────────────────────────────────────────────
 *  声はファイルに保存しない（流れに流すだけ）。診断（onTrace）は事象の種類と数だけ（Discord の id・本文を入れない）。
 */

import { PassThrough } from "node:stream";

import { createPcm48kStereoConverter } from "./discord-pcm48.mjs";

/** 途切れで Idle にならない上限（20ms のフレーム数・75 = 1.5 秒。設計 §7.3 の目安 1〜2 秒）。 */
export const DEFAULT_DISCORD_MAX_MISSED_FRAMES = 75;
/** `started` の時刻に足す遅れ（ms・設計 §7.4 の a。網の遅れと相手の揺らぎの吸収の目安・小さく）。 */
export const DEFAULT_DISCORD_STARTED_DELAY_MS = 100;
/** 遅れの上限（ms・設定の書き損じで切断点が 0 文字に張り付かないように）。 */
export const DISCORD_STARTED_DELAY_MAX_MS = 2000;

/** 事象の message（決まった文面・生のエラー文を入れない）。 */
export const DISCORD_PLAYER_MESSAGES = Object.freeze({
  idleBeforeEnd: "discord player went idle before the end (audio gap too long)",
  resourceError: "discord audio resource failed",
  unsupportedFormat: "unsupported format"
});

/**
 * @typedef {{ type: "started" | "ended" | "stopped" | "error"; id: string | null; atMs: number; message?: string }} DiscordPlayerEvent
 */

/**
 * @param {unknown} value @param {number} fallback @param {number} min @param {number} max
 */
function clampNumber(value, fallback, min, max) {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

/**
 * Discord 向けの再生器を作る（その場のロールの Bot の接続ごとに 1 つ）。
 *
 * @param {object} options
 * @param {any} options.voice  @discordjs/voice の束（createAudioPlayer / createAudioResource / StreamType / NoSubscriberBehavior /
 *   AudioPlayerStatus）。Discord の体験の口が動的 import したもの（テストは偽物）。
 * @param {any} options.connection  その場のロールの Bot の VC の接続（`subscribe(player)` を持つ）。
 * @param {number} [options.startedDelayMs=DEFAULT_DISCORD_STARTED_DELAY_MS]  `started` の時刻に足す遅れ（0〜2000）。
 * @param {number} [options.maxMissedFrames=DEFAULT_DISCORD_MAX_MISSED_FRAMES]  途切れで Idle にならない上限（5〜500 フレーム）。
 * @param {() => number} [options.nowImpl]  事象の atMs（既定 Date.now）。
 * @param {(event: string, fields?: Record<string, unknown>) => void} [options.onTrace]  診断（種類と数だけ）。
 */
export function createDiscordStreamPlayer(options) {
  const voice = options?.voice;
  const connection = options?.connection;
  if (!voice || typeof voice.createAudioPlayer !== "function" || typeof voice.createAudioResource !== "function") {
    throw new TypeError("createDiscordStreamPlayer requires @discordjs/voice (createAudioPlayer / createAudioResource).");
  }
  if (!connection || typeof connection.subscribe !== "function") {
    throw new TypeError("createDiscordStreamPlayer requires a voice connection (subscribe).");
  }
  const now = options.nowImpl ?? Date.now;
  const startedDelayMs = clampNumber(options.startedDelayMs, DEFAULT_DISCORD_STARTED_DELAY_MS, 0, DISCORD_STARTED_DELAY_MAX_MS);
  const maxMissedFrames = Math.round(clampNumber(options.maxMissedFrames, DEFAULT_DISCORD_MAX_MISSED_FRAMES, 5, 500));
  const STATUS = {
    idle: voice.AudioPlayerStatus?.Idle ?? "idle",
    playing: voice.AudioPlayerStatus?.Playing ?? "playing"
  };
  const rawType = voice.StreamType?.Raw ?? "raw";
  const noSubscriber = voice.NoSubscriberBehavior?.Pause ?? "pause";

  /** @type {Set<(event: DiscordPlayerEvent) => void>} */
  const listeners = new Set();
  /**
   * 今の発話。
   * @type {null | { id: string; resource: any; input: PassThrough; converter: ReturnType<typeof createPcm48kStereoConverter>; started: boolean; endSent: boolean; bytes: number }}
   */
  let current = null;
  let disposed = false;

  const trace = (/** @type {string} */ event, /** @type {Record<string, unknown>} */ fields = {}) => {
    if (typeof options.onTrace !== "function") return;
    try {
      options.onTrace(event, fields);
    } catch {
      // 診断の観測者は再生器を持たない。
    }
  };

  /** @param {Omit<DiscordPlayerEvent, "atMs"> & { atMs?: number }} event */
  const emit = (event) => {
    if (disposed) return;
    const full = /** @type {DiscordPlayerEvent} */ ({ ...event, atMs: typeof event.atMs === "number" ? event.atMs : now() });
    for (const listener of [...listeners]) {
      try {
        listener(full);
      } catch {
        // 購読者の失敗は再生器の状態を壊さない。
      }
    }
  };

  const audioPlayer = voice.createAudioPlayer({ behaviors: { noSubscriber, maxMissedFrames } });

  /** @param {any} oldState @param {any} newState */
  const onStateChange = (oldState, newState) => {
    if (disposed) return;
    const u = current;
    if (!u) return;
    if (newState?.status === STATUS.playing && newState.resource === u.resource) {
      if (u.started) return;
      u.started = true;
      trace("discord.player.started");
      // 設計 §7.4 の a: Playing は「送り始めた」時刻。決まった遅れを足して、多めに「言った」と数えない側へ。
      emit({ type: "started", id: u.id, atMs: now() + startedDelayMs });
      return;
    }
    if (newState?.status === STATUS.idle && oldState?.status !== STATUS.idle && oldState?.resource === u.resource) {
      current = null;
      if (u.endSent) {
        // 手元の再生器と同じく、音があって STARTED がまだなら先に STARTED を出す。
        if (u.bytes > 0 && !u.started) {
          u.started = true;
          emit({ type: "started", id: u.id, atMs: now() + startedDelayMs });
        }
        trace("discord.player.ended");
        emit({ type: "ended", id: u.id });
        return;
      }
      // end の前に Idle（途切れが maxMissedFrames を超えた・流れが止まった）。その発話には足せないので失敗にする。
      trace("discord.player.idle_before_end");
      emit({ type: "error", id: u.id, message: DISCORD_PLAYER_MESSAGES.idleBeforeEnd });
    }
  };

  /** @param {any} error */
  const onPlayerError = (error) => {
    // 'error' を聞いていないと EventEmitter が投げるので、dispose の後も外さない（何もしない）。
    if (disposed) return;
    const u = current;
    if (!u || error?.resource !== u.resource) return;
    current = null;
    trace("discord.player.error");
    emit({ type: "error", id: u.id, message: DISCORD_PLAYER_MESSAGES.resourceError });
  };

  audioPlayer.on("stateChange", onStateChange);
  audioPlayer.on("error", onPlayerError);
  /** @type {any} */
  const subscription = connection.subscribe(audioPlayer);
  if (!subscription) trace("discord.player.subscribe_failed");

  const assertUsable = () => {
    if (disposed) throw new Error("discord stream player already disposed.");
  };

  /** @param {unknown} id @param {string} method */
  const assertId = (id, method) => {
    if (typeof id !== "string" || id.length === 0 || /[\t\r\n]/.test(id)) {
      throw new TypeError(`${method}(id): id must be a non-empty single-line token without tabs.`);
    }
  };

  /** 置き換えた・止めた発話の流れを閉じる（resource はプレイヤーが Idle / 差し替えで壊す）。 @param {NonNullable<typeof current>} u */
  const closeInput = (u) => {
    try {
      if (!u.input.writableEnded) u.input.end();
    } catch {
      // best-effort
    }
  };

  return {
    /**
     * 新しい発話を始める（前の発話は置き換える・事象は出さない）。
     * @param {string} id
     * @param {{ sampleRate: number; channels: number }} format
     */
    open(id, format) {
      assertUsable();
      assertId(id, "open");
      const sampleRate = format?.sampleRate;
      const channels = format?.channels;
      if (!Number.isInteger(sampleRate) || sampleRate < 8000 || sampleRate > 192000) {
        throw new RangeError("open(id, format): sampleRate must be an integer in 8000..192000.");
      }
      if (channels !== 1 && channels !== 2) {
        throw new RangeError("open(id, format): channels must be 1 or 2.");
      }
      const previous = current;
      current = null;
      const converter = createPcm48kStereoConverter({ sampleRate, channels });
      const input = new PassThrough();
      // 流れの失敗はプレイヤーの 'error'（resource 付き）で受ける。ここでは握るだけ（未処理のエラーで落とさない）。
      input.on("error", () => {});
      const resource = voice.createAudioResource(input, { inputType: rawType });
      current = { id, resource, input, converter, started: false, endSent: false, bytes: 0 };
      if (previous) closeInput(previous);
      try {
        // 鳴っている resource があれば Idle を挟まず差し替える（前の resource はプレイヤーが壊す）。
        audioPlayer.play(resource);
      } catch (error) {
        current = null;
        closeInput({ id, resource, input, converter, started: false, endSent: true, bytes: 0 });
        throw error;
      }
      trace("discord.player.opened", { sampleRate, channels, mode: converter.mode });
    },
    /**
     * 音の続きを送る（PCM16LE・open の形）。今の発話でない id・end の後は送らずに false。
     * @param {string} id
     * @param {Uint8Array} pcm
     * @returns {boolean}
     */
    write(id, pcm) {
      assertUsable();
      assertId(id, "write");
      if (!(pcm instanceof Uint8Array)) throw new TypeError("write(id, pcm): pcm must be a Uint8Array.");
      const u = current;
      if (u == null || u.id !== id || u.endSent) return false;
      const out = u.converter.push(pcm);
      if (out.length > 0) {
        u.bytes += out.length;
        u.input.write(out);
      }
      return true;
    },
    /**
     * もう続きはない。鳴り終わると `ended` が届く。今の発話でない id・二度目は false。
     * @param {string} id
     * @returns {boolean}
     */
    end(id) {
      assertUsable();
      assertId(id, "end");
      const u = current;
      if (u == null || u.id !== id || u.endSent) return false;
      u.endSent = true;
      const tail = u.converter.flush();
      if (tail.length > 0) {
        u.bytes += tail.length;
        u.input.write(tail);
      }
      if (u.bytes === 0) {
        // 音の無い発話: 鳴らさずに終える（Playing を経ないので STARTED は出さない・手元の再生器と同じ）。
        current = null;
        closeInput(u);
        try {
          audioPlayer.stop(true);
        } catch {
          // best-effort
        }
        queueMicrotask(() => emit({ type: "ended", id }));
        return true;
      }
      closeInput(u);
      return true;
    },
    /** 止める（割り込み・キル）。`stopped` が届く。dispose の後も投げない。 */
    stop() {
      if (disposed) return;
      const u = current;
      current = null;
      if (u) {
        u.endSent = true;
        try {
          // 鳴っているときは無音 100ms の余韻で止める（公式の止め方）。鳴っていない（Buffering・AutoPaused）ときはすぐ Idle。
          audioPlayer.stop(audioPlayer.state?.status !== STATUS.playing);
        } catch {
          // best-effort
        }
        closeInput(u);
      }
      trace("discord.player.stopped", { active: u != null });
      const stoppedId = u?.id ?? null;
      queueMicrotask(() => emit({ type: "stopped", id: stoppedId }));
    },
    /**
     * イベントを購読する。戻り値で解除する。
     * @param {(event: DiscordPlayerEvent) => void} listener
     * @returns {() => void}
     */
    onEvent(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    /** 使えるか（接続は作る時点で Ready・プロセスの起動は無いので、dispose していなければ true）。 */
    whenReady() {
      return Promise.resolve(!disposed);
    },
    /** 今の発話（なければ null）。 */
    current() {
      return current == null ? null : { id: current.id, started: current.started, endSent: current.endSent };
    },
    isAlive() {
      return !disposed;
    },
    /** 畳む（冪等）。鳴っている発話があれば `stopped` を出してから止め、接続から外す。 */
    dispose() {
      if (disposed) return;
      const u = current;
      current = null;
      if (u) {
        trace("discord.player.disposed_while_active");
        emit({ type: "stopped", id: u.id });
      }
      disposed = true;
      listeners.clear();
      audioPlayer.off?.("stateChange", onStateChange);
      try {
        audioPlayer.stop(true);
      } catch {
        // best-effort
      }
      if (u) closeInput(u);
      try {
        subscription?.unsubscribe?.();
      } catch {
        // best-effort
      }
    },
    /** テストと診断用: 作った @discordjs/voice のプレイヤー。 */
    audioPlayer,
    /** テストと診断用: 決まった遅れ・途切れの上限（替えた値の確かめ）。 */
    settings: Object.freeze({ startedDelayMs, maxMissedFrames })
  };
}
