# Wave89 Final Integration Report: Texture Atlas Performance + Viewer Runtime Scope Fix

## Verdict

Verdict: `pass`.

Wave89 can be reported complete. Domain A and Domain B both returned `pass`, their source write scopes did not collide, and the integrated repository state satisfies the Wave89 plan for Texture Atlas Task settings performance, Apply Atlas computation boundaries, Viewer Original-mode performance guard, and Viewer Atlas Runtime drawable scope.

## Basis Reviewed

- `discussion/implementation/orchestration/wave89-plan.md`
- `discussion/implementation/orchestration/_map.md`
- `C:/Users/remie/.codex/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/operation-policy.md`
- `discussion/design/screen-design/screens/texture-atlas-task.md`
- `discussion/design/screen-design/screens/viewer-runtime-view.md`
- Domain A/B reports and all six Domain A/B review artifacts under `discussion/implementation/waves/wave89/` and `discussion/implementation/reviews/wave89/`.

## Integrated Scope

Domain A source/test changes:

- `apps/editor/src/workspace/atlas/atlas-task-projection.ts`
- `apps/editor/src/workspace/atlas/texture-atlas-task-screen.test.ts`
- `packages/authoring-core/src/texture-atlas-targets.ts`
- `packages/authoring-core/src/texture-atlas-mutations.ts`
- `packages/authoring-core/src/texture-atlas-mutations.test.ts`
- `packages/operation-core/src/operations/apply-texture-atlas-preview.ts`

Domain B source/test changes:

- `apps/editor/src/workspace/viewer/viewer-render-source.ts`
- `apps/editor/src/workspace/viewer/viewer-render-source.test.ts`

No improper collision was found. Domain A stayed in Atlas Task / authoring-core / operation-core. Domain B stayed in Viewer render-source files and consumed the shared target-selection oracle rather than modifying Atlas or Apply code.

## Acceptance Confirmation

### Texture Atlas Task Settings Performance

Pass.

`createTextureAtlasTaskProjection()` now reuses `input.previewState?.previewPage ?? null` instead of creating a new preview page during every projection. The only task-preview call to `createTextureAtlasPageRgbaBytes()` remains inside `createPreviewPage()`, which is invoked by `createTextureAtlasTaskPreviewState()` when Generate Preview runs.

Stale settings retain the old preview page/image, add the stale warning, and set `canApply` false. The screen still gates Apply on `projection.canApply`, and the canvas `putImageData()` effect depends on the cached image object.

### Generate Preview Responsibility

Pass.

Generate Preview remains the action that creates target selection, packing, source signature, and task-preview RGBA bytes. Reprojection, settings changes, and stale target changes do not regenerate full RGBA preview bytes in the focused test.

### Apply Atlas Boundary And Duplicate Work

Pass.

Apply remains Operation Core-backed. The editor-session command path still commits `applyTextureAtlasPreview` through Operation Core. Operation Core recreates the current preview from the current session, compares the recreated layout against the expected layout, and only then supplies `freshnessValidation` to authoring-core.

Authoring-core keeps direct-call stale guards when that validated-current-session token is absent. Apply remains artifact-only: generated atlas texture metadata, layout summary, provenance/rights, and session binary bytes are committed, while authoring `Drawable.textureId`, mesh UVs, and topology remain unchanged.

Avoidable duplicate work is reduced by:

- keeping source `textureBytes` as the session binary entry reference in target selection instead of cloning;
- skipping the duplicate authoring-core target/signature freshness guard only after Operation Core has already validated the current recreated layout;
- returning generated `atlasBytes` without an extra result-copy allocation.

### Viewer Original Mode

Pass.

`createViewerRenderSourceProjection()` no longer performs atlas target selection, source-signature creation, or source-signature comparison for requested `Original` mode. The Original path returns the original projection and uses only static atlas artifact checks for the availability state.

Original behavior remains otherwise unchanged: original texture refs / UVs are used, and unbound Drawable Pool drawables can still render in Original mode.

