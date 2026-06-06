import Psd, {
  type Group,
  type Layer,
  type NodeChild
} from "@webtoon/psd";
import {
  computePackageBinarySha256Digest,
  type BinaryAssetDigestDto
} from "@private-2d-rigging-lab/package-format";
import {
  PsdAdapterLayerMaterializationEvidenceSchema,
  PsdAdapterResultSchema,
  type PsdAdapterDiagnosticDto,
  type PsdAdapterFeatureSupportEvidenceDto,
  type PsdAdapterLayerMaterializationEvidenceDto,
  type PsdAdapterParserEvidenceDto,
  type PsdAdapterResultDto,
  type PsdAdapterSourceGroupDto,
  type PsdAdapterSourceLayerDto
} from "@private-2d-rigging-lab/operation-core";

import {
  browserPsdParserBridgeAdapterName,
  browserPsdParserBridgeAdapterVersion,
  createBrowserPsdParserErrorEvidence,
  type BrowserPsdParserBridgeErrorEvidence,
  type BrowserPsdParserBridgeFailedResult,
  type BrowserPsdParserBridgeParsedResult,
  type BrowserPsdParserBridgeSourceEvidence,
  type BrowserPsdParserBridgeThreadingEvidence,
  type BrowserPsdParserBridgeTreeSummary
} from "./browser-psd-parser-bridge-result.js";

interface BrowserPsdParserAdapterInput {
  readonly source: BrowserPsdParserBridgeSourceEvidence;
  readonly threading: BrowserPsdParserBridgeThreadingEvidence;
  readonly bytes: Uint8Array;
  readonly selectedLayerNodeRef?: string;
}

interface PsdTreeProjection {
  readonly sourceGroups: readonly PsdAdapterSourceGroupDto[];
  readonly sourceLayers: readonly PsdAdapterSourceLayerDto[];
  readonly treeSummary: BrowserPsdParserBridgeTreeSummary;
}

interface SelectedLayerResolution {
  readonly layer: Layer;
  readonly nodeRef: string;
  readonly sourceLayerPath: readonly string[];
}

type SelectedNodeResolution =
  | {
      readonly kind: "layer";
      readonly layer: Layer;
      readonly nodeRef: string;
      readonly sourceNodePath: readonly string[];
      readonly displayName: string;
    }
  | {
      readonly kind: "group";
      readonly group: Group;
      readonly nodeRef: string;
      readonly sourceNodePath: readonly string[];
      readonly displayName: string;
    };

interface MaterializationProjection {
  readonly materializationEvidence: readonly PsdAdapterLayerMaterializationEvidenceDto[];
  readonly diagnostics: readonly PsdAdapterDiagnosticDto[];
  readonly errorEvidence: readonly BrowserPsdParserBridgeErrorEvidence[];
}

interface ParsedPsd {
  readonly width: number;
  readonly height: number;
  readonly children: NodeChild[];
}

export interface BrowserSelectedPsdLayerExtractionOptions {
  readonly extractionKind: "selectedLayerRasterV1";
  readonly optionsSchemaVersion: "psd-layer-extraction-options-v1";
  readonly options: {
    readonly parserMethod: "Layer.composite(false, false)";
    readonly effect: false;
    readonly composed: false;
    readonly selectedNodeRef: string;
    readonly outputEncoding: "raw-rgba";
    readonly channelOrder: "rgba";
    readonly pixelFormat: "rgba8";
    readonly width: number;
    readonly height: number;
  };
}

export type BrowserSelectedPsdLayerMaterializationAdapterFailureKind =
  | "parserFailure"
  | "missingLayer"
  | "unsupportedLayerType"
  | "materializationFailure";

export interface BrowserSelectedPsdLayerMaterializationAdapterInput {
  readonly source: BrowserPsdParserBridgeSourceEvidence;
  readonly bytes: Uint8Array;
  readonly selectedLayerNodeRef: string;
}

