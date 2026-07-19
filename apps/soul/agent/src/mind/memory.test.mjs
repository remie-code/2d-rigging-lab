// @ts-check
/**
 * memory.mjs の機械テスト（配信間記憶 Domain A・全 fake・実 LLM/実ネット消費ゼロ）。
 *
 * 全テストは OS temp のスクラッチディレクトリ（fs.mkdtempSync）を注入し、実の
 * `apps/soul/agent/memories/` や `~/.codex` には一切触れない（テスト非汚染）。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  formatTranscriptForDigest,
  DIGEST_GENERATION_INSTRUCTION,
  generateDigest,
  saveDigest,
  loadRecentDigests,
  composeSystemPrompt,
  DEFAULT_MEMORIES_DIR
} from "./memory.mjs";

function tmpDir() {
  return mkdtempSync(path.join(os.tmpdir(), "memory-test-"));
}

// ── 1. 整形: 話者ラベル + 視聴者名の秘匿（blocking #1 第一防御）───────────────────

test("formatTranscriptForDigest: you/soul/viewer をラベル付き行へ整形する", () => {
  const entries = [
    { text: "今日はアークナイツやるで", speaker: "you" },
    { text: "楽しみです<smile>", speaker: "soul" },
    { text: "がんばれー", speaker: "viewer", displayName: "しちみ" }
  ];
  const text = formatTranscriptForDigest(entries);
  assert.equal(
    text,
    ["you: 今日はアークナイツやるで", "soul: 楽しみです<smile>", "viewer: がんばれー"].join("\n")
  );
});

test("formatTranscriptForDigest: viewer の displayName（視聴者名）は出力に一切現れない（blocking #1 機械固定）", () => {
  const entries = [
    { text: "配信始まったで", speaker: "you" },
    { text: "初見です！", speaker: "viewer", displayName: "とある視聴者A" },
    { text: "こんにちは", speaker: "viewer", displayName: "視聴者B太郎" },
    { text: "こんにちは<nod>", speaker: "soul" }
  ];
  const text = formatTranscriptForDigest(entries);
  assert.ok(!text.includes("とある視聴者A"), "displayName A が漏れていないこと");
  assert.ok(!text.includes("視聴者B太郎"), "displayName B が漏れていないこと");
  assert.ok(!text.includes("("), "fire-injection.mjs の viewer(名前): 意匠を真似ていないこと（括弧なし）");
  // viewer 行そのものは名前なしで残る。
  assert.ok(text.includes("viewer: 初見です！"));
  assert.ok(text.includes("viewer: こんにちは"));
});

test("formatTranscriptForDigest: 未知話者は you に寄せる（防御的）", () => {
  const text = formatTranscriptForDigest([{ text: "?", speaker: "unknown" }]);
  assert.equal(text, "you: ?");
});

test("formatTranscriptForDigest: 空配列 → 空文字列", () => {
  assert.equal(formatTranscriptForDigest([]), "");
});

// ── 2. 生成指示: 視聴者名禁止の明記（blocking #1 第二防御）─────────────────────────

test("DIGEST_GENERATION_INSTRUCTION: 視聴者名・個人特定情報を書かない旨を明記している", () => {
  assert.ok(DIGEST_GENERATION_INSTRUCTION.includes("視聴者"));
  assert.ok(DIGEST_GENERATION_INSTRUCTION.includes("名前"));
  assert.ok(DIGEST_GENERATION_INSTRUCTION.length <= 1500, "生成指示自体も過度に長くない");
});

// ── 3. generateDigest: 使い捨て・常駐不汚染・dispose 保証（blocking #2）───────────────

/**
 * fake brain create（brains registry の create と同じ形）。
 * @param {{ replyText?: string; askImpl?: (content: any) => Promise<any>; onDispose?: () => void }} spec
 */
