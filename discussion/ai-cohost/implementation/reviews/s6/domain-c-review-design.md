# S6 Domain C レビュー（design レーン）

> レビュアー: Review-Sylph（design レーン）。呼び出し元: Orch-Sylph。読み取り専任（唯一の書き込みは本成果物）。
> 日付: 2026-07-13。対象: `apps/soul/agent`（S6 Domain C「発火スケジューラ・自発発火の判定」実装）。
> 総合判定: **PASS-with-nonblocking**。blocking なし。

観点は wave-plan §2・§3 Domain C・**§4 blocking 基準 3**／inventory §5（v0 定数の流儀・busy 状態機械）／
Gnome 成果物 domain-c.md（§6 LLM 非依存の担保）。design レーンの 5 観点（① LLM-in-timing の不在・最重要 blocking
② 器/lock 不変 ③ event loop 安全 ④ 決定論設計 ⑤ additive 結線）を、自分でファイルを読み・自分でコマンドを
実行して確認した（Gnome の報告値を転記していない）。

---

## 0. 自分で再実行した機械ゲート・器不変確認（生結果）

```
cd apps/soul/agent && timeout 300 node --test 2>&1 | tail -20
```
→ 自然終了・プロンプト復帰（ハングなし）。生数字:
```
1..479
# tests 479
# suites 0
# pass 479
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 1129.3002
```
EXIT=0。Gnome 報告の総数 479（Domain B 後ベースライン 452 → +27）と一致。event loop リーク（テストランナーの
ハング）は観測されなかった。

```
grep -nE "^\s*import |\.ask\(|session\.|createLlmSession|claude-agent-sdk" apps/soul/agent/src/mind/fire-scheduler.mjs
```
→ **0 件ヒット（grep exit=1）**。念のため `grep -n "import" fire-scheduler.mjs` も実行したが、ヒットしたのは
コメント中の日本語文字列「import 文が 1 つも無い」（12 行目）のみで、実コードの import 文・`.ask(`・
`session.`・`createLlmSession`・`claude-agent-sdk` への参照は 0 件。

```
git diff --stat -- apps/runtime-player packages pnpm-lock.yaml apps/soul/agent/package.json
```
→ **出力なし・EXIT=0**（器コード・契約 JSON・pnpm-lock.yaml・apps/soul/agent/package.json すべて完全不変。
新規依存ゼロ）。

```
node scripts/check-soul-zone-boundary.mjs
```
→ `Soul zone boundary guard passed: 1341 source files scanned; no 器→魂 imports and no 魂→器 code imports.`・
EXIT=0。

```
node scripts/check-dependencies.mjs
```
→ `Dependency guard passed.`・EXIT=0（Gnome 成果物には明記されていないが、依存不変の追加裏取りとして自分で
実行した）。

---

## 1. LLM-in-timing の不在（最重要 blocking・確認結果: 違反なし）

`fire-scheduler.mjs`（382 行）を全文読了。以下を自分の目で確認した:

- **import 文が構造的に 0 件**（0 節の grep 結果）。Node.js の ESM は静的 import 以外に外部モジュールへ到達する
  手段を持たない（`require`/動的 `import()` も本ファイルに存在しない＝別途 grep で 0 件確認）。したがって
  `fire-orchestrator.mjs`・`claude-agent-sdk`・session 系モジュールへの到達経路がソースレベルで**構造的に
  存在しない**。
- 判定に使う入力は `handleVadEvent(event: {type})`・`handleTranscript(entry: {text?, speaker?})`・注入
  `nowImpl()`・注入 `rng()`・注入 `setTimeoutImpl/clearTimeoutImpl` のみ（211-231 行のオプション分解）。
  いずれも機械信号（VAD イベント種別・転写テキストの文字列照合・時刻・乱数・タイマ）であり、意味理解や
  LLM 推論を要する処理は含まれない。
