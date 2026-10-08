# Wave90 Domain B Test Adequacy Review

## Verdict

`pass`

Domain B Fix Loop 1 で初回レビューの2つのblocking test gapsは解消済み。Boundary Fix で Open Workspace の parser/schema-validation path は authoring-core adapter 経由に移り、invalid `workspace.json` metadata と invalid package file-set rejection が authoring-core/editor storage の両境界で covered。dirty replacement、open-time binary verification、source-original optional / texture raw RGBA required behavior も focused tests で維持されている。editor app への direct `@private-2d-rigging-lab/package-format` dependency/import は見つからない。

## Basis Reviewed

- `discussion/implementation/orchestration/wave90-plan.md`
- `discussion/implementation/waves/wave90/wave90-domain-a-workspace-persistence-core-report.md`
- `discussion/implementation/reviews/wave90/wave90-domain-a-test-adequacy-review.md`
- `discussion/design/screen-design/screens/workspace-save-and-navigation.md`
- `discussion/design/screen-design/screens/authoring-workspace.md`
- `discussion/design/screen-design/screens/project-storage-task.md`
- `discussion/design/screen-design/components/toolbox.md`
- `discussion/implementation/waves/wave88/wave88-final-integration-report.md`
- `discussion/implementation/waves/wave89/wave89-final-integration-report.md`
- `discussion/implementation/waves/wave90/wave90-domain-b-editor-workspace-integration-report.md`
- Changed source/test files listed in the Review-Sylph assignment.

## Boundary Fix Re-review

### Updated Verdict

`pass`

### Re-reviewed Source / Tests

- `packages/authoring-core/src/workspace-open.ts`
- `packages/authoring-core/src/workspace-open.test.ts`
- `packages/package-format/src/workspace-file-set.ts`
- `packages/package-format/src/workspace-metadata.ts`
- `apps/editor/src/features/workspace-storage/model/workspace-session-storage.ts`
- `apps/editor/src/features/workspace-storage/model/workspace-session-storage.test.ts`
- `apps/editor/src/features/editor-session/editor-session-context-history.test.ts`
- `apps/editor/package.json`
- `discussion/implementation/waves/wave90/wave90-domain-b-editor-workspace-integration-report.md`

### Boundary Fix Findings

- Covered: authoring-core adapter opens through the Domain A parser path.
  - `packages/authoring-core/src/workspace-open.ts:53` defines `openAuthoringWorkspaceFromTextFileSet()`, and `:56` calls `parseWorkspacePackageDocumentFromFileSet()`.
  - `packages/package-format/src/workspace-file-set.ts:82` validates `workspace.json` via `WorkspaceMetadataSchema`, and `:85` delegates the remaining package files to `parsePackageDocumentFromFileSet()`.
  - `packages/authoring-core/src/workspace-open.test.ts:16` opens a serialized workspace file-set through the adapter and asserts parsed metadata, package document equality, hydrated session identity, saved dirty state, hidden part ids, and binary targets.
- Covered: invalid `workspace.json` metadata fails through `WorkspaceMetadataSchema` / package-format path.
  - `packages/authoring-core/src/workspace-open.test.ts:37` injects `unexpectedAppLocalField` into `workspace.json`; because `WorkspaceMetadataSchema` is `.strict()` at `packages/package-format/src/workspace-metadata.ts:10`, the adapter throws.
  - `apps/editor/src/features/workspace-storage/model/workspace-session-storage.test.ts:236` mutates a real fake-directory `workspace.json` the same way and asserts `openEditorWorkspace()` rejects with `workspace.invalidFileSet`.
- Covered: invalid package file-set fails package-format validation.
  - `packages/authoring-core/src/workspace-open.test.ts:53` changes `manifest.packageRevision` to a string and expects the adapter to throw.
  - `apps/editor/src/features/workspace-storage/model/workspace-session-storage.test.ts:258` performs the same mutation at the editor storage boundary and expects `workspace.invalidFileSet`.
