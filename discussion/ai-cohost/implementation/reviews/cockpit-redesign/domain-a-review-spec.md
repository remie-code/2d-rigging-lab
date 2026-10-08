# 操縦席UI改定 Domain A レビュー — spec レーン（設計契約への適合）

> Reviewer: Review-Sylph（spec レーン）。呼び出し元: Orch-Sylph（操縦席UI改定 wave 実行責任者）。**読み取り専任**。
> 日付: 2026-07-14。根拠: 契約文書・対象ファイル・working tree の実物・自分で実行した `node --test`／
> `git diff`／`sha256sum`／`git check-ignore`／3チェック（Gnome の説明ではなく）。
> 契約の正: [../../orchestration/cockpit-redesign-wave-plan.md](../../orchestration/cockpit-redesign-wave-plan.md) §2・§3 Domain A・§4 /
> [../../orchestration/cockpit-redesign-inventory.md](../../orchestration/cockpit-redesign-inventory.md) §1・§2・§4 /
> [../../waves/cockpit-redesign/domain-a.md](../../waves/cockpit-redesign/domain-a.md)（Claim）。
> 対象コミット状態: Domain A は未コミット・working tree に存在（tracked 変更は `.gitignore`+`cockpit-server.mjs` の 2 ファイルのみ・
> `vendor/`・`view-logic/`・`cockpit-static-assets.test.mjs` は未追跡新設）。

## 総合判定: **PASS-with-nonblocking**

wave-plan §4 の blocking 基準 1〜5（Domain A に該当する範囲）はすべて満たす。spec 検証項目 1〜5（逐条照合）
はすべて PASS。L0 裁定済み 3 事項（.gitignore 変更・view-logic 線引き・許可サブツリー方式）の記録の実在も確認した。
domain-a.md §7 の 8 件の §質問はいずれも契約違反ではなく、設計裁量または Domain B/C/D・人間ゲートへの正当な
申し送りと判定（non-blocking）。指摘は「ソース内コメントの行番号 ±1 誤差（1 箇所）」と「`%5C`（バックスラッシュ）
エンコード・トラバーサルのテスト fixture 未固定（ガード自体は机上検証で有効・追加提案）」の 2 点のみで、いずれも
極めて軽微（S7 spec レビューで指摘したような数字の食い違いは今回**ゼロ**——Claim の全数字が自分の再実行と一致した）。

---

## 自分で走らせた生数字（すべて Review-Sylph が実行・タイムアウト付き・空/interrupted なし）

`cd apps/soul/agent && node --test`（全テスト・タイムアウト 300s）:

```
# tests 643
# pass  643
# fail  0
```

→ **Claim（domain-a.md §6）の 643/643/0 と一致**。Orch 確定ベースライン 609 + 34 = 643 の算数とも一致
（実装前 609 そのものは working tree を巻き戻せない読み取り専任の制約上、自分では再実行していない——
Orch 確定値と新規 34 本の実測から照合）。

個別実行（すべて自分で実行）:

```
node --test src/cockpit/cockpit-server.test.mjs        → # tests 74 / pass 74 / fail 0   （無退行の背骨）
node --test src/cockpit/cockpit-page.test.mjs          → # tests 30 / pass 30 / fail 0   （無改変で全緑 = cockpit.html 不改変の証明）
node --test src/cockpit/view-logic/*.test.mjs（6本）    → # tests 28 / pass 28 / fail 0
node --test src/cockpit/cockpit-static-assets.test.mjs → # tests  6 / pass  6 / fail 0
```

ファイル別 `test(` 実数（自分でカウント）: format-time 4 / transcript 4 / markers 5 / ghost 5 / status 7 / usage 3
= **28**・static-assets **6** → **Claim §6 の内訳と完全一致**（S7 で起きた内訳不一致は今回なし）。

**vendor 再計算**（自分で実行）:

