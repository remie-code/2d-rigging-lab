# Wave90 Domain B Spec Compliance Review

Role: Review-Sylph, Spec Compliance Review lane
Domain: `wave90-editor-workspace-integration`
Verdict: `pass`
Date: 2026-06-20

## Basis Reviewed

- `discussion/implementation/orchestration/wave90-plan.md`
- `discussion/implementation/waves/wave90/wave90-domain-a-workspace-persistence-core-report.md`
- `discussion/implementation/reviews/wave90/wave90-domain-a-spec-compliance-review.md`
- `discussion/implementation/reviews/wave90/wave90-domain-a-design-development-review.md`
- `discussion/implementation/reviews/wave90/wave90-domain-a-test-adequacy-review.md`
- `discussion/design/screen-design/screens/workspace-save-and-navigation.md`
- `discussion/design/screen-design/screens/authoring-workspace.md`
- `discussion/design/screen-design/screens/project-storage-task.md`
- `discussion/design/screen-design/components/toolbox.md`
- `discussion/implementation/waves/wave88/wave88-final-integration-report.md`
- `discussion/implementation/waves/wave89/wave89-final-integration-report.md`
- `discussion/implementation/waves/wave90/wave90-domain-b-editor-workspace-integration-report.md`

Changed Domain B source/tests were reviewed directly.

## Boundary Fix Re-review

Updated verdict: `pass`.

No blocking findings remain for the Domain B escalation-boundary fix. This section supersedes the earlier escalation findings retained below for traceability.

Evidence:

- `apps/editor` does not directly import or declare `@private-2d-rigging-lab/package-format`. A targeted scan of `apps/editor` found no package-format imports; `apps/editor/package.json:14` depends on `@private-2d-rigging-lab/authoring-core`, while `packages/authoring-core/package.json:11` owns the `@private-2d-rigging-lab/package-format` dependency.
- Open Workspace now reaches package parsing/schema validation through the authoring-core adapter. `apps/editor/src/features/workspace-storage/model/workspace-session-storage.ts:6` through `:8` imports `openAuthoringWorkspaceFromTextFileSet()` and binary hydration from authoring-core, `apps/editor/src/features/workspace-storage/model/workspace-session-storage.ts:112` through `:128` routes open through that adapter before hydration, and parser failures are wrapped as `workspace.invalidFileSet` at `apps/editor/src/features/workspace-storage/model/workspace-session-storage.ts:275` through `:284`.
- The authoring-core adapter is the thin parser/open bridge. `packages/authoring-core/src/workspace-open.ts:53` through `:70` calls `parseWorkspacePackageDocumentFromFileSet()` and returns the parsed package document, hydrated session, editor hidden ids, warnings, and binary registration targets. `packages/authoring-core/src/index.ts:8` exports the adapter. Domain A validation remains in package-format: `packages/package-format/src/workspace-file-set.ts:82` through `:85` parses `workspace.json` with `WorkspaceMetadataSchema` and delegates package parsing to `parsePackageDocumentFromFileSet()`.
- Fix Loop 2 binary behavior remains intact. `source-original-v1` targets are optional at `packages/authoring-core/src/workspace-open.ts:108` through `:112`; `texture-raster-v1` targets are required at `packages/authoring-core/src/workspace-open.ts:121` through `:124`. The editor filters required targets at `apps/editor/src/features/workspace-storage/model/workspace-session-storage.ts:115`, verifies only those required targets at `apps/editor/src/features/workspace-storage/model/workspace-session-storage.ts:124` through `:127`, and still rejects missing, byte-length mismatched, unsupported-digest, and digest-mismatched required binaries at `apps/editor/src/features/workspace-storage/model/workspace-session-storage.ts:298` through `:331`. Optional present binaries still hydrate opportunistically at `packages/authoring-core/src/workspace-open.ts:75` through `:95`.
- Tests cover the boundary and binary behavior: authoring-core parser path and invalid metadata/package rejection at `packages/authoring-core/src/workspace-open.test.ts:16`, `:37`, and `:53`; editor invalid file-set wrapping at `apps/editor/src/features/workspace-storage/model/workspace-session-storage.test.ts:236` and `:258`; missing/digest-mismatched required texture refs at `apps/editor/src/features/workspace-storage/model/workspace-session-storage.test.ts:178` and `:197`; absent optional source-original ref at `apps/editor/src/features/workspace-storage/model/workspace-session-storage.test.ts:215`.
- No temporary draft path regression was found in the workspace-storage/open adapter scope; targeted search of `apps/editor/src/features/workspace-storage` and `packages/authoring-core/src/workspace-open.ts` found no temporary/draft storage path.
- Primary Save remains workspace save, not Portable JSON export. `apps/editor/src/workspace/app-bar.tsx:148` through `:150` calls `saveProject()` for `Save Workspace`; `apps/editor/src/features/editor-session/editor-session-context.tsx:988` through `:996` persists the current session to the workspace. Portable JSON export remains separate at `apps/editor/src/features/editor-session/editor-session-context.tsx:1040` through `:1048` and `apps/editor/src/workspace/app-bar.tsx:252` through `:258`.
- File System Access stays app-layer only. FSA detection/picker/permission handling is confined to `apps/editor/src/features/workspace-storage/model/workspace-directory-io.ts:89` through `:133`; targeted scans found no FSA APIs in packages.
- Header/Toolbox split remains visible: Header owns Create/Open/Save/Save As/Portable JSON actions in `apps/editor/src/workspace/app-bar.tsx:146` through `:164` and `:219` through `:264`; Toolbox data still contains Import PSD, Parameters, Variants, Texture Atlas, Validate, and Viewer at `apps/editor/src/workspace/workspace-data.ts:44` through `:53`, with no Project Storage entry.
- No Runtime Export or operation-log addition was found in the reviewed diff/source scope. A diff scan for `Runtime Export`, `operation-log`, `operationLog`, `assets/atlas`, `project.json`, and temporary draft path found no relevant added implementation; the only match was a Portable JSON test filename.

