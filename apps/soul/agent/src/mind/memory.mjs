// @ts-check
/**
 * 記憶の器官（配信間記憶・S 系「配信間記憶」Domain A・新設）— apps/soul/agent。
 *
 * 上位文書:
 *  - [stream-memory.md](../../../../discussion/ai-cohost/soul/stream-memory.md) — 裁定 7 件の正本。
 *  - [stream-memory-inventory.md](../../../../discussion/ai-cohost/implementation/orchestration/stream-memory-inventory.md) — L0 設計判断。
 *  - [stream-memory-wave-plan.md](../../../../discussion/ai-cohost/implementation/orchestration/stream-memory-wave-plan.md) — §3 Domain A。
 *
 * ── この器官がやること ─────────────────────────────────────────────────
 *  1. 全量転写（transcript-buffer.mjs の all()）を話者ラベル付きの読みやすい 1 本のダイアログへ整形する
 *     （formatTranscriptForDigest）。**fire-injection.mjs の formatFireInjection への巨大有限値ハックは
 *     しない**（L0 設計判断 1）——窓絞り・文字数上限は行わない全量整形の専用関数として新設した。
 *  2. ダイジェスト生成指示（DIGEST_GENERATION_INSTRUCTION）を常駐を汚さない使い捨てセッションへ渡し、
 *     ダイジェスト本文を得る（generateDigest）。
 *  3. ダイジェストを `memories/<起動日時>.md` へ保存する（saveDigest・同一セッションは同一ファイル上書き）。
 *  4. 起動時に直近 N 件のダイジェストを読み込む（loadRecentDigests・欠損耐性・合計サイズ上限）。
 *  5. 仮面（FIRE_SYSTEM_PROMPT）と記憶テキストを合成する（composeSystemPrompt・記憶空なら素の仮面）。
 *
 * ── blocking #1: 視聴者情報の秘匿（二重防御）───────────────────────────────
 *  第一防御はここ（整形段階）: formatTranscriptForDigest は viewer 行の displayName（視聴者名）を
 *  **常に落とす**。fire-injection.mjs の formatLine が描く `viewer(名前): 本文` の意匠は真似ず、
 *  viewer 行は `viewer: 本文` のみで描く（名前が絶対に文字列へ現れない）。第二防御は生成指示
 *  （DIGEST_GENERATION_INSTRUCTION）に「視聴者名・個人を特定する情報は書かない」旨を明記すること。
 *
 * ── blocking #2: 常駐の不汚染 ─────────────────────────────────────────────
 *  generateDigest は brains registry の create（または注入された createImpl）を**自分で呼んで**
 *  使い捨てセッションを作る。常駐セッション（fire-orchestrator が保持する session）には一切触れず、
 *  ask 一発の後に必ず dispose する（try/finally・ask が throw/reject しても dispose する）。
 *
 * ── blocking #6: メモリファイルの安全 ───────────────────────────────────────
 *  saveDigest / loadRecentDigests は常に呼び出し側が渡した `dir` 配下だけを触る。ファイル名は
 *  startedAtMs（制御された数値タイムスタンプ）からのみ導出し、外部入力（転写本文・話者名等）を
 *  パス組み立てに一切使わない。loadRecentDigests は `.md` 拡張子のファイルのみ読む。
 */

import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

/** 既定の保存先（`apps/soul/agent/memories/`・.gitignore 対象・settings-store の意匠を写経）。 */
export const DEFAULT_MEMORIES_DIR = join(here, "..", "..", "memories");

/** 既定の搭載件数（裁定 3・初期値 3 件）。 */
export const DEFAULT_DIGEST_COUNT = 3;

/**
 * 話者ラベルを返す（未知話者は "you" に寄せる・防御的・fire-injection.mjs labelOf の写経）。
 * @param {unknown} speaker
 * @returns {"you" | "soul" | "viewer"}
 */
function labelOf(speaker) {
  if (speaker === "soul") return "soul";
  if (speaker === "viewer") return "viewer";
  return "you";
}

/**
 * 会話ログの 1 エントリをダイジェスト整形用の 1 行へ整形する。
 * **viewer 行は displayName（視聴者名）を一切描かない**（blocking #1 第一防御・fire-injection.mjs の
 * `viewer(名前):` 意匠は真似ない）。
 *  you   → `you: 本文`
 *  soul  → `soul: 本文`
 *  viewer → `viewer: 本文`（名前は常に省く）
 * @param {{ text: string; speaker?: string }} e
 * @returns {string}
 */
function formatDigestLine(e) {
  const label = labelOf(e.speaker);
  return `${label}: ${e.text}`;
}

/**
 * 全量転写（transcript-buffer.mjs の all() が返す形）をダイジェスト生成入力用の 1 本のダイアログ
 * 文字列へ整形する純関数（I/O ゼロ・依存ゼロ）。窓絞り・文字数上限はここでは行わない
 * （全量整形・出力分量の制御は DIGEST_GENERATION_INSTRUCTION の ≤1500 字目安が担う）。
 *
 * @param {ReadonlyArray<{ text: string; speaker?: string; displayName?: string }>} entries
 * @returns {string}  空配列 → 空文字列。
 */
