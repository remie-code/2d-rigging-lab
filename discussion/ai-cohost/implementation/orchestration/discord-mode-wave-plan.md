# Discord モードの wave 計画(Undine 2026-10-31)

> Status: 着手(ユーザー 2026-10-31「開始していいよ / ドメインは君の方で順次起動して大丈夫」)。ブランチ `ai-cohost/discord-mode`。
> - Domain A 合格(1 ループ・止めた指摘 0・soul 1938/1938・soul-zone・期待値を変えた既存テスト 0。`chatBufferAbsent` も正本の寿命を「場が開いている間」にしたので変えずに通った)。報告 [../waves/discord-mode/domain-a-report.md](../waves/discord-mode/domain-a-report.md)。固定テスト `src/mind/stream-wording-pin.test.mjs`(36 件、HEAD の未変更のコードから採取)。Undine の追認: (1) ②④の整形に名前つき you の `you(名前):` を入れるのは **Domain C で行う**(②④を語の組に組み替える所と同じなので)。`memory.test.mjs:58-65` の「you に名前を付けない」の期待値 1 行は、設計 §3.2 による変更として C で認める(配信では you に名前が入らないので配信の文字列は変わらない。固定テストは変えない)。(2) `buildRecallAvoidInput` には名前を付けないままで可。(3) Gnome の裁量 9 つ(耳ごとの口から情報を引く・正本の寿命は場が開いている間・判定の入力は「配信者(名前)」など)は可。
> - Domain B 合格(1 ループ・止めた指摘 0・soul 1966/1966・soul-zone・期待値を変えた既存テスト 0・既存テストのファイルを 1 つも触らず)。報告 [../waves/discord-mode/domain-b-report.md](../waves/discord-mode/domain-b-report.md)。Undine の追認: (1) 設計 §4.3 の開く・閉じるの番号を実物の順に直す(注記を足した。D 以降はこの順に入口を差す)。(2) 束の深さは設計 §5・§12.2 を満たすとみなす。orchestrator・判定の部品・声の方式・口数をサーバに 1 つ残すのは可(KILL の持ち越しのため)。束へ移すのは 2 つ目のロールを扱うときの最初に置く。(3) 体験の口の `wording` / `teaching` / `judgeSet` の置き場(配信は null)を C がつなぐ。D の持ち越し(入口の失敗時に束を誰が畳むか・`closeEntrance` の冪等・耳の状態と「切れた」)は D で決める。
> - Domain C 合格(1 ループ・止めた指摘 0・soul 2011/2011・soul-zone・固定テストの fixture 3 本は差分 0・期待値を変えた既存テストは追認どおり `memory.test.mjs` の 1 行だけ)。報告 [../waves/discord-mode/domain-c-report.md](../waves/discord-mode/domain-c-report.md)。レビューが HEAD と今で配信の場面 111 項目の一致を確かめた。Undine の追認: (1) `memory.test.mjs:58` 付近のテストの題名と `venue-wording.mjs` の頭のコメントのテストのファイル名のずれは、F の Gnome がついでに直す(Undine はソースを触らない)。(2) ①と会話指示の編集画面の「配信の道」「体験の道」の 2 本はこのままで可(設計 §3.4 の①の側を満たす。1 本にするのは既存の照合テストの期待値を変えるので今はしない)。(3) ②の語の組を「保存を頼んだ時点」で取るのは計画の意図どおり(場の間の 20 分ごと・手動の保存もその場の語で書くため)。思い出しの「避けるか」の差し口は F で足す。
> - **人間ゲート 1 合格**(ユーザー 2026-11-01): ブランチの版(`5725f905`)で配信の流れを試し、全部大丈夫そうだった。YouTube のコメントへの反応だけは、コメントを用意する手間のためスキップ(未確認のまま。人間ゲート 2 のあとの配信で見る)。手順 [../waves/discord-mode/human-gate-1.md](../waves/discord-mode/human-gate-1.md)。Discord の群(D〜G)へ進む。
> - Domain D 合格(1 ループ・止めた指摘 0・soul 2050/2050・soul-zone・期待値を変えた既存テスト 0・既存テストのファイルを触らず)。報告 [../waves/discord-mode/domain-d-report.md](../waves/discord-mode/domain-d-report.md)。Undine の追認: (1) ElevenLabs の耳で 400ms 未満の発話が転写に回りうる件は、関所を足さず人間ゲート 2 で見てから決める。(2) 形の合わない `discordBotKeyFile` を既定の鍵で読む所は、設計 §5(「断る」)に合わせて **E で入口で断る形に直す**(1 ロールの今は害が無いが、黙って別の Bot でログインする道を残さない)。(3) ログイン中に `closeEntrance` が呼ばれると Bot が destroy されない件は E で直す。(4) D の間は声が VC に出ず手元から鳴る(E で直る)。G への持ち越し: Discord の場の目の選択、`STREAMER_LABEL`、`chatBufferAbsent` の文面、接続の状態の見せ方。
> - Domain E 合格(1 ループ・止めた指摘 0・soul 2099/2099・soul-zone・期待値を変えた既存テスト 0・`src/voice/`・`src/mind/` の差分 0)。報告 [../waves/discord-mode/domain-e-report.md](../waves/discord-mode/domain-e-report.md)。D からの直し 2 つ(合わない鍵のファイル名は入口で断る・ログイン中に閉じたら Bot を destroy)は済み。Undine の追認: (1) 一覧の読み込み(catalog)も合わない鍵のファイル名なら断る形に **G の最初で直す**。D の結線テストの正規表現の期待値 1 か所の変更は仕様変更として認める。(2) 途切れの合計が約 700ms を超えると ENDED の見張りで打ち切られる件、(3) `startedDelayMs` を設定の口にするか、はどちらも人間ゲート 2 で見てから決める。(4) 合わない `discordBotKeyFile` を操縦席がロールを書き戻すときに `""` に置き換える形は**認めない**(ユーザーが手で書いた値を黙って消すため)。書き戻しでは元の値をそのまま残し、使うときに断る形に **G で直す**。出口を作れなければ場を開かずに断る裁量は可。
> - Domain F 合格(1 ループ・止めた指摘 0・soul 2127/2127・soul-zone・固定テストの fixture 差分 0・配信の期待値の変更 0。Discord の口が null でなくなった・判定の組に `recallAvoid` が増えたことによる Discord 側の既存テスト 5 行の変更は仕様変更として可)。報告 [../waves/discord-mode/domain-f-report.md](../waves/discord-mode/domain-f-report.md)。通話の語の組・Discord の判定の問い・`skills/venue-discord.md` の文面は報告にある(言い回しは人間ゲート 2 で見る)。Undine の追認: (1) speak-now の固定を体験の種類 `"discord"` で決める形は可。(2) Discord の場の間の YouTube の Connect(`POST /api/chat/connect`)は **G で断る形にし、画面でも出さない**(Discord の場にはコメントが無い、設計 §4.3 の表)。コメント反応を Discord の場で判定しない守りのテストも G で付ける。G への持ち越し: 話し始めのメーターが `speakStartFixed` を見る、方式を選ばせない、catalog の断り、ロールの書き戻しで鍵のファイル名を残す、`STREAMER_LABEL`、`chatBufferAbsent` の文面、Discord の場の目の選択、接続の状態の見せ方。
> - Domain G 合格(1 ループ・止めた指摘 0・soul 2173/2173・soul-zone・`src/mind/`・`skills/`・`src/voice/` の差分 0)。報告 [../waves/discord-mode/domain-g-report.md](../waves/discord-mode/domain-g-report.md)。期待値の変更は、追認していた 2 つ(catalog の断りの結線・鍵のファイル名の書き戻し)、「Discord の準備」タブを足したことによるタブの数と並び、`chatBufferAbsent` の文面(`venue not open`)で、いずれも仕様変更。配信の画面はレビューが HEAD と 1666 通りの入力で比べ、違いは `chatBufferAbsent` のラベルだけ。Undine の追認: (1) **場が閉じている間に Connect した YouTube のコメントが、Discord の場で会話の記録に積まれる隙間**は、案 a(Discord の場の間はコメントの入口で捨てる。ユーザーの Connect は切らない)で直す。設計 §4.3(Discord にはコメントが無い)と計画 §5(配信と通話の記録が混ざらない)に沿う、製品判断の要らない直しなので、全体の突き合わせの直しと一緒に入れる。(2) 「配信の途中はマイク・文字起こしを替えられない」の案内が Discord の場でも同じ文面なのは可(Discord の場では配信の準備のタブを触る理由が薄い。言い回しは人間ゲート 2 で気になれば直す)。(3) D・E のテストに見る窓を選ぶ下準備の 1 行を足した形は可。
> - 全体の突き合わせ needs_fix → 直して合格。止める指摘は既知の隙間(Discord の場で先に Connect した YouTube のコメントが正本に積まれる)の 1 件だけで、ほかのつなぎ目(場の切り替え・記録の分離・正本と人ごとの耳・鍵・ログ・配信の文字列・期待値の変更の一覧)は問題なし。レビュー [../reviews/discord-mode/final.md](../reviews/discord-mode/final.md)。直しは Gnome が `ingestChatMessage` と `commitComment` に「Discord の場の間は捨てる(何も出さない・Connect は切らない)」を入れ、テスト 3 件(soul 2176/2176・soul-zone)。報告 [../waves/discord-mode/final-gnome.md](../waves/discord-mode/final-gnome.md)。突き合わせの見立てどおり 2 回目は要らない。Undine の追認: 捨てたコメントは何も出さない。人間ゲート 2 に「入り直してすぐ話す」を入れる。止めない指摘(whisper の口の番号の使い回し【推測】・話している途中に抜けたときの `speechEnd`・ENDED の見張りの限界・`startedDelayMs`・ElevenLabs の短い発話)は人間ゲート 2 で見てから決める。
> 根拠: 設計 [../../architecture/discord-mode.md](../../architecture/discord-mode.md)(Accepted)、決定 [../../discord-vc/scope.md](../../discord-vc/scope.md) §21〜§24、棚卸し [discord-mode-inventory.md](discord-mode-inventory.md)(触るファイル・重なり・テストの土台・§9 の問い)。
> 進め方(scope §24): 前例 [stream-restructure-wave-plan.md](stream-restructure-wave-plan.md) と同じ。1 本のブランチ、ドメインは**全部順に**、ドメインごとに Orch-Sylph が Gnome と Review-Sylph を回す。開発は今の作業フォルダのまま。**ドメインの途中では配信しない**(ユーザーが配信するときは声をかけてもらい、区切りのよい所で master のきれいな状態に戻す)。push は機能が完成してからまとめて(scope §23)。
> ドメインの記号は設計 §11 と違う(設計の B を B と C に分け、判定の差し口を C に前倒しした)。下の対応表を正とする。

