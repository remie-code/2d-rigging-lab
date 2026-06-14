# Wave 69 Plan: Mesh Generation v6 Contour Salvage Triangulation Candidates

> Wave68で最も惜しかった `auto-outline-v6a-local` を「輪郭抽出器」として救い、失敗した三角形化を捨てるwave。v6Aのsoft alpha mask / component selection / boundary loop trace / outer loop selection / boundary samplingを共有pipeline化し、三角形化を `v6D constrainautor` / `v6E poly2tri` / `v6F custom constrained triangulation` の3候補で比較する。最終default選定はこのwaveの外に置く。

## 1. 状態

- Status: Final complete / pass
- Target wave: Wave69
- Wave name: `mesh-generation-v6-contour-salvage-triangulation-candidates`
- Primary objective:
  - v6Aを輪郭抽出・boundary samplingのsourceとして救い、v6Aのear clipping / interior split triangulationを破棄する。
  - `auto-outline-v6d-contour-constrainautor` / `auto-outline-v6e-contour-poly2tri` / `auto-outline-v6f-contour-custom-cdt` を同一contour pipeline・同一preset・同一品質メタデータで比較可能にする。
  - Editorの一時backend selectorをv6D/v6E/v6Fへ移し、v6A/v6B/v6Cを可視候補から外してよい。
  - Editor default mesh methodは引き続き `auto-outline-v2.6-soft-apron` のまま維持する。
  - Wave69では最終backend採用を決めない。人間のvisual check後に別判断とする。

## 2. Planning Gate Result

Planning Gate result before this plan: `Plan directly`.

Why planning is now safe:

- Wave68の実装とレビューが完了しており、v6A/v6B/v6Cの比較結果と限界が新しい。
- ユーザー判断が明確: v6Aは輪郭抽出器として救い、三角形化器としては捨てる。
- 追加判断が明確: v6D/v6Eのライブラリ候補に加え、v6Fとして自作三角形化も同格候補にする。
- 次waveのbasis文書が作成済み: [auto-outline-v6D / v6E / v6F Contour-Salvage Triangulation](../../design/mesh-generation/auto-outline-v6d-v6e-v6f-contour-salvage-triangulation.md)。
- Wave68で追加済みの `delaunator` / `@kninnug/constrainautor` / `poly2tri` 依存は現在のworkspaceに存在する。Wave69では原則として新規依存追加を前提にしない。

Uncertainty:

- factual: low-medium. 現行v6A/B/C surface、Editor selector、quality metricsの具体差分はDomain Aで軽く再確認する必要がある。
- decision: low. v6D/v6E/v6Fを比較対象にし、v6A/v6B/v6Cを可視候補から外す方針は確定。
- cost of wrong plan: medium-high. 共有contour pipelineと3候補実装が同じsourceを触るため、Domain順序とwrite scopeを間違えると衝突しやすい。

## 3. Accepted Decisions / Oracles

- UXとmesh-generation contractは真。Accepted UX may require `packages/**` changes.
- Root / Undine must not implement the wave. Implementation must be delegated through Orch-Sylph -> Gnome / Review-Sylph.
- Root / Undine and Orch-Sylph must wait for started subagents. Poll timeout is not failure.
- Running child agents must not be killed, interrupted, or closed. Completed child sessions must be closed by their parent.
- v6Aは「輪郭抽出器」としてのみ救う。
- v6Aのear clipping / fan fallback / `splitTrianglesWithInteriorPoints` / row-major interior placementはWave69のアルゴリズムbasisにしない。
- v6D/v6E/v6Fは同格の比較候補である。v6Fはfallbackではなくfirst-class candidateとして扱う。
- v6A/v6B/v6CはEditorの一時selectorから外してよい。
- Editor default remains `auto-outline-v2.6-soft-apron`.
- Wave69は最終backend選定をしない。
- Mesh rendering blur/triangle smear issue is considered separately resolved by the accepted `NEAREST` texture filtering change. Wave69 must not expand into texture padding/dilation/rendering work, and must not revert unrelated accepted rendering changes.
- Mesh generation quality and mesh rendering quality remain separate concerns.

## 4. Primary Basis

Common:

- [Implementation Orchestration Skill](../../../.agents/skills/implementation-orchestration/SKILL.md)
- [UX-Backed Package Logic Authority](../../development_convention/ux-backed-package-logic-authority.md)
- [Source File Organization Policy](../../development_convention/source-file-organization-policy.md)
- [Dependency Policy](../../development_convention/dependency-policy.md)
- [Operation Policy](../../development_convention/operation-policy.md)
- [Schema and ID Conventions](../../development_convention/schema-and-id-conventions.md)

