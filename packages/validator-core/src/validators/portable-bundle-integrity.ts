import {
  PortablePackageBundleV0DtoSchema,
  computePackageBinarySha256Digest,
  type BinaryAssetDigestDto,
  type BinaryAssetReferenceDto,
  type BinaryAssetStorageStatusDto,
  type PackageDocumentDto,
  type PortablePackageBundleBinaryPayloadDto,
  type PortablePackageBundleV0Dto
} from "@private-2d-rigging-lab/package-format";

import type { ValidationCheckResultDto } from "../validation-report.js";
import { ValidationCheckResultSchema } from "../validation-report.js";

type PortableBundleCheckId =
  | "portableBundle.schemaInvalid"
  | "portableBundle.unsupportedVersion"
  | "portableBundle.missingPayload"
  | "portableBundle.missingRequiredBinary"
  | "portableBundle.digestMismatch"
  | "portableBundle.byteLengthMismatch"
  | "portableBundle.availabilityMismatch"
  | "portableBundle.digestUnsupported";

interface PortableBundleSchemaIssue {
  readonly code: string;
  readonly path: readonly PropertyKey[];
}

interface PortableBundlePayloadTarget {
  readonly payload: PortablePackageBundleBinaryPayloadDto;
  readonly payloadIndex: number;
  readonly bytes: Uint8Array;
  readonly targetPath: string;
}

interface RequiredBinaryTarget {
  readonly binaryAssetRef: BinaryAssetReferenceDto;
  readonly referenceSource: string;
  readonly targetKind: "sourceAsset" | "texture";
  readonly targetId: string;
  readonly targetPath: string;
}

const SUPPORTED_BUNDLE_SCHEMA_VERSION = "portable-package-bundle-v0";
const SUPPORTED_BUNDLE_KIND = "project-defined-json-bundle-v0";
const SUPPORTED_PAYLOAD_ENCODING = "base64-v1";
const AVAILABLE_STORAGE_STATUS = "stored-package-local-v1";
const BASE64_DECODE_TABLE = createBase64DecodeTable();

export const validatePortablePackageBundleIntegrity = async (
  bundleEvidence: unknown
): Promise<readonly ValidationCheckResultDto[]> => {
  const bundleResult = PortablePackageBundleV0DtoSchema.safeParse(bundleEvidence);

  if (!bundleResult.success) {
    return createBundleSchemaIssueChecks(bundleEvidence, bundleResult.error.issues);
  }

  const bundle = bundleResult.data;
  const payloadTargets = createPayloadTargets(bundle);
  const checks: ValidationCheckResultDto[] = [];

  for (const payloadTarget of payloadTargets) {
    checks.push(...(await validatePayloadTarget(bundle, payloadTarget)));

    if (payloadTarget.payload.binaryAssetRef.storageStatus !== AVAILABLE_STORAGE_STATUS) {
      checks.push(createAvailabilityMismatchCheck({
        bundle,
        binaryAssetRef: payloadTarget.payload.binaryAssetRef,
        targetKind: "package",
        targetId: payloadTarget.payload.binaryAssetRef.binaryAssetId,
        targetPath: payloadTarget.targetPath,
        referenceSource: "portableBundle.binaryPayloads",
        bundlePayloadIndex: payloadTarget.payloadIndex,
        payloadPresent: true,
        expectedStorageStatus: AVAILABLE_STORAGE_STATUS,
        actualStorageStatus: payloadTarget.payload.binaryAssetRef.storageStatus,
        reason: "payload-ref-storage-status-mismatch"
      }));
    }
  }

  const payloadsByRequiredKey = createPayloadTargetMap(payloadTargets);
  for (const requiredTarget of collectRequiredBinaryTargets(bundle.packageDocument)) {
    const payloadTarget = payloadsByRequiredKey.get(createBinaryAssetPayloadKey(requiredTarget.binaryAssetRef));

    if (requiredTarget.binaryAssetRef.storageStatus !== AVAILABLE_STORAGE_STATUS) {
      checks.push(createAvailabilityMismatchCheck({
        bundle,
        binaryAssetRef: requiredTarget.binaryAssetRef,
        targetKind: requiredTarget.targetKind,
        targetId: requiredTarget.targetId,
        targetPath: requiredTarget.targetPath,
        referenceSource: requiredTarget.referenceSource,
        ...(payloadTarget === undefined ? {} : { bundlePayloadIndex: payloadTarget.payloadIndex }),
        payloadPresent: payloadTarget !== undefined,
        expectedStorageStatus: AVAILABLE_STORAGE_STATUS,
        actualStorageStatus: requiredTarget.binaryAssetRef.storageStatus,
        reason: "required-ref-storage-status-mismatch"
      }));
      continue;
    }

    if (payloadTarget === undefined) {
      checks.push(createMissingRequiredBinaryCheck(bundle, requiredTarget));
      continue;
    }

    if (!binaryAssetReferencesMatch(requiredTarget.binaryAssetRef, payloadTarget.payload.binaryAssetRef)) {
      checks.push(...(await validateBytesAgainstBinaryAssetRef({
        bundle,
        binaryAssetRef: requiredTarget.binaryAssetRef,
        bytes: payloadTarget.bytes,
        targetKind: requiredTarget.targetKind,
        targetId: requiredTarget.targetId,
        targetPath: requiredTarget.targetPath,
        referenceSource: requiredTarget.referenceSource,
        bundlePayloadIndex: payloadTarget.payloadIndex
      })));
    }
  }

  return checks;
};

