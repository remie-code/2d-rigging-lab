import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { AiCommandRequestSchema, AiCommandResponseSchema, isMaterialCommandName, materialCommandCapability,
  type AiMaterialCommand, type AiMaterialCommandResult } from "@private-2d-rigging-lab/ai-interface";
import { analyzeMaterialImpact, buildMaterialCandidate } from "@private-2d-rigging-lab/authoring-core";
import { DiagnosticSchema, MaterialCandidateActionSchema, MaterialCandidateSchema, MaterialOperationResultSchema,
  materialPackageVersionsEqual, type MaterialCandidate, type MaterialOperationResult } from "@private-2d-rigging-lab/contracts";
import type { RunAuthoringHostCommandInput } from "./run-authoring-host-command.js";
import type { AuthoringHostCommandResponse } from "./authoring-host-response.js";
import { createMaterialCandidate, loadMaterialCandidate, saveMaterialCandidate, type LoadedMaterialCandidate } from "./material-candidate-store.js";
import { decodeMaterialImage } from "./material-image-decode.js";
import { resolveMaterialPlacement } from "./material-placement.js";
import { extractMaterialSource } from "./material-source-extraction.js";
import { assertMaterialOutsideBase, readMaterialPackageFiles } from "./material-package-fingerprint.js";
import { captureMaterialPackage, serializeMaterialWorking, writeMaterialFiles } from "./material-package-transaction.js";
import { materialRegisteredFields, applyMaterialCandidate } from "./material-candidate-apply.js";
import { runMaterialCandidateOperation } from "./material-candidate-operation.js";
import { previewMaterialComparison } from "./material-comparison-viewer.js";
import { MaterialHostError } from "./material-host-error.js";

