# Wave 1 現状と基準

[計画](../../orchestration/soul-structure-refactor-wave-plan.md)

## 本番の経路

以下の Soul 内のパスは `apps/soul/agent/` 起点。行番号は基準時点のソース位置。

- 配信はルートの `start-cockpit.cmd` または Soul の `npm run cockpit` から `scripts/cockpit.mjs` に入り、`src/cockpit/ui/app.mjs` が `/api/stream/start`、`/api/stream/stop`、`/api/kill` を呼ぶ。server は `/api/ears/start|stop` の互換も持つ。マイクと ASR、窓の capture、明示した YouTube ソースはこの場に接続する。`handleVenueVad`、`ingestChatMessage`、`startChatForStream` が場の転写・発話予定と `src/mind/` の判定を結ぶ。`src/channel/channel-client.mjs` と `src/mind/speech-intent-motion.mjs` を経て器に口パク・表情・モーションを指示する。
- Discord は同じ Cockpit のほか、Discord 側の VC 操作と `scripts/discord-venue.mjs` から起動できる。後者は `./cockpit.mjs` を別プロセスで起動し、`src/cockpit/remote-discord-venue.mjs` の ledger/receipt を使う。`src/discord/discord-experience.mjs` が VC・テキスト・資料配送を場につなぐ。話者ごとに受信と転写を扱い、`discord-stream-player.mjs` が同じ VC に返す。VC のみ退出した場合は再生先を保留し、同じ場へ再参加できる。
- 普通の閉場は `src/cockpit/cockpit-server.mjs` の `closeStream` で受付を止め、会話の写しと器官の停止を処理する。受付済みの記憶参照と小タスクを待ち、writer と必要な整理の後に資料を解放する。`finishRemoteVenue` は確定した段を進め、既知の失敗は再試行でき、成否が不明な段は保留する。`scripts/cockpit.mjs` が記憶の保存先と整理を結線する。

## 移動候補と回帰の対応

