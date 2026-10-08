# Wave101 Domain A Test Adequacy Review

## Verdict

Verdict: `pass`.

The required Skyline packing, Apply guard, Blocking Issues UI, Runtime Export, and Viewer Atlas Runtime evidence is adequate for this wave gate. I found no blocking or needs-change test adequacy issues.

## Findings

1. Low / non-blocking: `atlas.pack.cannotFit` has deterministic coverage for an oversized single target, but not for the later Skyline no-candidate path where each target individually fits and the set cannot be placed.
   - Evidence: `packages/authoring-core/src/texture-atlas-packing.test.ts:163` covers the oversized failure and deterministic diagnostic. The source also has a second no-candidate failure branch at `packages/authoring-core/src/texture-atlas-packing.ts:292`.
   - Assessment: not blocking because the rubric requires a cannotFit test and deterministic diagnostic, and that exists. A future fixture for the no-candidate branch would improve branch specificity.

## Scope Reviewed

Implementation files:

- `packages/package-format/src/texture-atlas.ts`
- `packages/authoring-core/src/texture-atlas-packing.ts`
- `packages/authoring-core/src/texture-atlas-mutations.ts`
- `packages/operation-core/src/operations/apply-texture-atlas-preview.ts`
- `apps/editor/src/workspace/atlas/atlas-task-projection.ts`
- `apps/editor/src/workspace/atlas/texture-atlas-task-screen.tsx`

Test files:

- `packages/package-format/src/package-document.test.ts`
- `packages/authoring-core/src/texture-atlas-packing.test.ts`
- `packages/authoring-core/src/texture-atlas-mutations.test.ts`
- `packages/operation-core/src/operations/apply-texture-atlas-preview.test.ts`
- `apps/editor/src/workspace/atlas/texture-atlas-task-screen.test.ts`

Additional compatibility evidence reviewed:

- `packages/authoring-core/src/texture-atlas-source-signature.ts`
- `packages/authoring-core/src/runtime-export-assembly.ts`
- `packages/authoring-core/src/runtime-export-assembly.test.ts`
- `packages/package-format/src/runtime-export.test.ts`
- `apps/editor/src/workspace/viewer/viewer-render-source.test.ts`

Pre-existing dirty Wave100 Viewer files under `apps/editor/src/workspace/viewer/**` were not edited for this review.

## Basis Reviewed

- `discussion/implementation/orchestration/wave101-plan.md`
- `discussion/design/texture-atlas/skyline-packing-v1.md`
- `discussion/design/screen-design/screens/texture-atlas-task.md`
- `discussion/implementation/waves/wave101/wave101-domain-a-texture-atlas-skyline-packing-blocking-issues-integration-report.md`

## Test Adequacy Matrix

