// @ts-check
// Discord モード Domain H: 判定と発火の記録の口（discord-mode.md §13.7・計画 §8 Domain H）。本物の cockpit-server（loopback
// の HTTP）に、偽の耳・orchestrator・発火の予定・判定だけをつなぐ。実データ・本物の LLM・外部 API・Discord には触れない。
//  - 発火の要求を断った口（options.onFireRefused）: 場が開いていない間の自発（requestSelfFire の stream-not-open・今どこにも
//    出ない道）・場が開いていない間の手動の Fire（refuseManualFireOutsideStream）・orchestrator が受理しなかった発火
//    （onFire の accepted:false）。同じ断りを 2 度渡さない。きっかけは種類だけ。
//  - つまみの切り替えの口（options.onControl）: 自発・かぶり判定・KILL の前後の真偽。
//  - 判定の失敗の種類（onSpeakNowJudgment の errorKind・errorStatus）。フィード（SSE）の形は変えない。
//  - 口の失敗で発火・つまみ・判定を止めない。
import { test } from "node:test";
import assert from "node:assert/strict";

import { createCockpitServer } from "./cockpit-server.mjs";
import { createTranscriptBuffer } from "../ears/transcript-buffer.mjs";
import { SpeakNowJudgeError } from "../mind/speak-now-decisions.mjs";
import { MODEL_IDENTITIES } from "../mind/model-identity.mjs";

