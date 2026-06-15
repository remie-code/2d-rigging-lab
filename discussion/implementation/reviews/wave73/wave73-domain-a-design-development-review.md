# Wave73 Domain A Design / Development Compliance Review

- Verdict: `pass`
- Date: 2026-06-15
- Reviewer: Review-Sylph
- Target: `wave73-save-load-restoration-tree-collapse-policy`

## Scope Reviewed

Reviewed the Wave73 Domain A implementation from source, tests, wave plans, Wave72 baseline reports/reviews, development policies, screen specs, and the Gnome implementation report. This review did not rely only on the implementation summary.

Changed implementation and test areas reviewed:

- `packages/authoring-core/src/package-document-editor-state.ts`
- `packages/authoring-core/src/package-document-manifest.ts`
- `packages/authoring-core/src/package-document-model-files.ts`
- `packages/authoring-core/src/package-document-from-authoring-session.ts`
- `packages/authoring-core/src/to-package-document.ts`
- `packages/authoring-core/src/portable-project-bundle.ts`
- `packages/authoring-core/src/portable-project-bundle.test.ts`
- `packages/authoring-core/src/index.ts`
- `apps/editor/src/features/project-storage/model/editor-project-storage.ts`
- `apps/editor/src/features/project-storage/model/editor-project-storage.test.ts`
- `apps/editor/src/features/editor-session/editor-session-context.tsx`
- `apps/editor/src/features/editor-session/editor-session-context-history.test.ts`
- `apps/editor/src/features/editor-session/model/part-tree-collapse-state.ts`
- `apps/editor/src/features/editor-session/model/part-tree-collapse-state.test.ts`
- `apps/editor/e2e/portable-project-save-load.e2e.spec.ts`

## Basis Documents Used

- `discussion/implementation/orchestration/wave73-plan.md`, especially sections 3, 5, 7.1, 7.2, 7.3, 9, 14, 15, 16.
- `discussion/implementation/orchestration/wave72-plan.md`.
- `discussion/implementation/waves/wave72/wave72-final-integration-report.md`.
- `discussion/implementation/reviews/wave72/wave72-final-clean-integration-review.md`.
- `discussion/implementation/waves/wave72/wave72-domain-b-portable-project-save-load-editor-wiring-report.md`.
- `discussion/development_convention/ux-backed-package-logic-authority.md`.
- `discussion/development_convention/source-file-organization-policy.md`.
- `discussion/development_convention/dependency-policy.md`.
- `discussion/development_convention/operation-policy.md`.
- `discussion/development_convention/schema-and-id-conventions.md`.
- `discussion/design/screen-design/screens/project-storage-task.md`.
- `discussion/design/screen-design/screens/authoring-workspace.md`.
- `discussion/implementation/waves/wave73/wave73-domain-a-save-load-restoration-tree-collapse-policy-report.md`.

## Findings

No blocking or needs-change findings.

## Architecture And Module-Boundary Notes

- Editor-state serialization is placed in the authoring-core package document adapter path, not in a GUI-only workaround or a new package format. The new adapter owns include/create/read behavior in `packages/authoring-core/src/package-document-editor-state.ts:17`, `packages/authoring-core/src/package-document-editor-state.ts:24`, and `packages/authoring-core/src/package-document-editor-state.ts:43`.
- The implementation uses the existing package editor-state schema. `packages/package-format/src/model-files.ts:307` defines `editor-state-v1` with `editorHiddenIds`, and `packages/package-format/src/package-file-set.ts:154` already enforces manifest/document editor-state consistency.
- Manifest/model inclusion is consistent and narrow. `packages/authoring-core/src/package-document-manifest.ts:20` decides whether to include editor state, `packages/authoring-core/src/package-document-manifest.ts:25` removes stale manifest entries when absent, and `packages/authoring-core/src/package-document-model-files.ts:57` materializes or preserves the editor-state model file.
- Stale ID filtering is deterministic and based on current Part IDs. `packages/authoring-core/src/package-document-editor-state.ts:56` builds requested/current sets, parses IDs through `PartIdSchema`, and returns IDs in `session.graph.parts` order at `packages/authoring-core/src/package-document-editor-state.ts:66`.
- Save/load wiring preserves Wave72's portable bundle foundation. Editor storage still imports through `@private-2d-rigging-lab/authoring-core` in `apps/editor/src/features/project-storage/model/editor-project-storage.ts:1`; export passes hidden Part IDs at `apps/editor/src/features/project-storage/model/editor-project-storage.ts:78`; import returns authoring-core's hydrated hidden IDs at `apps/editor/src/features/project-storage/model/editor-project-storage.ts:100`.
- Provider load no longer blindly clears saved hidden Part state. `apps/editor/src/features/editor-session/editor-session-context.tsx:458` resets transient state, regenerates collapsed state, and restores imported `editorHiddenPartIds` at `apps/editor/src/features/editor-session/editor-session-context.tsx:466`.
- Initial collapse policy is UI/session state, not serialized package state. `apps/editor/src/features/editor-session/model/part-tree-collapse-state.ts:8` computes initial collapsed IDs from the loaded/current session, and `apps/editor/src/features/editor-session/model/part-tree-collapse-state.ts:27` merges defaults only for newly added parts while preserving manual state.
- PSD import remains deterministic for task continuity: `apps/editor/src/features/editor-session/editor-session-context.tsx:631` merges new collapse defaults and expands the imported root path; hidden Part IDs from PSD import remain merged separately at `apps/editor/src/features/editor-session/editor-session-context.tsx:636`.

