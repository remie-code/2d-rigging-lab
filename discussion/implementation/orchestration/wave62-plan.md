# Wave 62 Plan: Mesh Auto Outline + Warp Deformer Foundation v0

> `auto-grid-v1` の粗い矩形meshを輪郭追従型の `auto-outline-v1` へ進めつつ、Warp DeformerをTransform divisionsとBezier edit surfaceを持つ内部構造として立ち上げる実装計画。Mesh改善とDeformer package foundationは並列化し、Editor側Rig Tool統合はDeformer package契約の後段に置く。

## 1. 状態

- Status: Planned
- Target wave: Wave62
- Wave name: `mesh-auto-outline-warp-deformer-foundation-v0`
- Primary objective: PSD import後の自然な次工程として、Drawable mesh生成品質をCubism風の輪郭追従に近づけ、次のRig UXに必要なWarp Deformerの内部契約とEditor導線を作る。

Wave62で得たいUX:

1. Mesh Toolで `Large Motion` / `Standard` / `Low Motion` を選ぶと、Drawableのalpha輪郭に沿った初期mesh previewが出る。
2. Applyで輪郭追従meshをcommitでき、既存meshはRegenerate -> Applyで置換できる。
3. Rig Toolを起動すると、左ペインで `Parts` / `Deformers` を切り替えられる。
4. Warp Deformerを作成し、Transform divisionsとBezier divisionsを持つdraftをInspectorとCanvas overlayで確認してApplyできる。

## 2. Planning Gate Result

Planning Gate result before this plan: `Plan directly`.

理由:

- Wave61後のUX確認で、次に必要なUXが明確になっている。
- Mesh `auto-outline-v1` の仕様は [Mesh Tool Component](../../design/screen-design/components/mesh-tool.md) に具体化済みである。
- Warp DeformerのBezier edit surface方針は [Rig Tool Component](../../design/screen-design/components/rig-tool.md) に具体化済みである。
- 不確実性は残るが、各ドメイン内で調査して閉じられる技術的不確実性であり、ユーザー判断待ちではない。
- Deformerはpackage契約とEditor UXに明確な依存関係があるため、計画段階で分離することでroot contextと統合リスクを抑えられる。

追加Inventoryは不要。ただし各Orch-Sylphは、担当範囲の現状コード調査から入ること。

## 3. Accepted Decisions / Oracles

- UXを真とする。Accepted UXを実現するために必要なら `packages/**` のformat / schema / operation / validator / fixture / testを修正してよい。
- 既存package制約にGUIだけで迂回しない。詳細は [UX-Backed Package Logic Authority](../../development_convention/ux-backed-package-logic-authority.md) を参照する。
- Mesh生成はsemantic recognitionではない。入力は明示選択Drawable、preset、RGBA alpha maskである。
- Mesh `auto-grid-v1` はWave61 v0の最小導線であり、Cubism風輪郭追従meshではない。Wave62では `auto-outline-v1` を目指す。
- Bezier編集は別primitiveではなく、Warp Deformer自身の機能として扱う。
- Warp Deformerは内部的に以下を持つ。
  - Bezier edit surface: Bezier divisions、Bezier edit type、Bezier control points / handles
  - Transform grid / lattice: Transform divisions、evaluation control points、child drawable / child deformer deformation
- Deformerのpackage/internal model foundationとEditor UI integrationは分ける。
- Editorはauto-rig、semantic classification、LLM提案、parameter/keyform/physics一式の自動構築を持たない。
- E2Eは主要導線と状態反映を確認する。meshの美的品質、pixel完全一致、Photoshop parityはE2E oracleにしない。

## 4. Primary Basis

