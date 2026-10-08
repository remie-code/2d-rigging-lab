# 残作業バックログ

> 状態: 2026-06-19 / Wave84 final complete / pass。
> このファイルは、古い Wave54-Wave80 前提の backlog を構造ごと破棄し、現行の repository evidence から再作成した次 wave 計画用の短い棚卸である。

## 0. 陳腐化判定

- 旧 backlog は stale。Wave81-Wave84 で Dynamics Tool v0、Dynamics preview time progression、Quick Tune、Viewer Runtime Dynamics playback、runtime-core solver consolidation が完了したため、「Dynamics clarify before Viewer playback」という前提は obsolete。
- `discussion/implementation/current-capability-map.md` は存在するが、冒頭から Wave54-era assumptions を含む historical map である。次 wave の判断では、この backlog、`discussion/implementation/_map.md`、`discussion/implementation/orchestration/_map.md`、Wave84 reports/reviews を優先する。
- 不確実性: この更新は maps、Wave84 artifacts、targeted `rg` による source/test 確認に基づく。GUI をブラウザで手動確認したわけではない。

## 1. 現在実装済みの機能

### Editor / Workspace

- Wave57 後の React Editor foundation が、現在の GUI baseline である。
- Authoring Workspace には、App Bar、Toolbox entries、Structure / Parts Tree、Canvas / Preview、Inspector、Parameter Bar、Project Storage、Parameter Manager route、Viewer route が含まれる。
- Project open/save は、React Editor の App Bar / Project Storage surface から project-defined portable bundle path を使用する。
- 根拠: `apps/editor/src/workspace/authoring-workspace.tsx`, `apps/editor/src/workspace/app-bar.tsx`, `apps/editor/src/workspace/workspace-data.ts`, `apps/editor/src/workspace/project-storage/project-storage-screen.tsx`, `discussion/implementation/orchestration/_map.md`.

### PSD Import / Asset Intake

- Browser PSD parser adapter は Editor 内に存在し、`@webtoon/psd` は承認済みの Editor/browser adapter boundary の内側でのみ使用する。
- 現在の PSD import は、明示的なユーザー主導の import planning と commit path をサポートしている。対象は source metadata、materialized raw RGBA layer evidence、structural scaffold planning、group/leaf approval、生成された Part Container / Drawable / Texture / empty Mesh scaffold refs、hidden PSD group から editor-hidden Part への gate behavior、parser boundary tests である。
- PSD 由来の drawables は、import 後に Editor Canvas / Preview に表示される。
- 根拠: `apps/editor/src/editor-workflow/browser-psd-parser-adapter.ts`, `apps/editor/src/features/psd-import/model/psd-import-planner.ts`, `apps/editor/src/features/psd-import/model/psd-import-commit.ts`, `apps/editor/src/features/psd-import/model/psd-import-hidden-part-bridge.test.ts`, `discussion/implementation/_map.md` の Wave58-W61 entries。

### Parts / Hierarchy / Canvas

- Mixed ordered Part Container / Drawable hierarchy は実装済みで、draw order authority、collapse/expand state、editor-hidden Part behavior、Drawable-only multi-select、DnD reorder/reparent をサポートする。
- Canvas rendering は、imported PSD drawables、selection、zoom/pan/fit/1:1 style controls、visibility reflection、clipping relation support、evaluated keyform/deformer parameter maps、WebGL/rendering foundations をサポートする。
- 根拠: `apps/editor/src/features/editor-session/model/session-tree.ts`, `apps/editor/src/features/editor-session/model/session-tree.test.ts`, `apps/editor/src/workspace/panels/structure-tree-panel.tsx`, `apps/editor/src/workspace/canvas/canvas-renderer.ts`, `apps/editor/src/workspace/canvas/canvas-evaluation.ts`, `discussion/implementation/_map.md` の Waves59-W61 and Wave76 entries。

### Mesh

