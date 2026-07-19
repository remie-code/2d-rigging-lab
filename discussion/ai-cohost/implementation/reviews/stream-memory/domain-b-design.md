# 配信間記憶 Domain B「配線 + 操縦席 + docs」— design（コード品質）レーン レビュー報告

> レビュアー: Review-Sylph（design レーン・サブエージェント委任・Orch-Sylph 経由）。
> 対象: Gnome 完了報告 `discussion/ai-cohost/implementation/waves/stream-memory/domain-b.md`。
> 実装差分: `apps/soul/agent/scripts/cockpit.mjs` / `apps/soul/agent/src/cockpit/cockpit-server.mjs` /
> `apps/soul/agent/src/cockpit/cockpit-settings-store.mjs` / `apps/soul/agent/src/cockpit/ui/settings-drawer.mjs` /
> `apps/soul/agent/src/cockpit/ui/app.mjs` / `apps/soul/agent/src/cockpit/view-logic/settings.mjs`。
> スコープ: コード品質のみ（設計適合=spec / テスト網羅=test は別レーン）。

## 1. 観点別評価

### 1-1. 写経の正しさ

- `createMemoryHooks`（`cockpit.mjs:396-412`）は `createBargeInHooks`（`cockpit.mjs:359-375`）と構造・JSDoc・失敗寛容（try/catch で永続化失敗を握る）まで完全に同型。既定値の非対称（`defaultEnabled=true`）も barge-in と同じ規律で明記されている。**適合**。
- POST `/api/memory`（`cockpit-server.mjs:1132-1148`）・POST `/api/memory-record`（`cockpit-server.mjs:1150-1165`）を POST `/api/self-fire`（`:951-970`）・POST `/api/barge-in`（`:972-991`）と突き合わせた。未注入ゲート（503）→ `readJsonBody` → 効かせる → 永続化 try/catch（失敗寛容）→ `broadcastState()` → `sendJson(200, snapshot())` という 5 段の型が完全一致。唯一の意味論的な違いは、self-fire/barge-in は「gate/scheduler オブジェクトの有無」でゲートするのに対し、memory は「`onSetMemoryEnabled` 関数の有無」でゲートする点だが、これは `onSetBrain`（`typeof onSetBrain !== "function"` 相当）と同型であり、memory に対応する常駐オブジェクトが cockpit-server 側に無い（実体は cockpit.mjs 側）という責務境界と整合しているため妥当。**適合**。
- `onSetMemoryEnabled`（`cockpit.mjs:858-881`）と `onSetBrain`（`cockpit.mjs:792-804`）を突き合わせた。永続化 → 状態更新 → （memory 固有の ON 時 memoryText 再読込）→ `session.dispose()`（try/catch best-effort）→ `session = null` という骨格が一致。ホットスワップの型は正しく踏襲されている。**適合**。
- `cockpit-settings-store.mjs` の `getMemoryEnabled`/`setMemoryEnabled`（`:188-195`）は `getBargeInEnabled`/`setBargeInEnabled`（`:159-166`）とバイト単位で同型（`typeof v === "boolean" ? v : null` / `writeMerged({ memoryEnabled: enabled === true })`）。**適合**。
- `view-logic/settings.mjs` の `memoryToggleView`（`:183-194`）を写経元 `view-logic/control.mjs` の `bargeInToggleView`（`:207-218`）と突き合わせた。`className` の prefix 差し替え以外は完全一致（disabled/checked/statusText/statusClassName の全フィールド）。**適合**。

### 1-2. 転写取得の継ぎ目

