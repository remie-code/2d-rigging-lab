# S4 Domain A レビュー（spec レーン）— 契約適合・裁定適合

> レビュア: Review-Sylph（spec レーン）。呼び出し元: Orch-Sylph。読み取り専任。
> 対象: S4 Domain A（パーサ + 演出表 + 翻訳層 + 結線）。
> 契約の正: [../../orchestration/s4-wave-plan.md](../../orchestration/s4-wave-plan.md) / [../../orchestration/s4-planning-inventory.md](../../orchestration/s4-planning-inventory.md)。
> 実装 Claim: [../../waves/s4/domain-a.md](../../waves/s4/domain-a.md)。
> 実施日: 2026-07-13。

## 総合判定: **PASS-with-nonblocking**

blocking（契約違反・裁定破り）は **ゼロ**。11 検証項目すべて PASS。non-blocking は全て「Domain B への正当な申し送り」であり、Domain A の契約範囲内では実装は完備している。

## 自分で再実行した node --test の生数字

`cd apps/soul/agent && node --test`（1 回で完走・再試行不要）:

```
# tests 326
# pass  326
# fail  0
# cancelled 0
# skipped 0
# todo 0
```

Gnome 主張（domain-a.md §8: tests 326 / pass 326 / fail 0）と **完全一致**。

## 検証項目（契約適合・PASS/FAIL と根拠）

| # | 項目 | 判定 | 根拠 |
|---|---|---|---|
| 1 | 語彙6語が過不足なく演出表にある | **PASS** | `expression-table.mjs:52-92` に smile/troubled/surprised/nod/look-away/look-camera を宣言。`expression-table.test.mjs:41-46` が「6語ちょうど」を deepEqual で固定。裁定5と一致。 |
| 2 | sustain 2〜4秒帯が全エントリで守られる | **PASS** | 実数値: smile 全2600 / troubled 全2400 / surprised 全2000 / nod 2000 / look-away 全2500 / look-camera 全2500（`expression-table.mjs:54-91`）。全て 2000〜2600ms。`expression-table.test.mjs:63-72` が 2000〜4000ms を全束エントリに強制。裁定4と一致。 |
| 3 | パーサがタグを完全剥離・speechText/会話ログ/TTS はタグなしのみ | **PASS** | `expression-parser.mjs:65-96` が well-formed タグ剥離 + 壊れ括弧無条件除去。`fire-orchestrator.mjs:233-234,261,264` が speechText を speak と soul append の双方に使用。裁定3と一致。 |
| 4 | 未知タグ剥離+診断（声にも演出にも出さない）・壊れタグ耐性 | **PASS** | `expression-parser.mjs:79-82`（未知タグは event 化せず unknownTag 診断）/`91-96`（壊れ括弧 brokenTag 診断 + 除去）/`54`（非文字列は空文字防御）。`expression-parser.test.mjs:52-120` が未知/混在/未閉じ/単独`>`/`<>`/非文字列を網羅。throw しない。 |
| 5 | 「タグが声に出る」性質テストが実在し未知/壊れ/混在を網羅 | **PASS** | `expression-parser.test.mjs:123-155` が18 fixture（空/生不等号/`<>`/`<<smile>>`/混在/`<look-at ...>`/絵文字+壊れ 等）に対し speechText に `<` `>` 非残留を assert。加えて events は既知語のみ・diagnostics は配列であることも検証。 |
| 6 | soul 記録=speechText のみへの修正がテストで固定・従来 replyText 込み記録が消えた | **PASS** | `fire-orchestrator.mjs:264` が `text: speechText` で append。`fire-orchestrator.test.mjs:97-100`（`all[1].text === "そうだね"` かつ `!includes("<")`）と `:341-345`（旧 S3 経路もタグなし文で固定）が従来のタグ込み記録の消滅を固定。裁定済みの意図変更。 |
| 7 | envelope 送出=発話開始時・スロット毎・rejected は診断へ握る・部分適用は正常系・発話は止めない | **PASS** | `fire-orchestrator.mjs:250-269`: `setState("speaking")` 直後に `applyExpressions` 起動、speak と独立の Promise。`:159-183` がスロット毎 `Promise.all` 送出、rejected/throw/未対応を全て `onDiagnostic` へ握り never-throw。`fire-orchestrator.test.mjs:140-194`（rejected/throw でも fired:true）・`:196-223`（expression-only）が固定。裁定と一致。 |
| 8 | 演出強さ係数が翻訳層（表の外）で適用・数値のコード埋め込みは演出表のみ | **PASS** | `expression-translator.mjs:68-73` が intensity を translate 層で適用。数値は `expression-table.mjs` のみ（parser/translator/orchestrator に演出数値なし。translator のクランプ境界 -1..1/0..1 は契約 normalizedRanges の構造事実であって演出値ではない旨を `:8,20-24` が明記）。裁定6と一致。 |
| 9 | 翻訳層 API=(word, args?, intensity) で S5 の look-at(x,y) を行追加で受けられる形 | **PASS** | `expression-translator.mjs:58` が `translateExpression(word, args, intensity=1.0)`。`expression-translator.test.mjs:109-113` が args 受け口を検証。パーサも args を生文字列保持（`expression-parser.mjs:73-77`・test:72-79）。S5 は表への行追加 + translator の args 解釈追加で足せる（署名不変）。裁定7と一致。 |
| 10 | 最小仮面へのタグ教示が語の列挙+「感情が動いたときだけ添える」程度で人格の作り込みをしていない | **PASS** | `fire-orchestrator.mjs:62-67`（FIRE_SYSTEM_PROMPT）: 6語列挙 + 「感情が動いたときだけ」「無理に付けなくてよい」+ 半角山括弧 + 最小例 +「読み上げ文には含めません」。人格記述なし。`fire-orchestrator.test.mjs:42-51` が6タグ包含を固定。裁定4と一致。 |
| 11 | 注視語2つ（look-away/look-camera）が args 付き API の口を先行して開けている | **PASS** | 両語が語彙6語に含まれ（`expression-table.mjs:81-91`）、パーサ・翻訳層とも全語共通の args 受け口を持つ。裁定5の趣旨「注視語2つは S5 の引数付き API=語+任意引数の口を先行して開ける」= args 付き API 形状を今から持つ、を満たす。S5 の look-at(x,y) は新語行追加で発展する布石。 |

