import type {
  RuntimeSnapshotId,
  TargetRefDto,
  ValidationReportId
} from "@private-2d-rigging-lab/contracts";
import { ValidationReportIdSchema } from "@private-2d-rigging-lab/contracts";
import type {
  PackageDocumentDto,
  SourceAssetDto,
  TextureAtlasEntryDto
} from "@private-2d-rigging-lab/package-format";
import {
  ViewerRuntimeEvaluationEvidenceSchema,
  type RuntimeSnapshotDto
} from "@private-2d-rigging-lab/runtime-core";

import { buildValidationReport } from "../report-builder.js";
import type { ValidationCheckResultDto, ValidationReportDto } from "../validation-report.js";
import { ValidationCheckResultSchema } from "../validation-report.js";
import { validatePackageRuntime } from "./package-runtime.js";

export const DEFAULT_TUTORIAL_REQUIRED_PART_ROLES = [
  "body",
  "head",
  "face",
  "front_hair",
  "arm"
] as const;

export const DEFAULT_TUTORIAL_REQUIRED_DRAWABLE_ROLES = [
  "mouth",
  "eye"
] as const;

export const TUTORIAL_UNSUPPORTED_CLAIM_KINDS = [
  "realAssetImport",
  "imageDecode",
  "filePicker",
  "archiveImportExport",
  "fullRenderer",
  "pixelOracle",
  "publicTutorialDistribution",
  "cubismCompatibility"
] as const;

export type TutorialRequiredPartRole = typeof DEFAULT_TUTORIAL_REQUIRED_PART_ROLES[number];
export type TutorialRequiredDrawableRole = typeof DEFAULT_TUTORIAL_REQUIRED_DRAWABLE_ROLES[number];
export type TutorialUnsupportedClaimKind = typeof TUTORIAL_UNSUPPORTED_CLAIM_KINDS[number];
export type TutorialUnsupportedClaimStatus = "notClaimed" | "unsupported" | "present" | "required";

export interface TutorialUnsupportedClaimInput {
  readonly claimId: TutorialUnsupportedClaimKind | string;
  readonly status: TutorialUnsupportedClaimStatus;
  readonly source?: string;
  readonly evidence?: readonly string[];
}

export interface TutorialMiniModelReadinessInput {
  readonly packageDocument: PackageDocumentDto;
  readonly runtimeSnapshot?: RuntimeSnapshotDto;
  readonly viewerEvidence?: unknown;
  readonly requiredPartRoles?: readonly string[];
  readonly requiredDrawableRoles?: readonly string[];
  readonly unsupportedClaims?: readonly TutorialUnsupportedClaimInput[];
}

export interface TutorialMiniModelReadinessReportInput extends TutorialMiniModelReadinessInput {
  readonly reportId?: ValidationReportId | string;
  readonly createdAt?: string;
  readonly operationLogPresent?: boolean;
  readonly operationLogPath?: string;
}

const TUTORIAL_RELATED_AC = ["AC-MVP-004", "AC-MVP-005", "AC-MVP-007", "AC-MVP-009", "AC-MVP-010", "AC-MVP-012", "AC-MVP-013", "AC-MVP-016"];
const TUTORIAL_RELATED_SCENARIOS = ["SC-MVP-003", "SC-MVP-004", "SC-MVP-006"];

export const validateTutorialMiniModelReadiness = (
  input: TutorialMiniModelReadinessInput
): readonly ValidationCheckResultDto[] => [
  ...validateRequiredParts(input),
  ...validateRequiredLayerDrawables(input),
  ...validateGeneratedSyntheticSourceBoundary(input.packageDocument),
  ...validateRequiredMeshPresence(input.packageDocument),
  ...validateMaskOrOpacityPresence(input.packageDocument),
  ...validateRigControlPresence(input.packageDocument),
  ...validateRigControlKeyformPresence(input.packageDocument),
  ...validateDynamicsPresence(input.packageDocument),
  ...validateRuntimeEvidenceFreshness(input),
  ...validateViewerEvidence(input),
  ...validateUnsupportedClaims(input)
];

