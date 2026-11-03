# 人間ゲート 2: 入り直して 1 分半後の記憶の書き出し（調査）

> 調査: Sylph（2026-11-01）。読むだけ（ソース・テスト・設定・記憶は変えていない）。記憶の本文・人の名前・Discord の id は書かない。
> 行番号はブランチ `ai-cohost/discord-mode` の HEAD（6bf7cd65）時点。

## 結論（先に）

- 12:20:46 のコミット 8b6c190 は **20 分ごとの保存（定期保存）のタイマー** が起こした。
- そのタイマーは **操縦席のプロセスが起きたときに 1 回だけ張る `setInterval`** で、場（venue）を開いても閉じても張り直さない・止めない。だから「場が開いてから 20 分」ではなく「**起動から 20 分ごと**」に当たり、当たった瞬間に場が開いていて転写が前の保存から増えていれば保存する。
- 今日のプロセスは **12:00:26 ごろ起動** した（発火の診断の `wallTimeMs − monotonicMs` から）。最初の当たりは 12:20:26 ごろ。1 回目の場（12:05:01〜12:19 ごろ）はその手前で閉じたので当たらず、2 回目の場（12:19:05 に開く）の 1 分 20 秒後に当たった。②が約 20 秒で書き終わって 12:20:46 にコミットした。
- Discord だけの不具合ではない。配信（YouTube）の場でも同じ。入り直しは、それが目に見えやすくしただけ。
- 記録が壊れる・抜ける不具合ではない（閉じたときに同じ本体を全体で書き直している）。ただし「20 分を超えたら途中の保存」という期待とはずれている。直すかどうかは決めてほしい（§4）。

## 1. 記憶の書き出しの引き金（全部）

②書き出し役は `writeStreamRecord`（`apps/soul/agent/src/mind/memory.mjs:333`）が走らせ、終わったら記憶のフォルダの git にコミットする。これを呼ぶのは保存の係 `createMemoryRecorder`（`apps/soul/agent/scripts/cockpit.mjs:792`）の `writeImpl`（`cockpit.mjs:3039-3075`）だけで、保存の係の `record()` を呼ぶ所はコード全体で次の 3 か所だけ（`memoryRecorder.record` / `.checkpoint()` / `commitMemoryChanges` を grep して確かめた）。

| # | 引き金 | 入口 | 条件 | 時刻の起点・リセット |
|---|---|---|---|---|
| ① | 20 分ごとの保存 | `cockpit.mjs:3105-3110`（`setInterval(() => streamVenue.checkpoint(), MEMORY_CHECKPOINT_INTERVAL_MS)`・`unref()`）→ `checkpoint()` `cockpit.mjs:1156-1162` → `record(entries)` `:1160` | 場が `"open"`（`isStreamOpen` `cockpit.mjs:3099`。opening / closing は false）かつ、ライブの転写の件数が `lastRecordedSeq` と違う（`shouldSkipMemoryCheckpoint` `cockpit.mjs:734`） | **起点はプロセスの起動（main() がこの行に来た時刻）。場を開く・閉じるでは張り直さない・止めない。** `clearInterval` はどこにも無い。場ごとにリセットされるのは `lastRecordedSeq = 0` / `lastRecordAtMs = null` だけ（`renewRecords` `cockpit.mjs:1103-1110`） |
| ② | 手動「今日を記録」 | `POST /api/memory-record`（`apps/soul/agent/src/cockpit/cockpit-server.mjs:3749-3770`）→ `onMemoryRecord`（`cockpit.mjs:3113`）→ `record()` | 場が `"open"` のときだけ（それ以外は 409）。件数が増えていなくても頼む（飛ばす判定を通らない） | 押した時刻 |
| ③ | 場を閉じる（「配信を終える」・Discord の「VC から抜ける」） | `closeStream`（`cockpit-server.mjs:2851-2905`）の段 3 `runRoleHooksAll("saveFinal", transcript)`（`:2871`、想定外の例外の道で 1 回だけ `:2891`）→ `saveFinal`（`cockpit.mjs:1144-1150`）→ `record(entries)` `:1147` | 写した転写の件数が `lastRecordedSeq` と違うときだけ頼み、走っている保存の終わりまで待つ（上限 90 秒 `SHUTDOWN_MEMORY_TIMEOUT_MS`） | 閉じた時刻。`POST /api/stream/stop`・`/api/ears/stop` は `handleStreamStop`（`cockpit-server.mjs:3085`）でここに入る |
| ④ | Ctrl+C | `createCockpitShutdown`（`cockpit.mjs:2360`・`:2378` で `server.endStream()`）→ `endStreamForShutdown`（`cockpit-server.mjs:2916-2924`）→ ③と同じ `closeStream` | 場が開いていれば③と同じ。閉じていれば頼まず、走っている保存だけ待つ（`waitForRunningSaves` `cockpit.mjs:1178-1181`） | Ctrl+C の時刻 |