```
sha256sum → 72284e8e9079c87817145df1110f74e8a2aa040b2fc384922e18dfcb46fc1fd7   （Claim §2・Orch 確定値と一致）
size      → 13,194 bytes                                                        （Claim §2・inventory §1-1 と一致）
先頭バイト → `var e,n,_,t,o,r,u,l={},…`（minified preact・出所コメントの書き足し**なし**＝凍結無改変）
import 文 → 0 件（bare import ゼロ）
export    → h/html/render/Component/createContext/useState/useReducer/useEffect/useLayoutEffect/useRef/
            useImperativeHandle/useMemo/useCallback/useContext/useDebugValue/useErrorBoundary（hooks 込み）
```

**器不変・契約不変・lockfile 不変**（自分で実行）:

```
git diff --stat（全 tracked 差分）:
  apps/soul/agent/.gitignore                     |  8 +++
  apps/soul/agent/src/cockpit/cockpit-server.mjs | 80 ++++++++++++++++++++++++++
  2 files changed, 88 insertions(+)              ← 挿入のみ・削除 0 行
```

→ tracked 変更はこの 2 ファイルだけ＝器コード（`apps/runtime-player/**`・`packages/**`）・契約 JSON・
`pnpm-lock.yaml`・`apps/soul/agent/package.json`・cockpit.html・cockpit-page.test.mjs・scripts/cockpit.mjs は
**1 バイトも変わっていない**（個別 pathspec でなく全体 diff の空集合で包括的に確認）。未追跡は Claim §5 記載の
3 種（static-assets test・vendor/・view-logic/）+ 別経路の `.tmp/facex-*`・`discussion/.../screens/cockpit-ia-redesign.md`
（不干渉・Claim も不干渉を明記）+ wave 文書自体のみ。

**`git check-ignore -v`（両方・自分で実行）**:

```
apps/soul/agent/src/cockpit/vendor/htm.preact.standalone.mjs → .gitignore:16 `!src/cockpit/vendor/*.mjs`（負規則で追跡可）
apps/soul/agent/vendor/somefile.bin                          → .gitignore:8  `vendor/`（whisper vendor は無視のまま）
```

**構造チェック 3 種**（`node scripts/check-*.mjs`・repo ルート・自分で再実行）:

```
check-dependencies.mjs        → Dependency guard passed. (EXIT=0)
check-soul-zone-boundary.mjs  → 1361 source files scanned; no 器→魂 / 魂→器 imports. (EXIT=0)
check-source-organization.mjs → 唯一の違反: apps/runtime-player/src/main/physiology/index.ts (barrel-only・器側既存赤) (EXIT=1)
```

→ **Claim §5・Orch 確定ベースラインと完全一致**（1361 = 1347 + 新設 14 の算数も一致）。

---

## spec 検証項目（逐条照合・PASS/FAIL + 根拠 file:line)

### 1. vendor 取得記録の検証 — **PASS**

| 検査 | 結果 | 根拠 |
|---|---|---|
| sha256 再計算の一致 | PASS | 自分の `sha256sum` = `72284e8e…46fc1fd7` = Claim §2 = Orch 確定値。 |
| サイズ 13,194B | PASS | 自分の `stat` = 13,194 = Claim §2 = inventory §1-1「生 13,194B」。 |
| 出所コメントの書き足しなし（凍結無改変） | PASS | 先頭 200B が `var e,n,_,t,…`（minified 本体そのまま・注入コメントなし）。Claim §1/§2 の「書き足していない」主張と一致。 |
| bare import ゼロ | PASS | ファイル内 `import` 出現 0 件・`from"…"` 出現 0 件（自分で grep）。 |
| hooks 込み | PASS | `export{…}` に useState〜useErrorBoundary 含む 16 シンボル（自分で grep 抽出）＝inventory §1-1 の列挙と一致。 |
| 取得記録の実在 | PASS | domain-a.md §2 に URL（unpkg htm@3.1.1 ピン）・日時・方法（--compressed なし）・sha256・サイズを記録。preact 10.29.7 が独立検証不可である旨も正直に開示（§7-7）——sha256 がバイトを固定するので spec 上の問題なし。 |

### 2. 静的ルートの契約適合 — **PASS**

`git diff -- apps/soul/agent/src/cockpit/cockpit-server.mjs` を自分で全読した。**+80 行 / −0 行＝追加のみ**。

| 検査 | 結果 | 根拠 |
|---|---|---|
| 既存 16 エンドポイント×13 SSE×6 設定キーのワイヤ契約不変 | PASS | diff の挿入点は (a) import 2 本（`node:path`/`node:url`＝Node 組み込みのみ）、(b) module 定数 `COCKPIT_DIR`/`UI_ASSET_SUBDIRS`、(c) JSDoc 追記、(d) `uiRootPath` option 読み取り、(e) 404 直前の 1 分岐 + `tryServeUiAsset` ヘルパ——の 5 箇所すべて**追加**。既存分岐（cockpit-server.mjs:726-928 の `if (method===… && pathname===…)` 列・snapshot・SSE・serveIndex・設定キー永続化）への変更・削除は**ゼロ**。一次証明: 背骨 74/74 を自分で実行し全緑。 |
| トラバーサル防止（`..`） | PASS | 生 `..` は `new URL(req.url…)`（:726）の WHATWG 正規化で `/vendor/..` → 第一区画がサブツリー外となり**握らず既存 404**。テスト cockpit-static-assets.test.mjs:74-76 が固定 + `createCockpitServer` 文字列の非漏洩を doesNotMatch でアサート。 |
| トラバーサル防止（URL エンコード） | PASS | `%2e%2e` は URL 正規化を通り抜けるが、`tryServeUiAsset` 内の `decodeURIComponent`（不正 % は握らず既存 404 へ）→ `path.resolve`+`path.relative` のルート脱出検査 → **正規化後の第一区画**の許可サブツリー再検査、の三段で弾く。テスト :78-83 が `%2e%2e` の 2 変種（サーバ source 直撃・ルート脱出で package.json）を固定し、source 非漏洩もアサート——L0 裁定 3 の「テスト実在の確認」を満たす。 |
| 許可拡張子 .mjs 固定 | PASS | `resolved.endsWith(".mjs")` 以外は 404。テスト :89-101（`/vendor/cockpit.html`・`/view-logic/format-time.js`）。 |
| ルート配下限定 | PASS | `UI_ASSET_SUBDIRS = {vendor, ui, view-logic}` の許可サブツリー限定（UI ルート直下の cockpit-server.mjs・テスト・settings-store は配らない）。L0 裁定 3 で妥当と裁定済みの方式。 |
| `content-type: text/javascript` | PASS | `text/javascript; charset=utf-8` + `cache-control: no-store`（serveIndex 同型）。テスト :45/:61 が MIME を、:47-49/:62-63 が**ディスク上の実バイトとの完全一致**（凍結 vendor の無改変配信）をアサート。 |
| 既存 404 レスポンス形の不変 | PASS | 握らないパスは `false` 返しで既存 `sendJson(res,404,…)` へ委譲。テスト :117-128 が `/not-an-asset.mjs` の JSON 形（`not found: GET …`）を固定。server test 側の「未知ルート 404」（`/api/nope`）も 643 本の中で無退行。 |

### 3. view-logic 純関数の契約適合 — **PASS**

| 検査 | 結果 | 根拠 |
|---|---|---|
| preact 非依存 | PASS | 6 モジュール本体は **import 文が 1 本も無い**（自分で grep・空出力）。`html`/`render` の参照ゼロ。node:test でブラウザ非依存に回る（制約 b）。 |
| fixture 必須 | PASS | 6 テスト 28 本すべて実在・全読した。すべて入出力の文字列/構造を fixture で固定。 |
| 現 cockpit.html との機能同値 | PASS | 対応表（domain-a.md §4）の全 16 関数を cockpit.html の実際の行と自分で突き合わせた: `pad`:249・`fmtHms`:250-253・`fmtClock`:254-257・`renderUptime` ms 計算:258-261（負クランプなし踏襲・format-time.test.mjs:42 が負値で固定）／`addTranscriptRow`:386-408（speaker 既定 you:388・viewer(名前):396・rowClass:390・latency `!=null`:401-404）／`addFireMarkerRow`:456-457・`addExpressionRow`:474-478・`addVisionMarkerRow`:495-496（width/height 無検査の undefined 劣化まで同値）・`addBargeInMarkerRow`:520-521・`addSelfFireMarkerRow`:539／discard:828・diagnostic 全分岐:832-849・selfFire fired:false:877・chatDiagnostic:888-897／`renderChatStatus`:294-306・`applyChat`:311/:314・`applyChannel`:347-359（idle の末尾スペース `"channel-status "` まで踏襲・status.test.mjs:79）／`applyUsage`:547-554。null/欠落フォールバック（`?`/`unknown`/em-dash `—`）も全一致。 |
| ghost.mjs 意図的非表示リスト | PASS | `diagnosticGhostLabel` は expressionBrokenTag/expressionRejected/expressionSendError→**null**（ghost.mjs:57-58 default・ghost.test.mjs:52-54）。原実装 cockpit.html:850-854 は同 3 種の分岐を持たない＝同値。根拠の page test:244-246（doesNotMatch で分岐非存在を固定）の実在も自分で確認。 |
| bargeIn は専用マーカーへ | PASS | 原実装 :842 `else if (d.type === "bargeIn") addBargeInMarkerRow(d)`。純関数側は `diagnosticGhostLabel({type:"bargeIn"})`→null（ghost.test.mjs:56）+ `bargeInMarkerText`（markers.mjs:57-62）の分業。ghost.mjs ヘッダ :20-21 に「診断ハンドラが先に marker へ分岐する前提」を明記＝Domain B への正しい契約提示。 |
| chatDiagnostic 観測補助 4 種 null | PASS | connected/stopped/ignoredRenderers/listenerError→null（ghost.mjs:77-89 白名簿方式・ghost.test.mjs:77-80）。原実装 :893-894 の白名簿 5 種（notLive/ended/extractFailed/network/internalError）と完全一致。kind 欠落→"?"→白名簿外→null も同値（テスト :81）。 |
| dead の Disconnect 無効 | PASS | `chatStatusView("dead")`→disconnectDisabled:true（status.mjs:32・status.test.mjs:22-28）。原実装 :304-305 と同値。根拠の page test:321 の実在も自分で確認。 |

### 4. blocking 基準（wave-plan §4・Domain A 該当分）の充足 — **PASS**

| 基準 | 判定 | 根拠 |
|---|---|---|
| 1. 器コード・契約 JSON・lockfile・package.json 完全不変・新規 npm 依存ゼロ・ビルド段ゼロ | PASS | `git diff --stat` 全体が `.gitignore`+`cockpit-server.mjs` の 2 件のみ（自分で実行・挿入のみ 88 行）。追加 import は Node 組み込み 2 本だけ。配信は `readFile` の生バイト＝ソース＝実行物（コンパイルなし）。vendor はブラウザ配信のみで実行時依存に非算入。 |
| 2. server test（16+13+6）全緑・既存全テスト緑 | PASS | 74/74（自分で実行）。既存 609 本込みの 643/643 全緑。page test は**書き換えすらせず**無改変 30/30（cockpit.html 不改変ゆえ・書き換えは Domain D 領分）。 |
| 3. view-logic は preact 非依存の純関数 + fixture 必須 | PASS | 検証項目 3 のとおり（import ゼロ・28 fixture）。 |
| 4. 保存チェックリスト全項目の存在・意図的非表示リスト遵守 | PASS（Domain A 該当分） | Domain A の責務は「表示側の固定点」まで。行種 9 つの表示文字列導出 + 意図的非表示 + 状態導出を fixture で固定した。コンポーネント実装での全項目存在は Domain B/C/D の blocking として引き継ぎ。 |
| 5. devDep ゼロ維持・3 チェック無退行・終了処理 | PASS | package.json 不変（linkedom 等なし）。3 チェックを自分で再実行し Claim・ベースラインと完全一致。静的ルートは接続保持なし（readFile→end）・server close 経路に変更なし（テストも finally で close）。 |

### 5. 成果物の主張の正直性 — **PASS（不一致ゼロ）**

- 643/643・74/74・30/30・28+6・内訳（4/4/5/5/7/3）・sha256・13,194B・3 チェック（passed/passed 1361/器側既存赤 1 件）・
  `git status --porcelain -- apps/soul/agent` の 5 行——**すべて自分の再実行・再計算と一致**。
- §7-1（.gitignore 逸脱の明示報告）・§7-7（preact バージョン独立検証不可）は、都合の悪い事実を能動的に開示して
  おり正直性が高い。§5 の「git diff --stat 出力なし」系の主張も pathspec でなく全体 diff で包括確認した。

---

## L0 裁定済み事項の記録実在確認（Orch 指示による確認事項）

1. **.gitignore 変更（承認済み）**: domain-a.md §7-1 に経緯（un-anchored `vendor/`:8 が S2 whisper 用で
   `src/cockpit/vendor/` を巻き込む）・最小修正（負規則 2 行）・**両方の `git check-ignore` 確認**・`git add -f`
   不採の理由（非永続）・逸脱の明示報告が**すべて記録されている**。私も `git check-ignore -v` を両パスで再実行し、
   UI vendor＝追跡可（:16 負規則）・whisper vendor＝無視のまま（:8）を確認。`.gitignore` 差分の 8 行
   （コメント 6 + 負規則 2）も自分で全読——他規則への影響なし。
2. **view-logic の線引き**: §7-2 に列挙 10 群への限定・applySoulState 等 5 関数を B/C 領分として残した判断・
   Domain C への追加抽出の示唆が記録されている。裁定どおり。
3. **許可サブツリー方式**: §7-4 に「UI ルート直下の全 .mjs だとサーバ source を HTTP で漏らす」根拠と方式の記録。
   トラバーサル+漏洩防止のテストは cockpit-static-assets.test.mjs:69-87 に**実在**（doesNotMatch による
   source 非漏洩アサート込み）——レビューの仕事として確認完了。

## §質問（domain-a.md §7）の spec 判定 — いずれも non-blocking

| # | 質問 | spec 判定 |
|---|---|---|
| 1 | .gitignore 変更 | **non-blocking（L0 承認済み）**。記録・両 check-ignore とも実在を自分で確認（上記）。 |
| 2 | view-logic 線引き（applySoulState 等未抽出） | **non-blocking（L0 裁定済み）**。過剰抽出で B/C の職域を侵さない線引きは wave-plan §3 の分業と整合。Domain C レビューで `applySoulState` の純関数化有無を確認事項に。 |
| 3 | `chatDisplayState`/`shouldRestoreChatSource` の追加抽出 | **non-blocking**。cockpit.html:311/:314 との同値を自分で照合済み。明示指定外だが低リスクの純関数追加で、Domain C が必ず使う——正当な裁量。 |
| 4 | 許可サブツリー方式 | **non-blocking（L0 裁定済み・良い設計）**。`ui/` 先行許可により Domain B/C は server 不触で部品を置ける＝ワイヤ契約の凍結が Domain B/C まで続く構造的利点。 |
| 5 | `options.uiRootPath` 新設 | **non-blocking**。既定 `COCKPIT_DIR` で `scripts/cockpit.mjs` 無改変（diff に無いことを全体 diff で確認）。テストは実ツリー配信で強い検証を選んでおり妥当。 |
| 6 | エントリ差し替えは Domain D 領分 | **non-blocking**。cockpit.html 不改変（page test 30/30 無改変緑が証明）。相対 import の許可サブツリー内解決も静的ルートの第一区画検査と整合。 |
| 7 | preact 10.29.7 の独立検証不可 | **non-blocking**。sha256 がバイトを固定。inventory 由来の値と明記する扱いは記録の正直さとして正しい。 |
| 8 | 人間ゲート対象外の明記 | **non-blocking（確認済み）**。vendor 取得 1 回以外の実ネット不出は、テストが実 HTTP（loopback listen(0)）のみでリモート URL を持たないことをソースで確認。 |

---

## blocking / non-blocking の分離

### blocking — **ゼロ件**（wave-plan §4 の Domain A 該当分すべてクリア・上記逐条表参照）

### non-blocking — 2 件（いずれも対処任意）

1. **ソース内コメントの行番号 ±1 誤差**: `transcript.mjs:9` の対応行コメント「:389 `var speaker…`」は実際には
   cockpit.html:**388**（±1）。domain-a.md §4 の対応表自体は `:386-408` のレンジ表記で正確。機能同値の判定には
   無影響で、これらのコメントは Domain D の cockpit.html 書き換え後には歴史的注記になる——修正任意。
2. **`%5C`（バックスラッシュ）エンコード・トラバーサルのテスト fixture が無い**: `/vendor/..%5C..%5Ccockpit-server.mjs`
   等は、win32 の `path.resolve` が `\` をセパレータ扱いするため既存の resolve/relative 脱出検査+第一区画再検査で
   弾かれ、POSIX では `\` がファイル名文字となり readFile 404 に落ちる——**机上検証でガードは両 OS とも有効**。
   ただし現テストは `%2e%2e`（スラッシュ区切り）のみ固定しており、`%5C` 変種を 1 本足すと win32 固有の退行に
   対する保険になる（Domain D のテスト整備時にでも・任意）。

---

## Orch への申し送り

- spec レーンとして Domain A は wave-plan §2/§3 Domain A/§4・inventory §1/§2/§4 の要求を逐条で満たす。
  vendor（sha256/サイズ/凍結無改変/hooks 込み/bare import ゼロ）・静的ルート（追加のみ・三段トラバーサル
  ガード・MIME・許可サブツリー・既存 404 形不変）・view-logic（preact 非依存・16 関数×対応行の機能同値・
  意図的非表示リスト・fixture 28 本）、いずれも自分でソース/diff/実行結果を file:line まで確認した。
- **Claim の全数字が自分の再実行と一致**（643/643・74/74・30/30・28+6・sha256・13,194B・3 チェック・1361 files）。
  S7 レビューで見つけた種類の内訳不一致は今回ゼロ——成果物の正直性は高い。
- ベースライン 609 のみ自分では再実行していない（読み取り専任で working tree を巻き戻せないため）。
  Orch 確定値 609 と実測 +34 の算数一致（609+34=643）で照合した。
- Domain B/C レビューへの引き継ぎ推奨: (a) SSE ハンドラ移植時に「diagnostic は type=="bargeIn" を**先に**
  marker へ分岐してから `diagnosticGhostLabel` に渡す」前提（ghost.mjs:20-21 の契約）が守られているか、
  (b) `ui/*.mjs` が view-logic を呼ぶ薄い層に留まり表示文字列導出を再実装していないか、(c) `applySoulState` 等
  B/C 領分 5 関数の純関数化の扱い（§7-2 の示唆どおり view-logic へ足すか component 内に置くか）。
- Domain D への引き継ぎ: page test 書き換え時に non-blocking 2（`%5C` トラバーサル fixture）の追加を検討。
