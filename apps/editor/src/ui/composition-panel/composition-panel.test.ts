import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  DrawableIdSchema,
  KeyformSetIdSchema,
  MaskRelationIdSchema,
  MeshIdSchema,
  PackageIdSchema,
  ParameterIdSchema,
  PartIdSchema,
  ProvenanceIdSchema,
  RuntimeSnapshotIdSchema,
  SourceAssetIdSchema,
  TextureIdSchema
} from "@private-2d-rigging-lab/contracts";
import type {
  DrawableDto,
  KeyformSetDto,
  MaskRelationDto,
  MeshDto,
  ParameterDto
} from "@private-2d-rigging-lab/package-format";

import type { EditorPreviewProjectionDto } from "../../editor-preview/preview-dto.js";
import {
  editorTestIds,
  projectEditorWorkflowViewModel,
  projectLoadedPackageState
} from "../../editor-state/index.js";
import { createCompositionPanel } from "./composition-panel.js";

describe("editor composition panel", () => {
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

  it("submits a semantic mask relation command from selected drawables", () => {
    const state = createCompositionPanelState();
    const calls: unknown[] = [];
    const panel = createCompositionPanel({
      state,
      viewModel: projectEditorWorkflowViewModel(state),
      preview: null,
      viewerRuntimeProjection: null,
      onCommitSetMaskRelation(command) {
        calls.push(command);
      },
      onCommitAddDrawableOpacityKeyform() {}
    }) as unknown as TestElement;
    const form = findByTestId(panel, editorTestIds.compositionMaskRelationForm);
    if (form === null) {
      throw new Error("Expected composition mask relation form.");
    }

    expect(form.attributes.get("aria-label")).toBe("Commit semantic mask relation");
    setNamedFieldValue(form, "maskRelationId", "maskrel_panel_body_face");
    setSelectOptionSelected(form, "maskDrawableIds", "draw_mask", true);
    setSelectOptionSelected(form, "targetDrawableIds", "draw_target", true);
    form.emit("submit");

    expect(calls).toEqual([
      {
        maskRelationId: "maskrel_panel_body_face",
        maskDrawableIds: ["draw_mask"],
        targetDrawableIds: ["draw_target"],
        enabled: true
      }
    ]);
  });

  it("blocks invalid mask relation fields with deterministic visible diagnostics", () => {
    const state = createCompositionPanelState();
    const calls: unknown[] = [];
    const panel = createCompositionPanel({
      state,
      viewModel: projectEditorWorkflowViewModel(state),
      preview: null,
      viewerRuntimeProjection: null,
      onCommitSetMaskRelation(command) {
        calls.push(command);
      },
      onCommitAddDrawableOpacityKeyform() {}
    }) as unknown as TestElement;
    const form = findByTestId(panel, editorTestIds.compositionMaskRelationForm);
    if (form === null) {
      throw new Error("Expected composition mask relation form.");
    }

    setNamedFieldValue(form, "maskRelationId", "bad_relation_id");
    form.emit("submit");
    expect(calls).toEqual([]);
    expect(form.textContent).toContain("Relation ID must use the maskrel_ prefix");

    setNamedFieldValue(form, "maskRelationId", "maskrel_self");
    setSelectOptionSelected(form, "maskDrawableIds", "draw_mask", true);
    setSelectOptionSelected(form, "targetDrawableIds", "draw_mask", true);
    form.emit("submit");

    expect(calls).toEqual([]);
    expect(form.textContent).toContain("Drawable cannot be both mask and target: draw_mask.");
  });

  it("submits drawable opacity keyform commands and renders authored evidence", () => {
    const state = createCompositionPanelState({
      maskRelations: [createMaskRelation()],
      keyformSets: [createDrawableOpacityKeyform()]
    });
    const calls: unknown[] = [];
    const panel = createCompositionPanel({
      state,
      viewModel: projectEditorWorkflowViewModel(state),
      preview: {
        schemaVersion: "editor-preview-projection-v1",
        sourceSnapshotId: RuntimeSnapshotIdSchema.parse("snap_source_panel"),
        packageId: PackageIdSchema.parse("pkg_composition_panel"),
        packageRevision: 1,
        snapshotDetail: "full",
        drawList: [DrawableIdSchema.parse("draw_target")],
        drawableCount: 1,
        visibleDrawableCount: 1,
        drawables: [
          {
            drawableId: DrawableIdSchema.parse("draw_target"),
            name: "Target Drawable",
            meshId: MeshIdSchema.parse("mesh_draw_target"),
            opacity: 0.25,
            visible: true,
            baseDrawOrder: 1,
            evaluatedDrawOrder: 1,
            projectionOrder: 0,
            drawListIndex: 0,
            bounds: { x: 0, y: 0, width: 10, height: 10 },
            geometry: {
              vertexCount: 4,
              vertexHash: "hash_panel_draw_target"
            },
            texture: {
              status: "resolved",
              textureId: TextureIdSchema.parse("tex_panel"),
              sourceAssetId: SourceAssetIdSchema.parse("src_panel"),
              projection: {
                kind: "uv",
                uvCount: 4
              }
            },
            keyformSampleCount: 1,
            diagnostics: createEmptyPreviewDiagnostics()
          }
        ],
        keyformSamples: {
          totalCount: 1,
          byEvaluator: [
            {
              evaluator: "linear-1d-v1",
              count: 1
            }
          ],
          byTarget: [
            {
              target: "drawable:draw_target.opacity",
              count: 1,
              evaluators: ["linear-1d-v1"]
            }
          ]
        },
        diagnostics: createEmptyPreviewDiagnostics()
      },
      viewerRuntimeProjection: null,
      onCommitSetMaskRelation() {},
      onCommitAddDrawableOpacityKeyform(command) {
        calls.push(command);
      }
    }) as unknown as TestElement;
    const form = findByTestId(panel, editorTestIds.compositionOpacityKeyformForm);
    const relationList = findByTestId(panel, editorTestIds.compositionMaskRelationList);
    const keyformList = findByTestId(panel, editorTestIds.compositionOpacityKeyformList);
    const evidence = findByTestId(panel, editorTestIds.compositionEvidence);
    if (form === null) {
      throw new Error("Expected composition opacity keyform form.");
    }

    expect(form.attributes.get("aria-label")).toBe("Add drawable opacity keyform");
    setNamedFieldValue(form, "parameterId", "param_body_yaw");
    setNamedFieldValue(form, "drawableId", "draw_target");
    setNamedFieldValue(form, "keyValue", "1");
    setNamedFieldValue(form, "opacity", "0.25");
    form.emit("submit");

    expect(calls).toEqual([
      {
        parameterId: "param_body_yaw",
        drawableId: "draw_target",
        keyValue: 1,
        opacity: 0.25
      }
    ]);
    expect(relationList?.textContent).toContain("maskrel_panel_mask_target");
    expect(keyformList?.textContent).toContain("keyset_draw_target_opacity");
    expect(keyformList?.textContent).toContain("0.25");
    expect(evidence?.textContent).toContain("snapshot snap_source_panel; 1 authored mask relation");
    expect(evidence?.textContent).toContain("draw_target: opacity 0.25 / visible");
  });

  it("blocks invalid drawable opacity keyforms with deterministic visible diagnostics", () => {
    const state = createCompositionPanelState();
    const calls: unknown[] = [];
    const panel = createCompositionPanel({
      state,
      viewModel: projectEditorWorkflowViewModel(state),
      preview: null,
      viewerRuntimeProjection: null,
      onCommitSetMaskRelation() {},
      onCommitAddDrawableOpacityKeyform(command) {
        calls.push(command);
      }
    }) as unknown as TestElement;
    const form = findByTestId(panel, editorTestIds.compositionOpacityKeyformForm);
    if (form === null) {
      throw new Error("Expected composition opacity keyform form.");
    }

    setNamedFieldValue(form, "parameterId", "param_body_yaw");
    setNamedFieldValue(form, "drawableId", "draw_target");
    setNamedFieldValue(form, "opacity", "1.5");
    form.emit("submit");
    expect(calls).toEqual([]);
    expect(form.textContent).toContain("Opacity must be between 0 and 1.");

    setNamedFieldValue(form, "opacity", "0.5");
    setNamedFieldValue(form, "parameterId", "param_missing");
    form.emit("submit");

    expect(calls).toEqual([]);
    expect(form.textContent).toContain("Selected parameter must be an authored input parameter.");
  });
});

