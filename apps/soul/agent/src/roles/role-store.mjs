// @ts-check
/**
 * ロールの置き場の読み書き(配信の組み直し Domain A・新設)— apps/soul/agent。
 *
 * 上位文書:
 *  - [stream-restructure.md](../../../../../discussion/ai-cohost/architecture/stream-restructure.md) — §2 ロール(§2.1 置き場と形)。
 *  - [stream-restructure-wave-plan.md](../../../../../discussion/ai-cohost/implementation/orchestration/stream-restructure-wave-plan.md) — §1 Domain A。
 *
 * ── 置き場と形 ───────────────────────────────────────────────────────────
 *  `apps/soul/agent/roles/<role-id>/`(git に入れない・apps/soul/agent/.gitignore)。
 *   - `role.json`: 名前・名前の手がかり・動かすモデル(頭の id)・声・口数・話し始め・体。
 *   - `instructions.md`: 性格の指示(今までの会話指示)。無い・空なら既定の本文
 *     (fire-orchestrator.mjs の DEFAULT_CONVERSATION_INSTRUCTION_BODY)。
 *  role-id は英小文字(`chappy`・`cody`・model-identity.mjs の ROLE_ID_PATTERN)。見せる名前は role.json の中。
 *
 *  role.json の形(version 1):
 *   {
 *     "version": 1,
 *     "name": { "canonical": "チャッピー", "display": "チャッピー", "latin": "Chappy" },
 *     "nameHints": { "whisperPrompt": "…", "voiceCallVariants": […], "commentCallVariants": […], "hotwords": […] | null },
 *     "brain": "codex-61-sol",
 *     "voice": { "engine": "aivis" | "elevenlabs", "aivisSpeaker": 888753760 | null, "elevenLabsVoiceId": "…" | null },
 *     "verbosity": "quiet" | "normal" | "chatty",
 *     "speakStartMode": "classic" | "speak-now",
 *     "body": true | false
 *   }
 *  `aivisSpeaker` / `elevenLabsVoiceId` の null は「コードの既定」(tts-client の DEFAULT_SPEAKER_ID・ElevenLabs の
 *  既定の声)。`hotwords` の null は「設定ファイル(localSttHotwords)か既定に任せる」。
 *
 * ── 読み方 ───────────────────────────────────────────────────────────────
 *  読むときは項目ごとに確かめ、型の違う・範囲外の値はその項目だけ既定にする(1 つの値の書き損じでロール全体を
 *  捨てない)。role.json が無い・JSON として読めない・オブジェクトでないときだけ、ロールとして読めない。
 *  返すロールは凍らせる(呼び出し側が書き換えて置き場とずれないように)。
 *
 * ── 書き方 ───────────────────────────────────────────────────────────────
 *  書くときも同じ確かめを通してから書く(壊れた値を置き場に残さない)。書き込みの失敗は投げる(呼び出し側が
 *  握るか決める)。体(body)は持ち物として読み書きできるだけで、挙動にはまだつながない(Domain C)。
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { BRAIN_IDS } from "../mind/brains.mjs";
import { DEFAULT_CONVERSATION_INSTRUCTION_BODY } from "../mind/fire-orchestrator.mjs";
import { isRoleId, ROLE_ID_PATTERN } from "../mind/model-identity.mjs";

export { isRoleId, ROLE_ID_PATTERN };

const here = dirname(fileURLToPath(import.meta.url));

/** 既定のロールの置き場(`apps/soul/agent/roles/`・プロジェクトの .gitignore 対象)。 */
export const DEFAULT_ROLES_DIR = join(here, "..", "..", "roles");

/** ロールのフォルダの中のファイル名。 */
export const ROLE_FILE_NAME = "role.json";
export const ROLE_INSTRUCTIONS_FILE_NAME = "instructions.md";

/** role.json の形の版。 */
export const ROLE_FILE_VERSION = 1;

/** 口数・話し始め・声の方式の語彙(操縦席の既存の語彙と同じ)。 */
export const ROLE_VERBOSITY_MODES = Object.freeze(["quiet", "normal", "chatty"]);
export const ROLE_SPEAK_START_MODES = Object.freeze(["classic", "speak-now"]);
export const ROLE_VOICE_ENGINES = Object.freeze(["aivis", "elevenlabs"]);

