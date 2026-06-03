import {
  createMeshTopologyActionTestId,
  createMeshTriangleRemoveButtonTestId,
  editorTestIds,
  type MeshEditViewModel,
  type MeshTopologyAddTriangleDraftCommand,
  type MeshTopologyAddVertexDraftCommand,
  type MeshTopologyRemoveTriangleDraftCommand,
  type MeshTopologyRemoveVertexDraftCommand,
  type MeshUvNudgeDraftCommand
} from "../../editor-state/index.js";

export interface MeshTopologyControlsOptions {
  readonly viewModel: MeshEditViewModel;
  readonly onAddVertex: (command: MeshTopologyAddVertexDraftCommand) => void;
  readonly onRemoveSelectedVertex: (command: MeshTopologyRemoveVertexDraftCommand) => void;
  readonly onAddTriangle: (command: MeshTopologyAddTriangleDraftCommand) => void;
  readonly onRemoveTriangle: (command: MeshTopologyRemoveTriangleDraftCommand) => void;
  readonly onNudgeUv: (command: MeshUvNudgeDraftCommand) => void;
}

export const createMeshTopologyControls = (
  options: MeshTopologyControlsOptions
): HTMLElement => {
  const controls = document.createElement("section");
  controls.className = "mesh-vertex-controls mesh-topology-controls";
  controls.dataset.testid = editorTestIds.meshTopologyControls;
  controls.setAttribute("aria-labelledby", "editor-mesh-topology-controls-heading");

  const heading = document.createElement("h3");
  heading.id = "editor-mesh-topology-controls-heading";
  heading.textContent = "Mesh Topology / UV";

  controls.append(
    heading,
    createMeshTopologyStatus(options.viewModel),
    createMeshTopologyActionRow(options),
    createMeshUvNudgeControls(options),
    createMeshTriangleList(options)
  );

  return controls;
};

const createMeshTopologyStatus = (
  viewModel: MeshEditViewModel
): HTMLElement => {
  const status = document.createElement("div");
  status.className = "mesh-vertex-controls__status";
  status.dataset.testid = editorTestIds.meshTopologyStatus;
  status.setAttribute("role", "status");
  status.setAttribute("aria-label", "Mesh topology and UV edit status");

  const mesh = document.createElement("p");
  mesh.textContent = `${viewModel.topology.statusLabel} / ${viewModel.topology.topologyRevisionLabel}`;

  const scope = document.createElement("p");
  scope.textContent =
    `${viewModel.topology.selectedVertexCountLabel} / ${viewModel.topology.stableTriangleStatusLabel} / ${viewModel.topology.lastTopologyResultLabel}`;

  status.append(mesh, scope);
  return status;
};

const createMeshTopologyActionRow = (
  options: MeshTopologyControlsOptions
): HTMLElement => {
  const row = document.createElement("div");
  row.className = "mesh-canvas-editor__nudge-controls";

  row.append(
    createActionButton({
      text: "Add vertex",
      testId: createMeshTopologyActionTestId("addVertex"),
      label: createActionLabel(options.viewModel.topology.addVertex.label, options.viewModel.topology.addVertex.disabledLabel),
      command: options.viewModel.topology.addVertex.command,
      onCommit: options.onAddVertex
    }),
    createActionButton({
      text: "Remove vertex",
      testId: createMeshTopologyActionTestId("removeVertex"),
      label: createActionLabel(
        options.viewModel.topology.removeSelectedVertex.label,
        options.viewModel.topology.removeSelectedVertex.disabledLabel
      ),
      command: options.viewModel.topology.removeSelectedVertex.command,
      onCommit: options.onRemoveSelectedVertex
    }),
    createActionButton({
      text: "Add triangle",
      testId: createMeshTopologyActionTestId("addTriangle"),
      label: createActionLabel(options.viewModel.topology.addTriangle.label, options.viewModel.topology.addTriangle.disabledLabel),
      command: options.viewModel.topology.addTriangle.command,
      onCommit: options.onAddTriangle
    })
  );

  return row;
};

