import {
  BinaryAssetReferenceSchema,
  type BinaryAssetReferenceDto
} from "./binary-asset.js";
import {
  createPackageBinaryFileEntry,
  createPackageInMemoryFileSet,
  readPackageBinaryFileEntry,
  verifyPackageBinaryAssetBytes,
  type PackageBinaryAssetVerificationIssue,
  type PackageBinaryAssetVerificationReport,
  type PackageBinaryFileEntry,
  type PackageInMemoryFileSet
} from "./package-binary-file-set.js";
import { serializePackageDocumentToFileSet } from "./package-file-set.js";
import { PackageDocumentSchema, type PackageDocumentDto } from "./package-document.js";
import {
  PortablePackageBundleV0DtoSchema,
  type PortablePackageBundleV0Dto
} from "./portable-package-bundle-contract.js";

const BASE64_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

export type PortablePackageBundleIssueCode =
  | "portableBundle.binaryAssetRef.mismatch"
  | "portableBundle.binaryBytes.missing"
  | "portableBundle.binaryPayload.duplicate"
  | "portableBundle.binaryPayload.extra"
  | "portableBundle.binaryPayload.missing"
  | "portableBundle.binaryRef.conflict"
  | "portableBundle.byteLength.mismatch"
  | "portableBundle.digest.mismatch"
  | "portableBundle.digest.unsupported"
  | "portableBundle.json.invalid"
  | "portableBundle.mediaType.mismatch"
  | "portableBundle.requiresReupload"
  | "portableBundle.schema.invalid";

export interface PortablePackageBundleIssue {
  readonly code: PortablePackageBundleIssueCode;
  readonly targetPath: string;
  readonly expected: string;
  readonly actual: string;
  readonly message: string;
}

export class PortablePackageBundleError extends Error {
  readonly code: PortablePackageBundleIssueCode;
  readonly issues: readonly PortablePackageBundleIssue[];

  constructor(issues: readonly PortablePackageBundleIssue[]) {
    const firstIssue = issues[0];

    super(firstIssue?.message ?? "Portable package bundle operation failed.");
    this.name = "PortablePackageBundleError";
    this.code = firstIssue?.code ?? "portableBundle.schema.invalid";
    this.issues = [...issues];
  }
}

export interface ExportPortablePackageBundleV0Input {
  readonly packageDocument: PackageDocumentDto;
  readonly fileSet: PackageInMemoryFileSet;
  readonly requiresReupload?: (binaryAssetRef: BinaryAssetReferenceDto) => boolean;
}

export interface ImportPortablePackageBundleV0Input {
  readonly bundle: unknown;
}

export interface ImportPortablePackageBundleV0Result {
  readonly bundle: PortablePackageBundleV0Dto;
  readonly packageDocument: PackageDocumentDto;
  readonly binaryEntries: readonly PackageBinaryFileEntry[];
  readonly fileSet: PackageInMemoryFileSet;
  readonly verificationReports: readonly PackageBinaryAssetVerificationReport[];
}

interface IndexedBinaryAssetReference {
  readonly ref: BinaryAssetReferenceDto;
  readonly targetPath: string;
}

interface IndexedBinaryPayload {
  readonly payload: PortablePackageBundleV0Dto["binaryPayloads"][number];
  readonly targetPath: string;
}

