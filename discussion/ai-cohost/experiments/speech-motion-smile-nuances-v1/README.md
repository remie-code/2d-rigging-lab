# 笑みの五つのニュアンス — 比較試作 v1

2026-11-16。既存の `param_shared_laughter` で五本を粗く揃え、一本ずつ詰めるための比較。五種類の意味を動きだけで確実に識別できるとの主張ではない。

## 製品登録

本人が比較後に選んだ01、02、04、05と、[照れ笑いの改訂版](../speech-motion-shy-aversion-v2/README.md)を、相方（画面左）向けの五つの候補として登録した。03原案は比較用に残している。プレビューの閉口と口形は、実発話では通常の口パク経路が担う。 [登録定義](../../../../apps/runtime-player/assets/speech-motions/smile-nuances.json)

## 見るもの

生成物は repo root の `tmp/speech-motion/smile-nuances-v1/`。

- `comparison-3x2.mp4`：同時開始の五本。右下は説明と開始・終了のneutral参照。時間伸縮なし。
- `01-soft.mp4`、`02-joy.mp4`、`03-shy.mp4`、`04-proud.mp4`、`05-relief.mp4`：個別動画。
- `comparison-poster.png`：同一時刻2.7秒の五面比較。
- `contact-sheet.png`：各案の主要6姿勢、計30姿勢。各行の時刻は同じではないので時刻ラベルで見る。
- `verification.json`：全動画decodeと始終neutral等。`evidence.json`：全フレーム入力・PNG hash。`provenance.json`：snapshot/live source/exportの前後hash。

全案6.5秒、20fps、終端フレームを含む動画は6.55秒。個別624×780、モデル画像624×660、比較1872×1560。正面neutralから滑らかに始まり、正面neutralへ戻る。五次smoothstep補間。音声なし、無音描画のみ閉口。実発話の口は通常口パクの責務。

## 演出仮説

### 本人評価と照れの追加比較（2026-11-16）

本人は5案を「悪くない」と評価した一方、03が照れて見えるかには疑問を示した。既存研究を調べ、改善につながらなければ現案で登録する意向を示した。元の5案を保持したまま、照れ笑いの研究を踏まえて顔を一度そらす案を比較に加えた。 [照れ笑いの研究メモ](../../research/embarrassed-smile-2026-11-16.md) · [v2との比較](../speech-motion-shy-aversion-v2/README.md)

| 案 | 短い代表発話 | 試す差 |
|---|---|---|
| 01 柔らかく微笑む | それが伝わるの、僕もうれしい。 | .85秒からゆっくり笑顔、強度.72。小さく傾けて留まる。 |
| 02 嬉しさが弾む | やった！ ちゃんと隙を見つけて倒したね。 | .45秒から早く笑顔、強度1。顎が一度上がって小さく返り、収まる。手の機能がないため拍手は再現しない。 |
| 03 照れながら笑う | あ、作るの僕だった。楽しみに待つ側になってた。 | 通常顔で短く静止、1.5秒後から笑顔、強度.95。顎を引いて少し傾く。赤面や眼球の視線外しは追加しない。 |
| 04 少し得意げに笑う | 道には迷うけど、足りないルーンは見失わないよ。 | 顎を5度上げ、強度.85の笑顔を安定して保つ。左右非対称の口角などは作っていない。 |
| 05 息を抜いてから微笑む | よかった、声届いたね！ 教えてくれてありがとう。 | 通常顔のまま先に顎と上体をゆるめ、2秒後から笑顔、強度.9。01の「ゆっくり笑い始める」と順序を変える。呼気そのものの再現ではない。 |

注意対象は**全案とも相方（画面左）**へ統一。頭Xは共通の0→−10度→0。方向差がニュアンス比較を惑わせないための基準比較で、全対象版を作るものではない。05の元の「エデンさん、教えてくれてありがとう」は視聴者向けだが、この比較では同じ向きへ置き換えた。製品の対象選択を決めたわけではない。03〜05の表示発話は短縮している。

Stage scale=1、Y=0固定。頭の最大横回転10度、上下5度、傾き4度。通常目開度1・瞳XY=0固定、通常瞬きなし。目の閉開は笑顔パラメータだけに任せる。以前の瞳が吸い込まれる違和感への対処を維持する。既存の相方向け共有笑い（向き直りから大小二拍のStage弾み）とは、固定Stage・一回の小さな頭の弾み・静かな保持で区別した。

[会話中の運動研究](../../research/human-conversational-motion-2026-11.md)は動作の追加量だけでなくタイミング・順序・保持を考える足場。今回の曲線は創作仮説で、人間の実験値の再現ではない。

## 制作側の目視と制約

全動画生成の前に30姿勢を描画し、制作側とrootがシートを目視した。01の中間強度では細い開眼が残る。穏やかにも見える一方、眠そう・半開きと受け取られる可能性があり、「開眼の柔らかな微笑み」を新造したものではない。この比較では中間値の結果を残し、別表情が必要か本人に判断してもらう。

02は早い立ち上がり、03は通常顔の間から下向き、05は笑顔の前の姿勢のゆるみという順序が差を支える。笑顔ピークの顔はどれも近い閉じ目笑顔になる。特に04は普通の満足した笑顔にも見え、得意げと確実に読めるとは扱わない。大きな頭振りで意味を無理に補わない。

主要画像の目視と動画decodeは、連続動画を人間として視聴したこと、音声同期、配信小表示での識別、実Playerの発火や自律動作との合成を保証しない。後続の本人比較では01の細目、03の照れ、04の得意、05の順序が読めるかが主な判断点。

全生成後の2.7秒比較posterも制作側が目視し、五面・説明欄・日本語ラベルの配置と可読性を確認した。2026-11-16実行で655フレームの有限parameter/geometry、6本の動画全decode、全5案の開始・終了PNGの同一hash、瞳固定・瞬きなし・閉口・Stage固定、snapshot/live source/live export不変が通過した。数値通過をニュアンスの識別成功とは扱わない。

## 再現

入力は読取専用snapshot `C:/workspace/remie/rigging/astra-chan/workspace-notes/wry-smile-expression-v2/saved-r843`。現用r844 source/exportを描画入力にせず、前後hashのみ検証する。この手順は比較動画の生成用。

既存 `speech-motion-search-nuances-v1` のrenderer/assemblyからこの新規フォルダへ派生。authoring graph → runtime-core → software PNG、実行ごとにモデル読込一回。NodeのTypeScript transform、Python/Pillow、ffmpeg/ffprobe、Meiryoが必要。repo rootから:

制作時のエディタ/renderer基準commitは `e4f67106e099b25e6aa1f3f0fa41152f03709811`。snapshotの各入力hashと本定義hashは生成された `provenance.json` に記録する。

```powershell
python discussion/ai-cohost/experiments/speech-motion-smile-nuances-v1/author.py
node --experimental-transform-types --no-warnings --import ./apps/authoring-host/register-workspace-source-resolver.mjs discussion/ai-cohost/experiments/speech-motion-smile-nuances-v1/render.mjs
python discussion/ai-cohost/experiments/speech-motion-smile-nuances-v1/assemble.py
```

主要姿勢だけ先に見るにはrender時に `$env:PREVIEW_ONLY='1'`、続いて `assemble.py --preview`。全生成前に `Remove-Item Env:PREVIEW_ONLY`。重い生成物はtmpのみ、再生成可能な定義・スクリプトと判断記録はこのフォルダに保存する。
