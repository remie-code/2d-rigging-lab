# Wave89 Domain A Test Adequacy Review

## Verdict

Verdict: `pass`.

I found no blocking test adequacy gaps for Domain A `wave89-texture-atlas-task-apply-performance-fix`.

The focused tests meaningfully prove the accepted Wave89 decisions for Texture Atlas Task preview generation/staleness and preserve enough Apply coverage for the Operation Core-backed, artifact-only path. A few micro-performance aspects remain source-reviewed rather than exhaustively counter-tested; those are residual risks, not blockers.

## Basis Read

- `discussion/_conventions.md`
- `discussion/_map.md`
- `discussion/implementation/orchestration/wave89-plan.md`
- `discussion/design/screen-design/screens/texture-atlas-task.md`
- `discussion/implementation/waves/wave87/wave87-final-integration-report.md`
- `discussion/implementation/waves/wave88/wave88-final-integration-report.md`
- `discussion/implementation/reviews/wave88/wave88-final-clean-integration-review.md`

No Wave89 Domain A implementation report was present at review time, so I reran the focused tests instead of relying on recorded Wave89 command evidence.

## Scope Reviewed

- `apps/editor/src/workspace/atlas/atlas-task-projection.ts`
- `apps/editor/src/workspace/atlas/texture-atlas-task-screen.tsx`
- `apps/editor/src/workspace/atlas/texture-atlas-task-screen.test.ts`
- `packages/authoring-core/src/texture-atlas-targets.ts`
- `packages/authoring-core/src/texture-atlas-mutations.ts`
- `packages/authoring-core/src/texture-atlas-mutations.test.ts`
- `packages/authoring-core/src/texture-atlas-source-signature.ts`
- `packages/operation-core/src/operations/apply-texture-atlas-preview.ts`
- `packages/operation-core/src/operations/apply-texture-atlas-preview.test.ts`
- Targeted diffs for the changed Domain A files.

## Blocking Test Gaps

None.

## Test Adequacy Assessment

### Settings Change Does Not Generate RGBA Page Bytes

Pass.

The projection change stores generated page image data in `TextureAtlasTaskPreviewState` and reuses it in later projections instead of calling `createPreviewPage()` from every `createTextureAtlasTaskProjection()` call. Evidence: `apps/editor/src/workspace/atlas/atlas-task-projection.ts:140`, `apps/editor/src/workspace/atlas/atlas-task-projection.ts:197`, and the only raw page byte generation in the task projection remains inside `createPreviewPage()` at `apps/editor/src/workspace/atlas/atlas-task-projection.ts:340`.

The test mocks `createTextureAtlasPageRgbaBytes()` with a counter at `apps/editor/src/workspace/atlas/texture-atlas-task-screen.test.ts:58`. The focused test proves:

- Generate Preview creates page bytes once: `apps/editor/src/workspace/atlas/texture-atlas-task-screen.test.ts:222`.
- Re-projecting the same ready preview does not increase the counter and reuses the same image object: `apps/editor/src/workspace/atlas/texture-atlas-task-screen.test.ts:237`.
- Changing settings after preview leaves the counter at one: `apps/editor/src/workspace/atlas/texture-atlas-task-screen.test.ts:251`.
- Changing target inputs after preview also leaves the counter at one: `apps/editor/src/workspace/atlas/texture-atlas-task-screen.test.ts:280`.

This is meaningful coverage for the accepted "settings changes after preview do not call raw RGBA page generation" decision.

### Stale Preview UX State

Pass.

The projection marks stale previews by comparing the stored preview signature to current task inputs, disables Apply when stale, and keeps `previewState.previewPage` visible: `apps/editor/src/workspace/atlas/atlas-task-projection.ts:130`, `apps/editor/src/workspace/atlas/atlas-task-projection.ts:151`, and `apps/editor/src/workspace/atlas/atlas-task-projection.ts:178`.

The test asserts stale status, disabled Apply, stale warning code, unchanged image identity, and rendered stale affordance while the old preview image remains present: `apps/editor/src/workspace/atlas/texture-atlas-task-screen.test.ts:262` through `apps/editor/src/workspace/atlas/texture-atlas-task-screen.test.ts:272`.

