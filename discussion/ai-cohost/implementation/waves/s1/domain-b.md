# S1 Domain B 実装記録: TTS クライアント + 常駐再生 + チャネル送出 + 同期

> Status: 実装完了・機械検証全緑（2026-07-12, Gnome）。人間ゲート（実器フル疎通・実再生）は未実施＝choke point。
> スコープ: [../../orchestration/s1-wave-plan.md](../../orchestration/s1-wave-plan.md) §3 Domain B。
> 前提: Domain A（[domain-a.md](domain-a.md)）の純関数 `buildSpeechTimeline` / `wavDurationSec` / `fixtures` を**再利用**（再実装せず）。ユーザーの `npm install` 済み（`@anthropic-ai/claude-agent-sdk` 実在）。ただし Domain B は SDK を使わず**組み込み API のみ**で書いた（依存追加ゼロ）。
> 契約の正: `apps/runtime-player/src/main/control-channel/contract/`（`channel-intent-speech-payload-schema.json` / `channel-exchange-examples.json`）。

## 1. 作成・変更ファイル一覧と各モジュールの契約

すべて特区サブディレクトリ `apps/soul/agent/` 内（pnpm workspace glob 対象外＝lockfile 不変）。器・契約・pnpm-lock には一切触れていない。ランタイム依存は agent-sdk のみのまま（Domain B は node 組み込み API だけで書いた）。

### 新規（Domain B 本体）

| パス | 役割・契約 |
| --- | --- |
| `src/tts-client.mjs` | AivisSpeech クライアント。純関数 `flattenMoras(audioQuery)`（accent_phrases → 平坦モーラ列・pause_mora 非 null も両対応）、`parseAudioQuery(audioQuery)` → `{moras, prePhonemeSec, postPhonemeSec}`。I/O 部 `createTtsClient({baseUrl, speaker, fetchImpl})` → `{audioQuery(text), synthesis(query)}`。`POST /audio_query?text=&speaker=` → JSON、`POST /synthesis?speaker=`（body=query）→ `Uint8Array`。既定 baseUrl `http://127.0.0.1:10101`・speaker `888753760`。非 200 はメッセージ付き throw。`fetchImpl` 注入でテスト可能。 |
| `src/audio-player.mjs` | 常駐再生プロセス。`createAudioPlayer({command, args, spawnImpl, onOutput, onError})` → `{play(wavPath), dispose(), child}`。既定は PowerShell `System.Media.SoundPlayer` を**子プロセス 1 本で常駐**（spawn≈155ms をループ外へ）、stdin に WAV パスを 1 行送ると `PlaySync()` で再生。`play` は指示送出のみ＝非ブロッキング。`writeTempWav(bytes, {dir,prefix})` = 合成 WAV を OS temp に書き出しパスを返すヘルパ。 |
| `src/channel-client.mjs` | 操縦チャネルクライアント（参照ドライバ `reference-driver.mjs` の connect/sendSpeech を**写経**）。`connectChannel(url, {WebSocketImpl, requiredKinds, helloTimeoutMs, replyTimeoutMs})` → `{sendSpeech(timeline), close(), consumeUnknownEventCount(), supportedKinds}`。open→hello 4 秒待ち→supportedKinds に `intent.speech` 照合→`{v:1,id,kind:"intent.speech",payload:{timeline}}` 送出→replyTo 相関で `{result,error,rttMs}`。未知イベント黙殺。`redactToken(url)` も写経。 |
| `src/speak.mjs` | 同期オーケストレーション `speak(text, {channel, player, tts?, ttsBaseUrl?, speaker?, sConfig?, writeWav?})`。パイプライン: audio_query→parse→synthesis→`wavDurationSec`→`buildSpeechTimeline`→temp 書き出し→`channel.sendSpeech`→**accepted 受領→即 `player.play(wavPath)`**。rejected は throw（接続維持）、512 超は `buildSpeechTimeline` の throw を伝播。 |
| `scripts/preflight-tts.mjs` | 実機 TTS 疎通スクリプト（**再生なし**）。audio_query→synthesis→WAV→`wavDurationSec`→`buildSpeechTimeline`→**契約スキーマ全条件を assert**（length 1..512・timeMs 整数厳密単調非負・vowel 5 値・s 0..1）。exit 0=合格。 |
| `scripts/preflight-e2e.mjs` | 人間ゲート用 E2E（**実再生を伴う**・Gnome は実行しない）。CLI で Channel URL を受け TTS→送出→accepted→実再生。`--dry-run` で URL 無し検証（TTS→timeline のみ・送出/再生なし）。 |
| `src/test-support/ws-double.mjs` | Control Channel サーバのテストダブル（node:http upgrade + 自作最小 WS フレームコデック・依存ゼロ）。hello→intent.speech 受信→accepted/rejected 返信。契約 examples の形に忠実。 |
| `src/test-support/ws-client.mjs` | 最小 WebSocket **クライアント**（node:net・W3C API サブセット）。テストで channel-client に注入（後述の方式判断の根拠）。 |
| `src/test-support/echo-player.mjs` | 無音エコープロセス（audio-player テスト用の PowerShell 代役）。 |
| `src/tts-client.test.mjs` (11) / `src/audio-player.test.mjs` (7) / `src/channel-client.test.mjs` (6) / `src/speak.test.mjs` (4) | Domain B の node:test（計 28）。 |

