# Wave 30 Domain C Review Note: Tutorial Readiness Validator / Preflight

## Verdict

pass after R2

## Reviewer

Review-Sylph, clean read-only contexts. Reviewers were separate from the Gnome implementation context and did not edit files.

## Scope Reviewed

- `packages/validator-core/src/check-catalog.ts`
- `packages/validator-core/src/index.ts`
- `packages/validator-core/src/validators/tutorial-readiness.ts`
- `packages/validator-core/src/tutorial-readiness-validator.test.ts`
- Topology compatibility only:
  - `packages/authoring-core/src/tutorial-mini-model-seed.ts`
  - `packages/operation-core/src/tutorial-mini-model-recipe.ts`

## Basis

- `.agents/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `discussion/implementation/orchestration/wave30-plan.md`
- `discussion/implementation/current-capability-map.md`
- `discussion/implementation/remaining-work-backlog.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/schema-and-id-conventions.md`
- `discussion/design/module-contracts/validator-contract.md`
- `discussion/design/mvp-authoring-runtime/04-validator-acceptance-runner-design.md`
- `discussion/tests/traceability/test-traceability-matrix.md`

## Initial Review Findings

Initial verdict: `needs_changes`.

1. Required part roles did not match the Wave30 tutorial recipe topology. The validator required `mouth` and `eye` as parts, while the recipe models them as drawables under the face part.
2. Missing required-slice tests asserted check IDs without enough deterministic status, severity, target path, and evidence checks.

## R1 Resolution

R1 re-review verdict: `needs_changes`.

- Required parts were aligned to `body`, `head`, `face`, `front_hair`, and `arm`.
- `mouth` and `eye` became required drawable/layer evidence under the face part.
- Required-slice tests were strengthened for deterministic diagnostics.

R1 remaining finding:

- `eye` readiness could be falsely satisfied by `eye_mask` because the matcher used token containment.

## R2 Resolution

R2 final re-review verdict: `pass`.

- Required drawable matching now distinguishes `eye` from `eye_mask`.
- The focused test removes `draw_eye` while leaving `draw_eye_mask` present and expects `tutorial.requiredDrawableMissing`.
- Prior topology and deterministic diagnostic findings were resolved.

## Design Compliance

- The implementation is tutorial-readiness-specific and does not redesign broad MVP preflight.
- Required slices are checked deterministically: part presence, mouth/eye drawable evidence, mesh evidence, mask/opacity evidence, rig control, keyform, dynamics, viewer evidence, stale evidence, missing refs, and unsupported claims.
- Unsupported real-asset, renderer, pixel oracle, public distribution, file I/O, image decode, archive, and Cubism compatibility claims are not used as oracles.
- Check IDs are dot-separated lowerCamel and contain no spaces.
- `packages/validator-core/src/index.ts` remains barrel-only.
- No operation handler, runtime evaluator, editor UI, dependency, manifest, or lockfile changes were introduced by Domain C.

## Test Adequacy

Adequate for Domain C risk.

Coverage includes:

- Valid Wave30-representative tutorial readiness pass.
- Missing required part.
- Missing `mouth` drawable.
- Missing `eye` drawable with `eye_mask` still present.
- Missing mesh, mask/opacity, rig control, keyform, dynamics, and viewer evidence.
- Stale runtime/viewer evidence.
- Missing rig-control keyform refs.
- Unsupported real-asset, renderer, and Cubism claims, plus truthful unsupported non-goal evidence.

## Verification Reviewed

- `pnpm.cmd exec vitest run packages/validator-core/src/tutorial-readiness-validator.test.ts` -> pass, 1 file / 6 tests.
- `pnpm.cmd typecheck` -> pass.
- `pnpm.cmd exec vitest run packages/validator-core/src/viewer-evidence.test.ts packages/validator-core/src/rig-control-runtime-evidence.test.ts packages/validator-core/src/dynamics-semantic.test.ts packages/validator-core/src/mask-composition-diagnostics.test.ts packages/validator-core/src/mesh-topology-diagnostics.test.ts packages/validator-core/src/tutorial-readiness-validator.test.ts` -> pass, 6 files / 41 tests.
- `pnpm.cmd exec vitest run packages/operation-core/src/wave30-tutorial-mini-model-recipe.test.ts` -> pass, 3 tests.

## Remaining Issues

No blocking issues remain.

Non-blocking notes:

- `tutorial-readiness.ts` is large but cohesive as a single tutorial validator for this wave. Future expansion should split role matching and diagnostic builders.
- Per-check related AC alignment can be revisited by Domain E/integration traceability if required.

## User-Decision Points

None.
