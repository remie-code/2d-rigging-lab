// @ts-nocheck
/**
 * Reference driver — 特区 apps/soul の最初の住人（C4 Domain D, 設計 §7）。
 *
 * LLM・知覚を持たない疑似魂。決定論的なシナリオ（注視 → 傾げ → 沈黙 → 再開 →
 * エンベロープ相[表情ピーク・重ねがけ・body 持続駆動] → 意図的切断 → 再接続）を操縦
 * チャネルへタイムテーブルで流す。intent.set（粗い上書き）と intent.envelope（器が
 * 60Hz で描く曲線）の両 kind を additive に共存させる（C5 §2）。役割は ①持続駆動
 * 機械テストの駆動源 ②契約エルゴノミクス（外部から書く行為そのもの）の検証
 * ③C5 人間ゲートの証人（表情ピーク・重ねがけ・魂殺し→release）④魂側開発への実行可能な手本。
 *
 * 依存ゼロ（憲章 §6.2 / 裁定 5）:
 *  - Node 22 のグローバル `WebSocket`（undici 由来のクライアント）だけを使う。npm 依存も
 *    tsx などのトランスパイラも無い。素の `.mjs` として `node reference-driver.mjs <url>`
 *    で直実行できる。器のコードは一切 import しない（器との会話は WS 越しのみ、§6.2）。
 *  - 契約（型・fixture=JSON）は「読むだけ」許される（§6.2）。ここでは器側の契約 JSON
 *    `apps/runtime-player/src/main/control-channel/contract/*.json` を `readFileSync` で
 *    参照し、自分が送る slotId が契約の語彙に収まっているか / 受け取った server.hello が
 *    契約の supportedKinds を満たすかを自己照合する。これは「器コードの import」ではなく
 *    「契約の参照」であり、特区方向ルール検査でも許容される（readFileSync は import 文では
 *    ない。詳細は scripts/check-soul-zone-boundary.mjs のコメント）。契約が読めない環境
 *    （standalone 配布等）では組み込みの最小語彙にフォールバックする。
 *
 * 使い方（URL は位置引数。CLI 切替はドライバ内で完結・package.json は置かない）:
 *   機械テスト（既定=圧縮シナリオ）:
 *     node apps/soul/reference-driver/reference-driver.mjs "ws://127.0.0.1:<port>/channel?token=<token>"
 *   人間ゲート（知覚シナリオ・envelope 主体・attack 200〜400ms・現実的な間合い）:
 *     node apps/soul/reference-driver/reference-driver.mjs "ws://.../channel?token=..." --scenario=perceptual
 *   発話シナリオ（C6 intent.speech・fixture モーラ列「これじっさいのところどうなってるの」を一発送る）:
 *     node apps/soul/reference-driver/reference-driver.mjs "ws://.../channel?token=..." --scenario=speech
 *   タイムライン印字（WS 不要・URL 不要。ドライバ単体検証の土台）:
 *     node apps/soul/reference-driver/reference-driver.mjs --scenario=perceptual --print-timeline
 *
 * 標準出力に 1 行の JSON レポート（`{"kind":"reference-driver-report",...}`）を出す。
 * RTT p95（intent.set 送信 → accepted/rejected 応答の往復）を算出し、レポートに載せる。
 * ゲート閾値は p95 < 100ms（loopback、緩め。裁定 7）。この閾値の判定自体は持続駆動テスト
 * （器側 vitest）が行う。ドライバはシナリオを完遂できたら exit 0、契約破綻（hello 不着 /
 * 応答不着 / 想定外拒否 / 接続失敗）なら exit 1、引数不正なら exit 2 を返す。
 */

import { readFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import path from "node:path";

const REPLY_TIMEOUT_MS = 4000;
const HELLO_TIMEOUT_MS = 4000;

// 実時間を圧縮したシナリオ（持続駆動テストの flaky 対策。裁定=実時間圧縮の設計判断）。
// 数分駆動の性格（フレーム停滞なし・切断/再接続）を、数百 ms〜約 1 秒に畳んで再現する。
// 環境変数 SOUL_DRIVER_PHASE_SCALE で更に伸縮できる（テストが必要なら渡す）。
const phaseScale = readPositiveFloatEnv("SOUL_DRIVER_PHASE_SCALE", 1);
const SILENCE_MS = Math.round(200 * phaseScale);
const INTER_INTENT_MS = Math.round(30 * phaseScale);
const RECONNECT_GAP_MS = Math.round(60 * phaseScale);
// Envelope (C5) curve durations — compressed like the set phases. attack/sustain/
// decay for the expression peaks; BODY_SUSTAIN is long so the body envelope is still
// alive when the driver intentionally disconnects (mid-kill → release, 人間ゲート 目玉④).
const ENV_ATTACK_MS = Math.round(60 * phaseScale);
const ENV_SUSTAIN_MS = Math.round(120 * phaseScale);
const ENV_DECAY_MS = Math.round(90 * phaseScale);
const ENV_BODY_SUSTAIN_MS = Math.round(400 * phaseScale);

// 人間ゲート用の知覚シナリオ（--scenario=perceptual）の相間の間合い。機械テストの圧縮値
// （30ms 間隔）ではなく現実的な数百 ms〜秒オーダー。各 envelope が「演じる」に見える尺を取る。
// phaseScale は掛けない（知覚用の固定尺。実時間で観測する人間ゲート専用のため flaky 無関係）。
const PERCEPTUAL_EXPRESSION_HOLD_MS = 900;
const PERCEPTUAL_REATTACK_HOLD_MS = 1200;
const PERCEPTUAL_BODY_OBSERVE_MS = 900;

/**
 * 組み込みの最小 slot 語彙（契約 JSON が読めない場合のフォールバック）。契約の正は
 * 器側の channel-intent-set-payload-schema.json（enum）であり、これはその写し。
 */
const FALLBACK_SLOT_IDS = [
  "head-horizontal",
  "head-vertical",
  "head-tilt",
  "eye-blink-left",
  "eye-blink-right",
  "gaze-horizontal",
  "gaze-vertical",
  "mouth-open",
  "mouth-smile",
  "body-x",
  "body-z"
];

async function main() {
  // CLI（依存ゼロで完結。package.json は置かない）: URL は従来どおり位置引数（argv[2]）。
  // シナリオ切替は `--scenario=perceptual`（既定=引数なし=圧縮シナリオ。持続駆動テストが
  // 引数なし spawn で回す=無退行絶対）。`--print-timeline` は WS 接続せずタイムラインを印字。
  const argv = process.argv.slice(2);
  const flags = argv.filter((arg) => arg.startsWith("--"));
  const positionals = argv.filter((arg) => !arg.startsWith("--"));
  const scenarioName = parseScenarioFlag(flags);

  // Dry-run: print the selected scenario's timeline (kind marker + scenario id + each
  // section's kind/slot/attackMs/sustainMs, in order) as one-line JSON and exit 0. No WS,
  // URL not needed — the boundary-clean substrate for the driver-only timeline test.
  if (flags.includes("--print-timeline")) {
    process.stdout.write(`${JSON.stringify(buildTimeline(scenarioName))}\n`);
    process.exit(0);
    return;
  }

  const url = positionals[0];
  if (typeof url !== "string" || url.length === 0) {
    process.stderr.write(
      "usage: node reference-driver.mjs <ws-url> [--scenario=compressed|perceptual|speech] [--print-timeline]\n" +
        '  e.g. node reference-driver.mjs "ws://127.0.0.1:17310/channel?token=..."\n'
    );
    process.exit(2);
    return;
  }

  const contract = loadContract();
  if (scenarioName === "perceptual") {
    await runPerceptualScenario(url, contract);
    return;
  }
  if (scenarioName === "speech") {
    await runSpeechScenario(url, contract);
    return;
  }
  await runCompressedScenario(url, contract);
}

/**
 * 圧縮シナリオ（機械テストの駆動源。既定・引数なし）: 注視→傾げ→沈黙→再開→エンベロープ相
 * →意図的切断→再接続を実時間圧縮で回す。持続駆動テストが引数なし spawn で回すため、
 * 出力（reference-driver-report）と exit code は不変。
 */
async function runCompressedScenario(url, contract) {
  const rttSamples = [];
  const events = [];
  let acceptedCount = 0;
  let rejectedCount = 0;
  let unknownEventsIgnored = 0;

  const {
    gazePhase,
    tiltPhase,
    resumePhase,
    reconnectPhase,
    envelopePhase
  } = buildCompressedScenario();

  // 送る slotId が契約語彙に収まっていることを自己照合（契約=正の尊重）。set/envelope 両相を含む。
  const scenarioSlotIds = new Set(
    [
      ...gazePhase,
      ...tiltPhase,
      ...resumePhase,
      ...reconnectPhase,
      ...envelopePhase
    ].map((intent) => intent.slotId)
  );
  const vocabularyViolations = [...scenarioSlotIds].filter(
    (slotId) => !contract.slotIds.has(slotId)
  );
  if (vocabularyViolations.length > 0) {
    fail(
      `scenario uses slotId(s) outside the contract vocabulary: ${vocabularyViolations.join(", ")}`
    );
  }

  const runIntent = async (connection, intent) => {
    const outcome = await connection.sendIntent(intent);
    rttSamples.push(outcome.rttMs);
    events.push({ slotId: intent.slotId, result: outcome.result });
    if (outcome.result === "accepted") {
      acceptedCount += 1;
    } else {
      rejectedCount += 1;
    }
    return outcome;
  };

  const runEnvelope = async (connection, intent) => {
    const outcome = await connection.sendEnvelope(intent);
    rttSamples.push(outcome.rttMs);
    events.push({ slotId: intent.slotId, result: outcome.result, kind: "envelope" });
    if (outcome.result === "accepted") {
      acceptedCount += 1;
    } else {
      rejectedCount += 1;
    }
    return outcome;
  };

  try {
    // ── 接続 1: 注視 → 傾げ → 沈黙 → 再開 ─────────────────────────────
    const first = await connect(url, contract);
    unknownEventsIgnored += first.consumeUnknownEventCount();

    for (const intent of gazePhase) {
      await runIntent(first, intent);
      await delay(INTER_INTENT_MS);
    }
    for (const intent of tiltPhase) {
      await runIntent(first, intent);
      await delay(INTER_INTENT_MS);
    }

    // 沈黙: 送らずに待つ（途絶 → 既定窓で失効する様式を体現。設計 §4c）。
    await delay(SILENCE_MS);

    for (const intent of resumePhase) {
      await runIntent(first, intent);
      await delay(INTER_INTENT_MS);
    }

    // ── エンベロープ相（表情ピーク → 重ねがけ → body 持続駆動） ──────────
    for (const intent of envelopePhase) {
      await runEnvelope(first, intent);
      await delay(INTER_INTENT_MS);
    }

    // ── 意図的切断（body-x エンベロープが生存中に kill = 魂殺しの証人 目玉④） ──
    unknownEventsIgnored += first.consumeUnknownEventCount();
    await first.close();
    await delay(RECONNECT_GAP_MS);

    // ── 再接続: 追加インテント ──────────────────────────────────────
    const second = await connect(url, contract);
    for (const intent of reconnectPhase) {
      await runIntent(second, intent);
      await delay(INTER_INTENT_MS);
    }
    unknownEventsIgnored += second.consumeUnknownEventCount();
    await second.close();
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
  }

  const rtt = summarizeRtt(rttSamples);
  const report = {
    kind: "reference-driver-report",
    version: 1,
    url: redactToken(url),
    intentCount: rttSamples.length,
    acceptedCount,
    rejectedCount,
    reconnected: true,
    unknownEventsIgnored,
    contractSource: contract.source,
    rttMs: rtt,
    gate: { p95BudgetMs: 100, p95WithinBudget: rtt.p95 < 100 }
  };

  process.stdout.write(`${JSON.stringify(report)}\n`);
  process.stderr.write(
    `reference-driver: ${report.intentCount} intents ` +
      `(${acceptedCount} accepted, ${rejectedCount} rejected), ` +
      `reconnected, RTT p50=${rtt.p50.toFixed(2)}ms p95=${rtt.p95.toFixed(2)}ms ` +
      `max=${rtt.max.toFixed(2)}ms — p95 budget 100ms: ${rtt.p95 < 100 ? "OK" : "OVER"}\n`
  );

  // シナリオ完遂で成功。想定外拒否があればゲート観点で失敗にする（全値は域内 = 全 accepted の想定）。
  if (rejectedCount > 0) {
    process.exit(1);
    return;
  }
  process.exit(0);
}

/** `--scenario=perceptual|speech|compressed`（既定=compressed）。値不正も compressed に倒す。 */
function parseScenarioFlag(flags) {
  const flag = flags.find(
    (arg) => arg === "--scenario" || arg.startsWith("--scenario=")
  );
  if (flag === undefined) {
    return "compressed";
  }
  const eq = flag.indexOf("=");
  const value = eq >= 0 ? flag.slice(eq + 1) : "";
  if (value === "perceptual") {
    return "perceptual";
  }
  if (value === "speech") {
    return "speech";
  }
  return "compressed";
}

/**
 * 圧縮シナリオのインテント相（純データ）。実行（runCompressedScenario）と印字
 * （compressedSections/--print-timeline）が同じ定義を共有する。ttlMs は明示（この頷きは
 * N ms 有効）と省略（既定窓 = ストリーミング様式）の両スタイルを意図的に混ぜる（設計 §4）。
 */
function buildCompressedScenario() {
  const gazePhase = [
    { slotId: "gaze-horizontal", value: 0.3, ttlMs: 400 },
    { slotId: "gaze-vertical", value: -0.2 } // ttl 省略 = 既定窓
  ];
  const tiltPhase = [
    { slotId: "head-tilt", value: 0.25, ttlMs: 300 },
    // 「動く」の証人: 長め ttl で持続駆動テストが frame を捕まえられる窓を作る。
    { slotId: "head-horizontal", value: 0.5, ttlMs: 600 }
  ];
  const resumePhase = [
    { slotId: "gaze-horizontal", value: -0.1 }, // ttl 省略
    { slotId: "head-horizontal", value: 0.2, ttlMs: 300 }
  ];
  const reconnectPhase = [
    { slotId: "head-tilt", value: -0.15, ttlMs: 300 },
    { slotId: "eye-blink-left", value: 1, ttlMs: 200 }
  ];
  // ── C5 エンベロープ相（additive: 旧 intent.set 経路と共存を実証） ─────────────
  const envelopePhase = [
    {
      slotId: "head-vertical",
      peak: 0.6,
      attackMs: ENV_ATTACK_MS,
      sustainMs: ENV_SUSTAIN_MS,
      decayMs: ENV_DECAY_MS
    },
    {
      // 重ねがけ: 同一スロットへ符号の異なるピークを連続送信（re-attack の連続性）。
      slotId: "head-vertical",
      peak: -0.3,
      attackMs: ENV_ATTACK_MS,
      sustainMs: ENV_SUSTAIN_MS,
      decayMs: ENV_DECAY_MS
    },
    {
      // body 持続駆動: 長い sustain。切断時にまだ生きている（mid-kill → release）。
      slotId: "body-x",
      peak: 0.5,
      attackMs: ENV_ATTACK_MS,
      sustainMs: ENV_BODY_SUSTAIN_MS,
      decayMs: ENV_DECAY_MS
    }
  ];
  return { gazePhase, tiltPhase, resumePhase, reconnectPhase, envelopePhase };
}

/**
 * 知覚シナリオの四つの節（--scenario=perceptual）。envelope 主体・attack 200〜400ms・
 * 現実的な尺。① 表情ピーク → ② 重ねがけ（同一 head-vertical へ符号反転 re-attack）→
 * ③ body 長 sustain 駆動 → ④ 意図的 kill（body-x が sustain 中に切断 → release 観測）。
 * peak は契約の正規化域内（centered slot は負値も可）。実行と印字が同じ定義を共有する。
 */
function perceptualSections() {
  return [
    {
      section: "expression-peak",
      kind: "intent.envelope",
      slotId: "head-vertical",
      peak: 0.6,
      attackMs: 300,
      sustainMs: 600,
      decayMs: 400
    },
    {
      section: "layering-reattack",
      kind: "intent.envelope",
      slotId: "head-vertical",
      peak: -0.4,
      attackMs: 300,
      sustainMs: 500,
      decayMs: 400
    },
    {
      section: "body-sustain",
      kind: "intent.envelope",
      slotId: "body-x",
      peak: 0.5,
      attackMs: 400,
      sustainMs: 1500,
      decayMs: 400
    },
    {
      section: "intentional-kill",
      kind: "disconnect",
      slotId: null
    }
  ];
}

/** 圧縮シナリオを --print-timeline 用の節列に射影する（実行経路は不変・読むだけ）。 */
function compressedSections() {
  const { gazePhase, tiltPhase, resumePhase, reconnectPhase, envelopePhase } =
    buildCompressedScenario();
  const setSection = (intent, section) => ({
    section,
    kind: "intent.set",
    slotId: intent.slotId,
    peak: intent.value,
    ttlMs: intent.ttlMs ?? null
  });
  const envSection = (intent, section) => ({
    section,
    kind: "intent.envelope",
    slotId: intent.slotId,
    peak: intent.peak,
    attackMs: intent.attackMs,
    sustainMs: intent.sustainMs,
    decayMs: intent.decayMs
  });
  return [
    ...gazePhase.map((intent) => setSection(intent, "gaze")),
    ...tiltPhase.map((intent) => setSection(intent, "tilt")),
    ...resumePhase.map((intent) => setSection(intent, "resume")),
    ...envelopePhase.map((intent) => envSection(intent, "envelope")),
    { section: "disconnect", kind: "disconnect", slotId: null },
    ...reconnectPhase.map((intent) => setSection(intent, "reconnect"))
  ];
}

/**
 * 発話シナリオの fixture モーラ列（--scenario=speech, C6）。「これじっさいのところどうなってるの」
 * を器の口に喋らせる。促音「っ」は母音を持たないため省略（15 モーラ: o,e,i,a,i / o,o,o,o,o /
 * u,a,e,u,o）。「のところど」= o×5 連続は再調音ディップの試金石（同母音連続でも拍ごとに口が動くか）。
 * timeMs は単調増加（〜110〜130ms 間隔）、s は器の s 縮小前の開き強度 0.5〜0.9（手書き）。
 * 契約 examples（channel-exchange-examples.json の speechPath）の payload と同一に保つ（手写し）。
 * 音素→母音写像は魂側だが fixture モーラ列の作成例は参照ドライバに含めてよい（設計 §6）。
 */
function speechTimelineMoras() {
  return [
    { timeMs: 0, vowel: "o", s: 0.6 },
    { timeMs: 120, vowel: "e", s: 0.7 },
    { timeMs: 250, vowel: "i", s: 0.5 },
    { timeMs: 380, vowel: "a", s: 0.85 },
    { timeMs: 510, vowel: "i", s: 0.55 },
    { timeMs: 630, vowel: "o", s: 0.7 },
    { timeMs: 740, vowel: "o", s: 0.65 },
    { timeMs: 850, vowel: "o", s: 0.7 },
    { timeMs: 960, vowel: "o", s: 0.65 },
    { timeMs: 1070, vowel: "o", s: 0.7 },
    { timeMs: 1190, vowel: "u", s: 0.6 },
    { timeMs: 1320, vowel: "a", s: 0.8 },
    { timeMs: 1450, vowel: "e", s: 0.7 },
    { timeMs: 1580, vowel: "u", s: 0.55 },
    { timeMs: 1700, vowel: "o", s: 0.6 }
  ];
}

/** 発話シナリオを --print-timeline 用の節列に射影する（一発話=一 intent.speech=一節）。 */
function speechSections() {
  return [
    {
      section: "speech",
      kind: "intent.speech",
      slotId: null,
      timeline: speechTimelineMoras()
    }
  ];
}

/** 選択シナリオのタイムライン（kind マーカー + scenario id + 節列）。--print-timeline 用。 */
function buildTimeline(scenarioName) {
  let sections;
  if (scenarioName === "perceptual") {
    sections = perceptualSections();
  } else if (scenarioName === "speech") {
    sections = speechSections();
  } else {
    sections = compressedSections();
  }
  return {
    kind: "reference-driver-timeline",
    version: 1,
    scenario: scenarioName,
    sections
  };
}

/**
 * 知覚シナリオ（--scenario=perceptual）: 人間ゲートの証人。envelope 主体・現実的な間合いで
 * 四つの節を実時間で流し、④ で body-x sustain 中に意図的切断して release を観測させる。
 */
async function runPerceptualScenario(url, contract) {
  const sections = perceptualSections();
  const envelopes = sections.filter((section) => section.kind === "intent.envelope");

  // 語彙自己照合（契約=正）: perceptual の各 envelope slot が契約語彙に収まっているか。
  const scenarioSlotIds = new Set(envelopes.map((section) => section.slotId));
  const vocabularyViolations = [...scenarioSlotIds].filter(
    (slotId) => !contract.slotIds.has(slotId)
  );
  if (vocabularyViolations.length > 0) {
    fail(
      `perceptual scenario uses slotId(s) outside the contract vocabulary: ${vocabularyViolations.join(", ")}`
    );
  }

  const rttSamples = [];
  let acceptedCount = 0;
  let rejectedCount = 0;
  let unknownEventsIgnored = 0;

  const sendSection = async (connection, section) => {
    const outcome = await connection.sendEnvelope(section);
    rttSamples.push(outcome.rttMs);
    if (outcome.result === "accepted") {
      acceptedCount += 1;
    } else {
      rejectedCount += 1;
    }
    return outcome;
  };

  try {
    const connection = await connect(url, contract);
    unknownEventsIgnored += connection.consumeUnknownEventCount();

    // ① 表情ピーク: head-vertical が数百 ms かけて滑らかに立ち上がり・保持・減衰する。
    await sendSection(connection, sections[0]);
    await delay(PERCEPTUAL_EXPRESSION_HOLD_MS);

    // ② 重ねがけ: 同一 head-vertical へ符号反転 re-attack（現在の実効値からの連続な立ち上がり）。
    await sendSection(connection, sections[1]);
    await delay(PERCEPTUAL_REATTACK_HOLD_MS);

    // ③ body 持続駆動: body-x を長い sustain で駆動（切断時にまだ生きている）。
    await sendSection(connection, sections[2]);
    await delay(PERCEPTUAL_BODY_OBSERVE_MS);

    // ④ 意図的 kill: body-x が sustain 中に切断 → release を観測させる（人間ゲート 目玉④）。
    unknownEventsIgnored += connection.consumeUnknownEventCount();
    await connection.close();
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
  }

  const rtt = summarizeRtt(rttSamples);
  const report = {
    kind: "reference-driver-report",
    version: 1,
    scenario: "perceptual",
    url: redactToken(url),
    intentCount: rttSamples.length,
    acceptedCount,
    rejectedCount,
    reconnected: false,
    unknownEventsIgnored,
    contractSource: contract.source,
    rttMs: rtt,
    gate: { p95BudgetMs: 100, p95WithinBudget: rtt.p95 < 100 }
  };
  process.stdout.write(`${JSON.stringify(report)}\n`);
  process.stderr.write(
    `reference-driver[perceptual]: ${report.intentCount} envelopes ` +
      `(${acceptedCount} accepted, ${rejectedCount} rejected), ` +
      `intentional kill mid body-x sustain — 人間ゲート再実施用\n`
  );

  if (rejectedCount > 0) {
    process.exit(1);
    return;
  }
  process.exit(0);
}

/**
 * 発話シナリオ（--scenario=speech, C6）: fixture モーラ列を一発 intent.speech で送り、器の口に
 * 「これじっさいのところどうなってるの」と喋らせる（音は無い・口だけ）。RTT は sendSpeech の
 * replyTo 相関で計測。intent.speech の payload は slotId を持たない（母音ラベル→固定口グループ）
 * ため、語彙自己照合は N/A（kind 照合は connect() の hello 側で済む）。受理されたらシナリオ完遂
 * = exit 0、想定外拒否 = exit 1。
 */
async function runSpeechScenario(url, contract) {
  const timeline = speechTimelineMoras();
  const rttSamples = [];
  let acceptedCount = 0;
  let rejectedCount = 0;
  let unknownEventsIgnored = 0;

  try {
    const connection = await connect(url, contract);
    unknownEventsIgnored += connection.consumeUnknownEventCount();

    // 一発話 = 一タイムライン。器の口グループ評価器が 60Hz でモーラ列を再生する。
    const outcome = await connection.sendSpeech(timeline);
    rttSamples.push(outcome.rttMs);
    if (outcome.result === "accepted") {
      acceptedCount += 1;
    } else {
      rejectedCount += 1;
    }

    // 発話が最後まで喋り終わる尺だけ観測してから切断（終端 release で口が閉じる）。
    const speechSpanMs = timeline[timeline.length - 1]?.timeMs ?? 0;
    await delay(speechSpanMs + 600);
    unknownEventsIgnored += connection.consumeUnknownEventCount();
    await connection.close();
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
  }

  const rtt = summarizeRtt(rttSamples);
  const report = {
    kind: "reference-driver-report",
    version: 1,
    scenario: "speech",
    url: redactToken(url),
    intentCount: rttSamples.length,
    acceptedCount,
    rejectedCount,
    reconnected: false,
    unknownEventsIgnored,
    contractSource: contract.source,
    moraCount: timeline.length,
    rttMs: rtt,
    gate: { p95BudgetMs: 100, p95WithinBudget: rtt.p95 < 100 }
  };
  process.stdout.write(`${JSON.stringify(report)}\n`);
  process.stderr.write(
    `reference-driver[speech]: 1 speech intent (${timeline.length} moras) ` +
      `(${acceptedCount} accepted, ${rejectedCount} rejected) — ` +
      `「これじっさいのところどうなってるの」\n`
  );

  if (rejectedCount > 0) {
    process.exit(1);
    return;
  }
  process.exit(0);
}

/**
 * 契約 JSON（器側の payload schema / exchange examples）を読む。魂は契約=fixture の
 * 「読むだけ」が許される（憲章 §6.2）。読めない環境ではフォールバック語彙を使う。
 */
function loadContract() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  // apps/soul/reference-driver → apps/runtime-player/src/main/control-channel/contract
  const contractDir = path.resolve(
    here,
    "../../runtime-player/src/main/control-channel/contract"
  );
  try {
    const payloadSchema = JSON.parse(
      readFileSync(path.join(contractDir, "channel-intent-set-payload-schema.json"), "utf8")
    );
    const examples = JSON.parse(
      readFileSync(path.join(contractDir, "channel-exchange-examples.json"), "utf8")
    );
    const slotIds = new Set(payloadSchema?.properties?.slotId?.enum ?? []);
    const helloExample = examples?.happyPath?.messages?.find(
      (message) => message?.message?.kind === "server.hello"
    );
    const expectedKinds =
      helloExample?.message?.payload?.supportedKinds ?? [
        "intent.set",
        "intent.envelope",
        "intent.speech"
      ];
    if (slotIds.size === 0) {
      throw new Error("contract payload schema had no slotId enum");
    }
    return { source: "contract-json", slotIds, expectedKinds };
  } catch (error) {
    process.stderr.write(
      `reference-driver: contract JSON not read (${
        error instanceof Error ? error.message : String(error)
      }); using built-in fallback vocabulary\n`
    );
    return {
      source: "fallback",
      slotIds: new Set(FALLBACK_SLOT_IDS),
      expectedKinds: ["intent.set", "intent.envelope", "intent.speech"]
    };
  }
}

