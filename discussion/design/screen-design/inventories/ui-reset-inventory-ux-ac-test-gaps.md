# UI Reset UX AC / Test Gap Inventory

> 状態: Inventory / recommendation。Wave54 の AC・test・review が UX 未達を見逃した理由を棚卸しし、次の UI Reset wave で必須化すべき UX acceptance criteria と検証観点を定義する。

## 1. 結論

Wave54 は、当時の bounded scope である `Task Window & Surface Separation v0` の DOM / route / focus / guard 条件を満たしたため `pass` になった。一方で、ユーザーが期待した「Toolbox から開く window / dialog-like な作業面」は、視覚・操作 UX としては検証されていなかった。

特に重要な見逃しは次の通り。

- `role="dialog"`、`data-task-window-*`、active route、focus、Escape close は検証されたが、画面上で window として見えるかは検証されていない。
- 現行実装は active task を `workspace.append(...)` の通常子要素として primary layout の後ろに追加しており、CSS も `.editor-task-shell` に `position: fixed` / `absolute` / backdrop / overlay root を持たない。これは通常フロー内 section として成立し得る。
- `focus()` による task shell focus は検証されたが、focus によって document scroll が発生しないことは検証されていない。ユーザーが観測した「クリックでスクロールする」はこの穴に一致する。
- screenshot は取得されていたが、`base64Length` のログだけで、画像の保存・比較・bounding box・初期 viewport 可視性・primary text hierarchy の検査はしていない。
- Desktop/mobile smoke は「Editor 全体が壊れていない」証拠であり、task window の視覚 UX 達成の証拠ではなかった。

次 wave では、DOM 存在や role を補助証拠に留め、`window として初期 viewport に出ること`、`開いた瞬間に document scroll しないこと`、`通常フローの panel として見えないこと`、`primary text が作業名・操作・状態に集中すること` を acceptance gate にする必要がある。

## 2. 調査範囲

主に確認した根拠:

- Wave54 plan / reports / reviews:
  - `discussion/implementation/orchestration/wave54-plan.md`
  - `discussion/implementation/waves/wave54/wave54-domain-a-boundary-current-surface-inventory-report.md`
  - `discussion/implementation/waves/wave54/wave54-domain-g-app-shell-integration-window-routing-report.md`
  - `discussion/implementation/waves/wave54/wave54-domain-h-focused-regression-responsive-guard-verification-report.md`
  - `discussion/implementation/waves/wave54/wave54-final-integration-report.md`
  - `discussion/implementation/reviews/wave54/wave54-final-integration-review.md`
  - `discussion/implementation/reviews/wave54/wave54-domain-g-app-shell-integration-window-routing-review.md`
  - `discussion/implementation/reviews/wave54/wave54-domain-h-focused-regression-responsive-guard-verification-review.md`
- E2E / runner:
  - `apps/editor/e2e/task-window-routing-focused-smoke.mjs`
  - `apps/editor/e2e/selector-scopes.mjs`
  - `apps/editor/e2e/page-session.mjs`
  - `scripts/focused-e2e-registry.mjs`
  - `scripts/run-focused-e2e.mjs`
- Unit / source facts:
  - `apps/editor/src/ui/app-shell/app-shell.test.ts`
  - `apps/editor/src/ui/app-shell/task-shell.test.ts`
  - `apps/editor/src/ui/app-shell/app-shell.ts`
  - `apps/editor/src/ui/app-shell/task-shell.ts`
  - `apps/editor/src/app/editor-app.ts`
  - `apps/editor/src/styles/editor.css`
  - `apps/editor/src/ui/explicit-psd-import/explicit-psd-import-task-summary.ts`
- Screen design docs:
  - `discussion/design/screen-design/scope-and-principles.md`
  - `discussion/design/screen-design/overview.md`
  - `discussion/design/screen-design/screens/authoring-workspace.md`
  - `discussion/design/screen-design/screens/psd-import-task.md`
  - `discussion/design/screen-design/screens/diagnostics-evidence-view.md`
  - `discussion/design/screen-design/screens/codex-automation-view.md`
  - `discussion/design/screen-design/components/toolbox.md`
  - `discussion/design/screen-design/inventories/current-ui.md`
  - `discussion/design/screen-design/inventories/codex-test-evidence-dependency.md`

