import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  KeyformSetIdSchema,
  PartIdSchema,
  ParameterIdSchema,
  RigControlIdSchema
} from "@private-2d-rigging-lab/contracts";
import type {
  Linear1dKeyformSetDto,
  PackageDocumentDto,
  ParameterDto,
  ParameterGrid2dKeyformSetDto,
  RigControlDto
} from "@private-2d-rigging-lab/package-format";
import { parsePackageDocument } from "@private-2d-rigging-lab/package-format";
import { describe, expect, it } from "vitest";

import {
  AuthoringMutationError,
  createAuthoringSessionFromPackageDocument,
  createLinear1dKeyformSet,
  createParameter,
  createParameterGrid2dKeyformSet,
  createRotation2dRigControl,
  createWarpLattice2dRigControl,
  getKeyformSetById
} from "./index.js";

describe("keyform authoring mutations", () => {
  it("creates a linear 1d keyform set and marks the session dirty", () => {
    const session = createAuthoringSessionFromPackageDocument(loadMinimalFixturePackageDocument());
    const parameter = createTestParameter("param_face_yaw");
    createParameter(session, parameter);
    const baseRevision = session.authoringRevision;
    const keyformSet = createLinear1dMeshKeyformSet("keyset_face_yaw_body", parameter.parameterId);

    const result = createLinear1dKeyformSet(session, keyformSet);

    expect(result.session).toBe(session);
    expect(result.authoringRevision).toBe(baseRevision + 1);
    expect(result.keyformSet).toEqual(keyformSet);
    expect(result.keyformSet).not.toBe(keyformSet);
    expect(getKeyformSetById(session.graph, keyformSet.keyformSetId)).toEqual(keyformSet);
    expect(session.graph.stableOrder).toContain(keyformSet.keyformSetId);
    expect(session.dirty).toBe(true);
  });

  it("creates a linear 1d rig control angle keyform set", () => {
    const session = createAuthoringSessionFromPackageDocument(loadMinimalFixturePackageDocument());
    const parameter = createTestParameter("param_face_yaw");
    createParameter(session, parameter);
    createRotation2dRigControl(session, createTestRotation2dRigControl("rig_body_rotation"));
    const keyformSet = createLinear1dRigControlAngleKeyformSet(
      "keyset_body_rotation_angle",
      parameter.parameterId
    );

    const result = createLinear1dKeyformSet(session, keyformSet);

    expect(result.keyformSet).toEqual(keyformSet);
    expect(getKeyformSetById(session.graph, keyformSet.keyformSetId)).toEqual(
      expect.objectContaining({
        target: {
          kind: "rigControl",
          id: "rig_body_rotation",
          property: "angleDegrees"
        },
        keys: [
          {
            value: 1,
            statePatch: 30
          }
        ]
      })
    );
  });

  it("rejects warpLattice2d controlPointOffsets keyforms with invalid cardinality", () => {
    const session = createAuthoringSessionFromPackageDocument(loadMinimalFixturePackageDocument());
    const parameter = createTestParameter("param_face_yaw");
    createParameter(session, parameter);
    createWarpLattice2dRigControl(session, createTestWarpLattice2dRigControl("rig_face_warp"));
    const keyformSet = createLinear1dWarpControlPointOffsetsKeyformSet(
      "keyset_face_warp_offsets",
      parameter.parameterId
    );

    expectMutationErrorCode(
      () => createLinear1dKeyformSet(session, keyformSet),
      "invalid_warp_lattice_control_point_offsets_patch"
    );
    expect(getKeyformSetById(session.graph, keyformSet.keyformSetId)).toBeUndefined();
  });

  it("creates a parameter grid 2d keyform set with distinct axis parameters", () => {
    const session = createAuthoringSessionFromPackageDocument(loadMinimalFixturePackageDocument());
    const parameterX = createTestParameter("param_face_yaw");
    const parameterY = createTestParameter("param_face_pitch");
    createParameter(session, parameterX);
    createParameter(session, parameterY);
    const keyformSet = createGrid2dMeshKeyformSet({
      keyformSetId: "keyset_face_grid_body",
      parameterX: parameterX.parameterId,
      parameterY: parameterY.parameterId
    });

    const result = createParameterGrid2dKeyformSet(session, keyformSet);

    expect(result.keyformSet).toEqual(keyformSet);
    expect(getKeyformSetById(session.graph, keyformSet.keyformSetId)).toEqual(
      expect.objectContaining({
        evaluator: "parameter-grid-2d-v1",
        missingKeyPolicy: "diagnostic-error"
      })
    );
  });

  it("rejects a linear keyform set with a missing parameter", () => {
    const session = createAuthoringSessionFromPackageDocument(loadMinimalFixturePackageDocument());
    const keyformSet = createLinear1dMeshKeyformSet(
      "keyset_missing_parameter",
      ParameterIdSchema.parse("param_missing")
    );

    expectMutationErrorCode(
      () => createLinear1dKeyformSet(session, keyformSet),
      "missing_parameter"
    );
  });

  it("rejects a keyform set with a missing target", () => {
    const session = createAuthoringSessionFromPackageDocument(loadMinimalFixturePackageDocument());
    const parameter = createTestParameter("param_face_yaw");
    createParameter(session, parameter);
    const keyformSet = {
      ...createLinear1dMeshKeyformSet("keyset_missing_target", parameter.parameterId),
      target: {
        kind: "mesh",
        id: "mesh_missing",
        property: "vertices"
      }
    } satisfies Linear1dKeyformSetDto;

    expectMutationErrorCode(
      () => createLinear1dKeyformSet(session, keyformSet),
      "missing_keyform_target"
    );
  });

  it("rejects a keyform set with a missing rig control target", () => {
    const session = createAuthoringSessionFromPackageDocument(loadMinimalFixturePackageDocument());
    const parameter = createTestParameter("param_face_yaw");
    createParameter(session, parameter);
    const keyformSet = {
      ...createLinear1dRigControlAngleKeyformSet("keyset_missing_rig_control", parameter.parameterId),
      target: {
        kind: "rigControl",
        id: "rig_missing_rotation",
        property: "angleDegrees"
      }
    } satisfies Linear1dKeyformSetDto;

    expectMutationErrorCode(
      () => createLinear1dKeyformSet(session, keyformSet),
      "missing_keyform_target"
    );
  });

  it("rejects a keyform set with an unsupported target property", () => {
    const session = createAuthoringSessionFromPackageDocument(loadMinimalFixturePackageDocument());
    const parameter = createTestParameter("param_face_yaw");
    createParameter(session, parameter);
    const keyformSet = {
      ...createLinear1dMeshKeyformSet("keyset_unsupported_target_property", parameter.parameterId),
      target: {
        kind: "mesh",
        id: "mesh_body",
        property: "angleDegrees"
      }
    } satisfies Linear1dKeyformSetDto;

    expectMutationErrorCode(
      () => createLinear1dKeyformSet(session, keyformSet),
      "unsupported_keyform_target_property"
    );
  });

  it("rejects a rig control keyform set with an unsupported target property", () => {
    const session = createAuthoringSessionFromPackageDocument(loadMinimalFixturePackageDocument());
    const parameter = createTestParameter("param_face_yaw");
    createParameter(session, parameter);
    createRotation2dRigControl(session, createTestRotation2dRigControl("rig_body_rotation"));
    const keyformSet = {
      ...createLinear1dRigControlAngleKeyformSet("keyset_unsupported_rig_control_property", parameter.parameterId),
      target: {
        kind: "rigControl",
        id: "rig_body_rotation",
        property: "opacity"
      }
    } satisfies Linear1dKeyformSetDto;

    expectMutationErrorCode(
      () => createLinear1dKeyformSet(session, keyformSet),
      "unsupported_keyform_target_property"
    );
  });

  it("rejects duplicate keyform set ids", () => {
    const session = createAuthoringSessionFromPackageDocument(loadMinimalFixturePackageDocument());
    const parameter = createTestParameter("param_face_yaw");
    createParameter(session, parameter);
    const keyformSet = createLinear1dMeshKeyformSet("keyset_duplicate_body", parameter.parameterId);
    createLinear1dKeyformSet(session, keyformSet);

    expectMutationErrorCode(
      () => createLinear1dKeyformSet(session, keyformSet),
      "duplicate_keyform_set"
    );
  });

  it("rejects a grid keyform set that uses the same parameter on both axes", () => {
    const session = createAuthoringSessionFromPackageDocument(loadMinimalFixturePackageDocument());
    const parameter = createTestParameter("param_face_yaw");
    createParameter(session, parameter);
    const keyformSet = createGrid2dMeshKeyformSet({
      keyformSetId: "keyset_duplicate_axis",
      parameterX: parameter.parameterId,
      parameterY: parameter.parameterId
    });

    expectMutationErrorCode(
      () => createParameterGrid2dKeyformSet(session, keyformSet),
      "duplicate_keyform_grid_axis_parameter"
    );
  });

  it("rejects duplicate grid coordinates", () => {
    const session = createAuthoringSessionFromPackageDocument(loadMinimalFixturePackageDocument());
    const parameterX = createTestParameter("param_face_yaw");
    const parameterY = createTestParameter("param_face_pitch");
    createParameter(session, parameterX);
    createParameter(session, parameterY);
    const keyformSet = {
      ...createGrid2dMeshKeyformSet({
        keyformSetId: "keyset_duplicate_coordinate",
        parameterX: parameterX.parameterId,
        parameterY: parameterY.parameterId
      }),
      keys: [
        { x: -1, y: -1, statePatch: [] },
        { x: -1, y: -1, statePatch: [] }
      ]
    } satisfies ParameterGrid2dKeyformSetDto;

    expectMutationErrorCode(
      () => createParameterGrid2dKeyformSet(session, keyformSet),
      "duplicate_keyform_grid_coordinate"
    );
  });
});

