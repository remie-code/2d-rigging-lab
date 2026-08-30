// @ts-check
/**
 * ui: Cockpit Settings modal（⚙ で開閉・cockpit-redesign.md §3/§7: 接続 / 入出力の区画見出し・
 * ラベル幅揃え・select は chevron 付き・状態は色ドット + 文言・角丸 14px パネル・普段は畳む）。
 *
 * 現 cockpit.html の設定系セクションの移植先:
 *  - 接続: 器 Channel（:172-178 :753-770）/ YouTube Live chat（:182-189 :775-803）
 *  - 入出力: マイク + Start/Stop（:163-169 :697-750 :804-811）/ 声の出力先（:207-212 :654-695）/
 *    視界 = ゲーム窓（:192-199 :591-631）
 *  - 各区画のエラー欄: devices-error（:168）→ マイク行 / channel-error（:177）→ Channel 行 /
 *    chat-error（:188）→ chat 行 / vision-error（:198）→ 視界行 / conversation-error（:212）は
 *    IA 再配置で分割 —— 音声出力系はここ（声の出力先行）・自発トグル系は運転バー（control-bar.mjs）。
 *  - 頭脳・会話（Domain C）: technical brain の選択/Set に加え、同じダイアログ内で
 *    conversation-instruction editor へ切り替える。編集本文だけを dedicated API へ保存し、
 *    identity と memory structure は読み取り専用で表示する。
 *  - 記憶（配信間記憶・stream-memory-wave-plan.md §3 Domain B）: 頭脳区画の写経で新区画を追加。
 *    ON/OFF トグル（memoryToggleView・POST /api/memory・controlled component=selfFire/bargeIn pill と
 *    同型の一方向データフロー）+「今日を記録」ボタン（POST /api/memory-record）+ drawer-note に
 *    「記憶 N 件を搭載（最新: ...）」（memoryStatusLabel）。
 *
 * 表示文字列・状態導出はすべて view-logic 経由（settings.mjs / status.mjs / health.mjs・L0 裁定）。
 * 挙動の保存点:
 *  - token 秘匿: Channel Set 成功後に入力欄をクリア（:766・生 URL を残さない）。表示は redact 済み
 *    snapshot の channelStatusView。
 *  - Disconnect の有効/無効は chatStatusView（state 駆動・dead/未接続は無効）経由 = 単一経路。
 *  - source 記憶復元は shouldRestoreChatSource（ユーザー入力中 = chatSourceEdited は復元しない・
 *    Connect 成功で再び復元を許す :791）。
 *  - マイクは lastDevice を初期選択（:721 selectDeviceIfPresent）・Start/Stop 中は両ボタン disable
 *    （:729 setBusy 相当）。
 *  - 声の出力先の適用（常駐プレイヤーのその場再起動）はサーバ側挙動（POST 応答適用のみ担う）。
 *
 * 初期ロード（loadDevices/loadWindows/loadAudioDevices 相当・:900 :905-906）は本コンポーネントの
 * **独立 effect**（domain-b.md §8-8 の裁定: 原実装 init の直列順序はサーバ側に依存なし・並行で
 * ワイヤ契約上安全）。開閉は CSS（.open クラス）で行い、コンポーネントは常時 mount
 * = 初期ロードは 1 回だけ・入力欄のローカル状態は開閉で消えない。
 *
 * props 契約（app.mjs が結線する・domain-b.md §2 / Domain C editor integration）:
 *  - open:          boolean       開閉状態（⚙ トグル・初回自動展開の判定は app.mjs）。
 *  - onClose:       () => void    ✕ ボタン。
 *  - settings:      settingsFromSnapshot の値（channel/visionTarget/selfFire/audioDevice/chat 生現況）。
 *  - chatDisplay:   string | null renderChatStatus 入力（chatStatusView へ渡す表示 state・単一経路）。
 *  - applySnapshot: (s) => void   POST 応答（snapshot）の適用（applyStateRef.current 共有）。
 *  - fetchImpl:     任意          fetch の注入（既定は関数実行時に globalThis.fetch を参照）。
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
  visionTargetPostErrorText,
  audioDevicePostErrorText,
  channelPostErrorText,
  chatConnectErrorText,
  CHAT_EMPTY_SOURCE_ERROR,
  earsStartFailureText,
  requestErrorText,
  brainPostErrorText,
  memoryToggleView,
  memoryPostErrorText,
  memoryRecordPostErrorText,
  memoryStatusLabel
} from "../view-logic/settings.mjs";
import { chatStatusView, channelStatusView, shouldRestoreChatSource } from "../view-logic/status.mjs";
import { voiceOutputLabel, BRAIN_LABELS, brainLabel, brainCredentialHealthLabel } from "../view-logic/health.mjs";
import {
  CONVERSATION_INSTRUCTION_BRAIN_IDS,
  createConversationInstructionController
} from "../view-logic/conversation-instruction.mjs";
import { ConversationInstructionEditor } from "./conversation-instruction-editor.mjs";

/**
 * 頭脳 select の選択肢（多頭化 Domain C）。BRAIN_LABELS（view-logic/health.mjs）から機械的に組み立てる
 * ——唯一の宣言（id→表示ラベル）は health.mjs 側に集約し、ここでは複製しない。cockpit-server.mjs が
 * 「頭 id 2 値を直書きする」責務境界規律と同型（settings-drawer.mjs は src/mind/brains.mjs を import
 * しない）。
 * @type {Array<{ value: string; label: string }>}
 */
