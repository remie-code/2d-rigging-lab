# Discussion Map (Private 2D Rigging Lab / Prototype)

> `discussion/` 直下のファイル・ディレクトリだけを示す入口地図。下層の詳細は各ディレクトリ内の `_map.md` に委譲する。

---

## 位置付け

`discussion/` は Private 2D Rigging Lab / Prototype のコンセプト、AC、シナリオ、設計判断、調査、検証結果を保持する外部記憶である。

現在の正は、[concept/modified_concept.md](concept/modified_concept.md)、[acceptance-criteria/00_RootQuestion.md](acceptance-criteria/00_RootQuestion.md)、[acceptance-criteria/01_RootAcceptanceCriteria.md](acceptance-criteria/01_RootAcceptanceCriteria.md)、[acceptance-criteria/03_MVP_Acceptance_Criteria.md](acceptance-criteria/03_MVP_Acceptance_Criteria.md) である。

旧公開エコシステム前提は superseded であり、現在は次の4トラックを分離する。

- Private Prototype。
- Streaming Demo Surface。
- Live2D Feature Proposal。
- Future Public Clean Subset。

## 直下のファイル

| Path | Role | Status |
|------|------|--------|
| [_conventions.md](_conventions.md) | `discussion/` 全体の構造、命名、所有権、map運用、Demo and Proposal Hygiene の規約 | Private baselineへ更新済み |
| [_map.md](_map.md) | `discussion/` 直下の入口地図 | Private baselineへ更新済み |

## 直下のディレクトリ

| Path | Role | Status |
|------|------|--------|
| [concept/](concept/) | コンセプト、スコープ、方針変更メモ | Private baselineとmemo対応完了状態を記録済み |
| [acceptance-criteria/](acceptance-criteria/) | 受け入れ基準。後続作業のオラクル | Minimum Open Dynamics v1をCurrent MVPへ復帰済み |
| [scenarios/](scenarios/) | ACを検証可能な具体シナリオへ精緻化するトピック | Dynamics group / deterministic preview / validation / demo-safe scenarioへ更新済み |
| [design/](design/) | Private Prototype の設計論点、設計判断、未決事項、検証観点 | Private baseline設計判断、RuntimeState / RuntimeSequence evidence判断、Codex-friendly automation policyを反映済み。詳細なreview履歴は下層mapへ委譲 |
| [demo/](demo/) | Streaming Demo Surfaceの表示範囲、避けるもの、preflight、disclaimer | Dynamics demo allowed/avoidを追加済み |
| [proposal/](proposal/) | Live2D Feature Proposalのテンプレート、提案draft、非目標 | feature proposal templateを追加済み |
| [development_convention/](development_convention/) | P0/P1開発規約、source file organization規約、basis、統合レビュー成果物 | 旧 `/goal` 向け orchestration policy は破棄済み。実装オーケストレーションは `implementation/` 配下へ移動 |
| [implementation/](implementation/) | 実装オーケストレーション、wave計画、domain completion、review、integration、final report | Wave53 final integration report/review `pass` が最新 final implementation-proven baseline。Workspace Layout Migration v0 は bounded pass 記録済み |
| [runtime-player/](runtime-player/) | Editor外のRuntime Player / Capture Host appの調査、UX、設計、未決事項 | iFacialMocap input adapter調査、初期画面UX、Electron固定後の技術スタック判断を記録 |
| [model-authoring/](model-authoring/) | LLM(Fable)によるモデル制作挑戦の前提合意、閉問題、制作定石 | 前提合意4文書（可解性 / 運用方針 / 閉問題アプローチ / craft設計）と第一閉問題（01-eyeball-x）定義を記録済み |
| [mesh-generation/](mesh-generation/) | メッシュ自動生成の商用風改修(v7)の概念設計、現状調査、実装、品質評価、v6系整理 | Wave 1/1.1 実装完了。往復2所見「v6/v7一長一短」により保留中(v6/v7併存・トグル残置) |
| [render-performance/](render-performance/) | Editor/Viewer 描画パフォーマンス改善(計測基盤、実測、改善設計、実装、再計測) | 現状調査Recorded・方針Accepted(2026-07-07)。Perf Wave 1(計測基盤)進行中 |
| [editor-electron-migration/](editor-electron-migration/) | apps/editor の Web→Electron 移行(why合意、分解、work-stream) | why合意・分解Accepted(2026-07-08)。第一手=WS1(shell)未着手。詳細は下層mapへ委譲 |
| [reports/](reports/) | 技術調査・成立性調査レポート | Cubism関連はprivate research archive / implementation sourceではない |

