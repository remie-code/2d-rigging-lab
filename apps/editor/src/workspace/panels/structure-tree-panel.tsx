import {
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  Folder,
  GripVertical,
  Layers
} from "lucide-react";
import { useState, type DragEvent } from "react";
import type { DrawableId, PartId } from "@private-2d-rigging-lab/contracts";

import { useEditorSession } from "../../features/editor-session/editor-session-context";
import {
  canReparentPart,
  type StructureTreeRow
} from "../../features/editor-session/model/session-tree";
import { cn } from "../../lib/class-name";
import { WorkspacePanel } from "./panel-frame";

const TREE_ROW_DRAG_TYPE = "application/x-private-2d-parts-tree-row";

type DragPayload = {
  readonly kind: "part" | "drawable";
  readonly id: string;
};

export function StructureTreePanel() {
  const {
    reparentDrawable,
    reparentPart,
    reorderDrawable,
    selectDrawable,
    selectPart,
    session,
    structureRows,
    togglePartCollapse,
    togglePartEditorVisibility,
    setDrawableRuntimeVisibility
  } = useEditorSession();
  const [dragging, setDragging] = useState<DragPayload | null>(null);
  const [dropTargetKey, setDropTargetKey] = useState<string | null>(null);

  const selectRow = (row: StructureTreeRow) => {
    if (row.kind === "part") {
      selectPart(row.id);
      return;
    }

    selectDrawable(row.id);
  };

  return (
    <WorkspacePanel className="h-full" overline="Hierarchy" title="Parts / Structure Tree">
      <div
        className="flex min-h-0 flex-1 flex-col gap-1 overflow-auto p-2"
        data-testid="parts-tree"
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
              dropTargetKey === rowKey(row) ? "border-amber-400/80 bg-amber-950/25" : ""
            )}
            data-row-id={row.id}
            data-row-kind={row.kind}
            data-tree-order={row.kind === "drawable" ? row.order : undefined}
            data-testid={row.selected ? "parts-tree-selected-row" : "parts-tree-row"}
            draggable={row.draggable}
            key={rowKey(row)}
            onDragEnd={() => {
              setDragging(null);
              setDropTargetKey(null);
            }}
            onDragOver={(event) => {
              if (dragging !== null && canDropOnRow(session, dragging, row)) {
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
                setDropTargetKey(rowKey(row));
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
              setDragging(null);
              setDropTargetKey(null);
              if (payload === null || !canDropOnRow(session, payload, row)) {
                return;
              }

              event.preventDefault();
              if (payload.kind === "drawable" && row.kind === "drawable") {
                reorderDrawable(
                  payload.id as DrawableId,
                  row.id,
                  resolveDrawableDropPlacement(event)
                );
                return;
              }

              if (payload.kind === "drawable" && row.kind === "part") {
                reparentDrawable(payload.id as DrawableId, row.id);
                return;
              }

              if (payload.kind === "part" && row.kind === "part") {
                reparentPart(payload.id as PartId, row.id);
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
    </WorkspacePanel>
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
  row: StructureTreeRow
): boolean {
  if (payload.kind === "drawable" && row.kind === "drawable") {
    return payload.id !== row.id;
  }

  if (payload.kind === "drawable" && row.kind === "part") {
    const drawable = session.graph.drawables.find((candidate) => candidate.drawableId === payload.id);
    return drawable !== undefined && drawable.partId !== row.id;
  }

  if (payload.kind === "part" && row.kind === "part") {
    return canReparentPart(session, payload.id as PartId, row.id);
  }

  return false;
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

function resolveDrawableDropPlacement(event: DragEvent<HTMLElement>): "before" | "after" {
  const rect = event.currentTarget.getBoundingClientRect();
  return event.clientY < rect.top + rect.height / 2 ? "before" : "after";
}
