// @ts-check
/**
 * 偽の Discord（Discord モード Domain D・棚卸し §4.2）。discord.js の `Client` 相当と @discordjs/voice の
 * `joinVoiceChannel / entersState / VoiceConnectionStatus / EndBehaviorType` の束を作り、Discord の体験の口の loadLibraries に
 * 差し替えて渡す（本物の Discord・ネットには触れない）。
 *
 *  - Client: EventEmitter。`login(token)` で Ready を出す（loginFails なら投げる・投げる文面に鍵を混ぜて「理由に出ない」ことを
 *    確かめられる）。`guilds.fetch(id?)`・`destroy()`。作られた Client と login の回数・destroy の回数は record に残る。
 *  - サーバー: `channels.fetch(id?)`・`members.fetch(userId)`（displayName を返す）・`voiceAdapterCreator`。
 *  - VC の接続: EventEmitter（`stateChange`）。`receiver.speaking` も EventEmitter、`receiver.subscribe(userId, opts)` は
 *    objectMode の PassThrough（テストが Opus のパケットを書く・end で購読が終わる）。`destroy()` で Destroyed。
 *  - entersState: 状態が目当てになったら解決、joinFails なら reject。
 *  - OpusScript: 既定は小さな偽物（decode は 20ms・16kHz・モノラルの PCM を返す・中身はパケットの 1 バイト目から作る）。
 *    本物の opusscript を渡せば本物でデコードする。
 *
 * Discord モード Domain E: voice の束に音を流す部品（createAudioPlayer / createAudioResource / StreamType / AudioPlayerStatus /
 * NoSubscriberBehavior・src/test-support/fake-discord-audio.mjs）を足し、偽の接続に `subscribe(player)` を足した。返り値の `audio` で
 * 20ms の周期を進める（`audio.step(n)`）。D の口とふるまいは変えていない。
 *
 * Discord モード Domain I: 接続の状態に閉じのコード（`setConnectionStatus("disconnected", { closeCode: 4014 })`）・Bot を Discord の
 * 画面で動かす（`moveBot`・ライブラリと同じく joinConfig.channelId を書き換え、Bot 自身の voiceStateUpdate を出す）・外から切る
 * （`kickBot`）・サーバーの voiceStates（人数）・入退室の member（名前・Bot か）・チャンネルの guildId を足した。同じ guild + group の
 * 接続を destroy しないまま joinVoiceChannel を呼ぶと、本物のライブラリはその接続を使い回すので、その呼び出しを `record.reusedJoins`
 * に数える（偽物は今までどおり新しい接続を作る）。D・E の口とふるまいは変えていない。
 *
 * ID はどれも明らかに偽の値（`guild-fake-1`・`user-fake-a` など）をテストが決める。
 */

import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";

import { createFakeDiscordAudio, fakeSubscribe } from "./fake-discord-audio.mjs";

export const FAKE_VOICE_STATUS = Object.freeze({
  Signalling: "signalling",
  Connecting: "connecting",
  Ready: "ready",
  Disconnected: "disconnected",
  Destroyed: "destroyed"
});
export const FAKE_END_BEHAVIOR = Object.freeze({ Manual: 0, AfterSilence: 1, AfterInactivity: 2 });
export const FAKE_INTENTS = Object.freeze({ Guilds: 1, GuildMembers: 2, GuildVoiceStates: 128, GuildMessages: 512, MessageContent: 32768 });
export const FAKE_CHANNEL_TYPE = Object.freeze({ GuildText: 0, GuildVoice: 2, GuildStageVoice: 13 });
export const FAKE_EVENTS = Object.freeze({ ClientReady: "clientReady", VoiceStateUpdate: "voiceStateUpdate", Error: "error" });

/**
 * 小さな偽の OpusScript（20ms・16kHz・モノラル = 640 バイトを返す）。パケットの 1 バイト目が 0 なら無音、それ以外は振幅 0.6 の
 * 矩形波（偽の VAD が「話している」と読める大きさ）。
 */
