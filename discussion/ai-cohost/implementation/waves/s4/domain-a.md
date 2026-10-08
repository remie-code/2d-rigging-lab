# S4 Domain A: パーサ + 演出表 + 翻訳層 + 結線（魂の表情筋）

> Status: 実装完了・機械ゲート緑（2026-07-13）。人間ゲート（Domain B）待ち。
> 担当: Gnome（Orch-Sylph 委任）。対象パッケージ: `apps/soul/agent`（独立 npm・workspace glob 外＝lockfile 不変）。
> 契約の正: [../../orchestration/s4-wave-plan.md](../../orchestration/s4-wave-plan.md) / [../../orchestration/s4-planning-inventory.md](../../orchestration/s4-planning-inventory.md)。

## 0. パイプライン（この Domain が敷いた線）

```
LLM応答(タグ込み)
  → parseExpressionTags        [純関数] speechText / events / diagnostics へ分離・未知/壊れタグ剥離
  → speechText                 → speak(口+声) + 会話ログ(soul append) + onSoulTranscript
  → events → translateExpression [純関数] 語→envelope payload列(強さ係数適用・域クランプ)
           → channel.sendEnvelope  スロット毎・発話開始と同時・部分適用・rejected/throwは診断へ握る
           → onExpression          語ごとの applied/rejected を結線層(cockpit)へ通知
```

## 1. 実装したファイル一覧

### 新規（すべて `apps/soul/agent/`）
| ファイル | 役割 |
|---|---|
| `src/mind/expression-table.mjs` | 演出表。6 語→スロット演出束の**データ駆動宣言。唯一の数値の在り処**。`EXPRESSION_TABLE` と語彙 `EXPRESSION_WORDS` を export。 |
| `src/mind/expression-table.test.mjs` | 演出表の健全性テスト（slotId 契約内・sustain 2〜4s・peak 域内・ADS 合計>0・各語が束を持つ・slot 重複なし）。 |
| `src/mind/expression-parser.mjs` | タグパーサ純関数 `parseExpressionTags(replyText)→{speechText, events, diagnostics}`。 |
| `src/mind/expression-parser.test.mjs` | パーサ fixture テスト + **性質テスト（speechText に `<` `>` が残らない）**。 |
| `src/mind/expression-translator.mjs` | 翻訳層純関数 `translateExpression(word, args?, intensity)→{payloads, diagnostics}`。強さ係数適用 + 域クランプ。 |
| `src/mind/expression-translator.test.mjs` | 翻訳層 fixture テスト（スケール・クランプ・未知語診断・S5 args の口）。 |

### 改修（既存）
| ファイル | 変更点 |
|---|---|
| `src/channel/channel-client.mjs` | `sendEnvelope(intent)` 追加（reference-driver 写経）。既定 `requiredKinds` に `intent.envelope` 追加。 |
| `src/channel/channel-client.test.mjs` | envelope accepted/rejected テスト + 既定 requiredKinds に envelope 必須のテスト追加。 |
| `src/test-support/ws-double.mjs` | テストダブルに `intent.envelope` 受理（`onEnvelope` オプション・既定 accepted）を追加。 |
| `scripts/cockpit.mjs` | `createLazyChannel` の返りに `sendEnvelope`（ensure()→委譲）追加。 |
| `scripts/cockpit.test.mjs` | lazyChannel.sendEnvelope が接続を張り speech と共有するテスト追加。 |
| `src/mind/fire-orchestrator.mjs` | パーサ/翻訳層結線・speechText 化・envelope 送出・`onExpression` フック・分岐・`expressionIntensity` オプション・FIRE_SYSTEM_PROMPT にタグ教示。 |
| `src/mind/fire-orchestrator.test.mjs` | S4 縦検証テスト 9 本 + タグ教示テスト追加。 |

**器コード（`apps/runtime-player/**`）・C4/C5 契約 JSON・`pnpm-lock.yaml`・`package.json` は完全不変**（`git status` で確認済み・新規依存ゼロ・Node 組み込みのみ）。

## 2. タグ構文の決定と根拠

```
<word>                 例: <smile> <look-away>      語のみ（v0 の 6 語は引数不要）
<word arg1 arg2 ...>   例: <look-at x=.3 y=-.2>     語 + 空白区切り引数（S5 拡張の口・今は口だけ開ける）
```

