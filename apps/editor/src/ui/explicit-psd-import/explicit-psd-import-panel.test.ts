import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  createEmptyExplicitPsdImportState,
  editorTestIds,
  projectExplicitPsdImportStateFromBridgeResult,
  projectExplicitPsdImportViewModel,
  type ExplicitPsdImportPlanCandidateState,
  type ExplicitPsdImportState
} from "../../editor-state/index.js";
import { createExplicitPsdImportPanel } from "./explicit-psd-import-panel.js";

describe("explicit PSD import panel", () => {
  beforeEach(() => {
    installTestDocument();
  });

  afterEach(() => {
    delete (globalThis as Partial<{ document: Document }>).document;
  });

  it("renders an explicit PSD file input for e2e upload workflow", () => {
    const panel = createPanel();
    const input = findByTestId(panel, editorTestIds.explicitPsdImportFileInput);

    expect(findByTestId(panel, editorTestIds.explicitPsdImportPanel)?.textContent).toContain("PSD Import");
    expect(input?.type).toBe("file");
    expect(input?.accept).toContain(".psd");
    expect(findByTestId(panel, editorTestIds.explicitPsdImportStatus)?.textContent).toContain(
      "No PSD selected"
    );
    expect(findByTestId(panel, editorTestIds.explicitPsdImportPersistence)?.textContent).toContain(
      "sessionEvidenceClearedOnProjectLoadReparseRequiredV1"
    );
    expect(findByTestId(panel, editorTestIds.explicitPsdImportLayerIntakeSubmit)?.disabled).toBe(true);
  });

  it("passes only the user-selected file and selected layer ref to the parse callback", async () => {
    const calls: unknown[] = [];
    const panel = createPanel((command) => calls.push(command));
    const file = {
      name: "sample_model.psd",
      size: 22_406_225,
      type: "image/vnd.adobe.photoshop"
    } as File;

    setNamedFieldFiles(panel, "explicitPsdFile", [file]);
    setNamedFieldValue(panel, "selectedLayerNodeRef", "psd:root/layer[0]");
    findByTestId(panel, editorTestIds.explicitPsdImportForm)?.emit("submit");
    await Promise.resolve();

    expect(calls).toEqual([
      {
        file,
        selectedLayerNodeRef: "psd:root/layer[0]"
      }
    ]);
  });

  it("keeps empty submit local", async () => {
    const calls: unknown[] = [];
    const panel = createPanel((command) => calls.push(command));

    findByTestId(panel, editorTestIds.explicitPsdImportForm)?.emit("submit");
    await Promise.resolve();

    expect(calls).toEqual([]);
    expect(findByTestId(panel, editorTestIds.explicitPsdImportForm)?.textContent).toContain(
      "Select a PSD file before parsing."
    );
  });

  it("lets a parsed layer tree radio update the selected layer for intake", async () => {
    const calls: unknown[] = [];
    const panel = createPanel({
      viewModel: projectExplicitPsdImportViewModel(createParsedState()),
      onIntakeSelectedLayer: (command) => calls.push(command)
    });

    const secondLayerChoice = findByValue(panel, "layer_headwear");
    secondLayerChoice.checked = true;
    secondLayerChoice.emit("change");
    setNamedFieldValue(panel, "destinationKind", "existingPart");
    setNamedFieldValue(panel, "destinationExistingPartId", "part_root");
    setNamedFieldValue(panel, "drawableDisplayName", "Headwear From PSD");
    findByTestId(panel, editorTestIds.explicitPsdImportLayerIntakeForm)?.emit("submit");
    await Promise.resolve();

    expect(calls).toEqual([{
      selectedLayerNodeRef: "layer_headwear",
      destinationPart: {
        destinationKind: "existingPart",
        partId: "part_root"
      },
      drawableDisplayName: "Headwear From PSD"
    }]);
  });

  it("supports creating a new destination part for the selected layer intake", async () => {
    const calls: unknown[] = [];
    const panel = createPanel({
      viewModel: projectExplicitPsdImportViewModel(createParsedState()),
      onIntakeSelectedLayer: (command) => calls.push(command)
    });

    setNamedFieldValue(panel, "destinationKind", "newPart");
    setNamedFieldValue(panel, "destinationNewPartName", "Headwear");
    setNamedFieldValue(panel, "destinationParentPartId", "part_root");
    setNamedFieldValue(panel, "selectedLayerNodeRef", "layer_headwear");
    setNamedFieldValue(panel, "drawableDisplayName", "Headwear");
    findByTestId(panel, editorTestIds.explicitPsdImportLayerIntakeForm)?.emit("submit");
    await Promise.resolve();

    expect(calls).toEqual([{
      selectedLayerNodeRef: "layer_headwear",
      destinationPart: {
        destinationKind: "newPart",
        displayName: "Headwear",
        parentPartId: "part_root"
      },
      drawableDisplayName: "Headwear"
    }]);
  });

  it("submits an explicit selected leaf layer batch with a destination parent part", async () => {
    const calls: unknown[] = [];
    const panel = createPanel({
      viewModel: projectExplicitPsdImportViewModel(createParsedState()),
      onIntakeSelectedLayersBatch: (command) => calls.push(command)
    });

    const headwearChoice = findByNameAndValue(
      panel,
      "explicitPsdLeafLayerBatchSelection",
      "layer_headwear"
    );
    headwearChoice.checked = true;
    headwearChoice.emit("change");
    setNamedFieldValue(panel, "batchDestinationParentPartId", "part_root");
    findByTestId(panel, editorTestIds.explicitPsdImportBatchIntakeForm)?.emit("submit");
    await Promise.resolve();

    expect(findByTestId(panel, editorTestIds.explicitPsdImportBatchLayerRefs)?.value).toContain(
      "layer_face"
    );
    expect(findByTestId(panel, editorTestIds.explicitPsdImportBatchLayerRefs)?.value).toContain(
      "layer_headwear"
    );
    expect(calls).toEqual([{
      selectedLayerNodeRefs: ["layer_face", "layer_headwear"],
      destinationParentPartId: "part_root"
    }]);
  });

  it("updates import-plan preview approval from eligible candidate checkboxes only", async () => {
    const calls: unknown[] = [];
    const panel = createPanel({
      viewModel: projectExplicitPsdImportViewModel(createParsedStateWithImportPlan()),
      onGenerateImportPlanPreview: (command) => calls.push(command)
    });

    const headwearChoice = findByNameAndValue(
      panel,
      "explicitPsdImportPlanCandidateApproval",
      "layer_headwear"
    );
    const hiddenChoice = findByNameAndValue(
      panel,
      "explicitPsdImportPlanCandidateApproval",
      "layer_hidden"
    );
    headwearChoice.checked = false;
    headwearChoice.emit("change");
    hiddenChoice.checked = true;
    hiddenChoice.emit("change");
    findByTestId(panel, editorTestIds.explicitPsdImportPlanForm)?.emit("submit");
    await Promise.resolve();

    expect(hiddenChoice.disabled).toBe(true);
    expect(findByTestId(panel, editorTestIds.explicitPsdImportPlanApprovedRefs)?.value).toBe("");
    expect(calls).toEqual([{
      scopeRef: "psd:root",
      approvedLayerNodeRefs: [],
      destinationParentPartId: "part_root"
    }]);
  });

  it("submits approved import-plan execution without sending not-approved refs from the panel", async () => {
    const calls: unknown[] = [];
    const panel = createPanel({
      viewModel: projectExplicitPsdImportViewModel(createParsedStateWithImportPlan()),
      onIntakeApprovedImportPlanCandidates: (command) => calls.push(command)
    });

    findByTestId(panel, editorTestIds.explicitPsdImportPlanApprovedBatchForm)?.emit("submit");
    await Promise.resolve();

    expect(findByTestId(panel, editorTestIds.explicitPsdImportPlanPreview)?.textContent).toContain(
      "sha256:aaaaaaaa"
    );
    expect(findByTestId(panel, editorTestIds.explicitPsdImportPlanCandidates)?.textContent).toContain(
      "layer_hidden"
    );
    expect(calls).toEqual([{
      destinationParentPartId: "part_root"
    }]);
  });

  it("blocks stale approved import-plan execution until changed approvals regenerate preview", async () => {
    const previewCalls: unknown[] = [];
    const intakeCalls: unknown[] = [];
    const panel = createPanel({
      viewModel: projectExplicitPsdImportViewModel(createParsedStateWithImportPlan()),
      onGenerateImportPlanPreview: (command) => previewCalls.push(command),
      onIntakeApprovedImportPlanCandidates: (command) => intakeCalls.push(command)
    });

    const headwearChoice = findByNameAndValue(
      panel,
      "explicitPsdImportPlanCandidateApproval",
      "layer_headwear"
    );
    const eyewearChoice = findByNameAndValue(
      panel,
      "explicitPsdImportPlanCandidateApproval",
      "layer_eyewear"
    );
    headwearChoice.checked = false;
    headwearChoice.emit("change");
    eyewearChoice.checked = true;
    eyewearChoice.emit("change");
    findByTestId(panel, editorTestIds.explicitPsdImportPlanApprovedBatchForm)?.emit("submit");
    await Promise.resolve();

    expect(findByTestId(panel, editorTestIds.explicitPsdImportPlanApprovedBatchSubmit)?.disabled).toBe(true);
    expect(findByTestId(panel, editorTestIds.explicitPsdImportPlanApprovedBatchForm)?.textContent).toContain(
      "Update the import-plan preview before adding approved leaf candidates."
    );
    expect(intakeCalls).toEqual([]);

    findByTestId(panel, editorTestIds.explicitPsdImportPlanForm)?.emit("submit");
    await Promise.resolve();
    expect(previewCalls).toEqual([{
      scopeRef: "psd:root",
      approvedLayerNodeRefs: ["layer_eyewear"],
      destinationParentPartId: "part_root"
    }]);

    const regeneratedIntakeCalls: unknown[] = [];
    const regeneratedPanel = createPanel({
      viewModel: projectExplicitPsdImportViewModel(createParsedStateWithImportPlan({
        approvedLayerRefs: ["layer_eyewear"]
      })),
      onIntakeApprovedImportPlanCandidates: (command) => regeneratedIntakeCalls.push(command)
    });
    findByTestId(regeneratedPanel, editorTestIds.explicitPsdImportPlanApprovedBatchForm)?.emit("submit");
    await Promise.resolve();

    expect(findByTestId(regeneratedPanel, editorTestIds.explicitPsdImportPlanApprovedBatchSubmit)?.disabled).toBe(false);
    expect(regeneratedIntakeCalls).toEqual([{
      destinationParentPartId: "part_root"
    }]);
  });

  it("keeps group rows out of selected leaf layer batch controls and avoids broad import wording", () => {
    const panel = createPanel({
      viewModel: projectExplicitPsdImportViewModel(createParsedState()),
      onIntakeSelectedLayersBatch: () => {}
    });
    const groupChoice = findByNameAndValue(
      panel,
      "explicitPsdLeafLayerBatchSelection",
      "group_accessories"
    );
    const text = panel.textContent.toLowerCase();

    expect(groupChoice.disabled).toBe(true);
    expect(text).not.toContain("import all");
    expect(text).not.toContain("all-layer");
    expect(text).not.toContain("all layer");
    expect(text).not.toContain("recursive");
    expect(text).not.toContain("group import");
  });
});

