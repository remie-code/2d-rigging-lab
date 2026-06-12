# Wave 63 Plan: Deformer Management UX + Mesh Auto Outline v2

> Deformer管理UXをParameter / Keyform前に補完し、同時にMesh自動生成を `auto-outline-v2` へ進める実装計画。Wave63から、各実装domainに独立した `Spec Compliance Review` laneを必須化する。

## 1. 状態

- Status: Planned
- Target wave: Wave63
- Wave name: `deformer-management-mesh-auto-outline-v2`
- Primary objective:
  - Parameter / Keyformへ進む前に、Deformer Tree、Drawable Pool、Deformer Inspector、Rotation / Warp Deformer作成、binding / reparent / insertionの基礎UXを成立させる。
  - Wave62の `auto-outline-v1` で残った扇状集中、大きすぎるtriangle、grid由来の矩形感を減らす `auto-outline-v2` を導入する。
  - Review-Sylphがwave plan準拠だけでなくprimary basis docsとの仕様差分を明示的に追跡するよう、Spec Compliance Reviewを分離する。

## 2. Planning Gate Result

Planning Gate result before this plan: `Inventory first` -> `Plan directly`.

Inventory basis:

- [Deformer Management Inventory](../waves/wave63/wave63-preplan-deformer-management-inventory.md)
- [Mesh auto-outline-v2 Inventory](../waves/wave63/wave63-preplan-mesh-auto-outline-v2-inventory.md)
- [Spec Review Improvement Inventory](../waves/wave63/wave63-preplan-spec-review-improvement-inventory.md)

Why planning is now safe:

- Deformer UXの不足点は、package / operation / validator側が必要なものとEditor側だけで済むものに分解済みである。
- Mesh `auto-outline-v2` は、v1実装との差分とテスト境界が整理済みである。
- レビュー改善は、実装scopeではなくwave運用ルールとして組み込める。
- 残る判断はWave63計画内で保守的に固定できる。

Uncertainty:

- factual: low to medium。各Sylph inventoryで主要source / testsは確認済み。
- decision: low。次UXはDeformer管理補完 + Mesh v2品質改善で合意済み。
- cost of wrong plan: high。Deformer binding semanticsを誤るとParameter / Keyform以降が歪むため、package foundationを先行する。

## 3. Accepted Decisions / Oracles

- UXを真とする。Accepted UXを実現するために必要なら `packages/**` のformat / schema / operation / validator / fixture / testを修正してよい。
- Deformer TreeはParts Treeの代替ではない。Parts Treeは所属・描画順・構造、Deformer Treeはdeformer hierarchyとbindingを扱う。
- Deformer Tree内のDrawable rowはParts Tree実体ではなくbinding referenceである。
- Drawable PoolはDeformer Tree内の候補領域であり、折りたたみ可能、初期collapsedとする。
- PoolからDeformerへのDnDはParts所属・draw orderを変更せず、deformer bindingだけを変更する。
- Drawable選択時のRig Inspectorには `Create Rotation Deformer` と `Create Warp Deformer` の両方を出す。
- 既存Deformer配下のDrawableにCreateした場合、新Deformerは親DeformerとDrawableの間に挿入する。
- Deformer Inspectorでは、name、parent deformer、bound children summary、domain bounds、Transform divisions、Bezier divisions、opacity multiplierを扱う。
- Transform divisionsはcontrol point countとして表現する。cell countと混同しない。
- Static opacity multiplierは、parameter-driven Subtree Visibility / Opacityとは別の基本属性である。
- Mesh `auto-outline-v2` はsemantic recognitionではない。入力は明示選択Drawable、preset、RGBA alpha maskである。
- Meshの品質は自動metricと人間visual checkを分ける。pixel-perfect Cubism再現は非ゴールである。
- `Spec Compliance Review` はWave63から独立Review-Sylph laneとして必須にする。

## 4. Primary Basis

Common:

- [Implementation Orchestration Skill](../../../.github/skills/implementation-orchestration/SKILL.md)
- [UX-Backed Package Logic Authority](../../development_convention/ux-backed-package-logic-authority.md)
- [Source File Organization Policy](../../development_convention/source-file-organization-policy.md)
- [Dependency Policy](../../development_convention/dependency-policy.md)
- [Operation Policy](../../development_convention/operation-policy.md)
- [Schema and ID Conventions](../../development_convention/schema-and-id-conventions.md)

Deformer:

- [Rig Tool Component](../../design/screen-design/components/rig-tool.md)
- [Canvas / Preview Component](../../design/screen-design/components/canvas-preview.md)
- [Parts Tree Component](../../design/screen-design/components/parts-tree.md)
- [Parameter / Keyform Component](../../design/screen-design/components/parameter-keyform.md)
- [Wave63 Deformer Management Inventory](../waves/wave63/wave63-preplan-deformer-management-inventory.md)

Mesh:

- [Mesh Tool Component](../../design/screen-design/components/mesh-tool.md)
- [auto-outline-v2 Algorithm](../../design/mesh-generation/auto-outline-v2.md)
- [Wave63 Mesh v2 Inventory](../waves/wave63/wave63-preplan-mesh-auto-outline-v2-inventory.md)

Review process:

- [Wave63 Spec Review Improvement Inventory](../waves/wave63/wave63-preplan-spec-review-improvement-inventory.md)

## 5. Review Policy Upgrade

Wave63の各implementation domainは、従来の2lane reviewに加えて、独立した `Spec Compliance Review` を必須とする。

Required review lanes:

1. `Spec Compliance Review`
   - wave planだけでなく、指定されたprimary basis sectionsとの対応を見る。
   - 各basis requirementを `implemented` / `explicit non-goal` / `deferred by plan` / `unclear` / `not relevant` に分類する。
   - `unclear` はpassにしてはいけない。Undine decisionまたはneeds_fixにする。
2. `Design / Development Compliance Review`
   - architecture、module boundary、source organization、operation boundary、forbidden scopeを見る。
3. `Test Adequacy Review`
   - in-scope spec行に対応するunit / integration / e2e / manual visual check / N/A rationaleを見る。

Each Gnome report must include:

- Basis Coverage Self-Report
- Intentionally Deferred Basis Items
- User Workflow Trace
- Must-not Compliance Evidence
- Residual Risk Classification

Each Spec Compliance Review must include:

- Spec Compliance Coverage Matrix
- Plan-vs-Primary-Basis Delta
- Inspector / Panel Field Coverage when UI is touched
- Negative Compliance Check
- Residual Risk Classification

Final clean integration review must include:

- Cross-domain Plan-vs-Basis Delta summary
- Confirmation that deferred basis items are not hidden as pass evidence

## 6. Wave Strategy

Wave63 uses a dependency-aware 2+1+1 structure.

```text
Batch 1:
  Domain A: Deformer Package / Operation Management Foundation
  Domain B: Mesh auto-outline-v2 Algorithm Foundation

Batch 2:
  Domain C: Deformer Tree / Inspector Editor UX

Batch 3:
  Domain D: Final Integration / Clean Review / Map Closeout
```

理由:

- Domain A and B are independent.
- Domain C depends on Domain A's binding / update / insertion operations.
- Mesh v2 should not block Deformer UX unless shared Canvas overlay code conflicts.
- Review improvement is not a separate product domain; it is a gate applied to A/B/C/D.

## 7. UX Acceptance Criteria

### 7.1 Deformer Management UX

```text
Authoring Workspace
  -> select Drawable / Deformer
  -> activate Rig Tool
  -> create Rotation or Warp Deformer
  -> manage Deformer hierarchy
  -> use Drawable Pool to bind drawables
  -> edit committed Deformer fields
```

Required:

- Drawable選択時に `Create Rotation Deformer` と `Create Warp Deformer` が見える。
- Drawableが既存Deformer配下にboundされている場合、Createは既存親DeformerとDrawableの間に新Deformerを挿入する。
- Deformer TreeにDeformer hierarchyが表示される。
- Deformer Treeに折りたたみ可能な `Drawable Pool` / `Unbound Drawables` があり、初期collapsedである。
- Drawable PoolからDeformerへのDnDで、unbound DrawableをDeformerへbindできる。
- Bound Drawable referenceを別DeformerへDnDするとbinding先を変更できる。
- Deformer rowを別Deformer rowへDnDするとparent deformerを変更できる。
- これらのDnDはParts所属、Parts Tree order、draw orderを変更しない。
- Deformer Inspectorで、name、parent deformer、domain bounds、Transform control point count、Bezier divisions、opacity multiplierを編集できる。
- Bound childrenはInspectorではsummary表示とし、追加 / 移動はDeformer Tree / Drawable Poolで行う。
- Invalid drops are blocked: cycles, duplicate binding, missing target, illegal root state.
- Transform / Bezier divisions変更は、既存keyformと互換が壊れる場合にrejectまたはdisabledにする。Wave63では安全側として「keyformがある場合は変更不可」でよい。

### 7.2 Mesh auto-outline-v2

```text
Authoring Workspace
  -> select Drawable
  -> Mesh Tool
  -> choose preset
  -> preview auto-outline-v2 mesh
  -> Apply
```

Required:

- `auto-outline-v2` を新しい生成methodとして扱う。Editorの新規previewはv2を使う。
- fallback chainは `auto-outline-v2 -> auto-outline-v1 -> auto-grid-v1` とする。
- `auto-outline-v1` は互換fallbackとして残す。
- v2は少なくとも以下を含む。
  - deterministic quality metrics computation
  - curvature-aware boundary resampling
  - deterministic jittered / Poisson-like interior sampling
  - inset ring generation for Standard / Large Motion where feasible
  - triangle quality refinement with iteration cap
- Constrained triangulationはpreferredだが、Wave63で依存導入なしに安全実装できない場合は、boundary-strip / ordinary Delaunay fallbackを明示し、full constrained triangulationをclaimしない。
- Quality summary includes at least:
  - max edge length
  - max triangle area
  - min angle
  - max vertex valence
  - fallback reason if any
  - refinement iteration count
- Automated tests cover determinism, preset density ordering, alpha outside filtering, quality metrics, fallback.
- Human visual check remains separate from E2E and is not encoded as pixel oracle.

## 8. Domain Design

| Batch | Domain | Dependency | Purpose |
|---|---|---|---|
| 1 | A. Deformer Package / Operation Management Foundation | Wave62 package baseline | Binding move, reparent, insertion, committed update, opacity multiplier, validation |
| 1 | B. Mesh auto-outline-v2 Algorithm Foundation | Wave62 mesh v1 baseline | v2 algorithm, metrics, fallback, method contract |
| 2 | C. Deformer Tree / Inspector Editor UX | Domain A pass / handoff | Drawable Pool, DnD, Rotation/Warp create, insertion UX, committed inspector edits |
| 3 | D. Final Integration / Clean Review / Map Closeout | Domains A/B/C pass or explicit escalate | Verification, maps, final clean review with Spec Compliance summary |

## 9. Domain A: `wave63-deformer-package-operation-management-foundation`

Purpose:

- Deformer management UXをEditorだけで無理に実現せず、package / operation / validatorに必要な契約を先に作る。

Expected implementation areas:

- `packages/package-format/**`
- `packages/authoring-core/**`
- `packages/operation-core/**`
- `packages/validator-core/**`
- `packages/runtime-core/**` if opacity/runtime evaluation is affected
- `packages/ai-interface/**` if operation catalog/read surface is affected
- focused tests / fixtures

Required capabilities:

1. Binding move / rebind
   - Drawableを現在のDeformer parentから別Deformerへ移動できる。
   - Parts Tree所属・draw orderは変更しない。
   - dry-run / commit / modelDiffを持つ。

2. Deformer reparent
   - child Deformerを別parent Deformerへ移動できる。
   - cycle preventionを持つ。
   - missing target、duplicate child、illegal parentをrejectする。