const createBundleSchemaIssueChecks = (
  bundleEvidence: unknown,
  issues: readonly PortableBundleSchemaIssue[]
): readonly ValidationCheckResultDto[] => {
  const checks = issues.map((issue) => {
    const checkId = mapBundleSchemaIssueCheckId(bundleEvidence, issue);

    return createBundleSchemaIssueCheck({
      bundleEvidence,
      issue,
      checkId
    });
  });

  return checks.sort((left, right) =>
    `${left.checkId}:${left.targetPath ?? ""}`.localeCompare(`${right.checkId}:${right.targetPath ?? ""}`)
  );
};

const mapBundleSchemaIssueCheckId = (
  bundleEvidence: unknown,
  issue: PortableBundleSchemaIssue
): PortableBundleCheckId => {
  if (
    issue.path.length === 1 &&
    issue.path[0] === "schemaVersion" &&
    typeof readRecordField(bundleEvidence, "schemaVersion") === "string" &&
    readRecordField(bundleEvidence, "schemaVersion") !== SUPPORTED_BUNDLE_SCHEMA_VERSION
  ) {
    return "portableBundle.unsupportedVersion";
  }

  if (isMissingPayloadIssue(bundleEvidence, issue)) {
    return "portableBundle.missingPayload";
  }

  return "portableBundle.schemaInvalid";
};

const isMissingPayloadIssue = (
  bundleEvidence: unknown,
  issue: PortableBundleSchemaIssue
): boolean => {
  if (issue.path.length === 1 && issue.path[0] === "binaryPayloads") {
    return readRecordField(bundleEvidence, "binaryPayloads") === undefined;
  }

  if (
    issue.path.length === 3 &&
    issue.path[0] === "binaryPayloads" &&
    typeof issue.path[1] === "number" &&
    issue.path[2] === "payloadBase64"
  ) {
    const payload = readArrayItem(readRecordField(bundleEvidence, "binaryPayloads"), issue.path[1]);
    return readRecordField(payload, "payloadBase64") === undefined;
  }

  return false;
};

const createBundleSchemaIssueCheck = (input: {
  readonly bundleEvidence: unknown;
  readonly issue: PortableBundleSchemaIssue;
  readonly checkId: PortableBundleCheckId;
}): ValidationCheckResultDto => {
  const issueTargetPath = createIssueTargetPath(input.issue.path);
  const payloadIndex = input.issue.path[0] === "binaryPayloads" && typeof input.issue.path[1] === "number"
    ? input.issue.path[1]
    : undefined;
  const checkText = getBundleSchemaIssueText(input.checkId);

  return ValidationCheckResultSchema.parse({
    checkId: input.checkId,
    status: "fail",
    severity: input.checkId === "portableBundle.schemaInvalid" ? "blocking" : "error",
    phase: "source_import",
    target: {
      kind: "package",
      id: getBundleTargetId(input.bundleEvidence),
      path: "/"
    },
    targetPath: issueTargetPath,
    message: checkText.message,
    evidence: [
      ...createBundleEvidence(input.bundleEvidence),
      `issueCode=${input.issue.code}`,
      `issueTargetPath=${issueTargetPath}`,
      ...(payloadIndex === undefined ? [] : [`bundlePayloadIndex=${payloadIndex}`]),
      ...createSchemaSpecificEvidence(input)
    ],
    relatedAC: ["AC-MVP-004", "AC-MVP-013"],
    relatedScenarios: ["SC-IN-002"],
    impact: checkText.impact
  });
};