const BRAIN_OPTIONS = Object.keys(BRAIN_LABELS).map((id) => ({ value: id, label: BRAIN_LABELS[id] }));

/**
 * chevron 付き select（hooks 非使用・vnode 走査テスト対象）。option 列は view-logic の
 * DeviceListView（{value, label}）を機械的に描くだけ。
 * id は label の for と対にする（Domain C design レビュー non-blocking 1 の解消 = Domain D ついで修正:
 * 旧実装は select に id があり label クリックでフォーカスが飛んだ・その a11y を保存する）。
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
 * 設定引き出し本体。
 * @param {{ open?: boolean; onClose?: () => void; settings: any; chatDisplay?: string | null;
 *           applySnapshot: (s: any) => void; fetchImpl?: any }} props
 */
export const SETTINGS_CATEGORIES = Object.freeze([
  Object.freeze({ id: "connections", label: "接続" }),
  Object.freeze({ id: "input-output", label: "入出力" }),
  Object.freeze({ id: "brain-conversation", label: "頭脳・会話" }),
  Object.freeze({ id: "memory", label: "記憶" })
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
 * Shared executable navigation seam for every close/back/category/brain path.
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
 * @param {{ eventType: string; dirty?: boolean; action: () => void; onPrompt: (action: () => void) => void }} input
 * @returns {"prompt" | "proceed" | null}
 */
export function settingsModalEventRoute({ eventType, dirty, action, onPrompt }) {
  if (!["close", "back", "category-click", "category-keyboard", "brain"].includes(eventType)) return null;
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

/**
 * Accessible Cockpit Settings modal. The component stays mounted while closed
 * so immediate-control input state survives a close/reopen cycle. The
 * conversation editor is a page within this same dialog; it never creates a
 * nested dialog or changes existing immediate-setting endpoint handlers.
 *
 * @param {{ open?: boolean; onClose?: () => void; settings: any; chatDisplay?: string | null;
 *   applySnapshot: (s: any) => void; fetchImpl?: any; promptEditorSlot?: any;
 *   draftDirty?: boolean; dirty?: boolean; onDiscardDraft?: () => void; onContinueDraft?: () => void;
 *   closeRequestRef?: { current: (() => void) | null } }} props
 */
export function CockpitSettingsModal({
  open,
  onClose,
  settings,
  chatDisplay,
  applySnapshot,
  fetchImpl,
  promptEditorSlot,
  draftDirty = false,
  dirty = false,
  onDiscardDraft,
  onContinueDraft,
  closeRequestRef
}) {
  // ── マイク（:163-169 :697-750）──
  const [micOptions, setMicOptions] = useState(/** @type {Array<{value:string;label:string}>} */ ([]));
  const [micSelected, setMicSelected] = useState("");
  const [micBusy, setMicBusy] = useState(false); // setBusy :729（Start/Stop 両 disable）。
  const [micError, setMicError] = useState(""); //  devices-error :168（一覧/start/stop の共用欄）。
  // ── 器 Channel（:172-178 :753-770）──
  const [channelUrl, setChannelUrl] = useState("");
  const [channelError, setChannelError] = useState(""); // channel-error :177
  // ── YouTube chat（:182-189 :775-803）──
  const [chatSource, setChatSource] = useState("");
  const chatSourceRef = useRef(""); //   復元判定用の現在値（:311 input.value 相当）。
  const chatEditedRef = useRef(false); // chatSourceEdited :288（入力中は復元しない）。
  const [chatError, setChatError] = useState(""); // chat-error :188
  const [connectBusy, setConnectBusy] = useState(false); // :780 Connect 連打防止。
  // ── 視界 = ゲーム窓（:192-199 :591-631）──
  const [winOptions, setWinOptions] = useState(/** @type {Array<{value:string;label:string}>} */ ([]));
  const [winSelected, setWinSelected] = useState("");
  const [visionError, setVisionError] = useState(""); // vision-error :198
  // ── 声の出力先（:207-212 :654-695）──
  const [audioOptions, setAudioOptions] = useState(/** @type {Array<{value:string;label:string}>} */ ([]));
  const [audioSelected, setAudioSelected] = useState("");
  const [audioError, setAudioError] = useState(""); // conversation-error :212 の音声出力系。
  // ── 頭脳（多頭化 Domain C・声の出力先行の写経）──
  const [brainSelected, setBrainSelected] = useState("claude");
  const [brainError, setBrainError] = useState("");
  // ── 記憶（配信間記憶・頭脳区画の写経）──
  const [memoryError, setMemoryError] = useState("");
  const [recordBusy, setRecordBusy] = useState(false); // 「今日を記録」の連打防止（Fire ボタンの localBusy と同型）。

  const [activeCategory, setActiveCategory] = useState("connections");
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
  const conversationEditorState = conversationEditor.getState(brainSelected);
  const currentSnapshotBrain = settings && settings.brain && settings.brain.brain;
  const [closeWarning, setCloseWarning] = useState(false);
  const pendingNavigationRef = useRef(/** @type {(() => void) | null} */ (null));
  const dialogRef = useRef(/** @type {HTMLElement | null} */ (null));
  const previousFocusRef = useRef(/** @type {HTMLElement | null} */ (null));
  const wasOpenRef = useRef(false);
  const isDraftDirty = !!(draftDirty || dirty || (conversationEditorOpen && conversationEditorState.dirty));
  const doFetch = (/** @type {string} */ path, /** @type {any} */ init) =>
    (fetchImpl || globalThis.fetch)(path, init);

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
    conversationEditor.discard(brainSelected);
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
    if (categoryId === activeCategory && (!conversationEditorOpen || categoryId === "brain-conversation")) return;
    runGuardedNavigation(() => {
      setActiveCategory(categoryId);
      if (categoryId !== "brain-conversation") setConversationEditorOpen(false);
      if (typeof afterNavigation === "function") afterNavigation();
    }, eventType);
  };

  const requestEditorBack = () => runGuardedNavigation(() => setConversationEditorOpen(false), "back");

  const requestEditorBrain = (/** @type {any} */ ev) => {
    const nextBrain = ev && ev.target ? ev.target.value : "";
    if (!CONVERSATION_INSTRUCTION_BRAIN_IDS.includes(nextBrain)) return;
    if (nextBrain === brainSelected) return;
    runGuardedNavigation(() => setBrainSelected(nextBrain), "brain");
  };

  useEffect(() => {
    if (CONVERSATION_INSTRUCTION_BRAIN_IDS.includes(currentSnapshotBrain) && !conversationEditorOpen) {
      setBrainSelected(currentSnapshotBrain);
    }
  }, [currentSnapshotBrain, conversationEditorOpen]);

  useEffect(() => {
    if (conversationEditorOpen && !conversationEditorState.loaded && conversationEditorState.status === "idle") {
      conversationEditor.load(brainSelected);
    }
  }, [conversationEditorOpen, brainSelected, conversationEditorState.loaded, conversationEditorState.status]);

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

  /** マイク一覧の取得（loadDevices :704-726・lastDevice 初期選択 :721）。 */
  const loadDevices = () =>
    doFetch("/api/devices")
      .then((/** @type {any} */ r) => r.json())
      .then((/** @type {any} */ j) => {
        const view = micDeviceListView(j);
        setMicOptions(view.options);
        setMicSelected(initialDeviceSelection(view.options, j && j.lastDevice));
        setMicError(view.errorText); // :722（成功は ""・エラー併記は原実装同値）。
      })
      .catch((/** @type {unknown} */ e) => setMicError(requestErrorText("loadDevices", e))); // :723-724

  /** ウインドウ一覧の取得（loadWindows :592-613・選択は先頭へ = DOM 再構築と同値）。 */
  const loadWindows = () =>
    doFetch("/api/windows")
      .then((/** @type {any} */ r) => r.json())
      .then((/** @type {any} */ j) => {
        const view = windowListView(j);
        setWinOptions(view.options);
        setWinSelected(initialDeviceSelection(view.options, null));
        setVisionError(view.errorText); // :609
      })
      .catch((/** @type {unknown} */ e) => setVisionError(requestErrorText("loadWindows", e))); // :610-611

  /** 出力デバイス一覧の取得（loadAudioDevices :656-677・選択は先頭へ）。 */
  const loadAudioDevices = () =>
    doFetch("/api/audio-devices")
      .then((/** @type {any} */ r) => r.json())
      .then((/** @type {any} */ j) => {
        const view = audioDeviceListView(j);
        setAudioOptions(view.options);
        setAudioSelected(initialDeviceSelection(view.options, null));
        setAudioError(view.errorText); // :673
      })
      .catch((/** @type {unknown} */ e) => setAudioError(requestErrorText("loadAudioDevices", e))); // :674-675

  // 初期ロード（独立 effect・並行・domain-b.md §8-8 裁定）。コンポーネントは常時 mount なので 1 回だけ。
  useEffect(() => {
    loadDevices();
    loadWindows();
    loadAudioDevices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 記憶済み source の入力欄復元（applyChat :309-311 と同じ「snapshot 到着ごと」の判定・
  // 入力中（chatEditedRef）と欄が非空のときは上書きしない = shouldRestoreChatSource 経由）。
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

  // 頭脳 select の現況同期（多頭化 Domain C）: snapshot.brain.brain（起動時の現況 / POST /api/brain 後の
  // 反映）が既知 4 値（2026-07-17 追撃で claude/codex の 2 値から Codex 側 2 頭を追加）なら select 表示へ
  // 反映する。マイク/視界/出力先と違い一覧取得 API を持たない固定選択肢のため、select の初期値・以後の
  // 現況表示はこの effect が担う（未知値/欠落は変更しない）。既知値の集合は BRAIN_OPTIONS（health.mjs の
  // BRAIN_LABELS 由来）と同じ語彙——ここも「頭 id を直書きする」責務境界規律に合わせ、BRAIN_OPTIONS の
  // value 集合をそのまま使う（複製の decay を避ける）。
  const brainCurrent = settings && settings.brain ? settings.brain.brain : null;
  useEffect(() => {
    if (BRAIN_OPTIONS.some((o) => o.value === brainCurrent)) setBrainSelected(/** @type {string} */ (brainCurrent));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brainCurrent]);

  // ── ハンドラ（すべて「POST → view-logic で文言 → snapshot 適用」の同型フロー）──

  /** Start（:730-750）。 */
  const onStart = () => {
    const device = micSelected || null; // :731
    setMicBusy(true); //                    :732 setBusy(true)
    doFetch("/api/ears/start", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ device }) })
      .then((/** @type {any} */ r) => r.json().then((/** @type {any} */ j) => ({ ok: r.ok, j })))
      .then((/** @type {any} */ res) => {
        const err = earsStartFailureText(res);
        if (err != null) {
          setMicError(err); //                        :741
          applySnapshot(res.j && res.j.state); //     :742（失敗応答は {error, state} 形）
        } else {
          setMicError(""); //                         :744
          applySnapshot(res.j); //                    :745（成功応答は snapshot）
        }
      })
      .catch((/** @type {unknown} */ e) => setMicError(requestErrorText("earsStart", e))) // :747-748
      .then(() => setMicBusy(false)); //              :749 setBusy(false)
  };

  /** Stop（:804-811・エラー欄クリアは無し = 原実装踏襲）。 */
  const onStop = () => {
    setMicBusy(true); // :805
    doFetch("/api/ears/stop", { method: "POST" })
      .then((/** @type {any} */ r) => r.json())
      .then((/** @type {any} */ j) => applySnapshot(j)) //                                  :808
      .catch((/** @type {unknown} */ e) => setMicError(requestErrorText("earsStop", e))) // :809
      .then(() => setMicBusy(false)); //                                                    :810
  };

  /** Channel Set（:753-770・token 秘匿 = 成功後に入力欄クリア）。 */
  const onChannelSet = () => {
    const raw = channelUrl || ""; // :754
    setChannelError(""); //          :755
    doFetch("/api/channel", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: raw })
    })
      .then((/** @type {any} */ r) => r.json().then((/** @type {any} */ j) => ({ ok: r.ok, status: r.status, j })))
      .then((/** @type {any} */ res) => {
        const err = channelPostErrorText(res); // :763-764
        if (err != null) {
          setChannelError(err);
          return;
        }
        applySnapshot(res.j); // :765 snapshot（redact 済み channel を含む）で状態を更新。
        setChannelUrl(""); //    :766 生 URL（token）を入力欄に残さない。
      })
      .catch((/** @type {unknown} */ e) => setChannelError(requestErrorText("channel", e))); // :767-768
  };

  /** Chat Connect（:776-796）。 */
  const onChatConnect = () => {
    const source = chatSource || ""; // :777
    setChatError(""); //                :778
    if (source.trim() === "") {
      setChatError(CHAT_EMPTY_SOURCE_ERROR); // :779
      return;
    }
    setConnectBusy(true); // :780
    doFetch("/api/chat/connect", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ source })
    })
      .then((/** @type {any} */ r) => r.json().then((/** @type {any} */ j) => ({ ok: r.ok, status: r.status, j })))
      .then((/** @type {any} */ res) => {
        const err = chatConnectErrorText(res); // :788-790
        if (err != null) {
          setChatError(err);
          return;
        }
        chatEditedRef.current = false; // :791 記憶済み source への同期を再び許す。
        applySnapshot(res.j); //          :792 snapshot（chat.connected/state を含む）で状態を更新。
      })
      .catch((/** @type {unknown} */ e) => setChatError(requestErrorText("chatConnect", e))) // :793-794
      .then(() => setConnectBusy(false)); // :795
  };

  /** Chat Disconnect（:797-803・有効/無効は chatStatusView の state 駆動）。 */
  const onChatDisconnect = () => {
    setChatError(""); // :798
    doFetch("/api/chat/disconnect", { method: "POST" })
      .then((/** @type {any} */ r) => r.json())
      .then((/** @type {any} */ j) => applySnapshot(j)) // :801
      .catch((/** @type {unknown} */ e) => setChatError(requestErrorText("chatDisconnect", e))); // :802
  };

  /** 視界の Set target（:615-631）。 */
  const onVisionSet = () => {
    const title = winSelected || ""; // :616
    setVisionError(""); //              :617
    doFetch("/api/vision-target", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title })
    })
      .then((/** @type {any} */ r) => r.json().then((/** @type {any} */ j) => ({ ok: r.ok, status: r.status, j })))
      .then((/** @type {any} */ res) => {
        const err = visionTargetPostErrorText(res); // :625-626
        if (err != null) {
          setVisionError(err);
          return;
        }
        applySnapshot(res.j); // :627 applyVisionTarget(res.j.visionTarget) と同源（応答は snapshot 全体）。
      })
      .catch((/** @type {unknown} */ e) => setVisionError(requestErrorText("visionTarget", e))); // :628-629
  };

  /** 声の出力先の Set device（:679-695・適用 = 常駐プレイヤーのその場再起動はサーバ側挙動）。 */
  const onAudioSet = () => {
    const name = audioSelected || ""; // :680
    setAudioError(""); //                :681
    doFetch("/api/audio-device", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name })
    })
      .then((/** @type {any} */ r) => r.json().then((/** @type {any} */ j) => ({ ok: r.ok, status: r.status, j })))
      .then((/** @type {any} */ res) => {
        const err = audioDevicePostErrorText(res); // :688-690
        if (err != null) {
          setAudioError(err);
          return;
        }
        applySnapshot(res.j); // :691 applyAudioDevice(res.j.audioDevice) と同源（応答は snapshot 全体）。
      })
      .catch((/** @type {unknown} */ e) => setAudioError(requestErrorText("audioDevice", e))); // :692-693
  };

  /** 頭脳の Set（多頭化 Domain C・onAudioSet の写経）。POST /api/brain → 成功で snapshot 反映。 */
  const onBrainSet = () => {
    const brain = brainSelected || "claude";
    setBrainError("");
    doFetch("/api/brain", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ brain })
    })
      .then((/** @type {any} */ r) => r.json().then((/** @type {any} */ j) => ({ ok: r.ok, status: r.status, j })))
      .then((/** @type {any} */ res) => {
        const err = brainPostErrorText(res);
        if (err != null) {
          setBrainError(err);
          return;
        }
        applySnapshot(res.j); // snapshot（brain: {brain, credentialHealth}）で状態を更新。
      })
      .catch((/** @type {unknown} */ e) => setBrainError(requestErrorText("brain", e)));
  };

  /**
   * 記憶 ON/OFF トグル（selfFire/bargeIn pill と同型の controlled component・onToggleSelfFire の写経）。
   * change はユーザー操作でのみ発火する（programmatic な checked 反映は change を発火しない）。
   */
  const onToggleMemory = (/** @type {any} */ ev) => {
    const enabled = !!(ev && ev.target && ev.target.checked);
    setMemoryError("");
    doFetch("/api/memory", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ enabled })
    })
      .then((/** @type {any} */ r) => r.json().then((/** @type {any} */ j) => ({ ok: r.ok, status: r.status, j })))
      .then((/** @type {any} */ res) => {
        const err = memoryPostErrorText(res);
        if (err != null) {
          setMemoryError(err);
          return;
        }
        applySnapshot(res.j); // 200 応答は snapshot 全体（selfFire/bargeIn 経路と同源）。
      })
      .catch((/** @type {unknown} */ e) => setMemoryError(requestErrorText("memory", e)));
  };

  /** 「今日を記録」（onAudioSet の写経・手動記録・POST /api/memory-record）。 */
  const onMemoryRecord = () => {
    setMemoryError("");
    setRecordBusy(true);
    doFetch("/api/memory-record", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" })
      .then((/** @type {any} */ r) => r.json().then((/** @type {any} */ j) => ({ ok: r.ok, status: r.status, j })))
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
  const memoryView = memoryToggleView(settings && settings.memory);

  return html`
    <div class="cockpit-settings-backdrop" data-open=${open ? "true" : "false"} hidden=${!open}
      onClick=${(/** @type {any} */ ev) => { if (ev && ev.target === ev.currentTarget) requestClose(); }}>
    <section id="cockpit-settings-dialog" ref=${dialogRef}
      class=${"cockpit-settings-modal" + (open ? " open" : "")}
      role="dialog" aria-modal="true" aria-labelledby="cockpit-settings-title" tabIndex="-1">
      <div class="drawer-head cockpit-settings-head">
        <h2 id="cockpit-settings-title">Cockpit Settings</h2>
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
          <span>未保存の会話指示があります。</span>
          <button type="button" onClick=${completeDiscardNavigation}>破棄して続ける</button>
          <button type="button" onClick=${continueCurrentConversationDraft}>編集を続ける</button>
        </div>
      ` : null}
      <div id="cockpit-settings-panel-connections" role="tabpanel"
        aria-labelledby="cockpit-settings-tab-connections" hidden=${activeCategory !== "connections"}>
      <div class="drawer-section" data-settings-category="connections" hidden=${activeCategory !== "connections"}>
        <h3>接続</h3>
        <div class="drawer-row">
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
              chatEditedRef.current = true; // :775 入力中は記憶済み source で上書きしない。
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
      </div>
      </div>
      <div id="cockpit-settings-panel-input-output" class="drawer-section" data-settings-category="input-output" role="tabpanel" aria-labelledby="cockpit-settings-tab-input-output" hidden=${activeCategory !== "input-output"}>
        <h3>入出力</h3>
        <div class="drawer-row">
          <label for="device-select">マイク</label>
          <${SettingsSelect}
            id="device-select"
            className="drawer-select device-select"
            options=${micOptions}
            value=${micSelected}
            onChange=${(/** @type {any} */ ev) => setMicSelected(ev && ev.target ? ev.target.value : "")}
          />
          <button class="btn-start" type="button" disabled=${micBusy} onClick=${onStart}>Start</button>
          <button class="btn-stop" type="button" disabled=${micBusy} onClick=${onStop}>Stop</button>
        </div>
        <div class="drawer-note">
          <span class="err">${micError}</span>
        </div>
        <div class="drawer-row">
          <label for="audio-device-select">声の出力先</label>
          <${SettingsSelect}
            id="audio-device-select"
            className="drawer-select audio-device-select"
            options=${audioOptions}
            value=${audioSelected}
            onChange=${(/** @type {any} */ ev) => setAudioSelected(ev && ev.target ? ev.target.value : "")}
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
          <label for="vision-target-select">視界（ゲーム窓）</label>
          <${SettingsSelect}
            id="vision-target-select"
            className="drawer-select vision-target-select"
            options=${winOptions}
            value=${winSelected}
            onChange=${(/** @type {any} */ ev) => setWinSelected(ev && ev.target ? ev.target.value : "")}
          />
          <button class="btn-vision-refresh" type="button" onClick=${() => loadWindows()}>Refresh windows</button>
          <button class="btn-vision-target-set" type="button" onClick=${onVisionSet}>Set target</button>
        </div>
        <div class="drawer-note">
          <span class="vision-target-status">${visionTargetLabel(settings && settings.visionTarget)}</span>
          <span class="err">${visionError}</span>
        </div>
      </div>
      <div id="cockpit-settings-panel-brain-conversation" class="drawer-section" data-settings-category="brain-conversation" role="tabpanel" aria-labelledby="cockpit-settings-tab-brain-conversation" hidden=${activeCategory !== "brain-conversation"}>
        ${conversationEditorOpen ? html`
          <div class="cockpit-settings-prompt-slot" data-prompt-editor-slot>
            ${promptEditorSlot || html`
              <${ConversationInstructionEditor}
                brainId=${brainSelected}
                brainLabel=${BRAIN_LABELS[brainSelected] || "unknown"}
                identity=${settings && settings.brain ? settings.brain.identity : null}
                activeBrainId=${currentSnapshotBrain || null}
                memory=${settings && settings.memory}
                state=${conversationEditorState}
                onBrainChange=${requestEditorBrain}
                onBack=${requestEditorBack}
                onEdit=${(/** @type {any} */ ev) => conversationEditor.edit(brainSelected, ev && ev.target ? ev.target.value : "")}
                onSave=${() => conversationEditor.save(brainSelected)}
                onReset=${() => conversationEditor.reset(brainSelected)}
              />
            `}
          </div>
        ` : html`
          <h3>頭脳</h3>
          <div class="drawer-row">
            <label for="brain-select">頭脳</label>
            <${SettingsSelect}
              id="brain-select"
              className="drawer-select brain-select"
              options=${BRAIN_OPTIONS}
              value=${brainSelected}
              onChange=${(/** @type {any} */ ev) => setBrainSelected(ev && ev.target ? ev.target.value : "")}
            />
            <button class="btn-brain-set" type="button" onClick=${onBrainSet}>Set</button>
          </div>
          <div class="drawer-note">
            <span class="brain-status">${brainLabel(settings && settings.brain)}</span>
            <span class="brain-credential-status">${brainCredentialHealthLabel(settings && settings.brain)}</span>
            <span class="err">${brainError}</span>
          </div>
          <button class="conversation-instruction-open" type="button" onClick=${() => {
            setConversationEditorOpen(true);
            conversationEditor.load(brainSelected);
          }}>
            会話指示を編集
          </button>
        `}
      </div>
      <div id="cockpit-settings-panel-memory" class="drawer-section" data-settings-category="memory" role="tabpanel" aria-labelledby="cockpit-settings-tab-memory" hidden=${activeCategory !== "memory"}>
        <h3>記憶</h3>
        <div class="drawer-row">
          <label for="memory-toggle">記憶</label>
          <input
            id="memory-toggle"
            type="checkbox"
            class="memory-toggle"
            disabled=${memoryView.disabled}
            checked=${memoryView.checked}
            onChange=${onToggleMemory}
          />
          <span class=${memoryView.statusClassName}>${memoryView.statusText}</span>
          <button class="btn-memory-record" type="button" disabled=${recordBusy} onClick=${onMemoryRecord}>
            今日を記録
          </button>
        </div>
        <div class="drawer-note">
          <span class="memory-status-label">${memoryStatusLabel(settings && settings.memory)}</span>
          <span class="err">${memoryError}</span>
        </div>
      </div>
    </section>
    </div>
  `;
}

// Backwards-compatible name retained for existing imports while the rendered
// surface is now the accessible Cockpit Settings modal.
export const SettingsDrawer = CockpitSettingsModal;
