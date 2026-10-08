# Wave85 Domain A Test Adequacy Review

## Verdict

pass

## Scope reviewed

- Wave: Wave85 `validation-diagnostics-v0`
- Domain: `wave85-editor-local-diagnostics-projection`
- Lane: Test Adequacy Review
- Reviewed current source/test files on disk:
  - `apps/editor/src/features/editor-session/model/editor-diagnostics-state.ts`
  - `apps/editor/src/features/editor-session/model/editor-diagnostics-state.test.ts`
- No source, test, product-doc, map, or implementation report files were edited.

## Basis documents used

- `discussion/implementation/orchestration/wave85-plan.md`
- `discussion/design/screen-design/screens/diagnostics-evidence-view.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/implementation/waves/wave85/wave85-domain-a-editor-local-diagnostics-projection-report.md`
- `packages/package-format/src/model-files.ts` for current keyform/dynamics DTO shape confirmation
- `apps/editor/src/features/editor-session/model/parameter-keyform-state.ts` for `listEditorParameters()` behavior

## Findings

| Severity | File / line refs | Issue | Recommendation |
|---|---|---|---|
| none | `apps/editor/src/features/editor-session/model/editor-diagnostics-state.test.ts:54`, `:103`, `:145`, `:179`, `:205` | No blocking or needs-change findings. The five tests directly exercise all required Domain A diagnostic codes, the output-keyform-missing negative case, and warning count behavior required by `discussion/implementation/orchestration/wave85-plan.md:412`. | Proceed with Domain A as pass-classified for this lane. |
| info | `apps/editor/src/features/editor-session/model/editor-diagnostics-state.ts:600`, `:610`; `apps/editor/src/features/editor-session/model/editor-diagnostics-state.test.ts:205` | The negative `dynamics.outputKeyformMissing` test uses a representative `linear-1d-v1` keyform. Source also handles `parameter-grid-2d-v1` through `parameterX` / `parameterY`, but that evaluator is not separately fixture-tested. This is not blocking because the required v0 behavior is "at least one keyformSet exists for output parameter", and the implementation path is simple and covered by source review. | Add a 2D keyform regression later if Dynamics or Parameter Grid work starts depending on this path more heavily. |
| info | `apps/editor/src/features/editor-session/model/editor-diagnostics-state.ts:74`, `:673`; `apps/editor/src/features/editor-session/model/editor-diagnostics-state.test.ts:190`, `:200` | Deterministic ID stability is tested by repeated projection over the same session, and source sorts items by category, code, then id. Tests do not shuffle source graph input order. This is adequate for the Domain A badge/count gate and low-risk for downstream list consumers because the comparator is explicit. | If Domain B/C make visual order a user-visible contract, add a focused shuffled-input ordering test there or in this model test. |

## Test coverage checklist

