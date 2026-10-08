# レシピ 10: 差分管理（Variant グループ + 在庫の形式所属）

> 由来: 閉問題19 本体+追補（2026-07-06 通過）。対象: 衣装等の drawable 差分の切替管理と、アトラス仕様対応の形式所属。

## 0. 前提知識

- Variant ゲートの意味論: 描画可視 = `baseVisible AND（所属 ∩ アクティブ選択）`。**可視旗が false のままだと variant が選ばれても出ない**
- 切替の場: Editor プレビュー（セッションローカル）/ 永続 defaultActive / **runtime-player の配信中ライブ切替**（export に variants 定義が同梱される。旧 export は "Re-export required" ガード）
- validator に variant 検査は無い——**検証はレンダと巻尺で組む**（本レシピ §3）

## 1. グループ設計（ユーザーと合意する項目）

- グループ名 / mode（singleSelect: 衣装等の排他択 / multiToggle: 個別オン・オフ）/ variant 列 / 所属表（意味論で: 「通常 = 現行衣装一式 + ネクタイ」等）/ defaultActive
- 共有パーツ（首・髪など）はターゲット外。1 drawable は高々1グループ所有（スキーマ強制）

## 2. 操作列（順序が仕様）

variant 系 operation 10種（createVariantGroup / createVariant / addVariantTargetDrawable / setVariantMembership / setVariantDefaultActiveSelection ほか）は汎用 dryRunOperation/commitOperation で CLI から流せる。

```
1. 棚卸し: 所属表の意味論→実 ID 解決（不一致は質問として停止）
2. 隠すべき未メッシュ素材があれば先に可視旗 false → generateMesh（メッシュを張ると突然出現するため）
3. createVariantGroup（singleSelect は initial variant + defaultActive を自動生成）→ createVariant ×n
4. addVariantTargetDrawable + setVariantMembership 全件（可視旗はまだ触らない）
5. defaultActive の確認（自動設定と同値なら reducer が no-op reject する——これ自体が確認の証跡になる）
6. 差分素材の可視旗を true へ復元（ゲートが非アクティブ分を隠すことを確認しながら）
```

**順序則4段: 所属（variant）→ メッシュ → デフォーマ → 可視旗**。所属より先にメッシュ/可視旗を動かすと、切替前の絵に差分素材が漏れ出る。

## 3. 検証（レンダ3点セット + 無傷）

1. **Default rest の sha256 バイト一致**（グループを組んでも今日の見た目が1画素も変わらない、が正しさの証明）
2. **可視集合の機械 assert**: 各選択（+選択省略 = defaultActive）で巻尺（variantSelections 指定）の可視フラグを全ターゲット照合——期待集合と完全一致
3. 切替レンダの自己目視（完全置換・重なり・欠け）
4. 既存キー・rig 無傷。検証スクリプトは選択数・ターゲット数の増減にそのまま追随できる形で書く

## 4. 在庫の形式所属（アトラス仕様対応）

**テクスチャアトラス生成は「デフォーマに属する素材」だけを対象にする**——動かさない素材もキー無しデフォーマへ形式所属させる:

- 動かさない素材（下半身等）: **ルート直下のキー無し warp** 1基に一括（キーフォームを一切打たない。恒等性は keyformSets 数が増えないことで構造証明）
- 追従だけさせたい素材（背負い物等）: **親 rig 直下のキー無し warp** を器に（変形なしで親の回転に乗る。±端で親の直接子と残差 0px を巻尺確認）
- 差分素材をここで初めてメッシュ化する場合は §2 の順序則に従う（所属を組んでから）
- **⚠ 非所属の実害は export で初めて出る**（3周目実証）: デフォーマ非所属の drawable は export の対象集合から**警告なしで脱落**する（unbound pool 除外。preflight の `excludedUnboundDrawableCount` に数字が出るだけで blocker にならない）。**CLI レンダ（document 経路）には写らないため、周回の全 gate を素通りする**——rest 可視の素材が出荷物から消える事故になる。処方: 工程5 の形式所属チェックに「**デフォーマ所属の閉包**」（全 drawable が高々1つの rig 配下に bound。非所属の許容は恒久非表示の参照素材のみ、と明示裁定）を必ず含める。3周目実測: footwear/legwear が非所属で発見、キー無しルート warp 1 op で解消（rest sha 完全一致 = 恒等の画素証明・validate 差分 rigControl.rEM +1 のみ）
- 恒等の検証は二重で安い: **rest レンダ sha の基線一致**（画素）+ 本 rigControl を target とする keyformSets が 0（構造）

## 5. 衣装差分の BodyX は専用場へ作り直す

Variant は可視性だけを切り替える。**通常衣装の BodyX control に差分 topwear を追加するだけでは、衣装固有の物理境界は表現できない。** よって衣装差分を組む工程では、Variant 所属と別に BodyX の所有を再設計する。

原則:

- **1つの物理的に連続した外套形状 = 1つの衣装専用 BodyX control**。同じ `BodyZ` 親を共有しても、通常衣装と BodyX control は共有しない
- 数値をゼロから手打ちしない。通常衣装の committed 場を空間再標本化し、上体の承認済み運動を保存する
- 衣装固有に作り直すのは domain と固定境界。通常衣装が腰でハード停止し、差分衣装がその線を連続して跨ぐなら、同じ開始位置から滑らかなフェード帯へ置換する
- 襟・背面・肩装甲などは名前で分類せず、分離レンダまたは drawable 棚卸しで実所属を確定する。topwear と同一 drawable なら大型付属部も専用場に含まれる
- 袖等の独立部品は、素材範囲・既存場の domain・物理接続が同型だと実測できた場合だけ共有可

