import type { AuthoringSession } from "@private-2d-rigging-lab/authoring-core";
import { DynamicsGroupIdSchema, ParameterIdSchema } from "@private-2d-rigging-lab/contracts";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { DynamicsToolInspector } from "./dynamics-tool-inspector";
import { createEmptyAuthoringSession } from "../../features/editor-session/model/empty-authoring-session";
import {
  createDynamicsToolPreviewEvaluation,
  createInitialDynamicsToolPreviewState
} from "../../features/editor-session/model/dynamics-tool-state";
import { TooltipProvider } from "../../ui/tooltip";

const editorSessionMock = vi.hoisted(() => ({ current: undefined as unknown }));

vi.mock("../../features/editor-session/editor-session-context", () => ({
  useEditorSession: () => editorSessionMock.current
}));

const DRIVER_X = ParameterIdSchema.parse("param_dynamics_driver_x");
const DRIVER_Y = ParameterIdSchema.parse("param_dynamics_driver_y");
const OUTPUT = ParameterIdSchema.parse("param_dynamics_output");
const GROUP_ID = DynamicsGroupIdSchema.parse("dyn_inspector_sway");
const DUPLICATE_GROUP_ID = DynamicsGroupIdSchema.parse("dyn_inspector_duplicate");

// dynamics-file-v3 committed base values. Direct-value Quick Tune fields (limit / damping /
// gravityScale) mirror these; the multiplier fields (outputScale / lengthScale) read back as 1.0.
const GROUP_OUTPUT_SCALE = 0.5;
const GROUP_OUTPUT_LIMIT = 8;
const GROUP_SEGMENT_LENGTHS = [14, 10] as const;
const GROUP_DAMPING = 2.5;
const GROUP_GRAVITY_SCALE = 1;

