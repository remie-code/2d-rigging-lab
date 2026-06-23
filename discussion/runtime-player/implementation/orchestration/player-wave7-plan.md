# Runtime Player Wave 7 Plan: Persistent Mapping + Stage State v0

> Objective: preserve the tuning that makes a model feel alive. Wave7 makes Model Mapping / Body Follow settings persist per Runtime Export, and adds a Stage page that persists Stage window bounds plus Stage pan/zoom state.

## 1. Status

- Status: Ready to launch.
- Planning gate result: inventory first, then plan.
- Source of truth before implementation:
  - [tracking-setup-live-mapping.md](../../screens/tracking-setup-live-mapping.md)
  - [control-window-screen-structure.md](../../screens/control-window-screen-structure.md)
  - [runtime-player-backlog.md](../../backlog/runtime-player-backlog.md)
  - Sylph inventory for Model Mapping Profile persistence.
  - Sylph inventory for Stage / Window State persistence.

## 2. Product Goal

After Wave6, the user can tune Mapping and Body Follow until the model moves naturally. The next UX gap is that this tuning is fragile:

- Mapping / Body Follow settings are session-local.
- Stage window placement and Stage pan/zoom are session-local.
- The Control Window has no Stage page, so low-frequency Stage operations have no proper home.

Wave7 should make these states feel like part of the player, not temporary debug controls.

## 3. Accepted Decisions

### 3.1 Model Mapping Profile

- Mapping profile is auto-saved. There is no manual Save button.
- Profile is per Runtime Export model identity.
- Profile stores user-authored mapping semantics, not live diagnostics.
- Profile restore should run when a matching Runtime Export is opened.
- If profile targets are missing or stale, preserve what can be restored and surface a concise status/warning in Mapping / Overview.
- `Reset to Auto Map` regenerates the auto mapping, resets Body Follow lag state, overwrites the current profile, and reports save status.
- Output parameters controlled by live mapping remain player-owned during runtime operation. The Player does not expose general parameter editing as a primary UX.

### 3.2 Model Identity

Use a deterministic Runtime Export identity:

1. Prefer `manifest.sourcePackage.packageHash` when present.
2. Fallback to `packageId + packageRevision + parameterSignatureHash`.
3. `parameterSignatureHash` should be generated from sorted external-input target parameter data:
   - `parameterId`
   - `projectPresetAlias`
   - `displayName`
   - `min`
   - `max`
   - `default`

Do not use `loadedAtIso` or directory path as profile identity. A moved export should still restore the same profile.

### 3.3 Mapping Profile Storage

Store under Electron `userData`:

```text
<userData>/
  model-mapping-profiles/
    <safe-package-id>/
      <fingerprint>.json
```

Suggested schema:

```json
{
  "schemaVersion": "runtime-player-model-mapping-profile-v1",
  "createdAtIso": "2026-06-23T00:00:00.000Z",
  "updatedAtIso": "2026-06-23T00:00:00.000Z",
  "exportIdentity": {
    "packageId": "pkg_editor_workspace",
    "packageRevision": 1703,
    "packageHash": "optional",
    "parameterSignatureHash": "fallback"
  },
  "autoMappingVersion": "body-follow-v1",
  "slots": [
    {
      "slotId": "face-angle-x",
      "target": {
        "parameterId": "ParamAngleX",
        "projectPresetAlias": "Face Angle X",
        "displayName": "Face Angle X"
      },
      "enabled": true,
      "invert": false,
      "strength": 1,
      "smoothing": 0
    }
  ]
}
```

For Body Follow slots, store all Wave6 knobs:

- Body X:
  - `strength`
  - `invert`
  - `smoothing`
- Body Z:
  - `bodyRotationStrength`
  - `bodyRotationInvert`
  - `bodyPositionStrength`
  - `bodyPositionInvert`
  - `smoothing`

Do not persist:

- live status
- warning messages as profile state
- current Body Follow lag simulation state
- Look Forward neutral
- Input Profile calibration
- raw tracking diagnostics
- Stage / Window state

### 3.4 Stage Page + Window State

- Add a real `Stage` page to the Control Window nav.
- Stage page is low-frequency setup. It should not bloat Overview.
- Stage window bounds are auto-saved.
- Control window bounds may be stored in the same file, but Stage page v0 only needs to expose Stage controls.
- Stage pan/zoom view transform is auto-saved.
- Storage is separate from Model Mapping Profile because it belongs to the device/display environment, not the model.

Store under Electron `userData`:

```text
<userData>/
  window-state/
    runtime-player.json
```

Suggested schema:

```json
{
  "schemaVersion": "runtime-player-window-state-v1",
  "updatedAtIso": "2026-06-23T00:00:00.000Z",
  "windows": {
    "control": {
      "bounds": { "x": 80, "y": 80, "width": 1040, "height": 760 }
    },
    "stage": {
      "bounds": { "x": 1200, "y": 80, "width": 720, "height": 900 }
    }
  },
  "stageView": {
    "transform": {
      "zoomScale": 1,
      "pan": { "x": 0, "y": 0 },
      "coordinateSpace": "stage-viewport-px-v1"
    }
  }
}
```

### 3.5 Stage Page v0 UX

Stage page should include:

- Stage Window status.
- Focus Stage.
- Current Stage bounds summary.
- Current Stage view summary:
  - zoom
  - pan x/y
- Reset View:
  - resets zoom and pan.
- Center Model:
  - preserves current zoom and recenters the model.
- Auto-save status for Stage state.

Stage page v0 should not include:

- OBS / broadcast setup.
- transparency controls.
- click-through.
- always-on-top.
- Stage Motion from head position.
- near/far response.
- numeric editing for window bounds or pan.

### 3.6 Stage View Restore Semantics

- Restore window bounds before showing windows when possible.
- Restore Stage view transform on Stage initialization or after Runtime Export payload load.
- Stage renderer should remain responsible for rendering and applying the transform.
- Main process should own persistence and debounced disk writes.

## 4. Wave Strategy

Use two implementation domains in parallel, then one final integration/review domain.

### Batch 1

Run Domain A and Domain B in parallel.

| Domain | Work | Parallel? | Notes |
|---|---|---|---|
| Domain A | Model Mapping Profile auto-save / restore | Yes | Owns mapping profile store and mapping bridge status. Touches shared shell/bridge files with caution. |
| Domain B | Stage page + window/view state auto-save / restore | Yes | Owns window-state store and Stage transform reporting. Touches shared shell/bridge files with caution. |

### Batch 2

Run Domain C after A and B complete.

| Domain | Work | Parallel? | Notes |
|---|---|---|---|
| Domain C | Final integration, docs alignment, clean review basis | No | Reconcile shared bridge/shell changes and update docs to implementation facts. |

## 5. Domain A: Model Mapping Profile Auto Save

Suggested subagent name:

```text
runtime-player-wave7-model-mapping-profile-auto-save
```

### Scope

Implement per-model auto-save/restore for Mapping and Body Follow settings.

### Primary Files / Areas

Likely areas:

- `apps/runtime-player/src/main/live-mapping/`
- `apps/runtime-player/src/main/model-mapping-bridge-handlers.ts`
- `apps/runtime-player/src/main/runtime-player-main.ts`
- new `apps/runtime-player/src/main/model-mapping-profiles/`
- `apps/runtime-player/src/preload/model-mapping-bridge-*`
- `apps/runtime-player/src/preload/runtime-player-bridge.ts`
- `apps/runtime-player/src/control/mapping-page.tsx`
- `apps/runtime-player/src/control/control-window-app.tsx`
- focused tests under `apps/runtime-player/src/main/**`

### Required Behavior

- Build deterministic Runtime Export identity.
- Load matching profile when Runtime Export opens.
- Restore editable mapping slots and Body Follow controls.
- Auto-save after Mapping / Body Follow edits with debounce.
- Show save/restore status in Mapping and, if appropriate, concise Overview status.
- Add Reset to Auto Map behavior that regenerates, resets lag state, and saves.
- Tolerate corrupt/missing profile files by falling back to auto mapping with a visible warning/status.
- Tolerate stale targets by restoring valid slots and surfacing concise warning/status.

### Tests

At minimum, add focused tests for:

- profile store read/write.
- corrupt profile fallback.
- deterministic identity / fallback fingerprint.
- Body Follow slot restore.
- missing/stale targets.
- Reset to Auto Map save behavior.
- live frame output after restore still uses sanitized player-owned values.

## 6. Domain B: Stage Page + Window/View State Auto Save

Suggested subagent name:

```text
runtime-player-wave7-stage-window-state-auto-save
```

### Scope

Add Stage page v0 and persist Stage window bounds plus Stage pan/zoom transform.

### Primary Files / Areas

Likely areas:

- `apps/runtime-player/src/main/window-management/`
- `apps/runtime-player/src/main/runtime-player-main.ts`
- new `apps/runtime-player/src/main/window-state/`
- `apps/runtime-player/src/preload/*`
- `apps/runtime-player/src/control/control-window-shell.tsx`
- `apps/runtime-player/src/control/control-window-app.tsx`
- new `apps/runtime-player/src/control/stage-page.tsx`
- `apps/runtime-player/src/stage/stage-window-app.tsx`
- `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts`
- `apps/runtime-player/src/stage/stage-renderer/stage-view-transform.ts`
- focused tests under `apps/runtime-player/src/**`

