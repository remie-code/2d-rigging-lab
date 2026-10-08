# Domain B(配線+操縦席+docs)spec 遵守レビュー

> レビュアー: Review-Sylph(spec 遵守レーン・読み取り専任)。呼び出し元: Orch-Sylph。
> 対象: `apps/soul/agent/scripts/cockpit.mjs`・`apps/soul/agent/src/cockpit/cockpit-server.mjs`・`apps/soul/agent/src/cockpit/cockpit-settings-store.mjs`・`apps/soul/agent/src/cockpit/ui/settings-drawer.mjs`・`apps/soul/agent/src/cockpit/view-logic/settings.mjs`・`apps/soul/README.md`。実装ソースを自ら通読して検証(Gnome 自己申告 = `discussion/ai-cohost/implementation/waves/stream-memory/domain-b.md` / `followup.md` は鵜呑みにせず file:line で裏取り)。Domain A 公開 API(`apps/soul/agent/src/mind/memory.mjs`)も通読し、配線側が契約どおり使っているか照合した。
> 参照: `discussion/ai-cohost/soul/stream-memory.md`(裁定 7 件)・`discussion/ai-cohost/implementation/orchestration/stream-memory-inventory.md`(L0 設計判断 7 件)・`stream-memory-wave-plan.md`(§3 Domain B・§4 blocking 基準 6 項)。
> 実測: `node --test` は Orch-Sylph が独立再実行済み(`957/957 pass`・fail 0・ベースライン 914+新規 43)。本レビューではテスト実行はせず、ソースコードとテストファイルの記述内容を file:line で確認する形で検証した。

## 総合判定: **合格**(blocking なし・質問 3 件は既存回答の妥当性確認のみ)

## 要素充足(wave-plan §3 Domain B)

| 要素 | 判定 | ソース根拠 |
|---|---|---|
| settings-store の memoryEnabled(既定 ON) | 適合 | `cockpit-settings-store.mjs:188-195` `getMemoryEnabled`/`setMemoryEnabled`(bool の未記憶=null と明示 false を区別・`getBargeInEnabled` と同型)。 |
| createMemoryHooks(既定 ON) | 適合 | `cockpit.mjs:396-412`。`defaultEnabled=true`(:396)・`createBargeInHooks` の完全写経とコメントに明記(:379)。呼び出し `cockpit.mjs:620` で `createMemoryHooks(settings, true)`。 |
| 起動時 loadRecentDigests→composeSystemPrompt の注入点(一箇所・両頭対称) | 適合 | 読み込み: `cockpit.mjs:654-662`(起動時・memoryEnabled のときのみ)。注入: `cockpit.mjs:715` `composeSystemPrompt(FIRE_SYSTEM_PROMPT, memoryEnabled ? memoryText : "")` が `ensureFireResources` 内の `brainDef.create({systemPrompt: ...})` に一箇所で渡る。`brainDef` は `BRAINS[currentBrain]`(:695)で Claude/Codex を分岐するが `create` への `systemPrompt` オプションの渡し方自体は分岐しない = 両頭対称。 |
| onSetMemoryEnabled のホットスワップ | 適合 | `cockpit.mjs:858-881`。OFF: memoryText="" (:870)。ON: loadRecentDigests 再取得(:862-868)。いずれも現 session を dispose→null(:872-879、brain 切替と同型)。 |
| recordMemory | 適合 | `createMemoryRecorder`(`cockpit.mjs:448-465`)・main() でのインスタンス化(`cockpit.mjs:818-835`)。 |
| チェックポイントタイマー(20分・seq 不変スキップ・unref) | 適合 | `cockpit.mjs:839-845`。`MEMORY_CHECKPOINT_INTERVAL_MS=20*60*1000`(:68)。`shouldSkipMemoryCheckpoint`(:423-425、純関数)を呼びスキップ判定(:842)。`.unref()`(:845)。 |
| shutdown 最終生成(best-effort+timeout) | 適合 | `cockpit.mjs:1008,1014-1016`。詳細は下表 blocking #3。 |
| memoryStatus→snapshot | 適合 | `cockpit.mjs:887` `memoryStatus`・`cockpit-server.mjs:572` `snapshot().memory`。 |
| POST /api/memory | 適合 | `cockpit-server.mjs:1132-1149`。503(未注入)/body.enabled===true 判定/永続化失敗寛容(try/catch)/broadcastState。 |
| POST /api/memory-record | 適合 | `cockpit-server.mjs:1150-1165`。503/記録失敗を握って 200 を返す(failure-tolerant)/broadcastState。 |
| 操縦席「記憶」区画(状態表示+スイッチ+今日を記録ボタン) | 適合 | `settings-drawer.mjs:546-567`(DOM)・`:375-411`(ハンドラ)・`view-logic/settings.mjs:183-230`(`memoryToggleView`/`memoryPostErrorText`/`memoryRecordPostErrorText`/`memoryStatusLabel`)。 |
| README 記憶節 | 適合 | `apps/soul/README.md:469-499`「配信間記憶(セッションダイジェストと自動搭載)」節。三つの引き金・OFF スイッチ・主権はファイルシステム・自動搭載の 4 点を説明。 |
| followup 台帳 | 適合 | `discussion/ai-cohost/implementation/waves/stream-memory/followup.md`(新設・将来の梯子/Domain A→B 申し送り回答/Domain B 内裁量判断/開示文言を集約)。 |

