# Wave90 Domain A Design / Development Compliance Review

## Verdict

`pass`

No blocking or needs-change findings were found for Domain A design/development compliance.

## Scope Reviewed

Changed Domain A source/tests reviewed directly:

- `packages/package-format/src/workspace-metadata.ts`
- `packages/package-format/src/workspace-file-set.ts`
- `packages/package-format/src/workspace-save-plan.ts`
- `packages/package-format/src/workspace-file-set.test.ts`
- `packages/package-format/src/workspace-save-plan.test.ts`
- `packages/package-format/src/index.ts`
- `packages/authoring-core/src/workspace-save.ts`
- `packages/authoring-core/src/workspace-save.test.ts`
- `packages/authoring-core/src/index.ts`

Basis documents reviewed:

- `discussion/implementation/orchestration/wave90-plan.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/operation-policy.md`
- `discussion/design/screen-design/screens/workspace-save-and-navigation.md`
- `discussion/implementation/waves/wave88/wave88-final-integration-report.md`
- `discussion/implementation/waves/wave89/wave89-final-integration-report.md`

## Findings

No blocking or needs-change findings.

## Compliance Evidence

Package boundary compliance:

- `package-format` owns workspace metadata/file-set/save-plan primitives and does not import `authoring-core` or app code: `packages/package-format/src/workspace-metadata.ts:5`, `packages/package-format/src/workspace-file-set.ts:4`, `packages/package-format/src/workspace-save-plan.ts:5`.
- `authoring-core` only adapts an `AuthoringSession` to the `package-format` save-plan contract: `packages/authoring-core/src/workspace-save.ts:1`, `packages/authoring-core/src/workspace-save.ts:10`, `packages/authoring-core/src/workspace-save.ts:28`.
- No `apps/editor`, `packages/runtime-core`, `packages/validator-core`, package manifest, or lockfile changes were present in `git status --short -uall -- apps/editor packages/runtime-core packages/validator-core package.json pnpm-lock.yaml pnpm-workspace.yaml`.

Browser/FSA boundary:

- Targeted scan for `FileSystem`, picker APIs, DOM globals, browser storage, `Blob`, and object URL usage in the changed Domain A source/tests found no matches.
- The package APIs use in-memory text/binary entries and package DTOs rather than browser handles: `packages/package-format/src/workspace-save-plan.ts:89`, `packages/package-format/src/workspace-file-set.ts:34`, `packages/authoring-core/src/workspace-save.ts:14`.

Source organization:

- New production files are focused by responsibility: metadata (`workspace-metadata.ts`), file-set materialization/parsing (`workspace-file-set.ts`), save planning/binary decisions (`workspace-save-plan.ts`), and authoring adapter (`workspace-save.ts`).
- `index.ts` changes are barrel-only re-exports: `packages/package-format/src/index.ts:29`, `packages/package-format/src/index.ts:30`, `packages/package-format/src/index.ts:31`, `packages/authoring-core/src/index.ts:8`.
- `node scripts/check-source-organization.mjs` passed.

Workspace metadata and PackageDocument authority:

- `workspace.json` is entrypoint metadata with package identity/display fields derived from `PackageDocument`, not a second project aggregate: `packages/package-format/src/workspace-metadata.ts:10`, `packages/package-format/src/workspace-metadata.ts:26`.
- Workspace serialization delegates package body materialization to `serializePackageDocumentToFileSet()`: `packages/package-format/src/workspace-file-set.ts:61`.
- Workspace parsing delegates authoritative package reconstruction to `parsePackageDocumentFromFileSet()` and filters only workspace metadata/derived metadata around it: `packages/package-format/src/workspace-file-set.ts:82`, `packages/package-format/src/workspace-file-set.ts:85`.
- Derived metadata paths are limited to `metadata/binary-asset-index.json` and `metadata/byte-intake-summaries.json`, and parse returns warnings that PackageDocument refs plus verified files are authoritative: `packages/package-format/src/workspace-file-set.ts:19`, `packages/package-format/src/workspace-file-set.ts:141`.
- Stale derived binary metadata is covered by test as warning-only, not authoritative input: `packages/package-format/src/workspace-file-set.test.ts:65`.

Mutation gateway and operation log persistence:

- Domain A save planning does not mutate package contents; it validates/serializes the current package document and emits text file sets plus binary decisions: `packages/package-format/src/workspace-save-plan.ts:155`, `packages/package-format/src/workspace-save-plan.ts:181`.
- `createAuthoringWorkspaceSavePlan()` serializes the current authoring session to a `PackageDocument` and calls the pure package-format save planner; it does not introduce package mutation operations: `packages/authoring-core/src/workspace-save.ts:31`, `packages/authoring-core/src/workspace-save.ts:38`.
- Workspace serialization does not pass `operationLogText` to the package file-set serializer, and derived metadata explicitly rejects `operations/log.jsonl`: `packages/package-format/src/workspace-file-set.ts:61`, `packages/package-format/src/workspace-file-set.test.ts:102`.

Path guard strategy:

- Workspace file-set parsing indexes every input path through existing `assertPackageRelativePath()`: `packages/package-format/src/workspace-file-set.ts:99`, `packages/package-format/src/workspace-file-set.ts:103`.
- Workspace serialization and duplicate checks use existing `assertPackageRelativePath()` / `assertUniquePackageFilePaths()`: `packages/package-format/src/workspace-file-set.ts:67`, `packages/package-format/src/workspace-file-set.ts:115`.
- Binary decision setup uses existing package binary file-set helpers, which normalize paths and verify binary refs: `packages/package-format/src/workspace-save-plan.ts:5`, `packages/package-format/src/workspace-save-plan.ts:165`.
- Path traversal, absolute path, backslash, and duplicate path rejection are covered by tests: `packages/package-format/src/workspace-file-set.test.ts:35`.

Heavy binary policy:

- Verified existing binaries are skipped, missing/mismatched binaries write only after session-byte verification, and bad session bytes error: `packages/package-format/src/workspace-save-plan.ts:196`, `packages/package-format/src/workspace-save-plan.ts:201`, `packages/package-format/src/workspace-save-plan.ts:219`.
- PSD/source original binary refs are excluded from workspace save candidates, while texture refs are candidates: `packages/package-format/src/workspace-save-plan.ts:119`, `packages/package-format/src/workspace-save-plan.ts:134`.
- Tests cover skip/write/rewrite/error, PSD source byte exclusion, and committed atlas binary collection: `packages/package-format/src/workspace-save-plan.test.ts:24`, `packages/package-format/src/workspace-save-plan.test.ts:40`, `packages/package-format/src/workspace-save-plan.test.ts:57`, `packages/package-format/src/workspace-save-plan.test.ts:98`, `packages/package-format/src/workspace-save-plan.test.ts:116`, `packages/package-format/src/workspace-save-plan.test.ts:148`.

## Verification Performed

- Reviewed the basis documents and changed source/tests directly.
- `git status --short -uall`: inspected dirty/untracked scope.
- `git status --short -uall -- apps/editor packages/runtime-core packages/validator-core package.json pnpm-lock.yaml pnpm-workspace.yaml`: no output.
- Targeted browser/FSA API scan over changed Domain A source/tests: no matches.
- `pnpm.cmd exec vitest run packages/package-format/src/workspace-file-set.test.ts packages/package-format/src/workspace-save-plan.test.ts packages/authoring-core/src/workspace-save.test.ts`
  - sandbox run failed with known Vitest/esbuild `spawn EPERM`;
  - escalated rerun passed: 3 files, 11 tests.
- `pnpm.cmd typecheck`: passed.
- `node scripts/check-source-organization.mjs`: passed.
- `node scripts/check-dependencies.mjs`: passed.
- `git diff --check -- <Domain A changed files>`: passed; LF/CRLF working-copy warnings only for the two touched `index.ts` files.

## Remaining Risks

- Domain A does not implement app-layer directory traversal, FSA permission handling, or dirty lightweight JSON selection. Those are intentionally Domain B responsibilities.
- `workspaceTextFileSet` currently materializes all package text files. The design allows normal Save to focus on dirty lightweight JSON, but dirty-file selection is expected to be applied by the app/session layer in later integration.
- Binary candidates are currently derived from `PackageDocument.assets.textureAtlas.textures` and source originals are excluded. Future non-texture workspace binary classes, if added, will need explicit candidate collection rules.

## User-Decision Points

None blocking for Domain A.
