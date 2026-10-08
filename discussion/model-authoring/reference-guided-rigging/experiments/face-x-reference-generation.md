# Face-X参照画像の生成試行

記録日: 2026-09-25。実験素材のroot: `C:/workspace/remie/rigging/second-rigging-6-sol/reference-generation`。

## 入力と再現情報（ファイル事実）

- 元PSD: `C:/workspace/remie/code/vtuber/images_3/全身.psd`
- PSD SHA-256: `74e1ea9a98da480f2da079b8744d7f6fa3e048e64160b79d1a3f4436aa8a854c`
- [source-manifest.json](C:/workspace/remie/rigging/second-rigging-6-sol/reference-generation/source/source-manifest.json) / [prepare-source.py](C:/workspace/remie/rigging/second-rigging-6-sol/reference-generation/prepare-source.py)
- 通常衣装ware、通常表情。PSD保存時のmouth_aを元の閉じ口mouthに替えてcompositeした。口の選択はユーザー指定。元PSDは変更していない。
- [正面全身](C:/workspace/remie/rigging/second-rigging-6-sol/reference-generation/source/normal-outfit-neutral-full.png): 2048×3072。
- 正面PNG SHA-256: `165e96b0db174d1d00e254eb2971359814000320c075abb54915c7a83db12eca`
- [頭部crop](C:/workspace/remie/rigging/second-rigging-6-sol/reference-generation/source/normal-outfit-neutral-head.png): 元canvasの(700,50,1320,720)、620×670。
- built-in image_genで生成。実モデルIDは未確認。生成画像は1024×1536 RGBA。生成の再実行で同一画像を保証するseed等はない。

## 試行1: 最大候補

入力: 正面全身と頭部crop。
[出力](C:/workspace/remie/rigging/second-rigging-6-sol/reference-generation/face-x-positive-v1.png) / [正確なprompt](C:/workspace/remie/rigging/second-rigging-6-sol/reference-generation/face-x-positive-v1.prompt.txt) / [当時のreview](C:/workspace/remie/rigging/second-rigging-6-sol/reference-generation/face-x-positive-v1-review.md)

指示: Face-Xのみ画面右へ最大、約30度を目安。他の状態は基準。下方の髪を固定する趣旨の指示も含まれた。

エージェント観察: 頭・顔・眼鏡・帽子が横向きを伝える一方、衣装・身体の細部が描き変わり、周囲にsoft haloがある。alphaがあることは綺麗な切り抜きを保証しない。

ユーザー判断: 「想像以上」「試作としては満点に近い」。同時に、半分程度の変位を要求。前髪付近に対して後ろ髪が動かず、背面の張りぼてのように不連続だと指摘。

仮説: 下方の髪を固定する指示が不連続さを助長した可能性。原因は確定していない。

## 試行2: 中間v1（採用しない）

入力: 正面全身、頭部crop、最大候補。
[出力](C:/workspace/remie/rigging/second-rigging-6-sol/reference-generation/face-x-midpoint-v1.png) / [prompt](C:/workspace/remie/rigging/second-rigging-6-sol/reference-generation/face-x-midpoint-v1.prompt.txt)

半分の変位と連続した後ろ髪を要求したが、最大に近い見た目だったためエージェントが中間候補として退けた。最大画像の入力による影響は仮説。

## 試行3: 中間v2（現在の中間候補）

入力: 正面全身と頭部cropのみ。
[出力](C:/workspace/remie/rigging/second-rigging-6-sol/reference-generation/face-x-midpoint-v2.png) / [prompt](C:/workspace/remie/rigging/second-rigging-6-sol/reference-generation/face-x-midpoint-v2.prompt.txt) / [中間試行review](C:/workspace/remie/rigging/second-rigging-6-sol/reference-generation/face-x-midpoint-review.md)

ほぼ正面から10〜15度程度という浅い画面右向き。頭頂/後ろ髪の根元から下方まで連続して動かし、風は加えない。下方の髪を固定する指示は取り除いた。

エージェント観察: 最大より浅く、中間に見える。正確に半分の角度・格子変位であるとは確認していない。身体の描き変わりとhaloは残る。

ユーザー判断: 「全く悪くない」。続いて、この2個の参考画像から格子点の動きに置き換える方法を相談し、提案したパイプラインを「かなり筋がいい」と評価。

## 現時点の採用範囲

位置合わせの入力は、正面全身・中間v2・最大v1。中間v1を混ぜない。画像を次の試作へ使う了承であり、後ろ髪問題の解消、他軸不変、フロー品質、rig完成の合格ではない。

当時の個別reviewにはユーザー確認待ちという生成直後の状態が残る。本記録が上記の後続ユーザーフィードバックを保持する。原reviewを過去にさかのぼって成功記録へ書き換えない。
