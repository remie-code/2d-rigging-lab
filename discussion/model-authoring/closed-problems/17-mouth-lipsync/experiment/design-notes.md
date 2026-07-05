# cp17 実験設計ノート（morph 場の導出式。実装者はこれを正とする）

> 対象 drawable: 基準 B = mouth_a（draw_r463_780c04ef_dc637e24）/ 閉じ参照 = mouth（draw_r0_1cea4f6f_3a8f6fa8）/ 母音参照 = mouth_i（…dc637e05）・mouth_u（…dc637ee6）・mouth_e（…dc637ec7）・mouth_o（…dc637ea0）
> 挿入親: rig_facex_mouth（既存追従塔の最内側）

## 1. 塔の構築

```
rig_facex_mouth ⊃ rig_mouth_open ⊃ rig_mouth_vowel_i ⊃ rig_mouth_vowel_u ⊃ rig_mouth_vowel_e ⊃ rig_mouth_vowel_o ⊃ mouth_a
```

- 母音間の順序は任意（単一非ゼロ運用）。全ワープの domainBounds は mouth_a の bbox 基準で同一（双子）。格子は格子規則に従い素材寸法から選ぶ（口は小さいので目安 7×5）
- mouth_a / 参照4枚のメッシュ有無を確認、無ければ generateMesh（空メッシュの罠）。参照はメッシュ生成後も**非表示のまま**
- 可視状態の確認と是正（op）: mouth_a = 表示、mouth（旧）と参照4枚 = 非表示

## 2. シルエットの実測（メッシュ境界方式が一次）

- 各対象を `inspectEvaluatedGeometry`（includeVertices、rest）で測り、頂点群から**プロファイル**を取る:
  - 口角: x_L = min(x), x_R = max(x)（頂点群の水平極値）
  - 列プロファイル: 水平を N 等分（N = 格子列数×2 以上）し、各帯の y_top(x) = min(y), y_bot(x) = max(y)
  - プロファイルは3点移動平均で平滑化（決定論）
- 自動メッシュは alpha 輪郭に沿うため、メッシュ外包 ≈ シルエット。**非表示でも測れる**（幾何は可視性と独立に計算される）
- 目視照合用に、参照を一時表示 → 口フォーカスレンダ → 非表示へ戻す（op コミット往復）を各母音1回行ってよい（ユーザー承認済みの運用）。ただし数値の正はメッシュ境界

## 3. morph 場（基準 B → 目標 T の格子キーフォーム）

各格子点 p = (x, y) について2段写像:

```
1. 水平（口角アフィン）: u = (x − x_L^B)/(x_R^B − x_L^B)
   x' = x_L^T + u·(x_R^T − x_L^T)
2. 垂直（列ごとの上下縁対応）: 基準列 x のプロファイル (y_top^B, y_bot^B)、目標列 x' の (y_top^T, y_bot^T)
   v = (y − y_top^B)/(y_bot^B − y_top^B)
   v ∈ [0,1]: y' = y_top^T + v·(y_bot^T − y_top^T)
   v < 0（口より上の格子行）: y' = y + (y_top^T − y_top^B)   （上縁のデルタで平行運搬）
   v > 1（口より下）: y' = y + (y_bot^T − y_bot^B)
statePatch = (x', y') − rest
```

- **MouthOpen キー0**: T = 閉じ口 mouth のプロファイル（高さがほぼ潰れる列は h_T が微小になるだけで式は同じ）。キー1 = 恒等
- **母音キー1**: T = 各参照のプロファイル。キー0 = 恒等
- 口角の外側（u<0 / u>1）の格子点: 最寄り口角のデルタで平行運搬（連続性）

## 4. 検証

1. **形の一致（成功基準 A-i）**: commit 後、(open=1, 母音=1) で mouth_a の評価済み頂点からプロファイルを再測し、参照プロファイルと比較——列平均残差 ≤3px・最大 ≤6px
2. **閉じの潰し**: open=0 で全列の高さ h ≤ 閉じ参照の h + 2px
3. **rest 差分の局在**: rest フルレンダの差分画素が口領域 bbox 内に局在（cp14 手続き）。口以外は sha 帯一致
4. 既存キー・既存 rig-controls・他 drawable バイト無傷 / dry-run diagnostics 0 / [cp17] 1 op = 1 コミット
5. sweep レンダ: open {0, 0.5, 1} × 各母音 {0, 1}（口フォーカス）+ rest 全身。自己目視: 唇の連続性・歯/舌の破綻の有無・「い の半開き」の成立
