// @ts-check
/**
 * Pure state/HTTP helpers for the Cockpit conversation-instruction editor.
 *
 * The editor deliberately owns no identity or prompt composition knowledge.
 * It only consumes the dedicated Cockpit API and keeps one draft baseline per
 * role. 配信の組み直し Domain A: 会話指示はロールの性格の指示（roles/<id>/instructions.md）になり、鍵は
 * 頭の id からロールの id に替わった（応答の `roleId`）。The controller is injected with fetch and a change
 * hook, making all tests fake-only and keeping stale responses out of the UI.
 */

/**
 * ロールの id の形（model-identity.mjs の ROLE_ID_PATTERN の写し・view-logic は mind を import しない決まり）。
 */
export const CONVERSATION_INSTRUCTION_ROLE_ID_PATTERN = /^[a-z][a-z0-9-]{0,31}$/;

/** @param {unknown} value @returns {boolean} */
export function isConversationInstructionRoleId(value) {
  return typeof value === "string" && CONVERSATION_INSTRUCTION_ROLE_ID_PATTERN.test(value);
}

/**
 * snapshot の `role`（`{ id, displayName, brain, roles: [{ id, displayName, brain }] }`）から、ロールの select の
 * 選択肢を作る（形の違う要素は落とす・見せる名前が無ければ id）。
 * @param {unknown} roleStatus
 * @returns {Array<{ value: string; label: string; brain: string | null }>}
 */
export function roleOptionsView(roleStatus) {
  const list = roleStatus && typeof roleStatus === "object" ? /** @type {any} */ (roleStatus).roles : null;
  if (!Array.isArray(list)) return [];
  return list
    .filter((item) => item && typeof item === "object" && isConversationInstructionRoleId(item.id))
    .map((item) => ({
      value: item.id,
      label: typeof item.displayName === "string" && item.displayName.trim() ? item.displayName : item.id,
      brain: typeof item.brain === "string" ? item.brain : null
    }));
}

/**
 * 今のロール（snapshot の `role`）の id と見せる名前。読めなければ null。
 * @param {unknown} roleStatus
 * @returns {{ id: string; displayName: string; brain: string | null } | null}
 */
export function currentRoleView(roleStatus) {
  if (!roleStatus || typeof roleStatus !== "object") return null;
  const value = /** @type {any} */ (roleStatus);
  if (!isConversationInstructionRoleId(value.id)) return null;
  return {
    id: value.id,
    displayName: typeof value.displayName === "string" && value.displayName.trim() ? value.displayName : value.id,
    brain: typeof value.brain === "string" ? value.brain : null
  };
}

/** @param {string} roleId @returns {string} */
export function conversationInstructionPath(roleId) {
  return "/api/conversation-instructions/" + encodeURIComponent(roleId);
}

/**
 * @param {unknown} body
 * @param {string} roleId
 * @returns {{ roleId: string; instruction: string; isOverride: boolean; revision: number | null } | null}
 */
export function parseConversationInstructionResponse(body, roleId) {
  if (!body || typeof body !== "object") return null;
  const value = /** @type {any} */ (body);
  if (
    value.ok !== true ||
    value.roleId !== roleId ||
    typeof value.instruction !== "string" ||
    value.instruction.trim().length === 0
  ) return null;
  if (typeof value.isOverride !== "boolean") return null;
  if (typeof value.revision !== "number" || !Number.isFinite(value.revision)) return null;
  const revision = value.revision;
  return {
    roleId,
    instruction: value.instruction,
    isOverride: value.isOverride,
    revision
  };
}

/**
 * 魂がいつも足す教えの表示名（記憶の作り直し Wave 3 仕上げ・UI は mind を import しない）。未知の名前は「教え「名前」」。
 */
export const SOUL_SKILL_LABELS = Object.freeze({
  expression: "表情タグの教え",
  screen: "画面の教え",
  recall: "思い出す教え"
});

/**
 * API の応答の soulSkills（魂が①の固定の指示にいつも足す教え）を読む。配列でなければ null（応答に無い）。
 * 形の違う要素・本文が空の要素は落とす。
 * @param {unknown} value
 * @returns {Array<{ name: string; path: string; body: string }> | null}
 */
export function parseSoulSkills(value) {
  if (!Array.isArray(value)) return null;
  return value
    .filter(
      (skill) =>
        skill &&
        typeof skill === "object" &&
        typeof skill.name === "string" &&
        typeof skill.path === "string" &&
        typeof skill.body === "string" &&
        skill.body.trim().length > 0
    )
    .map((skill) => ({ name: skill.name, path: skill.path, body: skill.body }));
}

/**
 * 教え 1 つの案内文（「このほかに、思い出す教え（skills/recall.md）がいつも足されています」）。
 * @param {{ name: string; path: string }} skill
 * @returns {string}
 */
