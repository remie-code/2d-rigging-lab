# S3 Domain B 実装記録: 操縦席拡張 + 本番結線 + AHK 同梱 + 計測 + docs

> Status: 実装完了・機械ゲート緑・実 SDK 計測完了（2026-07-12・Gnome）。委任元 Orch-Sylph。
> 契約の正: [../../orchestration/s3-wave-plan.md](../../orchestration/s3-wave-plan.md) §3 Domain B。
> 消費したワイヤ契約: [domain-a.md](domain-a.md) §2（POST /api/fire・SSE soul/fire・transcript
> speaker:"soul"）。引き継ぎ: [../../reviews/s3/domain-a-review.md](../../reviews/s3/domain-a-review.md) §3。
> 鉄の規律: 実 ask は measure-fire.mjs 内の 5 回のみ（ハードガード付き）・テストは全 fake・
> Domain A 成果 / 器コード / lockfile 不変・新規 npm 依存ゼロ。

## 1. 成果物と責務

### 1.1 操縦席拡張 — `src/cockpit/cockpit.html`（変更・追加的）

- **Fire セクション**（Microphone と Timeline の間・新設）: `#btn-fire` + `soul: <#soul-status>` +
  `#fire-note`。Fire クリックで `POST /api/fire`（body `{}`）。
- **busy 表示**: SSE `soul`（idle/thinking/speaking）連動の `applySoulState()`——idle 以外で
  ボタン disable + 状態をアンバー表示。クリック直後も即 disable（連打防止）、応答 JSON の `state`
  で復帰判定（POST /api/fire は発話完了まで返らない = 応答時点で通常 idle。busy 応答なら state が
  thinking/speaking のまま disable 継続）。
- **非受理 reason の控えめ表示**: `fired:false` は `not fired: busy|ears-not-running|empty-window|…`
  を `#fire-note`（--muted 淡色）に表示。503（--channel なし起動）は
  `fire not available (start cockpit with --channel)` と案内。
- **発火マーカー行**【UX 裁量】: SSE `fire`（accepted:true）で Timeline に独立行
  `HH:MM:SS  fire  *  fired (N lines, M chars injected)`（`.row.fire-marker`・--speaking アンバー）。
  「直後の soul 行の .marker に印」案は不採用——fire 受理から soul 行到着まで思考時間の空白があり、
  受理そのものを独立行にすると 時間差（thinking の長さ）も Timeline 上で読めるため。既存の空
  `.marker` span は行構造ごと不変（触っていない）。
- **発火失敗系の表示**【引き継ぎ Q3 の裁量】: `diagnostic` の `fireEmptyReply` / `fireError` を
  S2.5 ゴースト行の型で `(fire: empty reply)` / `(fire error: <message>)` と淡色表示（無言の消失に
  しない・表示語彙がゴースト行に揃う）。SSE `fire` の reason 集合は現状のまま消費（拡張は
  [s3-followup.md](s3-followup.md) §1-3）。
- **soul 行**: 新規実装なし——S2.5 の受け口（`speaker-*` 行クラス・`.row.speaker-soul .who` CSS）が
  そのまま描けることを確認し、コメントの「拡張予約」注記を実体化済みに更新したのみ。履歴復元
  （GET /api/state）でも speaker が届くので同様に描ける。
- **既存 S2.5 挙動は不変**: Start/Stop・Timeline・ゴースト行・footer のコードは無変更。既存
  `cockpit-page.test.mjs` 7 ケース無変更・新規 6 ケースを末尾追加（既存の型 = 静的 DOM/コード検査）。

### 1.2 本番結線 — `scripts/cockpit.mjs`（変更・追加的）+ `scripts/cockpit.test.mjs`（新規）

- **`--channel <ws-url>` 指定時のみ** fireOrchestratorFactory を注入: 実 `createLlmSession`
  （`FIRE_SYSTEM_PROMPT`・model 既定 claude-opus-4-8）+ `createLazyChannel`（下記）+
  `createAudioPlayer` + speak 既定（orchestrator の speakImpl 既定 = 実 speak）を cli.mjs の型で結線。
  **未指定なら従来どおり（factory 非注入 = POST /api/fire 503）= S2.5 挙動不変**（実起動で確認済み・§3）。