describe("DynamicsToolInspector", () => {
  it("initially renders only the group list and New Group action", () => {
    const session = createDynamicsSession();
    const preview = {
      ...createInitialDynamicsToolPreviewState(),
      selectedGroupId: GROUP_ID
    };
    editorSessionMock.current = {
      advanceDynamicsToolPreviewSimulation: vi.fn(),
      clearDynamicsToolPreviewDefinitionOverride: vi.fn(),
      createDynamicsGroup: vi.fn(),
      deleteDynamicsGroup: vi.fn(),
      dynamicsToolPreview: preview,
      dynamicsToolPreviewEvaluation: createDynamicsToolPreviewEvaluation(session, preview),
      resetDynamicsToolPreviewSimulation: vi.fn(),
      session,
      setDynamicsToolPreviewDefinitionOverride: vi.fn(),
      setDynamicsToolPreviewDriverValue: vi.fn(),
      setDynamicsToolPreviewGroupId: vi.fn(),
      updateDynamicsGroup: vi.fn()
    };

    const markup = renderToStaticMarkup(createElement(DynamicsToolInspector));

    expect(markup).toContain('data-testid="dynamics-tool-inspector"');
    expect(markup).toContain('data-testid="dynamics-group-list"');
    expect(markup).toContain("Inspector Sway");
    expect(markup).toContain('data-testid="dynamics-group-warning-icon"');
    expect(markup).toContain("Dynamics output keyform is missing");
    expect(markup).toContain('data-testid="dynamics-new-draft"');
    // The list view surfaces neither the draft/group inspector sections nor the removed v0 UI.
    expect(markup).not.toContain("Settings");
    expect(markup).not.toContain("Inputs");
    expect(markup).not.toContain("Chain");
    expect(markup).not.toContain("Quick Tune");
    expect(markup).not.toContain("Outputs");
    expect(markup).not.toContain("Validation");
    expect(markup).not.toContain("Delete Group");
    // Removed v0 vocabulary must not leak anywhere in the rendered tree.
    expect(markup).not.toContain("Pendulum");
    expect(markup).not.toContain("Normalization");
  });

  it("surfaces loaded Dynamics diagnostics in the group list and group inspector", async () => {
    const session = createDynamicsSession();
    session.graph.dynamicsGroups.push({
      ...session.graph.dynamicsGroups[0]!,
      dynamicsGroupId: DUPLICATE_GROUP_ID,
      displayName: "Duplicate Output"
    });
    const preview = {
      ...createInitialDynamicsToolPreviewState(),
      selectedGroupId: GROUP_ID
    };
    const animationFrame = installAnimationFrameMock();
    editorSessionMock.current = {
      advanceDynamicsToolPreviewSimulation: vi.fn(),
      clearDynamicsToolPreviewDefinitionOverride: vi.fn(),
      createDynamicsGroup: vi.fn(),
      deleteDynamicsGroup: vi.fn(),
      dynamicsToolPreview: preview,
      dynamicsToolPreviewEvaluation: createDynamicsToolPreviewEvaluation(session, preview),
      resetDynamicsToolPreviewSimulation: vi.fn(),
      session,
      setDynamicsToolPreviewDefinitionOverride: vi.fn(),
      setDynamicsToolPreviewDriverValue: vi.fn(),
      setDynamicsToolPreviewGroupId: vi.fn(),
      updateDynamicsGroup: vi.fn()
    };
    const harness = await renderDynamicsToolInspector();

    try {
      expect(getFakeElementsByTestId(harness.container, "dynamics-group-warning-icon"))
        .toHaveLength(2);

      await clickTestId(harness.container, "dynamics-group-row");
      const warningCodes = getFakeElementsByTestId(
        harness.container,
        "dynamics-group-validation-warning"
      ).map((element) => element.getAttribute("data-code"));

      expect(warningCodes).toContain("dynamics.outputKeyformMissing");
      expect(warningCodes).toContain("dynamics.outputOwnershipDuplicate");
      expect(getFakeElementByTestId(harness.container, "dynamics-group-inspector").textContent)
        .toContain("This Dynamics output parameter has no keyform set");
    } finally {
      animationFrame.restore();
      await harness.cleanup();
    }
  });

  it("moves through group, edit, create, cancel, apply, and delete states", async () => {
    const session = createDynamicsSession();
    const preview = {
      ...createInitialDynamicsToolPreviewState(),
      selectedGroupId: GROUP_ID
    };
    const updateDynamicsGroup = vi.fn(() => ({ committed: true, diagnostics: [] }));
    const deleteDynamicsGroup = vi.fn(() => ({ committed: true, diagnostics: [] }));
    const createDynamicsGroup = vi.fn(() => ({ committed: true, diagnostics: [] }));
    const advanceDynamicsToolPreviewSimulation = vi.fn();
    const clearDynamicsToolPreviewDefinitionOverride = vi.fn();
    const setDynamicsToolPreviewDefinitionOverride = vi.fn();
    const setDynamicsToolPreviewGroupId = vi.fn();
    const setDynamicsToolPreviewDriverValue = vi.fn();
    const animationFrame = installAnimationFrameMock();
    editorSessionMock.current = {
      advanceDynamicsToolPreviewSimulation,
      clearDynamicsToolPreviewDefinitionOverride,
      createDynamicsGroup,
      deleteDynamicsGroup,
      dynamicsToolPreview: preview,
      dynamicsToolPreviewEvaluation: createDynamicsToolPreviewEvaluation(session, preview),
      resetDynamicsToolPreviewSimulation: vi.fn(),
      session,
      setDynamicsToolPreviewDefinitionOverride,
      setDynamicsToolPreviewDriverValue,
      setDynamicsToolPreviewGroupId,
      updateDynamicsGroup
    };
    const harness = await renderDynamicsToolInspector();

    try {
      await clickTestId(harness.container, "dynamics-group-row");

      expect(setDynamicsToolPreviewGroupId).toHaveBeenLastCalledWith(GROUP_ID);
      expect(getFakeElementByTestId(harness.container, "dynamics-group-inspector").textContent)
        .toContain("Inspector Sway");
      // Two v3 driver inputs render two preview sliders.
      expect(getFakeElementsByTestId(harness.container, "dynamics-preview-driver")).toHaveLength(2);

      // Quick Tune exposes the §9 player-v2 vocabulary (outputScale / limit / damping /
      // gravityScale / lengthScale). The removed v0 fields must not render.
      expect(getFakeElementsByTestId(harness.container, "dynamics-quick-tune")).toHaveLength(1);
      expect(getFakeElementsByTestId(harness.container, "dynamics-quick-tune-outputScale"))
        .toHaveLength(1);
      expect(getFakeElementsByTestId(harness.container, "dynamics-quick-tune-limit"))
        .toHaveLength(1);
      expect(getFakeElementsByTestId(harness.container, "dynamics-quick-tune-damping"))
        .toHaveLength(1);
      expect(getFakeElementsByTestId(harness.container, "dynamics-quick-tune-gravityScale"))
        .toHaveLength(1);
      expect(getFakeElementsByTestId(harness.container, "dynamics-quick-tune-lengthScale"))
        .toHaveLength(1);
      // Exactly the five v3 fields render — no removed v0 tuning controls linger.
      expect(collectQuickTuneFieldTestIds(harness.container)).toEqual([
        "dynamics-quick-tune-outputScale",
        "dynamics-quick-tune-limit",
        "dynamics-quick-tune-damping",
        "dynamics-quick-tune-gravityScale",
        "dynamics-quick-tune-lengthScale"
      ]);

      expect(getQuickTuneHelpLabel(harness.container, "dynamics-quick-tune-outputScale")).toBe(
        "Output xの説明: 出力の倍率。上げると出力パラメータの動きが大きくなります。"
      );
      expect(getQuickTuneHelpLabel(harness.container, "dynamics-quick-tune-limit")).toBe(
        "Limitの説明: 最大振れ幅。出力オフセットの絶対値の上限です。"
      );
      expect(getQuickTuneHelpLabel(harness.container, "dynamics-quick-tune-damping")).toBe(
        "Dampingの説明: 減衰の強さ。上げると揺れが早く収まります。"
      );
      expect(getQuickTuneHelpLabel(harness.container, "dynamics-quick-tune-gravityScale")).toBe(
        "Gravityの説明: 重力の強さ。上げると速く戻り、周期が短くなります。"
      );
      expect(getQuickTuneHelpLabel(harness.container, "dynamics-quick-tune-lengthScale")).toBe(
        "Length xの説明: チェーン長の倍率。上げるとゆったり長い周期で揺れます。"
      );

      // The group view shows a read-only summary + preview + quick tune; the editable draft
      // sections (input rows, chain editor) belong to the edit view only.
      expect(getMaybeFakeElementByTestId(harness.container, "dynamics-input-row")).toBeUndefined();
      expect(getMaybeFakeElementByTestId(harness.container, "dynamics-chain-editor"))
        .toBeUndefined();
      expect(getFakeElementByTestId(harness.container, "dynamics-edit-group")).toBeDefined();
      expect(getFakeElementByTestId(harness.container, "dynamics-delete-group")).toBeDefined();

      expect(animationFrame.pendingCount()).toBe(1);
      animationFrame.flushNext(10);
      expect(advanceDynamicsToolPreviewSimulation).toHaveBeenCalledWith(GROUP_ID, 16.6666667);
      animationFrame.flushNext(30);
      expect(advanceDynamicsToolPreviewSimulation).toHaveBeenLastCalledWith(GROUP_ID, 20);

      const driverRange = getFakeInputByType(harness.container, "range");
      driverRange.value = "10";
      getFakeReactProps(driverRange).onChange?.({ currentTarget: driverRange });
      driverRange.value = "20";
      getFakeReactProps(driverRange).onChange?.({ currentTarget: driverRange });
      expect(setDynamicsToolPreviewDriverValue).not.toHaveBeenCalled();
      getFakeReactProps(driverRange).onPointerUp?.();
      expect(setDynamicsToolPreviewDriverValue).toHaveBeenCalledTimes(1);
      expect(setDynamicsToolPreviewDriverValue).toHaveBeenCalledWith(GROUP_ID, DRIVER_X, 20);
      animationFrame.flushAll();
      expect(setDynamicsToolPreviewDriverValue).toHaveBeenCalledTimes(1);

      // Live editing a direct-value Quick Tune field (damping) pushes a preview definition
      // override: the whole v3 group with chain.damping updated, outputs unchanged.
      const quickTuneDamping = getFakeElementByTestId(
        harness.container,
        "dynamics-quick-tune-damping"
      );
      const quickTuneDampingNumber = getFakeInputsIn(quickTuneDamping).find(
        (input) => input.type === "number"
      );
      if (quickTuneDampingNumber === undefined) {
        throw new Error("Expected Damping Quick Tune number input.");
      }
      quickTuneDampingNumber.value = "5";
      await act(async () => {
        getFakeReactProps(quickTuneDampingNumber).onChange?.({
          currentTarget: quickTuneDampingNumber
        });
      });
      expect(setDynamicsToolPreviewDefinitionOverride).toHaveBeenLastCalledWith(
        GROUP_ID,
        expect.objectContaining({
          dynamicsGroupId: GROUP_ID,
          chain: expect.objectContaining({ damping: 5 }),
          outputs: [
            expect.objectContaining({
              parameterId: OUTPUT,
              scale: GROUP_OUTPUT_SCALE,
              limit: GROUP_OUTPUT_LIMIT
            })
          ]
        })
      );

      // Dragging the damping slider coalesces live changes; only pointer-up finalizes into a
      // committed update payload of shape { dynamicsGroupId, chain, outputs }.
      const quickTuneDampingRange = getFakeInputsIn(quickTuneDamping).find(
        (input) => input.type === "range"
      );
      if (quickTuneDampingRange === undefined) {
        throw new Error("Expected Damping Quick Tune range input.");
      }
      await act(async () => {
        quickTuneDampingRange.value = "7";
        getFakeReactProps(quickTuneDampingRange).onChange?.({
          currentTarget: quickTuneDampingRange
        });
        quickTuneDampingRange.value = "8";
        getFakeReactProps(quickTuneDampingRange).onChange?.({
          currentTarget: quickTuneDampingRange
        });
      });
      expect(updateDynamicsGroup).not.toHaveBeenCalled();
      await act(async () => {
        getFakeReactProps(quickTuneDampingRange).onPointerUp?.();
      });
      expect(updateDynamicsGroup).toHaveBeenCalledTimes(1);
      expect(updateDynamicsGroup).toHaveBeenCalledWith(
        expect.objectContaining({
          dynamicsGroupId: GROUP_ID,
          chain: expect.objectContaining({
            damping: 8,
            gravityScale: GROUP_GRAVITY_SCALE,
            segmentLengths: [...GROUP_SEGMENT_LENGTHS]
          }),
          outputs: [
            expect.objectContaining({
              parameterId: OUTPUT,
              segmentIndex: 1,
              scale: GROUP_OUTPUT_SCALE,
              limit: GROUP_OUTPUT_LIMIT
            })
          ]
        })
      );
      // The commit payload is exactly the v3 update shape { dynamicsGroupId, chain, outputs };
      // it carries no v0 keys and each output only exposes the v3 fields.
      const committedPayload = (updateDynamicsGroup.mock.calls[0] as readonly unknown[])[0] as {
        readonly outputs?: readonly Record<string, unknown>[];
      };
      expect(Object.keys(committedPayload).sort()).toEqual([
        "chain",
        "dynamicsGroupId",
        "outputs"
      ]);
      expect(Object.keys(committedPayload.outputs?.[0] ?? {}).sort()).toEqual([
        "limit",
        "parameterId",
        "scale",
        "segmentIndex"
      ]);

      await clickTestId(harness.container, "dynamics-edit-group");
      expect(getFakeElementByTestId(harness.container, "dynamics-edit-inspector")).toBeDefined();
      expect(animationFrame.pendingCount()).toBe(0);
      // Edit view exposes the editable draft: two input rows and the chain editor.
      expect(getFakeElementsByTestId(harness.container, "dynamics-input-row")).toHaveLength(2);
      expect(getFakeElementByTestId(harness.container, "dynamics-chain-editor")).toBeDefined();
      expect(getFakeElementsByTestId(harness.container, "dynamics-chain-segment-row"))
        .toHaveLength(GROUP_SEGMENT_LENGTHS.length);
      expect(getFakeElementByTestId(harness.container, "dynamics-add-segment")).toBeDefined();
      expect(getFakeElementByTestId(harness.container, "dynamics-output-segment")).toBeDefined();
      expect(getFakeElementByTestId(harness.container, "dynamics-apply-group")).toBeDefined();
      expect(getFakeElementByTestId(harness.container, "dynamics-cancel")).toBeDefined();
      expect(getMaybeFakeElementByTestId(harness.container, "dynamics-preview-reset")).toBeUndefined();
      expect(getMaybeFakeElementByTestId(harness.container, "dynamics-delete-group")).toBeUndefined();

      await clickTestId(harness.container, "dynamics-cancel");
      expect(getFakeElementByTestId(harness.container, "dynamics-group-inspector")).toBeDefined();

      await clickTestId(harness.container, "dynamics-back-to-groups");
      expect(getFakeElementByTestId(harness.container, "dynamics-group-list")).toBeDefined();
      expect(animationFrame.pendingCount()).toBe(0);

      await clickTestId(harness.container, "dynamics-new-draft");
      expect(getFakeElementByTestId(harness.container, "dynamics-create-inspector")).toBeDefined();
      expect(animationFrame.pendingCount()).toBe(0);
      expect(getFakeElementByTestId(harness.container, "dynamics-create-group")).toBeDefined();
      expect(getFakeElementByTestId(harness.container, "dynamics-chain-editor")).toBeDefined();
      expect(getMaybeFakeElementByTestId(harness.container, "dynamics-delete-group")).toBeUndefined();

      await clickTestId(harness.container, "dynamics-cancel");
      expect(getFakeElementByTestId(harness.container, "dynamics-group-list")).toBeDefined();

      await clickTestId(harness.container, "dynamics-new-draft");
      await clickTestId(harness.container, "dynamics-create-group");
      expect(createDynamicsGroup).toHaveBeenCalledTimes(1);
      expect(getFakeElementByTestId(harness.container, "dynamics-group-list")).toBeDefined();

      await clickTestId(harness.container, "dynamics-group-row");
      await clickTestId(harness.container, "dynamics-edit-group");
      await clickTestId(harness.container, "dynamics-apply-group");
      expect(updateDynamicsGroup).toHaveBeenCalledTimes(2);
      expect(getFakeElementByTestId(harness.container, "dynamics-group-inspector")).toBeDefined();

      await clickTestId(harness.container, "dynamics-delete-group");
      expect(deleteDynamicsGroup).toHaveBeenCalledWith({ dynamicsGroupId: GROUP_ID });
      expect(getFakeElementByTestId(harness.container, "dynamics-group-list")).toBeDefined();
    } finally {
      animationFrame.restore();
      await harness.cleanup();
    }
  });

  it("does not commit Quick Tune when the finalized value matches the group", async () => {
    const session = createDynamicsSession();
    const preview = {
      ...createInitialDynamicsToolPreviewState(),
      selectedGroupId: GROUP_ID
    };
    const updateDynamicsGroup = vi.fn(() => ({ committed: true, diagnostics: [] }));
    const animationFrame = installAnimationFrameMock();
    editorSessionMock.current = {
      advanceDynamicsToolPreviewSimulation: vi.fn(),
      clearDynamicsToolPreviewDefinitionOverride: vi.fn(),
      createDynamicsGroup: vi.fn(),
      deleteDynamicsGroup: vi.fn(),
      dynamicsToolPreview: preview,
      dynamicsToolPreviewEvaluation: createDynamicsToolPreviewEvaluation(session, preview),
      resetDynamicsToolPreviewSimulation: vi.fn(),
      session,
      setDynamicsToolPreviewDefinitionOverride: vi.fn(),
      setDynamicsToolPreviewDriverValue: vi.fn(),
      setDynamicsToolPreviewGroupId: vi.fn(),
      updateDynamicsGroup
    };
    const harness = await renderDynamicsToolInspector();

    try {
      await clickTestId(harness.container, "dynamics-group-row");
      const quickTuneDamping = getFakeElementByTestId(
        harness.container,
        "dynamics-quick-tune-damping"
      );
      const quickTuneDampingRange = getFakeInputsIn(quickTuneDamping).find(
        (input) => input.type === "range"
      );
      if (quickTuneDampingRange === undefined) {
        throw new Error("Expected Damping Quick Tune range input.");
      }

      // Finalizing without changing the value away from the committed base must not commit.
      await act(async () => {
        getFakeReactProps(quickTuneDampingRange).onPointerUp?.();
      });

      expect(updateDynamicsGroup).not.toHaveBeenCalled();
    } finally {
      animationFrame.restore();
      await harness.cleanup();
    }
  });

  it("deduplicates repeated Quick Tune completion events for the same finalized draft", async () => {
    const session = createDynamicsSession();
    const preview = {
      ...createInitialDynamicsToolPreviewState(),
      selectedGroupId: GROUP_ID
    };
    const updateDynamicsGroup = vi.fn(() => ({ committed: true, diagnostics: [] }));
    const animationFrame = installAnimationFrameMock();
    editorSessionMock.current = {
      advanceDynamicsToolPreviewSimulation: vi.fn(),
      clearDynamicsToolPreviewDefinitionOverride: vi.fn(),
      createDynamicsGroup: vi.fn(),
      deleteDynamicsGroup: vi.fn(),
      dynamicsToolPreview: preview,
      dynamicsToolPreviewEvaluation: createDynamicsToolPreviewEvaluation(session, preview),
      resetDynamicsToolPreviewSimulation: vi.fn(),
      session,
      setDynamicsToolPreviewDefinitionOverride: vi.fn(),
      setDynamicsToolPreviewDriverValue: vi.fn(),
      setDynamicsToolPreviewGroupId: vi.fn(),
      updateDynamicsGroup
    };
    const harness = await renderDynamicsToolInspector();

    try {
      await clickTestId(harness.container, "dynamics-group-row");
      const quickTuneDamping = getFakeElementByTestId(
        harness.container,
        "dynamics-quick-tune-damping"
      );
      const quickTuneDampingRange = getFakeInputsIn(quickTuneDamping).find(
        (input) => input.type === "range"
      );
      if (quickTuneDampingRange === undefined) {
        throw new Error("Expected Damping Quick Tune range input.");
      }

      await act(async () => {
        quickTuneDampingRange.value = "8";
        getFakeReactProps(quickTuneDampingRange).onChange?.({
          currentTarget: quickTuneDampingRange
        });
      });
      await act(async () => {
        getFakeReactProps(quickTuneDampingRange).onPointerUp?.();
      });
      // A redundant blur for the same finalized draft must not re-commit.
      await act(async () => {
        getFakeReactProps(quickTuneDampingRange).onBlur?.();
      });

      expect(updateDynamicsGroup).toHaveBeenCalledTimes(1);
      expect(updateDynamicsGroup).toHaveBeenLastCalledWith(
        expect.objectContaining({
          dynamicsGroupId: GROUP_ID,
          chain: expect.objectContaining({ damping: 8 })
        })
      );

      // A genuinely new finalized value commits again.
      await act(async () => {
        quickTuneDampingRange.value = "9";
        getFakeReactProps(quickTuneDampingRange).onChange?.({
          currentTarget: quickTuneDampingRange
        });
      });
      await act(async () => {
        getFakeReactProps(quickTuneDampingRange).onPointerUp?.();
      });

      expect(updateDynamicsGroup).toHaveBeenCalledTimes(2);
      expect(updateDynamicsGroup).toHaveBeenLastCalledWith(
        expect.objectContaining({
          dynamicsGroupId: GROUP_ID,
          chain: expect.objectContaining({ damping: 9 })
        })
      );
    } finally {
      animationFrame.restore();
      await harness.cleanup();
    }
  });
});

