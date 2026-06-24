# Wave100 Domain A Design / Development Compliance Review

## Verdict

Verdict: `pass`.

No blocking design, module-boundary, source organization, dependency, or operation-policy findings were found. Domain A stays inside the Viewer scope, keeps Viewer Variant switching session-local, applies the Variant predicate before render-source remap, and does not change dependency manifests, lockfiles, Runtime Player, package format, Operation Core, Runtime Export, Workspace Save, or Texture Atlas stale/source policy.

## Basis Reviewed

- `discussion/implementation/orchestration/wave100-plan.md`
- `discussion/design/screen-design/screens/viewer-runtime-view.md`
- `discussion/design/screen-design/screens/variant-expression-manager.md`
- `discussion/design/screen-design/_map.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/operation-policy.md`
- `discussion/implementation/waves/wave99/wave99-final-integration-report.md`
- `discussion/implementation/reviews/wave99/wave99-final-clean-integration-review.md`
- `discussion/implementation/waves/wave100/wave100-domain-a-viewer-variant-switching-integration-report.md`

## Scope Reviewed

Implementation and test files inspected directly:

- `apps/editor/src/workspace/viewer/viewer-variant-selection.ts`
- `apps/editor/src/workspace/viewer/viewer-variant-selection.test.ts`
- `apps/editor/src/workspace/viewer/viewer-runtime-screen.tsx`
- `apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts`
- `apps/editor/src/workspace/viewer/viewer-clean-stage.ts`
- `apps/editor/src/workspace/viewer/viewer-render-source.ts`
- `apps/editor/src/workspace/viewer/viewer-render-source.test.ts`
- `apps/editor/src/workspace/viewer/viewer-atlas-runtime-source-cache.ts`
- `apps/editor/src/workspace/viewer/runtime-controls.tsx`
- `apps/editor/src/workspace/viewer/runtime-controls-state.ts`
- `apps/editor/src/workspace/viewer/runtime-controls-state.test.ts`
- `apps/editor/src/features/variants/model/variant-preview-state.ts`

Working tree scope observed:

- `git diff --name-status` showed modified Viewer files only.
- `git status --short -uall -- apps/editor/src/workspace/viewer` additionally showed new untracked `viewer-variant-selection.ts` and `viewer-variant-selection.test.ts`; both are inside Domain A allowed scope.
- Forbidden/dependency status check returned no output for package manifests, lockfile, Runtime Player, package-format, authoring-core, operation-core, runtime-core, render-core, or render-webgl2 paths.

## Findings

Blocking findings: none.

Non-blocking findings: none.

## Rubric Results