export interface BrowserSelectedPsdLayerMaterializationAdapterSuccess {
  readonly status: "materialized";
  readonly parser: PsdAdapterParserEvidenceDto;
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
  readonly extraction: BrowserSelectedPsdLayerExtractionOptions;
  readonly rgbaBytes: Uint8Array;
}

export interface BrowserSelectedPsdLayerMaterializationAdapterFailure {
  readonly status: "failed";
  readonly failureKind: BrowserSelectedPsdLayerMaterializationAdapterFailureKind;
  readonly severity: "warning" | "error";
  readonly message: string;
  readonly parser: PsdAdapterParserEvidenceDto;
  readonly selectedNode?: {
    readonly nodeRef: string;
    readonly nodeType: "group";
    readonly sourceNodePath: readonly string[];
    readonly originalName: string;
  };
}

export type BrowserSelectedPsdLayerMaterializationAdapterResult =
  | BrowserSelectedPsdLayerMaterializationAdapterSuccess
  | BrowserSelectedPsdLayerMaterializationAdapterFailure;

export const parseBrowserPsdBytesWithAdapter = async (
  input: BrowserPsdParserAdapterInput
): Promise<BrowserPsdParserBridgeParsedResult | BrowserPsdParserBridgeFailedResult> => {
  const parser = createBrowserPsdParserEvidence();

  try {
    const parsedPsd = Psd.parse(toExactArrayBuffer(input.bytes)) as ParsedPsd;
    const treeProjection = projectPsdTree(parsedPsd);
    const featureSupportEvidence = createDocumentFeatureSupportEvidence();
    const materialization = await createSelectedLayerMaterializationEvidence({
      parsedPsd,
      source: input.source,
      sourceBytes: input.bytes,
      parser,
      ...(input.selectedLayerNodeRef === undefined ? {} : { selectedLayerNodeRef: input.selectedLayerNodeRef })
    });
    const diagnostics: PsdAdapterDiagnosticDto[] = [
      {
        checkId: "browserPsdParser.parse.completed",
        severity: "info",
        message: "Explicit browser PSD bytes were parsed into parser-free layer tree evidence.",
        source: { kind: "adapter", path: "/browser-psd-parser-bridge/parse" },
        evidence: [
          `layerCount=${treeProjection.treeSummary.layerCount}`,
          `groupCount=${treeProjection.treeSummary.groupCount}`
        ]
      },
      {
        checkId: "browserPsdParser.mainThreadRisk.recorded",
        severity: "warning",
        message: "PSD parsing currently runs on the browser main thread; Wave45 Domain B limits risk with a size cap.",
        source: { kind: "adapter", path: "/browser-psd-parser-bridge/threading" },
        evidence: [
          "workerDecision=not-implemented-wave45-domain-b-bounded-scope",
          `sizeCapBytes=${input.source.sizeCapBytes}`
        ]
      },
      ...materialization.diagnostics
    ];
    const adapterResult = PsdAdapterResultSchema.parse({
      schemaVersion: "psd-adapter-result-v1",
      sourceProfile: "layered-character-psd-profile-v1",
      adapterName: browserPsdParserBridgeAdapterName,
      adapterVersion: browserPsdParserBridgeAdapterVersion,
      intakeKind: "realPsdParseResult",
      parser,
      canvas: {
        width: parsedPsd.width,
        height: parsedPsd.height,
        bounds: {
          x: 0,
          y: 0,
          width: parsedPsd.width,
          height: parsedPsd.height
        }
      },
      sourceGroups: treeProjection.sourceGroups,
      sourceLayers: treeProjection.sourceLayers,
      unsupportedFeatures: [],
      featureSupportEvidence,
      layerTreeEvidence: {
        evidenceKind: "psd-layer-tree-evidence-v1",
        evidenceId: `layerTree_${toSafeToken(input.source.sourceAssetId, "browserPsdImport")}`,
        intakeKind: "realPsdParseResult",
        groupCount: treeProjection.treeSummary.groupCount,
        layerCount: treeProjection.treeSummary.layerCount,
        maxDepth: treeProjection.treeSummary.maxDepth,
        parser,
        privateShapePolicy: "parser-private-shape-excluded-v1"
      },
      ...(materialization.materializationEvidence.length === 0
        ? {}
        : { materializationEvidence: materialization.materializationEvidence }),
      diagnostics
    }) satisfies PsdAdapterResultDto;

    return {
      status: "parsed",
      source: input.source,
      threading: input.threading,
      treeSummary: treeProjection.treeSummary,
      adapterResult,
      diagnostics,
      errorEvidence: materialization.errorEvidence
    };
  } catch (error) {
    const message = formatUnknownError(error);
    const diagnostics = [
      {
        checkId: "browserPsdParser.parse.failed",
        severity: "error" as const,
        message: `PSD parser failed before parser-free adapter evidence could be created: ${message}`,
        source: { kind: "adapter" as const, path: "/browser-psd-parser-bridge/parse" },
        evidence: ["parserPrivateShape=excluded"]
      }
    ];

    return {
      status: "failed",
      source: input.source,
      threading: input.threading,
      diagnostics,
      errorEvidence: [
        createBrowserPsdParserErrorEvidence({
          errorId: "browserPsdParser.parse.failed",
          failureKind: "parserFailure",
          severity: "error",
          message,
          source: input.source,
          parser
        })
      ]
    };
  }
};

