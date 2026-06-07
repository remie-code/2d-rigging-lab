# Editor UX Codex/test/evidence 依存棚卸

> 状態: Inventory。UX方向性やテスト更新方針の決定ではない。

## 1. 調査目的

Editor UX画面仕様discussionに向けて、現在の可視UIが E2E / UI tests / Codex-facing surface / evidence surface にどの程度依存されているかを分類する。

この文書は、画面仕様、レイアウト改善、テスト修正方針、Codex-facing command parity の実装計画を決めない。どの表示を仕様として守るべきかも、ここでは判断しない。

Wave52後の読み方: production `data-testid` coupling に関する記述は Wave51 前の棚卸事実として扱う。Wave51 Domain Bで PSD import-plan / structural scaffold の対象 coupling は除去済みで、Wave51 Domain Eで再導入防止のguardが追加された。Wave52 Domain Eで production guard は `check:testids` として standard `check` に統合済みで、`check:testids:fixtures` は利用可能だが standard `check` には含めない。PSD Import は Wave52 Domain D/E で Task Shell task として到達可能になり、default では常設の巨大 workspace panel ではなくなった。ただし可視DOM/text oracle、Product Preflight current read、structural-specific execute/stale parity、final Diagnostics / Evidence View migration は未解決である。

## 2. 調査したファイル / 根拠

Basis:

- `discussion/_conventions.md`
- `discussion/design/_map.md`
- `discussion/design/screen-design/scope-and-principles.md`
- `discussion/design/screen-design/inventories/current-ui.md`
- `discussion/design/codex-friendly-automation-policy.md`
- `discussion/development_convention/e2e-test-policy.md`

E2E / test-facing:

- `apps/editor/e2e/test-ids.mjs`
- `apps/editor/e2e/*.mjs`
- `apps/editor/src/editor-state/editor-test-ids.ts`
- `apps/editor/src/ui/**/*.test.ts`
- `apps/editor/src/app/app-shell.test.ts`
- `apps/editor/src/editor-workflow/**/*.test.ts` のうち Product Preflight / PSD import / Codex proposal / workflow state 表示に関係する箇所

Codex-facing / AI interface:

- `apps/editor/src/ai-command-host/editor-ai-command-host.ts`
- `apps/editor/src/ai-command-host/editor-ai-psd-import-plan-projector.ts`
- `apps/editor/src/ai-command-host/*.test.ts`
- `apps/editor/src/editor-workflow/workflow-controller.ts`
- `packages/ai-interface/src/ai-read-command.ts`
- `packages/ai-interface/src/ai-psd-import-plan-command.ts`
- `packages/ai-interface/src/ai-product-preflight-command.ts`
- `packages/ai-interface/src/ai-product-preflight-observation.ts`
- `packages/ai-interface/src/**/*.test.ts` のAI command / product preflight / proposal関連

UI / evidence 表示:

- `apps/editor/src/ui/app-shell/app-shell.ts`
- `apps/editor/src/ui/evidence-panel/*`
- `apps/editor/src/ui/package-file-set/*`
- `apps/editor/src/ui/explicit-psd-import/explicit-psd-import-panel.ts`
- `apps/editor/src/ui/product-preflight/*`
- `apps/editor/src/ui/codex-proposal-review/*`
- `apps/editor/src/ui/ai-approval/*`
- `apps/editor/src/ui/ai-transcript/*`
- `apps/editor/src/ui/viewer-runtime/*`
- `apps/editor/src/ui/rig-control-panel/*`
- `apps/editor/src/ui/composition-panel/*`
- `apps/editor/src/ui/dynamics-panel/*`
- `apps/editor/src/ui/source-assets/*`

Wave48-Wave50補助根拠:

- `discussion/implementation/waves/wave48/wave48-domain-d-editor-import-plan-preview-explicit-approval-ux-report.md`
- `discussion/implementation/waves/wave49/wave49-domain-c-codex-facing-import-plan-command-surface-report.md`
- `discussion/implementation/waves/wave49/wave49-domain-f-focused-e2e-codex-facing-regression-report.md`
- `discussion/implementation/waves/wave50/wave50-domain-d-editor-structural-planner-approval-ux-report.md`
- `discussion/implementation/waves/wave50/wave50-domain-e-codex-facing-structural-command-surface-report.md`
- `discussion/implementation/waves/wave50/wave50-domain-g-focused-e2e-structural-initial-state-regression-report.md`
- `discussion/implementation/waves/wave50/wave50-final-integration-report.md`
- 関連する Wave50 Domain D/E review

