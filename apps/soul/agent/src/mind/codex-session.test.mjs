// @ts-check
/**
 * codex-session.test.mjs — fake sdkImpl 注入のみ。実ネット・実 Terra・実 codex CLI・実 ~/.codex を
 * 一切使わない（SDK 消費ゼロ）。rollout 掃除の性質テスト（blocking）は必ずスクラッチ homeDir を
 * 使い、本物の ~/.codex には絶対に触れない。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { createCodexSession } from "./codex-session.mjs";

const SAMPLE_USAGE = Object.freeze({
  input_tokens: 11584,
  cached_input_tokens: 0,
  output_tokens: 14,
  reasoning_output_tokens: 0
});

/**
 * fake Codex SDK コンストラクタを作る。onRun(input, thread) は runStreamed のたびに呼ばれ、
 * ThreadEvent[]（または Promise<ThreadEvent[]>）を返す。
 * @param {{ threadId?: string; onRun: (input: any, thread: any) => Promise<any[]> | any[] }} opts
 */
function makeFakeSdk({ threadId = "fake-thread-0001", onRun }) {
  /** @type {any[]} */
  const capturedInputs = [];
  /** @type {any} */
  let lastConstructedOptions = null;
  /** @type {any} */
  let lastThreadOptions = null;

  class FakeThread {
    constructor(threadOptions) {
      lastThreadOptions = threadOptions;
      this._id = null;
    }
    get id() {
      return this._id;
    }
    async runStreamed(input) {
      capturedInputs.push(input);
      this._id = threadId; // 型定義どおり「初回 turn 開始後に populated」を模す。
      const events = await onRun(input, this);
      async function* gen() {
        for (const ev of events) yield ev;
      }
      return { events: gen() };
    }
  }

  class FakeCodex {
    constructor(options) {
      lastConstructedOptions = options;
    }
    startThread(threadOptions) {
      return new FakeThread(threadOptions);
    }
  }

  return {
    FakeCodex,
    capturedInputs,
    getLastConstructedOptions: () => lastConstructedOptions,
    getLastThreadOptions: () => lastThreadOptions
  };
}

/** 成功イベント列（agent_message 完成一括 + turn.completed）。 */
function successEvents(replyText, usage = SAMPLE_USAGE) {
  return [
    { type: "thread.started", thread_id: "fake-thread-0001" },
    { type: "turn.started" },
    { type: "item.completed", item: { id: "1", type: "agent_message", text: replyText } },
    { type: "turn.completed", usage }
  ];
}

/** turn.failed イベント列。 */
function failedEvents(message) {
  return [
    { type: "thread.started", thread_id: "fake-thread-0001" },
    { type: "turn.started" },
    { type: "turn.failed", error: { message } }
  ];
}

/** テスト専用のスクラッチ homeDir + ledgerPath を作り、finally で必ず削除する。 */
async function withScratchHome(fn) {
  const homeDir = mkdtempSync(path.join(os.tmpdir(), "codex-session-test-home-"));
  const ledgerPath = path.join(homeDir, "codex-rollouts.local.json");
  try {
    await fn({ homeDir, ledgerPath });
  } finally {
    rmSync(homeDir, { recursive: true, force: true });
  }
}

/** rollout ファイル名（実観測フォーマット・brain-swap-terra.md §3-4）。 */
function rolloutFileName(threadId, isoLike = "2026-07-17T08-32-30") {
  return `rollout-${isoLike}-${threadId}.jsonl`;
}

/** homeDir/.codex/sessions/<y>/<m>/<d>/ 配下にダミー rollout を書く。 */
function writeRolloutFile(homeDir, [y, m, d], fileName) {
  const dir = path.join(homeDir, ".codex", "sessions", y, m, d);
  mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, fileName);
  writeFileSync(filePath, '{"note":"dummy rollout — テストは中身を読まない"}\n', "utf8");
  return filePath;
}

// ── ask(string): turn1 systemPrompt 前置 / turn2 以降そのまま ──────────────────

test("codex-session: ask(string) は turn1 で systemPrompt を前置し、turn2 以降はそのまま渡す", async () => {
  await withScratchHome(async ({ homeDir, ledgerPath }) => {
    const { FakeCodex, capturedInputs } = makeFakeSdk({
      onRun: () => successEvents("応答1号")
    });
    const session = createCodexSession({
      systemPrompt: "SYSTEM_PROMPT_X",
      sdkImpl: FakeCodex,
      skipEnvGuard: true,
      homeDir,
      ledgerPath
    });

    await session.ask("こんばんは");
    await session.ask("2発目の一言");

    assert.equal(capturedInputs[0], "SYSTEM_PROMPT_X\n\nこんばんは");
    assert.equal(capturedInputs[1], "2発目の一言");

    await session.dispose();
  });
});

