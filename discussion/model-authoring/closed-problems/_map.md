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
| [08-facey-hair/](08-facey-hair/) | FaceY 髪系5 + 眼鏡 = **重力干渉の初攻略** | **通過（2026-07-04、本体 + fix）**: 十三代目（W(y) 境界=頭蓋接触・遷移∝自由長、眼鏡転置は未知ゼロ実証）+ 十四代目（**減衰の収束先修正**: 杭→付け根並進のコピー。誤訳の出所は L0 定義文と記録）。獲得 = **「付け根の並進を運ぶ」は軸横断の不変量** + **W(y) は回転性の混合比**（恒等式 field−root = W·(球面場−root) を機械証明）。副産物: 髪の追従で cp07 下向きの違和感が消滅（証言者が揃うと個々の証言の信頼度が上がる） |
| [09-facey-accessories/](09-facey-accessories/) | FaceY 帽子 + 耳 = **FaceY 完結** | **通過（2026-07-04、一発・イテレーション予算未使用）**。ユーザー判定**「笑っちゃうくらい完璧だな。これに文句をつける奴はこの世にいないだろう」**。[results.md](09-facey-accessories/results.md)。獲得 = 凍結装置の反転則・例外則の幾何根拠判定・H ランプ・人間補正場への層重ね作法・ピボット検証様式。**FaceY 戦線完結（cp07〜09、フェーズ蒸留済み）** |

| [10-bodyx-torso/](10-bodyx-torso/) | BodyX 胴体コア（首・上半身服・ネクタイ・両腕）= 首から下の初 rigging | **通過・着地（2026-07-04、本体 + fix + 人間仕上げ=襟元のみ）**。[results.md](10-bodyx-torso/results.md)。獲得 = **縫い付けアンカー**（端の物理的所有者で分岐）+ **襟=縁ループの同族**（傾き非対称の演出のウソ）+ 運搬2型 + **PRE assert=人間補正ガード**。α=0.6 正典化済み。⚠ topwear/tie キーに人間補正あり（機械再生成禁忌） |

| [11-bodyx-head/](11-bodyx-head/) | BodyX 頭部の浅い同調（18塔一括）= 相似仮説の検証 | **通過（2026-07-04、100点・一発）**。[problem-definition.md](11-bodyx-head/problem-definition.md)。**仮説「パラメータ族は相似」無条件成立**——首 junction はキー値差 0.00px（構成で接続）、人間補正も形ごと α 倍で運搬。18塔の設計コスト実質ゼロ（定数 ALPHA=0.6 のみ）。BodyX 完結 |
| [12-facez-rotation/](12-facez-rotation/) | FaceZ 回転コア（回転デフォーマ + 剛体14塔） | **通過（2026-07-04、一発・2 op）**。[results.md](12-facez-rotation/results.md)。獲得 = **rotation2d の操作様式**（warp は回転を補間できない / 設計対象は pivot 1点+角度スカラーのみ / ピボット従属性で並進キー不要）。A 問題の復活は杞憂（op 実在） |
| [13-facez-gravity/](13-facez-gravity/) | FaceZ 重力ワープ（前髪・房・後ろ髪）= FaceZ 完結 | **通過・満点（2026-07-04、本体 + fix×3）**「期待した通りのものになった」。[results.md](13-facez-gravity/results.md)。獲得 = **重力テンプレ最終形**（3帯 + y_scalp ワンノブ / 符号反転線の非跨ぎ / 式は場非依存・ダイヤルは場依存）+ **プラム項 = 作画の嘘の翻訳**。3自由度が1ラウンドずつ暴かれた物語込み。**FaceZ 完結** |

