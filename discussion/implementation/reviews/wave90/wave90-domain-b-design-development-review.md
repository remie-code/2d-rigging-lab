# Wave90 Domain B Design / Development Compliance Review

## Verdict

`pass`

Domain B keeps the Browser File System Access boundary in the editor app and passes the focused verification set reported by Orch-Sylph. Fix Loop 2 resolved the remaining in-scope binary verification blocker by requiring only workspace-saved texture refs while leaving source-original refs optional to hydrate when present. The Boundary Fix resolved the parser/schema-validation escalation by exposing Open Workspace parsing through `authoring-core` without adding a direct editor dependency on `@private-2d-rigging-lab/package-format`.

## Scope Reviewed

Changed Domain B source/tests reviewed directly:

- `apps/editor/src/features/workspace-storage/model/fake-workspace-directory.ts`
- `apps/editor/src/features/workspace-storage/model/workspace-directory-io.ts`
- `apps/editor/src/features/workspace-storage/model/workspace-session-storage.ts`
- `apps/editor/src/features/workspace-storage/model/workspace-session-storage.test.ts`
- `apps/editor/src/features/workspace-storage/model/workspace-storage-state.ts`
- `apps/editor/src/features/editor-session/editor-session-context.tsx`
- `apps/editor/src/features/editor-session/editor-session-context-history.test.ts`
- `apps/editor/src/state/editor-ui-store.ts`
- `apps/editor/src/workspace/**` files listed in the review request

Basis documents reviewed:

- `discussion/implementation/orchestration/wave90-plan.md`
- Domain A report and design/development review
- source organization, dependency, and operation policies
- Workspace Save / Navigation, Authoring Workspace, Project Storage, and Toolbox screen specs
- Wave88 and Wave89 final integration reports
- Domain B implementation report

## Findings

### 1. Blocking: `Open Workspace` replaces dirty editor state without the required save/cancel boundary

`AppBar` wires `Open Workspace...` directly to `openWorkspace()` from the header menu, and `openWorkspace()` immediately loads the picked workspace into `setEditorSessionState()` with a fresh history. There is no check for `currentState.session.dirty`, no `Save and Open`, and no `Cancel` branch.

Evidence:

- `apps/editor/src/workspace/app-bar.tsx:235` to `apps/editor/src/workspace/app-bar.tsx:240`
- `apps/editor/src/features/editor-session/editor-session-context.tsx:888` to `apps/editor/src/features/editor-session/editor-session-context.tsx:918`
- Basis: `discussion/design/screen-design/screens/workspace-save-and-navigation.md`, section 6, requires a dirty-state confirmation and recommends not exposing `Open without saving` in v0.

Impact:

- A user can lose unsaved workspace edits by choosing `Open Workspace...`.
- The same risk likely applies to `Import Portable JSON...` replacing the current session through `openProjectFromPortableBundle()` without a dirty-workspace boundary.

Required change:

- Add a dirty workspace transition guard before any action that replaces the current session. For v0, align with the basis: `Save and Open` / `Cancel`, with no open-without-saving normal path unless Orch-Sylph records a changed decision.

### 2. Blocking: workspace open path duplicates Domain A parsing and bypasses Domain A schema validation

Domain B report correctly identifies the package boundary issue: `apps/editor/package.json` does not declare `@private-2d-rigging-lab/package-format`, so the editor cannot directly import `parseWorkspacePackageDocumentFromFileSet()` without a dependency change. However, the replacement parser is not equivalent: it manually reads JSON, trusts the manifest shape, and casts to `AuthoringPackageDocument`.

Evidence:

- App-local parser and cast: `apps/editor/src/features/workspace-storage/model/workspace-session-storage.ts:271` to `apps/editor/src/features/workspace-storage/model/workspace-session-storage.ts:316`
- Domain A workspace parser validates `workspace.json` and delegates package parsing: `packages/package-format/src/workspace-file-set.ts:72` to `packages/package-format/src/workspace-file-set.ts:90`
- Package parser validates manifest and full package document: `packages/package-format/src/package-file-set.ts:80`, `packages/package-format/src/package-file-set.ts:98`
- `PackageDocumentSchema` and `WorkspaceMetadataSchema` are the authoritative schemas: `packages/package-format/src/package-document.ts:43` to `packages/package-format/src/package-document.ts:47`, `packages/package-format/src/workspace-metadata.ts:10` to `packages/package-format/src/workspace-metadata.ts:18`

