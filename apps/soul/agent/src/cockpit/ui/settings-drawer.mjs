// @ts-check
/**
 * ui: Cockpit Settings modal（⚙ で開閉・cockpit-redesign.md §3/§7: 区画見出し・ラベル幅揃え・select は chevron 付き・
 * 状態は色ドット + 文言・角丸 14px パネル・普段は畳む）。画面上の名前は「準備・設定」（メイン画面の歯車・配信前の
 * 「準備・設定」から開く）。
 *
 * 配信の組み直し Domain E（stream-restructure.md §6・体験の場面 2・3・5）でタブを
 * **配信の準備 / ロール / 運転 / 記憶 / ログ** の 5 つに組み直した:
 *  - 配信の準備（場面 3）: 毎回見るもの = YouTube の URL（Connect / Disconnect）・ゲームの窓・**ロールに体があるときだけ**
 *    器（Channel）の URL。たたんだもの（`<details>`）= マイク・文字起こし・声の出力先・忙しい間のコメント。select は保存した
 *    値を選んだ状態で出す（マイクは lastDevice・ゲームの窓は visionTarget.title・声の出力先は audioDevice.name）。場が開いて
 *    いる間（開きかけ・閉じかけも）はマイク・文字起こしは触れない（YouTube の URL・ゲームの窓は触れる）。声の方式はここから
 *    外した（ロールの声）。いちばん下に「配信を始める」（選んだマイク・文字起こしで POST /api/stream/start）。始められなかった
 *    理由の正はメイン画面の中央（snapshot の stream.error）で、ここにも同じ値を出す（ダイアログがメイン画面を覆うため）。
 *    「配信を終える」は下の帯の 2 回押しだけ（ここの Stop は外した）。
 *  - ロール（場面 1・2）: 今日のロールの選択（POST /api/role）と、今のロールの編集（名前・モデル・性格の指示・声（方式・
 *    AivisSpeech の話者・ElevenLabs の声の id）・口数・話し始め・体 → POST /api/role/edit）。性格の指示は同じタブの中の
 *    ページ（conversation-instruction editor・今のロールの instructions.md）。新しいロールは今のロールを写して作る
 *    （POST /api/role/new）。選択・編集・新しいロールは場が閉じている間だけ（サーバも 409 で断る）。頭の調整（圧縮を始める
 *    大きさ・Codex の fast）はロールの外に残る技術のつまみだが、頭の性質なのでこのタブの下に置く。
 *  - 運転: 自発・かぶり・手動の発火（control-bar.mjs DrivePanel を driveSlot で受ける）。口数・話し始めは外した（ロールへ）。
 *  - 記憶: そのロールの記憶（どのロールの・どのフォルダか = snapshot の memory.roleId / dir）と「今日を記録」
 *    （POST /api/memory-record・場が開いている間だけ押せる見た目）・「最後に記録: ...」。
 *  - ログ: 今のまま（logSlot）。logSlot は関数なら「ログのタブが見えているか」を渡して呼ぶ。
 *
 * 表示文字列・状態導出はすべて view-logic 経由（settings.mjs / status.mjs / health.mjs / role.mjs・L0 裁定）。
 * 挙動の保存点:
 *  - token 秘匿: Channel Set 成功後に入力欄をクリア（生 URL を残さない）。表示は redact 済み snapshot の channelStatusView。
 *  - Disconnect の有効/無効は chatStatusView（state 駆動・dead/未接続は無効）経由 = 単一経路。
 *  - source 記憶復元は shouldRestoreChatSource（ユーザー入力中 = chatSourceEdited は復元しない・Connect 成功で再び復元を許す）。
 *  - 声の出力先の適用（常駐プレイヤーのその場再起動）はサーバ側挙動（POST 応答適用のみ担う）。
 *
 * 初期ロード（loadDevices/loadWindows/loadAudioDevices）は本コンポーネントの独立 effect。開閉は CSS（.open クラス）で
 * 行い、コンポーネントは常時 mount = 初期ロードは 1 回だけ・入力欄のローカル状態（ロールの編集の下書きを含む）は開閉で
 * 消えない。
 *
 * props 契約（app.mjs が結線する）:
 *  - open / onClose / settings（settingsFromSnapshot の値）/ sttEngine / chatDisplay / applySnapshot / fetchImpl /
 *    closeRequestRef / driveSlot / logSlot / promptEditorSlot / draftDirty / dirty / onDiscardDraft / onContinueDraft。
 *
 * トップレベル副作用ゼロ（export function/const のみ）。
 */

import { html, useState, useEffect, useRef } from "../vendor/htm.preact.standalone.mjs";
import {
  visionTargetLabel,
  micDeviceListView,
  windowListView,
  audioDeviceListView,
  initialDeviceSelection,
  savedDeviceSelection,
  visionTargetPostErrorText,
  audioDevicePostErrorText,
  channelPostErrorText,
  chatConnectErrorText,
  CHAT_EMPTY_SOURCE_ERROR,
  earsStartFailureText,
  STT_ENGINE_OPTIONS,
  sttEngineSelection,
  requestErrorText,
  rolePostErrorText,
  memoryRecordPostErrorText,
  memoryStatusLabel,
  memoryPlaceLabel,
  memoryRecordButtonView,
  compactThresholdOptions,
  compactThresholdSelection,
  compactThresholdStatusLabel,
  compactThresholdPostErrorText,
  COMPACT_THRESHOLD_DEFAULT_TOKENS,
  COMPACT_THRESHOLD_NOTE,
  codexFastToggleView,
  codexFastStatusLabel,
  codexFastPostErrorText,
  CODEX_FAST_NOTE,
  streamLocksInputs,
  STREAM_LOCKED_INPUTS_NOTE
} from "../view-logic/settings.mjs";
import { chatStatusView, channelStatusView, shouldRestoreChatSource } from "../view-logic/status.mjs";
import { voiceOutputLabel, BRAIN_LABELS, brainLabel, brainCredentialHealthLabel } from "../view-logic/health.mjs";
import { commentBusyPostErrorText, commentBusyRequestErrorText } from "../view-logic/control.mjs";
import { streamStartView } from "../view-logic/glance-meters.mjs";
import {
  createConversationInstructionController,
  currentRoleView,
  roleOptionsView
} from "../view-logic/conversation-instruction.mjs";
import {
  ROLE_MODEL_OPTIONS,
  ROLE_VOICE_ENGINE_OPTIONS,
  roleDraftFromStatus,
  roleDraftDirty,
  rolePatchFromDraft,
  newRoleIdError,
  channelFieldVisible,
  roleLockedNote,
  roleEditPostErrorText
} from "../view-logic/role.mjs";
import { ConversationInstructionEditor } from "./conversation-instruction-editor.mjs";
import { VerbositySelect, SpeakStartSelect, CommentBusySelect } from "./control-bar.mjs";

/**
 * chevron 付き select（hooks 非使用・vnode 走査テスト対象）。option 列は view-logic の
 * DeviceListView（{value, label}）を機械的に描くだけ。id は label の for と対にする（a11y）。
 * @param {{ id?: string; className?: string; options: Array<{ value: string; label: string }>; value?: string;
 *           onChange?: (ev: any) => void; disabled?: boolean }} props
 */
export function SettingsSelect({ id, className, options, value, onChange, disabled }) {
  return html`
    <select id=${id} class=${className || "drawer-select"} value=${value} onChange=${onChange} disabled=${disabled}>
      ${options.map((o) => html`<option key=${o.value} value=${o.value}>${o.label}</option>`)}
    </select>
  `;
}

