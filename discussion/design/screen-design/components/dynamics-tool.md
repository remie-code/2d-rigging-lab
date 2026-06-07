# Dynamics Tool コンポーネント仕様

> 状態: Draft component spec。Physics / Dynamics authoringの画面上の役割を定義する。

## 1. 役割

Dynamics Toolは、Authoring Workspace上でdynamics group、input parameter、output binding、係数を編集するActive Toolである。

このtoolは、物理演算や揺れもの設定を自動生成・提案するためのUIではない。ユーザーまたはCodexが明示的に選んだtarget、parameter、binding、coefficientを編集するためのUIである。

Viewer / Runtime Viewは作成済みdynamicsをruntime相当で確認する場所であり、Dynamics Toolはdynamics設定を作る場所である。

## 2. 基本方針

- DynamicsはTexture Atlasのような専用Task画面ではなく、Mesh / Rigに近いActive Toolとして扱う。
- ToolboxのActive Tool groupから起動する。
- Parts TreeまたはCanvasで対象part / drawable / rig control / parameterを選び、InspectorをDynamics編集UIへ切り替える。
- Canvasには、選択中dynamics groupの影響範囲、出力方向、簡易preview overlayを表示する。
- 常設の大きなSimulation Controlsは置かない。
- 本格的な時間再生、複数parameter操作、runtime相当確認はViewer / Runtime Viewへ委譲する。

## 3. 起動と配置

基本フロー:

```text
Authoring Workspace
  -> Parts Tree / Canvasで対象を選ぶ
  -> Toolbox / Active Tool / Dynamics
  -> Dynamics Inspectorでgroup / binding / coefficientを編集
  -> Canvasで簡易preview overlayを確認
  -> Apply / Update Dynamics
  -> Open in Viewerでruntime相当確認
```

画面上の配置:

```text
+----------+---------------------+-----------------------+----------------------+
| Toolbox  | Structure / Parts   | Canvas / Preview      | Dynamics Inspector   |
|          |                     |                       |                      |
| Dynamics | target parts        | selected target       | dynamics group       |
|          | rig controls        | influence overlay     | input parameter      |
|          | output candidates   | output direction      | output bindings      |
|          |                     | lightweight preview   | coefficients         |
|          |                     |                       | preview sample       |
+----------+---------------------+-----------------------+----------------------+
| Parameter Bar: active input parameter / current value / key markers             |
+--------------------------------------------------------------------------------+
| Diagnostics Strip: unstable / missing binding / invalid output summary          |
+--------------------------------------------------------------------------------+
```

## 4. Dynamics Inspector

Dynamics Inspectorに置くもの:

- dynamics group create / select / rename
- enabled / display summary
- input parameter
- output target / output parameter / output binding
- stiffness
- damping
- delay
- max velocity
- amplitude
- gravity / wind / external force settings
- reset policy
- lightweight preview sample
- reset sample
- Open in Viewer
- binding / stability warning

Dynamics Inspectorに置かないもの:

- 全frameのsimulation trace
- raw computed output table
- operation ID
- evidence path
- validator payload全文
- runtime snapshot / diff全文

これらはDiagnostics / Evidence View、またはViewer / Runtime Viewのsummaryから掘る詳細として扱う。

## 5. Preview方針

Dynamics Toolでは、常設のSimulation Controlsを置かない。

理由:

- Dynamics Toolの主責務は、dynamics groupとbindingを編集することである。
- 時間再生や複数parameterの動作確認はViewer / Runtime Viewの責務と重なる。
- Authoring Workspaceに大きなsimulation操作UIを置くと、Mesh / Rig / Parameter UIと競合して情報過多になりやすい。

Dynamics Toolに置くpreviewは、Inspector内の軽い確認UIに留める。

```text
Dynamics Inspector
  Preview
    sample input value
    reset sample
    open in viewer
```

Canvasには次を表示してよい。

- 選択中dynamics groupの影響対象
- output direction / magnitudeの簡易表示
- current sample valueに対する軽いpreview overlay
- warning state

本格確認はViewer / Runtime Viewで行う。

## 6. Parameter UIとの関係

Dynamics ToolはParameter Barと協調する。

- Parameter Barはactive input parameterとcurrent valueを扱う。
- Dynamics Inspectorは、どのdynamics groupがどのinput / outputにbindされるかを扱う。
- Parameter Control Paletteは、複数parameterを軽く動かす確認に使ってよい。
- runtime相当の連続確認、複数parameter操作、全体表示はViewer / Runtime Viewへ送る。

## 7. Tool State

| State | 内容 |
|---|---|
| No Target | 対象part / drawable / rig control / parameterの選択を促す。 |
| New Group Draft | dynamics groupを未確定で作成中。 |
| Editing Group | 既存dynamics groupのinput / output / coefficientを編集している。 |
| Lightweight Preview | sample input valueに対する簡易previewをCanvasへ表示する。 |
| Invalid Binding | input / output / target不足、cycle、未解決参照などでApply不可。 |
| Ready for Viewer | 設定は有効で、Open in Viewerからruntime確認へ進める。 |

## 8. 他UIとの関係

| UI | Dynamics Toolとの関係 |
|---|---|
| Rig Tool | rig controlやdeformation targetがdynamics output候補になる。 |
| Parameter / Keyform | active input parameterとcurrent valueを共有する。 |
| Texture Atlas Task | dynamics設定とは直接関係しないが、runtime表示前のasset準備として後続に置かれやすい。 |
| Viewer / Runtime View | dynamicsの本格的なruntime確認、時間再生、複数parameter操作を行う。 |
| Product Preflight | missing binding、unstable setting、invalid outputをblocking / warningとして扱う。 |
| Diagnostics / Evidence View | computed output、validator detail、operation evidenceを必要時に確認する。 |

## 9. 関連機能ID

- `UX-FEAT-024`: Dynamics group authoring / update
- `UX-FEAT-025`: Dynamics preview / computed output / diagnostics
- 一部 `UX-FEAT-007`: Viewer / Runtime surface
- 一部 `UX-FEAT-020`〜`UX-FEAT-023`: composition / rig targetとの関係
- 一部 `UX-FEAT-028` / `UX-FEAT-029`: Product Preflight / validation

## 10. 未決事項

- 初期UIで扱うcoefficientの最小セット。
- output targetをrig control、parameter、drawable propertyのどこまで許可するか。
- lightweight previewでどこまでcomputed outputを表示するか。
- Parameter Control PaletteとDynamics preview sampleの値共有ルール。
- `Open in Viewer` 時にDynamics Toolの選択状態をViewerへ渡すか。