## Source Organization, Dependency, Operation, And Schema Compliance

- Source organization complies. New files have focused responsibilities: `package-document-editor-state.ts` owns package editor-state normalization, and `part-tree-collapse-state.ts` owns initial/merge collapse policy. `packages/authoring-core/src/index.ts:1` remains barrel-only; the new export at `packages/authoring-core/src/index.ts:9` is a re-export.
- Dependency policy complies. No `package.json` or `pnpm-lock.yaml` changes were present, and the dependency guard passed.
- Operation policy is respected. Model package mutations remain in existing operation paths; this work serializes/deserializes editor project state during save/load and sets React session state on hydration. It does not add operation payloads or direct graph mutation paths.
- Schema/ID conventions are respected. The implementation uses existing machine-readable package paths and schema version values (`model/editor-state.json`, `editor-state-v1`) and does not introduce space-containing IDs or Cubism schema targets.
- Package/editor-state contract remains bounded to hidden Part Containers plus empty legacy arrays on explicit export. Selection, active tool, canvas view, active parameter/current values, undo history, drafts, selected control point, in-progress gestures, and manual collapsed tree state are not serialized by this change.

## Must-Not Compliance Notes

- No `packages/package-format/**` changes were introduced.
- No browser-local save slot, IndexedDB/localStorage persistence, ZIP/archive/native filesystem, File System Access API, directory picker, drag/drop import/export, cloud/cross-profile persistence, Viewer/Runtime View, Rotation translation, scale exposure, or mesh-generation algorithm change was introduced.
- Diff search over changed source/test areas found no forbidden implementation surface beyond the expected stale-ID test text.

## Validation Reviewed Or Rerun

Reviewed Gnome-reported validation:

- Focused Vitest suite passed after sandbox `spawn EPERM` escalation: 4 files / 19 tests.
- Focused collapse-policy Vitest passed: 1 file / 3 tests.
- Focused authoring-core portable bundle Vitest passed: 1 file / 2 tests.
- `pnpm.cmd typecheck` passed.
- Focused Playwright portable save/load E2E passed: 1 test.
- Source organization, dependency, and diff checks passed with CRLF normalization warnings only.

Reviewer reran lightweight guards:

- `node scripts/check-source-organization.mjs`: passed.
- `node scripts/check-dependencies.mjs`: passed.
- `git diff --check -- apps/editor packages/authoring-core packages/package-format discussion/implementation/waves/wave73`: exit 0, CRLF normalization warnings only.

Relevant test evidence inspected:

- Package editor-state export/import and current-ID filtering: `packages/authoring-core/src/portable-project-bundle.test.ts:49`, `packages/authoring-core/src/portable-project-bundle.test.ts:77`, `packages/authoring-core/src/portable-project-bundle.test.ts:192`.
- Editor storage editor-hidden round trip: `apps/editor/src/features/project-storage/model/editor-project-storage.test.ts:55`.
- Provider load reset distinguishes persisted hidden state from transient editor-local state: `apps/editor/src/features/editor-session/editor-session-context-history.test.ts:308`.
- Initial collapse/default merge behavior: `apps/editor/src/features/editor-session/model/part-tree-collapse-state.test.ts:28`.
- Browser save/load restored hidden Part Container state and Canvas effective visibility: `apps/editor/e2e/portable-project-save-load.e2e.spec.ts:61`.

## Residual Risks

- The Playwright portable save/load test remains broad and can fail from unrelated PSD import, mesh, rig, parameter, or UI selector regressions.
- `toPackageDocument` continues the pre-existing behavior of preserving a base document's editor-state when no explicit editor-state options are provided. The Wave73 editor save path passes current hidden Part IDs explicitly, so this is not a Domain A blocker.
- Future expansion of package editor-state beyond hidden Part Containers will need a separate product/schema decision to avoid accidentally persisting editor-local state.

## User-Decision Points

None required for Domain A pass.
