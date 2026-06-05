# Wave45 Domain E Review: Validator / Product Preflight PSD Import Diagnostics

> Target: `wave45-validator-product-preflight-psd-import-diagnostics`
> Role: Review-Sylph independent clean-context reviewer
> Caller: Orch-Sylph
> Loop: 1 follow-up
> Date: 2026-06-05
> Verdict: `pass`

## Verdict

`pass`

The previous blocking truthfulness finding is closed. Parsed Domain B materialization failures are now surfaced as missing selected materialization evidence and Product Preflight reports them as `not_evaluated` `sourceMaterialization` claims.

This review was performed by Review-Sylph separately from the Gnome implementation agent. I did not rely only on the implementation summary; I inspected the changed source, tests, policy basis, Domain B/C evidence shape, parser import scans, and verification commands.

## Scope Reviewed

Changed files reviewed:

- `packages/validator-core/src/psd-import-preflight-diagnostics.ts`
- `packages/validator-core/src/psd-import-preflight-diagnostics.test.ts`
- `packages/validator-core/src/product-preflight-report.ts`
- `packages/validator-core/src/product-preflight-report.test.ts`
- `packages/validator-core/src/wave44-psd-fixture-evidence-regression.test.ts`
- `packages/validator-core/src/index.ts`
- `discussion/implementation/waves/wave45/wave45-domain-e-validator-product-preflight-psd-import-diagnostics-report.md`

Review focus:

- Domain B-shaped parsed materialization failure evidence.
- No direct parser dependency import in validator-core / production packages.
- Product Preflight status and claim behavior for parse failure, oversize, missing bytes, unsupported features, not-evaluated features, selected materialization missing, and successful materialization availability.
- No full compositing, renderer, pixel oracle, Cubism, public demo asset, persisted/exported Product Preflight, archive/filesystem, drag-drop, or repair/LLM claim.
- Source organization and `index.ts` barrel-only compliance.
- Focused regression test adequacy after the loop 1 fix.

## Basis Documents Used

- `discussion/implementation/orchestration/wave45-plan.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/diagnostic-policy.md`
- `discussion/development_convention/schema-and-id-conventions.md`
- `discussion/implementation/waves/wave45/wave45-domain-b-browser-psd-parser-bridge-session-evidence-report.md`
- `discussion/implementation/reviews/wave45/wave45-domain-b-browser-psd-parser-bridge-session-evidence-review.md`
- `discussion/implementation/waves/wave45/wave45-domain-c-package-operation-psd-import-evidence-bridge-report.md`
- `discussion/implementation/reviews/wave45/wave45-domain-c-package-operation-psd-import-evidence-bridge-review.md`
- `discussion/implementation/waves/wave45/wave45-domain-e-validator-product-preflight-psd-import-diagnostics-report.md`
- `.codex/skills/implementation-orchestration/SKILL.md`

## Closed Finding

Previous `needs_fix` finding:

- Parsed Domain B materialization failures could be dropped, allowing Product Preflight to pass selected materialization availability falsely.

Closure:

- `packages/validator-core/src/psd-import-preflight-diagnostics.ts` now treats materialization failure evidence as missing selected materialization when any of these are present:
  - top-level `failureKind: "materializationFailure"`
  - `errorEvidence[].failureKind = "materializationFailure"`
  - `diagnostics[].checkId = "browserPsdParser.materialization.failed"`
  - `adapterResult.diagnostics[].checkId = "browserPsdParser.materialization.failed"`
- The resulting validator check is `asset.psd.materializationEvidenceMissing`.
- `packages/validator-core/src/product-preflight-report.ts` maps `asset.psd.materializationEvidenceMissing` to a `not_evaluated` claim with `evidenceKind: "sourceMaterialization"`.
- `packages/validator-core/src/psd-import-preflight-diagnostics.test.ts` adds a Domain B-shaped parsed result regression asserting the missing materialization diagnostic and Product Preflight `not_evaluated` outcome.

## Design / Development Compliance

`pass`

- No direct production package / validator-core `@webtoon/psd` import or require was found.
- `packages/validator-core/src/index.ts` remains barrel-only; the change is a single re-export.
- New validator-core source is a named responsibility file, not a catch-all or implementation-heavy entrypoint.
- `asset.psd.*` diagnostics used by Domain E are catalog-backed in `packages/validator-core/src/check-catalog.ts`.
- Product Preflight remains session-generated/read-only and does not add persisted/exported artifact, CI/release/demo gate, parser execution, renderer/pixel oracle, full compositing, Cubism, archive/filesystem, drag-drop, or public demo asset scope.

## Test Adequacy

`pass`

Focused tests cover:

- Browser parse success and selected materialization availability without renderer/pixel/full-compositing claims.
- Parser size-cap rejection as Product Preflight fail.
- Parser failure as Product Preflight fail.
- Missing current bytes and reupload-required state as fail.
- Unsupported PSD feature evidence as `not_supported`.
- Not-evaluated PSD feature evidence as `not_evaluated`.
- Missing selected materialization evidence as `not_evaluated`.
- Parsed Domain B materialization failure evidence as missing selected materialization.
- Existing Wave44 private PSD fixture regression updated so `asset.psd.featureNotEvaluated` stays visible as a `not_evaluated` claim while pass diagnostics remain diagnostic refs.

## Verification Inspected / Performed

Performed during follow-up review:

- `pnpm.cmd exec vitest run packages/validator-core/src/psd-import-preflight-diagnostics.test.ts packages/validator-core/src/product-preflight-report.test.ts packages/validator-core/src/wave44-psd-fixture-evidence-regression.test.ts`
  - Passed: 3 files, 17 tests.
- `pnpm.cmd typecheck`
  - Passed root and Editor TypeScript checks.
- `pnpm.cmd run check:source`
  - Passed: `Source organization guard passed.`
- `rg -n -F '@webtoon/psd' packages --glob '!**/*.test.ts'`
  - No matches.
- `git diff --check -- packages/validator-core/src/index.ts packages/validator-core/src/product-preflight-report.ts packages/validator-core/src/product-preflight-report.test.ts packages/validator-core/src/wave44-psd-fixture-evidence-regression.test.ts`
  - No whitespace findings; LF/CRLF warnings only.
- `git diff --no-index --check -- NUL packages/validator-core/src/psd-import-preflight-diagnostics.ts`
  - No whitespace findings; expected nonzero no-index exit with LF/CRLF warning only.
- `git diff --no-index --check -- NUL packages/validator-core/src/psd-import-preflight-diagnostics.test.ts`
  - No whitespace findings; expected nonzero no-index exit with LF/CRLF warning only.
- `git diff --no-index --check -- NUL discussion/implementation/waves/wave45/wave45-domain-e-validator-product-preflight-psd-import-diagnostics-report.md`
  - No whitespace findings; expected nonzero no-index exit with LF/CRLF warning only.

Also inspected:

- Gnome's reported focused vitest, typecheck, parser import scan, and whitespace checks.
- Domain B source/report/review evidence shape for parsed materialization failures.
- Domain C report/review for parser-free package/session evidence boundary.
- Diagnostic catalog entries for `asset.psd.adapterDiagnostic`, `asset.psd.featureUnsupported`, `asset.psd.featureNotEvaluated`, and `asset.psd.materializationEvidenceMissing`.

## Remaining Issues / User Decision Points

No remaining Domain E issues.

No user decision is required for Domain E.

Future user decisions remain outside this domain for public demo assets, public sample PSD visual distribution, archive/filesystem/drag-drop/File System Access API, full renderer/pixel oracle, Cubism compatibility, or repo-side repair/LLM/autofix scope.
