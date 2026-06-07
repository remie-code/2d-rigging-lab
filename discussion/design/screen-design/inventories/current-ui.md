# Editor UX 現状UI棚卸

> 状態: Inventory。UX方向性の決定ではない。

## 1. 調査目的

Editor UXの画面仕様を議論する前提として、現在のEditor UIに「何が表示され、どの操作入口があり、どの情報が人間向けUI・debug/evidence・test/Codex-facing surfaceとして混在しているか」を事実ベースで棚卸する。

この文書は画面仕様案ではない。レイアウト変更、画面遷移、情報の削除・移動、テスト更新方針はここでは決めない。

Wave51後の読み方: この棚卸の production `data-testid` coupling 記述は Wave51 前の事実として扱う。Wave51 Domain B で PSD import-plan / structural scaffold の対象 coupling は除去済みだが、巨大1ページ構造、可視DOM/text oracle、Evidence / Codex surface混在の大半は後続waveの負債として残る。

## 2. 調査したファイル / 根拠

Basis:

- `discussion/design/screen-design/scope-and-principles.md`
- `discussion/design/_map.md`
- `discussion/_conventions.md`
- `discussion/design/mvp-authoring-runtime/02-gui-editor-screen-spec.md`
- `discussion/design/codex-friendly-automation-policy.md`
- `discussion/implementation/current-capability-map.md`

Editor UI:

- `apps/editor/src/main.ts`
- `apps/editor/src/app/editor-app.ts`
- `apps/editor/src/ui/app-shell/app-shell.ts`
- `apps/editor/src/styles/editor.css`
- `apps/editor/src/ui/**` の主要panel/component
- `apps/editor/src/ai-command-host/**`
- `apps/editor/src/editor-state/editor-test-ids.ts`

E2E / test-facing:

- `apps/editor/e2e/test-ids.mjs`
- `apps/editor/e2e/*.mjs` の `data-testid` / `textContent` / `aria-label` 参照
- `apps/editor/src/**/*.test.ts` のUI text/test id参照の一部

Wave48-Wave50関連:

- `discussion/reports/wave48-domain-d-editor-ui-explicit-import-plan.md`
- `discussion/reports/wave49-domain-d-editor-ui-arbitrary-leaf-import.md`
- `discussion/reports/wave50-domain-d-editor-ui-structural-scaffold.md`
- `discussion/reports/wave50-domain-e-codex-structural-read-surface.md`
- `discussion/reports/wave50-domain-g-structural-e2e.md`
- `discussion/reports/wave50-final-integration.md`

## 3. 現在の主要画面領域

### 実装上の大枠

現在のEditorは `apps/editor/src/main.ts` から `mountEditorApp` を起動し、`apps/editor/src/app/editor-app.ts` が `createEditorWorkflowController` と `createEditorAppShell` を接続している。`createEditorAppShell` は単一の `<main class="editor-shell" data-testid="editor.shell">` と単一の `<section class="editor-workspace">` を作り、そこに多数のpanelを直接appendしている。

`apps/editor/src/styles/editor.css` では `.editor-workspace` が2カラムgridで、複数のpanelが `grid-column: 1 / -1` の全幅領域として配置される。確認した範囲では、router、明示的な画面遷移、タブ式のview切替、drawer/modalとしての情報隔離は中心構造になっていない。例外としてViewer / Runtime panelはapp barのボタンで開閉される。

### 現在appendされる主な領域

