import {
  AiCommandRequestSchema,
  RenderViewPayloadSchema
} from "@private-2d-rigging-lab/ai-interface";
import type { AuthoringSession } from "@private-2d-rigging-lab/authoring-core";

import type { AuthoringHostCommandResponse } from "./authoring-host-response.js";
import { writeRenderView } from "./perception/render-view-file-output.js";

/**
 * CLI handler for the `renderView` perception command (Wave104 Domain A).
 *
 * `renderView` is handled here rather than inside the ai-interface executor: the
 * executor is dependency-clean (no render / filesystem deps and no renderer), so
 * the concrete render + PNG/sidecar file output lives in the authoring-host. The
 * executor still owns the schema and the `render` capability gate; this handler
 * re-checks the capability so a caller without `render` is refused deterministically.
 */

export interface RunRenderViewCommandInput {
  readonly command: unknown;
  readonly session: AuthoringSession;
  readonly packageDirectory: string;
}

export const isRenderViewCommand = (command: unknown): boolean => {
  if (typeof command !== "object" || command === null) {
    return false;
  }
  return (command as { readonly command?: unknown }).command === "renderView";
};

export const runRenderViewCommand = async (
  input: RunRenderViewCommandInput
): Promise<AuthoringHostCommandResponse> => {
  const request = AiCommandRequestSchema.parse(input.command);
  if (request.command !== "renderView") {
    throw new Error("runRenderViewCommand received a non-renderView command.");
  }

  const commandId = request.commandId;

  if (!request.session.capabilities.includes("render")) {
    return {
      schemaVersion: "authoring-host-command-response-v1",
      outcome: "rejected",
      command: "renderView",
      commandId,
      aiCommandStatus: "permission_denied",
      saved: false,
      packageRevision: input.session.packageRevision,
      diagnostics: []
    };
  }

  const payload = RenderViewPayloadSchema.parse(request.payload);
  const result = await writeRenderView({
    session: input.session,
    payload,
    packagePath: input.packageDirectory
  });

  return {
    schemaVersion: "authoring-host-command-response-v1",
    outcome: "success",
    command: "renderView",
    commandId,
    aiCommandStatus: "ok",
    aiCommandResponse: {
      schemaVersion: "ai-command-response-v1",
      commandId,
      status: "ok",
      diagnostics: [],
      evidenceRefs: [result.pngPath, result.sidecarPath],
      command: "renderView",
      payload: result
    },
    saved: false,
    packageRevision: input.session.packageRevision,
    diagnostics: []
  };
};
