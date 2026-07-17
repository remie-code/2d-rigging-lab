// @ts-check
/**
 * view-logic: 設定引き出し（接続 / 入出力）の表示導出（preact 非依存の純関数）。
 *
 * 操縦席 UI 改定 Domain C の追加抽出。現 cockpit.html の設定系ハンドラ（loadDevices / loadWindows /
 * loadAudioDevices の一覧構築・各 POST の失敗文言・視界の現況表示）から DOM 構築 / fetch 配線を
 * 剥がして「応答 JSON → 表示構造体 / 文字列」の導出だけを取り出す。機能同値（fixture で固定）。
 * 加えて導線（cockpit-redesign.md §4）の「初回 = 設定空なら引き出しを自動展開」の判定式
 * `shouldAutoOpenSettings` をここで固定する（stateLoaded ガードは app.mjs 側・fixture 固定）。
 *
 * 様式統一（全 view-logic 共通・L0 裁定）: 行テキスト=文字列・状態導出={text, className, …}構造体・
 * **非表示（エラーなし）= null**。
 *
 * 対応（現 cockpit.html）:
 *  - visionTargetLabel        → :317-322 `applyVisionTarget(vt)`（title 無しは "not configured"）
 *  - micDeviceListView        → :704-726 `loadDevices()` の一覧/エラー欄構築
 *  - windowListView           → :592-613 `loadWindows()` の一覧/エラー欄構築
 *  - audioDeviceListView      → :656-677 `loadAudioDevices()` の一覧/エラー欄構築
 *  - initialDeviceSelection   → :698-703 `selectDeviceIfPresent` + :721（lastDevice を初期選択・
 *                                無ければ先頭 = select 要素の既定選択と同値）
 *  - visionTargetPostErrorText→ :624-627 POST /api/vision-target 応答の失敗文言
 *  - audioDevicePostErrorText → :688-691 POST /api/audio-device 応答の失敗文言
 *  - channelPostErrorText     → :762-765 POST /api/channel 応答の失敗文言
 *  - chatConnectErrorText     → :787-791 POST /api/chat/connect 応答の失敗文言（400 = invalid source）
 *  - CHAT_EMPTY_SOURCE_ERROR  → :779 空 source で Connect を押した時の文言
 *  - earsStartFailureText     → :740-742 POST /api/ears/start 応答の失敗文言（409/500 とも !ok）
 *  - requestErrorText         → 各 fetch catch の文言（:611 :629 :675 :693 :724 :748 :768 :794 :802 :809）
 *
 * 多頭化 Domain C（brain-swap-wave-plan.md §3）追加抽出:
 *  - brainPostErrorText → POST /api/brain 応答の失敗文言（audioDevicePostErrorText の写経・
 *    503=未注入・!ok="set failed: error"・成功は null）。
 */

/**
 * 視覚発火の対象ウインドウの現況表示（applyVisionTarget :317-322）。
 * @param {{ title?: string | null } | null | undefined} vt  state snapshot の visionTarget。
 * @returns {string}
 */
export function visionTargetLabel(vt) {
  return vt && vt.title ? vt.title : "not configured";
}

/**
 * @typedef {{ options: Array<{ value: string; label: string }>; errorText: string }} DeviceListView
 */

/**
 * マイク一覧（GET /api/devices 応答）→ select の option 列 + エラー欄文言（loadDevices :704-726）。
 * 空一覧は「(device enumeration failed)」（error あり）/「(no input devices)」（error なし）の
 * 単一 option（value ""・:708-712）。エラー欄は `"devices: " + error`（:722・一覧があっても出る）。
 * @param {{ devices?: Array<{ name: string }> | null; error?: string | null } | null | undefined} j
 * @returns {DeviceListView}
 */
export function micDeviceListView(j) {
  const error = (j && j.error) || null;
  const errorText = error ? "devices: " + error : "";
  if (!j || !j.devices || j.devices.length === 0) {
    return { options: [{ value: "", label: error ? "(device enumeration failed)" : "(no input devices)" }], errorText };
  }
  return { options: j.devices.map((d) => ({ value: d.name, label: d.name })), errorText };
}

