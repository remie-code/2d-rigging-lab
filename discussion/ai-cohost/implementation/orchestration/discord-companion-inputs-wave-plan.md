# Discordチャット資料とモバイルVC操作 — 2 Wave

後続: [小タスクセッション共通基盤の3 Wave](local-task-sessions-wave-plan.md)が実装・独立レビュー合格。この記録のPDF先頭3ページ方式は、場に原本を保持し別担当が必要ページを読む方式へ置換済み。読むチャット設定・VC操作は引き継いでいる。

2026-11-16。context-check、2 Wave・単一Orchの簡易構成、CodexへのPDFパス渡しを最初に試す方針を合意。ユーザーが計画作成・起動を承認。
状態: 両Waveの実装・独立レビュー合格。最終ソースのSoul全2,567件成功、通常Cockpit起動を隔離コピーで確認。単一Sol Orch `/root/discord_companion_orch` の報告をrootが受領。ブランチ `codex/discord-companion-inputs`、開始時HEAD `8369493e`。実Discordの本人確認とClaude実モデル読取は未確認。[Wave 2完了](../waves/discord-companion-inputs/wave2-completion.md)・[本人確認](../waves/discord-companion-inputs/human-gate.md)。

PDFはパス渡しを先に試し、直接検索できる非圧縮文字PDFのみ成功。画像PDFは現行read-onlyで画像書き出しが成立せず、Windows標準描画→既存画像入力を採用した。合成2種のCodex正答を実証、先頭3ページが対象。ClaudeはOAuth期限切れで実応答未検証。[実験と測定範囲](../waves/discord-companion-inputs/pdf-path-experiment.md)。Player／依存パッケージ変更なし。

## 合意した目的と範囲

- 指定したDiscordチャットの新規テキスト・画像・PDFを、既存の音声会話で扱う。投稿ごとの強制発話は不要。代表体験は「今チャットに貼った、見れる？」。
- 読む先はCockpitで選択・変更する。モバイルからの変更UIは不要。VC接続先と読むチャットは別の設定として扱う。
- Bot自身が閲覧できる情報源を基準にする。将来、操作者には見えずBotとGMだけが読めるチャットにも対応できる境界を保つ。今回秘匿ハンドアウトの全体験やDM対応を追加するわけではない。
- 受信全文をCockpitの公開会話ログへ必ず載せる構造にしない。資料とライブ視界を分け、写真が現在も見えていると誤認させない。
- 読む先の変更は今後の受信先の変更。既に会話で知った情報の忘却は要求しない。切替後に旧受信先の遅延処理が新着として混入することとは区別する。
- 家のPCでDiscordの場を開く既存の操作を維持。DiscordからVC参加・退出を操作でき、退出後も同じ場へ再び呼べる。
- 操作権限はDiscord標準のコマンド権限に準拠。独自ユーザー許可リストを新設しない。Botの閲覧・接続・発話権限とは区別する。
- 遠隔PC起動、アプリ／場の遠隔起動・終了、場を閉じても応答するサービス、自由なチャット投稿、常時屋外映像、家用カメラの実装は範囲外。
- 個人的なデバイス選定、端末識別情報、実投稿・添付・秘密情報はGitへ入れない。既存の追跡除外を維持する。

## Accepted User Gate

### あなたが受け取るもの／行うこと
- 家のPCで既存のDiscordの場を開き、Cockpitで読むチャットを指定・変更する。
- モバイルのDiscordからチャッピーを自分のVCへ呼び、選んだチャットにテキスト・画像・PDFを投稿する。
- VCで「今チャットに貼った、見れる？」などと尋ね、その内容について会話する。
- DiscordからチャッピーをVC退出させ、場を開いたまま後でもう一度呼ぶ。

### あなたが判断すること
- 指定したチャットの資料を使って会話でき、外出先から呼ぶ・話す・退出する体験として使えるか。

### あなたが判断しないこと
- PDFの読み取り方式、内部の受け渡し契約、実装・自動テストの適否は担当エージェントが検証する。

### 合格条件
- 読むチャットの設定・変更、投稿したテキスト／画像／PDFについてのVC会話、Discordからの参加・退出・再参加が一連の操作として成立する。
- 場を開く既存のPC操作は維持し、VC退出だけで場を終了しない。
- 内部検証が合格しても、この本人確認を代行して合格と記録しない。

