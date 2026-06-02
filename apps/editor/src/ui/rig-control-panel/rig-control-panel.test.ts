import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  KeyformSetIdSchema,
  ParameterIdSchema,
  PartIdSchema,
  RigControlIdSchema
} from "@private-2d-rigging-lab/contracts";
import type {
  KeyformSetDto,
  ParameterDto,
  RigControlDto
} from "@private-2d-rigging-lab/package-format";

import {
  editorTestIds,
  projectEditorWorkflowViewModel,
  projectLoadedPackageState
} from "../../editor-state/index.js";
import { createRigControlPanel } from "./rig-control-panel.js";

describe("editor rig control panel", () => {
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

  it("submits a rotation2d create command from form fields", () => {
    const state = createRigControlPanelState({ rigControls: [] });
    const calls: unknown[] = [];
    const panel = createRigControlPanel({
      state,
      viewModel: projectEditorWorkflowViewModel(state),
      preview: null,
      viewerRuntimeProjection: null,
      onCommitCreateRotation2dRigControl(command) {
        calls.push(command);
      },
      onCommitBindRigControlChild() {}
    }) as unknown as TestElement;
    const form = findByTestId(panel, editorTestIds.rigControlCreateForm);
    if (form === null) {
      throw new Error("Expected rig control create form.");
    }

    expect(form.attributes.get("aria-label")).toBe("Create project-defined rotation2d rig control");
    setNamedFieldValue(form, "displayName", "Panel Body Rotation");
    setNamedFieldValue(form, "pivotX", "12");
    setNamedFieldValue(form, "pivotY", "24");
    setNamedFieldValue(form, "restAngleDegrees", "5");
    form.emit("submit");

    expect(calls).toEqual([
      {
        displayName: "Panel Body Rotation",
        partId: "part_root",
        pivot: { x: 12, y: 24 },
        restAngleDegrees: 5
      }
    ]);
  });

  it("submits a child rig control binding command", () => {
    const state = createRigControlPanelState({
      rigControls: [
        createRotationRigControl("rig_parent", "Parent Rotation"),
        createRotationRigControl("rig_child", "Child Rotation")
      ]
    });
    const calls: unknown[] = [];
    const panel = createRigControlPanel({
      state,
      viewModel: projectEditorWorkflowViewModel(state),
      preview: null,
      viewerRuntimeProjection: null,
      onCommitCreateRotation2dRigControl() {},
      onCommitBindRigControlChild(command) {
        calls.push(command);
      }
    }) as unknown as TestElement;
    const form = findByTestId(panel, editorTestIds.rigControlBindForm);
    if (form === null) {
      throw new Error("Expected rig control bind form.");
    }

    expect(getNamedSelectOptionValues(form, "childTarget")).toContain("rigControl:rig_child");
    setNamedFieldValue(form, "parentRigControlId", "rig_parent");
    setNamedFieldValue(form, "childTarget", "rigControl:rig_child");
    form.emit("submit");

    expect(calls).toEqual([
      {
        parentRigControlId: "rig_parent",
        child: {
          kind: "rigControl",
          id: "rig_child"
        }
      }
    ]);
  });

  it("does not expose a sole existing rig control in the normal bind form", () => {
    const state = createRigControlPanelState({
      rigControls: [createRotationRigControl("rig_single_child", "Single Child")]
    });
    const panel = createRigControlPanel({
      state,
      viewModel: projectEditorWorkflowViewModel(state),
      preview: null,
      viewerRuntimeProjection: null,
      onCommitCreateRotation2dRigControl() {},
      onCommitBindRigControlChild() {}
    }) as unknown as TestElement;
    const form = findByTestId(panel, editorTestIds.rigControlBindForm);
    const submit = findByTestId(panel, editorTestIds.rigControlBindSubmit);
    if (form === null || submit === null) {
      throw new Error("Expected rig control bind form.");
    }

    expect(submit.disabled).toBe(true);
    expect(getNamedSelectOptionValues(form, "childTarget")).toEqual([]);
  });

  it("submits a rig control angle keyform command from authored parameter and rotation2d fields", () => {
    const state = createRigControlPanelState({
      parameters: [createAuthoredParameter("param_body_yaw", "Body Yaw")],
      rigControls: [createRotationRigControl("rig_parent", "Parent Rotation")]
    });
    const calls: unknown[] = [];
    const panel = createRigControlPanel({
      state,
      viewModel: projectEditorWorkflowViewModel(state),
      preview: null,
      viewerRuntimeProjection: null,
      onCommitCreateRotation2dRigControl(command) {
        calls.push(command);
      },
      onCommitBindRigControlChild() {}
    }) as unknown as TestElement;
    const form = findByTestId(panel, editorTestIds.rigControlKeyformForm);
    if (form === null) {
      throw new Error("Expected rig control keyform form.");
    }

    expect(form.attributes.get("aria-label")).toBe("Add rotation2d angle keyform");
    setNamedFieldValue(form, "parameterId", "param_body_yaw");
    setNamedFieldValue(form, "rigControlId", "rig_parent");
    setNamedFieldValue(form, "keyValue", "1");
    setNamedFieldValue(form, "angleDegrees", "45");
    form.emit("submit");

    expect(calls).toEqual([
      {
        commandKind: "addRigControlAngleKeyform",
        parameterId: "param_body_yaw",
        rigControlId: "rig_parent",
        keyValue: 1,
        angleDegrees: 45
      }
    ]);
  });

  it("submits a minimum warpLattice2d create draft without operation commit wiring", () => {
    const state = createRigControlPanelState({ rigControls: [] });
    const calls: unknown[] = [];
    const panel = createRigControlPanel({
      state,
      viewModel: projectEditorWorkflowViewModel(state),
      preview: null,
      viewerRuntimeProjection: null,
      onCommitCreateRotation2dRigControl() {},
      onCommitBindRigControlChild() {},
      onDraftCreateWarpLattice2dRigControl(command) {
        calls.push(command);
      }
    }) as unknown as TestElement;
    const form = findByTestId(panel, editorTestIds.rigControlWarpLatticeCreateDraftForm);
    if (form === null) {
      throw new Error("Expected warp lattice create draft form.");
    }

    expect(form.attributes.get("aria-label")).toBe("Draft minimum 2x2 warpLattice2d rig control");
    expect(form.textContent).toContain("Minimum 2x2 draft");
    setNamedFieldValue(form, "draftRigControlId", "rig_warp_panel");
    setNamedFieldValue(form, "displayName", "Panel Warp Draft");
    setNamedFieldValue(form, "domainX", "10");
    setNamedFieldValue(form, "domainY", "20");
    setNamedFieldValue(form, "domainWidth", "80");
    setNamedFieldValue(form, "domainHeight", "40");
    form.emit("submit");

    expect(calls).toEqual([
      {
        commandKind: "draftWarpLattice2dRigControl",
        draftRigControlId: "rig_warp_panel",
        displayName: "Panel Warp Draft",
        partId: "part_root",
        bindSpace: "rigControlLocalRest",
        domainBounds: { x: 10, y: 20, width: 80, height: 40 },
        latticeColumns: 2,
        latticeRows: 2,
        restControlPoints: [
          { x: 10, y: 20 },
          { x: 90, y: 20 },
          { x: 10, y: 60 },
          { x: 90, y: 60 }
        ],
        interpolationMethod: "bilinear-grid-v1"
      }
    ]);
  });

  it("blocks a warpLattice2d create draft with invalid domain bounds", () => {
    const state = createRigControlPanelState({ rigControls: [] });
    const calls: unknown[] = [];
    const panel = createRigControlPanel({
      state,
      viewModel: projectEditorWorkflowViewModel(state),
      preview: null,
      viewerRuntimeProjection: null,
      onCommitCreateRotation2dRigControl() {},
      onCommitBindRigControlChild() {},
      onDraftCreateWarpLattice2dRigControl(command) {
        calls.push(command);
      }
    }) as unknown as TestElement;
    const form = findByTestId(panel, editorTestIds.rigControlWarpLatticeCreateDraftForm);
    if (form === null) {
      throw new Error("Expected warp lattice create draft form.");
    }

    setNamedFieldValue(form, "domainWidth", "0");
    form.emit("submit");

    expect(calls).toEqual([]);
    expect(form.textContent).toContain("Domain width and height must be positive.");
  });

  it("submits a warpLattice2d child binding draft for an existing warp target", () => {
    const state = createRigControlPanelState({
      rigControls: [
        createWarpRigControl("rig_warp", "Warp Control"),
        createRotationRigControl("rig_child", "Child Rotation")
      ]
    });
    const calls: unknown[] = [];
    const panel = createRigControlPanel({
      state,
      viewModel: projectEditorWorkflowViewModel(state),
      preview: null,
      viewerRuntimeProjection: null,
      onCommitCreateRotation2dRigControl() {},
      onCommitBindRigControlChild() {},
      onDraftBindWarpLattice2dChild(command) {
        calls.push(command);
      }
    }) as unknown as TestElement;
    const form = findByTestId(panel, editorTestIds.rigControlWarpLatticeBindDraftForm);
    if (form === null) {
      throw new Error("Expected warp lattice bind draft form.");
    }

    setNamedFieldValue(form, "warpParentTarget", "package:rig_warp");
    setNamedFieldValue(form, "childTarget", "rigControl:rig_child");
    form.emit("submit");

    expect(calls).toEqual([
      {
        commandKind: "draftWarpLattice2dBindChild",
        parent: {
          source: "package",
          id: "rig_warp"
        },
        child: {
          kind: "rigControl",
          id: "rig_child"
        }
      }
    ]);
  });

  it("submits a synthetic warpLattice2d draft binding with one existing rig-control child", () => {
    const state = createRigControlPanelState({
      rigControls: [createRotationRigControl("rig_single_child", "Single Child")]
    });
    const calls: unknown[] = [];
    const panel = createRigControlPanel({
      state,
      viewModel: projectEditorWorkflowViewModel(state),
      preview: null,
      viewerRuntimeProjection: null,
      onCommitCreateRotation2dRigControl() {},
      onCommitBindRigControlChild() {},
      onDraftBindWarpLattice2dChild(command) {
        calls.push(command);
      }
    }) as unknown as TestElement;
    const form = findByTestId(panel, editorTestIds.rigControlWarpLatticeBindDraftForm);
    const submit = findByTestId(panel, editorTestIds.rigControlWarpLatticeBindDraftSubmit);
    if (form === null || submit === null) {
      throw new Error("Expected warp lattice bind draft form.");
    }

    expect(submit.disabled).toBe(false);
    expect(getNamedSelectOptionValues(form, "childTarget")).toContain(
      "rigControl:rig_single_child"
    );
    setNamedFieldValue(form, "warpParentTarget", "draft:rig_warp_lattice_draft");
    setNamedFieldValue(form, "childTarget", "rigControl:rig_single_child");
    form.emit("submit");

    expect(calls).toEqual([
      {
        commandKind: "draftWarpLattice2dBindChild",
        parent: {
          source: "draft",
          id: "rig_warp_lattice_draft"
        },
        child: {
          kind: "rigControl",
          id: "rig_single_child"
        }
      }
    ]);
  });

  it("submits a warpLattice2d controlPointOffsets keyform draft", () => {
    const state = createRigControlPanelState({
      parameters: [createAuthoredParameter("param_warp", "Warp Amount")],
      rigControls: [createWarpRigControl("rig_warp", "Warp Control")]
    });
    const calls: unknown[] = [];
    const panel = createRigControlPanel({
      state,
      viewModel: projectEditorWorkflowViewModel(state),
      preview: null,
      viewerRuntimeProjection: null,
      onCommitCreateRotation2dRigControl() {},
      onCommitBindRigControlChild() {},
      onDraftAddWarpLattice2dControlPointOffsetsKeyform(command) {
        calls.push(command);
      }
    }) as unknown as TestElement;
    const form = findByTestId(panel, editorTestIds.rigControlWarpLatticeKeyformDraftForm);
    if (form === null) {
      throw new Error("Expected warp lattice keyform draft form.");
    }

    expect(form.attributes.get("aria-label")).toBe("Draft warpLattice2d controlPointOffsets keyform");
    setNamedFieldValue(form, "parameterId", "param_warp");
    setNamedFieldValue(form, "warpTarget", "package:rig_warp");
    setNamedFieldValue(form, "keyValue", "1");
    setNamedFieldValue(form, "compositionMode", "additiveDelta");
    setNamedFieldValue(form, "offsetX0", "0");
    setNamedFieldValue(form, "offsetY0", "0");
    setNamedFieldValue(form, "offsetX1", "3");
    setNamedFieldValue(form, "offsetY1", "-2");
    setNamedFieldValue(form, "offsetX2", "-4");
    setNamedFieldValue(form, "offsetY2", "5");
    setNamedFieldValue(form, "offsetX3", "1");
    setNamedFieldValue(form, "offsetY3", "6");
    form.emit("submit");

    expect(calls).toEqual([
      {
        commandKind: "draftWarpLattice2dControlPointOffsetsKeyform",
        target: {
          source: "package",
          id: "rig_warp",
          property: "controlPointOffsets"
        },
        parameterId: "param_warp",
        keyValue: 1,
        compositionMode: "additiveDelta",
        controlPointOffsets: [
          { x: 0, y: 0 },
          { x: 3, y: -2 },
          { x: -4, y: 5 },
          { x: 1, y: 6 }
        ]
      }
    ]);
  });

  it("blocks a warpLattice2d controlPointOffsets draft with malformed offsets", () => {
    const state = createRigControlPanelState({
      parameters: [createAuthoredParameter("param_warp", "Warp Amount")],
      rigControls: [createWarpRigControl("rig_warp", "Warp Control")]
    });
    const calls: unknown[] = [];
    const panel = createRigControlPanel({
      state,
      viewModel: projectEditorWorkflowViewModel(state),
      preview: null,
      viewerRuntimeProjection: null,
      onCommitCreateRotation2dRigControl() {},
      onCommitBindRigControlChild() {},
      onDraftAddWarpLattice2dControlPointOffsetsKeyform(command) {
        calls.push(command);
      }
    }) as unknown as TestElement;
    const form = findByTestId(panel, editorTestIds.rigControlWarpLatticeKeyformDraftForm);
    if (form === null) {
      throw new Error("Expected warp lattice keyform draft form.");
    }

    setNamedFieldValue(form, "parameterId", "param_warp");
    setNamedFieldValue(form, "warpTarget", "package:rig_warp");
    setNamedFieldValue(form, "offsetX1", "not-a-number");
    form.emit("submit");

    expect(calls).toEqual([]);
    expect(form.textContent).toContain("All 2x2 control point offsets must contain finite values.");
  });

  it("disables warpLattice2d controlPointOffsets draft when no authored parameter is eligible", () => {
    const state = createRigControlPanelState({
      rigControls: [createWarpRigControl("rig_warp", "Warp Control")]
    });
    const panel = createRigControlPanel({
      state,
      viewModel: projectEditorWorkflowViewModel(state),
      preview: null,
      viewerRuntimeProjection: null,
      onCommitCreateRotation2dRigControl() {},
      onCommitBindRigControlChild() {}
    }) as unknown as TestElement;
    const form = findByTestId(panel, editorTestIds.rigControlWarpLatticeKeyformDraftForm);
    const submit = findByTestId(panel, editorTestIds.rigControlWarpLatticeKeyformDraftSubmit);
    if (form === null || submit === null) {
      throw new Error("Expected warp lattice keyform draft form.");
    }

    expect(submit.disabled).toBe(true);
    expect(form.textContent).toContain("No authored input parameter");
  });

  it("blocks rig control angle keyform submit when no authored parameter is eligible", () => {
    const state = createRigControlPanelState({
      rigControls: [createRotationRigControl("rig_parent", "Parent Rotation")]
    });
    const calls: unknown[] = [];
    const panel = createRigControlPanel({
      state,
      viewModel: projectEditorWorkflowViewModel(state),
      preview: null,
      viewerRuntimeProjection: null,
      onCommitCreateRotation2dRigControl(command) {
        calls.push(command);
      },
      onCommitBindRigControlChild() {}
    }) as unknown as TestElement;
    const form = findByTestId(panel, editorTestIds.rigControlKeyformForm);
    if (form === null) {
      throw new Error("Expected rig control keyform form.");
    }

    form.emit("submit");

    expect(calls).toEqual([]);
    expect(form.textContent).toContain("No authored input parameter available.");
  });

  it("blocks rig control angle keyform submit when no rotation2d control is eligible", () => {
    const state = createRigControlPanelState({
      parameters: [createAuthoredParameter("param_body_yaw", "Body Yaw")],
      rigControls: []
    });
    const calls: unknown[] = [];
    const panel = createRigControlPanel({
      state,
      viewModel: projectEditorWorkflowViewModel(state),
      preview: null,
      viewerRuntimeProjection: null,
      onCommitCreateRotation2dRigControl(command) {
        calls.push(command);
      },
      onCommitBindRigControlChild() {}
    }) as unknown as TestElement;
    const form = findByTestId(panel, editorTestIds.rigControlKeyformForm);
    if (form === null) {
      throw new Error("Expected rig control keyform form.");
    }

    form.emit("submit");

    expect(calls).toEqual([]);
    expect(form.textContent).toContain("No rotation2d rig control available.");
  });

  it("blocks rig control angle keyform submit with deterministic invalid field diagnostics", () => {
    const state = createRigControlPanelState({
      parameters: [createAuthoredParameter("param_body_yaw", "Body Yaw")],
      rigControls: [
        createRotationRigControl("rig_parent", "Parent Rotation"),
        createWarpRigControl("rig_warp", "Warp Control")
      ]
    });
    const calls: unknown[] = [];
    const panel = createRigControlPanel({
      state,
      viewModel: projectEditorWorkflowViewModel(state),
      preview: null,
      viewerRuntimeProjection: null,
      onCommitCreateRotation2dRigControl(command) {
        calls.push(command);
      },
      onCommitBindRigControlChild() {}
    }) as unknown as TestElement;
    const form = findByTestId(panel, editorTestIds.rigControlKeyformForm);
    if (form === null) {
      throw new Error("Expected rig control keyform form.");
    }

    setNamedFieldValue(form, "parameterId", "");
    form.emit("submit");
    expect(calls).toEqual([]);
    expect(form.textContent).toContain("Parameter and rotation2d rig control are required.");

    setNamedFieldValue(form, "parameterId", "param_body_yaw");
    setNamedFieldValue(form, "rigControlId", "rig_warp");
    form.emit("submit");
    expect(calls).toEqual([]);
    expect(form.textContent).toContain("Selected rig control must be rotation2d with angleDegrees.");

    setNamedFieldValue(form, "rigControlId", "rig_parent");
    setNamedFieldValue(form, "angleDegrees", "not-a-number");
    form.emit("submit");

    expect(calls).toEqual([]);
    expect(form.textContent).toContain("Key value and angle must contain finite values.");
  });

  it("renders authored rig control angle keyform state in the panel evidence", () => {
    const state = createRigControlPanelState({
      parameters: [createAuthoredParameter("param_body_yaw", "Body Yaw")],
      rigControls: [createRotationRigControl("rig_parent", "Parent Rotation")],
      keyformSets: [
        createRigControlAngleKeyform("keyset_rig_parent_angle", "rig_parent", "param_body_yaw", 1, 45)
      ]
    });
    const panel = createRigControlPanel({
      state,
      viewModel: projectEditorWorkflowViewModel(state),
      preview: null,
      viewerRuntimeProjection: null,
      onCommitCreateRotation2dRigControl() {},
      onCommitBindRigControlChild() {}
    }) as unknown as TestElement;
    const keyformList = findByTestId(panel, editorTestIds.rigControlKeyformList);
    const evidence = findByTestId(panel, editorTestIds.rigControlEvidence);

    expect(keyformList?.textContent).toContain("1 angle keyform");
    expect(keyformList?.textContent).toContain("Body Yaw / param_body_yaw");
    expect(keyformList?.textContent).toContain("45 deg");
    expect(evidence?.textContent).toContain("angle keyforms param_body_yaw@1 -> 45 deg");
  });

  it("renders authored warpLattice2d controlPointOffsets keyform state in the panel evidence", () => {
    const state = createRigControlPanelState({
      parameters: [createAuthoredParameter("param_warp", "Warp Amount")],
      rigControls: [createWarpRigControl("rig_warp", "Warp Control")],
      keyformSets: [
        createWarpLatticeOffsetsKeyform("keyset_rig_warp_offsets", "rig_warp", "param_warp")
      ]
    });
    const panel = createRigControlPanel({
      state,
      viewModel: projectEditorWorkflowViewModel(state),
      preview: null,
      viewerRuntimeProjection: null,
      onCommitCreateRotation2dRigControl() {},
      onCommitBindRigControlChild() {}
    }) as unknown as TestElement;
    const keyformList = findByTestId(panel, editorTestIds.rigControlWarpLatticeKeyformList);
    const evidence = findByTestId(panel, editorTestIds.rigControlEvidence);

    expect(keyformList?.textContent).toContain("1 controlPointOffsets keyform");
    expect(keyformList?.textContent).toContain("Warp Amount / param_warp");
    expect(keyformList?.textContent).toContain("p3 1, 4");
    expect(evidence?.textContent).toContain(
      "controlPointOffsets draft keyforms param_warp@1 replace p0 0, 0; p1 2, -2; p2 -1, 3; p3 1, 4"
    );
  });

  it("blocks self-binding with a deterministic user-visible diagnostic", () => {
    const state = createRigControlPanelState({
      rigControls: [
        createRotationRigControl("rig_parent", "Parent Rotation"),
        createRotationRigControl("rig_child", "Child Rotation")
      ]
    });
    const calls: unknown[] = [];
    const panel = createRigControlPanel({
      state,
      viewModel: projectEditorWorkflowViewModel(state),
      preview: null,
      viewerRuntimeProjection: null,
      onCommitCreateRotation2dRigControl() {},
      onCommitBindRigControlChild(command) {
        calls.push(command);
      }
    }) as unknown as TestElement;
    const form = findByTestId(panel, editorTestIds.rigControlBindForm);
    if (form === null) {
      throw new Error("Expected rig control bind form.");
    }

    setNamedFieldValue(form, "parentRigControlId", "rig_parent");
    setNamedFieldValue(form, "childTarget", "rigControl:rig_parent");
    form.emit("submit");

    expect(calls).toEqual([]);
    expect(form.textContent).toContain("Parent rig control cannot be bound to itself.");
  });
});

