import {
  CODEX_PROPOSAL_REQUIRED_UNSUPPORTED_BOUNDARY_KINDS,
  CodexProposalOperationCatalogDtoSchema,
  type CodexProposalOperationCatalogDto,
  type CodexProposalOperationCatalogEntryDto,
  type CodexProposalOperationFamilyDto,
  type CodexProposalOperationInputDescriptorDto,
  type CodexProposalUnsupportedBoundaryDto,
  type CodexProposalUnsupportedBoundaryKindDto,
  type TargetKind
} from "@private-2d-rigging-lab/contracts";

export const CODEX_PROPOSAL_OPERATION_CATALOG_ID = "catalog_wave40OperationCatalogV0";

interface AvailableOperationDefinition {
  readonly operationType: string;
  readonly operationFamily: CodexProposalOperationFamilyDto;
  readonly displayName: string;
  readonly summary: string;
  readonly targetKinds: readonly TargetKind[];
  readonly payloadSchemaRef: string;
  readonly requiredInputs: readonly CodexProposalOperationInputDescriptorDto[];
}

interface UnsupportedOperationDefinition {
  readonly operationType: string;
  readonly operationFamily: CodexProposalOperationFamilyDto;
  readonly displayName: string;
  readonly summary: string;
  readonly unsupportedBoundaryKinds: readonly CodexProposalUnsupportedBoundaryKindDto[];
}

export interface GetCodexProposalOperationCatalogOptions {
  readonly catalogId?: string;
  readonly generatedAt?: string;
}

const APPROVAL_REQUIREMENT = {
  requiresUserApproval: true,
  allowAutomaticCommit: false,
  approvalScope: "wholeProposal"
} as const;

const AVAILABLE_PREVIEW_SUPPORT = {
  dryRunSupported: true,
  standaloneDiffSupported: true,
  rerunValidationSupported: true,
  productPreflightSupported: true
} as const;

const UNSUPPORTED_PREVIEW_SUPPORT = {
  dryRunSupported: false,
  standaloneDiffSupported: false,
  rerunValidationSupported: false,
  productPreflightSupported: false
} as const;

export const getCodexProposalOperationCatalog = (
  options: GetCodexProposalOperationCatalogOptions = {}
): CodexProposalOperationCatalogDto =>
  CodexProposalOperationCatalogDtoSchema.parse({
    schemaVersion: "codex-proposal-operation-catalog-v0",
    catalogId: options.catalogId ?? CODEX_PROPOSAL_OPERATION_CATALOG_ID,
    ...(options.generatedAt === undefined ? {} : { generatedAt: options.generatedAt }),
    operations: buildOperationCatalogEntries(),
    unsupportedBoundaries: buildUnsupportedBoundaries()
  });

const buildOperationCatalogEntries = (): readonly CodexProposalOperationCatalogEntryDto[] =>
  [
    ...AVAILABLE_OPERATIONS.map(buildAvailableOperationEntry),
    ...UNSUPPORTED_OPERATION_EXAMPLES.map(buildUnsupportedOperationEntry)
  ].sort(compareOperationEntries);

const buildAvailableOperationEntry = (
  definition: AvailableOperationDefinition
): CodexProposalOperationCatalogEntryDto => ({
  operationType: definition.operationType,
  operationFamily: definition.operationFamily,
  availability: "available",
  displayName: definition.displayName,
  summary: definition.summary,
  targetKinds: [...definition.targetKinds].sort(),
  payloadSchemaRef: definition.payloadSchemaRef,
  requiredInputs: [...definition.requiredInputs].sort(compareInputDescriptors),
  approvalRequirement: APPROVAL_REQUIREMENT,
  previewSupport: AVAILABLE_PREVIEW_SUPPORT,
  unsupportedBoundaryKinds: []
});