## blocking 基準(§4)への適合

| # | 基準 | 判定 | ソース根拠 |
|---|---|---|---|
| 1 | 視聴者情報の秘匿(配線で無効化されていないか) | 適合 | `recordMemory`(`createMemoryRecorder` 内・`cockpit.mjs:448-465`)は `entries` を `generateDigestImpl({brainDef, entries})` へそのまま渡すのみ(:453)。displayName の加工/抽出/再構成コードは配線側に一切ない。`getLiveEntries`(:820, `server.getTranscript()`)も `pipeline.transcriptBuffer.all()`(`cockpit-server.mjs:1606`)の素通しで、Domain A の秘匿(`formatDigestLine` が displayName を無視)を迂回する経路が存在しない。 |
| 2 | 常駐不汚染 | 適合 | `recordMemory` の `getBrainDef`(:821, `BRAINS[currentBrain] ?? BRAINS.claude`)は brains registry の 1 エントリを渡すのみで、main() の常駐 `session`(:631)には一切触れない。`generateDigest`(Domain A)が使い捨てセッションを create/dispose する契約のまま利用。 |
| 3 | shutdown が固まらない | 適合 | `finalMemoryEntries = memoryEnabled ? server.getTranscript() : []`(:1008)を `server.close()`(:1010)より**前**に確保——`cockpit-server.mjs:1658-1666`(`close()` 内で `pipeline=null` にする実装)を突き合わせて確認済み。close 後に getTranscript を呼ぶと空配列になる構造的リスクを正しく避けている。最終生成は `raceMemoryRecordWithTimeout(recordMemory(...), 15000)`(:1015、`SHUTDOWN_MEMORY_TIMEOUT_MS`)。`raceMemoryRecordWithTimeout`(:477-482)は `Promise.race([promise.catch(()=>{}), timeout])` で例外を外に投げない(then 節が必ず解決する)ため、shutdown の `try{...}finally{process.exit(0)}`(:1009-1041)の中で後続の session/player/lazyChannel dispose(:1018-1038)を妨げない。機械テスト(`cockpit.test.mjs:785-833` 「shutdown 型ハーネス」2 本・ハング/reject の両方で後続 dispose が走ることを確認)も存在。 |
| 4 | OFF の完全性(注入・生成・タイマー全停止) | 適合(タイマーの解釈に注記あり) | 注入: `:715`(OFF は空文字列→`composeSystemPrompt` が素の仮面を返す=二重防御)。生成: `createMemoryRecorder` の `isEnabled()` ガード(:450)により OFF は 3 経路(チェックポイント/手動/shutdown)とも `generateDigest`/`saveDigest` を一切呼ばない。チェックポイント: コールバック冒頭 `if (!memoryEnabled) return;`(:840)。**注記**: `setInterval` 自体(:839)は ON/OFF に関わらず登録されたまま(=`clearInterval` はしない)であり、字義どおり「タイマーオブジェクトが消える」わけではない。ただし ON への再切替を可能にする設計上の必然(タイマーを破棄すると再作成しない限り以後の ON でチェックポイントが永久に働かなくなる)であり、実質的な効果(LLM 呼び出し・トークン消費・ファイル書き込みが起きない)は完全に停止している。wave-plan §4-4 の意図(実消費ゼロ)は満たしていると判断する。 |
| 5 | additive・器/契約/依存不変・実消費ゼロ | 適合 | Orch-Sylph 実測(POST 22 本=+2・SSE 13 種=増なし・snapshot memory キー+1)と符合。`git diff --stat` で `runtime-player`/`channel-*-contract`/`packages/`/依存/lockfile が無出力である旨は `domain-b.md` §5 に記載・本レビューでは実測ログの内容を確認した(独立再実行は Orch-Sylph 実施済みのため重複実行はしていない)。 |
| 6 | メモリファイルの安全 | 適合 | 配線層は `dir`(`DEFAULT_MEMORIES_DIR`・固定値の re-export)と `startedAtMs`(`memoryStartedAtMs = Date.now()`・:648、内部生成の数値)を Domain A の `saveDigest`/`loadRecentDigests` へ渡すのみ(:823-825, 655-659, 862-866)。転写本文・話者名等の外部入力をパス組み立てに使う経路はない。`getTranscript`(`cockpit-server.mjs:1606`)は読み取り専用。 |

