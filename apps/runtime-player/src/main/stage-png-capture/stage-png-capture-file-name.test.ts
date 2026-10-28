import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  createStagePngCaptureFileName,
  formatStagePngCaptureTimestamp,
  readStagePngCaptureBaseName,
  resolveRuntimePlayerStagePngCaptureFolderPath,
  sanitizeStagePngCaptureBaseName
} from "./stage-png-capture-file-name";

describe("stage PNG capture file name", () => {
  it("formats the capture moment as local YYYYMMDD-HHMMSS", () => {
    expect(
      formatStagePngCaptureTimestamp(new Date(2026, 9, 28, 15, 30, 12))
    ).toBe("20261028-153012");
    expect(
      formatStagePngCaptureTimestamp(new Date(2026, 0, 2, 3, 4, 5))
    ).toBe("20260102-030405");
  });

  it("uses the Runtime Export folder name as the stem", () => {
    expect(
      readStagePngCaptureBaseName(
        "C:\\workspace\\remie\\rigging\\astra-chan\\exports\\astra-chan-runtime"
      )
    ).toBe("astra-chan-runtime");
    expect(
      readStagePngCaptureBaseName(
        "C:\\workspace\\remie\\rigging\\second-rigging-6-sol\\runtime-export\\"
      )
    ).toBe("runtime-export");
  });

  it("replaces characters Windows does not allow in file names", () => {
    expect(sanitizeStagePngCaptureBaseName('a<b>c:d"e/f\\g|h?i*j')).toBe(
      "a_b_c_d_e_f_g_h_i_j"
    );
    expect(sanitizeStagePngCaptureBaseName("tab\there")).toBe("tab_here");
    expect(sanitizeStagePngCaptureBaseName("  spaced name  ")).toBe(
      "spaced name"
    );
    expect(sanitizeStagePngCaptureBaseName("チャッピー")).toBe("チャッピー");
    expect(sanitizeStagePngCaptureBaseName("   ")).toBe("stage");
    expect(sanitizeStagePngCaptureBaseName("x".repeat(300))).toHaveLength(100);
  });

  it("appends -2, -3, … only after the first attempt", () => {
    const base = {
      baseName: "astra-chan-runtime",
      timestamp: "20261028-153012"
    };

    expect(createStagePngCaptureFileName({ ...base, attempt: 1 })).toBe(
      "astra-chan-runtime-20261028-153012.png"
    );
    expect(createStagePngCaptureFileName({ ...base, attempt: 2 })).toBe(
      "astra-chan-runtime-20261028-153012-2.png"
    );
    expect(createStagePngCaptureFileName({ ...base, attempt: 3 })).toBe(
      "astra-chan-runtime-20261028-153012-3.png"
    );
  });

  it("puts captures under Pictures\\Runtime Player", () => {
    expect(
      resolveRuntimePlayerStagePngCaptureFolderPath(
        path.join("C:", "Users", "remie", "Pictures")
      )
    ).toBe(path.join("C:", "Users", "remie", "Pictures", "Runtime Player"));
  });
});
