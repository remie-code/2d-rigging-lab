# Wave35 Domain C Test Adequacy Review

Date: 2026-06-03

verdict: `pass`

Review lane: Test Adequacy Review

Target: `wave35-validator-persistent-storage-availability-diagnostics`

## Scope Reviewed

- `packages/validator-core/src/validators/persistent-byte-availability-diagnostics.ts`
- `packages/validator-core/src/validators/byte-intake-preflight.ts`
- `packages/validator-core/src/check-catalog.ts`
- `packages/validator-core/src/persistent-byte-availability.test.ts`
- `discussion/design/module-contracts/validator-contract.md`
- `discussion/implementation/waves/wave35/wave35-domain-c-validator-persistent-storage-availability-diagnostics-completion-report.md`

Scope attribution note:

- A scoped `git status --short -uall -- ...` during this review showed Domain C source/test/doc files plus untracked `apps/editor/src/editor-session/indexeddb-persistent-byte-store.ts` and `apps/editor/src/editor-session/persistent-byte-store.ts`.
- Per Orch-Sylph's status note, the `apps/editor/**` entries appeared after the immediate post-Gnome status and are treated as concurrent Domain B/editor worktree movement, not Domain C changes. I did not use those files as Domain C evidence.

## Basis Documents Used

- `discussion/implementation/orchestration/wave35-plan.md`
- `discussion/design/module-contracts/package-file-format-contract.md`
- `discussion/design/module-contracts/validator-contract.md`
- `packages/package-format/src/persistent-binary-storage-contract.ts`
- `packages/package-format/src/persistent-binary-storage.ts`
- `packages/package-format/src/persistent-binary-storage.test.ts`
- `packages/validator-core/src/binary-asset-validator.test.ts`
- `packages/validator-core/src/byte-intake-availability.test.ts`
- `packages/validator-core/src/wave34-byte-availability-direct-call-fixture.test.ts`
- `discussion/implementation/waves/wave35/wave35-domain-a-persistent-binary-storage-contract-foundation-completion-report.md`
- `discussion/implementation/reviews/wave35/wave35-domain-a-test-adequacy-review.md`

Key basis points checked directly:

- Wave35 limits the work to same-origin browser-local persistent bytes and explicitly excludes archive import/export, PSD/parser work, PNG/image decode, File System Access API, drag-drop, and external dependencies (`discussion/implementation/orchestration/wave35-plan.md:10-11`, `:48-52`).
- Domain C is validator-core focused and must not implement the Editor IndexedDB adapter or UI (`discussion/implementation/orchestration/wave35-plan.md:100`, `:177-191`).
- Domain C success requires valid verified browser-local stored bytes to pass, while missing/corrupt/stale persistent evidence emits stable diagnostics (`discussion/implementation/orchestration/wave35-plan.md:197-198`).
- The validator contract now states that `persistentByteStorage.*` checks are deterministic byte-intake persistent storage diagnostics and do not claim archive, File System Access API, parser, or image decode support (`discussion/design/module-contracts/validator-contract.md:237-240`).
- Domain A's contract defines the available persistent storage issue codes and report shape (`packages/package-format/src/persistent-binary-storage-contract.ts:82-95`, `:147-168`), and its evaluator generates deterministic issues from backend state, stored record, and re-read verification evidence (`packages/package-format/src/persistent-binary-storage.ts:91-105`, `:148-163`, `:165-279`, `:282-308`, `:370-428`).

## Findings

No blocking or needs-change findings.

### Coverage of Required Domain C Cases

Status: adequate.

The focused Domain C tests directly cover the required pass/failure surface:

- valid verified browser-local stored bytes without current-session raw bytes produce no checks (`packages/validator-core/src/persistent-byte-availability.test.ts:50-75`);
- expected persistent storage with no stored record emits `persistentByteStorage.record.missing` and asserts deterministic evidence including availability, backend, backend state, record status, verification status, reupload flag, issue source, expected, and actual (`packages/validator-core/src/persistent-byte-availability.test.ts:77-114`);
- persistent record whose re-read bytes are missing emits `persistentByteStorage.bytes.missing` with deterministic verification-report target path and missing actual byte length evidence (`packages/validator-core/src/persistent-byte-availability.test.ts:116-155`);
- corrupt re-read bytes emit `persistentByteStorage.byteLength.mismatch` and `persistentByteStorage.digest.mismatch`, and the test asserts no parser/archive/decode/raster wording in message or impact (`packages/validator-core/src/persistent-byte-availability.test.ts:157-209`);
- stale package revision plus binary metadata mismatch emits stable `packageRevision`, `binaryAssetRef`, `digest`, `byteLength`, and `verification.missing` diagnostics in exact order, with target-path evidence checks (`packages/validator-core/src/persistent-byte-availability.test.ts:211-266`);
- unavailable and unsupported backend states both emit `persistentByteStorage.backend.unavailable` plus `record.missing`, with deterministic backend-state evidence (`packages/validator-core/src/persistent-byte-availability.test.ts:268-306`).

The tests also register every Domain A `persistentByteStorage.*` issue ID in the check catalog (`packages/validator-core/src/persistent-byte-availability.test.ts:33-48`), matching the catalog entries added in `packages/validator-core/src/check-catalog.ts:388-484`.

### Diagnostic ID and Evidence Stability

Status: adequate.

The tests do not merely assert "some failure." They assert exact `checkId` sequences for each required case (`packages/validator-core/src/persistent-byte-availability.test.ts:95-97`, `:140-142`, `:182-185`, `:237-243`, `:291-294`) and use `expectPersistentByteAvailabilityCheck` to pin:

- `checkId`, `status`, `severity`, `phase`, `target`, and `targetPath`;
- `persistentIssueCode`;
- `persistentIssueTargetPath`;
- `packageId`;
- `packageRevision`;
- case-specific evidence values.

Helper coverage is at `packages/validator-core/src/persistent-byte-availability.test.ts:372-418`.

The implementation maps Domain A issue codes directly into validator check IDs and emits stable evidence fields for report availability/status, backend state, record status, verification status, reupload requirement, issue source/target, expected/actual values, package identity/revision, digest, byteLength, mediaType, storedAt, and verifiedAt (`packages/validator-core/src/validators/persistent-byte-availability-diagnostics.ts:96-141`).

### Integration With Existing Byte Availability Tests

Status: adequate.

The byte-intake preflight extension is narrow: persistent evidence fields are added to the existing asset input type (`packages/validator-core/src/validators/byte-intake-preflight.ts:44`), persistent diagnostics run first when evidence exists (`packages/validator-core/src/validators/byte-intake-preflight.ts:123-130`), and current-session byte availability remains the fallback when no persistent evidence is present (`packages/validator-core/src/validators/byte-intake-preflight.ts:128-133`).

Adjacent tests still run and preserve existing oracles:

- `byte-intake-availability.test.ts` keeps current-session availability pass, missing, stale summary, metadata mismatch, and requires-reupload diagnostics pinned (`packages/validator-core/src/byte-intake-availability.test.ts:31-341`);
- `binary-asset-validator.test.ts` keeps binary asset validation and byte-intake unsupported parser/decode/archive claim behavior pinned (`packages/validator-core/src/binary-asset-validator.test.ts:35-496`);
- `wave34-byte-availability-direct-call-fixture.test.ts` keeps the Wave34 deterministic fixture summary pinned (`packages/validator-core/src/wave34-byte-availability-direct-call-fixture.test.ts:19-65`).

### Forbidden Oracle / Dependency Containment

Status: adequate.

The Domain C tests use package-format helpers and validator-core only (`packages/validator-core/src/persistent-byte-availability.test.ts:7-24`). They do not require editor IndexedDB, E2E, archive handling, File System Access API, parser support, image decode, external dependencies, Cubism/full renderer behavior, or a pixel oracle.

A forbidden-term scan over Domain C files found hits limited to:

- explicit non-goal documentation/report wording;
- existing byte-intake unsupported-claim wording;
- the valid `indexeddb-same-origin-browser-local-v1` backend evidence string;
- negative assertions ensuring parser/archive/decode/raster claims are absent.

No implementation dependency on the forbidden surfaces was found.

## Verification Performed

- `git diff -- packages/validator-core/src/validators/persistent-byte-availability-diagnostics.ts packages/validator-core/src/validators/byte-intake-preflight.ts packages/validator-core/src/check-catalog.ts packages/validator-core/src/persistent-byte-availability.test.ts discussion/design/module-contracts/validator-contract.md`
  - Read directly. Because new Domain C files are untracked, I also read `persistent-byte-availability-diagnostics.ts` and `persistent-byte-availability.test.ts` directly by path.
- `pnpm.cmd exec vitest run packages/validator-core/src/persistent-byte-availability.test.ts packages/validator-core/src/byte-intake-availability.test.ts packages/validator-core/src/binary-asset-validator.test.ts`
  - pass, 3 files / 22 tests.
- `pnpm.cmd exec vitest run packages/validator-core/src/wave34-byte-availability-direct-call-fixture.test.ts`
  - pass, 1 file / 1 test.
- `rg -n -i "indexeddb|archive|file system access|filesystem|drag|parser|decode|renderer|pixel|cubism|dependency|localstorage|base64|zip|e2e|playwright|browser" ...`
  - Domain C source/test hits were limited to allowed evidence strings, existing unsupported-claim wording, negative assertions, and non-goal documentation.

Environment note:

- Sandboxed command startup failed with `windows sandbox: spawn setup refresh`; read-only inspection and focused Vitest commands were therefore run through the approved escalated command path.

## Remaining Test Gaps / Residual Risk

No blocking Domain C test gap.

Non-blocking residuals:

- Domain C's focused validator tests do not directly construct every registered Domain A issue code as a validator check. The rubric-required cases are covered directly, while Domain A already covers constructible unverified, stale metadata, corrupt, and missing verification evaluator branches (`packages/package-format/src/persistent-binary-storage.test.ts:173-220`, `:223-314`, `:318-358`).
- `persistentByteStorage.backend.mismatch` remains catalog-registered but is currently unreachable through valid DTOs because Domain A has one valid backend enum value, `indexeddb-same-origin-browser-local-v1`; Domain A's test adequacy review accepted that as a non-blocking defensive branch (`discussion/implementation/reviews/wave35/wave35-domain-a-test-adequacy-review.md:63-69`).
- Direct `persistentByteStorage.digest.unsupported` validator coverage would require an unsupported SHA-256 environment or an injected evaluator fixture. Current tests cover the normal supported environment and catalog registration. Add a direct adapter test only if the validator mapper stops being generic or the package-format contract adds a test hook for unsupported digest evidence.

## User-Decision Points

None for Domain C.

Future user decisions are needed only if later work expands beyond same-origin browser-local IndexedDB evidence into archive persistence, File System Access API, cloud/cross-origin guarantees, parser/image decode dependencies, Cubism compatibility, full renderer behavior, or pixel oracle claims.

## Clean Review Confirmation

This was a clean, grounded test adequacy review. I read the basis documents, Domain C diff/files, Domain A contract/evaluator/tests/review, adjacent validator tests, and verification output directly. I did not rely on Gnome's completion report as the only source. I did not edit source implementation files. The only file written by this review is `discussion/implementation/reviews/wave35/wave35-domain-c-test-adequacy-review.md`.
