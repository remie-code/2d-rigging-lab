# S2.5 追撃 domain-f レビュー結果（Review-Sylph）

> 対象: flash-attn 既定 OFF（`-nfa`）/ コクピット ゴースト行 / 記録整備。
> 参照実装記録: [domain-f.md](../../waves/s2.5/domain-f.md)。
> 判定: **合格**（blocking 指摘なし）。non-blocking 指摘 3 件・質問 0 件。

## spec レーン

### 1. `-nfa` 既定化 — 適合

- `buildWhisperServerArgs(opts)`: `flashAttn = opts.flashAttn ?? false` で、`false`（既定）のときのみ
  `-nfa` を push。位置は `-t`（threads）の後・`extraArgs` の前（`whisper-server.mjs:126-131`）。
  `flashAttn: true` で `-nfa` は出ない。既存の `-l`/`-t`/`extraArgs` の並びを壊していない。
- `createWhisperServer`: `options.args` を渡すと `buildWhisperServerArgs` を丸ごとバイパス（既存の
  「テスト注入・特殊経路」のまま）。本番経路（`ears-cli.mjs`/`preflight-ears.mjs`/`probe-long-utterance.mjs`/
  `cockpit-server.mjs` 経由の `ear-pipeline.mjs`）はいずれも `options.args` を渡していないことを実際に
  grep して確認した（`whisper: { args: ... }` の使用箇所ゼロ）。
- `ear-pipeline.mjs` は `whisperOptions = { threads: EAR_DEFAULTS.threads, ...(options.whisper ?? {}) }` を
  `serverFactory` へ spread するだけで、diff は JSDoc のみ。挙動変更なしの主張は正しい（コード上 1 行も
  ロジックが変わっていない）。
- 結線を実際に辿って確認: `cockpit-server.mjs` は `options.pipelineOptions` を無加工で `createEarPipeline` に
  渡す（whisper オプションを明示しない限り既定＝`-nfa` 付与）。`ears-cli.mjs`・`preflight-ears.mjs`・
  `probe-long-utterance.mjs` もすべて `whisper: {...}` に `flashAttn`/`args` を明示しない限り既定を継承。
  **4 経路すべてで `-nfa` が既定で効くという主張は裏取りできた。**
- ready ポーリング・dispose 等の既存挙動は今回の diff 範囲外（`buildWhisperServerArgs`/`createWhisperServer`
  の該当行のみの変更）で、非破壊。

### 2. ゴースト行 — 適合（軽微な記述精度の指摘 1 件、non-blocking）

- `cockpit-server.mjs`: `handleDiagnostic` の `broadcast("diagnostic", {...})` に `startMs`/`endMs` を
  追加フィールドとして足しただけ。既存フィールド（`type`/`message`/`reason`）は変更なし。
  `cockpit-server.test.mjs` に `diagnostic` イベントの形を厳密 assert するテストが無いことも実際に grep で
  確認（該当ゼロ件）＝既存テストへの影響なしの主張は正しい。
- `cockpit.html`: `discard` ハンドラは footer カウンタ更新（既存）を維持したまま `addGhostRow("(discarded)")`
  を追加。`diagnostic` ハンドラは `type === "asrFailure"` のときのみ `addGhostRow("(asr failed)")`、他の型は
  従来どおり何もしない（拡張予約のコメントも維持）。
