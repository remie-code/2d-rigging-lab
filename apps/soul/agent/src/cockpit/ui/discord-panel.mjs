// @ts-check
/**
 * ui: Discord の操作パネル（Discord モード Domain K・discord-mode.md §13.4・human-gate-2-result.md §2「Discord の操作パネル」）。
 *
 * Discord の場の間だけ、右の領域（配信のときにコメントの列を描く置き場）に描く。上から 3 つの区切り:
 *  1. 接続: サーバー名（固定）・今いる VC と「抜ける」・同じサーバーの VC の一覧（人数つき）と「入る」/「移る」（1 回押し）。
 *     一覧は GET /api/discord/vc（体験の client の guild から・2 本目のログインはしない）、操作は POST /api/discord/vc
 *     `{ action, channelId }`（成功は snapshot・失敗は `{ error, state }`）。準備の discordChannelId は書き換えない（サーバの側）。
 *  2. しゃべり方: 「自発的にしゃべる」「かぶり判定」のトグルと手動の Fire（「🎤 Fire」「🖼 Fire+視覚」）。運転のタブの部品
 *     （control-bar.mjs の SelfFirePill / BargeInPill / FireButtons と useDriveControls）と同じ API（/api/self-fire・/api/barge-in・
 *     /api/fire・/api/vision-fire）。Fire は VC にいない間・入っている途中は押せず「VC に入ると押せる」（manualFireStreamView）。
 *  3. 見る窓: 窓の選択と「使わない」（POST /api/discord/vision-target・場の間も選び直せる・次の発火から新しい窓）。
 * 入れないもの: VC にいる人の一覧・人ごとの「聞かない」・人ごとの呼び名・KILL（上の帯にある）。「通話を終える」は下の帯。
 *
 * 表示の判断は view-logic（discord.mjs の discordPanelView など・control.mjs）に寄せ、ここは描くだけ。区切りの部品は hooks を
 * 使わない（vnode 走査テスト対象）。hooks を使うのは取りまとめの DiscordPanel だけ。
 * 守り（§10）: Discord の id は API の応答の中だけ（一覧の行の key と押す口の引数）。画面の文字列には名前と決まった文面だけ。
 *
 * トップレベル副作用ゼロ（export function / const のみ）。
 */

import { html, useState, useEffect, useRef } from "../vendor/htm.preact.standalone.mjs";
import { SelfFirePill, BargeInPill, FireButtons, useDriveControls } from "./control-bar.mjs";
import {
  soulStatusView,
  selfFireToggleView,
  bargeInToggleView,
  manualFireStreamView
} from "../view-logic/control.mjs";
import { windowListView } from "../view-logic/settings.mjs";
import {
  discordPanelView,
  discordVcPostErrorText,
  discordVcListErrorText,
  discordVisionOptions,
  discordVisionLabel,
  discordPrepPostErrorText,
  DISCORD_PANEL_TITLE,
  DISCORD_PANEL_SECTION_LABELS,
  DISCORD_PANEL_SERVER_LABEL,
  DISCORD_PANEL_LEAVE_TEXT,
  DISCORD_PANEL_LIST_LABEL,
  DISCORD_PANEL_REFRESH_TEXT,
  DISCORD_PANEL_SELF_FIRE_LABEL,
  DISCORD_PANEL_BARGE_IN_LABEL,
  DISCORD_PANEL_FIRE_LABEL,
  DISCORD_PANEL_VISION_HINT,
  DISCORD_PANEL_WINDOWS_REFRESH_TEXT
} from "../view-logic/discord.mjs";

/** VC の一覧を読み直す間隔（ms・人数の移り変わりを拾う。読むのは体験の client の guild から）。 */
export const DISCORD_PANEL_LIST_REFRESH_MS = 20000;

/**
 * 接続の区切り（hooks 非使用・vnode 走査テスト対象）。view は discordPanelView の値。
 * @param {{ view: NonNullable<ReturnType<typeof discordPanelView>>; error?: string; onLeave?: () => void;
 *   onChannel?: (action: "join" | "move", channelId: string) => void; onRefresh?: () => void }} props
 */
