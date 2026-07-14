// @ts-check
/**
 * view-logic: ヘッダの「一目の健康」の表示導出（preact 非依存の純関数）。
 *
 * 操縦席 UI 改定 Domain B の追加抽出（L0 裁定済みの申し送り・domain-a.md §7-2）。現 cockpit.html の
 * ears 状態表示（applyState 内）と applyHealth（whisper/ffmpeg 死活）から DOM 構築を剥がして
 * 「状態 → 表示構造体」の導出だけを取り出す。機能同値（fixture で固定）。
 *
 * 様式統一（全 view-logic 共通・L0 裁定）: 行テキスト=文字列・状態導出={text, className, …}構造体・
 * **非表示（更新しない）= null**（view-logic が null を返したら呼び出し側は表示を変えない）。
 *
 * 対応（現 cockpit.html）:
 *  - earsStatusView   → :267-270 applyState 内の ears-status 文言 + ears-dot クラス
 *                       （`s.ears === "listening" ? "Listening" : (s.ears === "starting" ? "Starting" : "Stopped")`
 *                        + `"dot " + (earsListening ? "on" : "off")`）
 *  - healthStatusView → :360-366 `applyHealth(id, h)`（`if (!h) return;` = 欠落は表示を更新しない → null）
 *  - mergeHealth      → :271-274 applyState 内 `if (s.health) { applyHealth(...whisper); applyHealth(...ffmpeg); }`
 *                       の「欠落側は前の表示を保持する」状態遷移を preact の state 更新に写した純関数
 *  - voiceOutputLabel → :342-345 `applyAudioDevice(ad)`（ヘッダの「声の出力先」表示に使う文言導出。
 *                        設定引き出し側の結線は Domain C——文言導出だけここで共有する）
 */

/**
 * ears 状態の表示（ランプ + 文言）。listening は uptime 刻みの条件にも使う（:267）。
 * @param {string | null | undefined} ears  "listening" | "starting" | "stopped" など。
 * @returns {{ listening: boolean; text: string; dotClassName: string }}
 */
export function earsStatusView(ears) {
  const listening = ears === "listening";
  return {
    listening,
    text: listening ? "Listening" : (ears === "starting" ? "Starting" : "Stopped"),
    dotClassName: "dot " + (listening ? "on" : "off")
  };
}

/**
 * whisper/ffmpeg 死活の表示（down は reason を em-dash で併記 + title に生 reason）。
 * h が falsy なら **null = 表示を更新しない**（原実装 `if (!h) return;` の意味論）。
 * @param {{ status?: string; reason?: string | null } | null | undefined} h
 * @returns {{ text: string; className: string; title: string } | null}
 */
export function healthStatusView(h) {
  if (!h) return null;
  return {
    text: h.status + (h.status === "down" && h.reason ? " — " + h.reason : ""),
    className: "hstat " + h.status,
    title: h.reason || ""
  };
}

/**
 * state スナップショットの health を前の health 状態へ合流する（欠落側は前値を保持）。
 * 原実装は applyHealth が `if (!h) return;` で DOM を触らない＝「前の表示のまま」。preact では
 * state の該当キーを保持することが同値。s.health ごと欠落なら全部保持（:271 `if (s.health)`）。
 * @template {{ whisper: any; ffmpeg: any }} T
 * @param {T} prev  現在の health 状態（{ whisper, ffmpeg } 各々 { status, reason } | 初期値）。
 * @param {{ whisper?: any; ffmpeg?: any } | null | undefined} next  state スナップショットの health。
 * @returns {T}
 */
export function mergeHealth(prev, next) {
  if (!next) return prev;
  return /** @type {T} */ ({
    whisper: next.whisper ? next.whisper : prev.whisper,
    ffmpeg: next.ffmpeg ? next.ffmpeg : prev.ffmpeg
  });
}

/**
 * 声の出力先の表示文言（未設定は "default"）。原実装 applyAudioDevice の
 * `ad && ad.name ? ad.name : "default"`（:344）と同値。ヘッダの「一目の健康」と
 * 設定引き出し（Domain C）の両方がこの単一導出を使う。
 * @param {{ name?: string | null } | null | undefined} ad
 * @returns {string}
 */
export function voiceOutputLabel(ad) {
  return ad && ad.name ? ad.name : "default";
}
