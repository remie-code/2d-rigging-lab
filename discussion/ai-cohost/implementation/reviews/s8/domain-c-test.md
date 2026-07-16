# S8 Domain C レビュー（test 適合レーン）

担当: Review-Sylph（test 適合・読み取り専任）
対象: `apps/soul/agent/src/mind/ng-words.test.mjs`（新規・10 件）・
`apps/soul/agent/src/mind/fire-orchestrator.test.mjs`（末尾「S8『NG 最終検査』」節・3 件）
突き合わせ先: `apps/soul/agent/src/mind/ng-words.mjs`（新規）・
`apps/soul/agent/src/mind/fire-orchestrator.mjs`（`processAskedReply` 内の検問所）

## 判定: **合格**

## 1. 生集計（自分で実測・再実行）

`apps/soul/agent` を cwd に `node --test` フルスイート:

```
1..764
# tests 764
# suites 0
# pass 764
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 2369.281
```

期待どおり 764/764/0（Gnome 報告の 751→764・net +13 と一致）。

`git status --short apps/soul/agent/src/mind/` で `ng-words.mjs`/`ng-words.test.mjs` が `??`（新規未追跡）
であることを確認済み。フルスイート実行がこの新規ファイルを実際に拾っていることを裏取りするため、
対象 4 ファイル（`ng-words.test.mjs`・`fire-orchestrator.test.mjs`・`barge-in.test.mjs`・
`expression-table.test.mjs`）だけを個別実行し、97/97 緑・新規 13 件すべてが `ok` であることを行単位で
確認した:

```
ok 85 - ngBlocked: NG 語を含む応答は丸ごと没——speakImpl 不呼び出し・soul へ NG_BLOCKED_NOTE のみ 1 件・ngBlocked 診断・戻り値 reason:'ng-blocked'（応答本文/命中語は一切漏れない）
ok 86 - ngBlocked: NG 語を含まない普通の応答は従来どおり speak され soul へ speechText が追記される（無退行）
ok 87 - ngBlocked: 視覚発火 fire({vision:true}) 経路でも NG 検査が効く（processAskedReply 共通経路の確認）
ok 88 - NG 語彙: 凍結されている（Object.freeze）
ok 89 - NG 語彙: 全要素が非空文字列
ok 90 - NG 語彙: 語数は想定範囲（3〜5 語・過剰に広げない）
ok 91 - NG 語彙: 重複なし
ok 92 - containsNgWord: NG 語を含む文で true（命中）
ok 93 - containsNgWord: NG 語を含まない普通の文で false（非命中・無退行の要）
ok 94 - containsNgWord: 全角/半角カタカナの揺れを NFKC 正規化で吸収する
ok 95 - containsNgWord: 空文字列は false
ok 96 - containsNgWord: 非文字列（null/undefined/数値/オブジェクト）は false（防御的）
ok 97 - NG_BLOCKED_NOTE: 非空文字列であり NG_WORDS のいずれの語も含まない（本文を持たない事実文字列）
# tests 97
# pass 97
# fail 0
```

## 2. 要求×テスト対応表（wave 計画 §Domain C「機械テスト」節）

| 要求 | テスト | 判定 |
|---|---|---|
| 命中で没（speakImpl 不呼び出し・soul は NG_BLOCKED_NOTE のみ 1 件・診断 ngBlocked・戻り値 reason:"ng-blocked"） | `ngBlocked: NG 語を含む応答は丸ごと没…`（fire-orchestrator.test.mjs:1806-1853） | ◯ |
| **秘匿の直接検証**（診断・戻り値・soul 追記のいずれにも命中語/応答本文が含まれない） | 同テスト内 `assert.ok(!JSON.stringify(diags/result/all).includes(ngWord/replyText))` 6 本（:1844-1849） | ◯（本物・下記 §3 参照） |
| 非命中は素通り（無退行） | `ngBlocked: NG 語を含まない普通の応答は従来どおり…`（:1855-1883） | ◯ |
| 正規化照合（NFKC 全角/半角揺れ・空/非文字列 false） | `containsNgWord: 全角/半角カタカナの揺れを…`・`空文字列は false`・`非文字列…は false`（ng-words.test.mjs:40-59） | ◯ |
| リスト health（凍結・非空文字列・語数帯・重複なし） | `NG 語彙: 凍結されている`・`全要素が非空文字列`・`語数は想定範囲`・`重複なし`（ng-words.test.mjs:13-30） | ◯ |
| （任意）視覚発火経路でも NG 検査が効く | `ngBlocked: 視覚発火 fire({vision:true}) 経路でも…`（:1885-1917） | ◯ |
| （付随）NG_BLOCKED_NOTE 自体が NG 語を含まない | `NG_BLOCKED_NOTE: 非空文字列であり…`（ng-words.test.mjs:61-65） | ◯ |

計画本文の必須 4 項目（命中で没/秘匿/非命中は素通り/正規化照合/リスト health＝実質 5 項目）を全て
実テストが押さえている。任意項目（視覚発火経路）も追加でカバー済み。

## 3. テスト品質所見

