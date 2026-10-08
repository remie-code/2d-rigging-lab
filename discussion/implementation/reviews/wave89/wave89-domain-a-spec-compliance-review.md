# Wave89 Domain A Spec Compliance Review

## Verdict

Verdict: `pass`.

I found no blocking spec-compliance findings for Domain A
`wave89-texture-atlas-task-apply-performance-fix`.

## Basis Read

- `discussion/_conventions.md`
- `discussion/_map.md`
- `discussion/implementation/orchestration/wave89-plan.md`
- `discussion/design/screen-design/screens/texture-atlas-task.md`
- `discussion/implementation/waves/wave87/wave87-final-integration-report.md`
- `discussion/implementation/waves/wave88/wave88-final-integration-report.md`
- `discussion/implementation/reviews/wave88/wave88-final-clean-integration-review.md`

## Scope Reviewed

Changed Domain A files reviewed directly:

- `apps/editor/src/workspace/atlas/atlas-task-projection.ts`
- `apps/editor/src/workspace/atlas/texture-atlas-task-screen.test.ts`
- `packages/authoring-core/src/texture-atlas-targets.ts`
- `packages/authoring-core/src/texture-atlas-mutations.ts`
- `packages/authoring-core/src/texture-atlas-mutations.test.ts`
- `packages/operation-core/src/operations/apply-texture-atlas-preview.ts`

Additional boundary files reviewed for Apply/UI wiring evidence:

- `apps/editor/src/workspace/atlas/texture-atlas-task-screen.tsx`
- `apps/editor/src/features/editor-session/model/texture-atlas-session-command.ts`
- `packages/operation-core/src/operations/apply-texture-atlas-preview.test.ts`
- `packages/authoring-core/src/texture-atlas-source-signature.ts`
- `packages/authoring-core/src/index.ts`

Worktree note: `apps/editor/src/workspace/viewer/viewer-render-source.ts` and
`apps/editor/src/workspace/viewer/viewer-render-source.test.ts` are dirty, but
they are Domain B viewer scope and were ignored for this Domain A verdict except
for confirming Domain A did not cross into them.

## Blocking Findings

None.

## Spec Compliance Assessment

### Settings Changes Are Metadata-Only For RGBA Atlas Image Generation

Pass.

`createTextureAtlasTaskProjection()` still computes target rows and stale state,
but it no longer calls full atlas RGBA generation. It reuses
`input.previewState?.previewPage ?? null` at
`apps/editor/src/workspace/atlas/atlas-task-projection.ts:140`. The only
projection-local call to `createTextureAtlasPageRgbaBytes()` is inside
`createPreviewPage()` at `apps/editor/src/workspace/atlas/atlas-task-projection.ts:327`
to `apps/editor/src/workspace/atlas/atlas-task-projection.ts:340`, and
`createPreviewPage()` is now called when creating preview state at
`apps/editor/src/workspace/atlas/atlas-task-projection.ts:182` to
`apps/editor/src/workspace/atlas/atlas-task-projection.ts:198`.

Settings changes keep the existing `previewState` in the screen and only update
settings/status at `apps/editor/src/workspace/atlas/texture-atlas-task-screen.tsx:152`
to `apps/editor/src/workspace/atlas/texture-atlas-task-screen.tsx:155`. The stale
calculation and Apply disablement are in
`apps/editor/src/workspace/atlas/atlas-task-projection.ts:130` to
`apps/editor/src/workspace/atlas/atlas-task-projection.ts:151`. The stale overlay
is rendered at `apps/editor/src/workspace/atlas/texture-atlas-task-screen.tsx:214`
to `apps/editor/src/workspace/atlas/texture-atlas-task-screen.tsx:220`.

Canvas repaint behavior is also consistent with the spec: the image layer
`putImageData()` effect depends on the cached `image` object at
`apps/editor/src/workspace/atlas/texture-atlas-task-screen.tsx:235` to
`apps/editor/src/workspace/atlas/texture-atlas-task-screen.tsx:247`. The focused
test asserts that re-rendering and stale settings reuse the same image object
and do not increment RGBA generation beyond the single Generate Preview call at
`apps/editor/src/workspace/atlas/texture-atlas-task-screen.test.ts:222` to
`apps/editor/src/workspace/atlas/texture-atlas-task-screen.test.ts:265`.

