# ドメイン報告: 咳払いの落とし(段階 2)wave 2 — Domain B「画面の札」

- 判定: **pass**
- ループ: 1 / 上限 5(Gnome 1 回・Review-Sylph 1 回で合格)
- 計画: `discussion/ai-cohost/implementation/orchestration/cough-filter-stage2-plan.md` §4 B の 1〜8
- Gnome の報告: `waves/cough-filter-stage2/domain-b-gnome-report.md`
- レビュー: `reviews/cough-filter-stage2/domain-b.md`(Review-Sylph・合格・blocking なし・§4 B の 1〜8 すべて適合)

## 機械ゲート
- `apps/soul/agent` で `node --test`: 2382 → **2402/2402 pass**。fail・skipped・cancelled は 0。Review-Sylph が自分で走らせて確かめた。増えた 20 件は cough-chip 12・ui-cough 7・ghost 1。
- リポジトリの根で `pnpm run check:soul-zone`: **pass**(1642 files・違反なし)。
- `src/mind`・`package.json`・`pnpm-lock.yaml` に差分はない(Orch-Sylph が `git status` で確かめた)。`SSE_EVENT_NAMES` と `glance-timeline.mjs` も変えていない(レビューで確かめた)。

## 作成・変更ファイル(`apps/soul/agent/src/cockpit/` の下・未コミット)
- 新規:
  - `view-logic/cough-chip.mjs`
  - `view-logic/cough-chip.test.mjs`
  - `cockpit-ui-cough.test.mjs`
- 変更:
  - `ui/app.mjs`
  - `ui/header.mjs`
  - `ui/rows.mjs`
  - `ui/styles.mjs`
  - `view-logic/ghost.mjs`
  - `view-logic/ghost.test.mjs`
- §4 B の 8 の分:
  - `cockpit-server.mjs`: `COUGH_FILTER_OFF_WARNINGS` の message・detail と、その JSDoc。
  - `cockpit-server-cough.test.mjs`: 文言の assert 3 か所を日本語にした。detail の末尾がコマンドと一字一致することを確かめる 1 行も足した。

## 画面の札
- **状態**: App の client state `{ lastAtMs, count, entries }` で持つ。受け口は `applyNonFeedSseEvent` の `case "discard"` で、reason が cough のときだけ動く。受け取った時点で期限が切れていれば ×1 から数え直す。
- **表示**: TopBar が描画のたびに `coughChipView(state, nowTick)` を呼ぶ。`nowMs - lastAtMs < 8000` の間だけ出す。setTimeout・setInterval は足していない。サーバーには状態を持たない。
- **見た目**: 状態のピルのすぐ右に、置き場 `.cough-slot` を常に置く(`flex: 0 0 auto; width: 68px`)。その中に札 `.cough-chip`「咳 ×N」を出す。札は 12px の薄いグレーで、色は `--muted`、枠は `--border`(「+N」の札と同じ組)。transition・animation・@keyframes は無い(テストで固定)。
- **消え方**: 最後の咳から 8 秒。時計が 1 秒刻みなので、画面から実際に消えるのは 8〜9 秒後になる。続けて落ちると N が増え、8 秒を数え直す。消えたあとの次の咳は ×1 から。ページを開き直すと札は消える。
- **ホバー(`title`)**:
  - 今の札が数えている区間を新しい順に並べ、改行でつなぐ。最大 5 件。確率は小数 2 桁。
  - 例: `「ん」 Speech 0.02` の次の行に `「うん」 Speech 0.05`。
  - 文字や確率が欠けている・型違いのときは「?」で埋める。その場合も N は数える。
- **ゴースト行**(ログのタブ): reason cough は `(咳として落とした)`。blank と reason なしは今のまま `(discarded)`。どちらにも文字と確率は出さない。
- **会話のタイムライン**: 出ない。`glance-timeline` は今のまま discard を無視していて、`glance-timeline.test.mjs:192` の固定も通る。
- **文字の漏れ**: 文字と確率は札の `title` にしか出ない。テストで次のことを固定した。
  - ui/ と view-logic/ のどのファイルにも localStorage・sessionStorage・indexedDB が無い。
  - `cough-chip.mjs` に console・fetch・タイマー・`Date.now(` が無い。

## 警告の新しい文言(`cough-filter-off`)
| reason | message | detail |
|---|---|---|
| model-not-found | 咳の聞き分けが止まっている（モデルが無い） | 取得: node apps/soul/agent/scripts/fetch-local-stt-models.mjs --only ced-tiny |
| failed-to-load | 咳の聞き分けが止まっている（モデルを読み込めない） | null |

- コマンドの部分は一字も変えていない。変えたのは前置きだけで、「Fetch it with:」を「取得:」にした。

## 裁量判断
- (Gnome)N と、ホバーに出す区間(5 件まで)は別々に持つ。6 件目からも N は数える。
- (Gnome)確率は小数 2 桁で出す。0.005 未満は 0.00 になる。
- (Gnome)幅は、絶対配置ではなく固定幅の置き場で確保した。そのため Discord の場では、ピルと接続の表示の間に 68px の空きが常にある。
- (Gnome)detail の前置きを「取得:」にした。ホバーには見出しも「ほか N 件」も付けない。
- (Orch-Sylph)レビューの非 blocking 1(下の残課題 1)は直していない。指示の範囲が `cockpit-server.mjs` の「その定数とテストだけ」なので、コメントでも外の行は触らず、残課題として渡す。

## 残課題(非 blocking)
1. `cockpit-server.mjs:1791` の `warnCoughFilterOff` の JSDoc に「決まった英語の 1 行」が残っている。文言を日本語にしたときの直し漏れで、範囲の外なので触っていない。次に触るときに 1 語直せば足りる。
2. 時計が 1 秒刻みなので、札が消えるのは 8〜9 秒後になる(計画の「8 秒」の範囲として許容)。
3. 場が切り替わっても札は残る。ただし最大 8 秒で消える。
4. 実際のブラウザでは見ていない。68px で足りるか、ホバーの改行がどう出るかは、人のゲート(計画 §6)で確かめる。
5. §4 B の 8 は、差分だけを切り出しての確認ができていない。`COUGH_FILTER_OFF_WARNINGS` は Domain A で入れた未コミットの定数なので、`git diff` では A と B の分を分けられない。レビューは中身を Gnome の報告と突き合わせ、定数のほかにロジックの変更が無いことを確かめた。

## 質問
- なし。

## 起動した子と閉域
| 役割 | agentId | 状態 |
|---|---|---|
| Gnome | `a8839c753145b4c7c` | 完了(SubagentHandback で報告を回収した) |
| Review-Sylph | `a568c2bc784e1a363` | 完了(同上) |
