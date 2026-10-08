import { describe, expect, it } from "vitest";

import type { RuntimeExportLoadedPayload } from "../../preload/runtime-export-bridge-contract";
import {
  DEFAULT_GAZE_BASELINE,
  DEFAULT_HEAD_BASELINE
} from "../physiology";
import {
  createPhysiologyRuntimeExportIdentity
} from "./physiology-export-identity";
import {
  physiologyProfileSchemaVersion,
  type PhysiologyProfileDocument
} from "./physiology-profile-document";
import type {
  PhysiologyProfileStoreLoadResult
} from "./physiology-profile-store";
import { RuntimePlayerPhysiologyState } from "./physiology-state";

describe("RuntimePlayerPhysiologyState", () => {
  it("reports availability as data (Autonomous = true, Tracking = false)", () => {
    const autonomous = new RuntimePlayerPhysiologyState({
      isAvailable: () => true
    });
    const tracking = new RuntimePlayerPhysiologyState({
      isAvailable: () => false
    });

    expect(autonomous.getStatus().available).toBe(true);
    expect(tracking.getStatus().available).toBe(false);
  });

  it("returns the full universal grammar by default and a STABLE ref until a knob moves", () => {
    const state = new RuntimePlayerPhysiologyState();

    const first = state.getPhysiologyConfig();
    const second = state.getPhysiologyConfig();

    // Provider contract (Domain A relies on this): stable reference while unchanged.
    expect(second).toBe(first);
    // Default-ON = full physiology (視線・頭・姿勢 alive without any profile).
    expect(first.gaze).toEqual(DEFAULT_GAZE_BASELINE);
    expect(first.head).toEqual(DEFAULT_HEAD_BASELINE);
    expect(first.stagePresence).toEqual({ enabled: false, strength: 0.3 });
  });

  it("hands a NEW config reference only after a tone change (heart rebuild seam)", () => {
    const state = new RuntimePlayerPhysiologyState();
    state.setRuntimeExportPayload(createPayload());

    const before = state.getPhysiologyConfig();
    state.updateTone({ section: "head", field: "sway", tone: 0.9 });
    const after = state.getPhysiologyConfig();

    expect(after).not.toBe(before);
    expect(after.head?.sway).not.toBe(before.head?.sway);
    // Unchanged again → stable ref.
    expect(state.getPhysiologyConfig()).toBe(after);
  });

  it("refuses tone edits before a Runtime Export is loaded", () => {
    const state = new RuntimePlayerPhysiologyState();
    expect(() =>
      state.updateTone({ section: "gaze", field: "dwell", tone: 0.2 })
    ).toThrow(/Runtime Export/);
    expect(state.getStatus().status).toBe("unavailable");
  });

  it("restores a saved profile's overrides into the config and status", () => {
    const state = new RuntimePlayerPhysiologyState();
    const payload = createPayload();
    const identity = createPhysiologyRuntimeExportIdentity(payload);
    const loadResult: PhysiologyProfileStoreLoadResult = {
      identity,
      profileFilePath: "unused",
      state: "loaded",
      warningMessages: [],
      profile: createProfileDocument(identity.fingerprint, {
        gaze: { cameraFocus: 0.9 }
      })
    };

    const status = state.setRuntimeExportPayload(payload, loadResult);

    expect(status.profileStatus.kind).toBe("restored");
    const gazeSection = status.sections.find(
      (section) => section.section === "gaze"
    );
    expect(gazeSection?.hasOverride).toBe(true);
    expect(gazeSection?.tones.cameraFocus).toBe(0.9);
    // The config the heart reads reflects the restored override.
    expect(state.getPhysiologyConfig().gaze?.cameraFocus).toBeGreaterThan(
      DEFAULT_GAZE_BASELINE.cameraFocus
    );
  });

  it("treats a schema-version reject as stale and keeps universal defaults", () => {
    const state = new RuntimePlayerPhysiologyState();
    const payload = createPayload();
    const identity = createPhysiologyRuntimeExportIdentity(payload);
    const loadResult: PhysiologyProfileStoreLoadResult = {
      identity,
      profileFilePath: "unused",
      state: "read-failed",
      profile: null,
      warningMessages: ["Physiology profile schema version is unsupported."]
    };

    const status = state.setRuntimeExportPayload(payload, loadResult);

    expect(status.profileStatus.kind).toBe("stale");
    expect(state.getPhysiologyConfig().gaze).toEqual(DEFAULT_GAZE_BASELINE);
  });

  it("resets a section back to the universal default", () => {
    const state = new RuntimePlayerPhysiologyState();
    state.setRuntimeExportPayload(createPayload());
    state.updateTone({ section: "posture", field: "drift", tone: 0.95 });

    let posture = state
      .getStatus()
      .sections.find((section) => section.section === "posture");
    expect(posture?.hasOverride).toBe(true);

    state.resetSection("posture");
    posture = state
      .getStatus()
      .sections.find((section) => section.section === "posture");
    expect(posture?.hasOverride).toBe(false);
    expect(posture?.tones.drift).toBe(0.5);
  });

  it("carries the Speech Articulation tone into the config dip floor and resets it (§13)", () => {
    const state = new RuntimePlayerPhysiologyState();
    state.setRuntimeExportPayload(createPayload());

    const before = state.getPhysiologyConfig().speech?.articulationFloor ?? 1;
    // Crisper (tone 1) = deeper dip = LOWER floor.
    state.updateTone({ section: "speech", field: "articulation", tone: 1 });
    const after = state.getPhysiologyConfig().speech?.articulationFloor ?? 1;
    expect(after).toBeLessThan(before);

    const speechSection = state
      .getStatus()
      .sections.find((section) => section.section === "speech");
    expect(speechSection?.hasOverride).toBe(true);
    expect(speechSection?.tones.articulation).toBe(1);

    state.resetSection("speech");
    expect(
      state
        .getStatus()
        .sections.find((section) => section.section === "speech")?.hasOverride
    ).toBe(false);
    // Back to the weak default floor.
    expect(state.getPhysiologyConfig().speech?.articulationFloor).toBe(before);
  });

  it("writes the Stage Presence Strength tone through updateTone (F1 regression)", () => {
    const state = new RuntimePlayerPhysiologyState();
    state.setRuntimeExportPayload(createPayload());

    const before = state.getPhysiologyConfig();
    // The page dispatches Strength through the generic tone path; the state must
    // accept it (F1: it previously threw「stagePresence has no tone sliders」).
    const status = state.updateTone({
      section: "stagePresence",
      field: "strength",
      tone: 0.75
    });

    const stage = status.sections.find(
      (section) => section.section === "stagePresence"
    );
    expect(stage?.hasOverride).toBe(true);
    expect(stage?.tones.strength).toBe(0.75);

    // The strength override reaches the config the heart / Domain D reads, with a
    // NEW reference (reference contract) — no longer pinned at the 0.3 default.
    const after = state.getPhysiologyConfig();
    expect(after).not.toBe(before);
    expect(after.stagePresence?.strength).toBe(0.75);
    expect(state.getPhysiologyConfig()).toBe(after);
  });

  it("keeps Stage Presence enabled and strength independent overrides", () => {
    const state = new RuntimePlayerPhysiologyState();
    state.setRuntimeExportPayload(createPayload());

    state.setStagePresenceEnabled(true);
    state.updateTone({ section: "stagePresence", field: "strength", tone: 0.6 });

    const config = state.getPhysiologyConfig();
    expect(config.stagePresence).toEqual({ enabled: true, strength: 0.6 });

    // Reset returns both to universal defaults.
    state.resetSection("stagePresence");
    expect(state.getPhysiologyConfig().stagePresence).toEqual({
      enabled: false,
      strength: 0.3
    });
  });

  it("toggles Stage Presence enabled (既定 Off) through the state", () => {
    const state = new RuntimePlayerPhysiologyState();
    state.setRuntimeExportPayload(createPayload());

    const off = state
      .getStatus()
      .sections.find((section) => section.section === "stagePresence");
    expect(off?.stagePresenceEnabled).toBe(false);

    state.setStagePresenceEnabled(true);
    const on = state
      .getStatus()
      .sections.find((section) => section.section === "stagePresence");
    expect(on?.stagePresenceEnabled).toBe(true);
    expect(state.getPhysiologyConfig().stagePresence?.enabled).toBe(true);
  });
});

function createProfileDocument(
  fingerprint: string,
  overrides: PhysiologyProfileDocument["overrides"]
): PhysiologyProfileDocument {
  return {
    schemaVersion: physiologyProfileSchemaVersion,
    createdAtIso: "2026-07-01T00:00:00.000Z",
    updatedAtIso: "2026-07-01T00:01:00.000Z",
    exportIdentity: {
      packageId: "pkg_physiology_test",
      packageRevision: 1,
      fingerprint
    },
    overrides
  };
}

function createPayload(): RuntimeExportLoadedPayload {
  const sourcePackage = {
    packageId: "pkg_physiology_test",
    packageDisplayName: "Physiology Test",
    packageRevision: 1,
    packageHash: "sha256:physiology-test"
  };

  return {
    artifacts: {
      manifest: { sourcePackage, texturePages: [] },
      model: { sourcePackage, parameters: [] },
      atlas: {}
    },
    summary: {
      packageId: sourcePackage.packageId,
      packageRevision: sourcePackage.packageRevision,
      modelDisplayName: sourcePackage.packageDisplayName
    },
    loadedAtIso: "2026-07-01T00:00:00.000Z"
  } as unknown as RuntimeExportLoadedPayload;
}
