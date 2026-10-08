import {
  DrawableIdSchema,
  DynamicsGroupIdSchema,
  KeyformSetIdSchema,
  MaskRelationIdSchema,
  MeshIdSchema,
  PackageIdSchema,
  ParameterIdSchema,
  PartIdSchema,
  ProvenanceIdSchema,
  RigControlIdSchema,
  SourceAssetIdSchema,
  TextureIdSchema
} from "@private-2d-rigging-lab/contracts";
import {
  PackageDocumentSchema,
  type PackageDocumentDto
} from "@private-2d-rigging-lab/package-format";
import {
  evaluateViewerRuntimeSnapshot,
  type NormalizedRuntimeGraph
} from "@private-2d-rigging-lab/runtime-core";
import { describe, expect, it } from "vitest";

import { createCheckCatalog } from "./check-catalog.js";
import type { ValidationCheckResultDto } from "./validation-report.js";
import {
  buildTutorialMiniModelReadinessReport,
  validateTutorialMiniModelReadiness
} from "./validators/tutorial-readiness.js";

const CREATED_AT = "2026-06-01T00:00:00.000Z";
const PACKAGE_ID = PackageIdSchema.parse("pkg_tutorial_readiness");
const SOURCE_ASSET_ID = SourceAssetIdSchema.parse("src_tutorial_generated");
const SOURCE_PROVENANCE_ID = ProvenanceIdSchema.parse("prov_tutorial_source");
const PARAM_FACE_YAW = ParameterIdSchema.parse("param_faceYaw");
const PARAM_MOUTH_OPEN = ParameterIdSchema.parse("param_mouthOpen");
const PARAM_HAIR_SWAY = ParameterIdSchema.parse("param_hairSway");
const RIG_HEAD = RigControlIdSchema.parse("rig_headRotation");
const KEYFORM_HEAD_ANGLE = KeyformSetIdSchema.parse("keyset_head_angle");
const KEYFORM_MOUTH_OPACITY = KeyformSetIdSchema.parse("keyset_mouth_opacity");
const DYNAMICS_HAIR = DynamicsGroupIdSchema.parse("dyn_frontHairSway");
const MASK_EYE_MASK_TO_EYE = MaskRelationIdSchema.parse("maskrel_eyeMaskToEye");

const PART_SPECS = [
  {
    role: "body",
    partId: PartIdSchema.parse("part_body"),
    displayName: "Body"
  },
  {
    role: "head",
    partId: PartIdSchema.parse("part_head"),
    displayName: "Head"
  },
  {
    role: "face",
    partId: PartIdSchema.parse("part_face"),
    displayName: "Face"
  },
  {
    role: "front_hair",
    partId: PartIdSchema.parse("part_front_hair"),
    displayName: "Front Hair"
  },
  {
    role: "arm",
    partId: PartIdSchema.parse("part_arm"),
    displayName: "Arm"
  }
] as const;

const DRAWABLE_SPECS = [
  {
    role: "body",
    partId: PartIdSchema.parse("part_body"),
    drawableId: DrawableIdSchema.parse("draw_body"),
    meshId: MeshIdSchema.parse("mesh_body"),
    textureId: TextureIdSchema.parse("tex_body"),
    displayName: "Body"
  },
  {
    role: "head",
    partId: PartIdSchema.parse("part_head"),
    drawableId: DrawableIdSchema.parse("draw_head"),
    meshId: MeshIdSchema.parse("mesh_head"),
    textureId: TextureIdSchema.parse("tex_head"),
    displayName: "Head"
  },
  {
    role: "face",
    partId: PartIdSchema.parse("part_face"),
    drawableId: DrawableIdSchema.parse("draw_face"),
    meshId: MeshIdSchema.parse("mesh_face"),
    textureId: TextureIdSchema.parse("tex_face"),
    displayName: "Face"
  },
  {
    role: "mouth",
    partId: PartIdSchema.parse("part_face"),
    drawableId: DrawableIdSchema.parse("draw_mouth"),
    meshId: MeshIdSchema.parse("mesh_mouth"),
    textureId: TextureIdSchema.parse("tex_mouth"),
    displayName: "Mouth"
  },
  {
    role: "eye_mask",
    partId: PartIdSchema.parse("part_face"),
    drawableId: DrawableIdSchema.parse("draw_eye_mask"),
    meshId: MeshIdSchema.parse("mesh_eye_mask"),
    textureId: TextureIdSchema.parse("tex_eye_mask"),
    displayName: "Eye Mask"
  },
  {
    role: "eye",
    partId: PartIdSchema.parse("part_face"),
    drawableId: DrawableIdSchema.parse("draw_eye"),
    meshId: MeshIdSchema.parse("mesh_eye"),
    textureId: TextureIdSchema.parse("tex_eye"),
    displayName: "Eye"
  },
  {
    role: "front_hair",
    partId: PartIdSchema.parse("part_front_hair"),
    drawableId: DrawableIdSchema.parse("draw_front_hair"),
    meshId: MeshIdSchema.parse("mesh_front_hair"),
    textureId: TextureIdSchema.parse("tex_front_hair"),
    displayName: "Front Hair"
  },
  {
    role: "arm",
    partId: PartIdSchema.parse("part_arm"),
    drawableId: DrawableIdSchema.parse("draw_arm"),
    meshId: MeshIdSchema.parse("mesh_arm"),
    textureId: TextureIdSchema.parse("tex_arm"),
    displayName: "Arm"
  }
] as const;

