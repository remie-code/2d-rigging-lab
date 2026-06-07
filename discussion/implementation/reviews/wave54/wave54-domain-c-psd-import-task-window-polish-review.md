# Wave54 Domain C レビュー: PSD Import Task Window Polish

> Target: `psd-import-task-window-polish`  
> Role: independent Review-Sylph  
> Verdict: `pass`

## 指摘事項

Blocking findings: なし。

Non-blocking findings: なし。

## Design / Development Compliance

`pass`

Domain C は PSD-specific content polish の範囲に収まっている。対象差分は `apps/editor/src/ui/explicit-psd-import/explicit-psd-import-panel.ts`、新規 `apps/editor/src/ui/explicit-psd-import/explicit-psd-import-task-summary.ts`、および focused component test に限定されている。`git status` 上は他Domainの App Shell / e2e / skeleton 差分も存在するが、Domain C target changed files には generic task shell、App Shell routing、workflow/package semantics、fixtures、generated assets、lockfile、broad e2e は含まれていない。

Basis との整合:

- Wave54 plan は Domain C に「existing PSD Import Task Human UI を task window shell 内で自然に見せる」「machine-only details を primary human UI から外す」「PSD import-plan / structural scaffold semantics を preserve」することを求めている。
- PSD Import Task screen spec は Human UI を source summary、PSD tree、import scope、scaffold preview、warning summary、approve / commit state に絞り、operation ID、approval digest、generated refs全文、PSD node ref全文、raw parser payload、evidence path、command payload全文、test selector都合の文字列を通常表示しないと定義している。
- Domain A ownership matrix は C の所有を `apps/editor/src/ui/explicit-psd-import/**` と focused PSD component tests に限定している。

実装確認:

- `explicit-psd-import-task-summary.ts` は primary Task Summary のみを担当する helper として分離されており、source organization policy の「one source file owns one responsibility」に合っている。
- `explicit-psd-import-panel.ts` は content を `PSD Import Workflow` と `Advanced Workflow Controls` に分け、Source / Parse、Tree / Scope、Import-Plan Approval、Structural Scaffold Approval、Commit Review を task-window 内で追いやすい単位にしている。
- Parse State は選択ノードIDや `psd:root` を直接出さず、selected PSD leaf layer の件数へ丸めている。
- Primary summary は `psd:root` を `root PSD scope` に変換し、destination label も表示名側だけを使っており、approval digest、operation ID、full generated refs、evidence paths、command payload、test selector wording を primary summary に出していない。
- `index.ts` は既存どおり barrel-only で、今回の helper 追加に伴う implementation logic は置かれていない。

## Test Adequacy

`pass`

Focused tests は Domain C の変更点と preservation risk を適切に押さえている。

- 新規 grouping test は workflow / advanced section の存在と、既存 stable hooks が移動後も取得できることを確認している。
- Primary summary test は source、parse、tree、scope、scaffold、warning、approval / commit、next action を確認している。
- Machine-only exclusion test は digest、operation-like IDs、PSD refs、layer/generated refs、evidence path、`data-testid` wording、raw parser payload / approval digest / operation id を primary summary から除外することを確認している。
- Parse state test は `layer_face` と `psd:root` が concise parse state に出ないことを確認している。
- 既存 tests は parse callback payload、selected layer / batch callback payload、import-plan preview payload、approved batch payload、structural scaffold payload、stale approval blocking、group rows exclusion、broad all-layer wording avoidance を維持している。

## Verification Considered

実施した確認:

- `git diff -- apps/editor/src/ui/explicit-psd-import/explicit-psd-import-panel.ts apps/editor/src/ui/explicit-psd-import/explicit-psd-import-panel.test.ts`
- `Get-Content` / `rg` による basis documents、target source、target tests、machine-only wording、form names、approval stale-state scan
- `pnpm.cmd exec vitest run apps/editor/src/ui/explicit-psd-import/explicit-psd-import-panel.test.ts`
  - sandbox run: esbuild spawn `EPERM`
  - escalated rerun: pass, 18 tests
- `pnpm.cmd run check:source`: pass
- `git diff --check -- apps/editor/src/ui/explicit-psd-import`: whitespace errors なし。CRLF conversion warnings のみ。

Gnome evidence として考慮した確認:

- `pnpm.cmd typecheck`: pass
- `pnpm.cmd run check:source`: pass
- `git diff --check -- apps/editor/src/ui/explicit-psd-import`: pass with CRLF conversion warnings only

## Residual Risks

- Primary summary の `raw bytes not persisted by parser bridge` は provenance / privacy 状態として許容範囲だが、文言はやや実装寄りである。Domain C の blocking ではないが、後続の final PSD Import Task polish v1 でより人間向けに言い換える余地がある。
- Advanced Workflow Controls には materialization / persistence / diagnostics の legacy detail が残る。今回の scope は primary human summary と task-window suitability の bounded polish であり、Diagnostics / Evidence View への完全分離は後続 wave の範囲として扱う。
- Browser visual verification は未実施。Domain C は CSS/window shell ownership を持たないため、最終 task window placement / responsive verification は B/G/H の統合検証で扱うべきである。

## User-Decision Points

なし。

`needs_user_input`: なし。  
`needs_design_decision`: なし。

## Verdict

`pass`

Domain C は、Wave54 の PSD-specific task-window content polish として受領可能である。Generic shell / routing / workflow semantics へ踏み出さず、primary human summary の machine-only detail 除外と focused PSD behavior preservation が確認できた。
