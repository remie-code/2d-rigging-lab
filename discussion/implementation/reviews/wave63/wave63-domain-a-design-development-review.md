# Wave63 Domain A Design / Development Compliance Review

Review lane: Design / Development Compliance Review
Domain: `wave63-deformer-package-operation-management-foundation`
Review pass: Fix Loop 1 re-review
Verdict: `pass`
Reviewer: independent Review-Sylph
Date: 2026-06-12

## Basis Reviewed

- `discussion/implementation/orchestration/wave63-plan.md`
- `discussion/implementation/waves/wave63/wave63-domain-a-report.md`
- `discussion/implementation/reviews/wave63/wave63-domain-a-spec-compliance-review.md`
- Prior Design / Development review in this file, especially A-DD-001.
- `discussion/development_convention/ux-backed-package-logic-authority.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/operation-policy.md`
- `discussion/development_convention/schema-and-id-conventions.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/design/screen-design/components/rig-tool.md`
- Actual Domain A target source files listed in the Domain A report, plus `git status` / `git diff` for scope separation.

## Verdict Summary

`pass`.

The prior blocking finding A-DD-001 is resolved. `updateRigControl` now validates and builds a complete preview rig control before assigning to the live rig control, and its committed operation handler preflights the same update on a dry-run authoring session before touching the live session.

No unresolved Design / Development compliance blocker was found in the Domain A target scope. Domain A remains inside package / operation / validator / runtime / AI catalog foundations, does not implement Editor UI or mesh work, and does not add dependencies or Cubism compatibility claims.

## Prior Finding Resolution

### A-DD-001: `updateRigControl` rejected commits can partially mutate live package state

Status: resolved

Resolution evidence:

- `packages/authoring-core/src/rig-control-mutations.ts:588` builds `previewRigControlAfter` from a clone of the current rig control.
- Generic field changes are applied to the preview object at `packages/authoring-core/src/rig-control-mutations.ts:589` and `:592`, not directly to the live object.
- Warp field validation and keyform cardinality rejection happen before live assignment in `packages/authoring-core/src/rig-control-mutations.ts:1028` through `:1078`.
- The live rig control is updated only after preview validation and no-op comparison at `packages/authoring-core/src/rig-control-mutations.ts:609`.
- The commit handler runs `applyUpdateRigControl(createDryRunAuthoringSession(session), ...)` as a committed preflight and returns the original live session when preflight rejects in `packages/operation-core/src/operations/update-rig-control.ts:37` through `:52`.
- Regression tests cover invalid Warp field rejection and keyform cardinality rejection while generic fields are present, and assert unchanged rig control, package revision, authoring revision, dirty state, and operation log length in `packages/operation-core/src/operations/rig-control.test.ts:743` through `:843`.

## Compliance Summary

### Operation Gateway

Status: pass

- Package-changing Domain A workflows are exposed as Operation Core operations: `moveDrawableRigControlBinding`, `reparentRigControl`, `updateRigControl`, and extended `createRotation2dRigControl` / `createWarpDeformer`.
- Operation type, payload union, registry, public exports, and AI catalog entries are present in the listed Domain A files.
- Dry-run / commit separation is preserved. Dry-runs use `createDryRunAuthoringSession`; committed `updateRigControl` now performs dry-run preflight before live mutation.
- Operations produce model diffs for the reviewed mutating paths. Rejected `updateRigControl` commits no longer leave partial live mutations.

### Module Boundaries

Status: pass

- Domain A changes are limited to `packages/package-format`, `packages/authoring-core`, `packages/operation-core`, `packages/validator-core`, `packages/runtime-core`, `packages/ai-interface`, focused tests, and the Domain A report/review artifacts.
- Parallel `apps/editor/**` and mesh changes are present in the workspace but are outside the Domain A report changed-files list and were not counted as Domain A evidence.
- Editor UI, DnD handlers, inspector controls, and read projection consumption remain Domain C scope.

### Source Organization

Status: pass with non-blocking risk

