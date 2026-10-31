// @ts-check
/**
 * view-logic: 設定のダイアログ（準備・設定）の表示導出（preact 非依存の純関数）。配信の組み直し Domain E からタブは
 * 配信の準備 / ロール / 運転 / 記憶 / ログの 5 つ（旧「接続」「入出力」「頭脳・会話」のタブは無い・下の行番号つきの対応は
 * 抽出した当時の cockpit.html の記録）。
 *
 * 操縦席 UI 改定 Domain C の追加抽出。現 cockpit.html の設定系ハンドラ（loadDevices / loadWindows /
 * loadAudioDevices の一覧構築・各 POST の失敗文言・視界の現況表示）から DOM 構築 / fetch 配線を
 * 剥がして「応答 JSON → 表示構造体 / 文字列」の導出だけを取り出す。機能同値（fixture で固定）。
 * （旧導線の「初回 = 設定空なら引き出しを自動展開」の判定式 shouldAutoOpenSettings は、操縦席の作り直しで
 * 初回の自動展開をやめた（cockpit-glance-redesign.md §7・§9.2）ため削除した。配信前は会話の場所の中央の
 * 「準備・設定を開く」が入口。）
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
 *  - chatConnectErrorText     → :787-791 POST /api/chat/connect 応答の失敗文言（400 = invalid source・409 = 配信を
 *                                始めている / 終えている途中は断る（配信の組み直し 仕上げ）・サーバの文面をそのまま）
 *  - chatSourceSaveErrorText  → POST /api/chat/source（YouTube の欄に入れた値の保存・配信の組み直し 仕上げ）の失敗文言
 *  - CHAT_EMPTY_SOURCE_ERROR  → :779 空 source で Connect を押した時の文言
 *  - earsStartFailureText     → :740-742 「配信を始める」（POST /api/stream/start・旧 POST /api/ears/start は別名で同じ）
 *                                応答の失敗文言（409/500 とも !ok）
 *  - requestErrorText         → 各 fetch catch の文言（:611 :629 :675 :693 :724 :748 :768 :794 :802 :809）
 *
 * 多頭化 Domain C（brain-swap-wave-plan.md §3）追加抽出:
 *  - rolePostErrorText → POST /api/role 応答の失敗文言（配信の組み直し Domain A で旧 brainPostErrorText /
 *    POST /api/brain から置き換え・audioDevicePostErrorText の写経・
 *    503=未注入・!ok="set failed: error"・成功は null）。
 *
 * 配信間記憶（記憶区画が settings-drawer に置かれるためここへ抽出。記憶の作り直し Wave 2 で ON/OFF と
 * 「N 件を搭載」を撤去し、「最後に記録した時刻」と「今日を記録」だけを残した）:
 *  - memoryRecordPostErrorText → POST /api/memory-record 応答の失敗文言（503=未注入。手動記録
 *    自体の失敗はサーバ側で握って 200 を返す契約=このヘルパーは 503/その他 !ok のみを文言化する）。
 *  - memoryStatusLabel      → 「最後に記録: HH:MM:SS」（まだなら「まだ記録なし」・記録中なら「（記録中…）」を足す）。
 *    lastRecordAtMs はローカル時刻表示へ変換（format-time.mjs の formatClock を再利用）。
 *
 * 圧縮を始める大きさ（頭の調整・配信の組み直し Domain E からロールのタブの下・旧「頭脳・会話」タブ・
 * context-growth-2026-10.md §8 の後の合意 2026-10-19）:
 *  - COMPACT_THRESHOLD_*            → 既定 20 万・範囲 5 万〜45 万・1 万刻み（src/mind/context-compactor.mjs の定数と
 *                                     同じ値。画面は src/mind を import できないので写しを持ち、テストで一致を固定する）。
 *  - compactThresholdOptions        → select の選択肢（万トークン・既定に「（既定）」）。
 *  - compactThresholdSelection      → state snapshot の compaction.thresholdTokens を選択肢の値へ。
 *  - compactThresholdStatusLabel    → 「いま 20 万トークン（既定）」の表示文言。
 *  - COMPACT_THRESHOLD_NOTE         → Codex の頭のときだけ効く旨の短い説明。
 *  - compactThresholdPostErrorText  → POST /api/compact-threshold 応答の失敗文言（rolePostErrorText の写経）。
 *
 * Codex の fast（頭の調整・ロールのタブの下・旧「頭脳・会話」タブ・①チャッピーの Codex の頭だけ・2026-10-27 合意）:
 *  - codexFastToggleView    → チェックボックスの状態（snapshot の codexFast・無ければ使えない）。
 *  - codexFastStatusLabel   → 今の効き方（Claude の頭では効かない・モデルが非対応・いま fast / 通常）。
 *  - CODEX_FAST_NOTE        → ①だけに効く・使用量が増える・次の返事から効く旨の短い説明。
 *  - codexFastPostErrorText → POST /api/codex-fast 応答の失敗文言（compactThresholdPostErrorText の写経）。
 */