- `cockpit-server.mjs` の返り値に `getTranscript: () => (pipeline ? pipeline.transcriptBuffer.all() : [])`（`:1606`）を additive 追加。`transcriptBuffer.all()` は防御的コピーを返す実装（`transcript-buffer.mjs:178-180`）であることを確認済み——呼び出し側が配列を書き換えても正本は壊れない。
- `cockpit.mjs` 側 `let server;`（`:638`、型注釈 `ReturnType<typeof createCockpitServer> | undefined`）は `sessionProxy`/`playerProxy` が `session`/`player`（`let session = null` 等）を forward reference するのと同種のパターン。`recordMemory`/チェックポイントタイマー/shutdown はいずれも `server ? server.getTranscript() : []` という防御的アクセスで、`server` 代入前（起動シーケンス上あり得ないが構造的に）呼ばれても安全側に倒れる。循環参照や未定義参照の穴は見当たらない。**健全**。
- shutdown の「`server.close()` より前に転写を確保する」という★重要な配管事実（`cockpit.mjs:1005-1008`）を `cockpit-server.mjs` の `close()` 実装（`:1618-1673`）と突き合わせて検証した。`close()` は `pipeline = null`（`:1660`）を `await p.dispose()`（`:1662`）より**前**に実行するため、`close()` 完了後に `getTranscript()` を呼ぶと確実に空配列が返る。cockpit.mjs 側が `finalMemoryEntries` を `close()` 呼び出し**前**に確保している設計は、この事実と整合しており「close 後に転写を取りに行く事故」を構造的に避けている。**健全**（主張の裏取り完了）。
- 軽微な非対称: `session`/`player` は `let session = null;` / `let player = null;` と明示的に null 初期化されているのに対し、`server` は `let server;`（未初期化＝undefined）のまま。実害はなく JSDoc で型も明記されているが、既存の forward-reference 変数との書式一貫性という観点では揃えても良かった（non-blocking）。

### 1-3. テスト可能化の切り出し

- `createMemoryRecorder`（`cockpit.mjs:448-465`）・`shouldSkipMemoryCheckpoint`（`:423-425`）・`raceMemoryRecordWithTimeout`（`:477-482`）の 3 関数は export され、main() 内の実際の呼び出し（`cockpit.mjs:818`, `:839-844`, `:1015`）がそのままこれらを呼ぶ薄い配線になっている。単体テストで固定した不変条件（OFF は generateDigest を呼ばない・throw を握る・timeout で必ず返る 等）は実経路にそのまま効く。**適合**。
- 一方、`shutdown` 自体（`cockpit.mjs:1001-1042`）は main() スコープの非 export クロージャであり、`cockpit.test.mjs` の「shutdown 型ハーネス」2 本（`:785-820`, `:822-832`）は shutdown 関数そのものを駆動しているのではなく、その**手順を手動で再現した最小ハーネス**である（テスト内コメントで「brain 切替×in-flight テストと同じ流儀」と明記されており、既存の `cockpit.test.mjs:962` 付近の「brain 切替×in-flight」テストと同型のパターンであることも確認した＝一貫性のある既存規律への追随）。
  - この形式には構造的な限界がある: 将来 `shutdown` 内の実装（`finalMemoryEntries` の確保位置・`raceMemoryRecordWithTimeout` の呼び出し順序など）が誤って変更されても、ハーネス側のコードは変更されない限りテストは無関係に緑のままになり得る。既存規律への追随なので許容範囲だが、design/test 両レーンへの申し送り事項として明記する（non-blocking）。

### 1-4. 失敗寛容・堅牢性