const buildUnsupportedOperationEntry = (
  definition: UnsupportedOperationDefinition
): CodexProposalOperationCatalogEntryDto => ({
  operationType: definition.operationType,
  operationFamily: definition.operationFamily,
  availability: "unsupported",
  displayName: definition.displayName,
  summary: definition.summary,
  targetKinds: [],
  payloadSchemaRef: `operation.${definition.operationType}.unsupported.v1`,
  requiredInputs: [],
  approvalRequirement: APPROVAL_REQUIREMENT,
  previewSupport: UNSUPPORTED_PREVIEW_SUPPORT,
  unsupportedBoundaryKinds: [...definition.unsupportedBoundaryKinds].sort()
});

const buildUnsupportedBoundaries = (): readonly CodexProposalUnsupportedBoundaryDto[] =>
  CODEX_PROPOSAL_REQUIRED_UNSUPPORTED_BOUNDARY_KINDS.map((boundaryKind) => ({
    boundaryKind,
    status: "unsupported",
    severity: "blocking",
    summary: UNSUPPORTED_BOUNDARY_SUMMARIES[boundaryKind],
    gateIds: [],
    evidenceRefs: []
  }));

const requiredPackageContext = (): CodexProposalOperationInputDescriptorDto => ({
  inputId: "packageContext.basePackageRevision",
  inputKind: "packageContext",
  required: true,
  summary: "Proposal must state the package revision it was planned against."
});

const requiredTargetRef = (summary: string): CodexProposalOperationInputDescriptorDto => ({
  inputId: "target.primary",
  inputKind: "targetRef",
  required: true,
  summary
});

const requiredPayloadField = (
  fieldName: string,
  summary: string
): CodexProposalOperationInputDescriptorDto => ({
  inputId: `payload.${fieldName}`,
  inputKind: "payloadField",
  required: true,
  summary
});

const requiredPreflightReport = (): CodexProposalOperationInputDescriptorDto => ({
  inputId: "preflight.currentProductReport",
  inputKind: "productPreflightReport",
  required: true,
  summary: "Validation needs the current Product Preflight report to avoid stale or unsupported context."
});

const codexInputs = (
  targetSummary: string,
  payloadFields: readonly string[]
): readonly CodexProposalOperationInputDescriptorDto[] => [
  requiredPackageContext(),
  requiredPreflightReport(),
  requiredTargetRef(targetSummary),
  ...payloadFields.map((fieldName) =>
    requiredPayloadField(fieldName, `${fieldName} must be present in the operation payload.`)
  )
];

