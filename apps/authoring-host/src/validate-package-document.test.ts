import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { SourceAssetIdSchema } from "@private-2d-rigging-lab/contracts";
import type { PackageDocumentDto } from "@private-2d-rigging-lab/package-format";

import { loadAuthoringPackageDirectory } from "./package-directory-io.js";
import { writeEyeSmokeFixturePackage } from "./test-support/authoring-host-fixtures.js";
import {
  AUTHORING_HOST_VALIDATOR_VERSION,
  validatePackageDocument
} from "./validate-package-document.js";

const createdRoots: string[] = [];

afterEach(async () => {
  await Promise.all(createdRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

const loadEyeSmokeDocument = async (): Promise<PackageDocumentDto> => {
  const root = await mkdtemp(join(tmpdir(), "authoring-host-doc-"));
  createdRoots.push(root);
  const packageDirectory = join(root, "package");
  await writeEyeSmokeFixturePackage(packageDirectory);
  const loaded = await loadAuthoringPackageDirectory(packageDirectory);

  return loaded.packageDocument;
};

describe("validatePackageDocument", () => {
  it("produces a passing report for a healthy synthetic package", async () => {
    const document = await loadEyeSmokeDocument();

    const report = validatePackageDocument({ packageDocument: document, profile: "strict" });

    expect(report.schemaVersion).toBe("validation-report-v1");
    expect(report.validatorVersion).toBe(AUTHORING_HOST_VALIDATOR_VERSION);
    expect(report.profile).toBe("strict");
    expect(report.packageId).toBe(document.manifest.packageId);
    // Healthy package: no error / blocking diagnostics.
    expect(report.summary.counts.error).toBe(0);
    expect(report.summary.counts.blocking).toBe(0);
    // The document-only path records that no runtime snapshot / operation log backed it.
    expect(report.evidence.runtimeSnapshotIds).toEqual([]);
    expect(report.evidence.operationLogPresent).toBe(false);
  });

  it("honors the payload profile and packageRevision override", async () => {
    const document = await loadEyeSmokeDocument();

    const report = validatePackageDocument({
      packageDocument: document,
      profile: "editorIncremental",
      packageRevision: 42
    });

    expect(report.profile).toBe("editorIncremental");
    expect(report.packageRevision).toBe(42);
  });

  it("reports a drawable that references a missing source asset", async () => {
    const document = await loadEyeSmokeDocument();
    expect(document.model.drawables.drawables.length).toBeGreaterThan(0);

    // Corrupt the first drawable's source-asset reference to point at a non-existent id.
    const corrupted: PackageDocumentDto = {
      ...document,
      model: {
        ...document.model,
        drawables: {
          ...document.model.drawables,
          drawables: document.model.drawables.drawables.map((drawable, index) =>
            index === 0
              ? {
                  ...drawable,
                  sourceAssetId: SourceAssetIdSchema.parse("src_does_not_exist_wave104_b")
                }
              : drawable
          )
        }
      }
    };

    const report = validatePackageDocument({ packageDocument: corrupted, profile: "strict" });

    const missingSourceChecks = report.checks.filter(
      (check) => check.checkId === "ref.drawableSourceMissing"
    );
    expect(missingSourceChecks.length).toBeGreaterThan(0);
    expect(report.summary.status).toBe("fail");
    expect(report.summary.counts.error).toBeGreaterThan(0);
  });
});
