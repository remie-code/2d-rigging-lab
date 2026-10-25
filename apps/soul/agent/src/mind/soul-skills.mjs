// @ts-check
/**
 * 魂が①（会話のセッション）の固定の指示に足す「教え」（記憶の作り直し Wave 3 Domain D）— apps/soul/agent。
 *
 * 上位文書: [recall-flow.md](../../../../discussion/ai-cohost/memory/recall-flow.md) §7（`<recall>` の教え方）。
 *
 *  - 教えは機能ごとに 1 ファイル（スキル風）で `apps/soul/agent/skills/<名前>.md` に置く。言い回しはファイルを
 *    直すだけで変えられる（読み込みはセッションを作るたび。次に作るセッションから効く）。
 *  - 先頭の `---` で囲んだ見出し欄（name / description）は人のためのもので、①には渡さない（本文だけ）。
 *  - 魂が「名前の一文」と同じ扱いで固定の部分に足す（会話指示ではない）。会話指示を書き換えても消えない。
 *    固定の指示は会話の最初に 1 回だけ渡り（圧縮後にもう 1 回）、返事ごとには積み増されない。
 *  - ファイルが読めなければ、その教えは足さずに警告を 1 回出す（会話は続ける）。
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

/** 教えのファイルの置き場（apps/soul/agent/skills/）。 */
export const SOUL_SKILLS_DIR = join(here, "..", "..", "skills");

/** ①に足す教え（並び順に足す）。 */
export const SOUL_SKILL_NAMES = Object.freeze(["recall"]);

/**
 * 先頭の見出し欄（`---` で囲んだ部分）を落として本文だけにする。
 * @param {string} text
 * @returns {string}
 */
export function stripSkillFrontmatter(text) {
  const normalized = String(text).replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  const m = /^---\n[\s\S]*?\n---\n?/.exec(normalized);
  return (m ? normalized.slice(m[0].length) : normalized).trim();
}

/**
 * 教えのファイルを読み、名前・置き場（apps/soul/agent からの相対）・本文の一覧を返す（読めないものは飛ばして onWarning）。
 * ①に足すもの（loadSoulSkills）と、会話指示の編集画面に読むだけで見せるもの（Wave 3 仕上げ）はこの一覧から作る。
 * @param {object} [options]
 * @param {string} [options.dir=SOUL_SKILLS_DIR]
 * @param {ReadonlyArray<string>} [options.names=SOUL_SKILL_NAMES]
 * @param {(path: string) => string} [options.readFileImpl]  テスト注入（既定 readFileSync utf8）。
 * @param {(warning: string) => void} [options.onWarning]
 * @returns {Array<{ name: string; path: string; body: string }>}  本文が空のものは含めない。
 */
export function listSoulSkills(options = {}) {
  const dir = options.dir ?? SOUL_SKILLS_DIR;
  const names = options.names ?? SOUL_SKILL_NAMES;
  const readFileImpl = options.readFileImpl ?? ((/** @type {string} */ p) => readFileSync(p, "utf8"));
  /** @type {Array<{ name: string; path: string; body: string }>} */
  const skills = [];
  for (const name of names) {
    try {
      const body = stripSkillFrontmatter(readFileImpl(join(dir, `${name}.md`)));
      if (body.length > 0) skills.push({ name, path: `skills/${name}.md`, body });
    } catch {
      try {
        options.onWarning?.(`soul-skills: could not read the "${name}" teaching; it is not added to the session prompt.`);
      } catch {
        // 通知先の失敗は無視。
      }
    }
  }
  return skills;
}

/**
 * 教えのファイルを読み、本文をつなげて返す（読めないものは飛ばして onWarning）。
 * @param {object} [options]
 * @param {string} [options.dir=SOUL_SKILLS_DIR]
 * @param {ReadonlyArray<string>} [options.names=SOUL_SKILL_NAMES]
 * @param {(path: string) => string} [options.readFileImpl]  テスト注入（既定 readFileSync utf8）。
 * @param {(warning: string) => void} [options.onWarning]
 * @returns {string}  教えが 1 つも無ければ空文字。
 */
export function loadSoulSkills(options = {}) {
  return listSoulSkills(options)
    .map((skill) => skill.body)
    .join("\n\n");
}

/**
 * 固定の指示（名前の一文 + 会話指示）の後ろに教えを足す。教えが空なら元のまま。
 * @param {string} prompt
 * @param {string} skillsText
 * @returns {string}
 */
export function appendSoulSkills(prompt, skillsText) {
  const skills = typeof skillsText === "string" ? skillsText.trim() : "";
  return skills.length > 0 ? `${prompt}\n\n${skills}` : prompt;
}