## 0. 形

```
土台の群
  Domain A 会話の正本を場へ・話者の形(設計 §3.1〜3.3)。最初に配信の文字列の固定テストを今のコードから写し取る
    → Domain B 場と体験の分離・ロールの一覧・声と目を場の共通の段へ・API と snapshot の体験の種類(設計 §4・§5)
      → Domain C 言葉の差し口(設計 §3.4)と判定の差し口(設計 §8 の b)。配信の語の組を既定に
        → 人間ゲート 1: 配信が今まで通り回る
Discord の群
  Domain D Discord の入口(設計 §6、鍵の読み方・ロールの指し先・サーバーとチャンネルの一覧・Discord の準備の保存)
    → Domain E Discord の出口(設計 §7)
      → Domain F Discord の判定と言葉(設計 §8 の Discord の文面・speak-now の固定、§3.4 の通話の語の組・①の教え・_conventions の 1 行)
        → Domain G 画面(設計 §9)
          → 全体の突き合わせ(Sylph 1 回) → 人間ゲート 2: 試しのサーバーで話せる
```

| この計画 | 設計 §11 | 棚卸し §2 |
|---|---|---|
| A | A | A |
| B | B のうち §4・§5 | B の前半 |
| C | B のうち §3.4 の差し口 + E のうち §8 の差し口 | B の後半 + E の一部 |
| D | C | C |
| E | D | D |
| F | E(差し口を除く) | E |
| G | F | F |

