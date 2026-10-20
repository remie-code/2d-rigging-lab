// @ts-check
/**
 * ui: 準備・設定の「運転」タブ（操縦席の作り直し・cockpit-glance-redesign.md §5・§9.2 / 依頼の既定 1）。
 *
 * 旧「運転バー」（常駐・メイン画面の下）の部品と POST 処理をそのまま移した先。メイン画面には操作部品を置かず
 * （下の帯に運転設定の表示だけ）、ここに自発・口数・話し始め・忙しい間のコメント・かぶり（barge-in）と、手動の発火
 * ボタン（Fire / Fire+視覚）を置く。KILL は上の帯（header.mjs の TopBar）へ移った（§7: 小さな KILL を常に置く）。
 * 表示文字列・状態導出はすべて view-logic/control.mjs 経由（ここで再実装しない・L0 裁定）。
 *
 * props 契約（app.mjs が結線する）:
 *  - soul:          string        SSE soul / POST fire 応答の生 state（busy disable は soulStatusView 導出）。
 *  - setSoul:       (s) => void   Fire/vision-fire 応答の state 反映（応答 j は {fired, state, reason} 形で
 *                    snapshot ではない = applySnapshot に乗らない）。
 *  - fireNote:      string        fire-note 表示（SSE fire 非受理 / ボタン応答 503 / fetch 失敗）。
 *  - setFireNote:   (t) => void   同上の更新（押下時の "" クリアも含む）。
 *  - selfFire / verbosity / speakStart / commentBusy / bargeIn: snapshot の現況（null = 使えない）。
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
 * 口数モード: **実配線済み**（wave 計画「口数配線」§2 裁定 A・s6-followup §12 の実施）。プルダウン
 * （控えめ/ふつう/おしゃべり）は snapshot の `verbosity`（fireScheduler.getVerbosity() 由来）で
 * **controlled**（自発トグル pill と同型・ローカル state の綻び回避）。onChange は POST /api/verbosity
 * （onToggleSelfFire の写経）→成功時 applySnapshot。コメント応答の頻度変化は S7 YouTube 実ゲート保留の
 * ため配線済みだが体感対象外（untested・wave 計画 §1）。
 * 話し始め（speak-now 合意 §5）: 自発 pill と口数の隣に「話し始め: 従来 / speak-now」のプルダウン。
 * snapshot の `speakStart`（"classic" | "speak-now"）で **controlled**（口数と同型）。onChange は
 * POST /api/speak-start → 成功時 applySnapshot。選択の保存はサーバ側（cockpit.mjs の settings 橋渡し）。
 * 忙しい間のコメント（コメント反応の合意 §2）: 話し始めの隣に「あとで拾う / 見逃す」のプルダウン（画面の
 * 作り直しで運転タブへ）。snapshot の `commentBusy` で controlled・onChange は POST /api/comment-busy。
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
  speakStartPostErrorText,
  speakStartRequestErrorText,
  commentBusyPostErrorText,
  commentBusyRequestErrorText,
  bargeInToggleView,
  bargeInPostErrorText,
  bargeInRequestErrorText
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
 * 話し始めの方式のプルダウン（speak-now 合意 §5・VerbositySelect と同型の controlled 部品・hooks 非使用）。
 * value は snapshot 由来の speakStart。null（scheduler 未生成）は disable して "classic" 表示に畳む。
 * @param {{ speakStart?: string | null; onChange: (ev: any) => void }} props
 */