実行確認はしていない。これは実装・test 修正ではなく、静的な棚卸と次 wave 向け検証設計である。

## 3. Wave54 が見ていたもの

| 観点 | Wave54 の確認内容 | 主な根拠 |
|---|---|---|
| route / state | App Shell が `psdImport` / `diagnosticsEvidence` / `codexAutomation` の active task state を持ち、Toolbox から開閉できる | `app-shell.test.ts`, Domain G report/review |
| default 非表示 | PSD Import panel は初期状態では DOM に出ない | `app-shell.test.ts`, `task-window-routing-focused-smoke.mjs` |
| shell metadata | active task が `data-task-window-scope="workspace"`、surface id/kind/group を持つ | `task-shell.test.ts`, `app-shell.test.ts`, focused e2e |
| ARIA / focus | active task が `role="dialog"`、`aria-modal="false"`、`tabindex="-1"`、Escape shortcut を持ち、focus される | `task-shell.test.ts`, focused e2e |
| close / back | Back / Close / Escape で active task が消える | `task-shell.test.ts`, `app-shell.test.ts`, focused e2e |
| bounded skeleton | Diagnostics / Evidence と Codex / Automation は read-only skeleton で、final/full claim をしない | Domain D/E/G/H reports/reviews, focused e2e |
| selector scope | PSD focused e2e が task window scope 内の `explicitPsdImport.panel` を見るよう整理された | Domain F/H reports, `selector-scopes.mjs` |
| regression / guards | required PSD focused IDs、desktop/mobile aggregate smoke、production `data-testid` guard、source/dependency guard が pass | Domain H report/review, final report/review |

これらは、構造的な route と test-facing surface の証拠としては有用である。ただし、UX として window に見えるか、初期 viewport に収まるか、click で scroll しないか、legacy panels が通常 UI として見えないかは、別の検査が必要だった。

## 4. Wave54 が見逃したもの

### 4.1 window が通常フロー内に置かれていないこと

Repository fact:

- `apps/editor/src/ui/app-shell/app-shell.ts` は primary Authoring Workspace layout を append し、その直後に `activeTask` を append し、その後に `createWorkspaceSupportRegion([...])` を append している。
- `apps/editor/src/styles/editor.css` の `.editor-task-shell` は `display: flex`、`width: min(100%, 1120px)`、`max-height: min(84vh, 920px)`、`overflow: hidden` などを持つが、調査範囲では `position: fixed` / `absolute`、overlay root、backdrop、z-index による window 化は確認できなかった。
- `.editor-workspace` は grid / overflow する通常 workspace であり、active task を通常子要素として追加すると「下に出る section」になり得る。

見逃し:

- focused e2e は `getBoundingClientRect()` や computed style を確認していない。
- Unit tests は fake DOM であり、CSS layout / viewport / scroll を評価しない。
- Review rubric は `role=dialog` と `data-task-window-*` を window UX の十分条件として扱ってしまった。

### 4.2 click で document scroll しないこと

Repository fact:

- `apps/editor/src/app/editor-app.ts` は active task がある場合、`querySelector('[data-task-window-scope="workspace"][data-task-window-region="window"]')?.focus()` を呼ぶ。
- `task-window-routing-focused-smoke.mjs` は `document.activeElement === taskWindow` を pass 条件にしている。

見逃し:

- `window.scrollY` / `document.scrollingElement.scrollTop` の before/after を見ていない。
- `HTMLElement.focus({ preventScroll: true })` 相当の挙動や overlay 先行表示を要求していない。
- ユーザー観測の「クリックでスクロール」は、focus が通常フロー内の task shell へ scroll している可能性と整合する。

### 4.3 screenshot が視覚 oracle ではなかったこと

Repository fact:

- `page-session.mjs` の `captureScreenshot()` は Chrome の screenshot を取り、空でないことだけを確認し、`format` と `base64Length` を返す。
- `task-window-routing-focused-smoke.mjs` は Codex / Automation open 後に screenshot を取得するが、画像内容、位置、重なり、初期 viewport 内表示、text hierarchy を検査しない。

見逃し:

- screenshot を保存して review artifact として確認していない。
- screenshot に対する pixel / bounding / perceptual check がない。
- PSD Import と Diagnostics の open 直後 screenshot も主 oracle になっていない。

