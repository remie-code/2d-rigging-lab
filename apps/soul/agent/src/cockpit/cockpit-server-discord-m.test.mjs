// @ts-check
/**
 * Discord モード Domain M（gate-3-stale-judgment-chip.md §5）の合図をサーバの側で固定する。
 *
 *  - 画面の「会話」の欄は SSE state の stream.phase "opening" を「新しい場が開いた」の合図にして、前の場の判定の札と推論の
 *    範囲を捨てる（view-logic/glance-timeline.mjs）。その前提は、openStream が正本を作り直す（seq が 0 に戻る）より先に
 *    phase "opening" の state を配ること。ここではその順序を固定する（サーバのソースは変えない）。
 *  - 本物のサーバの SSE を、画面と同じ glanceAfterSseEvent に流して、場の切り替わりが行に乗ることも確かめる。
 * 本物の server・loopback の HTTP・偽の耳 / orchestrator / 発火の予定だけ。実データ・本物の LLM・Bot・外部 API には触れない。
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { createCockpitServer } from "./cockpit-server.mjs";
import { createTranscriptBuffer } from "../ears/transcript-buffer.mjs";
import { MODEL_IDENTITIES } from "../mind/model-identity.mjs";
import { conversationRowsView, emptyGlance, glanceAfterSseEvent } from "./view-logic/glance-timeline.mjs";

const tick = (ms = 10) => new Promise((r) => setTimeout(r, ms));

/** @param {() => boolean} pred @param {number} [timeoutMs] */
async function waitUntil(pred, timeoutMs = 2000) {
  const until = Date.now() + timeoutMs;
  while (!pred()) {
    if (Date.now() > until) throw new Error("waitUntil timed out");
    await tick(5);
  }
}

