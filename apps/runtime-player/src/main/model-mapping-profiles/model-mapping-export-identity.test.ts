import { describe, expect, it } from "vitest";

import {
  createModelMappingRuntimeExportIdentity,
  createParameterSignatureHash,
  createSafePackageId
} from "./model-mapping-export-identity";
import {
  createModelMappingProfileTestParameter,
  createModelMappingProfileTestPayload
} from "./model-mapping-profile-test-fixtures.test-support";

describe("model mapping Runtime Export identity", () => {
  it("creates a stable fallback fingerprint from sorted external target data", () => {
    const first = createModelMappingRuntimeExportIdentity(
      createModelMappingProfileTestPayload({
        parameters: [
          createModelMappingProfileTestParameter("param_b", "B", "b", {
            min: 0,
            max: 1,
            default: 0.5
          }),
          createModelMappingProfileTestParameter("param_a", "A", "a")
        ]
      })
    );
    const second = createModelMappingRuntimeExportIdentity(
      createModelMappingProfileTestPayload({
        parameters: [
          createModelMappingProfileTestParameter("param_a", "A", "a"),
          createModelMappingProfileTestParameter("param_b", "B", "b", {
            min: 0,
            max: 1,
            default: 0.5
          })
        ]
      })
    );
    const changedSignature = createModelMappingRuntimeExportIdentity(
      createModelMappingProfileTestPayload({
        parameters: [
          createModelMappingProfileTestParameter("param_a", "A", "a"),
          createModelMappingProfileTestParameter("param_b", "B", "b", {
            min: 0,
            max: 2,
            default: 0.5
          })
        ]
      })
    );

    expect(first.parameterSignatureHash).toBe(second.parameterSignatureHash);
    expect(first.fingerprint).toBe(second.fingerprint);
    expect(changedSignature.parameterSignatureHash).not.toBe(
      first.parameterSignatureHash
    );
    expect(changedSignature.fingerprint).not.toBe(first.fingerprint);
  });

  it("prefers source package hash over fallback parameter signature", () => {
    const first = createModelMappingRuntimeExportIdentity(
      createModelMappingProfileTestPayload({
        packageHash: "sha256:source-package",
        parameters: [
          createModelMappingProfileTestParameter("param_a", "A", "a")
        ]
      })
    );
    const second = createModelMappingRuntimeExportIdentity(
      createModelMappingProfileTestPayload({
        packageHash: "sha256:source-package",
        parameters: [
          createModelMappingProfileTestParameter("param_a", "A changed", "a", {
            max: 999
          })
        ]
      })
    );

    expect(first.packageHash).toBe("sha256:source-package");
    expect(first.parameterSignatureHash).not.toBe(second.parameterSignatureHash);
    expect(first.fingerprint).toBe(second.fingerprint);
  });

  it("hashes only external-input authored direct targets into the signature", () => {
    const payload = createModelMappingProfileTestPayload({
      parameters: [
        createModelMappingProfileTestParameter("param_direct", "Direct", "direct"),
        createModelMappingProfileTestParameter("param_hidden", "Hidden", "hidden", {
          runtimeRole: "hidden-from-direct-controls",
          externalInput: false,
          readOnly: true
        })
      ],
      manifestExternalIds: ["param_direct"],
      hiddenIds: ["param_hidden"]
    });
    const signature = createParameterSignatureHash(payload);
    const changedHidden = createParameterSignatureHash(
      createModelMappingProfileTestPayload({
        parameters: [
          createModelMappingProfileTestParameter("param_direct", "Direct", "direct"),
          createModelMappingProfileTestParameter(
            "param_hidden",
            "Hidden changed",
            "hidden",
            {
              runtimeRole: "hidden-from-direct-controls",
              externalInput: false,
              readOnly: true,
              max: 999
            }
          )
        ],
        manifestExternalIds: ["param_direct"],
        hiddenIds: ["param_hidden"]
      })
    );

    expect(changedHidden).toBe(signature);
  });

  it("keeps safe package ids readable when possible", () => {
    expect(createSafePackageId("pkg_editor_workspace")).toBe(
      "pkg_editor_workspace"
    );
    expect(createSafePackageId("pkg:editor/workspace")).toMatch(
      /^pkg_editor_workspace-[a-f0-9]{12}$/
    );
  });
});
