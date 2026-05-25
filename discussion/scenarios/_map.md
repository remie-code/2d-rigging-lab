# Scenarios Map

> `discussion/scenarios/` 直下のファイル・ディレクトリだけを示す地図。下層の詳細は各ディレクトリ内の `_map.md` に委譲する。

---

## 位置付け

`scenarios/` は、Acceptance Criteria を検証可能な具体シナリオへ精緻化するトピックである。

現在は、AI-native Live2D Editor 向けに起こした既存シナリオを、Open Live2D Stack 前提へ再編している。

## 直下のファイル

| Path | Role | Status |
|------|------|--------|
| [_map.md](_map.md) | `scenarios/` 直下の入口地図 | 更新済み |

## 直下のディレクトリ

| Path | Role | Status |
|------|------|--------|
| [02_DomainAcceptanceCriteria/](02_DomainAcceptanceCriteria/) | ドメインACに対応する精緻化シナリオ | Domain 01-12 ドラフト作成済み。Domain 15-25 新規Open Stackドメイン起草済み |

## 次の行動

1. Domain 15-25 のシナリオを Open Model Format / Runtime / Viewer / Validator の最小仕様へ落とす
2. Domain 01-10, 12 の既存シナリオから旧Cubism互換前提を除去する
3. Domain 13-14 のシナリオ化方針を決める

## 未決事項

| 項目 | 状態 |
|------|------|
| シナリオIDの採番規則 | 仮に既存 Domain 01-12 の接頭辞を継続 |
| Cubism参照操作と Open Stack期待結果の見出し構成 | Domain 01-12 で試作済み。Open Stack前提で再確認中 |
| 新規 Domain 15-25 のシナリオ粒度 | 既存例に合わせて各Domain 5シナリオ程度で起草済み |
