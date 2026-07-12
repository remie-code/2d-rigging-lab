# S2 Domain B 実装記録: whisper-server クライアント + 転写バッファ + ライフサイクル

> Status: 完了（機械ゲート全合格・preflight-asr 実機 PASS）（2026-07-12, Gnome）。
> スコープ: [../../orchestration/s2-wave-plan.md](../../orchestration/s2-wave-plan.md) §3 Domain B。
> 事実台帳: [../../orchestration/s2-planning-inventory.md](../../orchestration/s2-planning-inventory.md) §1（/inference 発話単位 WAV・ストリーミング WS なし）。
> 前工程: [domain-a.md](domain-a.md)（encodeWav・VAD イベント契約）/ [../../reviews/s2/domain-a-review.md](../../reviews/s2/domain-a-review.md)（note 1: endMs clamp は Domain C 引き継ぎ・note 2: 内訳訂正 → 本 wave 冒頭で domain-a.md を訂正済み）。
> 流儀の手本: `audio-player.mjs`（dispose の型）/ `tts-client.mjs`（fetchImpl 注入）/ `preflight-tts.mjs`（preflight の型）/ s1-followup §8（ハング教訓）。

## 0. 判定サマリ

- **魂の全テスト 160/160 緑**（S1+DomainA baseline 129 無退行 + 新規 31）。安定性ストレス（新規 3 ファイル単独 ×15 + 全スイート ×3）全緑・cancelled 0。
- **preflight-asr 実機 PASS ×3 経路**（TTS 日本語音声 / --threads 8 / --synthetic 正弦波）。**日本語転写の実取得に成功**（AivisSpeech 実機が生きていたため経路 (a)）。全実行後に `tasklist | grep -i whisper` 空 = **孤児プロセスなし**。
- 3 モノレポチェック無退行・保護対象（pnpm-lock / C4 契約 / S1 実装）不変。
- **重要な実装知見 1 件**: `unref()` したタイマだけが event loop に残ると loop が先に干上がり pending Promise が永遠に未決着になるレース（node:test の `cancelledByParent` で顕在化）を踏んで修正した（§6.1）。
- **重要な実測 1 件**: /inference レイテンシは**音声長に依らずほぼ一定**（固定エンコーダコスト支配）。warm でも 4 threads ≈9.5s / 8 threads ≈6.6s。S2 人間ゲート「数秒以内の追従」に対して**チューニング未実施のままでは borderline**（§7 で Domain C へ引き継ぎ）。

## 1. 作成した全ファイル

すべて特区 `apps/soul/agent/` 内（+ 本記録）。S1/Domain A 既存ファイルは 1 行も変えていない（`git diff --name-only apps/soul/agent/src/` 空で裏取り）。例外は wave 指示のスコープ0 = [domain-a.md](domain-a.md) の per-file テスト内訳 2 数字の訂正（レビュー note 2 の実測 13/14 へ）。

| パス | 役割 |
| --- | --- |
| `apps/soul/agent/src/whisper-server.mjs` | whisper-server 常駐ラッパ。`createWhisperServer`（spawn → HTTP ポーリングヘルスチェック `ready` Promise → `dispose`）+ 純関数 `buildWhisperServerArgs` / `resolveWhisperServerPath` / `resolveWhisperModelPath`。 |
| `apps/soul/agent/src/whisper-client.mjs` | `/inference` クライアント。`createWhisperClient().transcribe(wavBytes)`（multipart POST・タイムアウト abort）+ 純関数 `parseInferenceResponse` / `normalizeTranscript`。 |
| `apps/soul/agent/src/transcript-buffer.mjs` | **転写バッファ（正本・S2 の心臓）**。`createTranscriptBuffer`（append-only・防御的コピー・購読）+ 純関数 `isBlankTranscript`。 |
| `apps/soul/agent/src/whisper-server.test.mjs` | node:test **10 ケース**（純関数 4 + ライフサイクル 6。spawn は fake-ffmpeg.mjs 再利用のダミー子プロセス・fetch/タイマ/時計注入で実機非依存）。 |
| `apps/soul/agent/src/whisper-client.test.mjs` | node:test **10 ケース**（パース fixture・multipart 組み立ての中身検証・非200/接続拒否/タイムアウト/構造不正）。 |
| `apps/soul/agent/src/transcript-buffer.test.mjs` | node:test **11 ケース**（append-only 保証・空転写破棄・範囲/直近取得・購読・不正入力）。 |
| `apps/soul/agent/scripts/preflight-asr.mjs` | 実機疎通（実 whisper-server.exe + 実 kotoba モデル起動 → /inference 往復 → バッファ → 確実に畳む）。preflight-tts の型。 |

