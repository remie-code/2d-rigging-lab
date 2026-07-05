import { describe, expect, it } from "vitest";

import { dynamicsTuningProfileSchemaVersion } from "./dynamics-tuning-profile-document";
import { parseDynamicsTuningProfileDocument } from "./dynamics-tuning-profile-parser";

describe("parseDynamicsTuningProfileDocument (v2 group override validation)", () => {
  it("parses a valid v2 override document", () => {
    const result = parseDynamicsTuningProfileDocument(
      createDocument({
        dyn_hair_sway: {
          enabled: false,
          outputScale: 1.5,
          lengthScale: 0.5,
          limit: 0.75,
          damping: 3.2,
          gravityScale: 0.8
        }
      })
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.profile.groups.dyn_hair_sway).toEqual({
      enabled: false,
      outputScale: 1.5,
      lengthScale: 0.5,
      limit: 0.75,
      damping: 3.2,
      gravityScale: 0.8
    });
    expect(result.warningMessages).toEqual([]);
  });

  it("drops an invalid field and keeps the valid one, adding a warning", () => {
    const result = parseDynamicsTuningProfileDocument(
      createDocument({
        dyn_hair_sway: {
          outputScale: -2,
          damping: 4
        }
      })
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    // The invalid negative outputScale is null-ed and dropped; damping stays.
    expect(result.profile.groups.dyn_hair_sway).toEqual({ damping: 4 });
    expect(result.profile.groups.dyn_hair_sway).not.toHaveProperty("outputScale");
    expect(result.warningMessages.join(" ")).toContain("invalid fields");
  });

  it("removes a group entirely when every override field is invalid", () => {
    const result = parseDynamicsTuningProfileDocument(
      createDocument({
        dyn_hair_sway: {
          outputScale: -2,
          lengthScale: 0,
          limit: -0.1
        }
      })
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    // All fields invalid -> empty override -> group is not retained.
    expect(result.profile.groups).toEqual({});
    expect(result.warningMessages.join(" ")).toContain("invalid fields");
  });
});

function createDocument(groups: Record<string, unknown>): unknown {
  return {
    schemaVersion: dynamicsTuningProfileSchemaVersion,
    createdAtIso: "2026-06-30T00:00:00.000Z",
    updatedAtIso: "2026-06-30T00:01:00.000Z",
    exportIdentity: {
      packageId: "pkg_parser_test",
      packageRevision: 1,
      packageHash: "sha256:parser-test",
      parameterSignatureHash: "sha256:parameters"
    },
    dynamicsSignatureHash: "sha256:dynamics",
    groups
  };
}
