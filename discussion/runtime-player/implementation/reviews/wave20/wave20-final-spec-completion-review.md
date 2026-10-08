# Runtime Player Wave20 Final Spec / Completion Review

- Verdict: needs_changes (docs-only)
- Source verdict: pass
- Review lane: final spec / completion
- Reviewer: Review-Sylph
- Date: 2026-06-27

## Scope Reviewed

- Runtime Player Wave20 changed source/test files listed in the Domain B assignment.
- Wave20 plan, Domain A report, Domain A review artifacts, post-fix re-review artifacts, implementation maps, and forbidden-scope diff inventory.

## Basis Documents Used

- `discussion/runtime-player/implementation/orchestration/player-wave20-plan.md`
- `discussion/runtime-player/implementation/waves/wave20/runtime-player-wave20-domain-a-control-quit-stage-reopen-lifecycle-report.md`
- `discussion/runtime-player/implementation/reviews/wave20/domain-a-spec-compliance-review.md`
- `discussion/runtime-player/implementation/reviews/wave20/domain-a-design-development-compliance-review.md`
- `discussion/runtime-player/implementation/reviews/wave20/domain-a-test-adequacy-review.md`
- `discussion/runtime-player/implementation/reviews/wave20/domain-a-design-development-compliance-post-fix-rereview.md`
- `discussion/runtime-player/implementation/reviews/wave20/domain-a-test-adequacy-post-fix-rereview.md`
- `discussion/runtime-player/implementation/orchestration/runtime-player-wave-planning-conventions.md`
- `discussion/runtime-player/implementation/orchestration/_map.md`
- `discussion/runtime-player/implementation/_map.md`

## Findings

No source changes are requested.

### 1. Implementation maps still described Wave20 as launch-ready

Severity: docs-only / blocks final closeout until fixed inside `implementation/**`.

- `discussion/runtime-player/implementation/orchestration/_map.md` listed `player-wave20-plan.md` as `Ready to launch`.
- `discussion/runtime-player/implementation/_map.md` listed `orchestration/player-wave20-plan.md` as `Ready to launch`.
- `discussion/runtime-player/implementation/_map.md` still directed the next action to launch Wave20.

### 2. Final integration artifacts were not yet present

Severity: docs-only / blocks final closeout until fixed inside `implementation/**`.

- `discussion/runtime-player/implementation/waves/wave20/` had only the Domain A report.
- `discussion/runtime-player/implementation/reviews/wave20/` had only Domain A review artifacts.
- Wave20 needed final integration report and final review/map closeout artifacts.

### 3. Stale close-hide semantics remain outside the allowed Domain B write scope

Severity: docs-only / out of current write scope.

The reviewer found stale Wave8-era close-hide wording in `discussion/runtime-player/_map.md`, `discussion/runtime-player/screens/**`, and `discussion/runtime-player/backlog/**`. Domain B's allowed write scope is limited to `discussion/runtime-player/implementation/**`, so those files were not edited by Orch-Sylph in this closeout.

## Completion Evidence

- Control close requests quit and closes Stage through the main wiring: `apps/runtime-player/src/main/window-management/control-window-recovery.ts`, `apps/runtime-player/src/main/runtime-player-main.ts`.
- Explicit quit remains routed through `RuntimePlayerQuitController`.
- App-owned shutdown remains on the normal `will-quit` path.
- Stage direct close emits Stage lifecycle state without requesting app quit.
- `Focus Stage` reopens/focuses a destroyed Stage.
- Stage close now clears stale renderer readiness to `Stage unavailable`, and Control no longer shows stale `Stage ready` / `Model Visible`.

## Verification Performed

- Read the requested basis docs and current source.
- Checked current diff/status and forbidden-scope paths.
- Ran `git diff --check` over reviewed paths; no whitespace errors, only LF-to-CRLF working-copy warnings.
- Did not rerun Vitest/typecheck/build in this lane; Domain A already recorded focused Vitest, typecheck, and build pass evidence.

## Manual Checks Still Required

- Packaged `.exe` or dev Electron smoke: close Control and confirm Stage closes and the Runtime Player process exits.
- Relaunch, close Stage via OS/taskbar route, confirm Control stays alive and shows Stage unavailable.
- Press `Focus Stage`, confirm Stage reopens/focuses.
- Smoke Runtime Export restore, Browser Source, local preview suspension, Variant switching, live mapping / Body Follow, Stage Motion, and diagnostics.

## Closeout Disposition

The implementation-scope map/report artifact findings are addressed by Domain B closeout artifacts. The stale non-implementation docs are recorded as out-of-scope follow-up because the current assignment only permits writes under `discussion/runtime-player/implementation/**`.
