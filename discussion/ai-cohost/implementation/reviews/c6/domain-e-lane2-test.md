# C6 統合Domain E改 レビュー: Lane2 = test adequacy (`cohost-c6-followup2-articulation-slider`)

> レビュー担当: Review-Sylph(Lane2=テストの十分性)。Orch-Sylph からのサブエージェント委任。2026-07-12。
> ループ番号: **1**。
> 判定: **合格(pass)**。blocking差分なし。
> 全数字は自分で `vitest run` を実行して裏取りした実測値(捏造なし)。

---

## 判定サマリ

前回 C6 Domain A の vacuous 前科(連続性 bound が値域を超えて全域スナップすら検出不能)は、本波では**再発していない**。全ての連続性 bound テスト(pure 基準・floor 両端・store・re-attack)で bound が導出式であり、主要3系統に `bound < valueRange` の明示 gate と `observedMax < bound` のヘッドルーム assert が入っている。凸恒等・非静止・同時ケース re-attack はスライダー範囲両端で走っており、閾値は floor/定数からの導出でマジックナンバーではない。契約・golden・DEFAULT 群・resolver・lockfile は git 実行で無変更を確認。全体スイート 917 pass / 2 fail は既知 browser-source baseline のみ。

---

## 8観点の適合状況(実測つき)

### 観点1: 凸恒等がスライダー全域(floor 最小/最大の両端)で成立 — 適合
- `speech-timeline-state.test.ts` の `Articulation floor range ends (§13, スライダー全域)` describe は `for (const floor of [ARTICULATION_FLOOR_CRISP, ARTICULATION_FLOOR_SOFT])` で **両端**を回し、各 floor で `holds the convex identity at EVERY tick` を 4ms 刻み全域(onset→区間→境界→o×5→終端+release)で `Σvowel ≈ mouth-open`(9桁)を assert。片端・中央だけになっていない。
- 端点は `ARTICULATION_FLOOR_CRISP`/`ARTICULATION_FLOOR_SOFT` を physiology-tone-config から **import**(恣意リテラル回避)。tone-config 側の実定数は SOFT=0.9・CRISP=0.4(=`RUNTIME_PLAYER_SPEECH_DIP_FLOOR`)で、スライダー範囲の実両端に一致。
- 注: 凸恒等は構造(単一 s・単一 p)由来のため floor 値に依存せず成立する = この観点単独では floor 適用の証明にはならないが、要求は「識別が全域で破れないこと」であり充足。floor が実際に効いていることは観点2・store 即時反映テストが別途証明する。

### 観点2: 「のところど」非静止が範囲両端で成立・閾値は floor 導出 — 適合
- 同 describe の `keeps the o×5 run 非静止 (dip present) for floor=...` が **両端**で走行。閾値 `expectedSwing = RUNTIME_PLAYER_SPEECH_OPEN_SCALE · minS · (1 − floor)` を定数と実データ振幅から導出し `max−min > 0.5·expectedSwing` を assert。恣意リテラルではない。
  - SOFT(0.9): expectedSwing = 0.8·0.6·0.1 = **0.048** → 要求 swing > 0.024。沈まない側でも非静止を実測で担保。
  - CRISP(0.4): expectedSwing = 0.8·0.6·0.6 = **0.288** → 要求 swing > 0.144。
- `expect(expectedSwing).toBeGreaterThan(0)` も assert(floor<1 ⇒ 常にディップ)。
- 閾値は floor に**スケール**し、加えて実データの minS(振幅)にも比例する。要求の「振幅非依存」は厳密には満たさないが、これは「実際に起こる swing 量」を導出して半分を下限に置く自己整合な導出であり、floor-only の固定閾値より精密。マジックナンバー化・恣意化の懸念は無い(non-blocking の観察)。