### 違和感や不足があった場合のフィードバック
- どの操作・投稿・発話で期待と違ったかをユーザーと確認し、元の体験に照らして修正する。

## 調査済みの事実と未実証事項

以下は実装前のコード読解・公式仕様確認であり、実動作の合格ではない。

- Discordの公開 `vc.join/leave/move` と場／接続のライフサイクルを再利用できる。Gatewayコマンドからも場がopenかを確認する必要がある。
- `loginClient` は場の入口と準備時の一時ログインで共用。チャット受信用intentの一律追加で既存準備を壊さないこと。Message Content Intentの設定要否を利用手順へ含める。
- 通常のテキストチャットとVC付属チャットが今回の主要経路。ユーザーの画面キャプチャを読む実装ではない。
- 既存 `venueTranscript` はsnapshot/SSE/exportに出る。資料をそこへ直積みすることを必須にせず、会話入力への経路を分ける。
- Claude SDKのcontent配列にPDF documentを渡す経路は候補だが、現行SDKの実スモークは未実施。
- Codex App Serverの直接inputはtext/image/localImage。ただし、PDFをローカル保存して絶対パスを渡し、セッション内ツールで読む経路は別にある。アプリ側の事前変換が必須と決めつけない。
- 現行Codexは専用一時cwd、read-only、approval never、ツールのネットワーク無効。shell自体の禁止は見当たらない。実際の起動環境のPDF読取ツール、画像PDFの扱い、読取遅延は未実証。
- 調査端末に一部PDFコマンドが見つかっても、通常のSoul起動環境や配布先で使える証拠にはしない。