- Mesh Tool v0 と、その後の auto-outline mainline は実装済み。現在の default path は v6D-lineage adaptive contour-constrainautor output であり、backend selector を露出するのではなく product-facing presets を提供する。
- Mesh batch preview/apply は対象条件を満たす Drawable selection に対して存在し、existing-mesh exclusion も実装済み。
- Lower-level bounded topology / UV operations と tests は存在するが、atlas packing、UV unwrap、renderer pixel correctness、広範な manual topology editor UX は現在の product claims ではない。
- 根拠: `apps/editor/src/features/editor-session/model/mesh-tool-state.ts`, `apps/editor/src/features/editor-session/model/mesh-tool-state.test.ts`, `packages/authoring-core/src/mesh-generation.ts`, `packages/authoring-core/src/mesh-generation.test.ts`, `discussion/implementation/orchestration/_map.md` の Wave70-W71 and Wave76 entries。

### Rig / Deformers

- Rotation Deformer と Warp Deformer authoring は実装済み。Deformer Tree、Drawable Pool、binding/reparent operations、parent-child local-space semantics、Canvas rotation interaction、Warp control point editing、keyed Warp edge/corner scale handles を備える。
- 関連する unbound または Deformer Tree selection に対する batch create / wrap-selected authoring が存在する。
- 根拠: `apps/editor/src/features/editor-session/model/rig-tool-state.ts`, `apps/editor/src/features/editor-session/model/deformer-tree-wrap-selection.ts`, `apps/editor/src/workspace/panels/rig-tool-inspector.tsx`, `apps/editor/src/workspace/canvas/rotation-deformer-gesture.ts`, `apps/editor/src/workspace/canvas/warp-deformer-scale.ts`, `discussion/implementation/_map.md` の Waves72-W78。

### Parameters / Keyforms / Undo

- Preset/custom parameter surfaces、Parameter Manager、active Parameter Bar、current-value editing、marker navigation、undo/redo、parameter-aware Inspector flows は実装済み。
- Keyforms は、現在受け入れ済みの v0 targets をカバーする。対象は Drawable opacity、Warp Deformer offsets / opacity multiplier、Rotation Deformer angle / translation / opacity multiplier。deformer keyforms の save/load hardening も存在する。
- 根拠: `apps/editor/src/features/editor-session/model/parameter-keyform-state.ts`, `apps/editor/src/features/editor-session/model/parameter-manager-projection.ts`, `apps/editor/src/workspace/panels/parameter-bar.tsx`, `apps/editor/src/workspace/parameter-manager/parameter-manager-screen.tsx`, `discussion/implementation/orchestration/_map.md` の Waves64-W75。

### Viewer / Runtime View

- Dedicated Viewer / Runtime View は、完成モデルを確認するための clean surface として実装済み。Runtime Controls、session-only parameter overrides、parameter search、reset affordances、Parameter Bar suppression、clean stage overlay suppression、Viewer-local pan/zoom、Parts Container visibility parity を備える。
- Wave84 は authored Dynamics Groups を Viewer playback へ接続した。driver parameter changes は runtime-core evaluation に入力され、pendulum motion は driver stop 後も継続/収束し、Dynamics outputs は keyform/deformer evaluation 前に注入される。output parameters は Runtime Controls から除外され、`Reset simulation` は session-local simulation state のみをリセットする。
- 根拠: `apps/editor/src/workspace/viewer/viewer-runtime-screen.tsx`, `apps/editor/src/workspace/viewer/viewer-runtime-playback.ts`, `apps/editor/src/workspace/viewer/runtime-controls-state.ts`, `apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts`, `apps/editor/src/workspace/viewer/runtime-controls-state.test.ts`, `discussion/implementation/waves/wave84/wave84-final-integration-report.md`.

### Dynamics

- Dynamics Tool v0 は、parameter-driven secondary motion authoring として実装済み。multiple driver inputs、one pendulum、one additive output、preset-based creation、create/edit/list/group inspector states、validation、Inspector-local preview drivers、time-progressing preview、reset preview、Quick Tune を備える。
- Wave84 は、物理ステップの意味論を `packages/runtime-core` に集約した。Editor preview は、独自の solver formula を持つのではなく runtime-core stepping helpers を使用する。
- 根拠: `apps/editor/src/features/editor-session/model/dynamics-tool-state.ts`, `apps/editor/src/workspace/panels/dynamics-tool-inspector.tsx`, `packages/runtime-core/src/dynamics-evaluation.ts`, `packages/runtime-core/src/parameter-resolution.ts`, `packages/runtime-core/src/runtime-core.ts`, Wave81-W84 reports。