/** 項目ごとの既定(読めない値はここへ倒す)。 */
export const ROLE_DEFAULTS = Object.freeze({
  brain: "claude",
  voiceEngine: "aivis",
  verbosity: "normal",
  speakStartMode: "speak-now",
  body: true
});

/** 名前・呼ばれ方の 1 項目の上限(字数)と、呼ばれ方・hotwords の個数の上限。 */
const NAME_MAX_CHARS = 32;
const VARIANTS_MAX_COUNT = 50;
const WHISPER_PROMPT_MAX_CHARS = 200;
const ELEVENLABS_VOICE_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * @typedef {object} RoleName
 * @property {string} canonical  呼び名(名前の一文・判定の問い・会話のラベル)。
 * @property {string} display  見せる名前(操縦席の上の帯・題)。
 * @property {string} latin  ローマ字(名前の一文の括弧の中・無ければ空)。
 *
 * @typedef {object} RoleNameHints
 * @property {string} whisperPrompt  whisper の手がかり(語彙の寄せ・空なら渡さない)。
 * @property {ReadonlyArray<string>} voiceCallVariants  声での呼ばれ方。
 * @property {ReadonlyArray<string>} commentCallVariants  コメントでの呼ばれ方。
 * @property {ReadonlyArray<string> | null} hotwords  Zipformer の hotwords(null は設定ファイルか既定に任せる)。
 *
 * @typedef {object} RoleVoice
 * @property {"aivis" | "elevenlabs"} engine
 * @property {number | null} aivisSpeaker  AivisSpeech の話者(null はコードの既定)。
 * @property {string | null} elevenLabsVoiceId  ElevenLabs の声の id(null はコードの既定)。
 *
 * @typedef {object} Role
 * @property {string} id  フォルダ名と同じ。
 * @property {RoleName} name
 * @property {RoleNameHints} nameHints
 * @property {string} brain  動かす頭の id(brains.mjs の BRAIN_IDS)。
 * @property {RoleVoice} voice
 * @property {"quiet" | "normal" | "chatty"} verbosity
 * @property {"classic" | "speak-now"} speakStartMode
 * @property {boolean} body  体(器)を使うか。
 */

/** @param {unknown} value @returns {string | null} */
function nameText(value) {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text.length > 0 && [...text].length <= NAME_MAX_CHARS ? text : null;
}

/** @param {unknown} value @returns {string[] | null}  配列でなければ null。 */
function textList(value) {
  if (!Array.isArray(value)) return null;
  /** @type {string[]} */
  const out = [];
  for (const item of value) {
    const text = nameText(item);
    if (text == null || out.includes(text)) continue;
    out.push(text);
    if (out.length >= VARIANTS_MAX_COUNT) break;
  }
  return out;
}

/**
 * role.json の生の値を、項目ごとに確かめたロールにする(読めない値はその項目だけ既定)。
 * 呼び名が無いときは id を呼び名にする。見せる名前は無ければ呼び名。
 *
 * @param {string} id
 * @param {unknown} raw
 * @returns {Readonly<Role>}
 */
