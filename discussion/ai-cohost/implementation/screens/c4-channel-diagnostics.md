# C4 UX定義: Channelページと自律ホストControlの整備

> Status: Accepted(ユーザー合意 2026-07-11)。
> 位置づけ: 閉問題C4のwave化前UX定義。設計討議は [../../architecture/c4-control-channel-v0.md](../../architecture/c4-control-channel-v0.md)。
> スコープは三点セット: ①Channelページ(新設) ②自律ホスト版Overview ③degradedページの解消(C1からの借金返済)。

## 1. Channelページ(新設、チャネルの家)

左navに `Channel` ページを追加(置き場は実装時にnav構成から決定。操縦系として `Physiology` の近くが自然)。

```text
+--------------------------------------------------+
|  Channel                                         |
|                                                  |
|  Status: Closed          [ Open Channel ]        |
|                                                  |
|  (Open後)                                        |
|  Status: Open — no client connected              |
|  Status: Connected (protocol 1)                  |
|  Endpoint  ws://127.0.0.1:17310/channel?token=…  |
|            [ Copy Channel URL ]                  |
|                                                  |
|  Live                                            |
|   Active overlays: face.angle.x = 0.4 (ttl 320ms)|
|                                                  |
|  Recent Events                                   |
|   ✓ intent.set  face.angle.x  0.4                |
|   ✗ rejected    slotValueOutOfRange  eye.l.open  |
|   ✓ connected   client 127.0.0.1                 |
+--------------------------------------------------+
```

- **開閉スイッチはここが一等地**(チャネル=手動開放の物理的な家)。起動時は常にClosed。
- `Copy Channel URL` 一発で魂側の設定が済む(Browser Sourceページと同じ作法)。
- 診断は三段:
  1. **接続状態**: Closed / Open(listening) / Connected(protocol版数つき)。
  2. **Active overlays**: 今チャネルが上書きしているスロット+値+残TTL。「外から動かされている」ことが目に見える。
  3. **Recent Events**: 直近イベントログ(受理インテント / 拒否+拒否コード / 接続・切断)。ゲートの「契約違反が拒否される」を人間にも見えるようにする。
- トラッキングホストで開いた場合: サブシステム不在の空状態一文(「This host has no control channel; the body is driven by tracking.」)。C3のPhysiologyページと同じパターン。

## 2. 自律ホスト版Overview

設計済みの姿(model-host-roles §6: export状態・生成器状態・チャネル状態)をカードで実体化する:

- **Model**: 既存のexport状態。
- **Physiology**: 生理サブシステムの存在と稼働(詳細はPhysiologyページへ)。
- **Channel**: Closed / Open / Connected の状態カード(操作の本体はChannelページ。カードは鏡写しの状態表示+ページへの導線)。

実装機構はC3で確立した**「サブシステム有無をbridgeがdataで返す」**パターンの再利用。roleを問い合わせず、「生理がいる」「チャネルがいる」という事実で描き分ける。トラッキングホストのOverviewにはチャネルカードが(サブシステム不在の事実により)出ない。

## 3. degradedページの解消

- **自律ホストのInput/Mappingページ**: 現在の劣化表示(+consoleの未処理rejection)を、Physiologyページの空状態と同じ品位の一文に置き換える: 「This host has no tracking input; the body is driven by physiology and the channel.」
- **自律ホストのStage Motionパネル / Live ControllerのMotion Safety**(押せるが効かないUI。C3裁定8で据え置き): 同じ空状態パターンで「Stage presence is driven by Physiology on this host.」を出し、Physiologyページへ誘導。
- **Header**: 自律ホストでの `Input: Disconnected`(嘘に近い表示)を、サブシステム有無のdataで差し替える(例: `Drive: Physiology`)。

## 4. 規律(既存方針の継承)

- UI語彙は英語。実行時role分岐禁止(描き分けはすべてサブシステム有無のdata経由)。
- rendererにtoken以外の秘匿情報・rawスロット・シードを流さない(tokenはChannel URLの構成要素としてこのページにのみ表示)。
- イベントログはsession-only(永続化しない)。

## 5. C4実装ゲートとの対応

- 機械: fixture疎通+拒否列挙+参照ドライバの持続駆動テスト(設計討議§1)。
- このUXの確認は機械ゲート通過後の一目で足りる(C4に人間の美的ゲートはない。外部駆動の美はC5)。
