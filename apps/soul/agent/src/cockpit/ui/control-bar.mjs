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
 * 口数モード: **実配線済み**（wave 計画「口数配線」§2 裁定 A・s6-followup §12 の実施）。プルダウン
 * （控えめ/ふつう/おしゃべり）は snapshot の `verbosity`（fireScheduler.getVerbosity() 由来）で
 * **controlled**（自発トグル pill と同型・ローカル state の綻び回避）。onChange は POST /api/verbosity
 * （onToggleSelfFire の写経）→成功時 applySnapshot。コメント応答の頻度変化は S7 YouTube 実ゲート保留の
 * ため配線済みだが体感対象外（untested・wave 計画 §1）。
 * KILL: **S8 で実装済み**（§7 赤枠の意匠を踏襲）。snapshot の `killed` で **controlled**（自発トグル/
 * 口数と同型）。通常時は「■ KILL」ボタン（押すと POST /api/kill {killed:true}）。キル中はバー全体に
 * `killing` class が付き視覚的に「殺し中」と分かる + 一クリック復帰ボタン（POST /api/kill
 * {killed:false}）。明示 boolean 指定であり**トグルではない**（onToggleSelfFire の写経・
 * killSwitchView/killPostErrorText/killRequestErrorText は view-logic/control.mjs）。
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
  selfFireRequestErrorText,
  verbosityPostErrorText,
  verbosityRequestErrorText,
  killSwitchView,
  killPostErrorText,
  killRequestErrorText
} from "../view-logic/control.mjs";

/** 口数モードの選択肢（wave 計画「口数配線」§2 裁定 A・実配線済み）。 */
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
 * 口数モードのプルダウン（hooks 非使用・vnode 走査テスト対象・SelfFirePill と同型の controlled
 * 部品）。value は snapshot 由来の verbosity（未設定/scheduler 未生成 = null は "normal" 表示に畳む・
 * server 側 setVerbosity の「未知値は normal」フォールバックと対称）。onChange は呼び出し側
 * （ControlBar）の POST ハンドラを素通しする。
 * @param {{ verbosity?: string | null; onChange: (ev: any) => void }} props
 */
export function VerbositySelect({ verbosity, onChange }) {
  return html`
    <label class="verbosity">
      <span class="pill-label">口数</span>
      <select
        class="verbosity-select"
        value=${verbosity ?? "normal"}
        onChange=${onChange}
        title="控えめ/ふつう/おしゃべりで自発発火の頻度が変わる（コメント応答の変化は YouTube 合流時に体感）"
      >
        ${VERBOSITY_OPTIONS.map((o) => html`<option key=${o.value} value=${o.value}>${o.label}</option>`)}
      </select>
    </label>
  `;
}

/**
 * KILL スイッチ（S8 実装済み・hooks 非使用・vnode 走査テスト対象）。view は killSwitchView 導出済み。
 * 通常時は「■ KILL」ボタン・キル中は「殺し中」status + 復帰ラベルのボタン（同じボタン 1 個・
 * ラベル/class が view で切り替わるだけ・onClick は呼び出し側が明示 boolean を送る）。
 * @param {{ view: { killed: boolean; label: string; className: string; statusText: string; statusClassName: string };
 *           onClick: () => void }} props
 */
export function KillSwitch({ view, onClick }) {
  return html`
    <span class="kill-switch-wrap">
      <button class=${view.className} type="button" onClick=${onClick}>${view.label}</button>
      ${view.killed ? html`<span class=${view.statusClassName}>${view.statusText}</span>` : ""}
    </span>
  `;
}

/**
 * 運転バー本体。
 * @param {{ soul?: string; setSoul: (s: string) => void; fireNote?: string; setFireNote: (t: string) => void;
 *           selfFire?: { enabled?: boolean } | null; verbosity?: string | null; killed?: boolean | null;
 *           applySnapshot: (s: any) => void; fetchImpl?: any }} props
 */
export function ControlBar({ soul, setSoul, fireNote, setFireNote, selfFire, verbosity, killed, applySnapshot, fetchImpl }) {
  // Fire 連打防止のローカル busy（:556 :574 の即時 disable 相当・応答/失敗で復帰）。
  const [localBusy, setLocalBusy] = useState(false);
  // 自発トグル/口数/KILL のエラー欄（旧 conversation-error :212 のうち自発系の文言。IA 再配置で運転バーに常駐）。
  const [controlError, setControlError] = useState("");

  const soulView = soulStatusView(soul);
  const sfView = selfFireToggleView(selfFire);
  const killView = killSwitchView(killed);

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

  /**
   * 口数モードの変更（onToggleSelfFire の写経・wave 計画「口数配線」§2 裁定 A）。
   * @param {any} ev
   */
  const onChangeVerbosity = (ev) => {
    const mode = ev && ev.target ? ev.target.value : "normal";
    const doFetch = fetchImpl || globalThis.fetch;
    setControlError("");
    doFetch("/api/verbosity", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mode })
    })
      .then((/** @type {any} */ r) => r.json().then((/** @type {any} */ j) => ({ ok: r.ok, status: r.status, j })))
      .then((/** @type {any} */ res) => {
        const err = verbosityPostErrorText(res);
        if (err != null) {
          setControlError(err);
          return;
        }
        applySnapshot(res.j); // 200 応答は snapshot 全体（selfFire 経路と同源）。
      })
      .catch((/** @type {unknown} */ e) => setControlError(verbosityRequestErrorText(e)));
  };

  /**
   * KILL / 復帰（onToggleSelfFire の写経・S8）。**明示 boolean を送る**（トグルではない）: 現在
   * killView.killed の逆を送る（false→{killed:true}=KILL・true→{killed:false}=revive）。UI 側で
   * 逆算しているだけでサーバは反転せず受けた boolean をそのまま正本に設定する（cockpit-server.mjs
   * POST /api/kill）。
   */
  const onClickKill = () => {
    const doFetch = fetchImpl || globalThis.fetch;
    const nextKilled = !killView.killed;
    setControlError("");
    doFetch("/api/kill", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ killed: nextKilled })
    })
      .then((/** @type {any} */ r) => r.json().then((/** @type {any} */ j) => ({ ok: r.ok, status: r.status, j })))
      .then((/** @type {any} */ res) => {
        const err = killPostErrorText(res);
        if (err != null) {
          setControlError(err);
          return;
        }
        applySnapshot(res.j); // 200 応答は snapshot 全体（selfFire/verbosity 経路と同源）。
      })
      .catch((/** @type {unknown} */ e) => setControlError(killRequestErrorText(e)));
  };

  return html`
    <div class=${"control-bar" + (killView.killed ? " killing" : "")}>
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
        <${VerbositySelect} verbosity=${verbosity} onChange=${onChangeVerbosity} />
        <${KillSwitch} view=${killView} onClick=${onClickKill} />
      </div>
    </div>
  `;
}
