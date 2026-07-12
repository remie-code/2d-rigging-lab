# S3 Domain B design レーンレビュー: 操縦席拡張 + 本番結線 + AHK 同梱 + 計測 + docs

> 判定: **PASS（blocking ゼロ・non-blocking 4 件 + Orch への質問 1 件）**。2026-07-12, Review-Sylph（design レーン・委任元 Orch-Sylph）。
> 対象: `apps/soul/agent/src/cockpit/cockpit.html`・`scripts/cockpit.mjs`・`scripts/cockpit.test.mjs`・`scripts/fire-hotkey.ahk`・`scripts/measure-fire.mjs` + docs。Gnome 実装記録: [../../waves/s3/domain-b.md](../../waves/s3/domain-b.md)。
> 判定基準: [../../orchestration/s3-wave-plan.md](../../orchestration/s3-wave-plan.md) §4。
> 厳守: measure-fire.mjs は**実行していない**（コード読解のみ・実 SDK/実マイク/実器/実再生 不使用）。

## 0. 総合判定

**PASS**。Domain B は追加的変更のみで S2.5/Domain A 成果を汚しておらず、自己完結・loopback 限定・トークン redact・終了処理・実 ask ハードガードの全てをコードで確認した。機械ゲートは本レーンが独立に再実行して全緑（§7）。

## 1. Domain A 成果・既存コード不変（問い 1）

- **Domain A ファイルと domain-a.md 記述の整合**（全部未コミットのため git では分離不能・記録との突合で判定）:
  - `src/cockpit/cockpit-server.mjs`（diff +70/-2 相当）: 変更点は domain-a.md §1.4 の記述と 1:1 対応——fireOrchestratorFactory 注入点（JSDoc + 実装）・`POST /api/fire`（未注入 503 / fired 202 / それ以外 200）・`toWireEntry` の `entry.speaker ?? "you"`・`fireState()`・close() での orchestrator.dispose（try/catch）・broadcastSoulTranscript。**Domain B 由来の混入なし**。
  - `src/mind/fire-orchestrator.mjs`: export は `FIRE_SYSTEM_PROMPT` + `createFireOrchestrator`、options は domain-a.md §1.3 の集合（speakDeps/windowMs/maxChars 含む）のまま。speakImpl 既定 = `../voice/speak.mjs` の speak（同 §1.3 のとおり）。
  - `src/ears/transcript-buffer.mjs`（+37/-6 相当）: speaker 追加（既定 "you"・VALID_SPEAKERS・RangeError）と typedef/JSDoc のみ。onDiscard payload に speaker なし（domain-a.md §1.1 のとおり）。
  - テストファイルは **numstat 実測で追加のみ**: cockpit-server.test.mjs **+179/-0**（hunk は import 1 行 + 末尾追記のみ）・transcript-buffer.test.mjs **+36/-0**（末尾追記のみ）。
- **不変ファイル（git status 実測）**: `src/mind/llm-session.mjs`・`src/voice/speak.mjs`・`src/ears/ear-pipeline.mjs`・`src/cli/cli.mjs` は M なし（完全不変）。器コード（apps/soul 外）も変更なし——status に現れるのは apps/soul + discussion のみ。

## 2. cockpit.html の自己完結（問い 2）

- `https?://`・`<link`・`<script src`・`@import`・`url(` の**機械検索 0 件**（CDN/フォント/外部スクリプトなし）。
- 新規 Fire UI は vanilla JS: `fetch("/api/fire")`（相対パス）+ 既存 EventSource への `soul`/`fire` リスナー追加。既存 CSS 変数（--speaking/--muted）のみ使用。

## 3. scripts/cockpit.mjs の安全性（問い 3）

- (a) **--channel 未指定経路**: `fireOrchestratorFactory` は `args.channel` 真のときだけ定義され、`...(fireOrchestratorFactory ? { fireOrchestratorFactory } : {})` で**未指定なら createCockpitServer への引数自体が存在しない** = S2.5 挙動不変。実起動で確認（§7）。
- (b) **env ガード**: `--channel` 分岐の先頭で `assertSubscriptionAuthEnv(process.env)` を明示呼び（warnings は stderr へ）。llm-session 内ガードとの二重防波堤。
- (c) **shutdown**: `server.close()`（orchestrator.dispose 含む）→ `session.dispose()` → `player.dispose()` → `lazyChannel.close()` を**各個別 try/catch** で畳む（一部失敗でも続行）。EOF clean exit は実測 exit=0（§7）。
- (d) **トークン**: 標準出力は `redactToken(args.channel)` 経由（channel-client.mjs L192・`token=<redacted>` 化を確認)。session_init の stdout 行は model/apiKeySource/tools のみでトークンなし。

## 4. createLazyChannel の設計健全性（問い 4）

- 接続 promise を単一スロットでキャッシュ。**失敗時は catch でスロットを null に戻してから throw** = 非キャッシュ・次回 Fire で再試行。成功はキャッシュ・2 回目以降再接続なし。close() は未接続 no-op・接続済みは close・二重 close 冪等（テスト 3 件で固定・§7 の 269 に含まれ全通過）。in-flight connect 中の close も pending を await して畳む。
- **切断非回復の持ち越しは s3-followup.md §2-1 に正直に記録済み**（運用回避 = 操縦席再起動・回収案と先送り根拠つき）。main 実配線の機械テスト無しも §2-2 に記録済み。

