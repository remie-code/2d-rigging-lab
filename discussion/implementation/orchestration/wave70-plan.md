# Wave 70 Plan: Mesh Generation v6D Mainline Support Rings

> Wave69で最も有望だった `auto-outline-v6d-contour-constrainautor` を本命系列にし、Editorから一時的なアルゴリズム選択UIを外すwave。現行v6Dは比較可能な既存実装として残し、改良版は新ファイル・新method/source idとして追加する。v6G検討文書は設計basisとして使うが、実装上の公開系列名はv6D lineageへ戻す。

## 1. 状態

- Status: Planned / ready for orchestration
- Target wave: Wave70
- Wave name: `mesh-generation-v6d-mainline-support-rings`
- Primary objective:
  - Wave69 visual checkで強かったv6D系列を、次のmesh generation本命にする。
  - 現行v6D実装 `auto-outline-v6d-contour-constrainautor` は残す。
  - 改良v6Dを新しい実装ファイルとして追加する。
  - Editorの一時backend selectorを取り外し、通常ユーザーがmesh生成アルゴリズムを選ばないUXへ戻す。
  - Editorのmesh生成既定経路を改良v6D系列へ切り替える。

## 2. Planning Gate Result

Planning Gate result before this plan: `Plan directly`.

Why planning is now safe:

- Wave69は完了/passで、v6D/v6E/v6Fの比較状態と最終レビューが新しい。
- ユーザー判断が明確:
  - v6Dがかなり良い。
  - 新しいv6Dを本命にする。
  - Editor UIからアルゴリズム選択はできなくてよい。
  - メッシュ生成アルゴリズムはv6D系列に決め打つ。
  - 現行v6Dは残し、改良v6Dは新しいファイルで作る。
- 追加調査より実装計画へ進む方がよい。実装前の現状確認は各Domainのbounded confirmationで行う。

Uncertainty:

- factual: low-medium. Selector UI、default method、operation provenance、method registry、mesh bounds assumptionsはDomain A/Bで確認が必要。
- decision: low. 公開実装名はv6D系列に戻す。
- cost of wrong plan: medium. Default切り替えとselector除去を誤ると、Mesh Toolの既存preset UXやpreview/apply経路を壊す。

## 3. Accepted Decisions / Oracles

- UXとmesh-generation contractは真。Accepted UX may require `packages/**` changes.
- Root / Undine must not implement the wave. Implementation must be delegated through Orch-Sylph -> Gnome / Review-Sylph.
- Root / Undine and Orch-Sylph must wait for started subagents. Poll timeout is not failure.
- Running child agents must not be killed, interrupted, or closed. Completed child sessions must be closed by their parent.
- Current v6D remains:
  - Keep `auto-outline-v6d-contour-constrainautor`.
  - Keep the current implementation file as the old v6D baseline.
  - Do not rewrite or delete it while implementing the improved v6D path.
- Improved v6D is a new file and a new method/source id.
- Implementation should use v6D lineage naming, not `v6g`, even though the current design basis file is named `auto-outline-v6g-contour-band-support-rings.md`.
- Editor users should not choose between v6D/v6E/v6F or library backends.
- Product-facing presets remain the visible control dimension. Presets tune the chosen v6D lineage algorithm rather than exposing algorithms.
- v6E/v6F may remain headless historical/comparison methods unless removal is necessary for correctness, but they must not remain visible as normal Editor choices.
- Mesh rendering blur/triangle smear issue remains separately resolved by accepted `NEAREST` texture filtering. Wave70 must not expand into texture padding/dilation or renderer feature work.

## 4. Naming And Method IDs

Use v6D lineage names for the improved implementation:

```text
method id: auto-outline-v6d-contour-band-support-rings
source id: outline-v6d-contour-band-support-rings-rgba
implementation file: packages/authoring-core/src/mesh-generation-v6d-contour-band-support-rings.ts
```

Existing Wave69 v6D remains:

```text
method id: auto-outline-v6d-contour-constrainautor
source id: outline-v6d-contour-constrainautor-rgba
implementation file: packages/authoring-core/src/mesh-generation-v6d-contour-constrainautor.ts
```

