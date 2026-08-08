# Scenarios Map

> `discussion/scenarios/` 直下のファイル・ディレクトリだけを示す地図。下層の詳細は各ディレクトリ内の `_map.md` に委譲する。

---

## 位置付け

`scenarios/` は、Acceptance Criteria を検証可能な具体シナリオへ精緻化するトピックである。

現在のRoot/MVP baselineは Private 2D Rigging Lab / Prototype である。MVP横断シナリオとDomain scenarioはPrivate Prototype / Future分類へ更新済みである。Root/MVP ACがproduct requirementの合否オラクルであり、Dynamics の schema / solver / cardinality の具体的実装意味論は accepted [dynamics-file-v3 design](../design/dynamics-world-frame-chain.md) と [Wave106](../implementation/waves/wave106/_map.md) を参照する。

## 直下のファイル

| Path | Role | Status |
|------|------|--------|
| [_map.md](_map.md) | `scenarios/` 直下の入口地図 | Private baselineの注意書きへ更新済み |
| [03_MVP_Acceptance_Criteria.md](03_MVP_Acceptance_Criteria.md) | Private Authoring-to-Viewer Prototype を検証する横断シナリオ | Minimum Open Dynamics v1込みの要求オラクルへ更新済み（具体的Dynamics semanticsはdesign/Wave106） |

## 直下のディレクトリ

| Path | Role | Status |
|------|------|--------|
| [02_DomainAcceptanceCriteria/](02_DomainAcceptanceCriteria/) | ドメインACに対応する精緻化シナリオ | DOMAIN-09 Dynamics scenarioをRuntimeState evidence込みのCurrent MVP要求オラクルへ更新済み（具体的Dynamics semanticsはdesign/Wave106） |

## 現在の焦点

| 項目 | 状態 |
|------|------|
| Root/MVPとの関係 | Root/MVP ACが現在baseline。MVP横断とDomain scenarioは更新済み |
| Cubism参照操作 | private research archiveまたは非対応説明へ分離済み |
| MVP横断シナリオ | Private Authoring-to-Viewer Prototypeへ更新済み |
| Dynamics scenario | Minimum Open Dynamics v1のinitial/final RuntimeState evidence、validation、demo-safe captureへ更新済み。solver/cardinalityはaccepted dynamics-file-v3 design/Wave106へ委譲し、旧one-output/scalar要約をCurrent oracleとしない |

## 次の行動

1. Current scenarioの要求を実装済みtest/contractへ照合し、未達・再設計・人間ゲートを列挙する。
2. Future scenarioを再開する場合は、別途ユーザー判断、scope再定義、rights/dependency reviewを行う。
3. Demo/proposal運用時に、demo policyとproposal templateを更新する。

## 未決事項

| 項目 | 状態 |
|------|------|
| シナリオIDの正式採番規則 | 既存接頭辞を継続。移行時に再確認 |
| Cubism参照操作をreportsへ移すか、scenario内のResearch notesへ残すか | 非対応・private research archive文脈へ限定済み |
| MVP用の権利クリーン素材fixtureをどの方式で作るか | 未決 |
| Domain-09 のDynamics v3 semantics/cardinalityをscenario本文へ反映する時期・表現 | accepted design/Wave106の実装意味論を参照しつつ、要求文面の追跡方法はユーザー判断 |