const createLinear1dMeshKeyformSet = (
  keyformSetIdText: string,
  parameterId: ParameterDto["parameterId"]
): Linear1dKeyformSetDto => ({
  keyformSetId: KeyformSetIdSchema.parse(keyformSetIdText),
  target: {
    kind: "mesh",
    id: "mesh_body",
    property: "vertices"
  },
  parameterId,
  evaluator: "linear-1d-v1",
  interpolation: "linear-1d-v1",
  compositionMode: "additiveDelta",
  compositionOrder: 0,
  keys: [
    { value: -1, statePatch: [{ x: -1, y: 0 }] },
    { value: 1, statePatch: [{ x: 1, y: 0 }] }
  ]
});

const createLinear1dRigControlAngleKeyformSet = (
  keyformSetIdText: string,
  parameterId: ParameterDto["parameterId"]
): Linear1dKeyformSetDto => ({
  keyformSetId: KeyformSetIdSchema.parse(keyformSetIdText),
  target: {
    kind: "rigControl",
    id: "rig_body_rotation",
    property: "angleDegrees"
  },
  parameterId,
  evaluator: "linear-1d-v1",
  interpolation: "linear-1d-v1",
  compositionMode: "replace",
  compositionOrder: 0,
  keys: [
    { value: 1, statePatch: 30 }
  ]
});