- Covered: editor Open Workspace uses the authoring-core adapter and surfaces invalid file-set failures.
  - `apps/editor/src/features/workspace-storage/model/workspace-session-storage.ts:5` imports `openAuthoringWorkspaceFromTextFileSet` from `@private-2d-rigging-lab/authoring-core`; `:113` calls the wrapper during `openEditorWorkspace()`.
  - `apps/editor/src/features/workspace-storage/model/workspace-session-storage.ts:274` wraps adapter failures as `EditorWorkspaceStorageError` with code `workspace.invalidFileSet` at `:282`.
- Covered: prior dirty replacement and binary verification behavior remains covered.
  - Dirty replacement tests remain in `apps/editor/src/features/editor-session/editor-session-context-history.test.ts:595`, `:633`, and `:678`.
  - JSON-only dirty save skip and save-time rewrite coverage remains in `apps/editor/src/features/workspace-storage/model/workspace-session-storage.test.ts:132` and `:159`.
  - Open-time missing/digest-mismatched required texture binary rejection remains in `workspace-session-storage.test.ts:178` and `:197`.
  - Optional source original behavior remains in `workspace-session-storage.test.ts:215`, asserting absent `source-original-v1` bytes do not block open while texture bytes hydrate.
  - The adapter classifies `source-original-v1` as `requiredForWorkspaceOpen: false` at `packages/authoring-core/src/workspace-open.ts:108`, and `texture-raster-v1` as `requiredForWorkspaceOpen: true` at `:121`.
- Covered: no direct editor package-format dependency/import was added.
  - `apps/editor/package.json` dependencies include `@private-2d-rigging-lab/authoring-core` but not `@private-2d-rigging-lab/package-format`.
  - `rg "@private-2d-rigging-lab/package-format" apps/editor/src apps/editor/package.json` found no matches.

### Boundary Fix Verification

- Direct source/test inspection with `rg` and `Get-Content`.
- Focused re-review subset:
  - Sandbox run failed with known Vite/esbuild `spawn EPERM`.
  - Escalated rerun passed: 3 files / 36 tests.
    - `packages/authoring-core/src/workspace-open.test.ts`: 3 tests.
    - `apps/editor/src/features/workspace-storage/model/workspace-session-storage.test.ts`: 12 tests.
    - `apps/editor/src/features/editor-session/editor-session-context-history.test.ts`: 21 tests.

### Remaining Blocking Test Gaps

None.

### Remaining Non-Blocking Risk

- The invalid schema tests assert rejection / normalized editor error code rather than exact parser diagnostic text. This is adequate for the boundary regression because the source path now binds to `parseWorkspacePackageDocumentFromFileSet()`, but exact diagnostic assertions could be added later if user-facing parse messages become contractual.

## Fix Loop 1 Re-review

### Updated Verdict

`pass`

### Re-reviewed Source / Tests

- `apps/editor/src/features/workspace-storage/model/workspace-session-storage.ts`
- `apps/editor/src/features/workspace-storage/model/workspace-session-storage.test.ts`
- `apps/editor/src/features/editor-session/editor-session-context.tsx`
- `apps/editor/src/features/editor-session/editor-session-context-history.test.ts`
- `apps/editor/src/workspace/app-bar.test.ts`
- `discussion/implementation/waves/wave90/wave90-domain-b-editor-workspace-integration-report.md`

### Fix Loop 1 Findings

- Resolved: PSD import workspace raw RGBA write-once coverage.
  - `apps/editor/src/features/editor-session/editor-session-context-history.test.ts:722` creates a provider harness with a fake workspace, commits a real PSD import plan through `commitPsdImport(plan)`, waits until the materialized PSD raw RGBA path has one fake-directory write, asserts bytes match the plan, then calls primary Save and asserts the write count remains `1`.
  - This directly covers the previously missing provider-level flush path from `apps/editor/src/features/editor-session/editor-session-context.tsx:1148` through the `persistSessionToWorkspace()` call at `:1177`.
- Resolved: Texture Atlas generated raw RGBA write-once coverage.
  - `apps/editor/src/features/editor-session/editor-session-context-history.test.ts:772` creates an atlas-capable session, generates a ready preview, applies it through `applyTextureAtlasPreview()`, reads the generated atlas raw RGBA package path from the committed session, asserts one fake-directory write, then calls primary Save and asserts the write count remains `1`.
  - This directly covers the provider-level Atlas Apply persistence path from `apps/editor/src/features/editor-session/editor-session-context.tsx:1189` through `persistSessionToWorkspace()` at `:1232`.