export const materializeSelectedPsdLayerWithAdapter = async (
  input: BrowserSelectedPsdLayerMaterializationAdapterInput
): Promise<BrowserSelectedPsdLayerMaterializationAdapterResult> => {
  const parser = createBrowserPsdParserEvidence();
  const selectedLayerNodeRef = input.selectedLayerNodeRef.trim();

  if (selectedLayerNodeRef.length === 0) {
    return {
      status: "failed",
      failureKind: "missingLayer",
      severity: "error",
      message: "Selected PSD layer node reference is required.",
      parser
    };
  }

  let parsedPsd: ParsedPsd;
  try {
    parsedPsd = Psd.parse(toExactArrayBuffer(input.bytes)) as ParsedPsd;
  } catch (error) {
    return {
      status: "failed",
      failureKind: "parserFailure",
      severity: "error",
      message: formatUnknownError(error),
      parser
    };
  }

  const selected = findNodeByNodeRef(parsedPsd, selectedLayerNodeRef);
  if (selected === undefined) {
    return {
      status: "failed",
      failureKind: "missingLayer",
      severity: "error",
      message: `Selected PSD layer node reference was not found: ${selectedLayerNodeRef}`,
      parser
    };
  }

  if (selected.kind !== "layer") {
    return {
      status: "failed",
      failureKind: "unsupportedLayerType",
      severity: "warning",
      message: `Selected PSD node is a ${selected.kind}; only explicit layer nodes can be materialized.`,
      parser,
      selectedNode: {
        nodeRef: selected.nodeRef,
        nodeType: "group",
        sourceNodePath: selected.sourceNodePath,
        originalName: selected.displayName
      }
    };
  }

  try {
    const rgbaBytes = copyPsdRgbaBytes(await selected.layer.composite(false, false));
    const extraction = createSelectedLayerExtractionOptions({
      selectedNodeRef: selected.nodeRef,
      width: selected.layer.width,
      height: selected.layer.height
    });

    return {
      status: "materialized",
      parser,
      selectedLayer: {
        sourceLayerId: selected.nodeRef,
        sourceLayerPath: selected.sourceNodePath,
        originalName: selected.displayName,
        bounds: {
          x: selected.layer.left,
          y: selected.layer.top,
          width: Math.max(0, selected.layer.width),
          height: Math.max(0, selected.layer.height)
        },
        visibleInSource: !selected.layer.isHidden,
        width: selected.layer.width,
        height: selected.layer.height
      },
      extraction,
      rgbaBytes
    };
  } catch (error) {
    return {
      status: "failed",
      failureKind: "materializationFailure",
      severity: "warning",
      message: formatUnknownError(error),
      parser
    };
  }
};

