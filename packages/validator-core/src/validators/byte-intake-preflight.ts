import {
  computePackageBinarySha256Digest,
  getPackageBinaryByteLength,
  type BinaryAssetDigestDto,
  type BinaryAssetReferenceDto,
  type BinaryAssetStorageStatusDto,
  type PackageBinaryAssetVerificationReport,
  type PackageBinaryByteAvailabilityDto,
  type PackageBinaryByteIntakeSummaryDto,
  type PackageBinaryByteVerifiedSummarySnapshotDto,
  type PackageBinaryBytes
} from "@private-2d-rigging-lab/package-format";
import type { TargetKind } from "@private-2d-rigging-lab/contracts";

import type { ValidationCheckResultDto } from "../validation-report.js";
import { ValidationCheckResultSchema } from "../validation-report.js";
import { createByteIntakeAvailabilityValidationResult } from "./byte-intake-availability-diagnostics.js";

export type ByteIntakeBytesAvailability =
  | "available"
  | "ephemeral"
  | "missing"
  | "requiresReupload";

export type ByteIntakeUnsupportedClaimKind = "parser" | "imageDecode" | "archive";

export type ByteIntakeUnsupportedClaimStatus =
  | "notClaimed"
  | "unsupported"
  | "present"
  | "required";

export interface ByteIntakeUnsupportedClaimInput {
  readonly claimKind: ByteIntakeUnsupportedClaimKind;
  readonly status: ByteIntakeUnsupportedClaimStatus;
  readonly source?: string;
  readonly evidence?: readonly string[];
}

export interface ByteIntakeAssetPreflightInput {
  readonly intakeSummary?: PackageBinaryByteIntakeSummaryDto;
  readonly binaryAssetId?: string;
  readonly packageRelativePath?: string;
  readonly digest?: BinaryAssetDigestDto;
  readonly byteLength?: number;
  readonly mediaType?: string;
  readonly storageStatus?: BinaryAssetStorageStatusDto;
  readonly fileMediaType?: string;
  readonly provenanceId?: string;
  readonly rightsAssetId?: string;
  readonly sourceFilename?: string;
  readonly bytesAvailability?: ByteIntakeBytesAvailability;
  readonly bytes?: PackageBinaryBytes;
  readonly binaryAssetRef?: BinaryAssetReferenceDto;
  readonly currentSessionVerificationReport?: PackageBinaryAssetVerificationReport;
  readonly verifiedSummary?: PackageBinaryByteVerifiedSummarySnapshotDto;
  readonly requiresReupload?: boolean;
  readonly targetKind?: Extract<TargetKind, "package" | "sourceAsset" | "texture">;
  readonly targetId?: string;
  readonly targetPath?: string;
  readonly unsupportedClaims?: readonly ByteIntakeUnsupportedClaimInput[];
}

export interface ByteIntakePreflightInput {
  readonly packageId?: string;
  readonly packageRevision?: number;
  readonly assets?: readonly ByteIntakeAssetPreflightInput[];
  readonly unsupportedClaims?: readonly ByteIntakeUnsupportedClaimInput[];
}

interface ByteIntakeAssetTarget {
  readonly asset: ByteIntakeAssetPreflightInput;
  readonly assetIndex: number;
  readonly packageId?: string;
  readonly packageRevision?: number;
  readonly targetKind: Extract<TargetKind, "package" | "sourceAsset" | "texture">;
  readonly targetId: string;
  readonly targetPath: string;
}

export const validateByteIntakePreflight = async (
  input: ByteIntakePreflightInput
): Promise<readonly ValidationCheckResultDto[]> => {
  const checks: ValidationCheckResultDto[] = [];
  const assetTargets = (input.assets ?? []).map((asset, assetIndex) =>
    createByteIntakeAssetTarget(asset, assetIndex, input)
  );

  for (const target of assetTargets) {
    checks.push(...(await validateByteIntakeAssetTarget(target)));
  }

  checks.push(
    ...validateUnsupportedClaims({
      claims: input.unsupportedClaims ?? [],
      targetPathPrefix: "/byteIntake/unsupportedClaims",
      targetKind: "package",
      targetId: "byte-intake",
      targetPath: "/byteIntake"
    })
  );

  return checks;
};

