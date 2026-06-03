import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  PRODUCT_PREFLIGHT_REQUIRED_CATEGORY_IDS,
  PRODUCT_PREFLIGHT_STATUS_VALUES,
  ProductPreflightReportDtoSchema,
  ProductPreflightStatusDtoSchema
} from "./index.js";
import { describe, expect, it } from "vitest";
import { z } from "zod";

const FixtureReportEntrySchema = z.object({
  caseId: ProductPreflightStatusDtoSchema,
  expectedStatus: ProductPreflightStatusDtoSchema,
  report: ProductPreflightReportDtoSchema
}).strict();

const FixtureReportSetSchema = z.object({
  schemaVersion: z.literal("wave39-product-preflight-state-reports-v1"),
  fixtureId: z.literal("wave39-product-preflight-report-states"),
  reports: z.array(FixtureReportEntrySchema)
}).strict();

const FixtureManifestSchema = z.object({
  schemaVersion: z.literal("contract-fixture-manifest-v1"),
  fixtureId: z.literal("wave39-product-preflight-report-states"),
  rightsClean: z.object({
    realAssetBytes: z.literal(false),
    imageDecode: z.literal(false),
    externalDependency: z.literal(false),
    parserOracle: z.literal(false),
    rendererOracle: z.literal(false),
    pixelOracle: z.literal(false),
    archiveFilesystem: z.literal(false),
    cubismCompatibility: z.literal(false)
  })
}).passthrough();

describe("Wave39 product preflight report state fixtures", () => {
  it("validates expected report fixtures against the product preflight contract", () => {
    const fixture = FixtureReportSetSchema.parse(
      readJson("expected/product-preflight-state-reports.json")
    );

    expect(fixture.reports.map((entry) => entry.expectedStatus)).toEqual([
      ...PRODUCT_PREFLIGHT_STATUS_VALUES
    ]);

    for (const entry of fixture.reports) {
      expect(entry.report.summary.status).toBe(entry.expectedStatus);
      expect(entry.report.categories.map((category) => category.category)).toEqual([
        ...PRODUCT_PREFLIGHT_REQUIRED_CATEGORY_IDS
      ]);

      if (entry.expectedStatus === "pass") {
        expect(entry.report.categories.every((category) => category.status === "pass")).toBe(true);
      } else {
        expect(entry.report.categories.map((category) => category.status)).toContain(
          entry.expectedStatus
        );
      }
    }
  });

  it("records rights-clean semantic JSON boundaries for the fixture set", () => {
    const manifest = FixtureManifestSchema.parse(readJson("fixture-manifest.json"));

    expect(manifest.rightsClean).toEqual({
      realAssetBytes: false,
      imageDecode: false,
      externalDependency: false,
      parserOracle: false,
      rendererOracle: false,
      pixelOracle: false,
      archiveFilesystem: false,
      cubismCompatibility: false
    });
  });
});

const readJson = (relativePath: string): unknown =>
  JSON.parse(readFileSync(join(fixtureRootDirectory, relativePath), "utf8"));

const fixtureRootDirectory = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../fixtures/contracts/wave39-product-preflight-report-states"
);
