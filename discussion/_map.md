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
| [acceptance-criteria/](acceptance-criteria/) | 受け入れ基準。後続作業のオラクル | Root/MVP/Domain ACをPrivate Prototype / Future分類へ更新済み |
| [scenarios/](scenarios/) | ACを検証可能な具体シナリオへ精緻化するトピック | MVP横断とDomain scenarioをPrivate Prototype / Future分類へ更新済み |
| [design/](design/) | Private Prototype の設計論点、設計判断、未決事項、検証観点 | Private baseline語彙へ整理済み |
| [demo/](demo/) | Streaming Demo Surfaceの表示範囲、避けるもの、preflight、disclaimer | streaming demo policyを追加済み |
| [proposal/](proposal/) | Live2D Feature Proposalのテンプレート、提案draft、非目標 | feature proposal templateを追加済み |
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
| Demo / Proposal | `demo/streaming-demo-policy.md` と `proposal/live2d-feature-proposal-template.md` を追加済み |
| memo/new_concept.md対応 | `discussion/`文書移行は完了扱い。実装・法務・素材・提案テーマ・Future公開subsetは別課題 |

## 次の行動

1. Current AC/scenario/designを実装task、module contract、testへ落とす。
2. Demo-safe preflightの自動検査項目とrights-clean fixtureを実装時に具体化する。
3. Live2Dへ最初に提案する機能単位をユーザー判断で選び、proposal templateから個別draftを作る。
4. Future Public Clean Subsetが必要になった場合は別途scope設計とrights/dependency reviewを行う。

## 未決事項

| 項目 | 状態 |
|------|------|
| Streaming Demo Surface の専用ポリシー文書 | 作成済み。運用時にpreflight項目を更新 |
| Live2D Feature Proposal のテンプレート | 作成済み。個別提案draftは未作成 |
| Domain AC / scenario のmemo対応 | 完了 |
| Future Public Clean Subset の具体範囲 | 現在MVP外。必要時に別途再設計 |
