# S2.5 Domain B レビュー（specレーン）: ページ本体+仕上げ

> レビュアー: Review-Sylph（specレーン）。2026-07-12。
> 対象: `apps/soul/agent/src/cockpit.html` / `apps/soul/agent/src/cockpit-page.mjs` /
> `apps/soul/agent/src/cockpit-settings-store.mjs` / `apps/soul/agent/scripts/cockpit.mjs` /
> `apps/soul/agent/scripts/preflight-cockpit.mjs` /
> `discussion/ai-cohost/implementation/waves/s2.5/human-gate-procedure.md` / `apps/soul/README.md`（S2.5節）
> 判定基準: [screens/soul-cockpit.md](../../screens/soul-cockpit.md)（Accepted・UX正）/
> [waves/s2.5/domain-a.md](../../waves/s2.5/domain-a.md) §3-5（ワイヤ契約の正）/
> [orchestration/s2-5-wave-plan.md](../../orchestration/s2-5-wave-plan.md) §3 Domain B・§4 blocking
> 実装記録: [waves/s2.5/domain-b.md](../../waves/s2.5/domain-b.md)

## 0. 総合判定

**PASS（blockingゼロ）**。見た目そのものは人間ゲート領分のため判定対象外。構造・契約消費・手順書はいずれも
仕様に適合。non-blocking note 2件・質問1件（Orch/Undineの裁定を仰ぐ）を下記に記録。

## 1. 観点ごとの判定

### 1. 画面要件（§2）の構造充足 — 適合

`cockpit.html` に soul-cockpit.md §2 の全要素が DOM 構造として存在する（`cockpit-page.test.mjs` の
「every required region」テストで9識別子を機械固定済み）:

- ヘッダ: `#ears-status`/`#ears-dot`（Listening/Stopped）+ `#health-whisper`/`#health-ffmpeg`（whisper/ffmpeg
  死活）。`applyHealth()` が `down` 時に `status + " — " + reason` を赤太字（`.hstat.down` CSS）で描く —
  「down は赤+理由」の要件を満たす。
- Microphone: `#device-select`（`loadDevices()` が `/api/devices` の `devices[]` からオプション構築 +
  `lastDevice` を `selectDeviceIfPresent` で初期選択）+ `#btn-start`/`#btn-stop`。
- Timeline: `#timeline`（`role="log"`）。`addTranscriptRow()` が時刻（`fmtClock(appendedAtMs)`）/話者
  （`speaker`）/本文/レイテンシ（`latencyMs != null` のときのみ）を描画。`showSpeakingRow()`/
  `removeSpeakingRow()` が VAD の speechStart/speechEnd/speechCancel で `(speaking)` ライブ行を出し入れする。
- footer: `#footer-discarded`/`#footer-uptime`。

各要素はワイヤ契約のどのデータで駆動されるか（§4/SSE イベント種別との対応）が `domain-b.md` §2 の対応表に
明記されており、実装（`applyState`/イベントリスナ群）と齟齬なく一致している。

**note（non-blocking）**: soul-cockpit.md §2 のモック図では `(speaking)` 行にも時刻列
（`12:02:03  you   ······(speaking)`）が描かれているが、実装の `showSpeakingRow()` は `time` span を生成
するのみでテキストを設定しない（空表示）。モックは図としての例示であり UX 定義の本文（§2 箇条書き）は
「発話中は VAD イベントで『(speaking)』のライブ行を出す」としか要求しておらず時刻列を明示要件にしていない
ため blocking ではないが、見た目の細部としては human-gate 実行者が気づく可能性がある。裁量の範囲内と判定。

### 2. ワイヤ契約の消費 — 適合

`cockpit-page.test.mjs` の「consumes the Domain A wire contract」テストで `EventSource("/api/events")`・
`/api/devices`・`/api/state`・`/api/ears/start`・`/api/ears/stop`・SSE `state`/`vad`/`transcript`/`discard`
の `addEventListener` を機械固定済み。実体（`cockpit.html` 246-292行目）をコード上でも突き合わせ、
domain-a.md §3-5 と齟齬がないことを確認した:

- `POST /api/ears/start` の body は `{device}`（デバイス未選択時は `null`）。サーバ側
  （`cockpit-server.mjs` 561行目）は `body.device ?? url.searchParams.get("device") ?? (await
  resolveLastDevice())` と `??` 判定のため、明示的な `null` でも `lastDevice` へフォールバックする —
  契約§3.4「省略時はlastDeviceにフォールバック」の意図どおりに動作する（「明示null」と「省略」を区別
  しない設計で問題なし）。