/** @param {string} url @param {string} path @param {unknown} [body] */
async function post(url, path, body = {}) {
  const r = await fetch(`${url}${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  return { status: r.status, json: /** @type {any} */ (await r.json()) };
}

/** SSE を読む（events に届いた順に積む）。 @param {string} url */
function openEvents(url) {
  /** @type {Array<{ event: string; data: any }>} */
  const events = [];
  const ac = new AbortController();
  (async () => {
    try {
      const r = await fetch(`${url}/api/events`, { signal: ac.signal });
      const reader = /** @type {any} */ (r.body).getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let i;
        while ((i = buf.indexOf("\n\n")) >= 0) {
          const frame = buf.slice(0, i);
          buf = buf.slice(i + 2);
          let event = "message";
          let data = "";
          for (const line of frame.split("\n")) {
            if (line.startsWith("event:")) event = line.slice(6).trim();
            else if (line.startsWith("data:")) data += line.slice(5).trim();
          }
          if (data) events.push({ event, data: JSON.parse(data) });
        }
      }
    } catch {
      // 閉じた。
    }
  })();
  return { events, close: () => ac.abort() };
}

/** 偽の耳（渡された場の正本に積む・本物の耳と同じ口）。 */
function makeEars() {
  const record = { /** @type {any} */ options: null, /** @type {any} */ venue: null };
  const factory = (/** @type {any} */ options) => {
    record.options = options;
    record.venue = options.transcriptBuffer ?? null;
    return {
      transcriptBuffer: record.venue ?? createTranscriptBuffer({ nowImpl: () => 1000 }),
      async start() {},
      async dispose() {},
      isDisposed: () => false,
      streamMs: () => 0,
      stats: () => ({})
    };
  };
  /** 耳ごとの口を真似て 1 行積む。 @param {string} text */
  const say = (text) => {
    const result = record.venue.append({ startMs: 0, endMs: 900, text });
    if (result.appended) record.options.onTranscript(result.entry, { latencyMs: 100, audioCtx: null });
    return result;
  };
  return { factory, record, say };
}

function makeScheduler() {
  return () => ({
    handleVadEvent() {},
    handleTranscript() {},
    handleChatMessage() {},
    setEnabled() {},
    isEnabled: () => true,
    setVerbosity() {},
    getVerbosity: () => "normal",
    silenceBudgetRemaining: () => 0,
    commentBudgetRemaining: () => 0,
    dispose() {}
  });
}

function makeOrchestrator() {
  return () => ({
    async fire() {
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
  });
}

test("Domain M 合図の順序: 開き直すとき、phase \"opening\" の state が新しい場の最初の行（seq 0 に戻った行）より先に配られる", async () => {
  // 2 回目の開く段を声の用意（正本を作ったあとの段）で止め、開きかけの間に新しい正本へ 1 行積む。
  let opens = 0;
  /** @type {(v?: unknown) => void} */
  let release = () => {};
  const ears = makeEars();
  const server = createCockpitServer({
    pipelineFactory: /** @type {any} */ (ears.factory),
    fireOrchestratorFactory: /** @type {any} */ (makeOrchestrator()),
    fireSchedulerFactory: /** @type {any} */ (makeScheduler()),
    commentGuard: () => ({ pass: true, kind: "ok" }),
    currentRoleIdentity: () => MODEL_IDENTITIES.chappy,
    onPrepareVoiceEngine: () => {
      opens += 1;
      if (opens === 1) return { ok: true };
      return new Promise((r) => {
        release = () => r({ ok: true });
      });
    }
  });
  const url = await server.listen(0);
  const sse = openEvents(url);
  try {
    await waitUntil(() => sse.events.some((e) => e.event === "state"));
    assert.equal((await post(url, "/api/stream/start", { device: "Mic" })).status, 200);
    ears.say("1 回目の 0");
    ears.say("1 回目の 1");
    await waitUntil(() => sse.events.some((e) => e.event === "transcript" && e.data.text === "1 回目の 1"));
    await post(url, "/api/stream/stop");

    const starting = post(url, "/api/stream/start", { device: "Mic" });
    await waitUntil(() => server.streamStatus().phase === "opening" && opens === 2);
    // 開きかけの間: 正本はもう新しい（空）。ここで積んだ行は seq 0 から。
    assert.deepEqual(server.getTranscript(), [], "正本は作り直してある");
    server.ingestChatMessage({ text: "開きかけのコメント", displayName: "みけ", messageId: "m-m-1" });
    await waitUntil(() => sse.events.some((e) => e.event === "transcript" && e.data.text === "開きかけのコメント"));
    release();
    assert.equal((await starting).status, 200);
    ears.say("2 回目の発言");
    await waitUntil(() => sse.events.some((e) => e.event === "transcript" && e.data.text === "2 回目の発言"));

    const index = (/** @type {(e: { event: string; data: any }) => boolean} */ pred) => sse.events.findIndex(pred);
    const isState = (/** @type {string} */ phase) => (/** @type {{ event: string; data: any }} */ e) => e.event === "state" && e.data.stream && e.data.stream.phase === phase;
    const lastOldRow = index((e) => e.event === "transcript" && e.data.text === "1 回目の 1");
    const firstClosedAfterStop = sse.events.findIndex((e, i) => i > lastOldRow && isState("closed")(e));
    assert.ok(firstClosedAfterStop > lastOldRow, "1 回目を閉じた state");
    const reopening = sse.events.findIndex((e, i) => i > firstClosedAfterStop && isState("opening")(e));
    const firstNewRow = index((e) => e.event === "transcript" && e.data.text === "開きかけのコメント");
    assert.ok(reopening > 0, "2 回目の opening の state が配られる");
    assert.ok(reopening < firstNewRow, "opening の state は新しい場の最初の行より先");
    assert.equal(sse.events[firstNewRow].data.seq, 0, "新しい場の最初の行は seq 0（数え直し）");
    const second = sse.events.find((e) => e.event === "transcript" && e.data.text === "2 回目の発言");
    assert.equal(second?.data.seq, 1);
    const first = sse.events.find((e) => e.event === "transcript" && e.data.text === "1 回目の 1");
    assert.equal(first?.data.seq, 1, "1 回目の seq 1 と 2 回目の seq 1 は同じ番号（だから同じ場の中だけで結ぶ）");

    // 本物の SSE をそのまま画面の glance に流す: 2 回目の行は新しい場、1 回目の行は前の場。前の場の行に新しい場の札が付かない。
    let g = emptyGlance();
    for (const e of sse.events) g = glanceAfterSseEvent(g, e.event, e.data, 0);
    assert.equal(g.venue, 2, "開き始めた 2 回で 2");
    g = glanceAfterSseEvent(g, "selfFire", { kind: "speak-now-judgment", choice: "respond", probability: 0.8, action: "fire", triggerSeq: 1 }, 0);
    assert.deepEqual(conversationRowsView(g).map((r) => [r.text, r.chipText]), [
      ["1 回目の 0", null],
      ["1 回目の 1", null],
      ["2 回目の発言", "応答 0.80"]
    ]);
    await post(url, "/api/stream/stop");
  } finally {
    sse.close();
    await server.close();
  }
});

test("Domain M 合図: SSE に接続した直後にも state（今の場の状態）が届く（つなぎ直しても最初に場の状態が分かる）", async () => {
  const ears = makeEars();
  const server = createCockpitServer({
    pipelineFactory: /** @type {any} */ (ears.factory),
    fireOrchestratorFactory: /** @type {any} */ (makeOrchestrator()),
    fireSchedulerFactory: /** @type {any} */ (makeScheduler()),
    commentGuard: () => ({ pass: true, kind: "ok" }),
    currentRoleIdentity: () => MODEL_IDENTITIES.chappy
  });
  const url = await server.listen(0);
  try {
    assert.equal((await post(url, "/api/stream/start", { device: "Mic" })).status, 200);
    const opened = server.streamStatus();
    const sse = openEvents(url);
    try {
      await waitUntil(() => sse.events.length > 0);
      assert.equal(sse.events[0].event, "state", "最初の 1 発は state");
      assert.deepEqual(
        { phase: sse.events[0].data.stream.phase, openedAtMs: sse.events[0].data.stream.openedAtMs },
        { phase: "open", openedAtMs: opened.openedAtMs }
      );
    } finally {
      sse.close();
    }
    await post(url, "/api/stream/stop");
  } finally {
    await server.close();
  }
});