export function normalizeRole(id, raw) {
  if (!isRoleId(id)) throw new TypeError(`invalid role id: ${String(id)}`);
  const r = raw && typeof raw === "object" && !Array.isArray(raw) ? /** @type {Record<string, any>} */ (raw) : {};
  const n = r.name && typeof r.name === "object" ? r.name : {};
  const canonical = nameText(n.canonical) ?? id;
  const display = nameText(n.display) ?? canonical;
  const latin = nameText(n.latin) ?? "";
  const h = r.nameHints && typeof r.nameHints === "object" ? r.nameHints : {};
  const voiceCallVariants = textList(h.voiceCallVariants) ?? [canonical];
  const commentCallVariants =
    textList(h.commentCallVariants) ?? [...(latin ? [latin] : []), ...voiceCallVariants];
  const whisperPrompt =
    typeof h.whisperPrompt === "string" && [...h.whisperPrompt.trim()].length <= WHISPER_PROMPT_MAX_CHARS
      ? h.whisperPrompt.trim()
      : `${canonical}。`;
  const hotwords = textList(h.hotwords);
  const v = r.voice && typeof r.voice === "object" ? r.voice : {};
  const speaker = v.aivisSpeaker;
  return Object.freeze({
    id,
    name: Object.freeze({ canonical, display, latin }),
    nameHints: Object.freeze({
      whisperPrompt,
      voiceCallVariants: Object.freeze(voiceCallVariants),
      commentCallVariants: Object.freeze(commentCallVariants),
      hotwords: hotwords == null ? null : Object.freeze(hotwords)
    }),
    brain: typeof r.brain === "string" && BRAIN_IDS.includes(r.brain) ? r.brain : ROLE_DEFAULTS.brain,
    voice: Object.freeze({
      engine: ROLE_VOICE_ENGINES.includes(v.engine) ? v.engine : ROLE_DEFAULTS.voiceEngine,
      aivisSpeaker: typeof speaker === "number" && Number.isSafeInteger(speaker) && speaker >= 0 ? speaker : null,
      elevenLabsVoiceId:
        typeof v.elevenLabsVoiceId === "string" && ELEVENLABS_VOICE_ID_PATTERN.test(v.elevenLabsVoiceId)
          ? v.elevenLabsVoiceId
          : null
    }),
    verbosity: ROLE_VERBOSITY_MODES.includes(r.verbosity) ? r.verbosity : ROLE_DEFAULTS.verbosity,
    speakStartMode: ROLE_SPEAK_START_MODES.includes(r.speakStartMode) ? r.speakStartMode : ROLE_DEFAULTS.speakStartMode,
    body: typeof r.body === "boolean" ? r.body : ROLE_DEFAULTS.body
  });
}

/**
 * ロールを role.json に書く形にする(id はフォルダ名なので入れない)。
 * @param {Readonly<Role>} role
 */
export function roleToJson(role) {
  return {
    version: ROLE_FILE_VERSION,
    name: { canonical: role.name.canonical, display: role.name.display, latin: role.name.latin },
    nameHints: {
      whisperPrompt: role.nameHints.whisperPrompt,
      voiceCallVariants: [...role.nameHints.voiceCallVariants],
      commentCallVariants: [...role.nameHints.commentCallVariants],
      hotwords: role.nameHints.hotwords == null ? null : [...role.nameHints.hotwords]
    },
    brain: role.brain,
    voice: {
      engine: role.voice.engine,
      aivisSpeaker: role.voice.aivisSpeaker,
      elevenLabsVoiceId: role.voice.elevenLabsVoiceId
    },
    verbosity: role.verbosity,
    speakStartMode: role.speakStartMode,
    body: role.body
  };
}

/**
 * ロールの名前を、名前を受け取る側(発火の指示・whisper・呼びかけの照合・操縦席の snapshot)の形
 * (model-identity.mjs の ModelIdentity)にする。id はロールの id。
 * @param {Readonly<Role>} role
 * @returns {Readonly<import("../mind/model-identity.mjs").ModelIdentity>}
 */
export function roleIdentity(role) {
  return Object.freeze({
    id: role.id,
    canonicalName: role.name.canonical,
    latinName: role.name.latin,
    displayName: role.name.display,
    whisperPrompt: role.nameHints.whisperPrompt,
    voiceCallVariants: role.nameHints.voiceCallVariants,
    commentCallVariants: role.nameHints.commentCallVariants
  });
}

/**
 * 名前から作る名前の手がかり(配信の組み直し Domain E: ロールの編集で名前を替えたとき・新しいロールを作ったとき)。
 * 呼ばれ方・whisper の手がかり・hotwords を新しい名前だけにする(写した元のロールの名前で呼ばれたと取り違えないため)。
 * @param {{ canonical: string; latin: string }} name
 */
function nameHintsForName(name) {
  return {
    whisperPrompt: `${name.canonical}。`,
    voiceCallVariants: [name.canonical],
    commentCallVariants: [...(name.latin ? [name.latin] : []), name.canonical],
    hotwords: [name.canonical]
  };
}