| Rubric item | Result | Evidence |
|---|---|---|
| Viewer-local state is owned by Viewer, not Variant Manager provider preview state | `pass` | `ViewerRuntimeScreen` owns `viewerVariantActiveSelections` with local React state at `apps/editor/src/workspace/viewer/viewer-runtime-screen.tsx:125-129` and updates/resets it at `viewer-runtime-screen.tsx:164-198`. It reuses pure reconciliation helpers via `viewer-variant-selection.ts:6-10`; it does not consume editor-session provider preview state. |
| `VariantManagerScreen` is not imported into Viewer | `pass` | Targeted `rg` over `apps/editor/src/workspace/viewer` found no `VariantManagerScreen` match. Viewer imports are helper/model/runtime imports only. |
| Predicate insertion happens before render source remap | `pass` | `createCanvasRenderProjection` receives `variantVisibilityPredicate` before `createViewerRenderSourceProjection` at `viewer-runtime-screen.tsx:439-449`; the shared clean-stage path does the same at `viewer-clean-stage.ts:61-75`. `Atlas Runtime` remaps `input.originalProjection` after availability resolution at `viewer-render-source.ts:163-169`. |
| Atlas cache/source resolution does not include Variant selection unnecessarily | `pass` | `createViewerAtlasRuntimeSourceCacheKey` is based on package identity/revisions, atlas data, and source graph at `viewer-atlas-runtime-source-cache.ts:32-44`; source graph details cover rig bindings, draw order, stable order, bound sources, meshes, texture entries, and bytes at `viewer-atlas-runtime-source-cache.ts:111-190`. No Viewer active selection is part of the cache key or stale source signature path. |
| Runtime Controls state does not become a broad catch-all file | `pass` | `runtime-controls-state.ts` still contains parameter override/search state only at `runtime-controls-state.ts:19-22`. Variant inputs are explicit `RuntimeControls` props at `runtime-controls.tsx:45-59`; only collapsed UI state is local to the component at `runtime-controls.tsx:78`. |
| Source organization policy is respected; new files have clear responsibility | `pass` | `viewer-variant-selection.ts` is a Viewer-scoped adapter for active-selection initialization/reconciliation/toggle/summary helpers. No broad `utils.ts`, `helpers.ts`, `types.ts`, or `index.ts` growth was introduced. `node scripts/check-source-organization.mjs` passed. |
| Operation policy is respected by avoiding Project mutation for session-only Viewer preview | `pass` | Viewer callbacks update local state only (`viewer-runtime-screen.tsx:179-198`) and pass that state into the projection/UI (`viewer-runtime-screen.tsx:215-225`, `viewer-runtime-screen.tsx:371-383`). The interactive test asserts unchanged `session.graph.variantGroups`, `dirty === false`, and no `saveProject` call at `viewer-runtime-screen.test.ts:892-938`. |
| No new dependencies or lockfile changes | `pass` | Forbidden/dependency status check returned no manifest or lockfile changes; `node scripts/check-dependencies.mjs` passed. |
| No forbidden-scope changes | `pass` | Targeted status check returned no changes under `apps/runtime-player/src`, package-format, authoring-core, operation-core, runtime-core, render-core, or render-webgl2. Viewer search found no Runtime Player, Runtime Export, Workspace Save, Portable JSON, or Texture Atlas stale-policy implementation changes in Domain A. |
| No broad catch-all or forbidden helper file | `pass` | The new helper is narrowly named `viewer-variant-selection.ts` and Viewer-owned. Existing `runtime-controls-state.ts` remains focused. |

## Verification Performed

Commands run:

| Command | Result |
|---|---|
| `git --no-optional-locks diff --name-status` | Only Viewer modified files listed; untracked files require `git status -uall` to see. |
| `git --no-optional-locks diff -- apps/editor/src/workspace/viewer` | Reviewed Viewer implementation/test diff directly. |
| `git --no-optional-locks status --short -uall -- apps/editor/src/workspace/viewer discussion/implementation/reviews/wave100` | Found six modified Viewer files and two new untracked Viewer helper/test files before this review artifact was written. |
| `git --no-optional-locks status --short -uall -- package.json pnpm-lock.yaml pnpm-workspace.yaml apps/*/package.json packages/*/package.json apps/runtime-player/src packages/package-format/src packages/authoring-core/src packages/operation-core/src packages/runtime-core/src packages/render-core/src packages/render-webgl2/src` | No output. |
| `rg -n "VariantManagerScreen|variantPreviewActiveSelections|setVariantDefault|runtimeVisibility|Workspace Save|Portable JSON|runtime-player|Runtime Export" apps/editor/src/workspace/viewer apps/editor/src/features/variants/model` | No Viewer import of Variant Manager UI, provider preview state, persistence/export hooks, or Runtime Player code. Matches were existing model command/test names or `runtimeVisibility` fixture fields. |
| `git --no-optional-locks diff --check -- apps/editor/src/workspace/viewer` | Pass; LF-to-CRLF working-copy warnings only. |
| `node scripts/check-source-organization.mjs` | Pass: `Source organization guard passed.` |
| `node scripts/check-dependencies.mjs` | Pass: `Dependency guard passed.` |
| `pnpm.cmd exec vitest run apps/editor/src/workspace/viewer` | Pass: 5 files / 64 tests. |
| `pnpm.cmd exec vitest run apps/editor/src/workspace/canvas/canvas-variant-visibility.test.ts packages/authoring-core/src/variant-evaluation.test.ts` | Pass: 2 files / 9 tests. |
| `pnpm.cmd typecheck` | Pass. |

## Residual Risks

- Runtime Controls Variant UI is covered by SSR/fake-DOM and focused projection tests, not browser visual screenshot verification.
- Full repository test suite was not run in this review lane.
- New `viewer-variant-selection.ts` and `viewer-variant-selection.test.ts` are currently untracked in the working tree. This is not a compliance blocker because they are inside Domain A allowed scope, but final integration should ensure they are included in the intended patch.

## User-Decision Points

None.
