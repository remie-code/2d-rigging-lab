# S5 vision — 視覚発火の実 SDK 観測（画面言及 + レイテンシ + 履歴再送コスト）

> Status: Recorded（2026-07-13）
> 計測担当: Gnome（サブエージェント委任 / 呼び出し元 Orch-Sylph）。S5 Domain C 後半（C-verify）。
> 位置づけ: [s1-first-light.md](s1-first-light.md)（枠消費 + レイテンシの初回計器）・
> [s4-expressions.md](s4-expressions.md)（タグ実出現の観測）に続く S 系列の計器。**S5 で新たに
> 画像ブロックを content 配列へ注入する経路の実射確認**。
> 流儀: s1-first-light.md を踏襲（ヘッダ証言 → 再現手順 → 生データ表 → 導出値 → 所見 → 次の含意）。

## 0. これは何を測ったか（限界の明示）

**自分で起動したメモ帳窓（特徴的なマーカー本文入り）→ 実 `captureWindow`（Domain A・実
PowerShell・PrintWindow）で 1 枚撮影 → 実 `createLlmSession`（Domain B・サブスク OAuth・
claude-opus-4-8）へ content 配列 `[image, text]` で ask → 同一常駐セッションでテキストのみの ask
を 4 回継続**、という縦串。**実ゲーム窓は使っていない**（対象は自分で起動したメモ帳のみ・鉄の
規律 8）。実ゲーム窓での視認・composited 内容の実写・最小化/被覆時の実挙動・DPI>100% は
[human-gate-procedure.md](../implementation/waves/s5/human-gate-procedure.md) /
[s5-followup.md](../implementation/waves/s5/s5-followup.md) の領分（この記録には含まれない・
**未実測**として正直に扱う）。

**SDK 実行は 5 ask のみ**（鉄の規律・上限厳守）。ask #1 が視覚発火（画像 + テキスト）、
ask #2〜5 は同一常駐セッションでテキストのみを継続（履歴再送コストの観測用）。

## 1. 実行環境

| 項目 | 値 |
|------|----|
| OS | Microsoft Windows 11 Home（win32） |
| Node | v22.14.0 |
| LLM | Agent SDK `@anthropic-ai/claude-agent-sdk` / model `claude-opus-4-8` |
| 認証 | **apiKeySource = `none`**（＝ `/login` サブスク OAuth）。env ガード（`assertSubscriptionAuthEnv`）
  通過（`ANTHROPIC_API_KEY`/`ANTHROPIC_AUTH_TOKEN`/`CLAUDE_CODE_USE_*` すべて未設定、
  `ANTHROPIC_BASE_URL` は既定値 `https://api.anthropic.com` と一致＝warning 0 件）。 |
| キャプチャ対象 | 自分で起動した notepad.exe（マーカー本文込み一時ファイル）。**実ゲーム窓は不使用**。 |
| 記録時刻 | 2026-07-13T04:53:48Z 開始 / 04:54:14Z サマリ出力（約 26 秒で 5 ask 完了） |

## 2. 再現手順

```
# 前提: /login 済み・ガード対象環境変数（ANTHROPIC_API_KEY / ANTHROPIC_AUTH_TOKEN /
#       CLAUDE_CODE_USE_*）が未設定。AivisSpeech・器・マイク・実ゲームは不要
#       （発話しない・キャプチャ対象は自分で起動したメモ帳のみ）。
# 注意: サブスク枠を消費する（5 ask）。不用意に走らせない。
node apps/soul/agent/scripts/observe-vision.mjs
```

メモ帳に書き込んだマーカー本文（キャプチャ対象そのもの）:

```
S5視覚テスト: 紫色のタコが自転車に乗って虹をくぐっている。空はオレンジ色で、右上に緑の星が3つ浮かんでいる。
```

視覚発火の指示文（`VISION_INSTRUCTION_TEXT`・fire-orchestrator.mjs 内部定数と同一文字列）:
「今の画面を見て、直近の会話と合わせて自然に反応してください。」

## 3. 生データ（5 ask・1 常駐セッション）

### キャプチャ（ask #1 の前に実行・実 PowerShell/PrintWindow）

