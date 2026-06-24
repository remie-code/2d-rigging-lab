import type {
  DrawOrderEntryDto,
  DrawableDto,
  DynamicsGroupDto,
  KeyformSetDto,
  MaskRelationDto,
  MeshDto,
  ModelGraphDto,
  ModelPartDto,
  PackageDocumentDto,
  ParameterDto,
  ProvenanceRecordDto,
  RigControlDto,
  RightsRecordDto,
  SourceAssetDto,
  TextureAtlasFileDto,
  VariantGroupDto
} from "@private-2d-rigging-lab/package-format";

export interface AuthoringGraph {
  coordinateSystem: ModelGraphDto["coordinateSystem"];
  canvasSize: ModelGraphDto["canvasSize"];
  parts: ModelPartDto[];
  drawables: DrawableDto[];
  meshes: MeshDto[];
  parameters: ParameterDto[];
  keyformSets: KeyformSetDto[];
  rigControls: RigControlDto[];
  dynamicsGroups: DynamicsGroupDto[];
  masks: MaskRelationDto[];
  drawOrder: DrawOrderEntryDto[];
  variantGroups?: VariantGroupDto[];
  rigControlRootIds: ModelGraphDto["rigControlRootIds"];
  stableOrder: string[];
  sourceAssets: SourceAssetDto[];
  textureAtlas?: TextureAtlasFileDto;
  provenanceRecords: ProvenanceRecordDto[];
  rightsRecords: RightsRecordDto[];
}

export const createAuthoringGraphFromPackageDocument = (
  packageDocument: PackageDocumentDto
): AuthoringGraph => ({
  coordinateSystem: packageDocument.model.graph.coordinateSystem,
  canvasSize: cloneDto(packageDocument.model.graph.canvasSize),
  parts: cloneDto(packageDocument.model.graph.parts),
  drawables: cloneDto(packageDocument.model.drawables.drawables),
  meshes: cloneDto(packageDocument.model.meshes.meshes),
  parameters: cloneDto(packageDocument.model.parameters.parameters),
  keyformSets: cloneDto(packageDocument.model.keyforms.keyformSets),
  rigControls: cloneDto(packageDocument.model.rigControls.rigControls),
  dynamicsGroups: cloneDto(packageDocument.model.dynamics.dynamicsGroups),
  masks: cloneDto(packageDocument.model.masks.masks),
  drawOrder: cloneDto(packageDocument.model.drawOrder.entries),
  variantGroups: cloneDto(packageDocument.model.variants?.variantGroups ?? []),
  rigControlRootIds: cloneDto(packageDocument.model.graph.rigControlRootIds),
  stableOrder: cloneDto(packageDocument.model.graph.stableOrder),
  sourceAssets: cloneDto(packageDocument.assets.sourceManifest.sourceAssets),
  ...(packageDocument.assets.textureAtlas === undefined
    ? {}
    : { textureAtlas: cloneDto(packageDocument.assets.textureAtlas) }),
  provenanceRecords: cloneDto(packageDocument.assets.provenance.records),
  rightsRecords: cloneDto(packageDocument.assets.rights.records)
});

export const cloneAuthoringGraph = (graph: AuthoringGraph): AuthoringGraph => cloneDto(graph);

const cloneDto = <TValue>(value: TValue): TValue => structuredClone(value);
