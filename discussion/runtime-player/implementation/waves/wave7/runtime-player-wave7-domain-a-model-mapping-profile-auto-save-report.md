# Runtime Player Wave7 Domain A Report: Model Mapping Profile Auto Save

verdict: `pass`

## Scope

Wave7 Domain A implemented per-Runtime-Export Model Mapping / Body Follow profile auto-save and restore for Runtime Player.

Domain A covered:

- Deterministic Runtime Export identity for model mapping profile storage.
- Per-model profile load on Runtime Export open.
- Restore of editable mapping slots and Body Follow controls.
- Debounced auto-save after Mapping / Body Follow edits.
- Flush before Runtime Export switch/clear and app quit in normal lifecycle.
- Mapping page profile status, warning details, `Retry`, and `Reset to Auto Map`.
- Concise Overview mapping profile status.
- Corrupt/missing profile fallback to Auto Map with visible status.
- Stale target restore fallback with visible warning/status.

Out of scope preserved:

- No Player general parameter editing UX.
- No raw tracking frames moved into Stage.
- No Stage page/window-state ownership taken by Domain A.
- No manual `Save Mapping` button.

## Implementation Summary

Runtime Export identity:

- `apps/runtime-player/src/main/model-mapping-profiles/model-mapping-export-identity.ts`
  creates `ModelMappingRuntimeExportIdentity`.
- `manifest.sourcePackage.packageHash` is preferred for the profile fingerprint.
- When `packageHash` is absent, fallback identity uses `packageId + packageRevision + parameterSignatureHash`.
- `parameterSignatureHash` is generated from sorted external-input direct target data: `parameterId`, `projectPresetAlias`, `displayName`, `min`, `max`, `default`.
- `loadedAtIso` and directory path are not used as profile identity.

Profile storage and parsing:

- New profile store lives under `apps/runtime-player/src/main/model-mapping-profiles/`.
- Storage path is:

```text
<userData>/model-mapping-profiles/<safe-package-id>/<fingerprint>.json
```

- Schema version is `runtime-player-model-mapping-profile-v1`.
- Stored slots include semantic slot id, target identity, `enabled`, `invert`, `strength`, `smoothing`, and Body Follow controls.
- Live diagnostics, warning strings, Body Follow lag simulation state, Look Forward neutral, Input Profile calibration, raw tracking diagnostics, and Stage/window state are not persisted.

Runtime behavior:

- `RuntimePlayerLiveMappingState` now accepts profile load results when a Runtime Export is set.
- Missing profile uses Auto Map with `auto-mapped` profile status.
- Corrupt/read-failed profile uses Auto Map with `load-warning`.
- Stale saved targets fall back slot-by-slot to current Auto Map targets and surface `stale` warnings.
- `ModelMappingProfileSaveController` handles debounced saves and bounded flush. It waits through in-flight saves and immediately saves dirty state created during those saves.
- `registerModelMappingBridgeHandlers` adds `resetToAutoMap` and `retryProfileSave`.
- `runtime-player-main.ts` flushes pending mapping profile saves during Runtime Export switch/clear and before quit.

Control UI:

- `mapping-page.tsx` adds a Mapping Profile panel with profile status, warnings, `Reset to Auto Map`, and save-failure `Retry`.
- `overview-page.tsx` shows concise Mapping Profile status.
- `control-window-app.tsx`, `runtime-player-bridge.ts`, and related preload contracts expose the new modelMapping API.

## Changed Files

Profile identity/store/schema/restore/save:

- `apps/runtime-player/src/main/model-mapping-profiles/model-mapping-export-identity.ts`
- `apps/runtime-player/src/main/model-mapping-profiles/model-mapping-profile-document.ts`
- `apps/runtime-player/src/main/model-mapping-profiles/model-mapping-profile-parser.ts`
- `apps/runtime-player/src/main/model-mapping-profiles/model-mapping-profile-slots.ts`
- `apps/runtime-player/src/main/model-mapping-profiles/model-mapping-profile-store.ts`
- `apps/runtime-player/src/main/model-mapping-profiles/model-mapping-profile-save-controller.ts`

Mapping state / bridge / lifecycle:

- `apps/runtime-player/src/main/live-mapping/live-mapping-state.ts`
- `apps/runtime-player/src/main/live-mapping/runtime-export-auto-mapping.ts`
- `apps/runtime-player/src/main/model-mapping-bridge-handlers.ts`
- `apps/runtime-player/src/main/runtime-export-loader/runtime-export-bridge-handlers.ts`
- `apps/runtime-player/src/main/runtime-player-main.ts`

