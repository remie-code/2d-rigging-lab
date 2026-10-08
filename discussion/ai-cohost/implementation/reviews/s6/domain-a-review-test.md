# S6 Domain A レビュー（test レーン）

> レーン: **test**（テストの質・網羅・実行）。レビュアー: Review-Sylph。呼び出し元: Orch-Sylph（S6 Domain A 実行責任者）。
> 対象: `apps/soul/agent`（`node --test`）／声の器官刷新（`src/voice/audio-player.mjs` WinRT MediaPlayer 化・`src/voice/speak.mjs` playbackStartedAtMs）。日付: 2026-07-13。
> 読み取り専任・自分で再実行した生数字を根拠にする。install/commit は一切実行していない。
> 総合判定: **PASS**（blocking ゼロ・non-blocking 5 件はカバレッジの軽微な穴）。

## 0. 自分で再実行した `node --test` 生数字

`cd apps/soul/agent && node --test`（全テスト・1 回で緑・空/interrupted なし・再試行不要・ハングなし＝プロンプト正常復帰）:

```
1..425
# tests 425
# suites 0
# pass 425
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 1212.4235
```

domain-a.md §8 の claim（425/425/0、S5 前ベースライン 411→425 +14）と**完全一致**。skipped 0 / todo 0 のため緑の偽装なし。

個別ファイル実行（`node --test src/voice/audio-player.test.mjs src/voice/speak.test.mjs`）:

```
audio-player.test.mjs: tests 20 / pass 20 / fail 0
speak.test.mjs:        tests 5  / pass 5  / fail 0
（合算実行でも 25/25/0 を確認）
```

claim の内訳（audio-player.test.mjs 7→20 = +13／speak.test.mjs 4→5 = +1）と一致。20+5=25、411+14=425 で全体とも整合。

## 1. 決定論と無音（観点1） — **PASS**

- `audio-player.test.mjs` は PowerShell を一切呼ばず、`command: process.execPath, args: [fake-media-player.mjs]` で
  純 Node 子プロセスを注入している（自分でファイルを読んで確認）。`fake-media-player.mjs` は無音の疑似プロトコル
  応答器で、実オーディオ API・実マイクを一切呼ばない（`getUserMedia`/`Microphone` 等の grep もヒットゼロを確認済み）。
- PLAY/STOP 往復（L60–113）・isPlaying の STARTED→ENDED／STARTED→STOPPED 遷移（L115–142）・deviceName の env 受け渡し
  （L144–183、疑似プロセス側の `DEVICE\t<name>` 行と `spawnImpl` に渡る env の両方を検証）・
  `parseListDevicesStdout` の PS5.1 `ConvertTo-Json` の癖 5 種（複数配列/単一オブジェクト/空文字列・null/壊れJSON/
  id・name欠落、L203–237）・`listAudioDevices` の fake spawn 経由の成功/タイムアウト（L239–261）は全て fake 注入
  ベースで実マイク・実音・実時計・乱数への依存なし。
- `listAudioDevices` のタイムアウトテスト（L248–261）は `setTimeoutImpl` を同期発火させており実待機なし。
  `waitFor`/`collectUntil` は実プロセス（node 子プロセス、無音）の非同期往復を吸収するポーリングであり、
  タイムアウト上限 4000ms は「ハングしたら失敗させる」ためのガードであって実測待ちではない。
  実測 `duration_ms` 611ms（audio-player.test.mjs 単体・20本）が裏付け。

## 2. S1 無退行の固定（観点2） — **PASS**

- 「deviceName 未指定なら env に SOUL_AUDIO_DEVICE_NAME を足さない（既定デバイス＝S1 無退行）」
  （L173–183）が直接の回帰ガードとして存在。実装側 `audio-player.mjs` L223–226 の
  `options.deviceName ? {...} : baseEnv` 分岐と一致することを実装コードで確認。
