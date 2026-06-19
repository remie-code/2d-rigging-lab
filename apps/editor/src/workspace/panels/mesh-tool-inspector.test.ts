import type { AuthoringSession } from "@private-2d-rigging-lab/authoring-core";
import {
  DrawableIdSchema,
  type DrawableId,
  MeshIdSchema,
  type MeshId,
  PartIdSchema,
  ProvenanceIdSchema,
  SourceAssetIdSchema,
  TextureIdSchema,
  type TextureId
} from "@private-2d-rigging-lab/contracts";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import {
  MeshToolInspector
} from "./mesh-tool-inspector";
import type {
  MeshToolDraft,
  MeshToolGenerationDiagnostic
} from "../../features/editor-session/editor-session-context";
import type { EditorSelection } from "../../features/editor-session/model/editor-selection";

const editorSessionMock = vi.hoisted(() => ({ current: undefined as unknown }));
const editorUiStoreMock = vi.hoisted(() => ({
  current: {
    meshOverlayVisible: true,
    setMeshOverlayVisible: vi.fn()
  }
}));

vi.mock("../../features/editor-session/editor-session-context", () => ({
  useEditorSession: () => editorSessionMock.current
}));

vi.mock("../../state/editor-ui-store", () => ({
  useEditorUiStore: (selector: (state: typeof editorUiStoreMock.current) => unknown) =>
    selector(editorUiStoreMock.current)
}));

const PART_ROOT = PartIdSchema.parse("part_root");
const DRAW_EMPTY = DrawableIdSchema.parse("draw_empty");
const DRAW_GENERATED = DrawableIdSchema.parse("draw_generated");
const MESH_EMPTY = MeshIdSchema.parse("mesh_empty");
const MESH_GENERATED = MeshIdSchema.parse("mesh_generated");
const TEX_EMPTY = TextureIdSchema.parse("tex_empty");
const TEX_GENERATED = TextureIdSchema.parse("tex_generated");
const SOURCE_ASSET = SourceAssetIdSchema.parse("src_mesh_tool_inspector");
const PROVENANCE = ProvenanceIdSchema.parse("prov_mesh_tool_inspector");