- 各ドメインは前のドメインが合格して、Undine がブランチにコミットしてから始める。
- **実データ**(`apps/soul/agent/cockpit-settings.local.json`、`memories/`、`roles/`)には、ドメインの作業もテストも触れない。操縦席を実データで起動しない。触れるのは人間ゲートでユーザーが起動したときだけ。
- **鍵**(`apps/soul/agent/.env*.local`、とくに `.env.discord*.local`)は、どのエージェントも読まない・出さない・環境変数に入れない・貼らない。テストは鍵の読み込みを差し替える。
- サーバーやチャンネルの ID はコミットしない(`cockpit-settings.local.json` に保存)。声は保存しない。ログに文字起こしの本文・名前・Discord の id を出さない(設計 §10)。

## 1. ドメイン

### Domain A — 会話の正本を場へ・話者の形(設計 §3.1〜§3.3)

- **最初に**(コードを変える前に)、配信の文字列の固定テストを新規 1 本にまとめる(棚卸し §3.3 の a。置き場は `src/mind/` の下、名前は Gnome の裁量)。中身は HEAD(`84df62db`)の今のコードの出力を**文字列として書き写したもの**で、一字ずつ比べる。対象: ①への行(`formatFireInjection`・`formatFireInjectionSince`)、②の固定の指示と頼み(`WRITER_SYSTEM_PROMPT`・`formatTranscriptForDigest`・`buildWriterRequest`)、④の固定の指示と頼みと結果の文面(`RECALL_SYSTEM_PROMPT`・`formatRecentConversation`・`buildRecallRequest`・結果の関数群)、`skills/recall.md` の本文、判定の入力(`buildSpeakNowInput`・`buildSpeakNowInstructions`・`buildSpeakNowChoices`・`buildCommentReactInput`・`buildRecallAvoidInput`)。入力の転写は 1 つ決める(you / soul / 名前つき viewer / 名前の無い viewer / 窓の外の行 / 空白の名前)。長い本文は fixture にしてよい。**このテストはこのブランチの最後まで期待値を変えない。**
- 正本(transcript buffer)を、場が開くときに場が作る。耳には「積む口」を渡す。耳は外から渡されなければ今まで通り自分で作る(テストの互換)。サーバで正本を読む 15 か所を場の正本へ向ける。
- **`onAppend` の持ち主**(棚卸し §2.9-1): 場が正本に 1 回だけ張る形を推奨する(耳が N 本になっても N 重にならない)。遅延や `audioCtx` のような耳ごとの情報は、行に添えて渡すか、耳ごとの口から引く。どちらにするかは Gnome の裁量(報告に書く)。配信でのふるまい(放送・speak-now・遅延ログ・soul / viewer を放送しない除外)は変えない。
- 話者の形は設計 §3.2 の案 A: 種類は you / soul / viewer のまま、名前(you と soul にも許す)と `speakerId` を足す。soul の行にはロールの id と名前を載せる(案 a。orchestrator の `speaker: "soul"` の 6 か所)。整形は「名前があれば `you(名前): 本文`」。配信では you に名前を入れないので、出る文字列は今と同じ。**id は場の中の記録にだけ持ち、①②④・判定・ログ・放送には出さない。**
- `startMs` を耳をまたいで比べている所が無いかを確かめて報告する(設計 §12.3)。
- **期待値の変更を 1 件だけ認める**: `chatBufferAbsent`(「耳が無いと正本が無い」、`cockpit-server.test.mjs:1901` 付近)。設計 §3.1 による変更として一覧に載せる。これ以外に配信の期待値を変えた既存テストは 0。偽の耳(`makeFakePipeline`)の直しは、期待値を変えない形の直し(正本の受け取り方)なら認める。直した所は一覧にする。

