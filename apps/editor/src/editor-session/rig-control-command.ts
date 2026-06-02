import type {
  OperationId,
  ParameterId,
  PartId,
  RectDto,
  RigControlId,
  Vec2Dto
} from "@private-2d-rigging-lab/contracts";
import {
  OperationRequestSchema,
  type OperationRequestDto
} from "@private-2d-rigging-lab/operation-core";

export interface EditorCreateRotation2dRigControlCommand {
  readonly operationId?: OperationId | string;
  readonly displayName: string;
  readonly partId: PartId | string;
  readonly pivot: Vec2Dto;
  readonly restAngleDegrees: number;
  readonly childDrawableIds?: readonly string[];
  readonly childRigControlIds?: readonly string[];
}

export interface EditorCreateWarpLattice2dRigControlCommand {
  readonly operationId?: OperationId | string;
  readonly displayName: string;
  readonly partId: PartId | string;
  readonly domainBounds: RectDto;
  readonly latticeColumns: number;
  readonly latticeRows: number;
  readonly interpolationMethod: "bilinear-grid-v1";
  readonly childDrawableIds?: readonly string[];
  readonly childRigControlIds?: readonly string[];
}

export interface EditorBindRigControlChildCommand {
  readonly operationId?: OperationId | string;
  readonly parentRigControlId: RigControlId | string;
  readonly child: {
    readonly kind: "drawable" | "rigControl";
    readonly id: string;
  };
}

export interface EditorAddRigControlAngleKeyformCommand {
  readonly operationId?: OperationId | string;
  readonly parameterId: ParameterId | string;
  readonly rigControlId: RigControlId | string;
  readonly keyValue: number;
  readonly angleDegrees: number;
}

export interface EditorAddWarpLattice2dControlPointOffsetsKeyformCommand {
  readonly operationId?: OperationId | string;
  readonly parameterId: ParameterId | string;
  readonly rigControlId: RigControlId | string;
  readonly keyValue: number;
  readonly compositionMode?: "replace" | "additiveDelta";
  readonly controlPointOffsets: readonly Vec2Dto[];
}

export const createRotation2dRigControlOperationRequest = (
  command: EditorCreateRotation2dRigControlCommand,
  basePackageRevision: number
): OperationRequestDto =>
  OperationRequestSchema.parse({
    schemaVersion: "operation-request-v1",
    ...(command.operationId === undefined ? {} : { operationId: command.operationId }),
    actor: "human",
    surface: "gui",
    dryRun: false,
    basePackageRevision,
    idempotencyKey: `editor-create-rotation2d-rig-control-${sanitizeIdempotencyToken(command.displayName)}`,
    trace: {
      relatedAC: ["AC-MVP-009", "AC-MVP-010", "AC-MVP-011"],
      relatedScenarios: ["SC-MVP-002", "SC-MVP-003"]
    },
    operationType: "createRotation2dRigControl",
    payload: {
      partId: command.partId,
      displayName: command.displayName,
      childDrawableIds: command.childDrawableIds ?? [],
      childRigControlIds: command.childRigControlIds ?? [],
      pivot: command.pivot,
      restAngleDegrees: command.restAngleDegrees
    }
  });

export const createWarpLattice2dRigControlOperationRequest = (
  command: EditorCreateWarpLattice2dRigControlCommand,
  basePackageRevision: number
): OperationRequestDto =>
  OperationRequestSchema.parse({
    schemaVersion: "operation-request-v1",
    ...(command.operationId === undefined ? {} : { operationId: command.operationId }),
    actor: "human",
    surface: "gui",
    dryRun: false,
    basePackageRevision,
    idempotencyKey: `editor-create-warp-lattice2d-rig-control-${sanitizeIdempotencyToken(command.displayName)}`,
    trace: {
      relatedAC: ["AC-MVP-009", "AC-MVP-010", "AC-MVP-011"],
      relatedScenarios: ["SC-MVP-002", "SC-MVP-003"]
    },
    operationType: "createWarpLattice2dRigControl",
    payload: {
      partId: command.partId,
      displayName: command.displayName,
      childDrawableIds: command.childDrawableIds ?? [],
      childRigControlIds: command.childRigControlIds ?? [],
      domainBounds: command.domainBounds,
      latticeColumns: command.latticeColumns,
      latticeRows: command.latticeRows,
      interpolationMethod: command.interpolationMethod
    }
  });