// ── content ブロック配列: text→text / image(base64)→local_image ───────────────

test("codex-session: content ブロック配列は text→text・image(base64)→local_image に変換される（turn1 は systemPrompt 前置）", async () => {
  await withScratchHome(async ({ homeDir, ledgerPath }) => {
    const { FakeCodex, capturedInputs } = makeFakeSdk({
      onRun: () => successEvents("画像も見えてるよ")
    });
    const session = createCodexSession({
      systemPrompt: "SYS",
      sdkImpl: FakeCodex,
      skipEnvGuard: true,
      homeDir,
      ledgerPath
    });

    const base64Data = Buffer.from("fake-jpeg-bytes").toString("base64");
    await session.ask([
      { type: "image", source: { type: "base64", data: base64Data, media_type: "image/jpeg" } },
      { type: "text", text: "これは何？" }
    ]);

    const input = capturedInputs[0];
    assert.ok(Array.isArray(input));
    assert.deepEqual(input[0], { type: "text", text: "SYS" });
    assert.equal(input[1].type, "local_image");
    assert.equal(typeof input[1].path, "string");
    assert.ok(input[1].path.endsWith(".jpg"));
    assert.deepEqual(input[2], { type: "text", text: "これは何？" });

    await session.dispose();
  });
});

// ── 画像一時ファイル: run 中は存在し ask 後は消えている ─────────────────────────

test("codex-session: 画像の一時ファイルは run 中に存在し、ask 完了後には削除されている", async () => {
  await withScratchHome(async ({ homeDir, ledgerPath }) => {
    /** @type {string | null} */
    let capturedPath = null;
    let existedDuringRun = false;
    const { FakeCodex } = makeFakeSdk({
      onRun: (input) => {
        const imgBlock = input.find((b) => b.type === "local_image");
        capturedPath = imgBlock.path;
        existedDuringRun = existsSync(capturedPath);
        return successEvents("見た");
      }
    });
    const session = createCodexSession({ sdkImpl: FakeCodex, skipEnvGuard: true, homeDir, ledgerPath });

    const base64Data = Buffer.from("x").toString("base64");
    await session.ask([{ type: "image", source: { type: "base64", data: base64Data, media_type: "image/jpeg" } }]);

    assert.equal(existedDuringRun, true, "run 中は一時ファイルが存在するはず");
    assert.ok(capturedPath);
    assert.equal(existsSync(/** @type {string} */ (capturedPath)), false, "ask 後は一時ファイルが消えているはず");

    await session.dispose();
  });
});

test("codex-session: turn.failed でも画像の一時ファイルは finally で削除される", async () => {
  await withScratchHome(async ({ homeDir, ledgerPath }) => {
    /** @type {string | null} */
    let capturedPath = null;
    const { FakeCodex } = makeFakeSdk({
      onRun: (input) => {
        const imgBlock = input.find((b) => b.type === "local_image");
        capturedPath = imgBlock.path;
        return failedEvents("模擬失敗（画像あり）");
      }
    });
    const session = createCodexSession({ sdkImpl: FakeCodex, skipEnvGuard: true, homeDir, ledgerPath });

    const base64Data = Buffer.from("x").toString("base64");
    await assert.rejects(() =>
      session.ask([{ type: "image", source: { type: "base64", data: base64Data, media_type: "image/jpeg" } }])
    );

    assert.ok(capturedPath);
    assert.equal(existsSync(/** @type {string} */ (capturedPath)), false);

    await session.dispose();
  });
});

// ── usage 透過 / ttftMs:null / elapsedMs>0 ────────────────────────────────────

test("codex-session: ask の戻り値は usage 透過・ttftMs:null・elapsedMs>0", async () => {
  await withScratchHome(async ({ homeDir, ledgerPath }) => {
    const { FakeCodex } = makeFakeSdk({
      onRun: async () => {
        await new Promise((resolve) => setTimeout(resolve, 2)); // elapsedMs>0 を確実にする。
        return successEvents("応答文", SAMPLE_USAGE);
      }
    });
    const session = createCodexSession({ sdkImpl: FakeCodex, skipEnvGuard: true, homeDir, ledgerPath });

    const result = await session.ask("こんにちは");

    assert.equal(result.replyText, "応答文");
    assert.deepEqual(result.usage, SAMPLE_USAGE);
    assert.equal(result.ttftMs, null);
    assert.ok(result.elapsedMs > 0, `elapsedMs=${result.elapsedMs}`);

    await session.dispose();
  });
});