describe("tutorial mini model readiness validator", () => {
  it("registers tutorial readiness checks in the catalog", () => {
    const catalog = createCheckCatalog();

    expect(catalog.has("tutorial.requiredPartMissing")).toBe(true);
    expect(catalog.has("tutorial.requiredMeshMissing")).toBe(true);
    expect(catalog.has("tutorial.requiredDrawableMissing")).toBe(true);
    expect(catalog.has("tutorial.requiredMaskOrOpacityMissing")).toBe(true);
    expect(catalog.has("tutorial.requiredRigControlMissing")).toBe(true);
    expect(catalog.has("tutorial.requiredKeyformMissing")).toBe(true);
    expect(catalog.has("tutorial.requiredDynamicsMissing")).toBe(true);
    expect(catalog.has("tutorial.viewerEvidenceMissing")).toBe(true);
    expect(catalog.has("tutorial.evidenceStale")).toBe(true);
    expect(catalog.has("tutorial.missingReference")).toBe(true);
    expect(catalog.has("tutorial.unsupportedClaim")).toBe(true);
  });

  it("passes a valid rights-clean synthetic tutorial mini model readiness report", () => {
    const packageDocument = createTutorialPackageDocument();
    const viewerResult = createTutorialViewerEvidence();

    const report = buildTutorialMiniModelReadinessReport({
      packageDocument,
      runtimeSnapshot: viewerResult.snapshot,
      viewerEvidence: viewerResult.evidence,
      createdAt: CREATED_AT,
      operationLogPresent: true,
      operationLogPath: "operations/log.jsonl"
    });

    expect(report.reportId).toBe("val_tutorial_readiness_tutorialReadiness");
    expect(report.profile).toBe("acceptance");
    expect(report.checks).toEqual([]);
    expect(report.summary.status).toBe("pass");
    expect(packageDocument.model.graph.parts.map((part) => part.partId)).toEqual([
      "part_body",
      "part_head",
      "part_face",
      "part_front_hair",
      "part_arm"
    ]);
    expect(packageDocument.model.graph.parts.find((part) => part.partId === "part_face")?.drawableIds).toEqual([
      "draw_face",
      "draw_mouth",
      "draw_eye_mask",
      "draw_eye"
    ]);
    expect(report.evidence).toMatchObject({
      operationLogPresent: true,
      operationLogPath: "operations/log.jsonl"
    });
    expect(report.evidence.runtimeSnapshotIds).toEqual([
      viewerResult.baselineSnapshot.snapshotId,
      viewerResult.snapshot.snapshotId
    ]);
  });

  it("emits deterministic diagnostics for each missing required tutorial slice", () => {
    expect(findDiagnostic(withoutPart("part_head"), "tutorial.requiredPartMissing")).toMatchObject({
      checkId: "tutorial.requiredPartMissing",
      status: "fail",
      severity: "error",
      targetPath: "/model/graph/parts",
      evidence: [
        "requiredPartRole=head",
        "availablePartIds=part_body,part_face,part_front_hair,part_arm",
        "partRoleMatch=missing"
      ]
    });

    expect(findDiagnostic(withoutDrawable("draw_mouth"), "tutorial.requiredDrawableMissing")).toMatchObject({
      checkId: "tutorial.requiredDrawableMissing",
      status: "fail",
      severity: "error",
      targetPath: "/model/drawables/drawables",
      evidence: [
        "requiredDrawableRole=mouth",
        "requiredPartRole=face",
        "expectedPartId=part_face",
        "availableDrawableIds=draw_body,draw_head,draw_face,draw_eye_mask,draw_eye,draw_front_hair,draw_arm",
        "drawableRoleMatch=missing"
      ]
    });

    expect(findDiagnostic(withoutDrawable("draw_eye"), "tutorial.requiredDrawableMissing")).toMatchObject({
      checkId: "tutorial.requiredDrawableMissing",
      status: "fail",
      severity: "error",
      targetPath: "/model/drawables/drawables",
      evidence: [
        "requiredDrawableRole=eye",
        "requiredPartRole=face",
        "expectedPartId=part_face",
        "availableDrawableIds=draw_body,draw_head,draw_face,draw_mouth,draw_eye_mask,draw_front_hair,draw_arm",
        "drawableRoleMatch=missing"
      ]
    });

    expect(findDiagnostic(withoutMeshes(), "tutorial.requiredMeshMissing")).toMatchObject({
      checkId: "tutorial.requiredMeshMissing",
      status: "fail",
      severity: "error",
      targetPath: "/model/drawables/drawables/0/meshId",
      evidence: [
        "drawableId=draw_body",
        "meshId=mesh_body",
        "meshMatch=missing",
        "availableMeshIds="
      ]
    });

    expect(findDiagnostic(withoutMaskOrOpacityEvidence(), "tutorial.requiredMaskOrOpacityMissing")).toMatchObject({
      checkId: "tutorial.requiredMaskOrOpacityMissing",
      status: "fail",
      severity: "error",
      targetPath: "/model/masks/masks",
      evidence: [
        "maskRelationCount=0",
        "enabledMaskRelationCount=0",
        "opacityKeyformCount=0",
        "nonDefaultOpacityDrawableCount=0"
      ]
    });

    expect(findDiagnostic(withoutRigControls(), "tutorial.requiredRigControlMissing")).toMatchObject({
      checkId: "tutorial.requiredRigControlMissing",
      status: "fail",
      severity: "error",
      targetPath: "/model/rigControls/rigControls",
      evidence: [
        "rigControlCount=0",
        "enabledRotation2dRigControlCount=0"
      ]
    });

    expect(findDiagnostic(withoutKeyforms(), "tutorial.requiredKeyformMissing")).toMatchObject({
      checkId: "tutorial.requiredKeyformMissing",
      status: "fail",
      severity: "error",
      targetPath: "/model/keyforms/keyformSets",
      evidence: [
        "keyformSetCount=0",
        `enabledRotation2dRigControlIds=${RIG_HEAD}`,
        "angleKeyformMatch=missing"
      ]
    });

    expect(findDiagnostic(withoutDynamics(), "tutorial.requiredDynamicsMissing")).toMatchObject({
      checkId: "tutorial.requiredDynamicsMissing",
      status: "fail",
      severity: "error",
      targetPath: "/model/dynamics/dynamicsGroups",
      evidence: [
        "dynamicsGroupCount=0",
        "enabledDynamicsGroupCount=0"
      ]
    });

    const viewerMissingChecks = validateTutorialMiniModelReadiness({
      packageDocument: createTutorialPackageDocument()
    });
    expect(viewerMissingChecks).toEqual([
      expect.objectContaining({
        checkId: "tutorial.viewerEvidenceMissing",
        status: "fail",
        severity: "error",
        targetPath: "/viewer/runtimeEvidence",
        evidence: [
          "viewerEvidence=missing",
          "runtimeSnapshot=missing"
        ]
      })
    ]);
  });

  it("reports stale runtime and viewer evidence deterministically", () => {
    const packageDocument = createTutorialPackageDocument();
    const stalePackageDocument = PackageDocumentSchema.parse({
      ...packageDocument,
      manifest: {
        ...packageDocument.manifest,
        packageRevision: packageDocument.manifest.packageRevision + 1
      }
    });
    const viewerResult = createTutorialViewerEvidence();

    const checks = validateTutorialMiniModelReadiness({
      packageDocument: stalePackageDocument,
      runtimeSnapshot: viewerResult.snapshot,
      viewerEvidence: viewerResult.evidence
    });

    expect(checks.filter((check) => check.checkId === "tutorial.evidenceStale")).toEqual([
      expect.objectContaining({
        checkId: "tutorial.evidenceStale",
        severity: "error",
        evidence: [
          `snapshotId=${viewerResult.snapshot.snapshotId}`,
          "packageRevision=2",
          "snapshotPackageRevision=1",
          "reason=runtime-snapshot-package-identity-mismatch"
        ]
      }),
      expect.objectContaining({
        checkId: "tutorial.evidenceStale",
        severity: "error",
        evidence: [
          `snapshotId=${viewerResult.snapshot.snapshotId}`,
          "packageRevision=2",
          "viewerEvidencePackageRevision=1",
          "snapshotPackageRevision=1",
          "reason=viewer-evidence-stale"
        ]
      })
    ]);
  });

  it("reports tutorial-specific missing keyform references", () => {
    const packageDocument = createTutorialPackageDocument();
    const invalidDocument = PackageDocumentSchema.parse({
      ...packageDocument,
      model: {
        ...packageDocument.model,
        keyforms: {
          ...packageDocument.model.keyforms,
          keyformSets: packageDocument.model.keyforms.keyformSets.map((keyformSet) => ({
            ...keyformSet,
            target: {
              ...keyformSet.target,
              id: "rig_missing"
            }
          }))
        }
      }
    });

    const checks = validateTutorialMiniModelReadiness({
      packageDocument: invalidDocument,
      ...createTutorialViewerEvidenceInput()
    });

    expect(checks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        checkId: "tutorial.missingReference",
        targetPath: "/model/keyforms/keyformSets/0/target/id",
        evidence: expect.arrayContaining([
          `keyformSetId=${KEYFORM_HEAD_ANGLE}`,
          "targetId=rig_missing",
          "rigControlMatch=missing"
        ])
      }),
      expect.objectContaining({
        checkId: "tutorial.requiredKeyformMissing",
        evidence: expect.arrayContaining(["angleKeyformMatch=missing"])
      })
    ]));
  });

  it("rejects unsupported real-asset, renderer, and Cubism claims while allowing truthful non-goal evidence", () => {
    const sourceClaimDocument = createTutorialPackageDocument();
    sourceClaimDocument.assets.sourceManifest.sourceAssets[0] = {
      ...sourceClaimDocument.assets.sourceManifest.sourceAssets[0]!,
      kind: "psd-source-v1",
      importProfile: "layered-character-psd-profile-v1"
    };

    const checks = validateTutorialMiniModelReadiness({
      packageDocument: PackageDocumentSchema.parse(sourceClaimDocument),
      ...createTutorialViewerEvidenceInput(),
      unsupportedClaims: [
        {
          claimId: "fullRenderer",
          status: "present",
          source: "fixture-metadata",
          evidence: ["rendererClaim=fullRenderer"]
        },
        {
          claimId: "cubismCompatibility",
          status: "required",
          source: "fixture-metadata",
          evidence: ["compatibilityClaim=Cubism"]
        },
        {
          claimId: "pixelOracle",
          status: "unsupported",
          source: "fixture-metadata",
          evidence: ["pixelOracle=false"]
        }
      ]
    });

    expect(checks.filter((check) => check.checkId === "tutorial.unsupportedClaim")).toEqual([
      expect.objectContaining({
        checkId: "tutorial.unsupportedClaim",
        status: "fail",
        severity: "blocking",
        targetPath: "/assets/sourceManifest/sourceAssets/0/kind",
        evidence: expect.arrayContaining([
          "claimId=realAssetImport",
          "claimStatus=present",
          "sourceKind=psd-source-v1",
          "expectedSourceKind=generated-fixture-v1"
        ])
      }),
      expect.objectContaining({
        checkId: "tutorial.unsupportedClaim",
        status: "fail",
        severity: "blocking",
        targetPath: "/tutorial/unsupportedClaims/1",
        evidence: [
          "claimId=cubismCompatibility",
          "claimStatus=required",
          "claimSource=fixture-metadata",
          "compatibilityClaim=Cubism"
        ]
      }),
      expect.objectContaining({
        checkId: "tutorial.unsupportedClaim",
        status: "fail",
        severity: "blocking",
        targetPath: "/tutorial/unsupportedClaims/0",
        evidence: [
          "claimId=fullRenderer",
          "claimStatus=present",
          "claimSource=fixture-metadata",
          "rendererClaim=fullRenderer"
        ]
      }),
      expect.objectContaining({
        checkId: "tutorial.unsupportedClaim",
        status: "not_applicable",
        severity: "info",
        targetPath: "/tutorial/unsupportedClaims/2",
        evidence: [
          "claimId=pixelOracle",
          "claimStatus=unsupported",
          "claimSource=fixture-metadata",
          "pixelOracle=false"
        ]
      })
    ]);
  });
});

