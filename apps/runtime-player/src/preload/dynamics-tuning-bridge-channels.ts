export const dynamicsTuningBridgeChannels = {
  getStatus: "runtime-player:dynamics-tuning:get-status",
  updateGroup: "runtime-player:dynamics-tuning:update-group",
  resetGroup: "runtime-player:dynamics-tuning:reset-group",
  retryProfileSave: "runtime-player:dynamics-tuning:retry-profile-save",
  statusChanged: "runtime-player:dynamics-tuning:status-changed",
  getEffectiveProfile: "runtime-player:dynamics-tuning:get-effective-profile",
  effectiveProfileChanged:
    "runtime-player:dynamics-tuning:effective-profile-changed"
} as const;
