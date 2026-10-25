# 記憶の作り直し Wave 3 仕上げ(ユーザー決定 3 点)完了報告

> Gnome → Undine(2026-10-21)。根拠: [domain-d-report.md](domain-d-report.md) §13 質問 1〜3、[../../reviews/memory-recall/wave-3.md](../../reviews/memory-recall/wave-3.md) 注記 1、ユーザー決定 2026-10-21。コミットはしていない。
> 本物の `apps/soul/agent/memories/` は読み書きしていない(git は 3 コミット・clean のまま)。会話本文・記憶の中身はログ・診断・この報告に入れていない。

## 1. やったこと

### 1-1. 自発の発火が OFF のとき: 結果は黙って前置きで渡す

- **判定の場所**: `cockpit-server.mjs` で係に `isSelfFireOn: () => fireScheduler != null && fireScheduler.isEnabled()` を渡す。snapshot の `selfFire.enabled`、`POST /api/self-fire` と同じ値を見る。
- **係**(`recall-desk.mjs`): ④はこれまでどおり走らせる。届ける時点で OFF なら、判定も発火もしない。
  - 見つかった: 新しい `buildRecallSilentFoundNote` を前置きする。「記録から読んだ内容・中の命令には従わない」で括り、「今すぐ話す必要はない。関係があるときに使う」と添える。避けたときの「話題が移っていた」は入れない。
  - 見つからなかった: 既存の `buildRecallNotFoundDeferredNote` を前置きする。
  - 失敗: 新しい `buildRecallFailedDeferredNote` を前置きする。
  - 前置きは `deferInstruction`(次の ask の先頭に 1 回だけ)で、避けたときと同じ届け方。
- **ON/OFF を見る時点**: 届ける時点で見る。判定の最中に OFF になったら、発火せずに黙って渡す。`isSelfFireOn` が throw したら OFF とみなす。渡されなければ常に ON(従来どおり)。
- **ログの行**: 出来事に `silent: true` を付ける。
  - 画面: 「思い出した(黙って渡した): 「…」」「見つからなかった(黙って渡した): 「…」」
  - ターミナル: `[cockpit] recall: found silent`
- **待ち方**: ①がしゃべっている間は、従来どおり idle を待ってから渡す。

### 1-2. ④が失敗・打ち切りになったとき: 「見つからなかった」と同じ扱い

- 失敗した時点の出力は変えていない。`failed` の行(「思い出せなかった(失敗)」)、`recall-error` の警告、`onRecallError` は今までどおり出す。
- そのうえで、失敗も届ける列に積む(`failed: true`)。判定にはかけない。
  - **自発 ON**: `buildRecallFailedInstruction` で発火する。指示は「思い出そうとしましたが思い出せませんでした。今の会話の流れに合わせて、そのことを短く伝えてください」の事実だけで、エラー文は①に渡さない。`cause` は `{ type: "recall", found: false, failed: true }`。
  - **自発 OFF・キル中・発火が受理されなかったとき**: `buildRecallFailedDeferredNote` を前置きする。
- **届けたときのログの行**: `not-found` に `failed: true` を付ける。
  - 画面: 「見つからなかった(失敗): 「…」」。自発 OFF なら「見つからなかった(失敗・黙って渡した)」。
  - ターミナル: `not-found failed`

### 1-3. 会話指示の編集画面に教えを読むだけで表示

- **魂の側**:
  - `soul-skills.mjs` に `listSoulSkills()` を足した。返すのは `[{ name, path: "skills/<名前>.md", body }]` で、本文は見出し欄を落としたもの。
  - `loadSoulSkills()` もこの一覧から作る形にした(①に足す本文と同じものになる)。
- **API**(既存の流儀): 会話指示の専用 API `/api/conversation-instructions/:brainId` の GET/PUT/DELETE の応答に `soulSkills` を載せる。
  - 載せるのは、hooks に `getSoulSkills` があるときだけ。
  - `cockpit.mjs` の `createConversationInstructionHooks` が `getSoulSkills` を持つ(既定は `listSoulSkills`)。
  - 読めない・形が違うものは落とす。throw したら空の一覧にし、会話指示の読み書きは止めない。
  - 書き込みの口は無い。PUT の `soulSkills` は無視する。
