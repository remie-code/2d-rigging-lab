# Domain H 完了報告 — 判定と発火の記録・途中保存のタイマー(Orch-Sylph 2026-11-01)

> 判定: **pass**(ループ 1 回・止めた指摘 0・Review-Sylph が合格・質問 0)。
> 計画: [../../orchestration/discord-mode-wave-plan.md](../../orchestration/discord-mode-wave-plan.md) §8 Domain H。設計: [../../../architecture/discord-mode.md](../../../architecture/discord-mode.md) §13.6・§13.7。
> 実装: Gnome(opus)→ [domain-h-gnome.md](domain-h-gnome.md)(欄の形・式・裁量 10 件・申し送りの詳細はこちら)。レビュー: Review-Sylph(sonnet)→ [../../reviews/discord-mode/domain-h.md](../../reviews/discord-mode/domain-h.md)。
> コミットはしていない(ブランチ `ai-cohost/discord-mode`、HEAD `cc36a33a`)。鍵(`.env*.local`)は誰も読んでいない。実データ(`cockpit-settings.local.json`・`memories/`・`roles/`・`session-usage/`・`fire-diagnostics/`)には触れていない。操縦席の起動・本物の外部 API の呼び出しなし。依存・lockfile の変更なし。

## 1. 機械ゲート

| ゲート | 結果 |
|---|---|
| `apps/soul/agent` で `node --test` | **2199 / 2199 pass**(2176 から +23)。Gnome とレビューの両方で実行 |
| 根で `pnpm run check:soul-zone` | pass(1612 files) |
| 固定テスト `stream-wording-pin` の fixture(`src/mind/fixtures/`) | 差分 0(レビューが確認)。②④の配信の文面のファイルは触っていない |
| `package.json`・`pnpm-lock.yaml` | 差分 0 |

## 2. 変更ファイル(`apps/soul/agent/` 起点)

- 実装: `src/mind/session-usage-log.mjs`(純関数 `judgmentUsageRecord`・`fireRefusedUsageRecord`・`controlUsageRecord`、一覧 `JUDGMENT_CHOICES`・`JUDGMENT_ERROR_KINDS`・`USAGE_CONTROL_KINDS`)、`src/mind/speak-now-decisions.mjs`(`SpeakNowJudgeError` に `kind`・`status`。`message` と throw の条件は不変)、`src/mind/speak-now.mjs`(種類を持つ失敗のときだけ `onError` に `errorKind`・`errorStatus`)、`src/cockpit/cockpit-server.mjs`(口 `options.onFireRefused`・`options.onControl`、失敗寛容の `reportFireRefused`・`reportControl`)、`scripts/cockpit.mjs`(`MEMORY_CHECKPOINT_TICK_MS` = 1 分・`isMemoryCheckpointDue`・経過時間で判定する `checkpoint()`・`recordSessionUsage`)。
- テストの新規: `src/cockpit/cockpit-server-discord-h.test.mjs`(6)。テストの追加: `session-usage-log.test.mjs` +5、`speak-now-decisions.test.mjs` +1、`speak-now.test.mjs` +1、`scripts/cockpit-stream.test.mjs` +7、`scripts/cockpit.test.mjs` +3。

## 3. 作ったもの(要点)

- `judgment`: `ok`・`trigger`・`triggerSeq`・`choice`・`p`・`probs`(5 択)・`action`・`latencyMs`・`errorKind`(no-key / network / auth / http / timeout / shape / unknown)・`errorStatus`。エラー文は書かない。標準出力の `formatSpeakNowLine` の行はそのまま。
- `fire-refused`: `cause`・`reason`・`vision`。`requestSelfFire` の stream-not-open(今まで無記録)・場の外の手動 Fire・orchestrator の `accepted:false` の 3 つを server の 1 本の口で拾い、2 重にならない(テストで固定)。
- `control`: `control`・`from`・`to`(真偽だけ)。自発・かぶり判定・KILL の API を受け付けたときに書く。一覧に無い名前は書かない。I〜K 用に `vc-join` / `vc-leave` / `vc-move` / `vc-disconnect` を先に置いた。
- 3 つとも頭の種類に関係なく書く。会話の中身・名前・Discord の id・コメントの id・VC の名前が JSON に載らないことをテストが直接確かめる。記録の失敗は判定・発火・API の応答を止めない(try/catch)。
- 途中保存: 起動時のタイマーは 1 分ごと。場が open・転写が増えている・`now − max(場の始まり, 前の保存〔途中・手動〕, 前に途中保存を頼んだ時刻) ≥ 20 分` のときだけ頼む。入り直して約 1 分半で走らない(midwrite §4 の再現: 18.65 分で入り直し、20 分で頼まず、38.65 分で頼む)・始まりから 20 分で走る・手動の保存で起点が戻る・配信と Discord の場で同じ、をテストで固定。②への頼みの文面は不変。
- session-usage を読むコードはリポジトリに無い(grep 0 件)ので、知らない type で壊れる物は無い。

## 4. 期待値を変えた既存テスト(仕様変更 = 途中保存は経過時間で頼む。レビューが diff と一致を確認)

