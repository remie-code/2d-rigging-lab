// @ts-check
/**
 * ui: 下の細い帯（薄い文字・cockpit-glance-redesign.md §3・§7・§8・§9.3）。
 *
 * 左に運転設定の表示（自発・口数・話し始め・忙しい間のコメント）、中に遅延の凡例 8 つ（文字起こし・判定・画面・
 * LLM 最初の文字・最初の文・TTS・声・その他）、右に歯車「準備・設定」。ホットキーの案内は置かない（§7）。
 * 表示導出は view-logic/glance-meters.mjs（driveSummaryView / LATENCY_SEGMENTS）。
 *
 * トップレベル副作用ゼロ（export function のみ）。hooks は使わない（vnode 走査テスト対象）。
 */

import { html } from "../vendor/htm.preact.standalone.mjs";
import { driveSummaryView, LATENCY_SEGMENTS } from "../view-logic/glance-meters.mjs";

/**
 * 下の帯本体。
 * @param {{ settings: any; settingsOpen?: boolean; onOpenSettings?: () => void }} props
 */
export function BottomBar({ settings, settingsOpen = false, onOpenSettings }) {
  const summary = driveSummaryView(settings);
  return html`
    <footer class="bottom-bar">
      <div class="drive-summary">
        ${summary.map((s, i) => html`
          <span key=${s.label} class="drive-item">${i > 0 ? html`<span class="sep">•</span>` : null}${s.label} <span class="drive-value">${s.value}</span></span>
        `)}
      </div>
      <div class="lat-legend" aria-label="遅延の凡例">
        ${LATENCY_SEGMENTS.map((s) => html`
          <span key=${s.key} class="legend-item" title=${"hint" in s ? s.hint : null}><span class=${"legend-swatch " + s.className}></span>${s.label}</span>
        `)}
      </div>
      <button id="cockpit-settings-trigger" class="settings-toggle" type="button"
        aria-label="準備・設定を開く" aria-expanded=${!!settingsOpen}
        aria-controls="cockpit-settings-dialog" onClick=${onOpenSettings}>⚙ 準備・設定</button>
    </footer>
  `;
}
