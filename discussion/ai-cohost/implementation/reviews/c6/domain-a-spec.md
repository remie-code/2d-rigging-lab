# C6 Domain A レビュー(spec レーン): 口グループ・タイムライン評価器

> レビュア: Review-Sylph(spec レーン)。2026-07-11。Orch-Sylph からの委任。
> 判定基準: c6-wave-plan.md §8 AC・§9 Subagent Contract・§10 Review Policy(Domain A 該当分)。
> レビュー方法: 対象4ファイルの実体・git diff・golden を自分で読んでコード裏取り。Gnome 完了報告の主張は出発点として突き合わせ。

## 判定: **合格(spec 適合・blocking なし)**

wave plan §8 AC のうち Domain A が担う機械的性質(凸恒等・ディップ・undershoot・s縮小・後着置換・終端/切断release・additive・保護対象無変更)は、いずれも**コードの実体で確認でき、Gnome 報告の主張と一致**した。契約縦貫・512拒否・時刻単調は Domain B の領分で本ドメイン対象外(評価器は検証済みモーラ列を信頼する設計、report §5-6 と一致)。

---

## 観点別 適合(コード位置つき)

### 1. 凸恒等 Σ(5母音) = s = mouth.open — **構造保証を確認**

- `speech-timeline-state.ts:321` に単一の `s = sRaw * dip * onset * term * OPEN_SCALE`。`:324` で `mouth-open = s`、`:334-335` で `vowel[prev] += s*(1-p)`, `vowel[next] += s*p`。**単一 s・単一 p から代数導出**で、Σvowel = s·((1−p)+p) = s = mouth-open は恒等式。
- 同一母音連続(prevSlot===nextSlot)は `:334-335` の `+=` 加算で `s*(1-p)+s*p = s` に畳まれ恒等を壊さない。
- dip/onset/term/OPEN_SCALE はすべて `:321` で**単一 s に乗算畳み込み**。個別スロットへの後段補正・「Σを計算して mouth.open に合わせる」補正は**コード上に存在しない**(検証コードで代用していない=構造保証)。store 側(`control-channel-overlay-store.ts:239-249`)も `Object.assign(live, sample.values)` のみで補正なし。
- 強制解放(`:219-232`)は `values[slot] = lerp(base, from[slot], w)` の**一律 w スケール**。テスト全tick走査(`speech-timeline-state.test.ts:59-91`)が onset/区間/境界/o×5/終端/強制解放を 4ms 刻みで `toBeCloseTo(9桁)` 検証。→ **適合**。

### 2. 再調音ディップ(同母音連続の非静止) — **適合**

- 全モーラ境界でディップ: `:312-315` `dipLeft=dipFactor(e-leftBoundary)`, `dipRight=dipFactor(rightBoundary-e)`, `dip=min(左,右)`。境界で dt=0 → floor=0.4(`:163-169`)、区間中央で 1.0 回復。左右対称なので全境界・任意区間長で連続(`dipFactor` の設計コメント通り)。
- 「のところど」(o×5)テスト(`test:128-161`)で境界値 < 中央値、境界≈中央×0.4、o-run 全域 max−min>0.2 の非静止を実証。golden の t=140(境界, mouth-open=0.256=0.8×0.4×…)/t=210(中央, 0.52)も拍ごとの沈み/回復を示す。→ **適合**。

### 3. undershoot(attack=モーラ間隔・payload非搭載) — **適合**

- `:275-277` `interval = t1 - t0`, `frac = (e-t0)/interval`。クロスフェード長=モーラ間隔そのもの。固定 attackMs も payload attack フィールドも無い(`SpeechMora` = `{timeMs, vowel, s}` のみ、`:32-36`)。
- テスト(`test:164-192`)で fast(30ms間隔)の i ピーク < slow(220ms間隔)。→ **適合**。

### 4. s縮小係数 0.8・非露出 — **適合**

- `RUNTIME_PLAYER_SPEECH_OPEN_SCALE = 0.8`(`:77`)、`:321` で s に一律乗算。payload 型(`SpeechMora`)にも契約にも出ない普遍定数。export はされているが**パラメータ化されず**(呼び出し側から差し替え不可)、payload/契約フィールドではない。
- テスト(`test:194-213`)で全域 ≤0.8、中央で ==0.8。→ **適合**。

### 5. 後着置換(単一所有・両生存の競合なし) — **適合**

- `setSpeech`(store `:166-171`): 6口スロットの per-slot 曲線を `#curves.delete` で除去 → グループ専有。
- `#yieldSpeechForSlot`(store `:304-308`)を `setOverlay`(`:118`)/`setEnvelope`(`:146`)の先頭で呼び、発話中に口スロットへ per-slot が来たらグループを forced-release。
- merge 順(store `:236-249`): グループを先、per-slot 曲線を後に書く → 共有スロットは per-slot が決定論的に後勝ち。
- 「同一スロットにグループと per-slot が両生存で曖昧競合」は起きない: 専有 delete + merge 優先の二段で単一所有に解決。テスト(`test:493-536`)が per-slot 到来後グループ5スロットが base へ、mouth-open が消え、対象スロットは per-slot(0.95, グループの s≤0.8 では作れない値)= 単一所有を実証。→ **適合**。

