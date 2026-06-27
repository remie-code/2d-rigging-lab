# Runtime Player Wave20 Final Report

- Verdict: pass
- Domain: Domain B / final integration, implementation-scope docs alignment, and wave review
- Orchestrator: Orch-Sylph
- Source implementation agent: Gnome for Domain A only
- Review lanes: Review-Sylph final spec/completion and final test/regression, plus post-docs closeout re-reviews
- Loop count: 1 Domain B docs closeout pass, 1 post-docs closeout re-review pass, 0 source fix loops
- Date: 2026-06-27

## Scope

Runtime Player Wave20 closes the Control Window quit / Stage reopen lifecycle work.

Final integration scope included:

```text
実装事実に合わせて関連ドキュメントを更新する。
```

For this Domain B assignment, allowed writes were limited to `discussion/runtime-player/implementation/**`. Orch-Sylph did not implement source changes. Domain A source implementation and the stale Stage status fix were delegated to Gnome before Domain B.

## Basis

- [../../orchestration/player-wave20-plan.md](../../orchestration/player-wave20-plan.md)
- [runtime-player-wave20-domain-a-control-quit-stage-reopen-lifecycle-report.md](runtime-player-wave20-domain-a-control-quit-stage-reopen-lifecycle-report.md)
- [../../reviews/wave20/domain-a-spec-compliance-review.md](../../reviews/wave20/domain-a-spec-compliance-review.md)
- [../../reviews/wave20/domain-a-design-development-compliance-review.md](../../reviews/wave20/domain-a-design-development-compliance-review.md)
- [../../reviews/wave20/domain-a-test-adequacy-review.md](../../reviews/wave20/domain-a-test-adequacy-review.md)
- [../../reviews/wave20/domain-a-design-development-compliance-post-fix-rereview.md](../../reviews/wave20/domain-a-design-development-compliance-post-fix-rereview.md)
- [../../reviews/wave20/domain-a-test-adequacy-post-fix-rereview.md](../../reviews/wave20/domain-a-test-adequacy-post-fix-rereview.md)
- [../../orchestration/runtime-player-wave-planning-conventions.md](../../orchestration/runtime-player-wave-planning-conventions.md)
- [../../_map.md](../../_map.md)
- [../../orchestration/_map.md](../../orchestration/_map.md)

## Integration Summary

Wave20 accepted behavior is satisfied by Domain A source/test changes and review recovery:

- Control Window close now requests Runtime Player quit and closes Stage.
- Control-driven quit remains on the normal quit controller path and app-owned shutdown path.
- Stage Window direct close does not request app quit.
- `Focus Stage` focuses an existing Stage and recreates/reopens a destroyed Stage before focusing it.
- Explicit quit remains routed through `RuntimePlayerQuitController`.
- Direct Stage close clears stale renderer readiness to `Stage unavailable`, so Control no longer reports stale `Stage ready` or `Model Visible`.
- Browser Source ownership remains app-level rather than tied to native Stage close.

Domain B aligned implementation-scope documentation:

- added this final report;
- added Wave20 wave/review maps;
- wrote final Review-Sylph report artifacts;
- updated implementation/orchestration maps from launch state to final state;
- corrected implementation orchestration Wave19 status so it matches the already-recorded OBS/Chrome comparison closeout.

## Files Changed

Domain A source/test files changed by Gnome:

- `apps/runtime-player/src/main/window-management/runtime-player-windows.ts`
- `apps/runtime-player/src/main/window-management/control-window-recovery.ts`
- `apps/runtime-player/src/main/stage-view-bridge-handlers.ts`
- `apps/runtime-player/src/main/runtime-player-main.ts`
- `apps/runtime-player/src/main/window-management/control-window-recovery.test.ts`
- `apps/runtime-player/src/main/stage-view-bridge-handlers.test.ts`
- `apps/runtime-player/src/control/stage-page.stage-motion.test.ts`

Domain B docs/maps/reports:

- `discussion/runtime-player/implementation/_map.md`
- `discussion/runtime-player/implementation/orchestration/_map.md`
- `discussion/runtime-player/implementation/waves/wave20/_map.md`
- `discussion/runtime-player/implementation/reviews/wave20/_map.md`
- `discussion/runtime-player/implementation/waves/wave20/runtime-player-wave20-final-report.md`
- `discussion/runtime-player/implementation/reviews/wave20/wave20-final-spec-completion-review.md`
- `discussion/runtime-player/implementation/reviews/wave20/domain-b-final-integration-test-regression-review.md`
- `discussion/runtime-player/implementation/reviews/wave20/wave20-final-spec-completion-post-docs-closeout-rereview.md`
- `discussion/runtime-player/implementation/reviews/wave20/domain-b-final-integration-test-regression-post-docs-closeout-rereview.md`

## Review Results

