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
 *  - Discord モード Domain C（discord-mode.md §3.4）:
 *    - 本文の印（`{{records}}` など）は、読み込むときに場の語の組で差す（venue-wording.mjs の applyVenueWording）。語の組を
 *      渡さなければ配信の語（`skills/recall.md` は今の本文と一字も違わない）。
 *    - 体験ごとの短い教え（①の固定の部分の最後・思い出すの教えのあと）を足す口: 教えのファイルは `skills/venue-<体験の種類>.md`
 *      （例 `skills/venue-discord.md`。名前の決まりは venueTeachingName）。どの教えを足すかは体験の口の teaching（教えの名前・
 *      配信は null）で選ぶ（soulSkillNamesForVenue）。配信では何も足さない（①の固定の指示は一字も変わらない）。
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { applyVenueWording, resolveVenueWording } from "./venue-wording.mjs";

const here = dirname(fileURLToPath(import.meta.url));

/** 教えのファイルの置き場（apps/soul/agent/skills/）。 */
export const SOUL_SKILLS_DIR = join(here, "..", "..", "skills");

/**
 * ①に足す教え（並び順に足す）。expression（表情タグ 6 語の使い方）と screen（画面が渡されること）は、もとは会話指示の
 * 既定に入っていた仕組みの教え（応答の遅れの直し・latency-fix-plan.md §2-4 で切り分け）。並びはもとの指示の順
 * （表情 → 画面 → 思い出す）に合わせる。
 */
export const SOUL_SKILL_NAMES = Object.freeze(["expression", "screen", "recall"]);

/**
 * ロールの体の有無に合わせて①に足す教えの名前（配信の組み直し Domain C・stream-restructure.md §4）。体が無い
 * ロールには表情タグの教え（expression）を渡さない（器が無く、タグは剥がして捨てるため）。体があれば今どおり全部。
 * 教えの本文は変えない（渡すかどうかだけ）。
 * @param {unknown} body  ロールの `body`（false だけを「体なし」と読む）。
 * @returns {ReadonlyArray<string>}
 */
export function soulSkillNamesForBody(body) {
  return body === false ? SOUL_SKILL_NAMES.filter((name) => name !== "expression") : SOUL_SKILL_NAMES;
}

/** 体験ごとの教えのファイル名の頭（`skills/venue-<体験の種類>.md`）。 */
export const VENUE_TEACHING_PREFIX = "venue-";

/** 体験ごとの教えの名前の形（`venue-` + 小文字の英数字とハイフン。パスの区切りや `..` を含めない）。 */
const VENUE_TEACHING_NAME_PATTERN = /^venue-[a-z][a-z0-9-]*$/;

/**
 * 体験の種類 → その体験の教えの名前（名前の決まり: `venue-<体験の種類>`。ファイルは `skills/venue-<体験の種類>.md`）。
 * 配信（"stream"）は教えを持たない（null）。形の崩れた種類も null。体験の口（Discord は Domain F）は teaching にこの名前を置く。
 * @param {unknown} experience
 * @returns {string | null}
 */
export function venueTeachingName(experience) {
  if (typeof experience !== "string" || experience === "stream") return null;
  const name = `${VENUE_TEACHING_PREFIX}${experience}`;
  return VENUE_TEACHING_NAME_PATTERN.test(name) ? name : null;
}

/**
 * 体験の教えの名前として使えるか（`venue-` で始まる決まりの形）。
 * @param {unknown} name
 * @returns {name is string}
 */
export function isVenueTeachingName(name) {
  return typeof name === "string" && VENUE_TEACHING_NAME_PATTERN.test(name);
}

/**
 * ロールの体の有無と場の体験の教えに合わせて①に足す教えの名前（Discord モード Domain C）。体の有無で選ぶ名前
 * （soulSkillNamesForBody）の最後（思い出すの教えのあと）に、体験の教えを 1 つ足す。teaching が無い（配信・場が閉じている）
 * ときは soulSkillNamesForBody と同じもの（同じ配列）を返す＝配信では何も足さない。
 * @param {{ body?: unknown; teaching?: unknown }} [p]
 * @returns {ReadonlyArray<string>}
 */
export function soulSkillNamesForVenue({ body, teaching } = {}) {
  const base = soulSkillNamesForBody(body);
  if (teaching == null) return base;
  if (!isVenueTeachingName(teaching)) {
    throw new TypeError(`soulSkillNamesForVenue: teaching must be a venue teaching name (venue-<experience>); got ${String(teaching)}.`);
  }
  return Object.freeze([...base, teaching]);
}

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
 * 本文の印（`{{records}}` など）は場の語の組で差す（Discord モード Domain C。wording を渡さなければ配信の語）。
 * @param {object} [options]
 * @param {string} [options.dir=SOUL_SKILLS_DIR]
 * @param {ReadonlyArray<string>} [options.names=SOUL_SKILL_NAMES]
 * @param {unknown} [options.wording]  場の語の組（venue-wording.mjs）。null / undefined は配信の語の組。
 * @param {(path: string) => string} [options.readFileImpl]  テスト注入（既定 readFileSync utf8）。
 * @param {(warning: string) => void} [options.onWarning]
 * @returns {Array<{ name: string; path: string; body: string }>}  本文が空のものは含めない。
 */
export function listSoulSkills(options = {}) {
  const dir = options.dir ?? SOUL_SKILLS_DIR;
  const names = options.names ?? SOUL_SKILL_NAMES;
  const readFileImpl = options.readFileImpl ?? ((/** @type {string} */ p) => readFileSync(p, "utf8"));
  // 語の組の形の崩れは読めない教えとは別に投げる（黙って配信の語に混ぜない・教えを落とさない）。
  const wording = resolveVenueWording(options.wording);
  /** @type {Array<{ name: string; path: string; body: string }>} */
  const skills = [];
  for (const name of names) {
    try {
      const body = applyVenueWording(stripSkillFrontmatter(readFileImpl(join(dir, `${name}.md`))), wording);
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
 * @param {unknown} [options.wording]  場の語の組（listSoulSkills と同じ）。
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
