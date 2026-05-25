# Design Map

> `discussion/design/` 直下のファイルだけを示す地図。下層や個別設計ファイルを作る場合は、その階層の `_map.md` に詳細を委譲する。

---

## 位置付け

`design/` は、Open Live2D Stack の設計論点、設計判断、未決事項、調査待ち、設計が満たすべき検証観点を保持するトピックである。

MVPは GUI Editor 必須の Authoring-to-Runtime 一周へ再定義済みであるため、設計も GUI Editor、Open Model Package、Runtime / Viewer、Validator、AI Agent Interface を分離せず、MVP縦切りとして扱う。

## 直下のファイル

| Path | Role | Status |
|------|------|--------|
| [_map.md](_map.md) | `design/` 直下の入口地図 | 作成済み |
| [initial-design-decisions-and-open-questions.md](initial-design-decisions-and-open-questions.md) | MVP更新後の設計10項目に対するユーザー判断、委任範囲、要調査・要議論事項 | Draft |

## 現在の設計焦点

| 項目 | 状態 |
|------|------|
| MVP縦切りアーキテクチャ | Editor と Viewer は同一アプリ内機能にする方針。AI Agent 接続方式は技術スタックと合わせて要議論 |
| Open Model Package | Operation log は組み込む方向。詳細構成は保守性を重視して設計側に委任 |
| GUI Editor操作モデル | 操作モデルだけでなく、画面仕様として何を決めるべきかを深掘り予定 |
| Drawable / Mesh / Texture / Part | 詳細は設計側に委任。ただしMVP採否は作業量ではなく将来変更回避を基準にする |
| Parameter / Keyform | デフォルトと標準parameterは Cubism Editor の標準を強く参考にする方針 |
| Deformer相当構造 | ドメイン技術調査が必要 |
| Runtime評価セマンティクス | ユーザーの解像度を上げるため、別途議論フェーズを設ける |
| Viewer / Preview | Cubism Editor / Viewer ができることを調査する候補 |
| Validator / Acceptance Runner | 解析的に判定可能な不可解状態の検出を中心にする |
| AI Agent Interface | 専用の議論フェーズが必要 |

## 次の行動

1. `initial-design-decisions-and-open-questions.md` の未決論点から、次に議論する項目を選ぶ。
2. AI Agent 接続方式を、技術スタック候補と合わせて検討する。
3. GUI Editor の画面仕様として決めるべき項目を棚卸しする。
4. Runtime評価セマンティクスの説明・議論フェーズを設ける。

## 未決事項

| 項目 | 状態 |
|------|------|
| AI Agent は Editor に接続するか、package に対して外部処理するか | 技術スタックと合わせて要議論 |
| Runtime は Editor preview と Viewer で同一実装にするか | 品質特性を検討し、あるべき姿を採用する |
| GUI Editor の画面仕様としてどの項目を決めるか | 要深掘り |
| Deformer相当構造の技術的正体 | 要調査 |
| Runtime評価セマンティクスの設計判断 | 要議論 |
| AI Agent Interface の責務と境界 | 要議論 |
