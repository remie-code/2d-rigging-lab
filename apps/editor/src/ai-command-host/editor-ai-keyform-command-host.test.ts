import { OperationRequestSchema } from "@private-2d-rigging-lab/operation-core";
import type { PackageFileSet } from "@private-2d-rigging-lab/package-format";
import {
  createRuntimeSnapshotArtifactPath,
  RuntimeSnapshotSchema,
  type RuntimeSnapshotDto
} from "@private-2d-rigging-lab/runtime-core";
import { describe, expect, it } from "vitest";

import { createEditorWorkflowController } from "../editor-workflow/index.js";
import { createBrowserProjectStore, type StorageLike } from "../project-persistence/index.js";

const BODY_YAW_PARAMETER_ID = "param_ai_body_yaw";
const PREVIEW_SAMPLE_PARAMETER_ID = "param_preview_body_yaw";
const BODY_YAW_KEYFORM_OPERATION_ID = "op_ai_add_keyform_body_yaw";
const BODY_YAW_KEYFORM_SET_ID = "keyset_mesh_mesh_body_vertices_ai_body_yaw_1";
const GRID_YAW_PARAMETER_ID = "param_ai_grid_yaw";
const GRID_PITCH_PARAMETER_ID = "param_ai_grid_pitch";
const GRID2D_KEYFORM_OPERATION_ID = "op_ai_add_keyform_grid_body";
const GRID2D_KEYFORM_SET_ID = "keyset_grid_mesh_mesh_body_vertices_ai_grid_yaw_ai_grid_pitch";

