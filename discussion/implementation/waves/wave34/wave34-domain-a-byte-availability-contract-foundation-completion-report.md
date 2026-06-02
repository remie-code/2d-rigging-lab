# Wave34 Domain A Completion: Byte Availability Direct-Call Contract Foundation

verdict: implemented

## Scope

Domain A added an additive package-format contract/test oracle for direct callers that need to decide whether binary bytes are available in the current session. It does not change validator-core, editor, persistence, archive, parser, image decode, or storage behavior.

## Changed Files

- `packages/package-format/src/byte-availability.ts`
- `packages/package-format/src/byte-availability-contract.ts`
- `packages/package-format/src/byte-availability.test.ts`
- `packages/package-format/src/index.ts`

## Contract Semantics

- `byte-availability-contract.ts` owns the Zod DTO schemas, issue code registry, and direct-call report shape.
- `evaluatePackageBinaryCurrentSessionByteAvailability` reports current-session bytes as available only when a current verification report is supplied and does not report missing bytes.
- Missing current-session bytes are represented separately from `requires-reupload-v1`.
- Verified-pass byte intake summaries are wrapped with package identity and package revision before being used as direct-call evidence.
- A verified summary is marked stale when it is used without current-session bytes, belongs to another package revision, targets another binary ref, or carries digest / byteLength metadata that no longer matches the requested binary ref.
- The report issue oracle can express package ID mismatch, package revision mismatch, binary ref mismatch, digest mismatch, byteLength mismatch, mediaType mismatch, missing current-session bytes, requires reupload, stale verified summary, and digest verification unsupported.

## Verification

- `pnpm.cmd exec vitest run packages/package-format/src/byte-availability.test.ts packages/package-format/src/byte-intake.test.ts packages/package-format/src/package-binary-file-set.test.ts`: pass, 3 files / 16 tests.
- `pnpm.cmd typecheck`: pass.
- `git diff --check -- packages/package-format/src/index.ts`: pass with LF-to-CRLF warning only.
- `git diff --check --no-index -- NUL <new Domain A file>` for the three new source/test files and this report: no whitespace diagnostics; command exits `1` because `--no-index` compares new files against the null device.
- Dependency manifest/lockfile diff check over root, workspace, editor, contracts, and package-format manifests plus `pnpm-lock.yaml`: empty.
- Forbidden-scope scan over changed Domain A files found only non-goal report text and one test name saying no parser/decode claims.

## Non-Goals Kept Out

- No validator/editor implementation.
- No persistent binary storage, archive import/export, parser, image decode, File System Access API, drag-drop, external dependency, Cubism compatibility, full renderer, or pixel oracle implementation.
- No dependency manifest, lockfile, or workspace manifest changes.
