# Wave73 Domain A Spec Compliance Review

- Verdict: `pass`
- Date: 2026-06-15
- Reviewer: Review-Sylph
- Target: `wave73-save-load-restoration-tree-collapse-policy`

## Scope Reviewed

Reviewed Wave73 Domain A against the wave plan, Wave72 save/load baseline, development policies, screen design notes, the Domain A implementation report, changed source files, and focused tests. This review did not edit source files.

## Basis Documents Used

- `discussion/implementation/orchestration/wave73-plan.md`, especially sections 3, 5, 7.1, 7.2, 7.3, 9, 14, 15, 16.
- `discussion/implementation/orchestration/wave72-plan.md`
- `discussion/implementation/waves/wave72/wave72-final-integration-report.md`
- `discussion/implementation/reviews/wave72/wave72-final-clean-integration-review.md`
- `discussion/implementation/waves/wave72/wave72-domain-b-portable-project-save-load-editor-wiring-report.md`
- `discussion/development_convention/ux-backed-package-logic-authority.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/operation-policy.md`
- `discussion/development_convention/schema-and-id-conventions.md`
- `discussion/design/screen-design/screens/project-storage-task.md`
- `discussion/design/screen-design/screens/authoring-workspace.md`
- `discussion/implementation/waves/wave73/wave73-domain-a-save-load-restoration-tree-collapse-policy-report.md`

## Requirement Classification

