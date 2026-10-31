// @ts-check
/**
 * view-logic: ロールの id の形とロールの編集の表示導出（配信の組み直し Domain E・preact 非依存の純関数）。
 *
 * 上位文書: discussion/ai-cohost/architecture/stream-restructure.md §2（ロールの持ち物）・§6（画面: ロールのタブ）。
 *
 * ロールの id の形（{@link ROLE_ID_PATTERN}）と Windows の予約名（{@link WINDOWS_RESERVED_NAMES}）は
 * src/mind/model-identity.mjs の写し。画面のコード（ui/・view-logic/）はブラウザへ配る木なので mind を import できない
 * （配る木の外・ui 構造テストの決まり）。画面側はここ 1 か所から引き（ui/header.mjs・view-logic/conversation-instruction.mjs）、
 * 魂側と一致することは cockpit-ui-settings.test.mjs が同じ入力の組を両方に通して固定する。
 *
 * トップレベル副作用ゼロ（export function/const のみ）。
 */

import { BRAIN_LABELS } from "./health.mjs";
import { TTS_ENGINE_OPTIONS } from "./settings.mjs";

/** ロールの id の形（model-identity.mjs の ROLE_ID_PATTERN の写し）。 */
export const ROLE_ID_PATTERN = /^[a-z][a-z0-9-]{0,31}$/;

/** Windows でフォルダ名にできない予約名（model-identity.mjs の WINDOWS_RESERVED_NAMES の写し）。 */
export const WINDOWS_RESERVED_NAMES = Object.freeze([
  "con",
  "prn",
  "aux",
  "nul",
  ...Array.from({ length: 10 }, (_, i) => `com${i}`),
  ...Array.from({ length: 10 }, (_, i) => `lpt${i}`)
]);

/**
 * ロールの id の形か（形が合い、Windows の予約名でない・model-identity.mjs の isRoleId と同じ答え）。
 * @param {unknown} value
 * @returns {value is string}
 */
export function isRoleIdShape(value) {
  return typeof value === "string" && ROLE_ID_PATTERN.test(value) && !WINDOWS_RESERVED_NAMES.includes(value.toLowerCase());
}

/** 名前の 1 項目の上限（字数・role-store の NAME_MAX_CHARS と同じ）。 */
export const ROLE_NAME_MAX_CHARS = 32;

/** 動かすモデルの選択肢（health.mjs の BRAIN_LABELS から）。 */
export const ROLE_MODEL_OPTIONS = Object.freeze(
  Object.keys(BRAIN_LABELS).map((id) => Object.freeze({ value: id, label: BRAIN_LABELS[id] }))
);

/** 声の方式の選択肢（settings.mjs の TTS_ENGINE_OPTIONS と同じ）。 */
export const ROLE_VOICE_ENGINE_OPTIONS = TTS_ENGINE_OPTIONS;

/**
 * @typedef {object} RoleDraft  ロールの編集の下書き（画面の入力欄の値・文字列で持つ）。
 * @property {string} id
 * @property {string} canonical  呼び名。
 * @property {string} display  見せる名前。
 * @property {string} latin  ローマ字。
 * @property {string} brain  動かすモデル（頭の id）。
 * @property {string} voiceEngine  "aivis" | "elevenlabs"。
 * @property {string} aivisSpeaker  AivisSpeech の話者（空 = 既定）。
 * @property {string} elevenLabsVoiceId  ElevenLabs の声の id（空 = 既定）。
 * @property {string} verbosity  "quiet" | "normal" | "chatty"。
 * @property {string} speakStartMode  "classic" | "speak-now"。
 * @property {boolean} body  体を使うか。
 */

/** @param {unknown} v @param {string} fallback */
const str = (v, fallback = "") => (typeof v === "string" ? v : fallback);

/**
 * snapshot の `role`（今のロール）からロールの編集の下書きを作る。今のロールが読めなければ null。
 * @param {unknown} roleStatus
 * @returns {RoleDraft | null}
 */
export function roleDraftFromStatus(roleStatus) {
  if (!roleStatus || typeof roleStatus !== "object") return null;
  const r = /** @type {any} */ (roleStatus);
  if (!isRoleIdShape(r.id)) return null;
  const name = r.name && typeof r.name === "object" ? r.name : {};
  const voice = r.voice && typeof r.voice === "object" ? r.voice : {};
  const display = str(name.display, str(r.displayName, r.id));
  return {
    id: r.id,
    canonical: str(name.canonical, display),
    display,
    latin: str(name.latin),
    brain: str(r.brain),
    voiceEngine: str(voice.engine, "aivis"),
    aivisSpeaker: typeof voice.aivisSpeaker === "number" ? String(voice.aivisSpeaker) : "",
    elevenLabsVoiceId: str(voice.elevenLabsVoiceId),
    verbosity: str(r.verbosity, "normal"),
    speakStartMode: str(r.speakStartMode, "speak-now"),
    body: r.body !== false
  };
}