Impact:

- Invalid `workspace.json` metadata can be accepted.
- Invalid or future-drifted package file sets can reach `createAuthoringSessionFromPackageDocument()` before package-format validation runs.
- This creates an app-local second parser for a Domain A-owned file-set contract.

Required change:

- Do not ship the app-local parser as the authoritative open path. Either expose a parse/open adapter through an existing editor dependency such as `authoring-core`, or explicitly approve an editor dependency on `package-format` and use the Domain A parser directly. If neither is acceptable, escalate the boundary decision before Domain C.

### 3. Needs change: workspace open hydrates missing/corrupt binaries without explicit verification/error handling

`openEditorWorkspace()` collects binary targets, reads only the files that exist, and hydrates whatever bytes are returned. Missing files are silently omitted, and corrupt bytes are registered without digest/length verification. `registerAuthoringSessionBinaryBytes()` validates reference metadata shape but does not verify the bytes against the reference digest.

Evidence:

- Read existing binary entries only: `apps/editor/src/features/workspace-storage/model/workspace-directory-io.ts:175` to `apps/editor/src/features/workspace-storage/model/workspace-directory-io.ts:192`
- Open and hydrate path: `apps/editor/src/features/workspace-storage/model/workspace-session-storage.ts:130` to `apps/editor/src/features/workspace-storage/model/workspace-session-storage.ts:148`
- Hydration silently skips missing entries and registers returned bytes: `apps/editor/src/features/workspace-storage/model/workspace-session-storage.ts:420` to `apps/editor/src/features/workspace-storage/model/workspace-session-storage.ts:440`
- Registration does not compute or compare digest/length: `packages/authoring-core/src/binary-byte-registration.ts:44` to `packages/authoring-core/src/binary-byte-registration.ts:51`
- Domain A already provides binary verification semantics: `packages/package-format/src/package-binary-file-set.ts:190` to `packages/package-format/src/package-binary-file-set.ts:275`

Impact:

- A workspace with missing or corrupt texture bytes can open as if it were successfully hydrated.
- The user-visible storage state does not distinguish clean open, partial binary open, and corrupt binary open.

Required change:

- Verify referenced workspace binaries during open, or route open through a Domain A/authoring-core adapter that does so. Surface missing/corrupt bytes as explicit warnings or errors before entering a normal `saved` state.

## Fix Loop 1 Re-review

### Updated Verdict

`needs_changes`

Dirty replacement is resolved. Open-time binary verification is partially resolved, but one blocking binary-scope issue remains. The parser/schema-validation boundary remains unresolved and is now best treated as an escalation item because it requires an editor dependency/API decision outside Domain B's allowed package scope.

### Finding 1 Status: Resolved

Fix Loop 1 added a dirty replacement guard before both `Open Workspace` and `Import Portable JSON`.

Evidence:

- `prepareDirtyWorkspaceReplacement()` checks `session.dirty`, offers only `"save-and-open"` or `"cancel"`, saves the current workspace on `"save-and-open"`, and returns false on cancel: `apps/editor/src/features/editor-session/editor-session-context.tsx:856` to `apps/editor/src/features/editor-session/editor-session-context.tsx:884`.
- `openWorkspace()` now returns before picker/open when the guard cancels: `apps/editor/src/features/editor-session/editor-session-context.tsx:941` to `apps/editor/src/features/editor-session/editor-session-context.tsx:946`.
- `openProjectFromPortableBundle()` now uses the same guard for portable import replacement: `apps/editor/src/features/editor-session/editor-session-context.tsx:1063` to `apps/editor/src/features/editor-session/editor-session-context.tsx:1067`.
- Tests cover cancel and save-and-open for workspace replacement: `apps/editor/src/features/editor-session/editor-session-context-history.test.ts:595` to `apps/editor/src/features/editor-session/editor-session-context-history.test.ts:676`.
- Tests cover cancel for Portable JSON replacement: `apps/editor/src/features/editor-session/editor-session-context-history.test.ts:678` to `apps/editor/src/features/editor-session/editor-session-context-history.test.ts:716`.

### Finding 2 Status: Unresolved / Escalation Item