- 正規表現: `/<([A-Za-z][\w-]*)(\s[^<>]*)?>/g`。group1=word（英字始まり・ハイフン可＝`look-away`/`look-camera`）、group2=args（先頭空白 + `<` `>` 非含有）。
- **根拠**: 半角山括弧の語トークンは (a) 日本語本文と衝突しにくく（全角と別）、(b) LLM が模倣しやすく、(c) `[^<>]*` で args が次の括弧を跨がないため壊れタグの巻き込みを構造的に防げる。S5 の `<look-at x=.3 y=-.2>` は**表への行追加 + 翻訳層での args 解釈**だけで足せる（パーサ署名・構文とも不変）。args は v0 では**生文字列のまま** `event.args` に保持（構造化は S5 の仕事）。

## 3. パーサ / 翻訳層 / 演出表の契約

### パーサ `parseExpressionTags(replyText) → { speechText, events, diagnostics }`
- `speechText`: タグを完全剥離した読み上げ用テキスト（TTS・会話ログはこれのみ）。**`<` `>` は絶対に残らない**（well-formed タグ除去後の壊れ括弧は無条件に剥ぐ＝性質テストで固定）。
- `events`: `[{ word, args?, position }]`。**出現順**。既知 6 語のみ event 化。`position` = 元 replyText 内のタグ開始文字位置（**v0 は保持のみ・同期には使わない**）。`args` は付いていれば生文字列（無ければ省略）。
- `diagnostics`（**戻り値で返す＝副作用ではない**）:
  - `{ type: "unknownTag", tag }` — 語彙 6 語以外の well-formed タグ（剥離済み・声にも演出にも出さない）。
  - `{ type: "brokenTag", count }` — 未閉じ `<` / 単独 `>` / 空タグ `<>` 等で剥ぎ取った括弧文字数。
- 壊れ入力（未閉じ・単独 `>`・`<>`・混在・非文字列）で **throw しない**。非文字列入力は空文字扱い。

### 翻訳層 `translateExpression(word, args?, intensity=1.0) → { payloads, diagnostics }`
- `payloads`: `[{ slotId, peak, attackMs, sustainMs, decayMs }]`（器契約と同型・1 語→複数スロットなら複数）。
- `diagnostics`: 存在しない語 → 空 `payloads` + `[{ type: "unknownWord", word }]`（パーサが既知語のみ event 化するため通常は来ない防御）。
- `intensity`（強さ係数・既定 1.0・**表の外のこの層で適用**）: 全 peak を一括スケール。非有限/負値は 1.0 に丸める（`intensity ≥ 0` を期待。0 = 演出なし＝peak 0）。attack/sustain/decay は**不変**。
- **クランプ**: `peak × intensity` を域へクランプ。中央スロット（head/gaze/body）は `[-1, 1]`、重みスロット（eye-blink-*/mouth-smile）は `[0, 1]`。器は域外を clamp せず拒否するため魂側で必ず収める。クランプ境界は契約 normalizedRanges の構造事実であって演出チューニング値ではない。

### 演出表（`EXPRESSION_TABLE`）
- 6 語 → `[{ slotId, peak, attackMs, sustainMs, decayMs }]`。**数値はここだけ**（パーサ・翻訳層・orchestrator に数値を書かない）。
- `peak` は**係数 1.0 時の基準値**。sustain は全エントリ 2000〜2600ms（2〜4 秒帯・裁定 4）。

## 4. 演出表の各語の設計意図（slot 束と数値の狙い）

| 語 | スロット束（slotId: peak / attack / sustain / decay ms） | 設計意図（一行） |
|---|---|---|
| **smile** | mouth-smile:0.8/180/2600/500・eye-blink-left:0.35・eye-blink-right:0.35・head-tilt:0.12 | 口角↑ + 目を少し細め（笑うと目が細まる）+ 小さな傾げの温かい笑み。mouth-smile は現素材で見えないが標準語彙として書く。 |
| **troubled** | gaze-horizontal:-0.4・gaze-vertical:-0.25・head-tilt:0.2（220/2400/600） | 視線が斜め下へ泳ぎ（困った話で目が泳ぐ）、頭を傾げる困惑。 |
| **surprised** | head-vertical:0.3・body-z:-0.25・gaze-vertical:0.15（**attack 100** 最短/2000/450） | 素早く顎を上げ体を少し引く驚き。attack を最短にして「はっ」の速さを出す。 |
| **nod** | head-vertical:-0.35（150/2000/500） | 顎を下げて戻す頷き。v0 は ADS 単峰＝**下げて保持して戻す近似**（多峰の頷きは将来）。 |
| **look-away** | gaze-horizontal:-0.6・head-horizontal:-0.25（200/2500/550） | 視線を横へ大きく逸らし頭も少し追従（気まずさ・照れ）。 |
| **look-camera** | gaze-horizontal:0・head-horizontal:0・body-z:0.15（200/2500/550） | 視線・頭を正面へ戻し（peak 0＝逸らしからの復帰）体をわずかに前傾で「向き直る」engage を可視化。 |