export const createBindRigControlChildOperationRequest = (
  command: EditorBindRigControlChildCommand,
  basePackageRevision: number
): OperationRequestDto =>
  OperationRequestSchema.parse({
    schemaVersion: "operation-request-v1",
    ...(command.operationId === undefined ? {} : { operationId: command.operationId }),
    actor: "human",
    surface: "gui",
    dryRun: false,
    basePackageRevision,
    idempotencyKey: `editor-bind-rig-control-child-${sanitizeIdempotencyToken(
      `${command.parentRigControlId}-${command.child.kind}-${command.child.id}`
    )}`,
    trace: {
      relatedAC: ["AC-MVP-009", "AC-MVP-010", "AC-MVP-011"],
      relatedScenarios: ["SC-MVP-002", "SC-MVP-003"]
    },
    operationType: "bindRigControlChild",
    payload: {
      parentRigControlId: command.parentRigControlId,
      child: command.child
    }
  });

export const createAddRigControlAngleKeyformOperationRequest = (
  command: EditorAddRigControlAngleKeyformCommand,
  basePackageRevision: number
): OperationRequestDto =>
  OperationRequestSchema.parse({
    schemaVersion: "operation-request-v1",
    ...(command.operationId === undefined ? {} : { operationId: command.operationId }),
    actor: "human",
    surface: "gui",
    dryRun: false,
    basePackageRevision,
    idempotencyKey: `editor-add-rig-control-angle-keyform-${sanitizeIdempotencyToken(
      `${command.rigControlId}-${command.parameterId}-${command.keyValue}`
    )}`,
    trace: {
      relatedAC: ["AC-MVP-008", "AC-MVP-009", "AC-MVP-012"],
      relatedScenarios: ["SC-PARAM-002", "SC-DEF-003"]
    },
    operationType: "addKeyform",
    payload: {
      target: {
        kind: "rigControl",
        id: command.rigControlId
      },
      targetProperty: "angleDegrees",
      parameterId: command.parameterId,
      keyValue: command.keyValue,
      interpolation: "linear-1d-v1",
      statePatch: {
        propertyPath: "angleDegrees",
        value: command.angleDegrees,
        valueSchemaHint: "rigControl.rotation2d.angleDegrees"
      }
    }
  });

export const createAddWarpLattice2dControlPointOffsetsKeyformOperationRequest = (
  command: EditorAddWarpLattice2dControlPointOffsetsKeyformCommand,
  basePackageRevision: number
): OperationRequestDto =>
  OperationRequestSchema.parse({
    schemaVersion: "operation-request-v1",
    ...(command.operationId === undefined ? {} : { operationId: command.operationId }),
    actor: "human",
    surface: "gui",
    dryRun: false,
    basePackageRevision,
    idempotencyKey: `editor-add-warp-lattice2d-control-point-offsets-keyform-${sanitizeIdempotencyToken(
      `${command.rigControlId}-${command.parameterId}-${command.keyValue}`
    )}`,
    trace: {
      relatedAC: ["AC-MVP-008", "AC-MVP-009", "AC-MVP-012"],
      relatedScenarios: ["SC-PARAM-002", "SC-DEF-001", "SC-DEF-003"]
    },
    operationType: "addKeyform",
    payload: {
      target: {
        kind: "rigControl",
        id: command.rigControlId
      },
      targetProperty: "controlPointOffsets",
      parameterId: command.parameterId,
      keyValue: command.keyValue,
      interpolation: "linear-1d-v1",
      compositionMode: command.compositionMode ?? "replace",
      statePatch: {
        propertyPath: "controlPointOffsets",
        value: command.controlPointOffsets,
        valueSchemaHint: "rigControl.warpLattice2d.controlPointOffsets"
      }
    }
  });

const sanitizeIdempotencyToken = (text: string): string =>
  text.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "_").replace(/^_+|_+$/g, "") || "unnamed";
