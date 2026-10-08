# Wave88 Domain B Design / Development Compliance Review

Verdict: `pass`

Review lane: Design / Development Compliance Review
Target: `wave88-viewer-original-atlas-runtime-mode`
Reviewer: Review-Sylph
Date: 2026-06-20

## Basis Read

- `discussion/_conventions.md`
- `discussion/_map.md`
- `discussion/implementation/orchestration/wave88-plan.md`
- `discussion/development_convention/ux-backed-package-logic-authority.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/operation-policy.md`
- `discussion/development_convention/schema-and-id-conventions.md`
- `discussion/design/screen-design/screens/texture-atlas-task.md`
- `discussion/design/screen-design/screens/viewer-runtime-view.md`
- `discussion/implementation/waves/wave88/wave88-domain-a-artifact-only-atlas-apply-source-signature-report.md`
- `discussion/implementation/waves/wave88/wave88-domain-b-viewer-original-atlas-runtime-mode-report.md`
- Changed Domain B source/tests listed in the review assignment.

## Findings

No blocking findings.

No design/development compliance issue was found for Domain B. The implementation keeps atlas runtime rendering as a Viewer-only projection remap, reuses Domain A source-signature helpers, keeps Runtime Controls compact, and does not introduce package mutation, dependencies, renderer/WebGL changes, Workspace Directory Export, or Cubism compatibility claims.

## Compliance Assessment

### Domain Scope

Pass.

- Domain B source changes are under `apps/editor/src/workspace/viewer/**`, with one narrow atlas test update in `apps/editor/src/workspace/atlas/texture-atlas-task-screen.test.ts:286` to align the existing task test with Domain A artifact-only Apply semantics.
- No `apps/editor/src/workspace/canvas/**`, `packages/render-core/**`, or `packages/render-webgl2/**` source changes were present.
- The working tree also contains Domain A package changes, but Domain B depends on them through the exported source-signature helpers and does not expand the Domain B write boundary.

### Source File Responsibility

Pass.

- New render-source logic is isolated in `apps/editor/src/workspace/viewer/viewer-render-source.ts:15`, which owns Viewer render source mode, atlas availability, and projection remap.
- `apps/editor/src/workspace/viewer/viewer-clean-stage.ts:57` still builds the original Canvas projection first, then delegates render-source selection to the Viewer helper.
- `apps/editor/src/workspace/viewer/runtime-controls.tsx:188` adds a local `RenderSourceModeControl` inside the existing Runtime Controls UI responsibility.
- No `index.ts` implementation logic was added. `packages/authoring-core/src/index.ts:46` remains a barrel export for the Domain A helper.
- `node scripts/check-source-organization.mjs` passed.

### Domain A Helper Reuse

Pass.

- `apps/editor/src/workspace/viewer/viewer-render-source.ts:1` imports `createTextureAtlasSourceSignature`, `sameTextureAtlasSourceSignature`, and `selectTextureAtlasTargets` from `@private-2d-rigging-lab/authoring-core`.
- Current atlas freshness is recomputed through those helpers at `apps/editor/src/workspace/viewer/viewer-render-source.ts:210` and compared at `apps/editor/src/workspace/viewer/viewer-render-source.ts:217`.
- Viewer-local logic is limited to runtime availability, byte/dimension checks, placement validation, and projection remap. It does not duplicate the broad source-signature algorithm.

### Projection Immutability

Pass.

- Original mode remains the default through `apps/editor/src/workspace/viewer/viewer-clean-stage.ts:46` and `apps/editor/src/workspace/viewer/viewer-clean-stage.ts:67`.
- Atlas Runtime returns a new projection object in `apps/editor/src/workspace/viewer/viewer-render-source.ts:294`, maps drawable projections in `apps/editor/src/workspace/viewer/viewer-render-source.ts:300`, and creates remapped drawable/evaluated-mesh objects in `apps/editor/src/workspace/viewer/viewer-render-source.ts:305`.
- UV remap is computed from placement `uvRect` in `apps/editor/src/workspace/viewer/viewer-render-source.ts:331`.
- The focused test asserts `session.graph` is unchanged after Atlas Runtime projection in `apps/editor/src/workspace/viewer/viewer-render-source.test.ts:67`.

### Missing / Stale Policy

Pass.

- Missing layout, page, generated texture entry, binary ref, loaded bytes, invalid dimensions, invalid byte length, missing source signature, stale signature, invalid placement, and missing placement are deterministic unavailable codes in `apps/editor/src/workspace/viewer/viewer-render-source.ts:22`.
- Missing layout falls back to Original at `apps/editor/src/workspace/viewer/viewer-render-source.ts:136`; missing source signature is rejected at `apps/editor/src/workspace/viewer/viewer-render-source.ts:203`; stale source inputs are rejected at `apps/editor/src/workspace/viewer/viewer-render-source.ts:217`.
- Placement consistency is checked at `apps/editor/src/workspace/viewer/viewer-render-source.ts:224`, current packable target placement is required at `apps/editor/src/workspace/viewer/viewer-render-source.ts:240`, and renderable projection drawables without placement disable Atlas Runtime at `apps/editor/src/workspace/viewer/viewer-render-source.ts:261`.
- Strict missing-placement disablement is coherent for Wave88 because it avoids a mixed original/atlas render in a mode named `Atlas Runtime`. It does not need escalation now, but it remains a later product decision if partial fallback rendering is desired.