### Diagnostics / Preflight / Codex Surfaces

- Repo/package-level Product Preflight、validator diagnostics、Codex proposal validation/diff/approval/rerun helpers、PSD import-plan command surfaces は packages 内に実装済み。
- 現在の React Editor source では、targeted search 上、完成した Diagnostics / Evidence View または Codex / Automation View は確認できない。これらの full human-facing React UI は、現在の機能ではなく残作業として扱う。
- 根拠: `packages/validator-core/src/product-preflight-report.ts`, `packages/validator-core/src/product-preflight-report-diff.ts`, `packages/validator-core/src/codex-proposal-rerun-validation.ts`, `packages/ai-interface/src/ai-codex-proposal-command.ts`, `packages/ai-interface/src/ai-product-preflight-command.ts`, `apps/editor/src` を対象にした targeted `rg`。

## 2. 実装可能な残作業バックログ

### Viewer / Dynamics Hardening

- Viewer Dynamics playback について、browser/manual visual QA を実行し記録する。対象は real rAF cadence、perceived motion smoothness、pointer/slider feel、reset behavior、Canvas visual response。
- 大きめの projects で Viewer per-frame runtime evaluation が目に見える負荷になる可能性に備え、focused performance profiling を追加する。
- 小さな runtime/viewer unification spike を追加し、Viewer が runtime-core effective parameters を使いながら Editor Canvas projection で描画している現在の boundary を文書化またはテストする。
- ユーザー判断で変更されない限り、`Reset simulation`、play/pause なし、frame stepping なし、output exclusion を維持する。

### Diagnostics / Evidence React View v0

- stale な Wave54 UI を復活させるのではなく、既存の validator/Product Preflight/package evidence を中心に、現在の React read-only Diagnostics / Evidence surface を構築する。
- 最小有用スコープ: 現在の Product Preflight summary、blocking diagnostics、evidence refs、PSD import evidence summary、runtime/viewer evidence status、operation-log refs。
- repair generation、auto-fix、LLM/provider integration、external transport は追加しない。

### Codex / Automation React View v0

- deterministic Codex-facing package APIs のために、現在の React status/review surface を構築する。対象は proposal validation、dry-run diff preview、rerun validation、approval-gated commit status、transcript/evidence refs、PSD import-plan command availability。
- read-only または approval-gated に保つ。repo 内で proposals を生成しない。

### PSD Import UX Polish

- 現在の Import Review preview を screen-design target と照合し、必要なら user-visible preview clarity の不足分を実装する。対象は visible layer/group preview、hidden group gate explanation、issue badge clarity、planned Parts structure review。
- clipping pixel parity、Photoshop compositing parity、semantic recognition、all-layer auto import はこのスコープに含めない。

### Texture Atlas Task v0

- product priority として選ばれた場合、bounded Texture Atlas Task を実装する。対象は visible materialized drawables の deterministic packing、preview、Apply、validator/Product Preflight evidence。
- 既存 package DTOs には texture atlas entries への言及があるが、full atlas packing/UI は現在の product capability ではない。

### Current Capability 文書の更新

- `current-capability-map.md` を refresh または supersede し、Wave54-era baselines を current として主張しない状態にする。
- map staleness が blocking になった場合のみ、専用 docs wave で implementation map descriptions を更新する。この backlog replacement では意図的に maps を編集していない。

## 3. ユーザー判断 / 設計判断が必要なバックログ

