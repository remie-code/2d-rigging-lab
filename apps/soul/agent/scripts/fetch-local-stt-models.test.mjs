// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  planLocalSttModelFetch,
  fetchLocalSttModels,
  parseFetchArgs,
  PARAKEET_HF_BASE,
  ZIPFORMER_ARCHIVE_URL
} from "./fetch-local-stt-models.mjs";

// 取得のコマンドの機械テスト。ネットワークには出ない（fetch は偽物・揃っている場合は fetch を呼ばない）。

test("fetch-local-stt-models: 配布元（Hugging Face の Parakeet・GitHub Releases の asr-models の Zipformer）", () => {
  assert.equal(
    PARAKEET_HF_BASE,
    "https://huggingface.co/csukuangfj/sherpa-onnx-nemo-parakeet-tdt_ctc-0.6b-ja-35000-int8/resolve/main"
  );
  assert.equal(
    ZIPFORMER_ARCHIVE_URL,
    "https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-zipformer-ja-reazonspeech-2024-08-01.tar.bz2"
  );
});

test("fetch-local-stt-models: 揃っていれば何もしない（fetch を呼ばない）", async () => {
  assert.deepEqual(planLocalSttModelFetch({ modelsDir: "/m", existsImpl: () => true }), []);
  let fetches = 0;
  const res = await fetchLocalSttModels({
    modelsDir: "/m",
    existsImpl: () => true,
    fetchImpl: /** @type {any} */ (async () => {
      fetches += 1;
      throw new Error("should not fetch");
    }),
    log: () => {}
  });
  assert.deepEqual(res, { fetched: [], skipped: true });
  assert.equal(fetches, 0);
});

test("fetch-local-stt-models: 足りないものだけを計画し、Parakeet は足りないファイルだけ取る", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "fetch-local-stt-"));
  try {
    const pdir = path.join(dir, "parakeet-tdt_ctc-0.6b-ja-int8");
    mkdirSync(pdir, { recursive: true });
    writeFileSync(path.join(pdir, "model.int8.onnx"), "already-here");
    const plan = planLocalSttModelFetch({ modelsDir: dir, only: ["parakeet"] });
    assert.equal(plan.length, 1);
    assert.deepEqual(plan[0].missing.map((m) => m.name), ["tokens.txt"]);

    /** @type {string[]} */
    const urls = [];
    const res = await fetchLocalSttModels({
      modelsDir: dir,
      only: ["parakeet"],
      fetchImpl: /** @type {any} */ (
        async (/** @type {string} */ url) => {
          urls.push(url);
          return new Response("<unk> 0\n", { status: 200 });
        }
      ),
      log: () => {}
    });
    assert.deepEqual(urls, [`${PARAKEET_HF_BASE}/tokens.txt`]);
    assert.equal(res.fetched.length, 1);
    assert.equal(readFileSync(path.join(pdir, "tokens.txt"), "utf8"), "<unk> 0\n");
    assert.equal(readFileSync(path.join(pdir, "model.int8.onnx"), "utf8"), "already-here", "揃っているものは触らない");
    // 2 回目は揃っているので何もしない。
    assert.deepEqual(planLocalSttModelFetch({ modelsDir: dir, only: ["parakeet"] }), []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("fetch-local-stt-models: 取得の失敗は throw（.part のまま・揃った扱いにしない）・--dry-run は取得しない", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "fetch-local-stt-"));
  try {
    await assert.rejects(
      fetchLocalSttModels({
        modelsDir: dir,
        only: ["parakeet"],
        fetchImpl: /** @type {any} */ (async () => new Response("nope", { status: 404, statusText: "Not Found" })),
        log: () => {}
      }),
      /download failed: 404/
    );
    assert.equal(planLocalSttModelFetch({ modelsDir: dir, only: ["parakeet"] })[0].missing.length, 2);
    const dry = await fetchLocalSttModels({
      modelsDir: dir,
      dryRun: true,
      fetchImpl: /** @type {any} */ (async () => {
        throw new Error("should not fetch");
      }),
      log: () => {}
    });
    assert.deepEqual(dry, { fetched: [], skipped: false });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("fetch-local-stt-models: 引数（--only / --models-dir / --dry-run・未知は throw）", () => {
  assert.deepEqual(parseFetchArgs(["--only", "zipformer", "--models-dir", "/x", "--dry-run"]), {
    dryRun: true,
    only: ["zipformer"],
    modelsDir: "/x"
  });
  assert.throws(() => parseFetchArgs(["--only", "whisper"]), /unknown engine/);
  assert.throws(() => parseFetchArgs(["--bogus"]), /unknown argument/);
});
