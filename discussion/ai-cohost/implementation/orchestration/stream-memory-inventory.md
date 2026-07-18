# 配信間記憶 planning gate 棚卸し

> Status: 完了(2026-07-19)。議論・裁定の正本は [../../soul/stream-memory.md](../../soul/stream-memory.md)(裁定 7 件)。
> 計画: [stream-memory-wave-plan.md](stream-memory-wave-plan.md)。

## 1. リポジトリ事実(Sylph 調査・file:line 付き)

- **全量取り出しは既にある**: transcript-buffer.mjs `all()`(:178-180・防御的コピー・上限なし)。注入用の窓絞りは fire-injection.mjs `formatFireInjection`(:83-124)で、windowMs/maxChars は `Number.isFinite` 必須(Infinity 不可)。話者整形 `formatLine`(:51-58)は非 export。
- **shutdown は待てる形**: cockpit.mjs `shutdown`(:753-784)= async・`finally { process.exit(0) }`。SIGINT(:785)/stdin EOF(:788)両経路。順序= server.close→session.dispose(Codex の rollout 掃除はこの中)→player→channel。**途中に await を挟める**。
- **使い捨て ask は契約そのまま**: brains registry `create(options)`→`{ask, dispose}`(brains.mjs:47-84)。コスト実測= Claude 短命 1 往復 ≈5s(初期化 1.9s+ask 3.2s・s1-first-light)/Codex は元々毎 run spawn で追加コストほぼ無し(brain-swap-terra :142-143)。
- **注入点は一箇所**: cockpit.mjs `ensureFireResources` :544-551 の `systemPrompt: FIRE_SYSTEM_PROMPT`。Codex 頭は codex-session.mjs `buildInput`(:231-252)が初回 turn 先頭に前置=同じ options で両頭対称。
- **ローカルファイル慣行**: zone 直下の `*.local.json` 前例(settings-store :62・codex-session :69)、.gitignore は単体列挙(apps/soul/agent/.gitignore:30,:35)。新ディレクトリ `memories/` は同 gitignore に 1 行追記。
- **常駐タイマーの前例なし**: バックエンドに setInterval 前例ゼロ(UI の uptime とテスト fake のみ)。チェックポイントタイマーは cockpit.mjs main() スコープに新設が素直。
- **操縦席写経元(直近 3 波で確立)**: 区画= settings-drawer 頭脳区画(:339-357,:476-489)・boolean スイッチ= barge-in(control-bar:107-119 ほか・settings-store:154-159・createBargeInHooks cockpit.mjs:329-)・POST 一般形= /api/barge-in(cockpit-server.mjs:950-970)・snapshot 組込み= :523-(brain は :550)。

## 2. L0 設計判断(計画への持ち込み)

1. **全量整形は専用関数を新設**(formatFireInjection への巨大有限値ハックはしない——意味が濁る)。ダイジェスト用の読みやすい対話整形を記憶モジュール側に持つ。
2. **記憶モジュール = src/mind/memory.mjs**(器官は mind): 整形・生成指示(視聴者名除外を明記)・生成(brains の create を注入可能に=テストは fake)・保存(memories/<起動日時>.md・**同一セッション内は同一ファイル上書き**)・読み込み(直近 3 件・合計サイズ上限つき)。
3. **shutdown 内の生成は best-effort+タイムアウト**(締めが固まらん保険・失敗しても他の後始末は進む)。位置は server.close 直後・常駐 dispose の前(独立の使い捨てセッションゆえ順序自由やが、記憶を先に地面へ)。
4. **チェックポイント= 20 分間隔**(裁定の 15〜30 分の中庸・定数)。**転写が前回生成から変化しとらん時はスキップ**(空回しでトークンを燃やさん)。
5. **スイッチの意味論: OFF = 注入も生成も停止**(「記憶なしで起動」の直感に合わせる・記憶機能まるごとの止水栓)。切替は brain 切替と同じ「現セッション dispose→次の発火から反映」。
6. **エンドポイントは二つ**(一口一義の家風): `POST /api/memory {enabled:bool}`(スイッチ)+ `POST /api/memory-record {}`(手動「今日を記録」)。snapshot に `memory: {enabled, count, lastRecordAtMs}`。SSE 種別は増やさん(state のみ)。
7. **開示文言の改訂は L0 直轄**(pre-stream-checklist.md §1 に記憶の一文を追記——wave 外・着手時に実施済み)。
