# S1 planning gate 棚卸し(コード接地+実機+外部一次情報)

> Status: 完了(2026-07-12)。Sylph 2体(A=リポジトリ+実機、B=Agent SDK公式ドキュメント)の報告をUndineが統合。Verdict: needs_design → ユーザー裁定2件で解消(§6)。
> 対象: S1「一文が縦に貫通する」([../s-series-decomposition.md](../s-series-decomposition.md))。

## 1. intent.speech 契約の意味論(送る側が知るべき全て)

- payload = `{timeline: [{timeMs, vowel, s}]}`。1〜512要素(513以上は `invalidPayload`、切詰めなし)。`timeMs` はms・非負・**厳密単調増加**(同時刻も拒否)。`vowel` は `a|i|u|e|o` の5値のみ。`s` は0..1(域外=`slotValueOutOfRange`、クランプなし)。根拠: `contract/channel-intent-speech-payload-schema.json`、`channel-intent-validation.ts:313-460`。
- **t=0 = 器がintentを受理した瞬間**(payloadに開始時刻なし。`channel-server.ts:323` → `speech-timeline-state.ts:120-126`)。魂は「acceptedが返った時点で口は動き始めている」前提で音声再生を合わせる。
- 無音・閉鎖の専用表現なし。「っ」は省略(参照ドライバ前例 `reference-driver.mjs:420-422`)、「ん」「pau」もenum外→**エントリを落とし時間ギャップで表す**。attackは器がモーラ間隔から導出(C6設計)。s=1でも器側で普遍係数0.8(魂は関知不要)。
- 拒否コードは既存6種のみ。拒否されても接続は維持。`slotNotWritable` = 口6スロットのどれかが書けない(モデル未ロード含む)。

## 2. チャネル接続の作法(参照ドライバ写経で足りる)

URL=ChannelページからユーザーがCLI引数で渡す(`ws://127.0.0.1:<port>/channel?token=…`、既定17310)。Node組み込み`WebSocket`(依存ゼロ)→open→`server.hello`4秒待ち→`supportedKinds`に`intent.speech`を照合→`{v:1,id,kind,payload}`送出→`replyTo`相関で accepted/rejected。未知kindのサーバイベントは黙殺義務。実機Node v22.14.0。

## 3. AivisSpeech 実機(127.0.0.1:10101、engine 1.1.0-dev)

- 話者(実測): まお(ノーマル=888753760 ほか5スタイル)、コハク(4スタイル)。
- **重大事実: audio_query のモーラ長は全零**(consonant_length/vowel_length/pitch=0.0、`/mora_length`も全零。実測で裏取り)。2026-07-10調査記録の「モーラ毎の音素長を秒単位で返す」は**このエンジン実機では成立しない**(訂正注記を [../../research/aituber-landscape-2026-07.md](../../research/aituber-landscape-2026-07.md) に記録)。将来版で実値が入るかは未調査。
- 使える時間材料 = **合成WAVの実長**。実測: 「こんにちは、テストです」= data 1.5468s、pre/postPhonemeLength 各0.1s → 発話実体≈1.347s / 10モーラ ≈135ms/モーラ(参照ドライバ手書き110〜130msと同オーダー)。
- `/synthesis` 出力 = RIFF/WAVE リニアPCM mono 44100Hz 16bit。**WAV先頭に0.1sの無音**(prePhonemeLength)。
- 句読点はmoras内に `{text:",", vowel:"pau"}` として現れる。`pause_mora: null`。

## 4. Agent SDK(TypeScript、公式一次情報)

- パッケージ `@anthropic-ai/claude-agent-sdk`(0.3.207、Node>=18、Claude Codeバイナリ同梱)。
- **サブスク認証**: 環境変数(ANTHROPIC_API_KEY等)が未設定なら、ログイン済みマシンでは`/login`のサブスクOAuth資格情報が既定で使われる(公式の優先順位、Agent SDKにも適用と明記)。**ANTHROPIC_API_KEYが設定されていると常にAPI課金**→魂の起動時ガード必須。
- 最小構成: `systemPrompt`未指定=最小プロンプト(Claude Code全文は載らない)。**`settingSources: []` を明示**(未指定だとCLAUDE.md等を読む)。`tools: []`+`disallowedTools`併用(空配列で全無効の明文なし→動作確認1回をwaveに含める)。`model: "claude-opus-4-8"`。`persistSession: false`。
- **常駐必須**: `query()`毎回はサブプロセス起動≈12秒(公式Issue #34)。**ストリーミング入力モード(promptにAsyncGenerator)で1プロセス常駐**が公式推奨。ストリーミング受信=`includePartialMessages: true`→`stream_event`のtext_delta。
- 使用量観測: resultメッセージの`usage`(トークン数)+CLI `/usage`(サブスクはドル額でなくプランバーを見る)。

## 5. 特区の依存の物理

- 現状: apps/soul は README+参照ドライバ.mjsのみ、package.json無し、pnpm-lock.yamlに出現ゼロ。
- `apps/soul/package.json` 新設 → workspace importer化(glob `apps/*`)、lockfile変化、README裁定4の改定要。
- **`apps/soul/<サブディレクトリ>/package.json` はworkspace対象外**(globは1階層のみ)→独立npmパッケージ、pnpm-lock不変。既存チェック3種(check:soul-zone/check:deps/check:source)はコード確認でいずれも非該当(bare specifier対象外・node_modules走査除外)。
- 音声再生(Windows/Node): PowerShell `Media.SoundPlayer` は依存ゼロだが子プロセス起動≈155ms実測 → **常駐プレイヤープロセス(spawn1回+stdin指示)**で起動コストをループ外へ。ffplay等は未インストール。

## 6. ユーザー裁定(2026-07-12)

1. **依存の物理 = 独立パッケージ方式**: `apps/soul/agent/`(サブディレクトリ)に独自package.json+package-lock。lockfile不変の規律を維持。installはユーザーの`npm install`。
2. **モーラ均等割り仮説をS1スコープとして採用**: audio_queryのモーラ列(種類)+WAV実長→均等配置。s値は参照ドライバの手書きレンジ前例(0.5〜0.9)を踏襲。知覚的十分性は一聴ゲートが判定(「OK、仕方ないね」)。

## 7. experiments/ の前例

render-performance の measurements 流儀(ヘッダ証言→生データ表→導出値→所見→次の含意、版は別ファイル)を踏襲する。
