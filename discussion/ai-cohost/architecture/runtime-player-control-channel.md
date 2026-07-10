# 設計方向: runtime-player AI操縦チャネル

> Status: 方向=Accepted(境界改定 案A・2026-07-10)、契約詳細=Draft。リポジトリ事実の裏付けは [../research/runtime-player-input-integration.md](../research/runtime-player-input-integration.md)。
> 本文書は runtime-player のコードに触れる変更の議論だが、規約合意(2026-07-10)により議論は本トピックに置き、`discussion/runtime-player/_map.md` からリンクで繋ぐ。
> 関連: 解禁根拠は [../concept/mvp-boundary-amendment.md](../concept/mvp-boundary-amendment.md)、基底フレーム源(生理層)との合成は [physiological-layer-and-envelope.md](physiological-layer-and-envelope.md) §3。

## 1. 目的

AI共演者(外部オーケストレータ)が、AI用モデルを表示する runtime-player インスタンスのパラメータ・表情を駆動できる、決定論的な外部操縦チャネルを定義する。

憲法との整合: 「リポジトリ側は決定論の器、知性は外部」。runtime-player に足すのはAIそのものではなく**決定論的な操縦API**であり、解釈・生成は外部に住む。

## 2. 設計方向(Draft)

### 2.1 挿入点

mainプロセスの `publishLatestParameterFrame` 前段に**入力ソース合成レイヤ**を新設する(調査所見)。既存のトラッキング入力パイプライン(正規化以降ソース非依存)と `tracking-input-mapping-baseline.md` §3 の将来ソース追加方針に整合する。

### 2.2 契約レベル: セマンティック・インテント注入

生parameterId直書きでもTrackingFrame偽装でもなく、**プリセット語彙(`mouth.vowel.*`, `mouth.open`, `face.angle.*`, `cheek`, `brow.*` 等)+Variant切替コマンド**で受け、main内で既存のauto-mapping/alias解決により `parameterValues` へ解決する。モデル差異は既存機構が吸収する。

- リップシンク: 母音推定器をバイパスし、TTSの音素タイムスタンプから `mouth.open = s`、`mouth.vowel.v = s×weight` を直接注入する。凸ブレンド不変条件(Σvowel = s = mouth.open)をチャネル契約に明記する。
- デバッグ用途に生parameterId直書きの併設は許容(既定はセマンティック層)。

### 2.2b 表現力の三階建て(Accepted 2026-07-10)

原則は「魂はフレームを打ち続け**なくてもキャラが生きている**」であって「魂は直接駆動**してはならない**」ではない。チャネルは三つの粒度を持つ:

1. **変調**(統計のツマミ): 情動状態(少数の名前付き状態+強度)を設定し、生理層生成器の統計(まばたき頻度、視線の落ち着き、呼吸の速さ)を揺らす。平常時の質感。
2. **エンベロープ付きインテント**: 「`brow.*`と`cheek`をこの値へ、0.3秒で立ち上げ、4秒維持、2秒で減衰」— 感情のピークを少数のメッセージで滑らかに直接駆動する。60fpsストリーミング不要で表現は濃い。発話時の口形注入(音素タイムスタンプ駆動)もこの階の住人。
3. **Variant切替**: 離散の表情・衣装ジャンプ(D7)。

合成規則(オーバーレイ優先、パラメータ群ごと)がこの三つを生理層の基底に重ねる。感情表現の出口は主に2で開く。

### 2.3 トランスポート

Browser Source server と同型の **loopback WebSocket(`127.0.0.1`+token認証)** を第一候補にする(mainに完全な前例あり)。将来のMCP server化は `design/ai-agent-connection-and-technology-stack.md` の Structured API-level 方針と整合するが、初手では要らない。

### 2.4 守るべき不変条件

1. Stage/Browser Source へは従来どおり sanitized `parameterValues` のみ配信する(チャネルはsanitization境界の内側で解決を済ませる)。
2. `externalInputParameterIds` 外への書き込みを拒否する(computed-dynamics-output等の保護)。
3. タイムスタンプ/sequenceの単調供給。~~アイドル時のkeep-alive契約をチャネル側に課す~~ → **生理層生成器が自律ホストの基底フレーム源になったことで解消**(2026-07-10更新)。チャネルはオーバーレイであり、沈黙してよい。
4. AI入力は session-only(前提P4)。保存・export・provenanceに触れない。
5. パラメータフレーム列の記録によるリプレイ再現性(provenance思想の延長)を壊さない。

## 3. 構成メモ

想定運用は「ユーザー用インスタンス(顔トラッキング)」と「AI用インスタンス(操縦チャネル)」の**二体別インスタンス**であり、同一インスタンス内での顔トラッキング×AI入力の合成は当面不要見込み(未確定)。合成レイヤは単一ソース選択から始めてよい。

## 4. 未決事項

- 複数インスタンス同時運用(ユーザー用+AI用)の実務確認(ポート衝突、userData分離)。
- チャネル契約のスキーマ定義の置き場(contracts に置くか、runtime-player ローカルに置くか)。

解決済み: D7(Variant切替)は**当面対象外**(ユーザー決定 2026-07-10)。初期契約は「変調+エンベロープ付きインテント」の二階建てで始め、三階(Variant)は将来の再検討。表現力の三階建て(§2.2b)の記述は将来像として維持する。
