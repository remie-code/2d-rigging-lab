# Wave88 Domain B Spec Compliance Review

## Verdict

`pass`

Review lane: Spec Compliance Review
Target: `wave88-viewer-original-atlas-runtime-mode`

No blocking spec-compliance findings were found for Domain B.

## Basis Read

- `discussion/implementation/orchestration/wave88-plan.md`
- `discussion/design/screen-design/screens/texture-atlas-task.md`
- `discussion/design/screen-design/screens/viewer-runtime-view.md`
- `discussion/implementation/waves/wave88/wave88-domain-a-artifact-only-atlas-apply-source-signature-report.md`
- `discussion/implementation/reviews/wave88/wave88-domain-a-spec-compliance-review.md`
- `discussion/implementation/reviews/wave88/wave88-domain-a-design-development-review.md`
- `discussion/implementation/reviews/wave88/wave88-domain-a-test-adequacy-review.md`
- `discussion/implementation/waves/wave87/wave87-final-integration-report.md`
- `discussion/implementation/reviews/wave87/wave87-final-clean-integration-review.md`
- `discussion/implementation/waves/wave88/wave88-domain-b-viewer-original-atlas-runtime-mode-report.md`
- Changed Domain B source/tests:
  - `apps/editor/src/workspace/viewer/viewer-render-source.ts`
  - `apps/editor/src/workspace/viewer/viewer-render-source.test.ts`
  - `apps/editor/src/workspace/viewer/viewer-clean-stage.ts`
  - `apps/editor/src/workspace/viewer/viewer-runtime-screen.tsx`
  - `apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts`
  - `apps/editor/src/workspace/viewer/runtime-controls.tsx`
  - `apps/editor/src/workspace/viewer/runtime-controls-state.test.ts`
  - `apps/editor/src/workspace/atlas/texture-atlas-task-screen.test.ts`

## Findings

Blocking findings: none.

Non-blocking / Domain C-owned documentation mismatch:

- `discussion/design/screen-design/screens/texture-atlas-task.md` still contains pre-Wave88 destructive Apply wording that says Apply updates Drawable texture references and UVs: `discussion/design/screen-design/screens/texture-atlas-task.md:227`, `discussion/design/screen-design/screens/texture-atlas-task.md:230`, `discussion/design/screen-design/screens/texture-atlas-task.md:231`.
- `discussion/design/screen-design/screens/viewer-runtime-view.md` still says parameter search is the top Runtime Controls item: `discussion/design/screen-design/screens/viewer-runtime-view.md:161`, `discussion/design/screen-design/screens/viewer-runtime-view.md:297`.
- I am not classifying these as Domain B blockers because Wave88 explicitly assigns design-document updates to Domain C, while the source follows the Wave88 plan behavior: `discussion/implementation/orchestration/wave88-plan.md:351`, `discussion/implementation/orchestration/wave88-plan.md:353`, `discussion/implementation/orchestration/wave88-plan.md:354`, `discussion/implementation/orchestration/wave88-plan.md:355`.

## Spec Compliance Assessment

### Viewer supports `Original` and `Atlas Runtime`

Pass.

- The render-source type and labels define exactly the two required modes: `apps/editor/src/workspace/viewer/viewer-render-source.ts:15`, `apps/editor/src/workspace/viewer/viewer-render-source.ts:17`.
- Runtime Controls renders the two-state mode control above parameter search: `apps/editor/src/workspace/viewer/runtime-controls.tsx:98`, `apps/editor/src/workspace/viewer/runtime-controls.tsx:106`, `apps/editor/src/workspace/viewer/runtime-controls.tsx:114`, `apps/editor/src/workspace/viewer/runtime-controls.tsx:188`.
- UI tests assert the control labels, disabled reason, and ordering above search: `apps/editor/src/workspace/viewer/runtime-controls-state.test.ts:327`, `apps/editor/src/workspace/viewer/runtime-controls-state.test.ts:335`, `apps/editor/src/workspace/viewer/runtime-controls-state.test.ts:342`; route-level coverage repeats this at `apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts:183`.

### `Original` keeps existing clean-stage behavior

Pass.

- `createViewerCleanStageRenderSourceProjection()` first builds the existing Canvas projection through `createCanvasRenderProjection()` and then applies render-source resolution: `apps/editor/src/workspace/viewer/viewer-clean-stage.ts:53`, `apps/editor/src/workspace/viewer/viewer-clean-stage.ts:57`, `apps/editor/src/workspace/viewer/viewer-clean-stage.ts:64`.
- Default `createViewerCleanStageProjection()` still returns only the projection, preserving the existing call shape: `apps/editor/src/workspace/viewer/viewer-clean-stage.ts:46`, `apps/editor/src/workspace/viewer/viewer-clean-stage.ts:50`.
- Tests assert Original keeps authoring texture refs, original dimensions, and original UVs: `apps/editor/src/workspace/viewer/viewer-render-source.test.ts:49`, `apps/editor/src/workspace/viewer/viewer-render-source.test.ts:58`, `apps/editor/src/workspace/viewer/viewer-render-source.test.ts:60`, `apps/editor/src/workspace/viewer/viewer-render-source.test.ts:63`.

