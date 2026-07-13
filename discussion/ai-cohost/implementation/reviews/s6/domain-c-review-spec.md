# S6 Domain C レビュー — spec レーン（設計契約への適合）

> Reviewer: Review-Sylph（spec レーン）。呼び出し元: Orch-Sylph。**読み取り専任**。
> 日付: 2026-07-13。根拠: 契約文書・対象ファイル・working tree の実物・自分で実行した `node --test` と
> `git diff --stat`（Gnome の説明ではなく）。
> 契約の正: [../../orchestration/s6-wave-plan.md](../../orchestration/s6-wave-plan.md) §1(人間ゲート②③④⑤)・
> §2・§3 Domain C・§4 blocking基準3 /
> [../../orchestration/s6-planning-inventory.md](../../orchestration/s6-planning-inventory.md) §1裁定4・
> §4-1・§4-2 /
> [../../waves/s6/domain-c.md](../../waves/s6/domain-c.md)（Claim）。
> 対象コミット状態: S6 Domain A+B+C は未コミット・working tree に存在。

## 総合判定: **PASS-with-nonblocking**

wave-plan §3 Domain C・§4 blocking基準3、inventory §1裁定4・§4-2 の要求はすべて満たす。逐条照合1〜5は
すべて PASS。domain-c.md §8 の7件の§質問はいずれも契約違反ではなく設計裁量・Domain D/人間ゲートへの
正当な申し送りと判定（non-blocking）。

---

## 自分で走らせた機械ゲート生数字

`cd apps/soul/agent && node --test`（Review-Sylph が実行・タイムアウト300s・空/interrupted なし・1回で成功）:

```
1..479
# tests 479
# suites 0
# pass 479
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 1194.714
```

→ **Claim（domain-c.md §9）の 479/479/0 と一致**。S6 Domain B 後ベースライン 452 → +27（claim と一致）。

**器不変・契約不変・lockfile不変の検証**（自分で実行）:

```
git diff --stat -- apps/runtime-player packages 'apps/runtime-player/src/main/control-channel/contract' pnpm-lock.yaml apps/soul/agent/package.json
→ 出力なし（器コード・契約JSON・lockfile・依存 完全不変）
```

`git status --porcelain apps/soul/agent`: `fire-scheduler.mjs`/`fire-scheduler.test.mjs` が `??`（新規）、
`cockpit-server.mjs`/`cockpit-server.test.mjs` が `M`（変更）で、domain-c.md §1・§7 の一覧と完全一致。
他の変更ファイル（`audio-player.*`/`speak.*`/`fire-orchestrator.mjs`/`barge-in.mjs` 等）は Domain A/B の
未コミット成果物であり、diff 自体が Domain C の変更範囲と重なっていないことを裏付ける。

`fire-scheduler.mjs` の import 文をソースで直接確認: **1つも無い**（依存ゼロ）。`fire-scheduler.test.mjs`
は静的 `test(` 出現数を数え **22本**（claim と一致・内訳も定数1+正規化/照合3+呼びかけ3+区切り5+沈黙6+
OFFトグル1+決定論1+LLM非依存1+dispose1=22で claim の内訳式と一致）。`cockpit-server.test.mjs` の
self-fire 縦串テストを grep で数え **5本**（claim と一致）。

正規化・照合ロジックは実際にモジュールを import して手元で検証（node -e）: `NAME_VARIANTS_V0` の4種は
正規化後 `{コーティ, コーティー}` の2 needle に畳まれる（claim §4 と一致）。「コーディネートして」は
`true`（既知の誤爆・claim §4/§8-2 の記述どおり）。「コピーして」「コーヒー飲みたい」は `false`（誤爆
しない・claim どおり）。

*(check:deps/check:soul-zone/check:source の3チェックは本レーンの必須実行対象外のため再実行していない。
`git diff --stat` の空出力（器コード完全不変）が soul-zone/source チェックの前提となる差分不在を裏付ける。)*

---

## spec 検証項目（wave-plan §3 Domain C・inventory §1裁定4/§4-2 への逐条照合・PASS/FAIL + 根拠）

### 1. 自発3種の実装と規則の正しさ — **PASS**

- **呼びかけ（call）**: `handleTranscript`（`fire-scheduler.mjs:329-347`）。`entry.speaker==="soul"` は早期
  return（不応期リセット+活動のみ・照合しない）。you の場合、`textMatchesName` 命中で**不応期・確率を
  一切介さず**即 `emitFire("call")`（:340-346）。`fire-scheduler.test.mjs:115-134`「不応期を無視して毎回
  発火要求」で確実発火を実測固定。裁定4「呼ばれたら確実に返す」と一致。
