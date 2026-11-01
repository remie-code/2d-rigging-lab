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
 *  抜けるのは操作者の操作（場を閉じる・VC から抜ける）だけ。全員が抜けても、接続が切れても、Bot は自分では抜けない（scope §21・§23）。
 *
 * ── 体験と VC 接続（Discord モード Domain I・§13.2・§13.3）──────────────────────────────────
 *  体験の分（client・guild・部品・botId・耳の束・耳の番号・client の VoiceStateUpdate の購読）と、接続の分（voice connection・
 *  接続のイベント・receiver・speaking の購読・人ごとの購読 / デコーダ / 耳・出口）を分けて持つ。場（server）の API から
 *  vc.join / vc.leave / vc.move を呼ぶ: 抜ける = 接続の分を畳む（人の耳を束から drop・出口を畳む・connection を destroy。耳の束は
 *  体験の間 1 つのまま・client はログアウトしない）、移る = 抜ける + 入る。どの VC にもいない間は接続の状態 "outside"・耳は
 *  「聞いていない」（場の口 pauseEars）・出口は差し口に「VC にいない」の口を残す（hold・手元のスピーカーに戻さない）。
 *  外から: 閉じのコード 4014 は猶予（動かされたときのつなぎ直しを待つ）のあと VC の外で待っている。Bot 自身が今いる VC から別の
 *  VC へ動いた（Discord の画面で動かされた）ら、動いた先を今の VC として追う。自分で抜けた・移ったときは接続の購読を先に外す
 *  ので「切れた」と出ない。出来事は場の口 vcEvent へ合図する（種類と VC・人の名前だけ・id は渡さない。Domain J が使う）。
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
 * ── 言葉と判定の組（Discord モード Domain F・§3.4・§8）───────────────────────────────────
 *  wording = 通話の語の組（venue-wording.mjs の CALL_WORDING。②④・skills/recall.md・思い出しの結果を①に渡す文面）、
 *  teaching = ①に足す Discord の教え（`venue-discord` = skills/venue-discord.md）、judgeSet = { speakNow: Discord の speak-now の
 *  問いの組, recallAvoid: Discord の「避けるか」の問いの組 }。話し始めを speak-now に固定し、自発の発火の予定を作らないのは場の側
 *  （cockpit-server の venueFixesSpeakNow。体験の種類 "discord" で決まる）。
 *
 * ── 画面の準備（Discord モード Domain G・§9・§4.3 の 7）──────────────────────────────────────
 *  visionTarget = Discord の場の見る窓（目）の置き場（配信の見る窓とは別・`cockpit-settings.local.json` の discordVisionTarget）。
 *  eyesWanted() = 見る窓を選んでいるか（選んでいなければ場は Discord の場で目を起こさない）。一覧の読み込み（catalog）も、ロールの
 *  鍵のファイル名の形が合わなければ（currentKeyFileRefused）鍵を読まずログインせずに断る（入口と同じ・E の追認 (1)）。
 *
 * ── 守り（§10）─────────────────────────────────────────────────────────
 *  鍵はロールの指すファイルからコードの中で読み（discord-token.mjs）、process.env に入れない。理由の文面は決まった短い日本語
 *  （鍵の値・Discord の id・名前・discord.js の生のエラー文を入れない）。ログ（log の口）は数と状態だけ（文字起こしの本文・
 *  名前・Discord の id を出さない）。声は保存しない。
 */

import { STT_ENGINES } from "../ears/ear-pipeline.mjs";
import { loadDiscordBotToken, DEFAULT_DISCORD_BOT_KEY_FILE } from "./discord-token.mjs";
import { loadDiscordLibraries } from "./discord-libraries.mjs";
import { CALL_WORDING } from "../mind/venue-wording.mjs";
import { venueTeachingName } from "../mind/soul-skills.mjs";
import { DISCORD_SPEAK_NOW_QUESTIONS } from "../mind/speak-now.mjs";
import { DISCORD_RECALL_AVOID_QUESTIONS } from "../mind/recall.mjs";
import {
  createOpusDecoder16k,
  createSpeakerAudioSource,
  isOpusSilenceFrame,
  silencePcm,
  toPcmBuffer
} from "./discord-audio.mjs";

/** Discord の準備の文字起こしの方式が無いときの既定（配信の文字起こしの既定と同じ）。 */
export const DEFAULT_DISCORD_STT_ENGINE = "whisper";

/**
 * snapshot の `stream.connection` の値（Discord の場の間だけ・それ以外は null）。Domain I: "outside" = どの VC にもいない（自分で
 * 抜けた・外から切られた〔閉じのコード 4014〕。体験は開いたまま VC の外で待っている）。
 */
export const DISCORD_CONNECTION_STATES = Object.freeze(["joining", "joined", "disconnected", "outside"]);

/** 声の WebSocket の閉じのコード「つなぎ直さない」（キック・チャンネルの削除・移された。@discordjs/voice はつなぎ直さない）。 */
export const DISCORD_CLOSE_CODE_DO_NOT_RECONNECT = 4014;
/**
 * 切れたあとの猶予（Domain I）。この間に戻れば何もしない（動かされたときのつなぎ直し・短い途切れ）。戻らなければ、4014 なら
 * VC の外で待っている、それ以外は「切れた」の合図を 1 回出す（公式の勧めの 5 秒と同じ）。
 */
export const DISCORD_DISCONNECT_GRACE_MS = 5_000;
/** snapshot に載せる VC の名前の上限（字数）。 */
export const DISCORD_CHANNEL_NAME_MAX_CHARS = 100;

/** 入る・抜ける・移る（POST /api/discord/vc）を断る理由（決まった短い日本語・id や名前を入れない）。 */
export const DISCORD_VC_REFUSALS = Object.freeze({
  notOpen: "Discord の場が開いていない（VC に入ってから）",
  busy: "VC に入る・抜ける・移るの途中（少し待ってからもう一度）",
  inVc: "もう VC にいる（別の VC へは「移る」）",
  notInVc: "どの VC にもいない（「入る」で入る）",
  same: "もうその VC にいる",
  channelId: "ボイスチャンネルの id の形が違う"
});

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
  // Domain E: role.json の discordBotKeyFile の形が合わない（値は出さない・パスや鍵を含みうる）。
  keyFileName: "ロールの role.json の discordBotKeyFile が使えない（apps/soul/agent/ 直下の .env.discord*.local の名前だけ・項目を消せば既定 .env.discord.local）",
  sttEngine: "Discord の準備の文字起こしの方式が使えない",
  venue: "Discord の入口を開けない（場の口が無い）",
  libraries: "Discord の部品を読み込めない（apps/soul/agent で依存を入れる）",
  login: "Discord にログインできない（鍵が正しいか・ネットにつながるか）",
  guild: "選んだサーバーが見つからない（Bot がそのサーバーに入っているか）",
  channel: "選んだボイスチャンネルが見つからない",
  join: "VC に入れない（時間切れ・権限・満員など）",
  // Domain E: VC に入ったが、声を流す口（Discord 向けの再生器）を作れない。
  outlet: "VC に声を出す口を作れない（Discord の部品の音の口）",
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