## 裁定・L0 設計判断との整合

| 論点 | 判定 | ソース根拠 |
|---|---|---|
| 裁定 1(既定 ON・OFF が例外) | 適合 | `createMemoryHooks(settings, true)`(:396, 620)。settings-store も未記憶=null→フォールバックで defaultEnabled(true)を使う契約(`cockpit-settings-store.mjs:188-191`)。 |
| 裁定 3(N=3) | 適合 | `DEFAULT_DIGEST_COUNT`(Domain A 定数)をそのまま import して使用(`cockpit.mjs:57-63, 656, 863`)。Domain B 側で N を再定義していない(定数の重複がない=単一正本)。 |
| 裁定 4(一つの操作・三つの引き金=同一ファイル上書き) | 適合 | 3 引き金(チェックポイント:843/手動:884/shutdown:1015)すべてが同一の `recordMemory` を呼び、`saveDigest` へ渡す `startedAtMs` は起動時に固定した `memoryStartedAtMs`(:648, `getStartedAtMs: () => memoryStartedAtMs`・:825)で不変 → 同一ファイルへ収束する Domain A の契約(`digestFileName` が同一入力→同一文字列)がそのまま効く。 |
| 裁定 6(注入点=セッション生成時・両頭対称) | 適合 | 上表「起動時 loadRecentDigests→composeSystemPrompt」と同一根拠。`ensureFireResources`(:692-727)の一箇所のみに存在し、他に `composeSystemPrompt` や `FIRE_SYSTEM_PROMPT` を渡す経路は grep 上見当たらない。 |
| 裁定 7(使い捨て ask) | 適合(Domain A 実装をそのまま利用) | `generateDigest`(Domain A)を `generateDigestImpl: generateDigest`(:822)としてそのまま注入。配線側が独自の使い捨てセッション生成コードを持たない=責務境界が正しい。 |
| L0 設計判断 3(shutdown 内の生成は best-effort+timeout・位置は server.close 直後・常駐 dispose の前) | 適合 | 上表 blocking #3 と同一根拠。位置関係(close→最終生成→session/player/lazyChannel dispose)も設計判断どおり。 |
| L0 設計判断 4(20分間隔・転写不変ならスキップ) | 適合 | `MEMORY_CHECKPOINT_INTERVAL_MS`(:68)・`shouldSkipMemoryCheckpoint`(:423-425, 842)。 |
| L0 設計判断 5(OFF=注入も生成も停止・切替は dispose→null) | 適合 | 上表 blocking #4 と同一根拠 + `onSetMemoryEnabled`(:858-881)のホットスワップ。 |
| L0 設計判断 6(エンドポイント二つ・snapshot に memory:{enabled,count,lastRecordAtMs}・SSE 種別は増やさない) | 適合 | `POST /api/memory`+`POST /api/memory-record`(cockpit-server.mjs:1132, 1150)・`memoryStatus()`(cockpit.mjs:887)の戻り値形が仕様どおり・SSE は既存 `broadcastState()` の再送のみ(新規イベント名なし、Orch-Sylph 実測と符合)。 |

## 申し送りの遵守(Domain A→B)

