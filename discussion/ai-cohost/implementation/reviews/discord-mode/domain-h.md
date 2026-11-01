# Domain H レビュー — 判定と発火の記録・途中保存のタイマー(設計 §13.6・§13.7)(Review-Sylph 2026-11-01)

> 対象: ブランチ `ai-cohost/discord-mode`、土台 HEAD `cc36a33a`、コミットされていない作業ツリー(`git diff HEAD` と未追跡ファイル)。Gnome 報告 [../../waves/discord-mode/domain-h-gnome.md](../../waves/discord-mode/domain-h-gnome.md)。
> 読み取り専任。ソース・テストは直していない。コミットも、ブランチの切り替えもしていない。

## 判定: pass(ループ 1・止めた指摘 0)

計画 §4 の止めてよい 4 種(設計とのずれ / 今の配信が壊れる / 約束のテスト不足 / 守りの決まり違反)のどれにも、根拠を添えて言えるものは無かった。質問(Undine に上げる分岐)も無い。

## 1. 止めた指摘

なし。

## 2. 確かめたことと結果(依頼の 7 項目)

### 2-1. 3 つの type の欄(設計 §13.7)

- `judgmentUsageRecord` / `fireRefusedUsageRecord` / `controlUsageRecord` は**拾う欄を決めた純関数**(`session-usage-log.mjs`)。入力のオブジェクトを丸ごと載せる所は無い。
  - 語の欄(trigger・action・cause・reason)は `/^[a-z][a-z0-9-]{0,39}$/` に合わなければ null。選択肢と確率は 5 つの名前(wait/backchannel/respond/initiate/look)だけ。control は許す一覧(7 語)に無ければ null で書かない。数は有限の number だけ。
  - エラー文(`info.error`)は拾わない。種類は一覧(6 語)に無ければ `"unknown"`。
- 設計 §13.7 の欄(時刻 = `wallTimeMs` は append が付ける・trigger・choice/p/確率・action・エラーの種類 / きっかけの種類・断った理由 / つまみと VC の出来事)を満たす。足した `triggerSeq`(転写の seq の数)・`errorStatus`(HTTP の状態の数)・`latencyMs`・`vision` は中身でも id でもない数・真偽で、設計に反しない(裁量 3・4 の評価は下記)。
- テスト(`session-usage-log.test.mjs` +5 件)が、本文・名前・Discord の id(18 桁)・コメントの id・エラー文(`quota`・`credit_balance_exhausted`・`ENOTFOUND` 等)・VC の名前が `JSON.stringify` に出ないことを直接見ている。ほかの欄を渡しても拾わないこと、文が語の欄に来たら null に落ちることも固定。
- `SpeakNowJudgeError.kind`: 3 つ目の引数 `{kind, status}` を足しただけ。throw 7 か所に種類を付けた差分を 1 行ずつ読み、`message` と `latencyMs` の引数は 1 字も変わっていない。判定のふるまい(throw の場所・条件・順)も変わっていない。`speak-now-decisions.test.mjs` の新テストが 6 種の kind と message の完全一致(`認証失敗（403）`・`HTTP 429: quota [credit_balance_exhausted]` など)を固定し、旧来の作り方(kind なし)は null。`speak-now.mjs` の `onError` は kind/status を**持つときだけ**足す(無ければ今の形)。

### 2-2. 断りの拾い方・つまみ・I〜K の口

- `requestSelfFire` の `stream-not-open`、手動 Fire / Fire+視覚の場の外の断り(`refuseManualFireOutsideStream(res, {vision})`)、orchestrator の `accepted:false`(server の `hooks.onFire`、cockpit.mjs の onFire の包みが `hooks.onFire?.(info)` を呼ぶことを確認)の 3 か所が、同じ `reportFireRefused` を通る。
  - 重なりが起きない作り: 前 2 つは orchestrator に届く前に return する。3 つ目は orchestrator が断ったときだけ。自発の道で orchestrator が断ったケースを 1 回だけと固定するテストがある(`cockpit-server-discord-h.test.mjs` の 3 つ目)。
  - きっかけは `cause.type` の種類だけを渡し、コメントの id・seq は渡さない(`yt-123` が JSON に出ないことをテストで固定)。
- つまみ: `/api/self-fire`・`/api/barge-in`・`/api/kill` を受け付けたときに前後の真偽を `control` へ。400(形が違う)は書かないことをテストが固定。API の返事・snapshot は不変。
- I〜K の口: `USAGE_CONTROL_KINDS` に `vc-join`/`vc-leave`/`vc-move`/`vc-disconnect` を先に置き、server 内は `reportControl`、cockpit.mjs 側は `recordSessionUsage(controlUsageRecord(...))`。`not-in-vc` は reason の語として通る(テスト済み)。申し送り(Gnome §10)も実装と一致している。

