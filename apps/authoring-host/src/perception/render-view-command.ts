import { createRenderScene } from "@private-2d-rigging-lab/render-core";
import type { AuthoringSession } from "@private-2d-rigging-lab/authoring-core";
import type {
  RenderViewPayload,
  RenderViewSidecar,
  RenderViewSweepCell,
  RenderViewSweepLayout
} from "@private-2d-rigging-lab/ai-interface";
import {
  renderSceneToPng,
  resolveSoftwareRenderView
} from "@private-2d-rigging-lab/render-software";

import { composeContactSheet } from "./contact-sheet.js";
import { evaluatePerceptionSnapshot } from "./evaluation-adapter.js";
import { computeSweptParameterValues } from "./parameter-sweep.js";
import { createReferenceImageForeground, type PerceptionReferenceImage } from "./reference-image-foreground.js";
import { createPerceptionRenderScene } from "./render-scene-adapter.js";
import { buildRenderViewSidecar } from "./render-view-sidecar.js";
import { resolveTextureDimensionSources } from "./texture-resolution.js";
import { resolveVariantSelections } from "./variant-selection-resolution.js";
import { resolvePerceptionRenderView } from "./view-resolution.js";

/**
 * renderView orchestration (Wave104 Domain A).
 *
 * Runs the full perception pipeline on a live session for a single request and
 * produces the in-memory artifacts (PNG bytes + sidecar). It does NOT touch the
 * filesystem — the CLI wrapper owns file output — so this module stays unit
 * testable and deterministic.
 *
 * For a sweep request, N poses are evaluated (one per swept parameter value),
 * each rendered with the SAME resolved view (framed from the base pose), and
 * composited into one contact-sheet PNG. Cell ↔ parameter-value mappings are
 * recorded for the sidecar.
 */

export interface RenderViewArtifacts {
  readonly png: Uint8Array;
  readonly outputWidth: number;
  readonly outputHeight: number;
  readonly packageRevision: number;
  readonly packageId: string;
  readonly sidecar: (input: {
    readonly packagePath: string;
    readonly pngPath: string;
  }) => RenderViewSidecar;
}

