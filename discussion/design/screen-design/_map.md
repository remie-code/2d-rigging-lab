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
- PSD importは通常workspaceから呼び出すtaskであり、常設の巨大panelではなくtask window / modal / dedicated task panelとして扱う方向が有力である。
- Viewer / Runtime Viewはmodalではなく、Toolbox / App Barから開く専用画面として扱う。編集overlayを出さず、runtime表示、parameter override、warning / diff summaryを確認する。
- 人間向けUI、debug/evidence表示、Codex-facing surface、test-facing surfaceを分離する必要がある。
- `UX-FEAT-001`〜`UX-FEAT-037` の機能IDを、今後の画面仕様議論の参照軸として使う。

## 次の作業候補

1. [overview.md](overview.md) のGlobal UX Flowと画面一覧をユーザーと確認する。
2. PSD Import Task layout案をユーザーと確認する。
3. Diagnostics / Evidence View と Codex / Automation View の分離方針を確認する。
4. `UX-FEAT-018` / `UX-FEAT-019` のproduction `data-testid` couplingを、Wave51計画前提に含めるか確認する。

## 未決事項

- Toolboxは左端固定か、上部toolbarか。
- Tool起動時の表現はmodal、task window、side panel、dedicated viewのどれを基本にするか。
- PSD Import taskはmodalとしてworkspace上に重ねるか、dedicated task viewとして表示するか。
- Product PreflightとCodex/Automationの通常UI上の位置付け。
- 通常UIから外したevidence情報を、どの構造化surfaceに残すか。