export function DiscordConnectionSection({ view, error = "", onLeave, onChannel, onRefresh }) {
  return html`
    <section class="discord-section discord-connection" aria-label=${DISCORD_PANEL_SECTION_LABELS.connection}>
      <h3 class="discord-section-title">${DISCORD_PANEL_SECTION_LABELS.connection}</h3>
      <div class="discord-row discord-server">
        <span class="discord-label">${DISCORD_PANEL_SERVER_LABEL}</span>
        <span class="discord-server-name">${view.serverText}</span>
      </div>
      <div class="discord-row discord-current-row">
        <span class=${view.current.className}>${view.current.text}</span>
        ${view.current.showLeave
          ? html`<button class="btn-discord-leave" type="button" disabled=${view.current.leaveDisabled} onClick=${() => onLeave && onLeave()}>
              ${DISCORD_PANEL_LEAVE_TEXT}
            </button>`
          : null}
      </div>
      <div class="discord-row discord-list-head">
        <span class="discord-label">${DISCORD_PANEL_LIST_LABEL}</span>
        <button class="btn-discord-refresh" type="button" onClick=${() => onRefresh && onRefresh()}>${DISCORD_PANEL_REFRESH_TEXT}</button>
      </div>
      <ul class="discord-channels">
        ${view.channels.map(
          (row) => html`
            <li key=${row.key} class=${"discord-channel" + (row.current ? " current" : "")}>
              <span class="discord-channel-name">${row.name}</span>
              <span class="discord-channel-people">${row.peopleText}</span>
              ${row.current
                ? html`<span class="discord-here">${row.actionText}</span>`
                : html`<button
                    class=${"btn-discord-" + (row.action ?? "move")}
                    type="button"
                    disabled=${row.disabled}
                    onClick=${() => row.action && onChannel && onChannel(row.action, row.channelId)}
                  >
                    ${row.actionText}
                  </button>`}
            </li>
          `
        )}
      </ul>
      ${view.listNote ? html`<p class="discord-note">${view.listNote}</p>` : null}
      ${view.note ? html`<p class="discord-note">${view.note}</p>` : null}
      ${error ? html`<p class="discord-note err">${error}</p>` : null}
    </section>
  `;
}

/**
 * しゃべり方の区切り（hooks 非使用・vnode 走査テスト対象）。部品は運転のタブと同じ（ラベルだけ替える）。
 * @param {{ sfView: ReturnType<typeof selfFireToggleView>; biView: ReturnType<typeof bargeInToggleView>;
 *   onToggleSelfFire?: (ev: any) => void; onToggleBargeIn?: (ev: any) => void;
 *   soulView: ReturnType<typeof soulStatusView>; localBusy?: boolean; onFire?: () => void; onVisionFire?: () => void;
 *   fireStream: { blocked: boolean; note: string }; fireNote?: string; controlError?: string }} props
 */
export function DiscordSpeakingSection({
  sfView,
  biView,
  onToggleSelfFire = () => {},
  onToggleBargeIn = () => {},
  soulView,
  localBusy = false,
  onFire = () => {},
  onVisionFire = () => {},
  fireStream,
  fireNote = "",
  controlError = ""
}) {
  return html`
    <section class="discord-section discord-speaking" aria-label=${DISCORD_PANEL_SECTION_LABELS.speaking}>
      <h3 class="discord-section-title">${DISCORD_PANEL_SECTION_LABELS.speaking}</h3>
      <div class="discord-row discord-toggles">
        <${SelfFirePill} view=${sfView} onChange=${onToggleSelfFire} label=${DISCORD_PANEL_SELF_FIRE_LABEL} />
        <${BargeInPill} view=${biView} onChange=${onToggleBargeIn} label=${DISCORD_PANEL_BARGE_IN_LABEL} />
      </div>
      ${controlError ? html`<p class="discord-note err">${controlError}</p>` : null}
      <div class="discord-row discord-fire">
        <span class="discord-label">${DISCORD_PANEL_FIRE_LABEL}</span>
        <${FireButtons}
          soulView=${soulView}
          localBusy=${localBusy}
          onFire=${onFire}
          onVisionFire=${onVisionFire}
          streamBlocked=${fireStream.blocked}
        />
      </div>
      ${fireStream.note ? html`<p class="discord-note fire-stream-note">${fireStream.note}</p>` : null}
      ${fireNote ? html`<p class="discord-note fire-note">${fireNote}</p>` : null}
    </section>
  `;
}

/**
 * 見る窓の区切り（hooks 非使用・vnode 走査テスト対象）。options は discordVisionOptions の値（先頭が「使わない」）。
 * @param {{ options: Array<{ value: string; label: string }>; value: string; onChange?: (ev: any) => void; onRefresh?: () => void;
 *   statusText: string; error?: string }} props
 */
