# Wave87 Domain B Fix Loop 1 Test Adequacy Re-review

Date: 2026-06-19
Role: Review-Sylph
Verdict: pass

## Summary

No blocking test-adequacy findings.

The Fix Loop 1 tests now adequately prove the two previously risky behaviors:

- User-facing Texture Atlas Apply goes through Operation Core, not a direct UI/session call to the Domain A mutation.
- Generate Preview exposes actual generated atlas RGBA artwork data to the task preview, while placement overlays remain present.

Residual gaps remain around browser-level canvas pixel verification and one narrow UI-level failed-preview disabled assertion, but these are not blocking because source and lower-level operation tests provide the safety net.

## Basis Reviewed

Basis documents:

- `discussion/implementation/orchestration/wave87-plan.md`
- `discussion/design/screen-design/screens/texture-atlas-task.md`
- `discussion/implementation/waves/wave87/wave87-domain-a-atlas-core-schema-apply-mutation-report.md`
- `discussion/implementation/reviews/wave87/wave87-domain-a-test-adequacy-review.md`
- `discussion/implementation/waves/wave87/wave87-domain-b-texture-atlas-task-ui-routing-preview-report.md`
- `discussion/implementation/reviews/wave87/wave87-domain-b-test-adequacy-review.md`
- `discussion/implementation/waves/wave87/wave87-domain-b-fix-loop-1-operation-backed-apply-image-preview-report.md`

Source/tests inspected directly:

- `packages/operation-core/src/operations/apply-texture-atlas-preview.test.ts`
- `packages/operation-core/src/operations/apply-texture-atlas-preview.ts`
- `packages/operation-core/src/lifecycle/commit.ts`
- `packages/operation-core/src/lifecycle/dry-run.ts`
- `apps/editor/src/features/editor-session/model/texture-atlas-session-command.ts`
- `apps/editor/src/features/editor-session/editor-session-context.tsx`
- `apps/editor/src/workspace/atlas/atlas-task-projection.ts`
- `apps/editor/src/workspace/atlas/texture-atlas-task-screen.tsx`
- `apps/editor/src/workspace/atlas/texture-atlas-task-screen.test.ts`
- `packages/authoring-core/src/texture-atlas-mutations.test.ts`
- `packages/authoring-core/src/texture-atlas-binary.ts`
- Operation type/payload/registry/index files needed to verify public Operation Core wiring.

## Findings

### Blocking

None.

### Residual / Non-blocking

1. No Playwright or browser canvas pixel screenshot verifies that `putImageData()` paints pixels on a real canvas. The source paints `ImageData` in `AtlasPreviewImageLayer` (`texture-atlas-task-screen.tsx:242-255`), and tests prove generated RGBA bytes plus the canvas element/overlay markup (`texture-atlas-task-screen.test.ts:207-214`, `texture-atlas-task-screen.test.ts:278-281`). This is sufficient for Fix Loop 1, but final integration could add a browser pixel check.
2. UI tests do not contain a dedicated failed-preview disabled assertion. The projection/source guard only enables Apply for ready, non-stale previews (`atlas-task-projection.ts:150`; `texture-atlas-task-screen.tsx:77`, `texture-atlas-task-screen.tsx:137`), and Operation Core rejects failed preview recreation (`apply-texture-atlas-preview.test.ts:209-244`). A future focused test for `previewStatus === "failed"` and `canApply === false` would be useful but not blocking.
3. Provider-level history labeling is source-reviewed, not directly asserted by a provider test. The editor-session command helper proves operation-backed commit evidence (`texture-atlas-task-screen.test.ts:306-320`), while provider source records `Apply Texture Atlas` only after a committed result (`editor-session-context.tsx:790-824`). This is acceptable for this lane.

## Coverage Matrix

