import {
  DrawableIdSchema,
  DynamicsGroupIdSchema,
  KeyformSetIdSchema,
  MaskRelationIdSchema,
  MeshIdSchema,
  OperationIdSchema,
  ParameterIdSchema,
  PartIdSchema,
  ProvenanceIdSchema,
  RigControlIdSchema,
  TextureIdSchema,
  TransactionIdSchema
} from "@private-2d-rigging-lab/contracts";
import type {
  DrawableId,
  DynamicsGroupId,
  KeyformSetId,
  MaskRelationId,
  MeshId,
  OperationId,
  ParameterId,
  PartId,
  ProvenanceId,
  RigControlId,
  TextureId,
  TransactionId
} from "@private-2d-rigging-lab/contracts";

import type { OperationRequestDto } from "./operation-request.js";

export const resolveOperationId = (request: OperationRequestDto): OperationId =>
  request.operationId ?? OperationIdSchema.parse(`op_${operationToken(request)}`);

export const createTransactionId = (operationId: OperationId): TransactionId =>
  TransactionIdSchema.parse(`txn_${stripIdPrefix(operationId, "op_")}`);

export const createProvenanceId = (operationId: OperationId): ProvenanceId =>
  ProvenanceIdSchema.parse(`prov_${stripIdPrefix(operationId, "op_")}`);

export const createParameterIdFromDisplayName = (displayName: string): ParameterId =>
  ParameterIdSchema.parse(`param_${sanitizeIdToken(displayName)}`);

export const createPartIdFromDisplayName = (displayName: string): PartId =>
  PartIdSchema.parse(`part_${sanitizeIdToken(displayName)}`);

export const createDrawableIdFromDisplayName = (displayName: string): DrawableId =>
  DrawableIdSchema.parse(`draw_${sanitizeIdToken(displayName)}`);

export const createDynamicsGroupIdFromDisplayName = (displayName: string): DynamicsGroupId =>
  DynamicsGroupIdSchema.parse(`dyn_${sanitizeIdToken(displayName)}`);

export const createRigControlIdFromDisplayName = (displayName: string): RigControlId =>
  RigControlIdSchema.parse(`rig_${sanitizeIdToken(displayName)}`);

export const createMaskRelationIdFromDrawableIds = (
  maskDrawableIds: readonly DrawableId[],
  targetDrawableIds: readonly DrawableId[]
): MaskRelationId =>
  MaskRelationIdSchema.parse(
    `maskrel_mask_${maskDrawableIds
      .map((drawableId) => stripIdPrefix(drawableId, "draw_"))
      .sort()
      .map(sanitizeIdToken)
      .join("_and_")}_target_${targetDrawableIds
      .map((drawableId) => stripIdPrefix(drawableId, "draw_"))
      .sort()
      .map(sanitizeIdToken)
      .join("_and_")}`
  );

export const createDynamicsDriverId = (
  dynamicsGroupId: DynamicsGroupId,
  parameterId: ParameterId
): string => `driver_${stripIdPrefix(dynamicsGroupId, "dyn_")}_${stripIdPrefix(parameterId, "param_")}`;

export const createDynamicsOutputId = (
  dynamicsGroupId: DynamicsGroupId,
  parameterId: ParameterId
): string => `output_${stripIdPrefix(dynamicsGroupId, "dyn_")}_${stripIdPrefix(parameterId, "param_")}`;

export const createMeshIdFromDrawableId = (drawableId: DrawableId): MeshId =>
  MeshIdSchema.parse(`mesh_${stripIdPrefix(drawableId, "draw_")}`);

export const createTextureIdFromDrawableId = (drawableId: DrawableId): TextureId =>
  TextureIdSchema.parse(`tex_${stripIdPrefix(drawableId, "draw_")}`);

