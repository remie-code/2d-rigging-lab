# 閉問題 19: 結果（差分管理 Ware グループ + 在庫の形式所属）

> 定義: [problem-definition.md](problem-definition.md) / 実験報告: [experiment/report.md](experiment/report.md) + [report-addendum.md](experiment/report-addendum.md)

## 経過（2026-07-06、本体+追補とも一発通過）

- 本体（三十一代目、rev 560→601、41 op）: Ware グループ（singleSelect、Default/Rodos/Endoministrator、13 drawable）。Default rest **sha256 バイト一致**・可視集合 4走完全一致・切替レンダ完全置換。ユーザー判定「意図通りのものが出来上がっている」。**runtime-player でのライブ切替もユーザー実機確認済み**
- 追補（三十二代目、rev 601→610、9 op）: 下半身在庫（legwear/footwear/tail/endomi_back + bottomwear×3）のキー無しデフォーマ形式所属（アトラス仕様対応）。endomi_back は所属先行で var_endoministrator へ、BodyZ 追従キャリア（±6.0000°・残差 0.000px）。validate strict 診断 0
- **31〜32代 reject 累計ゼロ継続。これにて1周目完了**（追従・揺れ・口パク・着替えが player で動作、ユーザー確認済み）

## 獲得（craft/10 へ蒸留済み)

1. **順序則4段: 所属 → メッシュ → デフォーマ → 可視旗**（cp14 空メッシュ罠 × 可視ゲート `baseVisible AND 所属` の合成則）
2. **レンダ3点セットが validator の代役**: Default rest sha 一致 / 可視集合の機械 assert / 切替目視——variant 検査の無い validator を実験側で補完する型
3. **形式所属の2型**: 静的在庫 = ルート直下キー無し warp / 追従のみ = 親 rig 直下キー無し warp（キーフォーム数不変 = 恒等の構造証明）
4. 運用: no-op reject を確認の証跡に使う / host 入口 ZodError と operation reject の区別

## 運用知見

- 三十一代目の質問対応が模範: 定義の意味論（「bottoms part の下衣」）と現実（ware part の bottomwear）の不一致を、推測で埋めず解決案付きの質問として停止 → ユーザー裁定で確定。**指揮書の一級規則「不一致停止」の実証例**
- 三十二代目は仕様に無い必要 op（endomi_back 可視旗復元）を既存則から自力導出し、逸脱として旗を立てた
