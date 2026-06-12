import type { DrawableId, RectDto, RigControlId } from "@private-2d-rigging-lab/contracts";
import {
  Check,
  GitBranch,
  Maximize2,
  RotateCcw,
  Spline,
  X
} from "lucide-react";
import { useMemo, type ReactNode } from "react";

import { useEditorSession } from "../../features/editor-session/editor-session-context";
import {
  createWarpDeformerParentOptions,
  createWarpDeformerTargetOptions,
  findWarpDeformerReadModel,
  formatControlPointGrid,
  formatRectSummary,
  summarizeWarpDeformerChildren,
  WARP_DEFORMER_BEZIER_EDIT_TYPE,
  type WarpDeformerDraft,
  type WarpDeformerReadModel,
  type WarpDeformerTargetOption
} from "../../features/editor-session/model/rig-tool-state";

export function RigToolInspector() {
  const {
    applyWarpDeformerDraft,
    cancelWarpDeformerDraft,
    fitWarpDeformerDraft,
    resetWarpDeformerDraft,
    rigDraft,
    selection,
    session,
    startWarpDeformerDraftForDrawable,
    updateWarpDeformerDraft
  } = useEditorSession();
  const parentOptions = useMemo(() => createWarpDeformerParentOptions(session), [session]);
  const targetOptions = useMemo(
    () => createWarpDeformerTargetOptions(session, selection),
    [selection, session]
  );

  if (rigDraft !== null) {
    return (
      <WarpDeformerDraftEditor
        draft={rigDraft}
        onApply={applyWarpDeformerDraft}
        onCancel={cancelWarpDeformerDraft}
        onFit={fitWarpDeformerDraft}
        onReset={resetWarpDeformerDraft}
        onUpdate={updateWarpDeformerDraft}
        parentOptions={parentOptions}
        session={session}
      />
    );
  }

  if (selection?.kind === "rigControl") {
    const readModel = findWarpDeformerReadModel(session, selection.id);
    return readModel === undefined ? (
      <RigToolEmptyState title="Rig" summary="Select a Warp Deformer" />
    ) : (
      <CommittedWarpDeformerInspector readModel={readModel} session={session} />
    );
  }

  if (selection?.kind === "drawable" && targetOptions[0] !== undefined) {
    return (
      <WarpDeformerSingleTargetStart
        onStart={startWarpDeformerDraftForDrawable}
        target={targetOptions[0]}
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
  onStart,
  target
}: {
  readonly onStart: (drawableId: DrawableId) => void;
  readonly target: WarpDeformerTargetOption;
}) {
  return (
    <>
      <RigToolHeader title="Warp Deformer" />
      <section className="rounded-md border border-neutral-800 bg-neutral-950/40 p-3">
        <SectionTitle icon={<Spline aria-hidden="true" size={13} strokeWidth={1.8} />}>
          Target
        </SectionTitle>
        <div className="mt-3 divide-y divide-neutral-800">
          <SummaryRow label="Drawable" value={target.displayName} />
          <SummaryRow label="Part" value={target.partDisplayName} />
          <SummaryRow label="Bounds" value={formatRectSummary(target.bounds)} />
        </div>
        <button
          className="mt-3 flex min-h-8 w-full items-center justify-center gap-2 rounded border border-teal-700 bg-teal-950/55 px-3 text-xs font-semibold text-teal-100 transition hover:border-teal-500"
          onClick={() => onStart(target.drawableId)}
          type="button"
        >
          <Spline aria-hidden="true" size={14} strokeWidth={1.8} />
          Create Warp Deformer
        </button>
      </section>
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
  onApply,
  onCancel,
  onFit,
  onReset,
  onUpdate,
  parentOptions,
  session
}: {
  readonly draft: WarpDeformerDraft;
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
              onChange={(event) =>
                onUpdate({
                  parentRigControlId:
                    event.currentTarget.value.length === 0
                      ? undefined
                      : (event.currentTarget.value as RigControlId)
                })
              }
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
          <SummaryBlock
            rows={[
              {
                label: "Bound children",
                value: summarizeWarpDeformerChildren(
                  session,
                  draft.childDrawableIds,
                  draft.childRigControlIds
                )
              },
              { label: "Bezier edit type", value: draft.bezierEditType },
              {
                label: "Transform",
                value: formatControlPointGrid(draft.transformColumns, draft.transformRows)
              },
              {
                label: "Bezier",
                value: formatControlPointGrid(draft.bezierColumns, draft.bezierRows)
              }
            ]}
          />
        </div>
      </section>

      <section className="rounded-md border border-neutral-800 bg-neutral-950/40 p-3">
        <SectionTitle>Domain bounds</SectionTitle>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <NumberField
            label="Domain bounds x"
            onChange={(x) => updateBounds({ x })}
            value={draft.domainBounds.x}
          />
          <NumberField
            label="Domain bounds y"
            onChange={(y) => updateBounds({ y })}
            value={draft.domainBounds.y}
          />
          <NumberField
            label="Domain bounds width"
            min={1}
            onChange={(width) => updateBounds({ width })}
            value={draft.domainBounds.width}
          />
          <NumberField
            label="Domain bounds height"
            min={1}
            onChange={(height) => updateBounds({ height })}
            value={draft.domainBounds.height}
          />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <ActionButton label="Fit bounds" onClick={onFit}>
            <Maximize2 aria-hidden="true" size={14} strokeWidth={1.8} />
          </ActionButton>
          <ActionButton label="Reset draft" onClick={onReset}>
            <RotateCcw aria-hidden="true" size={14} strokeWidth={1.8} />
          </ActionButton>
        </div>
      </section>

      <section className="rounded-md border border-neutral-800 bg-neutral-950/40 p-3">
        <SectionTitle>Transform divisions (control point counts)</SectionTitle>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <NumberField
            label="Transform columns control points"
            min={2}
            onChange={(transformColumns) => onUpdate({ transformColumns })}
            value={draft.transformColumns}
          />
          <NumberField
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
        </div>
        <input
          aria-label="Bezier edit type"
          className="mt-3 h-8 w-full rounded border border-neutral-800 bg-neutral-950 px-2 text-xs text-neutral-400"
          readOnly
          value={WARP_DEFORMER_BEZIER_EDIT_TYPE}
        />
      </section>

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

function CommittedWarpDeformerInspector({
  readModel,
  session
}: {
  readonly readModel: WarpDeformerReadModel;
  readonly session: ReturnType<typeof useEditorSession>["session"];
}) {
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
        <SummaryBlock
          rows={[
            { label: "Name", value: readModel.displayName },
            { label: "Parent deformer", value: readModel.parentRigControlId ?? "None" },
            {
              label: "Bound children",
              value: summarizeWarpDeformerChildren(
                session,
                readModel.childDrawableIds,
                readModel.childRigControlIds
              )
            },
            { label: "Domain bounds", value: formatRectSummary(readModel.domainBounds) },
            {
              label: "Transform control points",
              value: formatControlPointGrid(
                readModel.transformGrid.columns,
                readModel.transformGrid.rows
              )
            },
            {
              label: "Bezier divisions",
              value: formatControlPointGrid(
                readModel.bezierEditSurface.columns,
                readModel.bezierEditSurface.rows
              )
            },
            { label: "Bezier edit type", value: readModel.bezierEditSurface.editType },
            { label: "Transform evaluation", value: readModel.evaluationBoundary.transformEvaluation },
            { label: "Bezier evaluation", value: readModel.evaluationBoundary.bezierEvaluation }
          ]}
        />
      </section>
    </>
  );
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
  label,
  min,
  onChange,
  value
}: {
  readonly label: string;
  readonly min?: number;
  readonly onChange: (value: number) => void;
  readonly value: number;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1 text-xs text-neutral-500">
      {label}
      <input
        aria-label={label}
        className="h-8 min-w-0 rounded border border-neutral-800 bg-neutral-950 px-2 text-right text-xs text-neutral-100 outline-none focus:border-teal-500"
        min={min}
        onChange={(event) => {
          const numeric = Number(event.currentTarget.value);
          if (Number.isFinite(numeric)) {
            onChange(numeric);
          }
        }}
        type="number"
        value={formatInputNumber(value)}
      />
    </label>
  );
}

function ActionButton({
  children,
  label,
  onClick
}: {
  readonly children: ReactNode;
  readonly label: string;
  readonly onClick: () => void;
}) {
  return (
    <button
      className="flex min-h-8 items-center justify-center gap-2 rounded border border-neutral-800 bg-neutral-950 px-2 text-xs font-medium text-neutral-300 transition hover:border-neutral-700"
      onClick={onClick}
      type="button"
    >
      {children}
      {label}
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