const findDiagnostic = (packageDocument: PackageDocumentDto, checkId: string): ValidationCheckResultDto => {
  const check = validateTutorialMiniModelReadiness({
    packageDocument,
    ...createTutorialViewerEvidenceInput()
  }).find((candidate) => candidate.checkId === checkId);
  expect(check).toBeDefined();
  if (check === undefined) {
    throw new Error(`Expected ${checkId}`);
  }

  return check;
};

const createTutorialViewerEvidenceInput = () => {
  const viewerResult = createTutorialViewerEvidence();

  return {
    runtimeSnapshot: viewerResult.snapshot,
    viewerEvidence: viewerResult.evidence
  };
};

const createTutorialViewerEvidence = () =>
  evaluateViewerRuntimeSnapshot(createTutorialRuntimeGraph(), {
    frameIndex: 4,
    baselineFrameIndex: 3,
    deltaTimeMs: 16.6667,
    strictness: "strict",
    parameterOverrides: {
      [PARAM_FACE_YAW]: 1,
      [PARAM_MOUTH_OPEN]: 1
    },
    targetIds: [
      RIG_HEAD,
      DYNAMICS_HAIR,
      ...DRAWABLE_SPECS.map((drawable) => drawable.drawableId)
    ],
    options: {
      schemaVersion: "runtime-evaluation-options-v1",
      snapshotDetail: "full"
    }
  });

