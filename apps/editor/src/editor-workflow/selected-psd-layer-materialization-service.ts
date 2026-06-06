import {
  computePackageBinarySha256Digest,
  type BinaryAssetDigestDto,
  type PackageBinaryBytes
} from "@private-2d-rigging-lab/package-format";

import {
  materializeSelectedPsdLayerWithAdapter
} from "./browser-psd-parser-adapter.js";
import {
  browserPsdParserBridgeDefaultSizeCapBytes,
  browserPsdParserBridgeDefaultSourceAssetId,
  createBrowserPsdSourceEvidence,
  type BrowserPsdParserBridgeSourceEvidence
} from "./browser-psd-parser-bridge-result.js";
import {
  createSelectedPsdLayerPrivateLocalProvenanceEvidence,
  selectedPsdLayerMaterializationDefaultMaxRawRgbaBytes,
  selectedPsdLayerMaterializedAssetMediaType,
  type SelectedPsdLayerMaterializationFailureEvidence,
  type SelectedPsdLayerMaterializationFailureKind,
  type SelectedPsdLayerMaterializationResult,
  type SelectedPsdLayerMaterializationSourceExpectation,
  type SelectedPsdLayerMaterializedAssetCandidate,
  type SelectedPsdLayerMaterializedAssetEvidence,
  type SelectedPsdLayerMaterializedAssetFreshnessExpectation,
  type SelectedPsdLayerMaterializedAssetFreshnessResult
} from "./selected-psd-layer-materialization-result.js";

export interface SelectedPsdLayerArrayBufferMaterializationInput {
  readonly fileName: string;
  readonly bytes: PackageBinaryBytes;
  readonly selectedLayerNodeRef: string;
  readonly declaredMediaType?: string;
  readonly sourceAssetId?: string;
  readonly sizeCapBytes?: number;
  readonly maxRawRgbaByteLength?: number;
  readonly expectedSource?: SelectedPsdLayerMaterializationSourceExpectation;
}

export interface SelectedPsdLayerFileMaterializationInput {
  readonly file: File;
  readonly selectedLayerNodeRef: string;
  readonly sourceAssetId?: string;
  readonly sizeCapBytes?: number;
  readonly maxRawRgbaByteLength?: number;
  readonly expectedSource?: SelectedPsdLayerMaterializationSourceExpectation;
}

export interface VerifySelectedPsdLayerMaterializedAssetCandidateInput {
  readonly candidate: SelectedPsdLayerMaterializedAssetCandidate;
  readonly currentBytes?: PackageBinaryBytes;
  readonly expected?: SelectedPsdLayerMaterializedAssetFreshnessExpectation;
}

export interface SelectedPsdLayerSourceEvidenceMaterializationInput {
  readonly source: BrowserPsdParserBridgeSourceEvidence;
  readonly bytes: PackageBinaryBytes;
  readonly selectedLayerNodeRef: string;
  readonly maxRawRgbaByteLength?: number;
  readonly expectedSource?: SelectedPsdLayerMaterializationSourceExpectation;
}

export const materializeSelectedPsdLayerFromBrowserFile = async (
  input: SelectedPsdLayerFileMaterializationInput
): Promise<SelectedPsdLayerMaterializationResult> => {
  const sizeCapBytes = input.sizeCapBytes ?? browserPsdParserBridgeDefaultSizeCapBytes;
  const source = createSourceEvidence({
    intakeKind: "explicitFile",
    fileName: input.file.name,
    declaredMediaType: input.file.type,
    ...(input.sourceAssetId === undefined ? {} : { sourceAssetId: input.sourceAssetId }),
    byteLength: input.file.size,
    sizeCapBytes
  });

  if (input.file.size > sizeCapBytes) {
    return createMaterializationFailure({
      source,
      selectedLayerNodeRef: input.selectedLayerNodeRef,
      failureKind: "sourceOversize",
      severity: "error",
      message: `Selected PSD byte length ${input.file.size} exceeds materialization cap ${sizeCapBytes}.`,
      checks: [
        `sourceByteLength=${input.file.size}`,
        `sizeCapBytes=${sizeCapBytes}`,
        "parserExecuted=false"
      ]
    });
  }

  const bytes = await input.file.arrayBuffer();

  return materializeSelectedPsdLayerFromSourceEvidence({
    source,
    bytes,
    selectedLayerNodeRef: input.selectedLayerNodeRef,
    ...(input.maxRawRgbaByteLength === undefined
      ? {}
      : { maxRawRgbaByteLength: input.maxRawRgbaByteLength }),
    ...(input.expectedSource === undefined ? {} : { expectedSource: input.expectedSource })
  });
};

