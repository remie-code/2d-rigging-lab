import Psd from "@webtoon/psd";
import type { Group, Layer, NodeChild } from "@webtoon/psd";
import type {
  PsdAdapterLayerMaterializationEvidenceDto,
  PsdAdapterParserEvidenceDto,
  PsdAdapterResultDto,
  PsdAdapterSourceGroupDto,
  PsdAdapterSourceLayerDto
} from "@private-2d-rigging-lab/operation-core";

import { PSD_SELECTED_LAYER_RAW_RGBA_MEDIA_TYPE } from "@private-2d-rigging-lab/operation-core";
import {
  ProvenanceIdSchema,
  SourceAssetIdSchema,
  TextureIdSchema,
  type SourceAssetId
} from "@private-2d-rigging-lab/contracts";

export interface BrowserPsdParserInput {
  readonly bytes: ArrayBuffer;
  readonly fileName: string;
  readonly importDisplayName: string;
  readonly planToken: string;
  readonly sourceAssetId: SourceAssetId;
  readonly materializedLayerLimit: number;
}

export interface BrowserPsdParserResult {
  readonly adapterResult: PsdAdapterResultDto;
  readonly materializedLayerBytes: readonly BrowserPsdMaterializedLayerBytes[];
  readonly sourceDigest: {
    readonly algorithm: "sha256";
    readonly hex: string;
  };
  readonly sourceByteLength: number;
  readonly sourceFilePath: string;
}

export interface BrowserPsdMaterializedLayerBytes {
  readonly sourceLayerId: string;
  readonly materializationId: string;
  readonly binaryAssetRef: NonNullable<PsdAdapterLayerMaterializationEvidenceDto["binaryAssetRef"]>;
  readonly width: number;
  readonly height: number;
  readonly bytes: Uint8Array;
}

interface ParsedGroupNode {
  readonly kind: "group";
  readonly sourceGroupId: string;
  readonly originalName: string;
  readonly normalizedName: string;
  readonly parentGroupId: string;
  readonly groupPath: readonly string[];
  readonly sourceOrder: number;
  readonly visibleInSource: boolean;
  readonly localVisibleInSource: boolean;
  readonly effectiveVisibleInSource: boolean;
  readonly opacityInSource: number;
  readonly bounds?: RectLike;
}

interface ParsedLayerNode {
  readonly kind: "layer";
  readonly sourceLayerId: string;
  readonly originalName: string;
  readonly normalizedName: string;
  readonly parentGroupId: string;
  readonly groupPath: readonly string[];
  readonly sourceOrder: number;
  readonly bounds: RectLike;
  readonly visibleInSource: boolean;
  readonly localVisibleInSource: boolean;
  readonly effectiveVisibleInSource: boolean;
  readonly opacityInSource: number;
  readonly layer: Layer;
}

type WebtoonPsdPublicHiddenShape = {
  readonly isHidden?: unknown;
};

type WebtoonPsdGroupPrivateHiddenShape = {
  readonly layerFrame?: {
    readonly layerProperties?: {
      readonly hidden?: unknown;
    };
  };
};

