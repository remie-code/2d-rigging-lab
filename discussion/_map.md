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
| [design/](design/) | Private Prototype の設計論点、設計判断、未決事項、検証観点 | RuntimeState evidence contractとreview_004対応記録へ更新済み |
| [demo/](demo/) | Streaming Demo Surfaceの表示範囲、避けるもの、preflight、disclaimer | Dynamics demo allowed/avoidを追加済み |
| [proposal/](proposal/) | Live2D Feature Proposalのテンプレート、提案draft、非目標 | feature proposal templateを追加済み |
| [development_convention/](development_convention/) | P0/P1開発規約、source file organization規約、basis、統合レビュー成果物 | 旧 `/goal` 向け orchestration policy は破棄済み。実装オーケストレーションは `implementation/` 配下へ移動 |
| [implementation/](implementation/) | 実装オーケストレーション、wave計画、domain completion、review、integration、final report | Wave 0 foundation planを `implementation/orchestration/wave0-plan.md` に作成済み |
| [reports/](reports/) | 技術調査・成立性調査レポート | Cubism関連はprivate research archive / implementation sourceではない |

## 現在の焦点

| 項目 | 状態 |
|------|------|
| コンセプト変更 | Private 2D Rigging Lab / Prototype へ更新済み |
| 4トラック分離 | Private Prototype / Streaming Demo Surface / Live2D Feature Proposal / Future Public Clean Subset をroot conceptに記録済み |
| MVP再定義 | Private Authoring-to-Viewer Prototype へ更新済み |
| Cubism形式方針 | SDK/Core、Cubismモデル読み込み、`.model3.json`、`.moc3`、`.cmo3`、`.physics3.json`、`.motion3.json`、`.pose3.json` の検査・読み込みを行わない方針へ更新済み |
| Design contract | 旧Live2D名のPSD profileを `layered-character-psd-profile-v1` に置換済み |
| Domain AC / scenario | Domain 201-225をCurrent / Optional / Future分類へ整理済み |
| Design docs | `design/`配下をPrivate baseline語彙へ整理済み |
| GPT-5.5 Pro review 001 | `memo/gpt-5.5-pro-review/reveiw_001.md` のP0/P1/P2指摘を分類し、反映可能なものは `discussion/design/gpt-5.5-pro-review-001-response.md` と関連文書へ反映済み |
| GPT-5.5 Pro review 002 | `memo/gpt-5.5-pro-review/review_002.md` のRE3-001〜RE3-020を分類し、Minimum Open Dynamics v1復帰として反映済み。Dynamics詳細はreview_003で上書き |
| GPT-5.5 Pro review 003 | `memo/gpt-5.5-pro-review/review_003.md` のRE-FINAL-001〜RE-FINAL-018を分類し、explicit RuntimeStateDto、1 group = 1 output、weighted sum、solver固定式、validator/fixture/traceability確定版として反映済み。RuntimeState evidence詳細はreview_004で上書き |
| GPT-5.5 Pro review 004 | `memo/gpt-5.5-pro-review/review_004.md` のP0/P1/P2を分類し、initial RuntimeState生成、`RuntimeSequenceFrameDto[]`、operation final state evidence、`runtime/states/` artifact方針として反映済み。RuntimeSequence / artifact ref詳細はreview_005で上書き |
| GPT-5.5 Pro review 005 | `memo/gpt-5.5-pro-review/review_005.md` のP0/P1/P2を分類し、`evaluateRuntimeSequence(frames, ..., context)`、`RuntimeStateArtifactRefSchema`、AI response命名統一、packageHash fallbackとして反映済み。RuntimeState sequence artifact / RuntimeEvaluationContext統合詳細はreview_006で上書き |
| GPT-5.5 Pro review 006 | `memo/gpt-5.5-pro-review/review_006` の指摘を分類し、単一RuntimeState artifactとRuntimeState sequence artifactの分離、`RuntimeEvaluationContextDto`統合、Operation/AI/Fixture証拠参照規約として反映済み。RuntimeStateSequenceArtifactのinitial/post-frame意味論とdeterministic replay evidence詳細はreview_007で上書き |
| GPT-5.5 Pro review 007 | `memo/gpt-5.5-pro-review/review_007.md` 相当の指摘を分類し、`RuntimeStateSequenceArtifact.states[0]` initial / `states[i + 1]` post-frame規約、`runtime.stateSequenceLengthMismatch`、sequence evidence fields、`RuntimeEvaluationContextSchema.policy.default({})` として反映済み |
| Demo / Proposal | `demo/streaming-demo-policy.md` と `proposal/live2d-feature-proposal-template.md` を追加済み |
| Development Convention | `development_convention/` にP0/P1規約16本とsource file organization規約を追加済み。旧 `implementation-orchestration-policy.md` と `/goal` companion文書は破棄済み |
| Implementation Wave 0 | 2026-05-28にmonorepo scaffold / package skeleton / guard scripts / smoke test / persistent reportsを作成し、`pnpm check` 通過。active 開発規約の package 名は `contracts` / `validator-core` に統一済み |
| Implementation Wave 1 | `contracts-foundation` の依存順序と Orch-Sylph 並列性を [implementation/orchestration/wave1-plan.md](implementation/orchestration/wave1-plan.md) に日本語で作成済み |
| memo/new_concept.md対応 | `discussion/`文書移行は完了扱い。実装・法務・素材・提案テーマ・Future公開subsetは別課題 |

## 次の行動

1. [implementation/orchestration/wave1-plan.md](implementation/orchestration/wave1-plan.md) をレビューする。
2. 承認後、Wave 1を `wave1-contracts-zod-and-core` から起動する。
3. 各implementation domainには [development_convention/source-file-organization-policy.md](development_convention/source-file-organization-policy.md) を渡し、巨大 `index.ts` / catch-all source file をReview-Sylphのblocking対象にする。
4. Demo-safe preflightの自動検査項目とrights-clean fixtureを実装時に具体化する。
5. Live2Dへ最初に提案する機能単位をユーザー判断で選び、proposal templateから個別draftを作る。
6. Future Public Clean Subsetが必要になった場合は別途scope設計とrights/dependency reviewを行う。

## 未決事項

| 項目 | 状態 |
|------|------|
| Streaming Demo Surface の専用ポリシー文書 | 作成済み。運用時にpreflight項目を更新 |
| Live2D Feature Proposal のテンプレート | 作成済み。個別提案draftは未作成 |
| Domain AC / scenario のmemo対応 | 完了 |
| Future Public Clean Subset の具体範囲 | 現在MVP外。必要時に別途再設計 |