| Required behavior | Coverage judgment | Evidence |
|---|---|---|
| Mesh missing for Drawable used by Deformer / keyform target | Covered | Test starts at `editor-diagnostics-state.test.ts:54`; asserts `mesh.drawableMeshMissing`, count, details/action hint, and non-mutation at `:77`-`:100`. Source path is `editor-diagnostics-state.ts:85`-`:130`. |
| Missing keyform parameter | Covered | Test starts at `editor-diagnostics-state.test.ts:103`; asserts `references.keyformParameterMissing` count at `:137`-`:142`. Source path is `editor-diagnostics-state.ts:139`-`:188`. |
| Missing keyform target Drawable | Covered | Same test asserts `references.keyformTargetDrawableMissing` at `editor-diagnostics-state.test.ts:137`-`:142`. Source path is `editor-diagnostics-state.ts:190`-`:217`. |
| Missing keyform target Deformer | Covered | Same test asserts `references.keyformTargetDeformerMissing` at `editor-diagnostics-state.test.ts:137`-`:142`. Source path is `editor-diagnostics-state.ts:219`-`:249`. |
| Missing Deformer parent | Covered | Test starts at `editor-diagnostics-state.test.ts:145`; asserts `references.deformerParentMissing` at `:165`-`:176`. Source path is `editor-diagnostics-state.ts:256`-`:288`. |
| Missing Deformer child | Covered | Same test asserts two `references.deformerChildMissing` items at `editor-diagnostics-state.test.ts:165`-`:176`. Source path is `editor-diagnostics-state.ts:290`-`:321` and `:574`-`:598`. |
| Deformer parent cycle | Covered | Same test asserts one `references.deformerParentCycle` and cycle details at `editor-diagnostics-state.test.ts:165`-`:176`. Source path is `editor-diagnostics-state.ts:506`-`:558`. |
| Dynamics missing input parameter | Covered | Test starts at `editor-diagnostics-state.test.ts:179`; asserts `dynamics.inputParameterMissing` at `:192`-`:198`. Source path is `editor-diagnostics-state.ts:324`-`:361`. |
| Dynamics missing output parameter | Covered | Same test asserts `dynamics.outputParameterMissing` at `editor-diagnostics-state.test.ts:192`-`:198`. Source path is `editor-diagnostics-state.ts:363`-`:389`. |
| Duplicate Dynamics output ownership in existing data | Covered | Same test asserts `dynamics.outputOwnershipDuplicate` at `editor-diagnostics-state.test.ts:192`-`:198`. Source path is `editor-diagnostics-state.ts:422`-`:450`. |
| Dynamics output keyform missing, positive case | Covered | Same test asserts two `dynamics.outputKeyformMissing` items at `editor-diagnostics-state.test.ts:192`-`:198`. Source path is `editor-diagnostics-state.ts:390`-`:419`. |
| Dynamics output keyform missing, no-warning when any keyformSet exists | Covered | Negative test starts at `editor-diagnostics-state.test.ts:205`; asserts no diagnostics and zero warnings at `:227`-`:228`. Source keyform-parameter set path is `editor-diagnostics-state.ts:482`-`:489` and `:600`-`:625`. |
| Stable warning item count for badges | Covered | Counts asserted at `editor-diagnostics-state.test.ts:78`, `:142`, `:176`, `:198`, `:199`, and `:228`; helper source is `editor-diagnostics-state.ts:57`-`:83` and `:670`. |
| Deterministic IDs / downstream item stability | Adequate | Repeated projection ID equality is asserted at `editor-diagnostics-state.test.ts:190` and `:200`-`:202`; source sorts at `editor-diagnostics-state.ts:74` using comparator at `:673`-`:679` and stable id generation at `:684`-`:687`. |
| Read-only / non-mutating projection behavior | Sufficient | Mesh test snapshots and compares session state at `editor-diagnostics-state.test.ts:74` and `:100`. Source review found only local `Map` / `Set` / array construction and no writes to `session`; risk is low for this pure projection. |

## Verification reviewed

Reviewed Orch-Sylph-provided verification results:

- `pnpm.cmd exec vitest run apps/editor/src/features/editor-session/model/editor-diagnostics-state.test.ts`
  - Sandbox attempt failed with esbuild `spawn EPERM`.
  - Escalated rerun passed: 1 file, 5 tests.
- `pnpm.cmd typecheck`: passed.
- `node scripts/check-source-organization.mjs`: passed.
- `node scripts/check-dependencies.mjs`: passed.
- `git diff --check -- apps/editor/src/features/editor-session/model/editor-diagnostics-state.ts apps/editor/src/features/editor-session/model/editor-diagnostics-state.test.ts`: passed.

I did not rerun these commands in this review lane; the review uses the provided verification plus source/test inspection.

## Residual risks / user-decision points

- Residual risk: `parameter-grid-2d-v1` keyform parameter coverage is source-reviewed but not separately asserted. This is acceptable for Domain A because the required negative behavior is covered by a representative keyformSet and the implementation enumerates both 1D and 2D parameter refs.
- Residual risk: deterministic ordering is not tested against shuffled graph arrays. This is acceptable for Domain A because the source comparator is explicit and warning count/id stability are covered; stronger ordering tests can be added when Domain B/C turn list ordering into visible UI behavior.
- No user-decision point identified for this lane.
