# S8 Domain C レビュー — spec 適合レーン

> レビュアー: Review-Sylph（spec 適合レーン・読み取り専任）
> 対象: `apps/soul/agent/src/mind/ng-words.mjs`（新規）・`ng-words.test.mjs`（新規）・
> `fire-orchestrator.mjs`（NG 検問所追加分）・`fire-orchestrator.test.mjs`（NG テスト追加分）・
> `apps/soul/README.md`（S8 安全弁節）・`discussion/ai-cohost/implementation/waves/s8/s8-followup.md`
> 判定基準: [s8-wave-plan.md](../../orchestration/s8-wave-plan.md) §Domain C・§1・§2、
> [s8-planning-inventory.md](../../orchestration/s8-planning-inventory.md) §1-2 裁定 2/4/5・§2-2

## 判定: **合格**

機械ゲート（`node --test`）を独立再実行で確認。`apps/soul/agent` を cwd に実行し、Gnome 報告と同一の
結果を得た。

```
1..764
# tests 764
# pass 764
# fail 0
```

（Domain A/B 込みベースライン 751 + Domain C 新規 13 件 = 764、Gnome 報告と一致。）

## spec チェックリスト（✓/✗ + 根拠）

### 1. ng-words.mjs = expression-table 形式（凍結・集約・health test） — ✓

`NG_WORDS = Object.freeze([...])`（ng-words.mjs:35-41）で凍結。`NORMALIZED_NG_WORDS =
Object.freeze(NG_WORDS.map(...))`（:54）で正規化済みキャッシュも別途凍結。語彙は `NG_WORDS` の
1 箇所に集約（ヘッダ JSDoc :13「語数・語彙を触りたいときは `NG_WORDS` のこの 1 箇所だけを触る」）。
`ng-words.test.mjs` の health test（凍結・全要素非空文字列・語数 3〜5 帯・重複なし、4 件）で構造整合を
固定している。

軽微な注記: domain-c.md はこれを「`Object.freeze` 二重凍結」と表現しているが、`expression-table.mjs`
の二重凍結（`EXPRESSION_TABLE` オブジェクト全体 + 内側の各表現配列 + 各イベントオブジェクトという
真にネストした可変構造への多層 freeze）とは性質が異なる。`NG_WORDS` はフラットな文字列配列であり、
要素（文字列）自体が不変プリミティブのため、配列そのものへの freeze 1 段で構造的には十分。2 回目の
`Object.freeze` は `NG_WORDS` 自身のネスト構造ではなく、別途算出した派生キャッシュ
（`NORMALIZED_NG_WORDS`）に対するものである。機能上の欠陥ではなく、report の言い回しがやや誇張気味
という程度の指摘。

### 2. 最小リスト（差別語級のみ・裁定 2） — ✓

`NG_WORDS` = `きちがい`/`土人`/`支那人`/`ガイジ`/`つんぼ`（5 語）。いずれも差別語級で、URL/電話番号
パターンや軽度の悪態は含まれない。ヘッダ JSDoc（:9-13）・README（後述）双方に「starter・過剰に広げ
ない」旨を明記。裁定 2「URL/電話番号パターンの読み上げ抑止は v0 外」との整合を確認。

### 3. NFKC 正規化 + 部分一致の素朴形 — ✓

`containsNgWord(text)`（ng-words.mjs:62-67）: `typeof text !== "string" || text.length === 0` を
まず `false`（:63）、`text.normalize("NFKC")` で正規化（`normalizeNfkc`、:48-51）、
`NORMALIZED_NG_WORDS.some((w) => ... normalized.includes(w))` で部分一致判定。空文字/非文字列が
`false` になることは `ng-words.test.mjs`（空文字列テスト・非文字列 5 種テスト）で直接確認済み。
全角/半角揺れの NFKC 吸収（半角カタカナ+濁点→「ガイジ」）もテストで検証済み（半角表記でも命中）。

### 4. 検問所の位置（speechText 確定後〜speakImpl 前・通常/視覚両方） — ✓