const createPayloadTargets = (
  bundle: PortablePackageBundleV0Dto
): readonly PortableBundlePayloadTarget[] =>
  bundle.binaryPayloads.map((payload, payloadIndex) => ({
    payload,
    payloadIndex,
    bytes: decodeStandardBase64(payload.payloadBase64),
    targetPath: `/binaryPayloads/${payloadIndex}`
  }));

const validatePayloadTarget = async (
  bundle: PortablePackageBundleV0Dto,
  target: PortableBundlePayloadTarget
): Promise<readonly ValidationCheckResultDto[]> =>
  validateBytesAgainstBinaryAssetRef({
    bundle,
    binaryAssetRef: target.payload.binaryAssetRef,
    bytes: target.bytes,
    targetKind: "package",
    targetId: target.payload.binaryAssetRef.binaryAssetId,
    targetPath: target.targetPath,
    referenceSource: "portableBundle.binaryPayloads",
    bundlePayloadIndex: target.payloadIndex,
    payloadBase64Length: target.payload.payloadBase64.length
  });

const validateBytesAgainstBinaryAssetRef = async (input: {
  readonly bundle: PortablePackageBundleV0Dto | undefined;
  readonly binaryAssetRef: BinaryAssetReferenceDto;
  readonly bytes: Uint8Array;
  readonly targetKind: "package" | "sourceAsset" | "texture";
  readonly targetId: string;
  readonly targetPath: string;
  readonly referenceSource: string;
  readonly bundlePayloadIndex: number;
  readonly payloadBase64Length?: number;
}): Promise<readonly ValidationCheckResultDto[]> => {
  const checks: ValidationCheckResultDto[] = [];
  const actualByteLength = input.bytes.byteLength;

  if (actualByteLength !== input.binaryAssetRef.byteLength) {
    checks.push(createPayloadByteLengthMismatchCheck({
      ...input,
      actualByteLength
    }));
  }

  const digestResult = await computePackageBinarySha256Digest(input.bytes);
  if (digestResult.status === "unsupported") {
    checks.push(createPayloadDigestUnsupportedCheck({
      ...input,
      actualDigest: digestResult.reason
    }));
  } else if (digestResult.digest.hex !== input.binaryAssetRef.digest.hex) {
    checks.push(createPayloadDigestMismatchCheck({
      ...input,
      actualByteLength,
      actualDigest: digestResult.digest
    }));
  }

  return checks;
};

const collectRequiredBinaryTargets = (
  packageDocument: PackageDocumentDto
): readonly RequiredBinaryTarget[] => [
  ...packageDocument.assets.sourceManifest.sourceAssets.flatMap((sourceAsset, sourceAssetIndex) => {
    if (sourceAsset.binaryAssetRef === undefined) {
      return [];
    }

    const targetPath = `/packageDocument/assets/sourceManifest/sourceAssets/${sourceAssetIndex}/binaryAssetRef`;
    return [{
      binaryAssetRef: sourceAsset.binaryAssetRef,
      referenceSource: "packageDocument.assets.sourceManifest.sourceAssets.binaryAssetRef",
      targetKind: "sourceAsset" as const,
      targetId: sourceAsset.sourceAssetId,
      targetPath
    }];
  }),
  ...(packageDocument.assets.textureAtlas?.textures.flatMap((textureEntry, textureIndex) => {
    if (textureEntry.binaryAssetRef === undefined) {
      return [];
    }

    const targetPath = `/packageDocument/assets/textureAtlas/textures/${textureIndex}/binaryAssetRef`;
    return [{
      binaryAssetRef: textureEntry.binaryAssetRef,
      referenceSource: "packageDocument.assets.textureAtlas.textures.binaryAssetRef",
      targetKind: "texture" as const,
      targetId: textureEntry.textureId,
      targetPath
    }];
  }) ?? [])
];

