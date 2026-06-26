# Runtime Player Wave18 Final Integration Report: Lightweight Performance Diagnostics Cleanup

- Verdict: pass
- Domain: Domain C / Final Integration / Docs Alignment
- Agent: Gnome
- Date: 2026-06-26

## Scope

Domain C integrated the Wave18 source/test facts from Domains A-B, updated Runtime Player documentation/maps to match those facts, and recorded the remaining real OBS Browser Source manual check.

実装事実に合わせて関連ドキュメントを更新する。

Domain C did not perform source implementation, source test edits, Runtime Export format work, Editor work, package-format schema work, dependency work, package manifest edits, lockfile edits, or `pnpm install`.

Basis:

- [../../orchestration/player-wave18-plan.md](../../orchestration/player-wave18-plan.md)
- [domain-a-product-diagnostics-simplification-report.md](domain-a-product-diagnostics-simplification-report.md)
- [domain-b-product-profiling-transport-removal-report.md](domain-b-product-profiling-transport-removal-report.md)
- [../../reviews/wave18/_map.md](../../reviews/wave18/_map.md)
- [../../reviews/wave18/domain-a-spec-compliance-review.md](../../reviews/wave18/domain-a-spec-compliance-review.md)
- [../../reviews/wave18/domain-a-design-development-compliance-review.md](../../reviews/wave18/domain-a-design-development-compliance-review.md)
- [../../reviews/wave18/domain-a-test-adequacy-review.md](../../reviews/wave18/domain-a-test-adequacy-review.md)
- [../../reviews/wave18/domain-b-spec-compliance-review.md](../../reviews/wave18/domain-b-spec-compliance-review.md)
- [../../reviews/wave18/domain-b-design-development-compliance-review.md](../../reviews/wave18/domain-b-design-development-compliance-review.md)
- [../../reviews/wave18/domain-b-test-adequacy-review.md](../../reviews/wave18/domain-b-test-adequacy-review.md)
- [../../orchestration/player-wave17-plan.md](../../orchestration/player-wave17-plan.md)
- [../wave17/wave17-final-integration-report.md](../wave17/wave17-final-integration-report.md)
- [../../../screens/performance-diagnostics.md](../../../screens/performance-diagnostics.md)
- [../../orchestration/runtime-player-wave-planning-conventions.md](../../orchestration/runtime-player-wave-planning-conventions.md)

## Domains A-B Pass Confirmation

| Domain | Report | Spec compliance | Design / development compliance | Test adequacy |
|---|---|---|---|---|
| A: Product diagnostics simplification | [domain-a-product-diagnostics-simplification-report.md](domain-a-product-diagnostics-simplification-report.md) | [pass](../../reviews/wave18/domain-a-spec-compliance-review.md) | [pass](../../reviews/wave18/domain-a-design-development-compliance-review.md) | [pass after loop-2 fix](../../reviews/wave18/domain-a-test-adequacy-review.md) |
| B: Product profiling transport removal / cheap proof counters | [domain-b-product-profiling-transport-removal-report.md](domain-b-product-profiling-transport-removal-report.md) | [pass](../../reviews/wave18/domain-b-spec-compliance-review.md) | [pass](../../reviews/wave18/domain-b-design-development-compliance-review.md) | [pass](../../reviews/wave18/domain-b-test-adequacy-review.md) |

Both implementation domains report `pass`, and each has the required three-lane Review-Sylph evidence.

## Final Review Results

| Lane | Report | Verdict |
|---|---|---|
| Final spec / completion | [wave18-final-spec-completion-review.md](../../reviews/wave18/wave18-final-spec-completion-review.md) | pass |
| Final design / development | [wave18-final-design-development-review.md](../../reviews/wave18/wave18-final-design-development-review.md) | pass |
| Final test / docs | [wave18-final-test-docs-review.md](../../reviews/wave18/wave18-final-test-docs-review.md) | pass after docs-fix re-review |

All three final Review-Sylph lanes passed. The test/docs lane initially returned `needs_changes` for copied-report timing expectations in docs; the docs were fixed, and re-review passed with no remaining findings.

## Final Integration Checks

- Performance Diagnostics is lightweight Live Health / FPS / connection / fast-path proof, not a product deep profiler.
- Product Start Capture does not enable runtime-core deep profiling.
- Product Stage / Browser Source profiling transport is removed.
- Runtime-core internal developer/test profiling may remain.
- Browser Source behavior is not changed by running Performance Diagnostics except lightweight metrics sampling.
- Wave17 fast render-frame path remains active.
- No Runtime Export format changes.
- No Editor changes.
- No package-format runtime schema changes.
- No new dependencies or lockfile changes.

## Documentation / Maps Updated