依存グラフ: すべて `.mjs` + `node:*` + 自 zone 相対 import のみ。**新規 npm 依存ゼロ**（multipart は Node 組み込み FormData/Blob。本環境 Node v22.14.0 で確認）。

## 2. whisper-server ライフサイクル設計

### 2.1 実機事実（`vendor/whisper/whisper-server.exe --help` 実行・2026-07-12）

- 素の既定: host 127.0.0.1 / **port 8080** / inference path `/inference`（`--inference-path` で変更可）/ 言語 `en` / threads 4。
- `-m FNAME` モデル / `-l LANG` 言語 / `-t N` スレッド。VAD オプション群（`--vad` 等）はサーバ側にもあるが**使わない**（区切りは魂のセグメンタの仕事・裁定 1）。

### 2.2 設定可能点と既定

| 項目 | 既定 | 上書き |
| --- | --- | --- |
| serverPath | `vendor/whisper/whisper-server.exe`（agent ルート相対を絶対化） | options → env `WHISPER_SERVER_PATH` |
| modelPath | `vendor/models/ggml-kotoba-whisper-v2.0-q5_0.bin` | options → env `WHISPER_MODEL_PATH` |
| host | 127.0.0.1（localhost 束縛・外に開かない） | options |
| **port** | **8178** | options |
| language | **ja**（kotoba は日本語専用 distil） | options（空文字で `-l` 省略） |
| threads | サーバ既定（4）に任せる | options |
| readyTimeoutMs / pollIntervalMs | 120000 / 250 | options |
| args | buildWhisperServerArgs の出力 | options.args 丸ごと上書き（テスト注入点） |

**ポート既定 8178 の理由**: 素の 8080 は開発ツール一般の定番で衝突しやすい。既存サービス（AivisSpeech 10101・エディタ dev 5173 系）と離れた値を魂の既定とし、options で変更可能にした。

### 2.3 起動ヘルスチェック（`ready` Promise）

- whisper-server は**モデルロード完了後に listen する**ため、「HTTP が応答し始めた = ready」とみなす。`GET /` をポーリングし、**任意のステータス（404 含む）で ready**、接続拒否（fetch reject）は未 ready として継続。
- 打ち切り 3 経路を毎イテレーション判定: (1) `dispose()` 済み → reject、(2) **子プロセスが先に死んだ**（モデルパス不正等の早期失敗。spawn `error` イベントも exited 扱い）→ exit code 込みで reject、(3) readyTimeoutMs 超過 → reject。ready は待たない経路でも unhandled rejection にならないよう no-op catch を添えてある。
- 実測: mmap のおかげでロードは速く、**実機 ready ≈530ms**（512.9MB モデル・OS キャッシュ温）。

### 2.4 終了処理（S1 教訓・blocking 基準 5）

