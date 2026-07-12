# S3 wave計画: 呼べば応える(発火+会話ログ注入)

> Status: **完全閉鎖(2026-07-12)**。全レーンPASS+追撃domain-c+人間ゲート合格(「全く問題なかった」——初の全器官同時稼働で文脈を踏まえた返事)。
> 根拠: [../s-series-decomposition.md](../s-series-decomposition.md) S3 / 設計裁定4件(ユーザー 2026-07-12、§2) / [../screens/soul-cockpit.md](../screens/soul-cockpit.md) §3拡張予約 / [../../architecture/conversation-pipeline-direction.md](../../architecture/conversation-pipeline-direction.md) §2.2〜2.3・§2.7。棚卸しなし(Plan directly: 部品は全部S1/S2/S2.5実装済み・新規導入ゼロ)。
> 方式: 単一Orch-Sylph(opus)がDomain A→Bを順次実行。Gnome実装+Review-Sylph 3レーン。鉄の規律は従来+**環境異常対策(子のツール結果が空/中断なら再試行3回で正直停止)**。

## 1. ゴールとゲート

- **人間ゲート**: 独り言をしばらく→操縦席のFire→**直前の話を踏まえた返事が声+口で返る**——原則「AIは全部聞くが、全部では考えない」が初めて見える。初の全器官同時稼働(器+AivisSpeech+耳+知性+チャネル+操縦席)。
- **機械ゲート**: 全テスト(231+新規)無退行+3チェック+lockfile不変+新規依存ゼロ+SDK実消費は最小(fake注入でテスト・実askは動作確認数回)。

## 2. 設計の枠(裁定済み)

1. **発火経路**: 操縦席にFireボタン+魂に `POST /api/fire`。実運用のゲーム中発火はAHKからHTTPを叩く(**AHKスクリプトを成果物として同梱**・AHK installはユーザーの任意・ゲートはボタンで成立)。
2. **注入範囲**: **直近X分の会話ログ全部**(既定X=5分・文字数上限の安全弁つき=超過時は新しい方優先)。X・上限は設定値。
3. **会話ログ**: 転写バッファを話者付き会話ログへ**追加的に**昇格(speaker: "you"|"soul"、既定you=S2挙動不変)。魂の発話(実際にTTSに渡した最終テキスト)をspeaker="soul"で記録。
4. **最小仮面(v0)**: 「配信の相方。直前の会話を踏まえ、短く自然な日本語で返す」程度の最小システムプロンプト。凝るのはpersonaの領分——**意図的に貧しく**。
5. busy時のFire(発話中/思考中)は**無視+操縦席にbusy表示**(重ね発火・割り込みはS4/S6の領分)。

## 3. ドメイン分割

### Domain A: 会話ログ+発火オーケストレーション(魂の胴体)

- 会話ログ昇格(speakerフィールド追加・既存API/テスト無退行・S2挙動不変)。
- **注入整形の純関数**(会話ログ→X分窓切り出し→文字上限→LLM入力テキスト。話者ラベル付き整形。fixtureテスト)。
- **発火オーケストレータ**: fire→窓収集→llm-session(最小仮面・claude-opus-4-8)→応答テキスト→speak(S1経路: TTS→再生+intent.speech)→会話ログへsoul記録。busy状態機械(idle/thinking/speaking、busy中fire無視)。
- `POST /api/fire` +状態のSSE配信(cockpit-serverへの追加的結線)。
- テスト: fake queryImpl/fake TTS/テストダブルchannelで縦の機械検証。S1既存のspeak・llm-sessionは変更しない(結線のみ)。

### Domain B: 操縦席拡張+AHK+計測+docs

- 操縦席: **Fireボタン**(busy表示連動)、Timelineに**話者soulの行**(スタイル差)+**発火マーカー**(UX定義§3の予約の実体化。§2に追記)。
- AHKスクリプト同梱(`scripts/fire-hotkey.ahk`: グローバルキー→POST /api/fire。README に導入手順)。
- 計測→ `experiments/s3-summon.md`(Fire→応答開始(TTFT)→音声開始のE2E、usage、注入文字数。実askは最小回数)。
- docs(README・人間ゲート手順書=全器官起動の手順)+followup。

