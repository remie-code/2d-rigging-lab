// @ts-check
/**
 * Soul identity contract (the self-name and its hints).
 *
 * The technical brain id/model and the Soul's self-name are intentionally
 * separate dimensions. 配信の組み直し Domain A から、名前はロール（`roles/<role-id>/role.json`・
 * src/roles/role-store.mjs）が持つ。頭（brains.mjs）はもう名前を持たない。ここに残る cody / chappy の表は
 * 引っ越しでロールを作るときの元（名前のひな形）と、名前が渡らないときの既定（コーディ）だけ。
 * 名前を受け取る側（発火の指示・操縦席の snapshot・判定）は {@link normalizeModelIdentity} で形だけを確かめ、
 * cody / chappy 以外の名前もそのまま通す。
 */

/**
 * @typedef {object} ModelIdentity
 * @property {string} id  ロールの id（英小文字・{@link ROLE_ID_PATTERN}）。
 * @property {string} canonicalName
 * @property {string} latinName
 * @property {string} displayName
 * @property {string} whisperPrompt
 * @property {ReadonlyArray<string>} voiceCallVariants
 * @property {ReadonlyArray<string>} commentCallVariants
 */

const CODY_VOICE_CALL_VARIANTS = Object.freeze([
  "コーディ",
  "コーディー",
  "コーティ",
  "コーティー"
]);

const CODY_COMMENT_CALL_VARIANTS = Object.freeze([
  "Cody",
  "cody",
  "CODY",
  ...CODY_VOICE_CALL_VARIANTS,
  "こーでぃー"
]);

const CHAPPY_VOICE_CALL_VARIANTS = Object.freeze(["チャッピー", "ちゃっぴー"]);

const CHAPPY_COMMENT_CALL_VARIANTS = Object.freeze([
  "Chappy",
  "chappy",
  "CHAPPY",
  ...CHAPPY_VOICE_CALL_VARIANTS
]);

/**
 * Frozen model-family identities. The nested arrays and each identity are
 * frozen as well, so a consumer cannot mutate the shared contract.
 *
 * @type {Readonly<Record<"cody" | "chappy", Readonly<ModelIdentity>>>}
 */
export const MODEL_IDENTITIES = Object.freeze({
  cody: Object.freeze({
    id: "cody",
    canonicalName: "コーディ",
    latinName: "Cody",
    displayName: "こーでぃー",
    whisperPrompt: "こーでぃー、コーディ。",
    voiceCallVariants: CODY_VOICE_CALL_VARIANTS,
    commentCallVariants: CODY_COMMENT_CALL_VARIANTS
  }),
  chappy: Object.freeze({
    id: "chappy",
    canonicalName: "チャッピー",
    latinName: "Chappy",
    displayName: "チャッピー",
    whisperPrompt: "ちゃっぴー、チャッピー。",
    voiceCallVariants: CHAPPY_VOICE_CALL_VARIANTS,
    commentCallVariants: CHAPPY_COMMENT_CALL_VARIANTS
  })
});

/** 名前が渡らない・形が壊れているときの既定（今までの Claude/Cody の既定と同じ）。 */
export const DEFAULT_MODEL_IDENTITY = MODEL_IDENTITIES.cody;

/**
 * Resolve a preset identity id (cody / chappy) to the frozen contract. Unknown, absent, or
 * malformed values deliberately preserve the existing Claude/Cody fallback.
 * ロールの名前を受け取るときは {@link normalizeModelIdentity}（id で表を引かない）を使う。
 *
 * @param {unknown} identityId
 * @returns {Readonly<ModelIdentity>}
 */
export function resolveModelIdentity(identityId) {
  if (identityId === "cody" || identityId === "chappy") {
    return MODEL_IDENTITIES[identityId];
  }
  return DEFAULT_MODEL_IDENTITY;
}