export const buildTutorialMiniModelReadinessReport = (
  input: TutorialMiniModelReadinessReportInput
): ValidationReportDto => {
  const packageRuntimeReport = validatePackageRuntime({
    packageDocument: input.packageDocument,
    ...(input.runtimeSnapshot === undefined ? {} : { runtimeSnapshot: input.runtimeSnapshot }),
    ...(input.viewerEvidence === undefined ? {} : { viewerEvidence: input.viewerEvidence }),
    requireViewerEvidence: true,
    profile: "acceptance",
    ...(input.createdAt === undefined ? {} : { createdAt: input.createdAt })
  });
  const tutorialChecks = validateTutorialMiniModelReadiness(input);
  const operationLogPath = input.operationLogPath ?? packageRuntimeReport.evidence.operationLogPath;

  return buildValidationReport({
    reportId: input.reportId ?? createTutorialReadinessReportId(input.packageDocument),
    ...(input.createdAt === undefined ? {} : { createdAt: input.createdAt }),
    packageId: input.packageDocument.manifest.packageId,
    packageRevision: input.packageDocument.manifest.packageRevision,
    profile: "acceptance",
    relatedScenarios: TUTORIAL_RELATED_SCENARIOS,
    checks: [
      ...packageRuntimeReport.checks,
      ...tutorialChecks
    ],
    evidence: {
      operationLogPresent: input.operationLogPresent ?? packageRuntimeReport.evidence.operationLogPresent,
      ...(operationLogPath === undefined ? {} : { operationLogPath }),
      runtimeSnapshotIds: [...packageRuntimeReport.evidence.runtimeSnapshotIds],
      supplementalGuiEvidenceRefs: [...packageRuntimeReport.evidence.supplementalGuiEvidenceRefs]
    }
  });
};

const validateRequiredParts = (
  input: TutorialMiniModelReadinessInput
): readonly ValidationCheckResultDto[] => {
  const roles = input.requiredPartRoles ?? DEFAULT_TUTORIAL_REQUIRED_PART_ROLES;
  const parts = input.packageDocument.model.graph.parts;

  return roles.flatMap((role) => {
    const matchingPart = parts.find((part) => partMatchesRole(part.partId, part.displayName, role));
    if (matchingPart !== undefined) {
      return [];
    }

    return [
      createTutorialCheck({
        checkId: "tutorial.requiredPartMissing",
        severity: "error",
        target: {
          kind: "package",
          id: input.packageDocument.manifest.packageId,
          path: "/model/graph/parts"
        },
        targetPath: "/model/graph/parts",
        message: `Tutorial mini model is missing required part role ${role}.`,
        evidence: [
          `requiredPartRole=${role}`,
          `availablePartIds=${parts.map((part) => part.partId).join(",")}`,
          "partRoleMatch=missing"
        ],
        impact: "The tutorial mini model cannot prove the planned body/head/face/front_hair/arm topology without this part role."
      })
    ];
  });
};

const validateRequiredLayerDrawables = (
  input: TutorialMiniModelReadinessInput
): readonly ValidationCheckResultDto[] => {
  const roles = input.requiredDrawableRoles ?? DEFAULT_TUTORIAL_REQUIRED_DRAWABLE_ROLES;
  const { packageDocument } = input;
  const facePart = packageDocument.model.graph.parts.find((part) =>
    partMatchesRole(part.partId, part.displayName, "face")
  );

  return roles.flatMap((role) => {
    const matchingDrawables = packageDocument.model.drawables.drawables.filter((drawable) =>
      drawableMatchesRole(drawable, packageDocument, role)
    );
    const matchingDrawableOnFace = matchingDrawables.find((drawable) =>
      facePart === undefined || drawable.partId === facePart.partId
    );

    if (matchingDrawableOnFace !== undefined) {
      return [];
    }

    if (matchingDrawables.length > 0) {
      const drawable = matchingDrawables[0]!;
      const drawableIndex = packageDocument.model.drawables.drawables.findIndex(
        (candidate) => candidate.drawableId === drawable.drawableId
      );

      return [
        createTutorialCheck({
          checkId: "tutorial.requiredDrawableMissing",
          severity: "error",
          target: {
            kind: "drawable",
            id: drawable.drawableId,
            path: `/model/drawables/drawables/${drawableIndex}/partId`
          },
          targetPath: `/model/drawables/drawables/${drawableIndex}/partId`,
          message: `Tutorial ${role} drawable is not assigned to the face part.`,
          evidence: [
            `requiredDrawableRole=${role}`,
            `drawableId=${drawable.drawableId}`,
            `drawablePartId=${drawable.partId}`,
            `expectedPartId=${facePart?.partId ?? "missing"}`,
            "drawablePartMatch=mismatch"
          ],
          impact: "The tutorial face slice requires mouth and eye layer drawables assigned to the face part, not separate mouth/eye parts."
        })
      ];
    }

    return [
      createTutorialCheck({
        checkId: "tutorial.requiredDrawableMissing",
        severity: "error",
        target: {
          kind: "package",
          id: packageDocument.manifest.packageId,
          path: "/model/drawables/drawables"
        },
        targetPath: "/model/drawables/drawables",
        message: `Tutorial mini model is missing required ${role} drawable/layer evidence.`,
        evidence: [
          `requiredDrawableRole=${role}`,
          "requiredPartRole=face",
          `expectedPartId=${facePart?.partId ?? "missing"}`,
          `availableDrawableIds=${formatIdList(packageDocument.model.drawables.drawables.map((drawable) => drawable.drawableId))}`,
          "drawableRoleMatch=missing"
        ],
        impact: "The tutorial face slice requires mouth and eye as drawables/layers under the face part."
      })
    ];
  });
};

