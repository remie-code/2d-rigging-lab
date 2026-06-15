# Wave73 Domain B: Rotation2d Translation Exposure Report

## Verdict

done

## Implementation Summary

- `rotation2d.restTranslation` is now accepted by `updateRigControl`, validated as finite Vec2, included in model diff output, and preserved alongside pivot, rest angle, hierarchy, opacity, enabled state, and keyform bindings.
- Rotation `translation` Vec2 keyforms are now supported by v0 linear keyform authoring, editor projection, Parameter Binding editing, Canvas evaluation, and Runtime evidence tests.
- Rig Tool Inspector exposes Rest translation X/Y near Pivot and Rest angle.
- Canvas exposes a distinct Rotation translation handle. It previews and commits one undoable update to `restTranslation` when no translation keyform context exists, updates keyed `translation` at exact editable keyforms, cancels without commit, and locks parented/interpolated ambiguous states.
- Portable bundle round-trip test now includes nonzero `restTranslation` and keyed `translation`.

## Files Changed By Domain B

- `packages/operation-core/src/payloads/rig-control.ts`
- `packages/operation-core/src/operations/update-rig-control.ts`
- `packages/operation-core/src/operations/rig-control.test.ts`
- `packages/operation-core/src/operations/edit-keyform-key.test.ts`
- `packages/authoring-core/src/authoring-mutations.ts`
- `packages/authoring-core/src/rig-control-mutations.ts`
- `packages/authoring-core/src/rig-control-mutations.test.ts`
- `packages/authoring-core/src/linear-keyform-editing.ts`
- `packages/authoring-core/src/portable-project-bundle.test.ts`
- `packages/runtime-core/src/rig-control-keyform-evidence.test.ts`
- `apps/editor/src/features/editor-session/model/parameter-keyform-state.ts`
- `apps/editor/src/features/editor-session/model/parameter-keyform-state.test.ts`
- `apps/editor/src/features/editor-session/model/rig-tool-state.ts`
- `apps/editor/src/workspace/panels/parameter-binding-section.tsx`
- `apps/editor/src/workspace/panels/parameter-binding-section.test.ts`
- `apps/editor/src/workspace/panels/rig-tool-inspector.tsx`
- `apps/editor/src/workspace/panels/rig-tool-inspector.test.ts`
- `apps/editor/src/workspace/panels/canvas-preview-panel.tsx`
- `apps/editor/src/workspace/canvas/canvas-evaluation.ts`
- `apps/editor/src/workspace/canvas/canvas-evaluation.test.ts`
- `apps/editor/src/workspace/canvas/canvas-projection.ts`
- `apps/editor/src/workspace/canvas/canvas-projection.test.ts`
- `apps/editor/src/workspace/canvas/canvas-renderer.ts`
- `apps/editor/src/workspace/canvas/rotation-deformer-handles.ts`
- `apps/editor/src/workspace/canvas/rotation-deformer-gesture.ts`
- `apps/editor/src/workspace/canvas/use-rotation-deformer-interaction.ts`
- `apps/editor/src/workspace/canvas/rotation-deformer-editing.test.ts`
- `discussion/implementation/waves/wave73/wave73-domain-b-rotation2d-translation-exposure-report.md`

Existing Domain A dirty files were treated as baseline and not reverted.

## Validation Commands And Results

- `pnpm.cmd exec vitest run ...focused 11 files...`
  - First sandboxed run failed at startup with esbuild `spawn EPERM`.
  - Reran with required escalation: pass, 11 files / 86 tests.
  - Reran after type fixes: pass, 11 files / 86 tests.
- `pnpm.cmd typecheck`: pass.
- `node scripts/check-source-organization.mjs`: pass.
- `node scripts/check-dependencies.mjs`: pass.
- `git diff --check -- packages/operation-core packages/authoring-core packages/runtime-core apps/editor discussion/implementation/waves/wave73`: pass; only existing CRLF warnings.

## Basis Coverage Self-Report

- Wave73 Sections 3, 5, 7.4, 7.5, 7.6, 10, 14, 15, 16 covered for Domain B.
- Domain A save/load restoration path was used only by strengthening portable round-trip coverage.
- Wave72 pivot/rest-angle behavior is preserved; angle and pivot tests still pass with translation handle added.
- UX-backed package logic authority preserved: package/runtime semantics stay in package/runtime layers, editor exposes committed operation/keyform paths.

## Intentionally Deferred Basis Items

- Parented/nested direct Canvas translation remains locked with `parentedUnsupported`, as allowed by the plan.
- Focused browser path was not added or run for translation because there is no stable focused UI script for exact translation keyform dragging; coverage is currently by model, hook, SSR panel, Canvas projection/evaluation, and portable bundle tests.

## User-Facing UX Trace

- Inspector: Rotation Deformer shows Rest translation X/Y next to Pivot and Rest angle.
- Parameter Binding: Rotation binding list now includes Translation with X/Y numeric editors; exact keyform positions are editable, between-key states remain locked.
- Canvas: Rotation overlay has a distinct translation diamond handle separate from pivot and angle handles; pointer cancel/no-commit and pointer-up single commit are covered.

## Operation / Keyform / Runtime Contract Trace

- Operation `updateRigControl` accepts `restTranslation`, rejects invalid request values, rejects wrong-kind updates, emits `/restTranslation` model diffs, and maps authoring diagnostics.
- Authoring mutation validates finite Vec2 and preserves hierarchy, child bindings, opacity, enabled state, rest scale, and keyforms.
- Keyform authoring accepts Rotation `translation` Vec2 for `replace`/`additiveDelta`; scale remains unsupported in editor/operation authoring.
- Runtime evidence covers nonzero rest translation, keyed translation, hierarchy composition, snapshot equality, and runtime diff paths.

## Inspector And Canvas UX Trace

- Inspector tests assert Rest translation X/Y controls and payload generation.
- Canvas handle tests assert pivot, angle, and translation handle positions and hit testing.
- Interaction hook tests assert move preview, pointer-up single commit, cancel/no commit, rest-vs-keyed translation behavior, and ambiguous/parented locks.

## Translation Save/Load Trace

- `packages/authoring-core/src/portable-project-bundle.test.ts` now round-trips:
  - Rotation `restTranslation: { x: 6, y: -3 }`
  - Rotation keyed `translation` values `{ x: -4, y: 2 }` and `{ x: 8, y: -5 }`
- No save/load implementation was changed by Domain B.

## Scale Non-Exposure Evidence

- No Inspector field, Parameter Binding descriptor, Canvas handle, operation payload, or edit-keyform UI path exposes `restScale` or keyed `scale`.
- Runtime continues to carry scale internally, but Domain B only added UI/operation/keyform exposure for translation.

## Must-Not Compliance Evidence

- No package-format schema change.
- No dependency change.
- No mesh generation change.
- No separate translation deformer/control added.
- No Viewer / Runtime View changes.
- Domain A dirty changes were preserved and not reverted.

## Residual Risk Classification

low-to-medium

Main residual risk is lack of a browser-level translation interaction path. The lower-level tests cover the operation, editor model, panels, Canvas handle/hook behavior, runtime evaluation, and portable bundle round-trip.

## Unresolved Assumptions Or Parent Decisions Needed

- No parent decision required for this domain.
- Assumption retained from Wave73: parented/nested direct Canvas translation editing may remain locked until a future coordinate-space design is accepted.
