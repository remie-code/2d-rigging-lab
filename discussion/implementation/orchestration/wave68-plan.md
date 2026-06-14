# Wave 68 Plan: Mesh Generation Quality Foundation v6 Sidecar Candidates

> Mesh生成品質の足場を作るwave。`auto-outline-v6` を最終defaultとして扱わず、v6a local / v6b constrainautor / v6c poly2tri の3候補を同じpreset・同じDTO契約・同じ品質メタデータで比較可能なsidecarとして実装する。最終ユーザーUXは「presetを選ぶと適切なmeshが得られる」ことであり、backend selectorは探索中だけの一時的な評価口とする。

## 1. 状態

- Status: Final complete / pass
- Target wave: Wave68
- Wave name: `mesh-generation-quality-foundation-v6-sidecar-candidates`
- Primary objective:
  - Mesh `auto-outline-v6` を、既存V1-V5系の失敗実装をアルゴリズム根拠にしない独立sidecarとして追加する。
  - `auto-outline-v6a-local` / `auto-outline-v6b-constrainautor` / `auto-outline-v6c-poly2tri` を同一preset・同一入力・同一品質サマリで比較できるようにする。
  - Editor Mesh Toolでは探索中だけ backend を明示選択できる一時比較口を追加する。
  - 通常の制作UXでは algorithm/backend 名を主役にしない。既存preset `Large Motion` / `Standard` / `Low Motion` の意味を維持する。
  - Editor default mesh methodはWave67時点の `auto-outline-v2.6-soft-apron` のまま維持し、v6系をdefaultにしない。

## 2. Planning Gate Result

Planning Gate result before this plan: `Inventory first` -> `Discuss` -> `Plan directly`.

Inventory and discussion basis:

- [Wave68 Preplan Mesh Generation Replacement Inventory](../waves/wave68-preplan-mesh-generation-replacement-inventory.md)
- [auto-outline-v6 Alpha-Constrained Delaunay Algorithm](../../design/mesh-generation/auto-outline-v6-alpha-constrained-delaunay.md)
- [auto-outline-v6 Library Candidate Inventory](../../design/mesh-generation/auto-outline-v6-library-candidate-inventory.md)
- [auto-outline-v6b Delaunator + Constrainautor Backend](../../design/mesh-generation/auto-outline-v6b-constrainautor.md)
- [auto-outline-v6c Poly2Tri Backend](../../design/mesh-generation/auto-outline-v6c-poly2tri.md)

Why planning is now safe:

- The user decision is settled: v6 should be a sidecar, not an immediate default replacement.
- The next implementation wave should compare three backend candidates rather than hard-code one candidate between manual checks.
- The final product direction is also settled: users should eventually choose presets, not triangulation backend names.
- The implementation seam is known: `createGeneratedMeshForDrawable(input)`, operation payload method allowlists, Editor Mesh Tool preview/apply contract, and mesh quality/fallback metadata.
- The current default is known: Wave67 preserved `auto-outline-v2.6-soft-apron` as the Editor default while adding V4 as a non-default sidecar.
- The negative history is documented: V1-V5 and recursive/offset/ring variants are not algorithm source material for v6.

Uncertainty:

- factual: medium. Dependency compatibility, contour extraction details, and library behavior on thin/holey/multi-island alpha masks require implementation-time evidence.
- decision: low. The user has accepted temporary backend selection for development comparison and final removal/hiding after choosing one backend.
- cost of wrong plan: high. Mesh quality directly affects deformation editability, WebGL-rendered output quality, and whether later rigging UX feels trustworthy.

## 3. Accepted Decisions / Oracles

