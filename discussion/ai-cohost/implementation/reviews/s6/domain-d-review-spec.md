# S6 Domain D レビュー（spec レーン）— 操縦席 + 実 SDK 確認 + 計測 + docs

> レビュー担当: Review-Sylph（spec レーン・Orch-Sylph からのサブエージェント委任）。
> 判定基準: [../../orchestration/s6-wave-plan.md](../../orchestration/s6-wave-plan.md) §1・§3 Domain D・
> §4・§5 / [../../orchestration/s6-planning-inventory.md](../../orchestration/s6-planning-inventory.md) §6。
> 対象: [../../waves/s6/domain-d.md](../../waves/s6/domain-d.md)（Gnome 成果物）・
> [../../../experiments/s6-conversation.md](../../../experiments/s6-conversation.md)・
> [../../waves/s6/human-gate-procedure.md](../../waves/s6/human-gate-procedure.md)・
> [../../waves/s6/s6-followup.md](../../waves/s6/s6-followup.md)。

## 0. 判定

**合格（blocking 指摘なし・non-blocking 指摘 3 件）**。

wave-plan §3 Domain D が求める 4 要素（自発 ON/OFF トグル・出力デバイス選択 UI・タイムラインのマーカー
行群・実 SDK 確認+計測+docs）はすべて実装ファイルの実物で確認できた。実 SDK 確認（5 ask）は
`observe-conversation.mjs` のコード読解（実行はしていない・規律どおり）から、撃った ask 数・fake/実物の
線引き・未実施項目の明記が記録（domain-d.md §5・s6-conversation.md）と整合していることを確認した。
機械ゲートは自分で再実行し 507/507 全緑、器/契約/lockfile は自分で `git diff --stat` を実行し出力なし
（不変）を確認した。

## 1. 逐条照合

### 1-1. 自発 ON/OFF トグル（wave-plan §1⑤・§3 Domain D）

`cockpit.html` に checkbox（`#self-fire-toggle`）+ 状態表示（`#self-fire-status`）を確認（L179-187）。
`change` イベントで `POST /api/self-fire { enabled }` → `applySelfFire` で反映（L573-592）。

- **永続化+起動時復元**: `cockpit-settings-store.mjs` の `getSelfFireEnabled`/`setSelfFireEnabled`
  （bool 専用・null=未記憶と明示 false を区別）を確認（L119-126）。`cockpit.mjs` の
  `createSelfFireHooks(settings, false)` が `resolveInitialEnabled()` で起動時初期値を解決し、
  `main()` で `selfFireInitialEnabled: selfFireHooks.resolveInitialEnabled()` として
  `createCockpitServer` へ渡っていることを確認（cockpit.mjs L293-309, L505）。
- **手動 Fire が影響を受けないこと**: `cockpit-server.mjs` の `POST /api/fire`（L717-729）は
  `fireOrchestrator.fire()` を直接呼ぶのみで `fireScheduler`/`selfFireEnabled` を一切参照しない
  （`grep` で確認済み・両エンドポイントは完全に独立した経路）。静的に見て退行は無い。
  ただし**この独立性を直接検証する機械テストは見当たらなかった**（§3-2 参照・non-blocking）。
- `cockpit-server.test.mjs` に self-fire 系テスト多数（L1222-1531 付近）: 呼びかけ命中→fire・自発 OFF
  で fire しない・busy 中は要求を出さない・state snapshot 反映・503・SSE `selfFire`（fired:true/false）
  を確認。

判定: **適合**。

### 1-2. 出力デバイス選択 UI（wave-plan §1⑥・§3 Domain D）

`cockpit.html` に `<select id="audio-device-select">` + Refresh/Set ボタン + status 表示を確認
（L182-187）。`loadAudioDevices()`（`GET /api/audio-devices`）→ `POST /api/audio-device { name }`
→ `applyAudioDevice` で反映（L594-635）。`init()` で `loadAudioDevices()` を呼び初期選択肢取得
（L788）。vision-target の写経であることをコード形状で確認（同型の GET→select→POST パターン）。

- `cockpit-server.mjs`: `GET /api/audio-devices`（L770-780・`listAudioDevicesImpl` 既定 Domain A
  `listAudioDevices`）・`POST /api/audio-device`（L781-796）・`snapshot()` の `audioDevice`
  （L429-430）を確認。
- `cockpit-settings-store.mjs`: `getAudioDevice`/`setAudioDevice`（vision target と同型）を確認
  （L112-118）。
- `cockpit.mjs`: `createAudioDeviceHooks`（L263-278）・`onSetAudioDevice`（L427-440・player を
  dispose して player=null に戻す「その場再起動」・§質問1 で明記済みの設計判断）・
  `ensureFireResources()` が `deviceName` を settings 経由で player 生成に渡す（L385-388）ことを確認。

判定: **適合**。「その場再起動」方式は設計裁量（§質問1）で non-blocking。

### 1-3. タイムライン行のマーカー（wave-plan §3 Domain D）

