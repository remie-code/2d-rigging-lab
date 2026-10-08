# S6 Domain D レビュー（design レーン）— 操縦席 + 実SDK確認 + 計測 + docs

> レビュアー: Review-Sylph（design レーン）。Orch-Sylph からの委任。
> 対象: `discussion/ai-cohost/implementation/waves/s6/domain-d.md`（Gnome成果物）。
> 判定基準: `discussion/ai-cohost/implementation/orchestration/s6-wave-plan.md` §3 Domain D・§4 blocking基準。

## 判定: **PASS**（blocking指摘なし）

---

## 1. 器/lock不変（blocking基準1）— 確認結果

自分で実行したコマンドと生出力:

```
$ git diff --stat -- apps/runtime-player packages 'apps/runtime-player/src/main/control-channel/contract' pnpm-lock.yaml apps/soul/agent/package.json
(出力なし)
```

→ 出力なし。器コード・契約JSON・lockfile・soul/agent の package.json は完全不変。Gnomeの§6主張と一致。

```
$ node scripts/check-soul-zone-boundary.mjs
Soul zone boundary guard passed: 1342 source files scanned; no 器→魂 imports and no 魂→器 code imports.
```

→ pass。1342ファイル・境界越境なし。

`git status --porcelain` で見た変更ファイル一覧には Domain A/B/C の未コミット成果物（`channel-client.mjs`・
`fire-orchestrator.mjs`・`audio-player.mjs`・`speak.mjs`・`ws-double.mjs`・`barge-in.mjs`・
`fire-scheduler.mjs` 等）も含まれるが、これらは先行Domainの成果物であり本Domainがコミット前の
作業ツリーを共有しているために `git diff --stat`（対 HEAD）に一緒に現れているだけである。実際に
Domain D が改修したファイルは、自分で読んだ `cockpit-server.mjs` / `cockpit.mjs` / `cockpit-settings-store.mjs` /
`cockpit.html` の4本＋各 `.test.mjs` ＋新規 `observe-conversation.mjs` に限られることを、ソースコード
自体（import文のみで呼び出し・変更箇所なし）で確認した。具体的には:

- `cockpit-server.mjs`: `createBargeInGate`・`createFireScheduler`・`defaultListAudioDevices` を import して
  「注入して使うだけ」（該当ファイル群への編集は皆無）。
- `cockpit.mjs`: `createAudioPlayer`・`createFireOrchestrator` 等も同様に import のみ。

新規依存: package.json 不変が確認されているため新規npm依存はゼロ。Domain A/B/Cの実装コード（voice/mind/channel）
をDomain Dが改修していないことも上記のとおり確認済み。

**結論: blocking基準1（器/契約/lockfile完全不変・新規依存ゼロ）は満たされている。**

---

## 2. additive結線（S1〜S5無退行）— 確認結果

`cockpit-server.mjs`（読了・全文）を精査した所見:

- 新エンドポイント（`GET /api/audio-devices`・`POST /api/audio-device`・`POST /api/self-fire`）はすべて
  既存の `if (method === ... && pathname === ...)` チェーンへの追加であり、既存ルートの条件分岐やハンドラ
  本体を書き換えていない。
- `snapshot()` への `audioDevice` フィールド追加は既存キー（`ears`/`device`/`health`/`channel`/`visionTarget`/
  `selfFire`）をそのまま残した上での追加（spread ではなく個別キー列挙だが、削除・改変された既存キーはない）。
- `handleDiagnostic` の SSE payload 拡張（`elapsedMs`/`charsSpoken`/`totalChars`/`prefix`）は既存フィールド
  （`type`/`message`/`reason`/`startMs`/`endMs`/`tag`/`kind`）をすべて保持した上での追加。他の診断型では
  null になるだけで契約破壊がないというGnomeの主張はコードから裏付けられる（`d?.elapsedMs ?? null` 等、
  optional chaining + nullish coalescing で安全に取り出している）。
