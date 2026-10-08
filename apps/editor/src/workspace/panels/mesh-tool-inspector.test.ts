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

  it("keeps successful skipped-noise multi-island diagnostics quiet", () => {
    const markup = renderInspector({
      meshDrafts: [
        createDraft(DRAW_EMPTY, MESH_EMPTY, {
          qualityMetrics: createV6DMultiIslandQualityMetrics({
            multiIslandDiagnostics: createSuccessNoiseMultiIslandDiagnostics()
          })
        })
      ],
      selection: { kind: "drawable", id: DRAW_EMPTY }
    });

    expect(markup).not.toContain('data-testid="mesh-tool-diagnostic-card"');
    expect(markup).not.toContain("Mesh diagnostic");
  });

  it("copies multi-island diagnostics for no-valid-island fallback", () => {
    const markup = renderInspector({
      meshDrafts: [
        createDraft(DRAW_EMPTY, MESH_EMPTY, {
          fallbackReason: "v6-contour-extraction-failed",
          fallbackSteps: [
            {
              method: "auto-outline-v6d-adaptive-contour-constrainautor",
              reason: "v6-contour-extraction-failed"
            }
          ],
          qualityMetrics: createV6DMultiIslandQualityMetrics({
            fallbackReason: "v6-contour-extraction-failed",
            outputKind: "fallback-output",
            multiIslandDiagnostics: createNoValidIslandMultiIslandDiagnostics()
          })
        })
      ],
      selection: { kind: "drawable", id: DRAW_EMPTY }
    });
    const card = sectionMarkup(markup, "mesh-tool-diagnostic-card");

    expect(card).toContain("raw 3 / kept 0 / generated 0");
    expect(card).toContain("3 skipped / 4 px");
    expect(card).toContain("&quot;multiIsland&quot;");
    expect(card).toContain("&quot;multiIslandHandling&quot;: &quot;supported&quot;");
    expect(card).toContain("&quot;rawAlphaComponentCount&quot;: 3");
    expect(card).toContain("&quot;keptIslandCount&quot;: 0");
    expect(card).toContain("&quot;skippedTinyNoiseIslandCount&quot;: 3");
    expect(card).toContain("&quot;skippedTinyNoisePixelCount&quot;: 4");
  });

  it("shows localized multi-island fallback details without warning on skipped noise alone", () => {
    const markup = renderInspector({
      meshDrafts: [
        createDraft(DRAW_EMPTY, MESH_EMPTY, {
          qualityMetrics: createV6DMultiIslandQualityMetrics({
            multiIslandDiagnostics: createLocalizedFallbackMultiIslandDiagnostics()
          })
        })
      ],
      selection: { kind: "drawable", id: DRAW_EMPTY }
    });
    const card = sectionMarkup(markup, "mesh-tool-diagnostic-card");

    expect(card).toContain("Local fail");
    expect(card).toContain("1: 1:v6d-invalid-constraint-input");
    expect(card).toContain("&quot;localizedFallbackCount&quot;: 1");
    expect(card).toContain("&quot;reason&quot;: &quot;v6d-invalid-constraint-input&quot;");
    expect(card).toContain("&quot;handling&quot;: &quot;localized-fallback&quot;");
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

function createV6DMultiIslandQualityMetrics(input: {
  readonly fallbackReason?: "v6-contour-extraction-failed";
  readonly outputKind?: "backend-output" | "fallback-output";
  readonly multiIslandDiagnostics: unknown;
}): MeshToolDraft["qualityMetrics"] {
  return {
    maxEdgeLength: 20,
    maxTriangleArea: 200,
    minAngleDegrees: 45,
    maxVertexValence: 2,
    refinementIterationCount: 0,
    ...(input.fallbackReason === undefined ? {} : { fallbackReason: input.fallbackReason }),
    triangulationMode: "v6d-adaptive-contour-constrainautor",
    v6Metrics: {
      algorithmId: "auto-outline-v6-alpha-constrained-delaunay",
      methodId: "auto-outline-v6d-adaptive-contour-constrainautor",
      backendId: "v6d-adaptive-contour-constrainautor",
      backendImplementationStatus: "implemented",
      requestedSourceId: "outline-v6d-adaptive-contour-constrainautor-rgba",
      actualSourceId: input.outputKind === "fallback-output"
        ? "alpha-aware-rgba"
        : "outline-v6d-adaptive-contour-constrainautor-rgba",
      outputKind: input.outputKind ?? "backend-output",
      preset: "medium",
      ...(input.fallbackReason === undefined ? {} : { fallbackReason: input.fallbackReason }),
      fallbackSteps: input.fallbackReason === undefined
        ? []
        : [
            {
              method: "auto-outline-v6d-adaptive-contour-constrainautor",
              reason: input.fallbackReason
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
      multiIslandHandling: "supported",
      holeHandling: "supported",
      provenance: ["v6-contour-alpha-island-detection"],
      adaptiveDensityDiagnostics: {
        adaptiveDensityReferenceArea: 256,
        adaptiveDensityEffectiveArea: 256,
        adaptiveDensityAreaRatio: 1,
        adaptiveDensityClampedAreaRatio: 1,
        adaptiveDensitySpacingScale: 1,
        adaptiveDensityVertexScale: 1,
        adaptiveDensityBoundaryCapScale: 1,
        resolvedBoundarySpacing: 12,
        resolvedInteriorSpacing: 10,
        resolvedMaxBoundaryVertices: 128,
        resolvedMaxInteriorVertices: 32,
        resolvedInteriorBoundaryClearance: 1.1
      },
      multiIslandDiagnostics: input.multiIslandDiagnostics
    }
  } as MeshToolDraft["qualityMetrics"];
}

function createSuccessNoiseMultiIslandDiagnostics() {
  return {
    rawAlphaComponentCount: 2,
    keptIslandCount: 1,
    generatedIslandCount: 1,
    backendGeneratedIslandCount: 1,
    skippedTinyNoiseIslandCount: 1,
    skippedTinyNoisePixelCount: 2,
    rawOpaquePixelCount: 122,
    largestComponentPixelCount: 120,
    localizedFallbackCount: 0,
    localizedFallbackReasons: [],
    islands: [
      {
        componentOrder: 0,
        pixelCount: 120,
        bounds: { minX: 8, minY: 6, maxX: 35, maxY: 25 },
        handling: "generated",
        vertexCount: 3,
        triangleCount: 1
      },
      {
        componentOrder: 1,
        pixelCount: 2,
        bounds: { minX: 58, minY: 5, maxX: 59, maxY: 5 },
        handling: "skipped-tiny-noise"
      }
    ]
  };
}

function createNoValidIslandMultiIslandDiagnostics() {
  return {
    rawAlphaComponentCount: 3,
    keptIslandCount: 0,
    generatedIslandCount: 0,
    backendGeneratedIslandCount: 0,
    skippedTinyNoiseIslandCount: 3,
    skippedTinyNoisePixelCount: 4,
    rawOpaquePixelCount: 4,
    largestComponentPixelCount: 2,
    localizedFallbackCount: 0,
    localizedFallbackReasons: [],
    islands: [
      {
        componentOrder: 0,
        pixelCount: 1,
        bounds: { minX: 2, minY: 2, maxX: 2, maxY: 2 },
        handling: "skipped-tiny-noise"
      },
      {
        componentOrder: 1,
        pixelCount: 2,
        bounds: { minX: 8, minY: 4, maxX: 9, maxY: 4 },
        handling: "skipped-tiny-noise"
      },
      {
        componentOrder: 2,
        pixelCount: 1,
        bounds: { minX: 18, minY: 10, maxX: 18, maxY: 10 },
        handling: "skipped-tiny-noise"
      }
    ]
  };
}

function createLocalizedFallbackMultiIslandDiagnostics() {
  return {
    rawAlphaComponentCount: 2,
    keptIslandCount: 2,
    generatedIslandCount: 2,
    backendGeneratedIslandCount: 1,
    skippedTinyNoiseIslandCount: 0,
    skippedTinyNoisePixelCount: 0,
    rawOpaquePixelCount: 220,
    largestComponentPixelCount: 120,
    localizedFallbackCount: 1,
    localizedFallbackReasons: [
      {
        componentOrder: 1,
        reason: "v6d-invalid-constraint-input"
      }
    ],
    islands: [
      {
        componentOrder: 0,
        pixelCount: 120,
        bounds: { minX: 8, minY: 6, maxX: 35, maxY: 25 },
        handling: "generated",
        vertexCount: 3,
        triangleCount: 1
      },
      {
        componentOrder: 1,
        pixelCount: 100,
        bounds: { minX: 42, minY: 6, maxX: 58, maxY: 25 },
        handling: "localized-fallback",
        vertexCount: 3,
        triangleCount: 1
      }
    ]
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
