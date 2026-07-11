# C5 Domain C レビュー (lane3: test adequacy)

> Domain: `cohost-c5-stage-presence-effective`（Stage Presence 入力を合成後実効body信号へ差し替え）
> Reviewer: Review-Sylph (lane3 = test adequacy), opus。Orch-Sylph からの委任。読み取り専任。
> 判定基準: c5-wave-plan.md §6/§8/§10・c5-composition-and-envelopes.md §1-1/§5・c5-planning-inventory.md §2.4。
> Gnome 報告(domain-c-report.md)はクロスチェック参照。テストコード・git 差分・実行結果は自分で確認済み。

## 判定: **合格**

blocking 観点（追従の一意性・無退行の機械担保・決定論性）はすべて満たす。カバレッジの穴はあるが全て非blocking。要修正なし。

---

## test 適合（blocking観点ごと）

### 1. 追従テストの一意性（blocking）— 満たす

新規テスト "Stage Presence follows the合成後 effective body signal when a channel drives body"
（`autonomous-frame-heart-channel-overlay.test.ts:487-533`）を自分で読解・実行し追認:

- **実 store 配線 end-to-end**: `storeProvider(store)` で実 `RuntimePlayerControlChannelOverlayStore` を注入。heart tick → `getChannelOverlay(wallNowMs, activations, lastResolvedActivations)` → `store.snapshot` → curve sample → `resolvedActivations` 合成 → Stage snapshot → `getLatestStageMotionSignal()` の実経路を通す。mock 差し込みでない。
- **追従の偽陽性でない（generator が決して出さない値で一意証明）**: generator は body-x を**定数 0.4** のみ emit。channel が `setOverlay(BODY_X_SLOT_ID, 0.9, ...)` で body-x を **0.9** に駆動（generator が出し得ない値）。sustain 中（set curve は attackMs=0、`slot-curve-state.ts:119-121` で sustain 値=peak=0.9）に `horizontal` が **0.9** に追従。Stage snapshot が pure `activations` を読んでいたら 0.4 になり fail する。→ 反証可能な一意証明。
- **無関係 slot が pure のまま（無退行の同時証明）**: body-z は channel 無し → `resolved===activations` で `depth: -0.2`（pure）を維持。同一テストで示す。
- source 側（`autonomous-frame-heart.ts`）も自分で diff 確認: Stage snapshot を merge 前の pure `activations` 読みから、`lastResolvedActivations = resolvedActivations` 直後の `resolvedActivations` 読みへ移設。merge seam（`overlay === null ? activations : {...activations, ...overlay}`）は無変更。裁定1（案B・体は一つ）に整合。

### 2. 無退行の機械担保（blocking）— 満たす

- **C3 既存 Stage テスト（`autonomous-frame-heart.test.ts:479-532`）は無変更で通過**: 当該テストファイルは未コミット diff リストに**存在しない**（`git diff HEAD --name-only` で確認、完全無変更）。overlay provider 非注入 → `overlay===null → resolvedActivations===activations` で snapshot が resolved を読んでも pure を読んでも byte-identical。実行で 15 件 pass。アサーション（0.4/-0.2/1016・null 系）は書き換えなしで通過。
- **strength 凸ゲイン手当て維持**: `deriveStagePresenceStageMotionSettings`（`stage-presence-drive.ts`）は diff リスト外=**無変更**（§2.4 の二重適用手当ては入力出所非依存で保存）。`stage-presence-drive.test.ts`（7件）も無変更 pass。`stage-motion-runtime.test.ts`（7件）も無変更 pass。
  - 注: 委任プロンプト・セッション開始 git snapshot が presence/stage-motion を M と表示していたが、現在 `git diff HEAD` は空（HEAD=C3 commit と一致）。Domain C は触れていない。
- **default(null) byte-identical ガード残存**: "with the default (null) overlay provider, published values are byte-identical" テストは、`getChannelOverlay` 署名変更（`baseValues, prevResolved` 追加）に追随する更新のみで、`emptyStore === noProvider` の byte-identical 比較は維持。ガードの意味は弱まっていない（retirement guard 健在）。

### 4. 決定論性 — 満たす

追従テストの fixture は generator が定数 emit（時刻/乱数非依存）、wall clock は `setNow` で固定注入、scheduler は明示 fire。再現的。

---

## カバレッジの穴（すべて非blocking）

blocking 要件（一意な追従＋無関係slot pure）は満たすが、追従テストは body-x が set-sustain で**静止した 0.9** を追うケースのみを固定する。以下は未カバー（task の blocking 観点3・非blocking可に該当）:

1. **release 中 body slot の中間値追従**: Stage が「blend release で動いている実効値（中間値）」を追うことは Domain C テストでは示していない。追従先が定数でなく時間発展する値でも snapshot が拾うことの直接証拠は無い（curve 側の連続性は Domain A の連続性テストが担保するが、Stage 経路との結合点は未固定）。
2. **body-z 駆動ケース**: depth（body-z）を channel が駆動したときの Stage 追従は未固定（horizontal のみ駆動、depth は pure 側の無退行担当）。BODY_Z_SLOT_ID の追従配線は対称だが機械保証は無い。
3. **両 body slot 同時駆動**: body-x/body-z 同時 channel 駆動時に両軸が独立に実効値を追うケースは未固定。

いずれも「体は一つ」の中核（generator が出さない値への追従）は既に一意証明されているため、無退行を脅かすものではなく、Domain D の統合または将来 wave での追補で足りる。要修正には含めない。

---

## 差分・要修正

なし。

---

## テスト結果（自分で実行・既知baseline分離）

`apps/runtime-player` で実行:
```
npx vitest run -c vitest.config.ts autonomous-frame-heart stage-presence-drive input-subsystem stage-motion-runtime
→ 5 files / 55 tests 全 pass
  - autonomous-frame-heart-channel-overlay.test.ts (10) ← 追従テスト含む
  - autonomous-frame-heart.test.ts (15) ← C3 Stage テスト無変更で pass
  - stage-presence-drive.test.ts (7) ← strength 凸ゲイン無変更で pass
  - stage-motion-runtime.test.ts (7)
  - input-subsystem.test.ts (16)
```
追従テストの追従（horizontal 0.9=実効、pure 0.4 でない）を自分で実行し追認済み。既知 baseline（browser-source 系 2 件・`effectiveDynamicsTuning` schema drift、Wave21）は本レーンの対象スイート外のため未混入。Domain C 由来の新規 fail ゼロ。

---

## 質問

なし。局所差し替え1点で完結し、設計（裁定1・§2.4）に整合。カバレッジ穴3件は非blocking として報告に留め、Domain D 統合時の追補是非は Orch-Sylph/L0 の裁量に委ねる。