- UX and mesh-generation contract are true. Accepted UX may require `packages/**` changes.
- Root / Undine must not implement the wave. Implementation must be delegated through Orch-Sylph -> Gnome / Review-Sylph.
- Root / Undine and Orch-Sylph must wait for started subagents. Poll timeout is not failure.
- Running child agents must not be killed, interrupted, or closed. Completed child sessions must be closed by their parent.
- V6 is sidecar-first. It must not become the Editor default in this wave.
- Existing Editor default remains `auto-outline-v2.6-soft-apron` unless a later user decision changes it.
- V6 implementation basis is limited to the v6 design documents and public DTO/operation/Editor contracts.
- Gnome must not use existing mesh-generation implementations as algorithm reference.
- Existing V1-V5 / recursive offset / contour band / envelope / apron / soft boundary / grid algorithms are allowed only as integration-contract or negative-history evidence.
- `auto-outline-v6a-local`, `auto-outline-v6b-constrainautor`, and `auto-outline-v6c-poly2tri` are temporary comparison candidates.
- Temporary backend selection is allowed only as an exploration/comparison tool. It must be easy to remove or hide after final backend selection.
- Mesh preset selection remains product-facing. Backend selection must not be framed as a final end-user feature.
- Dependency additions for v6b/v6c require dependency-policy due diligence and explicit escalation if policy or network approval is needed.
- If a library backend cannot be installed, imported, licensed, or made deterministic, do not fake success. Record the backend as blocked or escalated.
- Mesh generation quality and mesh rendering quality are separate concerns. V6 must not claim WebGL seam fixes, pixel-perfect rendering, or Cubism compatibility.

## 4. Primary Basis

Common:

- [Implementation Orchestration Skill](../../../.github/skills/implementation-orchestration/SKILL.md)
- [UX-Backed Package Logic Authority](../../development_convention/ux-backed-package-logic-authority.md)
- [Source File Organization Policy](../../development_convention/source-file-organization-policy.md)
- [Dependency Policy](../../development_convention/dependency-policy.md)
- [Operation Policy](../../development_convention/operation-policy.md)
- [Schema and ID Conventions](../../development_convention/schema-and-id-conventions.md)

Design / UX:

- [Mesh Tool Component](../../design/screen-design/components/mesh-tool.md)
- [Mesh Generation Design Map](../../design/mesh-generation/_map.md)
- [auto-outline-v6 Alpha-Constrained Delaunay Algorithm](../../design/mesh-generation/auto-outline-v6-alpha-constrained-delaunay.md)
- [auto-outline-v6 Library Candidate Inventory](../../design/mesh-generation/auto-outline-v6-library-candidate-inventory.md)
- [auto-outline-v6b Delaunator + Constrainautor Backend](../../design/mesh-generation/auto-outline-v6b-constrainautor.md)
- [auto-outline-v6c Poly2Tri Backend](../../design/mesh-generation/auto-outline-v6c-poly2tri.md)
- [Mesh Image Rendering Architecture](../../design/mesh-rendering/mesh-image-rendering-architecture.md)

Wave67 Baseline:

- [Wave67 Plan](wave67-plan.md)
- [Wave67 Final Integration Report](../waves/wave67/wave67-final-integration-report.md)
- [Wave67 Final Clean Integration Review](../reviews/wave67/wave67-final-clean-integration-review.md)

Wave68 Inventory:

- [Wave68 Preplan Mesh Generation Replacement Inventory](../waves/wave68-preplan-mesh-generation-replacement-inventory.md)

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
- User Workflow Trace or Mesh Generation Contract Trace
- Must-not Compliance Evidence
- Residual Risk Classification

Each Orch-Sylph must close completed child sessions at domain completion. Running child sessions must not be closed, interrupted, or killed.

## 6. Wave Strategy

Wave68 uses a `5 + 1` structure.

```text
Batch 1:
  Domain A: V6 Shared Contract / Dependency Gate / Method Surface

Batch 2:
  Domain B: V6A Local Reference Backend
  Domain C: V6B Delaunator + Constrainautor Backend
  Domain D: V6C Poly2Tri Backend

Batch 3:
  Domain E: Editor Temporary Backend Selector / Preview Provenance

Batch 4:
  Domain F: Final Integration / Clean Review / Map Closeout
```

Dependency graph:

```text
A defines shared v6 method ids, DTO/metrics/fallback contract, dependency gate, and test fixture boundary
B depends on A
C depends on A and any approved dependency additions
D depends on A and any approved dependency additions
E depends on A and should integrate B/C/D results when available
F depends on A/B/C/D/E pass or explicit escalation
```

Rationale:

- The three candidates should be comparable, so shared method ids, quality metadata, fallback semantics, and fixture expectations must be fixed before backend implementation.
- Library dependency work must be coordinated once to avoid parallel package manifest / lockfile collisions.
- V6A gives a dependency-free reference candidate and fallback target.
- V6B and V6C can run in parallel after dependency and shared-contract boundaries are known.
- Editor comparison UI is deliberately temporary and should be isolated from the final product-facing preset UX.
- Final integration must explicitly check that V6 candidates did not become default, did not reuse old algorithms, and did not blur mesh generation quality with rendering quality.

## 7. Acceptance Criteria

### 7.1 V6 Shared Contract / Method Surface

```text
Mesh generation request
  -> explicit v6 candidate method id
  -> shared v6 quality/fallback metadata
  -> valid mesh DTO or explicit fallback/blocker
```

Required:

- Add explicit method ids for:
  - `auto-outline-v6a-local`
  - `auto-outline-v6b-constrainautor`
  - `auto-outline-v6c-poly2tri`
- Add explicit source ids for:
  - `outline-v6a-local-rgba`
  - `outline-v6b-constrainautor-rgba`
  - `outline-v6c-poly2tri-rgba`
- Keep current default method as `auto-outline-v2.6-soft-apron`.
- Define shared v6 quality/fallback metadata shape using existing mesh DTO/provenance patterns where practical.
- Ensure method allowlists remain synchronized across authoring-core and operation-core.
- Establish shared fixture helpers for simple rectangle, curved blob, thin tapered shape, hole-like shape, and empty/missing alpha fallback.
- Establish deterministic output expectations without exact triangle-layout overfitting.
- Coordinate dependency-policy checks for all proposed library dependencies before C/D implementation relies on them.

Must not:

- Switch default to any v6 candidate.
- Treat v6 backend selector as final product UX.
- Introduce library dependencies without policy compliance.
- Reuse old algorithm internals, constants, helper logic, sampling strategies, or geometry tests as v6 algorithm basis.

### 7.2 V6A Local Reference Backend

```text
auto-outline-v6a-local
  -> soft alpha mask
  -> contour / adaptive boundary / interior samples
  -> local boundary-preserving or safe fallback triangulation
  -> deterministic mesh or explicit fallback
```

Required:

- Implement a dependency-free local v6 candidate from the v6 design document.
- Use soft alpha mask, contour extraction or equivalent boundary derivation, adaptive boundary simplification, and adaptive interior sampling.
- Produce deterministic vertices, UVs, triangles, stable ids, bounds, source id, fallback steps, and quality metrics.
- Preserve mesh DTO invariants.
- Large Motion must produce more deformation support than Low Motion on representative fixtures.
- V6A may use an approximate boundary-preserving approach only if it reports limitations honestly.
- V6A can serve as fallback target for library backends when those fail, but fallback must be visible in metadata.

Must not:

- Use V1-V5 implementation logic as source.
- Claim full constrained Delaunay unless actually implemented.
- Hide fallback as successful V6A geometry.
- Claim Cubism or pixel-perfect reproduction.

### 7.3 V6B Delaunator + Constrainautor Backend

```text
auto-outline-v6b-constrainautor
  -> shared v6 points / boundary edges
  -> delaunator
  -> @kninnug/constrainautor
  -> boundary-edge verification
  -> cleanup / fallback metadata
```

Required:

- Add and verify required dependencies only after dependency-policy due diligence.
- Verify browser/Vite import behavior and TypeScript integration.
- Validate and sanitize duplicate points, zero-length edges, crossing edges, and deterministic point ordering before triangulation.
- Verify required boundary constraint edges survive after constraint recovery.
- Surface backend-specific metrics:
  - backend id
  - constraint edge count
  - preserved/missing constraint count
  - outside/crossing triangle count where available
  - thrown error kind if applicable
- Return structured failure or visible fallback when constraints are not preserved.
- Preserve mesh DTO invariants and deterministic output.

Must not:

- Label unconstrained Delaunay output as constrained success.
- Hide missing boundary constraints behind cleanup.
- Use old repository mesh-generation algorithms as reference.
- Make v6b default.

### 7.4 V6C Poly2Tri Backend

```text
auto-outline-v6c-poly2tri
  -> shared v6 contour / holes / Steiner points
  -> poly2tri
  -> boundary and coverage verification
  -> cleanup / fallback metadata
```

