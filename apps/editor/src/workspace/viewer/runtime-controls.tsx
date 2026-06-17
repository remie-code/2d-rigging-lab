import { RotateCcw, Search, SlidersHorizontal } from "lucide-react";
import { useCallback, useMemo, type ChangeEvent } from "react";

import type { EditorParameter } from "../../features/editor-session/model/parameter-keyform-state";
import { cn } from "../../lib/class-name";
import {
  createRuntimeControlsProjection,
  normalizeRuntimeControlsState,
  resetAllRuntimeParameterOverrides,
  resetRuntimeParameterOverride,
  setRuntimeControlsSearch,
  setRuntimeParameterOverride,
  type RuntimeControlParameterRow,
  type ViewerRuntimeControlsState
} from "./runtime-controls-state";

export interface RuntimeControlsProps {
  readonly className?: string;
  readonly onStateChange: (state: ViewerRuntimeControlsState) => void;
  readonly parameters: readonly EditorParameter[];
  readonly state: ViewerRuntimeControlsState;
}

export function RuntimeControls({
  className,
  onStateChange,
  parameters,
  state
}: RuntimeControlsProps) {
  const normalizedState = useMemo(
    () => normalizeRuntimeControlsState(parameters, state),
    [parameters, state]
  );
  const projection = useMemo(
    () => createRuntimeControlsProjection(parameters, normalizedState),
    [normalizedState, parameters]
  );

  const commitState = useCallback(
    (nextState: ViewerRuntimeControlsState) => {
      onStateChange(normalizeRuntimeControlsState(parameters, nextState));
    },
    [onStateChange, parameters]
  );
  const applyParameterValue = useCallback(
    (row: RuntimeControlParameterRow, value: number) => {
      commitState(setRuntimeParameterOverride(normalizedState, row.parameter, value));
    },
    [commitState, normalizedState]
  );

  return (
    <aside
      className={cn(
        "flex h-full min-h-0 w-full flex-col overflow-hidden border-l border-neutral-800 bg-[#151514]",
        className
      )}
      data-testid="runtime-controls"
    >
      <header className="flex min-h-12 items-center gap-2 border-b border-neutral-800 px-3 py-2">
        <SlidersHorizontal aria-hidden="true" size={16} strokeWidth={1.8} />
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold text-neutral-100">Runtime Controls</h2>
          <p className="truncate text-xs text-neutral-500">
            {formatOverrideCount(projection.changedParameterCount)}
          </p>
        </div>
      </header>

      <div className="grid grid-cols-[minmax(0,1fr)_2rem] items-center gap-2 border-b border-neutral-800 px-3 py-2">
        <label className="relative block">
          <span className="sr-only">Search parameters</span>
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-neutral-500"
            size={14}
            strokeWidth={1.8}
          />
          <input
            aria-label="Search parameters"
            className="h-8 w-full rounded border border-neutral-800 bg-neutral-950 pl-8 pr-2 text-xs text-neutral-100 outline-none transition placeholder:text-neutral-600 focus:border-teal-500"
            onChange={(event) =>
              commitState(setRuntimeControlsSearch(normalizedState, event.currentTarget.value))
            }
            placeholder="Search parameters..."
            type="search"
            value={projection.search}
          />
        </label>

        <button
          aria-label="Reset all parameter overrides"
          className="inline-flex size-8 items-center justify-center rounded border border-neutral-800 bg-neutral-950 text-neutral-400 transition hover:border-teal-700 hover:text-teal-100 disabled:cursor-not-allowed disabled:border-neutral-900 disabled:text-neutral-700"
          disabled={Object.keys(normalizedState.parameterOverrides).length === 0}
          onClick={() => commitState(resetAllRuntimeParameterOverrides(normalizedState))}
          title="Reset all"
          type="button"
        >
          <RotateCcw aria-hidden="true" size={14} strokeWidth={1.8} />
        </button>
      </div>

      <div
        className="min-h-0 flex-1 overflow-auto px-3 py-2"
        data-testid="runtime-parameter-list"
      >
        {projection.rows.length === 0 ? (
          <p className="px-1 py-5 text-center text-xs text-neutral-500">
            {projection.hasSearch ? "No matching editable parameters." : "No editable parameters."}
          </p>
        ) : (
          <div className="grid gap-1.5">
            {projection.rows.map((row) => (
              <RuntimeParameterControlRow
                key={row.parameterId}
                onChange={(value) => applyParameterValue(row, value)}
                onReset={() =>
                  commitState(resetRuntimeParameterOverride(normalizedState, row.parameterId))
                }
                row={row}
              />
            ))}
          </div>
        )}
      </div>

      <footer
        aria-disabled="true"
        className="border-t border-neutral-800 px-3 py-3 text-xs text-neutral-500"
        data-testid="future-playback-slot"
      >
        <div className="flex items-center justify-between gap-3 rounded border border-neutral-800 bg-neutral-950 px-3 py-2">
          <span className="font-medium text-neutral-300">Motion / Physics</span>
          <span>Not configured</span>
        </div>
      </footer>
    </aside>
  );
}

function RuntimeParameterControlRow({
  onChange,
  onReset,
  row
}: {
  readonly onChange: (value: number) => void;
  readonly onReset: () => void;
  readonly row: RuntimeControlParameterRow;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-[minmax(6.5rem,0.78fr)_minmax(8rem,1fr)_4rem_1.75rem] items-center gap-2 rounded border bg-neutral-950/70 px-2 py-1.5",
        row.changed
          ? "border-teal-700/80 shadow-[inset_2px_0_0_rgba(20,184,166,0.7)]"
          : "border-neutral-800"
      )}
      data-changed={row.changed ? "true" : "false"}
      data-parameter-id={row.parameterId}
      data-testid="runtime-parameter-row"
    >
      <div className="min-w-0">
        <div className="truncate text-xs font-semibold text-neutral-100">
          {row.displayName}
        </div>
      </div>

      <input
        aria-label={`${row.displayName} slider`}
        className="h-2 min-w-0 accent-teal-500"
        max={row.max}
        min={row.min}
        onChange={(event) => onChange(readNumericInputValue(event, row.currentValue))}
        step={row.step}
        type="range"
        value={row.currentValue}
      />
      <input
        aria-label={`${row.displayName} value`}
        className="h-7 min-w-0 rounded border border-neutral-800 bg-[#151514] px-1.5 text-right text-[11px] text-neutral-100 outline-none transition focus:border-teal-500"
        max={row.max}
        min={row.min}
        onBlur={(event) => onChange(readNumericInputValue(event, row.currentValue))}
        onChange={(event) => onChange(readNumericInputValue(event, row.currentValue))}
        step={row.step}
        type="number"
        value={row.formattedValue}
      />
      <button
        aria-label={`Reset ${row.displayName}`}
        className="inline-flex size-7 items-center justify-center rounded border border-neutral-800 bg-[#151514] text-neutral-400 transition hover:border-teal-700 hover:text-teal-100 disabled:cursor-not-allowed disabled:border-neutral-900 disabled:text-neutral-700"
        disabled={!row.changed}
        onClick={onReset}
        title={`Reset ${row.displayName}`}
        type="button"
      >
        <RotateCcw aria-hidden="true" size={13} strokeWidth={1.8} />
      </button>
    </div>
  );
}

function formatOverrideCount(count: number): string {
  return count === 1 ? "1 override" : `${count} overrides`;
}

function readNumericInputValue(
  event: ChangeEvent<HTMLInputElement>,
  fallbackValue: number
): number {
  const value = Number(event.currentTarget.value);
  return Number.isFinite(value) ? value : fallbackValue;
}
