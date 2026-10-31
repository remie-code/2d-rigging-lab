// @ts-check
/**
 * ui: 操縦席エントリの骨組み（App コンポーネント + mount）。
 *
 * 操縦席の作り直し（cockpit-glance-redesign.md・配信中に横目で見る画面）の結線:
 *  - 上の細い帯（header.mjs TopBar）: 名前・頭のモデル名・状態のピル・異常時だけの警告・残量ゲージ 2 本・KILL
 *    （KILL 中は帯を赤くし復帰ボタン。POST /api/kill は App が持つ）。
 *  - 会話タイムライン（conversation.mjs・左 約 6 割・主役）とコメント（comments.mjs・右 約 3.5 割）。材料は
 *    view-logic/glance-timeline.mjs の状態（glance）で、SSE ごとに glanceAfterSseEvent を通す。配信前（場が閉じて
 *    いる間）は会話の場所の中央に「配信を始める」と「準備・設定」（配信の組み直し Domain D）。
 *  - 「配信を終える」は下の帯の歯車の左（場が開いている間だけ・2 回押し）。始める / 終えるは POST /api/stream/start・stop。
 *  - 下の細い帯（bottom-bar.mjs）: 運転設定の表示・遅延の凡例 8 つ・歯車「準備・設定」。
 *  - 準備・設定（settings-drawer.mjs のダイアログ）: 既存の 4 タブに「運転」（control-bar.mjs DrivePanel = 旧運転
 *    バー + 手動の発火）と「ログ」（今の観測フィード feed.mjs + 旧ヘッダの一目の健康）を足した。初回の自動展開は
 *    やめた（§7・§9.2）。
 *
 * SSE 購読: SSE_EVENT_NAMES（既存 13 本 + 1 回目で足した fireAsk / latency / quota / warnings の 4 本）。
 * 観測フィード（ログのタブ）は rows.mjs の feedAfterSseEvent、会話とコメントは glanceAfterSseEvent、非タイムライン効果
 * （state 適用・discarded・soul・fire-note・usage・chatStatus・quota・warnings）は applyNonFeedSseEvent。
 * 初期化: GET /api/state → 履歴復元（フィードと会話・推論の範囲と遅延は復元しない）→ applyState → SSE 購読。
 *
 * 鉄の設計規律: export function/const のみ・**トップレベル副作用ゼロ**（document/EventSource/window に
 * トップレベルで触れない）。mount(rootElement, options) を呼ぶのは cockpit.html の inline module だけ。
 * EventSource/fetch/Date.now は options で注入可能（既定は globalThis 参照＝Node からの import が安全に通る）。
 */

import { html, render, useState, useEffect, useRef, useCallback } from "../vendor/htm.preact.standalone.mjs";
import { TopBar, HealthLine, cockpitDocumentTitle, identityDisplayName, NEUTRAL_COCKPIT_TITLE } from "./header.mjs";
import { Feed } from "./feed.mjs";
import { DrivePanel } from "./control-bar.mjs";
import { ConversationPanel } from "./conversation.mjs";
import { CommentsPanel } from "./comments.mjs";
import { BottomBar } from "./bottom-bar.mjs";
import { CockpitSettingsModal } from "./settings-drawer.mjs";
import { injectStyles } from "./styles.mjs";
import { emptyFeed, feedFromHistory, feedAfterSseEvent } from "./rows.mjs";
import { formatHms, computeUptimeMs } from "../view-logic/format-time.mjs";
import { earsStatusView, mergeHealth, brainLabel } from "../view-logic/health.mjs";
import { chatDisplayState, chatDisplayFromSseStatus } from "../view-logic/status.mjs";
import { fireNoteFromSseFire, killPostErrorText, killRequestErrorText } from "../view-logic/control.mjs";
import { usageNoteText } from "../view-logic/usage.mjs";
import {
  emptyGlance,
  glanceFromHistory,
  glanceAfterSseEvent,
  conversationRowsView,
  commentRowsView
} from "../view-logic/glance-timeline.mjs";
import { latencyBarView, isPreStream, streamStartView, DEFAULT_LATENCY_THRESHOLDS } from "../view-logic/glance-meters.mjs";

/**
 * 購読する SSE イベントの全リスト（既存 13 本 + 操縦席の作り直し 1 回目で足した 4 本・データの形 §1）。
 * **このリストが移植漏れゼロの機械的な固定点**（fixture が本数と名前を固定する）。
 */
