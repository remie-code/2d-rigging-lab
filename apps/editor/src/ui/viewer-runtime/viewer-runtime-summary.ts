import type { EditorWorkflowPersistenceResult } from "../../editor-workflow/index.js";
import type {
  EditorViewerRuntimeProjection
} from "../../editor-workflow/viewer-runtime-workflow.js";
import {
  editorTestIds,
  type EditorSemanticState
} from "../../editor-state/index.js";

export const createViewerRuntimePackageState = (input: {
  readonly state: EditorSemanticState;
  readonly latestProjectPersistenceResult: EditorWorkflowPersistenceResult | null;
}): HTMLElement => {
  const section = document.createElement("section");
  section.dataset.testid = editorTestIds.viewerRuntimePackageState;

  const heading = document.createElement("h3");
  heading.textContent = "Package State";

  const facts = document.createElement("dl");
  facts.className = "preview-summary";
  appendFact(facts, "Package", input.state.loadedPackage?.packageId ?? "No package");
  appendFact(facts, "Revision", `package r${input.state.revision.packageRevision} / authoring r${input.state.revision.authoringRevision}`);
  appendFact(facts, "Storage", formatProjectPersistence(input.latestProjectPersistenceResult));
  appendFact(facts, "Reload", `${input.state.reload.status}`);

  section.append(heading, facts);
  return section;
};

export const createViewerRuntimeSnapshotSummary = (
  projection: EditorViewerRuntimeProjection | null
): HTMLElement => {
  const section = document.createElement("section");
  section.dataset.testid = editorTestIds.viewerRuntimeSnapshotSummary;

  const heading = document.createElement("h3");
  heading.textContent = "Runtime Snapshot";
  section.append(heading);

  if (projection === null) {
    section.append(createEmpty("No viewer snapshot"));
    return section;
  }

  const summary = projection.snapshotSummary;
  const facts = document.createElement("dl");
  facts.className = "preview-summary";
  appendFact(facts, "Surface", summary.surface);
  appendFact(facts, "Snapshot", summary.snapshotId);
  appendFact(facts, "Package", `${summary.packageId} r${summary.packageRevision}`);
  appendFact(facts, "Parameters", `${summary.parameterCount} total / ${summary.overrideCount} override`);
  appendFact(facts, "Drawables", `${summary.visibleDrawableCount} visible / ${summary.drawableCount} total`);
  appendFact(facts, "Draw list", String(summary.drawListCount));
  appendFact(facts, "Rig controls", `${summary.evaluatedRigControlCount} evaluated / ${summary.rigControlCount} total`);
  appendFact(facts, "Masks", `${summary.maskRelationCount} semantic`);
  appendFact(facts, "Dynamics", String(summary.dynamicsCount));
  appendFact(facts, "Diagnostics", String(summary.diagnosticCount));
  appendFact(facts, "Evidence", summary.evidenceLabel);
  section.append(
    facts,
    createParameterValueList(projection),
    createRigControlEvidenceList(projection),
    createMaskRelationEvidenceList(projection),
    createPartLayerEvidenceList(projection),
    createDrawableOpacityEvidenceList(projection),
    createDrawableLayerEvidenceList(projection),
    createDynamicsOutputList(projection)
  );
  return section;
};

export const createViewerRuntimeDiffSummary = (
  projection: EditorViewerRuntimeProjection | null
): HTMLElement => {
  const section = document.createElement("section");
  section.dataset.testid = editorTestIds.viewerRuntimeDiff;

  const heading = document.createElement("h3");
  heading.textContent = "Runtime Diff";
  section.append(heading);

  if (projection === null) {
    section.append(createEmpty("No runtime diff"));
    return section;
  }

  const diff = projection.runtimeDiff;
  const facts = document.createElement("dl");
  facts.className = "preview-summary";
  appendFact(facts, "Snapshots", `${diff.beforeSnapshotId} -> ${diff.afterSnapshotId}`);
  appendFact(facts, "Parameters", String(diff.parameterChangeCount));
  appendFact(facts, "Dynamics", String(diff.dynamicsChangeCount));
  appendFact(facts, "Drawable geometry", String(diff.drawableGeometryChangeCount));
  appendFact(facts, "Drawable state", String(diff.drawableRuntimeStateChangeCount));
  appendFact(facts, "Draw list", String(diff.drawListChangeCount));
  appendFact(facts, "Diagnostic delta", String(diff.diagnosticDeltaCount));
  appendFact(facts, "Affected drawables", diff.affectedDrawableIds.join(", ") || "None");
  section.append(facts);
  return section;
};