function createDynamicsSession(): AuthoringSession {
  const session = createEmptyAuthoringSession();
  session.graph.parameters.push(
    {
      parameterId: DRIVER_X,
      displayName: "Driver X",
      valueSource: "authoredInput",
      min: -30,
      default: 0,
      max: 30,
      recommendedUiStep: 1
    },
    {
      parameterId: DRIVER_Y,
      displayName: "Driver Y",
      valueSource: "authoredInput",
      min: -20,
      default: 0,
      max: 20,
      recommendedUiStep: 1
    },
    {
      parameterId: OUTPUT,
      displayName: "Output",
      valueSource: "authoredInput",
      min: -10,
      default: 0,
      max: 10,
      recommendedUiStep: 0.1
    }
  );
  // dynamics-file-v3 world-frame Verlet chain group: inputs carry only { parameterId, kind, scale };
  // the chain owns the physics; outputs carry { parameterId, segmentIndex, scale, limit }.
  session.graph.dynamicsGroups.push({
    dynamicsGroupId: GROUP_ID,
    displayName: "Inspector Sway",
    enabled: true,
    presetId: "hair",
    inputs: [
      {
        parameterId: DRIVER_X,
        kind: "angle",
        scale: 1
      },
      {
        parameterId: DRIVER_Y,
        kind: "positionX",
        scale: 0.5
      }
    ],
    chain: {
      rootOffset: { x: 0, y: 0 },
      segmentLengths: [...GROUP_SEGMENT_LENGTHS],
      damping: GROUP_DAMPING,
      gravityScale: GROUP_GRAVITY_SCALE
    },
    outputs: [
      {
        parameterId: OUTPUT,
        segmentIndex: 1,
        scale: GROUP_OUTPUT_SCALE,
        limit: GROUP_OUTPUT_LIMIT
      }
    ]
  });
  return session;
}

