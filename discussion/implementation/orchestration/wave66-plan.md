# Wave 66 Plan: Canvas Evaluation Artwork Deformation v0 + Mesh V2.6 Soft Apron Sidecar

> Parameterを動かしたときに、Canvas上の絵そのものが変形・回転・フェードして見える体験へ進める。Mesh V2.6は本流から分離したsidecarとして扱う。

## 1. 状態

- Status: Planned
- Target wave: Wave66
- Wave name: `canvas-evaluation-artwork-deformation-v0-mesh-v2-6-sidecar`
- Primary objective:
  - Canvas描画の前に `CanvasEvaluatedScene` 相当の評価層を置く。
  - parameter / keyform / deformer chain / draft / drag preview を合成して、評価済みdrawable mesh / bounds / opacity / overlayを作る。
  - CanvasRendererで評価済みmeshに沿って実画像を変形描画する。
  - selection / overlay / hit test を評価後座標へ寄せる。
  - Mesh `auto-outline-v2.6-soft-apron` を、Canvas評価本流と衝突しないheadless sidecarとして進める。

## 2. Planning Gate Result

Planning Gate result before this plan: `Inventory first` -> `Plan directly`.

Inventory basis:

- [Canvas Evaluation / Renderer / Parameter State Inventory](../waves/wave66/wave66-preplan-canvas-evaluation-inventory.md)
- [Mesh V2.6 Sidecar Inventory](../waves/wave66/wave66-preplan-mesh-v2-6-sidecar-inventory.md)

Why planning is now safe:

- `canvas-renderer.ts` はすでにsession-freeで、`CanvasRenderProjection` を描画している。
- 生の `AuthoringSession` 参照は `createCanvasRenderProjection` 周辺に集中しており、評価層の挿入点が明確である。
- parameter / keyform評価は、Drawable opacity、Rig opacity、Rotation angle、Warp control point offsets まで既に存在する。
- 不足している本質は、評価済みmeshで実画像を描く経路、評価済みbounds / overlay / hit test、draft previewとの統合である。
- Mesh V2.6は `packages/authoring-core` / `packages/operation-core` 寄りのheadless sidecarとして、Canvas評価本線と独立に進められる。

Uncertainty:

- factual: low to medium。主要経路は棚卸済みだが、triangle texture drawingとparent-local変換の細部は実装時確認が必要。
- decision: low。UXの主目標は合意済み。技術方針は本計画で切る。
- cost of wrong plan: high。Canvas評価境界を誤ると以後のrigging UX、Viewer、Runtime Previewへ悪影響が出る。

## 3. Accepted Decisions / Oracles

- UXを真とする。Accepted UXを実現するために必要なら `packages/**` のformat / schema / operation / validator / runtime / fixture / testを修正してよい。
- Root / Undineは実装しない。実装は必ず Orch-Sylph -> Gnome / Review-Sylph の境界で行う。
- Subagentは必ず待機する。timeoutは失敗ではなくpolling timeoutである。
- 完了済みchild sessionは閉じる。実行中child sessionを親が閉じたり停止してはいけない。
- 次のUXは「parameterを動かしたとき、Canvas上の絵そのものが変形して見える」ことである。
- CanvasRendererへ `AuthoringSession` の知識を直接増やさない。
- `CanvasEvaluatedScene` / evaluation adapterを、Editor sessionとCanvas rendererの間に置く。
- v0の描画はCanvas2D triangle texture warpを第一候補とする。WebGL renderer化はWave66必須ではない。
- v0のhit testは評価後boundsを必須とする。triangle hit testは可能なら実装してよいが必須ではない。
- clippingはv0で完全なdeformed mask対応を必須にしない。composition slotまたは既存挙動維持を許容する。
- Deformer評価順は Deformer Tree の親 -> 子 -> drawable とする。
- parameter scrub、draft preview、control point drag previewは `AuthoringSession` を変更しない。
- commit操作だけがUndo対象である。Wave65のUndo / Redo境界を尊重する。
- Apply / commit後にCanvas viewportを勝手にfitしない。
- Mesh V2.6は `auto-outline-v2.6-soft-apron` として明示method化する。
- Mesh V2.6はV2.5 defaultを勝手に置き換えない。default切替は人間visual確認後の別判断である。

## 4. Primary Basis

Common:

- [Implementation Orchestration Skill](../../../.github/skills/implementation-orchestration/SKILL.md)
- [UX-Backed Package Logic Authority](../../development_convention/ux-backed-package-logic-authority.md)
- [Source File Organization Policy](../../development_convention/source-file-organization-policy.md)
- [Dependency Policy](../../development_convention/dependency-policy.md)
- [Operation Policy](../../development_convention/operation-policy.md)
- [Schema and ID Conventions](../../development_convention/schema-and-id-conventions.md)

UX / Design:

- [Canvas Evaluation Pipeline v0](../../design/canvas-evaluation/canvas-evaluation-pipeline-v0.md)
- [Canvas / Preview Component](../../design/screen-design/components/canvas-preview.md)
- [Parameter / Keyform Component](../../design/screen-design/components/parameter-keyform.md)
- [Rig Tool Component](../../design/screen-design/components/rig-tool.md)
- [Mesh Tool Component](../../design/screen-design/components/mesh-tool.md)
- [auto-outline-v2.5 Soft Boundary Algorithm](../../design/mesh-generation/auto-outline-v2-5-soft-boundary.md)
- [auto-outline-v2.6 Soft Apron Algorithm](../../design/mesh-generation/auto-outline-v2-6-soft-apron.md)

Wave65 Baseline:

- [Wave65 Plan](wave65-plan.md)
- [Wave65 Final Integration Report](../waves/wave65/wave65-final-integration-report.md)
- [Wave65 Final Clean Integration Review](../reviews/wave65/wave65-final-clean-integration-review.md)

Wave66 Inventories:

- [Canvas Evaluation / Renderer / Parameter State Inventory](../waves/wave66/wave66-preplan-canvas-evaluation-inventory.md)
- [Mesh V2.6 Sidecar Inventory](../waves/wave66/wave66-preplan-mesh-v2-6-sidecar-inventory.md)

## 5. Review Policy

Wave66も、各implementation domainに3 review lanesを必須とする。

1. `Spec Compliance Review`
   - wave planとprimary basis docsへの対応を見る。
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

Wave66 uses a dependency-aware `2 + 1 + 1` structure.

```text
Batch 1:
  Domain A: Canvas Evaluation Foundation v0
  Domain C: Mesh auto-outline-v2.6 Soft Apron Headless Sidecar

Batch 2:
  Domain B: Evaluated Canvas Rendering / Overlay / Hit Test Integration

Batch 3:
  Domain D: Final Integration / Clean Review / Map Closeout
```

Dependency graph:

```text
A -> B
C independent sidecar
D depends on A/B/C pass or explicit escalation
```

理由:

- Canvas evaluation boundaryを先に作らないと、renderer / overlay / hit testがraw stateに絡み続ける。
- 実画像の変形描画、overlay追従、hit test移行は評価済みsceneのshapeに依存するためDomain Bへ分ける。
- Mesh V2.6はheadless package側のalgorithm workであり、Canvas evaluation本線と衝突が小さい。
- ただしBはCanvasのUX本丸なので、A完了後に十分大きい単一Gnome taskとして扱ってよい。

## 7. UX Acceptance Criteria

### 7.1 Canvas Evaluation

```text
User scrubs active parameter
  -> Canvas creates evaluated scene
  -> drawable mesh / opacity / deformer chain are evaluated
  -> AuthoringSession is not mutated
```

Required:

- `CanvasEvaluatedScene` または同等の型 / adapterを導入する。
- inputは `AuthoringSession`、`parameterValues`、`meshDraft`、`rigDraft`、control point drag preview、selection、overlay togglesを扱える。
- outputは評価済みdrawable mesh vertices / triangles / bounds / opacity / visible / draw order / texture refsを持つ。
- linear keyform補間をCanvas評価に反映する。
- Drawable opacity keyformを描画へ反映する。
- Warp Deformer control point offsetsを描画へ反映する。
- Rotation Deformer angleを描画へ反映する。
- Rig opacity multiplierを描画へ反映する。
- parent -> child -> drawable のDeformer chain順で評価する。
- parameter scrubは `AuthoringSession` を変更しない。
- draft / drag previewは `AuthoringSession` を変更しない。

### 7.2 Evaluated Artwork Rendering

```text
Evaluated drawable has mesh vertices
  -> Canvas draws the bitmap through evaluated triangles
  -> artwork shape moves with parameter/deformer evaluation
```

Required:

- 現在のrectangular `drawImage` だけに頼らず、評価済みmeshで画像を描画する経路を追加する。
- 初期実装はCanvas2D triangle texture warpでよい。
- meshがないdrawableは既存rectangular draw fallbackを許容する。
- evaluated meshがあるdrawableは、parameter scrubで実画像が変形して見える。
- Apply後、viewportは勝手にfitしない。
- bitmap / source texture cacheは不要に再生成しない。