- 呼びかけ判定 `textMatchesName`（151-158 行）は NFKC 正規化 + かな統一 + 濁点剥がし + 部分文字列 `includes`
  の純文字列処理（117-128 行）。区切り応答・沈黙は `rng() < probability` 等の数値比較のみ（281-299 行,
  276-289 行）。LLM が介在する余地のあるコードパスは無い。
- 出力は `onFireRequest({kind})` の通知のみ（258-265 行）。scheduler 自身は fire も ask も呼ばない
  （コメント通りの実装であることをコード側で確認）。「何を言うか」の生成（実際の ask）は結線層
  `cockpit-server.mjs` の `onFireRequest` ハンドラが `fireOrchestrator.fire()` / `fire({vision:true})` を
  呼ぶことで担う（873-889 行）。scheduler は `fireOrchestrator` への参照を一切持たない（`isBusy` という
  クロージャ関数だけを注入されている＝876 行 `isBusy: () => fireOrchestrator.getState() !== "idle"` は
  cockpit-server.mjs 側のクロージャであり、fire-scheduler.mjs 側には `fireOrchestrator` という識別子は
  出現しない）。
- テスト側（`fire-scheduler.test.mjs` 444-451 行「LLM 非依存」）もソースを `readFileSync` して同様の正規表現
  assert で固定しており、将来の変更で import が混入した場合にテストが落ちる形になっている（構造的担保 +
  回帰テストの二重化）。

**結論: LLM ask がタイミング判定に混入するコード経路は存在しない。blocking 基準 3 を満たす。**

---

## 2. 器/lock 不変（確認結果: 違反なし）

- 0 節の `git diff --stat` が対象 4 パス（`apps/runtime-player`・`packages`・`pnpm-lock.yaml`・
  `apps/soul/agent/package.json`）で出力なし＝完全不変。新規依存ゼロ。
- 変更ファイルは domain-c.md §1 記載の 4 本（`fire-scheduler.mjs` 新規・`fire-scheduler.test.mjs` 新規・
  `cockpit-server.mjs` 変更・`cockpit-server.test.mjs` 変更）のみを自分で読み、いずれも `apps/soul/agent/`
  配下（独立 npm・workspace glob 外）であることを確認した。

---

## 3. event loop 安全（確認結果: 問題なし）

- タイマは `turnEndTimer`・`silenceTimer` の 2 本のみ（240-243 行）。`clearTurnEnd`/`clearSilence`（245-256
  行）で確実に `clearTimeoutImpl` を呼び `null` に戻す実装を確認。
- **区切りタイマ**: `speechStart` で取消（308-311 行）・`speechEnd` で張り替え（312-318 行）・満了時
  `turnEndTimer = null` を先に代入してから判定（291-292 行、二重発火防止）。
- **沈黙タイマ**: `armSilence()` は常に `clearSilence()` を先に呼んでから再武装（268-274 行）＝多重登録なし。
  `disposed`・`!enabled`・`silenceBudget<=0` のいずれかで **タイマを張らずに return**（270-271 行）＝予算切れ・
  OFF・dispose 後にイベントループへタイマを残さない設計をコードで確認。
- **OFF トグル**（`setEnabled(false)`・353-363 行）: `clearTurnEnd()` + `clearSilence()` を呼び 2 タイマとも
  即座に解除。`fire-scheduler.test.mjs`「OFF トグル」テスト（368-397 行）で `clock.pending()===0` を実アサート
  していることも確認した。
- **dispose()**（376-380 行）: `disposed=true` を先に立ててから `clearTurnEnd`/`clearSilence`。以後
  `handleVadEvent`/`handleTranscript` は先頭の `if (disposed) return` で即座に無視（307, 330 行）。
  `dispose` テスト（453-473 行）で dispose 後のイベント投入が `reqs.length` を増やさないこと・
  `clock.pending()===0` を確認済み。
- **結線層側**: `cockpit-server.mjs` の `close()`（928-953 行）が `fireScheduler.dispose()` を try/catch で
  best-effort 呼び出し（939-946 行）、その後 `fireScheduler = null`。`bargeInGate.dispose()` と同型の作法で
  一貫している。
