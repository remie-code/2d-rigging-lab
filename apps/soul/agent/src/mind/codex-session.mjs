// @ts-check
/**
 * Codex SDK 統合 — 常駐 Thread による Codex 頭セッション（多頭化 Domain A）— apps/soul/agent。
 *
 * `@openai/codex-sdk` の `Codex.startThread()` を使い、`llm-session.mjs`（Claude 頭）と対称の外形
 * （知性契約 = `{ask(content), dispose()}`・戻り値 `{replyText, usage, ttftMs, elapsedMs}`）で
 * Codex(GPT-5.6 Terra) を魂の頭として差し込む（brain-swap-wave-plan.md §3 Domain A）。
 *
 * ── 常駐性について（llm-session と違う点）─────────────────────────────────
 *  codex-sdk の `Thread.run()`/`runStreamed()` は**呼ぶたびに codex CLI を spawn する**（実測
 *  spawn ≈310ms warm・brain-swap-terra.md §4）。llm-session のような「1 プロセスを保持し続ける」
 *  常駐ではない。ここでの「常駐」は **Thread オブジェクト 1 個をセッション寿命の間保持し、2 発目
 *  以降は `resume <thread_id>` で会話を継続する**という意味（SDK のマルチターン=ディスクの
 *  rollout 読み直しに依存・brain-swap-terra.md §6）。
 *
 * ── env（サブスク枠固定）────────────────────────────────────────────────
 *  `assertSubscriptionAuthEnvOpenAI` で OPENAI_API_KEY/CODEX_API_KEY を事前拒否。SDK には
 *  env/apiKey/baseUrl を渡さない（未指定なら SDK は process.env をそのまま継承する＝CLI spawn を
 *  壊さない安全側）。`config:{forced_login_method:"chatgpt"}` を固定し API キー課金への化けを防ぐ
 *  （spike-codex-terra.mjs と同じ意匠）。
 *
 * ── サンドボックス（素チャット化）────────────────────────────────────────
 *  `sandboxMode:"read-only"` + `approvalPolicy:"never"` + `webSearchEnabled:false` でエージェント
 *  行動を封じる（brain-swap-terra.md §5 実測: 15/15 満点でツール/英語混入ゼロ）。`workingDirectory`
 *  はセッション寿命だけのスクラッチ dir（os.tmpdir 配下・リポジトリ外）で、dispose で削除する。
 *  sandbox=read-only + repo 外 cwd の二重防御でリポジトリに触れさせない。
 *
 * ── 画像橋渡し（アダプタ私事・昇格予約）──────────────────────────────────
 *  知性契約は base64 インメモリのまま（llm-session と同型）。Codex は `local_image`（ファイルパス）
 *  しか受け付けないため、base64 → `workingDirectory` 配下の一時ファイル書出 → `local_image` → run →
 *  **run の成否に関わらず finally で即削除**、をこのアダプタの内部だけで完結させる。
 *  **この base64→一時ファイル→local_image→即削除の橋渡しは Codex アダプタ内部の私事である。
 *  第二の「ローカルファイルしか読めない頭」が現れた時点で、この橋渡しは共有ヘルパへ昇格できる
 *  （discussion/ai-cohost/soul/brain-swap.md §5 参照・昇格予約はドキュメント 3 箇所義務の 1 つ）。**
 *
 * ── rollout 掃除（⚠ 最重要の安全事項）────────────────────────────────────
 *  Codex はスレッドの会話を `~/.codex/sessions/YYYY/MM/DD/rollout-<ISO時刻>-<thread_id>.jsonl`
 *  へ自動永続する（SDK 経由では無効化不可・brain-swap-terra.md §7）。視聴者データがディスクに残る
 *  ことを「配信中は記憶・配信後は掃除」で解決する（brain-swap.md §9 (a')）。掃除は**自分が作った
 *  thread_id の sidecar 台帳（gitignored・ledgerPath）に載っている id との完全一致だけ**を対象に
 *  し、bulk 削除・パターン削除・prefix 一致の経路は一切作らない。ファイル名は
 *  `rollout-<日付Tと時刻(コロンをハイフンに置換)>-<thread_id>.jsonl` の固定構造を正規表現で
 *  パースして thread_id 部分だけを抽出し、台帳の id と `===` 比較する（部分文字列一致では絶対に
 *  比較しない）。見つからなければ正直に諦めて台帳から外すだけ（エラーで起動を止めない）。
 *  ファイルの中身は一切開かない・読まない。
 */