補足:
- 1 つの引き金の中で②が書かずに答えたときだけ、同じ材料で 1 回やり直す（`memory.mjs:358-369`）。やり直しは同じ本体名に書くので、別の場の本体ができることはない。
- 保存の係は直列（走っている間に来た頼みは 1 件だけ待たせ、件数が減る差し替えはしない・`cockpit.mjs:869-891`）。
- 頼んだ時点の置き場（本体の名前 `-2` / `-3`）と語の組を取る（`placeNow` / `wordingNow`）。保存が遅れて終わっても前の場の数えは新しい場に入らない（`noteSaved` `cockpit.mjs:1168-1174`）。
- ④思い出し役（recall）は読み取り専用で、コミットも保存の係も呼ばない（`recallRunner` `cockpit.mjs:3121-3139` 付近）。
- Discord の体験の口（`afterOpen` / `foldAfterOpen`・`cockpit-server.mjs:262-267`）と `src/discord/` には、記憶の保存を呼ぶ所が無い（grep で 0 件）。
- 記録の大きさ・行数・recall の注入量で保存を起こす閾値は無い。件数の比較は「飛ばすかどうか」だけ。

## 2. 12:20:46 を起こしたのはどれか

### 2.1 時刻の裏付け

| 時刻（JST） | 出来事 | 根拠 |
|---|---|---|
| 12:00:26.17 | 操縦席のプロセス起動（`performance.timeOrigin`） | `fire-diagnostics/` に残る 5 ファイル（fireNo 84〜88）の 1 行目で `wallTimeMs − monotonicMs` がどれも 12:00:26.174〜.176。`monotonicMs` は `performance.now()`（`src/mind/fire-diagnostics.mjs:43`） |
| 12:05:01.555 | 1 回目の場の `renewRecords`（場の記録の作り直し） | `session-usage/2026-11-01T03-05-01-555Z.jsonl` の名前 |
| 12:19:01 | 1 回目の場を閉じた最後の保存のコミット d3958de（`-2.md` 30 行） | 記憶のフォルダの git |
| 12:19:05.307 | 2 回目の場の `renewRecords`（`lastRecordedSeq = 0`・本体名は `-3`） | `session-usage/2026-11-01T03-19-05-307Z.jsonl` の名前 |
| **12:20:26 + δ** | **20 分ごとのタイマーの最初の当たり**（δ = 起動から main() が `setInterval` の行に来るまで。数秒以内） | 起動 12:00:26 + 20 分。最初の当たりは張ってから 1 間隔後 |
| 12:20:46 | コミット 8b6c190（`-3.md` 9 行の新規・目次 2 つ） | 当たりから約 20 秒。②の所要時間として妥当（短い材料） |
| 12:33:38 | 2 回目の場を閉じた最後の保存のコミット 80d98e4（`-3.md` を 26 行足して書き直し） | ③ |

- 1 回目の場（12:05:01〜12:19 ごろ）の間に当たりは無い（当たりは 12:20:26 ごろ・12:40:26 ごろ…）。入り直さずに 1 回目の場を続けていたら、場を開いて 15 分 25 秒ほどで同じ当たりが 1 回目の場に来ていた。
- 2 回目の場では、開いて 1 分 20 秒ほどの時点で転写が 0 件ではない（`lastRecordedSeq` は場の始まりで 0）ので、飛ばされずに頼まれた。
- `-3.md` の中身が「入り直してからの 1 分半」だけなのは、①が頼んだ時点のライブの転写（新しい場の正本）を材料にしたから。②への頼み（`buildWriterRequest` `memory.mjs:197-232`）には「これは途中の保存で、場はまだ続く」という一文が無いので、②は材料を「その場の全部」と読んで書き終えたような書きぶりにした（§4 の 2 つ目の論点）。

### 2.2 疑われたほかの筋（どれも違う）

