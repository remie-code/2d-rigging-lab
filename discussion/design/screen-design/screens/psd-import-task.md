# PSD Import Task 画面仕様

> 状態: Draft screen spec。Wave54 Domains A-H `pass` / Domain H verification `pass` により、PSD Import の workspace-scoped task window route と bounded content polish を反映済み。Wave54 final / Domain J は未完了。

## 1. 役割

PSD Import Taskは、PSD file選択、parse、Import Review、commitを行うtask画面である。

通常workspaceを埋め尽くす常設panelではなく、Authoring Workspace上に重なる大きめのmodalとして扱う。Workspaceを背後に残しつつ、PSD importという一時taskへユーザーの注意を集中させる。

PSD import / structural scaffoldには、人間向けUI、Codex-facing surface、test-facing surface、evidence surfaceの4つの観測面がある。PSD Import Taskは人間向けUIの主画面であり、Codexやtestのためにverboseなdebug情報を常時表示しない。

## 2. Task-Local Flow

```mermaid
stateDiagram-v2
  [*] --> FileNotSelected
  FileNotSelected --> Parsing: PSD file selected
  Parsing --> ParseFailed: parse failed
  ParseFailed --> Cancelled: cancel

  Parsing --> ImportReview: import review ready
  ImportReview --> Imported: import
  Imported --> [*]: return to workspace

  ImportReview --> Cancelled: cancel
  Cancelled --> [*]: return to workspace
```

## 3. Surface分離

PSD Importまわりは次のsurfaceへ分離する。

```text
Human UI
  PSD Import Task

Codex-facing Surface
  deterministic command / operation API

Test-facing Surface
  stable test ids / structured state snapshots

Evidence Surface
  Diagnostics / Evidence View
```

| Surface | 役割 | 置くもの |
|---|---|---|
| Human UI | ユーザーがEditorに何が作られるか、選んだPSDが期待したものか、importしてよいかを判断する。 | 作成予定Parts構造、PSD単体preview、destination summary、行単位issue badge、import / cancel |
| Codex-facing Surface | Codexが人間操作と同等の処理をdeterministic APIで実行する。 | parse / plan / approve / preview / commit / latest result operations |
| Test-facing Surface | E2E / UI testが表示文言やDOM構造に過度依存せず状態を検証する。 | stable `data-testid`、structured state snapshot、status flags、hasIssues |
| Evidence Surface | operationや生成結果の詳細証拠を確認する。 | operation ID、approval ID、plan digest、generated refs、evidence path、raw diagnostics |

## 4. レイアウト

```text
+--------------------------------------------------------------------------------+
| PSD Import Modal Header                                                        |
| selected file (secondary) / destination / issue state / Import / Cancel         |
+-----------------------------------------+--------------------------------------+
| Planned Parts Structure                 | PSD Preview                           |
| Part Container / Drawable / Hidden rows  | selected PSD only                     |
| row-level Issue badge + tooltip          | visible layers preview or placeholder |
| destination context                      | no existing canvas composition        |
+-----------------------------------------+--------------------------------------+
| Footer: Import / Cancel                                                        |
+--------------------------------------------------------------------------------+
```

## 5. Human UIに表示するもの

- 作成予定Parts構造
  - PSD group由来のPart Container
  - PSD leaf layer由来のDrawable
  - hidden layer由来のHidden Drawable
  - group自体はDrawableにしない
- destination summary
  - 初回importまたは選択なし: project root直下
  - part選択中: 選択中part配下
  - drawable選択中: その親part配下
  - 初期UIではdestination pickerを置かず、決定されたdestinationだけを短く表示する
- PSD単体preview
  - 目的は「読み込もうとしているPSDが合っているか」を確認すること
  - 既存Canvas / 既存Parts / import先との合成はしない
  - visible layerだけを対象にした簡易previewを理想形とする
  - hidden layerはpreview上では非表示にする
  - 当面の実装ではplaceholderでよい
- issue表示
  - 問題の有無は二値で扱う
  - 問題のある行に `Issue` badgeを出す
  - 詳細はtooltipに閉じ、画面上に一覧やraw diagnosticsを常時表示しない
- action
  - `Import`
  - `Cancel`

## 6. Human UIに通常表示しないもの

- PSD canvas size
- layer / group / hidden count
- unsupported要素の一覧
- warning count
- choose another file action
- approval digest
- operation ID
- generated ref全文
- PSD node ref全文
- plan digest全文
- materialized bytes詳細
- raw parser payload
- evidence path
- parser内部オブジェクト
- command payload全文
- test selector都合の文字列

