// @ts-check
/**
 * ui: 準備・設定の「運転」タブ（操縦席の作り直し・cockpit-glance-redesign.md §5・§9.2 / 依頼の既定 1）。
 *
 * 旧「運転バー」（常駐・メイン画面の下）の部品と POST 処理をそのまま移した先。メイン画面には操作部品を置かず
 * （下の帯に運転設定の表示だけ）、ここに自発・かぶり（barge-in）と、手動の発火ボタン（Fire / Fire+視覚）を置く。
 * KILL は上の帯（header.mjs の TopBar）へ移った（§7: 小さな KILL を常に置く）。
 * 配信の組み直し Domain E（stream-restructure.md §6）: 口数・話し始めはロールの持ち物になったので、このタブから外して
 * ロールのタブ（settings-drawer.mjs のロールの編集）へ移した（配信中に替えない・体験の場面 5）。忙しい間のコメントは
 * 配信の準備のタブ（たたんだもの）へ移した。VerbositySelect / SpeakStartSelect / CommentBusySelect の部品はここに残し、
 * 移った先が使う。手動の発火は場が開いている間だけ押せる（場の外ではサーバも 409 で断る）。
 * 表示文字列・状態導出はすべて view-logic/control.mjs 経由（ここで再実装しない・L0 裁定）。
 *
 * props 契約（app.mjs が結線する）:
 *  - soul:          string        SSE soul / POST fire 応答の生 state（busy disable は soulStatusView 導出）。
 *  - setSoul:       (s) => void   Fire/vision-fire 応答の state 反映（応答 j は {fired, state, reason} 形で
 *                    snapshot ではない = applySnapshot に乗らない）。
 *  - fireNote:      string        fire-note 表示（SSE fire 非受理 / ボタン応答 503 / fetch 失敗）。
 *  - setFireNote:   (t) => void   同上の更新（押下時の "" クリアも含む）。
 *  - selfFire / bargeIn: snapshot の現況（null = 使えない）。
 *  - stream:        snapshot の stream（場が開いていない間は手動の発火を押せない・古いサーバの null は押せる）。
 *  - applySnapshot: (s) => void   POST の 200 応答（snapshot 全体）の適用。
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
 * 口数モード・話し始め・忙しい間のコメントのプルダウン（VerbositySelect / SpeakStartSelect / CommentBusySelect）は
 * controlled 部品（value は呼び出し側の値・onChange は呼び出し側の処理を素通し）。配信の組み直し Domain E から、口数と
 * 話し始めはロールの編集の下書き、忙しい間のコメントは配信の準備のタブ（POST /api/comment-busy）が使う。
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
  bargeInToggleView,
  bargeInPostErrorText,
  bargeInRequestErrorText,
  manualFireStreamView
} from "../view-logic/control.mjs";
import { VERBOSITY_LABELS, SPEAK_START_LABELS, COMMENT_BUSY_LABELS } from "../view-logic/glance-meters.mjs";

/** @param {Record<string, string>} labels @returns {Array<{ value: string; label: string }>} */
function optionsFrom(labels) {
  return Object.keys(labels).map((value) => ({ value, label: labels[value] }));
}

/** 口数モードの選択肢（wave 計画「口数配線」§2 裁定 A・実配線済み）。 */
export const VERBOSITY_OPTIONS = optionsFrom(VERBOSITY_LABELS);

/** 話し始めの方式の選択肢（speak-now 合意 §5「話し始め: 従来 / speak-now」）。 */
export const SPEAK_START_OPTIONS = optionsFrom(SPEAK_START_LABELS);

/**
 * Fire / Fire+視覚ボタン（hooks 非使用・vnode 走査テスト対象）。
 * disable は soulStatusView の busy 導出 + ローカル連打防止 + 場の外（配信の組み直し Domain E）の OR。
 * @param {{ soulView: { text: string; className: string; fireDisabled: boolean };
 *           localBusy: boolean; onFire: () => void; onVisionFire: () => void; streamBlocked?: boolean }} props
 */