const withoutPart = (partId: string): PackageDocumentDto => {
  const document = clonePackageDocument(createTutorialPackageDocument());

  return PackageDocumentSchema.parse({
    ...document,
    model: {
      ...document.model,
      graph: {
        ...document.model.graph,
        parts: document.model.graph.parts.filter((part) => part.partId !== partId)
      }
    }
  });
};

const withoutMeshes = (): PackageDocumentDto => {
  const document = clonePackageDocument(createTutorialPackageDocument());
  return PackageDocumentSchema.parse({
    ...document,
    model: {
      ...document.model,
      meshes: {
        ...document.model.meshes,
        meshes: []
      }
    }
  });
};

const withoutDrawable = (drawableId: string): PackageDocumentDto => {
  const document = clonePackageDocument(createTutorialPackageDocument());
  return PackageDocumentSchema.parse({
    ...document,
    model: {
      ...document.model,
      graph: {
        ...document.model.graph,
        parts: document.model.graph.parts.map((part) => ({
          ...part,
          drawableIds: part.drawableIds.filter((candidate) => candidate !== drawableId)
        }))
      },
      drawables: {
        ...document.model.drawables,
        drawables: document.model.drawables.drawables.filter((drawable) => drawable.drawableId !== drawableId)
      },
      drawOrder: {
        ...document.model.drawOrder,
        entries: document.model.drawOrder.entries.filter((entry) => entry.drawableId !== drawableId)
      }
    }
  });
};