/**
 * 1 本の接続を張り、server.hello を受け取って capabilities を確認する。返り値は
 * intent 送信 / 切断 / 未知イベント計数のハンドルを持つ connection オブジェクト。
 */
async function connect(url, contract) {
  const socket = new WebSocket(url);
  const pending = new Map(); // id -> { resolve, reject, t0 }
  let helloPayload = null;
  let helloResolve;
  let helloReject;
  const helloPromise = new Promise((resolve, reject) => {
    helloResolve = resolve;
    helloReject = reject;
  });
  let unknownEventCount = 0;
  let idCounter = 0;

  socket.addEventListener("message", (event) => {
    let message;
    try {
      message = JSON.parse(String(event.data));
    } catch {
      // 非 JSON = 未知イベント → 黙殺（寛容規則 §3.5）。
      unknownEventCount += 1;
      return;
    }

    if (message && message.kind === "server.hello") {
      helloPayload = message.payload ?? null;
      helloResolve();
      return;
    }

    if (message && typeof message.replyTo === "string") {
      const waiter = pending.get(message.replyTo);
      if (waiter === undefined) {
        // 相関先が無い応答 = 未知イベント扱いで黙殺。
        unknownEventCount += 1;
        return;
      }
      pending.delete(message.replyTo);
      waiter.resolve({
        result: message.result,
        error: message.error ?? null,
        rttMs: performance.now() - waiter.t0
      });
      return;
    }

    // それ以外の未知 kind のサーバイベントは無視する義務（クライアント側の寛容規則 §3.5）。
    unknownEventCount += 1;
  });

  const closedError = new Error("Control Channel socket closed unexpectedly.");
  socket.addEventListener("close", () => {
    helloReject(closedError);
    for (const waiter of pending.values()) {
      waiter.reject(closedError);
    }
    pending.clear();
  });
  socket.addEventListener("error", () => {
    const error = new Error("Control Channel socket error.");
    helloReject(error);
  });

  await withTimeout(waitForOpen(socket), HELLO_TIMEOUT_MS, "socket open");
  await withTimeout(helloPromise, HELLO_TIMEOUT_MS, "server.hello");

  // capabilities 照合: 契約の supportedKinds を hello が満たすか。
  const supported = new Set(helloPayload?.supportedKinds ?? []);
  const missing = contract.expectedKinds.filter((kind) => !supported.has(kind));
  if (missing.length > 0) {
    throw new Error(
      `server.hello is missing expected supportedKinds: ${missing.join(", ")}`
    );
  }

  return {
    sendIntent(intent) {
      const id = `req-${(idCounter += 1)}`;
      const payload = { slotId: intent.slotId, value: intent.value };
      if (intent.ttlMs !== undefined) {
        payload.ttlMs = intent.ttlMs;
      }
      const t0 = performance.now();
      const settled = new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject, t0 });
      });
      socket.send(
        JSON.stringify({ v: 1, id, kind: "intent.set", payload })
      );
      return withTimeout(settled, REPLY_TIMEOUT_MS, `reply for ${intent.slotId}`);
    },
    sendEnvelope(intent) {
      // C5 intent.envelope: 魂は意図（ピーク値 + attack/sustain/decay）を一発送り、
      // 器が 60Hz で曲線を描く。RTT 計測は sendIntent と同じ replyTo 相関を流用。
      const id = `req-${(idCounter += 1)}`;
      const payload = {
        slotId: intent.slotId,
        peak: intent.peak,
        attackMs: intent.attackMs,
        sustainMs: intent.sustainMs,
        decayMs: intent.decayMs
      };
      const t0 = performance.now();
      const settled = new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject, t0 });
      });
      socket.send(
        JSON.stringify({ v: 1, id, kind: "intent.envelope", payload })
      );
      return withTimeout(
        settled,
        REPLY_TIMEOUT_MS,
        `envelope reply for ${intent.slotId}`
      );
    },
    sendSpeech(timeline) {
      // C6 intent.speech: 魂はモーラ列（可変長タイムライン）を一発送り、器の口グループ評価器が
      // 60Hz で再生する。payload に slotId は無い（母音ラベル→固定口グループ）。RTT 計測は
      // sendIntent/sendEnvelope と同じ replyTo 相関を流用。
      const id = `req-${(idCounter += 1)}`;
      const payload = { timeline };
      const t0 = performance.now();
      const settled = new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject, t0 });
      });
      socket.send(JSON.stringify({ v: 1, id, kind: "intent.speech", payload }));
      return withTimeout(settled, REPLY_TIMEOUT_MS, "speech reply");
    },
    consumeUnknownEventCount() {
      const count = unknownEventCount;
      unknownEventCount = 0;
      return count;
    },
    async close() {
      if (
        socket.readyState === WebSocket.CLOSED ||
        socket.readyState === WebSocket.CLOSING
      ) {
        return;
      }
      const closed = new Promise((resolve) => {
        socket.addEventListener("close", () => resolve(), { once: true });
      });
      socket.close();
      await withTimeout(closed, REPLY_TIMEOUT_MS, "socket close");
    }
  };
}