### 4.4 viewport containment / internal scroll

見逃し:

- task window の `top/left/right/bottom` が viewport 内にあることを確認していない。
- task content が window 内で scroll し、document 全体が scroll しないことを確認していない。
- Close / Back が desktop/mobile の初期 viewport に残ることを確認していない。
- mobile task routing は Domain H の ad hoc invocation であり、registered focused gate ではなかった。

### 4.5 primary text hierarchy

Repository fact:

- PSD Import Task content は `explicit-psd-import-task-summary.ts` で `Task Summary` heading を生成する。
- PSD Import screen spec は Human UI に source summary、PSD tree、import scope、scaffold preview、warning summary、approve / commit state を出し、operation ID、generated refs、PSD node ref 全文、raw parser payload、evidence path、command payload 全文を通常表示しないと定義している。

見逃し:

- `Task Summary` が task window の初期可視領域で primary signal になっていないかを見ていない。
- visible first screen の文字量・順序・見出し階層を検査していない。
- `diagnosticsEvidenceView` のような routing / machine surface 名が human primary summary に出ることを禁止していない。

### 4.6 legacy support panels が UX として隠れていること

Repository fact:

- `app-shell.ts` は `createWorkspaceSupportRegion([...])` に Parameters、Tutorial、Viewer、Composition、Rig、Dynamics、Operation、Drawable Authoring、Source Intake、Project Storage、Product Preflight、Codex Proposal Review、AI Approval、AI Transcript、persistence evidence を append している。
- `app-shell.test.ts` には legacy support が存在することを確認する tests がある。
- Screen design docs は legacy support panels に evidence/debug/Codex-heavy UI が残ることを未完了負債として記録している。

見逃し:

- active task open 中に legacy support panels が通常 UI として視認・操作可能でないことを確認していない。
- 「既存パネルが通常 UI から見えなくなることは歓迎」というユーザー判断は Wave54 AC に反映されていない。

## 5. 次 wave で必須にする UX AC

次の AC は、DOM / route / role の補助検査とは別に、UI Reset wave の gate として扱う。

### UX-AC-01: Task launch は document scroll を発生させない

Toolbox の PSD Import / Diagnostics / Codex など task/view item をクリックしても、`window.scrollY` と `document.scrollingElement.scrollTop` は open 前から許容誤差内に留まる。クリック後に「下の section へスクロールして到達する」挙動は禁止する。

Close / Back / Escape 後は、scroll position と focus が launcher または明示された workspace anchor に戻る。

### UX-AC-02: Task window は通常 document flow の section ではない

active task surface は、primary Authoring Workspace 上に window / overlay / docked window として現れる。少なくとも次を満たす。

- active task の root またはその overlay host は `position: fixed` / `absolute` / equivalent overlay positioning を持ち、通常 flow の下部 section として document height を押し下げない。
- `elementFromPoint()` で window 中央が active task に解決される。
- task window の visual stacking は primary workspace / legacy support panels より上にある。
- active task open 中、legacy support panels は初期 viewport で primary UI として見えない。表示を残す場合も overlay に覆われ、pointer / keyboard interaction は task window と明確に分離される。

### UX-AC-03: Viewport containment と internal scroll

Desktop と mobile の両方で、open 直後に task window の header、title、主要 action、Close / Back が viewport 内に見える。

- Desktop: window は app bar / workspace の視界内に収まり、横 overflow を作らない。
- Mobile: window は viewport 幅に収まり、Close / Back が初期表示内に残る。
- 長い task content は window 内部の scroll region に収まり、outer document scroll に逃がさない。

### UX-AC-04: Primary human UI の first viewport budget

PSD Import Task の初期可視領域では、主要 signal は `PSD Import`、source 選択 / parse / preview / approve / commit の human workflow、現在状態、次 action に集中する。

禁止:

- `Task Summary` が最上位または最大の primary heading として見えること。
- `Technical Workflow Details`、operation ID、approval digest、generated refs 全文、PSD node ref 全文、raw parser payload、evidence path、command payload、test selector 都合の文字列が first viewport の primary text として見えること。
- `diagnosticsEvidenceView` のような internal route / machine surface 名が human primary summary を支配すること。

