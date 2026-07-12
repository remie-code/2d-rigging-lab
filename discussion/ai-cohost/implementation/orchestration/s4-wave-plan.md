# S4 wave計画: 表情が乗る(演出語彙+インラインタグ)

> Status: 計画確定(2026-07-13)。発進待ち。
> 根拠: [../s-series-decomposition.md](../s-series-decomposition.md) S4(定義改定=基本顔操作の演出語彙) / [s4-planning-inventory.md](s4-planning-inventory.md)(棚卸し+裁定7件) / [../../architecture/conversation-pipeline-direction.md](../../architecture/conversation-pipeline-direction.md) §1(感情タグ→intent.set/envelope)・§2.6。
> 方式: 単一Orch-Sylph(opus)がDomain A→Bを順次実行。Gnome実装+Review-Sylph 3レーン(spec/design/test)。鉄の規律は従来(環境異常対策=空/中断は再試行3回で正直停止、含む)。

## 1. ゴールとゲート

- **人間ゲート(美的)**: 会話して、**返事の内容に表情がついてくる**(困った話で目が泳ぎ、頷き、笑う——現素材はmouth-smileのkeyform未設定のため、見える本命は目・視線・頭・体)。
- **機械ゲート**: パーサ/演出表/翻訳層の純関数fixture全緑+全テスト無退行+3チェック+lockfile不変+**器コード完全不変**(S4は魂のみ)+SDK実消費最小(上限5 ask=タグ実出現の確認)。

## 2. 設計の枠(裁定済み・詳細はinventory §3)

パイプ: `LLM応答(タグ込み)→パーサ(剥離・純関数・未知タグも剥がす)→speechText(TTS・会話ログ)/expressionEvents→演出表(6語・データ駆動)→翻訳層(語+任意引数)→intent.envelope群(スロット毎・部分適用)→C5合成`。

- 語彙6語: smile / troubled / surprised / nod / look-away / look-camera。sustainは2〜4秒帯(blink停止トレードオフの回避)。
- 演出強さ係数(全peak一括スケール)を魂の設定に。操縦席には調整UIを置かない。
- 最小仮面プロンプトに**タグ語彙の教示**を追加(使える語の列挙+「感情が動いたときだけ添える」程度。人格の作り込みはpersonaの領分——引き続き貧しく)。
- 眉なし(将来は固有Issue)。四層昇格の道はinventory §3-2の記録のとおり。

## 3. ドメイン分割

### Domain A: パーサ+演出表+翻訳層+結線(魂の表情筋)

- **タグパーサ純関数**(`mind/`): replyText→{speechText, events[{word, args?, position}]}。未知タグ剥離+診断、壊れタグ耐性、タグのみ応答(speechText空)の扱い(発話なし・演出のみ実行)をfixtureで固定。
- **演出表**(データ駆動・宣言ファイル): 6語→スロット演出束(peak/attackMs/sustainMs/decayMs)。強さ係数の適用点を表の外(翻訳層)に。
- **翻訳層**: (word, args?, intensity)→intent.envelope payload列。存在しない語は無視+診断。
- **channel-client拡張**: `sendEnvelope`(sendSpeechと同型・写経)。helloのrequiredKindsへの `intent.envelope` 追加(器はC5から対応済み)。
- **fire-orchestrator結線**: ask返り→パーサ→speechTextをspeak+会話ログ(=**タグ込み記録の現状を修正**)、eventsを発話開始時にenvelope送出(speak開始と同時・rejectedは診断へ握る=発話は止めない)。
- **最小仮面へのタグ教示**追加。
- テスト: 全部fake(SDK/TTS/channel)で縦検証。

### Domain B: 可視化+実SDK確認+計測+docs

- 操縦席: タイムラインに**演出イベント行**(発火マーカーと同型・語と適用/拒否スロット数を表示)。未知タグはゴースト行。
- **実SDK確認(上限5 ask)**: タグ教示でタグが実際に出るか・出現位置・未知タグ率を観測→ `experiments/s4-expressions.md`(タグ出現率・未知タグ率・envelope accepted率)。
- docs(README・人間ゲート手順書=S3と同じ全器官起動+「感情が動く話題を振る」)+followup(パッケージ宣言層への昇格・Player側質感スライダー・眉Issue・タグ位置同期の将来、の台帳化)。

## 4. blockingレビュー基準

1. **器コード・C4/C5契約・lockfile完全不変**。新規依存ゼロ。S1〜S3既存挙動不変(会話ログのタグ剥離は裁定済みの意図変更としてテストで固定)。
2. 3チェック無退行。実マイク・録音物非使用。
3. パーサ・翻訳層は純関数+fixture必須。「タグが声に出る」事故の構造的防止をテストで固定(speechTextに `<` `>` が残らない性質テスト等)。
4. SDK実消費は上限5 ask。環境変数ガード遵守。
5. 終了処理・タイムアウト(従来どおり)。

## 5. choke point(ユーザーの作業)

人間ゲートのみ: 全器官起動→会話→表情が乗るのを見る(手順書はDomain Bが用意)。

## 6. Status

**完了・機械ゲート緑（2026-07-13, Orch-Sylph）。人間ゲート（美的）待ち。**

- Domain A（パーサ+演出表+翻訳層+結線）→ Domain B（可視化+実SDK確認+計測+docs）を順次実行。各ドメイン Gnome 実装 → Review-Sylph 3 レーン（spec/design/test）。
- 全 6 レビュー成果物 PASS（blocking ゼロ）: [../reviews/s4/](../reviews/s4/) domain-{a,b}-review-{spec,design,test}.md。
- 機械ゲート生数字（Orch 独立再実行）: `node --test` 284（S4前）→ 331（+47）全緑・fail 0 / 3 チェック無退行（deps・soul-zone PASS、source は既存の器コード違反 1 件のみで S4 由来ゼロ）/ lockfile hash 不変（53b21b3b）/ 新規依存ゼロ / 器コード diff 空 / preflight-fire（+演出縦貫通）・preflight-cockpit とも EXIT=0。
- 実 SDK 確認（上限 5 ask・実消費）: **タグ出現率 5/5・未知タグ 0/5・翻訳層 5/5 語 payload 化**（[../../experiments/s4-expressions.md](../../experiments/s4-expressions.md)）。タグ教示は効く。
- 成果物: [../waves/s4/](../waves/s4/) domain-a.md・domain-b.md・human-gate-procedure.md・s4-followup.md。
- 残（人間ゲート後）: 演出表の符号確定・nod 単峰の見え方・envelope accepted 率・強さ係数 CLI 配線（[../waves/s4/s4-followup.md](../waves/s4/s4-followup.md) 台帳）。