- `GET /api/state` の `transcripts[]` 復元と SSE `transcript` のライブ受信を同じ `addTranscriptRow()` で
  扱いつつ `latencyMs` の有無だけで分岐しており、契約§3.3注（履歴にlatency無し）を正しく消費している。
- `POST /api/ears/start|stop` 応答が `!res.ok`（409/500）のとき `state`（同梱）を `applyState()` に渡して
  畳んでいる — 409（transitioning）応答もこの汎用エラー経路で処理される（専用分岐はないが契約上必須では
  ない）。

### 3. 拡張予約（§3） — 適合（枠だけ・作り込みなし）

- 話者 you/soul: `row.className = "row speaker-" + speaker` + `.row.speaker-soul .who { color: #8fb7ff; }`
  という CSS フックがあるが、v0 は `speaker = d.speaker || "you"` で実質 `you` 固定（サーバ側
  `toWireEntry()` も `speaker: "you"` 固定）。将来 `soul` が届いても表示側は破綻しない構造。
- 発火マーカー: 各転写行に空 `.marker` span（`addTranscriptRow` 198行目）。v0 は空のまま — 枠だけで
  中身を作り込んでいない。
- `diagnostic` 購読口: `es.addEventListener("diagnostic", function () { /* 拡張予約 */ })` — 購読するが
  何も描画しない。将来枠を塞いでもいない（イベント自体は届く）。
- コストメーター等 S3 以降の項目（§3 表の他行）は実装に存在せず、作り込み過ぎもない。

### 4. 「ないもの」（§4）の尊重 — 適合

認証コード・UI いずれもなし（127.0.0.1 限定はサーバ側の構造的担保・Domain A レビュー済み）。転写の
編集/削除に相当する UI・API 呼び出しは存在しない（`cockpit.html` に DELETE/PUT 相当の fetch なし）。
設定編集 UI（閾値・スレッド数等）も存在しない。操縦席は運用面（選ぶ・起動する・見る）に厳密に限定
されている。

### 5. 人間ゲート手順書 — 適合

`human-gate-procedure.md` の手順（起動コマンド1個 → ブラウザで URL を開く → マイクを選ぶ → Start →
喋る → Timeline に積もる → Ctrl+C で終了）を実装と突き合わせた:

- §1 起動コマンド `npm run cockpit --prefix apps/soul/agent` は `package.json`（`scripts.cockpit: "node
  scripts/cockpit.mjs"`）と一致。`scripts/cockpit.mjs` はアクセス URL を標準出力へ3行で表示
  （`[cockpit] listening on ...` / `open ... in your browser` / `Ctrl+C / EOF で終了`）— 手順書 §1 の
  例示ログと文言・構造ともに一致。
- §2「ブラウザで URL を開く」以降、§3 マイク選択+Start、§4 発話→Timeline 積もる、§6 Ctrl+C 終了まで、
  すべてブラウザ操作 or 起動時/終了時のターミナル操作（起動コマンド・Ctrl+C）のみで完結し、**耳の
  制御・デバイス選択・状態確認のいずれにも CLI フラグ操作（`--device`/`--list-devices` 等）が要らない**。
  「CLI を一切触らない」（soul-cockpit.md §5・wave-plan §1）はこの制御操作を指しており、要件を満たす。
- §7「うまくいかないときの切り分け」の症状（device enumeration failed / whisper down / ffmpeg down /
  (speaking) は出るが本文行が来ない / ページが真っ白）は、いずれも実装済みの UI 表示経路
  （`devices-error`/`health-*`/devtools コンソール参照）に対応しており、手順書の記述が実装と整合する
  （空手順・実行不能な手順は無い）。
- SIGINT/EOF ハンドラ（`scripts/cockpit.mjs` 69-72行目）は `server.close()` を呼び、`cockpit-server.mjs`
  の `close()` が pipeline.dispose + SSE end + HTTP close を冪等に行う — 手順書 §6「魂は close で畳む」
  の記述と実装が一致。

### 6. 起動コマンドが1個か — 適合

`npm run cockpit --prefix apps/soul/agent` の1コマンドのみでサーバが起動し、URL がコンソールに表示される。
デバイス名を事前に調べて `--device "名前"` のように打つ必要はなく（S2 の `ears-cli.mjs --list-devices`
相当の作業がブラウザのドロップダウンに置き換わっている）、UX 定義の動機（配信シチュエーションで
「デバイス名を調べて打って起動」が成立しない）を構造的に解消している。`--port N` は任意オプションで
必須ではない。