| 領域 | 現在の役割 / 表示内容 |
| --- | --- |
| App bar | `2D Rigging Editor`、workflow status、package display / package ID / revision、Viewer / Runtime開閉 |
| Parameters | parameter一覧、件数、parameter作成form、operation状態 |
| Preview | SVG preview、snapshot/drawables/parts/layer/mesh/sample/texture/diagnostics/diff summary、parameter slider |
| Tutorial Workflow | tutorial mini model作成・小編集の導線、recipe/readiness/non-goals/evidence target/steps |
| Viewer / Runtime | 開いている時だけ表示。runtime snapshot/diff、validation diagnostics、parameter values、rig/mask/part/drawable/mesh/dynamics evidence、viewer slider |
| Composition / Mask / Opacity | mask relation、opacity keyform作成、runtime evidence、operation diagnostics |
| Project-defined Rig Controls | rotation/warp lattice/bind/keyform作成、control一覧、runtime evidence、operation diagnostics |
| Dynamics | dynamics group作成・更新、preview実行/reset、computed output、evidence、validator diagnostics |
| Layer Tree | part/drawable構造、part作成/更新、drawable part・texture割当、direct draft、select/lock/editor-hidden/runtime visibility/order |
| Drawable Authoring | drawable作成、drawable list、mesh canvas、mesh topology、mesh vertex、UV/texture/layer状態 |
| Source Intake | source mode、file/layer/placement/rights/provenance入力、imported sources、source profile/binary/profile evidence |
| PSD Import | PSD parse、selected layer intake、import-plan preview/approval/batch、structural scaffold preview/approval/commit、layer tree、diagnostics |
| Project Storage | save/load/reset、portable JSON export/import、transport capabilities、storage status |
| Product Preflight | preflight実行、summary、category、blocking/warning/not supported/not evaluated、comparison/diff |
| Codex Proposal Review | pasted proposal review、validation/diff/preflight、approval、commit |
| AI Approval | dry-run、approval/rejection、commit、latest event |
| AI Transcript | command/approval event transcript |
| Operation / Evidence / Package / Reload | operation log、generated evidence、package file set、reload summary |

## 4. 現在の機能入口

### 人間向けUI上の入口

- parameter作成、preview slider操作、reset。
- drawable作成、mesh canvas編集、mesh topology/vertex/UV関連操作。
- part作成・更新、drawableのpart/texture割当、layer tree direct draft、select/lock/editor-hidden/runtime visibility/order。
- source intakeのfile/layer/placement/rights/provenance入力。
- PSD parse、selected layer intake、selected leaf batch intake。
- import-plan preview、approved leaf selection、approved leaf batch execution。
- structural scaffold preview、approved structural scaffold commit。
- project save/load/reset、portable JSON export/import。
- Product Preflight実行、preflight comparison/diff確認。
- Codex proposal JSON貼り付け、review、approval、commit。
- AI dry-run、approve/reject、commit、transcript確認。
- tutorial mini model作成、小編集適用。
- Viewer / Runtime開閉、viewer parameter slider、runtime evidence確認。
- composition mask/opacity、rig control、dynamics関連の作成・更新・preview。

### Codex / machine-facing command host上の入口

`apps/editor/src/ai-command-host/editor-ai-command-host.ts` にはDOMとは別の構造化command surfaceがある。確認できたcommandは以下。

- `getEditorState`
- `inspectModel`
- `inspectTarget`
- `validatePackage`
- `getOperationLog`
- `getPsdImportPlanState`
- `setPsdImportPlanApproval`
- `preflightPsdImportPlanIntake`
- `executePsdImportPlanIntake`
- `dryRunOperation`
- `commitOperation`

`getPsdImportPlanState` はWave50時点でstructural scaffoldのread projectionを含む。一方、Wave50 final reportでは「structural-specific Codex execute/stale commandはまだない」と整理されている。

## 5. 現在表示される情報カテゴリ

### 人間向け操作情報

主に各panel内のbutton、form、input、textarea、checkbox、select、slider、status textとして表示されている。

例:

- create parameter / create drawable / create part。
- PSD parse、preview更新、approved leaf追加、structural scaffold preview/commit。
- save/load/reset、export/import。
- run preflight、proposal review、approval/commit。
- viewer slider、mesh編集、layer visibility/order/lock/select。

### 人間向け状態表示

作業対象の状態を把握するための情報も多く表示されている。

