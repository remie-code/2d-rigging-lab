// @ts-check
/**
 * view-logic: 接続状態の表示導出（preact 非依存の純関数）。
 *
 * 「chat state → 表示文字列 + class + Disconnect の有効/無効」「channel の redact 状態 → 色クラス」を
 * 純関数へ括り出す。現 cockpit.html の該当ロジックと機能同値（fixture で固定）。
 *
 * 対応（現 cockpit.html）:
 *  - chatStatusView         → :294-306 `renderChatStatus(state)`
 *                             （Disconnect 有効/無効を **chat state の値** で一貫決定する単一経路。
 *                              connecting/live/retrying=有効・dead/未接続=無効。connected 真偽で決めない
 *                              ＝ ended→dead 後の snapshot 再送で誤って再有効化しない・domain-c.md §2 契約）
 *  - shouldRestoreChatSource → :311 `if (!chatSourceEdited && input.value === "" && c.source) ...`
 *                             （記憶済み source を入力欄に復元・ユーザー入力中なら上書きしない）
 *  - chatAutoConnectHint    → YouTube の欄の案内（この起動で入れた URL は「配信を始める」でつなぐ・前回の起動から
 *                             残っているだけの URL はつながない・配信の組み直し 仕上げ）
 *  - channelStatusView      → :347-359 `applyChannel(ch)`（connected=緑/error=赤/connecting=黄/他=muted・
 *                             体なしのロールは「体なし」・配信の組み直し Domain C）
 *  - chatDisplayFromSseStatus → :880-885 SSE "chatStatus"（`d.status || "connecting"` の既定畳み。
 *                             snapshot 側 chatDisplayState と対で、chat 表示 state の正規化を本モジュールへ
 *                             片寄せする = 単一経路・Domain C 統合）
 */

/**
 * chat 状態の表示（テキスト・className・Disconnect の disabled）。
 * state が falsy（未接続）なら "not connected"・Disconnect 無効。
 * @param {string | null | undefined} state  connecting / live / retrying / dead など。
 * @returns {{ text: string; className: string; disconnectDisabled: boolean }}
 */
export function chatStatusView(state) {
  if (!state) {
    return { text: "not connected", className: "chat-status", disconnectDisabled: true };
  }
  return {
    text: state,
    className: "chat-status " + state,
    // 稼働状態（connecting/live/retrying）でのみ Disconnect 有効。dead も未接続も無効。
    disconnectDisabled: !(state === "connecting" || state === "live" || state === "retrying")
  };
}

/**
 * chat の connected/state を chatStatusView の入力（表示用 state）へ畳む。
 * connected=false は未接続（null）・connected=true は state（無ければ connecting 扱い）。
 * 現 cockpit.html:314 `renderChatStatus(c.connected ? (c.state || "connecting") : null)` と同値。
 * @param {{ connected?: boolean; state?: string | null } | null | undefined} chat
 * @returns {string | null}
 */
export function chatDisplayState(chat) {
  if (!chat || !chat.connected) return null;
  return chat.state || "connecting";
}

/**
 * SSE "chatStatus" イベント → chat 表示 state（chatStatusView の入力）への正規化。
 * status 欠落は "connecting" 扱い。現 cockpit.html:884 `d.status || "connecting"` と同値
 * （snapshot 側は chatDisplayState が担う = 正規化の単一経路を本モジュールに集約）。
 * @param {{ status?: string | null } | null | undefined} d  SSE chatStatus ペイロード。
 * @returns {string}
 */
export function chatDisplayFromSseStatus(d) {
  return (d && d.status) || "connecting";
}

/**
 * 記憶済み source を入力欄へ復元してよいか（ユーザーが入力中でなく・欄が空で・source がある）。
 * @param {object} args
 * @param {boolean} args.edited        ユーザーが入力欄を触ったか（chatSourceEdited）。
 * @param {string}  args.currentValue  入力欄の現在値。
 * @param {string | null | undefined} args.source  記憶済み source。
 * @returns {boolean}
 */
export function shouldRestoreChatSource({ edited, currentValue, source }) {
  return !edited && currentValue === "" && !!source;
}

/** YouTube の欄の案内: この起動で入れた URL（「配信を始める」でつなぐ）。 */
export const CHAT_CONNECT_ON_START_HINT = "配信を始めるとつなぐ";
/** YouTube の欄の案内: 前回の起動から欄に残っているだけの URL（自動ではつながない）。 */
export const CHAT_PREVIOUS_SOURCE_HINT = "前回の URL（自動ではつながない。今日の URL を入れるか Connect を押す）";

/**
 * YouTube の欄に添える案内（配信の組み直し 仕上げ・体験の素描 場面 3 の注記: この起動で入れた・Connect した URL は
 * 「配信を始める」がつなぐ。前回の起動から欄に残っているだけの URL はつながない）。場が閉じていて、まだつながって
 * いないときだけ出す（場の途中は Connect でつなぐので案内しない）。stream を持たない古いサーバ（null）は出さない。
 * @param {{ source?: string | null; connected?: boolean; enteredThisBoot?: boolean } | null | undefined} chat  snapshot の chat。
 * @param {{ phase?: string } | null | undefined} stream  snapshot の stream。
 * @returns {string | null}
 */
export function chatAutoConnectHint(chat, stream) {
  if (!chat || chat.connected) return null;
  const phase = stream && typeof stream.phase === "string" ? stream.phase : null;
  if (phase !== "closed") return null;
  if (chat.enteredThisBoot === true) return CHAT_CONNECT_ON_START_HINT;
  if (chat.source) return CHAT_PREVIOUS_SOURCE_HINT;
  return null;
}

/**
 * channel 状態の表示（テキスト + 接続色クラス）。redact 済み state.channel を受ける。
 * 未設定（configured でない）なら "not configured"。
 * 配信の組み直し Domain C: 今のロールに体が無い（`body: false`）なら、URL や接続の有無に関わらず「体なし」
 * （器を使わないので、未設定や error を問題として見せない）。`body` を持たない状態は今どおり。
 * @param {{ configured?: boolean; url?: string | null; connection?: string | null; body?: boolean } | null | undefined} ch
 * @returns {{ text: string; className: string }}
 */
export function channelStatusView(ch) {
  if (ch && ch.body === false) {
    return { text: "体なし", className: "channel-status bodyless" };
  }
  if (!ch || !ch.configured) {
    return { text: "not configured", className: "channel-status" };
  }
  const conn = ch.connection || "idle";
  const suffix =
    conn === "connected" ? "connected" : conn === "error" ? "error" : conn === "connecting" ? "connecting" : "";
  return {
    text: (ch.url || "(configured)") + " — " + conn,
    // 原実装は末尾に空文字を足すため idle 等では "channel-status "（末尾スペース）になる＝それを踏襲。
    className: "channel-status " + suffix
  };
}
