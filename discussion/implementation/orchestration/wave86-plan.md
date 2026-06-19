# Wave 86 Plan: Mesh v6D Crossing Constraint Local Repair

> Wave85でMesh Toolの診断payloadが強化され、`hair_f_l` の失敗原因は `v6d-invalid-constraint-input` / `failureStage: "constraint-input"` / `invalidConstraintInputReasons: ["crossing-constraint-edge"]` / `crossingConstraintEdgeCount: 1` まで絞れた。Wave86は「すべての髪を完璧にする」ことではなく、1箇所だけのboundary constraint自己交差を検出し、限定条件下で1点除去の局所修復を試し、安全に成功できる場合だけ救う。

## 1. Status

- Status: Planned / ready for orchestration
- Target wave: Wave86
- Wave name: `mesh-v6d-crossing-constraint-local-repair`
- Primary objective:
  - v6D adaptive contour constrainautorで発生した crossing constraint failure を、診断可能で bounded な形で局所修復する。
  - crossing edge pairのindex / endpoint coordinatesをdiagnostics payloadへ追加し、修復対象を観測できるようにする。
  - crossing-only / single-pair / boundary-only の場合だけ、交差pairのendpoint候補から1点を除去してboundary constraintsを再構築し、既存のsanitize / recoveryを再実行する。
  - 修復が成功条件を満たさない場合は現行fallbackを維持する。
  - v6f/custom CDT fallback、outer-loop selection変更、global simplification、mesh algorithm default変更はWave86対象外。

## 2. Planning Gate Result

Planning Gate result: `Inventory then discuss -> Plan`.

Why planning is now safe:

- Updated Mesh Tool diagnostic payload identified the concrete failure:
  - `fallback.reason: "v6d-invalid-constraint-input"`
  - `failureStage: "constraint-input"`
  - `invalidConstraintInputReasons: ["crossing-constraint-edge"]`
  - `crossingConstraintEdgeCount: 1`
  - zero-length / duplicate / invalid endpoint / point-on-edge counts are `0`.
- Sylph A confirmed the v6D adaptive pipeline:
  - boundary points are sampled from the selected outer loop;
  - constraint edges are sequential boundary edges `[i, (i + 1) % boundaryPointCount]`;
  - interior / Steiner points are appended after boundary constraints are built;
  - crossing detection has access to sanitized edge ordinals, point indexes, and endpoint coordinates.
- Sylph B confirmed the preferred repair strategy:
  - local boundary point removal around the single crossing pair;
  - retry at most four endpoint candidates;
  - preserve current fallback if repair fails.
- Sylph C confirmed v6f/custom CDT fallback should not be required scope:
  - v6f reruns contour extraction from RGBA instead of accepting the exact failed v6D candidate;
  - output semantics would require a separate design decision;
  - using v6f as an implicit fallback risks hiding invalid boundary topology.

Uncertainty:

- factual: medium-low. The failure branch is known, but synthetic fixture coverage may require careful construction.
- decision: low. User accepted the bounded success condition and agreed not to pursue the impossible “all hair perfect” target.
- cost of wrong plan: high. A broad repair could damage current high-quality mesh output for already-working parts.

## 3. Accepted Decisions / Oracles

### 3.1 Success Definition

Wave86 succeeds when:

- A single crossing boundary constraint pair can be diagnosed with enough detail to identify the pair.
- A repair path activates only for a narrow crossing-only case.
- Repair removes at most one boundary point and preserves the closed boundary constraint contract.
- Recovered output passes existing v6D quality/safety checks.
- If repair cannot safely succeed, current fallback behavior is preserved with better diagnostics.

Wave86 does not need to prove all hair or all complex alpha shapes can be meshed perfectly.

### 3.2 Repair Activation Policy

Repair may activate only when all are true:

- failure stage is `constraint-input`;
- invalid reasons are exactly crossing-only;
- crossing pair count is `1`;
- crossing endpoints are boundary vertices in the target v6D adaptive path;
- repair removes at most `1` boundary point;
- retry limit is at most `4` endpoint candidates;
- repaired sanitize has `0` crossings and `0` point-on-edge issues;
- final preserved constraints equal the repaired constraint count;
- final filtered triangles are non-empty.

