import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { InputProfileStore } from "./input-profiles/input-profile-store";
import { RuntimePlayerInputSessionState } from "./input-session-state";

const sampleFrame =
  "jawOpen-50|mouthSmile_L-20|mouthSmile_R-40|=head#1,2,3,4,5,6|rightEye#7,8,9|leftEye#10,11,12|";

describe("Look Forward session neutral", () => {
  it("is unavailable until a tracking frame exists", () => {
    const state = new RuntimePlayerInputSessionState({
      nowMs: () => 1000,
      getLocalIpCandidates: () => []
    });

    expect(state.captureLookForward()).toEqual({
      result: "unavailable",
      message: "Look Forward needs a received tracking frame."
    });
  });

  it("captures latest tracking frame without writing an input profile", async () => {
    const userDataPath = await mkdtemp(
      path.join(os.tmpdir(), "runtime-player-look-forward-")
    );
    const store = new InputProfileStore({ userDataPath });
    const state = new RuntimePlayerInputSessionState({
      nowMs: () => 2000,
      getLocalIpCandidates: () => []
    });
    state.setListening({
      source: "ifacialmocap",
      transport: "udp",
      receivePort: 49983
    });
    state.recordReceivedFrame({
      rawFrame: sampleFrame,
      remote: {
        address: "127.0.0.1",
        port: 49983
      },
      receivedAtMs: 1500
    });

    const result = state.captureLookForward(2500);

    expect(result).toMatchObject({
      result: "captured",
      neutral: {
        capturedAtIso: "1970-01-01T00:00:02.500Z",
        frameTimestampMs: 1500,
        headRotationEulerDeg: { x: 1, y: 2, z: 3 },
        leftEyeEulerDeg: { x: 10, y: 11, z: 12 },
        rightEyeEulerDeg: { x: 7, y: 8, z: 9 },
        jawOpen: 0.5
      }
    });
    expect(result.result === "captured" ? result.neutral.mouthSmile : null)
      .toBeCloseTo(0.3);
    await expect(readFile(store.getProfileFilePath(), "utf8")).rejects.toMatchObject({
      code: "ENOENT"
    });
  });
});