const createBrowserPsdParserEvidence = (): PsdAdapterParserEvidenceDto => ({
  evidenceKind: "psd-parser-evidence-v1",
  parserName: "webtoonPsd",
  parserPackageName: "@webtoon/psd",
  parserVersion: "0.4.0",
  adapterName: browserPsdParserBridgeAdapterName,
  adapterVersion: browserPsdParserBridgeAdapterVersion,
  runtime: "browser",
  privateShapePolicy: "parser-private-shape-excluded-v1"
});

const projectPsdTree = (parsedPsd: ParsedPsd): PsdTreeProjection => {
  const sourceGroups: PsdAdapterSourceGroupDto[] = [];
  const sourceLayers: PsdAdapterSourceLayerDto[] = [];
  const summary = {
    groupCount: 0,
    layerCount: 0,
    visibleLayerCount: 0,
    hiddenLayerCount: 0,
    rasterCandidateLayerCount: 0,
    maxDepth: 0
  };
  let sourceOrder = 0;

  parsedPsd.children.forEach((child, index) => {
    sourceOrder = collectPsdNode({
      node: child,
      siblingIndex: index,
      parentNodeRef: "psd:root",
      parentGroupPath: [],
      parentGroupId: undefined,
      depth: 1,
      sourceOrder,
      sourceGroups,
      sourceLayers,
      summary
    });
  });

  return {
    sourceGroups,
    sourceLayers,
    treeSummary: summary
  };
};

const collectPsdNode = (input: {
  readonly node: NodeChild;
  readonly siblingIndex: number;
  readonly parentNodeRef: string;
  readonly parentGroupPath: readonly string[];
  readonly parentGroupId: string | undefined;
  readonly depth: number;
  readonly sourceOrder: number;
  readonly sourceGroups: PsdAdapterSourceGroupDto[];
  readonly sourceLayers: PsdAdapterSourceLayerDto[];
  readonly summary: {
    groupCount: number;
    layerCount: number;
    visibleLayerCount: number;
    hiddenLayerCount: number;
    rasterCandidateLayerCount: number;
    maxDepth: number;
  };
}): number => {
  const kind = input.node.type === "Layer" ? "layer" : "group";
  const nodeRef = `${input.parentNodeRef}/${kind}[${input.siblingIndex}]`;
  const displayName = getDisplayNodeName(input.node, kind, input.siblingIndex);
  let nextSourceOrder = input.sourceOrder;
  input.summary.maxDepth = Math.max(input.summary.maxDepth, input.depth);

  if (isPsdLayer(input.node)) {
    const visibleInSource = !input.node.isHidden;
    const layer: PsdAdapterSourceLayerDto = {
      sourceLayerId: nodeRef,
      originalName: displayName,
      normalizedName: toNormalizedName(displayName, `layer_${input.siblingIndex}`),
      ...(input.parentGroupId === undefined ? {} : { parentGroupId: input.parentGroupId }),
      groupPath: [...input.parentGroupPath],
      sourceOrder: nextSourceOrder,
      bounds: {
        x: input.node.left,
        y: input.node.top,
        width: Math.max(0, input.node.width),
        height: Math.max(0, input.node.height)
      },
      visibleInSource,
      opacityInSource: normalizeOpacity(input.node.composedOpacity, input.node.opacity),
      role: "referenceOnly",
      unsupportedFeatures: []
    };

    input.sourceLayers.push(layer);
    input.summary.layerCount += 1;
    if (visibleInSource) {
      input.summary.visibleLayerCount += 1;
    } else {
      input.summary.hiddenLayerCount += 1;
    }
    if (visibleInSource && input.node.width > 0 && input.node.height > 0) {
      input.summary.rasterCandidateLayerCount += 1;
    }
    return nextSourceOrder + 1;
  }

  const groupPath = [...input.parentGroupPath, displayName];
  const sourceGroupId = `group_${toSafeToken(nodeRef, `group_${input.siblingIndex}`)}`;
  const group = input.node as Group;
  input.sourceGroups.push({
    sourceGroupId,
    originalName: displayName,
    normalizedName: toNormalizedName(displayName, `group_${input.siblingIndex}`),
    ...(input.parentGroupId === undefined ? {} : { parentGroupId: input.parentGroupId }),
    groupPath,
    sourceOrder: nextSourceOrder,
    visibleInSource: true,
    opacityInSource: normalizeOpacity(group.composedOpacity, group.opacity),
    unsupportedFeatures: []
  });
  input.summary.groupCount += 1;
  nextSourceOrder += 1;

  const groupChildren = group.children as NodeChild[];
  groupChildren.forEach((child: NodeChild, index: number) => {
    nextSourceOrder = collectPsdNode({
      node: child,
      siblingIndex: index,
      parentNodeRef: nodeRef,
      parentGroupPath: groupPath,
      parentGroupId: sourceGroupId,
      depth: input.depth + 1,
      sourceOrder: nextSourceOrder,
      sourceGroups: input.sourceGroups,
      sourceLayers: input.sourceLayers,
      summary: input.summary
    });
  });

  return nextSourceOrder;
};

