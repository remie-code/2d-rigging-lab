# Wave34 Domain B Completion: Validator Stale Summary / Reupload Diagnostics

verdict: implemented

## Scope

Domain B hardened `validator-core` byte-intake preflight so a verified byte summary no longer implies current-session bytes. Validator callers can now provide additive package identity/revision, binary asset reference, current-session verification report, verified summary snapshot, and reupload state. The validator maps Domain A byte availability issues to deterministic `ValidationCheckResultDto` diagnostics.

## Changed Files

- `packages/validator-core/src/validators/byte-intake-preflight.ts`
- `packages/validator-core/src/validators/byte-intake-availability-diagnostics.ts`
- `packages/validator-core/src/validators/package-runtime.ts`
- `packages/validator-core/src/check-catalog.ts`
- `packages/validator-core/src/byte-intake-availability.test.ts`
- `packages/validator-core/src/binary-asset-validator.test.ts`
- `discussion/implementation/waves/wave34/wave34-domain-b-validator-stale-summary-reupload-diagnostics-completion-report.md`

## Implementation Summary

- Added optional direct-call byte availability inputs to byte-intake preflight while preserving existing caller shape.
- Integrated Domain A `evaluatePackageBinaryCurrentSessionByteAvailability` into validator-core through a focused `byte-intake-availability-diagnostics` validator concern.
- Registered Domain A issue codes as validator check IDs in `defaultCheckCatalog`.
- `validatePackageRuntimeWithBinaryAssets` now passes parsed package id/revision into byte-intake preflight when the caller did not specify them.
- Removed the old summary-only pass path: without current-session evidence, verified summaries produce missing/stale diagnostics.
- Current-session verification evidence can pass without raw bytes; stale revision, stale summary, binary ref mismatch, digest mismatch, byteLength mismatch, metadata mismatch availability, missing bytes, and requires-reupload produce deterministic diagnostics.
- Test adequacy fix loop 1 strengthened byte availability validator assertions for diagnostic status, severity, phase, target, targetPath, and `availabilityIssueTargetPath` evidence, and added focused plain missing-current-session coverage without stale summary or reupload state.
- Test adequacy fix loop 1 also pins package id mismatch and current-session media type mismatch output shape.

## Verification

- `pnpm.cmd exec vitest run packages/validator-core/src/byte-intake-availability.test.ts packages/validator-core/src/binary-asset-validator.test.ts packages/validator-core/src/binary-asset-fixture.test.ts`: pass, 3 files / 18 tests.
- `pnpm.cmd run typecheck:root`: pass.
- `pnpm.cmd typecheck`: pass.

## Non-Goals Kept Out

- No editor/session implementation.
- No persistent storage, archive import/export, parser, image decode, File System Access API, drag-drop, external dependency, Cubism compatibility, full renderer, or pixel oracle implementation.
- No dependency manifest, lockfile, package-format contract, contracts package, operation-core, fixtures, or e2e changes.

## Remaining Issues

- Domain B did not update validator contract prose; the source registry is updated and tests pin the new check IDs.

## User-Decision Points

None.
