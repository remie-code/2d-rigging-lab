# Runtime Player Wave15 Domain A Report: Snapshot Validation Hot-Path Removal

- Verdict: pass
- Domain: Snapshot Validation Hot-Path Removal
- Agent: Gnome
- Date: 2026-06-26

## Files Changed

- `packages/runtime-core/src/snapshot.ts`
- `packages/runtime-core/src/runtime-core.ts`
- `packages/runtime-core/src/runtime-core.test.ts`
- `apps/runtime-player/src/stage/runtime-evaluation/runtime-export-pose-evaluator.ts`
- `apps/runtime-player/src/stage/runtime-evaluation/runtime-export-default-pose-evaluation.test.ts`
- `discussion/runtime-player/implementation/waves/wave15/domain-a-snapshot-validation-hot-path-report.md`

## Implementation Summary

- Added explicit runtime-core snapshot validation control through `RuntimeFrameEvaluationControlOptions.snapshotValidation`.
- Added `RuntimeSnapshotValidationMode = "schema" | "skip"`.
- Changed `createRuntimeSnapshot` to construct the snapshot object once, then run `RuntimeSnapshotSchema.parse` only when validation mode is `schema`.
- Kept runtime-core default conservative: `evaluateRuntimeFrame` uses `schema` unless the caller explicitly requests `skip`.
- Updated Runtime Player pose evaluation to request `snapshotValidation: "skip"` by default for normal Stage / Browser Source pose evaluation.
- Kept validation-heavy behavior available by passing `snapshotValidation: "schema"` through `evaluateRuntimeFrame`, or through Runtime Player `evaluateRuntimeExportPose` options.

## Validation Mode Semantics

- `schema`: runs the full `RuntimeSnapshotSchema.parse` path and records `snapshotValidationDurationMs` when profiling is enabled.
- `skip`: returns the internally constructed snapshot DTO without the full schema walk; when profiling is enabled, `snapshotValidationDurationMs` remains `0` from the profiler's default empty duration set.
- `runtimeSnapshotCreationDurationMs` still includes snapshot construction work in both modes.
- Runtime Export DTOs and Runtime Snapshot DTO field semantics were not changed.

Note: `RuntimeEvaluationOptionsSchema` was not edited because Domain A's allowed write scope did not include `packages/runtime-core/src/runtime-options.ts`. The validation control is therefore an explicit frame-evaluation control option, not a Runtime Export or runtime-evaluation-options schema field.

## Tests Run

- `pnpm.cmd exec vitest run packages/runtime-core/src/runtime-core.test.ts apps/runtime-player/src/stage/runtime-evaluation/runtime-export-default-pose-evaluation.test.ts`
  - Initial sandboxed attempt failed at Vitest startup with `spawn EPERM` from esbuild.
  - Re-run with approved escalation: passed, 2 files / 11 tests.
- `pnpm.cmd typecheck`
  - Passed.
- `node scripts/check-source-organization.mjs`
  - Passed.
- `git diff --check -- packages/runtime-core/src/snapshot.ts packages/runtime-core/src/runtime-core.ts packages/runtime-core/src/runtime-core.test.ts apps/runtime-player/src/stage/runtime-evaluation/runtime-export-pose-evaluator.ts apps/runtime-player/src/stage/runtime-evaluation/runtime-export-default-pose-evaluation.test.ts`
  - Passed with LF-to-CRLF working-copy warnings only.

`pnpm install` was not run.

## Source Organization Notes

- No `index.ts` implementation logic was added.
- No new production source files were added.
- Existing responsibility files were extended narrowly:
  - `snapshot.ts` owns snapshot construction and optional validation.
  - `runtime-core.ts` owns frame evaluation option plumbing.
  - `runtime-export-pose-evaluator.ts` owns Runtime Player pose evaluation defaults.
- Source organization guard passed.

## Unresolved Risks / Manual Verification Needs

- Runtime Player still enables deep runtime-core profiling for every pose evaluation; this is left for Wave15 Domain B.
- Skip mode intentionally trusts the internally constructed snapshot and avoids the full Zod schema walk. Focused tests prove structural equality for deterministic runtime-core output and `snapshotValidationDurationMs = 0` for Runtime Player live evaluation.
- Real Browser Source / OBS performance still needs manual verification with the user's real Runtime Export to confirm `runtimeCoreSnapshotValidationDurationMs` is zero or near-zero in normal live captures.
