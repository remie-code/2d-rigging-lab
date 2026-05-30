# Wave 17 Plan: Editor Mesh Vertex Editing Vertical Slice

> Wave 17 で実装すべき domain、依存順、Orch-Sylph 並列投入方針を固定する計画。
> 実装起動時はこの文書と `.agents/skills/implementation-orchestration/SKILL.md` を最小基準にする。

## 1. 状態

- Status: Completed / implementation-proven
- Target wave: Wave 17
- Wave name: `editor-mesh-vertex-editing-vertical-slice`
- Primary objective: Wave 15-16 で GUI 作成・layer 操作できるようになった generated drawable / deterministic mesh を対象に、最小の mesh vertex edit を operation / preview / persistence / evidence / e2e まで通す。

## 2. 調査結論

次wave前の Sylph 調査は `ready_for_wave_plan`。

大きな残作業は、split PNG / PSD input、real texture pipeline、mesh editing、mask / clipping、opacity、rig control、dynamics、standalone private viewer、OS filesystem / archive import-export、AI repair suggestion などである。

このうち Wave 17 では `moveMeshVertex` の縦切りを採用する。理由は次のとおり。

- AC-MVP-005 の mesh editing に直結する。
- Wave 15 の generated drawable / deterministic mesh と Wave 14-16 の preview / persistence / evidence をそのまま足場にできる。
- `packages/operation-core` には `moveMeshVertex` operation type / payload schema が既に存在するが、registry handler は未登録で unsupported regression が残っている。
- split PNG / texture pipeline や standalone viewer よりも依存面が小さく、1waveで implementation-proven まで到達しやすい。

## 3. Wave 17 の主目的

Wave 17 は、既存 generated mesh の頂点を GUI から最小操作で移動し、その変更が authoring graph、operation log、model diff、runtime snapshot / diff、validation evidence、editor preview、browser-local save/load、desktop/mobile e2e に一貫して残ることを証明する。

UI は full canvas mesh editor ではなく、選択済み drawable / mesh の頂点一覧または最小 edit panel から、1頂点を deterministic に nudge する範囲に限定する。Canvas drag、範囲選択、複数頂点編集、UV editing、texture editing は扱わない。

## 4. Undine コンテキスト保護の復元規約

Wave 17 でも、Undine は詳細実装コンテキストを直接抱え込まない。

- Undine は wave objective、domain split、依存順、統合判断、ユーザー質問、最終報告だけを持つ。
- Undine は domain ごとに Orch-Sylph を起動し、Orch-Sylph に domain 内の Gnome 実装、Review-Sylph レビュー、needs_fix loop、domain completion report を完結させる。
- Undine は各 domain の詳細ソースを大量に読まず、completion report / integration summary を読んで wave 判断を行う。
- 長時間待機になっても、Undine は Orch-Sylph / subagent 処理を打ち切らない。
- 各 source implementation domain には `discussion/development_convention/source-file-organization-policy.md` を渡し、巨大 source file / catch-all `index.ts` を防ぐ。

## 5. Repository Facts

- Wave 16 は `Completed / implementation-proven`。editor は generated drawable / mesh を作成し、drawable list から hide/show と layer move up/down を実行できる。
- `packages/operation-core/src/operation-type.ts` には `moveMeshVertex` がある。
- `packages/operation-core/src/payloads/model-edit.ts` の `MoveMeshVertexPayloadSchema` は `meshId`、`vertexDeltas[{ vertexId, delta }]`、optional `keyformScope`、`intent` を持つ。
- `packages/operation-core/src/operation-lifecycle.test.ts` には、Wave16時点で `moveMeshVertex` が unsupported である regression がある。
- `packages/operation-core/src/operation-registry.ts` には `generateMesh`、`setDrawOrder`、`setRuntimeVisibility` などが登録済みだが、Wave16時点で `moveMeshVertex` handler は未登録。
- `packages/authoring-core/src/mesh-generation.ts` と `mesh-mutations.ts` は generated mesh 作成・置換の基盤を持つ。
- `apps/editor` は drawable list、preview projection、save/load、desktop/mobile e2e smoke を持つ。

## 6. Design Decisions

- Wave 17 は base mesh vertex edit に限定する。
- `MoveMeshVertexPayloadSchema.keyformScope` はこのwaveでは扱わない。keyform-scoped mesh edit は future scope。
- UI は deterministic nudge 操作に限定する。例: selected drawable の最初のeditable vertex、または vertex row の +/- x/y buttons。
- Operation payload は UI ではなく editor workflow/session command builder 側で組み立てる。
- Runtime / preview は authored mesh vertices の変更を source of truth とし、UI fake state を作らない。
- Model diff / runtime diff / validation evidence は mesh vertex change を観測できる必要がある。
- Existing generated drawable workflow、layer controls、preview slider、save/load smoke を壊さない。
- Public `index.ts` は barrel-only を維持する。