const createRigControlPanelState = (input: {
  readonly parameters?: readonly ParameterDto[];
  readonly rigControls: readonly RigControlDto[];
  readonly keyformSets?: readonly KeyformSetDto[];
}) =>
  projectLoadedPackageState({
    identity: {
      packageId: "pkg_rig_control_panel",
      packageDisplayName: "Rig Control Panel Package",
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
        drawableIds: []
      }
    ],
    ...(input.parameters === undefined ? {} : { parameters: input.parameters }),
    rigControls: input.rigControls,
    ...(input.keyformSets === undefined ? {} : { keyformSets: input.keyformSets })
  });

const createRotationRigControl = (
  rigControlId: string,
  displayName: string
): RigControlDto => ({
  kind: "rotation2d",
  rigControlId: RigControlIdSchema.parse(rigControlId),
  displayName,
  partId: PartIdSchema.parse("part_root"),
  childDrawableIds: [],
  childRigControlIds: [],
  pivot: { x: 0, y: 0 },
  restAngleDegrees: 0,
  restTranslation: { x: 0, y: 0 },
  restScale: { x: 1, y: 1 },
  enabled: true
});

const createWarpRigControl = (
  rigControlId: string,
  displayName: string
): RigControlDto => ({
  kind: "warpLattice2d",
  rigControlId: RigControlIdSchema.parse(rigControlId),
  displayName,
  partId: PartIdSchema.parse("part_root"),
  childDrawableIds: [],
  childRigControlIds: [],
  bindSpace: "rigControlLocalRest",
  domainBounds: { x: 0, y: 0, width: 100, height: 100 },
  latticeColumns: 2,
  latticeRows: 2,
  restControlPoints: [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 0, y: 100 },
    { x: 100, y: 100 }
  ],
  interpolationMethod: "bilinear-grid-v1",
  enabled: true
});