If any condition fails, keep current fallback.

### 3.3 Forbidden Repair Strategies

Do not:

- drop crossing constraints while keeping the boundary points;
- silently accept missing boundary constraints as success;
- change outer-loop selection policy;
- add global boundary simplification as the primary repair;
- add v6f/custom CDT fallback as implicit behavior;
- change Editor-visible mesh algorithm selection or default algorithm id;
- add new dependencies.

### 3.4 Diagnostics Policy

Diagnostics should include capped crossing pair samples:

- sanitized constraint edge indexes;
- sanitized constraint edge point indexes;
- input constraint edge indexes when available;
- input constraint edge point indexes when available;
- endpoint coordinate segments;
- coordinate space, expected to be `candidate-texture-pixels`;
- sample limit metadata.

Diagnostics should not dump all points/edges for large meshes.

## 4. Primary Basis

Common:

- [Implementation Orchestration Skill](../../../.agents/skills/implementation-orchestration/SKILL.md)
- [UX-Backed Package Logic Authority](../../development_convention/ux-backed-package-logic-authority.md)
- [Source File Organization Policy](../../development_convention/source-file-organization-policy.md)
- [Dependency Policy](../../development_convention/dependency-policy.md)
- [Operation Policy](../../development_convention/operation-policy.md)
- [Schema and ID Conventions](../../development_convention/schema-and-id-conventions.md)

Wave baseline:

- [Wave85 Plan](wave85-plan.md)
- [Wave85 Final Integration Report](../waves/wave85/wave85-final-integration-report.md)
- [Wave85 Final Clean Integration Review](../reviews/wave85/wave85-final-clean-integration-review.md)
- `tmp/mesh-diagnotice.log`

Implementation areas:

- `packages/authoring-core/src/mesh-generation-v6d-contour-constrainautor.ts`
- `packages/authoring-core/src/mesh-generation-v6d-adaptive-contour-constrainautor.ts`
- `packages/authoring-core/src/mesh-generation-v6-contour-pipeline.ts`
- `packages/authoring-core/src/mesh-quality-metrics.ts`
- `packages/authoring-core/src/mesh-generation-contract.ts`
- `packages/authoring-core/src/mesh-generation.test.ts`
- `packages/authoring-core/src/mesh-generation-v6-fixtures.ts`
- `apps/editor/src/workspace/panels/mesh-tool-inspector.test.ts` only if copy-payload tests need the new sample fields.

Factual inventory:

- v6D adaptive builds a padded virtual texture and runs contour extraction for density and final candidate generation.
- `createV6ContourCandidateInput` builds boundary points, then sequential boundary constraint edges.
- Interior / Steiner points are appended after boundary constraints.
- `recoverV6DConstrainautorTriangles` calls `sanitizeConstrainautorInput` before Constrainautor.
- `countCrossingConstraintEdges` currently detects crossing count after invalid/zero-length/duplicate edge removal.
- The target failure has one crossing pair and no other invalid input counts.

## 5. Review Policy

Each implementation domain requires three review lanes unless explicitly documented as not applicable:

1. `Spec Compliance Review`
   - Check repair activation policy, explicit non-goals, and fallback preservation.
2. `Design / Development Compliance Review`
   - Check bounded algorithm behavior, source organization, no dependency additions, and no broad mesh default changes.
3. `Test Adequacy Review`
   - Check direct crossing repair tests, non-repair negative tests, and no-regression coverage for existing successful fixtures.

Domain reports must include:

- Basis Coverage Self-Report
- Current-State Confirmation
- Diagnostics Trace
- Repair Activation Trace
- Fallback Preservation Trace
- Must-not Compliance Evidence
- Verification
- Residual Risks

## 6. Wave Strategy

```text
Batch 1:
  Domain A: Crossing Constraint Diagnostics + Bounded Local Repair

Batch 2:
  Domain B: Final Integration / Clean Review / Map Closeout
```

Dependency rationale:

- Domain A owns the coherent implementation loop: observe the crossing pair, attempt bounded repair, and record repair diagnostics together.
- Splitting diagnostics and repair would force the repair Gnome to relearn diagnostic internals and create extra integration review surface.
- Domain B runs only after Domain A passes or explicit escalation is recorded.
- v6f/custom CDT fallback is deliberately out of scope for this wave.

