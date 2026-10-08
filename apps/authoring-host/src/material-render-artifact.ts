import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { MaterialCoordinateSidecarSchema, MaterialViewportSchema, MaterialPackageVersionSchema, type MaterialCoordinateSidecar, type MaterialPackageVersion, type MaterialImageArtifact } from "@private-2d-rigging-lab/contracts";
import type { AuthoringSession } from "@private-2d-rigging-lab/authoring-core";
import type { z } from "zod";
import { assertMaterialOutsideBase } from "./material-package-fingerprint.js";
import { MaterialHostError } from "./material-host-error.js";
export type MaterialViewport = z.infer<typeof MaterialViewportSchema>;
export const materialRestPose = { kind: "undeformed-rest", coordinateSystem: "canvas-y-down-v1", keyedDeformation: false, dynamics: false } as const;
export const materialViewportMapping = (viewport:MaterialViewport) => {
  MaterialViewportSchema.parse(viewport);
  const scale=viewport.stageRect.width/viewport.outputWidth;
  if(Math.abs(scale-viewport.stageRect.height/viewport.outputHeight)>1e-9*Math.max(1,scale)) throw new MaterialHostError("nonuniform-viewport","Viewport must have uniform pixels per stage unit.");
  return { from:"source-image-pixel-edge-v1" as const,to:"rest-stage-canvas-y-down-v1" as const,scale,translation:{x:viewport.stageRect.x,y:viewport.stageRect.y} };
};
export const materialSoftwareView = (viewport:MaterialViewport) => {
  materialViewportMapping(viewport);
  return {stageViewport:{minX:viewport.stageRect.x,minY:viewport.stageRect.y,width:viewport.stageRect.width,height:viewport.stageRect.height},outputWidth:viewport.outputWidth,outputHeight:viewport.outputHeight};
};
export const assertMaterialSessionVersion = (session:AuthoringSession,version:MaterialPackageVersion):void => {
  MaterialPackageVersionSchema.parse(version);
  if(session.dirty || session.packageIdentity.packageId!==version.packageId || session.packageRevision!==version.packageRevision) throw new MaterialHostError("session-version-mismatch","Supply a saved read-only session matching the package version.");
};
export const writeMaterialArtifact = async (input:{basePackageDirectory:string;artifactDirectory:string;png:Uint8Array;sidecar:MaterialCoordinateSidecar}):Promise<MaterialImageArtifact> => {
  const sidecar=MaterialCoordinateSidecarSchema.parse(input.sidecar);
  await assertMaterialOutsideBase(input.basePackageDirectory,input.artifactDirectory);
  await mkdir(resolve(input.artifactDirectory),{recursive:true});
  const stem=`${sidecar.kind}-${randomUUID()}`;
  const artifact={kind:sidecar.kind,imageAbsolutePath:join(resolve(input.artifactDirectory),`${stem}.png`),sidecarAbsolutePath:join(resolve(input.artifactDirectory),`${stem}.json`)};
  await writeFile(artifact.imageAbsolutePath,input.png,{flag:"wx"});
  await writeFile(artifact.sidecarAbsolutePath,JSON.stringify(sidecar,null,2),{flag:"wx"}); return artifact;
};
