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
| [ai-agent-connection-and-technology-stack.md](ai-agent-connection-and-technology-stack.md) | AI Agent 接続方式と Web-first TypeScript 技術スタック方針 | Draft / user-aligned |

## 現在の設計焦点

| 項目 | 状態 |
|------|------|
| MVP縦切りアーキテクチャ | Editor と Viewer は同一アプリ内機能にする方針。AI Agent 接続方式と技術スタック方針は初期整理済み |
| Open Model Package | Operation log は組み込む方向。詳細構成は保守性を重視して設計側に委任 |
| GUI Editor操作モデル | 操作モデルだけでなく、画面仕様として何を決めるべきかを深掘り予定 |
| Drawable / Mesh / Texture / Part | 詳細は設計側に委任。ただしMVP採否は作業量ではなく将来変更回避を基準にする |
| Parameter / Keyform | デフォルトと標準parameterは Cubism Editor の標準を強く参考にする方針 |
| Deformer相当構造 | 調査済み。MVPでは `rotation2d` と `warpLattice2d`、`bilinear-grid-v1`、deformer local rest space bind、parent-before-child評価を暫定採用 |
| Runtime評価セマンティクス | SDK/Core参照調査済み。全体Runtime評価pipeline、snapshot粒度、diagnostics severity はユーザー判断待ち |
| Viewer / Preview | 調査済み。Shared Runtime evaluation core共有、Editor-only state と runtime-visible state の分離を暫定採用 |
| Validator / Acceptance Runner | 解析的に判定可能な不可解状態の検出を中心にする |
| AI Agent Interface | File-level / GUI-level / Structured API-level の3層連携方針を記録済み。具体API方式は未決 |

## 次の行動

1. `initial-design-decisions-and-open-questions.md` の未決論点から、次に議論する項目を選ぶ。
2. GUI Editor の画面仕様として決めるべき項目を棚卸しする。
3. Runtime評価セマンティクスの調査レポートをもとに、説明・議論フェーズを設ける。
4. AI Agent接続方式を operation core / REST / WebSocket / MCP / desktop shell の具体設計へ落とす。

## 未決事項

| 項目 | 状態 |
|------|------|
| AI Agent は Editor に接続するか、package に対して外部処理するか | 3層連携方針は合意済み。MVPで採用する具体接続方式は未決 |
| Runtime は Editor preview と Viewer で同一実装にするか | Shared Runtime evaluation core を共有する方向で暫定合意。loader境界は未決 |
| GUI Editor の画面仕様としてどの項目を決めるか | 要深掘り |
| Deformer相当構造の技術的正体 | 調査済み。設計判断へ反映中 |
| Runtime評価セマンティクスの設計判断 | SDK/Core参照調査済み。MVP採用範囲、snapshot既定粒度、diagnostics severity は要議論 |
| AI Agent Interface の責務と境界 | 要議論 |