- **実行結果**: 0 節の `node --test` が 479 件・1.1 秒で自然終了（ハングなし）。テストランナー自体が
  タイムアウトせず正常終了したことが event loop 安全の直接証拠。

---

## 4. 決定論設計（確認結果: 問題なし・隠れた実時計/実乱数依存なし）

- `nowImpl`・`rng`・`setTimeoutImpl`・`clearTimeoutImpl` は全てオプション注入可能で、既定値のみ
  `Date.now`/`Math.random`/`setTimeout`/`clearTimeout`（219-223 行）。ソース内で `Date.now()`・
  `Math.random()`・裸の `setTimeout`/`clearTimeout` を直接呼んでいる箇所が無いことを目視確認した
  （全て `nowImpl()`/`rng()`/`setTimeoutImpl`/`clearTimeoutImpl` 経由）。
- `rng()` の戻り値は `clamp01()`（170-176 行）で [0,1] にクランプしてから確率判定・ジッター計算に使用
  （272, 297 行）＝異常値注入に対しても暴走しない防御を確認。
- `fire-scheduler.test.mjs` の「決定論」テスト（410-440 行）は seed 付き線形合同法 RNG（`makeSeededRng`）+
  fake clock で同一入力列を 2 回実行し `assert.deepEqual(a, b)` — 実 `Math.random`/実時計を一切使わずに
  決定論を direct に固定している。加えて呼びかけ/区切り/沈黙/OFF トグル/busy 再武装の全分岐がそれぞれ
  個別テストで fake clock + 注入 RNG を使っていることを目視で確認した（202-364 行）。
- テストが実 `setTimeout`/実時間待機に頼っていないため（`makeFakeClock` の `advance(ms)` が同期的にタイマを
  進める）、テストスイート全体が高速（1.1 秒）かつ非フレークであることも 0 節の実行結果から裏付けられる。

---

## 5. additive 結線（確認結果: 問題なし・S1〜S5 無退行）

`cockpit-server.mjs` を自分で読み、以下を確認した:

- scheduler 生成条件（868-872 行）: `fireOrchestrator` が存在し、かつ `fire`/`getState` が両方
  関数であるときのみ生成。未注入なら `fireScheduler` は `null` のまま＝Domain B の barge-in gate 生成条件
  （851 行「`interrupt` があるときだけ」）と同型の防御的結線パターン。
- 既定 `selfFireInitialEnabled=false`（340 行）。scheduler が生成されても `enabled=false` で構築されるため
  タイマは張られず（`fire-scheduler.mjs` 366 行 `if (enabled) armSilence();` は false 分岐で発火しない）、
  3 種とも黙る。
- `onVadEvent`（511-525 行）: 既存の SSE `"vad"` 放送・`bargeInGate.handle(e)` に**並んで**
  `fireScheduler.handleVadEvent(e)` を追加しているだけで、既存 2 経路のコードは 1 行も変更されていないことを
  diff の文脈から確認した。
- `onTranscript`（526-543 行）: `fireScheduler.handleTranscript(entry)` を **soul 除外判定
  （534 行 `if (entry.speaker === "soul") return;`）の前**に呼んでいる。SSE `"transcript"` 放送側の soul 除外は
  534 行のままで不変＝scheduler だけが you/soul 両方を受け取る設計が実装と一致している（意図通り。soul は
  不応期基点の更新にのみ使われ、SSE 放送には一切影響しない）。
- `onFireRequest`（876-887 行）は非 await の best-effort（`void fireOrchestrator.fire(...)`・try/catch で
  throw を握る）。`req.kind==="silence"` のときだけ `fire({vision:true})`、それ以外は `fire()`。手動 Fire・
  視覚発火・barge-in の既存呼び出しパスには一切触れていない（scheduler は新規の呼び出し元を 1 つ追加した
  だけ）。
