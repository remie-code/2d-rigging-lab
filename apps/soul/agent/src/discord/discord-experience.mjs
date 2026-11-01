// @ts-check
/**
 * Discord の体験の口（Discord モード Domain D・discord-mode.md §4.3・§5・§6・§9・§10）— apps/soul/agent。
 *
 * 場（cockpit-server）の「体験の口」の約束（createCockpitServer の options.experiences）に沿って、Discord の入口（耳）を作る。
 * scripts/cockpit.mjs が `createCockpitServer({ experiences: { discord } })` で渡す。
 *
 * ── 開く（場の共通の段から呼ばれる順・設計 §4.3 の「実物の順」）─────────────────────────────
 *  1. prepareEntrance（入口の下見・声の engine の用意より前）: ロールがあるか・Discord の準備（サーバー・ボイスチャンネル・
 *     文字起こしの方式）が揃っているか・ロールの鍵が読めるか・文字起こしのキー / モデルが揃っているか（場の口 prepareEars・
 *     配信と同じ流儀）。ここではログインしない。
 *  2.（場: 声の engine の用意。用意できなければ abortEntrance）
 *  3. openEntrance: Discord の部品を**ここで動的 import**し、Bot がログイン（Intent は Guilds と GuildVoiceStates だけ）→
 *     サーバーとボイスチャンネルを確かめる → VC に入る（`joinVoiceChannel` の `group` はロールの id）→ Ready を待つ →
 *     耳の束を作り、人が話し始めたら（`receiver.speaking` の start）その人を購読する。
 *     どれかで止まったら、**この入口が自分で畳む**（購読・デコーダ・耳の束・接続・ログイン）。場は開かずに理由を出す。
 *  4.（場: 再生器 → 目 → 頭のセッション → 器）
 *
 * ── 閉じる ─────────────────────────────────────────────────────────────
 *  closeEntrance: VC を抜けてログアウトする（場が正本を手放し耳の束を畳んだあと）。**冪等**（開いていなくても・二重でも）。
 *  抜けるのは操作者の操作（場を閉じる）だけ。全員が抜けても、接続が切れても、Bot は自分では抜けない（scope §21・§23）。
 *
 * ── 人ごとの音 → 耳（§6.2）────────────────────────────────────────────────
 *  人ごとに Opus のデコーダ 1 つ（直に 16kHz モノラル）と耳 1 本。耳は場の口 createEar（配信の耳と同じ組み立て・whisper /
 *  ElevenLabs / ローカルの選び分けを二重に書かない）で作り、耳の束に `discord-<n>` の名前で束ねる（束の名前に Discord の id を
 *  入れない）。行の話者は you + Discord の名前（guild.members.fetch(userId).displayName）+ ユーザー id（積む口を包んで載せる）。
 *  購読の終わり（AfterSilence）で短い無音を足し、耳の区切りを閉じる。人が VC から抜けたら耳を束から外す（正本は続く）。
 *
 * ── ほぼ無音の発言の除き方（§6.4）──────────────────────────────────────────
 *  1. デコードの前に 3 バイトの無音のフレーム（F8 FF FE）を捨てる（ここ）。
 *  2. 耳の Silero VAD に任せる（ear-pipeline）。
 *  3. 短すぎる発話（既定 400ms 未満）を捨てる（耳の区切りの minSpeechMs を Discord の耳だけ 400ms にする）。
 *  頭欠けは受け入れる（印は付けない・§6.5）。
 *
 * ── 守り（§10）─────────────────────────────────────────────────────────
 *  鍵はロールの指すファイルからコードの中で読み（discord-token.mjs）、process.env に入れない。理由の文面は決まった短い日本語
 *  （鍵の値・Discord の id・名前・discord.js の生のエラー文を入れない）。ログ（log の口）は数と状態だけ（文字起こしの本文・
 *  名前・Discord の id を出さない）。声は保存しない。
 */

import { STT_ENGINES } from "../ears/ear-pipeline.mjs";
import { loadDiscordBotToken, DEFAULT_DISCORD_BOT_KEY_FILE } from "./discord-token.mjs";
import { loadDiscordLibraries } from "./discord-libraries.mjs";
import {
  createOpusDecoder16k,
  createSpeakerAudioSource,
  isOpusSilenceFrame,
  silencePcm,
  toPcmBuffer
} from "./discord-audio.mjs";

/** Discord の準備の文字起こしの方式が無いときの既定（配信の文字起こしの既定と同じ）。 */
export const DEFAULT_DISCORD_STT_ENGINE = "whisper";

/** snapshot の `stream.connection` の値（Discord の場の間だけ・それ以外は null）。 */
export const DISCORD_CONNECTION_STATES = Object.freeze(["joining", "joined", "disconnected"]);