export function soulSkillNoticeText(skill) {
  const name = skill && typeof skill.name === "string" ? skill.name : "";
  const label = /** @type {Record<string, string>} */ (SOUL_SKILL_LABELS)[name] ?? "教え「" + name + "」";
  const path = skill && typeof skill.path === "string" && skill.path.length > 0 ? "（" + skill.path + "）" : "";
  return "このほかに、" + label + path + "がいつも足されています";
}

/** @param {string} instruction @returns {string | null} */
export function conversationInstructionInputError(instruction) {
  return typeof instruction !== "string" || instruction.trim().length === 0
    ? "会話指示を入力してください（空にする場合は「既定へ戻す」を使ってください）"
    : null;
}

/**
 * @param {any} state
 * @returns {{ text: string; className: string; live: "polite" | "assertive" }}
 */
export function conversationInstructionStatusView(state) {
  const current = state || {};
  if (current.status === "loading") return { text: "会話指示を読み込み中…", className: "loading", live: "polite" };
  if (current.status === "saving") return { text: "保存中…", className: "saving", live: "polite" };
  if (current.status === "resetting") return { text: "既定へ戻しています…", className: "resetting", live: "polite" };
  if (current.status === "error") return { text: current.error || "会話指示の更新に失敗しました", className: "error", live: "assertive" };
  if (current.dirty) return { text: "未保存の変更があります。", className: "dirty", live: "polite" };
  if (current.status === "saved") {
    return {
      text: "保存しました。次のFireから反映されます。",
      className: "saved next-fire",
      live: "polite"
    };
  }
  if (current.status === "default") {
    return {
      text: "既定の会話指示です。次のFireから反映されます。",
      className: "default next-fire",
      live: "polite"
    };
  }
  if (current.loaded) return { text: "現在の会話指示", className: "loaded", live: "polite" };
  return { text: "会話指示を読み込んでください", className: "idle", live: "polite" };
}

/** @returns {any} */
function emptyEntry() {
  return {
    loaded: false,
    draft: "",
    saved: "",
    isOverride: false,
    revision: null,
    status: "idle",
    error: "",
    dirty: false,
    requestSeq: 0
  };
}

/**
 * A small per-role editor controller. Every async operation is associated
 * with a monotonically increasing request sequence. A response may update
 * only its own brain and only when it is still the latest operation. A user
 * edit made while a request is pending is retained while the server baseline
 * is updated from the response.
 *
 * @param {{ fetchImpl?: any; onChange?: () => void }} [options]
 */
