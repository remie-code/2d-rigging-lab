# S7 Domain A: チャット器官（`src/chat/`・独立器官・YouTube Live チャット取得）

> Status: 実装完了・機械ゲート緑（2026-07-14）。実疎通（実配信での取得・コメント拾って返す）は
> 人間ゲートに持ち越し（wave-plan §1・§5）——機械テストは実ネットワークに一切出ない規律のため、
> 実 YouTube への HTTP は本 Domain では一切踏んでいない（fake fetch のみ）。
> 担当: Gnome（Orch-Sylph 委任）。対象パッケージ: `apps/soul/agent`（独立 npm・workspace glob 外＝lockfile 不変）。
> 契約の正: [../../orchestration/s7-wave-plan.md](../../orchestration/s7-wave-plan.md) §3 Domain A /
> [../../orchestration/s7-planning-inventory.md](../../orchestration/s7-planning-inventory.md) §2-2・§2-4・§3-1。

## 0. パイプライン（この Domain が敷いた線）

```
createLiveChatClient({ source, fetchImpl?, nowImpl?, setTimeoutImpl?, clearTimeoutImpl?, rng?, ... })
  │  source = watch URL / video ID / チャンネル /live URL
  │
  ├─ start() ─▶ [connecting] GET watch ページ ──▶ extractBootstrap(HTML)
  │                                                  4 点抽出: apiKey / clientVersion / continuation / videoId
  │                                                  ├ 4 点欠落 ────────────▶ extractFailed → [retrying]（バックオフ再接続）
  │                                                  ├ liveChatRenderer 不在/isReplay ─▶ notLive → [retrying]（待ち続ける）
  │                                                  └ 成功 ────────────────▶ [live]
  │
  └─ [live] POST youtubei/v1/live_chat/get_live_chat?key=<apiKey>  { context:{client}, continuation }
              │  ループ: parseLiveChatResponse(JSON)
              │    ├ 次 continuation なし / continuationContents 欠落 ─▶ ended → [dead]（終端・再接続しない）
              │    ├ JSON 非オブジェクト（スキーマ全崩れ）───────────▶ extractFailed → [retrying]
              │    ├ fetch 失敗 / HTTP 非 2xx ────────────────────────▶ network → [retrying]
              │    └ 成功 ─▶ actions を解析:
              │                liveChatTextMessageRenderer  ─▶ onMessage({ text, displayName, kind:"text", ... })
              │                liveChatPaidMessageRenderer  ─▶ 本文あれば onMessage(kind:"paid") / なければ ignored
              │                その他 renderer ─────────────▶ onDiagnostic(ignoredRenderers)
              │       timedContinuationData.timeoutMs を尊重して次 poll をスケジュール（無ければ v0 定数・床 POLL_FLOOR_MS）
              │
  フック: onMessage / onStatus / onDiagnostic（**throw は器官が握る**＝常駐を殺さない）
  stop() ─▶ [dead]（タイマ全撤去・以後の自動再接続なし）
```

- この器官は**独立**（耳・目と同格）。魂の他部位（`../ears/**`・`../mind/**` 等）への import は 1 つも無い。
  合流（転写バッファへの append・発火結線）は **Domain B が onMessage フック経由で外から**行う——この器官からの
  逆流路は存在しない。ディスク書き込みも無い。「壊れても魂に無影響」を **import ゼロ**（構造）とテストで固定した。

## 1. 実装/変更ファイル一覧

