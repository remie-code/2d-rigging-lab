# S1 Domain B レビュー: TTS クライアント + 常駐再生 + チャネル送出 + 同期

> Reviewer: Review-Sylph（3レーン: spec / design / test）。2026-07-12。
> 対象実装: `apps/soul/agent/`（src/{tts-client,audio-player,channel-client,speak}.mjs + test-support/{ws-double,ws-client,echo-player}.mjs + テスト4本 + scripts/{preflight-tts,preflight-e2e}.mjs + mora-timeline.test.mjs へ 2 ケース追記）。
> Gnome 実装報告: [../../waves/s1/domain-b.md](../../waves/s1/domain-b.md)（§6 に Undine 裁定 3 件を記録済み）。
> 判定基準: wave 計画 [../../orchestration/s1-wave-plan.md](../../orchestration/s1-wave-plan.md) §3 Domain B / §4 ・ 事実台帳 [../../orchestration/s1-planning-inventory.md](../../orchestration/s1-planning-inventory.md) §1/§2/§3/§5 ・ 契約 `channel-exchange-examples.json`（hello/speechPath/rejections）/ `channel-intent-speech-payload-schema.json` ・ 写経元 `reference-driver.mjs` ・ Domain A [domain-a.md](../../waves/s1/domain-a.md) / [domain-a-review.md](domain-a-review.md)。

## 総合判定: **PASS**（3 レーンとも PASS / PASS-with-notes・blocking 指摘ゼロ）

| レーン | 判定 |
| --- | --- |
| spec（契約整合・写経正確性） | **PASS** |
| design（設計・境界・本番未検証パス調査） | **PASS** |
| test（fixture 十分性） | **PASS-with-notes** |

wave 計画 §4 の blocking 基準（lockfile/器コード/契約 fixture 不変・boundary/deps/source 無退行・純関数+fixture・外部公開ツール/install 禁止）はすべて自分の実行で充足を確認。特別依頼（本番未検証パス）は下記のとおり **blocking 該当なし**。

---

## 検証（Review-Sylph が実行した生出力）

### `cd apps/soul/agent && node --test`（狭い修正の適用後）

```
1..62
# tests 62
# pass 62
# fail 0
# cancelled 0
# skipped 0
# todo 0
test exit=0
```

62/62 緑（Domain A 34 + Domain B 28）。狭い修正（fixtures.mjs のコメント更新）適用後も全緑。node v22.14.0。

> 環境の変化（Domain A 時との差）: `apps/soul/agent/node_modules`（`@anthropic-ai` 配下）と `package-lock.json` が**存在する**（choke point の `npm install` がユーザーによって実行済み＝wave 計画 §5-1 の想定どおり）。Domain B のテストは node 組み込みのみを import するため、install 有無に関わらず 62/62 緑。install は独立パッケージ内で完結（pnpm-lock.yaml 不変・後述）。

### `node scripts/preflight-tts.mjs`（実機 TTS 疎通・再生なし・契約 assert 込み）

```
[preflight-tts] baseUrl=http://127.0.0.1:10101 speaker=888753760 text="こんにちは、テストです"
[preflight-tts] audio_query OK: 11 moras (flattened), pre=0.1s post=0.1s, vowels=[o,N,i,i,a,pau,e,u,o,e,u]
[preflight-tts] synthesis OK: 187660 WAV bytes (not played)
[preflight-tts] wavDurationSec = 2.1272s
[preflight-tts] buildSpeechTimeline OK: 9 items
  [100:o:0.65][450:i:0.5][626:i:0.5][801:a:0.85][1151:e:0.7][1326:u:0.55][1502:o:0.65][1677:e:0.7][1852:u:0.55]
[preflight-tts] CONTRACT OK: length 1..512 ✓, timeMs integer & strictly monotonic & non-negative ✓, vowel ∈ a/i/u/e/o ✓, s ∈ 0..1 ✓
[preflight-tts] RESULT: PASS (audio path verified end-to-end, no playback)
exit=0
```

