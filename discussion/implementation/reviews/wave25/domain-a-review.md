# Wave25 Domain A Independent Review

> Target: `wave25-rig-control-authoring-operation-foundation`
> Reviewer: Review-Sylph
> Date: 2026-06-01
> Verdict: `pass`

## Scope Reviewed

This review independently inspected the Wave25 plan, development policies, MVP/runtime/operation/test basis documents, the changed authoring-core and operation-core files, and the Gnome implementation report. The Gnome report was treated as a verification claim source, not as the sole basis.

Primary scope gate:

- Domain A is limited to `createRotation2dRigControl` and `bindRigControlChild` authoring / operation lifecycle foundation, including dry-run, commit, operation log, model diff, and package materialization evidence: `discussion/implementation/orchestration/wave25-plan.md:136`.
- Runtime evaluator, validator semantics, fixtures, editor UI, dependency, manifest, and lockfile expansion are outside Domain A: `discussion/implementation/orchestration/wave25-plan.md:149`.

## Findings

No blocking or needs-fix findings.

## Design / Development Compliance

Result: `pass`.

- The implementation stays inside the Domain A source scope. Changed source is under `packages/authoring-core/src/**` and `packages/operation-core/src/**`; the only report artifact from Gnome is under `discussion/implementation/waves/wave25/`.
- `createRotation2dRigControl` and `bindRigControlChild` are registered as supported lifecycle handlers in `packages/operation-core/src/operation-registry.ts:54` and `packages/operation-core/src/operation-registry.ts:55`.
- `createWarpLattice2dRigControl` remains schema-compatible but handler-unsupported. The operation type / payload union still includes it (`packages/operation-core/src/operation-type.ts:20`, `packages/operation-core/src/operation-payload.ts:62`), while registry registration does not add a warp handler, and lifecycle coverage keeps the unsupported operation test on warp (`packages/operation-core/src/operation-lifecycle.test.ts:403`, `packages/operation-core/src/operation-lifecycle.test.ts:544`).
- `rotation2d` is the supported rig-control create path. The handler materializes a `rotation2d` rig control, carries the requested pivot/rest angle, and sets neutral rest translation/scale plus enabled state at `packages/operation-core/src/operations/create-rotation2d-rig-control.ts:107`.
- Dry-run and commit use the existing lifecycle pattern: dry-run creates a cloned authoring session for both create and bind (`packages/operation-core/src/operations/create-rotation2d-rig-control.ts:37`, `packages/operation-core/src/operations/bind-rig-control-child.ts:30`), while commit applies to the passed session (`packages/operation-core/src/operations/create-rotation2d-rig-control.ts:42`, `packages/operation-core/src/operations/bind-rig-control-child.ts:35`).
- Operation result model diffs identify rig-control and child targets. Create builds added/changed refs at `packages/operation-core/src/operations/create-rotation2d-rig-control.ts:158` and detailed changed fields at `packages/operation-core/src/operations/create-rotation2d-rig-control.ts:189`; bind builds changed refs and root changes at `packages/operation-core/src/operations/bind-rig-control-child.ts:114` and `packages/operation-core/src/operations/bind-rig-control-child.ts:145`.
- Child drawable and child rig-control relationships are preserved in authoring graph mutation state. Binding updates parent child lists and, for rig-control children, child `parentId` plus root IDs at `packages/authoring-core/src/rig-control-mutations.ts:88`, `packages/authoring-core/src/rig-control-mutations.ts:271`, and `packages/authoring-core/src/rig-control-mutations.ts:325`.
- Package materialization already clones `session.graph.rigControls` and `session.graph.rigControlRootIds` into package model files at `packages/authoring-core/src/package-document-model-files.ts:13` and `packages/authoring-core/src/package-document-model-files.ts:34`; the new authoring test covers root/parent materialization at `packages/authoring-core/src/rig-control-mutations.test.ts:74`.
- Machine-readable target kind is `rigControl`, matching the contract target enum at `packages/contracts/src/target-ref.ts:13`. `RigControlIdSchema` is prefix-based and no-space by construction at `packages/contracts/src/ids.ts:38`; targeted scans found no whitespace `id`, `operationId`, `checkId`, or `kind: "rig control"` literals in the changed Domain A files.
- Public `index.ts` changes are barrel/entrypoint exports only. The only non-`export * from` line in each public index is the pre-existing package-info named export, which is allowed minimal package-facing wiring under `discussion/development_convention/source-file-organization-policy.md:44`.
- No dependency manifest or lockfile dirty status was observed for root/editor/package manifests. `pnpm.cmd run check:deps` passed.