| 項目 | 値 |
|------|----|
| width × height | 1024 × 535（長辺 1024 縮小・既定値のまま） |
| elapsedMs | 630（domain-a.md の実測レンジ 598〜660ms と整合） |
| jpegBase64 長さ | 29116 文字（≈21837 bytes） |

### system/init

| 項目 | 値 |
|------|----|
| apiKeySource | `none`（サブスク OAuth） |
| model | `claude-opus-4-8` |

### ask ごとの実測

| ask | 種別 | you | reply | 画面言及キーワード | in_tok | cache_creation_in | cache_read_in | out_tok | ttft_ms | ask_ms |
|----|------|-----|-------|---------------------|-------|--------------------|-----------------|--------|--------|--------|
| #1 | vision（画像+文） | 「ねえ、ちょっとこの画面見てくれる？」 | 「紫のタコが自転車で虹くぐってる\<surprised\>もうカオスだね。」 | タコ/自転車/紫/虹（4/6） | 2 | 1184 | 0 | 71 | 4824.2 | 6798.1（cold・画像込み初回） |
| #2 | text | 「さっき見てもらった画面、どう思う？」 | 「紫のタコの自転車、正直ずっと気になってる\<smile\>」 | — | 2 | 149 | 1184 | 26 | 1238.3 | 3067.3 |
| #3 | text | 「今日の配信、そろそろ次の話題に行こうかな。」 | 「うん、いいね\<nod\>次いこっか。」 | — | 2 | 159 | 1333 | 18 | 1554.9 | 3336.8 |
| #4 | text | 「ちょっと休憩を挟もうと思うんだけど、いいよね？」 | 「もちろん、休憩しよ\<smile\>」 | — | 2 | 200 | 1492 | 17 | 3068.7 | 5132.6 |
| #5 | text | 「そういえば、さっきの話の続きなんだけどさ。」 | 「うん、続き聞かせて\<nod\>」 | — | 2 | 242 | 1692 | 16 | 1226.2 | 5641.2 |

usage の cache 関連フィールド（全 ask で観測。生 JSON は生ログに記録済み）:
`cache_creation_input_tokens` / `cache_read_input_tokens` / `cache_creation.ephemeral_1h_input_tokens`
/ `cache_creation.ephemeral_5m_input_tokens`。`cache_creation` は 1 時間 TTL 側
（`ephemeral_1h_input_tokens`）にのみ値が乗り、5 分 TTL 側は常に 0 だった。

## 4. 導出値

- **(a) 画面言及: ○（観測できた）**。ask #1 の返事「紫のタコが自転車で虹くぐってる」が
  マーカー本文のキーワード 6 語中 4 語（タコ/自転車/紫/虹）に触れた。**視覚が実際に効いている
  ことを実射で確認**（実ゲーム窓ではなくメモ帳窓・低密度 UI での確認である点は棚卸し §4-1 の
  リスクと同じ限界＝domain-a.md §7 質問 3 と同一の未解消事項として残る）。
- **(b) レイテンシ内訳**:
  - キャプチャ: 630ms（domain-a.md 実測レンジ内）。
  - base64: 29116 文字（≈21.8KB）。preflight-eyes のメモ帳実測（19.0〜19.4KB）よりやや大きい
    （マーカー本文が preflight のマーカーテキストより長いため・低密度 UI という条件自体は同じ）。
  - TTFT: vision ask #1 が 4824.2ms（cold・画像込み初回のプロンプトキャッシュ生成コストが乗った
    と推定）。ask #2〜5（テキストのみ・warm）は 1226.2〜3068.7ms とばらつくが s1 の warm レンジ
    （1.2〜1.9s、外れ値 1件で 9.2s）と概ね同じ桁。
  - ask 往復: vision ask #1 が 6798.1ms（cold）。ask #2〜5 は 3067.3〜5641.2ms。