const createPanel = (
  options: {
    readonly viewModel?: Parameters<typeof createExplicitPsdImportPanel>[0]["viewModel"];
    readonly onParsePsdFile?: Parameters<typeof createExplicitPsdImportPanel>[0]["onParsePsdFile"];
    readonly onIntakeSelectedLayer?: Parameters<typeof createExplicitPsdImportPanel>[0]["onIntakeSelectedLayer"];
    readonly onIntakeSelectedLayersBatch?: Parameters<typeof createExplicitPsdImportPanel>[0]["onIntakeSelectedLayersBatch"];
    readonly onGenerateImportPlanPreview?: Parameters<typeof createExplicitPsdImportPanel>[0]["onGenerateImportPlanPreview"];
    readonly onIntakeApprovedImportPlanCandidates?: Parameters<typeof createExplicitPsdImportPanel>[0]["onIntakeApprovedImportPlanCandidates"];
  } | Parameters<typeof createExplicitPsdImportPanel>[0]["onParsePsdFile"] = {}
): TestElement => {
  const normalized = typeof options === "function" ? { onParsePsdFile: options } : options;
  return (
  createExplicitPsdImportPanel({
    viewModel: normalized.viewModel ?? projectExplicitPsdImportViewModel(createEmptyExplicitPsdImportState()),
    destinationParts: [{ partId: "part_root", label: "Root / part_root" }],
    onParsePsdFile: normalized.onParsePsdFile ?? (() => {}),
    onIntakeSelectedLayer: normalized.onIntakeSelectedLayer ?? (() => {}),
    ...(normalized.onIntakeSelectedLayersBatch === undefined
      ? {}
      : { onIntakeSelectedLayersBatch: normalized.onIntakeSelectedLayersBatch }),
    ...(normalized.onGenerateImportPlanPreview === undefined
      ? {}
      : { onGenerateImportPlanPreview: normalized.onGenerateImportPlanPreview }),
    ...(normalized.onIntakeApprovedImportPlanCandidates === undefined
      ? {}
      : { onIntakeApprovedImportPlanCandidates: normalized.onIntakeApprovedImportPlanCandidates })
  }) as unknown as TestElement
  );
};

