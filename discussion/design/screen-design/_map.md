# Screen Design Map

> `discussion/design/screen-design/` の入口地図。GUI Editorを中心とする画面設計、画面遷移、主要領域、表示情報分類、人間向けUIとCodex/evidence surface境界を扱う。

## 位置付け

このディレクトリは、特定wave専用ではなく、GUI Editorの画面設計トピックを保持する。

Wave51前のdiscussionをきっかけに作成されたが、内容としてはもっと早い段階で固定しておくべきだった基礎設計である。以後のwave計画では、必要に応じてこのディレクトリをscreen designの正本として参照する。

## ファイル一覧

| Path | Role | Status |
|---|---|---|
| [_map.md](_map.md) | このディレクトリの入口地図 | Active |
| [scope-and-principles.md](scope-and-principles.md) | Editor UX画面設計の目的、非ゴール、問題設定、設計体系、ユーザー判断論点 | Active design basis |
| [overview.md](overview.md) | 画面体系全体、Global UX Flow、画面一覧、機能IDの大まかな配置 | Draft screen design |
| [screens/](screens/_map.md) | 各画面固有のレイアウト、Task-Local Flow、表示情報、非表示情報、関連機能ID | In discussion |
| [components/](components/_map.md) | 複数画面で共有するUI概念、常設領域、共通操作部品 | In discussion |
| [inventories/](inventories/_map.md) | 画面設計の根拠となる現状UI・依存・機能分類の棚卸 | Inventory |

## 現在の焦点

- Editor起動直後は、PSD import画面ではなくauthoring workspaceとして見えるべきである。
- PSD importは通常workspaceから呼び出すtaskであり、Wave54 A-H では workspace-scoped task window v0 として実装・検証済みである。全 tool / view の final modal / task-window / side-panel / dedicated-view policy は未確定である。
- PSD Import / structural scaffoldは、Human UI、Codex-facing surface、test-facing surface、Evidence surfaceを分離する。Human UIはPSD Import Task、Codexはdeterministic command / operation API、testはstable IDs / structured state、evidenceはDiagnostics / Evidence Viewを主に使う。
- Wave51 はこの screen-design 実装負債への最初の基盤整備として final integration `pass` 記録済み。対象は production `data-testid` behavior coupling 除去、minimal Task/View Shell metadata、PSD Import Task structured observation projector、production `data-testid` guard、focused PSD regression preservation に限られる。
- Wave52 final integration report/review は PSD Import Task Migration v0 の bounded implementation baseline として `pass` 記録済み。PSD Import は Empty / Authoring Workspace から Task Shell task として開け、default では常設の巨大 workspace panel ではなくなった。Generic Task Shell / Task Chrome、PSD Import Task Human UI、narrow observation consumption、focused PSD regressions、standard `check` への `check:testids` 統合までが範囲である。
- `check:testids:fixtures` は利用可能だが、standard `check` には含めない。
- Wave53 final integration report/review は Workspace Layout Migration v0 の bounded implementation baseline として `pass` 記録済み。Authoring Workspace v0 skeleton、App Bar / Toolbox / Structure・Parts Tree / Canvas・Preview / Inspector / Parameter Bar / Diagnostics Strip の実配置、Toolbox経由の PSD Import Task entry、desktop/mobile smoke、既存 PSD focused paths、production `data-testid` guard、source/dependency guards の pass 記録を持つ。
- Wave54 Domains A-H reports/reviews と Domain H verification は `pass` 記録済み。workspace-scoped Task Window Shell v0、Toolboxから開く PSD Import task-window route、Diagnostics / Evidence skeleton route、Codex / Automation skeleton route、selector/test-facing scope hardening、`taskWindowRoutingFocused`、desktop/mobile smoke、既存 PSD focused paths、guard pass が記録済みである。Wave54 final / Domain J は未完了である。
- Wave54 A-H 後も、full visual redesign、full panel migration、final modal/task-window/dedicated-view policy、最終的な Diagnostics / Evidence View または Codex / Automation View、Mesh / Atlas / Parameter Manager / Variant UI は未完了である。legacy support panels には旧 evidence/debug/Codex-heavy UI が残る。
- Texture Atlasは専用Task画面として扱う。最低限はvisible drawableをpadding付きで決定的に自動配置し、layout previewをApplyしてからViewer / Runtime確認へ進む。
- Parts Treeはpart / drawable hierarchy、drawable list、draw order、row操作、manual drawable create入口を扱う。`UX-FEAT-010` のdrawable list / layer orderはParts Treeを主ホームにする。
- Dynamicsは専用TaskではなくAuthoring Workspace上のActive Toolとして扱う。Inspectorでgroup / binding / coefficientを編集し、常設の大きなSimulation Controlsは置かず、本格確認はViewer / Runtime Viewへ委譲する。
- Drawable Inspectorは選択中drawableの基本属性を扱う。Draw OrderはParts Tree上で上にあるdrawableほど前面、VisibilityはEditor visibilityとRuntime visibilityを分け、OpacityとClipping / MaskはDrawable Inspector内sectionとして扱う。
- `UX-FEAT-020` / `UX-FEAT-021` は当面Drawable Inspector内のClipping / Mask sectionとSingle Drawable Opacity Keyform sectionで扱い、専用Composition / Opacity Toolは初期画面設計では作らない。
- rig control / deformer配下の要素をparameter値でまとめてfadeさせる場合は、単体drawable opacityではなくRig ToolのSubtree Visibility / Opacity effectとして扱う。
- Parameter Managerはparameter定義、stable id、display name、min/default/max、grouping、usage referenceを専用画面で管理する。Parameter Barはcurrent value操作、Quick Createは軽量作成入口として分ける。
- Variant / Expression Managerは表情差分、パーツ差分、衣装差分のstate setを専用画面で管理する。初期はexclusive setを基本とし、同時適用 / additive setは将来候補として扱う。
- Viewer / Runtime Viewはmodalではなく、Toolbox / App Barから開く専用画面として扱う。編集overlayを出さず、runtime表示、parameter override、warning / diff summaryを確認する。
- 人間向けUI、debug/evidence表示、Codex-facing surface、test-facing surfaceを分離する必要がある。
- `UX-FEAT-001`〜`UX-FEAT-037` の機能IDを、今後の画面仕様議論の参照軸として使う。

## 次の作業候補

1. Diagnostics / Evidence View full migration と Codex / Automation View full migration で、Wave54 skeleton から通常authoring UI外への detail 分離を進める。
2. PSD Import Task の final polish、全task/view向け final modal/task-window/dedicated-view policy、Diagnostics / Evidence への最終導線は後続waveで決める。
3. Texture Atlas Task、Mesh generation/tool、Parameter Manager、Variant / Expression Manager は、置き場所とsurface境界が固まった後の後続waveで扱う。

## 未決事項

- Toolboxの最終配置は、Wave53 v0 では左側配置で実装済みで、Wave54 A-H では PSD Import / Diagnostics / Codex の task-window route が接続済みだが、final visual / accessibility polish としては未確定。
- Tool起動時の最終表現は、Wave54 A-H の workspace-scoped task window v0 を前提にしつつ、modal、task window、side panel、dedicated viewのどれを各tool/viewの基本にするか。
- PSD Import taskは Wave54 A-H では workspace-scoped task window として開く。final polish と全task/view共通の最終policyは未決。
- Product PreflightとCodex/Automationの通常UI上の位置付け。
- 通常UIから外したevidence情報を、どの構造化surfaceに残すか。
- `check:testids:fixtures` を標準 quality gate または CI-only guard path に広げるか。
