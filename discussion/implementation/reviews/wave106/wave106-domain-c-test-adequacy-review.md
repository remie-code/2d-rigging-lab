# Wave106 Domain C — runtime-player Dynamics Tuning Profile v2 / Test Adequacy Review

- レビュー担当: Review-Sylph（Orch-Sylph からのサブエージェント委任）
- 対象: `apps/runtime-player` の dynamics tuning profile v2 語彙化 + 新テスト
- 判定基準: `discussion/design/dynamics-world-frame-chain.md` §9（tuning profile v2）/ §6 裁定 #2、Wave106 計画 §8
- 判定: **要修正**（合格ラインに近いが、無効値 sanitize/reject のテスト不在という実効性の穴が1点あり）

---

## 実測（自分で走らせた結果）

- 中核3本: `effective-dynamics-tuning.test.ts`(3) / `dynamics-tuning-profile-store.test.ts`(4) / `dynamics-tuning-state.test.ts`(3) = **10/10 pass**
- `browser-source-stage-client.test.ts`(11) / `broadcast-source/browser-source-session.test.ts`(7) 単体 = pass
- runtime-player 全体 = **426 pass / 2 fail**（既存赤2件を再現。後述）

---

## Required test ごとの実効性評価

### 1. override 乗数の数値テスト（`effective-dynamics-tuning.test.ts`）— 実効性 **十分**

`effective-dynamics-tuning.ts` の意味論（Scale 系＝乗算、その他＝置換）を、恒等でない具体数値で検算しており、乗算と置換を確実に区別できている。

- `outputScale=2` × 出力 scale `0.5` → **1**（0.5 とも 2 とも異なる合成値なので「置換」では出せない）
- `lengthScale=1.5` × segmentLengths `[12,6]` → **[18,9]**（複数セグメント全てに乗算が効くことを固定）
- `damping/gravityScale/limit` は override 値そのまま（9 / 0.25 / 0.9）で、基準値（2.5 / 1 / 1）とも「基準×何か」とも区別できる置換値
- outputScale と lengthScale の取り違え防止: `output.scale` は 1、`segmentLengths` は [18,9] と別々に効くことを同一テストで固定。取り違えれば必ずどちらかが崩れる
- 非破壊性・クローン独立性（`model` 不変、`.not.toBe`）も担保
- override 未指定時（`effectiveDynamicsTuning: null`）に恒等クローンへ戻ることも別ケースで担保

トートロジー・オウム返しなし。期待値は実装値の写経ではなく、入力から手計算できる独立値。

### 2. v1 プロファイル破棄テスト（`dynamics-tuning-profile-store.test.ts`）— 実効性 **概ね十分、ただし症状連結が分断**

`"discards a saved v1 (pendulum vocabulary) profile as read-failed"` が、旧 schemaVersion リテラル `runtime-player-dynamics-tuning-profile-v1` と旧 pendulum/strength 語彙（strength/length/sway/reactionSpeed/convergenceSpeed）を持つ legacy JSON を**実ファイルに書き込み**、`loadProfile` が `state:"read-failed"` / `profile:null` / warning に "schema version" を含むことを検証している。単なる「parser が false」で止まらず、store 経由の症状（read-failed + null）まで固定できている点は良い。parser 実装（`dynamics-tuning-profile-parser.ts` L33 の strict schemaVersion 一致チェック）が破棄の根拠であることとも整合。移行（migration）していないことも、旧フィールドが profile に載らない＝そもそも profile が null になることで担保されている。

**ただし** 計画 §8 の「v1 が黙って捨てられ**既定値で動く**」の後半（既定値で動く）は、このテスト単体では `profile:null` までしか押さえていない。「null → override なしの既定値クローンで動く」は `effective-dynamics-tuning.test.ts` の "clones ... when no override applies" が別テストとして担保しているが、**「v1破棄 → null → 既定値で動く」を1本で通す end-to-end テストは存在しない**。各段が別々に緑なので実運用は守られるが、症状レベルの不変条件を単一テストで固定してはいない。実効性としては許容範囲（差分の主要責務は分離されている）だが、補強推奨（後述 D-2）。

### 3. v2 語彙化（全 tuning 系テスト）— 実効性 **十分**

- `dynamics-tune-page.test.ts`: 新ラベル（Output Scale / Length Scale / Limit / Damping / Gravity Scale）を positive assertion、旧語彙（Strength / Sway / Reaction / Convergence / Pendulum count）を **negative assertion で明示的に排除**。updateGroup ペイロードも `outputScale`/`lengthScale`/`damping`/`gravityScale` の6連続 nth-call で個別フィールド送出を固定。オウム返しではなく UI→ブリッジ契約を捕捉
- `control-window-app.dynamics-tune.test.ts`: 語彙置換に加え outputSummary の kind を `"angle"`→`"segment 1"` へ更新。ブリッジ配線の nth-call 検証あり
- `dynamics-tuning-state.test.ts`: stale signature 時に override が破棄され `effectiveValues` が恒等（outputScale:1, lengthScale:1）へ戻ること、missing group id の無視、revision インクリメントを v2 値で検証。恒等ベースライン（乗数系=1）の意味論も固定
- `dynamics-tuning-profile-save-controller.test.ts` / `dynamics-tuning-bridge-handlers.test.ts`: 永続化・debounce・reset を v2 値で検証。save→reload の往復で `{outputScale, damping, gravityScale}` 等が正しく保存・復元されることを固定