const findByTestId = (root: TestElement, testId: string): TestElement | null =>
  root.queryByPredicate((element) => element.dataset.testid === testId);

const findNamedField = (root: TestElement, name: string): TestElement | null =>
  root.queryByPredicate((element) => element.name === name);

const findByValue = (root: TestElement, value: string): TestElement => {
  const field = root.queryByPredicate((element) => element.value === value);
  if (field === null) {
    throw new Error(`Missing value ${value}.`);
  }

  return field;
};

const findByNameAndValue = (root: TestElement, name: string, value: string): TestElement => {
  const field = root.queryByPredicate((element) => element.name === name && element.value === value);
  if (field === null) {
    throw new Error(`Missing field ${name}=${value}.`);
  }

  return field;
};

const setNamedFieldValue = (root: TestElement, name: string, value: string): void => {
  const field = findNamedField(root, name);
  if (field === null) {
    throw new Error(`Missing field ${name}.`);
  }

  field.value = value;
};

const setNamedFieldFiles = (
  root: TestElement,
  name: string,
  files: readonly File[]
): void => {
  const field = findNamedField(root, name);
  if (field === null) {
    throw new Error(`Missing file field ${name}.`);
  }

  field.files = createTestFileList(files);
};

const createTestFileList = (files: readonly File[]): FileList =>
  ({
    length: files.length,
    item(index: number): File | null {
      return files[index] ?? null;
    }
  }) as FileList;

