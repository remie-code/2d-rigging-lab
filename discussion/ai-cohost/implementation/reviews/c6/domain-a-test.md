# C6 Domain A レビュー(test-adequacy レーン): 口グループ・タイムライン評価器

> レビュア: Review-Sylph(test-adequacy レーン。Orch-Sylph からのサブエージェント委任)。2026-07-11。
> 焦点: テストが絶対条件(特に凸恒等の全tick性・連続性)を本当に検証しているか / 実行結果の裏取り / 無退行と既知baselineの分類。
> スコープ外(別レーン): AC充足(spec)・設計忠実性(design)。

## 判定(最終・ループ2で合格に転じた)

**合格。** ループ1で唯一 blocking とした「連続性 bound テストが vacuous」は、ループ2のテストのみ修正で**解消**(下記「ループ2 再検証」節)。全7 blocking 観点が満たされた。

---

## 判定(ループ1 時点)

**条件付き合格 — 要修正1件(連続性 bound テストが vacuous、テストのみの修正で完結)。**

- 実装 `speech-timeline-state.ts` は smoothstep ベースで実際に連続であり、凸恒等・ディップ・undershoot・後着置換の各テストは**強く**実装を突いている(トートロジー無し)。
- ただし blocking 観点5(連続性 bound)の2テスト(pure側・store側の両方)は、**導出した bound が全スロットの値域(0.64)を上回るため、実装がどれだけ不連続(スナップ)を起こしても必ず真になる**。連続性(no-snap)という C系列の中核設計原則を、全tickで実際に守る唯一のガードがこれである以上、テスト十分性の欠落として要修正とする。修正は**テストのみ**(実装は正しい)。

## テスト実行の生結果(自分で実行・裏取り)

- 全体: `pnpm run test:unit` → **Test Files 2 failed | 136 passed (138)** / **Tests 2 failed | 879 passed (881)**。Gnome報告(879 pass / 2 fail)と**一致**。
- typecheck: `pnpm run typecheck`(tsc --noEmit)→ **0 error**。Gnome報告と一致。
- 対象2ファイル個別実行: `speech-timeline-state.test.ts` **12 pass** / `control-channel-overlay-store.test.ts` **26 pass**(うち C6 追記は **7** テスト)→ 対象全 pass。
- `pnpm install` は未実行(依存は既存で解決、install 不要)。

### 失敗2件の分類(既知baseline の裏取り)
失敗テスト名(全列挙):
1. `src/main/broadcast-source/browser-source-server.test.ts:150` — 「accepts the not-loaded response shape」
2. `src/stage/browser-source/browser-source-server-message.test.ts:216` — 「accepts the not-loaded response shape」

両者の失敗原因は `effectiveDynamicsTuning: null` という**追加キーによる toStrictEqual 不一致**。この語は committed 済みの `4627bbd [modify]playerでの物理演算調整機能` 由来(`git log -1` で確認)であり、**Domain A の差分とは無関係**。Domain A の作業ツリー差分は `apps/runtime-player/src/main/control-channel/` の2ファイル(overlay-store .ts/.test.ts)+新規 speech-timeline 2ファイルのみで、browser-source には一切触れていない(`git diff --stat` で確認済み)。

- 分類は**妥当**: 2件とも browser-source 系、原因は Domain A スコープ外の committed 機能、Domain A は当該ファイル無変更。
- **新たな退行 fail の紛れ込みは無い**: 失敗は上記2件のみで、control-channel / speech 系テストは全 pass。
- 注記(軽微): Gnome報告は失敗2件を「Wave21 browser-source系」と表記するが、根本原因は「物理演算調整機能(dynamics-tuning)」コミット由来。「browser-source系・実装前baseline・Domain A無関係」という実質分類は正しいが、"Wave21" というラベルは出所が不正確な可能性がある(裁定の要否は Orch へ)。

## 観点別 テスト十分性評価

