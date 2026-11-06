# Gnome 報告: 咳払いの落とし(段階 2)wave 2 — Domain B「画面の札」

- 判定(Gnome 申告): **完了**(escalate / blocked なし)
- 基準: `discussion/ai-cohost/implementation/orchestration/cough-filter-stage2-plan.md` §4 B の 1〜8
- ブランチ `ai-cohost/cough-experiment`(切り替え・コミットなし)。wave 1 の未コミットの変更には触れていない(checkout / restore / stash なし)。

## 機械ゲート
- `apps/soul/agent` で `node --test`: **2382 → 2402 件、全件 pass**(fail 0・cancelled 0・skipped 0)。増えた 20 件 = `view-logic/cough-chip.test.mjs` 12 件 + `cockpit-ui-cough.test.mjs` 7 件 + `view-logic/ghost.test.mjs` 1 件。
- リポジトリの根で `pnpm run check:soul-zone`: **pass**(1642 files scanned)。
- 依存・lockfile の変更なし。操縦席は起動していない。実データ・`.env*` は読んでいない。

## 作成・変更ファイル(`apps/soul/agent/src/cockpit/` の下)
- 新規: `view-logic/cough-chip.mjs`、`view-logic/cough-chip.test.mjs`、`cockpit-ui-cough.test.mjs`
- 変更: `ui/app.mjs`、`ui/header.mjs`、`ui/rows.mjs`、`ui/styles.mjs`、`view-logic/ghost.mjs`、`view-logic/ghost.test.mjs`
- 変更(8 の分だけ): `cockpit-server.mjs`(`COUGH_FILTER_OFF_WARNINGS` の message・detail と JSDoc のみ)、`cockpit-server-cough.test.mjs`(英語の文言の assert 3 か所を日本語へ + detail のコマンドの固定 1 行)
- 触っていない: `src/ears/**`、`src/mind`、`SSE_EVENT_NAMES`、`glance-timeline.mjs`、`cockpit-server.mjs` の上の定数以外。

## §4 B の 1〜8 の実装箇所と固定したテスト
1. **reason cough で「咳 ×N」**
   - 受け口: `ui/app.mjs:263-266`(`applyNonFeedSseEvent` の `case "discard"`。カウンタは今のまま、`d.reason === "cough"` のときだけ `setCoughChip((c) => coughChipAfterDiscard(c, d, nowMs))`)。状態は `ui/app.mjs:214`(`useState(emptyCoughChip)`)。受け取り時刻を渡すため `applyNonFeedSseEvent(eventName, d, nowMs)` に第 3 引数を足し、呼び出し(SSE の listener)で同じ `nowMs` を渡す。
   - 純関数: `view-logic/cough-chip.mjs:54`(`coughChipAfterDiscard`)、`:85`(`coughChipView`)。
   - 描画: `ui/header.mjs:129,140`(状態のピルのすぐ後ろに `<span class="cough-slot">`、中に札)。`ui/app.mjs:480` で `coughChip=${coughChip}` を TopBar へ。
   - blank は札に影響しない: `coughChipAfterDiscard` が reason cough 以外は同じ状態を返す。
   - テスト: `cough-chip.test.mjs`「reason cough を受けると「咳 ×1」…」「blank・reason の無い discard・形の違う値は札に影響しない」、`cockpit-ui-cough.test.mjs`「TopBar: 咳を受けると状態のピルのすぐ隣に…」「App の結線: …」
2. **8 秒で消える・延長・期限切れ後は ×1**
   - `view-logic/cough-chip.mjs:41`(`isLive`: `nowMs - lastAtMs < 8000`。8000ms ちょうどで消える)。受け取り時も `isLive` が偽なら `{ count: 1, entries: [新しい 1 件] }` から(`:61`)。
   - テスト: 「最後の咳からちょうど 8 秒で消える(7999ms は出す・8000ms は消す)」「消える前に次が来れば N が増え、8 秒をその時刻から数え直す」「消えたあとの次の咳は ×1 から(受け取りの時点で期限切れなら数え直す…)」、UI 側「札が無いとき・8 秒を過ぎたときも置き場は残り、札だけが消える」
3. **ホバー(title)**
   - `view-logic/cough-chip.mjs:74`(`coughChipEntryText`)・`:85`(`coughChipView` が entries を改行で連結)。entries は受け取りのたびに先頭へ足し、5 件で切る(新しい順)。
   - テスト: 「title は今の札が数えている区間を新しい順に最大 5 件(N は 5 を超えても数える)」「確率は小数 2 桁…」「text / speech が欠けた・型違いでも…」
4. **会話のタイムラインに出さない**
   - `glance-timeline.mjs` は無変更。既存の `glance-timeline.test.mjs:192` の固定は通過。追加で `cockpit-ui-cough.test.mjs`「会話のタイムライン: reason cough の discard も無視する」。
5. **ゴースト行のラベル**
   - `view-logic/ghost.mjs:36-39`(`discardGhostLabel(d)`: reason cough →「(咳として落とした)」、それ以外 →「(discarded)」)、`ui/rows.mjs:280`(`discardGhostLabel(d)` に data を渡す)。
   - テスト: `ghost.test.mjs`「discardGhostLabel: reason cough は咳と分かるラベル…」、`cockpit-ui-cough.test.mjs`「ログのタブ: reason cough のゴースト行は…行に文字と確率は出さない」(feed の JSON に「うん」「0.05」が無いこと)。既存の「(discarded)」の固定(`cockpit-ui.test.mjs:323`)もそのまま通過。