const createParsedState = () =>
  projectExplicitPsdImportStateFromBridgeResult({
    status: "parsed",
    source: {
      fileName: "sample_model.psd",
      declaredMediaType: "image/vnd.adobe.photoshop",
      byteLength: 16,
      sizeCapBytes: 32 * 1024 * 1024,
      intakeKind: "explicitFile",
      privacy: {
        publicDistribution: "notPublicDistributable",
        rawBytesPersistence: "notPersistedByParserBridge"
      }
    },
    adapterResult: {
      schemaVersion: "psd-adapter-result-v1",
      sourceProfile: "layered-character-psd-profile-v1",
      adapterName: "test-browser-psd-adapter",
      adapterVersion: "0.1.0",
      intakeKind: "realPsdParseResult",
      parser: {
        evidenceKind: "psd-parser-evidence-v1",
        parserName: "webtoonPsd",
        parserPackageName: "@webtoon/psd",
        parserVersion: "0.4.0",
        runtime: "browser",
        privateShapePolicy: "parser-private-shape-excluded-v1"
      },
      canvas: { width: 64, height: 64 },
      sourceGroups: [
        {
          sourceGroupId: "group_accessories",
          originalName: "Accessories",
          normalizedName: "Accessories",
          groupPath: ["Accessories"],
          sourceOrder: 2,
          visibleInSource: true,
          opacityInSource: 1,
          unsupportedFeatures: []
        }
      ],
      sourceLayers: [
        {
          sourceLayerId: "layer_face",
          originalName: "Face",
          normalizedName: "Face",
          groupPath: [],
          sourceOrder: 0,
          bounds: { x: 0, y: 0, width: 16, height: 16 },
          visibleInSource: true,
          opacityInSource: 1,
          role: "editableLayer",
          unsupportedFeatures: []
        },
        {
          sourceLayerId: "layer_headwear",
          originalName: "Headwear",
          normalizedName: "Headwear",
          groupPath: [],
          sourceOrder: 1,
          bounds: { x: 0, y: 0, width: 8, height: 8 },
          visibleInSource: true,
          opacityInSource: 1,
          role: "editableLayer",
          unsupportedFeatures: []
        }
      ],
      unsupportedFeatures: [],
      diagnostics: []
    },
    diagnostics: [],
    errorEvidence: []
  }, { selectedLayerNodeRef: "layer_face" });

