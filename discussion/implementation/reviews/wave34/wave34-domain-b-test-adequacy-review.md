# Wave34 Domain B Test Adequacy Review: Validator Stale Summary / Reupload Diagnostics

Date: 2026-06-03

Reviewer: Review-Sylph clean Test Adequacy Review lane

Verdict: `pass`

## Scope

Reviewed Wave34 Domain B only: `wave34-validator-stale-summary-reupload-diagnostics`.

This is a read-only re-review after fix loop 1. It assessed whether the changed validator tests adequately verify deterministic stale-summary, reupload, missing-current-bytes, and byte availability diagnostics. It did not edit source or test files.

## Basis Documents Read

- `.agents/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `discussion/implementation/orchestration/wave34-plan.md`
- `discussion/development_convention/schema-and-id-conventions.md`
- `discussion/design/module-contracts/validator-contract.md`
- `packages/package-format/src/byte-availability-contract.ts`
- `packages/package-format/src/byte-availability.ts`
- `discussion/implementation/reviews/wave34/wave34-domain-a-test-adequacy-review.md`

## Changed Files Reviewed

- `packages/validator-core/src/validators/byte-intake-preflight.ts`
- `packages/validator-core/src/validators/byte-intake-availability-diagnostics.ts`
- `packages/validator-core/src/validators/package-runtime.ts`
- `packages/validator-core/src/check-catalog.ts`
- `packages/validator-core/src/byte-intake-availability.test.ts`
- `packages/validator-core/src/binary-asset-validator.test.ts`
- `discussion/implementation/waves/wave34/wave34-domain-b-validator-stale-summary-reupload-diagnostics-completion-report.md`

## Findings

No blocking test adequacy findings remain.

## Previous Findings Re-Checked

1. Resolved: `byteAvailability.*` diagnostics now assert validator output shape strongly enough.

   The common assertion helper in `packages/validator-core/src/byte-intake-availability.test.ts:415` finds diagnostics by `checkId` plus `availabilityIssueTargetPath` evidence, then asserts `status: "fail"`, `severity: "error"`, `phase: "reference"`, `target`, and `targetPath` at `packages/validator-core/src/byte-intake-availability.test.ts:438`. The same helper also requires `availabilityIssueCode` and `availabilityIssueTargetPath` evidence at `packages/validator-core/src/byte-intake-availability.test.ts:449`.

2. Resolved: plain missing-current-session bytes are now covered without stale summary or reupload state.

   `packages/validator-core/src/byte-intake-availability.test.ts:115` covers a current `binaryAssetRef` with no `currentSessionVerificationReport`, no `verifiedSummary`, and no reupload state. It expects only `byteAvailability.currentSessionBytes.missing` and asserts `availability=missing-current-session-bytes-v1`, `currentSessionVerificationStatus=not-supplied-v1`, `requiresReupload=false`, and `verifiedSummaryStatus=not-supplied-v1` at `packages/validator-core/src/byte-intake-availability.test.ts:135`.

## Coverage Confirmation

- Valid current-session byte evidence passes: `packages/validator-core/src/byte-intake-availability.test.ts:45` supplies `currentSessionVerificationReport` and expects no checks.
- Stale verified summary without current bytes fails: `packages/validator-core/src/byte-intake-availability.test.ts:68` expects missing-current-session plus stale-summary diagnostics, with target-path evidence asserted at `packages/validator-core/src/byte-intake-availability.test.ts:92` and `packages/validator-core/src/byte-intake-availability.test.ts:103`.
- Stale package revision diagnostics are pinned: `packages/validator-core/src/byte-intake-availability.test.ts:154` expects `byteAvailability.packageRevision.mismatch`; `packages/validator-core/src/byte-intake-availability.test.ts:200` asserts `/verifiedSummary/packageRevision` and expected/actual revision evidence.
- Package ID mismatch is now covered: `packages/validator-core/src/byte-intake-availability.test.ts:154` expects `byteAvailability.packageId.mismatch`; `packages/validator-core/src/byte-intake-availability.test.ts:191` asserts `/verifiedSummary/packageId` and expected/actual package identity evidence.
- Binary ref mismatch fails: stale verified-summary mismatch is asserted at `packages/validator-core/src/byte-intake-availability.test.ts:209`, and current-session verification mismatch is asserted at `packages/validator-core/src/byte-intake-availability.test.ts:264`.
- Digest mismatch fails: stale summary mismatch is asserted at `packages/validator-core/src/byte-intake-availability.test.ts:213`, and current-session mismatch is asserted at `packages/validator-core/src/byte-intake-availability.test.ts:268`.
- ByteLength mismatch fails: stale summary mismatch is asserted at `packages/validator-core/src/byte-intake-availability.test.ts:217`, and current-session mismatch is asserted at `packages/validator-core/src/byte-intake-availability.test.ts:272`.
- Missing current bytes fails: stale summary case at `packages/validator-core/src/byte-intake-availability.test.ts:68`, plain missing case at `packages/validator-core/src/byte-intake-availability.test.ts:115`, and reupload case at `packages/validator-core/src/byte-intake-availability.test.ts:292`.
- Requires-reupload state fails: `packages/validator-core/src/byte-intake-availability.test.ts:292` expects missing-current-session plus `byteAvailability.requiresReupload`, with shape and evidence asserted at `packages/validator-core/src/byte-intake-availability.test.ts:315` and `packages/validator-core/src/byte-intake-availability.test.ts:323`.
- Media type mismatch deterministic diagnostics are now covered: `packages/validator-core/src/byte-intake-availability.test.ts:233` expects `byteAvailability.mediaType.mismatch`; `packages/validator-core/src/byte-intake-availability.test.ts:276` asserts `/currentSessionVerificationReport/expectedMediaType` plus expected/actual declared metadata evidence.
- Domain A oracle integration remains covered through the validator boundary: `packages/validator-core/src/validators/byte-intake-availability-diagnostics.ts:64` delegates to `evaluatePackageBinaryCurrentSessionByteAvailability`, and `packages/validator-core/src/validators/byte-intake-availability-diagnostics.ts:84` maps Domain A issues into `ValidationCheckResultDto`.
- Package runtime callers get package identity/revision context: `packages/validator-core/src/validators/package-runtime.ts:116` passes `packageId` and `packageRevision` into `validateByteIntakePreflight` when callers omit them.
- Check catalog registration is pinned: the test checks all `byteAvailability.*` IDs at `packages/validator-core/src/byte-intake-availability.test.ts:32`, and the catalog entries exist at `packages/validator-core/src/check-catalog.ts:308`.
- Existing adjacent binary validator tests were not weakened. The tracked diff only adds `packageId`, `packageRevision`, and `currentSessionVerificationReport` to the summary pass case at `packages/validator-core/src/binary-asset-validator.test.ts:331`; existing byte-intake missing/mismatch assertions remain at `packages/validator-core/src/binary-asset-validator.test.ts:410`.

## Forbidden-Scope Check

No reviewed test depends on parser, image decode, archive import/export, File System Access API, drag-drop, Cubism, full renderer, or pixel oracle behavior.

Observed hits were expected negative assertions, unsupported-claim fixtures, existing catalog descriptions, or non-goal report text:

- `packages/validator-core/src/byte-intake-availability.test.ts:292` names a reupload test "without claiming parser, archive, or image decode support".
- `packages/validator-core/src/byte-intake-availability.test.ts:341` asserts messages/impact do not claim parser/archive/decode/raster support.
- `packages/validator-core/src/binary-asset-validator.test.ts:358` uses unsupported parser/decode/archive claims as validator negative test inputs.
- `packages/validator-core/src/validators/byte-intake-preflight.ts:438` describes unsupported parser/image decode/archive claims.

## Verification Commands And Results

- `git status --short -uall`: Domain B validator changes were present with unrelated Domain C/editor changes also in the worktree; unrelated changes were ignored.
- `git diff -- packages/validator-core/src/validators/byte-intake-preflight.ts packages/validator-core/src/validators/package-runtime.ts packages/validator-core/src/check-catalog.ts packages/validator-core/src/binary-asset-validator.test.ts`: inspected tracked Domain B diffs.
- `pnpm.cmd exec vitest run packages/validator-core/src/byte-intake-availability.test.ts packages/validator-core/src/binary-asset-validator.test.ts packages/validator-core/src/binary-asset-fixture.test.ts`: pass, 3 files / 18 tests.
- `pnpm.cmd typecheck`: pass.
- `git diff --check -- packages/validator-core/src/validators/byte-intake-preflight.ts packages/validator-core/src/validators/package-runtime.ts packages/validator-core/src/check-catalog.ts packages/validator-core/src/binary-asset-validator.test.ts discussion/implementation/waves/wave34/wave34-domain-b-validator-stale-summary-reupload-diagnostics-completion-report.md`: pass; Git emitted LF-to-CRLF working-copy warnings only.
- `Select-String -Path packages\validator-core\src\byte-intake-availability.test.ts,packages\validator-core\src\validators\byte-intake-availability-diagnostics.ts,discussion\implementation\waves\wave34\wave34-domain-b-validator-stale-summary-reupload-diagnostics-completion-report.md -Pattern '[ \t]+$'`: no trailing-whitespace matches.
- `rg -n "parser|archive|decode|raster|File System Access|drag-drop|drag drop|Cubism|full renderer|pixel oracle|IndexedDB|localStorage|base64|ZIP|PSD|PNG" <Domain B changed files>`: hits classified above; no forbidden implementation or forbidden oracle dependency found.
- `git diff -- package.json pnpm-lock.yaml pnpm-workspace.yaml packages/validator-core/package.json`: no output.
- `git status --short -uall package.json pnpm-lock.yaml pnpm-workspace.yaml packages\validator-core\package.json`: no output.

## Remaining Issues / Test Gaps

- No blocking gaps remain for the stated Domain B rubric.
- `byteAvailability.digest.unsupported` is registered and mapped to `needs_review`/`warning`, but the practical SHA-256-supported test environment does not exercise that branch. This is acceptable residual risk because the required rubric focuses fail diagnostics and current-session truthfulness.
- Combined precedence cases, such as stale verified summary plus reupload-required state in one call, are not separately pinned at validator-core. Domain A owns the precedence oracle, and Domain B covers each required failure mode through the validator boundary.

## User-Decision Points

None.
