# S2 Domain B レビュー: whisper-server クライアント + 転写バッファ + ライフサイクル

> Reviewer: Review-Sylph（3レーン: spec / design / test）。2026-07-12。
> 対象実装: `apps/soul/agent/` の新規 7 ファイル（src/{whisper-server,whisper-client,transcript-buffer}.mjs + 3 テスト + scripts/preflight-asr.mjs）+ 記録訂正 1 件（waves/s2/domain-a.md の per-file 内訳 13/14）。
> Gnome 実装報告: [../../waves/s2/domain-b.md](../../waves/s2/domain-b.md)。
> 判定基準: wave 計画 [../../orchestration/s2-wave-plan.md](../../orchestration/s2-wave-plan.md) §2/§3 Domain B/§4 ・ 事実台帳 [../../orchestration/s2-planning-inventory.md](../../orchestration/s2-planning-inventory.md) §1 ・ アーキ上位 [../../../architecture/conversation-pipeline-direction.md](../../../architecture/conversation-pipeline-direction.md) §2.7（転写バッファが正）・ 前工程 [domain-a-review.md](domain-a-review.md) note 1 / [../../waves/s2/domain-a.md](../../waves/s2/domain-a.md) §4（speechEnd 契約）・ S1 流儀 `audio-player.mjs` / `tts-client.mjs` / `ffmpeg-capture.mjs`。

## 総合判定: **PASS-with-notes**

3 レーンすべて合格。**blocking 指摘ゼロ**。non-blocking の注記が数点（whisper-client のタイムアウトが本文読み取りを覆わない・onExit 正経路の未テスト・転写バッファ listener 例外の伝播契約——いずれも Domain C / S3 結線時に回収可能）。

preflight-asr は**レビュー側で独立再実行して PASS**（synthetic 経路・exit 0・終了後の孤児プロセスなし）。レイテンシは Gnome 報告と整合（warm ≈6.8s @8T vs 報告 ≈6.6s）。レイテンシ絶対値は Undine 裁定どおり Domain B の blocking ではない（計測手段の提供までが職掌——提供されている）。

| レーン | 判定 |
| --- | --- |
| spec（契約整合） | **PASS** |
| design（設計・境界） | **PASS-with-notes** |
| test（fixture 十分性） | **PASS-with-notes** |

---

## 検証（自分で実行した生出力）

### 1. `cd apps/soul/agent && timeout 180 node --test`

```
1..160
# tests 160
# suites 0
# pass 160
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 930.5172
TEST_EXIT=0
```

160/160 緑・cancelled 0・1 秒未満で正常終了（ハングなし）。新規 3 ファイルの per-file 実数（各ファイル単独実行の `^ok ` 計数）:

```
whisper-server: 10
whisper-client: 10
transcript-buffer: 11
```

新規合計 31。160 − 31 = 129 = S1 84 + Domain A 45 の baseline 無退行。**Gnome 報告の内訳（10/10/11）と完全一致**。

### 2. モノレポ 3 チェック（リポジトリルート・各 timeout 120s・実 exit code）

```
Soul zone boundary guard passed: 1292 source files scanned; no 器→魂 imports and no 魂→器 code imports.
soul-zone EXIT=0
Dependency guard passed.
deps EXIT=0
Source organization violations found:
- apps/runtime-player/src/main/physiology/index.ts: index.ts must remain a barrel-only entrypoint
source EXIT=1
```

- soul-zone 1292 = Domain A レビュー時 1285 + 新規 7 ファイル。整合。
- source の赤 1 件は既知 baseline（器側・S1 followup §7）。魂由来の新規赤ゼロ = 無退行。

### 3. 保護対象 diff（生出力）

