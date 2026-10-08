// @ts-check
/**
 * Soul identity contract for the registered brains.
 *
 * The technical brain id/model and the Soul's self-name are intentionally
 * separate dimensions. This module is the only declaration of the
 * model-family identity values; consumers resolve an id here instead of
 * maintaining their own brain/name table.
 */

/**
 * @typedef {object} ModelIdentity
 * @property {"cody" | "chappy"} id
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

/** Unknown or absent persisted brain values retain the existing Claude/Cody fallback. */
export const DEFAULT_MODEL_IDENTITY = MODEL_IDENTITIES.cody;

/**
 * Resolve a registry identity id to the frozen contract. Unknown, absent, or
 * malformed values deliberately preserve the existing Claude/Cody fallback.
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