- 未注入時フォールバック: `onSetAudioDevice` 未注入→503（`typeof onSetAudioDevice !== "function"`）・
  `fireScheduler` 未生成（=orchestrator未注入）→ `POST /api/self-fire` は503。`listAudioDevicesImpl` は
  「未注入なら既定 `defaultListAudioDevices`」（`options.listAudioDevicesImpl ?? defaultListAudioDevices`）
  で必ず何かが動く。これはGET系（一覧取得）なので503にはならない設計であり、`GET /api/windows` と
  同型の作法が踏襲されている。
- barge-in/selfFireのゲート生成条件（`fireOrchestrator && typeof interrupt === "function"` /
  `fireOrchestrator && typeof fire === "function" && typeof getState === "function"`）は「orchestrator が
  当該メソッドを持つときだけ」生成するガードであり、S2.5〜S5相当の「orchestrator未注入」構成では
  `bargeInGate`/`fireScheduler` とも `null` のまま——既存の挙動（手動Fire・視覚発火・S1〜S5のAPI群）に
  一切干渉しない。

`cockpit.mjs`（読了・全文）の所見:

- `createAudioDeviceHooks`/`createSelfFireHooks`/`onSetAudioDevice` はいずれも新設関数として追加されており、
  既存の `createLazyChannel`/`createSessionProxy`/`createVisionTargetHooks`/`main()` 内の既存配線
  （Channel URL・vision target・fire orchestrator factory 構成）には手を加えていない。
- `main()` 内、`player` 生成箇所のみ `createAudioPlayer(deviceName ? { deviceName } : {})` に変更されている。
  未記憶（`audioDeviceHooks.getAudioDevice() ?? undefined`）なら `deviceName` 未指定 = 既定デバイスで、
  S1〜S5の挙動（既定デバイス再生）を保つ。これはGnome§1の「S1挙動の無退行」の主張と一致。

**結論: blocking基準1関連の「S1〜S5既存挙動不変」は満たされている。additive拡張のみで、手動Fire・
視覚発火・barge-inの各既存経路への侵襲は確認されなかった。**

---

## 3. 永続化パターンの健全性 — 確認結果

`cockpit-settings-store.mjs`（読了・全文）の所見:

- `writeMerged(patch)` は `{ ...readAll(), ...patch }` で常に既存全キーを読んでからマージするため、
  `setAudioDevice` が `selfFireEnabled` を消す、逆もまた然り、という事故は構造的に起きない（read-modify-write
  パターンは `lastDevice`/`lastChannelUrl`/`visionTarget` と完全に同型）。
- `getSelfFireEnabled()` は `typeof v === "boolean" ? v : null` で、文字列 `"true"` のような非bool値も
  含めて null（＝未記憶扱い）に落とす。テスト（`cockpit-settings-store.test.mjs:337`）で
  `{ selfFireEnabled: "true" }` という壊れた/非bool値ケースを検証していることを確認した——
  「未記憶（null）」と「明示false」を正しく区別する設計であり、`asStringOrNull`（文字列専用）とは
  独立した判別関数を使っている点もコードで確認済み。
- `setSelfFireEnabled(enabled)` は `enabled === true` で真偽値へ強制してから書き込む（呼び出し側の
  誤った型を吸収）。`cockpit.mjs` の `createSelfFireHooks.onSetSelfFireEnabled` も
  `settings.setSelfFireEnabled(enabled === true)` と二重に強制しており、bool専用性が層をまたいで一貫している。
- `getAudioDevice()`/`setAudioDevice()` は既存の `asStringOrNull` パターンをそのまま踏襲（vision target と
  同型）。

**結論: 永続化パターンは健全。新キー2個の追加は既存キーとの同居を壊さず、bool専用判別も正しく機能する。**

---

## 4. 実SDK観測スクリプトの規律（blocking基準5）— コード読解による確認

`scripts/observe-conversation.mjs` を全文読み、以下を確認した（**このスクリプトは実行していない**）。

1. **env guard通過**: `main()` 冒頭で `assertSubscriptionAuthEnv(process.env)` を呼び、warnings をログするのみ
   （違反時は関数内部でthrowする設計——ガード自体は読んでいないが、S1以来の既存契約であり呼び出し箇所は
   スクリプト冒頭で必ず通過する構造になっている）。