- moras 平坦化 11 要素・vowel 並び `o,N,i,i,a,pau,e,u,o,e,u` は GOLDEN と一致。N/pau 脱落で 9 要素 timeline が契約全条件を満たす。
- **合成尺 2.1272s** — Gnome（2.1389s）・Orch（2.1156s）・fixture（1.5468s）いずれとも異なる**第 4 の値**を観測。裁定 3「合成尺は決定論でない・写像は実長追従」を独立に再裏付けした。再生はしていない（SoundPlayer 未起動）。

### モノレポ既存チェック（新規赤ゼロ）

```
Soul zone boundary guard passed: 1267 source files scanned; no 器→魂 imports and no 魂→器 code imports.  (soul-zone exit=0)
Dependency guard passed.  (deps exit=0)
Source organization violations found:
- apps/runtime-player/src/main/physiology/index.ts: index.ts must remain a barrel-only entrypoint  (source exit=1)
  → soul の言及ゼロ（grep -i soul = none）で裏取り。唯一の赤は既知の physiology barrel（S1 無関係・別タスク化済み）。新規赤ゼロ。
```

### 保護パス不変（git）

```
git status --porcelain pnpm-lock.yaml apps/runtime-player/ apps/soul/reference-driver/  → (空出力 = 変更なし)
git diff --stat pnpm-lock.yaml  → (空出力 = 変更なし)
apps/soul/agent/ は untracked（?? apps/soul/agent/）
```

pnpm-lock.yaml・器コード（runtime-player）・C4 契約 fixture・参照ドライバ すべて diff ゼロ。作業は `apps/soul/agent/` 内に閉じている。

### undici WebSocket 定数の実地確認（本番未検証パス調査・接続なし）

```
typeof WebSocket: function
static OPEN/CLOSING/CLOSED: 1 2 3
proto instance OPEN/CLOSING/CLOSED: 1 2 3
proto has OPEN own? [ 'CONNECTING', 'OPEN', 'CLOSING', 'CLOSED' ]
```

`globalThis.WebSocket`（undici）は **static も instance（prototype）も** OPEN=1/CLOSING=2/CLOSED=3 を公開する（接続せずプロトタイプ検査のみで確認）。詳細は design レーン参照。

---

## spec レーン（契約整合・写経正確性）: PASS

### channel-client の写経正確性（reference-driver connect/sendSpeech と突合）

| 項目 | reference-driver | channel-client | 判定 |
| --- | --- | --- | --- |
| hello 4 秒待ち | HELLO_TIMEOUT_MS=4000 | helloTimeoutMs 既定 4000（`channel-client.mjs:24,48,112`） | ✓ 一致 |
| supportedKinds 照合 | expectedKinds（3 種）全部 | requiredKinds 既定 **`["intent.speech"]` のみ**（`:47,114-121`） | ✓ 意図的狭化（下記） |
| replyTo 相関 | pending Map・rttMs | 同一ロジック（`:79-92,129-138`） | ✓ 一致 |
| 未知イベント黙殺 | 非 JSON / replyTo 不一致 / その他 kind | 同一 3 分岐（`:63-97`） | ✓ 一致 |
| token redact | redactToken | 同一実装（`:192-202`） | ✓ 一致 |
| close 作法 | `WebSocket.CLOSED/CLOSING`（global 静的） | `WebSocketImpl.CLOSED/CLOSING`（注入クラス静的・`:147-148`） | ✓ 等価（パラメタ化） |
| sendSpeech payload | `{v:1,id,kind:"intent.speech",payload:{timeline}}` | 同一形（`:136`） | ✓ 契約 speechPath と一致 |

- **supportedKinds を `intent.speech` のみ必須にした狭化は spec 上正しい**。hello は 3 kind を広告するが、発話特化クライアントは intent.speech さえあれば送出でき、intent.set/envelope の有無に依存しない。より緩い（＝より頑健な）要求で、契約の additive 精神とも整合。`requiredKinds` で拡張可能。
- **1 点の写経差異（waitForOpen の OPEN 参照）**: reference-driver は `socket.readyState === WebSocket.OPEN`（global 静的）だが、channel-client は `socket.readyState === socket.OPEN`（**instance**・`:162`）。design レーンで本番影響を検証（結論: 無害）。

### ws-double の返答形（契約 examples に忠実か）