- Wave84 後の次の product direction を選ぶ。候補は Viewer/Dynamics hardening、Diagnostics/Evidence UI、Codex/Automation UI、Texture Atlas、PSD Import polish、renderer/pixel maturity。
- disabled Dynamics Groups が Viewer Runtime Controls 内で output parameters を引き続き reserve/exclude すべきかを決める。現在受け入れ済みの挙動では、disabled groups を含め、Dynamics outputs として使われるすべての parameters を除外する。
- Diagnostics / Evidence と Codex / Automation を、専用 views、task surfaces、または現在の React workspace 内の compact panels のどれにするかを決める。
- Texture Atlas v0 を今 user-facing priority にするかを決め、atlas data を project-authored、generated-on-apply、または Apply までの session preview のどれとして扱うかを定義する。
- Variant / Expression Manager を near-term feature にするかを決め、実装前に exclusive/additive semantics を定義する。
- public/demo asset policy を決める。rights-clean public sample assets を許可するか、private/local PSD fixtures を distributable demo material からどう分離するかを定義する。
- archive/filesystem direction を決める。project-defined JSON bundle のみを維持するか、ZIP/archive、File System Access API、directory picker、drag/drop、cloud、cross-profile persistence を追加するかを選ぶ。
- renderer direction を決める。semantic Editor/Viewer rendering と evidence を維持するか、full renderer、standalone viewer、texture sampling correctness、pixel oracle に投資するかを選ぶ。
- Cubism compatibility は、明示的な方向転換がある場合にのみ検討する。現在の product は project-defined であり、Cubism clone ではない。

## 4. 品質 / ドキュメント / テスト負債

- `current-capability-map.md` は stale であり、refresh されるまでは現在の planning truth として扱わない。
- `discussion/design/screen-design/_map.md` には、まだ一部 Wave54-era statements が残っている。design intent として使い、implementation claims は Wave57-Wave84 maps と source で確認する。
- `discussion/implementation/_map.md` は、file table 内でこの backlog をまだ post-Wave80 と説明している。blocking ではないが、docs/map refresh で整理すべき。
- Wave84 では、real Canvas Dynamics smoothness、pointer feel、real rAF cadence に関する browser/manual visual QA は記録されていない。
- Wave84 では persistence/schema files を触っていないため、persistence roundtrip tests は実行していない。将来 persistence-adjacent work では、focused portable bundle/save-load tests を再実行するべき。
- Wave82 performance instrumentation は存在するが、quantified benchmark baseline は記録されていない。
- Wave76 clipping fix は fake-GL proof であり、real WebGL/readPixels pixel proof ではない。
- broad visual/pixel oracle は意図的に存在しない。Playwright coverage は flows には有用だが、layout quality や rendered-image correctness の証明ではない。
- `check:testids:fixtures` は利用可能だが、standard `check` には含まれていない。より広い quality-gate placement は判断事項として残っている。
- 既存の DOM/text test oracles は、structured test-facing/evidence surfaces が存在してから移行するべき。

## 5. 方向転換がない限り明示的に非目標

- Cubism SDK/Core integration、Cubism import/export/load compatibility、`.moc3`、`.model3.json`、`.physics3.json`、Cubism Physics compatibility。
- LLM provider integration、prompt loops、natural-language repair、repo-side proposal generation/ranking、auto-rigging inference、auto-fix、automatic commit、external HTTP/WebSocket/MCP proposal transport。
- PSD all-layer one-click import、recursive group auto import、group-as-artmesh import、semantic recognition、automatic rig proposal placement、Photoshop full compositing parity、blend/effects/color-management parity、persisted source PSD bytes/raw parser objects。
- ZIP/archive/native filesystem/cloud transport、File System Access API、directory picker、drag/drop intake、cross-profile storage guarantees。
- Full renderer、standalone runtime app、texture sampling correctness proof、public render target、pixel-level comparison oracle。
- Dynamics multi-pendulum、multi-output、same-output mixer/blending、frame stepping、output meters/sliders in Viewer、timeline/motion clip playback、external camera/motion input、direct vertex physics、cloth、collision、IK。
- Viewer screenshot/export、Compare/Diff、crop guide、favorite/pinned parameters、authoring operations inside Viewer。
- rights/fixture policy が明示的に受け入れられるまで、public redistributable demo assets は扱わない。

## 6. 推奨する次の計画候補

1. Viewer / Dynamics hardening v1。
   - 理由: Wave84 は runtime playback path を完了した直後であり、manual visual QA、real rAF smoothness、larger-project performance、Viewer が runtime-core drawable snapshots ではなく Editor Canvas projection を使っている点に residual risks を記録している。
   - よい境界: focused browser/manual QA、小さな source/test hardening、runtime/viewer projection unification decision の文書化。新しい Dynamics schema features は避ける。

