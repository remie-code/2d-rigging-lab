import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * C5 追撃 Domain G — 参照ドライバの知覚シナリオ タイムライン検証（driver-only, wave plan §12）。
 *
 * 特区方向ルール厳守: 器（runtime-player）から魂（apps/soul）への相対 import は違反
 * （scripts/check-soul-zone-boundary.mjs ルール1）。よって既存
 * reference-driver-sustained-drive.test.ts と同じ `child_process.spawn` 前例に倣い、
 * ドライバを外部プロセスとして起動する。import は使わない（`import(変数)` 等の回避工作も禁止）。
 *
 * ここでは WS を張らず `--scenario=perceptual --print-timeline`（URL 不要）で dry-run させ、
 * stdout の 1 行 timeline JSON を parse して検証する。実時間待ち・WS 無し = 非 flaky。
 * 検証: envelope 主体・各 envelope の attackMs が [200,400]・四つの節の順序
 * （表情ピーク→重ねがけ(同一スロット)→body 長 sustain→意図的 kill）。
 */

const DRIVER_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../../soul/reference-driver/reference-driver.mjs"
);

const PERCEPTUAL_ATTACK_MIN_MS = 200;
const PERCEPTUAL_ATTACK_MAX_MS = 400;

type TimelineSection = {
  section: string;
  kind: string;
  slotId: string | null;
  peak?: number;
  attackMs?: number;
  sustainMs?: number;
  decayMs?: number;
  ttlMs?: number | null;
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

function requireSection(
  sections: readonly TimelineSection[],
  index: number
): TimelineSection {
  const section = sections[index];
  if (section === undefined) {
    throw new Error(`expected a timeline section at index ${index}`);
  }
  return section;
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

describe("Reference driver perceptual scenario timeline (C5 追撃 Domain G)", () => {
  it(
    "prints an envelope-led perceptual timeline (dry-run, no WS): peaks→re-attack→body→kill",
    async () => {
      const result = await runDriverPrintTimeline([
        "--scenario=perceptual",
        "--print-timeline"
      ]);

      // Dry-run exits 0 with no URL (WS never connected).
      expect(result.code, `driver stderr:\n${result.stderr}`).toBe(0);
      const timeline = parseTimeline(result.stdout);
      expect(timeline.kind).toBe("reference-driver-timeline");
      expect(timeline.scenario).toBe("perceptual");

      const sections = timeline.sections;
      const envelopes = sections.filter(
        (section) => section.kind === "intent.envelope"
      );

      // ── envelope 主体: no coarse intent.set in the perceptual scenario, ≥3 envelopes. ──
      expect(envelopes.length).toBeGreaterThanOrEqual(3);
      expect(sections.some((section) => section.kind === "intent.set")).toBe(false);

      // ── attack 200〜400ms（知覚向けの現実的な立ち上がり）。 ─────────────────────
      for (const envelope of envelopes) {
        expect(envelope.attackMs).toBeGreaterThanOrEqual(PERCEPTUAL_ATTACK_MIN_MS);
        expect(envelope.attackMs).toBeLessThanOrEqual(PERCEPTUAL_ATTACK_MAX_MS);
      }

      // ── 四つの節の順序（表情ピーク→重ねがけ→body 長 sustain→意図的 kill）。 ──────
      expect(sections.map((section) => section.section)).toStrictEqual([
        "expression-peak",
        "layering-reattack",
        "body-sustain",
        "intentional-kill"
      ]);

      const expressionPeak = requireSection(sections, 0);
      const layeringReattack = requireSection(sections, 1);
      const bodySustain = requireSection(sections, 2);
      const intentionalKill = requireSection(sections, 3);

      // ① 表情ピーク: envelope。
      expect(expressionPeak.kind).toBe("intent.envelope");

      // ② 重ねがけ: 同一スロットへの符号反転 re-attack。
      expect(layeringReattack.kind).toBe("intent.envelope");
      expect(layeringReattack.slotId).toBe(expressionPeak.slotId);
      expect(Math.sign(layeringReattack.peak ?? 0)).not.toBe(
        Math.sign(expressionPeak.peak ?? 0)
      );

      // ③ body 長 sustain: 他の節より長い sustain（切断時にまだ生存する尺）。
      expect(bodySustain.kind).toBe("intent.envelope");
      expect(bodySustain.sustainMs ?? 0).toBeGreaterThan(expressionPeak.sustainMs ?? 0);
      expect(bodySustain.sustainMs ?? 0).toBeGreaterThan(layeringReattack.sustainMs ?? 0);

      // ④ 意図的 kill: body 駆動中の切断。
      expect(intentionalKill.kind).toBe("disconnect");
    },
    15_000
  );
});
