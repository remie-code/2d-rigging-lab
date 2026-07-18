# 配信間記憶 wave 計画

> Status: 計画確定(2026-07-19)・発進待ち。
> 根拠: [stream-memory-inventory.md](stream-memory-inventory.md)(裁定 7 件+L0 設計判断 7 件+配管事実)。議論正本: [../../soul/stream-memory.md](../../soul/stream-memory.md)。
> 方式: 単一 Orch-Sylph(opus)が Domain A→B 順次。各ドメイン Gnome(sonnet)+Review-Sylph(sonnet)3 レーン。鉄の規律・在席プロトコル(委任文に PowerShell 在席ループ明示)は従来どおり。

## 1. ゴールとゲート

- **ゴール**: 配信を締めると今日のダイジェストが人間可読 md で残り、次の起動でこーでぃーが直近 3 配信ぶんを覚えとる(「昨日のアークナイツの続きやな」が言える)。停電・クラッシュでも直近チェックポイントまでは残る。
- **機械ゲート**: `node --test` 全緑(ベースライン 887)・実 LLM 消費ゼロ(生成は fake 注入)・器/契約/依存/lockfile 不変・server ワイヤ additive のみ(POST +2・snapshot キー +1・SSE 種別増なし)。
- **人間ゲート(実射)**: ①配信して Ctrl+C → `memories/` に md が生まれ、読めて、**視聴者名が入っとらん** ②次回起動 → こーでぃーが前回の内容に言及できる ③「記憶なし」スイッチで無記憶起動(注入も生成も止まる) ④手動「今日を記録」ボタンとチェックポイントでファイルが更新される。

## 2. 設計の枠(裁定済み・詳細は inventory)

- 一つの操作・三つの引き金(20 分チェックポイント〔転写不変ならスキップ〕・手動ボタン・SIGINT 最終版〔best-effort+タイムアウト〕)。同一セッション=同一ファイル上書き。
- 生成は常駐を汚さん**別の使い捨て ask**(その時選ばれとる頭・brains registry の create を注入可能に)。
- 起動時に直近 3 件を読み、`FIRE_SYSTEM_PROMPT + 記憶テキスト` としてセッション生成時に注入(両頭対称・cockpit.mjs:545 の一箇所)。合計サイズ上限つき。
- OFF = 注入も生成も停止。切替は現セッション dispose→次の発火から反映(brain 切替の写経)。
- 記憶は `apps/soul/agent/memories/*.md`(gitignore)・視聴者名は書かせん(生成指示)。

## 3. ドメイン分割

### Domain A: 記憶の器官(src/mind/memory.mjs 新設)

- 全量転写の対話整形(専用関数・formatFireInjection のハック流用はしない)・ダイジェスト生成指示(内容: 出来事/話題・ジョーク/配信者について。**視聴者名・個人特定情報の禁止を明記**・分量目安 ≤1500 字)・generateDigest(brainDef 注入・create→ask 一発→dispose・fake 注入口)・saveDigest(memories/<起動日時>.md 上書き・ディレクトリ自動作成)・loadRecentDigests(N=3・ファイル名降順・合計上限・欠損/空ディレクトリ耐性)・composeSystemPrompt(仮面+記憶)。
- .gitignore に `memories/` 追記。
- 機械テスト(全 fake): 整形(3 話者・displayName は整形段階で落とすか要検討=生成指示との二重防御)/生成が使い捨て(dispose 呼ばれる・常駐に触れん)/上書き/読み込み N 件・上限・欠損耐性/compose の ON/OFF。

### Domain B: 配線+操縦席+docs

- cockpit.mjs: createMemoryHooks(settings 写経・memoryEnabled 既定 true)・起動時 loadRecentDigests→ensureFireResources の systemPrompt 合成・チェックポイントタイマー(20 分・main() スコープ・転写 seq 不変ならスキップ・unref)・shutdown へ最終生成(best-effort+タイムアウト・server.close 直後)・手動/スイッチの配線。
- cockpit-server.mjs: `POST /api/memory {enabled}`+`POST /api/memory-record {}`(barge-in/verbosity 写経・503/検証/永続化フック失敗寛容/broadcastState)・snapshot `memory: {enabled, count, lastRecordAtMs}`・エンドポイント数コメント追随。
- 操縦席: 設定層「記憶」区画(状態表示「記憶 N 件を搭載(最新: …)」+スイッチ+「今日を記録」ボタン・頭脳区画/barge-in の写経)。view-logic+page テスト+server テスト(kill/barge-in 写経の 6 種×2 endpoint 相当)。
- settings キー memoryEnabled(boolean 写経+4 種テスト)。README「記憶」節+followup 台帳 `discussion/ai-cohost/implementation/waves/stream-memory/followup.md`。

### wave 外(L0 直轄・実施済み)

- 開示文言の改訂(pre-stream-checklist.md §1 に記憶の一文)——発進時に L0 が実施。

## 4. blocking レビュー基準

1. **視聴者情報の秘匿**: ダイジェスト生成の入力整形または指示で視聴者名(displayName)が漏れん設計であること(整形段階で落とすなら機械テストで固定・指示のみなら人間ゲート①が最終防衛と明記)。
2. **常駐の不汚染**: 生成が常駐セッションの履歴に一切入らん(別セッション・dispose 確認)。
3. **shutdown が固まらん**: 最終生成は timeout 付き best-effort・失敗しても他の後始末(rollout 掃除含む)が必ず走る。
4. **OFF の完全性**: OFF で注入・生成・チェックポイントタイマーの全てが止まる。
5. **ワイヤ additive**・器/契約/依存不変・実消費ゼロ(機械テスト)。
6. **メモリファイルの安全**: 書き込みは memories/ 配下のみ・読み込みは md のみ・パス組み立てに外部入力を使わん。

## 5. choke point(ユーザーの作業)

- install なし。人間ゲート(§1 の 4 点)。開示文言の概要欄更新(L0 起草済みの文を貼る)。

## 6. Status

(発進後に記録)
