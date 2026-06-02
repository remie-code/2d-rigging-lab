# Wave34 Domain D Test Adequacy Review: Direct-Call Fixtures and E2E Guard

Date: 2026-06-03

Verdict: `pass`

Review lane: Test Adequacy Review

Target: Wave34 Domain D `wave34-direct-call-fixtures-and-e2e-guard`

Review mode: clean, repository-grounded review. I inspected the changed fixture data, direct-call tests, e2e guard, traceability entries, relevant Domain A-C behavior, and reran the focused verification commands. I did not edit implementation/source/test files; this review artifact is the only file I wrote.

## Scope

Reviewed Domain D only: metadata-only contract fixtures, package-format direct-call regression, validator-core direct-call regression, editor byte-intake browser save/load e2e guard, and fixture/traceability registration.

Domain A-C source and reports were treated as dependency context for the test oracle and browser-visible truthfulness path.

## Basis Used

- `discussion/implementation/orchestration/wave34-plan.md`
- `discussion/design/module-contracts/package-file-format-contract.md`
- `discussion/design/module-contracts/validator-contract.md`
- `fixtures/contracts/wave34-byte-availability-direct-call-fixtures/fixture-manifest.json`
- `fixtures/contracts/wave34-byte-availability-direct-call-fixtures/direct-call-cases.json`
- `fixtures/contracts/wave34-byte-availability-direct-call-fixtures/expected/direct-call-availability-summary.json`
- `fixtures/contracts/wave34-byte-availability-direct-call-fixtures/expected/validator-availability-diagnostics-summary.json`
- `packages/package-format/src/byte-availability-contract.ts`
- `packages/package-format/src/byte-availability.ts`
- `packages/package-format/src/byte-availability.test.ts`
- `packages/package-format/src/wave34-byte-availability-direct-call-fixture.test.ts`
- `packages/validator-core/src/validators/byte-intake-preflight.ts`
- `packages/validator-core/src/validators/byte-intake-availability-diagnostics.ts`
- `packages/validator-core/src/wave34-byte-availability-direct-call-fixture.test.ts`
- `apps/editor/e2e/byte-intake-smoke.mjs`
- `apps/editor/src/editor-session/session-byte-availability-bridge.ts`
- `apps/editor/src/editor-session/session-adapter.ts`
- `apps/editor/src/editor-state/binary-byte-intake-state.ts`
- `discussion/tests/fixtures/fixture-manifest.md`
- `discussion/tests/traceability/test-traceability-matrix.md`
- `discussion/implementation/waves/wave34/wave34-domain-a-byte-availability-contract-foundation-completion-report.md`
- `discussion/implementation/waves/wave34/wave34-domain-b-validator-stale-summary-reupload-diagnostics-completion-report.md`
- `discussion/implementation/waves/wave34/wave34-domain-c-editor-session-byte-truthfulness-bridge-completion-report.md`
- `discussion/implementation/waves/wave34/wave34-domain-d-direct-call-fixtures-and-e2e-guard-completion-report.md`

## Findings

No blocking test adequacy findings.

The Domain D tests are adequate for the requested lane: stale verified summaries, missing current-session bytes, and caller-declared reupload state cannot pass silently through the direct-call package-format path, validator preflight path, or browser save/load smoke guard.

## Coverage Assessment

