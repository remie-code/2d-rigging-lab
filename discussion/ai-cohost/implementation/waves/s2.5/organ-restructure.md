# 魂の器官構造化(機械的移動) 実施記録

> 実施: 2026-07-12。**実施者: Undine(L0)自身**——例外事項として明記: 委任先のOrch-Sylph 2代が環境異常(子エージェントのツール実行が「Tool execution was interrupted」/空応答で連続失敗)により未着手停止したため、ユーザー承認(「うん、仕方ないね 頼めるか？」)の上でL0が直接実施した。機械的作業+機械ゲートのみの問題であることが例外の条件。レビューもL0の自己検証(下記生数字)で代替。
> 合意: [../../_map.md](../../_map.md) 次の行動10(ユーザー合意 2026-07-12)。機能追加・リネーム・リファクタなし、移動+import書き換え+深さ補正のみ。

## 1. 移動(51ファイル、git mv)

| 器官 | 中身 |
|---|---|
| `src/ears/` | pcm-framing, pcm-ring-buffer, speech-segmenter, silero-vad, ffmpeg-capture, whisper-server, whisper-client, whisper-inference, transcript-buffer, ear-pipeline, fixtures-audio(+各test) |
| `src/voice/` | tts-client, mora-timeline, audio-player, speak, wav-encode, wav-duration, fixtures(+各test) |
| `src/mind/` | llm-session, env-guard(+各test) |
| `src/channel/` | channel-client(+test) |
| `src/cockpit/` | cockpit-server, cockpit-page, cockpit-settings-store, **cockpit.html**(+各test) |
| `src/cli/` | cli, ears-cli(+各test) |
| `src/test-support/` | 現状維持(ws-double, ws-client, echo-player, fake-ffmpeg) |

- importスペシファイアの機械的書き換え: 20ファイル(スクリプトで旧→新パスを解決して相対パス再計算。scripts/*.mjs の `../src/...` → `../src/<器官>/...` 含む)。
- **深さ補正(1段深くなったことによる、解決結果を移動前と同一に保つ修正)7箇所**: whisper-server.mjs AGENT_ROOT(`".."`→`"..",".."`)/ silero-vad.mjs DEFAULT_SILERO_MODEL_PATH / cockpit-settings-store.mjs DEFAULT_SETTINGS_PATH / テスト4本の test-support 参照(`join(here,"..","test-support",…)`)。cockpit.html は cockpit-page.mjs と同居移動のため無補正。
- README(apps/soul)の現行パス記述を更新+器官構造の説明1段落を追加。**discussion/配下の過去wave記録・human-gate-procedureは歴史記録として不変**。

## 2. 検証(全てL0自身の実行・生数字)

| ゲート | 移動前 | 移動後 |
|---|---|---|
| `node --test` | tests 231 / pass 231 / fail 0 | **tests 231 / pass 231 / fail 0 / cancelled 0** |
| preflight-cockpit | — | **PASS**(page served・state/devices応答・no hang) |
| check:soul-zone | 緑 | **緑(1313 files・違反ゼロ)** |
| check:deps | 緑 | **緑** |
| lockfile(pnpm-lock.yaml / agent/package-lock.json) | — | **diff空(不変)** |
| 新規依存 | — | ゼロ |

check:source は既知の器側1件(physiology barrel、別タスク化済み)のみで無退行。

## 3. 環境異常の記録(申し送り)

本日、子エージェント(サブエージェント)のツール実行が失敗する環境異常が断続的に発生: (1) Orch初代=ツール結果が空応答×21回で正直停止 (2) Orch二代目=最初のgitコマンドとスキル実行が「Tool execution was interrupted」。L0(メインループ)のツール実行は終始正常。原因不明。**S3以降のwave発進時、子が同症状を示したら「再試行3回まで→正直停止」の規律で早期検知する**(二代目への委任文で導入済み・以後の委任テンプレに含めること)。
