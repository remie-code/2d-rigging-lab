import type { AuthoringSession } from "@private-2d-rigging-lab/authoring-core";
import { DynamicsGroupIdSchema, ParameterIdSchema } from "@private-2d-rigging-lab/contracts";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { DynamicsToolInspector } from "./dynamics-tool-inspector";
import { createEmptyAuthoringSession } from "../../features/editor-session/model/empty-authoring-session";
import {
  createDynamicsToolPreviewEvaluation,
  createInitialDynamicsToolPreviewState
} from "../../features/editor-session/model/dynamics-tool-state";

const editorSessionMock = vi.hoisted(() => ({ current: undefined as unknown }));

vi.mock("../../features/editor-session/editor-session-context", () => ({
  useEditorSession: () => editorSessionMock.current
}));

const DRIVER_X = ParameterIdSchema.parse("param_dynamics_driver_x");
const DRIVER_Y = ParameterIdSchema.parse("param_dynamics_driver_y");
const OUTPUT = ParameterIdSchema.parse("param_dynamics_output");
const GROUP_ID = DynamicsGroupIdSchema.parse("dyn_inspector_sway");

describe("DynamicsToolInspector", () => {
  it("renders group authoring controls, multiple inputs, output kind selection, and preview reset", () => {
    const session = createDynamicsSession();
    const preview = {
      ...createInitialDynamicsToolPreviewState(),
      selectedGroupId: GROUP_ID
    };
    editorSessionMock.current = {
      createDynamicsGroup: vi.fn(),
      deleteDynamicsGroup: vi.fn(),
      dynamicsToolPreview: preview,
      dynamicsToolPreviewEvaluation: createDynamicsToolPreviewEvaluation(session, preview),
      resetDynamicsToolPreviewSimulation: vi.fn(),
      session,
      setDynamicsToolPreviewDriverValue: vi.fn(),
      setDynamicsToolPreviewGroupId: vi.fn(),
      updateDynamicsGroup: vi.fn()
    };

    const markup = renderToStaticMarkup(createElement(DynamicsToolInspector));

    expect(markup).toContain('data-testid="dynamics-tool-inspector"');
    expect(markup).toContain('data-testid="dynamics-group-list"');
    expect(markup).toContain("Inspector Sway");
    expect(countOccurrences(markup, 'data-testid="dynamics-input-row"')).toBe(2);
    expect(markup).toContain('data-testid="dynamics-create-group"');
    expect(markup).toContain('data-testid="dynamics-apply-group"');
    expect(markup).toContain('data-testid="dynamics-delete-group"');
    expect(markup).toContain('data-testid="dynamics-output-kind"');
    expect(markup).toContain('<option value="angle" selected="">angle</option>');
    expect(markup).toContain('<option value="positionX">positionX</option>');
    expect(markup).toContain('<option value="positionY">positionY</option>');
    expect(markup).toContain('data-testid="dynamics-preview-reset"');
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
  session.graph.dynamicsGroups.push({
    dynamicsGroupId: GROUP_ID,
    displayName: "Inspector Sway",
    enabled: true,
    presetId: "hair",
    inputs: [
      {
        parameterId: DRIVER_X,
        kind: "angle",
        influencePercent: 100,
        invert: false,
        normalization: { min: -30, center: 0, max: 30 }
      },
      {
        parameterId: DRIVER_Y,
        kind: "positionX",
        influencePercent: 50,
        invert: false,
        normalization: { min: -20, center: 0, max: 20 }
      }
    ],
    pendulums: [
      {
        length: 0.8,
        sway: 0.7,
        reactionSpeed: 12,
        convergenceSpeed: 4
      }
    ],
    outputs: [
      {
        parameterId: OUTPUT,
        kind: "angle",
        strength: 5,
        invert: false,
        limit: 10
      }
    ]
  });
  return session;
}

function countOccurrences(value: string, needle: string): number {
  return value.split(needle).length - 1;
}
