# C5 Domain A レビュー (lane3: test adequacy) — スロット曲線状態機械

> Review-Sylph (test adequacy) → Orch-Sylph。対象: 未コミット作業ツリー (`git diff HEAD`, 9ファイル)。
> 判定基準: [c5-wave-plan.md](../../orchestration/c5-wave-plan.md) §6/§8/§10・[c5-composition-and-envelopes.md](../../architecture/c5-composition-and-envelopes.md) §3/§5/§7・[c5-planning-inventory.md](../../orchestration/c5-planning-inventory.md)。
> 全主張を自分でコード確認・テスト自走・数学検算した(Gnome報告は鵜呑みにしていない)。

## 判定: **合格**（2つのblocking目玉は完全にクリア。coverageの穴は非blockingの推奨事項として付記）

blockingの目玉——(1)連続性boundの導出性(マジックナンバー不在)・(2)C4後方互換の機械実証——は両方とも根拠つきで満たされている。曲線の性質テストは「通ればよい」でなく「正しい性質」を実際に証明している。残る指摘はいずれも連続性性質テストの**適用範囲の狭さ**(1経路のみフル走査)で、機構が共有コードなので退行リスクは低い。

---

## test 適合(観点別)

### 観点2(最重要): 連続性boundの導出性 — **合格・検算済み**

- **`RUNTIME_PLAYER_SMOOTHSTEP_MAX_SLOPE=1.5` の数学的正しさ**: 自分で検算。`smoothstep(x)=x²(3-2x)=3x²-2x³`、導関数 `f'(x)=6x-6x²=6x(1-x)`、最大は `x=0.5` で `6·0.5·0.5=1.5`。**正しい**。定数は `slot-curve-state.ts:33` で export され、両性質テストが import して参照(store test:7, heart test:12)。
- **bound がパラメータから導出されているか**: `bound = max(attackStep, decayStep, releaseStep)`、各 step = `|amplitude|/duration × MAX_SLOPE × frameIntervalMs`(store test:218-230, heart test:302-314)。全因子が曲線パラメータ(`spec.peak`/`spec.attackMs`/`spec.decayMs`/`releaseMs`定数/`frameIntervalMs`)。**固定閾値(マジックナンバー)は不在**。平均値の定理 `step = f'(c)·Δt ≤ MAX_SLOPE·Δt` が根拠として正しい(相内は単調smoothstep、相境界は値連続なので追加スパイク無し)。
- **bound が緩すぎないか(スナップ見逃し検証)**: 自分で実測。attackMs=100/peak=0.8/Δt=16 のとき、x=0.5 を跨ぐtick(e=48→64)の実step ≈ **0.1876** に対し bound = **0.192**。頭上約2%——**ほぼタイトな真の上界**。真のスナップ(1tickで0.8跳躍)は 0.192 で確実に捕捉し、かつ緩すぎて中程度の不連続を見逃す余地もない。良好。
- **相境界の値連続**: 自分でコード確認(`slot-curve-state.ts:112-136`)。attack終端=peak=sustain始端、sustain終端=peak=decay始端(`1-smoothstep(0)=1`)、decay終端=0=release始端(`releaseFrom=0`, `w=1`)。すべて連続。setの `decayMs=0` では release が `releaseFrom=peak` から直接base——`sampleSlotCurve` release分岐は単一smoothstep blendなので数学的にスナップ不能。

### 観点1: 決定論fixture — **合格**

`control-channel-overlay-store.test.ts` は「インテント列(受理時刻付き)+tick列[+baseValues列]→出力Record列」を純評価(WS/timer無し)で固定。smoothstep形状(:115-124)・相境界 attack→sustain→decay→release(:126-140)・re-attack起点(:142-159)を実際にpin。時刻依存・乱数依存なし、再現的。

### 観点3: release が生きた基底へ収束(終端スナップ無し) — **合格(setで実証)**

`control-channel-overlay-store.test.ts:163-182` が **base を毎tick動かす**(0.1→0.2→0.3)ケースで、終端で凍結0でなく現在base 0.3 を追い、直後pruneで連続hand-off(スナップ無し)を実証。裁定2「凍結不採用」の核心を突いている。※ただし envelope経路(`releaseFrom=0`)の**動く**基底収束は未走査(下記coverageの穴)。

