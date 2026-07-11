export const physiologyBridgeChannels = {
  getStatus: "runtime-player:physiology:get-status",
  updateTone: "runtime-player:physiology:update-tone",
  setStagePresenceEnabled:
    "runtime-player:physiology:set-stage-presence-enabled",
  resetSection: "runtime-player:physiology:reset-section",
  retryProfileSave: "runtime-player:physiology:retry-profile-save",
  statusChanged: "runtime-player:physiology:status-changed"
} as const;