- **設定値オプション**【引き継ぎ 3 の回収】: `--fire-window-min`（分 → windowMs）/
  `--fire-max-chars`（→ maxChars）を orchestrator へ結線（未指定は FIRE_WINDOW_MS/FIRE_MAX_CHARS の
  既定に落ちる）。`--tts-base-url` / `--speaker` は speakDeps へ（writeWav=writeTempWav も cli.mjs の型）。
- **起動タイミングの設計判断**:
  - **LLM セッション = 起動時に常駐起動**（spawn コスト先払い・初回 Fire の TTFT に乗せない）。
  - **Channel = 初回 Fire 時に接続する lazy proxy**（`createLazyChannel`・export してテスト）。
    createCockpitServer の factory は同期呼びで connectChannel は async という構造制約の解でもある。
    接続成功はキャッシュ・**失敗は非キャッシュで throw** → orchestrator が fireError 診断に落とす
    （起動は止めない・操縦席にゴースト行で見える・次の Fire で再試行 = 器を後から立ててもよい）。
    接続成功後の切断は自動回復しない（持ち越し・[s3-followup.md](s3-followup.md) §2-1）。
  - player（常駐 PowerShell・spawn ≈155ms）は起動時に作る。
- **env ガード**: `--channel` 指定時、起動経路で `assertSubscriptionAuthEnv(process.env)` を明示
  （llm-session 内でも通る二重の防波堤・cli.mjs の型）。
- **clean close**: shutdown（SIGINT/stdin EOF）で `server.close()`（orchestrator.dispose 含む）→
  `session.dispose()` → `player.dispose()` → `lazyChannel.close()` を各 try/catch で確実に畳む。
- **テスト**（`scripts/cockpit.test.mjs`・6 件・全タイムアウト付き・fake connectImpl のみ）:
  parseCockpitArgs（無フラグ = 全 undefined・既存 --port/--help 不変・S3 フラグ 5 種）+
  createLazyChannel（lazy 接続 1 回・再利用・失敗 throw → 次回再試行・close の冪等/no-op）。
  main の実配線は実 SDK spawn を伴うためテストしない（担保は実起動確認 + 人間ゲート・
  [s3-followup.md](s3-followup.md) §2-2）。

### 1.3 AHK 同梱 — `scripts/fire-hotkey.ahk`（新規）

- AutoHotkey **v2** 文法。既定ホットキー **Ctrl+Alt+F**（`^!f::`・1 行 1 キーで編集容易・F13 の
  コメントアウト例付き = Stream Deck 向け）。`WinHttpRequest` の**非同期** POST（ゲームを止めない・
  応答は読まない・失敗は握る）。ポートは先頭の `CockpitPort := 8181` で変更可能。
- **127.0.0.1 のみに送る**（外部送信なし・ハードコード）。導入手順・「ゲートはボタンで成立・AHK は
  任意」をファイル内コメントに明記。
- **置き場所 = `apps/soul/agent/scripts/`**【判断】: 操縦席の付属品（叩く先が cockpit の
  /api/fire）であり、起動スクリプト（cockpit.mjs）・preflight と同じ棚が発見性最良。npm パッケージの
  一部としてテスト対象になる .mjs 群と混ざるが、.ahk は node --test の対象外なので実害なし。

### 1.4 計測 — `scripts/measure-fire.mjs`（新規）→ [../../../experiments/s3-summon.md](../../../experiments/s3-summon.md)（新規）

- **実 SDK**（createLlmSession + FIRE_SYSTEM_PROMPT・claude-opus-4-8）+ **実** orchestrator +
  **実** transcript-buffer（fixture の you 発話を積む）+ **fake** speak/channel/player。
  **ask はハードガードで 5 回上限**（6 回目は throw）。会話が積もる形（soul 応答も正本に追記され
  次の注入に混ざる = 実運用形）で fire 5 発。
