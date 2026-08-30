// @ts-check
/**
 * Pure state/HTTP helpers for the Cockpit conversation-instruction editor.
 *
 * The editor deliberately owns no identity or prompt composition knowledge.
 * It only consumes the dedicated Cockpit API and keeps one draft baseline per
 * technical brain.  The controller is injected with fetch and a change hook,
 * making all tests fake-only and keeping stale responses out of the UI.
 */

import { BRAIN_LABELS } from "./health.mjs";

/** @type {ReadonlyArray<string>} */
export const CONVERSATION_INSTRUCTION_BRAIN_IDS = Object.freeze([
  "claude",
  "codex",
  "codex-55",
  "codex-56-sol"
]);

/** @type {ReadonlyArray<{ value: string; label: string }>} */
export const CONVERSATION_INSTRUCTION_BRAIN_OPTIONS = Object.freeze(
  CONVERSATION_INSTRUCTION_BRAIN_IDS.map((value) => ({ value, label: BRAIN_LABELS[value] }))
);

/**
 * Resolve the read-only identity displayed for the selected editor profile.
 * The runtime-provided identity is used only when the selected technical
 * brain is active. The dedicated instruction API intentionally does not
 * expose identity for other profiles, so the UI returns null there instead
 * of inventing a second brain→identity table or showing a false active name.
 * @param {{ brainId: string; activeBrainId?: string | null; activeIdentity?: any }} input
 * @returns {{ id: string; displayName: string } | null}
 */
export function conversationBrainIdentity({ brainId, activeBrainId, activeIdentity }) {
  if (
    brainId === activeBrainId &&
    activeIdentity &&
    typeof activeIdentity === "object" &&
    typeof activeIdentity.id === "string" &&
    typeof activeIdentity.displayName === "string" &&
    activeIdentity.displayName
  ) {
    return { id: activeIdentity.id, displayName: activeIdentity.displayName };
  }
  return null;
}

/** @param {unknown} value @returns {boolean} */
export function isConversationInstructionBrainId(value) {
  return typeof value === "string" && CONVERSATION_INSTRUCTION_BRAIN_IDS.includes(value);
}

/** @param {string} brainId @returns {string} */
export function conversationInstructionPath(brainId) {
  return "/api/conversation-instructions/" + encodeURIComponent(brainId);
}

/**
 * @param {unknown} body
 * @param {string} brainId
 * @returns {{ brainId: string; instruction: string; isOverride: boolean; revision: number | null } | null}
 */
export function parseConversationInstructionResponse(body, brainId) {
  if (!body || typeof body !== "object") return null;
  const value = /** @type {any} */ (body);
  if (
    value.ok !== true ||
    value.brainId !== brainId ||
    typeof value.instruction !== "string" ||
    value.instruction.trim().length === 0
  ) return null;
  if (typeof value.isOverride !== "boolean") return null;
  if (typeof value.revision !== "number" || !Number.isFinite(value.revision)) return null;
  const revision = value.revision;
  return {
    brainId,
    instruction: value.instruction,
    isOverride: value.isOverride,
    revision
  };
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
 * A small per-brain editor controller. Every async operation is associated
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

  const entryFor = (brainId) => {
    if (!entries.has(brainId)) entries.set(brainId, emptyEntry());
    return entries.get(brainId);
  };
  const notify = () => onChange();
  const valid = (brainId) => isConversationInstructionBrainId(brainId);
  const responseError = (response, fallback) => {
    const status = response && typeof response.status === "number" ? response.status : 0;
    if (status === 400) return "会話指示のリクエストが不正です";
    if (status === 404) return "指定した頭脳の会話指示が見つかりません";
    return fallback;
  };

  /** @param {string} brainId */
  const load = async (brainId) => {
    if (!valid(brainId)) return { ok: false, error: "指定できない頭脳です" };
    const entry = entryFor(brainId);
    const seq = entry.requestSeq + 1;
    entry.requestSeq = seq;
    entry.status = "loading";
    entry.error = "";
    notify();
    try {
      const response = await fetchImpl(conversationInstructionPath(brainId));
      const body = await response.json();
      const parsed = parseConversationInstructionResponse(body, brainId);
      if (entry.requestSeq !== seq) return { ok: false, stale: true };
      if (!response.ok || !parsed) {
        entry.status = "error";
        entry.error = responseError(response, "会話指示を読み込めませんでした");
        notify();
        return { ok: false, error: entry.error };
      }
      const editedDuringLoad = entry.dirty;
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

  /** @param {string} brainId @param {string} value */
  const edit = (brainId, value) => {
    if (!valid(brainId)) return false;
    const entry = entryFor(brainId);
    entry.draft = typeof value === "string" ? value : "";
    entry.dirty = entry.draft !== entry.saved;
    if (entry.status !== "loading" && entry.status !== "saving" && entry.status !== "resetting") {
      entry.status = entry.dirty ? "idle" : (entry.isOverride ? "saved" : "default");
      entry.error = "";
    }
    notify();
    return true;
  };

  /** @param {string} brainId */
  const save = async (brainId) => {
    if (!valid(brainId)) return { ok: false, error: "指定できない頭脳です" };
    const entry = entryFor(brainId);
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
      const response = await fetchImpl(conversationInstructionPath(brainId), {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ instruction: valueAtStart })
      });
      const body = await response.json();
      const parsed = parseConversationInstructionResponse(body, brainId);
      if (entry.requestSeq !== seq) return { ok: false, stale: true };
      if (!response.ok || !parsed) {
        entry.status = "error";
        entry.error = responseError(response, "会話指示を保存できませんでした");
        notify();
        return { ok: false, error: entry.error };
      }
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

  /** @param {string} brainId */
  const reset = async (brainId) => {
    if (!valid(brainId)) return { ok: false, error: "指定できない頭脳です" };
    const entry = entryFor(brainId);
    const seq = entry.requestSeq + 1;
    entry.requestSeq = seq;
    const valueAtStart = entry.draft;
    entry.status = "resetting";
    entry.error = "";
    notify();
    try {
      const response = await fetchImpl(conversationInstructionPath(brainId), { method: "DELETE" });
      const body = await response.json();
      const parsed = parseConversationInstructionResponse(body, brainId);
      if (entry.requestSeq !== seq) return { ok: false, stale: true };
      if (!response.ok || !parsed) {
        entry.status = "error";
        entry.error = responseError(response, "既定の会話指示へ戻せませんでした");
        notify();
        return { ok: false, error: entry.error };
      }
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

  /** @param {string} brainId */
  const discard = (brainId) => {
    if (!valid(brainId)) return false;
    const entry = entryFor(brainId);
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
    getState(brainId) {
      if (!valid(brainId)) return Object.freeze({ ...emptyEntry(), brainId, error: "指定できない頭脳です" });
      return { brainId, ...entryFor(brainId) };
    },
    isDirty(brainId) {
      return valid(brainId) ? !!entryFor(brainId).dirty : false;
    }
  });
}