`fire-orchestrator.mjs` を実読して確認: `processAskedReply` 内 `speechText = parsed.speechText`
（:339）確定後、in-flight キル検査（:346-350）の直後・`hasSpeech`（:366）計算より前、`speakImpl`
呼び出し（:386）より前に `if (containsNgWord(speechText)) {...}`（:357-364）を挿入。Domain A のキル
検査（in-flight）と同一検問所に並んでいることを確認した。`processAskedReply` は通常 Fire（:676 の
`fireNormalCore` 相当経路）と視覚発火の共通コア（:639）の両方から呼ばれる唯一の合流点であるため、
分岐を書かずに両経路に自動的に効く構造を確認した。

テストでも通常発火（fire-orchestrator.test.mjs:1855）と視覚発火 `fire({vision:true})`
（:1885、`getVisionTarget`/`captureImpl` を fake にして起動）の両方で NG 検査が効くことを確認済み。

### 5. 命中 = 丸ごと没 — ✓

命中時（fire-orchestrator.mjs:357-364）: `speakImpl` 不呼び出し（`return` で以降の分岐に進まない）・
`buffer.append({..., text: NG_BLOCKED_NOTE, speaker:"soul"})` で soul 本文の代わりに事実文字列のみ
追記・`onDiagnostic({type:"ngBlocked"})`（キーは type のみ）・戻り値 `{fired:false,
reason:"ng-blocked", ...extra}`。

テスト（:1806-1853）で speak 不呼び出し・soul が you 発話 + `NG_BLOCKED_NOTE` の 2 件のみ・診断
`ngBlocked` のキーが `["type"]` のみであることを直接 assert 済み。

軽微な注記: `NG_BLOCKED_NOTE`（ng-words.mjs:76）は `"（発話を没にした: NG検査）"`（全角括弧・
スペースなし）。s8-wave-plan.md §Domain C の原文（:41）は `「(発話を没にした: NG 検査)」`（半角括弧・
「NG」と「検査」の間に半角スペース）であり、句読点の幅とスペースの有無が完全一致ではない。
domain-c.md は「文言をそのまま採用」と記述しているが、実際には `BARGE_IN_NOTE`/`KILL_NOTE` の全角
括弧様式（`barge-in.mjs` の既存注記スタイル）に合わせて表記を正規化している。チェックリスト自体が
「相当の事実」という表現を使っており、意味内容は完全に一致しているため spec 適合上の欠陥とは見なさ
ないが、「そのまま採用」という report の記述はやや不正確。

### 6. 没にした内容の非記録（spec 面） — ✓

`fire-orchestrator.mjs` の命中分岐（:357-364）で `speechText`/命中語をどこにも渡していないことを
コード上で確認。さらに `fire-orchestrator.test.mjs` テスト 1（:1843-1849）で
`JSON.stringify(diags)`/`JSON.stringify(result)`/`JSON.stringify(all)` のいずれにも NG 語・応答本文が
含まれないことを直接 assert している（秘匿の直接検証）。

`cockpit-server.mjs` の `handleDiagnostic`（:560-590 付近）を軽く確認したところ、diagnostic は
`{type, message, reason, startMs, endMs, tag, kind, elapsedMs, charsSpoken, totalChars, prefix}` の
固定シェイプで SSE broadcast される。`{type:"ngBlocked"}` しか持たない診断オブジェクトでは他フィール
ドは全て `null` に落ちるため、SSE 経路でも本文・命中語が漏れないことを確認した（この層は Domain B の
担当領域だが、checklist 項目 6 が明示的に SSE に言及しているため軽く裏取りした）。詳細な秘匿の設計
健全性（design レーン）はここでは判定対象としない。

### 7. docs — README 安全弁節 — ✓

