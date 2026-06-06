# Wave48 Domain D Review

Target: `wave48-editor-import-plan-preview-explicit-approval-ux`

Verdict: `pass`

## Re-review Addendum

Re-review target: bounded D-F1 fix in `apps/editor/src/ui/explicit-psd-import/explicit-psd-import-panel.ts` and `apps/editor/src/ui/explicit-psd-import/explicit-psd-import-panel.test.ts`.

Final verdict: `pass`.

D-F1 is resolved. The panel now records the last generated approved refs on the approved refs textarea via `data-last-generated-approved-refs` (`apps/editor/src/ui/explicit-psd-import/explicit-psd-import-panel.ts:170-177`), synchronizes checkbox changes back to that textarea and updates the approved-batch button state (`apps/editor/src/ui/explicit-psd-import/explicit-psd-import-panel.ts:281-287`), and applies the same stale-selection guard in the submit handler before calling intake (`apps/editor/src/ui/explicit-psd-import/explicit-psd-import-panel.ts:312-333`). The helper compares current parsed refs against the last generated approved refs and disables execution while they differ (`apps/editor/src/ui/explicit-psd-import/explicit-psd-import-panel.ts:686-730`).

The added regression covers the previously missing path: changing approvals without regenerating preview disables approved execution, shows the re-preview diagnostic, avoids intake calls, then allows execution after the regenerated plan matches the new approved list (`apps/editor/src/ui/explicit-psd-import/explicit-psd-import-panel.test.ts:209-263`).

New findings introduced by the fix: none found.

Final design/development compliance: pass. The fix stays inside Editor UI/test scope, does not change package/validator contracts, does not add dependencies or parser imports, keeps group/root discovery as candidate preview only, and preserves explicit approved leaf execution semantics. A focused scan of the touched files found no direct `@webtoon/psd` import, Cubism SDK/Core reference, or positive all-layer/group-import/recursive-auto-import claim beyond negative test assertions.

Final test adequacy: pass for Domain D. The new regression directly covers approval/unapproval dirty state before approved execution, while the existing focused tests still cover preview projection, hidden/unsupported/not-approved behavior, bridge-backed approved leaf execution, and broad wording guards.

Re-review verification:

- Inspected the D-F1 fix directly in `explicit-psd-import-panel.ts`.
- Inspected the D-F1 regression directly in `explicit-psd-import-panel.test.ts`.
- Ran `git diff --check -- apps/editor/src/ui/explicit-psd-import/explicit-psd-import-panel.ts apps/editor/src/ui/explicit-psd-import/explicit-psd-import-panel.test.ts`; passed with LF-to-CRLF working-copy warnings only.
- Ran focused direct parser/Cubism import scan over the touched files; no matches.
- Ran focused forbidden positive-claim scan over the touched files; only negative test assertions matched.
- Accepted Orch-Sylph post-fix verification: approved focused Vitest rerun passed 5 files / 22 tests; `pnpm.cmd typecheck`, `pnpm.cmd run check:source`, `pnpm.cmd run check:deps`, `node scripts/check-psd-parser-import-boundary.mjs`, and the broader `git diff --check` all passed as reported.

## Findings

### D-F1: UI 上で unapprove した変更が、古い cached plan の approved list 実行に反映されない

Status: resolved on re-review. Original severity: high.

候補チェックボックスは preview form の textarea だけを更新している。`apps/editor/src/ui/explicit-psd-import/explicit-psd-import-panel.ts:227-240` では checkbox change が `syncImportPlanApprovedRefs` を呼び、この helper は `apps/editor/src/ui/explicit-psd-import/explicit-psd-import-panel.ts:261-278` で checked かつ eligible な refs を textarea に書く。一方、approved-batch submit path はその textarea や現在の checkbox state を読まない。button enable 条件は最後に projection された `viewModel.importPlanApprovedLayerNodeRefs` を使うだけであり（`apps/editor/src/ui/explicit-psd-import/explicit-psd-import-panel.ts:302-306`）、submit payload も `destinationParentPartId` だけである（`apps/editor/src/ui/explicit-psd-import/explicit-psd-import-panel.ts:320-323`）。

controller 側も表示中の未保存 checkbox state ではなく、最後に生成された cached plan を実行する。`currentExplicitPsdImportPlan` は preview workflow 実行時に `apps/editor/src/editor-workflow/workflow-controller.ts:897-908` で設定され、その後の approved execution は `apps/editor/src/editor-workflow/workflow-controller.ts:966-973` で `collectApprovedPsdImportPlanLeafRefs(currentExplicitPsdImportPlan)` を呼び、`apps/editor/src/editor-workflow/workflow-controller.ts:982-989` でその stale approved list を batch intake に渡す。

Impact: `layer_headwear` を approved にした preview を生成した後、ユーザーがその候補を uncheck して visible approved-ref textarea が空になった状態でも、`Update import-plan preview` を押さずに `Add approved leaf candidates` を押せる。このとき UI は unapproved に見えるが、controller は古い cached approved leaf を materialize する。これは「ユーザーが leaf candidates を明示 approve/unapprove し、approved list だけを実行する」という Wave48 approval boundary を破る（`discussion/implementation/orchestration/wave48-plan.md:195`, `:400`, `:402`）。