1. **`loadRecentDigests` に有限 `maxChars` を渡す**: 遵守。`MEMORY_INJECT_MAX_CHARS=4500`(`cockpit.mjs:77`)を起動時(:658)・ON 切替時(:865)の両方で渡している。Domain A の既定 `Infinity`(`memory.mjs:198`)のまま使っている箇所はない。根拠の算出式(≤1500字/件×3件=4500)も `domain-b.md`/`followup.md` に明記され筋が通っている。
2. **saveDigest/generateDigest の失敗を呼び出し側で包む**(`domain-a-design.md` の指摘事項): 遵守。`createMemoryRecorder`(`cockpit.mjs:452-463`)の `try{...}catch(error){ onError(error) }` が両関数の throw を握り、呼び出し元(チェックポイント/手動/shutdown のいずれも)へ伝播させない。`cockpit-server.mjs:1156-1161`(POST /api/memory-record のハンドラ側 try/catch)は二重の防波堤として存在するが、実際に throw が伝播するとしても `onMemoryRecord()` 自体が `recordMemory()` を呼ぶだけで既に握られているため、この防波堤は実質的に無用の保険(過剰防御ではあるが害はない)。

## 裁量判断の妥当性評価(`domain-b.md` §7)

1. **転写取得の継ぎ目(`server` の前方参照 + `getTranscript` additive 追加)**: `let server;`(:638)による forward reference は `sessionProxy`/`playerProxy` の既存パターンと同型であり、実際の呼び出し(recordMemory 系)はすべて起動完了後にしか発火しないため安全。妥当。
2. **recordMemory/チェックポイント/shutdown のテスト可能化(3つの小関数を export)**: `createMemoryRecorder`/`shouldSkipMemoryCheckpoint`/`raceMemoryRecordWithTimeout` の分離は fire-scheduler.mjs/barge-in.mjs のタイマ注入規律を踏襲しており、機械テストが実装そのものを駆動する構造になっている。妥当。
3. **`memoryCount`(snapshot.memory.count)を recordMemory 成功時に更新しない判断**: `memoryStatus()`(:887)の `count` は起動時/ON 切替時に `loadRecentDigests` が返す値のみが更新源で、手動記録/チェックポイント/shutdown での記録成立では更新されない(:826-829 の `onSaved` は `lastRecordAtMs`/`lastRecordedSeq` のみ更新)。Domain A の `count` 定義(「実際に注入テキストへ入った件数」)をそのまま UI の「搭載件数」として使う一貫性は筋が通っており、`lastRecordAtMs`(記録の都度更新される)が「最新の記録が成立したこと」をユーザーに示す別の指標として機能するため、体験上の欠落にはならない。妥当な設計判断と評価する。
4. **`lastRecordAtMs` をプロセス内正本にする(前回起動を跨がない)判断**: Domain A の `loadRecentDigests` がダイジェスト本文のみを返しファイルのメタ情報(mtime 等)を返す口を持たないため、前回起動の記録時刻を復元する手段が配線側に存在しない。この制約下での「起動直後は null(まだ記録なし)」という選択は合理的であり、将来 Domain A 側の API 拡張とセットで再検討する余地を `followup.md` §3-3 に明記している点も適切。妥当。
5. **`memoryToggleView`/エラー文言/`memoryStatusLabel` の置き場所と再利用**: 既存の `settingPostErrorText`/`REQUEST_ERROR_PREFIX`/`formatClock` をそのまま再利用しており、新規の専用ヘルパーを増やしていない。既存の view-logic 規律(様式統一)に忠実。妥当。
6. **`cockpit-static-assets.test.mjs` のコメント是正(16→22)**: 本ドメインの担当範囲を厳密には超えるが、コメントのみの低リスク修正であり、委任文の「同種のカウント記述があれば揃える」という指示の範囲内。実装(ロジック)には触れておらず副作用もない。妥当。

いずれも裁定・L0 設計判断に反する選択は無い。

## 質問(Gnome 報告 §8 への見解)

Gnome から Orch-Sylph への質問 3 件はいずれも spec 適合性の観点では blocking ではないと判断する(上記「裁量判断の妥当性評価」#3・#4・#6 に対応)。追加で Orch-Sylph の判断を仰ぎたい点はない。強いて挙げるなら:

1. **チェックポイントタイマーの `setInterval` 自体は OFF でも解除されない**(blocking #4 の表内注記): 実害(トークン消費・ファイル書き込み)は無いが、「タイマーの全てが止まる」という wave-plan §4-4 の文言を字義通りに検証したい場合は、Orch-Sylph が許容解釈として確定させておくとよい(本レビューでは実質的な効果の停止をもって適合と判定した)。

## 差分・要修正

なし。