- [Mesh Tool Component](../../design/screen-design/components/mesh-tool.md)
- [Rig Tool Component](../../design/screen-design/components/rig-tool.md)
- [Canvas / Preview Component](../../design/screen-design/components/canvas-preview.md)
- [Parts Tree Component](../../design/screen-design/components/parts-tree.md)
- [Drawable Inspector Component](../../design/screen-design/components/drawable-inspector.md)
- [Authoring Workspace Screen](../../design/screen-design/screens/authoring-workspace.md)
- [Playwright E2E Oracle](../../design/screen-design/e2e-oracle.md)
- [React Editor Foundation Oracle](../../design/screen-design/react-editor-foundation-oracle.md)
- [UX-Backed Package Logic Authority](../../development_convention/ux-backed-package-logic-authority.md)
- [Source File Organization Policy](../../development_convention/source-file-organization-policy.md)
- [Dependency Policy](../../development_convention/dependency-policy.md)
- [Operation Policy](../../development_convention/operation-policy.md)
- [Schema and ID Conventions](../../development_convention/schema-and-id-conventions.md)
- `.github/skills/implementation-orchestration/SKILL.md`

## 5. Wave Strategy

Wave62は完全3並列ではなく、依存関係つきの2+1+1構成にする。

```text
Batch 1:
  Domain A: Mesh Auto Outline v1
  Domain B: Warp Deformer Package Foundation

Batch 2:
  Domain C: Rig Tool Deformer Tree / Warp Deformer Editor v0

Batch 3:
  Domain D: Final Integration / Clean Review / Map Closeout
```

理由:

- Domain Aのmesh生成改善とDomain Bのdeformer package foundationは独立している。
- Domain CはDomain Bのschema / operation / validation契約に依存する。
- Domain AとDomain CはCanvas overlay周辺で触る可能性があるため、Domain CはDomain B完了後に開始しつつ、Domain Aがまだ進行中の場合はoverlay shared filesの編集を避けるか、Domain A reportを待つ。
- Domain DはA/B/Cの契約差分、Editor統合、docs/mapをまとめて確認する。

## 6. UX Acceptance Criteria

### 6.1 Mesh Auto Outline

```text
Authoring Workspace
  -> PSDをimport
  -> Drawableを選択
  -> Mesh Toolを起動
  -> presetを選ぶ
  -> alpha輪郭に沿ったpreview mesh overlayを確認
  -> Applyでcommit
```

Required:

- `Large Motion` / `Standard` / `Low Motion` のpresetを維持する。
- 3presetは同じ決定的アルゴリズムをpreset値で変える。
- DrawableのRGBA alpha maskから輪郭を抽出する。
- 外周頂点がalpha輪郭に沿って配置される。
- 透明矩形領域を大きな三角形で覆う結果を避ける。
- `Large Motion` は `Standard` / `Low Motion` より細かい境界 / 内部点を生成する。
- 生成結果はdeterministicである。
- Preview -> Apply導線を維持する。
- RegenerateはApplyまで既存meshを保持し、Applyで置換する。
- 画像bytesが取れない、alphaが空、輪郭抽出が失敗する場合は、明示的にfallbackまたはblocked表示にする。

Non-goals:

- 手動頂点編集。
- 辺 / 頂点追加削除。
- 詳細な分割数UI。
- 高度なmesh品質調整。
- 複数Drawable一括生成。
- semantic preset selection。
- Cubism互換claim。
- pixel-level visual oracle。

### 6.2 Warp Deformer Package Foundation

```text
package / operation layer
  -> Warp Deformerを作成できるcontractを持つ
  -> Transform divisionsとBezier divisionsを保存 / 検証できる
  -> child Drawable / child Deformer bindingを表現できる
  -> runtime / validation / operation evidenceが壊れない
```

Required:

- User-facing conceptは `Warp Deformer` として扱う。
- Internal modelはBezier edit surfaceとTransform grid / latticeを分けて表現できる。
- Transform divisionsのcolumns / rowsを表現できる。
- Bezier divisionsのcolumns / rowsを表現できる。
- Bezier edit typeを持てる。初期は固定defaultでもよい。
- Bezier control points / handlesまたはそれを決定的に生成できるrest surfaceを持てる。
- Domain boundsを持てる。
- parent deformerを持てる。
- bound childrenとしてDrawableまたはchild Deformerを扱える。
- Validatorはdimension不正、control point cardinality不整合、循環、missing targetを検出する。
- Operationはdry-run / commit差分を返す。
- 既存 `warpLattice2d` / rig control testsを不用意に破壊しない。
- Runtimeが完全Bezier evaluationを実装しない場合でも、既存bilinear behaviorとの互換またはunsupported境界を明示する。