## 7. Acceptance Criteria

### 7.1 Crossing Pair Diagnostics

Required:

- Add capped crossing pair sample diagnostics for crossing constraint failures.
- Include sanitized edge ordinals and sanitized point indexes.
- Include input edge indexes / input edge point indexes when available.
- Include endpoint coordinate segments in candidate texture pixel space.
- Include sample cap metadata.
- Preserve exact total crossing count.
- Preserve existing invalid input counts.

Must not:

- Dump all points/edges.
- Change triangulation behavior in the diagnostic-only path.
- Require the user PSD as a committed fixture.

### 7.2 Bounded Repair Activation

Required:

- Repair only activates for crossing-only, single-pair, boundary-edge constraint input failures.
- Retry at most four endpoint-removal candidates.
- Remove at most one boundary point.
- Rebuild cyclic boundary constraints after candidate removal.
- Re-run existing sanitize / Delaunator / Constrainautor / final filtering pipeline.
- Record repair attempted / candidate count / removed boundary point count / pre-post crossing count / repair result in diagnostics or provenance.

Must not:

- Repair zero-length, duplicate, invalid endpoint, point-on-edge, or multi-crossing cases.
- Drop crossing constraints without repairing boundary topology.
- Change successful v6D cases.

### 7.3 Repair Success Gate

Required:

- Repaired sanitize has zero crossing constraints.
- Repaired sanitize has zero point-on-edge constraints.
- Recovered output preserves all repaired constraints.
- Recovered output produces non-empty filtered triangles.
- Existing outside/crossing triangle safety checks remain active.
- Quality metrics remain populated.

Must not:

- Mark a repaired result as success if boundary constraints are missing.
- Hide repair failure by reporting normal success.

### 7.4 Fallback Preservation

Required:

- If repair preconditions fail, current fallback behavior remains.
- If all repair candidates fail, current fallback behavior remains.
- Fallback payload records enough detail to explain why repair did not happen or did not succeed.

Must not:

- Add v6f/custom CDT fallback.
- Change actual source id / output semantics to a different backend.

### 7.5 Regression Coverage

Required:

- Direct synthetic test for a repairable single crossing.
- Direct synthetic test that too-few-constraints crossing remains failed.
- Tests proving duplicate / zero-length / point-on-edge cases do not use the crossing repair.
- Test proving multi-crossing does not use the bounded repair.
- No-regression coverage for existing simple / curved / thin / adaptive fixture outputs, with at least stable success/fallback class and safety metrics.
- Test for crossing pair diagnostic sample payload.

Must not:

- Depend on user PSD assets.
- Treat visual perfection as the test oracle.

## 8. Domain Design

| Batch | Domain | Dependency | Purpose |
|---|---|---|---|
| 1 | A. Crossing Constraint Diagnostics + Bounded Local Repair | Wave85 + follow-up diagnostics baseline | Add crossing edge pair sample payload and one-point boundary repair under strict activation gates |
| 2 | B. Final Integration / Clean Review / Map Closeout | Domain A pass or explicit escalation | Combined validation, clean review, reports/maps |

## 9. Domain A: `wave86-crossing-constraint-diagnostics-bounded-repair`

Purpose:

- Implement the full bounded crossing repair loop in one coherent context:
  - make the exact crossing pair visible enough to support repair and future debugging;
  - attempt one narrowly-scoped repair for crossing-only constraint input failures;
  - preserve current fallback behavior when repair cannot safely succeed.

Expected implementation areas:

- `packages/authoring-core/src/mesh-quality-metrics.ts`
- `packages/authoring-core/src/mesh-generation-v6d-contour-constrainautor.ts`
- `packages/authoring-core/src/mesh-generation-v6d-adaptive-contour-constrainautor.ts` only if adaptive provenance/metrics need repair result propagation
- `packages/authoring-core/src/mesh-generation.test.ts`
- `packages/authoring-core/src/mesh-generation-v6-fixtures.ts` only if a new synthetic fixture is needed
- `apps/editor/src/workspace/panels/mesh-tool-inspector.test.ts` if copy-payload proof is needed

Allowed write scope:

- `packages/authoring-core/src/mesh-quality-metrics.ts`
- `packages/authoring-core/src/mesh-generation-v6d-contour-constrainautor.ts`
- `packages/authoring-core/src/mesh-generation-v6d-adaptive-contour-constrainautor.ts`
- `packages/authoring-core/src/mesh-generation.test.ts`
- `packages/authoring-core/src/mesh-generation-v6-fixtures.ts`
- focused tests for touched files
- `discussion/implementation/waves/wave86/**`
- `discussion/implementation/reviews/wave86/**`

Conditional write scope requiring explicit report justification:

- `apps/editor/src/workspace/panels/mesh-tool-inspector.test.ts` only for proving copy payload includes qualityMetrics sample fields.
- `packages/authoring-core/src/mesh-generation-contract.ts` only if type unions require a narrow diagnostic/repair reason addition.

Forbidden write scope:

- v6f/custom CDT fallback.
- Dispatcher default method changes.
- Editor UI or algorithm selector changes.
- Global contour simplification.
- Outer loop selection changes.
- New dependencies.

Required tests / evidence:

- Crossing pair sample contains sanitized edge indexes and segments for a known crossing.
- Input edge indexes are preserved where available.
- Sample cap is enforced while total crossing count remains exact.
- Existing invalid input reason and counts remain intact.
- Repairable single crossing returns generated output.
- Too-few-constraints crossing remains failed.
- Duplicate / zero-length / point-on-edge invalid input does not activate repair.
- Multi-crossing input does not activate repair.
- Existing simple / curved / thin / adaptive fixture behavior remains stable enough to prove no broad regression.
- Repair diagnostics record attempted/repaired/failed status and candidate count.

Early escape triggers:

- Crossing pair identity cannot be captured without broad data-model changes.
- Coordinate samples would require large payloads instead of capped diagnostics.
- Repair cannot be limited to boundary-only single-crossing cases.
- Repair success cannot preserve all repaired constraints.
- Direct synthetic test is not stable enough to prove behavior.

## 10. Domain B: `wave86-final-integration-clean-review-map-closeout`

Purpose:

- Validate combined Wave86 behavior, obtain independent clean review, and update persistent maps/reports.

Expected implementation areas:

- `discussion/implementation/waves/wave86/**`
- `discussion/implementation/reviews/wave86/**`
- `discussion/implementation/_map.md`
- `discussion/implementation/orchestration/_map.md`

Acceptance:

- Domain A report exists and records `pass` or explicit escalation.
- Required review lanes exist and pass, or explicit escalation is recorded.
- Final clean integration review exists and passes before Wave86 is marked complete.
- Final report records:
  - crossing pair diagnostic behavior;
  - repair activation gates;
  - repaired success behavior;
  - fallback preservation;
  - forbidden scope compliance;
  - validation results;
  - residual risks and user-decision points.
- Maps mark Wave86 status correctly.

Required checks:

- `pnpm typecheck`
- Focused authoring-core mesh generation tests touched by Domain A
- Focused Mesh Tool copy-payload test if touched by A
- `node scripts/check-source-organization.mjs`
- `node scripts/check-dependencies.mjs`
- `git diff --check`

## 11. Verification Matrix

| Requirement | Minimum evidence |
|---|---|
| Crossing pair diagnostics include capped samples | `mesh-generation.test.ts` |
| Total crossing count remains exact | `mesh-generation.test.ts` |
| Single crossing repair succeeds when safe | Direct v6D recovery test |
| Too-few constraints do not repair | Direct v6D recovery test |
| Duplicate / zero-length / point-on-edge do not repair | Direct v6D recovery tests |
| Multi-crossing does not repair | Direct v6D recovery test |
| Current fallback preserved on repair failure | Direct v6D recovery test |
| Existing successful fixtures not broadly changed | Existing v6D/adaptive fixture tests |
| No v6f fallback added | Source review + tests/provenance |
| No mesh default routing change | Source review |

## 12. Expected Persistent Artifacts

Reports:

- `discussion/implementation/waves/wave86/wave86-domain-a-crossing-constraint-diagnostics-bounded-repair-report.md`
- `discussion/implementation/waves/wave86/wave86-final-integration-report.md`
- `discussion/implementation/waves/wave86/_map.md`