export function DiscordVisionSection({ options, value, onChange = () => {}, onRefresh = () => {}, statusText, error = "" }) {
  return html`
    <section class="discord-section discord-vision" aria-label=${DISCORD_PANEL_SECTION_LABELS.vision}>
      <h3 class="discord-section-title">${DISCORD_PANEL_SECTION_LABELS.vision}</h3>
      <div class="discord-row">
        <select class="drawer-select discord-panel-vision-select" value=${value} onChange=${onChange} aria-label=${DISCORD_PANEL_SECTION_LABELS.vision}>
          ${options.map((o) => html`<option key=${o.value} value=${o.value}>${o.label}</option>`)}
        </select>
        <button class="btn-discord-windows" type="button" onClick=${() => onRefresh()}>${DISCORD_PANEL_WINDOWS_REFRESH_TEXT}</button>
      </div>
      <p class="discord-note">${statusText}</p>
      <p class="discord-note discord-hint">${DISCORD_PANEL_VISION_HINT}</p>
      ${error ? html`<p class="discord-note err">${error}</p>` : null}
    </section>
  `;
}

/**
 * Discord の操作パネル本体（hooks を使う取りまとめ）。app.mjs が Discord の場の間だけ右の領域に描く。
 * @param {{ stream: any; soul?: string; setSoul: (s: string) => void; fireNote?: string; setFireNote: (t: string) => void;
 *   selfFire?: { enabled?: boolean } | null; bargeIn?: { enabled?: boolean } | null;
 *   applySnapshot: (s: any) => void; fetchImpl?: any; setIntervalImpl?: typeof setInterval; clearIntervalImpl?: typeof clearInterval }} props
 */