2. Diagnostics / Evidence React View v0。
   - 理由: Product Preflight、validator、runtime evidence、PSD evidence、Codex-friendly diagnostics は packages に存在するが、targeted source search では Editor rebuild 後の現在の full React human-facing Diagnostics/Evidence view は見つからなかった。
   - よい境界: report summary、diagnostic details、evidence refs、rerun affordance を持つ read-only current-session surface。repair generation は避ける。

3. Texture Atlas Task v0。
   - 理由: editor は PSD 由来の texture-backed drawables を import/draw でき、mesh/deformer/viewer paths を持ち、atlas packing を証明済み範囲外として繰り返し扱っている。Atlas v0 は、Cubism 方針や pixel-oracle 方針を変えずに、asset organization と render readiness を前に進められる。
   - よい境界: visible drawables の deterministic packing、preview/apply、package evidence、validator/Product Preflight diagnostics。

補助候補:

- import review clarity が現在の主な user pain であれば、PSD Import UX polish v1。
- deterministic proposals を扱う operator workflow が human diagnostics より重要であれば、Codex / Automation React View v0。
- stale maps によって planning accuracy が阻害されている場合は、Capability map refresh。

## 7. 根拠リンク

- 実装マップ: [discussion/implementation/_map.md](_map.md)
- オーケストレーションマップ: [discussion/implementation/orchestration/_map.md](orchestration/_map.md)
- Wave84 計画: [discussion/implementation/orchestration/wave84-plan.md](orchestration/wave84-plan.md)
- Wave84 final report: [discussion/implementation/waves/wave84/wave84-final-integration-report.md](waves/wave84/wave84-final-integration-report.md)
- Wave84 final clean review: [discussion/implementation/reviews/wave84/wave84-final-clean-integration-review.md](reviews/wave84/wave84-final-clean-integration-review.md)
- Viewer 画面仕様: [discussion/design/screen-design/screens/viewer-runtime-view.md](../design/screen-design/screens/viewer-runtime-view.md)
- Dynamics Tool 仕様: [discussion/design/screen-design/components/dynamics-tool.md](../design/screen-design/components/dynamics-tool.md)
- 画面設計マップ: [discussion/design/screen-design/_map.md](../design/screen-design/_map.md)
- 履歴用 capability map: [discussion/implementation/current-capability-map.md](current-capability-map.md)
- Viewer source/tests: `apps/editor/src/workspace/viewer/viewer-runtime-screen.tsx`, `apps/editor/src/workspace/viewer/viewer-runtime-playback.ts`, `apps/editor/src/workspace/viewer/runtime-controls-state.ts`, `apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts`, `apps/editor/src/workspace/viewer/runtime-controls-state.test.ts`
- Dynamics source/tests: `apps/editor/src/features/editor-session/model/dynamics-tool-state.ts`, `apps/editor/src/workspace/panels/dynamics-tool-inspector.tsx`, `packages/runtime-core/src/dynamics-evaluation.ts`, `packages/runtime-core/src/parameter-resolution.ts`, `packages/runtime-core/src/runtime-core.ts`
- PSD import source/tests: `apps/editor/src/editor-workflow/browser-psd-parser-adapter.ts`, `apps/editor/src/features/psd-import/model/psd-import-planner.ts`, `apps/editor/src/features/psd-import/model/psd-import-commit.ts`, `apps/editor/src/features/psd-import/model/psd-import-hidden-part-bridge.test.ts`
- Mesh/Rig/Parameter source anchors: `apps/editor/src/features/editor-session/model/mesh-tool-state.ts`, `apps/editor/src/features/editor-session/model/rig-tool-state.ts`, `apps/editor/src/features/editor-session/model/parameter-keyform-state.ts`, `apps/editor/src/workspace/parameter-manager/parameter-manager-screen.tsx`
- Preflight/Codex package anchors: `packages/validator-core/src/product-preflight-report.ts`, `packages/validator-core/src/product-preflight-report-diff.ts`, `packages/validator-core/src/codex-proposal-rerun-validation.ts`, `packages/ai-interface/src/ai-codex-proposal-command.ts`, `packages/ai-interface/src/ai-product-preflight-command.ts`