describe("MeshToolInspector target section", () => {
  it("renders only the target Drawable name for a single preview target", () => {
    const markup = renderInspector({
      meshDrafts: [createDraft(DRAW_EMPTY, MESH_EMPTY)],
      selection: { kind: "drawable", id: DRAW_EMPTY }
    });
    const target = sectionMarkup(markup, "mesh-tool-inspector");

    expect(target).toContain("Empty Drawable");
    expect(target).not.toContain("Status");
    expect(target).not.toContain("Preset");
    expect(target).not.toContain("Vertices");
    expect(target).not.toContain("Triangles");
    expect(target).not.toContain("Source");
    expect(target).not.toContain("Alpha bounds");
    expect(target).not.toContain("Max edge");
    expect(target).not.toContain("Min angle");
    expect(target).not.toContain("Constraint quality");
  });

  it("lists selected Drawable names and warns about generated meshes excluded from batch", () => {
    const markup = renderInspector({
      meshDrafts: [],
      selection: {
        kind: "drawableSet",
        ids: [DRAW_EMPTY, DRAW_GENERATED]
      }
    });
    const target = sectionMarkup(markup, "mesh-tool-inspector");
    const warning = sectionMarkup(markup, "mesh-tool-existing-mesh-warning");

    expect(target).toContain("Empty Drawable");
    expect(target).toContain("Generated Drawable");
    expect(markup).toContain("1 eligible / 1 excluded");
    expect(warning).toContain("Existing meshes excluded");
    expect(warning).toContain("Generated Drawable");
  });

  it("shows fallback mesh diagnostics with copyable generation details", () => {
    const markup = renderInspector({
      meshDrafts: [
        createDraft(DRAW_EMPTY, MESH_EMPTY, {
          fallbackReason: "v6-contour-extraction-failed",
          fallbackSteps: [
            {
              method: "auto-outline-v6d-adaptive-contour-constrainautor",
              reason: "v6-contour-extraction-failed"
            }
          ]
        })
      ],
      selection: { kind: "drawable", id: DRAW_EMPTY }
    });
    const card = sectionMarkup(markup, "mesh-tool-diagnostic-card");

    expect(card).toContain("Mesh diagnostic");
    expect(card).toContain("Mesh generation used fallback");
    expect(card).toContain("Copy diagnostic details");
    expect(card).toContain("auto-outline-v6d-adaptive-contour-constrainautor");
    expect(card).toContain("outline-v6d-adaptive-contour-constrainautor-rgba");
    expect(card).toContain("Empty Drawable");
    expect(card).toContain("v6-contour-extraction-failed");
    expect(card).toContain("&quot;triangles&quot;: 1");
    expect(card).toContain("&quot;vertices&quot;: 3");
  });

  it("copies v6d constrainautor diagnostics fields from quality metrics", () => {
    const markup = renderInspector({
      meshDrafts: [
        createDraft(DRAW_EMPTY, MESH_EMPTY, {
          fallbackReason: "v6d-invalid-constraint-input",
          fallbackSteps: [
            {
              method: "auto-outline-v6d-adaptive-contour-constrainautor",
              reason: "v6d-invalid-constraint-input"
            }
          ],
          qualityMetrics: createV6DInvalidConstraintQualityMetrics()
        })
      ],
      selection: { kind: "drawable", id: DRAW_EMPTY }
    });
    const card = sectionMarkup(markup, "mesh-tool-diagnostic-card");

    expect(card).toContain("&quot;constrainautorDiagnostics&quot;");
    expect(card).toContain("&quot;failureStage&quot;: &quot;constraint-input&quot;");
    expect(card).toContain("&quot;invalidConstraintInputReasons&quot;");
    expect(card).toContain("&quot;zeroLengthConstraintEdgeCount&quot;: 1");
    expect(card).toContain("&quot;sanitizedConstraintEdgeCount&quot;: 2");
  });

  it("shows fallback mesh diagnostics for drawableSet target drafts", () => {
    const markup = renderInspector({
      meshDrafts: [
        createDraft(DRAW_EMPTY, MESH_EMPTY),
        createDraft(DRAW_GENERATED, MESH_GENERATED, {
          fallbackReason: "v6-contour-extraction-failed",
          fallbackSteps: [
            {
              method: "auto-outline-v6d-adaptive-contour-constrainautor",
              reason: "v6-contour-extraction-failed"
            }
          ]
        })
      ],
      selection: {
        kind: "drawableSet",
        ids: [DRAW_EMPTY, DRAW_GENERATED]
      }
    });
    const card = sectionMarkup(markup, "mesh-tool-diagnostic-card");

    expect(card).toContain("Mesh generation used fallback");
    expect(card).toContain("Generated Drawable");
    expect(card).toContain("v6-contour-extraction-failed");
    expect(card).toContain("&quot;id&quot;: &quot;draw_generated&quot;");
    expect(card).toContain("&quot;triangles&quot;: 1");
  });

  it("shows 0-triangle mesh diagnostics without verbose warning row text", () => {
    const markup = renderInspector({
      meshDrafts: [createDraft(DRAW_EMPTY, MESH_EMPTY, { triangleCount: 0 })],
      selection: { kind: "drawable", id: DRAW_EMPTY }
    });
    const card = sectionMarkup(markup, "mesh-tool-diagnostic-card");

    expect(card).toContain("Mesh preview has 0 triangles.");
    expect(card).toContain("&quot;triangles&quot;: 0");
    expect(card).toContain("&quot;vertices&quot;: 3");
  });

  it("shows 0-triangle mesh diagnostics for drawableSet target drafts", () => {
    const markup = renderInspector({
      meshDrafts: [
        createDraft(DRAW_EMPTY, MESH_EMPTY),
        createDraft(DRAW_GENERATED, MESH_GENERATED, { triangleCount: 0 })
      ],
      selection: {
        kind: "drawableSet",
        ids: [DRAW_EMPTY, DRAW_GENERATED]
      }
    });
    const card = sectionMarkup(markup, "mesh-tool-diagnostic-card");

    expect(card).toContain("Mesh preview has 0 triangles.");
    expect(card).toContain("Generated Drawable");
    expect(card).toContain("&quot;id&quot;: &quot;draw_generated&quot;");
    expect(card).toContain("&quot;triangles&quot;: 0");
  });

  it("shows transient generation failure diagnostics and copy payload details", () => {
    const markup = renderInspector({
      meshDrafts: [],
      meshGenerationDiagnostic: {
        kind: "generationFailed",
        drawableId: DRAW_EMPTY,
        drawableName: "Empty Drawable",
        presetId: "standard",
        densityHint: "medium",
        method: "auto-outline-v6d-adaptive-contour-constrainautor",
        meshBounds: { x: 0, y: 0, width: 20, height: 20 },
        vertexCount: 0,
        triangleCount: 0,
        failureReason: "createGeneratedMeshForDrawable returned no preview result."
      },
      selection: { kind: "drawable", id: DRAW_EMPTY }
    });
    const card = sectionMarkup(markup, "mesh-tool-diagnostic-card");

    expect(card).toContain("createGeneratedMeshForDrawable returned no preview result.");
    expect(card).toContain("&quot;diagnosticKind&quot;: &quot;generationFailed&quot;");
    expect(card).toContain("&quot;id&quot;: &quot;draw_empty&quot;");
    expect(card).toContain("&quot;name&quot;: &quot;Empty Drawable&quot;");
    expect(card).toContain("&quot;width&quot;: 20");
    expect(card).toContain("&quot;triangles&quot;: 0");
  });
});