const withoutMaskOrOpacityEvidence = (): PackageDocumentDto => {
  const document = clonePackageDocument(createTutorialPackageDocument());
  return PackageDocumentSchema.parse({
    ...document,
    model: {
      ...document.model,
      keyforms: {
        ...document.model.keyforms,
        keyformSets: document.model.keyforms.keyformSets.filter(
          (keyformSet) => keyformSet.target.kind !== "drawable" || keyformSet.target.property !== "opacity"
        )
      },
      masks: {
        ...document.model.masks,
        masks: []
      }
    }
  });
};

const withoutRigControls = (): PackageDocumentDto => {
  const document = clonePackageDocument(createTutorialPackageDocument());
  return PackageDocumentSchema.parse({
    ...document,
    model: {
      ...document.model,
      rigControls: {
        ...document.model.rigControls,
        rigControls: []
      }
    }
  });
};

const withoutKeyforms = (): PackageDocumentDto => {
  const document = clonePackageDocument(createTutorialPackageDocument());
  return PackageDocumentSchema.parse({
    ...document,
    model: {
      ...document.model,
      keyforms: {
        ...document.model.keyforms,
        keyformSets: []
      }
    }
  });
};

const withoutDynamics = (): PackageDocumentDto => {
  const document = clonePackageDocument(createTutorialPackageDocument());
  return PackageDocumentSchema.parse({
    ...document,
    model: {
      ...document.model,
      dynamics: {
        ...document.model.dynamics,
        dynamicsGroups: []
      }
    }
  });
};