### 1. 凸恒等 Σvowel=mouth-open「全tick性質」(最重要) — 合格
`speech-timeline-state.test.ts:60-91`。代表フレーズ(全5母音+o×5+onset+終端)を `now=0..lastMs+800` の **4ms 刻み**で全域走査し `vowelSum ≈ mouthOpen`(toBeCloseTo **9桁** ≈ 5e-10)を assert。走査範囲は onset(0-60)・区間内・全境界(140/280/…/1120、いずれも4の倍数で確実にヒット)・o×5連続・終端+release(1660以降の全0域まで)を網羅。単一モーラ・forced release も別途 4ms 走査で恒等を確認。スポット検査でなく真の全tick性質テスト。抜けている時間帯なし。トートロジーでもない(vowel5スロット合計と mouth-open を独立に取り比較。onset を片側にだけ掛ける等のバグは検出可能)。**強い。**

### 2. 再調音ディップの試金石 — 合格
`:129-161`(o×5)。単なる「境界<中央」に留まらず、`atBoundary ≈ atMidBefore × DIP_FLOOR(0.4)`(6桁)で**谷の深さそのものを pin**。さらに 100..560 を 4ms 走査し `max−min > 0.2` で非静止を要求。閾値0.2の妥当性: ディップ有りなら実 range≈0.288、無しなら同母音・同sで mouth-open=s が一定 → range=0。0.2 は両者を確実に分離するので**常真ではない**(甘くない)。0.288 に対しやや余裕はあるが gate として有効。**強い。**

### 3. undershoot / s縮小 / onset / 終端release — いずれも合格
- undershoot `:165-191`: fast(30ms間隔)vs slow(220ms間隔)の a→i→a で vowel-i ピークを走査比較し `peak(fast) < peak(slow)`。固定 attack 実装なら失敗する意味あるアサーション。マジックナンバー無しの厳密比較。
- s縮小 `:195-213`: 無ディップ・onset完了点で mouth-open が **== OPEN_SCALE(0.8) 厳密(9桁)**、かつ全域 ≤ 0.8+1e-9。天井の値と適用を両方 pin。
- onset `:217-228`: t=0 で mouth-open≈0(スナップ無し)、ONSET_MS で >0.1。
- 終端release `:230-244`: hold 直後 >0、hold(=最終区間140)+release(400)後に `done===true` かつ 6スロット全て≈0。いずれも意味ある assertion。

### 4. 後着置換(双方向 + 両生存なし) — 合格
`control-channel-overlay-store.test.ts` C6追記:
- setSpeech→group 専有 `:504`付近: mouth-vowel-a に per-slot envelope(peak 0.9)を先行駆動→ setSpeech 後、同スロットが group値(<0.9)になり恒等成立 → group が専有したことを証明。
- per-slot DURING speech→group forced-release `:527`付近: 発話中に mouth-vowel-a へ per-slot envelope(peak **0.95**)。group は s≤0.8 で 0.95 を作れないため、後に 0.95 が出ること自体が per-slot 後勝ちの**判別子**。加えて release 完了後 mouth-vowel-i / mouth-open が `undefined`(=解放)で mouth-vowel-a のみ残存 → 「1スロット1所有者・両生存の競合なし」を明示検証。**双方向とも強く突いている。**

### 5. 連続性 bound(導出) — 要修正(vacuous)
`speech-timeline-state.test.ts:288-332`(pure)/ overlay-store C6追記の最終テスト(store)。
- **良い点**: bound はハードコード数値でなく `SMOOTHSTEP_MAX_SLOPE`・最短モーラ区間・`DIP_MS`・`ONSET_MS`・`OPEN_SCALE`・releaseMs・frameInterval から導出(マジックナンバー禁止は満たす)。
- **問題(要修正)**: 導出 bound が**全スロットの値域を上回り、テストが実装非依存に常真**。数値:
  - 全スロット最大値 = `OPEN_SCALE(0.8) × maxS(0.8) = 0.64`(s=sRaw·dip·onset·term·SCALE の各因子≤1、sRaw≤maxS。forcedRelease も w≤1 でスケールダウン。天井 0.64 は §5 の s縮小テストとも整合)。
  - pure側 boundPerTick ≈ **0.744**(= (dsPerMs 0.03966 + weightTermPerMs 0.00686) × 16。4つの最悪傾き=cross-fade+dip+onset+release を**同時**に足し上げるため過大)。
  - store側 bound = `(1×1.5/40)×16×2 = **1.2**`(値域の約2倍)。
  - 隣接tick差は必ず `|Δ| ≤ 0.64` なので、`step ≤ 0.744`(pure)/`step ≤ 1.2`(store)は**どんな実装でも(全域スナップを起こしても)必ず成立**。連続性の regression を一切検出できない。
