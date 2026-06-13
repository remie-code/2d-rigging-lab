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
    const key = `${target.drawable.drawableId}:${presetId}`;
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
    setAutoPreviewKey(`${target.drawable.drawableId}:${nextPresetId}`);
    previewMeshDraft(target.drawable.drawableId, nextPresetId);
    setMeshOverlayVisible(true);
  };
  const alphaBounds = currentDraft?.alphaBounds;
  const fallbackReason = currentDraft?.fallbackReason;
  const fallbackSummary = formatFallbackSummary(currentDraft?.fallbackSteps, fallbackReason);
  const qualityMetrics = currentDraft?.qualityMetrics;

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
            onClick={() => previewPreset(presetId)}
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

function formatMeshSource(source: string | undefined): string {
  switch (source) {
    case "outline-v2-6-soft-apron-rgba":
      return "Auto outline v2.6 soft apron";
    case "outline-v2-5-soft-boundary-rgba":
      return "Auto outline v2.5 soft boundary";
    case "outline-v2-rgba":
      return "Auto outline v2";
    case "outline-rgba":
      return "Auto outline";
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
      .map((step) => `${step.method}: ${formatFallbackReason(step.reason)}`)
      .join(" > ");
  }

  return fallbackReason === undefined ? undefined : formatFallbackReason(fallbackReason);
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
    default:
      return reason;
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
