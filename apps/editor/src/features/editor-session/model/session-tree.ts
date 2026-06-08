import type { AuthoringSession } from "@private-2d-rigging-lab/authoring-core";
import type { DrawableId, PartId } from "@private-2d-rigging-lab/contracts";

import type { EditorSelection } from "./editor-selection";
import { ROOT_PART_ID } from "./empty-authoring-session";

interface StructureTreeRowBase {
  readonly depth: number;
  readonly name: string;
  readonly detail: string;
  readonly tone: "amber" | "neutral" | "teal";
  readonly selected: boolean;
  readonly hidden: boolean;
}

export type StructureTreeRow =
  | (StructureTreeRowBase & {
      readonly id: PartId;
      readonly kind: "part";
    })
  | (StructureTreeRowBase & {
      readonly id: DrawableId;
      readonly kind: "drawable";
    });

export interface InspectorProjection {
  readonly title: string;
  readonly kind: "Project" | "Part" | "Drawable";
  readonly rows: readonly {
    readonly label: string;
    readonly value: string;
  }[];
}

type ModelPart = AuthoringSession["graph"]["parts"][number];
type Drawable = AuthoringSession["graph"]["drawables"][number];

export function createStructureTreeRows(
  session: AuthoringSession,
  selection: EditorSelection | null
): readonly StructureTreeRow[] {
  const partsById = new Map(session.graph.parts.map((part) => [part.partId, part]));
  const drawablesById = new Map(
    session.graph.drawables.map((drawable) => [drawable.drawableId, drawable])
  );
  const roots = session.graph.parts.filter((part) => part.parentPartId === undefined);
  const rootParts = roots.length > 0 ? roots : [partsById.get(ROOT_PART_ID)].filter(isDefined);
  const rows: StructureTreeRow[] = [];
  const visitedParts = new Set<string>();

  const appendPart = (part: ModelPart, depth: number) => {
    if (visitedParts.has(part.partId)) {
      return;
    }

    visitedParts.add(part.partId);
    rows.push({
      id: part.partId,
      kind: "part",
      depth,
      name: part.displayName,
      detail: part.partId === ROOT_PART_ID ? "project root" : "Part Container",
      tone: part.partId === ROOT_PART_ID ? "neutral" : "teal",
      selected: selection?.kind === "part" && selection.id === part.partId,
      hidden: false
    });

    for (const childPartId of part.childPartIds) {
      const childPart = partsById.get(childPartId);
      if (childPart !== undefined) {
        appendPart(childPart, depth + 1);
      }
    }

    for (const drawableId of part.drawableIds) {
      const drawable = drawablesById.get(drawableId);
      if (drawable !== undefined) {
        appendDrawable(drawable, depth + 1);
      }
    }
  };

  const appendDrawable = (drawable: Drawable, depth: number) => {
    rows.push({
      id: drawable.drawableId,
      kind: "drawable",
      depth,
      name: drawable.displayName,
      detail: drawable.runtimeVisibility ? "Drawable" : "Hidden Drawable",
      tone: drawable.runtimeVisibility ? "amber" : "neutral",
      selected: selection?.kind === "drawable" && selection.id === drawable.drawableId,
      hidden: !drawable.runtimeVisibility
    });
  };

  for (const rootPart of rootParts) {
    appendPart(rootPart, 0);
  }

  return rows;
}

export function createInspectorProjection(
  session: AuthoringSession,
  selection: EditorSelection | null
): InspectorProjection {
  if (selection?.kind === "part") {
    const part = findPart(session, selection.id);
    if (part !== undefined) {
      return {
        title: part.displayName,
        kind: "Part",
        rows: [
          { label: "Target", value: "Part" },
          { label: "Children", value: String(part.childPartIds.length) },
          { label: "Drawables", value: String(part.drawableIds.length) },
          { label: "Parent", value: resolveParentLabel(session, part) }
        ]
      };
    }
  }

  if (selection?.kind === "drawable") {
    const drawable = findDrawable(session, selection.id);
    if (drawable !== undefined) {
      return {
        title: drawable.displayName,
        kind: "Drawable",
        rows: [
          { label: "Target", value: "Drawable" },
          { label: "Visibility", value: drawable.runtimeVisibility ? "Visible" : "Hidden" },
          { label: "Opacity", value: `${Math.round(drawable.defaultOpacity * 100)}%` },
          { label: "Part", value: findPart(session, drawable.partId)?.displayName ?? "Missing part" },
          { label: "Geometry", value: "Mesh ready" },
          { label: "Texture", value: "Texture linked" },
          { label: "Source", value: "PSD layer" }
        ]
      };
    }
  }

  return {
    title: session.packageIdentity.packageDisplayName,
    kind: "Project",
    rows: [
      { label: "Target", value: "Project" },
      { label: "Parts", value: String(session.graph.parts.length) },
      { label: "Drawables", value: String(session.graph.drawables.length) },
      { label: "Revision", value: String(session.packageRevision) }
    ]
  };
}

export function resolveDestinationPart(
  session: AuthoringSession,
  selection: EditorSelection | null
): ModelPart {
  if (selection?.kind === "part") {
    const selectedPart = findPart(session, selection.id);
    if (selectedPart !== undefined) {
      return selectedPart;
    }
  }

  if (selection?.kind === "drawable") {
    const drawable = findDrawable(session, selection.id);
    const parentPart = drawable === undefined ? undefined : findPart(session, drawable.partId);
    if (parentPart !== undefined) {
      return parentPart;
    }
  }

  return findPart(session, ROOT_PART_ID) ?? session.graph.parts[0]!;
}

export function findPart(session: AuthoringSession, partId: PartId): ModelPart | undefined {
  return session.graph.parts.find((part) => part.partId === partId);
}

export function findDrawable(
  session: AuthoringSession,
  drawableId: DrawableId
): Drawable | undefined {
  return session.graph.drawables.find((drawable) => drawable.drawableId === drawableId);
}

function resolveParentLabel(session: AuthoringSession, part: ModelPart): string {
  if (part.parentPartId === undefined) {
    return "None";
  }

  return findPart(session, part.parentPartId)?.displayName ?? "Missing part";
}

function isDefined<TValue>(value: TValue | undefined): value is TValue {
  return value !== undefined;
}
