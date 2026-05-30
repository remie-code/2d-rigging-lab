import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  PackageDocumentSchema,
  type PackageDocumentDto
} from "@private-2d-rigging-lab/package-format";
import { ProvenanceIdSchema } from "@private-2d-rigging-lab/contracts";

import { defaultCheckCatalog } from "./check-catalog.js";
import type { ValidationReportDto } from "./validation-report.js";
import { validatePackageRuntime } from "./validators/package-runtime.js";

describe("source asset rights and provenance validator oracle", () => {
  it("registers source asset rights and drawable texture checks in the catalog", () => {
    expect(defaultCheckCatalog.has("rights.provenanceMissing")).toBe(true);
    expect(defaultCheckCatalog.has("rights.drawableProvenanceMissing")).toBe(true);
    expect(defaultCheckCatalog.has("rights.drawableProvenanceMismatch")).toBe(true);
    expect(defaultCheckCatalog.has("rights.statusNeedsReview")).toBe(true);
    expect(defaultCheckCatalog.has("rights.statusBlocked")).toBe(true);
    expect(defaultCheckCatalog.has("ref.drawableTextureMissing")).toBe(true);
  });

  it("keeps cleared source asset rights as a validation pass", () => {
    const report = validatePackageRuntime({
      packageDocument: loadClearedPackageDocument(),
      createdAt: "2026-05-30T00:00:00.000Z"
    });

    expect(summarizeReport(report)).toEqual(loadExpectedSummary().cases.cleared);
    expect(report.checks).toEqual([]);
  });

  it("reports needs_review rights as an observable non-failing review status", () => {
    const report = validatePackageRuntime({
      packageDocument: createNeedsReviewPackageDocument(),
      createdAt: "2026-05-30T00:00:00.000Z"
    });
    const check = expectSingleCheck(report);

    expect(summarizeReport(report)).toEqual(loadExpectedSummary().cases.needsReview);
    expect(check).toMatchObject({
      checkId: "rights.statusNeedsReview",
      status: "needs_review",
      severity: "warning",
      phase: "rights",
      target: {
        kind: "sourceAsset",
        id: "src_split_png"
      },
      targetPath: "/assets/rights/records/0",
      relatedAC: ["AC-MVP-002"],
      relatedScenarios: ["SC-RIGHTS-002"]
    });
    expect(check.evidence).toEqual(expect.arrayContaining([
      "sourceAssetId=src_split_png",
      "sourceKind=split-png-set-v1",
      "rightsStatus=needs_review"
    ]));
    expect(check.impact).toContain("human rights decision");
  });

  it("reports blocked rights as a structured blocking failure", () => {
    const report = validatePackageRuntime({
      packageDocument: createBlockedPackageDocument(),
      createdAt: "2026-05-30T00:00:00.000Z"
    });
    const check = expectSingleCheck(report);

    expect(summarizeReport(report)).toEqual(loadExpectedSummary().cases.blocked);
    expect(check).toMatchObject({
      checkId: "rights.statusBlocked",
      status: "fail",
      severity: "blocking",
      target: {
        kind: "sourceAsset",
        id: "src_split_png"
      },
      targetPath: "/assets/rights/records/0"
    });
    expect(check.evidence).toEqual(expect.arrayContaining([
      "sourceAssetId=src_split_png",
      "rightsStatus=blocked"
    ]));
    expect(check.impact).toContain("unusable");
  });

  it("reports missing source provenance with source asset evidence", () => {
    const report = validatePackageRuntime({
      packageDocument: createMissingProvenancePackageDocument(),
      createdAt: "2026-05-30T00:00:00.000Z"
    });
    const check = expectCheckById(report, "rights.provenanceMissing");

    expect(summarizeReport(report)).toEqual(loadExpectedSummary().cases.missingProvenance);
    expect(check).toMatchObject({
      checkId: "rights.provenanceMissing",
      status: "fail",
      severity: "error",
      target: {
        kind: "sourceAsset",
        id: "src_split_png",
        path: "/assets/sourceManifest/sourceAssets/0"
      },
      targetPath: "/assets/sourceManifest/sourceAssets/0",
      relatedAC: ["AC-MVP-002", "AC-MVP-013"]
    });
    expect(check.evidence).toEqual(expect.arrayContaining([
      "sourceAssetId=src_split_png",
      "sourceKind=split-png-set-v1",
      "filePath=assets/sources/split/body.png",
      "provenanceRecords=0"
    ]));
  });

  it("reports a visible drawable missing its texture atlas reference", () => {
    const report = validatePackageRuntime({
      packageDocument: createMissingTexturePackageDocument(),
      createdAt: "2026-05-30T00:00:00.000Z"
    });
    const check = expectSingleCheck(report);

    expect(summarizeReport(report)).toEqual(loadExpectedSummary().cases.missingTexture);
    expect(check).toMatchObject({
      checkId: "ref.drawableTextureMissing",
      status: "fail",
      severity: "error",
      phase: "reference",
      target: {
        kind: "texture",
        id: "tex_body"
      },
      targetPath: "/model/drawables/drawables/0/textureId",
      relatedAC: ["AC-MVP-004", "AC-MVP-013"]
    });
    expect(check.evidence).toEqual(expect.arrayContaining([
      "drawableId=draw_body",
      "textureId=tex_body",
      "runtimeVisibility=true",
      "sourceKind=split-png-set-v1",
      "textureAtlasMatch=missing"
    ]));
  });

  it("reports a visible split PNG drawable when the texture atlas is absent", () => {
    const report = validatePackageRuntime({
      packageDocument: createMissingTextureAtlasPackageDocument(),
      createdAt: "2026-05-30T00:00:00.000Z"
    });
    const check = expectSingleCheck(report);

    expect(summarizeReport(report)).toEqual(loadExpectedSummary().cases.missingTextureNoAtlas);
    expect(check).toMatchObject({
      checkId: "ref.drawableTextureMissing",
      status: "fail",
      severity: "error",
      target: {
        kind: "texture",
        id: "tex_body"
      },
      targetPath: "/model/drawables/drawables/0/textureId"
    });
    expect(check.evidence).toEqual(expect.arrayContaining([
      "sourceKind=split-png-set-v1",
      "textureAtlasPresent=false",
      "textureAtlasMatch=texture-atlas-missing"
    ]));
  });

  it("reports a visible PSD source-backed drawable when the texture atlas is absent", () => {
    const report = validatePackageRuntime({
      packageDocument: createPsdSourceMissingTextureAtlasPackageDocument(),
      createdAt: "2026-05-30T00:00:00.000Z"
    });
    const check = expectSingleCheck(report);

    expect(summarizeReport(report)).toEqual(loadExpectedSummary().cases.psdSourceMissingTextureNoAtlas);
    expect(check).toMatchObject({
      checkId: "ref.drawableTextureMissing",
      status: "fail",
      severity: "error",
      targetPath: "/model/drawables/drawables/0/textureId"
    });
    expect(check.evidence).toEqual(expect.arrayContaining([
      "sourceKind=psd-source-v1",
      "textureAtlasPresent=false",
      "textureAtlasMatch=texture-atlas-missing"
    ]));
  });

  it("keeps the no-atlas generated fixture exception explicit and observable", () => {
    const report = validatePackageRuntime({
      packageDocument: createLegacyGeneratedFixtureNoAtlasPackageDocument(),
      createdAt: "2026-05-30T00:00:00.000Z"
    });

    expect(summarizeReport(report)).toEqual(loadExpectedSummary().cases.legacyGeneratedFixtureNoAtlas);
    expect(report.checks).toEqual([]);
  });

  it("reports a drawable sourceProvenanceId that does not resolve", () => {
    const report = validatePackageRuntime({
      packageDocument: createMissingDrawableProvenancePackageDocument(),
      createdAt: "2026-05-30T00:00:00.000Z"
    });
    const check = expectSingleCheck(report);

    expect(summarizeReport(report)).toEqual(loadExpectedSummary().cases.missingDrawableProvenance);
    expect(check).toMatchObject({
      checkId: "rights.drawableProvenanceMissing",
      status: "fail",
      severity: "error",
      phase: "rights",
      target: {
        kind: "drawable",
        id: "draw_body",
        path: "/model/drawables/drawables/0/sourceProvenanceId"
      },
      targetPath: "/model/drawables/drawables/0/sourceProvenanceId",
      relatedAC: ["AC-MVP-002", "AC-MVP-004", "AC-MVP-013"],
      relatedScenarios: ["SC-IN-002", "SC-RIGHTS-002"]
    });
    expect(check.evidence).toEqual(expect.arrayContaining([
      "drawableId=draw_body",
      "sourceAssetId=src_split_png",
      "sourceProvenanceId=prov_missing",
      "provenanceIdMatch=missing"
    ]));
    expect(check.impact).toContain("provenance record");
  });
});

