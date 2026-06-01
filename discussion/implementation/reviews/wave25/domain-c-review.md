# Wave25 Domain C Review: Validator Rig Control Semantic Checks

Date: 2026-06-01
Role: Review-Sylph clean re-review
Target: `wave25-validator-rig-control-semantic-checks`
Status: `pass`

## Basis Reviewed

- `.agents/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `discussion/implementation/orchestration/wave25-plan.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/schema-and-id-conventions.md`
- `discussion/implementation/current-capability-map.md`
- `discussion/implementation/waves/wave24/wave24-final-report.md`
- `discussion/implementation/reviews/wave24/wave24-clean-integration-review.md`
- `discussion/implementation/waves/wave25/domain-a-completion-report.md`
- `discussion/implementation/reviews/wave25/domain-a-review.md`
- `discussion/acceptance-criteria/03_MVP_Acceptance_Criteria.md`
- `discussion/scenarios/03_MVP_Acceptance_Criteria.md`
- `discussion/design/mvp-authoring-runtime/04-validator-acceptance-runner-design.md`
- `discussion/design/module-contracts/validator-contract.md`
- `discussion/tests/traceability/test-traceability-matrix.md`
- `discussion/tests/fixtures/fixture-manifest.md`
- Changed validator files, relevant package-format rig control schema, runtime hierarchy/evidence surfaces, current diff, and test results.

## Re-review Findings

None.

## Fix Loop 1 Finding Closure

- Closed: `rigControl.cycle` now builds effective adjacency from both `childRigControlIds` and `parentId`-derived parent-to-child edges in `packages/validator-core/src/validators/rig-control-semantic.ts`, and the focused suite includes a parentId-only cycle regression.
- Closed: runtime evidence validation now compares enabled package rig controls against runtime snapshot `kind`, `enabled`, and `parentId`, and the focused suite covers mismatch evidence for all three fields plus missing snapshot evidence.
- Closed: parent/child backlink disagreement now emits formal `rigControl.parentChildMismatch`; `rigControl.invalidChildTargetKind` is restricted to malformed child collection/type mapping at schema validation.

## Design / Development Compliance

- Formal check IDs are dot-separated lower camelCase with no spaces: `rigControl.cycle`, `rigControl.parentMissing`, `rigControl.childMissing`, `rigControl.invalidChildTargetKind`, `rigControl.parentChildMismatch`, and `rigControl.runtimeEvidenceMissing`.
- Check catalog and validator contract drift is small and directly tied to the new rig-control diagnostics and validation rules.
- `packages/validator-core/src/index.ts` remains barrel-only: one pre-existing package-info export plus re-exports.
- Source organization is acceptable: the new semantic validator owns one concern, `package-runtime.ts` only wires it into existing validation collection, and `package-schema.ts` contains the narrow schema-to-diagnostic mapping needed before semantic validation can run.
- No dependency manifest or lockfile changes were observed for the reviewed dependency paths.
- Targeted forbidden-scope scan found no Domain C implementation dependency, Cubism SDK/Core use, Cubism Viewer/Physics compatibility claim, parser/archive/file-picker/image-decode implementation, or external dependency addition. The only hit was existing validator-contract policy text forbidding such claims.
- Existing source/PSD/binary/dynamics/viewer validator compatibility is preserved by the validator-core suite passing with the new rig-control validator wired in.

## Test Adequacy

The current focused coverage is adequate for Domain C risk:

- Catalog registration covers all new formal IDs.
- Valid parent-child rig control package validates with runtime evidence.
- Child-list cycles and parentId-only cycles produce deterministic `rigControl.cycle`.
- Missing parent, missing child rig control, and missing child drawable diagnostics are deterministic.
- Parent/child mismatch emits deterministic `rigControl.parentChildMismatch`.
- Invalid child target kind emits deterministic `rigControl.invalidChildTargetKind`.
- Runtime evidence gaps and `kind` / `enabled` / `parentId` mismatches emit deterministic `rigControl.runtimeEvidenceMissing`.
- Validator-core compatibility coverage still passes for existing validator paths and the Domain D fixture-facing rig-control contract tests present in the current worktree.

## Verification Performed

| Check | Result |
|---|---|
| `pnpm.cmd exec vitest run packages/validator-core/src/rig-control-semantic.test.ts` | pass; 1 file / 9 tests |
| `pnpm.cmd exec vitest run packages/validator-core/src` | pass; 13 files / 70 tests |
| `pnpm.cmd typecheck` | pass |
| `git diff --check -- packages/validator-core discussion/design/module-contracts/validator-contract.md discussion/implementation/waves/wave25 discussion/implementation/reviews/wave25` | pass; LF-to-CRLF warnings only |
| Dependency manifest / lockfile dirty check | pass; no relevant manifest/lockfile diff output |
| Public `index.ts` barrel read | pass; exports only |
| Targeted forbidden-scope scan | pass; only existing forbidden-claim policy wording in validator contract |
| Machine-readable ID spot check | pass for reviewed Domain C check IDs / target kind literals |

## Residual Risks

- The full worktree contains concurrent Wave25 changes outside Domain C; this review did not pass or fail those domains.
- Fixture expected artifacts for `parent-child-rigControl-diagonal` and `invalid-rigControl-cycle` remain Domain D / integration scope, although the current validator-core fixture-facing tests pass.
- Runtime evidence validation remains intentionally limited to project-defined runtime snapshot fields for enabled package rig controls; no runtime evaluator, operation handler, editor UI, Cubism compatibility, or warp lattice evaluator behavior is implemented or claimed by Domain C.