const validateGeneratedSyntheticSourceBoundary = (
  packageDocument: PackageDocumentDto
): readonly ValidationCheckResultDto[] => {
  const checks: ValidationCheckResultDto[] = [];

  packageDocument.assets.sourceManifest.sourceAssets.forEach((sourceAsset, sourceAssetIndex) => {
    if (sourceAsset.kind !== "generated-fixture-v1") {
      checks.push(createUnsupportedSourceAssetCheck(packageDocument, sourceAsset, sourceAssetIndex));
    }

    if (sourceAsset.binaryAssetRef !== undefined) {
      checks.push(createUnsupportedSourceBinaryCheck(packageDocument, sourceAsset, sourceAssetIndex));
    }
  });

  packageDocument.assets.textureAtlas?.textures.forEach((textureEntry, textureIndex) => {
    if (textureEntry.binaryAssetRef !== undefined) {
      checks.push(createUnsupportedTextureBinaryCheck(packageDocument, textureEntry, textureIndex));
    }
  });

  return checks;
};

const validateRequiredMeshPresence = (
  packageDocument: PackageDocumentDto
): readonly ValidationCheckResultDto[] => {
  const meshIds = new Set(packageDocument.model.meshes.meshes.map((mesh) => mesh.meshId));
  const visibleDrawables = packageDocument.model.drawables.drawables.filter((drawable) => drawable.runtimeVisibility);

  if (visibleDrawables.length === 0) {
    return [
      createTutorialCheck({
        checkId: "tutorial.requiredMeshMissing",
        severity: "error",
        target: {
          kind: "package",
          id: packageDocument.manifest.packageId,
          path: "/model/drawables/drawables"
        },
        targetPath: "/model/drawables/drawables",
        message: "Tutorial mini model has no runtime-visible drawable for generated mesh evidence.",
        evidence: [
          "runtimeVisibleDrawableCount=0",
          `meshCount=${packageDocument.model.meshes.meshes.length}`,
          "reason=runtime-visible-drawable-missing"
        ],
        impact: "The tutorial mesh slice requires at least one runtime-visible drawable with a generated mesh."
      })
    ];
  }

  return visibleDrawables.flatMap((drawable) => {
    if (meshIds.has(drawable.meshId)) {
      return [];
    }

    const drawableIndex = packageDocument.model.drawables.drawables.findIndex(
      (candidate) => candidate.drawableId === drawable.drawableId
    );
    const targetPath = `/model/drawables/drawables/${drawableIndex}/meshId`;

    return [
      createTutorialCheck({
        checkId: "tutorial.requiredMeshMissing",
        severity: "error",
        target: {
          kind: "mesh",
          id: drawable.meshId,
          path: targetPath
        },
        targetPath,
        message: `Tutorial drawable ${drawable.drawableId} references missing generated mesh ${drawable.meshId}.`,
        evidence: [
          `drawableId=${drawable.drawableId}`,
          `meshId=${drawable.meshId}`,
          "meshMatch=missing",
          `availableMeshIds=${[...meshIds].join(",")}`
        ],
        impact: "The tutorial mesh slice cannot be validated while a runtime-visible drawable lacks generated mesh data."
      })
    ];
  });
};

