import { MODEL_IDENTITIES } from "../mind/model-identity.mjs";
import {
  applyRolePatch,
  copyRoleAs,
  listRoles,
  normalizeRole,
  readRole,
  readRoleInstructions,
  roleFromIdentity,
  roleIdentity,
  roleToJson,
  writeRole,
  writeRoleInstructions
} from "./role-store.mjs";
import { isCodexBrainId } from "../mind/brains.mjs";

/**
 * ロールの選択（配信の組み直し Domain A・旧 createBrainHooks の置き換え）。頭を選ぶ代わりにロールを選び、ロールが
 * 名前・性格の指示・動かすモデル（頭の id）・声・口数・話し始め・hotwords・体を持つ（stream-restructure.md §2）。
 *
 *  - 起動時: ロールの置き場（roles/）を読み、設定の `roleChoice` のロールを選ぶ。無ければ（引っ越し直後など）
 *    今までの頭の選択（`brainChoice`）の系統で選ぶ（GPT 系 → chappy、それ以外・未記憶 → cody＝今までの既定）。
 *    それも無ければ id の順で最初のロール。ロールが 1 つも読めなければ、こーでぃーの名前の既定のロールを
 *    手元だけに持つ（置き場には書かない＝`roles/` を作らないので、次の起動で引っ越しがもう一度走れる）。
 *  - select(id): 置き場から読み直して今のロールにし、`roleChoice` に覚える（失敗寛容）。読めなければ ok:false。
 *  - update(patch): 今のロールの持ち物を書き換えて role.json に書く（手元だけの既定のロールは書かない・失敗寛容）。
 *  - edit(patch) / create({ id, name }): 配信の組み直し Domain E のロールの編集・今のロールを写して新しいロール（画面の
 *    ロールのタブ）。厳しく確かめ（role-store の applyRolePatch / copyRoleAs）、書き込みの失敗は投げる。手元だけの既定の
 *    ロールでは断る（roles/ を作ると次の起動の引っ越しが走らなくなるため）。
 *  - roleSettings: 口数・話し始め・声の方式の hooks（createVerbosityHooks / createSpeakStartHooks /
 *    createTtsEngineHooks）へ、設定の代わりに渡す読み書きの口（値の出どころを設定 → ロールに替える）。
 *
 * @param {object} options
 * @param {string} options.rolesDir
 * @param {{ getRoleChoice?: () => string | null; setRoleChoice?: (id: string | null) => void;
 *   getBrainChoice?: () => string | null }} options.settings
 * @param {(role: any) => any} [options.writeRoleImpl]  テスト注入（既定 role-store の writeRole）。
 */