### Domain B — 場と体験の分離・ロールの一覧・声と目を共通の段へ・API と snapshot(設計 §4・§5)

- 設計 §4.1〜§4.4: 場の関数を「共通の段」と「体験の口」(案 A)に分ける。配信は体験の 1 つとして今のふるまいをそのまま持つ。声の engine・再生器・目の起動を、耳の Start から場の共通の段へ移す。配信のふるまいが変わらないことをテストで確かめる(設計 §12.3)。
- 人ごとの耳の集合は、サーバからは **1 つの耳に見える束**として渡す(棚卸し §9-4。サーバの `pipeline` は寿命と `userSpeaking` にしか使われない)。B では配信の耳 1 本がそのまま束の 1 本になる形まで。
- 設計 §5: 場がロールの一覧を持つ(今は長さ 1)。ロールの束(そのロールだけの物)と共通の物を分ける。`main()` の中の結び合った変数を束にするときは、束を作る関数を export して個別にテストする(前例 `createRoleHooks`・`createStreamVenueHooks`、棚卸し §2.9-7)。
- API と snapshot に体験の種類(`experience`)を足す。値は `"stream"`(Discord は D 以降で `"discord"`)。`/api/stream/*` の道の名前は替えない(今の画面とテストを壊さないため。Discord の場の API を足すときに同じ関数を呼ぶ)。
- 配信の期待値を変えた既存テスト 0。A の固定テストが通る。

