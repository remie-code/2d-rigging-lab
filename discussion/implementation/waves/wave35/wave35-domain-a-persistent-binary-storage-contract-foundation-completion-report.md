# Wave35 Domain A Completion Report: Persistent Binary Storage Contract Foundation

Date: 2026-06-03

verdict: `pass`

## Scope

Domain A fixed the additive package-format contract foundation for same-origin
browser-local persistent binary storage evidence.

Implemented source boundaries:

- `persistent-binary-storage-contract.ts` owns the Zod DTO contract for IndexedDB
  browser-local persistent byte records, backend state, availability reports, and
  issue evidence.
- `persistent-binary-storage.ts` owns record creation and deterministic
  availability evaluation against an expected binary asset reference, package
  identity, package revision, optional stored record, storage backend state, and
  optional verification report.
- `persistent-binary-storage.test.ts` pins available, unavailable, stale, corrupt,
  and non-portable evidence behavior.
- `index.ts` only adds barrel exports.

## Fix Loop 1 Test Adequacy Update

Review-Sylph requested direct coverage for unverified stored records and stale
stored-record metadata variants beyond package revision mismatch.

Added focused test coverage for:

- a current stored record with `verifiedAt` but without a re-read persistent
  verification report, which remains unavailable and requires reupload
- an unverified stored record without `verifiedAt`, which reports
  `persistentByteStorage.record.unverified`
- stale stored-record metadata for package identity, binary asset id/path,
  digest, byteLength, and mediaType mismatch
- rejection of unsupported storage backend values, preserving the current
  IndexedDB-only contract boundary

No source changes were needed for these coverage additions.

Backend mismatch branch note: the current Domain A contract has exactly one valid
storage backend, `indexeddb-same-origin-browser-local-v1`. A valid stored record
cannot currently carry a different backend, so directly exercising
`persistentByteStorage.backend.mismatch` would require adding a second backend
enum value. I did not add a speculative backend in this fix loop.

## Contract Evidence

The stored byte record represents:

- package identity
- package revision
- binary asset id
- package-relative binary asset path
- digest
- byteLength
- mediaType
- storage backend
- storedAt
- verifiedAt when available

The availability report represents:

- expected binary asset metadata
- browser-local storage backend and backend state
- stored record status
- persistent verification status
- unavailable, corrupt, stale, verification-unsupported, and available outcomes
- requiresReupload
- storedAt and verifiedAt evidence where present
- actual digest, byteLength, and mediaType evidence where re-read verification
  supplies it
- stable `persistentByteStorage.*` issue evidence for later validator mapping

The only storage backend value introduced is
`indexeddb-same-origin-browser-local-v1`. The contract does not expose an
archive path, raw-byte payload, base64 payload, File System Access API handle,
or portable package persistence claim.

## Verification

Performed:

- `pnpm.cmd exec vitest run packages/package-format/src/persistent-binary-storage.test.ts`
  - pass, 1 file / 6 tests after fix loop 1
- `pnpm.cmd typecheck`
  - pass
- `git diff --check -- packages\package-format\src\persistent-binary-storage-contract.ts packages\package-format\src\persistent-binary-storage.ts packages\package-format\src\persistent-binary-storage.test.ts packages\package-format\src\index.ts discussion\implementation\waves\wave35`
  - pass; Git emitted the existing LF-to-CRLF working-copy warning for
    `packages/package-format/src/index.ts`
- Manifest and lockfile diff check for root/workspace/editor/package-format/contracts
  manifests and `pnpm-lock.yaml`
  - empty
- Forbidden-scope scan over the Domain A source/test/report paths for archive,
  File System Access API, drag-drop, parser, image decode, external dependency,
  Cubism, full renderer, pixel oracle, localStorage, base64 payload, and zip terms
  - only negative contract tests for rejected `bytesBase64`, `archivePath`, and
    portable archive claims were found

Note: the local sandbox command startup failed with `windows sandbox: spawn setup
refresh`, so read-only inspection and verification commands were run through the
approved escalated command path.

## Non-Goals Kept Out

Domain A did not implement:

- Editor IndexedDB adapter or session restore
- Validator diagnostics
- e2e smoke coverage
- package archive import/export
- File System Access API
- drag-drop
- parser or image decode
- external dependency, package manifest, or lockfile changes
- Cubism SDK/Core or compatibility behavior
- full renderer or pixel oracle

## Source Organization

No catch-all source file was introduced.

`packages/package-format/src/index.ts` remains barrel-only and contains only
exports.

## Residual Risks

- The contract intentionally represents same-origin browser-local persistent
  storage evidence only. It is not a portable package/archive contract.
- The Editor IndexedDB adapter and Validator diagnostic mapping are still future
  Domain B/C work and should consume this contract rather than redefining it.
- Storage quota, private browsing behavior, cross-origin movement, and product
  guarantee wording remain outside Domain A; the current contract stays at
  best-effort same-origin IndexedDB evidence.

## User Decision Points

None for Domain A.

Future decisions are required only if later domains need to move beyond
best-effort same-origin IndexedDB into archive persistence, filesystem APIs,
cloud storage, parser/image decode dependencies, or cross-origin guarantees.
