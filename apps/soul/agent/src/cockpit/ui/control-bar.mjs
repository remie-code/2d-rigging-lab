// @ts-check
/**
 * ui: 運転バー（常駐・cockpit-redesign.md §2/§7: 左 = Fire / Fire+視覚、右 = 自発トグル pill・
 * 口数モード・KILL 赤枠）。
 *
 * 現 cockpit.html の fire セクション（:217-223）+ Fire ボタン（:555-570）+ 視覚発火ボタン（:573-589）+
 * 自発トグル（:204-206 :635-652）の移植先。soul の busy 表示（soul-status :220）と fire-note（:221）も
 * 運転層としてここに常駐する。表示文字列・状態導出はすべて view-logic/control.mjs 経由
 * （ここで再実装しない・L0 裁定）。
 *
 * props 契約（app.mjs が結線する・domain-b.md §2 + design レビュー申し送り 2 の 4 点セット）:
 *  - soul:          string        SSE soul / POST fire 応答の生 state（busy disable は soulStatusView 導出）。
 *  - setSoul:       (s) => void   Fire/vision-fire 応答の state 反映（:564 :583 applySoulState 相当。
 *                    応答 j は {fired, state, reason} 形で snapshot ではない = applySnapshot に乗らない）。
 *  - fireNote:      string        fire-note 表示（SSE fire 非受理 / ボタン応答 503 / fetch 失敗）。
 *  - setFireNote:   (t) => void   同上の更新（押下時の "" クリア :557 :575 も含む）。
 *  - selfFire:      { enabled } | null  state snapshot の selfFire（null = not available）。
 *  - applySnapshot: (s) => void   POST /api/self-fire の 200 応答（snapshot 全体）の適用
 *                    （applyStateRef.current 共有・原実装 applySelfFire(res.j.selfFire) と同源の値）。
 *  - fetchImpl:     任意          fetch の注入（既定は関数実行時に globalThis.fetch を参照）。
 *
 * 自発トグルは **controlled component**（checked = state 由来・onChange = POST のみ）。原実装の
 * `selfFireSyncing` フラグ（:323 :636）は「applySelfFire の checked 書き戻しが change イベントを
 * 再発火して POST 無限ループになる」対策だったが、preact の controlled 形では programmatic な
 * checked 反映（render 時のプロパティ設定）は change イベントを発火しないため**構造的に不要**。
 * 値の流れは一方向（POST 応答 / SSE state の snapshot → settings.selfFire → checked）を保つ。
 *
 * Fire 連打防止: POST 発射中はローカル busy でボタンを disable（:556 :574 の即時 disable 相当・
 * 復帰は応答/失敗時）。busy 保護の本体は従来どおりサーバ側（orchestrator の状態機械 :787）で、
 * これは UI 側の二重 POST を避ける補助。
 *
 * 口数モード: **プルダウンの場所のみ**（控えめ/ふつう/おしゃべり・選択はローカル state に保持する
 * だけでどこにも送らない = no-op）。実配線は s6-followup §12 の将来課題（本 wave では配線しない）。
 * KILL: **枠のみ・disabled・S8 予約**（§7: 赤枠・場所だけ予約 = no-op）。
 *
 * トップレベル副作用ゼロ（export function/const のみ）。
 */

import { html, useState } from "../vendor/htm.preact.standalone.mjs";
import {
  soulStatusView,
  fireNoteFromFireResponse,
  fireRequestErrorNote,
  selfFireToggleView,
  selfFirePostErrorText,
  selfFireRequestErrorText
} from "../view-logic/control.mjs";

/** 口数モードの選択肢（場所のみ・値は固定表示・実配線は s6-followup §12 の将来課題）。 */
export const VERBOSITY_OPTIONS = [
  { value: "quiet", label: "控えめ" },
  { value: "normal", label: "ふつう" },
  { value: "chatty", label: "おしゃべり" }
];

/**
 * Fire / Fire+視覚ボタン（hooks 非使用・vnode 走査テスト対象）。
 * disable は soulStatusView の busy 導出 + ローカル連打防止の OR。
 * @param {{ soulView: { text: string; className: string; fireDisabled: boolean };
 *           localBusy: boolean; onFire: () => void; onVisionFire: () => void }} props
 */
export function FireButtons({ soulView, localBusy, onFire, onVisionFire }) {
  const disabled = soulView.fireDisabled || localBusy;
  return html`
    <button class="btn-fire" type="button" disabled=${disabled} onClick=${onFire}>🎤 Fire</button>
    <button class="btn-vision-fire" type="button" disabled=${disabled} onClick=${onVisionFire}>🖼 Fire+視覚</button>
  `;
}

/**
 * 自発トグル pill（hooks 非使用・vnode 走査テスト対象）。view は selfFireToggleView 導出済み。
 * @param {{ view: { disabled: boolean; checked: boolean; statusText: string; statusClassName: string };
 *           onChange: (ev: any) => void }} props
 */
