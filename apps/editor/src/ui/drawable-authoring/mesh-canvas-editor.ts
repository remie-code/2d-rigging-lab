import {
  createMeshCanvasNudgeButtonTestId,
  createMeshCanvasVertexTestId,
  editorTestIds,
  type MeshCanvasVertexSelectionCommand,
  type MeshEditViewModel
} from "../../editor-state/index.js";

export interface MeshCanvasEditorOptions {
  readonly viewModel: MeshEditViewModel;
  readonly onSelectVertex: (command: MeshCanvasVertexSelectionCommand) => void;
  readonly onNudgeSelection: (delta: { readonly x: number; readonly y: number }) => void;
  readonly onDragSelection: (delta: { readonly x: number; readonly y: number }) => void;
}

const svgNamespace = "http://www.w3.org/2000/svg";

export const createMeshCanvasEditor = (
  options: MeshCanvasEditorOptions
): HTMLElement => {
  const section = document.createElement("section");
  section.className = "mesh-canvas-editor";
  section.dataset.testid = editorTestIds.meshCanvasEditor;
  section.setAttribute("aria-labelledby", "editor-mesh-canvas-heading");

  const heading = document.createElement("h3");
  heading.id = "editor-mesh-canvas-heading";
  heading.textContent = "Mesh Canvas";

  const status = createMeshCanvasStatus(options.viewModel);

  section.append(heading, status);

  if (!options.viewModel.canvasSelection.hasHitTargets) {
    const empty = document.createElement("p");
    empty.className = "mesh-vertex-controls__empty";
    empty.textContent = options.viewModel.canvasSelection.editabilityLabel;
    section.append(empty);
    return section;
  }

  section.append(
    createMeshCanvasSurface(options),
    createMeshCanvasNudgeControls(options)
  );

  return section;
};

const createMeshCanvasStatus = (
  viewModel: MeshEditViewModel
): HTMLElement => {
  const status = document.createElement("div");
  status.className = "mesh-canvas-editor__status";
  status.dataset.testid = editorTestIds.meshCanvasStatus;
  status.setAttribute("role", "status");
  status.setAttribute("aria-label", "Mesh canvas selection status");

  const selection = document.createElement("p");
  selection.textContent = `${viewModel.selectedMeshLabel} / ${viewModel.canvasSelection.selectedVertexCountLabel}`;

  const editability = document.createElement("p");
  editability.textContent = `${viewModel.canvasSelection.hitTargetCountLabel} / ${viewModel.canvasSelection.editabilityLabel}`;

  status.append(selection, editability);
  return status;
};

const createMeshCanvasSurface = (
  options: MeshCanvasEditorOptions
): SVGSVGElement => {
  const svg = document.createElementNS(svgNamespace, "svg");
  svg.classList.add("mesh-canvas-editor__surface");
  svg.dataset.testid = editorTestIds.meshCanvasSurface;
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", "Mesh vertex selection canvas");
  svg.setAttribute("viewBox", createMeshCanvasViewBox(options.viewModel));
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet");

  const outline = createMeshCanvasOutline(options.viewModel);
  if (outline !== null) {
    svg.append(outline);
  }

  for (const target of options.viewModel.canvasSelection.hitTargets) {
    svg.append(createMeshCanvasVertexTarget(target, options));
  }

  return svg;
};

const createMeshCanvasOutline = (
  viewModel: MeshEditViewModel
): SVGElement | null => {
  const points = [...viewModel.canvasSelection.hitTargets]
    .sort((left, right) => left.vertexIndex - right.vertexIndex)
    .map((target) => `${target.x},${target.y}`);

  if (points.length < 2) {
    return null;
  }

  const outline = document.createElementNS(svgNamespace, "polyline");
  outline.setAttribute("points", points.join(" "));
  outline.setAttribute("fill", "none");
  outline.setAttribute("stroke", "#36515f");
  outline.setAttribute("stroke-width", "1");
  outline.setAttribute("stroke-dasharray", "3 2");
  outline.setAttribute("vector-effect", "non-scaling-stroke");
  return outline;
};

