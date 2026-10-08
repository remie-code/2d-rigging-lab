import {
  Eye,
  FileInput,
  FolderOutput,
  LayoutGrid,
  MousePointer2,
  ShieldCheck,
  SlidersHorizontal,
  Smile,
  Spline,
  Triangle,
  Waves,
  type LucideIcon
} from "lucide-react";

import type { WorkspaceEntryId, WorkspaceToolId } from "../state/editor-ui-store";

export type WorkspaceTaskActionId = "import";

export type ToolboxItem = {
  id: WorkspaceToolId | WorkspaceEntryId | WorkspaceTaskActionId;
  label: string;
  kind: "tool" | "task" | "view";
  icon: LucideIcon;
};

export type ToolboxSection = {
  label: string;
  items: ToolboxItem[];
};

export const toolboxSections: ToolboxSection[] = [
  {
    label: "Tools",
    items: [
      { id: "select", label: "Select", kind: "tool", icon: MousePointer2 },
      { id: "mesh", label: "Mesh", kind: "tool", icon: Triangle },
      { id: "rig", label: "Rig", kind: "tool", icon: Spline },
      { id: "dynamics", label: "Dynamics", kind: "tool", icon: Waves }
    ]
  },
  {
    label: "Tasks",
    items: [
      { id: "import", label: "Import PSD", kind: "task", icon: FileInput },
      { id: "parameters", label: "Parameters", kind: "task", icon: SlidersHorizontal },
      { id: "variants", label: "Variants", kind: "task", icon: Smile },
      { id: "atlas", label: "Texture Atlas", kind: "task", icon: LayoutGrid },
      { id: "runtimeExport", label: "Runtime Export", kind: "task", icon: FolderOutput },
      { id: "validate", label: "Validate", kind: "task", icon: ShieldCheck }
    ]
  },
  {
    label: "Views",
    items: [{ id: "viewer", label: "Viewer", kind: "view", icon: Eye }]
  }
];

export const taskEntries = toolboxSections.flatMap((section) =>
  section.items.filter((item) => item.kind === "task" || item.kind === "view")
);

export const structureRows = [
  { depth: 0, name: "Project Root", detail: "empty", tone: "neutral" },
  { depth: 1, name: "Part Container", detail: "awaiting artwork", tone: "teal" },
  { depth: 2, name: "Drawable Layer", detail: "not loaded", tone: "amber" },
  { depth: 1, name: "Hidden Set", detail: "none", tone: "neutral" }
] as const;

export const inspectorSections = [
  {
    title: "Selection",
    rows: [
      ["Target", "None"],
      ["Visibility", "Ready"],
      ["Opacity", "100%"]
    ]
  },
  {
    title: "Drawable",
    rows: [
      ["Order", "Pending"],
      ["Clipping", "Unset"],
      ["Mesh", "Not created"]
    ]
  },
  {
    title: "Context",
    rows: [
      ["Texture", "Unassigned"],
      ["Source", "No artwork loaded"]
    ]
  }
] as const;
