# レビュー記録: 手動造形によるFace-X中間姿勢

- 現在の判定: **再開後の最終v4に対する技術レビュー合格。独立Reviewの実ブラウザ確認は環境制約で未実施、root実操作の証拠を別途受領。自然さ・ユーザー品質Gateの承認ではない。**
- 以下の停止記録は履歴として保持。現在の検証状態は末尾「再開後の最終レビュー」を参照。
- レビュー担当は実装担当と別コンテキスト。
- 停止期間中は新規検証・実装・描画を行わず、再開後に残検証を実施した。
- 自然さの品質Gateはユーザーの画像判断であり、以下の技術確認で代替しない。

## Basis と対象

設計basis: `discussion/model-authoring/reference-guided-rigging/manual-midpoint-plan.md` およびroot→Orch→Reviewの明示指示。

作業成果: `C:/workspace/remie/rigging/second-rigging-6-sol/reference-generation/manual-midpoint/`。

読んだ対象は `src/extract.py`、`src/render.py`、`viewer/index.html`、`viewer/app.js`、`assets/assets.json`、`assets/identity-report.json`、`controls/root-manual-v1.json`、`controls/root-manual-v2.json`。抽出ヘルパーのbasisとして既存 `landmark-warp/src/input/export_psd.py` を確認した。旧Astra rig成果は参照していない。

## 完了済みの独立確認

### 素材

PSDを別途read-onlyで開き、通常表情のmouth群を閉じ口へメモリ上で切り替え、全33 visible leafを独立compositeした。

- 全33leafの画素が抽出PNGとRGBA完全一致。
- bbox、画像寸法、leaf順序、各PNG hashが一致。
- 元の順序で独立再合成した画像が `assets/identity.png` とRGBA完全一致。
- PSD現在hashはmanifestの記録値と一致。元PSD不変を確認。
- `assets/psd-neutral.png` は既存の正面source画像とRGBA完全一致。
- mask適用済みの各leafを二重alpha適用なしで貼り付け、source-overで合成する実装を確認。

抽出leafの8bit PNG再合成とPSD直接合成の差は残る。実装側記録値はpremult RGB最大3/255、平均0.00591852005270831/255、alpha最大1/255。Reviewは各leafと再合成の忠実性を独立確認したが、この集計値そのものの再集計はしていない。補填画像や差分画素の挿入はsourceに存在しない。

### 変形と描画

停止前にin-memoryの小さな独立プローブを実行した。

- 解析解のあるbilinear変形 `x'=x+0.015*x*y, y'=y` を、source座標を色に符号化した画像で確認。内部画素の赤成分誤差最大0.498892/255未満（8bit丸め範囲）。
- gridとaffineで同一translationを指定し、t=0、0.5、1で可視画素が一致。
- grid定義域外の変位は端値延長であり、座標自体をclampする挙動ではないことをtranslationプローブで確認。
- collapse affine、反転grid、非finite grid座標が拒否されることを確認。
- 透明画素の隠れた青RGBを混ぜた補間で、premult RGBAにより青い色にじみが生じないことを確認。
- root v1→v2はassignmentsが不変で、transform差分はneckのみであることを独立確認。

rendererは指定座標の補間と逆写像を行い、RAFT・画像fit・形状自動最適化・参照画像画素を計算入力として使わない。参照画像へのパスは比較表示manifest用に記録される。

fold検査は各bilinear cellの4隅Jacobianと、描画するdestination pixel中心での非局所重複検査。連続面の全域・全subpixelでの一対一性の証明ではない。

## 階層・適用単位の実装事実

本成果は **flat leaf warp試作** であり、craft準拠rigを構築した成果ではない。

- `assignments` はleaf IDから単一transform IDへの対応。親子deformer階層や既存rig塔へのwrap、親子変形の合成は実装されていない。
- 各leafへ個別に逆写像を適用し、8bit RGBAへ戻した後、stackIndex順でsource-over合成する。
- 未指定leafはidentity。
- 白目・虹彩・まつ毛は各側で同一transform IDを使うことを実装が強制する。
- 前髪3leaf、後ろ髪5leaf、neckとneck_backの2leafは、それぞれ共通fieldを使う。先にそれらを1枚へ結合してから変形する方式ではない。
- gridは各leafのbboxまで必要に応じて変位端値延長される。これは実頂点unionから生成したrig deformer domainではない。

## 停止後に親から受領したcraft照合情報

以下はrootの照合結果として親から受領したもので、Review自身は今回craft原文を独立検証していない。

- craft 06のFace-Xは「1要素×1param」、既存rig塔のwrap、実頂点unionに余裕を加えたdomainを求める。
- craft 06-0末尾ではneck_backを後ろ襟・衣服所有として扱う。ただし今回PSDの該当leafに対する視覚的裏付けは未確認。
- rootはこの対応を未確認のまま、neckとneck_backに共通変形を指示した。

したがって、現在の共有指定の妥当性やcraft適合を承認していない。停止後にsourceやcontrolsを変更して帳尻を合わせることは行っていない。

## 未検証・未完了

- Gnomeから10tests PASSの報告があるが、Review自身はその試験一式を再実行していない。
- 最終runの独立再描画とhash照合は未実施。
- 親の報告ではv2previewは停止時点で実行中だった処理が安全完了。t=1のみで、実画像t=0.5は未生成。上記のt=0.5独立確認は人工画像プローブに限る。
- 比較UIのsourceは読んだが、実ブラウザ操作による表示・切替・倍率・格子・エラー表示の検証は未実施。
- craftのDrawable／deformer適用ポリシーと実装の適合確認は未完了。
- root数値の全項目と元の指示文との逐語照合は未完了。v1→v2の差分のみ独立確認済み。
- 画像の自然さ、今回素材におけるneck_backの意味、首と後ろ襟の所有分離について品質判断は行っていない。

