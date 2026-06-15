# Wave73 Final Integration Report: Save/Load Restoration + Rotation Deformer Translation

- Final status: final complete / pass
- Wave gate status: final complete / pass
- Domain: `wave73-final-integration-clean-review-map-closeout`
- Date: 2026-06-15
- Integrator: Orch-Sylph / Domain C drafting Gnome
- Final clean review: `pass` at [../../reviews/wave73/wave73-final-clean-integration-review.md](../../reviews/wave73/wave73-final-clean-integration-review.md)

## Scope

Wave73 closes the save/load restoration gap left after Wave72 and exposes the existing Rotation Deformer translation model through the authoring UI.

- Save/load restoration: Parts Container visibility now persists through the existing project-defined portable bundle path, round-trip assertions are hardened, and Parts Tree initial collapse policy is deterministic without persisting manual collapsed state.
- Rotation translation exposure: `rotation2d.restTranslation` and keyed `translation` are editable through operation/model paths, Inspector, Parameter Binding/keyform authoring, Canvas projection/interaction helpers, runtime evaluation, and portable save/load evidence.

This report records final integration evidence after Orch-Sylph validation and the independent Review-Sylph final clean integration review. Wave73 is final complete / pass.

## Dependency Gate

| Required artifact | Result | Evidence |
|---|---:|---|
| Domain A implementation report | Present / `done` | [wave73-domain-a-save-load-restoration-tree-collapse-policy-report.md](wave73-domain-a-save-load-restoration-tree-collapse-policy-report.md) |
| Domain A Spec Compliance Review | `pass` | [../../reviews/wave73/wave73-domain-a-spec-compliance-review.md](../../reviews/wave73/wave73-domain-a-spec-compliance-review.md) |
| Domain A Design / Development Compliance Review | `pass` | [../../reviews/wave73/wave73-domain-a-design-development-review.md](../../reviews/wave73/wave73-domain-a-design-development-review.md) |
| Domain A Test Adequacy Review | `pass` | [../../reviews/wave73/wave73-domain-a-test-adequacy-review.md](../../reviews/wave73/wave73-domain-a-test-adequacy-review.md) |
| Domain B implementation report | Present / `done` | [wave73-domain-b-rotation2d-translation-exposure-report.md](wave73-domain-b-rotation2d-translation-exposure-report.md) |
| Domain B Spec Compliance Review | `pass` | [../../reviews/wave73/wave73-domain-b-spec-compliance-review.md](../../reviews/wave73/wave73-domain-b-spec-compliance-review.md) |
| Domain B Design / Development Compliance Review | `pass` | [../../reviews/wave73/wave73-domain-b-design-development-review.md](../../reviews/wave73/wave73-domain-b-design-development-review.md) |
| Domain B Test Adequacy Review | `pass` | [../../reviews/wave73/wave73-domain-b-test-adequacy-review.md](../../reviews/wave73/wave73-domain-b-test-adequacy-review.md) |
| Final clean integration review | `pass` | [../../reviews/wave73/wave73-final-clean-integration-review.md](../../reviews/wave73/wave73-final-clean-integration-review.md) records no blocking or needs-change findings. |

## Delivered Integration Evidence

### Save / Load Restoration

- Parts Container visibility persistence is delivered through package editor state:
  - save passes current `editorHiddenPartIds` into portable bundle export;
  - authoring-core writes focused `model/editor-state.json` with `editorHiddenIds`;
  - load hydrates saved hidden IDs, validates them against current Part Container IDs, and drops invalid/stale/duplicate IDs deterministically.
- The Editor load path no longer blindly clears saved hidden Parts Container state when valid saved editor state exists.
- PSD import seeded hidden groups remain editor-hidden Part Containers and now persist through save/load.
- The focused Playwright portable save/load path hides a Part Container, saves and reloads, verifies the Parts Tree state, verifies Canvas effective visibility while hidden, then shows the container and verifies renderability returns.