調査方法:

- 静的調査のみ。E2E、unit test、ブラウザ表示、スクリーンショット比較は実行していない。
- `rg` で `data-testid` / `textContent` / `aria-label` / `dt` / `dd` / `disabled` / `value` / `captureScreenshot` / command host 呼び出しを抽出し、必要箇所だけ本文を読んだ。

## 3. E2E / UI tests の可視UI依存パターン

### 3.1 E2Eの主要パターン

| 依存パターン | 確認できた事実 | 壊れやすい変更 |
| --- | --- | --- |
| `data-testid` 依存 | ほぼすべてのGUI E2Eが `apps/editor/e2e/test-ids.mjs` の mirror と `document.querySelector([data-testid=...])` を使う。`editor-test-ids.ts` とE2E mirrorは広範囲に対応している。 | test id の削除、リネーム、DOMからの遅延削除、drawer/modal化で対象が未mountになる変更。 |
| `textContent` 依存 | 多数のE2Eが `waitForText` / `expectText` / `textContent.includes(...)` で状態・結果・禁止文言を判定する。 | 表示文言の変更、表示範囲の移動、要約化、折りたたみでテキストが同一ノード配下に出なくなる変更。 |
| `aria-label` / `aria-labelledby` / button label 依存 | mesh canvas、topology、preview/viewer slider、layer controls、composition、rig control、source intake、tutorial、viewer runtime などで aria label、heading label、button text を読む。 | accessibility label のリネーム、heading構造変更、icon-only化、button textの削除。 |
| `dt/dd` fact text 依存 | Operation log の `Entries`、Product Preflight summary、Viewer Runtime facts、PSD import facts などで `dt` を探して隣の `dd` を読む helper が複数ある。 | fact label の変更、`dl` からtable/list/cardへ変更、factを別panelへ移動。 |
| visible / geometry 依存 | `getBoundingClientRect()` でpanel/button/inputがviewport内にあるかを見るテストがある。`scrollWidth` による水平overflow検査もある。 | modal/drawer/tab化、初期viewport外配置、常時mountしない設計、横スクロールを許容する設計。 |
| disabled / form value 依存 | PSD import、structural scaffold、composition、rig control、dynamics、tutorial、source intake などで `.disabled`、`.value`、`.checked`、select option、textarea内容を直接読む/書く。 | formの分割、stateを非DOM storeへ移す、stale approval UIのdisabled条件変更。 |
| SVG / DOM attribute 依存 | preview / mesh canvas / layer controls で `points`、`cx`、`cy`、`data-drawable-id`、`data-texture-*`、`data-runtime-visible`、`data-selected`、`data-editable` を読む。 | preview SVG構造、属性名、selection表現、texture/render evidenceのDOM属性変更。 |
| screenshot / visual密度 | 多くのE2Eが `captureScreenshot()` を呼ぶが、`page-session.mjs` ではPNGが空でないことと `base64Length` を返すだけ。画像比較は確認できない。 | screenshotそのものは主oracleではない。ただし、geometry/overflow検査は可視密度や初期到達性に影響する。 |

事実:

- E2EはPlaywright locator中心ではなく、CDP上で `document.querySelector` を実行する形が中心である。
- GUI E2Eは画面を操作しつつ、最終確認ではDOM text、DOM attribute、package JSON/localStorage、operation log、AI command responseを組み合わせている。
- `psdImportPlanCodexFocused` と `psdStructuralInitialStateFocused` は、ブラウザ内の別workflow/controllerや `workflow.aiCommandHost.execute(...)` を直接呼ぶ区間を持ち、そこは可視DOMではなく構造化レスポンスを検証している。

### 3.2 UI unit/component tests の主要パターン

事実:

- UI component tests は独自の `TestElement` / fake DOM と `findByTestId(...).textContent.toContain(...)` 型の検証が多い。
- `app-shell.test.ts` はPreview、Drawable Authoring、Dynamics、Viewer / Runtime、Tutorial、Rig Control、Source Intake、Layer Treeなどを、panel test id と表示textで確認する。
- `explicit-psd-import-panel.test.ts` は import-plan / structural scaffold の facts、approved refs textarea、submit disabled、stale preview blocking、禁止文言不在を確認する。
- `product-preflight-panel.test.ts` は summary/category/blocking/warning/unsupported/not-evaluated/comparison/ref change text を確認する。
- `rig-control-panel.test.ts`、`composition-panel.test.ts`、`dynamics-panel.test.ts` は、visible diagnostics、form disabled、runtime/evidence text を確認する。
- `source-intake-panel.test.ts` は structured PSD profile evidence、binary ref metadata、diagnostic/check ID、digest/path表示を確認する。

事実からの推測:

- 現在のUI unit tests は、componentの表示文言をかなり強いoracleとして扱っている。画面分離自体より、文言・fact構造・test id の移動がテスト破壊要因になる可能性が高い。

## 4. 依存している表示情報の分類

| 表示情報の性質 | 例 | 現在の依存 |
| --- | --- | --- |
| 人間向け表示として自然 | panel heading、form label、button label、parameter count、preview summary、runtime visible/hidden、validation category summary、source rights/provenance summary | E2EとUI testsが `textContent` / aria label / visible geometryで確認している。 |
| test oracle としてだけ強く見える | Operation log `Entries` fact、operation type sequence、exact count labels、`Persistent bytes: X restored / Y checked`、forbidden positive claims absence、stale approval disabled state、`No ...` empty-state literals | 人間にも読めるが、UI上の自然さよりテスト判定としての役割が強い。表示を要約・移動すると壊れやすい。 |
| debug / evidence / diagnostic の可視text | operation ID/type/surface/timestamp、target IDs、evidence count、runtime snapshot/state/sequence path、validation report ID/path、diagnostic check ID、severity/status/targetLabel、candidate/approval digest | 通常workspace内に表示され、E2E/UI testsが一部を直接読む。 |
| stable IDs / source refs / generated refs | `sourceLayerId`、PSD `nodeRef`、source order、generated part/drawable/texture/mesh IDs、batch evidence ID、approval ID、operation ID、artifact path、package-relative path | E2E、UI tests、AI command testsの主要oracle。可視UIだけでなく構造化 command/resultにも多く存在する。 |
| visible state / DOM attribute | button disabled、form values、checkbox checked、slider value、SVG `points`、`data-texture-*`、`data-runtime-visible`、`data-selected` | GUI操作の成立確認やpreview/render state確認として使われる。可視DOM構造に強く依存。 |
| accessibility / control identity | aria label、role、`aria-expanded`、heading text via `aria-labelledby` | UI smoke/a11y寄りのoracle。icon化やlabel変更で壊れやすい。 |

補足事実:

- Evidence/debug情報は `Operation log`、`Generated evidence`、`Package file set`、`Reload summary`、Viewer Runtime evidence、Product Preflight、Codex Proposal Review、AI Transcriptなど複数領域に分散している。
- `app-shell.ts` は `Operation persistence evidence` section を作り、その中に operation log、generated evidence、package file set、reload summary を通常workspaceへappendしている。

## 5. UI内部ロジックのDOM/test-id依存

Wave51前の事実:

- `apps/editor/src/ui/explicit-psd-import/explicit-psd-import-panel.ts` は Wave51 前の production UI 内で `data-testid` selector を使っていた。
- `syncImportPlanApprovedRefs` は import-plan candidate checkbox群から approved refs textareaを同期するため、親DOMから `[data-testid="${editorTestIds.explicitPsdImportPlanForm}"]` と `[data-testid="${editorTestIds.explicitPsdImportPlanApprovedRefs}"]` をqueryする。
- `syncStructuralScaffoldApprovedRefs` も同様に structural scaffold form / approved refs textarea を `data-testid` で探す。
- `updateImportPlanApprovedBatchSubmitState`、`updateStructuralScaffoldCommitSubmitState`、`isImportPlanApprovedSelectionCurrent`、`isStructuralScaffoldApprovedSelectionCurrent` も `data-testid` selector と `dataset.lastGeneratedApprovedRefs` / `dataset.baseDisabled` に依存する。
- `findInRootOrParent` は現在のrootまたはparentから selector を探すため、panel内の相対DOM位置も暗黙の前提になっている。

