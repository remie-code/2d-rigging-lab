# Wave39 Domain C Review: Runtime / Package / AI Evidence Bridge

- Reviewer: Clean Review-Sylph
- Date: 2026-06-03
- Target: `wave39-runtime-package-ai-evidence-bridge`
- Review pass: fix loop 2 final re-review
- Verdict: `pass`

## Scope Reviewed

AI observation and command-surface files:

- `packages/ai-interface/src/ai-product-preflight-observation.ts`
- `packages/ai-interface/src/ai-product-preflight-observation.test.ts`
- `packages/ai-interface/src/ai-command-schema.test.ts`
- `packages/ai-interface/src/index.ts`
- `packages/ai-interface/src/ai-command-name.ts`
- `packages/ai-interface/src/ai-command-payload.ts`
- `packages/ai-interface/src/ai-command-request.ts`
- `packages/ai-interface/src/ai-command-response-payload.ts`
- `packages/ai-interface/src/ai-command-executor.ts`
- `packages/ai-interface/src/ai-read-command.ts`
- `packages/ai-interface/src/ai-command-transcript.ts`
- `packages/ai-interface/src/ai-read-command.test.ts`

Package/runtime bridge files:

- `packages/package-format/src/product-preflight-package-bridge.ts`
- `packages/package-format/src/product-preflight-package-bridge.test.ts`
- `packages/package-format/src/index.ts`
- `packages/runtime-core/src/product-preflight-runtime-bridge.ts`
- `packages/runtime-core/src/product-preflight-runtime-bridge.test.ts`
- `packages/runtime-core/src/index.ts`

Basis checked:

- `discussion/implementation/orchestration/wave39-plan.md`
- `discussion/design/module-contracts/validator-contract.md`
- `discussion/implementation/waves/wave39/domain-a-preflight-report-contract-foundation.md`
- `packages/contracts/src/product-preflight-report.ts`

## Findings

No blocking findings.

The two previous AI public-command mismatch findings are closed:

- `observeProductPreflightReport` is no longer present in the executable command schemas or dispatch surfaces. `AiCommandNameSchema` lists only `getEditorState`, `inspectModel`, `inspectTarget`, `validatePackage`, `dryRunOperation`, `commitOperation`, and `getOperationLog`.
- `AiCommandRequestSchema` and `AiCommandResponseSchema` now reject `command: "observeProductPreflightReport"` at runtime, and `ai-command-schema.test.ts` has explicit regression coverage for command name, request, and response rejection.
- The checked command files `ai-command-name.ts`, `ai-command-payload.ts`, `ai-command-request.ts`, `ai-command-response-payload.ts`, `ai-command-executor.ts`, `ai-read-command.ts`, `ai-command-transcript.ts`, and `ai-read-command.test.ts` contain no `observeProductPreflightReport`/preflight command support.

## Non-Blocking Observations

- The remaining AI helper is deterministic and schema-safe for future observation/transcript wiring: it parses the incoming product preflight report, emits categories in `PRODUCT_PREFLIGHT_REQUIRED_CATEGORY_IDS` order, sorts source validation report IDs, sorts category evidence/action IDs, sorts and dedupes evidence refs, and derives transcript evidence IDs from that stable evidence list.
- The helper remains a direct exported observation utility/schema, not a public executable AI command. This matches the fix-loop 2 direction and avoids the earlier editor-host dispatch mismatch.
- Package-format bridge output stays within evidence-ref adapter scope for byte availability and transport capability. It uses Domain A evidence-ref DTO validation and does not claim archive/filesystem implementation; the transport test asserts boundary-only wording.
- Runtime-core bridge output stays within runtime/viewer evidence refs. Its summaries explicitly avoid renderer/pixel oracle claims, and tests check for absence of renderer/pixel fields.
- `packages/ai-interface/src/index.ts`, `packages/package-format/src/index.ts`, and `packages/runtime-core/src/index.ts` are barrel-only.
- Reviewed diff scope shows no package manifest or lockfile changes.

## Verification Performed

- `rg -n "observeProductPreflightReport|ObserveProductPreflight|preflight" packages/ai-interface/src/ai-command-name.ts packages/ai-interface/src/ai-command-payload.ts packages/ai-interface/src/ai-command-request.ts packages/ai-interface/src/ai-command-response-payload.ts packages/ai-interface/src/ai-command-executor.ts packages/ai-interface/src/ai-read-command.ts packages/ai-interface/src/ai-command-transcript.ts packages/ai-interface/src/ai-read-command.test.ts`: no matches.
- `pnpm.cmd exec vitest run packages/package-format/src/product-preflight-package-bridge.test.ts packages/runtime-core/src/product-preflight-runtime-bridge.test.ts packages/ai-interface/src/ai-product-preflight-observation.test.ts packages/ai-interface/src/ai-read-command.test.ts packages/ai-interface/src/ai-command-schema.test.ts packages/ai-interface/src/ai-operation-command.test.ts`: pass, 6 files / 34 tests.
- `pnpm.cmd typecheck`: pass.
- `git diff --check -- packages/ai-interface/src packages/package-format/src packages/runtime-core/src discussion/implementation/reviews/wave39/domain-c-runtime-package-ai-evidence-bridge-review.md`: pass with CRLF conversion warnings only.
- `git diff -- packages/ai-interface/src/ai-command-name.ts packages/ai-interface/src/ai-command-payload.ts packages/ai-interface/src/ai-command-request.ts packages/ai-interface/src/ai-command-response-payload.ts packages/ai-interface/src/ai-command-executor.ts packages/ai-interface/src/ai-read-command.ts packages/ai-interface/src/ai-command-transcript.ts packages/ai-interface/src/ai-read-command.test.ts`: no diff.

## Test Adequacy

Focused coverage is adequate for the final Domain C scope. The regression test now proves the preflight observation helper is not accepted as an executable command request/response, while package/runtime bridge tests cover evidence shape, deterministic runtime/viewer mapping, and non-goal claims.

## Remaining Issues

- None for Wave39 Domain C.

## User-Decision Points

- None.
