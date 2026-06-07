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
| [implementation/](implementation/) | 実装オーケストレーション、wave計画、domain completion、review、integration、final report | Wave52 final integration report/review `pass` が最新 final implementation-proven baseline。範囲は bounded PSD Import Task Migration / `check:testids` standard integration に限定 |
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
| Implementation baseline | Wave52 final integration report/review `pass` が最新 final implementation-proven baseline。詳細なwave履歴は [implementation/_map.md](implementation/_map.md) と下層wave/review文書へ委譲 |
| Current implementation work | Wave52 `psd-import-task-migration-v0` は [implementation/orchestration/wave52-plan.md](implementation/orchestration/wave52-plan.md) に基づき、Domains A-F と Domain G final integration が `pass`。PSD Import は Empty / Authoring Workspace から Task Shell task として開け、default では常設の巨大 workspace panel ではない。focused PSD regressions と `check:testids` standard integration も pass。final Toolbox placement、final modal/task-window/dedicated-view policy、full visual redesign、full panel migration、Mesh / Atlas / Parameter / Variant UI は未実装 |
| Implementation maps | 次Wave判断前は [implementation/current-capability-map.md](implementation/current-capability-map.md) と [implementation/remaining-work-backlog.md](implementation/remaining-work-backlog.md) を正として読む |
| memo/new_concept.md対応 | `discussion/`文書移行は完了扱い。実装・法務・素材・提案テーマ・Future公開subsetは別課題 |

## 次の行動

1. 次の実装判断では [implementation/current-capability-map.md](implementation/current-capability-map.md)、[implementation/remaining-work-backlog.md](implementation/remaining-work-backlog.md)、[design/screen-design/_map.md](design/screen-design/_map.md)、[design/codex-friendly-automation-policy.md](design/codex-friendly-automation-policy.md)、および必要に応じて [implementation/orchestration/wave52-plan.md](implementation/orchestration/wave52-plan.md) をbasisにし、Wave52を最新final baselineとして扱う。
2. external HTTP / WebSocket / MCP API work と LLM provider integration は、MVP境界が明示変更されるまで Future scope に留める。
3. 各implementation domainには [development_convention/source-file-organization-policy.md](development_convention/source-file-organization-policy.md) を渡し、巨大 `index.ts` / catch-all source file をReview-Sylphのblocking対象にする。
4. Demo-safe preflightの自動検査項目とrights-clean fixtureを実装時に具体化する。
5. Future Public Clean Subsetが必要になった場合は別途scope設計とrights/dependency reviewを行う。

## 未決事項

| 項目 | 状態 |
|------|------|
| Streaming Demo Surface の専用ポリシー文書 | 作成済み。運用時にpreflight項目を更新 |
| Live2D Feature Proposal のテンプレート | 作成済み。個別提案draftは未作成 |
| Domain AC / scenario のmemo対応 | 完了 |
| Future Public Clean Subset の具体範囲 | 現在MVP外。必要時に別途再設計 |