### Runtime Controls UI

Pass.

- `RuntimeControls` renders the mode control before parameter search at `apps/editor/src/workspace/viewer/runtime-controls.tsx:98`; parameter search starts at `apps/editor/src/workspace/viewer/runtime-controls.tsx:106`.
- The mode labels are `Original` and `Atlas Runtime` from `apps/editor/src/workspace/viewer/viewer-render-source.ts:17`.
- Unavailable Atlas Runtime is disabled with a short reason in `apps/editor/src/workspace/viewer/runtime-controls.tsx:226` and `apps/editor/src/workspace/viewer/runtime-controls.tsx:249`.
- The Viewer stage remains a clean work surface. Detailed atlas paths/details are kept in helper result details and are not shown as primary stage diagnostics.
- UI tests assert ordering and disabled reason in `apps/editor/src/workspace/viewer/runtime-controls-state.test.ts:325` and route-level rendering in `apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts:180`.

### Operation Policy

Pass.

- Domain B does not mutate package state or add a new package operation.
- Viewer state is local React state in `apps/editor/src/workspace/viewer/viewer-runtime-screen.tsx:102`; invalid Atlas Runtime selection is reconciled back to Original at `apps/editor/src/workspace/viewer/viewer-runtime-screen.tsx:206`.
- Texture Atlas Apply remains Operation Core-owned; the atlas task test now asserts original drawable texture ids and mesh UVs are preserved after the operation-backed Apply in `apps/editor/src/workspace/atlas/texture-atlas-task-screen.test.ts:316`.

### Dependency and Forbidden Scope

Pass.

- No `package.json` or `pnpm-lock.yaml` diff was present.
- `node scripts/check-dependencies.mjs` passed.
- No renderer shader/WebGL source, runtime-core materialization path, Workspace Directory Export, export/screenshot, camera, mesh generation, deformer/keyform/dynamics behavior, Cubism SDK/Core, or Cubism format support was added by Domain B.

### Design Docs Relationship

Pass for Domain B, with Domain C follow-up required.

- The current `texture-atlas-task.md` still contains pre-Wave88 destructive wording at `discussion/design/screen-design/screens/texture-atlas-task.md:227`, `discussion/design/screen-design/screens/texture-atlas-task.md:230`, and `discussion/design/screen-design/screens/texture-atlas-task.md:231`.
- The current `viewer-runtime-view.md` still says parameter search is the top Runtime Controls item at `discussion/design/screen-design/screens/viewer-runtime-view.md:161`.
- This is not a Domain B blocker because `discussion/implementation/orchestration/wave88-plan.md:484` assigns docs/maps/final closeout to Domain C, while `discussion/implementation/orchestration/wave88-plan.md:102` and `discussion/implementation/orchestration/wave88-plan.md:329` explicitly supersede the Viewer UI ordering for Wave88.

## Verification Performed

- Source/test review of all changed files listed in the assignment.
- `node scripts/check-source-organization.mjs`
  - Passed.
- `node scripts/check-dependencies.mjs`
  - Passed.
- `git diff --check`
  - Exit 0; CRLF working-copy warnings only.
- `git diff -- package.json pnpm-lock.yaml`
  - No output; no manifest or lockfile dependency diff.
- Reviewed orchestrator validation summary:
  - Focused Vitest escalated rerun passed: 5 files, 48 tests.
  - `pnpm.cmd typecheck` passed.
  - `node scripts/check-source-organization.mjs` passed.
  - `node scripts/check-dependencies.mjs` passed.
  - `git diff --check` passed with CRLF warnings only.

I did not rerun the escalated Vitest/typecheck commands in this review lane; the local independent checks above were limited to source/dependency/diff guards plus source inspection.

## Residual Risks

- Atlas Runtime recomputes the Domain A source signature during Viewer projection creation. This is deterministic and correct for Wave88, but may need caching if atlas/source assets become large.
- Old persisted atlas layouts without `sourceSignature` are unavailable and require regeneration. That is coherent with Domain A compatibility posture but still a product/migration decision.
- Strict missing-placement disablement is conservative. It prevents partial mixed-source rendering, but long-term UX may choose a different policy if users need partial atlas inspection.
- Screen design docs are intentionally still stale until Domain C updates them; final integration should not close Wave88 before that documentation correction.

## User-Decision Points

- Decide later whether old atlas artifacts without `sourceSignature` should be migrated or always regenerated.
- Decide later whether strict missing-placement disablement should remain the long-term Viewer behavior or become a partial fallback policy.
