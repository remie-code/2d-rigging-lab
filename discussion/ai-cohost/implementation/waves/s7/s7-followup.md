# S7 follow-up 記録: wave 内で対応しない持ち越し事項

> Status: 記録開始（2026-07-14, Gnome / S7 Domain C）。台帳の流儀は
> [../s6/s6-followup.md](../s6/s6-followup.md) を踏襲。
> 出典: [domain-a.md](domain-a.md) §7 質問 + [domain-b.md](domain-b.md) §9 質問 +
> 本 domain-c.md §質問 + [../../orchestration/s7-planning-inventory.md](../../orchestration/s7-planning-inventory.md)
> §2-1・§5。実疎通・実測が要る項目は**人間ゲート待ち**として明記する
> （機械テストは全 fake・実 YouTube への HTTP は 1 バイトも踏んでいない）。

## 1. 公式 Data API v3 キー実装への差し替えの梯子（+ quota 単価の実測）

v0 は**非公式 innertube**（認証不要・依存ゼロの自前実装・inventory §5 裁定）。取得死が直せない日が来たら
**公式 Data API v3 キー実装への差し替えは器官内で完結する**（inventory §2-1・裁定 2 の意味）:

- 差し替え点は `src/chat/innertube.mjs` の純部品層のみ——`fetchWatchPage` + `extractBootstrap` +
  `fetchLiveChat` + `parseLiveChatResponse` を公式版（`videos.list(id)→activeLiveChatId` →
  `liveChatMessages.list` ポーリング）に置換すれば、`live-chat-client.mjs` の状態機械
  （connecting/live/retrying/dead・バックオフ・フック）は**不変で流用できる**（domain-a.md §2・§7-6）。
- **quota 単価が未確定**（inventory §2-1）: `liveChatMessages.list` の単価が公式 quota 表に載っていない
  （全エンドポイント合算 10,000 units/日）。**単価 1 なら 6h×5s 間隔 ≈ 4,320 units/日で足りる・単価 5 なら
  21,600 で枯れる**——**単価次第で可否が反転**し、**実測（1 時間試して GCP コンソールで確認）でしか確定
  できない**。公式へ差し替える判断をする時に、この実測を本欄へ記録する。
- 設営: GCP プロジェクト + API 有効化 + キー発行（審査なし・数分・ユーザーの作業）。公開/限定公開配信の
  チャット読み取りは**API キーのみで可**（OAuth 不要・inventory §2-1）。

## 2. ToS グレーの記録（非公式 innertube 採用の経緯・ユーザー裁定）

- **事実**: innertube は公式ドキュメントのある公開 API ではない。YouTube ToS は自動化アクセスを原則
  制限する（公式 API サービスの保護＝deprecation ポリシー等は受けられない）。**個人が自分の公開配信の
  チャットを読む**用途、という文脈はある（inventory §2-2・§5）。
- **裁定（2026-07-14・ユーザー「これでいこう」）**: ToS グレーの事実は**開示の上で**非公式 innertube・
  依存ゼロ自前実装を採用（inventory §5）。公式キー実装への差し替えは §1 の梯子として残す。
- 人間ゲート手順書 [human-gate-procedure.md](human-gate-procedure.md) §0 で Connect 前にこの事実を
  開示している。

## 3. 表記揺れ集合の実運用拡張（`NAME_VARIANTS_TEXT_V0`）

コメント内呼びかけの**テキスト用**揺れ集合（domain-b.md §4）:
```
NAME_VARIANTS_TEXT_V0 = ["Cody","cody","CODY","コーディ","コーディー","コーティ","コーティー","こーでぃー"]
```
- `normalizeForMatch` は NFKC + かな→カナ + 濁点剥がしのみで**英字の大小は畳まない**（音声照合を変えない
  ため不変）。NFKC が全半角を吸収（`Ｃｏｄｙ`→`Cody`）するので大小揺れは**集合側に列挙**している。
- **未収録**: `CoDy` のような**任意混在大小**は拾えない（domain-b.md §9-3）。実運用で混在表記が多いと
  分かれば、①データ定数に足す か ②テキスト専用に小文字化正規化を導入する。**人間ゲート §5 で実際に
  投げた表記を本欄へ記録**して判断する。`コーピー`（「コピー」誤爆）は音声同様に見送り（precision 優先）。

## 4. 実疎通で必要になった HTTP 詳細の欄（人間ゲート待ち・埋める欄）

`fetchWatchPage` は accept-language + 汎用 UA を付けるだけ（domain-a.md §7-5）。**機械テストは合成
fixture のみ**で、実 YouTube の HTTP 実態は未検証。人間ゲート §3 の Connect で 4 点抽出が通らなかった場合、
以下を本欄へ記録する（followup で器官内に足す・依存ゼロのまま fetch ヘッダ調整で対応可能な見込み）:

- [ ] **cookie / CONSENT**: 実 YouTube が CONSENT cookie を要求したか（youtube-chat 実装は CONSENT を
  扱う版がある）。
- [ ] **地域リダイレクト**: consent.youtube.com 等へのリダイレクトが起きたか。
- [ ] **チャンネル `/live` からの videoId 解決**: `currentVideoEndpoint.watchEndpoint.videoId` が実 HTML に
  期待通り載ったか（watch URL / video ID 経由は URL から直接採るので確実・チャンネル `/live` 経由のみ
  HTML 依存・domain-a.md §7-4）。
- [ ] **その他**: 4 点抽出（apiKey/clientVersion/continuation/videoId）のどれが取れなかったか・実 HTML の
  スキーマ差異。