const validateMaskOrOpacityPresence = (
  packageDocument: PackageDocumentDto
): readonly ValidationCheckResultDto[] => {
  const enabledMask = packageDocument.model.masks.masks.find((maskRelation) => maskRelation.enabled);
  const opacityKeyform = packageDocument.model.keyforms.keyformSets.find(isOpacityKeyform);
  const nonDefaultOpacityDrawable = packageDocument.model.drawables.drawables.find(
    (drawable) => drawable.defaultOpacity !== 1
  );

  if (enabledMask !== undefined || opacityKeyform !== undefined || nonDefaultOpacityDrawable !== undefined) {
    return [];
  }

  return [
    createTutorialCheck({
      checkId: "tutorial.requiredMaskOrOpacityMissing",
      severity: "error",
      target: {
        kind: "package",
        id: packageDocument.manifest.packageId,
        path: "/model/masks/masks"
      },
      targetPath: "/model/masks/masks",
      message: "Tutorial mini model is missing enabled mask relation or authored opacity evidence.",
      evidence: [
        `maskRelationCount=${packageDocument.model.masks.masks.length}`,
        "enabledMaskRelationCount=0",
        "opacityKeyformCount=0",
        "nonDefaultOpacityDrawableCount=0"
      ],
      impact: "The tutorial composition slice needs mask or opacity evidence, but neither is present."
    })
  ];
};

const validateRigControlPresence = (
  packageDocument: PackageDocumentDto
): readonly ValidationCheckResultDto[] => {
  const enabledRotation2dControls = packageDocument.model.rigControls.rigControls.filter(
    (rigControl) => rigControl.kind === "rotation2d" && rigControl.enabled
  );

  if (enabledRotation2dControls.length > 0) {
    return [];
  }

  return [
    createTutorialCheck({
      checkId: "tutorial.requiredRigControlMissing",
      severity: "error",
      target: {
        kind: "package",
        id: packageDocument.manifest.packageId,
        path: "/model/rigControls/rigControls"
      },
      targetPath: "/model/rigControls/rigControls",
      message: "Tutorial mini model is missing an enabled rotation2d rig control.",
      evidence: [
        `rigControlCount=${packageDocument.model.rigControls.rigControls.length}`,
        "enabledRotation2dRigControlCount=0"
      ],
      impact: "The tutorial rig slice requires project-defined rotation2d rig control evidence."
    })
  ];
};

const validateRigControlKeyformPresence = (
  packageDocument: PackageDocumentDto
): readonly ValidationCheckResultDto[] => {
  const rigControlIds = new Set<string>(
    packageDocument.model.rigControls.rigControls.map((rigControl) => rigControl.rigControlId)
  );
  const enabledRotation2dRigControlIds = new Set<string>(
    packageDocument.model.rigControls.rigControls
      .filter((rigControl) => rigControl.kind === "rotation2d" && rigControl.enabled)
      .map((rigControl) => rigControl.rigControlId)
  );
  const checks: ValidationCheckResultDto[] = [];

  packageDocument.model.keyforms.keyformSets.forEach((keyformSet, keyformSetIndex) => {
    if (keyformSet.target.kind === "rigControl" && !rigControlIds.has(keyformSet.target.id)) {
      checks.push(createMissingRigControlKeyformReferenceCheck(packageDocument, keyformSet, keyformSetIndex));
    }
  });

  const angleKeyforms = packageDocument.model.keyforms.keyformSets.filter(
    (keyformSet) =>
      keyformSet.target.kind === "rigControl" &&
      keyformSet.target.property === "angleDegrees" &&
      enabledRotation2dRigControlIds.has(keyformSet.target.id)
  );

  if (angleKeyforms.length === 0) {
    checks.push(createRequiredKeyformMissingCheck(packageDocument, enabledRotation2dRigControlIds));
  }

  return checks;
};

const validateDynamicsPresence = (
  packageDocument: PackageDocumentDto
): readonly ValidationCheckResultDto[] => {
  const enabledGroups = packageDocument.model.dynamics.dynamicsGroups.filter((group) => group.enabled);
  if (enabledGroups.length > 0) {
    return [];
  }

  return [
    createTutorialCheck({
      checkId: "tutorial.requiredDynamicsMissing",
      severity: "error",
      target: {
        kind: "package",
        id: packageDocument.manifest.packageId,
        path: "/model/dynamics/dynamicsGroups"
      },
      targetPath: "/model/dynamics/dynamicsGroups",
      message: "Tutorial mini model is missing an enabled Dynamics v2 additive pendulum group.",
      evidence: [
        `dynamicsGroupCount=${packageDocument.model.dynamics.dynamicsGroups.length}`,
        "enabledDynamicsGroupCount=0"
      ],
      impact: "The tutorial model cannot prove the dynamics slice without enabled additive pendulum evidence."
    })
  ];
};