const createPayloadTargetMap = (
  payloadTargets: readonly PortableBundlePayloadTarget[]
): ReadonlyMap<string, PortableBundlePayloadTarget> => {
  const payloadsByRequiredKey = new Map<string, PortableBundlePayloadTarget>();

  for (const payloadTarget of payloadTargets) {
    const key = createBinaryAssetPayloadKey(payloadTarget.payload.binaryAssetRef);
    if (!payloadsByRequiredKey.has(key)) {
      payloadsByRequiredKey.set(key, payloadTarget);
    }
  }

  return payloadsByRequiredKey;
};

const createMissingRequiredBinaryCheck = (
  bundle: PortablePackageBundleV0Dto,
  target: RequiredBinaryTarget
): ValidationCheckResultDto =>
  ValidationCheckResultSchema.parse({
    checkId: "portableBundle.missingRequiredBinary",
    status: "fail",
    severity: "error",
    phase: "source_import",
    target: {
      kind: target.targetKind,
      id: target.targetId,
      path: target.targetPath
    },
    targetPath: target.targetPath,
    message: `Portable bundle is missing required binary payload for ${target.binaryAssetRef.binaryAssetId}.`,
    evidence: [
      ...createBundleEvidence(bundle),
      ...createBinaryAssetRefEvidence(target.binaryAssetRef),
      `referenceSource=${target.referenceSource}`,
      "bundlePayloadIndex=missing",
      "binaryPayloadMatch=missing",
      `expectedStorageStatus=${AVAILABLE_STORAGE_STATUS}`,
      `actualStorageStatus=${target.binaryAssetRef.storageStatus}`
    ],
    relatedAC: ["AC-MVP-004", "AC-MVP-013"],
    relatedScenarios: ["SC-IN-002"],
    impact: "The portable bundle cannot prove package-local byte truthfulness for this required binary asset."
  });

const createPayloadByteLengthMismatchCheck = (input: {
  readonly bundle: PortablePackageBundleV0Dto | undefined;
  readonly binaryAssetRef: BinaryAssetReferenceDto;
  readonly actualByteLength: number;
  readonly targetKind: "package" | "sourceAsset" | "texture";
  readonly targetId: string;
  readonly targetPath: string;
  readonly referenceSource: string;
  readonly bundlePayloadIndex: number;
  readonly payloadBase64Length?: number;
}): ValidationCheckResultDto =>
  ValidationCheckResultSchema.parse({
    checkId: "portableBundle.byteLengthMismatch",
    status: "fail",
    severity: "error",
    phase: "source_import",
    target: {
      kind: input.targetKind,
      id: input.targetId,
      path: input.targetPath
    },
    targetPath: input.targetPath,
    message: `Portable bundle binary payload length does not match ${input.binaryAssetRef.binaryAssetId}.`,
    evidence: [
      ...createBundleEvidence(input.bundle),
      ...createBinaryAssetRefEvidence(input.binaryAssetRef),
      ...createPayloadEvidence(input),
      `expectedByteLength=${input.binaryAssetRef.byteLength}`,
      `actualByteLength=${input.actualByteLength}`,
      "verificationIssueCode=portableBundle.byteLengthMismatch"
    ],
    relatedAC: ["AC-MVP-004", "AC-MVP-013"],
    relatedScenarios: ["SC-IN-002"],
    impact: "The portable bundle payload bytes do not match the binary asset byte length metadata."
  });

const createPayloadDigestMismatchCheck = (input: {
  readonly bundle: PortablePackageBundleV0Dto | undefined;
  readonly binaryAssetRef: BinaryAssetReferenceDto;
  readonly actualByteLength: number;
  readonly actualDigest: BinaryAssetDigestDto;
  readonly targetKind: "package" | "sourceAsset" | "texture";
  readonly targetId: string;
  readonly targetPath: string;
  readonly referenceSource: string;
  readonly bundlePayloadIndex: number;
  readonly payloadBase64Length?: number;
}): ValidationCheckResultDto =>
  ValidationCheckResultSchema.parse({
    checkId: "portableBundle.digestMismatch",
    status: "fail",
    severity: "error",
    phase: "source_import",
    target: {
      kind: input.targetKind,
      id: input.targetId,
      path: input.targetPath
    },
    targetPath: input.targetPath,
    message: `Portable bundle binary payload digest does not match ${input.binaryAssetRef.binaryAssetId}.`,
    evidence: [
      ...createBundleEvidence(input.bundle),
      ...createBinaryAssetRefEvidence(input.binaryAssetRef),
      ...createPayloadEvidence(input),
      `expectedByteLength=${input.binaryAssetRef.byteLength}`,
      `actualByteLength=${input.actualByteLength}`,
      `expectedDigest=${formatDigest(input.binaryAssetRef.digest)}`,
      `actualDigest=${formatDigest(input.actualDigest)}`,
      "verificationIssueCode=portableBundle.digestMismatch"
    ],
    relatedAC: ["AC-MVP-004", "AC-MVP-013"],
    relatedScenarios: ["SC-IN-002"],
    impact: "The portable bundle payload bytes do not match the binary asset SHA-256 metadata."
  });