例:

- package display、package ID、revision。
- parameter/drawable/part/source/layer counts。
- preview visual、runtime visibility、selected/locked/editor-hidden状態。
- imported source一覧、source mode、source profile、rights/provenance。
- preflight pass/warn/fail/not supported/not evaluated counts。
- dynamics computed output、rig/compositionの現在定義。

### debug / evidence / diagnosticに見える詳細

通常の操作理解よりも、検証・再現・証跡確認に近い情報が可視UIへ出ている。

例:

- operation ID、operation type、surface、timestamp、target IDs。
- evidence ID、runtime snapshot ID、state file / sequence file / validation report path。
- validation check ID、diagnostic ID、severity/status/target。
- PSD source refs、node refs、generated refs、candidate digest、approval ID、selection digest、batch evidence ID。
- runtime snapshot/diff、mesh hash、texture/sample/path、persistent byte restore detail。
- transport capability detail、unsupported / not evaluated detail。

### machine-readable / test-facingに見える情報

DOMには広範囲に `data-testid` が付与され、E2E側の `apps/editor/e2e/test-ids.mjs` には多くのID mirrorがある。さらに、可視text内にstable ID、generated ID、operation ID、diagnostic/check ID、file path、evidence refが出ているため、test oracleとしても使われている可能性が高い。

ただし、Codex-facing surfaceについては `apps/editor/src/ai-command-host/**` に構造化APIがあり、外部Codexが可視DOM textへ依存しているとは、この棚卸だけでは断定できない。

## 6. 情報過多・巨大1ページ化に関係する事実

確認できた構造的事実:

- `createEditorAppShell` が単一workspaceへ多数のpanelを直接appendしている。
- Viewer / Runtime以外の主要panelは、確認範囲では常時DOMに並ぶ構造になっている。
- `editor.css` のgridは2カラムだが、Source Intake、PSD Import、Project Storage、Product Preflight、persistence/evidence gridなどは全幅配置で、縦方向に大きく伸びる。
- PSD Import panelは、parse、selected layer intake、import-plan、leaf approval、batch result、structural scaffold、layer tree、diagnosticsを1panel内に持つ。
- Operation log、Generated evidence、Package file set、Reload summaryが通常workspace内に表示され、debug/evidence情報が一般操作panelと同じ階層にある。
- Product Preflight、Codex Proposal Review、AI Approval、AI Transcriptも同じworkspaceに並び、authoring操作と検証・承認・transcriptが同一ページ内で混在している。
- `mvp-authoring-runtime/02-gui-editor-screen-spec.md` には左project panel、中央canvas、右inspector、下部parameter/keyform、diagnostics drawer、viewer/runtime tab、AI/report tabのような画面構成案があるが、現在実装はその分離構造にはまだなっていない。

事実からの推測:

- 「巨大1ページ」に見える主因は、機能数の多さだけではなく、操作、状態、evidence、diagnostic、machine/test-facing refsが同じ可視workspaceへ同時に並ぶ実装構造にある可能性が高い。

## 7. Codex / test / evidence surface と可視UIの依存可能性

### 確認できたこと

- E2Eは `apps/editor/e2e/test-ids.mjs` のtest id mirrorを広く使っている。
- 多数のE2Eが `textContent` を読んで、panel text、summary text、`dt`/`dd` のfact、button/label text、禁止文言/期待文言を検証している。
- `aria-label`、`aria-labelledby`、button text、heading textに依存するE2Eもある。
- UI unit/component testにも `findByTestId(...).textContent.toContain(...)` 型の検証がある。
- Wave51前の `apps/editor/src/ui/explicit-psd-import/explicit-psd-import-panel.ts` はpanel内部で `data-testid` をqueryして、approved refs textareaやsubmit disabled状態を同期していた。これはtestだけでなくcomponent内部ロジックのtest-id依存として確認された。Wave51 Domain Bで対象箇所は local approval binding へ置き換え済み。
- Codex command hostはDOMとは別に構造化APIを持つ。PSD import-plan/structural scaffold read projectionもこのsurfaceにある。

