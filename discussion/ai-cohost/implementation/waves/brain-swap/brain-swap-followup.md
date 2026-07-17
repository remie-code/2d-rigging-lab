# 多頭化(頭脳差し替え) wave — followup 台帳

> 対象: [brain-swap-wave-plan.md](../../orchestration/brain-swap-wave-plan.md)（Domain A→B→C）。
> 議論正本: [../../../soul/brain-swap.md](../../../soul/brain-swap.md)。
> 本書は Domain A/B/C 各記録（[domain-a.md](domain-a.md) / [domain-b.md](domain-b.md) /
> [domain-c.md](domain-c.md)）の「迷った点・質問」節に散っていた non-blocking 申し送りを 1 ファイルへ
> 集約したもの。**全項目 non-blocking**（blocking 基準は wave 計画 §4 で既に PASS 済み）。

## A（知性契約 + Codex 頭・`src/mind/brains.mjs` `codex-session.mjs`）

1. **`forced_login_method:"chatgpt"` の配線を検証するテストが無い**: `getLastConstructedOptions()`
   ヘルパは `codex-session.test.mjs` 内に定義済みだが、実際にどのテストからも呼ばれていない（未使用）。
   `new Codex({config:{forced_login_method:"chatgpt"}})` が実際に渡されていることを直接固定するテストが
   欠けている。推奨対応: 既存ヘルパを使い「渡された Codex コンストラクタ引数に
   `config.forced_login_method === "chatgpt"` が含まれる」ことを固定する 1 テストを足す。
2. **`OPENAI_BASE_URL` warn が Anthropic 版と非対称**: `assertSubscriptionAuthEnv`（Anthropic 版）は
   「既定値と比較して等しければ無害」ロジックを持つが、`assertSubscriptionAuthEnvOpenAI` は Codex SDK
   の既定 baseUrl が型定義/README に明記されていなかったため「非空なら常に warn」に単純化されている
   （Domain A 記録 §3-3・§6-2）。推奨対応: Codex SDK の既定 baseUrl が別途判明したら比較ロジックへ寄せる。
3. **`buildInput` の未知ブロック型を黙殺**: `codex-session.mjs` の `buildInput` は `text`/`image` 以外の
   ブロック型を黙って無視する（Domain A 記録 §6-4）。fire-orchestrator が渡すのは現状 text/image のみ
   （`fire-orchestrator.mjs:632-635` で確認済み）なので実害はないが、Claude 頭（SDK にそのまま渡す）とは
   挙動が非対称。将来 fire-orchestrator が新しいブロック型を渡すようになった場合、Codex 頭では黙って
   欠落する（throw しない）。推奨対応: 新ブロック型が実際に必要になった時点で throw に倒すか検討。
4. **turn2 で content 配列（画像込み）を渡すケースが未テスト**: 現行テストは turn1（systemPrompt 前置あり）
   と turn2 の string 入力は固定しているが、turn2 で画像込み content 配列を渡すケース（連続する視覚発火）
   は直接テストされていない。推奨対応: 2 回目以降の `ask()` に content ブロック配列を渡すテストを追加。
5. **turn.failed 時の threadIds 台帳記録の直接テスト無し（安全側方向）**: `ask()` 内で thread.id を try/finally
   で記録する設計（turn.failed でも記録する・Domain A 記録 §3-2）だが、turn.failed のケースで台帳に
   正しく記録されることを直接固定するテストは無い（rollout 掃除の性質テストは正常系中心）。安全側
   （記録漏れがあっても最悪ケースは「掃除されない」であり「誤って他人の rollout を消す」方向のリスクでは
   ない）だが、直接固定するテストがあると尚良い。

## B（選択の配線・`scripts/cockpit.mjs` `src/cockpit/cockpit-server.mjs`）

1. **`brainInitialChoice` は削除で追認済み（記録のみ）**: Domain B は委任文の指示（server 構築に
   `brainInitialChoice: currentBrain` を additive で渡す）から意図的に逸脱し、この option を実装しなかった
   （dead option と判断・Domain B 記録 §6-1 に詳細な根拠あり）。Orch レビューで追認済み（本項目は記録の
   ためだけの non-blocking エントリ）。
