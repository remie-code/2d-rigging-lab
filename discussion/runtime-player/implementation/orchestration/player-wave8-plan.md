# Runtime Player Wave 8 Plan: Broadcast Stage Setup v0

> Objective: make the existing Stage Window usable as a stable broadcast capture target without adding OBS automation or Spout output yet.

## 1. Status

- Status: Ready to launch.
- Planning gate result: inventory then discuss, then plan.
- Inventory result: source blocker none; UX/safety decisions fixed before this plan.
- Source of truth before implementation:
  - [broadcast-stage-setup-v0.md](../../screens/broadcast-stage-setup-v0.md)
  - [broadcast-capture-paths.md](../../research/broadcast-capture-paths.md)
  - [control-window-screen-structure.md](../../screens/control-window-screen-structure.md)
  - [tracking-setup-live-mapping.md](../../screens/tracking-setup-live-mapping.md)
  - [runtime-player-backlog.md](../../backlog/runtime-player-backlog.md)
  - Wave8 Sylph inventory for window lifecycle / startup restore.
  - Wave8 Sylph inventory for Stage controls / capture target UI.

## 2. Product Goal

After Wave7, Runtime Player can load a Runtime Export, drive it naturally through iFacialMocap, persist Model Mapping / Body Follow tuning, and restore Stage window/view state.

The next UX gap is broadcast preparation:

- the Stage Window is frameless and not easy to move directly.
- closing Control Window can leave the user without a way back.
- click-through is desirable for broadcast, but unsafe without recovery.
- Runtime Export still needs manual opening on each launch.
- OBS/streaming setup needs a stable Stage capture target, not editor-style debug UI.

Wave8 should make the Stage Window feel like a capture target that the user can arrange, protect, and recover from.

## 3. Accepted Decisions

### 3.1 Capture Path

- Near-term v0 uses the existing Stage Window as the capture target.
- OBS setup remains user-side configuration.
- Runtime Player does not claim `OBS Ready`; it exposes local capture-target readiness only.
- Spout is not rejected, but is out of scope for Wave8 because it needs separate feasibility work.

### 3.2 Runtime Export Auto Restore

- Store the last successful Runtime Export directory separately from Window State.
- Startup restore runs after Control Window first paint, with a visible loading/status state.
- If the stored path is missing or invalid, keep the saved path and show a non-crashing error with Retry / Open New behavior.
- Successful manual opens update the last successful Runtime Export path.
- Input Source auto-connect is out of scope.

Suggested storage:

```text
<electron userData>/
  startup-state/
    runtime-player-startup.json
```

Suggested schema:

```json
{
  "schemaVersion": "runtime-player-startup-state-v1",
  "updatedAtIso": "2026-06-23T00:00:00.000Z",
  "lastRuntimeExportDirectory": "C:/path/to/model.runtime-export"
}
```

### 3.3 Control Window Recovery

- Closing Control Window hides it rather than quitting Runtime Player.
- Runtime Player must expose a recovery path through tray/menu.
- Explicit Quit remains the way to terminate the app.
- Explicit Quit must reuse the existing flush path for input disconnect, Model Mapping Profile, and Window State.
- Tray/menu target is Windows-first for v0, while keeping module boundaries reasonably Electron-common.

Recommended tray/menu entries:

- Show Control Window
- Focus Stage
- Disable Click-through, if enabled
- Quit Runtime Player

### 3.4 Stage Arrange Mode

- Stage Arrange mode is the way to move a frameless Stage Window.
- Do not make the entire Stage always draggable.
- Prefer a small temporary drag handle or arrange overlay shown only while Arrange mode is enabled.
- Arrange mode must avoid conflict with normal Stage pan/zoom.
- Normal Stage mode remains model-only.

Preferred technical direction:

- Use an Electron native draggable region such as CSS `app-region: drag` if it works cleanly.
- Fall back to main-process drag delta / bounds updates only if native drag is unsuitable.

### 3.5 Click-Through

- Click-through must have a recovery path before it can be enabled.
- Control Window toggle and tray/menu `Disable Click-through` are required.
- Click-through always starts Off on app startup.
- Do not restore click-through as On even if it was enabled in a previous session.
- A global shortcut is not required for v0, but remains a future safety improvement.

### 3.6 Always-On-Top

- Always-on-top is a toggle.
- Default is Off.
- The setting may be persisted as environment/window state.
- Always-on-top is useful but not required for OBS Window Capture.

