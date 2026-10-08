# S1 Domain A 実装記録: 特区パッケージ骨格 + モーラ写像 / WAV パーサ純関数

> Status: 実装完了・全検証緑（2026-07-12, Gnome）。
> スコープ: [../../orchestration/s1-wave-plan.md](../../orchestration/s1-wave-plan.md) §3 Domain A（install 不要で完結）。
> 契約の正: `apps/runtime-player/src/main/control-channel/contract/channel-intent-speech-payload-schema.json`。
> 事実台帳: [../../orchestration/s1-planning-inventory.md](../../orchestration/s1-planning-inventory.md)（§1 契約意味論・§3 AivisSpeech 実機事実・§6 裁定）。

## 1. 作成した全ファイル

すべて特区サブディレクトリ `apps/soul/agent/` 内（pnpm workspace glob 対象外＝lockfile 不変）。器・契約には一切触れていない。

| パス | 役割 |
| --- | --- |
| `apps/soul/agent/package.json` | 独立 npm パッケージ骨格。`@soul/agent` / `private` / `type:module` / `version 0.0.0`。deps に `@anthropic-ai/claude-agent-sdk@0.3.207`（**宣言のみ・install していない**）。`scripts.test = "node --test"`。devDeps ゼロ。 |
| `apps/soul/agent/src/mora-timeline.mjs` | モーラ写像純関数 `buildSpeechTimeline(moras, wavDurationSec, prePhonemeSec, postPhonemeSec, sConfig?)`。 |
| `apps/soul/agent/src/wav-duration.mjs` | WAV ヘッダパーサ純関数 `wavDurationSec(bytes)`。 |
| `apps/soul/agent/src/fixtures.mjs` | ゴールデン fixture（実機 audio_query moras）+ WAV バイト列ビルダ（テスト用）。 |
| `apps/soul/agent/src/mora-timeline.test.mjs` | モーラ写像の node:test（18 ケース）。 |
| `apps/soul/agent/src/wav-duration.test.mjs` | WAV パーサの node:test（14 ケース）。 |

依存グラフは `.mjs`（自 zone 内相対 import）+ `node:test`/`node:assert` のみ。器コードの相対 import はゼロ（boundary check 緑で裏取り）。

## 2. 純関数の契約と決定したエッジケース

### 2.1 `buildSpeechTimeline(moras, wavDurationSec, prePhonemeSec, postPhonemeSec, sConfig?)`

- **入力**: `moras` = audio_query のモーラ列（pau/N/cl 等 enum 外も含む**生の並び**）。`wavDurationSec` = 合成 WAV 実秒（有限・正）。`prePhonemeSec`/`postPhonemeSec` = WAV 先頭/末尾無音秒（有限・非負）。`sConfig?` = `{ vowelMap?: {a,i,u,e,o→number} }`（省略可）。
- **出力**: `{ timeline: [{ timeMs, vowel, s }] }` = intent.speech payload そのもの。

決定したエッジケース（すべて fixture/性質テストで固定）:

1. **均等割り（裁定2）**: `bodyDurationSec = wavDurationSec - prePhonemeSec - postPhonemeSec` を `moras.length`（脱落モーラも数える**全要素数**）で割り、i 番目のモーラの開始を `prePhonemeSec + i*(bodyDurationSec/moras.length)` 秒に置く。個別モーラの consonant/vowel_length は実機で全零（§3 実測、下記 fixture が証拠）なので使わない。
2. **pre 無音オフセットの選択（採用: WAV 実時間軸・先頭無音込み）**: `timeMs` は WAV 先頭を t=0 とする軸。t=0 = 器がインテントを受理した瞬間（契約: payload に開始時刻なし）。合成 WAV は先頭に prePhonemeSec の無音を持つため、**最初の発声モーラを prePhonemeSec 分だけオフセット**する。
   - **理由**: wave 計画 §3 Domain B の同期方針（accepted 受領→即再生・WAV 先頭無音 0.1s が器の口の立ち上がり attack と概ね相殺）と整合する。魂が「音声の先頭無音」と「口の開き始め」を同一時間軸で扱えるので、Domain B は accepted 時刻に再生を合わせるだけでよい。仮に先頭無音を除いて t=0 に最初の母音を置く設計にすると、音声（無音 0.1s 込み）と口が 0.1s ズレるため、この選択が皮膚感のズレを最小化する。最終的な皮膚感は一聴ゲートで判定（必要なら追撃で先頭オフセット微調整）。