export function createRoleHooks(options) {
  const rolesDir = options.rolesDir;
  const settings = options.settings;
  const writeRoleImpl = options.writeRoleImpl ?? ((/** @type {any} */ role) => writeRole({ dir: rolesDir, role }));
  // 性格の指示の写し（新しいロールを作るとき）。上書きが無ければ null（写さない＝既定の本文）。
  const readInstructionsImpl = (/** @type {string} */ id) => readRoleInstructions({ dir: rolesDir, id }).override;
  const writeInstructionsImpl = (/** @type {string} */ id, /** @type {string} */ text) =>
    writeRoleInstructions({ dir: rolesDir, id, text });
  /** @type {Array<Readonly<import("./role-store.mjs").Role>>} */
  let roles = listRoles({ dir: rolesDir }).roles;
  const call = (/** @type {() => any} */ fn) => {
    try {
      return fn();
    } catch {
      return null;
    }
  };
  const pickInitial = () => {
    const byId = (/** @type {unknown} */ id) => roles.find((role) => role.id === id) ?? null;
    const remembered = byId(call(() => settings.getRoleChoice?.()));
    if (remembered) return remembered;
    const legacyBrain = call(() => settings.getBrainChoice?.());
    const family = byId(isCodexBrainId(legacyBrain) ? "chappy" : "cody");
    return family ?? roles[0] ?? null;
  };
  const initial = pickInitial();
  /** 置き場から読んだロールか（手元だけの既定のロールは書かない）。 */
  let persisted = initial != null;
  let current = initial ?? roleFromIdentity(MODEL_IDENTITIES.cody);

  /** @param {Record<string, unknown>} patch */
  const update = (patch) => {
    const next = normalizeRole(current.id, { ...roleToJson(current), ...patch });
    if (persisted) {
      try {
        writeRoleImpl(next);
      } catch {
        // 書き込みの失敗は操作を止めない（設定の set と同じ失敗寛容）。
      }
    }
    current = next;
    roles = roles.map((role) => (role.id === next.id ? next : role));
    return current;
  };

  return {
    /** @param {string | undefined} id @param {string | undefined} model */
    resolveForVenue(id, model) {
      const selected = id === undefined ? { ok: true, role: current } : readRole({ dir: rolesDir, id });
      if (!selected.ok || !("role" in selected)) return null;
      const role = selected.role;
      return model === undefined ? role : Object.freeze({ ...role, brain: model });
    },
    /** 今のロール（凍っている）。 */
    current: () => current,
    currentId: () => current.id,
    /** 今のロールの名前（発火の指示・whisper・呼びかけ・snapshot が読む）。 */
    identity: () => roleIdentity(current),
    /** 置き場から読んだロールか。 */
    isPersisted: () => persisted,
    /** 選べるロールの一覧（id・見せる名前・動かす頭の id だけ）。 */
    list: () => roles.map((role) => ({ id: role.id, displayName: role.name.display, brain: role.brain })),
    /** 置き場にあるロールの id（会話指示の API が知っている id）。 */
    knownIds: () => roles.map((role) => role.id),
    /**
     * @param {string} id
     * @returns {{ ok: true; role: Readonly<import("./role-store.mjs").Role> } | { ok: false; reason: string }}
     */
    select(id) {
      const read = readRole({ dir: rolesDir, id });
      if (!read.ok) return { ok: false, reason: `ロール ${id} を読めない（${read.reason}）` };
      roles = listRoles({ dir: rolesDir }).roles;
      current = read.role;
      persisted = true;
      call(() => settings.setRoleChoice?.(id)); // 次回起動で復元（file-backed・失敗寛容）。
      return { ok: true, role: current };
    },
    update,
    /**
     * 今のロールを編集する（配信の組み直し Domain E・POST /api/role/edit）。update と違い、書き換えを厳しく確かめ
     * （applyRolePatch）、書き込みの失敗は投げる（API の 500）。置き場から読んだロールでなければ断る（手元だけの既定の
     * ロールを書くと roles/ ができて、次の起動の引っ越しが走らなくなるため）。
     * @param {unknown} patch
     * @returns {{ ok: true; role: Readonly<import("./role-store.mjs").Role> } | { ok: false; reason: string }}
     */
    edit(patch) {
      if (!persisted) return { ok: false, reason: "ロールの置き場が無い（引っ越しに失敗した起動ではロールを編集できない）" };
      const applied = applyRolePatch(current, patch);
      if (!applied.ok) return applied;
      writeRoleImpl(applied.role);
      current = applied.role;
      roles = roles.map((role) => (role.id === current.id ? current : role));
      return { ok: true, role: current };
    },
    /**
     * 今のロールを写して新しいロールを作る（配信の組み直し Domain E・POST /api/role/new）。モデル・声・口数・話し始め・
     * 体と性格の指示（instructions.md の上書き）を写し、名前は新しい名前にする。選ぶのは呼び出し側（select）。
     * 同じ id のロールがあれば断る。書き込みの失敗は投げる。
     * @param {{ id: string; name?: string | null }} input
     * @returns {{ ok: true; role: Readonly<import("./role-store.mjs").Role> } | { ok: false; reason: string; conflict?: boolean }}
     */
    create(input) {
      if (!persisted) return { ok: false, reason: "ロールの置き場が無い（引っ越しに失敗した起動ではロールを作れない）" };
      const copied = copyRoleAs(current, { id: input.id, name: input.name ?? null });
      if (!copied.ok) return copied;
      const exists = roles.some((role) => role.id === copied.role.id) || readRole({ dir: rolesDir, id: copied.role.id }).ok;
      if (exists) return { ok: false, reason: `ロール ${copied.role.id} はもうある`, conflict: true };
      writeRoleImpl(copied.role);
      const instructions = readInstructionsImpl(current.id);
      if (instructions != null) writeInstructionsImpl(copied.role.id, instructions);
      roles = listRoles({ dir: rolesDir }).roles;
      if (!roles.some((role) => role.id === copied.role.id)) roles = [...roles, copied.role];
      return { ok: true, role: copied.role };
    },
    roleSettings: {
      getVerbosityMode: () => current.verbosity,
      setVerbosityMode: (/** @type {string | null} */ mode) => void update({ verbosity: mode }),
      getSpeakStartMode: () => current.speakStartMode,
      setSpeakStartMode: (/** @type {string | null} */ mode) => void update({ speakStartMode: mode }),
      getTtsEngine: () => current.voice.engine,
      setTtsEngine: (/** @type {string | null} */ engine) => void update({ voice: { ...current.voice, engine } })
    }
  };
}