### Domain C — 言葉の差し口と判定の差し口(設計 §3.4、§8 の b)

- ②④の固定の指示と頼み、`skills/recall.md`、思い出しの結果を①に渡す文面を、「共通部分 + 語の組」の 1 本の組み立てにする(設計 §3.4 の a)。配信の語の組を既定にする。語の組の項目の切り方・`recall.md` の印の書き方は Gnome の裁量(報告に書く)。
- 語の組の対象外(棚卸し §2.9-5・6): `fire-orchestrator.mjs` の「未配信」、ロールの持ち物の「あなたは配信の相方です」、コメント系(`comment-react.mjs`・`comment-guard.mjs`)、`scripts/probe-decisions-*.mjs`。
- ①に体験ごとの短い教えを足す口を作る。配信では何も足さない(scope §23、設計 §12.1 の 2)。教えのファイルは `skills/` の下に体験ごとに置ける形(Discord の中身は F)。
- 判定の差し口: `createSpeakNowController` に問いの組み立て(問いの文・選択肢・入力の整形)を外から渡せる口を足す(設計 §8 の b)。渡さなければ今の配信の問い。`SPEAK_NOW_HOST_LABEL` のような語も差し口から差せるようにする(棚卸し §2.9-4)。
- 体験の種類は B の体験の口から渡る(②の保存は場を閉じる段、④と①は場の間)。
- **配信の文字列は一字も変えない**: A の固定テストが通り、`memory.test.mjs`・`recall.test.mjs`・`speak-now.test.mjs`・`comment-react.test.mjs`・`soul-skills.test.mjs`・`fire-injection.test.mjs` の配信の期待値を変えない。

### 人間ゲート 1(ユーザー)

- C の合格のあと、Undine が手順を `implementation/waves/discord-mode/human-gate-1.md` に書く。ユーザーがブランチの版で配信(か試しの配信)をして、今まで通り回るかを見る。
- 合格したら Discord の群へ進む。ブランチは master にマージしない(ゲート 2 のあとにまとめて)。ゲート 1 のあとの配信も、ブランチの版で行うか master に戻すかはユーザーに聞く。

### Domain D — Discord の入口(設計 §6、§5 の鍵とロールの指し先、§9 の保存)