### 変更（Domain A 補強・non-blocking 指摘対応）

| パス | 変更 |
| --- | --- |
| `src/mora-timeline.test.mjs` | 2 ケース追記（32→34 に）: (a) 512 要素 + 極小 body で 1ms 押し出しが 512 連鎖しても厳密単調・整数・512 判定緑（513 は throw）、(b) 先頭モーラが enum 外で脱落する場合の第一出力が previousTimeMs=-1 から非ゼロ raw を素直に取る（0 に丸め込まれない）。純関数本体 `mora-timeline.mjs` は不変。 |

依存グラフは `.mjs`（自 zone 内相対 import）+ node 組み込み（`node:test`/`assert`/`http`/`net`/`crypto`/`child_process`/`fs`/`os`/`perf_hooks`）のみ。器コードの相対 import はゼロ（boundary check 緑で裏取り）。

## 2. 同期方式の実装（accepted→即 play・WAV 実時間軸）

wave 計画 §3 Domain B の同期方針を `speak.mjs` に実装した。

- **t=0 の一致**: 契約上 intent.speech payload に開始時刻はなく、**t=0 = 器がインテントを受理した瞬間**（planning-inventory §1）。`speak` は `channel.sendSpeech(timeline)` の返りが `accepted` になった**その直後に** `player.play(wavPath)` を呼ぶ。すなわち「器の口が動き始めた瞬間」に「声の再生」を合わせる。
- **WAV 実時間軸**: `buildSpeechTimeline`（Domain A）は timeMs を WAV 先頭（無音込み）を t=0 とする軸で組み、最初の発声モーラを `prePhonemeSec`（≈0.1s）分オフセットする。合成 WAV も先頭に同じ 0.1s の無音を持つため、**WAV 先頭無音が器の口の立ち上がり（attack）と概ね相殺**する。魂は「音声先頭無音」と「口の開き始め」を同一時間軸で扱え、Domain B は accepted 時刻に再生を合わせるだけでよい。
- **再生の非ブロッキング化**: `player.play` は stdin へ WAV パスを 1 行書くだけ（即戻る）。実再生（PlaySync）は常駐 PowerShell 側で進む。temp 書き出しは accepted を待たず送出前に済ませ、accepted→play を最速化する。
- **失敗の扱い**: rejected は throw（接続は閉じない＝次の一文を試せる）。512 超は `buildSpeechTimeline` が送出前に throw（S1 は文分割しない・裁定4）。皮膚感の最終判定は一聴ゲート（必要なら prePhonemeSec 引数で先頭オフセット微調整＝純関数の契約変更不要）。

## 3. チャネル機械検証の方式判断（テストダブルの範囲と根拠）

### 確定裁定の遵守

魂→器コード import は特区規律違反（確定裁定）。器の実 channel-server は起動もコピーもできない。`ws` 等の npm 依存追加も Domain B 規律違反。→ 依存ゼロを保つため **node:http の upgrade + 自作最小 WS フレームコデック**でサーバのテストダブル（`ws-double.mjs`）を立て、契約 examples（`channel-exchange-examples.json` の hello/accepted/rejected 形）に忠実に応答させた。

### 予期せぬ障害と対処（重要・成果物として明記）

当初は本番と同じ **Node 組み込み `globalThis.WebSocket`（undici）をクライアント**にして ws-double サーバへ実 TCP 接続する構成にした。しかしこの環境の undici WebSocket クライアントは、RFC 6455 に厳密準拠した自作サーバのハンドシェイク応答を `"Incorrect hash received in Sec-WebSocket-Accept header."` として拒否した。

