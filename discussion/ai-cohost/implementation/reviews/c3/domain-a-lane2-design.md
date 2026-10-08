# C3 Domain A レビュー: レーン2「design / development」

> レビュー: Review-Sylph、2026-07-11。委任元: Orch-Sylph。対象: `cohost-c3-noise-and-config-seam`（`apps/runtime-player`）。
> 問い: コード設計・実装品質として **正しく・堅牢で・保守可能で・拡張に開かれている** か。

## 判定: **合格**

対象6ファイル（新規2 + 変更3 + テスト）を読み、閉形式ヘルパの数学的主張・config seam の参照比較再構築・タイマーライフサイクル・拡張性・純度構造を検証した。設計品質は高く、ブロッキングな欠陥はない。独立に `vitest run src/main/physiology src/main/role-composition`（**8 files / 68 tests 全パス**）と `typecheck`（**エラーなし**）を再現確認済み。以下は forward-looking な注記（いずれも Domain A の合格を妨げない）。

---

## 観点別の検証結果

### 1. 閉形式ヘルパの正しさ — OK

- **quintic smootherstep の妥当性**: `smootherstep(t)=t³(t(6t−15)+10)`。導関数 `30t²(t−1)²` は `[0,1]` 上で t=0.5 最大 = 15/8 = 1.875（`SMOOTHERSTEP_MAX_SLOPE` と一致）、両端で 0。よってラティス点で1次導関数ゼロ→ C¹（速度キンク無し）。cubic 採用しない理由の docstring も正確。**採用は妥当**。
- **adjacent-difference 境界**: value-noise `a+(b−a)·s(frac)` の時間微分は `(b−a)·s'(frac)/cellMs`。`|b−a|≤2=NOISE_SPAN`、`|s'|≤1.875` なので大域 Lipschitz 定数 = `NOISE_SPAN·SMOOTHERSTEP_MAX_SLOPE/cellMs`。導関数がセル境界で連続（quintic）ゆえ **dt がセルをまたいでも境界は成立**。`deterministic-noise.test.ts:69,77` の主張は解析的に正しい。
- **layered 合成の正規化 [-1,1] 維持**: `sum/weight`、各 octave ∈[-1,1]、weight = Σ|amplitude|。凸結合なので出力 ∈[-1,1]。`Math.abs(layer.amplitude)` で weight/係数の双方を取るため負 amplitude は絶対値化（符号反転で層を打ち消せない）＝防御的で安全。`weight>0` ガードで空集合/全ゼロ→0（home）。**正しい**。
- **`homeSpringValue` のホーム引き戻し**: `shaped = sign(d)·|d|^(1+2·homePull)`、`homePull∈[0,1]`。`|d|≤1`（layered出力）なので指数≥1で `|shaped|≤|d|`（**全点非増幅**）、`sign` 保存、`d=±1→±1 / d=0→0`（**端点・home保存**）。導関数 `(1+2h)|d|^(2h)` は有界（C¹）。よって範囲 `[home−amplitude, home+amplitude]`。homePull は `Math.min/max` でクランプ。**主張どおり成立**。
- **セル境界連続性**: 境界下側 frac→1→b（cell i0）、上側 frac=0→a'=`hashUnit(seed,i0+1,·)`＝前セルの b。連続。`smoothValueNoise` の `Math.floor` は負時刻でも正しい floor を返す（heart 側で ≥0 クランプ済みだが本体単体でも破綻なし）。
- **数値破綻**: `safeCellMs = cellMs>0?cellMs:1`（0/負/NaN を吸収、ゼロ除算なし）。`hashUnit` の `>>>0` で [0,1]、`·2−1` で [-1,1]。NaN/オーバーフロー源なし。**問題なし**。

### 2. config seam の堅牢性 — OK

- **tick毎 provider読み + 参照比較**: `autonomous-frame-heart.ts:143-147`。`config !== heartbeat.config` のときのみ `buildGenerator(heartbeat.seed, config)`。参照安定時は再構築なし（default provider は定数を返す→毎tickコストは関数呼び出し+参照比較のみ、再構築ゼロ）。`autonomous-frame-heart.test.ts:394` が「安定時 build 1回・変化時 +1・再安定で据え置き」を固定。**無駄な再構築なし**。
- **seed保持**: 再構築は `heartbeat.seed`（不変フィールド）を渡す。テスト `built[0].seed===built[1].seed===55` で固定。**OK**。
- **fallback = C2挙動**: `getPhysiologyConfig ?? (()=>DEFAULT_PHYSIOLOGY_CONFIG)`。`DEFAULT_PHYSIOLOGY_CONFIG.blink = DEFAULT_BLINK_BASELINE` + identity modulation なので `physiologyConfigToBlinkConfig(default)` は `DEFAULT_BLINK_CONFIG` と deep-equal（`physiology-config.test.ts:38`）、golden byte-identical（`:93`）。heart レベルでも fallback == 明示default provider の publish 系列一致（`autonomous-frame-heart.test.ts:448`）。**退行ゲート成立**。
- **exactOptionalPropertyTypes 対応**: `input-subsystem.ts:184` の条件スプレッド `...(provider!==undefined ? {getPhysiologyConfig:provider} : {})` は `getPhysiologyConfig: undefined` を渡さず**プロパティごと省略**。正しい。テストの `toEqual({...,getPhysiologyConfig:undefined})` は vitest が undefined プロパティを欠損と等価扱いするためパス（実際の呼び出し引数はキー自体が無い）。**整合**。

