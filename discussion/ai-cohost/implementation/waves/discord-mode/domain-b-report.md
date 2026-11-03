# Domain B — 場と体験の分離・ロールの一覧・声と目を場の共通の段へ・API と snapshot 完了報告

> Orch-Sylph → Undine(2026-10-31)。計画: [../../orchestration/discord-mode-wave-plan.md](../../orchestration/discord-mode-wave-plan.md) §1 Domain B。
> 判定: **pass**(ループ 1 回、止めた指摘 0 件)。Undine へ質問 2 つ(どちらも止める理由ではなく、合格とは独立に決めてよい。§11)。
> 実装: Gnome(opus)→ [domain-b-gnome.md](domain-b-gnome.md)。レビュー: Review-Sylph(sonnet)→ [../../reviews/discord-mode/domain-b.md](../../reviews/discord-mode/domain-b.md)。
> コミットはしていない(ブランチ `ai-cohost/discord-mode`、HEAD `cad2083a`)。鍵(`.env*.local`)・実データ(`cockpit-settings.local.json`・`memories/`・`roles/`)には誰も触れていない。操縦席は起動していない。依存・lockfile の変更なし。レビューの一時フォルダ(`apps/soul/agent/tmp/rv-b-mut`)は削除済み(`tmp/` は元からの 2 つだけ)。

## 1. 機械ゲート

| ゲート | 結果 |
|---|---|
| `apps/soul/agent` で `node --test` | **1966 pass / 0 fail / 0 skipped**(土台 1938 → +28: 耳の束 6・サーバ 18・cockpit.mjs 4)。Gnome とレビューの両方で実行 |
| 根で `pnpm run check:soul-zone` | pass(1576 files) |
| 依存・lockfile | 変更なし |
| 固定テスト `src/mind/stream-wording-pin.test.mjs` と fixture | 差分なし・通る。`src/mind/`・`skills/` の差分 0 |
| 本物の LLM・外部 API・Discord | 呼ばない |

## 2. 変えたファイル(`apps/soul/agent/` 起点)

- 変更(2 ファイル、+749 / −244): `src/cockpit/cockpit-server.mjs`(大半。旧 `startEars` / `stopEars` の本体を体験の口へ移した分)、`scripts/cockpit.mjs`(`createVenueRoleBundle` の export と `main()` の結線)。
- 新規(4 ファイル): `src/ears/ear-bundle.mjs`(`createEarBundle`)、`src/ears/ear-bundle.test.mjs`、`src/cockpit/cockpit-server-discord-b.test.mjs`、`scripts/cockpit-discord-b.test.mjs`。

## 3. 期待値を変えた既存テスト

- **0 件**。期待値を変えない直しも **0 件**(既存テストのファイルは 1 つも触っていない。レビューが `git diff` で確認)。
- 旧名のオプション(`onPrepareVoiceEngine`・`onEarsStarted`・`onEarsStopped`・`streamHooks`・`currentRoleIdentity`・`recallRunner`)を互換のため残し、束を渡さない呼び出しではそれらから束を 1 つ作る(`legacyRole`)ことで、既存の偽物を変えずに通した。

## 4. 場の段と体験の口の切り方(設計 §4.2 案 A・§4.3・§4.4)

- `openStream` / `closeStream` は 1 本のまま。`fail()`・try/finally・Ctrl+C(`endStreamForShutdown`)・サーバの `close()`・記憶の最後の保存は 1 か所に残る。
- **場の共通の段**(サーバ): ロールの一覧を固める・場の記録(ロールごと)・KILL / 判定 / 予定 / 思い出しの係・会話の正本・声の engine の用意と再生器(ロールごと)・目・頭のセッション(ロールごと)・器(ロールごと)・記憶の最後の保存(ロールごと)・正本を手放す・耳の束を畳む・場の状態と世代。
- **体験の口**(配信の口 `streamExperience` はサーバの中、Discord の口は `options.experiences.discord` で cockpit.mjs から渡せる。外からの口は `normalizeVenueExperience`(export)で揃え、`openEntrance`・`closeEntrance` は必須):
  - `kind`(`"stream"`)/ `prepareEntrance(request)`(入口の下見: マイク・方式の記憶・キー/モデルの確かめ)/ `abortEntrance(prepared)` / `openEntrance(plan, venue)`(耳の束を起こす)/ `closeEntrance({ hadEars, shutdown })` / `afterOpen()`(YouTube)/ `foldAfterOpen()` / `busyMessage(phase)` / C の置き場 `wording`・`teaching`・`judgeSet`(配信は null)。
  - 入口に渡す場の口 `venue`: `transcriptBuffer`(積む口)・`earTranscriptMouth({ engine })`(耳ごとの口)・`createEars()`(耳の束)・`onVadEvent`・`onDiagnostic`・`roles`。