```
$ git diff --stat pnpm-lock.yaml apps/runtime-player/src/main/control-channel/contract/
（空 = 不変）
$ git diff --name-only apps/soul/agent/src/
（空 = S1 の tracked ソース不変）
$ git diff apps/soul/agent/package.json
-    "@anthropic-ai/claude-agent-sdk": "0.3.207"
+    "@anthropic-ai/claude-agent-sdk": "0.3.207",
+    "onnxruntime-node": "1.27.0"
```

- package.json 差分は **Domain A（choke point 1）時点の 1 行のみ = Domain B での依存追加ゼロ**。multipart は Node 組み込み FormData/Blob（whisper-client.mjs:97-100 で確認・import 文なし）——報告の「新規 npm 依存ゼロ」は正確。
- 補記: Domain A の .mjs は untracked（`??`）のため `git diff` はそれらの不変を直接証明しない。代わりに (a) baseline 129 テスト無退行、(b) ffmpeg-capture.mjs の該当行（unref 再起動タイマ :165-167 / dispose :185-208）が Domain A レビュー時の引用と一致、で不変を裏取りした。

### 4. preflight-asr 独立再実行（実機・synthetic 経路・timeout 300s）

```
$ node scripts/preflight-asr.mjs --synthetic --threads 8
[preflight-asr] WAV source = synthetic: 合成 WAV（無音 300ms + 440Hz 正弦波 800ms + 無音 300ms・16kHz mono）
[preflight-asr] WAV: 44844 bytes, 1.400s
[preflight-asr] whisper-server spawning: baseUrl=http://127.0.0.1:8178
[preflight-asr] server READY in 556ms (HTTP responding = model loaded & listening)
[preflight-asr] inference #1 (cold): 7034ms  text="ピー"
[preflight-asr] inference #2 (warm): 6782ms  text="B."
[preflight-asr] LATENCY: utterance 1400ms → transcript in cold=7034ms / warm=6782ms
[preflight-asr] transcript buffer: appended=true reason=appended stats={"appended":1,"discarded":0}
[preflight-asr]   buffer[0] 0..1400ms "ピー"
[preflight-asr] RESULT: PASS (synthetic WAV; server ready 556ms; /inference round-trip OK; response structure {text} OK; buffer append OK)
[preflight-asr] server disposed (kill → stdio destroy → unref)
PREFLIGHT_EXIT=0
```

- Gnome 報告 §5.3（cold 6589 / warm 6619 @8T）と整合（本再実行は +3〜6%・同帯域）。**ヘルスチェック「任意 HTTP 応答 = ready」の実機妥当性も経験的に確認**（ready 556ms 直後の /inference が 200 で成立 = listen 時点でモデルロード済み）。
- 実マイク不使用・ディスク不書き出し（preflight-asr.mjs は `node:fs` を一切 import しない——コード読解で確認）。

### 5. 孤児プロセス確認（preflight 後）

```
$ tasklist | grep -i whisper
（空）GREP_EXIT=1 (1 = no orphan)
```

### 6. フレーク再現性の抜き取り（unref レース修正の独立確認）

レースの震源だった whisper-server.test.mjs を単独 ×5:

```
run1〜run5: # pass 10 / # cancelled 0（5/5）
```

### 7. vendor 非コミット・録音物ゼロ

```
$ git status --porcelain apps/soul/agent/vendor
（空 = ignore 済み）
$ git status --porcelain | grep -iE '\.(wav|pcm|raw|mp3|ogg)'
（空 = 音声ファイルの新規生成物なし）
```

### 8. 記録訂正の確認

waves/s2/domain-a.md の per-file 内訳は **pcm-framing 13 / speech-segmenter 14 に訂正済み**（:29-30・:106 に訂正の出所として domain-a-review 検証 1・note 2 を明記）。note 2 は回収完了。

---

## spec レーン（契約整合）: PASS

wave 計画 §3 Domain B の 3 要求すべて充足:

1. **whisper-server 子プロセス管理**: `createWhisperServer`。モデルパス（options → env `WHISPER_MODEL_PATH` → vendor 既定・whisper-server.mjs:80-82）/ ポート（既定 8178・衝突回避の理由付き・:57-58）/ 起動ヘルスチェック（HTTP 応答ポーリング `ready` Promise・:231-262）/ 終了処理（dispose = kill → stdio destroy → unref・冪等・:276-295 = S1 クリーンシャットダウン教訓の型）。**合致**。
2. **/inference クライアント + タイムスタンプ付与 → 転写バッファ**: `createWhisperClient().transcribe`（multipart POST・事実台帳 §1 の発話単位 WAV 契約どおり）+ `createTranscriptBuffer`。タイムスタンプは append 入力の `{startMs, endMs}`（VAD speechEnd 由来・Domain C が渡す）+ バッファ側付与の `appendedAtMs`。speechEnd→transcribe→append の結線自体は Domain C の職掌（wave 計画 §3 Domain C「常時稼働の結線」）で、Domain B は消費形の部品と実機実証（preflight の 4 段合成）を提供——**分担として正しい**。**合致**。
3. **preflight-asr**: 実機疎通（配線 ≠ 疎通）。レビュー側の独立再実行で PASS（検証 4・5）。**合致**。

**転写バッファのアーキ §2.7「正本」要件の突合**:

| 要件 | 判定 | 根拠 |
| --- | --- | --- |
| append-only・外部から書き換え不能 | 合格 | 公開 API に削除/上書き/clear なし + 全エントリ `Object.freeze` + 読み取りは防御的コピー（transcript-buffer.mjs:112-128）。テストで API 不在・frozen・コピー独立まで assert |
| `{startMs, endMs, text}` の列 | 合格 | + `seq`（単調連番）+ `appendedAtMs`（実時間軸）。ストリーム時刻と実時間の両軸を持つのは S3「直近の話を全部読む」の注入判断に適合 |
| S3 が読む API | 合格 | `all()` / `last(n)` / `inRange({fromMs,toMs})`（重なり判定・境界含む）/ `onAppend`（発火判定の入口）/ `stats()`。発火時の転写注入（§2.7）に必要な形が揃う |
| VAD イベント購読（S6/S9）との分業 | 合格 | バッファは転写のみを持ち、VAD 3 イベント（speechStart/End/Cancel）はセグメンタの onEvent に残る。domain-a.md §4 の分業表と無矛盾 |

- **speechEnd 契約との継ぎ目**: speechEnd payload `{tMs, startMs, endMs, durationMs, reason}` ⊇ append 入力 `{startMs, endMs}`。endMs < startMs は throw だが speechEnd は構造上 endMs ≥ startMs を保証するため衝突しない。domain-a-review note 1（endMs の実在範囲超え）についてもバッファは「endMs をそのまま信じる」（clamp は切り出し側の責務）と明示しており、時刻の意味論が二重に加工されない。**継ぎ目 OK**。
- **空転写破棄 + onDiscard の設計判断**: 妥当。正本 = 「内容のある発話の列」の意味論は S3 の消費形として素直で、破棄情報は onDiscard + stats().discarded で失われない（無音幻聴頻度 = VAD 閾値調整の診断材料）。「ユーザーが何か言ったが聞き取れなかった」の検出は VAD イベント側で可能なため情報損失なし。判定は `isBlankTranscript` 純関数に閉じ、記号 1 文字を通す境界（S3 の領分を侵さない)もテストで固定。

**blocking 基準 §4 の突合**:

| 基準 | 判定 | 根拠 |
| --- | --- | --- |
| (1) pnpm-lock/器/契約/S1 実装不変・S1 無退行 | 合格 | 検証 1・3（diff 空・160 = 129 + 31） |
| (2) 3 チェック無退行 + 非コミット | 合格 | 検証 2・7（source の赤は既知 baseline のみ・vendor porcelain 空） |
| (3) 純関数 + fixture テスト | 合格 | buildWhisperServerArgs / resolve×2 / parseInferenceResponse / normalizeTranscript / isBlankTranscript すべて純関数 + テスト |
| (4) 録音データ非残置 | 合格 | preflight-asr は `node:fs` 不使用（音声は TTS 合成 or 正弦波・メモリ上のみ）。検証 7 で音声ファイルの新規生成物ゼロ |
| (5) 子プロセス終了処理の明示設計 | 合格 | dispose の型 + ポーリング中/ready 後 dispose のテスト + preflight finally dispose + 検証 5（孤児ゼロ） |

