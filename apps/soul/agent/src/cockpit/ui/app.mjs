// @ts-check
/**
 * ui: 操縦席エントリの骨組み（App コンポーネント + mount）。
 *
 * 現 cockpit.html の IIFE（:239-910）のうち **観測 + ヘッダ（Domain B スコープ）** の移植先:
 *  - SSE 購読（subscribe :814-897）: **既存 13 イベント**を SSE_EVENT_NAMES で購読し、
 *    タイムライン系は rows.mjs の feedAfterSseEvent（単一経路）へ、非タイムライン効果
 *    （state 適用/discarded/soul/fire-note/usage/chatStatus）は applyNonFeedSseEvent へ。
 *  - 初期化（init :899-909）: GET /api/state → 履歴復元（renderHistory 相当 = feedFromHistory・
 *    履歴行は latency 無し）→ applyState 相当 → その後に SSE 購読（原実装と同順・購読先行で
 *    履歴が live 行を上書きする競合を構造的に避ける）。
 *    ※ 原実装 init の loadDevices/loadWindows/loadAudioDevices は設定引き出し（settings-drawer.mjs）の
 *      独立 effect（domain-b.md §8-8 裁定）。
 *  - uptime（:245-262）: listening 中 1s 刻み + state 到着で再同期（baseMs/anchorMs + tick）。
 *  - 運転バー（ControlBar）・設定引き出し（SettingsDrawer）は Domain C の実体（プレースホルダを置換済み）。
 *    soul/setSoul/fireNote/setFireNote の 4 点セットと applySnapshot（applyStateRef.current の共有）を
 *    props で渡す。導線（cockpit-redesign.md §4）: GET /api/state 成功（stateLoaded）かつ設定空のとき
 *    **一度だけ**引き出しを自動展開（判定式は view-logic/settings.mjs shouldAutoOpenSettings・fixture 固定）。
 *
 * 鉄の設計規律: export function/const のみ・**トップレベル副作用ゼロ**（document/EventSource/window に
 * トップレベルで触れない）。mount(rootElement, options) を呼ぶのは cockpit.html の inline module
 * （Domain D）だけ。EventSource/fetch/Date.now は options で注入可能（既定は globalThis 参照＝
 * Node からの import が安全に通る）。
 */

import { html, render, useState, useEffect, useRef, useCallback } from "../vendor/htm.preact.standalone.mjs";
import { Header } from "./header.mjs";
import { Feed } from "./feed.mjs";
import { ControlBar } from "./control-bar.mjs";
import { SettingsDrawer } from "./settings-drawer.mjs";
import { injectStyles } from "./styles.mjs";
import { emptyFeed, feedFromHistory, feedAfterSseEvent } from "./rows.mjs";
import { formatHms, computeUptimeMs } from "../view-logic/format-time.mjs";
import { earsStatusView, mergeHealth } from "../view-logic/health.mjs";
import { chatDisplayState, chatDisplayFromSseStatus } from "../view-logic/status.mjs";
import { fireNoteFromSseFire } from "../view-logic/control.mjs";
import { shouldAutoOpenSettings } from "../view-logic/settings.mjs";
import { usageNoteText } from "../view-logic/usage.mjs";

/**
 * 購読する SSE イベントの全リスト（現 cockpit.html subscribe :814-897 の addEventListener 13 本と
 * 1:1・ワイヤ契約 13 SSE の写像）。**このリストが移植漏れゼロの機械的な固定点**（fixture が本数と
 * 名前を固定する）。
 */
export const SSE_EVENT_NAMES = [
  "state", //          :816 applyState
  "vad", //            :817-821 speaking 行の出現/消滅
  "transcript", //     :822 転写行
  "expression", //     :824 演出行
  "discard", //        :825-829 カウンタ + ゴースト行
  "diagnostic", //     :830-855 bargeIn 分流 + ゴースト行（意図的非表示は null）
  "soul", //           :857-859 soul 状態（busy 表示・Fire disable は Domain C）
  "fire", //           :860-864 受理マーカー行 + fire-note
  "visionCaptured", // :866 視覚マーカー行
  "usage", //          :868 usage 表示
  "selfFire", //       :874-878 自発マーカー行 / ゴースト行
  "chatStatus", //     :880-885 chat 表示状態（表示本体は Domain C 設定引き出し）
  "chatDiagnostic" //  :888-897 取得死分類のゴースト行
];

/** health 状態の初期値（現 cockpit.html の初期表示 "unknown"（:158-159）と同値）。 */
export function initialHealth() {
  return {
    whisper: { status: "unknown", reason: null },
    ffmpeg: { status: "unknown", reason: null }
  };
}

/**
 * state スナップショット（GET /api/state / SSE state）から Domain C 向けの設定系現況を
 * 取り出す（applyChannel/applyVisionTarget/applySelfFire/applyAudioDevice/applyChat の
 * 入力になる生値・:279-283）。表示導出は view-logic（status.mjs 等）で Domain C が行う。
 * @param {any} s
 */
