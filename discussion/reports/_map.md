# Reports Map

> `discussion/reports/` 直下の調査トピックディレクトリだけを示す地図。下層の詳細は各調査トピック内の `_map.md` に委譲する。

---

## 位置付け

`reports/` は、技術調査、成立性調査、外部仕様・実装状況のレポートを保持するトピックである。

## 直下のファイル

| Path | Role | Status |
|------|------|--------|
| [_map.md](_map.md) | `reports/` 直下の入口地図 | 起草済み |

## 直下のディレクトリ

| Path | Role | Status |
|------|------|--------|
| [cmo3-moc3-format-spec/](cmo3-moc3-format-spec/) | `.cmo3` と `.moc3` の仕様公開状況、読み書き実装可能性、リスク調査 | レポート作成済み |
| [cubism-sdk-runtime-structure/](cubism-sdk-runtime-structure/) | Cubism SDK/Coreで `.moc3` をロードした後に観測できるランタイム構造の調査 | レポート作成済み |

## 次の行動

1. Cubism SDK for Web を使ったローカル実ロード実験の範囲を決める
2. 調査結果を受けて `SC-IN-004` の扱いをユーザーと決める

## 未決事項

| 項目 | 状態 |
|------|------|
| 調査結果を受けて SC-IN-004 を修正するか | 未決 |
