# C4 Domain B レビュー(Lane3: test adequacy)

> Review-Sylph(test adequacy 専任・読み取り専任)→ Orch-Sylph。task=`cohost-c4-overlay-provider`。
> 他2レーン(spec / design)とは統合せず独立評価。判定基準=c4-wave-plan.md §6 Domain B / §8 AC / §10 blocking、c4-control-channel-v0.md §4/§6。
> テストは自分で実行(focused 27 files / 219 tests 全green)。golden無変更を git で確認。

## 判定: 合格

Domain B が固定すべき全テスト要件が実在し、アサーション内容が要件を実際に固定している。偽陰性・flaky 要素は認めない。既知baseline fail は Domain B と無関係。

## テスト結果(自分で実行)

- コマンド: `pnpm -C apps/runtime-player exec vitest run -c vitest.config.ts src/main/role-composition src/main/physiology src/main/control-channel src/runtime-player-boundary.test.ts`
- 結果: **27 files / 219 tests 全passed**(2.68s)。
  - 新規 `autonomous-frame-heart-channel-overlay.test.ts` = 8 passed
  - `input-subsystem.test.ts` = 16 passed(既存13 + C4 seam 3)
  - `autonomous-frame-heart.test.ts` = 15 passed(無変更)
  - `runtime-player-boundary.test.ts` = 5 passed(修正後緑)
  - physiology golden/fixture 群(blink-fixture 4 / physiology-generator 8 = full-generator-snapshot golden含む / blink-behavior 15 / gaze・head・posture・deterministic-noise・physiology-config・physiology-coupling)全passed
- golden 無変更(`git status --short` に golden・physiology/ の変更ゼロ。変更は role-composition の3ファイル + boundaryテスト + 新規テストのみ)。スナップショット再生成なし = **diff ゼロ**。

## 各テスト要件の充足(wave plan §6 Domain B)

### 1. TTL失効(blocking)— 充足
- **明示ttlMs スタイル**: `expires an explicit-ttlMs overlay at receivedAt + ttlMs`(:179-202)。receivedAt(200)+ttlMs(800)=1000 を stamp。wall 999 live / wall 1000 expired を assert。
- **既定窓スタイル(ttlMs省略)**: `expires a default-window overlay (ttlMs omitted)`(:204-228)。`runtimePlayerControlChannelDefaultWindowMs`(Domain A)を import し `0 + defaultWindowMs` を stamp。expiresAtMs-1 live / expiresAtMs expired を assert。**両スタイルが別テストで独立に固定**されている。
- **失効境界(expiresAtMs ちょうど)**: store の `snapshot` は `expiresAtMs > nowMs`(strict)= 直前まで live・ちょうどで失効(store 実装 :54 で確認)。両テストが境界の両側(live 直前 / expired ちょうど)を assert。
- **壁時計 vs logicalTime 誤配線排除**: `judges TTL against the WALL clock, not the generator's logical time`(:230-250)が実在。epoch=1000, expiresAtMs=1200, wall=1300→logical=300。**heart が誤って logicalTimeMs を overlay へ渡していたら 300<1200 で live 判定=ParamEyeLOpen が 1 になり本テストは fail する**設計。実際 heart は `getChannelOverlay(wallNowMs)`(autonomous-frame-heart.ts:222)、generator にのみ `logicalTimeMs`(:200)を渡すことをコードで確認。**偽の緑ではなく、誤配線を実際に落とす real assertion**。

### 2. Recordマージの優先(blocking)— 充足
- `overrides the generator activation for a slotId while the overlay is live`(:123-151)。overlay で左目のみ open、右目は generator baseline のまま=**per-slotId 上書き**を heart tick 経由で観測。
- 失効での生成器値復帰は `falls back to the generator baseline when the overlay expires`(:153-177)で固定(live 400 → expired 600 で両目 baseline)。

### 3. 切断→全失効→基底復帰(blocking)— 充足
- `clears all overlays on disconnect and returns to baseline next tick`(:252-281)。TTL(100000)から遠い long-lived overlay を両目に置いた後 `clearAll()` → 次tickで両目 baseline へ。TTL失効ではなく **clearAll による全失効経路**を独立に固定。

