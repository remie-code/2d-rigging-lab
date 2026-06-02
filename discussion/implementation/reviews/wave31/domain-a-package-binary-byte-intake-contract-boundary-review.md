# Wave31 Domain A Review Notes: Package Binary Byte Intake Contract Boundary

Status: pass

Date: 2026-06-02

## Review Scope

Reviewed Domain A against:

- `discussion/implementation/orchestration/wave31-plan.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/schema-and-id-conventions.md`
- `discussion/design/module-contracts/package-file-format-contract.md`
- `discussion/implementation/waves/wave22/wave22-final-report.md`
- `discussion/implementation/waves/wave30/wave30-final-report.md`

Reviewed source/tests:

- `packages/package-format/src/byte-intake.ts`
- `packages/package-format/src/byte-intake.test.ts`
- `packages/package-format/src/index.ts`
- `packages/package-format/src/binary-asset.ts`
- `packages/package-format/src/package-binary-file-set.ts`

## Review Timeline

### Initial Review

Verdict: needs_changes

Finding:

- `CreatePackageBinaryByteIntakeSummaryInput.availability` could override derived availability and create contradictory evidence, such as missing bytes reported as available.

Resolution:

- Gnome loop 1 derived availability from ref/report and rejected mismatched overrides.
- Regression test added for missing bytes plus forced `available-package-local-bytes-v1`.

### Re-review

Verdict: needs_changes

Finding:

- `assertVerificationReportMatchesRef` checked only binary asset ID and package path. A stale report with matching ID/path but mismatched expected digest, byteLength, or mediaType could be combined with current ref metadata.

Resolution:

- Gnome loop 2 extended report/ref matching to expected byteLength, digest algorithm, digest hex, and mediaType.
- Regression test added for stale verification report metadata mismatch.

### Final Re-review

Verdict: pass

Findings:

- No blocking, high, medium, or low findings.

## Test Adequacy

Adequate for Domain A. Coverage includes:

- Stored package-local bytes.
- `storage-unsupported-v1` as ephemeral available bytes and requires-reupload missing bytes.
- Metadata mismatch without parser/decode claims.
- Strict schema rejection of byte payload / decoded image fields.
- Invalid filename and invalid availability enum.
- Contradictory availability override rejection.
- Stale verification report expected metadata mismatch rejection.

## Source Organization And Dependency Assessment

- `index.ts` is barrel-only and only re-exports `./byte-intake.js`.
- New source file has one focused responsibility: byte-intake summary and availability derivation.
- No parser, decode, archive, UI, operation, validator broad implementation, or e2e scope was added in Domain A files.
- No dependency, manifest, or lockfile changes were found.

## Verification Considered

- Focused package-format tests: pass, 3 files / 15 tests.
- Typecheck: pass.
- Source organization guard: pass.
- Dependency guard: pass.
- Diff whitespace check: pass with only LF to CRLF warning on `packages/package-format/src/index.ts`.

## Remaining Issues

- None for Domain A.

## User Decision Points

- None.