Design / UX:

- [Mesh Generation Design Map](../../design/mesh-generation/_map.md)
- [auto-outline-v6D / v6E / v6F Contour-Salvage Triangulation](../../design/mesh-generation/auto-outline-v6d-v6e-v6f-contour-salvage-triangulation.md)
- [auto-outline-v6 Alpha-Constrained Delaunay Algorithm](../../design/mesh-generation/auto-outline-v6-alpha-constrained-delaunay.md)
- [auto-outline-v6 Library Candidate Inventory](../../design/mesh-generation/auto-outline-v6-library-candidate-inventory.md)
- [Mesh Tool Component](../../design/screen-design/components/mesh-tool.md)

Wave Baseline:

- [Wave68 Plan](wave68-plan.md)
- [Wave68 Final Integration Report](../waves/wave68/wave68-final-integration-report.md)
- [Wave68 Final Clean Integration Review](../reviews/wave68/wave68-final-clean-integration-review.md)

## 5. Review Policy

Each implementation domain requires three review lanes unless explicitly N/A:

1. `Spec Compliance Review`
   - Checks wave plan and primary basis docs.
   - Each relevant basis requirement must be classified as `implemented` / `explicit non-goal` / `deferred by plan` / `unclear` / `not relevant`.
   - `unclear` is not pass.
2. `Design / Development Compliance Review`
   - Checks architecture, module boundary, source organization, operation boundary, dependency policy, determinism, and forbidden scope.
3. `Test Adequacy Review`
   - Checks unit / integration / browser / e2e / manual visual check coverage or N/A rationale for each in-scope requirement.

Each Gnome report must include:

- Basis Coverage Self-Report
- Intentionally Deferred Basis Items
- Mesh Generation Contract Trace
- Must-not Compliance Evidence
- Residual Risk Classification

Each Orch-Sylph must close completed child sessions at domain completion. Running child sessions must not be closed, interrupted, or killed.

## 6. Wave Strategy

Wave69 uses a 5-domain structure. Domain E combines Editor selector replacement and final integration / closeout to reduce orchestration overhead.

```text
Batch 1:
  Domain A: V6 Contour Salvage Shared Pipeline / Method Surface

Batch 2:
  Domain B: V6D Contour + Constrainautor
  Domain C: V6E Contour + Poly2Tri
  Domain D: V6F Contour + Custom Constrained Triangulation

Batch 3:
  Domain E: Editor Selector Replacement / Final Integration / Clean Review / Map Closeout
```

Dependency graph:

```text
A defines shared contour salvage module, v6D/E/F method/source ids, shared metrics, fixture boundary, and v6A firebreak
B depends on A and existing constrainautor/delaunator dependency surface
C depends on A and existing poly2tri dependency surface
D depends on A and runs as a first-class candidate in the same comparison batch as B/C
E depends on A/B/C/D pass or explicit escalation
```

Rationale:

- The useful v6A behavior should be extracted once into a shared contour pipeline before any candidate backend depends on it.
- v6D, v6E, and v6F can run in the same candidate batch after A because they should consume the same shared input contract and produce comparable outputs.
- v6F is custom and riskier, but the user explicitly wants it treated as a first-class candidate rather than delayed behind library candidates.
- Candidate domains B/C/D must avoid overlapping edits to shared contour/contract files after A. If shared routing or metrics need changes, they should report the need for integration instead of silently diverging.
- Editor selector updates and final integration are combined in Domain E to reduce domain overhead while still preserving final clean review.
- Final integration must check that v6A/B/C are no longer visible comparison choices, v6D/E/F are first-class sidecars, and default remains V2.6.

## 7. Acceptance Criteria

### 7.1 Shared Contour Salvage Pipeline / Method Surface

```text
RGBA alpha
  -> soft alpha mask
  -> main component selection
  -> boundary loop trace
  -> outer loop selection
  -> boundary sampling
  -> shared candidate input for v6D/E/F
```

Required:

- Add explicit method ids:
  - `auto-outline-v6d-contour-constrainautor`
  - `auto-outline-v6e-contour-poly2tri`
  - `auto-outline-v6f-contour-custom-cdt`
- Add explicit source ids:
  - `outline-v6d-contour-constrainautor-rgba`
  - `outline-v6e-contour-poly2tri-rgba`
  - `outline-v6f-contour-custom-cdt-rgba`
