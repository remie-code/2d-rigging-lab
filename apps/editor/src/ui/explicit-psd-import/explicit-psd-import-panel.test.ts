import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  createEmptyExplicitPsdImportState,
  editorTestIds,
  projectExplicitPsdImportStateFromBridgeResult,
  projectExplicitPsdImportViewModel
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
});

const createPanel = (
  options: {
    readonly viewModel?: Parameters<typeof createExplicitPsdImportPanel>[0]["viewModel"];
    readonly onParsePsdFile?: Parameters<typeof createExplicitPsdImportPanel>[0]["onParsePsdFile"];
    readonly onIntakeSelectedLayer?: Parameters<typeof createExplicitPsdImportPanel>[0]["onIntakeSelectedLayer"];
  } | Parameters<typeof createExplicitPsdImportPanel>[0]["onParsePsdFile"] = {}
): TestElement => {
  const normalized = typeof options === "function" ? { onParsePsdFile: options } : options;
  return (
  createExplicitPsdImportPanel({
    viewModel: normalized.viewModel ?? projectExplicitPsdImportViewModel(createEmptyExplicitPsdImportState()),
    destinationParts: [{ partId: "part_root", label: "Root / part_root" }],
    onParsePsdFile: normalized.onParsePsdFile ?? (() => {}),
    onIntakeSelectedLayer: normalized.onIntakeSelectedLayer ?? (() => {})
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
      sourceGroups: [],
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
}

const installTestDocument = (): void => {
  const document = {
    createElement(tagName: string) {
      return new TestElement(tagName);
    }
  };

  (globalThis as unknown as { document: Document }).document = document as unknown as Document;
};
