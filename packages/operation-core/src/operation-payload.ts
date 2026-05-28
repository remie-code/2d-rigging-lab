import { z } from "zod";

import {
  BindDynamicsDriverPayloadSchema,
  BindDynamicsOutputPayloadSchema,
  CreateDynamicsGroupPayloadSchema,
  DeleteDynamicsGroupPayloadSchema,
  ResetDynamicsPreviewStatePayloadSchema,
  RunDynamicsPreviewSequencePayloadSchema,
  SetDynamicsSettingsPayloadSchema,
  UpdateDynamicsGroupPayloadSchema
} from "./payloads/dynamics.js";
import {
  ImportPsdSourceAssetPayloadSchema,
  SplitPngSourceAssetPayloadSchema
} from "./payloads/import-source.js";
import {
  AddKeyformGrid2dPayloadSchema,
  AddKeyformPayloadSchema,
  CreateDrawablePayloadSchema,
  CreateParameterPayloadSchema,
  GenerateMeshPayloadSchema,
  MoveMeshVertexPayloadSchema,
  SetDrawOrderPayloadSchema,
  SetMaskRelationPayloadSchema,
  SetRightsMetadataPayloadSchema,
  SetRuntimeVisibilityPayloadSchema
} from "./payloads/model-edit.js";
import {
  BindRigControlChildPayloadSchema,
  CreateRotation2dRigControlPayloadSchema,
  CreateWarpLattice2dRigControlPayloadSchema
} from "./payloads/rig-control.js";

export const OperationPayloadSchema = z.discriminatedUnion("operationType", [
  z.object({ operationType: z.literal("importPsdSourceAsset"), payload: ImportPsdSourceAssetPayloadSchema }),
  z.object({ operationType: z.literal("importSplitPngSourceAsset"), payload: SplitPngSourceAssetPayloadSchema }),
  z.object({ operationType: z.literal("createDrawable"), payload: CreateDrawablePayloadSchema }),
  z.object({ operationType: z.literal("generateMesh"), payload: GenerateMeshPayloadSchema }),
  z.object({ operationType: z.literal("moveMeshVertex"), payload: MoveMeshVertexPayloadSchema }),
  z.object({ operationType: z.literal("createParameter"), payload: CreateParameterPayloadSchema }),
  z.object({ operationType: z.literal("addKeyform"), payload: AddKeyformPayloadSchema }),
  z.object({ operationType: z.literal("addKeyformGrid2d"), payload: AddKeyformGrid2dPayloadSchema }),
  z.object({ operationType: z.literal("createDynamicsGroup"), payload: CreateDynamicsGroupPayloadSchema }),
  z.object({ operationType: z.literal("updateDynamicsGroup"), payload: UpdateDynamicsGroupPayloadSchema }),
  z.object({ operationType: z.literal("deleteDynamicsGroup"), payload: DeleteDynamicsGroupPayloadSchema }),
  z.object({ operationType: z.literal("bindDynamicsDriver"), payload: BindDynamicsDriverPayloadSchema }),
  z.object({ operationType: z.literal("bindDynamicsOutput"), payload: BindDynamicsOutputPayloadSchema }),
  z.object({ operationType: z.literal("setDynamicsSettings"), payload: SetDynamicsSettingsPayloadSchema }),
  z.object({
    operationType: z.literal("resetDynamicsPreviewState"),
    payload: ResetDynamicsPreviewStatePayloadSchema
  }),
  z.object({
    operationType: z.literal("runDynamicsPreviewSequence"),
    payload: RunDynamicsPreviewSequencePayloadSchema
  }),
  z.object({
    operationType: z.literal("createRotation2dRigControl"),
    payload: CreateRotation2dRigControlPayloadSchema
  }),
  z.object({
    operationType: z.literal("createWarpLattice2dRigControl"),
    payload: CreateWarpLattice2dRigControlPayloadSchema
  }),
  z.object({ operationType: z.literal("bindRigControlChild"), payload: BindRigControlChildPayloadSchema }),
  z.object({ operationType: z.literal("setMaskRelation"), payload: SetMaskRelationPayloadSchema }),
  z.object({ operationType: z.literal("setDrawOrder"), payload: SetDrawOrderPayloadSchema }),
  z.object({ operationType: z.literal("setRuntimeVisibility"), payload: SetRuntimeVisibilityPayloadSchema }),
  z.object({ operationType: z.literal("setRightsMetadata"), payload: SetRightsMetadataPayloadSchema })
]);
export type OperationPayloadDto = z.infer<typeof OperationPayloadSchema>;
