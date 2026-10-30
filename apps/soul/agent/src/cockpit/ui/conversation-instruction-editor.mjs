// @ts-check
/**
 * Stateless UI for the conversation-instruction editor.
 *
 * 配信の組み直し Domain A: 会話指示は今のロールの性格の指示（roles/<id>/instructions.md）。編集するのは今の
 * ロールだけ（頭ごとの select はやめた）。ロールの名前と動かすモデルは読むだけで見せる。
 */

import { html } from "../vendor/htm.preact.standalone.mjs";
import { conversationInstructionStatusView, soulSkillNoticeText } from "../view-logic/conversation-instruction.mjs";

/**
 * soulSkills（記憶の作り直し Wave 3 仕上げ）: 魂が①の固定の指示にいつも足す教え（skills/）。会話指示とは別に足される
 * ことを案内し、本文を読むだけで見せる（pre・編集の口は無い）。空なら何も出さない。
 * @param {{ roleId: string | null; roleName?: string | null; brainLabel?: string | null; state: any;
 *   soulSkills?: ReadonlyArray<{ name: string; path: string; body: string }>;
 *   onBack?: () => void; onEdit?: (ev: any) => void; onSave?: () => void; onReset?: () => void }} props
 */
export function ConversationInstructionEditor({
  roleId,
  roleName,
  brainLabel,
  state,
  soulSkills,
  onBack,
  onEdit,
  onSave,
  onReset
}) {
  const currentState = state || { draft: "", status: "idle", dirty: false };
  const status = conversationInstructionStatusView(currentState);
  const busy = ["loading", "saving", "resetting"].includes(currentState.status);
  const revisionText = typeof currentState.revision === "number" ? `revision ${currentState.revision}` : "revision 未取得";
  const skills = Array.isArray(soulSkills) ? soulSkills : [];
  const unavailable = !roleId;
  return html`
    <div class="conversation-instruction-editor" data-conversation-instruction-editor>
      <div class="conversation-instruction-editor-head">
        <button type="button" class="conversation-instruction-back" aria-label="頭脳・会話へ戻る" onClick=${onBack}>
          ← 頭脳・会話
        </button>
        <h3>会話指示</h3>
      </div>
      <dl class="conversation-instruction-managed" aria-label="今のロール（読み取り専用）">
        <div>
          <dt>ロール</dt>
          <dd>${roleName || roleId || "未取得"}</dd>
        </div>
        <div>
          <dt>モデル</dt>
          <dd>${brainLabel || "unknown"}</dd>
        </div>
      </dl>
      <p class="conversation-instruction-readonly-note">今のロールの性格の指示を書きます。名前とモデルはここでは変えられません（読み取り専用）。</p>
      <p class="conversation-instruction-revision" aria-label="会話指示の適用状態">
        適用状態: ${currentState.isOverride ? "このロールの保存済みの指示" : "既定"}（${revisionText}）
      </p>
      <label for="conversation-instruction-body">会話指示本文</label>
      <textarea
        id="conversation-instruction-body"
        aria-label="会話指示本文"
        rows="10"
        value=${currentState.draft || ""}
        onInput=${onEdit}
        disabled=${unavailable || (busy && currentState.status !== "saving")}
      ></textarea>
      <div class="conversation-instruction-status" role="status" aria-live=${status.live} data-status=${status.className}>
        <span>${status.text}</span>
      </div>
      <div class="conversation-instruction-actions">
        <button type="button" class="conversation-instruction-reset" onClick=${onReset} disabled=${unavailable || busy}>
          既定へ戻す
        </button>
        <button type="button" class="conversation-instruction-save" onClick=${onSave} disabled=${unavailable || busy || !currentState.dirty}>
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