export const SSE_EVENT_NAMES = [
  "state", //          snapshot の適用
  "vad", //            speaking 行の出現/消滅（ログ）
  "transcript", //     転写行（ログ）・会話（you/soul）・コメント（viewer）
  "expression", //     演出行（ログ）
  "discard", //        カウンタ + ゴースト行（ログ）
  "diagnostic", //     bargeIn 分流 + ゴースト行（ログ）
  "soul", //           soul 状態（状態のピル・手動の発火の disable）
  "fire", //           受理マーカー行（ログ）+ fire-note + きっかけ（cause）を fireId で覚える
  "visionCaptured", // 視覚マーカー行（ログ）
  "usage", //          usage 表示（ログ）
  "selfFire", //       自発マーカー行 / ゴースト行（ログ）・判定の札 / 相槌の間隔の薄い行（会話）
  "chatStatus", //     chat 表示状態（設定）
  "chatDiagnostic", // 取得死分類のゴースト行（ログ）・弾いたコメント（コメント）
  "fireAsk", //        推論に使った範囲（最新の 1 回分・会話）
  "latency", //        遅延の棒（1 返事 1 回・会話）
  "quota", //          残量ゲージ（上の帯）
  "warnings" //        警告（上の帯・一覧ごと）
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
    // 話し始めの方式（"classic" | "speak-now"・scheduler 未生成なら null・verbosity と同型・speak-now 合意 §5）。
    speakStart: (s && s.speakStart) ?? null,
    // 忙しい間に届いたコメントの扱い（"hold" | "drop"・scheduler 未生成なら null・コメント反応の合意 §2）。
    commentBusy: (s && s.commentBusy) ?? null,
    // 「朗読と合いの手」: barge-in トグルの現況（gate 未生成 = orchestrator.interrupt 未対応なら null・
    // selfFire と同型）。
    bargeIn: (s && s.bargeIn) ?? null,
    audioDevice: (s && s.audioDevice) ?? null,
    chat: (s && s.chat) ?? null,
    // S8「キルスイッチ」: サーバの killed 正本はサーバ側で常に boolean（既定 false）なので、他の設定系
    // 現況（null = orchestrator 未注入で「使えない」）とは異なり既定 false に畳む（selfFire/verbosity 等の
    // null 許容パターンとは意図的に非対称）。
    killed: (s && typeof s.killed === "boolean") ? s.killed : false,
    // 多頭化 Domain C: 頭脳の現況（{brain, credentialHealth}）。audioDevice/channel と同型の null 許容
    // （brainStatus 未注入なら null）。
    brain: (s && s.brain) ?? null,
    // 配信の組み直し Domain A: ロールの現況（{ id, displayName, brain, body, roles }）。brain と同型の null 許容
    // （roleStatus 未注入なら null）。
    role: (s && s.role) ?? null,
    // 配信の組み直し Domain A: 起動時の知らせ（ロールへの引っ越しの結果の行・ログのタブに出す）。無ければ空。
    notices: s && Array.isArray(s.notices) ? s.notices.filter((/** @type {unknown} */ line) => typeof line === "string") : [],
    // 配信間記憶: 記憶の現況（{lastRecordAtMs, recording}）。brain と同型の null 許容
    // （memoryStatus 未注入なら null）。
    memory: (s && s.memory) ?? null,
    // 圧縮の目安（{ thresholdTokens }・設定「頭脳・会話」タブの圧縮を始める大きさ）。memory と同型の null 許容
    // （contextCompactionStatus 未注入なら null）。
    compaction: (s && s.compaction) ?? null,
    // ①の Codex の頭の fast（{ enabled, applicable, supported }・設定「頭脳・会話」タブ）。compaction と同型の
    // null 許容（codexFastStatus 未注入なら null）。
    codexFast: (s && s.codexFast) ?? null,
    // 配信の組み直し Domain D: 場の状態（{ phase, error, openedAtMs }・メイン画面の「配信を始める / 終える」と、場が開いている
    // 間のマイク・文字起こしの固定）。無い古いサーバは null（画面は耳の状態から読む）。
    stream: (s && s.stream) ?? null
  };
}

/**
 * 起動時の知らせ（配信の組み直し Domain A: ロールへの引っ越しの結果）をログのタブの上に出す（hooks 非使用）。
 * 引っ越しが起きた起動だけサーバが行を渡す（無ければ何も描かない）。
 * @param {{ notices?: ReadonlyArray<string> }} props
 */