export const materializeSelectedPsdLayerFromArrayBuffer = async (
  input: SelectedPsdLayerArrayBufferMaterializationInput
): Promise<SelectedPsdLayerMaterializationResult> => {
  const sizeCapBytes = input.sizeCapBytes ?? browserPsdParserBridgeDefaultSizeCapBytes;
  const source = createSourceEvidence({
    intakeKind: "explicitArrayBuffer",
    fileName: input.fileName,
    ...(input.declaredMediaType === undefined ? {} : { declaredMediaType: input.declaredMediaType }),
    ...(input.sourceAssetId === undefined ? {} : { sourceAssetId: input.sourceAssetId }),
    byteLength: input.bytes.byteLength,
    sizeCapBytes
  });

  return materializeSelectedPsdLayerFromSourceEvidence({
    source,
    bytes: input.bytes,
    selectedLayerNodeRef: input.selectedLayerNodeRef,
    ...(input.maxRawRgbaByteLength === undefined
      ? {}
      : { maxRawRgbaByteLength: input.maxRawRgbaByteLength }),
    ...(input.expectedSource === undefined ? {} : { expectedSource: input.expectedSource })
  });
};

export const materializeSelectedPsdLayerFromSourceEvidence = async (
  input: SelectedPsdLayerSourceEvidenceMaterializationInput
): Promise<SelectedPsdLayerMaterializationResult> => {
  const bytes = copyPackageBinaryBytes(input.bytes);
  const source = input.source;
  const sizeCapBytes = source.sizeCapBytes;
  const selectedLayerNodeRef = input.selectedLayerNodeRef.trim();

  if (bytes.byteLength > sizeCapBytes) {
    return createMaterializationFailure({
      source,
      selectedLayerNodeRef,
      failureKind: "sourceOversize",
      severity: "error",
      message: `Selected PSD byte length ${bytes.byteLength} exceeds materialization cap ${sizeCapBytes}.`,
      checks: [
        `sourceByteLength=${bytes.byteLength}`,
        `sizeCapBytes=${sizeCapBytes}`,
        "parserExecuted=false"
      ]
    });
  }

  if (selectedLayerNodeRef.length === 0) {
    return createMaterializationFailure({
      source,
      selectedLayerNodeRef,
      failureKind: "missingLayer",
      severity: "error",
      message: "Selected PSD layer node reference is required before materialization.",
      checks: ["selectedLayerNodeRef=missing", "parserExecuted=false"]
    });
  }

  const sourceDigestResult = await computeSha256Digest(bytes);
  if (sourceDigestResult.status === "unsupported") {
    return createMaterializationFailure({
      source,
      selectedLayerNodeRef,
      failureKind: "materializationFailure",
      severity: "error",
      message: `Selected PSD source digest could not be computed: ${sourceDigestResult.reason}.`,
      checks: [`sourceDigestUnsupported=${sourceDigestResult.reason}`]
    });
  }
  const sourceDigest = sourceDigestResult.digest;
  const sourceMismatchChecks = createSourceMismatchChecks({
    expected: input.expectedSource,
    actualDigest: sourceDigest,
    actualByteLength: bytes.byteLength
  });

  if (sourceMismatchChecks.length > 0) {
    return createMaterializationFailure({
      source,
      selectedLayerNodeRef,
      failureKind: "sourceMismatch",
      severity: "error",
      message: "Selected PSD bytes do not match the expected source identity; re-selection or re-materialization is required.",
      sourceDigest,
      checks: sourceMismatchChecks
    });
  }

  const adapterResult = await materializeSelectedPsdLayerWithAdapter({
    source,
    bytes,
    selectedLayerNodeRef
  });

  if (adapterResult.status === "failed") {
    return createMaterializationFailure({
      source,
      selectedLayerNodeRef,
      failureKind: adapterResult.failureKind,
      severity: adapterResult.severity,
      message: adapterResult.message,
      sourceDigest,
      parser: adapterResult.parser,
      selectedNode: adapterResult.selectedNode,
      checks: [
        `adapterFailureKind=${adapterResult.failureKind}`,
        "parserPrivateShape=excluded"
      ]
    });
  }

  const expectedRawRgbaByteLength =
    adapterResult.selectedLayer.width * adapterResult.selectedLayer.height * 4;
  if (adapterResult.rgbaBytes.byteLength !== expectedRawRgbaByteLength) {
    return createMaterializationFailure({
      source,
      selectedLayerNodeRef,
      failureKind: "materializationFailure",
      severity: "error",
      message: "Selected PSD layer raw RGBA byte length does not match width * height * 4.",
      sourceDigest,
      parser: adapterResult.parser,
      checks: [
        `width=${adapterResult.selectedLayer.width}`,
        `height=${adapterResult.selectedLayer.height}`,
        `expectedRawRgbaByteLength=${expectedRawRgbaByteLength}`,
        `actualRawRgbaByteLength=${adapterResult.rgbaBytes.byteLength}`
      ]
    });
  }

  const maxRawRgbaByteLength =
    input.maxRawRgbaByteLength ?? selectedPsdLayerMaterializationDefaultMaxRawRgbaBytes;
  if (adapterResult.rgbaBytes.byteLength > maxRawRgbaByteLength) {
    return createMaterializationFailure({
      source,
      selectedLayerNodeRef,
      failureKind: "materializedLayerOversize",
      severity: "error",
      message: `Selected PSD layer materialized byte length ${adapterResult.rgbaBytes.byteLength} exceeds cap ${maxRawRgbaByteLength}.`,
      sourceDigest,
      parser: adapterResult.parser,
      checks: [
        `materializedByteLength=${adapterResult.rgbaBytes.byteLength}`,
        `maxRawRgbaByteLength=${maxRawRgbaByteLength}`
      ]
    });
  }

  const candidateBytes = new Uint8Array(adapterResult.rgbaBytes);
  const materializedDigestResult = await computeSha256Digest(candidateBytes);
  if (materializedDigestResult.status === "unsupported") {
    return createMaterializationFailure({
      source,
      selectedLayerNodeRef,
      failureKind: "materializationFailure",
      severity: "error",
      message: `Selected PSD layer materialized digest could not be computed: ${materializedDigestResult.reason}.`,
      sourceDigest,
      parser: adapterResult.parser,
      checks: [`materializedDigestUnsupported=${materializedDigestResult.reason}`]
    });
  }
  const materializedDigest = materializedDigestResult.digest;
  const evidence = createMaterializedAssetEvidence({
    source,
    sourceDigest,
    selectedLayer: adapterResult.selectedLayer,
    parser: adapterResult.parser,
    extraction: adapterResult.extraction,
    bytes: candidateBytes,
    digest: materializedDigest
  });

  return {
    status: "materialized",
    source,
    candidate: {
      bytes: candidateBytes,
      evidence
    },
    diagnostics: [
      {
        checkId: "selectedPsdLayer.materialization.completed",
        severity: "info",
        message: "Selected PSD layer was materialized as an Editor-local private/local raw RGBA candidate.",
        evidence: [
          `mediaType=${evidence.mediaType}`,
          `byteLength=${evidence.byteLength}`,
          `digest=${evidence.digest.algorithm}:${evidence.digest.hex}`,
          `sourceDigest=${sourceDigest.algorithm}:${sourceDigest.hex}`,
          "publicDemoAsset=false",
          evidence.provenance.materializedBytePersistence
        ]
      }
    ]
  };
};