const createPayloadDigestUnsupportedCheck = (input: {
  readonly bundle: PortablePackageBundleV0Dto | undefined;
  readonly binaryAssetRef: BinaryAssetReferenceDto;
  readonly actualDigest: string;
  readonly targetKind: "package" | "sourceAsset" | "texture";
  readonly targetId: string;
  readonly targetPath: string;
  readonly referenceSource: string;
  readonly bundlePayloadIndex: number;
  readonly payloadBase64Length?: number;
}): ValidationCheckResultDto =>
  ValidationCheckResultSchema.parse({
    checkId: "portableBundle.digestUnsupported",
    status: "needs_review",
    severity: "warning",
    phase: "source_import",
    target: {
      kind: input.targetKind,
      id: input.targetId,
      path: input.targetPath
    },
    targetPath: input.targetPath,
    message: `Portable bundle binary payload digest verification is unsupported for ${input.binaryAssetRef.binaryAssetId}.`,
    evidence: [
      ...createBundleEvidence(input.bundle),
      ...createBinaryAssetRefEvidence(input.binaryAssetRef),
      ...createPayloadEvidence(input),
      "expectedDigestAlgorithm=sha256",
      `actualDigest=${input.actualDigest}`,
      "verificationIssueCode=portableBundle.digestUnsupported"
    ],
    relatedAC: ["AC-MVP-004", "AC-MVP-013"],
    relatedScenarios: ["SC-IN-002"],
    impact: "The validator cannot prove portable bundle byte digest truthfulness without SHA-256 support."
  });

const createAvailabilityMismatchCheck = (input: {
  readonly bundle: PortablePackageBundleV0Dto;
  readonly binaryAssetRef: BinaryAssetReferenceDto;
  readonly targetKind: "package" | "sourceAsset" | "texture";
  readonly targetId: string;
  readonly targetPath: string;
  readonly referenceSource: string;
  readonly bundlePayloadIndex?: number;
  readonly payloadPresent: boolean;
  readonly expectedStorageStatus: BinaryAssetStorageStatusDto;
  readonly actualStorageStatus: BinaryAssetStorageStatusDto;
  readonly reason: string;
}): ValidationCheckResultDto =>
  ValidationCheckResultSchema.parse({
    checkId: "portableBundle.availabilityMismatch",
    status: "fail",
    severity: "error",
    phase: "source_import",
    target: {
      kind: input.targetKind,
      id: input.targetId,
      path: input.targetPath
    },
    targetPath: input.targetPath,
    message: `Portable bundle availability metadata is not truthful for ${input.binaryAssetRef.binaryAssetId}.`,
    evidence: [
      ...createBundleEvidence(input.bundle),
      ...createBinaryAssetRefEvidence(input.binaryAssetRef),
      `referenceSource=${input.referenceSource}`,
      `bundlePayloadIndex=${input.bundlePayloadIndex ?? "missing"}`,
      `payloadPresent=${input.payloadPresent}`,
      `expectedStorageStatus=${input.expectedStorageStatus}`,
      `actualStorageStatus=${input.actualStorageStatus}`,
      `reason=${input.reason}`
    ],
    relatedAC: ["AC-MVP-004", "AC-MVP-013"],
    relatedScenarios: ["SC-IN-002"],
    impact: "Portable bundle bytes must be represented as stored package-local bytes before import can treat them as available."
  });