/**
 * 下書きが今のロールから変わっているか（保存ボタンを押せるか）。
 * @param {RoleDraft | null} draft
 * @param {RoleDraft | null} baseline
 */
export function roleDraftDirty(draft, baseline) {
  if (!draft || !baseline) return false;
  return /** @type {Array<keyof RoleDraft>} */ (Object.keys(baseline)).some((key) => draft[key] !== baseline[key]);
}

/** @param {string} text */
const charCount = (text) => [...text].length;

/**
 * 下書きを POST /api/role/edit の中身にする（画面で分かる入れ損ねはここで断る。最後の確かめはサーバ）。
 * @param {RoleDraft} draft
 * @returns {{ ok: true; patch: object } | { ok: false; error: string }}
 */
export function rolePatchFromDraft(draft) {
  const canonical = draft.canonical.trim();
  const display = draft.display.trim();
  const latin = draft.latin.trim();
  if (canonical.length === 0 || charCount(canonical) > ROLE_NAME_MAX_CHARS) return { ok: false, error: `呼び名は 1〜${ROLE_NAME_MAX_CHARS} 字` };
  if (display.length === 0 || charCount(display) > ROLE_NAME_MAX_CHARS) return { ok: false, error: `見せる名前は 1〜${ROLE_NAME_MAX_CHARS} 字` };
  if (charCount(latin) > ROLE_NAME_MAX_CHARS) return { ok: false, error: `ローマ字は ${ROLE_NAME_MAX_CHARS} 字まで` };
  const speakerText = draft.aivisSpeaker.trim();
  /** @type {number | null} */
  let aivisSpeaker = null;
  if (speakerText !== "") {
    if (!/^\d{1,15}$/.test(speakerText)) return { ok: false, error: "AivisSpeech の話者は 0 以上の整数（空なら既定）" };
    aivisSpeaker = Number(speakerText);
  }
  const voiceIdText = draft.elevenLabsVoiceId.trim();
  if (voiceIdText !== "" && !/^[A-Za-z0-9_-]{1,64}$/.test(voiceIdText)) {
    return { ok: false, error: "ElevenLabs の声の id は英数字・_・- の 64 字まで（空なら既定）" };
  }
  return {
    ok: true,
    patch: {
      name: { canonical, display, latin },
      brain: draft.brain,
      voice: { engine: draft.voiceEngine, aivisSpeaker, elevenLabsVoiceId: voiceIdText === "" ? null : voiceIdText },
      verbosity: draft.verbosity,
      speakStartMode: draft.speakStartMode,
      body: draft.body === true
    }
  };
}

/**
 * 新しいロールの id の入れ損ね（画面の確かめ・最後の確かめはサーバ）。良ければ null。
 * @param {string} id
 * @param {ReadonlyArray<string>} existingIds
 * @returns {string | null}
 */
export function newRoleIdError(id, existingIds) {
  const text = typeof id === "string" ? id.trim() : "";
  if (text === "") return "ロールの id を入れる（英小文字で始まる英小文字・数字・-）";
  if (!ROLE_ID_PATTERN.test(text)) return "ロールの id は英小文字で始まる 32 字までの英小文字・数字・-";
  if (WINDOWS_RESERVED_NAMES.includes(text.toLowerCase())) return `${text} は Windows の予約名なので使えない`;
  if (existingIds.includes(text)) return `ロール ${text} はもうある`;
  return null;
}

/**
 * 器（Channel）の URL の欄を出すか（配信の組み直し Domain C・E: ロールに体があるときだけ）。snapshot の channel.body か
 * role.body が false なら出さない。どちらも無い古いサーバは出す（今までどおり）。
 * @param {{ channel?: { body?: boolean } | null; role?: { body?: boolean } | null } | null | undefined} settings
 */
export function channelFieldVisible(settings) {
  const s = settings || {};
  if (s.channel && s.channel.body === false) return false;
  if (s.role && s.role.body === false) return false;
  return true;
}

/**
 * ロールのタブの「今日のロール」と編集が場の途中で固まっているときの案内（固まっていなければ ""）。
 * @param {boolean} locked
 */
export function roleLockedNote(locked) {
  return locked ? "配信の途中はロールを選べない・直せない（配信を終えてから）" : "";
}

/**
 * POST /api/role/edit・/api/role/new の応答 → エラー文言（成功は null）。
 * @param {{ status: number; ok: boolean; j?: { error?: string | null } | null }} res
 * @returns {string | null}
 */
export function roleEditPostErrorText(res) {
  if (res.status === 503) return "role edit not available";
  if (!res.ok) return (res.j && res.j.error) || "ロールを直せない";
  return null;
}