export class FakeOpusScript {
  static Application = Object.freeze({ VOIP: 2048, AUDIO: 2049, RESTRICTED_LOWDELAY: 2051 });
  /** @param {number} rate @param {number} channels @param {number} [application] */
  constructor(rate, channels, application) {
    this.rate = rate;
    this.channels = channels;
    this.application = application;
    this.decoded = 0;
    this.deleted = false;
  }
  /** @param {Buffer} packet */
  decode(packet) {
    if (this.deleted) throw new Error("decoder deleted");
    if (!packet || packet.length < 3 || packet[0] === 0xee) throw new Error("bad opus packet");
    this.decoded += 1;
    const samples = (this.rate / 1000) * 20 * this.channels;
    const out = Buffer.alloc(samples * 2);
    if (packet[0] !== 0) {
      for (let i = 0; i < samples; i += 1) out.writeInt16LE(i % 16 < 8 ? 19660 : -19660, i * 2);
    }
    return out;
  }
  delete() {
    this.deleted = true;
  }
}

/** 偽の「話している」パケット（FakeOpusScript がうるさい音にデコードする）。 */
export const FAKE_SPEECH_PACKET = Buffer.from([0x78, 0x01, 0x02, 0x03, 0x04]);
/** 偽の「ほぼ無音」のパケット（FakeOpusScript が無音にデコードする）。 */
export const FAKE_QUIET_PACKET = Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04]);
/** 3 バイトの無音のフレーム（F8 FF FE）。 */
export const OPUS_SILENCE_FRAME = Buffer.from([0xf8, 0xff, 0xfe]);

/**
 * @typedef {{ id: string; name: string; type?: number; rawPosition?: number }} FakeChannelSpec
 * @typedef {{ id: string; name: string; channels?: FakeChannelSpec[]; members?: Record<string, string>; voiceStates?: Record<string, string>; bots?: string[] }} FakeGuildSpec
 *   bots（Discord モード Domain K）: Bot の userId。members.fetch がその人の `user.bot` を true で返す（もういる人の行で除く）。
 */

/**
 * @param {object} [options]
 * @param {FakeGuildSpec[]} [options.guilds]
 * @param {string} [options.botUserId="bot-fake-1"]
 * @param {boolean} [options.loginFails]  login が投げる（投げる文面には鍵が入る）。
 * @param {boolean} [options.neverReady]  login しても Ready を出さない（時間切れを確かめる）。
 * @param {boolean} [options.joinFails]  entersState(Ready) が reject する（VC に入れない）。
 * @param {boolean} [options.catalogFails]  guilds.fetch()（一覧）が投げる。
 * @param {any} [options.OpusScript]  既定 FakeOpusScript。
 */
