import type { AuthoringSession } from "@private-2d-rigging-lab/authoring-core";
import type { OperationId } from "@private-2d-rigging-lab/contracts";

import type { OperationRequestDto } from "./operation-request.js";
import type { OperationResultDto } from "./operation-result.js";
import type { OperationType } from "./operation-type.js";
import { addKeyformOperationHandler } from "./operations/add-keyform.js";
import { addKeyformGrid2dOperationHandler } from "./operations/add-keyform-grid2d.js";
import { bindRigControlChildOperationHandler } from "./operations/bind-rig-control-child.js";
import { createDrawableOperationHandler } from "./operations/create-drawable.js";
import { createDynamicsGroupOperationHandler } from "./operations/create-dynamics-group.js";
import { createPartOperationHandler } from "./operations/create-part.js";
import { createParameterOperationHandler } from "./operations/create-parameter.js";
import { createRotation2dRigControlOperationHandler } from "./operations/create-rotation2d-rig-control.js";
import { createWarpLattice2dRigControlOperationHandler } from "./operations/create-warp-lattice2d-rig-control.js";
import { deletePartOperationHandler } from "./operations/delete-part.js";
import { generateMeshOperationHandler } from "./operations/generate-mesh.js";
import { importPsdLayerMaterializationBatchOperationHandler } from "./operations/import-psd-layer-materialization-batch.js";
import { importPsdLayerMaterializationOperationHandler } from "./operations/import-psd-layer-materialization.js";
import { importPsdSourceAssetOperationHandler } from "./operations/import-psd-source-asset.js";
import { importPsdStructuralScaffoldOperationHandler } from "./operations/import-psd-structural-scaffold.js";
import { importSplitPngSourceAssetOperationHandler } from "./operations/import-split-png-source-asset.js";
import {
  addMeshTriangleOperationHandler,
  addMeshVertexOperationHandler,
  moveMeshUvPointOperationHandler,
  removeMeshTriangleOperationHandler,
  removeMeshVertexOperationHandler
} from "./operations/mesh-topology.js";
import { moveMeshVertexOperationHandler } from "./operations/move-mesh-vertex.js";
import { setDrawOrderOperationHandler } from "./operations/set-draw-order.js";
import { setDrawablePartOperationHandler } from "./operations/set-drawable-part.js";
import { setDrawableTextureOperationHandler } from "./operations/set-drawable-texture.js";
import { setMaskRelationOperationHandler } from "./operations/set-mask-relation.js";
import { setRightsMetadataOperationHandler } from "./operations/set-rights-metadata.js";
import { setRuntimeVisibilityOperationHandler } from "./operations/set-runtime-visibility.js";
import { updatePartOperationHandler } from "./operations/update-part.js";
import { updateDynamicsGroupOperationHandler } from "./operations/update-dynamics-group.js";

export interface OperationApplyOutcome {
  readonly result: OperationResultDto;
  readonly targetIds: readonly string[];
  readonly candidateSession: AuthoringSession;
}

export interface OperationHandler {
  readonly operationType: OperationType;
  dryRun(
    session: AuthoringSession,
    request: OperationRequestDto,
    operationId: OperationId
  ): OperationApplyOutcome;
  commit(
    session: AuthoringSession,
    request: OperationRequestDto,
    operationId: OperationId
  ): OperationApplyOutcome;
}

export const operationHandlers: ReadonlyMap<OperationType, OperationHandler> = new Map([
  [importPsdSourceAssetOperationHandler.operationType, importPsdSourceAssetOperationHandler],
  [
    importPsdLayerMaterializationOperationHandler.operationType,
    importPsdLayerMaterializationOperationHandler
  ],
  [
    importPsdLayerMaterializationBatchOperationHandler.operationType,
    importPsdLayerMaterializationBatchOperationHandler
  ],
  [
    importPsdStructuralScaffoldOperationHandler.operationType,
    importPsdStructuralScaffoldOperationHandler
  ],
  [importSplitPngSourceAssetOperationHandler.operationType, importSplitPngSourceAssetOperationHandler],
  [createDrawableOperationHandler.operationType, createDrawableOperationHandler],
  [createPartOperationHandler.operationType, createPartOperationHandler],
  [updatePartOperationHandler.operationType, updatePartOperationHandler],
  [deletePartOperationHandler.operationType, deletePartOperationHandler],
  [setDrawablePartOperationHandler.operationType, setDrawablePartOperationHandler],
  [setDrawableTextureOperationHandler.operationType, setDrawableTextureOperationHandler],
  [generateMeshOperationHandler.operationType, generateMeshOperationHandler],
  [moveMeshVertexOperationHandler.operationType, moveMeshVertexOperationHandler],
  [addMeshVertexOperationHandler.operationType, addMeshVertexOperationHandler],
  [removeMeshVertexOperationHandler.operationType, removeMeshVertexOperationHandler],
  [addMeshTriangleOperationHandler.operationType, addMeshTriangleOperationHandler],
  [removeMeshTriangleOperationHandler.operationType, removeMeshTriangleOperationHandler],
  [moveMeshUvPointOperationHandler.operationType, moveMeshUvPointOperationHandler],
  [createParameterOperationHandler.operationType, createParameterOperationHandler],
  [addKeyformOperationHandler.operationType, addKeyformOperationHandler],
  [addKeyformGrid2dOperationHandler.operationType, addKeyformGrid2dOperationHandler],
  [createDynamicsGroupOperationHandler.operationType, createDynamicsGroupOperationHandler],
  [updateDynamicsGroupOperationHandler.operationType, updateDynamicsGroupOperationHandler],
  [createRotation2dRigControlOperationHandler.operationType, createRotation2dRigControlOperationHandler],
  [createWarpLattice2dRigControlOperationHandler.operationType, createWarpLattice2dRigControlOperationHandler],
  [bindRigControlChildOperationHandler.operationType, bindRigControlChildOperationHandler],
  [setMaskRelationOperationHandler.operationType, setMaskRelationOperationHandler],
  [setDrawOrderOperationHandler.operationType, setDrawOrderOperationHandler],
  [setRightsMetadataOperationHandler.operationType, setRightsMetadataOperationHandler],
  [setRuntimeVisibilityOperationHandler.operationType, setRuntimeVisibilityOperationHandler]
]);

export const getOperationHandler = (operationType: OperationType): OperationHandler | undefined =>
  operationHandlers.get(operationType);