import { performance } from "node:perf_hooks";
import {
  mkdtempSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  unlinkSync,
  writeFileSync
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { Codex as DefaultCodexSdk } from "@openai/codex-sdk";
import { assertSubscriptionAuthEnvOpenAI } from "./env-guard.mjs";
import { DEFAULT_SYSTEM_PROMPT } from "./llm-session.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** sidecar 台帳の既定パス（`apps/soul/agent/codex-rollouts.local.json`・cockpit-settings.local.json と同格）。 */
const DEFAULT_LEDGER_PATH = path.join(__dirname, "..", "..", "codex-rollouts.local.json");

/** 既定モデル（brain-swap.md §5-3 でユーザー確認済みの Terra 実在名）。 */
export const DEFAULT_MODEL = "gpt-5.6-terra";

/**
 * 既定の reasoning effort。Terra は `minimal` 非対応（400 実測・brain-swap-terra.md §1）。
 * `none` が最速かつ短文雑談では effort ダイヤルが速度を動かさない（同 §4）。
 * SDK の `ModelReasoningEffort` 型に `"none"` は無いが CLI は素通しする（同スパイク実証）。
 */
export const DEFAULT_EFFORT = "none";

/** rollout ファイル名の固定構造（brain-swap-inventory.md §2-5 実観測パス）。
 * キャプチャ group(1) が thread_id そのもの（時刻部分は固定桁数の日付+時刻で先に消費するため、
 * 部分一致ではなく構造パースで thread_id を正確に切り出せる）。 */
const ROLLOUT_FILENAME_RE = /^rollout-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-(.+)\.jsonl$/;

/**
 * base64 画像の media_type から一時ファイル拡張子を導く。既定 jpg（fire-orchestrator が渡すのは
 * 現状 image/jpeg のみ・brain-swap.md §5 裁定どおり base64 のまま契約は変えない）。
 * @param {string | undefined} mediaType
 * @returns {string}
 */
function mediaTypeToExt(mediaType) {
  if (mediaType === "image/png") return "png";
  if (mediaType === "image/webp") return "webp";
  return "jpg";
}

/**
 * rollout ファイル名から thread_id を抽出する（完全一致比較のための構造パース。部分一致は絶対にしない）。
 * @param {string} fileName
 * @returns {string | null}
 */
function extractThreadIdFromRolloutFilename(fileName) {
  const m = ROLLOUT_FILENAME_RE.exec(fileName);
  return m ? m[1] : null;
}

/**
 * `<homeDir>/.codex/sessions` を再帰探索し、ファイル名が threadId と完全一致する rollout を
 * 1 件だけ削除する。中身は一切開かない。見つからなくても・sessions ディレクトリが無くても
 * 例外を投げず false を返す（呼び出し側は「正直に諦めて台帳から外すだけ」の意味論）。
 * @param {string} homeDir
 * @param {string} threadId
 * @returns {boolean} 削除できたか。
 */
function deleteRolloutForThreadId(homeDir, threadId) {
  const sessionsDir = path.join(homeDir, ".codex", "sessions");
  let deleted = false;

  /** @param {string} dir */
  const walk = (dir) => {
    if (deleted) return;
    /** @type {import("node:fs").Dirent[]} */
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return; // ディレクトリが無い/読めない → 諦める（正直な失敗）。
    }
    for (const entry of entries) {
      if (deleted) return;
      const entryPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(entryPath);
      } else {
        const id = extractThreadIdFromRolloutFilename(entry.name);
        if (id !== null && id === threadId) {
          try {
            unlinkSync(entryPath);
            deleted = true;
          } catch {
            // 削除失敗も正直に諦める（起動/dispose を止めない）。
          }
        }
      }
    }
  };

  walk(sessionsDir);
  return deleted;
}