export function StartupNotices({ notices }) {
  const lines = Array.isArray(notices) ? notices : [];
  if (lines.length === 0) return null;
  return html`
    <div class="startup-notices" role="note" aria-label="起動時の知らせ">
      ${lines.map((line, i) => html`<p key=${i} class="startup-notice">${line}</p>`)}
    </div>
  `;
}

/**
 * 操縦席 App（上の帯 + 会話 + コメント + 下の帯 + 準備・設定の結線）。
 * @param {{ eventSourceImpl?: any; fetchImpl?: any; nowImpl?: () => number }} props
 */
export function App(props) {
  const now = props.nowImpl || Date.now;

  // ── 観測フィード（rows.mjs の feed 状態・ログのタブ） ──
  const [feed, setFeed] = useState(emptyFeed);
  // ── 会話とコメント（view-logic/glance-timeline.mjs の状態・メイン画面） ──
  const [glance, setGlance] = useState(emptyGlance);
  // ── 上の帯の計器（snapshot + SSE quota / warnings）と遅延のしきい値（snapshot） ──
  const [quota, setQuota] = useState(/** @type {any} */ (null));
  const [warnings, setWarnings] = useState(/** @type {any[]} */ ([]));
  const [latencyThresholds, setLatencyThresholds] = useState(/** @type {any} */ (DEFAULT_LATENCY_THRESHOLDS));
  const [killError, setKillError] = useState("");
  // 頭の会話の圧縮の最中か（snapshot の compacting・状態のピルの「圧縮中」。開き直しても snapshot で戻る）。
  const [compacting, setCompacting] = useState(false);
  // ── ヘッダ/計器（applyState :265-284 が更新する層） ──
  const [ears, setEars] = useState("stopped");
  const [health, setHealth] = useState(initialHealth);
  // 操縦席の文字起こし選択: 方式と状態（ヘッダの `stt:`・設定の選択肢の復元）と Start 時のマイク名（ヘッダの `mic:`）。
  const [stt, setStt] = useState(/** @type {any} */ (null));
  // 声の方式と状態（設定の選択肢の復元・ログのタブの健康 1 行の `tts:`・声の差し替え Wave 3）。
  const [tts, setTts] = useState(/** @type {any} */ (null));
  const [device, setDevice] = useState(/** @type {string | null} */ (null));
  const [discarded, setDiscarded] = useState(/** @type {number | string} */ (0));
  const [uptime, setUptime] = useState(() => ({ baseMs: 0, anchorMs: now() }));
  const [nowTick, setNowTick] = useState(() => now());
  const [usageNote, setUsageNote] = useState("");
  // ── 運転タブ/準備・設定へ渡す状態 ──
  const [soul, setSoul] = useState("idle"); //            SSE soul + Fire 応答（applySoulState :434-441 の入力）
  const [fireNote, setFireNote] = useState(""); //        SSE fire accepted:false + Fire 応答（setFireNote :442-444）
  const [chatDisplay, setChatDisplay] = useState(/** @type {string | null} */ (null)); // renderChatStatus 入力（:294-306）
  const [settings, setSettings] = useState(() => settingsFromSnapshot(null));
  // 準備・設定の開閉（歯車・配信前の「準備・設定を開く」。初回の自動展開はしない・§7・§9.2）。
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsCloseRequestRef = useRef(/** @type {() => void} */ (() => setSettingsOpen(false)));
  // 配信の組み直し Domain D: 「配信を始める」の要求そのものの失敗（通信の失敗・409。始められなかった理由はサーバの
  // stream.error が持つ）と、「配信を終える」の 2 回押しの 1 回目（armed・数秒で戻す）。
  const [streamRequestError, setStreamRequestError] = useState("");
  const [endArmed, setEndArmed] = useState(false);
  const endArmTimerRef = useRef(/** @type {any} */ (null));

  // applyState 相当（:265-284）。ハンドラと初期化の両方から呼ぶため ref で固定。
  const applyStateRef = useRef(/** @type {(s: any) => void} */ (() => {}));
  applyStateRef.current = (s) => {
    if (!s) return;
    setEars(s.ears);
    setHealth((prev) => mergeHealth(prev, s.health));
    if (s.stt) setStt(s.stt); //                                  欠落は前値保持（health と同じ流儀）
    if (s.tts) setTts(s.tts); //                                  同上（声の方式と状態）
    setDevice(typeof s.device === "string" ? s.device : null);
    setDiscarded(s.discarded);
    setUptime({ baseMs: s.uptimeMs || 0, anchorMs: now() }); // :276-277 再同期
    setNowTick(now()); //                                        :278 renderUptime 即時反映
    setChatDisplay(chatDisplayState(s.chat)); //                 applyChat :307-315 の表示部
    setSettings(settingsFromSnapshot(s)); //                     設定系現況（表示は Domain C）
    // 操縦席の作り直し 1 回目のキー（無い古いサーバでは前値のまま）。
    if ("quota" in s) setQuota(s.quota ?? null);
    if (Array.isArray(s.warnings)) setWarnings(s.warnings);
    if (s.latencyThresholds && typeof s.latencyThresholds === "object") setLatencyThresholds(s.latencyThresholds);
    // 圧縮の最中か（無い古いサーバでは前値のまま・true のときだけ圧縮中）。
    if ("compacting" in s) setCompacting(s.compacting === true);
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
      case "quota": //   値が変わったとき（{ codex, elevenlabs }）
        setQuota(d ?? null);
        return;
      case "warnings": // 一覧が変わったとき（一覧ごと）
        setWarnings(d && Array.isArray(d.warnings) ? d.warnings : []);
        return;
      default:
        return; // それ以外は feed / glance のみ。
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
          const nowMs = now();
          setFeed((f) => feedAfterSseEvent(f, name, d, nowMs));
          setGlance((g) => glanceAfterSseEvent(g, name, d, nowMs));
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
        setGlance(glanceFromHistory(s.transcripts || [], now())); // 会話とコメント（範囲・遅延は復元しない）
        applyStateRef.current(s);
      })
      .catch(() => {
        /* 状態取得失敗でもページは開く（:904 踏襲）。 */
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

  // POST 応答（snapshot）の適用を Domain C コンポーネントと共有する安定コールバック
  // （applyStateRef は ref なので参照は常に最新・関数自体は不変 = 子の無駄な再 render を作らない）。
  const applySnapshot = useCallback((/** @type {any} */ s) => applyStateRef.current(s), []);

  // The HTML starts with a neutral title. Once current server state arrives,
  // reflect only the additive public identity view; malformed/missing data
  // deliberately returns to the neutral title instead of retaining stale text.
  const currentIdentity = settings && settings.brain ? settings.brain.identity : null;
  useEffect(() => {
    const doc = globalThis.document;
    if (!doc || typeof doc !== "object") return;
    doc.title = cockpitDocumentTitle(currentIdentity);
  }, [currentIdentity]);

  /**
   * KILL / 復帰（上の帯の小さなボタン・明示 boolean を送る。トグルではない）。成功は snapshot 全体の応答を適用する。
   * @param {boolean} nextKilled
   */
  const setKilled = (nextKilled) => {
    const doFetch = props.fetchImpl || globalThis.fetch;
    setKillError("");
    doFetch("/api/kill", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ killed: nextKilled })
    })
      .then((/** @type {any} */ r) => r.json().then((/** @type {any} */ j) => ({ ok: r.ok, status: r.status, j })))
      .then((/** @type {any} */ res) => {
        const err = killPostErrorText(res);
        if (err != null) {
          setKillError(err);
          return;
        }
        applySnapshot(res.j);
      })
      .catch((/** @type {unknown} */ e) => setKillError(killRequestErrorText(e)));
  };

  /**
   * 「配信を始める」（メイン画面の中央・配信の組み直し Domain D）。マイク・文字起こし・声は前回の選択（サーバの記憶）で
   * 始める（選び直すのは準備・設定）。成功も失敗も応答の snapshot を適用する（失敗の理由は stream.error に載る）。
   */
  const startStream = () => {
    const doFetch = props.fetchImpl || globalThis.fetch;
    setStreamRequestError("");
    doFetch("/api/stream/start", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" })
      .then((/** @type {any} */ r) => r.json().then((/** @type {any} */ j) => ({ ok: r.ok, status: r.status, j })))
      .then((/** @type {any} */ res) => {
        if (res.ok) {
          applySnapshot(res.j);
          return;
        }
        if (res.j && res.j.state) applySnapshot(res.j.state);
        // 始めるの途中で失敗した理由はサーバの stream.error に残る。それ以外（409 など）はここで出す。
        if (!(res.j && res.j.state && res.j.state.stream && res.j.state.stream.error)) {
          setStreamRequestError((res.j && res.j.error) || "配信を始められない");
        }
      })
      .catch((/** @type {unknown} */ e) => setStreamRequestError(`配信を始められない（${String(e)}）`));
  };

  /** 「配信を終える」（下の帯・2 回押し）。1 回目は armed にするだけ（4 秒で戻す）、続けて押したら終える。 */
  const endStream = () => {
    if (endArmTimerRef.current) clearTimeout(endArmTimerRef.current);
    if (!endArmed) {
      setEndArmed(true);
      endArmTimerRef.current = setTimeout(() => setEndArmed(false), 4000);
      return;
    }
    setEndArmed(false);
    endArmTimerRef.current = null;
    const doFetch = props.fetchImpl || globalThis.fetch;
    doFetch("/api/stream/stop", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" })
      .then((/** @type {any} */ r) => r.json())
      .then((/** @type {any} */ j) => applySnapshot(j && j.state ? j.state : j))
      .catch(() => {
        /* 終えるの途中の状態は SSE の state で届く。 */
      });
  };

  // 歯車・配信前の「準備・設定」（開いているときは閉じる要求 = 未保存の会話指示の確認を通す）。
  const toggleSettings = () => {
    if (settingsOpen) {
      settingsCloseRequestRef.current();
    } else {
      setSettingsOpen(true);
    }
  };

  const listening = earsStatusView(ears).listening;
  const uptimeText = formatHms(
    computeUptimeMs({ listening, baseMs: uptime.baseMs, anchorMs: uptime.anchorMs, nowMs: nowTick })
  );
  const soulName = identityDisplayName(currentIdentity);
  const convoRows = conversationRowsView(glance, {
    soulName: soulName === NEUTRAL_COCKPIT_TITLE ? "soul" : soulName,
    latencyView: (rec) => latencyBarView(rec, latencyThresholds)
  });
  const commentRows = commentRowsView(glance);
  const modelText = settings.brain && settings.brain.brain ? brainLabel(settings.brain) : "";

  return html`
    <div class="cockpit">
      <${TopBar}
        identity=${currentIdentity}
        modelText=${modelText === "unknown" ? "" : modelText}
        soul=${soul}
        ears=${ears}
        compacting=${compacting}
        warnings=${warnings}
        quota=${quota}
        killed=${settings.killed}
        killError=${killError}
        nowMs=${nowTick}
        onKill=${() => setKilled(true)}
        onRevive=${() => setKilled(false)}
      />
      <main class="glance-main">
        <${ConversationPanel}
          rows=${convoRows}
          preStream=${isPreStream(ears, settings.stream)}
          start=${streamStartView(settings.stream, streamRequestError)}
          onStartStream=${startStream}
          onOpenSettings=${toggleSettings}
        />
        <${CommentsPanel} rows=${commentRows} />
      </main>
      <${BottomBar} settings=${settings} settingsOpen=${settingsOpen} onOpenSettings=${toggleSettings}
        endArmed=${endArmed} onEndStream=${endStream} />
      ${/* ── 準備・設定（歯車で開閉・普段は畳む）。運転とログのタブの中身はここで組んで渡す。── */ ""}
      <${CockpitSettingsModal}
        open=${settingsOpen}
        onClose=${() => setSettingsOpen(false)}
        settings=${settings}
        sttEngine=${stt ? stt.engine : null}
        ttsEngine=${tts ? tts.engine : null}
        chatDisplay=${chatDisplay}
        applySnapshot=${applySnapshot}
        fetchImpl=${props.fetchImpl}
        closeRequestRef=${settingsCloseRequestRef}
        driveSlot=${html`
          <${DrivePanel}
            soul=${soul}
            setSoul=${setSoul}
            fireNote=${fireNote}
            setFireNote=${setFireNote}
            selfFire=${settings.selfFire}
            verbosity=${settings.verbosity}
            speakStart=${settings.speakStart}
            commentBusy=${settings.commentBusy}
            bargeIn=${settings.bargeIn}
            applySnapshot=${applySnapshot}
            fetchImpl=${props.fetchImpl}
          />`}
        logSlot=${(/** @type {boolean} */ active) => html`
          <${HealthLine} ears=${ears} health=${health} audioDevice=${settings.audioDevice} stt=${stt} tts=${tts} device=${device} />
          <${StartupNotices} notices=${settings.notices} />
          <${Feed} rows=${feed.rows} usageNote=${usageNote} discarded=${discarded} uptimeText=${uptimeText} active=${active} />`}
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
