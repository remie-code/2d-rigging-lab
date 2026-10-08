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
 *  - channelStatusView      → :347-359 `applyChannel(ch)`（connected=緑/error=赤/connecting=黄/他=muted）
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

/**
 * channel 状態の表示（テキスト + 接続色クラス）。redact 済み state.channel を受ける。
 * 未設定（configured でない）なら "not configured"。
 * @param {{ configured?: boolean; url?: string | null; connection?: string | null } | null | undefined} ch
 * @returns {{ text: string; className: string }}
 */
export function channelStatusView(ch) {
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