function renderInspector(input: {
  readonly selection: EditorSelection;
  readonly meshDrafts: readonly MeshToolDraft[];
  readonly meshGenerationDiagnostic?: MeshToolGenerationDiagnostic | null;
}): string {
  editorSessionMock.current = {
    applyMeshDraft: vi.fn(),
    cancelMeshDraft: vi.fn(),
    editorHiddenPartIds: new Set(),
    meshDraft: input.meshDrafts.length === 1 ? input.meshDrafts[0] : null,
    meshGenerationDiagnostic: input.meshGenerationDiagnostic ?? null,
    meshDrafts: input.meshDrafts,
    previewMeshDraft: vi.fn(),
    previewMeshDrafts: vi.fn(),
    selectDrawable: vi.fn(),
    selection: input.selection,
    session: createFixtureSession()
  };

  return renderToStaticMarkup(createElement(MeshToolInspector));
}

function sectionMarkup(markup: string, testId: string): string {
  const escapedTestId = testId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = markup.match(
    new RegExp(`<section[^>]*data-testid="${escapedTestId}"[^>]*>[\\s\\S]*?<\\/section>`)
  );
  if (match === null) {
    throw new Error(`Expected section with data-testid ${testId}.`);
  }

  return match[0];
}

function createDraft(
  drawableId: DrawableId,
  meshId: MeshId,
  options: {
    readonly fallbackReason?: MeshToolDraft["fallbackReason"];
    readonly fallbackSteps?: MeshToolDraft["fallbackSteps"];
    readonly qualityMetrics?: MeshToolDraft["qualityMetrics"];
    readonly triangleCount?: number;
  } = {}
): MeshToolDraft {
  const mesh = createGeneratedMesh(meshId, drawableId);
  if (options.triangleCount === 0) {
    mesh.triangles = [];
  }

  return {
    drawableId,
    presetId: "standard",
    commitMode: "single",
    method: "auto-outline-v6d-adaptive-contour-constrainautor",
    mesh,
    source: "outline-v6d-adaptive-contour-constrainautor-rgba",
    ...(options.fallbackReason === undefined ? {} : { fallbackReason: options.fallbackReason }),
    ...(options.fallbackSteps === undefined ? {} : { fallbackSteps: options.fallbackSteps }),
    ...(options.qualityMetrics === undefined ? {} : { qualityMetrics: options.qualityMetrics })
  };
}