### Round-Trip Assertion Hardening

Domain A hardened the portable bundle assertions for package/model state expected to persist:

- Parts Container hidden editor state;
- drawable visibility, default opacity, draw order, and reparenting;
- mesh vertices, UVs, triangles, and generation provenance;
- texture binary byte preservation;
- Warp numeric state and keyed control-point offsets;
- Rotation pivot, rest angle, child hierarchy, keyed angle, and later Domain B translation values;
- parameters and keyform sets.

Provider/storage tests distinguish persisted package/editor state from intentionally cleared editor-local state such as selection, active parameter, current parameter values, drafts, operation feedback, PSD modal state, undo/redo history, and manual collapsed tree state.

### Parts Tree Initial Collapse Policy

- Parts Tree initialization now uses a deterministic helper:
  - root Part Containers remain expanded;
  - non-root Part Containers with children initialize collapsed.
- PSD import merges newly created Part Containers into the initial-collapse policy while deterministically expanding the imported root path for immediate task continuity.
- Manual expand/collapse remains React session state only.
- Collapsed state is regenerated on load and is not serialized into the portable bundle.

### Rotation Rest / Keyed Translation

- `rotation2d.restTranslation` is exposed as committed setup state through Operation Core and authoring mutations.
- Operation-level validation accepts finite Vec2 values and rejects wrong-kind or invalid updates.
- Updating rest translation preserves pivot, rest angle, hierarchy, child bindings, opacity, enabled state, `restScale`, and keyform bindings.
- Rotation keyed `translation` Vec2 is supported by v0 linear keyform authoring, editor projection, Parameter Binding editing, Canvas evaluation, and runtime evidence.
- Save/load round-trip evidence now includes nonzero `restTranslation` and nonzero keyed `translation` values.

### Inspector, Canvas, Keyform, and Runtime Trace

- Inspector exposes Rest translation X/Y near Pivot and Rest angle.
- Parameter Binding exposes Rotation Translation X/Y editors at exact editable keyform positions while keeping between-key/interpolated states locked.
- Canvas exposes a distinct translation handle separate from pivot and angle handles.
- Canvas interaction evidence covers preview during drag, one commit on pointer-up, cancel/no-commit behavior, rest-vs-keyed translation routing, and parented/interpolated lock states.
- Runtime evidence covers nonzero rest translation, keyed translation, hierarchy composition, snapshot equality, and runtime diff paths.

## Intentionally Deferred / Out of Scope

- Editor-local state remains intentionally non-persisted:
  - selection;
  - active tool;
  - canvas view;
  - current parameter values;
  - undo history;
  - drafts;
  - selected control point;
  - in-progress gestures;
  - manual collapsed tree state.
- Parented/nested direct Canvas translation editing remains locked pending a future accepted inverse local/world transform edit contract.
- No browser-local save slot, IndexedDB/localStorage UI, ZIP/archive/native filesystem, File System Access API, directory picker, drag/drop import/export, cloud persistence, or cross-profile persistence is added.
- No new package format is added; Wave73 continues to use the existing project-defined portable bundle path and existing package editor-state container.
- Viewer / Runtime View, Texture Atlas Task, Variant / Expression Manager, Dynamics expansion, mesh generation changes, renderer architecture expansion, scale exposure, separate translation deformer/control, auto-rigging, semantic recognition, external HTTP / WebSocket / MCP transport, LLM provider integration, and repo-side proposal generation/auto-fix remain out of scope.

## Must-Not Compliance Evidence

- Domain C edited only documentation/maps in the allowed Wave73 closeout scope.
- The final clean integration review was produced by independent Review-Sylph, records `pass`, and was only linked/statused by this closeout pass.
- Domain A did not add Rotation translation, browser-local save slots, archive/filesystem paths, Viewer/Runtime View, a new package format, or mesh generation changes.
- Domain B did not change save/load implementation beyond portable bundle round-trip assertions, did not expose `restScale` or keyed scale, did not add a separate translation deformer/control, did not change mesh generation, did not add Viewer/Runtime View, and did not add dependencies.
- Source organization and dependency guards passed in final validation.
- `git diff --check` passed with CRLF normalization warnings only and no whitespace errors.

