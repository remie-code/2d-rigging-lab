# C3 Domain B レビュー — レーン2「design / development」

> レビュー: Review-Sylph、2026-07-11。委任元: Orch-Sylph。対象: `apps/runtime-player/src/main/physiology/`。
> 問い: 決定論と純度を厳密に保ち、堅牢で、拡張に開かれ、既存契約を汚さないか。特に結合機構(couplingSeed 共有 seam + 純関数スケジュール再計算)を数式とコードで独立検証する。
> basis: Gnome 実装報告 §2、c3-gaze-head-posture.md §1-4/§6、deterministic-noise.ts(Domain A 契約)、c3-planning-inventory.md §2.1/§2.2。

## 判定: **合格**

要修正なし。設計未定義の合理的実装が2点、Domain C への申し送り注記が1点(いずれも blocking でない)。

---

## 独立検証した核心(数式 + コード)

### 1. 結合機構の決定論 — 構成的同一性を**厳密に証明**(観点1)

**旧 sub-seed 導出**(HEAD 版 physiology-generator.ts):
`mixSeeds(config.seed >>> 0, hashStringToSeed(behaviorId))`

**新 `deriveBehaviorSeed`**(deterministic-hash.ts:59-61):
`deriveBehaviorSeed(sessionSeed, id) = mixSeeds(sessionSeed >>> 0, hashStringToSeed(id))`

generator(physiology-generator.ts:64-67)は `couplingSeed = config.seed >>> 0`、`seed = deriveBehaviorSeed(couplingSeed, id)` を導出。
`deriveBehaviorSeed(config.seed>>>0, id) = mixSeeds((config.seed>>>0)>>>0, hashString(id)) = mixSeeds(config.seed>>>0, hashString(id))` = 旧導出。**バイト一致。** よって refactor は既存 behavior(blink 含む)の sub-seed を一切変えない → blink golden / Domain A テスト不変の根拠が数式で成立。

結合側は同じ関数で兄弟 seed を復元する:
- head → posture: `deriveBehaviorSeed(input.couplingSeed, POSTURE_BEHAVIOR_ID)`(head-behavior.ts:247)
- head → gaze: `deriveBehaviorSeed(input.couplingSeed, GAZE_BEHAVIOR_ID)`(:256)
- saccade-blink → gaze: 同上(saccade-blink-coupling.ts:138)

generator が各 sample に `couplingSeed`(= session seed)を渡す(physiology-generator.ts:75)ので、結合側が復元する兄弟 seed は generator が兄弟に与えた seed と**構成的に厳密一致**。状態共有ゼロ、純導出のみ。
head-behavior.test.ts:30-32 が `POSTURE_SEED = deriveBehaviorSeed(SESSION_SEED, "posture")` を独立に導出し、head の結合再計算を `sampleReseatBaseline(POSTURE_SEED, …)` と突き合わせて(:221-243)このシームを end-to-end で固定している。

**sanitization**: behavior が返すのは `SemanticSlotActivationContribution = Record<string, number>`(スロット値のみ)。`couplingSeed` は sample の入力であり、contribution にも generator の出力 Record にも決して書き込まれない → フレームに漏れない。境界不変。✓

**純度**: 全結合が (seed, couplingSeed, config, time) の純関数。cursor / ring は forward-only memo。head-behavior.test.ts:68-93 が「cursor 通し = fresh from-epoch 一致(結合 ring 込み)」を固定。✓

**isolated degrade**: `couplingSeed === undefined`(または兄弟 config 不在)で head は sway のみへ、saccade-blink は `{}` を返す(saccade-blink-coupling.ts:133)。✓

### 2. 衝突マージの安全性 — union 意味論(観点2)

physiology-generator.ts:89-92:
`activations[slotId] = existing === undefined || Math.abs(value) > Math.abs(existing) ? value : existing`

- **eye スロット(唯一の衝突点)**: 自然 blink・同期 blink とも [0,1] 非負なので `Math.abs = 値`、max-abs = max。同期 blink は深めるのみ・切り詰め不可(自然 > 同期 なら自然を保持)。union。✓ physiology-coupling.test.ts:76-90 が全フレームで `full ≥ natural − 1e-9` を固定、かつ注入 blink 実在(:97-124)と「注入は必ず大サッカード上」(:120-121)を固定。
- **centered スロット(gaze/head/body)**: 各単一所有 → 衝突せず `existing === undefined` で単純代入。意図しない上書き無し。✓
- **旧 merge 契約の退行無し**: 旧は plain `activations[slotId] = value`(last-write)。単一所有スロットは書込1回なので first-write == only-write で新旧同値 → 新 merge は衝突ケースのみ追加する**厳密な上位互換**。blink-only golden 経路はバイト不変(blink-behavior.ts / blink golden は git 変更対象外を確認)。✓

### 3. 閉形式の厳密性(観点3)