const validateByteIntakeAssetTarget = async (
  target: ByteIntakeAssetTarget
): Promise<readonly ValidationCheckResultDto[]> => {
  const checks: ValidationCheckResultDto[] = [];

  if (isBlank(getProvenanceId(target.asset))) {
    checks.push(createByteIntakeProvenanceMissingCheck(target));
  }

  if (isBlank(getRightsAssetId(target.asset))) {
    checks.push(createByteIntakeRightsMissingCheck(target));
  }

  const availabilityResult = createByteIntakeAvailabilityValidationResult(target);
  if (availabilityResult !== undefined) {
    checks.push(...availabilityResult.checks);
  }

  const bytesAvailability = target.asset.bytesAvailability ?? (
    mapPackageByteAvailability(target.asset.intakeSummary?.availability) ??
    (target.asset.bytes === undefined ? "missing" : "available")
  );

  const bytes = target.asset.bytes;
  if (availabilityResult !== undefined) {
    if (
      bytes !== undefined &&
      bytesAvailability !== "missing" &&
      bytesAvailability !== "requiresReupload"
    ) {
      checks.push(...(await validateAvailableByteIntakeBytes(target, bytes, bytesAvailability)));
    }
  } else if (
    bytes === undefined ||
    bytesAvailability === "missing" ||
    bytesAvailability === "requiresReupload"
  ) {
    checks.push(createByteIntakeBytesMissingCheck(target, bytesAvailability));
  } else if (bytes !== undefined) {
    checks.push(...(await validateAvailableByteIntakeBytes(target, bytes, bytesAvailability)));
  }

  checks.push(
    ...validateUnsupportedClaims({
      claims: target.asset.unsupportedClaims ?? [],
      targetPathPrefix: `${target.targetPath}/unsupportedClaims`,
      targetKind: target.targetKind,
      targetId: target.targetId,
      targetPath: target.targetPath
    })
  );

  return checks;
};

const validateAvailableByteIntakeBytes = async (
  target: ByteIntakeAssetTarget,
  bytes: PackageBinaryBytes,
  bytesAvailability: Exclude<ByteIntakeBytesAvailability, "missing" | "requiresReupload">
): Promise<readonly ValidationCheckResultDto[]> => {
  const checks: ValidationCheckResultDto[] = [];
  const actualByteLength = getPackageBinaryByteLength(bytes);
  const expectedByteLength = getExpectedByteLength(target.asset);

  if (expectedByteLength !== undefined && expectedByteLength !== actualByteLength) {
    checks.push(createByteLengthMismatchCheck(target, actualByteLength, bytesAvailability));
  }

  const declaredMediaType = getDeclaredMediaType(target.asset);
  if (
    declaredMediaType !== undefined &&
    target.asset.fileMediaType !== undefined &&
    declaredMediaType !== target.asset.fileMediaType
  ) {
    checks.push(createMediaTypeMismatchCheck(target, bytesAvailability));
  }

  const expectedDigest = getExpectedDigest(target.asset);
  if (expectedDigest !== undefined) {
    const digestResult = await computePackageBinarySha256Digest(bytes);

    if (digestResult.status === "unsupported") {
      checks.push(createDigestUnsupportedCheck(target, bytesAvailability, digestResult.reason));
    } else if (digestResult.digest.hex !== expectedDigest.hex) {
      checks.push(createDigestMismatchCheck(target, bytesAvailability, digestResult.digest));
    }
  }

  return checks;
};

const validateUnsupportedClaims = (input: {
  readonly claims: readonly ByteIntakeUnsupportedClaimInput[];
  readonly targetPathPrefix: string;
  readonly targetKind: Extract<TargetKind, "package" | "sourceAsset" | "texture">;
  readonly targetId: string;
  readonly targetPath: string;
}): readonly ValidationCheckResultDto[] =>
  input.claims.flatMap((claim, claimIndex) => {
    if (claim.status === "notClaimed") {
      return [];
    }

    return [
      createUnsupportedClaimCheck({
        claim,
        targetKind: input.targetKind,
        targetId: input.targetId,
        targetPath: `${input.targetPathPrefix}/${claimIndex}`,
        targetBasePath: input.targetPath
      })
    ];
  });

const createByteIntakeAssetTarget = (
  asset: ByteIntakeAssetPreflightInput,
  assetIndex: number,
  preflight: ByteIntakePreflightInput
): ByteIntakeAssetTarget => {
  const targetPath = asset.targetPath ?? `/byteIntake/assets/${assetIndex}`;
  const binaryAssetId = getBinaryAssetId(asset);

  return {
    asset,
    assetIndex,
    ...(preflight.packageId === undefined ? {} : { packageId: preflight.packageId }),
    ...(preflight.packageRevision === undefined ? {} : { packageRevision: preflight.packageRevision }),
    targetKind: asset.targetKind ?? "package",
    targetId: asset.targetId ?? binaryAssetId,
    targetPath
  };
};

