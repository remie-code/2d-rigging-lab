import { createMaterialCandidateFixture, createMaterialImageFixture, DrawableIdSchema, PartIdSchema,
  type MaterialCandidate, type MaterialNormalizedImage } from "@private-2d-rigging-lab/contracts";
import { ModelGraphSchema, RigControlSchema, KeyformSetSchema, ParameterSchema, type RigControlDto } from "@private-2d-rigging-lab/package-format";
import type { AuthoringSession } from "./authoring-session.js";
import { createInitialAuthoringRevision } from "./authoring-revision.js";
import { buildMaterialCandidate } from "./material-candidate-build.js";

export const emptyMaterialSession = (): AuthoringSession => {
  const candidate = createMaterialCandidateFixture();
  const graph = ModelGraphSchema.parse({ schemaVersion: "model-graph-v1", coordinateSystem: "canvas-y-down-v1",
    canvasSize: { width: 100, height: 100 }, parts: [{ partId: "part_root", displayName: "Root", childPartIds: [], drawableIds: [] }],
    rigControlRootIds: [], stableOrder: [] });
  return { packageIdentity: { packageId: candidate.basePackage.packageId, packageDisplayName: "Material test", formatVersion: "open-model-package-v1" },
    packageRevision: 1, authoringRevision: createInitialAuthoringRevision(), dirty: false,
    graph: { ...graph, drawables: [], meshes: [], parameters: [], keyformSets: [], rigControls: [], dynamicsGroups: [], masks: [], drawOrder: [],
      sourceAssets: [], provenanceRecords: [], rightsRecords: [], variantGroups: [] } };
};
export const addCandidate = (id = "draw_fixture"): MaterialCandidate => ({ ...createMaterialCandidateFixture(), intent: {
  kind: "add", drawableId: DrawableIdSchema.parse(id), displayName: id, parentPartId: PartIdSchema.parse("part_root"),
  insertion: { position: "last" }, rigControlIds: [], maskBindings: [], defaultOpacity: 1, runtimeVisibility: true } });
export const buildWorking = async (session: AuthoringSession, candidate: MaterialCandidate = addCandidate(), image: MaterialNormalizedImage = createMaterialImageFixture().image) => {
  const result = await buildMaterialCandidate(session, candidate, image);
  if (result.status !== "completed") throw new Error(JSON.stringify(result.diagnostics));
  return result;
};
export const materialSession = async () => (await buildWorking(emptyMaterialSession())).workingSession;
export const control = (id: string, children: string[], controls: string[] = []) => RigControlSchema.parse({ kind: "rotation2d", rigControlId: id,
  displayName: id, childDrawableIds: children, childRigControlIds: controls, pivot: { x: 0, y: 0 }, restAngleDegrees: 0,
  restTranslation: { x: 0, y: 0 }, restScale: { x: 1, y: 1 }, enabled: true }) as Extract<RigControlDto, { kind: "rotation2d" }>;
export const parameter = (id: string) => ParameterSchema.parse({ parameterId: id, displayName: id, min: -1, max: 1, default: 0, recommendedUiStep: 0.1 });
export const keyform = (id: string, kind: string, target: string, property = "vertices", param = "param_x") => KeyformSetSchema.parse({
  keyformSetId: id, target: { kind, id: target, property }, parameterId: param, evaluator: "linear-1d-v1", interpolation: "linear-1d-v1",
  compositionMode: "replace", compositionOrder: 0, keys: [{ value: 0, statePatch: property === "vertices" ? [{ x: 0, y: 0 }] : 0 }] });