`.skip` / `.todo` / `xit` / `xdescribe` は runtime-player テスト全体に**皆無**。旧語彙の残存は store.test.ts の legacy JSON 構築（意図的・正当）のみ。

---

## オウム返し / トートロジー検出結果

- 中核テストにトートロジー（期待値＝実装値の写経）は**検出されず**。override 数値テストの期待値は入力から独立に手計算可能。v1破棄テストの期待値（read-failed/null/"schema version"）も実装の写経ではなく症状の記述
- `dynamics-tune-page.test.ts` の updateGroup nth-call は「UI が送るべき契約」を固定するもので、実装値の写経ではない

---

## 差分（要修正 / 補強指針）

### D-1（要修正・実効性の穴）: 無効値 reject / sanitize のテストが3層すべてで不在

観点3「無効値（負の outputScale 等）が sanitize/parse で落ちる」を検証するテストが**どこにも存在しない**。無効値落としロジックは以下3箇所に実装されているが、いずれも対応するテストが無い（有効値のみ流すテストしか無い）:

- `dynamics-tuning-bridge-request-validation.ts`（L15-28, L107-121）: 負/0 の outputScale・lengthScale で throw、負の limit/damping/gravityScale で throw。**この validation ファイルには `.test.ts` が変更前後とも1本も存在しない**
- `dynamics-tuning-profiles/dynamics-tuning-profile-groups.ts` の `sanitizeGroupOverride`（L160-181）: `isPositiveNumber`/`isNonNegativeNumber` で無効値を静かに drop。**groups.ts 専用テストは無い**
- `dynamics-tuning-profile-parser.ts` の `parseGroupOverride`（L128-174, `readOptionalPositiveNumber` 等）: 無効値を null 化して warning 追加。**parser 専用テストは無い**

現状、「負の outputScale を投げても弾かれず素通りして乗算で符号反転する」ような回帰が入っても、どのテストも赤くならない。v2 の新しい不変条件（Scale 系は positive-only）を**捕捉できていない**。

補強指針（最小1本ずつ、いずれか薄くてもよいが validation と sanitize は欲しい）:
- validation: `readDynamicsTuningGroupUpdateRequest({groupId, outputScale: -1})` が throw（"must be positive"）、`{limit: -0.1}` が throw（"must be non-negative"）
- sanitize/parse: 負の outputScale・lengthScale を含む override が sanitize/parse 後に**そのキーごと落ちる**（`Object.keys` に含まれない）ことを固定。恒等でない無効値（例 outputScale:-2）を入れ、結果が「override 未指定と同じ既定値挙動」になることまで押さえると症状レベルになる

### D-2（補強推奨・優先度低）: v1破棄→既定値の end-to-end 連結が1本に無い

上記「2」で述べたとおり、「v1破棄で null → 既定値クローンで動く」を単一テストで通していない。store.test.ts の v1破棄テストに、`loaded.profile` が null であることに加えて「その null を `createEffectiveRuntimeExportDynamicsGroups` に渡すと exported 値そのままのクローンが返る」を1行足すと、計画 §8 後半（既定値で動く）が症状レベルで固定される。各段が別々に緑なので blocking ではない。

---

## 既存赤2件について（観点5・blocking にしない）

runtime-player 全体で赤2件を再現・特定した:

- `src/main/broadcast-source/browser-source-server.test.ts:150`（"serves current Runtime Export payload ..."）
- `src/stage/browser-source/browser-source-server-message.test.ts:216`（"accepts the not-loaded response shape"）

**両方とも `toStrictEqual` の shape mismatch**で、Received に `effectiveDynamicsTuning: null` フィールドが増えたのに期待値（旧 shape）が追随していないだけ。実装（browser-source-server-message）は既に該当フィールドを出力しており、テストの期待オブジェクトが未更新。着手前 HEAD 由来という Orch 実測（git stash）と整合する性質で、Domain C 起因ではない。**blocking にしない。**

カバレッジの穴を隠していないかの評価: この2赤はいずれも **not-loaded / empty ケース**（override 値が存在しないケース）の shape 検証であり、tuning override の**値の伝播（乗算意味論）**を検証するテストではない。よって Domain C の値カバレッジを隠してはいない。ただし副次的観察として、browser-source 経路で override 値（v2 の乗算・置換）が正しく伝播することを検証するテスト自体が薄い（`browser-source-server-message.ts` の `readDynamicsTuningGroupOverride` に v2 の positive-only reject が実装されているが、その経路の無効値テストも D-1 と同様に不在）。これは D-1 の一部として扱えば足りる。

---

## 質問（Orch へ）

1. D-1 の無効値 reject テストは、この Wave106 Domain C の scope に含める前提でよいか（計画 §8 の「override 適用の数値テスト（乗数の意味論）」に無効値 reject が含意されると読むか）。もし別 Wave / 別 Domain に切るなら、本レビューは D-1 を「既知の追随タスク」に降格し合格可とする余地がある
2. 既存赤2件（browser-source shape）は Domain C の touch 領域に近接するが、更新は別 Domain の責務という理解でよいか

---

## 判定

**要修正**（差分の実効性は総じて高く、v1破棄・override 数値・v2 語彙化はいずれも合格水準。ただし D-1「無効値 reject / sanitize のテストが validation・sanitize・parser の3層すべてで不在」は v2 の新不変条件（Scale 系 positive-only）を捕捉できておらず、実効性の穴として要修正。D-2 は補強推奨で blocking ではない。既存赤2件は blocking にしない。）