| 次の担当 | 現在の本番呼出元と相対参照 | 守る回帰と契約 |
|---|---|---|
| Wave 2 記憶・ロール別保存 | `scripts/cockpit.mjs` の `main` と `createStreamVenueHooks` → `createMemoryRecorder`、`createRoleMemoryPlaces`、`createMemoryOrganiserRunner` → `../src/mind/{memory,memory-organizer}.mjs`、`../src/memory/{memory-store,memory-migration}.mjs` | `scripts/cockpit-{stream,organiser-c}.test.mjs`、`scripts/cockpit-discord-{b,c,f,k}.test.mjs`、memory/recall テスト。ロール別 Git、重複保存防止、既存データと整理失敗時の通知。 |
| Wave 2 会話・モデル・ロール設定 | `scripts/cockpit.mjs` の `main` → セッション代行、指示 revision/skills、ロール切替・編集、Codex fast と compaction → `../src/mind/`、`../src/roles/`、`../src/cockpit/cockpit-settings-store.mjs` | `scripts/cockpit-role-edit.test.mjs`、`scripts/cockpit.test.mjs`、mind・roles・設定 store のテスト。既存のロール/モデルID、語彙・指示の適用、設定値と記録形式。 |
| Wave 2 発話・コメント判定 | `src/cockpit/cockpit-server.mjs` の `handleVenueVad`、`ingestChatMessage` → `../mind/{fire-scheduler,barge-in,comment-react,comment-guard,speak-now-decisions}.mjs`。YouTube 接続は `scripts/cockpit.mjs` → `../src/chat/live-chat-client.mjs` | `src/cockpit/cockpit-server.test.mjs`、`scripts/cockpit-stream.test.mjs`、`src/mind/` の判定テスト。配信の busy 策と Discord の speak-now 固定、場をまたぐ結果の破棄。場の世代と寿命は Wave 3 で扱う。 |
| Wave 2 小タスク実行 | `scripts/cockpit.mjs` → `../src/mind/local-task.mjs`。`src/cockpit/venue-task-resources.mjs` → `../mind/task-session.mjs`。共通小タスクは `../discord/discord-pdf-renderer.mjs` を使う | `src/mind/{local-task,task-session}.test.mjs`、`src/cockpit/venue-task-resources.test.mjs`、Discord K/J/Final と普通・リモート閉場。資料は場ごとの絶対パス。PDF アダプターの所有先は実利用から決め、受理停止と解放は Wave 3 の場担当に任せる。 |
| Wave 2 音声・身体・Discord アダプター | `scripts/cockpit.mjs` の `main` → lazy Channel、voice engine manager、`createDiscordVenueExperience`、player slot → `../src/{channel,voice,ears,eyes,discord}/` と `../src/mind/speech-intent-motion.mjs` | `scripts/cockpit-{stream,discord-d,discord-e,discord-g,discord-i,discord-final-2}.test.mjs`、`src/cockpit/cockpit-server-discord-{d,i}.test.mjs`、器官・speech-intent・器側制御チャネルのテスト。体の有無、声の出口、複数話者、局所/外部 STT と資産パス。 |
| Wave 3 場の状態・小タスク・閉場 | `src/cockpit/cockpit-server.mjs` の `openStream`、`closeStream`、`endStreamForShutdown`、`finishRemoteVenue` → `./venue-task-resources.mjs`、`../mind/{local-task,recall-desk}.mjs`、`../discord/discord-experience.mjs`。`scripts/cockpit.mjs` は `createStreamVenueHooks` とプロセス終了を結線 | `scripts/cockpit-stream.test.mjs`、`scripts/discord-venue.test.mjs`、`src/cockpit/cockpit-server-discord-{b,d,i,j,final,m}.test.mjs`、`src/cockpit/venue-task-resources.test.mjs`。受付済み仕事、VC再参加、資料解放順、保存を二重にしない条件、remote 各段の取り扱い。 |
| Wave 4 起動・HTTP・表示 | ユーザーの各 CLI → `scripts/cockpit.mjs` / `scripts/discord-venue.mjs` → `../src/cockpit/cockpit-server.mjs`。`src/cockpit/cockpit.html`、`ui/app.mjs` と各 UI が HTTP/SSE、`view-logic/` が表示の値を扱う | `src/cockpit/{cockpit-page,cockpit-static-assets,cockpit-ui*,cockpit-server*}.test.mjs`、`scripts/discord-venue.test.mjs`。既存引数、起動元、多様な状態・警告・計測。ソース文字列を確認していたテストのうち移動対象は、監視していた本番結線を再確認する。 |

## 維持する領域と外部契約

- Soul の独立 npm は `apps/soul/agent/{package.json,package-lock.json}`。器官の既存ディレクトリと公開起動ファイルを維持候補とする。本番入口には `scripts/fire-hotkey.ahk` のローカル発火 API もある。調査・preflight・ベンチの各 scripts は通常運用と分けて棚卸しし、実サービスに接続するスクリプトは隔離運用試験の入口から外した。
- `src/cli/` は各起動コマンドと引数処理の所属を維持し、Cockpit 組み立てとの境だけ Wave 4 で確認する。`src/test-support/` は隔離用の Discord fixture と器のモーション fixture を維持し、呼出元の移動時に連動して実組み立て・資産への参照を点検する。`scripts/{preflight-*,probe-*,observe-*,bench-*}.mjs` と咳・HAAS などの独立実験は起動名と出力先を維持する。
- agent root を基準とする既存データは `roles/<id>/{role.json,instructions.md}`、`skills/`、`memories/<role-id>/`、`memory-backups/<role-id>/`、`cockpit-settings.local.json` とバックアップ、`codex-rollouts.local.json`、`session-usage/`、`fire-diagnostics/`、`tmp/{remote-discord-venue,restructure-backups,speech-intent-motion,speech-intent-none}/`、`.env.{elevenlabs,decisions}.local`、`vendor/`。`src/memory/conventions-seed.md` とローカル STT worker の相対参照も移動時の点検対象。
- `apps/soul/reference-driver/reference-driver.mjs` は別の実行入口。器の `apps/runtime-player/src/main/control-channel/reference-driver-{sustained-drive,perceptual-timeline,speech-timeline}.test.ts` が `../../../../soul/reference-driver/reference-driver.mjs` を子プロセスで起動する。器の制御チャネル契約・ServerHello の `speechMotions` とモーション資産 `apps/runtime-player/assets/speech-motions/` は維持対象。`scripts/check-soul-zone-boundary.mjs` が Soul と器の相互ソース import を検査する。

