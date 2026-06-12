# Wave 64 Plan: Parameter / Keyform Editing Loop v0 + Mesh V3 Envelope Sidecar

> Parameterで「動く」体験を初めて成立させる実装計画。Parameter / Keyformを主軸にしつつ、独立性が高いMesh `auto-outline-v3-envelope` をsidecar domainとして並列投入する。

## 1. 状態

- Status: Planned
- Target wave: Wave64
- Wave name: `parameter-keyform-loop-v0-mesh-v3-envelope-sidecar`
- Primary objective:
  - Parameter Bar、parameter-aware Inspector、keyform Add / Update / Delete / Ends / Ends+Center、runtime/canvas evaluationを接続し、選択対象をparameterで動かす最初の編集ループを成立させる。
  - Parameter Manager v0を、常設Preset parameter table + Custom parameter管理として実装する。
  - Mesh `auto-outline-v3-envelope` を、Parameter本流と衝突しないheadless sidecarとして実装する。

## 2. Planning Gate Result

Planning Gate result before this plan: `Inventory first` -> `Plan directly`.

Inventory basis:

- [Parameter Package Inventory](../waves/wave64/wave64-preplan-parameter-package-inventory.md)
- [Editor Parameter UX Inventory](../waves/wave64/wave64-preplan-editor-parameter-ux-inventory.md)
- [Mesh V3 Envelope Inventory](../waves/wave64/wave64-preplan-mesh-v3-envelope-inventory.md)

Why planning is now safe:

- packages側は、Parameter定義保存と既存keyform/runtime samplingがある一方、Add / Update / Delete loopとvalidatorが不足していることが判明済み。
- editor側は、Parameter Barがplaceholder、Parameter Manager screen shellなし、Inspector / Deformer Tree / overlay基盤は利用可能であることが判明済み。
- Mesh V3はheadless + explicit methodならParameter workと衝突が小さい。

Uncertainty:

- factual: low to medium。主要source / testsは棚卸済み。
- decision: low。Parameter / Keyform UX、Parameter Manager UX、Mesh V3方針は合意済み。
- cost of wrong plan: high。Parameter/keyform contractを誤ると後続のruntime/capture/facadeが歪むため、packages foundationを先行する。

## 3. Accepted Decisions / Oracles

- UXを真とする。Accepted UXを実現するために必要なら `packages/**` のformat / schema / operation / validator / runtime / fixture / testを修正してよい。
- Parameter Barは1つのactive parameterを横長1行で扱う。全parameter sliderを常時並べない。
- Keyform専用Inspectorは作らない。選択中Drawable / Deformer / Tool Inspectorをparameter-awareにする。
- keyform位置以外では補間値を表示し、property編集はlockする。許可する操作は `Add Keyform Here`。
- v0のkeyform対象は次に絞る。
  - Drawable: opacity
  - Warp Deformer: lattice / control point positions、opacity multiplier
  - Rotation Deformer: rotation angle、opacity multiplier
  - Parts Container、Mesh、Parameter definition自体、visibility、clipping、draw order、mesh topologyは対象外。
- Parameter presetは常設catalogとして扱う。Preset parameterは初期状態からParameter Tableに全表示し、個別に `From Preset` 追加するUXは置かない。
- Preset parameterはrole / group / range / sign convention locked、削除不可。未使用Presetはwarningにしない。
- Custom parameterはroleなしで、作成・編集・削除可能。
- Parameter TableにはRole列を出さない。Name / Kind / Range / Usedを主表示にし、role / stable idはDetailsで見る。
- Mesh V3はalpha輪郭をなぞるのではなく、透明領域を少し含む外側包絡 `envelope boundary` で包む。
- Mesh V3はCubism再現ではない。人間visual checkは必要だが、pixel oracle / screenshot oracleは置かない。

## 4. Primary Basis

Common:

- [Implementation Orchestration Skill](../../../.github/skills/implementation-orchestration/SKILL.md)
- [UX-Backed Package Logic Authority](../../development_convention/ux-backed-package-logic-authority.md)
- [Source File Organization Policy](../../development_convention/source-file-organization-policy.md)
- [Dependency Policy](../../development_convention/dependency-policy.md)
- [Operation Policy](../../development_convention/operation-policy.md)
- [Schema and ID Conventions](../../development_convention/schema-and-id-conventions.md)

Parameter / Keyform:

- [Parameter / Keyform Component](../../design/screen-design/components/parameter-keyform.md)
- [Parameter Manager Screen](../../design/screen-design/screens/parameter-manager.md)
- [Parameter Preset Ecosystem](../../design/parameter-preset-ecosystem.md)
- [Rig Tool Component](../../design/screen-design/components/rig-tool.md)
- [Canvas / Preview Component](../../design/screen-design/components/canvas-preview.md)
- [Wave64 Parameter Package Inventory](../waves/wave64/wave64-preplan-parameter-package-inventory.md)
- [Wave64 Editor Parameter UX Inventory](../waves/wave64/wave64-preplan-editor-parameter-ux-inventory.md)

Mesh:

- [Mesh Tool Component](../../design/screen-design/components/mesh-tool.md)
- [auto-outline-v3 Envelope Algorithm](../../design/mesh-generation/auto-outline-v3-envelope.md)
- [auto-outline-v2 Algorithm](../../design/mesh-generation/auto-outline-v2.md)
- [Wave64 Mesh V3 Inventory](../waves/wave64/wave64-preplan-mesh-v3-envelope-inventory.md)

## 5. Review Policy

Wave64もWave63と同じく、各implementation domainに3 review lanesを必須とする。

1. `Spec Compliance Review`
   - wave planだけでなくprimary basis docsとの対応を見る。
   - 各basis requirementを `implemented` / `explicit non-goal` / `deferred by plan` / `unclear` / `not relevant` に分類する。
   - `unclear` はpassにしてはいけない。
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

Each Orch-Sylph must close completed child sessions at domain completion. Running child sessions must not be closed, interrupted, or killed.

## 6. Wave Strategy

Wave64 uses a dependency-aware 2 + 2 + 1 structure.

```text
Batch 1:
  Domain A: Parameter / Keyform Package Operation Foundation
  Domain C: Mesh auto-outline-v3-envelope Headless Sidecar

Batch 2:
  Domain B: Parameter Bar + Parameter-aware Inspector Editing Loop
  Domain D: Parameter Manager v0

Batch 3:
  Domain E: Final Integration / Clean Review / Map Closeout
```

Dependency graph:

```text
A -> B
A -> D
C independent
B <-> D: thin shared editor state / navigation contract only
E depends on A/B/C/D pass or explicit escalation
```

理由:

- Domain Aがkeyform operation contractを整えないと、B/Dは正しくcommitできない。
- Domain BとDはA後なら独立度が高い。Bはediting loop、Dはmanager screenであり、shared contractはactive parameter / parameter list / navigation程度。
- Domain Cはheadless mesh methodならParameter workとほぼ衝突しない。

## 7. UX Acceptance Criteria

### 7.1 Parameter / Keyform Editing Loop

```text
Authoring Workspace
  -> select Drawable / Warp Deformer / Rotation Deformer
  -> choose active parameter in Parameter Bar
  -> scrub current value
  -> add keyform
  -> edit selected target property
  -> update / delete / add preset keyforms
  -> scrub to preview evaluated result
```

Required:

- Parameter Barでactive parameterを選べる。
- current value slider / numeric valueを操作できる。
- key markerを表示できる。
- active parameterだけをResetできる。
- Add / Update / Delete current keyformができる。
- Ends / Ends + Centerを作れる。
- keyform位置以外では、Inspectorは補間値を表示しつつ編集lockし、`Add Keyform Here` を出す。
- keyform位置では、対象propertyを編集してUpdateできる。
- Runtime / Canvas previewがcurrent valueの評価結果を反映する。

Target-specific:

- Drawable: opacity keyform。
- Warp Deformer: lattice / control point positions keyform、opacity multiplier keyform。
- Rotation Deformer: rotation angle keyform、opacity multiplier keyform。
- Parts Container / Mesh / visibility / clipping / draw orderはkeyform対象にしない。

### 7.2 Parameter Manager v0

```text
Parameter Bar / App Bar
  -> Parameter Manager
  -> view always-present Preset parameters
  -> create / edit Custom parameter
  -> set active parameter
  -> view usage summary
```

Required:

- Preset parameterは初期状態からTableに全表示される。
- `+ From Preset` は置かない。
- Table primary columns: Name / Kind / Range / Used。
- Role列は出さない。
- Detailsでrole / stable id / group / range / sign convention summaryを見られる。
- Presetはlocked、削除不可、未使用でもwarningなし。
- Customはroleなし、作成・編集・削除可能。
- 上部group label filterを置く。左Group treeは置かない。
- Usageはsummary + detailsで見られる。
- warning / errorはCheck Stripでsummary表示する。