2. **`ensureFireResources`・`onSetBrain`・`brainStatus` の本体（`main()` クロージャ）が単体テストで
   直接駆動されていない**: これらは `scripts/cockpit.mjs` の `main()` 内のローカル関数であり export
   されていない。切替×in-flight の不変条件は `createSessionProxy`（export 済みの実 read-path）を使った
   同型の最小ハーネスで固定されている（Domain B 記録 §3-2）が、`main()` 内の実際のクロージャ結線
   （`currentBrain` let・`BRAINS[currentBrain] ?? BRAINS.claude` の防御的フォールバック等）自体は
   人間ゲート（実 `cockpit.mjs` 起動）でしか検証されない。推奨対応: 人間ゲートでの実射（Codex 選択→
   Fire→Terra の声で返る／Claude に戻す）が本項目の実質的な検証手段（wave 計画 §1 人間ゲート①②）。
3. **`session` let の型注釈を union に締めていない**: `/** @type {ReturnType<typeof createLlmSession> | null} */`
   のまま（Codex 頭のときは実体の型が異なるが JS 実行には無関係・Domain B 記録 §6-3）。より厳密にする
   なら `brains.mjs` の `MindSession` typedef を import して union にできる。

## C（操縦席 UI・観測・docs・本ドメイン）

1. **brain 札の in-flight 切替時の近似（既知の近似・observation の設計上の制約）**: 配信中に頭を
   切り替えた直後の in-flight 応答は「切替前の頭が生成した」応答だが、`broadcastSoulTranscript` /
   `onUsage` は broadcast 時点の `brainStatusImpl()?.brain`（=現在の頭）を読むため、稀に札がズレうる
   （実際に生成した頭と表示される頭が一致しない）。配信前選択が本線（切替は運用外）という v0 裁定の
   下で許容される近似だが、将来「配信中の頭切替」を一級 UX に格上げする場合は、応答生成時点の頭 id を
   asked 結果自体に持たせて entry に刻む設計へ変更する必要がある。
2. **設定引き出し「頭脳」区画（settings-drawer.mjs）の直接インタラクションテストが無い**: 委任文は
   「select 変更→onBrainSet 呼ばれる」テストを求めていたが、既存コードベースの規律（domain-b レビュー
   §6 申し送り 8・`cockpit-ui.test.mjs` コメント「ControlBar / SettingsDrawer 本体は hooks
   （ローカル busy・入力欄 state）を使うため collectText の『関数コンポーネント展開』流儀では走査できない」）
   により、`SettingsDrawer` 本体の直接インタラクションテストは既存の `onAudioSet`/`onChatConnect` 等
   含め**全て**存在しない（jsdom 等の DOM シミュレーション基盤がこのリポジトリに無いための構造的制約）。
   同型の制約に従い、頭脳区画も葉部品（`SettingsSelect`）の vnode 走査 + view-logic（`brainLabel` /
   `brainCredentialHealthLabel` / `brainPostErrorText`）の fixture テストで表示導出を固定した。
   `onBrainSet` ハンドラ自体（POST 呼び出し→エラー処理→snapshot 適用の一連）は構造的にユニットテスト
   できない——この製品全体のテスト方針の既存の限界であり、本 Domain C が新規に持ち込んだ制約ではない。
   将来 jsdom 等を導入する場合はこの限界を解消できる。
3. **頭脳 select の初期値同期は「選ぶ→即 Set」前提の単純設計**: `settings-drawer.mjs` の
   `brainSelected` は `useEffect` で `settings.brain.brain` の変化に同期する（chat source のような
   「編集中は復元しない」ガードは設けていない）。選択直後に SSE `state` が到着すると選択がリセット
   されうるが、選択→即 Set という短いフローでは実害は小さいと判断した（人間ゲートで違和感があれば
   chat source 型のガードへ寄せる余地がある）。
4. **usage/latency の brain 札の表記（意匠）は人間ゲート未確認**: `usageNoteText` の brain 札位置
   （`"usage(vision)[codex]: ..."`）・`latencyLabel` の区切り文字（middle dot `·`・`"(1.5s · claude)"`）
   は cockpit-redesign.md の承認済み UI 仕様に明記が無く、本 Domain C の裁量で決めた意匠。人間ゲートで
   見た目を確認し、違和感があれば view-logic 側（`usage.mjs` / `transcript.mjs`）の 1 箇所だけを直せば
   よい（純関数・fixture 固定のため変更は局所的）。
5. **エンドポイント数コメントの実測ズレ**: Domain B レビュー指摘（変更前 18・変更後 19 のはずが
   コメントは 18 のまま）は本 Domain C で**修正済み**（`cockpit-server.mjs:279,:1059` を「18」→「19」に
   訂正・実測根拠は domain-c.md §6 参照）。