- **前の場の close が後から追いついた**: 違う。③は `closeStream` の段 3 で保存の終わりまで待ってから場を閉じる（`cockpit-server.mjs:2869-2871`・`saveFinal` の `waitBounded`）。d3958de は 12:19:01 で、2 回目の場を開く 12:19:05 より前に終わっている。しかも 8b6c190 が書いたのは新しい場の本体 `-3.md` と新しい場の転写で、前の場の置き場（`-2`）ではない。
- **入り直しの 2 重の書き出し**: 違う。開く段（`openStream` `cockpit-server.mjs:2739-2845`）は保存を頼まない。③は 1 回の閉じで 1 回（例外の道でも `finalSaveRequested` で 2 度頼まない）。②のやり直しも同じ本体名にしか書かない。
- **大きさ・行数の閾値 / recall の注入量**: そういう引き金はコードに無い。12:20:02 の recall は 44 秒前で、recall は保存を起こさない。時刻が近いのは偶然。
- **Discord だけの段（`afterOpen`・`foldAfterOpen`・口の閉じ方）**: 記憶に触れない（§1 の補足）。
- **手動「今日を記録」**: ユーザーに心当たりが無く、時刻が起動 + 20 分（+ ②の所要時間）にぴったり合うので、①と見るのが筋。手動を完全には否定できない（操縦席のログ `[cockpit] memory recorded` は残っておらず、どの引き金かを書く行も無い）が、①で説明が尽きる。

### 2.3 再現（偽物だけ・実データに触れない）

スクラッチの小さなスクリプトで、本物の `createStreamVenueHooks` に偽物の保存の係・置き場・時計を渡し、本番と同じ「起動時に張った 20 分ごとの当たり」を手で 1 回呼んだ。起動 +4.6 分〜+18.6 分を 1 回目の場、+18.65 分に 2 回目の場を開いて転写 5 件、+20 分の当たりで `checkpoint()` が `true`（保存を頼む）になった。今の動きどおり。あわせて `node --test scripts/cockpit-stream.test.mjs` は 33/33 合格（今のテストは「場が開いていて増えていれば頼む」までを固めていて、場の始まりからの経過は見ていない）。

## 3. 配信（YouTube）でも起きるか

起きる。`checkpoint()` が見るのは `streamStatus().phase === "open"` と件数だけで、体験の種類を見ない（`cockpit.mjs:1156-1162`・`:3099`）。どの場でも「最初の途中の保存」は、場を開いてから **0〜20 分のどこか**（起動時刻しだい）に来る。そのあとは 20 分ごと。

経緯: 配信間記憶を作った頃は「起動 1 回 = 配信 1 本」で、起動 ≒ 配信の始まりだったので「起動から 20 分」≒「配信の始まりから 20 分」だった（`discussion/ai-cohost/implementation/orchestration/stream-memory-wave-plan.md:31` の「チェックポイントタイマー(20 分・main() スコープ…)」）。配信の組み直し（stream-restructure）で 1 回の起動に場が何度も開くようになり、設計は「20 分ごとの保存と『今日を記録』は、場が開いている間だけ動く」（`discussion/ai-cohost/architecture/stream-restructure.md:76`）とだけ決め、タイマーの起点は決めていない。実装は「場が開いている間だけ」を `checkpoint()` の中の判定で満たし、タイマー自体は起動時のまま残った。Discord モードは同じ道を使っている。

## 4. 不具合か・意図した動きか

**判定: 記録を失う不具合ではない。ただし「20 分を超えたら途中で保存」という期待と、場を何度も開く今の作りの間の小さなずれ（設計が起点を決めていない所に残った、起動時のままのタイマー）。** 直すかどうかはユーザー / Undine の判断。

影響:
1. 場を開いた直後（今日は 1 分 20 秒）に②が 1 回走ることがある。Codex の使い捨てセッション 1 回分の無駄と、記憶の git に短い途中版のコミットが 1 つ増える。安全網としては弱まっていない（どの場でも 20 分以内に 1 回は保存される）。
2. 途中の保存の本体が「その場は終わった」ような書きぶりになりうる（②への頼みに途中かどうかが無い）。ふつうは閉じたときに全体で書き直されて消えるが、閉じる前にプロセスが落ちると途中版のまま残る。これは起点の問題とは別で、20 分の当たりがちゃんと 20 分後に来ても起きる。

### 直し方の案（決めていない）

