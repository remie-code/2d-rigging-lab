import type { DrawableId, RectDto, RigControlId } from "@private-2d-rigging-lab/contracts";
import type { UpdateRigControlPayloadDto } from "@private-2d-rigging-lab/operation-core";
import {
  AlertCircle,
  Check,
  GitBranch,
  Maximize2,
  RotateCcw,
  Spline,
  Trash2,
  X
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { useEditorSession } from "../../features/editor-session/editor-session-context";
import { cn } from "../../lib/class-name";
import { getSelectedDrawableIds } from "../../features/editor-session/model/editor-selection";
import {
  createDeformerTreeWrapSelectionReadModel,
  type DeformerTreeWrapSelectionReadModel
} from "../../features/editor-session/model/deformer-tree-wrap-selection";
import {
  createRigBatchDrawableTargets,
  createDeformerParentOptions,
  createWarpDeformerParentOptions,
  createWarpDeformerTargetOptions,
  findRotationDeformerReadModel,
  findWarpDeformerReadModel,
  formatControlPointGrid,
  formatRectSummary,
  resolveWarpDeformerChildrenBounds,
  type RigBatchDrawableTarget,
  type RotationDeformerReadModel,
  type WarpDeformerDraft,
  type WarpDeformerReadModel,
  type WarpDeformerTargetOption
} from "../../features/editor-session/model/rig-tool-state";
import { createRigControlParameterBindings } from "../../features/editor-session/model/parameter-keyform-state";
import { ParameterBindingSection } from "./parameter-binding-section";

export function RigToolInspector() {
  const {
    applyWarpDeformerDraft,
    cancelWarpDeformerDraft,
    fitWarpDeformerDraft,
    resetWarpDeformerDraft,
    rigDraft,
    rigOperationFeedback,
    selection,
    session,
    createRotationDeformerForDrawables,
    createRotationDeformerForDeformerTreeSelection,
    createParentRotationDeformerForRigControl,
    createParentWarpDeformerForRigControl,
    createWarpDeformerForDrawables,
    createWarpDeformerForDeformerTreeSelection,
    createRotationDeformerForDrawable,
    deleteRigControl,
    reparentRigControl,
    startWarpDeformerDraftForDrawable,
    updateRigControl,
    updateWarpDeformerDraft
  } = useEditorSession();
  const parentOptions = useMemo(() => createWarpDeformerParentOptions(session), [session]);
  const targetOptions = useMemo(
    () => createWarpDeformerTargetOptions(session, selection),
    [selection, session]
  );
  const selectedDrawableIds = useMemo(() => getSelectedDrawableIds(selection), [selection]);
  const batchTargets = useMemo(
    () => createRigBatchDrawableTargets(session, selectedDrawableIds),
    [selectedDrawableIds, session]
  );
  const deformerTreeWrapSelection = useMemo(
    () => createDeformerTreeWrapSelectionReadModel(session, selection),
    [selection, session]
  );

  if (rigDraft !== null) {
    return (
      <WarpDeformerDraftEditor
        draft={rigDraft}
        onApply={applyWarpDeformerDraft}
        onCancel={cancelWarpDeformerDraft}
        feedback={rigOperationFeedback}
        onFit={fitWarpDeformerDraft}
        onReset={resetWarpDeformerDraft}
        onUpdate={updateWarpDeformerDraft}
        parentOptions={parentOptions}
        session={session}
      />
    );
  }

  if (selection?.kind === "rigControl") {
    const warpReadModel = findWarpDeformerReadModel(session, selection.id);
    const rotationReadModel = findRotationDeformerReadModel(session, selection.id);
    return warpReadModel !== undefined ? (
      <CommittedWarpDeformerInspector
        feedback={rigOperationFeedback}
        onCreateParentRotation={createParentRotationDeformerForRigControl}
        onCreateParentWarp={createParentWarpDeformerForRigControl}
        onDelete={deleteRigControl}
        onReparent={reparentRigControl}
        onUpdate={updateRigControl}
        readModel={warpReadModel}
        session={session}
      />
    ) : rotationReadModel !== undefined ? (
      <CommittedRotationDeformerInspector
        feedback={rigOperationFeedback}
        onCreateParentRotation={createParentRotationDeformerForRigControl}
        onCreateParentWarp={createParentWarpDeformerForRigControl}
        onDelete={deleteRigControl}
        onReparent={reparentRigControl}
        onUpdate={updateRigControl}
        readModel={rotationReadModel}
        session={session}
      />
    ) : (
      <RigToolEmptyState title="Rig" summary="Select a Warp Deformer" />
    );
  }

  if (selection?.kind === "drawable" && targetOptions[0] !== undefined) {
    return (
      <WarpDeformerSingleTargetStart
        onCreateRotation={createRotationDeformerForDrawable}
        onStartWarp={startWarpDeformerDraftForDrawable}
        target={targetOptions[0]}
      />
    );
  }

  if (selection?.kind === "drawableSet") {
    return (
      <RigBatchTargetStart
        onCreateRotation={() => createRotationDeformerForDrawables(selectedDrawableIds)}
        onCreateWarp={() => createWarpDeformerForDrawables(selectedDrawableIds)}
        targets={batchTargets}
      />
    );
  }

  if (selection?.kind === "deformerTreeSet" && deformerTreeWrapSelection !== undefined) {
    return (
      <DeformerTreeWrapTargetStart
        feedback={rigOperationFeedback}
        onCreateRotation={createRotationDeformerForDeformerTreeSelection}
        onCreateWarp={createWarpDeformerForDeformerTreeSelection}
        readModel={deformerTreeWrapSelection}
      />
    );
  }

  if (selection?.kind === "part") {
    return (
      <WarpDeformerTargetPicker
        onStart={startWarpDeformerDraftForDrawable}
        targets={targetOptions}
      />
    );
  }

  return <RigToolEmptyState title="Rig" summary="Select a Drawable or Part Container" />;
}

function WarpDeformerSingleTargetStart({
  onCreateRotation,
  onStartWarp,
  target
}: {
  readonly onCreateRotation: (drawableId: DrawableId) => void;
  readonly onStartWarp: (drawableId: DrawableId) => void;
  readonly target: WarpDeformerTargetOption;
}) {
  return (
    <>
      <RigToolHeader title="Rig Deformer" />
      <section className="rounded-md border border-neutral-800 bg-neutral-950/40 p-3">
        <SectionTitle icon={<Spline aria-hidden="true" size={13} strokeWidth={1.8} />}>
          Target
        </SectionTitle>
        <div className="mt-3 divide-y divide-neutral-800">
          <SummaryRow label="Drawable" value={target.displayName} />
          <SummaryRow label="Part" value={target.partDisplayName} />
          <SummaryRow label="Bounds" value={formatRectSummary(target.bounds)} />
        </div>
        <div className="mt-3 grid grid-cols-1 gap-2">
          <button
            className="flex min-h-8 w-full items-center justify-center gap-2 rounded border border-neutral-700 bg-neutral-950 px-3 text-xs font-semibold text-neutral-100 transition hover:border-neutral-500"
            onClick={() => onCreateRotation(target.drawableId)}
            type="button"
          >
            <RotateCcw aria-hidden="true" size={14} strokeWidth={1.8} />
            Create Rotation Deformer
          </button>
          <button
            className="flex min-h-8 w-full items-center justify-center gap-2 rounded border border-teal-700 bg-teal-950/55 px-3 text-xs font-semibold text-teal-100 transition hover:border-teal-500"
            onClick={() => onStartWarp(target.drawableId)}
            type="button"
          >
            <Spline aria-hidden="true" size={14} strokeWidth={1.8} />
            Create Warp Deformer
          </button>
        </div>
      </section>
    </>
  );
}

export function RigBatchTargetStart({
  onCreateRotation,
  onCreateWarp,
  targets
}: {
  readonly onCreateRotation: () => void;
  readonly onCreateWarp: () => void;
  readonly targets: readonly RigBatchDrawableTarget[];
}) {
  const eligibleTargets = targets.filter((target) => target.status === "eligible");
  const excludedTargets = targets.filter((target) => target.status === "alreadyBound");
  const canCreate = eligibleTargets.length > 0;

  return (
    <>
      <RigToolHeader title="Rig Deformer" />
      <section
        className="rounded-md border border-neutral-800 bg-neutral-950/40 p-3"
        data-testid="rig-tool-batch-targets"
      >
        <SectionTitle icon={<Spline aria-hidden="true" size={13} strokeWidth={1.8} />}>
          Target Drawables
        </SectionTitle>
        <div className="mt-3 flex flex-col gap-1.5">
          {targets.length === 0 ? (
            <div className="rounded border border-neutral-800 bg-neutral-950 px-2 py-2 text-xs text-neutral-400">
              No selected Drawables
            </div>
          ) : (
            targets.map((target) => (
              <div
                className={cn(
                  "grid min-h-8 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded border bg-neutral-950/60 px-2",
                  target.status === "eligible"
                    ? "border-neutral-800"
                    : "border-amber-800/70 text-amber-100"
                )}
                data-testid="rig-tool-target-name"
                key={target.drawableId}
              >
                <span className="truncate text-xs font-semibold text-neutral-100">
                  {target.displayName}
                </span>
                <span className="text-[11px] text-neutral-500">
                  {target.status === "eligible" ? "Eligible" : "Bound"}
                </span>
              </div>
            ))
          )}
        </div>
        {excludedTargets.length > 0 ? (
          <div
            className="mt-3 rounded border border-amber-800 bg-amber-950/25 px-2 py-2 text-xs text-amber-100"
            data-testid="rig-tool-bound-drawable-warning"
          >
            Already-bound Drawables are excluded:{" "}
            {excludedTargets.map((target) => target.displayName).join(", ")}
          </div>
        ) : null}
        <div className="mt-3 grid grid-cols-1 gap-2">
          <button
            className={cn(
              "flex min-h-8 w-full items-center justify-center gap-2 rounded border px-3 text-xs font-semibold transition",
              canCreate
                ? "border-neutral-700 bg-neutral-950 text-neutral-100 hover:border-neutral-500"
                : "cursor-not-allowed border-neutral-800 bg-neutral-950 text-neutral-600"
            )}
            disabled={!canCreate}
            onClick={onCreateRotation}
            type="button"
          >
            <RotateCcw aria-hidden="true" size={14} strokeWidth={1.8} />
            Create Rotation Deformer
          </button>
          <button
            className={cn(
              "flex min-h-8 w-full items-center justify-center gap-2 rounded border px-3 text-xs font-semibold transition",
              canCreate
                ? "border-teal-700 bg-teal-950/55 text-teal-100 hover:border-teal-500"
                : "cursor-not-allowed border-neutral-800 bg-neutral-950 text-neutral-600"
            )}
            disabled={!canCreate}
            onClick={onCreateWarp}
            type="button"
          >
            <Spline aria-hidden="true" size={14} strokeWidth={1.8} />
            Create Warp Deformer
          </button>
        </div>
      </section>
    </>
  );
}

export function DeformerTreeWrapTargetStart({
  feedback,
  onCreateRotation,
  onCreateWarp,
  readModel
}: {
  readonly feedback: string | null;
  readonly onCreateRotation: () => void;
  readonly onCreateWarp: () => void;
  readonly readModel: DeformerTreeWrapSelectionReadModel;
}) {
  return (
    <>
      <RigToolHeader title="Rig Deformer" />
      <section
        className="rounded-md border border-neutral-800 bg-neutral-950/40 p-3"
        data-testid="rig-tool-wrap-targets"
      >
        <SectionTitle icon={<Spline aria-hidden="true" size={13} strokeWidth={1.8} />}>
          Target Selection
        </SectionTitle>
        <div className="mt-3 flex flex-col gap-1.5">
          {readModel.targets.length === 0 ? (
            <div className="rounded border border-neutral-800 bg-neutral-950 px-2 py-2 text-xs text-neutral-400">
              No selected Deformer Tree targets
            </div>
          ) : (
            readModel.targets.map((target) => (
              <div
                className={cn(
                  "grid min-h-8 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded border bg-neutral-950/60 px-2",
                  target.status === "included"
                    ? "border-neutral-800"
                    : "border-amber-800/70 text-amber-100"
                )}
                data-testid="rig-tool-wrap-target-name"
                key={`${target.source}:${target.kind}:${target.id}`}
              >
                <span className="truncate text-xs font-semibold text-neutral-100">
                  {target.displayName}
                </span>
                <span className="text-[11px] text-neutral-500">{target.detail}</span>
              </div>
            ))
          )}
        </div>
        {readModel.warning === null ? null : (
          <div
            className="mt-3 flex items-start gap-2 rounded border border-amber-800 bg-amber-950/25 px-2 py-2 text-xs text-amber-100"
            data-testid="rig-tool-wrap-selection-warning"
          >
            <AlertCircle aria-hidden="true" className="mt-0.5 shrink-0" size={13} strokeWidth={1.8} />
            <span>{readModel.warning}</span>
          </div>
        )}
        <div className="mt-3 grid grid-cols-1 gap-2">
          <button
            className={cn(
              "flex min-h-8 w-full items-center justify-center gap-2 rounded border px-3 text-xs font-semibold transition",
              readModel.canCreate
                ? "border-neutral-700 bg-neutral-950 text-neutral-100 hover:border-neutral-500"
                : "cursor-not-allowed border-neutral-800 bg-neutral-950 text-neutral-600"
            )}
            disabled={!readModel.canCreate}
            onClick={onCreateRotation}
            type="button"
          >
            <RotateCcw aria-hidden="true" size={14} strokeWidth={1.8} />
            Create Rotation Deformer
          </button>
          <button
            className={cn(
              "flex min-h-8 w-full items-center justify-center gap-2 rounded border px-3 text-xs font-semibold transition",
              readModel.canCreate
                ? "border-teal-700 bg-teal-950/55 text-teal-100 hover:border-teal-500"
                : "cursor-not-allowed border-neutral-800 bg-neutral-950 text-neutral-600"
            )}
            disabled={!readModel.canCreate}
            onClick={onCreateWarp}
            type="button"
          >
            <Spline aria-hidden="true" size={14} strokeWidth={1.8} />
            Create Warp Deformer
          </button>
        </div>
      </section>
      <OperationFeedback feedback={feedback} />
    </>
  );
}

function WarpDeformerTargetPicker({
  onStart,
  targets
}: {
  readonly onStart: (drawableId: DrawableId) => void;
  readonly targets: readonly WarpDeformerTargetOption[];
}) {
  return (
    <>
      <RigToolHeader title="Warp Deformer" />
      <section
        className="rounded-md border border-neutral-800 bg-neutral-950/40 p-3"
        data-testid="rig-tool-target-picker"
      >
        <SectionTitle icon={<GitBranch aria-hidden="true" size={13} strokeWidth={1.8} />}>
          Target Drawable
        </SectionTitle>
        <div className="mt-3 flex flex-col gap-1.5">
          {targets.length === 0 ? (
            <div className="rounded border border-neutral-800 bg-neutral-950 px-2 py-2 text-xs text-neutral-400">
              No descendant Drawables
            </div>
          ) : (
            targets.map((target) => (
              <button
                className="grid min-h-9 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded border border-neutral-800 bg-neutral-950/60 px-2 text-left transition hover:border-teal-700"
                key={target.drawableId}
                onClick={() => onStart(target.drawableId)}
                type="button"
              >
                <span className="min-w-0">
                  <span className="block truncate text-xs font-semibold text-neutral-100">
                    {target.displayName}
                  </span>
                  <span className="block truncate text-[11px] text-neutral-500">
                    {target.partDisplayName}
                  </span>
                </span>
                <Spline aria-hidden="true" className="text-teal-300" size={14} strokeWidth={1.8} />
              </button>
            ))
          )}
        </div>
      </section>
    </>
  );
}

function WarpDeformerDraftEditor({
  draft,
  feedback,
  onApply,
  onCancel,
  onFit,
  onReset,
  onUpdate,
  parentOptions,
  session
}: {
  readonly draft: WarpDeformerDraft;
  readonly feedback: string | null;
  readonly onApply: () => void;
  readonly onCancel: () => void;
  readonly onFit: () => void;
  readonly onReset: () => void;
  readonly onUpdate: (patch: Partial<WarpDeformerDraft>) => void;
  readonly parentOptions: readonly Pick<WarpDeformerReadModel, "rigControlId" | "displayName">[];
  readonly session: ReturnType<typeof useEditorSession>["session"];
}) {
  const updateBounds = (patch: Partial<RectDto>) => {
    onUpdate({
      domainBounds: {
        ...draft.domainBounds,
        ...patch
      }
    });
  };

  return (
    <>
      <RigToolHeader title="Warp Deformer Draft" />
      <section
        className="rounded-md border border-amber-500/50 bg-amber-950/15 p-3"
        data-testid="rig-tool-inspector"
      >
        <SectionTitle icon={<Spline aria-hidden="true" size={13} strokeWidth={1.8} />}>
          Draft
        </SectionTitle>
        <div className="mt-3 flex flex-col gap-3">
          <LabeledInput
            label="Name"
            onChange={(displayName) => onUpdate({ displayName })}
            value={draft.displayName}
          />
          <label className="flex flex-col gap-1 text-xs text-neutral-500">
            Parent deformer
            <select
              aria-label="Parent deformer"
              className="h-8 rounded border border-neutral-800 bg-neutral-950 px-2 text-xs text-neutral-100 outline-none focus:border-teal-500"
              disabled={draft.insertBeforeChild !== undefined}
              onChange={(event) => {
                const parentRigControlId = event.currentTarget.value;
                onUpdate({
                  parentRigControlId:
                    parentRigControlId.length === 0
                      ? undefined
                      : (parentRigControlId as RigControlId)
                });
              }}
              value={draft.parentRigControlId ?? ""}
            >
              <option value="">None</option>
              {parentOptions.map((option) => (
                <option key={option.rigControlId} value={option.rigControlId}>
                  {option.displayName}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="rounded-md border border-neutral-800 bg-neutral-950/40 p-3">
        <SectionTitle>Domain bounds</SectionTitle>
        <div className="mt-3 grid grid-cols-[repeat(4,minmax(0,1fr))_2rem_2rem] gap-2">
          <NumberField
            displayLabel="X"
            label="Domain bounds x"
            onChange={(x) => updateBounds({ x })}
            value={draft.domainBounds.x}
          />
          <NumberField
            displayLabel="Y"
            label="Domain bounds y"
            onChange={(y) => updateBounds({ y })}
            value={draft.domainBounds.y}
          />
          <NumberField
            displayLabel="W"
            label="Domain bounds width"
            min={1}
            onChange={(width) => updateBounds({ width })}
            value={draft.domainBounds.width}
          />
          <NumberField
            displayLabel="H"
            label="Domain bounds height"
            min={1}
            onChange={(height) => updateBounds({ height })}
            value={draft.domainBounds.height}
          />
          <ActionButton iconOnly label="Fit bounds" onClick={onFit}>
            <Maximize2 aria-hidden="true" size={14} strokeWidth={1.8} />
          </ActionButton>
          <ActionButton iconOnly label="Reset draft" onClick={onReset}>
            <RotateCcw aria-hidden="true" size={14} strokeWidth={1.8} />
          </ActionButton>
        </div>
      </section>

      <section className="rounded-md border border-neutral-800 bg-neutral-950/40 p-3">
        <SectionTitle>Transform divisions (control point counts)</SectionTitle>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <NumberField
            displayLabel="Transform columns"
            label="Transform columns control points"
            min={2}
            onChange={(transformColumns) => onUpdate({ transformColumns })}
            value={draft.transformColumns}
          />
          <NumberField
            displayLabel="Transform rows"
            label="Transform rows control points"
            min={2}
            onChange={(transformRows) => onUpdate({ transformRows })}
            value={draft.transformRows}
          />
        </div>
      </section>

      <section className="rounded-md border border-neutral-800 bg-neutral-950/40 p-3">
        <SectionTitle>Bezier divisions</SectionTitle>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <NumberField
            label="Bezier columns"
            min={2}
            onChange={(bezierColumns) => onUpdate({ bezierColumns })}
            value={draft.bezierColumns}
          />
          <NumberField
            label="Bezier rows"
            min={2}
            onChange={(bezierRows) => onUpdate({ bezierRows })}
            value={draft.bezierRows}
          />
          <ReadonlyTextField
            className="col-span-2"
            label="Bezier edit type"
            value={draft.bezierEditType}
          />
        </div>
      </section>

      <OperationFeedback feedback={feedback} />

      <div className="grid grid-cols-2 gap-2">
        <button
          className="flex min-h-9 items-center justify-center gap-2 rounded border border-neutral-800 bg-neutral-950 px-3 text-xs font-semibold text-neutral-300 transition hover:border-neutral-700"
          onClick={onCancel}
          type="button"
        >
          <X aria-hidden="true" size={14} strokeWidth={1.8} />
          Cancel
        </button>
        <button
          className="flex min-h-9 items-center justify-center gap-2 rounded border border-teal-700 bg-teal-950/60 px-3 text-xs font-semibold text-teal-100 transition hover:border-teal-500"
          onClick={onApply}
          type="button"
        >
          <Check aria-hidden="true" size={14} strokeWidth={1.8} />
          Apply
        </button>
      </div>
    </>
  );
}

export function CommittedWarpDeformerInspector({
  feedback,
  onCreateParentRotation,
  onCreateParentWarp,
  onDelete,
  onReparent,
  onUpdate,
  readModel,
  session
}: {
  readonly feedback: string | null;
  readonly onCreateParentRotation: (rigControlId: RigControlId) => void;
  readonly onCreateParentWarp: (rigControlId: RigControlId) => void;
  readonly onDelete: (rigControlId: RigControlId) => void;
  readonly onReparent: (childRigControlId: RigControlId, parentRigControlId: RigControlId | null) => void;
  readonly onUpdate: ReturnType<typeof useEditorSession>["updateRigControl"];
  readonly readModel: WarpDeformerReadModel;
  readonly session: ReturnType<typeof useEditorSession>["session"];
}) {
  const [editState, setEditState] = useState(() => createWarpEditState(readModel));
  const parentOptions = useMemo(
    () => createDeformerParentOptions(session, readModel.rigControlId),
    [readModel.rigControlId, session]
  );
  const childBounds = useMemo(
    () =>
      resolveWarpDeformerChildrenBounds(
        session,
        readModel.childDrawableIds,
        readModel.childRigControlIds
      ),
    [readModel.childDrawableIds, readModel.childRigControlIds, session]
  );
  const divisionsDisabled = readModel.hasKeyforms;
  const updateBounds = (patch: Partial<RectDto>) => {
    setEditState((current) => ({
      ...current,
      domainBounds: {
        ...current.domainBounds,
        ...patch
      }
    }));
  };
  const apply = () => {
    const nextParentId =
      editState.parentRigControlId.length === 0
        ? undefined
        : (editState.parentRigControlId as RigControlId);
    if (nextParentId !== readModel.parentRigControlId) {
      onReparent(readModel.rigControlId, nextParentId ?? null);
    }

    const payload = createWarpUpdatePayload(readModel, editState, divisionsDisabled);
    if (payload !== undefined) {
      onUpdate(payload);
    }
  };

  useEffect(() => {
    setEditState(createWarpEditState(readModel));
  }, [
    readModel.bezierEditSurface.columns,
    readModel.bezierEditSurface.rows,
    readModel.displayName,
    readModel.domainBounds.height,
    readModel.domainBounds.width,
    readModel.domainBounds.x,
    readModel.domainBounds.y,
    readModel.parentRigControlId,
    readModel.rigControlId,
    readModel.transformGrid.columns,
    readModel.transformGrid.rows
  ]);

  return (
    <>
      <RigToolHeader title={readModel.displayName} />
      <section
        className="rounded-md border border-teal-800/70 bg-teal-950/20 p-3"
        data-testid="rig-tool-inspector"
      >
        <SectionTitle icon={<Spline aria-hidden="true" size={13} strokeWidth={1.8} />}>
          Warp Deformer
        </SectionTitle>
        <div className="mt-3 flex flex-col gap-3">
          <LabeledInput
            label="Name"
            onChange={(displayName) => setEditState((current) => ({ ...current, displayName }))}
            value={editState.displayName}
          />
          <label className="flex flex-col gap-1 text-xs text-neutral-500">
            Parent deformer
            <select
              aria-label="Parent deformer"
              className="h-8 rounded border border-neutral-800 bg-neutral-950 px-2 text-xs text-neutral-100 outline-none focus:border-teal-500"
              onChange={(event) => {
                const parentRigControlId = event.currentTarget.value;
                setEditState((current) => ({
                  ...current,
                  parentRigControlId
                }));
              }}
              value={editState.parentRigControlId}
            >
              <option value="">None</option>
              {parentOptions.map((option) => (
                <option key={option.rigControlId} value={option.rigControlId}>
                  {option.displayName}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <ParameterBindingSection
        bindings={createRigControlParameterBindings(session, readModel.rigControlId)}
      />

      <ParentDeformerActions
        onCreateParentRotation={() => onCreateParentRotation(readModel.rigControlId)}
        onCreateParentWarp={() => onCreateParentWarp(readModel.rigControlId)}
      />
      <DeleteDeformerAction onDelete={() => onDelete(readModel.rigControlId)} />

      <section className="rounded-md border border-neutral-800 bg-neutral-950/40 p-3">
        <SectionTitle>Domain bounds</SectionTitle>
        <div className="mt-3 grid grid-cols-[repeat(4,minmax(0,1fr))_2rem_2rem] gap-2">
          <NumberField
            displayLabel="X"
            label="Domain bounds x"
            onChange={(x) => updateBounds({ x })}
            value={editState.domainBounds.x}
          />
          <NumberField
            displayLabel="Y"
            label="Domain bounds y"
            onChange={(y) => updateBounds({ y })}
            value={editState.domainBounds.y}
          />
          <NumberField
            displayLabel="W"
            label="Domain bounds width"
            min={1}
            onChange={(width) => updateBounds({ width })}
            value={editState.domainBounds.width}
          />
          <NumberField
            displayLabel="H"
            label="Domain bounds height"
            min={1}
            onChange={(height) => updateBounds({ height })}
            value={editState.domainBounds.height}
          />
          <ActionButton
            iconOnly
            label="Fit bounds"
            onClick={() => {
              if (childBounds !== undefined) {
                setEditState((current) => ({ ...current, domainBounds: childBounds }));
              }
            }}
          >
            <Maximize2 aria-hidden="true" size={14} strokeWidth={1.8} />
          </ActionButton>
          <ActionButton
            iconOnly
            label="Reset bounds"
            onClick={() =>
              setEditState((current) => ({
                ...current,
                domainBounds: structuredClone(readModel.domainBounds)
              }))
            }
          >
            <RotateCcw aria-hidden="true" size={14} strokeWidth={1.8} />
          </ActionButton>
        </div>
      </section>

      <section className="rounded-md border border-neutral-800 bg-neutral-950/40 p-3">
        <SectionTitle>Transform divisions (control point counts)</SectionTitle>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <NumberField
            disabled={divisionsDisabled}
            displayLabel="Transform columns"
            label="Transform columns control points"
            min={2}
            onChange={(transformColumns) =>
              setEditState((current) => ({ ...current, transformColumns }))
            }
            value={editState.transformColumns}
          />
          <NumberField
            disabled={divisionsDisabled}
            displayLabel="Transform rows"
            label="Transform rows control points"
            min={2}
            onChange={(transformRows) =>
              setEditState((current) => ({ ...current, transformRows }))
            }
            value={editState.transformRows}
          />
        </div>
      </section>

      <section className="rounded-md border border-neutral-800 bg-neutral-950/40 p-3">
        <SectionTitle>Bezier divisions</SectionTitle>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <NumberField
            disabled={divisionsDisabled}
            label="Bezier columns"
            min={2}
            onChange={(bezierColumns) =>
              setEditState((current) => ({ ...current, bezierColumns }))
            }
            value={editState.bezierColumns}
          />
          <NumberField
            disabled={divisionsDisabled}
            label="Bezier rows"
            min={2}
            onChange={(bezierRows) => setEditState((current) => ({ ...current, bezierRows }))}
            value={editState.bezierRows}
          />
          <ReadonlyTextField
            className="col-span-2"
            label="Bezier edit type"
            value={readModel.bezierEditSurface.editType}
          />
        </div>
      </section>

      <OperationFeedback feedback={feedback} />
      <button
        className="flex min-h-9 items-center justify-center gap-2 rounded border border-teal-700 bg-teal-950/60 px-3 text-xs font-semibold text-teal-100 transition hover:border-teal-500"
        onClick={apply}
        type="button"
      >
        <Check aria-hidden="true" size={14} strokeWidth={1.8} />
        Apply Deformer Edits
      </button>
    </>
  );
}

export function CommittedRotationDeformerInspector({
  feedback,
  onCreateParentRotation,
  onCreateParentWarp,
  onDelete,
  onReparent,
  onUpdate,
  readModel,
  session
}: {
  readonly feedback: string | null;
  readonly onCreateParentRotation: (rigControlId: RigControlId) => void;
  readonly onCreateParentWarp: (rigControlId: RigControlId) => void;
  readonly onDelete: (rigControlId: RigControlId) => void;
  readonly onReparent: (childRigControlId: RigControlId, parentRigControlId: RigControlId | null) => void;
  readonly onUpdate: ReturnType<typeof useEditorSession>["updateRigControl"];
  readonly readModel: RotationDeformerReadModel;
  readonly session: ReturnType<typeof useEditorSession>["session"];
}) {
  const [editState, setEditState] = useState(() => createRotationEditState(readModel));
  const parentOptions = useMemo(
    () => createDeformerParentOptions(session, readModel.rigControlId),
    [readModel.rigControlId, session]
  );
  const apply = () => {
    const nextParentId =
      editState.parentRigControlId.length === 0
        ? undefined
        : (editState.parentRigControlId as RigControlId);
    if (nextParentId !== readModel.parentRigControlId) {
      onReparent(readModel.rigControlId, nextParentId ?? null);
    }

    const payload = createRotationUpdatePayload(readModel, editState);
    if (payload !== undefined) {
      onUpdate(payload);
    }
  };

  useEffect(() => {
    setEditState(createRotationEditState(readModel));
  }, [
    readModel.displayName,
    readModel.parentRigControlId,
    readModel.pivot.x,
    readModel.pivot.y,
    readModel.restTranslation.x,
    readModel.restTranslation.y,
    readModel.restAngleDegrees,
    readModel.rigControlId
  ]);

  return (
    <>
      <RigToolHeader title={readModel.displayName} />
      <section
        className="rounded-md border border-teal-800/70 bg-teal-950/20 p-3"
        data-testid="rig-tool-inspector"
      >
        <SectionTitle icon={<RotateCcw aria-hidden="true" size={13} strokeWidth={1.8} />}>
          Rotation Deformer
        </SectionTitle>
        <div className="mt-3 flex flex-col gap-3">
          <LabeledInput
            label="Name"
            onChange={(displayName) => setEditState((current) => ({ ...current, displayName }))}
            value={editState.displayName}
          />
          <label className="flex flex-col gap-1 text-xs text-neutral-500">
            Parent deformer
            <select
              aria-label="Parent deformer"
              className="h-8 rounded border border-neutral-800 bg-neutral-950 px-2 text-xs text-neutral-100 outline-none focus:border-teal-500"
              onChange={(event) => {
                const parentRigControlId = event.currentTarget.value;
                setEditState((current) => ({
                  ...current,
                  parentRigControlId
                }));
              }}
              value={editState.parentRigControlId}
            >
              <option value="">None</option>
              {parentOptions.map((option) => (
                <option key={option.rigControlId} value={option.rigControlId}>
                  {option.displayName}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>
      <ParameterBindingSection
        bindings={createRigControlParameterBindings(session, readModel.rigControlId)}
      />
      <section className="rounded-md border border-neutral-800 bg-neutral-950/40 p-3">
        <SectionTitle>Setup transform</SectionTitle>
        <div className="mt-3 grid grid-cols-5 gap-2">
          <NumberField
            displayLabel="Pivot X"
            label="Rotation pivot x"
            onChange={(x) =>
              setEditState((current) => ({
                ...current,
                pivot: {
                  ...current.pivot,
                  x
                }
              }))
            }
            value={editState.pivot.x}
          />
          <NumberField
            displayLabel="Pivot Y"
            label="Rotation pivot y"
            onChange={(y) =>
              setEditState((current) => ({
                ...current,
                pivot: {
                  ...current.pivot,
                  y
                }
              }))
            }
            value={editState.pivot.y}
          />
          <NumberField
            displayLabel="Rest X"
            label="Rotation rest translation x"
            onChange={(x) =>
              setEditState((current) => ({
                ...current,
                restTranslation: {
                  ...current.restTranslation,
                  x
                }
              }))
            }
            value={editState.restTranslation.x}
          />
          <NumberField
            displayLabel="Rest Y"
            label="Rotation rest translation y"
            onChange={(y) =>
              setEditState((current) => ({
                ...current,
                restTranslation: {
                  ...current.restTranslation,
                  y
                }
              }))
            }
            value={editState.restTranslation.y}
          />
          <NumberField
            displayLabel="Rest angle"
            label="Rotation rest angle degrees"
            onChange={(restAngleDegrees) =>
              setEditState((current) => ({ ...current, restAngleDegrees }))
            }
            step={1}
            value={editState.restAngleDegrees}
          />
        </div>
      </section>
      <ParentDeformerActions
        onCreateParentRotation={() => onCreateParentRotation(readModel.rigControlId)}
        onCreateParentWarp={() => onCreateParentWarp(readModel.rigControlId)}
      />
      <DeleteDeformerAction onDelete={() => onDelete(readModel.rigControlId)} />
      <OperationFeedback feedback={feedback} />
      <button
        className="flex min-h-9 items-center justify-center gap-2 rounded border border-teal-700 bg-teal-950/60 px-3 text-xs font-semibold text-teal-100 transition hover:border-teal-500"
        onClick={apply}
        type="button"
      >
        <Check aria-hidden="true" size={14} strokeWidth={1.8} />
        Apply Deformer Edits
      </button>
    </>
  );
}

interface WarpEditState {
  readonly displayName: string;
  readonly parentRigControlId: string;
  readonly domainBounds: RectDto;
  readonly transformColumns: number;
  readonly transformRows: number;
  readonly bezierColumns: number;
  readonly bezierRows: number;
}

interface RotationEditState {
  readonly displayName: string;
  readonly parentRigControlId: string;
  readonly pivot: {
    readonly x: number;
    readonly y: number;
  };
  readonly restTranslation: {
    readonly x: number;
    readonly y: number;
  };
  readonly restAngleDegrees: number;
}

function createWarpEditState(readModel: WarpDeformerReadModel): WarpEditState {
  return {
    displayName: readModel.displayName,
    parentRigControlId: readModel.parentRigControlId ?? "",
    domainBounds: structuredClone(readModel.domainBounds),
    transformColumns: readModel.transformGrid.columns,
    transformRows: readModel.transformGrid.rows,
    bezierColumns: readModel.bezierEditSurface.columns,
    bezierRows: readModel.bezierEditSurface.rows
  };
}

function createRotationEditState(readModel: RotationDeformerReadModel): RotationEditState {
  return {
    displayName: readModel.displayName,
    parentRigControlId: readModel.parentRigControlId ?? "",
    pivot: structuredClone(readModel.pivot),
    restTranslation: structuredClone(readModel.restTranslation),
    restAngleDegrees: readModel.restAngleDegrees
  };
}

export function createWarpUpdatePayload(
  readModel: WarpDeformerReadModel,
  editState: WarpEditState,
  divisionsDisabled: boolean
): UpdateRigControlPayloadDto | undefined {
  const payload: UpdateRigControlPayloadDto = {
    rigControlId: readModel.rigControlId
  };

  addStringChange(payload, "displayName", readModel.displayName, editState.displayName.trim());
  if (!sameRect(readModel.domainBounds, editState.domainBounds)) {
    payload.domainBounds = structuredClone(editState.domainBounds);
  }
  if (!divisionsDisabled) {
    addNumberChange(
      payload,
      "transformColumns",
      readModel.transformGrid.columns,
      editState.transformColumns
    );
    addNumberChange(
      payload,
      "transformRows",
      readModel.transformGrid.rows,
      editState.transformRows
    );
    addNumberChange(
      payload,
      "bezierColumns",
      readModel.bezierEditSurface.columns,
      editState.bezierColumns
    );
    addNumberChange(
      payload,
      "bezierRows",
      readModel.bezierEditSurface.rows,
      editState.bezierRows
    );
  }
  return hasUpdateFields(payload) ? payload : undefined;
}

export function createRotationUpdatePayload(
  readModel: RotationDeformerReadModel,
  editState: RotationEditState
): UpdateRigControlPayloadDto | undefined {
  const payload: UpdateRigControlPayloadDto = {
    rigControlId: readModel.rigControlId
  };

  addStringChange(payload, "displayName", readModel.displayName, editState.displayName.trim());
  if (!samePoint(readModel.pivot, editState.pivot)) {
    payload.pivot = structuredClone(editState.pivot);
  }
  if (!samePoint(readModel.restTranslation, editState.restTranslation)) {
    payload.restTranslation = structuredClone(editState.restTranslation);
  }
  addNumberChange(
    payload,
    "restAngleDegrees",
    readModel.restAngleDegrees,
    editState.restAngleDegrees
  );

  return hasUpdateFields(payload) ? payload : undefined;
}

function addStringChange(
  payload: UpdateRigControlPayloadDto,
  key: "displayName",
  before: string,
  after: string
): void {
  if (after.length > 0 && before !== after) {
    payload[key] = after;
  }
}

function addNumberChange(
  payload: UpdateRigControlPayloadDto,
  key:
    | "transformColumns"
    | "transformRows"
    | "bezierColumns"
    | "bezierRows"
    | "restAngleDegrees",
  before: number,
  after: number
): void {
  if (Number.isFinite(after) && before !== after) {
    payload[key] = after;
  }
}

function hasUpdateFields(payload: UpdateRigControlPayloadDto): boolean {
  return Object.keys(payload).some((key) => key !== "rigControlId");
}

function sameRect(left: RectDto, right: RectDto): boolean {
  return (
    left.x === right.x &&
    left.y === right.y &&
    left.width === right.width &&
    left.height === right.height
  );
}

function samePoint(
  left: { readonly x: number; readonly y: number },
  right: { readonly x: number; readonly y: number }
): boolean {
  return left.x === right.x && left.y === right.y;
}

function RigToolEmptyState({
  summary,
  title
}: {
  readonly summary: string;
  readonly title: string;
}) {
  return (
    <>
      <RigToolHeader title={title} />
      <section
        className="rounded-md border border-neutral-800 bg-neutral-950/40 p-3 text-xs text-neutral-400"
        data-testid="rig-tool-empty-state"
      >
        {summary}
      </section>
    </>
  );
}

function RigToolHeader({ title }: { readonly title: string }) {
  return (
    <div className="rounded-md border border-neutral-800 bg-neutral-950/50 p-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-neutral-100">
        <Spline aria-hidden="true" size={16} strokeWidth={1.8} />
        <span className="min-w-0 truncate">{title}</span>
      </div>
    </div>
  );
}

function SectionTitle({
  children,
  icon
}: {
  readonly children: string;
  readonly icon?: ReactNode;
}) {
  return (
    <h3 className="flex items-center gap-2 text-xs font-semibold uppercase text-neutral-500">
      {icon}
      {children}
    </h3>
  );
}

function OperationFeedback({ feedback }: { readonly feedback: string | null }) {
  return feedback === null ? null : (
    <div
      className="flex items-start gap-2 rounded-md border border-amber-800 bg-amber-950/25 px-2 py-2 text-xs text-amber-100"
      data-testid="rig-tool-operation-feedback"
    >
      <AlertCircle aria-hidden="true" className="mt-0.5 shrink-0" size={13} strokeWidth={1.8} />
      <span>{feedback}</span>
    </div>
  );
}

function ParentDeformerActions({
  onCreateParentRotation,
  onCreateParentWarp
}: {
  readonly onCreateParentRotation: () => void;
  readonly onCreateParentWarp: () => void;
}) {
  return (
    <section className="rounded-md border border-neutral-800 bg-neutral-950/40 p-3">
      <SectionTitle>Create parent deformer</SectionTitle>
      <div className="mt-3 grid grid-cols-1 gap-2">
        <button
          className="flex min-h-8 w-full items-center justify-center gap-2 rounded border border-neutral-700 bg-neutral-950 px-3 text-xs font-semibold text-neutral-100 transition hover:border-neutral-500"
          onClick={onCreateParentRotation}
          type="button"
        >
          <RotateCcw aria-hidden="true" size={14} strokeWidth={1.8} />
          Create Parent Rotation Deformer
        </button>
        <button
          className="flex min-h-8 w-full items-center justify-center gap-2 rounded border border-teal-700 bg-teal-950/55 px-3 text-xs font-semibold text-teal-100 transition hover:border-teal-500"
          onClick={onCreateParentWarp}
          type="button"
        >
          <Spline aria-hidden="true" size={14} strokeWidth={1.8} />
          Create Parent Warp Deformer
        </button>
      </div>
    </section>
  );
}

function DeleteDeformerAction({ onDelete }: { readonly onDelete: () => void }) {
  return (
    <section className="rounded-md border border-red-900/70 bg-red-950/15 p-3">
      <SectionTitle>Delete deformer</SectionTitle>
      <button
        className="mt-3 flex min-h-8 w-full items-center justify-center gap-2 rounded border border-red-800 bg-red-950/50 px-3 text-xs font-semibold text-red-100 transition hover:border-red-600"
        onClick={onDelete}
        type="button"
      >
        <Trash2 aria-hidden="true" size={14} strokeWidth={1.8} />
        Delete Deformer
      </button>
    </section>
  );
}

function LabeledInput({
  label,
  onChange,
  value
}: {
  readonly label: string;
  readonly onChange: (value: string) => void;
  readonly value: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs text-neutral-500">
      {label}
      <input
        aria-label={label}
        className="h-8 rounded border border-neutral-800 bg-neutral-950 px-2 text-xs text-neutral-100 outline-none focus:border-teal-500"
        onChange={(event) => onChange(event.currentTarget.value)}
        value={value}
      />
    </label>
  );
}

function NumberField({
  className,
  disabled = false,
  displayLabel,
  label,
  max,
  min,
  onChange,
  step,
  value
}: {
  readonly className?: string;
  readonly disabled?: boolean;
  readonly displayLabel?: string;
  readonly label: string;
  readonly max?: number;
  readonly min?: number;
  readonly onChange: (value: number) => void;
  readonly step?: number;
  readonly value: number;
}) {
  return (
    <label className={cn("flex min-w-0 flex-col gap-1 text-xs text-neutral-500", className)}>
      {displayLabel ?? label}
      <input
        aria-label={label}
        className={cn(
          "h-8 min-w-0 rounded border border-neutral-800 bg-neutral-950 px-2 text-right text-xs text-neutral-100 outline-none focus:border-teal-500",
          disabled ? "cursor-not-allowed text-neutral-600" : ""
        )}
        disabled={disabled}
        max={max}
        min={min}
        onChange={(event) => {
          const numeric = Number(event.currentTarget.value);
          if (Number.isFinite(numeric)) {
            onChange(numeric);
          }
        }}
        step={step}
        type="number"
        value={formatInputNumber(value)}
      />
    </label>
  );
}

function ReadonlyTextField({
  className,
  label,
  value
}: {
  readonly className?: string;
  readonly label: string;
  readonly value: string;
}) {
  return (
    <label className={cn("flex min-w-0 flex-col gap-1 text-xs text-neutral-500", className)}>
      {label}
      <input
        aria-label={label}
        className="h-8 min-w-0 rounded border border-neutral-800 bg-neutral-950 px-2 text-xs text-neutral-300 outline-none"
        readOnly
        value={value}
      />
    </label>
  );
}

function ActionButton({
  children,
  iconOnly = false,
  label,
  onClick
}: {
  readonly children: ReactNode;
  readonly iconOnly?: boolean;
  readonly label: string;
  readonly onClick: () => void;
}) {
  return (
    <button
      aria-label={label}
      className={cn(
        "flex min-h-8 items-center justify-center gap-2 rounded border border-neutral-800 bg-neutral-950 text-xs font-medium text-neutral-300 transition hover:border-neutral-700",
        iconOnly ? "px-0" : "px-2"
      )}
      onClick={onClick}
      title={label}
      type="button"
    >
      {children}
      {iconOnly ? null : label}
    </button>
  );
}

function SummaryBlock({
  rows
}: {
  readonly rows: readonly {
    readonly label: string;
    readonly value: string;
  }[];
}) {
  return (
    <div className="mt-3 divide-y divide-neutral-800">
      {rows.map((row) => (
        <SummaryRow key={row.label} label={row.label} value={row.value} />
      ))}
    </div>
  );
}

function SummaryRow({
  label,
  value
}: {
  readonly label: string;
  readonly value: string;
}) {
  return (
    <div className="flex min-h-8 items-center justify-between gap-3 py-1.5">
      <span className="text-xs text-neutral-500">{label}</span>
      <span className="truncate text-right text-xs font-medium text-neutral-200">{value}</span>
    </div>
  );
}

function formatInputNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}