---

## design レーン（設計・境界）: PASS-with-notes

- **S1 流儀との整合**: fetchImpl 注入（tts-client.mjs:110 と同型）・spawnImpl/setTimeoutImpl/nowImpl 注入・依存ゼロ lineReader（audio-player と同型）・dispose = kill → stdio destroy → unref（audio-player / ffmpeg-capture と同一の窓塞ぎ）・純関数切り出し（spawn せずに引数組み立てをテスト可能）。**手本に忠実**。
- **ヘルスチェック設計**: 「任意 HTTP 応答（404 含む）= ready」は whisper-server が モデルロード後に listen する事実（--help 実機取得 + preflight 実証・検証 4）に立脚し妥当。/inference 空打ちの「深い」チェック不採用（1 回 6 秒超）も正しい。打ち切り 3 経路（disposed / exited / deadline）は毎イテレーション判定され有界（whisper-server.mjs:237-257)。spawn `error` イベントも exited 扱いで打ち切りに繋がる（:213-221）。`ready.catch(() => {})`（:264）で await しない経路の unhandled rejection も塞がれている。**合格**。
- **unref タイマレース修正の線引き**: **正当**。(a) whisper-client のタイムアウトタイマは ref のまま + finally で必ず clear（whisper-client.mjs:106-125)——リクエスト待機中に loop を保持し、決着後は残留しない。(b) whisper-server のポーリングは ref のまま + readyTimeoutMs/dispose/exited で有界決着（:229-262）。(c) ffmpeg-capture の再起動タイマ unref（:165-167）は「pending Promise を決着させる責務を持たない背景タイマ + dispose で clear」なので観測されたレース（pending Promise が loop 干上がりで未決着）の型に該当しない——**現状のままが正しく、波及変更なしも正しい**。Gnome の教訓定式化「待機中は ref + 有界決着・畳んだ後/背景は unref」に同意。
- **abort 経路**: AbortController + signal 配線 + abort 理由（タイムアウト Error）の優先伝播（whisper-client.mjs:117-122）は正しい。fetch reject 時の finally clear も正しい。→ ただし note 1（本文読み取りがタイムアウト外）。
- **再起動耐性の不採用**: **妥当**。wave 計画 §3 Domain B の要求語彙（モデルパス・ポート・ヘルスチェック・終了処理）に再起動はない（Domain A の ffmpeg には明示されていたのと対照的）。ASR サーバの死は結線層が `onExit` で観測して方針判断すべきという論拠も、入り口デバイス（死にやすい ffmpeg）と常駐推論サーバの性質差として筋が通る。`onExit` は提供済み。→ ただし note 2（spawn error は onExit に乗らない）・note 3（onExit 正経路の未テスト）。
- **転写バッファの防御的コピー / freeze / listener**: 主張どおり実装されている（frozen エントリ・all()/last()/inRange() は slice/filter の新配列・discard info も frozen）。listener 例外時もエントリは push 済みのため**バッファ本体（正本）は壊れない**。→ ただし例外は append 呼び出し元へ伝播し残り listener がスキップされる（note 4）。
- **境界**: 新規 3 .mjs + preflight の import は node:* + 自 zone 相対のみ（コード読解 + soul-zone guard 1292 files 緑・検証 2）。魂 zone 外への書き込みゼロ（preflight は fs 不使用）。新規 npm 依存ゼロ（検証 3）。host 既定 127.0.0.1 束縛（外に開かない）。**合格**。