6. **帯の並びが崩れない・アニメーションなし**
   - `ui/styles.mjs:131-145`。置き場 `.cough-slot` を札が無いときも常に描き、`flex: 0 0 auto; width: 68px; overflow: hidden` で幅を確保。transition / animation / @keyframes なし。
   - テスト: 「COCKPIT_CSS: 札は薄いグレー…置き場は固定の幅で縮まない・アニメーションは無い」(CSS 全体に `@keyframes`・`animation`・`transition` が無いこと)、「TopBar: 札が無いとき…置き場(.cough-slot)は残り」
7. **nowTick で消す・サーバーに状態なし**
   - 描画時に `coughChipView(coughChip, nowMs)`(`ui/header.mjs:129`。nowMs は App の `nowTick`、`ui/app.mjs` の TopBar の `nowMs=${nowTick}`)。setTimeout は足していない。
   - テスト: 「App の結線」(`app.mjs` の `setTimeout(` は既存の「配信を終える」の 1 か所だけ・TopBar に `coughChip` と `nowMs=${nowTick}`)、「札の文字と確率はブラウザに保存しない・送り返さない・console に出さない」(ui/ と view-logic/ の全 .mjs に localStorage・sessionStorage・indexedDB が無い。`cough-chip.mjs` に `console.`・`fetch(`・`setTimeout(`・`setInterval(`・`Date.now(` が無い)。
8. **警告 `cough-filter-off` を日本語に**
   - `cockpit-server.mjs:205-226`(`COUGH_FILTER_OFF_WARNINGS` の message・detail と JSDoc)。
   - テスト: `cockpit-server-cough.test.mjs:331,334,367,565`(日本語の message 3 か所 + detail の末尾が取得コマンドと一字一致すること 1 行を追加)。

## 札の見た目
- クラス: 置き場 `cough-slot`、札 `cough-chip`(警告の `warn-chip` とは別。警告の欄 `.top-warnings` には入れない)。
- 色: `color: var(--muted)`、`border: 1px solid var(--border)`(`.warn-chip.more` の「+N」と同じ色の組)。`font-size: 12px; padding: 2px 9px; border-radius: 6px`(警告の札と同じ寸法)。背景は付けない。
- 位置: 上の帯の状態のピル(`status-pill`)のすぐ右。Discord の接続の表示はその右。置き場は常に 68px を取る(札が無いときは空の 68px。3 桁の N まではほぼ収まり、それ以上は ellipsis)。

## title の正確な形
- 1 区間 1 行、新しい順、改行(`\n`)で連結、最大 5 件。確率は `toFixed(2)`。
- 例(「うん」0.05 → 「ん」0.02 の順に来たとき):
  ```
  「ん」 Speech 0.02
  「うん」 Speech 0.05
  ```
- 文字が欠けた・文字列でない・空白だけ →「?」、確率が有限の数でない →「?」(例 `「?」 Speech ?`)。札の数(N)はそれでも数える。

## ゴースト行のラベル
- reason cough: `(咳として落とした)`(文字・確率なし)
- reason blank・reason なし: `(discarded)`(今のまま)

## 警告の新しい文言
| reason | message | detail |
|---|---|---|
| model-not-found | `咳の聞き分けが止まっている（モデルが無い）` | `取得: node apps/soul/agent/scripts/fetch-local-stt-models.mjs --only ced-tiny` |
| failed-to-load | `咳の聞き分けが止まっている（モデルを読み込めない）` | `null`(今のまま) |
- 括弧は既存の「声が止まっている（ElevenLabs）」に合わせて全角。コマンド文字列は一字も変えていない(テストで末尾一致を固定)。

## 裁量判断
1. 状態の形は `{ lastAtMs, count, entries }`。N(count)と title の区間(entries・5 件まで)を分けて持つ(6 件目以降も N は数える)。
2. 期限は `nowMs - lastAtMs < 8000` で生きている(8000ms ちょうどで消える。警告の `expiresAtMs <= nowMs` で消す流儀と同じ向き)。nowTick は 1 秒刻みなので、実際に消えるのは最後の咳から 8〜9 秒の間。時計が受け取りより前の値(負の差)のときは出す(受け取った直後の描画)。
3. 受け取り時刻は SSE の listener がすでに取っている `nowMs` を `applyNonFeedSseEvent` の第 3 引数で渡した(新たな `now()` 呼び出しは足していない)。
4. 確率は小数 2 桁(`toFixed`)。線が 0.1 なので 0.00〜0.09 になる。0.005 未満は `0.00` と出る。
5. 札の置き場は常に描く固定幅(絶対配置ではなく幅の確保)。Discord の場では状態のピルと接続の表示の間に 68px の空きが常にある。
6. title に見出しや「ほか N 件」は付けない(§2 の 9 の形だけ)。
7. detail の前置き「Fetch it with:」は「取得:」にした。
8. 場が変わっても札は戻さない(8 秒で自然に消えるため。計画 §1「開き直したときに札が消えていてもよい」の範囲)。

## 残課題(非 blocking)
1. 本物のブラウザでの見た目(68px の幅の過不足・ホバーの改行の出方)は確かめていない(操縦席を起動しない指示どおり)。人のゲート(計画 §6)で確かめる。
2. 札は App の client state だけなので、ページを開き直すと消える(計画どおり)。
3. 文字は耳の上限(既定 4・最大 10 文字)以下しか来ない前提で、title の 1 行の長さは切っていない。

## 質問
なし。