/**
 * sidecar 台帳（gitignored JSON）を読む。壊れている/存在しなければ空配列（正直に諦める）。
 * @param {string} ledgerPath
 * @returns {string[]}
 */
function readLedger(ledgerPath) {
  try {
    const raw = readFileSync(ledgerPath, "utf8");
    const data = JSON.parse(raw);
    if (data && Array.isArray(data.threadIds)) {
      return data.threadIds.filter((id) => typeof id === "string");
    }
    return [];
  } catch {
    return [];
  }
}

/**
 * sidecar 台帳を書く（best-effort・失敗しても起動/dispose を止めない）。
 * @param {string} ledgerPath
 * @param {string[]} threadIds
 * @returns {void}
 */
function writeLedger(ledgerPath, threadIds) {
  try {
    mkdirSync(path.dirname(ledgerPath), { recursive: true });
    writeFileSync(ledgerPath, JSON.stringify({ threadIds }, null, 2), "utf8");
  } catch {
    // 台帳書き込み失敗は非致命（次回起動時 sweep が対象を拾えないだけ）。
  }
}

/**
 * 起動時 sweep（クラッシュ復旧）: 台帳に載る thread_id だけを対象に rollout を削除し、
 * 処理した id は結果に関わらず台帳から外す（見つからなくても正直に諦めるだけ・エラーにしない）。
 * @param {string} homeDir
 * @param {string} ledgerPath
 * @returns {void}
 */
function sweepLedger(homeDir, ledgerPath) {
  const ids = readLedger(ledgerPath);
  if (ids.length === 0) return;
  for (const id of ids) {
    deleteRolloutForThreadId(homeDir, id);
  }
  writeLedger(ledgerPath, []);
}

/**
 * 台帳へ 1 件の thread_id を追記する（既存分は保持）。
 * @param {string} ledgerPath
 * @param {string} threadId
 * @returns {void}
 */
function appendLedger(ledgerPath, threadId) {
  const ids = readLedger(ledgerPath);
  if (!ids.includes(threadId)) {
    ids.push(threadId);
    writeLedger(ledgerPath, ids);
  }
}

/**
 * 台帳から指定 id 群を除去する（他セッションが積んだ id は残す）。
 * @param {string} ledgerPath
 * @param {string[]} threadIdsToRemove
 * @returns {void}
 */
function removeFromLedger(ledgerPath, threadIdsToRemove) {
  const ids = readLedger(ledgerPath);
  const remaining = ids.filter((id) => !threadIdsToRemove.includes(id));
  if (remaining.length !== ids.length) {
    writeLedger(ledgerPath, remaining);
  }
}

/**
 * content（string | content ブロック配列）を Codex の `Input` へ変換する。turn 1 は systemPrompt を
 * 先頭に前置する（Codex には per-session systemPrompt 口が無いため・現行 Claude 契約もセッション
 * 生成時固定なので実質段差なし＝brain-swap.md §4）。画像ブロックは base64 → 一時ファイル書出。
 * @param {string | Array<any>} content
 * @param {boolean} isFirstTurn
 * @param {string} systemPrompt
 * @param {string} workingDirectory
 * @returns {{ input: import("@openai/codex-sdk").Input; tempFiles: string[] }}
 */