/**
 * ロールの id の形（英小文字で始まり、英小文字・数字・`-` で 32 字まで。`chappy`・`cody` など）。
 * 置き場のフォルダ名にもなるので、`.`・`/`・`\`・大文字は通さない。
 */
export const ROLE_ID_PATTERN = /^[a-z][a-z0-9-]{0,31}$/;

/**
 * Windows でフォルダ名にできない予約名（配信の組み直し Domain E）。ロールの id はロールの置き場（`roles/<id>/`）と
 * 記憶のフォルダ（`memories/<id>/`）の名前になるので、形が合っていてもこれらは通さない。大文字小文字は問わない
 * （ROLE_ID_PATTERN は英小文字だけを通すが、ここでも小文字にして比べる）。
 * 操縦席の画面側の写し（src/cockpit/view-logic/role.mjs）と一致することをテストで固定している。
 */
export const WINDOWS_RESERVED_NAMES = Object.freeze([
  "con",
  "prn",
  "aux",
  "nul",
  ...Array.from({ length: 10 }, (_, i) => `com${i}`),
  ...Array.from({ length: 10 }, (_, i) => `lpt${i}`)
]);

/**
 * @param {unknown} value
 * @returns {boolean}  Windows の予約名か（大文字小文字を問わない）。
 */
export function isWindowsReservedName(value) {
  return typeof value === "string" && WINDOWS_RESERVED_NAMES.includes(value.toLowerCase());
}

/**
 * ロールの id か（形が {@link ROLE_ID_PATTERN} に合い、Windows の予約名でない）。
 * @param {unknown} value
 * @returns {value is string}
 */
export function isRoleId(value) {
  return typeof value === "string" && ROLE_ID_PATTERN.test(value) && !isWindowsReservedName(value);
}

/** 名前の 1 項目の上限（字数）。 */
const NAME_MAX_CHARS = 32;

/** @param {unknown} value @returns {string | null} */
function nameText(value) {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text.length > 0 && [...text].length <= NAME_MAX_CHARS ? text : null;
}

/** @param {unknown} value @returns {ReadonlyArray<string>} */
function variantList(value) {
  if (!Array.isArray(value)) return Object.freeze([]);
  /** @type {string[]} */
  const out = [];
  for (const item of value) {
    const text = nameText(item);
    if (text != null && !out.includes(text)) out.push(text);
  }
  return Object.freeze(out);
}

/**
 * 受け取った名前（ロールの名前・cody / chappy の表）を、形だけ確かめて凍らせて返す。
 * id はロールの id の形、呼び名（canonicalName）と見せる名前（displayName）は空でない 32 字までの文字列が要る。
 * 足りなければ既定（コーディ）。ローマ字・whisper の手がかりは無ければ空、呼ばれ方は文字列だけを残す。
 * cody / chappy の表そのものが来たら同じものを返す（今までの比較がそのまま通る）。
 *
 * @param {unknown} value
 * @returns {Readonly<ModelIdentity>}
 */
export function normalizeModelIdentity(value) {
  if (!value || typeof value !== "object") return DEFAULT_MODEL_IDENTITY;
  const candidate = /** @type {Record<string, unknown>} */ (value);
  const id = candidate.id;
  if (!isRoleId(id)) return DEFAULT_MODEL_IDENTITY;
  const preset = /** @type {Record<string, Readonly<ModelIdentity>>} */ (MODEL_IDENTITIES)[id];
  if (preset === value) return preset;
  const canonicalName = nameText(candidate.canonicalName);
  const displayName = nameText(candidate.displayName);
  if (canonicalName == null || displayName == null) return DEFAULT_MODEL_IDENTITY;
  return Object.freeze({
    id,
    canonicalName,
    latinName: nameText(candidate.latinName) ?? "",
    displayName,
    whisperPrompt: typeof candidate.whisperPrompt === "string" ? candidate.whisperPrompt.trim() : "",
    voiceCallVariants: variantList(candidate.voiceCallVariants),
    commentCallVariants: variantList(candidate.commentCallVariants)
  });
}