function waitForOpen(socket) {
  if (socket.readyState === WebSocket.OPEN) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    socket.addEventListener("open", () => resolve(), { once: true });
    socket.addEventListener(
      "error",
      () => reject(new Error("Control Channel socket failed to open.")),
      { once: true }
    );
  });
}

function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_resolve, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`timed out after ${ms}ms waiting for ${label}`));
    }, ms);
  });
  // Keep the timeout ACTIVE (not unref'd) so a genuine stall surfaces as a
  // descriptive rejection rather than a silent event-loop drain.
  return Promise.race([promise, timeout]).finally(() => {
    clearTimeout(timer);
  });
}

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/** RTT サンプルを p50 / p95（nearest-rank）/ max / mean に要約する。 */
function summarizeRtt(samples) {
  if (samples.length === 0) {
    return { count: 0, p50: 0, p95: 0, max: 0, mean: 0 };
  }
  const sorted = [...samples].sort((a, b) => a - b);
  const nearestRank = (fraction) => {
    const rank = Math.ceil(fraction * sorted.length);
    const index = Math.min(Math.max(rank, 1), sorted.length) - 1;
    return sorted[index];
  };
  const sum = sorted.reduce((total, value) => total + value, 0);
  return {
    count: sorted.length,
    p50: nearestRank(0.5),
    p95: nearestRank(0.95),
    max: sorted[sorted.length - 1],
    mean: sum / sorted.length
  };
}

function redactToken(url) {
  try {
    const parsed = new URL(url);
    if (parsed.searchParams.has("token")) {
      parsed.searchParams.set("token", "<redacted>");
    }
    return parsed.toString();
  } catch {
    return "<unparseable-url>";
  }
}

function readPositiveFloatEnv(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined) {
    return fallback;
  }
  const value = Number.parseFloat(raw);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function fail(message) {
  process.stderr.write(`reference-driver: ${message}\n`);
  process.exit(1);
}

await main();
