# S2.5 追撃 domain-f 実装記録: flash-attn 既定 OFF + コクピット・ゴースト行 + 診断記録

> Status: 実装完了・機械テスト全緑（2026-07-12, Gnome）。install 不要（新規 npm 依存ゼロ）。
> スコープ: 人間ゲートで観測された「約 3.2 秒超の発話の転写が丸ごと消える / ゴミ行になる」現象への
> 対応（委任時点の診断仮説は §5 参照）+ コクピットの観測性改善（破棄/ASR失敗のゴースト行）+ 記録整備。
> 流儀の手本: [domain-a.md](domain-a.md)（S2.5 Domain A・cockpit-server サーバ本体の実装記録）。

## 0. 判定サマリ

- **判定: completed**（コード変更・テスト・記録はすべて完遂）。ただし機械ゲート1（崩壊ゾーン回帰
  プローブ）は、委任時点の診断仮説（flash-attn ON × audio_ctx>256 で決定論的崩壊）を**実機再検証で
  再現できなかった**（§5・[long-utterance-diagnosis.md](long-utterance-diagnosis.md) 参照）。この事実は
  隠さず正直に報告する（詳細は末尾「質問・持ち越し」）。
- **緑で裏取り済み**: `buildWhisperServerArgs`/`createWhisperServer` の `flashAttn` オプション（既定
  `false` = `-nfa`）・cockpit の diagnostic span 追加・cockpit.html のゴースト行。魂の全テスト
  **231/231 緑**（委任時点の 226 + 新規 5）。
- **3 モノレポチェック**: `check:soul-zone` 緑 / `check:deps` 緑 / `check:source` は**器（runtime-player）
  の既存違反 1 件で赤だが、本ドメイン外・本変更と無関係の pre-existing**（domain-a.md §7 と同一事象）。
- **lockfile 不変**: `pnpm-lock.yaml`・`apps/soul/agent/package.json` ともに変更なし（新規依存ゼロ）。

## 1. 変更・新規ファイル一覧（絶対パス）

| パス | 新規/変更 | 内容 |
| --- | --- | --- |
| `C:\workspace\remie\code\ai-native-live2d-editor\apps\soul\agent\src\whisper-server.mjs` | 変更 | `buildWhisperServerArgs`/`createWhisperServer` に `flashAttn`（既定 `false`）オプション追加。既定で `-nfa` を起動引数に含める。ヘッダに機構・閾値・根拠を追記。 |
| `C:\workspace\remie\code\ai-native-live2d-editor\apps\soul\agent\src\whisper-server.test.mjs` | 変更 | 新規テスト 2 件（既定出力に `-nfa` が含まれる / `flashAttn:true` で `-nfa` が出ない）。 |
| `C:\workspace\remie\code\ai-native-live2d-editor\apps\soul\agent\src\ear-pipeline.mjs` | 変更 | JSDoc のみ（`options.whisper.flashAttn` の説明を追記）。挙動変更なし（`options.whisper` を spread して渡すだけなので既存の結線で自動的に効く）。 |
| `C:\workspace\remie\code\ai-native-live2d-editor\apps\soul\agent\src\cockpit-server.mjs` | 変更 | `handleDiagnostic` の `diagnostic` broadcast に `startMs`/`endMs` を追加（asrFailure 等の span 情報。既存フィールドは維持・追加のみ）。 |
| `C:\workspace\remie\code\ai-native-live2d-editor\apps\soul\agent\src\cockpit.html` | 変更 | ゴースト行（`.row.ghost` CSS + `addGhostRow()` 関数）。`discard` イベントで `(discarded)`・`diagnostic type==="asrFailure"` で `(asr failed)` を淡色行として追加。footer カウンタ更新は維持。 |
| `C:\workspace\remie\code\ai-native-live2d-editor\apps\soul\agent\src\cockpit-page.test.mjs` | 変更 | 新規テスト 3 件（discard→ゴースト行・asrFailure→ゴースト行・淡色クラスで区別）。 |
| `C:\workspace\remie\code\ai-native-live2d-editor\apps\soul\agent\scripts\probe-long-utterance.mjs` | 新規 | 崩壊ゾーン回帰プローブ（恒久）。preflight-ears.mjs と同型の実部品縦貫通で (i) flash-attn=ON（抑止オプション）と (ii) 既定（-nfa）を比較。 |
| `C:\workspace\remie\code\ai-native-live2d-editor\discussion\ai-cohost\experiments\s2-ears.md` | 変更 | §6 訂正注記を追加（§2.1/§3.2 の計測条件の限界・診断仮説と domain-f 再検証結果の両方を記録）。 |
| `C:\workspace\remie\code\ai-native-live2d-editor\discussion\ai-cohost\implementation\waves\s2.5\s2-5-followup.md` | 変更 | §3 新設（domain-f の持ち越し 3 件: 末尾反復との関係未整理・計測音源は本番同形で作る教訓・診断再現性が崩れた事実の扱い）。 |
| `C:\workspace\remie\code\ai-native-live2d-editor\discussion\ai-cohost\implementation\waves\s2.5\long-utterance-diagnosis.md` | 新規 | 診断の恒久記録（症状・委任時点の仮説・domain-f の対応と再検証結果・未確定の仮説・プローブ所在）。 |
| `C:\workspace\remie\code\ai-native-live2d-editor\discussion\ai-cohost\implementation\screens\soul-cockpit.md` | 変更 | ゴースト行の実装注記を 1 行追加（§2 Timeline 節）。 |
| `C:\workspace\remie\code\ai-native-live2d-editor\discussion\ai-cohost\implementation\waves\s2.5\domain-f.md` | 新規 | 本ファイル（実装記録）。 |