### Generate Preview Owns Heavy Preview Image Generation

Pass.

The screen calls `createTextureAtlasTaskPreviewState()` only from the Generate
Preview action at `apps/editor/src/workspace/atlas/texture-atlas-task-screen.tsx:65`
to `apps/editor/src/workspace/atlas/texture-atlas-task-screen.tsx:73`. That
preview-state creation is where the preview page and RGBA image bytes are
created. Targeted search found `createTextureAtlasPageRgbaBytes()` calls only in:

- `apps/editor/src/workspace/atlas/atlas-task-projection.ts:340`
- `packages/authoring-core/src/texture-atlas-mutations.ts:116`
- the Vitest spy in `apps/editor/src/workspace/atlas/texture-atlas-task-screen.test.ts:65`
  to `apps/editor/src/workspace/atlas/texture-atlas-task-screen.test.ts:70`

This matches the intended split: Generate Preview creates UI preview bytes, and
Apply generates committed artifact bytes through authoring/operation code.

### Stale Preview Is Not Apply-able As Fresh

Pass.

The UI sets `canApply` to false whenever the preview signature is stale at
`apps/editor/src/workspace/atlas/atlas-task-projection.ts:130` to
`apps/editor/src/workspace/atlas/atlas-task-projection.ts:151`, and the button is
disabled from that projection at
`apps/editor/src/workspace/atlas/texture-atlas-task-screen.tsx:135` to
`apps/editor/src/workspace/atlas/texture-atlas-task-screen.tsx:142`.

Operation Core independently recreates the preview from the current session and
request settings at `packages/operation-core/src/operations/apply-texture-atlas-preview.ts:100`
to `packages/operation-core/src/operations/apply-texture-atlas-preview.ts:108`,
then rejects layout/source mismatch before mutation at
`packages/operation-core/src/operations/apply-texture-atlas-preview.ts:129` to
`packages/operation-core/src/operations/apply-texture-atlas-preview.ts:148`.
Existing operation tests cover stale expected layout rejection without mutation
at `packages/operation-core/src/operations/apply-texture-atlas-preview.test.ts:225`
to `packages/operation-core/src/operations/apply-texture-atlas-preview.test.ts:246`.

The direct authoring-core mutation still keeps its own stale guard unless the
caller supplies the new validated-current-session fast path. The direct stale
source-byte test is at `packages/authoring-core/src/texture-atlas-mutations.test.ts:343`
to `packages/authoring-core/src/texture-atlas-mutations.test.ts:374`.

### Apply Remains Operation Core-Backed And Artifact-Only

Pass.

The editor-session command still clones the session, builds an
`applyTextureAtlasPreview` Operation Core request, and calls
`commitOperationAsync()` at
`apps/editor/src/features/editor-session/model/texture-atlas-session-command.ts:46`
to `apps/editor/src/features/editor-session/model/texture-atlas-session-command.ts:58`.

The authoring mutation commits generated atlas artifact state, generated binary
bytes, provenance, rights, and layout summary at
`packages/authoring-core/src/texture-atlas-mutations.ts:145` to
`packages/authoring-core/src/texture-atlas-mutations.ts:181`. It returns empty
drawable and mesh UV change arrays and does not rewrite authoring drawable
texture refs or mesh UVs at `packages/authoring-core/src/texture-atlas-mutations.ts:183`
to `packages/authoring-core/src/texture-atlas-mutations.ts:195`.

Operation tests assert artifact-only model diff paths, preserved drawable
texture refs, and preserved meshes at
`packages/operation-core/src/operations/apply-texture-atlas-preview.test.ts:79`
to `packages/operation-core/src/operations/apply-texture-atlas-preview.test.ts:151`.

### Apply Duplicate-Work Optimization Keeps Guards Sound

Pass.