## 7. Non-Goals

- PSD import、split PNG import、real texture pipeline は扱わない。
- Full canvas mesh editor、drag selection、direct canvas vertex dragging は扱わない。
- UV editing、texture coordinate editing、mesh topology editing、triangle editing は扱わない。
- 複数頂点の高度な同時編集、selection box、snap/grid editor は扱わない。
- keyform-scoped mesh vertex edit は扱わない。
- mask / clipping、opacity editor、rig control、dynamics、standalone viewer は扱わない。
- 外部 HTTP / WebSocket / MCP transport、LLM provider integration は扱わない。
- Cubism SDK/Core、Cubism形式 import/export、既存Cubism model loading は扱わない。

## 8. Basis Documents

Undine が保持する最小 basis:

- `.agents/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `discussion/implementation/orchestration/wave17-plan.md`
- `discussion/implementation/current-capability-map.md`
- `discussion/implementation/waves/wave16/wave16-final-report.md`
- `discussion/implementation/waves/wave15/wave15-final-report.md`

各 Orch-Sylph に渡す domain basis:

- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/design/module-contracts/operation-contracts.md`
- `discussion/design/module-contracts/runtime-core-contract.md`
- domain ごとの target source files
- domain ごとの既存 tests / fixtures
- 必要に応じて Wave 16 の completion / review / integration report

Undine は全設計規約を自分で読み込まない。詳細規約は Orch-Sylph が domain 必要分だけ読み、Gnome / Review-Sylph へ狭く渡す。

## 9. Dependency / Parallel Design

Wave 17 は operation foundation を先に作り、その後に evidence と editor workflow を並列化し、最後に UI / e2e / integration を直列 gate にする。

| Batch | Domain | Parallelism | Dependency | Purpose |
|---|---|---|---|---|
| 1 | A. mesh vertex operation foundation | Solo | Wave 16 complete | `moveMeshVertex` handler と authoring mutation を作る |
| 2 | B. mesh vertex runtime / validation evidence regression | Parallel with C | A | mesh vertex change が runtime diff / evidence / validation に出ることを固める |
| 2 | C. editor mesh edit workflow state | Parallel with B | A | editor session / workflow / view model に vertex nudge action と mesh edit state を追加する |
| 3 | D. editor mesh vertex controls UI | Solo | B + C | drawable authoring UI に最小 vertex nudge controls を追加する |
| 4 | E. mesh vertex edit e2e and persistence smoke | Solo | D | create drawable後の vertex nudge / preview / save-load / mobile smoke を検証する |
| 5 | F. integration review and final report | Solo | E | clean integration review、修正反映、map更新、final report を完了する |

Batch 2 だけを並列化する。Domain B は packages / fixture / evidence 側、Domain C は apps/editor workflow/state 側に所有範囲を分ける。

## 10. Domain Assignments

### A. `wave17-mesh-vertex-operation-foundation`

Purpose:

- `moveMeshVertex` operation handler を実装し、operation registry に登録する。
- Authoring graph の mesh vertices を `vertexDeltas` に従って deterministic に更新する mutation helper を作る。
- Missing mesh、missing vertex、duplicate vertex delta、empty delta、no-op update、unsupported keyformScope などを deterministic diagnostic にする。
- 既存 unsupported regression を、supported operation lifecycle regression に更新する。

Write scope:

- `packages/authoring-core/src/**`
- `packages/operation-core/src/operations/move-mesh-vertex*.ts`
- `packages/operation-core/src/operation-registry.ts`
- focused authoring / operation tests
- discussion completion / review reports

Pass evidence:

- `moveMeshVertex` dry-run / commit が model diff と precondition diagnostics を返す。
- Commit 後に対象 mesh vertex の座標が変わる。
- keyformScope あり payload はこのwaveでは明示的に rejected / unsupported diagnostic になる。
- `generateMesh` / `setDrawOrder` / `setRuntimeVisibility` 既存operation lifecycleを壊さない。
- `index.ts` は barrel-only のまま。

Early escape:

- `MoveMeshVertexPayloadSchema` が vertex identity を安全に解決できない。
- vertex delta semantics と absolute position semantics のどちらを正とするか設計判断が必要になる。
- keyformScope を同時実装しないと base mesh edit が成立しない。

### B. `wave17-mesh-vertex-runtime-evidence-regression`

Purpose:

- Domain A の mesh vertex change が runtime snapshot、runtime diff、validation report、operation result evidence、operation log evidence で観測できることを固める。
- Compact fixture で generated mesh -> move vertex -> runtime evidence の oracle を作る。