- 開く順: 1 一覧と体験を固める → 2 場の記録 → 3 KILL OFF・判定等 → 4 正本 → 5 前半 **入口の下見** → 6 前半 声の engine の用意(正本が無ければここで開かない)→ 5 後半 **入口を開く** → 6 後半 再生器 → 7 目 → 8 頭のセッション → 9 器 → 10 **開いたあと**。
- 閉じる順: 写し → **開いたあとの片付け** → 判定・予定・思い出しの係 → 声を止める → 目 → 正本を手放す → 耳の束を畳む → **入口を閉じる** → 頭のセッション → 器 → 記憶の最後の保存 → 閉じる。
- 設計 §4.3 の番号と違う所が 2 つ(声の用意が入口を開く前、閉じるとき目が入口より先)。どちらも HEAD の配信の順そのもので既存テストが固定しており、設計本文の「配信では今の順を保つ」に沿う(§11 質問 1)。

## 5. 声と目を移しても配信のふるまいが変わらないことの確かめ方

- 新規 `cockpit-server-discord-b.test.mjs` が呼ばれる順を記録する偽物で固定: 配信の開く順(`renewRecords → 方式の記憶 → voice.prepare → 耳を作る → 耳を起こす → 再生器 → 目 → openSession → connectBody`)、閉じる順(`目 → 耳の dispose → closeSession → closeBody → saveFinal`、耳を畳む時点で正本は手放し済み、写しは畳む前)、声の engine を用意できないとき(耳を作らない・再生器/目を起こさない・器だけ畳む・tts down と理由)、キー切れが先なら声を用意しない、耳が起きないとき、頭のセッションが作れないとき(目 → 耳 → 頭 → 器の順で畳む)、`close()`。
- `scripts/cockpit-discord-b.test.mjs` が本物の `createStreamVenueHooks` + `createVenueRoleBundle` + 本物のサーバで並び全体を固定。
- 旧名で順を固定している既存テスト(`cockpit-stream.test.mjs` の始める/終える/Ctrl+C、`cockpit-server.test.mjs` の声の選択 6 件・撮る係 2 件、`cockpit-server-domain-e.test.mjs` 2 件、Domain A の「耳が無くても正本はある」)が期待値そのままで通る。
- **レビューの変異実験**(写しで 1 か所ずつ壊す): 閉じる段で入口と目を入れ替えると既存を含む 5 件、声の用意を入口のあとに回すと既存 11 件が落ちる。再生器と目を入れ替えると新規 2 件が落ちる。=テストは意味のある順序を見ている。
- 今と変わる所 3 つ(レビューが HEAD と比べ、配信で見える違い・壊れではないと確認): (1) 開く段の再生器と目の順が「目 → 再生器」から「再生器 → 目」(互いに待たない独立の起動)。(2) 閉じたときの「喋っている」を次の場へ持ち越さない(隙間の手動圧縮の判断だけに効く。良くなる向き)。(3) 開く途中で `close()` されたとき耳を開かない(HEAD は自前の正本で耳を開いて畳み残していた。良くなる向き)。

## 6. 耳の束の形

- `src/ears/ear-bundle.mjs` の `createEarBundle({ onVadEvent })`(export): `add(key, ear)`・`remove`・`drop`・`has`・`keys`・`size`・`vadMouth(key)`・`userSpeaking()`(どれか 1 本でも)・`start()`(起きない耳があれば束を空にして投げ直す)・`dispose()`(冪等)・`isDisposed`。
- サーバの `pipeline` は耳の束。使い道が寿命と `userSpeaking` だけであることを Gnome とレビューがそれぞれ確認。`userSpeaking` のサーバ変数は無くし束が持つ。喋り終わりの時刻は場が持つ。
- 配信ではマイクの耳 1 本が束の 1 本(key `"mic"`)。各耳に同じ正本と同じ耳ごとの口を渡すので N 重にならない(単体テストと、偽の Discord の口で耳 2 本の束のサーバテスト)。

## 7. ロールの一覧と束の形(設計 §5)

