import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { MaterialCoordinateSidecarSchema, MaterialPackageRefSchema, MaterialViewportSchema, type MaterialCoordinateSidecar,
  type MaterialImageArtifact, type MaterialPackageRef, type MaterialViewport } from "@private-2d-rigging-lab/contracts";
import type { AuthoringSession } from "@private-2d-rigging-lab/authoring-core";
import { HostError } from "./host-error.js";
import { assertOutsidePackage } from "./package-path-guard.js";

export type { MaterialViewport };
export const materialRestPose = { kind: "undeformed-rest", coordinateSystem: "canvas-y-down-v1", keyedDeformation: false, dynamics: false } as const;
export const materialViewportMapping = (viewport: MaterialViewport) => {
  MaterialViewportSchema.parse(viewport);
  const scale = viewport.stageRect.width / viewport.outputWidth;
  if (Math.abs(scale - viewport.stageRect.height / viewport.outputHeight) > 1e-9 * Math.max(1, scale)) throw new HostError("nonuniform-viewport", "Viewport must have uniform pixels per stage unit.");
  return { from: "source-image-pixel-edge-v1" as const, to: "rest-stage-canvas-y-down-v1" as const, scale, translation: { x: viewport.stageRect.x, y: viewport.stageRect.y } };
};
export const materialSoftwareView = (viewport: MaterialViewport) => {
  materialViewportMapping(viewport);
  return { stageViewport: { minX: viewport.stageRect.x, minY: viewport.stageRect.y, width: viewport.stageRect.width, height: viewport.stageRect.height },
    outputWidth: viewport.outputWidth, outputHeight: viewport.outputHeight };
};
/** The saved package revision a read-only material render describes. A session with unsaved edits has no such revision. */
export const materialSessionPackageRef = (session: AuthoringSession): MaterialPackageRef => {
  if (session.dirty) throw new HostError("session-unsaved", "Material renders read a saved package; the session has unsaved edits.");
  return MaterialPackageRefSchema.parse({ packageId: session.packageIdentity.packageId, packageRevision: session.packageRevision });
};
export const writeMaterialArtifact = async (input: { packageDirectory: string; artifactDirectory: string; png: Uint8Array; sidecar: MaterialCoordinateSidecar }): Promise<MaterialImageArtifact> => {
  const sidecar = MaterialCoordinateSidecarSchema.parse(input.sidecar);
  await assertOutsidePackage(input.packageDirectory, input.artifactDirectory);
  await mkdir(resolve(input.artifactDirectory), { recursive: true });
  const stem = `${sidecar.kind}-${randomUUID()}`;
  const artifact = { kind: sidecar.kind, imageAbsolutePath: join(resolve(input.artifactDirectory), `${stem}.png`), sidecarAbsolutePath: join(resolve(input.artifactDirectory), `${stem}.json`) };
  await writeFile(artifact.imageAbsolutePath, input.png, { flag: "wx" });
  await writeFile(artifact.sidecarAbsolutePath, JSON.stringify(sidecar, null, 2), { flag: "wx" });
  return artifact;
};