Reviews:

- `discussion/implementation/reviews/wave86/wave86-domain-a-spec-compliance-review.md`
- `discussion/implementation/reviews/wave86/wave86-domain-a-design-development-review.md`
- `discussion/implementation/reviews/wave86/wave86-domain-a-test-adequacy-review.md`
- `discussion/implementation/reviews/wave86/wave86-final-clean-integration-review.md`
- `discussion/implementation/reviews/wave86/_map.md`

## 13. Subagent Contract

Domain assignment must include:

- target and wave;
- dependencies;
- allowed write scope;
- forbidden write scope;
- basis documents;
- applicable policies;
- required tests and verification;
- expected evidence;
- loop limit;
- early escape triggers.

Each Orch-Sylph must start with bounded current-state confirmation before delegating to Gnome.

Gnome instructions must include:

- This workspace may already have unrelated dirty changes.
- Do not revert user or other-agent changes.
- Do not run broad refactors.
- Implement within the domain write scope.
- Keep repair bounded to single crossing-only cases.
- Preserve current fallback when repair cannot safely succeed.
- Do not add v6f/custom CDT fallback.
- Do not change mesh algorithm default routing or Editor algorithm selection.
- Do not add dependencies.
- Do not use user PSD assets as fixtures.

Review-Sylph instructions must include:

- Review from source, tests, plan, and reports, not only from Gnome summary.
- Report `pass`, `needs_changes`, or `escalate`.
- Do not ask the user directly.
- Do not edit files unless explicitly delegated a narrow fix after review.
- Treat v6f fallback, global simplification, outer-loop policy changes, missing-constraint success, or broad default routing changes as forbidden scope.
- Treat missing repair negative tests as blocking unless explicitly escalated.

## 14. Orchestration Policy

This wave must follow `.agents/skills/implementation-orchestration/SKILL.md`.

Root / Undine:

- Owns wave plan, dependency graph, user questions, and final decision.
- Must not implement the wave.
- Must preserve root context.
- Must wait for every started subagent.
- Must treat `wait_agent` timeout as polling timeout, not failure.
- Must not close, kill, interrupt, or summarize running children as complete.

Orch-Sylph:

- Owns exactly one domain loop.
- Must start with bounded current-state confirmation for its domain.
- Must delegate implementation to Gnome unless the domain is review-only.
- Must delegate review to independent Review-Sylphs.
- Must include separate Spec Compliance Review lane.
- Must wait for Gnome and Review-Sylph completion.
- Must not cancel, close, or interrupt child agents because they are slow or waiting.
- Must close completed child agent sessions at the end of the domain.
- Must not close running child sessions.
- Must report `pass`, `needs_fix`, `blocked`, or `escalate` with file paths, validation, and residual risks.

Gnome:

- Receives domain-specific basis sections only.
- Implements within allowed scope.
- May add dependencies only through dependency policy compliance and escalation.
- Must include Basis Coverage Self-Report and Deferred Basis Items.
- Must not implement unrelated authoring, atlas, Viewer playback, camera, transport, Dynamics, or UI features.

Review-Sylph:

- Reviews from artifacts and source, not only from Gnome summary.
- Must produce assigned lane report.
- Spec Compliance Review must not silently treat basis omissions as future scope.
- Must check forbidden scope, bounded repair semantics, fallback preservation, diagnostics payload, and test coverage explicitly.

Waiting rule:

- `wait_agent` timeout is polling timeout, not failure.
- No parent agent may terminate a child agent's work merely because it has not responded yet.
- If interruption is unavoidable, record incomplete / blocked / escalated. Do not pass the wave gate.

## 15. Out of Scope

- Solving all complex hair mesh failures.
- v6f/custom CDT fallback.
- Changing default mesh generation method.
- Restoring visible Editor algorithm selection.
- Outer-loop selection changes.
- Global boundary simplification as primary repair.
- Dropping constraints and claiming success.
- User PSD fixture import.
- Full visual/pixel oracle.
- Texture Atlas Task.
- Dynamics / Viewer / Deformer / keyform work.
- Save/load schema changes.
- New external dependencies.
- Cubism SDK / `.moc3` / `.model3.json` / `.physics3.json` compatibility.