- The Wave34 plan limits Domain D to fixtures/tests/e2e, forbids e2e assertion weakening that hides stale summary or reupload truthfulness, and requires deterministic stale-summary fixture failure plus desktop/mobile save/load observability at `discussion/implementation/orchestration/wave34-plan.md:201`, `discussion/implementation/orchestration/wave34-plan.md:220`, `discussion/implementation/orchestration/wave34-plan.md:226`, and `discussion/implementation/orchestration/wave34-plan.md:227`.
- The fixture has one positive control and three misuse cases: valid current-session bytes at `fixtures/contracts/wave34-byte-availability-direct-call-fixtures/direct-call-cases.json:8`, stale verified summary without current-session report at `fixtures/contracts/wave34-byte-availability-direct-call-fixtures/direct-call-cases.json:46`, missing current-session bytes at `fixtures/contracts/wave34-byte-availability-direct-call-fixtures/direct-call-cases.json:89`, and caller `requiresReupload` at `fixtures/contracts/wave34-byte-availability-direct-call-fixtures/direct-call-cases.json:109`.
- The package-format expected summary pins the positive pass and negative diagnostics, including `byteAvailability.currentSessionBytes.missing`, `byteAvailability.verifiedSummary.stale`, and `byteAvailability.requiresReupload`, at `fixtures/contracts/wave34-byte-availability-direct-call-fixtures/expected/direct-call-availability-summary.json:16`, `fixtures/contracts/wave34-byte-availability-direct-call-fixtures/expected/direct-call-availability-summary.json:41`, and `fixtures/contracts/wave34-byte-availability-direct-call-fixtures/expected/direct-call-availability-summary.json:59`.
- The validator expected summary pins deterministic `ValidationCheckResultDto` shape and availability evidence for stale summary, missing bytes, and requires-reupload cases at `fixtures/contracts/wave34-byte-availability-direct-call-fixtures/expected/validator-availability-diagnostics-summary.json:10`, `fixtures/contracts/wave34-byte-availability-direct-call-fixtures/expected/validator-availability-diagnostics-summary.json:59`, and `fixtures/contracts/wave34-byte-availability-direct-call-fixtures/expected/validator-availability-diagnostics-summary.json:86`.
- The package-format fixture test reads the fixture, calls `evaluatePackageBinaryCurrentSessionByteAvailability`, summarizes status/availability/issues, and compares the whole semantic JSON output to the expected artifact at `packages/package-format/src/wave34-byte-availability-direct-call-fixture.test.ts:15`, `packages/package-format/src/wave34-byte-availability-direct-call-fixture.test.ts:21`, `packages/package-format/src/wave34-byte-availability-direct-call-fixture.test.ts:67`, and `packages/package-format/src/wave34-byte-availability-direct-call-fixture.test.ts:95`.
- The validator fixture test reads the same fixture, calls `validateByteIntakePreflight`, and compares the deterministic check IDs/status/severity/phase/targetPath/evidence to the expected artifact at `packages/validator-core/src/wave34-byte-availability-direct-call-fixture.test.ts:19`, `packages/validator-core/src/wave34-byte-availability-direct-call-fixture.test.ts:25`, `packages/validator-core/src/wave34-byte-availability-direct-call-fixture.test.ts:65`, and `packages/validator-core/src/wave34-byte-availability-direct-call-fixture.test.ts:86`.
- Domain A provides the direct-call oracle: missing current-session reports become `missing-current-session-bytes-v1` at `packages/package-format/src/byte-availability.ts:104`, caller/storage reupload state is derived at `packages/package-format/src/byte-availability.ts:117`, missing and reupload issues are emitted at `packages/package-format/src/byte-availability.ts:142` and `packages/package-format/src/byte-availability.ts:158`, stale verified summaries are rejected at `packages/package-format/src/byte-availability.ts:367`, and availability derivation distinguishes requires-reupload, stale-summary, missing-bytes, and current-session bytes at `packages/package-format/src/byte-availability.ts:416`.
- Domain B maps Domain A availability issues to validator diagnostics with explicit evidence at `packages/validator-core/src/validators/byte-intake-availability-diagnostics.ts:33`, `packages/validator-core/src/validators/byte-intake-availability-diagnostics.ts:84`, and `packages/validator-core/src/validators/byte-intake-availability-diagnostics.ts:92`.
- The e2e guard is not weakened. It still proves available state immediately after current-session intake at `apps/editor/e2e/byte-intake-smoke.mjs:91`, saves/reloads/loads the browser-local project at `apps/editor/e2e/byte-intake-smoke.mjs:96`, asserts requires-reupload after load at `apps/editor/e2e/byte-intake-smoke.mjs:106`, and rejects stale loaded claims for source filename, verified-pass status, validator available state, and current-session availability at `apps/editor/e2e/byte-intake-smoke.mjs:275`.
- The e2e guard also checks browser-local storage metadata without persisted binary payload fields at `apps/editor/e2e/byte-intake-smoke.mjs:300`, scans for unsupported parser/decode/renderer-style claims at `apps/editor/e2e/byte-intake-smoke.mjs:425`, and runs both desktop and mobile viewports at `apps/editor/e2e/byte-intake-smoke.mjs:48` and `apps/editor/e2e/byte-intake-smoke.mjs:510`.
- Fixture and traceability registrations are specific and warning-gated. They describe direct-call fixtures plus desktop/mobile browser save/load guard, and explicitly disclaim persistent storage, parser, image decode, archive, File System Access API, drag-drop, full renderer, and pixel oracle coverage at `discussion/tests/fixtures/fixture-manifest.md:94` and `discussion/tests/traceability/test-traceability-matrix.md:67`.

## Verification Commands

- `git status --short -uall`: inspected the working tree. It showed Wave34 Domain A-C dirty context plus Domain D changes/untracked fixture/test/report files.
- `git diff -- apps/editor/e2e/byte-intake-smoke.mjs discussion/tests/fixtures/fixture-manifest.md discussion/tests/traceability/test-traceability-matrix.md`: inspected tracked Domain D changes; the e2e diff strengthens forbidden loaded claims rather than weakening assertions.
- Directly inspected untracked Domain D fixture/test/report files with line-numbered reads.
- `pnpm.cmd exec vitest run packages/package-format/src/wave34-byte-availability-direct-call-fixture.test.ts packages/validator-core/src/wave34-byte-availability-direct-call-fixture.test.ts packages/package-format/src/byte-availability.test.ts packages/validator-core/src/byte-intake-availability.test.ts`: pass, 4 files / 14 tests.
- `node apps/editor/e2e/byte-intake-smoke.mjs`: pass; desktop and mobile smoke passed, with screenshots captured.
- `pnpm.cmd typecheck`: pass.

Environment note: non-escalated PowerShell and Node REPL process startup failed with `windows sandbox failed: spawn setup refresh`, so repository reads and verification commands were rerun with approved escalation. The commands completed successfully.

## Remaining Issues / Residual Test Risk

No blocking residual test risk for Domain D.

Narrow residual: the browser e2e remains a semantic UI/storage smoke guard, not a persistent byte storage, parser, image decode, archive, File System Access API, drag-drop, full renderer, or pixel oracle test. That matches the Wave34 non-goals and the fixture/traceability wording.

JSON mirrors for the fixture manifest and traceability matrix were intentionally not updated; the new Wave34 fixture is warning-gated in markdown and does not claim mvp-blocking acceptance-runner registration.

## User-Decision Points

None.

I did not ask the user directly and did not edit implementation/source/test files.