### 観点4: set の退化エンベロープ化の外面互換 — **合格**

`control-channel-overlay-store.test.ts:24-32`(TTL中の値は同一・byte-identical)。裁量判断#3の「driveEnd=expiresAtMs は startAtMs非依存」を自分でコード検証: `sustainMs=expiresAtMs-startAtMs`, `driveEnd=startAtMs+0+sustainMs+0=expiresAtMs`——始点に不変。失効時のみ snap→release差分(:34-54)。`activeOverlays` の `remainingTtlMs=driveEnd-nowMs` が C4 の `expiresAtMs-nowMs` と一致(:85-108)、release尾部は診断除外。C4互換維持。

### 観点5: 切断→全スロット同時release — **合格**

store層 `releaseAll`(:184-203, 2スロット同時に現在値からrelease→400ms後gone)、心臓層(`autonomous-frame-heart-channel-overlay.test.ts:236-277`, 両目が中間値0<x<1を経て基底へ)、server層(`channel-server.test.ts:198-208`, disconnect→easing→release窓後 `{}`)。3層で確認。`channel-server.ts` diff で `clearAll()→releaseAll(this.#nowMs())` 置換を確認、`clearAll` は model unload 用に存置(裁量判断#6, 妥当)。

### 観点6: C4後方互換の機械実証 — **合格(置換10件を1件ずつ吟味)**

置換テスト10件を全件精査。**すべて「即時スナップ固定→release挙動」への正当な置換で、退行のrelease偽装は無い**。各置換は元テストのload-bearingな性質を保存し、多くはむしろ強化されている:

| # | テスト | 元が固定した性質の保存 | 判定 |
|---|---|---|---|
| 1 | heart "eases set…(失効)" | 失効境界で値がまだ present(スナップ否定)+中間値0<x<1+400ms後基底 | 正当・強化 |
| 2 | heart "WALL clock判定" | **wall vs logical の証明を維持**(logical時間なら=1のはずを reject)。release境界をwallで判定 | 正当・性質保存 |
| 3 | heart "clearAll snap→releaseAll" | 全スロット中間値0<x<1(スナップ否定)→400ms後基底 | 正当・強化 |
| 4 | heart continuity(新規) | 導出bound walk(attack→release) | 追加(退行でない) |
| 5-6 | store "TTL expiry / omits at expiry" | 失効で present継続+release中間値+窓後 `{}` | 正当・強化 |
| 7 | channel-server "writes overlay" | 失効で present継続(0.4)→release窓後 `{}` | 正当 |
| 8 | channel-server "on disconnect" | `releaseAll` easing(0<x<0.4)→窓後 `{}` | 正当 |
| 9 | input-subsystem "shared provider" | drive境界でrelease進入→窓後(1400) `{}` | 正当 |
| 10 | reference-driver `delay(120)→delay(600)` | release 400ms待ち後の基底観測。**残りの統合assertionは無変更で通過** | 正当 |

- 置換理由は Gnome報告§4 に表で明記(テストコメントにも §2.3 参照つき)。命名規律§7遵守を満たす。
- **無変更で通過すべき既存テストの確認**: `activeOverlays` 診断・`channel-bridge-handlers`・`with the default (null) overlay provider byte-identical`(heart test:360-388, C2/C3純路の退行ガード)が全green。additive後方互換を機械実証。

### 観点8: 決定論性 — **合格**

全fixtureが単調 nowMs列・固定seed・手動scheduler(`vi.fn`)で時刻注入。乱数・実時計依存なし。Gnome報告§8の「非単調 nowMs での lazy prune 依存」は、現行fixture・実配線とも単調壁時計を守るため実害なし(留意点として妥当)。

---

## カバレッジの穴(非blocking・推奨)

連続性の**性質テスト(隣接tick差≤bound の全走査)**は、**envelope 1経路**(attack→sustain→decay→release, base一定)でしかフル走査されていない。他の遷移点は「中間値 0<x<1」等の**点検査**に留まる。機構は `sampleSlotCurve` の共有分岐なので退行リスクは低いが、blocking観点2の「**全遷移点**でbound検証」に対し形式上の穴:

1. **re-attack seam の bound走査が無い**。store test:142-159 は再attack点で `after≈before`(スナップ否定の点検査)は確認するが、re-attack を**跨ぐ隣接tick列**のbound walkが無い。重ねがけ(手動ゲートの目玉③)の機械保証がやや薄い。→ 推奨: 途中で新envelopeが来る tick列を、瞬間ごとの導出boundで walk。
2. **envelope release の「動く基底」収束が未走査**。観点3は**set**では動くbaseで実証(:163)だが、envelope(`releaseFrom=0`)経路の動くbase収束・終端スナップ否定は未テスト(heart test:279 は base一定=1)。→ 推奨: envelope の decay→release→terminal を base可変で1本。
3. **releaseAll(切断)の per-tick bound走査が無い**。中間値点検査(heart:261-268)はあるが隣接tick差の性質テストは無い。forced-release分岐は単一smoothstep blendで数学的に安全だが、blocking観点2の「切断で検証」は点検査止まり。
4. **未テストの退化相**: `sustainMs=0`(attack直後にdecay)・`peak=startValue` の no-op・**release途中に新intent到達(release中re-attack)**。特に3つ目は手動ゲート重ねがけで起こりうる。機構上は `setEnvelope` が forcedRelease無しの新stateで上書きし `startValue=prevResolved`(releasing値)から再attackするので健全だが、未実証。→ 推奨: release中re-attackの連続性を1本。
5. **re-attack を心臓の実フィードバックループ(案B retention)で通すend-to-endが無い**。store層は prevResolved を手動注入して検証、heart は baseValues/prevResolved の配線を検証するが、**重なるintentの再attack連続性を heart の `lastResolvedActivations` retain 経由で**通す統合テストが無い。案B の load-bearing 経路なので1本あると安心。

いずれも「機構が共有・数学的にスナップ不能」ゆえ**blockingにはしない**が、§6「re-attack/失効/切断すべての遷移点で」導出bound性質テスト、を文字通り満たすには 1・3 の追加が望ましい。

---

## 差分・要修正

なし(blocking無し)。上記coverageの穴は推奨(Domain B/Dで拾うか、Orch判断でDomain Aに1-2本追加)。

## テスト結果(自走)

- Domain A対象5ファイル: `npx vitest run -c vitest.config.ts control-channel-overlay-store autonomous-frame-heart-channel-overlay channel-server input-subsystem reference-driver-sustained-drive` → **6 files / 46 passed**(store 13 / heart-overlay 7 / channel-server 8+events1 / input-subsystem 16 / reference-driver 1)。
- 全体 `npx vitest run -c vitest.config.ts` → **828 passed / 2 failed / 136 files**。
- **既知baseline fail 2件を自分で分離確認**: `stage/broadcast-source/browser-source-server.test.ts:150` と `stage/browser-source/browser-source-server-message.test.ts:216`、いずれも `effectiveDynamicsTuning` の schema drift(dynamics-tuning応答形状)。overlay/曲線と無関係。`git diff --stat` で変更9ファイルを確認、browser-source系は**一切含まれない**→ Domain A無関係を機械確認。委任の「既知baseline=Wave21 browser-source系2件」に一致。
- smoothstep max slope の独立検算(python): `6·0.5·(1-0.5)=1.5` → 定数一致。

## 質問

1. coverageの穴 1(re-attack seam のbound走査)と 3(releaseAll のbound走査)は、blocking観点2の「全遷移点で検証」の文言に対し点検査止まり。**Domain A に property test 2本を追加委任するか / 手動ゲート(重ねがけ・魂殺し)+機構共有性で足りると裁定するか**を Orch/L0 で判断されたい。私見: 機構が単一 `sampleSlotCurve` 分岐で数学的にスナップ不能、かつ手動ゲートが実駆動で重ねがけ・切断を目視するため、追加は「望ましい」止まりで合格を妨げない。
2. envelope の decay が **base非依存に0へ**落ちる(`slot-curve-state.ts:124`)ため、livingBase≠0 のスロットでは decay が base下へ潜り release で戻す挙動になる(裁量判断#1)。これは設計(lane2)寄りの論点だが、test adequacy視点では**この非零base×envelope decay の相互作用が全く未テスト**。連続性は保たれる(release blendが吸収)が、意図どおりか lane2/設計で確認されたい。