Write scope:

- `packages/operation-core/src/*mesh*evidence*.test.ts`
- `packages/runtime-core/src/**` は test-discovered bug fix の最小差分のみ可
- `packages/validator-core/src/**` は test-discovered bug fix の最小差分のみ可
- `fixtures/contracts/**` の compact fixture
- discussion completion / review reports

Pass evidence:

- Runtime snapshot の mesh vertices / bounds / geometry metadata が vertex edit 後に変わる。
- Runtime diff が mesh vertex / bounds 変化を dedicated field または既存 diff field で観測できる。
- Validation report が edited mesh を通すか、妥当な diagnostic を出す。
- Fixture が過大にならず future wave の oracle として読める。

Early escape:

- Runtime diff が mesh vertex change を表現できず shared contract redesign が必要になる。
- Validator が edited mesh の bounds / triangle consistency をどう扱うべきか未決になる。

### C. `wave17-editor-mesh-edit-workflow-state`

Purpose:

- Editor session / workflow に `moveMeshVertex` commit action を追加する。
- UI が使う view model に selected mesh / editable vertex list / nudge enabled state / last mesh edit result を追加する。
- Save/load 後に edited mesh vertices が復元されることを UIなしの focused tests で確認する。

Write scope:

- `apps/editor/src/editor-session/**`
- `apps/editor/src/editor-workflow/**`
- `apps/editor/src/editor-state/**`
- focused editor session / workflow / view model tests
- discussion completion / review reports

Pass evidence:

- Editor session から `moveMeshVertex` が commit できる。
- Operation log と package file set に mesh edit operation が残る。
- Save/load 後に vertex coordinates が復元される。
- View model が Domain D の UI に必要な editable vertex row と command state を提供する。
- UI なしの focused tests がある。

Early escape:

- Selected drawable / mesh の ownership が current editor state から安全に解けない。
- Mesh edit state が full canvas editor や selection model redesign を要求する。

### D. `wave17-editor-mesh-vertex-controls-ui`

Purpose:

- Drawable authoring UI に最小 mesh vertex controls を追加する。
- User が generated drawable / mesh 作成後、vertex row から x/y nudge を実行できるようにする。
- Embedded preview と result summary が更新されるよう app shell に接続する。

Write scope:

- `apps/editor/src/ui/drawable-authoring/**`
- `apps/editor/src/ui/app-shell/app-shell.ts`
- `apps/editor/src/app/editor-app.ts`
- `apps/editor/src/styles/**`
- `apps/editor/src/editor-state/editor-test-ids.ts`
- focused UI tests
- discussion completion / review reports

Pass evidence:

- Mesh vertex controls が表示される。
- Nudge button / input が Domain C action を呼ぶ。
- Preview panel と同一画面で layout が破綻しない。
- Text overflow / incoherent overlap / nested card layout を増やさない。
- Existing drawable create UI と layer controls UI を壊さない。

Early escape:

- Existing drawable authoring panel が mesh controls を収めるには broad redesign が必要になる。
- UIがcanvas drag editorや大規模selection modelを要求する。

### E. `wave17-mesh-vertex-edit-e2e-and-persistence-smoke`

Purpose:

- Browser-level smoke で create drawable -> nudge vertex -> preview change -> save/load を固定する。
- Desktop / mobile viewport と basic a11y を確認する。

Write scope:

- `apps/editor/e2e/**`
- `apps/editor/tests/**`
- `tests/e2e/**`
- `fixtures/e2e/**`
- narrow test id / aria tweaks in UI files only if needed for smoke
- discussion completion / review reports

Pass evidence:

- `pnpm test:e2e` または該当 focused e2e command で mesh vertex edit workflow が走る。
- Existing generated drawable smoke、layer controls smoke、preview slider smoke が壊れない。
- Vertex nudge により preview summary / visual / mesh vertex labels の deterministic 変化を検証する。
- Save/load 後も edited vertex coordinate が残る。
- Desktop / mobile の両方で basic layout と accessible names を確認する。

Early escape:

- Current e2e harness が vertex coordinate / preview visual の deterministic assertion を安定検証できない。
- Browser automation / screenshot verification が sandbox 制約で実行できない。

### F. `wave17-integration-review-and-final-report`

Purpose:

- Domain A-E の completion report を統合し、clean integration review を行う。
- needs_fix が残る場合は該当 Orch-Sylph に戻す。
- Wave 17 final report、capability map、implementation maps を更新する。

Write scope:

- `discussion/implementation/waves/wave17/**`
- `discussion/implementation/reviews/wave17/**`
- `discussion/implementation/current-capability-map.md`
- relevant `_map.md`
- source code は原則禁止。review fix が必要な場合だけ該当 domain へ差し戻す。

