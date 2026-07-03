# 閉問題 03 実装記録（2026-07-03、ユーザー gate 待ち）

> 定義: [problem-definition.md](problem-definition.md)。7 operations、reject ゼロ、rev 87→94。

## A検証の結果

- **`wrapChildren` による親挿入: 成功**。`createWarpDeformer` に `wrapChildren:[{kind:"rigControl",id:...}×3]` を渡すと、既存の状態デフォーマ塔（`rig_eye_l_open/half/close`）がそのまま新デフォーマ `rig_eye_l_facex` の子に付け替わる（parentId の書き換えを operation が実施）。挿入後の回帰確認で目の開閉・眼球X・クリッピング全て無傷

## 実装

| 要素 | 構造 | キー |
|---|---|---|
| 鼻 | nose 10（`5c3cad87`、face 階層の基底鼻。表情セットの nose 1-9 とは別物）をメッシュ生成 → `Nose FaceX`（ref と同一 domain 991,467,19×32、5×5） | ref patch **点対点移植**（全点一様 ±54 = 純平行移動） |
| 顔 | `Face X`（ref と同一 domain 861,303,278×275、**7×7**） | ref patch 点対点移植（内部の波: 上顔面中央 65-74 最大、顎先スパイク、外周ゼロ固定） |
| 左目 | `Eye L FaceX`（wrap 挿入、domain = 自前の3基 union+5） | ref の列勾配 field（+30: 42→15）を**区分線形で自前格子に再標本化**（1007→45.6 … 1141→12.5） |

- 移植の成立根拠: 同一 PSD 系のため顔メッシュ bounds が ref と完全一致（864,306,272×272）。domain と格子次元を ref と同一にすれば restControlPoints が一致し、patch 配列が点対点で流用できる（生成コードが同一のため）。**格子一致アサーションを移植前に必ず実行**（不一致なら再標本化に切替）
- キーは `createEndsCenter`（param_face_angle_x のレンジが preset で ±30、ref のキー位置と一致するため三点キーで足りる）

## Fable のゲシュタルト初実測（自己評価）

±30 のレンダ（cp03-01/02）を rest（cp03-03）と比較して: 眼の非対称（向かう側が縁で細まり遠side が渡る）・鼻の大移動・顎先の振り・輪郭の非対称な作り替え、の複合で**「顔が横を向いた」と読めた**。ただし口・眉・髪が未メッシュで不可視のため、完全なゲシュタルトは 15 要素展開後にしか成立しない（3要素構成の既知の限界）。

## craft 蒸留候補（gate 後に確定）

- 奥行きモデルの言語（problem-definition 記載の一段落）
- ref field 移植の作法: 格子一致なら点対点、不一致なら次元を合わせるか区分線形再標本化
- wrap 挿入の作法と回帰確認の必須化
