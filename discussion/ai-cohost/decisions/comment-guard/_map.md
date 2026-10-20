# Comment Guard Map

> decisions/ の子。YouTube コメントを LLM(チャッピーの会話の文脈)に入れる前に、判定 API で悪意あるコメントを弾く取り組み。

## 1. Why / 合意(ユーザー × ウンディーネ 2026-10-16)

- 今はコメントが無条件に転写バッファへ積まれ、LLM に渡り、コメント反応の発火判定にもかかる(apps/soul/agent/src/cockpit/cockpit-server.mjs の ingestChatMessage)。入口の検査は無い(ng-words.mjs はチャッピーの返事側の検査)。
- プロンプトインジェクション(乗っ取り)や誹謗中傷など悪意で構成されたコメントは LLM の推論に乗せたくない。判定を Decisions API で行う。
- 種類を分けて判定する: 問題なし / 乗っ取り / 誹謗中傷 / 荒らし。弾いたら LLM に一切渡さず、コメント反応の発火もさせない。
- 判定が失敗・タイムアウトしたら弾く(安全側)。フィードには「判定できず」。
- 「チャッピーに何かさせたいお願い」は微妙なラインで、正解を先に決めず Decisions API の結果を見る(ユーザー)。
- 操縦席では、弾いたコメントは 1 行に畳んで種類の札だけ出す([../../implementation/screens/cockpit-glance-redesign.md](../../implementation/screens/cockpit-glance-redesign.md))。

## 2. Key Files

| Path | Content |
|---|---|
| [experiments/01-comments.json](experiments/01-comments.json) | テスト用コメント集 45 件(普通・いじり・辛口・お願い・乗っ取り・判定を騙す・誹謗中傷・荒らし) |
| [experiments/01-test-set.md](experiments/01-test-set.md) | v1(4 択)と v2(乗っ取りの説明を具体化 + 乗っ取り単独の predicate)の結果 |

## 3. Decisions (2026-10-16、ユーザー)

- 判定は v2 の組み合わせ: 具体化した 4 択(問題なし / 乗っ取り / 誹謗中傷 / 荒らし)と、乗っ取り単独の predicate を同じリクエストで聞く。4 択が問題なし以外、または predicate ≥ 0.5 なら弾く。
- 微妙なラインは今の結果のままでよい: 「ポンコツやな笑」「配信者下手すぎ」は弾いてよい(ユーザー自身が聞く分にはよいが、チャッピーに反応してほしいとは感じない)。お願いは通る。「ああああ」連打が通るのは仕方ない。
- 4 択が判定拒否(refusal)を返したときは、predicate だけで決める(< 0.5 なら通す)。判定そのものの失敗・タイムアウトは弾く。

## 4. Unresolved Questions

- ユーザーの基準は「悪意か」に加えて「チャッピーに拾ってほしいか」を含む。「LLM に絶対に入れてはいけない(安全)」と「文脈には入れてよいが反応はしなくてよい(関心)」を分けるかは未決。今は弾く側にまとめている。
