# 閉問題 19: 差分管理（Ware グループ = variant operation 列の初運用）

> 状態: Problem defined（2026-07-06）
> 前提調査: variant 書き側 operation 10種の実在・runtime-player ライブ切替の実装済みを確認（research 調査 2026-07-06、Sylph）。A 問題ギャップなし

## この問題の新しい未知

**variant operation 列の初運用** + **レンダベースの自己検証設計**（validator に variant 検査が皆無のため、実験側で「各選択の可視集合」を機械 gate にする）。加えて cp18 申し送りの解消: 場つなぎで false にした別衣装の可視旗は、variant ゲートが `baseVisible AND 所属` のため **membership 設定後に true へ戻す**（順序を誤ると衣装が重なって見える——所属先行・可視旗後行）。

## グループ設計（ユーザー合意 2026-07-05/06）

- グループ **Ware**（`vgrp_ware`、singleSelect）、variants: **Default（通常）/ Rodos / Endoministrator**
- 所属:
  - Default = 通常衣装（ware part の topwear / handwear-l/r）+ 通常の下衣（bottoms part の衣類 drawable、実験冒頭で棚卸し）+ **ネクタイ**
  - Rodos = rodos_ware の4枚（topwear / bottomwear / handwear-l/r）
  - Endoministrator = endoministrator の4枚
- 共有パーツ（首・髪・顔等）はターゲット外。defaultActive = Default

## 操作列（順序が仕様）

1. 棚卸し: ware / bottoms part の drawable 実 ID 確定。別衣装 bottomwear ×2 の**メッシュ生成**（空メッシュは可視旗と無関係に描画されない——cp18 の罠の教訓。bottomwear は rigging 対象外なので静的でよい）
2. `createVariantGroup`（singleSelect、initial variant = Default）→ `createVariant` ×2（Rodos / Endoministrator）
3. `addVariantTargetDrawable` + `setVariantMembership`（全ターゲット。**この段階では可視旗に触らない**）
4. `setVariantDefaultActiveSelection` = Default（initial 自動設定の確認込み）
5. 別衣装8枚（rodos 4 + endo 4）の可視旗を **true へ復元**（variant ゲートが Default 選択で隠すことを確認しながら）
6. 検証（下記）

## 検証（レンダが validator の代役）

1. **Default 不変（最重要）**: rest フルレンダが cp19 着手前と **sha256 バイト一致**（Default 選択の見た目 = 今日の見た目、が変わらないこと）
2. **可視集合の機械 assert**: 3選択それぞれで `inspectEvaluatedGeometry`（variantSelections 指定）の可視フラグを全ターゲットについて照合——期待集合（上の所属表）と完全一致。ネクタイは Default のみ true
3. **切替レンダ**: renderView（variantSelections）で Rodos / Endoministrator の全身レンダ——衣装が完全に置き換わり、重なり・欠けがないことを自己目視
4. 既存キー・rig 無傷 / dry-run diagnostics 0 / 1 op = 1 コミット [cp19] / report.md 漸進書き

## 判断の所在

| 判断 | 所在 |
|---|---|
| 所属表・操作列・検証設計 | 本定義が正 |
| 着替えの見た目の満足 | ユーザー gate（Editor プレビュー切替 + **runtime-player ライブ切替**の両方） |

## 除外事項

- validator への variant check 追加 / player 選択の永続化 / export 選択 UI（いずれもエディタ実装の領分、必要なら wave ルート）
- 眼鏡・帽子等の他アイテムのオン/オフグループ（将来）
- 表情差分（mouth 2〜10 等）の variant 化

## 成功基準

- **A**: 検証4点 green で committed
- **B**: ユーザーが Editor プレビューと player ライブ切替で3衣装を着替えて満足
