import type {
  RuntimePlayerInputCalibrationMode,
  RuntimePlayerInputCalibrationSectionKey
} from "../../preload/input-profile-bridge-contract";
import type { InputProfile } from "./input-profile-document";
import { InputProfileCalibrationSession } from "./input-profile-calibration-session";
import {
  getCalibrationPromptKeysForSections,
  getMissingInputProfileCalibrationSections
} from "./input-profile-calibration-sections";
import {
  InputProfileStore,
  type InputProfileStoreSnapshot
} from "./input-profile-store";

export type InputProfileCalibrationStartCommand = {
  readonly displayName: string;
  readonly mode: RuntimePlayerInputCalibrationMode;
  readonly section?: RuntimePlayerInputCalibrationSectionKey;
};

export type InputProfileCalibrationSessionStartResult =
  | {
      readonly result: "ok";
      readonly message: string;
      readonly session: InputProfileCalibrationSession;
    }
  | {
      readonly result: "unavailable";
      readonly message: string;
    };

export async function createInputProfileCalibrationSessionStart(input: {
  readonly command: InputProfileCalibrationStartCommand;
  readonly store: InputProfileStore;
  readonly temporaryDefaultsActive: boolean;
  readonly startedAtMs: number;
}): Promise<InputProfileCalibrationSessionStartResult> {
  if (input.command.mode === "full") {
    return {
      result: "ok",
      message: "Input calibration started.",
      session: createFullCalibrationSession({
        displayName: input.command.displayName,
        startedAtMs: input.startedAtMs
      })
    };
  }

  const editableProfile = await findEditableActiveProfile({
    store: input.store,
    temporaryDefaultsActive: input.temporaryDefaultsActive
  });

  if (input.command.mode === "section") {
    if (input.command.section !== "head-position") {
      return {
        result: "unavailable",
        message: "Only head position section calibration is supported."
      };
    }

    if (editableProfile === null) {
      return {
        result: "unavailable",
        message: "Head position recalibration needs a saved input profile."
      };
    }

    return {
      result: "ok",
      message: "Head position calibration started.",
      session: createHeadPositionCalibrationSession({
        mode: "section",
        profile: editableProfile,
        startedAtMs: input.startedAtMs
      })
    };
  }

  if (editableProfile === null) {
    return {
      result: "ok",
      message: "Input calibration started.",
      session: createFullCalibrationSession({
        displayName: input.command.displayName,
        startedAtMs: input.startedAtMs,
        mode: "missing-only"
      })
    };
  }

  const missingSections = getMissingInputProfileCalibrationSections(
    editableProfile.calibration
  );

  if (missingSections.length === 0) {
    return {
      result: "unavailable",
      message: "No missing input profile calibration sections."
    };
  }

  if (
    missingSections.length !== 1 ||
    missingSections[0] !== "head-position"
  ) {
    return {
      result: "unavailable",
      message: "Only missing head position calibration is supported."
    };
  }

  return {
    result: "ok",
    message: "Missing head position calibration started.",
    session: createHeadPositionCalibrationSession({
      mode: "missing-only",
      profile: editableProfile,
      startedAtMs: input.startedAtMs
    })
  };
}

export async function findInputProfileById(
  store: InputProfileStore,
  profileId: string
): Promise<InputProfile | null> {
  const snapshot = await store.getSnapshot();

  return snapshot.document.profiles.find(
    (profile) => profile.profileId === profileId
  ) ?? null;
}

function createFullCalibrationSession(input: {
  readonly displayName: string;
  readonly startedAtMs: number;
  readonly mode?: "full" | "missing-only";
}): InputProfileCalibrationSession {
  return new InputProfileCalibrationSession({
    sessionId: `calibration_${input.startedAtMs}`,
    displayName: input.displayName,
    mode: input.mode ?? "full",
    startedAtMs: input.startedAtMs
  });
}

function createHeadPositionCalibrationSession(input: {
  readonly mode: "missing-only" | "section";
  readonly profile: InputProfile;
  readonly startedAtMs: number;
}): InputProfileCalibrationSession {
  return new InputProfileCalibrationSession({
    sessionId: `calibration_${input.startedAtMs}`,
    displayName: input.profile.displayName,
    mode: input.mode,
    section: "head-position",
    targetProfileId: input.profile.profileId,
    promptKeys: getCalibrationPromptKeysForSections(["head-position"]),
    startedAtMs: input.startedAtMs
  });
}

async function findEditableActiveProfile(input: {
  readonly store: InputProfileStore;
  readonly temporaryDefaultsActive: boolean;
}): Promise<InputProfile | null> {
  if (input.temporaryDefaultsActive) {
    return null;
  }

  const snapshot = await input.store.getSnapshot();

  if (snapshot.state === "read-failed") {
    return null;
  }

  return findActiveProfile(snapshot);
}

function findActiveProfile(
  snapshot: InputProfileStoreSnapshot
): InputProfile | null {
  const activeProfileId = snapshot.document.activeProfileId;

  if (activeProfileId !== undefined) {
    const activeProfile = snapshot.document.profiles.find(
      (profile) => profile.profileId === activeProfileId
    );

    if (activeProfile !== undefined) {
      return activeProfile;
    }
  }

  return snapshot.document.profiles[0] ?? null;
}