interface ExpectedOracleSummary {
  readonly cases: Record<string, {
    readonly status: string;
    readonly checkIds: readonly string[];
  }>;
}

const loadClearedPackageDocument = (): PackageDocumentDto =>
  PackageDocumentSchema.parse(readFixtureJson("source-package.cleared.json"));

const loadExpectedSummary = (): ExpectedOracleSummary =>
  readFixtureJson("expected/source-validation-oracle-summary.json") as ExpectedOracleSummary;

const createNeedsReviewPackageDocument = (): PackageDocumentDto => {
  const document = clonePackage(loadClearedPackageDocument());
  const sourceRights = document.assets.rights.records.find((record) => record.assetId === "src_split_png");

  if (sourceRights === undefined) {
    throw new Error("Fixture is missing src_split_png rights record.");
  }

  sourceRights.rightsStatus = "needs_review";
  document.manifest.rightsSummary.status = "needs_review";
  return document;
};

const createBlockedPackageDocument = (): PackageDocumentDto => {
  const document = clonePackage(loadClearedPackageDocument());
  const sourceRights = document.assets.rights.records.find((record) => record.assetId === "src_split_png");

  if (sourceRights === undefined) {
    throw new Error("Fixture is missing src_split_png rights record.");
  }

  sourceRights.rightsStatus = "blocked";
  document.manifest.rightsSummary.status = "blocked";
  return document;
};

