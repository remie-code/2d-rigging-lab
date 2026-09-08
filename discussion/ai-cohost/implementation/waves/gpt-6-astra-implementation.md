# GPT-6 Astra — implementation evidence

Status: implementation complete, independent review pending. Gnome loop 1 / 2026-09-08.

## Accepted basis / boundaries

- [Wave plan](../orchestration/gpt-6-astra-wave-plan.md)、[integration inventory](../../research/gpt-6-astra-integration-inventory.md)、[CLI candidate probe](../../research/gpt-6-astra-cli-compatibility-probe.md) に従う単一 domain。
- `codex-astra` / `GPT-6 Astra` / `gpt-6-astra` / effort `low` / shared `MODEL_IDENTITIES.chappy` を追加。既定 Claude、既存4選択、既定会話指示本文、既存設定キー、next-accepted-Fire lifecycle は変更しない。
- implementation-orchestration の Gnome/Review-Sylph 分離を維持。OpenAI Docs で公式 baseline を確認し、discussion-management に従って repository facts・実測・未確認を分けた。
- Editor/Runtime、個人設定、global Codex/App、既定 ledger、認証 DB、既存稼働 Cockpit は手動変更していない。stage/commit なし。他担当の既存 worktree 差分は保持。

## Official baseline

本 turn に公式検索後 [GPT-6 Astra Model](https://developers.openai.com/api/docs/models/gpt-6-astra) を open し、正確な model ID、reasoning `low` と画像入力の API baseline を確認した。これは subscription 環境の可用性保証ではなく、下記の実 installed CLI smoke と区別する。新しいモデルへの置換や prompt 再設計はしていない。

## Repository / package facts

実行 cwd は特記なき限り `apps/soul/agent`。Node は `v24.19.0`。

```powershell
npm view @openai/codex-sdk@0.153.4 version dependencies optionalDependencies dist.integrity --json --offline=false
npm view @openai/codex@0.153.4 version optionalDependencies --json --offline=false
npm install --ignore-scripts --no-audit --no-fund --offline=false
npm ls @openai/codex-sdk @openai/codex @openai/codex-win32-x64
& ./node_modules/@openai/codex-win32-x64/vendor/x86_64-pc-windows-msvc/bin/codex.exe --version
```

- candidate / resolved / installed: SDK `0.153.4` → `@openai/codex 0.153.4` → Windows x64 alias `npm:@openai/codex@0.153.4-win32-x64`。実 executable は `codex-cli 0.153.4`。
- SDK metadata の dependency は正確に `@openai/codex: 0.153.4`。CLI metadata の optional platform aliases も6種すべて `0.153.4-*`。SDK integrity は `sha512-z0rN8WMQxwEHYHpDJyKHZwNNUtM/1pdnxmKopIJ3qMCZyyDestaIhSGDZ0v0RSjm+REujcFyNd95oWs78zWgRg==`。
- `package.json` の既存 caret 形式を維持して `^0.144.5` → `^0.153.4`。lock は正確に 0.153.4 family、差分は root dependency と Codex SDK/CLI/platform のみ。他依存は不変。install は `changed 3 packages`、scripts/audit は実行しなかった。
- 最初の sandbox `npm view ... --json`（`--offline=false` なし）は `ENOTCACHED`。承認済み network metadata/install を上記 command で再試行して成功。
- sandbox 内の `--version` は arg0 temp cleanup/PATH alias 作成の access-denied warning を出したが exit 0 / version は取得できた。個人 temp の修復や設定変更は行わず、実 smoke は承認済み実行で成功した。

## Changed files

`apps/soul/agent/` 配下の15ファイル:

- `package.json`, `package-lock.json`: verified Codex family 更新。
- `src/mind/brains.mjs`: Astra frozen registry entry、共有 identity/credential path。
- `src/mind/fire-orchestrator.mjs`: 会話指示 technical ID の追加だけ。
- `src/cockpit/cockpit-server.mjs`: `/api/brain` allowlist の追加だけ。
- `src/cockpit/view-logic/health.mjs`: 表示札追加。
- `src/cockpit/view-logic/conversation-instruction.mjs`: editor technical ID 追加。
- `src/mind/brains.test.mjs`, `src/mind/fire-orchestrator.test.mjs`。
- `src/cockpit/view-logic/health.test.mjs`, `src/cockpit/view-logic/conversation-instruction.test.mjs`。
- `src/cockpit/cockpit-server.test.mjs`, `src/cockpit/cockpit-settings-store.test.mjs`, `src/cockpit/cockpit-ui.test.mjs`。
- `scripts/cockpit.test.mjs`。

加えて本 report を作成。検証中のみ `scripts/.astra-installed-smoke.mjs` を作り、完了後に `apply_patch` で削除した。新規恒久診断 UI/tooling はない。`codex-session.mjs`、`env-guard.mjs`、settings store 本体、Cockpit lifecycle 本体は無変更。

## Focused verification

最終実行 command:

```powershell
node --test --test-isolation=none --test-reporter=tap src/mind/brains.test.mjs src/mind/fire-orchestrator.test.mjs src/mind/codex-session.test.mjs src/mind/env-guard.test.mjs src/cockpit/view-logic/health.test.mjs src/cockpit/view-logic/conversation-instruction.test.mjs src/cockpit/cockpit-server.test.mjs src/cockpit/cockpit-settings-store.test.mjs src/cockpit/cockpit-ui.test.mjs scripts/cockpit.test.mjs | Select-Object -Last 12
exit $LASTEXITCODE
```

結果: **461 tests / 461 pass / 0 fail / 0 skipped**, exit 0, `duration_ms 6901.4698`。

- Registry の exact model/effort 配線、5頭の exact frozen identity、Astra credential 共用を fake App Server で検証。
- 既存 UI selector/editor の ID/label、API 200/Chappy、未知値拒否。
- Astra 指示 save/load/reset、5頭 file round-trip、Astra reset 後の既定本文、既存4頭 override 保全、保存中の既存選択保持と Astra 選択の再読込。
- 既存 next-Fire test を Terra/Astra 両方に展開。in-flight session を setting write で変更せず次 Fire で切替え、Claude へ戻す経路・TTS player 保全も確認。
- 既存 adapter の画像順序/一時ファイル、同 thread/delta/final、失敗回復、subscription env guard テストを再実行。
- 最初の focused pass は追加 persistence test 前の **460/460**（`duration_ms 7167.0458`）。最終461件が現差分の正。
- 先行 command は同じ10ファイルを `node --test --test-reporter=dot ...`（worker isolation default）で実行し、10ファイルすべて worker `spawn EPERM` によりテスト開始前に失敗。既存 worker-free 慣例へ切替えた。

repo root の `git -c core.safecrlf=false diff --check -- apps/soul/agent` は exit 0。

## Broad verification — failed / incomplete classification

広域は計画どおり1回だけ実行した。

```powershell
node --test --test-isolation=none --test-concurrency=1 --test-reporter=tap | Select-Object -Last 25
exit $LASTEXITCODE
```

結果: **1084 tests / 1063 pass / 21 fail / 0 skipped**, exit 1, `duration_ms 12597.7925`。全体 pass ではない。

出力を末尾25行だけに絞り、全 TAP をファイルに保存しなかったため、**21件の failed test 名一覧と全原因は復元できない**。この証拠収集上の制約を parent に相談済み。再 broad は行っていない。

末尾で確定できるのは `src/voice/audio-player.test.mjs` の次の5 test が終了後の非同期活動で `timed out; got []` / `unhandledRejection` を出した事実（これは21件全体の一覧ではない）:

1. `play は PLAY 行を送り STARTED を受け取る（往復・無音）`（103行）。
2. `複数 play は順に往復する（常駐 1 プロセスで連続指示・Source 差し替え）`（115行）。
3. `play は改行を除去して 1 行プロトコルを守る`（129行）。
4. `stop は STOP 行を送り STOPPED を受け取る（barge-in の途中停止）`（142行）。
5. `deviceName は env SOUL_AUDIO_DEVICE_NAME で子プロセスへ渡る（出力デバイス指定）`（187行）。

これらの音声 subprocess test/source は今回無変更で、default test runner の `spawn EPERM` は別実行で実測した環境制約。ただし **広域21件すべてが同原因・既存失敗・今回非関連だとは断定しない**。今回の変更 source/test と共有 adapter/subscription は上記 focused 最終461件で pass。広域残差の判断は independent review/parent に委ねる。

## Installed-binary subscription smoke — measured

実行 command: `node scripts/.astra-installed-smoke.mjs`（検証用 script は削除済み）。1実行、retry なし、成功 turn は上限どおり3回。

- 製品の `BRAINS["codex-astra"].create` と `BRAINS["codex-56-sol"].create` を使用。`codexPath` は override せず、spawn observation で既定 resolver の executable が installed Windows x64 path と一致することを assert。
- env は `process.env` をそのまま使用し、`assertSubscriptionAuthEnvOpenAI` は通過、warnings 0。API key を追加/利用しない。既存 adapter の `forced_login_method="chatgpt"`, `web_search="disabled"`, approval never/read-only/network false は維持。
- adapter の自作 temp cwd（`codex-app-server-session-*`）と、別 `astra-installed-smoke-*` temp の専用 ledger。read-only/no-tools の短い synthetic prompt、1×1 PNG fixture、ランダム8文字 nonce のみ。画面/ユーザー会話を使わない。
- 各 ask は45秒上限、RPC30秒。3 successful turns で停止。本文/nonce回答/transport payload は console や report に保存せず、期待値比較はメモリ内の boolean のみ。

| turn | completed | expected match | deltas | delta / final chars | elapsed ms | delta/final consistency |
|---|---|---|---:|---:|---:|---|
| Astra low image | true | true | 1 | 3 / 3 | 8255 | true |
| Astra low same-thread continuation | true | true | 6 | 8 / 8 | 4151 | true |
| Sol low regression | true | true | 1 | 2 / 2 | 5881 | true |

全 turn の delta thread は各1つ。Astra 2 turn 後の session thread IDs は1件で、初回IDと一致（ID自体は記録しない）。App Server 子プロセスは2個。adapter warning callback は35件（本文は保存せず、内容分類なし）。

### Cleanup / residuals

- 両 session dispose を実行し、**2プロセス終了、両 adapter cwd 削除、専用 ledger の thread IDs 空**を実測。
- 観測した `thread/delete` success response は0、error response も0。**RPC 削除の成功は確認できない**。adapter の既存 best-effort cleanup に委ね、残留 DB/thread metadata の不存在は未確認。DB の直接 inspection/edit はしていない。
- temp root と所有 scratch の実 absolute path/prefix を検証後、所有 scratch だけ削除。PNG は adapter の turn cleanup、script は `apply_patch` で削除。既定 ledger と他 rollout は手動削除していない。
- 上記はこの環境での画像入力受理・同thread継続・短いnonce一致・protocol/delta 一致の限定実測。画像理解品質、長期記憶、全応答の streaming 粒度、音声/会話品質、他 account/platform の可用性は証明しない。人間の通常会話による acceptance は別。

## Restart / build handoff

`package.json` の `cockpit` は `node scripts/cockpit.mjs`、`apps/soul/README.md` の実起動案内は `npm run cockpit --prefix apps/soul/agent`。UI は `.mjs` 静的配信の no-build 構成であるため **build は不要**。依存 install は本作業で済んでいる。

ユーザーが通常の Cockpit プロセス再起動（必要なら既存ブラウザ頁を reload）後、既存 selector で GPT-6 Astra を選択して会話する。設定切替自体は既存の次 accepted Fire 境界を使う。今回、稼働中の Cockpit やブラウザをこちらから再起動/操作していない。