- プロトコル変更（生パス→PLAY/STOP+状態応答）は domain-a.md §4 の記載通り、旧「生パス往復」4 本
  （play往復・複数play・改行除去・dispose後throw）の**期待値のみ**を新プロトコルへ更新したもので、
  検証対象の意味論（往復が成立すること・改行除去・dispose後throwすること）自体は変えていない。
  旧代役 `echo-player.mjs` は `cli.test.mjs` 用に無変更で温存されており（自分で `cli.test.mjs` の
  import を確認）、`fake-media-player.mjs` を新設して分離したという申告どおり。退行を隠す変更ではない。
- `git status --porcelain -- apps/soul/agent` を自分で実行し、変更は
  `src/voice/audio-player.mjs` / `audio-player.test.mjs` / `speak.mjs` / `speak.test.mjs`（M）と
  `scripts/preflight-voice.mjs` / `src/test-support/fake-media-player.mjs`（新規）のみと確認。
  `git diff --stat -- apps/runtime-player packages` と `git diff --stat -- pnpm-lock.yaml apps/soul/agent/package.json`
  はいずれも出力なし（器コード・lockfile・依存完全不変を自分で確認）。
- 呼び出し側（`fire-orchestrator`・`cli` 等）のテストは無変更のまま全通過（425 本の内訳に含まれる）。
  `player.play(wavPath)` の signature 不変・`speak()` 既存戻り値フィールド不変のため後方互換が壊れていない
  ことをテスト実行結果が裏付けている。

## 3. speak の後方互換（観点3） — **PASS**

- `speak.test.mjs` の既存 4 本（TTS→timeline→送出→accepted→play の順序／rejected→throw／timeline 512超→throw／
  実WSダブルでの配線）は自分で読んだ限り domain-a.md の申告通り無変更。
- 新規 1 本（L112–148）は `nowImpl: () => 987654` を注入し、`result.playbackStartedAtMs === 987654` を
  決定論的に固定。既存フィールド（wavPath/rttMs/wavDurationSec/timeline）も同一テスト内で再 assert しており
  「追加のみで既存を壊していない」ことを1本で両面確認している。`order[order.length-1] === "play"` で
  「play 呼び出し直後に時刻を記録する」という設計文書の記述（play 後に nowImpl 呼び出し）とも整合。
- `speak.mjs` L78（`const nowImpl = deps.nowImpl ?? Date.now;`）と L117（`player.play(wavPath)` の直後に
  `nowImpl()` 呼び出し）を実装コードで確認。テストの assert 順序と実装の呼び出し順序が一致している。

## 4. カバレッジの穴（観点4） — non-blocking 5件（列挙）

1. **ERROR 状態応答行が未検証**: `audio-player.mjs` の `isPlaying()` 判定は `MARK_ERROR` でも `playing=false` に
   落とす分岐がある（L242）が、`fake-media-player.mjs` は `ERROR` トリガに対応しておらず（grep で確認、
   PLAY/STOP/END の3種のみ実装）、node レベルのテストで ERROR 行到達後の `isPlaying()===false` を直接
   検証したテストは無い。PS 側の `ERROR\t<message>` 発火条件（Source 設定/再生の例外）は preflight でも
   意図的に踏んでいない（preflight は正常系のみ）。
2. **onError（stderr）コールバック経路が未検証**: `createAudioPlayer({ onError })` → `child.stderr` の
   `lineReader` 配線（L250–252、device-set/device-not-found/device-error 等の stderr 転送）を exercise する
   テストが無い。`fake-media-player.mjs` は stderr に一切書き込まない。
3. **`writeCommand` の "stdin is not writable" throw 分岐が未検証**: `child.stdin.destroyed===true` かつ
   `disposed===false` という中間状態（L258–260）を直接踏むテストは無い（dispose 後の throw は別分岐で
   テスト済み・L194–199）。
4. **`listAudioDevices` の `kind:"failed"`（非0終了+stdout空）が listAudioDevices レベルで未検証**:
   `parseListDevicesStdout` 単体の「壊れJSON→failed」テスト（L229–232）はあるが、`listAudioDevices()` 自身の
   L363–370（`result.code !== 0 && stdout空` → failed）を fake spawn 経由で踏むテストが無い
   （fake spawn テストは成功系とタイムアウト系の2本のみ、L239–261）。
