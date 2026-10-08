# Wave85 Domain A: Editor-local Diagnostics Projection Report

## Verdict

pass

## Files changed

- `apps/editor/src/features/editor-session/model/editor-diagnostics-state.ts`
- `apps/editor/src/features/editor-session/model/editor-diagnostics-state.test.ts`
- `discussion/implementation/waves/wave85/wave85-domain-a-editor-local-diagnostics-projection-report.md`
- `discussion/implementation/waves/wave85/_map.md`
- `discussion/implementation/reviews/wave85/wave85-domain-a-spec-compliance-review.md`
- `discussion/implementation/reviews/wave85/wave85-domain-a-design-development-review.md`
- `discussion/implementation/reviews/wave85/wave85-domain-a-test-adequacy-review.md`
- `discussion/implementation/reviews/wave85/_map.md`

## Basis Coverage Self-Report

- Read: `discussion/implementation/orchestration/wave85-plan.md`
- Read: `discussion/design/screen-design/screens/diagnostics-evidence-view.md`
- Read: `discussion/implementation/remaining-work-backlog.md`
- Read: `discussion/development_convention/source-file-organization-policy.md`
- Read: `discussion/development_convention/dependency-policy.md`
- Read: `discussion/development_convention/operation-policy.md`
- Read: `discussion/development_convention/schema-and-id-conventions.md`

## Current-State Confirmation

- `editor-diagnostics-state.ts` and `editor-diagnostics-state.test.ts` were absent before Domain A.
- Existing Editor model files expose session graph data needed for deterministic projection: drawables, meshes, parameters, keyform sets, rig controls, and dynamics groups.
- Existing Dynamics Tool validation covers create/edit draft checks, but not editor-wide loaded-data diagnostics.
- Worktree already had unrelated dirty discussion changes and untracked Wave85 planning material before Domain A; Domain A did not revert them.

## Diagnostics Projection Trace

| Requirement | Projection code | Test coverage |
|---|---|---|
| Mesh missing for Drawable used by Deformer / keyform target | `mesh.drawableMeshMissing` | `warns when a deformer or keyform uses a Drawable with a missing mesh` |
| Missing keyform parameter | `references.keyformParameterMissing` | `warns for missing keyform parameters and missing Drawable or Deformer targets` |
| Missing keyform target Drawable | `references.keyformTargetDrawableMissing` | `warns for missing keyform parameters and missing Drawable or Deformer targets` |
| Missing keyform target Deformer | `references.keyformTargetDeformerMissing` | `warns for missing keyform parameters and missing Drawable or Deformer targets` |
| Missing Deformer parent | `references.deformerParentMissing` | `warns for missing Deformer parent, missing children, and parent cycles` |
| Missing Deformer child | `references.deformerChildMissing` | `warns for missing Deformer parent, missing children, and parent cycles` |
| Deformer parent cycle | `references.deformerParentCycle` | `warns for missing Deformer parent, missing children, and parent cycles` |
| Dynamics missing input parameter | `dynamics.inputParameterMissing` | `warns for existing Dynamics broken references, duplicate output ownership, and missing output keyforms` |
| Dynamics missing output parameter | `dynamics.outputParameterMissing` | `warns for existing Dynamics broken references, duplicate output ownership, and missing output keyforms` |
| Duplicate Dynamics output ownership in existing data | `dynamics.outputOwnershipDuplicate` | `warns for existing Dynamics broken references, duplicate output ownership, and missing output keyforms` |
| Dynamics output keyform missing | `dynamics.outputKeyformMissing` | `warns for existing Dynamics broken references, duplicate output ownership, and missing output keyforms` |
| No output-keyform warning when at least one keyformSet exists | no item | `does not warn for Dynamics output keyform missing when any keyformSet uses the output parameter` |
| Stable warning item count | `warningItemCount`, `countEditorDiagnosticWarnings()` | repeated projection id equality and count assertions |

## Must-not Compliance Evidence

- React UI components were not edited.
- Viewer code was not edited.
- Mesh generation algorithms were not edited.
- Dynamics schema and operation payloads were not edited.
- Product Preflight was not migrated or imported.
- No auto-fix or repair action was added.
- No dependency was added.
- Projection is read-only and operates from `AuthoringSession` data without mutation; tests assert no session mutation for mesh diagnostics.

## Verification

- `pnpm.cmd exec vitest run apps/editor/src/features/editor-session/model/editor-diagnostics-state.test.ts`
  - Sandbox attempt failed with esbuild `spawn EPERM`.
  - Escalated rerun passed: 1 file, 5 tests.
- `pnpm.cmd typecheck`: passed.
- `node scripts/check-source-organization.mjs`: passed.
- `node scripts/check-dependencies.mjs`: passed.
- `rg -n "[ \t]+$" apps/editor/src/features/editor-session/model/editor-diagnostics-state.ts apps/editor/src/features/editor-session/model/editor-diagnostics-state.test.ts discussion/implementation/waves/wave85 discussion/implementation/reviews/wave85`: no matches.

## Review lane results and applied fixes

- Spec Compliance Review: `pass`.
  - Artifact: `discussion/implementation/reviews/wave85/wave85-domain-a-spec-compliance-review.md`
  - Result: no findings; required projection behavior and v0 constraints passed.
- Design / Development Compliance Review: `pass`.
  - Artifact: `discussion/implementation/reviews/wave85/wave85-domain-a-design-development-review.md`
  - Result: no findings; source organization, dependency, operation, schema/ID, and forbidden-scope checks passed.
- Test Adequacy Review: `pass`.
  - Artifact: `discussion/implementation/reviews/wave85/wave85-domain-a-test-adequacy-review.md`
  - Result: no blocking findings; residual info notes only.
- Fix loop: not used. All review lanes returned `pass` on the initial implementation.

## Residual risks / user-decision points

- Validate screen, badge rendering, jump execution, tree icons, and inline tool surfacing are intentionally deferred to later Wave85 domains.
- Action hints are metadata for later domains and do not perform navigation or mutation in Domain A.
- `parameter-grid-2d-v1` output-keyform membership is source-reviewed but not separately asserted by a dedicated 2D keyform test; Review-Sylph classified this as non-blocking for Domain A.
- Deterministic item ordering is covered by repeated projection ID equality and source comparator review, but not by a shuffled-input test; Review-Sylph classified this as non-blocking for Domain A.
- No user-decision point remains for Domain A.
