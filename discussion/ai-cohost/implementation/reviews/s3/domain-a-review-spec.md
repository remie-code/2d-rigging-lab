# S3 Domain A レビュー（spec レーン）: 会話ログ + 発火オーケストレーション

> Status: **PASS（blocking なし）**。2026-07-12・Review-Sylph（spec レーン）。委任元 Orch-Sylph。
> 観点: wave 契約への適合（spec）。読み取り専任。Gnome の説明に依存せず、契約文書・対象ファイル・テスト・独立実行を根拠にする。
> 契約の正: [../../orchestration/s3-wave-plan.md](../../orchestration/s3-wave-plan.md) §2/§3/§4 ・ [../../screens/soul-cockpit.md](../../screens/soul-cockpit.md) §3 ・ [../../waves/s3/domain-a.md](../../waves/s3/domain-a.md) §2（ワイヤ契約）。

## 総合判定

**PASS**。設計裁定 5 件・検証の問い 8 件すべて契約適合。follow-up 台帳（§4-6 / §4-1）の S3 設計前提も反映されている。blocking なし。non-blocking は 4 件（うち 3 件は Gnome の質問と同義で Domain B の UX 裁量、1 件は台帳が S3 スコープ外へ明示先送りした残り波紋）。

### 独立実行で確認した機械ゲート

- `cd apps/soul/agent && node --test` → **tests 257 / pass 257 / fail 0**（Gnome 申告 257 と一致・独立再現）。
- `node scripts/preflight-fire.mjs` → **RESULT: PASS / EXIT=0**（fire→ask→speak→soul 記録・SSE soul(thinking→speaking→idle)+soul transcript を実 HTTP/実 SSE で観測・実 SDK/実 TTS/実マイク不使用）。
- `git diff --stat pnpm-lock.yaml apps/soul/agent/package-lock.json` → **差分ゼロ**（新規依存ゼロを独立確認）。
- `git status --short`: S3 Domain A の変更は cockpit-server(.test)/transcript-buffer(.test) の 4 修正 + fire-injection/fire-orchestrator/preflight-fire の新規のみ。**器（runtime-player）コードへの変更なし**・package.json 変更なし。

## 設計裁定への適合（根拠付き）

### 裁定1（発火経路: POST /api/fire・127.0.0.1 内側）— 適合

- `cockpit-server.mjs:600-612` に `POST /api/fire`。未注入時 503 `{error:"fire not available"}`、受理 202、非受理 200 に `{fired:false,...,state}`。
- host は `assertLoopbackHost(options.host ?? DEFAULT_COCKPIT_HOST)`（`cockpit-server.mjs:279`・非 loopback は throw）。発火口は既存 loopback バインドの**内側**で、新たな外部露出面を作っていない。
- テスト: `cockpit-server.test.mjs:585`（未注入 503）・`:598`（受理 202）・`:619`（busy 200）。

### 裁定2（注入範囲: 直近X分既定5分 + 文字上限安全弁・純関数・設定値）— 適合

- `fire-injection.mjs` の `formatFireInjection(entries, {nowMs, windowMs?, maxChars?})` は **I/O ゼロ・依存ゼロ・時計は引数 nowMs** の純関数。
- 既定 `FIRE_WINDOW_MS = 5*60*1000`（`:27`）、`FIRE_MAX_CHARS = 4000`（`:30`）。両者とも options で差し替え可能 = **設定値**。
- 窓は `appendedAtMs >= nowMs - windowMs`（`:82-83`）。超過時は古い（seq 小）方から落とす（`:92-95`）、**最新 1 行は常に残す**（`while (kept.length > 1 …)`）= 空注入で発火判定を殺さない安全弁。
- テスト: `fire-injection.test.mjs` 8 件（窓内外境界 `:20`・空窓 `:37`・you/soul ラベル `:53`・文字上限で古い方落とし `:64`・最新1行保持 `:79`・不正 nowMs throw `:87`）。
- non-blocking: windowMs/maxChars を**実設定ファイル/環境変数へ結線**するのは Domain B の本番結線の責務（orchestrator は options で受けるだけ・所有権は呼び出し側という契約に整合）。Domain A の spec としては「純関数 + 設定可能」で満たす。

### 裁定3（会話ログ: speaker 追加的・S2 不変・soul=最終テキスト）— 適合