入口:
- [体験の前提](../../real-world-companion/scope-and-decisions.md)
- [視界とチャット資料](../../real-world-companion/vision-and-chat-input.md)
- [VC操作](../../real-world-companion/mobile-vc-control.md)
- [限定棚卸し](../../real-world-companion/repository-inventory-2026-11-16.md)
- [秘匿資料の過去記録](../../real-world-companion/discord-private-handout-history-2026-11-16.md)
- source: `apps/soul/agent/src/discord/discord-experience.mjs`、`src/cockpit/cockpit-server.mjs`、`src/cockpit/ui/discord-panel.mjs`、`scripts/cockpit.mjs`、`src/mind/fire-orchestrator.mjs`、`src/mind/codex-session.mjs`、`src/mind/llm-session.mjs`（src以下は同agent package）。
- [Discord commands](https://docs.discord.com/developers/docs/interactions/slash-commands)、[Gateway intents](https://docs.discord.com/developers/events/gateway#gateway-intents)、[Codex App Server](https://learn.chatgpt.com/docs/app-server)、[Claude PDF](https://platform.claude.com/docs/en/build-with-claude/pdf-support)。

## Wave 1 — 資料を会話で読める土台

単一Orch内で順次進行する。

1. **最小のPDF実験**。推測できない内容を持つ合成の文字PDFと画像主体PDFを用意。通常のcockpitと同じ起動・sandbox条件の隔離Codexセッションへ絶対パスと質問を渡す。まず既存の道具で読む方法を試す。ツール実行、内容の読取結果、応答時間／測定範囲を残す。実チャッピーの会話や個人資料を流用しない。
2. 不足すれば読取ツールを用意して再確認し、それでも不足する部分でアプリ側変換を検討。初手からPDF変換基盤を作らない。shellやファイルへの権限を無制限に広げて解決しない。Claude側も現行の接続で合成PDFを試す。新たな有料サービスや別認証方式を導入する判断はrootへ返す。
3. 結果をもとに短いbasisを作る。投稿と添付の識別、著者・時刻・共有先、資料の取得／準備状態、場の寿命、切替時の扱い、会話へ渡す方法を定める。具体的な形式・サイズ制限・保持量等は既存運用に合わせ、黙って読み落としたものを読めたと扱わない。
4. 資料保持と通常／視覚Fireの会話入力への接続を実装。受信だけで強制発話せず、次の応答で参照可能にする。資料の内容は外部由来の情報として扱い、会話のsystem指示に昇格させない。
5. 独立レビュー。PDF実験と資料の受渡し契約が裏付けられ、次Waveから使えることを確認してからWave 2へ進む。

成果: `waves/discord-companion-inputs/basis.md`、`pdf-path-experiment.md`、`wave1-completion.md`、`reviews/discord-companion-inputs/wave1-review.md`。
PDF経路が現設定で成立しなくても事実を記録し、承認済みの代替検討内で進める。体験・権限・運用の変更が必要ならescalate。

## Wave 2 — Discord受信・操作・実会話への統合

Wave 1合格後、同一Orchで順次実施。Discord client共有箇所を無理に並列編集しない。

1. Botから読めるチャットの選択・変更をCockpitへ追加し、新規投稿のテキスト・画像・PDFをWave 1へ渡す。通常チャット／VC付属チャットを扱う。権限不足、添付取得失敗、準備中、切替後の古い取得を取り違えない。
2. Discordのコマンドで既に開いた場のVC参加・退出を操作。既存の接続操作を共有し、PC操作との競合、場の開閉途中、別サーバー、既に接続中の場合を扱う。操作権限はDiscord設定に従う。
3. コマンドの具体名・機械的な応答文等は裁量で定めて手順に記録する。既存VC操作の意味を無断で変えない。他のVCの会話を強制移動するなど新しい製品判断が必要な場合はrootへ返す。場を閉じた場合に常駐応答を作らない。
4. 統合テストと独立レビュー、通常の起動経路での確認。Bot設定と操作の手順をまとめる。実Discordへ勝手に投稿・参加して他者を巻き込む検証は行わず、fixture／隔離環境と本人の実操作を分ける。
5. 普段の起動方法で使える成果を届ける。Soulのみの変更なら不要なPlayer再ビルドはしない。通常起動に必要な依存・配置は整える。Player変更が実際に必要なら通常の `apps/runtime-player/dist/win-unpacked/Runtime Player.exe` 等まで反映する。稼働中アプリを無断終了しない。

成果: `waves/discord-companion-inputs/wave2-completion.md`、`human-gate.md`、`reviews/discord-companion-inputs/wave2-review.md`。human-gateには設定、起動、読む先の変更、Discord操作、必要時の戻し方、未実測項目を記載する。

## 内部確認（User Gateとは別）

- 合成資料の読取結果を確かめる。文字だけの成功を画像主体PDFの成功と扱わない。読取失敗／未完了は会話にそのまま反映可能にする。
- 投稿の重複・遅延取得、選択先変更、場の終了、再接続で異なる場／情報源を混同しない。過去資料の記憶と切替後の誤受信を区別する。
- 添付の型・サイズ・期限・取得先を検証し、ファイル名による意図しない保存先への書込を防ぐ。実データ／秘密をテストfixtureやGitへ入れない。
- チャット受信設定の不足が既存の準備・音声経路へ与える影響を確認し、原因が分かる表示／手順を残す。
- VC退出→再参加、PCとDiscord操作の競合、場のopen/close境界、Discord標準権限、既存音声・視覚経路を対象テストで確認。
- 独立レビューはbasis・実差分・テスト・実行証拠を読む。実APIで確認できなかった部分をfakeで確認済みと区別する。必要十分な回帰テストと既存必須チェックを実施する。

## オーケストレーションと所有権

- root → 単一Orch-Sylph → 別コンテキストGnome／独立Review-Sylph。Orch以下の全モデルはGPT-6.1 Sol。子を呼ぶ場合 `fork_turns:none` と明示モデルを使い、必要なbasisと本User Gateを渡す。
- 簡易構成: 担当数・文書量を絞り、各Waveの実装／独立レビューの分離は維持。各Wave最大5修正ループ。正常な子の作業を待ち、timeoutを失敗扱いしない。
- Orch-Sylph自身は実装担当ではない。source implementation は必ず別コンテキストの Gnome に委譲し、レビューは必ず別コンテキストの Review-Sylph に委譲すること。これを分離できない場合は実装せず escalate / blocked として報告すること。
- Gnomeは関連するSoulコード・テスト・依存と必要な起動用資産を所有。Orchはwave成果、Review-Sylphは独立レビューを所有。rootは本計画・map・ユーザー判断を所有。
- 全員共有workspaceで作業。他者の編集や未追跡の運用データを戻さない。既存の個人向けdevice記録とattachmentsのGit除外を維持する。
- 今回は計画作成・起動を承認済み。commit／merge／pushは別依頼まで行わない。
- Wave 1の独立合格を報告したうえで、合意内ならWave 2へ自律継続してよい。新しいユーザー判断が必要なら、その依存部分を止めて具体的にrootへ報告する。