- `server.hello`: `{v:1,kind:"server.hello",payload:{protocol:1,supportedKinds:[intent.set,intent.envelope,intent.speech]}}`（`ws-double.mjs:83-91`）= happyPath hello と一致。✓
- accepted: `{v:1,replyTo:id,result:"accepted"}`（`:146-148`）= 契約と一致。✓
- rejected: `{v:1,replyTo:id,result:"rejected",error:{code,message}}`（`:149-156`）= rejections 形と一致。✓
- 未知 kind は unknownKind で拒否・接続維持（`:159-172`）= 契約 §3.5・rejections[unknownKind] と一致。✓

### speak の同期（wave 計画 §3 Domain B どおりか）

- accepted → **即** play（`speak.mjs:97-106`。accepted 判定直後に `player.play(wavPath)`）✓
- rejected は throw・**接続は閉じない**（`:97-105`。close 呼び出しなし）✓（speak.test「closeCalled=false」で裏取り）
- 512 超は buildSpeechTimeline の throw を送出前に伝播（`:82-88` が `:94` の sendSpeech より前）✓（speak.test「sent=false」で裏取り）
- temp 書き出しは送出前（`:91` < `:94`）＝ accepted→play 最速化。§3「送出前に済ませる」と一致。✓

### tts-client の API 形（事実台帳 §3 と整合か）

- `POST /audio_query?text=&speaker=` → JSON、`POST /synthesis?speaker=`（body=query）→ Uint8Array（`tts-client.mjs:120-165`）= §2/§3 と一致。✓
- 既定 speaker `888753760`・baseUrl `http://127.0.0.1:10101`（`:25-27`）= §3 実測値。✓
- moras 平坦化の pause_mora 扱い: 非 null なら当該フレーズ末尾に加える両対応（`:60-66`）。実機は null（§3）。✓
- 句読点は moras 内に `vowel:"pau"`（§3）→ flattenMoras はそのまま通し buildSpeechTimeline が脱落させる。✓ 実機 preflight で vowel 並びが `o,N,i,i,a,pau,...` と出ることを確認。

---

## design レーン（設計・境界）: PASS

### 依存ゼロ・特区規律・lockfile 不変

- import は自 zone 内相対 `.mjs` + node 組み込み（`node:test/assert/perf_hooks/http/net/crypto/child_process/fs/os`）のみ。器コードの相対 import ゼロ（boundary check 1267 files 緑で裏取り）。
- deps 緑・source は既知 physiology 赤のみ（新規ゼロ）・pnpm-lock.yaml diff 空。install は独立サブパッケージ（`apps/soul/agent/package-lock.json`）内で完結し workspace glob 対象外＝pnpm-lock 不変を実証。**wave 計画 §4-1/§4-2 合格**。

### 特別依頼（Undine 裁定 2）: 本番コードに検証されないパスが残っていないか — **調査結果: blocking 該当なし**

本番既定は `globalThis.WebSocket`（undici）無改変、テストは最小 WS クライアント（MinimalWebSocket）注入。両者の差が本番だけを通る未検証分岐を生まないかを、channel-client が socket に対して使う API 面を列挙して検証した。

**channel-client が socket に触れる全 API と、undici（本番）/ MinimalWebSocket（テスト）双方での成立**:

| API 面（channel-client 使用箇所） | undici 本番 | MinimalWebSocket テスト | C6 実器実証（ref-driver） |
| --- | --- | --- | --- |
| `new WebSocketImpl(url)` | ✓ | ✓ | ✓ |
| `addEventListener("message"/"close"/"error"/"open",{once})` | ✓ | ✓ | ✓ |
| `event.data`（text→string で `String(event.data)`） | ✓ | ✓（`{data:string}`） | ✓（`:727`） |
| `socket.send(string)` | ✓ | ✓ | ✓ |
| `socket.readyState` | ✓ | ✓ | ✓ |
| static `WebSocketImpl.CLOSED/CLOSING`（close 内） | ✓ (2/3) | ✓ (2/3) | ✓（global 静的で等価） |
| **instance `socket.OPEN`（waitForOpen 内）** | ✓ (=1) ← 実地確認 | ✓ | ✗（ref-driver は **global** 静的を使用） |