export const isMaterialCommand = (command: unknown): boolean => typeof command === "object" && command !== null && isMaterialCommandName((command as { command?: unknown }).command);
const operationNames = { extractMaterialSource: "extract", registerMaterialCandidate: "register", setMaterialPlacement: "place", previewMaterialCandidate: "preview", buildMaterialCandidate: "build", editMaterialCandidate: "edit", approveMaterialCandidate: "approve", applyMaterialCandidate: "apply", discardMaterialCandidate: "discard" } as const;
/** Called under the same package-wide lock as every ordinary host command. */
export const runMaterialCommand = async (input: RunAuthoringHostCommandInput): Promise<AuthoringHostCommandResponse> => {
  const request = AiCommandRequestSchema.parse(input.command);
  if (!isMaterialCommandName(request.command)) throw new Error("Expected material command.");
  const command = request as typeof request & AiMaterialCommand;
  const now = input.now ?? (() => new Date());
  const state = resolve(input.stateDirectory), artifactDirectory = join(state, "material-artifacts");
  await assertMaterialOutsideBase(input.packageDirectory, state);
  const store = { basePackageDirectory: resolve(input.packageDirectory), storeDirectory: join(state, "material-candidates") };
  const observed = await captureMaterialPackage(input.packageDirectory, join(state, "material-snapshots"));
  let loaded: LoadedMaterialCandidate | undefined;
  let extra: Omit<AiMaterialCommandResult, "result"> = {};
  const operation = command.command === "inspectMaterialCandidate" ? undefined : operationNames[command.command];
  const operationId = `op_material_${randomUUID().replaceAll("-", "")}`;
  const response = (result?: MaterialOperationResult, status: "ok" | "rejected" | "failed" | "permission_denied" = "ok"): AuthoringHostCommandResponse => {
    const payload = { ...extra, ...(result ? { result } : {}) };
    const ai = AiCommandResponseSchema.parse({ schemaVersion: "ai-command-response-v1", commandId: request.commandId, command: request.command,
      status, payload, diagnostics: result?.diagnostics ?? [], evidenceRefs: result?.artifacts.flatMap(a => [a.imageAbsolutePath, a.sidecarAbsolutePath]) ?? [] });
    return { schemaVersion: "authoring-host-command-response-v1", command: request.command, commandId: request.commandId,
      outcome: status === "ok" ? "success" : status === "failed" ? "error" : "rejected", aiCommandStatus: status,
      aiCommandResponse: ai, saved: result?.baseChanged ?? false, packageRevision: result?.baseChanged && loaded?.candidate.state === "applied" ? loaded.candidate.appliedPackage.packageRevision : observed.version.packageRevision,
      diagnostics: ai.diagnostics };
  };
  const result = (fields: Partial<MaterialOperationResult> = {}): MaterialOperationResult => MaterialOperationResultSchema.parse({
    schemaVersion: "material-operation-result-v1", operationId, operation, status: "completed", candidateId: loaded?.candidate.candidateId ?? null,
    basePackage: loaded?.candidate.basePackage ?? observed.version, ...(loaded ? { candidate: loaded.candidate } : {}),
    changedTargets: [], baseChanged: false, artifacts: [], diagnostics: [], ...fields
  });
  const markStale = async () => {
    if (!loaded || ["applied", "discarded", "stale"].includes(loaded.candidate.state)) return;
    const latest = await captureMaterialPackage(input.packageDirectory, join(state, "material-snapshots"));
    if (materialPackageVersionsEqual(loaded.candidate.basePackage, latest.version)) return;
    const candidate = MaterialCandidateSchema.parse({ ...materialRegisteredFields(loaded.candidate), state: "stale", observedBasePackage: latest.version,
      ...("workingPackage" in loaded.candidate ? { workingPackage: loaded.candidate.workingPackage } : {}) });
    loaded = await saveMaterialCandidate({ store, candidate, expectedCandidateRevision: candidate.candidateRevision });
  };
  try {
    if (!request.session.capabilities.includes(materialCommandCapability(command.command))) throw new MaterialHostError("permission-denied", "This command requires " + materialCommandCapability(command.command) + ".");
    if (request.basis.packageRevision !== undefined && request.basis.packageRevision !== observed.version.packageRevision) throw new MaterialHostError("basis-stale", "Command basis differs from saved base revision.");
    if (command.command === "extractMaterialSource") {
      const extracted = await extractMaterialSource({ session: observed.loaded.session, packageVersion: observed.version, ...command.payload,
        basePackageDirectory: input.packageDirectory, artifactDirectory });
      return response(result({ sourceContext: extracted.sourceContext, artifacts: extracted.artifacts }));
    }
    if (command.command === "registerMaterialCandidate") {
      const image = decodeMaterialImage({ bytes: await readFile(command.payload.imagePath), ...(command.payload.expectedOriginalFileSha256 ? { expectedOriginalFileSha256: command.payload.expectedOriginalFileSha256 } : {}) });
      const candidate = MaterialCandidateSchema.parse({ schemaVersion: "material-candidate-v1", candidateId: `material_${randomUUID().replaceAll("-", "")}`, candidateRevision: 0,
        state: "registered", basePackage: observed.version, image: image.descriptor, restPose: command.payload.restPose, placement: command.payload.placement,
        intent: command.payload.intent, provenance: { kind: "generated-material", note: command.payload.provenanceNote } });
      await writeMaterialFiles(join(state, "material-bases", candidate.candidateId), observed.files);
      loaded = await createMaterialCandidate({ store, candidate, image });
      return response(result());
    }
    loaded = await loadMaterialCandidate({ store, candidateId: command.payload.candidateId });
    if (command.command === "inspectMaterialCandidate") { extra = { candidate: loaded.candidate }; return response(); }
    if (loaded.workingPackageDirectory && "workingPackage" in loaded.candidate && loaded.candidate.workingPackage) {
      const workingSnapshot = await captureMaterialPackage(loaded.workingPackageDirectory, join(state, "material-snapshots"));
      if (!materialPackageVersionsEqual(workingSnapshot.version, loaded.candidate.workingPackage)) throw new MaterialHostError("working-hash-mismatch", "Working snapshot differs from candidate version.");
      loaded = { ...loaded, workingPackageDirectory: workingSnapshot.directory, workingPackage: workingSnapshot.loaded };
    }
    if (command.command === "previewMaterialCandidate") {
      const baseDirectory = join(state, "material-bases", loaded.candidate.candidateId);
      const baseSnapshot = await captureMaterialPackage(baseDirectory, join(state, "material-snapshots"));
      if (!materialPackageVersionsEqual(baseSnapshot.version, loaded.candidate.basePackage)) throw new MaterialHostError("base-snapshot-changed", "Original candidate snapshot changed.");
      const comparison = await previewMaterialComparison({ payload: command.payload, loaded, base: baseSnapshot.loaded, baseDirectory: baseSnapshot.directory, artifactDirectory });
      extra = { comparisonAbsolutePath: comparison.comparisonAbsolutePath, ...(comparison.evaluatedRender ? { evaluatedRender: comparison.evaluatedRender } : {}), ...(comparison.baseEvaluatedRender ? { baseEvaluatedRender: comparison.baseEvaluatedRender } : {}) };
      return response(result({ artifacts: comparison.artifacts, previewContext: comparison.preview }));
    }
    if (command.command !== "discardMaterialCandidate" && !materialPackageVersionsEqual(loaded.candidate.basePackage, observed.version)) {
      await markStale(); throw new MaterialHostError("base-stale", "Base package changed; candidate retained for inspection or discard.");
    }
    MaterialCandidateActionSchema.parse({ candidate: loaded.candidate, action: operation, expectedCandidateRevision: command.payload.expectedCandidateRevision, observedBasePackage: observed.version });
    const previous = loaded.candidate, common = materialRegisteredFields(previous);
    const persist = async (candidate: MaterialCandidate, workingFiles?: Awaited<ReturnType<typeof readMaterialPackageFiles>>) => {
      loaded = await saveMaterialCandidate({ store, candidate, expectedCandidateRevision: previous.candidateRevision, ...(workingFiles ? { workingFiles } : {}) });
    };
    if (command.command === "setMaterialPlacement") {
      const alignment = resolveMaterialPlacement(command.payload.alignment);
      await persist(MaterialCandidateSchema.parse({ ...common, state: "registered", candidateRevision: previous.candidateRevision + 1, placement: alignment.placement }));
      extra = alignment.fitEvidence ? { fitEvidence: alignment.fitEvidence } : {};
    } else if (command.command === "buildMaterialCandidate") {
      const built = await buildMaterialCandidate(observed.loaded.session, previous, loaded.image);
      if (built.status !== "completed") return response(result({ status: "rejected", diagnostics: built.diagnostics, ...(built.impact ? { impact: built.impact } : {}) }), "rejected");
      built.workingSession.packageRevision = Math.max(observed.version.packageRevision, "workingPackage" in previous ? previous.workingPackage?.packageRevision ?? 0 : 0) + 1;
      const working = await serializeMaterialWorking(observed.loaded, built.workingSession, observed.files, now().toISOString());
      await persist(MaterialCandidateSchema.parse({ ...common, state: "working", candidateRevision: previous.candidateRevision + 1, workingPackage: working.version }), working.files);
      return response(result({ impact: built.impact, changedTargets: [...built.impact.created, ...built.impact.reset] }));
    } else if (command.command === "editMaterialCandidate") {
      const edit = runMaterialCandidateOperation(loaded, command.payload.operation, now);
      if (edit.status !== "completed") return response(result({ status: "rejected", diagnostics: edit.diagnostics, ...(edit.impact ? { impact: edit.impact } : {}) }), "rejected");
      const working = await serializeMaterialWorking(loaded.workingPackage!, edit.session, await readMaterialPackageFiles(loaded.workingPackageDirectory!), now().toISOString(), edit.logText);
      await persist(MaterialCandidateSchema.parse({ ...common, state: "working", candidateRevision: previous.candidateRevision + 1, workingPackage: working.version }), working.files);
      return response(result({ impact: edit.impact, changedTargets: [{ kind: "drawable", id: previous.intent.drawableId }] }));
    } else if (command.command === "approveMaterialCandidate") {
      if (previous.state !== "working") throw new MaterialHostError("not-working", "Approval requires working state.");
      await persist(MaterialCandidateSchema.parse({ ...previous, state: "approved", approval: { candidateRevision: previous.candidateRevision, workingPackage: previous.workingPackage, approvedBy: request.session.agentId, approvedAt: now().toISOString() } }));
    } else if (command.command === "discardMaterialCandidate") {
      await persist(MaterialCandidateSchema.parse({ ...common, state: "discarded" }));
    } else if (command.command === "applyMaterialCandidate") {
      const impact = analyzeMaterialImpact(loaded.workingPackage!.session, previous.intent);
      // The reset occurred at build; application installs the exact approved package.
      impact.reset = [];
      loaded = await applyMaterialCandidate(store, loaded);
      return response(result({ baseChanged: true, impact, changedTargets: [{ kind: "drawable", id: previous.intent.drawableId }] }));
    }
    return response(result());
  } catch (error) {
    if (error instanceof MaterialHostError && error.code === "base-stale") await markStale();
    const failed = !(error instanceof MaterialHostError) && !(error instanceof Error && error.name === "ZodError");
    const diagnostic = DiagnosticSchema.parse({ checkId: `material.${error instanceof MaterialHostError ? error.code.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase()) : failed ? "ioFailure" : "invalidRequest"}`, status: "fail", severity: "error", phase: "material-host", target: { kind: "package", id: observed.version.packageId }, message: error instanceof Error ? error.message : String(error) });
    if (operation === undefined) return { ...response(undefined, failed ? "failed" : "rejected"), diagnostics: [diagnostic] };
    return response(result({ status: failed ? "failed" : "rejected", diagnostics: [diagnostic] }), failed ? "failed" : error instanceof MaterialHostError && error.code === "permission-denied" ? "permission_denied" : "rejected");
  }
};
