# Scenarios Map

> `discussion/scenarios/` 直下のファイル・ディレクトリだけを示す地図。下層の詳細は各ディレクトリ内の `_map.md` に委譲する。

---

## 位置付け

`scenarios/` は、Acceptance Criteria を検証可能な具体シナリオへ精緻化するトピックである。

現在は、AI-native Live2D Editor 向けに起こした既存シナリオを、Open Live2D Stack 前提へ再編している。

MVPについては、GUI Editor 必須の Authoring-to-Runtime 一周を検証する横断シナリオを追加している。

## 直下のファイル

| Path | Role | Status |
|------|------|--------|
| [_map.md](_map.md) | `scenarios/` 直下の入口地図 | 2026-05-25 MVP横断シナリオ追加済み |
| [03_MVP_Acceptance_Criteria.md](03_MVP_Acceptance_Criteria.md) | GUI Editor必須の Authoring-to-Runtime MVP を検証する横断シナリオ | 新規作成済み |

## 直下のディレクトリ

| Path | Role | Status |
|------|------|--------|
| [02_DomainAcceptanceCriteria/](02_DomainAcceptanceCriteria/) | ドメインACに対応する精緻化シナリオ | Domain 201-225 対応ファイル作成済み。公式Cubism資料レビューを反映し、不足シナリオを追加済み |

## 現在の焦点

| 項目 | 状態 |
|------|------|
| Domain 201-225 対応 | すべてのDomain ACに対応するシナリオファイルが存在 |
| MVP横断シナリオ | [03_MVP_Acceptance_Criteria.md](03_MVP_Acceptance_Criteria.md) を作成し、GUI Editor制作、保存、再読み込み、Runtime / Viewer表示、Validator確認、AI diff確認までを記録 |
| 公式資料レビュー | Editor / SDK / Core / export / runtime / viewer関連資料を参考調査し、追加シナリオと下層 `_map.md` にURLを記録 |
| Cubism互換の扱い | 公式資料は参考資料。Open Stack の正は concept と AC / scenario。`.moc3`互換出力や`.cmo3`復元は初期成功条件にしない |
| AC変更候補 | 下層 [02_DomainAcceptanceCriteria/_map.md](02_DomainAcceptanceCriteria/_map.md) と MVP AC本文に記録 |

## 次の行動

1. MVP AC本文の Domain AC変更候補を、必要に応じて Salamander / ユーザー判断へ回す
2. MVP横断シナリオを Open Model Format / GUI Editor / Runtime / Viewer / Validator / AI Agent Interface の具体schema・APIへ落とす
3. 将来細分化候補を優先度付けする

## 未決事項

| 項目 | 状態 |
|------|------|
| シナリオIDの正式採番規則 | 既存接頭辞を継続。Domain 13-14 は `SC-AI` / `SC-WF` を採用 |
| Cubism参照操作と Open Stack期待結果の見出し構成 | 既存文体を維持。公式事実とOpen Stack判断を分離する |
| 公式資料レビューを別レポート化するか | 今回は下層 `_map.md` と追加シナリオ内URL記録で十分と判断し、独立reportは作成しない |
| MVP用の権利クリーン素材fixtureをどの方式で作るか | 未決。MVPシナリオの未決事項に記録 |
