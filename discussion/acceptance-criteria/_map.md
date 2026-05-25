# Acceptance Criteria Map

> `discussion/acceptance-criteria/` 直下のファイル・ディレクトリだけを示す地図。下層の詳細は各ディレクトリ内の `_map.md` に委譲する。

---

## 位置付け

`acceptance-criteria/` は、Open Live2D Stack の受け入れ基準を保持するトピックである。

元のAI-native Live2D Editor向けACを、`discussion/concept/modified_concept.md` の方針に基づいて Open Live2D Stack 前提へ再編している。

## 直下のファイル

| Path | Role | Status |
|------|------|--------|
| [_map.md](_map.md) | `acceptance-criteria/` 直下の入口地図 | 更新済み |
| [00_RootQuestion.md](00_RootQuestion.md) | プロジェクトで作るものを定義する根本問い | Open Live2D Stack 前提へ更新済み |
| [01_RootAcceptanceCriteria.md](01_RootAcceptanceCriteria.md) | ルートAC | Open Live2D Stack 前提へ更新済み |
| [03_MVP_Acceptance_Criteria.md](03_MVP_Acceptance_Criteria.md) | MVP AC | GUI Editor必須の Authoring-to-Runtime MVP へ全面再構築済み |
| [判断原則.md](%E5%88%A4%E6%96%AD%E5%8E%9F%E5%89%87.md) | ACに含めるかどうかの判断原則 | Open Source / Cubism非依存前提へ更新済み |

## 直下のディレクトリ

| Path | Role | Status |
|------|------|--------|
| [02_DomainAcceptanceCriteria/](02_DomainAcceptanceCriteria/) | ドメイン別AC | Domain 01-25 へ拡張済み |

## 次の行動

1. MVP AC の Domain AC変更候補を、必要に応じて Salamander / ユーザー判断へ回す
2. GUI Editor 必須の Authoring-to-Runtime MVP を、Open Model Format / Editor / Runtime / Viewer / Validator / AI Agent Interface の最小仕様へ落とす
3. MVP横断シナリオを実装計画・検証計画へ分解する

## 未決事項

| 項目 | 状態 |
|------|------|
| シナリオ化またはMVP再定義で見つかったAC不足をどこに一時記録するか | MVP AC本文の「Domain AC変更候補」に一時記録済み。恒久反映先は未決 |
| 新規 Domain 15-25 をすべて同じ粒度でシナリオ化するか | 未決 |