### 7.3 Overlay / Selection / Hit Test

```text
Artwork is evaluated
  -> overlay follows evaluated coordinates
  -> hit test uses evaluated coordinates
```

Required:

- selected drawable bounds / outlineは評価後boundsへ追従する。
- mesh overlayは評価後meshを表示する。
- Warp lattice overlayは評価後座標へ追従する。
- Rotation pivot / guideは評価後座標へ追従する。
- Warp control point drag preview中、overlayだけでなく実画像もpreview変形される。
- hit testは少なくとも評価後bounds基準にする。
- hidden drawableは通常hit test対象にしない。
- topmost drawable selectionを維持する。
- Deformer control point hit testはdrawable hit testより優先する。

### 7.4 Draft / Commit / Undo Integration

```text
User edits control points at keyform position
  -> drag preview deforms artwork live
  -> pointerup commits one operation
  -> Undo reverts the committed gesture
```

Required:

- control point drag previewをCanvas評価入力として扱う。
- pointermove中はsessionを変更しない。
- pointerupで1 commit、1 undo entryにする。
- keyform位置以外ではdirect drag不可の既存UXを維持する。
- Add / Update / Delete keyformのcommit境界を壊さない。
- Apply mesh / Apply deformer後のviewport維持を壊さない。

### 7.5 Mesh V2.6 Soft Apron Sidecar

```text
Mesh generation method explicitly requests auto-outline-v2.6-soft-apron
  -> V2.5-like coarse interior density
  -> thin ratio-based boundary apron
  -> bounded fallback/provenance
```

Required:

- `auto-outline-v2.6-soft-apron` を明示methodとして扱える。
- V2.5の内部密度を大きく変えない。
- alpha輪郭の外側に、bounds比率ベースの薄いapronを作る。
- apron領域は中央付近のtriangleと似たサイズの複数triangleで埋める。
- 境界点を遠い内部点へ無理につなぐ長いfanを避ける。
- V3のような大きな外側包絡にしない。
- V2.5 / V2 / V1 / bounds-grid fallbackへ戻れる。
- quality summary / provenanceにV2.6固有情報を残す。
- Editor defaultはV2.5のままにする。

## 8. Domain Design

| Batch | Domain | Dependency | Purpose |
|---|---|---|---|
| 1 | A. Canvas Evaluation Foundation v0 | Wave65 baseline | evaluated scene / adapter / parameter-deformer evaluation / unit tests |
| 2 | B. Evaluated Canvas Rendering / Overlay / Hit Test Integration | Domain A pass | triangle texture drawing / evaluated overlay / evaluated hit test / UX flow |
| 1 | C. Mesh auto-outline-v2.6 Soft Apron Headless Sidecar | Wave65 V2.5 baseline | V2.6 explicit method / metrics / fallback / headless tests |
| 3 | D. Final Integration / Clean Review / Map Closeout | A/B/C pass or explicit escalation | validation / maps / cross-domain review |

## 9. Domain A: `wave66-canvas-evaluation-foundation-v0`

Purpose:

- Canvas描画前に、parameter / keyform / deformer / draftを合成した評価済みsceneを作る基盤を導入する。

Expected implementation areas:

- `apps/editor/src/workspace/canvas/**`
- `apps/editor/src/features/editor-session/**`
- `apps/editor/package.json` if runtime-core direct dependency is chosen
- focused editor tests

Required capabilities:

1. Evaluation adapter
   - `AuthoringSession + transient state -> evaluated scene` を実装する。
   - `canvas-renderer.ts` へ `AuthoringSession` 依存を増やさない。

2. Evaluated drawable geometry
   - evaluated vertices / triangles / bounds / opacity / visibility / draw order / texture refsを生成する。
   - meshなしdrawableはrect fallbackできる。

3. Parameter / keyform evaluation
   - existing editor helperまたはruntime-core helperを再利用してよい。
   - Drawable opacity、Warp offsets、Warp opacity multiplier、Rotation angle、Rotation opacity multiplierを扱う。

4. Deformer chain
   - parent -> child -> drawable順に評価する。
   - parent下のchild deformer / drawableへ評価結果を伝播する。

5. Draft / preview input
   - meshDraft、rigDraft、control point drag previewを入力できるshapeにする。
   - 初回で全draftを完全反映できない場合でも、control point drag previewは必須。

