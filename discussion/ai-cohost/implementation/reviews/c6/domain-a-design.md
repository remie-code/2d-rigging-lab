# C6 Domain A レビュー(design レーン): 口グループ・タイムライン評価器

> レビュアー: Review-Sylph(design レーン=設計討議への忠実性・数学的健全性・命名規律)。2026-07-11。
> 判定基準: `discussion/ai-cohost/architecture/c6-mouth-phoneme-timeline.md`(§2/§3/§3.5/§4/§7)、`c6-planning-inventory.md`(§2.2/§2.3/§2.4/§2.8、§4末尾)、Gnome 完了報告 `waves/c6/domain-a-report.md`。
> 対象: `speech-timeline-state.ts`(新規・数式本体)/`control-channel-overlay-store.ts`(統合・調停)/比較用 `slot-curve-state.ts`。
> 手法: 数式をコードで追い代数検算。golden 2行(t=70/t=280)を手計算で照合。undershoot テストの機序を追跡。**読み取りのみ**(ソース無変更)。

---

## 判定: **合格(条件付き)**

design レーンの核心である **相補式の凸恒等・再調音ディップの連続性・時間仮説・命名規律・非露出・写経・bound導出** は、すべて設計討議・棚卸しの意図どおり数学的に正しく実装されている。**blocking な数学的欠陥は無い。**

ただし観点5(後着置換)の **direction (a)(setSpeech が既存の口 per-slot 駆動を置換する向き)** に、Gnome が §5-5 で自認する裁量があり、これが設計 §7裁定3「**release経由で置換**」「re-attack規則のグループ拡張」から**稀な同時発生ケースで逸脱**する。これは数学的欠陥ではなく設計方針の判断事項なので、**Orch-Sylph/Undine の裁定を要する**(下記「裁量判断への評価」)。裁定が「連続性原則は同時発生ケースでも不可侵」となれば要修正、「稀ケースは比較ゲートに委ねる」となれば現状可。判断材料を全て下に記す。

---

## 観点別の適合/差分(コード位置・式つき)

### 観点1: 相補式の凸恒等の構造保証 — **適合(最重要、恒等成立)**

`sampleSpeechTimeline`(speech-timeline-state.ts:320-335):

```
s = sRaw · dip · onset · term · OPEN_SCALE            (:321, 単一スカラ)
values[mouth-open] = s                                (:324)
values[prevSlot] += s·(1−p)                           (:334)
values[nextSlot] += s·p                               (:335)   他母音 = 0 (:325-329)
```

- prev≠next: Σvowel = s(1−p) + s·p = **s** = mouth-open。恒等式。
- prev==next(同母音連続): 初期0 → `+= s(1−p)` → `+= s·p` = s(1−p)+s·p = **s**。加算縮退が安全(:334-335 の `?? 0` 付き累積)。
- **後段補正・正規化・Σ検証代用は一切無い**(コードを全走査。`Σ` を計算して合わせる箇所は存在しない)。恒等は**構造**で立つ。
- dip/onset/term/OPEN_SCALE は分配**前の単一 s** に畳まれる(:321)ので、どれも恒等を破壊しない。
- 手計算照合: golden t=70(区間[0,140] a→i, p=0.5, sRaw=0.7, dip=onset=term=1, SCALE=0.8 → s=0.56, a=i=0.28)= golden 行一致。golden t=280(境界, p=0, sRaw=0.5, dipLeft=0.4=floor, s=0.16, u=0.16)= 一致。
- テスト(:59-92)は全tick(4ms刻み)で `Σvowel ≈ mouth-open`(浮動小数許容 9桁)を assert。float の ULP 残差は許容誤差で吸収され、**恒等は構造由来**(検証代用ではない)。適合。

### 観点2: 時間仮説の忠実性 — **適合(1点、機序の注記あり)**