**符号（向き）の正直な注記**: head/gaze/body の「正 = どちらの向き」は**リグ依存**（`semantic-slot-definitions.ts` の `fallbackPositiveSign` が入力プロファイルの学習符号を参照）。ここでは軸・大きさ・意図する向きを固定したが、実機での見え方（例: nod の顎下げ・surprised の顎上げが本当にその向きか、look-away の左右）は**人間ゲート（Domain B）で確定**する。符号が逆なら該当行の peak の符号を反転するだけ（1 行修正）。eye-blink-* は 0=開/1=閉が契約確定で符号の曖昧さは無い。

## 5. requiredKinds 変更の選択と理由

- **選択**: `channel-client.mjs` の既定 `requiredKinds` を `["intent.speech"]` → **`["intent.speech", "intent.envelope"]`** に変更（fire 経路だけ明示要求ではなく既定に足す）。
- **理由**: 器は C5 から `intent.envelope` を **additively 広告済み**（server.hello の supportedKinds は常に intent.set/envelope/speech の 3 種。`channel-exchange-examples.json` で確認）。よって既定に足しても実器接続は無退行で、かつ **envelope 非対応の相手には接続時に fail-fast**（表情が黙って無視される事故を封じる）。lazyChannel は 1 本の接続を speech と envelope で共有するため、要求は接続時に置くのが正しく、既定変更が最小 blast radius。これは S1〜S3 挙動の**裁定内変更**。
- **波及した既存テスト**: なし（既存の channel-client テストは ws-double が 3 種広告 or missing-speech ケースで、いずれも新既定で挙動不変）。むしろ**追加**した: 「既定 requiredKinds に intent.envelope が無ければ throw」テストで新既定を固定。

## 6. orchestrator 結線の分岐仕様

挿入点: `session.ask` の返り replyText を受けた直後（`fire-orchestrator.mjs`）。

1. `parseExpressionTags(replyText)` → `{ speechText, events, diagnostics }`。
2. パーサ診断を `onDiagnostic` へ（type を `expression` 接頭辞化: `unknownTag`→`expressionUnknownTag`、`brokenTag`→`expressionBrokenTag`）。
3. 分岐:
   - **speechText 空 かつ events 空** → 既存 `fireEmptyReply` 診断・`{ fired:false, reason:"empty-reply" }`（未知タグのみ応答もここ。未知タグ診断は先に出る）。
   - **speechText 空 かつ events あり** → speaking へ。**speak せず・soul append せず・envelope のみ実行**。戻り値 `{ fired:false, reason:"expression-only", expressed:true, expressions, injectedChars, includedCount }`。
   - **speechText あり** → speaking へ。envelope 送出開始と同時に `speak(speechText)`。成功後 `buffer.append({text: speechText, speaker:"soul"})` + `onSoulTranscript`。戻り値 `{ fired:true, replyText: speechText, expressions, injectedChars, includedCount }`。
4. **soul 記録・speak は speechText のみ**（従来 replyText をタグ込みで speak+append していたバグの修正・裁定済みの意図変更・テストで固定）。`replyText` フィールドも speechText を返す（発話した文＝会話ログと一致）。
5. envelope 送出（`applyExpressions`）:
   - 語ごとに翻訳→payload 列→`channel.sendEnvelope` をスロット毎に `Promise.all` 送出。
   - **rejected（器拒否）・送出 throw・チャネル未対応はすべて `onDiagnostic` に握り、発話を止めない**。部分適用（一部 accepted・一部 rejected）は正常系。
   - **envelope 経路は speak と独立**: envelope 送出は speak 開始と同時に走り、envelope が全部こけても speak は走る／speak がこけても既存 fireError 経路（applyExpressions は never-throw）。
   - 送出タイミング: v0 は**発話開始で一括**（タグ位置同期しない。position は保持のみ）。

## 7. ワイヤ契約（Domain B が読む・フックのペイロード形）

orchestrator が emit するフックのペイロード契約。Domain B（cockpit-server の SSE / cockpit-page のタイムライン）はこれを消費する。

### `onExpression(info)` — 演出適用の通知（語ごと・best-effort・throw 握り）
```
{ word: string, args?: string, applied: number, rejected: number }
```
- 語 1 つの演出束を送り終えるごとに 1 回発火。`applied` = accepted スロット数、`rejected` = 拒否/送出失敗スロット数。
- Domain B は発火マーカーと同型の「演出イベント行」として表示可能（語と適用/拒否スロット数）。