- **区切り応答（turn-end）**: `handleVadEvent` の `speechEnd`（:312-319）で `turnEndSilenceMs`（既定2000ms）
  の無音待ちタイマを張り、`onTurnEndTimer`（:291-300）で ①`!isBusy()` ②不応期(`turnEndRefractoryMs`)
  ③確率(`rng()<turnEndProbability`) を**全て**満たせば発火。`speechStart` でタイマ取消（:308-311）。
  テスト5本（X境界・確率外れ・speechStart取消・不応期・busy）で全分岐固定（:202-263）。
- **沈黙（silence）**: 活動（speechStart/End・you/soul転写）で `armSilence`（:267-274）が
  `silenceBaseMs + floor(rng()×silenceJitterMs)` で再武装。`onSilenceTimer`（:276-289）で①有効②予算残
  ③`!isBusy()`④長不応期(`silenceRefractoryMs`)を満たせば発火+予算-1、busy/不応期内は**出さず再武装**、
  予算切れは**再武装しない**（タイマをイベントループに残さない・:271,281-284）。テスト6本
  （Y+ジッター・ジッター加算値・活動リセット・長不応期・予算切れ+タイマ非残存・busy再武装）で固定
  （:285-364）。設計文書（wave-plan §3・inventory §1裁定4）の記述と完全一致。

### 2. busy中・自発OFF中は発火要求を出さない／OFFで②〜④が黙り手動Fireは生きる — **PASS**

- call: `if (!enabled || isBusy()) return;`（:341）。turn-end: `onTurnEndTimer` 内で `isBusy()`/不応期を
  個別チェックし出さない（:293-297）。silence: `onSilenceTimer` 内で `isBusy()`/不応期不成立時は
  「出さずに再武装」（:281-284）。3種とも busy/OFF で要求を出さない設計が実装と一致。
- `setEnabled(false)`（:353-363）で `clearTurnEnd()`+`clearSilence()` によりタイマも畳む（イベントループ
  に残さない）。`fire-scheduler.test.mjs:368-397`「OFFトグル」で3種の沈黙+タイマ0本を実測固定。
- 手動Fireは `/api/fire` エンドポイント（`cockpit-server.mjs:687`）が `fireOrchestrator.fire()` を直接
  呼ぶ経路であり、`fireScheduler` を一切経由しない。自発OFF（scheduler側の enabled=false）は手動Fireの
  到達経路に影響しない（構造的に独立）。§1人間ゲート⑤「自発OFFトグルで②〜④が黙る・手動Fireは生きる」
  と一致。

### 3. 照合集合v0・正規化・soul除外 — **PASS**

- `NAME_VARIANTS_V0`（:99）は inventory §4-2 の実測7種のうち採用4種（コーディ/コーディー/コーティ/
  コーティー）のみ。見送り3種（コーピー/コーキー/こうて・こうで）の理由がコメントに明記され
  （:90-97）、inventory §4-2 の採否根拠（「コーピー」誤爆リスク等）と一致。
- `normalizeForMatch`（:117-128）: NFKC→ひらがな→カタカナ→濁点/半濁点剥がし（NFD→除去→NFC）の3段。
  末尾長音は剥がさない設計（コメント:110-111）。自分で実行検証: 4種の needle が正規化後
  `{コーティ, コーティー}` の2種に畳まれることを実測（上記「自分で走らせた機械ゲート生数字」節）。
  `textMatchesName` テスト（:97-111）で採用4種+かな+連結命中、非採用5種+コピー/コーヒー非命中を固定。
- 転写のsoul除外: 呼びかけ照合そのものは `handleTranscript` 冒頭の `entry.speaker==="soul"` 早期return
  （:332-337）で soul を確実に除外している（soul は不応期リセット＋活動のみ）。
  `fire-scheduler.test.mjs:136-155`「soul発話が名前を含んでも自己応答しない」で固定。cockpit-server結線
  テスト側でも `fakePipe.record.buffer.append({..., speaker:"soul"})` で二重に確認（:1246-1247）。
- 拡張可能性: `createFireScheduler({nameVariants})` オプションで揺れ集合を上書き可能（:201,231）。
  データ定数ゆえ inventory §4-2「後から拡張可能」の要求と一致。

### 4. orchestrator結線（kind出し分け・手動Fire/視覚発火/barge-in/S1〜S5不変） — **PASS**

- `cockpit-server.mjs:873-888`: `onFireRequest` で `req.kind==="silence"` のみ `fire({vision:true})`、
  それ以外（call/turn-end）は `fire()`。wave-plan §3「call/turn-end→通常Fire・silence→視覚発火」と一致。
  `cockpit-server.test.mjs:1238-1241` で call が `lastFireOptions===undefined`（通常Fire・vision無し）を
  実測固定。