- Covered: open-time missing/corrupt referenced binary tests.
  - `apps/editor/src/features/workspace-storage/model/workspace-session-storage.test.ts:175` deletes a referenced binary after workspace creation and asserts `openEditorWorkspace()` rejects with `workspace.binary.missing`.
  - `apps/editor/src/features/workspace-storage/model/workspace-session-storage.test.ts:194` corrupts the referenced binary bytes and asserts `workspace.binary.digestMismatch`.
  - Source verifies referenced binaries before session hydration in `apps/editor/src/features/workspace-storage/model/workspace-session-storage.ts:121` through `:157`, with explicit missing / byte length / digest branches at `:484` through `:524`.
- Covered: dirty replacement guard tests.
  - `apps/editor/src/features/editor-session/editor-session-context-history.test.ts:595` covers Cancel before Open Workspace and verifies the replacement picker is not invoked.
  - `apps/editor/src/features/editor-session/editor-session-context-history.test.ts:633` covers Save-and-Open and verifies the current dirty workspace file-set is saved before opening the replacement workspace.
  - `apps/editor/src/features/editor-session/editor-session-context-history.test.ts:678` covers Cancel before Portable JSON import and verifies the current dirty session remains active.
  - Source gate is `prepareDirtyWorkspaceReplacement()` in `apps/editor/src/features/editor-session/editor-session-context.tsx:858` through `:891`, called by Open Workspace at `:941` and Portable JSON import at `:1063`.

### Re-review Verification

- Direct source/test inspection with `rg` and `Get-Content`.
- Focused re-review subset:
  - Sandbox run failed with known Vitest/esbuild `spawn EPERM`.
  - Escalated rerun passed: 3 files / 39 tests.
    - `apps/editor/src/features/workspace-storage/model/workspace-session-storage.test.ts`: 9 tests.
    - `apps/editor/src/features/editor-session/editor-session-context-history.test.ts`: 21 tests.
    - `apps/editor/src/workspace/app-bar.test.ts`: 9 tests.
- Accepted Orch-Sylph post-fix verification claims as consistent with source/test inspection:
  - focused full Domain B suite passed: 10 files / 79 tests after sandbox `spawn EPERM`.
  - `pnpm.cmd typecheck`, `pnpm.cmd run check:source`, `pnpm.cmd run check:deps`, and scoped `git diff --check` passed.

### Remaining Blocking Test Gaps

None.

### Remaining Non-Blocking / Escalation-Boundary Items

- Superseded by Boundary Fix: the app-local workspace text file-set parser risk is resolved by the authoring-core open adapter covered above.
- Browser-level/e2e File System Access automation remains deferred; fake-handle model/provider tests cover the deterministic workspace behavior required for this lane.

## Initial Blocking Gaps (Resolved In Fix Loop 1)

1. Resolved: integrated PSD import workspace raw RGBA write-once test.
   - Source wiring exists: `apps/editor/src/features/editor-session/editor-session-context.tsx:1148` commits PSD import, and `:1177` calls `persistSessionToWorkspace()` with `"Saved PSD import to workspace."`.
   - Fix Loop 1 added `apps/editor/src/features/editor-session/editor-session-context-history.test.ts:722`, which opens/creates a workspace through provider setup, calls provider-level `commitPsdImport(plan)`, then asserts the PSD layer `*.raw-rgba` path was written exactly once and a later Save does not rewrite it.
   - This is required by the Wave90 Domain B rubric: "PSD import after workspace writes raw RGBA once."

2. Resolved: integrated Atlas Apply workspace generated atlas raw RGBA write-once test.
   - Source wiring exists: `apps/editor/src/features/editor-session/editor-session-context.tsx:1188` applies Texture Atlas preview, and `:1231` awaits `persistSessionToWorkspace()` with `"Saved Texture Atlas artifact to workspace."`.
   - Fix Loop 1 added `apps/editor/src/features/editor-session/editor-session-context-history.test.ts:772`, which applies Texture Atlas through the provider path, asserts the generated atlas raw RGBA path was written exactly once, then asserts a later Save does not rewrite it.
   - This is required by the Wave90 Domain B rubric: "Apply Atlas after workspace writes generated atlas raw RGBA once."

