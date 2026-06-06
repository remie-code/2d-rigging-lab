import {
  computePackageBinarySha256Digest,
  type BinaryAssetDigestDto,
  type PackageBinaryBytes
} from "@private-2d-rigging-lab/package-format";

import {
  browserPsdParserBridgeDefaultSizeCapBytes,
  browserPsdParserBridgeDefaultSourceAssetId,
  createBrowserPsdSourceEvidence,
  type BrowserPsdParserBridgeIntakeKind,
  type BrowserPsdParserBridgeSourceEvidence
} from "./browser-psd-parser-bridge-result.js";
import {
  selectedPsdLayerBatchMaterializationDefaultMaxSelectedLayerCount,
  selectedPsdLayerBatchMaterializationDefaultMaxTotalRawRgbaBytes,
  type SelectedPsdLayerBatchMaterializationDiagnostic,
  type SelectedPsdLayerBatchMaterializationEntry,
  type SelectedPsdLayerBatchMaterializationFailureEntry,
  type SelectedPsdLayerBatchMaterializationFailureEvidence,
  type SelectedPsdLayerBatchMaterializationFailureKind,
  type SelectedPsdLayerBatchMaterializationResult,
  type SelectedPsdLayerBatchMaterializationStatus,
  type SelectedPsdLayerBatchMaterializationSummary
} from "./selected-psd-layer-batch-materialization-result.js";
import {
  createSelectedPsdLayerPrivateLocalProvenanceEvidence,
  type SelectedPsdLayerMaterializationFailureKind,
  type SelectedPsdLayerMaterializationFailureResult,
  type SelectedPsdLayerMaterializationSourceExpectation
} from "./selected-psd-layer-materialization-result.js";
import {
  materializeSelectedPsdLayerFromSourceEvidence,
  type SelectedPsdLayerSourceEvidenceMaterializationInput
} from "./selected-psd-layer-materialization-service.js";

export interface SelectedPsdLayerBatchArrayBufferMaterializationInput {
  readonly fileName: string;
  readonly bytes?: PackageBinaryBytes;
  readonly selectedLayerNodeRefs: readonly string[];
  readonly declaredMediaType?: string;
  readonly sourceAssetId?: string;
  readonly sizeCapBytes?: number;
  readonly maxRawRgbaByteLength?: number;
  readonly maxSelectedLayerCount?: number;
  readonly maxTotalRawRgbaByteLength?: number;
  readonly expectedSource?: SelectedPsdLayerMaterializationSourceExpectation;
  readonly batchId?: string;
}

export interface SelectedPsdLayerBatchFileMaterializationInput {
  readonly file?: File;
  readonly selectedLayerNodeRefs: readonly string[];
  readonly sourceAssetId?: string;
  readonly sizeCapBytes?: number;
  readonly maxRawRgbaByteLength?: number;
  readonly maxSelectedLayerCount?: number;
  readonly maxTotalRawRgbaByteLength?: number;
  readonly expectedSource?: SelectedPsdLayerMaterializationSourceExpectation;
  readonly batchId?: string;
}

interface NormalizedSelection {
  readonly requestIndex: number;
  readonly selectedLayerNodeRef: string;
}

interface UniqueSelection extends NormalizedSelection {
  readonly canonicalRequestIndex: number;
}

