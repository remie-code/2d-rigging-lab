import type { ParameterId } from "@private-2d-rigging-lab/contracts";
import {
  ChevronsLeftRight,
  ChevronsUpDown,
  Plus,
  RotateCcw,
  SlidersHorizontal,
  Trash2,
  Wrench
} from "lucide-react";
import { useMemo, type ReactNode } from "react";

import { useEditorSession } from "../../features/editor-session/editor-session-context";
import {
  createDrawableOpacityBinding,
  createEditKeyformPayload,
  createParameterBindingProjection,
  createRigControlParameterBindings,
  formatKeyMarkers,
  formatParameterValue,
  type ParameterBindingProjection,
  type ParameterKeyformBindingDescriptor
} from "../../features/editor-session/model/parameter-keyform-state";
import { cn } from "../../lib/class-name";

export function ParameterBar() {
  const {
    activeParameterId,
    editKeyformKey,
    openParameterManager,
    parameterBar,
    parameterOperationFeedback,
    parameterValues,
    resetActiveParameterValue,
    selection,
    session,
    setActiveParameterId,
    setActiveParameterValue
  } = useEditorSession();
  const selectedBinding = useMemo(
    () => createSelectedPrimaryBinding(session, selection),
    [selection, session]
  );
  const selectedProjection = useMemo(
    () =>
      selectedBinding === undefined
        ? undefined
        : createParameterBindingProjection(
            session,
            selectedBinding,
            activeParameterId,
            parameterValues
          ),
    [activeParameterId, parameterValues, selectedBinding, session]
  );

  const activeParameter = parameterBar.activeParameter;
  const currentValue = parameterBar.currentValue;
  const canUseSlider = activeParameter !== null;

  const commitAction = (
    projection: ParameterBindingProjection,
    action: "addCurrent" | "updateCurrent" | "deleteCurrent" | "createEnds" | "createEndsCenter"
  ) => {
    if (projection.parameter === null) {
      return;
    }

    editKeyformKey(
      createEditKeyformPayload({
        binding: projection.binding,
        parameter: projection.parameter,
        currentParameterValue: projection.currentParameterValue,
        action,
        value: projection.displayValue
      })
    );
  };

  return (
    <section
      className="flex h-[76px] shrink-0 items-center gap-3 border-t border-neutral-800 bg-[#151514] px-4 py-2"
      data-testid="parameter-bar"
    >
      <div className="flex min-w-36 shrink-0 items-center gap-2 text-sm font-semibold text-neutral-100">
        <SlidersHorizontal aria-hidden="true" size={17} strokeWidth={1.8} />
        <span>Parameter Bar</span>
      </div>

      <button
        className="flex h-8 shrink-0 items-center gap-2 rounded border border-neutral-800 bg-neutral-950 px-2 text-xs font-medium text-neutral-300 transition hover:border-teal-700 hover:text-teal-100"
        data-testid="parameter-manager-link"
        onClick={openParameterManager}
        type="button"
      >
        <Wrench aria-hidden="true" size={14} strokeWidth={1.8} />
        Manage
      </button>

      <div className="grid min-w-0 flex-1 grid-cols-[minmax(10rem,15rem)_minmax(14rem,1fr)_4.5rem] items-center gap-3">
        <label className="flex min-w-0 flex-col gap-1 text-[11px] font-medium uppercase text-neutral-500">
          Active
          <select
            aria-label="Active parameter"
            className="h-8 min-w-0 rounded border border-neutral-800 bg-neutral-950 px-2 text-xs normal-case text-neutral-100 outline-none focus:border-teal-500"
            disabled={parameterBar.parameters.length === 0}
            onChange={(event) => setActiveParameterId(event.currentTarget.value as ParameterId)}
            value={activeParameterId ?? ""}
          >
            {parameterBar.parameters.map((parameter) => (
              <option key={parameter.parameterId} value={parameter.parameterId}>
                {parameter.displayName}
              </option>
            ))}
          </select>
        </label>

        <div className="min-w-0">
          <div className="mb-1 flex items-center justify-between gap-2 text-[11px] text-neutral-500">
            <span className="truncate">
              {activeParameter === null
                ? "No active parameter"
                : `${formatParameterValue(activeParameter.min)} / ${formatParameterValue(activeParameter.default)} / ${formatParameterValue(activeParameter.max)}`}
            </span>
            <span className="truncate" data-testid="parameter-key-marker-summary">
              {formatKeyMarkers(parameterBar.keyMarkers)}
            </span>
          </div>
          <div className="relative flex h-8 items-center">
            <input
              aria-label="Parameter value"
              className="h-2 w-full accent-teal-500 disabled:cursor-not-allowed"
              disabled={!canUseSlider}
              max={activeParameter?.max ?? 1}
              min={activeParameter?.min ?? 0}
              onChange={(event) => setActiveParameterValue(Number(event.currentTarget.value))}
              step={activeParameter?.recommendedUiStep ?? 0.01}
              type="range"
              value={currentValue}
            />
            {activeParameter === null
              ? null
              : parameterBar.keyMarkers.map((marker) => (
                  <span
                    aria-hidden="true"
                    className={cn(
                      "pointer-events-none absolute top-1/2 h-4 w-px -translate-y-1/2 rounded bg-amber-300",
                      marker.selected ? "h-5 w-0.5 bg-teal-300" : ""
                    )}
                    key={marker.value}
                    style={{
                      left: `${toMarkerPercent(activeParameter.min, activeParameter.max, marker.value)}%`
                    }}
                  />
                ))}
          </div>
        </div>

        <input
          aria-label="Parameter numeric value"
          className="h-8 rounded border border-neutral-800 bg-neutral-950 px-2 text-right text-xs text-neutral-100 outline-none focus:border-teal-500 disabled:cursor-not-allowed disabled:text-neutral-600"
          disabled={!canUseSlider}
          max={activeParameter?.max ?? 1}
          min={activeParameter?.min ?? 0}
          onBlur={(event) => setActiveParameterValue(Number(event.currentTarget.value))}
          onChange={(event) => setActiveParameterValue(Number(event.currentTarget.value))}
          step={activeParameter?.recommendedUiStep ?? 0.01}
          type="number"
          value={formatParameterValue(currentValue)}
        />
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <BarButton label="Reset active parameter" onClick={resetActiveParameterValue}>
          <RotateCcw aria-hidden="true" size={14} strokeWidth={1.8} />
          Reset
        </BarButton>
        <BarButton
          disabled={selectedProjection === undefined || !selectedProjection.canAddCurrent}
          label="Add keyform at current value"
          onClick={() => {
            if (selectedProjection !== undefined) {
              commitAction(selectedProjection, "addCurrent");
            }
          }}
        >
          <Plus aria-hidden="true" size={14} strokeWidth={1.8} />
          Add
        </BarButton>
        <BarButton
          disabled={selectedProjection === undefined || !selectedProjection.canUpdateCurrent}
          label="Update keyform at current value"
          onClick={() => {
            if (selectedProjection !== undefined) {
              commitAction(selectedProjection, "updateCurrent");
            }
          }}
        >
          Update
        </BarButton>
        <BarButton
          disabled={selectedProjection === undefined || !selectedProjection.canDeleteCurrent}
          label="Delete keyform at current value"
          onClick={() => {
            if (selectedProjection !== undefined) {
              commitAction(selectedProjection, "deleteCurrent");
            }
          }}
        >
          <Trash2 aria-hidden="true" size={14} strokeWidth={1.8} />
          Delete
        </BarButton>
        <BarButton
          disabled={selectedProjection === undefined || !selectedProjection.canCreateEnds}
          label="Create end keyforms"
          onClick={() => {
            if (selectedProjection !== undefined) {
              commitAction(selectedProjection, "createEnds");
            }
          }}
        >
          <ChevronsLeftRight aria-hidden="true" size={14} strokeWidth={1.8} />
          Ends
        </BarButton>
        <BarButton
          disabled={selectedProjection === undefined || !selectedProjection.canCreateEndsCenter}
          label="Create end and center keyforms"
          onClick={() => {
            if (selectedProjection !== undefined) {
              commitAction(selectedProjection, "createEndsCenter");
            }
          }}
        >
          <ChevronsUpDown aria-hidden="true" size={14} strokeWidth={1.8} />
          Ends + Center
        </BarButton>
      </div>

      <div
        className="w-44 shrink-0 truncate text-[11px] text-neutral-500"
        data-testid="parameter-bar-target-summary"
        title={parameterOperationFeedback ?? selectedProjection?.binding.label ?? "No supported target selected"}
      >
        {parameterOperationFeedback ??
          selectedProjection?.binding.label ??
          "Select a supported target"}
      </div>
    </section>
  );
}

function BarButton({
  children,
  disabled,
  label,
  onClick
}: {
  readonly children: ReactNode;
  readonly disabled?: boolean;
  readonly label: string;
  readonly onClick: () => void;
}) {
  return (
    <button
      aria-label={label}
      className="flex h-8 min-w-0 items-center justify-center gap-1 rounded border border-neutral-800 bg-neutral-950 px-2 text-xs font-medium text-neutral-300 transition hover:border-teal-700 hover:text-teal-100 disabled:cursor-not-allowed disabled:border-neutral-900 disabled:text-neutral-700"
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

function createSelectedPrimaryBinding(
  session: ReturnType<typeof useEditorSession>["session"],
  selection: ReturnType<typeof useEditorSession>["selection"]
): ParameterKeyformBindingDescriptor | undefined {
  if (selection?.kind === "drawable") {
    return createDrawableOpacityBinding(session, selection.id);
  }

  if (selection?.kind === "rigControl") {
    return createRigControlParameterBindings(session, selection.id)[0];
  }

  return undefined;
}

function toMarkerPercent(min: number, max: number, value: number): number {
  if (min === max) {
    return 0;
  }

  return Math.min(Math.max(((value - min) / (max - min)) * 100, 0), 100);
}