影響:

- この箇所では `data-testid` はテスト用だけではなくproduction behaviorの一部である。PSD import / structural scaffold のUI分離では、test idを残してもフォームとcandidate listの親子関係が変わると同期やdisabled更新が壊れる可能性がある。

未確認:

- production UI全体で同種の `data-testid` selector 依存が他にもあるかは、`rg` 上は PSD import panel が明確な該当箇所だった。`querySelector("input")` など通常のform内部queryは他componentにもあるが、test id couplingとは別分類にした。

Wave51-Wave52後の状態:

- Domain Bで上記の targeted coupling は local approval binding へ置き換え済み。既存の stable `data-testid` はtest-facing observation hookとして維持されている。
- Domain Eで `node scripts/check-production-testid-boundary.mjs` と fixture regression が追加され、production `[data-testid...]` selector strings、`data-testid` readbacks、non-assignment `dataset.testid` reads を検出する。
- Wave52 Domain Eで `check:testids` は standard `check` に統合済み。`check:testids:fixtures` は利用可能だが standard `check` には含めない。
- default scan root は `apps/editor/src` の `.ts` / `.tsx` に限られ、dynamic selector construction や間接aliasは検出対象外になり得る。

## 6. Codex-facing surface のDOM独立性

### 6.1 DOMから独立して取得できる情報

事実:

- `apps/editor/src/ai-command-host/editor-ai-command-host.ts` は `AiCommandRequestSchema` をparseし、read command、PSD import-plan command、operation dry-run/commitを構造化レスポンスとして返す。
- read command は `getEditorState`、`inspectModel`、`inspectTarget`、`validatePackage`、`getOperationLog` を通す。
- `workflow-controller.ts` は command host に対して、現在のEditor state projection、package inspection、target inspection、validation、operation log、PSD import-plan stateを提供する。
- Wave49で `getPsdImportPlanState`、`setPsdImportPlanApproval`、`preflightPsdImportPlanIntake`、`executePsdImportPlanIntake` が追加され、leaf import-planのCodex-facing preflight/execute pathがある。
- Wave50で `AiPsdImportPlanCommandResult` に `structuralScaffold` と `latestStructuralScaffold` が追加され、structural plan/source/generated refs、operation/evidence refs、hidden/runtime visibility stateが read projection で見える。
- `packages/ai-interface/src/ai-product-preflight-observation.ts` と `ai-product-preflight-command.ts` には Product Preflight report の構造化 observation / diff / rerun affordance 型がある。

DOMから独立している主な情報:

- Editor semantic state / package revision。
- target refs、editable target refs、target detail、source references。
- validation report。
- operation log entries。
- PSD import-plan candidates、approved refs、candidate digest、latest batch generated refs。
- structural scaffold group/leaf refs、generated group part refs、generated drawable/texture/mesh refs、source order、initial runtime visibility、latest structural operation refs。
- AI transcript / approval lifecycle evidence は `packages/ai-interface` と Editor command host transcript側にも存在する。

### 6.2 可視UIにしか出ていない可能性がある情報

事実:

- Wave50 reports/reviewsは、structural state/latest refsのread projectionは存在するが、structural-specific Codex execute/stale commandは未実装で残っている、と明記している。
- `EditorAiCommandHost` の現在の request unionに `readProductPreflightReport` / `diffProductPreflightReports` / `getProductPreflightRerunAffordance` は含まれていない。これらは `packages/ai-interface` の別command型として存在するが、Editor in-process hostのread commandとしては確認できない。
- Product Preflight通常UIの比較・rerun affordance表示は `workflow-controller` stateとUI panelで表示されるが、Editor command hostから直接「現在のlatest Product Preflight report/comparison」を読むcommandは確認できない。
- PSD structural scaffoldのpreview/commitは現在、Editor visible workflow/UIを通る実装が中心で、Codex-facing structural parityはread projection止まりである。