### 2-3. 判定・発火のふるまい不変

- 追加はすべて「口を呼ぶだけ」。`reportFireRefused` / `reportControl` は try/catch で握る(`boom` を投げる口でも 409・発火・つまみ・busy の返事が今のまま動くテスト)。`recordSessionUsage` も try/catch、null は書かない。判定の記録は `reportSpeakNow` の中(元から try/catch)。
- API の応答の形・SSE・snapshot は不変。`reportSpeakNow` に足したのは `errorKind` / `errorStatus`(持っていれば)だけ。`formatSpeakNowLine` の呼び出しは同じ行のまま(`cockpit.test.mjs` の結線テストで、標準出力の 1 行を残して記録を 1 行足す形を固定)。
- 判定・発火の既存テストの期待値の変更は 0(下の §5)。

### 2-4. 途中保存(設計 §13.6)

- 式 `now − max(場の始まり, 前の保存, 前に頼んだ時刻) ≥ 20 分`(null は数えない・全部 null なら false)が `isMemoryCheckpointDue` と `checkpoint()` で実装されている。判定の順は 場が open → 転写が増えた → 20 分、で今の順を保つ。
- 張り方: main の `setInterval` は起動時の 1 か所のまま、間隔だけ 20 分 → 1 分(`MEMORY_CHECKPOINT_TICK_MS`)。`unref()` あり、止める所なし(結線テストが 1 か所・`clearInterval` なしを固定)。
- 起点が戻る条件: 場の始まり(`renewRecords`)で 3 起点を戻す。`noteSaved` を受けた時点の場の時計で `lastSavedAtMs` を更新(途中・手動・最後のどれでも)。前の場の遅れた最後の保存は、置き場の番号の守り(`noteSaved` の既存の分岐)が先に return するので新しい場の起点を汚さない(既存テストが通っている)。
- 「前に頼んだ時刻」を起点に含める裁量(Gnome 裁量 1)は、保存が失敗し続けたときに毎分頼み直さないための**頻度を増やさない側**の補強で、設計の式(場の始まり・前の保存から 20 分)の下限を壊さない。止めない。
- 配信の場にも効く: 体験の種類を見ない。テスト「配信の場でも Discord の場でも同じ」が本物の server で stream と discord の両方を通している。
- テスト: 入り直しの再現(4.6 分で開く・18.6 分で閉じる・18.65 分に入り直す → 20 分の当たり(入り直して約 1 分半)で走らない・38.65 分で走る)、毎分の当たりで 39・59 分、場の始まりから 20 分と以後 20 分おき、手動の保存で起点が戻る(15 分で手動 → 20 分は false・35 分で true)、保存が失敗し続けても 20・40・60 分、転写が増えない / 空 / 閉じた場 / 起動直後は頼まない、結線。依頼の「入り直して 1 分半で走らない・20 分で走る」を満たす。
- ②への頼みの文面: `deps.memoryRecorder.record(entries)` の呼び方は diff 上そのまま(途中か最後かの書きぶりに触れていない)。

### 2-5. 配信の固定テスト

- `git diff HEAD --stat -- apps/soul/agent/src/mind/fixtures` は空。`src/mind/` で差分があるのは `session-usage-log.mjs`・`speak-now-decisions.mjs`・`speak-now.mjs`(とそのテスト)だけで、②④の文面を持つファイルには触れていない。`stream-wording-pin.test.mjs` は全件 pass の中で pass。

### 2-6. session-usage を読む既存のもの

リポジトリ全体(`discussion/` を除く、`node_modules`・`.git`・`session-usage/` の実データを除外)を grep: 該当は `.gitignore`・`cockpit.mjs`・`cockpit-server.mjs`(コメントのみ)・`session-usage-log.mjs`・各テストだけで、**読むコードは無い**。知らない type で壊れる物は無い。新しい type を既存の行と同じ場のファイルへ混ぜて書けることはテストで確認(`wallTimeMs` が順に付く)。

### 2-7. 機械ゲート(自分で走らせた)

- `apps/soul/agent` で `node --test`: **tests 2199 / pass 2199 / fail 0 / cancelled 0 / skipped 0**(約 92 秒)。土台 2176 + 23 件で Gnome の報告と一致。
- リポジトリの根で `pnpm run check:soul-zone`: pass(1612 source files)。

## 3. 守りの決まりの確かめ(止めてよい 4 つ目)

違反なし。

- 鍵: 差分に `process.env` の代入・`.env*.local` を読む所は無い。
- 追加した記録の欄に、本文・名前・Discord の id・コメントの id・エラー文が入る道は無い(§2-1)。VC の名前・id を受ける欄そのものが無い。
- 新しいテストのサーバーは `createInMemorySettingsStore`(既定)・偽の耳 / orchestrator / スケジューラ。実データ・本物の Discord・LLM・外部 API に触れていない。テストが書く `session-usage` は、一時フォルダ(`withDir`)のみ。
- 依存・lockfile・`_conventions.md`・種のファイル: 差分なし。作業木の未追跡は新規テスト 1 つと Gnome 報告だけ(残骸なし)。