describe("editor AI keyform command host regression", () => {
  it("dry-runs, approves, commits, inspects, validates, and logs addKeyform", async () => {
    const workflow = createWorkflow(createMemoryStorage());

    await dryRunApproveAndCommitAiParameter(workflow, "body_yaw");

    const keyformDryRunResponse = await workflow.aiCommandHost.execute(
      createAiRequest({
        commandId: "cmd_ai_dry_run_body_yaw_keyform",
        command: "dryRunOperation",
        capabilities: ["dryRunEdit"],
        payload: createAiAddKeyformOperation({
          dryRun: true,
          basePackageRevision: workflow.state.revision.packageRevision
        })
      })
    );

    expect(keyformDryRunResponse).toMatchObject({
      status: "ok",
      command: "dryRunOperation",
      payload: {
        operationResult: {
          status: "dry_run",
          operationId: BODY_YAW_KEYFORM_OPERATION_ID,
          modelDiff: {
            added: [{ kind: "keyformSet", id: BODY_YAW_KEYFORM_SET_ID }]
          }
        }
      }
    });
    expect(workflow.state.revision.packageRevision).toBe(1);
    expect(workflow.state.operationLog.entryCount).toBe(1);

    workflow.aiCommandHost.approvalPolicy.approveDryRunCommand({
      dryRunCommandId: "cmd_ai_dry_run_body_yaw_keyform",
      operationId: BODY_YAW_KEYFORM_OPERATION_ID
    });

    const keyformCommitResponse = await workflow.aiCommandHost.execute(
      createAiRequest({
        commandId: "cmd_ai_commit_body_yaw_keyform",
        command: "commitOperation",
        capabilities: ["commitWithApproval"],
        payload: {
          approvedDryRunCommandId: "cmd_ai_dry_run_body_yaw_keyform",
          operation: createAiAddKeyformOperation({
            dryRun: false,
            basePackageRevision: workflow.state.revision.packageRevision
          })
        }
      })
    );

    expect(keyformCommitResponse).toMatchObject({
      status: "ok",
      command: "commitOperation",
      evidenceRefs: expect.arrayContaining([
        expect.stringMatching(/^runtime\/states\/.+editor-add-keyform-final.+\.runtime-state\.json$/),
        expect.stringMatching(/^runtime\/state-sequences\/.+editor-add-keyform\.runtime-state-sequence\.json$/),
        `operations/log.jsonl#${BODY_YAW_KEYFORM_OPERATION_ID}`
      ]),
      payload: {
        operationResult: {
          status: "committed",
          operationId: BODY_YAW_KEYFORM_OPERATION_ID,
          generatedRuntimeStateRefs: [
            expect.stringMatching(/editor-add-keyform-final/)
          ],
          generatedRuntimeStateSequenceRefs: [
            expect.stringMatching(/editor-add-keyform\.runtime-state-sequence\.json$/)
          ],
          generatedValidationReportIds: [
            "val_editor_ai_add_keyform_body_yaw_baseline",
            "val_editor_ai_add_keyform_body_yaw_candidate"
          ]
        }
      }
    });
    const commitRuntimeDiff = keyformCommitResponse.runtimeDiff;
    const commitOperationResult = keyformCommitResponse.operationResult;
    if (commitRuntimeDiff === undefined || commitOperationResult === undefined) {
      throw new Error("Committed AI addKeyform response should expose runtime evidence.");
    }

    expect(commitRuntimeDiff.parameterChanges).toEqual([]);
    expect(commitRuntimeDiff.drawableChanges).toEqual([
      expect.objectContaining({
        drawableId: "draw_body",
        boundsChanged: true
      })
    ]);
    expect(commitOperationResult.generatedRuntimeSnapshotIds).toEqual(
      expect.arrayContaining([commitRuntimeDiff.beforeSnapshotId, commitRuntimeDiff.afterSnapshotId])
    );
    expect(keyformCommitResponse.evidenceRefs).toEqual(
      expect.arrayContaining([
        createRuntimeSnapshotArtifactPath(commitRuntimeDiff.beforeSnapshotId),
        createRuntimeSnapshotArtifactPath(commitRuntimeDiff.afterSnapshotId)
      ])
    );
    const latestPersistenceResult = workflow.latestSessionPersistenceResult;
    if (latestPersistenceResult === null) {
      throw new Error("Committed AI addKeyform should persist generated runtime artifacts.");
    }

    const candidateSnapshot = parseRuntimeSnapshotArtifact(
      latestPersistenceResult.packageFileSet,
      commitRuntimeDiff.afterSnapshotId
    );
    const candidateDrawable = candidateSnapshot.drawables.find((drawable) => drawable.drawableId === "draw_body");

    expect(candidateSnapshot.keyformSamples).toContainEqual(
      expect.objectContaining({
        keyformSetId: "keyset_preview_body_yaw_vertices",
        sampledCoordinates: {
          [PREVIEW_SAMPLE_PARAMETER_ID]: 0
        }
      })
    );
    expect(candidateSnapshot.keyformSamples).toContainEqual(
      expect.objectContaining({
        keyformSetId: BODY_YAW_KEYFORM_SET_ID,
        evaluator: "linear-1d-v1",
        sampledCoordinates: {
          [BODY_YAW_PARAMETER_ID]: 1
        },
        target: "mesh:mesh_body.vertices",
        samplingStatus: "exact",
        statePatch: [
          { x: 0, y: 0 },
          { x: 36, y: 0 },
          { x: 0, y: 32 }
        ]
      })
    );
    expect(candidateDrawable).toMatchObject({
      bounds: { x: 0, y: 0, width: 36, height: 32 },
      vertexHash: commitRuntimeDiff.drawableChanges[0]?.vertexHashAfter
    });
    expect(workflow.state.revision.packageRevision).toBe(2);
    expect(workflow.state.operationLog.entryCount).toBe(2);
    expect(workflow.aiCommandHost.transcript.entries).toContainEqual(
      expect.objectContaining({
        entryType: "approval",
        dryRunCommandId: "cmd_ai_dry_run_body_yaw_keyform",
        approvalStatus: "approved",
        operationId: BODY_YAW_KEYFORM_OPERATION_ID
      })
    );

    const inspectResponse = await workflow.aiCommandHost.execute(
      createAiRequest({
        commandId: "cmd_ai_inspect_body_yaw_after_keyform",
        command: "inspectTarget",
        capabilities: ["read"],
        payload: {
          target: {
            kind: "parameter",
            id: BODY_YAW_PARAMETER_ID
          },
          includeReferences: true
        }
      })
    );

    expect(inspectResponse).toMatchObject({
      status: "ok",
      command: "inspectTarget",
      payload: {
        status: "ok",
        target: {
          kind: "parameter",
          id: BODY_YAW_PARAMETER_ID,
          path: "/model/parameters/parameters/1"
        },
        references: expect.arrayContaining([
          {
            kind: "keyformSet",
            id: BODY_YAW_KEYFORM_SET_ID,
            path: "/model/keyforms/keyformSets/1"
          },
          {
            kind: "mesh",
            id: "mesh_body",
            path: "/model/meshes/meshes/mesh_body"
          }
        ])
      }
    });

    const validationResponse = await workflow.aiCommandHost.execute(
      createAiRequest({
        commandId: "cmd_ai_validate_after_keyform",
        command: "validatePackage",
        capabilities: ["validate"],
        payload: {
          profile: "strict",
          packageRevision: workflow.state.revision.packageRevision
        }
      })
    );

    expect(validationResponse).toMatchObject({
      status: "ok",
      command: "validatePackage",
      payload: {
        report: {
          packageId: "pkg_editor_browser_sample",
          packageRevision: 2,
          profile: "strict",
          summary: {
            status: "pass"
          },
          checks: []
        }
      }
    });

    const operationLogResponse = await workflow.aiCommandHost.execute(
      createAiRequest({
        commandId: "cmd_ai_get_keyform_operation_log",
        command: "getOperationLog",
        capabilities: ["read"],
        payload: {
          operationIds: [BODY_YAW_KEYFORM_OPERATION_ID],
          targetIds: [BODY_YAW_KEYFORM_SET_ID],
          surface: "structuredApi"
        }
      })
    );

    expect(operationLogResponse).toMatchObject({
      status: "ok",
      command: "getOperationLog"
    });
    const operationLogEntries = asArray(asRecord(operationLogResponse.payload)["entries"]);
    expect(operationLogEntries).toHaveLength(1);
    const keyformOperationLogEntry = asRecord(operationLogEntries[0]);

    expect(keyformOperationLogEntry).toMatchObject({
      operationId: BODY_YAW_KEYFORM_OPERATION_ID,
      actor: "ai",
      surface: "structuredApi",
      operationType: "addKeyform",
      targetIds: [
        BODY_YAW_KEYFORM_SET_ID,
        BODY_YAW_PARAMETER_ID,
        "mesh_body"
      ],
      validationReportIds: [
        "val_editor_ai_add_keyform_body_yaw_baseline",
        "val_editor_ai_add_keyform_body_yaw_candidate"
      ],
      payload: {
        operationType: "addKeyform",
        payload: {
          target: {
            kind: "mesh",
            id: "mesh_body"
          },
          parameterId: BODY_YAW_PARAMETER_ID
        }
      }
    });
    expect(asArray(keyformOperationLogEntry["runtimeSnapshotIds"])).toEqual(
      expect.arrayContaining([expect.stringMatching(/^snap_/)])
    );
    expect(asRecord(keyformOperationLogEntry["result"])).toMatchObject({
      operationId: BODY_YAW_KEYFORM_OPERATION_ID,
      status: "committed",
      modelDiff: {
        added: [{ kind: "keyformSet", id: BODY_YAW_KEYFORM_SET_ID }]
      }
    });
  });

  it("dry-runs, approves, commits, persists, and logs addKeyformGrid2d evidence", async () => {
    const storage = createMemoryStorage();
    const workflow = createWorkflow(storage);

    await dryRunApproveAndCommitAiGridParameter(workflow, {
      name: "grid_yaw",
      parameterId: GRID_YAW_PARAMETER_ID,
      displayName: "AI Grid Yaw"
    });
    await dryRunApproveAndCommitAiGridParameter(workflow, {
      name: "grid_pitch",
      parameterId: GRID_PITCH_PARAMETER_ID,
      displayName: "AI Grid Pitch"
    });

    expect(workflow.state.revision.packageRevision).toBe(2);
    expect(workflow.state.parameters.map((parameter) => parameter.parameterId)).toEqual([
      PREVIEW_SAMPLE_PARAMETER_ID,
      GRID_YAW_PARAMETER_ID,
      GRID_PITCH_PARAMETER_ID
    ]);

    const gridDryRunResponse = await workflow.aiCommandHost.execute(
      createAiRequest({
        commandId: "cmd_ai_dry_run_grid2d_keyform",
        command: "dryRunOperation",
        capabilities: ["dryRunEdit"],
        payload: createAiAddKeyformGrid2dOperation({
          dryRun: true,
          basePackageRevision: workflow.state.revision.packageRevision
        })
      })
    );

    expect(gridDryRunResponse).toMatchObject({
      status: "ok",
      command: "dryRunOperation",
      payload: {
        operationResult: {
          status: "dry_run",
          operationId: GRID2D_KEYFORM_OPERATION_ID,
          modelDiff: {
            added: [{ kind: "keyformSet", id: GRID2D_KEYFORM_SET_ID }]
          }
        }
      }
    });
    expect(workflow.state.revision.packageRevision).toBe(2);
    expect(workflow.state.operationLog.entryCount).toBe(2);

    workflow.aiCommandHost.approvalPolicy.approveDryRunCommand({
      dryRunCommandId: "cmd_ai_dry_run_grid2d_keyform",
      operationId: GRID2D_KEYFORM_OPERATION_ID
    });

    const gridCommitResponse = await workflow.aiCommandHost.execute(
      createAiRequest({
        commandId: "cmd_ai_commit_grid2d_keyform",
        command: "commitOperation",
        capabilities: ["commitWithApproval"],
        payload: {
          approvedDryRunCommandId: "cmd_ai_dry_run_grid2d_keyform",
          operation: createAiAddKeyformGrid2dOperation({
            dryRun: false,
            basePackageRevision: workflow.state.revision.packageRevision
          })
        }
      })
    );

    expect(gridCommitResponse).toMatchObject({
      status: "ok",
      command: "commitOperation",
      evidenceRefs: expect.arrayContaining([
        expect.stringMatching(/^runtime\/states\/.+editor-add-keyform-grid2d-final.+\.runtime-state\.json$/),
        expect.stringMatching(/^runtime\/state-sequences\/.+editor-add-keyform-grid2d\.runtime-state-sequence\.json$/),
        `operations/log.jsonl#${GRID2D_KEYFORM_OPERATION_ID}`
      ]),
      payload: {
        operationResult: {
          status: "committed",
          operationId: GRID2D_KEYFORM_OPERATION_ID,
          generatedRuntimeStateRefs: [
            expect.stringMatching(/editor-add-keyform-grid2d-final/)
          ],
          generatedRuntimeStateSequenceRefs: [
            expect.stringMatching(/editor-add-keyform-grid2d\.runtime-state-sequence\.json$/)
          ],
          generatedValidationReportIds: [
            "val_editor_ai_add_keyform_grid_body_baseline",
            "val_editor_ai_add_keyform_grid_body_candidate"
          ]
        }
      }
    });

    const commitRuntimeDiff = gridCommitResponse.runtimeDiff;
    const commitOperationResult = gridCommitResponse.operationResult;
    if (commitRuntimeDiff === undefined || commitOperationResult === undefined) {
      throw new Error("Committed AI addKeyformGrid2d response should expose runtime evidence.");
    }

    expect(commitRuntimeDiff.parameterChanges).toEqual([]);
    expect(commitRuntimeDiff.drawableChanges).toEqual([
      expect.objectContaining({
        drawableId: "draw_body",
        boundsChanged: true
      })
    ]);
    expect(commitRuntimeDiff.drawableRuntimeStateChanges).toEqual([]);
    expect(commitRuntimeDiff.drawListChanges).toEqual([]);
    expect(commitOperationResult.generatedRuntimeSnapshotIds).toEqual(
      expect.arrayContaining([commitRuntimeDiff.beforeSnapshotId, commitRuntimeDiff.afterSnapshotId])
    );
    const expectedRuntimeEvidenceRefs = [
      ...commitOperationResult.generatedRuntimeStateRefs,
      ...commitOperationResult.generatedRuntimeStateSequenceRefs,
      createRuntimeSnapshotArtifactPath(commitRuntimeDiff.beforeSnapshotId),
      createRuntimeSnapshotArtifactPath(commitRuntimeDiff.afterSnapshotId),
      `operations/log.jsonl#${GRID2D_KEYFORM_OPERATION_ID}`
    ];
    expect(gridCommitResponse.evidenceRefs).toEqual(
      expect.arrayContaining(expectedRuntimeEvidenceRefs)
    );

    const latestPersistenceResult = workflow.latestSessionPersistenceResult;
    if (latestPersistenceResult === null) {
      throw new Error("Committed AI addKeyformGrid2d should persist generated runtime artifacts.");
    }

    const candidateSnapshot = parseRuntimeSnapshotArtifact(
      latestPersistenceResult.packageFileSet,
      commitRuntimeDiff.afterSnapshotId
    );
    const candidateDrawable = candidateSnapshot.drawables.find((drawable) => drawable.drawableId === "draw_body");

    expect(candidateSnapshot.keyformSamples).toContainEqual(
      expect.objectContaining({
        keyformSetId: "keyset_preview_body_yaw_vertices",
        sampledCoordinates: {
          [PREVIEW_SAMPLE_PARAMETER_ID]: 0
        }
      })
    );
    expect(candidateSnapshot.keyformSamples).toContainEqual(
      expect.objectContaining({
        keyformSetId: GRID2D_KEYFORM_SET_ID,
        evaluator: "parameter-grid-2d-v1",
        sampledCoordinates: {
          [GRID_YAW_PARAMETER_ID]: -1,
          [GRID_PITCH_PARAMETER_ID]: -1
        },
        target: "mesh:mesh_body.vertices",
        samplingStatus: "exact",
        statePatch: [
          { x: -2, y: 0 },
          { x: 32, y: 0 },
          { x: 0, y: 32 }
        ]
      })
    );
    expect(candidateDrawable).toMatchObject({
      bounds: { x: 22, y: 16, width: 82, height: 96 },
      vertexHash: commitRuntimeDiff.drawableChanges[0]?.vertexHashAfter
    });
    expect(workflow.state.revision.packageRevision).toBe(3);
    expect(workflow.state.operationLog.entryCount).toBe(3);
    expect(workflow.aiCommandHost.transcript.entries).toContainEqual(
      expect.objectContaining({
        entryType: "approval",
        dryRunCommandId: "cmd_ai_dry_run_grid2d_keyform",
        approvalStatus: "approved",
        operationId: GRID2D_KEYFORM_OPERATION_ID
      })
    );
    expect(workflow.aiCommandHost.transcript.entries).toContainEqual(
      expect.objectContaining({
        entryType: "command",
        commandId: "cmd_ai_commit_grid2d_keyform",
        command: "commitOperation",
        status: "ok",
        operationId: GRID2D_KEYFORM_OPERATION_ID,
        evidenceRefs: expect.arrayContaining(expectedRuntimeEvidenceRefs)
      })
    );

    const operationLogResponse = await workflow.aiCommandHost.execute(
      createAiRequest({
        commandId: "cmd_ai_get_grid2d_operation_log",
        command: "getOperationLog",
        capabilities: ["read"],
        payload: {
          operationIds: [GRID2D_KEYFORM_OPERATION_ID],
          targetIds: [GRID2D_KEYFORM_SET_ID],
          surface: "structuredApi"
        }
      })
    );

    expect(operationLogResponse).toMatchObject({
      status: "ok",
      command: "getOperationLog"
    });
    const operationLogEntries = asArray(asRecord(operationLogResponse.payload)["entries"]);
    expect(operationLogEntries).toHaveLength(1);
    const gridOperationLogEntry = asRecord(operationLogEntries[0]);

    expect(gridOperationLogEntry).toMatchObject({
      operationId: GRID2D_KEYFORM_OPERATION_ID,
      actor: "ai",
      surface: "structuredApi",
      operationType: "addKeyformGrid2d",
      targetIds: [
        GRID2D_KEYFORM_SET_ID,
        "mesh_body",
        GRID_YAW_PARAMETER_ID,
        GRID_PITCH_PARAMETER_ID
      ],
      validationReportIds: [
        "val_editor_ai_add_keyform_grid_body_baseline",
        "val_editor_ai_add_keyform_grid_body_candidate"
      ],
      payload: {
        operationType: "addKeyformGrid2d",
        payload: {
          target: {
            kind: "mesh",
            id: "mesh_body"
          },
          parameterX: GRID_YAW_PARAMETER_ID,
          parameterY: GRID_PITCH_PARAMETER_ID
        }
      }
    });
    expect(asArray(gridOperationLogEntry["runtimeSnapshotIds"])).toEqual(
      expect.arrayContaining([commitRuntimeDiff.beforeSnapshotId, commitRuntimeDiff.afterSnapshotId])
    );
    expect(asRecord(gridOperationLogEntry["result"])).toMatchObject({
      operationId: GRID2D_KEYFORM_OPERATION_ID,
      status: "committed",
      modelDiff: {
        added: [{ kind: "keyformSet", id: GRID2D_KEYFORM_SET_ID }]
      },
      runtimeDiff: {
        drawableChanges: [
          expect.objectContaining({
            drawableId: "draw_body",
            boundsChanged: true
          })
        ]
      }
    });

    workflow.saveProject();
    const reloadedWorkflow = createWorkflow(storage);
    const loadResult = reloadedWorkflow.loadProject();

    expect(loadResult.status).toBe("loaded");
    expect(reloadedWorkflow.aiCommandHost.transcript.entries).toContainEqual(
      expect.objectContaining({
        entryType: "command",
        commandId: "cmd_ai_commit_grid2d_keyform",
        command: "commitOperation",
        status: "ok",
        operationId: GRID2D_KEYFORM_OPERATION_ID,
        evidenceRefs: expect.arrayContaining(expectedRuntimeEvidenceRefs)
      })
    );
  });
});