export const createViewerRuntimeValidationDiagnostics = (
  projection: EditorViewerRuntimeProjection | null
): HTMLElement => {
  const section = document.createElement("section");
  section.dataset.testid = editorTestIds.viewerRuntimeDiagnostics;

  const heading = document.createElement("h3");
  heading.textContent = "Validation Diagnostics";
  section.append(heading);

  if (projection === null) {
    section.append(createEmpty("No validation report"));
    return section;
  }

  const validation = projection.validation;
  const summary = document.createElement("p");
  summary.className = "editor-panel__meta";
  summary.textContent = `${validation.reportId} / ${validation.status} / ${validation.highestSeverity} / ${validation.checkCount} checks`;
  section.append(summary);

  if (validation.diagnostics.length === 0) {
    section.append(createEmpty("No diagnostics"));
    return section;
  }

  const list = document.createElement("ul");
  list.className = "dynamics-validator-diagnostics__list";
  for (const diagnostic of validation.diagnostics) {
    const item = document.createElement("li");
    item.textContent = `${diagnostic.severity} / ${diagnostic.status} / ${diagnostic.checkId}: ${diagnostic.message} (${diagnostic.targetLabel})`;
    list.append(item);
  }
  section.append(list);
  return section;
};

const createPartLayerEvidenceList = (
  projection: EditorViewerRuntimeProjection
): HTMLElement => {
  const section = document.createElement("section");

  const heading = document.createElement("h4");
  heading.textContent = "Part Layer Evidence";
  section.append(heading);

  const parts = projection.previewProjection.parts ?? [];
  if (parts.length === 0) {
    section.append(createEmpty("No part hierarchy evidence"));
    return section;
  }

  const list = document.createElement("ul");
  list.className = "dynamics-preview-outputs__list";
  for (const part of parts) {
    const state = part.layerState;
    const stateLabel =
      state === undefined
        ? "no editor layer state"
        : `${state.editorHidden ? "editor hidden" : "editor visible"} / ${state.locked ? "locked" : "unlocked"} / ${state.selected ? "selected" : "not selected"}`;
    const item = document.createElement("li");
    item.textContent = `${part.partId}: depth ${part.depth}; path ${part.hierarchyPath.join(" > ") || part.partId}; drawables ${part.drawableIds.join(", ") || "None"}; ${stateLabel}`;
    list.append(item);
  }
  section.append(list);
  return section;
};

const createDrawableLayerEvidenceList = (
  projection: EditorViewerRuntimeProjection
): HTMLElement => {
  const section = document.createElement("section");

  const heading = document.createElement("h4");
  heading.textContent = "Drawable Layer Evidence";
  section.append(heading);

  if (projection.previewProjection.drawables.length === 0) {
    section.append(createEmpty("No drawable layer evidence"));
    return section;
  }

  const list = document.createElement("ul");
  list.className = "dynamics-preview-outputs__list";
  for (const drawable of projection.previewProjection.drawables) {
    const state = drawable.layerState;
    const stateLabel =
      state === undefined
        ? "no editor layer state"
        : `${state.runtimeVisible ? "runtime visible" : "runtime hidden"} / ${state.editorHidden ? "editor hidden" : "editor visible"} / ${state.locked ? "locked" : "unlocked"} / ${state.selected ? "selected" : "not selected"} / ${state.textureUnresolved ? "texture unresolved" : "texture resolved"}${state.textureBacked ? " / texture-backed" : ""}`;
    const item = document.createElement("li");
    item.textContent = `${drawable.drawableId}: part ${drawable.partId ?? "none"} / texture ${drawable.texture.textureId ?? drawable.texture.status}; ${stateLabel}`;
    list.append(item);
  }
  section.append(list);
  return section;
};

const createParameterValueList = (
  projection: EditorViewerRuntimeProjection
): HTMLElement => {
  const section = document.createElement("section");

  const heading = document.createElement("h4");
  heading.textContent = "Parameter Values";
  section.append(heading);

  if (projection.snapshotSummary.parameterValues.length === 0) {
    section.append(createEmpty("No parameters"));
    return section;
  }

  const list = document.createElement("ul");
  list.className = "dynamics-preview-outputs__list";
  for (const parameter of projection.snapshotSummary.parameterValues) {
    const item = document.createElement("li");
    item.textContent = `${parameter.parameterId}: ${formatViewerNumber(parameter.effectiveValue)} / ${parameter.valueSource} / ${parameter.source}`;
    list.append(item);
  }
  section.append(list);
  return section;
};