export function formatTranscriptForDigest(entries) {
  const list = Array.isArray(entries) ? entries : [];
  return list.map(formatDigestLine).join("\n");
}

/**
 * ダイジェスト生成指示（soul §3 の骨子・blocking #1 第二防御=視聴者名の禁止を明記）。
 * 分量目安 ≤1500 字（LLM への目安であり機械強制はしない）。
 */
export const DIGEST_GENERATION_INSTRUCTION =
  "これは配信の相方として次回配信に持ち越す「記憶」を作る作業です。" +
  "以下に渡す配信中の会話ログ（you=配信者、soul=あなた自身の発話、viewer=視聴者コメント）を読んで、" +
  "次回起動時に読み返す短いダイジェストを日本語で書いてください。" +
  "含めるとよい内容: 配信で起きた出来事（プレイしたゲーム・進行・ハイライト）、交わした話題やジョーク・" +
  "言い回し（後で「あの時の」と callback できる種）、配信者について新しく分かったこと。" +
  "**視聴者の名前や、個人を特定できる情報は一切書かないでください**（配信者本人についての記述はよい）。" +
  "分量の目安は 1500 字程度まで。箇条書きでも地の文でも構いませんが、簡潔に。";

/**
 * ダイジェスト生成入力(brainDef.create 差し替え口)の typedef。
 * @typedef {(options?: object) => { ask: (content: string) => Promise<{ replyText: string }>; dispose: () => Promise<void> }} BrainCreateFn
 */

/**
 * 使い捨てセッションでダイジェストを生成する（blocking #2: 常駐セッションには一切触れない）。
 * `create({ systemPrompt: DIGEST_GENERATION_INSTRUCTION }) → ask(整形済み転写) → dispose()` を実行する。
 *
 * - 空転写（formatTranscriptForDigest の結果が空文字列）なら session を create せず ask を無駄撃ちしない
 *   （防御的・戻り値は null）。
 * - dispose は try/finally で必ず呼ぶ（ask が throw/reject しても dispose する）。
 *
 * @param {object} options
 * @param {{ create: BrainCreateFn }} [options.brainDef]  brains registry の 1 エントリ（create を持つ）。
 * @param {BrainCreateFn} [options.createImpl]  brainDef.create の代わりに使う差し替え口（テストの fake 注入用）。
 *   brainDef と createImpl の両方が渡された場合は createImpl を優先する。
 * @param {ReadonlyArray<{ text: string; speaker?: string; displayName?: string }>} options.entries
 *   転写バッファの all() が返す全量転写。
 * @returns {Promise<string | null>}  ダイジェスト本文（replyText）。空転写なら null。
 */
export async function generateDigest(options = /** @type {any} */ ({})) {
  const { brainDef, createImpl, entries } = options;
  const transcriptText = formatTranscriptForDigest(entries ?? []);
  if (transcriptText.length === 0) {
    return null;
  }

  const create = createImpl ?? brainDef?.create;
  if (typeof create !== "function") {
    throw new TypeError("generateDigest: options.brainDef.create or options.createImpl must be a function.");
  }

  const session = create({ systemPrompt: DIGEST_GENERATION_INSTRUCTION });
  try {
    const { replyText } = await session.ask(transcriptText);
    return replyText;
  } finally {
    await session.dispose();
  }
}

/**
 * startedAtMs からファイルシステム安全・辞書順=時系列昇順なファイル名を作る（コロンを含まない）。
 * 例: 1784_... → "2026-07-19T14-30-00.md"。同一 startedAtMs は常に同一文字列 = 同一ファイル
 * （saveDigest の「同一セッションは同一ファイル上書き」を実現する鍵）。
 * @param {number} startedAtMs
 * @returns {string}
 */
function digestFileName(startedAtMs) {
  if (typeof startedAtMs !== "number" || !Number.isFinite(startedAtMs)) {
    throw new TypeError(`digestFileName: startedAtMs must be a finite number; got ${startedAtMs}.`);
  }
  // "2026-07-19T14:30:00.000Z" → "2026-07-19T14-30-00" （ミリ秒以下と "Z" を落とし、コロンをハイフンへ）。
  const iso = new Date(startedAtMs).toISOString();
  const safe = iso.replace(/\.\d+Z$/, "").replace(/:/g, "-");
  return `${safe}.md`;
}

