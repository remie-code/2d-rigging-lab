# Wave39 Domain B Review

## Verdict

`pass`

## Scope Reviewed

- `packages/validator-core/src/product-preflight-report.ts`
- `packages/validator-core/src/product-preflight-report.test.ts`
- `packages/validator-core/src/index.ts`
- `discussion/implementation/waves/wave39/domain-b-validator-product-report-aggregation.md`

Parallel Domain A/C changes and unrelated modified files were treated as out of scope except where Domain B imports the Domain A contract.

## Basis Used

- `packages/contracts/src/product-preflight-report.ts`
- `discussion/design/module-contracts/validator-contract.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `.agents/skills/implementation-orchestration/SKILL.md`

## Findings

None.

## Review Notes

- Previous finding 1 is closed. Domain B now filters category evidence refs through `REQUIRED_EVIDENCE_KINDS` before using them for category evidence/evaluation (`packages/validator-core/src/product-preflight-report.ts:78`, `packages/validator-core/src/product-preflight-report.ts:389`, `packages/validator-core/src/product-preflight-report.ts:523`). The wrong-kind regression keeps `assetBytes` at `not_evaluated` and drops the operation-log ref (`packages/validator-core/src/product-preflight-report.test.ts:153`).
- Previous finding 2 is closed. Product preflight copies `packageHash` only when it matches the Domain A machine-token constraint (`packages/validator-core/src/product-preflight-report.ts:63`, `packages/validator-core/src/product-preflight-report.ts:113`, `packages/validator-core/src/product-preflight-report.ts:857`). The regression preserves the source `sha256:...` hash while omitting it from product output (`packages/validator-core/src/product-preflight-report.test.ts:250`).
- Status derivation is deterministic and conservative: category order is contract order, failing diagnostics are evaluated before unsupported/not-evaluated/warn/pass, and summary status ranks `fail` before `not_supported`, `not_evaluated`, `warn`, and `pass` (`packages/validator-core/src/product-preflight-report.ts:122`, `packages/validator-core/src/product-preflight-report.ts:157`, `packages/validator-core/src/product-preflight-report.ts:746`).
- Validator integrity is preserved. The aggregator reads source checks into diagnostic refs and does not mutate reports; the focused test snapshots source checks while adding product blocking reasons (`packages/validator-core/src/product-preflight-report.ts:144`, `packages/validator-core/src/product-preflight-report.test.ts:191`).
- Evidence and outcome links are AI-readable: blocking reasons, unsupported claims, not-evaluated claims, diagnostic refs, and recommended actions include stable ids, status/severity, messages, targets where present, and next actions (`packages/validator-core/src/product-preflight-report.ts:313`, `packages/validator-core/src/product-preflight-report.ts:329`, `packages/validator-core/src/product-preflight-report.ts:352`, `packages/validator-core/src/product-preflight-report.ts:538`, `packages/validator-core/src/product-preflight-report.ts:715`).
- Non-goals are respected. No AI repair, LLM provider, natural-language repair, parser/image decode, archive/filesystem, renderer/pixel oracle, or Cubism compatibility implementation/claim is added; unsupported claims are kept generic and explicitly exclude forbidden specific claim kinds in tests (`packages/validator-core/src/product-preflight-report.test.ts:288`).
- Development compliance is acceptable. `index.ts` adds only the barrel export, no dependency manifest or lockfile diff was present for the checked dependency files, and the Domain B completion report exists.

## Verification Performed

- `pnpm.cmd exec vitest run packages/validator-core/src/product-preflight-report.test.ts packages/validator-core/src/package-transport-capability-diagnostics.test.ts packages/validator-core/src/tutorial-readiness-validator.test.ts`: pass, 3 files / 23 tests.
- `pnpm.cmd typecheck`: pass.
- `git diff --check -- packages\validator-core\src discussion\implementation\waves\wave39`: pass with only the existing LF/CRLF warning for `packages/validator-core/src/index.ts`.
- `git diff --name-only -- package.json pnpm-lock.yaml pnpm-workspace.yaml packages\validator-core\package.json`: no dependency manifest or lockfile changes.

PowerShell and Node sandbox spawning failed with `windows sandbox failed: spawn setup refresh`; read-only inspection and verification commands were run with escalation because the sandbox could not spawn them.

## Remaining Issues

None for Domain B.

## User-Decision Points

None.

## Fix Recommendations

None.
