# Domain E — 画面の組み直し 完了報告

> Orch-Sylph → Undine(2026-10-31)。計画: [../../orchestration/stream-restructure-wave-plan.md](../../orchestration/stream-restructure-wave-plan.md) §1 Domain E と Status の A〜D の追認。
> 判定: **pass**(ループ 1 回。止めた指摘 0 件。Undine に上げる分岐 0 件)。コミットはしていない(ブランチ `ai-cohost/stream-restructure`、差分の基準 8eff48cf)。
> 実装: Gnome(opus)→ [domain-e-gnome.md](domain-e-gnome.md)。レビュー: Review-Sylph(sonnet)→ [../../reviews/stream-restructure/domain-e.md](../../reviews/stream-restructure/domain-e.md)。
> 実データ(`cockpit-settings.local.json`・`memories/`・`roles/`・`session-usage/`)と鍵(`.env*.local`)には誰も触れていない(レビューは存在と更新日時だけを確認。`roles/` は無い)。操縦席は起動していない。

## 1. 機械ゲート

| ゲート | 結果 |
|---|---|
| `apps/soul/agent` で `node --test` | **1867 pass / 0 fail**(基準 1817 → +50)。Gnome とレビューの両方で実行 |
| 根で `pnpm run check:soul-zone` | pass(1565 files) |
| 依存・lockfile | 変更なし |
| 本物の LLM・外部 API | 呼ばない(偽物・loopback・一時フォルダ) |
| 判定の文面・②④の指示・種・`skills/` | 差分なし(レビューで確認) |

## 2. 作ったもの(要約。対応表は domain-e-gnome.md §2)

- 設定のダイアログを「配信の準備 / ロール / 運転 / 記憶 / ログ」の 5 タブに。配信の準備は毎回見るもの(YouTube・ゲームの窓・体があるときだけ器の URL)と `<details>` にたたんだもの(マイク・文字起こし・声の出力先・忙しい間のコメント)。select は保存した値で出す。場の途中はマイク・文字起こしだけ disabled。声の方式は外した(ロールの声へ)。
- ロール: 選択(場が閉じている間だけ)・今のロールの編集(`POST /api/role/edit`)・今のロールを写して作る(`POST /api/role/new`)・性格の指示の編集をこのタブへ。場が閉じていないと 409(性格の指示の PUT/DELETE も)。
- 運転: 自発・かぶり・手動の発火だけ。手動の Fire は場が開いていない間は画面で disabled・サーバで 409。
- 記憶: どのロールの記憶か(`placeInfo()`、置き場の準備を走らせない)。「今日を記録」は場が開いている間だけ押せる。
- 上の帯にロールの名前、下の帯の口数・話し始めはロールの値。状態のピルに開きかけ「始めてる」・閉じかけ「記録中」。
- 持ち越しの分: Windows の予約名を `isRoleId` で拒む(ロールの置き場・`memoryDirForRole`・`/api/role/new` に効く)。`"brain"` 種別と使われない CSS を削除。画面側の id の形は `view-logic/role.mjs` の 1 か所にまとめ、魂側との一致をテストで固定。記憶の引っ越しの失敗を上の帯の警告(`startupWarnings`)に出す。器の URL 欄を体で出し分け。`.channel-status.bodyless` の色。体だけの編集で `roleHooks.current()` が新しい値・`sessionContextRevision` が上がることを本物の server と createRoleHooks で確認。`connectSavedChat` → `keepPreconnectedChat`(場を開く前にこの起動で Connect したものだけ持ち込む)。`openStream` / `closeStream` に catch(想定外の例外で closed に戻る。opening では起こしたものを畳んで `stream.error`)。

## 3. 変えたファイル

変更: `apps/soul/agent/scripts/cockpit.mjs`、`scripts/cockpit-stream.test.mjs`、`src/cockpit/cockpit-server.mjs`、`cockpit-server.test.mjs`、`cockpit-ui.test.mjs`、`cockpit-ui-comment.test.mjs`、`cockpit-ui-speak-now.test.mjs`、`ui/{app,control-bar,conversation-instruction-editor,header,settings-drawer,styles}.mjs`、`view-logic/{control,conversation-instruction,glance-meters,settings}.mjs`、`src/memory/memory-store.test.mjs`、`src/mind/model-identity.mjs`・`.test.mjs`、`src/roles/role-store.mjs`・`.test.mjs`。
新規: `scripts/cockpit-role-edit.test.mjs`、`src/cockpit/cockpit-server-domain-e.test.mjs`、`src/cockpit/cockpit-ui-settings.test.mjs`、`src/cockpit/view-logic/role.mjs`。(すべて `apps/soul/agent/` の下)