// ── turn.failed → throw（空応答を黙って返さない） ─────────────────────────────

test("codex-session: turn.failed イベントは ask() を throw させる", async () => {
  await withScratchHome(async ({ homeDir, ledgerPath }) => {
    const { FakeCodex } = makeFakeSdk({ onRun: () => failedEvents("模擬失敗メッセージ") });
    const session = createCodexSession({ sdkImpl: FakeCodex, skipEnvGuard: true, homeDir, ledgerPath });

    await assert.rejects(() => session.ask("こんにちは"), /模擬失敗メッセージ/);

    await session.dispose();
  });
});

test("codex-session: error イベントも ask() を throw させる", async () => {
  await withScratchHome(async ({ homeDir, ledgerPath }) => {
    const { FakeCodex } = makeFakeSdk({
      onRun: () => [
        { type: "thread.started", thread_id: "fake-thread-0001" },
        { type: "turn.started" },
        { type: "error", message: "stream レベルの致命的エラー" }
      ]
    });
    const session = createCodexSession({ sdkImpl: FakeCodex, skipEnvGuard: true, homeDir, ledgerPath });

    await assert.rejects(() => session.ask("こんにちは"), /stream レベルの致命的エラー/);

    await session.dispose();
  });
});

// ── env-guard 発火 ────────────────────────────────────────────────────────────

test("codex-session: env-guard は OPENAI_API_KEY 設定時に起動を拒否する", async () => {
  await withScratchHome(async ({ homeDir, ledgerPath }) => {
    const { FakeCodex } = makeFakeSdk({ onRun: () => successEvents("到達しないはず") });
    assert.throws(
      () =>
        createCodexSession({
          env: { OPENAI_API_KEY: "sk-xxx" },
          sdkImpl: FakeCodex,
          homeDir,
          ledgerPath
        }),
      /OPENAI_API_KEY/
    );
  });
});

test("codex-session: env-guard は CODEX_API_KEY 設定時にも起動を拒否する", async () => {
  await withScratchHome(async ({ homeDir, ledgerPath }) => {
    const { FakeCodex } = makeFakeSdk({ onRun: () => successEvents("到達しないはず") });
    assert.throws(
      () =>
        createCodexSession({
          env: { CODEX_API_KEY: "tok" },
          sdkImpl: FakeCodex,
          homeDir,
          ledgerPath
        }),
      /CODEX_API_KEY/
    );
  });
});

test("codex-session: skipEnvGuard:true なら OPENAI_API_KEY 設定でも起動できる（テスト専用）", async () => {
  await withScratchHome(async ({ homeDir, ledgerPath }) => {
    const { FakeCodex } = makeFakeSdk({ onRun: () => successEvents("ok") });
    const session = createCodexSession({
      env: { OPENAI_API_KEY: "sk-xxx" },
      sdkImpl: FakeCodex,
      skipEnvGuard: true,
      homeDir,
      ledgerPath
    });
    const result = await session.ask("hi");
    assert.equal(result.replyText, "ok");
    await session.dispose();
  });
});

// ── dispose 冪等 ──────────────────────────────────────────────────────────────

test("codex-session: dispose は冪等（2 回呼んでもエラーにならない）", async () => {
  await withScratchHome(async ({ homeDir, ledgerPath }) => {
    const { FakeCodex } = makeFakeSdk({ onRun: () => successEvents("ok") });
    const session = createCodexSession({ sdkImpl: FakeCodex, skipEnvGuard: true, homeDir, ledgerPath });
    await session.ask("hi");
    await session.dispose();
    await session.dispose(); // 2 回目も throw しない。
  });
});

test("codex-session: dispose 後の ask は throw する", async () => {
  await withScratchHome(async ({ homeDir, ledgerPath }) => {
    const { FakeCodex } = makeFakeSdk({ onRun: () => successEvents("ok") });
    const session = createCodexSession({ sdkImpl: FakeCodex, skipEnvGuard: true, homeDir, ledgerPath });
    await session.dispose();
    await assert.rejects(() => session.ask("もう一言"), /disposed/);
  });
});

// ── ask 受理型（llm-session と同型の検証） ─────────────────────────────────────

test("codex-session: ask('') / ask([]) は TypeError", async () => {
  await withScratchHome(async ({ homeDir, ledgerPath }) => {
    const { FakeCodex } = makeFakeSdk({ onRun: () => successEvents("ok") });
    const session = createCodexSession({ sdkImpl: FakeCodex, skipEnvGuard: true, homeDir, ledgerPath });
    await assert.rejects(() => session.ask(""), TypeError);
    await assert.rejects(() => session.ask([]), TypeError);
    await session.dispose();
  });
});