## 実行記録

既存の配信テストは保存コミットを代替し、Discord リモートの統合回帰は実 Git を使う一方で主会話と普通の閉場を通らないため、両モードの通常経路を `scripts/cockpit-venue-memory.test.mjs` に追加した。

- `apps/soul/agent` で `node --test scripts/cockpit-venue-memory.test.mjs` を loopback 許可で実行し、2/2 件成功。`wave-one-stream` と `wave-one-discord` を別の OS 一時ルートに置き、開場前に `createRoleMemoryPlaces` の解決結果と実記憶先を照合。実 HTTP `/api/stream/start` → 耳の入力 → `/api/fire` → 通常 `/api/stream/stop` を通した。`writeStreamRecord` は会話の両側が入った Markdown を各隔離 Git にちょうど一件コミット。seed HEAD が親で、記録した blob がファイルと一致し、未追跡ファイルを含む作業状態もクリーンだった。
- チャッピー本人の記憶 Git `apps/soul/agent/memories/chappy` を前後に読み取った。どちらも HEAD `1efb907b9b6f8da3d84fcc9dc69f5e39e40c8ece`、`git --no-optional-locks … status --porcelain=v1 --untracked-files=all` は空。本人の設定・実 Discord VC・実サービスを試験に使用しなかった。
- 隔離統合は Cockpit の本番 factory と HTTP・場・会話 orchestrator・記憶実装・Git を通し、Discord ライブラリ、マイクと STT、会話と writer の LLM、TTS と音声出力は代替した。体、YouTube、organiser は既存回帰で個別に守る。CLI 本体は既定の移行と保存先に接続するためこの隔離試験では起動せず、公開された本番 factory を結線した。実際の配信と通話は全Wave後の本人確認で扱う。

- Runtime Player は `apps/runtime-player` で `node ../../node_modules/vitest/vitest.mjs run -c vitest.config.ts`。156 ファイル、1095/1095 件が成功。器側から起動した reference-driver の sustained-drive、perceptual-timeline、speech-timeline 各 1 件を含む。Windows、Node v24.19.0、Vitest v3.1.4。初回の通常サンドボックスで拒否された loopback 接続は、対象テストの安全を確認し権限付きで再実行した。
- Soul 境界 guard は 1713 ファイルで成功し、fixture 5/5 件が成功。Soul のソース構成チェックも成功。リポジトリ全体のソース構成チェックは起点にある `apps/runtime-player/src/main/physiology/index.ts` の barrel-only 違反を報告した。
- Soul の初回 `node --test` は 2589/2591 件成功。Discord リモートの `status --venue` が終了記録の PID を生存と見て `closing: in-progress` を返し失敗し、WinRT PDF 描画 1 件は 10 秒でタイムアウトした。両ファイルの `--test-concurrency=1` 再試行は 15/15 件成功。初回との結果差の原因は未確定。後続の基準コマンドは `node --test --test-concurrency=4` とする。
- `apps/soul/agent` で `node --test --test-concurrency=4` を loopback 許可で実行し、新規の隔離試験を含む 2593/2593 件が成功した。失敗・キャンセル・skip は 0。Windows PowerShell、Node v24.19.0、107.217 秒。