const createLinear1dWarpControlPointOffsetsKeyformSet = (
  keyformSetIdText: string,
  parameterId: ParameterDto["parameterId"]
): Linear1dKeyformSetDto => ({
  keyformSetId: KeyformSetIdSchema.parse(keyformSetIdText),
  target: {
    kind: "rigControl",
    id: "rig_face_warp",
    property: "controlPointOffsets"
  },
  parameterId,
  evaluator: "linear-1d-v1",
  interpolation: "linear-1d-v1",
  compositionMode: "replace",
  compositionOrder: 0,
  keys: [
    {
      value: 1,
      statePatch: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 0, y: 1 }
      ]
    }
  ]
});

const createGrid2dMeshKeyformSet = (input: {
  readonly keyformSetId: string;
  readonly parameterX: ParameterDto["parameterId"];
  readonly parameterY: ParameterDto["parameterId"];
}): ParameterGrid2dKeyformSetDto => ({
  keyformSetId: KeyformSetIdSchema.parse(input.keyformSetId),
  target: {
    kind: "mesh",
    id: "mesh_body",
    property: "vertices"
  },
  parameterX: input.parameterX,
  parameterY: input.parameterY,
  evaluator: "parameter-grid-2d-v1",
  interpolation: "bilinear-grid-v1",
  clampPolicy: "clamp-to-parameter-range",
  missingKeyPolicy: "diagnostic-error",
  compositionMode: "additiveDelta",
  compositionOrder: 0,
  keys: [
    { x: -1, y: -1, statePatch: [] },
    { x: 1, y: 1, statePatch: [] }
  ]
});

