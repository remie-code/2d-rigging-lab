import { z } from "zod";

import {
  CreateDynamicsGroupPayloadSchema,
  DeleteDynamicsGroupPayloadSchema,
  UpdateDynamicsGroupPayloadSchema
} from "./payloads/dynamics.js";
import {
  ImportPsdLayerMaterializationBatchPayloadSchema,
  ImportPsdLayerMaterializationPayloadSchema,
  ImportPsdSourceAssetPayloadSchema,
  SplitPngSourceAssetPayloadSchema
} from "./payloads/import-source.js";
import { ImportPsdStructuralScaffoldPayloadSchema } from "./payloads/import-psd-structural-scaffold.js";
import {
  AddKeyformGrid2dPayloadSchema,
  AddKeyformPayloadSchema,
  CreateDrawablePayloadSchema,
  CreatePartPayloadSchema,
  CreateParameterPayloadSchema,
  DeleteParameterPayloadSchema,
  EditKeyformKeyPayloadSchema,
  DeletePartPayloadSchema,
  GenerateMeshPayloadSchema,
  MoveStructureChildPayloadSchema,
  MoveMeshVertexPayloadSchema,
  SetDrawOrderPayloadSchema,
  SetDrawablePartPayloadSchema,
  SetDrawableTexturePayloadSchema,
  SetMaskRelationPayloadSchema,
  SetRightsMetadataPayloadSchema,
  SetRuntimeVisibilityPayloadSchema,
  UpdateDrawablePayloadSchema,
  UpdateParameterPayloadSchema,
  UpdatePartPayloadSchema
} from "./payloads/model-edit.js";
import {
  AddMeshTrianglePayloadSchema,
  AddMeshVertexPayloadSchema,
  MoveMeshUvPointPayloadSchema,
  RemoveMeshTrianglePayloadSchema,
  RemoveMeshVertexPayloadSchema
} from "./payloads/mesh-topology.js";
import {
  BindRigControlChildPayloadSchema,
  CreateWarpDeformerPayloadSchema,
  CreateRotation2dRigControlPayloadSchema,
  CreateWarpLattice2dRigControlPayloadSchema,
  MoveDrawableRigControlBindingPayloadSchema,
  ReparentRigControlPayloadSchema,
  UpdateRigControlPayloadSchema
} from "./payloads/rig-control.js";

export const OperationPayloadSchema = z.discriminatedUnion("operationType", [
  z.object({ operationType: z.literal("importPsdSourceAsset"), payload: ImportPsdSourceAssetPayloadSchema }),
  z.object({
    operationType: z.literal("importPsdLayerMaterialization"),
    payload: ImportPsdLayerMaterializationPayloadSchema
  }),
  z.object({
    operationType: z.literal("importPsdLayerMaterializationBatch"),
    payload: ImportPsdLayerMaterializationBatchPayloadSchema
  }),
  z.object({
    operationType: z.literal("importPsdStructuralScaffold"),
    payload: ImportPsdStructuralScaffoldPayloadSchema
  }),
  z.object({ operationType: z.literal("importSplitPngSourceAsset"), payload: SplitPngSourceAssetPayloadSchema }),
  z.object({ operationType: z.literal("createDrawable"), payload: CreateDrawablePayloadSchema }),
  z.object({ operationType: z.literal("updateDrawable"), payload: UpdateDrawablePayloadSchema }),
  z.object({ operationType: z.literal("createPart"), payload: CreatePartPayloadSchema }),
  z.object({ operationType: z.literal("updatePart"), payload: UpdatePartPayloadSchema }),
  z.object({ operationType: z.literal("deletePart"), payload: DeletePartPayloadSchema }),
  z.object({ operationType: z.literal("moveStructureChild"), payload: MoveStructureChildPayloadSchema }),
  z.object({ operationType: z.literal("setDrawablePart"), payload: SetDrawablePartPayloadSchema }),
  z.object({ operationType: z.literal("setDrawableTexture"), payload: SetDrawableTexturePayloadSchema }),
  z.object({ operationType: z.literal("generateMesh"), payload: GenerateMeshPayloadSchema }),
  z.object({ operationType: z.literal("moveMeshVertex"), payload: MoveMeshVertexPayloadSchema }),
  z.object({ operationType: z.literal("addMeshVertex"), payload: AddMeshVertexPayloadSchema }),
  z.object({ operationType: z.literal("removeMeshVertex"), payload: RemoveMeshVertexPayloadSchema }),
  z.object({ operationType: z.literal("addMeshTriangle"), payload: AddMeshTrianglePayloadSchema }),
  z.object({ operationType: z.literal("removeMeshTriangle"), payload: RemoveMeshTrianglePayloadSchema }),
  z.object({ operationType: z.literal("moveMeshUvPoint"), payload: MoveMeshUvPointPayloadSchema }),
  z.object({ operationType: z.literal("createParameter"), payload: CreateParameterPayloadSchema }),
  z.object({ operationType: z.literal("updateParameter"), payload: UpdateParameterPayloadSchema }),
  z.object({ operationType: z.literal("deleteParameter"), payload: DeleteParameterPayloadSchema }),
  z.object({ operationType: z.literal("addKeyform"), payload: AddKeyformPayloadSchema }),
  z.object({ operationType: z.literal("editKeyformKey"), payload: EditKeyformKeyPayloadSchema }),
  z.object({ operationType: z.literal("addKeyformGrid2d"), payload: AddKeyformGrid2dPayloadSchema }),
  z.object({ operationType: z.literal("createDynamicsGroup"), payload: CreateDynamicsGroupPayloadSchema }),
  z.object({ operationType: z.literal("updateDynamicsGroup"), payload: UpdateDynamicsGroupPayloadSchema }),
  z.object({ operationType: z.literal("deleteDynamicsGroup"), payload: DeleteDynamicsGroupPayloadSchema }),
  z.object({
    operationType: z.literal("createRotation2dRigControl"),
    payload: CreateRotation2dRigControlPayloadSchema
  }),
  z.object({
    operationType: z.literal("createWarpLattice2dRigControl"),
    payload: CreateWarpLattice2dRigControlPayloadSchema
  }),
  z.object({
    operationType: z.literal("createWarpDeformer"),
    payload: CreateWarpDeformerPayloadSchema
  }),
  z.object({ operationType: z.literal("bindRigControlChild"), payload: BindRigControlChildPayloadSchema }),
  z.object({
    operationType: z.literal("moveDrawableRigControlBinding"),
    payload: MoveDrawableRigControlBindingPayloadSchema
  }),
  z.object({
    operationType: z.literal("reparentRigControl"),
    payload: ReparentRigControlPayloadSchema
  }),
  z.object({
    operationType: z.literal("updateRigControl"),
    payload: UpdateRigControlPayloadSchema
  }),
  z.object({ operationType: z.literal("setMaskRelation"), payload: SetMaskRelationPayloadSchema }),
  z.object({ operationType: z.literal("setDrawOrder"), payload: SetDrawOrderPayloadSchema }),
  z.object({ operationType: z.literal("setRuntimeVisibility"), payload: SetRuntimeVisibilityPayloadSchema }),
  z.object({ operationType: z.literal("setRightsMetadata"), payload: SetRightsMetadataPayloadSchema })
]);
export type OperationPayloadDto = z.infer<typeof OperationPayloadSchema>;
