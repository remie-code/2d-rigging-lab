# S7 planning inventory: 視聴者が混ざる(YouTube Liveチャット)

> Status: 完了(2026-07-14)。議論裁定7件+取得経路裁定(§5)で全て解消。wave計画は [s7-wave-plan.md](s7-wave-plan.md)。
> 実施: Sylph A(外部実態: YouTube取得経路・quota算数・npm生態系)・Sylph B(リポジトリ: 合流点地図)。
> 根拠: [../s-series-decomposition.md](../s-series-decomposition.md) S7(チャット取得層=壊れる前提の抽象化)。

## 1. 議論で確定した裁定(2026-07-14)

1. **YouTube一本**(v0)。
2. **壊れる前提**: 取得死は魂の動作に無影響。独立器官(耳・目と同格)・死んだら診断(ゴースト行)+器官内自動再接続・魂の他部位はチャット器官の存在を知らない。
3. **単一タイムライン+話者ラベルで合流**: コメントは転写バッファ正本に `viewer(名前)` として合流。箱は分けない(「箱を分けるとコンテキストがもう管理不能になる」=ユーザー裁定)。時系列一本が配信の文脈。
4. **どのコメントに触れるかはLLMが選ぶ**: 機械信号は「来た」だけ。内容選択は「何を言うか」の一部(S6原則の再適用)。
5. **第5の発火語彙=コメント到着**: 不応期+確率+予算(S6区切り応答の写経)。**コメント内「こーでぃー」=確実に返す**(音声呼びかけと対称・文字照合なのでASR揺れと無縁、ただし視聴者の表記揺れは別集合)。
6. **数値はv0コード内定数**。
7. **頻度は将来Cockpit可変**: S6口数モード台帳(s6-followup §12)に合流——声への反応とコメントへの反応が一緒に変わるのが自然形。

## 2. 外部実態: YouTube Liveチャット取得の3経路(Sylph A)

### 2-1. 公式 Data API v3

- **公開配信のチャット読み取りはAPIキーのみで可**(liveChatMessages.listにOAuth要求なし・公式リファレンス確認済み)。`videos.list(id=<videoID>)→activeLiveChatId`(1unit)→`liveChatMessages.list` ポーリング。
- **quota算数が未確定**: 全エンドポイント合算10,000units/日(2026-06改定)の下、liveChatMessages.listの単価が**公式quota表に載っていない**(下限1unit)。単価1なら6時間×5秒間隔=4,320units/日で足りる・単価5なら21,600で**枯れる**——**単価次第で可否が反転**し、実測(1時間試してGCPコンソールで確認)でしか確定できない。公式は `streamList`(server-streaming)を推奨するが単価・接続持続仕様が非公開。
- OAuth経路(liveBroadcasts.list mine=true)は同意画面Testing状態で**refresh token 7日失効**の運用地雷。公開配信ならAPIキーのみで足りるため回避可能。
- セットアップ: GCPプロジェクト+API有効化+キー発行(審査なし・数分・ユーザーの作業)。

### 2-2. 非公式(innertube・youtube-chat方式)

- 仕組み: GET `youtube.com/watch?v=<ID>`(または `/channel/<ID>/live`)→HTML内の公開値4点抽出(INNERTUBE_API_KEY・clientVersion・continuation・videoID)→POST `youtubei/v1/live_chat/get_live_chat` をcontinuationで回す。**認証不要・quota無関係・依存ゼロ(素のfetch)で150〜300行規模**(youtube-chat実装読みの見積り)。
- 壊れ方: 正規表現外れ・rendererスキーマ変更・エンドポイント変更——**いずれも「抽出失敗の例外/actions空」として即観測可能**=死亡検知が容易で「壊れる前提の器官」設計と整合。
- 生態系の事実: 専用ライブラリはメンテ放棄が頻発(pytchat 2022アーカイブ・youtube-chat 2022更新停止)だが**経路自体は2026年現在も生きとる**(Go実装が2026-06にもリリース)。
- ToS上の事実(判断材料): innertubeは公式ドキュメントのある公開APIではない。YouTube ToSは自動化アクセスを原則制限(公式APIサービスの保護=deprecationポリシー等は受けられない)。個人が自分の公開配信のチャットを読む用途、という文脈はある。

### 2-3. npm既存ライブラリ

現役は実質 `youtubei.js`(17.2.0・2026-07更新・pure JS依存3つ)のみ——ただしフルYouTubeクライアントで**unpacked 15.7MB**。チャット取得だけには過大。youtube-chat系は全て更新停止/アーカイブ。

### 2-4. 配信の特定と境界挙動

- video ID手入力が最安・最確実(公式1unit/非公式はGET1回)。チャンネルURLからの自動検出も両経路で可(非公式は `/channel/<ID>/live` のcanonical追い・認証/quota無関係)。
- 配信開始前・終了後は両経路とも**明確なエラー形**(公式: liveChatNotFound 404/liveChatEnded 403・非公式: canonical不在/isReplay)——「死んだら診断+再接続」の器官設計にそのまま乗る。