export async function exportPortablePackageBundleV0(
  input: ExportPortablePackageBundleV0Input
): Promise<PortablePackageBundleV0Dto> {
  const packageDocument = PackageDocumentSchema.parse(input.packageDocument);
  const binaryAssetRefs = collectPackageDocumentBinaryAssetRefs(packageDocument);
  const binaryPayloads: PortablePackageBundleV0Dto["binaryPayloads"] = [];
  const issues: PortablePackageBundleIssue[] = [];

  for (let index = 0; index < binaryAssetRefs.length; index += 1) {
    const binaryAssetRef = binaryAssetRefs[index]?.ref;

    if (binaryAssetRef === undefined) {
      continue;
    }

    const targetPath = `/binaryPayloads/${index}`;

    if (input.requiresReupload?.(binaryAssetRef) === true) {
      issues.push(createIssue({
        code: "portableBundle.requiresReupload",
        targetPath,
        expected: "current-session-bytes",
        actual: "requires-reupload",
        message: `Portable bundle export requires current bytes for "${binaryAssetRef.packageRelativePath}".`
      }));
      continue;
    }

    const verificationReport = await verifyPackageBinaryAssetBytes(input.fileSet, binaryAssetRef);
    issues.push(...mapVerificationReportIssues(verificationReport, targetPath));

    if (verificationReport.status !== "pass") {
      continue;
    }

    const binaryEntry = readPackageBinaryFileEntry(input.fileSet, binaryAssetRef);

    if (binaryEntry === undefined) {
      issues.push(createIssue({
        code: "portableBundle.binaryBytes.missing",
        targetPath,
        expected: binaryAssetRef.packageRelativePath,
        actual: "missing",
        message: `Missing binary bytes for "${binaryAssetRef.packageRelativePath}".`
      }));
      continue;
    }

    binaryPayloads.push({
      binaryAssetRef,
      payloadEncoding: "base64-v1",
      payloadBase64: encodeBase64(binaryEntry.bytes)
    });
  }

  throwIfIssues(issues);

  return PortablePackageBundleV0DtoSchema.parse({
    schemaVersion: "portable-package-bundle-v0",
    bundleKind: "project-defined-json-bundle-v0",
    packageId: packageDocument.manifest.packageId,
    packageRevision: packageDocument.manifest.packageRevision,
    packageDocument,
    binaryPayloads
  });
}

export async function importPortablePackageBundleV0(
  input: ImportPortablePackageBundleV0Input
): Promise<ImportPortablePackageBundleV0Result> {
  const bundle = parsePortablePackageBundleV0(input.bundle);
  const expectedRefs = collectPackageDocumentBinaryAssetRefs(bundle.packageDocument);
  const payloads = assertPortableBundlePayloadConsistency(bundle, expectedRefs);
  const binaryEntries: PackageBinaryFileEntry[] = [];
  const verificationReports: PackageBinaryAssetVerificationReport[] = [];
  const issues: PortablePackageBundleIssue[] = [];

  for (let index = 0; index < expectedRefs.length; index += 1) {
    const expectedRef = expectedRefs[index]?.ref;

    if (expectedRef === undefined) {
      continue;
    }

    const payload = payloads.get(getBinaryAssetRefKey(expectedRef));

    if (payload === undefined) {
      continue;
    }

    const bytes = decodeBase64(payload.payload.payloadBase64);
    const binaryEntry = createPackageBinaryFileEntry({
      path: expectedRef.packageRelativePath,
      bytes,
      mediaType: expectedRef.mediaType,
      binaryAssetId: expectedRef.binaryAssetId
    });
    const verificationFileSet = createPackageInMemoryFileSet([binaryEntry]);
    const verificationReport = await verifyPackageBinaryAssetBytes(
      verificationFileSet,
      expectedRef
    );

    verificationReports.push(verificationReport);
    issues.push(...mapVerificationReportIssues(verificationReport, payload.targetPath));

    if (verificationReport.status === "pass") {
      binaryEntries.push(binaryEntry);
    }
  }

  throwIfIssues(issues);

  return {
    bundle,
    packageDocument: bundle.packageDocument,
    binaryEntries,
    fileSet: createPackageInMemoryFileSet([
      ...serializePackageDocumentToFileSet(bundle.packageDocument),
      ...binaryEntries
    ]),
    verificationReports
  };
}