### `Atlas Runtime` uses committed artifact and projection-only remap

Pass.

- Availability is based on committed `session.graph.textureAtlas.layoutSummary`, first page, matching generated texture entry, binary ref, loaded binary bytes, dimensions, byte length, and source signature: `apps/editor/src/workspace/viewer/viewer-render-source.ts:135`, `apps/editor/src/workspace/viewer/viewer-render-source.ts:140`, `apps/editor/src/workspace/viewer/viewer-render-source.ts:145`, `apps/editor/src/workspace/viewer/viewer-render-source.ts:157`, `apps/editor/src/workspace/viewer/viewer-render-source.ts:167`, `apps/editor/src/workspace/viewer/viewer-render-source.ts:190`, `apps/editor/src/workspace/viewer/viewer-render-source.ts:203`.
- Stale handling recomputes Domain A source signature from current source inputs and compares it with `layoutSummary.sourceSignature`: `apps/editor/src/workspace/viewer/viewer-render-source.ts:210`, `apps/editor/src/workspace/viewer/viewer-render-source.ts:217`.
- Projection remap changes the temporary Viewer projection texture id, binary id/path, bytes, dimensions, and evaluated UVs using placement `uvRect`: `apps/editor/src/workspace/viewer/viewer-render-source.ts:294`, `apps/editor/src/workspace/viewer/viewer-render-source.ts:305`, `apps/editor/src/workspace/viewer/viewer-render-source.ts:318`, `apps/editor/src/workspace/viewer/viewer-render-source.ts:326`, `apps/editor/src/workspace/viewer/viewer-render-source.ts:331`.
- Tests assert texture refs, atlas bytes object, dimensions, UV remap, and no `session.graph` mutation: `apps/editor/src/workspace/viewer/viewer-render-source.test.ts:67`, `apps/editor/src/workspace/viewer/viewer-render-source.test.ts:87`, `apps/editor/src/workspace/viewer/viewer-render-source.test.ts:93`, `apps/editor/src/workspace/viewer/viewer-render-source.test.ts:99`.

### No Viewer session mutation

Pass.

- Reviewed Domain B source shows Viewer render-source code reads `session.graph` for atlas artifact lookup and signature inputs, then returns copied projection objects rather than mutating session state: `apps/editor/src/workspace/viewer/viewer-render-source.ts:135`, `apps/editor/src/workspace/viewer/viewer-render-source.ts:294`, `apps/editor/src/workspace/viewer/viewer-render-source.ts:305`.
- The focused test snapshots `session.graph` before Atlas Runtime projection and asserts equality afterward: `apps/editor/src/workspace/viewer/viewer-render-source.test.ts:67`, `apps/editor/src/workspace/viewer/viewer-render-source.test.ts:99`.

### Canvas remains original texture/original UV only

Pass.

- No Canvas source file was changed by Domain B. Viewer builds from Canvas projection, then remaps only the Viewer projection.
- Canvas projection after atlas commit is explicitly tested to keep original texture refs and UVs: `apps/editor/src/workspace/viewer/viewer-render-source.test.ts:102`, `apps/editor/src/workspace/viewer/viewer-render-source.test.ts:110`, `apps/editor/src/workspace/viewer/viewer-render-source.test.ts:114`.
- The Atlas Task screen test expectation was narrowed to Domain A artifact-only behavior: Apply preserves drawable texture ids and mesh UVs: `apps/editor/src/workspace/atlas/texture-atlas-task-screen.test.ts:316`, `apps/editor/src/workspace/atlas/texture-atlas-task-screen.test.ts:319`.
- No Canvas user-facing render-mode toggle was added.

### Missing or stale atlas disables Atlas Runtime with deterministic reason

Pass.

- Deterministic unavailable codes and short reasons are defined centrally: `apps/editor/src/workspace/viewer/viewer-render-source.ts:23`, `apps/editor/src/workspace/viewer/viewer-render-source.ts:79`.
- Missing layout/page/texture entry/binary ref/bytes, invalid dimensions, invalid byte length, missing source signature, stale source signature, invalid placement, and missing placement return deterministic unavailable results: `apps/editor/src/workspace/viewer/viewer-render-source.ts:135`, `apps/editor/src/workspace/viewer/viewer-render-source.ts:140`, `apps/editor/src/workspace/viewer/viewer-render-source.ts:145`, `apps/editor/src/workspace/viewer/viewer-render-source.ts:157`, `apps/editor/src/workspace/viewer/viewer-render-source.ts:167`, `apps/editor/src/workspace/viewer/viewer-render-source.ts:183`, `apps/editor/src/workspace/viewer/viewer-render-source.ts:196`, `apps/editor/src/workspace/viewer/viewer-render-source.ts:203`, `apps/editor/src/workspace/viewer/viewer-render-source.ts:218`, `apps/editor/src/workspace/viewer/viewer-render-source.ts:233`, `apps/editor/src/workspace/viewer/viewer-render-source.ts:267`.
- Tests cover missing atlas, stale source input, non-stale deformer/keyform/dynamics-only changes, and missing placement: `apps/editor/src/workspace/viewer/viewer-render-source.test.ts:118`, `apps/editor/src/workspace/viewer/viewer-render-source.test.ts:134`, `apps/editor/src/workspace/viewer/viewer-render-source.test.ts:159`, `apps/editor/src/workspace/viewer/viewer-render-source.test.ts:244`.

