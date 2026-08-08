# Acceptance Criteria Map

> `discussion/acceptance-criteria/` 直下のファイル・ディレクトリだけを示す地図。下層の詳細は各ディレクトリ内の `_map.md` に委譲する。

---

## 位置付け

`acceptance-criteria/` は、Private 2D Rigging Lab / Prototype の受け入れ基準を保持するトピックである。

Product requirement の正は [../concept/modified_concept.md](../concept/modified_concept.md) と Root/MVP AC である。`memo/new_concept.md` は入力メモとして扱う。Dynamics の schema / solver / cardinality などの実装意味論は、要件オラクルを置き換えず、accepted [dynamics-file-v3 design](../design/dynamics-world-frame-chain.md) と [Wave106](../implementation/waves/wave106/_map.md) を参照する。

Domain AC本文はPrivate Prototype baselineへ整理済みである。歴史的なファイル名が残るものもあるが、active requirementはRoot/MVP baselineに従う。Domain-09 の合否はACが担い、具体的なDynamics semantics/cardinalityは上記 accepted design/Wave106 が担う。

## 直下のファイル

| Path | Role | Status |
|------|------|--------|
| [_map.md](_map.md) | `acceptance-criteria/` 直下の入口地図 | Private baselineへ更新済み |
| [00_RootQuestion.md](00_RootQuestion.md) | プロジェクトで作るものを定義する根本問い | Private 2D Rigging Lab / Prototypeへ更新済み |
| [01_RootAcceptanceCriteria.md](01_RootAcceptanceCriteria.md) | ルートAC | Private Prototype / Demo and Proposal Hygieneへ更新済み |
| [03_MVP_Acceptance_Criteria.md](03_MVP_Acceptance_Criteria.md) | MVP AC | Private Authoring-to-Viewer Prototype + Minimum Open Dynamics v1 RuntimeState evidenceの要求オラクルへ更新済み（具体的Dynamics semanticsはdesign/Wave106） |
| [判断原則.md](%E5%88%A4%E6%96%AD%E5%8E%9F%E5%89%87.md) | ACに含めるかどうかの判断原則 | Private baselineへ更新済み |

## 直下のディレクトリ

| Path | Role | Status |
|------|------|--------|
| [02_DomainAcceptanceCriteria/](02_DomainAcceptanceCriteria/) | ドメイン別AC | DOMAIN-09をCurrent MVP for Minimum Open Dynamics v1 RuntimeState evidenceの要求オラクルへ更新済み（具体的Dynamics semanticsはdesign/Wave106） |

## 次の行動

1. Current Domain AC/scenario のcontract/test traceabilityを実装済み成果と照合し、未達・再設計・人間ゲートを列挙する。
2. Future分類のSDK/API/配信アプリ/sample公開を再開する場合は、別途ユーザー判断と設計reviewを行う。
3. Demo/proposal運用時に、hygiene ruleとdisclaimerを更新する。

## 未決事項

| 項目 | 状態 |
|------|------|
| Domain ACのmemo対応 | 完了。残りはcurrent contract/test traceabilityと未解決ゲートの確認 |
| `判断原則.md` | Private baselineへ更新済み |
| 新規 Demo / Proposal domain | 既存rights domainと専用demo/proposal文書で扱う |
| Domain-09 のDynamics v3 semantics/cardinalityをAC本文へ反映する時期・表現 | accepted design/Wave106の実装意味論を参照しつつ、要求文面の追跡方法はユーザー判断 |
