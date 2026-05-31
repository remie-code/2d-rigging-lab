# Wave 23 Domain A Review: Dynamics Authoring / Operation Foundation

## Verdict

`pass`

Review-Sylph independent review found no blocking, high, medium, or low findings.

Domain B and Domain C can start in parallel from this foundation. They should treat runtime sequence/reset handlers, runtime evaluator behavior, and validator semantic diagnostics as their own Wave 23 scopes; Domain A only establishes the authoring and operation mutation foundation for minimal dynamics group creation/update.

## Scope Reviewed

Target: `wave23-dynamics-authoring-operation-foundation`

Actual git status showed the expected authoring-core / operation-core source changes plus Wave 23 discussion/orchestration map artifacts:

- `packages/authoring-core/src/dynamics-mutations.ts`
- `packages/authoring-core/src/dynamics-selectors.ts`
- `packages/authoring-core/src/dynamics-mutations.test.ts`
- `packages/authoring-core/src/authoring-mutations.ts`
- `packages/authoring-core/src/index.ts`
- `packages/operation-core/src/operations/create-dynamics-group.ts`
- `packages/operation-core/src/operations/update-dynamics-group.ts`
- `packages/operation-core/src/operations/create-dynamics-group.test.ts`
- `packages/operation-core/src/payloads/dynamics.ts`
- `packages/operation-core/src/operation-registry.ts`
- `packages/operation-core/src/operation-ids.ts`
- `packages/operation-core/src/operation-lifecycle.test.ts`
- `packages/operation-core/src/index.ts`
- `discussion/implementation/_map.md`
- `discussion/implementation/orchestration/_map.md`
- `discussion/implementation/orchestration/wave23-plan.md`

No changes were found under `package.json`, lockfiles, `packages/runtime-core`, `packages/validator-core`, or `apps/editor`.

## Basis Checked

- `.agents/skills/implementation-orchestration/SKILL.md`
- `discussion/implementation/orchestration/wave23-plan.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/acceptance-criteria/03_MVP_Acceptance_Criteria.md`
- `discussion/scenarios/03_MVP_Acceptance_Criteria.md`
- `discussion/design/mvp-authoring-runtime/00-mvp-vertical-slice-architecture.md`
- `discussion/design/mvp-authoring-runtime/03-runtime-evaluation-semantics.md`
- `discussion/design/module-contracts/operation-contracts.md`
- `discussion/implementation/current-capability-map.md`
- `discussion/implementation/waves/wave22/wave22-final-report.md`
- `discussion/implementation/reviews/wave22/wave22-clean-integration-review.md`

## Findings

None.

## Design / Development Compliance

Result: `pass`

- Minimal Open Dynamics v1 scope is narrow and deterministic. The payload/schema path fixes `solverKind` to `scalarDampedFollowV1` and does not add wall-clock, random, browser timing, runtime evaluator, validator, UI, parser, asset I/O, or external dependency behavior (`packages/operation-core/src/payloads/dynamics.ts:54`).
- The implementation does not claim Cubism Physics compatibility. A forbidden-scope scan over the changed source files found no `Cubism`, `Physics`, `physics3`, parser/decode/file-picker/archive/filesystem, runtime evaluator broad implementation, validator broad implementation, or editor UI matches.
- Authoring mutation support validates the important MVP relation: drivers must reference `authoredInput` parameters, output must reference a `computedDynamics` parameter, a driver cannot also be the output, driver IDs are unique, and a computed output parameter has at most one dynamics producer (`packages/authoring-core/src/dynamics-mutations.ts:35`, `packages/authoring-core/src/dynamics-mutations.ts:123`, `packages/authoring-core/src/dynamics-mutations.ts:183`).
- Operation create/update support is registered and coherent with existing lifecycle patterns (`packages/operation-core/src/operation-registry.ts:50`, `packages/operation-core/src/operation-registry.ts:51`).
- `createDynamicsGroup` dry-run/commit can materialize a group, return model diff, and expose dynamics target parameters through operation target IDs, precondition checked refs, and evidence provider input (`packages/operation-core/src/operations/create-dynamics-group.ts:35`, `packages/operation-core/src/operations/create-dynamics-group.ts:185`, `packages/operation-core/src/operations/create-dynamics-group.ts:198`, `packages/operation-core/src/operations/create-dynamics-group.ts:203`, `packages/operation-core/src/operations/create-dynamics-group.ts:366`).
- `updateDynamicsGroup` supports group metadata / enabled / reset policy changes without rebinding drivers or outputs, matching the operation contract's metadata update lane (`packages/operation-core/src/operations/update-dynamics-group.ts:27`, `packages/operation-core/src/operations/update-dynamics-group.ts:106`).
- Source organization complies with the policy: new production files have focused responsibilities, and `index.ts` changes are barrel exports only (`packages/authoring-core/src/index.ts:10`, `packages/authoring-core/src/index.ts:24`, `packages/operation-core/src/index.ts:5`, `packages/operation-core/src/index.ts:25`, `packages/operation-core/src/index.ts:26`).
- No package manifests, lockfiles, runtime-core, validator-core, or editor source files were changed.

