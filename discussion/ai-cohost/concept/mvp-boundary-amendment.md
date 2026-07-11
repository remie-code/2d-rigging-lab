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

**D1「魂は別リポジトリ」を改定し、魂は本リポジトリ内の特区 `apps/soul`(名称ユーザー裁定 2026-07-11)に住むことを許可する。** 特区は単数の魂ではなく「魂たちの住む区画」であり、将来の別の魂も同区画に住む(憲章はディレクトリを許可するのであって住人の数を縛らない)。

根拠: 憲法の意図は「境界」であり、リポジトリ分離はその手段の一つに過ぎない。ディレクトリ境界はリポジトリ分離と同等の強制力を、より安い運用コスト(契約型の共有、fixtureの受け渡し、横断変更の同期)で持てる。C4の議論(参照ドライバの置き場、fixture輸出の形態)を契機にユーザーが提起(2026-07-11)。

**訂正(2026-07-11、C4棚卸しで発覚)**: 本改定の当初文面は「`check:deps` の非循環DAG検証が既にある」と述べたが、これは**事実誤認**だった(実物の `check:deps` は禁止パッケージ名のスキャナであり、import方向の検証機構はリポジトリに存在しない)。よって「境界の機械検証」は既存機構への相乗りではなく、**C4で特区専用の方向ルール検査を新設して実体化する**(①特区外から `apps/soul` をimportしたら違反 ②特区内から器のコードをimportしたら違反、の2ルール。汎用DAG検証は作らない。ユーザー裁定 2026-07-11)。

**実体化の完了(2026-07-11、C4 Domain D 実装済み)**: 上記の方向ルール検査は `scripts/check-soul-zone-boundary.mjs`(純関数 `findSoulZoneBoundaryViolations({ files })` + standalone CLI)として**実在**する。2ルールのみ(器→魂 import 禁止・魂→器コード import 禁止。ただし契約 `.json`(型・fixture)への魂側参照は許容)。root `package.json` の composite `check` に `check:soul-zone` として連結され**検証パイプラインに座っている**。違反 fixture(`scripts/soul-zone-boundary-fixtures/` の invalid ケース)で**赤くなること**を `check:soul-zone:fixtures`(自己テスト、5ケース: valid緑 + 単一行/多行の両違反2種を赤で固定)が実証し、実リポジトリでは緑(1243 source files scanned; no 器→魂 imports and no 魂→器 code imports)。参照ドライバ(`apps/soul/reference-driver/reference-driver.mjs`、依存ゼロ `.mjs`)が**特区の最初の住人**として器コードを一切 import せずに座り、方向検査で緑を保っている。これにより本§6末尾の「境界が機械検証可能になる分だけ強くなる」は**C4で実際に成立した**(思想の宣言から、CI が回る強制力へ)。

**特区憲章**(「不問」を野放しにしないための明文):

1. LLMプロバイダ統合・知覚(画面キャプチャ/視覚モデル)は **`apps/<魂>` 配下でのみ**許される。他の場所では従来どおり禁止(§3は特区外について不変)。
2. 魂がimportしてよいのは**操縦チャネルの契約(型・fixture)だけ**。器のコードを直接importしない。器と魂の会話は実行時のWS越しのみ。
3. **器側の何ものも魂をimportしない**。依存の向きは一方向であり、特区方向ルール検査(C4で新設。上記訂正参照)の検証対象とする。
4. 決定論・provenanceの規律は特区内には適用されない。逆に特区は器の決定論に一切触れられない(2・3の帰結)。
5. 秘密(APIキー等)はコミットされない。特区の設定は環境変数/ローカル設定で扱う。
6. 特区内のツールチェーンは特区の自由(魂の形態がPython等に転んだ場合のサイドカー構成を妨げない)。

これにより憲法「リポジトリ側は決定論の器、知性は外部」の**「外部」の定義は「リポジトリの外」から「境界の外」へ**改まる。思想は不変であり、境界が機械検証可能になる分だけ強くなる。

- C4で作る**参照ドライバ(疑似魂。LLM・知覚なしのシナリオ駆動)は特区の最初の住人**となる。
- 実物の魂の接続はC5完全閉鎖以後(閉問題分解§4)。