export function SelfFirePill({ view, onChange }) {
  return html`
    <label class="self-fire-pill">
      <span class="pill-label">自発</span>
      <input
        type="checkbox"
        class="self-fire-toggle"
        disabled=${view.disabled}
        checked=${view.checked}
        onChange=${onChange}
      />
      <span class=${view.statusClassName}>${view.statusText}</span>
    </label>
  `;
}

/**
 * KILL スイッチ（枠のみ・disabled・S8 予約 = no-op。§7: 赤枠・場所だけ予約）。hooks 非使用。
 */
export function KillSwitch() {
  return html`<button class="kill-switch" type="button" disabled title="S8 で実装（場所のみ予約）">■ KILL</button>`;
}

/**
 * 運転バー本体。
 * @param {{ soul?: string; setSoul: (s: string) => void; fireNote?: string; setFireNote: (t: string) => void;
 *           selfFire?: { enabled?: boolean } | null; applySnapshot: (s: any) => void; fetchImpl?: any }} props
 */
export function ControlBar({ soul, setSoul, fireNote, setFireNote, selfFire, applySnapshot, fetchImpl }) {
  // Fire 連打防止のローカル busy（:556 :574 の即時 disable 相当・応答/失敗で復帰）。
  const [localBusy, setLocalBusy] = useState(false);
  // 自発トグルのエラー欄（旧 conversation-error :212 のうち自発系の文言。IA 再配置で運転バーに常駐）。
  const [controlError, setControlError] = useState("");
  // 口数モード（場所のみ・選択はローカル保持・どこにも送らない = no-op・s6-followup §12）。
  const [verbosity, setVerbosity] = useState("normal");

  const soulView = soulStatusView(soul);
  const sfView = selfFireToggleView(selfFire);

  /**
   * Fire / Fire+視覚の共通フロー（:555-570 / :573-589 と同順: 即時 disable → note クリア → POST →
   * 応答 note + state 反映 → 失敗 note + idle 復帰）。
   * @param {string} path  @param {"fire" | "vision"} kind
   */
  const fireWith = (path, kind) => {
    const doFetch = fetchImpl || globalThis.fetch;
    setLocalBusy(true); //  :556 :574 連打防止（復帰は下の then/catch 後）。
    setFireNote(""); //     :557 :575
    doFetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" })
      .then((/** @type {any} */ r) => r.json().then((/** @type {any} */ j) => ({ status: r.status, j })))
      .then((/** @type {any} */ res) => {
        const note = fireNoteFromFireResponse(res); // 503 / fired:false のみ非 null（:561-563 :580-582）。
        if (note != null) setFireNote(note);
        setSoul(res.j && res.j.state ? res.j.state : "idle"); // :564 :583 applySoulState 相当。
      })
      .catch((/** @type {unknown} */ e) => {
        setFireNote(fireRequestErrorNote(kind, e)); // :566-567 :585-586
        setSoul("idle");
      })
      .then(() => setLocalBusy(false));
  };

  /**
   * 自発トグル（:635-652）。controlled のため change はユーザー操作でのみ発火する
   * （programmatic 反映で POST が飛ばない = selfFireSyncing の構造的不要化）。
   * @param {any} ev
   */
  const onToggleSelfFire = (ev) => {
    const enabled = !!(ev && ev.target && ev.target.checked); // :637
    const doFetch = fetchImpl || globalThis.fetch;
    setControlError(""); // :638
    doFetch("/api/self-fire", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ enabled })
    })
      .then((/** @type {any} */ r) => r.json().then((/** @type {any} */ j) => ({ ok: r.ok, status: r.status, j })))
      .then((/** @type {any} */ res) => {
        const err = selfFirePostErrorText(res); // :645-647
        if (err != null) {
          setControlError(err);
          return;
        }
        applySnapshot(res.j); // 200 応答は snapshot 全体（原実装 applySelfFire(res.j.selfFire) と同源 :648）。
      })
      .catch((/** @type {unknown} */ e) => setControlError(selfFireRequestErrorText(e))); // :649-650
  };

  return html`
    <div class="control-bar">
      <div class="control-bar-left">
        <${FireButtons}
          soulView=${soulView}
          localBusy=${localBusy}
          onFire=${() => fireWith("/api/fire", "fire")}
          onVisionFire=${() => fireWith("/api/vision-fire", "vision")}
        />
        <span class="soul-note">soul: <span class=${soulView.className}>${soulView.text}</span></span>
        <span class="fire-note">${fireNote}</span>
      </div>
      <div class="control-bar-right">
        <span class="control-error err">${controlError}</span>
        <${SelfFirePill} view=${sfView} onChange=${onToggleSelfFire} />
        <label class="verbosity">
          <span class="pill-label">口数</span>
          <select
            class="verbosity-select"
            value=${verbosity}
            onChange=${(/** @type {any} */ ev) => setVerbosity(ev && ev.target ? ev.target.value : "normal")}
            title="実配線は将来課題（s6-followup §12）・選択しても挙動は変わらない"
          >
            ${VERBOSITY_OPTIONS.map((o) => html`<option key=${o.value} value=${o.value}>${o.label}</option>`)}
          </select>
        </label>
        <${KillSwitch} />
      </div>
    </div>
  `;
}
