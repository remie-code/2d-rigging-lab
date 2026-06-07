# Viewer / Runtime View 画面仕様

> 状態: Draft screen spec。

## 1. 役割

Viewer / Runtime Viewは、authoring previewとは別に、runtime/viewer状態を確認する専用画面である。

この画面は編集用のActive Toolではない。Mesh / Rig / Parameter keyformの作成や編集を行う場所ではなく、コミット済みのproject-defined modelがruntime相当の表示でどのように見えるかを確認する場所である。

Authoring WorkspaceのCanvas / Previewは、selection、mesh overlay、rig draft、uncommitted preview、tool guideを表示する編集用previewである。Viewer / Runtime Viewは、それらの編集overlayを外し、runtime表示、parameter override、runtime diagnostics summaryを確認する。

## 2. 開き方

Viewer / Runtime Viewはmodalではなく、ToolboxまたはApp Barの入口から開く専用View / Screenとして扱う。

基本遷移:

```text
Authoring Workspace
  -> Toolbox / View group / Viewer
  -> Viewer / Runtime View
  -> Back to Authoring
```

想定入口:

- ToolboxのView groupにある `Viewer` button。
- App Bar上のViewer shortcut。既存のViewer buttonがある場合は、専用Viewを開く入口として再定義する。
- Codex-facing command surfaceからの構造的なview open operation。

Viewer / Runtime ViewからAuthoring Workspaceへ戻った場合、可能な限り元のselection、active tool、active parameter contextを保持する。

モーダルを正規導線にしない理由:

- Viewerは短い確認dialogではなく、parameterを動かしながらruntime表示、warning、diff summaryを見る作業文脈である。
- Canvasを広く使う必要があり、中央を塞ぐmodalはruntime確認に向かない。
- 画面としてAuthoringから切り替えることで、通常UIの情報過多を避けられる。

将来Quick Previewが必要な場合は、別途floating / temporary previewとして扱う。正規のViewer / Runtime確認は、この専用画面を基準にする。

## 3. 画面配置

```text
+--------------------------------------------------------------------------------+
| Viewer Header                                                                  |
| model / runtime source / override state / reset / back to authoring             |
+----------------------------------+---------------------------------------------+
| Runtime Preview Canvas           | Viewer Controls                             |
|                                  |                                             |
| clean runtime-like model preview | parameter search / groups                   |
| no authoring overlays            | parameter sliders                           |
| committed model state            | reset all / reset selected                  |
| session parameter overrides      | representative positions / snapshots        |
| expression / variant visibility  | visible parts / drawables summary           |
|                                  | runtime diff / warning summary              |
+----------------------------------+---------------------------------------------+
| Runtime Check Strip: warnings / diff summary / open Diagnostics / Evidence      |
+--------------------------------------------------------------------------------+
```

主領域:

| 領域 | 役割 |
|---|---|
| Viewer Header | 対象model、runtime source、parameter override状態、reset、Authoringへ戻る導線を表示する。 |
| Runtime Preview Canvas | 編集overlayを出さず、runtime相当のclean previewを表示する。 |
| Viewer Controls | runtime確認用のparameter操作、表示状態確認、reset、代表姿勢確認、warning summaryを扱う。 |
| Runtime Check Strip | blocking / warning / diff summaryだけを表示し、詳細はDiagnostics / Evidence Viewへ委譲する。 |

## 4. Viewer Controls

Viewer Controlsは、runtime確認に必要な操作だけを集約する。

表示するもの:

- parameter search
- parameter group / category filter
- parameter sliders
- reset all
- reset selected
- defaultへ戻す
- representative positions / snapshots
- current override summary
- visible parts / drawables summary
- runtime snapshot summary
- runtime diff summary
- validation diagnostics summary
- part/drawable/mesh/mask/rig/dynamicsのruntime確認に必要な最小情報

Viewer Controlsでのparameter操作は、基本的にsession-only overrideとして扱う。Authoring用のkeyform追加や編集は行わない。

## 5. 表示状態

| State | 内容 |
|---|---|
| Clean Runtime Preview | overrideなしで現在のcommitted modelを表示する。 |
| Parameter Override Active | Viewer内で一時的にparameter値を動かしてruntime表示を確認している。 |
| Runtime Warning | validation / runtime diff / package stateにwarningがある。詳細はDiagnostics / Evidence Viewへ送る。 |
| Compare / Diff | authoring stateまたはruntime snapshotとの差分summaryを確認する。 |

## 6. 他UIとの関係

| UI | Viewer / Runtime Viewとの違い |
|---|---|
| Authoring Workspace Canvas / Preview | 編集overlay、tool draft、selection guideを出す編集用preview。 |
| Parameter Bar | 1つのactive parameterをauthoringする常設UI。 |
| Parameter Control Palette | Authoring中に全parameterを軽く動かして確認する非モーダルpalette。 |
| Viewer / Runtime View | 編集overlayなしでruntime表示、parameter override、warning / diff summaryを確認する専用画面。 |
| Diagnostics / Evidence View | raw evidence、operation log、artifact path、validation report detailsを確認する詳細view。 |

## 7. 通常表示しないもの

- runtime state artifact path全文
- sequence artifact path全文
- validation report path全文
- raw runtime evidence
- operation ID
- generated refs
- machine-readable payload全文

これらは通常UIの視認性を悪化させるため、Diagnostics / Evidence ViewまたはCodex-facing structured surfaceへ分離する。

## 8. 関連機能ID

- `UX-FEAT-007`
- 一部 `UX-FEAT-020`〜`UX-FEAT-025`
- 一部 `UX-FEAT-034`

## 9. 未決事項

- Viewer Controlsのparameter group / category分類方法。
- representative positions / snapshots の最小セット。
- Compare / Diffを初期仕様に含めるか、後続拡張に回すか。
- runtime sourceの表示粒度。通常UIではsummaryに留め、詳細はDiagnostics / Evidence Viewへ委譲する方針を維持する。
