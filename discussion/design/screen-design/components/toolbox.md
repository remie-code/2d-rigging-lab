# Toolbox コンポーネント仕様

> 状態: Draft component spec。

## 1. 役割

Toolboxは、Authoring Workspace上でユーザーが次に行う作業モード、task、補助viewを起動・切り替える常設launcherである。

Toolbox自体は作業UI本体ではない。具体的な操作UIは、Active Toolとcurrent selectionに応じてInspector / Tool Panelへ表示する。

## 2. 基本形

- icon buttonを縦または横に並べる。
- 各buttonはicon、tooltip、accessible name、active/disabled/badge状態を持つ。
- 通常状態ではtext labelを常時表示しない。
- expanded modeやアクセシビリティ設定ではlabel表示を許可する。
- icon button同士は、性質ごとに視覚的な区切りを置く。

```text
+----------+
| Select   |  Active tool
| Mesh     |  Active tool
| Rig      |  Active tool
|----------|
| Import   |  Task
| Storage  |  Task
| Validate |  Task
|----------|
| Viewer   |  View
| Evidence |  View
| Codex    |  View
+----------+
```

## 3. 種別

| 種別 | 役割 | 起動後の主な表示先 | 例 |
|---|---|---|---|
| Active Tool | workspace内の作業モードを切り替える | Canvas / Inspector / Tool Panel | Select, Mesh, Rig |
| Task | まとまった作業画面を開く | Task window / task view | Import, Storage, Validate |
| View | 補助情報や別視点を開く | Drawer / side view / dedicated view | Viewer, Diagnostics, Codex |

Viewerは専用画面として開く。Diagnostics / Codexは、情報量や作業文脈に応じてdrawer / side view / dedicated viewのいずれかを後続議論で決める。

## 4. Icon Policy

採用候補は `lucide` icons とする。MUIのような総合UIライブラリは、現時点では採用しない。

理由:

- 現行Editorはvanilla TypeScript / Vite構成であり、React前提のUIフレームワークを追加する理由がまだない。
- `lucide` はframework-agnosticなSVG iconとして扱いやすい。
- native button、CSS tooltip、ARIA属性と組み合わせれば、Toolboxに必要な表現を満たせる。
- アイコンだけを導入し、layout/component frameworkの判断を後続waveへ持ち越せる。

実装時の想定:

- packageは `lucide` を第一候補にする。
- buttonはEditor側の既存DOM/CSS設計に合わせて実装する。
- tooltipはnative `title` だけに依存せず、hover/focus両対応のtooltip componentを用意する。
- 各buttonは `aria-label`、`aria-pressed` または `aria-expanded`、disabled reasonを持つ。

## 5. Icon Set Draft

| Item | 種別 | Icon候補 | Tooltip |
|---|---|---|---|
| Select | Active Tool | `MousePointer2` | Select |
| Mesh | Active Tool | `Triangle` | Mesh tools |
| Rig | Active Tool | `Spline` | Rig tools |
| Import PSD | Task | `FileInput` | Import PSD |
| Storage | Task | `FolderOpen` | Project storage |
| Validate | Task | `ShieldCheck` | Product Preflight |
| Viewer | View | `Eye` | Viewer / Runtime |
| Diagnostics | View | `Activity` | Diagnostics / Evidence |
| Codex | View | `Bot` | Codex / Automation |

Icon候補は最終実装時に利用可能な `lucide` icon名へ調整してよい。ただし、性質ごとの分類とtooltip文言はこの仕様を基準にする。

## 6. Selectionとの関係

- Mesh toolは、drawable選択中ならそのdrawableのmesh操作をInspector / Tool Panelへ表示する。
- Mesh toolがactiveでdrawable未選択なら、Parts TreeまたはCanvasでdrawable選択を促すempty tool stateを表示する。
- Rig toolは、partまたはdrawable選択中ならdeformer/parenting/parameter/keyform操作をInspector / Tool Panelへ表示する。
- Select toolは、Parts TreeとCanvasのselectionを主操作にする。

## 7. 未決事項

- Toolboxを左端固定にするか、上部toolbarにするか。
- label expanded modeを常時提供するか、将来のaccessibility preferenceに回すか。
- Task itemをmodal、task window、dedicated task viewのどれで開くか。
- Diagnostics / Codex viewをdrawerにするか、dedicated viewにするか。
