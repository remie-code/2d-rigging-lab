import type { AuthoringSession } from "@private-2d-rigging-lab/authoring-core";
import {
  DrawableIdSchema,
  MeshIdSchema,
  PartIdSchema,
  ProvenanceIdSchema,
  SourceAssetIdSchema,
  TextureIdSchema
} from "@private-2d-rigging-lab/contracts";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import {
  MeshToolInspector
} from "./mesh-tool-inspector";
import type {
  MeshToolDraft
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
});

function renderInspector(input: {
  readonly selection: EditorSelection;
  readonly meshDrafts: readonly MeshToolDraft[];
}): string {
  editorSessionMock.current = {
    applyMeshDraft: vi.fn(),
    cancelMeshDraft: vi.fn(),
    editorHiddenPartIds: new Set(),
    meshDraft: input.meshDrafts.length === 1 ? input.meshDrafts[0] : null,
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

function createDraft(drawableId: typeof DRAW_EMPTY, meshId: typeof MESH_EMPTY): MeshToolDraft {
  return {
    drawableId,
    presetId: "standard",
    commitMode: "single",
    method: "auto-outline-v6d-adaptive-contour-constrainautor",
    mesh: createGeneratedMesh(meshId, drawableId),
    source: "bounds-grid"
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
  drawableId: typeof DRAW_EMPTY,
  meshId: typeof MESH_EMPTY,
  textureId: typeof TEX_EMPTY,
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

function createGeneratedMesh(meshId: typeof MESH_EMPTY, drawableId: typeof DRAW_EMPTY) {
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