Non-goals:

- Editor UI実装。
- Mesh `auto-outline-v1` 実装。
- parameter / keyform full authoring。
- physics / dynamics integration。
- Cubism互換claim。

### 6.3 Rig Tool Deformer Tree / Warp Deformer Editor v0

```text
Authoring Workspace
  -> DrawableまたはPart Containerを選択
  -> Rig Toolを起動
  -> 左ペインをParts / Deformersで切り替え
  -> Warp Deformer draftを作成
  -> Inspectorで基本項目を確認 / 編集
  -> Canvas overlayでdraftを確認
  -> Applyでcommit
```

Required:

- 左ペインの `Parts / Structure Tree` 領域に `Parts` / `Deformers` 切替を置く。
- Parts Treeはdraw order / membershipのホームとして維持する。
- Deformer Treeはdeformer hierarchyを表示する。
- Deformer Tree内のbound Drawableは必要に応じて参照行として表示してよいが、Parts Treeのmembershipを破壊しない。
- Drawable選択中にRig Toolを起動すると、Warp Deformer作成導線に入れる。
- Part Container選択中は、その配下を対象にするか、配下Drawable / Containerを選ぶpickerを出す。
- Project / none選択中は、短いempty stateを表示して対象選択を促す。
- Inspector初期項目:
  - name
  - parent deformer
  - bound children summary
  - domain bounds
  - Transform divisions
  - Bezier divisions
  - Bezier edit type readonly or fixed default
  - fit / reset actions
  - Apply / Cancel
- Canvas overlayはdraft状態とcommitted状態を区別する。
- Canvas overlayは少なくともdomain boundsとTransform gridを表示する。
- 可能ならBezier edit surfaceも補助表示する。
- Applyするまでproject stateを変更しない。
- Apply後、Deformer Treeに作成済みWarp Deformerが出る。
- 選択Deformerに対応するbound targetがCanvas上で分かる。

Non-goals:

- Full keyform authoring。
- Parameter Manager実装。
- Subtree opacity effect実装。
- manual Bezier control point editing。
- Rotation Tool再設計。
- Physics / dynamics integration。
- Cubism互換claim。
- pixel-level visual oracle。

## 7. Domain Design

| Batch | Domain | Dependency | Purpose |
|---|---|---|---|
| 1 | A. Mesh Auto Outline v1 | Wave61 mesh baseline | `auto-outline-v1` 生成アルゴリズムとPreview/Apply維持 |
| 1 | B. Warp Deformer Package Foundation | Existing rig control / `warpLattice2d` baseline | Transform divisions + Bezier edit surfaceを持つpackage / operation契約 |
| 2 | C. Rig Tool Deformer Tree / Warp Deformer Editor v0 | Domain B pass / contract note | Deformer Tree、Rig Tool draft、Inspector、Canvas overlayのEditor統合 |
| 3 | D. Final Integration / Clean Review / Map Closeout | Domains A/B/C pass or explicit escalate | 統合検証、docs/map closeout、clean review |

## 8. Domain A: `wave62-mesh-auto-outline-v1`

Purpose:

- Wave61の `auto-grid-v1` を、alpha輪郭抽出を含む `auto-outline-v1` へ進める。

Expected implementation areas:

- `packages/authoring-core/**` mesh generation code。
- `packages/operation-core/**` の `generateMesh` operation contract / evidenceが必要なら更新。
- `apps/editor/**` Mesh Tool preview / Apply integration。ただしUI大改造は避ける。
- Focused unit tests / fixtures。

Implementation guidance:

1. 入力
   - Drawable texture / raw RGBA bytes。
   - width / height。
   - preset。
   - alpha threshold。

2. Alpha mask / bounds
   - alpha thresholdでbinary maskを作る。
   - 有効alpha boundsを取る。
   - 空maskならblockedまたはfallback。

3. Contour extraction
   - mask外周を抽出する。
   - 穴は初期実装では無視してよいが、透明外周を大きく覆わない。
   - 複数島がある場合は、最大島または全島を決定的に扱う。判断が難しい場合は最大島 + warningでよい。

