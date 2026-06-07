import { applyShellSurfaceMetadata, shellSurfaces } from "./shell-surfaces.js";

type CodexAutomationSectionId =
  | "proposal-review"
  | "ai-approval"
  | "ai-transcript"
  | "command-surface-status"
  | "psd-structural-scaffold-availability";

interface CodexAutomationSection {
  readonly id: CodexAutomationSectionId;
  readonly label: string;
  readonly status: string;
  readonly items: readonly string[];
}

const sectionHeadingIdPrefix = "codex-automation-view-skeleton";

const codexAutomationSections: readonly CodexAutomationSection[] = [
  {
    id: "proposal-review",
    label: "Proposal Review",
    status: "Read-only future home for externally supplied proposal review.",
    items: [
      "Deterministic repository surfaces may validate, dry-run, diff, require approval, record transcript, attach evidence, and report status for supplied operations.",
      "Repo/Editor-side proposal generation unavailable; intelligence, planning, proposal composition, and repair reasoning belong to external Codex/LLMs.",
      "No proposal composer, proposal generator, ranking, smart suggestion control, or command execution control is present in this skeleton."
    ]
  },
  {
    id: "ai-approval",
    label: "AI Approval",
    status: "Approval state is explicit, deterministic, and approval-gated.",
    items: [
      "Approval can summarize validation, dry-run, diff, and approved commit status after exact targets and parameters are supplied.",
      "Auto-fix blocked; the Editor does not infer repairs, generate repair candidates, or rank proposal alternatives.",
      "Auto-commit blocked; commit remains explicit and approval-gated rather than autonomous."
    ]
  },
  {
    id: "ai-transcript",
    label: "AI Transcript",
    status: "Transcript placement only; no provider workflow is embedded.",
    items: [
      "Transcript entries may show submitted commands, validation, dry-run, diff, approval, commit, evidence, and status events.",
      "Embedded provider/LLM unavailable; prompts, provider configuration, model sessions, and natural-language interpretation stay outside the Editor.",
      "This skeleton does not add prompt input, model selection, provider settings, or transport setup."
    ]
  },
  {
    id: "command-surface-status",
    label: "Command Surface Status",
    status: "Structured command availability is status-only in this skeleton.",
    items: [
      "The Editor exposes deterministic operation APIs, schemas, stable refs, validation, dry-run, diff, approval, transcript, evidence, and machine-readable status.",
      "Semantic recognition blocked; the Editor does not infer eye, hair, mouth, expression, clothing, or rigging role from names or pixels.",
      "Auto-rigging blocked; deformer, parameter, keyform, warp lattice, physics, mask, and rig hierarchy behavior must not be inferred automatically.",
      "External HTTP/WebSocket/MCP transport unavailable; the current repository boundary remains the in-process command host and operation API surface."
    ]
  },
  {
    id: "psd-structural-scaffold-availability",
    label: "PSD Import / Structural Scaffold Command Availability",
    status: "Availability summary for deterministic PSD command surfaces.",
    items: [
      "PSD parse, import plan, approved refs, preview or dry-run, approval, commit, latest result, evidence, and status may be listed as command availability.",
      "Structural scaffold expansion is deterministic copying from explicit PSD tree refs, approved groups, or approved leaves.",
      "Semantic PSD recognition, automatic layer classification, smart recursive import, and automatic rig placement remain blocked."
    ]
  }
];

const unavailablePolicyItems: readonly string[] = [
  "Repo/Editor-side proposal generation unavailable.",
  "Semantic recognition blocked.",
  "Auto-rigging blocked.",
  "Auto-fix blocked.",
  "Auto-commit blocked.",
  "Embedded provider/LLM unavailable.",
  "External HTTP/WebSocket/MCP transport unavailable."
];

export const createCodexAutomationViewSkeleton = (): HTMLElement => {
  const surface = document.createElement("section");
  surface.className = "codex-automation-view-skeleton";
  surface.setAttribute("aria-labelledby", `${sectionHeadingIdPrefix}-title`);
  surface.setAttribute("aria-describedby", `${sectionHeadingIdPrefix}-status`);
  surface.dataset.codexAutomationSkeleton = "true";
  applyShellSurfaceMetadata(surface, shellSurfaces.codexAutomationView, {
    group: "codex-automation-skeleton"
  });

  const header = document.createElement("header");
  header.className = "codex-automation-view-skeleton__header";

  const heading = document.createElement("h2");
  heading.id = `${sectionHeadingIdPrefix}-title`;
  heading.textContent = "Codex / Automation";

  const status = document.createElement("p");
  status.id = `${sectionHeadingIdPrefix}-status`;
  status.className = "codex-automation-view-skeleton__status";
  status.textContent =
    "Bounded read-only skeleton for external Codex proposal review, explicit approval, transcript, and deterministic command-surface status.";

  header.append(heading, status);

  const body = document.createElement("div");
  body.className = "codex-automation-view-skeleton__body";
  body.append(createSectionMap(), createPolicyBoundary(), createSectionList());

  surface.append(header, body);

  return surface;
};

const createSectionMap = (): HTMLElement => {
  const map = document.createElement("aside");
  map.className = "codex-automation-view-skeleton__section-map";
  map.setAttribute("aria-label", "Codex automation skeleton sections");

  const list = document.createElement("ol");
  for (const section of codexAutomationSections) {
    const item = document.createElement("li");
    item.dataset.codexAutomationSectionRef = section.id;
    item.textContent = section.label;
    list.append(item);
  }

  map.append(list);

  return map;
};

const createPolicyBoundary = (): HTMLElement => {
  const boundary = document.createElement("section");
  boundary.className = "codex-automation-view-skeleton__policy-boundary";
  boundary.setAttribute("aria-labelledby", `${sectionHeadingIdPrefix}-policy-boundary`);
  boundary.dataset.codexAutomationSection = "policy-boundary";

  const heading = document.createElement("h3");
  heading.id = `${sectionHeadingIdPrefix}-policy-boundary`;
  heading.textContent = "Policy Boundary";

  const summary = document.createElement("p");
  summary.textContent =
    "Editor-side automation remains deterministic and explicit; proposal intelligence and interpretation stay outside the repository.";

  boundary.append(heading, summary, createTextList(unavailablePolicyItems));

  return boundary;
};

const createSectionList = (): HTMLElement => {
  const list = document.createElement("div");
  list.className = "codex-automation-view-skeleton__sections";

  for (const section of codexAutomationSections) {
    list.append(createAutomationSection(section));
  }

  return list;
};

const createAutomationSection = (section: CodexAutomationSection): HTMLElement => {
  const element = document.createElement("section");
  element.className = "codex-automation-view-skeleton__section";
  element.setAttribute("aria-labelledby", `${sectionHeadingIdPrefix}-${section.id}`);
  element.dataset.codexAutomationSection = section.id;

  const heading = document.createElement("h3");
  heading.id = `${sectionHeadingIdPrefix}-${section.id}`;
  heading.textContent = section.label;

  const status = document.createElement("p");
  status.className = "codex-automation-view-skeleton__section-status";
  status.textContent = section.status;

  element.append(heading, status, createTextList(section.items));

  return element;
};

const createTextList = (items: readonly string[]): HTMLElement => {
  const list = document.createElement("ul");

  for (const text of items) {
    const item = document.createElement("li");
    item.textContent = text;
    list.append(item);
  }

  return list;
};
