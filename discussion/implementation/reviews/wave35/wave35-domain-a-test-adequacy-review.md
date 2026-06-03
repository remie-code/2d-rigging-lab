# Wave35 Domain A Test Adequacy Re-Review

Date: 2026-06-03

verdict: `pass`

## Scope Reviewed

- `packages/package-format/src/persistent-binary-storage-contract.ts`
- `packages/package-format/src/persistent-binary-storage.ts`
- `packages/package-format/src/persistent-binary-storage.test.ts`
- `packages/package-format/src/index.ts`
- `discussion/implementation/waves/wave35/wave35-domain-a-persistent-binary-storage-contract-foundation-completion-report.md`
- Historical evidence only: `discussion/implementation/waves/wave35/wave35-domain-a-persistent-binary-storage-contract-foundation-blocked-report.md`

Known unrelated dirty state was not treated as this review target:

- `discussion/implementation/orchestration/_map.md`
- `discussion/implementation/orchestration/wave35-plan.md`

## Basis Documents Used

- `discussion/implementation/orchestration/wave35-plan.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/schema-and-id-conventions.md`
- `discussion/design/module-contracts/package-file-format-contract.md`
- `discussion/implementation/waves/wave31/wave31-final-report.md`
- `discussion/implementation/reviews/wave31/wave31-clean-integration-review.md`
- `discussion/implementation/waves/wave34/wave34-final-report.md`
- `discussion/implementation/reviews/wave34/wave34-clean-integration-review.md`

Key basis points checked directly:

- Wave35 limits persistent storage to browser-native IndexedDB, same-origin/browser-profile local use, no archive/filesystem picker/base64 project serialization, and no dependency/manifest/lockfile changes (`wave35-plan.md:47-52`).
- Domain A must fix package-format persistent binary storage evidence for package identity, package revision, binary asset id/path, digest, byteLength, mediaType, backend, storedAt, and verifiedAt (`wave35-plan.md:114-140`).
- Domain A forbids editor IndexedDB implementation, broad validator implementation, archive/File System Access/parser/image decode implementation, dependency changes, and implementation logic in `index.ts` (`wave35-plan.md:130-136`).
- Prior Wave31/Wave34 evidence established current-session byte truthfulness and reupload behavior, while persistent binary storage remained future scope.

## Findings

No blocking findings remain.

### Original finding 1: current-record verification-missing and unverified-record branches

Status: addressed.

The updated focused tests now cover:

- a current stored record with `verifiedAt` but no re-read persistent verification report, expecting unavailable availability, `recordStatus: "current-v1"`, `persistentVerificationStatus: "not-supplied-v1"`, `requiresReupload: true`, and `persistentByteStorage.verification.missing` (`packages/package-format/src/persistent-binary-storage.test.ts:173-206`);
- a stored record without `verifiedAt`, expecting `recordStatus: "unverified-v1"`, no `verifiedAt` on the report, `requiresReupload: true`, and both `persistentByteStorage.record.unverified` and `persistentByteStorage.verification.missing` (`packages/package-format/src/persistent-binary-storage.test.ts:207-220`).

This directly pins the Domain A rule that browser-local persistent bytes are not available until stored bytes are re-read and verified.

### Original finding 2: stale metadata coverage only exercised package revision

Status: addressed for the constructible Domain A metadata surface.

The updated stale metadata table covers packageId, binary asset id/path, digest, byteLength, and mediaType mismatches as stale stored-record metadata (`packages/package-format/src/persistent-binary-storage.test.ts:223-314`). Each case asserts stale availability, `recordStatus: "stale-v1"`, `requiresReupload: true`, the expected stale issue code, and missing verification evidence.

The package revision stale case remains covered separately (`packages/package-format/src/persistent-binary-storage.test.ts:128-170`).

### Backend mismatch branch

Status: accepted as an unreachable defensive branch under the current Domain A contract.

`PackageBinaryPersistentStorageBackendSchema` currently has exactly one valid backend value, `indexeddb-same-origin-browser-local-v1` (`packages/package-format/src/persistent-binary-storage-contract.ts:14-16`). The record schema and evaluator input both parse storage backend through that same schema (`packages/package-format/src/persistent-binary-storage-contract.ts:137`, `:156`; `packages/package-format/src/persistent-binary-storage.ts:57-58`, `:85-86`). Therefore, a valid stored record and valid evaluator input cannot currently construct `persistentByteStorage.backend.mismatch` without adding a speculative second backend enum value or bypassing schema validation.

The updated test pins unsupported backend rejection instead (`packages/package-format/src/persistent-binary-storage.test.ts:55-59`), preserving the current IndexedDB-only boundary. I do not consider direct backend mismatch branch coverage required for Domain A while the backend enum remains single-valued.

## Verification Performed

- `pnpm.cmd exec vitest run packages/package-format/src/persistent-binary-storage.test.ts`
  - pass, 1 file / 6 tests.
- `pnpm.cmd typecheck`
  - pass.
- `git diff --check -- packages/package-format/src/persistent-binary-storage-contract.ts packages/package-format/src/persistent-binary-storage.ts packages/package-format/src/persistent-binary-storage.test.ts packages/package-format/src/index.ts discussion/implementation/waves/wave35/wave35-domain-a-persistent-binary-storage-contract-foundation-completion-report.md discussion/implementation/reviews/wave35/wave35-domain-a-test-adequacy-review.md`
  - exit 0; Git emitted the existing LF-to-CRLF warning for `packages/package-format/src/index.ts`.
  - Note: most Domain A files are untracked, so plain `git diff --check` does not fully inspect those files. I supplemented it with a direct read-only scan for trailing whitespace and conflict markers across the untracked Domain A files; no matches were found.
- `git status --short -uall package.json pnpm-lock.yaml pnpm-workspace.yaml apps/editor/package.json packages/package-format/package.json packages/contracts/package.json`
  - empty; no dependency manifest or lockfile changes detected.
- Forbidden-scope term scan over Domain A source/test/report paths:
  - hits were limited to negative tests or explicit non-goal/report wording for archive, File System Access API, drag-drop, parser, image decode, external dependency, Cubism, full renderer, pixel oracle, localStorage/base64 payload, zip, and portable semantics.

Environment note:

- Sandboxed command startup failed with `windows sandbox: spawn setup refresh`; read-only inspection and verification commands were therefore run through the approved escalated command path.

## Remaining Issues / Test Gaps

No remaining Domain A test-adequacy blocker.

Non-blocking note: direct `persistentByteStorage.backend.mismatch` coverage should be added only if a future contract revision introduces a second valid backend value.

## User-Decision Points

None. The backend mismatch question does not require a user decision for Domain A because the current accepted scope is IndexedDB-only and the one-value enum makes the mismatch branch unreachable for valid DTOs.

## Clean Review Confirmation

This was a clean, grounded re-review. I read the basis documents, updated tests, contract/evaluator source, completion report, current status/diff evidence, and verification output directly. I did not rely on Gnome's summary as the only source. I did not edit source files, package manifests, lockfiles, fixtures, editor files, validator files, operation files, or e2e files. The only file written by this re-review is this review artifact.