const AVAILABLE_OPERATIONS: readonly AvailableOperationDefinition[] = [
  {
    operationType: "addKeyform",
    operationFamily: "rigControl",
    displayName: "Add keyform",
    summary: "Add a project-defined one-dimensional keyform patch to an editable target.",
    targetKinds: ["drawable", "mesh", "rigControl"],
    payloadSchemaRef: "operation.addKeyform.payload.v1",
    requiredInputs: codexInputs("Target being keyed plus the driving parameter.", [
      "target",
      "targetProperty",
      "parameterId",
      "keyValue",
      "interpolation",
      "statePatch"
    ])
  },
  {
    operationType: "addKeyformGrid2d",
    operationFamily: "rigControl",
    displayName: "Add 2D keyform grid",
    summary: "Add a project-defined bilinear two-parameter keyform grid.",
    targetKinds: ["drawable", "mesh", "rigControl"],
    payloadSchemaRef: "operation.addKeyformGrid2d.payload.v1",
    requiredInputs: codexInputs("Target being keyed plus the two driving parameters.", [
      "target",
      "targetProperty",
      "parameterX",
      "parameterY",
      "evaluator",
      "interpolation",
      "clampPolicy",
      "keys"
    ])
  },
  {
    operationType: "addMeshTriangle",
    operationFamily: "meshTopologyUv",
    displayName: "Add mesh triangle",
    summary: "Add one explicit triangle to an existing project-defined mesh.",
    targetKinds: ["mesh", "triangle", "vertex"],
    payloadSchemaRef: "operation.addMeshTriangle.payload.v1",
    requiredInputs: codexInputs("Mesh, new triangle, and referenced vertices.", [
      "meshId",
      "triangleId",
      "vertexIds",
      "windingPolicy",
      "intent"
    ])
  },
  {
    operationType: "addMeshVertex",
    operationFamily: "meshTopologyUv",
    displayName: "Add mesh vertex",
    summary: "Add one explicit vertex and UV point to an existing project-defined mesh.",
    targetKinds: ["mesh", "vertex"],
    payloadSchemaRef: "operation.addMeshVertex.payload.v1",
    requiredInputs: codexInputs("Mesh and new vertex.", [
      "meshId",
      "vertexId",
      "position",
      "uv",
      "intent"
    ])
  },
  {
    operationType: "bindRigControlChild",
    operationFamily: "rigControl",
    displayName: "Bind rig-control child",
    summary: "Bind a drawable or rig control as a child of a project-defined rig control.",
    targetKinds: ["rigControl", "drawable"],
    payloadSchemaRef: "operation.bindRigControlChild.payload.v1",
    requiredInputs: codexInputs("Parent rig control and child target.", [
      "parentRigControlId",
      "child"
    ])
  },
  {
    operationType: "moveDrawableRigControlBinding",
    operationFamily: "rigControl",
    displayName: "Move drawable deformer binding",
    summary: "Move an already-bound drawable from one deformer parent to another without changing part membership or draw order.",
    targetKinds: ["rigControl", "drawable"],
    payloadSchemaRef: "operation.moveDrawableRigControlBinding.payload.v1",
    requiredInputs: codexInputs("Bound drawable and destination rig control.", [
      "drawableId",
      "targetRigControlId"
    ])
  },
  {
    operationType: "createDrawable",
    operationFamily: "modelStructure",
    displayName: "Create drawable",
    summary: "Create a drawable from existing project-defined source/texture metadata.",
    targetKinds: ["drawable", "sourceAsset", "part"],
    payloadSchemaRef: "operation.createDrawable.payload.v1",
    requiredInputs: codexInputs("New drawable plus source asset and part context.", [
      "sourceAssetId",
      "partId",
      "displayName"
    ])
  },
  {
    operationType: "createDynamicsGroup",
    operationFamily: "dynamics",
    displayName: "Create dynamics group",
    summary: "Create a Dynamics v3 world-frame chain group.",
    targetKinds: ["dynamicsGroup", "parameter"],
    payloadSchemaRef: "operation.createDynamicsGroup.payload.v1",
    requiredInputs: codexInputs("New dynamics group and its inputs, chain, and outputs.", [
      "dynamicsGroupId",
      "displayName",
      "inputs",
      "chain",
      "outputs"
    ])
  },
  {
    operationType: "createParameter",
    operationFamily: "modelStructure",
    displayName: "Create parameter",
    summary: "Create a project-defined authored or computed parameter.",
    targetKinds: ["parameter"],
    payloadSchemaRef: "operation.createParameter.payload.v1",
    requiredInputs: codexInputs("New parameter target.", [
      "parameterId",
      "displayName",
      "min",
      "max",
      "default",
      "recommendedUiStep"
    ])
  },
  {
    operationType: "createPart",
    operationFamily: "modelStructure",
    displayName: "Create part",
    summary: "Create a project-defined part in the layer hierarchy.",
    targetKinds: ["part"],
    payloadSchemaRef: "operation.createPart.payload.v1",
    requiredInputs: codexInputs("New part target.", ["partId", "displayName"])
  },
  {
    operationType: "createRotation2dRigControl",
    operationFamily: "rigControl",
    displayName: "Create rotation2d rig control",
    summary:
      "Create a project-defined 2D rotation rig control, optionally inserting it before one child or atomically wrapping selected children.",
    targetKinds: ["rigControl", "drawable"],
    payloadSchemaRef: "operation.createRotation2dRigControl.payload.v1",
    requiredInputs: codexInputs("New rig control and pivot.", [
      "displayName",
      "pivot",
      "restAngleDegrees"
    ])
  },
  {
    operationType: "createWarpDeformer",
    operationFamily: "rigControl",
    displayName: "Create Warp Deformer",
    summary:
      "Create a project-defined Warp Deformer with transform grid divisions, stored Bezier edit surface, and optional insertion or selected-child wrap.",
    targetKinds: ["rigControl", "drawable"],
    payloadSchemaRef: "operation.createWarpDeformer.payload.v1",
    requiredInputs: codexInputs("New Warp Deformer, domain bounds, and division settings.", [
      "displayName",
      "domainBounds",
      "transformColumns",
      "transformRows",
      "bezierColumns",
      "bezierRows"
    ])
  },
  {
    operationType: "createWarpLattice2dRigControl",
    operationFamily: "rigControl",
    displayName: "Create warpLattice2d rig control",
    summary: "Create a project-defined bilinear warp lattice rig control.",
    targetKinds: ["rigControl", "drawable"],
    payloadSchemaRef: "operation.createWarpLattice2dRigControl.payload.v1",
    requiredInputs: codexInputs("New warp lattice rig control and lattice dimensions.", [
      "displayName",
      "domainBounds",
      "latticeColumns",
      "latticeRows",
      "interpolationMethod"
    ])
  },
  {
    operationType: "deletePart",
    operationFamily: "modelStructure",
    displayName: "Delete empty part",
    summary: "Delete a project-defined part only through the existing non-recursive guardrails.",
    targetKinds: ["part"],
    payloadSchemaRef: "operation.deletePart.payload.v1",
    requiredInputs: codexInputs("Existing part to delete.", ["partId"])
  },
  {
    operationType: "generateMesh",
    operationFamily: "meshTopologyUv",
    displayName: "Generate mesh scaffold",
    summary: "Generate a bounded project-defined mesh scaffold for a drawable.",
    targetKinds: ["drawable", "mesh"],
    payloadSchemaRef: "operation.generateMesh.payload.v1",
    requiredInputs: codexInputs("Drawable receiving a mesh scaffold.", ["drawableId", "method"])
  },
  {
    operationType: "importPsdSourceAsset",
    operationFamily: "assetMetadata",
    displayName: "Register PSD source metadata",
    summary: "Register parser-free PSD source/profile metadata and rights information.",
    targetKinds: ["sourceAsset"],
    payloadSchemaRef: "operation.importPsdSourceAsset.payload.v1",
    requiredInputs: codexInputs("Source asset metadata record; this does not parse PSD bytes.", [
      "sourceAssetId",
      "fileRef",
      "importProfile",
      "rights"
    ])
  },
  {
    operationType: "importPsdLayerMaterializationBatch",
    operationFamily: "assetMetadata",
    displayName: "Import approved PSD leaf materialization batch",
    summary:
      "Import externally supplied, explicitly approved PSD leaf materialization evidence through the approval bridge.",
    targetKinds: ["drawable", "mesh", "part", "sourceAsset", "texture"],
    payloadSchemaRef: "operation.importPsdLayerMaterializationBatch.payload.v1",
    requiredInputs: codexInputs("Source PSD asset, destination parent part, and generated result targets.", [
      "sourceAssetId",
      "batchId",
      "destination",
      "importPlanBridge",
      "entries"
    ])
  },
  {
    operationType: "importSplitPngSourceAsset",
    operationFamily: "assetMetadata",
    displayName: "Register split PNG source metadata",
    summary: "Register split PNG layer metadata and rights/provenance information without decoding image bytes.",
    targetKinds: ["sourceAsset"],
    payloadSchemaRef: "operation.importSplitPngSourceAsset.payload.v1",
    requiredInputs: codexInputs("Source asset metadata record; this does not decode PNG bytes.", [
      "sourceAssetId",
      "importProfile",
      "placementPolicy"
    ])
  },
  {
    operationType: "moveMeshUvPoint",
    operationFamily: "meshTopologyUv",
    displayName: "Move mesh UV point",
    summary: "Move one or more explicit UV points in a project-defined mesh.",
    targetKinds: ["mesh", "vertex"],
    payloadSchemaRef: "operation.moveMeshUvPoint.payload.v1",
    requiredInputs: codexInputs("Mesh and UV point deltas.", ["meshId", "uvDeltas", "intent"])
  },
  {
    operationType: "moveMeshVertex",
    operationFamily: "meshTopologyUv",
    displayName: "Move mesh vertex",
    summary: "Move one or more explicit mesh vertices.",
    targetKinds: ["mesh", "vertex"],
    payloadSchemaRef: "operation.moveMeshVertex.payload.v1",
    requiredInputs: codexInputs("Mesh and vertex deltas.", ["meshId", "vertexDeltas", "intent"])
  },
  {
    operationType: "moveStructureChild",
    operationFamily: "modelStructure",
    displayName: "Move structure child",
    summary:
      "Move a part container or drawable before, after, or inside a part-tree row while preserving mixed draw-stack order.",
    targetKinds: ["part", "drawable"],
    payloadSchemaRef: "operation.moveStructureChild.payload.v1",
    requiredInputs: codexInputs("Moved structure child and drop placement.", ["moved", "drop"])
  },
  {
    operationType: "removeMeshTriangle",
    operationFamily: "meshTopologyUv",
    displayName: "Remove mesh triangle",
    summary: "Remove one explicit triangle without broader retopology.",
    targetKinds: ["mesh", "triangle"],
    payloadSchemaRef: "operation.removeMeshTriangle.payload.v1",
    requiredInputs: codexInputs("Mesh and triangle to remove.", [
      "meshId",
      "triangleId",
      "removalPolicy",
      "intent"
    ])
  },
  {
    operationType: "removeMeshVertex",
    operationFamily: "meshTopologyUv",
    displayName: "Remove unreferenced mesh vertex",
    summary: "Remove one unreferenced vertex through the existing bounded topology guardrails.",
    targetKinds: ["mesh", "vertex"],
    payloadSchemaRef: "operation.removeMeshVertex.payload.v1",
    requiredInputs: codexInputs("Mesh and unreferenced vertex to remove.", [
      "meshId",
      "vertexId",
      "removalPolicy",
      "intent"
    ])
  },
  {
    operationType: "reparentRigControl",
    operationFamily: "rigControl",
    displayName: "Reparent rig control",
    summary: "Move a child deformer under another deformer parent or to the deformer root with cycle prevention.",
    targetKinds: ["rigControl"],
    payloadSchemaRef: "operation.reparentRigControl.payload.v1",
    requiredInputs: codexInputs("Child rig control and destination parent, or null for root.", [
      "childRigControlId",
      "parentRigControlId"
    ])
  },
  {
    operationType: "setDrawOrder",
    operationFamily: "composition",
    displayName: "Set draw order",
    summary: "Set explicit base draw-order entries for drawables.",
    targetKinds: ["drawable"],
    payloadSchemaRef: "operation.setDrawOrder.payload.v1",
    requiredInputs: codexInputs("Drawable draw-order entries.", ["entries"])
  },
  {
    operationType: "setDrawablePart",
    operationFamily: "modelStructure",
    displayName: "Set drawable part",
    summary: "Assign a drawable to an existing project-defined part.",
    targetKinds: ["drawable", "part"],
    payloadSchemaRef: "operation.setDrawablePart.payload.v1",
    requiredInputs: codexInputs("Drawable and destination part.", ["drawableId", "partId"])
  },
  {
    operationType: "setDrawableTexture",
    operationFamily: "composition",
    displayName: "Set drawable texture",
    summary: "Assign an existing project-defined texture reference to a drawable.",
    targetKinds: ["drawable", "texture"],
    payloadSchemaRef: "operation.setDrawableTexture.payload.v1",
    requiredInputs: codexInputs("Drawable and texture reference.", ["drawableId", "textureId"])
  },
  {
    operationType: "setMaskRelation",
    operationFamily: "composition",
    displayName: "Set mask relation",
    summary: "Set a project-defined drawable mask relation.",
    targetKinds: ["maskRelation", "drawable"],
    payloadSchemaRef: "operation.setMaskRelation.payload.v1",
    requiredInputs: codexInputs("Mask source and target drawables.", [
      "maskDrawableIds",
      "targetDrawableIds",
      "enabled"
    ])
  },
  {
    operationType: "setRightsMetadata",
    operationFamily: "rightsProvenance",
    displayName: "Set rights metadata",
    summary: "Set rights and provenance metadata for a project-defined source asset.",
    targetKinds: ["sourceAsset"],
    payloadSchemaRef: "operation.setRightsMetadata.payload.v1",
    requiredInputs: codexInputs("Asset rights metadata.", [
      "assetId",
      "rightsStatus",
      "license",
      "redistributionAllowed"
    ])
  },
  {
    operationType: "setRuntimeVisibility",
    operationFamily: "composition",
    displayName: "Set runtime visibility",
    summary: "Set runtime visibility on a project-defined drawable target.",
    targetKinds: ["drawable"],
    payloadSchemaRef: "operation.setRuntimeVisibility.payload.v1",
    requiredInputs: codexInputs("Target and visibility value.", ["target", "runtimeVisibility"])
  },
  {
    operationType: "updateDynamicsGroup",
    operationFamily: "dynamics",
    displayName: "Update dynamics group",
    summary: "Update metadata, inputs, chain, or additive outputs for an existing Dynamics v3 group.",
    targetKinds: ["dynamicsGroup"],
    payloadSchemaRef: "operation.updateDynamicsGroup.payload.v1",
    requiredInputs: codexInputs("Dynamics group to update.", ["dynamicsGroupId"])
  },
  {
    operationType: "deleteDynamicsGroup",
    operationFamily: "dynamics",
    displayName: "Delete dynamics group",
    summary: "Delete an existing Dynamics v3 world-frame chain group.",
    targetKinds: ["dynamicsGroup"],
    payloadSchemaRef: "operation.deleteDynamicsGroup.payload.v1",
    requiredInputs: codexInputs("Dynamics group to delete.", ["dynamicsGroupId"])
  },
  {
    operationType: "updatePart",
    operationFamily: "modelStructure",
    displayName: "Update part",
    summary: "Update a project-defined part display name or parent link.",
    targetKinds: ["part"],
    payloadSchemaRef: "operation.updatePart.payload.v1",
    requiredInputs: codexInputs("Part to update plus at least one changed field.", ["partId"])
  },
  {
    operationType: "updateRigControl",
    operationFamily: "rigControl",
    displayName: "Update rig control",
    summary: "Update committed deformer metadata, Warp Deformer domain/divisions, or static opacity multiplier.",
    targetKinds: ["rigControl"],
    payloadSchemaRef: "operation.updateRigControl.payload.v1",
    requiredInputs: codexInputs("Rig control plus at least one editable field.", ["rigControlId"])
  }
];

