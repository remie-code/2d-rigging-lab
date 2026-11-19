import { buildFireSystemPrompt } from "./fire-orchestrator.mjs";
import { appendSoulSkills, listSoulSkills, loadSoulSkills, soulSkillNamesForVenue } from "./soul-skills.mjs";

/**
 * Compose the system prompt for one newly-created brain session.
 *
 * 配信の組み直し Domain A: 名前と性格の指示はロールから引く（頭の id から名前を決めない）。本番の
 * ensureFireResources() は今のロールの名前（roleIdentity）と instructions.md の本文でこれを呼ぶ。
 *
 * 記憶の作り直し Wave 2: 起動時に直近の記録を載せる仕組みは撤去した（①は配信の最初に記憶を持たない・
 * recall-flow.md §7）。人格の指示は「名前 + 会話指示」に、Wave 3 で魂の教え（skills/ の `<recall>` の使い方・
 * soul-skills.mjs）を足した。教えは名前の一文と同じく魂が足す固定の部分で、会話指示を書き換えても消えない。
 *
 * @param {unknown} identity  ロールの名前（roleIdentity の形）。形が壊れていれば既定（コーディ）。
 * @param {string} [instructionBody]  性格の指示（無い・空なら既定の本文）。
 * @param {string} [skillsText]  足す教え（既定は skills/ から読む）。
 * @returns {string}
 */
export function buildRoleSessionSystemPrompt(identity, instructionBody = undefined, skillsText = undefined) {
  return appendSoulSkills(buildFireSystemPrompt(identity, instructionBody), skillsText ?? loadSoulSkills());
}

/**
 * Track the in-process effective instruction revision. Callers must invoke
 * `markPersisted()` only after a durable settings write succeeds; failed
 * writes leave the revision unchanged and therefore cannot invalidate a live
 * session.
 */
export function createInstructionRevisionController(initialRevision = 0) {
  let revision = Number.isInteger(initialRevision) && initialRevision >= 0 ? initialRevision : 0;
  return {
    getRevision() {
      return revision;
    },
    markPersisted() {
      revision += 1;
      return revision;
    }
  };
}

/**
 * 場の言葉のうち、①の教えと会話指示の編集画面に効くもの（Discord モード Domain C・discord-mode.md §3.4 ①の側）。場が開いていて、
 * その体験が語の組か教えを持つときだけ `{ wording, teaching }` を返す。場が閉じている・配信（語の組も教えも null）なら null
 * （= 今の配信の道をそのまま通す: ①の固定の指示も編集画面の本文も一字も変わらない）。
 * @param {unknown} context  cockpit-server の venueContext() の値（閉じていれば null）。
 * @returns {{ wording: any; teaching: string | null } | null}
 */
export function venueSoulWords(context) {
  if (!context || typeof context !== "object") return null;
  const { wording, teaching } = /** @type {{ wording?: any; teaching?: any }} */ (context);
  if (wording == null && teaching == null) return null;
  return { wording: wording ?? null, teaching: typeof teaching === "string" ? teaching : null };
}

/**
 * 場の体験の言葉で①に足す教えの一覧（Discord モード Domain C）。体の有無で選ぶ教えの最後に体験の教えを足し、本文の印をその
 * 体験の語の組で差す。venueSoulWords が null（配信・閉じている）のときは呼ばない（呼び出し側が今の道を通す）。
 * @param {{ body: boolean; venue: { wording: any; teaching: string | null }; onWarning?: (warning: string) => void; listImpl?: typeof listSoulSkills }} p
 * @returns {Array<{ name: string; path: string; body: string }>}
 */
export function listVenueSoulSkills({ body, venue, onWarning, listImpl = listSoulSkills }) {
  return listImpl({
    names: soulSkillNamesForVenue({ body, teaching: venue.teaching }),
    wording: venue.wording,
    ...(typeof onWarning === "function" ? { onWarning } : {})
  });
}

/**
 * Adapt the file-backed settings store to the dedicated Cockpit instruction
 * surface. Persistence owns validation and durable writes; this thin seam is
 * responsible only for incrementing the effective revision after success.
 *
 * Wave 3 仕上げ（記憶の作り直し）: 魂が①の固定の指示にいつも足す教え（skills/）を、会話指示の編集画面に読むだけで
 * 見せるため、getSoulSkills で名前・置き場・本文を返す（①に足すものと同じ listSoulSkills から読む・編集はできない）。
 *
 * 配信の組み直し Domain A: 会話指示はロールの性格の指示（roles/<id>/instructions.md）になった。本番は
 * role-store.mjs の createRoleInstructionStore を置き場の口として渡し、鍵はロールの id。置き場の口が
 * `isKnownConversationInstructionId` を持てば、知らない id を isKnownId で断れる（API の 400）。
 *
 * @param {object} settings  置き場の口（getConversationInstructionProfile / set… / reset…）。
 * @param {() => string} getRoleId  今のロールの id。
 * @param {ReturnType<typeof createInstructionRevisionController>} [revision]
 * Discord モード Domain C: 場が開いていて、その体験が語の組か教えを持つ（配信でない）ときは、getVenueSoulSkills が返す一覧
 * （その体験の語で差した本文・体験の教えも含む）を見せる。null を返したら（場が閉じている・配信）getSoulSkills（配信の語）。
 *
 * @param {() => Array<{ name: string; path: string; body: string }>} [getSoulSkills]  テスト注入（既定 listSoulSkills）。
 * @param {() => (Array<{ name: string; path: string; body: string }> | null)} [getVenueSoulSkills]  場の体験の言葉で見せる一覧
 *   （Discord モード Domain C・既定は常に null = getSoulSkills）。
 */
export function createConversationInstructionHooks(
  settings,
  getRoleId,
  revision = createInstructionRevisionController(),
  getSoulSkills = () => listSoulSkills(),
  getVenueSoulSkills = () => null
) {
  const store = /** @type {any} */ (settings);
  const currentId = () => getRoleId();
  return {
    /** 知っている id か（置き場の口が知らなければ、形の確かめは API に任せて通す）。 @param {string} id */
    isKnownId(id) {
      return typeof store.isKnownConversationInstructionId === "function"
        ? store.isKnownConversationInstructionId(id) === true
        : true;
    },
    getProfile(brainId = currentId()) {
      return store.getConversationInstructionProfile(brainId);
    },
    getOverrides() {
      return store.getConversationInstructionOverrides();
    },
    save(brainId, instruction) {
      const persisted = store.setConversationInstruction(brainId, instruction);
      if (persisted === true) revision.markPersisted();
      return persisted;
    },
    reset(brainId) {
      const persisted = store.resetConversationInstruction(brainId);
      if (persisted === true) revision.markPersisted();
      return persisted;
    },
    getRevision() {
      return revision.getRevision();
    },
    getSoulSkills() {
      return getVenueSoulSkills() ?? getSoulSkills();
    }
  };
}