Required:

- Add and verify required dependencies only after dependency-policy due diligence.
- Verify browser/Vite import behavior and TypeScript integration.
- Validate simple polygon preconditions before triangulation.
- Support simple outer contour plus adaptive interior samples as Steiner points.
- Either support holes or report clear main-island-only / no-hole limitation through metadata.
- For multiple islands, either implement deterministic per-island merge or report main-island-only limitation.
- Surface backend-specific metrics:
  - backend id
  - outer point count
  - hole count
  - Steiner point count
  - polygon/hole validation failures
  - triangulation thrown flag
  - boundary preserved/missing counts
- Preserve mesh DTO invariants and deterministic output.

Must not:

- Treat invalid polygon triangulation failure as success.
- Hide hole or multi-island limitations.
- Use old repository mesh-generation algorithms as reference.
- Make v6c default.

### 7.5 Editor Temporary Backend Selector / Preview Provenance

```text
Mesh Tool
  -> preset remains product-facing
  -> temporary experimental backend selector chooses v6a/v6b/v6c
  -> preview shows source/fallback/quality summary
  -> Apply preserves selected preview provenance
```

Required:

- Add temporary experimental backend selection only in the Mesh Tool or equivalent existing mesh generation surface.
- Keep preset controls separate from backend selection.
- Make default visible behavior continue to use `auto-outline-v2.6-soft-apron`.
- Allow the user to generate/preview/apply v6a, v6b, and v6c explicitly.
- Show enough provenance to distinguish successful v6 backend output from fallback output.
- Surface compact quality data useful for manual comparison, such as vertex count, triangle count, boundary/interior counts, and fallback steps.
- Preserve preview -> Apply semantics. Preview must not mutate committed mesh until Apply.
- Keep the selector isolated so a later wave can remove/hide it after final backend selection.

Must not:

- Present backend selection as permanent end-user UX.
- Auto-select backend from part name, drawable name, or semantic image recognition.
- Claim the selected v6 candidate is final or default.
- Require side-by-side visual diff as a mandatory deliverable in this wave.

## 8. Domain Design

| Batch | Domain | Dependency | Purpose |
|---|---|---|---|
| 1 | A. V6 Shared Contract / Dependency Gate / Method Surface | Wave67 V2.6 default + v6 design docs | method/source ids, shared metrics/fallback contract, dependency gate, fixture boundary |
| 2 | B. V6A Local Reference Backend | A | dependency-free v6 candidate and visible fallback behavior |
| 2 | C. V6B Delaunator + Constrainautor Backend | A + approved dependencies | constraint-recovery backend, diagnostics, fallback |
| 2 | D. V6C Poly2Tri Backend | A + approved dependencies | constrained polygon backend, diagnostics, fallback |
| 3 | E. Editor Temporary Backend Selector / Preview Provenance | A/B/C/D pass or partial escalation | temporary comparison control, preview/apply provenance, quality summary |
| 4 | F. Final Integration / Clean Review / Map Closeout | A/B/C/D/E pass or explicit escalation | validation, cross-domain review, maps |

## 9. Domain A: `wave68-v6-shared-contract-dependency-gate-method-surface`

Purpose:

- Establish the shared v6 method surface, metadata contract, dependency gate, and fixture expectations so all three candidates are comparable.

Expected implementation areas:

- `packages/authoring-core/**`
- `packages/operation-core/**`
- `packages/package-format/**` only if method metadata/schema requires it
- workspace manifests and lockfile only for approved/coordinated dependency additions
- focused authoring-core / operation-core tests

Implementation guidance:

- Read only public routing/type boundaries from current mesh-generation code.
- Treat `auto-outline-v6-alpha-constrained-delaunay.md` as the shared algorithm source of truth.
- Treat `auto-outline-v6-library-candidate-inventory.md` as dependency due-diligence basis.
- If dependencies require network or approval, escalate instead of inventing local substitutes for v6b/v6c.
- If dependency gate cannot complete, classify C/D as blocked or escalated. Do not silently collapse B/C/D into one local algorithm.

Acceptance:

- All v6 candidate method/source ids are accepted by the headless generation path and operation allowlists.
- Current default remains V2.6.
- Shared quality/fallback metadata is available for v6 candidates.
- Shared fixtures and deterministic contract tests are ready for backend domains.
- Dependency decision and due-diligence notes are recorded in the Domain A report.
- Typecheck and focused tests pass.

Forbidden:

- Algorithm implementation copied from V1-V5.
- Default switch.
- Editor UI work beyond what is necessary to keep type/contracts compiling.
- Dependency additions without dependency-policy compliance.

## 10. Domain B: `wave68-mesh-auto-outline-v6a-local-sidecar`

Purpose:

- Add a local/dependency-free v6 candidate for baseline comparison and fallback evidence.

Expected implementation areas:

- `packages/authoring-core/**`
- focused mesh generation tests

Implementation guidance:

- Implement from the v6 shared pipeline:
  - soft alpha mask
  - contour/boundary derivation
  - adaptive boundary simplification
  - adaptive interior sampling
  - local triangulation or honest fallback
  - deterministic cleanup / quality summary
- Keep v6a code isolated from old algorithms.
- Prefer simple, readable v0 behavior over broad pathological-mask claims.

Acceptance:

- `auto-outline-v6a-local` generates valid deterministic meshes on representative alpha fixtures.
- Empty/missing alpha returns explicit fallback/blocker metadata.
- Large Motion / Standard / Low Motion affect density in the expected direction.
- Quality metrics distinguish boundary/interior counts and fallback steps.
- Existing V2.6 default and V4 sidecar tests remain stable.

Forbidden:

- Old algorithm internals.
- Exact Cubism-like mesh claims.
- Full hole/multi-island support claim unless tested.

## 11. Domain C: `wave68-mesh-auto-outline-v6b-constrainautor-sidecar`

Purpose:

- Add the `delaunator + @kninnug/constrainautor` v6 backend for boundary-constraint comparison.

Expected implementation areas:

- `packages/authoring-core/**`
- package manifests / lockfile only if Domain A did not already centralize approved dependency addition
- focused mesh generation tests

Implementation guidance:

- Use v6b backend doc as the backend source of truth.
- Validate inputs before triangulation.
- Verify preserved constraints after triangulation.
- Treat missing constraints as backend failure or fallback.
- Record dependency and import behavior evidence in the report.

Acceptance:

- `auto-outline-v6b-constrainautor` is selectable headlessly and through operation payloads.
- Deterministic fixture runs pass.
- Simple and curved fixtures preserve required boundary constraints or visibly fallback.
- Backend diagnostics are exposed.
- Failures do not masquerade as successful constrained output.

Forbidden:

- Unconstrained Delaunay success label.
- Default switch.
- Old algorithm reference.

## 12. Domain D: `wave68-mesh-auto-outline-v6c-poly2tri-sidecar`

Purpose:

- Add the `poly2tri` v6 backend for constrained polygon + Steiner point comparison.

Expected implementation areas:

- `packages/authoring-core/**`
- package manifests / lockfile only if Domain A did not already centralize approved dependency addition
- focused mesh generation tests

Implementation guidance:

- Use v6c backend doc as the backend source of truth.
- Sanitize and validate polygon inputs before calling the library.
- Report hole and multi-island limitations explicitly.
- Treat triangulation throws or invalid polygon states as backend failure or fallback.
- Record dependency and import behavior evidence in the report.

Acceptance:

- `auto-outline-v6c-poly2tri` is selectable headlessly and through operation payloads.
- Deterministic fixture runs pass.
- Simple polygon + interior sample fixtures generate valid meshes.
- Hole or multi-island fixtures either pass with evidence or report visible limitations/fallback.
- Backend diagnostics are exposed.

Forbidden:

- Invalid polygon success label.
- Default switch.
- Old algorithm reference.

## 13. Domain E: `wave68-editor-temporary-v6-backend-selector-preview-provenance`

Purpose:

- Give the user a bounded temporary way to compare v6a/v6b/v6c in the existing Mesh Tool without turning backend selection into final product UX.

Expected implementation areas:

- `apps/editor/src/workspace/panels/mesh-tool-inspector.tsx`
- `apps/editor/src/features/editor-session/model/mesh-tool-state.ts`
- `apps/editor/src/features/editor-session/editor-session-context.tsx`
- editor command/model tests
- focused Playwright semantic test if stable