- **(c) input_tokens の推移: 増加せず一定（常に 2）。代わりに cache_read_input_tokens が
  0 → 1184 → 1333 → 1492 → 1692 と単調増加した。**
  - **これは s1-first-light.md（S1・画像なし会話）で観測された「input_tokens が 252→284→318→364
    と単調増加」パターンとは異なる**。S1 計測時は cache フィールドが usage に現れていなかった
    （記録になし）。S5 では **prompt caching が明確に効いている**: 新規メッセージ分のみが
    `input_tokens`（常に 2 = 最小の実メッセージ分と見られる）としてカウントされ、履歴（画像を
    含む）の再送分は `cache_read_input_tokens` として計上されている。
  - **棚卸し §2-3 未確定 (a)「prompt caching が常駐セッション内で効いて再送分が cache-read 価格に
    なるか」への回答: 効いている（実測で確認）。** これは「累積の重さ」への当初の懸念
    （画像を注入すると以後のすべての ask で input tokens を払い続ける）を大きく緩和する良い
    ニュース——cache-read は通常 input token より低価格（Anthropic の価格体系上の一般的性質。
    本記録では価格までは検証していない＝金額換算は未実施）。
  - `cache_creation_input_tokens` も ask ごとに発生している（149〜242）。これは各 ask の新規差分
    （直近の you/soul 発話 1〜2 行）がキャッシュへ書き込まれるコストと見られる。
  - **cache TTL**: `ephemeral_1h_input_tokens` にのみ値が乗り `ephemeral_5m_input_tokens` は常に
    0 だった（SDK/API 側が既定で 1 時間 TTL のキャッシュを使っている可能性。1 時間 TTL の場合、
    短い配信セッション内では cache-read が継続して効くと期待できる。5 分 TTL 側が使われないのは
    Agent SDK のデフォルト設定によるものと推測されるが、この記録では設定箇所までは調査していない）。

## 5. 所見

1. **視覚発火の実射で「画面に映っている内容への言及」を確認**——wave-plan §1 の人間ゲート項目
   「画面に映っているものに言及した返事が返る」の**機械ゲート版に相当する裏取り**が取れた
   （ただし対象はメモ帳・低密度 UI であり、実ゲーム窓での composited 撮影の成否は依然として
   人間ゲートの領分）。
2. **prompt caching が効いており、画像込み履歴の再送コストは cache-read 価格になっている**
   （§4 (c)）。棚卸し §2-3 の未確定事項の 1 つが解消された。「累積が重い」場合の梯子
   （セッション再生成・履歴除去等）は当面急いで用意しなくてよいと判断できる材料になった
   （s5-followup.md に「観測は良好・急ぎの梯子ではない」の形で記録）。
3. **cold な vision ask #1 の TTFT/ask_ms が最も重い**（4.8s/6.8s）。画像 base64 込みの初回送信 +
   キャッシュ生成コストが乗ったと見られる。ask #2 以降（warm・キャッシュ利用）はテキストのみの
   通常 Fire と同程度のレイテンシ帯に収まった。
4. **タグ（表情語彙）も自然に混在して出た**（`<surprised>` `<smile>` `<nod>`）。これは意図した
   観測項目ではないが、S4 のタグ機構が視覚発火でも素直に動くことの副次的な確認になった
   （パーサ/翻訳層はこのスクリプトでは通していないので envelope 送出までは確認していない）。

## 6. 未実測（正直な記録）

- **実ゲーム窓での composited 撮影の成否**（棚卸し §4-1 の最初の検証ゲート）。この記録の対象は
  自分で起動したメモ帳のみ（鉄の規律 8）。
- **最小化/被覆時の実挙動**（domain-a.md §7 質問 1・棚卸し §4-3）。
- **DPI スケーリング >100%**（domain-a.md §7 質問 5・棚卸し §4-4）。
- **ゲーム画面（高密度）での base64 実サイズ**（domain-a.md §7 質問 3）。今回もメモ帳（低密度）の
  ままで、preflight の傾向（白背景 UI は軽い）を追認したのみ。
- **cache-read の金額換算**（§4 (c) 所見 2 の「良いニュース」は token 数の推移からの定性判断であり、
  実際のコスト削減率を金額で検証してはいない）。
- 上記はすべて [s5-followup.md](../implementation/waves/s5/s5-followup.md) へ持ち越す。
