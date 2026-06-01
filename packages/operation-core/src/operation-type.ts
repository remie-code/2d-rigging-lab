import { z } from "zod";

export const operationTypes = [
  "importPsdSourceAsset",
  "importSplitPngSourceAsset",
  "createDrawable",
  "createPart",
  "updatePart",
  "setDrawablePart",
  "setDrawableTexture",
  "generateMesh",
  "moveMeshVertex",
  "createParameter",
  "addKeyform",
  "addKeyformGrid2d",
  "createDynamicsGroup",
  "updateDynamicsGroup",
  "deleteDynamicsGroup",
  "bindDynamicsDriver",
  "bindDynamicsOutput",
  "setDynamicsSettings",
  "resetDynamicsPreviewState",
  "runDynamicsPreviewSequence",
  "createRotation2dRigControl",
  "createWarpLattice2dRigControl",
  "bindRigControlChild",
  "setMaskRelation",
  "setDrawOrder",
  "setRuntimeVisibility",
  "setRightsMetadata"
] as const;

export const OperationTypeSchema = z.enum(operationTypes);
export type OperationType = z.infer<typeof OperationTypeSchema>;