- `onVadEvent`（:511-525）は従来の SSE "vad" 放送・barge-in gate 呼び出しに**並んで**
  `fireScheduler.handleVadEvent(e)` を呼ぶだけの additive 構造。`onTranscript`（:526-534）は
  **soul除外の前**に `fireScheduler.handleTranscript(entry)` を呼び、その後で
  `if (entry.speaker==="soul") return;`（SSE放送側の除外）。実際の `ear-pipeline.mjs:184-185`
  （`buffer.onAppend((entry) => onTranscript(entry, ...))`）は話者無差別に発火する既存契約
  （同ファイルヘッダコメント:48「話者無差別」と一致）ため、scheduler が you/soul 両方を受け取れる配線が
  実装と一致することをソースで確認した。
- scheduler は `fireOrchestrator && typeof .fire==="function" && typeof .getState==="function"` のときのみ
  生成（:868-872）＝barge-in gate と同じ additive 作法。未注入時は scheduler 無し
  （`cockpit-server.test.mjs:1318-1329`「orchestrator未注入ならscheduler無し」で固定）＝S2.5〜S5無退行。
- 手動Fire（`/api/fire`）・視覚発火（既存 `fireVision`/`/api/vision-fire` 経路）・barge-in
  （`bargeInGate`・Domain B領分）はいずれも scheduler の生成/削除・結線と独立した既存コードパスであり、
  本Domainで1バイトも変更していない（`git status` で `fire-orchestrator.mjs`/`barge-in.mjs` は Domain A/B
  の変更として区別されている・Domain C 差分は `cockpit-server.mjs`/`.test.mjs` の2ファイルのみ）。
  `close()` での `fireScheduler.dispose()`（:939-946）は `bargeInGate.dispose()`（:931-938）と並列・独立に
  try/catchでbest-effort。

### 5. 成果物の主張の正直性（生数字479・器不変・定数一覧） — **PASS**

- 479/479/0 は自分の実行で再現・一致。ベースライン452（Domain B後）→+27 も一致。
- 器コード・契約JSON・lockfile完全不変は自分の `git diff --stat` で確認済み（出力なし）。
- 定数一覧（`TURN_END_SILENCE_MS=2000`/`TURN_END_PROBABILITY=0.35`/`TURN_END_REFRACTORY_MS=8000`/
  `SILENCE_BASE_MS=45000`/`SILENCE_JITTER_MS=30000`/`SILENCE_REFRACTORY_MS=90000`/`SILENCE_BUDGET_V0=6`）
  はソース（:47-83）の値と domain-c.md §3 の表が完全一致。
- 「import ゼロ」の主張（§6）はソースを自分で通読して確認（`fire-scheduler.mjs` に `import` 文字列自体が
  存在しない）。LLM非依存テスト（:444-451）が `import.*from`/`.ask(`/`createLlmSession|llm-session|
  claude-agent-sdk|session.ask` の正規表現で機械的に固定している。

---

## §質問（domain-c.md §8）の spec 判定 — いずれも non-blocking

| # | 質問 | spec 判定 |
|---|---|---|
| 1 | 自発ON/OFFの永続トグル+UIはDomain D領分（継ぎ目のみ用意） | **non-blocking**。wave-plan §3 Domain Dが「自発ON/OFFトグル(モードスイッチ・永続化)」を明示的に割り当てており、Domain Cが `selfFireInitialEnabled`/`setSelfFireEnabled`/`selfFireStatus`/snapshot `selfFire` の継ぎ目だけを露出する設計は責務分担として正しい。既定OFFで自発が暴発しない設計も§1人間ゲート順序と整合。 |
| 2 | 呼びかけ照合の既知誤爆「コーディネート」 | **non-blocking**。inventory §1裁定2「誤爆は起きてよい失敗」の範囲内であり、inventory §4-2で「実害があれば緊縮を検討」と明示的に許容されている事項。自分で実測してもコピー/コーヒー等の主要な誤爆候補は非命中であり、precision重視の採否判断（採用4種/見送り3種）は妥当。 |
| 3 | turn-endはVAD無音ベース(X=2000ms)で撃つ=転写到着と非同期 | **non-blocking**。wave-plan §3の規則定義（「speechEnd後X秒無音+不応期+確率」）どおりの実装であり、ASR遅延との相互作用は実配信の体感で調整すべき定数チューニングの領分（裁定8「ツマミは作らないがコード内定数は人間ゲートで直す」）。 |
| 4 | callもbusy中は出さない設計 | **non-blocking**。wave-plan §3「busy中・自発OFF中は発火要求を出さない」は3種を区別せず明記しており、call個別の例外規定は無い。busy中に要求してもorchestratorが無視するだけという実装判断は無駄な要求を減らす保守的設計であり契約違反ではない。 |
| 5 | 不応期の基点は「発火要求を出した時点」でも更新 | **non-blocking**。inventory §1裁定4の「不応期」の記述に矛盾しない実装選択（リトライ嵐回避の保守側）。実配信での過度な沈黙リスクはDomain D/人間ゲートでの定数調整対象として正しく開示。 |
| 6 | 沈黙の「活動」定義（speechCancelは無視） | **non-blocking**。inventory §1裁定2「誤爆は起きてよい失敗」・スパイクは稀という前提と整合。design.mdの`handleVadEvent`コメント（:320-321）でも明記済みの意図的な設計。 |
| 7 | cockpit-server結線テストは呼びかけ(call)のみで縦串固定 | **non-blocking**。核心（自発3種の判定・不応期・確率・ジッター・予算・OFF）は純ロジック側（fire-scheduler.test.mjs 22本）でfake clock+RNGにより全分岐決定論テスト済み（blocking基準3の要求はここで満たされる）。結線層はturn-end/silenceがタイマ依存で決定論テストが煩雑なため、即時判定できるcallで縦串を固定する判断はDomain B review-specでも同型の判断が受容されている（domain-b-review-spec.md §質問6と同じロジック）。 |