/**
 * ロールの編集と新しいロールの口（配信の組み直し Domain E・cockpit-server の onUpdateRole / onCreateRole）。
 * 場が閉じている間だけ呼ばれる（cockpit-server が場の途中は 409 で断る・stream-restructure.md §2.1・§3）。
 *
 *  - onUpdateRole(patch): 今のロールを編集する（roleHooks.edit）。編集できたら onRoleEdited（main() が頭・声の方式を
 *    今のロールに揃え、頭の文脈の revision を進める＝次のセッションは新しい名前・モデル・体で作る）を呼び、口数・
 *    話し始め・声の方式を返す（POST /api/role と同じ形・サーバの scheduler と Start の既定に入れる）。書き込みの失敗は投げる。
 *  - onCreateRole({ id, name }): 今のロールを写して新しいロールを作り（roleHooks.create）、そのロールを選ぶ（selectRole =
 *    main() の onSetRole・POST /api/role と同じ道）。
 *
 * @param {object} deps
 * @param {{ edit: (patch: unknown) => any; create: (input: { id: string; name?: string | null }) => any }} deps.roleHooks
 * @param {(role: any) => void} deps.onRoleEdited
 * @param {(id: string) => any} deps.selectRole
 */
export function createRoleEditHooks(deps) {
  return {
    /** @param {unknown} patch */
    onUpdateRole(patch) {
      const result = deps.roleHooks.edit(patch);
      if (!result || result.ok !== true) return result;
      const role = result.role;
      deps.onRoleEdited(role);
      return { ok: true, verbosity: role.verbosity, speakStartMode: role.speakStartMode, ttsEngine: role.voice.engine };
    },
    /** @param {{ id: string; name?: string | null }} input */
    async onCreateRole(input) {
      const created = deps.roleHooks.create(input);
      if (!created || created.ok !== true) return created;
      return deps.selectRole(created.role.id);
    }
  };
}

/**
 * ロールの声を声の engine の deps にする（配信の組み直し Domain A）。AivisSpeech の話者は起動引数 `--speaker` が
 * あればそれ（ロールの値を上書きする）、無ければロールの値、それも無ければ undefined（tts-client の既定の話者）。
 * ElevenLabs の声の id はロールの値（無ければ undefined = engine の既定の声）。
 * @param {{ voice: { aivisSpeaker: number | null; elevenLabsVoiceId: string | null } }} role
 * @param {{ speaker?: string }} args
 * @returns {{ speaker: string | number | undefined; voiceId: string | undefined }}
 */
export function resolveRoleVoice(role, args) {
  const speaker = args.speaker != null && args.speaker !== "" ? args.speaker : (role.voice.aivisSpeaker ?? undefined);
  return { speaker, voiceId: role.voice.elevenLabsVoiceId ?? undefined };
}

/**
 * ローカルの文字起こしの設定に、ロールの hotwords を重ねる（配信の組み直し Domain A）。ロールが hotwords を
 * 持っていればそれ（空の配列 = hotwords なし）、null なら設定ファイルの値か既定のまま。
 * @param {any} localStt  settings.getLocalStt() の値。
 * @param {{ nameHints: { hotwords: ReadonlyArray<string> | null } }} role
 */
export function applyRoleHotwords(localStt, role) {
  const hotwords = role.nameHints.hotwords;
  if (hotwords == null) return localStt;
  return { ...(localStt && typeof localStt === "object" ? localStt : {}), hotwords: [...hotwords] };
}