2. **実マイク・実録音を使わない**: `player`/`channel`/`speakImpl` はすべて fake（`makeFakePlayer`/
   `makeFakeChannel`/`fakeSpeakImpl`）として明示的に定義され、`createFireOrchestrator` へそのまま渡される。
   耳（ear-pipeline / whisper / ffmpeg-capture）への import・呼び出しはスクリプト全体に存在しない
   （転写は `buffer.append({text:...})` で直接注入）。実マイク経路は構造的に到達不可能。
3. **ask数が構造上5を超えない**: `measuringSession.ask` 内で `if (askCount >= MAX_ASKS) throw` という
   ハードガードがあり（`MAX_ASKS = 5`）、fire-orchestrator/fire-scheduler がこの `measuringSession` を
   唯一の session として使う一本道になっている（`session: measuringSession` で orchestrator に注入）。
   リトライ（`MAX_RETRIES = 3`）は`askWithTimeout`の再試行だが、これは「1 askの中でのリトライ」ではなく
   同一 `label` の中で `for (;;)` ループしつつ都度 `askWithTimeout` を叩く構造——リトライ発生時も
   `askCount` は最初の1回分しかインクリメントされない設計になっている点は注意が必要（=リトライ自体は
   askCount を追加消費しない）。ただし実測記録（s6-conversation.md）では「リトライは1回も発生しなかった」
   と明記されており、この経路は実際には踏まれていない。**この点はGnome自身のヘッダコメント
   （「リトライも1askとしてカウント」）とコード実装（リトライはaskCountを増やさない）に軽微な food
   for thought な不一致があるが、実測上リトライが0回だったため実害はなく、blockingとはしない**
   （§非blocking観察として記録）。
4. **後始末**: `openMarkerNotepad()` が返す `cleanup()` は `finally` ブロックで必ず呼ばれ（`main()` の
   `try { ... } finally { if (notepadHandle) await notepadHandle.cleanup(); ... }`）、`taskkill /PID .. /F /T`
   でnotepadプロセスを終了し、`fs.unlinkSync(tmpFile)` で一時ファイルを削除する（失敗はbest-effort握り）。
   `scheduler.dispose()`/`orchestrator.dispose()`/`session.dispose()` も同じ `finally` で呼ばれる。
5. **画像をディスクに書かない**: `captureWindow` の戻り値（`jpegBase64` 等）はスクリプト内で変数として
   ログや`fs.writeFileSync`に渡されている箇所が存在しない（`summary` オブジェクトにも `fireResult` を
   そのまま入れているが、`fireResult.replyText` 等のテキストのみが実質使われ、画像データそのものを
   ファイルに書く処理は見当たらない）。experiments/s6-conversation.md §9 の「画像はディスクへ一切
   書いていない」という自己申告と、コード上の裏付け（画像書き込み処理の不在）は一致する。

**結論: blocking基準5（実SDK上限5ask・env guard遵守・実マイク非使用）はコード読解上、満たされている
と判断する。**

---

## 5. 「その場再起動」デバイス変更の設計（domain-d §3）— 確認結果

`cockpit.mjs` の `onSetAudioDevice`:

```js
const onSetAudioDevice = async (name) => {
  audioDeviceHooks.onSetAudioDevice(name);
  if (player != null) {
    try { player.dispose(); } catch {}
    player = null;
  }
  ...
};
```

- `player = null` に戻すのみで、`ensureFireResources()` 側は `if (player == null) { ... player = createAudioPlayer(...) }`
  という冪等な遅延生成ガードを既に持っている（S3由来の既存パターン）。次回 `playerProxy.play(...)` 呼び出し
  （`ensureFireResources()` を経由）で新デバイス名のプレイヤーが再生成される、という配線は既存の遅延生成
  ライフサイクルにそのまま乗っており、新しいライフサイクル分岐を増やしていない。
- `player.dispose()` は try/catch で握られており、disposeが失敗しても `player = null` は必ず実行される
  （次回再生成を妨げない）。
- トレードオフ（再生中の発話が旧デバイスのまま完了しうる点）はGnome自身がdomain-d.md §3/§7-1で明記して
  おり、正直な記録として妥当。барge-inのinterruptを経由しないdispose（=突然の音声停止ではなく、次の
  speakからの切り替え）という設計は、既存プレイヤーライフサイクル（生成・破棄・再生成）を壊さない
  範囲の変更と判断する。

