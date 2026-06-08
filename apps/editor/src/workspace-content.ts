export type ToolboxEntryKind = "tool" | "task" | "view";

export type ToolboxEntry = {
  readonly label: string;
  readonly kind: ToolboxEntryKind;
  readonly target: string;
  readonly state?: "active" | "planned";
};

export type ToolboxSection = {
  readonly label: string;
  readonly entries: readonly ToolboxEntry[];
};

export type StructureRow = {
  readonly name: string;
  readonly detail: string;
  readonly tone?: "muted";
};

export const appBarActions = [
  "Open",
  "Save",
  "Export",
  "Viewer",
] as const;

export const toolboxSections: readonly ToolboxSection[] = [
  {
    label: "Tools",
    entries: [
      {
        label: "Select",
        kind: "tool",
        target: "Canvas and structure selection",
        state: "active",
      },
      {
        label: "Mesh",
        kind: "tool",
        target: "Mesh workspace controls",
        state: "planned",
      },
      {
        label: "Rig",
        kind: "tool",
        target: "Rig workspace controls",
        state: "planned",
      },
      {
        label: "Dynamics",
        kind: "tool",
        target: "Dynamics workspace controls",
        state: "planned",
      },
    ],
  },
  {
    label: "Tasks",
    entries: [
      {
        label: "PSD Import",
        kind: "task",
        target: "Workspace task window",
        state: "planned",
      },
      {
        label: "Parameter",
        kind: "task",
        target: "Parameter manager",
        state: "planned",
      },
      {
        label: "Variant",
        kind: "task",
        target: "Variant manager",
        state: "planned",
      },
      {
        label: "Atlas",
        kind: "task",
        target: "Texture atlas task",
        state: "planned",
      },
    ],
  },
  {
    label: "Views",
    entries: [
      {
        label: "Viewer",
        kind: "view",
        target: "Dedicated preview view",
        state: "planned",
      },
      {
        label: "Preflight",
        kind: "view",
        target: "Project readiness view",
        state: "planned",
      },
    ],
  },
];

export const structureRows: readonly StructureRow[] = [
  {
    name: "Project Root",
    detail: "Empty project",
  },
  {
    name: "Parts",
    detail: "Part containers will appear here",
    tone: "muted",
  },
  {
    name: "Drawables",
    detail: "Imported layers will appear here",
    tone: "muted",
  },
  {
    name: "Hidden",
    detail: "Runtime-hidden items will appear here",
    tone: "muted",
  },
];

export const inspectorFields = [
  ["Selection", "None"],
  ["Mode", "Authoring"],
  ["Target", "Choose a part or drawable"],
] as const;

export const parameterTicks = [
  "ParamAngleX",
  "ParamAngleY",
  "ParamBody",
] as const;

export const statusItems = [
  "Ready",
  "Empty project",
  "Choose PSD Import or Open to begin",
] as const;
