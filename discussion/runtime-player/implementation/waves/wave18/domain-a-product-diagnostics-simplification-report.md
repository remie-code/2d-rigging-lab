# Runtime Player Wave18 Domain A Report: Product Diagnostics Simplification

- Verdict recommendation: pass
- Domain: Domain A / Product Diagnostics Simplification
- Agent: Orch-Sylph
- Loop count: 2
- Date: 2026-06-26

## Scope

Domain A simplified Control Performance Diagnostics and copied report output to lightweight live health, FPS, connection, and fast-path proof evidence.

Basis:

- [../../orchestration/player-wave18-plan.md](../../orchestration/player-wave18-plan.md)
- [../../orchestration/player-wave17-plan.md](../../orchestration/player-wave17-plan.md)
- [../wave17/wave17-final-integration-report.md](../wave17/wave17-final-integration-report.md)
- [../../../screens/performance-diagnostics.md](../../../screens/performance-diagnostics.md)
- [../../orchestration/runtime-player-wave-planning-conventions.md](../../orchestration/runtime-player-wave-planning-conventions.md)

Out of scope preserved:

- No broad Stage / Browser Source profiling transport cleanup.
- No runtime-core internal profiling deletion.
- No Runtime Export format changes.
- No Editor changes.
- No package-format schema changes.
- No new dependencies, lockfile edits, or `pnpm install`.

## Implementation Summary

Gnome implemented source/test changes in a separate context.

Changed source/test files:

- `apps/runtime-player/src/control/performance-diagnostics-page.tsx`
- `apps/runtime-player/src/control/performance-diagnostics-report.ts`
- `apps/runtime-player/src/control/performance-diagnostics-page.lifecycle.test.ts`
- `apps/runtime-player/src/control/performance-diagnostics-report.test.ts`

Implementation facts:

- Start Capture, Stop Capture, Clear Report, and unmount no longer request runtime-core deep profiling from the Control Performance Diagnostics page.
- Copied report output now declares `diagnosticScope: live-health-fps-connection-fast-path`.
- Product-facing copied report output omits deep runtime-core phase timing fields and `runtimeModelCompileDurationMs`.
- Copied report output keeps lightweight input, target availability, live/apply/render FPS and counts, Browser Source client count, scheduled/immediate render counts, canvas/DPR, fast-path proof counters, transient counters, scaffold cache counters, and runtime model instance cache counters.
- Missing or unavailable lightweight metrics render as `unknown` or target availability states instead of failing report formatting.
- Privacy exclusions remain present and tested for raw tracking frames, calibration internals, Browser Source token, private paths, full Runtime Export payload, textures, and mesh data.

## Review Results

| Lane | Report | Verdict |
|---|---|---|
| Spec compliance | [domain-a-spec-compliance-review.md](../../reviews/wave18/domain-a-spec-compliance-review.md) | pass |
| Design / development compliance | [domain-a-design-development-compliance-review.md](../../reviews/wave18/domain-a-design-development-compliance-review.md) | pass |
| Test adequacy | [domain-a-test-adequacy-review.md](../../reviews/wave18/domain-a-test-adequacy-review.md) | pass after loop-2 fix |

Loop notes:

- Loop 1 spec compliance passed.
- Loop 1 design/development compliance passed.
- Loop 1 test adequacy requested additional copied report assertions for retained counter lines.
- Loop 2 added assertions for `transientInstanceCount`, `runtimeModelInstanceCacheMissCount`, `runtimeModelInstanceCacheInvalidationCount`, and `scaffoldEvaluationCacheInvalidationCount`.
- Loop 2 test adequacy re-review passed.

## Verification

Gnome verification:

- `pnpm.cmd exec vitest run apps/runtime-player/src/control/performance-diagnostics-report.test.ts apps/runtime-player/src/control/performance-diagnostics-page.lifecycle.test.ts apps/runtime-player/src/main/performance-diagnostics-metrics-validation.test.ts`
  - Loop 1: pass after sandbox `EPERM` was rerun with elevation, 3 files / 49 tests.
  - Loop 2: pass, 3 files / 49 tests.
- `pnpm.cmd typecheck`
  - Loop 1: pass.
- `git diff --check -- ...`
  - No whitespace findings; CRLF working-copy warnings only.

Orch-Sylph verification:

- `pnpm.cmd exec vitest run apps/runtime-player/src/control/performance-diagnostics-report.test.ts apps/runtime-player/src/control/performance-diagnostics-page.lifecycle.test.ts apps/runtime-player/src/main/performance-diagnostics-metrics-validation.test.ts`
  - After loop 1: pass, 3 files / 49 tests.
  - After loop 2: pass, 3 files / 49 tests.
- `pnpm.cmd typecheck`
  - After loop 1: pass.
  - After loop 2: pass.
- `git diff --check -- apps/runtime-player/src/control/performance-diagnostics-page.tsx apps/runtime-player/src/control/performance-diagnostics-report.ts apps/runtime-player/src/control/performance-diagnostics-page.lifecycle.test.ts apps/runtime-player/src/control/performance-diagnostics-report.test.ts`
  - No whitespace findings; CRLF working-copy warnings only.

Reviewer verification:

- Spec compliance reviewer independently inspected the diff, ran focused diagnostics tests for the two changed diagnostics test files, and ran `pnpm.cmd typecheck`; verdict `pass`.
- Design/development reviewer independently inspected the diff, ran focused diagnostics tests for the two changed diagnostics test files, ran `pnpm.cmd typecheck`, checked scope-sensitive paths, and found no scope creep; verdict `pass`.
- Test adequacy reviewer independently inspected the loop-2 diff and ran focused diagnostics tests for all three diagnostics test files; verdict `pass`.

## Residual Risks / Next-Domain Notes

- Domain B still owns product Stage / Browser Source profiling IPC/WS/protocol cleanup. Domain A removed Control Performance Diagnostics activation but left the broader transport/API surface intact.
- Domain B still owns making `publicSnapshotMaterializationCount` a cheap proof counter independent of deep profiling at the source/transport level.
- `PerformanceDiagnosticsPage` still accepts the inert optional `onSetRuntimeCoreProfiling` prop; Domain B should remove the remaining product profiling bridge surface.
- `copyRenderMetricsSnapshot()` still copies upstream runtime-core metric fields internally, but Domain A no longer exposes them in the product-facing target report or copied report output.
- `discussion/runtime-player/screens/performance-diagnostics.md` still reflects Wave17 deep-capture behavior. Wave18 final integration should update docs/maps after Domains A-B settle implementation facts.
- Real OBS Browser Source behavior remains a later manual check; Domain A automated verification covers Control/report behavior only.