- **唯一 C6 実証パターンと分岐するのは `socket.OPEN`（instance）参照**（`channel-client.mjs:162`）。参照ドライバは `WebSocket.OPEN`（global）を使っていたため、instance 経由は C6 人間ゲートで踏まれていない「本番だけの経路」に見える。→ 接続せず undici のプロトタイプを検査し、`WebSocket.prototype.OPEN === 1`（instance 定数を公開）を確認した（上記生出力）。**undici で正しく 1 を返す**。
- **さらに二重に無害**: waitForOpen の早期 return（`readyState === socket.OPEN`）は `connectChannel` が `new WebSocketImpl(url)` 直後に同期呼び出しするため、初回接続時の readyState は必ず `CONNECTING(0)` で早期 return は成立せず、必ず open リスナ経路を通る。仮に `socket.OPEN` が undefined でも `0 === undefined` は false でリスナ経路に落ちる（number と undefined は不一致）。つまりこの分岐の当否は本番動作の正誤に影響しない。
- **hello / open の順序**: message リスナは `connectChannel` 冒頭（await 前）に登録済み。undici は open→message の順で発火し、hello を取りこぼさない。MinimalWebSocket は同一 TCP チャンク内で open dispatch 直後に hello フレームを処理する（`ws-client.mjs:139-158`）ため、この順序も実配線で踏まれている。✓
- **readyState 定数の参照先の違い**（close=static / waitForOpen=instance の不統一）は上記のとおり値は同一（W3C 定数）で挙動差なし。**cosmetic な非一貫性**として非 blocking note に記す。

**結論**: channel-client が依存する本番 API 面は、(a) undici に実在し（`socket.OPEN` を実地確認）、(b) その大半は MinimalWebSocket 実配線と C6 実器実証の両方で踏まれている。undici↔実器の**ワイヤ疎通そのもの**（実 hello の中身・フレーミング）は機械テストの検証対象外で、人間ゲート preflight-e2e に委ねる設計であり、かつ同一 API パターンで C6 実証済み。**本番だけを通る未検証の分岐（＝挙動が分かれる隠れ経路）は存在しない**。

### audio-player の常駐設計

- spawn 1 回（`createAudioPlayer` で 1 プロセス・`audio-player.mjs:91-93`）、stdin へ WAV パス 1 行指示（`:120`）、PlaySync で同期再生、`play` は非ブロッキング（stdin.write のみ）。§3 Domain B・事実台帳 §5（spawn≈155ms をループ外へ）と一致。✓
- dispose: stdin.end→kill（`:123-136`）。dispose 後 play は throw（`:110-112`）。改行除去で 1 行プロトコル保護（`:116`）。✓
- **機械テスト無音の徹底**: 既定 command/args を注入点化し、テストは無音 echo-player（stdout に `played:<path>` を返すだけ・`echo-player.mjs`）を注入。スピーカー再生は preflight-e2e（人間ゲート）のみ。✓

### preflight-e2e が人間ゲート手順として成立しているか

- 実行者・手順（AivisSpeech 起動 → runtime-player → Channel URL 手渡し → `node preflight-e2e.mjs <url>`）を冒頭コメントに明記。accepted→実再生、末尾に「一目一聴: 声が鳴り、器の口が同期して動けば合格」を印字（`preflight-e2e.mjs:89-93`）。✓
- **`--dry-run` の安全性**: URL 不要・`runDryRun` は TTS→timeline 構築までで **channel 接続も再生も一切しない**（`:47-64`。connectChannel も createAudioPlayer も呼ばない）。Gnome が誤って実再生・実器接続する経路を持たない安全な入口。✓
- 私（Review-Sylph）は規律により preflight-e2e を実行していない（--dry-run 含め、実機再生・実器接続を避ける）。

---

## test レーン（fixture 十分性）: PASS-with-notes

自分で `node --test` 62/62 緑を実行確認。テスト 28 本（+ Domain A 補強 2）を読み網羅を確認。**必須カバレッジは概ね充足**、下記に非 blocking の漏れを列挙。