export const verifySelectedPsdLayerMaterializedAssetCandidate = async (
  input: VerifySelectedPsdLayerMaterializedAssetCandidateInput
): Promise<SelectedPsdLayerMaterializedAssetFreshnessResult> => {
  const staleReasons: string[] = [];
  const evidence = input.candidate.evidence;
  const expected = input.expected;

  collectMetadataMismatchReasons({
    evidence,
    expected,
    staleReasons
  });

  if (input.currentBytes === undefined) {
    staleReasons.push("missingCurrentMaterializedBytes");

    return createFreshnessResult({
      status: "missing",
      evidence,
      staleReasons
    });
  }

  const currentBytes = copyPackageBinaryBytes(input.currentBytes);
  const actualByteLength = currentBytes.byteLength;
  if (actualByteLength !== evidence.byteLength) {
    staleReasons.push(
      `materializedByteLengthMismatch:expected=${evidence.byteLength}:actual=${actualByteLength}`
    );
  }

  const actualDigestResult = await computeSha256Digest(currentBytes);
  if (actualDigestResult.status === "unsupported") {
    staleReasons.push(`materializedDigestUnsupported:${actualDigestResult.reason}`);

    return createFreshnessResult({
      status: "stale",
      evidence,
      staleReasons,
      actualByteLength
    });
  }
  const actualDigest = actualDigestResult.digest;
  if (actualDigest.hex !== evidence.digest.hex) {
    staleReasons.push(
      `materializedDigestMismatch:expected=${evidence.digest.algorithm}:${evidence.digest.hex}:actual=${actualDigest.algorithm}:${actualDigest.hex}`
    );
  }

  return createFreshnessResult({
    status: staleReasons.length === 0 ? "current" : "stale",
    evidence,
    staleReasons,
    actualDigest,
    actualByteLength
  });
};