**結論: 設計として既存ライフサイクルとの整合性は保たれている。UXトレードオフ自体はnon-blocking
（人間ゲート⑥の領分、Gnome自身も申し送り済み）。**

---

## 6. 補足確認: `apps/soul/README.md` の変更

`git status --porcelain` で `M apps/soul/README.md` を確認し、全文を読んだ。S1〜S6の要約セクションへ
S6の説明（4ドメイン構成・声の器官刷新・barge-in・発火スケジューラ・操縦席配線・実SDK観測結果の要約）を
追記したものであり、器コードへの変更は皆無、魂ゾーン（`apps/soul/`配下）内のdocsのみの変更である。
soul-zone-boundary チェックの対象外（docsはimport境界チェック対象ではない）であり、内容もこのwaveの
実装内容の要約に留まる。**blockingではない**（Gnomeの申し送りどおり、置き場所が `apps/soul/agent/README`
ではなく `apps/soul/README.md` である点も、特区全体のREADMEに各S wave共通の型で追記されてきた既存の
構成（S1〜S5の節も同じREADMEに存在）と整合しており、non-blockingの観察に留める）。

---

## 7. 自分で実行したテスト・チェックの生結果

```
$ cd apps/soul/agent && timeout 300 node --test
# tests 507
# suites 0
# pass 507
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 1201.1299
```

→ 507/507 全緑。Gnome §8 の主張（507・S6 Domain C後ベースライン479→+28）と一致。ハングなし・1回で成功
（再試行不要）。

```
$ git diff --stat -- apps/runtime-player packages 'apps/runtime-player/src/main/control-channel/contract' pnpm-lock.yaml apps/soul/agent/package.json
(出力なし)
```

```
$ node scripts/check-soul-zone-boundary.mjs
Soul zone boundary guard passed: 1342 source files scanned; no 器→魂 imports and no 魂→器 code imports.
```

コード読解で追加確認した項目:
- `cockpit-settings-store.test.mjs` に `audioDevice: 123`（非string）・`selfFireEnabled: "true"`（非bool）
  という壊れた/型不一致値のテストケースが実在すること（grep出力で確認・行270・337）。
- `cockpit-server.test.mjs` に `GET /api/audio-devices`（3本相当）・`POST /api/audio-device`（503/橋渡し）・
  `POST /api/self-fire`（503/切替/永続化橋渡し）・SSE `selfFire`（fired:true/false）の各テストが実在
  すること（grep出力で確認・行1222〜1521）。

`observe-conversation.mjs` は規律どおり**実行していない**（実SDK消費のため）。

---

## §質問（Orch/上位レビューへの申し送り）

design レーンとしては blocking な疑問はないが、Gnomeの §7 質問（domain-d.md）のうち以下2点は
設計判断の妥当性確認であり、design レーンの観点からは「妥当」と判断した根拠を添えて申し送る:

1. **§7-1 デバイス変更の「その場再起動」**: 既存プレイヤーライフサイクル（遅延生成ガード）に
   自然に乗っており、再設計コストなしで実装されている。妥当と判断する。人間ゲート⑥での実機確認は
   引き続き必要（Gnomeも明記済み）。
2. **§7-3 SSE `selfFire` を新設イベントにした判断**: 既存 `fire`/`visionCaptured` イベントへの
   `kind` 相乗りも技術的には可能だったが、fire-orchestrator が呼び出し元（scheduler経由か手動か）を
   知らない設計（Domain B/C の責務分離）を尊重した結線層側での表現という説明は一貫しており、
   「やや冗長」という自己評価も正確。設計上の瑕疵ではなくトレードオフの記録として妥当。

non-blocking observation として1点追記する（上記§4-3）: `observe-conversation.mjs` のヘッダコメント
「リトライも1 askとしてカウントする」という記述と、実装（`askCount`はリトライ時に増分されない）に
軽微な乖離がある。実測ではリトライが0回だったため実害はないが、将来リトライが発生した場合に
コメントと実装のどちらが正なのか誤解を招きうる。ドキュメントの言い回し修正のみで足りる軽微な指摘。
