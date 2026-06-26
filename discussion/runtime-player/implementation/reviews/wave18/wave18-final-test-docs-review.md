# Runtime Player Wave18 Final Test / Docs Review

- Date: 2026-06-26
- Lane: final integration test / verification and documentation adequacy
- Reviewer: Review-Sylph
- Verdict: `pass`
- Re-review: pass after Gnome docs fix
- `post_review_closeout_needed`: no

## Findings

No remaining blocking findings.

Previous finding resolved:

- Earlier review found that `performance-diagnostics.md` and `discussion/runtime-player/_map.md` still told future agents/users to expect copied-report timing fields such as rAF delta, `renderDurationMs`, live input evaluation, and `scheduledFrameDurationMs`, while current copied report output omits those fields.
- Gnome removed those current copied-report/manual expectations from the Performance Diagnostics screen doc and maps. Focused search across the changed docs now returns no matches for `rAF`, `raf`, `renderDurationMs`, `render duration`, `live input evaluation`, `liveRenderInputEvaluationDurationMs`, `scheduledFrameDurationMs`, or `scheduled frame`.
- The docs now describe the visible report proof area as Browser Source clients, fast-path counters, and cache counters (`discussion/runtime-player/screens/performance-diagnostics.md:72`), and the manual checklist compares the copied-report fields that remain product-facing (`discussion/runtime-player/screens/performance-diagnostics.md:170` through `discussion/runtime-player/screens/performance-diagnostics.md:178`).

## Scope And Basis Reviewed

Basis and changed docs reviewed for this re-review:

- `discussion/runtime-player/screens/performance-diagnostics.md`
- `discussion/runtime-player/_map.md`
- `discussion/runtime-player/implementation/_map.md`
- `discussion/runtime-player/implementation/waves/wave18/wave18-final-integration-report.md`
- Current assigned review report before update: `discussion/runtime-player/implementation/reviews/wave18/wave18-final-test-docs-review.md`

Prior source/test basis remains unchanged from the first review:

- Domain A focused diagnostics Vitest: 3 files / 49 tests, pass.
- Domain A `pnpm.cmd typecheck`: pass.
- Domain A review lanes: pass after loop-2 copied-report assertion fix.
- Domain B focused Runtime Player Vitest: 15 files / 128 tests, pass.
- Domain B `pnpm.cmd typecheck`: pass.
- Domain B review lanes: pass.

I did not rerun source tests or typecheck in this re-review because the Gnome fix was documented as docs-only, and the inspected diff confirms no package, lockfile, Editor, package-format, or runtime-core changes. Runtime Player source diffs remain the existing Domain A/B source changes.

## Test / Verification Adequacy Checks

Automated source verification remains sufficient:

- Start Capture no longer enables deep profiling and the lifecycle test asserts the profiling prop is absent.
- Copied report tests keep negative assertions that non-emitted timing summaries are absent from copied text, including `renderInputDrawableMappingDurationMs:`, `renderInputSceneBuildDurationMs:`, `renderInputClippingBuildDurationMs:`, and `scheduledFrameDurationMs:` (`apps/runtime-player/src/control/performance-diagnostics-report.test.ts:279` through `apps/runtime-player/src/control/performance-diagnostics-report.test.ts:283`).
- The product report still retains lightweight health/FPS/connection/fast-path proof fields, and docs now match that product surface.
- Stage IPC and Browser Source protocol/client profiling removal were already covered by Domain B tests and searches; this docs fix did not touch those source paths.

## Documentation / Map Adequacy Checks

Adequate after fix:

- `performance-diagnostics.md` no longer presents Wave17 deep capture as current behavior and no longer asks users to compare non-emitted copied-report timing fields.
- The manual instructions remain concrete: real Runtime Export, iFacialMocap, OBS Browser Source, Browser Source or Both Performance Diagnostics, smoothness check, lightweight copied-report fields, privacy exclusions, and `tmp/report.log`.
- `discussion/runtime-player/_map.md` now lists the pending manual OBS Browser Source verification with lightweight copied-report fields only, without `renderDurationMs` / `scheduledFrameDurationMs`.
- `discussion/runtime-player/implementation/_map.md` and `wave18-final-integration-report.md` record the follow-up docs alignment and the remaining manual OBS smoothness risk.

