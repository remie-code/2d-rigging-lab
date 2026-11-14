import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode
} from "react";
import type { ReferenceImageMode, ReferenceImageState, ReferenceImageUpdate } from "@private-2d-rigging-lab/contracts";

import {
  importEditorReferenceImage,
  type EditorReferenceImage
} from "../../features/workspace-storage/model/workspace-reference-image";

const BUTTON = "rounded border border-neutral-700 px-2 py-1 hover:border-teal-500 disabled:opacity-50";
const FIELD = "rounded border border-neutral-700 bg-neutral-950 px-2 py-1";

export function ReferenceImageControls({
  reference, adjusting, placingPivot, disabled, onReplace, onUpdate, onAdjust, onPlacePivot, onPreviewOpacity
}: {
  readonly reference: ReferenceImageState | null;
  readonly adjusting: boolean;
  readonly placingPivot: boolean;
  readonly disabled: boolean;
  readonly onReplace: (reference: EditorReferenceImage | null) => void;
  readonly onUpdate: (update: ReferenceImageUpdate) => void;
  readonly onAdjust: () => void;
  readonly onPlacePivot: () => void;
  readonly onPreviewOpacity: (opacity: number | undefined) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const importGeneration = useRef(0);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [opacityDraft, setOpacityDraft] = useState<number>();
  const opacityPercent = opacityDraft ?? (reference?.opacity ?? 0) * 100;
  useEffect(() => () => { importGeneration.current++; }, []);

  const selectPng = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (file === undefined) return;
    const generation = ++importGeneration.current;
    setError(null);
    setImporting(true);
    try {
      const image = await importEditorReferenceImage(file);
      if (generation === importGeneration.current) onReplace(image);
    } catch (cause) {
      if (generation === importGeneration.current) {
        setError(cause instanceof Error ? cause.message : String(cause));
      }
    } finally {
      if (generation === importGeneration.current) setImporting(false);
    }
  };

  const commitOpacity = () => {
    if (opacityDraft === undefined) return;
    onUpdate({ opacity: opacityDraft / 100 });
    setOpacityDraft(undefined);
    onPreviewOpacity(undefined);
  };

  return (
    <fieldset
      aria-label="Reference Image settings"
      className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-neutral-800 bg-[#181a19] px-3 py-2 text-xs text-neutral-200"
      disabled={disabled || importing}
    >
      <input accept=".png,image/png" aria-label="Reference PNG" className="hidden" onChange={(event) => void selectPng(event)} ref={input} type="file" />
      <button className={BUTTON} onClick={() => input.current?.click()} type="button">
        {importing ? "Loading PNG…" : reference === null ? "Choose PNG" : "Replace PNG"}
      </button>
      {reference === null ? null : (
        <>
          <button className={BUTTON} onClick={() => onReplace(null)} type="button">Remove</button>
          <label className="flex items-center gap-1">
            View
            <select aria-label="Reference view" className={FIELD} value={reference.displayMode} onChange={(event) =>
              onUpdate({ displayMode: event.currentTarget.value as ReferenceImageMode })
            }>
              <option value="model">Model only</option>
              <option value="reference">Reference only</option>
              <option value="overlay">Overlay</option>
            </select>
          </label>
          <label className="flex items-center gap-1.5">
            Opacity
            <input
              aria-label="Reference opacity"
              className="w-20 accent-teal-400"
              max={100}
              min={0}
              onBlur={commitOpacity}
              onChange={(event) => {
                const percent = event.currentTarget.valueAsNumber;
                setOpacityDraft(percent);
                onPreviewOpacity(percent / 100);
              }}
              onKeyUp={commitOpacity}
              onPointerCancel={() => {
                setOpacityDraft(undefined);
                onPreviewOpacity(undefined);
              }}
              onPointerUp={commitOpacity}
              type="range"
              value={opacityPercent}
            />
            <output className="min-w-9 text-right tabular-nums">{Math.round(opacityPercent)}%</output>
          </label>
          <button className={BUTTON} onClick={onAdjust} type="button">{adjusting ? "Done" : "Adjust Reference"}</button>
          {adjusting ? (
            <>
              <button
                aria-pressed={placingPivot}
                className={`${BUTTON} aria-pressed:border-teal-400 aria-pressed:text-teal-200`}
                onClick={onPlacePivot}
                type="button"
              >Set Pivot</button>
              <NumberField value={reference.transform.scale} positive onCommit={(scale) => onUpdate({ scale })}>
                Scale
              </NumberField>
              <NumberField value={reference.transform.rotationDegrees} onCommit={(rotationDegrees) => onUpdate({ rotationDegrees })}>
                Rotation (°)
              </NumberField>
              {placingPivot ? <span role="status">Click a point on the reference.</span> : null}
            </>
          ) : null}
        </>
      )}
      {error === null ? null : <span className="basis-full text-red-300" role="alert">{error}</span>}
    </fieldset>
  );
}

function NumberField({ children, value, positive, onCommit }: {
  readonly children: ReactNode;
  readonly value: number;
  readonly positive?: boolean;
  readonly onCommit: (value: number) => void;
}) {
  return (
    <label className="flex items-center gap-1">
      {children}
      <input
        className={`${FIELD} w-[5.5rem] tabular-nums`}
        defaultValue={Number(value.toPrecision(8))}
        key={value}
        onBlur={(event) => {
          const next = event.currentTarget.valueAsNumber;
          if (Number.isFinite(next) && (!positive || next > 0)) {
            if (next !== Number(value.toPrecision(8))) onCommit(next);
          } else {
            event.currentTarget.value = String(Number(value.toPrecision(8)));
          }
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
          if (event.key === "Escape") {
            event.currentTarget.value = String(Number(value.toPrecision(8)));
            event.currentTarget.blur();
          }
        }}
        step={positive ? 0.01 : 0.1}
        type="number"
      />
    </label>
  );
}