- 送出した `Sec-WebSocket-Accept` は **node crypto と openssl の双方で「正しい」ことを検証済み**（受信 Sec-WebSocket-Key から `base64(sha1(key + GUID))` を独立計算し一致）。にもかかわらず undici が拒否。原因は undici バンドル内部（`node:internal/deps/undici/undici` の `processResponse`→`failWebsocketConnection`）で、外部からは特定できなかった。外部エコーサーバでの undici クライアント健全性確認は、この環境のネット遮断（`wss://echo.websocket.events` が network error）で不可。
- **undici クライアントそのものの健全性は本課題の検証対象外**: 参照ドライバ（C6）は同じ Node v22.14.0 の undici WebSocket で**実器の channel-server へ接続し人間ゲート合格済み**。つまり undici↔実器のワイヤ疎通は既に実証されている。障害は「undici クライアント ↔ 私の自作サーバ」という**テスト用の組み合わせ**に限った相性問題。

**採った方式（判断）**: 機械テストでは channel-client に**最小 WebSocket クライアント（`ws-client.mjs`・node:net・W3C API サブセット・RFC 6455 mask コデック）を注入**（`connectChannel(url, {WebSocketImpl})`）し、ws-double サーバと実 TCP で疎通させる。これで channel-client の**ロジック**（hello 4 秒待ち・supportedKinds ゲート・replyTo 相関・accepted/rejected 分岐・close・未知イベント黙殺・16bit length 経路の大 timeline）を実配線で検証できる。本番の `connectChannel` は既定 `globalThis.WebSocket`（undici）のまま＝実器との疎通経路は無改変。

### 「配線の存在 ≠ 疎通」の明記

**このテストダブル群が検証するのは配線の存在**（channel-client のプロトコルロジックが契約どおり動くこと）である。**実器とのフル疎通は人間ゲートの `preflight-e2e.mjs` で行う**。実器の channel-server が同じ hello/accepted を返すか・口が実際に同期して動くか・声と口が皮膚感で合っているかは、AivisSpeech + 自律ホスト（runtime-player）を起動して 1 回通すまで確定しない（C 系列の教訓）。テストの緑は「魂側の配線が正しい」の証明であって「実器と疎通した」の証明ではない。

## 4. 検証（Gnome が実行した生出力）

### 4.1 `cd apps/soul/agent && node --test`（Domain A + 補強 + Domain B 全緑）

```
# tests 62
# suites 0
# pass 62
# fail 0
# cancelled 0
# skipped 0
# todo 0
```

内訳: Domain A 34（mora-timeline 18+補強2=20、wav-duration 14）+ Domain B 28（tts-client 11、audio-player 7、channel-client 6、speak 4）。exit 0・hang なし。

### 4.2 `node apps/soul/agent/scripts/preflight-tts.mjs`（実機 TTS 疎通・再生なし・契約 assert 込み）

```
[preflight-tts] baseUrl=http://127.0.0.1:10101 speaker=888753760 text="こんにちは、テストです"
[preflight-tts] audio_query OK: 11 moras (flattened), pre=0.1s post=0.1s, vowels=[o,N,i,i,a,pau,e,u,o,e,u]
[preflight-tts] synthesis OK: 188692 WAV bytes (not played)
[preflight-tts] wavDurationSec = 2.1389s
[preflight-tts] buildSpeechTimeline OK: 9 items
  [100:o:0.65][453:i:0.5][629:i:0.5][805:a:0.85][1158:e:0.7][1334:u:0.55][1510:o:0.65][1686:e:0.7][1863:u:0.55]
[preflight-tts] CONTRACT OK: length 1..512 ✓, timeMs integer & strictly monotonic & non-negative ✓, vowel ∈ a/i/u/e/o ✓, s ∈ 0..1 ✓
[preflight-tts] RESULT: PASS (audio path verified end-to-end, no playback)
exit=0
```

これで「合成テスト（`wavDurationSec`→`buildSpeechTimeline` の合成が実 WAV で成立するか）」の裁定（レビュー note 3）を実機で果たした。moras 平坦化 11 要素・vowel 並び `o,N,i,i,a,pau,e,u,o,e,u` は Domain A の GOLDEN と一致し、N/pau 脱落で 9 要素の timeline が契約全条件を満たす。

> 観測（実機の揺らぎ）: ライブ synthesis の WAV 実長は **2.1389s** で、fixtures.mjs に documented された earlier 測定値 **1.5468s** と異なる（同テキスト・同話者）。パイプラインは実 WAV 長に追従して timeline を組む（均等割りの分母 = 実 body 尺）ため契約は満たす。fixture（1.5468s）はネットワーク非依存の固定テスト土台としての値であり、ライブ値との差は engine の合成尺の実行時変動と解釈できる（`speedScale` 等の既定や engine バージョン差の可能性・S1 スコープ外）。

### 4.3 モノレポ既存チェック 3 種（新規赤ゼロ）

