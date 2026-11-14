import { AiCommandRequestSchema, AiCommandResponseSchema } from "@private-2d-rigging-lab/ai-interface";
import {
  createReferenceImageState,
  describeReferenceImageBytes,
  updateReferenceImageState
} from "@private-2d-rigging-lab/authoring-core";
import { DiagnosticSchema } from "@private-2d-rigging-lab/contracts";

import type { AuthoringHostCommandResponse } from "./authoring-host-response.js";
import { HostError, hostErrorCheckToken } from "./host-error.js";
import type { LoadedAuthoringPackage } from "./package-directory-io.js";
import { decodeReferencePng } from "./reference-png.js";
import {
  loadWorkspaceReferencePng,
  readReferenceImageState,
  readReferencePngFile,
  writeWorkspaceReferenceImage
} from "./workspace-reference-image-io.js";

export const isReferenceImageCommand = (command: unknown): boolean =>
  typeof command === "object" && command !== null &&
  (command as { readonly command?: unknown }).command === "referenceImage";

export const runReferenceImageCommand = async (input: {
  readonly command: unknown;
  readonly packageDirectory: string;
  readonly loaded: LoadedAuthoringPackage;
}): Promise<AuthoringHostCommandResponse> => {
  const request = AiCommandRequestSchema.parse(input.command);
  if (request.command !== "referenceImage") throw new Error("Expected a referenceImage command.");
  const { payload } = request;
  const { packageRevision, packageIdentity } = input.loaded.session;
  const directory = input.packageDirectory;
  const capability = payload.action === "get" ? "read" : "editReference";

  const respond = (
    status: "ok" | "rejected" | "permission_denied",
    result?: { reference: Awaited<ReturnType<typeof readReferenceImageState>> },
    diagnostics: readonly unknown[] = []
  ): AuthoringHostCommandResponse => {
    const ai = AiCommandResponseSchema.parse({
      schemaVersion: "ai-command-response-v1",
      commandId: request.commandId,
      command: request.command,
      status,
      payload: result === undefined ? {} : { result },
      diagnostics
    });
    return {
      schemaVersion: "authoring-host-command-response-v1",
      outcome: status === "ok" ? "success" : "rejected",
      command: request.command,
      commandId: request.commandId,
      aiCommandStatus: status,
      aiCommandResponse: ai,
      saved: status === "ok" && payload.action !== "get",
      packageRevision,
      diagnostics: ai.diagnostics
    };
  };

  try {
    if (!request.session.capabilities.includes(capability)) {
      throw new HostError("permission-denied", `Reference image ${payload.action} requires ${capability}.`);
    }
    if (request.basis.packageRevision !== undefined && request.basis.packageRevision !== packageRevision) {
      throw new HostError("basis-stale", `Command basis revision ${request.basis.packageRevision} differs from saved revision ${packageRevision}.`);
    }
    if (payload.action === "register") {
      const bytes = await readReferencePngFile(payload.imagePath);
      const { width, height } = decodeReferencePng(bytes);
      const image = await describeReferenceImageBytes(bytes, { width, height });
      const reference = updateReferenceImageState(createReferenceImageState(image), payload.settings ?? {});
      await writeWorkspaceReferenceImage(directory, reference, bytes);
      return respond("ok", { reference });
    }
    if (payload.action === "remove") {
      await writeWorkspaceReferenceImage(directory, null);
      return respond("ok", { reference: null });
    }

    const reference = await readReferenceImageState(directory);
    if (reference !== null) await loadWorkspaceReferencePng(directory, reference);
    if (payload.action === "get") return respond("ok", { reference });
    if (reference === null) throw new HostError("reference-not-registered", "Register a reference PNG before editing its settings.");
    const next = updateReferenceImageState(reference, payload.settings);
    await writeWorkspaceReferenceImage(directory, next);
    return respond("ok", { reference: next });
  } catch (error) {
    const code = error instanceof HostError ? error.code : "reference-image-failure";
    return respond(code === "permission-denied" ? "permission_denied" : "rejected", undefined, [
      DiagnosticSchema.parse({
        checkId: `authoringHost.${hostErrorCheckToken(code)}`,
        phase: "authoring-host",
        status: "fail",
        severity: "error",
        target: { kind: "package", id: packageIdentity.packageId },
        message: error instanceof Error ? error.message : String(error)
      })
    ]);
  }
};
