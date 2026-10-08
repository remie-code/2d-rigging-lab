# S8 Domain C レビュー（design 適合 + blocking 基準）— Review-Sylph

> レーン: design 適合 / blocking 基準（秘匿最重要）。読み取り専任・コード変更なし。サブエージェント起動なし（自己完結）。
> 対象: `apps/soul/agent/src/mind/ng-words.mjs`（新規）・`apps/soul/agent/src/mind/fire-orchestrator.mjs`（NG 検問所差分）。
> 基準: `discussion/ai-cohost/implementation/orchestration/s8-wave-plan.md` §4/§Domain C/§2、`s8-planning-inventory.md` §2-2/§1-2 裁定4。
> Gnome 報告: `discussion/ai-cohost/implementation/waves/s8/domain-c.md`。

## 総合判定: **合格**（ただし NG 語選定に重大な所見あり・要伝達）

blocking 基準（§4-1〜4・特に §4-5「没の秘匿」）はすべてコード上で満たされていることを確認した。全764テストを独立再実行し 764/764 緑を確認した。一方、追加 design 検証で NG 語選定に無視できない**誤爆（false positive）リスク**を発見した（後述）。これはコード修正必須ではなく starter list として設計上ユーザー裁定に委ねられた範囲だが、人間ゲート②の短時間確認だけでは見逃されうる性質のリスクなので、Orch-Sylph/ユーザーへ明示的に申し送るべきと判断する。

---

## 1. 没の秘匿（§4-5・最重要）— **合格**

検問所の実装（`fire-orchestrator.mjs:357-364`）:

```js
if (containsNgWord(speechText)) {
  const appended = buffer.append({ startMs: 0, endMs: 0, text: NG_BLOCKED_NOTE, speaker: "soul" });
  if (appended && appended.appended && appended.entry) {
    emit(onSoulTranscript, appended.entry);
  }
  emit(onDiagnostic, { type: "ngBlocked" });
  return { fired: false, reason: "ng-blocked", ...extra };
}
```

各漏洩経路を個別に追跡した:

- **soul 追記（正本）**: `apps/soul/agent/src/mind/fire-orchestrator.mjs:358` — `buffer.append` の `text` は固定文字列 `NG_BLOCKED_NOTE`（`ng-words.mjs:76` = `"（発話を没にした: NG検査）"`）のみ。`speechText`（本文）は一切渡していない。`buffer.append` の実体 `apps/soul/agent/src/ears/transcript-buffer.mjs:147` の `TranscriptEntry` 型（`:74`）は `{seq,startMs,endMs,text,speaker,displayName,appendedAtMs}` のみで、渡した引数以外のフィールドを合成しない。よって `entry.text` も `NG_BLOCKED_NOTE` のみ。
- **diagnostic**: `fire-orchestrator.mjs:362` — `emit(onDiagnostic, { type: "ngBlocked" })` は `type` のみのオブジェクトで、命中語・speechText・マッチ位置を一切含まない。さらに配線層 `apps/soul/agent/src/cockpit/cockpit-server.mjs:579-591`（`handleDiagnostic`）はホワイトリスト方式で `message/reason/startMs/endMs/tag/kind/elapsedMs/charsSpoken/totalChars/prefix` のみを `d?.xxx ?? null` で拾う実装のため、`{type:"ngBlocked"}` にはこれらのプロパティが存在せず全て `null` になる。つまり配線層側にも二重の安全網がある。
- **戻り値**: `fire-orchestrator.mjs:363` — `{ fired:false, reason:"ng-blocked", ...extra }` の `extra` は呼び出し元（`fireNormalCore`:676 / `askWithVision`:639）で組み立てられ、中身は `{injectedChars, includedCount}` または `{injectedChars, includedCount, vision:true}` のみ（`fire-orchestrator.mjs:626-639`, `:664-676` で実際に確認）。数値・boolean のみで本文を含まない。
- **onSoulTranscript で broadcast されるエントリ**: `cockpit-server.mjs:1152` `onSoulTranscript: (entry) => broadcastSoulTranscript(entry)` → `broadcastSoulTranscript`（`:1133`）内の `toWireEntry(entry)`（`:476-482`）は `startMs/endMs/text/appendedAtMs/speaker/displayName` のみを取り出す。`entry.text` は上記のとおり `NG_BLOCKED_NOTE` 固定なので、SSE `transcript` イベントにも本文は流れない。
- **`containsNgWord` 内部**: `ng-words.mjs:62-67` — `console.*` 呼び出し・`throw` 一切なし。単純な `boolean` 返却のみ（目視で確認、grep でも `console`/`throw` ヒットなし）。

