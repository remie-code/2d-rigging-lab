# Wave 71 Plan: Mesh Generation v6D Adaptive Staggered Band

> Wave70の改良v6D support-ring backendを本命系列として残し、次版としてサイズ適応densityとstaggered alpha-to-inner stripを追加するwave。既存Wave70 v6Dは保持し、新方式は新ファイル・新method/source idとして追加したうえでEditor既定経路を差し替える。

## 1. Status

- Status: Planned / ready for orchestration
- Target wave: Wave71
- Wave name: `mesh-generation-v6d-adaptive-staggered-band`
- Primary objective:
  - Wave70 v6D support-ring resultを保持する。
  - 次版v6Dとして `auto-outline-v6d-adaptive-staggered-band` を新規追加する。
  - 現在ユーザーが調整した `high` / `medium` / `low` 値を各presetの基準値として取り込む。
  - パーツサイズに応じてdensityを解決する。
  - alpha boundary直下にstaggered inner stripを明示生成する。
  - inner-strip失敗時は粗いfallbackの前にWave70 v6Dへ戻す。
  - Editorの通常mesh生成defaultを新方式へ差し替える。

## 2. Planning Gate Result

Planning Gate result before this plan: `Plan directly`.

Why planning is now safe:

- ユーザー判断が明確:
  - 現行v6D support-ring方向が本命。
  - 既存実装を壊さず新ファイルで追加する。
  - Algorithm selector UIは復活させない。
  - 現在の `high` / `medium` / `low` 値を各presetの基準値にする。
  - 次版ではサイズ適応densityとstaggered inner stripを実装する。
- 実装前の不確実性は、各Domainのbounded current-state confirmationで処理可能。
- 新しいUX判断は不要。見える制御は既存presetのまま。

Uncertainty:

- factual: medium. 現在のdensity helper、support-ring diagnostics、method/source registry、Editor default routeはDomain A開始時に確認が必要。
- decision: low. 実装方針とUI境界は合意済み。
- cost of wrong plan: medium-high. Mesh生成defaultの差し替えとfallback順序を誤ると、通常のpreview/apply体験が壊れる。

## 3. Accepted Decisions / Oracles

- Root / Undine must not implement the wave.
- Implementation must be delegated through Orch-Sylph -> Gnome / Review-Sylph.
- Root / Undine and Orch-Sylph must wait for started subagents.
- `wait_agent` timeout is polling timeout, not failure.
- Running child agents must not be killed, interrupted, closed, or summarized as complete.
- Completed child sessions must be closed by their parent.
- Existing Wave70 method remains available:
  - `auto-outline-v6d-contour-band-support-rings`
  - `outline-v6d-contour-band-support-rings-rgba`
  - `packages/authoring-core/src/mesh-generation-v6d-contour-band-support-rings.ts`
- New method is added, not implemented by rewriting the Wave70 file.
- Editor users should not choose between mesh algorithms.
- Product-facing presets remain visible and meaningful.
- No part-name, drawable-name, or semantic image recognition should influence density.
- Current `NEAREST` texture filtering state must not be reverted.

## 4. Naming And Method IDs

New method:

```text
method id: auto-outline-v6d-adaptive-staggered-band
source id: outline-v6d-adaptive-staggered-band-rgba
backend id: v6d-adaptive-staggered-band
implementation file: packages/authoring-core/src/mesh-generation-v6d-adaptive-staggered-band.ts
```

Existing Wave70 method remains:

```text
method id: auto-outline-v6d-contour-band-support-rings
source id: outline-v6d-contour-band-support-rings-rgba
backend id: v6d-contour-band-support-rings
implementation file: packages/authoring-core/src/mesh-generation-v6d-contour-band-support-rings.ts
```

## 5. Primary Basis

Common:

- [Implementation Orchestration Skill](../../../.agents/skills/implementation-orchestration/SKILL.md)
- [UX-Backed Package Logic Authority](../../development_convention/ux-backed-package-logic-authority.md)
- [Source File Organization Policy](../../development_convention/source-file-organization-policy.md)
- [Dependency Policy](../../development_convention/dependency-policy.md)
- [Operation Policy](../../development_convention/operation-policy.md)
- [Schema and ID Conventions](../../development_convention/schema-and-id-conventions.md)

Design / algorithm:

- [Mesh Generation Design Map](../../design/mesh-generation/_map.md)
- [auto-outline-v6D Adaptive Staggered Band](../../design/mesh-generation/auto-outline-v6d-adaptive-staggered-band.md)
- [auto-outline-v6D Staggered Inner Strip](../../design/mesh-generation/auto-outline-v6d-staggered-inner-strip.md)
- [auto-outline-v6G Contour Band Support Rings](../../design/mesh-generation/auto-outline-v6g-contour-band-support-rings.md)