- `transcript-buffer.mjs`: `append` に任意 `speaker`（`"you"|"soul"`・**既定 "you"**・`:120-136`）を追加。不正値は `RangeError`（`:120-124`）。エントリは `Object.freeze` 維持（`:145`）。
- **S2 挙動不変**: discard payload に speaker を足していない（`:139` = `{startMs,endMs,text,reason}`・既存 deepEqual を破らない）。既定 you ゆえ speaker を渡さない耳の結線は不変。独立実行で 257 緑（既存 11 テスト + speaker 新規 3 = `transcript-buffer.test.mjs:175/182/196`）。
- **魂の発話 = 実際に speak へ渡した最終テキスト**: `fire-orchestrator.mjs:158` で `speakImpl(replyText, …)`、`:161` で `buffer.append({…text: replyText, speaker:"soul"})`。記録は replyText。`speak.mjs:72` は `text` を無変換で `tts.audioQuery(text)` へ渡す（正規化・改変なし）ため、**replyText === TTS 入力**。裁定3 の「実際に TTS に渡した最終テキスト」と厳密一致。
- テスト: `fire-orchestrator.test.mjs:94-102`（soul 追記・startMs/endMs=0・text=replyText）。

### 裁定4（最小仮面 v0: 定数・意図的に貧しい）— 適合

- `FIRE_SYSTEM_PROMPT`（`fire-orchestrator.mjs:40-42`）export 済み。「配信の相方。直前の会話を踏まえ短く自然な日本語で一言だけ」+ 箇条書き/記号/長い説明の禁止のみ。凝りは persona 領分に譲る意図的な貧しさ。
- orchestrator 自身は session を受け取るだけで prompt を注入しない（本番結線 Domain B が createLlmSession へ渡す想定・`:91` の JSDoc とコード整合）。
- テスト: `fire-orchestrator.test.mjs:42-45`。

### 裁定5（busy 時 fire 無視 + 状態 SSE 配信）— 適合

- `fire-orchestrator.mjs:121-124`: `state !== "idle"` → `onFire({accepted:false, reason:"busy"})` + `{fired:false, reason:"busy", state}` を即返し（ask を撃たない）。
- 状態遷移ごとに `onState(state)`（`:105-109`・同値は再通知しない冪等）。cockpit が `onState` を SSE `soul` イベントへ broadcast（`cockpit-server.mjs:685`）。
- テスト: `fire-orchestrator.test.mjs:107`（busy 中 2 発目無視・ask は 1 回）、`cockpit-server.test.mjs:619`（busy 200 + state）、`:645`（SSE soul 状態列）。

## 検証の問いへの適合

### 問6（発火オーケストレータの縦串 + busy 状態機械）— 適合

- 縦串 `fire()`（`fire-orchestrator.mjs:116-176`）: busy 判定 → getBuffer null 判定 → 窓収集（空窓は ask 前に empty-window）→ thinking + onFire(accepted) → `session.ask` → 空応答は fireEmptyReply → speaking + `speakImpl`（既定 S1 `speak`・`:32`/`:81`）→ soul append + onSoulTranscript → idle。
- busy 状態機械 idle/thinking/speaking、`finally` で必ず idle 復帰（`:172-175`）。ask/speak throw は `onDiagnostic({type:"fireError"})` に落としてサーバを殺さない（`:167-171`）。speak 落ち時は soul 記録しない（`:158` の後で throw されれば `:161` に到達しない）。
- テスト: `fire-orchestrator.test.mjs` 9 件（状態列 thinking→speaking→idle `:47`・busy `:107`・空窓 ask 未呼び `:146`・ears-not-running `:174`・空応答 fireEmptyReply `:188`・ask throw idle 復帰 `:212`・speak throw idle 復帰 + soul 未記録 `:249`・dispose 後拒否 `:272`）+ preflight-fire で実 HTTP/SSE 縦貫通。

### 問7（ワイヤ契約の一貫性・Domain B が乗せられるか）— 適合

- POST /api/fire の req/res が domain-a.md §2.1 と一致（202 fired / 200 fired:false{reason,state} / 503 未注入）: `cockpit-server.mjs:600-611`。
- SSE 追加イベント §2.2 と一致: `soul`（`:685`）・`fire`（`:686`）・`transcript`（speaker:"soul" の再利用・`broadcastSoulTranscript` `:669-678`）。`toWireEntry` は `entry.speaker ?? "you"` で you/soul を素通し（`:315-322`・S2.5 のハードコード you を追加的に緩和）。
- cockpit.html 側の**既存の拡張予約が齟齬なく消費可能**:
  - `.row.speaker-soul .who`（`cockpit.html:75`）= 話者 soul の行スタイル。`addTranscriptRow` が `row.className = "row speaker-" + speaker`（`:193`）で分岐 = transcript イベントの speaker:"soul" をそのまま描ける。
  - 空 `.marker` span（`:78`/`:199`）= 発火マーカーの入る余地。
  - `diagnostic` 購読口（`:310`）= fireError/fireEmptyReply が既存 diagnostic イベントに乗って観測可能。