- `dispose()` = **kill → stdio パイプ 3 本 destroy → child.unref()**。冪等。audio-player / ffmpeg-capture と同一の窓塞ぎ（kill 後の未 reap 子・未 destroy パイプが event loop を生かすのを防ぐ）。Windows の `child.kill()` は TerminateProcess で確実（テストで子の reap まで assert・preflight 後の tasklist 空で裏取り）。
- dispose 起因の exit は `onExit` に通知しない（disposed 早期 return・ffmpeg-capture と同型）。
- **stdout/stderr は必ず消費する**: whisper-server はログが多く、パイプ詰まりでサーバ側の書き込みがブロックし得るため、コールバック未指定でも `resume()` で捨て読みする。
- 再起動耐性は**持たせていない**（wave 計画 §3 Domain B の要求外。ffmpeg と違い ASR は落ちたら結線層が判断すべき——§7 引き継ぎ）。

## 3. /inference クライアント契約（実機事実）

- **リクエスト**: `POST {baseUrl}/inference`、multipart/form-data。フィールド:
  - `file`: WAV バイト列（`Blob(type=audio/wav)`・filename `speech.wav`）
  - `temperature`: `"0"`（既定・決定論寄り）
  - `response_format`: `"json"`
- **レスポンス（実機照合済み）**: `{"text": "..."}`。preflight で kotoba 実機が `"こんにちは耳のテストです"` 等を返すことを確認。パースは純関数 `parseInferenceResponse`（text が文字列でなければ TypeError）。
- **後処理**: `normalizeTranscript` = **前後空白トリムのみ**（whisper 出力は先頭スペース・末尾改行の癖がある）。それ以上の正規化は S3 の領分なのでやらない。`transcribe` は `{ text（トリム済み）, rawText（生） }` を返す。
- **エラー伝播**: 非 200 = ステータス + 本文（500 文字まで）込み throw / 接続拒否 = fetch のエラーそのまま / タイムアウト（既定 30000ms）= AbortController で abort し、タイムアウト Error を理由に reject。
- multipart は Node 組み込み FormData/Blob（**依存追加なし**）。fetch が multipart boundary を自動付与する。テストで FormData の中身（file のバイト列一致・フィールド値）まで assert 済み。
- 入力サンプルレート: 実機は 16kHz（preflight (a) は TTS に `outputSamplingRate=16000` を要求して整合）。44.1kHz を投げた場合の挙動は未検証（本線は常に 16kHz なので問題にならない）。

## 4. 転写バッファの契約（正本・S3 が消費する継ぎ目）

上位文書: wave 計画 §2「転写バッファは S3（発火判定）が消費する継ぎ目」・アーキ方向 §2.7「転写バッファが正、SDK セッションは使い捨てキャッシュ」。

### 4.1 エントリの形

```
{ seq, startMs, endMs, text, appendedAtMs }   // Object.freeze 済み
```

- `seq`: append 順の単調増加連番（捨てられた空転写は消費しない）。
- `startMs`/`endMs`: VAD 由来のストリーム時刻（Domain C が speechEnd.{startMs,endMs} を渡す）。
- `appendedAtMs`: 壁時計（nowImpl 注入可・既定 Date.now）。S3 が「最近の発話」をストリーム時刻/実時間どちらの軸でも判断できるよう両方持つ。

### 4.2 API（S3 消費形）

| API | 形 | 用途 |
| --- | --- | --- |
| `append({startMs,endMs,text})` | `{ appended, entry, reason: "appended"\|"blank" }` | Domain C が ASR 結果を積む |
| `all()` | 全件（append 順・配列は防御的コピー） | S3 全文脈 |
| `last(n)` | 直近 n 件 | S3 発火判定の直近文脈 |
| `inRange({fromMs,toMs})` | 時刻範囲に**重なる**エントリ（endMs>=fromMs かつ startMs<=toMs・境界含む・片側省略可） | 時刻範囲の記憶参照 |
| `onAppend(listener)` → unsubscribe | 追加購読 | **S3 発火判定の入口** |
| `onDiscard(listener)` → unsubscribe | 空転写破棄の購読 | 診断（無音幻聴頻度 = VAD 閾値調整材料） |
| `size()` / `stats()` | 件数 / `{appended, discarded}` | CLI 診断表示 |

