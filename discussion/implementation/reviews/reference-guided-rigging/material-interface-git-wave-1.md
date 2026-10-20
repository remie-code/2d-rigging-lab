# 素材インターフェース git 前提化 Wave 1 レビュー

レビュー: Review-Sylph（sonnet）1 レーン、軽量方式。2026-10-20。対象はコミット d095bf6c の差分（packages/ 配下）。
判定: **PASS with warnings**。blocking なし。

## 観点ごとの結果

| 観点 | 結果 |
|---|---|
| 計画・判断との突き合わせ（足すだけ、旧経路を維持） | 問題なし |
| 差し替えの共有キー・共有メッシュの拒否 | 問題なし |
| バイト未登録・ハッシュ不一致・全透明・ID 衝突の拒否 | 問題なし（申告 digest での照合の範囲） |
| dry-run と拒否時の不変性 | 問題なし |
| 旧 build の挙動維持 | 問題なし |
| 規約（barrel、依存境界、命名） | 問題なし |

## 指摘と対応

| # | 指摘 | 対応 |
|---|---|---|
| warning 1 | operationId を省略すると、A→B→A の差し替えが ID 衝突になる | Wave 1 内で対応。種に `basePackageRevision` を含めた。テストを追加 |
| warning 2 | core は申告された digest と `w*h*4` しか見ない | Wave 2 の受け入れ条件へ。ホストで寸法・inset・ハッシュを照合する形で実装済み |
| warning 3 | log にバイトが入らないことのテストが偽陽性になりうる | Wave 1 内で対応。payload を期待形と toEqual で照合し、JSON 全体にバイト列の形が現れないことも確認 |
| warning 4 | 拒否時に登録バイトが残る | Wave 2 の受け入れ条件へ。別セッションでの登録として実装済み |
| suggestion | ロック対象が狭い | 対応。replace に旧 mesh / texture、add に sibling を追加 |
| suggestion | 拒否テストの不足 | 対応。全透明・衝突を追加し、log と入力セッションが変わらないことを確認 |

対応後の確認: `pnpm typecheck` 通過、`pnpm test:unit` 1574 件通過、`pnpm typecheck:authoring-host` 通過（L0 が再実行）。