## Validation Results

Validation was performed by Orch-Sylph in the current worktree on 2026-06-15.

| Command | Result |
|---|---|
| `pnpm.cmd typecheck` | passed. |
| `node scripts/check-source-organization.mjs` | passed. |
| `node scripts/check-dependencies.mjs` | passed. |
| `git diff --check` | passed with CRLF normalization warnings only, no whitespace errors. |
| `pnpm.cmd exec vitest run packages/operation-core/src/operations/rig-control.test.ts packages/operation-core/src/operations/edit-keyform-key.test.ts packages/operation-core/src/operations/add-keyform.test.ts packages/authoring-core/src/portable-project-bundle.test.ts packages/authoring-core/src/package-document-adapter.test.ts packages/authoring-core/src/rig-control-mutations.test.ts packages/authoring-core/src/keyform-mutations.test.ts packages/authoring-core/src/runtime-graph-keyforms.test.ts packages/runtime-core/src/rig-control-keyform-evidence.test.ts packages/runtime-core/src/rig-control-contract-evidence-fixture.test.ts packages/runtime-core/src/keyform-target-application.test.ts packages/runtime-core/src/runtime-keyform-snapshot-integration.test.ts apps/editor/src/features/editor-session/editor-session-context-history.test.ts apps/editor/src/features/project-storage/model/editor-project-storage.test.ts apps/editor/src/features/editor-session/model/part-tree-collapse-state.test.ts apps/editor/src/features/editor-session/model/parameter-keyform-state.test.ts apps/editor/src/features/editor-session/model/rig-tool-state.test.ts apps/editor/src/workspace/panels/rig-tool-inspector.test.ts apps/editor/src/workspace/panels/parameter-binding-section.test.ts apps/editor/src/workspace/canvas/canvas-evaluation.test.ts apps/editor/src/workspace/canvas/canvas-projection.test.ts apps/editor/src/workspace/canvas/canvas-renderer.test.ts apps/editor/src/workspace/canvas/rotation-deformer-editing.test.ts` | initial sandbox run failed at startup with esbuild `spawn EPERM`; escalated rerun passed, 23 test files / 153 tests. |
| `pnpm.cmd --dir apps/editor run test:e2e:psd-import -- e2e/portable-project-save-load.e2e.spec.ts` | initial sandbox run failed at startup with `spawn EPERM`; escalated rerun passed, 1 Playwright test. |
| Review-Sylph final clean review reruns: `node scripts/check-source-organization.mjs`; `node scripts/check-dependencies.mjs`; `git diff --check -- discussion/implementation/reviews/wave73/wave73-final-clean-integration-review.md` | passed. |

## Residual Risks

- The Playwright portable save/load path remains broad and may fail from unrelated PSD import, mesh, rig, parameter, or UI regressions.
- Domain B has no browser-level Rotation translation drag path. Accepted coverage comes from operation, authoring, runtime, SSR/component, Canvas projection/evaluation, hook pointer lifecycle, and portable bundle tests.
- Parented/nested direct Canvas translation editing remains intentionally locked until a later coordinate-space contract is accepted.
- Domain A's order/reparenting round-trip oracle is structurally adequate but still thin for mixed sibling ordering; a future richer fixture would harden that path.
- Future callers of generic authoring-core package helpers should avoid treating optional editor-state fields as newly accepted persistence targets unless they explicitly pass current editor-state options.

## Final Recommendation

Wave73 is final complete / pass. Use [../../reviews/wave73/wave73-final-clean-integration-review.md](../../reviews/wave73/wave73-final-clean-integration-review.md) as the final gate artifact; accepted residual risks above remain non-blocking.