const createSourceEvidence = (input: {
  readonly intakeKind: "explicitFile" | "explicitArrayBuffer";
  readonly fileName: string;
  readonly declaredMediaType?: string;
  readonly sourceAssetId?: string;
  readonly byteLength: number;
  readonly sizeCapBytes: number;
}): BrowserPsdParserBridgeSourceEvidence =>
  createBrowserPsdSourceEvidence({
    intakeKind: input.intakeKind,
    sourceAssetId: input.sourceAssetId ?? browserPsdParserBridgeDefaultSourceAssetId,
    fileName: input.fileName,
    ...(input.declaredMediaType === undefined ? {} : { declaredMediaType: input.declaredMediaType }),
    byteLength: input.byteLength,
    sizeCapBytes: input.sizeCapBytes
  });

const createMaterializationFailure = (input: {
  readonly source: BrowserPsdParserBridgeSourceEvidence;
  readonly selectedLayerNodeRef: string;
  readonly failureKind: SelectedPsdLayerMaterializationFailureKind;
  readonly severity: "warning" | "error";
  readonly message: string;
  readonly sourceDigest?: BinaryAssetDigestDto;
  readonly parser?: SelectedPsdLayerMaterializationFailureEvidence["parser"];
  readonly selectedNode?: SelectedPsdLayerMaterializationFailureEvidence["selectedNode"];
  readonly checks: readonly string[];
}): SelectedPsdLayerMaterializationResult => {
  const failure: SelectedPsdLayerMaterializationFailureEvidence = {
    evidenceKind: "selected-psd-layer-materialization-failure-evidence-v1",
    failureKind: input.failureKind,
    severity: input.severity,
    message: input.message,
    source: input.source,
    selectedLayerNodeRef: input.selectedLayerNodeRef,
    ...(input.sourceDigest === undefined ? {} : { sourceDigest: input.sourceDigest }),
    ...(input.parser === undefined ? {} : { parser: input.parser }),
    ...(input.selectedNode === undefined ? {} : { selectedNode: input.selectedNode }),
    checks: input.checks,
    provenance: createSelectedPsdLayerPrivateLocalProvenanceEvidence()
  };

  return {
    status: "failed",
    source: input.source,
    failure,
    diagnostics: [
      {
        checkId: `selectedPsdLayer.materialization.${input.failureKind}`,
        severity: input.severity,
        message: input.message,
        evidence: [
          ...input.checks,
          "publicDemoAsset=false",
          failure.provenance.materializedBytePersistence
        ]
      }
    ]
  };
};

const createMaterializedAssetEvidence = (input: {
  readonly source: BrowserPsdParserBridgeSourceEvidence;
  readonly sourceDigest: BinaryAssetDigestDto;
  readonly selectedLayer: {
    readonly sourceLayerId: string;
    readonly sourceLayerPath: readonly string[];
    readonly originalName: string;
    readonly bounds: {
      readonly x: number;
      readonly y: number;
      readonly width: number;
      readonly height: number;
    };
    readonly visibleInSource: boolean;
    readonly width: number;
    readonly height: number;
  };
  readonly parser: SelectedPsdLayerMaterializedAssetEvidence["parser"];
  readonly extraction: SelectedPsdLayerMaterializedAssetEvidence["extraction"];
  readonly bytes: Uint8Array;
  readonly digest: BinaryAssetDigestDto;
}): SelectedPsdLayerMaterializedAssetEvidence => {
  const candidateId = `candidate_${toSafeToken(input.selectedLayer.sourceLayerId, "selectedLayer")}`;

  return {
    evidenceKind: "selected-psd-layer-materialized-asset-candidate-evidence-v1",
    candidateId,
    materializationId: `mat_${toSafeToken(input.selectedLayer.sourceLayerId, "selectedLayer")}`,
    mediaType: selectedPsdLayerMaterializedAssetMediaType,
    pixelFormat: "rgba8",
    width: input.selectedLayer.width,
    height: input.selectedLayer.height,
    byteLength: input.bytes.byteLength,
    digest: input.digest,
    sourcePsd: {
      sourceAssetId: input.source.sourceAssetId,
      fileName: input.source.fileName,
      ...(input.source.declaredMediaType === undefined
        ? {}
        : { declaredMediaType: input.source.declaredMediaType }),
      byteLength: input.source.byteLength,
      digest: input.sourceDigest
    },
    sourceLayer: {
      sourceLayerId: input.selectedLayer.sourceLayerId,
      sourceLayerPath: input.selectedLayer.sourceLayerPath,
      originalName: input.selectedLayer.originalName,
      bounds: input.selectedLayer.bounds,
      visibleInSource: input.selectedLayer.visibleInSource
    },
    parser: input.parser,
    extraction: input.extraction,
    provenance: createSelectedPsdLayerPrivateLocalProvenanceEvidence(),
    storageBoundary: {
      storageScope: "editor-local-candidate-only-v1",
      packageStorageIdentity: "not-assigned-domain-c-d-owned-v1",
      persistentBinaryAssetRef: "not-created-by-domain-b-v1"
    }
  };
};

