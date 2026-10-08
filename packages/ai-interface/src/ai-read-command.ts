import type { OperationLogEntryDto } from "@private-2d-rigging-lab/operation-core";
import { ValidationReportSchema } from "@private-2d-rigging-lab/validator-core";

import type { GetEditorStatePayload } from "./ai-command-payload.js";
import { AiCommandRequestSchema, type AiCommandRequest } from "./ai-command-request.js";
import { AiCommandResponseSchema, type AiCommandResponse } from "./ai-command-response.js";
import {
  appendAiCommandResponseToTranscript,
  type AiCommandTranscript
} from "./ai-command-transcript.js";
import { AiEditorStateSchema, type AiEditorState } from "./ai-editor-state.js";
import {
  InspectModelResultSchema,
  InspectTargetResultSchema,
  type InspectModelPayload,
  type InspectModelResult,
  type InspectTargetPayload,
  type InspectTargetResult
} from "./ai-inspection-command.js";
import {
  InspectEvaluatedGeometryResultSchema,
  type InspectEvaluatedGeometryPayload,
  type InspectEvaluatedGeometryResult
} from "./ai-measurement-command.js";
import {
  filterAiOperationLogEntries,
  parseAiOperationLogQuery,
  type AiOperationLogQuery
} from "./ai-operation-log-query.js";
import {
  ValidatePackageResultSchema,
  type ValidatePackagePayload,
  type ValidatePackageResult
} from "./ai-validation-command.js";

export interface AiReadCommandHost {
  /**
   * All read command methods are optional. A host that omits a method has that command
   * resolve to `not_implemented` (mirroring the inspect* / validatePackage handling),
   * which lets a host implement only the read commands it supports — e.g. the headless
   * authoring-host implements validatePackage while leaving getEditorState unimplemented.
   */
  getEditorState?(payload: GetEditorStatePayload): AiEditorState | Promise<AiEditorState>;
  inspectModel?(payload: InspectModelPayload): InspectModelResult | Promise<InspectModelResult>;
  inspectTarget?(payload: InspectTargetPayload): InspectTargetResult | Promise<InspectTargetResult>;
  inspectEvaluatedGeometry?(
    payload: InspectEvaluatedGeometryPayload
  ): InspectEvaluatedGeometryResult | Promise<InspectEvaluatedGeometryResult>;
  validatePackage?(payload: ValidatePackagePayload): ValidatePackageResult | Promise<ValidatePackageResult>;
  getOperationLog?(
    query: AiOperationLogQuery
  ): readonly OperationLogEntryDto[] | Promise<readonly OperationLogEntryDto[]>;
}

type SupportedReadCommandName =
  | "getEditorState"
  | "inspectModel"
  | "inspectTarget"
  | "inspectEvaluatedGeometry"
  | "validatePackage"
  | "getOperationLog";
type SupportedReadRequest = Extract<AiCommandRequest, { command: SupportedReadCommandName }>;

const isSupportedReadCommand = (request: AiCommandRequest): request is SupportedReadRequest =>
  request.command === "getEditorState" ||
  request.command === "inspectModel" ||
  request.command === "inspectTarget" ||
  request.command === "inspectEvaluatedGeometry" ||
  request.command === "validatePackage" ||
  request.command === "getOperationLog";

const hasRequiredReadCapability = (request: SupportedReadRequest): boolean =>
  request.command === "validatePackage"
    ? request.session.capabilities.includes("validate")
    : request.session.capabilities.includes("read");

const permissionDeniedResponse = (request: SupportedReadRequest): AiCommandResponse =>
  readStatusResponse(request, "permission_denied");

const readStatusResponse = (
  request: SupportedReadRequest,
  status: "permission_denied" | "not_implemented"
): AiCommandResponse =>
  AiCommandResponseSchema.parse({
    schemaVersion: "ai-command-response-v1",
    commandId: request.commandId,
    status,
    command: request.command,
    payload: emptyPayloadForReadCommand(request)
  });

