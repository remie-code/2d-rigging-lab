import type {
  InputProfile,
  InputProfileCalibration
} from "./input-profile-document";

export const temporaryDefaultInputProfileId =
  "temporary_ifacialmocap_defaults";

export function createTemporaryDefaultInputProfile(
  nowIso = new Date(0).toISOString()
): InputProfile {
  return {
    profileId: temporaryDefaultInputProfileId,
    displayName: "Temporary Defaults",
    source: "ifacialmocap",
    transport: "udp",
    createdAtIso: nowIso,
    updatedAtIso: nowIso,
    calibration: createDefaultInputProfileCalibration()
  };
}

export function createDefaultInputProfileCalibration(): InputProfileCalibration {
  return {
    headRotationEulerDeg: {
      neutral: { x: 0, y: 0, z: 0 },
      min: { x: -20, y: -30, z: -15 },
      max: { x: 20, y: 30, z: 15 },
      learnedSigns: {
        faceLeft: { axis: "y", direction: 1 },
        faceRight: { axis: "y", direction: -1 },
        lookUp: { axis: "x", direction: 1 },
        lookDown: { axis: "x", direction: -1 },
        tiltLeft: { axis: "z", direction: 1 },
        tiltRight: { axis: "z", direction: -1 }
      }
    },
    eyes: {
      neutral: { x: 0, y: 0, z: 0 },
      min: { x: -15, y: -15, z: -5 },
      max: { x: 15, y: 15, z: 5 },
      blinkLeftMin: 0,
      blinkLeftMax: 1,
      blinkRightMin: 0,
      blinkRightMax: 1,
      learnedSigns: {
        eyesLeft: { axis: "y", direction: 1 },
        eyesRight: { axis: "y", direction: -1 },
        eyesUp: { axis: "x", direction: 1 },
        eyesDown: { axis: "x", direction: -1 }
      }
    },
    mouth: {
      jawOpenMin: 0,
      jawOpenMax: 0.8,
      smileMin: 0,
      smileMax: 0.7
    }
  };
}