const dryRunApproveAndCommitAiParameter = async (
  workflow: ReturnType<typeof createWorkflow>,
  name: "body_yaw"
): Promise<void> => {
  const dryRunCommandId = `cmd_ai_dry_run_${name}`;
  const operationId = `op_ai_create_parameter_${name}`;

  const dryRunResponse = await workflow.aiCommandHost.execute(
    createAiRequest({
      commandId: dryRunCommandId,
      command: "dryRunOperation",
      capabilities: ["dryRunEdit"],
      payload: createAiCreateParameterOperation({
        name,
        dryRun: true,
        basePackageRevision: workflow.state.revision.packageRevision
      })
    })
  );

  expect(dryRunResponse).toMatchObject({
    status: "ok",
    payload: {
      operationResult: {
        status: "dry_run",
        operationId
      }
    }
  });

  workflow.aiCommandHost.approvalPolicy.approveDryRunCommand({
    dryRunCommandId,
    operationId
  });

  const commitResponse = await workflow.aiCommandHost.execute(
    createAiRequest({
      commandId: `cmd_ai_commit_${name}`,
      command: "commitOperation",
      capabilities: ["commitWithApproval"],
      payload: {
        approvedDryRunCommandId: dryRunCommandId,
        operation: createAiCreateParameterOperation({
          name,
          dryRun: false,
          basePackageRevision: workflow.state.revision.packageRevision
        })
      }
    })
  );

  expect(commitResponse).toMatchObject({
    status: "ok",
    payload: {
      operationResult: {
        status: "committed",
        operationId
      }
    }
  });
  expect(workflow.state.parameters.map((parameter) => parameter.parameterId)).toEqual([
    PREVIEW_SAMPLE_PARAMETER_ID,
    BODY_YAW_PARAMETER_ID
  ]);
};