## 現在の状態サマリ

| 項目 | 状態 |
|------|------|
| コンセプト変更 | Private 2D Rigging Lab / Prototype へ更新済み |
| 4トラック分離 | Private Prototype / Streaming Demo Surface / Live2D Feature Proposal / Future Public Clean Subset をroot conceptに記録済み |
| MVP再定義 | Private Authoring-to-Viewer Prototype へ更新済み |
| Cubism形式方針 | SDK/Core、Cubismモデル読み込み、`.model3.json`、`.moc3`、`.cmo3`、`.physics3.json`、`.motion3.json`、`.pose3.json` の検査・読み込みを行わない方針へ更新済み |
| Design contract | 旧Live2D名のPSD profileを `layered-character-psd-profile-v1` に置換済み |
| Domain AC / scenario | Domain 201-225をCurrent / Optional / Future分類へ整理済み |
| Design docs | `design/`配下をPrivate baseline語彙へ整理済み |
| GPT-5.5 Pro review responses | review 001-007 の反映済み判断は下層design文書へ委譲。最新のRuntimeState / RuntimeSequence artifact semanticsをreview_004単体から推定しない |
| Demo / Proposal | `demo/streaming-demo-policy.md` と `proposal/live2d-feature-proposal-template.md` を追加済み |
| Codex-friendly automation | [design/codex-friendly-automation-policy.md](design/codex-friendly-automation-policy.md) で、Editor/repoは提案・推論・自動分類を行わず、外部Codex/LLMが人間同等操作をdeterministic API経由で実行する方針をAccepted user decisionとして記録済み |
| Development Convention | `development_convention/` にP0/P1規約16本とsource file organization規約を追加済み。旧 `implementation-orchestration-policy.md` と `/goal` companion文書は破棄済み |
| Implementation baseline | **Editor実装は Wave102 をもって一旦完成（ユーザー決定、2026-07-02記録）**。wave plan は [implementation/orchestration/](implementation/orchestration/) に wave102-plan.md まで実在する。詳細なwave履歴は [implementation/_map.md](implementation/_map.md) と下層wave/review文書へ委譲。ただし implementation/_map.md の記録は Wave93 で止まっており、Wave94-102 の反映は未了（既知のドキュメント更新もれ） |
| Current implementation work | Editor実装は Wave102 で一旦停止中。現在の主戦場は [model-authoring/](model-authoring/)（Fableによるモデル制作挑戦）の対話フェーズと Runtime Player。Wave53 時代の詳細記述は superseded（履歴は implementation/ 下層に残存） |
| Implementation maps | 次Wave判断前は [implementation/current-capability-map.md](implementation/current-capability-map.md) と [implementation/remaining-work-backlog.md](implementation/remaining-work-backlog.md) を正として読む |
| Runtime Player topic | Editor外の追加appとして [runtime-player/](runtime-player/) を作成。iFacialMocapをv0 tracking input adapter候補にする調査は [runtime-player/research/ifacialmocap-input-adapter-research.md](runtime-player/research/ifacialmocap-input-adapter-research.md)、初期画面UXは [runtime-player/screens/initial-runtime-player-screen.md](runtime-player/screens/initial-runtime-player-screen.md)、Electron固定後の技術スタックは [runtime-player/architecture/technology-stack-decision.md](runtime-player/architecture/technology-stack-decision.md)、Runtime Player Wave1計画は [runtime-player/implementation/orchestration/player-wave1-plan.md](runtime-player/implementation/orchestration/player-wave1-plan.md) に記録 |
| memo/new_concept.md対応 | `discussion/`文書移行は完了扱い。実装・法務・素材・提案テーマ・Future公開subsetは別課題 |
| Model Authoring topic | 「Fableに2Dモデルを作らせる」挑戦を [model-authoring/](model-authoring/) として作成（2026-07-02）。可解性分析・運用方針（ヘッドレス専有 / Git巻き戻し / 判定の梯子）・閉問題アプローチを premises/ に合意記録済み。第一閉問題は [model-authoring/closed-problems/01-eyeball-x/problem-definition.md](model-authoring/closed-problems/01-eyeball-x/problem-definition.md) |
| Mesh Generation topic | メッシュ自動生成の商用風改修を [mesh-generation/](mesh-generation/) として作成（2026-07-07）。Wave 1(v7実装)・Wave 1.1(境界非クランプ+密度)完了。目視評価 往復2 の所見「v6/v7一長一短」により**保留中**(v6/v7併存・トグル残置・Wave 2棚上げ)。経緯は [mesh-generation/evaluation-log.md](mesh-generation/evaluation-log.md) |
| Render Performance topic | Editor/Viewer 描画パフォーマンス改善を [render-performance/](render-performance/) として作成（2026-07-07）。現状調査は [reports/editor-render-performance/](reports/editor-render-performance/)。方針合意済み(主戦場=Editor共有経路 / 決定性二層分離 / 計測→設計)。Perf Wave 1(計測基盤)から実行 |
| Editor Electron Migration topic | apps/editor の Web→Electron 移行を [editor-electron-migration/](editor-electron-migration/) として作成（2026-07-08）。why合意・分解(3系統コード調査由来)をAccepted。第一手=WS1(shell)、本丸=WS2(persistence node:fs化)。FS Access は Electron Chromium で存続するため移行は非破壊・段階的。portable-JSON は消費者なし(本エディタのみ)のため廃止確定。**WS1(shell)完了・pass(2026-07-08、electron-vite build 緑 + 実機 smoke 緑)**。次は WS2(persistence)。先在債務 `task_c8fc5155`(editor typecheck/test 赤)は独立処理 |

