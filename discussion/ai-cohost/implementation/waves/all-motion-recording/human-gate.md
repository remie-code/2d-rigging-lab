# 実会話の区間から演技版を開く

実会話での本人確認は未実施。

1. 場を終えて操縦席と Player を閉じ、普段使う配布版を自律ホストとして起動する。通常版は `apps/runtime-player/dist/win-unpacked/Runtime Player.exe`、portable は `apps/runtime-player/dist/Runtime Player 0.0.0.exe`。どちらも `--role=autonomousHost` を付ける。
2. リポジトリ直下の `start-cockpit.cmd` から操縦席を起動し、Player の Channel URL に接続する。体あり・ElevenLabs のロールで新しい場を始め、普段どおり会話する。[起動と接続の手順](../intent-motion/human-gate.md#起動)
3. リポジトリ直下の PowerShell で、今回の `sceneId` と `decision.kind` が `selected` の記録を選ぶ。以下は最近の選択済み記録と参照を表示する。

   ```powershell
   Get-ChildItem 'apps/soul/agent/tmp/speech-intent-motion' -Filter '*.json' |
       Sort-Object LastWriteTime -Descending |
       Select-Object -First 30 |
       ForEach-Object { Get-Content -LiteralPath $_.FullName -Raw -Encoding utf8 | ConvertFrom-Json } |
       Where-Object { $_.decision.kind -eq 'selected' } |
       Select-Object recordedAt, sceneId, utteranceId, sectionId, text, decision, definition
   ```

4. 該当 JSON の `intent`、`rawIntentTag`、`text`、`decisionInput`、`context` を読み、`decision` の演技と対象を確認する。下の `$recordPath` へ該当ファイルのパスを入れると、Player 側で保存された定義とクリップを開ける。

   ```powershell
   $recordPath = '<該当する JSON ファイルのパス>'
   $section = Get-Content -LiteralPath $recordPath -Raw -Encoding utf8 | ConvertFrom-Json
   $ref = $section.definition
   if ($ref.sha256 -and $ref.archiveDirectory) {
       $path = Join-Path $ref.archiveDirectory ($ref.sha256 + '.json')
       if (Test-Path -LiteralPath $path -PathType Leaf) {
           $hash = (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash
           if ($hash -ine $ref.sha256) { throw '演技定義のハッシュが区間記録と一致しません' }
           $definition = Get-Content -LiteralPath $path -Raw -Encoding utf8 | ConvertFrom-Json
           $definition
           if ($ref.clipId) { $definition.clips.($ref.clipId) }
       } else { Write-Output "演技定義の保存ファイルなし。接続時の状態 $($ref.archiveStatus)" }
   }
   ```

`definition.archiveStatus` は接続時の状態。`pending` の参照は上の手順で保存ファイルの存在と内容を確認できる。定義の保存エラーは、Player スロットの `ai-cohost-fire-diagnostics/runtime-player/control-channel.jsonl` の `speech_motion.assets` に出る。`clipId` が空の未制作ペアでは演技定義までを参照できる。既に編集・削除した演技も、保存された版から開ける。

`motionPlayback` は要求状況と応答の観測、`audioPlayback.ranges` は区間本文のどこまで音声経路が観測できたかを示す。`accepted` は Player の要求受付を示し、実描画は `visibility: unobserved` と記録される。

区間 JSON の保存失敗は `apps/soul/agent/fire-diagnostics/speech-intent-recording-errors.jsonl` で発火番号、generation、sectionIndex とともに確認できる。
