# Codex から Discord の場を操作する

家の Windows PC 上のリポジトリで実行する。Bot と Cockpit の通常の音声設定は準備済みとする。操作は PC 内の `127.0.0.1:8181` を使う。

## 開く

1. スクショや依頼文からサーバー名と VC 名を読む。ロール指定があれば `roles` で対応するロールを選び、同じ `--role` でカタログと開場を実行する。
2. `catalog` で Bot から見える名前を照合する。候補が複数なら VC のカテゴリも照合する。スクショから確定できないときは候補名をユーザーに示し、選択を待つ。Discord ID や PID の調査はユーザーに求めない。
3. 開場結果の `voice`、`role`、`chat` を確認し、接続したサーバーと VC、有効ロール・モデル、読むチャットと利用状態を伝える。次のターンに備え `venueId` を覚えておく。

```powershell
$venueCli = 'apps/soul/agent/scripts/discord-venue.mjs'
node $venueCli roles
node $venueCli catalog --role chappy
node $venueCli open --guild 'サーバー名' --vc 'ボイスチャンネル名' --role chappy
```

ロール指定を省くと Cockpit の通常選択。初回から VC の付属チャットを読み、自発を有効にする。モデルと声はロール、文字起こしは Discord の準備値、見る窓は未選択。指定を受けたときは `--vc-category`、`--model`、`--chat` または `--no-chat`、`--vision`、`--no-self-fire` を使う。Live2Dを使わずに音声で参加させる場合は、開場時に `--no-body` を付ける。この指定は今回の場だけに適用する。名前は完全一致で照合する。開場が一部確認できなかったときも、今回の場の識別子が出たら `status` で残った状態を調べる。チャットの `listening` は選択先を Bot が閲覧でき、本文を読む権限が有効なことを示す。

## 退出と閉場

別ターンでは `status` から場を特定する。対象を確認してから、その `venueId` を操作に渡す。

```powershell
node $venueCli status
node $venueCli status --venue $venueId
node $venueCli leave --venue $venueId
node $venueCli close --venue $venueId
```

- `leave` は VC を退出する。 `phase: open` と `connection: outside` を確認する。
- `close` は VC を退出し、受け付け済みの小タスクを待つ。通常の記憶の書き出しと必要な整理を終え、資料を解放し、その場のために起動した Cockpit を終了する。 `closing: complete` を確認して完了を伝える。 `recording: not-needed` は今回書き出す内容がなかった場合。
- `closing: in-progress` または終了コード 2 のときは、同じ場の `status` を確認する。 `closing: failed` は `closeError` を伝え、 `retryable: true` なら原因を確認して同じ場で `close` を再実行できる。保存後に整理が失敗した場合は、保存済みの記憶を再度書かずに整理から続行する。 `retryable: false` と出た場合は記憶や作業領域の状態確認が必要。
- 既定ポートで通常の Cockpit が動いている場合は操作を止める。別ポートにいる場合も、同じ PC の Cockpit が同一 Bot・同一サーバーの場を使用中なら参加を止める。VC を退出しただけの場は再参加できるため、その場の予約は閉場してプロセスが終了するまで維持する。閉場を再試行できる場合もその間は予約が残る。

## Windows での再現

```powershell
node --test apps/soul/agent/scripts/discord-venue.test.mjs
```

実機で呼び出し元をまたいで確認する場合は次を使う。 `46981` はこの合成試験の空きポートの例。Windows の実行環境がループバックや独立した子プロセスを制限する場合は、これらの隔離コマンドをローカル実行が許可された環境で呼ぶ。

```powershell
$fixture = 'apps/soul/agent/src/test-support/discord-remote-venue-fixture.mjs'
$testDir = Join-Path $env:TEMP ('soul-remote-win-' + [guid]::NewGuid().ToString('N'))
$testPort = 46981
node $fixture setup $testDir $testPort
node $fixture cli $testDir $testPort open --guild '合成サーバー' --vc '出先のVC' --role visitor --model codex-astra --chat '資料'
```

開場コマンドの終了後に別の呼び出しで、出力の `venueId` を使う。

```powershell
node $fixture cli $testDir $testPort status --venue $venueId
node $fixture cli $testDir $testPort leave --venue $venueId
node $fixture cli $testDir $testPort close --venue $venueId --wait-ms 500
New-Item -ItemType File -Path (Join-Path $testDir 'finish-task') | Out-Null
```

`status --venue` で合成書き出し失敗を観察した後、同じ識別子で `close` を呼ぶ。 `complete`、隔離記憶の git コミット、資料の解放、設定の一致を確認する。自動試験はさらに整理の一過性失敗も再現する。

検証では本番と同じ CLI、detached 起動方式、HTTP サーバー、Discord 体験、記憶の書き出し・閉場の口、git を使う。隔離フィクスチャが Cockpit の依存を結線し、Discord SDK、音声・文字起こし、LLM、小タスクの応答と整理本体を合成する。実Discordでの確認結果は[完了記録](wave2-completion.md)を参照。Windows の予約は OS の名前付きパイプを使う。Linux では抽象ソケット、その他の OS ではループバックポートを使う。ポートを使う環境では衝突時に開場を拒否する。