const validateRuntimeEvidenceFreshness = (
  input: TutorialMiniModelReadinessInput
): readonly ValidationCheckResultDto[] => {
  if (input.runtimeSnapshot === undefined) {
    return [];
  }

  const evidence: string[] = [];
  const { packageDocument, runtimeSnapshot } = input;

  if (packageDocument.manifest.packageId !== runtimeSnapshot.packageId) {
    evidence.push(`packageId=${packageDocument.manifest.packageId}`);
    evidence.push(`snapshotPackageId=${runtimeSnapshot.packageId}`);
  }

  if (packageDocument.manifest.packageRevision !== runtimeSnapshot.packageRevision) {
    evidence.push(`packageRevision=${packageDocument.manifest.packageRevision}`);
    evidence.push(`snapshotPackageRevision=${runtimeSnapshot.packageRevision}`);
  }

  if (evidence.length === 0) {
    return [];
  }

  return [
    createTutorialCheck({
      checkId: "tutorial.evidenceStale",
      severity: "error",
      target: {
        kind: "runtimeSnapshot",
        id: runtimeSnapshot.snapshotId,
        path: "/runtime/snapshots"
      },
      targetPath: "/runtime/snapshots",
      message: `Runtime snapshot ${runtimeSnapshot.snapshotId} is stale for tutorial readiness.`,
      evidence: [
        `snapshotId=${runtimeSnapshot.snapshotId}`,
        ...evidence,
        "reason=runtime-snapshot-package-identity-mismatch"
      ],
      impact: "Tutorial readiness cannot use runtime evidence produced for a different package identity.",
      snapshotIds: [runtimeSnapshot.snapshotId]
    })
  ];
};

const validateViewerEvidence = (
  input: TutorialMiniModelReadinessInput
): readonly ValidationCheckResultDto[] => {
  if (input.viewerEvidence === undefined) {
    return [
      createViewerMissingCheck(input.packageDocument, [
        "viewerEvidence=missing",
        input.runtimeSnapshot === undefined
          ? "runtimeSnapshot=missing"
          : `snapshotId=${input.runtimeSnapshot.snapshotId}`
      ], input.runtimeSnapshot?.snapshotId)
    ];
  }

  const parseResult = ViewerRuntimeEvaluationEvidenceSchema.safeParse(input.viewerEvidence);
  if (!parseResult.success) {
    return [
      createViewerMissingCheck(input.packageDocument, [
        "viewerEvidence=parse-failed",
        ...parseResult.error.issues.map((issue) =>
          `${issue.path.map(String).join(".") || "viewerEvidence"}=${issue.message}`
        )
      ], input.runtimeSnapshot?.snapshotId)
    ];
  }

  const viewerEvidence = parseResult.data;
  if (input.runtimeSnapshot === undefined) {
    return [
      createViewerMissingCheck(input.packageDocument, [
        `viewerSnapshotId=${viewerEvidence.snapshotId}`,
        "runtimeSnapshot=missing"
      ], viewerEvidence.snapshotId)
    ];
  }

  const staleEvidence = createViewerStaleEvidence(input.packageDocument, input.runtimeSnapshot, viewerEvidence);
  if (staleEvidence.length === 0) {
    return [];
  }

  return [
    createTutorialCheck({
      checkId: "tutorial.evidenceStale",
      severity: "error",
      target: {
        kind: "runtimeSnapshot",
        id: input.runtimeSnapshot.snapshotId,
        path: "/context/source/surface"
      },
      targetPath: "/context/source/surface",
      message: `Viewer evidence is stale for tutorial readiness snapshot ${input.runtimeSnapshot.snapshotId}.`,
      evidence: staleEvidence,
      impact: "Tutorial readiness requires current semantic Viewer runtime evidence, not preview or mismatched snapshot evidence.",
      snapshotIds: [input.runtimeSnapshot.snapshotId, viewerEvidence.snapshotId]
    })
  ];
};

const validateUnsupportedClaims = (
  input: TutorialMiniModelReadinessInput
): readonly ValidationCheckResultDto[] => {
  const claims = input.unsupportedClaims ?? [];

  return claims
    .map((claim, index) => ({ claim, index }))
    .sort((left, right) =>
      left.claim.claimId.localeCompare(right.claim.claimId) ||
      (left.claim.source ?? "").localeCompare(right.claim.source ?? "") ||
      left.index - right.index
    )
    .flatMap(({ claim, index }) => {
      if (claim.status === "notClaimed") {
        return [];
      }

      return [
        createUnsupportedClaimCheck({
          packageDocument: input.packageDocument,
          claimId: claim.claimId,
          status: claim.status,
          targetPath: `/tutorial/unsupportedClaims/${index}`,
          evidence: claim.evidence ?? [],
          ...(claim.source === undefined ? {} : { source: claim.source })
        })
      ];
    });
};