const UNSUPPORTED_OPERATION_EXAMPLES: readonly UnsupportedOperationDefinition[] = [
  {
    operationType: "applyNaturalLanguageRepair",
    operationFamily: "modelStructure",
    displayName: "Apply natural-language repair",
    summary: "Unsupported: natural-language repair is a Codex-side responsibility, not a repo operation.",
    unsupportedBoundaryKinds: ["naturalLanguageRepair"]
  },
  {
    operationType: "autoFixProposal",
    operationFamily: "modelStructure",
    displayName: "Auto-fix proposal",
    summary: "Unsupported: the repo does not automatically fix submitted proposals.",
    unsupportedBoundaryKinds: ["autoFix"]
  },
  {
    operationType: "callLlmProvider",
    operationFamily: "modelStructure",
    displayName: "Call LLM provider",
    summary: "Unsupported: the repo does not host an LLM provider or prompt loop.",
    unsupportedBoundaryKinds: ["llmProvider"]
  },
  {
    operationType: "commitWithoutApproval",
    operationFamily: "modelStructure",
    displayName: "Commit without approval",
    summary: "Unsupported: Codex proposal commits must remain approval-gated.",
    unsupportedBoundaryKinds: ["automaticCommit"]
  },
  {
    operationType: "generateProposal",
    operationFamily: "modelStructure",
    displayName: "Generate proposal",
    summary: "Unsupported: proposal generation is Codex-side work.",
    unsupportedBoundaryKinds: ["repoSideProposalGeneration"]
  },
  {
    operationType: "generateRepairCandidate",
    operationFamily: "modelStructure",
    displayName: "Generate repair candidate",
    summary: "Unsupported: the repo does not generate repair candidates.",
    unsupportedBoundaryKinds: ["repairCandidateGeneration"]
  },
  {
    operationType: "importCubismModel",
    operationFamily: "assetMetadata",
    displayName: "Import Cubism model",
    summary: "Unsupported: Cubism import/export/load compatibility is outside this project boundary.",
    unsupportedBoundaryKinds: ["cubismCompatibility"]
  },
  {
    operationType: "openExternalProposalTransport",
    operationFamily: "assetMetadata",
    displayName: "Open external proposal transport",
    summary: "Unsupported: external HTTP/socket/MCP transport is outside this wave.",
    unsupportedBoundaryKinds: ["externalTransport"]
  },
  {
    operationType: "parseImageSourceAsset",
    operationFamily: "assetMetadata",
    displayName: "Parse image source asset",
    summary: "Unsupported: parser/image decode is outside this project boundary.",
    unsupportedBoundaryKinds: ["parserImageDecode"]
  },
  {
    operationType: "rankRepairCandidate",
    operationFamily: "modelStructure",
    displayName: "Rank repair candidate",
    summary: "Unsupported: candidate ranking is Codex-side work.",
    unsupportedBoundaryKinds: ["candidateRanking"]
  },
  {
    operationType: "renderPixelOracle",
    operationFamily: "composition",
    displayName: "Render pixel oracle",
    summary: "Unsupported: renderer/pixel oracle validation is not provided.",
    unsupportedBoundaryKinds: ["rendererPixelOracle"]
  },
  {
    operationType: "writeArchiveFilesystemPackage",
    operationFamily: "assetMetadata",
    displayName: "Write archive/filesystem package",
    summary: "Unsupported: archive/filesystem implementation is outside this project boundary.",
    unsupportedBoundaryKinds: ["archiveFilesystem"]
  }
];

