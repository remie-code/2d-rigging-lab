# S7 wave計画: 視聴者が混ざる(YouTube Liveチャット)

> Status: **計画確定(2026-07-14)・発進待ち**。
> 根拠: [../s-series-decomposition.md](../s-series-decomposition.md) S7 / [s7-planning-inventory.md](s7-planning-inventory.md)(棚卸し+裁定8件=議論7+経路1)。
> 方式: 単一Orch-Sylph(opus)がDomain A→B→Cを順次実行。Gnome実装+Review-Sylph 3レーン(spec/design/test)。鉄の規律は従来。

## 1. ゴールとゲート

- **人間ゲート(一目)**: テスト配信を立て、チャットにコメントを投げる→**こーでぃーが拾って返す**(コメント内容への言及)。コメント内「こーでぃー」呼びかけへの確実応答も一言確認。**相乗り2件**: S6持ち越し④(放置45〜75秒→沈黙発火が画面に言及・頻度がうるさくないか)+S6追撃E再ゲート(自発発火の返事が画面に触れる)。
- **機械ゲート**: 全テスト無退行+新規全緑・3チェック無退行(sourceの器側既存赤1件はベースライン)・lockfile不変・**新規依存ゼロ**・器コード完全不変・**機械テストは実ネットワークに一切出ない**(fake fetchのみ・実YouTubeへのアクセスは人間ゲートの領分)・SDK実消費ゼロ(発火経路はS5/S6実証済みの再利用)。

## 2. 設計の枠(裁定済み・詳細はinventory)

- **取得経路**: 非公式innertube・依存ゼロ自前実装(ユーザー裁定・ToSグレー開示済み)。GET watchページ→公開値4点抽出(INNERTUBE_API_KEY/clientVersion/continuation/videoID)→POST get_live_chat をcontinuationで回す。公式APIキー実装への差し替えは器官内で完結する梯子(followup)。
- **壊れる前提の独立器官**: 新器官 `src/chat/`。取得死は魂に無影響——死んだら診断(ゴースト行)+器官内自動再接続(バックオフ)。魂の他部位はチャット器官を知らない(合流はappend経由のみ)。
- **合流**: 転写バッファへ speaker:"viewer"+displayNameフィールドで追記(単一タイムライン・soul先例踏襲=startMs/endMs=0,0・窓はappendedAtMs)。注入描画は `viewer(名前): 本文`。
- **発火**: スケジューラ第5の語彙=コメント到着(不応期+確率+予算・S6写経・v0定数)。コメント内「こーでぃー」照合(既存純関数再利用+テキスト用揺れ集合: Cody/cody/こーでぃー/コーディ等)=確実に返す(独立kindで観測性確保)。どのコメントに触れるかはLLMが選ぶ(機械信号は「来た」だけ)。発火はいずれも既存 `fire({vision:"preferred"})` 経路に相乗り(orchestrator無変更見込み)。

## 3. ドメイン分割

### Domain A: チャット器官(`src/chat/`・独立器官)

- **innertube-client**: watchURL/videoID/チャンネル`/live`URL の受理→ページfetch→4点抽出→get_live_chatループ(timedContinuationDataのtimeoutMs尊重・既定は数秒間隔の定数)。メッセージ解析: liveChatTextMessageRenderer(本文runs結合+著者名)を一級、paidMessage系は本文があれば同様に、その他rendererは無視+種別診断。
- **ライフサイクル**: start/stop・状態機械(connecting/live/retrying/dead)・自動再接続(バックオフ+上限なし・配信終了/未開始は明確な状態として区別)・エラー分類(notLive/ended/extractFailed/network)。フック: onMessage/onStatus/onDiagnostic。**ディスク書き込みなし・魂の他部位へのimportなし**。
- テスト: **fake fetchのみ**(実HTML断片fixtureで抽出・continuationループ・renderer分岐・壊れ方全分類=抽出失敗/スキーマ変化/ネットワーク死→retrying遷移・終了検知)。実YouTubeへは出ない。

### Domain B: 合流+発火結線(mind)

- transcript-buffer: speaker "viewer" 追加+displayNameフィールド(閉集合バリデーション拡張・frozenエントリ形拡張)。
- fire-injection: labelOf拡張(`viewer(名前):`・soul以外→you の防御実装を三値へ)。
- fire-scheduler: `handleChatMessage({text, displayName})` 新設(handleTranscript同型)・kind "comment"(不応期+確率+予算=区切り応答の写経・定数新設)・コメント内呼びかけ照合(既存normalizeForMatch/textMatchesName再利用+テキスト用needle集合)→kind "comment-call"(確実・busy/OFF時は他と同じく沈黙)。
- cockpit-server結線: チャット器官のonMessage→buffer.append+SSE・振り分けswitchにcomment/comment-call追加(→fire({vision:"preferred"}))。
- テスト: 全fakeで縦貫通(fakeコメント→append→注入文にviewer行→発火kind別・呼びかけ確実・不応期/確率/予算・OFFトグル・S1〜S6無退行)。

### Domain C: 操縦席+docs+人間ゲート手順

- 操縦席: 配信URL/ID入力欄(Channel欄写経・settings永続化)+「Connect chat」開始/停止・チャット器官の状態表示(connecting/live/retrying/dead)・viewer行の表示(speaker表示は既存流儀+CSS)・コメント発火マーカー(selfFire拡張=kind表示)・取得死/抽出失敗のゴースト行。
- docs: README・**人間ゲート手順書**(テスト配信の立て方=限定公開でよい・コメント投稿→応答確認・S6④相乗り+追撃E再ゲートの一点確認を明記)・s7-followup台帳(ToSグレーの記録・公式APIキー差し替えの梯子+quota単価実測・表記揺れ集合の実運用拡張・スパム/荒らし対策はS8安全弁の領分・多コメント時の間引き)。
- SDK実消費ゼロ(実射は人間ゲート)。

## 4. blockingレビュー基準

1. **器コード・契約JSON・lockfile完全不変。新規依存ゼロ**(素のfetch/Node組み込みのみ)。S1〜S6既存挙動不変(speaker拡張は追加的変更としてテスト固定)。
2. **機械テストは実ネットワークに出ない**(fake fetchのみ・実YouTubeアクセスや実配信を要するテスト・preflightを作らない)。実マイク・録音物非使用。
3. チャット器官は独立(魂の他部位へのimportなし・逆方向はhooks経由のみ)。壊れ方全分類がテストで固定され、**死んでも魂の動作(発火・会話・既存器官)に影響しないこと**をテストで固定。
4. スケジューラ拡張は決定論テスト(fake clock+注入RNG)。「いつ喋るか」判断にLLM ask不在の規律維持。
5. 3チェック無退行。SDK実消費ゼロ。終了処理・タイムアウト(従来どおり)。

## 5. choke point(ユーザーの作業)

人間ゲートのみ: テスト配信(限定公開可)を立てる→操縦席で配信URLを設定しConnect→コメントを投げる→拾って返すのを見る(+④相乗り+追撃E一点)。手順書はDomain Cが用意。

## 6. Status

計画確定・発進待ち。