### 3.7 Capture Target Checklist

Stage page should expose local capture-target readiness, not OBS integration status.

Checklist candidates:

- Stage Window: Open
- Runtime Export: Loaded / Not loaded
- Model: Visible
- Background: Transparent
- Stage UI: Hidden / model only
- Window title: `Runtime Player Stage`
- Click-through: On / Off
- Always on top: On / Off

Actions:

- Focus Stage
- Arrange Stage
- Reset View
- Center Model
- Copy Window Title

### 3.8 Stage Close Behavior

- Stage Window recreation is out of scope for Wave8.
- Existing Stage close behavior may remain destructive.
- Because Stage is frameless, regular user operation should not expose a Stage close button.
- If Stage is destroyed, Control should report the destroyed/open state accurately rather than pretending the Stage is usable.

## 4. Wave Strategy

Use A/B in parallel, then C after A completes, then D final integration.

### Batch 1

Run Domain A and Domain B in parallel.

| Domain | Work | Parallel? | Notes |
|---|---|---|---|
| Domain A | Control Window recovery / tray-menu / explicit quit | Yes | Owns close-hide lifecycle, tray/menu, explicit quit, control recovery. |
| Domain B | Runtime Export startup-state / auto restore | Yes | Owns startup-state store and auto restore. Shares `runtime-player-main.ts` integration with A. |

### Batch 2

Run Domain C after Domain A completes. Domain B completion is not a hard functional dependency for C, but final integration must wait for both A and B.

| Domain | Work | Parallel? | Notes |
|---|---|---|---|
| Domain C | Stage capture controls / arrange mode / click-through / always-on-top / checklist | No, after A | Click-through safety depends on Domain A recovery/tray path. |

### Batch 3

Run Domain D after A/B/C complete.

| Domain | Work | Parallel? | Notes |
|---|---|---|---|
| Domain D | Final integration, docs alignment, clean review | No | Reconcile shared main/preload/Stage contracts and update docs/maps to implementation facts. |

## 5. Domain A: Control Recovery / Tray / Explicit Quit

Suggested subagent name:

```text
runtime-player-wave8-control-recovery-tray-explicit-quit
```

### Scope

Implement the app lifecycle and recovery layer that keeps the user from losing Control Window access.

### Primary Files / Areas

Likely areas:

- `apps/runtime-player/src/main/runtime-player-main.ts`
- `apps/runtime-player/src/main/window-management/**`
- new main-side tray/menu/recovery module, for example:
  - `apps/runtime-player/src/main/window-management/runtime-player-tray-menu.ts`
  - `apps/runtime-player/src/main/window-management/control-window-recovery.ts`
- `apps/runtime-player/src/preload/**` only if Control needs new visible status or commands.
- focused tests under `apps/runtime-player/src/main/**`

### Required Behavior

- Control Window close hides the window instead of destroying it, unless explicit quit is in progress.
- Runtime Player has an explicit Quit path.
- Explicit Quit uses the existing flush behavior:
  - input disconnect
  - Model Mapping Profile flush
  - Window State flush
- Tray/menu can show/focus Control Window.
- Tray/menu can focus Stage.
- Tray/menu can disable click-through after Domain C adds click-through; Domain A may expose the hook or placeholder action.
- `window-all-closed` behavior remains coherent with close-hide semantics.
- Stage close/recreate is not implemented unless the domain finds a very small safe fix. Accurate destroyed/open state is enough.

### Tests

At minimum, add focused tests for:

- Control close-hide vs explicit quit.
- Show Control action restores minimized/hidden Control Window.
- Explicit Quit triggers the expected flush path.
- Tray/menu action wiring where testable.
- No `pnpm install`.

## 6. Domain B: Runtime Export Startup State / Auto Restore

Suggested subagent name:

```text
runtime-player-wave8-runtime-export-auto-restore
```

### Scope

Persist and restore the last successful Runtime Export directory.

### Primary Files / Areas

Likely areas:

- `apps/runtime-player/src/main/runtime-export-loader/**`
- `apps/runtime-player/src/main/runtime-export-loader/runtime-export-bridge-handlers.ts`
- `apps/runtime-player/src/main/runtime-player-main.ts`
- new startup-state store, for example:
  - `apps/runtime-player/src/main/startup-state/runtime-player-startup-state-store.ts`
  - `apps/runtime-player/src/main/startup-state/runtime-player-startup-state-document.ts`
