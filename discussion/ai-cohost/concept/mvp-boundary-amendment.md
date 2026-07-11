# MVP境界の改定(案A): ai-cohostに伴う解禁範囲

> Status: Accepted(ユーザー合意 2026-07-10、案A採用)。**改定二号(特区憲章)=Accepted(ユーザー合意 2026-07-11、§6)**。
> Owner: Undine / ユーザー
> 対象: root `_map.md` 「次の行動2」のFuture scope指定(external HTTP / WebSocket / MCP API work と LLM provider integration)の明示変更。

## 1. 改定の方針(案A)

**憲法「リポジトリ側は決定論の器、知性は外部」([../../design/codex-friendly-automation-policy.md](../../design/codex-friendly-automation-policy.md))は無傷のまま、柵だけ狭く開ける。**

魂(AI共演者のオーケストレータ: LLM呼び出し、知覚、ペルソナ、TTS/音声処理)は**別リポジトリ**に住む。本リポジトリ側の変更は、決定論的な器の拡張のみとする。

## 2. 解禁するもの

1. **runtime-player の外部操縦チャネル**: loopback(`127.0.0.1`)+token認証のWebSocketによる、セマンティック・インテント注入のAPI。Browser Sourceサーバ(既存)と同型のトランスポート。設計は [../architecture/runtime-player-control-channel.md](../architecture/runtime-player-control-channel.md)。
2. **生理層生成器**: runtime-player内の決定論的なアイドル生成器(シード付き)とその変調ツマミ。知性を持たない手続き機械であり、憲法違反(器に知性を入れる)ではない — メトロノームは精神ではない。既存のMinimum Open Dynamics v1・`breath`プリセットと同じ「知性なしの生命感を器が持つ」思想の延長。設計は [../architecture/physiological-layer-and-envelope.md](../architecture/physiological-layer-and-envelope.md)。
3. (第二段到達時)**モデルパッケージの演出メタデータ区画とEditorでの制作**: オプショナル区画として。根拠は [behavior-model.md](behavior-model.md) §7。

## 3. 引き続き禁止のもの(変更なし)

- **リポジトリ内のLLMプロバイダ統合**: LLM呼び出し、プロンプト、AIの判断ロジックは本リポジトリのどのapp/packageにも入れない。
- **リポジトリ内の知覚**: 画面キャプチャ、視覚モデル呼び出しは器に入れない(魂側の責務)。
- authoring系(Editor / authoring-host)における提案・推論・意味的自動分類の禁止(憲法本文)は不変。
- external APIの一般解禁ではない: 解禁は§2の操縦チャネルに限る。MCP server化等は将来の個別判断。

## 4. 根拠の要約

- 憲法の本来の狙いは「制作行為でAIに勝手な意味判断をさせない」こと。AI共演者は制作ではなく配信のプロダクト機能であり、憲法の精神には反しない — ただしこの読み替え自体をユーザー判断として本文書に記録する(2026-07-10)。
- loopback APIには Browser Source server という前例が既にあり、精神として半分越えていた線を明示的に引き直すもの。

## 5. 波及

- root `_map.md` 「次の行動2」を本文書参照付きで改定する(実施済み)。
- 「Runtime Playerは何になるのか」の責務再定義は [../architecture/runtime-player-model-host-roles.md](../architecture/runtime-player-model-host-roles.md)。

## 6. 改定二号: 魂の特区(D1の改定。ユーザー合意 2026-07-11)

**D1「魂は別リポジトリ」を改定し、魂は本リポジトリ内の特区 `apps/<魂>`(名称は魂実装着手時に決定)に住むことを許可する。**

根拠: 憲法の意図は「境界」であり、リポジトリ分離はその手段の一つに過ぎない。本リポジトリには境界を機械検証する道具(`check:deps` の非循環DAG検証)が既にあり、ディレクトリ境界はリポジトリ分離と同等の強制力を、より安い運用コスト(契約型の共有、fixtureの受け渡し、横断変更の同期)で持てる。C4の議論(参照ドライバの置き場、fixture輸出の形態)を契機にユーザーが提起(2026-07-11)。

**特区憲章**(「不問」を野放しにしないための明文):

1. LLMプロバイダ統合・知覚(画面キャプチャ/視覚モデル)は **`apps/<魂>` 配下でのみ**許される。他の場所では従来どおり禁止(§3は特区外について不変)。
2. 魂がimportしてよいのは**操縦チャネルの契約(型・fixture)だけ**。器のコードを直接importしない。器と魂の会話は実行時のWS越しのみ。
3. **器側の何ものも魂をimportしない**。依存の向きは一方向であり、`check:deps` の検証対象に含める。
4. 決定論・provenanceの規律は特区内には適用されない。逆に特区は器の決定論に一切触れられない(2・3の帰結)。
5. 秘密(APIキー等)はコミットされない。特区の設定は環境変数/ローカル設定で扱う。
6. 特区内のツールチェーンは特区の自由(魂の形態がPython等に転んだ場合のサイドカー構成を妨げない)。

これにより憲法「リポジトリ側は決定論の器、知性は外部」の**「外部」の定義は「リポジトリの外」から「境界の外」へ**改まる。思想は不変であり、境界が機械検証可能になる分だけ強くなる。

- C4で作る**参照ドライバ(疑似魂。LLM・知覚なしのシナリオ駆動)は特区の最初の住人**となる。
- 実物の魂の接続はC5完全閉鎖以後(閉問題分解§4)。