const createTestParameter = (parameterIdText: string): ParameterDto => ({
  parameterId: ParameterIdSchema.parse(parameterIdText),
  displayName: toDisplayName(parameterIdText),
  valueSource: "authoredInput",
  min: -1,
  max: 1,
  default: 0,
  recommendedUiStep: 0.01
});

const createTestRotation2dRigControl = (
  rigControlIdText: string
): Extract<RigControlDto, { readonly kind: "rotation2d" }> => ({
  kind: "rotation2d",
  rigControlId: RigControlIdSchema.parse(rigControlIdText),
  displayName: toDisplayName(rigControlIdText),
  partId: PartIdSchema.parse("part_root"),
  childDrawableIds: [],
  childRigControlIds: [],
  pivot: { x: 0, y: 0 },
  restAngleDegrees: 0,
  restTranslation: { x: 0, y: 0 },
  restScale: { x: 1, y: 1 },
  enabled: true
});

const createTestWarpLattice2dRigControl = (
  rigControlIdText: string
): Extract<RigControlDto, { readonly kind: "warpLattice2d" }> => ({
  kind: "warpLattice2d",
  rigControlId: RigControlIdSchema.parse(rigControlIdText),
  displayName: toDisplayName(rigControlIdText),
  partId: PartIdSchema.parse("part_root"),
  childDrawableIds: [],
  childRigControlIds: [],
  opacityMultiplier: 1,
  bindSpace: "rigControlLocalRest",
  domainBounds: { x: 0, y: 0, width: 10, height: 10 },
  latticeColumns: 2,
  latticeRows: 2,
  restControlPoints: [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 0, y: 10 },
    { x: 10, y: 10 }
  ],
  interpolationMethod: "bilinear-grid-v1",
  enabled: true
});

const toDisplayName = (parameterIdText: string): string =>
  parameterIdText
    .replace(/^param_/, "")
    .split("_")
    .map((token) => `${token[0]?.toUpperCase() ?? ""}${token.slice(1)}`)
    .join(" ");

const expectMutationErrorCode = (
  action: () => unknown,
  code: AuthoringMutationError["code"]
): void => {
  expect(action).toThrow(AuthoringMutationError);

  try {
    action();
  } catch (error) {
    expect(error).toBeInstanceOf(AuthoringMutationError);
    expect(error).toMatchObject({ code });
    return;
  }

  throw new Error(`Expected AuthoringMutationError with code ${code}.`);
};

const loadMinimalFixturePackageDocument = (): PackageDocumentDto => {
  const fixtureDirectory = join(
    dirname(fileURLToPath(import.meta.url)),
    "../../../fixtures/contracts/minimal-valid-package"
  );
  const parsed = parsePackageDocument({
    manifest: readJson(join(fixtureDirectory, "manifest.json")),
    model: {
      graph: readJson(join(fixtureDirectory, "model/graph.json")),
      drawables: readJson(join(fixtureDirectory, "model/drawables.json")),
      meshes: readJson(join(fixtureDirectory, "model/meshes.json")),
      parameters: readJson(join(fixtureDirectory, "model/parameters.json")),
      keyforms: readJson(join(fixtureDirectory, "model/keyforms.json")),
      rigControls: readJson(join(fixtureDirectory, "model/rig-controls.json")),
      dynamics: readJson(join(fixtureDirectory, "model/dynamics.json")),
      masks: readJson(join(fixtureDirectory, "model/masks.json")),
      drawOrder: readJson(join(fixtureDirectory, "model/draw-order.json"))
    },
    assets: {
      sourceManifest: readJson(join(fixtureDirectory, "assets/sources/source-manifest.json")),
      provenance: readJson(join(fixtureDirectory, "assets/provenance.json")),
      rights: readJson(join(fixtureDirectory, "assets/rights.json"))
    }
  });

  if (!parsed.success) {
    throw new Error(parsed.issues.map((issue) => issue.message).join("\n"));
  }

  return parsed.data;
};

const readJson = (path: string): unknown => JSON.parse(readFileSync(path, "utf8"));
