# Wave 23 Domain E Completion: Dynamics Fixtures / Contract Evidence

> Target: `wave23-dynamics-fixtures-contract-evidence`  
> Domain: E  
> Status: `pass`  
> Date: 2026-05-31

Orch-Sylph自身は実装担当ではない。source implementation は必ず別コンテキストの Gnome に委譲し、レビューは必ず別コンテキストの Review-Sylph に委譲すること。これを分離できない場合は実装せず escalate / blocked として報告すること。

## Delegation

- Implementation: Gnome the 24th (`019e7e37-5a3a-7382-80b6-e2a915cb9b77`)
- Independent review: Sylph the 25th (`019e7e53-495f-7cb2-96ae-a324cf42ecb4`)
- Review artifact: `discussion/implementation/reviews/wave23/wave23-domain-e-dynamics-fixtures-contract-evidence-review.md`

## Outcome

Domain E is `pass`.

Minimum Open Dynamics v1 now has deterministic contract fixture evidence for:

- operation request/result and operation log evidence;
- runtime snapshot summary, runtime diff summary, and computed output projection into a keyform-driven drawable;
- validator baseline failure, candidate pass, validation diff, and edge diagnostics;
- editor-facing evidence summary that Domain D/F can reference without requiring editor UI implementation.

The fixture is scoped to Open Dynamics v1 and does not claim Cubism Physics compatibility, direct vertex physics, parser behavior, file picker behavior, asset I/O expansion, or external dependency behavior.

## Changed Files

Domain E fixture artifacts:

- `fixtures/contracts/minimum-open-dynamics-v1-evidence/fixture-manifest.json`
- `fixtures/contracts/minimum-open-dynamics-v1-evidence/baseline-package.json`
- `fixtures/contracts/minimum-open-dynamics-v1-evidence/request/create-dynamics-group-dry-run.request.json`
- `fixtures/contracts/minimum-open-dynamics-v1-evidence/request/create-dynamics-group-commit.request.json`
- `fixtures/contracts/minimum-open-dynamics-v1-evidence/expected/operation-result-evidence-summary.json`
- `fixtures/contracts/minimum-open-dynamics-v1-evidence/expected/runtime-snapshot-summary.json`
- `fixtures/contracts/minimum-open-dynamics-v1-evidence/expected/runtime-diff-summary.json`
- `fixtures/contracts/minimum-open-dynamics-v1-evidence/expected/validation-report-summary.json`
- `fixtures/contracts/minimum-open-dynamics-v1-evidence/expected/validation-edge-diagnostics-summary.json`
- `fixtures/contracts/minimum-open-dynamics-v1-evidence/expected/editor-facing-evidence-summary.json`

Focused fixture tests:

- `packages/operation-core/src/dynamics-contract-evidence-fixture.test.ts`
- `packages/runtime-core/src/dynamics-contract-evidence-fixture.test.ts`
- `packages/validator-core/src/dynamics-contract-evidence-fixture.test.ts`

Report artifact:

- `discussion/implementation/waves/wave23/wave23-domain-e-dynamics-fixtures-contract-evidence-completion.md`
- `discussion/implementation/reviews/wave23/wave23-domain-e-dynamics-fixtures-contract-evidence-review.md`

No production source files, editor UI files, package manifests, lockfiles, or external dependencies were changed by Domain E.

## Verification

| Command / check | Result |
|---|---|
| `pnpm.cmd exec vitest run packages/operation-core/src/dynamics-contract-evidence-fixture.test.ts packages/runtime-core/src/dynamics-contract-evidence-fixture.test.ts packages/validator-core/src/dynamics-contract-evidence-fixture.test.ts` | pass; 3 files / 7 tests |
| `pnpm.cmd exec vitest run packages/operation-core/src/dynamics-contract-evidence-fixture.test.ts packages/operation-core/src/operations/create-dynamics-group.test.ts packages/runtime-core/src/dynamics-contract-evidence-fixture.test.ts packages/runtime-core/src/dynamics-evaluation.test.ts packages/validator-core/src/dynamics-contract-evidence-fixture.test.ts packages/validator-core/src/dynamics-semantic.test.ts` | pass; 6 files / 18 tests |
| `pnpm.cmd run typecheck:root` | pass |
| `pnpm.cmd typecheck` | pass in final Orch-Sylph verification |
| `git diff --check -- fixtures/contracts packages/operation-core packages/runtime-core packages/validator-core discussion/implementation/waves/wave23 discussion/implementation/reviews/wave23` | pass; Git emitted LF-to-CRLF working-copy warnings only |

## Residual Risks

- Domain E pins editor-facing evidence as a reference artifact only. Browser/editor UI and save/load smoke remain Domain D/F scope.
- The user mentioned `discussion/development_convention/dependency-management-policy.md`, but that path is absent. Domain E used `discussion/development_convention/dependency-policy.md` as instructed by the assignment fallback.

## Edge Diagnostic Coverage

`expected/validation-edge-diagnostics-summary.json` pins representative outputs for the Domain C residual risks:

- duplicate output target;
- wrong source type;
- output-as-driver;
- runtime snapshot group/output parameter mismatch;
- runtime output out of range;
- clamped output evidence.

## Escalation

None for Domain E.