- `recordMemory`（`createMemoryRecorder` の戻り値・`cockpit.mjs:449-464`）は `generateDigestImpl`/`saveDigestImpl` の呼び出しを単一の try/catch で包み、catch 節で `onError` を呼ぶのみで re-throw しない。呼び出し元（チェックポイント/手動/shutdown のいずれ）を巻き込まない設計は機械テスト（`cockpit.test.mjs:689-734`）でも固定済み。**適合**。
- `raceMemoryRecordWithTimeout`（`:477-482`）は `Promise.resolve(promise).catch(() => {})` と `setTimeoutImpl` の `Promise.race` で構成されており、どちらが勝っても reject しない実装。shutdown 側（`cockpit.mjs:1014-1016`）は `await raceMemoryRecordWithTimeout(...)` の後に必ず `if (session) {...}` 以降へ進む構造（`race` 自体が例外を投げないため `try/finally` の `finally` に頼らずとも後続へ進む）。**適合**（blocking #3 の実装として妥当）。
- timeout 勝ち時に使い捨てセッション（`generateDigest` 内部で create された session）が in-flight のまま残る可能性はあるが、直後に `process.exit(0)`（shutdown の `finally`）でプロセスごと終了するため実害なし、という Gnome の説明は実装と整合している（`generateDigest` 自身が dispose を try/finally で握る契約だが、timeout 側から見れば単に待たずに進むだけで、リソース自体は OS 側のプロセス終了で回収される）。**妥当**。
- POST `/api/memory-record`（`cockpit-server.mjs:1150-1165`）は `onMemoryRecord()` の throw を try/catch で握るが、`onMemoryRecord = () => recordMemory()`（`cockpit.mjs:884`）自体が既に内部で失敗を握って reject しない設計のため、この try/catch は事実上到達しない二重防御になっている。無害だが、同様の二重防御は `memoryCheckpointTimer` のコールバック内 `recordMemory(entries).catch(() => {})`（`cockpit.mjs:843`）にも見られる。両方とも「なぜここにも catch があるのか」を一言添えると読み手の迷いが減る（non-blocking・可読性）。

### 1-5. 潜在バグ

- **チェックポイントの seq 不変スキップ**: `shouldSkipMemoryCheckpoint(currentSeq, lastRecordedSeq)`（`cockpit.mjs:423-425`）は単純な等値比較。`transcript-buffer.mjs` を確認したところ append-only・上限なし（`entries.length` は単調増加、`discarded` は空転写のみを指すカウンタでバッファサイズの破棄ではない）ため、「件数不変 = 転写に変化なし」という前提は現状のバッファ実装と矛盾しない。**機能的には問題なし**。
  - ただし変数名 `lastRecordedSeq`／引数名 `currentSeq` は実体が「seq 番号」ではなく「`entries.length`（件数）」であり、命名と実体がややズレている（`lastRecordedCount` 等の方が正確）。将来 transcript-buffer に上限/破棄機構が入った場合、「件数が同じでも中身が入れ替わっている」ケースを見落とす懸念に繋がりうる命名（現状は空振りだが non-blocking の指摘）。
- **memoryCheckpointTimer と shutdown の未調停**: `memoryCheckpointTimer`（`cockpit.mjs:839-845`）は `unref()` されているのみで、`shutdown`（`:1001-1042`）内で明示的に `clearInterval` されていない。`fireScheduler`/`bargeInGate` 等は自身の `dispose()` 内でタイマーを止める設計（`cockpit-server.mjs:1623-1638`）だが、`memoryCheckpointTimer` は cockpit.mjs 側の生の `setInterval` であり対応する dispose 呼び出し先がない。
  - 実害の評価: `unref()` によりプロセス生存には寄与しないため放置しても `process.exit(0)` は妨げられない。ただし shutdown 処理中（`server.close()` 〜 `raceMemoryRecordWithTimeout` の最大 `SHUTDOWN_MEMORY_TIMEOUT_MS`=15 秒間）にイベントループは回り続けるため、理論上 20 分境界とタイミングが重なれば `recordMemory` が二重に走り得る（チェックポイント経由と shutdown 最終版経由）。同一ファイル名（`memoryStartedAtMs` 由来）へ上書き保存するだけなので致命的ではないが、無駄な LLM 呼び出し・使い捨てセッションの多重生成を招く。
  - 修正指針（要修正ではなく提案）: `shutdown` の冒頭（`closing = true;` の直後）で `clearInterval(memoryCheckpointTimer);` を追加する 1 行で解消できる。**non-blocking**（低確率・低実害だが、1 行で塞げる穴なので次波での是正を推奨）。
- OFF→ON 切替時の `memoryText`/`memoryCount` 再読込（`cockpit.mjs:861-868`）・OFF 時のクリア（`:870`）は composeSystemPrompt 側の二重防御と合わせて blocking #4 の要求を満たしている。**適合**。
- `unref()` の付与（`cockpit.mjs:845`）は確認済み・適合。

### 1-6. 命名/可読性/docs 整合