const createUnsupportedSourceAssetCheck = (
  packageDocument: PackageDocumentDto,
  sourceAsset: SourceAssetDto,
  sourceAssetIndex: number
): ValidationCheckResultDto =>
  createUnsupportedClaimCheck({
    packageDocument,
    claimId: "realAssetImport",
    status: "present",
    source: sourceAsset.sourceAssetId,
    target: {
      kind: "sourceAsset",
      id: sourceAsset.sourceAssetId,
      path: `/assets/sourceManifest/sourceAssets/${sourceAssetIndex}/kind`
    },
    targetPath: `/assets/sourceManifest/sourceAssets/${sourceAssetIndex}/kind`,
    evidence: [
      `sourceAssetId=${sourceAsset.sourceAssetId}`,
      `sourceKind=${sourceAsset.kind}`,
      "expectedSourceKind=generated-fixture-v1",
      "reason=tutorial-source-kind-not-synthetic"
    ]
  });

const createUnsupportedSourceBinaryCheck = (
  packageDocument: PackageDocumentDto,
  sourceAsset: SourceAssetDto,
  sourceAssetIndex: number
): ValidationCheckResultDto =>
  createUnsupportedClaimCheck({
    packageDocument,
    claimId: "realAssetImport",
    status: "present",
    source: sourceAsset.sourceAssetId,
    target: {
      kind: "sourceAsset",
      id: sourceAsset.sourceAssetId,
      path: `/assets/sourceManifest/sourceAssets/${sourceAssetIndex}/binaryAssetRef`
    },
    targetPath: `/assets/sourceManifest/sourceAssets/${sourceAssetIndex}/binaryAssetRef`,
    evidence: [
      `sourceAssetId=${sourceAsset.sourceAssetId}`,
      "binaryAssetRef=present",
      "reason=tutorial-real-asset-bytes-not-supported"
    ]
  });

const createUnsupportedTextureBinaryCheck = (
  packageDocument: PackageDocumentDto,
  textureEntry: TextureAtlasEntryDto,
  textureIndex: number
): ValidationCheckResultDto =>
  createUnsupportedClaimCheck({
    packageDocument,
    claimId: "realAssetImport",
    status: "present",
    source: textureEntry.textureId,
    target: {
      kind: "texture",
      id: textureEntry.textureId,
      path: `/assets/textureAtlas/textures/${textureIndex}/binaryAssetRef`
    },
    targetPath: `/assets/textureAtlas/textures/${textureIndex}/binaryAssetRef`,
    evidence: [
      `textureId=${textureEntry.textureId}`,
      "binaryAssetRef=present",
      "reason=tutorial-real-texture-bytes-not-supported"
    ]
  });

const createMissingRigControlKeyformReferenceCheck = (
  packageDocument: PackageDocumentDto,
  keyformSet: PackageDocumentDto["model"]["keyforms"]["keyformSets"][number],
  keyformSetIndex: number
): ValidationCheckResultDto =>
  createTutorialCheck({
    checkId: "tutorial.missingReference",
    severity: "error",
    target: {
      kind: "keyformSet",
      id: keyformSet.keyformSetId,
      path: `/model/keyforms/keyformSets/${keyformSetIndex}/target/id`
    },
    targetPath: `/model/keyforms/keyformSets/${keyformSetIndex}/target/id`,
    message: `Tutorial keyform ${keyformSet.keyformSetId} references missing rig control ${keyformSet.target.id}.`,
    evidence: [
      `keyformSetId=${keyformSet.keyformSetId}`,
      `targetKind=${keyformSet.target.kind}`,
      `targetId=${keyformSet.target.id}`,
      `targetProperty=${keyformSet.target.property}`,
      "rigControlMatch=missing",
      `availableRigControlIds=${packageDocument.model.rigControls.rigControls.map((rigControl) => rigControl.rigControlId).join(",")}`
    ],
    impact: "Tutorial readiness cannot use a rig-control keyform whose target rig control is absent."
  });