## 2. 設計判断

### 2.1 `flashAttn` 抑止オプションの命名・配線

`buildWhisperServerArgs(opts)`/`createWhisperServer(options)` に `flashAttn?: boolean`（既定 `false`）を
追加した。`false`（既定）= `-nfa` を push、`true` = 付けない（vendor 既定の flash-attn ON に戻す）。
配線は `extraArgs` の前段に置く（`extraArgs` で `-nfa`/`-fa` を明示指定したい特殊経路を後勝ちで許す
余地を残す設計。ただし `-nfa` の重複指定自体は whisper-server 側の許容次第で未検証・通常は使わない）。

`ear-pipeline.mjs` は `whisperOptions = { threads: EAR_DEFAULTS.threads, ...(options.whisper ?? {}) }` を
そのまま `serverFactory`（`createWhisperServer`）へ渡す既存の結線があるため、**`ear-pipeline.mjs` 自体は
1 行も挙動変更していない**（JSDoc の説明を足しただけ）。これにより cockpit・ears-cli・preflight-ears の
全既定経路で `-nfa` が自動的に付く。`options.args`（丸ごと上書き）経路は従来どおりバイパス（テスト注入用・
委任どおり）。

### 2.2 ゴースト行の実装方式

`cockpit.html` に依存を増やさない範囲で、`discard`/`diagnostic(asrFailure)` を「無言の消失」にしない
最小実装を入れた:
- CSS: `.row.ghost .text { color: var(--muted); font-style: italic; }` の 1 クラスのみ追加（既存トークン
  流用）。
- JS: `addGhostRow(label)` 関数（`removeSpeakingRow()` → 行生成 → `timeline.appendChild` → スクロール、
  という `addTranscriptRow` と同型の骨格）。話者列（`.who`）は空のまま（話者不明であることを示す）。
  時刻列は到着時刻 `fmtClock(Date.now())`（`addTranscriptRow` が `appendedAtMs` 欠落時に `Date.now()` へ
  フォールバックするのと同じ流儀）。
- `discard` イベントでは footer カウンタ更新（既存）に加えてゴースト行を追加。
- `diagnostic` イベントでは `type === "asrFailure"` のときのみゴースト行を追加（他の診断型は従来どおり
  拡張予約・未表示のまま）。