5. **stop() の直後に play() が来る競合（STOP→即PLAY の順序）が未検証**: barge-in 後すぐ次発話、という
   Domain B 以降で使われうる経路の縦検証は本ドメインのスコープ外（fire-orchestrator結線はDomain B）だが、
   純部品レベルでも「STOP後にPLAYを送ってSTARTEDが正しく届く」確認は無い（複数play連続テストはSTOPを挟まない）。

いずれも wave-plan §4 の blocking 基準（実マイク混入・S1退行検知漏れ・ハング・生数字未実行転記）に抵触しない
分岐カバレッジの穴であり、動作の决定論性・S1無退行・speak後方互換という本レーンの主要な問いには影響しない。

## 5. preflight と機械テストの分離（観点5） — **PASS**

- `preflight-voice.mjs` 冒頭コメントに「機械テストではない」「実マイク音声・録音物は使わない」と明記
  （自分で読んで確認）。実装は `buildSineWav()` で 44100Hz/mono/16bit の合成サイン波（振幅≈8%、300ms/800ms）を
  自前生成し、`mkdtempSync(tmpdir())` 配下にのみ書き出す。実マイク入力（録音）や既存の録音ファイル読み込みは
  一切行っていない。
- 終了時 `finally` ブロックで `player?.dispose()` → `rmSync(dir, { recursive: true, force: true })` を実行し、
  合成 WAV を temp ディレクトリごと削除する後始末を確認（L148–161）。scratchpad 限定・残さない、の申告と一致。
- `preflight-voice.mjs` は `node --test` のテストファイル命名規則（`*.test.mjs`）に従っておらず、
  `node --test` 実行（自分で再実行した §0 の 425 本）には含まれていないことを確認（`scripts/` 配下で
  `.test.mjs` 拡張子でもない）。機械テストと preflight が実行経路として混同されていない。
- domain-a.md §5 の実測数字（STARTED 521ms・ENDED 333ms・列挙5件476ms 等）はこのレビューでは実機再実行して
  いない（Review-Sylph は実マイク不使用の規律のもと preflight を自分で再実行しない判断。preflight 自体の
  実行結果は Gnome の申告を信頼する範囲とし、コード読解でのみ「実マイク不使用・合成音のみ・後始末あり」を
  検証した）。§質問に記載。

## 総合判定

**PASS**（blocking ゼロ）。自分で実行した生数字 425/425/0（cancelled 0 / skipped 0 / todo 0、1回で緑・ハングなし）は
domain-a.md の claim と完全一致。個別ファイル実行（audio-player.test.mjs 20/20、speak.test.mjs 5/5）も内訳と一致。
決定論と無音（fake子プロセス・実マイク不使用・同期タイムアウト）、S1無退行（deviceName未指定の直接回帰テスト＋
git diff で器/lockfile不変確認）、speakの後方互換（既存4本不変・新規1本が注入clockで決定論固定）をいずれも
コードと実行結果で確認した。non-blocking 5件（ERROR行・onError/stderr経路・stdin非書込throw分岐・
listAudioDevicesのfailed kind・STOP直後PLAYの順序）はいずれも分岐カバレッジの穴であり、修正必須ではない。

## §質問（Orch への申し送り）

1. §4 の non-blocking 5件、特に **1（ERROR行）と2（onError/stderr経路）** は、Domain B が barge-in の
   「止めた」確定判定（wave-plan §3 Domain A §質問2: STOPPED 行到達を待つ設計にするか）や
   デバイス未検出時のフォールバック挙動（device-not-found の stderr 転送）に依存する可能性がある。
   Domain B/D でこれらの分岐を実際に使う設計になった場合は、その時点でテストを足すことを検討してほしい
   （今回のスコープでは blocking ではないと判断したが、將來の暗黙の退行余地として記録しておく）。
2. domain-a.md §5 の preflight 実測数字（521ms/333ms/476ms等）は本レビューでは実機再実行していない
   （test レーンは自分で `node --test` のみ再実行し、preflight は「実マイク不使用・合成音のみ・後始末あり」を
   コード読解で確認するに留めた）。preflight の実測値そのものの真正性確認が必要なら、別途 spec/design レーン
   または人間ゲートでの確認を依頼したい。