/** @param {unknown} value @returns {value is Record<string, any>} */
function isPlainObject(value) {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

/**
 * ロールの編集(配信の組み直し Domain E・操縦席のロールのタブ)の書き換えを、項目ごとに厳しく確かめてロールに当てる。
 * 読むときの normalizeRole と違い、型の違う・範囲外の値は既定へ倒さず、理由を返して断る(画面で入れ損ねた値で
 * 黙ってモデルや声が替わらないように)。書き換えられるのは 名前(呼び名・見せる名前・ローマ字)・動かすモデル・声
 * (方式・AivisSpeech の話者・ElevenLabs の声の id)・口数・話し始め・体。名前の手がかりは直接は書き換えず、呼び名か
 * ローマ字が替わったときだけ新しい名前から作り直す。性格の指示は別の口(instructions.md)。
 *
 * @param {Readonly<Role>} role  今のロール。
 * @param {unknown} patch
 * @returns {{ ok: true; role: Readonly<Role> } | { ok: false; reason: string }}
 */
export function applyRolePatch(role, patch) {
  if (!isPlainObject(patch)) return { ok: false, reason: "ロールの編集の形が違う" };
  const json = /** @type {Record<string, any>} */ (roleToJson(role));
  if (patch.name !== undefined) {
    if (!isPlainObject(patch.name)) return { ok: false, reason: "名前の形が違う" };
    const canonical = nameText(patch.name.canonical);
    const display = nameText(patch.name.display);
    if (canonical == null) return { ok: false, reason: `呼び名は 1〜${NAME_MAX_CHARS} 字` };
    if (display == null) return { ok: false, reason: `見せる名前は 1〜${NAME_MAX_CHARS} 字` };
    const latinRaw = patch.name.latin ?? "";
    if (typeof latinRaw !== "string") return { ok: false, reason: "ローマ字の形が違う" };
    const latin = latinRaw.trim();
    if ([...latin].length > NAME_MAX_CHARS) return { ok: false, reason: `ローマ字は ${NAME_MAX_CHARS} 字まで` };
    const nameChanged = canonical !== role.name.canonical || latin !== role.name.latin;
    json.name = { canonical, display, latin };
    if (nameChanged) json.nameHints = nameHintsForName({ canonical, latin });
  }
  if (patch.brain !== undefined) {
    if (typeof patch.brain !== "string" || !BRAIN_IDS.includes(patch.brain)) return { ok: false, reason: "知らないモデル" };
    json.brain = patch.brain;
  }
  if (patch.voice !== undefined) {
    if (!isPlainObject(patch.voice)) return { ok: false, reason: "声の形が違う" };
    const voice = { ...json.voice };
    if (patch.voice.engine !== undefined) {
      if (!ROLE_VOICE_ENGINES.includes(patch.voice.engine)) return { ok: false, reason: "知らない声の方式" };
      voice.engine = patch.voice.engine;
    }
    if (patch.voice.aivisSpeaker !== undefined) {
      const speaker = patch.voice.aivisSpeaker;
      if (speaker !== null && !(typeof speaker === "number" && Number.isSafeInteger(speaker) && speaker >= 0)) {
        return { ok: false, reason: "AivisSpeech の話者は 0 以上の整数(空なら既定)" };
      }
      voice.aivisSpeaker = speaker;
    }
    if (patch.voice.elevenLabsVoiceId !== undefined) {
      const voiceId = patch.voice.elevenLabsVoiceId === "" ? null : patch.voice.elevenLabsVoiceId;
      if (voiceId !== null && !(typeof voiceId === "string" && ELEVENLABS_VOICE_ID_PATTERN.test(voiceId))) {
        return { ok: false, reason: "ElevenLabs の声の id は英数字・_・- の 64 字まで(空なら既定)" };
      }
      voice.elevenLabsVoiceId = voiceId;
    }
    json.voice = voice;
  }
  if (patch.verbosity !== undefined) {
    if (!ROLE_VERBOSITY_MODES.includes(patch.verbosity)) return { ok: false, reason: "知らない口数" };
    json.verbosity = patch.verbosity;
  }
  if (patch.speakStartMode !== undefined) {
    if (!ROLE_SPEAK_START_MODES.includes(patch.speakStartMode)) return { ok: false, reason: "知らない話し始め" };
    json.speakStartMode = patch.speakStartMode;
  }
  if (patch.body !== undefined) {
    if (typeof patch.body !== "boolean") return { ok: false, reason: "体は使う / 使わないのどちらか" };
    json.body = patch.body;
  }
  return { ok: true, role: normalizeRole(role.id, json) };
}

/**
 * 今のロールを写して新しいロールを作る(配信の組み直し Domain E・設計 §6「新しいロールは、今のロールを写して作る」)。
 * モデル・声・口数・話し始め・体を写し、名前は新しい名前(無ければ id)にして名前の手がかりを作り直す。書かない
 * (置き場に書くのは呼び出し側)。性格の指示(instructions.md)は呼び出し側が写す。
 *
 * @param {Readonly<Role>} role  写す元。
 * @param {{ id: string; name?: string | null }} options
 * @returns {{ ok: true; role: Readonly<Role> } | { ok: false; reason: string }}
 */
export function copyRoleAs(role, { id, name }) {
  if (!isRoleId(id)) return { ok: false, reason: "ロールの id は英小文字で始まる 32 字までの英小文字・数字・-(Windows の予約名は使えない)" };
  const given = name == null || (typeof name === "string" && name.trim() === "") ? id : nameText(name);
  if (given == null) return { ok: false, reason: `名前は 1〜${NAME_MAX_CHARS} 字` };
  const json = /** @type {Record<string, any>} */ (roleToJson(role));
  json.name = { canonical: given, display: given, latin: "" };
  json.nameHints = nameHintsForName({ canonical: given, latin: "" });
  return { ok: true, role: normalizeRole(id, json) };
}

/**
 * 名前のひな形(model-identity.mjs の cody / chappy の表)からロールを作る(引っ越しと、ロールが 1 つも無いときの
 * 既定に使う)。残りの持ち物は `rest` で渡す(無ければ既定)。
 * @param {Readonly<import("../mind/model-identity.mjs").ModelIdentity>} identity
 * @param {{ brain?: string; voice?: Partial<RoleVoice>; verbosity?: string; speakStartMode?: string; body?: boolean;
 *   hotwords?: ReadonlyArray<string> | null }} [rest]
 * @returns {Readonly<Role>}
 */
export function roleFromIdentity(identity, rest = {}) {
  return normalizeRole(identity.id, {
    name: { canonical: identity.canonicalName, display: identity.displayName, latin: identity.latinName },
    nameHints: {
      whisperPrompt: identity.whisperPrompt,
      voiceCallVariants: [...identity.voiceCallVariants],
      commentCallVariants: [...identity.commentCallVariants],
      hotwords: rest.hotwords == null ? null : [...rest.hotwords]
    },
    brain: rest.brain,
    voice: rest.voice ?? {},
    verbosity: rest.verbosity,
    speakStartMode: rest.speakStartMode,
    body: rest.body
  });
}

/** @param {string} dir @param {string} id */
export function roleDir(dir, id) {
  if (!isRoleId(id)) throw new TypeError(`invalid role id: ${String(id)}`);
  return join(dir, id);
}

/**
 * ロールを 1 つ読む。role.json が無い・読めない・JSON でない・オブジェクトでないときは `{ ok:false, reason }`。
 * @param {{ dir: string; id: string }} options
 * @returns {{ ok: true; role: Readonly<Role> } | { ok: false; reason: string }}
 */
export function readRole({ dir, id }) {
  if (!isRoleId(id)) return { ok: false, reason: "invalid role id" };
  const path = join(dir, id, ROLE_FILE_NAME);
  /** @type {string} */
  let text;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    return { ok: false, reason: `${ROLE_FILE_NAME} が無い` };
  }
  /** @type {unknown} */
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, reason: `${ROLE_FILE_NAME} が JSON として読めない` };
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, reason: `${ROLE_FILE_NAME} の形が違う` };
  }
  return { ok: true, role: normalizeRole(id, parsed) };
}

