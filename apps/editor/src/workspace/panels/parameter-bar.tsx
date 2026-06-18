import type { ParameterId } from "@private-2d-rigging-lab/contracts";
import {
  ChevronsLeftRight,
  ChevronsUpDown,
  KeyRound,
  Plus,
  RotateCcw,
  SlidersHorizontal,
  Trash2,
  Wrench
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode
} from "react";

import { useEditorSession } from "../../features/editor-session/editor-session-context";
import {
  createDrawableOpacityBinding,
  createEditKeyformPayload,
  createParameterBindingProjection,
  createRigControlParameterBindings,
  createTargetParameterKeyMarkers,
  formatParameterValue,
  type EditorParameter,
  type ParameterBindingProjection,
  type ParameterKeyformBindingDescriptor,
  type ParameterKeyMarker
} from "../../features/editor-session/model/parameter-keyform-state";
import { cn } from "../../lib/class-name";
import { useEditorUiStore } from "../../state/editor-ui-store";
import { useRafCoalescedNumberCommit } from "../controls/raf-coalesced-number";

export function ParameterBar() {
  const {
    activeParameterId,
    editKeyformKey,
    openParameterManager,
    parameterBar,
    parameterValues,
    resetActiveParameterValue,
    selection,
    session,
    setActiveParameterId,
    setActiveParameterValue
  } = useEditorSession();
  const activeTool = useEditorUiStore((state) => state.activeTool);
  const disabledForDynamics = activeTool === "dynamics";
  const selectedBindings = useMemo(
    () => createSelectedBindings(session, selection),
    [selection, session]
  );
  const [selectedBindingKey, setSelectedBindingKey] = useState(
    () => selectedBindings[0] === undefined ? "" : createBindingKey(selectedBindings[0])
  );
  useEffect(() => {
    setSelectedBindingKey((current) =>
      selectedBindings.some((binding) => createBindingKey(binding) === current)
        ? current
        : selectedBindings[0] === undefined
          ? ""
          : createBindingKey(selectedBindings[0])
    );
  }, [selectedBindings]);
  const selectedBinding =
    selectedBindings.find((binding) => createBindingKey(binding) === selectedBindingKey) ??
    selectedBindings[0];
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
  const visibleKeyMarkers = useMemo(
    () =>
      activeParameter === null || selectedBinding === undefined
        ? []
        : createTargetParameterKeyMarkers(
            session,
            [selectedBinding],
            activeParameter.parameterId,
            currentValue
          ),
    [activeParameter, currentValue, selectedBinding, session]
  );

  const commitAction = (
    projection: ParameterBindingProjection,
    action: "addCurrent" | "updateCurrent" | "deleteCurrent" | "createEnds" | "createEndsCenter"
  ) => {
    if (disabledForDynamics) {
      return;
    }

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
      className="flex h-12 shrink-0 items-center gap-3 border-t border-neutral-800 bg-[#151514] px-4 py-1.5"
      data-readonly-for-dynamics={String(disabledForDynamics)}
      data-testid="parameter-bar"
    >
      <div className="flex min-w-36 shrink-0 items-center gap-2 text-sm font-semibold text-neutral-100">
        <SlidersHorizontal aria-hidden="true" size={17} strokeWidth={1.8} />
        <span>Parameter Bar</span>
      </div>

      <button
        className="flex h-8 shrink-0 items-center gap-2 rounded border border-neutral-800 bg-neutral-950 px-2 text-xs font-medium text-neutral-300 transition hover:border-teal-700 hover:text-teal-100"
        data-testid="parameter-manager-link"
        disabled={disabledForDynamics}
        onClick={openParameterManager}
        type="button"
      >
        <Wrench aria-hidden="true" size={14} strokeWidth={1.8} />
        Manage
      </button>

      <div className="grid min-w-0 flex-1 grid-cols-[minmax(8rem,13rem)_minmax(8rem,13rem)_minmax(12rem,1fr)_2rem_4.5rem] items-center gap-3">
        <select
          aria-label="Active parameter"
          className="h-8 min-w-0 rounded border border-neutral-800 bg-neutral-950 px-2 text-xs text-neutral-100 outline-none focus:border-teal-500"
          disabled={disabledForDynamics || parameterBar.parameters.length === 0}
          onChange={(event) => setActiveParameterId(event.currentTarget.value as ParameterId)}
          value={activeParameterId ?? ""}
        >
          {parameterBar.parameters.map((parameter) => (
            <option key={parameter.parameterId} value={parameter.parameterId}>
              {parameter.displayName}
            </option>
          ))}
        </select>

        <select
          aria-label="Keyform target"
          className="h-8 min-w-0 rounded border border-neutral-800 bg-neutral-950 px-2 text-xs text-neutral-100 outline-none focus:border-teal-500 disabled:cursor-not-allowed disabled:text-neutral-600"
          disabled={disabledForDynamics || selectedBindings.length <= 1}
          onChange={(event) => setSelectedBindingKey(event.currentTarget.value)}
          value={selectedBinding === undefined ? "" : createBindingKey(selectedBinding)}
        >
          {selectedBindings.length === 0 ? (
            <option value="">No target</option>
          ) : (
            selectedBindings.map((binding) => (
              <option key={createBindingKey(binding)} value={createBindingKey(binding)}>
                {binding.label}
              </option>
            ))
          )}
        </select>

        <ParameterSlider
          activeParameter={activeParameter}
          currentValue={currentValue}
          disabled={disabledForDynamics}
          keyMarkers={visibleKeyMarkers}
          onChange={setActiveParameterValue}
        />

        <KeyPositionStateIcon
          activeParameter={activeParameter}
          keyMarkers={visibleKeyMarkers}
          selectedBindings={selectedBinding === undefined ? [] : [selectedBinding]}
        />

        <input
          aria-label="Parameter numeric value"
          className="h-8 rounded border border-neutral-800 bg-neutral-950 px-2 text-right text-xs text-neutral-100 outline-none focus:border-teal-500 disabled:cursor-not-allowed disabled:text-neutral-600"
          disabled={disabledForDynamics || !canUseSlider}
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
        {disabledForDynamics ? (
          <span
            className="shrink-0 rounded border border-neutral-800 bg-neutral-950 px-2 py-1 text-[11px] font-medium text-neutral-500"
            data-testid="parameter-bar-readonly-reason"
          >
            Dynamics preview
          </span>
        ) : null}
        <BarButton
          disabled={disabledForDynamics}
          label="Reset active parameter"
          onClick={resetActiveParameterValue}
        >
          <RotateCcw aria-hidden="true" size={14} strokeWidth={1.8} />
          Reset
        </BarButton>
        <BarButton
          disabled={disabledForDynamics || selectedProjection === undefined || !selectedProjection.canAddCurrent}
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
          disabled={disabledForDynamics || selectedProjection === undefined || !selectedProjection.canUpdateCurrent}
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
          disabled={disabledForDynamics || selectedProjection === undefined || !selectedProjection.canDeleteCurrent}
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
          disabled={disabledForDynamics || selectedProjection === undefined || !selectedProjection.canCreateEnds}
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
          disabled={disabledForDynamics || selectedProjection === undefined || !selectedProjection.canCreateEndsCenter}
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
    </section>
  );
}

