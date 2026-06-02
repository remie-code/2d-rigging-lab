# Wave34 Domain D Design / Development Compliance Review

verdict: pass

Date: 2026-06-03 JST

Reviewer: Review-Sylph, L2 clean-context review

Review lane: Design / Development Compliance Review

## Scope Reviewed

Target: Wave34 Domain D `wave34-direct-call-fixtures-and-e2e-guard`.

Reviewed the reported Domain D files:

- `fixtures/contracts/wave34-byte-availability-direct-call-fixtures/**`
- `packages/package-format/src/wave34-byte-availability-direct-call-fixture.test.ts`
- `packages/validator-core/src/wave34-byte-availability-direct-call-fixture.test.ts`
- `apps/editor/e2e/byte-intake-smoke.mjs`
- `discussion/tests/fixtures/fixture-manifest.md`
- `discussion/tests/traceability/test-traceability-matrix.md`
- `discussion/implementation/waves/wave34/wave34-domain-d-direct-call-fixtures-and-e2e-guard-completion-report.md`

I also checked the active worktree status. The worktree still contains Wave34 Domain A-C source changes outside the Domain D scope; I treated those as upstream context and did not attribute them to Domain D. The scoped Domain D status contained only fixtures, focused package/validator tests, the editor e2e smoke file, narrow fixture/traceability markdown registration, and the Domain D completion report before this review artifact was written.

## Basis Documents Used

