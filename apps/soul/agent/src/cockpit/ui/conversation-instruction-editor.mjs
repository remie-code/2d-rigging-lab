// @ts-check
/** Stateless UI for the per-brain conversation-instruction editor. */

import { html } from "../vendor/htm.preact.standalone.mjs";
import {
  CONVERSATION_INSTRUCTION_BRAIN_OPTIONS,
  conversationBrainIdentity,
  conversationInstructionStatusView,
  soulSkillNoticeText
} from "../view-logic/conversation-instruction.mjs";

/** @param {any} identity @returns {string} */
export function conversationIdentityDisplay(identity, active = true) {
  return identity && typeof identity.displayName === "string" && identity.displayName
    ? identity.displayName
    : (active ? "未取得" : "非アクティブ（identity は表示しません）");
}

/**
 * soulSkills（記憶の作り直し Wave 3 仕上げ）: 魂が①の固定の指示にいつも足す教え（skills/）。会話指示とは別に足される
 * ことを案内し、本文を読むだけで見せる（pre・編集の口は無い）。空なら何も出さない。
 * @param {{ brainId: string; brainLabel: string; identity?: any; activeBrainId?: string | null; state: any;
 *   soulSkills?: ReadonlyArray<{ name: string; path: string; body: string }>;
 *   onBrainChange?: (ev: any) => void; onBack?: () => void; onEdit?: (ev: any) => void;
 *   onSave?: () => void; onReset?: () => void }} props
 */
export function ConversationInstructionEditor({
  brainId,
  brainLabel,
  identity,
  activeBrainId,
  state,
  soulSkills,
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
  const skills = Array.isArray(soulSkills) ? soulSkills : [];
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
      </dl>
      <p class="conversation-instruction-readonly-note">識別名はシステム管理（読み取り専用）です。</p>
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
      ${skills.length > 0
        ? html`
            <section class="conversation-instruction-soul-skills" aria-label="魂がいつも足す教え（読み取り専用）">
              ${skills.map((skill) => html`
                <div key=${skill.name} class="conversation-instruction-soul-skill" data-soul-skill=${skill.name}>
                  <p class="conversation-instruction-soul-skill-note">${soulSkillNoticeText(skill)}</p>
                  <pre class="conversation-instruction-soul-skill-body" aria-label=${skill.path + " の本文（読み取り専用）"}>${skill.body}</pre>
                </div>
              `)}
              <p class="conversation-instruction-readonly-note">教えは会話指示とは別に魂が足します（ここでは編集できません）。</p>
            </section>
          `
        : null}
    </div>
  `;
}