const createRequiredKeyformMissingCheck = (
  packageDocument: PackageDocumentDto,
  enabledRotation2dRigControlIds: ReadonlySet<string>
): ValidationCheckResultDto =>
  createTutorialCheck({
    checkId: "tutorial.requiredKeyformMissing",
    severity: "error",
    target: {
      kind: "package",
      id: packageDocument.manifest.packageId,
      path: "/model/keyforms/keyformSets"
    },
    targetPath: "/model/keyforms/keyformSets",
    message: "Tutorial mini model is missing a rigControl:angleDegrees keyform.",
    evidence: [
      `keyformSetCount=${packageDocument.model.keyforms.keyformSets.length}`,
      `enabledRotation2dRigControlIds=${[...enabledRotation2dRigControlIds].join(",")}`,
      "angleKeyformMatch=missing"
    ],
    impact: "The tutorial rig slice requires an authored angle keyform for an enabled rotation2d rig control."
  });

const createViewerMissingCheck = (
  packageDocument: PackageDocumentDto,
  evidence: readonly string[],
  runtimeSnapshotId?: RuntimeSnapshotId
): ValidationCheckResultDto =>
  createTutorialCheck({
    checkId: "tutorial.viewerEvidenceMissing",
    severity: "error",
    target: {
      kind: "package",
      id: packageDocument.manifest.packageId,
      path: "/viewer/runtimeEvidence"
    },
    targetPath: "/viewer/runtimeEvidence",
    message: "Tutorial readiness requires semantic Viewer runtime evidence.",
    evidence,
    impact: "The tutorial preflight cannot prove Preview/Viewer/Validator readiness without viewer runtime evidence.",
    snapshotIds: runtimeSnapshotId === undefined ? [] : [runtimeSnapshotId]
  });

const createViewerStaleEvidence = (
  packageDocument: PackageDocumentDto,
  runtimeSnapshot: RuntimeSnapshotDto,
  viewerEvidence: ReturnType<typeof ViewerRuntimeEvaluationEvidenceSchema.parse>
): readonly string[] => {
  const evidence: string[] = [];

  if (viewerEvidence.packageId !== packageDocument.manifest.packageId) {
    evidence.push(`packageId=${packageDocument.manifest.packageId}`);
    evidence.push(`viewerEvidencePackageId=${viewerEvidence.packageId}`);
  }

  if (viewerEvidence.packageRevision !== packageDocument.manifest.packageRevision) {
    evidence.push(`packageRevision=${packageDocument.manifest.packageRevision}`);
    evidence.push(`viewerEvidencePackageRevision=${viewerEvidence.packageRevision}`);
  }

  if (runtimeSnapshot.packageId !== packageDocument.manifest.packageId) {
    evidence.push(`snapshotPackageId=${runtimeSnapshot.packageId}`);
  }

  if (runtimeSnapshot.packageRevision !== packageDocument.manifest.packageRevision) {
    evidence.push(`snapshotPackageRevision=${runtimeSnapshot.packageRevision}`);
  }

  if (viewerEvidence.snapshotId !== runtimeSnapshot.snapshotId) {
    evidence.push(`viewerSnapshotId=${viewerEvidence.snapshotId}`);
    evidence.push(`runtimeSnapshotId=${runtimeSnapshot.snapshotId}`);
  }

  if (runtimeSnapshot.context.source.surface !== "viewer") {
    evidence.push(`snapshotSurface=${runtimeSnapshot.context.source.surface}`);
  }

  return evidence.length === 0
    ? []
    : [
        `snapshotId=${runtimeSnapshot.snapshotId}`,
        ...evidence,
        "reason=viewer-evidence-stale"
      ];
};

const createUnsupportedClaimCheck = (input: {
  readonly packageDocument: PackageDocumentDto;
  readonly claimId: string;
  readonly status: Exclude<TutorialUnsupportedClaimStatus, "notClaimed">;
  readonly source?: string;
  readonly target?: TargetRefDto;
  readonly targetPath: string;
  readonly evidence: readonly string[];
}): ValidationCheckResultDto => {
  const truthfulUnsupported = input.status === "unsupported";

  return createTutorialCheck({
    checkId: "tutorial.unsupportedClaim",
    status: truthfulUnsupported ? "not_applicable" : "fail",
    severity: truthfulUnsupported ? "info" : "blocking",
    target: input.target ?? {
      kind: "package",
      id: input.packageDocument.manifest.packageId,
      path: input.targetPath
    },
    targetPath: input.targetPath,
    message: truthfulUnsupported
      ? `Tutorial non-goal claim ${input.claimId} is truthfully marked unsupported.`
      : `Tutorial readiness rejects unsupported claim ${input.claimId}.`,
    evidence: [
      `claimId=${input.claimId}`,
      `claimStatus=${input.status}`,
      ...(input.source === undefined ? [] : [`claimSource=${input.source}`]),
      ...input.evidence
    ],
    impact: truthfulUnsupported
      ? "The claim is outside Wave30 tutorial readiness and is recorded as unsupported without failing readiness."
      : "Wave30 tutorial readiness cannot claim real assets, full rendering, pixel oracle, public distribution, file I/O, or Cubism compatibility."
  });
};

