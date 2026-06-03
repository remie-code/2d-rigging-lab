# Wave37 Domain F Gnome Fix Loop 1 Report

Date: 2026-06-03
Target: `wave37-integration-review-and-final-report`
Verdict: `done`

## 修正内容

- `apps/editor/src/styles/editor.css` の Project Storage レイアウトだけを修正した。
- `.project-persistence-panel__actions` と直接子要素へ `min-width: 0` / `max-width: 100%` を追加し、mobile grid item の min-content による横幅拡張を抑えた。
- `Import portable JSON` label と内部 file input に幅制約を追加し、native file input が action grid を広げないようにした。
- transport capability section / list / row / text に幅制約、list reset、折り返しを追加し、長い gate / issue ID が mobile viewport を押し広げないようにした。
- DOM、test id、transport capability の supported / unavailable / disabled semantics は変更していない。

## 変更ファイル

- `apps/editor/src/styles/editor.css`
- `discussion/implementation/waves/wave37/wave37-domain-f-gnome-fix-loop-1-report.md`

## 検証

- `pnpm.cmd typecheck`
  - pass.
- `pnpm.cmd exec vitest run apps/editor/src/ui/app-shell/app-shell.test.ts apps/editor/src/editor-state/transport-capability-view-model.test.ts`
  - pass, 2 test files / 26 tests.
- `pnpm.cmd test:e2e`
  - pass.
  - desktop smoke passed.
  - mobile smoke passed; initial horizontal overflow failureは再現しない。
- `git diff --check -- apps/editor/src/styles/editor.css apps/editor/src/ui/project-persistence apps/editor/e2e discussion/implementation/waves/wave37`
  - pass.
  - LF-to-CRLF working-copy warningsのみ。

## 残リスク / 判断点

- 残リスク: なし。
- 親セッション向け判断点: なし。

## 注記

通常の sandboxed PowerShell は `windows sandbox: spawn setup refresh` で起動できなかったため、必要な読み取りと検証は承認された escalated path で実行した。
