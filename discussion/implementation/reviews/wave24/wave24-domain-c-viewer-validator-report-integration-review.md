# Wave 24 Domain C Review: Viewer Validator Report Integration

> Target: `wave24-viewer-validator-report-integration`
> Implementer: `019e7ece-dcfe-7990-9393-4482a7a185c8` / `Gnome the 38th`
> Role: independent Review-Sylph
> Status: `pass`

## Scope

Reviewed the Domain C implementation directly from changed files, git diff, source, tests, and required basis documents. I did not rely on the Gnome report as the only source and did not edit implementation files. The only write performed by this review is this artifact.

Changed Domain C files inspected:

- `packages/validator-core/src/validators/viewer-evidence.ts`
- `packages/validator-core/src/validators/package-runtime.ts`
- `packages/validator-core/src/check-catalog.ts`
- `packages/validator-core/src/index.ts`
- `packages/validator-core/src/viewer-evidence.test.ts`
- `discussion/design/module-contracts/validator-contract.md`
- `discussion/implementation/waves/wave24/wave24-domain-c-viewer-validator-report-integration-completion.md`

## Findings

No blocking, high, medium, or low findings.

## Design / Development Compliance

Result: `pass`.

- The new validator consumes Domain A's `ViewerRuntimeEvaluationEvidenceSchema` and `RuntimeSnapshotDto` rather than reimplementing viewer runtime semantics (`packages/validator-core/src/validators/viewer-evidence.ts:11`, `packages/validator-core/src/validators/viewer-evidence.ts:64`). Domain A's evidence is created from `evaluateViewerRuntimeSnapshot` and carries `runtimeEvaluationContext` (`packages/runtime-core/src/viewer-evaluation.ts:102`, `packages/runtime-core/src/viewer-evaluation.ts:251`).
- Viewer-specific diagnostics are limited to two deterministic check IDs, `viewer.runtimeEvidenceMissing` and `viewer.runtimeEvidenceStale`, registered in the catalog and contract (`packages/validator-core/src/check-catalog.ts:424`, `packages/validator-core/src/check-catalog.ts:432`, `discussion/design/module-contracts/validator-contract.md:113`, `discussion/design/module-contracts/validator-contract.md:114`).
- `validatePackageRuntime` and `validatePackageRuntimeWithBinaryAssets` preserve existing package/source/PSD/binary/dynamics validation flow and add viewer evidence checks as a narrow additional step (`packages/validator-core/src/validators/package-runtime.ts:48`, `packages/validator-core/src/validators/package-runtime.ts:97`).
- Report refs are stored through the existing validation report evidence shape, using `runtimeSnapshotIds` and `supplementalGuiEvidenceRefs` without broad report schema redesign (`packages/validator-core/src/validation-report.ts:56`, `packages/validator-core/src/validation-report.ts:60`, `packages/validator-core/src/validators/package-runtime.ts:72`, `packages/validator-core/src/validators/package-runtime.ts:121`).
- Snapshot artifact refs are package-relative and deterministic via `createRuntimeSnapshotArtifactPath` (`packages/runtime-core/src/runtime-snapshot-artifacts.ts:23`).
- `packages/validator-core/src/index.ts` remains barrel-only (`packages/validator-core/src/index.ts:1`).
- No package manifest, lockfile, external dependency, file picker/parser/image decode/archive work, editor UI implementation, runtime evaluator implementation, broad report redesign, or Cubism compatibility claim was found in the Domain C scope.

## Test Adequacy

Result: `pass`.

- Catalog registration for both viewer check IDs is tested (`packages/validator-core/src/viewer-evidence.test.ts:31`).
- Valid viewer snapshot plus viewer evidence passes and records stable runtime snapshot/state refs (`packages/validator-core/src/viewer-evidence.test.ts:38`, `packages/validator-core/src/viewer-evidence.test.ts:57`).
- Missing viewer evidence in viewer profile produces deterministic `viewer.runtimeEvidenceMissing` (`packages/validator-core/src/viewer-evidence.test.ts:67`).
- Non-viewer runtime snapshot context produces deterministic `viewer.runtimeEvidenceStale` (`packages/validator-core/src/viewer-evidence.test.ts:93`).
- Existing source/PSD/binary/dynamics/report validators are covered by the full `packages/validator-core/src` suite rerun in this review.

## Verification Performed

Basis documents read or searched directly:

- `.agents/skills/implementation-orchestration/SKILL.md`
- `discussion/implementation/orchestration/wave24-plan.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/implementation/current-capability-map.md`
- `discussion/implementation/waves/wave23/wave23-final-report.md`
- `discussion/implementation/reviews/wave23/wave23-clean-integration-review.md`
- `discussion/implementation/waves/wave24/wave24-domain-a-viewer-evaluation-foundation-completion.md`
- `discussion/implementation/reviews/wave24/wave24-domain-a-viewer-evaluation-foundation-review.md`
- `discussion/acceptance-criteria/03_MVP_Acceptance_Criteria.md`
- `discussion/scenarios/03_MVP_Acceptance_Criteria.md`
- `discussion/acceptance-criteria/02_DomainAcceptanceCriteria/218_Open_Viewer.md`
- `discussion/design/mvp-authoring-runtime/04-validator-acceptance-runner-design.md`
- `discussion/design/module-contracts/validator-contract.md`

Commands/checks:

| Check | Result |
|---|---|
| `git status --short -uall` | confirmed Domain C changes are mixed with parallel Domain B/D/editor changes; review stayed scoped to Domain C |
| `git diff -- packages/validator-core/src/validators/package-runtime.ts packages/validator-core/src/check-catalog.ts packages/validator-core/src/index.ts discussion/design/module-contracts/validator-contract.md` | inspected tracked Domain C diff |
| Line-numbered reads of `viewer-evidence.ts`, `viewer-evidence.test.ts`, `package-runtime.ts`, completion report, report schema, runtime artifact helpers, and Domain A viewer evidence source | pass |
| `pnpm.cmd exec vitest run packages/validator-core/src/viewer-evidence.test.ts` | pass; 1 file / 4 tests |
| `pnpm.cmd exec vitest run packages/validator-core/src` | pass; 11 files / 59 tests |
| `pnpm.cmd run check:source` | pass |
| `pnpm.cmd run check:deps` | pass |
| `git diff --check -- packages/validator-core discussion/implementation/waves/wave24 discussion/implementation/reviews/wave24 discussion/design/module-contracts/validator-contract.md` | pass; Git emitted LF/CRLF working-copy warnings only |
| trailing whitespace scan over untracked Domain C files | pass; no matches |
| dependency manifest/lockfile diff check | pass; no output |
| forbidden-scope scan over Domain C source/docs for Cubism/file-picker/parser/image-decode/archive/external-dependency claims | pass; no output |
| `pnpm.cmd typecheck` | pass |

## Residual Risks

- The focused tests cover valid, missing, and one stale viewer evidence path. The parse-failed evidence branch and evidence-present/runtime-snapshot-missing branch are implemented and deterministic by inspection, but not individually asserted by tests.
- Viewer refs are stored in the existing `supplementalGuiEvidenceRefs` field to avoid report schema redesign. This is schema-compatible and AI-readable, but the field name remains GUI-oriented.
- Full Wave 24 viewer workflow proof still depends on parallel UI/equivalence/e2e domains; this review only validates Domain C's validator/report integration.

## User Decision Points

None.

## Required Gnome Fix

None.