- **なぜ blocking か**: 凸恒等は各tick構造的に成立するためスナップがあっても真、golden は 15 の離散 tick のみ pin(t=15 や 70→140 の間隙は無検査)。よって**全tickで no-snap を守るガードはこの連続性テストだけ**であり、それが vacuous だと「連続性原則」を verify するテストが事実上存在しない。
- **修正方針(テストのみ、実装変更不要)**: bound を値域(0.64)より十分小さくなるよう厳密化する。例: 4つの最悪傾きの同時加算をやめ「実際に最も急な単一区間(=ディップ谷 or 最短クロスフェード)」から per-tick bound を導出する / もしくは「導出 bound < 実観測 max step × 安全係数」かつ「導出 bound < 全域値域」を別途 assert して gate 性を担保する。実測 max step は概ね ~0.17(ディップ 40ms を smoothstep 最大傾き 1.5 で 16ms 刻み)程度なので、値域より小さい bound を導出可能。

### 6. 決定論golden — 合格
`:248-284`。代表フレーズ(全5母音+o×5+onset+終端)を固定15tick(0/30/70/140/210/280/350/490/560/630/700/1120/1200/1400/1660)で `(done, 6スロット)` を 1e-6 丸めで `toStrictEqual` 固定。tick は onset・区間中点(p=0.5)・各種境界・o×5・終端hold・mid-release・done を撃つ。各行が Σvowel=mouth-open を満たす。**強い。**(※これは離散点の pin であり、連続性の代替にはならない — 観点5参照。)

## 甘い/欠落テストの指摘(まとめ)
1. **[要修正] 連続性 bound(pure/store 両方)が vacuous** — 上記観点5。テストのみの修正で解消可能。これが唯一の blocking 級。
2. **[軽微] 再調音ディップの `max−min > 0.2`** — 有効な gate だが実値 0.288 に対し余裕あり。谷深さは別途 `×0.4` で pin 済みなので許容。任意で `>0.25` 等に締められる。
3. **[軽微/報告不整合] Gnome報告のテスト数** — 「C6追加20 tests(store 8)」とあるが実測は **19(pure 12 + store 7)**。同報告内の「baseline 860→879(+19)」は正。数え違い(store は7)。裏取り上の実害なし。
4. **[軽微/表記] 既知baseline を「Wave21」と表記** — 根本原因は dynamics-tuning(`4627bbd`)由来。実質分類(browser-source系・Domain A無関係・pre-existing)は正しい。

## Orch-Sylph への質問
1. **連続性 bound テストの vacuous を「今回 要修正」とするか「持ち越し(既知の緩さ)」とするか** — 実装は正しく、修正はテストのみ。design/spec レーンが連続性を別手段で担保していると判断するなら合格降格も可。test-adequacy 単独判断としては「連続性を verify するテストが実質不在」なので要修正を推す。
2. 上記の軽微3点(ディップ閾値・報告テスト数・"Wave21"表記)は指摘に留め、修正不要でよいか。

---

## ループ2 再検証(連続性 bound の vacuous 修正) — 解消

> 2026-07-11。Gnome がループ2で**テストのみ**の修正を投入。Review-Sylph(test-adequacy)が自分でコードを読み・再実行して裏取り。