function parsePortablePackageBundleV0(input: unknown): PortablePackageBundleV0Dto {
  const rawBundle = typeof input === "string"
    ? parsePortableBundleJson(input)
    : input;
  const parsed = PortablePackageBundleV0DtoSchema.safeParse(rawBundle);

  if (!parsed.success) {
    throw new PortablePackageBundleError([createIssue({
      code: "portableBundle.schema.invalid",
      targetPath: "/",
      expected: "PortablePackageBundleV0Dto",
      actual: parsed.error.issues
        .map((issue) => `${formatZodPath(issue.path)}: ${issue.message}`)
        .join("; "),
      message: "Portable package bundle does not match portable-package-bundle-v0."
    })]);
  }

  return parsed.data;
}

function parsePortableBundleJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    throw new PortablePackageBundleError([createIssue({
      code: "portableBundle.json.invalid",
      targetPath: "/",
      expected: "valid JSON",
      actual: message,
      message: `Portable package bundle JSON is invalid: ${message}`
    })]);
  }
}

function collectPackageDocumentBinaryAssetRefs(
  packageDocument: PackageDocumentDto
): readonly IndexedBinaryAssetReference[] {
  const refsByKey = new Map<string, IndexedBinaryAssetReference>();
  const issues: PortablePackageBundleIssue[] = [];

  packageDocument.assets.sourceManifest.sourceAssets.forEach((sourceAsset, index) => {
    if (sourceAsset.binaryAssetRef === undefined) {
      return;
    }

    addBinaryAssetRef({
      refsByKey,
      issues,
      ref: sourceAsset.binaryAssetRef,
      targetPath: `/packageDocument/assets/sourceManifest/sourceAssets/${index}/binaryAssetRef`
    });
  });

  packageDocument.assets.textureAtlas?.textures.forEach((texture, index) => {
    if (texture.binaryAssetRef === undefined) {
      return;
    }

    addBinaryAssetRef({
      refsByKey,
      issues,
      ref: texture.binaryAssetRef,
      targetPath: `/packageDocument/assets/textureAtlas/textures/${index}/binaryAssetRef`
    });
  });

  throwIfIssues(issues);

  return [...refsByKey.values()];
}

function addBinaryAssetRef(input: {
  readonly refsByKey: Map<string, IndexedBinaryAssetReference>;
  readonly issues: PortablePackageBundleIssue[];
  readonly ref: BinaryAssetReferenceDto;
  readonly targetPath: string;
}): void {
  const ref = BinaryAssetReferenceSchema.parse(input.ref);
  const key = getBinaryAssetRefKey(ref);
  const existingRef = input.refsByKey.get(key)?.ref;

  if (existingRef === undefined) {
    input.refsByKey.set(key, {
      ref,
      targetPath: input.targetPath
    });
    return;
  }

  if (!areBinaryAssetRefsEqual(existingRef, ref)) {
    input.issues.push(createIssue({
      code: "portableBundle.binaryRef.conflict",
      targetPath: input.targetPath,
      expected: formatBinaryAssetRef(existingRef),
      actual: formatBinaryAssetRef(ref),
      message: `Conflicting binary asset references for "${ref.packageRelativePath}".`
    }));
  }
}