---

## test レーン（fixture 十分性）: PASS-with-notes

31 テストを全読して突合:

- **whisper-server (10)**: 純関数 4（引数組み立て・既定値・上書き・throw 4 種・パス解決 3 段）+ ライフサイクル 6。ヘルスチェック状態遷移が 4 方向とも固定: 接続拒否 N 回→応答で ready / 早期死で reject（exit code 込み）/ 注入時計で deadline reject / ポーリング中 dispose で reject。dispose は冪等性・子の reap（孤児なし）・「dispose 起因の exit は onExit に来ない」まで assert。**spawn は `process.execPath` + fake-ffmpeg.mjs のダミー子プロセスのみ = 実 whisper-server.exe はテストから一切起動されない**（args 丸ごと注入で確認）。全 await が `withTimeout` で包まれ dispose は finally——**テスト自身がハング安全**。
- **whisper-client (10)**: パース fixture（前方互換・構造不正 5 種）・トリム境界（本文中の空白保存）・**multipart の中身検証**（URL 正規化・POST・signal 配線・file のバイト列 deep-equal・filename/type・temperature="0"・response_format="json"・text/rawText の対）・非 200 本文込み throw・接続拒否伝播・**タイムアウト abort 経路**（abort reason で reject する実 fetch 模倣スタブ・timeoutMs=5 で有界）・入力検証で fetch 不着・構築時 throw。**契約の境界が固定されている**。
- **transcript-buffer (11)**: **append-only API 不在 assert**（clear/remove undefined）・frozen 書き換え throw・防御的コピー独立性・seq 単調（破棄は seq 不消費）・blank 破棄 + stats・last 境界（0/過大/負/非整数）・inRange 境界（endMs==fromMs 含む・片側省略・不正範囲 throw）・onAppend/onDiscard の購読解除・不正入力 throw 網羅（失敗 append が何も残さないことまで）。**正本の意味論が固定されている**。
- **実機非依存**: 3 ファイルとも実サーバ・実マイク・実ネットワーク不要（fetch スタブ + ダミー子プロセス）。既定 port 8178 はテスト内で bind されない（fake fetch のみ)。
- **フレーク安定性**: 検証 6（単独 ×5・cancelled 0）で Gnome の安定化主張（×15 + 全 ×3）と整合。

**補強候補（non-blocking・下記指摘一覧）**: onExit 正経路（note 3）・onStdout 経路・listener 例外時の挙動固定（note 4）。

---

## 指摘一覧

### blocking

なし。

### non-blocking（notes）

