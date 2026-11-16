# 「受け取る」と「腑に落ちる」の同条件比較

2026-11-15。左は現在登録済みの `apps/runtime-player/assets/speech-motions/receive.json` の `receive`、右は `../speech-motion-understanding-nod-v1/performance.json`。製品・モデルの変更や登録は行わない。

両側とも同一r843 snapshot、同一viewport、624×660像、同一背景、20fps。左右のclip定義t=0を揃え、時間伸縮なし。右は1.1秒の理解の間を含む4.2秒の試作画像を、全画像hash確認して再利用する。左は本体1050msの全trackをそのまま使い、終了時の頭Y約−1度から400msでdefaultへ五次smoothstepで戻し、1450ms以降はneutralを保持する。瞳Y0.08と頭Z0.65も既存定義のまま。通常目、Stageなし、口閉じは描画のみ。

現行 `apps/runtime-player/src/main/control-channel/speech-motion-playback.ts` で `SPEECH_MOTION_ENTRY_MS=180`、`SPEECH_MOTION_RELEASE_MS=400`、五次補間、自然終了時の最終key→base復帰を確認。今回は**定義の動きを比較するため接続用lead-in180msを除外**する。実Playerの発火からの時間・接続動作を再現する映像ではない。余分な共通待機や開始時刻の補正を加えていない。

repo rootから再現:

```powershell
node discussion/ai-cohost/experiments/speech-motion-nod-comparison-v1/prepare.mjs
node --experimental-transform-types --no-warnings --import ./apps/authoring-host/register-workspace-source-resolver.mjs discussion/ai-cohost/experiments/speech-motion-nod-comparison-v1/render.mjs
python discussion/ai-cohost/experiments/speech-motion-nod-comparison-v1/assemble.py
```

前提: 右の試作を既存READMEの手順で描画済み、Node/Python/Pillow/ffmpeg、Meiryoフォント、外部snapshot `C:/workspace/remie/rigging/astra-chan/workspace-notes/wry-smile-expression-v2/saved-r843`。新環境では同snapshotの取得が必要。prepareは現行receive.jsonから比較用performanceを作り、元ファイルhashを記録する。renderは既存試作の実モデル描画経路を再利用する。生成物・全入力hashは `tmp/speech-motion/nod-comparison-v1/`。終端確認用1frameを含む85frameで動画コンテナは4.25秒。

有限geometry、動画全decode、左右共通の始終neutral画像一致、右全frame hash一致、viewport・像サイズ一致、入力snapshot/live source/live export不変を確認。通常の相づちとして見えるか、腑に落ちたように見えるかは、無音映像の本人評価を待つ。
制作側でsampleと6時点のcontact-sheetを目視済み。左右のサイズ・配置が揃い、日本語ラベルと共通時間が読めること、0.4秒では左が下降して右が静止し、1.75秒では右が下降して左が戻っていることを確認した。時間的な自然さや意味差の評価は本人の動画確認に委ねる。