export const executeAiReadCommand = async (
  requestInput: unknown,
  host: AiReadCommandHost,
  transcript?: AiCommandTranscript
): Promise<AiCommandResponse> => {
  const request = AiCommandRequestSchema.parse(requestInput);

  if (!isSupportedReadCommand(request)) {
    return recordReadResponse(
      request,
      AiCommandResponseSchema.parse({
        schemaVersion: "ai-command-response-v1",
        commandId: request.commandId,
        status: "not_implemented",
        command: "getOperationLog",
        payload: {
          entries: []
        }
      }),
      transcript
    );
  }

  if (!hasRequiredReadCapability(request)) {
    return recordReadResponse(request, permissionDeniedResponse(request), transcript);
  }

  if (request.command === "getEditorState") {
    if (host.getEditorState === undefined) {
      return recordReadResponse(request, readStatusResponse(request, "not_implemented"), transcript);
    }

    const editorState = AiEditorStateSchema.parse(await host.getEditorState(request.payload));

    return recordReadResponse(
      request,
      AiCommandResponseSchema.parse({
        schemaVersion: "ai-command-response-v1",
        commandId: request.commandId,
        status: "ok",
        command: "getEditorState",
        payload: {
          editorState
        }
      }),
      transcript
    );
  }

  if (request.command === "inspectModel") {
    if (host.inspectModel === undefined) {
      return recordReadResponse(request, readStatusResponse(request, "not_implemented"), transcript);
    }

    const result = InspectModelResultSchema.parse(await host.inspectModel(request.payload));

    return recordReadResponse(
      request,
      AiCommandResponseSchema.parse({
        schemaVersion: "ai-command-response-v1",
        commandId: request.commandId,
        status: "ok",
        command: "inspectModel",
        payload: result
      }),
      transcript
    );
  }

  if (request.command === "inspectTarget") {
    if (host.inspectTarget === undefined) {
      return recordReadResponse(request, readStatusResponse(request, "not_implemented"), transcript);
    }

    const result = InspectTargetResultSchema.parse(await host.inspectTarget(request.payload));

    return recordReadResponse(
      request,
      AiCommandResponseSchema.parse({
        schemaVersion: "ai-command-response-v1",
        commandId: request.commandId,
        status: "ok",
        command: "inspectTarget",
        payload: result
      }),
      transcript
    );
  }

  if (request.command === "inspectEvaluatedGeometry") {
    if (host.inspectEvaluatedGeometry === undefined) {
      return recordReadResponse(request, readStatusResponse(request, "not_implemented"), transcript);
    }

    const result = InspectEvaluatedGeometryResultSchema.parse(
      await host.inspectEvaluatedGeometry(request.payload)
    );

    return recordReadResponse(
      request,
      AiCommandResponseSchema.parse({
        schemaVersion: "ai-command-response-v1",
        commandId: request.commandId,
        status: "ok",
        command: "inspectEvaluatedGeometry",
        payload: result
      }),
      transcript
    );
  }

  if (request.command === "validatePackage") {
    if (host.validatePackage === undefined) {
      return recordReadResponse(request, readStatusResponse(request, "not_implemented"), transcript);
    }

    const result = ValidatePackageResultSchema.parse(await host.validatePackage(request.payload));

    return recordReadResponse(
      request,
      AiCommandResponseSchema.parse({
        schemaVersion: "ai-command-response-v1",
        commandId: request.commandId,
        status: "ok",
        command: "validatePackage",
        payload: result
      }),
      transcript
    );
  }

  if (host.getOperationLog === undefined) {
    return recordReadResponse(request, readStatusResponse(request, "not_implemented"), transcript);
  }

  const query = parseAiOperationLogQuery(request.payload);
  const entries = filterAiOperationLogEntries(await host.getOperationLog(query), query);

  return recordReadResponse(
    request,
    AiCommandResponseSchema.parse({
      schemaVersion: "ai-command-response-v1",
      commandId: request.commandId,
      status: "ok",
      command: "getOperationLog",
      payload: {
        entries
      }
    }),
    transcript
  );
};

const recordReadResponse = (
  request: AiCommandRequest,
  response: AiCommandResponse,
  transcript?: AiCommandTranscript
): AiCommandResponse => {
  if (transcript !== undefined) {
    appendAiCommandResponseToTranscript({
      transcript,
      request,
      response
    });
  }

  return response;
};

const emptyPayloadForReadCommand = (request: SupportedReadRequest) => {
  switch (request.command) {
    case "getEditorState":
      return { editorState: { schemaVersion: "editor-semantic-state-v1", packageRevision: 0 } };
    case "inspectModel":
      return { targets: [], editableTargets: [] };
    case "inspectTarget":
      return { target: request.payload.target, references: [] };
    case "inspectEvaluatedGeometry":
      return {
        schemaVersion: "inspect-evaluated-geometry-result-v1",
        packageRevision: 0,
        parameterOverrides: [],
        results: []
      };
    case "validatePackage":
      return {
        reportId: "val_ai_permission_denied",
        report: ValidationReportSchema.parse({
          schemaVersion: "validation-report-v1",
          reportId: "val_ai_permission_denied",
          createdAt: "2026-05-29T00:00:00.000Z",
          packageId: "pkg_unknown",
          packageRevision: request.payload.packageRevision ?? 0,
          validatorVersion: "ai-interface",
          profile: request.payload.profile,
          relatedScenarios: [],
          summary: {
            status: "not_applicable",
            highestSeverity: "info",
            counts: {
              info: 0,
              warning: 0,
              error: 0,
              blocking: 0
            }
          },
          checks: [],
          repairCandidates: [],
          evidence: {
            operationLogPresent: false,
            runtimeSnapshotIds: [],
            supplementalGuiEvidenceRefs: []
          }
        })
      };
    case "getOperationLog":
      return { entries: [] };
  }
};