- サーバ: `options.roles`(配列か配列を返す関数)。要素 = `{ id?, identity?, hooks?, voice?: { prepare?, startResources? }, recall?: { run } }`。始める 1 で一覧ごと固め(`Object.freeze`)、閉じるまで同じ一覧。
- 束から引くもの: 名前(snapshot・whisper の手がかり・呼びかけの照合・判定に渡す名前・soul の行の話者)、場の口 6 つ(開く口は順に・最初の失敗で止める、畳む口と最後の保存は全部)、声の engine の用意と再生器、④。
- 場で共有(サーバに 1 つ): 正本・耳の束・KILL・自発の ON/OFF・かぶり・場の状態と世代・目・YouTube。**orchestrator・判定の部品・声の方式の値・口数・手動記録もサーバに 1 つのまま**(§11 質問 2)。
- cockpit.mjs: `createVenueRoleBundle(deps)`(export)で今のロールを包んだ束を 1 つ作り `roles: [venueRole]` で渡す。束の口は呼んだ時点の今のロールを読む。`main()` の工場の切り出しはしていない(設計 §5・§12.2 のとおり 2 つ目のロールのとき)。テストは `scripts/cockpit-discord-b.test.mjs` と、サーバ側の長さ 2 の一覧のテスト。

## 8. `experience` の出る所(設計 §4.5)

- `POST /api/stream/start`(と別名 `/api/ears/start`)の body の `experience`: 無い / null → `"stream"`。`"discord"` → Discord の口があればその口で開く、無ければ **503**(`DISCORD_EXPERIENCE_UNAVAILABLE_MESSAGE`、場は開かず `stream.error` にも残さない)。B の cockpit.mjs は Discord の口を渡さないので本番では常に 503。知らない値 → 400 `invalid experience`。内部 API `startStream({ experience })` も同じ。
- snapshot の `stream.experience` と `streamStatus().experience`: 開いている(開きかけ・閉じかけを含む)場の種類、閉じている間は null。語彙 `VENUE_EXPERIENCES`(export)。
- `/api/stream/*` の道の名前は替えていない。画面(`src/cockpit/ui/*`)は触っていない。

## 9. Domain A の持ち越しの扱い

- 切れ目: 正本を作る・手放すは場の共通の段。体験の入口には積む口と耳ごとの口(旧 `startEars` の `onTranscript` を `makeEarTranscriptMouth(engine)` に出したもの)を渡す。
- 正本の寿命: 手放すのを場の共通の段(閉じる段の入口を閉じる直前・`fail()`・`close()`)に寄せた。耳が束から抜けても正本は続く(Discord で人が抜けても続く)。手放す時点は配信では今と同じ(目を止めた直後・耳を畳む前)なので、`chatBufferAbsent` も A の裁量 2(閉じている間は正本が無い)も変えずに通る。
- null の防御: 開かない形。場の段が入口を開く直前に確かめ、配信の入口自身も確かめる(2 層)。
- `chatBufferAbsent` の文面 `ears not running …` は変えていない(持ち越し、G)。

## 10. 裁量(レビューが筋が通ると認めたもの。全 11 項目は domain-b-gnome.md §11 とレビューの「裁量」)

1. 声の engine の用意は入口を開く前(入口を下見と開くに分けた)。
2. 閉じる段で目は入口より先。
3. 開く段の中は「再生器 → 目」(設計の番号に合わせた)。
4. 目の口の新しい名 `onEyesStart` / `onEyesStop` を足し、旧名も同じ時に呼ぶ(旧名が先)。cockpit.mjs は新しい名だけ。
5. 束の深さ(orchestrator 等をサーバに 1 つのまま。orchestrator はロールの切り替えをまたいで KILL の状態を持ち越す今のふるまいがあるため)。
6. 長さ 2 以上の一覧の呼び方(備え。開く口は順に最初の失敗で止める、畳む口と保存は全部、名前・④は先頭)。
7. 正本の null は開かない形。
8. 体験の口の約束(`openEntrance`・`closeEntrance` 必須、`{ ok:false, reason }` だけが失敗、`afterOpen` が投げても開いたまま、外からの口に `busyMessage` が無ければ中立の文面)。
9. `experience` の値と断り方(閉じている間は null、口の無い Discord は 503、知らない値は 400)。
10. 耳の束の `userSpeaking` は場ごと(持ち越さない)。
11. 耳の束の置き場は `src/ears/`(D からも使える)。

## 11. 質問(Undine へ。どちらも止める理由ではない)