## blocking（契約違反・裁定破り）

**なし。**

- 器コード（`apps/runtime-player/**`）・C4/C5 契約 JSON・lockfile・package.json の不変は Claim §1 が git status で主張。差分 stat（`git diff --stat master -- apps/soul/agent`）は soul パッケージ内のみで、器パスの改変は観測されず。requiredKinds 既定への `intent.envelope` 追加（`channel-client.mjs:89-91`）は Claim §5 のとおり C5 が additively 広告済みへの追随=裁定内変更で、器契約の改変ではない。

## non-blocking（改善提案・Domain B / Orch への申し送り）

1. **nod 単峰近似の美的リスク（裁定4に忠実な結果）**: nod は sustain 2000ms 単峰のため「顎を下げて2秒保持して戻す」近似で、頷きに見えない恐れ（Claim §9-1）。契約違反ではない（裁定4に忠実）が、**人間ゲート（Domain B・美的ゲート）で nod が頷きに見えるか要確認**。見えなければ decay 短縮の微調整か多峰演出（S5+）送り。
2. **符号のリグ依存・未確定**: head/gaze/body の peak 符号は `fallbackPositiveSign` のリグ学習依存で実機未確定（`expression-table.mjs:18-24`・Claim §9-2）。特に nod(-0.35)/surprised(+0.3) が意図どおり逆向きに出るか。Domain B の人間ゲートで確認・逆なら 1 行符号反転。契約範囲外の実機確定事項。
3. **強さ係数の CLI/設定配線が未接続**: `expressionIntensity` は orchestrator オプションとして口を開けたが CLI/設定への配線は未（Claim §9-4）。「操縦席に調整 UI を置かない」裁定（運用面限定）に沿い Domain B 領分。Domain A 契約範囲外。
4. **cockpit main 結線（onExpression→SSE/UI）未接続**: orchestrator は `onExpression` を emit する準備済みだが cockpit main への hooks 配線は Domain B 領分として未接続（Claim §9-5）。Domain A 契約範囲外。

## 環境ノート（正直な記録）

- レビュー中、Grep ツールおよび一部 Read 出力に重複行混入のレンダリング glitch が発生。純関数4ファイル（expression-table/parser/translator + それぞれの test）・fire-orchestrator（本体+test）は正常に全文 Read でき、それらを一次根拠とした。channel-client.mjs の requiredKinds 既定値（89-91行）は複数回の一致で確認、cockpit.mjs の sendEnvelope 公開（127行 ensure 委譲）は Bash grep で確認。node --test の生数字は tail 出力で clean に取得。判定に必要な根拠は全て確保できている。
</parameter>
</invoke>
