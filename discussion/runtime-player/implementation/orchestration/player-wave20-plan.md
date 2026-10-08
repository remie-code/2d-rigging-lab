# Runtime Player Wave 20 Plan: Control Window Quit / Stage Reopen Lifecycle

> Objective: make the Runtime Player packaged app behave like a normal desktop app: closing Control quits the app, while Focus Stage can recover a closed Stage window.

## 1. Status

- Status: Ready to launch.
- Planning gate result: plan directly.
- User decision:
  - Control Window is the primary application window.
  - Closing the Control Window should quit Runtime Player completely.
  - Quitting through Control close should also close Stage and stop background runtime services.
  - Stage Window close is not part of the normal visible UX, but can happen through taskbar / OS window controls.
  - If Stage is closed while Control remains open, the app should remain alive.
  - `Focus Stage` should focus Stage when it exists and recreate/reopen Stage when it was closed.
- Recent packaging context:
  - Runtime Player can now produce Windows executable artifacts.
  - The user wants `.exe` use to feel natural, not like a dev-only background process.
- Source of truth before implementation:
  - this plan.
  - [player-wave8-plan.md](player-wave8-plan.md)
  - [player-wave20-plan.md](player-wave20-plan.md)
  - [runtime-player-wave-planning-conventions.md](runtime-player-wave-planning-conventions.md)

## 2. Product Goal

Runtime Player should close predictably when the user closes the main Control Window.

Before this wave, Runtime Player inherited a broadcast/recovery-oriented lifecycle where the app could remain alive after the Control Window disappeared. That behavior was useful while the app was being developed and while tray/recovery behavior was being explored, but it is awkward for the current packaged `.exe` experience.

After this wave:

- closing Control means "I am done with Runtime Player";
- Stage is recoverable from Control if Stage is accidentally closed;
- the user should not need Task Manager, tray hunting, or dev tooling to stop the app.

## 3. Accepted UX Semantics

### 3.1 Control Window Close

When the Control Window receives a normal user close:

- Runtime Player should initiate app quit.
- Stage Window should close if it exists.
- Browser Source server should shut down as part of app shutdown.
- iFacialMocap receive / mapping / timers should stop as part of app shutdown.
- Electron process should exit normally.

This is true even if Stage is currently focused, hidden, click-through, or serving Browser Source.

### 3.2 Stage Window Close

When Stage Window is closed directly through OS/taskbar routes:

- Do not quit the app.
- Keep Control Window alive.
- Treat Stage as closed/unavailable until reopened.
- Preserve enough state that reopening Stage restores the usual Stage behavior according to existing Stage state persistence rules.

Stage close is a recovery case, not the main quit path.

### 3.3 Focus Stage Button

`Focus Stage` should become an open-or-focus action:

- If Stage exists, focus/show it as it does today.
- If Stage has been closed/destroyed, recreate/reopen Stage and then focus it.
- If Stage cannot be recreated, report the existing style of Control-side error/status rather than silently failing.

The button label may remain `Focus Stage` in this wave unless changing it is necessary to avoid incorrect UI state. A future copy pass may rename it to `Open / Focus Stage`, but that is not required.

## 4. Existing Behavior To Preserve

Preserve:

- Runtime Export startup restore.
- Stage window/view state persistence.
- Stage Motion / Body Follow / Mapping Profile persistence.
- Browser Source server and URL behavior during normal app lifetime.
- Live Controller Variant selection behavior.
- Control recovery/tray behavior only insofar as it does not conflict with Control-close quitting.
- explicit quit behavior if a tray/menu explicit quit still exists.
- packaged exe build scripts and output.

Do not regress the broadcast path: Browser Source should still work while Control and Stage are open.

## 5. Wave Strategy

Run sequentially as one implementation domain plus final integration.

Window lifecycle, main-process ownership, Stage page button behavior, and tests are connected. Parallel implementation would create more coordination overhead than value.

### Dependency Summary

| Domain | Work | Parallel? | Reason |
|---|---|---|---|
| Domain A | Runtime Player Control/Stage window lifecycle implementation | No | Main-process window ownership and Stage page action behavior are tightly coupled. |
| Domain B | Final integration / docs / clean review | No, after A | Confirm packaged-app semantics, docs/maps, and review evidence. |

## 6. Domain A: Control Quit / Stage Reopen Lifecycle

Suggested subagent name:

```text
runtime-player-wave20-control-quit-stage-reopen-lifecycle
```

### Scope

Update Runtime Player lifecycle behavior so Control close quits the app, while `Focus Stage` can recreate a closed Stage window.

### Primary Files / Areas

Likely areas:

- `apps/runtime-player/src/main/window-management/**`
- `apps/runtime-player/src/main/**` files that own Control / Stage window lifecycle.
- `apps/runtime-player/src/control/stage-page*`
- preload/bridge contracts if `Focus Stage` needs a result/status adjustment.
- related main-process / Control page tests.

### Required Behavior

- Control Window user close quits the app.
- Stage Window is closed during Control-driven quit.
- Stage direct close does not quit the app.
- `Focus Stage` recreates Stage if it was closed.
- Existing explicit quit path remains valid.
- Existing Stage focus behavior remains valid when Stage is already open.
- Existing Stage state persistence is preserved when Stage is recreated.
- Browser Source server shutdown/startup behavior remains coherent:
  - app quit shuts it down;
  - Stage close alone should not necessarily imply Browser Source server shutdown unless current ownership already requires it.