// ── threadIds 公開 ────────────────────────────────────────────────────────────

test("codex-session: threadIds は初回 turn 後に thread.id を公開する", async () => {
  await withScratchHome(async ({ homeDir, ledgerPath }) => {
    const { FakeCodex } = makeFakeSdk({ threadId: "observed-thread-777", onRun: () => successEvents("ok") });
    const session = createCodexSession({ sdkImpl: FakeCodex, skipEnvGuard: true, homeDir, ledgerPath });
    assert.deepEqual(session.threadIds, []);
    await session.ask("hi");
    assert.deepEqual(session.threadIds, ["observed-thread-777"]);
    await session.dispose();
  });
});

// ── ThreadOptions（sandbox/approval/webSearch/effort）配線の確認 ───────────────

test("codex-session: startThread は read-only sandbox・approval never・webSearch disabled・既定 effort=none で呼ばれる", async () => {
  await withScratchHome(async ({ homeDir, ledgerPath }) => {
    const { FakeCodex, getLastThreadOptions } = makeFakeSdk({ onRun: () => successEvents("ok") });
    const session = createCodexSession({ sdkImpl: FakeCodex, skipEnvGuard: true, homeDir, ledgerPath });
    await session.ask("hi");

    const opts = getLastThreadOptions();
    assert.equal(opts.sandboxMode, "read-only");
    assert.equal(opts.approvalPolicy, "never");
    assert.equal(opts.webSearchEnabled, false);
    assert.equal(opts.modelReasoningEffort, "none");
    assert.equal(opts.skipGitRepoCheck, true);
    assert.equal(typeof opts.workingDirectory, "string");
    assert.ok(existsSync(opts.workingDirectory), "workingDirectory はスクラッチ dir として実在する");

    await session.dispose();
    assert.equal(existsSync(opts.workingDirectory), false, "dispose でスクラッチ dir は削除される");
  });
});

// ── rollout 掃除の性質テスト（⚠ blocking・最重要） ─────────────────────────────

test("codex-session: 起動時 sweep は台帳の thread_id と完全一致するファイルだけを消し、台帳に無い他人の rollout は全て無傷", async () => {
  await withScratchHome(async ({ homeDir, ledgerPath }) => {
    // 台帳に載らない「他人」の rollout を 12 本、日替わりで配置。
    const otherPaths = [];
    for (let i = 0; i < 12; i++) {
      const id = `other-thread-${String(i).padStart(3, "0")}-${"a".repeat(8)}`;
      const day = String(1 + (i % 27)).padStart(2, "0");
      otherPaths.push(writeRolloutFile(homeDir, ["2026", "07", day], rolloutFileName(id)));
    }
    // 自分の rollout を 2 本配置し、台帳に記録する。
    const myIds = ["my-thread-aaaa-1111", "my-thread-bbbb-2222"];
    const myPaths = myIds.map((id) => writeRolloutFile(homeDir, ["2026", "07", "17"], rolloutFileName(id)));
    mkdirSync(path.dirname(ledgerPath), { recursive: true });
    writeFileSync(ledgerPath, JSON.stringify({ threadIds: myIds }, null, 2), "utf8");

    // createCodexSession の生成が起動時 sweep を走らせる（fake SDK・実消費ゼロ）。
    const { FakeCodex } = makeFakeSdk({ onRun: () => successEvents("ok") });
    const session = createCodexSession({ sdkImpl: FakeCodex, skipEnvGuard: true, homeDir, ledgerPath });

    for (const p of myPaths) {
      assert.equal(existsSync(p), false, `自分の rollout は消えているはず: ${p}`);
    }
    for (const p of otherPaths) {
      assert.equal(existsSync(p), true, `他人の rollout は無傷のはず: ${p}`);
    }
    const ledgerAfter = JSON.parse(readFileSync(ledgerPath, "utf8"));
    assert.deepEqual(ledgerAfter.threadIds, []);

    await session.dispose();
  });
});