## Non-Blocking Gaps / Hardening

- Create/Open workspace UI transition coverage is split across layers rather than tested end-to-end. `createEditorWorkspace()` / `openEditorWorkspace()` roundtrip is covered at `apps/editor/src/features/workspace-storage/model/workspace-session-storage.test.ts:38`, and provider source sets `activeEntry` / workspace state in `apps/editor/src/features/editor-session/editor-session-context.tsx:841` and `:888`. A provider + `AuthoringWorkspaceContent` test that clicks or calls `createWorkspace()` and then asserts editing surfaces appear would better match the rubric wording.
- Export Portable JSON download behavior is source-covered but not directly asserted at provider level. `exportPortableProject()` calls `exportEditorProjectBundle()` and `triggerPortableProjectDownload()` at `apps/editor/src/features/editor-session/editor-session-context.tsx:982` through `:997`; AppBar tests assert the explicit menu label at `apps/editor/src/workspace/app-bar.test.ts:175`, and portable bundle creation has lower-level tests in `apps/editor/src/features/project-storage/model/editor-project-storage.test.ts:37`. A mockable download-side-effect test would make the "still downloads portable bundle" requirement stronger.
- Unsupported FSA is model/state-covered at `apps/editor/src/features/workspace-storage/model/workspace-session-storage.test.ts:62`; a UI assertion that Create/Open are disabled while Import Portable JSON remains reachable in unsupported mode would harden fallback coverage.

## Coverage Mapping

| Required evidence | Assessment |
|---|---|
| fake directory handle create/open/save roundtrip | Covered by `workspace-session-storage.test.ts:38`, asserting `workspace.json`, `manifest.json`, hydrated display name, and binary bytes at `:50` through `:55`. |
| unsupported FSA capability state | Covered by `workspace-session-storage.test.ts:62`; state type includes `unsupported` in `workspace-storage-state.ts`. |
| permission denied/lost | Covered by `workspace-session-storage.test.ts:71`, asserting `permission-denied` and `permission-lost`. |
| Save As writes a new workspace file-set | Covered by `workspace-session-storage.test.ts:92`, asserting the second workspace metadata and binary bytes at `:106` through `:109`. |
| safe nested path creation and path traversal rejection | Covered by `workspace-session-storage.test.ts:112`; path guard source is `workspace-directory-io.ts:240` and unsafe checks start at `:414`. |
| JSON-only dirty save does not rewrite verified binary | Covered by `workspace-session-storage.test.ts:129`, asserting skip/write counts and stable fake write count at `:151` through `:153`. |
| missing/digest mismatch binary rewrite | Save-time digest mismatch covered by `workspace-session-storage.test.ts:156`; open-time missing and digest mismatch referenced binaries are covered by `workspace-session-storage.test.ts:175` and `:194`. Missing write remains indirectly covered by create/save-as roundtrip and Domain A core tests. |
| App starts in Workspace Gate | Covered by `authoring-workspace.test.ts:10` and `app-bar.test.ts:206`. |
| Gate uses Header area and does not show editing surfaces | Covered by `authoring-workspace.test.ts:23` through `:31`; source branches at `authoring-workspace.tsx:44` and suppresses `ParameterBar` / `PsdImportModal` until workspace open at `:91` through `:92`. |
| `Create Workspace` enables Authoring Workspace | Partially covered. Storage create is covered at `workspace-session-storage.test.ts:38`; provider source sets workspace target and `activeEntry="workspace"` from `editor-session-context.tsx:841` onward. No end-to-end UI/provider transition test found. |
| `Open Workspace` hydrates saved workspace | Covered at storage layer by `workspace-session-storage.test.ts:38` through `:55`; provider open source is `editor-session-context.tsx:888` through `:918`. |
| `Import Portable JSON` requires workspace creation before editing | Covered by `editor-session-context-history.test.ts:534`, which uses a workspace picker and asserts `hasOpenWorkspace`, saved workspace state, written workspace files, and cleared transient state at `:614` through `:640`; source creates a workspace before session replacement at `editor-session-context.tsx:1005` through `:1040`. |
| Save writes workspace and marks saved | Covered by `editor-session-context-history.test.ts:499`, asserting dirty-to-saved state and written workspace files at `:513` through `:526`. |
| PSD import after workspace writes raw RGBA once | Covered after Fix Loop 1 by `editor-session-context-history.test.ts:722`, asserting provider-level `commitPsdImport(plan)` writes the materialized PSD raw RGBA path once and later Save keeps the write count at `1`. |
| Apply Atlas after workspace writes generated atlas raw RGBA once | Covered after Fix Loop 1 by `editor-session-context-history.test.ts:772`, asserting provider-level `applyTextureAtlasPreview()` writes the generated atlas raw RGBA path once and later Save keeps the write count at `1`. |
| Save button does not trigger portable JSON download | Covered by `app-bar.test.ts:163`, asserting Save Workspace calls `saveProject` and not `exportPortableProject`. |
| Export Portable JSON still downloads portable bundle | Partially covered by source at `editor-session-context.tsx:982` through `:997`, AppBar label test at `app-bar.test.ts:175`, and lower-level bundle tests; no direct provider download assertion found. |
| Toolbox does not contain Project Storage | Covered by `workspace-toolbox.test.ts:97` and source entries in `workspace-data.ts:45` through `:53`. |
| Header no longer duplicates Parameters / Texture Atlas / Validate / Viewer nav | Covered by AppBar/Gate checks for Parameters, Texture Atlas, Viewer at `app-bar.test.ts:206` through `:218` and Viewer-specific no-duplication checks at `viewer-runtime-screen.test.ts:251` and `:260`. Source shows AppBar workspace actions only; Validate remains a warning badge, not nav. |
| Import PSD remains reachable from Toolbox after workspace open | Covered by `workspace-toolbox.test.ts:97`, asserting Import PSD exists and calls `openPsdImport()` without routing through `setActiveEntry`. |
| Back/Close from Atlas / Validate / Viewer returns to neutral authoring workspace | Covered by `texture-atlas-task-screen.test.ts:402`, `diagnostics-screen.test.ts:194`, and `viewer-runtime-screen.test.ts:237` / `:544`, all asserting `setActiveEntry("workspace")`. |

