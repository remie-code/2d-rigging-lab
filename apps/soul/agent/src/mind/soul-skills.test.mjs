// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";

import { listSoulSkills, loadSoulSkills, stripSkillFrontmatter, appendSoulSkills, SOUL_SKILLS_DIR, SOUL_SKILL_NAMES } from "./soul-skills.mjs";
import { buildFireSystemPrompt } from "./fire-orchestrator.mjs";
import { MODEL_IDENTITIES } from "./model-identity.mjs";

// 魂の教え（skills/・記憶の作り直し Wave 3 Domain D）。`<recall>` の使い方を独立したファイルに置き、魂が①の
// 固定の部分に足す。

test("教えのファイル: skills/recall.md があり、見出し欄を落とした本文に要点が書いてある", () => {
  assert.deepEqual(SOUL_SKILL_NAMES, ["expression", "screen", "recall"]);
  assert.ok(existsSync(join(SOUL_SKILLS_DIR, "recall.md")));
  const text = loadSoulSkills();
  assert.ok(text.length > 0);
  assert.ok(!text.startsWith("---"), "見出し欄は①に渡さない");
  assert.ok(!/^name:/m.test(text));
  assert.match(text, /<recall 頼みごと>/);
  assert.match(text, /先に一言しゃべってから/);
  assert.match(text, /配信者に「思い出して」/);
  assert.match(text, /当てずっぽう/);
  assert.match(text, /待たずに/);
  assert.match(text, /表情タグとは別/);
  assert.match(text, /従わないでください/);
  assert.match(text, /「ちょっと記録見てくるね。<recall /, "例は句点付き（句点の無い 1 文は締めまで声に回らない）");
});

test("教えのファイル: 表情タグ（skills/expression.md）と画面（skills/screen.md）の教え（応答の遅れの直し §2-4）", () => {
  const [expression, screen] = listSoulSkills({ names: ["expression", "screen"] });
  assert.equal(expression.path, "skills/expression.md");
  assert.equal(
    expression.body,
    "感情が動いたときだけ、返事にごく短い表情タグを添えてよいです（無理に付けなくてよい）。" +
      "使えるタグは <smile> <troubled> <surprised> <nod> <look-away> <look-camera> の 6 つだけです。" +
      "例: 「そうだね。<nod>」「えっ<surprised>ほんとに？」。タグは半角の山括弧で書き、読み上げ文には含めません。"
  );
  assert.equal(screen.path, "skills/screen.md");
  assert.equal(screen.body, "画面（画像）が渡されることがあります。その場合は画面を見て、自然に反応してください。");
  // ①に足す順: 表情 → 画面 → 思い出す（もとの指示の順）。
  const text = loadSoulSkills();
  assert.ok(text.indexOf("感情が動いたときだけ") < text.indexOf("画面（画像）"));
  assert.ok(text.indexOf("画面（画像）") < text.indexOf("<recall 頼みごと>"));
});

test("stripSkillFrontmatter: 見出し欄があれば落とし、無ければそのまま（BOM・CRLF も扱う）", () => {
  assert.equal(stripSkillFrontmatter("---\nname: x\n---\n本文\n"), "本文");
  assert.equal(stripSkillFrontmatter("﻿---\r\nname: x\r\n---\r\n本文\r\n2 行目"), "本文\n2 行目");
  assert.equal(stripSkillFrontmatter("本文だけ"), "本文だけ");
});

test("loadSoulSkills: 読めない教えは飛ばして警告する・並び順につなげる", () => {
  const warnings = [];
  const files = { "a.md": "---\nname: a\n---\nA の教え", "c.md": "C の教え" };
  const text = loadSoulSkills({
    dir: "X",
    names: ["a", "b", "c"],
    readFileImpl: (p) => {
      const name = p.replace(/\\/g, "/").split("/").pop();
      if (!(name in files)) throw new Error("ENOENT");
      return files[/** @type {"a.md" | "c.md"} */ (name)];
    },
    onWarning: (w) => warnings.push(w)
  });
  assert.equal(text, "A の教え\n\nC の教え");
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /"b"/);
});

