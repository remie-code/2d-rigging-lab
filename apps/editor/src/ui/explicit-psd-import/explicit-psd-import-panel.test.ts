import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  createEmptyExplicitPsdImportState,
  editorTestIds,
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
});

const createPanel = (
  onParsePsdFile: Parameters<typeof createExplicitPsdImportPanel>[0]["onParsePsdFile"] = () => {}
): TestElement =>
  createExplicitPsdImportPanel({
    viewModel: projectExplicitPsdImportViewModel(createEmptyExplicitPsdImportState()),
    onParsePsdFile
  }) as unknown as TestElement;

const findByTestId = (root: TestElement, testId: string): TestElement | null =>
  root.queryByPredicate((element) => element.dataset.testid === testId);

const findNamedField = (root: TestElement, name: string): TestElement | null =>
  root.queryByPredicate((element) => element.name === name);

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