## 4. 期待値を変えた既存テスト(26 件、すべて仕様変更。レビューで弱めたものなしを確認)

- `cockpit-server.test.mjs` 13 件: 手動の Fire の前に場を開く 1 行を足した(期待値は不変。`getBuffer()` の null → 非 null の 1 か所は耳が動いている結果)。
- `cockpit-stream.test.mjs` 4 件: YouTube の持ち込み 3 件(追認 (1))、ダイアログの Stop の撤去 1 件。
- `cockpit-ui.test.mjs` 7 件: 5 タブ化・旧 brain の撤去・頭の調整の移動・声の方式の撤去。
- `cockpit-ui-speak-now` 1 件・`cockpit-ui-comment` 1 件: 置き場の移動。
- テスト名つきの一覧は domain-e-gnome.md §4。

## 5. 裁量(16 項目は domain-e-gnome.md。レビューはすべて妥当と評価)

- 頭の調整(圧縮のしきい値・Codex の fast)はロールのタブの下に置いた(値は設定のまま)。
- ダイアログに「配信を始める」を残した(マイク・文字起こしを渡す道)。理由は `stream.error` をメイン画面と同じ値で出す。1 回押しで終わる Stop は外した(終えるはメイン画面の 2 回押しだけ)。
- 作った新しいロールはすぐ選ぶ。
- 名前を替えると名前の手がかり(呼ばれ方・whisper の手がかり・hotwords)を新しい名前から作り直す。
- 引っ越しに失敗した起動(手元だけの既定のロール)では編集と作成を断る。
- `.channel-status.bodyless` は `--compacting` の色。

## 6. 持ち越し

- **仕上げ**:
  - `/api/verbosity`・`/api/speak-start` の口が残り、場の途中でもロールに書ける(画面・AHK からの呼び出しは無いことを Orch-Sylph が grep で確認。呼ぶのはテストだけ)。場が閉じていなければ 409 にするのをレビュー・Orch-Sylph とも推す(→ 質問 1)。
  - README の追記、古い「頭脳・会話」「入出力タブ」の JSDoc とコメント、`keepPreconnectedChat` の整理(実体は `chatClient != null` だけ)。
- **全体の突き合わせ**:
  - ロールの編集 → `sessionContextRevision` → 場の始まり、の通し。声の方式の出どころがサーバの現況だけになった点。
  - `closeStream` の例外時は畳み直しだけで、記憶の最後の保存を頼まない(→ 質問 2)。opening の例外テストは耳を起こす前の例外だけで、「起こしたあとに畳まれる」は直接見ていない。
  - 体験の場面 3 は「YouTube は入れるだけで Connect は配信を始めるがやる」と書いている。追認 (1)(この起動で場を開く前に Connect したものだけ)とは文面がずれるので、体験の素描の注記をどうするか。
- **人間ゲート(計画 §6 の 6 ほか)**: 5 タブになっている / ゲームの窓・声の出力先が保存した値で選ばれている / 体なしのロールで器の URL 欄が消える / 前回の YouTube の URL が残っていても「配信を始める」で自動ではつながらない(場の途中で Connect する)/ 場が閉じている間は Fire と「今日を記録」が押せない / ロールの編集が次の「配信を始める」から効く / ピルの「始めてる」「記録中」。詳細はレビューの人間ゲートの節。

## 7. 質問(Undine へ。どれもループを止める分岐ではない)

1. `/api/verbosity`・`/api/speak-start` の場の途中の扱い。仕上げで「場が閉じていなければ 409」にするか、口ごと消すか(レビューは 409 を推す。消すと既存テストの書き換えが大きい)。
2. `closeStream` で想定外の例外が出たとき、会話の写しが取れていれば最後の保存をもう一度頼む形にするか(今は固まらないことだけを約束)。
3. Gnome の質問の追認: 名前を替えたら手がかり(hotwords 含む)を作り直す形でよいか・手がかりの編集欄は要るか / 新しいロールは作ったら選ぶ形でよいか / 頭の調整の置き場はロールのタブでよいか / ダイアログに「配信を始める」を残す形でよいか。レビューはいずれも現状でよいと評価。
