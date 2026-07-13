# S7 Domain A レビュー — spec レーン（設計契約への適合）

> Reviewer: Review-Sylph（spec レーン）。呼び出し元: Orch-Sylph。**読み取り専任**。
> 日付: 2026-07-14。根拠: 契約文書・対象ファイル・working tree の実物・自分で実行した `node --test` と
> `git diff --stat`（Gnome の説明ではなく）。
> 契約の正: [../../orchestration/s7-wave-plan.md](../../orchestration/s7-wave-plan.md) §1・§2・§3 Domain A・§4 /
> [../../orchestration/s7-planning-inventory.md](../../orchestration/s7-planning-inventory.md) §2-2・§2-4・§3-1 /
> [../../waves/s7/domain-a.md](../../waves/s7/domain-a.md)（Claim）。
> 対象コミット状態: S7 Domain A は未コミット・working tree に存在（`apps/soul/agent/src/chat/` は未追跡新設）。

## 総合判定: **PASS-with-nonblocking**

wave-plan §4 の blocking 基準 1〜5（Domain A に該当する範囲）はすべて満たす。spec 検証項目 1〜5（逐条照合）
はすべて PASS。domain-a.md §7 の 8 件の §質問はいずれも契約違反ではなく、設計裁量または Domain B/C・
人間ゲートへの正当な申し送りと判定（non-blocking）。ただし domain-a.md §1・§6 のファイル別テスト内訳
（22 本/21 本）は実測（25 本/18 本）と食い違っており、非 blocking の記載精度問題として指摘する（後述）。

---

## 自分で走らせた機械ゲート生数字

`cd apps/soul/agent && node --test`（Review-Sylph が実行・タイムアウト 300s・空/interrupted なし・1 回で成功）:

```
# tests 561
# suites 0
# pass 561
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 1341.6406
```

→ **Claim（domain-a.md §6）の 561/561/0 と一致**。

新設 chat テストのみの実行でも確認:

```
node --test src/chat/innertube.test.mjs src/chat/live-chat-client.test.mjs
# tests 43 / pass 43 / fail 0
```

→ **43/43 で claim の「+43」と一致**。ただし claim（domain-a.md §1・§6）はこれを
「innertube.test.mjs 22 本 + live-chat-client.test.mjs 21 本 = 43」と内訳しているが、
自分で `test(` 出現数を数えると **innertube.test.mjs は 25 本・live-chat-client.test.mjs は 18 本**
（25+18=43 で合計は一致するが内訳が違う）。合計と実行結果の一致は問題ないが、ファイル別内訳の記載は
不正確——non-blocking（後述）。

**器不変・契約不変・lockfile不変の検証**（Review-Sylph が自分で実行）:

```
git diff --stat -- apps/runtime-player packages              → 出力ゼロ
git diff --stat -- pnpm-lock.yaml apps/soul/agent/package.json → 出力ゼロ
git diff --stat -- '*channel-*-contract*'                     → 出力ゼロ
git diff --stat（全tracked差分）                                → 出力ゼロ（tracked ファイルは1バイトも変更なし）
git status --porcelain -- apps/soul/agent                      → "?? apps/soul/agent/src/chat/"（新設のみ）
```

repo 全体の `git status --porcelain` も自分で確認: 未追跡は `.tmp/facex-*`（別セッション領分・触れず）・
`apps/soul/agent/src/chat/`（本 Domain の新設）・`discussion/ai-cohost/implementation/waves/s7/`（claim
文書自体）の3種のみ。**tracked ファイルの変更はゼロ**（`git diff --stat` 全体が空出力）——器コード・
契約 JSON・lockfile はもちろん、transcript-buffer.mjs / fire-injection.mjs / fire-scheduler.mjs /
cockpit-server.mjs / cockpit.html など Domain B/C 領分のファイルにも一切触れていないことを確認した。

**構造チェック 3 種**（`node scripts/check-*.mjs`・repo ルートで実行、自分で再実行）:

```
check-dependencies.mjs         → Dependency guard passed. (EXIT=0)
check-soul-zone-boundary.mjs   → 1347 source files scanned; no 器→魂 imports and no 魂→器 code imports. (EXIT=0)
check-source-organization.mjs → 唯一の違反: apps/runtime-player/src/main/physiology/index.ts (barrel-only 違反) (EXIT=1)
```

→ **claim（domain-a.md §5）の記述と完全一致**（1347 files・唯一の違反ファイルも一致）。
`check-source-organization.mjs` の違反はブランチ既存ベースライン（`.ts` のみ検査・新設は全て `.mjs`）で
本 Domain のスコープ外——無退行。

**独立性（import ゼロ）を自分でソースから確認**（テストの自己申告に頼らない二重チェック）:

- `innertube.mjs`: `import`/`from` 文が**1つも無い**（依存ゼロ・Node グローバル fetch/URL のみ使用）。
- `live-chat-client.mjs`: `from "./innertube.mjs"` の1本のみ。
- `../` を含む import は `src/chat/` 配下のどのファイル（テスト含む）にも存在しない。
- `readFileSync`/`fs.`/`process.env` 等のディスク・環境アクセスは `innertube.mjs`/`live-chat-client.mjs`
  のいずれにも存在しない（`readFileSync` はテストの独立性自己検証にのみ使用）。

---

## spec 検証項目（wave-plan §3 Domain A・inventory §2-2/§2-4/§3-1 への逐条照合・PASS/FAIL + 根拠）

### 1. 取得経路の仕組みが inventory §2-2 の記述通りか — **PASS**

- GET watch ページ → 4 点抽出 → POST get_live_chat を continuation で回す構造を実装で確認:
  - `normalizeSource`（`innertube.mjs:52-103`）: source 正規化。
  - `extractBootstrap`（`innertube.mjs:216-255`）: ytcfg 正規表現（apiKey/clientVersion, :221-224）+
    `extractInitialData`（ブレース走査による `ytInitialData` 切り出し, :153-174）+
    `readLiveChatBootstrap`（`liveChatRenderer.continuations[0]` から continuation 抽出, :181-204）。
  - `fetchWatchPage`（:427-443）が GET、`fetchLiveChat`（:456-481）が
    `POST youtubei/v1/live_chat/get_live_chat?key=<apiKey>` で `{context:{client},continuation}` を送る
    ——inventory §2-2 の仕組み記述と file:line レベルで一致。
  - continuation ループ: `parseLiveChatResponse`（:361-415）が次 continuation + timeoutMs を返し、
    `live-chat-client.mjs` の `runPoll`（:291-337）が `continuation` を更新して `scheduleNextPoll`
    （:218-227, timeoutMs 尊重）でループを回す。
- renderer 解析: `parseMessageItem`（`innertube.mjs:296-344`）で
  `liveChatTextMessageRenderer` を一級（:300-317）、`liveChatPaidMessageRenderer` は本文あれば同格
  （:320-339, 本文なしは `ignored`）、その他は `ignored`＋種別名（:342-343）——inventory §2-2「renderer
  解析」の記述と完全一致。テストでも `text と paid（本文あり）を配信し、無視種別は ignoredRenderers 診断へ`
  （`live-chat-client.test.mjs:175-197`）で3分岐を縦貫通固定。

### 2. 配信特定と境界挙動が §2-4 通りか — **PASS**

- 受理形: 素の video ID（`innertube.mjs:59-61`）・`youtube.com/watch?v=`（:85-88）・`youtu.be/<ID>`
  （:71-77）・`youtube.com/channel/<ID>/live`（:90-94）——inventory §2-4「video ID手入力」「チャンネル
  URLからの自動検出」の両方を受理。`normalizeSource: watch URL / youtu.be / channel /live を受理`
  （`innertube.test.mjs:42-55`）で固定。
- 開始前（notLive）・終了後（ended）の明確な区別: `extractBootstrap` は `liveChatRenderer` 不在または
  `isReplay=true` を `notLive` として返す（:241-243, 実体は `readLiveChatBootstrap` :185-201）。
  `parseLiveChatResponse` は次 continuation が取れない場合を `ended` として返す（:391-394, 393行目
  message="no next continuation token (chat ended)"）。`live-chat-client.mjs` はこの2種を明確に
  別状態へ落とす: notLive → `retrying`（`scheduleReconnect("notLive", ...)`, :268-269 = 待ち続ける）、
  ended → `dead`（:311-315 = 終端・タイマ全撤去・以後再接続なし）。
  テスト: `client: notLive（未開始）は retrying で待ち、開始したら live に上がる`
  （`live-chat-client.test.mjs:243-255`）・`client: 配信終了（次 continuation なし）は dead に落ち、
  タイマを残さない`（:259-280, `clock.pending()===0` を追加 advance 後も再確認）——inventory §2-4
  「開始前・終了後は明確なエラー形」の要求を状態機械レベルで固定している。

### 3. §3-1 の実装形が守られているか — **PASS**

- onMessage が渡す形（`live-chat-client.mjs:324` の `emitGuarded(messageListeners, {...msg, videoId,
  receivedAtMs}, "message")`）は `parseMessageItem` が返す `{text, displayName, messageId, kind,
  timestampUsec, channelId}` を継承——**text/displayName を含み**、viewer 合流（Domain B の
  `buffer.append({startMs:0, endMs:0, text, speaker:"viewer", displayName})`）にそのまま渡せる形。