const UNSUPPORTED_BOUNDARY_SUMMARIES: Readonly<
  Record<CodexProposalUnsupportedBoundaryKindDto, string>
> = {
  repoSideProposalGeneration:
    "The repo exposes deterministic intake/validation surfaces only; proposal generation remains Codex-side.",
  repairCandidateGeneration:
    "The repo does not generate repair candidates or replacement proposal actions.",
  candidateRanking:
    "The repo does not rank repair candidates or choose between Codex alternatives.",
  llmProvider:
    "The repo does not provide an LLM provider, prompt template, or inference loop.",
  naturalLanguageRepair:
    "The repo does not convert natural-language repair text into operations.",
  autoFix:
    "The repo does not auto-fix invalid or unsupported proposals.",
  automaticCommit:
    "Codex proposal commits must pass through user approval; automatic commit is unsupported.",
  externalTransport:
    "External HTTP, socket-based, MCP, or caller adapter transport is unsupported in this surface.",
  parserImageDecode:
    "Real parser, PSD/PNG image decode, raster extraction, and texture materialization are unsupported.",
  archiveFilesystem:
    "ZIP/archive handling, local disk access, drag-drop ingestion, and cloud transport are unsupported.",
  rendererPixelOracle:
    "Full renderer, texture sampling correctness, rendered acceptance, and pixel oracle checks are unsupported.",
  cubismCompatibility:
    "Cubism SDK/Core, .moc3, .model3.json, Cubism import/export/load, and Cubism Physics compatibility are unsupported."
};

const compareOperationEntries = (
  left: CodexProposalOperationCatalogEntryDto,
  right: CodexProposalOperationCatalogEntryDto
): number => compareStrings(left.operationType, right.operationType);

const compareInputDescriptors = (
  left: CodexProposalOperationInputDescriptorDto,
  right: CodexProposalOperationInputDescriptorDto
): number => compareStrings(left.inputId, right.inputId);

const compareStrings = (left: string, right: string): number => {
  if (left < right) {
    return -1;
  }
  if (left > right) {
    return 1;
  }
  return 0;
};
