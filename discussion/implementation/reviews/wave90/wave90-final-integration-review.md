# Wave90 Final Integration Review

Role: Wave90 final integration clean reviewer
Date: 2026-06-20
Verdict: `pass`

## Findings

Blocking findings: none.

Needs-fix findings: none.

Non-blocking residual risks:

1. Browser-level File System Access picker/permission automation was not run. The deterministic workspace I/O behavior is covered with fake handles and provider/model tests, but real browser picker behavior remains deferred.
   - Evidence: FSA abstraction and capability detection are app-layer only in `apps/editor/src/features/workspace-storage/model/workspace-directory-io.ts:88`.
   - Test evidence: fake directory roundtrip, unsupported FSA, and permission denied/lost coverage starts at `apps/editor/src/features/workspace-storage/model/workspace-session-storage.test.ts:41`, `:65`, and `:74`.
2. Normal Save still writes the full lightweight workspace text file-set rather than per-JSON dirty subsets. This is acceptable for Wave90 because heavy binaries are selective and the rewritten entries are lightweight JSON, but future workspace performance work can narrow text writes.
   - Evidence: `saveEditorWorkspace()` writes `result.savePlan.workspaceTextFileSet` at `apps/editor/src/features/workspace-storage/model/workspace-session-storage.ts:182`.
   - Domain A materializes the workspace text file-set at `packages/package-format/src/workspace-save-plan.ts:155`.

## Scope Review

I reviewed the required Wave90 basis documents, Domain A/B reports, all Domain A/B review lanes, and the current source/test implementation. I did not modify implementation files.

Final integration conclusion: Domain A and Domain B together satisfy the Wave90 plan scope.

## Integration Evidence

### 1. Domain A / B Scope

Pass. Domain A owns pure workspace metadata, file-set parsing, save-plan, and authoring-core save/open adapters. Domain B owns editor workspace storage, FSA wrapper, session integration, Header/Gate/Toolbox cleanup, routing cleanup, and guards.

- Workspace parser validates `workspace.json` and delegates package file-set validation: `packages/package-format/src/workspace-file-set.ts:72`.
- Workspace save-plan collects binary candidates and decisions: `packages/package-format/src/workspace-save-plan.ts:112`.
- Editor create/open/save calls the app workspace storage primitives: `apps/editor/src/features/workspace-storage/model/workspace-session-storage.ts:76`, `:105`, `:145`.

### 2. Boundary Escalation Resolution

Pass. The earlier parser/schema-validation boundary escalation is resolved through `authoring-core`; `apps/editor` does not directly depend on or import `@private-2d-rigging-lab/package-format`.

- `apps/editor/package.json:13` through `:20` lists editor dependencies and includes `authoring-core`, not `package-format`.
- `packages/authoring-core/package.json:9` through `:12` owns the `package-format` dependency.
- Editor open imports `openAuthoringWorkspaceFromTextFileSet()` from `authoring-core`: `apps/editor/src/features/workspace-storage/model/workspace-session-storage.ts:5`.
- The adapter calls Domain A parsing/schema validation: `packages/authoring-core/src/workspace-open.ts:53`.
- Invalid workspace metadata and invalid package file-set tests reject at the editor boundary: `apps/editor/src/features/workspace-storage/model/workspace-session-storage.test.ts:236`, `:258`.

Targeted scan result: `rg "@private-2d-rigging-lab/package-format" apps/editor apps/editor/package.json` returned no matches.

### 3. Heavy Binary Write Policy

Pass. Workspace Save does not rewrite verified heavy binaries every time.

- Domain A returns `skip` when existing workspace bytes verify: `packages/package-format/src/workspace-save-plan.ts:196`.
- Missing/corrupt workspace bytes write only after current session bytes verify: `packages/package-format/src/workspace-save-plan.ts:219`.
- Editor save writes binaries only for decisions whose action is `write`: `apps/editor/src/features/workspace-storage/model/workspace-directory-io.ts:208`.
- JSON-only dirty save skip coverage: `apps/editor/src/features/workspace-storage/model/workspace-session-storage.test.ts:132`.
- Digest-mismatched workspace binary rewrite coverage: `apps/editor/src/features/workspace-storage/model/workspace-session-storage.test.ts:159`.

### 4. Optional Source-Original Refs

Pass. Workspace Save intentionally excludes source-original binaries, and Open Workspace does not require absent source-original bytes.

- Source asset binary refs are excluded from workspace save candidates: `packages/package-format/src/workspace-save-plan.ts:119`.
- Texture refs remain workspace binary candidates: `packages/package-format/src/workspace-save-plan.ts:134`.
- `authoring-core` marks `source-original-v1` as optional and `texture-raster-v1` as required for workspace open: `packages/authoring-core/src/workspace-open.ts:103`, `:116`.
- Editor verifies only `requiredForWorkspaceOpen` targets: `apps/editor/src/features/workspace-storage/model/workspace-session-storage.ts:114`.
- Test coverage: optional missing source-original opens while texture bytes hydrate: `apps/editor/src/features/workspace-storage/model/workspace-session-storage.test.ts:215`.

### 5. PSD / Atlas Binary Responsibilities

Pass. PSD source bytes are not workspace-saved; extracted PSD layer raw RGBA and committed atlas raw RGBA are saved and verified through the texture binary path.