### 7. 履歴レイテンシ非対称（Domain A レビュー N3 の引き継ぎ） — 裁量許容（spec上は適合）

Domain A の spec レビュー（`domain-a-review-spec.md` §1・質問1）は、`/api/state` の `transcripts[]` に
`latencyMs` が載らない設計を non-blocking としつつ「UX モックとの字面上の齟齬」として Undine への確認を
要請していた。Domain B はこの契約を**そのまま忠実に消費**しており（`cockpit.html` の
`if (d.latencyMs != null)` 分岐、`cockpit-page.test.mjs` の専用テストで固定）、B 自身の裁量でこの非対称を
新たに生んだわけではない。

spec レーンとしての評価:
- 契約の出どころ（transcript-buffer という正本にそもそも latency フィールドが無い・「正本を汚さない」
  設計判断）は妥当で、B が勝手に契約を変える権限もスコープもない（domain-a.md は「変更禁止」）。
- soul-cockpit.md §2 のモック例はライブ受信直後の2行に見えるものにもレイテンシが付いており、必ずしも
  「タブ再読み込み後の履歴復元行」を描いたものとは断定できない（モックは特定シナリオの一断面の例示）。
  UX 本文（§2 箇条書き）も「履歴とライブでレイテンシ表示を区別する」とは明記していない。
- 実害は「耳を起動したままタブを開き直すと過去行のレイテンシ表示が消える」点のみで、転写内容・時刻・
  話者は保たれる。診断面の付加情報が一部の再読み込みシナリオで欠けるだけであり、§5 人間ゲート
  （「操縦席で喋ると転写が積もる」）の合否には影響しない。

**判定: spec としては許容（裁量許容）**。ただし Domain A が既に投げている Undine への確認（非対称を
是正すべきかどうか）は本レビューでは解決しない — Orch/Undine の裁定待ちとして引き継ぐ（下記質問参照）。

## 2. 裁量箇所の評価（実装記録§8）

- ページをファイル配信（`indexHtmlPath`）にした判断: 妥当（テンプレートリテラルのエスケープ問題を
  避け、素の `.html` として編集/レビュー可能にする合理的選択）。
- uptime をクライアント側 1s ローカル刻みにした判断: 診断面の目安表示として妥当。followup §2-1 に
  厳密化の余地が記録されており、v0 として過不足ない。
- デバイス列挙失敗を赤字で surface する判断: `--list-devices` 廃止置換の実効性を担保する妥当な選択。

## 3. followup 記録の妥当性

`s2-5-followup.md` に持ち越された4件（409テスト欠落／devices失敗HTTP未固定／履歴レイテンシ非対称
〈設計どおり・回収不要〉／SSE write失敗のclose任せ）は、いずれも Domain A のサーバコード・機械テストを
「変更しない」という Domain B のスコープ制約（domain-a.md 冒頭・wave-plan §3）から見て正しく B の
scope 外に切り分けられている。B が新たに生んだ blocking な欠落はない。

## 4. 質問（Orch/Undineへ）

1. **履歴レイテンシ非対称の最終裁定**（§1-7）: Domain A レビューが投げた「非対称を許容するか、正本
   （transcript-buffer）に latency を持たせて是正すべきか」という問いは、Domain B が契約を忠実に実装
   済みのため未解決のまま残っている。specレーンとしては blocking にする根拠が無いため PASS 側に
   数えたが、Undine の最終判断（是正するなら S3 以降で正本側の設計変更が要る）を仰ぎたい。
2. **(speaking) ライブ行の時刻列が空**（§1 note）: モック図との細部齟齬。見た目の調整は human ゲート
   領分のため spec レーンでは blocking にしないが、human ゲート実行時に気になる場合は軽微な追修正
   （`t.textContent = fmtClock(Date.now())` 等）で解消できる旨を記録しておく。

## 5. 参照した検証コマンド・ファイル

- `apps/soul/agent/src/cockpit.html`（全文読了・246-292行目のイベント購読/制御ロジックを重点確認）
- `apps/soul/agent/src/cockpit-server.mjs`（`POST /api/ears/start` の device 解決ロジック・§3.4契約との
  突き合わせのため参照）
- `apps/soul/agent/src/cockpit-page.test.mjs`（4テストの assert 内容を精査）
- `apps/soul/agent/package.json`（`scripts.cockpit` の存在確認）
- `apps/soul/agent/scripts/cockpit.mjs` / `scripts/preflight-cockpit.mjs`（起動導線・preflightの実装確認）
- `discussion/ai-cohost/implementation/waves/s2.5/s2-5-followup.md`（持ち越し事項のスコープ妥当性確認）