- `MEMORY_INJECT_MAX_CHARS`/`SHUTDOWN_MEMORY_TIMEOUT_MS`/`MEMORY_CHECKPOINT_INTERVAL_MS` の JSDoc コメント（`cockpit.mjs:65-85`）はいずれも根拠（実測値・既存定数との関係）を明記しており、値の恣意性がない。**適合**。
- `view-logic/settings.mjs` の関数配置（記憶区画専用ヘルパを既存ファイルに集約）・`REQUEST_ERROR_PREFIX` への追記・`formatClock`（`format-time.mjs:41`）の再利用は、いずれも実際に既存関数/機構が存在することを確認した上での妥当な再利用。**適合**。
- README/followup の記述は本レビューの主眼（コード品質）の範囲では実装と齟齬なし。

## 2. 差分・要修正

**なし（blocking な要修正事項は無し）**。

non-blocking の改善提案（次波以降で対応を検討する程度でよい）:

1. `cockpit.mjs` の `shutdown`（`:1001` 付近）冒頭に `clearInterval(memoryCheckpointTimer);` を追加し、20 分チェックポイントタイマーと shutdown 最終記録の理論上の競合を塞ぐ。
2. `lastRecordedSeq`/`currentSeq`（`cockpit.mjs:423-425`, `:667`, `:828`, `:842`）の命名を実体（件数）に合わせて `lastRecordedCount`/`currentCount` 等へ改名すると、将来 transcript-buffer に上限機構が入った際の誤解を避けやすい。
3. `recordMemory(entries).catch(() => {})`（`:843`）と POST `/api/memory-record` 側の try/catch（`cockpit-server.mjs:1156-1161`）が「なぜ二重に握っているか」一言コメントを添えると読み手に親切。
4. `let server;` を `let server = null;` にして `session`/`player` の初期化スタイルと揃える（純粋にスタイル、実害なし）。

## 3. 裁量判断の妥当性（Gnome 報告 §7）

1. **転写取得の継ぎ目の実装形**: 妥当。`sessionProxy`/`playerProxy` の forward reference パターンとの同型性を実装突き合わせで確認済み（§1-2）。
2. **`recordMemory`/チェックポイント/shutdown のテスト可能化**: 妥当。3 関数の切り出しは実経路に効くことを確認済み。ただし shutdown 自体は「型の再現」に留まる限界がある旨は §1-3 に記載（既存規律への追随であり許容範囲）。
3. **`lastRecordAtMs` はプロセス内正本**: spec レーンの判断だが、コード上は `let lastRecordAtMs = null` が起動毎にリセットされる素直な実装で、実装自体に問題はない。
4. **`memoryToggleView` 等の置き場所**: 妥当。写経元 `bargeInToggleView` との突き合わせ済み（§1-1）。
5. **`memoryStatusLabel` のローカル時刻変換**: 妥当。`format-time.mjs` の `formatClock`（既存関数）を確認済み、新規重複実装なし。
6. **静的配信テストのコメント是正（16→22）**: 本ドメインの担当範囲を超えるが、コメントのみの低リスク修正であり、実装差分に悪影響なし。妥当。

## 4. 判定

**合格**。

blocking な設計逸脱・写経崩れ・堅牢性の欠陥は見つからなかった。既存パターン（barge-in/self-fire/brain-swap）への忠実な写経が一貫しており、転写取得の継ぎ目・shutdown の安全性・OFF の完全性はいずれも実装を読んでの裏取りで確認できた。§2 に列挙した 4 点は non-blocking の改善提案であり、マージを妨げるものではない（特に #1 の `clearInterval` 漏れは次波での是正を推奨する程度の軽微な指摘）。

## 5. 質問

1. `memoryCheckpointTimer` の `clearInterval` 漏れ（§1-5・§2-1）について、Orch-Sylph/L0 側で「次波で直す」で良いか、それとも本波内での小修正として Gnome に差し戻すべきか判断を仰ぎたい（実害は低確率・低影響と評価したため要修正ではなく non-blocking とした）。