Wave baseline:

- [Wave70 Plan](wave70-plan.md)
- [Wave70 Final Integration Report](../waves/wave70/wave70-final-integration-report.md)
- [Wave70 Final Clean Integration Review](../reviews/wave70/wave70-final-clean-integration-review.md)

Current tuning basis:

```text
high:
  boundarySpacing: 10
  interiorSpacing: 7.5
  maxBoundaryVertices: 96
  maxInteriorVertices: 64
  interiorBoundaryClearance: 1.1

medium:
  boundarySpacing: 15
  interiorSpacing: 10
  maxBoundaryVertices: 96
  maxInteriorVertices: 32
  interiorBoundaryClearance: 1.1

low:
  boundarySpacing: 30
  interiorSpacing: 15
  maxBoundaryVertices: 64
  maxInteriorVertices: 16
  interiorBoundaryClearance: 1.5
```

Domain A must confirm these current values before implementation. If the worktree differs, report the difference and use the user's latest tuned values as the baseline unless a newer user instruction says otherwise.

## 6. Review Policy

Each implemented domain requires three review lanes unless explicitly N/A:

1. `Spec Compliance Review`
   - Checks this wave plan and primary basis docs.
   - Each relevant basis requirement must be classified as `implemented` / `explicit non-goal` / `deferred by plan` / `unclear` / `not relevant`.
   - `unclear` is not pass.
2. `Design / Development Compliance Review`
   - Checks module boundary, source organization, determinism, fallback ordering, diagnostics, dependency policy, operation boundary, and forbidden scope.
3. `Test Adequacy Review`
   - Checks focused unit / integration / browser / e2e coverage or N/A rationale for each in-scope requirement.

Each Gnome report must include:

- Basis Coverage Self-Report
- Intentionally Deferred Basis Items
- Mesh Generation Contract Trace
- Density Scaling Evidence
- Staggered Strip Geometry Evidence
- Fallback Ordering Evidence
- Must-not Compliance Evidence
- Residual Risk Classification

## 7. Wave Strategy

Wave71 uses one implementation domain plus one final integration domain to avoid unnecessary orchestration overhead.

```text
Batch 1:
  Domain A: Adaptive Staggered-Band Backend / Default Route

Batch 2:
  Domain B: Final Integration / Clean Review / Map Closeout
```

Dependency graph:

```text
A adds the new method/source/file, adaptive density, explicit staggered strip, fallback improvements, diagnostics, tests, and Editor default routing.
B depends on A pass or explicit escalation and performs final validation, clean review, and map closeout.
```

Rationale:

- The backend, diagnostics, method contract, and Editor default route are tightly coupled for this wave.
- Splitting density and strip geometry into separate implementation domains would increase handoff cost without reducing risk enough.
- The final integration domain remains separate to preserve a clean review gate.

## 8. Acceptance Criteria

### 8.1 New v6D Adaptive Staggered Backend

Required:

- Add `auto-outline-v6d-adaptive-staggered-band`.
- Add `outline-v6d-adaptive-staggered-band-rgba`.
- Implement it in a new file.
- Preserve Wave70 `auto-outline-v6d-contour-band-support-rings`.
- Reuse the strong v6D contour pipeline:
  - soft alpha mask;
  - main component selection;
  - boundary loop trace;
  - outer loop selection;
  - arclength alpha boundary sampling;
  - constrained triangulation.
- Capture current `high` / `medium` / `low` tuned values as preset baselines.
- Resolve actual density from preset baseline plus part size.
- Use component opaque pixel area as primary size signal.
- Use alpha bounds area only as fallback when component area is unavailable.
- Scaling must be deterministic and monotonic:
  - larger part in the same preset must not reduce `maxInteriorVertices`;
  - smaller part in the same preset should reduce `maxInteriorVertices` unless already clamped at minimum.
- Do not use part names, drawable names, or semantic recognition for density.

### 8.2 Staggered Inner Strip

Required:

- Build staggered inner points from alpha edge midpoints:

```text
I[i] = midpoint(A[i], A[i+1]) + inwardNormal(edge i) * innerOffset
```

- Do not align inner points directly with alpha vertices.
- Emit explicit alpha-to-inner strip triangles:

```text
A[i], A[i+1], I[i]
A[i+1], I[i+1], I[i]
```