export const renderPerceptionView = (input: {
  readonly session: AuthoringSession;
  readonly payload: RenderViewPayload;
  readonly referenceImage?: PerceptionReferenceImage;
}): RenderViewArtifacts => {
  const { session, payload } = input;
  const referenceMode = payload.referenceMode ?? input.referenceImage?.state.displayMode ?? "model";
  const referenceImage = referenceMode === "model" ? undefined : input.referenceImage;
  if (referenceMode !== "model" && referenceImage === undefined) {
    throw new Error(`Render mode "${referenceMode}" requires a registered reference PNG.`);
  }
  const foreground = referenceImage === undefined ? undefined : createReferenceImageForeground(referenceImage);
  const emptyScene = createRenderScene({ drawables: [], textureSources: [] });
  const sceneFor = (evaluation: ReturnType<typeof evaluatePerceptionSnapshot>) =>
    referenceMode === "reference" ? emptyScene : createPerceptionRenderScene({
      session,
      graph: evaluation.graph,
      snapshot: evaluation.snapshot
    });
  const referenceEvidence = {
    referenceMode,
    ...(referenceImage === undefined ? {} : { referenceImage: referenceImage.state })
  };
  const packageRevision = session.packageRevision;
  const packageId = session.packageIdentity.packageId;

  // Resolve + validate the requested Variant selection ONCE (Wave105 §3.1).
  // Unknown group / variant references and mode mismatches reject here
  // deterministically. The resolved authoring-core form gates every snapshot;
  // the resolved echo is recorded in the sidecar.
  const variant = resolveVariantSelections({
    variantGroups: session.graph.variantGroups,
    variantSelections: payload.variantSelections
  });

  // Base pose evaluation: frames the view (even for a sweep, the framing is
  // computed once from the base overrides so cells share a stable viewport).
  const base = evaluatePerceptionSnapshot(session, {
    parameterOverrides: payload.parameterOverrides,
    variantSelections: variant.activeSelections
  });
  const view = resolvePerceptionRenderView({
    snapshot: base.snapshot,
    ...(payload.view === undefined ? {} : { view: payload.view }),
    ...(payload.outputWidth === undefined ? {} : { outputWidth: payload.outputWidth }),
    ...(payload.outputHeight === undefined ? {} : { outputHeight: payload.outputHeight })
  });
  const resolvedView = resolveSoftwareRenderView(view);

  // §3.4 dimension-source records for every texture the scene will use
  // (declared / derived-verified). Runs the exact resolution ladder the scene
  // adapter uses, so an unresolvable texture rejects here with the same
  // deterministic TextureResolutionError instead of rendering silently.
  const textureDimensionSources = referenceMode === "reference" ? [] : resolveTextureDimensionSources({
    session,
    textureIds: collectSnapshotTextureIds(session, base.snapshot)
  });

  if (payload.sweep === undefined) {
    const { png } = renderSceneToPng(sceneFor(base), view, foreground);

    return {
      png,
      outputWidth: resolvedView.outputWidth,
      outputHeight: resolvedView.outputHeight,
      packageRevision,
      packageId,
      sidecar: ({ packagePath, pngPath }) =>
        buildRenderViewSidecar({
          packagePath,
          packageId,
          packageRevision,
          pngPath,
          parameterOverrides: payload.parameterOverrides,
          resolvedView,
          ...referenceEvidence,
          textureDimensionSources,
          variantSelections: variant.resolved
        })
    };
  }

  // Sweep: evaluate + render one cell per swept value, then composite.
  const sweep = payload.sweep;
  const sweptValues = computeSweptParameterValues({
    graph: base.graph,
    parameterId: sweep.parameterId,
    steps: sweep.steps
  });

  const cells = sweptValues.map((swept) => {
    const evaluated = evaluatePerceptionSnapshot(session, {
      parameterOverrides: {
        ...payload.parameterOverrides,
        [sweep.parameterId]: swept.value
      },
      variantSelections: variant.activeSelections
    });
    const { render } = renderSceneToPng(sceneFor(evaluated), view, foreground);
    return { rgba8: render.straightRgba8 };
  });

  const contactSheet = composeContactSheet({
    cells,
    cellWidth: resolvedView.outputWidth,
    cellHeight: resolvedView.outputHeight
  });

  const sweepCells: RenderViewSweepCell[] = sweptValues.map((swept) => ({
    cellIndex: swept.index,
    column: swept.index % contactSheet.layout.columns,
    row: Math.floor(swept.index / contactSheet.layout.columns),
    parameterId: sweep.parameterId,
    parameterValue: swept.value
  }));

  const sweepLayout: RenderViewSweepLayout = {
    parameterId: sweep.parameterId,
    steps: sweep.steps,
    columns: contactSheet.layout.columns,
    rows: contactSheet.layout.rows,
    cellWidth: contactSheet.layout.cellWidth,
    cellHeight: contactSheet.layout.cellHeight,
    cells: sweepCells
  };

  return {
    png: contactSheet.png,
    outputWidth: contactSheet.layout.sheetWidth,
    outputHeight: contactSheet.layout.sheetHeight,
    packageRevision,
    packageId,
    sidecar: ({ packagePath, pngPath }) =>
      buildRenderViewSidecar({
        packagePath,
        packageId,
        packageRevision,
        pngPath,
        parameterOverrides: payload.parameterOverrides,
        resolvedView,
        ...referenceEvidence,
        sweep: sweepLayout,
        textureDimensionSources,
        variantSelections: variant.resolved
      })
  };
};

/**
 * The distinct textureIds the render scene will use: the authoring-graph
 * texture of every evaluated snapshot drawable (mirrors the scene adapter's
 * collection; missing mappings are left for the adapter to reject).
 */
const collectSnapshotTextureIds = (
  session: AuthoringSession,
  snapshot: ReturnType<typeof evaluatePerceptionSnapshot>["snapshot"]
): readonly string[] => {
  const textureIdByDrawableId = new Map(
    session.graph.drawables.map((drawable) => [drawable.drawableId, drawable.textureId])
  );
  const textureIds = new Set<string>();
  for (const drawable of snapshot.drawables) {
    const textureId = textureIdByDrawableId.get(drawable.drawableId);
    if (textureId !== undefined) {
      textureIds.add(textureId);
    }
  }
  return [...textureIds];
};