const createTutorialPackageDocument = (): PackageDocumentDto => PackageDocumentSchema.parse({
  manifest: {
    schemaVersion: "open-model-package-manifest-v1",
    packageId: PACKAGE_ID,
    packageDisplayName: "Tutorial Readiness",
    formatVersion: "open-model-package-v1",
    packageRevision: 1,
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
    schemaVersions: {},
    evaluatorVersions: {},
    modelFiles: {
      graph: "model/graph.json",
      drawables: "model/drawables.json",
      meshes: "model/meshes.json",
      parameters: "model/parameters.json",
      keyforms: "model/keyforms.json",
      rigControls: "model/rig-controls.json",
      dynamics: "model/dynamics.json",
      masks: "model/masks.json",
      drawOrder: "model/draw-order.json",
      editorState: "model/editor-state.json"
    },
    assetIndex: "assets/sources/source-manifest.json",
    operationLog: "operations/log.jsonl",
    rightsSummary: {
      status: "cleared"
    },
    provenanceSummary: {
      sourceAssetCount: 1
    },
    packageStableOrderVersion: "stable-order-v1"
  },
  model: {
    graph: {
      schemaVersion: "model-graph-v1",
      coordinateSystem: "canvas-y-down-v1",
      canvasSize: {
        width: 512,
        height: 512
      },
      parts: createModelParts(),
      rigControlRootIds: [RIG_HEAD],
      stableOrder: [
        ...PART_SPECS.map((part) => part.partId),
        ...DRAWABLE_SPECS.map((drawable) => drawable.drawableId),
        RIG_HEAD,
        DYNAMICS_HAIR
      ]
    },
    drawables: {
      schemaVersion: "drawables-file-v1",
      drawables: DRAWABLE_SPECS.map((drawable, index) => ({
        drawableId: drawable.drawableId,
        displayName: drawable.displayName,
        partId: drawable.partId,
        sourceAssetId: SOURCE_ASSET_ID,
        textureId: drawable.textureId,
        meshId: drawable.meshId,
        defaultOpacity: 1,
        runtimeVisibility: true,
        baseDrawOrder: index,
        sourceProvenanceId: SOURCE_PROVENANCE_ID
      }))
    },
    meshes: {
      schemaVersion: "meshes-file-v1",
      meshes: DRAWABLE_SPECS.map((drawable, index) => createMesh(drawable.meshId, drawable.drawableId, index))
    },
    parameters: {
      schemaVersion: "parameters-file-v1",
      parameters: [
        {
          parameterId: PARAM_FACE_YAW,
          displayName: "Face Yaw",
          semanticRole: "face",
          valueSource: "authoredInput",
          min: -1,
          max: 1,
          default: 0,
          recommendedUiStep: 0.1
        },
        {
          parameterId: PARAM_MOUTH_OPEN,
          displayName: "Mouth Open",
          semanticRole: "mouth",
          valueSource: "authoredInput",
          min: 0,
          max: 1,
          default: 0,
          recommendedUiStep: 0.1
        },
        {
          parameterId: PARAM_HAIR_SWAY,
          displayName: "Hair Sway",
          semanticRole: "dynamics",
          valueSource: "computedDynamics",
          min: -1,
          max: 1,
          default: 0,
          recommendedUiStep: 0.1
        }
      ]
    },
    keyforms: {
      schemaVersion: "keyforms-file-v1",
      keyformSets: [
        {
          keyformSetId: KEYFORM_HEAD_ANGLE,
          target: {
            kind: "rigControl",
            id: RIG_HEAD,
            property: "angleDegrees"
          },
          parameterId: PARAM_FACE_YAW,
          evaluator: "linear-1d-v1",
          interpolation: "linear-1d-v1",
          compositionMode: "replace",
          compositionOrder: 0,
          keys: [
            {
              value: -1,
              statePatch: -12
            },
            {
              value: 0,
              statePatch: 0
            },
            {
              value: 1,
              statePatch: 12
            }
          ]
        },
        {
          keyformSetId: KEYFORM_MOUTH_OPACITY,
          target: {
            kind: "drawable",
            id: DrawableIdSchema.parse("draw_mouth"),
            property: "opacity"
          },
          parameterId: PARAM_MOUTH_OPEN,
          evaluator: "linear-1d-v1",
          interpolation: "linear-1d-v1",
          compositionMode: "replace",
          compositionOrder: 1,
          keys: [
            {
              value: 0,
              statePatch: 0.45
            },
            {
              value: 1,
              statePatch: 1
            }
          ]
        }
      ]
    },
    rigControls: {
      schemaVersion: "rig-controls-file-v1",
      rigControls: [
        {
          kind: "rotation2d",
          rigControlId: RIG_HEAD,
          displayName: "Head rotation",
          partId: PartIdSchema.parse("part_head"),
          childDrawableIds: [
            DrawableIdSchema.parse("draw_head"),
            DrawableIdSchema.parse("draw_face"),
            DrawableIdSchema.parse("draw_mouth"),
            DrawableIdSchema.parse("draw_eye_mask"),
            DrawableIdSchema.parse("draw_eye"),
            DrawableIdSchema.parse("draw_front_hair")
          ],
          childRigControlIds: [],
          pivot: {
            x: 128,
            y: 96
          },
          restAngleDegrees: 0,
          restTranslation: {
            x: 0,
            y: 0
          },
          restScale: {
            x: 1,
            y: 1
          },
          enabled: true
        }
      ]
    },
    dynamics: {
      schemaVersion: "dynamics-file-v3",
      dynamicsGroups: [
        {
          dynamicsGroupId: DYNAMICS_HAIR,
          displayName: "Front hair sway",
          enabled: true,
          inputs: [
            {
              parameterId: PARAM_FACE_YAW,
              kind: "angle",
              scale: 30
            }
          ],
          chain: {
            rootOffset: { x: 0, y: 0 },
            segmentLengths: [14],
            damping: 2.5,
            gravityScale: 1
          },
          outputs: [
            {
              parameterId: PARAM_HAIR_SWAY,
              segmentIndex: 1,
              scale: 0.0333,
              limit: 1
            }
          ]
        }
      ]
    },
    masks: {
      schemaVersion: "masks-file-v1",
      masks: [
        {
          maskRelationId: MASK_EYE_MASK_TO_EYE,
          maskDrawableIds: [DrawableIdSchema.parse("draw_eye_mask")],
          targetDrawableIds: [DrawableIdSchema.parse("draw_eye")],
          maskGroupHint: "eye-mask-to-eye",
          enabled: true
        }
      ]
    },
    drawOrder: {
      schemaVersion: "draw-order-file-v1",
      entries: DRAWABLE_SPECS.map((drawable, index) => ({
        drawableId: drawable.drawableId,
        baseDrawOrder: index,
        stableOrder: index
      }))
    },
    editorState: {
      schemaVersion: "editor-state-v1",
      selection: [DrawableIdSchema.parse("draw_face")],
      lockedIds: [],
      editorHiddenIds: [],
      activeTool: "meshEdit",
      canvas: {
        zoom: 1,
        pan: {
          x: 0,
          y: 0
        }
      }
    }
  },
  assets: {
    sourceManifest: {
      schemaVersion: "source-manifest-v1",
      sourceAssets: [
        {
          sourceAssetId: SOURCE_ASSET_ID,
          kind: "generated-fixture-v1",
          filePath: "assets/sources/tutorial-generated.json",
          contentHash: "sha256:tutorial-generated-source",
          importProfile: "split-png-fallback-v1",
          layers: DRAWABLE_SPECS.map((drawable) => ({
            sourceLayerId: `layer_${drawable.role}`,
            sourceAssetId: SOURCE_ASSET_ID,
            originalName: drawable.displayName,
            normalizedName: drawable.role,
            groupPath: ["Tutorial"],
            bounds: {
              x: 0,
              y: 0,
              width: 64,
              height: 64
            },
            visibleInSource: true,
            opacityInSource: 1,
            role: "editableLayer",
            unsupportedFeatures: [],
            mappedDrawableIds: [drawable.drawableId]
          })),
          diagnostics: []
        }
      ]
    },
    textureAtlas: {
      schemaVersion: "texture-atlas-v1",
      textures: DRAWABLE_SPECS.map((drawable) => ({
        textureId: drawable.textureId,
        filePath: `assets/textures/${drawable.role}.png`,
        contentHash: `sha256:texture-${drawable.role}`,
        sourceAssetId: SOURCE_ASSET_ID,
        sourceLayerId: `layer_${drawable.role}`,
        provenanceId: SOURCE_PROVENANCE_ID
      })),
      previewAssets: DRAWABLE_SPECS.map((drawable) => ({
        previewAssetId: `preview_${drawable.role}`,
        textureId: drawable.textureId,
        reference: {
          referenceKind: "deterministic-data-url-v1",
          dataUrl: "data:image/png;base64,AA=="
        },
        contentHash: `sha256:preview-${drawable.role}`,
        sourceAssetId: SOURCE_ASSET_ID,
        sourceLayerId: `layer_${drawable.role}`,
        provenanceId: ProvenanceIdSchema.parse(`prov_preview_${drawable.role}`),
        rightsAssetId: `asset_preview_${drawable.role}`
      }))
    },
    provenance: {
      schemaVersion: "provenance-file-v1",
      records: [
        {
          provenanceId: SOURCE_PROVENANCE_ID,
          assetId: SOURCE_ASSET_ID,
          assetKind: "generatedFixture",
          filePath: "assets/sources/tutorial-generated.json",
          contentHash: "sha256:tutorial-generated-source",
          creator: "validator-test",
          license: "internal-test",
          redistributionAllowed: false,
          aiUsed: false,
          transformHistory: ["tutorialMiniModelV0:synthetic"],
          relatedOperationIds: []
        },
        ...DRAWABLE_SPECS.map((drawable) => ({
          provenanceId: ProvenanceIdSchema.parse(`prov_preview_${drawable.role}`),
          assetId: `asset_preview_${drawable.role}`,
          assetKind: "thumbnail",
          filePath: `assets/thumbnails/${drawable.role}.png`,
          contentHash: `sha256:preview-${drawable.role}`,
          creator: "validator-test",
          license: "internal-test",
          redistributionAllowed: false,
          aiUsed: false,
          transformHistory: ["deterministicPreview:dataUrl"],
          relatedOperationIds: []
        }))
      ]
    },
    rights: {
      schemaVersion: "rights-file-v1",
      records: [
        {
          assetId: SOURCE_ASSET_ID,
          rightsStatus: "cleared",
          license: "internal-test",
          redistributionAllowed: false
        },
        ...DRAWABLE_SPECS.map((drawable) => ({
          assetId: `asset_preview_${drawable.role}`,
          rightsStatus: "cleared",
          license: "internal-test",
          redistributionAllowed: false
        }))
      ]
    }
  }
});

