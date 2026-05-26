# Design Map

> `discussion/design/` 直下のファイル・ディレクトリだけを示す地図。下層や個別設計ファイルを作る場合は、その階層の `_map.md` に詳細を委譲する。

---

## 位置付け

`design/` は、Open Live2D Stack の設計論点、設計判断、未決事項、調査待ち、設計が満たすべき検証観点を保持するトピックである。

MVPは GUI Editor 必須の Authoring-to-Runtime 一周へ再定義済みであるため、設計も GUI Editor、Open Model Package、Runtime / Viewer、Validator、AI Agent Interface を分離せず、MVP縦切りとして扱う。

## 直下のファイル・ディレクトリ

| Path | Role | Status |
|------|------|--------|
| [_map.md](_map.md) | `design/` 直下の入口地図 | 作成済み |
| [initial-design-decisions-and-open-questions.md](initial-design-decisions-and-open-questions.md) | MVP更新後の設計10項目に対するユーザー判断、委任範囲、要調査・要議論事項 | Draft |
| [ai-agent-connection-and-technology-stack.md](ai-agent-connection-and-technology-stack.md) | AI Agent 接続方式と Web-first TypeScript 技術スタック方針 | Draft / user-aligned |
| [module-contract-design-goal.md](module-contract-design-goal.md) | 次の `/goal` に与える module contract design の到達目標、要求粒度、トレーサビリティ要求 | Goal preparation / scope discussion |
| [mvp-authoring-runtime/](mvp-authoring-runtime/_map.md) | GUI Editor必須の Authoring-to-Runtime MVP を実装へ進める前に固定すべき縦切り設計文書群 | Draft |

## 現在の設計焦点

| 項目 | 状態 |
|------|------|
| MVP縦切りアーキテクチャ | [mvp-authoring-runtime/](mvp-authoring-runtime/_map.md) で Editor / Preview / Viewer / Runtime / Validator / AI Agent Interface の責務と Shared Runtime core 境界をDraft設計済み |
| Open Model Package | [mvp-authoring-runtime/](mvp-authoring-runtime/_map.md) でファイル構成、stable ID、operation log、versioning、metadata、validation境界をDraft設計済み |
| GUI Editor操作モデル | [mvp-authoring-runtime/](mvp-authoring-runtime/_map.md) で画面領域、主要パネル、初心者導線、Editor-only state分離、画面仕様完了条件をDraft設計済み |
| Drawable / Mesh / Texture / Part | 詳細は設計側に委任。ただしMVP採否は作業量ではなく将来変更回避を基準にする |
| Parameter / Keyform | デフォルトと標準parameterは Cubism Editor の標準を強く参考にする方針 |
| Deformer相当構造 | 調査済み。MVPでは `rotation2d` と `warpLattice2d`、`bilinear-grid-v1`、deformer local rest space bind、parent-before-child評価を暫定採用 |
| Runtime評価セマンティクス | [mvp-authoring-runtime/](mvp-authoring-runtime/_map.md) で評価pipeline、snapshot粒度、diagnostics severity、unsupported diagnosticsをDraft設計済み。Angle X/Y合成など一部は実装前未決 |
| Viewer / Preview | 調査済み。Shared Runtime evaluation core共有、Editor-only state と runtime-visible state の分離を暫定採用 |
| Validator / Acceptance Runner | [mvp-authoring-runtime/](mvp-authoring-runtime/_map.md) で解析的検出対象、Editor警告、runtime load test、代表parameter評価、AI-readable reportの関係をDraft設計済み |
| AI Agent Interface | [mvp-authoring-runtime/](mvp-authoring-runtime/_map.md) で3層連携、operation core / model core / validator core、dry-run / diff / repair / provenance / revalidationをDraft設計済み |
| Module Contract Design | [module-contract-design-goal.md](module-contract-design-goal.md) で、TypeScript + Web 実装に向けた module boundary、shared contracts、operation/runtime/validator/GUI/AI contract、fixture、traceability の必要粒度を整理済み |

## 次の行動

1. Module contract design の成果物範囲を決める。現時点のユーザー意見は「文書だけでなく TypeScript 型スケッチまで作るべき」である。
2. TypeScript contract の source of truth、出力先、出力ファイルフォーマットを決める。
3. [module-contract-design-goal.md](module-contract-design-goal.md) をもとに、次の `/goal` 指示文を作る。
4. [mvp-authoring-runtime/](mvp-authoring-runtime/_map.md) の設計セットに記録した実装前未決事項を、module contract design の中で解消または明示的な判断待ちへ分類する。

## 次の `/goal` 前にユーザーとUndineで決める項目

