# Wave35 Domain B Completion Report: Editor IndexedDB Byte Store and Session Restore

Date: 2026-06-03

verdict: `pass`

## Scope

Domain B adds Editor-side same-origin browser-local persistent byte storage and
async session restore using the Domain A persistent binary storage contract.

Existing Domain B implementation and test artifacts accepted by this recovery:

- `apps/editor/src/editor-session/index.ts`
- `apps/editor/src/editor-session/persistent-byte-store.ts`
- `apps/editor/src/editor-session/indexeddb-persistent-byte-store.ts`
- `apps/editor/src/editor-session/indexeddb-persistent-byte-store.test.ts`
- `apps/editor/src/editor-session/persistent-byte-restore.ts`
- `apps/editor/src/editor-workflow/workflow-controller.ts`
- `apps/editor/src/editor-workflow/workflow-state-projection.ts`
- `apps/editor/src/editor-workflow/workflow-persistent-byte-restore.test.ts`
- `apps/editor/src/editor-state/binary-byte-intake-state.test.ts`

Recovery report artifacts:

- `discussion/implementation/waves/wave35/wave35-domain-b-editor-indexeddb-byte-store-session-restore-completion-report.md`
- `discussion/implementation/waves/wave35/wave35-domain-b-orch-sylph-final-report.md`

## Implementation Summary

- Added a focused Editor persistent byte store API and IndexedDB-backed adapter
  for `indexeddb-same-origin-browser-local-v1` records.
- Stores selected source binary bytes after committed file intake, using current
  package identity, package revision, binary asset id/path, digest, byteLength,
  mediaType, backend, `storedAt`, and `verifiedAt` evidence.
- Adds async `loadProjectWithPersistentBytes()` alongside the existing
  synchronous `loadProject()` path. The sync path remains metadata-only and does
  not restore raw bytes.
- On async load, reads stored bytes from IndexedDB, verifies digest and
  byteLength through the existing package binary verification path, evaluates
  Domain A persistent availability, and registers bytes into the authoring
  session only when verification and availability both pass.
- Missing store, unavailable IndexedDB, missing stored bytes, unreadable stored
  values, digest mismatch, byteLength mismatch, stale package identity, and
  stale package revision remain truthful fallback paths that require reupload.
- Saved browser-local project data remains metadata-only; raw bytes are not
  serialized into saved project JSON, operation log JSONL, editor state JSON,
  workflow state JSON, or browser-storage values.

Domain B did not implement archive persistence, File System Access API,
directory picker, drag-drop, parser behavior, image decode behavior, external
dependencies, Cubism compatibility, full renderer behavior, or pixel oracle
behavior.

## Review-Gate Confirmation

Existing clean Review-Sylph artifacts were inspected and accepted:

- `discussion/implementation/reviews/wave35/wave35-domain-b-design-development-compliance-review.md`
  - verdict: `pass`
  - findings: no blocking findings
  - notes: Domain B stayed inside the allowed Editor session/workflow/state
    scope, consumed Domain A package-format APIs read-only, kept `index.ts`
    barrel-only, and introduced no forbidden feature implementation or claims.
- `discussion/implementation/reviews/wave35/wave35-domain-b-test-adequacy-review.md`
  - verdict: `pass`
  - findings: none after fix loop 1 re-review
  - notes: tests now cover the real IndexedDB adapter roundtrip with an
    injected `IDBFactory`, sync metadata-only load behavior, stale identity and
    stale revision fallback, and raw-byte/base64 sentinel absence.

The original Domain B agent failed while returning because of an unrelated
tool/model error (`The model 'gpt-image-2' does not exist.`). This recovery did
not find a source or test blocker requiring a new implementation loop.

## Verification

Orch-Sylph reran and confirmed:

- `pnpm.cmd exec vitest run apps/editor/src/editor-session/indexeddb-persistent-byte-store.test.ts apps/editor/src/editor-workflow/workflow-persistent-byte-restore.test.ts apps/editor/src/editor-state/binary-byte-intake-state.test.ts`
  - pass, 3 files / 18 tests
