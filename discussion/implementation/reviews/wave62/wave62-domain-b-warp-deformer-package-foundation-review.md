# Wave62 Domain B Review: Warp Deformer Package Foundation

## Status

pass

## Scope

- Wave: Wave62
- Domain: B
- Domain id: `wave62-warp-deformer-package-foundation`
- Review lanes:
  - Design / Development Compliance Review
  - Test Adequacy Review

## Findings

No remaining blocking findings.

### resolved: Validator test coverage now proves incompatible keyform/control-point cardinality

- Previous gap: validator coverage did not directly prove `incompatible keyform/control-point cardinality` from `discussion/implementation/orchestration/wave62-plan.md:337`-`343`.
- Fix inspected: `packages/validator-core/src/warp-lattice-diagnostics.test.ts:315`-`366` now creates a Warp Deformer with `5 x 4` transform cardinality and a syntactically valid four-point `Vec2[]` `controlPointOffsets` patch.
- The test asserts `rigControl.warpLatticeMalformedPatch` with `expectedControlPointOffsetCount=20` and `actualControlPointOffsetCount=4` at `packages/validator-core/src/warp-lattice-diagnostics.test.ts:351`-`365`.
- Production code was not changed in this fix loop.

## Design / Development Compliance

- The package model represents Warp Deformer as user-facing `warpDeformer` metadata on backward-compatible `warpLattice2d` storage, with transform grid, Bezier edit surface, compatibility metadata, and deterministic default Bezier rest surface generation in `packages/package-format/src/warp-deformer-contract.ts`.
- `projectWarpDeformerReadModel` provides the short Domain C read projection and explicitly marks `bezierEvaluation: "storedNotEvaluatedV0"`, so it does not claim Bezier runtime evaluation.
- Operation Core exposes `createWarpDeformer`, routes commit through Operation Core, preserves dry-run separation, model diff, checked target refs, and operation log integration.
- Validator changes are localized under existing rig-control / warp-lattice validation surfaces and add cataloged check IDs.
- `index.ts` changes are barrel exports only.
- No dependency manifest or lockfile changes were observed.
- No Cubism compatibility claim, Cubism dependency, Editor UI implementation, Canvas overlay UI, physics/dynamics work, or full keyform authoring was found in the Domain B target files.

## Test Adequacy

- Package-format tests cover Warp Deformer metadata representation, transform/storage mismatch rejection, malformed Bezier surface cardinality, legacy projection, invalid bounds, and `controlPointOffsets` schema shape.
- Operation tests cover `createWarpDeformer` dry-run, commit, parent binding, stored metadata, rest/control point counts, operation log, checked target refs, and model state.
- Validator tests cover valid stored Warp Deformer metadata, invalid divisions, transform mismatch, malformed Bezier surface cardinality, invalid bounds, missing refs/cycle through existing rig-control semantic tests, existing runtime evidence regressions, and the semantic keyform/control-point cardinality mismatch for a valid `Vec2[]` with the wrong transform point count.

## Sources / Diff / Tests Reviewed

- Basis:
  - `discussion/implementation/orchestration/wave62-plan.md`
  - `discussion/design/screen-design/components/rig-tool.md`
  - `discussion/design/screen-design/components/parameter-keyform.md`
  - `discussion/design/screen-design/e2e-oracle.md`
  - `discussion/development_convention/ux-backed-package-logic-authority.md`
  - `discussion/development_convention/source-file-organization-policy.md`
  - `discussion/development_convention/dependency-policy.md`
  - `discussion/development_convention/operation-policy.md`
  - `discussion/development_convention/schema-and-id-conventions.md`
  - `.github/skills/implementation-orchestration/SKILL.md`
- Report:
  - `discussion/implementation/waves/wave62/wave62-domain-b-warp-deformer-package-foundation-report.md`
- Fix-loop source:
  - `packages/validator-core/src/warp-lattice-diagnostics.test.ts`
  - `discussion/implementation/waves/wave62/wave62-domain-b-warp-deformer-package-foundation-report.md`
- Source and tests:
  - `packages/package-format/src/warp-deformer-contract.ts`
  - `packages/package-format/src/warp-deformer-projection.ts`
  - `packages/package-format/src/model-files.ts`
  - `packages/package-format/src/warp-lattice2d-contract.test.ts`
  - `packages/authoring-core/src/rig-control-mutations.ts`
  - `packages/operation-core/src/operations/create-warp-deformer.ts`
  - `packages/operation-core/src/operations/rig-control.test.ts`
  - `packages/operation-core/src/operation-schemas.test.ts`
  - `packages/validator-core/src/validators/warp-lattice-diagnostics.ts`
  - `packages/validator-core/src/validators/warp-lattice-schema-issues.ts`
  - `packages/validator-core/src/warp-lattice-diagnostics.test.ts`
  - `packages/validator-core/src/validators/rig-control-semantic.ts`
  - `packages/validator-core/src/rig-control-semantic.test.ts`
  - `packages/ai-interface/src/ai-codex-proposal-operation-catalog.ts`
- Diff:
  - `git diff --stat`
  - `git diff -- <Domain B target files>`
  - `git diff -- package.json pnpm-lock.yaml pnpm-workspace.yaml`

## Verification Evidence Observed

- Fix-loop focused validator test initially failed in sandbox with esbuild `spawn EPERM`; rerun with approved escalation passed: `packages/validator-core/src/warp-lattice-diagnostics.test.ts`, 14 tests.
- Domain B focused suite rerun with approved escalation passed: 6 files / 50 tests.
- `pnpm.cmd typecheck`: pass.
- `git diff --check -- packages/validator-core/src/warp-lattice-diagnostics.test.ts discussion/implementation/waves/wave62/wave62-domain-b-warp-deformer-package-foundation-report.md discussion/implementation/reviews/wave62/wave62-domain-b-warp-deformer-package-foundation-review.md`: pass, with CRLF normalization warning only.
- Previous broader review evidence remains valid: 13 files / 97 tests passed, source organization guard passed, dependency guard passed.

## Required Fixes

None.

## Residual Risks

- Bezier edit surface is persisted and validated, but runtime evaluation remains existing bilinear lattice behavior. This is documented and acceptable for Domain B.
- Operation Core duplicates Warp Deformer metadata literals locally to avoid adding a direct package-format dependency. Type checking currently constrains this through inferred authoring-core types, but future contract expansion may benefit from a cleaner shared boundary.
- The current worktree includes non-Domain-B Wave62 changes; this review assessed the reported Domain B files and did not adjudicate unrelated Domain A/editor changes.