### Invalid selected Atlas Runtime falls back to Original

Pass.

- `createViewerRenderSourceProjection()` only returns `effectiveMode: "atlasRuntime"` when the requested mode is Atlas Runtime and availability is `available`; otherwise it returns `effectiveMode: "original"` with the original projection: `apps/editor/src/workspace/viewer/viewer-render-source.ts:101`, `apps/editor/src/workspace/viewer/viewer-render-source.ts:113`, `apps/editor/src/workspace/viewer/viewer-render-source.ts:124`.
- The Viewer screen state is synchronized back to the effective mode, so an invalid selected Atlas Runtime reverts the UI state to Original: `apps/editor/src/workspace/viewer/viewer-runtime-screen.tsx:206`, `apps/editor/src/workspace/viewer/viewer-runtime-screen.tsx:207`.
- The fallback is covered by route/projection tests: `apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts:292`, `apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts:298`, `apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts:299`.

### Forbidden scope

Pass.

- The Domain B diff is confined to Viewer source/tests, one Atlas Task test update, the new Viewer render-source helper/test, and the Domain B report. No `packages/render-core/**`, `render-webgl2`, shader, runtime-core atlas materialization, workspace export, or Canvas source changes were present in the reviewed Domain B change set.
- Targeted source search found no new Workspace Directory Export, File System Access, ZIP/archive export, Canvas atlas toggle, Cubism compatibility, or renderer/shader implementation in Domain B files. Search hits for `runtime-core`, playback, and Dynamics were pre-existing Viewer playback surfaces or tests, not Atlas Runtime materialization changes.
- The Domain B report accurately states the same forbidden-scope boundary: `discussion/implementation/waves/wave88/wave88-domain-b-viewer-original-atlas-runtime-mode-report.md:92`, `discussion/implementation/waves/wave88/wave88-domain-b-viewer-original-atlas-runtime-mode-report.md:93`, `discussion/implementation/waves/wave88/wave88-domain-b-viewer-original-atlas-runtime-mode-report.md:94`, `discussion/implementation/waves/wave88/wave88-domain-b-viewer-original-atlas-runtime-mode-report.md:96`.

## Verification Performed

- Static source review of all changed Domain B source files and tests listed above.
- Read Wave88 plan, current Viewer/Texture Atlas screen docs, Domain A report/reviews, Wave87 final baseline artifacts, and Domain B report.
- Reviewed Domain B git status/diff/stat for changed-file scope.
- Ran targeted `rg` searches for required behavior, stale/missing handling, Canvas preservation tests, UI placement, and forbidden-scope keywords.
- Did not rerun Vitest/typecheck in this review lane. I considered the orchestrator-provided validation as current evidence:
  - Focused Vitest escalated rerun passed: 5 files, 48 tests.
  - `pnpm.cmd typecheck`: passed.
  - `node scripts/check-source-organization.mjs`: passed.
  - `node scripts/check-dependencies.mjs`: passed.
  - `git diff --check`: exit 0 with CRLF working-copy warnings only.

## Residual Risks

- Evidence is projection/UI-level. No browser pixel screenshot or canvas-pixel oracle proves Atlas Runtime rendered pixels in a real browser.
- Atlas Runtime uses a strict missing-placement policy: any renderable projection drawable without a committed placement disables Atlas Runtime. This is deterministic and recorded in the Domain B report, but it may be a product-policy decision later.
- Old persisted atlas layout summaries without `sourceSignature` are treated as unavailable and require regeneration. No migration was added.
- The source signature is recomputed during Viewer projection creation. This is deterministic and spec-compliant, but could become a performance concern for larger projects.
- Design docs remain stale until Domain C updates them.

## User-Decision Points

- No blocking user decision is required for Domain B spec compliance.
- Decide later whether old atlas artifacts without `sourceSignature` should be migrated or always regenerated.
- Decide later whether strict missing-placement disablement is the long-term Viewer policy for renderable unplaced drawables.
- Domain C should update the stale Texture Atlas / Viewer design docs before Wave88 final closeout.