- 鍵の読み方: `src/discord/` の下に鍵を読むモジュールを作る(棚卸し §6。試しの仕掛けと同じく、ファイルを読み、`process.env` に入れず、エラーの文面から伏せる)。ロールの `role.json` の鍵のファイル名(既定 `.env.discord.local`)を指す。**画面での編集は作らない**(最初の的は 1 ロール。`role.json` を手で書く。棚卸し §9-6)。
- Discord の接続: Bot のログイン、サーバーとチャンネルの一覧を読み込む部品と API(棚卸し §9-5 により D に置く。画面は G)。VC に入る・抜ける(操作者の操作だけ。Bot が自分で抜けることはしない)。`joinVoiceChannel` の `group` はロールの id。1 つの Bot は 1 サーバーで 1 つの VC。
- 人ごとの音 → 耳: 人ごとの Opus を 16kHz モノラルにデコードし、人ごとに 1 本の耳。束(B)にまとめてサーバへ渡す。話者は you + Discord の名前 + ユーザー id(A の形)。
- ほぼ無音の発言の除き方(設計 §6.4: 3 バイトのフレーム → Silero → 最短の長さ)。頭欠けは受け入れる(§6.5)。
- 文字起こしの方式は Discord の準備として配信と別に持つ(設計 §12.2 の推奨)。
- 入れなければ場を開かずに理由を出す。途中で切れたら場は閉じず「切れた」を出す(設計 §4.3・§6.1)。
- Discord の準備(サーバー・チャンネル・文字起こしの方式)を `cockpit-settings.local.json` に保存する。
- 偽の Discord: `src/test-support/` に discord.js / @discordjs/voice の口を束で差し替える偽物を作る(棚卸し §4.2)。テストは本物の Discord・LLM・外部 API を呼ばない。

### Domain E — Discord の出口(設計 §7)

- Discord 向けの再生器 `{open, write, end, stop, onEvent}`。48kHz ステレオへの変換。`maxMissedFrames` を上げて途切れで Idle になる落とし穴を避ける。割り込みの「どこまで声に出たか」は `started` の時刻 + 決まった遅れ(設計 §7.4 の a)。
- 運び手の ENDED / STARTED の見張りに引っかからないかを、偽物で確かめられる範囲で確かめ、確かめられない所はゲート 2 の確認に回す(設計 §12.3)。
- 配信の再生器のふるまいは変えない。

### Domain F — Discord の判定と言葉(設計 §8、§3.4)

- C の判定の差し口に Discord の問い(「誰かが話したあと、今しゃべるか」)を差す。Discord では speak-now に固定(「従来」は選べない)。自発の発火の予定は作らない。名前を呼ばれたかで器が決めることはしない(判定が文脈で見る)。
- C の言葉の差し口に通話の語の組を差す(「配信」→「通話」。設計 §3.4 の表は案。最後の言い回しは人間ゲート 2 で見る)。Discord の②④の頼みにだけ「決まりの『配信』は通話にも当てはめる」の 1 行を足す(scope §23)。`_conventions.md` と種のファイルは変えない。
- ①の Discord の教え(`skills/venue-discord.md` など。名前は Gnome の裁量)。配信では読まない。
- snapshot: Discord の場では方式が speak-now に固定であることが読める値を返す(項目名は F の報告に書き、G が使う)。

### Domain G — 画面(設計 §9)

- 場を開くときに体験を選ぶ(起動時には選ばない。ロールの編集は体験の外の共通の場所のまま。scope §21)。Discord の準備(サーバーとチャンネルを一覧から選ぶ・文字起こしの方式)。VC に入る / 抜ける。接続の状態(入れない理由・切れた)。
- 会話の行のあなたの名前を Discord の名前で出す(`glance-timeline.mjs` の `STREAMER_LABEL` を体験で替える。棚卸し §2.9-3)。
- Discord の場では話し始めの方式を選ばせない(F の snapshot の値を使う)。
- 配信の画面のふるまいは変えない。画面のテストの固定(タブの数など)を変えるなら仕様変更として一覧にする。

### ドメインの間の申し送り

- 各ドメインの Orch-Sylph は、前のドメインの完了報告とレビューの「持ち越し」を読んでから始める。次のドメインの範囲に入る持ち越しは次で扱う。
- 新しいテストはドメインごとの新規ファイルに置いてよい(大きい `cockpit-server.test.mjs` への追記の衝突を避ける前例)。

## 2. 依存と順

- A → B: B の場の段は A の場の正本を使う。
- B → C: C の体験ごとの語の組・教えは B の体験の口から渡る。どちらも `scripts/cockpit.mjs` を触る。
- C → ゲート 1: 配信の文面に触る組み替えは、ここまでに済ませ、配信の固定テストとゲート 1 に守らせる。
- D → E: E は D の接続(VC の connection)を使う。
- E → F: F の判定の確かめは D・E の偽物の場で行う。
- F → G: G は F の snapshot(方式の固定)と D の接続の状態を使う。
- F と G は並べられる(棚卸し §2.8)が、順にする(作業フォルダを共有するため・接点を F の報告で決めてから G を作るため)。

