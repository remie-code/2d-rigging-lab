import {
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  Folder,
  GripVertical,
  Layers,
  Spline
} from "lucide-react";
import { useState, type DragEvent, type ReactNode } from "react";
import type { StructureOrderItem } from "@private-2d-rigging-lab/authoring-core";
import type { DrawableId, PartId } from "@private-2d-rigging-lab/contracts";

import { useEditorSession } from "../../features/editor-session/editor-session-context";
import {
  createStructureMoveDrop,
  type StructureDropPlacement,
  type StructureTreeRow
} from "../../features/editor-session/model/session-tree";
import { cn } from "../../lib/class-name";
import { DeformerTreeView } from "./deformer-tree-view";
import { WorkspacePanel } from "./panel-frame";

const TREE_ROW_DRAG_TYPE = "application/x-private-2d-parts-tree-row";
type StructurePaneView = "parts" | "deformers";

type DragPayload = {
  readonly kind: "part" | "drawable";
  readonly id: string;
};

export function StructureTreePanel() {
  const {
    moveStructureChild,
    selectDrawable,
    selectPart,
    session,
    structureRows,
    togglePartCollapse,
    togglePartEditorVisibility,
    setDrawableRuntimeVisibility
  } = useEditorSession();
  const [view, setView] = useState<StructurePaneView>("parts");
  const [dragging, setDragging] = useState<DragPayload | null>(null);
  const [dropIntent, setDropIntent] = useState<{
    readonly key: string;
    readonly placement: StructureDropPlacement;
  } | null>(null);

  const selectRow = (row: StructureTreeRow) => {
    if (row.kind === "part") {
      selectPart(row.id);
      return;
    }

    selectDrawable(row.id);
  };

  const actions = (
    <div
      aria-label="Structure view"
      className="flex rounded-md border border-neutral-800 bg-neutral-950 p-0.5"
      role="group"
    >
      <StructureViewButton
        active={view === "parts"}
        label="Parts"
        onClick={() => setView("parts")}
      >
        <Layers aria-hidden="true" size={13} strokeWidth={1.8} />
      </StructureViewButton>
      <StructureViewButton
        active={view === "deformers"}
        label="Deformers"
        onClick={() => setView("deformers")}
      >
        <Spline aria-hidden="true" size={13} strokeWidth={1.8} />
      </StructureViewButton>
    </div>
  );

  return (
    <WorkspacePanel
      actions={actions}
      className="h-full"
      overline="Hierarchy"
      title={view === "parts" ? "Parts / Structure Tree" : "Deformer Tree"}
    >
      {view === "parts" ? (
        <div
        className="flex min-h-0 flex-1 flex-col gap-1 overflow-auto p-2"
        data-testid="parts-tree"
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
            setDropIntent(null);
          }
        }}
        role="tree"
      >
        {structureRows.map((row) => (
          <div
            className={cn(
              "grid min-h-8 grid-cols-[auto_auto_auto_minmax(0,1fr)] items-center gap-1 rounded-md border px-1.5 py-1 text-left transition",
              row.selected
                ? "border-teal-500/80 bg-teal-950/35"
                : "border-neutral-800 bg-neutral-950/45 hover:border-neutral-700",
              row.effectiveHidden && !row.selected ? "opacity-55" : "",
              dropIntent?.key === rowKey(row) && dropIntent.placement === "inside"
                ? "border-amber-400/80 bg-amber-950/25"
                : "",
              dropIntent?.key === rowKey(row) && dropIntent.placement === "before"
                ? "shadow-[inset_0_2px_0_rgba(251,191,36,0.9)]"
                : "",
              dropIntent?.key === rowKey(row) && dropIntent.placement === "after"
                ? "shadow-[inset_0_-2px_0_rgba(251,191,36,0.9)]"
                : ""
            )}
            data-row-id={row.id}
            data-row-kind={row.kind}
            data-drop-placement={dropIntent?.key === rowKey(row) ? dropIntent.placement : undefined}
            data-tree-order={row.kind === "drawable" ? row.order : undefined}
            data-testid={row.selected ? "parts-tree-selected-row" : "parts-tree-row"}
            draggable={row.draggable}
            key={rowKey(row)}
            onDragEnd={() => {
              setDragging(null);
              setDropIntent(null);
            }}
            onDragOver={(event) => {
              const placement = resolveStructureDropPlacement(event, row);
              if (dragging !== null && canDropOnRow(session, dragging, row, placement)) {
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
                setDropIntent({ key: rowKey(row), placement });
                return;
              }

              setDropIntent((current) => current?.key === rowKey(row) ? null : current);
            }}
            onDragLeave={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                setDropIntent((current) => current?.key === rowKey(row) ? null : current);
              }
            }}
            onDragStart={(event) => {
              if (!row.draggable) {
                event.preventDefault();
                return;
              }

              const payload = { kind: row.kind, id: row.id } satisfies DragPayload;
              setDragging(payload);
              event.dataTransfer.effectAllowed = "move";
              event.dataTransfer.setData(TREE_ROW_DRAG_TYPE, JSON.stringify(payload));
            }}
            onDrop={(event) => {
              const payload = readDragPayload(event, dragging);
              const placement = resolveStructureDropPlacement(event, row);
              setDragging(null);
              setDropIntent(null);
              if (payload === null || !canDropOnRow(session, payload, row, placement)) {
                return;
              }

              event.preventDefault();
              const moved = toStructureOrderItem(payload);
              const move = createStructureMoveDrop(session, moved, row, placement);
              if (move !== undefined) {
                moveStructureChild(move.moved, move.drop);
              }
            }}
            role="treeitem"
            style={{ marginLeft: `${row.depth * 14}px` }}
            title={`${row.name} - ${row.detail}`}
          >
            <span className="flex size-5 items-center justify-center text-neutral-600">
              <GripVertical aria-hidden="true" size={13} strokeWidth={1.8} />
            </span>
            {row.kind === "part" && row.canCollapse ? (
              <button
                aria-label={`${row.collapsed ? "Expand" : "Collapse"} ${row.name}`}
                className="flex size-6 items-center justify-center rounded border border-neutral-800 bg-neutral-900 text-neutral-400 transition hover:border-neutral-700 hover:text-neutral-200"
                onClick={() => togglePartCollapse(row.id)}
                type="button"
              >
                {row.collapsed ? (
                  <ChevronRight aria-hidden="true" size={14} strokeWidth={1.8} />
                ) : (
                  <ChevronDown aria-hidden="true" size={14} strokeWidth={1.8} />
                )}
              </button>
            ) : (
              <span className="size-6" />
            )}
            <button
              aria-label={visibilityLabel(row)}
              className={cn(
                "flex size-6 items-center justify-center rounded border border-neutral-800 bg-neutral-900 text-neutral-400 transition",
                row.canToggleVisibility
                  ? "hover:border-neutral-700 hover:text-neutral-200"
                  : "cursor-default text-neutral-600"
              )}
              disabled={!row.canToggleVisibility}
              onClick={() => {
                if (row.kind === "part") {
                  togglePartEditorVisibility(row.id);
                  return;
                }

                setDrawableRuntimeVisibility(row.id, !row.runtimeVisible);
              }}
              type="button"
            >
              {row.kind === "part" && row.id === "part_root" ? (
                <Layers aria-hidden="true" size={14} strokeWidth={1.8} />
              ) : row.effectiveHidden ? (
                <EyeOff aria-hidden="true" size={14} strokeWidth={1.8} />
              ) : (
                <Eye aria-hidden="true" size={14} strokeWidth={1.8} />
              )}
            </button>
            <button
              className="flex min-w-0 items-center gap-2 rounded px-1 py-0.5 text-left"
              onClick={() => selectRow(row)}
              type="button"
            >
              <span className="flex size-5 shrink-0 items-center justify-center text-neutral-500">
                {row.kind === "drawable" ? (
                  <Layers aria-hidden="true" size={13} strokeWidth={1.8} />
                ) : (
                  <Folder aria-hidden="true" size={13} strokeWidth={1.8} />
                )}
              </span>
              <span
                className={cn(
                  "min-w-0 truncate text-sm font-medium",
                  row.effectiveHidden ? "text-neutral-500" : "text-neutral-100"
                )}
              >
                {row.name}
              </span>
            </button>
          </div>
        ))}
        </div>
      ) : (
        <DeformerTreeView />
      )}
    </WorkspacePanel>
  );
}