async function renderDynamicsToolInspector(): Promise<{
  readonly cleanup: () => Promise<void>;
  readonly container: FakeElement;
}> {
  const fakeRoot = createFakeDomRoot();
  let reactRoot: Root | null = createRoot(fakeRoot.container as unknown as Element);

  await act(async () => {
    reactRoot?.render(createElement(TooltipProvider, null, createElement(DynamicsToolInspector)));
  });

  return {
    container: fakeRoot.container,
    cleanup: async () => {
      await act(async () => {
        reactRoot?.unmount();
      });
      reactRoot = null;
      fakeRoot.restore();
    }
  };
}

async function clickTestId(root: FakeElement, testId: string): Promise<void> {
  const element = getFakeElementByTestId(root, testId);
  await act(async () => {
    getFakeReactProps(element).onClick?.();
  });
}

type FakeReactProps = {
  readonly onBlur?: () => void;
  readonly onChange?: (event: { readonly currentTarget: FakeElement }) => void;
  readonly onClick?: () => void;
  readonly onKeyDown?: (event: { readonly key: string }) => void;
  readonly onPointerCancel?: () => void;
  readonly onPointerUp?: () => void;
};

type FakeNode = FakeElement | FakeTextNode;

class FakeTextNode {
  readonly nodeType = 3;
  readonly nodeName = "#text";
  readonly ownerDocument: FakeDocument;
  parentNode: FakeElement | null = null;
  data: string;
  nodeValue: string;