- **決定論**: `fire-orchestrator.test.mjs` の 3 件は `makeFakeSpeak`（呼ばれたテキストを記録するだけの
  fake、実 TTS/実再生なし）・`fakeChannel`/`fakePlayer`（副作用なしの定数フェイク）・
  `makeFakeCapture`（固定 base64/幅高さを返すだけの fake capture）で完結しており、実 SDK・実ネット・
  実タイマ依存はゼロ。`ng-words.test.mjs` はモジュール直呼びの純粋関数テストで、フェイクすら不要な
  完全な決定論。
- **`{timeout}` 付与**: `fire-orchestrator.test.mjs` の新規 3 件はいずれも `{ timeout: 5000 }` を明示
  しており（既存様式どおり）欠落なし。`ng-words.test.mjs` の 10 件には timeout オプションが無いが、
  全テストが同期関数（`async`/`await`/タイマ一切なし）であり、同じ「健全性テスト」の先例
  `expression-table.test.mjs`（S4 Domain A）にも timeout は一切付与されていない。よってこれは Domain C
  固有の後退ではなく、既存の「同期の宣言健全性テストには timeout を付けない」慣習への追従であり
  欠落と判定しない。
- **秘匿検証の本物度（最重要点）**: `fire-orchestrator.test.mjs` テスト 1 は、`ngBlocked` 診断の
  キーが `["type"]` のみであることを `Object.keys` で先に固定したうえで、**さらに**
  `JSON.stringify(diags)`/`JSON.stringify(result)`/`JSON.stringify(all)` の 3 オブジェクトそれぞれに
  対して NG 語（`ngWord = NG_WORDS[0]`）と応答本文全体（`replyText`）の非包含を独立に assert している
  （6 本）。これは「特定フィールドを見ない」という消極的検査ではなく、オブジェクト全体を文字列化して
  横断的に検索する積極的検査であり、実装側で万一別のフィールド（例えば将来 `extra` に何か追加された
  場合）に漏れても検出できる構造になっている。実装側 `processAskedReply` を読むと `...extra` は
  `injectedChars`/`includedCount`/`vision` のみで応答本文を運ばない設計（:639, :676 の呼び出し箇所で
  確認済み）であり、テストの JSON 文字列検索はこの構造的保証を実際に踏んで検証している。見せかけの
  検証ではない。
- **主張と assert の一致**:「speak されない」は `fakeSpeak.spoken.length === 0`（記録配列長）で確認、
  「非命中では従来どおり」は `fired:true`・`fakeSpeak.spoken[0].text` の一致・`buffer.all()` の
  soul エントリ一致・`ngBlocked` 診断が出ないことの 4 点で確認しており、主張どおりの粒度で assert
  されている。「視覚発火経路でも効く」も `captureImpl`/`getVisionTarget` を fake にした状態で
  `fire({vision:true})` を実際に呼び、`processAskedReply` の共通経路であることを実行結果（`reason`・
  `spoken.length`・`buffer.all()`）で裏取りしている。
- **health test の様式踏襲**: `ng-words.test.mjs` は 1 テスト 1 観点を基本としつつ、
  `expression-table.test.mjs` の先例（例: 「演出表: ADS 各相は非負・合計 > 0」テストが attackMs/
  sustainMs/decayMs/合計の 4 assert を 1 テストにまとめている）と同じ粒度で、`NG_BLOCKED_NOTE` テスト
  （非空文字列であること + NG 語を含まないこと、の 2 点を 1 テストにまとめている）や「全要素が非空
  文字列」テスト（`typeof` チェックと `length > 0` を 1 テストにまとめている）を書いている。これは
  先例からの逸脱ではなく、同一対象に対する密接に関連した複数 assert をまとめる既存の粒度規範に
  忠実である。
- **状態残留の確認**: 3 件とも末尾で `orch.getState() === "idle"` を確認しており、NG 没後・視覚 NG 没後
  に `busy`/`speaking` 固着が残らないことも副次的に固定している。

## 4. カバレッジ不足・所見

1. **「空応答（expression-only）は検問所を素通りする」というオーケストレータ結合テストは無い**:
   `fire-orchestrator.mjs:355-356` のコメントで「`containsNgWord("")` は false ゆえ空の speechText は
   ここを素通りする」と説明されているが、これはユニットレベル（`ng-words.test.mjs` の「空文字列は
   false」）でのみ検証されており、`fire()` を実際に空 speechText（タグのみ応答）で撃って NG 検問所を
   通過し `expression-only` 分岐まで到達することを確認する結合テストは無い。ただし wave 計画 §Domain C
   の必須機械テスト項目（命中で没/非命中は素通り/正規化照合/リスト health）には含まれておらず、
   `containsNgWord` の純関数保証から論理的に導出可能な性質であるため、**blocking ではなく軽微な
   任意拡張の余地**として記録するに留める。
2. **NG 語の選定の妥当性そのもの**は test レーンの管轄外（Gnome 報告の「質問」節で明記済みのとおり
   ユーザー裁定事項）であり、本レビューでは対象としない。

## 質問

特にブロッキングの懸念はない。上記 §4-1 は軽微な所見であり、判定は「合格」で確定する。
