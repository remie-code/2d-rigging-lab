# Runtime Player Wave20 Domain B Final Test / Regression Review

- Verdict: needs_changes (docs-only)
- Source verdict: pass
- Review lane: final test / regression
- Reviewer: Review-Sylph
- Date: 2026-06-27

## Scope Reviewed

- Runtime Player Wave20 changed source/test files listed in the Domain B assignment.
- Current diff/status, forbidden-scope file inventory, targeted lifecycle tests, and related Runtime Player regression tests by inspection.
- Current docs where Wave20 close/recovery semantics may be reflected.

## Basis Documents Used

- `discussion/runtime-player/implementation/orchestration/player-wave20-plan.md`
- `discussion/runtime-player/implementation/waves/wave20/runtime-player-wave20-domain-a-control-quit-stage-reopen-lifecycle-report.md`
- `discussion/runtime-player/implementation/reviews/wave20/domain-a-spec-compliance-review.md`
- `discussion/runtime-player/implementation/reviews/wave20/domain-a-design-development-compliance-review.md`
- `discussion/runtime-player/implementation/reviews/wave20/domain-a-test-adequacy-review.md`
- `discussion/runtime-player/implementation/reviews/wave20/domain-a-design-development-compliance-post-fix-rereview.md`
- `discussion/runtime-player/implementation/reviews/wave20/domain-a-test-adequacy-post-fix-rereview.md`
- `discussion/runtime-player/implementation/orchestration/runtime-player-wave-planning-conventions.md`
- `discussion/runtime-player/implementation/_map.md`
- `discussion/runtime-player/implementation/orchestration/_map.md`

## Findings

No source changes are requested.

### 1. Superseded close-hide docs remain outside implementation scope

Severity: docs-only / out of current write scope.

The reviewer found stale Wave8 close-hide wording in:

- `discussion/runtime-player/_map.md`
- `discussion/runtime-player/screens/broadcast-stage-setup-v0.md`
- `discussion/runtime-player/screens/control-window-screen-structure.md`
- `discussion/runtime-player/screens/tracking-setup-live-mapping.md`
- `discussion/runtime-player/backlog/runtime-player-backlog.md`

Wave20's current behavior is: Control close quits Runtime Player, Stage direct close is recoverable, and `Focus Stage` reopens/focuses Stage. Domain B's allowed write scope is limited to `discussion/runtime-player/implementation/**`, so these files were not edited by Orch-Sylph.

### 2. Implementation maps still needed final Wave20 closeout

Severity: docs-only / fixed by Domain B closeout.

The implementation and orchestration maps still presented Wave20 as the next launch/current gap before Domain B wrote final report/review/map artifacts.

### 3. Wave19 orchestration map had stale manual OBS cadence wording

Severity: docs-only low / fixed by Domain B closeout.

The implementation map already recorded the Wave19 OBS/Chrome comparison as closed, while `discussion/runtime-player/implementation/orchestration/_map.md` still said manual OBS cadence confirmation was pending.

## Source Assessment

No source blocker was found.

- Control close calls quit and closes Stage.
- Stage lifecycle close emits state without app quit.
- `Focus Stage` reopens/focuses destroyed Stage.
- Explicit quit remains controller-routed.
- Stale Stage ready/model-visible state is cleared to `Stage unavailable`.

## Test / Regression Coverage

Focused coverage is adequate for final source pass:

- Control close quit and Stage close behavior: `control-window-recovery.test.ts`.
- Focus existing/reopened/failed Stage behavior: `stage-view-bridge-handlers.test.ts`.
- Stage close unavailable status and Control presentation: `stage-view-bridge-handlers.test.ts`, `stage-page.stage-motion.test.ts`.

Existing regression coverage remains relevant for Runtime Export restore, live frame replay, local preview suspension, Stage Motion transport, Browser Source, and Variant renderer behavior. Full Electron OS close semantics and packaged `.exe` behavior remain manual.

## Verification Performed

- `pnpm.cmd --filter @private-2d-rigging-lab/runtime-player exec vitest run src/main/window-management/control-window-recovery.test.ts src/main/stage-view-bridge-handlers.test.ts src/control/stage-page.stage-motion.test.ts`
  - Passed: 3 files / 38 tests.
- `git diff --check -- ...`
  - Passed; LF-to-CRLF working-copy warnings only.
- `git status --short -uall`, `git diff --name-only`, and `git diff --stat`
  - No Editor, Runtime Export format, package-format/schema, dependency, lockfile, or packaging config changes observed.

`pnpm install` was not run.

## Manual Checks Still Required

- Packaged `.exe` or dev Electron smoke: close Control, confirm Stage closes and process exits.
- Relaunch, close Stage via OS/taskbar route, confirm Control remains alive and shows unavailable.
- Press `Focus Stage`, confirm Stage reopens/focuses.
- Smoke Runtime Export restore, Browser Source, local preview suspension, Variant switching, live mapping / Body Follow, Stage Motion, and diagnostics.

## Residual Risks

- No full Electron integration test covers app quit / `before-quit` / `window-all-closed` ordering.
- Reopen resync is source-inspected and covered by lower-level tests, but not a single wired integration test.
