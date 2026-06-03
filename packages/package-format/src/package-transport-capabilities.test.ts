import { describe, expect, it } from "vitest";

import {
  PACKAGE_FORMAT_PORTABLE_BUNDLE_TRANSPORT_CAPABILITY,
  PACKAGE_FORMAT_SUPPORTED_TRANSPORT_CAPABILITIES,
  PACKAGE_FORMAT_TRANSPORT_CAPABILITY_CATALOG,
  PortablePackageBundleKindDtoSchema,
  PortablePackageBundleVersionDtoSchema
} from "./index.js";

describe("package-format transport capabilities", () => {
  it("binds the supported transport to portable package bundle v0", () => {
    const portableBundle = PACKAGE_FORMAT_PORTABLE_BUNDLE_TRANSPORT_CAPABILITY.portableBundle;

    expect(PACKAGE_FORMAT_PORTABLE_BUNDLE_TRANSPORT_CAPABILITY).toMatchObject({
      capabilityId: "projectDefinedJsonBundleV0",
      transportKind: "portableBundle",
      status: "supported"
    });
    expect(portableBundle).toBeDefined();
    expect(PortablePackageBundleVersionDtoSchema.parse(portableBundle?.schemaVersion)).toBe(
      "portable-package-bundle-v0"
    );
    expect(PortablePackageBundleKindDtoSchema.parse(portableBundle?.bundleKind)).toBe(
      "project-defined-json-bundle-v0"
    );
  });

  it("does not expose archive or filesystem transports as supported", () => {
    expect(PACKAGE_FORMAT_SUPPORTED_TRANSPORT_CAPABILITIES).toEqual([
      PACKAGE_FORMAT_PORTABLE_BUNDLE_TRANSPORT_CAPABILITY
    ]);

    for (const capability of PACKAGE_FORMAT_TRANSPORT_CAPABILITY_CATALOG.capabilities) {
      if (capability.status !== "supported") {
        expect(capability.capabilityId).not.toBe("projectDefinedJsonBundleV0");
        expect(capability.transportKind).not.toBe("portableBundle");
      }
    }
  });

  it("represents archive, filesystem, directory picker, and drag-drop gates deterministically", () => {
    const capabilitiesById = new Map(
      PACKAGE_FORMAT_TRANSPORT_CAPABILITY_CATALOG.capabilities.map((capability) => [
        capability.capabilityId,
        capability
      ])
    );

    expect(capabilitiesById.get("standardArchiveZipV0")).toMatchObject({
      transportKind: "archive",
      status: "dependency-gated"
    });
    expect(capabilitiesById.get("standardArchiveZipV0")?.gates.map((gate) => gate.gateKind))
      .toContain("dependencyApproval");

    expect(capabilitiesById.get("fileSystemAccessApiV0")).toMatchObject({
      transportKind: "filesystem",
      status: "future-gated"
    });
    expect(capabilitiesById.get("directoryPickerV0")).toMatchObject({
      transportKind: "filesystem",
      status: "future-gated"
    });
    expect(capabilitiesById.get("dragDropFileIntakeV0")).toMatchObject({
      transportKind: "browserFileIntake",
      status: "future-gated"
    });
    expect(capabilitiesById.get("nativeFilesystemPersistenceV0")).toMatchObject({
      transportKind: "filesystem",
      status: "unsupported"
    });
  });
});
