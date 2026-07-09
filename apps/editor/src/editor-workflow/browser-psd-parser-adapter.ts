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
import { maxCoverageMarginSourcePixels } from "@private-2d-rigging-lab/authoring-core";
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

// Transparent alpha-edge padding baked around every extracted PSD layer raster,
// measured in source-texture pixels.
//
// Why: contour meshes extend a "covering margin" a few pixels beyond the
// drawable boundary. With a tightly-cropped raster and CLAMP/edge-extrude, those
// overshoot vertices sample stretched edge texels and bloom. A1
// (boundary-transparent-margin-design.md §5) instead receives the overshoot on
// *transparency*: the raster grows on every side, filled with
// premultiplied-transparent (0,0,0,0), so overshoot UV lands on transparent
// texels.
//
// Option E (2026-07-09): the padding width is a FUNCTION of the layer's long
// edge, not a fixed constant. `maxCoverageMarginSourcePixels(longEdge)` (the
// authoring-core canonical bound, re-exported from
// @private-2d-rigging-lab/authoring-core) returns the widest overshoot any live
// generator can produce for that layer size — ceil(clamp(0.012×longEdge,4,16)+1)
// source pixels: 5px for small layers, 17px for large, long-edge-proportional in
// between. Baking per layer keeps the padding generator-independent (it bounds
// v6d's constant ~3px and v7's proportional r alike) and needs no re-bake.
export const layerTransparentPaddingSourcePixels = (longEdgePixels: number): number =>
  maxCoverageMarginSourcePixels(longEdgePixels);

export interface PaddedLayerRaster {
  readonly bytes: Uint8Array;
  readonly width: number;
  readonly height: number;
  readonly contentInset: {
    readonly left: number;
    readonly top: number;
    readonly right: number;
    readonly bottom: number;
  };
}

/**
 * Bakes a uniform transparent border of `padding` source pixels around an RGBA
 * layer raster. The content is copied, row by row, to offset (padding, padding)
 * inside a (width + 2*padding) x (height + 2*padding) buffer that is zero-filled
 * (premultiplied-transparent (0,0,0,0)). Pure and deterministic: identical input
 * yields identical output bytes.
 */
export function padLayerRasterWithTransparentBorder(
  content: Uint8Array,
  contentWidth: number,
  contentHeight: number,
  padding: number
): PaddedLayerRaster {
  const paddedWidth = contentWidth + padding * 2;
  const paddedHeight = contentHeight + padding * 2;
  const bytes = new Uint8Array(paddedWidth * paddedHeight * 4);
  const contentRowBytes = contentWidth * 4;
  const paddedRowBytes = paddedWidth * 4;

  for (let row = 0; row < contentHeight; row += 1) {
    const srcStart = row * contentRowBytes;
    const dstStart = (row + padding) * paddedRowBytes + padding * 4;
    bytes.set(content.subarray(srcStart, srcStart + contentRowBytes), dstStart);
  }

  return {
    bytes,
    width: paddedWidth,
    height: paddedHeight,
    contentInset: {
      left: padding,
      top: padding,
      right: padding,
      bottom: padding
    }
  };
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

export async function createLayerMaterializationEvidence(input: {
  readonly fileName: string;
  readonly layer: ParsedLayerNode;
  readonly planToken: string;
  readonly sourceAssetId: SourceAssetId;
  readonly sourceDigest: { readonly algorithm: "sha256"; readonly hex: string };
  readonly sourceByteLength: number;
}): Promise<CreatedLayerMaterialization> {
  const rgbaBytes = await input.layer.layer.composite(false, false);
  // Bake a transparent alpha-edge border so contour covering-margin overshoot
  // samples transparency instead of stretched edge texels (A1). The border width
  // is a FUNCTION of the layer's long edge (Option E): P px on every side, where
  // P bounds the widest overshoot any generator can produce at this layer size.
  // All downstream evidence (byteLength/width/height/digest) is recomputed
  // against the padded raster; stage bounds stay content-sized and are bridged by
  // contentInset (all four sides = P).
  const contentRgba = rgbaBytes instanceof Uint8Array ? rgbaBytes : new Uint8Array(rgbaBytes);
  const longEdge = Math.max(input.layer.bounds.width, input.layer.bounds.height);
  const padding = layerTransparentPaddingSourcePixels(longEdge);
  const padded = padLayerRasterWithTransparentBorder(
    contentRgba,
    input.layer.bounds.width,
    input.layer.bounds.height,
    padding
  );
  const paddedBytes = padded.bytes;
  const digest = await sha256Bytes(paddedBytes);
  const layerToken = sanitizeIdToken(input.layer.sourceLayerId);
  const textureId = TextureIdSchema.parse(`tex_${input.planToken}_${layerToken}`);
  const provenanceId = ProvenanceIdSchema.parse(`prov_${input.planToken}_${layerToken}`);
  const binaryAssetRef = {
    referenceKind: "package-binary-asset-ref-v1",
    binaryAssetId: `bin_${input.planToken}_${layerToken}_rgba`,
    packageRelativePath: `assets/textures/psd/${input.planToken}/${layerToken}.raw-rgba`,
    digest,
    byteLength: paddedBytes.byteLength,
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
    byteLength: paddedBytes.byteLength,
    digest,
    width: padded.width,
    height: padded.height,
    contentInset: padded.contentInset,
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
      width: padded.width,
      height: padded.height,
      bytes: paddedBytes
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