**テストによる直接検証**（`fire-orchestrator.test.mjs:1806-1853`）: 命中応答で発火した診断・戻り値・soul 全件を `JSON.stringify` した文字列に、NG語自体 (`ngWord`) と応答本文全体 (`replyText`) の両方が含まれないことを assert している（`:1844-1849`）。これは仕様書の要求を超える踏み込んだ検証で、秘匿の担保として質が高い。

## 2. 検問所の位置（§Domain C）— **合格**

`processAskedReply` 内の実際の並び（`fire-orchestrator.mjs:330-386`）:

1. `:338-339` `parseExpressionTags(replyText)` → `speechText` 確定
2. `:348-351` in-flight キル検査（Domain A、`killed` フラグ）
3. `:357-364` **NG 検問所**（この直後）
4. `:366` `hasSpeech = speechText.length > 0`
5. `:386` `speakImpl(speechText, ...)`

指示どおり「speechText 確定後・speakImpl 前・in-flight キル検査の直後」に正確に位置している。

**空応答の素通り確認**: `containsNgWord("")` は `ng-words.mjs:63` の `if (typeof text !== "string" || text.length === 0) return false;` により防御的に `false`。`ng-words.test.mjs:49-51` でも直接テスト済み。expression-only（speechText 空・events あり）はこの検問所を無変化で通過し、既存の `:380-383` 分岐（speak せず演出のみ）へ正しく進む。

**視覚発火経路**: `askWithVision`（:614-640）も通常 `fireNormalCore`（:654-680）も最終的に共通の `processAskedReply` を呼ぶため、検問所は分岐追加なしで両経路に効く。`fire-orchestrator.test.mjs:1885-1917` のテストで実際に `fire({vision:true})` 経路でも `ng-blocked` になることを確認済み。

## 3. 無退行（§4）— **合格**

`git diff -- apps/soul/agent/src/mind/fire-orchestrator.mjs` を確認したところ、`processAskedReply` 内で追加されたのは import 文・ヘッダ JSDoc の S8 NG 最終検査節・`:348-364` の kill/NG 検問所ブロックのみ。`hasSpeech`（:366）以降のコード（speak・soul 記録・演出・completion 処理）は diff 上 1 行も変更されていない（既存のインデント・条件分岐が完全に温存されている）。

`apps/soul/agent` を cwd に `node --test` を独立に再実行し、**764/764 全緑**を確認した（Gnome 報告の数字と一致）。

## 4. health / データ駆動（§Domain C）— **合格**

- `NG_WORDS`（`ng-words.mjs:35-41`）は `Object.freeze([...])`、健全性テスト `ng-words.test.mjs:13-15` で `Object.isFrozen` を検証。`NORMALIZED_NG_WORDS`（`ng-words.mjs:54`）も `Object.freeze` された事前計算配列。NG_WORDS は文字列配列（ネストなし）のため `expression-table.mjs` のようなネスト二重凍結の構造は該当せず、「値配列 + 事前正規化済み配列」の2つの凍結配列という形が実体に即した合理的な適応と判断する。
- **NFKC 正規化の正しさ**: `NORMALIZED_NG_WORDS` は `NG_WORDS.map(normalizeNfkc)`（`ng-words.mjs:54`）で事前正規化済み、`containsNgWord` も入力を `normalizeNfkc(text)`（`:64`）してから比較しており、両辺とも正規化済み同士の比較になっている（正しい実装）。実機で以下を確認した:
  - 半角カタカナ+半角濁点 → NFKC で全角濁点カタカナに正規化され命中（`ng-words.test.mjs:40-47` のテストと同じ現象を再実行し確認）。
  - 結合文字の濁点分解表記（`"シ" + U+3099`）も NFKC で合成され `"ジ"` になり命中することを実機で追加検証した（テストには含まれていないが、NFKC の一般的な正規化能力の範囲内であることを確認）。
- **素朴形の範囲順守**: `containsNgWord` は正規化+部分一致のみ。濁点分解専用処理・かな⇔カナ変換・伏字/読み替え対応など、v0 外とされた凝った処理は一切持ち込まれていない（コード全文確認済み）。

---

## 追加 design 検証

### NG 語選定の妥当性 — **重大な所見あり（誤爆リスク）**

Gnome は「チョン」を日常語（ちょんまげ/ちょんぼ）との部分一致衝突を理由に不採用にしたと報告しているが、**採用した語自体にも同種の衝突が実在する**ことを実機で確認した:

```
"この人はガイジンですね"          -> containsNgWord = true（誤爆）
"本土人口が減っている"            -> containsNgWord = true（誤爆）
"郷土人形を集めています"          -> containsNgWord = true（誤爆）
"情報からつんぼ桟敷に置かれている" -> containsNgWord = true（誤爆）
```

- **「ガイジ」→「ガイジン」誤爆**: カタカナ表記の「ガイジン」（外国人を指すくだけた一般語。ゲーム実況・VTuber 配信の文脈で「外国人プレイヤー」「外国人視聴者」の意で日常的に使われる）は文字列として「ガイジ」を前方3文字に含むため、`containsNgWord` が無条件で命中する。これは他の語より発生頻度が高いと考えられ、実務上のリスクが最も大きい。
- **「土人」→複合語誤爆**: 「本土人口」「郷土人形」のように、地理・文化文脈でごく普通に使われる複合語が「土人」を部分文字列として含む。
- **「つんぼ」→慣用句誤爆**: 「つんぼ桟敷（に置かれる）」は語源に差別的背景を持つが、現代でも「情報から疎外される」意味の慣用句として一般に（語源への意識なく）使われることがある。

これらは人間ゲート基準②「弁が通常の発話を邪魔しない」に抵触しうる。Gnome の裁量判断（domain-c.md 裁量判断1）は「チョン」の衝突は検討したが、これらの衝突には言及がなく、`s8-followup.md` §3 の v0 外項目にも記載がない。**見落としの可能性が高い。**

ただし、これは blocking 基準（§4）の対象ではなく、計画・Gnome 双方が明記するとおり「starter（v0）でありユーザーが人間ゲートで最終確認/編集する」前提の設計になっている。コード構造上も `NG_WORDS`（`ng-words.mjs` の 1 箇所）を編集するだけで語彙の追加/削除ができる。**そのため blocking としては扱わないが、人間ゲート②の短時間確認だけでは低頻度語の誤爆は見逃されやすいため、この具体例をユーザーへ明示的に申し送ることを推奨する。**

### NFKC 正規化の網羅性 — 所見なし（v0 として十分）

全角/半角カタカナ・結合濁点の揺れは吸収できることを確認した。ひらがな⇔カタカナ変換・伏字/読み替え対応は NFKC の範囲外だが、これは設計判断どおり v0 外として明記されており、過不足ない。

### `NG_BLOCKED_NOTE` を `ng-words.mjs` に置いた裁量 — 妥当

`barge-in.mjs`（`:1-45` 確認）は「barge-in の純部品」という明確なスコープを持ち、`KILL_NOTE`（Domain A・kill 機能）もここに同居している。NG 検査は barge-in/kill とは別種の機能（検閲）であり、`NG_WORDS`/`containsNgWord`/`NG_BLOCKED_NOTE` を1モジュールに集約する方が「語彙を触りたいときはここだけ」という設計思想に忠実という Gnome の説明は妥当と判断する。`KILL_NOTE` が barge-in.mjs 側にあるという非対称性は生じるが、機能カテゴリの違いによる区別として合理的であり、instabilityを生む問題ではない。

---

## 質問（Orch-Sylph への申し送り）

1. **NG 語選定の誤爆リスク**: 上記「ガイジン」「本土人口」「郷土人形」「つんぼ桟敷」の具体例は、ユーザーが人間ゲート②を実施する際に明示的に伝えるべきと考えるが、この伝達を Orch-Sylph の完了報告に含めるか、それとも `s8-followup.md` への追記が必要か、判断を委ねたい（コード修正は不要と判断している）。
2. 上記以外に blocking 基準・design 適合上の懸念はない。

---

## 参照ファイル

- `apps/soul/agent/src/mind/ng-words.mjs`
- `apps/soul/agent/src/mind/ng-words.test.mjs`
- `apps/soul/agent/src/mind/fire-orchestrator.mjs`（:330-386 processAskedReply、:357-364 NG 検問所）
- `apps/soul/agent/src/mind/fire-orchestrator.test.mjs`（:1804-1917 S8 NG 最終検査テスト）
- `apps/soul/agent/src/ears/transcript-buffer.mjs`（:74 TranscriptEntry 型、:147 append）
- `apps/soul/agent/src/cockpit/cockpit-server.mjs`（:476-482 toWireEntry、:560-592 handleDiagnostic、:1132-1153 broadcastSoulTranscript/hooks 配線）
- `apps/soul/agent/src/mind/barge-in.mjs`（:1-45 ヘッダ・BARGE_IN_NOTE/KILL_NOTE）
- `apps/soul/README.md`（:363-388 S8 節）
- `discussion/ai-cohost/implementation/waves/s8/s8-followup.md`