- New operation files under `packages/operation-core/src/operations/` each own one operation concern.
- `packages/operation-core/src/index.ts` remains a barrel/export surface.
- No new broad catch-all `types.ts`, `schemas.ts`, `utils.ts`, or `helpers.ts` file was introduced in Domain A scope.
- `node scripts/check-source-organization.mjs` passed.
- Non-blocking risk: `packages/authoring-core/src/rig-control-mutations.ts` continues to grow as the central rig-control mutation file. It is still responsibility-scoped, but future rig-control expansion should consider a focused split before reviewer ergonomics degrade.

### Schema / ID Conventions

Status: pass

- New operation and diagnostic IDs are machine-readable and contain no spaces, including `moveDrawableRigControlBinding`, `reparentRigControl`, `updateRigControl`, `rigControl.duplicateChild`, `rigControl.drawableMultipleParents`, and `rigControl.opacityMultiplierRange`.
- Operation payload schemas remain in the operation payload boundary and reuse existing ID schemas.
- No Cubism schema target, Cubism parser, or Cubism compatibility schema was added.

### Dependency Policy

Status: pass

- No dependency manifest or lockfile change was found in the Domain A target file list.
- `node scripts/check-dependencies.mjs` passed.
- No Cubism SDK/Core, proprietary parser, unlicensed binary, model pack, or new third-party dependency usage was found in Domain A scope.

### Design Consistency

Status: pass

- Domain A implements package-backed foundations for the accepted Rig Tool UX instead of GUI-only workarounds.
- Binding move / reparent / insertion semantics operate on rig-control hierarchy and binding references; Parts membership and draw order are not treated as the same concept.
- Static `opacityMultiplier` is persisted, validated, projected, and runtime-applied as a deformer/base rig-control property distinct from parameter-driven subtree opacity.
- Parent editing is intentionally handled through `reparentRigControl`, while `updateRigControl` covers inspector-style field updates. This operation split matches the Domain A handoff and does not conflict with the Rig Tool basis.
- Bezier runtime evaluation, parameter/keyform authoring UI, Cubism compatibility, and Editor UI implementation are not claimed.

### Report Quality

Status: pass

- The Domain A report includes current-state delta, chosen operation granularity, Domain C handoff, basis coverage, deferred basis items, workflow trace, must-not evidence, verification summary, and residual risk classification.
- Fix Loop 1 changes and verification are explicitly recorded.
- The report distinguishes Domain A scope from parallel editor/mesh workspace changes.

## Non-Blocking Risks

- Domain C may still surface DTO ergonomics or user-feedback mapping adjustments when wiring DnD and inspector flows to the new operation contracts.
- `rig-control-mutations.ts` is large but still cohesive; future growth should be watched.
- Workspace contains parallel Domain B/editor changes outside Domain A scope, which may complicate later integration bookkeeping.
- The plan's expected long report filename differs from the actual `wave63-domain-a-report.md` used by this task and current workspace; this is process drift, not a Domain A design/development blocker.

## Verification Performed

- Read all required basis docs, the Domain A report, the prior Design / Development review, and the Spec Compliance re-review.
- Read the Domain A changed-files list and inspected relevant source paths and diffs.
- Independently traced the fixed `updateRigControl` authoring mutation and operation commit path.
- Ran `node scripts/check-source-organization.mjs`: pass.
- Ran `node scripts/check-dependencies.mjs`: pass.
- Ran `git diff --check` over tracked Domain A target paths: pass, with CRLF conversion warnings only.
- Ran trailing-whitespace scan over untracked Domain A operation/report/review paths before updating this file; only the old review Markdown hard-break lines were flagged and have been removed by this update.
- Ran `pnpm.cmd typecheck`: pass.
- Ran focused Domain A Vitest suite:
  - Sandbox run failed with `spawn EPERM` while loading Vite/esbuild.
  - Approved rerun passed: 6 files / 61 tests.

## Residual Risk Classification

low

- Low: A-DD-001 is covered at both the authoring mutation ordering boundary and the Operation Core committed preflight boundary.
- Low: focused tests, typecheck, source organization guard, dependency guard, and whitespace checks pass for the reviewed Domain A scope.
- Low-to-medium integration risk remains for Domain C UI wiring, but this does not block Domain A Design / Development compliance.

## Final Verdict

`pass`.

Domain A is Design / Development compliant after Fix Loop 1. No unresolved blocking finding remains for this lane.