これらはDiagnostics / Evidence View、Codex-facing structured surface、test-facing structured surfaceへ分離する。

PSD canvas size、layer / group / hidden count、unsupported要素の詳細は、通常ユーザーの主判断材料にしない。必要な場合も、行単位issue tooltipやDiagnostics / Evidence Viewへ寄せる。

## 7. Codex-facing Surface

Codex-facing Surfaceは、画面上の人間向けtextを読むのではなく、人間操作と同等の処理をdeterministic command / operation APIで実行する。

必要なoperation例:

```text
parsePsdSource(...)
getPsdImportPlan(...)
approvePsdImportPlan(...)
previewStructuralScaffold(...)
commitStructuralScaffold(...)
getLatestImportResult(...)
```

方針:

- CodexはPSD Import Taskに表示されるdebug textへ依存しない。
- Codexは構造的stateとoperation resultを読む。
- 人間向けUIをCodex観測用に過剰表示しない。
- Codex-facing structural command parityは、このsurfaceの充実として扱う。

## 8. Test-facing Surface

Test-facing Surfaceは、E2E / UI testが表示文言やDOM構造へ過度に依存しないための安定した観測面である。

想定するstructured state:

```text
importTask.state = {
  sourceLoaded,
  parseStatus,
  destination,
  importReviewStatus,
  commitEnabled,
  hasIssues
}
```

方針:

- stable `data-testid` は維持してよい。
- ただしtest oracleを人間向けdebug textや巨大DOMへ寄せない。
- approval refsやsubmit disabled状態の同期は、UI textではなくstructured state / status flagsで扱う方向を優先する。

## 9. Evidence Surface

PSD import / structural scaffoldの詳細証拠はDiagnostics / Evidence Viewへ置く。

Evidence Surfaceに置くもの:

- operation ID
- approval ID
- plan digest
- generated refs
- evidence path
- batch result
- raw parser diagnostics
- raw structural scaffold diagnostics
- materialized bytes詳細
- package-relative path

PSD Import Taskからは、必要に応じてDiagnostics / Evidence Viewを開く導線だけを持つ。

## 10. 関連機能ID

- `UX-FEAT-013`
- `UX-FEAT-014`
- `UX-FEAT-015`
- `UX-FEAT-016`
- `UX-FEAT-017`
- `UX-FEAT-018`
- `UX-FEAT-019`

## 11. 注意点

- `UX-FEAT-018` / `UX-FEAT-019` はWave51前の実装ではproduction UIが `data-testid` selectorでapproved refsやsubmit disabled状態を同期していた。
- Wave51 Domain Bで対象の production behavior coupling は local approval binding へ置き換え済み。stable `data-testid` はtest-facing observation hookとして維持されている。
- Wave51 Domain DでPSD Import Task structured observation projectorはpreparedになった。
- Wave52 Domain D/Eで、PSD Import は Empty / Authoring Workspace から Task Shell task として開けるようになり、default では常設の巨大 workspace panel ではなくなった。Generic Task Shell / Task Chrome と PSD Import Task Human UI が接続され、structured observation projector は Task Shell status、compact diagnostics summary、test-facing `data-*` summary へ狭く消費されている。
- Wave52 Domain Eで `psdStructuralInitialStateFocused`、`psdImportPlanCodexFocused`、`psdImportPlanFocused`、`psdMultiLayerBatchFocused`、`psdImportFocused` が pass し、production `data-testid` guard は `check:testids` として standard `check` に統合された。`check:testids:fixtures` は利用可能だが standard `check` には含めない。
- Wave54 A-H で、Generic workspace-scoped Task Window Shell v0、Toolboxからの PSD Import task-window route、Close / Back / Escape の workspace return、PSD-specific content polish、task-window scoped selector helper、`taskWindowRoutingFocused` と既存 PSD focused IDs の pass が記録済みである。
- このtask layoutへの移行は、まだ単なるDOM移動ではない。final task-window/dedicated-view policy、test-facing structured surfaceの完成、Diagnostics / Evidence Viewへの最終導線、mobile task-window routing の登録済み focused gate は後続waveで決める。
- 目指す姿は、PSD Import Taskを巨大なdebug panelにしないこと。Human UIは、作成予定Parts構造、PSD単体preview、行単位Issue badge、Import / Cancelへ絞る。Codex / test / evidenceはそれぞれ専用surfaceへ分離する。