function assertPortableBundlePayloadConsistency(
  bundle: PortablePackageBundleV0Dto,
  expectedRefs: readonly IndexedBinaryAssetReference[]
): ReadonlyMap<string, IndexedBinaryPayload> {
  const expectedRefsByKey = new Map(
    expectedRefs.map((ref) => [getBinaryAssetRefKey(ref.ref), ref])
  );
  const payloadsByKey = new Map<string, IndexedBinaryPayload>();
  const issues: PortablePackageBundleIssue[] = [];

  bundle.binaryPayloads.forEach((payload, index) => {
    const key = getBinaryAssetRefKey(payload.binaryAssetRef);
    const targetPath = `/binaryPayloads/${index}`;
    const existingPayload = payloadsByKey.get(key);
    const expectedRef = expectedRefsByKey.get(key)?.ref;

    if (existingPayload !== undefined) {
      issues.push(createIssue({
        code: "portableBundle.binaryPayload.duplicate",
        targetPath,
        expected: "one payload per package-relative binary path",
        actual: payload.binaryAssetRef.packageRelativePath,
        message: `Duplicate binary payload for "${payload.binaryAssetRef.packageRelativePath}".`
      }));
      return;
    }

    if (expectedRef === undefined) {
      issues.push(createIssue({
        code: "portableBundle.binaryPayload.extra",
        targetPath,
        expected: "payload referenced by packageDocument",
        actual: formatBinaryAssetRef(payload.binaryAssetRef),
        message: `Portable bundle payload is not referenced by the package document: "${payload.binaryAssetRef.packageRelativePath}".`
      }));
      payloadsByKey.set(key, {
        payload,
        targetPath
      });
      return;
    }

    if (!areBinaryAssetRefsEqual(expectedRef, payload.binaryAssetRef)) {
      issues.push(createIssue({
        code: "portableBundle.binaryAssetRef.mismatch",
        targetPath: `${targetPath}/binaryAssetRef`,
        expected: formatBinaryAssetRef(expectedRef),
        actual: formatBinaryAssetRef(payload.binaryAssetRef),
        message: `Portable bundle payload metadata does not match package document ref for "${expectedRef.packageRelativePath}".`
      }));
    }

    payloadsByKey.set(key, {
      payload,
      targetPath
    });
  });

  for (const expectedRef of expectedRefs) {
    const key = getBinaryAssetRefKey(expectedRef.ref);

    if (!payloadsByKey.has(key)) {
      issues.push(createIssue({
        code: "portableBundle.binaryPayload.missing",
        targetPath: "/binaryPayloads",
        expected: formatBinaryAssetRef(expectedRef.ref),
        actual: "missing",
        message: `Missing portable bundle payload for "${expectedRef.ref.packageRelativePath}".`
      }));
    }
  }

  throwIfIssues(issues);

  return payloadsByKey;
}

function mapVerificationReportIssues(
  report: PackageBinaryAssetVerificationReport,
  targetPath: string
): readonly PortablePackageBundleIssue[] {
  return report.issues.map((issue) => mapVerificationIssue(issue, targetPath));
}

function mapVerificationIssue(
  issue: PackageBinaryAssetVerificationIssue,
  targetPath: string
): PortablePackageBundleIssue {
  switch (issue.code) {
    case "binary.assetId.mismatch":
      return createIssue({
        code: "portableBundle.binaryAssetRef.mismatch",
        targetPath,
        expected: issue.expected,
        actual: issue.actual,
        message: issue.message
      });
    case "binary.byteLength.mismatch":
      return createIssue({
        code: "portableBundle.byteLength.mismatch",
        targetPath,
        expected: issue.expected,
        actual: issue.actual,
        message: issue.message
      });
    case "binary.bytes.missing":
      return createIssue({
        code: "portableBundle.binaryBytes.missing",
        targetPath,
        expected: issue.expected,
        actual: issue.actual,
        message: issue.message
      });
    case "binary.digest.mismatch":
      return createIssue({
        code: "portableBundle.digest.mismatch",
        targetPath,
        expected: issue.expected,
        actual: issue.actual,
        message: issue.message
      });
    case "binary.digest.unsupported":
      return createIssue({
        code: "portableBundle.digest.unsupported",
        targetPath,
        expected: issue.expected,
        actual: issue.actual,
        message: issue.message
      });
    case "binary.mediaType.mismatch":
      return createIssue({
        code: "portableBundle.mediaType.mismatch",
        targetPath,
        expected: issue.expected,
        actual: issue.actual,
        message: issue.message
      });
  }
}

function areBinaryAssetRefsEqual(
  left: BinaryAssetReferenceDto,
  right: BinaryAssetReferenceDto
): boolean {
  return left.referenceKind === right.referenceKind &&
    left.binaryAssetId === right.binaryAssetId &&
    left.packageRelativePath === right.packageRelativePath &&
    left.digest.algorithm === right.digest.algorithm &&
    left.digest.hex === right.digest.hex &&
    left.byteLength === right.byteLength &&
    left.mediaType === right.mediaType &&
    left.storageStatus === right.storageStatus &&
    left.provenanceId === right.provenanceId &&
    left.rightsAssetId === right.rightsAssetId;
}