export function createFakeDiscord(options = {}) {
  const botUserId = options.botUserId ?? "bot-fake-1";
  const guildSpecs = options.guilds ?? [];
  const record = {
    /** @type {any[]} */ clients: [],
    /** @type {string[]} */ logins: [],
    destroyedClients: 0,
    /** @type {any[]} */ joins: [],
    /** @type {any[]} */ connections: [],
    /** @type {Array<{ userId: string; options: any }>} */ subscribes: [],
    /** @type {string[]} */ memberFetches: [],
    /** destroy していない同じ guild + group の接続があるのに呼ばれた joinVoiceChannel（本物は使い回す・Domain I）。 @type {any[]} */
    reusedJoins: [],
    loadCount: 0
  };

  /** サーバーごとの voiceStates（userId → channelId・Domain I の人数）。 @type {Map<string, Map<string, { id: string; channelId: string }>>} */
  const voiceStateCaches = new Map();
  /** @param {string} guildId */
  const voiceStateCache = (guildId) => {
    let cache = voiceStateCaches.get(guildId);
    if (!cache) {
      cache = new Map();
      const spec = guildSpecs.find((g) => g.id === guildId);
      for (const [userId, channelId] of Object.entries(spec?.voiceStates ?? {})) cache.set(userId, { id: userId, channelId });
      voiceStateCaches.set(guildId, cache);
    }
    return cache;
  };

  /** @param {FakeChannelSpec} spec @param {string} [guildId] */
  const makeChannel = (spec, guildId) => {
    const type = spec.type ?? FAKE_CHANNEL_TYPE.GuildVoice;
    return {
      id: spec.id,
      name: spec.name,
      guildId,
      type,
      rawPosition: spec.rawPosition ?? 0,
      isVoiceBased: () => type === FAKE_CHANNEL_TYPE.GuildVoice || type === FAKE_CHANNEL_TYPE.GuildStageVoice,
      members: new Map()
    };
  };

  /** @param {FakeGuildSpec} spec */
  const makeGuild = (spec) => {
    const channels = (spec.channels ?? []).map((c) => makeChannel(c, spec.id));
    return {
      id: spec.id,
      name: spec.name,
      voiceStates: { cache: voiceStateCache(spec.id) },
      voiceAdapterCreator: () => ({ sendPayload: () => true, destroy: () => {} }),
      channels: {
        /** @param {string} [id] */
        async fetch(id) {
          if (id === undefined) return new Map(channels.map((c) => [c.id, c]));
          const found = channels.find((c) => c.id === id);
          if (!found) throw new Error(`Unknown Channel ${id}`);
          return found;
        }
      },
      members: {
        /** @param {string} userId */
        async fetch(userId) {
          record.memberFetches.push(userId);
          const name = spec.members?.[userId];
          if (typeof name !== "string") throw new Error(`Unknown Member ${userId}`);
          // Domain K: user.bot を載せる（本物の GuildMember と同じ形・bots に挙げた人だけ true）。
          return { id: userId, displayName: name, user: { id: userId, bot: (spec.bots ?? []).includes(userId) } };
        }
      }
    };
  };

  class Client extends EventEmitter {
    /** @param {any} clientOptions */
    constructor(clientOptions) {
      super();
      this.options = clientOptions;
      /** @type {{ id: string } | null} */
      this.user = null;
      this.destroyed = false;
      record.clients.push(this);
      const self = this;
      this.guilds = {
        /** @param {string} [id] */
        async fetch(id) {
          if (self.destroyed) throw new Error("client destroyed");
          if (id === undefined) {
            if (options.catalogFails) throw new Error("Missing Access (fake)");
            return new Map(guildSpecs.map((g) => [g.id, { id: g.id, name: g.name, fetch: async () => makeGuild(g) }]));
          }
          const spec = guildSpecs.find((g) => g.id === id);
          if (!spec) throw new Error(`Unknown Guild ${id}`);
          return makeGuild(spec);
        }
      };
    }
    /** @param {string} token */
    async login(token) {
      record.logins.push(token);
      if (options.loginFails) throw new Error(`An invalid token was provided: ${token}`);
      this.user = { id: botUserId };
      if (!options.neverReady) setImmediate(() => this.emit(FAKE_EVENTS.ClientReady, this));
      return token;
    }
    async destroy() {
      this.destroyed = true;
      record.destroyedClients += 1;
    }
  }

  class FakeVoiceConnection extends EventEmitter {
    /** @param {any} config */
    constructor(config) {
      super();
      this.joinConfig = config;
      this.state = { status: FAKE_VOICE_STATUS.Signalling };
      this.destroyCount = 0;
      const subscriptions = new Map();
      this.receiver = {
        speaking: new EventEmitter(),
        subscriptions,
        /** @param {string} userId @param {any} subscribeOptions */
        subscribe(userId, subscribeOptions) {
          record.subscribes.push({ userId, options: subscribeOptions });
          const stream = new PassThrough({ objectMode: true });
          subscriptions.set(userId, stream);
          stream.once("close", () => {
            if (subscriptions.get(userId) === stream) subscriptions.delete(userId);
          });
          return stream;
        }
      };
    }
    /** 音を流すプレイヤーを結ぶ（Domain E）。 @param {any} player */
    subscribe(player) {
      if (this.state.status === FAKE_VOICE_STATUS.Destroyed) return undefined;
      return fakeSubscribe(this, player);
    }
    /** @param {string} status @param {object} [extra]  状態に足す値（Domain I: closeCode・reason）。 */
    setStatus(status, extra = {}) {
      const old = this.state;
      this.state = { status, ...extra };
      this.emit("stateChange", old, this.state);
    }
    destroy() {
      if (this.state.status === FAKE_VOICE_STATUS.Destroyed) throw new Error("Cannot destroy VoiceConnection - it has already been destroyed");
      this.destroyCount += 1;
      this.setStatus(FAKE_VOICE_STATUS.Destroyed);
    }
  }

  /** @param {any} config */
  const joinVoiceChannel = (config) => {
    record.joins.push(config);
    const live = record.connections.find(
      (c) =>
        c.state.status !== FAKE_VOICE_STATUS.Destroyed &&
        c.joinConfig.guildId === config.guildId &&
        (c.joinConfig.group ?? "default") === (config.group ?? "default")
    );
    if (live) record.reusedJoins.push(config);
    const connection = new FakeVoiceConnection(config);
    record.connections.push(connection);
    if (!options.joinFails) {
      setImmediate(() => {
        if (connection.state.status === FAKE_VOICE_STATUS.Destroyed) return;
        connection.setStatus(FAKE_VOICE_STATUS.Connecting);
        connection.setStatus(FAKE_VOICE_STATUS.Ready);
      });
    }
    return connection;
  };

  /**
   * Domain I: 本物と同じく、上限（timeoutMs）までに目当ての状態にならなければ reject する（数でなければ待ち続ける）。
   * @param {any} connection @param {string} status @param {number} timeoutMs
   */
  const entersState = (connection, status, timeoutMs) => {
    if (options.joinFails) return Promise.reject(new Error("The operation was aborted (fake)"));
    if (connection.state.status === status) return Promise.resolve(connection);
    return new Promise((resolve, reject) => {
      /** @type {any} */
      let timer = null;
      const done = () => {
        connection.off("stateChange", onChange);
        if (timer) clearTimeout(timer);
      };
      /** @param {any} _old @param {any} next */
      const onChange = (_old, next) => {
        if (next.status === status) {
          done();
          resolve(connection);
        } else if (next.status === FAKE_VOICE_STATUS.Destroyed) {
          done();
          reject(new Error("destroyed"));
        }
      };
      connection.on("stateChange", onChange);
      if (typeof timeoutMs === "number" && Number.isFinite(timeoutMs)) {
        timer = setTimeout(() => {
          done();
          reject(new Error("The operation was aborted (fake timeout)"));
        }, timeoutMs);
      }
    });
  };

  const audio = createFakeDiscordAudio();
  const libraries = {
    discord: { Client, Events: FAKE_EVENTS, GatewayIntentBits: FAKE_INTENTS, ChannelType: FAKE_CHANNEL_TYPE },
    voice: {
      joinVoiceChannel,
      entersState,
      VoiceConnectionStatus: FAKE_VOICE_STATUS,
      EndBehaviorType: FAKE_END_BEHAVIOR,
      // Domain E: 音を流す部品。
      createAudioPlayer: audio.createAudioPlayer,
      createAudioResource: audio.createAudioResource,
      StreamType: audio.StreamType,
      AudioPlayerStatus: audio.AudioPlayerStatus,
      NoSubscriberBehavior: audio.NoSubscriberBehavior
    },
    OpusScript: options.OpusScript ?? FakeOpusScript
  };

  /** 最後の VC の接続。 */
  const connection = () => /** @type {FakeVoiceConnection | undefined} */ (record.connections.at(-1));
  /** 最後の Client。 */
  const client = () => /** @type {Client | undefined} */ (record.clients.at(-1));

  return {
    libraries,
    /** 音を流す部品（Domain E・`audio.step(n)` で 20ms の周期を進める・`audio.players`・`audio.resources`・`audio.record`）。 */
    audio,
    /** Discord の体験の口の loadLibraries に渡す口（呼ばれた回数を数える）。 */
    loadLibraries: async () => {
      record.loadCount += 1;
      return libraries;
    },
    record,
    connection,
    client,
    /** その人が話し始めた（receiver.speaking の start）。 @param {string} userId */
    speak(userId) {
      connection()?.receiver.speaking.emit("start", userId);
    },
    /** その人の購読に Opus のパケットを書く。 @param {string} userId @param {Buffer} packet */
    send(userId, packet) {
      const stream = connection()?.receiver.subscriptions.get(userId);
      if (!stream) throw new Error(`no subscription for ${userId}`);
      stream.write(packet);
    },
    /** その人の購読を終える（AfterSilence の無音で閉じたのと同じ）。 @param {string} userId */
    endSpeech(userId) {
      connection()?.receiver.subscriptions.get(userId)?.end();
    },
    /**
     * 入退室（client の voiceStateUpdate）。Domain I: name / bot を渡すと member（displayName・user.bot）を載せる。サーバーの
     * voiceStates（人数）も書き換える。
     * @param {{ userId: string; guildId: string; from: string | null; to: string | null; name?: string; bot?: boolean }} change
     */
    voiceState(change) {
      const guild = { id: change.guildId };
      const member =
        change.name !== undefined || change.bot !== undefined
          ? { displayName: change.name ?? null, user: { id: change.userId, bot: change.bot === true } }
          : undefined;
      const cache = voiceStateCache(change.guildId);
      // Domain K: member が分かれば voiceStates の項目にも載せる（本物の VoiceState#member と同じく名前・Bot かを引ける）。
      if (change.to) cache.set(change.userId, { id: change.userId, channelId: change.to, ...(member ? { member } : {}) });
      else cache.delete(change.userId);
      client()?.emit(
        FAKE_EVENTS.VoiceStateUpdate,
        { id: change.userId, guild, channelId: change.from, ...(member ? { member } : {}) },
        { id: change.userId, guild, channelId: change.to, ...(member ? { member } : {}) }
      );
    },
    /** 接続の状態を替える（切れた・つながり直した）。 @param {string} status @param {object} [extra]  closeCode・reason（Domain I）。 */
    setConnectionStatus(status, extra) {
      connection()?.setStatus(status, extra);
    },
    /**
     * Discord の画面で Bot を別の VC へ動かす（Domain I）。本物と同じ順: ライブラリが Bot の VOICE_STATE_UPDATE で接続の
     * joinConfig.channelId を書き換え → client が voiceStateUpdate を出す。opts.closeCode4014 なら、そのあと声の WebSocket が 4014 で
     * 閉じて Disconnected（closeCode 4014）→ 動いた先の声のサーバーの知らせで Connecting → Ready（opts.recover が false なら戻らない）。
     * opts.closeFirst なら 4014 を voiceStateUpdate より先に出す。opts.channelName を渡すと newState.channel に名前を載せる。
     * @param {string} to @param {{ closeCode4014?: boolean; closeFirst?: boolean; recover?: boolean; channelName?: string }} [opts]
     */
    moveBot(to, opts = {}) {
      const c = connection();
      if (!c) throw new Error("no connection");
      const guildId = c.joinConfig.guildId;
      const from = c.joinConfig.channelId;
      const close = () => {
        if (opts.closeCode4014) c.setStatus(FAKE_VOICE_STATUS.Disconnected, { reason: 0, closeCode: 4014 });
      };
      if (opts.closeFirst) close();
      c.joinConfig = { ...c.joinConfig, channelId: to };
      const guild = { id: guildId };
      voiceStateCache(guildId).set(botUserId, { id: botUserId, channelId: to });
      client()?.emit(
        FAKE_EVENTS.VoiceStateUpdate,
        { id: botUserId, guild, channelId: from },
        { id: botUserId, guild, channelId: to, ...(opts.channelName ? { channel: { id: to, name: opts.channelName } } : {}) }
      );
      if (!opts.closeFirst) close();
      if (opts.closeCode4014 && opts.recover !== false) {
        c.setStatus(FAKE_VOICE_STATUS.Connecting);
        c.setStatus(FAKE_VOICE_STATUS.Ready);
      }
    },
    /**
     * 外から切る（Domain I・キック / チャンネルの削除）: Bot 自身の voiceStateUpdate（VC → なし）と 4014 の Disconnected。
     * opts.voiceState が false なら 4014 だけ。
     * @param {{ voiceState?: boolean }} [opts]
     */
    kickBot(opts = {}) {
      const c = connection();
      if (!c) throw new Error("no connection");
      const guildId = c.joinConfig.guildId;
      if (opts.voiceState !== false) {
        voiceStateCache(guildId).delete(botUserId);
        client()?.emit(
          FAKE_EVENTS.VoiceStateUpdate,
          { id: botUserId, guild: { id: guildId }, channelId: c.joinConfig.channelId },
          { id: botUserId, guild: { id: guildId }, channelId: null }
        );
      }
      c.setStatus(FAKE_VOICE_STATUS.Disconnected, { reason: 0, closeCode: 4014 });
    }
  };
}