- **実行結果: 成功（5/5 fired・env ガード通過・apiKeySource "none" = サブスク OAuth）**。生数字は
  §3 と s3-summon.md §1。音声開始 E2E は人間ゲート記入欄（s3-summon.md §4）、**遅延 append の
  発生頻度**【Undine 裁定】は観測項目 + 記入欄（同 §3）として明記。

### 1.5 docs

- [../../screens/soul-cockpit.md](../../screens/soul-cockpit.md): §2.1 を新設して S3 実体化分
  （Fire ボタン/busy 表示・soul 行・発火マーカー・失敗ゴースト行・AHK）を追記、§3 の該当 2 行に
  「S3で実体化済み」を記した。S6/S7/S8 の予約は不変。
- [../../../../../apps/soul/README.md](../../../../../apps/soul/README.md): S3 節を追記（発火の仕組み・
  --channel 起動・オプション・AHK・preflight-fire・measure-fire・人間ゲートへのリンク）。
- [human-gate-procedure.md](human-gate-procedure.md)（新規）: 全器官起動の手順書（AivisSpeech → 器 +
  Channel → 操縦席 --channel → マイク Start → 独り言 → Fire → 声 + 口。S2.5/S1 手順書の型・前提
  バイナリとトラブルシュート表・AHK はゲート後の任意と明記）。
- [s3-followup.md](s3-followup.md)（新規）: 台帳（Q1/Q2/Q3 の見送り分・遅延 append 観測・lazy
  channel の切断非回復・main 結線テスト無し・fire-note 残留・マーカー非復元）。

## 2. Domain A 引き継ぎ質問の裁量選択（Q1〜Q3）

| # | 選択 | 根拠 |
|---|---|---|
| Q1 preflight-fire の npm script 登録 | **見送り** | 既存 preflight 全部が未登録（直接 node 実行）の型を踏襲。followup §1-1 |
| Q2 GET /api/fire の 405 化 | **見送り** | Domain A コード（cockpit-server.mjs）は S3 で変更禁止。機能欠陥ではない。S2.5 followup §1-1 と同時回収が効率的。followup §1-2 |
| Q3 SSE fire の reason 集合拡張 | **現状のまま消費** | empty-reply/error は diagnostic（fireEmptyReply/fireError）で観測可能 → ゴースト行の型で表示（表示の一貫性もこの方が良い）。followup §1-3 |

## 3. 機械ゲートの生数字（Gnome が実行・2026-07-12）

- `cd apps/soul/agent && node --test`: **tests 269 / pass 269 / fail 0 / cancelled 0 / skipped 0**
  （baseline 257（S3 Domain A 後）→ +12。内訳: cockpit-page.test.mjs **+6**・scripts/cockpit.test.mjs
  **+6**。既存 257 は無変更で全通過）。
- `node scripts/preflight-fire.mjs`: **RESULT: PASS / EXIT=0**（Domain A 成果の無退行確認）。
- `node scripts/preflight-cockpit.mjs`: **RESULT: PASS / exit=0**（S2.5 無退行）。
- `--channel` 未指定の実起動: `echo "" | node scripts/cockpit.mjs --port 18981` →
  `fire disabled (no --channel). POST /api/fire は 503` を表示し EOF で `closing…` → **exit=0**
  （clean close・従来挙動）。
- `node scripts/measure-fire.mjs`: **exit=0・5 ask 全成功**（実測サマリ、全数は s3-summon.md）:
  - TTFT: **3899.7 / 3943.4 / 3196.4 / 3344.4 / 3392.1 ms**（fire #1〜#5）
  - ask 全体: **6750.7 / 6153.9 / 6143.2 / 5954.7 / 6745.5 ms**
  - 注入: **1 行 36 字 → 3/127 → 5/193 → 7/253 → 9 行 318 字**（you/soul 混在で累積）
  - usage 合計: input 2,273 tok + cache_creation 1,273 / output 189 tok（model claude-opus-4-8・
    apiKeySource "none"）