補足: `Task Summary` という文言を完全禁止するか、secondary label としてだけ許すかは user-decision needed。次 wave の実装前に決める。

### UX-AC-05: Human UI / Evidence / Test / Codex surface 分離

Human task window を readable にするために debug text を戻してはならない。既存 focused tests が raw refs や operation details を必要とする場合は、visible primary UI ではなく、structured state、test-facing dataset、Diagnostics / Evidence View、Codex-facing command result のいずれかへ oracle を移す。

### UX-AC-06: A11y semantics は視覚モデルと一致させる

`role="dialog"` は十分条件ではない。

- modal overlay として実装するなら、backdrop / focus trap / inert background / `aria-modal` の扱いを明示し、それを検証する。
- non-modal workspace window として実装するなら、`aria-modal="false"` でも、focus が scroll を起こさず、background interaction の可否が設計通りであることを検証する。

どちらを採用するかは user-decision needed。

### UX-AC-07: Desktop/mobile registered gate

Task window UX は desktop と mobile の両方を registered focused e2e として実行する。Domain H のような ad hoc mobile invocation は補助証拠に留め、gate にはしない。

### UX-AC-08: Screenshot evidence は「撮った」だけでは pass にしない

各対象 surface の open 直後と close 後の desktop/mobile screenshot を artifact として保存し、machine metrics と review checklist に紐付ける。`base64Length` のみのログは UX evidence として扱わない。

## 6. 具体的な検証案

### 6.1 Runtime geometry metrics

focused e2e に `assertTaskWindowUxMetrics(page, surfaceId, viewport)` を追加する。

取得すべき metrics:

- `preOpenScrollY`, `postOpenScrollY`, `postFocusScrollY`
- `windowRect`: `getBoundingClientRect()` の top / left / right / bottom / width / height
- `viewportWidth`, `viewportHeight`, `visualViewport` があればその width / height / offset
- `computedPosition`, `computedZIndex`, `overflow`, `maxHeight`
- `overlayHostRect` と `backdropRect`。採用しない場合は non-modal として明示。
- `documentHeightDelta` / `scrollHeight` before-after
- `documentHorizontalOverflow`
- `closeButtonRect`, `backButtonRect`, `primaryActionRect`
- `elementFromPoint(window center)` の surface id / task window scope
- `legacySupportVisibleCount` と `legacySupportInteractableCount`
- `firstViewportVisibleText`
- `firstViewportForbiddenPrimaryTextMatches`

pass 条件例:

- `Math.abs(postOpenScrollY - preOpenScrollY) <= 1`
- `windowRect.top >= appBarBottom - 1`
- `windowRect.left >= 0`, `windowRect.right <= viewportWidth + 1`
- `windowRect.bottom <= viewportHeight + 1`、または明示された inner scroll container がある
- `computedPosition !== "static"`、または overlay host が `fixed` / `absolute` で window root がその中にある
- `elementFromPoint(center).closest('[data-task-window-scope="workspace"]') !== null`
- Close / Back の rect が viewport 内

### 6.2 Scroll behavior scenario

手順:

1. Editor を初期表示し、`scrollY` を記録する。
2. Toolbox の PSD Import をクリックする。
3. `scrollY` が変わらないこと、task window が viewport 内に表示されていることを確認する。
4. task window 内 content を scroll しても outer document scroll が変わらないことを確認する。
5. Escape で閉じる。
6. launcher が視界内にあり、focus が launcher または定義済み workspace anchor に戻ることを確認する。

同じ手順を Diagnostics / Evidence と Codex / Automation skeleton にも適用する。

### 6.3 Screenshot protocol

対象:

- desktop `1280x900`
- mobile `390x844` または既存 mobile smoke と同等 viewport
- 必要なら tablet `768x1024`

保存する screenshot:

- `initial-workspace`
- `psd-import-open`
- `diagnostics-open`
- `codex-open`
- `after-close`

review 観点:

- active task が初期 viewport に出ている。
- 背景の workspace との重なり / 分離が視覚的に分かる。
- Close / Back がすぐ見える。
- `Task Summary` や debug/evidence text が primary になっていない。
- legacy support panels が通常 UI として見えていない。

補足:

- 現行 `page-session.mjs` は screenshot bytes を保存しない。次 wave では screenshot artifact 保存または base64/dimensions を review 可能な形で返す helper が必要。
- screenshot は単独 oracle ではなく、geometry metrics と併用する。