const createDocumentFeatureSupportEvidence = (): readonly PsdAdapterFeatureSupportEvidenceDto[] => [
  {
    evidenceKind: "psd-feature-support-evidence-v1",
    featureId: "psd.fullCompositing",
    status: "notEvaluated",
    scope: "document",
    severity: "info",
    message: "Photoshop-style final compositing is not evaluated by the browser PSD parser bridge.",
    source: { kind: "document", path: "/document" },
    rasterizeCandidate: false,
    manualConfirmationRequired: true
  },
  {
    evidenceKind: "psd-feature-support-evidence-v1",
    featureId: "psd.layerEffects",
    status: "notEvaluated",
    scope: "layer",
    severity: "warning",
    message: "Layer effects are not evaluated by the browser PSD parser bridge.",
    source: { kind: "adapter", path: "/feature-support/layer-effects" },
    rasterizeCandidate: false,
    manualConfirmationRequired: true
  },
  {
    evidenceKind: "psd-feature-support-evidence-v1",
    featureId: "psd.rendererPixelOracle",
    status: "notEvaluated",
    scope: "document",
    severity: "info",
    message: "Renderer pixel oracle behavior is not evaluated by the browser PSD parser bridge.",
    source: { kind: "adapter", path: "/feature-support/renderer-pixel-oracle" },
    rasterizeCandidate: false,
    manualConfirmationRequired: true
  },
  {
    evidenceKind: "psd-feature-support-evidence-v1",
    featureId: "psd.textureSamplingCorrectness",
    status: "notEvaluated",
    scope: "document",
    severity: "info",
    message: "Texture sampling correctness is not evaluated by the browser PSD parser bridge.",
    source: { kind: "adapter", path: "/feature-support/texture-sampling" },
    rasterizeCandidate: false,
    manualConfirmationRequired: true
  }
];