### 修正内容(実測確認)
pure(`speech-timeline-state.test.ts:288-337`)・store(`control-channel-overlay-store.test.ts` C6連続性テスト)を同型に締めた。旧「4傾き同時加算」を廃し、**境界で同時に起こりうる支配的2傾き**のみから導出:
- `onsetSlopePerMs = SLOPE / ONSET_MS = 1.5/60 = 0.025`
- `dipSlopePerMs = SLOPE·(1−DIP_FLOOR) / DIP_MS = 1.5·0.6/40 = 0.0225`
- `valueRange = OPEN_SCALE·maxS = 0.8·0.8 = 0.64`(全スロット上限)
- `boundPerTick = valueRange·(onsetSlope+dipSlope)·frameInterval = 0.64·0.0475·16 = **0.4864**`

cross-fade(モーラ間隔 ≥ ONSET_MS で浅い)と terminal release(releaseMs=400 で浅い)は同時最悪化しないとして合成から除外。全項が評価器定数 or タイムライン属性で、**ハードコード閾値なし**。

### 確認点への回答
1. **(a) 定数由来・(b) 値域より小さくゲート機能する** — 両方 YES。
   - (a) SLOPE / ONSET_MS / DIP_FLOOR / DIP_MS / OPEN_SCALE / maxS からの導出。マジックナンバー無し。
   - (b) `expect(boundPerTick).toBeLessThan(valueRange)`(0.4864 < 0.64)を pure/store 両側に追加。これが**キモ**: 導出が万一 vacuous 側(bound≥値域)へ戻れば**このアサート自体が fail** する。かつ walk は `step ≤ 0.4864 < 0.64` なので、**全域スナップ(Δ≈0.64)を起こす実装なら必ず fail** = 真の no-snap ゲートに転じた。
2. **観測値なぞりでない健全ゲート** — YES。
   - `observedMax`(実測 max tick step)を収集し `expect(observedMax).toBeLessThan(boundPerTick)`。実測 ≈ **0.211**、bound = **0.4864** → ヘッドルーム約 2.3倍。bound は観測データからでなく定数から独立に導出され、`0.211(観測) < 0.4864(bound) < 0.64(値域)` の健全な三段に収まる。「実測直上に張り付けて何でも通す」形でも「実測を下回って誤検出する」形でもない。実装が実際に連続(observedMax 0.211)だから pass する構造。
3. **無退行の裏取り(自分で再実行)** — 
   - 対象2ファイル個別: `speech-timeline-state.test.ts` **12 pass** / `control-channel-overlay-store.test.ts` **26 pass**(C6追記7は不変)。
   - 全体 `pnpm run test:unit`: **879 passed / 2 failed**、失敗は既知 baseline の browser-source 系2件のみ(`browser-source-server.test.ts` / `browser-source-server-message.test.ts`、`effectiveDynamicsTuning` 追加キー、Domain A 無関係)。**新規退行 fail なし**。
   - `pnpm run typecheck`: **0 error**。`pnpm install` 未実行。
4. **実装本体が無変更(テストのみ修正)** — YES。
   - `control-channel-overlay-store.ts` 本体差分に bound/slope/frameInterval ロジックは無し(`git diff` の "bound" ヒットは semantic-slots コメントのみ)。差分規模もループ1と同一(+109/−1)。
   - `speech-timeline-state.ts`(新規)評価器コア(318-338 の `s = sRaw·dip·onset·term·SCALE` と相補式 split)はループ1読取り時と**完全一致**。評価ロジックに手は入っていない。

### 結論
連続性 bound テストは **vacuous → 有効なゲート** に転じ、ループ1の唯一の blocking は解消。実装本体無変更・無退行・typecheck pass も確認。**test-adequacy レーンとして合格。**

### 残る軽微指摘(修正不要・記録のみ)
- Gnome報告(ループ1)のテスト数「20/store 8」は実測 **19/store 7**(数え違い。「+19」は正)。
- 既知 baseline を「Wave21」と表記(実体は dynamics-tuning `4627bbd` 由来。実質分類は正)。