### Viewer Atlas Runtime Scope

Pass.

Requested `Atlas Runtime` now validates and renders only current `selectTextureAtlasTargets(...).packableTargets`. Runtime drawable ids are built from that packable runtime set. The Viewer remap filters drawables, selected drawable ids, mask relations, mesh overlays, and deformer child drawable ids to the runtime drawable set.

Drawable Pool / unbound drawables no longer render in Atlas Runtime and do not disable it. A runtime-bound drawable with a missing placement still returns deterministic `missingPlacement` and falls back to Original.

### Forbidden Scope

Pass.

No forbidden Wave89 scope was found in the integrated diff:

- no workerization;
- no Workspace Directory Export / File System Access / archive export;
- no new dependencies or package manifest/lockfile changes;
- no manual atlas editor, multi-page atlas, Canvas atlas mode, camera capture, screenshot/export workflow, Cubism compatibility, or SDK/Core integration;
- no mesh generation, deformer, keyform, dynamics, or renderer/shader rewrite;
- no destructive Apply rewrite of authoring drawable textures or mesh UVs.

## Verification

Fresh final-integration checks:

- `git status --short -uall`: inspected dirty/untracked scope.
- `git diff --stat -- <Wave89 source files>`: inspected combined source change shape.
- `git diff --name-only -- <Wave89 source/docs paths>`: confirmed changed source scope.
- `git diff -- package.json pnpm-lock.yaml`: no dependency diff.
- `git diff --check -- <Wave89 tracked source/map files>`: passed; LF/CRLF working-copy warnings only.
- `pnpm.cmd exec vitest run apps/editor/src/workspace/atlas/texture-atlas-task-screen.test.ts packages/authoring-core/src/texture-atlas-mutations.test.ts packages/operation-core/src/operations/apply-texture-atlas-preview.test.ts apps/editor/src/workspace/viewer/viewer-render-source.test.ts apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts apps/editor/src/workspace/viewer/runtime-controls-state.test.ts`
  - sandbox run failed with known Vite/esbuild `spawn EPERM`;
  - escalated rerun passed: 6 files / 63 tests.
- `pnpm.cmd typecheck`: passed.
- `node scripts/check-source-organization.mjs`: passed.
- `node scripts/check-dependencies.mjs`: passed.

Domain evidence accepted and cross-checked from source:

- Domain A focused verification passed: Atlas task, authoring-core mutation, and operation-core Apply tests; typecheck; source/dependency guards; diff check.
- Domain B focused verification passed: Viewer render-source, runtime screen, runtime controls tests; typecheck; source/dependency guards; diff check.

## Reports And Maps

Final artifacts:

- `discussion/implementation/waves/wave89/wave89-final-integration-report.md`
- `discussion/implementation/reviews/wave89/wave89-final-clean-integration-review.md`
- `discussion/implementation/waves/wave89/_map.md`
- `discussion/implementation/reviews/wave89/_map.md`

The broader `discussion/implementation/orchestration/_map.md` was reviewed as a basis document. It is outside this delegated final-review write scope, so this report does not update it.

## Residual Risks

- Texture Atlas Task stale projection still performs target selection and a lightweight task signature so the target summary and stale state stay current. The removed blocking work is full RGBA preview generation and canvas image replacement during settings/stale projection.
- The task-local stale signature uses sampled byte summarization for UI responsiveness. Operation Core remains the authoritative full source-signature guard before Apply.
- `TextureAtlasPreviewFreshnessValidation` is exported through authoring-core. Current production usage is only Operation Core after current-session preview recreation and layout comparison; future callers should not use it without equivalent validation.
- Viewer Original mode intentionally performs static atlas artifact availability checks only. Stale source-signature and runtime-bound missing-placement validation occur when Atlas Runtime is requested.
- Browser pixel proof was not run; Wave89 explicitly treats it as out of scope.

## User-Decision Points

None blocking.