- Keep current default method as `auto-outline-v2.6-soft-apron`.
- Extract or create a shared v6 contour pipeline from the salvageable v6A stages only:
  - soft alpha mask
  - opaque component selection
  - pixel boundary loop trace
  - outer loop selection
  - boundary loop sampling
- Establish shared interior / Steiner point generation contract for v6D/E/F.
- Establish shared constraint edge representation.
- Establish shared quality/fallback metadata for v6D/E/F.
- Preserve deterministic output expectations without exact triangle-layout overfitting.
- Add or update fixtures that expose the v6A spoke-like triangle failure class.

Must not:

- Reuse v6A triangulation implementation.
- Reuse v6A row-major interior placement as primary strategy.
- Switch default to any v6 candidate.
- Treat v6D/E/F selector as final product UX.
- Introduce new dependencies without dependency-policy compliance.

### 7.2 V6D Contour + Constrainautor

```text
auto-outline-v6d-contour-constrainautor
  -> shared contour points / interior points / boundary constraints
  -> delaunator
  -> @kninnug/constrainautor
  -> boundary-edge verification
  -> cleanup / fallback metadata
```

Required:

- Use the shared v6 contour salvage pipeline as input.
- Validate and sanitize duplicate points, zero-length edges, and deterministic point ordering.
- Run Delaunator over all boundary and interior points.
- Recover boundary constraints through Constrainautor.
- Verify required boundary constraint edges survive or are intentionally split with traceable metadata.
- Filter triangles outside the main mask / outer polygon.
- Surface backend-specific metrics:
  - backend id
  - constraint edge count
  - preserved/missing constraint count
  - outside/crossing triangle count where available
  - thrown error kind if applicable
- Return structured failure or visible fallback when constraints are not preserved.

Must not:

- Label unconstrained Delaunay output as constrained success.
- Hide missing boundary constraints behind cleanup.
- Make v6D default.

### 7.3 V6E Contour + Poly2Tri

```text
auto-outline-v6e-contour-poly2tri
  -> shared outer contour / optional holes / Steiner points
  -> poly2tri
  -> boundary and coverage verification
  -> cleanup / fallback metadata
```

Required:

- Use the shared v6 contour salvage pipeline as input.
- Quantize/dedupe contour and interior points.
- Validate simple polygon preconditions before triangulation.
- Normalize winding.
- Use interior samples as Steiner points.
- Either support holes or report clear no-hole / main-island-only limitation through metadata.
- Surface backend-specific metrics:
  - backend id
  - outer point count
  - hole count
  - Steiner point count
  - polygon/hole validation failures
  - triangulation thrown flag
  - boundary preserved/missing counts
- Preserve deterministic output and mesh DTO invariants.

Must not:

- Treat invalid polygon triangulation failure as success.
- Hide hole or multi-island limitations.
- Make v6E default.

### 7.4 V6F Contour + Custom Constrained Triangulation

```text
auto-outline-v6f-contour-custom-cdt
  -> shared contour points / interior points / boundary constraints
  -> repo-local all-points constrained triangulation
  -> deterministic local improvement
  -> cleanup / fallback metadata
```

Required:

- Use the shared v6 contour salvage pipeline as input.
- Implement a new custom triangulation path, not v6A ear clipping under a new name.
- Ensure all selected boundary and interior points participate in triangulation from the start or through a global retriangulation step.
- Track boundary edges as hard constraints.
- Use a defensible custom strategy such as:
  - incremental Bowyer-Watson Delaunay over all points followed by constraint recovery;
  - advancing-front triangulation from sampled boundary inward;
  - hybrid local edge-flip legalization preserving constrained boundary edges.
- Penalize or improve long boundary-to-boundary spokes when a better local edge exists.
- Surface v6F-specific metrics:
  - edge flip count
  - constraint recovery operation count
  - long-spoke candidate count
  - rejected local improvement count
  - custom triangulation fallback reason
- Treat v6F as first-class comparison output, not fallback-only.

Must not:

- Use `earClipPolygon` / fan fallback / `splitTrianglesWithInteriorPoints` as algorithm basis.
- Accept long spokes only because triangle centroids are inside the mask.
- Overfit only the observed eye/hair screenshot case.
- Make v6F default.

### 7.5 Editor Selector Replacement / Preview Provenance

```text
Mesh Tool
  -> preset remains product-facing
  -> temporary experimental backend selector chooses v6D/v6E/v6F
  -> v6A/v6B/v6C are removed from visible current choices
  -> preview shows source/fallback/quality summary
  -> Apply preserves selected preview provenance
```

