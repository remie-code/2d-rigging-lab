# Wave72 Domain B Spec Compliance Review

## Verdict

`pass`

Fix loop 1 resolves the prior blocking finding. Wave72 Section 10 now has focused browser evidence for portable project save/load restoration, and the relevant Wave72 7.3, 7.4, and 10 requirements can be classified without `unclear`.

## Scope Reviewed

- Domain: `wave72-portable-project-save-load-editor-wiring`
- Re-review after Gnome fix loop 1.
- Reviewed source, tests, updated implementation report, and relevant Wave72 basis requirements.
- Parallel Domain A rotation-edit changes were not reviewed except where Domain B save/load evidence depends on persisted rotation and warp deformer state.

## Basis Documents Used

- `discussion/implementation/orchestration/wave72-plan.md`, especially Sections 3, 5, 7.3, 7.4, 10, 14, 15, 16.
- `discussion/development_convention/ux-backed-package-logic-authority.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/operation-policy.md`
- `discussion/development_convention/schema-and-id-conventions.md`
- `discussion/design/screen-design/screens/project-storage-task.md`
- `discussion/design/screen-design/screens/authoring-workspace.md`
- `discussion/design/screen-design/components/toolbox.md`
- `discussion/design/screen-design/components/rig-tool.md`
- `discussion/design/screen-design/components/parameter-keyform.md`
- `discussion/implementation/waves/wave72/wave72-domain-b-portable-project-save-load-editor-wiring-report.md`

## Requirement Classification

| Requirement | Classification | Evidence / note |
|---|---|---|
| App Bar Save Project uses existing package/project-defined portable bundle export | implemented | Save button calls `saveProject` at `apps/editor/src/workspace/app-bar.tsx:126`; provider export path starts at `apps/editor/src/features/editor-session/editor-session-context.tsx:527`; service calls authoring-core at `apps/editor/src/features/project-storage/model/editor-project-storage.ts:69`; authoring-core wraps portable bundle v0 at `packages/authoring-core/src/portable-project-bundle.ts:56`. |
| App Bar Open Project uses portable bundle import and session hydration | implemented | Hidden input handoff is in `apps/editor/src/workspace/app-bar.tsx:142`; upload path calls provider load at `apps/editor/src/features/editor-session/editor-session-context.tsx:585`; provider replaces session at `apps/editor/src/features/editor-session/editor-session-context.tsx:559`. |
| App Bar Open handoff is tested | implemented | Exported handler test passes selected `File` to `openProjectFile` and clears input value at `apps/editor/src/workspace/app-bar.test.ts:157`. |
| Project Storage task exposes Open/Save status and errors | implemented | Task controls at `apps/editor/src/workspace/project-storage/project-storage-screen.tsx:31`; status rows at `:93`; error code/issue/target path rendering at `:128`; component tests cover idle/saved/loaded/error states in `apps/editor/src/workspace/project-storage/project-storage-screen.test.ts`. |
| Loading replaces the current `AuthoringSession` | implemented | `openProjectFromPortableBundle` sets imported `session`, empty history, and imported base document at `apps/editor/src/features/editor-session/editor-session-context.tsx:563`. |
| Loading clears/reset transient drafts/history that cannot be preserved | implemented | `clearTransientCommitState` and `resetEditorLocalStateAfterProjectLoad` reset drafts, feedback, selection, active parameter, preview parameter values, collapsed/hidden parts, and PSD modal at `apps/editor/src/features/editor-session/editor-session-context.tsx:447`; provider test covers replacement/reset at `apps/editor/src/features/editor-session/editor-session-context-history.test.ts`. |
| Save status is not hardcoded to only `Untitled model` | implemented | App Bar renders session-derived project identity and save status; test asserts loaded identity/status and absence of `Untitled model` at `apps/editor/src/workspace/app-bar.test.ts:118`. |
| Import/export preserves materialized binary assets required by PSD-derived textures | implemented | Export includes session binary file entries at `packages/authoring-core/src/portable-project-bundle.ts:63`; import hydrates texture/source binary refs at `packages/authoring-core/src/portable-project-bundle.ts:89`, `:113`, `:146`; authoring-core and editor storage tests assert texture bytes at `packages/authoring-core/src/portable-project-bundle.test.ts:64` and `apps/editor/src/features/project-storage/model/editor-project-storage.test.ts`. |
| Invalid bundle, missing bytes/payload, digest mismatch are user-visible and testable | implemented | Error classification at `apps/editor/src/features/project-storage/model/editor-project-storage.ts:143`; provider tests verify invalid JSON, missing payload, and digest mismatch preserve current session and expose `projectStorage` metadata; Project Storage screen test verifies issue code and target path rendering. |
| Reuse portable bundle v0 APIs; no new save format | implemented | Adapter imports and uses `exportPortablePackageBundleV0` / `importPortablePackageBundleV0` at `packages/authoring-core/src/portable-project-bundle.ts:1`, `:63`, `:83`. |
| Do not add ZIP/archive/native filesystem/cloud/browser-local save slot/File System Access/directory picker/drag-drop | explicit non-goal and respected | Implementation uses browser `Blob`/object URL/download and hidden file input only; forbidden-scope grep over Domain B paths found no IndexedDB/localStorage/cache storage/File System Access/directory picker/ZIP/archive/cloud/external transport/Cubism runtime usage. |
| Browser download/upload may be used if compatible | implemented | Focused e2e captures download at `apps/editor/e2e/portable-project-save-load.e2e.spec.ts:61` and reopens it through hidden file input at `:71`. |
| Round-trip package document targets: hierarchy, mesh, warp, rotation, parameters, keyforms, drawable opacity keyforms, texture refs/bytes, provenance/rights where represented | implemented | Package document materialization maps graph/model/assets; authoring-core round-trip test covers mesh, warp and rotation deformers, parameters, keyforms, texture refs/bytes at `packages/authoring-core/src/portable-project-bundle.test.ts:33`. |
| Section 10 unit test for texture bytes, mesh, warp, rotation, parameters, and keyforms through package document and portable bundle | implemented | `packages/authoring-core/src/portable-project-bundle.test.ts:33`. |
| Section 10 editor storage service tests for export/import/invalid/missing/digest mismatch | implemented | `apps/editor/src/features/project-storage/model/editor-project-storage.test.ts`; independently re-run in focused Vitest. |
| Section 10 provider/component tests for save status, load replacement, transient reset, App Bar wiring, and status/errors | implemented | Provider tests in `apps/editor/src/features/editor-session/editor-session-context-history.test.ts`; App Bar tests in `apps/editor/src/workspace/app-bar.test.ts`; Project Storage tests in `apps/editor/src/workspace/project-storage/project-storage-screen.test.ts`. |
| Section 10 E2E/focused browser save/load restoration test | implemented | New Playwright test imports PSD, applies mesh, authors opacity keyform, creates rotation and parent warp deformers, saves portable bundle, reloads, opens bundle, and asserts restored tree, mesh, keyform, deformer, and render state at `apps/editor/e2e/portable-project-save-load.e2e.spec.ts:8`. |
| Editor-local state persistence | deferred by plan / implemented as reset | Wave72 allows undo/transient state not to persist; report explicitly documents reset behavior and non-persistence. |
| Browser-local save slot | explicit non-goal | Excluded by Wave72 and report; no implementation found. |
| New package format | explicit non-goal and respected | No new format or package-format redesign found for Domain B; authoring-core adapter remains over portable bundle v0. |
| New dependencies | explicit non-goal and respected | No `apps/editor/package.json`, root `package.json`, or lockfile diff; dependency guard passed. |
| Operation policy mutation gateway | not relevant | Domain B imports/exports/replaces the active session; it does not introduce a package-edit operation path. |
| Source file organization | implemented | `packages/authoring-core/src/index.ts` remains barrel-only; source organization guard passed. |