const dryRunApproveAndCommitAiGridParameter = async (
  workflow: ReturnType<typeof createWorkflow>,
  input: {
    readonly name: "grid_yaw" | "grid_pitch";
    readonly parameterId: typeof GRID_YAW_PARAMETER_ID | typeof GRID_PITCH_PARAMETER_ID;
    readonly displayName: string;
  }
): Promise<void> => {
  const dryRunCommandId = `cmd_ai_dry_run_${input.name}`;
  const operationId = `op_ai_create_parameter_${input.name}`;

  const dryRunResponse = await workflow.aiCommandHost.execute(
    createAiRequest({
      commandId: dryRunCommandId,
      command: "dryRunOperation",
      capabilities: ["dryRunEdit"],
      payload: createAiCreateGridParameterOperation({
        ...input,
        dryRun: true,
        basePackageRevision: workflow.state.revision.packageRevision
      })
    })
  );

  expect(dryRunResponse).toMatchObject({
    status: "ok",
    payload: {
      operationResult: {
        status: "dry_run",
        operationId
      }
    }
  });

  workflow.aiCommandHost.approvalPolicy.approveDryRunCommand({
    dryRunCommandId,
    operationId
  });

  const commitResponse = await workflow.aiCommandHost.execute(
    createAiRequest({
      commandId: `cmd_ai_commit_${input.name}`,
      command: "commitOperation",
      capabilities: ["commitWithApproval"],
      payload: {
        approvedDryRunCommandId: dryRunCommandId,
        operation: createAiCreateGridParameterOperation({
          ...input,
          dryRun: false,
          basePackageRevision: workflow.state.revision.packageRevision
        })
      }
    })
  );

  expect(commitResponse).toMatchObject({
    status: "ok",
    payload: {
      operationResult: {
        status: "committed",
        operationId
      }
    }
  });
};