- Use the staggered inner ring as the outer boundary for ordinary interior fill where the strip is active.
- Filter ordinary interior points to the inside of the staggered inner polygon.
- Final active strip regions must not contain direct alpha-boundary-to-ordinary-interior edges.
- Degenerate / skipped local strip segments must be diagnosed.

### 8.3 Fallback And Diagnostics

Required fallback order:

```text
adaptive staggered band
-> local strip omission / reduced offset when safe
-> Wave70 support-ring v6D
-> structured coarse fallback
-> blocked only for true extraction/no-alpha failures
```

Diagnostics must include:

- resolved adaptive density parameters;
- effective area and reference area;
- area / spacing / vertex scales;
- staggered inner point counts;
- skipped staggered inner point counts;
- explicit strip triangle counts;
- degenerate explicit strip triangle counts;
- interior point count before / after inner-polygon filtering;
- direct alpha-to-interior edge count;
- fallback reason when adaptive strip is not fully used.

### 8.4 Editor Default Route

Required:

- Editor Mesh Tool preview/apply default becomes `auto-outline-v6d-adaptive-staggered-band`.
- Preset UX remains visible.
- Algorithm selection UI remains absent.
- Preview does not mutate committed mesh.
- Apply commits the previewed mesh and provenance.
- Historical meshes with Wave70 or older v6D/v6E/v6F provenance remain display-safe.
- Existing logging for mesh-generation preview may include the new diagnostics if the current debug hook remains present.

Must not:

- Reintroduce a backend selector under another name.
- Add semantic automatic preset selection.
- Add renderer / texture padding / dilation work.
- Add new dependencies unless dependency-policy compliant and explicitly escalated.

## 9. Domain Design

| Batch | Domain | Dependency | Purpose |
|---|---|---|---|
| 1 | A. Adaptive Staggered-Band Backend / Default Route | Wave70 + new algorithm spec | New method/source/file, adaptive density, explicit strip, fallback, diagnostics, tests, Editor default |
| 2 | B. Final Integration / Clean Review / Map Closeout | A pass or explicit escalation | Final validation, clean review, reports/maps |

## 10. Domain A: `wave71-adaptive-staggered-band-backend-default-route`

Purpose:

- Add the new v6D adaptive staggered-band method and make it the normal Editor mesh-generation route.

Expected implementation areas:

- `packages/authoring-core/src/mesh-generation-v6d-adaptive-staggered-band.ts`
- `packages/authoring-core/src/mesh-generation-v6-contour-pipeline.ts`
- `packages/authoring-core/src/mesh-generation-contract.ts`
- `packages/authoring-core/src/mesh-generation.ts`
- `packages/authoring-core/src/mesh-generation.test.ts`
- `packages/authoring-core/src/mesh-quality-metrics.ts`
- `packages/operation-core/**` only if method/provenance/diagnostics contract requires it
- `apps/editor/src/features/editor-session/model/mesh-tool-state.ts`
- `apps/editor/src/features/editor-session/model/editor-session-commands.ts`
- focused Editor model / command tests
- focused e2e only if stable and needed for default-route proof

Allowed write scope:

- `packages/authoring-core/**`
- `packages/operation-core/**` only for method/provenance/diagnostics contract alignment
- `apps/editor/**` only for default route, preview/apply provenance, debug diagnostics, and tests
- `discussion/implementation/waves/wave71/**`
- `discussion/implementation/reviews/wave71/**`

Forbidden write scope:

- Renderer texture filtering / padding / dilation changes.
- Algorithm selector UI restoration.
- Deleting Wave70 v6D or old v6D/v6E/v6F methods.
- New package dependencies unless dependency policy is followed and escalated.
- Broad refactors unrelated to mesh generation.

Required tests / evidence:

- New method/source id exists and routes.
- Wave70 method remains callable.
- Baseline medium reference-sized input resolves close to current tuned values.
- Size scaling monotonic tests for smaller / larger synthetic components.
- Explicit staggered strip diagnostics exist.
- Direct alpha-to-ordinary-interior edge count is checked or computed for active strip regions.
- Fallback to Wave70 support-ring v6D occurs before coarse fallback when adaptive strip is globally invalid.
- Editor default method is the new method.
- Algorithm selector remains absent.
- Preview/apply semantics remain unchanged.

Early escape triggers:

- The current mesh DTO cannot represent the explicit strip without a broader contract change.
- Constrainautor / triangulation cannot accept inner ring as fill boundary without invalid topology that cannot be localized.
- Fallback ordering conflicts with current operation provenance schema.
- Test oracle for direct alpha-to-interior edge detection cannot be made deterministic.