- `apps/runtime-player/src/preload/runtime-player-bridge*`
- `apps/runtime-player/src/control/control-window-app.tsx`
- `apps/runtime-player/src/control/overview-page.tsx`
- `apps/runtime-player/src/control/stage-page.tsx`
- focused tests under `apps/runtime-player/src/main/**`

### Required Behavior

- Save last successful Runtime Export directory after successful manual open.
- On startup, after Control first paint, attempt to restore the saved Runtime Export path.
- Show restore loading/status in Control.
- Missing/invalid path produces a non-crashing status/error.
- Missing/invalid path is not automatically cleared.
- User can Retry or Open New.
- Runtime Export manual open and auto restore share validation/session/payload broadcast logic.
- Do not auto-connect Input Source.

### Tests

At minimum, add focused tests for:

- startup-state store read/write/corrupt fallback.
- successful manual load updates saved path.
- startup auto restore success.
- startup auto restore invalid/missing path status.
- saved invalid path remains available for retry/reporting.
- preload/status contract if added.
- No `pnpm install`.

## 7. Domain C: Stage Capture Controls

Suggested subagent name:

```text
runtime-player-wave8-stage-capture-controls
```

### Dependency

Start after Domain A passes, because click-through must have a recovery path before implementation.

Domain C can be implemented while Domain B is complete or pending, but Domain D must reconcile all domains.

### Scope

Extend Stage page and Stage/main bridge for capture-target ergonomics.

### Primary Files / Areas

Likely areas:

- `apps/runtime-player/src/control/stage-page.tsx`
- `apps/runtime-player/src/control/control-window-app.tsx`
- `apps/runtime-player/src/main/stage-view-bridge-handlers.ts`
- `apps/runtime-player/src/main/window-state/**`
- `apps/runtime-player/src/main/window-management/**`
- `apps/runtime-player/src/preload/stage-view-bridge-channels.ts`
- `apps/runtime-player/src/preload/runtime-player-bridge*`
- `apps/runtime-player/src/preload/runtime-player-stage-bridge*`
- `apps/runtime-player/src/stage/stage-window-app.tsx`
- `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts`
- `apps/runtime-player/src/stage/stage-renderer/stage-view-transform.ts`
- boundary tests under `apps/runtime-player/src/**`

### Required Behavior

- Add Stage Arrange mode toggle from Control.
- Show a temporary drag handle / arrange overlay only while Arrange mode is enabled.
- Normal Stage mode remains model-only.
- Arrange mode must not leave setup UI visible when disabled.
- Arrange mode must not conflict with normal pan/zoom.
- Add click-through toggle.
- Click-through always starts Off on startup.
- Click-through can be disabled from Control and tray/menu.
- Add always-on-top toggle, default Off.
- Persist always-on-top if this fits Window State cleanly.
- Add Capture Target checklist to Stage page.
- Add Copy Window Title action.
- Preserve stable native Stage title.

### Tests

At minimum, add focused tests for:

- stage-view bridge handlers for click-through / always-on-top / arrange state.
- preload/channel contract updates.
- Window State parser/controller/store defaults and invalid values for new fields.
- Arrange overlay visible only in arrange mode.
- normal Stage mode remains model-only.
- pan/zoom disabled or isolated during arrange mode.
- boundary tests: Stage preload remains narrow, no raw tracking/debug APIs.
- No `pnpm install`.

## 8. Domain D: Final Integration + Docs Alignment

Suggested subagent name:

```text
runtime-player-wave8-final-integration-clean-review
```

### Scope

Run after A/B/C complete. Do not start until all implementation domains are done and reviewed.

### Required Behavior

- Reconcile shared `runtime-player-main.ts`, preload contracts, Stage bridge contracts, and Window State/startup-state stores.
- Verify click-through cannot trap the user without recovery.
- Verify Runtime Export auto restore does not auto-connect Input Source.
- Verify Stage remains model-only in normal mode.
- Verify Capture Target checklist does not claim OBS integration.
- Verify Spout and OBS automation remain out of scope.
- Verify docs/maps match implementation facts.
- Write Wave8 reports and reviews under:
  - `discussion/runtime-player/implementation/waves/wave8/`
  - `discussion/runtime-player/implementation/reviews/wave8/`

Docs to update as implementation facts require:

- [broadcast-stage-setup-v0.md](../../screens/broadcast-stage-setup-v0.md)
- [broadcast-capture-paths.md](../../research/broadcast-capture-paths.md)
- [control-window-screen-structure.md](../../screens/control-window-screen-structure.md)
- [tracking-setup-live-mapping.md](../../screens/tracking-setup-live-mapping.md)
- [runtime-player-backlog.md](../../backlog/runtime-player-backlog.md)
- runtime-player maps.

## 9. Acceptance Criteria

- Runtime Player can restore the last successful Runtime Export after startup.
- Runtime Export auto restore happens after Control first paint with visible loading/status.
- Invalid/missing saved Runtime Export path is reported without crashing and is not silently cleared.
- Manual Open Runtime Export still works and updates the saved path.
- Input Source is not auto-connected by startup restore.
- Closing Control Window hides it rather than trapping the user.
- Tray/menu can show Control Window.
- Runtime Player can still be explicitly quit.
- Explicit quit flushes input disconnect, Model Mapping Profile, and Window State.
- Stage Arrange mode lets the user move the frameless Stage Window.
- Arrange UI appears only while Arrange mode is enabled.
- Normal Stage mode remains model-only.
- Click-through can be toggled from Control.
- Click-through can be disabled from tray/menu.
- Click-through starts Off on app startup.
- Always-on-top can be toggled and defaults Off.
- Capture Target checklist reflects app-owned readiness without claiming OBS integration.
- Stable Stage window title remains available and can be copied.
- Stage does not receive raw tracking/debug APIs.

## 10. Verification Matrix

| Area | Verification |
|---|---|
| Control recovery | Unit tests with fake windows; manual Electron close/hide/show check. |
| Explicit quit | Unit tests for flush path; manual quit check. |
| Tray/menu | Unit tests where practical; manual Electron tray/menu check. |
| Startup restore | Store and restore tests; manual restart check with valid and invalid Runtime Export path. |
| Stage arrange | Stage renderer/app tests; manual drag check on Windows. |
| Click-through | Bridge/main tests; manual toggle and tray recovery check. |
| Always-on-top | Bridge/main tests; manual toggle check. |
| Capture target checklist | UI tests where practical; manual OBS-adjacent readiness check. |
| Boundaries | Runtime Player boundary tests ensuring Stage remains model-only. |
| Regression | Runtime Player typecheck and focused Vitest. |

Manual OBS Window Capture alpha/title selection is valuable after implementation, but OBS itself is not an automated Wave8 acceptance gate.

## 11. Subagent Contract

- Do not run `pnpm install`; the user handles installs.
- Keep implementation scoped to Runtime Player.
- Do not implement Spout sender.
- Do not implement obs-websocket or automatic OBS source creation.
- Do not auto-connect Input Source.
- Do not implement head-position Stage Motion or near/far response.
- Do not move raw tracking/debug data into Stage.
- Do not claim OBS readiness from inside Runtime Player.
- Preserve Stage model-only normal mode.
- If a shared file must be touched, keep the change minimal and record it in the domain report.
- Do not revert unrelated or concurrent changes.
- Add focused tests where behavior is deterministic.

## 12. Review Policy

Each implementation domain needs the usual review lanes:

- spec compliance
- design/development compliance
- test adequacy

Domain D performs the clean final integration review after A/B/C are complete.

## 13. Orchestration Policy

This wave follows the Implementation Orchestration skill.

Root / Undine:

- Owns wave plan, user questions, dependency graph, and final decision.
- Must not implement Runtime Player Wave8 source changes.
- Must wait for every started subagent.
- Must treat wait timeouts as polling.
- Must not close running children.

Orch-Sylph:

- Owns one domain loop.
- Must start with bounded current-state confirmation.
- Must delegate implementation and review.
- Must wait for Gnome and all Review-Sylphs.
- Must close completed children.
- Must report domain verdict and evidence.

No parent may pass the wave gate while a child is incomplete, running, or unresolved.

## 14. Out of Scope

- Spout sender implementation.
- obs-websocket integration.
- automatic OBS source creation.
- automatic OBS capture verification.
- Input Source auto-connect.
- input source profile switching beyond existing Input Profile behavior.
- head-position Stage Motion.
- near/far distance response.
- Stage Window recreation after destruction.
- packaging/distribution.
- multi-output broadcast profiles.