**充足を確認した必須項目**:
- channel-client: hello 不着タイムアウト（`channel-client.test.mjs:82`）✓ / supportedKinds 欠落 throw（`:67`）✓ / rejected + 接続維持で 2 通目（`:44`）✓ / 16bit length 経路（200 モーラ big timeline・`:95`）✓
- speak: rejected throw・play 呼ばれず・close されず（`speak.test.mjs:112`）✓ / 512 超伝播・送出前 throw（`:148`）✓ / 実 WS ダブル + 実 channel-client で accepted→play（`:185`）✓
- ws-double フレームコデック: クライアント encode 16bit（MinimalWebSocket）× サーバ decode 16bit を big timeline で実配線 ✓
- audio-player: dispose（`audio-player.test.mjs:96`）✓ / 多重 play 3 連（`:53`）✓ / 改行除去（`:76`）✓ / dispose 後 play throw ✓ / 空文字 TypeError ✓
- tts-client: audio_query URL/method/encode（`:107`）✓ / synthesis Uint8Array + body（`:148`）✓ / 非 200 throw 両系（`:170,183`）✓ / flattenMoras GOLDEN 一致・pause_mora 非 null・構造不正（`:47-86`）✓
- Domain A 補強 2 ケース: 512 + 極小 body で 1ms 押し出し 512 連鎖（`mora-timeline.test.mjs:228`）/ 脱落先頭で第一出力が非ゼロ raw（`:248`）。Domain A レビュー note 1/2 を正しく回収。純関数本体 mora-timeline.mjs は不変を確認。✓

---

## 指摘一覧

### blocking

**なし。**

### non-blocking（notes）

1. **[test] 未知イベント黙殺 / `consumeUnknownEventCount` が Domain B のテストで未検証**。channel-client の 3 分岐（非 JSON・replyTo 不一致・その他 kind の黙殺）と `consumeUnknownEventCount` を発火・検証するテストが無い（`channel-client.mjs:63-97,139-143`）。写経元 ref-driver は C6 実証済みで論理は同一だが、魂側コピーとして独立の assert が無い。ws-double から未知イベント（未知 kind のサーバ発イベント等）を送って黙殺と計数を 1 ケース確認すると安心。
2. **[test] 切断時の pending reject が未検証**。サーバが sendSpeech 応答前に接続を落とすと pending が closedError で reject される経路（`channel-client.mjs:100-106`）が直接テストされていない。ws-double を応答前に `close()` するケースで sendSpeech の reject を 1 本固定すると、切断堅牢性の回帰網になる。
3. **[test] speak の TTS 失敗伝播が未検証**。tts-client 単体では非 200 throw を検証済みだが、speak 経由（audioQuery/synthesis の throw が speak を貫通して伝播）は未固定。論理上は素の await 伝播で自明・非 blocking。
4. **[test] 64bit(127) length 経路とサーバ側 encode の 16bit 経路は未踏**。>65535 byte フレーム（127 分岐）はテストで到達不能、ws-double の encodeFrame 126 分岐（サーバが 126 byte 超を送る）も accepted 応答が小さいため未踏。両者ともコメントで「テストで来ない」と明記済み・S1 スコープで妥当。
5. **[test] redactToken の no-token / unparseable 分岐が未検証**（`channel-client.mjs:195-201` の catch と searchParams 非該当）。トリビアル・非 blocking。
6. **[design] 一時 WAV の非クリーンアップ**。`writeTempWav` は dir 未指定で毎回 `mkdtempSync`（`audio-player.mjs:65`）＝発話ごとに新規 temp ディレクトリ + WAV を OS temp に残す。さらに speak は sendSpeech の**前**に WAV を書く（`speak.mjs:91`）ため、rejected 時も孤児 WAV が残る。S1（一文・OS temp）では実害軽微だが、常駐長時間運用（Domain C 以降）で堆積し得る。将来のクリーンアップ方針の余地として記録。
7. **[design] readyState 定数参照の非一貫性（cosmetic）**。close は static `WebSocketImpl.CLOSED/CLOSING`、waitForOpen は instance `socket.OPEN` と参照先が不統一（`channel-client.mjs:147-148,162`）。値は W3C 定数で同一・挙動差なし（特別依頼調査で確認）。どちらかに揃えると読みやすい。

---

## 特別依頼（本番未検証パス）調査結果 — 要約

