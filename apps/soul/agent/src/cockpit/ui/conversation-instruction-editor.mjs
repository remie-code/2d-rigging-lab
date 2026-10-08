// @ts-check
/** Stateless UI for the per-brain conversation-instruction editor. */

import { html } from "../vendor/htm.preact.standalone.mjs";
import {
  CONVERSATION_INSTRUCTION_BRAIN_OPTIONS,
  conversationBrainIdentity,
  conversationInstructionStatusView
} from "../view-logic/conversation-instruction.mjs";
import { memoryStatusLabel } from "../view-logic/settings.mjs";

/** @param {any} identity @returns {string} */
export function conversationIdentityDisplay(identity, active = true) {
  return identity && typeof identity.displayName === "string" && identity.displayName
    ? identity.displayName
    : (active ? "未取得" : "非アクティブ（identity は表示しません）");
}

/** @param {any} memory @returns {string} */
export function conversationMemoryStructureLabel(memory) {
  return memory ? memoryStatusLabel(memory) : "記憶の状態は未取得";
}

/**
 * @param {{ brainId: string; brainLabel: string; identity?: any; activeBrainId?: string | null; memory?: any; state: any;
 *   onBrainChange?: (ev: any) => void; onBack?: () => void; onEdit?: (ev: any) => void;
 *   onSave?: () => void; onReset?: () => void }} props
 */
export function ConversationInstructionEditor({
  brainId,
  brainLabel,
  identity,
  activeBrainId,
  memory,
  state,
  onBrainChange,
  onBack,
  onEdit,
  onSave,
  onReset
}) {
  const currentState = state || { draft: "", status: "idle", dirty: false };
  const status = conversationInstructionStatusView(currentState);
  const busy = ["loading", "saving", "resetting"].includes(currentState.status);
  const revisionText = typeof currentState.revision === "number" ? `revision ${currentState.revision}` : "revision 未取得";
  const selectedIdentity = conversationBrainIdentity({ brainId, activeBrainId, activeIdentity: identity });
  const identityIsActive = brainId === activeBrainId;
  return html`
    <div class="conversation-instruction-editor" data-conversation-instruction-editor>
      <div class="conversation-instruction-editor-head">
        <button type="button" class="conversation-instruction-back" aria-label="頭脳・会話へ戻る" onClick=${onBack}>
          ← 頭脳・会話
        </button>
        <h3>会話指示</h3>
      </div>
      <div class="conversation-instruction-selection">
        <label for="conversation-instruction-brain">技術頭脳</label>
        <select
          id="conversation-instruction-brain"
          aria-label="会話指示を編集する頭脳"
          value=${brainId}
          onChange=${onBrainChange}
          disabled=${busy}
        >
          ${CONVERSATION_INSTRUCTION_BRAIN_OPTIONS.map((option) => html`
            <option key=${option.value} value=${option.value}>${option.label}</option>
          `)}
        </select>
      </div>
      <p class="conversation-instruction-technical-label">技術ラベル: ${brainLabel || "unknown"}</p>
      <dl class="conversation-instruction-managed" aria-label="システム管理の読み取り専用情報">
        <div>
          <dt>システム管理の識別</dt>
          <dd>${conversationIdentityDisplay(selectedIdentity, identityIsActive)}</dd>
        </div>
        <div>
          <dt>システム管理の記憶構造</dt>
          <dd>${conversationMemoryStructureLabel(memory)}</dd>
        </div>
      </dl>
      <p class="conversation-instruction-readonly-note">識別名と記憶構造はシステム管理（読み取り専用）です。記憶本文は表示しません。</p>
      <p class="conversation-instruction-revision" aria-label="会話指示の適用状態">
        適用状態: ${currentState.isOverride ? "この頭脳の保存済み上書き" : "既定"}（${revisionText}）
      </p>
      <label for="conversation-instruction-body">会話指示本文</label>
      <textarea
        id="conversation-instruction-body"
        aria-label="会話指示本文"
        rows="10"
        value=${currentState.draft || ""}
        onInput=${onEdit}
        disabled=${busy && currentState.status !== "saving"}
      ></textarea>
      <div class="conversation-instruction-status" role="status" aria-live=${status.live} data-status=${status.className}>
        <span>${status.text}</span>
      </div>
      <div class="conversation-instruction-actions">
        <button type="button" class="conversation-instruction-reset" onClick=${onReset} disabled=${busy}>
          既定へ戻す
        </button>
        <button type="button" class="conversation-instruction-save" onClick=${onSave} disabled=${busy || !currentState.dirty}>
          保存して次のFireから反映
        </button>
      </div>
    </div>
  `;
}