### 7.3 Mesh V3 Envelope

```text
Mesh Tool
  -> select Drawable
  -> choose explicit auto-outline-v3-envelope method / preset
  -> preview
  -> Apply
```

Required:

- `auto-outline-v3-envelope` を明示methodとして追加する。
- V2より粗めで、外側包絡envelope boundaryを使う。
- alpha外triangleを完全排除せず、envelope内の透明領域は許容する。
- envelope外triangleは除外する。
- V2 / existing fallbackへ戻れる。
- quality summaryにV3固有情報を残す。
- editor defaultをいきなりV3へ切り替える必要はない。明示method / preview可能性を優先する。

## 8. Domain Design

| Batch | Domain | Dependency | Purpose |
|---|---|---|---|
| 1 | A. Parameter / Keyform Package Operation Foundation | Wave63 package baseline | Add / Update / Delete loop、Ends、Ends+Center、preset locked parameter surface、validation、runtime gaps |
| 1 | C. Mesh auto-outline-v3-envelope Headless Sidecar | Wave63 Mesh v2 baseline | V3 envelope algorithm, explicit method, metrics, fallback |
| 2 | B. Parameter Bar + Parameter-aware Inspector Editing Loop | Domain A pass / handoff | Active parameter, current value, key markers, target-specific keyform editing |
| 2 | D. Parameter Manager v0 | Domain A pass / handoff | Always-present preset table, custom parameters, details, usage, check strip |
| 3 | E. Final Integration / Clean Review / Map Closeout | A/B/C/D pass or explicit escalation | Validation, cross-domain review, maps |

## 9. Domain A: `wave64-parameter-keyform-package-operation-foundation`

Purpose:

- EditorがKeyform Editing LoopをGUIだけで抱え込まないよう、package / operation / runtime / validator contractを先に整える。

Expected implementation areas:

- `packages/package-format/**`
- `packages/authoring-core/**`
- `packages/operation-core/**`
- `packages/runtime-core/**`
- `packages/validator-core/**`
- `packages/ai-interface/**` if operation catalog/read surface is affected
- focused tests / fixtures

Required capabilities:

1. Parameter definition operations
   - update Custom parameter
   - delete Custom parameter when safe
   - reject deletion / mutation of locked Preset parameter fields
   - expose always-present preset parameter catalog / initialized surface

2. Keyform set mutation operations
   - add keyform at current value
   - update existing keyform at current value
   - delete keyform at current value
   - create Ends keyforms
   - create Ends + Center keyforms
   - reject incompatible target/property/value shapes

3. Target property support
   - Drawable opacity
   - Warp Deformer control point offsets / lattice state
   - Warp Deformer opacity multiplier
   - Rotation Deformer angle
   - Rotation Deformer opacity multiplier

4. Runtime / evaluation
   - evaluate current parameter value for in-scope target properties
   - preserve existing linear 1D / grid 2D behavior
   - add missing Deformer opacity multiplier keyform evaluation if needed

5. Validation
   - duplicate parameter id
   - missing parameter refs
   - out-of-range keyform positions
   - keyform target missing
   - unsupported keyform property
   - preset locked mutation

Acceptance:

- Focused package tests cover add/update/delete keyform loop.
- Ends and Ends+Center produce expected key positions.
- Runtime sampling proves Drawable opacity, Rotation angle, Warp control point offsets, and deformer opacity multiplier where in scope.
- Validator tests prove key missing refs / out-of-range / duplicate ids / preset locked rejects.
- Domain B/D receive a handoff note:
  - operation names / DTOs
  - read projection fields
  - rejected states / diagnostics
  - preset catalog initialization behavior

Forbidden:

- Editor UI implementation.
- Camera Capture Facade implementation.
- Full Parameter Manager UI.
- Mesh V3 changes.
- Visibility/clipping/draw order keyforms.
- Semantic auto assignment.

## 10. Domain B: `wave64-editor-parameter-keyform-editing-loop`

Purpose:

- Domain A contractを使い、Authoring Workspace上でparameterを動かしてkeyformを打つ編集ループを成立させる。

Dependencies:

- Domain A pass and handoff.

Expected implementation areas:

- `apps/editor/**`
- focused editor unit tests / e2e

Required UX:

1. Parameter Bar
   - active parameter selector
   - current value slider / numeric display
   - key markers
   - Add / Update / Delete
   - Ends / Ends + Center
   - Reset active parameter
   - Manage button route to Parameter Manager

2. Parameter-aware Inspector
   - shows active parameter / current value / keyform exists
   - keyform position: enables target property editing and update
   - non-keyform position: shows interpolated values, disables property edit, shows `Add Keyform Here`
   - maps package rejections to concise UI feedback

3. Target editing
   - Drawable opacity
   - Warp Deformer lattice / control point positions
   - Warp Deformer opacity multiplier
   - Rotation Deformer angle
   - Rotation Deformer opacity multiplier

4. Canvas / preview
   - current parameter value affects evaluated preview
   - existing deformer overlays remain coherent
   - direct canvas editing for warp/rotation can be minimal if Inspector controls provide the editing loop; do not overclaim direct manipulation if not implemented

Acceptance:

- User can select an active parameter and scrub value.
- User can add a keyform for a selected in-scope target.
- User can update and delete the keyform.
- User can create Ends and Ends+Center.
- User sees locked inspector state between keyframes.
- User can preview evaluated result by scrubbing.
- Focused tests cover state/command behavior.
- At least one focused Playwright path proves the end-to-end loop for one representative target.

Forbidden:

- Parameter Manager full implementation beyond route/link integration.
- Package operation redesign without escalation.
- Mesh V3 algorithm.
- Camera Capture Facade.
- visibility/clipping/draw order keyforms.
- claiming canvas direct manipulation where only Inspector editing exists.

## 11. Domain C: `wave64-mesh-auto-outline-v3-envelope-sidecar`

Purpose:

- Mesh V3 envelope algorithmをheadless + explicit methodとして実装し、Parameter workと独立に改善を進める。

Expected implementation areas:

- `packages/authoring-core/**`
- `packages/operation-core/**`
- `packages/package-format/**` if method metadata/schema is needed
- `packages/validator-core/**` if generation summary validation is needed
- `apps/editor/**` only for explicit method selection / preview integration if low-conflict
- focused tests / fixtures

Required capabilities:

- Add explicit method `auto-outline-v3-envelope`.
- Reuse or extract V2 helpers where appropriate.
- Contour simplification.
- Outward envelope generation.
- self-intersection cleanup or conservative fallback.
- envelope resampling.
- optional support ring.
- coarser deterministic interior sampling.
- envelope-based triangle filtering.
- quality metrics / provenance for V3.
- fallback to V2 / existing fallback with reason.

Acceptance:

- V3 output is deterministic.
- V3 has fewer or not-greater vertices/triangles than V2 on representative fixtures unless justified by fallback.
- V3 allows transparent pixels inside envelope but rejects envelope-outside triangles.
- V3 summary records envelope/fallback/provenance.
- Existing V2 tests remain passing.
- No screenshot/pixel oracle is introduced.

Forbidden:

- Parameter / Keyform work.
- Defaulting all editor generation to V3 unless explicitly scoped and reviewed.
- Cubism reproduction claim.
- Broad geometry dependency without dependency policy compliance / escalation.

## 12. Domain D: `wave64-parameter-manager-v0`

Purpose:

- Parameter Manager画面を、常設Preset table + Custom parameter管理として成立させる。

Dependencies:

- Domain A pass and handoff.
- Thin navigation contract with Domain B.

Expected implementation areas:

- `apps/editor/**`
- focused editor tests / e2e

Required UX:

- Parameter Manager route/screen reachable from Parameter Bar Manage and existing entry point.
- Header has `+ Custom` and Close. No `+ From Preset`.
- Group label filters: All / Face / Eyes / Mouth / Brow/Cheek / Body / Secondary / Custom.
- Table columns: Name / Kind / Range / Used. No Role column.
- Preset parameters are all visible from initial state.
- Preset Details show locked role / stable id / group / range / sign convention summary.
- Custom Details allow edit of display name, stable id, type, min/default/max according to Domain A support.
- Custom create flow.
- Custom delete/refactor only if Domain A supports safe operations; otherwise disabled with clear reason.
- Usage summary + View Usage details.
- Check Strip summary for warnings/errors.

Acceptance:

- User can open Parameter Manager.
- User sees all Preset parameters without adding them.
- User can filter by group and search.
- User can select a Preset and see locked Details.
- User can create a Custom parameter.
- User can Set Active from manager and see Parameter Bar reflect it, if B integration is available; otherwise leave a clear handoff/test seam.
- Unused Preset is not warning.