| ファイル | 種別 | 役割 |
|---|---|---|
| `src/chat/innertube.mjs` | 新規 | innertube 経路の**純部品**。source 正規化・HTML 4 点抽出（ブレース走査で ytInitialData を切り出し）・get_live_chat レスポンス解析（continuation/timeoutMs/messages/ignored）・renderer 解析（text/paid/無視）・fetch ラッパ（fetchImpl 注入）。状態も常駐も無い。依存ゼロ（import 文なし）。 |
| `src/chat/live-chat-client.mjs` | 新規 | **器官本体**。状態機械（idle/connecting/live/retrying/dead）・自動再接続（バックオフ・上限なし）・エラー分類（notLive/ended/extractFailed/network）・フック（onMessage/onStatus/onDiagnostic・throw 握り）。import は `./innertube.mjs` のみ（魂他部位ゼロ）。 |
| `src/chat/fixtures-innertube.mjs` | 新規 | **手書き合成 fixture**。watch ページ HTML（生きた配信/未開始/リプレイ/キー欠落）・get_live_chat レスポンス builder（text/paid/無視 action・終了シグナル）。実ページ由来のバイト列は一切持たない（inventory §2-2 の仕組み記述 + youtube-chat 系 OSS 公開情報から合成）。 |
| `src/chat/innertube.test.mjs` | 新規 | 純部品の決定論テスト（fetchImpl 注入・fixture）。25 本。 |
| `src/chat/live-chat-client.test.mjs` | 新規 | 器官のライフサイクル決定論テスト（fake fetch + fake clock + 定数 RNG）。壊れ方全分類（想定外の内部例外の catch-all 自動再接続を含む）・フック throw 握り・独立性（import ゼロ）の構造テスト含む。20 本。 |

**器コード（`apps/runtime-player/**`・`packages/**`）・契約 JSON・`pnpm-lock.yaml`・`apps/soul/agent/package.json`
は完全不変**（§5 の `git diff --stat` で確認・新規依存ゼロ＝素の fetch（Node 18+ グローバル）+ Node 組み込みのみ）。
変更は `apps/soul/agent/src/chat/**` の新設のみ（scope 内・既存ファイルは 1 バイトも触っていない）。

## 2. 純部品の契約（引数・戻り値・失敗の扱い）— `innertube.mjs`

すべて**投げずに判別可能な戻り値**で返す（window-list.mjs の `{...} | {error:{kind,message}}` 流儀）。
`network` だけは fetch ラッパが throw し、上位（client）が握って分類する。

### `normalizeSource(source)`
```
→ { kind: "watch"|"channel"; url: string; videoId: string|null }
| { error: { kind: "extractFailed"; message } }
```
- 受理: 素の video ID（`[A-Za-z0-9_-]{11}`）・`youtube.com/watch?v=<ID>`・`youtu.be/<ID>`・`youtube.com/channel/<ID>/live`。
- channel /live は videoId 未知（`null`）＝watch ページ側で canonical を追う前提。非対応 shape は extractFailed で正直に返す。

