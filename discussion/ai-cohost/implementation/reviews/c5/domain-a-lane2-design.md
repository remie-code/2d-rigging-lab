# C5 Domain A レビュー (lane2: design/development)

> Review-Sylph → Orch-Sylph。対象: スロット曲線状態機械 + 実効値フィードバック(案B) + release一般化。ブランチ `feature/2d-rigging-eco-system`、未コミット。
> 自己確認: `git diff HEAD -- apps/runtime-player`、新規 `slot-curve-state.ts`、`control-channel-overlay-store.ts`、`autonomous-frame-heart.ts`、`input-subsystem.ts`、`channel-server.ts`、`runtime-player-main.ts`、写経元 `blink-behavior.ts`、`physiology-generator.ts`、テスト群を Read。typecheck・対象テストを自分で実行。

## 判定: **合格**（design レーンの blocking 問題なし。非blockingのドキュメント微drift 1点を指摘）

---

## design 適合（観点ごと）

### 1. 曲線数学の正しさ — 適合
- smoothstep 写経は `blink-behavior.ts:207-209` と**バイト等価**（`slot-curve-state.ts:66-69` = `const t = Math.min(Math.max(x,0),1); return t*t*(3-2*t)`）。clamp [0,1]・`t²(3-2t)` 一致。blinkEnvelope の close/hold/open+smoothstep 構造が attack/sustain/decay に忠実に対応（`blink-behavior.ts:213-229`）。
- 相境界の値連続を全点検証（`slot-curve-state.ts:112-136`）:
  - attack→sustain: e=attackEnd で `smoothstep(1)=1` → peak、sustain も peak。一致。
  - sustain→decay: e=sustainEnd で decay=`peak·(1-smoothstep(0))=peak`。一致。
  - decay→release: e=decayEnd で decay=`peak·(1-smoothstep(1))=0`、release `releaseFrom = decayMs>0?0:peak = 0`, w=1 → `lerp(base,0,1)=0`。一致。
  - release→done: e=releaseEnd で w=`1-smoothstep(1)=0` → `lerp(base,0,0)=base`、done も base。一致。スパイク無し。
- **ゼロ除算/境界は全経路安全**（分岐ガードが除算の前段でゼロ幅相をスキップする構造）:
  - `attackMs=0`（set退化）: `e < attackEnd`=`e<0` は常に false（e=max(0,…)≥0）→ smoothstep(e/0) を評価せず sustain(peak) へ直行。C4「即peak」外面互換維持。
  - `decayMs=0`: `e < decayEnd`=`e<sustainEnd` は sustain 分岐で消費済み、decay 分岐に入らず → `(e-sustainEnd)/0` を評価しない。
  - `releaseMs=0`（注入時のみ有り得る）: forced では `rel>=0>=0` で即 done、natural では `e<releaseEnd`=`e<decayEnd` に入らず即 done。除算せず即基底スナップ（base があるので破綻せず）。

### 2. release blend の健全性 — 適合
- `lerp(livingBase(t), releaseFrom, w)`, `w=1-smoothstep(rel/releaseMs)`（1→0）。w=0 終端で厳密に `livingBase` 一致 → `snapshot`/`releaseAll` が done エントリを削除（`control-channel-overlay-store.ts:172-174, 138-140`）→ 終端で「生きた基底そのもの」を返してから消えるので**終端スナップ皆無**。テスト `release to the living base` が MOVING base（0.1→0.2→0.3）で終端一致→prune を検証（store test:162-182）。
- livingBase は `#livingBase(slotId)`＝毎tick `snapshot` が受ける `baseValues`（pure activations）から読む凍結でない基底（`control-channel-overlay-store.ts:224-227, 160-167`）。§4 の TARGET=pure、START=resolved 区別が厳密。
- base 欠如フォールバック: `#livingBase` は非有限/欠如を 0 に落とす。forced の `from` は `?? livingBase`（**`??` であり `||` でない** → `forcedReleaseFromValue=0` を保存、`slot-curve-state.ts:102`）。0 を正値として扱う点が正しい。