Closeout verification:

- Final closeout is complete for this lane. `discussion/runtime-player/implementation/reviews/wave18/_map.md` lists `wave18-final-test-docs-review.md` with `Pass` and records that it passed after one docs-fix re-review.
- `discussion/runtime-player/implementation/waves/wave18/_map.md` lists all final Review-Sylph lanes with `pass`, including this test/docs review.
- `discussion/runtime-player/implementation/waves/wave18/wave18-final-integration-report.md` includes a final review results table, records this lane as `pass after docs-fix re-review`, and preserves the `needs_changes` -> docs fix -> pass loop.

## Verification Commands Performed

- `git diff -- discussion/runtime-player/screens/performance-diagnostics.md discussion/runtime-player/_map.md discussion/runtime-player/implementation/_map.md discussion/runtime-player/implementation/waves/wave18/wave18-final-integration-report.md`
- `rg -n "rAF|raf|renderDurationMs|render duration|live input evaluation|liveRenderInputEvaluationDurationMs|scheduledFrameDurationMs|scheduled frame" discussion/runtime-player/screens/performance-diagnostics.md discussion/runtime-player/_map.md discussion/runtime-player/implementation/_map.md discussion/runtime-player/implementation/waves/wave18/wave18-final-integration-report.md`
  - Result: no matches.
- `rg -n "inputReceiveFpsLatest|liveFrameMessageFps|appliedLiveFrameFps|renderFps|browserSourceClientCount|compiledRenderFrameCount|publicSnapshotMaterializationCount|runtimeModelInstanceCache|tmp/report.log|deep profiling|runtime-core phase|runtimeModelCompileDurationMs|copied" discussion/runtime-player/screens/performance-diagnostics.md discussion/runtime-player/_map.md discussion/runtime-player/implementation/_map.md discussion/runtime-player/implementation/waves/wave18/wave18-final-integration-report.md`
  - Result: current docs reference the retained copied-report fields and explicitly state deep runtime-core timing output is omitted.
- `rg -n "scheduledFrameDurationMs:|renderInputDrawableMappingDurationMs:|renderInputSceneBuildDurationMs:|renderInputClippingBuildDurationMs:|runtimeCoreRenderFrameOutputDurationMs:|runtimeCoreEvaluationDurationMs:" apps/runtime-player/src/control/performance-diagnostics-report.test.ts apps/runtime-player/src/control/performance-diagnostics-report.ts`
  - Result: copied-report negative assertions remain; internal report-object fields may remain but are not copied product report lines.
- `git diff --name-only -- package.json pnpm-lock.yaml pnpm-workspace.yaml apps/editor packages/package-format packages/runtime-core`
  - Result: no output.
- `git diff --check -- discussion/runtime-player/screens/performance-diagnostics.md discussion/runtime-player/_map.md discussion/runtime-player/implementation/_map.md discussion/runtime-player/implementation/waves/wave18/wave18-final-integration-report.md`
  - Result: no whitespace findings; CRLF working-copy warnings only.
- Closeout recheck:
  - Read `discussion/runtime-player/implementation/reviews/wave18/_map.md`.
  - Read `discussion/runtime-player/implementation/waves/wave18/_map.md`.
  - Read `discussion/runtime-player/implementation/waves/wave18/wave18-final-integration-report.md`.
  - Confirmed this review artifact is listed with final `Pass`, the docs-fix re-review loop is recorded, and the final report has the final review results table.

`pnpm install` was not run.

## Residual Risks / User-Decision Points

- Real OBS Browser Source smoothness remains manually unverified until the user checks with a real Runtime Export, live iFacialMocap, and OBS Browser Source.
- Runtime Player evaluator-level developer/test `runtimeCoreProfiling?: "disabled" | "deep"` remains by design. Future product bridge work should not expose it without a new accepted decision.
