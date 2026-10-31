# Domain C — 体なしの声 完了報告

> Orch-Sylph → Undine(2026-10-31)。計画: [../../orchestration/stream-restructure-wave-plan.md](../../orchestration/stream-restructure-wave-plan.md) §1 Domain C。
> 判定: **pass**(ループ 1 回。止めた指摘 0 件。Undine に上げる分岐 0 件)。コミットはしていない(ブランチ `ai-cohost/stream-restructure`、直前のコミット 15bf9570)。
> 実装: Gnome(opus)→ [domain-c-gnome.md](domain-c-gnome.md)。レビュー: Review-Sylph(sonnet)→ [../../reviews/stream-restructure/domain-c.md](../../reviews/stream-restructure/domain-c.md)。
> 実データ(`cockpit-settings.local.json`・`.bak*`・`memories/`・`roles/`)と鍵(`.env*.local`)には誰も触れていない(レビューは存在と更新日時だけを確認。`roles/` は作られていない)。操縦席は起動していない。

## 1. 機械ゲート

| ゲート | 結果 |
|---|---|
| `apps/soul/agent` で `node --test` | **1782 pass / 0 fail**(基準 1758 → +24)。Gnome とレビューの両方で実行 |
| 根で `pnpm run check:soul-zone` | pass(1560 files) |
| 依存・lockfile | 変更なし |
| 本物の LLM・外部 API | 呼ばない(偽の engine・再生器・器・頭だけ) |
| 判定の文面・②④の指示・種・`skills/expression.md` | 差分なし(レビューで確認) |

## 2. 変えたファイル(`apps/soul/agent/` 起点。新規ファイルなし。15 ファイル +826 / −45)

- `src/voice/speech-streamer.mjs`(候補 2): 器は任意。`channel` が無ければ `openSpeech`・`appendSpeech`・`endSpeech`・口の release を飛ばし、すぐ `player.open`。時間割は今どおり貯める。口の t=0 の約束のコメントを書き直し。
- `src/mind/fire-orchestrator.mjs`(候補 3): 受理の資源に `body`。体なしは `channel: null`。表情タグを剥がして捨てる(送らない・数えない・診断なし)。割り込み・キルの口閉じを送らず `…MouthCloseError` を出さない。遅延の通知に `bodyless: true`。
- `src/mind/soul-skills.mjs`(候補 6): `soulSkillNamesForBody`。体なしは `expression` を渡さない。
- `scripts/cockpit.mjs`(候補 4・URL の確かめ): `resolveFireChannel`・`CHANNEL_URL_NOT_SET_MESSAGE`。器の URL の確かめは体があるときだけ。`createSessionProxy` に `hasBody`(省けば今どおり断る)。URL の差し替え・セッションの教え・`channelStatus.body`・起動の案内・遅延の 1 行の ` body=none`。セッションを作ったときの体(`sessionBody`)と今の体が違えば次の Fire の境目で作り直す。
- `src/cockpit/view-logic/status.mjs`: 体なしなら器の状態を「体なし」。
- `src/mind/fire-latency.mjs`(説明のみ)・`src/mind/session-usage-log.mjs`・`src/cockpit/cockpit-server.mjs`: 体なしのときだけ遅延の記録に `bodyless: true`。
- テスト: `speech-streamer.test.mjs`・`fire-orchestrator.test.mjs`・`soul-skills.test.mjs`・`scripts/cockpit.test.mjs`・`cockpit-server.test.mjs`・`view-logic/status.test.mjs`・`session-usage-log.test.mjs`(追加のみ)。
- **期待値を変えた既存テスト: 0 件**(`createLazyChannel` は変えず、体なしでは器を渡さないだけ。体ありの断り・記録の形は不変)。

## 3. 約束のテスト(レビューで確認)

- 割り込みの「どこまで声に出たか」の体あり / 体なしの一致: 一括 `fire-orchestrator.test.mjs:4175`、文ごと `:4304`、運び手単体。同じ engine・時間割・STARTED 1000・割り込み 1350 で `body` だけを替えて比べる。
- 体なしで器なしに鳴る・表情タグを捨てて診断なし・`expression` を渡さない・URL なしで頭に聞ける / 受理できる(体ありは今どおり断る)・遅延の印・「体なし」の表示、すべてテストあり(対応表は domain-c-gnome.md §4、レビュー §4)。

## 4. 裁量(全 12 項目は domain-c-gnome.md §6。レビューはすべて筋が通ると評価)

- 体は持ち回らず、使う時点でいつも `roleHooks.current().body` から読む(`currentBody()`)。ロールを替えたあとに古い値は残らない。1 発の間は受理の時点の体を使う。
- 体なしでタグだけの返事は `fireEmptyReply` と数えず、`{ fired: false, reason: "expression-only", expressed: false }` で静かに畳む(レビュー: 設計の分岐ではなく裁量で足りる)。
- 未知タグ・壊れタグの診断は体なしでも今どおり出す(返事の形の知らせとして)。→ §6 質問 1。
- 遅延の印は体なしのときだけ付ける(体ありの形は変えない)。ターミナルの行は末尾に ` body=none`。
- 体なしの間は器の URL の差し替えをせず、metadata の `channelUrl`・`channelConnectionGeneration` は null。
- 起動の案内は体なしなら「ロール <id> は体なし — 器にはつながず手元の再生器だけで声を出します」の 1 行。体ありは今の文面のまま。

## 5. 持ち越し(止めない指摘)

- **Domain D へ**:
  - 「配信を始める」で器につなぐかは `resolveFireChannel` と同じく `roleHooks.current().body` を見る。体なしは何もしない。
  - 場の終わりの器の `close`: Gnome は「体ありのときだけでよい」とし、レビューは「体ありの Fire のあと体なしへ替えると接続が開いたまま残るので、体の有無に関わらず `close` する」とした。**Orch-Sylph はレビューの側(いつも close)を推す。**
  - `--channel` 起動の先充填と案内の文面のずれを、場の始まりへ寄せるときに見直す。
- **Domain E へ**: 器の URL 欄の出し分けは `state.channel.body`(または `state.role.body`)が使える。`.channel-status.bodyless` の色は未追加。ロールの編集で体だけを変えたときに `roleHooks.current()` が最新を返すか、編集 API が `sessionContextRevision` を進めるかを確かめる(体は `sessionBody` の違いでも作り直すので追加の配線は要らない見込み)。
- **仕上げ**: `scripts/cockpit.mjs` の HELP の `--channel` の説明と README の Channel の記述が体ありの話のまま。`main()` の結線テストがソース文字列の照合で書き換えに弱い(Domain B と同じ流儀)。
- **人間ゲート(計画 §6 の 4)**: runtime-player なしで声が出る / 割り込みで声に出た分が soul の行に正しく残る / 表情タグが声に出ず診断のゴースト行も出ない / 器の状態が「体なし」/ 遅延の行の末尾に `body=none` が付き「声」の区間が体ありより短い。体を替えた直後の最初の Fire でセッションが作り直される。

## 6. 質問(Undine へ。どれもループを止める分岐ではない)

1. 体なしでも未知タグ・壊れタグの診断(`expressionUnknownTag` / `expressionBrokenTag`)を出す形でよいか。設計 §4「表情のタグは剥がして捨てる(診断は出さない)」を「6 語の表情タグの適用の診断」と読んだ。「タグ由来の診断を全部黙る」と読むなら 1 行で直せる(レビューも任意の追認を求める)。
2. 体なしでタグだけの返事を `expression-only` として静かに畳む扱いでよいか(空の返事の診断を出さない)。
