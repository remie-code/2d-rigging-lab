# Wave 23 Domain B Completion: Runtime Dynamics Sequence / Diff / Evidence

> Target: `wave23-runtime-dynamics-sequence-diff-evidence`  
> Domain: B  
> Status: `pass`

Orch-Sylph自身は実装担当ではない。source implementation は必ず別コンテキストの Gnome に委譲し、レビューは必ず別コンテキストの Review-Sylph に委譲すること。これを分離できない場合は実装せず escalate / blocked として報告すること。

## Delegation

- Implementation: Gnome the 20th (`019e7e10-65d8-7862-a3c0-fd08e4bf8d72`)
- Independent review: Sylph the 21st (`019e7e28-040c-7133-9cab-804c13be7e49`)
- Review artifact: `discussion/implementation/reviews/wave23/wave23-domain-b-runtime-dynamics-sequence-diff-evidence-review.md`

## Outcome

Domain B is `pass`.

Minimal Open Dynamics v1 runtime evaluation is now implemented as a deterministic runtime sequence. Runtime snapshots and diffs expose dynamics state, driver input relation, output parameter relation, and computed output. The computed dynamics parameter is projected into effective runtime parameters before existing keyform sampling, so downstream preview work can use the runtime projection without editor UI changes in this domain.

Domain A authoring/operation foundation was treated as the dependency basis. Parallel Domain C validator-core changes were present in the workspace but are outside Domain B.

## Changed Files

Domain B runtime-core source and tests:

- `packages/runtime-core/src/dynamics-evaluation.ts`
- `packages/runtime-core/src/dynamics-evaluation.test.ts`
- `packages/runtime-core/src/runtime-core.ts`
- `packages/runtime-core/src/snapshot.ts`
- `packages/runtime-core/src/snapshot-comparison.ts`
- `packages/runtime-core/src/initial-state.ts`
- `packages/runtime-core/src/state-compatibility.ts`
- `packages/runtime-core/src/index.ts`

Domain B review/report artifacts:

- `discussion/implementation/reviews/wave23/wave23-domain-b-runtime-dynamics-sequence-diff-evidence-review.md`
- `discussion/implementation/waves/wave23/wave23-domain-b-runtime-dynamics-sequence-diff-evidence-completion.md`

Existing Domain A operation-core / authoring-core changes and parallel Domain C validator-core changes remain separate workspace context, not Domain B source ownership.

## Verification

Gnome and Review-Sylph reported these checks:

| Command / check | Result |
|---|---|
| `pnpm.cmd exec vitest run packages/runtime-core/src/dynamics-evaluation.test.ts ...` | pass; 23 tests reported by Gnome |
| `pnpm.cmd exec vitest run packages/runtime-core/src/dynamics-evaluation.test.ts packages/runtime-core/src/runtime-core.test.ts packages/runtime-core/src/snapshot-comparison.test.ts packages/runtime-core/src/runtime-keyform-snapshot-integration.test.ts packages/runtime-core/src/keyform-target-application.test.ts` | pass; 5 files / 18 tests reported by Review-Sylph |
| `pnpm.cmd exec vitest run packages/runtime-core/src` | pass; 19 files / 59 tests |
| `pnpm.cmd exec vitest run packages/operation-core/src/operations/create-dynamics-group.test.ts packages/operation-core/src/operation-lifecycle.test.ts` | pass; 2 files / 21 tests |
| `pnpm.cmd typecheck` | pass in Review-Sylph verification |
| `pnpm.cmd run check:source` | pass |
| `pnpm.cmd run check:deps` | pass |
| `git diff --check -- packages/runtime-core packages/operation-core discussion/implementation/waves/wave23 discussion/implementation/reviews/wave23` | pass; CRLF working-copy warnings only |
| Manifest diff/status guard for `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `apps/editor/package.json`, and `packages/*/package.json` | pass; no dependency manifest changes reported |
| Forbidden scope guard | pass for Domain B; no editor/parser/asset I/O/external dependency/direct vertex physics/Cubism Physics compatibility implementation |

Orch-Sylph final status check showed expected Domain B runtime-core changes plus separate parallel Domain C validator-core changes. No editor source or dependency manifest changes were shown for Domain B.

## Review Result

Review verdict: `pass`.

Review-Sylph found no blocking, high, medium, or low findings.

Confirmed review lanes:

- deterministic dynamics semantics and sequence advancement
- runtime reset/initial state compatibility
- snapshot/evidence coverage for dynamics state, relation, and computed output
- runtime diff coverage for dynamics-relevant additions/removals and state/output changes
- preview-usable runtime projection through effective parameter values
- existing keyform runtime compatibility
- non-goals and forbidden-scope compliance
- source organization and dependency policy compliance
- focused test adequacy

## Residual Risks

- Domain C validator changes were present in the same workspace and must pass their own review before downstream domains proceed.
- Domain B proves runtime projection and evidence, but a concrete fixture/UI proof that a dynamics-computed output parameter drives a drawable/keyform workflow remains Domain D/E scope.
- Editor preview controls and preview reset/run UX remain Domain D scope.
- Fixture/contract evidence for the named minimal dynamics workflow remains Domain E scope.
- The solver is intentionally Minimum Open Dynamics v1 only. It is not direct vertex physics, cloth/collision/IK, Cubism Physics compatibility, or `.physics3.json` runtime support.

## Downstream Gate

Domain D and Domain E can proceed after Domain C also passes.
