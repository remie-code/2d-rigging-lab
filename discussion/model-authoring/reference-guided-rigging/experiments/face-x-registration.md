# Face-X参照画像の位置・大きさ合わせ

2026-09-25。状態: 計算・エージェント目視確認済み。同位置切り替え表示の提示後、ユーザーが次工程へ進むことを了承。これは参照画像を整える段階の記録。フロー抽出やrig適用の完了を意味しない。

## 入力・成果物

素材root: C:/workspace/remie/rigging/second-rigging-6-sol/reference-generation。

- 正面: [元素材](<C:/workspace/remie/rigging/second-rigging-6-sol/reference-generation/source/normal-outfit-neutral-full.png>)、2048×3072。元のbytesを保持。
- 中間: face-x-midpoint-v2.png、1024×1536。最大: face-x-positive-v1.png、1024×1536。中間v1は不使用。
- [再実行スクリプト](<C:/workspace/remie/rigging/second-rigging-6-sol/reference-generation/align-references.py>): workspace rootで python reference-generation/align-references.py を実行。Pillowとnumpyを使う。
- [変換・入力/出力hash・特徴点・依存version](<C:/workspace/remie/rigging/second-rigging-6-sol/reference-generation/alignment/alignment-manifest.json>)
- [中間の位置合わせ済みPNG](<C:/workspace/remie/rigging/second-rigging-6-sol/reference-generation/alignment/midpoint-aligned.png>) / [最大の位置合わせ済みPNG](<C:/workspace/remie/rigging/second-rigging-6-sol/reference-generation/alignment/endpoint-aligned.png>)
- [同一cropの頭部比較](<C:/workspace/remie/rigging/second-rigging-6-sol/reference-generation/alignment/head-comparison.png>) / [全身比較](<C:/workspace/remie/rigging/second-rigging-6-sol/reference-generation/alignment/full-comparison.png>)
- [特徴点監査](<C:/workspace/remie/rigging/second-rigging-6-sol/reference-generation/alignment/anchor-audit.png>)
- [中間: 身体のbefore/after重ね合わせ](<C:/workspace/remie/rigging/second-rigging-6-sol/reference-generation/alignment/midpoint-body-before-after.png>) / [最大: 身体のbefore/after重ね合わせ](<C:/workspace/remie/rigging/second-rigging-6-sol/reference-generation/alignment/endpoint-body-before-after.png>)

最終PNGは元PSDと同じ2048×3072。生成画像の2倍拡大を含み、生成細部の解像度が増したわけではない。比較画像は白背景へ合成した表示用。位置合わせPNGは入力alphaを保つ形で変換し、ハローの除去は行っていない。

## 方法と今回の判断

作業座標は1024×1536。元絵を半分に縮小し、身体の局所patchを生成画像内の近傍で正規化相関により対応付けた。これは局所的な位置合わせの測定であり、顔のdense flowではない。

元絵と生成画像で同じはずの身体を基準に、等方スケールと平行移動だけを推定。頭・顔・髪・帽子・尻尾は基準にしない。回転、縦横別の拡縮、局所的な形の補正は加えない。Face-Xで残したい変化を位置合わせで消さないため。

最初はネクタイの結び目も診断候補にした。しかし最大参照では首・襟元が描き変わり、patch対応も不安定だった。頭に伴う変化と不要な描き変わりが未分離のため、両参照でこの点をfitから除外。最終fitは腰・ネクタイ下端・ガーター/ストッキング・靴にある9点を用いた。襟元の診断点はmanifestと監査画像に残す。

相関の検索範囲は±24 working px。高さ方向に十分離れた3点の組から4 working px以内の対応を初期consensusとし、採用点で再fitする。これらは推定器の設定値で、美的な合格値ではない。manifestのfit_inlierは初期consensusへの所属であり、再fit後の残差が必ず4px以内であるという意味ではない。

## 得られた変換（測定値、合否ではない）

寸法を揃えた後の補正。targetのworking座標からsourceのworking座標へ p_source = s * p_target + t。

| 参照 | s | t(x,y), working px |
|---|---|---|
| midpoint | 0.99931145 | -2.6871, -0.3660 |
| endpoint | 0.99948321 | -0.4882, 0.3613 |

大きさはほぼ元から揃っており、中間には主に数pxの平行移動を施した。pixel-edge座標を使い、pixel(i,j)の中心は(i+0.5,j+0.5)。生成画像から元の2048×3072へ戻す行列は [[2s,0,2tx],[0,2s,2ty],[0,0,1]]。逆行列もmanifestに保存した。premultiplied alphaでbicubic resamplingし、エッジの色の混入を抑えた。

## エージェントの目視観察

最終の頭部比較と全身比較を確認。身体の配置・大きさはおおむね揃い、正面→中間→最大という頭の向きの違いは保たれている。今回の全体位置合わせとしては比較に使える見た目と判断した。

生成の描き変わりは残る。特に中間のネクタイ下端、最大の首・襟元、衣装の細部は、一つの全体変換ですべて一致しない。これを無理に局所変形して隠すと、画像生成の誤差とFace-Xの運動を混同する。この段階では残差として見える形で保持する。

頭部cropを見る限り、目・鼻・輪郭・髪の変位まで全体の位置合わせで消してはいない。ただし参照自体の顔の同一性、後ろ髪の一体感、連続した運動の自然さ、遮蔽面の対応の正しさはこの工程では判定していない。

## 機械的な確認

入力画像hashの不変、出力寸法、変換行列と逆行列の積、実行scriptのhashを確認した。文書リンクを照合。これらは保存・再現性の確認であり、画像の自然さの証明ではない。

## Human gate / 次の論点

同位置切り替え表示の提示後、ユーザーが「うん、これならオプティカルフローに進めると感じるな」と判断した。この位置合わせ済み入力を次工程へ使用する承認であり、フロー推定・rigの品質の承認ではない。

次工程に向けて、背景ハロー・可視面/パーツのマスク・首/襟元の意図しない差分を除外する範囲を考える必要がある。全体フローを全レイヤーへそのまま流し込まない。実際のフロー推定器や格子への当てはめは未実施。

## 同位置切り替えビュー（2026-09-25追加）

初回提示の横並びでは位置の一致を確認できない、というユーザーの指摘を受けた。画像自体や変換は変更せず、[比較ビュー](C:/workspace/remie/rigging/second-rigging-6-sol/reference-generation/alignment/compare.html)を作成。正面・中間・最大を同じcanvas位置・倍率で切り替える。手動選択、正面との交互表示、3枚の往復、停止、切替間隔、全身/頭肩/胴体腰/足元の共通crop、背景色を用意した。フェード・補間はなし。初回提示時はhuman gate未取得。その後、上記の次工程へ進む承認を取得した。

HTMLは隣接する位置合わせPNGと元の正面PNGを参照する。reference-generationをルートに127.0.0.1限定のPython HTTP server（ポート8769）で表示した。再開時は同ディレクトリで python -m http.server 8769 --bind 127.0.0.1 とし、/alignment/compare.html を開く。Web上への公開や画像送信は行っていない。