```
===== check-soul-zone-boundary =====
exit=0
Soul zone boundary guard passed: 1267 source files scanned; no 器→魂 imports and no 魂→器 code imports.

===== check-dependencies =====
exit=0
Dependency guard passed.

===== check-source-organization =====
exit=1
Source organization violations found:
- apps/runtime-player/src/main/physiology/index.ts: index.ts must remain a barrel-only entrypoint
```

- boundary・deps: 緑（exit 0）。新規 Domain B ファイル（tts/player/channel/speak/test-support/scripts）を含む 1267 ファイルを走査して違反ゼロ。
- source: exit 1 だが**唯一の違反は既知の `physiology/index.ts` barrel（S1 無関係・Domain A 記録済み）**。違反行は 1 件のみ・`soul` の言及ゼロ（`grep -cE "^- "` = 1、`grep -i soul` = none で裏取り）。**新規赤ゼロ**。

### 4.4 保護パス不変（git）

```
===== git status --porcelain（apps/soul 関連 / 保護パス）=====
?? apps/soul/agent/

===== git diff --stat pnpm-lock.yaml apps/runtime-player/ =====
(空出力 = 変更なし)

===== git diff --stat apps/runtime-player/src/main/control-channel/contract/ =====
(空出力 = 契約 fixture 不変)
```

作業は `apps/soul/agent/` 内に完全に閉じている（新規: Domain B 12 ファイル + mora-timeline.test.mjs への 2 ケース追記）。pnpm-lock.yaml・器コード（apps/runtime-player/）・C4 契約 fixture はすべて diff ゼロ。`npm/pnpm install` は実行していない（既 install 状態を使用）。外部公開ツール未使用・git commit/push なし・機械検証でスピーカー再生なし。

## 5. 未解決の質問（Orch-Sylph へ）

1. **人間ゲート preflight の実施依頼（choke point）**: 実器フル疎通・実再生は `preflight-e2e.mjs` で行う（Gnome は実行しない＝規律）。ユーザー/Undine が「AivisSpeech 起動 + runtime-player 起動 + Channel 開放 + URL 手渡し」の上で `node apps/soul/agent/scripts/preflight-e2e.mjs "ws://127.0.0.1:<port>/channel?token=<token>"` を実行し、**声が鳴り・器の口が同期して動く**ことを一目一聴で確認する必要がある。ここで初めて「配線の存在」が「疎通」に昇格する。皮膚感のズレがあれば prePhonemeSec の追撃調整（純関数の呼び出し値のみ）で吸収する想定。

2. **undici WebSocket クライアント ↔ 自作サーバの相性問題（要記録・S1 進行はブロックしない）**: §3 の通り、この環境の undici WebSocket が RFC 準拠の自作サーバ応答を "Incorrect hash" で拒否する現象を確認した（accept は node/openssl で正しいと二重検証済み・原因は undici バンドル内部で特定不可・ネット遮断で外部エコー検証も不可）。本番経路（undici↔実器）は参照ドライバ C6 で実証済みなので S1 は進められるが、将来 Domain C 以降で魂側に WS サーバ機能が要る場合や、テストで undici クライアントを実配線したい場合に再燃し得る。**確認事項**: この現象を既知事項として記録してよいか（実器疎通が本番経路なので実害はないと判断したが、裁定を仰ぐ）。

3. **ライブ WAV 尺と fixture 値の乖離（§4.2 観測）**: 同テキスト・同話者で synthesis の WAV 実長がライブ 2.1389s / fixture 1.5468s と乖離した。パイプラインは実長追従で契約を満たすため機能上の問題はないが、fixture の documented 値の陳腐化（engine 設定/バージョン差の可能性）として Domain A fixture の注記更新が要るかは要判断（Domain A の管轄・S1 スコープ外の可能性）。

## 6. 質問への裁定（Orch-Sylph 記録・Undine 裁定 2026-07-12）

1. **実器フル疎通・実再生は人間ゲートの `preflight-e2e.mjs` に委ねる**（計画どおり）。§3 の「配線の存在 ≠ 疎通」明記を維持。
2. **undici WS クライアント × 自作テストサーバの "Incorrect hash" 相性問題は既知環境事項として本成果物への記録を承認**。本番経路（既定 `globalThis.WebSocket`）無改変 + テストは最小 WS クライアント注入という対処も妥当。レビューには「本番コードに検証されないパスが残っていないか」の確認を依頼する。
3. **ライブ WAV 尺の実行毎乖離は事実として重要 —「合成尺は決定論でない」**。fixtures.mjs の documented 値の注記を「実測一例であり尺は実行毎に変動、写像は常に実長追従」と更新してよい（golden 入力は不変のまま）。Orch-Sylph 自身の preflight 再実行でも 2.1156s と、Gnome 実行時（2.1389s）とも fixture（1.5468s）とも異なる値を観測し、変動を再裏付けした。