- **案 A: タイマーを場ごとにする。** `createStreamVenueHooks` がタイマーを持ち、`renewRecords`（または開いたあと）で張り、`saveFinal` の頭（または `closeSession`）で止める。`setIntervalImpl` / `clearIntervalImpl` を deps で差し替えられるようにする。main() の `setInterval`（`cockpit.mjs:3105-3110`）は消す。場の始まりから 20 分・40 分…に揃う。
- **案 B: タイマーは起動時のままにして、判定に経過時間を足す。** 当たりの間隔を短く（例: 1 分）し、`checkpoint()` で「`now − max(場の始まり, この場の最後の保存)` が 20 分以上」のときだけ頼む。場の始まりの時刻は `renewRecords` の `startedAtMs` がすでにある。変更が `createStreamVenueHooks` の中に閉じ、`nowImpl` だけでテストできる。手動の保存のあとも 20 分数え直す、という副次の効き目もある。
- （影響 2 について・別の案）**②に途中か最後かを渡す**: 保存の係の `record()` に「最後の保存か」を足し、`writeImpl` → `writeStreamRecord` → `buildWriterRequest` に渡して、途中なら「場はまだ続いている。途中までの記録として書く」を一文足す。語の組の固定テスト（`src/mind/fixtures/stream-wording-pin-expected.mjs`）の期待値が変わるので、やるなら追認が要る。

どちらの案でも、今のテストのうち「場を開いてすぐ `checkpoint()` が true」を前提にしたもの（`scripts/cockpit-stream.test.mjs:859-880` の「開いている間は動く」・`:1146-1162` の「20 分ごとの保存も飛ばさない」）は、案 B なら時計を進める形に直す必要がある。案 A なら `checkpoint()` 自体を残せばそのまま通る。

### 再現するテストの形の案

- **案 B 向け（純粋・速い）**: `createStreamVenueHooks` に偽の `memoryRecorder`（頼みを配列に積むだけ）・偽の `memoryPlaces`・`nowImpl` を渡す。t=4.6 分で `renewRecords`→開く、t=18.6 分で閉じる（`saveFinal`・`noteSaved`）、t=18.65 分で 2 回目の `renewRecords`→開いて転写 5 件、t=20 分で `checkpoint()` → **今は true・直したら false**。t=38.65 分で true。手動保存のあとの数え直しも 1 本。
- **案 A 向け**: 偽の `setIntervalImpl` / `clearIntervalImpl`（張った・止めたを記録し、手で発火させる）を渡し、(1) `renewRecords` / 開いたときに 20 分で張る、(2) 閉じる（`saveFinal` か `closeSession`）で止める、(3) 前の場のタイマーの発火が次の場の保存を頼まない、(4) 本物の cockpit-server と組み合わせて（`cockpit-stream.test.mjs` の `makeVenue` / `startServer` の形）入り直した直後に発火させても頼まない、を固める。main() にタイマーが残っていないことは、`cockpit.test.mjs` の結線のテストの形で確かめる。

## 質問（Undine へ）

1. 期待する起点は「場の始まりから 20 分」でよいか（今は「起動から 20 分ごと、そのとき場が開いていれば」）。設計 `stream-restructure.md:76` はここを決めていない。
2. 直すなら今のブランチ（Discord モードの人間ゲート 2 の後始末）でやるか、配信にも効く別の小さな直しとして切り出すか。
3. 影響 2（途中の保存を②が「終わった」と書きうる）も一緒に扱うか。語の組の固定テストの期待値が変わる。

## 確かめたこと・使ったもの

- コード: `apps/soul/agent/scripts/cockpit.mjs`（`:135-137`・`:734`・`:792-893`・`:1074-1189`・`:3039-3113`）、`apps/soul/agent/src/cockpit/cockpit-server.mjs`（`:2739-2924`・`:3085`・`:3749-3770`）、`apps/soul/agent/src/mind/memory.mjs`（`:197-232`・`:333-370`）、`src/discord/`（記憶の呼び出しが無いこと）。
- 記録: 記憶のフォルダの git（コミットの時刻・ファイル・行数だけ）、`session-usage/` のファイル名、`fire-diagnostics/` の 1 行目の時刻（本文なし）。操縦席のプロセスはもう動いておらず、そのログは残っていない。
- テスト: `node --test scripts/cockpit-stream.test.mjs`（33/33）。再現のスクリプトはスクラッチに置いた（リポジトリには置いていない）。