- `git diff --stat pnpm-lock.yaml apps/soul/agent/package-lock.json apps/soul/agent/package.json`:
  **差分ゼロ**（出力なし・新規依存ゼロ・scripts 行追加もなし）。
- Domain A 成果（cockpit-server.mjs / fire-orchestrator.mjs / fire-injection.mjs /
  transcript-buffer.mjs + 各 .test）と器コード: **Domain B では一切変更していない**（利用のみ。
  git status に見える Domain A ファイルの変更は Domain A 自身の未コミット成果）。

変更/新規ファイル（絶対パス・Domain B 分のみ）:
- `C:\workspace\remie\code\ai-native-live2d-editor\apps\soul\agent\src\cockpit\cockpit.html`（変更）
- `C:\workspace\remie\code\ai-native-live2d-editor\apps\soul\agent\src\cockpit\cockpit-page.test.mjs`（変更・末尾追加のみ）
- `C:\workspace\remie\code\ai-native-live2d-editor\apps\soul\agent\scripts\cockpit.mjs`（変更・追加的）
- `C:\workspace\remie\code\ai-native-live2d-editor\apps\soul\agent\scripts\cockpit.test.mjs`（新規）
- `C:\workspace\remie\code\ai-native-live2d-editor\apps\soul\agent\scripts\fire-hotkey.ahk`（新規）
- `C:\workspace\remie\code\ai-native-live2d-editor\apps\soul\agent\scripts\measure-fire.mjs`（新規）
- `C:\workspace\remie\code\ai-native-live2d-editor\discussion\ai-cohost\experiments\s3-summon.md`（新規）
- `C:\workspace\remie\code\ai-native-live2d-editor\discussion\ai-cohost\implementation\screens\soul-cockpit.md`（変更）
- `C:\workspace\remie\code\ai-native-live2d-editor\apps\soul\README.md`（変更）
- `C:\workspace\remie\code\ai-native-live2d-editor\discussion\ai-cohost\implementation\waves\s3\human-gate-procedure.md`（新規）
- `C:\workspace\remie\code\ai-native-live2d-editor\discussion\ai-cohost\implementation\waves\s3\s3-followup.md`（新規）
- `C:\workspace\remie\code\ai-native-live2d-editor\discussion\ai-cohost\implementation\waves\s3\domain-b.md`（本記録）

### 3.1 3 チェックの無退行（Orch-Sylph 追記・最終検証 2026-07-12・design レーン質問 1 への回答）

- `check:soul-zone`: **緑（1320 ファイル走査・器→魂 / 魂→器 import 違反ゼロ）**。
- `check:deps`: **緑（Dependency guard passed）**。
- `check:source`: 器 pre-existing の `apps/runtime-player/src/main/physiology/index.ts` 1 件のみ赤
  （S2.5 以前から存在・このチェックは .ts 限定走査で S3 の新規 .mjs/.html/.ahk は非対象 =
  **S3 新規違反ゼロ・無退行**）。

## 4. 質問（Orch/Review へ）

1. **既存テスト名との軽い緊張**: cockpit-page.test.mjs の既存ケース名
   「diagnostic asrFailure adds a ghost row; **other diagnostic types do not**」は、S3 で
   fireEmptyReply/fireError もゴースト行を出すようになり**名前の含意と実装がズレた**（assert 本体は
   asrFailure 分岐の存在確認のみなので**テストは無変更で通過**している）。既存テスト変更禁止の規律を
   優先して名前も触っていないが、次に cockpit-page.test.mjs を触る wave でテスト名の更新を推奨。
2. **Fire ボタンの busy 復帰の初期状態**: ページ load 時は `soul: idle` 固定で描く（GET /api/state に
   発火状態が無い・domain-a.md §2.3 のとおり SSE `soul` で足りる設計）。thinking 中にタブを開き直す
   と一瞬 idle 表示になる（次の soul イベントで直る・POST しても busy で弾かれるので実害なし）。
   気になるなら /api/state への fireState 追加が Domain A 側の拡張として素直（S3 では見送り）。