### 4.3 append-only 保証

- 公開 API に**削除・上書き・clear は存在しない**（テストで API 不在まで assert）。
- 全エントリ frozen・読み取りは配列の防御的コピー。外部から正本を書き換えられない。
- 不正入力（非有限時刻・endMs<startMs・非文字列 text）は throw（呼び出し側のバグを黙殺しない）。

### 4.4 空転写（無音幻聴）の扱い【設計判断】

**積まずに捨てる**。バッファは会話の記憶の正本であり、無内容エントリは S3 のノイズにしかならない。ただし破棄自体は診断情報（VAD 閾値調整の材料）なので `onDiscard` イベント + `stats().discarded` で観測可能。判定は `isBlankTranscript`（trim 後空 = blank。「。」等の記号 1 文字は内容ありとして通す——S3 の領分を侵さない）。

## 5. preflight-asr 実行結果（実機・生出力）

### 5.1 経路 (a): AivisSpeech 実機で日本語合成音声（既定 threads=4）

AivisSpeech（http://127.0.0.1:10101）が**生きていた**ため、日本語 TTS 音声で転写の実取得まで検証できた。音声はメモリ上のみ・ディスク不書き出し（実マイク不使用・録音物ゼロ）。

```
[preflight-asr] WAV source = tts: AivisSpeech 合成音声（実マイクではない・メモリ上のみ）text="こんにちは、耳のテストです"
[preflight-asr] WAV: 81860 bytes, 2.557s
[preflight-asr] whisper-server spawning: baseUrl=http://127.0.0.1:8178
[preflight-asr] server READY in 534ms (HTTP responding = model loaded & listening)
[preflight-asr] inference #1 (cold): 9471ms  text="こんにちは耳のテストです"
[preflight-asr] inference #2 (warm): 9974ms  text="こんにちは耳のテストです"
[preflight-asr] LATENCY: utterance 2557ms → transcript in cold=9471ms / warm=9974ms
[preflight-asr] transcript buffer: appended=true reason=appended stats={"appended":1,"discarded":0}
[preflight-asr]   buffer[0] 0..2557ms "こんにちは耳のテストです"
[preflight-asr] RESULT: PASS (tts WAV; server ready 534ms; /inference round-trip OK; response structure {text} OK; buffer append OK)
[preflight-asr] server disposed (kill → stdio destroy → unref)
PREFLIGHT_EXIT=0
```

### 5.2 経路 (a) + `--threads 8`（論理 16 CPU 機）

```
[preflight-asr] WAV: 82976 bytes, 2.592s
[preflight-asr] server READY in 528ms (HTTP responding = model loaded & listening)
[preflight-asr] inference #1 (cold): 6569ms  text="こんにちは耳のテストです"
[preflight-asr] inference #2 (warm): 6587ms  text="こんにちは耳のテストです"
[preflight-asr] LATENCY: utterance 2592ms → transcript in cold=6569ms / warm=6587ms
[preflight-asr] RESULT: PASS (tts WAV; server ready 528ms; ...)
PREFLIGHT_EXIT=0
```

### 5.3 経路 (b): `--synthetic`（AivisSpeech 非依存のフォールバック疎通・--threads 8）

```
[preflight-asr] WAV source = synthetic: 合成 WAV（無音 300ms + 440Hz 正弦波 800ms + 無音 300ms・16kHz mono）
[preflight-asr] WAV: 44844 bytes, 1.400s
[preflight-asr] server READY in 549ms (HTTP responding = model loaded & listening)
[preflight-asr] inference #1 (cold): 6589ms  text="ピー"
[preflight-asr] inference #2 (warm): 6619ms  text="B."
[preflight-asr] LATENCY: utterance 1400ms → transcript in cold=6589ms / warm=6619ms
[preflight-asr] RESULT: PASS (synthetic WAV; ...)
PREFLIGHT_EXIT=0
```

