# 苦笑の六つのニュアンス — 比較試作 v1

2026-11-16。本人の「今の表情を使ってモーションを作ってみる」に応じ、既存 `param_wry_smile` のみで動作の間・強さ・順序を比較する。制作時は①を登録済みの基準とし、②〜⑥の採用と対象割当は比較後の判断に委ねた。新規表情・モデル造形・既存演技変更なし。

## 比較後の採用

②〜⑥を [wry-nuances.json](../../../../apps/runtime-player/assets/speech-motions/wry-nuances.json) の5候補として登録した。ゲーム画面と視聴者には各案の試作正面版を共用する。⑤は演技の途中で一時横を向き、正面へ戻る。相方に向く版は未制作。①「やれやれ」は既存の `wry-headshake` を使う。発話中の口は通常の口パクが受け持つ。

## 見るもの

repo root の `tmp/speech-motion/wry-nuances-v1/` に生成する。

- `comparison-3x2.mp4`：左上①②③、左下④⑤⑥。同時開始、時間伸縮なし。①は6秒終端のneutralを保持し、比較は6.5秒まで。
- `01-reference.mp4`、`02-empathize.mp4`、`03-deflated.mp4`、`04-tease.mp4`、`05-self-deprecate.mp4`、`06-soft-limit.mp4`：個別。
- `comparison-poster.png`：同じ2.4秒の比較。`contact-sheet.png`：各案6姿勢、計36姿勢。後者は各案別の主要時刻なのでラベルを参照。
- `evidence.json`：全frameの入力/PNG hash。`provenance.json`：入力hashと不変検証。`verification.json`：decode、neutral一致等。

20fps、個別624×780（モデル624×660）、比較1872×1560。終端フレームを含むコンテナ時間は①6.05秒、他と比較6.55秒。正面neutral開始・終了。五次smoothstep。無音閉口はrendererだけの条件で、発話の口は通常口パクの責務。

## 元の意図と今回の創作解釈

| 案 | 元の発話・演出意図 | 今回試す動き |
|---|---|---|
| ① やれやれ、勘弁してほしい | 「おかわり頼んでないんだよなあ。しかも毎回、全力で遊んでくれる。」思わず苦笑して首を振る。 | 登録済み `wry-headshake` のtrack/fixed/duration/Stage Yをそのまま使用。苦笑→大小の首振りが収まる。表示発話は抜粋。 |
| ② きつさに同調する | 「一発が重いのに連射までしてくるの、きついよね。」相手のうんざりした気持ちを受ける。 | 先に小さく顎を下げて受け止め、遅れて強度.85の苦笑と小さく遅い首振り。自分から呆れる①との開始順の差。 |
| ③ 報われなさに力が抜ける | 「あれだけ揉まれて、帰ってきたのは元の場所っていうね。」苦笑しながら肩をすくめる／別例では肩を落とす。 | 苦笑が先に出て、後から顎−7度と胴の傾き1.8度が落ち着く。肩専用機能がないため肩の挙上/落下そのものは再現せず、力が抜ける姿勢の近似。 |
| ④ 可笑しな状況を茶化す | 「患者を自分で増やして、火薬の香りを楽しむ医者……嫌すぎるな。」視聴者の冗談を受けて冗談を重ねる。 | 顎を少し上げ、強度.9の苦笑と短い小さな首振り。③の落胆と別の軽さを試す。 |
| ⑤ 自分の頼りなさを笑う | 「道案内のほうも、もうちょっと頼れるといいんだけどね。」褒められた流れで自分の不得手を軽く笑う。 | 強度.8。顔を7度だけ一時横へ外し、顎を小さく引いてから相手へ戻る。深い自責へは寄せない。 |
| ⑥ 柔らかく限界を伝える | 「意識はできるけど、見えてない間に曲がった道までは埋まらないんだよね。」「ここで右折したよ」のほうが助かる。困難と助かる方法を返す。 | 正面を保ち、強度.75の苦笑と5度の首傾げを保持。ほどき際の小さい顎の動きで代案へつなぐ想定。表示発話は抜粋、実音声同期はしていない。 |

上の意図はrootが旧実記録から整理した分類。元ログは `apps/soul/agent/tmp/speech-intent-none/`、①〜⑥のrecord prefixは `8bff2de9`、`068ec8e8`、`5a12b52c`、`11073cee`、`211453c7`、`ec73bbb8`。11月11日の旧苦笑分類48件を中心とする材料であり、現在未対応の件数ではない。今回の秒数・強度・姿勢は創作仮説で、元タグがこれらの軌跡を指定していたわけではない。