  constructor(text: string, ownerDocument: FakeDocument) {
    this.data = text;
    this.nodeValue = text;
    this.ownerDocument = ownerDocument;
  }

  get textContent(): string {
    return this.nodeValue;
  }

  set textContent(value: string) {
    this.data = value;
    this.nodeValue = value;
  }
}

class FakeElement {
  readonly nodeType = 1;
  readonly ownerDocument: FakeDocument;
  readonly style: Record<string, string> = {};
  readonly childNodes: FakeNode[] = [];
  readonly listeners = new Map<string, Set<EventListener>>();
  checked = false;
  disabled = false;
  max = "";
  min = "";
  namespaceURI = "http://www.w3.org/1999/xhtml";
  nodeValue: string | null = null;
  parentNode: FakeElement | null = null;
  selected = false;
  type = "";
  value = "";

  private readonly attributes = new Map<string, string>();

  constructor(
    readonly localName: string,
    ownerDocument: FakeDocument
  ) {
    this.ownerDocument = ownerDocument;
  }

  get tagName(): string {
    return this.localName.toUpperCase();
  }

  get nodeName(): string {
    return this.tagName;
  }

  get firstChild(): FakeNode | null {
    return this.childNodes[0] ?? null;
  }

  get options(): FakeElement[] {
    return this.childNodes.filter(
      (child): child is FakeElement => child instanceof FakeElement && child.localName === "option"
    );
  }

