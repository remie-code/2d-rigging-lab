# Wave82 Domain A Report: Parameter Scrub Performance v1 + Dynamics Inspector Follow-up

## Verdict

pass

Domain A source implementation, focused verification, and all three independent review lanes are complete with no findings.

## Basis Documents Used

- `discussion/implementation/orchestration/wave82-plan.md`
- `discussion/design/screen-design/components/dynamics-tool.md`
- `discussion/design/screen-design/screens/viewer-runtime-view.md`
- `discussion/implementation/waves/wave81/wave81-dynamics-time-progression-status.md`
- `discussion/implementation/waves/wave80/wave80-final-integration-report.md`
- `discussion/implementation/waves/wave81/wave81-final-integration-report.md`
- `discussion/implementation/reviews/wave80/wave80-final-clean-integration-review.md`
- `discussion/implementation/reviews/wave81/wave81-final-clean-integration-review.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/ux-backed-package-logic-authority.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/operation-policy.md`
- `discussion/development_convention/schema-and-id-conventions.md`

## Children Started And Waited

- Gnome implementation: `019eda63-674b-7cd3-8566-8f0acc0d7f75` / completed / waited.
- Spec Compliance Review: `019eda81-e5b6-7e33-a554-6604ccb6af48` / completed / waited.
- Design / Development Compliance Review: `019eda82-5d0e-70c1-9b86-64051aedd263` / completed / waited.
- Test Adequacy Review: `019eda82-dfe6-7d63-8dcf-cc595b393a7e` / completed / waited.

## Files Changed

Source and focused tests:

- `apps/editor/src/workspace/controls/raf-coalesced-number.ts`
- `apps/editor/src/workspace/panels/parameter-bar.tsx`
- `apps/editor/src/workspace/panels/parameter-bar.test.ts`
- `apps/editor/src/workspace/viewer/runtime-controls.tsx`
- `apps/editor/src/workspace/viewer/runtime-controls-state.ts`
- `apps/editor/src/workspace/viewer/runtime-controls-state.test.ts`
- `apps/editor/src/workspace/panels/dynamics-tool-inspector.tsx`
- `apps/editor/src/workspace/panels/dynamics-tool-inspector.test.ts`
- `apps/editor/src/features/editor-session/editor-session-context.tsx`
- `apps/editor/src/features/editor-session/editor-session-context-history.test.ts`
- `apps/editor/src/features/editor-session/model/dynamics-tool-state.ts`
- `apps/editor/src/features/editor-session/model/dynamics-tool-state.test.ts`
- `apps/editor/src/workspace/canvas/canvas-projection.ts`
- `apps/editor/src/workspace/canvas/canvas-evaluation.ts`
- `apps/editor/src/workspace/canvas/canvas-render-scene-adapter.ts`
- `packages/render-core/src/performance-instrumentation.ts`
- `packages/render-core/src/texture-signature.ts`
- `packages/render-core/src/render-scene.test.ts`
- `packages/render-core/src/index.ts`
- `packages/render-webgl2/src/webgl2-renderer.ts`
- `packages/render-webgl2/src/webgl2-textures.ts`

Report artifacts:

- `discussion/implementation/waves/wave82/wave82-domain-a-parameter-scrub-performance-v1-dynamics-inspector-followup-report.md`
- `discussion/implementation/waves/wave82/_map.md`
- `discussion/implementation/reviews/wave82/_map.md`
- `discussion/implementation/reviews/wave82/wave82-domain-a-spec-compliance-review.md`
- `discussion/implementation/reviews/wave82/wave82-domain-a-design-development-review.md`
- `discussion/implementation/reviews/wave82/wave82-domain-a-test-adequacy-review.md`

## Verification Performed

- Focused Vitest command initially failed in sandbox with known esbuild `spawn EPERM`.
- Approved rerun passed: 10 test files / 90 tests.
  - `apps/editor/src/workspace/panels/parameter-bar.test.ts`
  - `apps/editor/src/workspace/viewer/runtime-controls-state.test.ts`
  - `apps/editor/src/workspace/panels/dynamics-tool-inspector.test.ts`
  - `apps/editor/src/features/editor-session/model/dynamics-tool-state.test.ts`
  - `apps/editor/src/features/editor-session/editor-session-context-history.test.ts`
  - `apps/editor/src/workspace/canvas/canvas-projection.test.ts`
  - `apps/editor/src/workspace/canvas/canvas-evaluation.test.ts`
  - `apps/editor/src/workspace/canvas/canvas-render-scene-adapter.test.ts`
  - `packages/render-core/src/render-scene.test.ts`
  - `packages/render-webgl2/src/webgl2-renderer.test.ts`
- `pnpm.cmd typecheck`: pass.
- `node scripts/check-source-organization.mjs`: pass.
- `node scripts/check-dependencies.mjs`: pass.
- `git diff --check`: pass with CRLF normalization warnings only.