3. **enum 外の脱落 + 時間ギャップ保持**: `vowel` を小文字化して `a/i/u/e/o` 以外（pau・N・cl・長音マーカ・空文字・非文字列・vowel 欠落）は **timeline 要素を出さない**。ただし均等割りは全モーラ位置で行うので、その位置の時間スロットは消費され、前後の母音モーラの間隔が空く＝「間」として残る。
4. **vowel 正規化**: `String(vowel).toLowerCase()` してから写像。無声化母音の大文字 `A/I/U/E/O` は小文字化して残る。小文字化後に `a/i/u/e/o` 以外は脱落 → 出力に残る vowel は必ず 5 値のいずれか（契約 enum を構築で保証）。
5. **timeMs 整数化 + 厳密単調保証**: 出力 timeMs は整数・非負・厳密単調増加（器は同時刻も拒否）。四捨五入で隣接が同値以下になったら「**最小 1ms 間隔を強制して押し出す**」= `timeMs[k] = max(round(raw), timeMs[k-1] + 1)`。要素数に対し尺が短すぎても壊れず単調を保つ（エラーにはしない）。非負は前値起点 `-1` が保証（最初の要素は 0 を取り得る）。
6. **s 値（裁定2・参照ドライバ流儀）**: 母音ラベル→s を決定論的に付与。既定マップ `DEFAULT_S_BY_VOWEL = { a:0.85, i:0.5, u:0.55, e:0.7, o:0.65 }`（参照ドライバ `speechTimelineMoras` の手書き 0.5〜0.9 の母音別平均相当。a=広い開き / i=狭い、の直感に沿う。全て 0..1 域内）。`sConfig.vowelMap` で母音別に上書き可能（既定にマージ）。**解決後の s が有限で 0..1 域外なら throw**（出力 s の 0..1 不変条件を構築時に保証）。
7. **512 上限（裁定4）**: **出力 timeline 要素数** > 512 は throw（切詰めない・文分割は S4+ の前提）。脱落込みの生要素数ではなく、脱落後の出力要素数で判定する（契約 maxItems=512 は timeline 配列に掛かるため）。
8. **その他 throw 条件**: 空 moras / 発話実体尺が非正（pre+post ≥ wav）/ 母音が 1 つも残らない（contract minItems=1 違反）/ wavDurationSec 非正・非有限 / pre・post 負・非有限 / moras 非配列。

### 2.2 `wavDurationSec(bytes)`

- **入力**: WAV バイト列（`Uint8Array`/`Buffer`/`ArrayBuffer`）。AivisSpeech `/synthesis` 出力 = RIFF/WAVE リニア PCM mono 44100Hz 16bit。
- **出力**: 実秒 `number` = `dataChunkBytes / byteRate`。

決定した扱い:

- RIFF/WAVE マジック（offset 0="RIFF", 8="WAVE"）を検査。不一致は throw。
- offset 12 からサブチャンクを走査（各チャンク = 4byte id + 4byte size(LE) + body）。**チャンクは順不同**（data が fmt より前でも可）を許す。奇数サイズ body は 1byte パディングを跨ぐ（size に含めない）。
- `byteRate` は fmt チャンクの byteRate フィールドを優先。0 または欠落なら `sampleRate * blockAlign`（= sampleRate*channels*bits/8）で代替。
- **パーサは宣言 data サイズを使う**（実バイト長ではなく data chunk の size フィールド）。→ 実機の完全 WAV でも、ヘッダのみのテスト fixture でも同じ実秒を出す。
- throw 条件: 12byte 未満 / RIFF・WAVE マジック不一致 / fmt body 切り詰め / data チャンク欠落 / byteRate も sampleRate*blockAlign も 0。

## 3. fixture 一覧

### 3.1 モーラ fixture（**実機取得・1 回・/synthesis なし**）

`src/fixtures.mjs` の `GOLDEN_MORAS_KONNICHIWA`。組み込み fetch で AivisSpeech 実機（`http://127.0.0.1:10101`, engine 1.1.0-dev）の `POST /audio_query`（text=「こんにちは、テストです」, speaker=888753760）を **1 回だけ**叩いて得た moras を固定した（音声生成 `/synthesis` は叩いていない・再生していない）。取得は使い捨てスクリプトで行い、テスト本体はネットワーク非依存（固定 fixture で通る）。

実機が返した要点（この fixture 自体が証拠）:
- accent_phrases 平坦化で **11 要素**。`prePhonemeLength=0.1`, `postPhonemeLength=0.1`。
- `consonant_length` / `vowel_length` / `pitch` は**全零（null 含む）** = 個別モーラ長は使えない（裁定2 の前提を実機で再確認）。
- vowel ラベル実形: `o, N, i, i, a, pau, e, u, o, e, u`。「ン」= vowel `"N"`（enum 外）、句読点「、」= `{text:",", vowel:"pau"}`（enum 外）。→ この 2 つ（index 1 の N・index 5 の pau）が脱落し、時間ギャップとして残る。

ゴールデン出力 timeline（`buildSpeechTimeline(GOLDEN_MORAS, 1.5468, 0.1, 0.1)`、9 要素）:
```
[100:o:.65][345:i:.5][467:i:.5][590:a:.85][835:e:.7][957:u:.55][1079:o:.65][1202:e:.7][1324:u:.55]
```
100→345（N 跨ぎ）と 590→835（pau 跨ぎ）の間隔が隣接間隔より広い＝「間」の証拠。