const createMissingProvenancePackageDocument = (): PackageDocumentDto => {
  const document = clonePackage(loadClearedPackageDocument());
  document.assets.provenance.records = document.assets.provenance.records.filter(
    (record) => record.assetId !== "src_split_png"
  );
  return document;
};

const createMissingTexturePackageDocument = (): PackageDocumentDto => {
  const document = clonePackage(loadClearedPackageDocument());
  const textureAtlas = document.assets.textureAtlas;

  if (textureAtlas === undefined) {
    throw new Error("Fixture is missing texture atlas.");
  }

  textureAtlas.textures = textureAtlas.textures.filter((texture) => texture.textureId !== "tex_body");
  return document;
};

const createMissingTextureAtlasPackageDocument = (): PackageDocumentDto => {
  const document = clonePackage(loadClearedPackageDocument());
  delete document.assets.textureAtlas;
  return document;
};

const createPsdSourceMissingTextureAtlasPackageDocument = (): PackageDocumentDto => {
  const document = createMissingTextureAtlasPackageDocument();
  const sourceAsset = document.assets.sourceManifest.sourceAssets[0];

  if (sourceAsset === undefined) {
    throw new Error("Fixture is missing source asset.");
  }

  sourceAsset.kind = "psd-source-v1";
  sourceAsset.importProfile = "layered-character-psd-profile-v1";
  sourceAsset.filePath = "assets/sources/source.psd";
  return document;
};

const createLegacyGeneratedFixtureNoAtlasPackageDocument = (): PackageDocumentDto => {
  const document = createMissingTextureAtlasPackageDocument();
  const sourceAsset = document.assets.sourceManifest.sourceAssets[0];
  const sourceProvenance = document.assets.provenance.records.find((record) => record.assetId === "src_split_png");

  if (sourceAsset === undefined || sourceProvenance === undefined) {
    throw new Error("Fixture is missing generated source inputs.");
  }

  sourceAsset.kind = "generated-fixture-v1";
  sourceProvenance.assetKind = "generatedFixture";
  return document;
};

const createMissingDrawableProvenancePackageDocument = (): PackageDocumentDto => {
  const document = clonePackage(loadClearedPackageDocument());
  const drawable = document.model.drawables.drawables[0];

  if (drawable === undefined) {
    throw new Error("Fixture is missing drawable.");
  }

  drawable.sourceProvenanceId = ProvenanceIdSchema.parse("prov_missing");
  return document;
};

const summarizeReport = (report: ValidationReportDto): ExpectedOracleSummary["cases"][string] => ({
  status: report.summary.status,
  checkIds: report.checks.map((check) => check.checkId)
});

const expectSingleCheck = (report: ValidationReportDto): ValidationReportDto["checks"][number] => {
  expect(report.checks).toHaveLength(1);
  const check = report.checks[0];

  if (check === undefined) {
    throw new Error("Expected one validation check.");
  }

  return check;
};

const expectCheckById = (
  report: ValidationReportDto,
  checkId: string
): ValidationReportDto["checks"][number] => {
  const check = report.checks.find((candidate) => candidate.checkId === checkId);

  if (check === undefined) {
    throw new Error(`Expected validation check ${checkId}.`);
  }

  return check;
};

const clonePackage = (document: PackageDocumentDto): PackageDocumentDto =>
  PackageDocumentSchema.parse(structuredClone(document));

const readFixtureJson = (relativePath: string): unknown => {
  const fixtureDirectory = join(
    dirname(fileURLToPath(import.meta.url)),
    "../../../fixtures/contracts/source-asset-rights-provenance-validator"
  );

  return JSON.parse(readFileSync(join(fixtureDirectory, relativePath), "utf8")) as unknown;
};
