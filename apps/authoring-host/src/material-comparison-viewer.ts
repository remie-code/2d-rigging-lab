import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { AiMaterialCommand, RenderViewResult } from "@private-2d-rigging-lab/ai-interface";
import type { MaterialCoordinateSidecar, MaterialImageArtifact } from "@private-2d-rigging-lab/contracts";
import { renderSceneToPng } from "@private-2d-rigging-lab/render-software";
import type { LoadedAuthoringPackage } from "./package-directory-io.js";
import type { LoadedMaterialCandidate } from "./material-candidate-store.js";
import { renderMaterialPlacementPreview } from "./material-placement-preview.js";
import { createMaterialRestScene } from "./material-render-context.js";
import { materialRestPose, materialSoftwareView, materialViewportMapping, writeMaterialArtifact } from "./material-render-artifact.js";
import { writeRenderView } from "./perception/render-view-file-output.js";
import { MaterialHostError } from "./material-host-error.js";

type Preview = Extract<AiMaterialCommand, { command: "previewMaterialCandidate" }>["payload"];
export const previewMaterialComparison = async (input: { payload: Preview; loaded: LoadedMaterialCandidate; base: LoadedAuthoringPackage; baseDirectory: string; artifactDirectory: string }) => {
  const { candidate } = input.loaded, { viewport } = input.payload;
  const common = { basePackageDirectory: input.baseDirectory, artifactDirectory: input.artifactDirectory };
  const mapping = materialViewportMapping(viewport);
  let preview: { artifact: MaterialImageArtifact; sidecar: MaterialCoordinateSidecar };
  let evaluatedRender: RenderViewResult | undefined, baseEvaluatedRender: RenderViewResult | undefined;
  let basePng: Uint8Array;
  if (input.payload.mode === "placement") {
    if (Object.keys(input.payload.parameterOverrides).length || input.payload.variantSelections !== undefined) throw new MaterialHostError("placement-rest-only", "Placement preview uses undeformed rest; select working mode to evaluate a pose.");
    preview = await renderMaterialPlacementPreview({ ...common, session: input.base.session, candidate, image: input.loaded.image, viewport });
    basePng = renderSceneToPng(createMaterialRestScene(input.base.session), materialSoftwareView(viewport)).png;
  } else {
    if (!input.loaded.workingPackage || !("workingPackage" in candidate) || !candidate.workingPackage) throw new MaterialHostError("missing-working-package", "Working preview requires a built candidate.");
    const renderPayload = { parameterOverrides: input.payload.parameterOverrides, variantSelections: input.payload.variantSelections,
      view: { kind: "stageViewport" as const, stageViewport: materialSoftwareView(viewport).stageViewport }, outputWidth: viewport.outputWidth,
      outputHeight: viewport.outputHeight, outDir: input.artifactDirectory, outputName: `evaluation-${randomUUID()}` };
    evaluatedRender = await writeRenderView({ session: input.loaded.workingPackage.session, packagePath: input.loaded.workingPackageDirectory!, payload: renderPayload });
    const baseParameters = new Set(input.base.session.graph.parameters.map(p => p.parameterId));
    baseEvaluatedRender = await writeRenderView({ session: input.base.session, packagePath: input.baseDirectory,
      payload: { ...renderPayload, outputName: `base-evaluation-${randomUUID()}`, parameterOverrides: Object.fromEntries(Object.entries(renderPayload.parameterOverrides).filter(([id]) => baseParameters.has(id as never))) } });
    basePng = await readFile(baseEvaluatedRender.pngPath);
    const sidecar: MaterialCoordinateSidecar = { schemaVersion: "material-coordinate-sidecar-v1", kind: "working-mesh-rig-preview", candidateId: candidate.candidateId,
      candidateRevision: candidate.candidateRevision, packageVersion: candidate.basePackage, workingPackage: candidate.workingPackage,
      viewport, imageToStage: mapping, materialPlacement: candidate.placement, restPose: materialRestPose, coverage: "evaluated-mesh" };
    preview = { sidecar, artifact: await writeMaterialArtifact({ ...common, sidecar, png: await readFile(evaluatedRender.pngPath) }) };
  }
  const baseArtifact = await writeMaterialArtifact({ ...common, png: basePng, sidecar: { schemaVersion: "material-coordinate-sidecar-v1", kind: "context-composite", packageVersion: candidate.basePackage, viewport, imageToStage: mapping, restPose: materialRestPose, coverage: "evaluated-mesh" } });
  const comparisonAbsolutePath = join(input.artifactDirectory, `comparison-${randomUUID()}.html`);
  const encoded = await Promise.all([baseArtifact, preview.artifact].map(async artifact => (await readFile(artifact.imageAbsolutePath)).toString("base64")));
  const metadata = JSON.stringify({ candidateId: candidate.candidateId, candidateRevision: candidate.candidateRevision, basePackage: candidate.basePackage,
    mode: input.payload.mode, viewport, materialRestPose: candidate.restPose, evaluatedRender, baseEvaluatedRender }, null, 2);
  const escape = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  await writeFile(comparisonAbsolutePath, `<!doctype html><meta charset="utf-8"><title>Material comparison</title><style>body{font:16px system-ui;background:#20242b;color:white;margin:24px}button{padding:10px;margin-right:8px}img{display:block;max-width:100%;image-rendering:pixelated;background:repeating-conic-gradient(#666 0% 25%,#999 0% 50%) 0/16px 16px}pre{white-space:pre-wrap}</style><h1>Material comparison</h1><p>${escape(input.payload.mode === "placement" ? "Full alpha placement at material rest" : "Evaluated working mesh and rig")}</p><button id="base">Base</button><button id="candidate">Candidate</button><span id="label">Base</span><div>${encoded.map((data, i) => `<img id="image${i}" ${i ? "hidden style='display:none'" : ""} width="${viewport.outputWidth}" height="${viewport.outputHeight}" src="data:image/png;base64,${data}">`).join("")}</div><p>Switch at the same viewport and scale. Material rest metadata describes the input artwork; evaluated pose details are below.</p><pre>${escape(metadata)}</pre><script>function show(n){for(let i=0;i<2;i++)document.getElementById('image'+i).style.display=i===n?'block':'none';document.getElementById('label').textContent=n?'Candidate':'Base'}document.getElementById('base').onclick=()=>show(0);document.getElementById('candidate').onclick=()=>show(1);</script>`);
  return { preview, artifacts: [baseArtifact, preview.artifact], comparisonAbsolutePath,
    ...(evaluatedRender ? { evaluatedRender } : {}), ...(baseEvaluatedRender ? { baseEvaluatedRender } : {}) };
};