const createTutorialRuntimeGraph = (): NormalizedRuntimeGraph => ({
  packageId: PACKAGE_ID,
  packageRevision: 1,
  coordinateSystem: "canvas-y-down-v1",
  parameters: new Map([
    [
      PARAM_FACE_YAW,
      {
        id: PARAM_FACE_YAW,
        displayName: "Face Yaw",
        semanticRole: "face",
        valueSource: "authoredInput",
        min: -1,
        max: 1,
        default: 0
      }
    ],
    [
      PARAM_MOUTH_OPEN,
      {
        id: PARAM_MOUTH_OPEN,
        displayName: "Mouth Open",
        semanticRole: "mouth",
        valueSource: "authoredInput",
        min: 0,
        max: 1,
        default: 0
      }
    ],
    [
      PARAM_HAIR_SWAY,
      {
        id: PARAM_HAIR_SWAY,
        displayName: "Hair Sway",
        semanticRole: "dynamics",
        valueSource: "computedDynamics",
        min: -1,
        max: 1,
        default: 0
      }
    ]
  ]),
  parts: new Map(createModelParts().map((part) => [part.partId, part])),
  dynamicsGroups: new Map([
    [
      DYNAMICS_HAIR,
      {
        dynamicsGroupId: DYNAMICS_HAIR,
        displayName: "Front hair sway",
        enabled: true,
        inputs: [
          {
            parameterId: PARAM_FACE_YAW,
            kind: "angle",
            scale: 30
          }
        ],
        chain: {
          rootOffset: { x: 0, y: 0 },
          segmentLengths: [14],
          damping: 2.5,
          gravityScale: 1
        },
        outputs: [
          {
            parameterId: PARAM_HAIR_SWAY,
            segmentIndex: 1,
            scale: 0.0333,
            limit: 1
          }
        ]
      }
    ]
  ]),
  drawables: new Map(
    DRAWABLE_SPECS.map((drawable, index) => [
      drawable.drawableId,
      {
        drawableId: drawable.drawableId,
        meshId: drawable.meshId,
        partId: drawable.partId,
        texture: {
          status: "resolved",
          textureId: drawable.textureId,
          sourceAssetId: SOURCE_ASSET_ID,
          sourceLayerId: `layer_${drawable.role}`,
          projection: {
            kind: "uv",
            uvs: createMeshUvs()
          }
        },
        visible: true,
        opacity: 1,
        baseDrawOrder: index,
        bounds: createMeshBounds(index),
        vertices: createMeshVertices(index),
        uvs: createMeshUvs(),
        triangles: [[0, 1, 2], [1, 3, 2]],
        vertexStableIds: createVertexStableIds(drawable.meshId),
        vertexCount: 4
      }
    ])
  ),
  rigControls: new Map([
    [
      RIG_HEAD,
      {
        kind: "rotation2d",
        rigControlId: RIG_HEAD,
        childDrawableIds: [
          DrawableIdSchema.parse("draw_head"),
          DrawableIdSchema.parse("draw_face"),
          DrawableIdSchema.parse("draw_mouth"),
          DrawableIdSchema.parse("draw_eye_mask"),
          DrawableIdSchema.parse("draw_eye"),
          DrawableIdSchema.parse("draw_front_hair")
        ],
        childRigControlIds: [],
        pivot: {
          x: 128,
          y: 96
        },
        restAngleDegrees: 0,
        restTranslation: {
          x: 0,
          y: 0
        },
        restScale: {
          x: 1,
          y: 1
        },
        enabled: true
      }
    ]
  ]),
  keyformBindings: [
    {
      evaluator: "linear-1d-v1",
      keyformSetId: KEYFORM_HEAD_ANGLE,
      targetId: RIG_HEAD,
      targetKind: "rigControl",
      targetProperty: "angleDegrees",
      parameterId: PARAM_FACE_YAW,
      keys: [
        {
          value: -1,
          statePatch: -12
        },
        {
          value: 0,
          statePatch: 0
        },
        {
          value: 1,
          statePatch: 12
        }
      ],
      compositionMode: "replace",
      compositionOrder: 0
    },
    {
      evaluator: "linear-1d-v1",
      keyformSetId: KEYFORM_MOUTH_OPACITY,
      targetId: DrawableIdSchema.parse("draw_mouth"),
      targetKind: "drawable",
      targetProperty: "opacity",
      parameterId: PARAM_MOUTH_OPEN,
      keys: [
        {
          value: 0,
          statePatch: 0.45
        },
        {
          value: 1,
          statePatch: 1
        }
      ],
      compositionMode: "replace",
      compositionOrder: 1
    }
  ],
  masks: [
    {
      maskRelationId: MASK_EYE_MASK_TO_EYE,
      sourceDrawableIds: [DrawableIdSchema.parse("draw_eye_mask")],
      targetDrawableIds: [DrawableIdSchema.parse("draw_eye")]
    }
  ],
  drawOrder: DRAWABLE_SPECS.map((drawable, index) => ({
    drawableId: drawable.drawableId,
    drawOrder: index
  })),
  disabledFutureLayers: []
});