/** 購読を閉じる無音の長さ（AfterSilence の duration）。 */
export const DISCORD_SILENCE_END_MS = 500;
/** 購読の終わりに足す無音の長さ（耳の区切り = 400ms の無音 + VAD の数フレームより長く）。 */
export const DISCORD_TAIL_SILENCE_MS = 800;
/** 短すぎる発話（§6.4 の 3・先例 400ms）。Discord の耳の区切りの minSpeechMs。 */
export const DISCORD_MIN_SPEECH_MS = 400;
/** ログインして Ready になるまでの待ち。 */
export const DISCORD_LOGIN_TIMEOUT_MS = 30_000;
/** VC に入って Ready になるまでの待ち。 */
export const DISCORD_READY_TIMEOUT_MS = 30_000;

/** Discord の準備の id（サーバー・ボイスチャンネル）の形（Discord の id は数字。テストの偽の値も通す）。 */
const PREP_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * 入れない・切れたときの理由（決まった短い日本語・鍵の値 / Discord の id / 名前 / discord.js の生のエラー文を入れない）。
 * 鍵が読めないときは discord-token.mjs の理由（ファイル名だけを含む）をそのまま使う。
 */
export const DISCORD_REASONS = Object.freeze({
  noRole: "VC に入れるロールが無い",
  notPrepared: "Discord の準備でサーバーとボイスチャンネルを選んでいない",
  sttEngine: "Discord の準備の文字起こしの方式が使えない",
  venue: "Discord の入口を開けない（場の口が無い）",
  libraries: "Discord の部品を読み込めない（apps/soul/agent で依存を入れる）",
  login: "Discord にログインできない（鍵が正しいか・ネットにつながるか）",
  guild: "選んだサーバーが見つからない（Bot がそのサーバーに入っているか）",
  channel: "選んだボイスチャンネルが見つからない",
  join: "VC に入れない（時間切れ・権限・満員など）",
  closed: "VC に入る途中で場を閉じた",
  catalog: "サーバーとボイスチャンネルの一覧を読めない",
  ear: "Discord の人の耳を起こせない（文字起こしの部品が起きない）",
  unexpectedOpen: "Discord の VC に入れない（想定外のエラー）",
  unexpectedClose: "Discord の VC から抜ける途中で想定外のエラー"
});

/** 準備の書き換えを断る理由。 */
export const DISCORD_PREP_REFUSALS = Object.freeze({
  shape: "Discord の準備の形が違う",
  guildId: "サーバーの id の形が違う",
  channelId: "ボイスチャンネルの id の形が違う",
  sttEngine: "知らない文字起こしの方式"
});

/**
 * 待つ（上限つき）。上限を超えたら reject。
 * @template T
 * @param {Promise<T>} promise @param {number} ms @param {typeof setTimeout} setTimeoutImpl @param {typeof clearTimeout} clearTimeoutImpl
 * @returns {Promise<T>}
 */
function withTimeout(promise, ms, setTimeoutImpl, clearTimeoutImpl) {
  /** @type {any} */
  let timer;
  const timeout = new Promise((_resolve, reject) => {
    timer = setTimeoutImpl(() => reject(new Error("timeout")), ms);
  });
  return /** @type {Promise<T>} */ (Promise.race([promise, timeout])).finally(() => clearTimeoutImpl(timer));
}

/**
 * Discord の準備の生の値を揃える（id は形が合わなければ null・方式は知らなければ null）。
 * @param {any} raw
 * @returns {{ guildId: string | null; channelId: string | null; sttEngine: string | null }}
 */
export function normalizeDiscordPrep(raw) {
  const r = raw && typeof raw === "object" ? raw : {};
  const id = (/** @type {unknown} */ v) => (typeof v === "string" && PREP_ID_PATTERN.test(v) ? v : null);
  return {
    guildId: id(r.guildId),
    channelId: id(r.channelId),
    sttEngine: typeof r.sttEngine === "string" && STT_ENGINES.includes(/** @type {any} */ (r.sttEngine)) ? r.sttEngine : null
  };
}

/**
 * Discord の準備の書き換え（画面からの patch）を確かめる。null は消す。サーバーを替えてチャンネルを渡さなければ、
 * チャンネルも消す（チャンネルはサーバーに属する）。
 * @param {{ guildId: string | null; channelId: string | null; sttEngine: string | null }} current
 * @param {unknown} patch
 * @returns {{ ok: true; patch: Record<string, string | null> } | { ok: false; reason: string }}
 */