事実からの推測:

- Codexが通常作業で必要とする state の多くはDOM非依存surfaceにある。一方、Product Preflightの現在画面state、proposal review UIの可視サマリ、structural scaffold execute/stale path、dirty approval control状態などは、まだ可視UIやworkflow内部stateに寄っている可能性がある。

未確認:

- 外部Codex運用が実際に可視DOM textを読むかどうかは未確認。少なくともリポジトリ内の command host / ai-interface はDOM独立を志向している。

## 7. 通常UIから移動すると壊れやすいもの

事実ベースの分類:

| 移動対象 | 壊れやすい理由 | 影響しやすいテスト/機能 |
| --- | --- | --- |
| Operation log / Generated evidence / Package file set / Reload summary | `data-testid`、`dt/dd` facts、operation type sequence、artifact paths、entry countがE2Eで読まれる。 | 多くのE2Eの最終確認、operation persistence evidence確認。 |
| Product Preflight panel / comparison | summary/category/blocking/warning/unsupported/not-evaluated/comparison/ref textがE2E/UI testsで読まれる。 | `product-preflight-smoke.mjs`、`product-preflight-diff-smoke.mjs`、panel unit tests、Codex proposal workflow tests。 |
| PSD Import import-plan / structural scaffold facts | file/source/digest/scope/counts/approved refs/generated refs/diagnostics/disabled stateがテストoracle。Wave51前のproduction UIは `data-testid` selectorで同期していたが、対象 coupling はWave51で除去済み。 | PSD focused E2E、explicit PSD panel tests、Wave48/Wave50 stale preview blocking、Wave51 production `data-testid` boundary guard。 |
| Viewer / Runtime evidence | snapshot facts、diff、diagnostics、parameter overrides、mesh/mask/rig/dynamics evidence textが読まれる。 | `viewer-runtime-smoke.mjs`、topology/composition/rig/dynamics E2E、app-shell tests。 |
| Preview / canvas DOM | SVG attributes、texture data attrs、mesh vertex selection attrs、aria labels、geometry/overflow検査がある。 | preview/drawable/canvas/topology/layer tests。 |
| AI Approval / AI Transcript / Codex Proposal Review | command names、approval status、operation ID、evidence count、validation/diff/preflight/approval text、button disabledが読まれる。 | `smoke-checks.mjs` AI approval区間、`codex-proposal-review-smoke.mjs`、codex proposal panel tests。 |
| Accessibility labels / button labels | heading/aria label/button textをUX smokeが確認する。 | Source intake、rig/composition/dynamics/tutorial/viewer/mesh tests。 |
| Form values / disabled state | テストが`.value` / `.checked` / `.disabled`を直接読む/書く。 | PSD approval、source intake、rig/composition/dynamics、tutorial、preview/viewer slider。 |

事実からの推測:

- 「debug/evidenceを通常UIから移す」こと自体より、既存E2Eの観測面が可視DOMに残る前提で書かれていることが主な破壊要因である。
- 特に PSD import panel は production behavior と test ids が結びついているため、単純なDOM移動はテスト破壊だけでなく機能破壊になり得る。

## 8. 画面仕様discussionに向けた安全な分離単位

これは実装提案ではなく、依存関係上の分類である。

### 分離単位A: 人間向け primary authoring controls

対象:

- preview/canvas、parts/layer tree、drawable authoring、parameter controls、source intake、rig/composition/dynamics作成form。

依存:

- `data-testid`、aria label、button label、form value、disabled state、preview SVG/data attrs。

注意:

- test id とaccessibility labelを維持すれば一部移動しやすいが、初期mount/visibility/geometry前提は別途影響する。

### 分離単位B: 可視 evidence / debug / diagnostic panels

対象:

- Operation log、Generated evidence、Package file set、Reload summary、runtime evidence、validator diagnostics、Product Preflight details、Codex Proposal Review details、AI Transcript。

依存:

- textContent、`dt/dd` facts、operation IDs、diagnostic IDs、evidence refs、artifact paths。