### 3. 案B フィードバック配線 — 適合
- heart が `resolvedActivations`(`{...activations,...overlay}`) を `lastResolvedActivations` に retain し**次tick**の第3引数へ供給（`autonomous-frame-heart.ts:242-246`）。start/stop で `{}` リセット（:246 リセットは stop 経路 :276 相当、fresh body が stale START を引かない）。
- **エイリアシング破壊なし（要確認だった点を検証）**: `overlay===null` 時 `lastResolvedActivations===activations`（generator.sample 出力）だが、`physiology-generator.ts:72-95` は毎回 `const activations = {}` を新規生成して返すので、次tickの sample() は別オブジェクト。retain した参照が翌tickに書き換わらない → 案Bの「前tick値」が正しく1tick保持される。
- `snapshot(nowMs, baseValues?, prevResolved?)` は任意引数（既定 `{}`, `control-channel-overlay-store.ts:160-164`）。既存 C2/C3/C4 の `(nowMs)=>store.snapshot(nowMs)` provider は型・実行時とも不変（後方互換）。1tick陳腐化は設計裁定通り許容（新intentは WS I/O 非同期到来のため直近 snapshot の `#lastResolved` を START に使う）。

### 4. seam 保存 — 適合
- マージ評価点 `autonomous-frame-heart.ts:243-244` は `overlay===null ? activations : {...activations,...overlay}` のまま（新Record生成、pure `activations` 非破壊）。Stage snapshot :219-223 は pure `activations` を読む位置で不変。`headless-slot-resolver` 呼び出し位置不変。純度境界侵さず。

### 5. 状態機械の健全性（lazy prune） — 適合（リスク低、後述）
- `snapshot`/`releaseAll` の done prune は mutation だが**単調壁時計前提**（Gnome §8）。非単調 nowMs でも**破綻はしない**（clamp が守る）: natural は `e=Math.max(0,nowMs-startAtMs)` で負を 0 に、forced は `rel<0` で `smoothstep` の clamp により w=1（=from 保持）。NaN/throw 無し。唯一の影響は「一度 prune した曲線を過去時刻で再評価できない」だが、実配線（heart の `now()`=壁時計、fixture の単調 tick 列）で発生しない。防御的で妥当。

### 6. C6前方互換（設計§6） — 適合
- `sampleSlotCurve(curve, nowMs, livingBase)` は純関数で、curve は `startAtMs` 起点の相の集合。C6「タイムスタンプ付きエンベロープ断片の列」は `SlotCurveState` を fragment として並べ、同じ純評価で合成できる形。「現在値からの re-attack」(`startValue`) は fragment 継ぎ目の連続性そのものに再利用可能。**one-per-slot は store 側のポリシー**（`#curves: Map`）であって curve プリミティブに焼き込まれておらず、C6 は `sampleSlotCurve`/`smoothstep`/相構造を作り直さずに断片列を載せられる。過度な特殊化なし。§6「作り直さない形」を満たす。

### 7. 命名規律・モジュール境界 — 適合
- curve 系命名徹底: `SlotCurveState`/`SlotCurvePhase`/`SlotCurveSample`/`sampleSlotCurve`/`slotCurveDriveEndMs`。「envelope」は封筒側/契約kind に譲り曲線モジュールで不使用。`RuntimePlayerControlChannelEnvelopeSpec` のみ契約kind `intent.envelope` 境界型として存在（設計§7命名裁量に整合）。
- 境界規律: `slot-curve-state.ts` は**import 文ゼロ**（physiology 非import、smoothstep 3行写経）。store も import は `./slot-curve-state` のみ。physiology 境界の外に留まる。

### 8. コード品質 — 適合
- 型安全: `exactOptionalPropertyTypes` 下でも optional `forcedReleaseAtMs?`/`forcedReleaseFromValue?` は omit（undefined 代入せず）で運用、`!== undefined` ガード（`slot-curve-state.ts:96`）。typecheck pass。
- 重複/複雑性: smoothstep はテストにも同式が複製されるが「写経検証」目的で意図的（境界規律上 export 共有より妥当）。lerp は小関数で可読。分岐は相順で読みやすい。
- 診断 `activeOverlays` は forced-release と release尾部を「driven でない」として除外し `remainingTtlMs = driveEnd - nowMs`（set で C4 `expiresAtMs - nowMs` に一致、`control-channel-overlay-store.ts:189-211`）。Domain C read model signature 不変。

---

## 差分・要修正

**blocking: なし。**