const createPayloadEvidence = (input: {
  readonly referenceSource: string;
  readonly bundlePayloadIndex: number;
  readonly payloadBase64Length?: number;
}): readonly string[] => [
  `referenceSource=${input.referenceSource}`,
  `bundlePayloadIndex=${input.bundlePayloadIndex}`,
  `payloadEncoding=${SUPPORTED_PAYLOAD_ENCODING}`,
  ...(input.payloadBase64Length === undefined ? [] : [`payloadBase64Length=${input.payloadBase64Length}`])
];

const createBundleEvidence = (
  bundle: PortablePackageBundleV0Dto | unknown
): readonly string[] => [
  `bundleSchemaVersion=${formatEvidenceValue(readBundleField(bundle, "schemaVersion"))}`,
  `bundleKind=${formatEvidenceValue(readBundleField(bundle, "bundleKind"))}`,
  `packageId=${formatEvidenceValue(readBundleField(bundle, "packageId"))}`,
  `packageRevision=${formatEvidenceValue(readBundleField(bundle, "packageRevision"))}`,
  `binaryPayloadCount=${formatEvidenceValue(getBinaryPayloadCount(bundle))}`
];

const createBinaryAssetRefEvidence = (
  binaryAssetRef: BinaryAssetReferenceDto
): readonly string[] => [
  `binaryAssetId=${binaryAssetRef.binaryAssetId}`,
  `packageRelativePath=${binaryAssetRef.packageRelativePath}`,
  `storageStatus=${binaryAssetRef.storageStatus}`,
  `byteLength=${binaryAssetRef.byteLength}`,
  `mediaType=${binaryAssetRef.mediaType}`,
  `digest=${formatDigest(binaryAssetRef.digest)}`,
  `provenanceId=${binaryAssetRef.provenanceId}`,
  `rightsAssetId=${binaryAssetRef.rightsAssetId}`
];

const createSchemaSpecificEvidence = (input: {
  readonly bundleEvidence: unknown;
  readonly issue: PortableBundleSchemaIssue;
  readonly checkId: PortableBundleCheckId;
}): readonly string[] => {
  switch (input.checkId) {
    case "portableBundle.unsupportedVersion":
      return [
        `expectedBundleSchemaVersion=${SUPPORTED_BUNDLE_SCHEMA_VERSION}`,
        `actualBundleSchemaVersion=${formatEvidenceValue(readRecordField(input.bundleEvidence, "schemaVersion"))}`
      ];
    case "portableBundle.missingPayload":
      return [
        `payloadEncoding=${formatEvidenceValue(readPayloadIssueField(input.bundleEvidence, input.issue, "payloadEncoding"))}`,
        "payloadBase64=missing"
      ];
    default:
      return [
        `expectedBundleSchemaVersion=${SUPPORTED_BUNDLE_SCHEMA_VERSION}`,
        `expectedBundleKind=${SUPPORTED_BUNDLE_KIND}`
      ];
  }
};

const getBundleSchemaIssueText = (
  checkId: PortableBundleCheckId
): { readonly message: string; readonly impact: string } => {
  switch (checkId) {
    case "portableBundle.unsupportedVersion":
      return {
        message: "Portable bundle schemaVersion is not supported.",
        impact: "The validator cannot use this bundle as project-defined portable bundle v0 evidence."
      };
    case "portableBundle.missingPayload":
      return {
        message: "Portable bundle binary payload is missing base64 bytes.",
        impact: "The validator cannot prove binary payload byte length or digest truthfulness without payload bytes."
      };
    default:
      return {
        message: "Portable bundle evidence does not match the project-defined JSON bundle v0 contract.",
        impact: "The validator cannot use malformed portable bundle evidence for byte integrity checks."
      };
  }
};

const createBinaryAssetPayloadKey = (binaryAssetRef: BinaryAssetReferenceDto): string =>
  `${binaryAssetRef.binaryAssetId}\u0000${binaryAssetRef.packageRelativePath}`;

const binaryAssetReferencesMatch = (
  left: BinaryAssetReferenceDto,
  right: BinaryAssetReferenceDto
): boolean =>
  left.referenceKind === right.referenceKind &&
  left.binaryAssetId === right.binaryAssetId &&
  left.packageRelativePath === right.packageRelativePath &&
  left.digest.algorithm === right.digest.algorithm &&
  left.digest.hex === right.digest.hex &&
  left.byteLength === right.byteLength &&
  left.mediaType === right.mediaType &&
  left.storageStatus === right.storageStatus &&
  left.provenanceId === right.provenanceId &&
  left.rightsAssetId === right.rightsAssetId;