Rationale:

- The user chose the new direction as "v6D系列" rather than a separate v6G line.
- The method id must still distinguish the old v6D baseline from the improved support-ring v6D.
- The existing v6G design document should be treated as the historical design basis and may be updated or cross-referenced, but implementation ids should not expose `v6g`.

## 5. Primary Basis

Common:

- [Implementation Orchestration Skill](../../../.agents/skills/implementation-orchestration/SKILL.md)
- [UX-Backed Package Logic Authority](../../development_convention/ux-backed-package-logic-authority.md)
- [Source File Organization Policy](../../development_convention/source-file-organization-policy.md)
- [Dependency Policy](../../development_convention/dependency-policy.md)
- [Operation Policy](../../development_convention/operation-policy.md)
- [Schema and ID Conventions](../../development_convention/schema-and-id-conventions.md)

Design / UX:

- [Mesh Generation Design Map](../../design/mesh-generation/_map.md)
- [auto-outline-v6G Contour Band Support Rings](../../design/mesh-generation/auto-outline-v6g-contour-band-support-rings.md)
- [auto-outline-v6D / v6E / v6F Contour-Salvage Triangulation](../../design/mesh-generation/auto-outline-v6d-v6e-v6f-contour-salvage-triangulation.md)
- [Mesh Tool Component](../../design/screen-design/components/mesh-tool.md)

Wave Baseline:

- [Wave69 Plan](wave69-plan.md)
- [Wave69 Domain E Final Integration Report](../waves/wave69/wave69-domain-e-editor-v6d-v6e-v6f-selector-final-integration-report.md)
- [Wave69 Final Clean Integration Review](../reviews/wave69/wave69-final-clean-integration-review.md)

## 6. Review Policy

Each implementation domain requires three review lanes unless explicitly N/A:

1. `Spec Compliance Review`
   - Checks this wave plan and primary basis docs.
   - Each relevant basis requirement must be classified as `implemented` / `explicit non-goal` / `deferred by plan` / `unclear` / `not relevant`.
   - `unclear` is not pass.
2. `Design / Development Compliance Review`
   - Checks architecture, module boundary, source organization, operation boundary, dependency policy, determinism, and forbidden scope.
3. `Test Adequacy Review`
   - Checks unit / integration / browser / e2e / manual visual-check coverage or N/A rationale for each in-scope requirement.

Each Gnome report must include:

- Basis Coverage Self-Report
- Intentionally Deferred Basis Items
- Mesh Generation Contract Trace
- Must-not Compliance Evidence
- Residual Risk Classification

Each Orch-Sylph must close completed child sessions at domain completion. Running child sessions must not be closed, interrupted, or killed.

## 7. Wave Strategy

Wave70 uses a 3-domain structure to keep orchestration overhead low while preserving clean review gates.

```text
Batch 1:
  Domain A: Improved v6D Support-Ring Backend / Method Contract

Batch 2:
  Domain B: Editor v6D Mainline Default / Selector Removal

Batch 3:
  Domain C: Final Integration / Clean Review / Map Closeout
```

Dependency graph:

```text
A defines the improved v6D method/source id, new implementation file, registry route, diagnostics, tests, and old-v6D preservation proof
B depends on A and removes the visible algorithm selector while routing Editor preview/apply defaults to improved v6D
C depends on A/B pass or explicit escalation
```

Rationale:

- The risky geometry work and method contract should be completed before Editor hard-defaulting depends on it.
- Selector removal should be one coherent Editor pass, not split across several partial UI domains.
- Final integration needs a clean review because the wave changes default behavior and removes temporary exploration UX.

## 8. Acceptance Criteria

### 8.1 Improved v6D Backend

```text
soft alpha mask
-> main component selection
-> boundary loop trace
-> arclength alpha boundary sampling
-> outer support ring
-> alpha boundary support ring
-> inner support ring
-> interior / Steiner points
-> Delaunator
-> Constrainautor
-> ring constraint verification
-> support-band-aware triangle filtering
```

Required:

- Add `auto-outline-v6d-contour-band-support-rings`.
- Add `outline-v6d-contour-band-support-rings-rgba`.
- Implement it in a new file.
- Keep the current `mesh-generation-v6d-contour-constrainautor.ts` behavior available and test-covered.
- Reuse the shared v6 contour pipeline where appropriate.
- Keep the current v6D strengths:
  - soft alpha mask;
  - main component selection;
  - boundary loop trace;
  - outer loop selection;
  - arclength boundary sampling;
  - constrained triangulation.
- Add at least:
  - one outer support ring;
  - one alpha boundary ring;
  - one inner support ring when geometrically safe.
- Preset tuning must affect ring offsets and/or density:
  - Large Motion: larger support offsets and deformation margin.
  - Standard: medium support offsets.
  - Low Motion: smaller support offsets and lower density.
- Mesh vertex positions may extend outside the source layer rectangle.
- Texture UVs must remain valid and deterministic.
- Outer-ring UV policy must be explicit:
  - project to corresponding alpha-boundary UV, or
  - clamp to valid texture coordinates.
- Triangle filtering must not delete triangles merely because their centroid is outside the alpha mask.
- Diagnostics must include:
  - boundary ring point count;
  - outer ring point count;
  - inner ring point count;
  - skipped/merged ring points;
  - preserved/missing constraint counts;
  - support-band triangle count;
  - interior triangle count;
  - whether vertices extend outside layer bounds;
  - max outside-layer distance.
- Invalid or self-intersecting ring geometry must return structured fallback/diagnostics rather than misleading success.

Must not:

- Use `v6g` in public method/source ids.
- Mutate the old v6D file as the implementation path for the improved candidate.
- Delete old v6D, v6E, or v6F.
- Reuse v6A ear clipping / fan fallback / row-major interior placement.
- Add new dependencies unless dependency-policy compliant and escalated.
- Expand into renderer texture padding/dilation.

### 8.2 Editor Mainline UX

Required:

- Remove or hide the visible backend algorithm selector from Mesh Tool.
- Keep product-facing presets visible.
- Mesh preview/apply should use improved v6D by default.
- Existing preview -> Apply semantics must remain:
  - Preview does not mutate committed mesh.
  - Apply commits the previewed mesh and provenance.
- Provenance may remain in operation data and tests.
- User-facing UI should not frame v6D/v6E/v6F as a normal choice.
- Existing mesh summary may show counts and quality/fallback status, but should avoid making algorithm/library choice the visible primary UX.
- Historical meshes generated by old methods should still display safely if their provenance is present.

Must not:

- Replace the selector with another algorithm-choice UI.
- Auto-select algorithms from part names, drawable names, or semantic image recognition.
- Claim side-by-side comparison UX as mandatory scope.
- Reopen WebGL rendering quality work.

### 8.3 Default / Contract Alignment

Required:

- Editor mesh generation default becomes `auto-outline-v6d-contour-band-support-rings`.
- Command/default paths used by Editor preview/apply must not silently fall back to V2.6.
- V2.6 remains callable as an older method unless removal is explicitly required by tests or contract cleanup.
- Operation provenance must distinguish:
  - improved v6D backend output;
  - fallback output;
  - blocked output.
- Tests must prove the visible Editor options do not expose v6D/v6E/v6F backend selection.

## 9. Domain Design

| Batch | Domain | Dependency | Purpose |
|---|---|---|---|
| 1 | A. Improved v6D Support-Ring Backend / Method Contract | Wave69 + v6D support-ring design basis | New file, new method/source id, support rings, diagnostics, registry/route, tests, old-v6D preservation |
| 2 | B. Editor v6D Mainline Default / Selector Removal | A pass | Remove visible algorithm selector, route preview/apply defaults to improved v6D, preserve preset UX and provenance |
| 3 | C. Final Integration / Clean Review / Map Closeout | A/B pass or explicit escalation | Full validation, independent clean review, reports/maps |

## 10. Domain A: `wave70-v6d-support-rings-backend-method-contract`

Purpose:

- Add improved v6D support-ring mesh generation as a new method/source/file while preserving current v6D.

Expected implementation areas:

- `packages/authoring-core/src/mesh-generation-v6d-contour-band-support-rings.ts`
- `packages/authoring-core/src/mesh-generation-v6-contour-pipeline.ts` only for shared support-ring helpers or exported data needed by the new method
- `packages/authoring-core/src/mesh-generation-contract.ts`
- `packages/authoring-core/src/mesh-generation.ts`
- `packages/authoring-core/src/mesh-generation.test.ts`
- `packages/operation-core/**` only if method/provenance contract requires it
- focused authoring-core / operation-core tests

Implementation guidance:

- Treat `auto-outline-v6g-contour-band-support-rings.md` as design basis, but implement as v6D lineage.
- Current v6D may be read as baseline behavior and comparison oracle, but should not be rewritten.
- Prefer adding local support-ring helpers in the new file or shared v6 contour helpers over modifying old v6D.
- Start with robust deterministic geometry over maximal sophistication.
- If inner-ring offset self-intersects in narrow features, skip/merge/project those points and report diagnostics.
- If layer-bounds-outside vertices break DTO/schema assumptions, escalate with exact paths and proposed contract change instead of silently clipping them back to layer bounds.

Acceptance:

- New method/source id exists and is routed.
- New file implements improved v6D support-ring path.
- Old v6D remains callable and deterministic.
- New method produces valid deterministic mesh DTOs for representative fixtures.
- At least one fixture or property test proves outer/inner ring diagnostics are present.
- At least one test proves vertices may extend outside layer bounds while UVs remain valid.
- At least one test proves triangle filtering allows support-band triangles outside the alpha mask.
- Quality/fallback metadata distinguishes backend output from fallback/blocked output.
- No new dependency is added.

Forbidden:

- Editor UI work.
- Deleting or rewriting current v6D.
- Using `v6g` ids.
- v6A discarded triangulation.
- Renderer work.

## 11. Domain B: `wave70-editor-v6d-mainline-selector-removal`

Purpose:

- Remove the temporary algorithm selector from Editor and route the normal Mesh Tool generation path to improved v6D.

Expected implementation areas:

- `apps/editor/src/features/editor-session/model/mesh-tool-state.ts`
- `apps/editor/src/features/editor-session/model/mesh-tool-state.test.ts`
- `apps/editor/src/features/editor-session/model/editor-session-commands.ts`
- `apps/editor/src/features/editor-session/model/editor-session-commands.test.ts`
- `apps/editor/src/features/editor-session/editor-session-context.tsx` only if preview/apply routing requires it
- `apps/editor/src/workspace/panels/mesh-tool-inspector.tsx`
- `apps/editor/e2e/psd-import.e2e.spec.ts` focused semantic assertions if stable

Implementation guidance:

- Keep preset selection as the product-facing control.
- Remove/hide the backend selector control rather than relabeling it.
- If an internal option list remains for tests or provenance, it must not be rendered as a normal user control.
- User-facing labels should emphasize mesh quality/count/fallback, not algorithm/library choice.
- Preserve historical provenance formatting enough that old v6D/v6E/v6F preview data does not crash or render nonsense.

Acceptance:

- Mesh Tool has no visible backend algorithm selector.
- Preset control still works.
- Mesh preview default method is `auto-outline-v6d-contour-band-support-rings`.
- Apply commits previewed improved-v6D mesh and provenance.
- Tests assert v6D/v6E/v6F backend choices are no longer visible selector options.
- Focused PSD import -> mesh preview/apply semantic path still passes if stable.
- Existing v6D/v6E/v6F formatter/display paths either remain safe for historical data or are explicitly removed with tests.

Forbidden:

- Reintroducing a comparison selector under another name.
- Removing presets.
- Side-by-side algorithm comparison UX.
- Semantic auto-selection.
- Renderer changes.

## 12. Domain C: `wave70-final-integration-clean-review-map-closeout`

Purpose:

- Validate the wave end-to-end, record reports/reviews, and update maps.

Expected implementation areas:

- `discussion/implementation/waves/wave70/**`
- `discussion/implementation/reviews/wave70/**`
- `discussion/implementation/_map.md`
- `discussion/implementation/orchestration/_map.md`
- `discussion/design/mesh-generation/_map.md` only if final status wording needs alignment
- final validation commands