## Findings

No blocking findings.

Prior finding resolved: the missing Wave72 Section 10 browser/e2e restoration evidence is now covered by `apps/editor/e2e/portable-project-save-load.e2e.spec.ts`. I re-ran the focused e2e outside the sandbox after sandbox `spawn EPERM`; it passed 1 test.

## Explicit Deferred / Non-Goal Items

- Rotation Deformer editing UI/operation work is a Domain A concern, not Domain B.
- Browser-local save slots, IndexedDB, ZIP/archive, File System Access API, native filesystem, directory picker, drag/drop import/export, cloud persistence, cross-profile persistence, Viewer, and Runtime View remain out of scope and were not added.
- Full editor-local state persistence is not required. Domain B resets editor-local state on load instead of persisting it.
- New package format and package-format redesign remain non-goals; Domain B uses portable bundle v0 through authoring-core.
- Mesh/rig draft and feedback reset branches are implementation-inspection-level evidence, per the updated report, but committed mesh/rig restoration is covered by focused e2e.

## Verification Performed

- `pnpm.cmd exec vitest run packages/authoring-core/src/portable-project-bundle.test.ts apps/editor/src/features/project-storage/model/editor-project-storage.test.ts apps/editor/src/features/editor-session/editor-session-context-history.test.ts apps/editor/src/workspace/app-bar.test.ts apps/editor/src/workspace/project-storage/project-storage-screen.test.ts`
  - Sandbox run failed before collection with esbuild `spawn EPERM`.
  - Re-run outside sandbox passed: 5 files, 24 tests.
- `pnpm.cmd --dir apps/editor run test:e2e:psd-import -- e2e/portable-project-save-load.e2e.spec.ts`
  - Sandbox run failed with `spawn EPERM`.
  - Re-run outside sandbox passed: 1 test.
- `pnpm.cmd typecheck`
  - Passed.
- `node scripts/check-source-organization.mjs`
  - Passed.
- `node scripts/check-dependencies.mjs`
  - Passed.
- `git diff --check -- <fix-loop Domain B scope plus this review artifact>`
  - Passed; CRLF normalization warnings only.
- Forbidden-scope grep over Domain B paths found no forbidden storage/transport or Cubism runtime usage. Matches on `draggedDrawableId` / `drop` were unrelated existing structure move identifiers, not drag/drop import/export.

## Residual Risks

- The new e2e is intentionally integration-heavy and depends on existing PSD import, mesh, rig, parameter, and Playwright download/upload behavior. This is acceptable evidence for Section 10, but failures may originate outside the narrow save/load adapter.
- The focused Vitest count is now 24 tests in my run, while the updated report says 23 tests. This appears to be a harmless count drift from the current worktree because all targeted files passed.
- `projectIdentityLabel` still contains a mojibake-like separator at `apps/editor/src/features/project-storage/model/project-storage-state.ts:103`; this is user-visible polish debt, not a Domain B save/load contract blocker.

## User-Decision Points

None.