- **attack≈モーラ間隔(動的)**: `interval = t1−t0`、`frac = (e−t0)/interval`、`p = smoothstep(clamp01(frac))`(:275-277)。クロスフェード長=区間長。固定 attackMs も payload の attack フィールドも無い(SpeechMora = {timeMs,vowel,s} のみ、:32-36)。§3.2 の帰結どおり。適合。
- **s縮小係数**: `OPEN_SCALE=0.8`(:77)を単一 s に一律乗算(:321)。§7裁定5 の「非露出普遍既定0.8前後」に一致。適合。
- **定常ブレンド表を持たない**: lookup テーブル無し。全て p と s から計算。適合。
- **注記(逸脱ではないが機序の実態)**: 設計 §3.2 は undershoot を「attack≈モーラ長のクロスフェードが**届く前に折れる**」機序で説明するが、実装の p は **区間長で正規化**されるため各区間で必ず 0→1 完了する(横方向=母音重みは区間長に依らず同じ p 曲線)。実際に「fast の頂点が低い」を生むのは **再調音ディップの重なり**(区間<2·DIP_MS で dip が中央で1へ回復しきれず s を抑圧)と onset である(undershoot テスト :164-192 を手追跡で確認。fast の vowel-i ピーク≈0.14 < slow≈0.68、差は dip重なり+onset由来)。ただし **§7裁定2 が相補式を `p=smoothstep(区間内進行)`・`s=lerp(s_i,s_{i+1},p)` と正規化形で明示的に裁定**しており、実装はこの**拘束力ある裁定に厳密一致**する。§3.2 の散文が想定した undershoot 源が dip に移っているだけで、**設計の目標(頂点に到達しない・混合が残る=100%形にならない)は達成**(境界=ディップ底で純母音重みだが低振幅、中央=高振幅だが混合。純母音・全開は構造的に不到達)。裁定2 準拠のため blocking にせず、機序の実態のみ記録。

### 観点3: 再調音ディップ(§3.5)の忠実性 — **適合(全境界連続を代数確認)**

- **深さ・時間**: `DIP_FLOOR=0.4`(:86, ~40%)、`DIP_MS=40`(:97, 30〜50ms範囲内)。適合。
- **s への乗算で凸恒等無傷**: dip は単一 s の因子(:321)。適合。
- **全モーラ境界で連続(代数検算)**: `dip = min(dipFactor(e−leftBoundary), dipFactor(rightBoundary−e))`(:312-315)。境界 T=t1(i)=t0(i+1) を挟んで:
  - 左から(区間[i,i+1], e→T⁻): dipRight=dipFactor(T−e)→dipFactor(0)=**0.4**、dip=min(≥0.4, 0.4)=0.4。
  - e=T で index ループ(:247-254)が i+1 へ進む(`next.timeMs > e` が偽)。
  - 右から(区間[i+1,i+2], e→T⁺): dipLeft=dipFactor(e−T)→dipFactor(0)=**0.4**、dip=min(0.4, ≥0.4)=0.4。
  - **両側 0.4 で連続**。加えて sRaw も連続(左 p→1: lerp(s_i,s_{i+1},1)=s_{i+1}; 右 p→0: lerp(s_{i+1},s_{i+2},0)=s_{i+1})、重みも連続(両側とも共有母音 v_{i+1} が s を担い他0)。**s も個別母音値も境界で連続**。
  - **区間長<ディップ窓**: dipFactor は dtMs で連続、min も連続 → 区間内連続。上記境界連続と合わせ任意区間長で連続。適合。
  - **終端境界**(最終モーラ, next=undefined, dipRight=1, :313-314): 左から dipRight→0.4、右(terminal)から dipLeft=dipFactor(0)=0.4 → 両側 0.4 で連続(代数確認)。適合。
- **「のところど」非静止の数学的保証**: 同母音 o×5 でも各境界で dip=0.4、中央で 1.0 へ回復 → mouth-open が拍ごとに振動。dip=min(左右ramp) が境界に底・中央に山を構造的に持つため凍らない。テスト(:128-161)が boundary<mid・boundary≈mid×0.4・max−min>0.2 を assert(手計算とも整合)。適合。

### 観点4: C5相乗りの正しさ(§4) — **適合**

