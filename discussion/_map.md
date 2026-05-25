# Discussion Map (Open Live2D Stack)

> `discussion/` 直下のファイル・ディレクトリだけを示す入口地図。下層の詳細は各ディレクトリ内の `_map.md` に委譲する。

---

## 位置付け

`discussion/` は Open Live2D Stack のコンセプト、AC、シナリオ、設計判断、調査、検証結果を保持する外部記憶である。

## 直下のファイル

| Path | Role | Status |
|------|------|--------|
| [_conventions.md](_conventions.md) | `discussion/` 全体の構造、命名、所有権、map運用の規約 | 起草済み |
| [_map.md](_map.md) | `discussion/` 直下の入口地図 | 起草済み |

## 直下のディレクトリ

| Path | Role | Status |
|------|------|--------|
| [acceptance-criteria/](acceptance-criteria/) | Salamander が起草した受け入れ基準。後続作業のオラクル | 起草済み・配下 map 起草済み |
| [scenarios/](scenarios/) | Undine が AC を検証可能な具体シナリオへ精緻化するトピック | Domain 01-12 ドラフト作成済み |
| [reports/](reports/) | 技術調査・成立性調査レポート | cmo3/moc3仕様調査を開始 |
| [concept/](concept/) | コンセプト、スコープ、方針変更メモ | Open Live2D Stack への変更メモ作成済み |
| [design/](design/) | Open Live2D Stack の設計論点、設計判断、未決事項、検証観点 | MVP更新後の初期設計判断を記録開始 |

## 現在の焦点

| 項目 | 状態 |
|------|------|
| コンセプト変更 | AI-native Live2D Editor から Open Live2D Stack へ変更 |
| AC再編 | Root/MVP/主要ドメインを Open Live2D Stack 前提へ更新中 |
| シナリオ精緻化 | Domain 01-12 対応シナリオを作成済み。Domain 11 は Open Package 前提へ更新済み |
| 設計議論 | GUI Editor必須MVPを前提に、設計10項目の初期判断と未決論点を `design/` に記録開始 |
| 技術調査 | `.cmo3` と `.moc3` は初期成功条件から外し、移行・参照調査対象へ整理 |
| map整備 | 直下のみを説明する階層型 map 方針へ修正済み |

## 次の行動

1. 新規 Domain 15-25 のシナリオ化方針を決める
2. 既存 Domain 01-10, 12 のシナリオを Open Stack 前提で再確認する
3. Open Model Format / Runtime / Viewer の最小仕様を起こす
4. `design/` の未決論点から、AI Agent接続方式、GUI画面仕様、Runtime評価セマンティクスを順に議論する

## 未決事項

| 項目 | 状態 |
|------|------|
| `scenarios/` 配下に公式資料メモを置くか、別トピックに分けるか | 未決 |
| デフォーマシナリオで Cubism Editor の参照操作と Open Stack期待結果をどの見出しで分離するか | 未決 |
| シナリオIDの採番規則 | 未決 |
| `.cmo3` 読み書きをMVP/シナリオに残すか、仕様非公開ならスコープ外へ落とすか | 初期成功条件から除外。移行元・参照資料・将来調査対象として扱う |