3. Insertion-safe create
   - existing parent Deformerとbound child Drawable / child Deformerの間に、新しいRotation / Warp Deformerを挿入できる。
   - 既存bindingを安全に置き換える。

4. Committed Deformer update
   - name / displayName
   - parent deformer
   - domain bounds
   - Transform control point count
   - Bezier divisions
   - opacity multiplier
   - Bezier edit typeは初期固定またはreadonly互換でよい。

5. Static opacity multiplier
   - packageに保存できる。
   - validatorで範囲を検証できる。
   - runtime/editor projectionでdescendant drawable opacityへ反映できる。
   - parameter-driven subtree opacityとは別物として扱う。

6. Duplicate binding validation
   - 同一RigControl内のduplicate child。
   - 1 Drawableが複数Deformerへ同時にboundされる不正状態。
   - parent / child mismatch。

Keyform compatibility rule:

- Transform / Bezier divisions変更により既存keyform cardinalityが壊れる場合、Wave63では変更をrejectする。
- 自動migrationは非ゴール。

Acceptance:

- Focused operation tests prove dry-run / commit for rebind, reparent, insertion, update.
- Validator tests prove cycles, duplicate binding, invalid refs, opacity range, incompatible division/keyform cases.
- Existing Wave62 Warp Deformer create tests remain passing.
- Domain C receives a handoff note:
  - operation names / DTO shapes
  - read projection fields
  - rejected states / diagnostics
  - which fields Editor may edit

Forbidden:

- Editor UI implementation.
- Mesh algorithm changes.
- Parameter / Keyform authoring.
- Bezier runtime evaluation claim unless actually implemented.
- Cubism compatibility claim.

Expected report:

- Current-state delta from inventory.
- Chosen operation granularity.
- Domain C handoff contract note.
- Basis coverage self-report.
- Verification summary.
- Residual risks.

## 10. Domain B: `wave63-mesh-auto-outline-v2-algorithm-foundation`

Purpose:

- `auto-outline-v2` をheadless mesh generationとして成立させ、Editor previewの新規生成に使える状態へ進める。

Expected implementation areas:

- `packages/authoring-core/**`
- `packages/operation-core/**`
- `apps/editor/**` only if method selection / preview integration is needed
- focused tests / fixtures

Required capabilities:

1. Method identity
   - Add `auto-outline-v2` as explicit generation method.
   - Preserve `auto-outline-v1` and `auto-grid-v1` as fallback / compatibility.

2. Quality metrics
   - max edge length
   - max triangle area
   - min angle
   - max vertex valence
   - refinement iteration count
   - fallback reason

3. Boundary improvement
   - curvature-aware boundary resampling.
   - straight spans use fewer points, high-curvature features retain more points.

4. Interior improvement
   - deterministic jittered / Poisson-like interior sampling.
   - reduce axis-aligned grid impression.
   - minimum distance to boundary / inset ring / other samples.

5. Inset ring
   - Standard and Large Motion should produce at least one mask-clipped inset ring where feasible.
   - Large Motion may produce denser or additional ring.

6. Triangulation / refinement
   - Prefer constrained triangulation.
   - If no dependency is introduced, implement a clearly labeled interim path and do not claim full constrained triangulation.
   - Refine or warn on max edge / max area / min angle / max valence.
   - Iteration limit required.

7. Fallback
   - `auto-outline-v2 -> auto-outline-v1 -> auto-grid-v1`.
   - fallback reason must be observable in generation summary.

Acceptance:

- v2 output is deterministic.
- v2 reduces fan concentration / high valence compared with v1 on representative fixtures, measured by max valence or equivalent summary.
- v2 reduces oversized triangle metrics compared with v1 on representative fixtures, measured by max edge / max area.
- v2 avoids obvious axis-aligned grid regularity in its sampler by deterministic jitter / Poisson-like spacing.
- `Large Motion` remains denser than `Standard`, and `Standard` denser than `Low Motion`.
- Operation/editor preview uses v2 for new generation if Domain B touches editor integration.
- Existing preview -> Apply / Regenerate -> Apply remains intact.