### Required Behavior

- Add Stage nav item and Stage page.
- Implement Focus Stage as a real main-process window focus action.
- Persist Stage window bounds after move/resize with debounce.
- Optionally persist Control window bounds in the same state file, but do not surface Control bounds as primary UX.
- Persist Stage view transform after wheel pan/zoom, drag pan, Reset View, and Center Model.
- Restore Stage bounds on startup.
- Restore Stage view transform on Stage init or after model payload load.
- Implement Center Model preserving current zoom and recentering pan.
- Keep Stage page controls compact and operational rather than decorative.

### Tests

At minimum, add focused tests for:

- window-state store read/write.
- corrupt state fallback.
- schema validation / partial state fallback.
- reset transform serialization.
- center-model transform behavior.
- main/preload bridge contract behavior where practical.

## 7. Domain C: Final Integration + Docs Alignment

Suggested subagent name:

```text
runtime-player-wave7-final-integration-clean-review
```

### Scope

Run after Domain A and Domain B complete. Do not start until both are done and reviewed.

### Required Behavior

- Reconcile shared bridge/shell/main-process changes from Domain A and Domain B.
- Verify no duplicated persistence ownership.
- Verify Mapping Profile and Window State use separate stores and paths.
- Verify Stage remains model-only and does not receive raw tracking frames.
- Verify Control diagnostics throttling remains intact.
- Update related docs to match implementation facts:
  - [tracking-setup-live-mapping.md](../../screens/tracking-setup-live-mapping.md)
  - [control-window-screen-structure.md](../../screens/control-window-screen-structure.md)
  - [runtime-player-backlog.md](../../backlog/runtime-player-backlog.md)
  - runtime-player maps as needed.
- Write Wave7 final report and review records under:
  - `discussion/runtime-player/implementation/waves/wave7/`
  - `discussion/runtime-player/implementation/reviews/wave7/`

## 8. Acceptance Criteria

- Mapping / Body Follow tuning survives app restart for the same Runtime Export identity.
- Reopening a Runtime Export with a matching profile restores:
  - enabled/invert/strength per mapping slot.
  - Body X controls.
  - Body Z rotation and position controls.
  - smoothing/lag controls.
- Reset to Auto Map regenerates mapping, saves the regenerated profile, and resets transient lag state.
- Profile load/save failure is visible but does not crash or block model operation.
- Stage page is available from Control Window nav.
- Focus Stage works.
- Stage window position/size survives restart.
- Stage pan/zoom survives restart.
- Reset View resets pan and zoom.
- Center Model preserves zoom and recenters model.
- Control Window remains responsive during live tracking.
- Stage remains a clean model window and does not expose debug UI.
- Docs and maps reflect the implemented behavior after Domain C.

## 9. Verification Matrix

| Area | Verification |
|---|---|
| Mapping profile store | Unit tests for read/write/corrupt/stale/fallback. |
| Runtime Export identity | Unit tests for packageHash preference and fallback fingerprint. |
| Mapping UI | Manual Electron check: tune, restart, reopen export, confirm restored values. |
| Body Follow | Manual Electron check: Body X/Z tuning restored and live motion still responds. |
| Stage window state | Manual Electron check: move/resize Stage, restart, confirm restore. |
| Stage view state | Manual Electron check: pan/zoom Stage, restart, confirm restore. |
| Stage page actions | Manual Electron check: Focus Stage, Reset View, Center Model. |
| Regression | `pnpm typecheck` and focused runtime-player tests. |

## 10. Subagent Contract

- Do not run `pnpm install`; the user handles installs.
- Keep implementation scoped to Runtime Player.
- Do not introduce parameter-editing UX in the Player.
- Do not move raw iFacialMocap/tracking frames into Stage.
- Do not make Stage page a broadcast/OBS setup page in Wave7.
- If a shared bridge or shell file must be touched, document the change in the domain report.
- Use existing local patterns before introducing new abstractions.
- Add focused tests where the behavior is deterministic.

## 11. Review Policy

Each implementation domain needs the usual review lanes:

- spec compliance
- design/development compliance
- test adequacy

Domain C performs the clean final integration review after A/B are complete.

Root coordinator must wait for every child and close completed children. A timeout from child wait is polling, not failure. Do not abandon child agents.

## 12. Out of Scope

- Broadcast / OBS capture workflow.
- Transparent-window controls beyond existing Stage behavior.
- click-through.
- always-on-top.
- Stage Motion from head position.
- near/far body or camera response.
- full player settings system.
- manual mapping profile file picker/import/export.
- parameter editing controls in Player.
- Runtime Export generation changes in Editor.
