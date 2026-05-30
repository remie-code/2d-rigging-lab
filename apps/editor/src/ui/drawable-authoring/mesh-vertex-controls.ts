import {
  createMeshVertexNudgeButtonTestId,
  createMeshVertexRowTestId,
  editorTestIds,
  type EditableMeshVertexViewModel,
  type MeshEditViewModel,
  type MeshVertexNudgeDirection,
  type MeshVertexNudgeViewModelCommand
} from "../../editor-state/index.js";

export interface MeshVertexControlsOptions {
  readonly viewModel: MeshEditViewModel;
  readonly onNudgeVertex: (command: MeshVertexNudgeViewModelCommand) => void;
}

export const createMeshVertexControls = (
  options: MeshVertexControlsOptions
): HTMLElement => {
  const controls = document.createElement("section");
  controls.className = "mesh-vertex-controls";
  controls.dataset.testid = editorTestIds.meshVertexControls;
  controls.setAttribute("aria-labelledby", "editor-mesh-vertex-controls-heading");

  const heading = document.createElement("h3");
  heading.id = "editor-mesh-vertex-controls-heading";
  heading.textContent = "Mesh Vertex Controls";

  const status = createMeshVertexStatus(options.viewModel);

  controls.append(heading, status);

  if (!options.viewModel.hasEditableVertices) {
    const empty = document.createElement("p");
    empty.className = "mesh-vertex-controls__empty";
    empty.textContent = options.viewModel.emptyMessage;
    controls.append(empty);

    return controls;
  }

  const table = document.createElement("table");
  table.className = "mesh-vertex-controls__table";

  const header = document.createElement("thead");
  const headerRow = document.createElement("tr");
  for (const label of ["Vertex", "Position", "X nudge", "Y nudge"]) {
    const cell = document.createElement("th");
    cell.scope = "col";
    cell.textContent = label;
    headerRow.append(cell);
  }
  header.append(headerRow);

  const body = document.createElement("tbody");
  for (const vertex of options.viewModel.editableVertices) {
    body.append(createMeshVertexRow(vertex, options));
  }

  table.append(header, body);
  controls.append(table);

  return controls;
};

const createMeshVertexStatus = (viewModel: MeshEditViewModel): HTMLElement => {
  const status = document.createElement("div");
  status.className = "mesh-vertex-controls__status";
  status.dataset.testid = editorTestIds.meshVertexStatus;
  status.setAttribute("role", "status");
  status.setAttribute("aria-label", "Mesh vertex edit status");

  const selected = document.createElement("p");
  selected.className = "mesh-vertex-controls__selected";
  selected.textContent =
    viewModel.selectedMesh === null
      ? viewModel.selectedMeshLabel
      : `${viewModel.selectedMeshLabel} / ${viewModel.selectedMesh.vertexCountLabel}`;

  const result = document.createElement("p");
  result.className = "mesh-vertex-controls__result";
  result.textContent = `${viewModel.editableVertexCountLabel} / Step ${viewModel.nudgeStep} / ${viewModel.lastMeshEditResultLabel}`;

  status.append(selected, result);

  return status;
};

const createMeshVertexRow = (
  vertex: EditableMeshVertexViewModel,
  options: MeshVertexControlsOptions
): HTMLTableRowElement => {
  const selectedMesh = options.viewModel.selectedMesh;
  const row = document.createElement("tr");
  const meshId = selectedMesh?.meshId ?? "";
  row.dataset.testid = createMeshVertexRowTestId(meshId, vertex.vertexId);

  row.append(
    createCell("Vertex", `#${vertex.vertexIndex} ${vertex.vertexId}`),
    createCell("Position", vertex.positionLabel),
    createNudgeCell("X nudge", [
      createNudgeButton({
        direction: "left",
        text: "-X",
        label: vertex.nudgeLeftLabel,
        meshId,
        vertex,
        command: vertex.nudgeCommands.left,
        disabled: !options.viewModel.canNudgeSelectedMesh,
        onNudgeVertex: options.onNudgeVertex
      }),
      createNudgeButton({
        direction: "right",
        text: "+X",
        label: vertex.nudgeRightLabel,
        meshId,
        vertex,
        command: vertex.nudgeCommands.right,
        disabled: !options.viewModel.canNudgeSelectedMesh,
        onNudgeVertex: options.onNudgeVertex
      })
    ]),
    createNudgeCell("Y nudge", [
      createNudgeButton({
        direction: "up",
        text: "-Y",
        label: vertex.nudgeUpLabel,
        meshId,
        vertex,
        command: vertex.nudgeCommands.up,
        disabled: !options.viewModel.canNudgeSelectedMesh,
        onNudgeVertex: options.onNudgeVertex
      }),
      createNudgeButton({
        direction: "down",
        text: "+Y",
        label: vertex.nudgeDownLabel,
        meshId,
        vertex,
        command: vertex.nudgeCommands.down,
        disabled: !options.viewModel.canNudgeSelectedMesh,
        onNudgeVertex: options.onNudgeVertex
      })
    ])
  );

  return row;
};

const createCell = (label: string, value: string): HTMLTableCellElement => {
  const cell = document.createElement("td");
  cell.dataset.label = label;
  cell.textContent = value;

  return cell;
};

const createNudgeCell = (
  label: string,
  buttons: readonly HTMLButtonElement[]
): HTMLTableCellElement => {
  const cell = document.createElement("td");
  cell.dataset.label = label;
  cell.className = "mesh-vertex-controls__nudge-cell";
  cell.append(...buttons);

  return cell;
};

const createNudgeButton = (options: {
  readonly direction: MeshVertexNudgeDirection;
  readonly text: string;
  readonly label: string;
  readonly meshId: string;
  readonly vertex: EditableMeshVertexViewModel;
  readonly command: MeshVertexNudgeViewModelCommand;
  readonly disabled: boolean;
  readonly onNudgeVertex: (command: MeshVertexNudgeViewModelCommand) => void;
}): HTMLButtonElement => {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "mesh-vertex-controls__nudge";
  button.dataset.testid = createMeshVertexNudgeButtonTestId(
    options.meshId,
    options.vertex.vertexId,
    options.direction
  );
  button.disabled = options.disabled;
  button.setAttribute("aria-label", options.label);
  button.textContent = options.text;
  button.addEventListener("click", () => options.onNudgeVertex(options.command));

  return button;
};
