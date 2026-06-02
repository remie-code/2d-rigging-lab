# Wave34 Domain D Completion: Direct-Call Fixtures and E2E Guard

verdict: pass

## Scope

Implemented Domain D only: contract fixture data, fixture-backed direct-call regressions, validator fixture regression, a narrow byte-intake e2e assertion guard, and fixture/traceability markdown registration.

## Files Changed

- `fixtures/contracts/wave34-byte-availability-direct-call-fixtures/fixture-manifest.json`
- `fixtures/contracts/wave34-byte-availability-direct-call-fixtures/direct-call-cases.json`
- `fixtures/contracts/wave34-byte-availability-direct-call-fixtures/expected/direct-call-availability-summary.json`
- `fixtures/contracts/wave34-byte-availability-direct-call-fixtures/expected/validator-availability-diagnostics-summary.json`
- `packages/package-format/src/wave34-byte-availability-direct-call-fixture.test.ts`
- `packages/validator-core/src/wave34-byte-availability-direct-call-fixture.test.ts`
- `apps/editor/e2e/byte-intake-smoke.mjs`
- `discussion/tests/fixtures/fixture-manifest.md`
- `discussion/tests/traceability/test-traceability-matrix.md`
- `discussion/implementation/waves/wave34/wave34-domain-d-direct-call-fixtures-and-e2e-guard-completion-report.md`

## Implementation Summary

- Added `wave34-byte-availability-direct-call-fixtures`, a metadata-only contract fixture for four direct-call cases:
  - valid current-session verification report passes as the control;
  - verified-pass summary without current-session bytes fails as `stale-verified-summary-v1`;
  - binary ref without current-session evidence fails as `missing-current-session-bytes-v1`;
  - caller-declared reupload state fails as `requires-reupload-v1`.
- Added a package-format fixture test that reads the fixture JSON, calls Domain A `evaluatePackageBinaryCurrentSessionByteAvailability`, and compares deterministic issue codes, sources, target paths, expected values, and actual values to the fixture expected summary.
- Added a validator-core fixture test that reads the same fixture JSON, calls Domain B `validateByteIntakePreflight`, and compares deterministic `byteAvailability.*` diagnostics and evidence.
- Strengthened `apps/editor/e2e/byte-intake-smoke.mjs` load-after-save guard so a loaded row fails if it still claims `validator bytesAvailability=available`, current-session availability, source filename, or `verified-pass` byte intake status.
- Registered the warning-gated fixture narrowly in fixture and traceability markdown. JSON mirrors were not edited.

## Verification

- `pnpm.cmd exec vitest run packages/package-format/src/wave34-byte-availability-direct-call-fixture.test.ts packages/validator-core/src/wave34-byte-availability-direct-call-fixture.test.ts packages/package-format/src/byte-availability.test.ts packages/validator-core/src/byte-intake-availability.test.ts`: pass, 4 files / 14 tests.
- `node apps/editor/e2e/byte-intake-smoke.mjs`: pass; desktop and mobile smoke passed with screenshots captured.
- `pnpm.cmd typecheck`: pass.
- `git diff --check -- apps/editor/e2e/byte-intake-smoke.mjs discussion/tests/fixtures/fixture-manifest.md discussion/tests/traceability/test-traceability-matrix.md`: pass with LF-to-CRLF working-copy warnings only.
- `git diff --check --no-index -- NUL <new Domain D file>` for the new fixture/test/report files: no whitespace diagnostics; command exits nonzero for ordinary new-file differences, so the PowerShell wrapper filtered whitespace diagnostics and exited 0.
- Dependency manifest/lockfile diff check over root/package/editor/package manifests and `pnpm-lock.yaml`: no output.
- Forbidden-scope changed-line scan found only added non-goal/negative wording in docs. Full changed-path scan also found expected negative e2e assertions, `localStorage` inspection in the existing browser-storage guard, and fixture/test truthfulness flags set to `false`.

## Remaining Issues / Residual Risk

- No persistent binary storage, archive support, parser, image decode, File System Access API, drag-drop mechanism, external dependency, Cubism/Core integration, full renderer, or pixel oracle was implemented.
- The e2e guard remains a semantic UI/storage smoke test; it does not add a new file input mechanism or persistent byte storage.
- Existing dirty work from Domains A-C remains in the worktree and was not reverted or edited except where Domain D intentionally added focused tests depending on those APIs.

## User-Decision Points

None.

## Scope Confirmation

- Did not ask the user directly.
- Did not edit outside the Domain D allowed write scope.
- Did not edit package manifests, lockfiles, broad production source in `packages/**`, or broad `apps/editor/src/**` source.