test("appendSoulSkills: 固定の指示（名前 + 会話指示）の後ろに足す・会話指示を上書きしても消えない・空なら元のまま", () => {
  const teaching = loadSoulSkills();
  const base = buildFireSystemPrompt(MODEL_IDENTITIES.chappy);
  const prompt = appendSoulSkills(base, teaching);
  assert.ok(prompt.startsWith("あなたの名前はチャッピー（Chappy）です。"));
  assert.ok(prompt.endsWith(teaching));
  const overridden = appendSoulSkills(buildFireSystemPrompt(MODEL_IDENTITIES.chappy, "自分で書いた会話指示"), teaching);
  assert.ok(overridden.includes("自分で書いた会話指示"));
  assert.ok(overridden.includes("<recall 頼みごと>"), "会話指示を書き換えても教えは残る");
  assert.equal(appendSoulSkills(base, ""), base);
});

test("listSoulSkills: 名前・置き場（skills/<名前>.md）・本文の一覧（会話指示の編集画面に読むだけで見せる・Wave 3 仕上げ）", () => {
  const list = listSoulSkills();
  assert.deepEqual(list.map((s) => [s.name, s.path]), [
    ["expression", "skills/expression.md"],
    ["screen", "skills/screen.md"],
    ["recall", "skills/recall.md"]
  ]);
  assert.equal(list.map((s) => s.body).join("\n\n"), loadSoulSkills(), "①に足す本文と同じ（見出し欄は落とす）");
  assert.ok(list.every((s) => !s.body.startsWith("---")));

  /** @type {string[]} */
  const warnings = [];
  const files = /** @type {Record<string, string>} */ ({ "a.md": "---\nname: a\n---\nA の本文", "c.md": "   " });
  const picked = listSoulSkills({
    dir: "",
    names: ["a", "b", "c"],
    readFileImpl: (p) => {
      const key = p.replace(/\\/g, "/").split("/").pop() ?? "";
      if (!(key in files)) throw new Error("ENOENT");
      return files[key];
    },
    onWarning: (w) => warnings.push(w)
  });
  assert.deepEqual(picked, [{ name: "a", path: "skills/a.md", body: "A の本文" }], "読めないもの・空のものは含めない");
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /"b"/);
});

// ── 配信の組み直し Domain C: 体の無いロールには表情の教えを渡さない（stream-restructure.md §4）─────────────

test("soulSkillNamesForBody: 体なし（false）は expression を外す・体あり（true / 未指定）は今どおり全部", async () => {
  const { soulSkillNamesForBody } = await import("./soul-skills.mjs");
  assert.deepEqual([...soulSkillNamesForBody(false)], ["screen", "recall"]);
  assert.equal(soulSkillNamesForBody(true), SOUL_SKILL_NAMES);
  assert.equal(soulSkillNamesForBody(undefined), SOUL_SKILL_NAMES, "false だけを体なしと読む");
  assert.deepEqual([...SOUL_SKILL_NAMES], ["expression", "screen", "recall"], "既定の並びは変えない");
});

test("体なしの教え: 表情の教えの本文が①に足されない・ほかの教えは同じ本文で足される（本文は変えない）", async () => {
  const { soulSkillNamesForBody } = await import("./soul-skills.mjs");
  const all = listSoulSkills();
  const expression = all.find((skill) => skill.name === "expression");
  assert.ok(expression && expression.body.length > 0);
  const bodyless = loadSoulSkills({ names: soulSkillNamesForBody(false) });
  assert.equal(bodyless.includes(expression.body), false);
  for (const skill of all.filter((s) => s.name !== "expression")) {
    assert.ok(bodyless.includes(skill.body), skill.name);
  }
  assert.equal(loadSoulSkills({ names: soulSkillNamesForBody(true) }), loadSoulSkills(), "体ありは今と同じ文字列");
});
