# Wave 30 Domain B Completion Report: Runtime / Viewer Tutorial Evidence Summary

## Verdict

pass

## Domain

- Target: `wave30-runtime-viewer-tutorial-evidence-summary`
- Purpose: runtime / Preview / Viewer tutorial evidence summary for the synthetic mini model.
- Orchestration: Gnome implementation and Review-Sylph review were separated. Orch-Sylph did not implement source changes.
- Fix loops: 1. Initial review returned `needs_changes`; R1 re-review returned `pass`.

## Files Changed

- `packages/runtime-core/src/tutorial-evidence-summary-schema.ts`
- `packages/runtime-core/src/tutorial-evidence-summary.ts`
- `packages/runtime-core/src/tutorial-evidence-summary.test.ts`
- `packages/runtime-core/src/viewer-evaluation.ts`
- `packages/runtime-core/src/index.ts`
- `apps/editor/src/editor-preview/preview-dto.ts`
- `apps/editor/src/editor-preview/preview-projection.ts`
- `apps/editor/src/editor-preview/preview-projection.test.ts`
- `discussion/implementation/waves/wave30/wave30-domain-b-runtime-viewer-tutorial-evidence-summary.md`
- `discussion/implementation/reviews/wave30/wave30-domain-b-runtime-viewer-tutorial-evidence-summary-review.md`

## Evidence

- Added a deterministic tutorial evidence summary for parts, layers, drawables, meshes, mesh edits, mask/opacity, rig controls, rig-control keyforms, and dynamics.
- Added AI-readable semantic readiness status with required slice refs and missing slice reporting.
- Kept rendered correctness explicitly separate from semantic readiness. Rendered correctness is reported as `not_evaluated` with `fullRenderer`, `pixelOracle`, and `textureSamplingCorrectness` all false.
- Wired the summary into Viewer runtime evidence and editor Preview projection without adding editor UI, operation handlers, validator broad implementation, renderer work, image decode, texture sampling, or dependencies.
- `packages/runtime-core/src/index.ts` remains barrel-only.

## Verification

Performed by Gnome:

- `pnpm.cmd exec vitest run packages/runtime-core/src/tutorial-evidence-summary.test.ts packages/runtime-core/src/viewer-evaluation.test.ts apps/editor/src/editor-preview/preview-projection.test.ts` -> pass, 15 tests after R1.
- `pnpm.cmd run check:source` -> pass.
- `pnpm.cmd typecheck` -> pass after R1.
- `git diff --check -- packages/runtime-core/src apps/editor/src/editor-preview` -> no whitespace errors; CRLF warnings only.

Performed by Review-Sylph:

- `pnpm.cmd exec vitest run packages/runtime-core/src/tutorial-evidence-summary.test.ts packages/runtime-core/src/viewer-evaluation.test.ts apps/editor/src/editor-preview/preview-projection.test.ts` -> pass, 15 tests.
- `pnpm.cmd exec vitest run packages/runtime-core/src/preview-viewer-equivalence-fixture.test.ts` -> pass, 1 test.
- `pnpm.cmd run check:source` -> pass.
- `pnpm.cmd typecheck` -> pass.
- `git diff --check -- packages/runtime-core/src apps/editor/src/editor-preview` -> no whitespace errors; CRLF warnings only.

Performed by Orch-Sylph final check:

- `pnpm.cmd exec vitest run packages/runtime-core/src/tutorial-evidence-summary.test.ts packages/runtime-core/src/viewer-evaluation.test.ts apps/editor/src/editor-preview/preview-projection.test.ts packages/runtime-core/src/preview-viewer-equivalence-fixture.test.ts` -> pass, 4 files / 16 tests.
- `pnpm.cmd typecheck` -> pass.
- `pnpm.cmd run check:source` -> pass.
- `git diff --check -- packages/runtime-core/src apps/editor/src/editor-preview` -> no whitespace errors; CRLF warnings only.

## Review Findings And Fix Loop

Initial Review-Sylph verdict: `needs_changes`.

- `meshEdits` readiness could disagree with the actual `meshEdits` section when bounds/hash changed but moved vertex refs were empty.
- `maskRelationId` schema used raw `z.string()` instead of the established mask relation ID schema.

R1 fix:

- Added deterministic fallback mesh edit refs such as `meshEdit:${meshId}` so hash/bounds-only mesh edit evidence keeps readiness aligned with the `meshEdits` section.
- Changed tutorial mask relation evidence schema to use `MaskRelationIdSchema`.
- Added focused tests for hash/bounds-only mesh edit evidence and invalid mask relation IDs.

R1 Review-Sylph verdict: `pass`.

Review note: `discussion/implementation/reviews/wave30/wave30-domain-b-runtime-viewer-tutorial-evidence-summary-review.md`

## Remaining Issues

None for Domain B.

The summary is intentionally semantic evidence only. It does not prove full renderer behavior, pixel correctness, real image decode, or texture sampling correctness.

## User-Decision Points

None.
