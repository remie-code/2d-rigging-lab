import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { runAuthoringHostCommand } from "./run-authoring-host-command.js";
import type { AuthoringHostCommandResponse } from "./authoring-host-response.js";
import {
  buildCommitCommand,
  buildDryRunCommand,
  type OperationPayloadInput
} from "./test-support/command-builders.js";
import {
  writeEyeSmokeFixturePackage,
  type EyeSmokeFixtureIds
} from "./test-support/authoring-host-fixtures.js";

const createdRoots: string[] = [];

afterEach(async () => {
  await Promise.all(createdRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

const fixedNow = (): Date => new Date("2026-07-02T12:34:56.000Z");

interface SmokeContext {
  readonly packageDirectory: string;
  readonly stateDirectory: string;
}

const applyOperationThroughHost = async (
  context: SmokeContext,
  operation: Omit<OperationPayloadInput, "dryRun">
): Promise<AuthoringHostCommandResponse> => {
  const dryRunCommandId = `cmd_${operation.operationId}_dry`;
  const dryRun = await runAuthoringHostCommand({
    packageDirectory: context.packageDirectory,
    stateDirectory: context.stateDirectory,
    now: fixedNow,
    command: buildDryRunCommand({ commandId: dryRunCommandId, operation })
  });

  if (dryRun.outcome !== "success") {
    return dryRun;
  }

  return runAuthoringHostCommand({
    packageDirectory: context.packageDirectory,
    stateDirectory: context.stateDirectory,
    now: fixedNow,
    command: buildCommitCommand({
      commandId: `cmd_${operation.operationId}_commit`,
      approvedDryRunCommandId: dryRunCommandId,
      operation
    })
  });
};

const readModelFile = async (packageDirectory: string, fileName: string): Promise<unknown> =>
  JSON.parse(await readFile(join(packageDirectory, "model", fileName), "utf8")) as unknown;

describe("closed problem 01 headless smoke", () => {
  it("runs generateMesh, createWarpDeformer, createParameter, editKeyformKey(createEndsCenter), and setMaskRelation via the CLI host", async () => {
    const root = await mkdtemp(join(tmpdir(), "authoring-host-smoke-"));
    createdRoots.push(root);
    const context: SmokeContext = {
      packageDirectory: join(root, "package"),
      stateDirectory: join(root, "state")
    };
    const fixture = await writeEyeSmokeFixturePackage(context.packageDirectory);
    const ids: EyeSmokeFixtureIds = fixture.ids;

    let revision = fixture.packageRevision;

    // 1. generateMesh: re-generate the eye mesh (the drawable already carries a mesh).
    const meshResult = await applyOperationThroughHost(context, {
      operationType: "generateMesh",
      operationId: "op_smoke_generate_mesh",
      basePackageRevision: revision,
      payload: {
        drawableId: ids.eyeDrawableId,
        method: "auto-grid-v1",
        densityHint: "medium"
      }
    });
    expect(meshResult.outcome).toBe("success");
    expect(meshResult.saved).toBe(true);
    revision = meshResult.packageRevision ?? revision;

    // 2. createWarpDeformer over the white-eye mask drawable.
    const warpResult = await applyOperationThroughHost(context, {
      operationType: "createWarpDeformer",
      operationId: "op_smoke_create_warp",
      basePackageRevision: revision,
      payload: {
        displayName: "Eye Mask Warp",
        childDrawableIds: [ids.eyeMaskDrawableId],
        domainBounds: { x: 0, y: 0, width: 1, height: 1 },
        transformColumns: 5,
        transformRows: 4,
        bezierColumns: 2,
        bezierRows: 2
      }
    });
    expect(warpResult.outcome).toBe("success");
    expect(warpResult.saved).toBe(true);
    revision = warpResult.packageRevision ?? revision;

    // 3. createParameter with distinct min/default/max so an Ends+Center key set is valid.
    const parameterResult = await applyOperationThroughHost(context, {
      operationType: "createParameter",
      operationId: "op_smoke_create_parameter",
      basePackageRevision: revision,
      payload: {
        parameterId: ids.parameterId,
        displayName: "Eye Open",
        valueSource: "authoredInput",
        min: -1,
        max: 1,
        default: 0,
        recommendedUiStep: 0.01
      }
    });
    expect(parameterResult.outcome).toBe("success");
    revision = parameterResult.packageRevision ?? revision;

    // 4. editKeyformKey(createEndsCenter) — THE closed-problem-01 uncertainty. This is the
    // first keyform touch for (eye drawable opacity, eye-open parameter): there is no prior
    // keyform set, so a passing commit proves createEndsCenter creates the min/default/max
    // key set standalone from an empty state.
    const keyformsBefore = (await readModelFile(context.packageDirectory, "keyforms.json")) as {
      readonly keyformSets: readonly { readonly keyformSetId: string }[];
    };
    expect(keyformsBefore.keyformSets).toHaveLength(0);

    const endsCenterResult = await applyOperationThroughHost(context, {
      operationType: "editKeyformKey",
      operationId: "op_smoke_ends_center",
      basePackageRevision: revision,
      payload: {
        action: "createEndsCenter",
        target: { kind: "drawable", id: ids.eyeDrawableId },
        targetProperty: "opacity",
        parameterId: ids.parameterId,
        interpolation: "linear-1d-v1",
        statePatches: {
          min: { propertyPath: "opacity", value: 0 },
          default: { propertyPath: "opacity", value: 0.5 },
          max: { propertyPath: "opacity", value: 1 }
        }
      }
    });

    // Explicit createEndsCenter standalone assertion (see report): it committed and created
    // a brand-new keyform set with all three keys at the parameter min/default/max positions.
    expect(endsCenterResult.outcome).toBe("success");
    expect(endsCenterResult.aiCommandStatus).toBe("ok");
    expect(endsCenterResult.saved).toBe(true);
    revision = endsCenterResult.packageRevision ?? revision;

    const keyformsAfter = (await readModelFile(context.packageDirectory, "keyforms.json")) as {
      readonly keyformSets: readonly {
        readonly target: { readonly kind: string; readonly id: string; readonly property: string };
        readonly parameterId: string;
        readonly keys: readonly { readonly value: number; readonly statePatch: unknown }[];
      }[];
    };
    expect(keyformsAfter.keyformSets).toHaveLength(1);
    const createdKeyformSet = keyformsAfter.keyformSets[0];
    expect(createdKeyformSet?.target).toMatchObject({
      kind: "drawable",
      id: ids.eyeDrawableId,
      property: "opacity"
    });
    expect(createdKeyformSet?.parameterId).toBe(ids.parameterId);
    expect(createdKeyformSet?.keys).toEqual([
      { value: -1, statePatch: 0 },
      { value: 0, statePatch: 0.5 },
      { value: 1, statePatch: 1 }
    ]);

    // 5. setMaskRelation: clip the eye by the white-eye mask.
    const maskResult = await applyOperationThroughHost(context, {
      operationType: "setMaskRelation",
      operationId: "op_smoke_set_mask",
      basePackageRevision: revision,
      payload: {
        maskDrawableIds: [ids.eyeMaskDrawableId],
        targetDrawableIds: [ids.eyeDrawableId],
        enabled: true
      }
    });
    expect(maskResult.outcome).toBe("success");
    expect(maskResult.saved).toBe(true);

    const masks = (await readModelFile(context.packageDirectory, "masks.json")) as {
      readonly masks: readonly {
        readonly maskDrawableIds: readonly string[];
        readonly targetDrawableIds: readonly string[];
        readonly enabled: boolean;
      }[];
    };
    expect(masks.masks).toHaveLength(1);
    expect(masks.masks[0]).toMatchObject({
      maskDrawableIds: [ids.eyeMaskDrawableId],
      targetDrawableIds: [ids.eyeDrawableId],
      enabled: true
    });
  }, 60_000);
});
