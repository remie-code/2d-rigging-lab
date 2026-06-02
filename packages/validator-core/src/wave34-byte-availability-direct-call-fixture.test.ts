import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  BinaryAssetReferenceSchema,
  PackageBinaryByteVerifiedSummarySnapshotSchema,
  type PackageBinaryAssetVerificationReport
} from "@private-2d-rigging-lab/package-format";
import {
  describe,
  expect,
  it
} from "vitest";

import type { ValidationCheckResultDto } from "./validation-report.js";
import { validateByteIntakePreflight } from "./validators/byte-intake-preflight.js";

describe("wave34 byte availability validator direct-call fixture", () => {
  it("turns stale summary, missing bytes, and reupload cases into deterministic diagnostics", async () => {
    const fixture = loadDirectCallFixture();
    const actualSummary = {
      schemaVersion: "wave34-byte-availability-validator-diagnostics-summary-v1",
      fixtureId: fixture.fixtureId,
      cases: await Promise.all(
        fixture.cases.map(async (fixtureCase) =>
          summarizeValidatorChecks(
            fixtureCase.caseId,
            await validateByteIntakePreflight({
              packageId: fixture.packageId,
              packageRevision: fixture.packageRevision,
              assets: [
                {
                  binaryAssetRef: BinaryAssetReferenceSchema.parse(fixtureCase.binaryAssetRef),
                  targetKind: fixtureCase.targetKind,
                  targetId: fixtureCase.targetId,
                  targetPath: `/wave34/directCallCases/${fixtureCase.caseId}`,
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
                }
              ]
            })
          )
        )
      ),
      truthfulness: {
        staleVerifiedSummaryFails: true,
        missingCurrentSessionBytesFails: true,
        requiresReuploadFails: true,
        validCurrentSessionControlPasses: true
      }
    };

    expect(actualSummary).toEqual(readFixtureJson("expected/validator-availability-diagnostics-summary.json"));
  });
});

interface DirectCallFixture {
  readonly fixtureId: string;
  readonly packageId: string;
  readonly packageRevision: number;
  readonly cases: readonly DirectCallCaseFixture[];
}

interface DirectCallCaseFixture {
  readonly caseId: string;
  readonly targetKind: "sourceAsset" | "texture" | "package";
  readonly targetId: string;
  readonly binaryAssetRef: unknown;
  readonly currentSessionVerificationReport?: PackageBinaryAssetVerificationReport;
  readonly verifiedSummary?: unknown;
  readonly requiresReupload?: boolean;
}

const summarizeValidatorChecks = (
  caseId: string,
  checks: readonly ValidationCheckResultDto[]
) => ({
  caseId,
  diagnostics: checks.map((check) => ({
    checkId: check.checkId,
    status: check.status,
    severity: check.severity,
    phase: check.phase,
    targetPath: check.targetPath,
    availabilityEvidence: check.evidence.filter(isAvailabilityEvidence)
  }))
});

const isAvailabilityEvidence = (item: string): boolean =>
  [
    "availability=",
    "availabilityStatus=",
    "currentSessionBytes=",
    "currentSessionVerificationStatus=",
    "requiresReupload=",
    "verifiedSummaryStatus=",
    "availabilityIssueCode=",
    "availabilityIssueSource=",
    "availabilityIssueTargetPath=",
    "expected=",
    "actual=",
    "packageId=",
    "packageRevision="
  ].some((prefix) => item.startsWith(prefix));

const loadDirectCallFixture = (): DirectCallFixture =>
  readFixtureJson("direct-call-cases.json") as DirectCallFixture;

const readFixtureJson = (relativePath: string): unknown =>
  JSON.parse(readFileSync(join(fixtureRootDirectory, relativePath), "utf8")) as unknown;

const fixtureRootDirectory = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../fixtures/contracts/wave34-byte-availability-direct-call-fixtures"
);