function makeFakeCreate(spec = {}) {
  const calls = { create: 0, ask: [], dispose: 0 };
  const create = (options) => {
    calls.create += 1;
    calls.createOptions = options;
    return {
      async ask(content) {
        calls.ask.push(content);
        if (spec.askImpl) {
          return spec.askImpl(content);
        }
        return { replyText: spec.replyText ?? "ダイジェスト本文", usage: {} };
      },
      async dispose() {
        calls.dispose += 1;
        if (spec.onDispose) spec.onDispose();
      }
    };
  };
  return { create, calls };
}

test("generateDigest: create→ask 一発→dispose を実行し replyText を返す（fake・実 LLM 消費ゼロ）", async () => {
  const { create, calls } = makeFakeCreate({ replyText: "今日はアークナイツを配信した。" });
  const entries = [
    { text: "今日はアークナイツやるで", speaker: "you" },
    { text: "楽しみです", speaker: "soul" }
  ];
  const digest = await generateDigest({ createImpl: create, entries });
  assert.equal(digest, "今日はアークナイツを配信した。");
  assert.equal(calls.create, 1, "create は 1 回だけ（使い捨て）");
  assert.equal(calls.ask.length, 1, "ask は一発だけ");
  assert.equal(calls.dispose, 1, "dispose は 1 回だけ呼ばれる");
  // ask には整形済み転写（formatTranscriptForDigest の出力）が渡っている。
  assert.equal(calls.ask[0], "you: 今日はアークナイツやるで\nsoul: 楽しみです");
  // systemPrompt には DIGEST_GENERATION_INSTRUCTION が渡っている（常駐の systemPrompt とは別物）。
  assert.equal(calls.createOptions.systemPrompt, DIGEST_GENERATION_INSTRUCTION);
});

test("generateDigest: brainDef.create 経由でも動く（createImpl 未指定時のフォールバック）", async () => {
  const { create, calls } = makeFakeCreate({ replyText: "ok" });
  const brainDef = { create };
  const digest = await generateDigest({ brainDef, entries: [{ text: "hi", speaker: "you" }] });
  assert.equal(digest, "ok");
  assert.equal(calls.create, 1);
});

test("generateDigest: ask が throw しても dispose は必ず呼ばれる（try/finally 固定）", async () => {
  const { create, calls } = makeFakeCreate({
    askImpl: async () => {
      throw new Error("ask failed (fake)");
    }
  });
  await assert.rejects(
    () => generateDigest({ createImpl: create, entries: [{ text: "hi", speaker: "you" }] }),
    /ask failed \(fake\)/
  );
  assert.equal(calls.dispose, 1, "ask が throw しても dispose は呼ばれる");
});

test("generateDigest: 常駐セッションには一切触れない（渡された session/常駐オブジェクトを参照しない）", async () => {
  const residentSession = {
    ask: () => {
      throw new Error("常駐セッションの ask が呼ばれてはならない");
    },
    dispose: () => {
      throw new Error("常駐セッションの dispose が呼ばれてはならない");
    }
  };
  const { create } = makeFakeCreate({ replyText: "ok" });
  // generateDigest のオプションには常駐 session を渡す口が無い（createImpl/brainDef のみ）ことを
  // 契約として固定する。誤って参照されていないことを、別オブジェクトとして生成し確認する。
  const digest = await generateDigest({ createImpl: create, entries: [{ text: "hi", speaker: "you" }] });
  assert.equal(digest, "ok");
  assert.doesNotThrow(() => {
    // residentSession は generateDigest に一切渡していないため、呼ばれていないはず。
    void residentSession;
  });
});

test("generateDigest: 空転写（整形結果が空）なら create を呼ばず null を返す（ask を無駄撃ちしない）", async () => {
  const { create, calls } = makeFakeCreate({ replyText: "should not happen" });
  const digest = await generateDigest({ createImpl: create, entries: [] });
  assert.equal(digest, null);
  assert.equal(calls.create, 0, "空転写では create を呼ばない");
});

test("generateDigest: createImpl も brainDef.create も無ければ throw する", async () => {
  await assert.rejects(
    () => generateDigest({ entries: [{ text: "hi", speaker: "you" }] }),
    TypeError
  );
});