### 6.4 Forbidden primary text scan

DOM 全文ではなく、first viewport / visible primary area に限定して scan する。Diagnostics / Evidence View では evidence 用語が出てよいが、PSD Import Human UI の first viewport では禁止する、という surface-specific rule にする。

PSD Import first viewport の forbidden primary candidates:

- `Task Summary` が最上位見出しまたは first visible heading
- `Technical Workflow Details`
- `operation ID`
- `approval digest`
- `generated refs`
- `PSD node ref`
- `psd:root/`
- `raw parser`
- `evidence path`
- `command payload`
- `diagnosticsEvidenceView`
- `data-testid`

必須 primary candidates:

- `PSD Import`
- source selection / parse state
- preview / approve / commit の現在 action
- warning count or warning summary
- Close / Back

### 6.5 Legacy support visibility scan

active task open 中に次を確認する。

- `[data-shell-surface-group="legacy-support"]` の bounding rect が viewport に見えない、または overlay/backdrop に覆われる。
- legacy panel 内の primary buttons が keyboard tab order に入らない。modal の場合は inert / focus trap、non-modal の場合も task window 操作中の tab order policy を明示する。
- `Operation persistence evidence`、Codex Proposal Review、AI Approval、AI Transcript が active PSD Import window の primary surface として見えない。

### 6.6 Static review supplement

runtime e2e を主証拠にしつつ、review で static check も行う。

- `.editor-task-shell` または overlay host が static flow のままではない。
- `createEditorAppShell()` が active task を通常 flow に append するだけの実装になっていない。append する場合も overlay host の中に append されている。
- `focus()` は scroll を誘発しない設計である。`preventScroll` 相当か、focus 前に window が viewport 内にある。
- legacy support region を task/window の土台にしていない。

## 7. 既存 focused e2e の置き換え / 追加方針

### 7.1 `taskWindowRoutingFocused` の扱い

現行 `taskWindowRoutingFocused` は route semantic smoke として残してよい。ただし、それ単独で UX pass にしてはいけない。

現行が見るもの:

- open / close route
- surface id / kind / group
- role / aria / focus
- skeleton content boundedness

現行が見ないもの:

- overlay / fixed / static flow
- scroll position
- viewport containment
- backdrop / background inertness
- initial visible text hierarchy
- legacy support visibility
- screenshot content
- registered mobile UX gate

### 7.2 追加すべき focused ID

新規 registered focused ID を追加する。

候補 ID:

- `taskWindowUxFocused`

目的:

- Toolbox launch から active task が window-like UX として初期 viewport に表示されることを検証する。
- DOM metadata ではなく geometry / scroll / overlay / text hierarchy を primary oracle にする。

対象 viewport:

- desktop
- mobile
- 必要なら tablet

対象 surface:

- PSD Import Task
- Diagnostics / Evidence skeleton
- Codex / Automation skeleton

必須 assertion:

- no document scroll on open
- active task viewport containment
- non-static overlay/window positioning
- Close / Back visible
- elementFromPoint confirms task stacking
- support panels not primary visible/interactable
- first viewport text budget / forbidden primary text scan
- screenshot artifacts saved

### 7.3 PSD focused IDs との関係

既存 PSD focused IDs は PSD semantics / persistence / command boundary の regression として維持する。

- `psdStructuralInitialStateFocused`
- `psdImportPlanCodexFocused`
- `psdImportPlanFocused`
- `psdMultiLayerBatchFocused`
- `psdImportFocused`

ただし、これらに UX window placement を混ぜすぎない。PSD semantics tests が必要とする raw refs は、human primary text へ戻さず、test-facing structured state / selected controls / layer tree / persistence evidence へ寄せる。

### 7.4 Runner / registry の注意

`scripts/run-focused-e2e.mjs --list` や `scripts/check-focused-e2e-registry.mjs` は coverage ではない。registry は entry の存在・metadata drift を見るだけであり、UX pass の根拠は exact command run と metrics / screenshot review でなければならない。

## 8. Review rubric

次 wave の Review-Sylph は、以下を満たさない場合 `needs_fix` にする。

### 8.1 role / data marker only pass 禁止