export function checkDiscordPrepPatch(current, patch) {
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) return { ok: false, reason: DISCORD_PREP_REFUSALS.shape };
  const p = /** @type {Record<string, unknown>} */ (patch);
  /** @type {Record<string, string | null>} */
  const out = {};
  for (const key of ["guildId", "channelId"]) {
    if (p[key] === undefined) continue;
    const value = p[key] === "" ? null : p[key];
    if (value !== null && !(typeof value === "string" && PREP_ID_PATTERN.test(value))) {
      return { ok: false, reason: DISCORD_PREP_REFUSALS[/** @type {"guildId" | "channelId"} */ (key)] };
    }
    out[key] = /** @type {string | null} */ (value);
  }
  if (p.sttEngine !== undefined) {
    const value = p.sttEngine === "" ? null : p.sttEngine;
    if (value !== null && !(typeof value === "string" && STT_ENGINES.includes(/** @type {any} */ (value)))) {
      return { ok: false, reason: DISCORD_PREP_REFUSALS.sttEngine };
    }
    out.sttEngine = /** @type {string | null} */ (value);
  }
  if ("guildId" in out && out.guildId !== current.guildId && !("channelId" in out)) out.channelId = null;
  return { ok: true, patch: out };
}

/**
 * 積む口を包み、その人の行に you + 名前 + id を載せる（ear-pipeline は話者を知らない・耳は積むだけ）。名前は積む時点の値
 * （名前の取得が後から届いても、その後の行には載る）。
 * @param {any} buffer  場の正本（積む口）。
 * @param {{ userId: string; name: string | null }} person
 */
export function speakerTranscriptMouth(buffer, person) {
  return Object.freeze({
    ...buffer,
    /** @param {any} input */
    append(input) {
      return buffer.append({
        ...input,
        speaker: "you",
        ...(typeof person.name === "string" && person.name.length > 0 ? { displayName: person.name } : {}),
        speakerId: person.userId
      });
    }
  });
}

/**
 * Discord の体験の口を作る。
 *
 * @param {object} deps
 * @param {{ getDiscordPrep: () => any; setDiscordPrep: (patch: object) => void }} deps.settings  Discord の準備の置き場
 *   （cockpit-settings-store.mjs の get / set。テストは一時フォルダの設定ファイル）。
 * @param {() => (string | null | undefined)} [deps.currentKeyFile]  今のロールの鍵のファイル名（一覧の読み込みと、場のロールの束が
 *   指していないときに使う）。無ければ既定 `.env.discord.local`。
 * @param {(fileName: string) => ({ ok: true; token: string } | { ok: false; reason: string })} [deps.loadToken]  鍵を読む口
 *   （既定 loadDiscordBotToken。テストは差し替える）。
 * @param {() => Promise<import("./discord-libraries.mjs").DiscordLibraries>} [deps.loadLibraries]  Discord の部品を読み込む口
 *   （既定 loadDiscordLibraries = 動的 import。テストは偽の Discord）。
 * @param {(line: string) => void} [deps.log]  ログの 1 行（数と状態だけ）。
 * @param {(info: { connection: any; voice: any; groupId: string }) => ({ dispose?: () => any } | null | undefined)} [deps.outletFactory]
 *   Discord の出口（Domain E）の置き場: VC に入ったあと、その接続と @discordjs/voice を渡して呼ぶ（返り値は閉じるときに畳む）。
 *   Domain D では渡さない（声は今の再生器のまま）。
 * @param {typeof setTimeout} [deps.setTimeoutImpl]
 * @param {typeof clearTimeout} [deps.clearTimeoutImpl]
 * @param {number} [deps.loginTimeoutMs=DISCORD_LOGIN_TIMEOUT_MS]
 * @param {number} [deps.readyTimeoutMs=DISCORD_READY_TIMEOUT_MS]
 * @param {number} [deps.silenceEndMs=DISCORD_SILENCE_END_MS]
 * @param {number} [deps.tailSilenceMs=DISCORD_TAIL_SILENCE_MS]
 * @param {number} [deps.minSpeechMs=DISCORD_MIN_SPEECH_MS]
 */
