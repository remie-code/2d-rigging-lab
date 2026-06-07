# Wave54 Domain A レビュー: Boundary / Current Surface Inventory

> Target: `wave54-boundary-current-surface-inventory`
> Role: independent Review-Sylph
> Verdict: `pass`

## 指摘事項

Blocking findings: なし。

Non-blocking observations:

- Domain A は実装を B-F/G に残し、境界棚卸レポートだけを書いている。レビュー対象 artifact からは、Domain A による source/test/package/lockfile/fixture/generated asset 編集は見つからなかった。
- B-F は、報告された ownership split の下で 5-way parallel batch として開始可能である。主な調整リスクは Domain A がすでに指摘している通りで、共有 `editor.css` 編集と `createTaskShell()` の public shape 変更は B 所有に留めるか、G integration へ defer する必要がある。
- レポートの「B-F 前に追加ユーザー判断なし」という結論は、受領済み Wave54 plan と整合している。新しい user decision が必要になるのは、implementation domain が full modal/window policy、full Diagnostics / Evidence または Codex / Automation implementation、PSD semantic change、external transport、proposal generation、または列挙済み non-goal へ越境した場合だけである。

## レビューレーン

### Design / Development Compliance

`pass`

Domain A は boundary/current-surface inventory に留まっている。対象レポートは source、test、fixture、package、lockfile、generated asset を編集していないと明記しており、内容も current routing、surface classification、ownership、integration contract、regression targets、user-decision points に限定されている。

確認した source facts と inventory は一致している。

- 現在の route state は PSD-only である。`EditorAppShellActiveTask = "psdImport" | null` で、`mountEditorApp()` は open 時に `activeTask = "psdImport"`、close 時に `null` を設定する（`apps/editor/src/app/editor-app.ts`, `apps/editor/src/ui/app-shell/app-shell.ts`）。
- `createEditorAppShell()` は primary Authoring Workspace v0 layout を append し、その後 `activeTask === "psdImport"` の場合だけ PSD task shell を append し、さらに legacy support region を続けて append している。
- Toolbox は現時点で PSD Import と Viewer / Runtime routes を有効にしており、Diagnostics と Codex は disabled の dedicated-view placeholders のままである（`apps/editor/src/ui/app-shell/authoring-workspace-v0-shell.ts`）。
- Shell metadata にはすでに `diagnosticsEvidenceView` と `codexAutomationView` が含まれている。既存の legacy Codex/evidence panels は、それらの skeleton views へまだ分離されていないが、該当 surface として分類されている（`apps/editor/src/ui/app-shell/shell-surfaces.ts`, `apps/editor/src/ui/app-shell/app-shell.ts`）。
- PSD Import には現在も human summary と大きな technical workflow details があり、observation projector は raw refs を task observation に入れず、detailed evidence を `diagnosticsEvidenceView` へ向けている。

レポートは design basis とも整合している。

- PSD Import は Toolbox または empty state から呼び出す task であり、default always-visible workspace panel ではない。
- Diagnostics / Evidence と Codex / Automation は分離先となる future homes であり、completed views ではない。
- Codex automation policy は repo/Editor proposal generation、semantic recognition、auto-rigging、auto-fix、automatic commit、LLM/provider work、external HTTP/WebSocket/MCP transport を禁止している。

### Test / Regression Adequacy

`pass`

Domain A の regression targets は Wave54 scope に対して十分で、既存 gate を弱体化していない。列挙された targets は Wave53 baseline checks、focused PSD paths、production `data-testid` guard、fixture guard、source/dependency guards、`git diff --check` を維持している。

現在の App Shell tests は、Domain A が依拠している facts をすでにカバーしている。

- PSD Import launcher は Toolbox に存在し、default では PSD panel を append しない。
- `activeTask: "psdImport"` は PSD Import を task shell 内に render し、focused-flow hooks と observation summary を持つ。
- shell-surface metadata には PSD Import、Diagnostics / Evidence、Codex / Automation が含まれている。
- legacy support panels は workflows を移動せず分類されたままである。

レポートは、G/H が追加または維持すべき Wave54-specific assertions も正しく特定している。Toolbox が PSD Import を workspace-scoped task window で開くこと、back/close が Authoring Workspace へ戻ること、skeleton views が bounded のままであること、desktop/mobile smoke が pass し続けること、focused PSD paths が pass し続けること、duplicate `drawable.list` tests が明示的に scope されることである。

### Parallel Ownership / Integration Contract

`pass`

B-F ownership matrix は parallel start に十分な非重複性を持つ。

- B は generic task shell/window behavior と tests を所有する。
- C は PSD-specific content polish のみを所有する。
- D は Diagnostics / Evidence skeleton のみを所有する。
- E は Codex / Automation skeleton のみを所有する。
- F は selector/test-facing hardening のみを所有する。

G contract は適切に中央集約されており、B-F の implementation responsibilities を奪っていない。G は final App Shell route state、`app-shell.ts` integration、Toolbox enablement/mapping、final PSD window wiring、skeleton entry wiring、close/back integration、B が expose する focus/escape callbacks、B-F outputs をまとめて必要とする integration/e2e tests を所有する。

レポートは、G が PSD/scaffold semantics を変更すること、PSD Import を always-visible として再導入すること、全 legacy panels を移動すること、Viewer / Runtime を task window 化すること、新しい authoring/Codex capabilities を追加することを正しく防いでいる。

## User-Decision Points

受領済み Wave54 plan の下では、B-F start 前に必要な user-decision point はない。

implementation が以下の条件を発見した場合は、引き続き escalation が必要である。

- workspace-scoped task window v0 が全 tool 向けの final modal/window/dedicated-view policy を必要とする。
- Diagnostics / Evidence または Codex / Automation skeletons が full view implementation または broad panel migration を必要とする。
- B-F ownership を非重複に維持できない。
- PSD import/scaffold semantics を変更する必要がある。
- focused e2e が tests の弱体化なしに pass できない。
- Mesh / Atlas / Parameter Manager / Variant UI、proposal generation、semantic recognition、external transport、renderer/pixel oracle、Cubism compatibility、public demo assets が必要になる。

## Verdict

`pass`

Domain A は Wave54 boundary/current-surface inventory gate として受領可能である。B-F は、レポートに記録された ownership matrix と G integration contract を使って parallel start してよい。
