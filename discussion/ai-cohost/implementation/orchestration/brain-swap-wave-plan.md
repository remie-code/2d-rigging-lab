# 多頭化(頭脳差し替え) wave 計画

> Status: 計画確定(2026-07-17)・発進待ち。
> 根拠: [brain-swap-inventory.md](brain-swap-inventory.md)(裁定+配管事実)。議論正本: [../../soul/brain-swap.md](../../soul/brain-swap.md)。
> 方式: 単一 Orch-Sylph(opus)が Domain A→B→C 順次。各ドメイン Gnome(sonnet)実装+Review-Sylph(sonnet)3 レーン(spec/design/test)。鉄の規律・在席プロトコル(委任文に PowerShell 在席ループ明示)は従来どおり。

## 1. ゴールとゲート

- **ゴール**: 操縦席の設定層で頭(Claude Opus 4.8 / Codex GPT-5.6 Terra)を選び、次の発火からその頭で喋る。観測層に頭札+応答レイテンシが出る。Codex 頭は配信中の記憶(スレッド継続)を持ち、配信後にディスク痕跡(rollout)が掃除される。
- **機械ゲート**: `node --test` 全緑(ベースライン 764)・**実 LLM/実 Terra 消費ゼロ**(fake 注入)・器/契約/root lockfile/soul package.json 不変(codex-sdk は導入済み・wave で依存を増やさない)・server ワイヤ契約 additive のみ。
- **人間ゲート(体感)**: ①操縦席で Codex(Terra) を選ぶ→Fire→**Terra の声で返る**(頭札とレイテンシが行に見える)→実会話で速度と語彙を体感 ②Claude に戻す→普通に返る(無退行) ③配信/セッション終了後、`~/.codex/sessions` に魂の rollout が残っていない(ユーザー自身の rollout は無傷)。

## 2. 設計の枠(裁定済み・詳細は inventory §3)

- 知性契約=現外形の凍結(`ask→{replyText,usage,ttftMs|null,elapsedMs}` / `dispose`)。ttftMs 未消費は実測確認済み=null 安全。
- 頭の表=フラット registry(`src/mind/brains.mjs`・expression-table 式)。llm-session.mjs(Claude)は**無変更**。
- Codex 頭=常駐 Thread+run・effort none・sandbox read-only+approval never+webSearch disabled・env 完全制御+OpenAI 版 env-guard sibling・画像=一時ファイル橋渡し(アダプタ私事・即削除・**昇格予約のドキュメント 3 箇所義務**)。
- 切替=POST /api/brain→永続+dispose→null→次の発火から新頭。KILL 状態は切替を跨いで生存。
- rollout 掃除=**自分の thread_id の sidecar 台帳**+完全一致削除のみ(dispose 時+起動時 sweep)。
- 健康表示=資格情報ファイルの存在確認のみ。

## 3. ドメイン分割

### Domain A: 知性契約+Codex 頭(src/mind/)

- `src/mind/brains.mjs`: 契約 typedef+フラット registry(claude/codex: id・表示札・create・資格情報ファイルパス)。health test。
- `src/mind/codex-session.mjs`: createCodexSession({systemPrompt, model="gpt-5.6-terra", effort="none", sdkImpl?, homeDir?})→契約準拠 {ask, dispose, threadIds}。ask: string→run / contentブロック→(base64 画像→一時 jpg→local_image→finally 即削除)。ttftMs:null・elapsedMs 実測・usage 透過。turn.failed/例外は正直に throw(発火側の既存エラー処理に乗せる)。**モジュールヘッダに昇格予約の一文**。
- OpenAI 版 env-guard(env-guard.mjs に sibling 追加: OPENAI_API_KEY/CODEX_API_KEY 拒否・Anthropic 側は不変)。
- **rollout 掃除**: thread_id sidecar 台帳(gitignored)への記録・dispose 時削除・起動時 sweep。日付 3 階層(`sessions/YYYY/MM/DD/`)の再帰探索・**完全一致のみ**・見つからん場合は正直に諦めて台帳から消すだけ(エラーで起動を止めない)。fake sessions 構造での機械テスト必須(**ユーザー rollout を消さない**性質テスト含む)。
- 機械テスト: fake SDK 注入で ask/dispose/画像橋渡し(一時ファイルが消える)/env-guard/掃除。実消費ゼロ。

### Domain B: 選択の配線(scripts/cockpit.mjs + cockpit-server.mjs)

- createBrainHooks(settings)(verbosityHooks 写経)+settings 新キー brainChoice(store 写経+4 種テスト)。
- ensureFireResources の頭分岐(registry 経由・現 Claude 経路の挙動は 1 ビット不変)。
- POST /api/brain({brain:"claude"|"codex"} 検証・切替時 dispose→null・broadcastState・snapshot.brain+資格情報健康 boolean)。server test 6 種(S8 /api/kill の写経)+「16→17 エンドポイント」系コメント追随。
- 切替と in-flight: 進行中発火がある時の切替は dispose の既存意味論(強制解決)に乗せ、挙動をテストで固定。

### Domain C: 操縦席 UI+観測+docs(src/cockpit/ui/ ほか)

- 設定層「頭脳」区画(「声の出力先」行の写経: select+Set+状態表示。資格情報の健康表示=「ログイン確認済み/未検出(codex login してや)」)。
- 観測: soul 行に latencyMs 実測+brain 札(processAskedReply の asked.elapsedMs→soul 転写放送経路への配線・broadcastSoulTranscript の null 固定を実値に)。usage 表示に brain 札。
- page/view-logic テスト。README: 安全弁節の隣に「頭脳」節+**provider 追加手引き(昇格予約の 3 箇所目)**。followup 台帳 `waves/brain-swap/brain-swap-followup.md`。

## 4. blocking レビュー基準

1. **掃除の安全性(最重要)**: 削除は sidecar 台帳の thread_id 完全一致のみ。パターン/bulk 削除経路が存在しないこと。ユーザー rollout(4400+本)を消さない性質テストがあること。
2. **Claude 頭の無退行**: llm-session.mjs 無変更。Claude 選択時の挙動が現行と 1 ビット等価(既存テスト全緑で担保)。
3. **実消費ゼロ**: 全機械テストが fake で走る(実ネット/実 Terra/実 Claude なし)。
4. **資格情報の不可侵**: 存在確認のみ・中身を読まない・ログ/SSE/正本に書かない。
5. **画像橋渡しの封じ込め**: 契約は base64 のまま・一時ファイルはアダプタ内で生成と削除が完結・昇格予約ドキュメント 3 箇所(brain-swap.md §5 正本/アダプタヘッダ/README)。
6. **ワイヤ契約 additive**・器/契約/依存不変。
7. **KILL/NG 弁の頭非依存**: どちらの頭でも全発話が同じ検問所を通ること(検問所は processAskedReply=頭の外・構造上自明やがレビューで確認)。

## 5. choke point(ユーザーの作業)

- install なし(codex-sdk 導入済み)。`codex login` 済み(確認済み)。
- 人間ゲート(§1 の 3 点)——体感が本丸(速度と語彙は君の体感裁定)。

## 6. Status

(発進後に記録)