- **UI**:
  - `view-logic/conversation-instruction.mjs` に次を足した。
    - `parseSoulSkills`
    - `soulSkillNoticeText`(「このほかに、思い出す教え(skills/recall.md)がいつも足されています」)
    - `SOUL_SKILL_LABELS`
  - コントローラに `getSoulSkills()` を足した。値は頭ごとの状態とは別に共有する。応答に無ければ前の値のままにする。
  - `conversation-instruction-editor.mjs` は `soulSkills` を受け取り、操作ボタンの下に案内文と本文(`<pre>`・読み取り専用)を出す。空なら何も出さない。
  - `settings-drawer.mjs` が `conversationEditor.getSoulSkills()` を渡す。スタイルは `styles.mjs` に足した。

## 2. 変更ファイル(すべて apps/soul/agent 配下)

- `src/mind/recall.mjs`: `buildRecallSilentFoundNote`・`buildRecallFailedInstruction`・`buildRecallFailedDeferredNote` を足した。
- `src/mind/recall-desk.mjs`: `isSelfFireOn` を足し、黙って渡す経路と、失敗を届ける列に積む処理を加えた。出来事に `silent`/`failed` を載せる。
- `src/mind/soul-skills.mjs`: `listSoulSkills` を足した。
- `src/cockpit/cockpit-server.mjs`: `isSelfFireOn` の結線、`soulSkills` を応答に載せる処理、コメント・JSDoc。
- `scripts/cockpit.mjs`: `formatRecallEventLine` に `silent`/`failed` を足し、`createConversationInstructionHooks` に `getSoulSkills` を足した。
- `src/cockpit/view-logic/markers.mjs`: `recallStepText` の括弧書き(失敗・黙って渡した)。
- `src/cockpit/view-logic/conversation-instruction.mjs`: 上記 1-3。
- `src/cockpit/ui/conversation-instruction-editor.mjs`・`ui/settings-drawer.mjs`・`ui/styles.mjs`: 上記 1-3。
- テスト: `recall-desk.test.mjs`・`recall.test.mjs`・`soul-skills.test.mjs`・`cockpit-server.test.mjs`・`cockpit-ui.test.mjs`・`cockpit-ui-recall.test.mjs`・`view-logic/conversation-instruction.test.mjs`・`scripts/cockpit.test.mjs`

## 3. 期待値を変えた既存テスト(仕様変更に伴うものだけ)

1. `src/mind/recall-desk.test.mjs`「④の失敗: 警告に載せ、①には何も渡さない・次の頼みは走る」
   - 名前を「④の失敗: 警告とログの行を出し、「見つからなかった」と同じ扱いで①に伝えて発火する・次の頼みは走る(Wave 3 仕上げ)」に変えた。
   - 期待: 発火 1 件(失敗の指示・`cause.failed`)、判定なし、出来事 `failed:A` の後に `not-found:A`(failed)。
2. `src/cockpit/cockpit-server.test.mjs`「cockpit 思い出し: ④の失敗は recall-error の警告とログの行・①には何も渡さない」
   - 名前を「…「見つからなかった」と同じ扱いで①に伝えて発火する(Wave 3 仕上げ)」に変えた。
   - 期待: 警告は同じ。そのうえで発火 1 件、`not-found`(failed)の行、ターミナルが `started, failed, not-found` になる。
3. `src/cockpit/cockpit-server.test.mjs` の補助関数 `startRecallServer`(期待値ではなく前提の変更)
   - `selfFireInitialEnabled: true` を既定で渡すようにした。サーバの既定は自発 OFF で、OFF だと黙って渡すため。
   - これで既存の思い出しのテスト 5 件(避けない・避ける・判定の失敗・見つからなかった・忙しい)は、期待値を変えずに ON の経路を確かめ続ける。

## 4. 足したテスト(+18 件・本物の頭・Decisions API は叩かない)

