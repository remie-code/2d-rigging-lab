# AI Cohost Architecture Map

> `ai-cohost/architecture/` の地図。設計方向・設計判断を保持する。裏付けとなる調査事実は research/ に分離。

| Path | Content | Status |
|---|---|---|
| [conversation-pipeline-direction.md](conversation-pipeline-direction.md) | 会話パイプラインの設計方向: テキストパイプライン採用、二層設計(反射層+LLM)、宛先判定、割り込み、音声ルーティング、候補スタック | Draft |
| [runtime-player-control-channel.md](runtime-player-control-channel.md) | runtime-playerへのAI操縦チャネル: 挿入点、セマンティック注入契約、表現力の三階建て(変調/エンベロープ付きインテント/Variant)、不変条件、トランスポート | 方向=Accepted(境界改定 案A)、契約詳細=Draft |
| [physiological-layer-and-envelope.md](physiological-layer-and-envelope.md) | 生理層生成器: 表現レパートリー、定義の所在(四層優先順位)、駆動と合成、Editor第一弾(エンベロープ宣言+アイドルプレビュー)、等価性検証 | 意味レベル=Accepted(2026-07-10) |
| [runtime-player-model-host-roles.md](runtime-player-model-host-roles.md) | Runtime Player=モデルホストの責務再定義、案(c)役割つき起動、前提条件(状態/ポート/身元)、防波堤(役割は構成で表現)、起動UX(三つの扉、生理自動/チャネル手動) | Accepted(2026-07-10) |

## 未決事項(主要な設計分岐)

| ID | 分岐 | 状態 |
|---|---|---|
| D1 | 魂(オーケストレータ)の居場所 | **解決: 別リポジトリ(案A採用、2026-07-10)** |
| D4 | プラットフォームとチャット取得層 | **解決: YouTube(ユーザー決定 2026-07-10。既存の配信環境・実績あり)**。チャット取得層は壊れる前提の抽象化必須(research参照) |
| D6 | ターンテイキング/宛先判定の初手 | **解決: キー操作で明示から始める(ユーザー決定 2026-07-10)**。実機ゲートを経て名前呼び/自動判定へ段階的に(P5) |
| D7 | Variant切替(離散表情・衣装)をAI制御面に含めるか | **解決: 当面対象外(ユーザー決定 2026-07-10)**。初期の操縦チャネル契約に含めない。将来の再検討は妨げない |
| — | アプリの形 | **解決: 案(c)同一アプリの役割つき起動(2026-07-10)** |