対象方向は**正面を共通基準**にした。⑤の顔外しのみ一時的な注意の離れを作る。試作では元会話での相方・視聴者・ゲームという対象の違いを再現せず、②〜⑥の対象割当は比較後の判断に委ねた。

全案Stage scale=1・Y=0固定。瞳XY=0・通常目開度1固定、瞬きなし。苦笑以外の笑顔/驚きは0。眉の形は既存keyのまま、表情強度のみ変える。横回転最大10度、上限24度以内。①は登録JSONを直接読み込み、既存のY=0を保持し描画上のscale=1のみ補った。実Playerの五次補間と同じ補間を使うが、自律動作との合成を再現した動画ではない。

## 制作側の目視と限界

全動画前に36姿勢を生成して目視した。③の下がる顎/胴、⑤の一時横向き、⑥の正面の傾きは姿勢差が見える。①②④のピーク顔は近く、動きの速さと開始順が差の中心。苦笑の造形が穏やかなため④の可笑しさが必ず読めるとは限らない。別笑顔を混ぜたりStageを誇張して六種類の差を無理に作らず、本人の比較判断に残す。

肩の専用動作、音声同期、配信小表示での識別、実Playerでの発火と自律動作合成は未検証。機械検証通過を感情ニュアンスの合格とは扱わない。連続動画を人間として再生視聴したとの主張もしない。

生成後posterも目視し、発話末尾の短すぎる折返しを整えた。776フレームの有限parameter/geometry、7動画の全decode、全案始終neutral PNG同一hash、瞳/瞬き/閉口/Stage固定、snapshot/live source/live export不変、①の登録定義とのtrack/fixed/duration/entry/Stage Y一致を確認した。

## 再現

読取専用snapshot `C:/workspace/remie/rigging/astra-chan/workspace-notes/wry-smile-expression-v2/saved-r843`。現用source/exportはhash確認のみ。モデル一回読込、authoring graph→runtime-core→software PNG。既存search-nuances-v1のrenderer/assemblyから派生。viewport/fps/固定値はdefinition/performanceに保存。Node TypeScript transform、Python/Pillow、ffmpeg/ffprobe、Meiryoが必要。repo rootから:

```powershell
python discussion/ai-cohost/experiments/speech-motion-wry-nuances-v1/author.py
node --experimental-transform-types --no-warnings --import ./apps/authoring-host/register-workspace-source-resolver.mjs discussion/ai-cohost/experiments/speech-motion-wry-nuances-v1/render.mjs
python discussion/ai-cohost/experiments/speech-motion-wry-nuances-v1/assemble.py
```

先行主要姿勢はrender時 `$env:PREVIEW_ONLY='1'` とassemble `--preview`。全生成前に `Remove-Item Env:PREVIEW_ONLY`。①の元登録JSONが将来変わっても今回の `performance.json` が曲線の保存原本として残る。その場合はauthor.pyを再実行せず保存済みperformanceからrenderする。再生成可能な重い出力はtmpのみ。

## 原記録への導線

[1 原記録](../../../../apps/soul/agent/tmp/speech-intent-none/8bff2de9bae4039c66506ffe43036e55d54063a259ab0304d47ea3fa33a8b899.json)、[2 原記録](../../../../apps/soul/agent/tmp/speech-intent-none/068ec8e887dd0aaf60919d92ae4009d18d38cd1fe0532b9b69f9775a92990c55.json)、[3 原記録](../../../../apps/soul/agent/tmp/speech-intent-none/5a12b52c710eb53489de6abdbb36a2457fdc56a5f0e4bf012692579df5343fdd.json)、[4 原記録](../../../../apps/soul/agent/tmp/speech-intent-none/11073ceec4c2be54fe5de09ebe0430743134ffc3f09f5ffc64f4cfed08637ed7.json)、[5 原記録](../../../../apps/soul/agent/tmp/speech-intent-none/211453c713da82ef0984c074058fa0c09ca9891bb2f7182b54e057f93a53fb53.json)、[6 原記録](../../../../apps/soul/agent/tmp/speech-intent-none/ec73bbb80e5f39bca710de7af0ef081e68d6cba0448eff162721d8439d6591a9.json)。本文と演出タグは各JSONから確認できる。旧ローカルログのため、この記録が利用できない環境では上記の引用と分類が残るが、会話全体は復元できない。

制作時renderer基準commit: `e4f67106e099b25e6aa1f3f0fa41152f03709811`。