The app-local parser/schema-validation issue remains. Fix Loop 1 intentionally did not change it because `apps/editor` still has no declared dependency on `@private-2d-rigging-lab/package-format`, and Domain B cannot edit package/dependency boundaries without approval.

Evidence:

- The open path still uses `parseWorkspacePackageDocumentFromTextFileSet()`: `apps/editor/src/features/workspace-storage/model/workspace-session-storage.ts:128` to `apps/editor/src/features/workspace-storage/model/workspace-session-storage.ts:130`.
- The parser still manually reads JSON and casts to `AuthoringPackageDocument`: `apps/editor/src/features/workspace-storage/model/workspace-session-storage.ts:275` to `apps/editor/src/features/workspace-storage/model/workspace-session-storage.ts:320`.
- There is still no editor package import of `@private-2d-rigging-lab/package-format` in the reviewed workspace-storage file or `apps/editor/package.json`.

Required decision:

- Escalate whether to add an `apps/editor` dependency on `package-format`, or expose workspace parse/schema validation through `authoring-core`.

### Finding 3 Status: Partially Resolved, New Blocking Scope Issue Remains

Fix Loop 1 added open-time missing/digest checks, and the focused tests cover missing and corrupt texture binaries. However, the implementation verifies every binary registration target, including `sourceAsset.binaryAssetRef` entries with role `"source-original-v1"`. Domain A Workspace Save explicitly excludes source original refs, including PSD source originals, and saves texture candidates instead. A workspace that follows Domain A's save plan can therefore fail open if its package document contains a source original binary ref whose bytes were intentionally not written.

Evidence:

- `openEditorWorkspace()` reads binary entries, calls `verifyWorkspaceBinaryEntries()`, and rejects missing/digest mismatches before hydration: `apps/editor/src/features/workspace-storage/model/workspace-session-storage.ts:130` to `apps/editor/src/features/workspace-storage/model/workspace-session-storage.ts:148`.
- `verifyWorkspaceBinaryEntries()` throws `workspace.binary.missing`, `workspace.binary.byteLengthMismatch`, `workspace.binary.digestUnsupported`, or `workspace.binary.digestMismatch`: `apps/editor/src/features/workspace-storage/model/workspace-session-storage.ts:480` to `apps/editor/src/features/workspace-storage/model/workspace-session-storage.ts:523`.
- Tests cover missing and digest-mismatched texture binaries: `apps/editor/src/features/workspace-storage/model/workspace-session-storage.test.ts:175` to `apps/editor/src/features/workspace-storage/model/workspace-session-storage.test.ts:210`.
- The verification target collector still adds source original binary refs from `sourceManifest.sourceAssets`: `apps/editor/src/features/workspace-storage/model/workspace-session-storage.ts:452` to `apps/editor/src/features/workspace-storage/model/workspace-session-storage.ts:461`.
- Domain A save planning excludes all source-asset binary refs, with PSD source originals classified as `psd-source-original-excluded-v1`, and only texture atlas texture refs become workspace binary candidates: `packages/package-format/src/workspace-save-plan.ts:119` to `packages/package-format/src/workspace-save-plan.ts:148`.
- The binary asset contract allows refs whose bytes are missing package-local bytes: `packages/package-format/src/binary-asset.ts:50` to `packages/package-format/src/binary-asset.ts:54`.
- Operation-core tests document PSD source refs with `storageStatus: "missing-package-local-bytes-v1"`: `packages/operation-core/src/operations/import-psd-source-asset.test.ts:194` to `packages/operation-core/src/operations/import-psd-source-asset.test.ts:217`.
- The PSD import planner records `sourcePsdBytePersistence: "metadataOnlyNoRawBytes"` and materialized layer bytes as binary refs only: `apps/editor/src/features/psd-import/model/psd-import-planner.ts:172` to `apps/editor/src/features/psd-import/model/psd-import-planner.ts:179`.

Required change:

- Align open-time binary verification targets with Domain A workspace binary candidates. At minimum, do not require `source-original-v1` / source-asset refs that Workspace Save intentionally excludes or that have `storageStatus` indicating missing package-local bytes. Texture/raw RGBA and committed atlas refs should remain verified.

### Added Coverage Confirmed

Fix Loop 1 added provider/session write-once coverage:

- PSD import raw RGBA is written once and later Save skips it: `apps/editor/src/features/editor-session/editor-session-context-history.test.ts:722` to `apps/editor/src/features/editor-session/editor-session-context-history.test.ts:770`.
- Texture Atlas generated raw RGBA is written once and later Save skips it: `apps/editor/src/features/editor-session/editor-session-context-history.test.ts:772` to `apps/editor/src/features/editor-session/editor-session-context-history.test.ts:815`.

### Re-review Verification

- Reviewed Fix Loop 1 source/tests directly in the key files requested.
- Reviewed the updated Domain B implementation report.
- Did not rerun the already reported verification commands in this lane; Orch-Sylph reported focused Vitest passed 10 files / 79 tests after sandbox `spawn EPERM`, plus `pnpm typecheck`, `check:source`, `check:deps`, and scoped `git diff --check`.

## Fix Loop 2 Re-review

### Updated Verdict

`escalate`

Fix Loop 2 resolves the remaining in-scope binary verification blocker from Fix Loop 1. Dirty replacement remains resolved, texture binary missing/corrupt failures remain covered, and source-original refs no longer make a valid Domain A workspace fail open when their bytes were intentionally not written. The only remaining design/development issue is the parser/schema-validation package boundary, which still requires an Orch-Sylph / Domain A API or dependency decision.

### Binary Scope Finding Status: Resolved

The open path now separates all binary refs from the required verification subset:

- `openEditorWorkspace()` collects all binary registration targets, filters `requiredBinaryTargets`, and passes only that subset to `verifyWorkspaceBinaryEntries()`: `apps/editor/src/features/workspace-storage/model/workspace-session-storage.ts:128` to `apps/editor/src/features/workspace-storage/model/workspace-session-storage.ts:143`.
- `isWorkspaceSavedBinaryRegistrationTarget()` returns true only for `"texture-raster-v1"`: `apps/editor/src/features/workspace-storage/model/workspace-session-storage.ts:481` to `apps/editor/src/features/workspace-storage/model/workspace-session-storage.ts:485`.
- Source originals are still collected for hydration with role `"source-original-v1"`, but `hydrateWorkspaceSessionBinaryAssets()` skips absent entries: `apps/editor/src/features/workspace-storage/model/workspace-session-storage.ts:425` to `apps/editor/src/features/workspace-storage/model/workspace-session-storage.ts:463`.
- Required texture verification still throws explicit `workspace.binary.*` errors for missing, byte-length mismatch, unsupported digest verification, and digest mismatch: `apps/editor/src/features/workspace-storage/model/workspace-session-storage.ts:487` to `apps/editor/src/features/workspace-storage/model/workspace-session-storage.ts:532`.

Focused tests now cover both sides of the boundary:

- Missing texture binary rejects open with `workspace.binary.missing`: `apps/editor/src/features/workspace-storage/model/workspace-session-storage.test.ts:178` to `apps/editor/src/features/workspace-storage/model/workspace-session-storage.test.ts:195`.
- Digest-mismatched texture bytes reject open with `workspace.binary.digestMismatch`: `apps/editor/src/features/workspace-storage/model/workspace-session-storage.test.ts:197` to `apps/editor/src/features/workspace-storage/model/workspace-session-storage.test.ts:213`.
- A package document containing a source-original binary ref opens successfully when that source-original file is absent and the texture file is present: `apps/editor/src/features/workspace-storage/model/workspace-session-storage.test.ts:215` to `apps/editor/src/features/workspace-storage/model/workspace-session-storage.test.ts:234`.

### Parser Boundary Status: Unresolved / Escalation Item

The app-local parser/schema-validation issue remains intentionally unresolved in Fix Loop 2:

- The open path still uses `parseWorkspacePackageDocumentFromTextFileSet()`: `apps/editor/src/features/workspace-storage/model/workspace-session-storage.ts:128` to `apps/editor/src/features/workspace-storage/model/workspace-session-storage.ts:130`.
- The parser still manually reads JSON and casts to `AuthoringPackageDocument`: `apps/editor/src/features/workspace-storage/model/workspace-session-storage.ts:276` to `apps/editor/src/features/workspace-storage/model/workspace-session-storage.ts:321`.
- A targeted scan found no editor import/dependency reference to `@private-2d-rigging-lab/package-format` in `apps/editor/package.json` or the reviewed workspace-storage source.