const createTutorialCheck = (input: {
  readonly checkId: string;
  readonly status?: "pass" | "warning" | "fail" | "needs_review" | "not_applicable";
  readonly severity: "info" | "warning" | "error" | "blocking";
  readonly target: TargetRefDto;
  readonly targetPath: string;
  readonly message: string;
  readonly evidence: readonly string[];
  readonly impact: string;
  readonly snapshotIds?: readonly RuntimeSnapshotId[];
}): ValidationCheckResultDto =>
  ValidationCheckResultSchema.parse({
    checkId: input.checkId,
    status: input.status ?? "fail",
    severity: input.severity,
    phase: "tutorial_readiness",
    target: input.target,
    targetPath: input.targetPath,
    message: input.message,
    evidence: [...input.evidence],
    relatedAC: TUTORIAL_RELATED_AC,
    relatedScenarios: TUTORIAL_RELATED_SCENARIOS,
    impact: input.impact,
    snapshotIds: [...(input.snapshotIds ?? [])]
  });

const isOpacityKeyform = (
  keyformSet: PackageDocumentDto["model"]["keyforms"]["keyformSets"][number]
): boolean =>
  keyformSet.target.kind === "opacity" ||
  (keyformSet.target.kind === "drawable" && keyformSet.target.property.toLowerCase().includes("opacity"));

const partMatchesRole = (partId: string, displayName: string, role: string): boolean => {
  const roleTokens = tokenize(role);
  const candidateTokens = new Set([
    ...tokenize(partId),
    ...tokenize(displayName)
  ]);

  return roleTokens.length > 0 && roleTokens.every((token) => candidateTokens.has(token));
};

const drawableMatchesRole = (
  drawable: PackageDocumentDto["model"]["drawables"]["drawables"][number],
  packageDocument: PackageDocumentDto,
  role: string
): boolean => {
  const roleTokens = tokenize(role);
  const sourceLayers = findSourceLayersForDrawable(packageDocument, drawable);
  const candidateTokens = new Set([
    ...tokenize(drawable.drawableId),
    ...tokenize(drawable.displayName),
    ...tokenize(drawable.textureId),
    ...sourceLayers.flatMap((layer) => [
      ...tokenize(layer.sourceLayerId),
      ...tokenize(layer.originalName),
      ...tokenize(layer.normalizedName),
      ...layer.groupPath.flatMap((pathPart) => tokenize(pathPart))
    ])
  ]);

  return (
    roleTokens.length > 0 &&
    roleTokens.every((token) => candidateTokens.has(token)) &&
    !hasForbiddenDrawableRoleToken(roleTokens, candidateTokens)
  );
};

const hasForbiddenDrawableRoleToken = (
  roleTokens: readonly string[],
  candidateTokens: ReadonlySet<string>
): boolean => {
  if (roleTokens.length === 1 && roleTokens[0] === "eye") {
    return candidateTokens.has("mask");
  }

  return false;
};

const findSourceLayersForDrawable = (
  packageDocument: PackageDocumentDto,
  drawable: PackageDocumentDto["model"]["drawables"]["drawables"][number]
) => {
  const sourceLayerIds = new Set<string>();
  const textureEntry = packageDocument.assets.textureAtlas?.textures.find(
    (texture) => texture.textureId === drawable.textureId
  );
  if (textureEntry?.sourceLayerId !== undefined) {
    sourceLayerIds.add(textureEntry.sourceLayerId);
  }

  return packageDocument.assets.sourceManifest.sourceAssets.flatMap((sourceAsset) =>
    sourceAsset.layers.filter(
      (layer) => layer.mappedDrawableIds.includes(drawable.drawableId) || sourceLayerIds.has(layer.sourceLayerId)
    )
  );
};

const tokenize = (value: string): readonly string[] =>
  value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 0 && token !== "part");

const formatIdList = (ids: readonly string[]): string => ids.length === 0 ? "none" : ids.join(",");

const createTutorialReadinessReportId = (
  packageDocument: PackageDocumentDto
): ValidationReportId => {
  const packageToken = packageDocument.manifest.packageId.replace(/^pkg_/, "");
  return ValidationReportIdSchema.parse(`val_${packageToken}_tutorialReadiness`);
};