## 3. リポジトリ側の受け皿(Sylph B・file:line付き)

- **転写バッファ**(transcript-buffer.mjs): speakerは閉集合 `VALID_SPEAKERS={you,soul}`(:70・validate :119-124)→viewer追加はここ。エントリ形はfrozen(:145-152)・表示名フィールドなし。**壁時計発話の先例あり**: soulは `startMs:0, endMs:0`+窓はappendedAtMsで切る(ヘッダ:35-39に明文化)——コメントは同型で載る。onAppendリスナーはthrow禁止契約(:41-46)。
- **注入描画**(fire-injection.mjs): `labelOf` がsoul以外を全部"you"に潰す防御実装(:37-39)——**ここが必須変更点**。行整形 :87。窓/上限はentriesの `{text,speaker?,appendedAtMs}` しか見ないためviewer行は自然に乗る。
- **スケジューラ**(fire-scheduler.mjs): 入力口は handleVadEvent/handleTranscript(:306-347)——コメント用は `handleChatMessage` 同型追加が自然。FireRequest kind union(:179)+emitFire(:258-265)。不応期(:296)・確率(:297)・予算(:271,:285)の写経元。**呼びかけ照合の純関数群(normalizeForMatch/buildNeedles/textMatchesName :117-158)は音声専用の前提なし=コメント文字列にそのまま再利用可**。
- **結線**: scheduler→orchestratorは cockpit-server.mjs:955-987 の振り分けswitch1箇所——silence→fire({vision:true})・call/turn-end→fire({vision:"preferred"})。**コメントkindはこのswitchに1分岐足すだけでorchestrator無変更の見込み**。
- **操縦席**: URL入力(Channel欄 cockpit.html:158-163)・select+一覧(vision-target :166-172)・ゴースト行(:357-369)・マーカー行先例(selfFire :471-483)・SSE追加は broadcast+addEventListener(:722-777)・設定はsettings-store getter/setterペア追加。話者行は `d.speaker||"you"` をそのまま表示(:329-348)=viewer行はSSEにspeakerが乗ればほぼ無変更(CSSのみ追加)。
- **器官の起動/停止の流儀**: ear-pipelineはcockpit-server所有のPOST駆動遅延起動(:514-642)・session/playerはcockpit.mjsのensureFireResources(:369-389)・終了処理shutdown(:531-562)。チャット器官は「cockpit.mjsで生成しhooks注入・closeで畳む」形が既存流儀。
- **テストの流儀**: fake fetch(whisper-client.test.mjs:44-89)・fake clock(fire-scheduler.test.mjs:27-58)・SSE/HTTPテスト(cockpit-server.test.mjs:23-122)・fake WS(ws-double.mjs)——チャット器官のポーリング機械テストに全部写経可。

### 3-1. 計画内で確定する実装形(L0裁定・ユーザー裁定不要の実装詳細)

- viewer名の持ち方: **speaker:"viewer"+displayNameフィールド追加**(speaker文字列に名前を埋め込まない——閉集合バリデーションと照合の単純さを保つ)。注入描画は `viewer(名前):`。
- コメントの時刻: **soul先例踏襲(startMs/endMs=0,0・appendedAtMs窓)**。

## 4. waveへ持ち込む検証・計測項目

1. 取得経路の実疎通(実配信 or テスト配信での1回の取得確認は人間ゲート)。
2. コメント到着→合流→発火→返事の縦貫通(機械はfake fetchで・実射は人間ゲート)。
3. S6持ち越し④(沈黙発火の実機体感)の相乗り確認。

## 5. 残る裁定(ユーザー)

**取得経路の選択**——事実は§2の通り。比較の要点:

| | 公式APIキー | 非公式innertube | youtubei.js |
|---|---|---|---|
| ユーザーの設営 | GCPキー発行(数分・一回) | **なし** | install |
| 依存 | ゼロ(fetch) | **ゼロ(fetch・150〜300行)** | +15.7MB |
| 長時間配信 | **quota単価未公表で可否が反転**(要実測) | quota無関係 | quota無関係 |
| 壊れ方 | 予測可能(quota枯渇=日次で死ぬ) | 予告なし(ただし死亡検知容易・歴史的に経路は長寿) | 同左(メンテは活発) |
| ToS | 白 | **グレー**(非公式API・自動化制限の原則) | グレー(同経路) |

推奨(Undine): **非公式innertube・依存ゼロ自前実装**——「壊れる前提の独立器官」裁定はこの経路のために打った布石でもある。取得層は抽象化済みやから、壊れて直せん日が来たら公式APIキー実装への差し替えが器官内で完結する(それが§1裁定2の意味)。ToSグレーの事実は記録の上でユーザー判断。

**裁定(2026-07-14・ユーザー)**: 「これでいこう」——**非公式innertube・依存ゼロ自前実装を採用**。ToSグレーの事実は開示の上での判断。公式APIキー実装への差し替えは器官内で完結する梯子としてfollowup台帳に残す(quota単価の実測もその時)。