**非blocking（ドキュメント微drift, 任意修正）**:
- `input-subsystem.ts:67` と `:230` のコメントが WS server の書き込みを「`setOverlay` on accept, `clearAll` on disconnect」と記述。C5 で **disconnect は `releaseAll`**（`clearAll` は model unload / export cleared のみ, `runtime-player-main.ts:560/602`）。実装は正しいが**コメントが旧C4のまま**。読者が「disconnect=hard clear」と誤読し得る。次の Domain（または followup）で「`setOverlay` on accept, `releaseAll` on disconnect / `clearAll` on unload」へ更新推奨。挙動には無影響なので今回の合格を妨げない。

---

## リスク評価

- **lazy prune（単調壁時計依存）**: 低。非単調でも clamp により graceful degradation（NaN/throw 無し）、実配線・fixture は単調。Gnome §8 の留意点は正当で、追加防御は不要。
- **案B 1tick陳腐化**: 低。re-attack START が最大1tick(16ms)古い実効値になるが、連続性原則の要件（現在値近傍から立ち上がる=スナップ回避）を満たすには十分。ピーク差の視認限界以下。
- **境界処理（attackMs/decayMs/releaseMs=0, forced from=0）**: 安全。全ゼロ幅相が分岐ガードで除算前にスキップ、`??` による 0 保存を確認済み。
- **release中の moving base とboundの関係（observation, 非blocking）**: continuity 性質テスト（store test:206-241）は**定数 base** で walk するため release 項の base 移動分が 0。実運用では基底(呼吸/瞬き)も動くので、release中の実per-tick差は「曲線step + 基底step」。基底は generator が滑らか(有界)なので合成もスナップしないが、性質テストは「動く基底下の release 連続性」を明示カバーしていない。これは lane1(test adequacy)の守備範囲であり、状態機械の数学的正しさ（release blend式の連続性）自体は正しい。design 判定には影響しない。

---

## 裁量判断の妥当性（Gnome §7）

1. decay→release 順次相（set は decayMs=0 で peak から直接 release blend）: 各境界の値連続を保証、終端は必ず生きた基底追従。**妥当**。
2. 案B を literal 配線（heart が retain・供給、store 自己計算でも等価）: 設計 mental model 忠実。store が唯一のマージ源なので冗長ではあるが、§7-1 の「心臓が供給」に沿う。**妥当**（過剰結合ではない）。
3. set の startAtMs = 直近 `#lastNowMs`、`sustainMs = expiresAtMs - startAtMs` により drive終端=expiresAtMs が startAtMs 非依存 → C4「TTL中の値は同一」外面互換を厳密維持。**妥当**（外面不変の担保が明快）。
4. `activeOverlays.remainingTtlMs = driveEnd - nowMs`、release尾部を診断除外: C4 の `expiresAtMs - nowMs` と set で一致、Domain C signature 不変。**妥当**。
5. `snapshot` 任意引数の後方互換: 既存 provider 無退行。**妥当**。
6. `clearAll` 存置（unload=hard, disconnect=release）: 生きた基底の有無で正しく使い分け（`runtime-player-main.ts:560/602` は teardown 経路と確認）。**妥当**。

---

## テスト / typecheck 結果（自己実行）

- `npx tsc --noEmit`（`apps/runtime-player`）→ **EXIT=0（pass）**。
- `npx vitest run -c vitest.config.ts control-channel-overlay-store autonomous-frame-heart-channel-overlay channel-server input-subsystem reference-driver-sustained-drive` → **6 files / 46 tests passed**（store 13 / heart-overlay 7 / channel-server 8 + events 1 / input-subsystem 16 / sustained-drive 1）。
- continuity 性質テスト（store test:206-241）は bound を曲線パラメータ + 公開 `RUNTIME_PLAYER_SMOOTHSTEP_MAX_SLOPE=1.5` から**導出**しており、マジックナンバー固定閾値は不在。MVT 上界 `f'(c)·Δt ≤ maxSlope·(amp/dur)·Δt` として数学的に妥当。
- Gnome 報告の baseline fail 2件（`browser-source` schema drift）は Domain A 対象外・当該ファイル未変更を git diff で確認済み（本レビューでは再実行せず、対象テスト全 green を確認）。

---

## 質問

なし。design レーンの blocking 問題は検出されず、指摘は非blockingのコメント drift 1点のみ。Orch-Sylph 判断で「合格として次へ」進めて差し支えない。コメント修正は本ドメインの followup か次ドメイン着手時のついで修正で足りる。