function StructureViewButton({
  active,
  children,
  label,
  onClick
}: {
  readonly active: boolean;
  readonly children: ReactNode;
  readonly label: string;
  readonly onClick: () => void;
}) {
  return (
    <button
      aria-pressed={active}
      className={cn(
        "flex h-7 items-center gap-1 rounded px-2 text-xs font-medium transition",
        active
          ? "bg-teal-950/70 text-teal-100"
          : "text-neutral-400 hover:bg-neutral-900 hover:text-neutral-100"
      )}
      onClick={onClick}
      type="button"
    >
      {children}
      <span>{label}</span>
    </button>
  );
}

function rowKey(row: StructureTreeRow): string {
  return `${row.kind}:${row.id}`;
}

function visibilityLabel(row: StructureTreeRow): string {
  if (row.kind === "part") {
    if (!row.canToggleVisibility) {
      return "Project root visibility";
    }

    return row.editorHidden ? "Show part container" : "Hide part container";
  }

  return row.runtimeVisible ? "Hide drawable" : "Show drawable";
}

function canDropOnRow(
  session: ReturnType<typeof useEditorSession>["session"],
  payload: DragPayload,
  row: StructureTreeRow,
  placement: StructureDropPlacement
): boolean {
  return createStructureMoveDrop(session, toStructureOrderItem(payload), row, placement) !== undefined;
}

function readDragPayload(
  event: DragEvent<HTMLElement>,
  fallback: DragPayload | null
): DragPayload | null {
  const raw = event.dataTransfer.getData(TREE_ROW_DRAG_TYPE);
  if (raw.length === 0) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(raw) as DragPayload;
    return parsed.kind === "part" || parsed.kind === "drawable" ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function resolveStructureDropPlacement(
  event: DragEvent<HTMLElement>,
  row: StructureTreeRow
): StructureDropPlacement {
  const rect = event.currentTarget.getBoundingClientRect();
  const ratio = (event.clientY - rect.top) / Math.max(1, rect.height);
  if (row.kind === "part") {
    if (ratio < 0.28) {
      return "before";
    }

    if (ratio > 0.72) {
      return "after";
    }

    return "inside";
  }

  return ratio < 0.5 ? "before" : "after";
}

function toStructureOrderItem(payload: DragPayload): StructureOrderItem {
  return payload.kind === "part"
    ? { kind: "part", partId: payload.id as PartId }
    : { kind: "drawable", drawableId: payload.id as DrawableId };
}