（正弦波を kotoba が「ピー」と転写するのは幻聴だが、synthetic 経路の PASS 定義は「HTTP 200 + text が文字列」= 疎通のみ。スクリプトのヘッダコメントに定義を明記。）

### 5.4 孤児プロセス確認（全実行後・毎回）

```
$ tasklist | grep -i whisper
（空）GREP_EXIT=1 (1 = no orphan)
```

### 5.5 レイテンシ実測の読み（experiments 素材・Domain C への先行データ）

- **推論時間は音声長にほぼ非依存**（1.4s 音声も 2.6s 音声も同じ ≈6.6s @8T）= whisper の 30s 固定窓エンコーダコストが支配的。cold/warm 差もほぼ無し。
- threads 4→8 で 9.5s→6.6s（約 1.44 倍）。この機は論理 16 CPU（実測）。
- server ready は ≈530ms（mmap・キャッシュ温）。起動コストは問題にならない。

## 6. 機械ゲート（生出力)

### 6.1 `node --test`（魂の全スイート）

```
1..160
# tests 160
# suites 0
# pass 160
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 885.9689
```

内訳: baseline 129（S1 84 + Domain A 45・無退行）+ **新規 31**（whisper-server **10** + whisper-client **10** + transcript-buffer **11**。per-file 数は各ファイル単独実行の `^ok ` 計数 = 実測）。

**安定性とフレーク修正の記録（正直な経緯）**: 初回実行で新規テスト 4 件が不定期に `cancelledByParent`（「Promise resolution is still pending but the event loop has already resolved」・10 回中 4 回再現）。根因は **`unref()` したタイムアウト/ポーリングタイマだけが event loop に残った瞬間、loop が干上がり pending Promise が永遠に未決着になる**レース。修正 = whisper-client のタイムアウトタイマと whisper-server の ready ポーリングタイマを **unref しない**（前者は finally で必ず clear・後者は readyTimeoutMs で有界に決着するため、待機中に loop を保持するのがむしろ正しい）。修正後、**新規 3 ファイル単独 ×15 回 + 全スイート ×3 回 + 最終 1 回、全て 160/160・cancelled 0・exit 0**。S1 ハング（緑後に終了しない）とは逆向きの症状（先に終了しすぎる）だが、教訓は同根——「タイマ・子プロセス・パイプの ref 状態を設計で決めよ」。

### 6.2 モノレポ 3 チェック（リポジトリルート・各 timeout 120s・実 exit code）

```
Soul zone boundary guard passed: 1292 source files scanned; no 器→魂 imports and no 魂→器 code imports.
soul-zone EXIT=0
Dependency guard passed.
deps EXIT=0
Source organization violations found:
- apps/runtime-player/src/main/physiology/index.ts: index.ts must remain a barrel-only entrypoint
source EXIT=1
```

- soul-zone 1292 = Domain A レビュー時 1285 + 新規 7 ファイル（.mjs 3 + test 3 + preflight 1）。
- source の赤 1 件は**既知 baseline**（器側・S1 followup §7・S2 無関係）。魂由来の新規赤ゼロ = 無退行。

### 6.3 保護対象・触れたファイルの裏取り（生出力）

```
$ git diff --stat pnpm-lock.yaml apps/runtime-player/src/main/control-channel/contract/
（空 = 不変）
$ git diff --name-only apps/soul/agent/src/
（空 = S1/Domain A の tracked ソース 1 行も不変）
$ git status --porcelain（Domain B 関与分の抜粋）
?? apps/soul/agent/scripts/preflight-asr.mjs
?? apps/soul/agent/src/transcript-buffer.mjs
?? apps/soul/agent/src/transcript-buffer.test.mjs
?? apps/soul/agent/src/whisper-client.mjs
?? apps/soul/agent/src/whisper-client.test.mjs
?? apps/soul/agent/src/whisper-server.mjs
?? apps/soul/agent/src/whisper-server.test.mjs
```