- `pnpm.cmd typecheck`
  - pass
- `git diff --check -- apps\editor\src\editor-session\index.ts apps\editor\src\editor-session\persistent-byte-store.ts apps\editor\src\editor-session\indexeddb-persistent-byte-store.ts apps\editor\src\editor-session\indexeddb-persistent-byte-store.test.ts apps\editor\src\editor-session\persistent-byte-restore.ts apps\editor\src\editor-workflow\workflow-controller.ts apps\editor\src\editor-workflow\workflow-state-projection.ts apps\editor\src\editor-workflow\workflow-persistent-byte-restore.test.ts apps\editor\src\editor-state\binary-byte-intake-state.test.ts`
  - pass; Git emitted LF-to-CRLF working-copy warnings for tracked Domain B
    files only
- Direct whitespace/conflict-marker scan for untracked new Domain B files:
  `rg -n "[ \t]$|^<<<<<<<|^=======|^>>>>>>>" apps\editor\src\editor-session\persistent-byte-store.ts apps\editor\src\editor-session\indexeddb-persistent-byte-store.ts apps\editor\src\editor-session\indexeddb-persistent-byte-store.test.ts apps\editor\src\editor-session\persistent-byte-restore.ts apps\editor\src\editor-workflow\workflow-persistent-byte-restore.test.ts`
  - no matches; `rg` exited 1 because nothing matched
- Dependency manifest/lockfile diff check over root/workspace/editor,
  package-format, contracts, validator-core, and operation-core manifests plus
  `pnpm-lock.yaml`
  - empty
- Domain A/C dependency report verdict check
  - Domain A completion/final reports: `pass`
  - Domain C completion/final reports: `pass`
- Forbidden-scope status check over package manifests, `packages/contracts`,
  `packages/operation-core`, `fixtures/contracts`, `apps/editor/e2e`,
  `packages/package-format`, and `packages/validator-core`
  - only pre-existing parallel Domain A package-format and Domain C
    validator-core source/test changes were present; this Domain B recovery did
    not edit those paths
- Forbidden-term scan over Domain B source/test files
  - hits were limited to intended negative raw-byte/base64 assertions; no
    archive, File System Access API, directory picker, drag-drop, parser, image
    decode, external dependency, Cubism, full renderer, or pixel oracle
    implementation was introduced

Environment note: sandboxed PowerShell startup failed with
`windows sandbox: spawn setup refresh`, so required inspection and verification
commands were run through the approved escalated command path.

## Non-Goals Kept Out

Domain B did not implement:

- validator-core diagnostics
- e2e browser smoke coverage
- archive import/export
- File System Access API
- directory picker or drag-drop intake
- parser or image decode behavior
- external dependency, package manifest, or lockfile changes
- Cubism SDK/Core or compatibility behavior
- full renderer or pixel oracle behavior
- implementation logic in `index.ts`

## Source Organization

No catch-all source file was introduced.

`apps/editor/src/editor-session/index.ts` remains barrel-only and contains only
exports. Persistent byte store API, IndexedDB adapter behavior, and restore
orchestration live in separate responsibility files.

## Residual Risks

- Real-browser IndexedDB desktop/mobile smoke remains Domain D scope.
- The current app UI still uses the synchronous metadata-only load path; async
  user-facing restore wiring remains Domain D scope.
- IndexedDB storage remains same-origin browser-local best-effort evidence. It
  is not portable package/archive persistence, filesystem persistence, cloud
  persistence, or a cross-origin guarantee.
- The IndexedDB adapter returns `stored` after the successful `put` request; a
  future hardening pass may wait for explicit transaction completion, but restore
  still re-reads and verifies bytes before availability.

## User Decision Points

None for Domain B.

Escalation is needed only if later work expands beyond same-origin
browser-local IndexedDB evidence into archive persistence, filesystem/cloud
guarantees, File System Access API, directory picker, drag-drop, parser/image
decode dependencies, Cubism compatibility, full renderer behavior, pixel oracle
claims, or raw-byte serialization into browser-local project JSON.