export const createKeyformSetIdFromOperationRequest = (request: OperationRequestDto): KeyformSetId => {
  if (request.operationType === "addKeyform") {
    return KeyformSetIdSchema.parse(
      `keyset_${[
        request.payload.target.kind,
        request.payload.target.id,
        request.payload.targetProperty,
        stripIdPrefix(request.payload.parameterId, "param_"),
        numberToken(request.payload.keyValue)
      ].map(sanitizeIdToken).join("_")}`
    );
  }

  if (request.operationType === "addKeyformGrid2d") {
    return KeyformSetIdSchema.parse(
      `keyset_${[
        "grid",
        request.payload.target.kind,
        request.payload.target.id,
        request.payload.targetProperty,
        stripIdPrefix(request.payload.parameterX, "param_"),
        stripIdPrefix(request.payload.parameterY, "param_")
      ].map(sanitizeIdToken).join("_")}`
    );
  }

  throw new Error(`Cannot create keyform set id for ${request.operationType}.`);
};

const operationToken = (request: OperationRequestDto): string => {
  if (request.operationType === "createParameter") {
    return `create_parameter_${sanitizeIdToken(
      request.payload.parameterId?.replace(/^param_/, "") ?? request.payload.displayName
    )}`;
  }

  if (request.operationType === "createDrawable") {
    return `create_drawable_${sanitizeIdToken(request.payload.displayName)}`;
  }

  if (request.operationType === "importPsdLayerMaterialization") {
    return `import_psd_layer_materialization_${sanitizeIdToken(
      request.payload.materialization.sourceLayerRef.sourceLayerId
    )}`;
  }

  if (request.operationType === "createPart") {
    return `create_part_${sanitizeIdToken(
      request.payload.partId?.replace(/^part_/, "") ?? request.payload.displayName
    )}`;
  }

  if (request.operationType === "updatePart") {
    return `update_part_${sanitizeIdToken(stripIdPrefix(request.payload.partId, "part_"))}`;
  }

  if (request.operationType === "deletePart") {
    return `delete_part_${sanitizeIdToken(stripIdPrefix(request.payload.partId, "part_"))}`;
  }

  if (request.operationType === "setDrawablePart") {
    return `set_drawable_part_${[
      stripIdPrefix(request.payload.drawableId, "draw_"),
      stripIdPrefix(request.payload.partId, "part_")
    ].map(sanitizeIdToken).join("_")}`;
  }

  if (request.operationType === "setDrawableTexture") {
    return `set_drawable_texture_${[
      stripIdPrefix(request.payload.drawableId, "draw_"),
      stripIdPrefix(request.payload.textureId, "tex_")
    ].map(sanitizeIdToken).join("_")}`;
  }

  if (request.operationType === "createRotation2dRigControl") {
    return `create_rotation2d_rig_control_${sanitizeIdToken(request.payload.displayName)}`;
  }

  if (request.operationType === "createWarpLattice2dRigControl") {
    return `create_warp_lattice2d_rig_control_${sanitizeIdToken(request.payload.displayName)}`;
  }

  if (request.operationType === "generateMesh") {
    return `generate_mesh_${[
      stripIdPrefix(request.payload.drawableId, "draw_"),
      request.payload.method,
      request.payload.densityHint ?? "default"
    ].map(sanitizeIdToken).join("_")}`;
  }

  if (request.operationType === "addKeyform" || request.operationType === "addKeyformGrid2d") {
    return `add_keyform_${stripIdPrefix(createKeyformSetIdFromOperationRequest(request), "keyset_")}`;
  }

  return sanitizeIdToken(request.operationType);
};

const stripIdPrefix = (id: string, prefix: string): string =>
  id.startsWith(prefix) ? id.slice(prefix.length) : sanitizeIdToken(id);

const sanitizeIdToken = (value: string): string => {
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "_").replace(/^_+|_+$/g, "");
  return normalized.length > 0 ? normalized : "unnamed";
};

const numberToken = (value: number): string =>
  Number.isInteger(value) ? String(value) : value.toString().replace("-", "minus_").replace(".", "_");