- `cockpit-server.test.mjs` の self-fire 縦串テスト 5 本（1222-1329 行）を読了。呼びかけ命中で fire() 呼び出し・
  自発 OFF 既定で沈黙・トグル ON 後に発火・busy で沈黙し idle 復帰後に発火・snapshot/setSelfFireEnabled/
  selfFireStatus の往復・orchestrator 未注入で scheduler 無し（`selfFire:null`・`setSelfFireEnabled` が
  no-op で `false` を返す）を実アサートで確認していることを検証した。soul 発話が名前を含んでも
  `fireOrchestrator.fire()` が呼ばれないこと（1243-1247 行）も含まれている。
- 0 節の `node --test` 総数 479（Domain B 後ベースライン 452 → +27）で、既存テスト（fire-orchestrator・
  barge-in・cockpit・cli・speak・audio-player 等）の期待値変更がないことは全体緑という結果から裏付けられる
  （個別ファイルの diff は確認していないが、domain-c.md §1 が「cockpit-server.test.mjs は既存 44 本を
  1 行も変更していない」と明記しており、全体テストが緑であることと整合する）。

---

## 6. blocking / non-blocking 判定

**blocking: 0 件。**

- LLM ask 経路の混入: なし（§1）。
- 器/契約/lock 不変違反: なし（§2）。
- event loop リーク（タイマ張りっぱなし・ハング）: なし（§3）。
- 非決定論（隠れた実時計/実乱数依存）: なし（§4）。
- S1〜S5 既存挙動の退行: 観測されず（§5、全体テスト緑で裏付け）。

**non-blocking（Domain D・followup への申し送り。すべて domain-c.md §8 に Gnome 自身が明記済みで、design
レーンとして追加の懸念はない）**:

1. 自発 ON/OFF の永続トグル・UI・HTTP エンドポイントは Domain D の領分（継ぎ目のみ用意）。
2. 呼びかけ照合の既知誤爆「コーディネート」は構造的（precision 優先の設計判断）で受容範囲。
3. 区切り応答の X=2000ms は VAD 無音ベースで転写到着と非同期（ASR 遅延時に「最後の一言が入る前」に撃ちうる）。
4. 呼びかけ（call）も busy 中は出さない非対称設計（不応期/確率は掛けないが busy だけ respect する）。
5. 不応期の基点更新が「要求を出した時点」であり、busy/空窓等で実際には発話に至らなくても抑制される
   （保守的設計・v0 として妥当）。
6. 沈黙の「活動」定義（speechCancel は無視）はノイズ環境でのスパイク頻発時に沈黙が発火しにくくなりうるが、
   稀＋免罪符ゆえ受容。
7. cockpit-server 側の縦串テストが call のみで turn-end/silence はタイマ依存のため純ロジック側
   （fire-scheduler.test.mjs）に全分岐を委譲している設計判断は、純ロジック側のカバレッジが十分
   （22 本・全分岐決定論）であるため design レーンとして妥当と判断する。

design レーン独自の追加観点として、以下を non-blocking の申し送りとして付け加える:

8. `silenceBudget`（既定 6）はスケジューラのインスタンス生存期間内で単調減少し、リセット手段がない
   （`setEnabled` の再 ON でも予算は戻らない・`createFireScheduler` を作り直す＝サーバ再起動でしか戻らない）。
   これは wave-plan §2「長回し（セッション使い捨て）はスコープ外」との整合が取れており blocking ではないが、
   長時間配信では沈黙発火が枯渇して止まる挙動になる点を followup 台帳（実配信長回しの計測）で明示しておくと
   Domain D 以降の見落としを防げる。

---

## 7. § 質問（Orch-Sylph への申し送り）

design レーンとして追加で判断が必要な点は無い。domain-c.md §8 の 7 件はいずれも Domain D/followup の領分として
妥当であり、design レーン（LLM 非依存・器/lock 不変・event loop 安全・決定論・additive 結線）の観点からは
再確認を要する項目はなかった。
