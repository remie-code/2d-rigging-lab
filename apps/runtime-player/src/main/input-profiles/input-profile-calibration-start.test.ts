import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import type {
  RuntimePlayerInputCalibrationPromptKey
} from "../../preload/input-profile-bridge-contract";
import type { TrackingFrame } from "../../preload/input-tracking-frame-contract";
import { createTemporaryDefaultInputProfile } from "./input-profile-defaults";
import {
  createInputProfileCalibrationSessionStart,
  findInputProfileById
} from "./input-profile-calibration-start";
import { InputProfileStore } from "./input-profile-store";

describe("createInputProfileCalibrationSessionStart", () => {
  it("starts missing-only head position calibration for old saved profiles", async () => {
    const store = await createStoreWithProfile();

    const result = await createInputProfileCalibrationSessionStart({
      command: {
        displayName: "Desk",
        mode: "missing-only"
      },
      store,
      temporaryDefaultsActive: false,
      startedAtMs: 1000
    });

    expect(result.result).toBe("ok");
    expect(result.result === "ok" ? result.session.getSnapshot() : null)
      .toMatchObject({
        mode: "missing-only",
        section: "head-position",
        targetProfileId: "profile_desk",
        prompts: [
          { key: "look-forward" },
          { key: "head-position-left" },
          { key: "head-position-right" }
        ],
        totalPromptCount: 3
      });
  });

  it("starts full missing-only calibration when no saved profile exists", async () => {
    const store = new InputProfileStore({
      userDataPath: await mkdtemp(
        path.join(os.tmpdir(), "runtime-player-calibration-start-")
      )
    });

    const result = await createInputProfileCalibrationSessionStart({
      command: {
        displayName: "Desk",
        mode: "missing-only"
      },
      store,
      temporaryDefaultsActive: false,
      startedAtMs: 1000
    });

    expect(result.result).toBe("ok");
    const snapshot = result.result === "ok"
      ? result.session.getSnapshot()
      : null;

    expect(snapshot).toMatchObject({
      mode: "missing-only",
      currentPrompt: { key: "look-forward" }
    });
    expect(snapshot).not.toHaveProperty("targetProfileId");
    expect(
      result.result === "ok" ? result.session.getSnapshot().totalPromptCount : 0
    ).toBeGreaterThan(3);
  });

  it("rejects head position section calibration without a saved profile", async () => {
    const store = new InputProfileStore({
      userDataPath: await mkdtemp(
        path.join(os.tmpdir(), "runtime-player-calibration-start-")
      )
    });

    const result = await createInputProfileCalibrationSessionStart({
      command: {
        displayName: "Desk",
        mode: "section",
        section: "head-position"
      },
      store,
      temporaryDefaultsActive: false,
      startedAtMs: 1000
    });

    expect(result).toEqual({
      result: "unavailable",
      message: "Head position recalibration needs a saved input profile."
    });
  });

  it("finds saved profiles by id for section update finish", async () => {
    const store = await createStoreWithProfile();

    await expect(findInputProfileById(store, "profile_desk"))
      .resolves.toMatchObject({
        profileId: "profile_desk"
      });
    await expect(findInputProfileById(store, "missing"))
      .resolves.toBeNull();
  });

  it("persists old-profile head position upgrades without replacing the profile", async () => {
    const store = await createStoreWithProfile();
    const before = await findInputProfileById(store, "profile_desk");

    const start = await createInputProfileCalibrationSessionStart({
      command: {
        displayName: "Desk",
        mode: "missing-only"
      },
      store,
      temporaryDefaultsActive: false,
      startedAtMs: 1000
    });

    expect(start.result).toBe("ok");
    if (start.result !== "ok" || before === null) {
      throw new Error("Expected a persisted old profile calibration session.");
    }

    recordCurrentPrompt(start.session, "look-forward");
    recordCurrentPrompt(start.session, "head-position-left");
    recordCurrentPrompt(start.session, "head-position-right");

    const baseProfile = await findInputProfileById(
      store,
      start.session.getTargetProfileId() ?? ""
    );

    if (baseProfile === null) {
      throw new Error("Expected active profile to exist before update.");
    }

    const updated = start.session.createUpdatedProfile({
      profile: baseProfile,
      updatedAtIso: "2026-06-23T00:00:00.000Z"
    });

    await store.saveProfile(updated);

    const snapshot = await store.getSnapshot();
    const persisted = snapshot.document.profiles[0];
    const written = JSON.parse(
      await readFile(store.getProfileFilePath(), "utf8")
    ) as {
      readonly activeProfileId?: string;
      readonly profiles?: readonly unknown[];
    };

    expect(snapshot.document.activeProfileId).toBe("profile_desk");
    expect(written.activeProfileId).toBe("profile_desk");
    expect(written.profiles).toHaveLength(1);
    expect(persisted).toMatchObject({
      profileId: "profile_desk",
      displayName: "Desk",
      createdAtIso: "2026-06-22T00:00:00.000Z",
      updatedAtIso: "2026-06-23T00:00:00.000Z"
    });
    expect(persisted?.calibration.headRotationEulerDeg).toEqual(
      before.calibration.headRotationEulerDeg
    );
    expect(persisted?.calibration.eyes).toEqual(before.calibration.eyes);
    expect(persisted?.calibration.mouth).toEqual(before.calibration.mouth);
    expect(persisted?.calibration.headPositionRaw).toEqual({
      neutral: { x: 0, y: 0, z: 0 },
      min: { x: -0.18, y: 0, z: 0 },
      max: { x: 0.34, y: 0, z: 0 },
      learnedSigns: {
        bodyLeft: { axis: "x", direction: -1 },
        bodyRight: { axis: "x", direction: 1 }
      }
    });
  });
});

async function createStoreWithProfile(): Promise<InputProfileStore> {
  const userDataPath = await mkdtemp(
    path.join(os.tmpdir(), "runtime-player-calibration-start-")
  );
  const store = new InputProfileStore({ userDataPath });
  const profile = {
    ...createTemporaryDefaultInputProfile("2026-06-22T00:00:00.000Z"),
    profileId: "profile_desk",
    displayName: "Desk"
  };

  await store.saveProfile(profile);

  return store;
}

function recordCurrentPrompt(
  session: {
    readonly getSnapshot: () => {
      readonly currentPrompt: { readonly key: RuntimePlayerInputCalibrationPromptKey } | null;
    };
    readonly recordSample: (frame: TrackingFrame) => unknown;
    readonly advancePrompt: () => unknown;
  },
  promptKey: RuntimePlayerInputCalibrationPromptKey
): void {
  expect(session.getSnapshot().currentPrompt?.key).toBe(promptKey);

  const sampleCount = promptKey === "look-forward" ? 1 : 2;

  for (let index = 0; index < sampleCount; index += 1) {
    session.recordSample(createFrame(promptKey));
  }

  session.advancePrompt();
}

function createFrame(
  promptKey: RuntimePlayerInputCalibrationPromptKey
): TrackingFrame {
  return {
    source: "ifacialmocap",
    transport: "udp",
    timestampMs: 1000,
    blendshapes: {},
    head: {
      rotationEulerDeg: { x: 0, y: 0, z: 0 },
      positionRaw: createHeadPosition(promptKey)
    }
  };
}

function createHeadPosition(
  promptKey: RuntimePlayerInputCalibrationPromptKey
) {
  switch (promptKey) {
    case "head-position-left":
      return { x: -0.18, y: 0, z: 0 };
    case "head-position-right":
      return { x: 0.34, y: 0, z: 0 };
    default:
      return { x: 0, y: 0, z: 0 };
  }
}
