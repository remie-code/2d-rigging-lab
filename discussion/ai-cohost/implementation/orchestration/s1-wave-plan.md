# S1 wave計画: 一文が縦に貫通する(魂の歩くスケルトン)

> Status: 計画確定(2026-07-12)。発進待ち。
> 根拠: [../s-series-decomposition.md](../s-series-decomposition.md) S1 / [s1-planning-inventory.md](s1-planning-inventory.md)(棚卸し+ユーザー裁定2件) / [../../architecture/conversation-pipeline-direction.md](../../architecture/conversation-pipeline-direction.md) §2.7 / [../../soul/llm-access-path.md](../../soul/llm-access-path.md)。
> 方式: 単一Orch-Sylph(opus)がDomain A→B→Cを順次実行。各ドメインはGnome実装+Review-Sylph 3レーン(spec/design/test)。C系列の委任規律を全面継承(子の完了主張は契約成果物ファイルのReadで裏取り/実行していないコマンドの数字を書かない/外部公開ツール禁止/ツール結果可読性の自己確認/agentId即記録)。

## 1. ゴールとゲート

一文(CLI/stdin)→Agent SDK(Opus)→AivisSpeech→**音声再生+intent.speechで自律ホストの口が同期して動く**。

- **人間ゲート(一目一聴)**: AIに一言話しかけると、ステージの体が声で答え、口が合っている。
- **機械ゲート**: モーラ写像純関数のfixtureテスト(node:test)全緑+モノレポ既存チェック(check:soul-zone / check:deps / check:source / 全テストスイート)無退行+**pnpm-lock.yaml不変**+C4契約fixture不変。

## 2. 配置と物理(裁定済み)

- 新設: **`apps/soul/agent/`**(独立npmパッケージ。workspace対象外=lockfile不変。裁定1)。
- 実装形態: **依存最小の .mjs + node:test**(参照ドライバの流儀を継承。TS化は必要が生じた段で)。ランタイム依存は `@anthropic-ai/claude-agent-sdk` のみ。devDeps ゼロを狙う。
- **install はユーザーの作業**: Domain A完了後に `apps/soul/agent/` で `npm install` を1回(choke point。§5)。エージェントはinstallしない。
- 器(runtime-player)のコードには**一切触れない**。

## 3. ドメイン分割

### Domain A: 特区パッケージ骨格+モーラ写像純関数(install不要で完結)

- `apps/soul/agent/package.json`(依存: agent-sdk固定版)+ディレクトリ骨格。
- **モーラ写像純関数**: `(audio_queryのmoras, wavDurationSec, pre/postPhonemeLength, sレンジ)` → intent.speech timeline。均等割り(裁定2)、`pau`/`N`/`cl`等enum外はエントリ脱落+時間ギャップ保持、timeMs整数化時の厳密単調保証、512上限(超過は文分割の前提でエラー)、vowel 5値保証。
- **WAVヘッダパーサ純関数**(RIFF/data長→実秒)。
- fixtureテスト(node:test、依存ゼロで実行可): 実測サンプル(棚卸しscratchpadの実データ形)を基にした固定fixture+性質テスト(単調性・enum・境界)。
- レビュー観点: 契約整合(スキーマとの突合)、純関数性、fixture十分性。

### Domain B: TTSクライアント+常駐再生+チャネル送出+同期

- AivisSpeechクライアント(組み込みfetch): `/audio_query`→`/synthesis`。話者ID既定=888753760(まお ノーマル。実測値)、設定可能に。
- **常駐再生プロセス**: PowerShell `Media.SoundPlayer` を子プロセス1本で常駐(spawn≈155msをループ外へ)、stdin指示で再生。
- チャネルクライアント(参照ドライバ写経): hello照合→intent.speech送出→accepted確認。
- **同期方式**: accepted受領→即再生指示。WAV先頭無音0.1sが器の口の立ち上がり(attack)と概ね相殺する想定。タイムラインのtimeMsはWAV実時間軸(無音込み)で組み、器の受理t=0との皮膚感のズレは一聴ゲートで判定(必要なら追撃で先頭オフセット調整)。
- 機械検証: AivisSpeech実機+自律ホスト実機での疎通スクリプト(「配線の存在≠疎通」の教訓を適用——実機で1回通す)。

### Domain C: Agent SDK統合+CLI+計測+experiments/開設

- **常駐ストリーミング入力モード**(1プロセス。12秒スポーン回避)。`settingSources: []`・`systemPrompt`=会話用最小文・`model: "claude-opus-4-8"`・`persistSession: false`・`maxTurns: 1`。**`tools: []` で全ツール無効になるかの動作確認1回を含める**(だめなら`disallowedTools`併用)。
- **APIキー混入ガード**: 起動時に `ANTHROPIC_API_KEY`/`ANTHROPIC_AUTH_TOKEN`/`CLAUDE_CODE_USE_*` が設定されていたら**起動拒否**(サブスク枠でなくAPI課金になる事故の防波堤)。
- CLI: stdinで一文→応答一文(S1はストリーミング受信を配線するが文分割は不要=応答全文で1回のTTSでよい。文分割はS4以降)。
- **計測**: 応答メタデータ`usage`+TTFT(`ttft_ms`)+E2E(入力→音声開始)を記録し、`discussion/ai-cohost/experiments/` を開設して初回計測記録(measurements流儀)を書く。
- docs: `apps/soul/README.md` 更新(agent/の位置づけ・裁定4の適用範囲注記)、人間ゲート手順書。

## 4. blockingレビュー基準(全ドメイン共通)

1. pnpm-lock.yaml・器のコード・C4契約fixtureに変更が無いこと(git status/diffで裏取り)。
2. check:soul-zone / check:deps / check:source / 既存全テスト緑。
3. 特区内でも: モーラ写像・WAVパーサは純関数+fixtureテスト必須(S系列分解§5)。
4. APIキー混入ガードの存在(Domain C)。
5. 外部公開ツール(Artifact等)使用禁止。installコマンド実行禁止。

## 5. choke point(ユーザーの作業)

1. **Domain A完了後**: `cd apps/soul/agent && npm install`(Orch-Sylphが完了報告に明記→Undineがユーザーへ依頼→完了後にDomain B/C続行)。
2. **人間ゲート時**: AivisSpeech起動+自律ホスト起動+Channel開放+URL手渡し+一言打つ。

## 6. Status

(発進後に記録)