## Test Adequacy

Result: `pass`.

- Focused authoring-core coverage includes rotation create, drawable child bind, child rig-control bind with package materialization, and cycle rejection: `packages/authoring-core/src/rig-control-mutations.test.ts:31`, `packages/authoring-core/src/rig-control-mutations.test.ts:56`, `packages/authoring-core/src/rig-control-mutations.test.ts:74`, `packages/authoring-core/src/rig-control-mutations.test.ts:106`.
- Focused operation-core coverage includes create dry-run no mutation, create commit operation log target refs, bind drawable commit, bind rig-control dry-run/commit, and unsupported child target diagnostics: `packages/operation-core/src/operations/rig-control.test.ts:21`, `packages/operation-core/src/operations/rig-control.test.ts:48`, `packages/operation-core/src/operations/rig-control.test.ts:92`, `packages/operation-core/src/operations/rig-control.test.ts:122`, `packages/operation-core/src/operations/rig-control.test.ts:178`.
- Operation lifecycle compatibility keeps warp unsupported after rotation becomes supported: `packages/operation-core/src/operation-lifecycle.test.ts:403`.
- Operation schema compatibility covers `createRotation2dRigControl` and `bindRigControlChild` in the parsed operation payload list: `packages/operation-core/src/operation-schemas.test.ts:198`, `packages/operation-core/src/operation-schemas.test.ts:212`, `packages/operation-core/src/operation-schemas.test.ts:270`.
- Existing operation compatibility risk was checked with full unit coverage; `pnpm.cmd test:unit` passed.

Non-blocking residual test hardening: operation handlers contain deterministic diagnostic branches for missing child, malformed child ID, duplicate/no-op, and already-parented cases (`packages/operation-core/src/operations/bind-rig-control-child.ts:241`, `packages/operation-core/src/operations/create-rotation2d-rig-control.ts:281`). The current focused tests cover representative invalid kind and cycle paths, not every branch. This is acceptable for the Domain A minimum, but later validator/fixture domains should add formal invalid hierarchy fixtures.

## Verification Performed

| Check | Result |
|---|---|
| `pnpm.cmd exec vitest run packages/authoring-core/src/rig-control-mutations.test.ts packages/operation-core/src/operations/rig-control.test.ts packages/operation-core/src/operation-lifecycle.test.ts packages/operation-core/src/operation-schemas.test.ts` | pass; 4 files / 31 tests |
| `pnpm.cmd typecheck` | pass |
| `pnpm.cmd run check:source` | pass |
| `pnpm.cmd run check:deps` | pass |
| `git diff --check -- packages/authoring-core packages/operation-core discussion/implementation/waves/wave25 discussion/implementation/reviews/wave25` | pass; LF/CRLF working-copy warnings only |
| `pnpm.cmd test:unit` | pass; 117 files / 597 tests |
| Targeted forbidden-scope scan over changed Domain A files | pass; only benign hit was `node:fs` in a test fixture loader |
| Public `index.ts` non-barrel scan | pass; package-info named export only |
| Manifest/lockfile dirty status check | pass; no output |

## Residual Risks

- Runtime-visible rig control transform evaluation, parent-before-child runtime evidence, validator diagnostics, fixtures, and editor UI workflow are intentionally left to later Wave25 domains.
- `createWarpLattice2dRigControl` remains schema-compatible and lifecycle-unsupported in Domain A; runtime/evaluator expansion must remain gated to later domains.
- Binding policy is conservative: a drawable or child rig control is prevented from being parented to multiple rig controls. This is consistent with the current authoring graph/root materialization approach, but later runtime/validator domains should preserve or explicitly revisit the policy if hierarchy semantics change.

## User Decision Points

None. No source-document conflict, dependency approval need, or unclear module boundary was found for Domain A.