const createParsedStateWithImportPlan = (options: {
  readonly approvedLayerRefs?: readonly string[];
} = {}): ExplicitPsdImportState => {
  const approvedLayerRefs = options.approvedLayerRefs ?? ["layer_headwear"];
  const isApproved = (layerRef: string): boolean => approvedLayerRefs.includes(layerRef);
  const approvalOrder = (layerRef: string): number | null => {
    const index = approvedLayerRefs.indexOf(layerRef);
    return index < 0 ? null : index;
  };
  const candidateStatuses = (layerRef: string): ExplicitPsdImportPlanCandidateState["statuses"] =>
    isApproved(layerRef) ? ["candidate"] : ["candidate", "notApproved"];

  return ({
  ...createParsedState(),
  selectedLayerNodeRefs: approvedLayerRefs,
  importPlan: {
    status: "ready" as const,
    planId: "plan_test",
    candidatePlanDigest: `sha256:${"a".repeat(64)}`,
    sourceFileName: "sample_model.psd",
    sourceByteLength: 16,
    sourceDigest: `sha256:${"b".repeat(64)}`,
    sourceProvenanceLabel: "private/local / notPublicDistributable / metadataOnlyNoRawBytes / notPersisted",
    parserLabel: "webtoonPsd / @webtoon/psd / 0.4.0 / browser",
    scopeRef: "psd:root",
    scopeLabel: "psd:root",
    destinationParentPartId: "part_root",
    candidateCount: 3,
    eligibleCandidateCount: 2,
    approvedCount: approvedLayerRefs.length,
    notApprovedCount: 3 - approvedLayerRefs.length,
    hiddenCount: 1,
    unsupportedCount: 1,
    collisionCount: 0,
    byteCapBlockedCount: 0,
    totalRawRgbaByteEstimate: 528,
    approvedRawRgbaByteEstimate: approvedLayerRefs.length * 256,
    candidates: [
      {
        layerRef: "layer_headwear",
        displayName: "Headwear",
        fullPathLabel: "Headwear",
        parentGroupPathLabel: null,
        boundsLabel: "0,0 8x8",
        visibleInSource: true,
        opacityInSource: 1,
        sourceOrder: 1,
        rawRgbaByteEstimate: 256,
        statuses: candidateStatuses("layer_headwear"),
        statusReasons: ["Visible positive-size leaf is eligible for explicit approval."],
        defaultSelection: "notApproved" as const,
        requestedApproval: isApproved("layer_headwear"),
        approved: isApproved("layer_headwear"),
        approvedOrder: approvalOrder("layer_headwear"),
        approvalBlockedReasons: [],
        generatedPartId: "part_headwear",
        generatedDrawableId: "draw_headwear",
        generatedTextureId: "tex_headwear",
        generatedMeshId: "mesh_headwear"
      },
      {
        layerRef: "layer_eyewear",
        displayName: "Eyewear",
        fullPathLabel: "Eyewear",
        parentGroupPathLabel: null,
        boundsLabel: "0,0 8x8",
        visibleInSource: true,
        opacityInSource: 1,
        sourceOrder: 2,
        rawRgbaByteEstimate: 256,
        statuses: candidateStatuses("layer_eyewear"),
        statusReasons: ["Visible positive-size leaf is eligible for explicit approval."],
        defaultSelection: "notApproved" as const,
        requestedApproval: isApproved("layer_eyewear"),
        approved: isApproved("layer_eyewear"),
        approvedOrder: approvalOrder("layer_eyewear"),
        approvalBlockedReasons: [],
        generatedPartId: "part_eyewear",
        generatedDrawableId: "draw_eyewear",
        generatedTextureId: "tex_eyewear",
        generatedMeshId: "mesh_eyewear"
      },
      {
        layerRef: "layer_hidden",
        displayName: "Hidden",
        fullPathLabel: "Hidden",
        parentGroupPathLabel: null,
        boundsLabel: "0,0 2x2",
        visibleInSource: false,
        opacityInSource: 1,
        sourceOrder: 2,
        rawRgbaByteEstimate: 16,
        statuses: ["hidden", "unsupported", "notApproved"] as const,
        statusReasons: ["Hidden layer approval is not supported by the v0 import plan."],
        defaultSelection: "notApproved" as const,
        requestedApproval: false,
        approved: false,
        approvedOrder: null,
        approvalBlockedReasons: ["hiddenLayerUnsupported"],
        generatedPartId: "part_hidden",
        generatedDrawableId: "draw_hidden",
        generatedTextureId: "tex_hidden",
        generatedMeshId: "mesh_hidden"
      }
    ],
    diagnostics: [{
      checkId: "browserPsdImportPlan.candidatePlan.ready",
      severity: "info" as const,
      message: "Browser PSD import plan leaf candidates were generated from parser-free session evidence."
    }]
  }
  });
};

