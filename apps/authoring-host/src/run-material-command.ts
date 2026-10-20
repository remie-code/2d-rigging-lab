import { join, resolve } from "node:path";
import { AiCommandRequestSchema, AiCommandResponseSchema, ExtractMaterialSourceResultSchema, PreviewMaterialPlacementResultSchema,
  isMaterialCommandName, materialCommandCapability, type AiMaterialCommand } from "@private-2d-rigging-lab/ai-interface";
import { DiagnosticSchema, type MaterialPackageRef } from "@private-2d-rigging-lab/contracts";
import type { RunAuthoringHostCommandInput } from "./run-authoring-host-command.js";
import type { AuthoringHostCommandResponse } from "./authoring-host-response.js";
import { HostError, hostErrorCheckToken } from "./host-error.js";
import { writeMaterialContextComposite } from "./material-context-composite.js";
import { readMaterialImageFile } from "./material-image-file.js";
import { resolveMaterialPlacement } from "./material-placement.js";
import { renderMaterialPlacementPreview } from "./material-placement-preview.js";
import { materialSessionPackageRef } from "./material-render-artifact.js";
import { extractMaterialSource } from "./material-source-extraction.js";
import { loadAuthoringPackageDirectory } from "./package-directory-io.js";
import { assertOutsidePackage } from "./package-path-guard.js";

export const isMaterialCommand = (command: unknown): boolean =>
  typeof command === "object" && command !== null && isMaterialCommandName((command as { command?: unknown }).command);

type MaterialCommandStatus = "ok" | "rejected" | "failed" | "permission_denied";

/**
 * Read-only material commands (extractMaterialSource, previewMaterialPlacement). They read the saved package directly,
 * write PNG + sidecar artifacts under `<state>/material-artifacts`, and never change the package. Called under the
 * same package-wide lock as every other host command.
 */
export const runMaterialCommand = async (input: RunAuthoringHostCommandInput): Promise<AuthoringHostCommandResponse> => {
  const request = AiCommandRequestSchema.parse(input.command);
  if (!isMaterialCommandName(request.command)) throw new Error("Expected a material command.");
  const command = request as typeof request & AiMaterialCommand;
  let packageRef: MaterialPackageRef | undefined;
  const respond = (status: MaterialCommandStatus, result?: unknown, diagnostics: unknown[] = []): AuthoringHostCommandResponse => {
    const ai = AiCommandResponseSchema.parse({ schemaVersion: "ai-command-response-v1", commandId: request.commandId, command: request.command,
      status, payload: result === undefined ? {} : { result }, diagnostics, evidenceRefs: evidenceRefsOf(result) });
    return { schemaVersion: "authoring-host-command-response-v1", command: request.command, commandId: request.commandId,
      outcome: status === "ok" ? "success" : status === "failed" ? "error" : "rejected", aiCommandStatus: status,
      aiCommandResponse: ai, saved: false, ...(packageRef === undefined ? {} : { packageRevision: packageRef.packageRevision }), diagnostics: ai.diagnostics };
  };
  try {
    const capability = materialCommandCapability(command.command);
    if (!request.session.capabilities.includes(capability)) throw new HostError("permission-denied", `${command.command} requires the ${capability} capability.`);
    const stateDirectory = resolve(input.stateDirectory), artifactDirectory = join(stateDirectory, "material-artifacts");
    await assertOutsidePackage(input.packageDirectory, stateDirectory);
    const { session } = await loadAuthoringPackageDirectory(input.packageDirectory);
    packageRef = materialSessionPackageRef(session);
    if (request.basis.packageRevision !== undefined && request.basis.packageRevision !== packageRef.packageRevision) {
      throw new HostError("basis-stale", `Command basis revision ${request.basis.packageRevision} differs from saved package revision ${packageRef.packageRevision}.`);
    }
    const common = { session, viewport: command.payload.viewport, packageDirectory: input.packageDirectory, artifactDirectory };
    if (command.command === "extractMaterialSource") {
      const extracted = await extractMaterialSource({ ...common, drawableId: command.payload.drawableId });
      return respond("ok", ExtractMaterialSourceResultSchema.parse({ packageRef, sourceContext: extracted.sourceContext, artifacts: extracted.artifacts }));
    }
    const { placement, fitEvidence } = resolveMaterialPlacement(command.payload.alignment);
    const image = await readMaterialImageFile(command.payload.image);
    const preview = await renderMaterialPlacementPreview({ ...common, intent: command.payload.intent, placement, image });
    const context = await writeMaterialContextComposite(common);
    return respond("ok", PreviewMaterialPlacementResultSchema.parse({ packageRef, placement, ...(fitEvidence === undefined ? {} : { fitEvidence }),
      preview, context: context.artifact, artifacts: [preview.artifact, context.artifact] }));
  } catch (error) {
    const hostError = error instanceof HostError ? error : undefined;
    const invalid = error instanceof Error && error.name === "ZodError";
    const status: MaterialCommandStatus = hostError?.code === "permission-denied" ? "permission_denied" : hostError || invalid ? "rejected" : "failed";
    const token = hostError ? hostErrorCheckToken(hostError.code) : invalid ? "invalidRequest" : "ioFailure";
    return respond(status, undefined, [DiagnosticSchema.parse({ checkId: `material.${token}`, status: "fail", severity: "error", phase: "material-host",
      target: { kind: "package", id: packageRef?.packageId ?? "unknown" }, message: error instanceof Error ? error.message : String(error) })]);
  }
};

const evidenceRefsOf = (result: unknown): string[] => {
  const artifacts = (result as { artifacts?: { imageAbsolutePath: string; sidecarAbsolutePath: string }[] } | undefined)?.artifacts ?? [];
  return artifacts.flatMap((artifact) => [artifact.imageAbsolutePath, artifact.sidecarAbsolutePath]);
};
