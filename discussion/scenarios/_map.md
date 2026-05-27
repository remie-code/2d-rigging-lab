# Scenarios Map

> `discussion/scenarios/` 直下のファイル・ディレクトリだけを示す地図。下層の詳細は各ディレクトリ内の `_map.md` に委譲する。

---

## 位置付け

`scenarios/` は、Acceptance Criteria を検証可能な具体シナリオへ精緻化するトピックである。

現在のRoot/MVP baselineは Private 2D Rigging Lab / Prototype である。MVP横断シナリオとDomain scenarioはPrivate Prototype / Future分類へ更新済みである。

## 直下のファイル

| Path | Role | Status |
|------|------|--------|
| [_map.md](_map.md) | `scenarios/` 直下の入口地図 | Private baselineの注意書きへ更新済み |
| [03_MVP_Acceptance_Criteria.md](03_MVP_Acceptance_Criteria.md) | Private Authoring-to-Viewer Prototype を検証する横断シナリオ | Minimum Open Dynamics v1込みへ更新済み |

## 直下のディレクトリ

| Path | Role | Status |
|------|------|--------|
| [02_DomainAcceptanceCriteria/](02_DomainAcceptanceCriteria/) | ドメインACに対応する精緻化シナリオ | DOMAIN-09 Dynamics scenarioをRuntimeState evidence込みのCurrent MVPへ更新済み |

## 現在の焦点

| 項目 | 状態 |
|------|------|
| Root/MVPとの関係 | Root/MVP ACが現在baseline。MVP横断とDomain scenarioは更新済み |
| Cubism参照操作 | private research archiveまたは非対応説明へ分離済み |
| MVP横断シナリオ | Private Authoring-to-Viewer Prototypeへ更新済み |
| Dynamics scenario | Minimum Open Dynamics v1のinitial/final RuntimeState evidence、1 group = 1 output、validation、demo-safe captureへ更新済み |

## 次の行動

1. Current scenarioを実装時のtest/contractへ落とす。
2. Future scenarioを再開する場合は、別途ユーザー判断、scope再定義、rights/dependency reviewを行う。
3. Demo/proposal運用時に、demo policyとproposal templateを更新する。

## 未決事項

| 項目 | 状態 |
|------|------|
| シナリオIDの正式採番規則 | 既存接頭辞を継続。移行時に再確認 |
| Cubism参照操作をreportsへ移すか、scenario内のResearch notesへ残すか | 非対応・private research archive文脈へ限定済み |
| MVP用の権利クリーン素材fixtureをどの方式で作るか | 未決 |