Required decision:

- Escalate whether to add an `apps/editor` dependency on `package-format`, or expose workspace parse/schema validation through `authoring-core`.

### Fix Loop 2 Verification

- Reviewed Fix Loop 2 source/tests directly in the requested workspace-storage files.
- Reviewed the updated Domain B implementation report.
- Checked dependency manifests in scope with `git status --short -- package.json apps/editor/package.json pnpm-lock.yaml pnpm-workspace.yaml`; no manifest/lockfile changes were reported.
- Did not rerun the already reported verification commands in this lane. Orch-Sylph reported the focused workspace-storage test passed 1 file / 10 tests, the focused Domain B suite passed 10 files / 80 tests, `pnpm.cmd typecheck` passed, scoped `git diff --check` passed with LF/CRLF warnings only, and `check:source` / `check:deps` passed after Fix Loop 2.

## Compliance Evidence

Passing areas:

- Browser/FSA handles and picker access are confined to `apps/editor/src/features/workspace-storage/**` and editor app integration code; scans did not find FSA types leaking into packages.
- No dependency manifest or lockfile diff was present in `package.json`, `apps/editor/package.json`, `pnpm-lock.yaml`, or `pnpm-workspace.yaml`.
- Header/Toolbox responsibility split is mostly implemented: `Project Storage` is removed from `toolboxSections`, `Import PSD` remains in Toolbox, and Header owns workspace/portable JSON actions.
- `activeEntry` now starts at `"workspace"` rather than `"import"`: `apps/editor/src/state/editor-ui-store.ts:27` to `apps/editor/src/state/editor-ui-store.ts:33`.
- Focused app tests passed after the known sandbox `spawn EPERM` was bypassed with approval; the latest Fix Loop 2 focused Domain B suite reported by Orch-Sylph passed 10 files / 80 tests.

## Verification Performed

- Reviewed basis documents and changed source/tests directly.
- `git status --short -uall`: inspected dirty/untracked scope.
- `git diff -- package.json pnpm-lock.yaml pnpm-workspace.yaml apps/editor/package.json`: no dependency diffs.
- Initial review `pnpm.cmd exec vitest run ... --reporter=dot`
  - sandbox attempt failed with known Vitest/esbuild `spawn EPERM`;
  - escalated rerun passed: 10 files / 72 tests.
- Latest Fix Loop 2 verification reported by Orch-Sylph: focused workspace-storage test passed 1 file / 10 tests, focused Domain B suite passed 10 files / 80 tests, and `pnpm.cmd typecheck` passed.
- `pnpm.cmd typecheck`: passed.
- `pnpm.cmd run check:source`: passed.
- `pnpm.cmd run check:deps`: passed.
- `git diff --check -- apps/editor/src/features/editor-session apps/editor/src/features/project-storage apps/editor/src/features/psd-import apps/editor/src/features/workspace-storage apps/editor/src/workspace apps/editor/src/state discussion/implementation/waves/wave90`: passed; CRLF working-copy warnings only.
- Targeted scans for FSA leakage, dependency changes, runtime export, `operations/log.jsonl`, `project.json`, `assets/atlas`, and `binary/` roots did not find Domain B production violations.

## Remaining Risks

- `apps/editor/src/features/editor-session/editor-session-context.tsx` remains a very large existing context file and Domain B added substantial orchestration there. The source guard passes, so this is not a blocking source-organization finding for this wave, but future workspace/session work should split responsibility where practical.
- `apps/editor/src/features/workspace-storage/model/fake-workspace-directory.ts` is production-tree source used by tests. It is not imported by production code in the reviewed scope, but moving fake handles under test utilities would reduce accidental API surface.
- Current worktree includes Domain A package-format/authoring-core edits. They are documented in the Domain A report/review and were not attributed to Domain B.
- No browser-level File System Access permission test was run in this lane; fake handles cover the deterministic model/session behavior.

## User-Decision Points / Escalation Candidates

- Boundary decision: approve `apps/editor` depending directly on `package-format`, or expose workspace open parsing/verification through `authoring-core`.

## Boundary Fix Re-review

### Updated Verdict

`pass`