新規実装・描画・検証を停止し、この未完了状態を保持する。


## 再開後の最終レビュー

### 再開basisと範囲

ユーザーは、同じ変形を適用する単位でまとまっていればflat試作でよく、顔全体を一括変形する構成ではないことを了承した、と親から受領。停止解除後、この明示された範囲で独立技術レビューを再開した。階層rigの追加実装は今回の合格条件に含めない。

rootはneck_backの単体画像を見て黒い後ろ襟と確認した、と親から受領。v3以降neck_backは未割当identityとし、neckだけを変形する。これはrootの視覚確認であり、Review自身の画像認知結果ではない。

v4最終対象:

- controls: `manual-midpoint/controls/root-manual-v4.json`
- run: `manual-midpoint/runs/root-manual-v4/manifest.json`
- renderer: `manual-midpoint/src/render.py`
- viewer既定run: `../runs/root-manual-v4/manifest.json`

### 追加の独立確認

停止前の独立素材照合と解析解プローブは再利用し、重複実行していない。再開後、以下を追加確認した。

1. Gnomeの `python tests/test_render.py` をReviewが独立実行し **10/10 PASS**。identity、既知affine、t補間、premult、identity grid、bilinear inverseと端値延長、fold、不正grid、alphaと積層順とsource-only、eye共有強制の試験をsourceと併せて確認。
2. v1→v4のassignments差分はneck_backの割当削除だけ。transform差分はneckだけ。他のtransformとassignmentsは不変。
3. v4 neckはx=[900,1100]、y=[540,550,565,580,620,666]、dx=[42,42,10,4,1,0]、dy=0が両x列へ適用され、root指定と完全一致。
4. 最終manifestのstatus=complete、controls全文、controls/assets SHA、全frame画像SHAと2048×3072寸法を独立照合。
5. 保存済み段階はt=[0,0.5,1]。t=0は抽出identity画像とRGBA完全一致、t=1はrootが見たv4preview画像とRGBA完全一致。
6. t=0.5をReviewが保存なしで独立再描画し、最終frameとRGBA完全一致。新規造形候補や制御変更は行っていない。
7. 元絵・参照パスが既存の正面source・位置合わせ済み中間参照に解決することを確認。rendererはこれらの参照画素を読まず、素材leafとcontrolsのみを用いる。
8. viewerのsourceで、元絵／参照／試作が同一SVG imageとviewBoxを共用し、保存済みframeのtと段階数を表示すること、初期t=1、白背景・頭部・overlay off、1/2/3とOの操作、最終run既定を確認。格子表示はgridのみで、affine枠を表示するという約束ではない。

### 最終証跡hash

- renderer SHA256: `46b4ec5b3b6892eef20defe4aee1e611d098987fdb5f7c22a82e4be74cf6dbb7`
- test_render.py SHA256: `3f0dc6c536620ad5a2f15ae5790e7978ffa55fd6e3d4783dc3cdfb52f6d20637`
- manifest SHA256: `3c5cb74742ef377d20b307631108d8d6418f15384a60b80c99d7934178565f62`
- controls SHA256: `e46e033711747f5bc032ca477539a5d3f65f7e382b50b94a9eacd90b9643eb53`
- assets SHA256: `3563e335d274c8233e330501b894f4d5ab791a4f90aac33d33a4b96317eb0d79`
- t=0 frame SHA256: `af63a0922b11d140694ec2e0c54bff826f71a4eacbde819485a01f8feb370e51`
- t=0.5 frame SHA256: `5f625e884e3697679354a6bf43d9fa0612d50cfbe76fea88ba88c4b479b89194`
- t=1 frame SHA256: `4fffe89ef912a21be3965636a8cd1b60cb898804a3a641f59f923d83ccdda59f`

### ブラウザの証拠と限界

Review環境のCUA inventoryはapps/browsersとも空、専用iab tabの作成も `Browser is not available: iab` となり、独立Reviewによる実ブラウザ確認はできなかった。別技術でUI操作を代替してはいない。

rootから以下の実操作証拠を受領した。これらはrootの実行であり、Review自身の独立実行と数えない。

- 専用tab9で1/2/3による元絵／参照／試作切替、顔crop、O格子を操作し同位置比較を確認。
- 最終3frame版でslider左操作→t=0.5（2/3）、Home→t=0（1/3）、End→t=1（3/3）の実画像と表示を確認。
- 初期白背景、頭部、overlay offを確認し、最終状態をt=1へ戻した。

### 判定と残る限界

**今回合意したflat leaf warpによる手動中間姿勢試作として技術レビュー合格。** 階層rigやcraft全工程への準拠、編集可能なLive2Dリグの完成を意味しない。初期v1全数値と当時の指示文の逐語照合は未実施だが、保存済みroot controlsを再現用正本とするbasisに従い、v4差分と描画の忠実性を確認した。

素材再合成の8bit量子化差、独立leafの境界、格子微分不連続、局所affineによる形状表現の限界、subpixel全面の単射性未証明という範囲は継続する。今回のroot入力と生成済み3段階について、技術的な残修正指摘はない。

rootはv4の首露出・傾き改善、襟衣服固定、中間段階で大きな隙間がないことを確認し、頬・髪の量感と帽子には参照との差が残ると報告した。これらはrootの外観所見として扱う。**Reviewは自然さのPASSを出していない。最終ユーザー品質Gateは未承認。**

