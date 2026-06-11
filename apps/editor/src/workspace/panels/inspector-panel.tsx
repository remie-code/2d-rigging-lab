import type { DrawableId } from "@private-2d-rigging-lab/contracts";
import { Eye, EyeOff, Scissors, SlidersHorizontal } from "lucide-react";
import { useEffect, useMemo, useState, type KeyboardEvent } from "react";

import { useEditorSession } from "../../features/editor-session/editor-session-context";
import type {
  DrawableInspectorProjection,
  PartInspectorProjection,
  ProjectInspectorProjection
} from "../../features/editor-session/model/session-tree";
import { cn } from "../../lib/class-name";
import { useEditorUiStore } from "../../state/editor-ui-store";
import { MeshToolInspector } from "./mesh-tool-inspector";
import { WorkspacePanel } from "./panel-frame";

export function InspectorPanel() {
  const session = useEditorSession();
  const { inspector } = session;
  const activeTool = useEditorUiStore((state) => state.activeTool);

  return (
    <WorkspacePanel overline="Context" title="Inspector">
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto p-3">
        {activeTool === "mesh" ? (
          <MeshToolInspector />
        ) : inspector.kind === "Part" ? (
          <PartContainerInspector inspector={inspector} />
        ) : inspector.kind === "Drawable" ? (
          <DrawableInspector inspector={inspector} />
        ) : (
          <ProjectInspector inspector={inspector} />
        )}
      </div>
    </WorkspacePanel>
  );
}

function ProjectInspector({ inspector }: { readonly inspector: ProjectInspectorProjection }) {
  return (
    <>
      <InspectorHeader title={inspector.title} />
      <section className="rounded-md border border-neutral-800 bg-neutral-950/40 p-3">
        <h3 className="text-xs font-semibold uppercase text-neutral-500">Selection</h3>
        <div className="mt-2 divide-y divide-neutral-800">
          <SummaryRow label="Kind" testId="inspector-selection-kind" value={inspector.kind} />
          {inspector.rows.map((row) => (
            <SummaryRow key={row.label} label={row.label} value={row.value} />
          ))}
        </div>
      </section>
    </>
  );
}

function PartContainerInspector({
  inspector
}: {
  readonly inspector: PartInspectorProjection;
}) {
  const { togglePartEditorVisibility, updatePartName } = useEditorSession();
  const [name, setName] = useState(inspector.displayName);

  useEffect(() => {
    setName(inspector.displayName);
  }, [inspector.displayName, inspector.partId]);

  const commitName = () => {
    updatePartName(inspector.partId, name);
  };

  return (
    <>
      <InspectorHeader title={inspector.title} />
      <section className="rounded-md border border-neutral-800 bg-neutral-950/40 p-3">
        <h3 className="text-xs font-semibold uppercase text-neutral-500">Part Container</h3>
        <div className="mt-3 flex flex-col gap-3">
          <LabeledInput
            label="Name"
            value={name}
            onBlur={commitName}
            onChange={setName}
            onEnter={commitName}
          />
          <button
            aria-label={
              inspector.editorHidden
                ? "Show selected part container"
                : "Hide selected part container"
            }
            className={cn(
              "flex min-h-8 items-center justify-between rounded border px-2 text-xs font-medium transition",
              inspector.editorHidden
                ? "border-neutral-700 bg-neutral-900 text-neutral-300"
                : "border-teal-800/70 bg-teal-950/25 text-teal-100"
            )}
            disabled={!inspector.canToggleVisibility}
            onClick={() => togglePartEditorVisibility(inspector.partId)}
            type="button"
          >
            <span className="flex items-center gap-2">
              {inspector.effectiveHidden ? (
                <EyeOff aria-hidden="true" size={14} strokeWidth={1.8} />
              ) : (
                <Eye aria-hidden="true" size={14} strokeWidth={1.8} />
              )}
              Editor visibility
            </span>
            <span>{inspector.editorHidden ? "Hidden" : "Visible"}</span>
          </button>
          <div className="divide-y divide-neutral-800">
            <SummaryRow label="Kind" testId="inspector-selection-kind" value={inspector.kind} />
            <SummaryRow label="Parent" value={inspector.parentLabel} />
            <SummaryRow
              label="Effective"
              value={inspector.effectiveHidden ? "Hidden" : "Visible"}
            />
          </div>
        </div>
      </section>
    </>
  );
}

