import type {
  DrawableId,
  DynamicsGroupId,
  KeyformSetId,
  MaskRelationId,
  MeshId,
  MeshTopologyRevisionDto,
  PartId,
  ParameterId,
  RectDto,
  RigControlId,
  TriangleId,
  Vec2Dto
} from "@private-2d-rigging-lab/contracts";

import type { NormalizedDrawableTextureReference } from "./texture-projection.js";

export interface NormalizedRuntimeGraph {
  readonly packageId: string;
  readonly packageRevision: number;
  readonly packageHash?: string;
  readonly coordinateSystem: "canvas-y-down-v1";
  readonly parameters: ReadonlyMap<ParameterId, NormalizedParameter>;
  readonly parts?: ReadonlyMap<PartId, NormalizedPart>;
  readonly dynamicsGroups: ReadonlyMap<DynamicsGroupId, NormalizedDynamicsGroup>;
  readonly drawables: ReadonlyMap<DrawableId, NormalizedDrawable>;
  readonly rigControls: ReadonlyMap<RigControlId, NormalizedRigControlNode>;
  readonly keyformBindings: readonly KeyformBinding[];
  readonly masks: readonly NormalizedMaskRelation[];
  readonly drawOrder: readonly NormalizedDrawOrderEntry[];
  readonly disabledFutureLayers: readonly DisabledFutureLayer[];
}

export interface NormalizedPart {
  readonly partId: PartId;
  readonly displayName: string;
  readonly parentPartId?: PartId;
  readonly childPartIds: readonly PartId[];
  readonly drawableIds: readonly DrawableId[];
}

export interface NormalizedParameter {
  readonly id: ParameterId;
  readonly displayName: string;
  readonly semanticRole?: "eye" | "brow" | "mouth" | "face" | "body" | "arm" | "hair" | "dynamics" | "custom";
  readonly projectPresetAlias?: string;
  readonly valueSource: "authoredInput" | "computedDynamics" | "debugOverride";
  readonly min: number;
  readonly max: number;
  readonly default: number;
}

export interface NormalizedDynamicsGroup {
  readonly dynamicsGroupId: DynamicsGroupId;
  readonly displayName: string;
  readonly enabled: boolean;
  readonly solverKind: "scalarDampedFollowV1";
  readonly drivers: readonly NormalizedDynamicsDriver[];
  readonly output: NormalizedDynamicsOutput;
  readonly settings: NormalizedDynamicsSettings;
  readonly resetPolicy: "reset-on-load" | "reset-on-manual-command" | "reset-on-large-input-jump";
}

export interface NormalizedDynamicsDriver {
  readonly driverId: string;
  readonly sourceParameterId: ParameterId;
  readonly inputScale: number;
  readonly inputOffset: number;
  readonly invert: boolean;
}

export interface NormalizedDynamicsOutput {
  readonly outputId: string;
  readonly targetParameterId: ParameterId;
  readonly outputScale: number;
  readonly outputOffset: number;
  readonly min: number;
  readonly max: number;
  readonly clampPolicy: "clamp-to-output-range";
}

export interface NormalizedDynamicsSettings {
  readonly stiffness: number;
  readonly damping: number;
  readonly maxVelocity?: number;
  readonly maxAmplitude?: number;
}

export interface NormalizedDrawable {
  readonly drawableId: DrawableId;
  readonly meshId: MeshId;
  readonly partId?: PartId;
  readonly texture?: NormalizedDrawableTextureReference;
  readonly visible: boolean;
  readonly opacity: number;
  readonly baseDrawOrder: number;
  readonly bounds: RectDto;
  readonly vertices?: readonly Vec2Dto[];
  readonly uvs?: readonly Vec2Dto[];
  readonly triangles?: readonly NormalizedMeshTriangle[];
  readonly vertexStableIds?: readonly string[];
  readonly triangleStableIds?: readonly TriangleId[];
  readonly topologyRevision?: MeshTopologyRevisionDto;
  readonly vertexCount: number;
  readonly vertexHash?: string;
}

export type NormalizedMeshTriangle = readonly [number, number, number];

export interface NormalizedDrawOrderEntry {
  readonly drawableId: DrawableId;
  readonly drawOrder: number;
}

export interface NormalizedMaskRelation {
  readonly maskRelationId: MaskRelationId | string;
  readonly sourceDrawableIds: readonly DrawableId[];
  readonly targetDrawableIds: readonly DrawableId[];
}

export interface DisabledFutureLayer {
  readonly layerId: string;
  readonly reason: string;
}

export type KeyformBinding = Linear1dKeyformBinding | ParameterGrid2dKeyformBinding;

export interface Linear1dKeyformBinding {
  readonly evaluator: "linear-1d-v1";
  readonly keyformSetId: KeyformSetId;
  readonly targetId: string;
  readonly targetKind: "mesh" | "rigControl" | "drawable";
  readonly targetProperty: string;
  readonly parameterId: ParameterId;
  readonly keys: readonly OneAxisKey[];
  readonly compositionMode: "replace" | "additiveDelta" | "multiplyOpacity";
  readonly compositionOrder: number;
}

export interface ParameterGrid2dKeyformBinding {
  readonly evaluator: "parameter-grid-2d-v1";
  readonly keyformSetId: KeyformSetId;
  readonly targetId: string;
  readonly targetKind: "mesh" | "rigControl" | "drawable";
  readonly targetProperty: string;
  readonly parameterX: ParameterId;
  readonly parameterY: ParameterId;
  readonly interpolation: "bilinear-grid-v1";
  readonly clampPolicy: "clamp-to-parameter-range";
  readonly missingKeyPolicy: "diagnostic-error";
  readonly keys: readonly Grid2dKey[];
  readonly compositionMode: "replace" | "additiveDelta";
  readonly compositionOrder: number;
}

export interface OneAxisKey {
  readonly value: number;
  readonly statePatch: unknown;
}

export interface Grid2dKey {
  readonly x: number;
  readonly y: number;
  readonly statePatch: unknown;
}

export type NormalizedRigControlNode = NormalizedRotation2dRigControl | NormalizedWarpLattice2dRigControl;

export interface NormalizedRotation2dRigControl {
  readonly kind: "rotation2d";
  readonly rigControlId: RigControlId;
  readonly parentId?: RigControlId;
  readonly childDrawableIds: readonly DrawableId[];
  readonly childRigControlIds: readonly RigControlId[];
  readonly pivot: Vec2Dto;
  readonly restAngleDegrees: number;
  readonly restTranslation: Vec2Dto;
  readonly restScale: Vec2Dto;
  readonly enabled: boolean;
}

export interface NormalizedWarpLattice2dRigControl {
  readonly kind: "warpLattice2d";
  readonly rigControlId: RigControlId;
  readonly parentId?: RigControlId;
  readonly childDrawableIds: readonly DrawableId[];
  readonly childRigControlIds: readonly RigControlId[];
  readonly bindSpace: "rigControlLocalRest";
  readonly domainBounds: RectDto;
  readonly latticeColumns: number;
  readonly latticeRows: number;
  readonly restControlPoints: readonly Vec2Dto[];
  readonly interpolationMethod: "bilinear-grid-v1";
  readonly enabled: boolean;
}
