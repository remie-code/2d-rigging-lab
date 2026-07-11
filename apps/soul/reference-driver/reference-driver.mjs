// @ts-nocheck
/**
 * Reference driver — 特区 apps/soul の最初の住人（C4 Domain D, 設計 §7）。
 *
 * LLM・知覚を持たない疑似魂。決定論的なシナリオ（注視 → 傾げ → 沈黙 → 再開 →
 * 意図的切断 → 再接続）を操縦チャネルへタイムテーブルで流す。役割は ①C4 の持続駆動
 * 機械テストの駆動源 ②契約エルゴノミクス（外部から書く行為そのもの）の検証
 * ③C5 人間ゲートの証人 ④魂側開発への実行可能な手本。
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
 * 使い方:
 *   node apps/soul/reference-driver/reference-driver.mjs "ws://127.0.0.1:<port>/channel?token=<token>"
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
  const url = process.argv[2];
  if (typeof url !== "string" || url.length === 0) {
    process.stderr.write(
      "usage: node reference-driver.mjs <ws-url>\n" +
        '  e.g. node reference-driver.mjs "ws://127.0.0.1:17310/channel?token=..."\n'
    );
    process.exit(2);
    return;
  }

  const contract = loadContract();
  const rttSamples = [];
  const events = [];
  let acceptedCount = 0;
  let rejectedCount = 0;
  let unknownEventsIgnored = 0;

  // シナリオの各インテント: { slotId, value, ttlMs? }。値は契約の正規化域内（accepted
  // される前提）。ttlMs は明示（この頷きは N ms 有効）と省略（既定窓 = ストリーミング様式）
  // の両スタイルを意図的に混ぜる（設計 §4）。
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

  // 送る slotId が契約語彙に収まっていることを自己照合（契約=正の尊重）。
  const scenarioSlotIds = new Set(
    [...gazePhase, ...tiltPhase, ...resumePhase, ...reconnectPhase].map(
      (intent) => intent.slotId
    )
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

    // ── 意図的切断 ───────────────────────────────────────────────────
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
    const expectedKinds = helloExample?.message?.payload?.supportedKinds ?? ["intent.set"];
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
      expectedKinds: ["intent.set"]
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
