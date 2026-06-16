import {
  AlertCircle,
  ChevronDown,
  ChevronRight,
  GitBranch,
  KeyRound,
  Layers,
  Link2,
  RotateCcw,
  Spline
} from "lucide-react";
import { useMemo, useState, type DragEvent } from "react";

import type { DrawableId, RigControlId } from "@private-2d-rigging-lab/contracts";

import { useEditorSession } from "../../features/editor-session/editor-session-context";
import { cn } from "../../lib/class-name";

const DEFORMER_TREE_DRAG_TYPE = "application/x-private-2d-deformer-tree-row";

type DeformerDragPayload =
  | {
      readonly kind: "poolDrawable";
      readonly drawableId: DrawableId;
    }
  | {
      readonly kind: "boundDrawable";
      readonly drawableId: DrawableId;
      readonly sourceRigControlId: RigControlId;
    }
  | {
      readonly kind: "rigControl";
      readonly rigControlId: RigControlId;
    };

export function DeformerTreeView() {
  const {
    bindDrawableToRigControl,
    deformerRows,
    drawablePoolItems,
    moveDrawableRigControlBinding,
    reparentRigControl,
    rigDraft,
    rigOperationFeedback,
    selectDrawable,
    selectRigControl
  } = useEditorSession();
  const [poolCollapsed, setPoolCollapsed] = useState(true);
  const [dragging, setDragging] = useState<DeformerDragPayload | null>(null);
  const [dropTargetId, setDropTargetId] = useState<RigControlId | null>(null);
  const [localFeedback, setLocalFeedback] = useState<string | null>(null);
  const parentByRigControlId = useMemo(() => createParentMap(deformerRows), [deformerRows]);
  const hasDeformerRows = deformerRows.some((row) => row.kind !== "drawableRef");
  const feedback = localFeedback ?? rigOperationFeedback;

  const handleDropOnDeformer = (
    event: DragEvent<HTMLElement>,
    targetRigControlId: RigControlId
  ) => {
    event.preventDefault();
    event.stopPropagation();
    const payload = readDragPayload(event, dragging);
    setDragging(null);
    setDropTargetId(null);

    if (!canDropOnDeformer(payload, targetRigControlId, parentByRigControlId)) {
      setLocalFeedback("Drop was ignored because it would create an invalid binding.");
      return;
    }

    setLocalFeedback(null);
    if (payload.kind === "poolDrawable") {
      bindDrawableToRigControl(payload.drawableId, targetRigControlId);
      return;
    }
    if (payload.kind === "boundDrawable") {
      moveDrawableRigControlBinding(payload.drawableId, targetRigControlId);
      return;
    }

    reparentRigControl(payload.rigControlId, targetRigControlId);
  };

  const handleDragOverDeformer = (
    event: DragEvent<HTMLElement>,
    targetRigControlId: RigControlId
  ) => {
    const payload = readDragPayload(event, dragging);
    event.preventDefault();
    event.dataTransfer.dropEffect = canDropOnDeformer(payload, targetRigControlId, parentByRigControlId)
      ? "move"
      : "none";
    setDropTargetId(targetRigControlId);
  };

  return (
    <div
      className="flex min-h-0 flex-1 flex-col gap-1 overflow-auto p-2"
      data-testid="deformer-tree"
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setDropTargetId(null);
        }
      }}
      role="tree"
    >
      {rigDraft === null ? null : (
        <div
          className="mb-1 rounded-md border border-amber-500/60 bg-amber-950/20 px-2 py-2 text-xs text-amber-100"
          data-testid="deformer-tree-draft-summary"
        >
          <div className="flex items-center gap-2 font-semibold">
            <Spline aria-hidden="true" size={14} strokeWidth={1.8} />
            Draft Warp Deformer
          </div>
          <div className="mt-1 text-amber-100/80">{rigDraft.displayName}</div>
        </div>
      )}
      {!hasDeformerRows ? (
        <div
          className="rounded-md border border-neutral-800 bg-neutral-950/45 p-3 text-xs text-neutral-400"
          data-testid="deformer-tree-empty"
        >
          No Deformers
        </div>
      ) : (
        deformerRows.map((row) =>
          row.kind === "drawableRef" ? (
            <button
              className={cn(
                "grid min-h-8 grid-cols-[auto_minmax(0,1fr)] items-center gap-2 rounded-md border border-neutral-800 bg-neutral-950/30 px-2 py-1 text-left transition hover:border-neutral-700",
                row.selected ? "border-amber-500/80 bg-amber-950/25" : ""
              )}
              data-row-kind="bound-drawable-ref"
              data-row-id={row.drawableId}
              data-parent-rig-control-id={row.parentRigControlId}
              data-testid="deformer-tree-drawable-ref"
              draggable
              key={`drawable-ref:${row.parentRigControlId}:${row.drawableId}`}
              onClick={() => selectDrawable(row.drawableId)}
              onDragEnd={() => setDragging(null)}
              onDragStart={(event) =>
                startDrag(event, setDragging, {
                  kind: "boundDrawable",
                  drawableId: row.drawableId,
                  sourceRigControlId: row.parentRigControlId
                })
              }
              role="treeitem"
              style={{ marginLeft: `${row.depth * 14}px` }}
              title={`${row.displayName} - ${row.detail}`}
              type="button"
            >
              <span className="flex size-5 shrink-0 items-center justify-center text-neutral-500">
                <Link2 aria-hidden="true" size={13} strokeWidth={1.8} />
              </span>
              <span className="flex min-w-0 items-center gap-2">
                <Layers
                  aria-hidden="true"
                  className="shrink-0 text-amber-300/80"
                  size={13}
                  strokeWidth={1.8}
                />
                <span className="truncate text-sm font-medium text-neutral-300">
                  {row.displayName}
                </span>
              </span>
            </button>
          ) : (
            <button
              className={cn(
                "grid min-h-8 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-md border px-2 py-1 text-left transition",
                row.selected
                  ? "border-teal-500/80 bg-teal-950/35"
                  : "border-neutral-800 bg-neutral-950/45 hover:border-neutral-700",
                dropTargetId === row.rigControlId ? "border-amber-400/80 bg-amber-950/25" : ""
              )}
              data-row-kind={row.kind === "warpDeformer" ? "warp-deformer" : "rotation-deformer"}
              data-row-id={row.rigControlId}
              data-keyform-key-count={row.keyformKeyCount}
              data-keyform-set-count={row.keyformSetCount}
              data-parent-rig-control-id={row.parentRigControlId}
              data-testid={row.selected ? "deformer-tree-selected-row" : "deformer-tree-row"}
              draggable
              key={`deformer:${row.rigControlId}`}
              onClick={() => selectRigControl(row.rigControlId)}
              onDragEnd={() => {
                setDragging(null);
                setDropTargetId(null);
              }}
              onDragOver={(event) => handleDragOverDeformer(event, row.rigControlId)}
              onDragStart={(event) =>
                startDrag(event, setDragging, {
                  kind: "rigControl",
                  rigControlId: row.rigControlId
                })
              }
              onDrop={(event) => handleDropOnDeformer(event, row.rigControlId)}
              role="treeitem"
              style={{ marginLeft: `${row.depth * 14}px` }}
              title={`${row.displayName} - ${row.detail}${row.keyformKeyCount > 0 ? ` - ${row.keyformSetCount} keyed properties / ${row.keyformKeyCount} keys` : ""}`}
              type="button"
            >
              <span className="flex size-5 shrink-0 items-center justify-center text-teal-300">
                {row.kind === "warpDeformer" ? (
                  <Spline aria-hidden="true" size={14} strokeWidth={1.8} />
                ) : (
                  <RotateCcw aria-hidden="true" size={14} strokeWidth={1.8} />
                )}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-neutral-100">
                  {row.displayName}
                </span>
                <span className="mt-0.5 flex min-w-0 items-center gap-1 truncate text-[11px] text-neutral-500">
                  <GitBranch aria-hidden="true" size={11} strokeWidth={1.8} />
                  {row.transformLabel}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-1">
                {row.keyformKeyCount > 0 ? (
                  <span
                    className="inline-flex h-5 items-center gap-1 rounded border border-amber-700/70 bg-amber-950/45 px-1.5 text-[10px] font-medium uppercase text-amber-100"
                    data-keyform-key-count={row.keyformKeyCount}
                    data-keyform-set-count={row.keyformSetCount}
                    data-testid="deformer-tree-keyform-count"
                    title={`${row.keyformSetCount} keyed properties / ${row.keyformKeyCount} keys`}
                  >
                    <KeyRound aria-hidden="true" size={10} strokeWidth={1.9} />
                    Keyed {row.keyformKeyCount}
                  </span>
                ) : null}
                <span className="rounded border border-neutral-800 bg-neutral-900 px-1.5 py-0.5 text-[10px] font-medium uppercase text-neutral-400">
                  {row.childRigControlCount + row.childDrawableCount}
                </span>
              </span>
            </button>
          )
        )
      )}

      <section
        className="mt-2 rounded-md border border-neutral-800 bg-neutral-950/30"
        data-collapsed={String(poolCollapsed)}
        data-testid="deformer-tree-drawable-pool"
      >
        <button
          aria-expanded={!poolCollapsed}
          className="flex min-h-8 w-full items-center justify-between gap-2 px-2 text-left text-xs font-semibold uppercase text-neutral-500 transition hover:text-neutral-300"
          data-testid="deformer-tree-drawable-pool-toggle"
          onClick={() => setPoolCollapsed((current) => !current)}
          type="button"
        >
          <span className="flex items-center gap-2">
            {poolCollapsed ? (
              <ChevronRight aria-hidden="true" size={14} strokeWidth={1.8} />
            ) : (
              <ChevronDown aria-hidden="true" size={14} strokeWidth={1.8} />
            )}
            Drawable Pool
          </span>
          <span className="rounded border border-neutral-800 bg-neutral-900 px-1.5 py-0.5 text-[10px] text-neutral-400">
            {drawablePoolItems.length}
          </span>
        </button>
        {poolCollapsed ? null : (
          <div
            className="border-t border-neutral-800 p-1.5"
            data-testid="deformer-tree-drawable-pool-items"
          >
            {drawablePoolItems.length === 0 ? (
              <div className="rounded border border-neutral-800 bg-neutral-950/60 px-2 py-2 text-xs text-neutral-500">
                No unbound Drawables
              </div>
            ) : (
              drawablePoolItems.map((item) => (
                <button
                  className={cn(
                    "grid min-h-8 w-full grid-cols-[auto_minmax(0,1fr)] items-center gap-2 rounded border px-2 py-1 text-left transition",
                    item.selected
                      ? "border-amber-500/80 bg-amber-950/25"
                      : "border-neutral-800 bg-neutral-950/50 hover:border-neutral-700"
                  )}
                  data-row-kind="drawable-pool-item"
                  data-row-id={item.drawableId}
                  data-testid="deformer-tree-drawable-pool-row"
                  draggable
                  key={`pool:${item.drawableId}`}
                  onClick={() => selectDrawable(item.drawableId)}
                  onDragEnd={() => setDragging(null)}
                  onDragStart={(event) =>
                    startDrag(event, setDragging, {
                      kind: "poolDrawable",
                      drawableId: item.drawableId
                    })
                  }
                  type="button"
                >
                  <Layers
                    aria-hidden="true"
                    className="text-neutral-500"
                    size={13}
                    strokeWidth={1.8}
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-neutral-300">
                      {item.displayName}
                    </span>
                    <span className="block truncate text-[11px] text-neutral-600">
                      {item.partDisplayName}
                    </span>
                  </span>
                </button>
              ))
            )}
          </div>
        )}
      </section>

      {feedback === null ? null : (
        <div
          className="mt-1 flex items-start gap-2 rounded-md border border-amber-800 bg-amber-950/25 px-2 py-2 text-xs text-amber-100"
          data-testid="deformer-tree-feedback"
        >
          <AlertCircle aria-hidden="true" className="mt-0.5 shrink-0" size={13} strokeWidth={1.8} />
          <span>{feedback}</span>
        </div>
      )}
    </div>
  );
}