- smoothstep を**写経**(:143-146、slot-curve-state.ts:79-82 と同一実装)、`import` は `RUNTIME_PLAYER_SLOT_CURVE_DEFAULT_RELEASE_MS` のみ(:23)。physiology/ 非 import。適合。
- グループ評価器は per-slot `SlotCurveState` とは**別種のエントリ** `#speech: SpeechTimelineState | null`(store:89)として `#curves` Map と並存。棚卸し §2.2 候補iii どおり。適合。
- 心臓 cadence・マージ seam 無改造: snapshot(store:226-261)が返す Record に6値を載せるのみ(:240-250)。心臓 `autonomous-frame-heart.ts`/`input-subsystem.ts` は無変更(報告§1と整合、seam は既存の `{...activations, ...overlay}` を流用)。適合。
- release-to-living-base: `#forceReleaseSpeech`(store:316-334)が per-slot forced release と同型。`baseFor` 注入可(speech:139)。適合。
- **注記(forced-release 恒等の前提)**: forced-release 枝(:219-232)は `values[slot]=lerp(base, from[slot], w)`。Σvowel=mouth-open が保たれるのは **全口スロットの base=0** の場合(`Σ lerp(0,V,w)=w·ΣV=w·openV=lerp(0,openV,w)`、:216-218 コメント)。棚卸し §2.8 が「生理は口を産まない=mouth base 0」を grep 0件で接地しているため実運用で安全。仮に非0 base が注入されると forced-release 中に恒等が崩れうるが、これは §2.8 の構造保証下では発生しない。潜在前提として記録(欠陥ではない)。

### 観点5: 後着置換(§7裁定3)の設計整合 — **direction (b) 適合 / direction (a) 裁量(要裁定)**