## Verification Performed

- Direct source/test inspection with `rg` and `Get-Content`.
- Initial review ran focused Domain B suite:
  - First sandbox run failed with Vitest/esbuild `spawn EPERM`.
  - Escalated rerun passed: 10 test files / 72 tests.
- Fix Loop 1 re-review ran the updated focused subset:
  - First sandbox run failed with Vitest/esbuild `spawn EPERM`.
  - Escalated rerun passed: 3 test files / 39 tests.
- `pnpm.cmd typecheck`: passed.
- `pnpm.cmd run check:deps`: passed.
- `pnpm.cmd run check:source`: passed.
- `git diff --check -- apps/editor/src/features/editor-session apps/editor/src/features/project-storage apps/editor/src/features/psd-import apps/editor/src/features/workspace-storage apps/editor/src/workspace apps/editor/src/state discussion/implementation/waves/wave90`: exit 0; CRLF working-copy warnings only.

## Implementation Report Claim Check

- Confirmed initially: focused test command in the report passed when rerun outside the sandbox after the known EPERM failure.
- Confirmed initially: root `pnpm.cmd typecheck`, dependency guard, source organization guard, and scoped diff whitespace check passed.
- Superseded by Fix Loop 1: the earlier self-disclosed PSD/Atlas immediate workspace write-count gap at `discussion/implementation/waves/wave90/wave90-domain-b-editor-workspace-integration-report.md:104` has been addressed by provider/session write-once tests.
- Confirmed after Fix Loop 1: the updated implementation report records 10 files / 79 tests and accurately lists dirty replacement guard, open-time binary verification, and provider/session write-once coverage.
- Not rerun: `pnpm.cmd --dir apps/editor typecheck`; the implementation report says it still fails on existing app-level errors.

## Remaining Risks

- Source still uses fire-and-forget persistence for PSD import (`void persistSessionToWorkspace(...)`), but the new test waits for the fake-directory write count before asserting, so this is no longer an uncovered blocking risk.
- Browser-level/e2e FSA permission automation remains deferred; fake directory tests cover the deterministic model/provider behavior.

## User-Decision Points

- None required for Test Adequacy.