- PSD/source originals are excluded: `packages/package-format/src/workspace-save-plan.ts:119`.
- Texture/atlas refs are collected from committed texture atlas textures: `packages/package-format/src/workspace-save-plan.ts:134`.
- PSD import persists the post-commit session to the workspace: `apps/editor/src/features/editor-session/editor-session-context.tsx:1148`.
- Texture Atlas Apply persists the committed artifact session: `apps/editor/src/features/editor-session/editor-session-context.tsx:1188`.
- Provider-level write-once tests cover PSD raw RGBA and generated atlas raw RGBA: `apps/editor/src/features/editor-session/editor-session-context-history.test.ts:722`, `:772`.

### 6. Dirty Replacement Guard

Pass. Open Workspace and Portable JSON Import both pass through the dirty replacement guard.

- Guard implementation: `apps/editor/src/features/editor-session/editor-session-context.tsx:856`.
- Open Workspace calls the guard before picker/open: `apps/editor/src/features/editor-session/editor-session-context.tsx:941`.
- Portable JSON Import calls the guard before import/workspace creation: `apps/editor/src/features/editor-session/editor-session-context.tsx:1063`.
- Tests cover cancel before Open Workspace, save-and-open, and cancel before Portable JSON import: `apps/editor/src/features/editor-session/editor-session-context-history.test.ts:595`, `:633`, `:678`.

### 7. UI Responsibility Split

Pass. Workspace Gate/Header/Toolbox responsibilities match the Wave90 design.

- Gate buttons live in the AppBar when no workspace is open: `apps/editor/src/workspace/app-bar.tsx:75`.
- Editing surfaces and PSD modal are suppressed before workspace open: `apps/editor/src/workspace/authoring-workspace.tsx:44`, `:91`.
- Header owns Save, Save As, Open/Create Workspace, and Portable JSON import/export: `apps/editor/src/workspace/app-bar.tsx:146`, `:219`.
- Toolbox contains Select/Mesh/Rig/Dynamics, Import PSD, Parameters, Variants, Texture Atlas, Validate, and Viewer, with no Project Storage entry: `apps/editor/src/workspace/workspace-data.ts:31`.
- Neutral home route is `activeEntry: "workspace"`: `apps/editor/src/state/editor-ui-store.ts:26`.

Targeted scan result: `rg 'activeEntry.*import|activeEntry: "import"|setActiveEntry\("import"' apps/editor/src` returned no matches.

### 8. Dependency / Source / Operation Policy

Pass. I found no package dependency violation, no FSA leakage into packages, no new operation log persistence, and no runtime export scope creep.

- FSA picker/capability code is confined to the editor workspace-storage feature: `apps/editor/src/features/workspace-storage/model/workspace-directory-io.ts:88`.
- `workspace.json` remains entrypoint metadata beside the PackageDocument file-set: `packages/package-format/src/workspace-file-set.ts:53`.
- Derived metadata is warning/ignored and package refs plus verified files remain authoritative: `packages/package-format/src/workspace-file-set.ts:141`.
- `operations/log.jsonl` is rejected as workspace derived metadata by the focused test: `packages/package-format/src/workspace-file-set.test.ts:102`.
- `pnpm.cmd run check:deps` passed.
- `pnpm.cmd run check:source` passed.

### 9. Tests / Checks

Pass. The focused and broad checks are adequate for the Wave90 final integration gate.

Commands run in this final review:

- `pnpm.cmd typecheck`: pass.
- `pnpm.cmd run check:source`: pass.
- `pnpm.cmd run check:deps`: pass.
- Focused Wave90 Vitest suite:
  - sandbox attempt failed with known Vite/esbuild `spawn EPERM`;
  - escalated rerun passed: 14 files / 96 tests.
- `git diff --check -- .`: pass; Git reported LF/CRLF working-copy warnings only.

Focused Vitest files rerun:

- `packages/package-format/src/workspace-file-set.test.ts`
- `packages/package-format/src/workspace-save-plan.test.ts`
- `packages/authoring-core/src/workspace-save.test.ts`
- `packages/authoring-core/src/workspace-open.test.ts`
- `apps/editor/src/features/workspace-storage/model/workspace-session-storage.test.ts`
- `apps/editor/src/features/editor-session/editor-session-context-history.test.ts`
- `apps/editor/src/workspace/app-bar.test.ts`
- `apps/editor/src/workspace/toolbox/workspace-toolbox.test.ts`
- `apps/editor/src/workspace/authoring-workspace.test.ts`
- `apps/editor/src/workspace/project-storage/project-storage-screen.test.ts`
- `apps/editor/src/workspace/atlas/texture-atlas-task-screen.test.ts`
- `apps/editor/src/workspace/diagnostics/diagnostics-screen.test.ts`
- `apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts`
- `apps/editor/src/workspace/parameter-manager/parameter-manager-screen.test.ts`

## Final Verdict

`pass`

Wave90 is integrated cleanly. The prior Domain B boundary escalation is resolved, heavy workspace binaries are selectively written, source-original refs are not incorrectly required on open, PSD/Atlas binary responsibilities are consistent, dirty replacement guard applies to Open Workspace and Portable JSON Import, and Header/Toolbox/Gate responsibilities align with the accepted Workspace-first design.