- `M apps/soul/agent/package.json` / `package-lock.json` は Domain A + choke point install の既存差分（Domain B では 1 バイトも触れていない。新規依存ゼロ）。
- `M s2-wave-plan.md` は Orch の Status 更新（私ではない）。domain-a.md（untracked 内）の 2 数字訂正はスコープ0 の指示どおり。
- vendor / 録音物: 新規生成物なし（preflight の音声はメモリ上のみ・ディスク不書き出し。writeTempWav も未使用）。

## 7. 迷った設計判断・引き継ぎ注記

1. **【S6/S9/S3 への引き継ぎ・レイテンシ】** warm でも発話終了→転写到着 ≈6.6s（8T）/ ≈9.5s（4T・既定）は、S2 人間ゲート「数秒以内の追従」に対して borderline、S3 の会話発火にはさらに厳しい。実測から**音声長非依存の固定コスト**なので、Domain C / experiments での改善候補: `-t`（4→8 で 1.44 倍・本 preflight に `--threads` あり）、`--audio-ctx`（30s 固定窓の短縮・短発話に効くはず・**未検証**）、`-bo 1`/`--no-fallback`。チューニングは Domain B のスコープ外と判断し未実施（preflight が計測手段を提供する所まで）。
2. **【設計判断】whisper-server に再起動耐性を持たせなかった**: wave 計画 §3 Domain B の要求は「モデルパス・ポート・起動ヘルスチェック・終了処理」で再起動は明示されていない。ffmpeg（デバイス起因で死にやすい入り口）と違い、ASR サーバの死は結線層（Domain C）が onExit で観測して方針判断（再起動 or 診断表示）すべきと判断。`onExit` コールバックは提供済み。
3. **【設計判断】ヘルスチェック = 「任意の HTTP 応答」**: whisper-server は listen 前にモデルをロードするため十分。`/inference` を空打ちする「深い」ヘルスチェックは 1 回 6 秒超かかるため不採用。
4. **【設計判断】空転写は捨てる + onDiscard で観測**（§4.4）。積む選択肢（S3 に判断を委ねる）と迷ったが、「正本 = 内容のある発話の列」の方が S3 の消費形として素直で、診断可観測性で情報損失を補えると判断。
5. **【Domain C への注記（再掲・レビュー note 1）】** speechEnd.endMs は pad 分ストリーム実在範囲を超え得る → PCM リングバッファ切り出しは [0, 実データ末尾] clamp 必須。転写バッファ側は endMs をそのまま信じる（clamp は切り出し側の責務）。
6. **【Domain C への引き継ぎ】** preflight-vad の再現資材化 + VAD ラッパ到達テスト（wave 計画 §3 Domain C に記載済み）。本 domain では触れていない。
7. **【教訓・全 domain 共通】** unref タイマのレース（§6.1）。「畳んだ後のリソースは unref、待機中のリソースは ref のまま + 有界時間で必ず決着させる」が正しい線引き。ffmpeg-capture の再起動タイマ unref は「dispose 後に発火しても無害な再起動しないタイマ」なので現状のままで正しい（点検済み・変更なし）。

## 8. Orch への質問

1. **レイテンシの扱い**: §7-1 のとおり、既定設定のままでは人間ゲート「数秒以内の追従」が warm 6.6〜9.5s になる。Domain C で `--audio-ctx` 等の短発話最適化を試す時間を取るか、まず結線して実測（experiments/s2-ears.md）してから判断するか、Orch/Undine の裁量を仰ぎたい（推奨: 後者。計測手段は preflight-asr で提供済み）。
2. **threads 既定**: 実測で 8T が 1.44 倍速（論理 16 CPU 機・ただし配信中は器の二体と CPU を分け合う）。魂の常駐既定を 4（サーバ既定）のままにするか 8 に上げるかは Domain C の結線時に experiments とセットで決めるのが良いと考える（本 domain は「設定可能」まで）。
