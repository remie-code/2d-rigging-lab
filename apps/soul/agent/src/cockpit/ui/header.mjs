// @ts-check
/**
 * ui: ヘッダ（cockpit-redesign.md §7: 名前 + Listening ランプ（発光ドット）+ 一目の健康
 * （耳の死活 whisper/ffmpeg・声の出力先）+ 右端に ⚙）。
 *
 * 現 cockpit.html の <header>（:149-161）+ applyState の ears 表示（:267-270）+
 * applyHealth（:360-366）+ applyAudioDevice の文言（:344・ヘッダへ昇格）の移植先。
 * 表示導出はすべて view-logic/health.mjs 経由（ここで再実装しない・L0 裁定）。
 *
 * props 契約:
 *  - ears:             string        state スナップショット/SSE state の s.ears（生値）。
 *  - health:           { whisper, ffmpeg }  各々 { status, reason }（app.mjs が mergeHealth で
 *                       「欠落は前値保持」を済ませた後の値・初期 { status:"unknown", reason:null }）。
 *  - audioDevice:      { name } | null  s.audioDevice（生値・声の出力先表示に使う）。
 *  - identity:         { id, displayName } | null  state.brain.identity（サーバー提供の生値）。
 *  - onToggleSettings: () => void    ⚙ クリック（設定引き出しの開閉フック・**引き出し本体は
 *                       Domain C**——ここは開閉のフックだけを用意する）。
 *
 * トップレベル副作用ゼロ（export function のみ）。
 */

import { html } from "../vendor/htm.preact.standalone.mjs";
import { earsStatusView, healthStatusView, voiceOutputLabel } from "../view-logic/health.mjs";

/**
 * Current public identity is supplied by the server. The UI validates the
 * frozen wire shape only; it never derives a soul name from a technical brain
 * id. Invalid/missing values intentionally fall back to a neutral label so a
 * previous identity cannot leak while state is unavailable.
 */
const IDENTITY_PAIRS = Object.freeze([
  Object.freeze({ id: "cody", displayName: "こーでぃー" }),
  Object.freeze({ id: "chappy", displayName: "チャッピー" })
]);
export const NEUTRAL_COCKPIT_TITLE = "Soul Cockpit";

/** @param {unknown} identity @returns {string} */
export function identityDisplayName(identity) {
  if (!identity || typeof identity !== "object") return NEUTRAL_COCKPIT_TITLE;
  const candidate = /** @type {{ id?: unknown; displayName?: unknown }} */ (identity);
  const isExactPair = IDENTITY_PAIRS.some(
    (pair) => pair.id === candidate.id && pair.displayName === candidate.displayName
  );
  if (!isExactPair) return NEUTRAL_COCKPIT_TITLE;
  return /** @type {string} */ (candidate.displayName);
}

/** @param {unknown} identity @returns {string} */
export function cockpitDocumentTitle(identity) {
  const displayName = identityDisplayName(identity);
  return displayName === NEUTRAL_COCKPIT_TITLE
    ? NEUTRAL_COCKPIT_TITLE
    : `${displayName} — ${NEUTRAL_COCKPIT_TITLE}`;
}

/**
 * whisper/ffmpeg 死活の 1 項目（label: whisper/ffmpeg・view は healthStatusView 導出済み）。
 * @param {{ label: string; view: { text: string; className: string; title: string } }} props
 */
export function HealthStat({ label, view }) {
  return html`<span>${label}: <span class=${view.className} title=${view.title}>${view.text}</span></span>`;
}

/**
 * ヘッダ本体。
 * @param {{ ears?: string; health: { whisper: any; ffmpeg: any }; audioDevice?: any; identity?: unknown; onToggleSettings?: () => void }} props
 */
export function Header({ ears, health, audioDevice, identity, settingsOpen = false, onToggleSettings }) {
  const earsView = earsStatusView(ears);
  const currentDisplayName = identityDisplayName(identity);
  // health は app.mjs 側で initialHealth() + mergeHealth（欠落は前値保持）を済ませた実値だけが来る
  // = healthStatusView が null を返す経路は無い（旧フォールバック構造体は実到達しないデッドコード
  // だったため Domain D で削除・design レビュー non-blocking 1。view-logic 外の表示リテラルゼロ）。
  const whisperView = healthStatusView(health.whisper);
  const ffmpegView = healthStatusView(health.ffmpeg);
  return html`
    <header class="cockpit-header">
      <h1>${currentDisplayName}</h1>
      <div class="ears">
        <span class=${earsView.dotClassName}></span>
        <span class="ears-status">${earsView.text}</span>
      </div>
      <div class="health">
        <${HealthStat} label="whisper" view=${whisperView} />
        <${HealthStat} label="ffmpeg" view=${ffmpegView} />
        <span class="voice-out">voice: ${voiceOutputLabel(audioDevice)}</span>
      </div>
      <button id="cockpit-settings-trigger" class="settings-toggle" type="button"
        aria-label="Open Cockpit Settings" aria-expanded=${!!settingsOpen}
        aria-controls="cockpit-settings-dialog" onClick=${onToggleSettings}>⚙</button>
    </header>
  `;
}
