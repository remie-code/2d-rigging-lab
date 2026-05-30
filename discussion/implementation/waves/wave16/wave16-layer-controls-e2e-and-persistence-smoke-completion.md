# Wave 16 Domain E Completion: Layer Controls E2E And Persistence Smoke

> Wave: `drawable-layer-controls-and-visibility-authoring`
> Domain: `wave16-layer-controls-e2e-and-persistence-smoke`
> Date: 2026-05-30

## Verdict

`pass`

Domain E は Drawable layer controls の browser-level smoke を追加し、create drawable 後の runtime visibility hide/show、draw order move up/down、保存済み package file set、再読込後 UI / preview state を desktop / mobile E2E で検証した。

## Files Changed

Editor E2E:

- `apps/editor/e2e/layer-controls-smoke.mjs`
- `apps/editor/e2e/smoke-checks.mjs`
- `apps/editor/e2e/test-ids.mjs`

Reports:

- `discussion/implementation/waves/wave16/wave16-layer-controls-e2e-and-persistence-smoke-completion.md`
- `discussion/implementation/reviews/wave16/wave16-layer-controls-e2e-and-persistence-smoke-review.md`

## Implementation Summary

- 既存 editor smoke の create drawable workflow 後に layer controls workflow を接続した。
- `apps/editor/e2e/layer-controls-smoke.mjs` を追加し、layer controls 専用の E2E アサーションを単一責務で分離した。
- Domain D の stable test id を E2E 側へ反映した:
  - `drawable.layer.status`
  - `drawable.visibility.<drawableId>`
  - `drawable.moveUp.<drawableId>`
  - `drawable.moveDown.<drawableId>`
- Runtime visibility workflow:
  - 作成 drawable を hide し、row state `Hidden`、preview summary `1 visible / 2 total`、preview visual からの除外を確認。
  - 作成 drawable を show し、row state `Visible`、preview summary `2 visible / 2 total`、preview visual 復帰を確認。
  - 最終的に再度 hide して保存し、hidden state の persistence smoke も固定。
- Draw order workflow:
  - `draw_body` の move up、move down、再 move up を操作。
  - drawable list DOM order が `[created, draw_body]` / `[draw_body, created]` / `[created, draw_body]` と deterministic に変わることを確認。
  - 保存後 package file set の `model/draw-order.json` でも `[created, draw_body]` の順序を確認。
- Save/load workflow:
  - operation log line count が 9 件になることを確認。
  - 保存済み `model/drawables.json` で作成 drawable の `runtimeVisibility: false` を確認。
  - 再読込後、list order、row `Hidden` state、preview summary `1 visible / 2 total`、preview visual からの除外を確認。
- 既存の preview slider smoke、AI approval smoke、create drawable smoke、reset smoke は同じ E2E path 内で継続して通る。

## Verification

| Command | Result | Notes |
|---|---|---|
| `pnpm.cmd test:e2e` | pass after sandbox escalation | 初回 sandbox 実行は Vite dependency `fdir` 解決で失敗。エスカレーション実行で desktop / mobile smoke が pass。 |
| `pnpm.cmd typecheck` | pass after sandbox escalation | sandbox 実行は `tsc` 読み取り EPERM で失敗。エスカレーション実行で root/editor typecheck が pass。 |
| `pnpm.cmd run check:source` | pass | Source organization guard passed. |
| `git diff --check -- apps/editor/e2e discussion/implementation/waves/wave16/wave16-layer-controls-e2e-and-persistence-smoke-completion.md discussion/implementation/reviews/wave16/wave16-layer-controls-e2e-and-persistence-smoke-review.md` | pass | LF/CRLF warning のみ。 |
| `Select-String -Path apps/editor/e2e/layer-controls-smoke.mjs -Pattern '[ \t]+$'` | pass | 新規 E2E helper に trailing whitespace なし。 |

E2E screenshot metadata:

- desktop preview screenshot: `png base64Length=68052`
- desktop drawable screenshot: `png base64Length=94292`
- mobile preview screenshot: `png base64Length=39172`
- mobile drawable screenshot: `png base64Length=41240`

## Review Findings And Fixes Applied

Independent Review-Sylph の初回 verdict は `escalate`。

- Source-level blocking finding はなし。
- reviewer 側では sandbox 内 `pnpm.cmd test:e2e` が Vite dependency 解決で止まり、必須 E2E pass を直接観測できなかった。
- 追加指摘として、最初の実装は save 時の最終 visibility が visible であり、hidden state の persistence smoke として弱いリスクがあった。

Fix applied:

- layer workflow の最後に作成 drawable を再度 hide し、その hidden state を保存・再読込で検証するよう強化。
- 保存済み package file set で `createdVisible: false` を確認。
- 再読込後に preview summary `1 visible / 2 total`、作成 drawable が preview visual に存在しないこと、row state `Hidden`、reordered list を確認。
- 修正後に `pnpm.cmd test:e2e`、`pnpm.cmd typecheck`、`pnpm.cmd run check:source`、diff whitespace check を再実行。
- Review-Sylph 再レビュー verdict は `pass`。

## Remaining Issues

- E2E harness の標準 console output は layer 専用 screenshot metadata を出さない。`runLayerControlsWorkflow` は screenshot を取得しているが、`scripts/editor-e2e-smoke.mjs` は今回の書き込み許可範囲外だったためログ出力追加は行っていない。
- Accessibility evidence は Domain E smoke 範囲であり、完全な accessibility tree audit ではない。

## User-Decision Points

None.