export const materializeSelectedPsdLayersFromBrowserFile = async (
  input: SelectedPsdLayerBatchFileMaterializationInput
): Promise<SelectedPsdLayerBatchMaterializationResult> => {
  if (input.file === undefined) {
    return createPreflightBlockedBatchResult({
      batchId: input.batchId,
      selectedLayerNodeRefs: input.selectedLayerNodeRefs,
      maxSelectedLayerCount: input.maxSelectedLayerCount,
      maxTotalRawRgbaByteLength: input.maxTotalRawRgbaByteLength,
      failureKind: "missingCurrentSourceBytes",
      severity: "error",
      message: "Current PSD source file bytes are unavailable; re-parse the PSD file before batch materialization.",
      checks: ["currentPsdFile=missing", "parserExecuted=false"]
    });
  }

  const sizeCapBytes = input.sizeCapBytes ?? browserPsdParserBridgeDefaultSizeCapBytes;
  const source = createBatchSourceEvidence({
    intakeKind: "explicitFile",
    fileName: input.file.name,
    declaredMediaType: input.file.type,
    byteLength: input.file.size,
    sizeCapBytes,
    sourceAssetId: input.sourceAssetId
  });

  if (input.file.size > sizeCapBytes) {
    return createPreflightBlockedBatchResult({
      batchId: input.batchId,
      selectedLayerNodeRefs: input.selectedLayerNodeRefs,
      source,
      maxSelectedLayerCount: input.maxSelectedLayerCount,
      maxTotalRawRgbaByteLength: input.maxTotalRawRgbaByteLength,
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

  return materializeSelectedPsdLayersFromCurrentSource({
    batchId: input.batchId,
    source,
    bytes,
    selectedLayerNodeRefs: input.selectedLayerNodeRefs,
    maxRawRgbaByteLength: input.maxRawRgbaByteLength,
    maxSelectedLayerCount: input.maxSelectedLayerCount,
    maxTotalRawRgbaByteLength: input.maxTotalRawRgbaByteLength,
    expectedSource: input.expectedSource
  });
};

export const materializeSelectedPsdLayersFromArrayBuffer = async (
  input: SelectedPsdLayerBatchArrayBufferMaterializationInput
): Promise<SelectedPsdLayerBatchMaterializationResult> => {
  const sizeCapBytes = input.sizeCapBytes ?? browserPsdParserBridgeDefaultSizeCapBytes;
  const sourceBytes = input.bytes === undefined ? undefined : copyPackageBinaryBytes(input.bytes);
  const source = createBatchSourceEvidence({
    intakeKind: "explicitArrayBuffer",
    fileName: input.fileName,
    declaredMediaType: input.declaredMediaType,
    byteLength: sourceBytes?.byteLength ?? input.expectedSource?.byteLength ?? 0,
    sizeCapBytes,
    sourceAssetId: input.sourceAssetId
  });

  if (sourceBytes === undefined) {
    return createPreflightBlockedBatchResult({
      batchId: input.batchId,
      selectedLayerNodeRefs: input.selectedLayerNodeRefs,
      source,
      maxSelectedLayerCount: input.maxSelectedLayerCount,
      maxTotalRawRgbaByteLength: input.maxTotalRawRgbaByteLength,
      failureKind: "missingCurrentSourceBytes",
      severity: "error",
      message: "Current PSD source bytes are unavailable; re-parse the PSD bytes before batch materialization.",
      checks: ["currentSourceBytes=missing", "parserExecuted=false"]
    });
  }

  if (sourceBytes.byteLength > sizeCapBytes) {
    return createPreflightBlockedBatchResult({
      batchId: input.batchId,
      selectedLayerNodeRefs: input.selectedLayerNodeRefs,
      source,
      maxSelectedLayerCount: input.maxSelectedLayerCount,
      maxTotalRawRgbaByteLength: input.maxTotalRawRgbaByteLength,
      failureKind: "sourceOversize",
      severity: "error",
      message: `Selected PSD byte length ${sourceBytes.byteLength} exceeds materialization cap ${sizeCapBytes}.`,
      checks: [
        `sourceByteLength=${sourceBytes.byteLength}`,
        `sizeCapBytes=${sizeCapBytes}`,
        "parserExecuted=false"
      ]
    });
  }

  return materializeSelectedPsdLayersFromCurrentSource({
    batchId: input.batchId,
    source,
    bytes: sourceBytes,
    selectedLayerNodeRefs: input.selectedLayerNodeRefs,
    maxRawRgbaByteLength: input.maxRawRgbaByteLength,
    maxSelectedLayerCount: input.maxSelectedLayerCount,
    maxTotalRawRgbaByteLength: input.maxTotalRawRgbaByteLength,
    expectedSource: input.expectedSource
  });
};

const materializeSelectedPsdLayersFromCurrentSource = async (input: {
  readonly batchId: string | undefined;
  readonly source: BrowserPsdParserBridgeSourceEvidence;
  readonly bytes: PackageBinaryBytes;
  readonly selectedLayerNodeRefs: readonly string[];
  readonly maxRawRgbaByteLength: number | undefined;
  readonly maxSelectedLayerCount: number | undefined;
  readonly maxTotalRawRgbaByteLength: number | undefined;
  readonly expectedSource: SelectedPsdLayerMaterializationSourceExpectation | undefined;
}): Promise<SelectedPsdLayerBatchMaterializationResult> => {
  const maxSelectedLayerCount =
    input.maxSelectedLayerCount ?? selectedPsdLayerBatchMaterializationDefaultMaxSelectedLayerCount;
  const maxTotalRawRgbaByteLength =
    input.maxTotalRawRgbaByteLength ?? selectedPsdLayerBatchMaterializationDefaultMaxTotalRawRgbaBytes;
  const selections = normalizeSelections(input.selectedLayerNodeRefs);
  const duplicateEntries = createDuplicateEntries(selections, input.source);
  const missingSelectionEntries = createMissingSelectionEntries(selections, input.source);
  const uniqueSelections = collectUniqueSelections(selections);
  const uniqueMaterializationSelections = uniqueSelections.filter(
    (selection) => selection.selectedLayerNodeRef.length > 0
  );

  if (uniqueMaterializationSelections.length > maxSelectedLayerCount) {
    return createResult({
      batchId: createBatchId(input.batchId, input.source, selections),
      source: input.source,
      entries: mergeEntries([
        ...duplicateEntries,
        ...missingSelectionEntries,
        ...uniqueMaterializationSelections.map((selection) =>
          createFailureEntry({
            selection,
            source: input.source,
            failureKind: "batchLayerCountExceeded",
            severity: "error",
            message: `Selected PSD layer batch requests ${uniqueMaterializationSelections.length} unique layers; cap is ${maxSelectedLayerCount}.`,
            checks: [
              `uniqueSelectedLayerCount=${uniqueMaterializationSelections.length}`,
              `maxSelectedLayerCount=${maxSelectedLayerCount}`,
              "parserExecuted=false"
            ]
          })
        )
      ]),
      maxSelectedLayerCount,
      maxTotalRawRgbaByteLength,
      acceptedRawRgbaByteLength: 0,
      attemptedRawRgbaByteLength: 0,
      forcedStatus: "preflightBlocked"
    });
  }

  const sourceDigestResult = await computePackageBinarySha256Digest(input.bytes);
  if (sourceDigestResult.status === "unsupported") {
    return createResult({
      batchId: createBatchId(input.batchId, input.source, selections),
      source: input.source,
      entries: mergeEntries([
        ...duplicateEntries,
        ...missingSelectionEntries,
        ...uniqueMaterializationSelections.map((selection) =>
          createFailureEntry({
            selection,
            source: input.source,
            failureKind: "materializationFailure",
            severity: "error",
            message: `Selected PSD source digest could not be computed: ${sourceDigestResult.reason}.`,
            checks: [`sourceDigestUnsupported=${sourceDigestResult.reason}`]
          })
        )
      ]),
      maxSelectedLayerCount,
      maxTotalRawRgbaByteLength,
      acceptedRawRgbaByteLength: 0,
      attemptedRawRgbaByteLength: 0
    });
  }

  const sourceMismatchChecks = createSourceMismatchChecks({
    expected: input.expectedSource,
    actualDigest: sourceDigestResult.digest,
    actualByteLength: input.bytes.byteLength
  });
  if (sourceMismatchChecks.length > 0) {
    return createResult({
      batchId: createBatchId(input.batchId, input.source, selections),
      source: input.source,
      entries: mergeEntries([
        ...duplicateEntries,
        ...missingSelectionEntries,
        ...uniqueMaterializationSelections.map((selection) =>
          createFailureEntry({
            selection,
            source: input.source,
            sourceDigest: sourceDigestResult.digest,
            failureKind: "staleSource",
            severity: "error",
            message: "Current PSD source bytes do not match the expected source identity; re-parse or re-select the PSD before batch materialization.",
            checks: [...sourceMismatchChecks, "parserExecuted=false"]
          })
        )
      ]),
      maxSelectedLayerCount,
      maxTotalRawRgbaByteLength,
      acceptedRawRgbaByteLength: 0,
      attemptedRawRgbaByteLength: 0,
      forcedStatus: "preflightBlocked"
    });
  }

  const entries: SelectedPsdLayerBatchMaterializationEntry[] = [
    ...duplicateEntries,
    ...missingSelectionEntries
  ];
  let acceptedRawRgbaByteLength = 0;
  let attemptedRawRgbaByteLength = 0;

  for (const selection of uniqueMaterializationSelections) {
    const materializationInput: SelectedPsdLayerSourceEvidenceMaterializationInput = {
      source: input.source,
      bytes: input.bytes,
      selectedLayerNodeRef: selection.selectedLayerNodeRef,
      ...(input.maxRawRgbaByteLength === undefined
        ? {}
        : { maxRawRgbaByteLength: input.maxRawRgbaByteLength })
    };
    const materialization = await materializeSelectedPsdLayerFromSourceEvidence(materializationInput);

    if (materialization.status === "failed") {
      entries.push(mapSingleLayerFailureToBatchEntry({
        selection,
        source: input.source,
        result: materialization
      }));
      continue;
    }

    const nextAttemptedTotal =
      acceptedRawRgbaByteLength + materialization.candidate.evidence.byteLength;
    attemptedRawRgbaByteLength = Math.max(attemptedRawRgbaByteLength, nextAttemptedTotal);
    if (nextAttemptedTotal > maxTotalRawRgbaByteLength) {
      entries.push(createFailureEntry({
        selection,
        source: input.source,
        sourceDigest: materialization.candidate.evidence.sourcePsd.digest,
        failureKind: "batchTotalByteCapExceeded",
        severity: "error",
        message: `Selected PSD layer batch raw RGBA byte length ${nextAttemptedTotal} exceeds total cap ${maxTotalRawRgbaByteLength}.`,
        checks: [
          `acceptedRawRgbaByteLength=${acceptedRawRgbaByteLength}`,
          `candidateRawRgbaByteLength=${materialization.candidate.evidence.byteLength}`,
          `attemptedRawRgbaByteLength=${nextAttemptedTotal}`,
          `maxTotalRawRgbaByteLength=${maxTotalRawRgbaByteLength}`
        ]
      }));
      continue;
    }

    acceptedRawRgbaByteLength = nextAttemptedTotal;
    entries.push({
      status: "materialized",
      requestIndex: selection.requestIndex,
      selectedLayerNodeRef: selection.selectedLayerNodeRef,
      candidate: materialization.candidate
    });
  }

  return createResult({
    batchId: createBatchId(input.batchId, input.source, selections),
    source: input.source,
    entries: mergeEntries(entries),
    maxSelectedLayerCount,
    maxTotalRawRgbaByteLength,
    acceptedRawRgbaByteLength,
    attemptedRawRgbaByteLength
  });
};

const createPreflightBlockedBatchResult = (input: {
  readonly batchId: string | undefined;
  readonly selectedLayerNodeRefs: readonly string[];
  readonly source?: BrowserPsdParserBridgeSourceEvidence;
  readonly maxSelectedLayerCount: number | undefined;
  readonly maxTotalRawRgbaByteLength: number | undefined;
  readonly failureKind: SelectedPsdLayerBatchMaterializationFailureKind;
  readonly severity: "warning" | "error";
  readonly message: string;
  readonly checks: readonly string[];
}): SelectedPsdLayerBatchMaterializationResult => {
  const maxSelectedLayerCount =
    input.maxSelectedLayerCount ?? selectedPsdLayerBatchMaterializationDefaultMaxSelectedLayerCount;
  const maxTotalRawRgbaByteLength =
    input.maxTotalRawRgbaByteLength ?? selectedPsdLayerBatchMaterializationDefaultMaxTotalRawRgbaBytes;
  const selections = normalizeSelections(input.selectedLayerNodeRefs);
  const duplicateEntries = createDuplicateEntries(selections, input.source);
  const missingSelectionEntries = createMissingSelectionEntries(selections, input.source);
  const uniqueSelections = collectUniqueSelections(selections).filter(
    (selection) => selection.selectedLayerNodeRef.length > 0
  );
  const entries = mergeEntries([
    ...duplicateEntries,
    ...missingSelectionEntries,
    ...uniqueSelections.map((selection) =>
      createFailureEntry({
        selection,
        source: input.source,
        failureKind: input.failureKind,
        severity: input.severity,
        message: input.message,
        checks: input.checks
      })
    )
  ]);

  return createResult({
    batchId: createBatchId(input.batchId, input.source, selections),
    ...(input.source === undefined ? {} : { source: input.source }),
    entries,
    maxSelectedLayerCount,
    maxTotalRawRgbaByteLength,
    acceptedRawRgbaByteLength: 0,
    attemptedRawRgbaByteLength: 0,
    forcedStatus: "preflightBlocked"
  });
};

const createBatchSourceEvidence = (input: {
  readonly intakeKind: BrowserPsdParserBridgeIntakeKind;
  readonly fileName: string;
  readonly declaredMediaType: string | undefined;
  readonly byteLength: number;
  readonly sizeCapBytes: number;
  readonly sourceAssetId: string | undefined;
}): BrowserPsdParserBridgeSourceEvidence =>
  createBrowserPsdSourceEvidence({
    intakeKind: input.intakeKind,
    sourceAssetId: input.sourceAssetId ?? browserPsdParserBridgeDefaultSourceAssetId,
    fileName: input.fileName,
    ...(input.declaredMediaType === undefined ? {} : { declaredMediaType: input.declaredMediaType }),
    byteLength: input.byteLength,
    sizeCapBytes: input.sizeCapBytes
  });

const normalizeSelections = (
  selectedLayerNodeRefs: readonly string[]
): readonly NormalizedSelection[] =>
  selectedLayerNodeRefs.map((selectedLayerNodeRef, requestIndex) => ({
    requestIndex,
    selectedLayerNodeRef: selectedLayerNodeRef.trim()
  }));

const collectUniqueSelections = (
  selections: readonly NormalizedSelection[]
): readonly UniqueSelection[] => {
  const firstIndexByRef = new Map<string, number>();
  const uniqueSelections: UniqueSelection[] = [];

  for (const selection of selections) {
    const canonicalRequestIndex = firstIndexByRef.get(selection.selectedLayerNodeRef);
    if (canonicalRequestIndex !== undefined) {
      continue;
    }

    firstIndexByRef.set(selection.selectedLayerNodeRef, selection.requestIndex);
    uniqueSelections.push({
      ...selection,
      canonicalRequestIndex: selection.requestIndex
    });
  }

  return uniqueSelections;
};

const createDuplicateEntries = (
  selections: readonly NormalizedSelection[],
  source: BrowserPsdParserBridgeSourceEvidence | undefined
): readonly SelectedPsdLayerBatchMaterializationFailureEntry[] => {
  const firstIndexByRef = new Map<string, number>();
  const entries: SelectedPsdLayerBatchMaterializationFailureEntry[] = [];

  for (const selection of selections) {
    if (selection.selectedLayerNodeRef.length === 0) {
      continue;
    }

    const canonicalRequestIndex = firstIndexByRef.get(selection.selectedLayerNodeRef);
    if (canonicalRequestIndex === undefined) {
      firstIndexByRef.set(selection.selectedLayerNodeRef, selection.requestIndex);
      continue;
    }

    entries.push(createFailureEntry({
      selection: {
        ...selection,
        canonicalRequestIndex
      },
      source,
      failureKind: "duplicateSelection",
      severity: "warning",
      message: `Selected PSD layer reference is duplicated in this batch: ${selection.selectedLayerNodeRef || "(empty)"}.`,
      canonicalRequestIndex,
      checks: [
        `duplicateRequestIndex=${selection.requestIndex}`,
        `canonicalRequestIndex=${canonicalRequestIndex}`,
        "materialized=false"
      ]
    }));
  }

  return entries;
};

const createMissingSelectionEntries = (
  selections: readonly NormalizedSelection[],
  source: BrowserPsdParserBridgeSourceEvidence | undefined
): readonly SelectedPsdLayerBatchMaterializationFailureEntry[] =>
  selections
    .filter((selection) => selection.selectedLayerNodeRef.length === 0)
    .map((selection) =>
      createFailureEntry({
        selection: {
          ...selection,
          canonicalRequestIndex: selection.requestIndex
        },
        source,
        failureKind: "missingLayerSelection",
        severity: "error",
        message: "Every PSD batch materialization entry must be an explicit selected layer reference.",
        checks: ["selectedLayerNodeRef=missing", "materialized=false"]
      })
    );

const mapSingleLayerFailureToBatchEntry = (input: {
  readonly selection: UniqueSelection;
  readonly source: BrowserPsdParserBridgeSourceEvidence;
  readonly result: SelectedPsdLayerMaterializationFailureResult;
}): SelectedPsdLayerBatchMaterializationFailureEntry => {
  const failureKind = mapSingleLayerFailureKind(input.result.failure.failureKind);

  return createFailureEntry({
    selection: input.selection,
    source: input.source,
    singleLayerFailureKind: input.result.failure.failureKind,
    failureKind,
    severity: input.result.failure.severity,
    message: input.result.failure.message,
    checks: input.result.failure.checks,
    ...(input.result.failure.sourceDigest === undefined
      ? {}
      : { sourceDigest: input.result.failure.sourceDigest }),
    ...(input.result.failure.parser === undefined ? {} : { parser: input.result.failure.parser }),
    ...(input.result.failure.selectedNode === undefined
      ? {}
      : { selectedNode: input.result.failure.selectedNode })
  });
};

const mapSingleLayerFailureKind = (
  failureKind: SelectedPsdLayerMaterializationFailureKind
): SelectedPsdLayerBatchMaterializationFailureKind => {
  if (failureKind === "sourceMismatch") {
    return "staleSource";
  }

  return failureKind;
};

const createFailureEntry = (input: {
  readonly selection: NormalizedSelection | UniqueSelection;
  readonly source: BrowserPsdParserBridgeSourceEvidence | undefined;
  readonly sourceDigest?: BinaryAssetDigestDto;
  readonly parser?: SelectedPsdLayerBatchMaterializationFailureEvidence["parser"];
  readonly selectedNode?: SelectedPsdLayerBatchMaterializationFailureEvidence["selectedNode"];
  readonly singleLayerFailureKind?: SelectedPsdLayerMaterializationFailureKind;
  readonly failureKind: SelectedPsdLayerBatchMaterializationFailureKind;
  readonly severity: "warning" | "error";
  readonly message: string;
  readonly canonicalRequestIndex?: number;
  readonly checks: readonly string[];
}): SelectedPsdLayerBatchMaterializationFailureEntry => {
  const canonicalRequestIndex =
    input.canonicalRequestIndex ??
    ("canonicalRequestIndex" in input.selection ? input.selection.canonicalRequestIndex : undefined);
  const failure: SelectedPsdLayerBatchMaterializationFailureEvidence = {
    evidenceKind: "selected-psd-layer-batch-materialization-failure-evidence-v1",
    failureKind: input.failureKind,
    severity: input.severity,
    message: input.message,
    requestIndex: input.selection.requestIndex,
    selectedLayerNodeRef: input.selection.selectedLayerNodeRef,
    ...(canonicalRequestIndex === undefined ? {} : { canonicalRequestIndex }),
    ...(input.source === undefined ? {} : { source: input.source }),
    ...(input.sourceDigest === undefined ? {} : { sourceDigest: input.sourceDigest }),
    ...(input.parser === undefined ? {} : { parser: input.parser }),
    ...(input.selectedNode === undefined ? {} : { selectedNode: input.selectedNode }),
    ...(input.singleLayerFailureKind === undefined
      ? {}
      : { singleLayerFailureKind: input.singleLayerFailureKind }),
    checks: input.checks,
    provenance: createSelectedPsdLayerPrivateLocalProvenanceEvidence()
  };

  return {
    status: "failed",
    requestIndex: input.selection.requestIndex,
    selectedLayerNodeRef: input.selection.selectedLayerNodeRef,
    failure
  };
};

const createResult = (input: {
  readonly batchId: string;
  readonly source?: BrowserPsdParserBridgeSourceEvidence;
  readonly entries: readonly SelectedPsdLayerBatchMaterializationEntry[];
  readonly maxSelectedLayerCount: number;
  readonly maxTotalRawRgbaByteLength: number;
  readonly acceptedRawRgbaByteLength: number;
  readonly attemptedRawRgbaByteLength: number;
  readonly forcedStatus?: SelectedPsdLayerBatchMaterializationStatus;
}): SelectedPsdLayerBatchMaterializationResult => {
  const entries = mergeEntries(input.entries);
  const summary = createSummary({
    entries,
    maxSelectedLayerCount: input.maxSelectedLayerCount,
    maxTotalRawRgbaByteLength: input.maxTotalRawRgbaByteLength,
    acceptedRawRgbaByteLength: input.acceptedRawRgbaByteLength,
    attemptedRawRgbaByteLength: input.attemptedRawRgbaByteLength
  });
  const status = input.forcedStatus ?? createStatus(summary);

  return {
    evidenceKind: "selected-psd-layer-batch-materialization-result-v1",
    batchId: input.batchId,
    status,
    ...(input.source === undefined ? {} : { source: input.source }),
    entries,
    summary,
    diagnostics: createDiagnostics(status, summary)
  };
};

const createSummary = (input: {
  readonly entries: readonly SelectedPsdLayerBatchMaterializationEntry[];
  readonly maxSelectedLayerCount: number;
  readonly maxTotalRawRgbaByteLength: number;
  readonly acceptedRawRgbaByteLength: number;
  readonly attemptedRawRgbaByteLength: number;
}): SelectedPsdLayerBatchMaterializationSummary => {
  const failures = input.entries.filter(
    (entry): entry is SelectedPsdLayerBatchMaterializationFailureEntry => entry.status === "failed"
  );
  const requestedRefs = new Set(input.entries.map((entry) => entry.selectedLayerNodeRef));
  const duplicateSelectionCount = countFailures(failures, "duplicateSelection");
  const unsupportedLayerTypeCount = countFailures(failures, "unsupportedLayerType");
  const missingCurrentSourceBytesCount = countFailures(failures, "missingCurrentSourceBytes");
  const staleSourceCount = countFailures(failures, "staleSource");
  const batchLayerCountExceededCount = countFailures(failures, "batchLayerCountExceeded");
  const batchTotalByteCapExceededCount = countFailures(failures, "batchTotalByteCapExceeded");

  return {
    requestedCount: input.entries.length,
    uniqueRequestedCount: requestedRefs.size,
    successCount: input.entries.length - failures.length,
    failureCount: failures.length,
    duplicateSelectionCount,
    unsupportedLayerTypeCount,
    missingCurrentSourceBytesCount,
    staleSourceCount,
    materializationFailureCount: failures.filter(isMaterializationFailure).length,
    batchLayerCountExceededCount,
    batchTotalByteCapExceededCount,
    maxSelectedLayerCount: input.maxSelectedLayerCount,
    maxTotalRawRgbaBytes: input.maxTotalRawRgbaByteLength,
    acceptedRawRgbaByteLength: input.acceptedRawRgbaByteLength,
    attemptedRawRgbaByteLength: input.attemptedRawRgbaByteLength,
    batchCap: {
      exceeded: batchLayerCountExceededCount > 0,
      requestedUniqueCount: requestedRefs.size,
      maxSelectedLayerCount: input.maxSelectedLayerCount
    },
    totalByteCap: {
      exceeded: batchTotalByteCapExceededCount > 0,
      acceptedRawRgbaByteLength: input.acceptedRawRgbaByteLength,
      attemptedRawRgbaByteLength: input.attemptedRawRgbaByteLength,
      maxTotalRawRgbaBytes: input.maxTotalRawRgbaByteLength
    },
    publicDemoAsset: false
  };
};

const createStatus = (
  summary: SelectedPsdLayerBatchMaterializationSummary
): SelectedPsdLayerBatchMaterializationStatus => {
  if (summary.successCount === summary.requestedCount && summary.requestedCount > 0) {
    return "success";
  }

  if (summary.successCount > 0) {
    return "partialFailure";
  }

  return "failure";
};

const createDiagnostics = (
  status: SelectedPsdLayerBatchMaterializationStatus,
  summary: SelectedPsdLayerBatchMaterializationSummary
): readonly SelectedPsdLayerBatchMaterializationDiagnostic[] => [
  {
    checkId: `selectedPsdLayer.batchMaterialization.${status}`,
    severity: status === "success" ? "info" : "warning",
    message: "Selected PSD layer batch materialization completed with explicit per-layer results.",
    evidence: [
      `requestedCount=${summary.requestedCount}`,
      `successCount=${summary.successCount}`,
      `failureCount=${summary.failureCount}`,
      `duplicateSelectionCount=${summary.duplicateSelectionCount}`,
      `unsupportedLayerTypeCount=${summary.unsupportedLayerTypeCount}`,
      `missingCurrentSourceBytesCount=${summary.missingCurrentSourceBytesCount}`,
      `staleSourceCount=${summary.staleSourceCount}`,
      `materializationFailureCount=${summary.materializationFailureCount}`,
      `batchLayerCountExceededCount=${summary.batchLayerCountExceededCount}`,
      `batchTotalByteCapExceededCount=${summary.batchTotalByteCapExceededCount}`,
      `acceptedRawRgbaByteLength=${summary.acceptedRawRgbaByteLength}`,
      `maxTotalRawRgbaBytes=${summary.maxTotalRawRgbaBytes}`,
      "publicDemoAsset=false"
    ]
  }
];

const mergeEntries = (
  entries: readonly SelectedPsdLayerBatchMaterializationEntry[]
): readonly SelectedPsdLayerBatchMaterializationEntry[] =>
  [...entries].sort((left, right) => left.requestIndex - right.requestIndex);

const countFailures = (
  failures: readonly SelectedPsdLayerBatchMaterializationFailureEntry[],
  failureKind: SelectedPsdLayerBatchMaterializationFailureKind
): number => failures.filter((entry) => entry.failure.failureKind === failureKind).length;

const isMaterializationFailure = (
  entry: SelectedPsdLayerBatchMaterializationFailureEntry
): boolean =>
  [
    "parserFailure",
    "missingLayer",
    "materializationFailure",
    "materializedLayerOversize"
  ].includes(entry.failure.failureKind);

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

const createBatchId = (
  providedBatchId: string | undefined,
  source: BrowserPsdParserBridgeSourceEvidence | undefined,
  selections: readonly NormalizedSelection[]
): string => {
  if (providedBatchId !== undefined && providedBatchId.trim().length > 0) {
    return providedBatchId.trim();
  }

  const sourceToken = toSafeToken(source?.sourceAssetId ?? "missing_source", "source");
  return `batch_${sourceToken}_${selections.length}`;
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
