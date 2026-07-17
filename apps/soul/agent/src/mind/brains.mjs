// @ts-check
/**
 * 知性契約 typedef + 頭の表（フラット registry）— apps/soul/agent（多頭化 Domain A）。
 *
 * 「頭が替わっても魂は不変」の唯一の数値/宣言の在り処。expression-table.mjs（S4 Domain A）と
 * 同じ意匠——**唯一の宣言テーブルを `Object.freeze` で持ち、消費側（Domain B の配線）はここを
 * import するだけ**。頭を増やすときはこのオブジェクトへ 1 項目足すだけでよい形にする。
 *
 * ── 知性契約（現外形の凍結）──────────────────────────────────────────────
 *  頭セッションの外形は llm-session.mjs（Claude 頭）の戻り値そのまま。ttftMs は Codex 頭では常に
 *  null になるが、fire-orchestrator の消費面は replyText/usage のみ（ttftMs/elapsedMs は grep で
 *  参照ゼロ・brain-swap-inventory.md §2-1）なので **null 安全**——契約はこの現外形をそのまま
 *  凍結すればよく、Codex 頭が来ても壊れる箇所は無い。
 *
 * @typedef {object} MindSessionAskResult
 * @property {string} replyText  応答全文（読み上げ・会話ログの正本）。
 * @property {any} usage  頭ごとの usage 形（Claude: {input_tokens,output_tokens,...} / Codex も同名フィールドを持つ）。
 * @property {number | null} ttftMs  最初のトークン到達までの ms（ストリーミング非対応の頭は null）。
 * @property {number} elapsedMs  ask 開始から応答確定までの実測 ms。
 *
 * @typedef {object} MindSession
 * @property {(content: string | Array<any>) => Promise<MindSessionAskResult>} ask
 *   非空文字列、または非空の content ブロック配列（S5 視覚発火の型）を受理する。
 * @property {() => Promise<void>} dispose  頭を畳む（常駐プロセスの終了 / rollout 掃除 等は頭ごとの私事）。
 *
 * ── 頭の表のエントリ形 ─────────────────────────────────────────────────
 * @typedef {object} BrainEntry
 * @property {string} id  registry のキーと同じ一意識別子（"claude" | "codex"）。
 * @property {string} label  操縦席の表示札（設定層「頭脳」区画の select 表記）。
 * @property {(options?: object) => MindSession} create  頭セッションを起動する（Domain B が options に
 *   systemPrompt 等を渡す）。**ここでは呼ばない**（health test は実 create を呼ばない＝実 SDK 消費ゼロ）。
 * @property {string} credentialPath  資格情報ファイルの絶対パス（健康表示の存在確認用・中身は読まない）。
 */

import os from "node:os";
import path from "node:path";
import { createLlmSession } from "./llm-session.mjs";
import { createCodexSession } from "./codex-session.mjs";

/**
 * 頭の表（フラット 2 項目・v0 裁定=brain-swap.md §2）。**この Object.freeze が唯一の宣言の在り処**
 * （expression-table.mjs 式）。llm-session.mjs（Claude 頭）は無変更でこの 1 項目になる。
 *
 * @type {Readonly<Record<string, Readonly<BrainEntry>>>}
 */
export const BRAINS = Object.freeze({
  claude: Object.freeze({
    id: "claude",
    label: "Claude (Opus 4.8)",
    create: (options) => createLlmSession(options),
    credentialPath: path.join(os.homedir(), ".claude", ".credentials.json")
  }),
  codex: Object.freeze({
    id: "codex",
    label: "Codex (GPT-5.6 Terra)",
    create: (options) => createCodexSession(options),
    credentialPath: path.join(os.homedir(), ".codex", "auth.json")
  })
});

/**
 * 頭の識別子リスト（登録順）。Domain B の select 描画・妥当性検証の単一の正。
 * @type {ReadonlyArray<string>}
 */
export const BRAIN_IDS = Object.freeze(Object.keys(BRAINS));