Required:

- Replace visible v6A/v6B/v6C choices with v6D/v6E/v6F.
- Keep `Large Motion` / `Standard` / `Low Motion` as the product-facing preset dimension.
- Keep current default flow on `auto-outline-v2.6-soft-apron`.
- Show enough provenance to distinguish successful v6D/E/F backend output from fallback output.
- Surface compact quality data useful for manual comparison, such as vertex count, triangle count, boundary/interior counts, and fallback steps.
- Preserve preview -> Apply semantics. Preview must not mutate committed mesh until Apply.
- Keep the selector isolated so a later wave can remove/hide it after final backend selection.

Must not:

- Present backend selection as permanent end-user UX.
- Auto-select backend from part name, drawable name, or semantic image recognition.
- Claim the selected v6 candidate is final or default.
- Add side-by-side comparison UI as mandatory scope.

## 8. Domain Design

| Batch | Domain | Dependency | Purpose |
|---|---|---|---|
| 1 | A. V6 Contour Salvage Shared Pipeline / Method Surface | Wave68 + v6D/E/F design doc | method/source ids, shared contour pipeline, shared input/metrics/fallback contract, fixture boundary |
| 2 | B. V6D Contour + Constrainautor | A + existing dependency surface | Delaunay + constraint recovery backend |
| 2 | C. V6E Contour + Poly2Tri | A + existing dependency surface | constrained polygon + Steiner backend |
| 2 | D. V6F Custom Constrained Triangulation | A | custom all-points constrained triangulation candidate |
| 3 | E. Editor Selector Replacement / Final Integration / Clean Review / Map Closeout | A/B/C/D pass or explicit escalation | temporary comparison control updated to v6D/E/F, validation, cross-domain review, maps |

## 9. Domain A: `wave69-v6-contour-salvage-shared-pipeline-method-surface`

Purpose:

- Extract the salvageable v6A contour stages into a shared v6D/E/F input pipeline and update method/source/metrics/fallback contracts.

Expected implementation areas:

- `packages/authoring-core/**`
- `packages/operation-core/**`
- `packages/package-format/**` only if method metadata/schema requires it
- focused authoring-core / operation-core tests

Implementation guidance:

- Current v6A source may be read only for soft alpha mask, component selection, boundary loop trace, outer loop selection, and boundary sampling.
- Split contour-facing helpers away from v6A triangulation if needed.
- Do not keep a broad dependency on the old v6A local triangulator.
- Add shared candidate input DTO/internal type for boundary points, constraint edges, interior/Steiner points, alpha bounds, and diagnostics.
- Add tests that prove v6D/E/F method/source ids are accepted but do not yet require all backend domains to pass.

Acceptance:

- v6D/E/F method/source ids are accepted by headless generation path and operation allowlists.
- Current default remains V2.6.
- Shared contour pipeline produces deterministic boundary points and constraint edges for representative fixtures.
- v6A triangulation logic is not used by the shared pipeline.
- Shared metrics/fallback shape can represent v6D/E/F backend success/failure.
- Typecheck and focused tests pass.

Forbidden:

- Editor UI work beyond type/contract preservation.
- New dependencies unless escalated and policy-compliant.
- v6A ear clipping or row-major interior placement as basis.

## 10. Domain B: `wave69-mesh-auto-outline-v6d-contour-constrainautor`

Purpose:

- Implement `auto-outline-v6d-contour-constrainautor` using the shared contour pipeline and Delaunator + Constrainautor backend.

Expected implementation areas:

- `packages/authoring-core/**`
- focused mesh generation tests

Acceptance:

- v6D generates valid deterministic meshes on representative non-empty alpha fixtures.
- v6D visibly fails/fallbacks when constraints cannot be preserved.
- v6D does not produce the v6A-style spoke fan on the targeted fixture class, or records residual risk if the automated fixture cannot fully prove visual quality.
- Backend diagnostics and quality metrics are populated.
- Existing v6A/B/C behavior may remain headless but is not the current comparison target.

Forbidden:

- Unconstrained output labeled as constrained.
- Default switch.
- Old triangulation reference.

## 11. Domain C: `wave69-mesh-auto-outline-v6e-contour-poly2tri`

Purpose:

- Implement `auto-outline-v6e-contour-poly2tri` using the shared contour pipeline and Poly2Tri backend.

Expected implementation areas:

- `packages/authoring-core/**`
- focused mesh generation tests

Acceptance:

- v6E generates valid deterministic meshes for simple outer polygon + Steiner fixtures.
- v6E clearly reports hole/multi-island limitations or handles them with evidence.
- Polygon validation failure is visible and does not masquerade as success.
- Backend diagnostics and quality metrics are populated.
- Browser/Vite import behavior remains stable.

Forbidden:

- Invalid polygon success label.
- Default switch.
- Old triangulation reference.

## 12. Domain D: `wave69-mesh-auto-outline-v6f-custom-constrained-triangulation`

Purpose:

- Implement a new repo-local custom constrained triangulation candidate as a first-class comparison path.

Expected implementation areas:

- `packages/authoring-core/**`
- focused mesh generation tests

Implementation guidance:

- Prefer a small defensible v0 over a sprawling geometry engine.
- The key acceptance is not "perfect CDT"; it is all-points participation, boundary constraints, deterministic local improvement, and visible diagnostics.
- If robust constraint recovery is not achieved, report limitation/fallback clearly rather than returning misleading success.

Acceptance:

- v6F generates valid deterministic meshes on representative fixtures.
- v6F does not reuse v6A ear clipping/split triangulation.
- v6F has evidence that long boundary-to-boundary spokes are reduced or explicitly counted/rejected.
- v6F quality metrics include custom triangulation diagnostics.
- v6F is selectable and comparable as its own method/source.

Forbidden:

- Old v6A triangulation under a new method id.
- Overfitting exact visual geometry.
- Default switch.

## 13. Domain E: `wave69-editor-v6d-v6e-v6f-selector-final-integration`

Purpose:

- Update the temporary Mesh Tool backend selector from v6A/B/C to v6D/E/F, preserve preview/apply provenance, and complete Wave69 final integration / clean review / map closeout in the same domain.

Expected implementation areas:

- `apps/editor/src/workspace/panels/mesh-tool-inspector.tsx`
- `apps/editor/src/features/editor-session/model/mesh-tool-state.ts`
- `apps/editor/src/features/editor-session/editor-session-context.tsx`
- `apps/editor/src/features/editor-session/model/editor-session-commands.ts`
- editor command/model tests
- focused Playwright semantic test if stable
- final validation commands
- wave69 maps and final review artifacts

Acceptance:

- User can explicitly preview v6D/v6E/v6F for a selected Drawable.
- v6A/v6B/v6C are not presented as current visible comparison choices.
- User can see whether preview is successful backend output or fallback.
- Apply commits the previewed mesh and provenance correctly.
- Default V2.6 behavior remains unchanged when experimental selector is not used.
- Existing PSD import / mesh preview / mesh apply semantic path remains stable.
- Domain reports and review lanes exist for A/B/C/D.
- v6D/E/F all use the shared contour salvage pipeline.
- v6A triangulation / row-major interior placement is not reused.
- v6F is a first-class custom candidate.
- Quality/fallback metadata distinguishes success from fallback.
- Mesh generation tests do not overfit exact triangle layouts.
- Accepted `NEAREST` texture filtering change is not reverted, while no new rendering scope is claimed.
- Wave69 maps and final clean integration review are recorded.

Forbidden:

- Permanent backend-library UX framing.
- Side-by-side visual diff as mandatory work.
- Rendering/WebGL expansion.

Required checks:

- `pnpm typecheck`
- Focused authoring-core mesh generation tests from Domains A/B/C/D
- Focused operation-core generate mesh tests from Domain A/E
- Focused editor mesh tool state / command tests from Domain E
- Focused Playwright semantic flow for PSD import -> mesh preview/apply if stable and not visual-pixel based
- `node scripts/check-source-organization.mjs`
- `node scripts/check-dependencies.mjs`
- `git diff --check`

Expected artifacts:

- `discussion/implementation/waves/wave69/wave69-domain-a-v6-contour-salvage-shared-pipeline-method-surface-report.md`
- `discussion/implementation/waves/wave69/wave69-domain-b-mesh-auto-outline-v6d-contour-constrainautor-report.md`
- `discussion/implementation/waves/wave69/wave69-domain-c-mesh-auto-outline-v6e-contour-poly2tri-report.md`
- `discussion/implementation/waves/wave69/wave69-domain-d-mesh-auto-outline-v6f-custom-constrained-triangulation-report.md`
- `discussion/implementation/waves/wave69/wave69-domain-e-editor-v6d-v6e-v6f-selector-final-integration-report.md`
- `discussion/implementation/waves/wave69/_map.md`
- `discussion/implementation/reviews/wave69/_map.md`
- `discussion/implementation/reviews/wave69/wave69-final-clean-integration-review.md`

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
- Must close completed child agent sessions at the end of the domain to avoid zombie sessions.
- Must not close running child sessions.
- Must report `pass`, `needs_fix`, `blocked`, or `escalate` with file paths, validation, and residual risks.