interface RectLike {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

const PARSER_EVIDENCE: PsdAdapterParserEvidenceDto = {
  evidenceKind: "psd-parser-evidence-v1",
  parserName: "webtoonPsd",
  parserPackageName: "@webtoon/psd",
  parserVersion: "0.4.0",
  adapterName: "editor-browser-psd-parser-adapter",
  adapterVersion: "0.1.0",
  runtime: "browser",
  privateShapePolicy: "parser-private-shape-excluded-v1"
};

export async function parsePsdForEditorImport(
  input: BrowserPsdParserInput
): Promise<BrowserPsdParserResult> {
  const sourceDigest = await sha256Bytes(input.bytes);
  const psd = Psd.parse(input.bytes);
  const syntheticRootId = "psd:root";
  const syntheticRootPath = [input.importDisplayName];
  let sourceOrder = 0;
  const groups: ParsedGroupNode[] = [
    {
      kind: "group",
      sourceGroupId: syntheticRootId,
      originalName: input.importDisplayName,
      normalizedName: normalizeName(input.importDisplayName),
      parentGroupId: "",
      groupPath: syntheticRootPath,
      sourceOrder: sourceOrder++,
      visibleInSource: true,
      localVisibleInSource: true,
      effectiveVisibleInSource: true,
      opacityInSource: 1,
      bounds: {
        x: 0,
        y: 0,
        width: psd.width,
        height: psd.height
      }
    }
  ];
  const layers: ParsedLayerNode[] = [];

  walkPsdChildren({
    children: psd.children,
    parentNodeRef: syntheticRootId,
    parentGroupId: syntheticRootId,
    parentPath: syntheticRootPath,
    parentEffectiveVisible: true,
    groups,
    layers,
    nextSourceOrder: () => sourceOrder++
  });

  const materializedLayers = layers
    .filter((layer) => hasPositiveBounds(layer.bounds))
    .slice(0, input.materializedLayerLimit);
  const materializedLayerResults: CreatedLayerMaterialization[] = [];

  for (const layer of materializedLayers) {
    materializedLayerResults.push(
      await createLayerMaterializationEvidence({
        fileName: input.fileName,
        layer,
        planToken: input.planToken,
        sourceAssetId: input.sourceAssetId,
        sourceDigest,
        sourceByteLength: input.bytes.byteLength
      })
    );
  }
  const materializationEvidence = materializedLayerResults.map((result) => result.evidence);

  const adapterResult: PsdAdapterResultDto = {
    schemaVersion: "psd-adapter-result-v1",
    sourceProfile: "layered-character-psd-profile-v1",
    adapterName: "editor-browser-psd-parser-adapter",
    adapterVersion: "0.1.0",
    intakeKind: "realPsdParseResult",
    parser: PARSER_EVIDENCE,
    canvas: {
      width: psd.width,
      height: psd.height,
      bounds: {
        x: 0,
        y: 0,
        width: psd.width,
        height: psd.height
      }
    },
    sourceGroups: groups.map(toAdapterGroup),
    sourceLayers: layers.map(toAdapterLayer),
    unsupportedFeatures: [],
    layerTreeEvidence: {
      evidenceKind: "psd-layer-tree-evidence-v1",
      evidenceId: `layerTree_${input.planToken}`,
      intakeKind: "realPsdParseResult",
      groupCount: groups.length,
      layerCount: layers.length,
      maxDepth: Math.max(0, ...groups.map((group) => group.groupPath.length)),
      parser: PARSER_EVIDENCE,
      privateShapePolicy: "parser-private-shape-excluded-v1"
    },
    materializationEvidence,
    diagnostics: []
  };

  return {
    adapterResult,
    materializedLayerBytes: materializedLayerResults.map((result) => result.layerBytes),
    sourceDigest,
    sourceByteLength: input.bytes.byteLength,
    sourceFilePath: `assets/sources/private/${input.planToken}/${sanitizeFileName(input.fileName)}`
  };
}

function walkPsdChildren(input: {
  readonly children: readonly NodeChild[];
  readonly parentNodeRef: string;
  readonly parentGroupId: string;
  readonly parentPath: readonly string[];
  readonly parentEffectiveVisible: boolean;
  readonly groups: ParsedGroupNode[];
  readonly layers: ParsedLayerNode[];
  readonly nextSourceOrder: () => number;
}): RectLike | undefined {
  const childBounds: RectLike[] = [];

  input.children.forEach((child, index) => {
    const nodeKind = child.type === "Layer" ? "layer" : "group";
    const nodeRef = `${input.parentNodeRef}/${nodeKind}[${index}]`;

    if (child.type === "Layer") {
      const localVisible = !isPsdNodeHiddenForEditorImport(child);
      const effectiveVisible = input.parentEffectiveVisible && localVisible;
      const bounds = {
        x: child.left,
        y: child.top,
        width: child.width,
        height: child.height
      };
      input.layers.push({
        kind: "layer",
        sourceLayerId: nodeRef,
        originalName: normalizeDisplayName(child.name, `Layer ${index + 1}`),
        normalizedName: normalizeName(child.name),
        parentGroupId: input.parentGroupId,
        groupPath: input.parentPath,
        sourceOrder: input.nextSourceOrder(),
        bounds,
        visibleInSource: effectiveVisible,
        localVisibleInSource: localVisible,
        effectiveVisibleInSource: effectiveVisible,
        opacityInSource: normalizeOpacity(child.opacity),
        layer: child
      });
      if (hasPositiveBounds(bounds)) {
        childBounds.push(bounds);
      }
      return;
    }

    const group = child as Group;
    const localVisible = !isPsdNodeHiddenForEditorImport(group);
    const effectiveVisible = input.parentEffectiveVisible && localVisible;
    const groupPath = [...input.parentPath, normalizeDisplayName(group.name, `Group ${index + 1}`)];
    const groupBounds = walkPsdChildren({
      children: group.children,
      parentNodeRef: nodeRef,
      parentGroupId: nodeRef,
      parentPath: groupPath,
      parentEffectiveVisible: effectiveVisible,
      groups: input.groups,
      layers: input.layers,
      nextSourceOrder: input.nextSourceOrder
    });

    input.groups.push({
      kind: "group",
      sourceGroupId: nodeRef,
      originalName: normalizeDisplayName(group.name, `Group ${index + 1}`),
      normalizedName: normalizeName(group.name),
      parentGroupId: input.parentGroupId,
      groupPath,
      sourceOrder: input.nextSourceOrder(),
      visibleInSource: effectiveVisible,
      localVisibleInSource: localVisible,
      effectiveVisibleInSource: effectiveVisible,
      opacityInSource: normalizeOpacity(group.opacity),
      ...(groupBounds === undefined ? {} : { bounds: groupBounds })
    });
    if (groupBounds !== undefined) {
      childBounds.push(groupBounds);
    }
  });

  return unionBounds(childBounds);
}

async function createLayerMaterializationEvidence(input: {
  readonly fileName: string;
  readonly layer: ParsedLayerNode;
  readonly planToken: string;
  readonly sourceAssetId: SourceAssetId;
  readonly sourceDigest: { readonly algorithm: "sha256"; readonly hex: string };
  readonly sourceByteLength: number;
}): Promise<CreatedLayerMaterialization> {
  const rgbaBytes = await input.layer.layer.composite(false, false);
  const digest = await sha256Bytes(rgbaBytes);
  const layerToken = sanitizeIdToken(input.layer.sourceLayerId);
  const textureId = TextureIdSchema.parse(`tex_${input.planToken}_${layerToken}`);
  const provenanceId = ProvenanceIdSchema.parse(`prov_${input.planToken}_${layerToken}`);
  const binaryAssetRef = {
    referenceKind: "package-binary-asset-ref-v1",
    binaryAssetId: `bin_${input.planToken}_${layerToken}_rgba`,
    packageRelativePath: `assets/textures/psd/${input.planToken}/${layerToken}.raw-rgba`,
    digest,
    byteLength: rgbaBytes.byteLength,
    mediaType: PSD_SELECTED_LAYER_RAW_RGBA_MEDIA_TYPE,
    storageStatus: "stored-package-local-v1",
    provenanceId,
    rightsAssetId: input.sourceAssetId
  } as const;

  const evidence: PsdAdapterLayerMaterializationEvidenceDto = {
    evidenceKind: "psd-layer-materialization-evidence-v1",
    materializationId: `mat_${input.planToken}_${layerToken}`,
    sourceLayerRef: {
      sourceAssetId: input.sourceAssetId,
      sourceLayerId: input.layer.sourceLayerId,
      sourceLayerName: input.layer.originalName,
      sourceLayerPath: [...input.layer.groupPath, input.layer.originalName]
    },
    mediaType: PSD_SELECTED_LAYER_RAW_RGBA_MEDIA_TYPE,
    byteLength: rgbaBytes.byteLength,
    digest,
    width: input.layer.bounds.width,
    height: input.layer.bounds.height,
    binaryAssetRef,
    textureId,
    provenance: {
      sourceFilePath: input.fileName,
      sourceDigest: input.sourceDigest,
      sourceByteLength: input.sourceByteLength,
      sourceMediaType: "image/vnd.adobe.photoshop",
      privacyLabel: "packageLocalAsset",
      publicDistribution: "notPublicDistributable",
      generatedBy: "editor-browser-psd-parser-adapter",
      publicDemoAsset: false
    },
    parser: PARSER_EVIDENCE,
    extraction: {
      extractionKind: "selectedLayerRasterV1",
      optionsSchemaVersion: "psd-layer-extraction-options-v1",
      options: {
        channelOrder: "rgba",
        includeEffects: false,
        includeHiddenLayers: false,
        composeWithOtherLayers: false,
        layerSelection: input.layer.sourceLayerId
      }
    }
  };

  return {
    evidence,
    layerBytes: {
      sourceLayerId: input.layer.sourceLayerId,
      materializationId: evidence.materializationId,
      binaryAssetRef,
      width: input.layer.bounds.width,
      height: input.layer.bounds.height,
      bytes: new Uint8Array(rgbaBytes)
    }
  };
}

interface CreatedLayerMaterialization {
  readonly evidence: PsdAdapterLayerMaterializationEvidenceDto;
  readonly layerBytes: BrowserPsdMaterializedLayerBytes;
}

export function createPsdSourceAssetId(planToken: string): SourceAssetId {
  return SourceAssetIdSchema.parse(`src_${planToken}`);
}

function toAdapterGroup(group: ParsedGroupNode): PsdAdapterSourceGroupDto {
  return {
    sourceGroupId: group.sourceGroupId,
    originalName: group.originalName,
    normalizedName: group.normalizedName,
    ...(group.parentGroupId.length === 0 ? {} : { parentGroupId: group.parentGroupId }),
    groupPath: [...group.groupPath],
    sourceOrder: group.sourceOrder,
    visibleInSource: group.visibleInSource,
    localVisibleInSource: group.localVisibleInSource,
    effectiveVisibleInSource: group.effectiveVisibleInSource,
    opacityInSource: group.opacityInSource,
    ...(group.bounds === undefined ? {} : { bounds: group.bounds }),
    unsupportedFeatures: []
  };
}

function toAdapterLayer(layer: ParsedLayerNode): PsdAdapterSourceLayerDto {
  return {
    sourceLayerId: layer.sourceLayerId,
    originalName: layer.originalName,
    normalizedName: layer.normalizedName,
    parentGroupId: layer.parentGroupId,
    groupPath: [...layer.groupPath],
    sourceOrder: layer.sourceOrder,
    bounds: layer.bounds,
    visibleInSource: layer.visibleInSource,
    localVisibleInSource: layer.localVisibleInSource,
    effectiveVisibleInSource: layer.effectiveVisibleInSource,
    opacityInSource: layer.opacityInSource,
    role: "editableLayer",
    unsupportedFeatures: []
  };
}

async function sha256Bytes(bytes: ArrayBuffer | Uint8Array): Promise<{
  readonly algorithm: "sha256";
  readonly hex: string;
}> {
  const source = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const digest = await crypto.subtle.digest("SHA-256", source);

  return {
    algorithm: "sha256",
    hex: [...new Uint8Array(digest)]
      .map((value) => value.toString(16).padStart(2, "0"))
      .join("")
  };
}

function unionBounds(bounds: readonly RectLike[]): RectLike | undefined {
  const positiveBounds = bounds.filter(hasPositiveBounds);
  if (positiveBounds.length === 0) {
    return undefined;
  }

  const left = Math.min(...positiveBounds.map((bound) => bound.x));
  const top = Math.min(...positiveBounds.map((bound) => bound.y));
  const right = Math.max(...positiveBounds.map((bound) => bound.x + bound.width));
  const bottom = Math.max(...positiveBounds.map((bound) => bound.y + bound.height));

  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top
  };
}

function hasPositiveBounds(bounds: RectLike): boolean {
  return bounds.width > 0 && bounds.height > 0;
}

export function isPsdNodeHiddenForEditorImport(node: NodeChild): boolean {
  const publicHidden = (node as WebtoonPsdPublicHiddenShape).isHidden;
  if (typeof publicHidden === "boolean") {
    return publicHidden;
  }

  const privateGroupHidden = (node as unknown as WebtoonPsdGroupPrivateHiddenShape)
    .layerFrame?.layerProperties?.hidden;
  return privateGroupHidden === true;
}

function normalizeDisplayName(value: string, fallback: string): string {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function normalizeName(value: string): string {
  return normalizeDisplayName(value, "unnamed").toLocaleLowerCase();
}

function normalizeOpacity(value: number): number {
  if (!Number.isFinite(value)) {
    return 1;
  }

  return Math.max(0, Math.min(1, value / 255));
}

function sanitizeFileName(value: string): string {
  const trimmed = value.trim().replace(/[/\\]+/g, "_");
  return trimmed.length > 0 ? trimmed : "source.psd";
}

function sanitizeIdToken(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return normalized.length > 0 ? normalized : "unnamed";
}
