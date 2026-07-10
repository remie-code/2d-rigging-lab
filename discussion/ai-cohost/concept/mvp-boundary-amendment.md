# MVP境界の改定(案A): ai-cohostに伴う解禁範囲

> Status: Accepted(ユーザー合意 2026-07-10、案A採用)
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
