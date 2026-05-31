# Wave 23 Clean Integration Review: Minimum Open Dynamics v1

> Target: `wave23-integration-review-and-final-report`  
> Date: 2026-05-31  
> Role: Review-Sylph clean integration reviewer  
> Agent: `019e7e90-a1e1-79d3-b66d-7ec38163efcd` / `Sylph the 30th`  
> Verdict: `pass`

## Scope

Reviewed the combined Wave 23 Domain A-F implementation after Gnome final verification. This review used the Wave 23 plan, orchestration skill, source organization policy, dependency policy, all A-F completion reports, all A-F review reports, and the actual working tree diff/source/fixture/e2e files.

This reviewer did not edit source, tests, fixtures, final reports, or maps. The only write performed by this review is this artifact.

## Findings

No blocking, high, medium, or low findings.

## Pass Criteria Review

Result: `pass`.

- Authoring and operation foundation satisfies the plan: `createDynamicsGroup` is registered, supports dry-run/commit, materializes a minimal dynamics group, records target refs for group/driver/output parameters, and keeps update scope narrow.
- Runtime satisfies the plan: dynamics evaluation is deterministic, explicit-step based, and parameter-driven. Runtime state, snapshots, diffs, driver values, computed output, and debug target/clamp evidence are exposed without viewer app or browser timing dependence.
- Validator satisfies the plan: dynamics semantic checks cover parameter relation, producer gaps, duplicate output targets, unsafe settings, output range/clamp evidence, and runtime evidence gaps with stable AI-readable diagnostics.
- Editor satisfies the plan: the Dynamics panel can create a group, create or reuse a computed output parameter, update group metadata, run/reset preview, and display computed output, runtime evidence, diff summary, and validator diagnostics.
- Fixtures satisfy the plan: `fixtures/contracts/minimum-open-dynamics-v1-evidence` pins operation result, runtime snapshot/diff, validation report, edge diagnostics, and editor-facing evidence. It also proves a computed dynamics output can drive keyform-backed drawable projection.
- E2E satisfies the plan: `apps/editor/e2e/dynamics-persistence-smoke.mjs` covers create -> preview run/reset -> save -> reload/load -> preview rerun across the existing desktop/mobile smoke loop.
- Existing PSD, binary/source intake, keyform, drawable, mesh, preview, persistence, and validator paths remain covered by the full unit and e2e runs.
- No package manifest or lockfile changes were found. Dependency guard passed.
- No new external dependency, file picker, parser, asset I/O expansion, Cubism Physics compatibility claim, direct vertex physics, collision/cloth/timeline/graph editor scope, or Cubism SDK/Core use was found in the Wave 23 target diff/new files.
- Public `index.ts` files remain barrel-only. Source organization guard passed.

## Contract Integration Notes

- Operation payload and package schema align on `solverKind: "scalarDampedFollowV1"`, driver bindings, output bindings, settings, and reset policy.
- Authoring mutation validates the core package relation before commit: drivers must be `authoredInput`, output must be `computedDynamics`, driver IDs must be unique, and one computed output parameter has at most one producer group.
- Runtime uses authored driver values to compute a deterministic scalar target, advances state with fixed substeps, projects computed dynamics values into effective parameters, then uses the existing keyform sampling path.
- Runtime snapshots and diffs expose dynamics output/state changes and computed parameter changes, so validator/editor/fixture consumers can trace the output.
- Validator consumes `RuntimeSnapshotDto` evidence rather than reimplementing runtime behavior. Missing or mismatched runtime evidence is visible through `dynamics.runtimeEvidenceMissing`.
- Editor preview uses the same runtime and validator modules as the package/runtime path, not a mock-only UI path.
- Browser persistence keeps authored dynamics groups and computed parameters, while preview evidence is recomputed after load. The e2e smoke asserts both behaviors.

## Verification Performed

Read/reviewed:

- `.agents/skills/implementation-orchestration/SKILL.md`
- `discussion/implementation/orchestration/wave23-plan.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- Domain A-F completion reports under `discussion/implementation/waves/wave23/`
- Domain A-F review reports under `discussion/implementation/reviews/wave23/`
- Key operation, authoring, runtime, validator, editor, fixture, and e2e files in the Wave 23 working tree
- `discussion/design/module-contracts/validator-contract.md`

Commands/checks:

| Check | Result |
|---|---|
| `pnpm.cmd typecheck` | pass |
| `pnpm.cmd test:unit` | pass; 109 files / 571 tests |
| `pnpm.cmd test:e2e` | pass; desktop smoke passed, mobile smoke passed |
| `pnpm.cmd run check:source` | pass |
| `pnpm.cmd run check:deps` | pass |
| `git diff --check -- apps/editor packages fixtures/contracts discussion/implementation discussion/design/module-contracts/validator-contract.md` | pass; CRLF working-copy warnings only |
| `git diff --name-only -- package.json pnpm-lock.yaml pnpm-workspace.yaml apps/editor/package.json packages/*/package.json` | pass; no output |
| `rg --pcre2` non-export check over changed public `index.ts` files | pass; no output |
| Targeted forbidden-scope scans over Wave 23 diff/new files | pass; no blocking matches |
| `git status --short -uall` after verification | unchanged except expected Wave 23 working tree files and this review artifact |

## Orchestration Compliance

Result: `pass`.

- A-F completion reports record separated Gnome implementation and Review-Sylph review contexts.
- Domain D records a review-driven fix loop for source organization and UI submit coverage before passing.
- Domain F records upstream A-E pass gates before e2e work.
- Gnome final verification was separated from this clean integration review.
- This Review-Sylph did not make source/test/fixture/final-report/map edits.
- Orch-Sylph source implementation constraints remain satisfied for the reviewed artifacts.

## Residual Risks for Final Report

- Preview evidence is intentionally recomputed after load rather than persisted as durable project state. Authored dynamics groups, computed parameters, operation log, package files, and generated evidence persist.
- E2E asserts browser workflow and evidence presence, not exact numeric solver values. Numeric determinism is covered by runtime unit tests and the contract fixture.
- The editor create flow is two-step when creating a new computed output parameter. If parameter creation commits and later dynamics group creation is rejected, the output parameter can remain. Domain D classified this as a low residual workflow risk, not a pass blocker.
- Some Wave 23 touched files remain sizeable, especially existing editor controller/evidence/view-model surfaces and the single-concern dynamics validator/panel files. `check:source` passes and the dynamics workflow was split into named files; future expansion should keep splitting rather than growing these files further.

## Required Gnome Fix

None.

## User Decision Points

None.