  get textContent(): string {
    return this.childNodes.map((child) => child.textContent).join("");
  }

  set textContent(value: string) {
    this.childNodes.splice(0, this.childNodes.length);
    this.appendChild(this.ownerDocument.createTextNode(value));
  }

  appendChild(node: FakeNode): FakeNode {
    node.parentNode?.removeChild(node);
    this.childNodes.push(node);
    node.parentNode = this;
    return node;
  }

  insertBefore(node: FakeNode, before: FakeNode | null): FakeNode {
    if (before === null) {
      return this.appendChild(node);
    }

    node.parentNode?.removeChild(node);
    const index = this.childNodes.indexOf(before);
    if (index < 0) {
      return this.appendChild(node);
    }

    this.childNodes.splice(index, 0, node);
    node.parentNode = this;
    return node;
  }

  removeChild(node: FakeNode): FakeNode {
    const index = this.childNodes.indexOf(node);
    if (index >= 0) {
      this.childNodes.splice(index, 1);
    }
    node.parentNode = null;
    return node;
  }

  setAttribute(name: string, value: string): void {
    const normalized = String(value);
    this.attributes.set(name, normalized);
    if (name === "value") {
      this.value = normalized;
    } else if (name === "min") {
      this.min = normalized;
    } else if (name === "max") {
      this.max = normalized;
    } else if (name === "type") {
      this.type = normalized;
    } else if (name === "disabled") {
      this.disabled = true;
    } else if (name === "selected") {
      this.selected = true;
    } else if (name === "checked") {
      this.checked = true;
    }
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }

  removeAttribute(name: string): void {
    this.attributes.delete(name);
    if (name === "disabled" || name === "selected" || name === "checked") {
      this[name] = false;
    }
  }

  addEventListener(type: string, listener: EventListener): void {
    const listeners = this.listeners.get(type) ?? new Set<EventListener>();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type: string, listener: EventListener): void {
    this.listeners.get(type)?.delete(listener);
  }

  contains(node: FakeNode): boolean {
    if (node === this) {
      return true;
    }

    return this.childNodes.some(
      (child) => child instanceof FakeElement && child.contains(node)
    );
  }
}

class FakeDocument {
  readonly nodeType = 9;
  readonly nodeName = "#document";
  readonly namespaceURI = "http://www.w3.org/1999/xhtml";
  readonly documentElement: FakeElement;
  readonly body: FakeElement;
  readonly defaultView: {
    readonly document: FakeDocument;
    readonly Element: typeof FakeElement;
    readonly HTMLElement: typeof FakeElement;
    readonly SVGElement: typeof FakeElement;
    readonly HTMLIFrameElement: new () => object;
    readonly clearTimeout: typeof globalThis.clearTimeout;
    readonly setTimeout: typeof globalThis.setTimeout;
  };
  activeElement: FakeElement | null = null;

  constructor() {
    this.documentElement = new FakeElement("html", this);
    this.body = new FakeElement("body", this);
    this.documentElement.appendChild(this.body);
    this.defaultView = {
      document: this,
      Element: FakeElement,
      HTMLElement: FakeElement,
      SVGElement: FakeElement,
      HTMLIFrameElement: class HTMLIFrameElement {},
      clearTimeout: globalThis.clearTimeout.bind(globalThis),
      setTimeout: globalThis.setTimeout.bind(globalThis)
    };
  }

  createElement(tagName: string): FakeElement {
    return new FakeElement(tagName.toLowerCase(), this);
  }

  createElementNS(namespaceURI: string, tagName: string): FakeElement {
    const element = this.createElement(tagName);
    element.namespaceURI = namespaceURI;
    return element;
  }

  createTextNode(text: string): FakeTextNode {
    return new FakeTextNode(text, this);
  }

  addEventListener(): void {
    return undefined;
  }

  removeEventListener(): void {
    return undefined;
  }
}

type ReactActGlobal = typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
};

function createFakeDomRoot(): {
  readonly container: FakeElement;
  readonly restore: () => void;
} {
  const document = new FakeDocument();
  const reactActGlobal = globalThis as ReactActGlobal;
  const previous = {
    document: globalThis.document,
    window: globalThis.window,
    Element: globalThis.Element,
    HTMLElement: globalThis.HTMLElement,
    HTMLIFrameElement: globalThis.HTMLIFrameElement,
    SVGElement: globalThis.SVGElement,
    IS_REACT_ACT_ENVIRONMENT: reactActGlobal.IS_REACT_ACT_ENVIRONMENT
  };

  globalThis.document = document as unknown as Document;
  globalThis.window = document.defaultView as unknown as Window & typeof globalThis;
  globalThis.Element = FakeElement as unknown as typeof Element;
  globalThis.HTMLElement = FakeElement as unknown as typeof HTMLElement;
  globalThis.HTMLIFrameElement =
    document.defaultView.HTMLIFrameElement as unknown as typeof HTMLIFrameElement;
  globalThis.SVGElement = FakeElement as unknown as typeof SVGElement;
  reactActGlobal.IS_REACT_ACT_ENVIRONMENT = true;

  return {
    container: document.createElement("div"),
    restore: () => {
      globalThis.document = previous.document;
      globalThis.window = previous.window;
      globalThis.Element = previous.Element;
      globalThis.HTMLElement = previous.HTMLElement;
      globalThis.HTMLIFrameElement = previous.HTMLIFrameElement;
      globalThis.SVGElement = previous.SVGElement;
      reactActGlobal.IS_REACT_ACT_ENVIRONMENT = previous.IS_REACT_ACT_ENVIRONMENT;
    }
  };
}

