# 配信の組み直し: 全体の突き合わせと仕上げの完了報告(Orch-Sylph → Undine)

- 判定: **pass**
- ループ: 段 1 が 1 回、段 2〜3 が 1 回(止めた指摘 0 のため直しのループなし)
- コミット: していない(作業ツリーに未コミットの差分。基準 1a585775)

## 段 1: 全体の突き合わせ(Sylph opus)

- 結果 **pass・止めた指摘 0**。[../../reviews/stream-restructure/final.md](../../reviews/stream-restructure/final.md)
- 見る点 1〜7(場の始まり・Ctrl+C と「配信を終える」の同じ道・引っ越しの流れ・体なし・`openStream` の後半の例外の畳み・守り・phase と 409)すべて適合。耳の後の例外も `fail(…, {ears, session})` で畳まれる。
- 持ち越し 5 件(1〜3 は仕上げで処理、4・5 は手付かず)。Undine に上げる分岐 2 件(下記)。

## 段 2: 仕上げ(Gnome opus)

報告 [final-gnome.md](final-gnome.md)。
1. YouTube の自動接続: `POST /api/chat/source`(欄を離れたら保存のみ)を足し、「この起動で入れた / Connect した URL はつなぐ。前回から欄に残っているだけの URL はつながない」に。つながらなくても場は開く。欄の横に案内(`chatAutoConnectHint`)。テスト 5。
2. `/api/verbosity`・`/api/speak-start` は `streamPhase !== "closed"` で 409(何も変えない)。テスト 1。画面から叩く所は無し。
3. `closeStream` の想定外の例外でも最後の保存を 1 回だけ頼む(二重なし)、closed に戻る。`foldStream` を段ごとに握る形に。テスト 2。
4. README(`apps/soul/README.md`)・`--channel` の HELP・JSDoc・`memory-store.mjs` の頭の注記・`discussion/ai-cohost/memory/recall-flow.md` を今の形に。②④の指示の文面は無差分。
5. 持ち越し 1(耳の後の例外のテスト)追加、持ち越し 2(開きかけ・閉じかけの Connect を 409)直し + テスト、持ち越し 3 は 1 で解消。
- 期待値を変えた既存テスト 4 件(すべて仕様変更): `cockpit-stream` の YouTube 1 件(「前の場で Connect したものは次の場に持ち込まない」を外した — 言い直しで逆に)、`cockpit-server` 3 件(場の途中の変更が 409 になり「終える → 替える → 始める」の順に並べ替え。期待値そのものは不変)。

## 段 3: 見直し(Review-Sylph sonnet)

- 結果 **pass・止めた指摘 0**。[../../reviews/stream-restructure/final-fixes.md](../../reviews/stream-restructure/final-fixes.md)

## 機械ゲート

- `apps/soul/agent` で `node --test`: 1879 pass / 0 fail(基準 1867 + 12)。Gnome と Review-Sylph の両方が実行。
- 根で `pnpm run check:soul-zone`: pass。
- 依存・lockfile 無差分。実データ(`roles/` 無し、`memories/`・設定ファイルの日時不変)に触れていない。鍵・`_conventions.md`・種・②④・判定の文面・`skills/` 無差分。

## 変えたファイル(未コミット)

- `apps/soul/README.md`
- `apps/soul/agent/scripts/cockpit.mjs`、`apps/soul/agent/scripts/cockpit-stream.test.mjs`
- `apps/soul/agent/src/cockpit/cockpit-server.mjs`、`cockpit-server.test.mjs`、`cockpit-server-domain-e.test.mjs`、`cockpit-ui-settings.test.mjs`
- `apps/soul/agent/src/cockpit/ui/settings-drawer.mjs`、`view-logic/settings.mjs`、`view-logic/status.mjs`
- `apps/soul/agent/src/memory/memory-store.mjs`(注記のみ)
- `discussion/ai-cohost/memory/recall-flow.md`(説明文のみ)
- 新規: `reviews/stream-restructure/final.md`、`final-fixes.md`、`waves/stream-restructure/final-gnome.md`、`human-gate.md`、この報告

## 人間ゲート

[human-gate.md](human-gate.md)(計画 §6 の 6 項目 + 各報告・段 1・段 3 の確認を 0〜9 の順に)。

## Undine に確かめたい質問

1. (段 1 の分岐)器の URL を場の間に変えられる。固めるか、触れるまま(次の発火から張り直し)か。
2. (段 1 の分岐)開きかけの間に自発の発火が頼まれうる(手動 Fire は open 以外を断るので不揃い)。open まで捨てるか、今のままか。
3. (Gnome の裁量)同じ起動の 2 回目の配信で、前の場で入れた / Connect した URL へまたつなぐ形。「終えたら忘れる」にするか。人間ゲート 4 で感想を取る形にした。
4. (Gnome の裁量)Disconnect で「この起動で入れた」を消す形でよいか(レビューは妥当)。
5. (Gnome の裁量)欄の横の案内の文面と置き場でよいか(1 行で外せる)。
6. (Gnome の裁量 + レビューの懸念)「配信を始める」の中で YouTube の `client.start()` を待つ形。取得に上限が見えず、応答が来ないと「始めてる」が長引き、その間は終えるも 409。上限を持たせるか、待たずに先に開くか。人間ゲート 4 で長さを見る形にした。

## 残した持ち越し(止めない)

- main の結線のテストがソースの文字列の照合(段 1 持ち越し 4)。
- ロールの引っ越しだけ失敗した起動は既定ロールのフォルダに記録(段 1 持ち越し 5、上の帯に警告は出る)。
- メイン画面の「配信を始める」が欄の保存の完了を待たない(即押しで稀にその場はつながらない)/ 欄にフォーカスしたままダイアログを閉じると保存されない可能性(人間ゲートで見る)/ `opening` での `/api/verbosity`・`/api/speak-start` の 409 の直接テストなし。

## 子の後始末

- 段 1 Review-Sylph `a2566e48c066cacc7`: 完了(final.md)
- 段 2 Gnome `aeb5b9dc42e75a3d8`: 完了(final-gnome.md)
- 段 3 Review-Sylph `ab6b66133893acf7e`: 完了(final-fixes.md)