| Requirement / basis item | Classification | Evidence |
|---|---:|---|
| Parts Container visibility is durable editor project state. | `implemented` | Editor save passes `editorHiddenPartIds` into export at `apps/editor/src/features/editor-session/editor-session-context.tsx:534` and `apps/editor/src/features/editor-session/editor-session-context.tsx:542`. |
| Store Parts Container visibility through existing package editor-state path, not a new save format. | `implemented` | Authoring Core uses `model/editor-state.json` and `editor-state-v1` at `packages/authoring-core/src/package-document-editor-state.ts:10`, `packages/authoring-core/src/package-document-editor-state.ts:11`; no `packages/package-format/**` diff. |
| Save serializes current hidden Part IDs. | `implemented` | Export writes normalized `editorHiddenIds` at `packages/authoring-core/src/package-document-editor-state.ts:33` and `packages/authoring-core/src/package-document-editor-state.ts:36`; storage forwards the option at `apps/editor/src/features/project-storage/model/editor-project-storage.ts:81`. |
| Load hydrates hidden Part Containers from saved editor state. | `implemented` | Import reads editor hidden IDs at `packages/authoring-core/src/portable-project-bundle.ts:95`; provider restores them at `apps/editor/src/features/editor-session/editor-session-context.tsx:580` and `apps/editor/src/features/editor-session/editor-session-context.tsx:467`. |
| Hydration filters stale, duplicate, or invalid IDs deterministically. | `implemented` | `PartIdSchema.safeParse` and current session Part ID filtering occur at `packages/authoring-core/src/package-document-editor-state.ts:60`; output follows graph order at `packages/authoring-core/src/package-document-editor-state.ts:66`. Tests mutate stale/invalid saved IDs at `packages/authoring-core/src/portable-project-bundle.test.ts:192` and assert only the valid ID remains at `packages/authoring-core/src/portable-project-bundle.test.ts:228`. |
| Valid saved hidden state is not blindly cleared. | `implemented` | Load reset clears transient state but sets `editorHiddenPartIds` from the imported result at `apps/editor/src/features/editor-session/editor-session-context.tsx:463` and `apps/editor/src/features/editor-session/editor-session-context.tsx:467`; provider test asserts old hidden state is gone and loaded hidden state remains at `apps/editor/src/features/editor-session/editor-session-context-history.test.ts:330`. |
| PSD import seeded hidden groups continue to behave correctly. | `implemented` | PSD import still merges imported hidden Part IDs at `apps/editor/src/features/editor-session/editor-session-context.tsx:637`; existing bridge tests cover hidden PSD groups and merge behavior in `apps/editor/src/features/psd-import/model/psd-import-hidden-part-bridge.test.ts:82` and `apps/editor/src/features/psd-import/model/psd-import-hidden-part-bridge.test.ts:107`. |
| Parts Tree reflects restored hidden Part Container state. | `implemented` | Tree rows use `editorHiddenPartIds` and expose hidden/effective hidden state at `apps/editor/src/features/editor-session/model/session-tree.ts:125` and `apps/editor/src/features/editor-session/model/session-tree.ts:145`; E2E asserts restored `Show part container` at `apps/editor/e2e/portable-project-save-load.e2e.spec.ts:89`. |
| Canvas effective visibility reflects restored hidden Part Container state. | `implemented` | Canvas evaluation hides drawables by hidden part or ancestor at `apps/editor/src/workspace/canvas/canvas-evaluation.ts:252` and sets `visible` at `apps/editor/src/workspace/canvas/canvas-evaluation.ts:296`; E2E asserts no renderable artwork while hidden and restoration after show at `apps/editor/e2e/portable-project-save-load.e2e.spec.ts:91` and `apps/editor/e2e/portable-project-save-load.e2e.spec.ts:93`. |
| Round-trip assertions for Parts Container visibility. | `implemented` | Package and storage tests assert `editorHiddenIds` and imported hidden IDs at `packages/authoring-core/src/portable-project-bundle.test.ts:80`, `packages/authoring-core/src/portable-project-bundle.test.ts:89`, and `apps/editor/src/features/project-storage/model/editor-project-storage.test.ts:83`. |
| Round-trip assertions for drawable visibility, default opacity, order/reparenting, mesh, texture bytes, Warp, Rotation, parameters, and keyforms. | `implemented` | Hardened package test covers drawable opacity/visibility at `packages/authoring-core/src/portable-project-bundle.test.ts:100`, mesh vertices/UVs/triangles at `packages/authoring-core/src/portable-project-bundle.test.ts:105`, Warp numeric/keyforms at `packages/authoring-core/src/portable-project-bundle.test.ts:123`, Rotation numeric/keyforms at `packages/authoring-core/src/portable-project-bundle.test.ts:150`, draw order at `packages/authoring-core/src/portable-project-bundle.test.ts:165`, and binary bytes at `packages/authoring-core/src/portable-project-bundle.test.ts:177`. |
| Tests distinguish persisted package/model state from editor-local or transient state. | `implemented` | Provider test clears selection, parameter values, manual collapse, previous hidden state, undo/redo, and PSD modal while restoring saved hidden state at `apps/editor/src/features/editor-session/editor-session-context-history.test.ts:304` through `apps/editor/src/features/editor-session/editor-session-context-history.test.ts:331`. |
| Save/load tests do not require browser-local slots or filesystem APIs. | `implemented` | Storage remains JSON bundle import/export through existing portable path; changed storage source only forwards hidden IDs in `apps/editor/src/features/project-storage/model/editor-project-storage.ts:81`. |
| Parts Tree initializes with useful collapsed-by-default containers. | `implemented` | Non-root Parts with children are initially collapsed at `apps/editor/src/features/editor-session/model/part-tree-collapse-state.ts:8` and `apps/editor/src/features/editor-session/model/part-tree-collapse-state.ts:20`; test asserts expected collapsed IDs at `apps/editor/src/features/editor-session/model/part-tree-collapse-state.test.ts:33`. |
| Manual expand/collapse remains session-only. | `implemented` | Manual collapse only mutates React state at `apps/editor/src/features/editor-session/editor-session-context.tsx:797`; no collapsed IDs are forwarded to export. |
| Collapsed state is not serialized in Wave73. | `implemented` | Package editor-state writes only empty `selection`, empty `lockedIds`, and `editorHiddenIds` at `packages/authoring-core/src/package-document-editor-state.ts:33` through `packages/authoring-core/src/package-document-editor-state.ts:36`. |
| Deterministic auto-expand path for immediate task continuity may be used. | `implemented` | PSD import expands the imported root path while preserving/defaulting new collapse state at `apps/editor/src/features/editor-session/editor-session-context.tsx:632`; helper expands paths deterministically at `apps/editor/src/features/editor-session/model/part-tree-collapse-state.ts:55`. |
| Selection, active tool, canvas view, current parameter values, undo history, drafts, selected control point, and in-progress gestures are not Wave73 persistence targets. | `explicit non-goal` | Reviewed save path serializes only hidden IDs; load reset clears selection, active parameter, parameter values, drafts/feedback, PSD modal, and history at `apps/editor/src/features/editor-session/editor-session-context.tsx:463` through `apps/editor/src/features/editor-session/editor-session-context.tsx:467` and `apps/editor/src/features/editor-session/editor-session-context.tsx:575`. |
| Rotation2d translation exposure. | `deferred by plan` | Wave73 plan assigns this to Domain B; Domain A diff does not implement Rotation translation behavior. |
| Browser-local save slot, IndexedDB UI, ZIP/archive/native filesystem/File System Access API/directory picker/drag-drop, cloud/cross-profile persistence, new package format. | `explicit non-goal` | No package/dependency/transport diff; `packages/package-format/**` unchanged. |
| Viewer/Runtime View, mesh generation algorithm changes, `restScale`, separate translation deformer/control. | `not relevant` | These are Domain B or wave-level forbidden/out-of-scope items; no Domain A diff implements them. |
| Wave72 portable Open/Save foundation remains the base. | `implemented` | Domain A extends `exportAuthoringSessionPortableBundle` / `importAuthoringSessionPortableBundle` rather than replacing the Wave72 bundle path at `packages/authoring-core/src/portable-project-bundle.ts:65` and `packages/authoring-core/src/portable-project-bundle.ts:95`. |
| Source organization policy. | `implemented` | New editor-state and collapse helpers are focused files, and `packages/authoring-core/src/index.ts:9` remains a re-export surface. |
| Dependency policy. | `implemented` | No `package.json` or `pnpm-lock.yaml` diff; no new dependency approval is needed. |
| Operation policy. | `implemented` | No model mutation path was added; the change serializes editor-local project state during save/load and keeps existing operation-based package mutations untouched. |
| Schema and ID conventions. | `implemented` | Existing package-format editor-state schema is used, and hidden IDs are validated with `PartIdSchema` at `packages/authoring-core/src/package-document-editor-state.ts:60`. |
| Project Storage and Authoring Workspace screen basis. | `implemented` | Storage remains portable save/open focused; Parts Tree and Canvas reflect Part Container visibility per authoring workspace basis through `session-tree.ts` and `canvas-evaluation.ts` cited above. |
| Review policy: classify relevant basis requirements and do not pass with `unclear`. | `implemented` | This table contains no `unclear` classifications. |
| Subagent contract: review from source/tests/policies/report and write assigned lane report only. | `implemented` | This review used the basis documents, source, tests, rerun validation, and implementation report; only this artifact was added. |

