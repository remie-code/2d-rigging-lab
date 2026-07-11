import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import type { RuntimePlayerLiveParameterFrame } from "../../preload/live-parameter-bridge-contract";
import type {
  RuntimePlayerMappingSlot,
  RuntimePlayerMappingSlotId
} from "../../preload/model-mapping-bridge-contract";
import type { RuntimeExportLoadedPayload } from "../../preload/runtime-export-bridge-contract";
import type { PhysiologyGenerator } from "../physiology";
import {
  createAutonomousFrameHeart,
  type AutonomousFrameHeart
} from "../role-composition/autonomous-frame-heart";
import { RuntimePlayerControlChannelServer } from "./channel-server";
import { RuntimePlayerControlChannelOverlayStore } from "./control-channel-overlay-store";
import { createControlChannelWebSocketUrl } from "./channel-url";

/**
 * C4 Domain D — 持続駆動の機械テスト（wave plan §6 / §8）。
 *
 * 特区 `apps/soul` の参照ドライバ（依存ゼロ `.mjs`）を `child_process.spawn` で外部プロセス
 * として起動し、Domain A の `RuntimePlayerControlChannelServer` へ WS で繋がせ、シナリオ
 * （注視 → 傾げ → 沈黙 → 再開 → 意図的切断 → 再接続）を流す。器側では Domain B の心臓
 * （オーバーレイ第二 provider を配線した frame heart）を実時計で回し、published frame を観測する。
 *
 * これが実証する「縦の貫通」: 外部プロセス → WS → token 認証 → 契約検証 → overlay → heart で
 * `head-horizontal`（fixture の face.angle.x 相当）が動く、を最初から最後まで通す。
 *
 * flaky 対策: シナリオは実時間を数百 ms に圧縮（ドライバ側の位相定数）。port は 0（ephemeral）
 * で競合回避。閾値は緩い（RTT p95 < 100ms・フレーム前進 > 20）。
 */

const DRIVER_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../../soul/reference-driver/reference-driver.mjs"
);

const TEST_TOKEN = "channel_token_sustained_drive_0123456789";
// centered head-horizontal (-1..1). The witness slot: the generator baseline is 0,
// so any non-zero published value on this parameter came THROUGH the channel overlay.
const HEAD_HORIZONTAL_PARAM = "ParamAngleX";

const runningServers: RuntimePlayerControlChannelServer[] = [];
const runningHearts: AutonomousFrameHeart[] = [];

afterEach(async () => {
  for (const heart of runningHearts.splice(0)) {
    heart.stop();
  }
  await Promise.all(runningServers.splice(0).map((server) => server.close()));
});

function makePayload(): RuntimeExportLoadedPayload {
  return {
    summary: { packageId: "pkg-sustained", packageRevision: 1 },
    loadedAtIso: "2026-07-11T00:00:00.000Z"
  } as unknown as RuntimeExportLoadedPayload;
}

function centeredSlot(
  slotId: RuntimePlayerMappingSlotId,
  parameterId: string
): RuntimePlayerMappingSlot {
  return {
    slotId,
    label: slotId,
    group: "head",
    target: { parameterId, displayName: parameterId, min: -30, max: 30, default: 0 },
    enabled: true,
    invert: false,
    strength: 1,
    status: "mapped",
    warningMessages: []
  };
}

function weightSlot(
  slotId: RuntimePlayerMappingSlotId,
  parameterId: string
): RuntimePlayerMappingSlot {
  return {
    slotId,
    label: slotId,
    group: "eyes",
    target: { parameterId, displayName: parameterId, min: 0, max: 1, default: 0 },
    enabled: true,
    invert: false,
    strength: 1,
    status: "mapped",
    warningMessages: []
  };
}

// Every slotId the reference-driver scenario touches must be writable, else the
// server would reject with slotNotWritable and the drive would not be clean.
const SCENARIO_SLOTS: readonly RuntimePlayerMappingSlot[] = [
  centeredSlot("head-horizontal", HEAD_HORIZONTAL_PARAM),
  centeredSlot("head-tilt", "ParamAngleZ"),
  centeredSlot("gaze-horizontal", "ParamEyeBallX"),
  centeredSlot("gaze-vertical", "ParamEyeBallY"),
  weightSlot("eye-blink-left", "ParamEyeLOpen")
];

/**
 * A deterministic generator whose only baseline output is head-horizontal = 0.
 * With this baseline the witness parameter (ParamAngleX) resolves to exactly 0
 * unless a channel overlay overrides head-horizontal — making any non-zero value
 * on that parameter unambiguous proof the external drive reached the frame.
 */
function baselineGenerator(): PhysiologyGenerator {
  return {
    behaviorIds: ["blink"],
    sample: () => ({ "head-horizontal": 0 })
  };
}