cockpit-page.test.mjs の既存流儀（DOM 実行はせず、HTML 文字列への正規表現マッチでロジックを固定する）
に合わせてテストを追加した（`cockpit-server.test.mjs`/`cockpit-page.test.mjs` はいずれも実ブラウザ DOM
を使わない機械テストという既存の設計に揃えた形）。

### 2.3 cockpit-server.mjs の diagnostic span 追加

`handleDiagnostic` の `diagnostic` broadcast に `startMs`/`endMs` を追加した（`d?.startMs ?? null` /
`d?.endMs ?? null`）。既存フィールド（`type`/`message`/`reason`）は変更せず、フィールド追加のみなので
ワイヤ契約（[domain-a.md](domain-a.md) §4）を破壊しない。`cockpit-server.test.mjs`（S2.5 Domain A の
既存テスト・本 domain では変更していない）に `diagnostic` イベントの厳密な形を assert するテストは
無かったため、既存テストへの影響はゼロ（231/231 緑で確認）。

### 2.4 プローブの置き場

`apps/soul/agent/scripts/probe-long-utterance.mjs`（恒久・`preflight-*.mjs`/`bench-asr.mjs` と同じ
`scripts/` 直下）。既存の `preflight-ears.mjs` は変更せず新規ファイルにした（委任の「拡張するか新規
スクリプトか」の裁量点で、既存 preflight の契約・exit code 意味を変えないため新規を選んだ）。

## 3. 機械ゲート結果（生の数字）

### 3.1 ゲート1: 崩壊ゾーン回帰プローブ

**前提確認（実行前）**: vendor `whisper-server.exe`・model（`ggml-kotoba-whisper-v2.0-q5_0.bin`）は
存在（`apps/soul/agent/vendor/whisper/` と `vendor/models/`）。AivisSpeech（`http://127.0.0.1:10101`）は
`curl -m 3 http://127.0.0.1:10101/version` → **HTTP 200** で疎通確認済み。ゲート実行可能と判断。

**実行**: `node apps/soul/agent/scripts/probe-long-utterance.mjs`（タイムアウト付き・各 run 60s 有界待ち）。

```
[probe-long-utterance] TTS 合成中: "今日はメッシュ生成の続きをやりながらずいぶん長い時間このトピックに
  取り組んでいて焦らず一つずつ確認しながら少しずつ前に進めていこうと思っていますのでもうしばらく
  このまま作業を続けていく予定です"
[probe-long-utterance] utterance duration: 14.71s
[probe-long-utterance] ── run start: flash-attn=ON (旧挙動) (flashAttn=true, port=8178) ──
[probe-long-utterance]   vad: speechEnd 0.71..15.10s (silence)
[probe-long-utterance]   transcript[0] 0.71..15.10s latency=4523ms audio_ctx=816
    "今日はメッシュ生成の続きをやりながら／随分長い時間このトピックに取り組んでいて／
     焦らず一つずつ確認しながら／少しずつ前に進めていこうと思っていますので／
     もうしばらくこのまま作業を続けていく予定です"
[probe-long-utterance] ── run start: flash-attn=OFF (-nfa・採用既定) (flashAttn=false, port=8179) ──
[probe-long-utterance]   vad: speechEnd 0.71..15.10s (silence)
[probe-long-utterance]   transcript[0] 0.71..15.10s latency=4726ms audio_ctx=816
    "今日はメッシュ生成の続きをやりながら／随分長い時間このトピックに取り組んでいて／
     焦らず一つずつ確認しながら／少しずつ前に進めていこうと思っていますので／
     もうしばらくこのまま作業を続けていく予定です。"
[probe-long-utterance] (i)  flash-attn=ON:  → collapsed=false
[probe-long-utterance] (ii) flash-attn=OFF: → ok=true
[probe-long-utterance] FAIL: 期待した対比（(i)崩壊・(ii)正常）が得られなかった
```