## Findings

No blocking or needs-change findings.

## Must-Not Compliance Notes

- No new package format or package-format schema change was introduced.
- No browser-local save slot, IndexedDB/localStorage UI, ZIP/archive/native filesystem/File System Access API, directory picker, drag/drop import/export, cloud persistence, or cross-profile persistence was added.
- No Rotation translation exposure, `restScale` exposure, separate translation deformer/control, Viewer/Runtime View, or mesh generation algorithm change was added.
- Selection, active tool, canvas view, current parameter values, undo history, drafts, selected control point, in-progress gestures, and manual collapsed tree state are not serialized by the reviewed Editor save path.

## Validation Reviewed Or Rerun

Rerun by reviewer:

- `pnpm.cmd exec vitest run packages/authoring-core/src/portable-project-bundle.test.ts apps/editor/src/features/project-storage/model/editor-project-storage.test.ts apps/editor/src/features/editor-session/editor-session-context-history.test.ts apps/editor/src/features/editor-session/model/part-tree-collapse-state.test.ts`
  - First sandbox run failed before config load with esbuild `spawn EPERM`.
  - Escalated rerun passed: 4 files, 19 tests.
- `git diff --check -- apps/editor packages/authoring-core packages/package-format discussion/implementation/waves/wave73`
  - Passed; output contained CRLF normalization warnings only.

Reviewed from implementation report but not rerun in this lane:

- `pnpm.cmd typecheck`: reported pass.
- Focused Playwright portable save/load E2E: reported pass.
- `node scripts/check-source-organization.mjs`: reported pass.
- `node scripts/check-dependencies.mjs`: reported pass.

## Residual Risks

- The Playwright portable save/load test remains broad and can fail from unrelated PSD import, mesh, rig, parameter, or UI regressions; this is a non-blocking residual risk already acknowledged by the implementation report.
- Generic Authoring Core helpers still preserve a pre-existing `baseDocument.model.editorState` when called without explicit `editorHiddenPartIds`. The reviewed Editor save path always passes `editorHiddenPartIds`, so this is not a Domain A user-path blocker, but future callers should avoid treating optional editor-state fields as newly accepted persistence targets.
- Selected control point and in-progress gesture non-persistence are verified structurally by the absence of serialization inputs/fields rather than by a dedicated negative test in this lane.

## User-Decision Points

None required for Wave73 Domain A.