| [14-bodyz-rotation/](14-bodyz-rotation/) | BodyZ 回転コア（腰から上を傾ける） | **通過・100点（2026-07-04、一発・3 op）**。[results.md](14-bodyz-rotation/results.md)。獲得 = **rotation2d 入れ子**（合成は Runtime、設計者負担ゼロ）+ 空メッシュの罠 + 差分画素の局在化手続き |
| [15-bodyz-corrections/](15-bodyz-corrections/) | BodyZ 補正ワープ7基 = BodyZ 完結 | **通過（2026-07-04、一発・「完璧だ」）**。[results.md](15-bodyz-corrections/results.md)。獲得 = **固定線テンプレの統一**（7基が同一文、固定線実測3型）+ 回転内差分の厳密形デフォルト化 + 設計ログの世代間記憶の回収実績。**BodyZ 完結 = X・Y・Z・BodyX・BodyZ の5パラメータ制覇** |

| [16-hair-sway/](16-hair-sway/) | 髪揺れ + タイ揺れ（Sway X 4系統 = 揺れモード場 + dynamics v3 初運用） | **通過（2026-07-05、本体 + fix×2、ユーザー判定「全体的に非常によくなった」→「うん、いいと思う」）**。獲得 = **揺れモード場は等長写像**（接線積分、κ 剛性ダイヤル）/ **静的リグ=定常・dynamics=過渡**（angle 入力全廃、静定=静的ポーズの構造保証）/ 実測ベース物理定数（2/3則・レバー線形化）。26〜28代 reject ゼロ。蒸留未（cp17 と並行で実施） |
| [17-mouth-lipsync/](17-mouth-lipsync/) | 口パク（Mouth Open × 母音、最大情報素材の単一変形 + パッケージ内参照オラクル） | **通過（2026-07-05、一発・二十九代目）**。格子自己修正2ラウンド込み・weekly 制限死からの**初の遺失報告復元**（損失は所見文のみ）。口形の軽い崩れは素材起因（ユーザー切り分け、素材更新で対応）。[results.md](17-mouth-lipsync/results.md)。craft/09 へ蒸留済み |

| [18-alt-outfit-rigging/](18-alt-outfit-rigging/) | 別衣装 rigging（rodos_ware / endoministrator の topwear+両腕 ×2 = 場の空間再標本化） | **通過（2026-07-05、一発・三十代目、「破綻なし、もう本当に好みの問題」）**。獲得 = **場は空間の属性**（人間補正場の衣装横断再利用を実証）+ **服の固定の2型**（羽織りフェード帯は未適用・磨き候補）。[results.md](18-alt-outfit-rigging/results.md) |

| [19-variant-ware/](19-variant-ware/) | 差分管理（Ware グループ singleSelect 3択 = variant operation 列の初運用 + レンダ自己検証） | **Problem defined（2026-07-06）**。A ギャップなし（書き側 op 10種実在・player ライブ切替実装済み）。[problem-definition.md](19-variant-ware/problem-definition.md) |

## 次の行動

1. cp19 実験 → gate → 蒸留
2. 期限考慮: Fable 使用可能の当初期限 2026-07-07（weekly 制限は 2026-07-05 に一度発動・回復済み）——残り時間の配分はユーザーと相談

## FaceY フェーズ蒸留（2026-07-04 完了）

cp07〜09 の獲得をレシピ06（軸の転置 / 変位と縮尺の一致則 / 垂れ物の重力テンプレ）とレシピ07（Y の立体物）へ焼き込み済み。運用知見（L0 誤訳の記録・「はず」の assert 裁定・封じ込め運用穴）は各 results.md と較正ログ Round 9 に記録。

## 未決事項

- **完走後の再走**（完成 craft での同モデル作り直し）をユーザーが表明（2026-07-04）。再走では**房の立体表現**に取り組む——craft には試走ポリシーと切り離し、正規の適用対象として焼き込むこと
- 目・眉の遠側キーへの弦の項適用（04 の未適用提案）→ craft 完成後の通し確認で扱う（2026-07-03 ユーザー決定）
- front_hair テクスチャ左端 x≈690 の迷いピクセル列（cp04 由来、暗背景でのみ視認）の掃除要否
- 06 以降の問題列