export function SpeakStartSelect({ speakStart, onChange }) {
  return html`
    <label class="verbosity speak-start">
      <span class="pill-label">話し始め</span>
      <select
        class="verbosity-select speak-start-select"
        value=${speakStart ?? "classic"}
        disabled=${speakStart == null}
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
 * 「運転」タブ本体。
 * @param {{ soul?: string; setSoul: (s: string) => void; fireNote?: string; setFireNote: (t: string) => void;
 *           selfFire?: { enabled?: boolean } | null; verbosity?: string | null; speakStart?: string | null;
 *           commentBusy?: string | null;
 *           bargeIn?: { enabled?: boolean } | null;
 *           applySnapshot: (s: any) => void; fetchImpl?: any }} props
 */
export function DrivePanel({ soul, setSoul, fireNote, setFireNote, selfFire, verbosity, speakStart, commentBusy, bargeIn, applySnapshot, fetchImpl }) {
  // Fire 連打防止のローカル busy（:556 :574 の即時 disable 相当・応答/失敗で復帰）。
  const [localBusy, setLocalBusy] = useState(false);
  // 自発トグル/口数/話し始め/忙しい間のコメント/barge-in のエラー欄。
  const [controlError, setControlError] = useState("");

  const soulView = soulStatusView(soul);
  const sfView = selfFireToggleView(selfFire);
  const biView = bargeInToggleView(bargeIn);

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
   * 話し始めの方式の変更（onChangeVerbosity の写経・speak-now 合意 §5）。
   * @param {any} ev
   */
  const onChangeSpeakStart = (ev) => {
    const mode = ev && ev.target ? ev.target.value : "classic";
    const doFetch = fetchImpl || globalThis.fetch;
    setControlError("");
    doFetch("/api/speak-start", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mode })
    })
      .then((/** @type {any} */ r) => r.json().then((/** @type {any} */ j) => ({ ok: r.ok, status: r.status, j })))
      .then((/** @type {any} */ res) => {
        const err = speakStartPostErrorText(res);
        if (err != null) {
          setControlError(err);
          return;
        }
        applySnapshot(res.j); // 200 応答は snapshot 全体（verbosity 経路と同源）。
      })
      .catch((/** @type {unknown} */ e) => setControlError(speakStartRequestErrorText(e)));
  };

  /**
   * 忙しい間のコメントの扱いの変更（onChangeSpeakStart の写経・コメント反応の合意 §2）。
   * @param {any} ev
   */
  const onChangeCommentBusy = (ev) => {
    const policy = ev && ev.target ? ev.target.value : "hold";
    const doFetch = fetchImpl || globalThis.fetch;
    setControlError("");
    doFetch("/api/comment-busy", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ policy })
    })
      .then((/** @type {any} */ r) => r.json().then((/** @type {any} */ j) => ({ ok: r.ok, status: r.status, j })))
      .then((/** @type {any} */ res) => {
        const err = commentBusyPostErrorText(res);
        if (err != null) {
          setControlError(err);
          return;
        }
        applySnapshot(res.j); // 200 応答は snapshot 全体（speak-start 経路と同源）。
      })
      .catch((/** @type {unknown} */ e) => setControlError(commentBusyRequestErrorText(e)));
  };

  return html`
    <div class="drive-panel">
      <div class="drawer-row drive-row">
        <label>運転</label>
        <${SelfFirePill} view=${sfView} onChange=${onToggleSelfFire} />
        <${BargeInPill} view=${biView} onChange=${onToggleBargeIn} />
      </div>
      <div class="drawer-row drive-row">
        <label>話し方</label>
        <${VerbositySelect} verbosity=${verbosity} onChange=${onChangeVerbosity} />
        <${SpeakStartSelect} speakStart=${speakStart} onChange=${onChangeSpeakStart} />
        <${CommentBusySelect} commentBusy=${commentBusy} onChange=${onChangeCommentBusy} />
      </div>
      <div class="drawer-note"><span class="control-error err">${controlError}</span></div>
      <div class="drawer-row drive-row">
        <label>手動の発火</label>
        <${FireButtons}
          soulView=${soulView}
          localBusy=${localBusy}
          onFire=${() => fireWith("/api/fire", "fire")}
          onVisionFire=${() => fireWith("/api/vision-fire", "vision")}
        />
        <span class="soul-note">soul: <span class=${soulView.className}>${soulView.text}</span></span>
      </div>
      <div class="drawer-note"><span class="fire-note">${fireNote}</span></div>
    </div>
  `;
}