注意:

- 人間向けUIから分ける候補として自然だが、現E2Eのoracleが集中している。移動する場合も、同等のtest/Codex-readable surfaceの扱いを先に決める必要がある。

### 分離単位C: Codex-facing structured command/result surface

対象:

- `getEditorState`、`inspectModel`、`inspectTarget`、`validatePackage`、`getOperationLog`、leaf import-plan command、structural scaffold read projection。

依存:

- DOMではなく DTO/schema/test fixtures。

注意:

- UI整理から比較的独立している。ただし structural-specific execute/stale command、Editor current Product Preflight state read、Product Preflight comparison readなどは不足可能性がある。

### 分離単位D: PSD approval controls after Wave51 coupling removal

対象:

- import-plan candidate approval、approved refs textarea、approved batch submit、structural scaffold node approval、structural approved refs textarea、structural commit submit。

依存:

- Wave51前は production codeが `data-testid` selector、parent DOM、textarea dataset、submit datasetを使って同期していた。
- Wave51後は local approval binding で同期する。stable `data-testid` はtest-facing observation hookとして残る。

注意:

- 他のevidence panelより危険度が高いことは変わらない。production state synchronizationの targeted coupling は解消済みだが、task shellへの移動時にはDOM/text oracle、mount/visibility、structured observation消費の設計が必要になる。

### 分離単位E: Visual/semantic preview DOM

対象:

- Preview visual、mesh canvas、viewer runtime visual。

依存:

- SVG shape、`points`、`data-drawable-id`、texture/render attrs、selection attrs、slider aria labels。

注意:

- 画像比較ではなくsemantic DOM attributeがoracle。canvas/SVG構造を変える場合は、test-facing semantic attrsをどう残すかが論点になる。

### 分離単位F: Accessibility/control identity surface

対象:

- heading labels、aria labels、role/status、button names、`aria-expanded`。

依存:

- E2E/UI testsが人間向けラベルとして確認している。

注意:

- icon-only toolbarやmodal title変更で壊れやすい。これはtest専用ではなく人間向けUXとしても自然なsurfaceである。

## 9. 未確認・不確実な点

- E2Eやunit testsは実行していない。静的調査に基づく棚卸である。
- すべての `apps/editor/src/**/*.test.ts` を行単位で網羅したわけではない。UI表示・Codex/evidence依存に関係する箇所へ絞った。
- 実ブラウザでの視覚密度、スクリーンショット内容、mobile/desktop viewportの実表示は確認していない。
- 外部Codex運用が可視DOMを読むかは未確認。
- `packages/ai-interface` の Product Preflight command型が、現Editorの in-process `EditorAiCommandHost` からどう使われるべきかは未決定。現状では通常UIのProduct Preflight stateと完全に同じ入口とは確認できない。
- どの可視textを仕様として維持すべきか、どれをtest-only oracleから外すべきかは未決定。

## 10. 次にユーザーと議論すべき論点

ユーザー判断が必要な論点:

- 通常Editor workspaceに残す human primary 情報と、debug/evidence viewへ分ける情報の境界。
- Operation log / Generated evidence / Package file set / Reload summary を通常UIに常時表示し続けるか、別view/drawer/automation surfaceへ分けるか。
- Product Preflight、Codex Proposal Review、AI Approval、AI Transcriptを人間向けworkflowとして見せる範囲と、Codex/evidence向けに残す範囲。
- PSD import / import-plan / structural scaffold は Wave52 で bounded に Task Shell task として扱う実装へ進んだ。final Toolbox placement、final modal/task-window/dedicated-view policy、Diagnostics / Evidence への最終導線はまだ議論が必要。
- 既存E2Eの互換方針。`data-testid` と主要aria labelを維持するのか、可視text oracleを構造化helper/DTO/evidence fileへ寄せるのか。
- `check:testids:fixtures` を standard quality gate または CI-only path に広げるか。
- Codex-facing structural command parityを、UI整理と独立に後続waveへ回せるか、または画面仕様で境界だけ先に固定すべきか。
- Product Preflightの現在report/comparisonを、Editor command hostからDOM非依存に読む必要があるか。
