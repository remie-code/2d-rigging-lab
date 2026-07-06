export const modelMappingBridgeChannels = {
  getStatus: "runtime-player:model-mapping:get-status",
  regenerateAutoMapping: "runtime-player:model-mapping:regenerate-auto-mapping",
  resetToAutoMap: "runtime-player:model-mapping:reset-to-auto-map",
  retryProfileSave: "runtime-player:model-mapping:retry-profile-save",
  updateSlot: "runtime-player:model-mapping:update-slot",
  setVowelLipsyncEnabled:
    "runtime-player:model-mapping:set-vowel-lipsync-enabled",
  statusChanged: "runtime-player:model-mapping:status-changed"
} as const;