Gnome:

- Receives domain-specific basis sections only.
- Implements within allowed scope.
- May modify `packages/**` when the domain explicitly allows it and accepted UX/architecture requires it.
- May add dependencies only through dependency policy compliance and escalation.
- Must include Basis Coverage Self-Report and Deferred Basis Items.
- Must explicitly state how it avoided v6A discarded triangulation and V1-V5 algorithm internals.

Review-Sylph:

- Reviews from artifacts and source, not only from Gnome summary.
- Must produce assigned lane report.
- Spec Compliance Review must not silently treat basis omissions as future scope.
- Must check the v6A salvage/firebreak boundary.

Waiting rule:

- `wait_agent` timeout is polling timeout, not failure.
- No parent agent may terminate a child agent's work merely because it has not responded yet.
- If interruption is unavoidable, record incomplete / blocked / escalated. Do not pass the wave gate.

## 15. Expected Persistent Artifacts

Reports:

- `discussion/implementation/waves/wave69/wave69-domain-a-v6-contour-salvage-shared-pipeline-method-surface-report.md`
- `discussion/implementation/waves/wave69/wave69-domain-b-mesh-auto-outline-v6d-contour-constrainautor-report.md`
- `discussion/implementation/waves/wave69/wave69-domain-c-mesh-auto-outline-v6e-contour-poly2tri-report.md`
- `discussion/implementation/waves/wave69/wave69-domain-d-mesh-auto-outline-v6f-custom-constrained-triangulation-report.md`
- `discussion/implementation/waves/wave69/wave69-domain-e-editor-v6d-v6e-v6f-selector-final-integration-report.md`
- `discussion/implementation/waves/wave69/_map.md`

Reviews:

- `discussion/implementation/reviews/wave69/wave69-domain-a-spec-compliance-review.md`
- `discussion/implementation/reviews/wave69/wave69-domain-a-design-development-review.md`
- `discussion/implementation/reviews/wave69/wave69-domain-a-test-adequacy-review.md`
- `discussion/implementation/reviews/wave69/wave69-domain-b-spec-compliance-review.md`
- `discussion/implementation/reviews/wave69/wave69-domain-b-design-development-review.md`
- `discussion/implementation/reviews/wave69/wave69-domain-b-test-adequacy-review.md`
- `discussion/implementation/reviews/wave69/wave69-domain-c-spec-compliance-review.md`
- `discussion/implementation/reviews/wave69/wave69-domain-c-design-development-review.md`
- `discussion/implementation/reviews/wave69/wave69-domain-c-test-adequacy-review.md`
- `discussion/implementation/reviews/wave69/wave69-domain-d-spec-compliance-review.md`
- `discussion/implementation/reviews/wave69/wave69-domain-d-design-development-review.md`
- `discussion/implementation/reviews/wave69/wave69-domain-d-test-adequacy-review.md`
- `discussion/implementation/reviews/wave69/wave69-domain-e-spec-compliance-review.md`
- `discussion/implementation/reviews/wave69/wave69-domain-e-design-development-review.md`
- `discussion/implementation/reviews/wave69/wave69-domain-e-test-adequacy-review.md`
- `discussion/implementation/reviews/wave69/wave69-final-clean-integration-review.md`
- `discussion/implementation/reviews/wave69/_map.md`

## 16. Out of Scope

- Switching Editor default mesh generation to v6D/v6E/v6F.
- Choosing the final v6 backend.
- Removing the temporary backend selector entirely after final selection.
- Permanent product UX that asks normal users to choose triangulation libraries.
- Semantic recognition from part name, drawable name, or image content.
- Automatic preset selection.
- Auto-rigging.
- Manual mesh vertex / edge / topology editing.
- Side-by-side visual diff UI as mandatory work.
- Screenshot / pixel-perfect visual oracle as required pass condition.
- Further WebGL renderer feature expansion.
- Texture padding/dilation work.
- Canvas2D sunset.
- Photoshop compositing parity.
- Full support for every pathological alpha mask in v0.
- Cubism SDK / `.moc3` / `.model3.json` compatibility.
- External HTTP / WebSocket / MCP transport.
- LLM provider integration.
- Repo-side semantic proposal generation / auto-fix.