function KeyPositionStateIcon({
  activeParameter,
  keyMarkers,
  selectedBindings
}: {
  readonly activeParameter: EditorParameter | null;
  readonly keyMarkers: readonly ParameterKeyMarker[];
  readonly selectedBindings: readonly ParameterKeyformBindingDescriptor[];
}) {
  const label = formatKeyPositionState(activeParameter, selectedBindings, keyMarkers);
  const isOnKeyform = keyMarkers.some((marker) => marker.selected);

  return (
    <span
      aria-label={`Parameter keyform state: ${label}`}
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded border transition",
        isOnKeyform
          ? "border-teal-500 bg-teal-950/50 text-teal-100"
          : "border-neutral-800 bg-neutral-950 text-neutral-500"
      )}
      data-testid="parameter-key-position-state"
      title={label}
    >
      <KeyRound aria-hidden="true" size={14} strokeWidth={1.9} />
    </span>
  );
}

function ParameterSlider({
  activeParameter,
  currentValue,
  disabled = false,
  keyMarkers,
  onChange
}: {
  readonly activeParameter: EditorParameter | null;
  readonly currentValue: number;
  readonly disabled?: boolean;
  readonly keyMarkers: readonly ParameterKeyMarker[];
  readonly onChange: (value: number) => void;
}) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const activePointerIdRef = useRef<number | null>(null);
  const canScrub = activeParameter !== null && !disabled;
  const min = activeParameter?.min ?? 0;
  const max = activeParameter?.max ?? 1;
  const step = activeParameter?.recommendedUiStep ?? 0.01;
  const currentPercent = projectParameterSliderPercent(min, max, currentValue);
  const scrubCommit = useRafCoalescedNumberCommit({
    counterPrefix: "parameterBar.slider",
    onCommit: onChange
  });

  const updateFromPointer = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      const track = trackRef.current;
      if (track === null) {
        return;
      }

      const rect = track.getBoundingClientRect();
      if (rect.width <= 0) {
        return;
      }

      scrubCommit.schedule(
        projectParameterSliderValue({
          clientX: event.clientX,
          max,
          min,
          step,
          trackLeft: rect.left,
          trackWidth: rect.width
        })
      );
    },
    [max, min, scrubCommit, step]
  );

  const startThumbDrag = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!canScrub) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      activePointerIdRef.current = event.pointerId;
      event.currentTarget.setPointerCapture(event.pointerId);
      updateFromPointer(event);
    },
    [canScrub, updateFromPointer]
  );

  const moveThumbDrag = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (activePointerIdRef.current !== event.pointerId) {
        return;
      }

      event.preventDefault();
      updateFromPointer(event);
    },
    [updateFromPointer]
  );

  const endThumbDrag = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (activePointerIdRef.current !== event.pointerId) {
        return;
      }

      event.preventDefault();
      updateFromPointer(event);
      activePointerIdRef.current = null;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      scrubCommit.flush();
    },
    [scrubCommit, updateFromPointer]
  );

  return (
    <div
      className="relative flex h-8 items-center"
      data-testid="parameter-slider"
      onPointerDown={handleParameterSliderTrackPointerDown}
    >
      <div
        aria-hidden="true"
        className="absolute left-0 right-0 top-1/2 h-2 -translate-y-1/2 rounded bg-neutral-800"
        data-testid="parameter-slider-track"
        ref={trackRef}
      />
      <div
        aria-hidden="true"
        className="absolute left-0 top-1/2 h-2 -translate-y-1/2 rounded bg-teal-700/70"
        style={{ width: `${currentPercent}%` }}
      />
      {activeParameter === null
        ? null
        : keyMarkers.map((marker) => (
            <div
              aria-hidden="true"
              className={cn(
                "absolute top-1/2 z-10 h-6 w-3 -translate-x-1/2 -translate-y-1/2 rounded border border-amber-400/70 bg-amber-300/85 transition hover:border-amber-200 hover:bg-amber-200",
                marker.selected
                  ? "h-7 w-3.5 border-teal-200 bg-teal-300"
                  : ""
              )}
              data-parameter-value={formatParameterValue(marker.value)}
              data-disabled={String(disabled)}
              data-testid="parameter-key-marker"
              key={marker.value}
              onClick={(event) => {
                event.stopPropagation();
                if (disabled) {
                  return;
                }
                onChange(marker.value);
              }}
              onPointerDown={(event) => event.stopPropagation()}
              style={{
                left: `${projectParameterSliderPercent(
                  activeParameter.min,
                  activeParameter.max,
                  marker.value
                )}%`
              }}
              title={`Jump to keyform ${formatParameterValue(marker.value)}`}
            />
          ))}
      <div
        aria-hidden="true"
        className={cn(
          "absolute top-1/2 z-20 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-teal-100 bg-teal-400 shadow-sm transition",
          canScrub ? "cursor-ew-resize" : "cursor-not-allowed border-neutral-700 bg-neutral-700"
        )}
        data-parameter-max={formatParameterValue(max)}
        data-parameter-min={formatParameterValue(min)}
        data-parameter-value={formatParameterValue(currentValue)}
        data-testid="parameter-slider-thumb"
        onPointerCancel={endThumbDrag}
        onPointerDown={startThumbDrag}
        onPointerMove={moveThumbDrag}
        onPointerUp={endThumbDrag}
        style={{ left: `${currentPercent}%` }}
        title={`Parameter value ${formatParameterValue(currentValue)}`}
      />
    </div>
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

function createSelectedBindings(
  session: ReturnType<typeof useEditorSession>["session"],
  selection: ReturnType<typeof useEditorSession>["selection"]
): readonly ParameterKeyformBindingDescriptor[] {
  if (selection?.kind === "drawable") {
    const binding = createDrawableOpacityBinding(session, selection.id);
    return binding === undefined ? [] : [binding];
  }

  if (selection?.kind === "rigControl") {
    return createRigControlParameterBindings(session, selection.id);
  }

  return [];
}

function createBindingKey(binding: ParameterKeyformBindingDescriptor): string {
  return `${binding.target.kind}:${binding.target.id}:${binding.targetProperty}`;
}

function formatKeyPositionState(
  activeParameter: EditorParameter | null,
  selectedBindings: readonly ParameterKeyformBindingDescriptor[],
  markers: readonly ParameterKeyMarker[]
): string {
  if (activeParameter === null) {
    return "No parameter";
  }

  if (selectedBindings.length === 0) {
    return "No target";
  }

  if (markers.some((marker) => marker.selected)) {
    return "keyform";
  }

  return markers.length === 0 ? "static" : "interpolated";
}

export function handleParameterSliderTrackPointerDown(
  event: Pick<ReactPointerEvent<HTMLElement>, "preventDefault">
): void {
  event.preventDefault();
}

export function projectParameterSliderPercent(min: number, max: number, value: number): number {
  if (min === max) {
    return 0;
  }

  return clampSliderRatio((value - min) / (max - min)) * 100;
}

export function projectParameterSliderValue({
  clientX,
  max,
  min,
  step,
  trackLeft,
  trackWidth
}: {
  readonly clientX: number;
  readonly max: number;
  readonly min: number;
  readonly step: number;
  readonly trackLeft: number;
  readonly trackWidth: number;
}): number {
  if (min === max || trackWidth <= 0) {
    return min;
  }

  const ratio = clampSliderRatio((clientX - trackLeft) / trackWidth);
  const rawValue = min + ratio * (max - min);
  return clampSliderValue(min, max, snapSliderValue(rawValue, min, step));
}

function snapSliderValue(value: number, min: number, step: number): number {
  if (!Number.isFinite(step) || step <= 0) {
    return value;
  }

  const snapped = min + Math.round((value - min) / step) * step;
  return Number(snapped.toFixed(6));
}

function clampSliderValue(min: number, max: number, value: number): number {
  return Math.min(Math.max(value, min), max);
}

function clampSliderRatio(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(Math.max(value, 0), 1);
}