1. **設計 §4.3 の番号を実物の順に直してよいか**。実物と既存テストが固定する配信の順は、開くが「入口の下見 → 声の engine → 入口を開く → 再生器 → 目」、閉じるが「声を止める → 目 → 正本・耳の束 → 入口を閉じる」。設計本文は「配信では今の順を保つ」と書きながら番号の表(5 入口 → 6 声、閉じるは入口 → 目)と食い違う。直さないと D 以降が番号どおりに順を逆にしかねず、逆にすると配信の既存テストが落ちる(レビューの変異実験)。Gnome・レビュー・Orch-Sylph とも「直してよい」と見る。Discord でも「声を用意できなければ VC に入らない」「目を止めてから VC を抜ける」になり筋が通る。
2. **束の深さ**: orchestrator・判定の部品・声の方式の値・口数・手動記録をサーバに 1 つのまま残した深さで、設計 §5・§12.2(サーバが束から引く形まで)を満たしたとみなしてよいか。レビューの見立ては「満たしている」(サーバが直に読んでいた今のロール 1 つの口は全部束経由になった)。2 つ目のロールの前に束へ移すなら、Discord の群(D〜G は 1 ロール前提)ではなく「2 つ目のロール」を扱うドメインの最初に置くのがよい、とレビューは見る。Orch-Sylph も同意。

## 12. 持ち越し(次のドメインへ)

- **Domain C**(語の組・教え・判定の問いの置き場): 体験の口に予約した `wording`(②④の固定の指示と頼み・`skills/recall.md`・思い出しの結果を①に渡す文面の語の組)・`teaching`(①に足す体験の教え、配信は null = 足さない)・`judgeSet`(speak-now の問い・選択肢・入力の整形)。配信の口は 3 つとも null で、サーバはまだ読まない。C は「null のときは今の配信の文面」の形で差し口をつなぐ想定。体験の種類はサーバ内の `venueExperience.kind` と snapshot の `stream.experience` で読める。固定テストは `stream-wording-pin-calls.mjs` の呼び出しだけを合わせる(A の持ち越しのまま)。
- **Domain D**:
  - Discord の口を `src/discord/` で作り cockpit.mjs から `experiences: { discord }` で渡す(約束は `createCockpitServer` の `options.experiences` の JSDoc と §4・§10 の 8)。人ごとの耳は `venue.createEars()` の束に `add` / `drop`、各耳に `venue.transcriptBuffer` と `venue.earTranscriptMouth({ engine })`。
  - `openEntrance` が失敗したとき、場の段は `venue.createEars()` で作った束を知らない(配信は入口自身が畳む)。Discord の入口が自分で畳むか、段が最後に作った束を覚えるかを決める。
  - `closeEntrance` は `openEntrance` が呼ばれていなくても・二重でも呼ばれうる(HEAD の `stopEars` と同じ性格)。Discord の口は冪等に作る。
  - `prepareEntrance` が `voiceKind` を返さないと、声の用意は共有の `ttsEngine`(配信の準備の選択)を使う。Discord の声の方式の持ち方は D/E で決める。
  - Discord の耳の状態(snapshot の `ears`・health・`stt.engine`)、「切れた」の出し方、`stream.experience` と並べる接続の状態。開く途中の想定外の例外の文面「配信を始められない(想定外のエラー…)」は配信の語のまま。
- **2 つ目のロールのとき**: orchestrator・判定の部品・声の方式の値・口数・手動の「今日を記録」(`onMemoryRecord`)を束へ。`main()` の工場の切り出し。
- **Domain G**: `chatBufferAbsent` の文面 `ears not running`(今は「場が閉じている」の意味。直すなら期待値の変更)。画面は `stream.experience` を使う。
- 小さな点(止めない、レビューより): `streamStatus:() =>` の空白の欠け。開きかけ・閉じかけの間の `stream.experience` のテストが無い。「束から 1 本抜けても正本が続く」の直接のテストが無い(構造上は成り立つ)。配信の入口自身の正本の防御(2 層目)のテストが無い(到達しない)。`main()` の結線テストはソース照合の正規表現。

## 13. 起動した子

| 役 | モデル | agentId | 状態 |
|---|---|---|---|
| Gnome(実装) | opus | `ac24b24ccf8f8a34f` | 完了(報告 domain-b-gnome.md を回収、hand-back 受領) |
| Review-Sylph(レビュー 1 回目) | sonnet | `a028073904a93690f` | 完了(レポート reviews/discord-mode/domain-b.md を回収、hand-back 受領) |

生き残りの子は無い。