const createSourceMismatchChecks = (input: {
  readonly expected: SelectedPsdLayerMaterializationSourceExpectation | undefined;
  readonly actualDigest: BinaryAssetDigestDto;
  readonly actualByteLength: number;
}): readonly string[] => {
  if (input.expected === undefined) {
    return [];
  }

  const checks: string[] = [];
  if (
    input.expected.byteLength !== undefined &&
    input.expected.byteLength !== input.actualByteLength
  ) {
    checks.push(
      `sourceByteLengthMismatch:expected=${input.expected.byteLength}:actual=${input.actualByteLength}`
    );
  }

  if (
    input.expected.digest !== undefined &&
    input.expected.digest.hex !== input.actualDigest.hex
  ) {
    checks.push(
      `sourceDigestMismatch:expected=${input.expected.digest.algorithm}:${input.expected.digest.hex}:actual=${input.actualDigest.algorithm}:${input.actualDigest.hex}`
    );
  }

  return checks;
};

const collectMetadataMismatchReasons = (input: {
  readonly evidence: SelectedPsdLayerMaterializedAssetEvidence;
  readonly expected: SelectedPsdLayerMaterializedAssetFreshnessExpectation | undefined;
  readonly staleReasons: string[];
}): void => {
  if (input.expected === undefined) {
    return;
  }

  if (
    input.expected.candidateId !== undefined &&
    input.expected.candidateId !== input.evidence.candidateId
  ) {
    input.staleReasons.push("candidateIdentityMismatch");
  }

  if (
    input.expected.materializationId !== undefined &&
    input.expected.materializationId !== input.evidence.materializationId
  ) {
    input.staleReasons.push("materializationIdentityMismatch");
  }

  if (
    input.expected.sourceDigest !== undefined &&
    input.expected.sourceDigest.hex !== input.evidence.sourcePsd.digest.hex
  ) {
    input.staleReasons.push("sourceDigestMismatch");
  }

  if (
    input.expected.sourceByteLength !== undefined &&
    input.expected.sourceByteLength !== input.evidence.sourcePsd.byteLength
  ) {
    input.staleReasons.push("sourceByteLengthMismatch");
  }

  if (
    input.expected.sourceLayerId !== undefined &&
    input.expected.sourceLayerId !== input.evidence.sourceLayer.sourceLayerId
  ) {
    input.staleReasons.push("sourceLayerRefMismatch");
  }

  if (
    input.expected.sourceLayerPath !== undefined &&
    stringifyStable(input.expected.sourceLayerPath) !== stringifyStable(input.evidence.sourceLayer.sourceLayerPath)
  ) {
    input.staleReasons.push("sourceLayerPathMismatch");
  }

  if (
    input.expected.sourceLayerName !== undefined &&
    input.expected.sourceLayerName !== input.evidence.sourceLayer.originalName
  ) {
    input.staleReasons.push("sourceLayerNameMismatch");
  }

  if (
    input.expected.mediaType !== undefined &&
    input.expected.mediaType !== input.evidence.mediaType
  ) {
    input.staleReasons.push("mediaTypeMismatch");
  }

  if (
    input.expected.materializedByteLength !== undefined &&
    input.expected.materializedByteLength !== input.evidence.byteLength
  ) {
    input.staleReasons.push("materializedByteLengthMismatch");
  }

  if (
    input.expected.materializedDigest !== undefined &&
    input.expected.materializedDigest.hex !== input.evidence.digest.hex
  ) {
    input.staleReasons.push("materializedDigestMismatch");
  }

  if (
    input.expected.parserPackageName !== undefined &&
    input.expected.parserPackageName !== input.evidence.parser.parserPackageName
  ) {
    input.staleReasons.push("parserPackageMismatch");
  }

  if (
    input.expected.parserVersion !== undefined &&
    input.expected.parserVersion !== input.evidence.parser.parserVersion
  ) {
    input.staleReasons.push("parserVersionMismatch");
  }

  if (
    input.expected.parserPrivateShapePolicy !== undefined &&
    input.expected.parserPrivateShapePolicy !== input.evidence.parser.privateShapePolicy
  ) {
    input.staleReasons.push("parserPrivateShapePolicyMismatch");
  }

  if (
    input.expected.extraction !== undefined &&
    stringifyStable(input.expected.extraction) !== stringifyStable(input.evidence.extraction)
  ) {
    input.staleReasons.push("extractionOptionsMismatch");
  }

  collectStorageBoundaryMismatchReasons(input);
};