| 項目 | 状態 / 推奨 |
|------|-------------|
| 次の設計成果物の範囲 | ユーザー意見として TypeScript 型スケッチまで含めるべき。正式な `/goal` 範囲として確定する |
| TypeScript contract の source of truth | JSON Schema / Zod / TypeScript type の役割分担を決める。候補: package file format は schema 系、module間 contract は TypeScript interface |
| Module contract 設計の出力先 | 既存Draftとは別に `discussion/design/module-contracts/` などの成果物階層を作るか決める |
| 出力ファイルフォーマット | 各成果物の必須セクション、表、TypeScript code block、traceability、検証方法を先に固定するか決める |
| サブエージェントレビュー方針 | 設計タスク内でレビューを必須にするか決める。候補: AC trace、TS contract整合、fixture妥当性の3観点レビュー |
| Angle X / Y の斜め方向評価 | 1D合成か `bilinear-parameter-grid-v1` かを決める。推奨: MVPでは2D evaluator前提でcontract化 |
| PSD import vs split PNG primary | MVP primary inputを決める。推奨: split PNG + provenance をprimary、PSDはoptional |
| GUI authoring evidence | MVP達成判定の必須証拠を決める。推奨: operation log必須、Playwright trace / session metadataは補助 |
| Structured API transport | AI dry-runの最初の入口を決める。推奨: MVPは in-process command bus、HTTP/WebSocket/MCP は追加transport |

## 次の `/goal` で明確にする項目

| 項目 | goalで具体化させる内容 |
|------|------------------------|
| Module boundaries | `contracts`, `package-format`, `authoring-core`, `operation-core`, `runtime-core`, `validator-core`, `renderer-adapter`, `editor-ui`, `viewer-ui`, `ai-interface` の責務、所有state、禁止依存、public API |
| TypeScript contracts | branded ID、package DTO、`AuthoringGraph`、`NormalizedRuntimeGraph`、`RuntimeSnapshot`、operation、diagnostic、validation report、diff、AI command の型スケッチ |
| Package file format mapping | `model/*.json` と TypeScript DTO の対応、必須/任意、参照制約、version field、schema validation境界 |
| Operation contracts | operation request / response、precondition、dry-run、commit、undo / redo、operation log entry、model/runtime/validation diff |
| Runtime core contract | `evaluateRuntime(...)` の入力/出力、snapshot detail、evaluator version、epsilon policy、disabled future layers、deterministic comparison |
| Validator contract | check ID registry、severity / status、validation profile、report schema、repair candidate、AC / scenario traceability |
| GUI operation contract | UI event -> operation mapping、canvas操作payload、screen state、stable test id、GUI authoring evidence |
| AI command contract | `inspectModel`, `getRuntimeSnapshot`, `validatePackage`, `dryRunOperation`, diff、repair candidate、approval、revalidation のrequest / response |
| Fixtures and contract tests | minimal valid、tutorial-like、invalid texture、deformer cycle、mask invalid、out-of-range dry-run、AI repair dry-run と expected snapshot/report/diff |
| Traceability matrix | AC -> module/API/type/test、Scenario -> operation flow、Diagnostic -> AC/scenario、Fixture -> expected output |
| Implementation confusion guards | coordinate system、ID生成、operation log最小項目、warning fail閾値、missing texture、mask opacity 0、fixture保存場所、subagent write ownership |

## 未決事項

| 項目 | 状態 |
|------|------|
| AI Agent は Editor に接続するか、package に対して外部処理するか | 3層連携としてDraft設計済み。Structured APIのtransportは実装前未決 |
| Runtime は Editor preview と Viewer で同一実装にするか | Shared Runtime evaluation core を共有し、package loader / authoring graph adapter は外側に置くDraft設計済み |
| GUI Editor の画面仕様としてどの項目を決めるか | Draft設計済み。実装前にAngle X/Y UI、PSD vs split PNG primary、mask preview粒度などを確定する |
| Deformer相当構造の技術的正体 | 調査済み。設計判断へ反映中 |
| Runtime評価セマンティクスの設計判断 | Draft設計済み。Angle X/Y合成、compositionMode、mask opacity 0、missing texture severity、epsilonPolicy は実装前未決 |
| AI Agent Interface の責務と境界 | Draft設計済み。transport、GUI test id規則、承認UI、provenance保存粒度は実装前未決 |
| 次の設計成果物の範囲 | ユーザー意見として TypeScript 型スケッチまで含めるべき。これを次の議論で正式な `/goal` 範囲として固める |
| Module contract の source of truth | JSON Schema / Zod / TypeScript type の分担を決める必要がある |
| Module contract 設計の出力先 | `discussion/design/module-contracts/` など、既存Draftとは別の成果物階層にするかを決める |