/**
 * 状態表示（色ドット + 文言・§7）。view は channelStatusView / chatStatusView の
 * {text, className} 構造体（hooks 非使用・vnode 走査テスト対象）。
 * @param {{ view: { text: string; className: string } }} props
 */
export function DrawerStatus({ view }) {
  return html`<span class=${"drawer-status " + view.className}>${view.text}</span>`;
}

/**
 * 設定のダイアログのタブ（配信の組み直し Domain E・stream-restructure.md §6: 配信の準備 / ロール / 運転 / 記憶 / ログ）。
 */
export const SETTINGS_CATEGORIES = Object.freeze([
  Object.freeze({ id: "prepare", label: "配信の準備" }),
  Object.freeze({ id: "role", label: "ロール" }),
  Object.freeze({ id: "drive", label: "運転" }),
  Object.freeze({ id: "memory", label: "記憶" }),
  Object.freeze({ id: "log", label: "ログ" })
]);

/** @param {string} currentId @param {string} key @returns {string} */
export function settingsModalNextCategory(currentId, key) {
  const index = SETTINGS_CATEGORIES.findIndex((category) => category.id === currentId);
  if (index < 0) return SETTINGS_CATEGORIES[0].id;
  if (key === "Home") return SETTINGS_CATEGORIES[0].id;
  if (key === "End") return SETTINGS_CATEGORIES[SETTINGS_CATEGORIES.length - 1].id;
  if (key === "ArrowLeft") return SETTINGS_CATEGORIES[(index - 1 + SETTINGS_CATEGORIES.length) % SETTINGS_CATEGORIES.length].id;
  if (key === "ArrowRight") return SETTINGS_CATEGORIES[(index + 1) % SETTINGS_CATEGORIES.length].id;
  return currentId;
}

/**
 * Deterministic seam used by the real dialog key handler. Navigation is
 * delegated to the caller, which supplies the same guarded category action
 * used by tab clicks; focus is therefore moved only after that action is
 * accepted (or after explicit discard of a dirty draft).
 * @param {{ tabs: Array<any>; currentIndex: number; key: string; onNavigate: (nextId: string, after?: () => void) => void }} input
 * @returns {string | null}
 */
export function settingsModalKeyboardCategoryAction({ tabs, currentIndex, key, onNavigate }) {
  if (!Array.isArray(tabs) || currentIndex < 0 || currentIndex >= tabs.length) return null;
  if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(key)) return null;
  const currentTab = tabs[currentIndex];
  const currentId = currentTab && typeof currentTab.id === "string"
    ? currentTab.id.replace("cockpit-settings-tab-", "")
    : "";
  const nextId = settingsModalNextCategory(currentId, key);
  const nextTab = tabs.find((tab) => tab && tab.id === "cockpit-settings-tab-" + nextId);
  if (!nextTab) return null;
  onNavigate(nextId, () => {
    if (typeof nextTab.focus === "function") nextTab.focus();
  });
  return nextId;
}

/**
 * Shared executable navigation seam for every close/back/category path.
 * @param {{ dirty?: boolean; action: () => void; onPrompt: (action: () => void) => void }} input
 * @returns {"prompt" | "proceed"}
 */
export function settingsModalGuardedNavigation({ dirty, action, onPrompt }) {
  if (settingsModalCloseAction({ dirty }) === "prompt") {
    onPrompt(action);
    return "prompt";
  }
  action();
  return "proceed";
}

/**
 * Shared fake-only event routing seam. The mounted handlers below all call
 * this through `runGuardedNavigation`; keeping the event kind explicit makes
 * the dirty contract executable without a DOM dependency.
 * 配信の組み直し Domain E: 旧「頭脳」の種類（"brain"）は消した（頭の選択はロールの選択になり、未保存の会話指示が
 * あってもロールの select は編集ページの外にしか無い）。
 * @param {{ eventType: string; dirty?: boolean; action: () => void; onPrompt: (action: () => void) => void }} input
 * @returns {"prompt" | "proceed" | null}
 */
export function settingsModalEventRoute({ eventType, dirty, action, onPrompt }) {
  if (!["close", "back", "category-click", "category-keyboard"].includes(eventType)) return null;
  return settingsModalGuardedNavigation({ dirty, action, onPrompt });
}

/** @param {{ dirty?: boolean }} state @returns {"prompt" | "close"} */
export function settingsModalCloseAction(state) {
  return state && state.dirty ? "prompt" : "close";
}

/** @param {number} index @param {number} length @param {boolean} shift @returns {number} */
export function settingsModalFocusBoundary(index, length, shift) {
  if (length <= 0) return -1;
  if (shift && index <= 0) return length - 1;
  if (!shift && index >= length - 1) return 0;
  return index;
}

/** @param {Array<any>} nodes @returns {Array<any>} */
export function settingsModalFocusableNodes(nodes) {
  return nodes.filter((node) => {
    const element = /** @type {any} */ (node);
    return !element.closest?.("[hidden]") && element.getAttribute?.("aria-hidden") !== "true";
  });
}

/** @param {Array<any>} nodes @returns {any | null} */
export function settingsModalFocusEntryTarget(nodes) {
  return settingsModalFocusableNodes(nodes)[0] || null;
}

/** @param {any} previous @param {boolean} open @returns {any | null} */
export function settingsModalFocusReturnTarget(previous, open) {
  return open ? null : previous || null;
}

/** POST の応答を {ok, status, j} にそろえる（全ハンドラ共通）。 @param {any} r */
const responseOf = (r) => r.json().then((/** @type {any} */ j) => ({ ok: r.ok, status: r.status, j }));

/**
 * Accessible Cockpit Settings modal. The component stays mounted while closed
 * so immediate-control input state survives a close/reopen cycle. The
 * conversation editor is a page within this same dialog (ロールのタブの中); it never creates a
 * nested dialog or changes existing immediate-setting endpoint handlers.
 *
 * @param {{ open?: boolean; onClose?: () => void; settings: any; sttEngine?: string | null; chatDisplay?: string | null;
 *   applySnapshot: (s: any) => void; fetchImpl?: any; promptEditorSlot?: any;
 *   draftDirty?: boolean; dirty?: boolean; onDiscardDraft?: () => void; onContinueDraft?: () => void;
 *   closeRequestRef?: { current: (() => void) | null }; driveSlot?: any; logSlot?: any }} props
 */
