# S3 追撃 wave（小・domain-c）レビュー: test レーン

> Reviewer: Review-Sylph（test = テスト適合 + 機械ゲート再現）。委任元: Orch-Sylph。対象: `apps/soul/agent`。
> 実施日: 2026-07-12。**判定: 合格**。全観点を自分の手で再現し、Gnome §4 の生数字と一致した。
> commit / install はしていない（依存/環境不変）。SDK 実消費ゼロ・実マイク不使用。

---

## 判定サマリ

**合格。** 二重放送バグの実在（赤）と修正の有効（緑）を自分で再現。フルテスト 284/284 緑、3チェック無退行、
typecheck rc0、preflight 両 PASS、lockfile/依存/既存テスト全て不変を確認。要修正の差分なし。

---

## 観点別の実行生出力

### 1. 回帰テストの妥当性・赤→緑の再現（最重要）

**double の契約再現の正しさ（コード精査）**: 合格。
- 実 ear-pipeline は `src/ears/ear-pipeline.mjs:184-186` で
  `buffer.onAppend((entry) => onTranscript(entry, currentMeta ?? { latencyMs: NaN, audioCtx: null }))` を購読する
  （※ Gnome/テストコメントの「:179-181」は現行行では :184-186。挙動記述は正確・行番号のみ軽微ズレ、実害なし）。
- テストの `makeOnAppendPipeline`（`cockpit-server.test.mjs:753-775`）は
  `buffer.onAppend((entry) => options.onTranscript(entry, { latencyMs: NaN, audioCtx: null }))` を購読しており、
  **実 pipeline の話者無差別 onAppend→onTranscript 契約を正しく再現**している（meta の既定値も一致）。
- 総数固定の精査: テストは `sse.events.filter(e => e.event==="transcript" && e.data.speaker==="soul").length` を
  **`=== 1` で固定**（:816-821）。収束点は `soul` state が `idle` に戻るまで待ち（idle 遷移は
  `buffer.append(soul)` + `onSoulTranscript` の後）、さらに 50ms の有界猶予で 2 個目が遅れて来ないことを積極確認
  （:812-814）。you 転写も 1 回に固定（:823-824）。→ 消極的でなく積極的に「2 個目が来ない」を検証している。

**soul 除外ガードの実在**: `src/cockpit/cockpit-server.mjs:475`
`if (/** @type {any} */ (entry).speaker === "soul") return;`（onTranscript ハンドラ先頭・:470-475）を確認。

**赤→緑の再現（退避コピー方式で安全に実施）**:
- 元ファイルを scratchpad に退避（`git hash-object` = `d1c6db572f1c3727dd41988e2109bef60238a0fe` を記録）。
- ガード行 :475 を一時コメントアウト → 該当テストのみ実行:
  ```
  not ok 1 - cockpit /api/fire: soul 転写は二重放送されない（実 pipeline の onAppend→onTranscript 契約下で 1 回）
      soul transcript は 1 回だけ放送されるべき（実測 2）
      2 !== 1
  # tests 1 / # pass 0 / # fail 1
  ```
  → **赤（soul=2）を再現。バグ実在を確認。**
- 退避コピーから復元 → `git hash-object` = `d1c6db572f1c3727dd41988e2109bef60238a0fe`（**記録値と一致 = バイト同一復元**）。
  `grep "TEMP-RED-REPRO"` = 出力なし（**一時操作の痕跡ゼロ**）、ガード行 :475 存在を確認。
- 修正後（＝現状）の緑は下記フルテスト（284/284）に含まれ緑。

### 2. フルテスト無退行

`cd apps/soul/agent && node --test`（timeout 300）:
```
# tests 284 / # suites 0 / # pass 284 / # fail 0 / # cancelled 0 / # skipped 0 / # todo 0
# duration_ms 1230.96
```
→ Gnome 主張 284/284/0/0/0 と一致。**全緑。**

### 3. 3チェック無退行 + typecheck（リポジトリルート）

- `pnpm run check:deps` → `Dependency guard passed.`（exit 0・**緑**）
- `pnpm run check:soul-zone` →
  `Soul zone boundary guard passed: 1320 source files scanned; no 器→魂 imports and no 魂→器 code imports.`（rc 0・**緑**）
- `pnpm run check:source` → 違反 1 件のみ:
  `apps/runtime-player/src/main/physiology/index.ts: index.ts must remain a barrel-only entrypoint`
  = **器 pre-existing の 1 件のみ。S3 新規違反ゼロ**（本 wave の変更は全て `apps/soul/agent` の .mjs/.html で
  .ts 限定走査に掛からない）→ **無退行**。
- `pnpm run typecheck`（root `tsc --noEmit`・.ts 対象）→ **RC=0**。
- Gnome の「standalone プローブで .mjs の新規エラーゼロ」主張の裏取り: `cockpit-server.mjs` を standalone
  `tsc --strict --checkJs`（nodenext）で個別走査 → エラー **8 件**、全て既存関数の行
  （`462-467` onVadEvent / `661` serveIndex / `716` broadcastSoulTranscript）。**私が追加した soul ガード(:475)や
  channel 結線行には 1 件も出ていない** → Gnome の「新規エラーゼロ」主張は妥当と確認。

### 4. preflight 再現

- `node scripts/preflight-fire.mjs`（timeout 180）→ `RESULT: PASS` / **EXIT=0**
  （fire→ask→speak→soul recorded・SSE soul(thinking→speaking→idle)+soul transcript 観測・no hang）。
- `node scripts/preflight-cockpit.mjs`（timeout 180）→ `RESULT: PASS` / **exit=0**
  （page/state/devices 応答・`spawn ffmpeg ENOENT` は列挙 200 で吸収・no hang）。

### 5. lockfile 不変・依存不変

- `git diff --stat pnpm-lock.yaml apps/soul/agent/package.json` → **出力なし（差分ゼロ）**。
- `apps/soul/agent/package.json` dependencies = `@anthropic-ai/claude-agent-sdk` `0.3.207` +
  `onnxruntime-node` `1.27.0` のまま（**増減なし**）。

### 6. 既存テスト無変更（新規追加のみ）

- `git diff src/cockpit/cockpit-server.test.mjs` → 単一 hunk `@@ -737,3 +737,160 @@`（context 3 行・追加 160 行・
  **削除ゼロ**）。共有 `makeFakePipeline`（:137-164）は無変更、専用 `makeOnAppendPipeline` を新設。
  既存縦貫通テスト（:679-739）も無変更。→ **既存ケース無変更・新規ケースの追加のみ**を確認。

---

## 差分（要修正）

なし。

## 軽微な指摘（非ブロッキング・任意）

- テストコメントおよび Gnome 記録が実 pipeline の onAppend 購読を「ear-pipeline.mjs:179-181」と書くが、現行行は
  **:184-186**。挙動記述は正確で double の再現も正しいため実害なし。次に触る機会があれば行番号更新が親切。

## 判定

**合格。** 要修正の差分なし。バグ実在（赤 soul=2）と修正有効（緑 soul=1）を退避コピー方式で安全に再現し、
一時操作の痕跡がバイト単位で残っていないことを hash 一致で確認。全機械ゲートが Gnome §4 の生数字と一致。

## 質問

なし。委任スコープ内でレビュー判断が閉じた。Gnome §6 裁量1（Fire ボタン UI gating の見送り・既存
cockpit-page.test の `applySoulState` ピン留めを崩さないための判断）は本 wave のスコープ外の UX 論点であり、
test レーンの合否には影響しない（s3-followup §3-3 に台帳化済み）。UI で明示 disable すべきかは Orch/人間ゲートの判断事項。