/**
 * ダイジェストを `<dir>/<startedAtMs から導いたファイル名>.md` へ保存する（blocking #6: dir 配下のみ・
 * パス組み立てに外部入力を使わない=ファイル名は制御された数値タイムスタンプのみから導出）。
 * 同一セッション（同一 startedAtMs）で複数回呼ぶと同一ファイルへ上書きする（裁定 4: チェックポイント
 * / 手動記録 / SIGINT 最終版のいずれも同じファイルへ集約する）。ディレクトリは自動作成する。
 *
 * @param {string} digest  ダイジェスト本文。
 * @param {object} options
 * @param {string} [options.dir=DEFAULT_MEMORIES_DIR]  保存先ディレクトリ（テストは temp dir を注入）。
 * @param {number} options.startedAtMs  セッション開始時刻（壁時計 ms・ファイル名の元）。
 * @returns {string}  書き込んだファイルの絶対パス。
 */
export function saveDigest(digest, options = /** @type {any} */ ({})) {
  const { dir = DEFAULT_MEMORIES_DIR, startedAtMs } = options;
  const fileName = digestFileName(startedAtMs);
  const filePath = join(dir, fileName);
  mkdirSync(dir, { recursive: true });
  writeFileSync(filePath, typeof digest === "string" ? digest : String(digest ?? ""), "utf8");
  return filePath;
}

/**
 * 直近 N 件のダイジェストを読み込む（起動時の自動搭載・composeSystemPrompt の入力を作る）。
 * - ファイル名降順（= 新しい順、digestFileName が辞書順=時系列順であることを利用）。
 * - `.md` 拡張子のファイルのみ読む（blocking #6）。
 * - 合計サイズ上限 `maxChars` で切る（ファイル単位・文章を途中で割らない。既に 1 件以上採用済みで
 *   次のファイルを足すと上限を超える場合はそこで打ち切る。ただし最初の 1 件は上限を超えていても
 *   必ず含める＝空を返さないための安全弁で、fire-injection.mjs の「最新 1 行は常に残す」と同じ思想）。
 * - 欠損耐性: dir 不在 / 空ディレクトリ → 空を返す。個別ファイルの読み取り失敗は握って次へ進む。
 *
 * @param {object} [options]
 * @param {string} [options.dir=DEFAULT_MEMORIES_DIR]  読み込み元ディレクトリ（テストは temp dir を注入）。
 * @param {number} [options.n=DEFAULT_DIGEST_COUNT]  読み込む件数（裁定 3・既定 3）。
 * @param {number} [options.maxChars=Infinity]  合計文字数上限（未指定なら無制限）。
 * @returns {{ text: string; count: number }}  text は composeSystemPrompt にそのまま渡せる形
 *   （ダイジェスト本文を区切って連結）・count は実際に搭載した件数（UI の「記憶 N 件を搭載」表示用）。
 */
export function loadRecentDigests(options = /** @type {any} */ ({})) {
  const { dir = DEFAULT_MEMORIES_DIR, n = DEFAULT_DIGEST_COUNT, maxChars = Infinity } = options;

  /** @type {string[]} */
  let fileNames;
  try {
    fileNames = readdirSync(dir);
  } catch {
    // dir 不在（未起動・初回起動）→ 記憶なしで続行。
    return { text: "", count: 0 };
  }

  const mdFiles = fileNames.filter((name) => name.endsWith(".md")).sort().reverse(); // 降順=新しい順。
  const selected = mdFiles.slice(0, n);

  const parts = [];
  let total = 0;
  let count = 0;
  for (const fileName of selected) {
    /** @type {string} */
    let content;
    try {
      content = readFileSync(join(dir, fileName), "utf8");
    } catch {
      // 壊れた/読めないファイルは握って次へ進む（欠損耐性）。
      continue;
    }
    // 既に 1 件以上採用済みで、これを足すと上限を超える → ここで打ち切る（ファイル単位・
    // 文章を途中で割らない）。最初の 1 件は上限超過でも必ず含める（空を返さない安全弁）。
    if (parts.length > 0 && total + content.length > maxChars) {
      break;
    }
    parts.push(content);
    total += content.length;
    count += 1;
  }

  return { text: parts.join("\n\n"), count };
}

/** 仮面と記憶テキストを合成する際の記憶側の見出し。 */
const MEMORY_SECTION_HEADER = "これまでの配信で起きたことの記憶（参考程度に踏まえてください）:";

/**
 * 仮面（FIRE_SYSTEM_PROMPT）と記憶テキストを合成する（セッション生成時に systemPrompt として渡す形）。
 * **blocking #4（OFF の完全性・注入側）**: memoryText が空/未指定なら素の仮面をそのまま返す
 * （記憶 OFF・記憶ゼロ件のどちらでも masque が無加工で通る）。
 *
 * @param {string} masque  FIRE_SYSTEM_PROMPT（仮面本体）。
 * @param {string | null | undefined} memoryText  loadRecentDigests().text 相当。
 * @returns {string}
 */
export function composeSystemPrompt(masque, memoryText) {
  if (typeof memoryText !== "string" || memoryText.trim().length === 0) {
    return masque;
  }
  return `${masque}\n\n${MEMORY_SECTION_HEADER}\n${memoryText}`;
}