function getFakeElementByTestId(root: FakeElement, testId: string): FakeElement {
  const element = getMaybeFakeElementByTestId(root, testId);
  if (element === undefined) {
    throw new Error(`Element with data-testid "${testId}" was not rendered.`);
  }

  return element;
}

function getFakeInputByType(root: FakeElement, type: string): FakeElement {
  const input = findFakeElements(
    root,
    (candidate) => candidate.localName === "input" && candidate.type === type
  )[0];
  if (input === undefined) {
    throw new Error(`Input with type "${type}" was not rendered.`);
  }

  return input;
}

function getFakeInputsIn(root: FakeElement): FakeElement[] {
  return findFakeElements(root, (candidate) => candidate.localName === "input");
}

function collectQuickTuneFieldTestIds(root: FakeElement): string[] {
  return findFakeElements(root, (candidate) => {
    const testId = candidate.getAttribute("data-testid");
    return testId !== null && testId.startsWith("dynamics-quick-tune-");
  })
    .map((element) => element.getAttribute("data-testid"))
    .filter((testId): testId is string => testId !== null);
}

function getQuickTuneHelpLabel(root: FakeElement, testId: string): string | null {
  const control = getFakeElementByTestId(root, testId);
  const helpButton = findFakeElements(
    control,
    (candidate) => candidate.localName === "button"
  )[0];
  if (helpButton === undefined) {
    throw new Error(`Quick Tune help button was not rendered for "${testId}".`);
  }

  return helpButton.getAttribute("aria-label");
}

function getMaybeFakeElementByTestId(root: FakeElement, testId: string): FakeElement | undefined {
  return getFakeElementsByTestId(root, testId)[0];
}

function getFakeElementsByTestId(root: FakeElement, testId: string): FakeElement[] {
  return findFakeElements(
    root,
    (candidate) => candidate.getAttribute("data-testid") === testId
  );
}

function findFakeElements(
  root: FakeElement,
  predicate: (element: FakeElement) => boolean
): FakeElement[] {
  const matches: FakeElement[] = [];
  if (predicate(root)) {
    matches.push(root);
  }

  root.childNodes.forEach((child) => {
    if (child instanceof FakeElement) {
      matches.push(...findFakeElements(child, predicate));
    }
  });

  return matches;
}

function getFakeReactProps(element: FakeElement): FakeReactProps {
  const key = Object.keys(element).find((candidate) => candidate.startsWith("__reactProps$"));
  if (key === undefined) {
    return {};
  }

  return (element as unknown as Record<string, FakeReactProps>)[key] ?? {};
}

function installAnimationFrameMock(): {
  readonly flushNext: (timestamp?: number) => void;
  readonly flushAll: () => void;
  readonly pendingCount: () => number;
  readonly restore: () => void;
} {
  const previousRequestAnimationFrame = globalThis.requestAnimationFrame;
  const previousCancelAnimationFrame = globalThis.cancelAnimationFrame;
  const callbacks = new Map<number, FrameRequestCallback>();
  let nextFrameId = 1;

  globalThis.requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
    const frameId = nextFrameId;
    nextFrameId += 1;
    callbacks.set(frameId, callback);
    return frameId;
  });
  globalThis.cancelAnimationFrame = vi.fn((frameId: number) => {
    callbacks.delete(frameId);
  });

  const flushNext = (timestamp = 0) => {
    const entry = callbacks.entries().next().value;
    if (entry === undefined) {
      return;
    }

    const [frameId, callback] = entry;
    callbacks.delete(frameId);
    callback(timestamp);
  };

  return {
    flushNext,
    flushAll: () => {
      const frameIds = [...callbacks.keys()];
      for (const frameId of frameIds) {
        const callback = callbacks.get(frameId);
        if (callback === undefined) {
          continue;
        }
        callbacks.delete(frameId);
        callback(0);
      }
    },
    pendingCount: () => callbacks.size,
    restore: () => {
      globalThis.requestAnimationFrame = previousRequestAnimationFrame;
      globalThis.cancelAnimationFrame = previousCancelAnimationFrame;
    }
  };
}