`apps/soul/README.md` の diff を確認。「#### S8: 配信に耐える（安全弁）」節が新設され、キルスイッチ
（ホットキー kill 専用・KILL ボタン復帰・severSpeaking 共有）・NG 最終検査・AI 開示・人間ゲートの
4 点を記載。NG 最終検査の記述に「**このリストはユーザーが人間ゲートで最終確認/編集する starter
（v0）**——語数・語彙を触りたいときは `NG_WORDS`（`src/mind/ng-words.mjs`）のこの 1 箇所だけを触る」
と明記されており、checklist が要求する starter 明記を満たしている。

### 8. docs — followup 台帳 — ✓

`discussion/ai-cohost/implementation/waves/s8/s8-followup.md`（新規）を確認。§1 で S8 新設語彙
（`reason:"ng-blocked"`・診断 `type:"ngBlocked"`・snapshot キー `killed` を含む一覧）、§2 で Domain
A/B からの申し送り 2 件、§3 で v0 外項目（URL/電話番号・NG リスト拡張・語形変化対応）、§4 で人間ゲート
未実施の記録、§5 で wave 外（AI 開示は L0 直轄）が記録されている。

## 裁量許容（spec 未定義を合理的に実装した箇所）

1. **NG 5 語の選定**（`きちがい`/`土人`/`支那人`/`ガイジ`/`つんぼ`）: 「差別語級・最小・日常語衝突を
   避ける」方針に沿っている。domain-c.md に検討過程が記録されており、「チョン」を著名な民族差別語と
   認識しつつ「ちょんまげ」「ちょんぼ」等の日常語との部分一致衝突（素朴な部分一致照合ゆえの誤爆
   リスク）を理由に見送った判断は、人間ゲート基準②（弁が通常の発話を邪魔しない）への配慮として
   妥当。5 語のいずれも日常会話で偶発的に部分一致しそうな一般語と重ならないことを目視でも確認した。
2. **`NG_BLOCKED_NOTE` の置き場所**（`barge-in.mjs` ではなく `ng-words.mjs`）: barge-in.mjs は
   「barge-in の純部品」という明確なスコープを持つファイルであり、NG 検査（検閲）とは別種の機能と
   いう整理は妥当。「NG 検査に関するすべてを 1 モジュールに集約する」という `ng-words.mjs` 自身の
   設計思想（唯一の在り処）とも整合する。
3. **README 節の位置**（S7 の後ではなく「操縦席UI改定」節の後・ファイル末尾）: 実際の README 構成
   （`grep` で確認: S2→S2.5→S3→S4→S5→S6→S7→操縦席UI改定→S8 の順）は「操縦席UI改定」が既に S7 と
   S8 の間に独立節として存在し、その節自体が「S8 前の独立閉問題」と明記している。字面上の番号順より
   実際の時系列を優先した判断は妥当。

## 質問

判断に迷う不足情報はありませんでした。念のため 1 点、Orch-Sylph の認識合わせとして記載します。

- **NG_BLOCKED_NOTE の文言の厳密性**（上記チェック 1・5 の軽微な注記）: domain-c.md は
  `s8-wave-plan.md` の文言を「そのまま採用」と記述しているが、実際には全角括弧・スペースなしへの
  正規化（`BARGE_IN_NOTE`/`KILL_NOTE` の既存様式への統一）が行われている。意味内容は完全に一致して
  おり spec 適合上の問題はないが、report の記述精度としてはやや不正確という点を記録しておく
  （blocking ではない）。

## まとめ

spec チェックリスト 8 項目全て ✓。`node --test` 独立再実行で 764/764 緑を確認（751 ベースライン +
13 件新規、Gnome 報告と一致）。検問所の位置（Domain A のキル検査と同一箇所・通常/視覚両経路への
自動適用）・命中時の丸ごと没・秘匿・docs（README starter 明記・followup 台帳）のいずれも実装・
テスト・docs の両面で裏付けが取れている。裁量判断（NG 5 語選定・NG_BLOCKED_NOTE 配置・README 節
位置）はいずれも spec の趣旨に沿った妥当な判断と評価する。軽微な注記 2 点（「二重凍結」表現の誇張・
NG_BLOCKED_NOTE 文言の句読点差異）はいずれも blocking ではない。