具体例:

- PSD import系E2EはPSD panel内のfile name、result string、approved count、forbidden positive claims、`dt`/`dd` factsを確認する。
- Product Preflight系E2Eはsummary facts、blocking/warning/not supported/not evaluated、禁止文言をDOM textで確認する。
- Viewer Runtime系E2Eはsnapshot/diff/parameter value textを確認する。
- Operation log系の検証では `dt` textが `Entries` の行を探す例がある。
- Codex Proposal Review系E2Eはtextareaの `aria-label`、panel text、validation/diff/preflight/approval状態を確認する。

### 疑いとして残ること

- 現在の可視evidence textの一部は、人間向け表示というよりE2E oracleとしての役割が強い可能性がある。
- 画面分割や情報のdrawer化を行う場合、test idを維持しても、`textContent` の探索範囲や可視性、aria labelが変わるとE2E更新が必要になる可能性が高い。
- Codex proposal review / AI approval / evidence panelsは、human-facing UXとmachine/evidence-facing surfaceの境界が曖昧になっている可能性がある。

### 未確認

- 外部のCodex実行環境が可視DOM textを直接読む運用があるかは未確認。
- screenshot/visual regression系の依存は、この棚卸では深追いしていない。
- すべてのunit testとE2Eを網羅して、どの文字列が仕様固定かを分類したわけではない。

## 8. 未確認・不確実な点

- 実際のブラウザ表示・スクリーンショットによる視覚密度確認はしていない。構造上の棚卸であり、見た目の最終判断ではない。
- `apps/editor/src/ui/**` の全componentを行単位で網羅したわけではない。主要panelと入口・表示情報の把握に絞った。
- Wave48-Wave50 reportsはEditor/UI/e2e理解に必要なものだけ読んだ。全report横断ではない。
- `editor-test-ids.ts`、component-local test ids、E2E mirrorの差分は完全監査していない。
- 現在の `mvp-authoring-runtime/02-gui-editor-screen-spec.md` は既存の意図・案として参照したが、現実装との差分をWave51でどう扱うかは未決定。
- Wave51 Domain Cで minimal shell surface metadata は追加されたが、router、tab、drawer、modal、final toolbox、full panel migration は未実装である。
- Wave51 Domain Dで PSD Import Task structured observation projector は追加されたが、UI / E2E / Codex-facing read API からはまだ使っていない。
- どのdebug/evidence情報を通常UIから隠すべきか、または残すべきかは未決定。

## 9. 次にユーザーと議論すべき論点

- Wave51後の次waveで決める「主要画面/view」は、既存の巨大workspaceを整理するだけか、明確な画面遷移・tab・drawerを導入する前提か。
- 初期表示に必ず置くべき人間向け中核情報は何か。候補はcanvas/preview、parts tree、inspector、parameters、最小diagnostics。
- Operation log、Generated evidence、Package file set、runtime snapshot/diff、validation check IDs、PSD refs/digestsを通常UIから分離するか。
- PSD Import / import-plan / structural scaffoldは、通常authoring画面のpanelなのか、専用import workflow画面なのか。
- Product Preflight、Codex Proposal Review、AI Approval、AI Transcriptをどの階層に置くか。常時表示、drawer、diagnostics/evidence view、またはCodex-facing専用viewのどれに近いか。
- Viewer / Runtimeをauthoring previewと同列にするか、別view/tabとして扱うか。
- E2Eの互換方針。既存test idを極力維持するのか、構造化helperや非可視evidence surfaceへ移すのか。
- Codex-facing structural command parityは後続screen-design waveの範囲外に置くか、画面仕様上の境界だけ明示するか。
- semantic recognition、auto-rigging、suggestion UIは既存方針どおり非ゴールとして明示し続けるか。