---

## blocking / non-blocking の分離

### blocking（wave-plan §4）— 該当基準はすべてクリア

| 基準 | 判定 | 根拠 |
|---|---|---|
| 1. 器コード・契約JSON・lockfile完全不変・新規依存ゼロ・手動Fire/視覚発火/S1〜S5無退行 | PASS | `git diff --stat` 出力なし（自分で実行）。`fire-scheduler.mjs` はimportゼロ（新規依存ゼロを構造で担保）。手動Fire/視覚発火/barge-inは本Domainで1バイトも触れていない（`git status`で確認）。 |
| 2. 3チェック無退行 | 情報不足(non-blocking扱い) | 本レーンの必須実行対象外につき再実行せず。domain-c.md §7の claim（check:deps/soul-zone/source 全passed）と、自分で確認した「器コード完全不変」（soul-zone/sourceの前提となる差分）は整合。 |
| 3. スケジューラは純ロジック+fake clock/注入RNGで全分岐決定論テスト必須・LLM ask経路不在 | PASS | `fire-scheduler.mjs`はimport文0件（自分でソース確認）。`fire-scheduler.test.mjs`22本で全分岐（呼びかけ/区切り/沈黙/OFF/決定論/LLM非依存）をfake clock+timer+RNG注入で固定（自分で読了）。 |
| 4. barge-in経路 | N/A | Domain B領分。Domain Cはbarge-inに触れていない。 |
| 5. SDK実消費上限5ask | PASS | Domain Cは実SDK・実PowerShell・実マイク・実TTSを一切呼んでいない（全fake・無音・importゼロのソースが構造的に裏付ける）。 |
| 6. 終了処理・タイムアウト | PASS | `dispose()`（:376-380）でタイマ解除・以後イベント無視。`cockpit-server.mjs`の`close()`で`fireScheduler.dispose()`をtry/catchで呼ぶ（:939-946）。`node --test`は自然終了（自分で実行し確認・ハングなし）。 |

### non-blocking

- domain-c.md §8 の7件の§質問（上表参照）——いずれも設計裁量またはDomain D・人間ゲートへの正当な申し送り。
- check:deps/check:soul-zone/check:source の3チェックはこのレビューでは再実行していない（本レーンの
  必須実行対象外）。Domain D/最終ゲートでの再確認を推奨（non-blocking・確認待ち事項として記録）。

---

## Orch への申し送り

- spec レーンとして S6 Domain C は wave-plan §3 Domain C・§4 blocking基準3、inventory §1裁定4・§4-2の
  要求を逐条で満たす。自発3種の判定規則・busy/OFFでの黙り方・照合集合v0の採否・orchestrator結線の
  kind出し分けは、いずれも自分でソース（`fire-scheduler.mjs`/`cockpit-server.mjs`/両テストファイル/
  `ear-pipeline.mjs`）を読み比べ、`normalizeForMatch`/`textMatchesName`を実際にimportして手元検証した
  （Gnomeの説明への依存を避けるための最も強い検証）。
- 「import ゼロ = LLM非依存」の構造的担保は自分でソースを通読して実在を確認済み(claimは正確)。
- 生数字479/479/0・ベースライン452→+27・器不変の`git diff --stat`はいずれも自分の実行で再現し、
  domain-c.md の記述と完全一致（捏造・過大申告は検出せず）。
- 唯一の確認待ち: check:deps/soul-zone/sourceの3チェックはこのレビューで再実行していない
  （本レーンの必須実行範囲外）。器コード完全不変という強い間接証拠はあるが、Domain D/最終ゲートでの
  再確認を推奨。