const decodeStandardBase64 = (payloadBase64: string): Uint8Array => {
  const paddingLength = payloadBase64.endsWith("==")
    ? 2
    : payloadBase64.endsWith("=")
      ? 1
      : 0;
  const outputLength = Math.floor((payloadBase64.length * 3) / 4) - paddingLength;
  const bytes = new Uint8Array(outputLength);
  let outputIndex = 0;

  for (let inputIndex = 0; inputIndex < payloadBase64.length; inputIndex += 4) {
    const first = decodeBase64Character(payloadBase64[inputIndex]);
    const second = decodeBase64Character(payloadBase64[inputIndex + 1]);
    const third = payloadBase64[inputIndex + 2] === "="
      ? 0
      : decodeBase64Character(payloadBase64[inputIndex + 2]);
    const fourth = payloadBase64[inputIndex + 3] === "="
      ? 0
      : decodeBase64Character(payloadBase64[inputIndex + 3]);
    const triplet = (first << 18) | (second << 12) | (third << 6) | fourth;

    if (outputIndex < outputLength) {
      bytes[outputIndex] = (triplet >> 16) & 0xff;
      outputIndex += 1;
    }
    if (outputIndex < outputLength) {
      bytes[outputIndex] = (triplet >> 8) & 0xff;
      outputIndex += 1;
    }
    if (outputIndex < outputLength) {
      bytes[outputIndex] = triplet & 0xff;
      outputIndex += 1;
    }
  }

  return bytes;
};

function createBase64DecodeTable(): ReadonlyMap<string, number> {
  const table = new Map<string, number>();
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

  for (let index = 0; index < alphabet.length; index += 1) {
    const character = alphabet[index];
    if (character !== undefined) {
      table.set(character, index);
    }
  }

  return table;
}

const decodeBase64Character = (character: string | undefined): number => {
  const value = character === undefined ? undefined : BASE64_DECODE_TABLE.get(character);

  if (value === undefined) {
    throw new Error("Portable bundle payloadBase64 passed schema validation but contained an invalid base64 character.");
  }

  return value;
};

const createIssueTargetPath = (
  path: readonly PropertyKey[]
): string =>
  path.length === 0 ? "/" : `/${path.map((segment) => String(segment)).join("/")}`;

const getBundleTargetId = (bundleEvidence: unknown): string => {
  const packageId = readRecordField(bundleEvidence, "packageId");
  return typeof packageId === "string" ? packageId : "portable-bundle";
};

const readPayloadIssueField = (
  bundleEvidence: unknown,
  issue: PortableBundleSchemaIssue,
  fieldName: string
): unknown => {
  if (issue.path[0] !== "binaryPayloads" || typeof issue.path[1] !== "number") {
    return undefined;
  }

  const payload = readArrayItem(readRecordField(bundleEvidence, "binaryPayloads"), issue.path[1]);
  return readRecordField(payload, fieldName);
};

const readBundleField = (
  bundle: PortablePackageBundleV0Dto | unknown,
  fieldName: string
): unknown =>
  readRecordField(bundle, fieldName);

const readRecordField = (
  value: unknown,
  fieldName: string
): unknown => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  return (value as Readonly<Record<string, unknown>>)[fieldName];
};

const readArrayItem = (
  value: unknown,
  index: number
): unknown =>
  Array.isArray(value) ? value[index] : undefined;

const getBinaryPayloadCount = (
  bundle: PortablePackageBundleV0Dto | unknown
): number | "missing" => {
  const binaryPayloads = readRecordField(bundle, "binaryPayloads");
  return Array.isArray(binaryPayloads) ? binaryPayloads.length : "missing";
};

const formatDigest = (digest: BinaryAssetDigestDto): string =>
  `${digest.algorithm}:${digest.hex}`;

const formatEvidenceValue = (value: unknown): string => {
  if (value === undefined) {
    return "missing";
  }

  if (value === null) {
    return "null";
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (Array.isArray(value)) {
    return `array(${value.length})`;
  }

  return typeof value;
};
