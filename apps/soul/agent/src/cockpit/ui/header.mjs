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
 *  - onToggleSettings: () => void    ⚙ クリック（設定引き出しの開閉フック・**引き出し本体は
 *                       Domain C**——ここは開閉のフックだけを用意する）。
 *
 * トップレベル副作用ゼロ（export function のみ）。
 */

import { html } from "../vendor/htm.preact.standalone.mjs";
import { earsStatusView, healthStatusView, voiceOutputLabel } from "../view-logic/health.mjs";

/**
 * whisper/ffmpeg 死活の 1 項目（label: whisper/ffmpeg・view は healthStatusView 導出済み）。
 * @param {{ label: string; view: { text: string; className: string; title: string } }} props
 */
export function HealthStat({ label, view }) {
  return html`<span>${label}: <span class=${view.className} title=${view.title}>${view.text}</span></span>`;
}

/**
 * ヘッダ本体。
 * @param {{ ears?: string; health: { whisper: any; ffmpeg: any }; audioDevice?: any; onToggleSettings?: () => void }} props
 */
export function Header({ ears, health, audioDevice, onToggleSettings }) {
  const earsView = earsStatusView(ears);
  // health は app.mjs 側で initialHealth() + mergeHealth（欠落は前値保持）を済ませた実値だけが来る
  // = healthStatusView が null を返す経路は無い（旧フォールバック構造体は実到達しないデッドコード
  // だったため Domain D で削除・design レビュー non-blocking 1。view-logic 外の表示リテラルゼロ）。
  const whisperView = healthStatusView(health.whisper);
  const ffmpegView = healthStatusView(health.ffmpeg);
  return html`
    <header class="cockpit-header">
      <h1>こーでぃー</h1>
      <div class="ears">
        <span class=${earsView.dotClassName}></span>
        <span class="ears-status">${earsView.text}</span>
      </div>
      <div class="health">
        <${HealthStat} label="whisper" view=${whisperView} />
        <${HealthStat} label="ffmpeg" view=${ffmpegView} />
        <span class="voice-out">voice: ${voiceOutputLabel(audioDevice)}</span>
      </div>
      <button class="settings-toggle" type="button" aria-label="settings" onClick=${onToggleSettings}>⚙</button>
    </header>
  `;
}
