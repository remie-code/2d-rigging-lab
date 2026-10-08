import type {
  RenderViewSidecar,
  RenderViewSweepLayout,
  RenderViewTextureDimensionSource,
  ResolvedVariantSelectionEntry
} from "@private-2d-rigging-lab/ai-interface";
import { RenderViewSidecarSchema } from "@private-2d-rigging-lab/ai-interface";
import type { ResolvedSoftwareRenderView } from "@private-2d-rigging-lab/render-software";

/**
 * Sidecar builder (Wave104 Domain A, §3.2).
 *
 * Produces the machine-readable JSON companion for a rendered PNG. The sidecar
 * carries: the package path + `packageRevision` (stale-image guard), the
 * resolved parameter overrides, and the resolved view transform (stageViewport /
 * output size / pixelsPerStage — the exact numbers needed to translate image
 * pixels into stage coordinates). Sweep runs additionally carry the cell ↔
 * parameter-value map.
 *
 * All fields are populated deterministically; parameter overrides are sorted by
 * parameterId so identical inputs serialize byte-identically.
 */

export const toResolvedOverrides = (
  overrides: Readonly<Record<string, number>>
): readonly { readonly parameterId: string; readonly value: number }[] =>
  Object.entries(overrides)
    .map(([parameterId, value]) => ({ parameterId, value }))
    .sort((left, right) => left.parameterId.localeCompare(right.parameterId));

export const buildRenderViewSidecar = (input: {
  readonly packagePath: string;
  readonly packageId: string;
  readonly packageRevision: number;
  readonly pngPath: string;
  readonly parameterOverrides: Readonly<Record<string, number>>;
  readonly resolvedView: ResolvedSoftwareRenderView;
  readonly sweep?: RenderViewSweepLayout;
  /**
   * Per-texture dimension-source records (§3.4 revised ladder: declared /
   * derived-verified), sorted by textureId by the resolver.
   */
  readonly textureDimensionSources?: readonly RenderViewTextureDimensionSource[];
  /**
   * The RESOLVED active Variant selection the visibility gate used (Wave105
   * §3.1), one entry per group, sorted by variantGroupId by the resolver. Always
   * passed by the producer (empty array when the package has no Variant Groups)
   * so the sidecar always records which outfit the photo was taken in.
   */
  readonly variantSelections?: readonly ResolvedVariantSelectionEntry[];
}): RenderViewSidecar =>
  RenderViewSidecarSchema.parse({
    schemaVersion: "render-view-sidecar-v1",
    packagePath: input.packagePath,
    packageId: input.packageId,
    packageRevision: input.packageRevision,
    pngPath: input.pngPath,
    parameterOverrides: toResolvedOverrides(input.parameterOverrides),
    resolvedView: {
      stageViewport: {
        minX: input.resolvedView.stageViewport.minX,
        minY: input.resolvedView.stageViewport.minY,
        width: input.resolvedView.stageViewport.width,
        height: input.resolvedView.stageViewport.height
      },
      outputWidth: input.resolvedView.outputWidth,
      outputHeight: input.resolvedView.outputHeight,
      pixelsPerStageX: input.resolvedView.pixelsPerStageX,
      pixelsPerStageY: input.resolvedView.pixelsPerStageY
    },
    ...(input.sweep === undefined ? {} : { sweep: input.sweep }),
    ...(input.textureDimensionSources === undefined
      ? {}
      : { textureDimensionSources: input.textureDimensionSources }),
    ...(input.variantSelections === undefined
      ? {}
      : { variantSelections: input.variantSelections })
  });

/**
 * Serialize a sidecar to stable JSON. Key order is fixed by the object literal
 * shape above (which mirrors the schema), so the serialized bytes are stable for
 * identical inputs.
 */
export const serializeRenderViewSidecar = (sidecar: RenderViewSidecar): string =>
  `${JSON.stringify(sidecar, null, 2)}\n`;