const createMeshUvNudgeControls = (
  options: MeshTopologyControlsOptions
): HTMLElement => {
  const wrapper = document.createElement("div");
  wrapper.className = "mesh-canvas-editor__nudge-controls";

  const label = document.createElement("span");
  label.textContent = options.viewModel.topology.uvStepLabel;
  wrapper.append(label);

  for (const nudge of options.viewModel.topology.uvNudges) {
    wrapper.append(
      createActionButton({
        text: nudge.text,
        testId: createMeshTopologyActionTestId(createUvAction(nudge.direction)),
        label: nudge.ariaLabel,
        command: nudge.command,
        onCommit: options.onNudgeUv
      })
    );
  }

  return wrapper;
};

const createMeshTriangleList = (
  options: MeshTopologyControlsOptions
): HTMLElement => {
  const wrapper = document.createElement("div");
  wrapper.className = "mesh-topology-controls__triangles";

  const label = document.createElement("p");
  label.textContent = options.viewModel.topology.triangleCountLabel;
  wrapper.append(label);

  if (!options.viewModel.topology.hasTriangles) {
    return wrapper;
  }

  const table = document.createElement("table");
  table.className = "mesh-vertex-controls__table";

  const header = document.createElement("thead");
  const headerRow = document.createElement("tr");
  for (const heading of ["Triangle", "Vertices", "Remove"]) {
    const cell = document.createElement("th");
    cell.scope = "col";
    cell.textContent = heading;
    headerRow.append(cell);
  }
  header.append(headerRow);

  const body = document.createElement("tbody");
  for (const triangle of options.viewModel.topology.triangles) {
    const row = document.createElement("tr");
    row.append(
      createCell("Triangle", triangle.triangleLabel),
      createCell("Vertices", triangle.vertexLabel),
      createTriangleRemoveCell(options, triangle)
    );
    body.append(row);
  }

  table.append(header, body);
  wrapper.append(table);
  return wrapper;
};

const createTriangleRemoveCell = (
  options: MeshTopologyControlsOptions,
  triangle: MeshEditViewModel["topology"]["triangles"][number]
): HTMLTableCellElement => {
  const cell = document.createElement("td");
  cell.dataset.label = "Remove";
  const meshId = options.viewModel.selectedMesh?.meshId ?? "mesh";
  const triangleId = triangle.triangleId ?? `triangle_${triangle.triangleIndex}`;

  cell.append(
    createActionButton({
      text: "Remove",
      testId: createMeshTriangleRemoveButtonTestId(meshId, triangleId),
      label: createActionLabel(triangle.remove.label, triangle.remove.disabledLabel),
      command: triangle.remove.command,
      onCommit: options.onRemoveTriangle
    })
  );
  return cell;
};

const createActionButton = <TCommand>(options: {
  readonly text: string;
  readonly testId: string;
  readonly label: string;
  readonly command: TCommand | null;
  readonly onCommit: (command: TCommand) => void;
}): HTMLButtonElement => {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "mesh-vertex-controls__nudge";
  button.dataset.testid = options.testId;
  button.disabled = options.command === null;
  button.setAttribute("aria-label", options.label);
  button.textContent = options.text;
  button.addEventListener("click", () => {
    if (options.command !== null) {
      options.onCommit(options.command);
    }
  });

  return button;
};

const createCell = (label: string, value: string): HTMLTableCellElement => {
  const cell = document.createElement("td");
  cell.dataset.label = label;
  cell.textContent = value;

  return cell;
};

const createActionLabel = (label: string, disabledLabel: string | null): string =>
  disabledLabel === null ? label : `${label}: ${disabledLabel}`;

const createUvAction = (
  direction: MeshEditViewModel["topology"]["uvNudges"][number]["direction"]
): "uvLeft" | "uvRight" | "uvUp" | "uvDown" => {
  switch (direction) {
    case "left":
      return "uvLeft";
    case "right":
      return "uvRight";
    case "up":
      return "uvUp";
    case "down":
      return "uvDown";
  }
};
