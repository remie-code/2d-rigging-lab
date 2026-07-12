# S2.5 wave計画: 操縦席がある(魂のローカルWebコクピット)

> Status: 計画確定(2026-07-12)。発進待ち。
> 根拠: [../s-series-decomposition.md](../s-series-decomposition.md) S2.5(追補) / [../screens/soul-cockpit.md](../screens/soul-cockpit.md)(**Accepted、実装のsource of truth**)。棚卸しなし(context-check判定=Plan directly: 部品は全部S2実装済み・外部未知ゼロ・新規依存ゼロ)。
> 方式: 単一Orch-Sylph(opus)がDomain A→Bを順次実行。各ドメインはGnome実装+Review-Sylph 3レーン。S1/S2と同一の鉄の規律。

## 1. ゴールとゲート

- **人間ゲート(一目)**: ブラウザで操縦席を開き、マイクを選んで耳を起動し、喋ると転写がタイムラインに積もるのが見える。**CLIを一切触らない**。
- **機械ゲート**: cockpitサーバ(HTTP/ライブ更新/制御API)のテスト全緑+既存全テスト(196件)無退行+3チェック無退行+lockfile不変+新規npm依存ゼロ。

## 2. 設計の枠(UX定義§1の写し+実装制約)

- 127.0.0.1バインドのみ・認証なし(v0)・単一ファイル配信のvanilla HTML/CSS/JS・ビルドチェーン非導入・**新規npm依存ゼロ**。
- 正本はプロセス側: コクピットは既存API(ear-pipeline・transcript-buffer・デバイス列挙・死活監視)の**ビュー**。魂のロジックへの変更は結線点の追加のみ(S2挙動不変)。
- ライブ更新の伝送(WS自前 or SSE)は**Gnomeの設計事項**。ただし既知事項: undici WSクライアント×自作WSサーバの相性問題(S2記録)——機械テストのクライアントはundici禁止、S2の最小WSクライアント(node:net)を使う。SSE採用ならこの問題自体が消える。
- マイク選択の記憶: 魂ローカルの設定ファイル(`apps/soul/agent/` 内・gitignore対象)。

## 3. ドメイン分割

### Domain A: cockpitサーバ+魂の結線

- HTTPサーバ(静的1ページ配信+制御API: デバイス列挙/耳start/stop/状態取得)+ライブ更新チャネル(転写append・discard・VADイベント・死活変化のpush)。
- 耳パイプラインとの結線(起動停止のライフサイクル・2経路監視の状態反映)。クリーンシャットダウン(S1/S2教訓: ハンドル解放・タイマref規律)。
- テスト: HTTP/制御API/ライブ更新の機械テスト(実マイク不使用・fake-ffmpeg/合成PCM流用)。
- 成果物: waves/s2.5/domain-a.md、レビュー reviews/s2.5/domain-a-review.md。

### Domain B: ページ本体+仕上げ

- UX定義§2の画面(ヘッダ状態・Microphoneドロップダウン+Start/Stop・Timeline((speaking)ライブ行・時刻/話者/本文/レイテンシ)・footer)。拡張予約(§3)を意識したDOM構造(ただし作り込まない)。
- デバイス選択の永続化・起動コマンド(URL表示)・preflight(HTTPで開けて状態が返る)。
- docs(README・人間ゲート手順書)+followup記録。
- 成果物: waves/s2.5/domain-b.md、レビュー reviews/s2.5/domain-b-review.md。

## 4. blockingレビュー基準

1. pnpm-lock.yaml・器コード・C4契約fixture・S1/S2実装の既存挙動、全て不変(196テスト無退行)。**新規npm依存ゼロ**。
2. check:soul-zone / check:deps / check:source 無退行。
3. バインドが127.0.0.1限定であることのテスト固定(外部露出の構造的防止)。
4. 実マイク音声・録音データの非使用/非保存(S2と同一)。
5. 子プロセス・サーバの終了処理明示(ハング教訓)。UI(ブラウザ)を閉じても魂が生き続けることのテスト。

## 5. choke point(ユーザーの作業)

人間ゲートのみ: ブラウザで操縦席を開いてマイクを選び、喋る(手順書はDomain Bが用意)。install・配置なし。

## 6. Status

(発進後に記録)
