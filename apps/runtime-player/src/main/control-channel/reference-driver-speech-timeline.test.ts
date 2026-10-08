import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * C6 Domain B — 参照ドライバの発話シナリオ タイムライン検証（driver-only, wave plan §6）。
 *
 * 特区方向ルール厳守: 器（runtime-player）から魂（apps/soul）への相対 import は違反
 * （scripts/check-soul-zone-boundary.mjs ルール1）。よって reference-driver-perceptual-
 * timeline.test.ts / reference-driver-sustained-drive.test.ts と同じ `child_process.spawn`
 * 前例に倣い、ドライバを外部プロセスとして起動する。import は使わない（`import(変数)` 等の
 * 回避工作も禁止）。
 *
 * WS を張らず `--scenario=speech --print-timeline`（URL 不要）で dry-run させ、stdout の
 * 1 行 timeline JSON を parse して検証する。実時間待ち・WS 無し = 非 flaky。
 * 検証: 一発話=一 intent.speech 節、fixture フレーズ「これじっさいのところどうなってるの」の
 * 15 モーラ（母音列 o,e,i,a,i / o,o,o,o,o / u,a,e,u,o、「のところど」= o×5 連続）、timeMs 単調増加、
 * s は 0.5〜0.9。
 */

const DRIVER_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../../soul/reference-driver/reference-driver.mjs"
);

const EXPECTED_VOWELS = [
  "o",
  "e",
  "i",
  "a",
  "i",
  "o",
  "o",
  "o",
  "o",
  "o",
  "u",
  "a",
  "e",
  "u",
  "o"
];

type SpeechMora = {
  timeMs: number;
  vowel: string;
  s: number;
};

type TimelineSection = {
  section: string;
  kind: string;
  slotId: string | null;
  timeline?: SpeechMora[];
};

type DriverTimeline = {
  kind: string;
  version: number;
  scenario: string;
  sections: TimelineSection[];
};

function runDriverPrintTimeline(args: readonly string[]): Promise<{
  code: number | null;
  stdout: string;
  stderr: string;
}> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [DRIVER_PATH, ...args], {
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      resolve({ code, stdout, stderr });
    });
  });
}

function parseTimeline(stdout: string): DriverTimeline {
  const line = stdout
    .split(/\r?\n/)
    .reverse()
    .find((candidate) => candidate.includes('"reference-driver-timeline"'));
  if (line === undefined) {
    throw new Error(`No reference-driver timeline on stdout. stdout was:\n${stdout}`);
  }
  return JSON.parse(line) as DriverTimeline;
}

describe("Reference driver speech scenario timeline (C6 Domain B)", () => {
  it(
    "prints the fixture mora timeline for 「これじっさいのところどうなってるの」 (dry-run, no WS)",
    async () => {
      const result = await runDriverPrintTimeline([
        "--scenario=speech",
        "--print-timeline"
      ]);

      // Dry-run exits 0 with no URL (WS never connected).
      expect(result.code, `driver stderr:\n${result.stderr}`).toBe(0);
      const timeline = parseTimeline(result.stdout);
      expect(timeline.kind).toBe("reference-driver-timeline");
      expect(timeline.scenario).toBe("speech");

      // 一発話 = 一 intent.speech 節。
      expect(timeline.sections).toHaveLength(1);
      const section = timeline.sections[0];
      if (section === undefined) {
        throw new Error("expected a speech section");
      }
      expect(section.kind).toBe("intent.speech");
      expect(section.slotId).toBeNull();

      const moras = section.timeline ?? [];
      // 15 モーラ（促音「っ」省略）。
      expect(moras).toHaveLength(EXPECTED_VOWELS.length);

      // 母音列が fixture フレーズと一致（音素→母音写像の作成例）。
      expect(moras.map((mora) => mora.vowel)).toStrictEqual(EXPECTED_VOWELS);

      // 「のところど」= o×5 連続（再調音ディップの試金石）。
      expect(moras.slice(5, 10).map((mora) => mora.vowel)).toStrictEqual([
        "o",
        "o",
        "o",
        "o",
        "o"
      ]);

      // timeMs は単調増加、s は器の縮小前の開き強度 0.5〜0.9。
      let previous = -Infinity;
      for (const mora of moras) {
        expect(mora.timeMs).toBeGreaterThan(previous);
        previous = mora.timeMs;
        expect(mora.s).toBeGreaterThanOrEqual(0.5);
        expect(mora.s).toBeLessThanOrEqual(0.9);
      }
    },
    15_000
  );
});