### 観点3: 連続性 bound が導出でガード性を持つ(vacuous 前科の再発防止) — 適合(最重要・クリア)
- **導出**: 全 bound テストが `boundPerTick = valueRange · (onsetSlope/ms + dipSlope/ms) · frameInterval`。各因子(`RUNTIME_PLAYER_SMOOTHSTEP_MAX_SLOPE`, `ONSET_MS`, `DIP_MS`, `OPEN_SCALE`, `DIP_FLOOR`/floor, maxS, 16ms)は全て評価器定数か実データ。マジックナンバー無し。旧 Domain A の 4系統単純加算(bound≈0.744 でスナップ検出不能)は onset+dip の 2 支配傾きに絞り、cross-fade/release を除外したと明記。
- **`bound < valueRange` 明示 gate**: pure 基準テスト(L324)・floor 両端テスト(L400)・store テスト(L618)の**3系統すべて**に `expect(bound).toBeLessThan(valueRange)`。実測値:
  - 基準/CRISP: bound = 0.64·(0.025+0.0225)·16 = **0.4864 < 0.64** ✓
  - SOFT: bound = 0.64·(0.025+0.00375)·16 = **0.2944 < 0.64** ✓(soft 端で締まる=floor 伸縮が正しい)
  - store(PHRASE maxS=0.8): **0.4864 < 0.64** ✓
  全域スナップ(値域幅 0.64 の 1-tick 移動)は bound を超えて必ず検出される = 実ガード性あり。
- **ヘッドルーム assert**: pure 基準(L342)・floor 両端(L416)・store(L637)に `expect(observedMax).toBeLessThan(bound)`。実測で全 pass = 実 tick step は bound 直下でなく余裕を持つ(評価器が連続)。
- **floor 両端で bound が伸縮**: dipSlope が `(1−floor)` を含むため crisp で広く soft で狭くなり、両端とも gate を満たす(上記)。

### 観点4: 同時ケースの連続性テスト新設(pure + store 両方) — 適合
- **pure**: `group re-attack (onsetFromOpen, §12項目2 同時ケース)` describe。
  - `lifts mouth.open FROM the captured effective value at onset, not 0`: `onsetFromOpen=0.5` で `mouthOpen(t=0)≈0.5`(9桁)を assert。**旧 delete 挙動との対比**として `onsetFromOpen` 不在時 `mouthOpen(t=0)≈0`(=snap)を並置 assert。
  - `stays within a DERIVED continuity bound across the onset re-attack`: `onsetRange=max(valueRange, from)=0.64` から bound=0.4864 を導出し、re-attack を跨ぐ全 tick で step ≤ bound かつ凸恒等維持。0→snap は 0.5 step で bound を超えるため検出可(非 vacuous)。
- **store**: `group re-attacks from the current effective mouth-open when speech starts mid per-slot drive (§12項目2)`: per-slot で mouth-open を 0.5 に定常駆動 → setSpeech → `atSeam≈0.5`(6桁)かつ **`> 0.4`(0へ snap-down しない証明)**、凸恒等維持、`onsetRange`+dip 導出 bound で継続走査。旧 delete(snap-to-0)との対比コメントあり。
- pure・store 両方で新設され、0 への snap を明示的に排除。

### 観点5: golden・観測値テストの扱い — 適合
- `git diff --stat -- '*golden*.json'` → **空**(physiology golden 不変)。
- テスト内蔵の決定論 golden(`speech-timeline-state.test.ts` の `toStrictEqual` 15行)は git diff で**削除行ゼロ**(既存 Domain A golden 行が無変更で温存され、新テストは追記のみ)。idle 常況 `onsetFromOpen=0` で `lerp(0,sNatural,onset)===sNatural·onset` が旧式と代数一致するため golden 更新不要という Gnome §5 の主張は妥当。意図的置換なし。