### 4. physiology golden/fixture 全種不変(blocking)— 充足
- git 上 golden・physiology/ 変更ゼロ(上記)。全種の golden/fixture テストを自分で実行し緑。**再生成の書き換えなし**。
- 純度不変テスト `never mutates the generator sample() output (純度維持)`(:283-313)が実在。安定オブジェクト `{ "eye-blink-left": 1 }` を sample が返し、overlay は**異なる slotId**(eye-blink-right)を足す。tick 後に sample 戻り値が `{ "eye-blink-left": 1 }` のまま(overlay key が書き込まれていない)ことを assert。**マージが新Recordを作る**ことを実際に固定(`{ ...activations, ...overlay }` :224 と整合)。real assertion。

### 5. trackingHost にチャネル不在(blocking)— 充足
- `Tracking Host has no Control Channel overlay store (channel = autonomous専有)`(input-subsystem.test.ts:384-395)。`getControlChannelOverlayStore()` が **null** を返すことを固定。実行時 role 分岐でなく合成 data seam(`providesPhysiology` 等と同流儀)であることが構造上明確。

### 6. store インスタンス共有(non-blocking)— 充足
- `Autonomous Host exposes ONE overlay store shared with the heart's overlay provider`(:397-419)。露出 store に `setOverlay` → heart に渡った `getChannelOverlay` が同一値を反映(500/999 live=0.3、1000 で `{}`=境界失効)。**同一インスタンス**を wall-clock 境界込みで固定。
- `Autonomous overlay store is idle at rest`(:421-433)で空 snapshot=C2/C3 baseline も固定。

### 7. 偽陰性・決定論性 — 充足
- 全テストが `nowMs` 注入(`createHarness.setNow` + manual scheduler `fire()`)で駆動。実タイマ・実WS・実ネットワーク待ちゼロ。flaky 要素なし。
- アサーションは全て `toEqual`/`toBe` の実検証(緑だが空、ではない)。特に retirement guard `with the default (null) overlay provider, published values are byte-identical to no channel`(:315-339)が 50フレーム系列を比較し、null provider 経路の C2/C3 バイト等価を固定。
- 報告§6 のフレーク注記(並列フルランで browser-source テストが1度落ちた件)は `broadcast-source`/`stage/browser-source` の話で、**Domain B(role-composition + control-channel + physiology)とは別ファイル・別サブシステム**。focused 実行では全green で再現なし。Domain B と無関係を確認。
- 既知baseline fail(Wave21 browser-source系2件、`effectiveDynamicsTuning` 不一致)も同様に Domain B の対象外ファイル。

## 非blocking 観察(coverage 境界の明確化。修正不要)

- 明示ttlMs / 既定窓の2テストは、どちらも `store.setOverlay(slotId, value, expiresAtMs)` に**計算済みの expiresAtMs を直接 stamp** する。つまり Domain B レイヤ(heart+store)では両者は同一コード経路を通り、区別は「テストが渡す数値」だけ。`ttlMs ?? defaultWindowMs` の**計算そのもの**の網羅は Domain A の `channel-request-dispatch.test.ts`(:94 `computes the overlay expiry from ttlMs`=10_800 / :114 `uses the default window`=11_000)で固定されていることを確認済み。**関心分離として正しく、Domain B にギャップはない**。Domain B の責務(「heart が両スタイルとも expiresAtMs 壁時計で基底復帰する」)は満たされている。Orch は「TTL計算の網羅は Domain A、失効挙動の網羅は Domain B」という分担を認識しておけばよい。

## 質問

- なし(blocking / test adequacy 上の疑義なし)。

## まとめ

Domain B のテストは §6 の6要件(TTL両スタイル・境界・Recordマージ・切断全失効・golden/fixture不変・純度・trackingHost不在)を実アサーションで固定し、特に「壁時計 vs logicalTime」「純度(sample非mutate)」は誤配線を実際に落とす real test である。決定論的で flaky なし。golden diff ゼロ。**判定: 合格**。