- CSS `.row.ghost .text { color: var(--muted); ... }` は `--muted`(#8b93a1 グレー系)を使用し、
  speaking 行の `--speaking`(#f0c14b 黄系)、通常 `.text` の既定色（無指定＝継承色）と実際に別トークンで
  視覚的に区別できることをトークン定義まで確認した。依存追加なし（外部 CDN/フォント/スクリプト無し）。
  `removeSpeakingRow()` を先に呼ぶため speaking 行との排他も既存の `addTranscriptRow` と同型。
- footer discarded カウンタ更新（`byId("footer-discarded").textContent = d.discarded`）は変更前と同一行で
  維持されており破壊なし。
- **non-blocking 指摘**: `cockpit-server.mjs` の追加コメントは「startMs/endMs はゴースト行の対象 span」と
  書いているが、`cockpit.html` の `addGhostRow` は実際には `startMs`/`endMs` を一切参照せず、常に
  `fmtClock(Date.now())`（到着時刻）を使っている。これは `domain-f.md` §2.2 で「`addTranscriptRow` が
  `appendedAtMs` 欠落時に `Date.now()` へフォールバックするのと同じ流儀」として明示的に裁量判断されており、
  嘘や隠蔽ではない。ただし `cockpit-server.mjs` 側のコメントは「span 情報を UI が使う」と読める書き方で、
  実際は v0 では未使用というギャップがある。次回このフィールドに触れる際に紛らわしいので、コメントに
  「v0 の cockpit.html では未使用（将来 S3+ で span 表示する場合の準備）」と一言足すと良い。

### 3. プローブの健全性 — 適合（判定粒度の限界を記録推奨、non-blocking）

- `preflight-ears.mjs` と同型の縦貫通（fake マイク → 実 Silero VAD → セグメンタ → リング切り出し →
  実 whisper-server）であることをコードで確認。
- 実マイク不使用（`captureFactory` は TTS PCM をメモリ上でタイマ注入するのみ）・ディスク不書き出し
  （WAV はメモリ上のバイト列のみ、ファイル書き込み API 呼び出しなし）を確認。
- タイムアウトは各 `runOnce` に 60s の deadline ループ、`main()` 全体もこの 2 回の実行で有界。
- 子プロセス後始末: `runOnce` の `finally` で必ず `pipeline.dispose()`。`captureFactory` の `dispose()` も
  `clearInterval` で確実にタイマを止める。
- **non-blocking 指摘（委任プロンプトで明示的に求められた観点）**: `beforeCollapsed` の判定は
  `transcripts.length === 0 || diags.some(asrFailure/transcriptDiscarded) || error != null` であり、
  「総 absence（転写ゼロ件）」は検出するが、症状として記録されている「『,』等のゴミ行」や「末尾反復」の
  ような**非空だが壊れた転写**は `transcripts.length > 0` である限り `beforeCollapsed=false` 側に落ちて
  見逃す。同様に `afterOk` も `text.length > 0` のみを見ており、ゴミ文字列 1 文字でも「正常」と判定されうる。
  今回の 7 回の非再現（すべて正常な日本語文が返っている）はログ本文で目視確認でき本物だが、**プローブが
  今後「ゴミ行/反復」パターンの崩壊を回帰検知できない**という判定粒度の限界がある。`domain-f.md`/
  `long-utterance-diagnosis.md` はこの限界を明示していないので、恒久記録に一言足す価値がある
  （blocking にはしない — 現状の実測結果の解釈自体は正しく、プローブの目的「崩壊 vs 非崩壊の粗い対比」は
  果たせている）。

### 4. 記録の正直さ — 適合

- `s2-ears.md` §6 は追記のみ（diff で §1〜5 の既存本文が 1 行も変更されていないことを確認）。「決定論的
  崩壊」を委任時点の「診断仮説」として明示し、domain-f の実機再検証で「7 回中 0 回しか再現できなかった」
  ことを隠さず記載。誇張なし。
- `long-utterance-diagnosis.md`（新規）は症状 → 委任時点仮説 → domain-f 対応 → 実機再検証結果 → 未確定の
  仮説、という時系列で正直に整理されている。「本 wave の対応自体は無害だが原因特定は未完了」という結論を
  明記。
- `domain-f.md` §0 判定サマリ・§4 質問・持ち越しでも同じ食い違いを最重要項目として明示し、次アクション
  （人間ゲートでの再確認）を委ねる形で記載。誇張・隠蔽は見られない。
- `s2-5-followup.md` §3 に台帳化（末尾反復との関係未整理／計測音源の教訓／診断再現性が崩れた事実の扱い）
  され、既存 §1〜2 は変更なし（追記のみ）。
- `soul-cockpit.md` はゴースト行の実装注記を 1 行追記しただけ（既存本文は無傷）。

## test レーン

### 5. 魂全テスト実行（自分で実行・タイムアウト付き）

```
cd apps/soul/agent && node --test   （120s タイムアウト内で完走・ハングなし）
# tests 231
# suites 0
# pass 231
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 1073.3109
```

Gnome 主張の 231/231（226 + 新規 5）と一致。生数字で確認済み。

### 6. 新規テストの適合

- `whisper-server.test.mjs` +2:
  - `既定出力に -nfa が含まれる` → `buildWhisperServerArgs({ modelPath: "m.bin" })` の結果に `-nfa` を
    直接 assert。観点1（既定 `-nfa`）を正しく固定。
  - `flashAttn:true（抑止オプション）で -nfa が出ない` → 抑止経路を直接 assert。観点1の裏側を固定。
  - いずれも実装のロジック分岐（`if (!flashAttn) push("-nfa")`）と 1 対 1 対応しており、実装を反対にしても
    確実に落ちるテストになっている（tautology ではない）。
- `cockpit-page.test.mjs` +3:
  - `discard SSE event adds a ghost row` → `footer-discarded` 更新と `addGhostRow(` 呼び出しの両方を
    正規表現で assert。footer 更新の非破壊とゴースト行追加の両方を固定。
  - `diagnostic asrFailure adds a ghost row; other diagnostic types do not` →
    `type === "asrFailure"` 条件と `addGhostRow(` 呼び出しを assert。ただし「other diagnostic types do
    not」という一文どおりの厳密な否定（他の type では呼ばれないこと）まではテスト本文では直接検証して
    おらず、`if (d.type === "asrFailure") addGhostRow(...)` という条件分岐の形を正規表現で確認するに
    留まる（実装を読めば単一 if 文なので他の type で呼ばれないことは論理的に保証されるが、テスト名ほど
    厳密ではない）。テストとして誤りではないが、テスト名がやや言い過ぎ。non-blocking。
  - `ghost rows are visually distinct` → `addGhostRow` 関数本体の `className = "row ghost"` と CSS の
    `--muted` 使用を assert。観点2の視覚区別を固定。
  - 既存の cockpit-page.test.mjs 流儀（DOM 実行せず HTML 文字列への正規表現マッチ）に一致。

### 7. 無退行・lockfile・新規依存ゼロ

```
git diff --stat -- pnpm-lock.yaml apps/soul/agent/package.json   → 差分なし
git status --porcelain | grep -i lock                             → 該当なし
```

3 チェック実行結果（自分で実行）:
```
node scripts/check-soul-zone-boundary.mjs
Soul zone boundary guard passed: 1313 source files scanned; no 器→魂 imports and no 魂→器 code imports.
exit=0

node scripts/check-dependencies.mjs
Dependency guard passed.
exit=0

node scripts/check-source-organization.mjs
Source organization violations found:
- apps/runtime-player/src/main/physiology/index.ts: index.ts must remain a barrel-only entrypoint
exit=1
```

`check:source` の唯一の違反ファイル `apps/runtime-player/src/main/physiology/index.ts` は
`git status --porcelain -- apps/runtime-player/src/main/physiology/index.ts` が空（クリーン）であることを
確認済み。**本 domain 由来ではない pre-existing 違反**（domain-a.md §7 と同一事象という記録の主張と整合）。

## 裁量判断（設計未定義を合理的に実装した箇所）

- `-nfa` の挿入位置を `extraArgs` の前に置き、`extraArgs` 側で `-fa`/`-nfa` を明示指定する特殊経路を
  後勝ちで許す余地を残した設計は妥当（ただし重複指定時の whisper-server 側の挙動は未検証、と記録側も
  正直に書いている）。
- ゴースト行の時刻表示を「到着時刻」（`startMs`/`endMs` 不使用）にした判断は、既存 `addTranscriptRow` の
  `appendedAtMs` フォールバック流儀に揃えたもので合理的。ただし上記 non-blocking 指摘 2 のとおり
  `cockpit-server.mjs` 側コメントとの記述ギャップがある。
- プローブを既存 `preflight-ears.mjs` に手を入れず新規ファイルにした判断（既存 exit code 契約を守るため）
  は妥当。

## 判定

**合格**。blocking 指摘なし。

non-blocking 指摘（3件、いずれも記録・コメントの精度向上の余地であり実装の正しさや非破壊性を損なうもの
ではない）:
1. `cockpit-server.mjs` の `startMs`/`endMs` コメントが、v0 の `cockpit.html` では未使用である旨を書いて
   いない（誤解を招きうる）。
2. `probe-long-utterance.mjs` の崩壊判定（`beforeCollapsed`/`afterOk`）が「総 absence」のみを検出し、
   「非空ゴミ/反復」パターンの崩壊は回帰検知できない限界が、恒久記録（`long-utterance-diagnosis.md`）に
   明記されていない。
3. `cockpit-page.test.mjs` の新規テスト名「other diagnostic types do not」が、実装のロジック構造から
   論理的に導かれる保証に依存しており、テスト本文で他の type を直接反証していない（tautology ではないが
   テスト名がやや言い過ぎ）。

## 質問

なし。機械ゲート1（崩壊ゾーン回帰プローブの非再現）についての判断（人間ゲート再確認の要否等）は委任
プロンプトの指示どおり Orch 側の上位エスカレーション対象として扱い、本レビューでは診断の真偽再判定を
行っていない。
