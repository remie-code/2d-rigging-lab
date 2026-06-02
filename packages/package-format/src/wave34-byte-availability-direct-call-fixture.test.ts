import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  BinaryAssetReferenceSchema,
  PackageBinaryByteVerifiedSummarySnapshotSchema,
  evaluatePackageBinaryCurrentSessionByteAvailability,
  type PackageBinaryAssetVerificationReport,
  type PackageBinaryByteAvailabilityReportDto
} from "./index.js";

describe("wave34 byte availability direct-call contract fixture", () => {
  it("keeps stale summary, missing bytes, and reupload misuse from passing silently", () => {
    const fixture = loadDirectCallFixture();
    const actualSummary = {
      schemaVersion: "wave34-byte-availability-direct-call-summary-v1",
      fixtureId: fixture.fixtureId,
      cases: fixture.cases.map((fixtureCase) =>
        summarizeAvailabilityReport(
          fixtureCase.caseId,
          evaluateFixtureCase(fixture, fixtureCase)
        )
      ),
      truthfulness: {
        allMisuseCasesFail: fixture.cases
          .filter((fixtureCase) => fixtureCase.caseId !== "valid-current-session-bytes-pass")
          .every((fixtureCase) =>
            summarizeAvailabilityReport(
              fixtureCase.caseId,
              evaluateFixtureCase(fixture, fixtureCase)
            ).status === "fail-v1"
          ),
        validCurrentSessionControlPasses: fixture.cases
          .filter((fixtureCase) => fixtureCase.caseId === "valid-current-session-bytes-pass")
          .every((fixtureCase) =>
            summarizeAvailabilityReport(
              fixtureCase.caseId,
              evaluateFixtureCase(fixture, fixtureCase)
            ).status === "pass-v1"
          )
      }
    };

    expect(readFixtureJson("fixture-manifest.json")).toMatchObject({
      fixtureId: "wave34-byte-availability-direct-call-fixtures",
      truthfulness: {
        staleVerifiedSummaryCanPass: false,
        missingCurrentSessionBytesCanPass: false,
        requiresReuploadCanPass: false,
        parserSupportClaimed: false,
        imageDecodeSupportClaimed: false,
        archiveSupportClaimed: false
      }
    });
    expect(fixture.truthfulness).toMatchObject({
      rawBytesPersistedInFixture: false,
      staleVerifiedSummaryCanSatisfyCurrentSessionBytes: false,
      missingCurrentSessionBytesCanPass: false,
      requiresReuploadCanPass: false,
      parserUsed: false,
      imageDecodeUsed: false,
      archiveUsed: false
    });
    expect(actualSummary).toEqual(readFixtureJson("expected/direct-call-availability-summary.json"));
  });
});

interface DirectCallFixture {
  readonly fixtureId: string;
  readonly packageId: string;
  readonly packageRevision: number;
  readonly cases: readonly DirectCallCaseFixture[];
  readonly truthfulness: {
    readonly rawBytesPersistedInFixture: boolean;
    readonly staleVerifiedSummaryCanSatisfyCurrentSessionBytes: boolean;
    readonly missingCurrentSessionBytesCanPass: boolean;
    readonly requiresReuploadCanPass: boolean;
    readonly parserUsed: boolean;
    readonly imageDecodeUsed: boolean;
    readonly archiveUsed: boolean;
  };
}

interface DirectCallCaseFixture {
  readonly caseId: string;
  readonly binaryAssetRef: unknown;
  readonly currentSessionVerificationReport?: PackageBinaryAssetVerificationReport;
  readonly verifiedSummary?: unknown;
  readonly requiresReupload?: boolean;
}

const evaluateFixtureCase = (
  fixture: DirectCallFixture,
  fixtureCase: DirectCallCaseFixture
): PackageBinaryByteAvailabilityReportDto =>
  evaluatePackageBinaryCurrentSessionByteAvailability({
    packageId: fixture.packageId,
    packageRevision: fixture.packageRevision,
    binaryAssetRef: BinaryAssetReferenceSchema.parse(fixtureCase.binaryAssetRef),
    ...(fixtureCase.currentSessionVerificationReport === undefined
      ? {}
      : { currentSessionVerificationReport: fixtureCase.currentSessionVerificationReport }),
    ...(fixtureCase.verifiedSummary === undefined
      ? {}
      : {
          verifiedSummary: PackageBinaryByteVerifiedSummarySnapshotSchema.parse(
            fixtureCase.verifiedSummary
          )
        }),
    ...(fixtureCase.requiresReupload === undefined
      ? {}
      : { requiresReupload: fixtureCase.requiresReupload })
  });

const summarizeAvailabilityReport = (
  caseId: string,
  report: PackageBinaryByteAvailabilityReportDto
) => ({
  caseId,
  availability: report.availability,
  status: report.status,
  currentSessionBytes: report.currentSessionBytes,
  currentSessionVerificationStatus: report.currentSessionVerificationStatus,
  requiresReupload: report.requiresReupload,
  verifiedSummaryStatus: report.verifiedSummaryStatus,
  issueDetails: report.issues.map((issue) => ({
    code: issue.code,
    source: issue.source,
    targetPath: issue.targetPath,
    expected: issue.expected,
    actual: issue.actual
  }))
});

const loadDirectCallFixture = (): DirectCallFixture =>
  readFixtureJson("direct-call-cases.json") as DirectCallFixture;

const readFixtureJson = (relativePath: string): unknown =>
  JSON.parse(readFileSync(join(fixtureRootDirectory, relativePath), "utf8")) as unknown;

const fixtureRootDirectory = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../fixtures/contracts/wave34-byte-availability-direct-call-fixtures"
);
