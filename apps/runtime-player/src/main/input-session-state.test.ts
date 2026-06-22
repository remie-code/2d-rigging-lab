import { describe, expect, it } from "vitest";

import { RuntimePlayerInputSessionState } from "./input-session-state";

const sampleFrame =
  "jawOpen-50|mouthSmile_L-25|=head#1,2,3,4,5,6|rightEye#7,8,9|leftEye#10,11,12|";

function createState(nowMs: () => number): RuntimePlayerInputSessionState {
  return new RuntimePlayerInputSessionState({
    nowMs,
    getLocalIpCandidates: () => ["192.168.1.20"]
  });
}

describe("Runtime Player input session state", () => {
  it("starts idle with the default UDP receiver status", () => {
    const state = createState(() => 0);

    expect(state.getStatus()).toMatchObject({
      source: "ifacialmocap",
      sourceLabel: "iFacialMocap",
      transport: "udp",
      transportLabel: "UDP",
      receivePort: 49983,
      connectionState: "idle",
      localIpCandidates: ["192.168.1.20"],
      packetCount: 0,
      diagnostics: {}
    });
  });

  it("records passive listening without a handshake attempt", () => {
    const state = createState(() => 1000);

    const status = state.setListening({
      source: "ifacialmocap",
      transport: "udp",
      receivePort: 49983
    });

    expect(status.connectionState).toBe("listening");
    expect(status.diagnostics).toEqual({
      updatedAtIso: "1970-01-01T00:00:01.000Z",
      handshake: {
        attempted: false,
        result: "not-attempted"
      }
    });
  });

  it("parses, normalizes, and retains latest frame diagnostics", () => {
    let now = 1000;
    const state = createState(() => now);
    state.setListening({
      source: "ifacialmocap",
      transport: "udp",
      receivePort: 49983,
      iphoneHost: "192.168.1.30"
    });

    const firstStatus = state.recordReceivedFrame({
      rawFrame: sampleFrame,
      remote: {
        address: "192.168.1.30",
        port: 49983
      }
    });
    now = 1100;
    const secondStatus = state.recordReceivedFrame({
      rawFrame: sampleFrame,
      remote: {
        address: "192.168.1.30",
        port: 49983
      }
    });

    expect(firstStatus.connectionState).toBe("receiving");
    expect(secondStatus).toMatchObject({
      connectionState: "receiving",
      packetCount: 2,
      estimatedFps: 10,
      remote: {
        address: "192.168.1.30",
        port: 49983
      }
    });
    expect(secondStatus.diagnostics.parsedFrame).toMatchObject({
      blendshapeCount: 2,
      headRotationEulerDeg: { x: 1, y: 2, z: 3 },
      headPositionRaw: { x: 4, y: 5, z: 6 },
      rightEyeEulerDeg: { x: 7, y: 8, z: 9 },
      leftEyeEulerDeg: { x: 10, y: 11, z: 12 }
    });
    expect(secondStatus.diagnostics.trackingFrame?.blendshapes).toEqual({
      jawOpen: 0.5,
      mouthSmile_L: 0.25
    });
    expect(state.createDiagnosticsCopyPayload().latestRawFrame).toBe(sampleFrame);
  });

  it("reports stale after the last receiving packet ages out", () => {
    const state = createState(() => 1000);
    state.setListening({
      source: "ifacialmocap",
      transport: "udp",
      receivePort: 49983
    });
    state.recordReceivedFrame({
      rawFrame: sampleFrame,
      remote: {
        address: "192.168.1.30",
        port: 49983
      }
    });

    expect(state.getStatus(2000).connectionState).toBe("receiving");
    expect(state.getStatus(2001).connectionState).toBe("stale");
  });

  it("keeps parser diagnostics for malformed frames without throwing", () => {
    const state = createState(() => 1000);
    state.setListening({
      source: "ifacialmocap",
      transport: "udp",
      receivePort: 49983
    });

    const status = state.recordReceivedFrame({
      rawFrame: "not-a-valid-blendshape|=head#1,2|",
      remote: {
        address: "192.168.1.30",
        port: 49983
      }
    });

    expect(status.connectionState).toBe("receiving");
    expect(status.diagnostics.parser?.malformedSegmentCount).toBe(2);
    expect(status.diagnostics.parser?.lastParseError).toContain(
      "Expected 6 comma-separated values"
    );
  });
});