## 4. 止めない指摘(持ち越し)

1. **判定を呼ばない道は記録されない**(自発オフ・KILL・忙しい間・`skipAfterBusy` の捨て・窓が空)。Gnome 持ち越し 1 のとおり。silence 調査 §4 の「どの道か分かる」を完全にするには speak-now の中に口が要る。設計 §13.7 は `judgment` の行(判定したもの)を求めていて、判定しない道の記録までは求めていない。人間ゲート 3 で「黙った」の切り分けが足りなければ足す。
2. **KILL の自動解除(場の始まりの `killed = false`)は `control` に残らない**。設計は「つまみの切り替え(自発・かぶり判定・KILL)」で、API を通る切り替えは残る。場の始まりの戻しは操作ではなく `fire-refused` の `killed` の断りが並ぶので、読めば追える。
3. orchestrator の `fire()` が reject したときの `reason: "error"`、資源の用意の失敗(onFire を出さない)は `fire-refused` ではなく記録の外。断りではなく失敗なので設計の範囲外。
4. 場の外で書く行(場が開く前の断り・つまみ)は直前の場、またはまだ場が無ければ起動時刻のファイルに入る。起動時刻のファイルは、書くものがあったときだけ作られ、そのとき古いファイルの片付け(残す数)が走る。実害は残す数を 1 つ消費する程度。気になれば、場の外の行は書かない側にもできる。
5. `onSpeakNowJudgment` の中は「標準出力 → 記録」の順で、`formatSpeakNowLine` が throw すると記録まで届かない。`formatSpeakNowLine` は元から throw しない想定の純関数で、`reportSpeakNow` が try/catch。順序の好みの範囲。
6. `speak-now.mjs` の `onError` に足した `...(errorKind != null ? {…} : {})` と server 側の同じ形の重複は、読みやすさの好み。

## 5. 期待値を変えた既存テストの確認

`git diff HEAD -- '*.test.mjs'` で削除行(`^-`)を全部確認した。**削った・書き換えたアサーションは 0**。削除行はテスト 1 ファイルの import 1 行(`SHUTDOWN_MEMORY_TIMEOUT_MS` の末尾にカンマを付けて新しい import を足した形)だけ。

| ファイル | 変更 | 評価 |
|---|---|---|
| `scripts/cockpit-stream.test.mjs` | 既存 2 件に `v.advance(MEMORY_CHECKPOINT_INTERVAL_MS)` と「手動の保存から 20 分たっていない → false」の `assert` を**足した**(期待値 `true` の assert 自体は残る)。`makeVenue` に `advance(ms)` | 仕様変更(途中保存は経過時間で頼む・手動の保存で起点が戻る)に伴う範囲だけ。「場が閉じている間」のテストの趣旨(閉じている間は断る・開いている間は動く)は残り、2 つ目の場のテストの趣旨(前の場の `lastRecordedSeq` で飛ばされない)も残っている。範囲内。 |
| `scripts/cockpit.test.mjs` | 新しい export の import と新テスト 3 件を足しただけ | 既存の 20 分の定数のテスト(値不変)・閉じた後は動かないテストはそのまま pass |
| `session-usage-log.test.mjs` / `speak-now-decisions.test.mjs` / `speak-now.test.mjs` | 追加のみ | 判定・発火の既存の期待値は 0 変更。`cockpit-server.test.mjs` は無変更で pass(`:4952` 近くの deepEqual を含む) |

## 6. 裁量の評価

Gnome 報告 §7 の 1〜10 は、設計に反せず、止める根拠がない。

- 1(前に頼んだ時刻を起点に含める): 上記のとおり、頻度を増やさない側。失敗時の毎分の頼み直しを防ぐテストあり。可。
- 2(`noteSaved` を受けた時点の `nowImpl()` を起点にする): 場の時計で揃えるための実装上の選択で、本番では保存の終わり直後なので同じ時刻。可。
- 3・4(`triggerSeq`・`errorStatus`): 中身でも id でもない数。429 と 500 を見分ける目的は silence 調査 §1 の「どの道か分かる」に沿う。可。
- 5(つまみは受け付けるたびに 1 行、前後が同じ値でも): 操作の履歴として自然。可。
- 6(場の外の断り・つまみは直前の場のファイルへ): 場ごとのファイルの今の作りのまま。上の持ち越し 4。可。
- 7〜10: 可。

## 7. 質問(Orch-Sylph / Undine へ)

なし。設計に書いていない分岐で、判定・発火のふるまいを変えるものは無かった。