The boundary fix resolves the parser/schema-validation escalation by routing editor Open Workspace through `authoring-core`, not by adding an editor dependency on `@private-2d-rigging-lab/package-format`.

### Findings

- No blocking findings.
- `apps/editor` does not declare or import `@private-2d-rigging-lab/package-format`. A targeted scan of `apps/editor/package.json` and `apps/editor/src` found no direct references.
- `packages/authoring-core/src/workspace-open.ts` is a thin adapter over the package-format workspace parser: it imports `parseWorkspacePackageDocumentFromFileSet()` and calls it before creating the `AuthoringSession`, reading editor hidden ids, and returning warnings plus binary registration targets: `packages/authoring-core/src/workspace-open.ts:10`, `packages/authoring-core/src/workspace-open.ts:53` to `packages/authoring-core/src/workspace-open.ts:67`.
- The parser/schema-validation path remains package-format-owned. `parseWorkspacePackageDocumentFromFileSet()` validates `workspace.json` through `WorkspaceMetadataSchema` and delegates the package files to `parsePackageDocumentFromFileSet()`: `packages/package-format/src/workspace-file-set.ts:72` to `packages/package-format/src/workspace-file-set.ts:90`. `parsePackageDocumentFromFileSet()` validates the manifest and final package document with package-format schemas: `packages/package-format/src/package-file-set.ts:78` to `packages/package-format/src/package-file-set.ts:99`.
- Browser File System Access and directory-handle concerns remain in the app layer. Targeted FSA/directory-handle scan hits were confined to `apps/editor/src/features/workspace-storage/**` and `apps/editor/src/features/editor-session/**`; no `packages/**` hits were found.
- The app-local authoritative parser/cast path is removed. `workspace-session-storage.ts` calls `openAuthoringWorkspaceFromTextFileSet()` and only wraps failures as `workspace.invalidFileSet`: `apps/editor/src/features/workspace-storage/model/workspace-session-storage.ts:112` to `apps/editor/src/features/workspace-storage/model/workspace-session-storage.ts:130`, `apps/editor/src/features/workspace-storage/model/workspace-session-storage.ts:275` to `apps/editor/src/features/workspace-storage/model/workspace-session-storage.ts:284`. A targeted scan found no production `parseWorkspacePackageDocumentFromTextFileSet`, `AuthoringPackageDocument`, or production `JSON.parse` parser path in that file.
- Existing binary verification behavior is preserved for workspace-saved binaries. `authoring-core` marks source originals as optional and texture refs as required: `packages/authoring-core/src/workspace-open.ts:107` to `packages/authoring-core/src/workspace-open.ts:126`. The editor filters `requiredForWorkspaceOpen` targets and verifies byte length plus SHA-256 before hydration: `apps/editor/src/features/workspace-storage/model/workspace-session-storage.ts:115` to `apps/editor/src/features/workspace-storage/model/workspace-session-storage.ts:130`, `apps/editor/src/features/workspace-storage/model/workspace-session-storage.ts:288` to `apps/editor/src/features/workspace-storage/model/workspace-session-storage.ts:340`.

### Dependency / Package-format Boundary

- No manifest or lockfile churn was present in `package.json`, `apps/editor/package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, or `packages/authoring-core/package.json`.
- `packages/package-format/**` still has working-tree source changes from the wider Wave90 Domain A scope. This re-review treats those package-format files as out of scope and does not approve new package-format source edits for the Domain B boundary fix.

### Verification

- Read the requested policy, report, review, source, test, and manifest files directly.
- `pnpm.cmd exec vitest run packages/authoring-core/src/workspace-open.test.ts apps/editor/src/features/workspace-storage/model/workspace-session-storage.test.ts --reporter=dot`
  - Sandbox attempt failed with the known esbuild `spawn EPERM`.
  - Escalated rerun passed: 2 files, 15 tests.
- `pnpm.cmd run check:deps`: passed.
- `pnpm.cmd run check:source`: passed.

### Residual Risk

- Open-time byte verification still happens in the editor storage adapter, while parser/schema validation and target classification now come from `authoring-core`. This preserves the existing behavior and ownership boundary for this fix, but a future cleanup could move byte verification behind the same authoring-core adapter if the ownership model is tightened further.
- No browser-level File System Access permission test was run in this re-review; deterministic fake-handle model coverage remains the evidence for this lane.
