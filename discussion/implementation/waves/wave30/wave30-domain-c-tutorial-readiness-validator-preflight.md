# Wave 30 Domain C Completion Report: Tutorial Readiness Validator / Preflight

## Verdict

pass

## Domain

- Target: `wave30-tutorial-readiness-validator-preflight`
- Purpose: tutorial mini model readiness validator / preflight profile.
- Orchestration: Gnome implementation and Review-Sylph review were separated. Orch-Sylph did not implement source changes.
- Fix loops: 2. Initial review returned `needs_changes`; R1 re-review returned `needs_changes`; R2 final re-review returned `pass`.

## Files Changed

- `packages/validator-core/src/check-catalog.ts`
- `packages/validator-core/src/index.ts`
- `packages/validator-core/src/validators/tutorial-readiness.ts`
- `packages/validator-core/src/tutorial-readiness-validator.test.ts`
- `discussion/implementation/waves/wave30/wave30-domain-c-tutorial-readiness-validator-preflight.md`
- `discussion/implementation/reviews/wave30/wave30-domain-c-tutorial-readiness-validator-preflight-review.md`

## Evidence

- Added `tutorial_readiness` validation phase and tutorial-specific check catalog entries.
- Added a dedicated tutorial readiness validator that checks required parts, required mouth/eye drawable evidence, generated mesh evidence, mask or opacity evidence, rotation2d rig control evidence, rig-control angle keyform evidence, dynamics evidence, runtime/viewer freshness, missing references, and unsupported claims.
- Aligned required part topology with the Wave30 tutorial recipe: `body`, `head`, `face`, `front_hair`, and `arm` are parts; `mouth` and `eye` are required face drawables.
- Unsupported real-asset, image decode, file picker, archive, full renderer, pixel oracle, public tutorial distribution, and Cubism compatibility claims are rejected when claimed present/required, and reported as `not_applicable/info` when truthfully declared unsupported.
- `packages/validator-core/src/index.ts` remains barrel-only.

## Verification

Performed by Gnome:

- `pnpm.cmd exec vitest run packages/validator-core/src/tutorial-readiness-validator.test.ts` -> pass, 1 file / 6 tests.
- `pnpm.cmd typecheck` -> pass.
- `pnpm.cmd exec vitest run packages/validator-core/src/viewer-evidence.test.ts packages/validator-core/src/rig-control-runtime-evidence.test.ts packages/validator-core/src/dynamics-semantic.test.ts packages/validator-core/src/mask-composition-diagnostics.test.ts packages/validator-core/src/mesh-topology-diagnostics.test.ts packages/validator-core/src/tutorial-readiness-validator.test.ts` -> pass, 6 files / 41 tests.
- Source checks: `index.ts` barrel-only, no dependency or manifest changes, whitespace checks passed with CRLF warnings only.

Performed by Review-Sylph:

- Initial review ran focused validator tests, related validator tests, and typecheck; verdict `needs_changes`.
- R1 re-review ran focused validator tests, related validator tests, and typecheck; verdict `needs_changes`.
- R2 final re-review ran focused validator tests, typecheck, related validator tests, and the Wave30 recipe test; verdict `pass`.

Performed by Orch-Sylph final check:

- `pnpm.cmd exec vitest run packages/validator-core/src/tutorial-readiness-validator.test.ts` -> pass, 1 file / 6 tests.
- `pnpm.cmd typecheck` -> pass.
- `git diff --check -- packages/validator-core/src/check-catalog.ts packages/validator-core/src/index.ts packages/validator-core/src/validators/tutorial-readiness.ts packages/validator-core/src/tutorial-readiness-validator.test.ts` -> no whitespace errors; CRLF warnings only.
- Scoped status confirmed Domain C implementation changes are limited to `packages/validator-core/src/**`; no package manifest or lockfile changes were present in the scoped check.

## Review Findings And Fix Loops

Initial Review-Sylph verdict: `needs_changes`.

- Required part roles did not match the Wave30 recipe topology. The validator required `mouth` and `eye` as parts, while the recipe models them as drawables under the face part.
- Required missing-slice tests mostly asserted check IDs only and did not prove deterministic status, severity, target path, and evidence.

R1 fix:

- Changed required part defaults to `body`, `head`, `face`, `front_hair`, and `arm`.
- Added required mouth/eye drawable readiness checks under the face part.
- Strengthened deterministic assertions for missing part, drawable, mesh, mask/opacity, rig, keyform, dynamics, and viewer evidence.

R1 Review-Sylph verdict: `needs_changes`.

- `eye` readiness could be falsely satisfied by `eye_mask` because token containment allowed `draw_eye_mask` to satisfy required `eye` evidence.

R2 fix:

- Tightened required drawable role matching so `eye_mask` does not satisfy `eye`.
- Added deterministic coverage for `withoutDrawable("draw_eye")` while leaving `draw_eye_mask` present.

R2 Review-Sylph verdict: `pass`.

Review note: `discussion/implementation/reviews/wave30/wave30-domain-c-tutorial-readiness-validator-preflight-review.md`

## Remaining Issues

No blocking Domain C issues remain.

Non-blocking notes:

- `tutorial-readiness.ts` is cohesive enough for this domain, but future expansion should split role matching and diagnostic builders.
- `tutorial.unsupportedClaim` is cataloged with `AC-MVP-015` and `AC-MVP-016`; emitted tutorial checks use the shared tutorial related AC set, which includes `AC-MVP-016` but not `AC-MVP-015`. Domain E or integration traceability may choose to align per-check related AC.

## User-Decision Points

None.