### `extractBootstrap(html, { knownVideoId? })`
```
→ { apiKey, clientVersion, continuation, videoId }
| { error: { kind: "extractFailed"|"notLive"; message } }
```
- apiKey/clientVersion は ytcfg 断片の正規表現（`INNERTUBE_API_KEY` / `INNERTUBE_CONTEXT_CLIENT_VERSION`、後者欠落時は `clientVersion` にフォールバック）。
- continuation は `ytInitialData` を**ブレース走査で切り出して** JSON.parse し、`conversationBar.liveChatRenderer.continuations[0]` の reload/invalidation/timed いずれかから取る。
- **notLive 判定**: liveChatRenderer 不在（conversationBarRenderer の不可用メッセージ）/ `isReplay=true`（終了配信のリプレイ）/ 初期 continuation 欠落。
- videoId は knownVideoId 優先 → `currentVideoEndpoint.watchEndpoint.videoId` → HTML 正規表現の順。
- ブレース走査（`sliceBalancedObject`）は文字列状態・`\` エスケープを追うので、`}` を含む文字列やネストを跨いで確実に閉じを見つける（貪欲/怠惰 regex では取り切れない実ページ対策）。

### `parseLiveChatResponse(json)`
```
→ { continuation: string; timeoutMs: number|null; messages: ChatMessage[]; ignored: string[] }
| { error: { kind: "ended"|"extractFailed"; message } }
```
- `continuationContents.liveChatContinuation` を辿る。**次 continuation が取れなければ ended**（＝ポーリング継続不能＝チャット終了）。`continuationContents` ごと欠落も ended。
- `json` が非オブジェクトは extractFailed（スキーマ全崩れ）。
- **actions が空（新着なし）は正常**＝`messages: []`（エラーにしない）。ここが「壊れ方」と「健全な無音ポール」の分水嶺。
- timeoutMs は数値/数値文字列を吸収、無ければ null（client が v0 定数へフォールバック）。

### `parseMessageItem(item)` / `joinRuns(runs)`
- `liveChatTextMessageRenderer` を**一級**（`message.runs` 結合 + `authorName.simpleText`）。
- `liveChatPaidMessageRenderer` は**本文があれば同格**に拾う（`kind:"paid"`）、本文なし（金額のみ）は `ignored`。
- その他 renderer は `ignored`（種別名を返す→診断へ）。
- `joinRuns`: text run 結合。emoji は unicode（`emojiId` が絵文字そのもの）ならその文字、カスタム絵文字は `shortcuts[0]`。

### fetch ラッパ（`fetchWatchPage` / `fetchLiveChat`）
- fetchImpl 注入。非 2xx は throw（上位が network 分類）。fetchLiveChat は `key` をクエリに、`{ context:{ client:{ clientName:"WEB", clientVersion, hl, gl } }, continuation }` を本文に POST。
- **v0 は非公式 innertube 経路のみ**。公式 API キー実装への差し替えは器官内で完結する梯子（followup・今回未実装・§6）。

## 3. 状態機械とエラー分類 — `live-chat-client.mjs`

### 状態（getState / onStatus・変化時のみ通知）
| 状態 | 意味 | 遷移元 |
|---|---|---|
| `idle` | start() 前（生成直後） | 初期 |
| `connecting` | watch 取得 + 4 点抽出中 | start() / 再接続タイマ発火 |
| `live` | get_live_chat ポーリング中（continuation ループ） | bootstrap 成功 / poll 成功 |
| `retrying` | 回復可能障害でバックオフ再接続待ち（**上限なし**） | network / notLive / extractFailed |
| `dead` | 終端（以後の自動再接続なし） | ended / stop() |

- **notLive（未開始）は retrying＝待ち続ける**、**ended（終了）は dead＝終端**で明確に区別（inventory §2-4「開始前・終了後は明確なエラー形」を状態に落とした）。配信は同じ video ID で終了後に復活しないため ended は終端が正しい。

### エラー分類（onDiagnostic の `info.kind`）
| kind | 意味 | 帰結 |
|---|---|---|
| `notLive` | 配信未開始 / canonical 不在 / isReplay | retrying（待つ） |
| `ended` | 配信終了（次 continuation なし） | dead |
| `extractFailed` | 4 点抽出失敗・レスポンススキーマ全崩れ・source 不正 | retrying（診断を出し続ける＝観測可能な死） |
| `network` | fetch 失敗 / HTTP 非 2xx / リクエストタイムアウト | retrying |
| `listenerError` | フック（onMessage/onStatus）の throw | 握って常駐継続 |
| `ignoredRenderers` / `connected` / `stopped` / `internalError` | 観測補助の診断 | — |

- **バックオフ**: `base * 2^attempts`（cap で頭打ち・既定 base=1000 / cap=30000ms）+ `[0,20%)` ジッター（注入 rng・既定 Math.random）。attempts は **bootstrap 成功・poll 成功でリセット**。リトライ回数上限は無し（plan「上限なし」）。
- **リクエストタイムアウト**: 各 fetch を AbortController + 注入 setTimeout で有界化（既定 15000ms・whisper-client 流儀）。finally で必ず clear（イベントループに残さない）。
- **フック throw 握り**: onMessage/onStatus の throw は `listenerError` 診断に落として飲む。onDiagnostic 自身の throw は（診断の診断でループを避けるため）握るだけ。
- **想定外の内部例外は沈黙凍結させず自動再接続（最終防波堤）**: 各段の try/catch で握られなかった内部例外（例: try/catch 外で呼ぶ `extractBootstrap`/`parseLiveChatResponse` の想定外 throw）が `launch()` の catch-all に落ちたら、`internalError` 診断を出した上で**終端（dead/stopped）でなければ `retrying` に落として bootstrap から自動再接続**する（extractFailed 扱い・バックオフ attempts を進める＝無限タイトループにしない）。状態を偽って `live`/`connecting` のまま黙って凍る穴を塞ぐ（inventory §2 裁定 2「壊れたら診断＋器官内自動再接続」）。

## 4. テストで固定した壊れ方 全分類（fake fetch のみ・実ネット不出）

| 分類 | テスト | 固定した挙動 |
|---|---|---|
| 4 点抽出成功 | `extractBootstrap: 生きた配信 HTML から 4 点を抽出` / client happy path | 合成 watch HTML → apiKey/clientVersion/continuation/videoId |
| continuation ループ | `bootstrap で live に上がり…ページを跨いでメッセージを配信` | 複数ページ JSON fixture・continuation 前進・timeoutMs 尊重（`nextDelay()==5000`） |
| timeoutMs 欠落/床 | `timeoutMs 欠落時は defaultPollIntervalMs、床 POLL_FLOOR_MS を下回らない` | 欠落→default / 極小→床に持ち上げ |
| renderer 分岐 | `text と paid（本文あり）を配信し、無視種別は ignoredRenderers 診断へ` | text/paid 一級・本文なし paid と membership は ignored |
| 抽出失敗（HTML に 4 点なし） | `4 点抽出失敗は retrying…再接続で回復` | extractFailed → retrying → バックオフ後 live |
| スキーマ変化（レスポンス全崩れ） | `get_live_chat が JSON オブジェクトでない…extractFailed → retrying` | 非オブジェクト JSON → extractFailed → retrying |
| スキーマ耐性（継続あり・新着なし） | `継続はあるが actions が空（新着なし）は healthy＝live 継続` | 空 actions は死ではなく健全な無音ポール |
| notLive（未開始/リプレイ） | `notLive（未開始）は retrying で待ち、開始したら live に上がる` / extractBootstrap 系 | notLive → retrying（待つ）→ 開始で live |
| ended（配信終了） | `配信終了（次 continuation なし）は dead に落ち、タイマを残さない` | ended → dead・pending timer 0・再 advance で復活しない |
| ネットワーク死（fetch reject） | `bootstrap の fetch 失敗は network → retrying` / `poll 中の fetch 失敗も…` / `HTTP 非 2xx も network` | fetch reject/非2xx → network → retrying → 回復 |
| 想定外の内部例外（catch-all 最終防波堤） | `parse が想定外 throw（try/catch 外の内部例外）でも沈黙凍結せず internalError 診断 → retrying → 再接続で回復` / `poll 進行中に stop() が割り込み、その後 catch-all に想定外 throw が落ちても終端のまま再接続しない` | `parseLiveChatResponse` が try/catch 外で throw → `launch()` の catch-all が internalError 診断＋retrying へ落として自動再接続（沈黙凍結を防ぐ・**true 分岐**）／後者は deferred fetch で「poll の await 中に stop()（stopped=true・state=dead）→ その後 boom 解決で throw」を実際に踏ませ、catch-all 末尾ガード `if (!stopped && state !== "dead")` の **false 分岐**（終端では再接続しない）を実行を伴って固定する |
| バックオフ遷移 | `連続失敗でバックオフが base→2x→4x と増え、cap で頭打ち` | rng=0 で `[1000,2000,4000,4000]` を固定 |
| stop() | `stop() で dead・タイマ全撤去・再ポーリングなし` | dead・pending 0・以後メッセージ来ない |
| フック throw 握り | `onMessage が throw しても…常駐は続く` / `onStatus / onDiagnostic の throw も…漏れない` | listenerError 診断・start() が reject しない・状態 live 維持 |
| 独立性（構造） | `chat 器官のソースは魂の他部位（親ディレクトリ）を import しない` | 器官 2 ファイルの相対 import が `./`（同ディレクトリ）のみであることを機械照合＝`../` ゼロ |

- 決定論の担保: 時計（nowImpl）・タイマ（setTimeoutImpl/clearTimeoutImpl）・RNG（rng）・fetch（fetchImpl）を**全注入**。
  fake clock は fire-scheduler.test.mjs のネスト scheduling 対応版を写経、fake fetch は whisper-client.test.mjs の注入流儀を写経。
- `client.idle()`（進行中サイクルの settle 待ち）を器官に持たせ、`advance(delay); await idle()` で poll 1 周期を決定論的に駆動できる（prod では無害な内省補助）。

## 5. 器不変・依存ゼロ・チェック無退行の確認（このセッション実行）

```
git diff --stat -- apps/runtime-player packages              → 出力なし（器コード不変）
git diff --stat -- pnpm-lock.yaml apps/soul/agent/package.json → 出力なし（lockfile・依存不変＝新規依存ゼロ）
git diff --stat -- *channel-*-contract*                       → 出力なし（契約 JSON 不変）
git status --porcelain -- apps/soul/agent                     → "?? apps/soul/agent/src/chat/"（新設のみ）
```

- `.tmp/facex-*`（別セッション領分）は一切触っていない・読んでいない（初期 git status の未追跡 5 件はそのまま）。
- **構造チェック 3 種**（`node scripts/check-*.mjs`・repo ルートで実行）:
  - `check-dependencies.mjs`: **passed**（EXIT=0・Dependency guard passed）。
  - `check-soul-zone-boundary.mjs`: **passed**（EXIT=0・1347 files＝ベースライン 1342 + 新設 5・器↔魂 越境 import なし。chat 器官は同一魂ゾーン内で innertube.mjs のみ import）。
  - `check-source-organization.mjs`: EXIT=1 だが**唯一の違反は `apps/runtime-player/src/main/physiology/index.ts`**（器コード・barrel-only 違反・ブランチ既存ベースライン＝本 Domain で不変）。**私のスコープ（soul/agent）には違反ゼロ**（source-org は `.ts` のみ検査し、新設は全て `.mjs`）。無退行。

## 6. 機械ゲート生数字

`cd apps/soul/agent && node --test`（全テスト・新規込み総数・タイムアウト 300s 付きで実行）:

```
# tests 563
# suites 0
# pass  563
# fail  0
# cancelled 0
# skipped 0
# todo 0
```

- **実行前ベースライン 518 → 実行後 563（+45）**（wave-plan 参考値「S6 後 425」はブランチ進行で 518 に更新済み・実測）。
  内訳: `innertube.test.mjs` 25 本 + `live-chat-client.test.mjs` 20 本 = **+45**（`node --test <file>` 個別実行で実測）。既存 518 本は無変更で全通過（呼び出し側契約の無退行＝この器官は誰からも import されていない）。
  ※ 追修正（catch-all の自動再接続）で `live-chat-client.test.mjs` に想定外内部例外の 2 本を追加（18→20）。初回実装時の内訳誤記（22+21=43）を実測 25+20=45 に訂正。
- 新設 chat テストのみ: `node --test src/chat/innertube.test.mjs src/chat/live-chat-client.test.mjs` → 45/45 pass。
- **SDK 実消費ゼロ**（この器官は LLM/SDK に触れない）。**機械テストは実 YouTube に一切出ていない**（fake fetch のみ）。

## 7. §質問（Domain B / C・人間ゲートへの申し送り・迷った裁定点）

1. **onMessage が渡す形（Domain B へ）**: `onMessage(msg)` の `msg` は
   `{ text, displayName, kind:"text"|"paid", messageId, timestampUsec, channelId, videoId, receivedAtMs }`。
   合流はここから `buffer.append({ startMs:0, endMs:0, text, speaker:"viewer", displayName })`（inventory §3-1 の soul 先例踏襲）に落とす想定。
   **時刻軸**: この器官は VAD ストリーム時刻を持たないため startMs/endMs=0,0・窓は appendedAtMs（transcript-buffer の soul と同型）。`timestampUsec` は YouTube 側の投稿時刻（マイクロ秒文字列）で、必要なら診断/表示に使えるが正本の時間軸には使わない想定。裁定は Domain B。

2. **ended → dead は終端・再接続しない（Domain B/C へ）**: 配信終了で器官は dead に落ち、自動再接続を止める（同 video ID は復活しないため）。
   別配信に繋ぎ直すには**新しい source で createLiveChatClient を作り直す**（操縦席の「Connect chat」再操作）。同一インスタンスの `restart()` は v0 では作っていない——操縦席側で作り直す流儀（ear-pipeline の遅延起動と同様）を想定。要否は Domain C の裁定。

3. **notLive は retrying で待ち続ける（人間ゲート・Domain C へ）**: チャンネル `/live` URL で「まだ配信していない」場合、器官は retrying のままバックオフで watch ページを叩き続ける（cap 30s 間隔）。配信が始まれば自動で live に上がる。**上限なしのポーリング**なので、テスト配信を立てる前に Connect しても無限に待つだけで害はないが、cockpit の状態表示（retrying + notLive 診断）で「待ち」が見えるようにするのは Domain C。

4. **videoId 抽出の優先順位（人間ゲートへ）**: watch URL / video ID から Connect する場合は URL の videoId を優先採用するので確実。チャンネル `/live` からの場合のみ HTML（`currentVideoEndpoint.watchEndpoint.videoId`）に依存する。実ページでこの経路の videoId が期待通り載るかは**人間ゲートの実疎通で初確認**（機械テストは合成 fixture でこの経路も固定済みだが、実 HTML のスキーマ一致は実ネットでしか確認できない）。

5. **リクエストヘッダは最小（人間ゲート・followup へ）**: `fetchWatchPage` は accept-language + 汎用 UA を付けるが、実 YouTube が cookie（CONSENT 等）や地域リダイレクトを要求する可能性がある（youtube-chat 実装は CONSENT cookie を扱う版がある）。機械テストでは検査していないので、**実疎通で 4 点抽出が通るかは人間ゲートで確認**。通らなければ followup で cookie/consent 処理を器官内に足す（依存ゼロのまま fetch ヘッダ調整で対応可能な見込み）。s7-followup 台帳（Domain C 作成）に「実疎通で必要になった HTTP 詳細」の欄を用意してほしい。

6. **公式 API キー経路への差し替え（followup・Domain C 台帳へ）**: v0 は非公式 innertube のみ（inventory §5 裁定）。`innertube.mjs` の純部品層で抽象化してあるので、公式 Data API v3 実装への差し替えは器官内で完結する（`fetchWatchPage`+`extractBootstrap`+`fetchLiveChat`+`parseLiveChatResponse` を公式版に置換し、client の状態機械は不変で流用できる）。quota 単価の実測もその時（inventory §2-1）。ToS グレーの事実は開示済み（ユーザー裁定）。

7. **paid（スーパーチャット）を text と同格に拾う裁定（Domain B へ）**: 本文のある有料メッセージは `kind:"paid"` で onMessage に流す（本文なし＝金額のみは無視）。合流時に paid/text を区別して扱う（例: 演出を変える）かは Domain B/C の裁定。v0 は本文を拾うだけで区別せず append する想定（単一タイムライン＝話者 viewer・裁定 3）。金額（`purchaseAmountText`）は現状 onMessage に載せていない——必要なら足せる（申し出てほしい）。

8. **実マイク・録音物・実配信は非使用（規律の明記）**: 本 Domain は実ネットワークに一切出ていない。実疎通（テスト配信を立ててコメントを投げ、こーでぃーが拾って返す）は人間ゲートの領分（wave-plan §1・§5）。手順書は Domain C。