const createSelectedLayerMaterializationEvidence = async (input: {
  readonly parsedPsd: ParsedPsd;
  readonly source: BrowserPsdParserBridgeSourceEvidence;
  readonly sourceBytes: Uint8Array;
  readonly parser: PsdAdapterParserEvidenceDto;
  readonly selectedLayerNodeRef?: string;
}): Promise<MaterializationProjection> => {
  if (input.selectedLayerNodeRef === undefined || input.selectedLayerNodeRef.trim().length === 0) {
    return {
      materializationEvidence: [],
      diagnostics: [
        {
          checkId: "browserPsdParser.materialization.notRequested",
          severity: "info",
          message: "No selected PSD layer materialization was requested for this parse.",
          source: { kind: "adapter", path: "/browser-psd-parser-bridge/materialization" },
          evidence: ["selectedLayerNodeRef=missing"]
        }
      ],
      errorEvidence: []
    };
  }

  try {
    const selected = findLayerByNodeRef(input.parsedPsd, input.selectedLayerNodeRef);
    if (selected === undefined) {
      throw new Error(`Selected PSD layer node reference was not found: ${input.selectedLayerNodeRef}`);
    }

    const sourceDigest = await computeBrowserPsdSha256Digest(input.sourceBytes);
    const rgbaBytes = copyPsdRgbaBytes(await selected.layer.composite(false, false));
    const rgbaDigest = await computeBrowserPsdSha256Digest(rgbaBytes);
    const materializationEvidence = PsdAdapterLayerMaterializationEvidenceSchema.parse({
      evidenceKind: "psd-layer-materialization-evidence-v1",
      materializationId: `mat_${toSafeToken(selected.nodeRef, "selectedLayer")}`,
      sourceLayerRef: {
        sourceAssetId: input.source.sourceAssetId,
        sourceLayerId: selected.nodeRef,
        sourceLayerName: selected.sourceLayerPath.at(-1) ?? selected.nodeRef,
        sourceLayerPath: selected.sourceLayerPath
      },
      mediaType: "application/vnd.ai-native-live2d.raw-rgba; pixelFormat=rgba8",
      byteLength: rgbaBytes.byteLength,
      digest: rgbaDigest,
      width: selected.layer.width,
      height: selected.layer.height,
      provenance: {
        sourceFilePath: `browser-explicit-file/${toSafeToken(input.source.fileName, "selectedPsd")}`,
        sourceDigest,
        sourceByteLength: input.source.byteLength,
        sourceMediaType: input.source.declaredMediaType ?? "image/vnd.adobe.photoshop",
        privacyLabel: "packageLocalAsset",
        publicDistribution: "notPublicDistributable",
        publicDemoAsset: false,
        generatedBy: "wave45.browserPsdParserBridge"
      },
      parser: input.parser,
      extraction: createPsdAdapterLayerExtractionOptions({
        selectedNodeRef: selected.nodeRef,
        width: selected.layer.width,
        height: selected.layer.height,
        bytesPersisted: false
      })
    });

    return {
      materializationEvidence: [materializationEvidence],
      diagnostics: [
        {
          checkId: "browserPsdParser.materialization.completed",
          severity: "info",
          message: "Selected PSD layer materialization evidence was summarized without persisting raw raster bytes.",
          source: { kind: "layer", id: selected.nodeRef },
          evidence: [
            `byteLength=${rgbaBytes.byteLength}`,
            `digest=${rgbaDigest.algorithm}:${rgbaDigest.hex}`
          ]
        }
      ],
      errorEvidence: []
    };
  } catch (error) {
    const message = formatUnknownError(error);

    return {
      materializationEvidence: [],
      diagnostics: [
        {
          checkId: "browserPsdParser.materialization.failed",
          severity: "warning",
          message: `Selected PSD layer materialization evidence could not be created: ${message}`,
          source: { kind: "adapter", path: "/browser-psd-parser-bridge/materialization" },
          evidence: ["parserPrivateShape=excluded"]
        }
      ],
      errorEvidence: [
        createBrowserPsdParserErrorEvidence({
          errorId: "browserPsdParser.materialization.failed",
          failureKind: "materializationFailure",
          severity: "warning",
          message,
          source: input.source,
          parser: input.parser
        })
      ]
    };
  }
};

const findLayerByNodeRef = (
  parsedPsd: ParsedPsd,
  targetNodeRef: string
): SelectedLayerResolution | undefined => {
  const selected = findNodeByNodeRef(parsedPsd, targetNodeRef);
  if (selected?.kind !== "layer") {
    return undefined;
  }

  return {
    layer: selected.layer,
    nodeRef: selected.nodeRef,
    sourceLayerPath: selected.sourceNodePath
  };
};

const findNodeByNodeRef = (
  parsedPsd: ParsedPsd,
  targetNodeRef: string
): SelectedNodeResolution | undefined =>
  findNodeInChildren({
    children: parsedPsd.children,
    targetNodeRef,
    parentNodeRef: "psd:root",
    parentPath: []
  });

