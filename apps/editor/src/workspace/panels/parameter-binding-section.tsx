import {
  ChevronsLeftRight,
  ChevronsUpDown,
  Lock,
  Plus,
  Save,
  Trash2
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { useEditorSession } from "../../features/editor-session/editor-session-context";
import {
  createEditKeyformPayload,
  createParameterBindingProjection,
  createUniformControlPointOffsets,
  formatKeyMarkers,
  formatParameterValue,
  getControlPointCount,
  readUniformOffset,
  type ParameterBindingProjection,
  type ParameterKeyformBindingDescriptor,
  type ParameterKeyformValue
} from "../../features/editor-session/model/parameter-keyform-state";
import { cn } from "../../lib/class-name";

export function ParameterBindingSection({
  bindings
}: {
  readonly bindings: readonly ParameterKeyformBindingDescriptor[];
}) {
  if (bindings.length === 0) {
    return null;
  }

  return (
    <section
      className="border-t border-neutral-800 pt-3"
      data-testid="parameter-binding-section"
    >
      <h3 className="text-xs font-semibold uppercase text-neutral-500">Parameter Binding</h3>
      <div className="mt-3 flex flex-col gap-3">
        {bindings.map((binding) => (
          <ParameterBindingEditor
            binding={binding}
            key={`${binding.target.kind}:${binding.target.id}:${binding.targetProperty}`}
          />
        ))}
      </div>
    </section>
  );
}

function ParameterBindingEditor({
  binding
}: {
  readonly binding: ParameterKeyformBindingDescriptor;
}) {
  const {
    activeParameterId,
    editKeyformKey,
    parameterOperationFeedback,
    parameterValues,
    session
  } = useEditorSession();
  const projection = useMemo(
    () => createParameterBindingProjection(session, binding, activeParameterId, parameterValues),
    [activeParameterId, binding, parameterValues, session]
  );
  const [editValue, setEditValue] = useState<ParameterKeyformValue>(projection.displayValue);

  useEffect(() => {
    setEditValue(projection.displayValue);
  }, [
    binding.target.id,
    binding.target.kind,
    binding.targetProperty,
    projection.currentParameterValue,
    projection.displayValue,
    projection.hasCurrentKeyform,
    projection.parameter?.parameterId
  ]);

  const commit = (
    action: "addCurrent" | "updateCurrent" | "deleteCurrent" | "createEnds" | "createEndsCenter"
  ) => {
    if (projection.parameter === null) {
      return;
    }

    editKeyformKey(
      createEditKeyformPayload({
        binding,
        parameter: projection.parameter,
        currentParameterValue: projection.currentParameterValue,
        action,
        value: action === "addCurrent" ? projection.displayValue : editValue
      })
    );
  };

  return (
    <div
      className="rounded border border-neutral-800 bg-neutral-950/70 p-2"
      data-testid={`parameter-binding-${binding.targetProperty}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-xs font-semibold text-neutral-100">{binding.label}</div>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-neutral-500">
            <span>
              Parameter: {projection.parameter?.displayName ?? "None"}
            </span>
            <span>Value: {formatParameterValue(projection.currentParameterValue)}</span>
            <span>{projection.hasCurrentKeyform ? "Keyform: Exists" : "Keyform: None"}</span>
          </div>
        </div>
        <span
          className={cn(
            "shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase",
            projection.source === "keyform"
              ? "border-teal-800 bg-teal-950/40 text-teal-100"
              : "border-neutral-800 bg-neutral-900 text-neutral-400"
          )}
        >
          {projection.source}
        </span>
      </div>

      <div className="mt-2 text-[11px] text-neutral-500">
        Keys: {formatKeyMarkers(projection.keyMarkers)}
      </div>

      <BindingValueEditor
        disabled={!projection.canEditValue}
        onChange={setEditValue}
        projection={projection}
        value={editValue}
      />

      {projection.disabledReason === null ? null : (
        <div className="mt-2 flex items-start gap-2 rounded border border-neutral-800 bg-neutral-900/70 px-2 py-1.5 text-[11px] text-neutral-400">
          <Lock aria-hidden="true" className="mt-0.5 shrink-0" size={12} strokeWidth={1.8} />
          <span>{projection.disabledReason}</span>
        </div>
      )}

      {parameterOperationFeedback === null ? null : (
        <div
          className="mt-2 rounded border border-amber-800 bg-amber-950/25 px-2 py-1.5 text-[11px] text-amber-100"
          data-testid="parameter-operation-feedback"
        >
          {parameterOperationFeedback}
        </div>
      )}

      <div className="mt-3 grid grid-cols-5 gap-1.5">
        <BindingAction
          disabled={!projection.canAddCurrent}
          label="Add Keyform Here"
          onClick={() => commit("addCurrent")}
        >
          <Plus aria-hidden="true" size={13} strokeWidth={1.8} />
        </BindingAction>
        <BindingAction
          disabled={!projection.canUpdateCurrent}
          label="Update"
          onClick={() => commit("updateCurrent")}
        >
          <Save aria-hidden="true" size={13} strokeWidth={1.8} />
        </BindingAction>
        <BindingAction
          disabled={!projection.canDeleteCurrent}
          label="Delete"
          onClick={() => commit("deleteCurrent")}
        >
          <Trash2 aria-hidden="true" size={13} strokeWidth={1.8} />
        </BindingAction>
        <BindingAction
          disabled={!projection.canCreateEnds}
          label="Ends"
          onClick={() => commit("createEnds")}
        >
          <ChevronsLeftRight aria-hidden="true" size={13} strokeWidth={1.8} />
        </BindingAction>
        <BindingAction
          disabled={!projection.canCreateEndsCenter}
          label="Ends + Center"
          onClick={() => commit("createEndsCenter")}
        >
          <ChevronsUpDown aria-hidden="true" size={13} strokeWidth={1.8} />
        </BindingAction>
      </div>
    </div>
  );
}

function BindingValueEditor({
  disabled,
  onChange,
  projection,
  value
}: {
  readonly disabled: boolean;
  readonly onChange: (value: ParameterKeyformValue) => void;
  readonly projection: ParameterBindingProjection;
  readonly value: ParameterKeyformValue;
}) {
  if (projection.binding.valueKind === "controlPointOffsets") {
    const count = getControlPointCount(projection.binding.baseValue);
    const x = readUniformOffset(value, "x");
    const y = readUniformOffset(value, "y");

    return (
      <div className="mt-2 grid grid-cols-[1fr_1fr_auto] items-end gap-2">
        <NumberInput
          disabled={disabled}
          label="Uniform offset X"
          onChange={(nextX) => onChange(createUniformControlPointOffsets(count, nextX, y))}
          step={projection.binding.numericRange?.step}
          value={x}
        />
        <NumberInput
          disabled={disabled}
          label="Uniform offset Y"
          onChange={(nextY) => onChange(createUniformControlPointOffsets(count, x, nextY))}
          step={projection.binding.numericRange?.step}
          value={y}
        />
        <div className="pb-2 text-right text-[11px] text-neutral-500">{count} points</div>
      </div>
    );
  }

  const numericValue = typeof value === "number" ? value : 0;

  return (
    <div className="mt-2 grid grid-cols-[1fr_4.5rem] gap-2">
      <label className="flex min-w-0 flex-col gap-1 text-[11px] text-neutral-500">
        {projection.binding.label}
        <input
          aria-label={projection.binding.label}
          className="h-2 accent-teal-400 disabled:cursor-not-allowed"
          disabled={disabled}
          max={projection.binding.numericRange?.max}
          min={projection.binding.numericRange?.min}
          onChange={(event) => onChange(Number(event.currentTarget.value))}
          step={projection.binding.numericRange?.step ?? 0.01}
          type="range"
          value={numericValue}
        />
      </label>
      <NumberInput
        disabled={disabled}
        label={`${projection.binding.label} value`}
        max={projection.binding.numericRange?.max}
        min={projection.binding.numericRange?.min}
        onChange={onChange}
        step={projection.binding.numericRange?.step}
        value={numericValue}
      />
    </div>
  );
}

function NumberInput({
  disabled,
  label,
  max,
  min,
  onChange,
  step,
  value
}: {
  readonly disabled: boolean;
  readonly label: string;
  readonly max?: number | undefined;
  readonly min?: number | undefined;
  readonly onChange: (value: number) => void;
  readonly step?: number | undefined;
  readonly value: number;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1 text-[11px] text-neutral-500">
      {label}
      <input
        aria-label={label}
        className="h-8 min-w-0 rounded border border-neutral-800 bg-neutral-950 px-2 text-right text-xs text-neutral-100 outline-none focus:border-teal-500 disabled:cursor-not-allowed disabled:text-neutral-600"
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
        value={formatParameterValue(value)}
      />
    </label>
  );
}

function BindingAction({
  children,
  disabled,
  label,
  onClick
}: {
  readonly children: ReactNode;
  readonly disabled: boolean;
  readonly label: string;
  readonly onClick: () => void;
}) {
  return (
    <button
      aria-label={label}
      className="flex min-h-8 min-w-0 items-center justify-center gap-1 rounded border border-neutral-800 bg-neutral-950 px-1.5 text-[11px] font-medium text-neutral-300 transition hover:border-teal-700 hover:text-teal-100 disabled:cursor-not-allowed disabled:border-neutral-900 disabled:text-neutral-700"
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {children}
      <span className="truncate">{label}</span>
    </button>
  );
}