Forbidden:

- Pixel-perfect / Cubism match oracle.
- Semantic preset inference.
- Full manual mesh editor.
- Multi-drawable batch generation.
- Deformer / Rig package changes.

Dependency note:

- Gnome may propose a triangulation dependency only under dependency policy.
- If dependency approval is needed, Orch-Sylph must escalate instead of silently adding broad external code.
- In absence of approval, implement bounded in-repo v2 improvements and explicitly defer full constrained triangulation.

Expected report:

- Algorithm changes.
- Quality metrics before/after summary.
- Fallback behavior.
- Basis coverage self-report.
- Verification summary.
- Human visual check recommendation, if needed.

## 11. Domain C: `wave63-deformer-tree-inspector-editor-ux`

Purpose:

- Domain Aのoperation contractを使って、Authoring WorkspaceにDeformer管理UXを実装する。

Dependencies:

- Domain A pass.
- Domain A handoff contract note.
- Domain B report if shared Canvas overlay files conflict.

Expected implementation areas:

- `apps/editor/**`
- focused editor tests / e2e
- no package contract changes except escalate-approved fix loops

Required UX:

1. Drawable selected Inspector
   - Show `Create Rotation Deformer`.
   - Show `Create Warp Deformer`.
   - Both use insertion semantics when the Drawable is already bound under a parent Deformer.

2. Deformer selected Inspector
   - Edit name.
   - Edit parent deformer.
   - Show bound children summary.
   - Edit / fit / reset domain bounds.
   - Edit Transform control point count.
   - Edit Bezier divisions.
   - Edit opacity multiplier.
   - Show Bezier edit type as readonly/fixed default unless Domain A supports editing it.
   - Disable or reject division edits when keyforms exist.

3. Deformer Tree / Drawable Pool
   - Deformer hierarchy remains primary.
   - Drawable Pool exists inside Deformer view.
   - Drawable Pool is collapsed by default.
   - Pool rows are visually secondary and clearly binding candidates.
   - Unbound means "not bound to a Deformer", not "not in Parts Tree".

4. DnD
   - Pool Drawable -> Deformer binds Drawable.
   - Bound Drawable reference -> another Deformer rebinds Drawable.
   - Deformer row -> another Deformer reparents Deformer.
   - Invalid drops show non-invasive feedback and do not mutate state.
   - Parts membership and draw order stay unchanged.

5. Canvas / Inspector state
   - Selecting Deformer shows committed overlay.
   - Editing committed fields updates projection after Apply / commit.
   - Draft / committed states remain distinct.

Acceptance:

- User can create Rotation Deformer and Warp Deformer from selected Drawable.
- User can create a new parent Deformer above selected Deformer.
- User can insert a new Deformer between parent Deformer and bound Drawable.
- User can open Deformer view, expand Drawable Pool, and bind an unbound Drawable.
- User can move a bound Drawable reference to another Deformer.
- User can reparent a Deformer.
- User can edit committed Deformer fields listed above.
- E2E covers at least one end-to-end path for create, pool bind, and committed inspector edit.
- Unit tests cover invalid drop / operation rejection mapping.

Forbidden:

- Package operation redesign without escalation.
- Mesh v2 algorithm changes.
- Parameter / Keyform authoring.
- Subtree opacity keyforms.
- Bezier control point manual editing.
- Full runtime Bezier evaluation claim.

Expected report:

- UX paths implemented.
- Domain A operation usage.
- Basis coverage self-report.
- Test / e2e summary.
- Deferred basis items.

## 12. Domain D: `wave63-final-integration-clean-review-map-closeout`

Purpose:

- Domains A/B/Cを統合し、Wave63としてpassできるかを確認する。

Expected work:

- Confirm reports and all three review lanes exist for A/B/C.
- Verify each Spec Compliance Review has:
  - coverage matrix
  - plan-vs-basis delta
  - residual classification