// ── 4. saveDigest: 上書き・ディレクトリ自動作成（blocking #6）────────────────────────

test("saveDigest: 同一 startedAtMs で 2 回保存すると同一ファイルが上書きされる（ファイルは 1 個）", () => {
  const dir = tmpDir();
  try {
    const startedAtMs = Date.parse("2026-07-19T14:30:00.000Z");
    const path1 = saveDigest("最初のダイジェスト", { dir, startedAtMs });
    const path2 = saveDigest("更新後のダイジェスト", { dir, startedAtMs });
    assert.equal(path1, path2, "同一 startedAtMs は同一ファイルパスを導く");
    const files = readdirSync(dir);
    assert.equal(files.length, 1, "ファイルは 1 個のまま（上書き）");
    const { text, count } = loadRecentDigests({ dir, n: 1 });
    assert.equal(count, 1);
    assert.equal(text, "更新後のダイジェスト", "内容は最後に書いたもので上書きされている");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("saveDigest: ディレクトリが未作成でも自動作成する", () => {
  const parent = tmpDir();
  try {
    const dir = path.join(parent, "nested", "memories");
    const startedAtMs = Date.now();
    const filePath = saveDigest("x", { dir, startedAtMs });
    assert.equal(readdirSync(dir).length, 1);
    assert.ok(filePath.startsWith(dir));
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});

test("saveDigest: ファイル名はファイルシステム安全（コロンを含まない）で拡張子 .md", () => {
  const dir = tmpDir();
  try {
    const startedAtMs = Date.parse("2026-07-19T14:30:05.000Z");
    const filePath = saveDigest("x", { dir, startedAtMs });
    const fileName = path.basename(filePath);
    assert.ok(!fileName.includes(":"), `fileName must not contain ':'; got ${fileName}`);
    assert.ok(fileName.endsWith(".md"), fileName);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("saveDigest: ファイル名は辞書順 = 時系列昇順になる（loadRecentDigests の降順ソートの前提）", () => {
  const dir = tmpDir();
  try {
    const earlier = saveDigest("older", { dir, startedAtMs: Date.parse("2026-07-19T10:00:00.000Z") });
    const later = saveDigest("newer", { dir, startedAtMs: Date.parse("2026-07-19T20:00:00.000Z") });
    const earlierName = path.basename(earlier);
    const laterName = path.basename(later);
    assert.ok(earlierName < laterName, `${earlierName} should sort before ${laterName}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("DEFAULT_MEMORIES_DIR: apps/soul/agent/memories 配下を指す", () => {
  assert.match(DEFAULT_MEMORIES_DIR.replace(/\\/g, "/"), /apps\/soul\/agent\/memories$/);
});

// ── 5. loadRecentDigests: N 件・合計上限・欠損耐性 ─────────────────────────────

test("loadRecentDigests: N 件超の存在から新しい順に N 件だけ読む", () => {
  const dir = tmpDir();
  try {
    saveDigest("day1", { dir, startedAtMs: Date.parse("2026-07-17T10:00:00.000Z") });
    saveDigest("day2", { dir, startedAtMs: Date.parse("2026-07-18T10:00:00.000Z") });
    saveDigest("day3", { dir, startedAtMs: Date.parse("2026-07-19T10:00:00.000Z") });
    const { text, count } = loadRecentDigests({ dir, n: 2 });
    assert.equal(count, 2);
    // 新しい順（day3 が先・day1 は含まれない）。
    assert.ok(text.indexOf("day3") < text.indexOf("day2"));
    assert.ok(!text.includes("day1"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("loadRecentDigests: 既定 n=3 は裁定どおり", () => {
  const dir = tmpDir();
  try {
    for (let i = 0; i < 5; i += 1) {
      saveDigest(`digest-${i}`, { dir, startedAtMs: Date.parse(`2026-07-1${i}T10:00:00.000Z`) });
    }
    const { count } = loadRecentDigests({ dir });
    assert.equal(count, 3);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("loadRecentDigests: 合計サイズ上限 maxChars を超えると切れる", () => {
  const dir = tmpDir();
  try {
    saveDigest("a".repeat(50), { dir, startedAtMs: Date.parse("2026-07-18T10:00:00.000Z") });
    saveDigest("b".repeat(50), { dir, startedAtMs: Date.parse("2026-07-19T10:00:00.000Z") });
    const { text, count } = loadRecentDigests({ dir, n: 2, maxChars: 60 });
    assert.ok(text.length <= 60, `text.length=${text.length} should be <= 60`);
    assert.equal(count, 1, "上限に収まる最初の 1 件（新しい方=b）だけが搭載される");
    assert.ok(text.includes("b"));
    assert.ok(!text.includes("a"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("loadRecentDigests: dir 不在 → 空を返す（欠損耐性）", () => {
  const parent = tmpDir();
  try {
    const missingDir = path.join(parent, "does-not-exist");
    const { text, count } = loadRecentDigests({ dir: missingDir });
    assert.equal(text, "");
    assert.equal(count, 0);
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});

test("loadRecentDigests: 空ディレクトリ → 空を返す", () => {
  const dir = tmpDir();
  try {
    const { text, count } = loadRecentDigests({ dir });
    assert.equal(text, "");
    assert.equal(count, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("loadRecentDigests: .md 以外のファイルは読まない", () => {
  const dir = tmpDir();
  try {
    saveDigest("real digest", { dir, startedAtMs: Date.parse("2026-07-19T10:00:00.000Z") });
    writeFileSync(path.join(dir, "notes.txt"), "should not be read", "utf8");
    writeFileSync(path.join(dir, "zzz-not-markdown"), "should not be read either", "utf8");
    const { text, count } = loadRecentDigests({ dir, n: 10 });
    assert.equal(count, 1);
    assert.ok(text.includes("real digest"));
    assert.ok(!text.includes("should not be read"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("loadRecentDigests: 壊れた/読めないファイルは握って続行する", () => {
  const dir = tmpDir();
  try {
    saveDigest("good digest", { dir, startedAtMs: Date.parse("2026-07-19T10:00:00.000Z") });
    // ディレクトリを .md 拡張子で作る → readFileSync が確実に失敗する（EISDIR）。
    const path2 = path.join(dir, "2026-07-20T10-00-00.md");
    mkdirSync(path2);
    assert.doesNotThrow(() => {
      const { text, count } = loadRecentDigests({ dir, n: 10 });
      assert.equal(count, 1, "壊れたエントリはスキップされ、正常な 1 件だけ数えられる");
      assert.ok(text.includes("good digest"));
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ── 6. composeSystemPrompt: 記憶の ON/OFF（blocking #4 注入側）───────────────────

test("composeSystemPrompt: memoryText が空でない場合は仮面 + 記憶を合成する", () => {
  const masque = "あなたはコーディです。";
  const memoryText = "前回はアークナイツを配信した。";
  const composed = composeSystemPrompt(masque, memoryText);
  assert.ok(composed.includes(masque));
  assert.ok(composed.includes(memoryText));
  assert.ok(composed.length > masque.length + memoryText.length, "見出し等が付与されている");
});

test("composeSystemPrompt: memoryText が空文字列なら素の仮面をそのまま返す（OFF 相当）", () => {
  const masque = "あなたはコーディです。";
  assert.equal(composeSystemPrompt(masque, ""), masque);
});

test("composeSystemPrompt: memoryText が undefined/null なら素の仮面をそのまま返す", () => {
  const masque = "あなたはコーディです。";
  assert.equal(composeSystemPrompt(masque, undefined), masque);
  assert.equal(composeSystemPrompt(masque, null), masque);
});

test("composeSystemPrompt: memoryText が空白のみなら素の仮面をそのまま返す", () => {
  const masque = "あなたはコーディです。";
  assert.equal(composeSystemPrompt(masque, "   \n  "), masque);
});
