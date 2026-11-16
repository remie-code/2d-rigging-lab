# 探す・確かめる — 六つのニュアンス試作 v1

2026-11-15。実モデル astra-chan の無音モーションを六案並べ、近いものをまとめる判断も含めて見るための制作物。**採用は未決、製品・現用スロットには未登録。** 六つの意味が動きだけで必ず識別できるとの主張ではない。

提示後、本人が六案を採用し、ゲーム画面向けの製品登録を依頼した。11月16日に外部演技資産として登録・配布済み。次回Player起動から有効で、実会話での選択と表示は未確認。 [登録と配布の記録](../../implementation/waves/search-nuances-registration/completion.md)

## 見るもの

生成物は repo root の `tmp/speech-motion/search-nuances-v1/`。

- `comparison-3x2.mp4`：六案を同時に再生する1872×1560の比較。左上から01、02、03、左下から04、05、06。
- `01-search.mp4`、`02-discern.mp4`、`03-compare.mp4`、`04-recheck.mp4`、`05-follow-cue.mp4`、`06-cautious.mp4`：個別624×780。モデル像はすべて624×660、上部に日本語ラベルと代表発話。
- `contact-sheet.png`：各案6姿勢、時刻付き。行ごとに同じ案。
- `verification.json`：動画の全decode、始終neutral一致等。`evidence.json`：全フレームの入力とPNG hash。`provenance.json`：入力snapshotとlive source/exportの前後hash確認。

同時開始の時計は変えない。比較は7.8秒まで、早く終わる案は終端のneutralを保持する。各案の山の時刻を揃える時間伸縮は行わない。動画は終端フレームを含むのでコンテナ時間は定義時間+0.05秒。

## 演出

| 案 | 定義時間 | 代表発話 | 動きで試したこと |
|---|---:|---|---|
| 01 場所を探す | 6.6秒 | この辺には見当たらないね。階段の先はどうだろう。 | 短く左、右、少し上、手前寄りを見る。まだ一か所に決まらない。頭X最大18度、胴X最大2度。 |
| 02 一か所を見極める | 6.5秒 | 鎧を着た兵士っぽいけど、手すりで武器がよく見えないね。 | 一点を捉え、その近くで頭を少し傾け直し、1.8秒ほど保つ。頭X最大12度、Z最大4度、胴Z最大0.7度。 |
| 03 関係を見比べる | 6.9秒 | 今度はスイッチが二つあるんだね。動かす場所を分けてるのかな。 | 同じ高さのA→B→同じAを意図的に往復する。頭X±16度、胴X±1.6度。 |
| 04 状態・残りを確認する | 6.2秒 | あ、奥の台の上に金色の箱が見える。あれ、まだ取ってないやつかな。 | 同じ場所を見て、少し戻し、もう一度そこを見る。上下の確認頷きは加えず、結論を示さない。頭X10→4→10度、頭Yは同じ高さを保持。 |
| 05 相方の気づきに追いつく | 5.7秒 | お、見つけた？ どこにあった？ | 画面左の相方へ短く注意を向け、正面のゲームに移り、近傍を微調整して留まる。相方の向きは頭X−13度、ゲーム側では+5→+8度。 |
| 06 安全を確かめながらうかがう | 7.2秒 | ここで見失ってくれるかな。いったん落ち着きたいね。 | 始動前に間を置き、少し覗いて止まり、もう少し覗いて2秒見張る。頭X5→13度。顎を少し低く保ち、快活な首傾げや大きな驚きを避ける。 |

全案は正面neutralで始まり、滑らかにneutralへ戻る。補間は五次smoothstep。Stageはscale=1・Y=0固定。瞳XY=0、通常目開度1、瞬きなし、笑い・驚き・苦笑表情0。見た目の確認で頭の向きが読めたため、眼球移動は足していない。口閉じはrendererだけの無音描画条件であり、演技定義に発話用の口制御を固定していない。

実際の物体位置を追跡する仕組みはない。画面内の視点移動は演技としての近似で、記録された箱やスイッチの座標へ正確に注視しているわけではない。05だけ相方への短い注意を含むが、主対象は全案ゲーム正面。

[会話中の運動研究](../../research/human-conversational-motion-2026-11.md)を、何を向くかだけでなく間・順序・保持時間を考える足場にした。具体的な曲線は創作仮説。[候補の整理](../../concept/speech-motion-next-candidates-2026-11-15.md)の旧記録21+16件は背景であり、六案で37件すべてをカバーするとの主張ではない。

## 再現

repo root から実行する。既存rendererを読んでこの新規フォルダ内へ派生させ、旧フォルダ・旧生成物は変更していない。

```powershell
python discussion/ai-cohost/experiments/speech-motion-search-nuances-v1/author.py
node --experimental-transform-types --no-warnings --import ./apps/authoring-host/register-workspace-source-resolver.mjs discussion/ai-cohost/experiments/speech-motion-search-nuances-v1/render.mjs
python discussion/ai-cohost/experiments/speech-motion-search-nuances-v1/assemble.py
```

NodeのTypeScript transform、Python/Pillow、ffmpeg/ffprobe、日本語フォントMeiryoが必要。`author.py` は手作業の時間・姿勢スケッチから `performance.json` と `definition.json` を再生成する。`PREVIEW_ONLY=1` で描画を主要36姿勢に絞り、`assemble.py --preview` で先にシートを確認できる。

入力は読取専用 `C:/workspace/remie/rigging/astra-chan/workspace-notes/wry-smile-expression-v2/saved-r843`。authoring graph→runtime-core→software PNGを一回のモデル読込で六案評価。live r844 source/exportは描画入力にはせず、不変hashを検証する。新しいモデル・表情・keyform・runtime exportは作らない。

## 目視と限界

制作側は36の主要姿勢シート、02の傾け直し・04の見直し・05の相方向き・06の見張り姿勢を原寸でも確認した。3.8秒の同時刻比較 `comparison-poster.png` で六面の配置と日本語の可読性も確認した。通常目が崩れず、相方向きは画面左になり、Stage拡大なしで向きの違いが見える。02と06は姿勢自体が近く、時間の流れと発話が意味を支える。04の小さな見直しは単独の静止画では弱い。これらを人工的に誇張して六種類に分ける判断はしていない。

2026-11-15実行で、788フレームの有限geometry、7本の動画全decode、全案の開始・終了PNGと案同士の初期PNGのhash一致、通常目・瞳固定・口閉じ・Stage固定、snapshot/live source/live export不変が通過。比較は157フレーム、20fps、7.85秒。個別動画は5.75〜7.25秒。

連続動画を人間として再生視聴したとの主張はしない。検証は画像の制作側目視と全フレームgeometry・動画decode・入力状態の機械検証。音声同期、OBS、実Playerの発火・接続補正・自律目線との合成は未検証。