/** Discord の場の見る窓の名前（ウインドウのタイトル）の上限（字数・Discord モード Domain G）。 */
export const DISCORD_VISION_TARGET_MAX_CHARS = 512;

/** Discord の場の見る窓の書き換えを断る理由（Discord モード Domain G）。 */
export const DISCORD_VISION_TARGET_REFUSALS = Object.freeze({
  shape: "見る窓の形が違う（窓の名前の文字列か null）",
  length: `見る窓の名前が長すぎる（${DISCORD_VISION_TARGET_MAX_CHARS} 字まで）`
});

/**
 * Discord の場の見る窓の生の値を揃える（空白だけ・文字列でない・長すぎる値は「選んでいない」= null）。
 * @param {unknown} raw
 * @returns {string | null}
 */
export function normalizeDiscordVisionTarget(raw) {
  if (typeof raw !== "string") return null;
  const title = raw.trim();
  return title.length > 0 && [...title].length <= DISCORD_VISION_TARGET_MAX_CHARS ? title : null;
}

/**
 * Discord の場の見る窓の書き換え（画面からの値）を確かめる。null / "" は消す（目を起こさない）。
 * @param {unknown} value
 * @returns {{ ok: true; title: string | null } | { ok: false; reason: string }}
 */
export function checkDiscordVisionTarget(value) {
  if (value === null || value === undefined) return { ok: true, title: null };
  if (typeof value !== "string") return { ok: false, reason: DISCORD_VISION_TARGET_REFUSALS.shape };
  const title = value.trim();
  if (title.length === 0) return { ok: true, title: null };
  if ([...title].length > DISCORD_VISION_TARGET_MAX_CHARS) return { ok: false, reason: DISCORD_VISION_TARGET_REFUSALS.length };
  return { ok: true, title };
}

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
 * その場のロールの束から Discord の出口を作る口を引く（Domain E・設計 §5: 再生器はロールごと・Bot の接続ごと）。VC の `group` は
 * ロールの id なので、その id のロールを選ぶ（見つからなければ先頭のロール）。束が口（voice.openOutlet）を持たなければ null。
 * @param {unknown} roles  場が固めたロールの一覧（openEntrance の venue.roles）。
 * @param {string} groupId
 * @returns {((info: { connection: any; voice: any; groupId: string }) => any) | null}
 */