Forbidden:

- Camera Capture Facade implementation.
- Preset role schema redesign.
- Custom role assignment UI.
- Full usage/evidence/raw payload surface.
- Mesh work.

## 13. Domain E: `wave64-final-integration-clean-review-map-closeout`

Purpose:

- Domains A/B/C/Dを統合し、Wave64としてpassできるか確認する。

Expected work:

- Confirm domain reports and 3 review lanes exist for A/B/C/D.
- Confirm A handoff was consumed by B/D.
- Confirm C stayed independent and did not destabilize Parameter work.
- Confirm Parameter Manager and Parameter Bar share a coherent active parameter contract.
- Run final validation.
- Update maps and closeout reports.
- Run final clean integration Review-Sylph with cross-domain Spec Compliance summary.

Required checks:

- `pnpm typecheck`
- Focused package tests from A/C
- Focused editor tests/e2e from B/D
- `node scripts/check-source-organization.mjs`
- `node scripts/check-dependencies.mjs`
- `git diff --check`

Expected artifacts:

- `discussion/implementation/waves/wave64/wave64-final-integration-report.md`
- `discussion/implementation/reviews/wave64/wave64-final-clean-integration-review.md`
- `discussion/implementation/waves/wave64/_map.md`
- `discussion/implementation/reviews/wave64/_map.md`

## 14. Orchestration Policy

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
- Must close completed child agent sessions at the end of the domain to avoid zombie sessions.
- Must not close running child sessions.

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

## 15. Expected Persistent Artifacts

Reports:

- `discussion/implementation/waves/wave64/wave64-domain-a-parameter-keyform-package-operation-foundation-report.md`
- `discussion/implementation/waves/wave64/wave64-domain-b-editor-parameter-keyform-editing-loop-report.md`
- `discussion/implementation/waves/wave64/wave64-domain-c-mesh-auto-outline-v3-envelope-sidecar-report.md`
- `discussion/implementation/waves/wave64/wave64-domain-d-parameter-manager-v0-report.md`
- `discussion/implementation/waves/wave64/wave64-final-integration-report.md`
- `discussion/implementation/waves/wave64/_map.md`

Reviews:

- `discussion/implementation/reviews/wave64/wave64-domain-a-spec-compliance-review.md`
- `discussion/implementation/reviews/wave64/wave64-domain-a-design-development-review.md`
- `discussion/implementation/reviews/wave64/wave64-domain-a-test-adequacy-review.md`
- `discussion/implementation/reviews/wave64/wave64-domain-b-spec-compliance-review.md`
- `discussion/implementation/reviews/wave64/wave64-domain-b-design-development-review.md`
- `discussion/implementation/reviews/wave64/wave64-domain-b-test-adequacy-review.md`
- `discussion/implementation/reviews/wave64/wave64-domain-c-spec-compliance-review.md`
- `discussion/implementation/reviews/wave64/wave64-domain-c-design-development-review.md`
- `discussion/implementation/reviews/wave64/wave64-domain-c-test-adequacy-review.md`
- `discussion/implementation/reviews/wave64/wave64-domain-d-spec-compliance-review.md`
- `discussion/implementation/reviews/wave64/wave64-domain-d-design-development-review.md`
- `discussion/implementation/reviews/wave64/wave64-domain-d-test-adequacy-review.md`
- `discussion/implementation/reviews/wave64/wave64-final-clean-integration-review.md`
- `discussion/implementation/reviews/wave64/_map.md`

## 16. Out of Scope

- Camera Capture / Face Tracking Facade.
- External runtime API / export facade.
- Custom semantic role assignment.
- visibility / clipping / draw order keyforms.
- Parts Container keyforms.
- Mesh topology keyforms.
- Full manual mesh vertex editor expansion.
- Pixel-perfect / Cubism mesh generation claim.
- Full constrained triangulation claim if not actually implemented.
- Physics / dynamics expansion.
- Variant / Expression Manager implementation.
- Texture Atlas.
- Save / load project UX expansion.
- Photoshop pixel-perfect compositing.
- Cubism SDK / `.moc3` / `.model3.json` compatibility.
- External HTTP / WebSocket / MCP transport.
- LLM provider integration.
- Repo-side semantic proposal generation / auto-rig / auto-fix.