export function createDiscordExperience(deps) {
  const settings = deps.settings;
  const loadToken = deps.loadToken ?? ((/** @type {string} */ fileName) => loadDiscordBotToken({ fileName }));
  const loadLibraries = deps.loadLibraries ?? loadDiscordLibraries;
  const log = typeof deps.log === "function" ? deps.log : () => {};
  const setTimeoutImpl = deps.setTimeoutImpl ?? setTimeout;
  const clearTimeoutImpl = deps.clearTimeoutImpl ?? clearTimeout;
  const loginTimeoutMs = deps.loginTimeoutMs ?? DISCORD_LOGIN_TIMEOUT_MS;
  const readyTimeoutMs = deps.readyTimeoutMs ?? DISCORD_READY_TIMEOUT_MS;
  const silenceEndMs = deps.silenceEndMs ?? DISCORD_SILENCE_END_MS;
  const tailSilenceMs = deps.tailSilenceMs ?? DISCORD_TAIL_SILENCE_MS;
  const minSpeechMs = deps.minSpeechMs ?? DISCORD_MIN_SPEECH_MS;

  /** @type {"joining" | "joined" | "disconnected" | null} */
  let connection = null;
  /** 今の VC の 1 回分（開いている間だけ）。 @type {any} */
  let session = null;
  /** 読み込み中の一覧（同時に 2 回はログインしない）。 @type {Promise<any> | null} */
  let catalogInFlight = null;

  const say = (/** @type {string} */ line) => {
    try {
      log(line);
    } catch {
      // ログの失敗で入口を止めない。
    }
  };

  /** @param {"joining" | "joined" | "disconnected" | null} next @param {any} [venue] */
  const setConnection = (next, venue) => {
    if (connection === next) return;
    connection = next;
    try {
      venue?.changed?.();
    } catch {
      // best-effort
    }
  };

  const readPrep = () => {
    try {
      return normalizeDiscordPrep(settings.getDiscordPrep());
    } catch {
      return normalizeDiscordPrep(null);
    }
  };

  const currentKeyFile = () => {
    try {
      const name = deps.currentKeyFile?.();
      return typeof name === "string" && name.length > 0 ? name : DEFAULT_DISCORD_BOT_KEY_FILE;
    } catch {
      return DEFAULT_DISCORD_BOT_KEY_FILE;
    }
  };

  /** @param {string} fileName */
  const readToken = (fileName) => {
    try {
      const r = loadToken(fileName);
      return r && r.ok === true && typeof r.token === "string" && r.token.length > 0
        ? { ok: /** @type {const} */ (true), token: r.token }
        : { ok: /** @type {const} */ (false), reason: (r && typeof r.reason === "string" && r.reason) || DISCORD_REASONS.login };
    } catch {
      return { ok: /** @type {const} */ (false), reason: DISCORD_REASONS.login };
    }
  };

  /**
   * Bot をログインさせる（Intent は Guilds と GuildVoiceStates だけ）。失敗は投げる（呼び出し側が決まった理由にする）。
   * @param {any} discord @param {string} token
   */
  const loginClient = async (discord, token) => {
    const { Client, Events, GatewayIntentBits } = discord;
    const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates] });
    // client の error は数えるだけ（生のエラー文は出さない）。
    client.on("error", () => say("client error"));
    const ready = new Promise((resolve) => client.once(Events.ClientReady, resolve));
    try {
      await withTimeout(Promise.all([client.login(token), ready]), loginTimeoutMs, setTimeoutImpl, clearTimeoutImpl);
    } catch (error) {
      await destroyClient(client);
      throw error;
    }
    return client;
  };

  /** @param {any} client */
  const destroyClient = async (client) => {
    if (!client) return;
    try {
      await client.destroy();
    } catch {
      // best-effort
    }
  };

  // ── 人ごとの音 → 耳 ──────────────────────────────────────────────────

  /** 空いている一番小さい席（whisper の口の番号をずらすため）。 @param {any} s */
  const freeSlot = (s) => {
    const used = new Set([...s.people.values()].map((p) => p.slot));
    let slot = 0;
    while (used.has(slot)) slot += 1;
    return slot;
  };

  /**
   * その人の耳（無ければ作る）。耳が起きなかった人は、この場の間は聞かない（null）。
   * @param {any} s @param {string} userId
   */
  const ensurePerson = (s, userId) => {
    const existing = s.people.get(userId);
    if (existing) return existing.failed ? null : existing;
    if (s.closed || !s.ears || s.ears.isDisposed()) return null;
    s.seq += 1;
    const person = {
      userId,
      key: `discord-${s.seq}`,
      slot: freeSlot(s),
      /** @type {string | null} */ name: null,
      source: createSpeakerAudioSource(),
      /** @type {any} */ decoder: null,
      /** @type {any} */ ear: null,
      failed: false,
      gone: false
    };
    try {
      person.decoder = createOpusDecoder16k(s.OpusScript);
    } catch {
      person.failed = true;
      s.people.set(userId, person);
      say("speaker decoder failed");
      return null;
    }
    s.people.set(userId, person);
    void fetchName(s, person);
    /** @type {any} */
    let ear;
    try {
      ear = s.venue.createEar({
        earPlan: s.plan.earPlan,
        ears: s.ears,
        key: person.key,
        captureFactory: person.source.captureFactory,
        transcriptBuffer: speakerTranscriptMouth(s.venue.transcriptBuffer, person),
        segmenter: { minSpeechMs },
        whisperPortOffset: person.slot
      });
      s.ears.add(person.key, ear);
    } catch {
      failPerson(s, person, null);
      return null;
    }
    person.ear = ear;
    Promise.resolve()
      .then(() => ear.start())
      .then(
        () => {
          if (s.closed || person.gone) return;
          try {
            s.venue.earStarted?.(s.plan.earPlan.engine);
          } catch {
            // best-effort
          }
          say(`speaker ear started (speakers ${countLive(s)})`);
        },
        () => {
          if (s.closed || person.gone) return;
          failPerson(s, person, DISCORD_REASONS.ear);
        }
      );
    return person;
  };

  /** @param {any} s */
  const countLive = (s) => [...s.people.values()].filter((p) => !p.failed && !p.gone).length;

  /**
   * 耳が起きなかった人（この場の間は聞かない）。耳は耳の側が自分を畳む約束なので、束から外して念のため畳む。
   * @param {any} s @param {any} person @param {string | null} reason
   */
  const failPerson = (s, person, reason) => {
    person.failed = true;
    releasePerson(s, person);
    try {
      void s.ears?.drop(person.key);
    } catch {
      // best-effort
    }
    if (reason) {
      try {
        s.venue.earFailed?.(s.plan.earPlan.engine, reason);
      } catch {
        // best-effort
      }
    }
    say("speaker ear failed");
  };

  /** 購読・デコーダ・音の入口を畳む（耳そのものは束の側）。 @param {any} s @param {any} person */
  const releasePerson = (s, person) => {
    try {
      s.receiver?.subscriptions?.get(person.userId)?.destroy?.();
    } catch {
      // best-effort
    }
    try {
      person.source.dispose();
    } catch {
      // best-effort
    }
    if (person.decoder) {
      try {
        person.decoder.delete?.();
      } catch {
        // best-effort
      }
      person.decoder = null;
    }
  };

  /** 名前は 1 人 1 回だけ取る（特権 Intent なしで取れる・受信の試し）。取れなければ名前なし。 @param {any} s @param {any} person */
  const fetchName = async (s, person) => {
    try {
      const member = await s.guild.members.fetch(person.userId);
      const name = member && typeof member.displayName === "string" ? member.displayName.trim() : "";
      if (name.length > 0) person.name = name;
    } catch {
      // 名前が取れなくても聞く（行は名前なしの you）。
    }
  };

  /**
   * 人が話し始めた（receiver.speaking の start）: その人を購読し、デコードして耳へ流す。
   * @param {any} s @param {string} userId
   */
  const handleSpeakingStart = (s, userId) => {
    if (s.closed || typeof userId !== "string" || userId === s.botId) return;
    const receiver = s.receiver;
    // 同じ人の購読が続いている間（黙って閉じる前）は、同じ購読のまま。
    if (receiver.subscriptions.has(userId)) return;
    const person = ensurePerson(s, userId);
    if (!person) return;
    /** @type {any} */
    let stream;
    try {
      stream = receiver.subscribe(userId, { end: { behavior: s.voice.EndBehaviorType.AfterSilence, duration: silenceEndMs } });
    } catch {
      s.counters.subscribeErrors += 1;
      return;
    }
    s.counters.utterances += 1;
    stream.on("data", (/** @type {Buffer} */ packet) => {
      if (s.closed || person.gone || person.failed) return;
      s.counters.packets += 1;
      // §6.4 の 1: 3 バイトの無音のフレームはデコードの前に捨てる。
      if (isOpusSilenceFrame(packet)) {
        s.counters.silenceFrames += 1;
        return;
      }
      try {
        person.source.push(toPcmBuffer(person.decoder.decode(packet)));
      } catch {
        s.counters.decodeErrors += 1;
      }
    });
    stream.on("error", () => {
      s.counters.streamErrors += 1;
    });
    // 購読の終わり（黙った）: 耳の区切りが閉じるよう短い無音を足す（Discord は黙っている間は音を送らない）。
    stream.once("close", () => {
      if (s.closed || person.gone || person.failed) return;
      person.source.push(silencePcm(tailSilenceMs));
    });
  };

  /**
   * VC への入退室: 抜けた人の耳を束から外す（正本は続く・場は閉じない）。全員が抜けても Bot は抜けない。
   * @param {any} s @param {any} oldState @param {any} newState
   */
  const handleVoiceState = (s, oldState, newState) => {
    if (s.closed) return;
    const guildId = newState?.guild?.id ?? oldState?.guild?.id ?? null;
    if (guildId !== s.plan.guildId) return;
    const userId = newState?.id ?? oldState?.id;
    if (typeof userId !== "string" || userId === s.botId) return;
    const was = oldState?.channelId === s.plan.channelId;
    const now = newState?.channelId === s.plan.channelId;
    if (!was || now) return;
    const person = s.people.get(userId);
    if (!person) return;
    person.gone = true;
    s.people.delete(userId);
    releasePerson(s, person);
    if (!person.failed) {
      try {
        void s.ears?.drop(person.key);
      } catch {
        // best-effort
      }
    }
    say(`speaker left (speakers ${countLive(s)})`);
  };

  /**
   * 接続の状態（ライブラリのつなぎ直しに任せる・場は閉じない）。最初に Ready になるまでは「入っている途中」のまま。
   * @param {any} s @param {string} status
   */
  const handleConnectionStatus = (s, status) => {
    if (s.closed || session !== s) return;
    const st = s.voice.VoiceConnectionStatus;
    if (!s.readyOnce) return;
    const next = status === st.Ready ? "joined" : "disconnected";
    if (next !== connection) say(`connection ${next}`);
    setConnection(next, s.venue);
  };

  /**
   * 今の VC の 1 回分を畳む（冪等）: 購読・デコーダ・耳の束・出口・接続・ログイン。
   * @param {any} s
   */
  const teardown = async (s) => {
    if (!s || s.closed) return;
    s.closed = true;
    for (const off of s.offs.splice(0)) {
      try {
        off();
      } catch {
        // best-effort
      }
    }
    for (const person of s.people.values()) releasePerson(s, person);
    s.people.clear();
    if (s.ears) {
      try {
        await s.ears.dispose();
      } catch {
        // best-effort
      }
    }
    if (s.outlet) {
      try {
        await s.outlet.dispose?.();
      } catch {
        // best-effort
      }
      s.outlet = null;
    }
    if (s.connection) {
      try {
        if (s.connection.state?.status !== s.voice?.VoiceConnectionStatus?.Destroyed) s.connection.destroy();
      } catch {
        // best-effort（既に壊れていても畳む）。
      }
    }
    await destroyClient(s.client);
    if (session === s) session = null;
  };

  /** @param {any} s @param {any} target @param {string} event @param {(...args: any[]) => void} fn */
  const listen = (s, target, event, fn) => {
    target.on(event, fn);
    s.offs.push(() => target.off?.(event, fn) ?? target.removeListener?.(event, fn));
  };

  // ── 体験の口 ──────────────────────────────────────────────────────────

  /**
   * 入口の下見（ここではログインしない）。
   * @param {any} _request  POST の始めるの body（Discord は保存した準備から読む・body の文字起こしの方式は配信のもの）。
   * @param {any} control  場の口（roles・prepareEars・stopEars・changed）。
   */
  function prepareEntrance(_request, control) {
    if (!control || typeof control.prepareEars !== "function") return { ok: false, reason: DISCORD_REASONS.venue };
    const role = Array.isArray(control.roles) ? control.roles[0] ?? null : null;
    if (!role) return { ok: false, reason: DISCORD_REASONS.noRole };
    let groupId = null;
    try {
      groupId = typeof role.id === "function" ? role.id() : null;
    } catch {
      groupId = null;
    }
    if (typeof groupId !== "string" || groupId.length === 0) return { ok: false, reason: DISCORD_REASONS.noRole };
    const prep = readPrep();
    if (!prep.guildId || !prep.channelId) return { ok: false, reason: DISCORD_REASONS.notPrepared };
    // 文字起こしの方式: 選んでいなければ既定。選んだ値が知らない方式なら断る（黙って既定に替えない）。
    let rawEngine = null;
    try {
      rawEngine = settings.getDiscordPrep()?.sttEngine ?? null;
    } catch {
      rawEngine = null;
    }
    if (rawEngine != null && rawEngine !== "" && prep.sttEngine == null) return { ok: false, reason: DISCORD_REASONS.sttEngine };
    const engine = prep.sttEngine ?? DEFAULT_DISCORD_STT_ENGINE;
    let keyFile = null;
    try {
      keyFile = typeof role.discordBotKeyFile === "function" ? role.discordBotKeyFile() : null;
    } catch {
      keyFile = null;
    }
    const token = readToken(typeof keyFile === "string" && keyFile.length > 0 ? keyFile : currentKeyFile());
    if (!token.ok) return { ok: false, reason: token.reason };
    // 文字起こしのキー・モデル（配信と同じ流儀・場の口が確かめて耳の状態を「起こしている途中」にする）。
    const ears = control.prepareEars(engine);
    if (!ears || ears.ok !== true) {
      // Discord の場は開かない。耳の状態は戻す（配信の文字起こしの警告として残さない・理由は stream.error に出る）。
      try {
        control.stopEars?.();
      } catch {
        // best-effort
      }
      return { ok: false, reason: (ears && typeof ears.reason === "string" && ears.reason) || DISCORD_REASONS.sttEngine };
    }
    return {
      ok: true,
      plan: Object.freeze({
        token: token.token,
        guildId: prep.guildId,
        channelId: prep.channelId,
        groupId,
        earPlan: ears.earPlan
      })
    };
  }

  /**
   * 下見のあとで開かないと決まったとき（声の engine を用意できなかった）。耳の状態を戻す。
   * @param {any} _prepared @param {any} control
   */
  function abortEntrance(_prepared, control) {
    try {
      control?.stopEars?.();
    } catch {
      // best-effort
    }
    setConnection(null, control);
  }

  /**
   * 入口を開く: ログイン → サーバーとボイスチャンネル → VC に入る → 耳の束。どこかで止まったら自分で畳み、理由を返す
   * （場は開かない）。想定外の例外も投げずに理由にする。
   * @param {any} plan @param {any} venue
   */
  async function openEntrance(plan, venue) {
    if (session) await teardown(session);
    if (!plan || !venue || typeof venue.createEars !== "function" || typeof venue.createEar !== "function") {
      try {
        venue?.stopEars?.();
      } catch {
        // best-effort
      }
      return { ok: false, reason: DISCORD_REASONS.venue };
    }
    /** @type {any} */
    const s = {
      // 鍵は持ち回らない（ログインに 1 回使うだけ・plan の外に写さない）。
      plan: Object.freeze({ guildId: plan.guildId, channelId: plan.channelId, groupId: plan.groupId, earPlan: plan.earPlan }),
      venue,
      client: null,
      guild: null,
      connection: null,
      receiver: null,
      ears: null,
      outlet: null,
      voice: null,
      OpusScript: null,
      botId: null,
      readyOnce: false,
      closed: false,
      seq: 0,
      people: new Map(),
      /** @type {Array<() => void>} */ offs: [],
      counters: { utterances: 0, packets: 0, silenceFrames: 0, decodeErrors: 0, streamErrors: 0, subscribeErrors: 0 }
    };
    session = s;
    setConnection("joining", venue);
    /** @param {string} reason */
    const refuse = async (reason) => {
      await teardown(s);
      try {
        venue.stopEars?.();
      } catch {
        // best-effort
      }
      if (session === null || session === s) setConnection(null, venue);
      say(`could not join (${reason})`);
      return { ok: /** @type {const} */ (false), reason };
    };
    try {
      /** @type {any} */
      let libs;
      try {
        libs = await loadLibraries();
      } catch {
        return refuse(DISCORD_REASONS.libraries);
      }
      if (s.closed) return refuse(DISCORD_REASONS.closed);
      s.voice = libs.voice;
      s.OpusScript = libs.OpusScript;
      say("logging in");
      try {
        s.client = await loginClient(libs.discord, plan.token);
      } catch {
        return refuse(DISCORD_REASONS.login);
      }
      if (s.closed) return refuse(DISCORD_REASONS.closed);
      s.botId = s.client.user?.id ?? null;
      try {
        s.guild = await s.client.guilds.fetch(plan.guildId);
      } catch {
        s.guild = null;
      }
      if (!s.guild) return refuse(DISCORD_REASONS.guild);
      /** @type {any} */
      let channel = null;
      try {
        channel = await s.guild.channels.fetch(plan.channelId);
      } catch {
        channel = null;
      }
      // 声のチャンネルだけ（ステージは話し手にならないと声を出せないので、一覧と同じく外す）。
      const voiceType = libs.discord.ChannelType?.GuildVoice;
      if (
        !channel ||
        typeof channel.isVoiceBased !== "function" ||
        !channel.isVoiceBased() ||
        (voiceType !== undefined && channel.type !== voiceType)
      ) {
        return refuse(DISCORD_REASONS.channel);
      }
      if (s.closed) return refuse(DISCORD_REASONS.closed);
      const voice = s.voice;
      try {
        // 1 Bot は 1 サーバーで 1 VC。group はロールの id（同じプロセスの 2 つ目の Bot が 1 つ目の接続を使い回さない・外部 §2.1）。
        s.connection = voice.joinVoiceChannel({
          channelId: plan.channelId,
          guildId: plan.guildId,
          adapterCreator: s.guild.voiceAdapterCreator,
          selfDeaf: false,
          selfMute: false,
          group: plan.groupId
        });
      } catch {
        return refuse(DISCORD_REASONS.join);
      }
      listen(s, s.connection, "error", () => say("connection error"));
      listen(s, s.connection, "stateChange", (/** @type {any} */ _old, /** @type {any} */ next) =>
        handleConnectionStatus(s, next?.status)
      );
      try {
        await voice.entersState(s.connection, voice.VoiceConnectionStatus.Ready, readyTimeoutMs);
      } catch {
        return refuse(DISCORD_REASONS.join);
      }
      if (s.closed) return refuse(DISCORD_REASONS.closed);
      s.readyOnce = true;
      // 耳の束（人ごとの耳は話し始めたときに束ねる）。
      s.ears = venue.createEars();
      s.receiver = s.connection.receiver;
      listen(s, s.receiver.speaking, "start", (/** @type {string} */ userId) => handleSpeakingStart(s, userId));
      listen(s, s.client, libs.discord.Events.VoiceStateUpdate, (/** @type {any} */ o, /** @type {any} */ n) =>
        handleVoiceState(s, o, n)
      );
      // Discord の出口の置き場（Domain E）。D では渡さない（声は今の再生器のまま）。
      if (typeof deps.outletFactory === "function") {
        try {
          s.outlet = deps.outletFactory({ connection: s.connection, voice, groupId: plan.groupId }) ?? null;
        } catch {
          s.outlet = null;
          say("outlet failed");
        }
      }
      setConnection("joined", venue);
      try {
        venue.earsListening?.();
      } catch {
        // best-effort
      }
      say("joined");
      return { ok: true, ears: s.ears };
    } catch {
      return refuse(DISCORD_REASONS.unexpectedOpen);
    }
  }

  /**
   * 入口を閉じる（場が正本を手放し耳の束を畳んだあと・サーバを閉じるときも）。冪等（開いていなくても・二重でも）。
   * @param {{ hadEars?: boolean; shutdown?: boolean }} [_info] @param {any} [control]
   */
  async function closeEntrance(_info, control) {
    const s = session;
    if (s) {
      const c = s.counters;
      await teardown(s);
      say(
        `left (utterances ${c.utterances}, packets ${c.packets}, silence frames ${c.silenceFrames}, decode errors ${c.decodeErrors})`
      );
    }
    connection = null;
    try {
      control?.stopEars?.();
    } catch {
      // best-effort
    }
  }

  /** @param {string} phase */
  function busyMessage(phase) {
    return phase === "opening"
      ? "VC に入っている途中（少し待ってからもう一度）"
      : phase === "closing"
        ? "VC から抜けている途中（記録中・少し待ってからもう一度）"
        : "VC に入っている（抜けてから始め直す）";
  }

  /** 場を開く・閉じる途中の想定外の例外の文面（生のエラー文は入れない）。 @param {string} phase */
  function unexpectedErrorMessage(phase) {
    return phase === "closing" ? DISCORD_REASONS.unexpectedClose : DISCORD_REASONS.unexpectedOpen;
  }

  /**
   * サーバーとボイスチャンネルの一覧を読み込む（今のロールの鍵でログイン → 取得 → ログアウト）。同時に 2 回はログインしない
   * （読み込み中ならその結果を待つ）。
   * @returns {Promise<{ ok: true; guilds: Array<{ id: string; name: string; channels: Array<{ id: string; name: string }> }> } | { ok: false; reason: string }>}
   */
  function catalog() {
    if (catalogInFlight) return catalogInFlight;
    const run = (async () => {
      const token = readToken(currentKeyFile());
      if (!token.ok) return { ok: /** @type {const} */ (false), reason: token.reason };
      /** @type {any} */
      let libs;
      try {
        libs = await loadLibraries();
      } catch {
        return { ok: /** @type {const} */ (false), reason: DISCORD_REASONS.libraries };
      }
      /** @type {any} */
      let client;
      try {
        client = await loginClient(libs.discord, token.token);
      } catch {
        say("catalog: could not log in");
        return { ok: /** @type {const} */ (false), reason: DISCORD_REASONS.login };
      }
      try {
        const voiceType = libs.discord.ChannelType?.GuildVoice;
        const partials = await client.guilds.fetch();
        /** @type {Array<{ id: string; name: string; channels: Array<{ id: string; name: string }> }>} */
        const guilds = [];
        for (const partial of partials.values()) {
          const guild = typeof partial.fetch === "function" ? await partial.fetch() : partial;
          const all = await guild.channels.fetch();
          const channels = [...all.values()]
            .filter((ch) => ch && typeof ch.isVoiceBased === "function" && ch.isVoiceBased() && (voiceType === undefined || ch.type === voiceType))
            .sort((a, b) => (a.rawPosition ?? a.position ?? 0) - (b.rawPosition ?? b.position ?? 0))
            .map((ch) => ({ id: String(ch.id), name: String(ch.name ?? "") }));
          guilds.push({ id: String(guild.id), name: String(guild.name ?? ""), channels });
        }
        say(`catalog loaded (guilds ${guilds.length}, channels ${guilds.reduce((n, g) => n + g.channels.length, 0)})`);
        return { ok: /** @type {const} */ (true), guilds };
      } catch {
        say("catalog: could not read");
        return { ok: /** @type {const} */ (false), reason: DISCORD_REASONS.catalog };
      } finally {
        await destroyClient(client);
      }
    })();
    catalogInFlight = run;
    return run.finally(() => {
      if (catalogInFlight === run) catalogInFlight = null;
    });
  }

  /** Discord の準備（サーバー・ボイスチャンネル・文字起こしの方式）の置き場。 */
  const prep = Object.freeze({
    get: () => readPrep(),
    /**
     * @param {unknown} patch
     * @returns {{ ok: true; prep: ReturnType<typeof normalizeDiscordPrep> } | { ok: false; reason: string }}
     */
    set(patch) {
      const checked = checkDiscordPrepPatch(readPrep(), patch);
      if (!checked.ok) return checked;
      settings.setDiscordPrep(checked.patch);
      return { ok: true, prep: readPrep() };
    }
  });

  return Object.freeze({
    prepareEntrance,
    abortEntrance,
    openEntrance,
    closeEntrance,
    busyMessage,
    unexpectedErrorMessage,
    /** snapshot の `stream.connection`（"joining" | "joined" | "disconnected" | null）。 */
    connectionStatus: () => connection,
    catalog,
    prep,
    /** Discord の出口（Domain E）が今の接続を引く口（VC に入っていなければ null）。 */
    voiceConnection: () => (session && !session.closed && session.readyOnce ? session.connection : null),
    // 言葉と判定の組は Domain F（D では null = 配信の言葉で動く）。
    wording: null,
    teaching: null,
    judgeSet: null
  });
}