### 6. 終端/切断 release で閉口 — **適合**

- 終端: `:296-307` 最終モーラ後 `holdMs`(=最終区間長, 単一モーラは ONSET_MS)保持 → `term=1-smoothstep(rel/releaseMs)` で s→0 → `done=true`(`:304`)→ store が `#speech=null`(`:245`)prune → base 0 = 閉口。
- 切断: `releaseAll`(store `:213`)→ `#forceReleaseSpeech`(`:316-334`)で捕捉6値を base へ ease。`#livingBase`(`:347-350`)は口スロットに `lastBaseValues` 不在 → **0 を返す**(生理は口を産まない §2.8 が接地)ので release 先=閉口が成立。
- テスト: 終端 `test:230-244`(done+6スロット0)、切断 `test:451-467`(releaseAll 後 400ms で snapshot が `{}`)。→ **適合**。

### 7. additive・無退行 — **適合**

- `setOverlay`/`setEnvelope`/`snapshot`/`releaseAll`/`clearAll` の**外部シグネチャ無変更**。既存パスへの追加は `#yieldSpeechForSlot` 呼び出し1行のみで、`#speech===null` 時は**完全な no-op**(`:305` の早期 return)。→ 発話不在時の既存挙動は不変。
- snapshot の追加ブロック(`:236-249`)は `#speech!==null` ガード下でのみ動作。既存 curve ループ・release 分岐は無改変。
- 心臓 seam 無改造(グループ6値は snapshot 戻り Record に相乗り)。

### 8. 保護対象無変更 — **適合**

- `git diff --stat`/`git status`: 変更は `control-channel-overlay-store.ts`(+109)・同 `.test.ts`(+180)の2ファイル、新規は `speech-timeline-state.ts`/同 `.test.ts` のみ。
- physiology/・`headless-slot-resolver.ts`・心臓(`autonomous-frame-heart.ts`/`input-subsystem.ts`)・契約 JSON/TS・Runtime Export schema・package-format・Editor・lockfile は**無変更**(diff に一切現れず)。
- 実行時 `if (role === ...)` 分岐の新設なし。拒否コード新規追加なし(契約 validation を触っていない — Domain B 領分)。→ **適合**。

---

## 裁量判断への評価(report §5)

- **onset(ONSET_MS=60)/最終保持 holdMs=最終区間長/単一モーラ fallback=ONSET_MS**: いずれも単一 s に畳まれ凸恒等不変。holdMs はタイムライン導出でマジックナンバー回避。妥当。
- **ディップ profile(floor=0.4, 片側40ms, min(左,右))**: 設計§3.5「〜40%・30〜50ms」の範囲内、全境界連続を満たす形。妥当。
- **「release経由」を setSpeech 時は delete と解釈**: 設計の「後着置換=release経由」を、口 idle 常況(=典型)ではグループ onset が base 0 から連続立ち上げ、稀な同時 per-slot 駆動時のみ残値置換、という解釈。逆方向(発話中の per-slot 到来)は設計通り forced-release+re-attack。**設計意図と整合**し spec 違反なし。design レーンが思想適合を別途判断すべき箇所だが、AC 上は問題なし。

## blocking の有無

**blocking なし。** wave plan §10 の blocking 観点(全tick凸恒等の性質テスト/ディップ・undershoot・縮小係数の普遍既定露出なし/相補式の構造保証・検証コード代用なし/C4/C5 fixture 無変更/連続性bound導出/physiology純度・golden不変/role分岐不在)はすべて充足。

## 質問・申し送り(Orch-Sylph 判断用、いずれも非blocking)

1. **強制解放時の凸恒等は「6口スロットの base が一律 0」に構造依存**(`:216-218` コメント・`:229`)。現状 §2.8「生理は口を産まない」で base=0 が全6スロット一律に接地されるため成立するが、将来 physiology が口 base を出す変更が入ると `Σ lerp(0,vFrom,w)` の前提が崩れ強制解放中に恒等が破れうる。本ドメインでは非問題(接地済み)。**将来の保護対象=「口 base=0」不変**として記録に値するか、Orch の判断に委ねる。

2. **凸恒等の「全tick」テストは 4ms 刻みの密走査**(literal per-frame ではない)。恒等は代数構造なので任意サンプリングで十分実証でき、密走査は網羅的。§10「全tick対象」の趣旨(=タイムライン全域を対象)は満たすと判断。テスト網羅の十分性の最終判断は test-adequacy レーンに委ねる。

3. 全体スイートの既知baseline fail 2件(Wave21 browser-source系)の突合と typecheck の再実行検証は test-adequacy/Domain C レーンの担当。本 spec レーンでは未実行(コード実体での spec 適合判定に集中)。

## 結論

Domain A は wave plan §8 AC(Domain A 該当分)と絶対条件を**コードの実体で満たす**。spec レーンとして**合格**、blocking なし。上記質問1(将来の口base不変性)を記録として Orch へ申し送る。