`cockpit.html` に以下を確認:
- `addBargeInMarkerRow`（L452-465）: `diagnostic type==="bargeIn"` を専用行に描画（L748-749）。
- `addSelfFireMarkerRow`（L471-483）: SSE `selfFire` の `fired:true` を kind 付き専用行に（L775-779）。
- `fired:false` は `addGhostRow("(self-fire: <kind> not fired — <reason>)")`（L778）でスケジューラ
  診断のゴースト行として区別。
- barge-in 付随失敗（`bargeInStopError`/`bargeInMouthCloseRejected`/`bargeInMouthCloseError`）は
  既存ゴースト行の型で表示（L751-753）。

`cockpit-server.mjs` 側: `handleDiagnostic` が `elapsedMs`/`charsSpoken`/`totalChars`/`prefix` を
既存 `diagnostic` SSE ペイロードへ additive 拡張（L490-505）。`onFireRequest` の fire 結果を待って
SSE `selfFire`（`{kind,fired,reason}`）を broadcast（L954-981）。

判定: **適合**。

### 1-4. 実 SDK 確認（上限 5 ask・正直性）

`scripts/observe-conversation.mjs` をコード読解のみで確認（実行していない）。

- **ハード上限**: `MAX_ASKS = 5`（L62）。`measuringSession.ask()` で `askCount >= MAX_ASKS` なら
  throw（L296-298）。5 シナリオ構成（barge-in 開始/中断後続き/呼びかけ/区切り/沈黙）が 1 ask ずつ
  消費する設計で、上限ちょうどに一致する（domain-d.md §5-1 の記述と整合）。
- **fake/実物の線引き**: ヘッダコメント（L10-19）で明記。`orchestrator`（実 `createFireOrchestrator`）・
  `scheduler`（実 `createFireScheduler`）・`session`（実 `createLlmSession`・`measuringSession` でラップ
  のみ）は実物。`player`/`channel`/`speakImpl` は fake（L207-261）。沈黙発火の視覚キャプチャのみ
  `listWindows`/`captureWindow` 実 PowerShell を実行（対象は自分で起動した notepad のみ・L152-205）。
  これは s6-conversation.md §0 の記述と一致する。
- **未実施項目の明記**: ヘッダコメント（L31-35）・domain-d.md §5-3・s6-conversation.md §0 の3箇所
  すべてで「barge-in の体感レイテンシ」「口閉じの実機の見え方」「呼びかけ照合の実人声命中率」
  「自発発火の実配信頻度」が**未実施**と明記されている。撃っていないものを撃ったことにする記述は
  見当たらない。
- **env ガード**: `assertSubscriptionAuthEnv(process.env)` を起動直後に呼び、違反時は throw（L264）。
  記録（domain-d.md §5・s6-conversation.md §1）の「apiKeySource=none・warning 0 件」の記述と、
  コードの `env-guard.mjs` 呼び出し構造は整合する。

判定: **概ね適合（正直性は確認できたが、下記 §3-1 のとおり設計上の軽微な脆弱性を検出）**。

### 1-5. docs（人間ゲート手順書・followup 台帳）

`human-gate-procedure.md`: §0 で音響設営（デバイス指定込み・§5 choke point 対応）を最初に手順化、
§6〜§11 で人間ゲート①〜⑥を個別手順化、§12 で S6 固有の切り分け表を用意。wave-plan §1 の①〜⑥と
1 対 1 で対応していることを確認した。

`s6-followup.md`: §1 barge-in 実機体感・§2 呼びかけ照合の実人声拡張・§3 自発発火の定数チューニング・
§4 silenceBudget とセッション使い捨ての関係・§5 セッション使い捨ての方向性・§6 実況長回しの計測・
§7〜§11 各 Domain 由来の申し送りが揃っている。wave-plan §2 裁定10（長回しはスコープ外）との整合も
確認できる（§4-5 で明記）。

判定: **適合**。

## 2. 自分で再実行した生数字

```
cd apps/soul/agent && node --test
# tests 507
# suites 0
# pass 507
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 1311.1312
```

507/507 全緑（domain-d.md §8 の申告と一致・S6 Domain C 後ベースライン 479 → 507 の増分も申告どおり）。

```
git diff --stat -- apps/runtime-player packages                          → 出力なし
git diff --stat -- apps/runtime-player/src/main/control-channel/contract  → 出力なし
git diff --stat -- pnpm-lock.yaml apps/soul/agent/package.json           → 出力なし
```

器コード・契約 JSON・lockfile・package.json は完全不変（自分で確認）。