### `onDiagnostic(diag)` — S4 で増える type
| type | ペイロード | 意味 |
|---|---|---|
| `expressionUnknownTag` | `{ type, tag }` | 語彙外タグを剥離（声にも演出にも出さない）。Domain B はゴースト行に。 |
| `expressionBrokenTag` | `{ type, count }` | 壊れ括弧を剥ぎ取った数。 |
| `expressionRejected` | `{ type, slotId, error }` | 器がそのスロットを拒否（部分適用）。 |
| `expressionSendError` | `{ type, slotId, message }` | sendEnvelope が throw / チャネル未対応。 |
| `expressionUnknownWord` | `{ type, word }` | 翻訳層の防御診断（通常出ない）。 |
| `fireEmptyReply` | `{ type }` | 従来どおり（speechText 空 & events 空）。 |
| `fireError` | `{ type, message }` | 従来どおり（ask/speak throw）。 |

### 戻り値の型（cockpit 消費用）
- 発話あり: `{ fired:true, replyText:speechText, expressions:[{word,args?,applied,rejected}], injectedChars, includedCount }`
- **発話なし・演出のみ**: `{ fired:false, reason:"expression-only", expressed:true, expressions:[...], injectedChars, includedCount }`（`expressed:true` で「演出は実行した」事実を Domain B に伝える）。
- 空応答: `{ fired:false, reason:"empty-reply" }`（従来と同じ）。

### FIRE_SYSTEM_PROMPT のタグ教示（Domain B の実 SDK 確認が観測する）
6 語の列挙 + 「感情が動いたときだけ添える」+ 半角山括弧 + 最小例（「そうだね<nod>」等）+ 「読み上げ文には含めない」。人格の作り込みはしていない（persona の領分・引き続き貧しく）。

## 8. 機械ゲート生数字

`cd apps/soul/agent && node --test`（全テスト・新規込み総数）:

```
# tests 326
# pass  326
# fail  0
```

（S4 前ベースライン 284 → +42。内訳: 演出表 7 / パーサ 13 / 翻訳層 9 / channel-client +3 / cockpit +1 / orchestrator +9。）純関数 fixture 全緑・性質テスト（speechText に `<` `>` 残らない）緑・器コード diff 空・lockfile/package.json 不変。

## 9. §質問（Orch / Domain B への申し送り・迷った裁定点）

1. **nod の v0 近似**: ADS は単峰（attack→peak→sustain→decay）のため頷きは「顎を下げて 2s 保持して戻す」近似になる（多峰の bobbing は不可）。sustain 2〜4 秒帯の裁定に忠実に従った結果、頷きが「下げっぱなし」に見える恐れがある。**人間ゲートで nod が頷きに見えるか要確認**。見えなければ (a) nod だけ sustain を帯の下限=2000ms 固定のまま decay を短めにする微調整、(b) 将来の多峰演出（S5+）へ送る、のどちらか。裁定を仰ぎたい。
2. **符号の実機確認**: §4 の符号（head-vertical の上下、gaze/head-horizontal の左右、body-z の前後）は**すべてリグ依存で未確定**。Domain B の人間ゲートで見え方を確認し、逆なら演出表の peak 符号を反転（1 行/箇所）。特に nod(head-vertical -0.35) と surprised(head-vertical +0.3) が意図どおり逆向きに出るか。
3. **look-camera の standalone**: gaze/head を peak 0（=正面復帰）にしているため、直前に look-away が無い単独 look-camera では gaze/head は動かず body-z 前傾のみが可視。意図どおり（「逸らしから戻る」語）だが、Domain B の実 SDK 観測で look-camera が単独で出た場合の見え方を記録してほしい。
4. **強さ係数の露出**: `expressionIntensity` を orchestrator オプション（既定 1.0）として口を開けたが、CLI フラグ/設定への配線は Domain B の領分としてこの Domain では触っていない。操縦席には調整 UI を置かない裁定（運用面限定）に沿い、必要なら Domain B が `--expression-intensity` 等で `createFireOrchestrator` に渡す。
5. **cockpit main 結線**: `createLazyChannel.sendEnvelope` は追加したが、cockpit の main（`fireOrchestratorFactory` の hooks へ `onExpression` を渡す・SSE/UI へ流す）は Domain B の領分として未接続。orchestrator は `onExpression` を emit する準備ができている。