**追加試行（再現性確認・計 6 回・複数の異なる文面）**: 11.96s(audio_ctx=680)・12.14s(audio_ctx=683)・
21.81s(audio_ctx=1099)・14.81s(audio_ctx=808 を 3 回反復) いずれも flash-attn=ON で**崩壊は再現されず**
正常転写だった（生ログは実行時ターミナル出力・詳細は
[long-utterance-diagnosis.md](long-utterance-diagnosis.md) §3.2）。

**判定**: プローブは正しく動作し実行を完遂したが、**委任時点の診断仮説（flash-attn ON ×
audio_ctx>256 で決定論的崩壊）を計 7 回の試行すべてで再現できなかった**。`-nfa` への変更自体は
無害（転写品質同等・レイテンシ増軽微 4523ms→4726ms）と確認できたため実装は維持するが、崩壊の
原因特定は完了していない（詳細は末尾「質問・持ち越し」）。

### 3.2 ゲート2: 魂全テスト無退行 + 新規テスト緑

```
cd apps/soul/agent && node --test
# tests 231
# suites 0
# pass 231
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 1138.4806
```

委任時点の背景値 226 + 新規 5（whisper-server.test.mjs +2・cockpit-page.test.mjs +3）= **231**。
一致確認済み。プロセスは自然終了（ハングなし）。

個別実行でも確認: `node --test src/whisper-server.test.mjs`（13/13 緑）・
`node --test src/cockpit-page.test.mjs src/cockpit-server.test.mjs`（28/28 緑）。

### 3.3 ゲート3: 3 チェック無退行

```
$ node scripts/check-soul-zone-boundary.mjs
Soul zone boundary guard passed: 1313 source files scanned; no 器→魂 imports and no 魂→器 code imports.
EXIT: 0

$ node scripts/check-dependencies.mjs
Dependency guard passed.
EXIT: 0

$ node scripts/check-source-organization.mjs
Source organization violations found:
- apps/runtime-player/src/main/physiology/index.ts: index.ts must remain a barrel-only entrypoint
EXIT: 1
```

`check:source` の違反は `apps/runtime-player/src/main/physiology/index.ts` の barrel 違反のみで、
domain-a.md §7 に記録済みの既存事象と同一（本 domain では 1 バイトも触れていない・`git status` で
クリーン）。新規違反ゼロ。

**lockfile 不変・新規依存ゼロ**:
```
$ git status --porcelain | grep -i lock
(該当なし)
$ git diff --stat -- pnpm-lock.yaml apps/soul/agent/package.json
(差分なし)
```

## 4. 質問・持ち越し

1. **【最重要】機械ゲート1の結果が委任時点の診断前提と食い違う**: 委任時に「診断済みの確定事実・
   再診断不要」として与えられた「flash-attn ON × 動的 audio_ctx（audio_ctx>256 域）で転写が決定論的に
   崩壊する」という仮説を、実 Silero VAD 経由の縦貫通プローブ（計 7 回・audio_ctx 256〜1099・複数の
   異なる長文）で**一度も再現できなかった**。scratchpad に残っていた委任元の診断過程プローブ
   （`probe-trim-matrix.mjs` 等）を確認したところ、そちらは振幅閾値による近似矩形トリムを使っており、
   domain-f が使った実 Silero VAD トリムとは境界の作られ方が異なる。この差が再現性の違いの原因という
   仮説は立てたが、確証はない（[long-utterance-diagnosis.md](long-utterance-diagnosis.md) §3.3）。
   **`-nfa` への変更自体は無害と確認できたため実装・テスト・記録は委任どおり完遂させたが、「決定論的
   崩壊」を機械的に再現できていない以上、この対応で人間ゲートの元の症状が実際に解消するかは未検証の
   ままである。** 次に人間ゲートで長発話の消失が再現するか（-nfa 適用後）を人間ゲートで確認するのが
   次の一手として妥当と考えるが、判断は委ねる。
2. **末尾反復アーティファクトとの関係が未整理**（s2-5-followup.md §3-1 に台帳化済み）。
3. **崩壊の再現条件の深掘りは本 domain のスコープ外**と判断し、これ以上の実験（実マイク環境・CPU 競合
   下での再現等）は行っていない。必要なら別 wave として切り出すことを推奨する。