const createMeshCanvasVertexTarget = (
  target: MeshEditViewModel["canvasSelection"]["hitTargets"][number],
  options: MeshCanvasEditorOptions
): SVGCircleElement => {
  const circle = document.createElementNS(svgNamespace, "circle");
  circle.dataset.testid = createMeshCanvasVertexTestId(target.meshId, target.vertexId);
  circle.setAttribute("cx", String(target.x));
  circle.setAttribute("cy", String(target.y));
  circle.setAttribute("r", String(Math.max(target.radius, 2)));
  circle.setAttribute("fill", target.selected ? "#c9543f" : "#f5f2e8");
  circle.setAttribute("stroke", target.editable ? "#1f2a2e" : "#8a8f94");
  circle.setAttribute("stroke-width", target.selected ? "2" : "1.25");
  circle.setAttribute("vector-effect", "non-scaling-stroke");
  circle.setAttribute("role", "button");
  circle.setAttribute("aria-label", target.ariaLabel);
  circle.setAttribute("data-selected", String(target.selected));
  circle.setAttribute("data-editable", String(target.editable));
  circle.setAttribute("data-mesh-id", target.meshId);
  circle.setAttribute("data-vertex-id", target.vertexId);

  let pointerStart: { readonly x: number; readonly y: number } | null = null;
  circle.addEventListener("click", (event) => {
    const mode = resolveSelectionMode(event);
    options.onSelectVertex({
      vertexId: target.vertexId,
      ...(mode === undefined ? {} : { mode })
    });
  });
  circle.addEventListener("pointerdown", (event) => {
    pointerStart = {
      x: event.clientX,
      y: event.clientY
    };
  });
  circle.addEventListener("pointerup", (event) => {
    if (pointerStart === null || !target.selected || !target.editable) {
      pointerStart = null;
      return;
    }

    const scale = resolveCanvasScale(options.viewModel);
    const delta = {
      x: (event.clientX - pointerStart.x) / scale,
      y: (event.clientY - pointerStart.y) / scale
    };
    pointerStart = null;

    if (delta.x !== 0 || delta.y !== 0) {
      options.onDragSelection(delta);
    }
  });

  const title = document.createElementNS(svgNamespace, "title");
  title.textContent = target.stateLabel;
  circle.append(title);

  return circle;
};

const createMeshCanvasNudgeControls = (
  options: MeshCanvasEditorOptions
): HTMLElement => {
  const controls = document.createElement("div");
  controls.className = "mesh-canvas-editor__nudge-controls";

  controls.append(
    createNudgeButton("left", "-X", { x: -options.viewModel.nudgeStep, y: 0 }, options),
    createNudgeButton("right", "+X", { x: options.viewModel.nudgeStep, y: 0 }, options),
    createNudgeButton("up", "-Y", { x: 0, y: -options.viewModel.nudgeStep }, options),
    createNudgeButton("down", "+Y", { x: 0, y: options.viewModel.nudgeStep }, options)
  );

  return controls;
};

const createNudgeButton = (
  direction: "left" | "right" | "up" | "down",
  text: string,
  delta: { readonly x: number; readonly y: number },
  options: MeshCanvasEditorOptions
): HTMLButtonElement => {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "mesh-vertex-controls__nudge";
  button.dataset.testid = createMeshCanvasNudgeButtonTestId(direction);
  button.disabled = !options.viewModel.canvasSelection.canDraftMove;
  button.setAttribute("aria-label", `Nudge selected mesh vertices ${direction}`);
  button.textContent = text;
  button.addEventListener("click", () => options.onNudgeSelection(delta));
  return button;
};

const createMeshCanvasViewBox = (
  viewModel: MeshEditViewModel
): string => {
  const selectedBounds = viewModel.selectedMesh?.boundsLabel;
  const targets = viewModel.canvasSelection.hitTargets;
  if (targets.length === 0) {
    return "0 0 128 128";
  }

  const minX = Math.min(...targets.map((target) => target.x - target.radius));
  const minY = Math.min(...targets.map((target) => target.y - target.radius));
  const maxX = Math.max(...targets.map((target) => target.x + target.radius));
  const maxY = Math.max(...targets.map((target) => target.y + target.radius));
  const padding = selectedBounds === undefined ? 8 : 12;
  return `${minX - padding} ${minY - padding} ${Math.max(maxX - minX + padding * 2, 1)} ${Math.max(maxY - minY + padding * 2, 1)}`;
};

const resolveCanvasScale = (viewModel: MeshEditViewModel): number => {
  const firstTarget = viewModel.canvasSelection.hitTargets[0];
  const firstVertex = viewModel.editableVertices.find(
    (vertex) => vertex.vertexId === firstTarget?.vertexId
  );
  if (firstTarget === undefined || firstVertex === undefined) {
    return 1;
  }

  const xScale = firstVertex.x === 0 ? 1 : firstTarget.x / firstVertex.x;
  return Number.isFinite(xScale) && xScale > 0 ? xScale : 1;
};

const resolveSelectionMode = (
  event: Pick<MouseEvent, "shiftKey" | "ctrlKey" | "metaKey"> | undefined
): MeshCanvasVertexSelectionCommand["mode"] =>
  event?.shiftKey === true
    ? "add"
    : event?.ctrlKey === true || event?.metaKey === true
      ? "toggle"
      : "replace";
