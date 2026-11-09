import { test } from "node:test";
import assert from "node:assert/strict";
import { createHaasSttPool } from "./haas-local-stt.mjs";

function fakeWorkerFactory() {
  const workers = [];
  return {
    workers,
    create(options) {
      const worker = {
        disposed: false,
        exited: false,
        requests: [],
        ready: Promise.resolve({ audioTagging: { enabled: true } }),
        hasExited: () => worker.exited,
        transcribe(wav) {
          if (worker.exited) return Promise.reject(new Error("worker exited"));
          const request = Promise.withResolvers();
          worker.requests.push({ wav, ...request });
          return request.promise;
        },
        fail() {
          worker.exited = true;
          options.onExit({ code: 1, signal: null });
          for (const r of worker.requests) r.reject(new Error("worker exited"));
        },
        dispose() {
          worker.disposed = true;
          for (const r of worker.requests) r.reject(new Error("worker disposed"));
        }
      };
      workers.push(worker);
      return worker;
    }
  };
}

const tick = () => new Promise((resolve) => setImmediate(resolve));

test("Haas: 離脱した耳の処理中・待機中の発話を失効させ、別の耳と再入後の耳へ正しく返す", async () => {
  const { create, workers } = fakeWorkerFactory();
  const acquire = createHaasSttPool(create);
  const a = acquire({});
  const b = acquire({});
  const active = assert.rejects(a.transcribe("old-a-active"), /ear disposed/);
  const queued = assert.rejects(a.transcribe("old-a-queued"), /ear disposed/);
  const pendingB = b.transcribe("b");
  await tick();
  assert.equal(workers.length, 1);
  assert.deepEqual(workers[0].requests.map((r) => r.wav), ["old-a-active"]);
  a.dispose();
  await Promise.all([active, queued]);
  const rejoined = acquire({});
  const pendingA = rejoined.transcribe("new-a");
  workers[0].requests[0].resolve("stale");
  await tick();
  assert.deepEqual(workers[0].requests.map((r) => r.wav), ["old-a-active", "b"]);
  workers[0].requests[1].resolve("text-b");
  assert.equal(await pendingB, "text-b");
  await tick();
  assert.equal(workers[0].requests[2].wav, "new-a");
  workers[0].requests[2].resolve("new-text-a");
  assert.equal(await pendingA, "new-text-a");
  rejoined.dispose();
  assert.equal(workers[0].disposed, false);
  b.dispose();
  assert.equal(workers[0].disposed, true);
  const next = acquire({});
  assert.equal(workers.length, 2);
  next.dispose();
});

test("Haas: 共有ワーカーの異常は全耳に届き、処理中と待機中の両方が失敗する", async () => {
  const { create, workers } = fakeWorkerFactory();
  const acquire = createHaasSttPool(create);
  const deaths = [];
  const a = acquire({ onExit: (info) => deaths.push(["a", info.code]) });
  const b = acquire({ onExit: (info) => deaths.push(["b", info.code]) });
  const one = assert.rejects(a.transcribe("one"), /worker exited/);
  const two = assert.rejects(b.transcribe("two"), /worker exited/);
  await tick();
  workers[0].fail();
  await Promise.all([one, two]);
  assert.deepEqual(deaths, [["a", 1], ["b", 1]]);
  assert.deepEqual(workers[0].requests.map((r) => r.wav), ["one"]);
  const later = acquire({});
  await assert.rejects(later.ready, /not available/);
  later.dispose();
  a.dispose();
  b.dispose();
  assert.equal(workers[0].disposed, true);
});