操作順:

```text
1. 衣装ごとの drawable 所属と mesh bbox を棚卸し
2. 通常衣装と差分衣装の固定型を判定（ハード / フェード帯 / ソフト）
3. 共通 BodyZ 親の下に衣装専用 BodyX warp を作成
4. committed BodyX 場を双一次 + 最近縁クランプで再標本化
5. 固定型が異なる帯だけを置換し、該当 drawable を専用場へ移動
6. BodyX の min / default / max キーを作成
```

詳細な場の式・恒等検算・C1 フェードは [06-face-angle-x.md](06-face-angle-x.md) の「場の空間再標本化」「服の固定の2型」「衣装差分への転置」を正とする。

検証:

1. Variant ごとの rest sha が適用前と完全一致
2. 通常衣装の BodyX 場と重なる上体格子点で変位が厳密一致
3. フェード開始後の変位が単調に減り、終端行で全点 0
4. BodyX ±端レンダで腰に折れ・局所停止・不連続消失がない
5. 専用場から該当衣装以外の drawable が漏れず、各 drawable の rig 所有者が1つ
6. export 後の Runtime 実機でも同じ衣装・同じ BodyX 動作を確認

3周目追試（2026-07-17）では、通常衣装のスカート境界用ハード場をロング外套2種へ共有したことで腰の途中に不連続停止が発生。衣装専用場へ再標本化し、同じ開始行から C1 フェード帯へ置換した結果、rest 6画像は候補と sha 完全一致、export 成功、ユーザー gate は「圧倒的に動作が自然」で通過した。

## 6. 運用

- 触らないグループ・キーは op を発行しない（最強の無傷保証）
- dry-run の `outcome=error, diagnostics=0` は host 入口の payload 形式エラーであって operation reject ではない——過去 commands/ の実例照合が最速の復旧路
- player の選択は永続化されない（再起動で defaultActive）。export に焼かれるのは常に defaultActive——配信の初期衣装は defaultActive で決める


## 7. アトラス適用から Runtime Export への確認

工程5の所属閉包の後、工程6ではアトラスをコミットしてから書き出す。配置計画では対象集合が所属台帳と一致することを照合し、必要ページ寸法は素材の実寸から決める。計画結果を保存するときは対象の画像バイト列をJSON化せず、settings / layoutSummary / included / excluded / usageを保存する。

- アトラス適用が asyncLifecycleRequired で拒否された場合、同期CLIに同じ操作を再送しても進まない。生成画像のSHA-256が非同期のため、operation-coreの dryRunOperationAsync / commitOperationAsync を使う。作業用host adapterから呼ぶ場合も、AiCommandExecutorとDiagnosticGatedAutoApprovalPolicyを通す事前検査・承認・commit・ログ保存・1操作1git commitの規律を維持する。Editorソース変更は不要。
- 適用前後で、既存キー・rig・Dynamics・メッシュ形状と代表姿勢の画像を照合する。UV投影とtexture参照の意図された変更だけを認める。
- assembleRuntimeExportのfileSetを保存し、Runtime Player自身のディレクトリローダーで形式・ハッシュ・対象数を確認する。全パーツ、2軸keyform、mask、Dynamicsが出力に残ることを照合する。
- Playerの評価器で時間を進め、表情・回転・Dynamicsを同時に評価する。authoring側との頂点・opacity・可視集合および画像を比較する。UV換算等の丸めで数画素のRGBが変わる場合は、幾何残差、変更画素数、最大色差、背景合成後の差を記録し、画像の完全一致と区別する。
- strict validatorのblocking件数だけで「全通過」と呼ばない。非blocking errorや証跡不足は種類と件数を記録し、実行による検証と分けて報告する。Playerコアでの確認は、ユーザーによる最終実機gateの代替ではない。

astra-chan（2026-09-08）の工程6で実証。UI実機の最終審美判定はユーザーgateに残す。

## 8. 衣装の期待所属を現在のVariant設定から逆算しない

非表示・未所属という状態だけでは参照専用素材と判定しない。首のフォルダにある後ろ襟など、描画順の都合で服から分離された素材も含め、衣装別の素材棚卸しと分離画像から本来の役割を確認する。現在のVariant所属は検査対象であり、期待集合の根拠にはしない。ユーザーと合意した素材対応から独立した期待集合を作る。

second-rigging-astra（2026-09-09）では、青専用の rodos_back が非表示・デフォーマ未所属・Variant対象外のまま残り、通常用 neck_back が青でも表示されていた。現在の所属表だけを使った検査はこの誤りを見逃した。正しい対応は通常 neck_back、青 rodos_back、黄色 endomi_neck。青の後ろ襟を既存の青衣装専用BodyX場へ所属させ、可視性とVariant所属を修正し、アトラスとRuntime Exportにも含めた。既存場が素材全域を覆い、服との接続を保てるなら、新しい場やキーを追加する必要はない。

確認では全衣装について専用襟の出現と他衣装の襟の消失、Faceのみの操作で襟が動かないこと、Body操作で服とともに動くことを照合する。変更対象外の衣装の画像を修正前と比較し、書き出し後も同じ期待集合で検査する。