function DrawableInspector({
  inspector
}: {
  readonly inspector: DrawableInspectorProjection;
}) {
  const {
    setDrawableMaskSource,
    setDrawableRuntimeVisibility,
    updateDrawableName,
    updateDrawableOpacity
  } = useEditorSession();
  const [name, setName] = useState(inspector.displayName);
  const [opacityPercent, setOpacityPercent] = useState(() =>
    String(Math.round(inspector.defaultOpacity * 100))
  );
  const clippingValue = inspector.maskSourceDrawableId ?? "";

  useEffect(() => {
    setName(inspector.displayName);
  }, [inspector.displayName, inspector.drawableId]);

  useEffect(() => {
    setOpacityPercent(String(Math.round(inspector.defaultOpacity * 100)));
  }, [inspector.defaultOpacity, inspector.drawableId]);

  const commitName = () => {
    updateDrawableName(inspector.drawableId, name);
  };
  const commitOpacity = (value: string) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      setOpacityPercent(String(Math.round(inspector.defaultOpacity * 100)));
      return;
    }

    const clampedPercent = Math.min(Math.max(Math.round(numeric), 0), 100);
    setOpacityPercent(String(clampedPercent));
    updateDrawableOpacity(inspector.drawableId, clampedPercent / 100);
  };

  const clippingOptions = useMemo(
    () =>
      inspector.clippingOptions.map((option) => (
        <option key={option.drawableId} value={option.drawableId}>
          {option.displayName}
        </option>
      )),
    [inspector.clippingOptions]
  );

  return (
    <>
      <InspectorHeader title={inspector.title} />
      <section className="rounded-md border border-neutral-800 bg-neutral-950/40 p-3">
        <h3 className="text-xs font-semibold uppercase text-neutral-500">Drawable</h3>
        <div className="mt-3 flex flex-col gap-3">
          <LabeledInput
            label="Name"
            value={name}
            onBlur={commitName}
            onChange={setName}
            onEnter={commitName}
          />
          <button
            aria-label={inspector.runtimeVisible ? "Hide selected drawable" : "Show selected drawable"}
            className={cn(
              "flex min-h-8 items-center justify-between rounded border px-2 text-xs font-medium transition",
              inspector.runtimeVisible
                ? "border-teal-800/70 bg-teal-950/25 text-teal-100"
                : "border-neutral-700 bg-neutral-900 text-neutral-300"
            )}
            onClick={() =>
              setDrawableRuntimeVisibility(inspector.drawableId, !inspector.runtimeVisible)
            }
            type="button"
          >
            <span className="flex items-center gap-2">
              {inspector.runtimeVisible ? (
                <Eye aria-hidden="true" size={14} strokeWidth={1.8} />
              ) : (
                <EyeOff aria-hidden="true" size={14} strokeWidth={1.8} />
              )}
              Runtime visibility
            </span>
            <span>{inspector.runtimeVisible ? "Visible" : "Hidden"}</span>
          </button>
          <div className="grid grid-cols-[1fr_4.5rem] gap-2">
            <label className="flex min-w-0 flex-col gap-1 text-xs text-neutral-500">
              Opacity
              <input
                aria-label="Opacity"
                className="h-2 accent-teal-400"
                max={100}
                min={0}
                onChange={(event) => commitOpacity(event.currentTarget.value)}
                type="range"
                value={opacityPercent}
              />
            </label>
            <input
              aria-label="Opacity percent"
              className="h-8 rounded border border-neutral-800 bg-neutral-950 px-2 text-right text-xs text-neutral-100 outline-none focus:border-teal-500"
              max={100}
              min={0}
              onBlur={(event) => commitOpacity(event.currentTarget.value)}
              onChange={(event) => setOpacityPercent(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.currentTarget.blur();
                }
              }}
              type="number"
              value={opacityPercent}
            />
          </div>
        </div>
      </section>

      <section className="rounded-md border border-neutral-800 bg-neutral-950/40 p-3">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase text-neutral-500">
          <Scissors aria-hidden="true" size={13} strokeWidth={1.8} />
          Clipping
        </div>
        <select
          aria-label="Clipping source"
          className="mt-3 h-8 w-full rounded border border-neutral-800 bg-neutral-950 px-2 text-xs text-neutral-100 outline-none focus:border-teal-500"
          onChange={(event) =>
            setDrawableMaskSource(
              inspector.drawableId,
              event.currentTarget.value === ""
                ? null
                : (event.currentTarget.value as DrawableId)
            )
          }
          value={clippingValue}
        >
          <option value="">None</option>
          {clippingOptions}
        </select>
      </section>

      <section className="rounded-md border border-neutral-800 bg-neutral-950/40 p-3">
        <h3 className="text-xs font-semibold uppercase text-neutral-500">Source</h3>
        <div className="mt-2 divide-y divide-neutral-800">
          <SummaryRow label="Kind" testId="inspector-selection-kind" value={inspector.kind} />
          <SummaryRow label="Part" value={inspector.partLabel} />
          <SummaryRow
            label="Effective"
            value={inspector.effectiveVisible ? "Visible" : "Hidden"}
          />
          <SummaryRow label="Source" value={inspector.sourceSummary} />
          <SummaryRow label="Texture" value={inspector.textureSummary} />
          <SummaryRow label="Mesh" value={inspector.meshSummary} />
        </div>
      </section>
    </>
  );
}

function InspectorHeader({ title }: { readonly title: string }) {
  return (
    <div className="rounded-md border border-neutral-800 bg-neutral-950/50 p-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-neutral-100">
        <SlidersHorizontal aria-hidden="true" size={16} strokeWidth={1.8} />
        <span className="min-w-0 truncate">{title}</span>
      </div>
    </div>
  );
}

function LabeledInput({
  label,
  onBlur,
  onChange,
  onEnter,
  value
}: {
  readonly label: string;
  readonly onBlur: () => void;
  readonly onChange: (value: string) => void;
  readonly onEnter: () => void;
  readonly value: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs text-neutral-500">
      {label}
      <input
        aria-label={label}
        className="h-8 rounded border border-neutral-800 bg-neutral-950 px-2 text-xs text-neutral-100 outline-none focus:border-teal-500"
        onBlur={onBlur}
        onChange={(event) => onChange(event.currentTarget.value)}
        onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
          if (event.key === "Enter") {
            onEnter();
            event.currentTarget.blur();
          }
        }}
        value={value}
      />
    </label>
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