| ファイル:行 | 変更 | 理由 |
|---|---|---|
| `scripts/cockpit-stream.test.mjs:881-884` | 「開いてすぐ `checkpoint()` が true」→ すぐは false の assert を足し、時計を 20 分進めてから true | 設計 §13.6 の起点(場の始まりから 20 分) |
| `scripts/cockpit-stream.test.mjs:1170-1172` | 時計を 20 分進める 1 行(と「手動の保存から 20 分たっていない」の assert)を挟んだ。期待値 `true` はそのまま | 同上 |
| `scripts/cockpit-stream.test.mjs` の `makeVenue` | 時計を進める `advance(ms)` を足した(挿入だけ) | テストの下準備 |

- 削った・書き換えたアサーションは 0(削除行は import の 1 行だけ)。`:1279` の結線の正規表現、`scripts/cockpit.test.mjs:1085-1100`・`:1141-1143` は変えずに通る。
- **判定・発火のふるまいのテストの期待値の変更は 0**(`cockpit-server.test.mjs:4952` の deepEqual も無変更で pass)。

## 5. 裁量(Gnome。レビューはどれも設計に反しないと評価。詳細は Gnome 報告 §7)

1. 途中保存の起点に「この場で最後に途中保存を頼んだ時刻」も含めた(保存が失敗し続けても毎分頼み直さず、今の 20 分おきを超えない)。手動は成り立った時刻でだけ起点を戻す。
2. `noteSaved` の `atMs` は保存が終わった時刻だった。起点には受けた時点の場の時計 `nowImpl()` を使う(本番では同じ時刻)。snapshot の `lastRecordAtMs` は今までどおり。
3. `judgment` に `triggerSeq`(数)、4. `errorStatus`(HTTP の状態の数)を載せた。
5. つまみの行は受け付けた API の呼び出しごとに 1 行(同じ値でも)。400・503 は書かない。
6. 場が閉じている間の手動 Fire の断り・つまみの行は直前の場のファイル(場を開く前なら起動時刻のファイル)に入る。開きかけの断りは新しい場のファイル。
7. `fire-refused` の `vision` は `vision:true` の発火だけ true。
8. 断りの拾い所は server の `onFire` に 1 本化(cockpit.mjs の `onFire` の包みは不変)。
9. 種類の語は英小文字・数字・`-` の 40 字まで。
10. `createStreamVenueHooks` に `deps.checkpointIntervalMs`(既定 20 分、差し替えの口だけ)。

## 6. 持ち越し(止めない)

- 判定を呼ばない道(自発オフ・KILL・忙しい間に数えただけ・相槌の後の `skipAfterBusy`・窓が空)は記録されない(silence 調査 §4 の 2。speak-now の中に口を足せばふるまいを変えずに残せる)。
- コメント反応の判定は記録していない(Discord では作らない)。
- `fire()` の reject(`reason:"error"`)・orchestrator の資源の用意の失敗は「断り」ではなく失敗として記録の外。
- 場の始まりの `killed = false` の自動解除は `control` に残らない。
- 場の外で書く行は起動時刻のファイルを作り、残す数(20)を 1 つ消費する。
- `onSpeakNowJudgment` の中は「標準出力 → 記録」の順で、`formatSpeakNowLine` が throw すると記録に届かない。
- `onError` に kind/status を足す書き方が speak-now.mjs と server で重複。
- 判定の窓の形(行数・指紋など、judge-wait 調査 §5)・発火の終わりの理由は範囲の外。

## 7. I〜K への申し送り(`control` / `fire-refused` の口)

- **server の中から**(VC の API・体験の口の知らせを受ける所): `reportControl({ control: "vc-join" })` / `"vc-leave"` / `"vc-move"` / `"vc-disconnect"` を呼ぶだけ。`from`・`to` は省く。VC の名前・Discord の id は渡さない(渡しても純関数が拾わない)。
- **cockpit.mjs の側から**(server を通らない知らせ): `recordSessionUsage(controlUsageRecord({ control: "vc-disconnect" }))`。
- 新しい名前(例: 動かされた・4014 を分けたい)は `src/mind/session-usage-log.mjs` の `USAGE_CONTROL_KINDS` に足し、`session-usage-log.test.mjs` の一覧の deepEqual を直す(一覧に無い名前は書かれない)。
- **I の `not-in-vc`**: `requestSelfFire` と `refuseManualFireOutsideStream` の近くで断るときに `reportFireRefused({ cause, reason: "not-in-vc", vision })`。orchestrator まで届いて断られた分は server の `onFire` で自動で拾われるので、2 度呼ばない。
- 途中保存の起点は体験の持ちもの(`renewRecords` = 場の始まり)。**VC の入る・抜ける・移るで `renewRecords` を呼ばない**(呼ぶと起点が戻る)。

## 8. 子エージェントの閉域

| 役 | agentId | 状態 |
|---|---|---|
| Gnome(opus) | `ad39104df81ff1e8b` | 完了(SubagentHandback で報告・成果物 `domain-h-gnome.md`) |
| Review-Sylph(sonnet) | `aea6c49c57bc271cd` | 完了(SubagentHandback で報告・成果物 `reviews/discord-mode/domain-h.md`) |

## 9. 質問

- なし。
