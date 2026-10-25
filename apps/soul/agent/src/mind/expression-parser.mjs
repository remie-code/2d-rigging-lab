// @ts-check
/**
 * 表情タグパーサ（S4 Domain A・純関数）— apps/soul/agent。
 *
 * LLM 応答（インラインタグ込み）を受け、**読み上げ用テキスト（speechText）**と**演出イベント列**へ
 * 分離する純関数。討議②§2.6「最終テキスト検査」の最初の住人（TTS 直前・会話ログ直前）。
 * I/O ゼロ・依存は語彙リスト（expression-table）と目印の読み取り（recall-tag）のみ・throw しない（壊れ入力耐性）。
 *
 * ── タグ構文（v0 で決定）─────────────────────────────────────────────────────
 *   `<word>`                  例: `<smile>` `<look-away>`   —— 語のみ（6 語は引数不要）。
 *   `<word arg1 arg2 ...>`    例: `<look-at x=.3 y=-.2>`    —— 語 + 空白区切りの引数（S5 拡張の口）。
 *   - word : 英字始まりの `[A-Za-z][\w-]*`（ハイフン可＝look-away / look-camera）。
 *   - args : word の後ろの空白以降・`<` `>` を含まない任意文字列（v0 は**生文字列のまま**保持。
 *            構造化は S5 の翻訳層の仕事＝今は「口を開ける」だけ。6 語では未使用）。
 *
 * ── 出力契約 ────────────────────────────────────────────────────────────────
 *   parseExpressionTags(replyText) → {
 *     speechText  : タグを完全に剥離した読み上げ用テキスト（TTS・会話ログはこれのみ）。
 *     events      : [{ word, args?, position }]（**出現順**。position = 元 replyText 内のタグ開始
 *                   文字位置＝v0 は保持のみ・同期には使わない）。既知 6 語だけがイベントになる。
 *     diagnostics : [{ type, ... }]（声にも演出にも出さない・戻り値で返す＝副作用ではない）:
 *                     - { type:"unknownTag", tag }   語彙 6 語以外の well-formed タグ（剥離済み）。
 *                     - { type:"brokenTag", count }  未閉じ `<` / 単独 `>` 等の壊れ括弧を剥ぎ取った数
 *                                                    （閉じていない `<recall` も 1 つに数える）。
 *     recalls     : [{ request, position }]（記憶の作り直し Wave 3・`<recall 頼みごと>` の出現順。表情とは別の
 *                   語彙集合 recall-tag.mjs。声・会話ログ・events には入らない）。
 *   }
 *
 * ── 構造的事故防止（必須の不変条件）──────────────────────────────────────────
 *  speechText に `<` `>` は**絶対に残らない**（性質テストで固定）。well-formed タグの除去後に
 *  残る壊れ括弧も無条件に剥ぎ取る。これで「タグが声に出る」事故を構造的に封じる。
 */

import { EXPRESSION_WORDS } from "./expression-table.mjs";
import { scanRecallTag, normalizeRecallRequest, RECALL_WORD } from "./recall-tag.mjs";

/** 既知語彙集合（表が正）。 */
const KNOWN_WORDS = new Set(EXPRESSION_WORDS);

/**
 * well-formed タグ 1 個にマッチする正規表現（`<` の位置から試す sticky 版）。
 *  group 1 = word（英字始まり・語/ハイフン）。
 *  group 2 = args（先頭空白 + `<` `>` 以外の任意文字列・任意）。
 * `[^<>]*` により args は次の `<` / `>` を跨がない（壊れ括弧の巻き込み防止）。
 * 各 `<` の位置で順に試すので、旧来の global 版（左端の一致を探す）と同じ結果になる。
 */
const TAG_RE = /<([A-Za-z][\w-]*)(\s[^<>]*)?>/y;

/**
 * 応答テキストを speechText + 演出イベント列（+ 思い出しの目印）へ分離する（純関数）。
 *
 * 記憶の作り直し Wave 3 Domain D: `<recall 頼みごと>` は表情とは別の語彙集合（recall-tag.mjs）として読み、
 * `recalls` に出現順で返す（events には入れない・未知タグの診断にもしない）。`recall` の引数は `<` `>` が
 * 混ざっても中身が声に出ないように広く取る（書式は recall-tag.mjs の scanRecallTag）。閉じていない `<recall`
 * は頼みにせず、行末（など）までを声に出さずに捨て、brokenTag に 1 つ数える。
 * @param {unknown} replyText  LLM 応答（タグ込み・非文字列は空文字扱いで防御）。
 * @returns {{
 *   speechText: string;
 *   events: Array<{ word: string; args?: string; position: number }>;
 *   diagnostics: Array<{ type: string; [k: string]: unknown }>;
 *   recalls: Array<{ request: string; position: number }>;
 * }}
 */
export function parseExpressionTags(replyText) {
  const input = typeof replyText === "string" ? replyText : "";
  /** @type {Array<{ word: string; args?: string; position: number }>} */
  const events = [];
  /** @type {Array<{ type: string; [k: string]: unknown }>} */
  const diagnostics = [];
  /** @type {Array<{ request: string; position: number }>} */
  const recalls = [];

  let speech = "";
  let unclosedRecalls = 0;
  let cursor = 0;
  while (cursor < input.length) {
    const open = input.indexOf("<", cursor);
    if (open < 0) {
      speech += input.slice(cursor);
      break;
    }
    // タグ前の素テキストを積む。
    speech += input.slice(cursor, open);

    const recall = scanRecallTag(input, open, true);
    if (recall && recall.kind === "valid") {
      recalls.push({
        request: normalizeRecallRequest(input.slice(open + RECALL_WORD.length + 1, recall.end)),
        position: open
      });
      cursor = recall.end + 1;
      continue;
    }
    if (recall && recall.kind === "unclosed") {
      // 閉じていない目印: 頼みにせず、声にも出さない。
      unclosedRecalls += 1;
      cursor = recall.end;
      continue;
    }

    TAG_RE.lastIndex = open;
    const match = TAG_RE.exec(input);
    if (match === null) {
      // タグではない `<`: 本文として残し（最後に括弧だけ剥ぐ）、次の文字から探す。
      speech += "<";
      cursor = open + 1;
      continue;
    }
    const word = match[1];
    const argsRaw = match[2];
    cursor = open + match[0].length;

    const args = argsRaw ? argsRaw.trim() : "";
    if (KNOWN_WORDS.has(word)) {
      /** @type {{ word: string; args?: string; position: number }} */
      const event = { word, position: open };
      if (args.length > 0) event.args = args;
      events.push(event);
    } else {
      // 未知タグ: 声にも演出にも出さず、剥離して診断だけ返す。
      diagnostics.push({ type: "unknownTag", tag: word });
    }
  }

  // 壊れ括弧の掃除: well-formed タグ除去後に残る `<` `>` は無条件に剥ぐ（性質不変条件）。
  const strayCount = countStray(speech) + unclosedRecalls;
  if (strayCount > 0) {
    diagnostics.push({ type: "brokenTag", count: strayCount });
    speech = speech.replace(/[<>]/g, "");
  }

  return { speechText: speech, events, diagnostics, recalls };
}

/**
 * 文字列中の `<` `>` の総数を数える。
 * @param {string} s
 * @returns {number}
 */
function countStray(s) {
  let n = 0;
  for (let i = 0; i < s.length; i += 1) {
    const c = s[i];
    if (c === "<" || c === ">") n += 1;
  }
  return n;
}