`git status --porcelain` で本 Domain のスコープを確認: `cockpit.mjs`/`cockpit.test.mjs`/
`cockpit-server.mjs`/`cockpit-server.test.mjs`/`cockpit-settings-store.mjs`/
`cockpit-settings-store.test.mjs`/`cockpit.html`/`apps/soul/README.md`（変更）+
`scripts/observe-conversation.mjs`（新規）のみが Domain D のもの。`channel-client.*`/
`fire-orchestrator.*`/`audio-player.*`/`speak.*`/`barge-in.*`/`fire-scheduler.*`/`ws-double.mjs`/
`fake-media-player.mjs` は先行 Domain A/B/C の未コミット成果物であり、domain-d.md の主張（1 バイトも
触れていない）と整合する（diff の対象外として扱った）。

## 3. non-blocking 指摘

### 3-1. observe-conversation.mjs のリトライがハード ask 上限のカウントから漏れる設計

`measuringSession.ask()`（observe-conversation.mjs L293-327）は `askCount` を **ask() 呼び出し 1 回
につき 1 だけ**インクリメントするが、内部の `for (;;)` ループは空応答/失敗時に `attempt` を
`MAX_RETRIES=3` まで増やしながら **`askWithTimeout` を複数回呼び直す**（= 実際の SDK 呼び出しが
askCount の増分なしに複数回発生しうる）。ヘッダコメント（L61-62）は「実 ask のハード上限（鉄の規律・
wave 計画 §4-4）。リトライも 1 ask としてカウントする」と書いているが、実装は「ask() 呼び出し回数」を
数えているだけで「実際に SDK へ送信した回数」は数えていない。理論上、5 回の `ask()` 呼び出しそれぞれで
リトライが発生すれば最大 15 回まで実 SDK を叩きうる構造になっている。

今回の記録（domain-d.md §5・s6-conversation.md §1）は「リトライは 1 回も発生しなかった」と明記して
おり、その申告が事実なら実際の SDK 消費は 5 回で記録と一致する（Review-Sylph は
`observe-conversation.mjs` を実行できない規律のため、リトライが実際に 0 回だったことそのものは
実行ログから独立検証できていない——これは今回のレビューの構造的な限界として明記する）。ただし、
コメントと実装の齟齬自体は事実であり、将来この観測スクリプトを再実行する際に「上限 5 ask」の
機械的保証が壊れるリスクとして記録しておくべきである。

**修正提案（non-blocking・followup 行き）**: `askCount` の代わりに実際の `askWithTimeout` 呼び出し
回数（またはリトライも含めた総試行回数）をハードガードの対象にする、あるいはリトライ発生時に
`askCount` も増分するようにコメントと実装を一致させる。

### 3-2. 手動 Fire が自発 OFF トグルの影響を受けないことの直接的な機械テストが見当たらない

`cockpit-server.mjs` の `POST /api/fire` と `POST /api/self-fire` はコード上完全に独立した経路
（前者は `fireOrchestrator.fire()` を直接呼ぶのみ・`fireScheduler` を一切参照しない）であることを
静的に確認できた。ただし `cockpit-server.test.mjs` には「self-fire OFF でも手動 Fire は動作する」
ことを明示的に検証するテストケースは見当たらなかった（self-fire 系テストは自発発火要求の経路のみを
検証）。wave-plan §1⑤の本体確認は人間ゲート⑤に委ねられているため blocking ではないが、退行防止の
観点で機械テスト 1 本を足すことが望ましい。

### 3-3. selfFireEnabled のプログラム的 API と HTTP エンドポイントで永続化の挙動が異なる

`server.setSelfFireEnabled()`（プログラム的呼び出し・Domain C の継ぎ目）は `onSetSelfFireEnabled`
を呼ばず、`POST /api/self-fire` のみが永続化する（domain-d.md §7 質問 2 で Gnome 自身も明記済み・
既存 Domain C テストの互換性優先という理由も妥当）。設計裁量として受容可能。

## 4. §質問（Orch への申し送り）

1. §3-1 のリトライ/askCount の齟齬は、今回の 5 ask という記録の正直性そのものを否定する証拠ではない
   （Gnome の申告どおりリトライ 0 回なら数字は一致する）が、**このレビューの構造的限界**（実行禁止
   のため実行ログを直接検証できない）は Orch として認識しておいてほしい。将来この観測スクリプトの
   信頼性を高める意図があるなら §3-1 の修正提案を followup へ追加することを検討されたい
   （s6-followup.md にはまだこの項目は無い）。
2. §3-2 のテスト不足は non-blocking 扱いとしたが、Domain D の test レーンレビューで同様の指摘が
   出ていないか確認してほしい（重複指摘の整理のため）。

## 5. まとめ

- wave-plan §3 Domain D の要求（自発 ON/OFF トグル・出力デバイス選択・タイムラインマーカー・実 SDK
  確認+計測+docs）はすべて実装ファイルの実物で確認し、適合と判定した。
- 実 SDK 確認の記録（5 ask・fake/実物の線引き・未実施項目の明記）はコード読解の範囲で正直性の裏付けが
  取れた（§3-1 の構造的限界を除く）。
- 機械ゲート（507/507）・器/契約/lockfile 不変は自分で再実行し確認した。
- blocking 相当の欠落・捏造・退行は見つからなかった。