- **direction (b)(発話中に per-slot が口スロットへ到来)**: `#yieldSpeechForSlot`→`#forceReleaseSpeech`(store:304-334)。グループを forced-release(全6→base へ ease)、per-slot が prevResolved から re-attack で連続引き継ぎ。**「release経由」「re-attack規則のグループ拡張」に忠実**。適合。
- **競合の構造排除**: マージ順「グループ先(:240-250)→per-slot後(:252-259)」で共有スロットは per-slot が決定論的後勝ち。同一スロットを両者が曖昧に駆動する状態を作らない。store内1箇所(setSpeech / #yieldSpeechForSlot)で調停。適合。
- **direction (a)(setSpeech が既存 per-slot 口駆動を置換)**: `setSpeech` が口6スロットの per-slot 曲線を **delete**(store:174-179)。Gnome の裁量(報告§5-5)。→ 下記「裁量判断への評価」。

### 観点6: 命名規律 — **適合**

- モジュール名 `speech-timeline-state`(グループ側)vs `slot-curve-state`(per-slot=curve)。型 `SpeechTimelineState`/`SpeechMora`、関数 `sampleSpeechTimeline`、定数 `RUNTIME_PLAYER_SPEECH_*`。**自モジュールの状態を "curve" と呼ばない**(:14-15 の "curve" は per-slot 側への参照のみ)。`slot-curve-state.ts` は "speech"/"timeline" を持たない(無変更)。棚卸し §4末尾「timeline/speech/curve の連鎖衝突注意」を満たす。適合。

### 観点7: 普遍既定の非露出・写経(boundary規律) — **適合**

- `OPEN_SCALE`/`DIP_FLOOR`/`DIP_MS`/`ONSET_MS`(:77/:86/:97/:106)は module-level const、payload(SpeechMora)にも契約(Domain B、無変更)にも出ない。適合。
- physiology/ 非 import、smoothstep は3行写経(:143-146)。boundary規律遵守。適合。

### 観点8: 連続性 bound の導出 — **適合(マジックナンバー不在)**

- テスト(:287-333)の per-tick bound は `RUNTIME_PLAYER_SMOOTHSTEP_MAX_SLOPE`(slot-curve-state から import)・最短モーラ区間・`DIP_FLOOR`・`DIP_MS`・`ONSET_MS`・releaseMs・frameInterval から**積の法則で導出**(:307-318)。ハードコード閾値無し。C5(slot-curve-state.ts:46 の MAX_SLOPE)の流儀を延長。適合。
- 最短区間の下限は評価器に持たせず(報告§5-6)、極短区間でも dip により mouth-open 振幅は連続(スパイクせず)。母音個別値は横方向に速く入替わりうるが Σ=s に束縛。min-interval の validation は **Domain B の領分**(下記「質問」でクロスドメイン確認)。

---

## 裁量判断への評価(観点5 direction (a): delete vs release)

**Gnome の選択(報告§5-5)**: setSpeech 時、口6スロットの per-slot 曲線を release ではなく **delete** して専有。理由=マージ順が「per-slot 後勝ち」のため、release 曲線を残すと**それがグループに勝ってしまい専有が壊れる**。つまり delete はマージ設計上ほぼ不可避。

**設計 §7裁定3 との照合**:
- 裁定3 は「新しい口駆動が古い口駆動を **release経由で置換**」「**re-attack規則のグループ拡張**(新規則を発明しない)」。
- C5 re-attack は「現在実効値から立ち上げる=スナップしない」(連続性原則3.1)。
- 忠実な「グループ拡張」なら、グループ onset は **現在の口実効値から** 立ち上がる(グループ版 re-attack)べき。だが実装のグループは `onset=smoothstep(e/ONSET_MS)` で **常に base(0) から** 立ち上がる(speech:317-318)。startValue 概念を持たない。
- 帰結: setSpeech 時に口が**非0**(例: 発話前に mouth へ intent.set で「はっ」と開いていた)だと、delete + onset-from-0 で mouth が **その値→0 へスナップ**してから立ち上がる。**「release経由」「連続性原則」の双方から、この同時発生ケースで逸脱**。

**軽重の評価**:
- **典型ケース(口 idle=base 0)は連続**(現在値0=onset起点0、スナップ無)。Gnome の「口idleの常況では連続」は正しい。
- 逸脱は「発話前に口 per-slot 駆動が生きている」**稀ケース**限定。口は通常 speech領分 or idle。
- Gnome が §5-5 で**明示的に裁量として自認・評価依頼**しており、隠れバグではない。
- マージ順の制約上、literal「release」は専有を壊すため採れない。真の連続化には **グループ評価器に onset-from-current-effective(グループ re-attack)機構の追加**が要る=設計レベルの追加判断。
- 設計自体が「実際できた結果を見ないと厳密にはわからない=最終審は比較ゲート(§7冒頭・§5)」の留保つき。

**評価**: 数学的欠陥ではなく設計方針の判断。design レーンとしては **blocking にしない**が、**Orch-Sylph/Undine の明示裁定を要する**。裁定の分岐:
- (A) 「稀な同時発生の口スナップは比較ゲートに委ねる/許容」→ 現状のまま可(合格)。
- (B) 「連続性原則は同時発生ケースでも不可侵」→ **要修正**: グループ onset を現在実効値(prevResolved の口6値)から立ち上げるグループ re-attack を追加(裁定3「re-attack規則のグループ拡張」の literal 実装)。

direction (b)(逆向き)は忠実なので、修正が要るとしても direction (a) の onset 起点のみに限局する。

---

## blocking の有無

**design レーンの blocking(数学的欠陥・恒等破壊・連続性破綻・命名衝突・boundary破り)は無し。** 観点1-4・6-8 は全適合。観点5 direction (a) は blocking ではなく**裁定待ちの設計判断**。

---

## 質問(Orch-Sylph 経由で裁定・確認したい点)

1. **【要裁定】direction (a) の口スナップ(観点5)**: setSpeech が非0の口 per-slot 駆動を置換する稀ケースで、delete+onset-from-0 によるスナップを (A)許容(比較ゲート委任)か (B)グループ re-attack(現在実効値起点)で連続化 か。設計 §7裁定3「release経由で置換」の literal 適用範囲の裁定を要する。
2. **クロスドメイン: 最短モーラ区間の下限**(観点8): 評価器は下限を持たず(報告§5-6)、連続性 bound テストは「タイムライン内の最短区間」から導出。Domain B の validation が最短区間下限を持つなら、その値と bound テストの前提が整合するか(spec/test-adequacy レーンとの境界確認)。評価器側の数学は下限無しでも mouth-open 振幅連続なので design レーンとしては問題なし。
3. **forced-release 恒等の前提(観点4注記)**: 口 livingBase=0(§2.8 grep 0件)に依存して forced-release 中の凸恒等が立つ。将来 physiology が口を産む変更が入ると崩れうる潜在前提。現状は §2.8 が保証。記録のみ(現状アクション不要)。

---

## 総括

C6 の設計荷重の核(相補式の凸恒等・再調音ディップの全境界連続・時間仮説の動的attack・s縮小・onset・終端release・forced-release・命名規律・非露出・写経・bound導出)は**設計討議 §2/§3/§3.5/§4/§7 と棚卸し §2.2-2.4/§2.8 の意図どおり、数学的に正しく実装**されている。代数検算と golden 手計算で恒等・連続を確認した。唯一 Orch/Undine の裁定を要するのは、後着置換 direction (a)(setSpeech の delete)が稀な同時発生ケースで「release経由/連続性原則」から逸脱する点で、これは Gnome が自認済みの設計トレードオフ。design レーン判定は **合格(条件付き=direction (a) の裁定待ち)**。