const createAiRequest = (input: {
  readonly commandId: string;
  readonly command:
    | "inspectTarget"
    | "validatePackage"
    | "dryRunOperation"
    | "commitOperation"
    | "getOperationLog";
  readonly capabilities: readonly ("read" | "dryRunEdit" | "commitWithApproval" | "validate")[];
  readonly payload: unknown;
}) => ({
  schemaVersion: "ai-command-request-v1",
  commandId: input.commandId,
  session: {
    agentId: "agent_editor_ai_keyform_test",
    capabilities: input.capabilities
  },
  basis: {
    packageRevision: 0,
    relatedAC: ["AC-AI-006", "AC-MVP-014"],
    relatedScenarios: ["SC-AGENT-002"]
  },
  command: input.command,
  payload: input.payload
});

const createAiCreateParameterOperation = (input: {
  readonly name: "body_yaw";
  readonly dryRun: boolean;
  readonly basePackageRevision: number;
}) =>
  OperationRequestSchema.parse({
    schemaVersion: "operation-request-v1",
    operationId: `op_ai_create_parameter_${input.name}`,
    actor: "ai",
    surface: "structuredApi",
    dryRun: input.dryRun,
    basePackageRevision: input.basePackageRevision,
    idempotencyKey: `ai-create-parameter-${input.name}`,
    trace: {
      relatedAC: ["AC-AI-006", "AC-MVP-014"],
      relatedScenarios: ["SC-AGENT-002"]
    },
    operationType: "createParameter",
    payload: {
      parameterId: BODY_YAW_PARAMETER_ID,
      displayName: "AI Body Yaw",
      semanticRole: "body",
      projectPresetAlias: "private-ai-body-yaw-control",
      valueSource: "authoredInput",
      min: -1,
      max: 1,
      default: 0,
      recommendedUiStep: 0.01
    }
  });