- `.agents/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `discussion/implementation/orchestration/wave34-plan.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/schema-and-id-conventions.md`
- `discussion/design/module-contracts/package-file-format-contract.md`
- `discussion/design/module-contracts/validator-contract.md`
- `discussion/tests/fixtures/fixture-manifest.md`
- `discussion/tests/traceability/test-traceability-matrix.md`
- `discussion/implementation/waves/wave31/wave31-final-report.md`
- `discussion/implementation/reviews/wave31/wave31-clean-integration-review.md`
- Wave34 Domain A-C completion reports and selected supporting source/diff context.

## Findings

No blocking design/development compliance findings.

1. Domain D stayed inside the allowed implementation scope.
   The Domain D scoped status showed only the expected fixture directory, focused test files, e2e file, narrow discussion registrations, and completion report. The added package-format and validator files are test files, not production implementation. The only related `index.ts` source diff I inspected remains barrel-only re-exports at `packages/package-format/src/index.ts:2`.

2. Direct-call fixture coverage matches the Wave34 Domain D purpose.
   The fixture includes a valid current-session control case at `fixtures/contracts/wave34-byte-availability-direct-call-fixtures/direct-call-cases.json:8`, stale verified summary misuse at `fixtures/contracts/wave34-byte-availability-direct-call-fixtures/direct-call-cases.json:46`, missing current-session bytes at `fixtures/contracts/wave34-byte-availability-direct-call-fixtures/direct-call-cases.json:89`, and caller-declared reupload at `fixtures/contracts/wave34-byte-availability-direct-call-fixtures/direct-call-cases.json:109`. The expected direct-call summary pins pass/fail outcomes at `fixtures/contracts/wave34-byte-availability-direct-call-fixtures/expected/direct-call-availability-summary.json:7`, `fixtures/contracts/wave34-byte-availability-direct-call-fixtures/expected/direct-call-availability-summary.json:17`, `fixtures/contracts/wave34-byte-availability-direct-call-fixtures/expected/direct-call-availability-summary.json:42`, and `fixtures/contracts/wave34-byte-availability-direct-call-fixtures/expected/direct-call-availability-summary.json:60`.

3. Validator diagnostics are deterministic and machine-readable.
   The expected validator summary pins `byteAvailability.currentSessionBytes.missing`, `byteAvailability.verifiedSummary.stale`, and `byteAvailability.requiresReupload` at `fixtures/contracts/wave34-byte-availability-direct-call-fixtures/expected/validator-availability-diagnostics-summary.json:13`, `fixtures/contracts/wave34-byte-availability-direct-call-fixtures/expected/validator-availability-diagnostics-summary.json:35`, and `fixtures/contracts/wave34-byte-availability-direct-call-fixtures/expected/validator-availability-diagnostics-summary.json:111`. These IDs match the dot-separated lower camelCase convention.

4. Focused tests call the Domain A/B APIs instead of adding new package/editor contracts.
   The package-format regression uses `evaluatePackageBinaryCurrentSessionByteAvailability` and compares semantic JSON expected output at `packages/package-format/src/wave34-byte-availability-direct-call-fixture.test.ts:10`, `packages/package-format/src/wave34-byte-availability-direct-call-fixture.test.ts:27`, and `packages/package-format/src/wave34-byte-availability-direct-call-fixture.test.ts:67`. The validator regression calls `validateByteIntakePreflight` and compares expected diagnostics at `packages/validator-core/src/wave34-byte-availability-direct-call-fixture.test.ts:17`, `packages/validator-core/src/wave34-byte-availability-direct-call-fixture.test.ts:29`, and `packages/validator-core/src/wave34-byte-availability-direct-call-fixture.test.ts:65`.

5. The e2e change strengthens, rather than weakens, reupload truthfulness.
   The smoke test still waits for `validator bytesAvailability=requiresReupload` and now fails if the reloaded row claims source filename, verified-pass byte intake, validator available bytes, or current editor session memory availability at `apps/editor/e2e/byte-intake-smoke.mjs:285` through `apps/editor/e2e/byte-intake-smoke.mjs:296`.

6. Fixture and traceability registrations are narrow.
   The fixture manifest adds one warning-gated row for `wave34-byte-availability-direct-call-fixtures` at `discussion/tests/fixtures/fixture-manifest.md:94`. The traceability matrix adds one test ID row at `discussion/tests/traceability/test-traceability-matrix.md:67`, one module-surface mapping update at `discussion/tests/traceability/test-traceability-matrix.md:215`, and one warning-gated markdown fixture connection at `discussion/tests/traceability/test-traceability-matrix.md:250`. The referenced AC/scenario IDs were found in existing discussion sources.

7. Forbidden-scope content is guarded as negative evidence, not implemented.
   The fixture metadata records no actual PSD/PNG bytes and no persistent storage, parser, image decode, archive, File System Access API, drag-drop, full renderer, or pixel oracle claims at `fixtures/contracts/wave34-byte-availability-direct-call-fixtures/fixture-manifest.json:42` through `fixtures/contracts/wave34-byte-availability-direct-call-fixtures/fixture-manifest.json:62`. The direct-call cases also record no raw bytes, parser, image decode, or archive use at `fixtures/contracts/wave34-byte-availability-direct-call-fixtures/direct-call-cases.json:131` through `fixtures/contracts/wave34-byte-availability-direct-call-fixtures/direct-call-cases.json:137`.

8. The completion report accurately records scope, verification, and limitations.
   The report lists the expected Domain D files at `discussion/implementation/waves/wave34/wave34-domain-d-direct-call-fixtures-and-e2e-guard-completion-report.md:9`, records focused vitest/e2e/typecheck/diff/dependency/forbidden-scan verification at `discussion/implementation/waves/wave34/wave34-domain-d-direct-call-fixtures-and-e2e-guard-completion-report.md:34`, and records no forbidden persistent storage/archive/parser/image decode/File System Access API/drag-drop/dependency/Cubism/full renderer/pixel oracle implementation at `discussion/implementation/waves/wave34/wave34-domain-d-direct-call-fixtures-and-e2e-guard-completion-report.md:44`.

## Verification Performed

- `git status --short -uall`: inspected full worktree and confirmed Domain A-C changes are present alongside Domain D.
- `git status --short -uall -- <Domain D paths>`: confirmed Domain D scoped paths before this artifact.
- `git diff --name-only`: inspected tracked changed paths.
- `git diff -- apps/editor/e2e/byte-intake-smoke.mjs`: confirmed e2e assertion strengthening.
- `git diff -- discussion/tests/fixtures/fixture-manifest.md` and `git diff -- discussion/tests/traceability/test-traceability-matrix.md`: confirmed narrow registration edits.
- `git diff -- package.json pnpm-lock.yaml pnpm-workspace.yaml apps/editor/package.json packages/package-format/package.json packages/validator-core/package.json`: no output.
- `git status --short -uall -- package.json pnpm-lock.yaml pnpm-workspace.yaml apps/editor/package.json packages/package-format/package.json packages/validator-core/package.json packages/contracts/package.json`: no output.
- `git diff --check -- apps/editor/e2e/byte-intake-smoke.mjs discussion/tests/fixtures/fixture-manifest.md discussion/tests/traceability/test-traceability-matrix.md`: pass with LF-to-CRLF working-copy warnings only.
- `rg -n '[ \t]+$' <new Domain D files>`: no trailing-whitespace hits.
- Forbidden-scope `rg` scan over Domain D changed paths for persistent storage, archive, parser, image decode, File System Access API, drag-drop, external dependency, Cubism, full renderer, and pixel oracle: hits were negative guardrail prose/flags, existing e2e localStorage inspection, JSON parsing, and unsupported-claim assertions; no forbidden implementation found.
- Import scan over Domain D test/e2e files: only Node built-ins, Vitest, existing workspace package imports, and existing local e2e helpers were found.

Environment note: initial non-escalated shell reads failed with `windows sandbox: spawn setup refresh`; the same read-only checks were rerun with escalation and completed.

I did not rerun the full vitest/e2e suites in this review lane. I inspected the recorded Domain D verification and ran lightweight read-only checks only.

## Remaining Issues

No Domain D design/development compliance issues remain.

Residual integration note: the worktree still contains Wave34 Domain A-C source changes outside Domain D. Final integration should continue to treat those under their own reviews and wave-level integration gate.

## User-Decision Points

None.

## Reviewer Conduct

I did not ask the user directly. I did not edit implementation, source, test, fixture, e2e, dependency, manifest, or lockfile files. The only file I wrote is this review artifact.