## Review Lane Verdicts And Fix Loops

- Spec Compliance Review: pass / findings none.
- Design / Development Compliance Review: pass / findings none.
- Test Adequacy Review: pass / findings none.
- Fix loops: none required after independent reviews.

## Performance Pipeline Trace

- Parameter Bar, Viewer Runtime Controls, and Dynamics preview sliders now use the shared `useRafCoalescedNumberCommit` helper in `apps/editor/src/workspace/controls/raf-coalesced-number.ts`.
- The helper records raw slider events, coalesced updates, and applied frame commits through disabled-by-default instrumentation.
- Canvas projection and evaluation are timed with render-core instrumentation calls in `canvas-projection.ts` and `canvas-evaluation.ts`.
- Render scene construction records texture source count in `canvas-render-scene-adapter.ts`.
- WebGL renderer instrumentation records mesh upload count, vertex/index upload sizes, and bufferData calls without changing the existing upload architecture.

## Input Coalescing Trace

- Authoring Parameter Bar thumb drag schedules slider movement through rAF and flushes on pointer up / pointer cancel.
- Runtime Controls range inputs schedule through rAF and flush on pointer up / pointer cancel / blur.
- Dynamics preview range inputs schedule through rAF and flush on pointer up / pointer cancel / blur.
- Numeric inputs remain immediate to preserve editing ergonomics.
- Latest pending value wins before frame commit.

## No-op Guard Trace

- `EditorSessionProvider.setActiveParameterValue` now clamps first and returns the same `parameterValues` object when the effective value is unchanged.
- `resetActiveParameterValue` also no-ops when the effective current value already equals the default.
- `setRuntimeParameterOverride`, row reset, and reset-all return the existing Viewer Runtime Controls state when there is no effective change.
- `setDynamicsToolPreviewDriverValue` no-ops on same clamped driver value while preserving reset semantics.
- Focused tests cover no-op behavior for Parameter Bar, Viewer Runtime Controls, Dynamics preview state, and provider history.

## Texture Signature Memoization Trace

- `packages/render-core/src/texture-signature.ts` now stores content signatures in a `WeakMap<Uint8Array, Map<string, string>>`.
- The cache key includes texture id, width, height, and byte length, while the `WeakMap` identity gates byte-array identity.
- Same byte-array identity avoids repeated hashing; changed byte-array identity recomputes.
- `clearRgba8TextureContentSignatureCache` exists for focused tests.
- Focused render-core tests cover cache hits, misses, bytes hashed counters, and changed identity recomputation.

## Instrumentation Trace

- Instrumentation lives in `packages/render-core/src/performance-instrumentation.ts`.
- It is disabled by default and only enabled by:
  - `globalThis.__LIVE2D_PERF__ === true`; or
  - `localStorage.live2dPerf === "1"`.
- When disabled, calls return without creating stats or logging.
- When enabled, counters/timings are accumulated in `globalThis.__LIVE2D_PERF_STATS__`.
- No visible UI, telemetry, network behavior, or default console output was added.

## Dynamics Inspector UX Trace

- `DynamicsToolInspector` now uses explicit modes:
  - `list`
  - `group`
  - `create`
  - `edit`
- Initial `list` state renders the Dynamics header, Groups list, and `New Group`.
- Initial `list` state does not render Settings, Inputs, Advanced, Pendulum, Outputs, Validation, Preview, Apply, or Delete.
- Group row opens an Existing Group Inspector with back, summary, Preview, Edit, and Delete.
- `New Group` opens the create form with Create / Cancel.
- `Edit` opens the edit form with Apply / Cancel.
- Cancel returns create -> list and edit -> group inspector without committing.
- Create/update/delete continue to use the existing operation-backed provider functions.

## Must-not Compliance Evidence

- No save/load schema or portable project format files changed.
- No operation payload/schema files changed.
- No package manifests or lockfiles changed.
- No `packages/runtime-core/**`, `packages/package-format/**`, `packages/operation-core/**`, `packages/authoring-core/**`, `packages/validator-core/**`, or `scripts/**` changes were made.
- No new dependencies were added.
- No dirty graph evaluation, React context split, persistent WebGL buffer / `bufferSubData`, mask caching, worker/offscreen rendering, mesh generation, deformer/keyform behavior, Viewer playback/time progression, or Dynamics continuous animation loop was implemented.

## Residual Risks

- Browser-level manual visual QA was not run; evidence is source review, SSR/component tests, model tests, render-core tests, root typecheck, and repository guards.
- Texture signature memoization relies on the Wave82 accepted assumption that texture byte arrays are immutable within a session. In-place byte mutation would require explicit invalidation in a future design.
- The implementation adds instrumentation hooks but does not claim a quantified before/after benchmark in this domain.

## User-decision Points

None identified for the implemented Domain A scope.