const createAiAddKeyformOperation = (input: {
  readonly dryRun: boolean;
  readonly basePackageRevision: number;
}) =>
  OperationRequestSchema.parse({
    schemaVersion: "operation-request-v1",
    operationId: BODY_YAW_KEYFORM_OPERATION_ID,
    actor: "ai",
    surface: "structuredApi",
    dryRun: input.dryRun,
    basePackageRevision: input.basePackageRevision,
    idempotencyKey: "ai-add-keyform-body-yaw-mesh-body",
    trace: {
      relatedAC: ["AC-AI-006", "AC-MVP-014"],
      relatedScenarios: ["SC-AGENT-002"]
    },
    operationType: "addKeyform",
    payload: {
      target: {
        kind: "mesh",
        id: "mesh_body"
      },
      targetProperty: "vertices",
      parameterId: BODY_YAW_PARAMETER_ID,
      keyValue: 1,
      interpolation: "linear-1d-v1",
      statePatch: {
        propertyPath: "vertices",
        value: [
          { x: 0, y: 0 },
          { x: 36, y: 0 },
          { x: 0, y: 32 }
        ],
        valueSchemaHint: "mesh.vertices"
      }
    }
  });

const createAiCreateGridParameterOperation = (input: {
  readonly name: "grid_yaw" | "grid_pitch";
  readonly parameterId: typeof GRID_YAW_PARAMETER_ID | typeof GRID_PITCH_PARAMETER_ID;
  readonly displayName: string;
  readonly dryRun: boolean;
  readonly basePackageRevision: number;
}) =>
  OperationRequestSchema.parse({
    schemaVersion: "operation-request-v1",
    operationId: `op_ai_create_parameter_${input.name}`,
    actor: "ai",
    surface: "structuredApi",
    dryRun: input.dryRun,
    basePackageRevision: input.basePackageRevision,
    idempotencyKey: `ai-create-parameter-${input.name}`,
    trace: {
      relatedAC: ["AC-AI-006", "AC-MVP-014"],
      relatedScenarios: ["SC-AGENT-002"]
    },
    operationType: "createParameter",
    payload: {
      parameterId: input.parameterId,
      displayName: input.displayName,
      semanticRole: "body",
      projectPresetAlias: `private-ai-${input.name.replace("_", "-")}-control`,
      valueSource: "authoredInput",
      min: -1,
      max: 1,
      default: 0,
      recommendedUiStep: 0.01
    }
  });