function createV6DInvalidConstraintQualityMetrics(): MeshToolDraft["qualityMetrics"] {
  return {
    maxEdgeLength: 20,
    maxTriangleArea: 200,
    minAngleDegrees: 45,
    maxVertexValence: 2,
    refinementIterationCount: 0,
    fallbackReason: "v6d-invalid-constraint-input",
    triangulationMode: "v6-backend-blocked-fallback",
    v6Metrics: {
      algorithmId: "auto-outline-v6-alpha-constrained-delaunay",
      methodId: "auto-outline-v6d-adaptive-contour-constrainautor",
      backendId: "v6d-adaptive-contour-constrainautor",
      backendImplementationStatus: "implemented",
      requestedSourceId: "outline-v6d-adaptive-contour-constrainautor-rgba",
      actualSourceId: "alpha-aware-rgba",
      outputKind: "fallback-output",
      preset: "medium",
      fallbackReason: "v6d-invalid-constraint-input",
      fallbackSteps: [
        {
          method: "auto-outline-v6d-adaptive-contour-constrainautor",
          reason: "v6d-invalid-constraint-input"
        }
      ],
      vertexCount: 3,
      triangleCount: 1,
      boundaryVertexCount: 3,
      interiorVertexCount: 0,
      alphaBoundsAvailable: true,
      contourLoopCount: 1,
      holeLikeRegionCount: 0,
      removedTriangleCount: 0,
      outsideOrCrossingTriangleCount: 0,
      multiIslandHandling: "main-island-only",
      holeHandling: "supported",
      provenance: ["dependency-available", "fallback-v6d-invalid-constraint-input"],
      constrainautorDiagnostics: {
        dependencyGateStatus: "available",
        constraintEdgeCount: 2,
        preservedConstraintEdgeCount: 0,
        missingConstraintEdgeCount: 2,
        constraintRecoveryFailed: true,
        outsideTriangleCount: 0,
        failureStage: "constraint-input",
        invalidConstraintInputReasons: ["zero-length-constraint-edge"],
        inputPointCount: 4,
        finitePointCount: 4,
        sanitizedPointCount: 3,
        mergedPointCount: 1,
        inputConstraintEdgeCount: 3,
        sanitizedConstraintEdgeCount: 2,
        zeroLengthConstraintEdgeCount: 1,
        invalidConstraintEndpointCount: 0,
        duplicateConstraintEdgeCount: 0,
        crossingConstraintEdgeCount: 0,
        pointOnConstraintEdgeCount: 0
      }
    }
  };
}

function createFixtureSession(): AuthoringSession {
  return {
    graph: {
      parts: [
        {
          partId: PART_ROOT,
          displayName: "Root",
          childPartIds: [],
          drawableIds: [DRAW_EMPTY, DRAW_GENERATED],
          children: [
            { kind: "drawable", drawableId: DRAW_EMPTY },
            { kind: "drawable", drawableId: DRAW_GENERATED }
          ]
        }
      ],
      drawables: [
        createDrawable(DRAW_EMPTY, MESH_EMPTY, TEX_EMPTY, "Empty Drawable"),
        createDrawable(DRAW_GENERATED, MESH_GENERATED, TEX_GENERATED, "Generated Drawable")
      ],
      meshes: [
        {
          meshId: MESH_EMPTY,
          drawableId: DRAW_EMPTY,
          vertices: [],
          uvs: [],
          triangles: [],
          vertexStableIds: [],
          bounds: { x: 0, y: 0, width: 20, height: 20 },
          generationProvenanceId: PROVENANCE
        },
        createGeneratedMesh(MESH_GENERATED, DRAW_GENERATED)
      ]
    }
  } as AuthoringSession;
}

function createDrawable(
  drawableId: DrawableId,
  meshId: MeshId,
  textureId: TextureId,
  displayName: string
) {
  return {
    drawableId,
    displayName,
    partId: PART_ROOT,
    sourceAssetId: SOURCE_ASSET,
    textureId,
    meshId,
    defaultOpacity: 1,
    runtimeVisibility: true,
    baseDrawOrder: 0,
    sourceProvenanceId: PROVENANCE
  };
}

function createGeneratedMesh(meshId: MeshId, drawableId: DrawableId) {
  return {
    meshId,
    drawableId,
    vertices: [
      { x: 0, y: 0 },
      { x: 20, y: 0 },
      { x: 0, y: 20 }
    ],
    uvs: [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: 1 }
    ],
    triangles: [[0, 1, 2]] as [number, number, number][],
    vertexStableIds: ["vtx_0", "vtx_1", "vtx_2"],
    bounds: { x: 0, y: 0, width: 20, height: 20 },
    generationProvenanceId: PROVENANCE
  };
}