/**
 * ロールを書く(フォルダが無ければ作る)。書く前に normalizeRole を通す。失敗は投げる。
 * @param {{ dir: string; role: Readonly<Role> | (Partial<Role> & { id: string }) }} options
 * @returns {Readonly<Role>}  書いたロール(確かめたあとの値)。
 */
export function writeRole({ dir, role }) {
  const normalized = normalizeRole(role.id, roleToJsonLoose(role));
  const folder = roleDir(dir, normalized.id);
  mkdirSync(folder, { recursive: true });
  writeFileSync(join(folder, ROLE_FILE_NAME), `${JSON.stringify(roleToJson(normalized), null, 2)}\n`, "utf8");
  return normalized;
}

/** 部分的なロール(書き換えの途中)も normalizeRole に通せる形にする。 @param {any} role */
function roleToJsonLoose(role) {
  return {
    name: role.name,
    nameHints: role.nameHints,
    brain: role.brain,
    voice: role.voice,
    verbosity: role.verbosity,
    speakStartMode: role.speakStartMode,
    body: role.body
  };
}

/**
 * 置き場のロールを全部読む(id の順)。フォルダが無ければ空。読めないロールは `invalid` に理由と並べる。
 * @param {{ dir: string }} options
 * @returns {{ roles: Array<Readonly<Role>>; invalid: Array<{ id: string; reason: string }> }}
 */