全て dt 積分なしの time 純関数であることをコードで確認:
- reseat ランプ: `smootherstep((t − startMs)/RESEAT_TRANSITION_MS)`(posture-reseat.ts:155)
- head follow ランプ: `smootherstep((t − cur.activateMs)/FOLLOW_RAMP_MS)`(head-behavior.ts:202)
- head 3層 / posture drift: `homeSpringValue` / `layeredValueNoise`(Domain A 契約どおり: 有界・平均回帰・quintic C²)
`homeSpringValue` の使い方(home=0, amplitude, layers, homePull)は HomeSpringParams 契約に整合。**NaN/オーバーフロー/値域逸脱**: 除数は全て正定数(450/1600/cellMs>0)、dwell/interval は floor(200/40000ms)で正、重み total>0(home 重み ≥1)、最終 `clampUnitSigned` で [-1,1] 保証。逸脱・NaN 経路なし。✓

### 4. body-follow-state 非経由(裁定2)(観点4)

posture-behavior.ts / posture-reseat.ts とも import せず、reseat は閉形式 smootherstep ランプで完結。posture-behavior.test.ts:67-79 が両ファイルをコメント除去後スキャンし `body-follow-state` 文字列不在を構造的に固定。✓

### 5. event-walk / cursor の正しさ(観点5)

- **reseat sentinel**: `INITIAL_RESEAT_CURSOR.nextStartMs = 0` は「S₀ 未計算」の番兵。walkReseatTo:138-141 が `nextIndex===0 && nextStartMs===0` の時のみ S₀=interval(0) に解決。interval は `Math.max(40000, …)` ≥ 40000 > 0 なので、一度解決後の cursor の nextStartMs は 0 に戻らず番兵誤発火は**構造的に不可能**。堅牢。✓
- **timing 整合**: walkReseatTo の Sᵢ=Σₖ₌₀ⁱ interval(k) と enumerateReseats(:195-205)の逐次加算が index++ 後に interval(index) を足す点まで一致 → 分布テストと sample 経路が同一スケジュール。✓
- **forward-only 冪等性**: gaze/saccade-blink の advance ループは `startMs > t` で break する際に cursor を進めない(gaze-saccade.ts stepFixation 消費側 head-behavior.ts:158-178 / saccade-blink-coupling.ts:90-106)。同一 t 再クエリで二重 push せず、ring は last-N を保持 → from-epoch fresh walk と ring 末尾一致(head-behavior.test.ts:68 で固定)。✓
- **不応期 floor binding**: gaze dwell `Math.max(MIN_FIXATION_MS, …)`(gaze-saccade.ts:158,161)、reseat `Math.max(RESEAT_MIN_INTERVAL_MS, …)`(posture-reseat.ts:81,86)。テストで実 binding を確認済み(報告 §6)。✓

### 6. 拡張性・単純化(観点6)

共有スケジュールを behavior から分離(`gaze-saccade.ts` / `posture-reseat.ts`)し、3 consumer(gaze/head/saccade-blink、posture/head)が同一純関数を再計算 = 責務明快・状態共有ゼロ。`deriveBehaviorSeed` の deterministic-hash.ts 抽出で generator と結合が同一導出を共有。デッドコード・不要複雑性なし。refactor が既存 sub-seed を変えないことは §1 で数式証明済み。✓

### 7. 純度の構造的担保(観点7)

blink-behavior.test.ts:222-256 の純度スキャンは `readdirSync(here)` でディレクトリ内 `*.ts`(非 test)を**全列挙** → 新規6ソースを自動的に含む。コメント除去で docstring 内の「no Math.random」等の偽陽性を回避。Electron / 壁時計 / Math.random / crypto を全ソースで禁止。✓

---

## 注記(blocking でない)

1. **[軽微・観点3/6] 露出質感語ノブの上限非拘束**: `config.follow`/`config.sway`/`config.drift`/`cameraFocus`/`restlessness` は `Math.max(0, …)` で下限のみ。follow が ~1.67 を超えると gain=0.6·follow で follow 寄与が gaze 着地を上回り「全部は向かない(|follow|<|gaze|)」の質感不変条件が崩れうる。ただし最終 `clampUnitSigned` で値域逸脱・NaN は無く**堅牢性・決定論の問題ではない**。質感保証は Domain C の UI が質感語を ~[0,1] に正規化することに依存する。→ Domain C への申し送り(ノブ範囲正規化)として記録すれば十分。設計未定義部分の合理的実装として許容。

2. **[設計未定義の合理的実装] max-abs を union に選択**: 「深めるが切り詰めない」は max で成立(§2 で検証)。screen blend `1−(1−a)(1−b)` 等より単純で、報告 §3-2 の意図(自然 blink 不減)に厳密一致。妥当。

3. **[申し送り確認] heart 既定 provider 非変更(報告 §8 Q1)**: `DEFAULT_PHYSIOLOGY_CONFIG` を blink-only 維持し `DEFAULT_FULL_PHYSIOLOGY_CONFIG` を新設した判断は、Domain A テスト/blink golden 不変と両立する合理的分離。実行時に gaze/head/posture を生かすには Domain C が provider 既定を full 側へ差し替える必要がある — これは design レーンの品質問題ではなく Orch/Domain C のスコープ判断。レビュー上は問題なし。

---

## 結論

結合機構は数式(構成的 seed 同一性)とコード(union merge・閉形式ランプ・forward-only cursor・sentinel 堅牢性)の双方で厳密に検証でき、決定論・純度・sanitization 境界・既存契約(blink golden / Domain A / merge の dumb 透過)を一切汚していない。共有スケジュール分離により拡張にも開かれている。**合格。**