const createAiAddKeyformGrid2dOperation = (input: {
  readonly dryRun: boolean;
  readonly basePackageRevision: number;
}) =>
  OperationRequestSchema.parse({
    schemaVersion: "operation-request-v1",
    operationId: GRID2D_KEYFORM_OPERATION_ID,
    actor: "ai",
    surface: "structuredApi",
    dryRun: input.dryRun,
    basePackageRevision: input.basePackageRevision,
    idempotencyKey: "ai-add-keyform-grid2d-body",
    trace: {
      relatedAC: ["AC-AI-006", "AC-PARAM-005", "AC-MVP-014"],
      relatedScenarios: ["SC-AGENT-002", "SC-PARAM-004"]
    },
    operationType: "addKeyformGrid2d",
    payload: {
      target: {
        kind: "mesh",
        id: "mesh_body"
      },
      targetProperty: "vertices",
      parameterX: GRID_YAW_PARAMETER_ID,
      parameterY: GRID_PITCH_PARAMETER_ID,
      evaluator: "parameter-grid-2d-v1",
      interpolation: "bilinear-grid-v1",
      clampPolicy: "clamp-to-parameter-range",
      keys: [
        {
          x: -1,
          y: -1,
          statePatch: [
            { x: -2, y: 0 },
            { x: 32, y: 0 },
            { x: 0, y: 32 }
          ]
        },
        {
          x: -1,
          y: 1,
          statePatch: [
            { x: -1, y: 0 },
            { x: 34, y: 0 },
            { x: 0, y: 32 }
          ]
        },
        {
          x: 1,
          y: -1,
          statePatch: [
            { x: 1, y: 0 },
            { x: 34, y: 0 },
            { x: 0, y: 32 }
          ]
        },
        {
          x: 1,
          y: 1,
          statePatch: [
            { x: 2, y: 0 },
            { x: 36, y: 0 },
            { x: 0, y: 32 }
          ]
        }
      ]
    }
  });

