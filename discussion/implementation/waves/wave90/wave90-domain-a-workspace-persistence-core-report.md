# Wave90 Domain A Workspace Persistence Core Report

## Verdict

`pass`

Domain A `wave90-workspace-persistence-core` is complete enough for Domain B to start. The implementation adds browser-independent workspace persistence primitives in `package-format` and an `authoring-core` adapter, with three independent Review-Sylph lanes all returning `pass`.

## Scope Implemented

Package-format:

- `workspace.json` metadata contract in `packages/package-format/src/workspace-metadata.ts`.
- Workspace text file-set materialization/open parsing in `packages/package-format/src/workspace-file-set.ts`, reusing existing `PackageDocument` serializer/parser.
- Pure save-plan and binary decision contract in `packages/package-format/src/workspace-save-plan.ts`.
- Barrel exports in `packages/package-format/src/index.ts`.

Authoring-core:

- `createAuthoringWorkspaceSavePlan()` adapter in `packages/authoring-core/src/workspace-save.ts`.
- Barrel export in `packages/authoring-core/src/index.ts`.

Tests:

- `packages/package-format/src/workspace-file-set.test.ts`
- `packages/package-format/src/workspace-save-plan.test.ts`
- `packages/authoring-core/src/workspace-save.test.ts`

## Acceptance Evidence

- Workspace metadata is entrypoint-only metadata; no `project.json` or second package authority was added.
- Workspace text files reuse the existing `PackageDocument` file-set layout.
- Workspace open parsing rejects traversal, absolute paths, backslashes, and duplicate paths.
- Derived metadata is restricted to optional `metadata/binary-asset-index.json` and `metadata/byte-intake-summaries.json`; stale binary index metadata is warning/ignored and non-authoritative.
- Binary save decisions support `skip`, `write`, and `error`.
- Verified existing binaries are skipped.
- Missing/corrupt/mismatched existing binaries are written only after current session bytes verify against the `BinaryAssetReference`.
- Current session byte mismatch produces an error decision.
- PSD source original bytes are excluded from workspace binary candidates.
- Texture raw RGBA candidates are collected from committed package texture refs.
- Generated atlas raw RGBA is collected only after it is committed as a texture atlas artifact.
- `operations/log.jsonl` persistence was not added and is rejected as derived metadata.
- Browser File System Access API / `FileSystemDirectoryHandle` did not enter packages.

## Review Results

- Spec Compliance Review: `pass`
  - [../../reviews/wave90/wave90-domain-a-spec-compliance-review.md](../../reviews/wave90/wave90-domain-a-spec-compliance-review.md)
- Design / Development Compliance Review: `pass`
  - [../../reviews/wave90/wave90-domain-a-design-development-review.md](../../reviews/wave90/wave90-domain-a-design-development-review.md)
- Test Adequacy Review: `pass`
  - [../../reviews/wave90/wave90-domain-a-test-adequacy-review.md](../../reviews/wave90/wave90-domain-a-test-adequacy-review.md)

No blocking review findings were reported, so no fix loop was required.

## Verification

Run by Orch-Sylph after the review lanes completed:

- `pnpm.cmd exec vitest run packages/package-format/src/workspace-file-set.test.ts packages/package-format/src/workspace-save-plan.test.ts packages/authoring-core/src/workspace-save.test.ts`
  - sandbox attempt hit known Vitest/esbuild `spawn EPERM`;
  - escalated rerun passed: 3 files / 11 tests.
- `pnpm.cmd typecheck`: passed.
- `node scripts/check-source-organization.mjs`: passed.
- `node scripts/check-dependencies.mjs`: passed.
- `git diff --check -- packages/package-format/src packages/authoring-core/src`: passed; CRLF working-copy warnings only.
- `git diff --check --no-index -- NUL <new Domain A file>` loop for new untracked source/report files: no whitespace issues; CRLF working-copy warnings only.
- Scoped forbidden-term scan over Domain A changed files: no Browser FSA / `project.json` / `assets/atlas` / Runtime Export / temporary draft hits; the only `operations/log.jsonl` hit is the negative rejection test.

## Basis Coverage

Used directly:

- `discussion/implementation/orchestration/wave90-plan.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/operation-policy.md`
- `discussion/design/screen-design/screens/workspace-save-and-navigation.md`
- `discussion/design/screen-design/screens/authoring-workspace.md`
- `discussion/implementation/waves/wave88/wave88-final-integration-report.md`
- `discussion/implementation/waves/wave89/wave89-final-integration-report.md`

Skimmed / bounded to Domain A relevance:

- `discussion/design/screen-design/screens/project-storage-task.md`
- `discussion/design/screen-design/components/toolbox.md`

Deferred to Domain B:

- Browser FSA directory I/O and permission handling.
- Workspace Gate / Header / Toolbox UI integration.
- Portable JSON import/create-workspace transition.
- Dirty lightweight JSON selection at the app/session layer.

## Files Changed

- `packages/package-format/src/workspace-metadata.ts`
- `packages/package-format/src/workspace-file-set.ts`
- `packages/package-format/src/workspace-save-plan.ts`
- `packages/package-format/src/workspace-file-set.test.ts`
- `packages/package-format/src/workspace-save-plan.test.ts`
- `packages/package-format/src/index.ts`
- `packages/authoring-core/src/workspace-save.ts`
- `packages/authoring-core/src/workspace-save.test.ts`
- `packages/authoring-core/src/index.ts`
- `discussion/implementation/reviews/wave90/wave90-domain-a-spec-compliance-review.md`
- `discussion/implementation/reviews/wave90/wave90-domain-a-design-development-review.md`
- `discussion/implementation/reviews/wave90/wave90-domain-a-test-adequacy-review.md`
- `discussion/implementation/waves/wave90/wave90-domain-a-workspace-persistence-core-report.md`
- `discussion/implementation/waves/wave90/_map.md`
- `discussion/implementation/reviews/wave90/_map.md`

## Remaining Risks

- Domain A materializes the full workspace/package text file-set. Domain B must decide which lightweight JSON files to write for normal dirty saves.
- Domain B must correctly apply binary decisions and must not rewrite verified heavy binaries.
- Domain B still owns Browser File System Access capability detection, permission handling, directory traversal, fake-handle tests, Create/Open/Save/Save As workflows, and UI state.
- Optional derived metadata writers were not added. Parsing already treats supported derived metadata as warning/ignored.
- Future non-texture binary classes will need explicit candidate collection rules.

## Domain B Handoff

Domain A is safe for Domain B to start.

Domain B should consume:

- `serializeWorkspacePackageFileSet()`
- `parseWorkspacePackageDocumentFromFileSet()`
- `createWorkspaceSavePlan()`
- `createAuthoringWorkspaceSavePlan()`
- `WorkspaceBinarySaveDecision`

Domain B must keep Browser File System Access types and directory handles in the app layer and outside packages.