export function listRoles({ dir }) {
  /** @type {string[]} */
  let names;
  try {
    names = readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && isRoleId(entry.name))
      .map((entry) => entry.name)
      .sort();
  } catch {
    return { roles: [], invalid: [] };
  }
  /** @type {Array<Readonly<Role>>} */
  const roles = [];
  /** @type {Array<{ id: string; reason: string }>} */
  const invalid = [];
  for (const id of names) {
    const result = readRole({ dir, id });
    if (result.ok) roles.push(result.role);
    else invalid.push({ id, reason: result.reason });
  }
  return { roles, invalid };
}

/** ロールの置き場があるか(引っ越しを走らせるかの判定に使う)。 @param {string} dir */
export function rolesDirExists(dir) {
  return existsSync(dir);
}

/**
 * ロールの性格の指示(instructions.md)を読む。無い・読めない・空(空白だけ)なら既定の本文。
 * @param {{ dir: string; id: string }} options
 * @returns {{ body: string; override: string | null; hasOverride: boolean; defaultBody: string }}
 */
export function readRoleInstructions({ dir, id }) {
  /** @type {string | null} */
  let override = null;
  if (isRoleId(id)) {
    try {
      const text = readFileSync(join(dir, id, ROLE_INSTRUCTIONS_FILE_NAME), "utf8");
      override = text.trim().length > 0 ? text : null;
    } catch {
      override = null;
    }
  }
  return {
    body: override ?? DEFAULT_CONVERSATION_INSTRUCTION_BODY,
    override,
    hasOverride: override != null,
    defaultBody: DEFAULT_CONVERSATION_INSTRUCTION_BODY
  };
}

/**
 * ロールの性格の指示を書く(空文字なら空のファイル = 既定に戻す)。失敗は投げる。
 * @param {{ dir: string; id: string; text: string }} options
 */
export function writeRoleInstructions({ dir, id, text }) {
  if (typeof text !== "string") throw new TypeError("instructions must be a string");
  const folder = roleDir(dir, id);
  mkdirSync(folder, { recursive: true });
  writeFileSync(join(folder, ROLE_INSTRUCTIONS_FILE_NAME), text, "utf8");
}

/**
 * 会話指示の API(cockpit.mjs の createConversationInstructionHooks)が使う置き場の口を、ロールの instructions.md に
 * 向けて作る。鍵は頭の id ではなくロールの id。知っているロール(`knownIds`)のものだけを読み書きする。
 * 書き込みの失敗は投げる(API の 500・revision を進めない)。
 *
 * @param {{ dir: string; knownIds: () => ReadonlyArray<string> }} options
 */
export function createRoleInstructionStore({ dir, knownIds }) {
  const known = (/** @type {unknown} */ id) => isRoleId(id) && knownIds().includes(id);
  return {
    /** @param {string} roleId */
    isKnownConversationInstructionId(roleId) {
      return known(roleId);
    },
    /** @param {string} roleId */
    getConversationInstructionProfile(roleId) {
      const read = readRoleInstructions({ dir, id: roleId });
      return Object.freeze({ roleId, ...read });
    },
    getConversationInstructionOverrides() {
      /** @type {Record<string, string>} */
      const out = {};
      for (const id of knownIds()) {
        const read = readRoleInstructions({ dir, id });
        if (read.override != null) out[id] = read.override;
      }
      return out;
    },
    /** @param {string} roleId @param {string} instruction */
    setConversationInstruction(roleId, instruction) {
      if (!known(roleId)) throw new Error("unknown role");
      if (typeof instruction !== "string" || instruction.trim().length === 0) throw new Error("empty instruction");
      writeRoleInstructions({ dir, id: roleId, text: instruction });
      return true;
    },
    /** @param {string} roleId */
    resetConversationInstruction(roleId) {
      if (!known(roleId)) throw new Error("unknown role");
      writeRoleInstructions({ dir, id: roleId, text: "" });
      return true;
    }
  };
}