次だけでは pass にしない。

- `role="dialog"`
- `aria-modal`
- `data-task-window-scope`
- `data-task-window-region`
- surface id / group
- `document.activeElement === taskWindow`
- screenshot `base64Length`

これらは補助証拠であり、window UX の十分条件ではない。

### 8.2 必須 review checks

- Runtime metrics で no-scroll / viewport containment / non-static overlay / stacking を確認したか。
- Desktop/mobile の screenshot artifact を見たか。
- active task open 中に legacy support panels が primary UI として見えないか。
- first viewport の primary text が task 作業に集中し、debug/evidence/internal route 文字列が支配していないか。
- Close / Back / Escape が視覚的にも操作的にも戻れるか。
- Mobile gate が registered focused ID として存在するか。
- Tests を弱めて visible debug refs を戻していないか。
- Codex / test / evidence の必要情報を Human UI に再混入させていないか。

### 8.3 Review が見るべき source facts

- active task mount 先が overlay/window host か、通常 flow append か。
- `.editor-task-shell` / overlay host の positioning / z-index / overflow。
- `focus()` が scroll を起こさない実装か。
- support panels の visibility / inert / tab order policy。
- screenshot helper が artifact を保存または review 可能にしているか。

## 9. Gnome に明示すべき禁止事項

次 wave の実装担当には、以下を明示する。

- 既存 legacy support panels を UX の土台にしない。
- active task を primary layout の下に通常 flow section として append するだけで済ませない。
- `focus()` で下部 task section へ scroll させる挙動を許容しない。
- `role="dialog"`、`aria-modal`、`data-task-window-*` を追加しただけで window UX 完了としない。
- screenshot を `base64Length` ログだけで済ませない。
- `Task Summary` を PSD Import の primary visual signal にしない。必要なら secondary label に下げる。
- raw PSD refs、operation IDs、generated refs、evidence paths、command payload を primary Human UI に戻して focused tests を通さない。
- Diagnostics / Evidence skeleton / Codex skeleton を final view 完成として扱わない。
- existing focused e2e を弱めて pass にしない。必要な oracle は structured surface へ移す。
- mobile task window routing を ad hoc verification だけで済ませない。
- Full visual design system、Mesh / Atlas / Parameter / Variant 実装、external transport、proposal generation、semantic recognition、auto-fix、automatic commit へ越境しない。

## 10. User-decision points

次 wave 計画前に Undine が整理すべき判断点:

1. Task window の最終 UX は modal overlay / non-modal floating window / docked drawer / dedicated view のどれを次 wave の対象にするか。現ユーザー期待からは、少なくとも PSD Import は overlay window として扱うのが推奨。
2. Modal overlay を採用する場合、backdrop、background inert、focus trap、`aria-modal` を必須にするか。Non-modal を採用する場合、background interaction と tab order の許容範囲を決める必要がある。
3. active task open 中、legacy support panels は unmount / `display:none` / overlay で不可視・非操作化 / scroll 下に残す、のどれにするか。ユーザー判断では「通常 UI から見えなくなること」は歓迎されている。
4. `Task Summary` を完全禁止するか、secondary label としてだけ許すか。
5. `taskWindowUxFocused` を standard `test:e2e` / focused required gate / CI-only gate のどこに入れるか。
6. first viewport forbidden primary text list を surface 別にどこまで厳格化するか。

## 11. 次 wave 計画への示唆

次 wave は `UI Reset / Task Window UX Acceptance v1` のように、機能追加ではなく UX gate の作り直しを目的にするべきである。

推奨スコープ:

- PSD Import / Diagnostics / Codex の active task mount を overlay/window host へ移す。
- no-scroll launch、viewport containment、window stacking、legacy support invisibility を runtime e2e で検証する。
- `taskWindowUxFocused` を registered focused ID として追加し、desktop/mobile を含める。
- screenshot artifact と review checklist を追加する。
- PSD Import first viewport の primary text hierarchy を整える。
- 既存 PSD semantic focused tests は維持し、Human UI に debug refs を戻さず structured/test/evidence surface で oracle を守る。

この wave の pass 条件は「tests が緑」ではなく、「ユーザーが初期 viewport で window として認識でき、操作でき、通常の巨大 panel 群へ scroll させられない」ことに置く。
