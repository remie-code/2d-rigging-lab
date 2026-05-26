# Module Contracts Map

> `discussion/design/module-contracts/` 直下の module contract design 成果物だけを示す地図。次の `/goal` で作成される個別設計文書の入口として使う。

## 位置付け

このディレクトリは、TypeScript + Web 実装に向けた contract-first module design の成果物を保持する。

目的は、後続のサブエージェント並列実装で齟齬が出ないように、module boundary、TypeScript contract、package file format mapping、operation/runtime/validator/GUI/AI contract、fixtures、traceability を具体化することである。

## 直下のファイル

| Path | Role | Status |
|------|------|--------|
| [_map.md](_map.md) | この module contract design 成果物群の入口地図 | 作成済み |

## 作成予定の成果物候補

| File | Role | Status |
|------|------|--------|
| `module-boundaries.md` | module責務、所有state、禁止依存、public API一覧 | 未作成 |
| `typescript-contracts.md` | shared ID、DTO、graph、snapshot、diagnostic、diff のTypeScript型スケッチ | 未作成 |
| `package-file-format-contract.md` | package内JSONファイルとTypeScript DTOの対応 | 未作成 |
| `operation-contracts.md` | operation request/response/precondition/diff/log entry | 未作成 |
| `runtime-core-contract.md` | runtime評価API、normalized graph、snapshot、evaluator version | 未作成 |
| `validator-contract.md` | check registry、profiles、report schema、repair candidate | 未作成 |
| `gui-operation-contract.md` | UI event -> operation mapping、screen state、test id、GUI evidence | 未作成 |
| `ai-command-contract.md` | AI command schema、dry-run、diff、approval、revalidation | 未作成 |
| `fixtures-and-contract-tests.md` | fixture一覧、expected snapshot/report/diff、contract test方針 | 未作成 |
| `traceability-matrix.md` | AC / scenario / module / API / fixture の対応 | 未作成 |
| `review-summary.md` | サブエージェントレビューの findings、対応状況、残未決事項 | 未作成 |

## 参照入口

| Path | Role |
|------|------|
| [../module-contract-design-goal.md](../module-contract-design-goal.md) | module contract design の到達目標 |
| [../module-contract-design-decisions.md](../module-contract-design-decisions.md) | `/goal` 前に合意した判断ログ |
| [../module-contract-output-format-template.md](../module-contract-output-format-template.md) | 次の `/goal` で作成する成果物の共通書式・ファイル別テンプレート |
| [../mvp-authoring-runtime/_map.md](../mvp-authoring-runtime/_map.md) | 既存MVP縦切りDraft設計成果物群 |

## 次の行動

1. `/goal` 指示文に、出力先を `discussion/design/module-contracts/` と明記する。
2. 出力ファイルフォーマット案をレビューし、サブエージェントレビュー方針、残る実装前判断をユーザーと固める。
3. 次の `/goal` で個別成果物を作成する。

## 未決事項

| 項目 | 状態 |
|------|------|
| 個別成果物の最終ファイル分割 | 候補あり。次の `/goal` 指示文で固定する |
| 各成果物の必須セクション | [../module-contract-output-format-template.md](../module-contract-output-format-template.md) に叩き台あり。レビュー待ち |
| サブエージェントレビュー観点 | AC / Scenario Traceability、TypeScript / Zod Contract Consistency、Fixture / Verification の3観点に確定 |