The component source supports this by rendering the existing page/image when `projection.previewPage` exists and overlaying `data-testid="atlas-preview-stale-warning"` for stale state: `apps/editor/src/workspace/atlas/texture-atlas-task-screen.tsx:164` and `apps/editor/src/workspace/atlas/texture-atlas-task-screen.tsx:214`.

### Generate Preview Owns Heavy Image Generation

Pass.

`Generate Preview` calls `createTextureAtlasTaskPreviewState()`, and that function is where preview creation plus page RGBA image creation now occurs: `apps/editor/src/workspace/atlas/texture-atlas-task-screen.tsx:65` and `apps/editor/src/workspace/atlas/atlas-task-projection.ts:182`.

The counter-based focused test proves a single page-byte generation for the action path and no generation on subsequent projections with the same preview state: `apps/editor/src/workspace/atlas/texture-atlas-task-screen.test.ts:200` through `apps/editor/src/workspace/atlas/texture-atlas-task-screen.test.ts:249`.

### Apply Operation Core / Artifact-Only Coverage

Pass.

Existing operation tests remain relevant and passing. They cover async Operation Core commit, log payload excluding raw `textureBytes`/`atlasBytes`, generated binary artifact registration, source drawable/mesh preservation, and artifact-only model diff paths: `packages/operation-core/src/operations/apply-texture-atlas-preview.test.ts:79` through `packages/operation-core/src/operations/apply-texture-atlas-preview.test.ts:150`.

The Atlas screen test also verifies the user-facing command path still reaches Operation Core and preserves original drawable texture ids and mesh UVs: `apps/editor/src/workspace/atlas/texture-atlas-task-screen.test.ts:329`.

### Apply Reuse / Guard Behavior

Pass.

Domain A removes one avoidable source-byte copy by returning `binaryEntry.bytes` directly from target selection, with a direct identity assertion in the authoring-core test: `packages/authoring-core/src/texture-atlas-targets.ts:406` and `packages/authoring-core/src/texture-atlas-mutations.test.ts:79`.

The authoring-core Apply guard is still tested for source byte mutation after preview. The new test mutates source bytes, applies the stale preview directly, expects `atlas.apply.stalePreview`, and verifies no layout, revision, or dirty-state mutation: `packages/authoring-core/src/texture-atlas-mutations.test.ts:343`.

The operation path still recreates a current preview, compares it to the expected layout, and only then passes `freshnessValidation` into authoring-core Apply to avoid the duplicate guard selection/signature pass: `packages/operation-core/src/operations/apply-texture-atlas-preview.ts:100`, `packages/operation-core/src/operations/apply-texture-atlas-preview.ts:129`, and `packages/operation-core/src/operations/apply-texture-atlas-preview.ts:157`. Existing operation tests cover stale expected layout rejection before mutation: `packages/operation-core/src/operations/apply-texture-atlas-preview.test.ts:225`.

Source signature freshness includes a byte fingerprint over packable target bytes, so operation layout mismatch validation covers source-byte drift when the preview is recreated from current session inputs: `packages/authoring-core/src/texture-atlas-source-signature.ts:108`.

## Verification Performed

- Reviewed all listed basis documents and target source/tests directly.
- Reviewed targeted Domain A diffs for the changed files.
- Checked relevant UI source for stale preview rendering and Apply gating.
- Ran focused tests:
  - `pnpm.cmd exec vitest run apps/editor/src/workspace/atlas/texture-atlas-task-screen.test.ts packages/authoring-core/src/texture-atlas-mutations.test.ts packages/operation-core/src/operations/apply-texture-atlas-preview.test.ts`
  - Sandbox run failed with known Vitest/esbuild `spawn EPERM`.
  - Escalated rerun passed: 3 files, 23 tests.

## Residual Risks

- The settings-change no-regeneration test changes padding only. Page size and edge extrusion share the same signature/stale path by source review, but are not separately asserted.
- Apply performance optimization is partly source-reviewed rather than fully counter-tested. There is no spy proving operation Apply performs exactly one target selection/source signature pass; existing tests validate correctness, stale rejection, and artifact-only behavior.
- No browser pixel/canvas screenshot proof was added for stale preview image visibility. Current proof is React static markup plus projection state.

## User-Decision Points

None for this review lane.