const createAuthoredParameter = (
  parameterId: string,
  displayName: string
): ParameterDto => ({
  parameterId: ParameterIdSchema.parse(parameterId),
  displayName,
  semanticRole: "body",
  projectPresetAlias: parameterId.replace(/^param_/, "private-"),
  valueSource: "authoredInput",
  min: -1,
  max: 1,
  default: 0,
  recommendedUiStep: 0.01
});

const createRigControlAngleKeyform = (
  keyformSetId: string,
  rigControlId: string,
  parameterId: string,
  keyValue: number,
  angleDegrees: number
): KeyformSetDto => ({
  keyformSetId: KeyformSetIdSchema.parse(keyformSetId),
  target: {
    kind: "rigControl",
    id: rigControlId,
    property: "angleDegrees"
  },
  parameterId: ParameterIdSchema.parse(parameterId),
  evaluator: "linear-1d-v1",
  interpolation: "linear-1d-v1",
  compositionMode: "replace",
  compositionOrder: 0,
  keys: [
    {
      value: keyValue,
      statePatch: angleDegrees
    }
  ]
});

const createWarpLatticeOffsetsKeyform = (
  keyformSetId: string,
  rigControlId: string,
  parameterId: string
): KeyformSetDto => ({
  keyformSetId: KeyformSetIdSchema.parse(keyformSetId),
  target: {
    kind: "rigControl",
    id: rigControlId,
    property: "controlPointOffsets"
  },
  parameterId: ParameterIdSchema.parse(parameterId),
  evaluator: "linear-1d-v1",
  interpolation: "linear-1d-v1",
  compositionMode: "replace",
  compositionOrder: 0,
  keys: [
    {
      value: 1,
      statePatch: [
        { x: 0, y: 0 },
        { x: 2, y: -2 },
        { x: -1, y: 3 },
        { x: 1, y: 4 }
      ]
    }
  ]
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

const getNamedSelectOptionValues = (
  root: TestElement,
  name: string
): readonly string[] => {
  const field = root.queryByPredicate((element) => element.name === name);
  if (field === null) {
    throw new Error(`Missing field ${name}.`);
  }

  if (field.tagName !== "select") {
    throw new Error(`Field ${name} is not a select.`);
  }

  return field.children.map((child) => child.value);
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

  if (field.valueWasSet) {
    return field.value;
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