test("codex-session: dispose は自セッションが作った thread_id の rollout だけを消し、他人の rollout は無傷", async () => {
  await withScratchHome(async ({ homeDir, ledgerPath }) => {
    const otherPaths = [];
    for (let i = 0; i < 10; i++) {
      otherPaths.push(
        writeRolloutFile(homeDir, ["2026", "07", "17"], rolloutFileName(`bystander-${String(i).padStart(3, "0")}`))
      );
    }

    const { FakeCodex } = makeFakeSdk({ threadId: "session-thread-xyz-999", onRun: () => successEvents("ok") });
    const session = createCodexSession({ sdkImpl: FakeCodex, skipEnvGuard: true, homeDir, ledgerPath });
    await session.ask("hi"); // thread.id 確定 → 台帳に記録される。

    // 実 SDK ならここで rollout ファイルが自動生成されるが、fake は書かないのでテストが用意する。
    const myPath = writeRolloutFile(homeDir, ["2026", "07", "17"], rolloutFileName("session-thread-xyz-999"));

    const ledgerBefore = JSON.parse(readFileSync(ledgerPath, "utf8"));
    assert.deepEqual(ledgerBefore.threadIds, ["session-thread-xyz-999"]);

    await session.dispose();

    assert.equal(existsSync(myPath), false, "自分の rollout は dispose で消えるはず");
    for (const p of otherPaths) {
      assert.equal(existsSync(p), true, `他人の rollout は無傷のはず: ${p}`);
    }
    const ledgerAfter = JSON.parse(readFileSync(ledgerPath, "utf8"));
    assert.deepEqual(ledgerAfter.threadIds, []);
  });
});

test("codex-session: 台帳の thread_id に対応する rollout が見つからなくても sweep はエラーにならず台帳から外すだけ", async () => {
  await withScratchHome(async ({ homeDir, ledgerPath }) => {
    const otherPaths = [
      writeRolloutFile(homeDir, ["2026", "07", "17"], rolloutFileName("bystander-alpha")),
      writeRolloutFile(homeDir, ["2026", "07", "18"], rolloutFileName("bystander-beta"))
    ];
    mkdirSync(path.dirname(ledgerPath), { recursive: true });
    writeFileSync(ledgerPath, JSON.stringify({ threadIds: ["ghost-thread-does-not-exist"] }), "utf8");

    const { FakeCodex } = makeFakeSdk({ onRun: () => successEvents("ok") });
    let session;
    assert.doesNotThrow(() => {
      session = createCodexSession({ sdkImpl: FakeCodex, skipEnvGuard: true, homeDir, ledgerPath });
    });

    const ledgerAfter = JSON.parse(readFileSync(ledgerPath, "utf8"));
    assert.deepEqual(ledgerAfter.threadIds, []);
    for (const p of otherPaths) {
      assert.equal(existsSync(p), true);
    }

    await session.dispose();
  });
});

test("codex-session: ~/.codex/sessions 自体が存在しない環境でも起動時 sweep はエラーにならない", async () => {
  await withScratchHome(async ({ homeDir, ledgerPath }) => {
    // .codex/sessions ディレクトリを一切作らない。
    mkdirSync(path.dirname(ledgerPath), { recursive: true });
    writeFileSync(ledgerPath, JSON.stringify({ threadIds: ["ghost-1", "ghost-2"] }), "utf8");

    const { FakeCodex } = makeFakeSdk({ onRun: () => successEvents("ok") });
    let session;
    assert.doesNotThrow(() => {
      session = createCodexSession({ sdkImpl: FakeCodex, skipEnvGuard: true, homeDir, ledgerPath });
    });

    const ledgerAfter = JSON.parse(readFileSync(ledgerPath, "utf8"));
    assert.deepEqual(ledgerAfter.threadIds, []);

    await session.dispose();
  });
});

test("codex-session: ファイル名の部分一致では消さない（末尾一致のみを id とみなす構造パース）", async () => {
  await withScratchHome(async ({ homeDir, ledgerPath }) => {
    // 台帳の id は "abc"。"abc" を部分文字列に含むが完全一致ではない thread_id のファイルを配置。
    const decoyPath = writeRolloutFile(homeDir, ["2026", "07", "17"], rolloutFileName("xxx-abc-yyy"));
    const exactPath = writeRolloutFile(homeDir, ["2026", "07", "17"], rolloutFileName("abc"));
    mkdirSync(path.dirname(ledgerPath), { recursive: true });
    writeFileSync(ledgerPath, JSON.stringify({ threadIds: ["abc"] }), "utf8");

    const { FakeCodex } = makeFakeSdk({ onRun: () => successEvents("ok") });
    const session = createCodexSession({ sdkImpl: FakeCodex, skipEnvGuard: true, homeDir, ledgerPath });

    assert.equal(existsSync(decoyPath), true, "部分一致のファイルは消してはいけない");
    assert.equal(existsSync(exactPath), false, "完全一致のファイルは消えるはず");

    await session.dispose();
  });
});