function getBinaryAssetRefKey(ref: BinaryAssetReferenceDto): string {
  return ref.packageRelativePath;
}

function formatBinaryAssetRef(ref: BinaryAssetReferenceDto): string {
  return [
    `${ref.binaryAssetId}@${ref.packageRelativePath}`,
    `${ref.digest.algorithm}:${ref.digest.hex}`,
    `byteLength=${ref.byteLength}`,
    `mediaType=${ref.mediaType}`,
    `storageStatus=${ref.storageStatus}`,
    `provenanceId=${ref.provenanceId}`,
    `rightsAssetId=${ref.rightsAssetId}`
  ].join(" ");
}

function encodeBase64(bytes: Uint8Array): string {
  let output = "";

  for (let index = 0; index < bytes.length; index += 3) {
    const remaining = bytes.length - index;
    const byte0 = bytes[index] ?? 0;
    const byte1 = remaining > 1 ? bytes[index + 1] ?? 0 : 0;
    const byte2 = remaining > 2 ? bytes[index + 2] ?? 0 : 0;

    output += BASE64_ALPHABET[byte0 >> 2];
    output += BASE64_ALPHABET[((byte0 & 0x03) << 4) | (byte1 >> 4)];
    output += remaining > 1
      ? BASE64_ALPHABET[((byte1 & 0x0f) << 2) | (byte2 >> 6)]
      : "=";
    output += remaining > 2
      ? BASE64_ALPHABET[byte2 & 0x3f]
      : "=";
  }

  return output;
}

function decodeBase64(base64: string): Uint8Array {
  if (base64.length === 0) {
    return new Uint8Array();
  }

  const padding = base64.endsWith("==")
    ? 2
    : base64.endsWith("=")
      ? 1
      : 0;
  const bytes = new Uint8Array((base64.length / 4) * 3 - padding);
  let byteIndex = 0;

  for (let index = 0; index < base64.length; index += 4) {
    const value0 = decodeBase64Character(base64[index]);
    const value1 = decodeBase64Character(base64[index + 1]);
    const value2 = base64[index + 2] === "="
      ? 0
      : decodeBase64Character(base64[index + 2]);
    const value3 = base64[index + 3] === "="
      ? 0
      : decodeBase64Character(base64[index + 3]);

    bytes[byteIndex] = (value0 << 2) | (value1 >> 4);
    byteIndex += 1;

    if (byteIndex < bytes.length) {
      bytes[byteIndex] = ((value1 & 0x0f) << 4) | (value2 >> 2);
      byteIndex += 1;
    }

    if (byteIndex < bytes.length) {
      bytes[byteIndex] = ((value2 & 0x03) << 6) | value3;
      byteIndex += 1;
    }
  }

  return bytes;
}

function decodeBase64Character(character: string | undefined): number {
  const value = character === undefined ? -1 : BASE64_ALPHABET.indexOf(character);

  if (value < 0) {
    throw new PortablePackageBundleError([createIssue({
      code: "portableBundle.schema.invalid",
      targetPath: "/binaryPayloads/payloadBase64",
      expected: "standard base64 character",
      actual: character ?? "missing",
      message: "Portable binary payload contains invalid base64."
    })]);
  }

  return value;
}

function formatZodPath(path: readonly PropertyKey[]): string {
  if (path.length === 0) {
    return "/";
  }

  return `/${path.map((part) => String(part)).join("/")}`;
}

function createIssue(input: PortablePackageBundleIssue): PortablePackageBundleIssue {
  return input;
}

function throwIfIssues(issues: readonly PortablePackageBundleIssue[]): void {
  if (issues.length > 0) {
    throw new PortablePackageBundleError(issues);
  }
}