The source texture byte clone in target selection was removed:
`packages/authoring-core/src/texture-atlas-targets.ts:402` to
`packages/authoring-core/src/texture-atlas-targets.ts:407` now keeps the existing
`binaryEntry.bytes` reference. The test confirms packable target bytes are the
same object as the session binary bytes at
`packages/authoring-core/src/texture-atlas-mutations.test.ts:79` to
`packages/authoring-core/src/texture-atlas-mutations.test.ts:85`.

Operation Core reduces duplicate stale guard work by passing
`freshnessValidation` only after recreating the current preview and proving the
layout summary matches the request:
`packages/operation-core/src/operations/apply-texture-atlas-preview.ts:129` to
`packages/operation-core/src/operations/apply-texture-atlas-preview.ts:164`. The
authoring-core fast path only skips its guard when the validated layout summary
matches the preview layout summary, ignoring only `generatedByOperationId`, at
`packages/authoring-core/src/texture-atlas-mutations.ts:203` to
`packages/authoring-core/src/texture-atlas-mutations.ts:288`.

Apply still generates committed atlas bytes once at
`packages/authoring-core/src/texture-atlas-mutations.ts:116`, then uses the same
`atlasBytes` object for digesting, binary registration, and result return at
`packages/authoring-core/src/texture-atlas-mutations.ts:121` to
`packages/authoring-core/src/texture-atlas-mutations.ts:195`. The operation
payload tests continue to assert no `textureBytes` or `atlasBytes` are logged.

### Forbidden Scope

Pass.

Targeted searches in the Domain A atlas/authoring/operation paths found no
workerization, workspace export, File System Access, zip/export feature,
multi-page atlas implementation, manual atlas editing, camera work, Cubism
compatibility work, Viewer file imports, or destructive authoring
`drawable.textureId` / `mesh.uvs` rewrite.

No package manifest or lockfile diff appears in the Domain A change set.

## Verification Performed

- Read the listed basis documents and discussion entry points.
- Reviewed direct diffs for all assigned Domain A files.
- Reviewed the full changed Domain A source/test files with line numbers.
- Reviewed Atlas screen wiring, editor-session Operation Core command boundary,
  Operation Core stale-layout tests, and source signature implementation.
- Ran `rg` searches for `createTextureAtlasPageRgbaBytes()`, forbidden scope
  terms, destructive texture/UV writes, source byte clones, and
  `freshnessValidation` usages.
- Ran `git diff --check --` over the six assigned changed Domain A files. Result:
  exit 0, with CRLF working-copy warnings only.
- Ran focused Vitest:
  `pnpm.cmd exec vitest run apps/editor/src/workspace/atlas/texture-atlas-task-screen.test.ts packages/authoring-core/src/texture-atlas-mutations.test.ts packages/operation-core/src/operations/apply-texture-atlas-preview.test.ts`.
  The sandbox run failed with the known esbuild `spawn EPERM`; escalated rerun
  passed 3 files / 23 tests.

## Residual Risks

- `createTextureAtlasTaskProjection()` still performs target selection and a
  lightweight task signature on projection so the target summary and stale state
  stay current. This review treats that as acceptable because the Wave89
  blocking performance issue was full RGBA atlas image generation and canvas
  repaint on settings projection, which is removed.
- Operation Core still recreates the preview during Apply. This preserves the
  Operation Core stale guard and avoids passing UI RGBA bytes through the
  operation payload, but it means Apply still pays packing/source-signature cost
  once before artifact byte generation.
- `freshnessValidation` is exported with authoring-core because
  `texture-atlas-mutations.ts` is barrel-exported. Current in-repo use is only
  Operation Core after current-session preview recreation and layout comparison.
  Future direct callers should not use that fast path unless they have performed
  equivalent validation.
- No browser pixel or Playwright check proves the canvas layer avoids repaint in
  a real browser. Source dependency and object-identity tests cover the intended
  behavior for this review lane.
- I did not run full `pnpm typecheck`; the focused atlas/operation tests passed.

## User-Decision Points

None for Domain A in this review.