Acceptance:

- Pure evaluation testsが通る。
- Parameter scrub inputにより、評価済みdrawable bounds / vertices / opacityが変化する。
- Parameter scrubは `AuthoringSession` を変更しない。
- Parent deformerの影響がchild/drawable評価へ反映される。
- control point previewが評価入力として扱える。

Forbidden:

- Rendererへ生session知識を直接積むこと。
- Save / load project拡張。
- Viewer / Runtime Preview全面統合。
- WebGL renderer化必須化。
- Mesh V2.6実装。

## 10. Domain B: `wave66-evaluated-canvas-rendering-overlay-hit-test`

Purpose:

- Domain Aの評価済みsceneを使って、Canvas上の実画像、overlay、hit testを評価後座標へ移行する。

Dependencies:

- Domain A pass and handoff.

Expected implementation areas:

- `apps/editor/src/workspace/canvas/**`
- `apps/editor/src/workspace/panels/canvas-preview-panel.tsx`
- `apps/editor/src/features/editor-session/**`
- focused editor tests
- minimal E2E only if stable and semantic

Required capabilities:

1. Evaluated image rendering
   - evaluated mesh trianglesでbitmapを描く。
   - Canvas2D triangle texture warp utilityを置いてよい。
   - meshなし / textureなし / fallback時の表示を壊さない。

2. Overlay migration
   - selection bounds / mesh overlay / Warp lattice / Rotation guideを評価後座標へ追従させる。
   - grid / origin / canvas boundsはstage-level overlayとして維持する。

3. Hit test migration
   - drawable hit testを評価後bounds基準へ移す。
   - deformer control point hit testを優先する。
   - hidden drawableは対象外にする。

4. Direct edit preview
   - Warp control point drag中、実画像もpreview変形される。
   - pointerup commit後もviewportは維持される。

Acceptance:

- User can scrub a parameter and see artwork deformation / rotation / fade on Canvas.
- Keyform間の補間位置でもCanvas上の絵が変化して見える。
- Warp control point drag preview中に実画像が追従する。
- Parent-child deformer chainがCanvas表示に反映される。
- Evaluated overlay and selection remain coherent with the rendered artwork.
- Evaluated bounds hit test selects the visually moved drawable.
- Existing PSD import / mesh / deformer workflow remains usable.

Forbidden:

- screenshot / pixel oracleをpass条件にすること。
- Photoshop pixel-perfect compositing。
- Full clipping / deformed mask完全対応の必須化。
- General canvas transform tool / multiselect / rotate view / rulers。
- Mesh V2.6実装。

## 11. Domain C: `wave66-mesh-auto-outline-v2-6-soft-apron-sidecar`

Purpose:

- V2.5の内部密度と粗さを維持しつつ、輪郭外側の薄いapronで境界不足を補うV2.6をheadless methodとして追加する。

Expected implementation areas:

- `packages/authoring-core/**`
- `packages/operation-core/**`
- `packages/package-format/**` if method metadata/schema is needed
- focused package tests
- `apps/editor/**` は原則触らない。触る場合はdefault切替なしのexplicit method visibility程度に留める。

Required capabilities:

- Add explicit method `auto-outline-v2.6-soft-apron`.
- Reuse/extract V2.5 helpers where appropriate.
- Ratio-based apron padding.
- 1-2 apron ring sampling or equivalent bounded apron strip。
- V2.5-like sparse interior sampling。
- apron-aware long-edge / fan / skinny-triangle filtering。
- bounded local gap refill if included。
- quality metrics / provenance for V2.6。
- fallback chain: `v2.6 -> v2.5 -> v2 -> v1 -> bounds-grid`。

Acceptance:

- Output is deterministic.
- V2.6 source / algorithm id / metrics are visible in headless result.
- V2.6 increases boundary/apron coverage over V2.5 without becoming V3-like envelope.
- Triangle count increase over V2.5 is bounded.
- Boundary-to-interior long edges and fan concentration are bounded by tests or metrics.
- Existing V2.5 tests remain passing.
- Editor default remains V2.5.

Forbidden:

- Canvas Evaluation / Renderer changes.
- Editor default switch to V2.6.
- Cubism reproduction claim.
- Broad geometry dependency without dependency policy compliance / escalation.
- Parameter / Keyform / Deformer UX changes.

## 12. Domain D: `wave66-final-integration-clean-review-map-closeout`

Purpose:

- Domains A/B/Cを統合し、Wave66としてpassできるか確認する。

Expected work:

- Confirm domain reports and 3 review lanes exist for A/B/C.
- Confirm A/B do not leak raw `AuthoringSession` knowledge into renderer.
- Confirm B consumes A's evaluated scene boundary rather than duplicating evaluation logic ad hoc.
- Confirm C stayed sidecar and did not switch Editor default unexpectedly.
- Run final validation.
- Update maps and closeout reports.
- Run final clean integration Review-Sylph with cross-domain Spec Compliance summary.

Required checks:

- `pnpm typecheck`
- Focused editor tests from A/B
- Focused package tests from C
- Focused Playwright only for durable semantic flow if stable and not visual-pixel based
- `node scripts/check-source-organization.mjs`
- `node scripts/check-dependencies.mjs`
- `git diff --check`

Expected artifacts:

- `discussion/implementation/waves/wave66/wave66-domain-a-canvas-evaluation-foundation-report.md`
- `discussion/implementation/waves/wave66/wave66-domain-b-evaluated-canvas-rendering-overlay-hit-test-report.md`
- `discussion/implementation/waves/wave66/wave66-domain-c-mesh-auto-outline-v2-6-soft-apron-sidecar-report.md`
- `discussion/implementation/waves/wave66/wave66-final-integration-report.md`
- `discussion/implementation/waves/wave66/_map.md`
- `discussion/implementation/reviews/wave66/_map.md`
- `discussion/implementation/reviews/wave66/wave66-final-clean-integration-review.md`

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
- Must close completed child agent sessions at the end of the domain to avoid zombie sessions.
- Must not close running child sessions.

Gnome:

- Receives domain-specific basis sections only.
- Implements within allowed scope.
- May modify `packages/**` when the domain explicitly allows it and accepted UX requires it.
- May add a dependency when it is justified by the accepted UX and dependency policy.
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

- `discussion/implementation/waves/wave66/wave66-domain-a-canvas-evaluation-foundation-report.md`
- `discussion/implementation/waves/wave66/wave66-domain-b-evaluated-canvas-rendering-overlay-hit-test-report.md`
- `discussion/implementation/waves/wave66/wave66-domain-c-mesh-auto-outline-v2-6-soft-apron-sidecar-report.md`
- `discussion/implementation/waves/wave66/wave66-final-integration-report.md`
- `discussion/implementation/waves/wave66/_map.md`

Reviews:

- `discussion/implementation/reviews/wave66/wave66-domain-a-spec-compliance-review.md`
- `discussion/implementation/reviews/wave66/wave66-domain-a-design-development-review.md`
- `discussion/implementation/reviews/wave66/wave66-domain-a-test-adequacy-review.md`
- `discussion/implementation/reviews/wave66/wave66-domain-b-spec-compliance-review.md`
- `discussion/implementation/reviews/wave66/wave66-domain-b-design-development-review.md`
- `discussion/implementation/reviews/wave66/wave66-domain-b-test-adequacy-review.md`
- `discussion/implementation/reviews/wave66/wave66-domain-c-spec-compliance-review.md`
- `discussion/implementation/reviews/wave66/wave66-domain-c-design-development-review.md`
- `discussion/implementation/reviews/wave66/wave66-domain-c-test-adequacy-review.md`
- `discussion/implementation/reviews/wave66/wave66-final-clean-integration-review.md`
- `discussion/implementation/reviews/wave66/_map.md`

## 15. Out of Scope

- WebGL renderer rewrite as a required deliverable.
- Viewer / Runtime Preview full integration.
- Save / load project UX expansion.
- Texture Atlas.
- Physics / dynamics expansion.
- Variant / Expression Manager implementation.
- Parameter preset ecosystem redesign.
- Camera Capture / Face Tracking Facade.
- External runtime API / export facade.
- Full clipping / deformed mask pixel-perfect support.
- Photoshop pixel-perfect compositing.
- Blend modes beyond existing/simple alpha behavior.
- Manual mesh vertex / edge / topology editing.
- General Canvas transform tools unrelated to deformer evaluation.
- Rotation Deformer direct Canvas editing beyond evaluating existing angle keyforms.
- Bounds box transform / scale / rotate selected control points.
- Keyboard shortcuts / keyboard slider editing.
- Cubism SDK / `.moc3` / `.model3.json` compatibility.
- External HTTP / WebSocket / MCP transport.
- LLM provider integration.
- Repo-side semantic proposal generation / auto-rig / auto-fix.