const createByteIntakeBytesMissingCheck = (
  target: ByteIntakeAssetTarget,
  bytesAvailability: ByteIntakeBytesAvailability
): ValidationCheckResultDto =>
  ValidationCheckResultSchema.parse({
    checkId: "binary.bytesMissing",
    status: "fail",
    severity: "error",
    phase: "reference",
    target: createTarget(target),
    targetPath: target.targetPath,
    message: `Byte intake asset ${getBinaryAssetId(target.asset)} has no actual bytes available for validation.`,
    evidence: [
      ...createByteIntakeAssetEvidence(target),
      `bytesAvailability=${bytesAvailability}`,
      `reason=byte-intake-bytes-${bytesAvailability}`,
      "digestVerification=skipped"
    ],
    relatedAC: ["AC-MVP-002", "AC-MVP-004", "AC-MVP-013"],
    relatedScenarios: ["SC-IN-002", "SC-RIGHTS-002"],
    impact: "The validator cannot prove byte length, digest, or media type truthfulness until actual bytes are supplied again."
  });

const createByteLengthMismatchCheck = (
  target: ByteIntakeAssetTarget,
  actualByteLength: number,
  bytesAvailability: ByteIntakeBytesAvailability
): ValidationCheckResultDto =>
  ValidationCheckResultSchema.parse({
    checkId: "binary.byteLengthMismatch",
    status: "fail",
    severity: "error",
    phase: "reference",
    target: createTarget(target),
    targetPath: target.targetPath,
    message: `Byte intake asset ${getBinaryAssetId(target.asset)} byte length does not match actual bytes.`,
    evidence: [
      ...createByteIntakeAssetEvidence(target),
      `bytesAvailability=${bytesAvailability}`,
      `expectedByteLength=${getExpectedByteLength(target.asset) ?? "missing"}`,
      `actualByteLength=${actualByteLength}`,
      "verificationIssueCode=binary.byteLength.mismatch"
    ],
    relatedAC: ["AC-MVP-004", "AC-MVP-013"],
    relatedScenarios: ["SC-IN-002"],
    impact: "The byte-intake metadata is not truthful for the selected file bytes."
  });

const createMediaTypeMismatchCheck = (
  target: ByteIntakeAssetTarget,
  bytesAvailability: ByteIntakeBytesAvailability
): ValidationCheckResultDto =>
  ValidationCheckResultSchema.parse({
    checkId: "binary.mediaTypeMismatch",
    status: "fail",
    severity: "error",
    phase: "reference",
    target: createTarget(target),
    targetPath: target.targetPath,
    message: `Byte intake asset ${getBinaryAssetId(target.asset)} media type does not match the selected file metadata.`,
    evidence: [
      ...createByteIntakeAssetEvidence(target),
      `bytesAvailability=${bytesAvailability}`,
      `expectedMediaType=${getDeclaredMediaType(target.asset) ?? "missing"}`,
      `actualMediaType=${target.asset.fileMediaType ?? "missing"}`,
      "mediaTypeSource=file-metadata",
      "verificationIssueCode=binary.mediaType.mismatch"
    ],
    relatedAC: ["AC-MVP-004", "AC-MVP-013"],
    relatedScenarios: ["SC-IN-002"],
    impact: "The validator compares declared file metadata only; no parser, decode, or signature sniff is claimed."
  });

const createDigestMismatchCheck = (
  target: ByteIntakeAssetTarget,
  bytesAvailability: ByteIntakeBytesAvailability,
  actualDigest: BinaryAssetDigestDto
): ValidationCheckResultDto =>
  ValidationCheckResultSchema.parse({
    checkId: "binary.digestMismatch",
    status: "fail",
    severity: "error",
    phase: "reference",
    target: createTarget(target),
    targetPath: target.targetPath,
    message: `Byte intake asset ${getBinaryAssetId(target.asset)} digest does not match actual bytes.`,
    evidence: [
      ...createByteIntakeAssetEvidence(target),
      `bytesAvailability=${bytesAvailability}`,
      `expectedDigest=${formatDigest(getExpectedDigest(target.asset))}`,
      `actualDigest=${formatDigest(actualDigest)}`,
      "verificationIssueCode=binary.digest.mismatch"
    ],
    relatedAC: ["AC-MVP-004", "AC-MVP-013"],
    relatedScenarios: ["SC-IN-002"],
    impact: "The selected bytes do not match the SHA-256 metadata recorded for byte intake."
  });