| Requirement | Assessment | Evidence |
|---|---|---|
| User-facing Apply uses Operation Core, not direct Domain A mutation | Adequate | `commitTextureAtlasPreview()` creates an `OperationRequestSchema` request and calls `createOperationCore().commitOperationAsync()` (`texture-atlas-session-command.ts:47-57`). The UI context calls that command helper (`editor-session-context.tsx:790-824`). The test asserts committed operation outcome, `applyTextureAtlasPreview` log entry, generated-by operation id, package revision, dirty state, and unchanged original session (`texture-atlas-task-screen.test.ts:306-320`). |
| Operation handler is registered and public lifecycle supports async | Adequate | Registry test asserts handler registration (`apply-texture-atlas-preview.test.ts:58-61`). OperationCore exposes async dry-run/commit (`operation-core.ts:21-23`, `operation-core.ts:37-52`). Lifecycle dispatches optional async handlers (`dry-run.ts:66-98`, `commit.ts:108-153`). |
| Sync lifecycle rejection | Adequate | Handler sync methods reject with `operation.applyTextureAtlasPreview.asyncLifecycleRequired` (`apply-texture-atlas-preview.ts:49-58`, `apply-texture-atlas-preview.ts:199`). Test asserts rejection, no log, no revision, no layout mutation (`apply-texture-atlas-preview.test.ts:63-77`). |
| Async commit covers generated texture/layout/binary metadata, drawable refs, mesh UVs, revisions, log/model diff | Adequate | Test asserts log/model diff evidence, no raw bytes in payload, package/authoring revision increment, generated texture entry and binary metadata, drawable refs, body/hidden UVs, topology revisions, and changed paths (`apply-texture-atlas-preview.test.ts:80-158`). Handler builds model diff for texture entry, layout summary, binary asset, drawable texture refs, mesh UVs, and topology revision (`apply-texture-atlas-preview.ts:283-328`). |
| Async dry-run is non-mutating | Adequate | Test asserts dry-run status/model diff while source session revisions, dirty flag, layout summary, texture refs, and operation log remain unchanged (`apply-texture-atlas-preview.test.ts:161-183`). |
| Stale layout rejection | Adequate | Handler compares recreated layout to expected layout and rejects mismatch (`apply-texture-atlas-preview.ts:135`). Test mutates the current session after request creation and asserts `layoutMismatch`, no log, no revision, no layout mutation (`apply-texture-atlas-preview.test.ts:186-207`). |
| Failed preview rejection | Adequate | Handler rejects recreated non-ready previews with `previewNotReady` and warning diagnostics (`apply-texture-atlas-preview.ts:116`). Test uses too-small settings and asserts `previewNotReady` plus `cannotFit`, no log, no revision, no layout mutation (`apply-texture-atlas-preview.test.ts:209-245`). |
| Generated preview image/artwork data exists after Generate Preview | Adequate | Projection creates preview page image from Domain A `createTextureAtlasPageRgbaBytes()` (`atlas-task-projection.ts:338-348`). Tests assert image dimensions/byte length and red/green source pixels at expected atlas locations (`texture-atlas-task-screen.test.ts:181-214`). Domain A binary source copies source texture pixels and edge extrusion into page RGBA bytes (`texture-atlas-binary.ts:20-58`, `texture-atlas-binary.ts:96-147`). |
| Rect overlays remain present over artwork | Adequate | Screen renders `AtlasPreviewImageLayer` before placement overlays (`texture-atlas-task-screen.tsx:225-233`). Static render test asserts both `atlas-preview-image` and `atlas-preview-placement` plus drawable labels (`texture-atlas-task-screen.test.ts:273-281`). |
| Route/toolbox/back behavior preserved | Adequate | Workspace data still has the Texture Atlas toolbox entry (`workspace-data.ts:46`), Atlas route renders the dedicated task and suppresses Parameter Bar (`authoring-workspace.tsx:49`, `authoring-workspace.tsx:91`), and tests cover route, Back, and toolbox activation (`texture-atlas-task-screen.test.ts:324-379`). |
| Counts/lists, hidden bound included, Drawable Pool excluded | Adequate | Projection summary/list mapping uses Domain A selection counts and maps `unboundDrawablePool` / `Currently hidden` labels (`atlas-task-projection.ts:152-154`, `atlas-task-projection.ts:254-264`). Tests assert included/excluded/warnings counts, hidden row, and pool exclusion (`texture-atlas-task-screen.test.ts:160-178`, `texture-atlas-task-screen.test.ts:324-339`). |
| Missing/stale/failed preview Apply guard | Adequate with residual | Missing preview renders Apply disabled (`texture-atlas-task-screen.test.ts:324-339`). Stale settings and target input changes set `canApply === false` and stale warning (`texture-atlas-task-screen.test.ts:217-251`). Failed preview rejection is covered at Operation Core (`apply-texture-atlas-preview.test.ts:209-244`) and source guard only enables ready previews (`atlas-task-projection.ts:150`). A UI-level failed-preview disabled test remains a residual improvement. |
| Generate Preview non-mutating | Adequate | The projection/preview tests generate preview state before apply, and the operation-backed command test confirms the original session still has no layout summary after commit because commit works on a clone (`texture-atlas-session-command.ts:45-57`; `texture-atlas-task-screen.test.ts:320`). Domain A preview generation is also covered by prior core tests that apply only through `applyTextureAtlasPreview()`. |
| Prior Domain A persistence/core behavior remains covered | Adequate | Authoring-core tests still cover hidden inclusion / pool exclusion, deterministic warnings, deterministic packing / cannot-fit, generated bytes / refs / UVs / topology preservation, portable bundle round-trip, and already-applied guard (`texture-atlas-mutations.test.ts:51-76`, `texture-atlas-mutations.test.ts:78-124`, `texture-atlas-mutations.test.ts:127-175`, `texture-atlas-mutations.test.ts:178-227`, `texture-atlas-mutations.test.ts:230-260`, `texture-atlas-mutations.test.ts:263-278`). |

## Validation Considered

I did not rerun validation commands in this re-review. I used the Orch-Sylph validation evidence and verified adequacy from source/tests directly.

Considered validation:

- Sandbox focused Vitest run failed with esbuild `spawn EPERM`.
- Escalated focused Vitest rerun passed: `pnpm.cmd exec vitest run packages/operation-core/src/operations/apply-texture-atlas-preview.test.ts apps/editor/src/workspace/atlas/texture-atlas-task-screen.test.ts packages/authoring-core/src/texture-atlas-mutations.test.ts` -> 3 files, 20 tests passed.
- `pnpm.cmd typecheck`: passed.
- `node scripts/check-source-organization.mjs`: passed.
- `node scripts/check-dependencies.mjs`: passed.
- `git diff --check`: passed with CRLF normalization warnings only.

## User-decision Points

No blocking user decision is required for this test-adequacy lane.

Non-blocking future decisions:

- Whether final integration should require Playwright/canvas pixel proof for the atlas preview artwork.
- Whether async Operation Core names `dryRunOperationAsync` / `commitOperationAsync` are the long-term API names.
- Whether large expected layout summaries in operation payloads are acceptable long term, or should later be replaced with a smaller preview identity.
- Whether Operation Core should formally depend on package-format instead of relying on the current narrow authoring-core schema re-export.