const createDynamicsOutputList = (
  projection: EditorViewerRuntimeProjection
): HTMLElement => {
  const section = document.createElement("section");

  const heading = document.createElement("h4");
  heading.textContent = "Dynamics Output";
  section.append(heading);

  if (projection.snapshotSummary.dynamicsOutputs.length === 0) {
    section.append(createEmpty("No dynamics output"));
    return section;
  }

  const list = document.createElement("ul");
  list.className = "dynamics-preview-outputs__list";
  for (const dynamics of projection.snapshotSummary.dynamicsOutputs) {
    const item = document.createElement("li");
    item.textContent = `${dynamics.dynamicsGroupId} -> ${dynamics.outputParameterId}: ${formatViewerNumber(dynamics.outputValue)}; position ${formatViewerNumber(dynamics.position)} / velocity ${formatViewerNumber(dynamics.velocity)} / tick ${dynamics.tick}`;
    list.append(item);
  }
  section.append(list);
  return section;
};

const createMaskRelationEvidenceList = (
  projection: EditorViewerRuntimeProjection
): HTMLElement => {
  const section = document.createElement("section");

  const heading = document.createElement("h4");
  heading.textContent = "Mask Relation Evidence";
  section.append(heading);

  if (projection.snapshotSummary.maskRelations.length === 0) {
    section.append(createEmpty("No semantic mask relation evidence"));
    return section;
  }

  const list = document.createElement("ul");
  list.className = "dynamics-preview-outputs__list";
  for (const mask of projection.snapshotSummary.maskRelations) {
    const item = document.createElement("li");
    item.textContent = `${mask.maskRelationId}: ${mask.clippingIntent} / ${mask.resolvedLabel}; masks ${mask.sourceDrawableLabel}; targets ${mask.targetDrawableLabel}`;
    list.append(item);
  }
  section.append(list);
  return section;
};

const createDrawableOpacityEvidenceList = (
  projection: EditorViewerRuntimeProjection
): HTMLElement => {
  const section = document.createElement("section");

  const heading = document.createElement("h4");
  heading.textContent = "Drawable Opacity Evidence";
  section.append(heading);

  if (projection.snapshotSummary.drawableOpacityEvidence.length === 0) {
    section.append(createEmpty("No drawable opacity evidence"));
    return section;
  }

  const list = document.createElement("ul");
  list.className = "dynamics-preview-outputs__list";
  for (const drawable of projection.snapshotSummary.drawableOpacityEvidence) {
    const item = document.createElement("li");
    item.textContent = `${drawable.drawableId}: opacity ${formatViewerNumber(drawable.opacity)} / ${drawable.visible ? "visible" : "hidden"}`;
    list.append(item);
  }
  section.append(list);
  return section;
};

const createRigControlEvidenceList = (
  projection: EditorViewerRuntimeProjection
): HTMLElement => {
  const section = document.createElement("section");

  const heading = document.createElement("h4");
  heading.textContent = "Rig Control Evidence";
  section.append(heading);

  if (projection.snapshotSummary.rigControls.length === 0) {
    section.append(createEmpty("No project-defined rig control evidence"));
    return section;
  }

  const list = document.createElement("ul");
  list.className = "dynamics-preview-outputs__list";
  for (const rigControl of projection.snapshotSummary.rigControls) {
    const item = document.createElement("li");
    item.textContent = `${rigControl.rigControlId}: ${rigControl.kind} / ${rigControl.evaluationStatus} / order ${rigControl.hierarchyIndex}; parent ${rigControl.parentLabel}; local ${rigControl.localAngleLabel} / world ${rigControl.worldAngleLabel}; drawables ${rigControl.affectedDrawableLabel}; child controls ${rigControl.affectedRigControlLabel}`;
    list.append(item);
  }
  section.append(list);
  return section;
};

const appendFact = (list: HTMLDListElement, label: string, value: string): void => {
  const group = document.createElement("div");
  group.className = "preview-summary__fact";

  const term = document.createElement("dt");
  term.textContent = label;

  const description = document.createElement("dd");
  description.textContent = value;

  group.append(term, description);
  list.append(group);
};

const createEmpty = (text: string): HTMLElement => {
  const empty = document.createElement("p");
  empty.className = "preview-panel__empty";
  empty.textContent = text;
  return empty;
};

const formatProjectPersistence = (
  result: EditorWorkflowPersistenceResult | null
): string => {
  if (result === null) {
    return "Not saved or loaded in this session";
  }

  switch (result.status) {
    case "saved":
      return `Saved r${result.snapshot.packageRevision}`;
    case "loaded":
      return `Loaded ${result.storeResult.project.packageSummary.packageDisplayName} r${result.storeResult.project.packageSummary.packageRevision}`;
    case "empty":
      return "No saved project";
    case "failed":
      return `Load failed: ${result.storeResult.reason}`;
    case "reset":
      return "Sample reset";
  }
};

const formatViewerNumber = (value: number): string =>
  Number.isInteger(value) ? String(value) : Number.parseFloat(value.toFixed(4)).toString();