**blocking 該当なし。** 本番既定（undici）とテスト（MinimalWebSocket 注入）の差が「本番だけを通る未検証の隠れ分岐」を生んでいないことを、channel-client の socket API 面を全列挙して確認した。C6 実器実証パターンと分岐する唯一の点は waitForOpen の instance `socket.OPEN` 参照だが、(1) undici が instance 定数 OPEN=1 を公開することを接続なしで実地確認、(2) 初回接続時は readyState=CONNECTING で当該早期 return は成立せず、値が undefined でも number との不一致でリスナ経路に安全に落ちるため本番動作の正誤に影響しない。undici↔実器のワイヤ疎通そのものは設計どおり人間ゲート preflight-e2e に委ね、同一 API パターンで C6 実証済み。

---

## 狭い修正（Undine 裁定 3 の実施）

- 対象: `apps/soul/agent/src/fixtures.mjs` の `GOLDEN_KONNICHIWA_WAV_DURATION_SEC = 1.5468` の注記。
- 変更: **コメント/注記のみ**。値 `1.5468` と golden 入力（GOLDEN_MORAS_KONNICHIWA のモーラ列・数値）は不変。注記に「実測一例であり合成尺は実行毎に変動（ライブ実測で 2.1389s / 2.1156s / 2.1272s も観測・同テキスト同話者）」「写像パイプラインは常に WAV 実長追従で組む・秒数ハードコード禁止」「この定数はネットワーク非依存の固定テスト土台であってライブ合成尺の予測値ではない・乖離は裁定 3 の事実」を追記。
- 修正後 `node --test`: **62/62 pass / 0 fail / exit 0**（上記生出力）。golden 出力テスト（GOLDEN_TIMELINE 全 9 要素）も緑を維持。

---

## 結論

Domain B（TTS クライアント + 常駐再生 + チャネル送出 + 同期）は wave 計画 §3 Domain B・§4 blocking 基準・契約（speechPath/hello/rejections/payload schema）・写経元 reference-driver・事実台帳 §1/§2/§3/§5 を満たす。**blocking 指摘ゼロ**。新規赤なし・lockfile/器コード/契約不変・依存ゼロ/特区規律・機械テスト無音・本番未検証パスなし をすべて自分の実行で実証。狭い修正（裁定 3 の注記更新）実施後も 62/62 緑。

**残る choke point は人間ゲート**（`preflight-e2e.mjs` による実器フル疎通 + 実再生。ユーザー/Undine が AivisSpeech + runtime-player 起動 + URL 手渡しの上で実行）。ここで初めて「配線の存在」が「疎通」に昇格する（Gnome 報告 §5-1・裁定 1）。機械ゲートとしての Domain B は **PASS**。

## notes への裁定（Orch-Sylph 記録・Undine 裁定 2026-07-12）

- **note 1・2（未知イベント黙殺・切断時 pending reject の独立テスト）**: **Domain C のスコープに小さく含めて回収**する（channel-client の写経コピーは S2 以降も使う土台のため、独立 assert をここで固める。Domain C の工数を有意に膨らませる場合は follow-up 記録へ送る——判断は Orch-Sylph）。
- **note 6（一時 WAV の堆積）**: S1 では **follow-up 記録（[../../waves/s1/s1-followup.md](../../waves/s1/s1-followup.md)）で足りる**（長時間運用は S6 の領分）。
- note 3・4・5・7（speak の TTS 失敗伝播・未踏フレーム長経路・redactToken 分岐・readyState 参照の非一貫性）: トリビアル/スコープ妥当のため follow-up 記録に列挙して持ち越し。

> **Domain B 閉鎖（Orch-Sylph 2026-07-12）**: 実装（Gnome）・レビュー 3 レーン PASS（blocking ゼロ）・特別依頼調査（本番未検証パスなし）・狭い修正（fixtures.mjs 注記=裁定 3）をすべて裏取り済み。Orch 自身の再実行: node --test 62/62 / preflight-tts 実機 PASS（尺 2.1156s=変動の再裏付け）/ soul-zone 緑 1267 / deps 緑 / source 新規赤ゼロ / 保護パス diff 空。人間ゲート（preflight-e2e）は wave 完了後の一目一聴に委ねる。次は Domain C。