4. Contour simplification
   - presetごとに許容誤差 / 最小間隔を変える。
   - `Large Motion` は細かく、`Low Motion` は粗くする。

5. Interior sampling
   - alpha bounds内にpreset密度で点を置く。
   - alpha mask外の点は捨てる。
   - 輪郭近傍は必要に応じて点を残す。

6. Triangulation
   - contour vertices + interior pointsから三角形を作る。
   - 外側三角形、透明領域中心の三角形、極端に細い三角形は可能な範囲で除外する。
   - 既存依存で足りない場合、ノーム裁量で軽量依存導入を検討してよい。ただしdependency policyを確認し、不要な車輪再発明を避ける。

7. Mapping
   - pixel座標をstage / drawable座標へ写す。
   - UVを対応させる。
   - stable id / deterministic orderを保つ。

8. Fallback
   - 輪郭抽出またはtriangulationが失敗した場合は、既存 `auto-grid-v1` へ明示fallbackしてよい。
   - fallbackしたことをevidenceまたはUI summaryで分かる形にする。

Acceptance:

- Sample PSDの髪・帽子などで、preview meshが矩形gridではなくalpha輪郭に沿う。
- `Large Motion` は境界点と内部点が多い。
- `Low Motion` は少ない頂点で成立する。
- Apply / Regenerate / Cancelの既存UXが壊れない。
- Deterministic testsがある。
- `pnpm typecheck` と必要なfocused testsがpassする。

Forbidden:

- Rig / Deformer package契約の変更。
- PSD import semanticsの変更。
- Parts Tree DnDの変更。
- pixel-perfect oracle追加。
- Cubism互換claim。

Expected report:

- 実装概要。
- 採用した輪郭抽出 / triangulation方針。
- fallback条件。
- 変更ファイル。
- 検証結果。
- 残リスク。

## 9. Domain B: `wave62-warp-deformer-package-foundation`

Purpose:

- Editor UIに先行して、Warp DeformerをTransform divisionsとBezier edit surfaceを持つ内部model / operation contractとして成立させる。

Expected implementation areas:

- `packages/package-format/**`
- `packages/authoring-core/**`
- `packages/operation-core/**`
- `packages/validator-core/**`
- `packages/runtime-core/**` if required
- `packages/ai-interface/**` if command catalog / read surface contract is affected
- focused tests / fixtures

Required current-state investigation:

- 既存 `warpLattice2d` model / operation / validator / runtime evaluatorの現状。
- rig control parent / binding / keyform / operation evidenceの現状。
- 既存testsが期待するlattice columns / rows semantics。

Contract design requirements:

- User-facing kind: `Warp Deformer`。
- Backward compatibility strategy:
  - 既存 `warpLattice2d` を拡張するか、新kindを導入するかを調査後に決める。
  - どちらでもよいが、Editor UXから見てWarp Deformerとして扱えること。
- Fields:
  - stable id
  - display name
  - parent deformer ref
  - bound child refs
  - domain bounds
  - transform columns / rows
  - bezier columns / rows
  - bezier edit type
  - bezier rest surface / control points / handles, or deterministic default generation input
  - compatibility / migration metadata if needed
- Validator:
  - invalid divisions
  - invalid bounds
  - missing refs
  - cycle
  - malformed Bezier surface cardinality
  - incompatible keyform/control-point cardinality
- Operation:
  - create Warp Deformer dry-run / commit
  - update basic settings if required by Editor v0
  - bind child drawable / child deformer
  - preserve evidence refs and operation log behavior
- Runtime:
  - Do not claim full Cubism / Bezier evaluation unless implemented.
  - Existing semantic evaluation must not regress.
  - If Bezier surface is stored but not fully evaluated, document that evaluation remains existing compatible behavior for now.

Acceptance:

- Package fixtures can represent a Warp Deformer with Transform divisions and Bezier divisions.
- Operation tests prove create / dry-run / commit / evidence.
- Validator tests prove malformed cases.
- Existing rig / keyform / warp lattice tests pass or are intentionally migrated.
- Domain C can consume a short contract note without re-reading all package internals.

Forbidden:

- Editor UI implementation.
- Canvas overlay UI implementation.
- Mesh generation changes.
- Full parameter/keyform authoring.
- Physics/dynamics changes.
- Cubism compatibility claim.

Expected report:

- Current-state findings.
- Chosen contract strategy.
- Domain C handoff contract note:
  - create operation name / DTO shape
  - read projection shape
  - fields Editor may display/edit
  - unsupported/evaluation boundaries
- Verification results.
- Residual risks.

## 10. Domain C: `wave62-rig-tool-deformer-tree-editor-v0`

Purpose:

- Domain Bのpackage契約を使い、Authoring Workspace上にRig ToolのDeformer Tree / Warp Deformer draft UXを立ち上げる。

Dependencies:

- Domain B pass。
- Domain B handoff contract note。
- Domain A report if Canvas overlay shared files overlap.

Expected implementation areas:

- `apps/editor/**`
- focused editor tests / e2e if appropriate
- docs/report only for domain evidence

Allowed package changes:

- 原則禁止。
- Domain B contractに不足がありUXを実現できない場合は、Orch-Sylphへescalateする。勝手にpackage契約を拡張しない。

Implementation requirements:

1. Left pane toggle
   - `Parts` / `Deformers` toggleをStructure left pane header近くに置く。
   - `Parts`表示では既存Parts Treeを維持する。
   - `Deformers`表示ではDeformer hierarchyを表示する。

2. Deformer Tree
   - Warp Deformer rowsを表示する。
   - parent / child deformer関係を表現する。
   - bound Drawableは参照として見える形にしてよい。
   - Parts Treeのmembershipやdraw orderと混同しない。

3. Rig Tool state
   - Drawable selected -> Warp Deformer draftを作れる。
   - Part Container selected -> target pickerまたはcontainer配下target選択を出す。
   - Project / none selected -> short empty state。

4. Inspector
   - name
   - parent deformer
   - bound children summary
   - domain bounds
   - Transform divisions
   - Bezier divisions
   - Bezier edit type readonly / fixed default
   - fit / reset
   - Apply / Cancel

5. Canvas overlay
   - draft domain bounds。
   - Transform grid。
   - possible Bezier edit surface guide。
   - committed deformer selection highlight。
   - draft / committed visual distinction。

6. Operation integration
   - Apply uses Domain B operation contract。
   - Cancel discards draft。
   - Project state changes only on Apply。
   - After Apply, Deformer Tree and Inspector update。

7. Minimal E2E / test
   - Use [Playwright E2E Oracle](../../design/screen-design/e2e-oracle.md).
   - Verify user path and state reflection only.
   - Do not encode visual layout/pixel expectations.

Acceptance:

- User can create a Warp Deformer from a selected Drawable.
- User can see it in Deformer Tree.
- User can switch Parts / Deformers without losing selection unexpectedly.
- Inspector shows agreed fields.
- Canvas overlay shows draft bounds/grid before Apply.
- Apply commits through package operation and reflects in UI.
- Focused tests pass.

Forbidden:

- Package contract redesign.
- Mesh `auto-outline-v1` implementation.
- Full keyform authoring。
- Parameter Manager。
- Subtree opacity effect。
- Physics/dynamics。
- Cubism compatibility claim。
- pixel-level visual oracle。

Expected report:

- UI / state flow implemented。
- Domain B contract usage。
- Tests / verification。
- Any Canvas overlay overlap resolved with Domain A。
- Residual UX gaps。

## 11. Domain D: `wave62-final-integration-clean-review-map-closeout`

Purpose:

- Domains A/B/Cを統合し、最終的にWave62としてpassできるかを確認する。

Expected work:

- Domain reports / review reportsの存在確認。
- A/B/Cのscope逸脱確認。
- Package/editor boundary確認。
- Mesh overlayとRig overlayのshared state / toolbar collision確認。
- `packages/**` schema / operation / validator変更がUX-backed authorityに沿っているか確認。
- Required validation commandの結果確認。
- Maps update:
  - `discussion/implementation/_map.md`
  - `discussion/implementation/orchestration/_map.md`
  - `discussion/design/screen-design/_map.md` if design status changes
  - wave/review maps under `discussion/implementation/waves/wave62/` and `discussion/implementation/reviews/wave62/`