const createModelParts = () => [
  {
    partId: PartIdSchema.parse("part_body"),
    displayName: "Body",
    childPartIds: [
      PartIdSchema.parse("part_head"),
      PartIdSchema.parse("part_arm")
    ],
    drawableIds: [DrawableIdSchema.parse("draw_body")]
  },
  {
    partId: PartIdSchema.parse("part_head"),
    displayName: "Head",
    parentPartId: PartIdSchema.parse("part_body"),
    childPartIds: [
      PartIdSchema.parse("part_face"),
      PartIdSchema.parse("part_front_hair")
    ],
    drawableIds: [DrawableIdSchema.parse("draw_head")]
  },
  {
    partId: PartIdSchema.parse("part_face"),
    displayName: "Face",
    parentPartId: PartIdSchema.parse("part_head"),
    childPartIds: [],
    drawableIds: [
      DrawableIdSchema.parse("draw_face"),
      DrawableIdSchema.parse("draw_mouth"),
      DrawableIdSchema.parse("draw_eye_mask"),
      DrawableIdSchema.parse("draw_eye")
    ]
  },
  {
    partId: PartIdSchema.parse("part_front_hair"),
    displayName: "Front Hair",
    parentPartId: PartIdSchema.parse("part_head"),
    childPartIds: [],
    drawableIds: [DrawableIdSchema.parse("draw_front_hair")]
  },
  {
    partId: PartIdSchema.parse("part_arm"),
    displayName: "Arm",
    parentPartId: PartIdSchema.parse("part_body"),
    childPartIds: [],
    drawableIds: [DrawableIdSchema.parse("draw_arm")]
  }
];

const createMesh = (meshId: string, drawableId: string, index: number) => ({
  meshId: MeshIdSchema.parse(meshId),
  drawableId: DrawableIdSchema.parse(drawableId),
  vertices: createMeshVertices(index),
  uvs: createMeshUvs(),
  triangles: [[0, 1, 2], [1, 3, 2]],
  vertexStableIds: createVertexStableIds(meshId),
  bounds: createMeshBounds(index),
  generationProvenanceId: SOURCE_PROVENANCE_ID
});

const createMeshVertices = (index: number) => {
  const offset = index * 8;

  return [
    { x: offset, y: 0 },
    { x: offset + 6, y: 0 },
    { x: offset, y: 6 },
    { x: offset + 6, y: 6 }
  ];
};

const createMeshUvs = () => [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: 1, y: 1 }
];

const createMeshBounds = (index: number) => ({
  x: index * 8,
  y: 0,
  width: 6,
  height: 6
});

const createVertexStableIds = (meshId: string) => [
  `${meshId}_v0`,
  `${meshId}_v1`,
  `${meshId}_v2`,
  `${meshId}_v3`
];

const clonePackageDocument = (document: PackageDocumentDto): PackageDocumentDto =>
  JSON.parse(JSON.stringify(document)) as PackageDocumentDto;
