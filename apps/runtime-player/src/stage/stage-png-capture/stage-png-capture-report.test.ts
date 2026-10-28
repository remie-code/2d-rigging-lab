import { describe, expect, it } from "vitest";

import {
  createStagePngCaptureReport,
  createStagePngCaptureUnavailableReport
} from "./stage-png-capture-report";

describe("createStagePngCaptureReport", () => {
  it("answers with the captured bytes under the request id", () => {
    const pngBytes = new Uint8Array([0x89, 0x50]);

    expect(
      createStagePngCaptureReport({ requestId: "request_1" }, () => pngBytes)
    ).toEqual({
      requestId: "request_1",
      result: "ok",
      pngBytes
    });
  });

  it("turns a capture failure into an error answer", () => {
    expect(
      createStagePngCaptureReport({ requestId: "request_2" }, () => {
        throw new Error("Stage renderer is disposed.");
      })
    ).toEqual({
      requestId: "request_2",
      result: "error",
      message: "Stage renderer is disposed."
    });
  });

  it("answers at once when the renderer never started", () => {
    expect(
      createStagePngCaptureUnavailableReport({ requestId: "request_3" })
    ).toEqual({
      requestId: "request_3",
      result: "error",
      message: "Stage renderer is unavailable."
    });
  });
});