export function roleOutletFactory(roles, groupId) {
  if (!Array.isArray(roles) || roles.length === 0) return null;
  const idOf = (/** @type {any} */ role) => {
    try {
      return typeof role?.id === "function" ? role.id() : null;
    } catch {
      return null;
    }
  };
  const role = roles.find((r) => idOf(r) === groupId) ?? roles[0];
  const open = role?.voice?.openOutlet;
  return typeof open === "function" ? (info) => open(info) : null;
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
 * @param {() => boolean} [deps.currentKeyFileRefused]  今のロールの鍵のファイル名の形が合わないか（Discord モード Domain G・
 *   一覧の読み込みも入口と同じく断る。true なら鍵を読まずログインしない）。無ければ断らない。
 *   deps.settings に getDiscordVisionTarget / setDiscordVisionTarget があれば、Discord の場の見る窓（目）の置き場に使う（無ければ
 *   いつも「選んでいない」= Discord の場で目を起こさない）。
 * @param {(fileName: string) => ({ ok: true; token: string } | { ok: false; reason: string })} [deps.loadToken]  鍵を読む口
 *   （既定 loadDiscordBotToken。テストは差し替える）。
 * @param {() => Promise<import("./discord-libraries.mjs").DiscordLibraries>} [deps.loadLibraries]  Discord の部品を読み込む口
 *   （既定 loadDiscordLibraries = 動的 import。テストは偽の Discord）。
 * @param {(line: string) => void} [deps.log]  ログの 1 行（数と状態だけ）。
 * @param {(info: { connection: any; voice: any; groupId: string }) => ({ dispose?: () => any } | null | undefined)} [deps.outletFactory]
 *   Discord の出口（Domain E）の置き場: VC に入ったあと、その接続と @discordjs/voice を渡して呼ぶ（返り値は閉じるときに畳む）。
 *   渡さなければ、その場のロールの束の `voice.openOutlet`（{@link roleOutletFactory}・cockpit.mjs が Discord 向けの再生器を作る）。
 *   どちらも無ければ出口なし（声は今の手元の再生器のまま）。
 * @param {typeof setTimeout} [deps.setTimeoutImpl]
 * @param {typeof clearTimeout} [deps.clearTimeoutImpl]
 * @param {number} [deps.loginTimeoutMs=DISCORD_LOGIN_TIMEOUT_MS]
 * @param {number} [deps.readyTimeoutMs=DISCORD_READY_TIMEOUT_MS]
 * @param {number} [deps.silenceEndMs=DISCORD_SILENCE_END_MS]
 * @param {number} [deps.tailSilenceMs=DISCORD_TAIL_SILENCE_MS]
 * @param {number} [deps.minSpeechMs=DISCORD_MIN_SPEECH_MS]
 * @param {number} [deps.disconnectGraceMs=DISCORD_DISCONNECT_GRACE_MS]  切れたあとの猶予（Domain I・テストは短くする）。
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
  const disconnectGraceMs = deps.disconnectGraceMs ?? DISCORD_DISCONNECT_GRACE_MS;

  /** @type {"joining" | "joined" | "disconnected" | "outside" | null} */
  let connection = null;
  /** 体験の分（openEntrance が成り立ってから closeEntrance まで・Domain I）。 @type {any} */
  let experience = null;
  /** 読み込み中の一覧（同時に 2 回はログインしない）。 @type {Promise<any> | null} */
  let catalogInFlight = null;

  const say = (/** @type {string} */ line) => {
    try {
      log(line);
    } catch {
      // ログの失敗で入口を止めない。
    }
  };

  /** @param {"joining" | "joined" | "disconnected" | "outside" | null} next @param {any} [venue] */
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

  /** 今のロールの鍵のファイル名の形が合わないか（Domain G・一覧の読み込みで断る）。読めなければ断る側に倒す。 */
  const currentKeyFileRefused = () => {
    if (typeof deps.currentKeyFileRefused !== "function") return false;
    try {
      return deps.currentKeyFileRefused() === true;
    } catch {
      return true;
    }
  };

  /** Discord の場の見る窓（Domain G）。読めなければ「選んでいない」。 */
  const readVisionTarget = () => {
    try {
      const get = /** @type {any} */ (settings).getDiscordVisionTarget;
      return typeof get === "function" ? normalizeDiscordVisionTarget(get.call(settings)) : null;
    } catch {
      return null;
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

  // ── 体験の分と接続の分（Discord モード Domain I・discord-mode.md §13.2）────────────────────────────
  //
  //  体験の分 x（openEntrance が成り立ってから closeEntrance まで）: client（ログイン）・guild・部品（voice・OpusScript・discord）・
  //    botId・耳の束（体験の間 1 つ・抜けても畳まない）・耳の番号（seq）・client の VoiceStateUpdate の購読（x.offs）・数え（counters）・
  //    今の接続の分（x.link・どの VC にもいなければ null）・抜けたときに差し口に残した出口（x.heldOutlet）。
  //  接続の分 c（VC 1 つにつき 1 つ）: VC の名前と id・voice connection・接続のイベント・receiver・speaking の購読（c.offs）・
  //    人ごとの購読 / デコーダ / 耳（c.people）・出口（c.outlet）・つなぎ直しを見る猶予のタイマ。
  //  抜ける = 接続の分を畳む（人の耳を束から drop・出口を畳む・connection を destroy）。移る = 抜ける + 入る（destroy して入り直す）。

  /** 空いている一番小さい席（whisper の口の番号をずらすため）。今の接続の分の人から数える。 @param {any} c */
  const freeSlot = (c) => {
    const used = new Set([...c.people.values()].map((p) => p.slot));
    let slot = 0;
    while (used.has(slot)) slot += 1;
    return slot;
  };

  /** @param {any} x @param {any} c */
  const linkLive = (x, c) => !x.closed && !c.closed && x.link === c;

  /**
   * その人の耳（無ければ作る）。耳が起きなかった人は、この接続の間は聞かない（null）。
   * @param {any} x @param {any} c @param {string} userId
   */
  const ensurePerson = (x, c, userId) => {
    const existing = c.people.get(userId);
    if (existing) return existing.failed ? null : existing;
    if (!linkLive(x, c) || !x.ears || x.ears.isDisposed()) return null;
    x.seq += 1;
    const person = {
      userId,
      key: `discord-${x.seq}`,
      slot: freeSlot(c),
      /** @type {string | null} */ name: null,
      source: createSpeakerAudioSource(),
      /** @type {any} */ decoder: null,
      /** @type {any} */ ear: null,
      failed: false,
      gone: false
    };
    try {
      person.decoder = createOpusDecoder16k(x.OpusScript);
    } catch {
      person.failed = true;
      c.people.set(userId, person);
      say("speaker decoder failed");
      return null;
    }
    c.people.set(userId, person);
    void fetchName(x, person);
    /** @type {any} */
    let ear;
    try {
      ear = x.venue.createEar({
        earPlan: x.plan.earPlan,
        ears: x.ears,
        key: person.key,
        captureFactory: person.source.captureFactory,
        transcriptBuffer: speakerTranscriptMouth(x.venue.transcriptBuffer, person),
        segmenter: { minSpeechMs },
        whisperPortOffset: person.slot
      });
      x.ears.add(person.key, ear);
    } catch {
      failPerson(x, c, person, null);
      return null;
    }
    person.ear = ear;
    Promise.resolve()
      .then(() => ear.start())
      .then(
        () => {
          if (!linkLive(x, c) || person.gone) return;
          try {
            x.venue.earStarted?.(x.plan.earPlan.engine);
          } catch {
            // best-effort
          }
          say(`speaker ear started (speakers ${countLive(c)})`);
        },
        () => {
          if (!linkLive(x, c) || person.gone) return;
          failPerson(x, c, person, DISCORD_REASONS.ear);
        }
      );
    return person;
  };

  /** @param {any} c */
  const countLive = (c) => [...c.people.values()].filter((p) => !p.failed && !p.gone).length;

  /**
   * 耳が起きなかった人（この接続の間は聞かない）。耳は耳の側が自分を畳む約束なので、束から外して念のため畳む。
   * @param {any} x @param {any} c @param {any} person @param {string | null} reason
   */
  const failPerson = (x, c, person, reason) => {
    person.failed = true;
    releasePerson(c, person);
    try {
      void x.ears?.drop(person.key);
    } catch {
      // best-effort
    }
    if (reason) {
      try {
        x.venue.earFailed?.(x.plan.earPlan.engine, reason);
      } catch {
        // best-effort
      }
    }
    say("speaker ear failed");
  };

  /** 購読・デコーダ・音の入口を畳む（耳そのものは束の側）。 @param {any} c @param {any} person */
  const releasePerson = (c, person) => {
    try {
      c.receiver?.subscriptions?.get(person.userId)?.destroy?.();
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

  /**
   * 人を 1 人外す（購読・デコーダ・音の入口を畳み、耳を束から drop）。
   * @param {any} x @param {any} c @param {any} person
   */
  const dropPerson = async (x, c, person) => {
    person.gone = true;
    c.people.delete(person.userId);
    releasePerson(c, person);
    if (person.failed) return;
    try {
      await x.ears?.drop(person.key);
    } catch {
      // best-effort
    }
  };

  /** 名前は 1 人 1 回だけ取る（特権 Intent なしで取れる・受信の試し）。取れなければ名前なし。 @param {any} x @param {any} person */
  const fetchName = async (x, person) => {
    try {
      const member = await x.guild.members.fetch(person.userId);
      const name = member && typeof member.displayName === "string" ? member.displayName.trim() : "";
      if (name.length > 0) person.name = name;
    } catch {
      // 名前が取れなくても聞く（行は名前なしの you）。
    }
  };

  /**
   * 人が話し始めた（receiver.speaking の start）: その人を購読し、デコードして耳へ流す。
   * @param {any} x @param {any} c @param {string} userId
   */
  const handleSpeakingStart = (x, c, userId) => {
    if (!linkLive(x, c) || typeof userId !== "string" || userId === x.botId) return;
    const receiver = c.receiver;
    // 同じ人の購読が続いている間（黙って閉じる前）は、同じ購読のまま。
    if (receiver.subscriptions.has(userId)) return;
    const person = ensurePerson(x, c, userId);
    if (!person) return;
    /** @type {any} */
    let stream;
    try {
      stream = receiver.subscribe(userId, { end: { behavior: x.voice.EndBehaviorType.AfterSilence, duration: silenceEndMs } });
    } catch {
      x.counters.subscribeErrors += 1;
      return;
    }
    x.counters.utterances += 1;
    stream.on("data", (/** @type {Buffer} */ packet) => {
      if (!linkLive(x, c) || person.gone || person.failed) return;
      x.counters.packets += 1;
      // §6.4 の 1: 3 バイトの無音のフレームはデコードの前に捨てる。
      if (isOpusSilenceFrame(packet)) {
        x.counters.silenceFrames += 1;
        return;
      }
      try {
        person.source.push(toPcmBuffer(person.decoder.decode(packet)));
      } catch {
        x.counters.decodeErrors += 1;
      }
    });
    stream.on("error", () => {
      x.counters.streamErrors += 1;
    });
    // 購読の終わり（黙った）: 耳の区切りが閉じるよう短い無音を足す（Discord は黙っている間は音を送らない）。
    stream.once("close", () => {
      if (!linkLive(x, c) || person.gone || person.failed) return;
      person.source.push(silencePcm(tailSilenceMs));
    });
  };

  // ── 出来事の合図（Domain J のための口・Domain I）─────────────────────────────────
  //
  //  体験から場（server）へ VC の出来事を知らせる（場の口 vcEvent）。中身は種類と VC の名前・人の名前だけ（Discord の id は渡さない）。
  //  場はここから `control` の記録を書き、Domain J が会話の正本の出来事の行にする（I では正本に行を足さない）。
  //   - "vc-join"（入った・via: "open" = 体験を開いた / "panel" = API）・"vc-leave"（自分で抜けた）・"vc-move"（自分で移った）
  //   - "vc-moved"（Discord の画面で動かされた・追った）・"vc-kicked"（外から切られた = 4014 / Bot 自身が VC の外へ）
  //   - "vc-disconnect"（切れた・猶予のあいだ戻らなかった）・"vc-reconnect"（切れたのがつながり直した）
  //   - "person-join" / "person-leave"（今いる VC の人の入ってきた・出ていった。Bot 自身とほかの Bot は除く）
  //   - "vc-people"（Discord モード Domain K: 入った・移った・動かされた時点でもういる人。`names`〔名前の分かった人〕・`others`
  //     〔名前の分からない人の数〕。Bot 自身とほかの Bot は除く。誰もいなければ合図しない）

  /**
   * 体験を畳んだあと（x.closed）に遅れて終わった VC 操作・届いた知らせは合図しない（Domain J: 閉じたあとの control の 1 行・
   * 出来事の行を作らない・次の場に混ぜない。場の側も開いている間だけ正本に足す）。
   * @param {any} x @param {Record<string, unknown>} event
   */
  const emitVc = (x, event) => {
    if (!x || x.closed) return;
    try {
      x.venue.vcEvent?.(Object.freeze({ ...event }));
    } catch {
      // 知らせの失敗で入口を止めない。
    }
  };

  /** VC の名前（文字列でなければ null・長すぎる名前は切る）。 @param {any} channel */
  const channelNameOf = (channel) => {
    const raw = channel && typeof channel.name === "string" ? channel.name.trim() : "";
    return raw.length > 0 ? [...raw].slice(0, DISCORD_CHANNEL_NAME_MAX_CHARS).join("") : null;
  };

  /** 人の名前（VoiceState の member の displayName・無ければ null）。 @param {any} state */
  const memberNameOf = (state) => {
    const raw = state?.member && typeof state.member.displayName === "string" ? state.member.displayName.trim() : "";
    return raw.length > 0 ? raw : null;
  };

  /** その VoiceState の人が Bot か（分からなければ false）。 @param {any} state */
  const memberIsBot = (state) => state?.member?.user?.bot === true;

  /** もういる人の行で名前を引く人数の上限（これを超えた人は名前を引かずに数だけ・行の側も「ほか N 人」に畳む）。 */
  const PRESENT_NAME_LOOKUP_MAX = 20;

  /**
   * 入った・移った・動かされた時点で今いる VC にもういる人を、出来事の 1 行の合図（vc-people）にする（Discord モード Domain K・
   * J の持ち越し 2）。人は guild の voiceStates から（Bot 自身を除く）。名前は member の displayName（手元に無ければ members.fetch。
   * 取れなければ名前なしの 1 人に数える）。ほかの Bot は除く。誰もいなければ合図しない。名前は合図の中だけ（ログには書かない）。
   * 判定・発火には回らない（場の側が出来事の行として正本に足すだけ）。待たない（失敗しても入口の操作を止めない）。
   * @param {any} x @param {any} c
   */
  const announcePresent = async (x, c) => {
    try {
      if (!c || !linkLive(x, c)) return;
      const channelId = c.channelId;
      const states = [...(x.guild?.voiceStates?.cache?.values?.() ?? [])].filter(
        (vs) => vs && vs.channelId === channelId && typeof vs.id === "string" && vs.id !== x.botId
      );
      if (states.length === 0) return;
      const looked = await Promise.all(
        states.slice(0, PRESENT_NAME_LOOKUP_MAX).map(async (vs) => {
          /** @type {any} */
          let member = vs.member ?? null;
          if (!member) {
            try {
              member = await x.guild.members.fetch(vs.id);
            } catch {
              member = null;
            }
          }
          if (member?.user?.bot === true) return { bot: true, name: null };
          const raw = member && typeof member.displayName === "string" ? member.displayName.trim() : "";
          return { bot: false, name: raw.length > 0 ? raw : null };
        })
      );
      if (!linkLive(x, c) || c.channelId !== channelId) return;
      /** @type {string[]} */
      const names = [];
      let others = Math.max(0, states.length - PRESENT_NAME_LOOKUP_MAX);
      for (const p of looked) {
        if (p.bot) continue;
        if (p.name) names.push(p.name);
        else others += 1;
      }
      if (names.length === 0 && others === 0) return;
      emitVc(x, { kind: "vc-people", channelName: c.channelName, names: Object.freeze(names), others });
    } catch {
      // best-effort（もういる人の行の失敗で入口を止めない）。
    }
  };

  /**
   * VC への入退室（client の VoiceStateUpdate）。**今いる VC**（x.link の channelId）を見る:
   *  - Bot 自身: 今いる VC から別の VC へ = Discord の画面で動かされた（動いた先を今の VC として追う）。今いる VC から外へ = 外から
   *    切られた（VC の外で待っている）。
   *  - ほかの人: 今いる VC から抜けた人の耳を束から外す（正本は続く・場は閉じない）。全員が抜けても Bot は抜けない。
   * @param {any} x @param {any} oldState @param {any} newState
   */
  const handleVoiceState = (x, oldState, newState) => {
    if (x.closed) return;
    const guildId = newState?.guild?.id ?? oldState?.guild?.id ?? null;
    if (guildId !== x.plan.guildId) return;
    const userId = newState?.id ?? oldState?.id;
    if (typeof userId !== "string") return;
    const c = x.link;
    if (!c || c.closed || !c.readyOnce) return;
    const from = oldState?.channelId ?? null;
    const to = newState?.channelId ?? null;
    if (userId === x.botId) {
      handleBotVoiceState(x, c, from, to, newState);
      return;
    }
    const was = from === c.channelId;
    const now = to === c.channelId;
    if (was === now) return;
    const bot = memberIsBot(newState) || memberIsBot(oldState);
    if (now) {
      if (!bot) emitVc(x, { kind: "person-join", channelName: c.channelName, name: memberNameOf(newState) });
      return;
    }
    const person = c.people.get(userId);
    if (!bot) emitVc(x, { kind: "person-leave", channelName: c.channelName, name: memberNameOf(oldState) ?? person?.name ?? null });
    if (!person) return;
    void dropPerson(x, c, person);
    say(`speaker left (speakers ${countLive(c)})`);
  };

  /**
   * Bot 自身の VoiceStateUpdate。今いる VC から動いたときだけ見る（自分で抜けた・移ったあとの遅れて届く知らせは、もう今の VC では
   * ないので見ない）。
   * @param {any} x @param {any} c @param {string | null} from @param {string | null} to @param {any} newState
   */
  const handleBotVoiceState = (x, c, from, to, newState) => {
    if (from !== c.channelId || to === c.channelId) return;
    if (to == null) {
      void goOutside(x, c, "voice-state");
      return;
    }
    // Discord の画面で動かされた: ライブラリは同じ接続のまま動いた先へつなぎ直す（joinConfig.channelId を書き換える）。
    // 動いた先を今の VC として追う（名前・人の出入りを見る先を替える）。前の VC の人の耳は drop。出口と receiver は同じ接続のまま。
    const fromName = c.channelName;
    c.channelId = to;
    c.channelName = channelNameOf(newState?.channel) ?? null;
    const people = [...c.people.values()];
    for (const person of people) void dropPerson(x, c, person);
    say(`moved by someone (dropped speakers ${people.length})`);
    const notify = () => {
      emitVc(x, { kind: "vc-moved", fromChannelName: fromName, channelName: c.channelName });
      void announcePresent(x, c);
    };
    if (c.channelName != null) {
      notifyChanged(x);
      notify();
      return;
    }
    // 名前が手元に無ければ取ってから知らせる（取れなくても知らせる）。
    const movedTo = to;
    void (async () => {
      try {
        const channel = await x.guild.channels.fetch(movedTo);
        if (linkLive(x, c) && c.channelId === movedTo) c.channelName = channelNameOf(channel);
      } catch {
        // 名前なし
      }
      if (!linkLive(x, c)) return;
      notifyChanged(x);
      notify();
    })();
  };

  /** @param {any} x */
  const notifyChanged = (x) => {
    try {
      x.venue?.changed?.();
    } catch {
      // best-effort
    }
  };

  /** @param {any} c */
  const clearGrace = (c) => {
    if (c.graceTimer != null) {
      try {
        clearTimeoutImpl(c.graceTimer);
      } catch {
        // best-effort
      }
      c.graceTimer = null;
    }
  };

  /**
   * 切れたあとの猶予（disconnectGraceMs）。猶予のあいだに戻れば何もしない（動かされたときのつなぎ直し・短い途切れ）。戻らなければ:
   * 閉じのコード 4014（キック・チャンネルの削除）なら VC の外で待っている、それ以外は「切れた」の合図（場は閉じない・ライブラリの
   * つなぎ直しに任せる）。
   * @param {any} x @param {any} c
   */
  const startGrace = (x, c) => {
    clearGrace(c);
    const timer = setTimeoutImpl(() => {
      c.graceTimer = null;
      if (!linkLive(x, c)) return;
      const st = x.voice.VoiceConnectionStatus;
      const state = c.connection?.state ?? {};
      if (state.status === st.Ready) return;
      if (state.status === st.Disconnected && state.closeCode === DISCORD_CLOSE_CODE_DO_NOT_RECONNECT) {
        void goOutside(x, c, "4014");
        return;
      }
      if (!c.disconnectNoticed) {
        c.disconnectNoticed = true;
        emitVc(x, { kind: "vc-disconnect", channelName: c.channelName });
      }
    }, disconnectGraceMs);
    /** @type {any} */ (timer)?.unref?.();
    c.graceTimer = timer;
  };

  /**
   * 接続の状態（ライブラリのつなぎ直しに任せる・場は閉じない）。最初に Ready になるまでは「入っている途中」のまま。
   * Ready 以外はみな「切れた」（今のまま）。閉じのコード 4014 のときは猶予のあと VC の外で待っている（startGrace）。
   * @param {any} x @param {any} c @param {any} next  新しい状態（status・closeCode）。
   */
  const handleConnectionStatus = (x, c, next) => {
    if (!linkLive(x, c) || !c.readyOnce) return;
    const st = x.voice.VoiceConnectionStatus;
    const status = next?.status;
    if (status === st.Ready) {
      clearGrace(c);
      if (c.disconnectNoticed) {
        c.disconnectNoticed = false;
        emitVc(x, { kind: "vc-reconnect", channelName: c.channelName });
      }
      if (connection !== "joined") say("connection joined");
      setConnection("joined", x.venue);
      return;
    }
    if (status === st.Disconnected && next?.closeCode === DISCORD_CLOSE_CODE_DO_NOT_RECONNECT) {
      // 4014: ライブラリはつなぎ直さない。動かされたときも一度これが来うる（動いた先の声のサーバーの知らせで Connecting に進む）
      // ので、猶予を見てから外へ落とす。猶予は 4014 が来た時から数え直す（猶予の終わりに今の状態を見るので、その間に
      // Signalling / Connecting / Ready へ進めば外へは落とさない）。
      startGrace(x, c);
    } else if (c.graceTimer == null) {
      // 4014 でない切れ・つなぎ直しの途中。猶予が走っていなければ張る（戻らなければ「切れた」の合図を 1 回出す）。
      startGrace(x, c);
    }
    if (connection !== "disconnected") say("connection disconnected");
    setConnection("disconnected", x.venue);
  };

  /**
   * 接続の分を畳む（冪等）: 接続の購読を先に外す（自分で抜けたときに「切れた」と出さない）→ 鳴っている返事を止める → 人の耳を
   * 束から drop → 出口を畳む（hold なら差し口に「VC にいない」の口を残す = 手元のスピーカーに戻さない）→ connection を destroy。
   * 耳の束は畳まない（体験の間 1 つ）。client はログアウトしない。
   * @param {any} x @param {any} c @param {{ hold: boolean }} how
   */
  const foldLink = async (x, c, how) => {
    if (!c || c.closed) return;
    c.closed = true;
    // 畳み始めた時点で「今の VC」ではない（畳んでいる間に届く知らせ・操作は、この接続の分を今の VC とみなさない）。
    if (x.link === c) x.link = null;
    clearGrace(c);
    for (const off of c.offs.splice(0)) {
      try {
        off();
      } catch {
        // best-effort
      }
    }
    if (how.hold) {
      // 抜けた瞬間に鳴っている途中の返事は、割り込みと同じ切り方で止める（どこまで声に出たかを残す・場の口 hushVoice）。
      try {
        x.venue.hushVoice?.();
      } catch {
        // best-effort
      }
    }
    const people = [...c.people.values()];
    c.people.clear();
    await Promise.all(people.map((person) => {
      person.gone = true;
      releasePerson(c, person);
      if (person.failed || !x.ears) return Promise.resolve();
      return Promise.resolve()
        .then(() => x.ears.drop(person.key))
        .catch(() => {});
    }));
    if (c.outlet) {
      const outlet = c.outlet;
      c.outlet = null;
      try {
        await (how.hold ? outlet.dispose?.({ hold: true }) : outlet.dispose?.());
      } catch {
        // best-effort
      }
      if (how.hold) x.heldOutlet = outlet;
    }
    if (c.connection) {
      try {
        if (c.connection.state?.status !== x.voice?.VoiceConnectionStatus?.Destroyed) c.connection.destroy();
      } catch {
        // best-effort（既に壊れていても畳む）。
      }
    }
  };

  /**
   * どの VC にもいない状態にする（接続の分は畳んだあと）: 接続の状態「VC の外で待っている」・耳は「聞いていない」（文字起こしの方式・
   * 稼働時間は残す・場の口 pauseEars）。
   * @param {any} x
   */
  const settleOutside = (x) => {
    if (x.closed) return;
    try {
      x.venue.pauseEars?.();
    } catch {
      // best-effort
    }
    setConnection("outside", x.venue);
  };

  /**
   * 外から切られた（4014 / Bot 自身が VC の外へ）: 接続の分を畳み、VC の外で待っている（体験は閉じない）。
   * @param {any} x @param {any} c @param {string} why  ログの種類だけ（"4014" | "voice-state"）。
   */
  const goOutside = async (x, c, why) => {
    if (!linkLive(x, c)) return;
    const channelName = c.channelName;
    await foldLink(x, c, { hold: true });
    if (x.closed) return;
    if (x.link == null) settleOutside(x);
    say(`outside (${why})`);
    emitVc(x, { kind: "vc-kicked", channelName });
  };

  /** 聞く口を足し、外す口を offs に積む。 @param {Array<() => void>} offs @param {any} target @param {string} event @param {(...args: any[]) => void} fn */
  const listen = (offs, target, event, fn) => {
    target.on(event, fn);
    offs.push(() => target.off?.(event, fn) ?? target.removeListener?.(event, fn));
  };

  /**
   * 入る先のチャンネルを確かめる: **体験の client の guild**（同じサーバー）のボイスチャンネルだけ（ステージ・文字・ほかのサーバーの
   * チャンネルは断る）。
   * @param {any} x @param {unknown} channelId
   * @returns {Promise<{ ok: true; channel: any } | { ok: false; reason: string; code: "shape" | "channel" | "closed" }>}
   */
  const resolveVoiceChannel = async (x, channelId) => {
    if (typeof channelId !== "string" || !PREP_ID_PATTERN.test(channelId)) {
      return { ok: false, reason: DISCORD_VC_REFUSALS.channelId, code: "shape" };
    }
    /** @type {any} */
    let channel = null;
    try {
      channel = await x.guild.channels.fetch(channelId);
    } catch {
      channel = null;
    }
    if (x.closed) return { ok: false, reason: DISCORD_REASONS.closed, code: "closed" };
    const voiceType = x.discord.ChannelType?.GuildVoice;
    const guildOf = channel ? channel.guildId ?? channel.guild?.id ?? null : null;
    if (
      !channel ||
      typeof channel.isVoiceBased !== "function" ||
      !channel.isVoiceBased() ||
      (voiceType !== undefined && channel.type !== voiceType) ||
      (guildOf != null && guildOf !== x.guild.id)
    ) {
      return { ok: false, reason: DISCORD_REASONS.channel, code: "channel" };
    }
    return { ok: true, channel };
  };

  /**
   * VC に入る（接続の分を作る）: joinVoiceChannel → Ready を待つ →（最初だけ）耳の束・client の購読 → speaking の購読 → 出口。
   * 失敗したら作りかけの接続の分を畳み、理由を返す（呼び出し側が状態を決める）。
   * @param {any} x @param {any} channel  resolveVoiceChannel で確かめたチャンネル。
   * @returns {Promise<{ ok: true } | { ok: false; reason: string; code: "join" | "outlet" | "closed" }>}
   */
  const joinLink = async (x, channel) => {
    const voice = x.voice;
    const c = {
      channelId: String(channel.id),
      channelName: channelNameOf(channel),
      /** @type {any} */ connection: null,
      /** @type {any} */ receiver: null,
      /** @type {any} */ outlet: null,
      people: new Map(),
      /** @type {Array<() => void>} */ offs: [],
      readyOnce: false,
      closed: false,
      disconnectNoticed: false,
      /** @type {any} */ graceTimer: null
    };
    x.link = c;
    setConnection("joining", x.venue);
    /** @param {"join" | "outlet" | "closed"} code @param {string} reason */
    const fail = async (code, reason) => {
      await foldLink(x, c, { hold: false });
      return { ok: /** @type {const} */ (false), reason, code };
    };
    try {
      // 1 Bot は 1 サーバーで 1 VC。group はロールの id（同じプロセスの 2 つ目の Bot が 1 つ目の接続を使い回さない・外部 §2.1）。
      c.connection = voice.joinVoiceChannel({
        channelId: c.channelId,
        guildId: x.plan.guildId,
        adapterCreator: x.guild.voiceAdapterCreator,
        selfDeaf: false,
        selfMute: false,
        group: x.plan.groupId
      });
    } catch {
      return fail("join", DISCORD_REASONS.join);
    }
    listen(c.offs, c.connection, "error", () => say("connection error"));
    listen(c.offs, c.connection, "stateChange", (/** @type {any} */ _old, /** @type {any} */ next) => handleConnectionStatus(x, c, next));
    try {
      await voice.entersState(c.connection, voice.VoiceConnectionStatus.Ready, readyTimeoutMs);
    } catch {
      return fail(x.closed || c.closed ? "closed" : "join", x.closed || c.closed ? DISCORD_REASONS.closed : DISCORD_REASONS.join);
    }
    if (!linkLive(x, c)) return fail("closed", DISCORD_REASONS.closed);
    c.readyOnce = true;
    // 耳の束（体験の間 1 つ・人ごとの耳は話し始めたときに束ねる）。
    if (!x.ears) x.ears = x.venue.createEars();
    c.receiver = c.connection.receiver;
    listen(c.offs, c.receiver.speaking, "start", (/** @type {string} */ userId) => handleSpeakingStart(x, c, userId));
    if (!x.voiceStateListening) {
      // client の購読は体験の分（抜けても外さない）。
      x.voiceStateListening = true;
      listen(x.offs, x.client, x.discord.Events.VoiceStateUpdate, (/** @type {any} */ o, /** @type {any} */ n) =>
        handleVoiceState(x, o, n)
      );
    }
    // Discord の出口（Domain E・設計 §7・§5「再生器はロールごと、Discord では Bot の接続ごと」）。deps.outletFactory が
    // 渡されていればそれ、無ければその場のロールの束の voice.openOutlet（cockpit.mjs が Discord 向けの再生器を作ってその
    // ロールの声に差す）。どちらも無ければ出口なし（声は手元の再生器のまま・D のふるまい）。
    const outletFactory = typeof deps.outletFactory === "function" ? deps.outletFactory : roleOutletFactory(x.venue.roles, x.plan.groupId);
    if (outletFactory) {
      try {
        c.outlet = outletFactory({ connection: c.connection, voice, groupId: x.plan.groupId }) ?? null;
        if (c.outlet) say("outlet ready");
      } catch {
        // 出口を作れなければ入らない（VC に入っても声を出せない・手元のスピーカーから出す形に黙って戻さない）。
        c.outlet = null;
        say("outlet failed");
        return fail("outlet", DISCORD_REASONS.outlet);
      }
      // 新しい出口が差し口の「VC にいない」の口を置き換えた。
      x.heldOutlet = null;
    }
    setConnection("joined", x.venue);
    try {
      x.venue.earsListening?.();
    } catch {
      // best-effort
    }
    say("joined");
    return { ok: /** @type {const} */ (true) };
  };

  /**
   * 体験の分を畳む（冪等）: client の購読 → 接続の分 → 差し口に残した出口 → 耳の束 → ログアウト。
   * @param {any} x
   */
  const teardown = async (x) => {
    if (!x || x.closed) return;
    x.closed = true;
    for (const off of x.offs.splice(0)) {
      try {
        off();
      } catch {
        // best-effort
      }
    }
    if (x.link) await foldLink(x, x.link, { hold: false });
    if (x.heldOutlet) {
      // 抜けたときに差し口に残した「VC にいない」の口を外す（場を閉じたら次の配信の場は手元の再生器）。
      const held = x.heldOutlet;
      x.heldOutlet = null;
      try {
        await held.dispose?.();
      } catch {
        // best-effort
      }
    }
    if (x.ears) {
      try {
        await x.ears.dispose();
      } catch {
        // best-effort
      }
    }
    await destroyClient(x.client);
    if (experience === x) experience = null;
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
    // Domain E（D の持ち越し・設計 §5「パスの区切りを含む値は断る」）: role.json の discordBotKeyFile が書いてあって形が合わない
    // なら、既定の鍵で入らずに断る（黙って別の Bot でログインしない）。理由に値は入れない（パスや鍵を含みうる）。
    let keyFileRefused = false;
    try {
      keyFileRefused = typeof role.discordBotKeyFileRefused === "function" && role.discordBotKeyFileRefused() === true;
    } catch {
      keyFileRefused = true;
    }
    if (keyFileRefused) return { ok: false, reason: DISCORD_REASONS.keyFileName };
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
   * 入口を開く: ログイン → サーバーとボイスチャンネル → VC に入る（準備の VC）→ 耳の束。どこかで止まったら自分で畳み、理由を返す
   * （場は開かない）。想定外の例外も投げずに理由にする。
   * @param {any} plan @param {any} venue
   */
  async function openEntrance(plan, venue) {
    if (experience) await teardown(experience);
    if (!plan || !venue || typeof venue.createEars !== "function" || typeof venue.createEar !== "function") {
      try {
        venue?.stopEars?.();
      } catch {
        // best-effort
      }
      return { ok: false, reason: DISCORD_REASONS.venue };
    }
    /** @type {any} */
    const x = {
      // 鍵は持ち回らない（ログインに 1 回使うだけ・plan の外に写さない）。channelId は準備の VC（開くときに入る先・書き換えない）。
      plan: Object.freeze({ guildId: plan.guildId, channelId: plan.channelId, groupId: plan.groupId, earPlan: plan.earPlan }),
      venue,
      client: null,
      guild: null,
      ears: null,
      voice: null,
      discord: null,
      OpusScript: null,
      botId: null,
      closed: false,
      seq: 0,
      /** @type {any} */ link: null,
      /** @type {any} */ heldOutlet: null,
      /** @type {Promise<any> | null} */ op: null,
      voiceStateListening: false,
      /** @type {Array<() => void>} */ offs: [],
      counters: { utterances: 0, packets: 0, silenceFrames: 0, decodeErrors: 0, streamErrors: 0, subscribeErrors: 0 }
    };
    experience = x;
    setConnection("joining", venue);
    /** @param {string} reason */
    const refuse = async (reason) => {
      await teardown(x);
      try {
        venue.stopEars?.();
      } catch {
        // best-effort
      }
      if (experience === null || experience === x) setConnection(null, venue);
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
      if (x.closed) return refuse(DISCORD_REASONS.closed);
      x.voice = libs.voice;
      x.discord = libs.discord;
      x.OpusScript = libs.OpusScript;
      say("logging in");
      try {
        x.client = await loginClient(libs.discord, plan.token);
      } catch {
        return refuse(DISCORD_REASONS.login);
      }
      if (x.closed) {
        // Domain E（D の持ち越し）: ログインの途中で閉じられた（closeEntrance・サーバを閉じた）。そのときの teardown はまだ client を
        // 持っていなかったので、ログインした Bot をここでログアウトさせる（refuse の teardown は閉じた後なので何もしない）。
        await destroyClient(x.client);
        return refuse(DISCORD_REASONS.closed);
      }
      x.botId = x.client.user?.id ?? null;
      try {
        x.guild = await x.client.guilds.fetch(plan.guildId);
      } catch {
        x.guild = null;
      }
      if (!x.guild) return refuse(DISCORD_REASONS.guild);
      const resolved = await resolveVoiceChannel(x, plan.channelId);
      if (!resolved.ok) return refuse(resolved.code === "closed" ? DISCORD_REASONS.closed : DISCORD_REASONS.channel);
      if (x.closed) return refuse(DISCORD_REASONS.closed);
      const joined = await joinLink(x, resolved.channel);
      if (!joined.ok) return refuse(joined.reason);
      emitVc(x, { kind: "vc-join", via: "open", channelName: x.link?.channelName ?? null });
      void announcePresent(x, x.link);
      return { ok: true, ears: x.ears };
    } catch {
      return refuse(DISCORD_REASONS.unexpectedOpen);
    }
  }

  /**
   * 入口を閉じる（場が正本を手放し耳の束を畳んだあと・サーバを閉じるときも）。冪等（開いていなくても・二重でも・VC にいなくても）。
   * @param {{ hadEars?: boolean; shutdown?: boolean }} [_info] @param {any} [control]
   */
  async function closeEntrance(_info, control) {
    const x = experience;
    if (x) {
      const c = x.counters;
      await teardown(x);
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

  // ── 入る / 抜ける / 移る（Discord モード Domain I・discord-mode.md §13.2・§13.3）──────────────────────
  //
  //  場（server）の API（POST /api/discord/vc）から呼ばれる。体験が開いていなければ断る。同時に 2 つは受けない（途中なら断る）。
  //  入る先は API で渡した VC（準備の discordChannelId は書き換えない）。どの結果も `{ ok:true }` か
  //  `{ ok:false, code, reason }`（code: "not-open" | "busy" | "in-vc" | "not-in-vc" | "same" | "shape" | "channel" | "join" | "outlet" | "closed"）。

  /**
   * @template T
   * @param {(x: any) => Promise<T>} run
   * @returns {Promise<T | { ok: false; code: string; reason: string }>}
   */
  const runOp = async (run) => {
    const x = experience;
    if (!x || x.closed || !x.guild) return { ok: false, code: "not-open", reason: DISCORD_VC_REFUSALS.notOpen };
    if (x.op) return { ok: false, code: "busy", reason: DISCORD_VC_REFUSALS.busy };
    const p = (async () => {
      try {
        return await run(x);
      } catch {
        return { ok: /** @type {const} */ (false), code: "join", reason: DISCORD_REASONS.unexpectedOpen };
      }
    })();
    x.op = p;
    try {
      return await p;
    } finally {
      if (x.op === p) x.op = null;
    }
  };

  /** @param {any} x @param {any} r */
  const afterFailedJoin = (x, r) => {
    if (!x.closed && x.link == null) settleOutside(x);
    say(`could not join (${r.reason})`);
  };

  /**
   * どの VC にもいない間に、同じサーバーの VC に入る。
   * @param {unknown} channelId
   */
  function joinVoice(channelId) {
    return runOp(async (x) => {
      if (x.link) return { ok: false, code: "in-vc", reason: DISCORD_VC_REFUSALS.inVc };
      const resolved = await resolveVoiceChannel(x, channelId);
      if (!resolved.ok) return resolved;
      const r = await joinLink(x, resolved.channel);
      if (!r.ok) {
        afterFailedJoin(x, r);
        return r;
      }
      emitVc(x, { kind: "vc-join", via: "panel", channelName: x.link?.channelName ?? null });
      void announcePresent(x, x.link);
      return { ok: true };
    });
  }

  /** 今いる VC から抜ける（体験は閉じない・頭と会話は残る）。 */
  function leaveVoice() {
    return runOp(async (x) => {
      const c = x.link;
      if (!c) return { ok: false, code: "not-in-vc", reason: DISCORD_VC_REFUSALS.notInVc };
      const channelName = c.channelName;
      await foldLink(x, c, { hold: true });
      settleOutside(x);
      say("left voice channel");
      emitVc(x, { kind: "vc-leave", channelName });
      return { ok: true };
    });
  }

  /**
   * 同じサーバーの別の VC へ移る（抜ける + 入る・destroy して入り直す）。先に移る先を確かめる（使えない VC なら抜けない）。
   * @param {unknown} channelId
   */
  function moveVoice(channelId) {
    return runOp(async (x) => {
      const c = x.link;
      if (!c) return { ok: false, code: "not-in-vc", reason: DISCORD_VC_REFUSALS.notInVc };
      if (channelId === c.channelId) return { ok: false, code: "same", reason: DISCORD_VC_REFUSALS.same };
      const resolved = await resolveVoiceChannel(x, channelId);
      if (!resolved.ok) return resolved;
      if (x.link !== c) return { ok: false, code: "not-in-vc", reason: DISCORD_VC_REFUSALS.notInVc };
      const fromName = c.channelName;
      await foldLink(x, c, { hold: true });
      if (x.closed) return { ok: false, code: "closed", reason: DISCORD_REASONS.closed };
      // 移る間は聞いていない（入れれば聞いているに戻る）。
      try {
        x.venue.pauseEars?.();
      } catch {
        // best-effort
      }
      const r = await joinLink(x, resolved.channel);
      if (!r.ok) {
        afterFailedJoin(x, r);
        // 前の VC からは抜けた（入れなかった）。
        emitVc(x, { kind: "vc-leave", channelName: fromName });
        return r;
      }
      emitVc(x, { kind: "vc-move", fromChannelName: fromName, channelName: x.link?.channelName ?? null });
      void announcePresent(x, x.link);
      return { ok: true };
    });
  }

  /**
   * 体験の client の guild から、同じサーバーのボイスチャンネルの一覧（名前・人数〔Bot 自身を除く voiceStates の数〕・今いるか）を
   * 取る（Domain K のための口・2 本目のログインはしない）。id は API の応答にだけ載せる（snapshot・ログには載せない）。
   * Domain K: サーバーの名前（guildName・パネルの「サーバー」の欄・取れなければ null）も返す。
   * @returns {Promise<{ ok: true; channels: Array<{ id: string; name: string; people: number; current: boolean }>; guildName: string | null } | { ok: false; code: string; reason: string }>}
   */
  async function listVoiceChannels() {
    const x = experience;
    if (!x || x.closed || !x.guild) return { ok: false, code: "not-open", reason: DISCORD_VC_REFUSALS.notOpen };
    /** @type {any} */
    let all;
    try {
      all = await x.guild.channels.fetch();
    } catch {
      return { ok: false, code: "catalog", reason: DISCORD_REASONS.catalog };
    }
    const voiceType = x.discord.ChannelType?.GuildVoice;
    /** @type {Map<string, number>} */
    const counts = new Map();
    try {
      for (const vs of x.guild.voiceStates?.cache?.values?.() ?? []) {
        const id = vs?.channelId;
        if (typeof id !== "string" || vs.id === x.botId) continue;
        counts.set(id, (counts.get(id) ?? 0) + 1);
      }
    } catch {
      // 数えられなければ 0 人。
    }
    const current = x.link && !x.link.closed ? x.link.channelId : null;
    const channels = [...(all?.values?.() ?? [])]
      .filter((ch) => ch && typeof ch.isVoiceBased === "function" && ch.isVoiceBased() && (voiceType === undefined || ch.type === voiceType))
      .sort((a, b) => (a.rawPosition ?? a.position ?? 0) - (b.rawPosition ?? b.position ?? 0))
      .map((ch) => ({ id: String(ch.id), name: String(ch.name ?? ""), people: counts.get(String(ch.id)) ?? 0, current: String(ch.id) === current }));
    const guildName = typeof x.guild.name === "string" && x.guild.name.trim().length > 0 ? x.guild.name.trim() : null;
    return { ok: true, channels, guildName };
  }

  /** @param {string} phase */
  function busyMessage(phase) {
    return phase === "opening"
      ? "VC に入っている途中（少し待ってからもう一度）"
      : phase === "closing"
        ? "通話を終えている途中（記録中・少し待ってからもう一度）"
        : "Discord の通話の途中（下の帯の「通話を終える」のあとで始め直す）";
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
      // Domain G（E の追認 (1)）: ロールの鍵のファイル名の形が合わなければ、鍵を読まずログインせずに断る（入口と同じ文面・値は出さない）。
      if (currentKeyFileRefused()) {
        say("catalog: key file name refused");
        return { ok: /** @type {const} */ (false), reason: DISCORD_REASONS.keyFileName };
      }
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

  /** Discord の場の見る窓（目）の置き場（Domain G・配信の見る窓とは別）。 */
  const visionTarget = Object.freeze({
    get: () => readVisionTarget(),
    /**
     * @param {unknown} value  窓の名前（null / "" は消す）。
     * @returns {{ ok: true; title: string | null } | { ok: false; reason: string }}
     */
    set(value) {
      const checked = checkDiscordVisionTarget(value);
      if (!checked.ok) return checked;
      const put = /** @type {any} */ (settings).setDiscordVisionTarget;
      if (typeof put !== "function") return { ok: false, reason: "見る窓を保存できない" };
      put.call(settings, checked.title);
      return { ok: true, title: readVisionTarget() };
    }
  });

  return Object.freeze({
    prepareEntrance,
    abortEntrance,
    openEntrance,
    closeEntrance,
    busyMessage,
    unexpectedErrorMessage,
    /** snapshot の `stream.connection`（"joining" | "joined" | "disconnected" | "outside" | null）。 */
    connectionStatus: () => connection,
    /** 今いる（入っている途中・つなぎ直している途中を含む）VC の名前（Domain I・snapshot の stream.vcName・どこにもいなければ null）。 */
    voiceChannelName: () =>
      experience && !experience.closed && experience.link && !experience.link.closed ? experience.link.channelName ?? null : null,
    /**
     * 入る / 抜ける / 移る と、同じサーバーの VC の一覧（Domain I・POST / GET /api/discord/vc）。結果は `{ ok:true }` か
     * `{ ok:false, code, reason }`。一覧は `{ ok:true, channels: [{ id, name, people, current }], guildName }`（guildName は Domain K）。
     */
    vc: Object.freeze({ join: joinVoice, leave: leaveVoice, move: moveVoice, list: listVoiceChannels }),
    catalog,
    prep,
    visionTarget,
    /** 場の目を起こすか（Domain G・設計 §4.3 の 7: 見る窓を選んでいなければ Discord の場では目を起こさない）。 */
    eyesWanted: () => readVisionTarget() != null,
    /** Discord の出口（Domain E）が今の接続を引く口（VC に入っていなければ null）。 */
    voiceConnection: () =>
      experience && !experience.closed && experience.link && !experience.link.closed && experience.link.readyOnce
        ? experience.link.connection
        : null,
    // 言葉と判定の組（Discord モード Domain F）: 通話の語の組・①に足す Discord の教え・Discord の判定の組。
    wording: CALL_WORDING,
    teaching: venueTeachingName("discord"),
    judgeSet: Object.freeze({ speakNow: DISCORD_SPEAK_NOW_QUESTIONS, recallAvoid: DISCORD_RECALL_AVOID_QUESTIONS })
  });
}