## Test Adequacy

Result: `pass`

Coverage is adequate for Domain A's risk:

- Authoring tests cover package materialization, non-`computedDynamics` output rejection, and duplicate computed-output ownership rejection (`packages/authoring-core/src/dynamics-mutations.test.ts:17`, `packages/authoring-core/src/dynamics-mutations.test.ts:37`, `packages/authoring-core/src/dynamics-mutations.test.ts:49`).
- Operation tests cover deterministic commit with driver/output parameter evidence, missing output rejection before mutation/log append, update metadata commit, and non-computed output diagnostic (`packages/operation-core/src/operations/create-dynamics-group.test.ts:17`, `packages/operation-core/src/operations/create-dynamics-group.test.ts:73`, `packages/operation-core/src/operations/create-dynamics-group.test.ts:95`, `packages/operation-core/src/operations/create-dynamics-group.test.ts:115`).
- Lifecycle tests cover registry commit/log checked refs, dry-run without original-session mutation, and unsupported operation behavior staying unchanged (`packages/operation-core/src/operation-lifecycle.test.ts:338`, `packages/operation-core/src/operation-lifecycle.test.ts:384`, `packages/operation-core/src/operation-lifecycle.test.ts:399`).
- Schema tests still parse representative dynamics payloads through the operation payload union (`packages/operation-core/src/operation-schemas.test.ts:177`, `packages/operation-core/src/operation-schemas.test.ts:264`).

Residual test risks are non-blocking:

- Direct `updateDynamicsGroup` authoring negative cases are not separately unit-tested, but the operation success path and mutation error mapping are covered enough for this foundation.
- Operation ID auto-generation for omitted dynamics `operationId` is inherited from existing lifecycle behavior and is not covered by the new tests. Downstream editor/AI callers should continue supplying stable operation IDs or add targeted tests if they rely on defaults.
- Settings rebinding/update operations (`setDynamicsSettings`, `bindDynamicsDriver`, `bindDynamicsOutput`) remain unsupported future operations. The Domain A create operation carries initial settings/driver/output for the minimal vertical slice, so this does not block Domain B/C.

## Verification

All required verification passed.

| Command | Result |
|---|---|
| `pnpm.cmd exec vitest run packages/authoring-core/src/dynamics-mutations.test.ts packages/operation-core/src/operations/create-dynamics-group.test.ts packages/operation-core/src/operation-lifecycle.test.ts packages/operation-core/src/operation-schemas.test.ts` | pass; 4 files / 29 tests |
| `pnpm.cmd exec vitest run packages/operation-core/src` | pass; 24 files / 124 tests |
| `pnpm.cmd exec vitest run packages/authoring-core/src` | pass; 12 files / 42 tests |
| `pnpm.cmd typecheck` | pass; root and editor typecheck completed |
| `git diff --check -- packages/authoring-core packages/operation-core discussion/implementation/waves/wave23 discussion/implementation/reviews/wave23` | pass; Git emitted LF/CRLF working-copy warnings only |
| `git status --short -uall -- package.json pnpm-lock.yaml pnpm-workspace.yaml apps/editor packages/runtime-core packages/validator-core packages/*/package.json` | pass; no output |
| `git diff --name-only -- package.json pnpm-lock.yaml pnpm-workspace.yaml apps/editor packages/runtime-core packages/validator-core packages/*/package.json` | pass; no output |
| Forbidden-scope scan over changed Domain A source files | pass; no matches |

## Escalation / User Decision Points

None.

## Residual Risks

- Domain B must still implement deterministic runtime sequence/evidence. Domain A only ensures operation evidence can name the dynamics group and driver/output parameters.
- Domain C must still implement validator dynamics semantic checks. Current Domain A rejects core authoring/operation invalid bindings, but broad validator diagnostics remain planned scope.
- Domain D/E should not assume preview reset/run operations or settings-update operations are already supported by Domain A.
