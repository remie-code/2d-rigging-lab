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
import type { DrawableId, PartId } from "@private-2d-rigging-lab/contracts";

import { useEditorSession } from "../../features/editor-session/editor-session-context";
import {
  createMeshDrawableBatchTargets,
  getMeshGenerationPreset,
  MESH_GENERATION_PRESETS,
  type MeshDrawableBatchTarget,
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
    meshDrafts,
    previewMeshDraft,
    previewMeshDrafts,
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
  const targetDrawableIds = useMemo(() => getMeshToolTargetDrawableIds(target), [target]);
  const targetKey = targetDrawableIds.join("|");
  const targetDrawableIdSet = useMemo(() => new Set(targetDrawableIds), [targetDrawableIds]);
  const draftsForTarget = meshDrafts.filter((draft) => targetDrawableIdSet.has(draft.drawableId));
  const currentDraft = target.kind === "drawable"
    ? draftsForTarget.find((draft) => draft.drawableId === target.drawable.drawableId) ?? null
    : null;
  const batchTargets = useMemo(
    () => createMeshDrawableBatchTargets(session, targetDrawableIds),
    [session, targetDrawableIds]
  );
  const eligibleBatchTargets = batchTargets.filter((candidate) => candidate.eligible);
  const excludedBatchTargets = target.kind === "drawableSet"
    ? batchTargets.filter((candidate) => !candidate.eligible)
    : [];
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    setMeshOverlayVisible(true);
  }, [setMeshOverlayVisible]);

  useEffect(() => {
    return () => {
      cancelMeshDraft();
    };
  }, [cancelMeshDraft, targetKey]);

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

  if (target.kind !== "drawable" && target.kind !== "drawableSet") {
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

  const workflowStatus = target.kind === "drawableSet"
    ? formatBatchWorkflowStatus(eligibleBatchTargets, excludedBatchTargets, draftsForTarget)
    : resolveWorkflowStatus(target.mesh, currentDraft !== null);
  const preset = getMeshGenerationPreset(presetId);
  const generatePreview = (nextPresetId: MeshGenerationPresetId) => {
    if (target.kind === "drawableSet" && eligibleBatchTargets.length === 0) {
      return;
    }

    setIsGenerating(true);
    try {
      if (target.kind === "drawable") {
        previewMeshDraft(target.drawable.drawableId, nextPresetId);
      } else if (target.kind === "drawableSet") {
        previewMeshDrafts(
          eligibleBatchTargets.map((candidate) => candidate.drawableId),
          nextPresetId
        );
      }
      setMeshOverlayVisible(true);
    } finally {
      setIsGenerating(false);
    }
  };
  const previewPreset = (nextPresetId: MeshGenerationPresetId) => {
    setPresetId(nextPresetId);
    if (target.kind === "drawable") {
      setAutoPreviewKey(createPreviewKey(target.drawable.drawableId, nextPresetId));
    }
    generatePreview(nextPresetId);
  };
  const canGeneratePreview = target.kind === "drawable"
    ? !isGenerating
    : !isGenerating && eligibleBatchTargets.length > 0;
  const canApplyPreview = draftsForTarget.length > 0;
  const targetNameItems = target.kind === "drawableSet"
    ? target.drawables.map((candidate) => ({
        drawableId: candidate.drawable.drawableId,
        displayName: candidate.drawable.displayName
      }))
    : [
        {
          drawableId: target.drawable.drawableId,
          displayName: target.drawable.displayName
        }
      ];

  return (
    <>
      <MeshToolHeader title="Mesh" />
      <section
        className="rounded-md border border-neutral-800 bg-neutral-950/40 p-3"
        data-testid="mesh-tool-inspector"
      >
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-xs font-semibold uppercase text-neutral-500">Target</h3>
        </div>
        <ul className="mt-3 flex flex-col gap-1.5">
          {targetNameItems.map((item) => (
            <li
              className="truncate text-xs font-medium text-neutral-200"
              data-testid="mesh-tool-target-name"
              key={item.drawableId}
            >
              {item.displayName}
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-md border border-neutral-800 bg-neutral-950/40 p-3">
        <h3 className="text-xs font-semibold uppercase text-neutral-500">Preview</h3>
        <p className="mt-3 text-xs font-medium text-neutral-200" data-testid="mesh-tool-status">
          {workflowStatus}
        </p>
      </section>

      {excludedBatchTargets.length === 0 ? null : (
        <ExistingMeshWarning targets={excludedBatchTargets} />
      )}

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
            className="flex min-h-8 items-center justify-center gap-2 rounded border border-amber-600/70 bg-amber-950/25 px-2 text-xs font-semibold text-amber-100 transition enabled:hover:bg-amber-900/30 disabled:cursor-not-allowed disabled:border-neutral-800 disabled:bg-neutral-950 disabled:text-neutral-600"
            onClick={() => {
              if (target.kind === "drawable") {
                setAutoPreviewKey(createPreviewKey(target.drawable.drawableId, presetId));
              }
              generatePreview(presetId);
            }}
            disabled={!canGeneratePreview}
            type="button"
          >
            <RefreshCw aria-hidden="true" size={14} strokeWidth={1.8} />
            {isGenerating
              ? "Generating preview..."
              : target.kind === "drawable" && target.mesh !== undefined && target.mesh.triangles.length > 0
                ? "Regenerate mesh"
                : "Generate preview"}
          </button>
          <div className="grid grid-cols-2 gap-2">
            <button
              className="flex min-h-8 items-center justify-center gap-2 rounded border border-teal-600/70 bg-teal-950/30 px-2 text-xs font-semibold text-teal-100 transition enabled:hover:bg-teal-900/30 disabled:cursor-not-allowed disabled:border-neutral-800 disabled:bg-neutral-950 disabled:text-neutral-600"
              disabled={!canApplyPreview}
              onClick={applyMeshDraft}
              type="button"
            >
              <Check aria-hidden="true" size={14} strokeWidth={1.8} />
              Apply mesh
            </button>
            <button
              className="flex min-h-8 items-center justify-center gap-2 rounded border border-neutral-800 bg-neutral-950 px-2 text-xs font-semibold text-neutral-200 transition enabled:hover:border-neutral-700 disabled:cursor-not-allowed disabled:text-neutral-600"
              disabled={draftsForTarget.length === 0}
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
  | {
      readonly kind: "drawableSet";
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

  if (selection?.kind === "drawableSet") {
    return {
      kind: "drawableSet",
      drawables: selection.ids
        .map((drawableId): DrawableCandidate | undefined => {
          const drawable = drawablesById.get(drawableId);
          if (drawable === undefined) {
            return undefined;
          }

          return {
            drawable,
            mesh: meshesById.get(drawable.meshId),
            effectiveVisible: isDrawableEffectivelyVisible(
              drawable,
              partsById,
              editorHiddenPartIds
            )
          };
        })
        .filter(isDefined)
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

function getMeshToolTargetDrawableIds(target: MeshToolTarget): readonly DrawableId[] {
  if (target.kind === "drawable") {
    return [target.drawable.drawableId];
  }

  if (target.kind === "drawableSet") {
    return target.drawables.map((candidate) => candidate.drawable.drawableId);
  }

  return [];
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

function createPreviewKey(
  drawableId: DrawableId,
  presetId: MeshGenerationPresetId
): string {
  return `${drawableId}:${presetId}`;
}

function formatBatchWorkflowStatus(
  eligibleTargets: readonly MeshDrawableBatchTarget[],
  excludedTargets: readonly MeshDrawableBatchTarget[],
  drafts: readonly { readonly drawableId: DrawableId }[]
): string {
  if (drafts.length > 0) {
    return `${drafts.length} preview${drafts.length === 1 ? "" : "s"} ready`;
  }

  if (eligibleTargets.length === 0) {
    return excludedTargets.length === 0
      ? "No eligible Drawable selected"
      : "All selected Drawables already have meshes";
  }

  return `${eligibleTargets.length} eligible / ${excludedTargets.length} excluded`;
}

function ExistingMeshWarning({
  targets
}: {
  readonly targets: readonly MeshDrawableBatchTarget[];
}) {
  return (
    <section
      className="rounded-md border border-amber-700/60 bg-amber-950/20 p-3"
      data-testid="mesh-tool-existing-mesh-warning"
    >
      <h3 className="text-xs font-semibold uppercase text-amber-200">
        Existing meshes excluded
      </h3>
      <ul className="mt-3 flex flex-col gap-1.5">
        {targets.map((target) => (
          <li
            className="truncate text-xs text-amber-100"
            data-testid="mesh-tool-existing-mesh-name"
            key={target.drawableId}
          >
            {target.displayName}
          </li>
        ))}
      </ul>
    </section>
  );
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

function isDefined<TValue>(value: TValue | undefined): value is TValue {
  return value !== undefined;
}