Verification run:

- `pnpm.cmd exec vitest run packages/authoring-core/src/workspace-open.test.ts apps/editor/src/features/workspace-storage/model/workspace-session-storage.test.ts --reporter=dot`
  - Sandbox run failed with Vite/esbuild `spawn EPERM`.
  - Escalated rerun passed: 2 files / 15 tests.

Residual risk:

- Open-time digest verification remains in the editor storage adapter while required/optional target classification and parser/schema validation now come from authoring-core. This preserves the accepted Fix Loop 2 behavior, but a future cleanup could move digest verification behind authoring-core as well.

## Prior Fix Loop 1 Re-review

Historical verdict before the boundary fix: `escalate`.

The prior open-time missing/corrupt binary blocker is resolved in Fix Loop 1. `openEditorWorkspace()` now verifies referenced binary entries before hydrating the session and before returning an opened workspace: `apps/editor/src/features/workspace-storage/model/workspace-session-storage.ts:139` through `:142`, with missing, byte-length, unsupported-digest, and digest-mismatch errors at `apps/editor/src/features/workspace-storage/model/workspace-session-storage.ts:480` through `:525`. Tests cover missing and digest-mismatched workspace binaries at `apps/editor/src/features/workspace-storage/model/workspace-session-storage.test.ts:175` through `:210`.

The dirty replacement guard claimed by Fix Loop 1 is present. `prepareDirtyWorkspaceReplacement()` prompts only when a workspace is open and the current session is dirty, cancels before the replacement picker/import path, and saves before replacement on `save-and-open`: `apps/editor/src/features/editor-session/editor-session-context.tsx:856` through `:885`. Open Workspace and Portable JSON import call this guard at `apps/editor/src/features/editor-session/editor-session-context.tsx:941` through `:952` and `apps/editor/src/features/editor-session/editor-session-context.tsx:1063` through `:1080`. Tests cover cancel/save-and-open for Open Workspace and cancel for Portable JSON import at `apps/editor/src/features/editor-session/editor-session-context-history.test.ts:595` through `:720`.

Provider/session write-once coverage was added. PSD import persists the resulting session to the current workspace at `apps/editor/src/features/editor-session/editor-session-context.tsx:1177` through `:1183`, and Texture Atlas Apply does the same at `apps/editor/src/features/editor-session/editor-session-context.tsx:1231` through `:1237`. Tests assert PSD raw RGBA and generated atlas raw RGBA are each written once and skipped by a later primary Save at `apps/editor/src/features/editor-session/editor-session-context-history.test.ts:722` through `:815`.