const createDigestUnsupportedCheck = (
  target: ByteIntakeAssetTarget,
  bytesAvailability: ByteIntakeBytesAvailability,
  reason: string
): ValidationCheckResultDto =>
  ValidationCheckResultSchema.parse({
    checkId: "binary.digestUnsupported",
    status: "needs_review",
    severity: "warning",
    phase: "reference",
    target: createTarget(target),
    targetPath: target.targetPath,
    message: `Byte intake asset ${getBinaryAssetId(target.asset)} digest verification is unsupported in this environment.`,
    evidence: [
      ...createByteIntakeAssetEvidence(target),
      `bytesAvailability=${bytesAvailability}`,
      "expectedDigestAlgorithm=sha256",
      `actualDigest=${reason}`,
      "verificationIssueCode=binary.digest.unsupported"
    ],
    relatedAC: ["AC-MVP-004", "AC-MVP-013"],
    relatedScenarios: ["SC-IN-002"],
    impact: "The validator cannot prove byte digest truthfulness without SHA-256 support."
  });

const createByteIntakeProvenanceMissingCheck = (
  target: ByteIntakeAssetTarget
): ValidationCheckResultDto =>
  ValidationCheckResultSchema.parse({
    checkId: "rights.binaryProvenanceMissing",
    status: "fail",
    severity: "error",
    phase: "rights",
    target: createTarget(target),
    targetPath: target.targetPath,
    message: `Byte intake asset ${getBinaryAssetId(target.asset)} is missing provenance metadata.`,
    evidence: [
      ...createByteIntakeAssetEvidence(target),
      "provenanceId=missing",
      "provenanceIdMatch=missing",
      "reason=byte-intake-provenance-missing"
    ],
    relatedAC: ["AC-MVP-002", "AC-MVP-004", "AC-MVP-013"],
    relatedScenarios: ["SC-RIGHTS-002"],
    impact: "The validator cannot trace source filename, creator, license, AI use, or transform history for this byte intake."
  });

const createByteIntakeRightsMissingCheck = (
  target: ByteIntakeAssetTarget
): ValidationCheckResultDto =>
  ValidationCheckResultSchema.parse({
    checkId: "rights.binaryRightsMissing",
    status: "fail",
    severity: "error",
    phase: "rights",
    target: createTarget(target),
    targetPath: target.targetPath,
    message: `Byte intake asset ${getBinaryAssetId(target.asset)} is missing rights metadata.`,
    evidence: [
      ...createByteIntakeAssetEvidence(target),
      "rightsAssetId=missing",
      "rightsAssetMatch=missing",
      "reason=byte-intake-rights-missing"
    ],
    relatedAC: ["AC-MVP-002", "AC-MVP-004", "AC-MVP-013"],
    relatedScenarios: ["SC-RIGHTS-002"],
    impact: "The package cannot prove whether the selected bytes are cleared, need review, or are blocked."
  });

const createUnsupportedClaimCheck = (input: {
  readonly claim: ByteIntakeUnsupportedClaimInput;
  readonly targetKind: Extract<TargetKind, "package" | "sourceAsset" | "texture">;
  readonly targetId: string;
  readonly targetPath: string;
  readonly targetBasePath: string;
}): ValidationCheckResultDto => {
  const truthfulUnsupported = input.claim.status === "unsupported";

  return ValidationCheckResultSchema.parse({
    checkId: "byteIntake.unsupportedClaim",
    status: truthfulUnsupported ? "not_applicable" : "fail",
    severity: truthfulUnsupported ? "info" : "blocking",
    phase: "source_import",
    target: {
      kind: input.targetKind,
      id: input.targetId,
      path: input.targetBasePath
    },
    targetPath: input.targetPath,
    message: truthfulUnsupported
      ? `Byte intake claim ${input.claim.claimKind} is truthfully marked unsupported.`
      : `Byte intake rejects unsupported claim ${input.claim.claimKind}.`,
    evidence: [
      `claimKind=${input.claim.claimKind}`,
      `claimStatus=${input.claim.status}`,
      ...(input.claim.source === undefined ? [] : [`claimSource=${input.claim.source}`]),
      ...(input.claim.evidence ?? [])
    ],
    relatedAC: ["AC-MVP-015", "AC-MVP-016"],
    relatedScenarios: ["SC-IN-002", "SC-RIGHTS-002"],
    impact: truthfulUnsupported
      ? "The byte-intake path records parser, image decode, or archive support as unsupported without claiming implementation."
      : "Wave31 byte intake cannot claim parser, image decode, or archive support."
  });
};