type DriverReport = {
  kind: string;
  intentCount: number;
  acceptedCount: number;
  rejectedCount: number;
  reconnected: boolean;
  contractSource: string;
  rttMs: { count: number; p50: number; p95: number; max: number; mean: number };
  gate: { p95BudgetMs: number; p95WithinBudget: boolean };
};

function runReferenceDriver(url: string): Promise<{
  code: number | null;
  stdout: string;
  stderr: string;
}> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [DRIVER_PATH, url], {
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

function parseDriverReport(stdout: string): DriverReport {
  const line = stdout
    .split(/\r?\n/)
    .reverse()
    .find((candidate) => candidate.includes('"reference-driver-report"'));
  if (line === undefined) {
    throw new Error(`No reference-driver report on stdout. stdout was:\n${stdout}`);
  }
  return JSON.parse(line) as DriverReport;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("Reference driver sustained drive (C4 Domain D)", () => {
  it(
    "drives head-horizontal through WS→overlay→heart, survives disconnect/reconnect, keeps frames flowing, and meets the RTT p95 budget",
    async () => {
      const store = new RuntimePlayerControlChannelOverlayStore();

      const frames: RuntimePlayerLiveParameterFrame[] = [];
      const heart = createAutonomousFrameHeart({
        liveParameters: { publishFrame: (frame) => frames.push(frame) },
        frameIntervalMs: 16,
        createGenerator: () => baselineGenerator(),
        getChannelOverlay: (nowMs) => store.snapshot(nowMs)
      });
      runningHearts.push(heart);

      const server = new RuntimePlayerControlChannelServer({
        overlayStore: store,
        token: TEST_TOKEN,
        port: 0,
        getCurrentSlots: () => SCENARIO_SLOTS
      });
      runningServers.push(server);
      const state = await server.open();
      if (state.kind !== "open") {
        throw new Error("Channel server failed to open for the sustained-drive test.");
      }
      const url = createControlChannelWebSocketUrl({
        port: state.port,
        token: TEST_TOKEN
      });

      // Start the heart and let it settle a few ticks to capture a clean baseline
      // BEFORE any client connects.
      heart.start({ payload: makePayload(), slots: SCENARIO_SLOTS, seed: 7 });
      await delay(120);
      const baselineSequence = frames.at(-1)?.sequence ?? 0;
      // Baseline witness parameter is exactly 0 (generator head-horizontal = 0).
      expect(frames.at(-1)?.parameterValues[HEAD_HORIZONTAL_PARAM] ?? 0).toBe(0);

      // Drive the scenario from the external process.
      const result = await runReferenceDriver(url);

      // Let the heart tick a few more times after the driver disconnects so the
      // post-clearAll baseline is observed.
      await delay(120);
      heart.stop();

      // ── The driver completed its scenario cleanly. ────────────────────────
      expect(result.code, `driver stderr:\n${result.stderr}`).toBe(0);
      const report = parseDriverReport(result.stdout);
      expect(report.kind).toBe("reference-driver-report");
      expect(report.reconnected).toBe(true);
      expect(report.intentCount).toBe(8);
      expect(report.acceptedCount).toBe(8);
      expect(report.rejectedCount).toBe(0);
      // The driver read the real contract JSON (契約=正) rather than the fallback.
      expect(report.contractSource).toBe("contract-json");

      // ── RTT p95 budget (裁定 7): p95 < 100ms on loopback. ─────────────────
      expect(report.rttMs.count).toBe(8);
      expect(report.rttMs.p95).toBeLessThan(100);
      expect(report.gate.p95WithinBudget).toBe(true);

      // ── No frame stall: the heart kept beating throughout the drive. ──────
      const finalSequence = frames.at(-1)?.sequence ?? 0;
      expect(finalSequence - baselineSequence).toBeGreaterThan(20);
      let previousSequence = -1;
      for (const frame of frames) {
        expect(frame.sequence).toBeGreaterThan(previousSequence);
        previousSequence = frame.sequence;
      }

      // ── 縦の貫通: an intent moved head-horizontal on a published frame. ────
      // Scenario sends head-horizontal=0.5 (ttl 600) → centered maps to +15 on a
      // -30..30 target. Baseline would be 0, so a value ≥ 5 can only be the overlay.
      const movedFrames = frames.filter(
        (frame) => (frame.parameterValues[HEAD_HORIZONTAL_PARAM] ?? 0) >= 5
      );
      expect(movedFrames.length).toBeGreaterThan(0);

      // ── 切断→基底復帰: after the driver disconnected, the body fell back. ──
      expect(frames.at(-1)?.parameterValues[HEAD_HORIZONTAL_PARAM] ?? 0).toBe(0);
    },
    30_000
  );
});