## 11. Domain B: `wave71-final-integration-clean-review-map-closeout`

Purpose:

- Validate the wave end-to-end, obtain independent clean review, and update persistent maps.

Expected implementation areas:

- `discussion/implementation/waves/wave71/**`
- `discussion/implementation/reviews/wave71/**`
- `discussion/implementation/_map.md`
- `discussion/implementation/orchestration/_map.md`
- `discussion/design/mesh-generation/_map.md`

Acceptance:

- Domain A implementation report exists and records pass or explicit escalation.
- Domain A Spec / Design-Development / Test Adequacy reviews exist and pass, or explicit escalation is recorded.
- Final clean integration review exists and passes before the wave is marked complete.
- Final report records:
  - new method/source/backend id;
  - Wave70 preservation proof;
  - adaptive density evidence;
  - staggered strip evidence;
  - fallback ordering evidence;
  - Editor default proof;
  - validation results;
  - residual visual-quality risks.
- Maps mark Wave71 status correctly.
- Accepted `NEAREST` texture filtering state is not reverted.

Forbidden:

- Production source implementation except narrow documentation/map fixes.
- Closing the wave without independent clean review.
- Treating missing child-agent responses as pass.

Required checks:

- `pnpm typecheck`
- Focused authoring-core mesh generation tests
- Focused operation-core generate mesh tests if operation/provenance changes
- Focused editor mesh tool state / command tests
- Focused PSD import -> mesh preview/apply e2e only if stable and needed
- `node scripts/check-source-organization.mjs`
- `node scripts/check-dependencies.mjs`
- `git diff --check`

## 12. Verification Matrix

| Requirement | Minimum evidence |
|---|---|
| New adaptive method exists | Source file, registry/route, method/source tests |
| Wave70 method preserved | Old method callable test and no deletion/rewrite evidence |
| Baseline values captured | Density resolver test and implementation report |
| Size-adaptive density | Small/reference/large monotonic tests |
| Staggered inner strip | Geometry test or diagnostics proving edge-midpoint inner points and explicit triangles |
| No alpha-to-ordinary-interior first layer | Edge classification test or diagnostic assertion |
| Fallback order | Test or report showing Wave70 fallback before coarse fallback |
| Editor default route | Editor state/command tests and provenance evidence |
| Algorithm selector remains absent | Editor test/e2e negative assertion |
| No renderer expansion | Diff/review check over renderer paths |

## 13. Expected Persistent Artifacts

Reports:

- `discussion/implementation/waves/wave71/wave71-domain-a-adaptive-staggered-band-backend-default-route-report.md`
- `discussion/implementation/waves/wave71/wave71-final-integration-report.md`
- `discussion/implementation/waves/wave71/_map.md`

Reviews:

- `discussion/implementation/reviews/wave71/wave71-domain-a-spec-compliance-review.md`
- `discussion/implementation/reviews/wave71/wave71-domain-a-design-development-review.md`
- `discussion/implementation/reviews/wave71/wave71-domain-a-test-adequacy-review.md`
- `discussion/implementation/reviews/wave71/wave71-final-clean-integration-review.md`
- `discussion/implementation/reviews/wave71/_map.md`

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
- Must preserve Wave70 v6D support-ring method.
- Must avoid v6A discarded triangulation.
- Must not add semantic part-specific density rules.
- Must include basis coverage and deferred basis items.

Review-Sylph:

- Reviews from artifacts and source, not only from Gnome summary.
- Must produce assigned lane report.
- Spec Compliance Review must not silently treat basis omissions as future scope.
- Must check Wave70 preservation, adaptive density, staggered strip, fallback order, Editor default, and selector absence.

Waiting rule:

- `wait_agent` timeout is polling timeout, not failure.
- No parent agent may terminate a child agent's work merely because it has not responded yet.
- If interruption is unavoidable, record incomplete / blocked / escalated. Do not pass the wave gate.

## 15. Out of Scope

- Permanent or temporary algorithm selector UI.
- Side-by-side visual diff UI.
- Further v6E/v6F algorithm development.
- Deleting old v6D/v6E/v6F methods.
- Texture padding/dilation.
- Renderer/WebGL feature expansion.
- Canvas2D sunset.
- Photoshop compositing parity.
- Manual mesh vertex / edge / topology editing.
- Auto-rigging.
- Semantic recognition from part name, drawable name, or image content.
- Automatic preset selection from artwork semantics.
- Cubism SDK / `.moc3` / `.model3.json` compatibility.
- External HTTP / WebSocket / MCP transport.
- LLM provider integration.
- Repo-side semantic proposal generation / auto-fix.