Preload / Control UI:

- `apps/runtime-player/src/preload/model-mapping-bridge-channels.ts`
- `apps/runtime-player/src/preload/model-mapping-bridge-contract.ts`
- `apps/runtime-player/src/preload/runtime-player-bridge.ts`
- `apps/runtime-player/src/preload/runtime-player-bridge-contract.ts`
- `apps/runtime-player/src/control/control-window-app.tsx`
- `apps/runtime-player/src/control/control-window-formatters.ts`
- `apps/runtime-player/src/control/mapping-page.tsx`
- `apps/runtime-player/src/control/overview-page.tsx`

Focused tests:

- `apps/runtime-player/src/main/model-mapping-bridge-handlers.test.ts`
- `apps/runtime-player/src/main/live-mapping/live-mapping-state.test.ts`
- `apps/runtime-player/src/main/model-mapping-profiles/model-mapping-export-identity.test.ts`
- `apps/runtime-player/src/main/model-mapping-profiles/model-mapping-profile-store.test.ts`
- `apps/runtime-player/src/main/model-mapping-profiles/model-mapping-profile-slots.test.ts`
- `apps/runtime-player/src/main/model-mapping-profiles/model-mapping-profile-save-controller.test.ts`
- `apps/runtime-player/src/main/model-mapping-profiles/model-mapping-profile-test-fixtures.test-support.ts`

## Review Results

Initial review loop returned `needs_changes` in all three lanes.

Resolved findings:

- Spec compliance: `packageHash` preference was undermined by strict `parameterSignatureHash` load matching. Fixed so matching `packageHash` is authoritative; hashless fallback remains strict on `packageId + packageRevision + parameterSignatureHash`.
- Design/development: `flush()` could return after an in-flight save while later edits remained unsaved. Fixed with bounded loop that waits for in-flight saves and saves dirty state immediately.
- Test adequacy: debounced flush, in-flight edit flush, state-level profile status propagation, and bridge-level `Reset to Auto Map` behavior were under-tested. Added focused tests.

Final review reports:

- `pass`: `discussion/runtime-player/implementation/reviews/wave7/runtime-player-wave7-domain-a-spec-compliance-review.md`
- `pass`: `discussion/runtime-player/implementation/reviews/wave7/runtime-player-wave7-domain-a-design-development-review.md`
- `pass`: `discussion/runtime-player/implementation/reviews/wave7/runtime-player-wave7-domain-a-test-adequacy-review.md`

## Verification

Parent verification after final fix loop:

```text
pnpm.cmd --filter @private-2d-rigging-lab/runtime-player exec vitest run src/main/model-mapping-bridge-handlers.test.ts src/main/model-mapping-profiles/model-mapping-profile-store.test.ts src/main/model-mapping-profiles/model-mapping-profile-save-controller.test.ts src/main/live-mapping/live-mapping-state.test.ts src/main/model-mapping-profiles/model-mapping-export-identity.test.ts src/main/model-mapping-profiles/model-mapping-profile-slots.test.ts src/main/live-mapping/runtime-export-auto-mapping.test.ts src/main/live-mapping/runtime-parameter-frame.test.ts
```

Outcome: pass, 8 files / 30 tests.

```text
pnpm.cmd --filter @private-2d-rigging-lab/runtime-player typecheck
```

Outcome: pass.

```text
node scripts/check-source-organization.mjs
```

Outcome: pass.

```text
git diff --check -- <Domain A paths>
```

Outcome: exit 0. Output contained only LF/CRLF normalization warnings.

Gnome also reported an earlier full runtime-player unit run:

```text
pnpm.cmd --filter @private-2d-rigging-lab/runtime-player test:unit
```

Outcome: pass, 32 files / 134 tests.

Note: sandboxed Vitest attempts hit `spawn EPERM` while loading config through esbuild, so targeted Vitest runs were rerun with escalation.

## Remaining Issues

- Electron manual verification is still required: tune Mapping / Body Follow, restart or reopen the same Runtime Export, and confirm restored values plus Mapping / Overview status.
- Manual or fault-injection verification is still useful for save failure and `Retry` status.
- Real tracking verification is still useful after restore/reset to confirm Body Follow feels correct with authored Body X/Z targets.
- Worktree also contains concurrent Domain B Stage/window-state changes. Domain A kept shared bridge/main edits scoped to model mapping profile behavior and did not revert concurrent work.

## User Decision Points

None.
