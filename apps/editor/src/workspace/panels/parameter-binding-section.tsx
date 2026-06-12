import { Save, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { useEditorSession } from "../../features/editor-session/editor-session-context";
import {
  createEditKeyformPayload,
  createParameterBindingProjection,
  createUniformControlPointOffsets,
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
  const { activeParameterId, editKeyformKey, parameterValues, session } = useEditorSession();
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
    action: "updateCurrent" | "deleteCurrent"
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
        value: editValue
      })
    );
  };

  return (
    <div
      className="rounded border border-neutral-800 bg-neutral-950/70 p-2"
      data-testid={`parameter-binding-${binding.targetProperty}`}
    >
      <div className="truncate text-xs font-semibold text-neutral-100">
        {binding.label}
      </div>

      <BindingValueEditor
        disabled={!projection.canEditValue}
        onChange={setEditValue}
        projection={projection}
        value={editValue}
      />

      {projection.hasCurrentKeyform ? (
        <div className="mt-2 grid grid-cols-2 gap-1.5">
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
        </div>
      ) : null}
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
      <label className="flex h-8 min-w-0 items-center">
        <input
          aria-label={projection.binding.label}
          className="h-2 w-full accent-teal-400 disabled:cursor-not-allowed"
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
        showLabel={false}
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
  showLabel = true,
  step,
  value
}: {
  readonly disabled: boolean;
  readonly label: string;
  readonly max?: number | undefined;
  readonly min?: number | undefined;
  readonly onChange: (value: number) => void;
  readonly showLabel?: boolean;
  readonly step?: number | undefined;
  readonly value: number;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1 text-[11px] text-neutral-500">
      {showLabel ? label : null}
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
      title={label}
      type="button"
    >
      {children}
    </button>
  );
}
