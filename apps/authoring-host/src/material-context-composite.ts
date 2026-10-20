import type { AuthoringSession } from "@private-2d-rigging-lab/authoring-core";
import type { MaterialCoordinateSidecar, MaterialImageArtifact } from "@private-2d-rigging-lab/contracts";
import type { RenderScene } from "@private-2d-rigging-lab/render-core";
import { renderSceneToPng } from "@private-2d-rigging-lab/render-software";
import { createMaterialRestScene } from "./material-render-context.js";
import { materialRestPose, materialSessionPackageRef, materialSoftwareView, materialViewportMapping, writeMaterialArtifact, type MaterialViewport } from "./material-render-artifact.js";

export interface WriteMaterialContextCompositeInput {
  readonly session: AuthoringSession;
  readonly viewport: MaterialViewport;
  readonly packageDirectory: string;
  readonly artifactDirectory: string;
  /** The session's rest scene when the caller already built it. */
  readonly scene?: RenderScene;
}

/** Renders the saved package at undeformed rest in a fixed viewport, the "before" image for material comparisons. */
export const writeMaterialContextComposite = async (input: WriteMaterialContextCompositeInput): Promise<{ artifact: MaterialImageArtifact; sidecar: MaterialCoordinateSidecar }> => {
  const sidecar: MaterialCoordinateSidecar = { schemaVersion: "material-coordinate-sidecar-v1", kind: "context-composite",
    packageRef: materialSessionPackageRef(input.session), viewport: input.viewport, imageToStage: materialViewportMapping(input.viewport),
    restPose: materialRestPose, coverage: "evaluated-mesh" };
  const scene = input.scene ?? createMaterialRestScene(input.session);
  const artifact = await writeMaterialArtifact({ packageDirectory: input.packageDirectory, artifactDirectory: input.artifactDirectory,
    png: renderSceneToPng(scene, materialSoftwareView(input.viewport)).png, sidecar });
  return { artifact, sidecar };
};