## 4. blockingレビュー基準

1. lockfile・器コード・C4契約・S1/S2/S2.5既存挙動不変(会話ログのspeaker追加は追加的変更としてテストで無退行を証明)。新規依存ゼロ。
2. 3チェック無退行。実マイク・録音物非使用。
3. 注入整形は純関数+fixtureテスト。SDK実消費は最小(上限5 ask)・環境変数ガード遵守。
4. 発火口が127.0.0.1限定の既存バインドの内側にあること(外部露出なし)。
5. 子プロセス/サーバの終了処理・テストのタイムアウト(従来どおり)。

## 5. choke point(ユーザーの作業)

人間ゲートのみ: 全器官起動(AivisSpeech・自律ホスト+Channel・操縦席)→マイクで独り言→Fire→聴く。AHK導入はゲート後の任意。

## 6. Status

- **実装・レビュー完了（2026-07-12, Orch-Sylph）。人間ゲート待ち。**
- Domain A（会話ログ + 発火オーケストレーション）: 実装 [../waves/s3/domain-a.md](../waves/s3/domain-a.md) / 統合レビュー **PASS（blocking ゼロ）** [../reviews/s3/domain-a-review.md](../reviews/s3/domain-a-review.md)（3 レーン spec/design/test 全 PASS）。
- Domain B（操縦席拡張 + AHK + 計測 + docs）: 実装 [../waves/s3/domain-b.md](../waves/s3/domain-b.md) / 統合レビュー **PASS（blocking ゼロ）** [../reviews/s3/domain-b-review.md](../reviews/s3/domain-b-review.md)（3 レーン全 PASS・spec non-blocking の字面 4 箇所は wave 内即時回収済み）。
- 機械ゲート（最終検証・Orch 独立実測）: `node --test` **269/269 緑**（231 → Domain A +26 → Domain B +12。決定的 = 複数回同数）・`preflight-fire` / `preflight-cockpit` **PASS/EXIT=0**・lockfile 3 種差分ゼロ・新規依存ゼロ・3 チェック無退行（soul-zone 緑 1320 / deps 緑 / source は器 pre-existing 1 件のみ）。
- SDK 実消費: **5 ask（上限 5 の契約内・measure-fire.mjs・ハードガード付き）**。実測 TTFT ≈3.2〜3.9s / ask ≈6.0〜6.8s → [../../experiments/s3-summon.md](../../experiments/s3-summon.md)。
- 人間ゲート手順書: [../waves/s3/human-gate-procedure.md](../waves/s3/human-gate-procedure.md)（全器官起動: AivisSpeech → 器 + Channel → 操縦席 `--channel` → マイク Start → 独り言 → Fire → 声 + 口）。音声開始 E2E と遅延 append 観測は s3-summon.md §3/§4 の記入欄へ。
- 持ち越し台帳: [../waves/s3/s3-followup.md](../waves/s3/s3-followup.md)。
- 2026-07-12: **追撃domain-c**(人間ゲート観測2件): soul行二重表示を修正(魂発話が正規放送+耳の話者無差別購読の**二経路**でSSE配信されていた。fake pipelineが経路Bを再現しない構成だったため機械検証をすり抜けた——修正は話者ガード1行+赤→緑の生証明つき回帰テスト)。Channel URLの操縦席入力(記憶・token秘匿・`--channel`後方互換)。284/284緑。S8宛の台帳化: 再生デバイス選択ノブ(音声ルーティング設計と同時に本対応・ユーザー裁定「応急処置は不要」)。
- 2026-07-12: **人間ゲート合格(ユーザー実施)→ S3 完全閉鎖**。初回ゲートで心臓部(「直前の発言を踏まえたセリフ」)成立を確認、再ゲートで「**全く問題なかった**」——URL入力・soul行単一表示・全器官同時稼働(器+AivisSpeech+耳+知性+チャネル+操縦席)。途中の「fire error: fetch failed」はAivisSpeech未起動が原因(ゴースト行の観測性が診断を即決させた=追撃Fの投資回収)。**原則「AIは全部聞くが、全部では考えない」が初めて人間の目に見えた**。
