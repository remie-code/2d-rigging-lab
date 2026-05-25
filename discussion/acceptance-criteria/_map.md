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
| [03_MVP_Acceptance_Criteria.md](03_MVP_Acceptance_Criteria.md) | MVP AC | Open Model Format / Runtime / Viewer 中心へ更新済み |
| [判断原則.md](%E5%88%A4%E6%96%AD%E5%8E%9F%E5%89%87.md) | ACに含めるかどうかの判断原則 | Open Source / Cubism非依存前提へ更新済み |

## 直下のディレクトリ

| Path | Role | Status |
|------|------|--------|
| [02_DomainAcceptanceCriteria/](02_DomainAcceptanceCriteria/) | ドメイン別AC | Domain 01-25 へ拡張済み |

## 次の行動

1. 新規 Domain 15-25 のシナリオ化優先順位を決める
2. 既存 Domain 01-10, 12 のシナリオを Open Stack 前提で再確認する
3. Open Model Format / Runtime / Viewer の最小仕様へ落とす

## 未決事項

| 項目 | 状態 |
|------|------|
| シナリオ化の過程で見つかったAC不足をどこに一時記録するか | 未決 |
| 新規 Domain 15-25 をすべて同じ粒度でシナリオ化するか | 未決 |