Pass evidence:

- Integration review が Product Workflow、Runtime Truthfulness、Operation Integrity、Persistence、UI / Accessibility、Source Organization、Test Adequacy を含む。
- Final report に verification commands、known residuals、next-wave recommendation がある。
- Wave 17 gate が pass / needs_fix / blocked のいずれかで明確に記録される。

## 11. Subagent / Orch-Sylph Execution Policy

Wave 17 起動時の実行単位は domain ごとの Orch-Sylph である。

1. Undine は Domain A の Orch-Sylph を投入し、completion report を待つ。
2. Domain A が `pass` したら、Undine は Domain B / C の Orch-Sylph を並列投入する。
3. Domain B / C がどちらも `pass` したら、Undine は Domain D を Orch-Sylph に委譲する。
4. Domain D が `pass` したら、Undine は Domain E を Orch-Sylph に委譲する。
5. Domain E が `pass` したら、Undine は Domain F を Orch-Sylph に委譲する。
6. 各 Orch-Sylph は domain 内で Gnome 実装と Review-Sylph レビューを分離し、needs_fix loop を自分の domain 内で閉じる。
7. Review-Sylph は clean context で、implementation notes ではなく basis docs、target files、diff、tests を根拠にレビューする。
8. Subagent からユーザーへ直接質問してはならない。質問は Orch-Sylph が集約し、Undine が重複排除してユーザーへ確認する。
9. Undine は completion report が `pass` でない domain を wave gate 通過扱いにしない。
10. 長時間処理でも、Undine は待機を理由に subagent を打ち切らない。

## 12. Review Lanes

各 domain completion 前に最低限以下を確認する。

- Product Workflow: GUI から mesh vertex を動かし、preview / persistence で確認できるか。
- Runtime Truthfulness: preview と evidence が runtime snapshot / diff 由来であり、UI fake semantics ではないか。
- Operation Integrity: dry-run / commit / operation log / model diff / precondition diagnostics が coherent か。
- Persistence: package file set / save-load / generated artifacts が mesh vertex changes を失わないか。
- UI / Accessibility: desktop/mobile layout、text overflow、control label、keyboard operation が破綻していないか。
- Development Compliance: source file organization、barrel-only `index.ts`、単一責務、write scope 非逸脱を満たすか。
- Test Adequacy: unit / operation / workflow / UI / e2e が domain risk に見合うか。
- Determinism: vertex coordinate、bounds、preview summary、e2e assertions が deterministic か。

## 13. Verification Plan

Domain ごとの最小 verification:

- Domain A: authoring-core / operation-core focused tests、typecheck
- Domain B: operation evidence / runtime evidence / fixture focused tests
- Domain C: editor session / workflow / view model focused tests、editor typecheck
- Domain D: mesh controls UI focused tests、editor typecheck
- Domain E: editor e2e smoke、a11y smoke
- Domain F: `pnpm typecheck`、`pnpm test:unit`、`pnpm test:e2e`、`pnpm run check:source`

最終 verification:

- `pnpm typecheck`
- `pnpm test:unit`
- `pnpm test:e2e`
- `pnpm run check:source`
- `git diff --check -- <Wave17 scope>`
- untracked file whitespace check if new fixtures/reports are untracked

## 14. Early Escape / User Decision Points

Orch-Sylph は次の場合、独断で大きな設計変更をせず `escalate` する。

- `moveMeshVertex` の vertex ID が generated mesh で安定解決できない。
- Vertex delta と absolute position の意味論が既存文書と衝突する。
- Base mesh edit と keyform-scoped mesh edit の境界が曖昧になり、同時実装を要求する。
- Runtime diff / validation evidence が mesh vertex change を観測できず shared contract redesign が必要になる。
- UI が full canvas editor / drag selection / topology editor へ膨らむ。
- E2E / browser verification が現在の sandbox で安定実行できない。

現時点で、推奨範囲どおり `moveMeshVertex` base mesh edit に進むなら、ユーザー判断は不要。

## 15. Pass Criteria

Wave 17 は次を満たしたとき pass とする。

- `moveMeshVertex` operation handler が dry-run / commit / precondition diagnostics / model diff を持つ。
- GUI から generated mesh の頂点を最小 nudge 操作で変更できる。
- Changes が embedded preview / preview summary / runtime diff で deterministically 観測できる。
- Operation log、package file set、save/load persistence、runtime / validation evidence が mesh vertex changes を失わない。
- Desktop / mobile e2e smoke で mesh vertex edit workflow と preview update が検証されている。
- `index.ts` は barrel-only のままで、巨大 source file / catch-all source file が増えていない。
- Domain completion、clean integration review、final report が `discussion/implementation/` 配下に残る。