const createCompositionPanelState = (input: {
  readonly maskRelations?: readonly MaskRelationDto[];
  readonly keyformSets?: readonly KeyformSetDto[];
} = {}) =>
  projectLoadedPackageState({
    identity: {
      packageId: "pkg_composition_panel",
      packageDisplayName: "Composition Panel Package",
      formatVersion: "open-model-package-v1"
    },
    revision: {
      packageRevision: 1,
      authoringRevision: 1
    },
    parts: [
      {
        partId: PartIdSchema.parse("part_root"),
        displayName: "Root",
        childPartIds: [],
        drawableIds: [
          DrawableIdSchema.parse("draw_mask"),
          DrawableIdSchema.parse("draw_target")
        ]
      }
    ],
    parameters: [createAuthoredParameter()],
    drawables: [
      createDrawable("draw_mask", "Mask Drawable", 1),
      createDrawable("draw_target", "Target Drawable", 0.8)
    ],
    meshes: [createMesh("mesh_draw_mask"), createMesh("mesh_draw_target")],
    masks: input.maskRelations ?? [],
    ...(input.keyformSets === undefined ? {} : { keyformSets: input.keyformSets })
  });

const createAuthoredParameter = (): ParameterDto => ({
  parameterId: ParameterIdSchema.parse("param_body_yaw"),
  displayName: "Body Yaw",
  semanticRole: "body",
  projectPresetAlias: "private-body-yaw",
  valueSource: "authoredInput",
  min: -1,
  max: 1,
  default: 0,
  recommendedUiStep: 0.01
});