## 次の行動

1. 次の実装判断では [implementation/_map.md](implementation/_map.md)、[implementation/remaining-work-backlog.md](implementation/remaining-work-backlog.md)、[design/screen-design/_map.md](design/screen-design/_map.md)、[design/codex-friendly-automation-policy.md](design/codex-friendly-automation-policy.md) をbasisにし、Editor実装はWave102で一旦完成として扱う（implementation/_map.md の Wave94-102 反映は未了である点に注意）。
2. external HTTP / WebSocket / MCP API work と LLM provider integration は、MVP境界が明示変更されるまで Future scope に留める。
3. 各implementation domainには [development_convention/source-file-organization-policy.md](development_convention/source-file-organization-policy.md) を渡し、巨大 `index.ts` / catch-all source file をReview-Sylphのblocking対象にする。
4. Demo-safe preflightの自動検査項目とrights-clean fixtureを実装時に具体化する。
5. Future Public Clean Subsetが必要になった場合は別途scope設計とrights/dependency reviewを行う。
6. Fableによるモデル制作の検討では [model-authoring/_map.md](model-authoring/_map.md) を入口にする。
7. メッシュ自動生成の商用風改修では [mesh-generation/_map.md](mesh-generation/_map.md) を入口にする(現在保留中)。
8. 描画パフォーマンス改善では [render-performance/_map.md](render-performance/_map.md) を入口にする。
9. Runtime Player検討では [runtime-player/_map.md](runtime-player/_map.md)、[runtime-player/architecture/technology-stack-decision.md](runtime-player/architecture/technology-stack-decision.md)、[runtime-player/architecture/runtime-player-development-policy.md](runtime-player/architecture/runtime-player-development-policy.md)、[runtime-player/research/ifacialmocap-input-adapter-research.md](runtime-player/research/ifacialmocap-input-adapter-research.md)、[runtime-player/screens/initial-runtime-player-screen.md](runtime-player/screens/initial-runtime-player-screen.md)、[runtime-player/implementation/orchestration/player-wave1-plan.md](runtime-player/implementation/orchestration/player-wave1-plan.md) を入口にする。
10. editor の Electron 移行では [editor-electron-migration/_map.md](editor-electron-migration/_map.md) を入口にする。第一手は WS1(shell)実装→実機観測。

## 未決事項

| 項目 | 状態 |
|------|------|
| Streaming Demo Surface の専用ポリシー文書 | 作成済み。運用時にpreflight項目を更新 |
| Live2D Feature Proposal のテンプレート | 作成済み。個別提案draftは未作成 |
| Domain AC / scenario のmemo対応 | 完了 |
| Future Public Clean Subset の具体範囲 | 現在MVP外。必要時に別途再設計 |
| implementation/_map.md の Wave94-102 バックフィル | 未了。既知のドキュメント更新もれ。orchestration/ に plan は実在する |