/**
 * ウインドウ一覧（GET /api/windows 応答）→ select の option 列 + エラー欄文言（loadWindows :592-613）。
 * option は value=title・label="title (processName)"（:604-605）。空一覧は
 * 「(window enumeration failed)」/「(no windows)」（:596-600）。エラー欄は `"windows: " + error`（:609）。
 * @param {{ windows?: Array<{ title: string; processName?: string }> | null; error?: string | null } | null | undefined} j
 * @returns {DeviceListView}
 */
export function windowListView(j) {
  const error = (j && j.error) || null;
  const errorText = error ? "windows: " + error : "";
  if (!j || !j.windows || j.windows.length === 0) {
    return { options: [{ value: "", label: error ? "(window enumeration failed)" : "(no windows)" }], errorText };
  }
  return {
    options: j.windows.map((w) => ({ value: w.title, label: w.title + " (" + w.processName + ")" })),
    errorText
  };
}

/**
 * 出力デバイス一覧（GET /api/audio-devices 応答）→ select の option 列 + エラー欄文言
 * （loadAudioDevices :656-677）。空一覧は「(device enumeration failed)」/「(no output devices)」
 * （:660-664）。エラー欄は `"devices: " + error`（:673）。
 * @param {{ devices?: Array<{ name: string }> | null; error?: string | null } | null | undefined} j
 * @returns {DeviceListView}
 */
export function audioDeviceListView(j) {
  const error = (j && j.error) || null;
  const errorText = error ? "devices: " + error : "";
  if (!j || !j.devices || j.devices.length === 0) {
    return { options: [{ value: "", label: error ? "(device enumeration failed)" : "(no output devices)" }], errorText };
  }
  return { options: j.devices.map((d) => ({ value: d.name, label: d.name })), errorText };
}

/**
 * 一覧ロード直後の select 初期選択値。preferred（GET /api/devices の lastDevice 等）が一覧に
 * あればそれ（selectDeviceIfPresent :698-703 + :721）・無ければ先頭（DOM の select が先頭を
 * 既定選択する挙動と同値）・一覧が空なら ""。
 * @param {Array<{ value: string; label: string }>} options
 * @param {string | null | undefined} [preferred]
 * @returns {string}
 */
export function initialDeviceSelection(options, preferred) {
  if (preferred && options.some((o) => o.value === preferred)) return preferred;
  return options.length > 0 ? options[0].value : "";
}

/**
 * 設定 POST の共通失敗文言（503 = 未注入・!ok = "set failed: error"・成功 = null）。
 * @param {{ status: number; ok: boolean; j?: { error?: string | null } | null }} res
 * @param {string} notAvailableText
 * @returns {string | null}
 */
function settingPostErrorText(res, notAvailableText) {
  if (res.status === 503) return notAvailableText;
  if (!res.ok) return "set failed: " + ((res.j && res.j.error) || "error");
  return null;
}

/**
 * POST /api/vision-target 応答 → エラー文言（:624-627）。成功は null。
 * @param {{ status: number; ok: boolean; j?: { error?: string | null } | null }} res
 * @returns {string | null}
 */
export function visionTargetPostErrorText(res) {
  return settingPostErrorText(res, "vision target control not available");
}

/**
 * POST /api/audio-device 応答 → エラー文言（:688-691）。成功は null。
 * @param {{ status: number; ok: boolean; j?: { error?: string | null } | null }} res
 * @returns {string | null}
 */
export function audioDevicePostErrorText(res) {
  return settingPostErrorText(res, "audio device control not available");
}

/**
 * POST /api/channel 応答 → エラー文言（:762-765）。成功は null（呼び出し側は snapshot を適用し
 * **入力欄をクリアする** = 生 URL（token）を入力欄に残さない :766）。
 * @param {{ status: number; ok: boolean; j?: { error?: string | null } | null }} res
 * @returns {string | null}
 */
export function channelPostErrorText(res) {
  return settingPostErrorText(res, "channel control not available");
}

/**
 * POST /api/brain 応答 → エラー文言（多頭化 Domain C・audioDevicePostErrorText の写経）。成功は null。
 * @param {{ status: number; ok: boolean; j?: { error?: string | null } | null }} res
 * @returns {string | null}
 */
export function brainPostErrorText(res) {
  return settingPostErrorText(res, "brain control not available");
}