- **Domain B が乗せられる形**: soul 行・発火マーカー・busy 表示に必要な材料（transcript speaker、fire イベント、soul 状態イベント）がすべて SSE に出ている。cockpit.html の `subscribe()`（`:296-315`）は現状 soul/fire を購読していないが、これは意図どおり（発火ボタン + busy 表示 + 発火マーカーの UI 結線が Domain B の守備範囲）。ワイヤ契約は消費可能で、拡張予約の受け口は全て実装済み。

### 問8（soul-cockpit.md §3 の拡張予約が S3 ワイヤ契約で実体化可能か）— 適合

- 「AI 応答のタイムライン合流（話者 soul）」= transcript イベント speaker:"soul" の再利用で実体化可能（§2.2）。
- 「発火マーカー」= fire イベント（accepted/atMs/injectedChars）+ `.marker` span で実体化可能。
- 「発火ボタン/発火キー状態表示」= POST /api/fire + soul 状態 SSE（idle/thinking/speaking）で busy 連動が実体化可能。
- いずれも S3 のワイヤ契約が受け口を確定済み。Domain B が UI を乗せるだけ。

## follow-up 台帳の設計前提（spec 観点）

### §4-6「転写は完璧でない」— 反映されている

注入整形は転写バッファの生テキストを話者ラベル付きで素通しするだけで、「完璧な転写」を前提にした整形・フィルタ・固有名詞補正を持たない（`fire-injection.mjs:87`）。最小仮面（裁定4）も「直近の会話を踏まえて返す」よう LLM 側の文脈補正に委ねる形で、聞き違いを許容する発火設計になっている。台帳の「転写は完璧でない前提で設計する」に整合。

### §4-1「watchdog 遅延解決が正本に積まれ得る」— 設計前提に含まれている（残り波紋は S3 スコープ外・非 blocking）

- 注入窓の時間軸に **startMs ではなく appendedAtMs（append 時の壁時計）**を採用（`fire-injection.mjs:10-14` の設計判断・`:82-83` の実装）。遅延解決で後から append されたエントリは「実際に積まれた時刻」で窓判定されるため、「遅延 append が起こり得る」事実を消費側が正しく前提化している。`transcript-buffer.mjs:36-39` も同じ時間軸の使い分けを明記。
- non-blocking の残り波紋: 遅延解決した**古い**発話は append 順で最大 seq を得るため、注入テキスト上は「最も新しい行」として並ぶ（seq 昇順整形ゆえ）。意味順のわずかな捻れだが、台帳が恒久回収（「失敗確定後のジョブは append しない」ガード）を **whisper-inference/client 統合時**へ明示先送りしており（§4-1 併記・§4-新規1）、これは S3 Domain A のスコープ外。Domain A の責務「事実を設計前提に含める」は appendedAtMs 採用で満たされている。**範囲外につき non-blocking**。

## blocking 事項

なし。

## non-blocking 事項

1. **窓幅/文字上限の実設定結線は Domain B**: windowMs/maxChars は純関数・orchestrator の options として設定可能だが、実設定ファイル/環境変数への結線は本番結線（Domain B）の責務。Domain A の spec としては充足。
2. **遅延解決した古い発話の注入内順序の捻れ**（§4-1 由来）: 意味順の軽微な捻れ。恒久回収は台帳が whisper 統合時へ先送り済み・S3 Domain A スコープ外。
3. **cockpit.html は soul/fire SSE を未購読**（`cockpit.html:296-315`）: 意図どおり。発火ボタン + busy 表示 + 発火マーカーの UI 結線は Domain B の守備範囲。受け口（CSS クラス・marker span・診断購読）は実装済みで、ワイヤ契約は消費可能。
4. **Gnome の質問 3 件は Domain B の UX 裁量**（domain-a.md §4）: preflight の npm script 登録・GET /api/fire を 405 にするか・SSE fire の reason 集合に empty-reply/error を足すか。いずれも契約の正しさに影響せず、Domain B の判断に委ねてよい。

## 契約に対する齟齬・見落とし

spec レーンで検出した契約齟齬はなし。ワイヤ契約（domain-a.md §2）と cockpit.html の拡張予約（soul-cockpit.md §3）は齟齬なく接合し、Domain B が乗せられる形になっている。

## 質問（Orch へ）

- 特になし（判断に迷う契約点なし）。§4-1 の恒久ガードが S3 スコープ外へ先送り済みである点のみ、Orch が Domain B / experiments 側の設計注記として引き継ぐか確認されたい（本レビューは non-blocking と判定）。
