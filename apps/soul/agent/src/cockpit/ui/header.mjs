// @ts-check
/**
 * ui: 上の細い帯（操縦席の作り直し・cockpit-glance-redesign.md §3・§4・§7・§8）と、ログのタブに残す一目の健康。
 *
 * 上の帯（TopBar）: 名前（チャッピー）・頭のモデル名・状態のピル 1 つ（聞いてる / 考えてる / 喋ってる）。
 * 異常があるときだけ警告（warnings の一覧・alert が先）。右に残量ゲージ 2 本（Codex 週・ElevenLabs 月の「残り」）
 * と小さな KILL ボタン。KILL 中は帯を赤くし「KILL 中」と復帰ボタン（既存の POST /api/kill {killed:false}）。
 * 表示導出はすべて view-logic（glance-meters.mjs / control.mjs / health.mjs）経由。hooks は使わない
 * （KILL の POST は app.mjs が持ち、onKill / onRevive で受ける）。
 *
 * HealthLine: 旧ヘッダの「一目の健康」（耳・whisper/ffmpeg・文字起こし・マイク・声の出力先）。メイン画面からは
 * 外し（§5: 異常は上の帯の警告へ）、準備・設定の「ログ」タブの上に残す。
 *
 * トップレベル副作用ゼロ（export function のみ）。
 */

import { html } from "../vendor/htm.preact.standalone.mjs";
import { earsStatusView, healthStatusView, voiceOutputLabel, sttStatusView, ttsStatusView, micInputLabel } from "../view-logic/health.mjs";
import { statusPillView, quotaGaugeView, warningsView } from "../view-logic/glance-meters.mjs";
import { killSwitchView } from "../view-logic/control.mjs";

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
 * 旧ヘッダの一目の健康（ログのタブの上に置く・hooks 非使用）。
 * @param {{ ears?: string; health: { whisper: any; ffmpeg: any }; audioDevice?: any; stt?: any; tts?: any; device?: string | null }} props
 */
export function HealthLine({ ears, health, audioDevice, stt = null, tts = null, device = null }) {
  const earsView = earsStatusView(ears);
  // health は app.mjs 側で initialHealth() + mergeHealth（欠落は前値保持）を済ませた実値だけが来る。
  const whisperView = healthStatusView(health.whisper);
  const ffmpegView = healthStatusView(health.ffmpeg);
  const sttView = sttStatusView(stt);
  const ttsView = ttsStatusView(tts);
  const micName = micInputLabel(ears, device);
  return html`
    <div class="health-line">
      <div class="ears">
        <span class=${earsView.dotClassName}></span>
        <span class="ears-status">${earsView.text}</span>
      </div>
      <div class="health">
        <${HealthStat} label="whisper" view=${whisperView} />
        <${HealthStat} label="ffmpeg" view=${ffmpegView} />
        ${sttView ? html`<${HealthStat} label="stt" view=${sttView} />` : null}
        ${ttsView ? html`<${HealthStat} label="tts" view=${ttsView} />` : null}
        ${micName != null ? html`<span class="mic-in" title=${micName}>mic: ${micName}</span>` : null}
        <span class="voice-out">voice: ${voiceOutputLabel(audioDevice)}</span>
      </div>
    </div>
  `;
}

/**
 * 残量のゲージ 1 本（「残り」の割合・不明は「—」・hooks 非使用）。
 * @param {{ view: { label: string; valueText: string; percent: number | null; className: string; title: string } }} props
 */
export function QuotaGauge({ view }) {
  return html`
    <span class=${view.className} title=${view.title}>
      <span class="gauge-label">${view.label} ${view.valueText}</span>
      <span class="gauge-track"><span class="gauge-fill" style=${"width:" + (view.percent ?? 0) + "%"}></span></span>
    </span>
  `;
}

/**
 * 上の細い帯（hooks 非使用・vnode 走査テスト対象）。
 * @param {{ identity?: unknown; modelText?: string; soul?: string; ears?: string; warnings?: any[]; quota?: any;
 *   killed?: boolean; killError?: string; nowMs: number; onKill?: () => void; onRevive?: () => void }} props
 */
export function TopBar({ identity, modelText = "", soul, ears, warnings, quota, killed = false, killError = "", nowMs, onKill, onRevive }) {
  const pill = statusPillView(soul, ears);
  const warn = warningsView(warnings, nowMs);
  const killView = killSwitchView(killed);
  const codex = quotaGaugeView("Codex 週", quota && quota.codex);
  const eleven = quotaGaugeView("ElevenLabs 月", quota && quota.elevenlabs);
  return html`
    <header class=${"top-bar" + (killView.killed ? " killing" : "")}>
      <h1 class="top-name">${identityDisplayName(identity)}</h1>
      ${modelText ? html`<span class="top-model">${modelText}</span>` : null}
      <span class=${pill.className}><span class="pill-dot"></span>${pill.text}</span>
      ${killView.killed ? html`<span class=${killView.statusClassName}>${killView.statusText}</span>` : null}
      <div class="top-warnings" role="status" aria-live="polite">
        ${warn.items.map((w) => html`<span key=${w.key} class=${w.className} title=${w.title}>${w.text}</span>`)}
        ${warn.moreText ? html`<span class="warn-chip more" title=${warn.moreTitle}>${warn.moreText}</span>` : null}
      </div>
      <div class="top-right">
        ${killError ? html`<span class="err kill-error">${killError}</span>` : null}
        <${QuotaGauge} view=${codex} />
        <${QuotaGauge} view=${eleven} />
        <button class=${killView.className} type="button"
          onClick=${killView.killed ? onRevive : onKill}>${killView.label}</button>
      </div>
    </header>
  `;
}