function buildInput(content, isFirstTurn, systemPrompt, workingDirectory) {
  /** @type {string[]} */
  const tempFiles = [];

  if (typeof content === "string") {
    const text = isFirstTurn ? `${systemPrompt}\n\n${content}` : content;
    return { input: text, tempFiles };
  }

  /** @type {Array<{type:"text",text:string}|{type:"local_image",path:string}>} */
  const blocks = [];
  if (isFirstTurn) {
    blocks.push({ type: "text", text: systemPrompt });
  }
  for (const block of content) {
    if (block && block.type === "text" && typeof block.text === "string") {
      blocks.push({ type: "text", text: block.text });
    } else if (
      block &&
      block.type === "image" &&
      block.source &&
      block.source.type === "base64" &&
      typeof block.source.data === "string"
    ) {
      const ext = mediaTypeToExt(block.source.media_type);
      const filePath = path.join(workingDirectory, `image-${randomUUID()}.${ext}`);
      writeFileSync(filePath, Buffer.from(block.source.data, "base64"));
      tempFiles.push(filePath);
      blocks.push({ type: "local_image", path: filePath });
    }
    // 未知のブロック型は無視（fire-orchestrator が渡すのは text/image のみ・S5 実物）。
  }
  return { input: blocks, tempFiles };
}

/**
 * `thread.runStreamed()` を回してイベントを採取する。codex-sdk の `run()` は turn.failed を reject
 * するかが型定義上不明（brain-swap-inventory.md §2-4）なため、runStreamed でイベントを直接検査し
 * turn.failed/error を検出して throw する（空応答を黙って返さない）。
 * @param {import("@openai/codex-sdk").Thread} thread
 * @param {import("@openai/codex-sdk").Input} input
 * @returns {Promise<{ finalResponse: string; usage: any }>}
 */
async function runTurn(thread, input) {
  const { events } = await thread.runStreamed(input);
  let finalResponse = "";
  /** @type {any} */
  let usage = null;
  /** @type {string | null} */
  let errorMsg = null;

  for await (const ev of events) {
    switch (ev.type) {
      case "item.completed": {
        const item = /** @type {any} */ (ev).item;
        if (item && item.type === "agent_message" && typeof item.text === "string") {
          finalResponse = item.text;
        }
        break;
      }
      case "turn.completed":
        usage = /** @type {any} */ (ev).usage ?? null;
        break;
      case "turn.failed":
        errorMsg = /** @type {any} */ (ev).error?.message ?? "turn.failed";
        break;
      case "error":
        errorMsg = /** @type {any} */ (ev).message ?? "stream error";
        break;
      default:
        break;
    }
  }

  if (errorMsg !== null) {
    throw new Error(`codex-session: turn failed — ${errorMsg}`);
  }

  return { finalResponse, usage };
}

/**
 * Codex 頭セッションを起動する（知性契約 = llm-session.mjs と同型）。
 * @param {object} [options]
 * @param {string} [options.systemPrompt]  会話用 systemPrompt（turn 1 の先頭へ注入。既定は
 *   llm-session.mjs と同じ DEFAULT_SYSTEM_PROMPT＝二頭のメンタルモデルを対称に保つ）。
 * @param {string} [options.model]  モデル ID（既定 gpt-5.6-terra）。
 * @param {import("@openai/codex-sdk").ModelReasoningEffort | "none"} [options.effort]  既定 "none"。
 * @param {Record<string, string | undefined>} [options.env]  env ガード検査対象（既定 process.env）。
 * @param {boolean} [options.skipEnvGuard]  env ガードを飛ばす（テストで fake sdkImpl 注入時のみ）。
 * @param {(warning: string) => void} [options.onWarning]  env ガードの warning。
 * @param {typeof DefaultCodexSdk} [options.sdkImpl]  Codex コンストラクタの差し替え注入点（テスト用）。
 * @param {string} [options.homeDir]  rollout 掃除が探索する `~/.codex` の基点（既定 os.homedir()）。
 * @param {string} [options.ledgerPath]  thread_id sidecar 台帳のパス（既定 魂 zone ローカル）。
 * @returns {{
 *   ask: (content: string | Array<any>) => Promise<{ replyText: string; usage: any; ttftMs: number | null; elapsedMs: number }>;
 *   dispose: () => Promise<void>;
 *   threadIds: string[];
 * }}
 */