The remaining prior blocker is the parser/schema-validation boundary. `openEditorWorkspace()` still calls the app-local `parseWorkspacePackageDocumentFromTextFileSet()` at `apps/editor/src/features/workspace-storage/model/workspace-session-storage.ts:128` through `:130`; that local parser still keeps `workspaceMetadata` as `unknown` and manually assembles the package document at `apps/editor/src/features/workspace-storage/model/workspace-session-storage.ts:82` through `:90` and `:275` through `:327`. A targeted scan confirmed no editor import of Domain A `parseWorkspacePackageDocumentFromFileSet()` and no editor/package dependency change. This requires Orch-Sylph/user-level boundary direction and remains an escalation item.

## Prior Findings Superseded By Boundary Fix

### 1. Still escalated after Fix Loop 1: Open Workspace bypasses the Domain A workspace parser and schema validation

`openEditorWorkspace()` reads JSON files and calls an app-local parser: `apps/editor/src/features/workspace-storage/model/workspace-session-storage.ts:128` through `:130`. That parser manually assembles a `packageDocument` from JSON maps at `apps/editor/src/features/workspace-storage/model/workspace-session-storage.ts:275` through `:327`.

This does not consume Domain A's `parseWorkspacePackageDocumentFromFileSet()`, which validates `workspace.json` with `WorkspaceMetadataSchema` and delegates package parsing to `parsePackageDocumentFromFileSet()`: `packages/package-format/src/workspace-file-set.ts:72` through `:90`.

The Wave90 basis requires the directory workspace layout to reuse the existing PackageDocument file-set parser, and Open Workspace should validate `workspace.json` / `manifest.json`. The local parser only checks that `workspace.json` exists and is parseable JSON; `workspaceMetadata` remains `unknown` and is not validated before open succeeds.

Why this is escalated rather than only marked `needs_changes`: the Domain B report notes that `apps/editor/package.json` does not declare `@private-2d-rigging-lab/package-format`, and package dependency edits are outside Domain B scope. `authoring-core` exports the save-plan adapter but no open/parse adapter: `packages/authoring-core/src/workspace-save.ts:28` through `:45`, `packages/authoring-core/src/index.ts:8`. Orch-Sylph needs to decide whether to approve an editor internal dependency on `package-format` or add an `authoring-core` workspace-open adapter in a follow-up scope.

### 2. Resolved in Fix Loop 1: Open Workspace no longer silently accepts missing or corrupt referenced binaries

`openEditorWorkspace()` now calls `verifyWorkspaceBinaryEntries()` before session hydration and before returning success: `apps/editor/src/features/workspace-storage/model/workspace-session-storage.ts:139` through `:142`.

The verifier throws `workspace.binary.missing`, `workspace.binary.byteLengthMismatch`, `workspace.binary.digestUnsupported`, or `workspace.binary.digestMismatch`: `apps/editor/src/features/workspace-storage/model/workspace-session-storage.ts:480` through `:525`.

Focused tests cover missing and digest-mismatched referenced binaries: `apps/editor/src/features/workspace-storage/model/workspace-session-storage.test.ts:175` through `:210`.

## Compliance Notes

