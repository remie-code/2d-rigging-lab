# Wave 13 Alignment Completion: Diagnostic Policy Alignment

> Wave: `runtime-diff-and-grid2d-evidence-hardening`
> Domain: `wave13-diagnostic-policy-alignment`
> Verdict: `pass`

## Canonical Decision Recorded

`keyform.grid2dDuplicateKey` canonical severity is `error`.

Strict and acceptance profile behavior still fails on duplicate Grid2D coordinates. This alignment changes severity vocabulary only; it does not weaken the diagnostic or make acceptance pass.

Severity and profile failure status remain separate per `discussion/development_convention/diagnostic-policy.md`.

The unresolved severity statements in the earlier Domain B completion and review artifacts are historical pre-resolution notes and are superseded by this alignment decision.

## Files Changed

- `discussion/design/module-contracts/runtime-core-contract.md`
- `discussion/design/module-contracts/validator-contract.md`
- `discussion/implementation/orchestration/wave13-plan.md`
- `discussion/implementation/waves/wave13/wave13-diagnostic-policy-alignment-completion.md`
- `discussion/implementation/reviews/wave13/wave13-diagnostic-policy-alignment-review.md`

No runtime source or test files were edited.

## Basis Documents Used

- `.agents/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `discussion/implementation/orchestration/wave13-plan.md`
- `discussion/implementation/waves/wave13/wave13-keyform-diagnostic-regression-hardening-completion.md`
- `discussion/implementation/reviews/wave13/wave13-keyform-diagnostic-regression-hardening-review.md`
- `discussion/development_convention/diagnostic-policy.md`
- `discussion/design/module-contracts/runtime-core-contract.md`
- `discussion/design/module-contracts/validator-contract.md`
- `packages/runtime-core/src/keyform-sampling.ts`
- `packages/contracts/src/enums.ts`

## Implementation Summary

- Updated the runtime-core Grid2D rule from `blocking diagnostic` to `error diagnostic; strict and acceptance validation fail`.
- Updated the validator check catalog entry from severity `blocking` / `all: fail` to severity `error` / `strict/acceptance: fail`.
- Clarified acceptance profile wording so acceptance can fail on formal acceptance-failing diagnostics as well as blocking checks.
- Added a Wave 13 execution note that this alignment supersedes prior unresolved Domain B severity wording.

## Review Findings

Clean review gate used subagents.

Design / Development Compliance: `pass`.

- No blocking findings.
- Confirmed policy, validator contract, runtime-core contract, wave plan, and runtime implementation agree on severity `error`.
- Confirmed strict/acceptance failure behavior remains preserved.
- Advisory: `discussion/design/module-contracts/fixtures-and-contract-tests.md` still uses broad `severity=error/blocking` wording for `keyform-grid-invalid`, but that document was outside this domain write scope and was not part of the active Domain B conflict basis.

Test Adequacy / Oracle Adequacy: initially `needs_changes`, resolved by integration.

- Finding: prior Domain B completion/review artifacts still described the severity conflict as unresolved.
- Resolution: `discussion/implementation/orchestration/wave13-plan.md` and this completion report now state those prior artifacts are historical pre-resolution notes superseded by the new alignment decision.
- Domain B now has a stable oracle for `keyform.grid2dDuplicateKey`: check ID `keyform.grid2dDuplicateKey`, severity `error`, strict/acceptance fail behavior.

## Verification Performed

- `rg` search confirmed no remaining active basis wording that assigns `keyform.grid2dDuplicateKey` severity `blocking` in the aligned files.
- `git diff --check -- discussion/design/module-contracts/runtime-core-contract.md discussion/design/module-contracts/validator-contract.md discussion/implementation/orchestration/wave13-plan.md discussion/implementation/waves/wave13/wave13-diagnostic-policy-alignment-completion.md discussion/implementation/reviews/wave13/wave13-diagnostic-policy-alignment-review.md` passed with line-ending warnings only.
- `rg -n "[ \t]+$"` over the same file set returned no matches.

## Remaining Issues

- Domain B diagnostic regression tests remain unimplemented and should resume using this alignment decision.
- The old Domain B escalation artifacts remain historical and should not be used as current severity authority without this alignment report.
- The advisory broad wording in `discussion/design/module-contracts/fixtures-and-contract-tests.md` remains out of scope for this domain.

## User-Decision Points

- None.