export function createConversationInstructionController(options = {}) {
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const onChange = typeof options.onChange === "function" ? options.onChange : () => {};
  /** @type {Map<string, any>} */
  const entries = new Map();
  /**
   * 魂がいつも足す教え（頭に関係なく同じ・最後に受け取った応答の値）。応答に無ければ前の値のまま。
   * @type {Array<{ name: string; path: string; body: string }>}
   */
  let soulSkills = [];
  /** @param {any} body */
  const takeSoulSkills = (body) => {
    const parsed = parseSoulSkills(body && typeof body === "object" ? body.soulSkills : undefined);
    if (parsed) soulSkills = parsed;
  };

  const entryFor = (roleId) => {
    if (!entries.has(roleId)) entries.set(roleId, emptyEntry());
    return entries.get(roleId);
  };
  const notify = () => onChange();
  const valid = (roleId) => isConversationInstructionRoleId(roleId);
  const responseError = (response, fallback) => {
    const status = response && typeof response.status === "number" ? response.status : 0;
    if (status === 400) return "会話指示のリクエストが不正です";
    if (status === 404) return "指定したロールの会話指示が見つかりません";
    return fallback;
  };

  /** @param {string} roleId */
  const load = async (roleId) => {
    if (!valid(roleId)) return { ok: false, error: "指定できないロールです" };
    const entry = entryFor(roleId);
    const seq = entry.requestSeq + 1;
    entry.requestSeq = seq;
    entry.status = "loading";
    entry.error = "";
    notify();
    try {
      const response = await fetchImpl(conversationInstructionPath(roleId));
      const body = await response.json();
      const parsed = parseConversationInstructionResponse(body, roleId);
      if (entry.requestSeq !== seq) return { ok: false, stale: true };
      if (!response.ok || !parsed) {
        entry.status = "error";
        entry.error = responseError(response, "会話指示を読み込めませんでした");
        notify();
        return { ok: false, error: entry.error };
      }
      const editedDuringLoad = entry.dirty;
      takeSoulSkills(body);
      entry.loaded = true;
      entry.saved = parsed.instruction;
      entry.isOverride = parsed.isOverride;
      entry.revision = parsed.revision;
      // Never discard a text edit made while GET was pending.
      if (!editedDuringLoad) entry.draft = parsed.instruction;
      entry.dirty = entry.draft !== entry.saved;
      entry.status = entry.dirty ? "idle" : (parsed.isOverride ? "saved" : "default");
      entry.error = "";
      notify();
      return { ok: true, stale: false, ...parsed };
    } catch (error) {
      if (entry.requestSeq !== seq) return { ok: false, stale: true };
      entry.status = "error";
      entry.error = "会話指示の読み込みに失敗しました: " + String(error);
      notify();
      return { ok: false, error: entry.error };
    }
  };

  /** @param {string} roleId @param {string} value */
  const edit = (roleId, value) => {
    if (!valid(roleId)) return false;
    const entry = entryFor(roleId);
    entry.draft = typeof value === "string" ? value : "";
    entry.dirty = entry.draft !== entry.saved;
    if (entry.status !== "loading" && entry.status !== "saving" && entry.status !== "resetting") {
      entry.status = entry.dirty ? "idle" : (entry.isOverride ? "saved" : "default");
      entry.error = "";
    }
    notify();
    return true;
  };

  /** @param {string} roleId */
  const save = async (roleId) => {
    if (!valid(roleId)) return { ok: false, error: "指定できないロールです" };
    const entry = entryFor(roleId);
    const inputError = conversationInstructionInputError(entry.draft);
    if (inputError) {
      entry.status = "error";
      entry.error = inputError;
      notify();
      return { ok: false, error: inputError, local: true };
    }
    const seq = entry.requestSeq + 1;
    entry.requestSeq = seq;
    const valueAtStart = entry.draft;
    entry.status = "saving";
    entry.error = "";
    notify();
    try {
      const response = await fetchImpl(conversationInstructionPath(roleId), {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ instruction: valueAtStart })
      });
      const body = await response.json();
      const parsed = parseConversationInstructionResponse(body, roleId);
      if (entry.requestSeq !== seq) return { ok: false, stale: true };
      if (!response.ok || !parsed) {
        entry.status = "error";
        entry.error = responseError(response, "会話指示を保存できませんでした");
        notify();
        return { ok: false, error: entry.error };
      }
      takeSoulSkills(body);
      entry.loaded = true;
      entry.saved = parsed.instruction;
      entry.isOverride = parsed.isOverride;
      entry.revision = parsed.revision;
      // If the user typed while PUT was pending, keep that newer text and
      // leave the editor dirty for an explicit second save.
      entry.dirty = entry.draft !== entry.saved;
      entry.status = entry.dirty ? "idle" : "saved";
      entry.error = "";
      notify();
      return { ok: true, stale: false, ...parsed };
    } catch (error) {
      if (entry.requestSeq !== seq) return { ok: false, stale: true };
      entry.status = "error";
      entry.error = "会話指示の保存に失敗しました: " + String(error);
      notify();
      return { ok: false, error: entry.error };
    }
  };

  /** @param {string} roleId */
  const reset = async (roleId) => {
    if (!valid(roleId)) return { ok: false, error: "指定できないロールです" };
    const entry = entryFor(roleId);
    const seq = entry.requestSeq + 1;
    entry.requestSeq = seq;
    const valueAtStart = entry.draft;
    entry.status = "resetting";
    entry.error = "";
    notify();
    try {
      const response = await fetchImpl(conversationInstructionPath(roleId), { method: "DELETE" });
      const body = await response.json();
      const parsed = parseConversationInstructionResponse(body, roleId);
      if (entry.requestSeq !== seq) return { ok: false, stale: true };
      if (!response.ok || !parsed) {
        entry.status = "error";
        entry.error = responseError(response, "既定の会話指示へ戻せませんでした");
        notify();
        return { ok: false, error: entry.error };
      }
      takeSoulSkills(body);
      entry.loaded = true;
      entry.saved = parsed.instruction;
      entry.isOverride = parsed.isOverride;
      entry.revision = parsed.revision;
      // A concurrent edit must survive reset just as it survives save.
      entry.dirty = entry.draft !== entry.saved;
      if (entry.draft === valueAtStart) entry.draft = parsed.instruction;
      entry.dirty = entry.draft !== entry.saved;
      entry.status = entry.dirty ? "idle" : "default";
      entry.error = "";
      notify();
      return { ok: true, stale: false, ...parsed };
    } catch (error) {
      if (entry.requestSeq !== seq) return { ok: false, stale: true };
      entry.status = "error";
      entry.error = "既定の会話指示へ戻す処理に失敗しました: " + String(error);
      notify();
      return { ok: false, error: entry.error };
    }
  };

  /** @param {string} roleId */
  const discard = (roleId) => {
    if (!valid(roleId)) return false;
    const entry = entryFor(roleId);
    entry.draft = entry.saved;
    entry.dirty = false;
    entry.status = entry.isOverride ? "saved" : "default";
    entry.error = "";
    notify();
    return true;
  };

  return Object.freeze({
    load,
    edit,
    save,
    reset,
    discard,
    getState(roleId) {
      if (!valid(roleId)) return Object.freeze({ ...emptyEntry(), roleId, error: "指定できないロールです" });
      return { roleId, ...entryFor(roleId) };
    },
    isDirty(roleId) {
      return valid(roleId) ? !!entryFor(roleId).dirty : false;
    },
    /** 魂がいつも足す教え（読むだけの表示用・編集の口は無い）。 */
    getSoulSkills() {
      return soulSkills.map((skill) => ({ ...skill }));
    }
  });
}
