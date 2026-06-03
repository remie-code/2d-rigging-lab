# Wave39 Domain B Completion Report

## Domain

- Target: `wave39-validator-product-report-aggregation`
- Scope: validator-core product preflight aggregation over existing validator reports
- Verdict: `done`
- Date: 2026-06-03

## Scope Changed

Domain B added validator-core aggregation for Domain A's product preflight report
contract. The new builder accepts existing `ValidationReportDto` reports plus
optional category evidence refs, preserves those targeted reports unchanged, and
emits a parsed `ProductPreflightReportDto`.

The aggregation is conservative:

- all Domain A required categories are always emitted in fixed contract order;
- failing targeted diagnostics become product-level `fail` categories with
  blocking reasons and diagnostic refs;
- warning / needs-review diagnostics remain warning diagnostic refs;
- truthfully unsupported targeted diagnostics become explicit `not_supported`
  product unsupported claims;
- missing evidence that validator-core cannot infer becomes explicit
  `not_evaluated`, not `pass`;
- failing unsupported transport capability diagnostics remain `fail`.

## Files Changed

- `packages/validator-core/src/product-preflight-report.ts`
- `packages/validator-core/src/product-preflight-report.test.ts`
- `packages/validator-core/src/index.ts`
- `discussion/implementation/waves/wave39/domain-b-validator-product-report-aggregation.md`

`packages/validator-core/src/index.ts` remains barrel-only.

## Implementation Evidence

- A valid MVP-like validation report with operation log, runtime snapshot, byte
  availability, transport capability, and tutorial readiness evidence produces
  deterministic `pass` statuses for all product categories.
- A strict report without operation log, runtime snapshot, byte availability,
  transport capability, or tutorial readiness evidence reports those categories
  as `not_evaluated`.
- Existing mesh diagnostics remain in the source validation report while the
  product report adds a mesh category blocking reason and preserves warning refs.
- A truthful `byteIntake.unsupportedClaim` targeted diagnostic becomes an
  explicit `not_supported` product unsupported claim and does not add specific
  AI repair, parser/image decode, archive/filesystem, renderer/pixel oracle, or
  Cubism compatibility claim kinds.
- A failing `transportCapability.unsupported` diagnostic remains a product
  `fail`, not a silent pass.

## Fix Loop 1

Review-Sylph returned `needs_changes` with two findings. Both were fixed:

- Category evidence refs are now filtered by the category's required
  `artifactKind`. Wrong-kind evidence no longer makes evidence-heavy categories
  pass; those categories remain `not_evaluated` until an allowed evidence kind is
  supplied.
- Validation report `packageHash` values are copied into product preflight only
  when they satisfy the product report machine-token constraint. Existing
  validation report hashes such as `sha256:tutorial-mini-model-final-v1` are
  preserved on the source report but omitted from the product preflight DTO.

Additional regression tests cover wrong-kind evidence and `sha256:...` source
report hashes while confirming diagnostic refs remain available.

## Verification Performed

- `pnpm.cmd exec vitest run packages/validator-core/src/product-preflight-report.test.ts`: pass, 7 tests
- `pnpm.cmd exec vitest run packages/validator-core/src/product-preflight-report.test.ts packages/validator-core/src/package-transport-capability-diagnostics.test.ts packages/validator-core/src/tutorial-readiness-validator.test.ts`: pass, 23 tests
- `pnpm.cmd typecheck`: pass

## Remaining Issues

- None for Domain B.
- Domain B does not implement runtime/package/AI bridge wiring, Editor UI,
  acceptance fixture registration, e2e smoke, repair generation, parser/image
  decode, archive/filesystem implementation, renderer/pixel validation, or
  Cubism compatibility.

## User-Decision Points

- None.

## Notes for Reviewer

- Review `buildProductPreflightReport` as an additive aggregation layer; it does
  not replace or mutate `ValidationReportDto`.
- Missing evidence defaults are intentionally conservative for evidence-heavy
  categories such as byte availability and transport capability.
- Unsupported product outcomes are diagnostic-derived only; the builder does not
  invent absent unsupported claims for AI repair, parser/image decode,
  archive/filesystem, renderer/pixel oracle, or Cubism compatibility.