現行テストはこの実行 path を捕まえていない。`apps/editor/src/ui/explicit-psd-import/explicit-psd-import-panel.test.ts:153-183` は uncheck 後に preview form submit する case を cover し、`apps/editor/src/ui/explicit-psd-import/explicit-psd-import-panel.test.ts:186-204` は approval を変更しない approved execution を cover している。approval state を変更した後、plan を再生成する前に approved execution を押す regression はない。

推奨修正: approved execution path が current approved refs を実行するのは refreshed plan に反映された後だけにする、または local checkbox/textarea state が最後に生成された plan と違う間は approved execution を disable する。focused regression では、approved candidate を uncheck した場合、その候補を再度 approved にした preview を生成しない限り実行されないことを固定するべき。

## Design / Development Compliance Summary

- PSD input direction は概ね準拠している。実装は root/group import-plan preview と explicit leaf approval surface を追加しており、visible wording は all-layer one-click import や direct group import 表現を避けている。Domain D source scan では positive な all-layer / recursive group auto-import claim は見つからなかった。
- Candidate plan projection は十分に情報を出している。source digest/provenance/count fields は `apps/editor/src/editor-state/explicit-psd-import-plan-state.ts:70-97` で projection され、visible facts は source digest/provenance、scope、counts、hidden/unsupported/collision/byte-blocked totals、byte estimates を `apps/editor/src/editor-state/explicit-psd-import-view-model.ts:287-323` で含む。generated scaffold IDs も candidate labels に含まれる（`apps/editor/src/editor-state/explicit-psd-import-view-model.ts:350-371`）。
- Approval boundary は「最後に生成された plan」に対しては正しいが、stale UI changes に対して不十分。latest-plan filtering は workflow/bridge tests 上 hidden/unsupported/not-approved candidates を除外しているが、D-F1 により表示上の unapproval を accidental に bypass できる。
- Domain C bridge use は存在する。approved import-plan execution は `importPlanBridge` を構築し、collected approved refs だけを Wave47 batch path に渡している（`apps/editor/src/editor-workflow/workflow-controller.ts:976-989`）。batch intake は bridge を operation request に載せる（`apps/editor/src/editor-workflow/selected-psd-layer-batch-intake-workflow.ts:536-538`）。
- Private/local provenance と no raw parser/source PSD byte persistence claims は displayed/import-plan state と bridge summaries に保持されている。Domain D による raw parser object persistence や public demo asset claim の追加は見つからなかった。
- Source organization は許容範囲。`apps/editor/src/editor-state/index.ts` と `apps/editor/src/editor-workflow/index.ts` は barrel export 追加のみで、catch-all/god file 追加は見つからなかった。Domain D scope に manifest/lockfile dependency change はない。

## Test Adequacy Summary

focused tests は有用な lane を cover している。具体的には candidate preview state/view model、hidden/unsupported/not-approved filtering、approved leaves only の bridge evidence、import-plan bridge 付き batch execution、panel rendering、checkbox-to-preview-form approval updates、forbidden broad wording、legacy batch controls で group rows が disabled になること。

D-F1 を cover するまでは approval/unapproval UX の test adequacy は不足。missing regression は「displayed plan の candidate approval を変更し、preview を再生成せずに approved execution を試す」case。期待挙動は no execution または explicit stale-preview error であるべき。

## Verification

この review で実施した確認:

- orchestration/context hygiene instructions と Wave48 basis docs を読んだ。
- Domain D source/tests と、Domain D が使う upstream Domain B/C contracts を確認した。
- collision awareness として `git status --short -uall` を確認した。`packages/**` changes は upstream Domain C/E 由来として扱い、Domain D implementation とは扱っていない。
- `git diff --check -- apps/editor/src` を実行した。LF-to-CRLF working-copy warnings のみで pass。
- Domain D plan/approval UI/workflow files に direct PSD parser/Cubism SDK import がないことを scan した。match なし。
- barrel diff を確認した。`index.ts` files は export 追加のみ。

Orch-Sylph evidence として受理した検証:

- Focused Vitest command は approved rerun で pass: 5 files / 21 tests。
- `pnpm.cmd typecheck`: pass。
- `pnpm.cmd run check:source`: pass。
- `pnpm.cmd run check:deps`: pass。
- `node scripts/check-psd-parser-import-boundary.mjs`: pass。5 direct import/resolve sites は approved adapter と Wave44 scripts に限定。
- `git diff --check -- apps/editor/src apps/editor/e2e discussion/implementation/waves/wave48 discussion/implementation/reviews/wave48`: LF-to-CRLF warnings のみで pass。

## Remaining Issues

- Domain D blocking issue は残っていない。
- Domain E artifacts は worktree に存在し、review artifact には独自 status がある。この review では指示通り Domain E を collision awareness 以外では無視した。

## User-Decision Points

Domain D fix に必要な user decision はない。この finding は accepted explicit leaf approval UX scope 内の修正である。

## Provisional Assumptions

- Wave47 final pass を implementation-proven baseline として扱った。
- Wave48 Domain A/B/C はこの review の accepted pass gates として扱った。
- Domain D は Editor UI/workflow のみを owns する。package/validator behavior は、Domain D が bypass しない限り upstream または out of scope として扱った。