/**
 * POST /api/chat/connect 応答 → エラー文言（:787-791）。
 * 503 = chat 未結線・400 = invalid source・その他 !ok = connect failed。成功は null。
 * @param {{ status: number; ok: boolean; j?: { error?: string | null } | null }} res
 * @returns {string | null}
 */
export function chatConnectErrorText(res) {
  if (res.status === 503) return "chat not available (start cockpit normally to enable live chat)";
  if (res.status === 400) return "invalid source: " + ((res.j && res.j.error) || "error");
  if (!res.ok) return "connect failed: " + ((res.j && res.j.error) || "error");
  return null;
}

/** 空 source で Connect を押した時の文言（:779）。 */
export const CHAT_EMPTY_SOURCE_ERROR = "enter a stream URL / video ID first";

/**
 * POST /api/ears/start 応答 → 失敗文言（:740-742）。!ok（409 transitioning / 500 とも）は
 * "start failed: error"・成功は null（呼び出し側は snapshot を適用しエラー欄をクリア :743-745）。
 * @param {{ ok: boolean; j?: { error?: string | null } | null }} res
 * @returns {string | null}
 */
export function earsStartFailureText(res) {
  if (res.ok) return null;
  return "start failed: " + ((res.j && res.j.error) || "error");
}

/** fetch catch 文言のプレフィックス表（現 cockpit.html の各 catch と 1:1）。 */
const REQUEST_ERROR_PREFIX = {
  loadDevices: "failed to load devices", //          :724
  loadWindows: "failed to load windows", //          :611
  loadAudioDevices: "failed to load audio devices", // :675
  earsStart: "start error", //                       :748
  earsStop: "stop error", //                         :809
  visionTarget: "vision target error", //            :629
  audioDevice: "audio device error", //              :693
  channel: "channel error", //                       :768
  chatConnect: "chat connect error", //              :794
  chatDisconnect: "chat disconnect error", //        :802
  brain: "brain error" //   多頭化 Domain C（POST /api/brain・audioDevice の写経）
};

/**
 * fetch 失敗（catch）のエラー欄文言。e の文字列化は原実装と同じ文字列連結（"prefix: " + e）。
 * @param {keyof typeof REQUEST_ERROR_PREFIX} kind
 * @param {unknown} e
 * @returns {string}
 */
export function requestErrorText(kind, e) {
  return REQUEST_ERROR_PREFIX[kind] + ": " + e;
}

/**
 * 導線（cockpit-redesign.md §4）: 初回（設定が空）は設定引き出しを自動展開・二回目以降
 * （何か記憶済み）は観測フィードへ直行、の判定式。
 *
 * 入力は **GET /api/state の成功応答 snapshot**（呼び出し側 = app.mjs が「取得完了
 * （stateLoaded=true）後に一度だけ」呼ぶ・fetch 完了前/失敗時の誤展開はそのガードで防ぐ）。
 *
 * 「設定済み（= 二回目以降）」とみなす材料（6 設定キーのうち snapshot に「未設定」と区別可能な
 * 形で載るもの + 稼働状態）:
 *  - channel.configured     … 器 Channel URL 記憶済み
 *  - visionTarget.title     … 視界（ゲーム窓）記憶済み
 *  - audioDevice.name       … 声の出力先記憶済み
 *  - chat.source            … YouTube 配信 source 記憶済み
 *  - device                 … 耳が現デバイスで稼働中（タブ開き直し = 観測直行が正）
 * ※ lastDevice（マイク記憶）は snapshot に載らず（GET /api/devices 応答のみ）判定に使わない。
 * ※ selfFire は {enabled} | null（scheduler 有無）で「未記憶」と「明示 false」が snapshot 上
 *   区別できないため判定に使わない。
 * @param {any} s  GET /api/state の snapshot。
 * @returns {boolean}  true = 設定が空（初回）→ 自動展開。
 */
export function shouldAutoOpenSettings(s) {
  if (!s) return false; // snapshot 欠落では開かない（誤展開防止・観測直行が既定）。
  if (s.channel && s.channel.configured) return false;
  if (s.visionTarget && s.visionTarget.title) return false;
  if (s.audioDevice && s.audioDevice.name) return false;
  if (s.chat && s.chat.source) return false;
  if (s.device) return false;
  return true;
}