| Requirement | Adequacy | Evidence |
|---|---:|---|
| Mixed-size Skyline packing | Covered | `packages/authoring-core/src/texture-atlas-packing.test.ts:97` |
| Deterministic layout for same input | Covered | `packages/authoring-core/src/texture-atlas-packing.test.ts:104`, `packages/authoring-core/src/texture-atlas-packing.test.ts:120` |
| Non-overlap and within-page bounds | Covered | `packages/authoring-core/src/texture-atlas-packing.test.ts:132`, helpers at `packages/authoring-core/src/texture-atlas-packing.test.ts:436` and `packages/authoring-core/src/texture-atlas-packing.test.ts:453` |
| Padding/content rect/sourceRect/uv rect correctness | Covered | `packages/authoring-core/src/texture-atlas-packing.test.ts:136` |
| cannotFit negative behavior and deterministic diagnostic | Covered, with residual branch gap | `packages/authoring-core/src/texture-atlas-packing.test.ts:163`; source branch at `packages/authoring-core/src/texture-atlas-packing.ts:292` is not separately exercised |
| Old shelf compatibility / parse coverage | Covered | Shelf path test `packages/authoring-core/src/texture-atlas-packing.test.ts:62`; schema parse `packages/package-format/src/package-document.test.ts:262` |
| Skyline algorithm id recorded for new layouts | Covered | `packages/authoring-core/src/texture-atlas-packing.test.ts:39`; `packages/authoring-core/src/texture-atlas-mutations.test.ts:335`; `packages/operation-core/src/operations/apply-texture-atlas-preview.test.ts:104` |
| Source signature / stale / Apply guard includes algorithm distinction or equivalent precondition | Covered | Source signature includes settings algorithm at `packages/authoring-core/src/texture-atlas-source-signature.ts:53`; digest distinction test at `packages/authoring-core/src/texture-atlas-packing.test.ts:200`; operation precondition at `packages/operation-core/src/operations/apply-texture-atlas-preview.ts:231`; algorithm mismatch test at `packages/operation-core/src/operations/apply-texture-atlas-preview.test.ts:253` |
| Generate Preview uses Skyline layout | Covered | Default algorithm source `packages/authoring-core/src/texture-atlas-packing.ts:27`; UI preview state test `apps/editor/src/workspace/atlas/texture-atlas-task-screen.test.ts:201` |
| Apply Atlas uses/validates Skyline layout and remains artifact-only | Covered | Recreate uses payload algorithm at `packages/operation-core/src/operations/apply-texture-atlas-preview.ts:100`; artifact-only assertions at `packages/authoring-core/src/texture-atlas-mutations.test.ts:289` and `packages/operation-core/src/operations/apply-texture-atlas-preview.test.ts:81` |
| Edge extrusion existing behavior still passes | Covered | Pixel assertions in `packages/authoring-core/src/texture-atlas-mutations.test.ts:318` |
| UI Blocking Issues and central preview failure card coverage | Covered | `apps/editor/src/workspace/atlas/texture-atlas-task-screen.test.ts:303` |
| Blocking Issues location above Settings/Lists/Warnings | Covered | DOM order assertions at `apps/editor/src/workspace/atlas/texture-atlas-task-screen.test.ts:337` |
| Apply disabled on failed/stale preview | Covered | Projection source `apps/editor/src/workspace/atlas/atlas-task-projection.ts:172`; stale tests `apps/editor/src/workspace/atlas/texture-atlas-task-screen.test.ts:253` and `apps/editor/src/workspace/atlas/texture-atlas-task-screen.test.ts:284`; failed test `apps/editor/src/workspace/atlas/texture-atlas-task-screen.test.ts:325`; button source `apps/editor/src/workspace/atlas/texture-atlas-task-screen.tsx:135` |
| Header/title row stable / no extra row for failure | Covered by structure test and source | Single `atlas-preview-state` assertion at `apps/editor/src/workspace/atlas/texture-atlas-task-screen.test.ts:363`; title row source `apps/editor/src/workspace/atlas/texture-atlas-task-screen.tsx:173` |
| Viewer Atlas Runtime compatibility | Covered | Viewer fixture applies default preview at `apps/editor/src/workspace/viewer/viewer-render-source.test.ts:496`; focused viewer test passed |
| Runtime Export compatibility | Covered | Runtime export fixture applies default preview at `packages/authoring-core/src/runtime-export-assembly.test.ts:401`; focused runtime export assembly test passed |

## Verification Commands / Results

Sandbox Vitest attempts:

- `pnpm.cmd exec vitest run packages/authoring-core/src/texture-atlas-packing.test.ts`: sandbox failed with `spawn EPERM`; escalated rerun passed, 1 file / 6 tests.
- `pnpm.cmd exec vitest run packages/package-format/src/package-document.test.ts`: sandbox failed with `spawn EPERM`; escalated rerun passed, 1 file / 11 tests.
- `pnpm.cmd exec vitest run packages/authoring-core/src/texture-atlas-mutations.test.ts`: sandbox failed with `spawn EPERM`; escalated rerun passed, 1 file / 8 tests.
- `pnpm.cmd exec vitest run packages/operation-core/src/operations/apply-texture-atlas-preview.test.ts`: sandbox failed with `spawn EPERM`; escalated rerun passed, 1 file / 8 tests.
- `pnpm.cmd exec vitest run apps/editor/src/workspace/atlas`: sandbox failed with `spawn EPERM`; escalated rerun passed, 1 file / 9 tests.
- `pnpm.cmd exec vitest run packages/package-format/src/runtime-export.test.ts`: sandbox failed with `spawn EPERM`; escalated rerun passed, 1 file / 8 tests.
- `pnpm.cmd exec vitest run packages/authoring-core/src/runtime-export-assembly.test.ts`: sandbox failed with `spawn EPERM`; escalated rerun passed, 1 file / 15 tests.
- `pnpm.cmd exec vitest run apps/editor/src/workspace/viewer/viewer-render-source.test.ts`: sandbox failed with `spawn EPERM`; escalated rerun passed, 1 file / 14 tests.

Other verification:

- `pnpm.cmd typecheck`: passed in sandbox.
- `git diff --check -- <Domain A source/test paths>`: passed; only CRLF working-copy warnings were printed.

## Untested Residual Risks

- No dedicated test currently targets the Skyline no-candidate cannotFit branch after prior placements; oversized cannotFit is covered.
- Header/title row stability is asserted structurally via SSR markup and source shape, not via browser pixel/height measurement.
- Full repository tests and browser visual/E2E tests were not run.
- Viewer files are dirty from pre-existing Wave100 work; this review used focused viewer compatibility testing and source evidence, not a full viewer review.

## User-Decision Points

None.
