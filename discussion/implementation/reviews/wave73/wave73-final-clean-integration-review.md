# Wave73 Final Clean Integration Review

- Verdict: `pass`
- Date: 2026-06-15
- Reviewer: Review-Sylph
- Target: Wave73 `save-load-restoration-rotation-translation`
- Domain: C, final integration / clean review / map closeout gate

## Basis Reviewed

- `discussion/implementation/orchestration/wave73-plan.md`
- `discussion/implementation/waves/wave73/wave73-final-integration-report.md`
- `discussion/implementation/waves/wave73/_map.md`
- `discussion/implementation/reviews/wave73/_map.md`
- Domain A report plus Spec, Design / Development, and Test Adequacy reviews.
- Domain B report plus Spec, Design / Development, and Test Adequacy reviews.
- `discussion/development_convention/ux-backed-package-logic-authority.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/operation-policy.md`
- `discussion/development_convention/schema-and-id-conventions.md`
- `discussion/implementation/_map.md`
- `discussion/implementation/orchestration/_map.md`
- Current worktree status, diff summary, changed source, and changed tests in the Wave73 source/test areas.

## Artifact Gate Check

- Domain A implementation report exists and records `done`.
- Domain A Spec Compliance, Design / Development Compliance, and Test Adequacy reviews exist and record `pass`.
- Domain B implementation report exists and records `done`.
- Domain B Spec Compliance, Design / Development Compliance, and Test Adequacy reviews exist and record `pass`.
- Final integration report exists at `discussion/implementation/waves/wave73/wave73-final-integration-report.md` and explicitly keeps the final clean review pending.
- Wave73 implementation and review maps record the final clean review as pending/reserved rather than marking Wave73 complete before this review.

## Source / Test / Artifact Review Summary

Reviewed source and tests directly, not only the final report prose.

### Save / Load Restoration

- Parts Container visibility is serialized through the existing package editor-state model file, not a new save format. `packages/authoring-core/src/package-document-editor-state.ts:10` defines `model/editor-state.json`, and `packages/authoring-core/src/package-document-editor-state.ts:24` writes only `selection`, `lockedIds`, and normalized `editorHiddenIds`.
- Stale, duplicate, and invalid hidden Part IDs are filtered against current session Part IDs and returned in graph order at `packages/authoring-core/src/package-document-editor-state.ts:43` and `packages/authoring-core/src/package-document-editor-state.ts:52`.
- Editor save forwards current `editorHiddenPartIds` through the portable bundle path at `apps/editor/src/features/editor-session/editor-session-context.tsx:534` and `apps/editor/src/features/project-storage/model/editor-project-storage.ts:72`.
- Editor load restores imported hidden IDs while clearing editor-local transient state and regenerating collapsed state at `apps/editor/src/features/editor-session/editor-session-context.tsx:451`, `apps/editor/src/features/editor-session/editor-session-context.tsx:458`, and `apps/editor/src/features/editor-session/editor-session-context.tsx:567`.
- Portable bundle tests assert editor-state export/import, stale-ID filtering, model graph, drawable visibility/default opacity, draw order, mesh vertices/UVs/triangles/provenance, texture bytes, Warp and Rotation rig controls, parameters, keyforms, nonzero `restTranslation`, and keyed `translation` at `packages/authoring-core/src/portable-project-bundle.test.ts:49`, `packages/authoring-core/src/portable-project-bundle.test.ts:87`, `packages/authoring-core/src/portable-project-bundle.test.ts:157`, and `packages/authoring-core/src/portable-project-bundle.test.ts:200`.
- Provider and Playwright coverage distinguish persisted hidden Part IDs from non-persisted editor-local state. See `apps/editor/src/features/editor-session/editor-session-context-history.test.ts:283` and `apps/editor/e2e/portable-project-save-load.e2e.spec.ts:67`.

### Parts Tree Collapse Policy

- `apps/editor/src/features/editor-session/model/part-tree-collapse-state.ts:8` initializes non-root Part Containers with children as collapsed, and `apps/editor/src/features/editor-session/model/part-tree-collapse-state.ts:27` merges defaults only for newly added Parts while preserving session-local manual collapse state.
- Load regenerates collapsed IDs from the loaded session rather than importing persisted collapsed state at `apps/editor/src/features/editor-session/editor-session-context.tsx:466`.
- Tests prove non-root collapse, deterministic focused-path expansion, and manual session-state preservation at `apps/editor/src/features/editor-session/model/part-tree-collapse-state.test.ts:28`.

### Rotation Rest / Keyed Translation

- Operation Core exposes `restTranslation` on `UpdateRigControlPayloadSchema` without exposing `restScale` at `packages/operation-core/src/payloads/rig-control.ts:91`.
- `updateRigControl` forwards `restTranslation`, emits `/restTranslation` diffs, and maps invalid finite-value diagnostics at `packages/operation-core/src/operations/update-rig-control.ts:87`, `packages/operation-core/src/operations/update-rig-control.ts:169`, and `packages/operation-core/src/operations/update-rig-control.ts:265`.
- Authoring Core restricts pivot/rest angle/rest translation fields to `rotation2d`, validates finite Vec2 values, and updates a cloned preview control before assignment at `packages/authoring-core/src/rig-control-mutations.ts:581`, `packages/authoring-core/src/rig-control-mutations.ts:623`, and `packages/authoring-core/src/rig-control-mutations.ts:834`.
- Keyed `translation` is accepted only for `rotation2d` and finite Vec2 patches at `packages/authoring-core/src/linear-keyform-editing.ts:396` and `packages/authoring-core/src/linear-keyform-editing.ts:488`.
- Runtime and Canvas evaluation choose preview/keyed/rest translation and apply rotation around pivot before parallel translation at `apps/editor/src/workspace/canvas/canvas-evaluation.ts:429` and `apps/editor/src/workspace/canvas/canvas-evaluation.ts:746`.