/** @param {string} url @param {string} path @param {unknown} [body] */
async function send(url, path, body = {}) {
  const r = await fetch(`${url}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  return { status: r.status, json: /** @type {any} */ (await r.json()) };
}

/** @param {string} url */
async function state(url) {
  return /** @type {any} */ (await (await fetch(`${url}/api/state`)).json());
}

const tick = (ms = 10) => new Promise((r) => setTimeout(r, ms));

/** @param {() => boolean} pred */
async function waitUntil(pred, timeoutMs = 2000) {
  const start = Date.now();
  while (!pred()) {
    if (Date.now() - start > timeoutMs) throw new Error("waitUntil timed out");
    await tick(5);
  }
}

/** 偽の耳（転写の正本は場が渡す本物の transcript-buffer・onTranscript を返す）。 */
function makeEars() {
  const record = { /** @type {any} */ options: null };
  const factory = (/** @type {any} */ options) => {
    record.options = options;
    const buffer = options?.transcriptBuffer ?? createTranscriptBuffer({ nowImpl: () => 1000 });
    return {
      transcriptBuffer: buffer,
      async start() {},
      async dispose() {},
      isDisposed: () => false,
      streamMs: () => 0,
      stats: () => ({})
    };
  };
  /** 配信者の 1 行を正本に積んで、耳の口（onTranscript）へ流す。 @param {string} text */
  const hear = (text) => {
    const r = record.options.transcriptBuffer.append({ startMs: 0, endMs: 900, text });
    record.options.onTranscript?.(r.entry, { latencyMs: 10, audioCtx: null });
  };
  return { factory, record, hear };
}

/**
 * 偽の orchestrator（hooks を捕まえる）。nextRefusal を入れておくと、次の fire() で本物と同じく
 * hooks.onFire({ accepted:false, reason, cause }) を流して受理しない。
 */
function makeOrchestrator() {
  const record = { /** @type {any} */ hooks: null, /** @type {any[]} */ fires: [], /** @type {string | null} */ nextRefusal: null };
  const factory = (/** @type {any} */ hooks) => {
    record.hooks = hooks;
    return {
      async fire(/** @type {any} */ options) {
        record.fires.push(options);
        if (record.nextRefusal) {
          const reason = record.nextRefusal;
          record.nextRefusal = null;
          hooks.onFire?.({ accepted: false, reason, ...(options?.cause ? { cause: options.cause } : {}) });
          return { fired: false, reason };
        }
        return { fired: true };
      },
      getState: () => "idle",
      async kill() {
        return { killed: true, severed: false };
      },
      revive() {},
      getKilled: () => false,
      async interrupt() {
        return { interrupted: true };
      },
      dispose() {}
    };
  };
  return { factory, record };
}

/** 発火の予定の偽物（onFireRequest を捕まえる・自発の ON/OFF だけ持つ）。 */
function makeSchedulerCapture() {
  /** @type {any} */
  const record = { onFireRequest: null };
  const factory = (/** @type {any} */ opts) => {
    record.onFireRequest = opts.onFireRequest;
    let enabled = opts.enabled === true;
    return {
      handleVadEvent() {},
      handleTranscript() {},
      handleChatMessage() {},
      setEnabled: (/** @type {boolean} */ v) => {
        enabled = v === true;
      },
      isEnabled: () => enabled,
      setVerbosity() {},
      getVerbosity: () => "normal",
      setSpeakNowMode() {},
      silenceBudgetRemaining: () => 0,
      commentBudgetRemaining: () => 0,
      dispose() {}
    };
  };
  return { factory, record };
}

/** @param {object} [extra] */
async function startServer(extra = {}) {
  const ears = makeEars();
  const orchestrator = makeOrchestrator();
  const scheduler = makeSchedulerCapture();
  /** @type {any[]} */
  const refused = [];
  /** @type {any[]} */
  const controls = [];
  /** @type {any[]} */
  const judgments = [];
  const server = createCockpitServer({
    pipelineFactory: /** @type {any} */ (ears.factory),
    fireOrchestratorFactory: /** @type {any} */ (orchestrator.factory),
    fireSchedulerFactory: /** @type {any} */ (scheduler.factory),
    commentGuard: () => ({ pass: true, kind: "ok" }),
    currentRoleIdentity: () => MODEL_IDENTITIES.chappy,
    selfFireInitialEnabled: true,
    onFireRefused: (/** @type {any} */ info) => refused.push(info),
    onControl: (/** @type {any} */ info) => controls.push(info),
    onSpeakNowJudgment: (/** @type {any} */ info) => judgments.push(info),
    ...extra
  });
  const url = await server.listen(0);
  return { server, url, ears, orchestrator, scheduler, refused, controls, judgments };
}

// ── 1. 場が開いていない間の自発の発火（requestSelfFire の stream-not-open）────────────────────────────

test("Domain H 発火の断り: 場が開いていない間の自発の発火は onFireRefused に stream-not-open で渡る（頭には流さない・フィードにも出さない）・開いている間は渡らない", async () => {
  /** @type {(v?: unknown) => void} */
  let releaseSession = () => {};
  const h = await startServer({
    streamHooks: {
      openSession: () =>
        new Promise((r) => {
          releaseSession = r;
        })
    }
  });
  try {
    // 閉じている間。
    h.scheduler.record.onFireRequest({ kind: "interjection" });
    h.scheduler.record.onFireRequest({ kind: "silence" });
    await tick(20);
    assert.deepEqual(h.refused, [
      { cause: "interjection", reason: "stream-not-open", vision: false },
      { cause: "silence", reason: "stream-not-open", vision: true }
    ]);
    assert.equal(h.orchestrator.record.fires.length, 0, "頭には流さない（今のふるまいのまま）");
    // 開きかけ（頭のセッションの準備で止めている）。
    const starting = send(h.url, "/api/stream/start", { device: "Mic" });
    await waitUntil(() => h.server.streamStatus().phase === "opening" && h.scheduler.record.onFireRequest != null);
    h.scheduler.record.onFireRequest({ kind: "turn-end" });
    await tick(20);
    assert.deepEqual(h.refused.at(-1), { cause: "turn-end", reason: "stream-not-open", vision: false });
    releaseSession();
    assert.equal((await starting).json.stream.phase, "open");
    // 開いている間は通す（断りの口は呼ばない）。
    const before = h.refused.length;
    h.scheduler.record.onFireRequest({ kind: "interjection" });
    await waitUntil(() => h.orchestrator.record.fires.length === 1);
    assert.equal(h.refused.length, before);
  } finally {
    await h.server.close();
  }
});

// ── 2. 場が開いていない間の手動の Fire（refuseManualFireOutsideStream）───────────────────────────────

test("Domain H 発火の断り: 場が開いていない間の手動の Fire・Fire+視覚は onFireRefused に manual・stream-not-open で 1 回ずつ（409 は今のまま）", async () => {
  const h = await startServer();
  try {
    const fire = await send(h.url, "/api/fire");
    const vision = await send(h.url, "/api/vision-fire");
    assert.equal(fire.status, 409);
    assert.equal(vision.status, 409);
    assert.equal(fire.json.reason, "stream-not-open");
    assert.deepEqual(h.refused, [
      { cause: "manual", reason: "stream-not-open", vision: false },
      { cause: "manual", reason: "stream-not-open", vision: true }
    ]);
    await send(h.url, "/api/stream/start", { device: "Mic" });
    assert.equal((await send(h.url, "/api/fire")).status, 202);
    assert.equal(h.refused.length, 2, "受理した発火は断りに数えない");
  } finally {
    await h.server.close();
  }
});

// ── 3. orchestrator が受理しなかった発火（onFire の accepted:false）──────────────────────────────────

test("Domain H 発火の断り: orchestrator が受理しなかった発火（busy・killed など）は onFireRefused に 1 回だけ・きっかけは種類だけ（コメントの id は渡さない）", async () => {
  const h = await startServer();
  try {
    await send(h.url, "/api/stream/start", { device: "Mic" });
    h.orchestrator.record.nextRefusal = "busy";
    const r = await send(h.url, "/api/vision-fire");
    assert.equal(r.status, 200);
    assert.equal(r.json.reason, "busy");
    assert.deepEqual(h.refused, [{ cause: "manual", reason: "busy", vision: true }]);
    // 自発の道で受理しなかった（KILL 中など）: requestSelfFire の断りと orchestrator の断りを 2 重にしない。
    h.orchestrator.record.nextRefusal = "killed";
    h.scheduler.record.onFireRequest({ kind: "comment" });
    await waitUntil(() => h.refused.length === 2);
    await tick(20);
    assert.deepEqual(h.refused[1], { cause: "comment", reason: "killed", vision: false });
    assert.equal(h.refused.length, 2, "同じ断りを 2 度渡さない");
    // きっかけのほかの欄（コメントの id など）は渡さない。
    h.orchestrator.record.hooks.onFire({ accepted: false, reason: "empty-window", cause: { type: "comment-react", commentIds: ["yt-123"], commentSeqs: [4] } });
    assert.deepEqual(h.refused[2], { cause: "comment-react", reason: "empty-window", vision: false });
    assert.equal(JSON.stringify(h.refused).includes("yt-123"), false);
    // 受理の知らせは断りに数えない。
    h.orchestrator.record.hooks.onFire({ accepted: true, fireId: 9, cause: { type: "manual" } });
    assert.equal(h.refused.length, 3);
  } finally {
    await h.server.close();
  }
});

// ── 4. つまみの切り替え（onControl）──────────────────────────────────────────────────────

test("Domain H つまみ: 自発・かぶり判定・KILL の切り替えは onControl に前後の真偽で渡る（API の返事・snapshot は今のまま）", async () => {
  const h = await startServer({ bargeInInitialEnabled: false });
  try {
    const s0 = await state(h.url);
    assert.deepEqual(s0.selfFire, { enabled: true });
    assert.deepEqual(s0.bargeIn, { enabled: false });
    assert.equal((await send(h.url, "/api/self-fire", { enabled: false })).json.selfFire.enabled, false);
    assert.equal((await send(h.url, "/api/barge-in", { enabled: true })).json.bargeIn.enabled, true);
    assert.equal((await send(h.url, "/api/kill", { killed: true })).status, 200);
    assert.equal((await send(h.url, "/api/kill", { killed: false })).status, 200);
    assert.deepEqual(h.controls, [
      { control: "self-fire", from: true, to: false },
      { control: "barge-in", from: false, to: true },
      { control: "kill", from: false, to: true },
      { control: "kill", from: true, to: false }
    ]);
    // 受け付けなかった操作（形が違う）は渡さない。
    assert.equal((await send(h.url, "/api/kill", { killed: "yes" })).status, 400);
    assert.equal(h.controls.length, 4);
  } finally {
    await h.server.close();
  }
});

// ── 5. 口の失敗で止めない ────────────────────────────────────────────────────────

test("Domain H 失敗寛容: onFireRefused・onControl が throw しても、断り（409）・発火・つまみの操作は今のまま動く", async () => {
  const boom = () => {
    throw new Error("record failed (fake)");
  };
  const h = await startServer({ onFireRefused: boom, onControl: boom });
  try {
    assert.equal((await send(h.url, "/api/fire")).status, 409);
    h.scheduler.record.onFireRequest({ kind: "interjection" });
    await tick(20);
    assert.equal((await send(h.url, "/api/self-fire", { enabled: false })).json.selfFire.enabled, false);
    assert.equal((await send(h.url, "/api/kill", { killed: true })).json.killed, true);
    await send(h.url, "/api/kill", { killed: false });
    await send(h.url, "/api/stream/start", { device: "Mic" });
    h.orchestrator.record.nextRefusal = "busy";
    assert.equal((await send(h.url, "/api/fire")).json.reason, "busy");
    assert.equal((await send(h.url, "/api/fire")).status, 202);
  } finally {
    await h.server.close();
  }
});

// ── 6. 判定の失敗の種類（onSpeakNowJudgment）────────────────────────────────────────────

test("Domain H 判定の記録: 判定の失敗が種類を持てば onSpeakNowJudgment に errorKind・errorStatus が載る・成功の行は今の形のまま", async () => {
  /** @type {Array<{ resolve: (r: any) => void; reject: (e: any) => void }>} */
  const calls = [];
  const h = await startServer({
    speakStartModeInitial: "speak-now",
    nowImpl: () => 1000,
    speakNowJudge: () =>
      new Promise((resolve, reject) => {
        calls.push({ resolve, reject });
      })
  });
  try {
    await send(h.url, "/api/stream/start", { device: "Mic" });
    h.ears.hear("一言目");
    await waitUntil(() => calls.length === 1);
    calls[0].reject(new SpeakNowJudgeError("HTTP 429: quota [credit_balance_exhausted]", 640, { kind: "http", status: 429 }));
    await waitUntil(() => h.judgments.length === 1);
    assert.deepEqual(h.judgments[0], {
      ok: false,
      trigger: "transcript",
      error: "HTTP 429: quota [credit_balance_exhausted]",
      latencyMs: 640,
      errorKind: "http",
      errorStatus: 429
    });
    h.ears.hear("二言目");
    await waitUntil(() => calls.length === 2);
    calls[1].resolve({ choice: "respond", probs: { respond: 0.8, wait: 0.2 }, latencyMs: 700 });
    await waitUntil(() => h.judgments.length === 2);
    assert.equal(h.judgments[1].ok, true);
    assert.equal(h.judgments[1].action, "fire");
    assert.equal("errorKind" in h.judgments[1], false, "成功の行に種類は足さない");
  } finally {
    await h.server.close();
  }
});