- No packaging config changes unless tests reveal a small lifecycle-related need.

### Tests

At minimum:

- main-process/window-management unit tests for Control close -> app quit.
- test or focused verification that Stage close alone does not quit app.
- test or focused verification that Focus Stage opens/recreates Stage when missing.
- test existing Focus Stage path when Stage exists.
- relevant Runtime Player typecheck/build if touched files require it.

Escalate if:

- current tray/recovery architecture intentionally forbids Control close quitting and a product decision is needed;
- Stage recreation cannot be implemented without broad app lifecycle rewrite;
- Browser Source server lifecycle is inseparable from Stage Window lifetime in a way that conflicts with the accepted UX.

## 7. Domain B: Final Integration / Docs Alignment / Clean Review

Suggested subagent name:

```text
runtime-player-wave20-final-integration-window-lifecycle
```

### Scope

Run after Domain A completes.

### Required Behavior

- Confirm Control Window close quits the app.
- Confirm Stage direct close does not quit app.
- Confirm `Focus Stage` can reopen a closed Stage.
- Confirm packaged `.exe` semantics remain compatible.
- Confirm no Runtime Export format changes.
- Confirm no Editor changes.
- Confirm no package-format schema changes.
- Confirm no new dependencies or lockfile changes unless already present from packaging setup.
- Write final reports/reviews under:
  - `discussion/runtime-player/implementation/waves/wave20/`
  - `discussion/runtime-player/implementation/reviews/wave20/`

Docs/maps to update as implementation facts require:

- Runtime Player implementation maps.
- Runtime Player screen docs only if current docs mention stale close/recovery semantics.

The final integration scope must include:

```text
実装事実に合わせて関連ドキュメントを更新する。
```

### Manual Check Notes

The final report should ask the user to check:

- Launch Runtime Player from generated `.exe` if available, or dev mode if not.
- Close Control Window with the normal `×`.
- Confirm Stage closes and the Runtime Player process exits.
- Relaunch Runtime Player.
- Close Stage through taskbar / OS route if possible.
- Confirm Control remains alive.
- Press `Focus Stage`.
- Confirm Stage reopens and focuses.
- Confirm Runtime Export restore and live mapping still behave normally after relaunch.

## 8. Acceptance Criteria

- Control Window close quits Runtime Player.
- Control-driven quit closes Stage and stops app-owned background services through normal app shutdown.
- Stage Window close alone does not quit Runtime Player.
- `Focus Stage` recreates/reopens Stage if Stage was closed.
- Existing Focus Stage behavior still works when Stage is open.
- Existing Runtime Export restore, Stage state persistence, Browser Source output, Input Mapping, Body Follow, Stage Motion, and Variant switching are not regressed.
- Focused tests and typecheck pass, or failures are classified with concrete evidence.
- No `pnpm install` is run by agents.
- No Runtime Export format changes.
- No Editor changes.
- No package-format schema changes.
- No new dependencies.

## 9. Out of Scope

- Redesigning tray UX.
- Removing tray support entirely unless it is strictly necessary for Control close semantics.
- Installer/signing/autoupdate work.
- Browser Source protocol redesign.
- Stage UI redesign.
- Runtime Export format changes.
- Editor changes.
- package-format schema changes.
- new dependencies.
- `pnpm install`.

## 10. Subagent Contract

- Do not run `pnpm install`; the user handles installs.
- Keep Wave20 centered on Runtime Player window lifecycle.
- Preserve packaged exe build setup.
- Preserve Browser Source as the primary broadcast path.
- Preserve Wave8 explicit quit/recovery behavior where it does not conflict with Control-close quitting.
- Preserve Wave10 native local preview suspension.
- Preserve Wave11 Stage Motion.
- Preserve Wave12 Live Controller Variant switching.
- Preserve Wave17 render-frame fast path.
- Preserve Wave18 lightweight diagnostics posture.
- Preserve Wave19 rAF cadence diagnostics.
- Do not change Runtime Export format.
- Do not add dependencies or edit lockfile.
- Do not revert unrelated or concurrent changes.
- Add focused tests where behavior is deterministic.
- If a shared file must be touched outside the domain's expected scope, report it before broadening.

## 11. Review Policy

Each implementation domain needs review lanes:

- spec compliance;
- design/development compliance;
- test adequacy.

Review lanes must be separate Review-Sylph subagents. Do not collapse review lanes into one reviewer.

Reviewers must specifically check:

- Control close really exits the app rather than hiding Control.
- Stage close alone does not exit the app.
- Focus Stage recreates/focuses Stage.
- explicit quit still works if present.
- Stage persistence and startup restore are not broken.
- Browser Source / Mapping / Stage Motion / Variant switching are not affected.
- no Runtime Export / Editor / package-format schema changes are introduced.

## 12. Orchestration Policy

This wave follows the Implementation Orchestration skill.

Root / Undine:

- Owns wave plan, user questions, dependency graph, and final decision.
- Must not implement Runtime Player Wave20 source changes.
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
- Must launch separate Review-Sylph subagents for spec compliance, design/development compliance, and test adequacy.

Required assignment sentence:

```text
Orch-Sylph自身は実装担当ではない。source implementation は必ず別コンテキストの Gnome に委譲し、レビューは必ず別コンテキストの Review-Sylph に委譲すること。これを分離できない場合は実装せず escalate / blocked として報告すること。
```

No parent may pass the wave gate while a child is incomplete, running, or unresolved.