## 5. AHK スクリプトの安全（問い 5）

- POST 先は `"http://127.0.0.1:" CockpitPort "/api/fire"` の**ハードコード**（外部送信なし）・応答不読（async true）・失敗は try/catch で握る（通知なし）。
- ホットキー既定 Ctrl+Alt+F はゲーム操作と衝突しにくい部類・F13 例のコメントアウト付き（Stream Deck 導線）。
- v2 文法の目視確認: `#Requires AutoHotkey v2.0`・`#SingleInstance Force`・`^!f:: FireSoul()`（同一行関数呼び）・`ComObject(...)`・文字列連結（空白）・パラメータなし catch——いずれも v2 として妥当。構文エラーの兆候なし（実行環境がないため静的確認のみ）。

## 6. measure-fire.mjs の規律（問い 6・読解のみ）

- **ハードガード実在**: `MAX_ASKS = 5`・ラッパ `measuringSession.ask` が `askCount >= MAX_ASKS` で **throw**（6 回目拒否）。ループ自体も `i < MAX_ASKS` の 5 周で ask は fire 1 発 1 回。
- **fake 構成**: `speakImpl: fakeSpeak`（実 TTS/実器/実再生に触れない）・channel/player はダミーオブジェクト（speakImpl が fake のため実際には未使用）。実マイクなし（fixture 5 発話を buffer.append）。
- **env ガード**: main 冒頭で `assertSubscriptionAuthEnv(process.env)`（違反 throw = 起動拒否）。finally で orchestrator.dispose + session.dispose。

## 7. 実測（本レーンが独立実行・2026-07-12）

- `node --test`（apps/soul/agent）: **tests 269 / pass 269 / fail 0 / cancelled 0 / skipped 0**（duration 968.9ms）。Gnome 記録（269 = 257 + cockpit-page +6 + scripts/cockpit +6）と一致。
- `node scripts/preflight-fire.mjs`: **RESULT: PASS / EXIT=0**（202 fired=true・SSE soul thinking→speaking→idle + soul transcript 観測・no hang）。
- `node scripts/preflight-cockpit.mjs`: **RESULT: PASS / exit=0**（S2.5 無退行。devices は ffmpeg ENOENT の環境事由で 0 件だが preflight 自体の PASS 判定内）。
- `echo "" | node scripts/cockpit.mjs --port 18979`（--channel なし）: `fire disabled (no --channel). POST /api/fire は 503` 表示 → EOF `closing…` → **exit=0**（clean close・従来挙動）。
- lockfile 3 種 `git diff --stat pnpm-lock.yaml apps/soul/agent/package-lock.json apps/soul/agent/package.json`: **差分ゼロ**（出力なし・新規依存ゼロ）。

## 8. リグレッション面（問い 8）

- cockpit.html の diff は**全て追加**（新 CSS 4 ブロック・fire section・Fire 関数群・SSE リスナー 2 本・diagnostic リスナーへの else-if 2 分岐）+ **コメント文言の更新 3 箇所のみ**（`.row.speaker-soul .who` / addTranscriptRow 注記 / 拡張予約注記）。Start/Stop・Timeline 描画・ゴースト行（asrFailure 分岐は無変更のまま先頭）・footer のコードパスは不変。既存 cockpit-page テスト 7 件も無変更（+60/-0）。

## 9. non-blocking 所見

1. **AHK の COM オブジェクト寿命**: `req` はローカル変数のため FireSoul() リターン時に解放され、非同期送信が理論上は送出前に中断される可能性がある（実際は送出が先行するのが通例・fire は POST 到達時点で発動するので応答切断は無害）。AHK はゲート外の任意同梱なので non-blocking。導入時に 1 回動作確認すれば足りる（不安なら req を static/global に持たせる 1 行）。
2. **cockpit.html の fetch catch 経路**: ネットワーク例外時に `applySoulState("idle")` で即復帰するため、サーバが実際は busy の瞬間にボタンが一瞬有効化され得る。SSE soul が直後に訂正し、サーバ側 busy 状態機械が二重の防波堤なので実害なし。
3. **shutdown の外側 try**: `server.close()` 自体が throw した場合のみ session/player/channel の dispose がスキップされ finally の process.exit(0) に落ちる（close は内部 try/catch + 冪等で throw はまず起きない・cli.mjs の型踏襲）。気になれば server.close() も個別 try/catch へ（数行・任意）。
4. **既存テスト名の含意ズレ**（Gnome 自己申告・domain-b.md §4-1）: cockpit-page.test.mjs の「other diagnostic types do not」は fireEmptyReply/fireError がゴースト行を出す今、名前と実装がズレた（assert は無変更で通過）。次に同ファイルを触る wave で名称更新を推奨。

## 10. Orch への質問

1. **3 チェック（check:soul-zone / check:deps / check:source）の無退行**は wave 計画 §4-2 の blocking 基準だが、domain-b.md §3 に生数字がなく、本レーンの実行許可コマンド一覧（preflight 2 種・--channel なし起動・git・node --test）にも含まれないため**未実測**。別レーンまたは Orch での実測確認を依頼する（Domain B の変更は .html/.mjs/.ahk + docs のみで check:source(.ts 限定)/check:deps に抵触する形跡はコード上ない）。