export function settingsFromSnapshot(s) {
  return {
    channel: (s && s.channel) ?? null,
    visionTarget: (s && s.visionTarget) ?? null,
    selfFire: (s && s.selfFire) ?? null,
    verbosity: (s && s.verbosity) ?? null,
    audioDevice: (s && s.audioDevice) ?? null,
    chat: (s && s.chat) ?? null,
    // S8「キルスイッチ」: サーバの killed 正本はサーバ側で常に boolean（既定 false）なので、他の設定系
    // 現況（null = orchestrator 未注入で「使えない」）とは異なり既定 false に畳む（selfFire/verbosity 等の
    // null 許容パターンとは意図的に非対称）。
    killed: (s && typeof s.killed === "boolean") ? s.killed : false,
    // 多頭化 Domain C: 頭脳の現況（{brain, credentialHealth}）。audioDevice/channel と同型の null 許容
    // （brainStatus 未注入なら null）。
    brain: (s && s.brain) ?? null
  };
}

/**
 * 操縦席 App（観測 + ヘッダ + 運転バー + 設定引き出し = 三層 IA の結線）。
 * @param {{ eventSourceImpl?: any; fetchImpl?: any; nowImpl?: () => number }} props
 */
export function App(props) {
  const now = props.nowImpl || Date.now;

  // ── 観測フィード（rows.mjs の feed 状態） ──
  const [feed, setFeed] = useState(emptyFeed);
  // ── ヘッダ/計器（applyState :265-284 が更新する層） ──
  const [ears, setEars] = useState("stopped");
  const [health, setHealth] = useState(initialHealth);
  const [discarded, setDiscarded] = useState(/** @type {number | string} */ (0));
  const [uptime, setUptime] = useState(() => ({ baseMs: 0, anchorMs: now() }));
  const [nowTick, setNowTick] = useState(() => now());
  const [usageNote, setUsageNote] = useState("");
  // ── 運転バー/設定引き出し（Domain C 実体）へ渡す状態 ──
  const [soul, setSoul] = useState("idle"); //            SSE soul + Fire 応答（applySoulState :434-441 の入力）
  const [fireNote, setFireNote] = useState(""); //        SSE fire accepted:false + Fire 応答（setFireNote :442-444）
  const [chatDisplay, setChatDisplay] = useState(/** @type {string | null} */ (null)); // renderChatStatus 入力（:294-306）
  const [settings, setSettings] = useState(() => settingsFromSnapshot(null));
  const [settingsOpen, setSettingsOpen] = useState(false); // ⚙ 開閉 + 初回自動展開（導線 §4）
  // GET /api/state の取得完了フラグ（design レビュー申し送り 1: fetch 完了前の自動展開誤判定を防ぐ）。
  const [stateLoaded, setStateLoaded] = useState(false);
  const initialSnapshotRef = useRef(/** @type {any} */ (null)); // 自動展開判定用の初回 snapshot。

  // applyState 相当（:265-284）。ハンドラと初期化の両方から呼ぶため ref で固定。
  const applyStateRef = useRef(/** @type {(s: any) => void} */ (() => {}));
  applyStateRef.current = (s) => {
    if (!s) return;
    setEars(s.ears);
    setHealth((prev) => mergeHealth(prev, s.health));
    setDiscarded(s.discarded);
    setUptime({ baseMs: s.uptimeMs || 0, anchorMs: now() }); // :276-277 再同期
    setNowTick(now()); //                                        :278 renderUptime 即時反映
    setChatDisplay(chatDisplayState(s.chat)); //                 applyChat :307-315 の表示部
    setSettings(settingsFromSnapshot(s)); //                     設定系現況（表示は Domain C）
  };

  // SSE の非タイムライン効果（タイムライン行は feedAfterSseEvent が単一経路で担う）。
  const applyNonFeedSseEvent = (eventName, d) => {
    switch (eventName) {
      case "state": //   :816
        applyStateRef.current(d);
        return;
      case "discard": // :825-829 カウンタ（ゴースト行は feed 側）
        setDiscarded(d && d.discarded);
        return;
      case "soul": //    :857-859（applySoulState は運転バー = Domain C の描画へ）
        setSoul(d && d.state);
        return;
      case "fire": //    :860-864 受理はノートをクリア・非受理は reason 表示（文言は view-logic）
        setFireNote(fireNoteFromSseFire(d));
        return;
      case "usage": //   :868 applyUsage :547-554（表示文字列は view-logic）
        setUsageNote(usageNoteText(d));
        return;
      case "chatStatus": // :880-885 renderChatStatus と同じ単一経路の入力へ（正規化は view-logic に片寄せ）
        setChatDisplay(chatDisplayFromSseStatus(d));
        return;
      default:
        return; // vad/transcript/expression/diagnostic/visionCaptured/selfFire/chatDiagnostic は feed のみ。
    }
  };

  // ── 初期化 + SSE 購読（init :899-909 と同順: /api/state → 履歴復元 → applyState → subscribe） ──
  useEffect(() => {
    let cancelled = false;
    /** @type {{ close: () => void } | null} */
    let es = null;
    const fetchImpl = props.fetchImpl || globalThis.fetch;
    const subscribe = () => {
      const ES = props.eventSourceImpl || globalThis.EventSource;
      const source = new ES("/api/events");
      for (const name of SSE_EVENT_NAMES) {
        source.addEventListener(name, (/** @type {{ data: string }} */ ev) => {
          if (cancelled) return;
          const d = JSON.parse(ev.data);
          setFeed((f) => feedAfterSseEvent(f, name, d, now()));
          applyNonFeedSseEvent(name, d);
        });
      }
      return source;
    };
    fetchImpl("/api/state")
      .then((/** @type {any} */ r) => r.json())
      .then((/** @type {any} */ s) => {
        if (cancelled) return;
        setFeed(feedFromHistory(s.transcripts || [], now())); // 履歴復元（latency 無し・:902）
        applyStateRef.current(s);
        initialSnapshotRef.current = s; // 初回自動展開の判定材料（導線 §4）。
        setStateLoaded(true); //          取得成功時のみ立てる（失敗時は自動展開しない）。
      })
      .catch(() => {
        /* 状態取得失敗でもページは開く（:904 踏襲）。stateLoaded は立てない = 誤展開防止。 */
      })
      .then(() => {
        if (!cancelled) es = subscribe();
      });
    return () => {
      cancelled = true;
      if (es) es.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── uptime: listening 中 1s 刻み（setInterval :262 相当・cleanup 付き） ──
  useEffect(() => {
    const t = setInterval(() => setNowTick(now()), 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── 導線（cockpit-redesign.md §4）: 初回（設定空）だけ引き出しを自動展開・二回目以降は観測直行 ──
  // 「GET /api/state 完了（stateLoaded=true）かつ設定空 → 一度だけ」（design レビュー申し送り 1）。
  // 判定式は shouldAutoOpenSettings（view-logic/settings.mjs・fixture 固定）。fetch 失敗時は
  // stateLoaded が立たない = 展開しない（観測直行が既定）。
  const autoOpenedRef = useRef(false);
  useEffect(() => {
    if (!stateLoaded || autoOpenedRef.current) return;
    autoOpenedRef.current = true; // 一度だけ（以後の snapshot 変化では判定しない）。
    if (shouldAutoOpenSettings(initialSnapshotRef.current)) setSettingsOpen(true);
  }, [stateLoaded]);

  // POST 応答（snapshot）の適用を Domain C コンポーネントと共有する安定コールバック
  // （applyStateRef は ref なので参照は常に最新・関数自体は不変 = 子の無駄な再 render を作らない）。
  const applySnapshot = useCallback((/** @type {any} */ s) => applyStateRef.current(s), []);

  const listening = earsStatusView(ears).listening;
  const uptimeText = formatHms(
    computeUptimeMs({ listening, baseMs: uptime.baseMs, anchorMs: uptime.anchorMs, nowMs: nowTick })
  );

  return html`
    <div class="cockpit">
      <${Header}
        ears=${ears}
        health=${health}
        audioDevice=${settings.audioDevice}
        onToggleSettings=${() => setSettingsOpen((v) => !v)}
      />
      <${Feed} rows=${feed.rows} usageNote=${usageNote} discarded=${discarded} uptimeText=${uptimeText} />
      ${/* ── 設定引き出し（Domain C 実体・⚙ で開閉・普段は畳む = CSS .open）── */ ""}
      <${SettingsDrawer}
        open=${settingsOpen}
        onClose=${() => setSettingsOpen(false)}
        settings=${settings}
        chatDisplay=${chatDisplay}
        applySnapshot=${applySnapshot}
        fetchImpl=${props.fetchImpl}
      />
      ${/* ── 運転バー（Domain C 実体・常駐）: soul/setSoul/fireNote/setFireNote の 4 点セット
           （Fire 応答 j は {fired, state, reason} 形で snapshot でない = applySnapshot に乗らない）。 */ ""}
      <${ControlBar}
        soul=${soul}
        setSoul=${setSoul}
        fireNote=${fireNote}
        setFireNote=${setFireNote}
        selfFire=${settings.selfFire}
        verbosity=${settings.verbosity}
        killed=${settings.killed}
        applySnapshot=${applySnapshot}
        fetchImpl=${props.fetchImpl}
      />
    </div>
  `;
}

/**
 * 操縦席のマウント（cockpit.html の inline module = Domain D が呼ぶ唯一の入口）。
 * スタイル注入（冪等）→ App を render。
 * @param {HTMLElement} rootElement  マウント先（例: document.getElementById("app")）。
 * @param {{ eventSourceImpl?: any; fetchImpl?: any; nowImpl?: () => number }} [options]
 */
export function mount(rootElement, options = {}) {
  injectStyles(rootElement.ownerDocument);
  render(html`<${App} ...${options} />`, rootElement);
}
