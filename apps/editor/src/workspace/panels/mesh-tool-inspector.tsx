import {
  Check,
  Eye,
  EyeOff,
  RefreshCw,
  Triangle,
  X
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { getPartOrderedChildren } from "@private-2d-rigging-lab/authoring-core";
import type { AuthoringSession } from "@private-2d-rigging-lab/authoring-core";
import type { DrawableId, PartId, RectDto } from "@private-2d-rigging-lab/contracts";

import { useEditorSession } from "../../features/editor-session/editor-session-context";
import {
  getMeshGenerationPreset,
  MESH_GENERATION_PRESETS,
  type MeshGenerationPresetId
} from "../../features/editor-session/model/mesh-tool-state";
import type { EditorSelection } from "../../features/editor-session/model/editor-selection";
import { cn } from "../../lib/class-name";
import { useEditorUiStore } from "../../state/editor-ui-store";

type DrawableDto = AuthoringSession["graph"]["drawables"][number];
type MeshDto = AuthoringSession["graph"]["meshes"][number];
type ModelPartDto = AuthoringSession["graph"]["parts"][number];

export function MeshToolInspector() {
  const {
    applyMeshDraft,
    cancelMeshDraft,
    editorHiddenPartIds,
    meshDraft,
    previewMeshDraft,
    selectDrawable,
    selection,
    session
  } = useEditorSession();
  const meshOverlayVisible = useEditorUiStore((state) => state.meshOverlayVisible);
  const setMeshOverlayVisible = useEditorUiStore((state) => state.setMeshOverlayVisible);
  const [presetId, setPresetId] = useState<MeshGenerationPresetId>("standard");
  const [autoPreviewKey, setAutoPreviewKey] = useState<string | undefined>(undefined);
  const target = useMemo(
    () => resolveMeshToolTarget(session, selection, editorHiddenPartIds),
    [editorHiddenPartIds, selection, session]
  );
  const targetDrawableId = target.kind === "drawable" ? target.drawable.drawableId : undefined;

  useEffect(() => {
    setMeshOverlayVisible(true);
  }, [setMeshOverlayVisible]);

  useEffect(() => {
    return () => {
      cancelMeshDraft();
    };
  }, [cancelMeshDraft, targetDrawableId]);

  useEffect(() => {
    if (target.kind !== "drawable") {
      return;
    }

    const meshEmpty = target.mesh === undefined || target.mesh.vertices.length === 0 || target.mesh.triangles.length === 0;
    const key = createPreviewKey(target.drawable.drawableId, presetId);
    if (!meshEmpty || autoPreviewKey === key) {
      return;
    }

    setAutoPreviewKey(key);
    previewMeshDraft(target.drawable.drawableId, presetId);
    setMeshOverlayVisible(true);
  }, [autoPreviewKey, presetId, previewMeshDraft, setMeshOverlayVisible, target]);

  if (target.kind === "part") {
    return (
      <>
        <MeshToolHeader title="Mesh" />
        <section
          className="rounded-md border border-neutral-800 bg-neutral-950/40 p-3"
          data-testid="mesh-tool-drawable-picker"
        >
          <h3 className="text-xs font-semibold uppercase text-neutral-500">Drawable</h3>
          <div className="mt-3 flex flex-col gap-2">
            {target.drawables.length === 0 ? (
              <p className="text-xs text-neutral-400">No Drawable in this container</p>
            ) : (
              target.drawables.map((candidate) => (
                <button
                  className="flex min-h-9 items-center justify-between gap-3 rounded border border-neutral-800 bg-neutral-950 px-2 text-left text-xs text-neutral-200 transition hover:border-teal-700 hover:bg-teal-950/20"
                  key={candidate.drawable.drawableId}
                  onClick={() => selectDrawable(candidate.drawable.drawableId)}
                  type="button"
                >
                  <span className="min-w-0 truncate">{candidate.drawable.displayName}</span>
                  <span className="shrink-0 text-[11px] text-neutral-500">
                    {formatMeshStatus(candidate.mesh)} / {candidate.effectiveVisible ? "Visible" : "Hidden"}
                  </span>
                </button>
              ))
            )}
          </div>
        </section>
      </>
    );
  }

  if (target.kind !== "drawable") {
    return (
      <>
        <MeshToolHeader title="Mesh" />
        <section
          className="rounded-md border border-neutral-800 bg-neutral-950/40 p-3"
          data-testid="mesh-tool-empty-state"
        >
          <h3 className="text-xs font-semibold uppercase text-neutral-500">Target</h3>
          <p className="mt-3 text-xs font-medium text-neutral-300">Select a Drawable</p>
        </section>
      </>
    );
  }

  const currentDraft = meshDraft?.drawableId === target.drawable.drawableId ? meshDraft : null;
  const meshStatus = resolveWorkflowStatus(target.mesh, currentDraft !== null);
  const summaryMesh = currentDraft?.mesh ?? target.mesh;
  const preset = getMeshGenerationPreset(presetId);
  const previewPreset = (nextPresetId: MeshGenerationPresetId) => {
    setPresetId(nextPresetId);
    setAutoPreviewKey(createPreviewKey(target.drawable.drawableId, nextPresetId));
    previewMeshDraft(target.drawable.drawableId, nextPresetId);
    setMeshOverlayVisible(true);
  };
  const alphaBounds = currentDraft?.alphaBounds;
  const fallbackReason = currentDraft?.fallbackReason;
  const fallbackSummary = formatFallbackSummary(currentDraft?.fallbackSteps, fallbackReason);
  const qualityMetrics = currentDraft?.qualityMetrics;
  const v6Metrics = qualityMetrics?.v6Metrics;
  const constrainautorDiagnostics = v6Metrics?.constrainautorDiagnostics;
  const supportRingDiagnostics = v6Metrics?.supportRingDiagnostics;
  const adaptiveStaggeredBandDiagnostics = v6Metrics?.adaptiveStaggeredBandDiagnostics;
  const poly2triDiagnostics = v6Metrics?.poly2triDiagnostics;
  const customCdtDiagnostics = v6Metrics?.customCdtDiagnostics;

  return (
    <>
      <MeshToolHeader title="Mesh" />
      <section
        className="rounded-md border border-neutral-800 bg-neutral-950/40 p-3"
        data-testid="mesh-tool-inspector"
      >
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-xs font-semibold uppercase text-neutral-500">Target</h3>
          <span
            className={cn(
              "rounded border px-2 py-0.5 text-[11px] font-medium",
              target.effectiveVisible
                ? "border-teal-800/70 bg-teal-950/20 text-teal-100"
                : "border-neutral-700 bg-neutral-900 text-neutral-300"
            )}
          >
            {target.effectiveVisible ? "Visible" : "Hidden"}
          </span>
        </div>
        <div className="mt-2 divide-y divide-neutral-800">
          <SummaryRow label="Drawable" value={target.drawable.displayName} />
          <SummaryRow label="Status" testId="mesh-tool-status" value={meshStatus} />
          <SummaryRow label="Preset" value={preset.label} />
          <SummaryRow label="Vertices" testId="mesh-tool-vertex-count" value={String(summaryMesh?.vertices.length ?? 0)} />
          <SummaryRow label="Triangles" testId="mesh-tool-triangle-count" value={String(summaryMesh?.triangles.length ?? 0)} />
          <SummaryRow label="Source" testId="mesh-tool-source" value={formatMeshSource(currentDraft?.source)} />
          {fallbackSummary === undefined ? null : (
            <SummaryRow label="Fallback" value={fallbackSummary} />
          )}
          {alphaBounds === undefined ? null : (
            <SummaryRow label="Alpha bounds" value={formatRect(alphaBounds)} />
          )}
          {qualityMetrics === undefined ? null : (
            <>
              <SummaryRow label="Max edge" value={formatNumber(qualityMetrics.maxEdgeLength)} />
              <SummaryRow label="Max area" value={formatNumber(qualityMetrics.maxTriangleArea)} />
              <SummaryRow label="Min angle" value={`${formatNumber(qualityMetrics.minAngleDegrees)} deg`} />
              <SummaryRow label="Max valence" value={String(qualityMetrics.maxVertexValence)} />
              <SummaryRow label="Refinement" value={String(qualityMetrics.refinementIterationCount)} />
            </>
          )}
          {v6Metrics === undefined ? null : (
            <>
              <SummaryRow
                label="Generation result"
                testId="mesh-tool-v6-output-kind"
                value={`${formatV6Backend(v6Metrics.backendId)} / ${formatV6OutputKind(v6Metrics.outputKind)}`}
              />
              <SummaryRow
                label="Contour counts"
                value={`B ${v6Metrics.boundaryVertexCount} / I ${v6Metrics.interiorVertexCount}`}
              />
              <SummaryRow label="Fallback steps" value={String(v6Metrics.fallbackSteps.length)} />
              <SummaryRow
                label="Contour regions"
                value={`Loops ${v6Metrics.contourLoopCount} / Holes ${v6Metrics.holeLikeRegionCount}`}
              />
              <SummaryRow
                label="Filtered triangles"
                value={`Removed ${v6Metrics.removedTriangleCount} / Outside ${v6Metrics.outsideOrCrossingTriangleCount}`}
              />
            </>
          )}
          {supportRingDiagnostics === undefined ? null : (
            <>
              <SummaryRow
                label="Support rings"
                value={`Outer ${supportRingDiagnostics.outerRingPointCount} / Inner ${supportRingDiagnostics.innerRingPointCount}`}
              />
              <SummaryRow
                label="Support band"
                value={`Band ${supportRingDiagnostics.supportBandTriangleCount} / Interior ${supportRingDiagnostics.interiorTriangleCount}`}
              />
            </>
          )}
          {adaptiveStaggeredBandDiagnostics === undefined ? null : (
            <>
              <SummaryRow
                label="Adaptive density"
                value={`B ${formatNumber(adaptiveStaggeredBandDiagnostics.resolvedBoundarySpacing)} / I ${formatNumber(adaptiveStaggeredBandDiagnostics.resolvedInteriorSpacing)}`}
              />
              <SummaryRow
                label="Staggered strip"
                value={`Strip ${adaptiveStaggeredBandDiagnostics.explicitAlphaInnerStripTriangleCount} / Direct ${adaptiveStaggeredBandDiagnostics.directAlphaToInteriorEdgeCount}`}
              />
            </>
          )}
          {constrainautorDiagnostics === undefined ? null : (
            <>
              <SummaryRow
                label="Constraint quality"
                value={`${constrainautorDiagnostics.preservedConstraintEdgeCount}/${constrainautorDiagnostics.constraintEdgeCount} kept`}
              />
              <SummaryRow
                label="Missing constraints"
                value={String(constrainautorDiagnostics.missingConstraintEdgeCount)}
              />
            </>
          )}
          {poly2triDiagnostics === undefined ? null : (
            <>
              <SummaryRow
                label="Polygon points"
                value={`Outer ${poly2triDiagnostics.outerPointCount} / Steiner ${poly2triDiagnostics.steinerPointCount}`}
              />
              <SummaryRow
                label="Boundary quality"
                value={`${poly2triDiagnostics.boundaryEdgePreservedCount} kept / ${poly2triDiagnostics.boundaryEdgeMissingCount} missing`}
              />
            </>
          )}
          {customCdtDiagnostics === undefined ? null : (
            <>
              <SummaryRow
                label="Constraint quality"
                value={`${customCdtDiagnostics.preservedConstraintEdgeCount}/${customCdtDiagnostics.constraintEdgeCount} kept`}
              />
              <SummaryRow
                label="Mesh refinement"
                value={`Flips ${customCdtDiagnostics.edgeFlipCount} / Spokes ${customCdtDiagnostics.longSpokeCandidateCount}`}
              />
            </>
          )}
        </div>
      </section>

      <section className="rounded-md border border-neutral-800 bg-neutral-950/40 p-3">
        <h3 className="text-xs font-semibold uppercase text-neutral-500">Preset</h3>
        <div className="mt-3 grid gap-2">
          {MESH_GENERATION_PRESETS.map((candidate) => (
            <button
              aria-label={`Preview ${candidate.label} mesh`}
              className={cn(
                "flex min-h-9 items-center justify-between gap-3 rounded border px-2 text-left text-xs transition",
                presetId === candidate.id
                  ? "border-amber-500/70 bg-amber-950/20 text-amber-100"
                  : "border-neutral-800 bg-neutral-950 text-neutral-200 hover:border-neutral-700"
              )}
              key={candidate.id}
              onClick={() => previewPreset(candidate.id)}
              type="button"
            >
              <span className="font-medium">{candidate.label}</span>
              <span className="text-[11px] text-neutral-500">{candidate.summary}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-md border border-neutral-800 bg-neutral-950/40 p-3">
        <h3 className="text-xs font-semibold uppercase text-neutral-500">Actions</h3>
        <div className="mt-3 flex flex-col gap-2">
          <button
            className="flex min-h-8 items-center justify-between rounded border border-neutral-800 bg-neutral-950 px-2 text-xs font-medium text-neutral-200 transition hover:border-teal-700 hover:bg-teal-950/20"
            onClick={() => setMeshOverlayVisible(!meshOverlayVisible)}
            type="button"
          >
            <span className="flex items-center gap-2">
              {meshOverlayVisible ? (
                <Eye aria-hidden="true" size={14} strokeWidth={1.8} />
              ) : (
                <EyeOff aria-hidden="true" size={14} strokeWidth={1.8} />
              )}
              Show mesh overlay
            </span>
            <span>{meshOverlayVisible ? "On" : "Off"}</span>
          </button>
          <button
            className="flex min-h-8 items-center justify-center gap-2 rounded border border-amber-600/70 bg-amber-950/25 px-2 text-xs font-semibold text-amber-100 transition hover:bg-amber-900/30"
            onClick={() => {
              setAutoPreviewKey(createPreviewKey(target.drawable.drawableId, presetId));
              previewMeshDraft(target.drawable.drawableId, presetId);
              setMeshOverlayVisible(true);
            }}
            type="button"
          >
            <RefreshCw aria-hidden="true" size={14} strokeWidth={1.8} />
            {target.mesh !== undefined && target.mesh.triangles.length > 0 ? "Regenerate mesh" : "Generate preview"}
          </button>
          <div className="grid grid-cols-2 gap-2">
            <button
              className="flex min-h-8 items-center justify-center gap-2 rounded border border-teal-600/70 bg-teal-950/30 px-2 text-xs font-semibold text-teal-100 transition enabled:hover:bg-teal-900/30 disabled:cursor-not-allowed disabled:border-neutral-800 disabled:bg-neutral-950 disabled:text-neutral-600"
              disabled={currentDraft === null}
              onClick={applyMeshDraft}
              type="button"
            >
              <Check aria-hidden="true" size={14} strokeWidth={1.8} />
              Apply mesh
            </button>
            <button
              className="flex min-h-8 items-center justify-center gap-2 rounded border border-neutral-800 bg-neutral-950 px-2 text-xs font-semibold text-neutral-200 transition enabled:hover:border-neutral-700 disabled:cursor-not-allowed disabled:text-neutral-600"
              disabled={currentDraft === null}
              onClick={cancelMeshDraft}
              type="button"
            >
              <X aria-hidden="true" size={14} strokeWidth={1.8} />
              Cancel
            </button>
          </div>
        </div>
      </section>
    </>
  );
}

type MeshToolTarget =
  | { readonly kind: "none" }
  | {
      readonly kind: "part";
      readonly part: ModelPartDto;
      readonly drawables: readonly DrawableCandidate[];
    }
  | DrawableCandidate & { readonly kind: "drawable" };

interface DrawableCandidate {
  readonly drawable: DrawableDto;
  readonly mesh: MeshDto | undefined;
  readonly effectiveVisible: boolean;
}

function resolveMeshToolTarget(
  session: AuthoringSession,
  selection: EditorSelection | null,
  editorHiddenPartIds: ReadonlySet<PartId>
): MeshToolTarget {
  const drawablesById = new Map(session.graph.drawables.map((drawable) => [drawable.drawableId, drawable]));
  const meshesById = new Map(session.graph.meshes.map((mesh) => [mesh.meshId, mesh]));
  const partsById = new Map(session.graph.parts.map((part) => [part.partId, part]));

  if (selection?.kind === "drawable") {
    const drawable = drawablesById.get(selection.id);
    if (drawable === undefined) {
      return { kind: "none" };
    }

    return {
      kind: "drawable",
      drawable,
      mesh: meshesById.get(drawable.meshId),
      effectiveVisible: isDrawableEffectivelyVisible(drawable, partsById, editorHiddenPartIds)
    };
  }

  if (selection?.kind === "part") {
    const part = partsById.get(selection.id);
    if (part === undefined) {
      return { kind: "none" };
    }

    return {
      kind: "part",
      part,
      drawables: collectDrawableCandidates({
        session,
        partId: part.partId,
        partsById,
        drawablesById,
        meshesById,
        editorHiddenPartIds
      })
    };
  }

  return { kind: "none" };
}

function collectDrawableCandidates(input: {
  readonly session: AuthoringSession;
  readonly partId: PartId;
  readonly partsById: ReadonlyMap<PartId, ModelPartDto>;
  readonly drawablesById: ReadonlyMap<DrawableId, DrawableDto>;
  readonly meshesById: ReadonlyMap<string, MeshDto>;
  readonly editorHiddenPartIds: ReadonlySet<PartId>;
}): readonly DrawableCandidate[] {
  const part = input.partsById.get(input.partId);
  if (part === undefined) {
    return [];
  }

  const result: DrawableCandidate[] = [];
  for (const child of getPartOrderedChildren(input.session.graph, part)) {
    if (child.kind === "part") {
      result.push(
        ...collectDrawableCandidates({
          ...input,
          partId: child.partId
        })
      );
      continue;
    }

    const drawable = input.drawablesById.get(child.drawableId);
    if (drawable === undefined) {
      continue;
    }

    result.push({
      drawable,
      mesh: input.meshesById.get(drawable.meshId),
      effectiveVisible: isDrawableEffectivelyVisible(
        drawable,
        input.partsById,
        input.editorHiddenPartIds
      )
    });
  }

  return result;
}

function isDrawableEffectivelyVisible(
  drawable: DrawableDto,
  partsById: ReadonlyMap<PartId, ModelPartDto>,
  editorHiddenPartIds: ReadonlySet<PartId>
): boolean {
  if (!drawable.runtimeVisibility || editorHiddenPartIds.has(drawable.partId)) {
    return false;
  }

  let current = partsById.get(drawable.partId);
  while (current?.parentPartId !== undefined) {
    if (editorHiddenPartIds.has(current.parentPartId)) {
      return false;
    }
    current = partsById.get(current.parentPartId);
  }

  return true;
}

function resolveWorkflowStatus(mesh: MeshDto | undefined, hasDraft: boolean): string {
  if (hasDraft) {
    return mesh !== undefined && mesh.triangles.length > 0 ? "Replacement draft" : "Draft preview";
  }

  return formatMeshStatus(mesh);
}

function formatMeshStatus(mesh: MeshDto | undefined): string {
  if (mesh === undefined) {
    return "Missing mesh";
  }

  if (mesh.vertices.length === 0 || mesh.triangles.length === 0) {
    return "Empty scaffold";
  }

  return "Generated";
}

function formatRect(rect: RectDto): string {
  return `${formatNumber(rect.x)}, ${formatNumber(rect.y)}, ${formatNumber(rect.width)} x ${formatNumber(rect.height)}`;
}

function createPreviewKey(
  drawableId: DrawableId,
  presetId: MeshGenerationPresetId
): string {
  return `${drawableId}:${presetId}`;
}

function formatMeshSource(source: string | undefined): string {
  switch (source) {
    case "outline-v6a-local-rgba":
    case "outline-v6b-constrainautor-rgba":
    case "outline-v6c-poly2tri-rgba":
    case "outline-v6d-contour-constrainautor-rgba":
    case "outline-v6e-contour-poly2tri-rgba":
    case "outline-v6f-contour-custom-cdt-rgba":
      return "Legacy contour mesh";
    case "outline-v6d-contour-band-support-rings-rgba":
      return "Contour support mesh";
    case "outline-v6d-adaptive-staggered-band-rgba":
    case "outline-v6d-adaptive-contour-constrainautor-rgba":
      return "Adaptive contour mesh";
    case "outline-v4-contour-band-rgba":
      return "Contour band mesh";
    case "outline-v2-6-soft-apron-rgba":
      return "Soft apron mesh";
    case "outline-v2-5-soft-boundary-rgba":
      return "Soft boundary mesh";
    case "outline-v2-rgba":
      return "Outline mesh";
    case "outline-rgba":
      return "Outline mesh";
    case "alpha-aware-rgba":
      return "Alpha-aware grid";
    case "bounds-grid":
    case undefined:
      return "Bounds grid";
    default:
      return source;
  }
}

function formatFallbackSummary(
  steps: readonly { readonly method: string; readonly reason: string }[] | undefined,
  fallbackReason: string | undefined
): string | undefined {
  if (steps !== undefined && steps.length > 0) {
    return steps
      .map((step) => `${formatFallbackMethod(step.method)}: ${formatFallbackReason(step.reason)}`)
      .join(" > ");
  }

  return fallbackReason === undefined ? undefined : formatFallbackReason(fallbackReason);
}

function formatFallbackMethod(method: string): string {
  switch (method) {
    case "auto-outline-v6a-local":
    case "auto-outline-v6b-constrainautor":
    case "auto-outline-v6c-poly2tri":
    case "auto-outline-v6d-contour-constrainautor":
    case "auto-outline-v6e-contour-poly2tri":
    case "auto-outline-v6f-contour-custom-cdt":
      return "Legacy contour mesh";
    case "auto-outline-v6d-contour-band-support-rings":
      return "Contour support mesh";
    case "auto-outline-v6d-adaptive-staggered-band":
    case "auto-outline-v6d-adaptive-contour-constrainautor":
      return "Adaptive contour mesh";
    case "auto-outline-v4-contour-band":
      return "Contour band mesh";
    case "auto-outline-v3-envelope":
      return "Envelope mesh";
    case "auto-outline-v2.6-soft-apron":
      return "Soft apron mesh";
    case "auto-outline-v2.5-soft-boundary":
      return "Soft boundary mesh";
    case "auto-outline-v2":
      return "Outline mesh";
    case "auto-outline-v1":
      return "Outline mesh";
    default:
      return method;
  }
}

function formatFallbackReason(reason: string): string {
  switch (reason) {
    case "texture-bytes-unavailable":
      return "Texture bytes unavailable";
    case "invalid-rgba":
      return "Invalid texture bytes";
    case "alpha-empty":
      return "Alpha mask empty";
    case "contour-extraction-failed":
      return "Outline extraction failed";
    case "triangulation-failed":
      return "Triangulation failed";
    case "v6-backend-not-implemented":
      return "Contour backend not available";
    case "v6a-local-generation-failed":
      return "Contour mesh generation failed";
    case "v6b-constrainautor-generation-failed":
      return "Contour mesh generation failed";
    case "v6b-invalid-constraints":
      return "Contour constraints invalid";
    case "v6b-constraint-recovery-failed":
      return "Contour constraints failed";
    case "v6b-backend-threw":
      return "Contour backend failed";
    case "v6b-unsupported-hole-region":
      return "Unsupported contour hole";
    case "v6c-poly2tri-generation-failed":
      return "Contour mesh generation failed";
    case "v6c-poly2tri-polygon-invalid":
      return "Contour polygon invalid";
    case "v6c-poly2tri-hole-unsupported":
      return "Unsupported contour hole";
    case "v6c-poly2tri-multi-island-unsupported":
      return "Unsupported multi-island contour";
    case "v6c-poly2tri-triangulation-threw":
      return "Contour triangulation failed";
    case "v6c-poly2tri-boundary-missing":
      return "Contour boundary missing";
    case "v6d-constrainautor-generation-failed":
      return "Contour mesh generation failed";
    case "v6d-constraint-recovery-failed":
      return "Contour constraints failed";
    case "v6d-backend-threw":
      return "Contour backend failed";
    case "v6d-support-ring-geometry-invalid":
      return "Support ring geometry invalid";
    case "v6d-support-ring-constraint-recovery-failed":
      return "Support ring constraints failed";
    case "v6d-adaptive-staggered-band-geometry-invalid":
      return "Adaptive strip geometry invalid";
    case "v6d-adaptive-staggered-band-constraint-recovery-failed":
      return "Adaptive strip constraints failed";
    case "v6e-poly2tri-generation-failed":
      return "Contour mesh generation failed";
    case "v6e-poly2tri-polygon-invalid":
      return "Contour polygon invalid";
    case "v6e-poly2tri-triangulation-threw":
      return "Contour triangulation failed";
    case "v6f-custom-cdt-generation-failed":
      return "Contour mesh generation failed";
    case "v6f-custom-cdt-constraint-recovery-failed":
      return "Contour constraints failed";
    case "v6f-custom-cdt-local-improvement-rejected":
      return "Contour refinement rejected";
    default:
      return reason;
  }
}

function formatV6Backend(backendId: string): string {
  switch (backendId) {
    case "v6a-local":
    case "v6b-constrainautor":
    case "v6c-poly2tri":
    case "v6d-contour-constrainautor":
    case "v6e-contour-poly2tri":
    case "v6f-contour-custom-cdt":
      return "Legacy contour mesh";
    case "v6d-contour-band-support-rings":
      return "Contour support mesh";
    case "v6d-adaptive-staggered-band":
    case "v6d-adaptive-contour-constrainautor":
      return "Adaptive contour mesh";
    default:
      return backendId;
  }
}

function formatV6OutputKind(outputKind: string): string {
  switch (outputKind) {
    case "backend-output":
      return "Generated";
    case "fallback-output":
      return "Fallback";
    case "blocked":
      return "Blocked";
    default:
      return outputKind;
  }
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function MeshToolHeader({ title }: { readonly title: string }) {
  return (
    <div className="rounded-md border border-neutral-800 bg-neutral-950/50 p-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-neutral-100">
        <Triangle aria-hidden="true" size={16} strokeWidth={1.8} />
        <span className="min-w-0 truncate">{title}</span>
      </div>
    </div>
  );
}

function SummaryRow({
  label,
  testId,
  value
}: {
  readonly label: string;
  readonly testId?: string;
  readonly value: string;
}) {
  return (
    <div className="flex min-h-8 items-center justify-between gap-3 py-1.5">
      <span className="text-xs text-neutral-500">{label}</span>
      <span
        className="truncate text-xs font-medium text-neutral-200"
        data-testid={testId}
      >
        {value}
      </span>
    </div>
  );
}
