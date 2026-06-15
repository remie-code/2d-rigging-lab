# Wave72 Final Integration Report: Rotation Deformer Edit UX + Portable Project Save/Load Wiring

- Final status: `pass`
- Domain: `wave72-final-integration-clean-review-map-closeout`
- Date: 2026-06-15
- Integrator: Orch-Sylph / Domain C drafting Gnome
- Final clean review: `pass` ([../../reviews/wave72/wave72-final-clean-integration-review.md](../../reviews/wave72/wave72-final-clean-integration-review.md))

## Scope

Wave72 moves the React Editor authoring loop forward in two bounded areas:

- Rotation Deformer editing: Inspector and Canvas edit paths for pivot, rest angle, and keyform-aware angle behavior.
- Portable project storage wiring: App Bar Open/Save, Project Storage status/error UI, and session hydration through the existing project-defined portable bundle path.

This report records integration evidence and the independent final clean integration review result.

## Dependency Gate

| Required artifact | Result | Evidence |
|---|---:|---|
| Domain A implementation report | Present / pass-classified | [wave72-domain-a-rotation-deformer-edit-ux-report.md](wave72-domain-a-rotation-deformer-edit-ux-report.md) exists. Domain A report verdict text is `done`; Undine precondition and all Domain A reviews classify the domain as pass. |
| Domain B implementation report | Present / pass-classified | [wave72-domain-b-portable-project-save-load-editor-wiring-report.md](wave72-domain-b-portable-project-save-load-editor-wiring-report.md) exists. Domain B report verdict text is `Implemented and ready for independent review`; Undine precondition and all Domain B reviews classify the domain as pass. |
| Domain A Spec Compliance Review | `pass` | [../../reviews/wave72/wave72-domain-a-spec-compliance-review.md](../../reviews/wave72/wave72-domain-a-spec-compliance-review.md) |
| Domain A Design / Development Compliance Review | `pass` | [../../reviews/wave72/wave72-domain-a-design-development-review.md](../../reviews/wave72/wave72-domain-a-design-development-review.md) |
| Domain A Test Adequacy Review | `pass` | [../../reviews/wave72/wave72-domain-a-test-adequacy-review.md](../../reviews/wave72/wave72-domain-a-test-adequacy-review.md) |
| Domain B Spec Compliance Review | `pass` | [../../reviews/wave72/wave72-domain-b-spec-compliance-review.md](../../reviews/wave72/wave72-domain-b-spec-compliance-review.md) |
| Domain B Design / Development Compliance Review | `pass` | [../../reviews/wave72/wave72-domain-b-design-development-review.md](../../reviews/wave72/wave72-domain-b-design-development-review.md) |
| Domain B Test Adequacy Review | `pass` | [../../reviews/wave72/wave72-domain-b-test-adequacy-review.md](../../reviews/wave72/wave72-domain-b-test-adequacy-review.md) |
| Final clean integration review | `pass` | [../../reviews/wave72/wave72-final-clean-integration-review.md](../../reviews/wave72/wave72-final-clean-integration-review.md) records `pass` with no blocking or needs-change findings. |

## Delivered Integration Evidence

### Rotation Deformer Edit UX

- Inspector path is delivered for committed Rotation Deformers:
  - editable `pivot.x`;
  - editable `pivot.y`;
  - editable `restAngleDegrees`;
  - existing name, parent, opacity, children summary, and parameter binding state remain present.
- Canvas path is delivered for selected committed Rotation Deformers:
  - pivot handle drag previews during pointer movement and commits one undoable gesture on pointer-up;
  - angle handle drag previews evaluated artwork and commits through the existing gesture/history path;
  - pointer cancel/abort discards preview state without committing.
- Keyform-aware angle behavior is delivered:
  - without Rotation angle keyforms, Canvas angle drag edits `restAngleDegrees`;
  - at an exact editable Rotation angle keyform, Canvas angle drag updates that keyform's `angleDegrees`;
  - between keyforms or otherwise ambiguous state is locked rather than silently creating or overwriting keyform state.
- Residual nested-parent limitation is documented:
  - direct Canvas editing for parented/nested Rotation Deformers is blocked/diagnosed because no accepted inverse local/world transform edit contract exists yet;
  - Inspector numeric local-field editing remains available.

### Portable Bundle Open/Save Path

- App Bar Save Project is wired to portable bundle export through authoring-core and existing portable bundle v0 behavior.
- App Bar Open Project is wired through a hidden JSON file input, portable bundle import, and Editor session hydration.
- Project Storage task UI is active for status and errors:
  - project identity/status;
  - file name;
  - binary payload counts and loaded byte counts;
  - validation issue code and target path when available.
- Session hydration/load replacement is delivered:
  - loading replaces the current `AuthoringSession`;
  - load resets history and transient editor-local state that cannot be meaningfully preserved in v0;
  - failed imports preserve the current session and surface storage error metadata.
- Error handling is user-visible and test-covered for:
  - invalid bundle;
  - missing bytes / missing payload;
  - digest mismatch.

### State Preservation Evidence

Round-trip evidence covers the Wave72 required preservation targets:

- mesh vertices, UVs, triangles, and generation provenance;
- deformer hierarchy, including Rotation plus Warp parent/child state;
- Warp edits and keyformed offsets;
- Rotation edits, including pivot, rest angle, keyed angle, opacity, and enabled state;
- parameters and keyform sets;
- drawable opacity keyforms;
- materialized texture assets and binary payloads required by PSD-derived textures;
- package-represented source/provenance/rights metadata where already represented by the existing package format.

Evidence comes from focused authoring-core portable bundle tests, Editor storage/provider/component tests, and the focused Playwright portable save/load path.

## Intentionally Deferred / Out of Scope

- Full editor-local persistence remains deferred:
  - undo history;
  - transient mesh/rig drafts;
  - operation feedback;
  - selected control point;
  - in-progress gestures.
- The load path resets selection, active parameter, preview parameter values, collapsed/hidden parts, PSD import modal state, and history instead of preserving them.
- Browser-local save slot / IndexedDB UI is out of scope.
- ZIP/archive, native filesystem, File System Access API, directory picker, drag-drop import/export, cloud persistence, and cross-profile persistence are out of scope.
- Viewer / Runtime View, Texture Atlas Task, Variant / Expression Manager, Dynamics expansion, mesh generation algorithm changes, renderer architecture expansion, auto-rigging, semantic recognition, external HTTP / WebSocket / MCP transport, LLM provider integration, and repo-side proposal generation/auto-fix are out of scope.
- No new save format is introduced; Wave72 reuses the existing project-defined portable bundle path.

## Must-Not Compliance Evidence

- Final `pass` is grounded in the independent final clean review.
- No production source is edited by this Domain C drafting task.
- No test source is edited by this Domain C drafting task.
- Domain A did not implement Project Storage, portable save/load, browser-local slots, archive/filesystem, Viewer, Runtime View, or mesh generation changes.
- Domain B did not implement Rotation Deformer editing, browser-local slots, ZIP/archive/native filesystem/File System Access API/directory picker/drag-drop/cloud persistence, Viewer, Runtime View, broad package-format redesign, direct Editor package-format dependency, or mesh generation algorithm changes.
- Dependency and source-organization guards passed.
- `git diff --check` passed with CRLF conversion warnings only.
- Playwright generated one untracked portable-project JSON under `apps/editor/test-results/...`; Orch-Sylph removed that generated validation artifact after the run.

## Validation Results

| Command | Result |
|---|---|
| `pnpm.cmd typecheck` | passed. |
| `pnpm.cmd exec vitest run packages/operation-core/src/operations/rig-control.test.ts packages/operation-core/src/operations/edit-keyform-key.test.ts packages/authoring-core/src/rig-control-mutations.test.ts packages/authoring-core/src/portable-project-bundle.test.ts packages/authoring-core/src/runtime-graph-adapter.test.ts packages/runtime-core/src/rig-control-keyform-evidence.test.ts packages/runtime-core/src/rig-control-hierarchy-evidence.test.ts packages/runtime-core/src/rig-control-opacity-keyform-state.test.ts` | initial sandbox run failed to load Vitest config with esbuild `spawn EPERM`; escalated rerun passed, 8 test files / 57 tests. |
| `pnpm.cmd exec vitest run apps/editor/src/features/editor-session/editor-session-context-history.test.ts apps/editor/src/features/editor-session/model/editor-session-commands.test.ts apps/editor/src/workspace/canvas/canvas-projection.test.ts apps/editor/src/workspace/canvas/canvas-renderer.test.ts apps/editor/src/workspace/canvas/rotation-deformer-editing.test.ts apps/editor/src/workspace/panels/rig-tool-inspector.test.ts apps/editor/src/workspace/panels/parameter-binding-section.test.ts apps/editor/src/features/project-storage/model/editor-project-storage.test.ts apps/editor/src/workspace/app-bar.test.ts apps/editor/src/workspace/project-storage/project-storage-screen.test.ts` | passed outside sandbox because Vitest startup was already proven sandbox-blocked, 10 test files / 67 tests. |
| `pnpm.cmd --dir apps/editor run test:e2e:psd-import -- e2e/portable-project-save-load.e2e.spec.ts` | initial sandbox run failed with `spawn EPERM`; escalated rerun passed, 1 Playwright test. |
| `node scripts/check-source-organization.mjs` | passed. |
| `node scripts/check-dependencies.mjs` | passed. |
| `git diff --check` | passed with CRLF conversion warnings only. |

## Residual Risks

- Browser E2E save/load evidence is intentionally broad and may fail from unrelated PSD import, mesh, rig, parameter, or UI regressions.
- Rotation edit workflow has strong focused test coverage but no full browser drag workflow.
- Parented/nested Rotation direct Canvas editing is blocked rather than solved; enabling it later requires an accepted local/world inverse transform edit contract.
- Download trigger failure hardening remains a later UX/storage robustness item because the current v0 browser path assumes available browser download primitives.

## Final Recommendation

Mark Wave72 as final `pass` based on the existing validation evidence and the independent final clean integration review at [../../reviews/wave72/wave72-final-clean-integration-review.md](../../reviews/wave72/wave72-final-clean-integration-review.md).