class TestElement {
  readonly children: TestElement[] = [];
  readonly dataset: Record<string, string> = {};
  readonly attributes = new Map<string, string>();
  readonly listeners = new Map<string, Array<(event: { preventDefault(): void }) => void>>();
  readonly style: Record<string, string> = {};
  parentElement: TestElement | null = null;
  className = "";
  id = "";
  type = "";
  value = "";
  name = "";
  autocomplete = "";
  accept = "";
  checked = false;
  disabled = false;
  files: FileList | null = null;
  private ownText = "";

  constructor(readonly tagName: string) {}

  get textContent(): string {
    return `${this.ownText}${this.children.map((child) => child.textContent).join("")}`;
  }

  set textContent(value: string | null) {
    this.ownText = value ?? "";
    this.children.splice(0, this.children.length);
  }

  append(...nodes: Array<TestElement | string>): void {
    for (const node of nodes) {
      if (typeof node === "string") {
        const text = new TestElement("#text");
        text.textContent = node;
        this.append(text);
        continue;
      }

      node.parentElement = this;
      this.children.push(node);
    }
  }

  replaceChildren(...nodes: TestElement[]): void {
    this.children.splice(0, this.children.length);
    this.append(...nodes);
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
    if (name === "id") {
      this.id = value;
    }
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }

  addEventListener(type: string, listener: (event: { preventDefault(): void }) => void): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }

  emit(type: string): void {
    const event = { preventDefault() {} };
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event);
    }
  }

  queryByPredicate(predicate: (element: TestElement) => boolean): TestElement | null {
    if (predicate(this)) {
      return this;
    }

    for (const child of this.children) {
      const match = child.queryByPredicate(predicate);
      if (match !== null) {
        return match;
      }
    }

    return null;
  }

  querySelector(selector: string): TestElement | null {
    return this.querySelectorAll(selector)[0] ?? null;
  }

  querySelectorAll<T = TestElement>(selector: string): T[] {
    const matches: TestElement[] = [];
    this.collectSelectorMatches(selector, matches);
    return matches as T[];
  }

  private collectSelectorMatches(selector: string, matches: TestElement[]): void {
    if (this.matchesSelector(selector)) {
      matches.push(this);
    }

    for (const child of this.children) {
      child.collectSelectorMatches(selector, matches);
    }
  }

  private matchesSelector(selector: string): boolean {
    const dataTestId = selector.match(/^\[data-testid="(.+)"\]$/)?.[1];
    if (dataTestId !== undefined) {
      return this.dataset.testid === dataTestId;
    }

    const inputName = selector.match(/^input\[name="(.+)"\]$/)?.[1];
    if (inputName !== undefined) {
      return this.tagName === "input" && this.name === inputName;
    }

    return false;
  }
}

const installTestDocument = (): void => {
  const document = {
    createElement(tagName: string) {
      return new TestElement(tagName);
    }
  };

  (globalThis as unknown as { document: Document }).document = document as unknown as Document;
};
