import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  DynamicsGroupIdSchema,
  ParameterIdSchema
} from "@private-2d-rigging-lab/contracts";

import {
  createDynamicsGroupUpdateTestId,
  editorTestIds,
  projectEditorWorkflowViewModel,
  projectLoadedPackageState
} from "../../editor-state/index.js";
import { createDynamicsPanel } from "./dynamics-panel.js";

describe("editor dynamics panel", () => {
  let originalFormData: typeof FormData | undefined;

  beforeEach(() => {
    installTestDocument();
    originalFormData = globalThis.FormData;
    (globalThis as unknown as { FormData: typeof FormData }).FormData =
      TestFormData as unknown as typeof FormData;
  });

  afterEach(() => {
    delete (globalThis as Partial<{ document: Document }>).document;
    if (originalFormData === undefined) {
      delete (globalThis as Partial<{ FormData: typeof FormData }>).FormData;
    } else {
      globalThis.FormData = originalFormData;
    }
  });

  it("submits a create command using the new computed output path", () => {
    const state = createDynamicsPanelState({ includeGroup: false });
    const calls: unknown[] = [];
    const panel = createDynamicsPanel({
      state,
      viewModel: projectEditorWorkflowViewModel(state),
      onCommitCreateDynamicsGroup(command) {
        calls.push(command);
      },
      onCommitUpdateDynamicsGroup() {},
      onRunDynamicsPreview() {},
      onResetDynamicsPreview() {}
    }) as unknown as TestElement;

    findByTestId(panel, editorTestIds.dynamicsCreateForm)?.emit("submit");

    expect(calls).toEqual([
      {
        displayName: "Open Dynamics Sway",
        enabled: true,
        driverParameterId: "param_body_yaw",
        outputParameterDisplayName: "Dynamics Output",
        outputMin: -1,
        outputMax: 1,
        outputScale: 1,
        outputOffset: 0,
        resetPolicy: "reset-on-manual-command",
        stiffness: 0.25,
        damping: 0.35,
        maxVelocity: 2,
        maxAmplitude: 1
      }
    ]);
  });

  it("submits an update command from an existing dynamics group form", () => {
    const state = createDynamicsPanelState({ includeGroup: true });
    const calls: unknown[] = [];
    const panel = createDynamicsPanel({
      state,
      viewModel: projectEditorWorkflowViewModel(state),
      onCommitCreateDynamicsGroup() {},
      onCommitUpdateDynamicsGroup(command) {
        calls.push(command);
      },
      onRunDynamicsPreview() {},
      onResetDynamicsPreview() {}
    }) as unknown as TestElement;
    const updateForm = findByTestId(panel, createDynamicsGroupUpdateTestId("dyn_hair_sway"));
    if (updateForm === null) {
      throw new Error("Expected dynamics update form.");
    }

    setNamedFieldValue(updateForm, "displayName", "Hair Follow");
    setNamedFieldValue(updateForm, "enabled", "false");
    setNamedFieldValue(updateForm, "resetPolicy", "reset-on-large-input-jump");
    updateForm.emit("submit");

    expect(calls).toEqual([
      {
        dynamicsGroupId: "dyn_hair_sway",
        displayName: "Hair Follow",
        enabled: false,
        resetPolicy: "reset-on-large-input-jump"
      }
    ]);
  });
});

const createDynamicsPanelState = (input: {
  readonly includeGroup: boolean;
}) =>
  projectLoadedPackageState({
    identity: {
      packageId: "pkg_dynamics_panel",
      packageDisplayName: "Dynamics Panel Package",
      formatVersion: "open-model-package-v1"
    },
    revision: {
      packageRevision: 1,
      authoringRevision: 1
    },
    parameters: [
      {
        parameterId: "param_body_yaw",
        displayName: "Body Yaw",
        valueSource: "authoredInput",
        min: -1,
        max: 1,
        default: 0,
        recommendedUiStep: 0.01
      },
      {
        parameterId: "param_hair_sway",
        displayName: "Hair Sway",
        valueSource: "computedDynamics",
        min: -1,
        max: 1,
        default: 0,
        recommendedUiStep: 0.01
      }
    ],
    dynamicsGroups: input.includeGroup
      ? [
          {
            dynamicsGroupId: DynamicsGroupIdSchema.parse("dyn_hair_sway"),
            displayName: "Hair Sway",
            enabled: true,
            solverKind: "scalarDampedFollowV1",
            drivers: [
              {
                driverId: "drv_body_yaw",
                sourceParameterId: ParameterIdSchema.parse("param_body_yaw"),
                inputScale: 1,
                inputOffset: 0,
                invert: false
              }
            ],
            output: {
              outputId: "out_hair_sway",
              targetParameterId: ParameterIdSchema.parse("param_hair_sway"),
              outputScale: 1,
              outputOffset: 0,
              min: -1,
              max: 1,
              clampPolicy: "clamp-to-output-range"
            },
            settings: {
              stiffness: 0.25,
              damping: 0.35,
              maxVelocity: 2,
              maxAmplitude: 1
            },
            resetPolicy: "reset-on-manual-command"
          }
        ]
      : []
  });

const findByTestId = (root: TestElement, testId: string): TestElement | null =>
  root.queryByPredicate((element) => element.dataset.testid === testId);

const setNamedFieldValue = (
  root: TestElement,
  name: string,
  value: string
): void => {
  const field = root.queryByPredicate((element) => element.name === name);
  if (field === null) {
    throw new Error(`Missing field ${name}.`);
  }

  field.value = value;
};

class TestFormData {
  private readonly values = new Map<string, string>();

  constructor(form: TestElement) {
    for (const field of form.queryAllByPredicate((element) => element.name.length > 0)) {
      if (field.type === "checkbox" && !field.checked) {
        continue;
      }

      this.values.set(field.name, readFormFieldValue(field));
    }
  }

  get(name: string): string | null {
    return this.values.get(name) ?? null;
  }
}

const readFormFieldValue = (field: TestElement): string => {
  if (field.tagName !== "select") {
    return field.type === "checkbox" ? "on" : field.value;
  }

  if (field.value.length > 0) {
    return field.value;
  }

  const selected = field.children.find((child) => child.selected) ?? field.children[0];
  return selected?.value ?? "";
};

class TestElement {
  readonly children: TestElement[] = [];
  readonly dataset: Record<string, string> = {};
  readonly attributes = new Map<string, string>();
  readonly listeners = new Map<string, Array<(event: { preventDefault(): void }) => void>>();
  readonly style: Record<string, string> = {};
  readonly classList = {
    add: (...classNames: string[]) => {
      this.className = [...new Set([...this.className.split(" ").filter(Boolean), ...classNames])].join(" ");
    }
  };
  parentElement: TestElement | null = null;
  className = "";
  id = "";
  htmlFor = "";
  type = "";
  min = "";
  max = "";
  step = "";
  value = "";
  name = "";
  autocomplete = "";
  required = false;
  disabled = false;
  checked = false;
  selected = false;
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

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
    if (name === "id") {
      this.id = value;
    }
  }

  addEventListener(type: string, listener: (event: { preventDefault(): void }) => void): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }

  emit(type: string): void {
    const event = {
      preventDefault() {}
    };
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

  queryAllByPredicate(predicate: (element: TestElement) => boolean): readonly TestElement[] {
    return [
      ...(predicate(this) ? [this] : []),
      ...this.children.flatMap((child) => child.queryAllByPredicate(predicate))
    ];
  }

  querySelector(selector: string): TestElement | null {
    return this.queryByPredicate((element) => element.tagName === selector);
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