### 観点6: 契約無変更 — 適合
- `git status --porcelain -- '**/control-channel/contract/*.json'` → **空**。control-channel の schema/examples 無変更。
- 変更された唯一の contract ファイルは `preload/physiology-bridge-contract.ts`(= physiology tone 橋渡し契約、control-channel intent 契約とは別系統)。diff は純 additive:`PhysiologySectionId` に `"speech"` 追加、`PhysiologySpeechToneField="articulation"` 追加、`PhysiologyToneOverrides.speech?` optional 追加。既存フィールド改変なし。
- **新規 rejection code なし**: `git diff | grep -iE '^\+.*(reject|invalidPayload|rejectionCode|unsupported)'` の唯一ヒットは `reference-driver.mjs` の `speech intent rejected on loop iteration ...`(=クライアント側ドライバのログ文字列。サーバ拒否時のログであって契約語彙ではない)。control-channel validation/拒否語彙は無変更。
- C4/C5/C6 契約 fixture テストは全体スイート内で無変更通過(下記観点7)。

### 観点7: テスト数字の裏取り — 適合(全数字一致)
focused 実行(`vitest run <5 files>`)実測:
| ファイル | Gnome 報告 | 実測 |
|---|---|---|
| speech-timeline-state | 20 | **20 pass** |
| control-channel-overlay-store | 28 | **28 pass** |
| physiology-tone-config | 8 | **8 pass** |
| physiology-state | 11 | **11 pass** |
| physiology-page | 8 | **8 pass** |
| 合計 | 75 | **75 pass** |

全体スイート(`vitest run`)実測: **139 files → 137 passed / 2 failed、919 tests → 917 passed / 2 failed**。Gnome §3 と完全一致。
- 2 fail = `browser-source-server.test.ts` と `stage/browser-source/browser-source-server-message.test.ts`(`effectiveDynamicsTuning`/`runtimeExportStatus` shape 系)。両ファイルとも `git status --porcelain` の変更リストに**不在** = 本波実装で触っていない = 実装前 baseline と同一の既知 fail。Domain E 無関係。

### 観点8: 無変更確認の git 実行 — 適合
- `git status --porcelain -- '**/headless-slot-resolver.ts'` → **空**。
- `git status --porcelain -- 'pnpm-lock.yaml'` → **空**。
- `ls apps/soul/package.json` → **No such file or directory**(不在維持)。
- `physiology-config.ts` diff は純 additive(optional `speech?` 型 + `PhysiologySpeechConfig` 型追加のみ)。`DEFAULT_PHYSIOLOGY_CONFIG` / `DEFAULT_FULL_PHYSIOLOGY_CONFIG` の本体に `speech:` リテラル追加は無し(grep 確認)= DEFAULT 群不変。
- `pnpm install` 未実行(依存追加なし)。

---

## blocking 差分

**なし。**

## non-blocking 観察(参考・修正不要)

1. **観点2 の閾値は振幅(minS)にも比例**する。要求文言の「振幅非依存」は厳密には未達だが、実 swing 量の導出に基づく自己整合な下限で恣意リテラルではなく、freeze 回帰を確実に捕捉する。むしろ floor-only 固定閾値より精密。修正不要。
2. **page 層で Speech スライダーの onChange 配線(`section:"speech", field:"articulation"` の dispatch)は直接 assert されていない**。`physiology-page.test.ts` の `wires tone sliders` は gaze/stagePresence のみを検証。ただし (a) ラベル "Articulation" 描画、(b) キャプション逐語 pin、(c) `physiology-state.test.ts` が `updateTone({section:"speech",field:"articulation"})` → config.speech.articulationFloor まで end-to-end 検証、で機構は共有かつ状態層まで貫通済み。coverage 穴は最小で blocking ではない。将来 lane1(spec)側で page 配線を1本追加する余地はあるが本 lane の判定には影響しない。

## 質問

- なし(Lane2 のスコープ内で判断可能な事項に不足情報なし)。

---

## 結論

**合格(pass)。** ループ1で要修正なし。Domain A の vacuous bound 前科は本波で再発しておらず、連続性ガードは全系統で `bound < valueRange` の gate と実ヘッドルーム assert を備え、凸恒等・非静止・同時ケース re-attack がスライダー両端で導出閾値により検証されている。契約・golden・DEFAULT・resolver・lockfile の無変更、テスト数字(75 focused / 917 全体・既知 baseline 2 fail)を全て自分の実行で裏取り済み。