Required final checks:

- `pnpm typecheck`
- Focused unit tests from Domain A/B/C。
- Focused e2e if Domain C adds one。
- `git diff --check`。

Final review:

- Run clean Review-Sylph final integration review.
- Do not mark Wave62 complete without clean review `pass` or explicit user-approved exception.

## 12. Orchestration Policy

This wave must follow `.github/skills/implementation-orchestration/SKILL.md`.

Root / Undine:

- Owns wave plan, dependency graph, user questions, and final decision.
- Must not implement the wave.
- Must preserve root context.
- Must call Orch-Sylph for implementation domains.
- Must wait for started subagents.

Orch-Sylph:

- Owns one domain loop.
- Must start with bounded current-state investigation for its domain.
- Must delegate implementation to Gnome.
- Must delegate review to independent Review-Sylph lanes.
- Must not implement directly unless explicitly allowed by the wave plan. This plan does not allow direct Orch-Sylph implementation.
- Must wait for Gnome and Review-Sylph completion.
- Must not cancel, close, or interrupt child agents because they are slow or waiting.

Gnome:

- Receives domain-specific basis only.
- Implements within allowed scope.
- May introduce necessary dependencies under dependency policy and project validation constraints.
- May modify `packages/**` when the domain explicitly allows it and accepted UX requires it.

Review-Sylph:

- Reviews from artifacts and source, not only from Gnome summary.
- Must cover design / development compliance and test adequacy unless explicitly N/A.

Waiting rule:

- `wait_agent` timeout is a polling timeout, not failure.
- No parent agent may terminate a child agent's work merely because it has not responded yet.
- If an unavoidable interruption occurs, record the domain as incomplete / blocked / escalated. Do not pass the wave gate.

Early escape triggers:

- Domain A cannot build deterministic contour triangulation without unacceptable dependency or algorithm risk.
- Domain B finds existing rig contracts conflict with accepted Warp Deformer model and requires user decision.
- Domain C cannot consume Domain B contract without package changes.
- Canvas overlay shared state between Mesh and Rig conflicts and cannot be safely resolved inside Domain C.
- Tests require pixel/image oracle beyond accepted e2e boundary.
- Any domain needs rights/provenance changes.

## 13. Expected Persistent Artifacts

Reports:

- `discussion/implementation/waves/wave62/wave62-domain-a-mesh-auto-outline-v1-report.md`
- `discussion/implementation/waves/wave62/wave62-domain-b-warp-deformer-package-foundation-report.md`
- `discussion/implementation/waves/wave62/wave62-domain-c-rig-tool-deformer-tree-editor-v0-report.md`
- `discussion/implementation/waves/wave62/wave62-domain-d-final-integration-closeout-report.md`
- `discussion/implementation/waves/wave62/_map.md`

Reviews:

- `discussion/implementation/reviews/wave62/wave62-domain-a-mesh-auto-outline-v1-review.md`
- `discussion/implementation/reviews/wave62/wave62-domain-b-warp-deformer-package-foundation-review.md`
- `discussion/implementation/reviews/wave62/wave62-domain-c-rig-tool-deformer-tree-editor-v0-review.md`
- `discussion/implementation/reviews/wave62/wave62-final-clean-integration-review.md`
- `discussion/implementation/reviews/wave62/_map.md`

Optional, if split review lanes are recorded separately:

- `*-design-development-review.md`
- `*-test-adequacy-review.md`

## 14. Out of Scope

- Save / load project UX expansion.
- Texture Atlas.
- Parameter Manager.
- Variant / Expression Manager.
- Viewer / Runtime dedicated view expansion.
- Subtree opacity effect.
- Full keyform authoring.
- Physics / dynamics.
- Manual mesh vertex editor expansion.
- Photoshop pixel-perfect compositing.
- PSD clipping extraction changes.
- Public demo asset.
- Cubism SDK / `.moc3` / `.model3.json` compatibility.
- External HTTP / WebSocket / MCP transport.
- LLM provider integration.
- Repo-side semantic proposal generation / auto-rig / auto-fix.
