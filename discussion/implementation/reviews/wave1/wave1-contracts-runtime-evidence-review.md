# Wave 1 Contracts Runtime Evidence Review

> Date: 2026-05-29  
> Domain: `wave1-contracts-runtime-evidence`  
> Reviewer mode: Clean-context Review-Sylph + Orch-Sylph integration review  
> Verdict: `pass`

## Basis

- `discussion/implementation/orchestration/wave1-plan.md`
- `discussion/design/module-contracts/module-boundaries.md`
- `discussion/design/module-contracts/typescript-contracts.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/schema-and-id-conventions.md`
- `discussion/development_convention/module-boundary-policy.md`

## Reviewed Scope

- `packages/contracts/src/runtime-artifact-refs.ts`
- `packages/contracts/src/runtime-state.ts`
- `packages/contracts/src/runtime-sequence.ts`
- `packages/contracts/src/runtime-evidence.test.ts`

## Design / Development Compliance Review

Verdict: `pass`

- Runtime evidence contracts are implemented as Zod DTO schemas in `packages/contracts`, with no runtime evaluator algorithm, file IO, GUI, renderer, AI, Cubism, or downstream module behavior.
- `RuntimeStateArtifactRefSchema` and `RuntimeStateSequenceArtifactRefSchema` constrain generated evidence refs to the documented `runtime/states/*.runtime-state.json` and `runtime/state-sequences/*.runtime-state-sequence.json` paths.
- `RuntimeStateDtoSchema` reuses `PackageIdSchema` and `DynamicsGroupIdSchema`; sequence frame input reuses `ParameterIdSchema`; runtime context reuses the runtime enum schemas from `enums.ts`.
- `RuntimeSequenceEvaluationContextSchema` is a compatibility alias of `RuntimeEvaluationContextSchema`, matching the contract sketch.
- DTO naming policy is covered by keeping the sketch-required names and adding `*DtoSchema` aliases where the schema convention asks for DTO-aligned names.
- `states.length = frameCount + 1` is not enforced by Zod refinement in this slice. This matches the domain instruction to keep the schema structural and leave mismatch reporting to the later runtime/validator diagnostic path.
- `packages/contracts/src/index.ts` was not edited; public export integration remains owned by `wave1-contracts-integration`.
- Source files remain responsibility-scoped and no catch-all file was created.

## Test Adequacy Review

Verdict: `pass`

- Artifact ref tests cover valid generated refs, authored-file rejection, nested path rejection, and wrong suffix/path-family rejection.
- Runtime state tests cover valid dynamics group state parsing plus invalid package ID and non-finite dynamics value rejection.
- Runtime sequence frame tests cover default arrays/maps and authored parameter values keyed by `ParameterIdSchema`.
- Runtime evaluation context tests cover default policy strictness and the compatibility alias.
- Runtime state sequence artifact tests cover a valid structural evidence artifact with package metadata, context, evaluator summary, and ordered states.

## Independent Review Result

Clean-context Review-Sylph returned `pass`.

- No blocking or medium findings.
- Test coverage was assessed as sufficient for the assigned slice.
- Remaining non-blocking note: `states.length = frameCount + 1` remains semantic evidence for later runtime/validator diagnostics, not a schema refinement here.
- User-decision points: none.

## Verification Evidence Considered

| Command | Outcome |
|---|---|
| `pnpm.cmd typecheck` | pass |
| `pnpm.cmd test` | pass, 5 files / 68 tests after sandbox EPERM rerun with escalation |
| `pnpm.cmd exec vitest run packages/contracts/src/runtime-evidence.test.ts` | pass, 1 file / 9 tests after sandbox EPERM rerun with escalation |
| `pnpm.cmd check:source` | pass; also confirmed inside final `pnpm check` |
| `pnpm.cmd check` | pass after sandbox EPERM rerun with escalation |

## Remaining Issues

- `packages/contracts/src/index.ts` does not export the new runtime evidence contracts yet. This is intentional; `wave1-contracts-integration` owns exports.
- The sequence length rule is structural/semantic evidence only in this slice and should be diagnosed later as `runtime.stateSequenceLengthMismatch`.

## User-Decision Points

- None.