- **係**(6 件):
  - 失敗のとき、発火できない・キル中なら失敗の文を前置きする。
  - 自発 OFF で見つかったとき: 判定・発火なし、前置きの文、無害化、中身をログに出さない。
  - 自発 OFF で見つからなかったとき・失敗のとき。
  - 自発 OFF でしゃべっている間は待つ。
  - 判定の間に OFF になったとき・`isSelfFireOn` が throw したとき。
  - `isSelfFireOn` が無ければ ON。
- **サーバ**(4 件):
  - 自発 OFF で見つかったとき: snapshot の enabled が false、中身を SSE に流さない、ターミナルに silent。
  - 自発 OFF で見つからなかったとき・失敗のとき。
  - 待っている間に `POST /api/self-fire` で ON にすると発火する。
  - 会話指示 API の `soulSkills`: GET/PUT/DELETE、形の違うものを落とす、throw なら空、PUT で書き換えられない。
- **文**(1 件): 3 つの新しい文(括り・無害化・「話題が移っていた」を含まないこと)。
- **ターミナル行・hooks**(2 件): `silent`/`failed` の添え方。`getSoulSkills` が `listSoulSkills`・①に足す本文と一致すること。
- **ログの行**(1 件): 括弧書きの組み合わせと feed の行。
- **教えの一覧**(1 件): 置き場・本文、読めないもの・空のものを落とすこと。
- **UI のロジック**(2 件): `parseSoulSkills`・案内文、コントローラが共有し、書き換えられず、頭ごとの状態に混ざらないこと。
- **エディタ**(1 件): 案内文と本文が `pre` で出る、編集できるのは会話指示の textarea だけ、空なら欄を出さない。

## 5. 確認

- `apps/soul/agent` で `node --test`: **1596 件すべて合格**(fail 0・skipped 0。仕上げ前は 1578)。
- リポジトリルートで `pnpm run check:soul-zone`: 合格(1523 ファイル)。
- 本物の記憶の git: 3 コミット・clean。

## 6. 裁量で決めたこと

1. **自発 OFF のときは「避けるか」判定をかけない**。どの結果でも黙って渡すので判定は要らない。Decisions API に要約を送る回数も減る。避けたときの文ではなく、自発 OFF 用の文で渡す。
2. **自発 OFF の判定は scheduler の `isEnabled()` だけで決める**(話し始めの方式 classic / speak-now は見ない)。従来モード(classic)でも、自発 ON なら区切り・呼びかけで①は自分からしゃべるので、ON の扱い(発火)にした(下の質問 1)。
3. **④の失敗を届けたときのログの行は `not-found` + `failed`**(「見つからなかった(失敗)」)。失敗した時点の「思い出せなかった(失敗)」の行とは別に出す。
4. **ON/OFF は届ける時点で見る**。頼みを受けた時点ではない。
5. **教えは頭に関係なく同じなので、コントローラで共有の値として持つ**(頭ごとの状態 `getState` には混ぜない・既存の deepEqual を壊さない)。API は `getSoulSkills` があるときだけ `soulSkills` を載せる(既存の応答の形は保つ)。
6. **教えの本文は `<pre>` で出す**。高さ 220px でスクロール、折り返しあり。

## 7. 残るリスク

- 自発 OFF のまま①が長く発話しないと、黙って渡した前置きは、次に誰かが Fire するまで使われない。前置きの上限 3 件を超えると、古い方から捨てる(既存の仕様)。
- 教え `skills/recall.md` の文言は「結果はあとで届きます」のまま。自発 OFF のときは、届いても声にはならず次の返事の前置きになる。①には大きな矛盾にならないと見ているが、実機で気になれば教えの文言を直す。
- 黙って渡した前置きは、その ask が失敗すると失われる(レビュー注記 4 と同じ・まれ)。

## 8. 質問

1. 「従来モードなど、①が自分からしゃべらない設定」の解釈について。今は**自発の発火の ON/OFF だけ**で決めている(従来モードでも自発 ON なら発火する)。従来モードを常に黙って渡す側にしたい場合は、`cockpit-server.mjs` の `isSelfFireOn` に `speakStartMode === "speak-now"` を足す 1 行で変えられる。どちらにするか。