## 3. モデル配分

| 役 | モデル | 数 |
|---|---|---|
| Orch-Sylph | opus | ドメインごとに 1 |
| Gnome(実装・直し) | opus | Orch-Sylph が起こす |
| Review-Sylph | sonnet | ドメインごとに 1 レーン |
| 全体の突き合わせ(Sylph) | opus | 1 回 |

## 4. 見直しの粒度(前例と同じ)

**止めてよい指摘(直すまで次へ進まない)。根拠を必ず添える**(設計の節、決めごとの節、落ちたテストのどれか)。根拠を出せない指摘は止めない側に回す。

1. **設計とのずれ**: 設計 [discord-mode.md](../../architecture/discord-mode.md)、scope §21〜§24、この計画 §1 のどこに反するかを言える。
2. **今の配信が壊れる**: 既存テストが落ちる。配信の固定テストが落ちる。今までできていたことができなくなる。
3. **約束のテストが足りない**: §1 の各ドメインの本文にある作るもの・確かめることに、テストが付いていない。
4. **守りの決まり違反**: 鍵を読む・出す・環境変数に入れる。サーバーやチャンネルの ID をコミットする物に書く。文字起こしの本文・名前・Discord の id をログに出す。声を保存する。チャッピーの `_conventions.md`・種のファイル・②④の配信の文面が変わる。テストや作業で実データに触れる。

**止めない指摘(「持ち越し」に記録して先へ進む)**: 名前の付け方・書き方の好み・作り直しの案。根拠の無い端の場合。設計に無いことを Gnome が筋の通る形で決めた所(「裁量」として記録)。

**ループの決まり**: 2 回目以降の見直しは、前回の止めた指摘が直ったかと、直しで何かが壊れていないかだけ。直しのループは上限 3 回。収まらなければ設計の曖昧さとして Undine に上げる。設計に書いていない判断の分岐が出たら、ループの回数に関わらず止めて Undine に上げる。

**機械ゲート(各ドメインの合格の条件)**: `apps/soul/agent` で `node --test` が全件 pass(土台 1884 件)。リポジトリの根で `pnpm run check:soul-zone` が pass。依存と lockfile は変えない(要るなら escalate。discord.js 14.27.0・@discordjs/voice 0.19.2・opusscript 0.0.8 は入っている)。テストは本物の Discord・LLM・外部 API を呼ばない。

## 5. 全体の突き合わせ

- G の合格のあと、Sylph(opus)が 1 回だけ、ブランチの全体を設計と突き合わせる。つなぎ目(配信と Discord の場の切り替え・同じ日の配信と通話の記録が混ざらないこと・正本と人ごとの耳・鍵の扱い・ログに出ない物)を見る。止めてよい理由は §4 と同じ。

## 6. 人間ゲート 2(ユーザー、最後に 1 回)

設計 §11 の素描のとおり。試しのサーバーで: VC に入る → 話しかけて返事が声で返る(返すかは判定が決める)→ チャッピーが通話にいると分かっているか → 割り込むと止まる → KILL が効く → VC から抜けて記憶が「通話」の記録として書かれる → そのあと配信を始めて今まで通り回る。手順は突き合わせのあと Undine が `implementation/waves/discord-mode/human-gate-2.md` に書く。

## 7. 置き場

- ドメインの完了報告(Orch-Sylph が書く): `implementation/waves/discord-mode/domain-<a〜g>-report.md`
- ドメインのレビュー(Review-Sylph が書く): `implementation/reviews/discord-mode/domain-<a〜g>.md`
- 全体の突き合わせ: `implementation/reviews/discord-mode/final.md`
- 人間ゲート: `implementation/waves/discord-mode/human-gate-1.md`・`human-gate-2.md`
- コミット: ドメインが合格するごとに Undine がブランチへ feat を 1 つ。Gnome と Sylph はコミットしない。
