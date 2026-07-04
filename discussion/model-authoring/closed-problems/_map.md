# Closed Problems Map

> 閉問題の一覧と状態。1 問題 = 1 ディレクトリ、番号付き。アプローチの定義は [../premises/closed-problem-approach.md](../premises/closed-problem-approach.md)。

## 問題ディレクトリの標準構成

- `problem-definition.md` — スコープ（操作列）、判断の所在、除外事項、成功基準
- `api-requirements.md` — A: この問題が要求する最小 API 面（調査後に作成）
- `results.md` — B: 実行記録とユーザー満足判定（実験後に作成）

## 問題列

| Path | 内容 | Status |
|---|---|---|
| [01-eyeball-x/](01-eyeball-x/) | 眼球メッシュ生成〜Eyeball_X 移動 rigging〜クリッピング | **通過（2026-07-03、ユーザー判定 100/100）**。[results.md](01-eyeball-x/results.md) / [実験ログ](01-eyeball-x/experiment/experiment-log.md)。craft/ へ蒸留済み（レシピ 00-03） |
| [02-eye-open-close/](02-eye-open-close/) | 目の開閉（状態デフォーマ3基×両眼、変形+opacity切替）| **通過（2026-07-03、ユーザー判定 100/100「文句のつけようもない」）**。[results.md](02-eye-open-close/results.md) / [実装記録](02-eye-open-close/build-log.md)。craft/05 へ蒸留済み |

| [03-face-angle-x/](03-face-angle-x/) | Face Angle X 最小核（鼻・顔輪郭・左目）| **二重通過（2026-07-03）**: 答え移植版 100点 + **盲目再構成版も満点**（craft のみのクリーン Fable、ゲイン=1 世界線を正典採用）。[results.md](03-face-angle-x/results.md)。発見「field = 構造 × ゲイン」をレシピ06へ恒久化 |
| [04-facex-expansion/](04-facex-expansion/) | FaceX 展開（口・右目・両眉・前髪）= craft 追試験 | **通過（2026-07-03、3ラウンドの gate ループ）**。[results.md](04-facex-expansion/results.md)。最大の獲得 = **回転射影則**（dx = u(cosΔ−1) + z·sinΔ、設計対象は奥行きプロファイル z に一本化）。クリーン Fable 3 代の委任で reject 累計ゼロ |
| [05-facex-periphery/](05-facex-periphery/) | FaceX 頭部外周（耳×2・房×2・後ろ髪×2 + 追加の後頭部×2）= 未踏 z 域3種の追試験 | **通過（2026-07-03、2ラウンド）**: 本体（五代目）+ fix（六代目 = 後頭部層・付け根絞り）。ユーザー判定**「これに文句を言うやつはこの世にいないだろう」**。[results.md](05-facex-periphery/results.md)。獲得 = 未踏 z 域3種の実証 + **隠蔽維持拘束** + 同一モデル内拡張の作法 + 差動パララックス。計 28 op reject ゼロ |

| [06-facex-accessories/](06-facex-accessories/) | FaceX アクセサリ（眼鏡・帽子）= FaceX の完結 | **通過・着地（2026-07-04、4ラウンド + Sylph 台帳 + 人間仕上げ1分）**。ユーザー判定「作業コスト軽減の試みは十分に達成」。[results.md](06-facex-accessories/results.md)。獲得 = **ステッカー↔立体物スペクトラム + 技法6種 → 新レシピ07** + **拘束台帳（planning-gate 実体化）** + 人間仕上げ境界の初測定。**FaceX 完結** |

| [07-facey-core/](07-facey-core/) | FaceY 顔面コア（顔・鼻・口・両目・両眉）= 回転射影則の転置テスト | **通過（2026-07-04、本体 + fix）**: 十一代目（転置 8割成功、cy=459、上下ゲイン2値）+ 十二代目（下向きの目の縮尺 12.5%、外科手術4キー）。獲得 = **変位と縮尺の一致則**（ゲインは sin 系のみ、cos 系は読み取り角のまま——X の 0.65:0.25 勾配の正体）+ 標本化則の1次拡張。ユーザー判定「物理は嘘をついていない、もうこれはいい」 |
| [08-facey-hair/](08-facey-hair/) | FaceY 髪系5 + 眼鏡 = **重力干渉の初攻略** | **Problem defined（2026-07-04）**。[problem-definition.md](08-facey-hair/problem-definition.md)。新未知 = 重力減衰プロファイル（付け根=球面 / 毛先=重力の遷移）。眼鏡は剛体低次場の転置追試（未知ゼロ）。back_top_hair は暫定→回収パターン転置 + 高さ整合論点 |

## 次の行動

1. 08 の実験実行（クリーン Fable 委任、封じ込め継続）→ 09（帽子・耳）で FaceY 完結

## 未決事項

- **完走後の再走**（完成 craft での同モデル作り直し）をユーザーが表明（2026-07-04）。再走では**房の立体表現**に取り組む——craft には試走ポリシーと切り離し、正規の適用対象として焼き込むこと
- 目・眉の遠側キーへの弦の項適用（04 の未適用提案）→ craft 完成後の通し確認で扱う（2026-07-03 ユーザー決定）
- front_hair テクスチャ左端 x≈690 の迷いピクセル列（cp04 由来、暗背景でのみ視認）の掃除要否
- 06 以降の問題列