const collectStorageBoundaryMismatchReasons = (input: {
  readonly evidence: SelectedPsdLayerMaterializedAssetEvidence;
  readonly expected: SelectedPsdLayerMaterializedAssetFreshnessExpectation | undefined;
  readonly staleReasons: string[];
}): void => {
  const expectedStorage = input.expected?.storageBoundary;
  if (expectedStorage === undefined) {
    return;
  }

  if (
    expectedStorage.storageScope !== undefined &&
    expectedStorage.storageScope !== input.evidence.storageBoundary.storageScope
  ) {
    input.staleReasons.push("storageScopeMismatch");
  }

  if (
    expectedStorage.packageStorageIdentity !== undefined &&
    expectedStorage.packageStorageIdentity !== input.evidence.storageBoundary.packageStorageIdentity
  ) {
    input.staleReasons.push("storageIdentityBoundaryMismatch");
  }

  if (
    expectedStorage.persistentBinaryAssetRef !== undefined &&
    expectedStorage.persistentBinaryAssetRef !== input.evidence.storageBoundary.persistentBinaryAssetRef
  ) {
    input.staleReasons.push("persistentBinaryAssetRefBoundaryMismatch");
  }
};

const createFreshnessResult = (input: {
  readonly status: "current" | "missing" | "stale";
  readonly evidence: SelectedPsdLayerMaterializedAssetEvidence;
  readonly staleReasons: readonly string[];
  readonly actualDigest?: BinaryAssetDigestDto;
  readonly actualByteLength?: number;
}): SelectedPsdLayerMaterializedAssetFreshnessResult => ({
  status: input.status,
  evidence: {
    evidenceKind: "selected-psd-layer-materialized-asset-freshness-evidence-v1",
    status: input.status,
    staleReasons: input.staleReasons,
    candidateId: input.evidence.candidateId,
    materializationId: input.evidence.materializationId,
    publicDemoAsset: false
  },
  ...(input.actualDigest === undefined ? {} : { actualDigest: input.actualDigest }),
  ...(input.actualByteLength === undefined ? {} : { actualByteLength: input.actualByteLength })
});

type ComputeSha256DigestResult =
  | {
      readonly status: "computed";
      readonly digest: BinaryAssetDigestDto;
    }
  | {
      readonly status: "unsupported";
      readonly reason: "web-crypto-unavailable";
    };

const computeSha256Digest = async (
  bytes: PackageBinaryBytes
): Promise<ComputeSha256DigestResult> => {
  const digestResult = await computePackageBinarySha256Digest(bytes);
  if (digestResult.status === "unsupported") {
    return digestResult;
  }

  return digestResult;
};

const copyPackageBinaryBytes = (bytes: PackageBinaryBytes): Uint8Array =>
  bytes instanceof Uint8Array ? new Uint8Array(bytes) : new Uint8Array(bytes.slice(0));

const toSafeToken = (text: string, fallback: string): string => {
  const token = text
    .replace(/[^A-Za-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 96);

  if (token.length === 0) {
    return fallback;
  }

  return /^[A-Za-z]/.test(token) ? token : `${fallback}_${token}`;
};

const stringifyStable = (value: unknown): string => JSON.stringify(value);