### 3. タイマー/ライフサイクルの健全性 — OK

- **冪等・二重化なし**: `start` は先頭で `stop()`（timer clear + heartbeat=null）。`stop` は `timer!==null` ガードで冪等。`clearRuntimeExport`→stop、`disconnect`→stop。`autonomous-frame-heart.test.ts:308,341` と fake-timer `:481`（`getTimerCount` 0→1→0）で load→load/stop/quit を固定。**残留・二重タイマーなし**。
- **tick内安全性**: 先頭 `if(heartbeat===null) return;`（stop後の残留fireを無害化、テスト `:363`）。`logicalTimeMs = Math.max(0, wallNow−epoch)`（逆行クロック吸収）。**null/負時刻ガードあり**。

### 4. 拡張性 — OK

- `PhysiologyConfig` は `blink` のみ + optional-open 設計（docstring明記）。Domain B は `gaze?`/`head?`/`posture?` を追加、`createPhysiologyBehaviorsFromConfig` に fan-out を足すだけで既存 blink 経路不変。ヘルパは層数非依存（`NoiseLayer[]` 受け）で 3層比を behaviors 側に委ねられる。**Domain B が素直に乗る**。
- `schemaVersion` を先出し（Domain C の stale拒否）。provider が「変化時のみ新参照」を返す契約が immutable revision state に自然に噛む（reference-swap 再構築）。**Domain C の差し替えが構造的に成立**。

### 5. 命名・重複・単純化 — OK

- `deterministic-hash.ts`（seed→[0,1] の原子ハッシュ）と `deterministic-noise.ts`（時間の閉形式ノイズ/バネ）の責務分担は明快。noise は hash を再利用し新規乱数を導入しない。デッドコード・重複なし。定数（`SMOOTHERSTEP_MAX_SLOPE`/`NOISE_SPAN`/`LAYER_CHANNEL_STRIDE`/`SPRING_EXPONENT_GAIN`）は命名済みでテストが解析境界に対して assert。**単純化余地なし**。

### 6. 純度の構造的担保 — OK

- `blink-behavior.test.ts:222` の純度構造テストは `readdirSync(here)` で physiology/ の `*.ts`（非test）を**動的列挙**し、Electron/壁時計(`Date.now`/`performance.now`/`new Date`)/`Math.random`/crypto を禁止。新規2ファイルも自動的にスキャン対象。両ファイルとも壁時計・非シード乱数ゼロ。**カバレッジが新規に及ぶ**。

---

## 注記（Domain A の合格を妨げない forward-looking 事項）

1. **tick内再構築が新たな throw 面を生む（→ Domain C 申し送り）**: C2 では generator 構築は `start()`（caller制御）のみだったが、本変更で `tick()`（setInterval コールバック）内でも `buildGenerator` が走り得る（`autonomous-frame-heart.ts:146`）。malformed config を provider が新参照で渡すと例外が timer コールバックを脱出し、Node ではプロセスクラッシュ面になり得る。Domain A の default provider は定数を返し throw しないため**現時点では非該当**だが、Domain C は「provider が新参照を出す前に schema 検証を完了させる（schemaVersion 不一致は provider 側で reject し古い有効 config を保持）」ことを申し送りに含めると堅牢。設計は位相不連続を許容するのみで tick の try/catch を要求していないため、現実装は合理的。

2. **`layeredValueNoise` の負 amplitude 絶対値化（軽微・設計未定義の合理的実装）**: `Math.abs(layer.amplitude)` により負の weight は絶対値化され、層の符号反転はできない。weight としての意味論（docstring）に整合し、負 weight による weight和ゼロ/符号破綻を防ぐ防御として妥当。Domain B が層を減算合成したい場合は API 拡張が要る旨だけ認識しておけばよい（現状の質感語マッピングでは不要）。

3. **大 channel 値の mod 2^32 縮約（無害）**: `layerChannel = channel*977+index` を `hashUnit` に渡す経路で、極端に大きい channel は imul で 2^32 に縮約される。現実的な behavior/層数では衝突せず decorrelation は保たれる。相関上の懸念なし。

## 質問（Orch/ユーザー判断が要る点）

なし。design/development レーンの観点はコードで解消済み。注記1のみ Domain C 着手時に申し送りへ反映することを推奨（Domain A のスコープ外・ブロッカーではない）。