function startDrag(
  event: DragEvent<HTMLElement>,
  setDragging: (payload: DeformerDragPayload) => void,
  payload: DeformerDragPayload
): void {
  setDragging(payload);
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData(DEFORMER_TREE_DRAG_TYPE, JSON.stringify(payload));
}

function readDragPayload(
  event: DragEvent<HTMLElement>,
  fallback: DeformerDragPayload | null
): DeformerDragPayload | null {
  const raw = event.dataTransfer.getData(DEFORMER_TREE_DRAG_TYPE);
  if (raw.length === 0) {
    return fallback;
  }

  try {
    return parseDragPayload(JSON.parse(raw)) ?? fallback;
  } catch {
    return fallback;
  }
}

function parseDragPayload(value: unknown): DeformerDragPayload | null {
  if (typeof value !== "object" || value === null || !("kind" in value)) {
    return null;
  }

  const payload = value as {
    readonly kind?: unknown;
    readonly drawableId?: unknown;
    readonly sourceRigControlId?: unknown;
    readonly rigControlId?: unknown;
  };
  if (payload.kind === "poolDrawable" && typeof payload.drawableId === "string") {
    return { kind: "poolDrawable", drawableId: payload.drawableId as DrawableId };
  }
  if (
    payload.kind === "boundDrawable" &&
    typeof payload.drawableId === "string" &&
    typeof payload.sourceRigControlId === "string"
  ) {
    return {
      kind: "boundDrawable",
      drawableId: payload.drawableId as DrawableId,
      sourceRigControlId: payload.sourceRigControlId as RigControlId
    };
  }
  if (payload.kind === "rigControl" && typeof payload.rigControlId === "string") {
    return { kind: "rigControl", rigControlId: payload.rigControlId as RigControlId };
  }

  return null;
}