- [../../../screens/performance-diagnostics.md](../../../screens/performance-diagnostics.md)
- [../../../_map.md](../../../_map.md)
- [../../_map.md](../../_map.md)
- [_map.md](_map.md)
- [../../reviews/wave18/_map.md](../../reviews/wave18/_map.md)
- [wave18-final-integration-report.md](wave18-final-integration-report.md)

Backlog was intentionally not edited because no concrete diagnostic/profiling backlog item status changed. The remaining real OBS Browser Source check is still manual verification, not a completed backlog transition.

Follow-up docs fix for test/docs re-review:

- Updated the Performance Diagnostics screen doc and maps so copied-report/manual expectations match the Wave18 product report surface.
- Removed copied-report expectations for non-emitted timing summaries from the current manual checklist.

## Implementation Facts Reflected

- Product Performance Diagnostics reports now focus on input FPS/count, live frame FPS/count, applied frame FPS/count, render FPS/count, Browser Source client count, canvas/DPR, Stage Motion state, scheduled/immediate render counts, fast-path proof counters, transient counters, scaffold counters, and runtime model instance cache counters.
- Product reports omit deep runtime-core phase timings and `runtimeModelCompileDurationMs` as product-facing timing.
- Product Stage IPC, Browser Source HTTP/WS transport, and Browser Source client handling no longer expose or apply runtime-core profiling mode changes.
- `publicSnapshotMaterializationCount` is now a cheap Runtime Player evaluation-profile counter independent of runtime-core deep profiling.
- `compiledRenderFrameCount`, transient compile/instance counters, and runtime instance cache counters remain available as Wave17 fast render-frame proof.
- Runtime-core internal developer/test profiling and Runtime Player evaluator-level developer/test profiling may remain, but are not product-reachable through Control, Stage IPC, Browser Source HTTP/WS, or Browser Source client handling.

## Verification

Inherited source verification from Domains A-B:

- Domain A focused diagnostics Vitest passed: 3 files / 49 tests.
- Domain A `pnpm.cmd typecheck` passed.
- Domain A review lanes passed for spec compliance, design/development compliance, and test adequacy after the loop-2 copied-report assertion fix.
- Domain B focused Runtime Player Vitest passed: 15 files / 128 tests.
- Domain B `pnpm.cmd typecheck` passed.
- Domain B review lanes passed for spec compliance, design/development compliance, and test adequacy.
- Final design/development review reran focused Runtime Player Vitest, 15 files / 128 tests, and `pnpm.cmd typecheck`; both passed.
- Final test/docs review passed after one docs-fix re-review.
- Scope-sensitive checks in Domain B found no diff in `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `apps/editor`, `packages/package-format`, or `packages/runtime-core`.

Domain C docs verification:

- Targeted `rg` checks confirmed the old Wave17 Start Capture / deep-capture wording is absent from `performance-diagnostics.md`.
- `git diff --check -- discussion/runtime-player` was run for tracked documentation changes.
- Result: no whitespace findings; LF/CRLF working-copy warnings only.
- `git diff --no-index --check -- NUL ...` was run for the untracked Wave18 docs/maps touched by this task.
- Result: no whitespace findings; normal no-index diff status with LF/CRLF working-copy warnings only.
- `git diff --name-only -- package.json pnpm-lock.yaml pnpm-workspace.yaml apps/editor packages/package-format packages/runtime-core` had no output.

`pnpm install` was not run by Domain C.

## Manual User Check Still Required

Real OBS Browser Source smoothness remains manually unverified until the user checks the product path with a real Runtime Export and live input.

Ask the user to:

- Open Runtime Player with the real Runtime Export.
- Connect iFacialMocap.
- Connect OBS Browser Source using the Runtime Player Browser Source URL.
- Run Performance Diagnostics for `Browser Source` or `Both`.
- Confirm the act of diagnostics capture no longer visibly degrades Browser Source smoothness.
- Check the report focuses on input FPS, live frame FPS, applied frame FPS, render FPS, Browser Source client count, fast-path counters, snapshot materialization proof counter, and runtime instance cache counters.
- Confirm copied reports omit deep runtime-core phase timings and `runtimeModelCompileDurationMs` as product-facing timing.
- Confirm copied reports exclude raw tracking frames, calibration internals, Browser Source token, private paths, full Runtime Export payload, Runtime Export textures, and Runtime Export mesh data.
- Save the copied report to `tmp/report.log` if follow-up discussion is needed.

## Residual Risks / Next-Wave Recommendations

- Real OBS Browser Source smoothness is not proven until the manual check above is completed.
- Future product bridge or Browser Source work should not re-expose runtime-core profiling mode without a new accepted design decision.
- If Browser Source still feels unsmooth after Wave18, use the lightweight copied report to decide whether the next narrow follow-up should target renderer upload/draw cost, deformer vertex transform cost, frame scheduling, or OBS Browser Source settings.
- Internal developer/test profiling can stay useful, but it should remain separate from product Performance Diagnostics.