export function FireButtons({ soulView, localBusy, onFire, onVisionFire, streamBlocked = false }) {
  const disabled = soulView.fireDisabled || localBusy || streamBlocked;
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
 * barge-in トグル pill（「朗読と合いの手」・SelfFirePill の写経・hooks 非使用・vnode 走査テスト対象）。
 * view は bargeInToggleView 導出済み。既定 ON（裁定 1）は server 側 born-disabled の話であり、
 * この部品自体は selfFire pill と同型の controlled component（checked = state 由来・onChange = POST のみ）。
 * @param {{ view: { disabled: boolean; checked: boolean; statusText: string; statusClassName: string };
 *           onChange: (ev: any) => void }} props
 */
export function BargeInPill({ view, onChange }) {
  return html`
    <label class="barge-in-pill">
      <span class="pill-label">かぶり</span>
      <input
        type="checkbox"
        class="barge-in-toggle"
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
 * （DrivePanel）の POST ハンドラを素通しする。
 * 配信の組み直し Domain E: ロールの編集（ロールのタブ）が使う。disabled は場の途中（ロールを直せない間）。
 * @param {{ verbosity?: string | null; onChange: (ev: any) => void; disabled?: boolean }} props
 */
export function VerbositySelect({ verbosity, onChange, disabled = false }) {
  return html`
    <label class="verbosity">
      <span class="pill-label">口数</span>
      <select
        class="verbosity-select"
        value=${verbosity ?? "normal"}
        disabled=${disabled}
        onChange=${onChange}
        title="控えめ/ふつう/おしゃべりで自発発火の頻度が変わる（コメント応答の変化は YouTube 合流時に体感）"
      >
        ${VERBOSITY_OPTIONS.map((o) => html`<option key=${o.value} value=${o.value}>${o.label}</option>`)}
      </select>
    </label>
  `;
}

/**
 * 話し始めの方式のプルダウン（speak-now 合意 §5・VerbositySelect と同型の controlled 部品・hooks 非使用）。
 * value は snapshot 由来の speakStart。null（scheduler 未生成）は disable して "classic" 表示に畳む。
 * 配信の組み直し Domain E: ロールの編集（ロールのタブ）が使う。disabled は場の途中（ロールを直せない間）。
 * @param {{ speakStart?: string | null; onChange: (ev: any) => void; disabled?: boolean }} props
 */
export function SpeakStartSelect({ speakStart, onChange, disabled = false }) {
  return html`
    <label class="verbosity speak-start">
      <span class="pill-label">話し始め</span>
      <select
        class="verbosity-select speak-start-select"
        value=${speakStart ?? "classic"}
        disabled=${disabled || speakStart == null}
        onChange=${onChange}
        title="従来: 区切り・呼びかけ・合いの手の機械信号 / speak-now: 配信者の発言ごとに判定 API が反応を決める"
      >
        ${SPEAK_START_OPTIONS.map((o) => html`<option key=${o.value} value=${o.value}>${o.label}</option>`)}
      </select>
    </label>
  `;
}

/** 忙しい間に届いたコメントの扱いの選択肢（コメント反応の合意 §2「見逃す / あとで拾う（既定）」）。 */
export const COMMENT_BUSY_OPTIONS = optionsFrom(COMMENT_BUSY_LABELS);

/**
 * 忙しい間に届いたコメントの扱いのプルダウン（コメント反応の合意 §2・画面の作り直しまでは運転バーの
 * 話し始めの隣に置く。SpeakStartSelect と同型の controlled 部品・hooks 非使用）。value は snapshot 由来の
 * commentBusy。null（scheduler 未生成）は disable して "hold" 表示に畳む。効くのは speak-now の間だけ
 * （従来モードのコメントは今の comment / comment-call のまま）。
 * 配信の組み直し Domain E: 配信の準備のタブ（たたんだもの）が使う。
 * @param {{ commentBusy?: string | null; onChange: (ev: any) => void }} props
 */
export function CommentBusySelect({ commentBusy, onChange }) {
  return html`
    <label class="verbosity comment-busy">
      <span class="pill-label">忙しい間のコメント</span>
      <select
        class="verbosity-select comment-busy-select"
        value=${commentBusy ?? "hold"}
        disabled=${commentBusy == null}
        onChange=${onChange}
        title="speak-now の間、チャッピーが考えて喋っている間に届いたコメントを、あとで拾う（手が空いたらまとめて判定）か見逃すか"
      >
        ${COMMENT_BUSY_OPTIONS.map((o) => html`<option key=${o.value} value=${o.value}>${o.label}</option>`)}
      </select>
    </label>
  `;
}

/**
 * 「運転」タブ本体（自発・かぶり・手動の発火）。
 * @param {{ soul?: string; setSoul: (s: string) => void; fireNote?: string; setFireNote: (t: string) => void;
 *           selfFire?: { enabled?: boolean } | null;
 *           bargeIn?: { enabled?: boolean } | null;
 *           stream?: { phase?: string } | null;
 *           applySnapshot: (s: any) => void; fetchImpl?: any }} props
 */
export function DrivePanel({ soul, setSoul, fireNote, setFireNote, selfFire, bargeIn, stream = null, applySnapshot, fetchImpl }) {
  // Fire 連打防止のローカル busy（:556 :574 の即時 disable 相当・応答/失敗で復帰）。
  const [localBusy, setLocalBusy] = useState(false);
  // 自発トグル/barge-in のエラー欄。
  const [controlError, setControlError] = useState("");

  const soulView = soulStatusView(soul);
  const sfView = selfFireToggleView(selfFire);
  const biView = bargeInToggleView(bargeIn);
  const fireStream = manualFireStreamView(stream);

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
   * barge-in トグル（onToggleSelfFire の写経・「朗読と合いの手」）。controlled のため change は
   * ユーザー操作でのみ発火する（selfFire pill と同型の一方向データフロー）。
   * @param {any} ev
   */
  const onToggleBargeIn = (ev) => {
    const enabled = !!(ev && ev.target && ev.target.checked);
    const doFetch = fetchImpl || globalThis.fetch;
    setControlError("");
    doFetch("/api/barge-in", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ enabled })
    })
      .then((/** @type {any} */ r) => r.json().then((/** @type {any} */ j) => ({ ok: r.ok, status: r.status, j })))
      .then((/** @type {any} */ res) => {
        const err = bargeInPostErrorText(res);
        if (err != null) {
          setControlError(err);
          return;
        }
        applySnapshot(res.j); // 200 応答は snapshot 全体（selfFire 経路と同源）。
      })
      .catch((/** @type {unknown} */ e) => setControlError(bargeInRequestErrorText(e)));
  };

  return html`
    <div class="drive-panel">
      <div class="drawer-row drive-row">
        <label>運転</label>
        <${SelfFirePill} view=${sfView} onChange=${onToggleSelfFire} />
        <${BargeInPill} view=${biView} onChange=${onToggleBargeIn} />
      </div>
      <div class="drawer-note"><span class="control-error err">${controlError}</span></div>
      <div class="drawer-row drive-row">
        <label>手動の発火</label>
        <${FireButtons}
          soulView=${soulView}
          localBusy=${localBusy}
          onFire=${() => fireWith("/api/fire", "fire")}
          onVisionFire=${() => fireWith("/api/vision-fire", "vision")}
          streamBlocked=${fireStream.blocked}
        />
        <span class="soul-note">soul: <span class=${soulView.className}>${soulView.text}</span></span>
      </div>
      <div class="drawer-note">
        <span class="fire-note">${fireNote}</span>
        ${fireStream.note ? html`<span class="fire-stream-note">${fireStream.note}</span>` : null}
      </div>
    </div>
  `;
}