function canDropOnDeformer(
  payload: DeformerDragPayload | null,
  targetRigControlId: RigControlId,
  parentByRigControlId: ReadonlyMap<RigControlId, RigControlId | undefined>
): payload is DeformerDragPayload {
  if (payload === null) {
    return false;
  }

  if (payload.kind === "poolDrawable") {
    return true;
  }
  if (payload.kind === "boundDrawable") {
    return payload.sourceRigControlId !== targetRigControlId;
  }

  return (
    payload.rigControlId !== targetRigControlId &&
    !wouldCreateParentCycle(parentByRigControlId, payload.rigControlId, targetRigControlId)
  );
}

function createParentMap(
  rows: ReturnType<typeof useEditorSession>["deformerRows"]
): ReadonlyMap<RigControlId, RigControlId | undefined> {
  const result = new Map<RigControlId, RigControlId | undefined>();
  for (const row of rows) {
    if (row.kind !== "drawableRef") {
      result.set(row.rigControlId, row.parentRigControlId);
    }
  }
  return result;
}

function wouldCreateParentCycle(
  parentByRigControlId: ReadonlyMap<RigControlId, RigControlId | undefined>,
  childRigControlId: RigControlId,
  targetRigControlId: RigControlId
): boolean {
  let current: RigControlId | undefined = targetRigControlId;
  while (current !== undefined) {
    if (current === childRigControlId) {
      return true;
    }
    current = parentByRigControlId.get(current);
  }

  return false;
}