Acceptance:

- Domain A and B implementation reports exist.
- Domain A and B Spec / Design-Development / Test Adequacy reviews exist and pass, or explicit escalation is recorded.
- Final clean integration review exists and passes.
- Final report records:
  - improved v6D method/source id;
  - current v6D preservation proof;
  - selector removal proof;
  - default routing proof;
  - validation results;
  - residual visual-quality risks.
- Maps mark Wave70 status correctly.
- Accepted `NEAREST` texture filtering state is not reverted.

Forbidden:

- Source implementation except narrow documentation/map fixes.
- Closing the wave without independent clean review.
- Treating missing child-agent responses as pass.

Required checks:

- `pnpm typecheck`
- Focused authoring-core mesh generation tests for old v6D and improved v6D
- Focused operation-core generate mesh tests if operation contract/provenance changes
- Focused editor mesh tool state / command tests
- Focused Playwright semantic PSD import -> mesh preview/apply test if stable
- `node scripts/check-source-organization.mjs`
- `node scripts/check-dependencies.mjs`
- `git diff --check`

## 13. Verification Matrix

| Requirement | Minimum evidence |
|---|---|
| Improved v6D exists as new file | Source file and route/registry tests |
| Old v6D preserved | Old method callable test and no behavior rewrite evidence |
| v6D lineage naming | Method/source ids use `v6d`, not `v6g` |
| Support rings | Diagnostics and geometry tests for outer/inner/alpha rings |
| Layer bounds not hard clipping | Test with outside-layer vertex positions and valid UVs |
| Selector removed | Editor unit/e2e assertion that backend selector is not visible |
| Default is improved v6D | Editor command/state tests and operation provenance |
| Presets remain | Editor test or semantic e2e |
| Preview/apply preserved | Editor command test and focused PSD e2e if stable |
| No renderer expansion | Diff/review check over `packages/render-webgl2/**` |

## 14. Expected Persistent Artifacts

Reports:

- `discussion/implementation/waves/wave70/wave70-domain-a-v6d-support-rings-backend-method-contract-report.md`
- `discussion/implementation/waves/wave70/wave70-domain-b-editor-v6d-mainline-selector-removal-report.md`
- `discussion/implementation/waves/wave70/wave70-final-integration-report.md`
- `discussion/implementation/waves/wave70/_map.md`

Reviews:

- `discussion/implementation/reviews/wave70/wave70-domain-a-spec-compliance-review.md`
- `discussion/implementation/reviews/wave70/wave70-domain-a-design-development-review.md`
- `discussion/implementation/reviews/wave70/wave70-domain-a-test-adequacy-review.md`
- `discussion/implementation/reviews/wave70/wave70-domain-b-spec-compliance-review.md`
- `discussion/implementation/reviews/wave70/wave70-domain-b-design-development-review.md`
- `discussion/implementation/reviews/wave70/wave70-domain-b-test-adequacy-review.md`
- `discussion/implementation/reviews/wave70/wave70-final-clean-integration-review.md`
- `discussion/implementation/reviews/wave70/_map.md`

## 15. Orchestration Policy

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
- Must explicitly state how it preserved current v6D and avoided v6A discarded triangulation.

Review-Sylph:

- Reviews from artifacts and source, not only from Gnome summary.
- Must produce assigned lane report.
- Spec Compliance Review must not silently treat basis omissions as future scope.
- Must check old-v6D preservation, v6D lineage naming, selector removal, and default routing.

Waiting rule:

- `wait_agent` timeout is polling timeout, not failure.
- No parent agent may terminate a child agent's work merely because it has not responded yet.
- If interruption is unavoidable, record incomplete / blocked / escalated. Do not pass the wave gate.

## 16. Out of Scope

- Keeping algorithm selection as a normal Editor UX.
- Side-by-side visual diff UI.
- Further v6E/v6F algorithm development.
- Deleting old v6D/v6E/v6F methods.
- Texture padding/dilation.
- Further renderer/WebGL feature expansion.
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