- App starts at Workspace Gate in normal provider state. `EditorSessionProvider` initializes no workspace unless test-only props opt in: `apps/editor/src/features/editor-session/editor-session-context.tsx:555` through `:584`; `AuthoringWorkspaceContent` renders only AppBar plus Gate when `hasOpenWorkspace` is false: `apps/editor/src/workspace/authoring-workspace.tsx:40` through `:45`.
- Workspace Gate uses the Header shell and hides Toolbox, Parts Tree, Canvas, Inspector, Parameter Bar, and PSD modal before workspace open: `apps/editor/src/workspace/authoring-workspace.tsx:44` through `:93`.
- Primary Save is workspace save. The AppBar `Save Workspace` button calls `saveProject()` and does not call portable export: `apps/editor/src/workspace/app-bar.tsx:146` through `:155`; test coverage confirms this at `apps/editor/src/workspace/app-bar.test.ts:163` through `:173`.
- Portable JSON import/export remains explicit and separate. AppBar menu labels are explicit at `apps/editor/src/workspace/app-bar.tsx:252` through `:265`; portable import creates a workspace before replacing the editor session at `apps/editor/src/features/editor-session/editor-session-context.tsx:1063` through `:1102`.
- Browser File System Access is app-layer only in the changed implementation. `showDirectoryPicker` appears under `apps/editor/src/features/workspace-storage/model/workspace-directory-io.ts:88` through `:130`; targeted scans found no FSA type/API leak into packages.
- Header/Toolbox split is mostly compliant. Header owns workspace actions; Toolbox owns Select, Mesh, Rig, Dynamics, Import PSD, Parameters, Variants, Texture Atlas, Validate, Viewer: `apps/editor/src/workspace/workspace-data.ts:31` through `:55`.
- Project Storage was removed from Toolbox and Import PSD remains as an action: `apps/editor/src/workspace/workspace-data.ts:42` through `:49`, `apps/editor/src/workspace/toolbox/workspace-toolbox.tsx:27` through `:34`.
- Header no longer exposes Parameters / Texture Atlas / Validate / Viewer / Import PSD navigation buttons. The remaining Header `Validate` badge is a warning status badge, not a navigation action: `apps/editor/src/workspace/app-bar.tsx:115` through `:123`.
- `activeEntry="import"` is no longer the workspace-home sentinel. Store default is `activeEntry: "workspace"` at `apps/editor/src/state/editor-ui-store.ts:26` through `:33`; Back/Close from Atlas, Diagnostics, Viewer, and Parameter Manager returns to `"workspace"`.
- PSD import, PSD commit, Texture Atlas Apply, and operation-history mutations are guarded before workspace open: `apps/editor/src/features/editor-session/editor-session-context.tsx:713` through `:760`, `:1148` through `:1185`, `:1188` through `:1249`, `:2073` through `:2129`, and `:2146` through `:2152`.
- Domain A binary save-plan behavior is honored on save. Domain B reads existing workspace binaries, calls `createAuthoringWorkspaceSavePlan()`, rejects `error` decisions, writes text entries, and writes binaries only through `writeWorkspaceBinaryDecisions()` for `action === "write"`: `apps/editor/src/features/workspace-storage/model/workspace-session-storage.ts:169` through `:205`, `apps/editor/src/features/workspace-storage/model/workspace-directory-io.ts:208` through `:227`.
- No Runtime Export, operation log persistence, mesh/deformer/dynamics/atlas algorithm changes, or dependency changes were found in the reviewed Domain B diff. Atlas/Viewer/Diagnostics/Parameter changes are route-return changes only.

## Verification Performed

- Read the listed Wave90 basis docs, Domain A reports/reviews, Wave88/Wave89 final integration reports, and Domain B implementation report.
- Reviewed the changed Domain B source/test scope directly.
- Focused tests:
  - `pnpm.cmd exec vitest run apps/editor/src/features/workspace-storage/model/workspace-session-storage.test.ts apps/editor/src/features/editor-session/editor-session-context-history.test.ts apps/editor/src/workspace/app-bar.test.ts apps/editor/src/workspace/toolbox/workspace-toolbox.test.ts apps/editor/src/workspace/authoring-workspace.test.ts apps/editor/src/workspace/project-storage/project-storage-screen.test.ts apps/editor/src/workspace/atlas/texture-atlas-task-screen.test.ts apps/editor/src/workspace/diagnostics/diagnostics-screen.test.ts apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts apps/editor/src/workspace/parameter-manager/parameter-manager-screen.test.ts --reporter=dot`
  - sandbox run failed with known Vite/esbuild `spawn EPERM`;
  - initial review escalated rerun passed: 10 files / 72 tests;
  - Fix Loop 1 re-review escalated rerun passed: 10 files / 79 tests.
- `pnpm.cmd typecheck`: passed.
- Targeted scans:
  - FSA APIs are confined to `apps/editor/src/features/workspace-storage/model/workspace-directory-io.ts`.
  - no `Runtime Export`, `assets/atlas/`, `project.json`, or `temporary draft` implementation found in changed app scope.
  - no `package.json`, `apps/editor/package.json`, `pnpm-lock.yaml`, or `pnpm-workspace.yaml` diff.

## Remaining Risks

- Normal workspace save currently writes the full workspace text file-set every save: `apps/editor/src/features/workspace-storage/model/workspace-session-storage.ts:198` through `:201`. Heavy binaries are correctly selective, but dirty lightweight JSON selection remains coarse.
- Browser-level File System Access automation was not run. Directory behavior is covered through fake handles and session-level tests.
- Open-time binary digest verification is still app-local, while parser/schema validation and required/optional binary target classification now come from authoring-core.
- Unsupported-FSA Portable JSON fallback behavior remains product-sensitive: the Gate keeps Import Portable JSON visible, but imported portable data still must be workspace-ized before editing.

## User-Decision Points For Orch-Sylph

- Resolved by Boundary Fix Re-review: the accepted direction is the `authoring-core` workspace open/parse adapter, with no direct editor dependency on `@private-2d-rigging-lab/package-format`.