## 5. comment 予算 30 の妥当性 + 頻度の将来 Cockpit 可変（人間ゲート待ち）

v0 定数（domain-b.md §4・コード内定数・ツマミは作らない）:

| 定数 | 値 | 調整観点（人間ゲート④＝§4/§5 で体感を見る） |
|---|---|---|
| `COMMENT_REFRACTORY_MS` | 8000 | コメント洪水で立て続けに撃たない希釈。comment-call には掛けない |
| `COMMENT_PROBABILITY` | 0.35 | 高すぎるとうるさい・低すぎると反応が薄い。comment-call には掛けない |
| `COMMENT_BUDGET_V0` | 30 | 配信 1 本ぶんの確率コメント応答の上限の当て推量（comment-call は予算外＝呼びかけは常に返る）。活発なチャットで途中で枯れると「たまに拾う」が止まって寂しい・緩すぎると費用が嵩む。**実測（人間ゲートの体感 + S5 usage 計器の代金）で直す** |

- **頻度は将来 Cockpit 可変**（inventory §1 裁定 7）: 声への反応（S6 の口数モード）とコメントへの反応が
  **一緒に変わる**のが自然形。s6-followup §12「口数モード」に合流させる（声・コメント・沈黙を横断する
  一つの「口数」ツマミ）。v0 は固定のまま。

## 6. スパム/荒らし対策・多コメント時の間引き（S8 安全弁の領分）

v0 は取得したコメントをそのまま合流させる（フィルタ無し）。**スパム/荒らし・不適切コメントの遮断は
S8「安全弁」の領分**であり S7 では実装しない。関連して:

- **多コメント時の間引き**: 活発なチャットで毎ポール大量のコメントが来ると、全件を転写バッファに append
  する（発火は確率/予算で希釈されるが、会話ログ＝注入窓はコメントで埋まりうる）。間引き（サンプリング/
  重複除去/新着優先）は S8 の安全弁と合わせて設計する。
- **paid（スーパーチャット）の演出区別**: v0 は kind を区別せず text/displayName だけで合流（単一
  タイムライン・裁定 3・domain-b.md §9-5）。有料を演出で区別（名前装飾・優先応答）したいなら
  `ingestChatMessage` に kind を渡す余地がある（v0 は区別なし）。金額は onMessage に載っていない。

## 7. 【要 escalate】バッファ所有権の巻き上げ（耳なしチャット）— Domain B §9-1 の再掲

viewer コメントの合流先（転写バッファ）は**耳パイプライン所有**（遅延起動）ゆえ、**耳未起動では
コメントを合流できず発火もしない**（v0 は `chatBufferAbsent` 診断のみ・domain-b.md §5）。人間ゲートは
「マイク＝耳を起動した状態で Connect」を前提にすれば成立する（cohost は声も拾うので自然・人間ゲート
手順書 §2 の★最重要事項として明記済み）。

- **耳を切ったままチャットだけ動かす運用を許すなら**、バッファ所有権の巻き上げ（cockpit-server が
  転写バッファを常設所有し、耳・チャット双方が append する構造）が要る。これは **S1〜S6 の耳ライフ
  サイクル・器不変を脅かしうる構造変更**なので **v0 では実装せず escalate**（回避工作で黙って凌がない）。
- **要否と設計は Orch/Undine の裁定待ち**。人間ゲートの体感（「耳を切ってチャットだけ」の需要が実際に
  あるか）も判断材料になる。

## 8. 軽微（記録のみ・非 blocking）

- **cockpit-server.mjs `broadcastChatDiagnostic` のコメントと実装の不一致**（Domain B design レビュー
  non-blocking・domain-b.md §9-6 相当）: 関数ヘッダのコメントは「診断オブジェクトはそのまま透過」と
  読めるが、実装は 5 キー（kind/message/atMs/delayMs/attempt）の**ホワイトリスト抽出**（安全側）。
  実装が正しい（器官が余計なキー——将来 token 等——を診断に載せても操縦席へ漏らさない）。**doc 修正の
  余地**（コメントを「5 キーを抽出して透過」に直す）だが機能影響ゼロ・v0 は現状維持。
- **displayName の `)`/改行による viewer 行の表示崩れ**（機能影響なし）: 操縦席の viewer 行は
  `viewer(displayName): 本文` を描くが、displayName に `)` や改行が含まれると括弧表示が崩れうる
  （`textContent` 代入なので**注入攻撃にはならない**——HTML としては解釈されない・表示の見た目だけ）。
  実運用で崩れが目立てば displayName のサニタイズ（括弧/改行のエスケープ）を足す。v0 は現状維持。
- **`POST /api/chat/connect` の同時 2 件 race**（軽微・race・UI disable で通常再現せず・design/test レビュー
  non-blocking）: `connectChat` は `foldChatClient()`→生成→`await onSetChatSource`/`await start()` と非同期の
  継ぎ目を跨ぐため、Connect ボタン disable を迂回して同時に 2 件の connect POST が入ると、後着の
  `foldChatClient()` が先着の生成途中の器官を畳む/2 器官が一瞬併存する等の競合がありうる（未テスト）。
  **操縦席 UI は Connect ボタンを POST 中 disable するので通常操作では再現しない**（cockpit.html の
  `btn-chat-connect.disabled = true`）。severity 低ゆえ今回は触らない。必要なら connect に in-flight ガード
  （`connecting` フラグで 2 件目を 409/無視）を足す——followup。 