const createWorkflow = (storage: StorageLike) =>
  createEditorWorkflowController({
    projectStore: createBrowserProjectStore({
      storage,
      now: () => new Date("2026-05-29T05:00:00.000Z")
    }),
    now: () => new Date("2026-05-29T05:00:00.000Z")
  });

const asRecord = (value: unknown): Record<string, unknown> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Expected an object value.");
  }

  return value as Record<string, unknown>;
};

const parseRuntimeSnapshotArtifact = (
  packageFileSet: PackageFileSet,
  snapshotId: RuntimeSnapshotDto["snapshotId"]
): RuntimeSnapshotDto => {
  const path = createRuntimeSnapshotArtifactPath(snapshotId);
  const entry = packageFileSet.find((candidate) => candidate.path === path);
  if (entry === undefined) {
    throw new Error(`Missing runtime snapshot artifact ${path}.`);
  }

  return RuntimeSnapshotSchema.parse(JSON.parse(entry.text));
};

const asArray = (value: unknown): readonly unknown[] => {
  if (!Array.isArray(value)) {
    throw new Error("Expected an array value.");
  }

  return value;
};

const createMemoryStorage = (
  entries: readonly (readonly [string, string])[] = []
): StorageLike => {
  const values = new Map(entries);

  return {
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
    removeItem(key) {
      values.delete(key);
    }
  };
};
