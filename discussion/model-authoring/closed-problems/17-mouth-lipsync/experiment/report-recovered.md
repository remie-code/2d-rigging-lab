# cp17 実験報告（L0 による復元版）

> 二十九代目は全実装・全検証データの生成を完了した直後、最終報告の直前に Fable weekly 制限で停止した（2026-07-05、102 tool uses）。本報告は L0 が成果物（コミット列・コマンド応答・検証スクリプト）から復元したもの。**数値はすべて永続成果物由来であり、失われた情報は「本人の所見文」のみ**。

## 実行実績

- rev **463 → 512**（49 op = 49 git commit、[cp17] 接頭辞、reject ゼロ）
- 内訳: メッシュ生成5 + mouth_a メッシュ増強（fix-open-resize）/ ワープ作成5（rig_mouth_open + vowel i/u/e/o、mouth_a を rig_facex_mouth 配下へ編入）/ キーフォーム（open + 母音4）/ **Mouth Open 格子の自己修正2ラウンド**（9×7 → 21×19 → 25×23）/ 参照の一時表示⇄非表示の目視照合往復 ×4（ユーザー承認済み運用）

### 特筆: 自己駆動の格子解像度エスカレーション

コミットメッセージより: 「crush kink rides the silhouette; 9x7 undershot by +4.9px vs +2px gate」——潰し場の折れ線が閉じ口シルエットに追従するには 9×7 格子では +4.9px 不足（規定 gate +2px）と**自己の数値 gate で検出**し、キー削除→格子リサイズ→再キーの手順を2回転して 25×23 で gate を通した。格子規則の「場の曲率が格子を決める」の実例（潰し場は曲率が極端に高い）。

## 検証（L0 が measure-verify.mjs report で再実行、2026-07-05 復元時）

```
PASS open1:         恒等（avg 0.00px / max 0.00px）
PASS open0-rest:    閉じプロファイル一致（avg 0.34px / max 0.57px）+ 潰し高さ ≤ 閉じ+2px（worst 0.99px）
PASS open1-vowel_i: avg 1.50px / max 2.80px
PASS open1-vowel_u: avg 1.00px / max 2.26px
PASS open1-vowel_e: avg 0.83px / max 2.15px
PASS open1-vowel_o: avg 0.98px / max 2.40px    （規定: 列平均 ≤3px・最大 ≤6px）
VERIFY: ALL PASS
```

- **rest 差分の局在**: pre/post フルレンダの差分 **63 画素**、bbox はキャンバス座標 (984,521)〜(1016,531) = 口ドメイン内に完全局在（cp14 手続き）
- **validate strict の増分照合**: rev418 ベースライン 94 error → rev512 105 error。増分 +11 = 新ワープ11基（cp16 の6 + cp17 の5）の runtimeEvidenceMissing のみ。`warpLatticeUnsupportedProperty ×6` は cp02 の目 opacity キー由来の**既存**ファミリ（ベースラインにも同数存在）
- sweep レンダ: open {0, 0.5, 1} × 母音5種 + overlay 照合4枚が renders/ に揃っている

## ユーザー gate

Editor 実機で「口パクはできるようになっていた」（2026-07-05、Fable 制限回復後の第一報）。正式判定は results.md に記録する。