const createTarget = (target: ByteIntakeAssetTarget) => ({
  kind: target.targetKind,
  id: target.targetId,
  path: target.targetPath
});

const createByteIntakeAssetEvidence = (
  target: ByteIntakeAssetTarget
): readonly string[] => [
  `binaryAssetId=${getBinaryAssetId(target.asset)}`,
  `packageRelativePath=${getPackageRelativePath(target.asset)}`,
  `byteIntakeAssetIndex=${target.assetIndex}`,
  `byteLength=${getExpectedByteLength(target.asset) ?? "missing"}`,
  `mediaType=${getDeclaredMediaType(target.asset) ?? "missing"}`,
  `fileMediaType=${target.asset.fileMediaType ?? "missing"}`,
  `digest=${formatDigest(getExpectedDigest(target.asset))}`,
  `provenanceId=${getProvenanceId(target.asset) ?? "missing"}`,
  `rightsAssetId=${getRightsAssetId(target.asset) ?? "missing"}`,
  `sourceFilename=${getSourceFilename(target.asset) ?? "missing"}`,
  `summaryAvailability=${target.asset.intakeSummary?.availability ?? "missing"}`,
  `summaryVerificationStatus=${target.asset.intakeSummary?.verificationStatus ?? "missing"}`,
  "referenceSource=byteIntake.preflight"
];

const getBinaryAssetId = (asset: ByteIntakeAssetPreflightInput): string =>
  asset.binaryAssetId ??
  asset.binaryAssetRef?.binaryAssetId ??
  asset.intakeSummary?.binaryAssetId ??
  "byte-intake-asset";

const getPackageRelativePath = (asset: ByteIntakeAssetPreflightInput): string =>
  asset.packageRelativePath ??
  asset.binaryAssetRef?.packageRelativePath ??
  asset.intakeSummary?.packageRelativePath ??
  "missing";

const getExpectedDigest = (
  asset: ByteIntakeAssetPreflightInput
): BinaryAssetDigestDto | undefined =>
  asset.digest ?? asset.binaryAssetRef?.digest ?? asset.intakeSummary?.digest;

const getExpectedByteLength = (asset: ByteIntakeAssetPreflightInput): number | undefined =>
  asset.byteLength ?? asset.binaryAssetRef?.byteLength ?? asset.intakeSummary?.byteLength;

const getDeclaredMediaType = (asset: ByteIntakeAssetPreflightInput): string | undefined =>
  asset.mediaType ?? asset.binaryAssetRef?.mediaType ?? asset.intakeSummary?.mediaType;

const getProvenanceId = (asset: ByteIntakeAssetPreflightInput): string | undefined =>
  asset.provenanceId ?? asset.binaryAssetRef?.provenanceId ?? asset.intakeSummary?.provenanceId;

const getRightsAssetId = (asset: ByteIntakeAssetPreflightInput): string | undefined =>
  asset.rightsAssetId ?? asset.binaryAssetRef?.rightsAssetId ?? asset.intakeSummary?.rightsAssetId;

const getSourceFilename = (asset: ByteIntakeAssetPreflightInput): string | undefined =>
  asset.sourceFilename ?? asset.intakeSummary?.filename;

const formatDigest = (digest: BinaryAssetDigestDto | undefined): string =>
  digest === undefined ? "missing" : `${digest.algorithm}:${digest.hex}`;

const isBlank = (value: string | undefined): boolean =>
  value === undefined || value.trim().length === 0;

const mapPackageByteAvailability = (
  availability: PackageBinaryByteAvailabilityDto | undefined
): ByteIntakeBytesAvailability | undefined => {
  switch (availability) {
    case "available-package-local-bytes-v1":
    case "available-metadata-mismatch-v1":
    case "verification-unsupported-v1":
      return "available";
    case "ephemeral-browser-file-v1":
      return "ephemeral";
    case "missing-package-local-bytes-v1":
      return "missing";
    case "requires-reupload-v1":
      return "requiresReupload";
    case undefined:
      return undefined;
  }
};