export function DiscordPanel(props) {
  const { stream, soul, setSoul, fireNote = "", setFireNote, selfFire, bargeIn, applySnapshot, fetchImpl } = props;
  const doFetch = fetchImpl || globalThis.fetch;
  // VC の一覧（GET /api/discord/vc の応答・まだ読んでいなければ null）と、入る・抜ける・移るの応答待ち・失敗の文言。
  const [vcList, setVcList] = useState(/** @type {any} */ (null));
  const [vcBusy, setVcBusy] = useState(false);
  const [vcError, setVcError] = useState("");
  // 見る窓（GET /api/discord/vision-target）と窓の一覧（GET /api/windows）。
  const [visionTitle, setVisionTitle] = useState(/** @type {string | null} */ (null));
  const [winOptions, setWinOptions] = useState(/** @type {Array<{ value: string; label: string }>} */ ([]));
  const [visionError, setVisionError] = useState("");
  const aliveRef = useRef(true);
  const phase = stream && typeof stream.phase === "string" ? stream.phase : null;
  const phaseRef = useRef(/** @type {string | null} */ (null));
  phaseRef.current = phase;

  const drive = useDriveControls({ setSoul, setFireNote, applySnapshot, fetchImpl });

  /** VC の一覧を読む（場が開いている間だけ・失敗は文言にして前の一覧を残す）。 */
  const loadList = () => {
    if (phaseRef.current !== "open") return;
    doFetch("/api/discord/vc")
      .then((/** @type {any} */ r) => r.json().then((/** @type {any} */ j) => ({ ok: r.ok, status: r.status, j })))
      .then((/** @type {any} */ res) => {
        if (!aliveRef.current) return;
        const err = discordVcListErrorText(res);
        if (err != null) {
          setVcError(err);
          return;
        }
        setVcList(res.j && Array.isArray(res.j.channels) ? { channels: res.j.channels, guildName: res.j.guildName ?? null } : null);
      })
      .catch((/** @type {unknown} */ e) => {
        if (aliveRef.current) setVcError("ボイスチャンネルの一覧を読めない（" + String(e) + "）");
      });
  };

  /** 窓の一覧を読む（配信の準備・Discord の準備と同じ GET /api/windows）。 */
  const loadWindows = () =>
    doFetch("/api/windows")
      .then((/** @type {any} */ r) => r.json())
      .then((/** @type {any} */ j) => {
        if (!aliveRef.current) return;
        const view = windowListView(j);
        setWinOptions(view.options);
        setVisionError(view.errorText);
      })
      .catch((/** @type {unknown} */ e) => {
        if (aliveRef.current) setVisionError("窓の一覧を読めない（" + String(e) + "）");
      });

  // 開いたとき: 窓の一覧と今の見る窓を読む。閉じたら（パネルが消えたら）遅れた応答を捨てる。
  useEffect(() => {
    aliveRef.current = true;
    loadWindows();
    doFetch("/api/discord/vision-target")
      .then((/** @type {any} */ r) => r.json())
      .then((/** @type {any} */ j) => {
        if (aliveRef.current && j && j.visionTarget) setVisionTitle(typeof j.visionTarget.title === "string" ? j.visionTarget.title : null);
      })
      .catch(() => {
        /* 読めなくても選び直せば保存される。 */
      });
    const setIntervalImpl = props.setIntervalImpl || globalThis.setInterval;
    const clearIntervalImpl = props.clearIntervalImpl || globalThis.clearInterval;
    const timer = setIntervalImpl(() => loadList(), DISCORD_PANEL_LIST_REFRESH_MS);
    return () => {
      aliveRef.current = false;
      clearIntervalImpl(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 場が開いた・接続の状態や今いる VC が替わったら一覧を読み直す（今いる行の印・人数）。
  const connection = stream && typeof stream.connection === "string" ? stream.connection : null;
  const vcName = stream && typeof stream.vcName === "string" ? stream.vcName : null;
  useEffect(() => {
    loadList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, connection, vcName]);

  /**
   * 入る・抜ける・移る（1 回押し）。成功は snapshot を当て、失敗は理由を出す（応答の state があれば当てる）。終わったら一覧を読み直す。
   * @param {"join" | "leave" | "move"} action @param {string} [channelId]
   */
  const vcOp = (action, channelId) => {
    setVcBusy(true);
    setVcError("");
    doFetch("/api/discord/vc", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(channelId ? { action, channelId } : { action })
    })
      .then((/** @type {any} */ r) => r.json().then((/** @type {any} */ j) => ({ ok: r.ok, status: r.status, j })))
      .then((/** @type {any} */ res) => {
        if (!aliveRef.current) return;
        const err = discordVcPostErrorText(res);
        if (err != null) {
          setVcError(err);
          if (res.j && res.j.state) applySnapshot(res.j.state);
          return;
        }
        applySnapshot(res.j);
      })
      .catch((/** @type {unknown} */ e) => {
        if (aliveRef.current) setVcError("VC の操作ができない（" + String(e) + "）");
      })
      .then(() => {
        if (!aliveRef.current) return;
        setVcBusy(false);
        loadList();
      });
  };

  /** 見る窓を選び直す（"" = 使わない）。 @param {any} ev */
  const onVisionChange = (ev) => {
    const title = ev && ev.target ? ev.target.value : "";
    setVisionError("");
    doFetch("/api/discord/vision-target", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: title || null })
    })
      .then((/** @type {any} */ r) => r.json().then((/** @type {any} */ j) => ({ ok: r.ok, status: r.status, j })))
      .then((/** @type {any} */ res) => {
        if (!aliveRef.current) return;
        const err = discordPrepPostErrorText(res);
        if (err != null) {
          setVisionError(err);
          return;
        }
        setVisionTitle(res.j && res.j.visionTarget && typeof res.j.visionTarget.title === "string" ? res.j.visionTarget.title : null);
      })
      .catch((/** @type {unknown} */ e) => {
        if (aliveRef.current) setVisionError("見る窓を保存できない（" + String(e) + "）");
      });
  };

  const view = discordPanelView(stream, vcList, { busy: vcBusy });
  if (!view) return null;
  return html`
    <section class="glance-panel discord-panel" aria-label=${DISCORD_PANEL_TITLE}>
      <h2 class="panel-title">${DISCORD_PANEL_TITLE}</h2>
      <div class="discord-panel-body">
        <${DiscordConnectionSection}
          view=${view}
          error=${vcError}
          onLeave=${() => vcOp("leave")}
          onChannel=${(/** @type {"join" | "move"} */ action, /** @type {string} */ channelId) => vcOp(action, channelId)}
          onRefresh=${loadList}
        />
        <${DiscordSpeakingSection}
          sfView=${selfFireToggleView(selfFire)}
          biView=${bargeInToggleView(bargeIn)}
          onToggleSelfFire=${drive.onToggleSelfFire}
          onToggleBargeIn=${drive.onToggleBargeIn}
          soulView=${soulStatusView(soul)}
          localBusy=${drive.localBusy}
          onFire=${() => drive.fireWith("/api/fire", "fire")}
          onVisionFire=${() => drive.fireWith("/api/vision-fire", "vision")}
          fireStream=${manualFireStreamView(stream)}
          fireNote=${fireNote}
          controlError=${drive.controlError}
        />
        <${DiscordVisionSection}
          options=${discordVisionOptions(winOptions, visionTitle)}
          value=${visionTitle ?? ""}
          onChange=${onVisionChange}
          onRefresh=${loadWindows}
          statusText=${discordVisionLabel(visionTitle)}
          error=${visionError}
        />
      </div>
    </section>
  `;
}
