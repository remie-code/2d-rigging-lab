import type {
  PsdAdapterResultDto,
  PsdAdapterSourceGroupDto,
  PsdAdapterSourceLayerDto
} from "@private-2d-rigging-lab/operation-core";

import type { BrowserPsdMaterializedLayerBytes } from "../../../editor-workflow/browser-psd-parser-adapter";
import type { PsdImportPlan } from "./psd-import-types";

export interface PsdImportPreview {
  readonly canvasBounds: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  };
  readonly layers: readonly PsdImportPreviewLayer[];
}

export interface PsdImportPreviewLayer {
  readonly sourceLayerId: string;
  readonly sourceOrder: number;
  readonly bounds: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  };
  readonly opacity: number;
  readonly bytes: Uint8Array;
  readonly pixelWidth: number;
  readonly pixelHeight: number;
  readonly zIndex: number;
}

export interface PsdImportPreviewLayerDescriptor {
  readonly sourceLayerId: string;
  readonly sourceOrder: number;
  readonly bounds: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  };
  readonly opacity: number;
  readonly materialized: BrowserPsdMaterializedLayerBytes;
}

export function createPsdImportPreview(plan: PsdImportPlan): PsdImportPreview {
  const descriptors = createPsdImportPreviewLayerDescriptors({
    adapterResult: plan.adapterResult,
    materializedLayerBytes: plan.materializedLayerBytes
  });

  return {
    canvasBounds: resolvePsdPreviewCanvasBounds(plan.adapterResult),
    layers: descriptors.map((descriptor, index) => ({
      sourceLayerId: descriptor.sourceLayerId,
      sourceOrder: descriptor.sourceOrder,
      bounds: descriptor.bounds,
      opacity: descriptor.opacity,
      bytes: descriptor.materialized.bytes,
      pixelWidth: descriptor.materialized.width,
      pixelHeight: descriptor.materialized.height,
      zIndex: index + 1
    }))
  };
}

export function createPsdImportPreviewLayerDescriptors(input: {
  readonly adapterResult: PsdAdapterResultDto;
  readonly materializedLayerBytes: readonly BrowserPsdMaterializedLayerBytes[];
}): readonly PsdImportPreviewLayerDescriptor[] {
  const materializedByLayerId = new Map(
    input.materializedLayerBytes.map((layerBytes) => [layerBytes.sourceLayerId, layerBytes])
  );
  const groupsById = new Map(
    input.adapterResult.sourceGroups.map((group) => [group.sourceGroupId, group])
  );

  return input.adapterResult.sourceLayers
    .flatMap((layer) => {
      const materialized = materializedByLayerId.get(layer.sourceLayerId);
      if (
        materialized === undefined ||
        !isSourceEffectivelyVisible(layer) ||
        !hasPositiveBounds(layer.bounds)
      ) {
        return [];
      }

      return [
        {
          sourceLayerId: layer.sourceLayerId,
          sourceOrder: layer.sourceOrder,
          bounds: structuredClone(layer.bounds),
          opacity: resolveEffectiveOpacity(layer, groupsById),
          materialized
        }
      ];
    })
    .sort(compareBackToFrontSourceOrder);
}

export function resolvePsdPreviewCanvasBounds(adapterResult: PsdAdapterResultDto): {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
} {
  const bounds = adapterResult.canvas.bounds ?? {
    x: 0,
    y: 0,
    width: adapterResult.canvas.width,
    height: adapterResult.canvas.height
  };

  return {
    x: bounds.x,
    y: bounds.y,
    width: Math.max(1, bounds.width),
    height: Math.max(1, bounds.height)
  };
}

function resolveEffectiveOpacity(
  layer: PsdAdapterSourceLayerDto,
  groupsById: ReadonlyMap<string, PsdAdapterSourceGroupDto>
): number {
  let opacity = clampOpacity(layer.opacityInSource);
  let parentGroupId = layer.parentGroupId;
  const visited = new Set<string>();

  while (parentGroupId !== undefined && !visited.has(parentGroupId)) {
    visited.add(parentGroupId);
    const group = groupsById.get(parentGroupId);
    if (group === undefined) {
      break;
    }

    opacity *= clampOpacity(group.opacityInSource);
    parentGroupId = group.parentGroupId;
  }

  return clampOpacity(opacity);
}

function compareBackToFrontSourceOrder(
  left: PsdImportPreviewLayerDescriptor,
  right: PsdImportPreviewLayerDescriptor
): number {
  return (
    right.sourceOrder - left.sourceOrder ||
    right.sourceLayerId.localeCompare(left.sourceLayerId)
  );
}

function hasPositiveBounds(bounds: { readonly width: number; readonly height: number }): boolean {
  return bounds.width > 0 && bounds.height > 0;
}

function isSourceEffectivelyVisible(source: {
  readonly visibleInSource: boolean;
  readonly effectiveVisibleInSource?: boolean | undefined;
}): boolean {
  return source.effectiveVisibleInSource ?? source.visibleInSource;
}

function clampOpacity(value: number): number {
  if (!Number.isFinite(value)) {
    return 1;
  }

  return Math.max(0, Math.min(1, value));
}