Implementation guidance:

- Keep `Large Motion` / `Standard` / `Low Motion` as the product-facing preset dimension.
- Add a clearly isolated experimental backend selector for v6 candidates.
- Keep current default flow on V2.6.
- Show method/source/fallback/quality summary in the existing Mesh Tool vocabulary.
- Preserve preview/apply semantics.
- Keep UI wiring easy to remove after final backend selection.

Acceptance:

- User can explicitly preview v6a/v6b/v6c for a selected Drawable.
- User can see whether the preview is successful backend output or fallback.
- Apply commits the previewed mesh and provenance correctly.
- V2.6 default remains unchanged when the experimental selector is not used.
- Existing PSD import / mesh generation / deformer creation semantic flow remains stable.

Forbidden:

- Permanent product framing for backend selector.
- Semantic auto-selection from drawable names or image content.
- Side-by-side comparison UI as mandatory work.
- Rendering/WebGL feature work.

## 14. Domain F: `wave68-final-integration-clean-review-map-closeout`

Purpose:

- Integrate A/B/C/D/E and decide whether Wave68 passes as a v6 candidate foundation wave.

Expected work:

- Confirm domain reports and review lanes exist for A/B/C/D/E.
- Confirm all v6 implementations use v6 docs as algorithm source and do not reuse old implementation internals.
- Confirm dependency additions, if any, comply with dependency policy and pass dependency checks.
- Confirm current default remains V2.6.
- Confirm v6 candidates are explicit sidecars and temporary selector is isolated.
- Confirm quality/fallback metadata distinguishes success from fallback.
- Confirm mesh generation tests do not overfit exact triangle layouts.
- Run final validation.
- Update maps and closeout reports.
- Run final clean integration Review-Sylph with cross-domain Spec Compliance summary.

Required checks:

- `pnpm typecheck`
- Focused authoring-core mesh generation tests from Domains A/B/C/D
- Focused operation-core generate mesh tests from Domain A
- Focused editor mesh tool state / command tests from Domain E
- Focused Playwright semantic flow for PSD import -> mesh preview/apply if stable and not visual-pixel based
- `node scripts/check-source-organization.mjs`
- `node scripts/check-dependencies.mjs`
- `git diff --check`

Expected artifacts:

- `discussion/implementation/waves/wave68/wave68-domain-a-v6-shared-contract-dependency-gate-method-surface-report.md`
- `discussion/implementation/waves/wave68/wave68-domain-b-mesh-auto-outline-v6a-local-sidecar-report.md`
- `discussion/implementation/waves/wave68/wave68-domain-c-mesh-auto-outline-v6b-constrainautor-sidecar-report.md`
- `discussion/implementation/waves/wave68/wave68-domain-d-mesh-auto-outline-v6c-poly2tri-sidecar-report.md`
- `discussion/implementation/waves/wave68/wave68-domain-e-editor-temporary-v6-backend-selector-preview-provenance-report.md`
- `discussion/implementation/waves/wave68/wave68-final-integration-report.md`
- `discussion/implementation/waves/wave68/_map.md`
- `discussion/implementation/reviews/wave68/_map.md`
- `discussion/implementation/reviews/wave68/wave68-final-clean-integration-review.md`

## 15. Orchestration Policy

This wave must follow `.github/skills/implementation-orchestration/SKILL.md`.

Root / Undine:

- Owns wave plan, dependency graph, user questions, and final decision.
- Must not implement the wave.
- Must preserve root context.
- Must wait for started subagents.

Orch-Sylph:

- Owns one domain loop.
- Must start with bounded current-state confirmation for its domain.
- Must delegate implementation to Gnome.
- Must delegate review to independent Review-Sylphs.
- Must include separate Spec Compliance Review lane.
- Must wait for Gnome and Review-Sylph completion.
- Must not cancel, close, or interrupt child agents because they are slow or waiting.
- Must close completed child agent sessions at the end of the domain to avoid zombie sessions.
- Must not close running child sessions.

Gnome:

- Receives domain-specific basis sections only.
- Implements within allowed scope.
- May modify `packages/**` when the domain explicitly allows it and accepted UX/architecture requires it.
- May add dependencies only through dependency policy compliance and escalation.
- Must include Basis Coverage Self-Report and Deferred Basis Items.
- Must explicitly state how it avoided using old mesh-generation algorithm internals.

Review-Sylph:

- Reviews from artifacts and source, not only from Gnome summary.
- Must produce assigned lane report.
- Spec Compliance Review must not silently treat basis omissions as future scope.
- Must check the v6 firebreak: old algorithms are not algorithm basis.

Waiting rule:

- `wait_agent` timeout is polling timeout, not failure.
- No parent agent may terminate a child agent's work merely because it has not responded yet.
- If interruption is unavoidable, record incomplete / blocked / escalated. Do not pass the wave gate.

## 16. Expected Persistent Artifacts

Reports:

- `discussion/implementation/waves/wave68/wave68-domain-a-v6-shared-contract-dependency-gate-method-surface-report.md`
- `discussion/implementation/waves/wave68/wave68-domain-b-mesh-auto-outline-v6a-local-sidecar-report.md`
- `discussion/implementation/waves/wave68/wave68-domain-c-mesh-auto-outline-v6b-constrainautor-sidecar-report.md`
- `discussion/implementation/waves/wave68/wave68-domain-d-mesh-auto-outline-v6c-poly2tri-sidecar-report.md`
- `discussion/implementation/waves/wave68/wave68-domain-e-editor-temporary-v6-backend-selector-preview-provenance-report.md`
- `discussion/implementation/waves/wave68/wave68-final-integration-report.md`
- `discussion/implementation/waves/wave68/_map.md`

Reviews:

- `discussion/implementation/reviews/wave68/wave68-domain-a-spec-compliance-review.md`
- `discussion/implementation/reviews/wave68/wave68-domain-a-design-development-review.md`
- `discussion/implementation/reviews/wave68/wave68-domain-a-test-adequacy-review.md`
- `discussion/implementation/reviews/wave68/wave68-domain-b-spec-compliance-review.md`
- `discussion/implementation/reviews/wave68/wave68-domain-b-design-development-review.md`
- `discussion/implementation/reviews/wave68/wave68-domain-b-test-adequacy-review.md`
- `discussion/implementation/reviews/wave68/wave68-domain-c-spec-compliance-review.md`
- `discussion/implementation/reviews/wave68/wave68-domain-c-design-development-review.md`
- `discussion/implementation/reviews/wave68/wave68-domain-c-test-adequacy-review.md`
- `discussion/implementation/reviews/wave68/wave68-domain-d-spec-compliance-review.md`
- `discussion/implementation/reviews/wave68/wave68-domain-d-design-development-review.md`
- `discussion/implementation/reviews/wave68/wave68-domain-d-test-adequacy-review.md`
- `discussion/implementation/reviews/wave68/wave68-domain-e-spec-compliance-review.md`
- `discussion/implementation/reviews/wave68/wave68-domain-e-design-development-review.md`
- `discussion/implementation/reviews/wave68/wave68-domain-e-test-adequacy-review.md`
- `discussion/implementation/reviews/wave68/wave68-final-clean-integration-review.md`
- `discussion/implementation/reviews/wave68/_map.md`

## 17. Out of Scope

- Switching Editor default mesh generation to v6.
- Choosing the final v6 backend.
- Removing or hiding the temporary backend selector after final selection.
- Permanent product UX that asks normal users to choose triangulation libraries.
- Semantic recognition from part name, drawable name, or image content.
- Automatic preset selection.
- Auto-rigging.
- Manual mesh vertex / edge / topology editing.
- Side-by-side visual diff UI as mandatory work.
- Screenshot / pixel-perfect visual oracle as required pass condition.
- WebGL renderer feature expansion.
- WebGL seam, antialiasing, mask edge, or texture padding fixes.
- Canvas2D sunset.
- Photoshop compositing parity.
- Full support for every pathological alpha mask in v0.
- Cubism SDK / `.moc3` / `.model3.json` compatibility.
- External HTTP / WebSocket / MCP transport.
- LLM provider integration.
- Repo-side semantic proposal generation / auto-fix.