### 3.2 WAV fixture（手組み・ネットワーク非依存）

`src/fixtures.mjs` の `buildWavBytes(...)`（canonical 44byte ヘッダ）+ テスト内 `buildRiff(...)`（任意チャンク並び・パディング検証用）。planning-inventory §3 の実測「こんにちは、テストです ≈ data 1.5468s / 44100Hz mono 16bit（byteRate 88200）」を接地に、`dataBytes=136428 → 1.5468s`、`dataBytes=88200 → 1.0s` 等を固定 fixture で検証。実 WAV バイナリの取得はしていない（宣言サイズで実秒が決まるため手組みで十分）。

### 3.3 性質テスト

単調性（整数・非負・厳密単調）・vowel enum・s 境界（0..1）・脱落と時間ギャップ・整数化衝突時の 1ms 押し出し・512 境界（512 許容 / 513 throw・脱落込み判定）・チャンク順不同・奇数長パディング・byteRate 代替・不正ヘッダ throw・部分ビュー byteOffset 尊重・決定論。

## 4. 検証（生出力）

### 4.1 `node --test`（モーラ写像・WAV パーサ両スイート）

Node 22 の `node --test <dir>` はディレクトリ引数をモジュールエントリと解釈するため、パッケージの test スクリプト相当（`cd apps/soul/agent && node --test`）と glob 形の両方で確認。両者 32/32 緑。

```
===== glob form from repo root: node --test "apps/soul/agent/src/**/*.test.mjs" =====
1..32
# tests 32
# suites 0
# pass 32
# fail 0
# cancelled 0
# skipped 0
# todo 0

===== canonical: cd apps/soul/agent && node --test =====
1..32
# tests 32
# suites 0
# pass 32
# fail 0
# cancelled 0
# skipped 0
# todo 0
```

### 4.2 `node scripts/check-soul-zone-boundary.mjs`

```
Soul zone boundary guard passed: 1254 source files scanned; no 器→魂 imports and no 魂→器 code imports.
exit=0
```

### 4.3 git status / protected-path diff

```
===== git status --porcelain =====
?? apps/soul/agent/

===== git diff --stat pnpm-lock.yaml apps/runtime-player/src/main/control-channel/contract/ =====
(空出力 = 変更なし)
```

lockfile と器コード / C4 契約 fixture に変更ゼロ。作業は `apps/soul/agent/` 新規ファイル 6 点に閉じている。

> 注記（私が引き起こしたものではない環境の観測）: 作業中に HEAD が `3ccda00` → `eae2751`（"S1棚卸しとwave計画を確定"）へ進み、セッション開始時スナップショットにあった `apps/editor/...` 等の M ファイルはコミット済みになった（私の入力=計画文書のコミット）。私は `apps/soul/agent/` 以外を触っていない。

## 5. 未解決の質問（Orch-Sylph へ）

1. **install の choke point**: wave 計画 §5 の通り、Domain B/C 続行前に `cd apps/soul/agent && npm install` が必要（`@anthropic-ai/claude-agent-sdk@0.3.207` を宣言済み・install はユーザー作業）。純関数テストは依存ゼロで緑だが、Domain B/C は SDK と fetch を使うため install 後に着手すること。install により `apps/soul/agent/package-lock.json` と `node_modules/` が生じる（サブディレクトリなので pnpm-lock.yaml は不変のはず。裁定1）。**確認事項**: install 後に `check:soul-zone / check:deps / check:source` が引き続き緑か（planning-inventory §5 は非該当と予測しているが、実 install での再確認が Domain B 着手時の前提）。
2. **pre 無音オフセット採用の一聴ゲート依存**: §2.1(2) の「先頭無音込み軸」は wave 計画 §3 Domain B の同期方針と整合させた設計選択で、皮膚感の最終判定は一聴ゲート（Domain B/C）に委ねている。ズレが感じられた場合の追撃（先頭オフセット微調整）は Domain B の同期実装側で吸収する想定。純関数の契約変更は不要（オフセットは prePhonemeSec 引数で駆動されるため、呼び出し側の値調整で足りる）。
3. **sConfig の将来拡張**: 現状 `sConfig.vowelMap` のみ（母音別固定 s）。参照ドライバはモーラごとに手書き s を散らしていた（同一母音でも 0.6/0.65/0.7 と揺らす）が、Domain A では決定論・純関数性を優先し母音別固定にした。articulation の揺らぎ（同母音連続での再調音ディップ）は器側の普遍係数 0.8 + ディップで表現される契約（契約 §speechPath 注）なので、魂側 s の揺らぎは S1 スコープ外とした。必要なら後続で `sConfig` にモーラ index ベースの揺らぎ関数を足せる設計にしてある。