1. **[design] whisper-client のタイムアウトは fetch 完了までしか覆わない** — タイマは finally（whisper-client.mjs:123-125）で clear された後に `response.json()` / `safeReadText()` の本文読み取りが走る（:127-136）。ヘッダだけ返して本文を止めるサーバに当たると transcribe が無期限に pending になる（signal は生きているが abort を発火させるタイマがもう無い）。localhost の whisper-server は完結レスポンスを返すため実害は考えにくいが、Domain C の常駐結線で「1 発話の転写処理全体」に外側の見張りを置くか、タイマ clear を本文読了後へ移すのが堅い。回収先: Domain C。
2. **[design/継ぎ目] spawn 失敗（`error` イベント）は `onExit` に通知されない** — whisper-server.mjs:213-221 は exited を立てて ready を reject させるが、onExit コールバックには乗らない（メッセージは onStderr へ文字列で流れるのみ）。起動時失敗は ready の reject で観測できるため設計として成立しているが、**Domain C が「サーバの死 = onExit」だけで監視を組むと spawn 失敗が漏れる**。結線層は「ready の reject」と「ready 後の onExit」の 2 経路で監視すること。回収先: Domain C 設計注記。
3. **[test] onExit の正経路（ready 後の非 dispose 死 → onExit 発火）が未テスト** — 負経路（dispose 起因は来ない）は固定済みだが、Domain C が再起動/診断判断の入口にする正経路そのものは未 assert。fake child の `--exit` で 1 本足せる。回収先: Domain C（結線テストと同時が自然）。
4. **[design/test] 転写バッファの listener 例外は append 呼び出し元へ伝播し、残り listener がスキップされる** — transcript-buffer.mjs:107-109,120-122 は listener 呼び出しを try/catch しない。エントリは push 済みなので**正本は壊れない**（これは確認済み）が、S3 購読者の throw が ASR 結線側の append を失敗に見せ、他の購読者（CLI 診断等）への配信も止める。「listener は throw しない契約」と明文化するか、結線層で購読者側を try/catch するか、Domain C/S3 で線引きを決めて固定テストを 1 本置くこと。回収先: Domain C/S3。
5. **[design] ヘルスチェック fetch に per-attempt の abort がない** — deadline 判定はイテレーション間のみ（whisper-server.mjs:246-257）。ヘルスチェック fetch 自体が長時間 pending になると ready の決着がその分遅れる。localhost の接続拒否は即時 reject するため実害はまず無い。記録のみ。
6. **[test] lineReader の onStdout 経路が未テスト**（onStderr のみ固定）— 同一実装の共有経路であり実害なし。網羅の補強候補。
7. **[記録] untracked ファイルの「不変」主張の証明力** — Gnome 報告 §1 の「`git diff --name-only apps/soul/agent/src/` 空で Domain A 不変を裏取り」は、Domain A ファイルが untracked のため diff の対象外（証明になるのは S1 tracked 分のみ）。実際の不変は baseline 129 無退行 + 該当行の照合（検証 3 補記）で裏取りできたので結論に影響なし。以後の wave では untracked 期の不変主張はテスト数/内容照合を根拠にすること。

---

## S3/S6/S9/Domain C への引き継ぎ注記の妥当性評価（Gnome 報告 §7）

| 引き継ぎ | 評価 |
| --- | --- |
| §7-1 レイテンシ（warm 6.6〜9.5s・音声長非依存の固定コスト） | **妥当・独立再現済み**（検証 4: warm 6782ms @8T）。Domain C の有界チューニング 3 系統（--audio-ctx / threads / -bo 1）は `buildWhisperServerArgs` の `threads` + `extraArgs`（whisper-server.mjs:109-117）で**コード変更なしに注入可能**——チューニングの受け口は既に提供されている |
| §7-2 再起動耐性は結線層判断 | 妥当（design レーン)。ただし note 2（spawn 失敗は onExit 外）を Domain C 注記に併記すべき |
| §7-3 浅いヘルスチェック | 妥当（実機実証済み） |
| §7-4 空転写破棄 + onDiscard | 妥当（spec レーン） |
| §7-5 endMs clamp は切り出し側の責務 | 妥当。domain-a-review note 1 と一貫し、バッファが時刻を二重加工しないのは正しい |
| §7-6 preflight-vad 資材化 + VAD ラッパ到達テスト → Domain C | 妥当（wave 計画 §3 Domain C に記載済みと一致） |
| §7-7 unref タイマの教訓 | 妥当（design レーンで線引きの正当性を確認・ffmpeg-capture 現状維持も正しい） |

---

## Orch-Sylph への質問

1. **note 3（onExit 正経路テスト）と note 4（listener 例外の契約）の回収先**: どちらも Domain C の結線設計と不可分なため Domain C の blocking ではない設計注記として wave 計画 §3 Domain C に追記することを推奨する（domain-a-review note 1 と同じ扱い）。Orch の裁量でよいか。
2. **転写バッファの無限成長**: append-only の正本は上限なしの in-memory 列（アーキ §2.7 に忠実で、S2 の配信 1 セッション規模ではテキストのみのため実害なし）。永続化・ローテーションは persona/記憶設計の議題として先送りで良いという理解で正しいか（S2/S3 では対応不要と判断している）。