- soul 先例（startMs/endMs=0,0・appendedAtMs 窓）への適合: この器官自体は transcript-buffer に触れない
  （Domain B の責務・plan §3 Domain A に明記のとおり）が、onMessage のペイロードに VAD 由来の時刻情報を
  一切含まない設計（`receivedAtMs` のみ）は、Domain B が `startMs/endMs=0,0` で append する前提と矛盾しない。
  domain-a.md §7-1 で Domain B への申し送りとして正しく明記されている。

### 4. blocking 基準（wave-plan §4）の充足 — **PASS**（Domain A 該当分すべて）

1. 器コード・契約 JSON・lockfile 完全不変・新規依存ゼロ: 上記「自分で走らせた機械ゲート生数字」節で
   `git diff --stat` 全出力ゼロを確認。`innertube.mjs` に import 文が皆無、`live-chat-client.mjs` は
   `./innertube.mjs` のみ import——素の fetch/Node 組み込み以外の依存はゼロ。
2. 機械テストは実ネットワークに出ない: `innertube.test.mjs`/`live-chat-client.test.mjs` を通読した限り、
   すべての HTTP 呼び出しテストは `fetchImpl` 注入（`makeFakeFetch`, `live-chat-client.test.mjs:72-97`、
   および `innertube.test.mjs:230-275` の inline fake）を経由しており、`globalThis.fetch` や実 URL への
   到達点は存在しない。fixture（`fixtures-innertube.mjs`）も「実ページ由来のバイト列ではない」ことが
   ヘッダコメント（:1-19）に明記され、実際に手書き合成の構造であることをソースで確認した。
3. 器官の独立性（`../` import なし）と壊れ方全分類の固定: 上記「独立性」節で自分のソース読解により
   二重確認済み。壊れ方全分類（extractFailed/notLive/ended/network + バックオフ遷移 + stop() +
   フック throw 握り）は `live-chat-client.test.mjs` の各テストで個別に固定されている（§4 節で後述）。
   「器官が死んでも魂の動作に影響しない」は、Domain A の時点では合流点（Domain B）がまだ存在しないため
   **構造的独立性（import ゼロ）＋器官自身が例外を外へ漏らさない**（`start()` が reject しない・
   `onMessage`/`onStatus`/`onDiagnostic` の throw がすべて `emitGuarded`/`emitDiagnostic` で握られる、
   `launch()` の内部 try/catch で想定外例外も `internalError` 診断に落ちる）という2点で担保されており、
   Domain A のスコープとしては妥当な検証範囲（統合レベルの「魂への無影響」検証は Domain B の責務）。
5. 3チェック無退行・SDK実消費ゼロ: 上記で自分が再実行し確認済み。この器官は LLM/SDK に一切触れない
   （ソースに SDK 関連 import なし）。

### 5. 成果物の主張の正直性 — **PASS（軽微な記載不正確を除く）**

- 561/561 は自分の実行で再現・一致。
- 器コード・契約 JSON・lockfile 完全不変は自分の `git diff --stat` で確認済み（出力ゼロ）。
- 3チェック結果（passed/passed/唯一の違反ファイル）はすべて自分の再実行と一致。
- **不一致点**: domain-a.md §1 の表と §6 の内訳「innertube.test.mjs 22 本 + live-chat-client.test.mjs
  21 本」は実測 25 本・18 本と異なる（合計 43 は一致）。数字の捏造ではなく、テストの追加・整理の過程で
  内訳表記が更新されなかったための記載ミスと見られる（total の 561/561・+43 という判定に使う数字は
  正しい）——non-blocking（後述）。

---

## §質問（domain-a.md §7）の spec 判定 — いずれも non-blocking

