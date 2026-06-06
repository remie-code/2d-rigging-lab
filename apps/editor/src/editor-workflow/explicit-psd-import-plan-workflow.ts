import { computePackageBinarySha256Digest } from "@private-2d-rigging-lab/package-format";

import {
  createEmptyExplicitPsdLayerBatchIntakeState,
  projectExplicitPsdImportPlanState,
  type EditorSemanticState,
  type ExplicitPsdImportState
} from "../editor-state/index.js";
import type {
  BrowserPsdImportPlanCandidatePlan
} from "./browser-psd-import-plan-candidate-result.js";
import {
  createBrowserPsdImportPlanCandidatePlan,
  type BrowserPsdImportPlanReservedGeneratedIds
} from "./browser-psd-import-plan-candidate-service.js";
import type {
  BrowserPsdParserBridgeResult
} from "./browser-psd-parser-bridge-result.js";

export interface EditorExplicitPsdImportPlanPreviewCommand {
  readonly scopeRef?: string;
  readonly approvedLayerNodeRefs?: readonly string[];
  readonly destinationParentPartId?: string;
}

export interface EditorExplicitPsdImportPlanApprovedBatchIntakeCommand {
  readonly destinationParentPartId: string;
}

export interface EditorExplicitPsdImportPlanPreviewResult {
  readonly status: BrowserPsdImportPlanCandidatePlan["status"];
  readonly planId: string;
  readonly candidatePlanDigest: string;
  readonly scopeRef: string;
  readonly candidateCount: number;
  readonly approvedLayerNodeRefs: readonly string[];
}

export interface EditorExplicitPsdImportPlanPreviewOutcome {
  readonly state: ExplicitPsdImportState;
  readonly plan: BrowserPsdImportPlanCandidatePlan;
  readonly result: EditorExplicitPsdImportPlanPreviewResult;
}

export interface EditorExplicitPsdImportPlanPreviewWorkflowInput {
  readonly state: EditorSemanticState;
  readonly command: EditorExplicitPsdImportPlanPreviewCommand;
  readonly currentPsdFile?: File;
  readonly parsedBridgeResult?: BrowserPsdParserBridgeResult;
}

export const runEditorExplicitPsdImportPlanPreviewWorkflow = async (
  input: EditorExplicitPsdImportPlanPreviewWorkflowInput
): Promise<EditorExplicitPsdImportPlanPreviewOutcome> => {
  const parsedBridgeResult = assertParsedCurrentSource(input);
  const currentPsdFile = input.currentPsdFile;
  if (currentPsdFile === undefined) {
    throw new Error("Current PSD source bytes are unavailable; re-parse before creating an import-plan preview.");
  }

  const sourceDigest = await computeSourceDigest(currentPsdFile);
  const plan = await createBrowserPsdImportPlanCandidatePlan({
    parsedBridgeResult,
    scopeRef: input.command.scopeRef?.trim() || "psd:root",
    approvedLayerNodeRefs: input.command.approvedLayerNodeRefs ?? [],
    sourceDigest,
    reservedGeneratedIds: collectReservedGeneratedIds(input.state),
    reservedGeneratedNames: collectReservedGeneratedNames(input.state)
  });
  const approvedLayerNodeRefs = plan.candidates
    .filter((candidate) => candidate.selection.approved)
    .sort((left, right) =>
      (left.selection.approvedOrder ?? Number.MAX_SAFE_INTEGER) -
      (right.selection.approvedOrder ?? Number.MAX_SAFE_INTEGER)
    )
    .map((candidate) => candidate.layerRef);
  const destinationParentPartId = input.command.destinationParentPartId?.trim();
  const importPlanStateOptions = destinationParentPartId === undefined
    ? {}
    : { destinationParentPartId };
  const state = {
    ...input.state.explicitPsdImport,
    selectedLayerNodeRefs: approvedLayerNodeRefs,
    importPlan: projectExplicitPsdImportPlanState(plan, importPlanStateOptions),
    selectedLayerBatchIntake: createEmptyExplicitPsdLayerBatchIntakeState()
  };

  return {
    state,
    plan,
    result: {
      status: plan.status,
      planId: plan.planId,
      candidatePlanDigest: `${plan.candidatePlanDigest.algorithm}:${plan.candidatePlanDigest.hex}`,
      scopeRef: plan.scope.scopeRef,
      candidateCount: plan.summary.totalLeafCount,
      approvedLayerNodeRefs
    }
  };
};

const assertParsedCurrentSource = (
  input: EditorExplicitPsdImportPlanPreviewWorkflowInput
): Extract<BrowserPsdParserBridgeResult, { readonly status: "parsed" }> => {
  if (input.parsedBridgeResult?.status !== "parsed" || input.state.explicitPsdImport.status !== "parsed") {
    throw new Error("Create an import-plan preview only after the PSD has parsed in the current browser session.");
  }

  const source = input.state.explicitPsdImport.source;
  if (
    source !== null &&
    input.currentPsdFile !== undefined &&
    (source.fileName !== input.currentPsdFile.name || source.byteLength !== input.currentPsdFile.size)
  ) {
    throw new Error("The retained current-session PSD file no longer matches the displayed PSD import state.");
  }

  return input.parsedBridgeResult;
};

const computeSourceDigest = async (file: File) => {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const digestResult = await computePackageBinarySha256Digest(bytes);
  if (digestResult.status === "unsupported") {
    throw new Error(`Unable to compute import-plan source digest: ${digestResult.reason}`);
  }

  return digestResult.digest;
};

const collectReservedGeneratedIds = (
  state: EditorSemanticState
): BrowserPsdImportPlanReservedGeneratedIds => ({
  partIds: state.parts.map((part) => part.partId),
  drawableIds: state.drawables.map((drawable) => drawable.drawableId),
  textureIds: [
    ...state.drawables.map((drawable) => drawable.textureId),
    ...(state.textureAtlas?.textures.map((texture) => texture.textureId) ?? [])
  ]
});

const collectReservedGeneratedNames = (
  state: EditorSemanticState
): readonly string[] => [
  ...state.parts.map((part) => part.displayName),
  ...state.drawables.map((drawable) => drawable.displayName)
];