import { formatClock } from "./format-time.mjs";

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
 * 保存した値を選んだ状態で出す select の選択値（配信の組み直し Domain E・stream-restructure.md §6: ゲームの窓・声の出力先）。
 * ユーザーが選び直している間（edited）で、その値がまだ一覧にあればそのまま。そうでなければ保存した値（一覧に無ければ先頭・
 * 一覧が空なら ""）。一覧と保存した値（snapshot）の届く順に関わらず、届くたびに呼んでよい。
 * @param {Array<{ value: string; label: string }>} options
 * @param {string | null | undefined} saved
 * @param {string} current
 * @param {boolean} edited
 * @returns {string}
 */
export function savedDeviceSelection(options, saved, current, edited) {
  if (edited && options.some((o) => o.value === current)) return current;
  return initialDeviceSelection(options, saved);
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
 * POST /api/role 応答 → エラー文言（配信の組み直し Domain A・旧 POST /api/brain・audioDevicePostErrorText の写経）。
 * 成功は null。耳が動いている間の 409・知らないロールの 400 はサーバの理由をそのまま出す。
 * @param {{ status: number; ok: boolean; j?: { error?: string | null } | null }} res
 * @returns {string | null}
 */
export function rolePostErrorText(res) {
  return settingPostErrorText(res, "role control not available");
}

// ── 配信間記憶: 「今日を記録」と最後に記録した時刻の表示導出（settings-drawer「記憶」区画）─────

/**
 * POST /api/memory-record 応答 → エラー文言（rolePostErrorText の写経）。成功は null。
 * サーバ側は記録失敗（②書き出し役・コミットの失敗を含む）を握って 200 を返す契約
 * （failure-tolerant）なので、ここが非 null を返すのは 503（未注入）等の配線レベルの失敗のみ。
 * @param {{ status: number; ok: boolean; j?: { error?: string | null } | null }} res
 * @returns {string | null}
 */
export function memoryRecordPostErrorText(res) {
  return settingPostErrorText(res, "memory record control not available");
}

/**
 * 記憶の状態表示文言（「最後に記録: HH:MM:SS」・まだなら「最後に記録: まだ記録なし」）。記録中（保存の係が②を
 * 走らせている間）は「（記録中…）」を足す。lastRecordAtMs はこのプロセス内で記録が一度も成立していなければ null。
 * memory が null / undefined（未注入）は "not available"。
 * @param {{ lastRecordAtMs?: number | null; recording?: boolean } | null | undefined} memory
 * @returns {string}
 */
export function memoryStatusLabel(memory) {
  if (!memory) return "not available";
  const last = typeof memory.lastRecordAtMs === "number" ? formatClock(memory.lastRecordAtMs) : "まだ記録なし";
  return `最後に記録: ${last}${memory.recording === true ? "（記録中…）" : ""}`;
}

/**
 * 記憶のタブの見出しの下: どのロールの記憶か（配信の組み直し Domain E・cockpit.mjs の memoryPlaces.placeInfo の roleId / dir）。
 * 記憶の引っ越しに失敗した起動（available:false）はその旨。roleId を持たない古いサーバ・未注入は ""（何も出さない）。
 * @param {{ available?: boolean; roleId?: string | null; roleName?: string | null; dir?: string | null } | null | undefined} memory
 * @returns {string}
 */
export function memoryPlaceLabel(memory) {
  if (!memory) return "";
  if (memory.available === false) return "記憶の引っ越しに失敗したので、この起動では記憶を読み書きしない（次の起動でもう一度確かめる）";
  if (typeof memory.roleId !== "string" || memory.roleId === "") return "";
  const name = typeof memory.roleName === "string" && memory.roleName.trim() ? memory.roleName : memory.roleId;
  return `${name} の記憶（${typeof memory.dir === "string" && memory.dir ? memory.dir : memory.roleId}）`;
}

/**
 * 「今日を記録」ボタン（配信の組み直し Domain D・E: 場が開いている間だけ押せる見た目）。stream を持たない古いサーバ（null）は
 * 今までどおり押せる（サーバが断る）。連打防止の busy でも押せない。
 * @param {{ phase?: string } | null | undefined} stream  snapshot の stream。
 * @param {boolean} busy
 * @returns {{ disabled: boolean; note: string }}
 */
export function memoryRecordButtonView(stream, busy) {
  const phase = stream && typeof stream.phase === "string" ? stream.phase : null;
  const outside = phase != null && phase !== "open";
  return {
    disabled: busy === true || outside,
    note: outside ? "配信を始めている間だけ記録できる（「配信を終える」でも記録する）" : ""
  };
}

// ── 圧縮を始める大きさ（頭の調整・ロールのタブの下）──────────────────────────────

/** 既定の目安（トークン・src/mind/context-compactor.mjs の DEFAULT_COMPACT_THRESHOLD_TOKENS と同じ値）。 */
export const COMPACT_THRESHOLD_DEFAULT_TOKENS = 200_000;
/** 選べる下限（COMPACT_THRESHOLD_TOKENS_MIN と同じ値）。 */
export const COMPACT_THRESHOLD_MIN_TOKENS = 50_000;
/** 選べる上限（COMPACT_THRESHOLD_TOKENS_MAX と同じ値）。 */
export const COMPACT_THRESHOLD_MAX_TOKENS = 450_000;
/** 選択肢の刻み（1 万トークン）。 */
export const COMPACT_THRESHOLD_STEP_TOKENS = 10_000;
/** Codex の頭のときだけ効く旨の短い説明（drawer-note に出す）。 */
export const COMPACT_THRESHOLD_NOTE = "Codex の頭のときだけ効きます。直近の入力がこの大きさを超えたら、会話の隙間で圧縮します。";

/**
 * トークン数を「万」の数字へ（20 万 → "20"・手で書いた 230,097 → "23"・小数第 1 位まで）。
 * @param {number} tokens
 * @returns {string}
 */
function tokensInMan(tokens) {
  return String(Math.round(tokens / 1000) / 10);
}

/**
 * 有効な目安か（整数で下限〜上限・src/mind の normalizeCompactThresholdTokens と同じ判定）。
 * @param {unknown} v
 * @returns {v is number}
 */
function isValidCompactThreshold(v) {
  return typeof v === "number" && Number.isInteger(v) && v >= COMPACT_THRESHOLD_MIN_TOKENS && v <= COMPACT_THRESHOLD_MAX_TOKENS;
}

/**
 * 圧縮を始める大きさの select の選択肢（5 万〜45 万を 1 万刻み・value はトークン数の文字列・既定に「（既定）」）。
 * 今の値が刻みに乗らない（設定ファイルを手で書いた）ときは、その値も並べに差し込む（選択が空にならないように）。
 * @param {number | null | undefined} [currentTokens]
 * @returns {Array<{ value: string; label: string }>}
 */
export function compactThresholdOptions(currentTokens) {
  /** @type {number[]} */
  const values = [];
  for (let t = COMPACT_THRESHOLD_MIN_TOKENS; t <= COMPACT_THRESHOLD_MAX_TOKENS; t += COMPACT_THRESHOLD_STEP_TOKENS) values.push(t);
  if (isValidCompactThreshold(currentTokens) && !values.includes(currentTokens)) {
    values.push(currentTokens);
    values.sort((a, b) => a - b);
  }
  return values.map((t) => ({
    value: String(t),
    label: tokensInMan(t) + " 万トークン" + (t === COMPACT_THRESHOLD_DEFAULT_TOKENS ? "（既定）" : "")
  }));
}

/**
 * state snapshot の compaction（{ thresholdTokens }）を選択肢の値へ（未注入・不正は null = 選択を変えない）。
 * @param {{ thresholdTokens?: number | null } | null | undefined} compaction
 * @returns {string | null}
 */
export function compactThresholdSelection(compaction) {
  const t = compaction && compaction.thresholdTokens;
  return isValidCompactThreshold(t) ? String(t) : null;
}

/**
 * 今の目安の表示文言（「いま 20 万トークン（既定）」/「いま 25 万トークン（既定は 20 万）」）。未注入は "not available"。
 * @param {{ thresholdTokens?: number | null } | null | undefined} compaction
 * @returns {string}
 */
export function compactThresholdStatusLabel(compaction) {
  const t = compaction && compaction.thresholdTokens;
  if (typeof t !== "number" || !Number.isFinite(t)) return "not available";
  const suffix =
    t === COMPACT_THRESHOLD_DEFAULT_TOKENS ? "（既定）" : "（既定は " + tokensInMan(COMPACT_THRESHOLD_DEFAULT_TOKENS) + " 万）";
  return "いま " + tokensInMan(t) + " 万トークン" + suffix;
}

/**
 * POST /api/compact-threshold 応答 → エラー文言（rolePostErrorText の写経）。成功は null。
 * @param {{ status: number; ok: boolean; j?: { error?: string | null } | null }} res
 * @returns {string | null}
 */
export function compactThresholdPostErrorText(res) {
  return settingPostErrorText(res, "compaction control not available");
}

// ── Codex の fast（頭の調整・ロールのタブの下・①チャッピーの Codex の頭だけ・2026-10-27 合意）────────────

/** fast の短い説明（drawer-note に出す）。 */
export const CODEX_FAST_NOTE =
  "チャッピーの Codex の頭の返事だけ速くします（使用量が増えます）。書き出し・思い出しは通常のまま。切り替えは次の返事から効きます。";

/**
 * fast のチェックボックスの状態（bargeInToggleView の様式）。snapshot の codexFast が無ければ使えない。
 * Claude の頭でも設定はできる（Codex に切り替えたときに効く）ので無効にはしない（効かないことは文言で示す）。
 * @param {{ enabled?: boolean } | null | undefined} codexFast
 * @returns {{ disabled: boolean; checked: boolean; statusText: string; statusClassName: string }}
 */
export function codexFastToggleView(codexFast) {
  if (!codexFast) {
    return { disabled: true, checked: false, statusText: "not available", statusClassName: "codex-fast-status" };
  }
  const on = codexFast.enabled === true;
  return {
    disabled: false,
    checked: on,
    statusText: on ? "on" : "off",
    statusClassName: "codex-fast-status " + (on ? "on" : "")
  };
}

/**
 * fast の今の効き方の文言。Claude の頭（applicable false）は「効かない」、モデルが priority を持たない
 * （supported false）なら「非対応」、まだ確かめていない（supported null）で ON なら確かめる旨を添える。
 * @param {{ enabled?: boolean; applicable?: boolean; supported?: boolean | null } | null | undefined} codexFast
 * @returns {string}
 */
export function codexFastStatusLabel(codexFast) {
  if (!codexFast) return "not available";
  if (codexFast.applicable !== true) return "今の頭は Claude なので効きません（Codex の頭のときだけ）";
  if (codexFast.supported === false) {
    return codexFast.enabled === true ? "このモデルは fast 非対応（通常の速さで動きます）" : "このモデルは fast 非対応";
  }
  if (codexFast.enabled !== true) return "いま通常の速さ";
  return codexFast.supported === true ? "いま fast（priority）" : "いま fast（モデルの対応は次の返事で確かめます）";
}

/**
 * POST /api/codex-fast 応答 → エラー文言（compactThresholdPostErrorText の写経）。成功は null。
 * @param {{ status: number; ok: boolean; j?: { error?: string | null } | null }} res
 * @returns {string | null}
 */
export function codexFastPostErrorText(res) {
  return settingPostErrorText(res, "codex fast control not available");
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
  // 配信の組み直し 仕上げ: 配信を始めている・終えている途中は断る（サーバの文面 = 少し待ってからもう一度、をそのまま出す）。
  if (res.status === 409) return (res.j && res.j.error) || "配信を始めている・終えている途中（少し待ってからもう一度）";
  if (!res.ok) return "connect failed: " + ((res.j && res.j.error) || "error");
  return null;
}

/**
 * POST /api/chat/source 応答 → エラー文言（YouTube の欄に入れた値の保存・配信の組み直し 仕上げ）。成功は null。
 * @param {{ status: number; ok: boolean; j?: { error?: string | null } | null }} res
 * @returns {string | null}
 */
export function chatSourceSaveErrorText(res) {
  if (res.ok) return null;
  return "save failed: " + ((res.j && res.j.error) || "error");
}

/** 空 source で Connect を押した時の文言（:779）。 */
export const CHAT_EMPTY_SOURCE_ERROR = "enter a stream URL / video ID first";

/**
 * 文字起こしの方式の選択肢（配信の準備のタブのたたんだもの・マイクの下・旧「入出力」タブ・cockpit-stt-selection.md §4.2）。
 * value は POST /api/stream/start の body `sttEngine`（サーバー側 STT_ENGINES と同じ語彙）。
 * @type {ReadonlyArray<{ value: string; label: string }>}
 */
export const STT_ENGINE_OPTIONS = Object.freeze([
  Object.freeze({ value: "whisper", label: "ローカル（whisper）" }),
  Object.freeze({ value: "elevenlabs", label: "ElevenLabs" }),
  // ローカルの文字起こし（子プロセスの sherpa-onnx・local-stt-wave-plan.md §1 の 4）。本命は Zipformer（速さ）。
  Object.freeze({ value: "zipformer", label: "Zipformer（ローカル）" }),
  Object.freeze({ value: "parakeet", label: "Parakeet（ローカル）" })
]);

/**
 * state.stt.engine を選択肢の値へ（未知/欠落は null = 選択を変えない）。
 * @param {{ engine?: string | null } | null | undefined} stt
 * @returns {string | null}
 */
export function sttEngineSelection(stt) {
  const engine = stt && stt.engine;
  return STT_ENGINE_OPTIONS.some((o) => o.value === engine) ? /** @type {string} */ (engine) : null;
}

/**
 * 声の方式の選択肢（声の差し替え Wave 3 Domain E・サーバー側 TTS_ENGINES と同じ語彙）。配信の組み直し Domain E から
 * 声の方式はロールの声で、ロールのタブの編集の select（view-logic/role.mjs の ROLE_VOICE_ENGINE_OPTIONS がこれ）から
 * POST /api/role/edit で直す。配信の準備のタブには出さない（旧「入出力」タブの選択は無い）。
 * @type {ReadonlyArray<{ value: string; label: string }>}
 */
export const TTS_ENGINE_OPTIONS = Object.freeze([
  Object.freeze({ value: "aivis", label: "AivisSpeech" }),
  Object.freeze({ value: "elevenlabs", label: "ElevenLabs" })
]);

/**
 * state.tts.engine を選択肢の値へ（未知/欠落は null = 選択を変えない・sttEngineSelection と同型）。配信の組み直し
 * Domain E から画面は使わない（声の方式はロールの下書きが持つ・テストが語彙を固定するので残す）。
 * @param {{ engine?: string | null } | null | undefined} tts
 * @returns {string | null}
 */
export function ttsEngineSelection(tts) {
  const engine = tts && tts.engine;
  return TTS_ENGINE_OPTIONS.some((o) => o.value === engine) ? /** @type {string} */ (engine) : null;
}

/**
 * 場が開いている間（開きかけ・閉じかけも）か = マイク・文字起こしを触れない間（配信の組み直し Domain D・stream-restructure.md
 * §3「マイク・文字起こしの方式は、場が閉じている間だけ変えられる」）。stream を持たない古いサーバ（null）は固めない。
 * @param {{ phase?: string } | null | undefined} stream  snapshot の stream。
 * @returns {boolean}
 */
export function streamLocksInputs(stream) {
  const phase = stream && typeof stream.phase === "string" ? stream.phase : null;
  return phase === "opening" || phase === "open" || phase === "closing";
}

/** 場が開いている間にマイク・文字起こしの欄に添える案内（配信の組み直し Domain E）。 */
export const STREAM_LOCKED_INPUTS_NOTE = "配信の途中はマイク・文字起こしを替えられない（配信を終えてから）";

/**
 * 「配信を始める」（POST /api/stream/start・旧 POST /api/ears/start）応答 → 失敗文言（:740-742）。!ok（409 / 500 とも）は
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
  chatSource: "chat source error", // 配信の組み直し 仕上げ（POST /api/chat/source・YouTube の欄の保存）
  role: "role error", //  配信の組み直し Domain A（POST /api/role・旧 POST /api/brain の "brain error"）
  memoryRecord: "memory record error", // 配信間記憶（POST /api/memory-record・audioDevice の写経）
  compactThreshold: "compaction threshold error", // 圧縮を始める大きさ（POST /api/compact-threshold・同型）
  codexFast: "codex fast error" // Codex の fast（POST /api/codex-fast・同型）
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