const findNodeInChildren = (input: {
  readonly children: readonly NodeChild[];
  readonly targetNodeRef: string;
  readonly parentNodeRef: string;
  readonly parentPath: readonly string[];
}): SelectedNodeResolution | undefined => {
  for (let index = 0; index < input.children.length; index += 1) {
    const child = input.children[index];
    if (child === undefined) {
      continue;
    }
    const kind = child.type === "Layer" ? "layer" : "group";
    const nodeRef = `${input.parentNodeRef}/${kind}[${index}]`;
    const sourceLayerPath = [...input.parentPath, getDisplayNodeName(child, kind, index)];

    if (nodeRef === input.targetNodeRef) {
      if (isPsdLayer(child)) {
        return {
          kind: "layer",
          layer: child,
          nodeRef,
          sourceNodePath: sourceLayerPath,
          displayName: getDisplayNodeName(child, kind, index)
        };
      }

      return {
        kind: "group",
        group: child,
        nodeRef,
        sourceNodePath: sourceLayerPath,
        displayName: getDisplayNodeName(child, kind, index)
      };
    }

    if (!isPsdLayer(child)) {
      const nested = findNodeInChildren({
        children: child.children,
        targetNodeRef: input.targetNodeRef,
        parentNodeRef: nodeRef,
        parentPath: sourceLayerPath
      });
      if (nested !== undefined) {
        return nested;
      }
    }
  }

  return undefined;
};

const createSelectedLayerExtractionOptions = (input: {
  readonly selectedNodeRef: string;
  readonly width: number;
  readonly height: number;
}): BrowserSelectedPsdLayerExtractionOptions => ({
  extractionKind: "selectedLayerRasterV1",
  optionsSchemaVersion: "psd-layer-extraction-options-v1",
  options: {
    parserMethod: "Layer.composite(false, false)",
    effect: false,
    composed: false,
    selectedNodeRef: input.selectedNodeRef,
    outputEncoding: "raw-rgba",
    channelOrder: "rgba",
    pixelFormat: "rgba8",
    width: input.width,
    height: input.height
  }
});

const createPsdAdapterLayerExtractionOptions = (input: {
  readonly selectedNodeRef: string;
  readonly width: number;
  readonly height: number;
  readonly bytesPersisted: false;
}) => ({
  ...createSelectedLayerExtractionOptions(input),
  options: {
    ...createSelectedLayerExtractionOptions(input).options,
    bytesPersisted: input.bytesPersisted
  }
});

const computeBrowserPsdSha256Digest = async (
  bytes: Uint8Array | Uint8ClampedArray
): Promise<BinaryAssetDigestDto> => {
  const result = await computePackageBinarySha256Digest(bytes);
  if (result.status === "unsupported") {
    throw new Error(`SHA-256 digest is unavailable: ${result.reason}`);
  }

  return result.digest;
};

const toExactArrayBuffer = (bytes: Uint8Array): ArrayBuffer =>
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);

const copyPsdRgbaBytes = (bytes: Uint8Array | Uint8ClampedArray): Uint8Array =>
  new Uint8Array(bytes);

const isPsdLayer = (node: NodeChild): node is Layer => node.type === "Layer";

const getDisplayNodeName = (
  node: NodeChild,
  kind: "group" | "layer",
  siblingIndex: number
): string => {
  const name = typeof node.name === "string" ? node.name.trim() : "";
  return name.length === 0 ? `${kind}_${siblingIndex}` : name;
};

const normalizeOpacity = (composedOpacity: number, opacity: number): number => {
  if (Number.isFinite(composedOpacity) && composedOpacity >= 0 && composedOpacity <= 1) {
    return composedOpacity;
  }

  if (Number.isFinite(opacity)) {
    return Math.min(1, Math.max(0, opacity / 255));
  }

  return 1;
};

const toNormalizedName = (name: string, fallback: string): string =>
  toSafeToken(name.toLowerCase(), fallback);

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

const formatUnknownError = (error: unknown): string => {
  const message = error instanceof Error ? error.message : String(error);
  return message.length <= 320 ? message : `${message.slice(0, 317)}...`;
};