| Lane | Report | Verdict |
|---|---|---|
| Domain A spec compliance | [domain-a-spec-compliance-review.md](../../reviews/wave20/domain-a-spec-compliance-review.md) | pass |
| Domain A design/development post-fix | [domain-a-design-development-compliance-post-fix-rereview.md](../../reviews/wave20/domain-a-design-development-compliance-post-fix-rereview.md) | pass |
| Domain A test adequacy post-fix | [domain-a-test-adequacy-post-fix-rereview.md](../../reviews/wave20/domain-a-test-adequacy-post-fix-rereview.md) | pass |
| Final spec / completion | [wave20-final-spec-completion-review.md](../../reviews/wave20/wave20-final-spec-completion-review.md) | needs_changes, docs-only; implementation-scope findings fixed in Domain B |
| Final test / regression | [domain-b-final-integration-test-regression-review.md](../../reviews/wave20/domain-b-final-integration-test-regression-review.md) | needs_changes, docs-only; implementation-scope findings fixed in Domain B |
| Final spec / completion post-docs closeout | [wave20-final-spec-completion-post-docs-closeout-rereview.md](../../reviews/wave20/wave20-final-spec-completion-post-docs-closeout-rereview.md) | pass |
| Final test / regression post-docs closeout | [domain-b-final-integration-test-regression-post-docs-closeout-rereview.md](../../reviews/wave20/domain-b-final-integration-test-regression-post-docs-closeout-rereview.md) | pass |

No final review lane requested source changes. No Domain B Gnome fix was required.

## Verification

Reused Domain A verification evidence:

- Focused Vitest: `src/main/window-management/control-window-recovery.test.ts`, `src/main/stage-view-bridge-handlers.test.ts`, `src/control/stage-page.stage-motion.test.ts`
  - Passed: 3 files / 38 tests.
- Runtime Player typecheck: passed.
- Runtime Player build: passed.
- Domain A source/test `git diff --check`: passed, LF-to-CRLF working-copy warnings only.
- Domain A post-fix Review-Sylph design/development and test adequacy lanes: passed.

Domain B verification:

- Final Review-Sylph test/regression lane reran the same focused Vitest and it passed: 3 files / 38 tests.
- Post-docs closeout Review-Sylph lanes passed after checking final report, maps, implementation-scope docs closeout, out-of-scope docs notes, changed-path scope, and `git diff --check` evidence.
- Forbidden-scope checks found no Editor, Runtime Export format, package-format/schema, dependency, lockfile, package manifest, or packaging config diffs.
- Domain B ran implementation-scope `git diff --check` after docs/map closeout; result is recorded in the parent response.

`pnpm install` was not run.

## Acceptance Criteria Status

| Criterion | Status |
|---|---|
| Control Window close quits Runtime Player. | Pass by source, tests, and reviews. |
| Control-driven quit closes Stage and stops app-owned background services through normal app shutdown. | Pass by source/review; real process exit remains manual. |
| Stage Window close alone does not quit Runtime Player. | Pass by source/review; OS close route remains manual. |
| `Focus Stage` recreates/reopens Stage if Stage was closed. | Pass by source/tests/reviews. |
| Existing Focus Stage behavior still works when Stage is open. | Pass by source/tests/reviews. |
| Stage status/diagnostics avoid stale ready/model-visible after Stage close. | Pass after Domain A fix and post-fix reviews. |
| Runtime Export restore, Stage state persistence, Browser Source output, Input Mapping, Body Follow, Stage Motion, Variant switching, local preview suspension, diagnostics, and packaging setup are preserved. | Pass by scoped source/review evidence; manual smoke remains required. |
| Focused tests and typecheck/build pass, or failures are classified. | Pass by Domain A evidence and final test/regression review. |
| No `pnpm install` is run by agents. | Pass. |
| No Runtime Export format changes. | Pass. |
| No Editor changes. | Pass. |
| No package-format schema changes. | Pass. |
| No new dependencies or lockfile edits. | Pass. |

## Forbidden-Scope Confirmation

- No Editor changes were found.
- No Runtime Export format changes were found.
- No package-format schema changes were found.
- No dependency or lockfile changes were found.
- No package manifest or packaging config changes were found.
- No `pnpm install` was run.
- Browser Source lifecycle ownership was not moved to native Stage lifetime.
- Runtime Export restore, Browser Source, local preview suspension, Variant switching, live mapping / Body Follow, Stage Motion, diagnostics, and packaging setup were not intentionally changed outside the Wave20 lifecycle scope.

## Remaining Manual Checks

- Launch Runtime Player from packaged `.exe` if available, or dev mode if not.
- Close Control Window with the normal close button and confirm Stage closes and the Runtime Player process exits.
- Relaunch Runtime Player.
- Close Stage through taskbar / OS route if possible and confirm Control remains alive.
- Confirm Control reports Stage unavailable and does not show stale ready/model-visible wording.
- Press `Focus Stage` and confirm Stage reopens and focuses.
- Smoke-check Runtime Export restore, Stage state persistence, Browser Source, Input Mapping, Body Follow, Stage Motion, Variant switching, local preview suspension, and diagnostics after reopen/relaunch.

## Residual Risks And Out-of-Scope Notes

- Real packaged Electron process-exit behavior remains manual because unit tests do not fully emulate OS close/taskbar routes.
- Reopen resync for Variant status, latest live frame, and Stage Motion display transform is source-inspected and covered by lower-level tests, but not by one wired integration test.
- Final reviewers found stale Wave8-era close-hide wording in `discussion/runtime-player/_map.md`, `discussion/runtime-player/screens/**`, and `discussion/runtime-player/backlog/**`. Those files are outside this Domain B assignment's allowed write scope, so they remain follow-up documentation work for Undine or a separately authorized docs pass.