export function createCodexSession(options = {}) {
  const {
    systemPrompt = DEFAULT_SYSTEM_PROMPT,
    model = DEFAULT_MODEL,
    effort = DEFAULT_EFFORT,
    env = process.env,
    skipEnvGuard = false,
    onWarning,
    sdkImpl = DefaultCodexSdk,
    homeDir = os.homedir(),
    ledgerPath = DEFAULT_LEDGER_PATH
  } = options;

  if (!skipEnvGuard) {
    const { warnings } = assertSubscriptionAuthEnvOpenAI(env);
    if (onWarning) {
      for (const warning of warnings) {
        onWarning(warning);
      }
    }
  }

  // 起動時 sweep（クラッシュ復旧）: 前回セッションが台帳に残した thread_id を掃除してから始める。
  sweepLedger(homeDir, ledgerPath);

  // セッション寿命だけのスクラッチ dir（os.tmpdir 配下・リポジトリ外）。dispose で削除する。
  const workingDirectory = mkdtempSync(path.join(os.tmpdir(), "codex-session-"));

  const CodexCtor = sdkImpl;
  const codex = new CodexCtor({
    config: { forced_login_method: "chatgpt" }
    // env / apiKey / baseUrl は渡さない（process.env 継承・サブスク OAuth のみ）。
  });

  const thread = codex.startThread({
    model,
    sandboxMode: "read-only",
    approvalPolicy: "never",
    webSearchEnabled: false,
    workingDirectory,
    skipGitRepoCheck: true,
    modelReasoningEffort: /** @type {any} */ (effort)
  });

  /** @type {string[]} */
  const threadIds = [];
  let turnCount = 0;
  let disposed = false;

  return {
    /**
     * @param {string | Array<any>} content
     * @returns {Promise<{ replyText: string; usage: any; ttftMs: number | null; elapsedMs: number }>}
     */
    async ask(content) {
      const isNonEmptyString = typeof content === "string" && content.length > 0;
      const isNonEmptyBlocks = Array.isArray(content) && content.length > 0;
      if (!isNonEmptyString && !isNonEmptyBlocks) {
        throw new TypeError(
          "ask(content): content must be a non-empty string or a non-empty content block array."
        );
      }
      if (disposed) {
        throw new Error("codex-session already disposed.");
      }

      const isFirstTurn = turnCount === 0;
      turnCount += 1;

      const { input, tempFiles } = buildInput(content, isFirstTurn, systemPrompt, workingDirectory);

      try {
        const askStart = performance.now();
        let turn;
        try {
          turn = await runTurn(thread, input);
        } finally {
          // turn.failed でも rollout ファイルは作られている可能性がある → 成否に関わらず記録する。
          if (thread.id && !threadIds.includes(thread.id)) {
            threadIds.push(thread.id);
            appendLedger(ledgerPath, thread.id);
          }
        }
        const elapsedMs = performance.now() - askStart;
        return {
          replyText: turn.finalResponse,
          usage: turn.usage,
          ttftMs: null, // codex 経路はトークン delta が無い＝先頭トークン到達を観測できない（terra §0/§6）。
          elapsedMs
        };
      } finally {
        for (const filePath of tempFiles) {
          try {
            unlinkSync(filePath);
          } catch {
            // ベストエフォート（既に無い等は無視）。
          }
        }
      }
    },

    /** 記録済みの thread_id（このセッションが作った分のみ）。台帳記録・観測用。 */
    threadIds,

    /** 常駐プロセスは無い（run 毎 spawn）。dispose は rollout 掃除+スクラッチ削除+台帳整理。冪等。 */
    async dispose() {
      if (disposed) {
        return;
      }
      disposed = true;
      for (const id of threadIds) {
        deleteRolloutForThreadId(homeDir, id);
      }
      removeFromLedger(ledgerPath, threadIds);
      try {
        rmSync(workingDirectory, { recursive: true, force: true });
      } catch {
        // ベストエフォート。
      }
    }
  };
}