const createDrawable = (
  drawableId: "draw_mask" | "draw_target",
  displayName: string,
  defaultOpacity: number
): DrawableDto => ({
  drawableId: DrawableIdSchema.parse(drawableId),
  displayName,
  sourceAssetId: SourceAssetIdSchema.parse("src_panel"),
  textureId: TextureIdSchema.parse("tex_panel"),
  meshId: MeshIdSchema.parse(`mesh_${drawableId}`),
  partId: PartIdSchema.parse("part_root"),
  defaultOpacity,
  runtimeVisibility: true,
  baseDrawOrder: drawableId === "draw_mask" ? 0 : 1,
  sourceProvenanceId: ProvenanceIdSchema.parse("prov_panel")
});

const createMesh = (meshId: "mesh_draw_mask" | "mesh_draw_target"): MeshDto => ({
  meshId: MeshIdSchema.parse(meshId),
  drawableId: DrawableIdSchema.parse(meshId.replace(/^mesh_/, "")),
  vertices: [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 0, y: 10 },
    { x: 10, y: 10 }
  ],
  uvs: [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: 1, y: 1 }
  ],
  triangles: [
    [0, 1, 2],
    [1, 3, 2]
  ],
  vertexStableIds: [
    `${meshId}_v0`,
    `${meshId}_v1`,
    `${meshId}_v2`,
    `${meshId}_v3`
  ],
  bounds: { x: 0, y: 0, width: 10, height: 10 },
  generationProvenanceId: ProvenanceIdSchema.parse("prov_panel")
});

const createMaskRelation = (): MaskRelationDto => ({
  maskRelationId: MaskRelationIdSchema.parse("maskrel_panel_mask_target"),
  maskDrawableIds: [DrawableIdSchema.parse("draw_mask")],
  targetDrawableIds: [DrawableIdSchema.parse("draw_target")],
  enabled: true
});

const createDrawableOpacityKeyform = (): KeyformSetDto => ({
  keyformSetId: KeyformSetIdSchema.parse("keyset_draw_target_opacity"),
  target: {
    kind: "drawable",
    id: "draw_target",
    property: "opacity"
  },
  parameterId: ParameterIdSchema.parse("param_body_yaw"),
  evaluator: "linear-1d-v1",
  interpolation: "linear-1d-v1",
  compositionMode: "replace",
  compositionOrder: 0,
  keys: [
    {
      value: 1,
      statePatch: 0.25
    }
  ]
});

const createEmptyPreviewDiagnostics = (): EditorPreviewProjectionDto["diagnostics"] => ({
  totalCount: 0,
  bySeverity: {
    info: 0,
    warning: 0,
    error: 0,
    blocking: 0
  },
  byStatus: {
    pass: 0,
    warning: 0,
    fail: 0,
    needs_review: 0,
    not_applicable: 0
  },
  blockingCount: 0,
  errorCount: 0,
  warningCount: 0,
  items: []
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
  field.valueWasSet = true;
};

const setSelectOptionSelected = (
  root: TestElement,
  name: string,
  value: string,
  selected: boolean
): void => {
  const field = root.queryByPredicate((element) => element.name === name);
  if (field === null) {
    throw new Error(`Missing select ${name}.`);
  }
  const option = field.children.find((child) => child.value === value);
  if (option === undefined) {
    throw new Error(`Missing option ${value}.`);
  }

  option.selected = selected;
};

class TestFormData {
  private readonly values = new Map<string, string[]>();

  constructor(form: TestElement) {
    for (const field of form.queryAllByPredicate((element) => element.name.length > 0)) {
      if (field.type === "checkbox" && !field.checked) {
        continue;
      }

      const values = readFormFieldValues(field);
      if (values.length > 0) {
        this.values.set(field.name, [...(this.values.get(field.name) ?? []), ...values]);
      }
    }
  }

  get(name: string): string | null {
    return this.values.get(name)?.[0] ?? null;
  }

  getAll(name: string): readonly string[] {
    return this.values.get(name) ?? [];
  }
}

const readFormFieldValues = (field: TestElement): readonly string[] => {
  if (field.tagName !== "select") {
    return [field.type === "checkbox" ? "on" : field.value];
  }

  if (field.multiple) {
    return field.children.filter((child) => child.selected).map((child) => child.value);
  }

  if (field.valueWasSet) {
    return [field.value];
  }

  if (field.value.length > 0) {
    return [field.value];
  }

  const selected = field.children.find((child) => child.selected) ?? field.children[0];
  return selected === undefined ? [] : [selected.value];
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
  multiple = false;
  size = 0;
  valueWasSet = false;
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
}

const installTestDocument = (): void => {
  const document = {
    createElement(tagName: string) {
      return new TestElement(tagName);
    }
  };

  (globalThis as unknown as { document: Document }).document = document as unknown as Document;
};