### Inspector, Parameter Binding, And Canvas

- Inspector exposes Rest translation X/Y near pivot/rest angle and emits `restTranslation` only when changed at `apps/editor/src/workspace/panels/rig-tool-inspector.tsx:760`, `apps/editor/src/workspace/panels/rig-tool-inspector.tsx:791`, and `apps/editor/src/workspace/panels/rig-tool-inspector.tsx:976`.
- Parameter Binding includes Rotation `translation` as a Vec2 binding and only enables value editing at exact current keyforms at `apps/editor/src/features/editor-session/model/parameter-keyform-state.ts:264`, `apps/editor/src/features/editor-session/model/parameter-keyform-state.ts:326`, and `apps/editor/src/features/editor-session/model/parameter-keyform-state.ts:618`.
- Canvas handles include a distinct `translation` kind and hit-test path at `apps/editor/src/workspace/canvas/rotation-deformer-handles.ts:8` and `apps/editor/src/workspace/canvas/rotation-deformer-handles.ts:125`.
- Canvas interaction previews translation on pointer move, clears preview on finish/cancel, commits one gesture through the existing gesture controller, routes rest vs exact keyform updates, and locks ambiguous/parented states at `apps/editor/src/workspace/canvas/use-rotation-deformer-interaction.ts:244`, `apps/editor/src/workspace/canvas/use-rotation-deformer-interaction.ts:343`, `apps/editor/src/workspace/canvas/use-rotation-deformer-interaction.ts:419`, `apps/editor/src/workspace/canvas/use-rotation-deformer-interaction.ts:493`, and `apps/editor/src/workspace/canvas/use-rotation-deformer-interaction.ts:669`.
- Canvas gesture helpers commit through `commitUpdateRigControl` and `commitEditKeyformKey`, not direct graph mutation, at `apps/editor/src/workspace/canvas/rotation-deformer-gesture.ts:126` and `apps/editor/src/workspace/canvas/rotation-deformer-gesture.ts:159`.
- Focused tests cover operation validation/diff behavior, authoring preservation, runtime evidence, Inspector fields, Parameter Binding Vec2 editing, Canvas evaluation/projection, handle hit-testing, preview, pointer-up commit, cancel/no-commit, keyed/rest routing, ambiguous locks, parented locks, and portable save/load translation evidence.

## Must-Not Compliance

- No `packages/package-format/**`, `package.json`, or `pnpm-lock.yaml` changes are present in the current diff.
- No new browser-local save slot, IndexedDB/localStorage save UI, ZIP/archive/native filesystem, File System Access API, directory picker, drag/drop import/export, cloud persistence, or external transport implementation was found in the Wave73 source diff.
- No Viewer / Runtime View implementation path, Texture Atlas implementation, Variant / Expression Manager implementation, mesh-generation source, separate translation deformer/control, or dependency addition was found in the Wave73 diff.
- `restScale` remains internal/runtime/test fixture state and is not exposed through Operation update payload, Inspector fields, Parameter Binding descriptors, or Canvas handles.
- Existing `Texture Atlas` / `Variants` labels in workspace metadata are pre-existing application navigation entries, not Wave73-added implementation scope.

## Validation Summary

Reviewed Orch-Sylph validation evidence from the current worktree:

- `pnpm.cmd typecheck`: passed.
- `node scripts/check-source-organization.mjs`: passed.
- `node scripts/check-dependencies.mjs`: passed.
- `git diff --check`: passed with CRLF normalization warnings only.
- Focused Vitest suite: initial sandbox startup failed with esbuild `spawn EPERM`; escalated rerun passed, 23 test files / 153 tests.
- Focused Playwright portable save/load path: initial sandbox startup failed with `spawn EPERM`; escalated rerun passed, 1 test.
- Playwright-generated untracked portable-project JSON was removed after validation.

This review additionally reran:

- `node scripts/check-source-organization.mjs`: passed.
- `node scripts/check-dependencies.mjs`: passed.
- `git diff --check`: exit 0, CRLF normalization warnings only.

## Findings

No blocking findings.

No needs-change findings.

## Residual Risks / Non-Blockers

- The Playwright portable save/load test remains broad and may fail from unrelated PSD import, mesh, rig, parameter, or UI selector regressions. This is an acceptable non-blocker because lower-level package/provider/storage assertions cover the specific Wave73 persistence boundaries.
- There is no browser-level Rotation translation drag scenario. This is acceptable for Wave73 because operation, authoring, runtime, SSR/component, Canvas projection/evaluation, hook lifecycle, and portable bundle tests cover the committed behavior directly.
- Parented/nested direct Canvas translation editing remains intentionally locked until a future inverse local/world transform edit contract is accepted.
- Order/reparenting round-trip coverage is structurally adequate for the current fixture but still thin for mixed sibling ordering; future richer fixtures would reduce that residual risk.
- Generic authoring-core package helpers can preserve an existing base-document editor-state when no explicit `editorHiddenPartIds` option is provided. The reviewed Editor save path always passes current hidden IDs, so this is not a Wave73 blocker.

## Final Gate Recommendation

`pass`.

Wave73 satisfies the final clean integration gate. It is acceptable for Orch-Sylph to update the Wave73 maps from pending to complete/pass after this review artifact is recorded.