| # | 質問 | spec 判定 |
|---|---|---|
| 1 | onMessage が渡す形（text/displayName、時刻軸は appendedAtMs 窓） | **non-blocking**。§3-1 の要求と実装が一致していることを上記「spec検証項目3」で確認済み。Domain B の具体的な append 呼び出し設計への申し送りとして正当。 |
| 2 | ended→dead は終端・再接続しない、別配信への繋ぎ直しは新規インスタンス | **non-blocking**。plan §3「配信は同じ video ID で終了後に復活しない」という前提はビジネスロジックとして妥当であり、v0 で `restart()` を作らない判断は過剰実装を避けた妥当な範囲。要否を Domain C に委ねるのは正しい分業。 |
| 3 | notLive は retrying で待ち続ける（上限なしポーリング） | **non-blocking**。wave-plan §3「自動再接続（バックオフ+上限なし）」の明文裁定どおり。cockpit の状態表示（Domain C）への申し送りは適切。 |
| 4 | videoId 抽出優先順位（channel /live 経路のみ実ページ依存） | **non-blocking**。機械テストは合成 fixture でこの経路も固定済み（`extractBootstrap: knownVideoId 無しでも...watchEndpoint から videoId を得る`, `innertube.test.mjs:90-95`）。実 HTML スキーマの一致確認は人間ゲートの領分として正しく開示。 |
| 5 | リクエストヘッダ最小・cookie/consent 未対応 | **non-blocking**。機械ゲートの対象外（実ネット到達なし）。実疎通で必要になれば followup 台帳に足す設計——器官内で完結する変更（fetchWatchPage のヘッダのみ）であり、器官独立性を損なわない。 |
| 6 | 公式 API キー経路への差し替え（followup） | **non-blocking**。純部品層（`fetchWatchPage`+`extractBootstrap`+`fetchLiveChat`+`parseLiveChatResponse`）で抽象化されており、client の状態機械は不変で流用できるという claim は、実際に `live-chat-client.mjs` がこれら4関数のみを `innertube.mjs` から import している構造（:40-47）から裏付けられる。inventory §5 裁定と整合。 |
| 7 | paid（スーパーチャット）を text と同格に拾う裁定 | **non-blocking**。inventory 裁定3「単一タイムライン・箱を分けない」と一致。金額を onMessage に載せない v0 判断も、必要なら足せる設計（`paidRenderer.purchaseAmountText` はソース中で読んでいないが取得元 JSON には存在するため拡張は容易）——Domain B/C への正当な申し送り。 |
| 8 | 実マイク・録音物・実配信は非使用の規律明記 | **non-blocking（確認済み）**。自分のソース通読・grep で実ネットワーク到達点ゼロを確認済み（上記）。 |

---

## blocking / non-blocking の分離

### blocking（wave-plan §4・Domain A 該当分）— すべてクリア

| 基準 | 判定 | 根拠 |
|---|---|---|
| 1. 器コード・契約JSON・lockfile完全不変・新規依存ゼロ | PASS | `git diff --stat` 3種＋全体差分すべて出力ゼロ（自分で実行）。import 文はソースで直接確認（innertube.mjsはゼロ、live-chat-client.mjsは`./innertube.mjs`のみ）。 |
| 2. 機械テストは実ネットワークに出ない | PASS | 全テストが `fetchImpl` 注入経由。fixture は手書き合成であることをヘッダコメントとソース双方で確認。 |
| 3. 器官の独立性・壊れ方全分類の固定・器官が死んでも魂に無影響（構造で担保） | PASS | `../` import ゼロを自分で grep 確認（テストの自己申告に加えて独立検証）。壊れ方4分類（extractFailed/notLive/ended/network）+ バックオフ + stop() + フックthrow握りが各テストで個別固定。 |
| 4. スケジューラ拡張（Domain B/C領分） | N/A | Domain A はスケジューラを実装しない。 |
| 5. 3チェック無退行・SDK実消費ゼロ・終了処理 | PASS | 自分で3チェックを再実行し claim と完全一致。SDK関連import なし。`stop()`のタイマ全撤去をテストで確認済み。 |

### non-blocking

- domain-a.md §7 の8件の§質問（上表参照）——いずれも設計裁量またはDomain B/C・人間ゲートへの正当な申し送り。
- domain-a.md §1・§6 のファイル別テスト内訳「22本+21本」が実測「25本+18本」と食い違う（合計43は一致）。
  数字の捏造ではなく記載更新漏れと見られるが、今後の成果物では `test(` 実数をそのまま転記することを推奨。

---

## Orch への申し送り

- spec レーンとして S7 Domain A は wave-plan §3 Domain A・inventory §2-2/§2-4/§3-1 の要求を逐条で満たす。
  取得経路の仕組み（4点抽出→continuationループ→renderer解析）・配信特定と境界挙動（notLive/ended の
  明確な区別）・onMessage の実装形・器官の独立性（import ゼロ・実ネット非到達）、いずれも自分でソースを
  file:line レベルまで読んで確認した（Gnomeの説明への依存を避けるための最も強い検証）。
- 561/561・+43・3チェック結果・`git diff --stat` 空出力は自分の再実行ですべて一致を確認した。
- 唯一の記載不正確（ファイル別テスト内訳）は数字の信頼性を損なう捏造ではなく、blocking 判定には影響しない。
- 器官はこの時点で合流点（Domain B）を持たないため、「死んでも魂に無影響」の検証は構造的独立性＋器官
  自身の例外非漏洩という Domain A のスコープで妥当な範囲にとどまる。統合レベル（実際に buffer/scheduler
  と繋いだ状態での耐障害性）の検証は Domain B の blocking 基準として引き継がれるべき事項——Domain B の
  レビューで「チャット器官の死（notLive/ended/network等）が buffer.append や発火に悪影響を与えない」ことを
  明示的にテストで固定しているか確認することを推奨する。
