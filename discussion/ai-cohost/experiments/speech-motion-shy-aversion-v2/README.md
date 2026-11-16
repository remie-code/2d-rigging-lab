# 照れ笑い：一度顔をそらす比較 v2

2026-11-16。五本比較の03について本人から「照れているか疑問」と指摘があり、研究の手掛かりを基に一案だけ改訂した。

## 製品登録

本人が比較後に選んだ、相手へ向く、顔をそらす、相手へ戻る改訂版を `smile-nuances--shy` として相方（画面左）向けに登録した。 [登録定義](../../../../apps/runtime-player/assets/speech-motions/smile-nuances.json)

## 仮説と演出

原案は画面左の相方へ向いたまま、短い通常顔の間から顎を引いて笑う。改訂は相手へ一度顔を向けて受け止め、一度だけ少し反対へそらし、顎を引いた笑みを短く保ち、笑みをほどきながら相手へ戻る。最後は正面neutral。

頭Xは0→−10（1.05〜1.45秒）→+7（2.45〜3.7秒）→−10（5.05〜5.55秒）→0（6.65秒）。顎は最大−5度、傾き−3度、笑顔は1.65秒から2.5秒に.87へ達し、3.7秒から5.15秒にほどく。Stage固定。反復的な左右探索や否定首振りにしない一往復のつもりだが、そう読めるかも本人が比較する。

Keltner (1995) の embarrassment の研究は、下視線・笑いを抑える口元・顔を横へ動かすことなどの時間的組合せを手掛かりにした。代表順序は全員一様ではなく46%。好意の照れと失敗の embarrassment を同一視せず、今回の曲線は研究に着想を得た創作仮説であり、論文の運動数値のコピーではない。[論文本文](https://greatergood.berkeley.edu/dacherkeltner/docs/keltner.embarrassment.jpsp.1995.pdf)

瞳XY=0・通常目開度1・瞬きなしを維持。笑顔変形と眼球移動を重ねない。口は通常口パクの責務なので、抑えた唇や新しい口角を造形していない。無音描画のみ閉口。既存の閉じ目笑顔の範囲で、関係と順序を変える実験である。

口元抑制・新規赤面は未実装。 [照れの笑みの調査記録](../../research/embarrassed-smile-2026-11-16.md)

## 生成物と目視

出力は repo root の `tmp/speech-motion/shy-aversion-v2/`。

- `comparison-v1-v2.mp4`：左が原案、右が改訂。同時開始・時間伸縮なし。原案6.5秒以降はneutralの終端を保持。比較7.05秒、20fps、1248×800。
- `shy-v2.mp4`：改訂単独、7.05秒、624×800。
- `comparison-poster.png`：同一3秒時点。
- `contact-sheet.png`：同一の6時刻×2案。原案7秒欄は終端hold。
- `evidence.json`、`provenance.json`、`verification.json`：全入力/PNG hash・入力不変・decode等。

先に主要6姿勢を描画して原案と目視比較した。原案は相手を向いたまま、改訂は中盤だけ反対へ顔が外れ5.05秒で相手へ戻る差が見える。顔そのものは同じ笑顔であり、照れの識別を保証しない。連続動画の人間としての視聴、実音声同期、実Playerでの合成は未検証。

全生成後のposterも目視し、左右配置・日本語・同時刻表示を確認。新規141フレームの有限parameter/geometry、2動画の全decode、始終neutralの原案一致、瞳/Stage固定、snapshot/live source/live export不変を確認した。数値通過は演技の意味の合格判定ではない。

## 再現

入力は `C:/workspace/remie/rigging/astra-chan/workspace-notes/wry-smile-expression-v2/saved-r843`、モデル読込一回のauthoring graph→runtime-core→software PNG。現用source/exportはhash確認のみ。renderer基準commit `e4f67106e099b25e6aa1f3f0fa41152f03709811`。viewport/fpsは元五本比較と同一。Node TypeScript transform・Python/Pillow・ffmpeg/ffprobe・Meiryoが必要。

原案フレームは `tmp/speech-motion/smile-nuances-v1/03-shy/frames` を再利用する。不在なら[元試作の手順](../speech-motion-smile-nuances-v1/README.md)で復元できる。author.pyは元performance/definitionを読んで改訂の小さな定義を再生成する。

```powershell
python discussion/ai-cohost/experiments/speech-motion-shy-aversion-v2/author.py
node --experimental-transform-types --no-warnings --import ./apps/authoring-host/register-workspace-source-resolver.mjs discussion/ai-cohost/experiments/speech-motion-shy-aversion-v2/render.mjs
python discussion/ai-cohost/experiments/speech-motion-shy-aversion-v2/assemble.py
```

先行確認はrender時に `$env:PREVIEW_ONLY='1'`、組立てに `--preview`。全生成前に `Remove-Item Env:PREVIEW_ONLY`。再生成可能な重い出力はtmpのみ。