export function CockpitSettingsModal({
  open,
  onClose,
  settings,
  sttEngine = null,
  chatDisplay,
  applySnapshot,
  fetchImpl,
  promptEditorSlot,
  draftDirty = false,
  dirty = false,
  onDiscardDraft,
  onContinueDraft,
  closeRequestRef,
  driveSlot = null,
  logSlot = null
}) {
  // ── 配信の準備: マイク（lastDevice を初期選択）──
  const [micOptions, setMicOptions] = useState(/** @type {Array<{value:string;label:string}>} */ ([]));
  const [micSelected, setMicSelected] = useState("");
  const [micError, setMicError] = useState(""); // マイク一覧の取得の失敗。
  // ── 配信の準備: 文字起こし（前回の選択は state.stt.engine から復元・選び直したら上書きしない）──
  const [sttSelected, setSttSelected] = useState("whisper");
  const sttEditedRef = useRef(false);
  // ── 配信の準備: 「配信を始める」（選んだマイク・文字起こしで始める）──
  const [startBusy, setStartBusy] = useState(false);
  const [startRequestError, setStartRequestError] = useState(""); // 要求そのものの失敗（通信・409）。理由の正は stream.error。
  // ── 配信の準備: 器 Channel（ロールに体があるときだけ出す）──
  const [channelUrl, setChannelUrl] = useState("");
  const [channelError, setChannelError] = useState("");
  // ── 配信の準備: YouTube chat ──
  const [chatSource, setChatSource] = useState("");
  const chatSourceRef = useRef(""); //   復元判定用の現在値。
  const chatEditedRef = useRef(false); // 入力中は復元しない。
  const [chatError, setChatError] = useState("");
  const [connectBusy, setConnectBusy] = useState(false);
  // ── 配信の準備: ゲームの窓（保存した窓を選んだ状態で出す・選び直したら上書きしない）──
  const [winOptions, setWinOptions] = useState(/** @type {Array<{value:string;label:string}>} */ ([]));
  const [winSelected, setWinSelected] = useState("");
  const winEditedRef = useRef(false);
  const [visionError, setVisionError] = useState("");
  // ── 配信の準備: 声の出力先（保存した出力先を選んだ状態で出す・選び直したら上書きしない）──
  const [audioOptions, setAudioOptions] = useState(/** @type {Array<{value:string;label:string}>} */ ([]));
  const [audioSelected, setAudioSelected] = useState("");
  const audioEditedRef = useRef(false);
  const [audioError, setAudioError] = useState("");
  // ── 配信の準備: 忙しい間のコメント（snapshot の commentBusy で controlled・エラー欄だけ持つ）──
  const [commentBusyError, setCommentBusyError] = useState("");
  // ── ロール: 今日のロールの選択 ──
  const [roleSelected, setRoleSelected] = useState("");
  const [roleError, setRoleError] = useState("");
  // ── ロール: 今のロールの編集の下書き（snapshot の role から作る・未保存の間は snapshot で上書きしない）──
  const [roleDraft, setRoleDraft] = useState(/** @type {import("../view-logic/role.mjs").RoleDraft | null} */ (null));
  const roleBaselineKeyRef = useRef("");
  const [roleEditError, setRoleEditError] = useState("");
  const [roleEditBusy, setRoleEditBusy] = useState(false);
  // ── ロール: 新しいロール（今のロールを写して作る）──
  const [newRoleId, setNewRoleId] = useState("");
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleError, setNewRoleError] = useState("");
  const [newRoleBusy, setNewRoleBusy] = useState(false);
  // ── ロール（頭の調整）: 圧縮を始める大きさ（select の値はトークン数の文字列）──
  const [compactSelected, setCompactSelected] = useState(String(COMPACT_THRESHOLD_DEFAULT_TOKENS));
  const [compactError, setCompactError] = useState("");
  // ── ロール（頭の調整）: Codex の fast（チェックボックスは snapshot の codexFast に従う controlled 部品）──
  const [codexFastError, setCodexFastError] = useState("");
  // ── 記憶 ──
  const [memoryError, setMemoryError] = useState("");
  const [recordBusy, setRecordBusy] = useState(false); // 「今日を記録」の連打防止。

  const [activeCategory, setActiveCategory] = useState("prepare");
  const [conversationEditorOpen, setConversationEditorOpen] = useState(false);
  const [conversationEditorVersion, setConversationEditorVersion] = useState(0);
  const conversationEditorRef = useRef(/** @type {any} */ (null));
  if (!conversationEditorRef.current) {
    conversationEditorRef.current = createConversationInstructionController({
      fetchImpl,
      onChange: () => setConversationEditorVersion((value) => value + 1)
    });
  }
  const conversationEditor = conversationEditorRef.current;
  // Reading the version makes the controller's injected change hook an
  // explicit render dependency while keeping the state itself outside JSX.
  void conversationEditorVersion;
  // 性格の指示（会話指示）の編集は今のロール（snapshot の role）だけ。
  const currentRole = currentRoleView(settings && settings.role);
  const editorRoleId = currentRole ? currentRole.id : "";
  const conversationEditorState = conversationEditor.getState(editorRoleId);
  const [closeWarning, setCloseWarning] = useState(false);
  const pendingNavigationRef = useRef(/** @type {(() => void) | null} */ (null));
  const dialogRef = useRef(/** @type {HTMLElement | null} */ (null));
  const previousFocusRef = useRef(/** @type {HTMLElement | null} */ (null));
  const wasOpenRef = useRef(false);
  const isDraftDirty = !!(draftDirty || dirty || (conversationEditorOpen && conversationEditorState.dirty));
  const doFetch = (/** @type {string} */ path, /** @type {any} */ init) =>
    (fetchImpl || globalThis.fetch)(path, init);
  /** JSON の POST（全ハンドラ共通）。 @param {string} path @param {unknown} body */
  const postJson = (path, body) =>
    doFetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).then(responseOf);

  // 場の途中（開きかけ・開いている・閉じかけ）か。マイク・文字起こしとロールの選択・編集はこの間触れない。
  const streamLocked = streamLocksInputs(settings && settings.stream);
  const inputsLocked = streamLocked;
  const roleLocked = streamLocked;
  const roleEditable = !!(settings && settings.role && settings.role.editable !== false);

  const runGuardedNavigation = (/** @type {() => void} */ action, /** @type {string} */ eventType = "close") => {
    settingsModalEventRoute({
      eventType,
      dirty: isDraftDirty,
      action,
      onPrompt: (pendingAction) => {
        pendingNavigationRef.current = pendingAction;
        setCloseWarning(true);
      }
    });
  };

  const requestClose = () => {
    runGuardedNavigation(() => {
      setCloseWarning(false);
      if (typeof onClose === "function") onClose();
    }, "close");
  };

  const discardCurrentConversationDraft = () => {
    conversationEditor.discard(editorRoleId);
    if (typeof onDiscardDraft === "function") onDiscardDraft();
  };

  const continueCurrentConversationDraft = () => {
    setCloseWarning(false);
    pendingNavigationRef.current = null;
    if (typeof onContinueDraft === "function") onContinueDraft();
  };

  const completeDiscardNavigation = () => {
    discardCurrentConversationDraft();
    setCloseWarning(false);
    const action = pendingNavigationRef.current;
    pendingNavigationRef.current = null;
    if (action) action();
  };

  const requestCategory = (
    /** @type {string} */ categoryId,
    /** @type {(() => void) | undefined} */ afterNavigation,
    /** @type {string} */ eventType = "category-click"
  ) => {
    if (categoryId === activeCategory && (!conversationEditorOpen || categoryId === "role")) return;
    runGuardedNavigation(() => {
      setActiveCategory(categoryId);
      if (categoryId !== "role") setConversationEditorOpen(false);
      if (typeof afterNavigation === "function") afterNavigation();
    }, eventType);
  };

  const requestEditorBack = () => runGuardedNavigation(() => setConversationEditorOpen(false), "back");

  // ロールの select の現況同期: snapshot.role.id（起動時の現況 / POST /api/role 後の反映）を select の表示へ入れる。
  useEffect(() => {
    if (editorRoleId) setRoleSelected(editorRoleId);
  }, [editorRoleId]);

  // ロールの編集の下書きの現況同期: 今のロール（snapshot の role）が変わったら下書きを作り直す。ただし同じロールで
  // 下書きが未保存（前の値から変えてある）の間は上書きしない。保存のあとは新しい値が下書きと同じになる。
  const roleBaseline = roleDraftFromStatus(settings && settings.role);
  const roleBaselineKey = roleBaseline ? JSON.stringify(roleBaseline) : "";
  useEffect(() => {
    if (roleBaselineKey === roleBaselineKeyRef.current) return;
    const previous = roleBaselineKeyRef.current ? JSON.parse(roleBaselineKeyRef.current) : null;
    roleBaselineKeyRef.current = roleBaselineKey;
    const next = roleBaselineKey ? JSON.parse(roleBaselineKey) : null;
    setRoleDraft((draft) => {
      if (!draft || !next || draft.id !== next.id) return next;
      return roleDraftDirty(draft, previous) ? draft : next;
    });
  }, [roleBaselineKey]);
  const roleDraftIsDirty = roleDraftDirty(roleDraft, roleBaseline);

  useEffect(() => {
    if (editorRoleId && conversationEditorOpen && !conversationEditorState.loaded && conversationEditorState.status === "idle") {
      conversationEditor.load(editorRoleId);
    }
  }, [conversationEditorOpen, editorRoleId, conversationEditorState.loaded, conversationEditorState.status]);

  useEffect(() => {
    if (!isDraftDirty && closeWarning) {
      setCloseWarning(false);
      pendingNavigationRef.current = null;
    }
  }, [isDraftDirty, closeWarning]);

  // The header gear uses this ref when the modal is already open, so dirty
  // drafts cannot be closed by bypassing the shell's close guard.
  useEffect(() => {
    if (!closeRequestRef || typeof closeRequestRef !== "object") return undefined;
    closeRequestRef.current = requestClose;
    return () => {
      if (closeRequestRef.current === requestClose) closeRequestRef.current = null;
    };
  }, [closeRequestRef, open, isDraftDirty, onClose, onDiscardDraft, onContinueDraft]);

  // One modal owns focus entry/containment/return and Escape handling.
  useEffect(() => {
    const doc = globalThis.document;
    if (!open || !doc || !dialogRef.current) {
      const returnTarget = settingsModalFocusReturnTarget(previousFocusRef.current, open);
      if (!open && wasOpenRef.current && returnTarget) {
        returnTarget.focus();
        previousFocusRef.current = null;
      }
      wasOpenRef.current = !!open;
      return undefined;
    }
    if (!wasOpenRef.current) {
      previousFocusRef.current = /** @type {HTMLElement | null} */ (doc.activeElement);
      const first = settingsModalFocusEntryTarget(Array.from(dialogRef.current.querySelectorAll("[data-cockpit-settings-focus], button, input, select, textarea")));
      if (first && typeof first.focus === "function") first.focus();
    }
    wasOpenRef.current = true;
    const dialog = dialogRef.current;
    const onKeyDown = (/** @type {KeyboardEvent} */ ev) => {
      if (ev.key === "Escape") {
        ev.preventDefault();
        requestClose();
        return;
      }
      if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(ev.key)) {
        const tabs = Array.from(dialog.querySelectorAll("[role='tab']"));
        const currentIndex = tabs.indexOf(doc.activeElement);
        if (currentIndex >= 0) {
          const nextId = settingsModalKeyboardCategoryAction({
            tabs,
            currentIndex,
            key: ev.key,
            onNavigate: (nextId, after) => requestCategory(nextId, after, "category-keyboard")
          });
          if (nextId) {
            ev.preventDefault();
            return;
          }
        }
      }
      if (ev.key !== "Tab") return;
      const focusable = settingsModalFocusableNodes(Array.from(dialog.querySelectorAll("button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])")));
      if (focusable.length === 0) return;
      const first = /** @type {HTMLElement} */ (focusable[0]);
      const last = /** @type {HTMLElement} */ (focusable[focusable.length - 1]);
      const current = doc.activeElement;
      const currentIndex = focusable.indexOf(current);
      const boundaryIndex = settingsModalFocusBoundary(currentIndex, focusable.length, ev.shiftKey);
      if (ev.shiftKey && current === first) {
        ev.preventDefault();
        /** @type {HTMLElement} */ (focusable[boundaryIndex]).focus();
      } else if (!ev.shiftKey && current === last) {
        ev.preventDefault();
        /** @type {HTMLElement} */ (focusable[boundaryIndex]).focus();
      }
    };
    dialog.addEventListener("keydown", onKeyDown);
    return () => dialog.removeEventListener("keydown", onKeyDown);
  }, [open, isDraftDirty, onClose, onDiscardDraft, onContinueDraft]);

  /** マイク一覧の取得（lastDevice を初期選択）。 */
  const loadDevices = () =>
    doFetch("/api/devices")
      .then((/** @type {any} */ r) => r.json())
      .then((/** @type {any} */ j) => {
        const view = micDeviceListView(j);
        setMicOptions(view.options);
        setMicSelected(initialDeviceSelection(view.options, j && j.lastDevice));
        setMicError(view.errorText);
      })
      .catch((/** @type {unknown} */ e) => setMicError(requestErrorText("loadDevices", e)));

  /** ウインドウ一覧の取得（選択は下の effect が保存した窓へ合わせる）。 */
  const loadWindows = () =>
    doFetch("/api/windows")
      .then((/** @type {any} */ r) => r.json())
      .then((/** @type {any} */ j) => {
        const view = windowListView(j);
        winEditedRef.current = false;
        setWinOptions(view.options);
        setVisionError(view.errorText);
      })
      .catch((/** @type {unknown} */ e) => setVisionError(requestErrorText("loadWindows", e)));

  /** 出力デバイス一覧の取得（選択は下の effect が保存した出力先へ合わせる）。 */
  const loadAudioDevices = () =>
    doFetch("/api/audio-devices")
      .then((/** @type {any} */ r) => r.json())
      .then((/** @type {any} */ j) => {
        const view = audioDeviceListView(j);
        audioEditedRef.current = false;
        setAudioOptions(view.options);
        setAudioError(view.errorText);
      })
      .catch((/** @type {unknown} */ e) => setAudioError(requestErrorText("loadAudioDevices", e)));

  // 初期ロード（独立 effect・並行）。コンポーネントは常時 mount なので 1 回だけ。
  useEffect(() => {
    loadDevices();
    loadWindows();
    loadAudioDevices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 保存した値を選んだ状態で出す（配信の組み直し Domain E・stream-restructure.md §6）: 一覧か保存した値（snapshot の
  // visionTarget.title / audioDevice.name）が届くたびに、選び直していなければ保存した値（一覧に無ければ先頭）へ合わせる。
  const savedWindow = settings && settings.visionTarget ? settings.visionTarget.title ?? null : null;
  useEffect(() => {
    setWinSelected((current) => savedDeviceSelection(winOptions, savedWindow, current, winEditedRef.current));
  }, [winOptions, savedWindow]);
  const savedAudioDevice = settings && settings.audioDevice ? settings.audioDevice.name ?? null : null;
  useEffect(() => {
    setAudioSelected((current) => savedDeviceSelection(audioOptions, savedAudioDevice, current, audioEditedRef.current));
  }, [audioOptions, savedAudioDevice]);

  // 記憶済み source の入力欄復元（入力中と欄が非空のときは上書きしない = shouldRestoreChatSource 経由）。
  useEffect(() => {
    const source = settings && settings.chat ? settings.chat.source : null;
    if (
      shouldRestoreChatSource({
        edited: chatEditedRef.current,
        currentValue: chatSourceRef.current,
        source
      })
    ) {
      chatSourceRef.current = source;
      setChatSource(source);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings]);

  // 圧縮を始める大きさの現況同期: snapshot.compaction.thresholdTokens が変わったら select 表示へ反映する。
  const compactCurrent = compactThresholdSelection(settings && settings.compaction);
  useEffect(() => {
    if (compactCurrent != null) setCompactSelected(compactCurrent);
  }, [compactCurrent]);

  // 文字起こしの選択の復元（state.stt.engine・ユーザーが選び直した後は上書きしない）。
  const sttRestored = sttEngineSelection(sttEngine ? { engine: sttEngine } : null);
  useEffect(() => {
    if (sttRestored != null && !sttEditedRef.current) setSttSelected(sttRestored);
  }, [sttRestored]);

  // ── ハンドラ（すべて「POST → view-logic で文言 → snapshot 適用」の同型フロー）──

  /**
   * 「配信を始める」（配信の準備のタブ）。メイン画面の「配信を始める」と同じ場の関数（POST /api/stream/start）を通り、
   * ここで選んだマイク・文字起こしを渡す（声の方式はロールの声・サーバが持つ）。始められなかった理由はサーバの
   * stream.error（メイン画面の中央が正・ここにも同じ値を出す）。要求そのものの失敗（通信・409）だけここで持つ。
   */
  const onStart = () => {
    const device = micSelected || null;
    setStartBusy(true);
    setStartRequestError("");
    sttEditedRef.current = false; // 始めた後はサーバーの記憶（state.stt.engine）に同期してよい。
    postJson("/api/stream/start", { device, sttEngine: sttSelected || "whisper" })
      .then((/** @type {any} */ res) => {
        if (res.ok) {
          applySnapshot(res.j);
          return;
        }
        if (res.j && res.j.state) applySnapshot(res.j.state);
        if (!(res.j && res.j.state && res.j.state.stream && res.j.state.stream.error)) {
          setStartRequestError(earsStartFailureText(res) || "配信を始められない");
        }
      })
      .catch((/** @type {unknown} */ e) => setStartRequestError(requestErrorText("earsStart", e)))
      .then(() => setStartBusy(false));
  };

  /** Channel Set（token 秘匿 = 成功後に入力欄クリア）。 */
  const onChannelSet = () => {
    setChannelError("");
    postJson("/api/channel", { url: channelUrl || "" })
      .then((/** @type {any} */ res) => {
        const err = channelPostErrorText(res);
        if (err != null) {
          setChannelError(err);
          return;
        }
        applySnapshot(res.j); // snapshot（redact 済み channel を含む）で状態を更新。
        setChannelUrl(""); //    生 URL（token）を入力欄に残さない。
      })
      .catch((/** @type {unknown} */ e) => setChannelError(requestErrorText("channel", e)));
  };

  /** Chat Connect（場の途中でも押せる・ふだんは場を開いてから URL を入れて押す）。 */
  const onChatConnect = () => {
    const source = chatSource || "";
    setChatError("");
    if (source.trim() === "") {
      setChatError(CHAT_EMPTY_SOURCE_ERROR);
      return;
    }
    setConnectBusy(true);
    postJson("/api/chat/connect", { source })
      .then((/** @type {any} */ res) => {
        const err = chatConnectErrorText(res);
        if (err != null) {
          setChatError(err);
          return;
        }
        chatEditedRef.current = false; // 記憶済み source への同期を再び許す。
        applySnapshot(res.j);
      })
      .catch((/** @type {unknown} */ e) => setChatError(requestErrorText("chatConnect", e)))
      .then(() => setConnectBusy(false));
  };

  /** Chat Disconnect（有効/無効は chatStatusView の state 駆動）。 */
  const onChatDisconnect = () => {
    setChatError("");
    doFetch("/api/chat/disconnect", { method: "POST" })
      .then((/** @type {any} */ r) => r.json())
      .then((/** @type {any} */ j) => applySnapshot(j))
      .catch((/** @type {unknown} */ e) => setChatError(requestErrorText("chatDisconnect", e)));
  };

  /** ゲームの窓の Set target。 */
  const onVisionSet = () => {
    setVisionError("");
    postJson("/api/vision-target", { title: winSelected || "" })
      .then((/** @type {any} */ res) => {
        const err = visionTargetPostErrorText(res);
        if (err != null) {
          setVisionError(err);
          return;
        }
        winEditedRef.current = false; // 保存した値に揃える。
        applySnapshot(res.j);
      })
      .catch((/** @type {unknown} */ e) => setVisionError(requestErrorText("visionTarget", e)));
  };

  /** 声の出力先の Set device（適用 = 常駐プレイヤーのその場再起動はサーバ側挙動）。 */
  const onAudioSet = () => {
    setAudioError("");
    postJson("/api/audio-device", { name: audioSelected || "" })
      .then((/** @type {any} */ res) => {
        const err = audioDevicePostErrorText(res);
        if (err != null) {
          setAudioError(err);
          return;
        }
        audioEditedRef.current = false; // 保存した値に揃える。
        applySnapshot(res.j);
      })
      .catch((/** @type {unknown} */ e) => setAudioError(requestErrorText("audioDevice", e)));
  };

  /**
   * 忙しい間のコメントの扱いの変更（配信の組み直し Domain E で運転のタブから配信の準備へ移した・POST /api/comment-busy）。
   * @param {any} ev
   */
  const onChangeCommentBusy = (ev) => {
    const policy = ev && ev.target ? ev.target.value : "hold";
    setCommentBusyError("");
    postJson("/api/comment-busy", { policy })
      .then((/** @type {any} */ res) => {
        const err = commentBusyPostErrorText(res);
        if (err != null) {
          setCommentBusyError(err);
          return;
        }
        applySnapshot(res.j);
      })
      .catch((/** @type {unknown} */ e) => setCommentBusyError(commentBusyRequestErrorText(e)));
  };

  /** 今日のロールの Set（POST /api/role → 成功で snapshot 反映。場の途中はサーバが 409 で断る）。 */
  const onRoleSet = () => {
    const role = roleSelected;
    if (!role) return;
    setRoleError("");
    doFetch("/api/role", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ role })
    })
      .then(responseOf)
      .then((/** @type {any} */ res) => {
        const err = rolePostErrorText(res);
        if (err != null) {
          setRoleError(err);
          return;
        }
        applySnapshot(res.j); // snapshot（role・brain）で状態を更新。
      })
      .catch((/** @type {unknown} */ e) => setRoleError(requestErrorText("role", e)));
  };

  /**
   * ロールの編集の下書きの 1 項目を書き換える。
   * @param {keyof import("../view-logic/role.mjs").RoleDraft} key
   * @param {string | boolean} value
   */
  const editRoleDraft = (key, value) => {
    setRoleEditError("");
    setRoleDraft((draft) => (draft ? { ...draft, [key]: value } : draft));
  };
  /** @param {keyof import("../view-logic/role.mjs").RoleDraft} key */
  const onRoleText = (key) => (/** @type {any} */ ev) => editRoleDraft(key, ev && ev.target ? ev.target.value : "");

  /** ロールの保存（POST /api/role/edit → 成功で snapshot 反映。場の途中はサーバが 409 で断る）。 */
  const onRoleSave = () => {
    if (!roleDraft) return;
    const built = rolePatchFromDraft(roleDraft);
    if (!built.ok) {
      setRoleEditError(built.error);
      return;
    }
    setRoleEditError("");
    setRoleEditBusy(true);
    postJson("/api/role/edit", built.patch)
      .then((/** @type {any} */ res) => {
        const err = roleEditPostErrorText(res);
        if (err != null) {
          setRoleEditError(err);
          return;
        }
        applySnapshot(res.j);
      })
      .catch((/** @type {unknown} */ e) => setRoleEditError(`role edit error: ${e}`))
      .then(() => setRoleEditBusy(false));
  };

  /** 今のロールを写して新しいロールを作る（POST /api/role/new → 作ったロールが今のロールになる）。 */
  const onRoleCreate = () => {
    const existing = roleOptionsView(settings && settings.role).map((o) => o.value);
    const err = newRoleIdError(newRoleId, existing);
    if (err != null) {
      setNewRoleError(err);
      return;
    }
    setNewRoleError("");
    setNewRoleBusy(true);
    postJson("/api/role/new", { id: newRoleId.trim(), name: newRoleName.trim() || null })
      .then((/** @type {any} */ res) => {
        const postErr = roleEditPostErrorText(res);
        if (postErr != null) {
          setNewRoleError(postErr);
          return;
        }
        setNewRoleId("");
        setNewRoleName("");
        applySnapshot(res.j);
      })
      .catch((/** @type {unknown} */ e) => setNewRoleError(`role new error: ${e}`))
      .then(() => setNewRoleBusy(false));
  };

  /** 圧縮を始める大きさの Set（POST /api/compact-threshold → 成功で snapshot 反映）。 */
  const onCompactThresholdSet = () => {
    const tokens = Number(compactSelected);
    setCompactError("");
    doFetch("/api/compact-threshold", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tokens })
    })
      .then(responseOf)
      .then((/** @type {any} */ res) => {
        const err = compactThresholdPostErrorText(res);
        if (err != null) {
          setCompactError(err);
          return;
        }
        applySnapshot(res.j); // snapshot（compaction: {thresholdTokens}）で状態を更新。
      })
      .catch((/** @type {unknown} */ e) => setCompactError(requestErrorText("compactThreshold", e)));
  };

  /**
   * Codex の fast の切り替え。controlled のため change はユーザー操作でのみ発火する。POST /api/codex-fast → 成功で
   * snapshot 反映（次の返事から効く）。
   * @param {any} ev
   */
  const onCodexFastToggle = (ev) => {
    const enabled = !!(ev && ev.target && ev.target.checked);
    setCodexFastError("");
    doFetch("/api/codex-fast", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ enabled })
    })
      .then(responseOf)
      .then((/** @type {any} */ res) => {
        const err = codexFastPostErrorText(res);
        if (err != null) {
          setCodexFastError(err);
          return;
        }
        applySnapshot(res.j); // snapshot（codexFast: {enabled, applicable, supported}）で状態を更新。
      })
      .catch((/** @type {unknown} */ e) => setCodexFastError(requestErrorText("codexFast", e)));
  };
  const codexFastView = codexFastToggleView(settings && settings.codexFast);

  /** 「今日を記録」（手動記録・POST /api/memory-record・場が開いている間だけ）。 */
  const onMemoryRecord = () => {
    setMemoryError("");
    setRecordBusy(true);
    doFetch("/api/memory-record", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" })
      .then(responseOf)
      .then((/** @type {any} */ res) => {
        const err = memoryRecordPostErrorText(res);
        if (err != null) {
          setMemoryError(err);
          return;
        }
        applySnapshot(res.j); // 200 応答は snapshot 全体（記録失敗はサーバ側で握って 200・failure-tolerant）。
      })
      .catch((/** @type {unknown} */ e) => setMemoryError(requestErrorText("memoryRecord", e)))
      .then(() => setRecordBusy(false));
  };

  const channelView = channelStatusView(settings && settings.channel);
  const chatView = chatStatusView(chatDisplay);
  const showChannel = channelFieldVisible(settings);
  const startView = streamStartView(settings && settings.stream, startRequestError);
  const recordView = memoryRecordButtonView(settings && settings.stream, recordBusy);
  const roleInputsDisabled = roleLocked || !roleEditable || !roleDraft;

  return html`
    <div class="cockpit-settings-backdrop" data-open=${open ? "true" : "false"} hidden=${!open}
      onClick=${(/** @type {any} */ ev) => { if (ev && ev.target === ev.currentTarget) requestClose(); }}>
    <section id="cockpit-settings-dialog" ref=${dialogRef}
      class=${"cockpit-settings-modal" + (open ? " open" : "")}
      role="dialog" aria-modal="true" aria-labelledby="cockpit-settings-title" tabIndex="-1">
      <div class="drawer-head cockpit-settings-head">
        <h2 id="cockpit-settings-title">準備・設定</h2>
        <button class="cockpit-settings-close" type="button" aria-label="Close settings" data-cockpit-settings-focus="true" onClick=${requestClose}>Close</button>
      </div>
      <nav class="cockpit-settings-tabs" aria-label="Settings categories" role="tablist">
        ${SETTINGS_CATEGORIES.map((category) => html`
          <button key=${category.id} id=${"cockpit-settings-tab-" + category.id}
            class="cockpit-settings-tab" type="button" role="tab"
            aria-selected=${activeCategory === category.id}
            aria-controls=${"cockpit-settings-panel-" + category.id}
            tabIndex=${activeCategory === category.id ? 0 : -1}
            onClick=${() => requestCategory(category.id)}>${category.label}</button>
          `)}
      </nav>
      ${closeWarning ? html`
        <div class="cockpit-settings-dirty-warning" role="status" aria-live="polite">
          <span>未保存の性格の指示があります。</span>
          <button type="button" onClick=${completeDiscardNavigation}>破棄して続ける</button>
          <button type="button" onClick=${continueCurrentConversationDraft}>編集を続ける</button>
        </div>
      ` : null}
      <div id="cockpit-settings-panel-prepare" class="drawer-section" data-settings-category="prepare" role="tabpanel" aria-labelledby="cockpit-settings-tab-prepare" hidden=${activeCategory !== "prepare"}>
        <h3>配信の準備</h3>
        <div class="drawer-row">
          <label for="chat-source">YouTube</label>
          <input
            id="chat-source"
            type="text"
            placeholder="https://youtube.com/watch?v=... / video ID / channel /live URL"
            autocomplete="off"
            spellcheck=${false}
            value=${chatSource}
            onInput=${(/** @type {any} */ ev) => {
              const v = ev && ev.target ? ev.target.value : "";
              chatEditedRef.current = true; // 入力中は記憶済み source で上書きしない。
              chatSourceRef.current = v;
              setChatSource(v);
            }}
          />
          <button class="btn-chat-connect" type="button" disabled=${connectBusy} onClick=${onChatConnect}>
            Connect
          </button>
          <button
            class="btn-chat-disconnect"
            type="button"
            disabled=${chatView.disconnectDisabled}
            onClick=${onChatDisconnect}
          >
            Disconnect
          </button>
        </div>
        <div class="drawer-note">
          <${DrawerStatus} view=${chatView} />
          <span class="err">${chatError}</span>
        </div>
        <div class="drawer-row">
          <label for="vision-target-select">ゲームの窓</label>
          <${SettingsSelect}
            id="vision-target-select"
            className="drawer-select vision-target-select"
            options=${winOptions}
            value=${winSelected}
            onChange=${(/** @type {any} */ ev) => {
              winEditedRef.current = true;
              setWinSelected(ev && ev.target ? ev.target.value : "");
            }}
          />
          <button class="btn-vision-refresh" type="button" onClick=${() => loadWindows()}>Refresh windows</button>
          <button class="btn-vision-target-set" type="button" onClick=${onVisionSet}>Set target</button>
        </div>
        <div class="drawer-note">
          <span class="vision-target-status">${visionTargetLabel(settings && settings.visionTarget)}</span>
          <span class="err">${visionError}</span>
        </div>
        ${showChannel ? html`
          <div class="drawer-row channel-row">
            <label for="channel-url">器（Channel）</label>
            <input
              id="channel-url"
              type="text"
              placeholder="ws://127.0.0.1:PORT/channel?token=..."
              autocomplete="off"
              spellcheck=${false}
              value=${channelUrl}
              onInput=${(/** @type {any} */ ev) => setChannelUrl(ev && ev.target ? ev.target.value : "")}
            />
            <button class="btn-channel-set" type="button" onClick=${onChannelSet}>Set</button>
          </div>
          <div class="drawer-note">
            <${DrawerStatus} view=${channelView} />
            <span class="err">${channelError}</span>
          </div>
        ` : html`
          <div class="drawer-note channel-bodyless-note">
            <${DrawerStatus} view=${channelView} />
            <span class="drawer-hint">このロールは体を使わない（器の URL は要らない）</span>
          </div>
        `}
        <details class="prepare-more">
          <summary>めったに替えないもの（マイク・文字起こし・声の出力先・忙しい間のコメント）</summary>
          <div class="drawer-row">
            <label for="device-select">マイク</label>
            <${SettingsSelect}
              id="device-select"
              className="drawer-select device-select"
              options=${micOptions}
              value=${micSelected}
              disabled=${inputsLocked}
              onChange=${(/** @type {any} */ ev) => setMicSelected(ev && ev.target ? ev.target.value : "")}
            />
          </div>
          <div class="drawer-row">
            <label for="stt-engine-select">文字起こし</label>
            <${SettingsSelect}
              id="stt-engine-select"
              className="drawer-select stt-engine-select"
              options=${STT_ENGINE_OPTIONS}
              value=${sttSelected}
              disabled=${inputsLocked}
              onChange=${(/** @type {any} */ ev) => {
                sttEditedRef.current = true;
                setSttSelected(ev && ev.target ? ev.target.value : "whisper");
              }}
            />
          </div>
          <div class="drawer-note">
            ${inputsLocked ? html`<span class="drawer-hint">${STREAM_LOCKED_INPUTS_NOTE}</span>` : null}
            <span class="err">${micError}</span>
          </div>
          <div class="drawer-row">
            <label for="audio-device-select">声の出力先</label>
            <${SettingsSelect}
              id="audio-device-select"
              className="drawer-select audio-device-select"
              options=${audioOptions}
              value=${audioSelected}
              onChange=${(/** @type {any} */ ev) => {
                audioEditedRef.current = true;
                setAudioSelected(ev && ev.target ? ev.target.value : "");
              }}
            />
            <button class="btn-audio-refresh" type="button" onClick=${() => loadAudioDevices()}>
              Refresh devices
            </button>
            <button class="btn-audio-device-set" type="button" onClick=${onAudioSet}>Set device</button>
          </div>
          <div class="drawer-note">
            <span class="audio-device-status">${voiceOutputLabel(settings && settings.audioDevice)}</span>
            <span class="err">${audioError}</span>
          </div>
          <div class="drawer-row">
            <${CommentBusySelect} commentBusy=${settings && settings.commentBusy} onChange=${onChangeCommentBusy} />
          </div>
          <div class="drawer-note"><span class="err">${commentBusyError}</span></div>
        </details>
        ${startView.phase === "open" ? html`
          <div class="drawer-note prepare-start-note">
            <span class="drawer-hint">配信中（終えるときは下の帯の「配信を終える」）</span>
          </div>
        ` : html`
          <div class="drawer-row prepare-start">
            <button class="btn-start" type="button" disabled=${startBusy || startView.startDisabled} onClick=${onStart}>
              ${startView.startText}
            </button>
            ${startView.noteText ? html`<span class="drawer-hint">${startView.noteText}</span>` : null}
          </div>
          <div class="drawer-note">
            <span class="err start-error" role=${startView.errorText ? "alert" : null}>${startView.errorText}</span>
          </div>
        `}
      </div>
      <div id="cockpit-settings-panel-role" class="drawer-section" data-settings-category="role" role="tabpanel" aria-labelledby="cockpit-settings-tab-role" hidden=${activeCategory !== "role"}>
        ${conversationEditorOpen ? html`
          <div class="cockpit-settings-prompt-slot" data-prompt-editor-slot>
            ${promptEditorSlot || html`
              <${ConversationInstructionEditor}
                roleId=${editorRoleId || null}
                roleName=${currentRole ? currentRole.displayName : null}
                brainLabel=${currentRole && currentRole.brain ? BRAIN_LABELS[currentRole.brain] || "unknown" : "unknown"}
                state=${conversationEditorState}
                soulSkills=${conversationEditor.getSoulSkills()}
                locked=${roleLocked}
                onBack=${requestEditorBack}
                onEdit=${(/** @type {any} */ ev) => conversationEditor.edit(editorRoleId, ev && ev.target ? ev.target.value : "")}
                onSave=${() => conversationEditor.save(editorRoleId)}
                onReset=${() => conversationEditor.reset(editorRoleId)}
              />
            `}
          </div>
        ` : html`
          <h3>ロール</h3>
          <div class="drawer-row">
            <label for="role-select">今日のロール</label>
            <${SettingsSelect}
              id="role-select"
              className="drawer-select role-select"
              options=${roleOptionsView(settings && settings.role)}
              value=${roleSelected}
              disabled=${roleLocked}
              onChange=${(/** @type {any} */ ev) => setRoleSelected(ev && ev.target ? ev.target.value : "")}
            />
            <button class="btn-role-set" type="button" disabled=${roleLocked} onClick=${onRoleSet}>Set</button>
          </div>
          <div class="drawer-note">
            <span class="brain-status">${brainLabel(settings && settings.brain)}</span>
            <span class="brain-credential-status">${brainCredentialHealthLabel(settings && settings.brain)}</span>
            ${roleLocked ? html`<span class="drawer-hint">${roleLockedNote(roleLocked)}</span>` : null}
            <span class="err">${roleError}</span>
          </div>
          <h3 class="drawer-subhead">ロールの編集${roleDraft ? `（${roleDraft.id}）` : ""}</h3>
          ${roleEditable ? null : html`<div class="drawer-note"><span class="drawer-hint">ロールの置き場が無いので直せない（引っ越しに失敗した起動）</span></div>`}
          <div class="drawer-row">
            <label for="role-display">見せる名前</label>
            <input id="role-display" type="text" autocomplete="off" value=${roleDraft ? roleDraft.display : ""}
              disabled=${roleInputsDisabled} onInput=${onRoleText("display")} />
          </div>
          <div class="drawer-row">
            <label for="role-canonical">呼び名</label>
            <input id="role-canonical" type="text" autocomplete="off" value=${roleDraft ? roleDraft.canonical : ""}
              disabled=${roleInputsDisabled} onInput=${onRoleText("canonical")} />
          </div>
          <div class="drawer-row">
            <label for="role-latin">ローマ字</label>
            <input id="role-latin" type="text" autocomplete="off" value=${roleDraft ? roleDraft.latin : ""}
              disabled=${roleInputsDisabled} onInput=${onRoleText("latin")} />
          </div>
          <div class="drawer-row">
            <label for="role-model-select">モデル</label>
            <${SettingsSelect}
              id="role-model-select"
              className="drawer-select role-model-select"
              options=${ROLE_MODEL_OPTIONS}
              value=${roleDraft ? roleDraft.brain : ""}
              disabled=${roleInputsDisabled}
              onChange=${onRoleText("brain")}
            />
          </div>
          <div class="drawer-row">
            <label>性格の指示</label>
            <button class="conversation-instruction-open" type="button" disabled=${!editorRoleId} onClick=${() => {
              setConversationEditorOpen(true);
              conversationEditor.load(editorRoleId);
            }}>
              性格の指示を編集
            </button>
          </div>
          <div class="drawer-row">
            <label for="role-voice-engine-select">声</label>
            <${SettingsSelect}
              id="role-voice-engine-select"
              className="drawer-select role-voice-engine-select"
              options=${ROLE_VOICE_ENGINE_OPTIONS}
              value=${roleDraft ? roleDraft.voiceEngine : "aivis"}
              disabled=${roleInputsDisabled}
              onChange=${onRoleText("voiceEngine")}
            />
          </div>
          <div class="drawer-row">
            <label for="role-aivis-speaker">AivisSpeech の話者</label>
            <input id="role-aivis-speaker" type="text" inputmode="numeric" autocomplete="off" placeholder="空なら既定（起動引数 --speaker が上書き）"
              value=${roleDraft ? roleDraft.aivisSpeaker : ""} disabled=${roleInputsDisabled} onInput=${onRoleText("aivisSpeaker")} />
          </div>
          <div class="drawer-row">
            <label for="role-elevenlabs-voice">ElevenLabs の声の id</label>
            <input id="role-elevenlabs-voice" type="text" autocomplete="off" placeholder="空なら既定"
              value=${roleDraft ? roleDraft.elevenLabsVoiceId : ""} disabled=${roleInputsDisabled} onInput=${onRoleText("elevenLabsVoiceId")} />
          </div>
          <div class="drawer-row">
            <label>しゃべり方</label>
            <${VerbositySelect} verbosity=${roleDraft ? roleDraft.verbosity : null} disabled=${roleInputsDisabled}
              onChange=${onRoleText("verbosity")} />
            <${SpeakStartSelect} speakStart=${roleDraft ? roleDraft.speakStartMode : null} disabled=${roleInputsDisabled}
              onChange=${onRoleText("speakStartMode")} />
          </div>
          <div class="drawer-row">
            <label class="role-body-pill">
              <span class="pill-label">体</span>
              <input type="checkbox" class="role-body-toggle" checked=${roleDraft ? roleDraft.body : true}
                disabled=${roleInputsDisabled}
                onChange=${(/** @type {any} */ ev) => editRoleDraft("body", !!(ev && ev.target && ev.target.checked))} />
              <span class="drawer-hint">runtime-player の器を使う</span>
            </label>
          </div>
          <div class="drawer-row">
            <button class="btn-role-save" type="button" disabled=${roleInputsDisabled || roleEditBusy || !roleDraftIsDirty} onClick=${onRoleSave}>
              ロールを保存
            </button>
          </div>
          <div class="drawer-note">
            <span class="drawer-hint">保存すると次の「配信を始める」から効く</span>
            <span class="err">${roleEditError}</span>
          </div>
          <h3 class="drawer-subhead">新しいロール</h3>
          <div class="drawer-row">
            <label for="new-role-id">id</label>
            <input id="new-role-id" type="text" autocomplete="off" spellcheck=${false} placeholder="英小文字（例: mio）"
              value=${newRoleId} disabled=${roleLocked || !roleEditable}
              onInput=${(/** @type {any} */ ev) => { setNewRoleError(""); setNewRoleId(ev && ev.target ? ev.target.value : ""); }} />
            <input id="new-role-name" type="text" autocomplete="off" placeholder="名前（空なら id）" aria-label="新しいロールの名前"
              value=${newRoleName} disabled=${roleLocked || !roleEditable}
              onInput=${(/** @type {any} */ ev) => setNewRoleName(ev && ev.target ? ev.target.value : "")} />
            <button class="btn-role-new" type="button" disabled=${roleLocked || !roleEditable || newRoleBusy} onClick=${onRoleCreate}>
              今のロールを写して作る
            </button>
          </div>
          <div class="drawer-note"><span class="err">${newRoleError}</span></div>
          <h3 class="drawer-subhead">会話の圧縮</h3>
          <div class="drawer-row">
            <label for="compact-threshold-select">圧縮を始める大きさ</label>
            <${SettingsSelect}
              id="compact-threshold-select"
              className="drawer-select compact-threshold-select"
              options=${compactThresholdOptions(Number(compactSelected))}
              value=${compactSelected}
              onChange=${(/** @type {any} */ ev) => setCompactSelected(ev && ev.target ? ev.target.value : String(COMPACT_THRESHOLD_DEFAULT_TOKENS))}
            />
            <button class="btn-compact-threshold-set" type="button" onClick=${onCompactThresholdSet}>Set</button>
          </div>
          <div class="drawer-note">
            <span class="compact-threshold-status">${compactThresholdStatusLabel(settings && settings.compaction)}</span>
            <span class="compact-threshold-hint">${COMPACT_THRESHOLD_NOTE}</span>
            <span class="err">${compactError}</span>
          </div>
          <h3 class="drawer-subhead">返事の速さ</h3>
          <div class="drawer-row">
            <label class="codex-fast-pill">
              <span class="pill-label">Codex の fast</span>
              <input
                type="checkbox"
                class="codex-fast-toggle"
                disabled=${codexFastView.disabled}
                checked=${codexFastView.checked}
                onChange=${onCodexFastToggle}
              />
              <span class=${codexFastView.statusClassName}>${codexFastView.statusText}</span>
            </label>
          </div>
          <div class="drawer-note">
            <span class="codex-fast-state">${codexFastStatusLabel(settings && settings.codexFast)}</span>
            <span class="codex-fast-hint">${CODEX_FAST_NOTE}</span>
            <span class="err">${codexFastError}</span>
          </div>
        `}
      </div>
      <div id="cockpit-settings-panel-drive" class="drawer-section" data-settings-category="drive" role="tabpanel" aria-labelledby="cockpit-settings-tab-drive" hidden=${activeCategory !== "drive"}>
        <h3>運転</h3>
        ${driveSlot}
      </div>
      <div id="cockpit-settings-panel-memory" class="drawer-section" data-settings-category="memory" role="tabpanel" aria-labelledby="cockpit-settings-tab-memory" hidden=${activeCategory !== "memory"}>
        <h3>記憶</h3>
        <div class="drawer-note memory-place">
          <span class="memory-place-label">${memoryPlaceLabel(settings && settings.memory)}</span>
        </div>
        <div class="drawer-row">
          <button class="btn-memory-record" type="button" disabled=${recordView.disabled} onClick=${onMemoryRecord}>
            今日を記録
          </button>
        </div>
        <div class="drawer-note">
          <span class="memory-status-label">${memoryStatusLabel(settings && settings.memory)}</span>
          ${recordView.note ? html`<span class="drawer-hint">${recordView.note}</span>` : null}
          <span class="err">${memoryError}</span>
        </div>
      </div>
      <div id="cockpit-settings-panel-log" class="drawer-section log-section" data-settings-category="log" role="tabpanel" aria-labelledby="cockpit-settings-tab-log" hidden=${activeCategory !== "log"}>
        ${typeof logSlot === "function" ? logSlot(!!open && activeCategory === "log") : logSlot}
      </div>
    </section>
    </div>
  `;
}

// Backwards-compatible name retained for existing imports while the rendered
// surface is now the accessible Cockpit Settings modal.
export const SettingsDrawer = CockpitSettingsModal;