- Confirm Deformer package/editor boundary.
- Confirm Mesh v2 did not add forbidden pixel/Cubism oracle.
- Confirm Canvas overlay / toolbar state does not collide between Mesh and Rig/Deformer.
- Run final validation.
- Update maps and closeout reports.
- Run final clean integration Review-Sylph with cross-domain Spec Compliance summary.

Required checks:

- `pnpm typecheck`
- Focused tests from Domains A/B/C
- focused editor e2e if Domain C changes e2e path
- `node scripts/check-source-organization.mjs`
- `git diff --check`

Expected artifacts:

- `discussion/implementation/waves/wave63/wave63-domain-d-final-integration-closeout-report.md`
- `discussion/implementation/reviews/wave63/wave63-final-clean-integration-review.md`
- `discussion/implementation/waves/wave63/_map.md`
- `discussion/implementation/reviews/wave63/_map.md`

## 13. Orchestration Policy

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
- Must include the separate Spec Compliance Review lane.
- Must wait for Gnome and Review-Sylph completion.
- Must not cancel, close, or interrupt child agents because they are slow or waiting.

Gnome:

- Receives domain-specific basis sections only.
- Implements within allowed scope.
- May modify `packages/**` when the domain explicitly allows it and accepted UX requires it.
- Must include Basis Coverage Self-Report and Deferred Basis Items.

Review-Sylph:

- Reviews from artifacts and source, not only from Gnome summary.
- Must produce the assigned lane report.
- Spec Compliance Review must not silently treat basis omissions as future scope.

Waiting rule:

- `wait_agent` timeout is polling timeout, not failure.
- No parent agent may terminate a child agent's work merely because it has not responded yet.
- If interruption is unavoidable, record incomplete / blocked / escalated. Do not pass the wave gate.

## 14. Expected Persistent Artifacts

Reports:

- `discussion/implementation/waves/wave63/wave63-domain-a-deformer-package-operation-management-foundation-report.md`
- `discussion/implementation/waves/wave63/wave63-domain-b-mesh-auto-outline-v2-algorithm-foundation-report.md`
- `discussion/implementation/waves/wave63/wave63-domain-c-deformer-tree-inspector-editor-ux-report.md`
- `discussion/implementation/waves/wave63/wave63-domain-d-final-integration-closeout-report.md`
- `discussion/implementation/waves/wave63/_map.md`

Reviews:

- `discussion/implementation/reviews/wave63/wave63-domain-a-spec-compliance-review.md`
- `discussion/implementation/reviews/wave63/wave63-domain-a-design-development-review.md`
- `discussion/implementation/reviews/wave63/wave63-domain-a-test-adequacy-review.md`
- `discussion/implementation/reviews/wave63/wave63-domain-b-spec-compliance-review.md`
- `discussion/implementation/reviews/wave63/wave63-domain-b-design-development-review.md`
- `discussion/implementation/reviews/wave63/wave63-domain-b-test-adequacy-review.md`
- `discussion/implementation/reviews/wave63/wave63-domain-c-spec-compliance-review.md`
- `discussion/implementation/reviews/wave63/wave63-domain-c-design-development-review.md`
- `discussion/implementation/reviews/wave63/wave63-domain-c-test-adequacy-review.md`
- `discussion/implementation/reviews/wave63/wave63-final-clean-integration-review.md`
- `discussion/implementation/reviews/wave63/_map.md`

## 15. Out of Scope

- Parameter / Keyform authoring.
- Parameter Manager.
- Subtree opacity keyforms.
- Physics / dynamics.
- Save / load project UX expansion.
- Texture Atlas.
- Variant / Expression Manager.
- Viewer / Runtime dedicated view expansion.
- Manual mesh vertex editor expansion.
- Multi-drawable mesh batch generation.
- Full constrained triangulation claim if not actually implemented.
- Photoshop pixel-perfect compositing.
- Cubism SDK / `.moc3` / `.model3.json` compatibility.
- External HTTP / WebSocket / MCP transport.
- LLM provider integration.
- Repo-side semantic proposal generation / auto-rig / auto-fix.
