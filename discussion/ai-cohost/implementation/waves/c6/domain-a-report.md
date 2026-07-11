# C6 Domain A 完了報告: 口グループ・タイムライン評価器 (`cohost-c6-mouth-timeline-evaluator`)

> 実装者: Gnome(Orch-Sylph からのサブエージェント委任)。2026-07-11。
> スコープ: 口グループ・タイムライン評価器の新モジュール + store 統合 + テスト。契約 `intent.speech`・validation・dispatch・参照ドライバは **Domain B**(本ドメインは触っていない)。

## 1. 作成/変更ファイル一覧(絶対パス)

**新規**:
- `C:\workspace\remie\code\ai-native-live2d-editor\apps\runtime-player\src\main\control-channel\speech-timeline-state.ts` — 口グループ・タイムライン評価器(純関数 + 型 + 普遍定数)。
- `C:\workspace\remie\code\ai-native-live2d-editor\apps\runtime-player\src\main\control-channel\speech-timeline-state.test.ts` — 純関数の性質テスト + 決定論golden(12 tests)。

**変更(additive)**:
- `C:\workspace\remie\code\ai-native-live2d-editor\apps\runtime-player\src\main\control-channel\control-channel-overlay-store.ts` — `setSpeech` 追加・`snapshot`/`releaseAll`/`clearAll` にグループ評価の相乗り・後着置換の調停(private helper 2つ)。
- `C:\workspace\remie\code\ai-native-live2d-editor\apps\runtime-player\src\main\control-channel\control-channel-overlay-store.test.ts` — store 統合/調停/切断release/連続性 bound テストを追記(8 tests)。

心臓 `autonomous-frame-heart.ts` / `input-subsystem.ts` の merge seam・cadence、`headless-slot-resolver.ts`、`physiology/` 配下、契約 JSON/TS、lockfile は **無変更**。

## 2. 新モジュール・主要 export・store統合点

**モジュール**: `speech-timeline-state.ts`(C5命名規律の延長: per-slot=`curve`(slot-curve-state.ts) / グループ=`speech timeline`(本モジュール)。互いに相手の語を使わない)。

**主要 export**:
- `sampleSpeechTimeline(speech, nowMs, options?)` → `{ values: Record<6slot,number>, done }`。純関数(時計を持たず nowMs で評価。fake timer 不要)。
- 型 `SpeechMora = { timeMs; vowel: "a"|"i"|"u"|"e"|"o"; s }`、`SpeechTimelineState = { moras; startAtMs; forcedReleaseAtMs?; forcedReleaseFrom? }`。
- `RUNTIME_PLAYER_SPEECH_MOUTH_GROUP_SLOTS`(6スロットid)/`RUNTIME_PLAYER_SPEECH_VOWEL_SLOTS`/`RUNTIME_PLAYER_SPEECH_MOUTH_OPEN_SLOT`/`isSpeechMouthGroupSlot(slotId)`。
- 普遍定数(非露出・非パラメータ化): `RUNTIME_PLAYER_SPEECH_OPEN_SCALE=0.8`、`RUNTIME_PLAYER_SPEECH_DIP_FLOOR=0.4`、`RUNTIME_PLAYER_SPEECH_DIP_MS=40`、`RUNTIME_PLAYER_SPEECH_ONSET_MS=60`。payload/契約には一切出ない。

**store統合点**:
- `store.setSpeech(moras, startAtMs)` を追加(Domain B がここへ dispatch を配線する。本ドメインのテストは直接呼ぶ)。
- `snapshot(nowMs, base, prev)` 内で `#speech` があれば `sampleSpeechTimeline` を評価し、**per-slot 曲線ループより先に** 6スロット値を live Record へ書く(後述の調停で per-slot が後勝ち)。心臓 seam は無改造 — グループの6値はこの snapshot 戻り Record に載って自動マージされる。

## 3. 実装要旨

**相補式(凸恒等を構造保証)**: 区間 [i,i+1] で `p = smoothstep((e−t_i)/(t_{i+1}−t_i))`、単一の開き強度 `s = lerp(s_i,s_{i+1},p)·dip·onset·term·OPEN_SCALE`。6スロットは **この単一 s と単一 p から代数的に**導出: `mouth-open = s`、`vowel[v_i] = s·(1−p)`、`vowel[v_{i+1}] = s·p`(同一母音は加算)、他母音=0。ゆえに `Σvowel = s·((1−p)+p) = s = mouth-open` は恒等式。dip/onset/term/scale はすべて単一 s に畳み込むので恒等を壊さない。**後段補正(Σを計算して合わせる等)は一切書いていない**(レビュー blocking観点)。同一母音連続は重み合算で安全。

**再調音ディップ(§3.5)**: 各モーラ境界で s に短いディップ。`dipFactor(dt) = lerp(FLOOR=0.4, 1, smoothstep(clamp01(dt/DIP_MS=40)))` を左右境界からの距離で評価し `min(dipLeft, dipRight)`。境界で floor(=0.4)、区間中央で 1.0 へ回復。左右対称なので**全境界で連続**(退出側の右端 floor と進入側の左端 floor が一致)、区間長 < ディップ窓でも連続。効果: 「のところど」(o×5)でも拍ごとに沈み/回復し非静止。s への乗算なので凸恒等は無傷。

**undershoot(§3.2)**: クロスフェード区間長 = モーラ間隔 `t_{i+1}−t_i` がそのまま attack。固定 attackMs も payload の attack フィールドも無い。高速モーラは頂点(純母音)に登り切る前に次目標へ折れ、混合が残る(テストで fast<slow を実証)。加えて p=1(純母音)は次境界=ディップ floor と一致するので構造的に純母音へ到達しない。

**s縮小係数(§7裁定5)**: `OPEN_SCALE=0.8` を s に一律乗算(非露出定数)。s=1 のモーラでもディップ非掛かり点で mouth-open が 0.8 を超えない。

**onset(§4)**: グローバル `onset = smoothstep(clamp01(e/ONSET_MS=60))` を s に乗算。timeline 先頭で基底(mouth base=0, §2.8)から連続に立ち上がる(スナップ禁止)。t=0 で onset=0 → 全スロット 0。

**終端 release(閉口)**: 最終モーラ後、`holdMs`(= 最終区間長。単一モーラは ONSET_MS)保持の後、`term = 1−smoothstep(rel/releaseMs)` で s を 0 へ。完了で `done=true` → store が prune → base(0)= 閉口。発話後に口が自然に閉じる。

**切断/後着置換の release**: `SpeechTimelineState.forcedReleaseAtMs/forcedReleaseFrom` で per-slot 曲線の forced release と同型。捕捉した6値を **一律 w でスケール**して base(0)へ — 一律スケールは凸恒等を保存(`Σ lerp(0,vFrom,w)=w·ΣvFrom=w·openFrom=lerp(0,openFrom,w)`)。

**後着置換(裁定3、store内1箇所で調停)**:
- **merge優先**: snapshot は「グループを先、per-slot 曲線を後」に書く → 共有スロットは per-slot が決定論的に後勝ち。
- `setSpeech`: 6口スロットの per-slot 曲線を **delete**(グループが専有)。グループ onset は base 0 から立ち上がるので、口が idle の常況では連続(スナップ無)。
- 発話中に口スロットへ per-slot `setOverlay`/`setEnvelope`(`#yieldSpeechForSlot`): **グループを forced-release**(全6が base へ収束)、per-slot 曲線がそのスロットを後勝ちで駆動(prevResolved から re-attack で連続)。グループは5スロットを解放しつつ消える。
- これにより「同一スロットにグループと per-slot が両方生きて競合」する状態を作らない(専有 delete と決定論優先で単一所有)。
- `releaseAll` はグループも forced-release、`clearAll` はグループを即 null。

## 4. テスト結果

**対象テスト(本ドメイン)**: `speech-timeline-state.test.ts`(12) + `control-channel-overlay-store.test.ts` の C6追記(7)= **19 tests**、**全 pass**(初回報告の「12+8=20」は数え違い。実測 12+7=19)。

網羅:
- 凸恒等(**全tick性質・最重要**): 代表フレーズ(全5母音+o×5+onset+終端)を 4ms 刻みで全域走査し `Σ(5母音)===mouth-open` を assert。単一モーラ・forced release も。
- 相補式(区間中点 p=0.5 で weight_prev=weight_next=mouth-open/2、終盤で incoming 優勢)。
- 再調音ディップ(o×5 で境界<中央、boundary≈mid×0.4、max−min>0.2 の非静止)。
- undershoot(fast の vowel-i ピーク < slow)。
- s縮小係数(mid で ==0.8、全域で ≤0.8)。
- onset(t=0 で 0)/終端 release(done + 6スロット 0 収束)。
- 決定論golden(代表フレーズ+固定15tick → 6スロット出力列を 1e-6 丸めで固定)。
- store統合(6スロット駆動・prune・非口スロット不干渉)。
- 後着置換(setSpeech が per-slot delete で専有 / 発話中 per-slot が group を forced-release し後勝ち・両生存無し)。
- 切断 release(releaseAll → 400ms で全6が 0)/clearAll 即時 drop。
- 連続性 bound(**導出**): 純関数側は `SMOOTHSTEP_MAX_SLOPE`・最短モーラ区間・DIP_MS・ONSET_MS・releaseMs・frame interval から per-tick step 上限を導出(マジックナンバー無し)。store側は setSpeech→releaseAll 走査で導出 bound 内。

**全体スイート**: `pnpm run test:unit` → **136 passed / 2 failed(既知baseline)**、**879 tests passed / 2 failed**。
- 既知baseline fail 2件 = `src/main/broadcast-source/browser-source-server.test.ts` と `src/stage/browser-source/browser-source-server-message.test.ts`(**browser-source 系2件・実装前 baseline でも同一に fail・Domain A 無関係・無変更**。出所ラベルは初回「Wave21」としたが不確実——レビュー指摘では dynamics-tuning コミット `4627bbd` 由来の疑い。ラベルは保留し、実質分類=「browser-source 系の実装前 baseline」を確定事実として扱う)。
- テスト数は baseline 860 → 879(+19、本ドメイン追加分)。

**typecheck**: `pnpm run typecheck` → **pass**(0 error)。

## 5. 裁量判断(設計未定義を合理実装)

1. **onset の立ち上げ**: グローバル `onset=smoothstep(e/ONSET_MS)`(ONSET_MS=60、非露出定数)を s に乗算し base 0 から連続立ち上げ。mt_0=0(常況)でもスナップしない。単一の s に畳むため凸恒等不変。基底 0 前提(生理は口を産まない §2.8、かつ setSpeech が競合 per-slot を delete)。
2. **最終モーラの保持時間**: 次区間が無いため、`holdMs = 最終モーラ間隔`(タイムラインから**導出**、マジックナンバー回避)。保持後に releaseMs で閉口。
3. **単一モーラ**: 区間が無いので hold = ONSET_MS を fallback。onset で立ち上げ→ONSET_MS保持→releaseMs で閉口。
4. **再調音ディップのプロファイル**: floor=0.4・片側 40ms の左右対称 smoothstep 谷、`min(dipLeft,dipRight)`。設計の「〜40%・30〜50msで回復」の範囲内(40ms を採用)。全境界・任意区間長で連続になる形を選択。
5. **後着置換の「release経由」の解釈**: setSpeech 時の口 per-slot 曲線は **delete**(release ではなく)で専有。理由=グループが即座に同スロットを駆動するため、残す release 曲線は常に上書きされ死荷重になり「両生存の競合が無い」を最も明快に保証できる。グループ onset が base 0 から立ち上がるので、口 idle の常況(=典型)では連続。稀に口 per-slot 駆動と同時発話が起きた場合のみ、その残値が置換される(=後着置換の趣旨)。逆方向(発話中の per-slot 到来)は設計通りグループを forced-release し per-slot が re-attack で連続に引き継ぐ。
6. **最短モーラ区間の下限は評価器側で持たない**: 極端に短い区間でも `dipFactor`/`min` により連続は保たれる(スパイクしない)が、上限(512モーラ/DoS)や最短区間の validation は **Domain B の validation の領分**。評価器は下限を持たず、必要なら Domain B が持つべき旨をここに記録(§7)。

## 6. 規約遵守の自己申告

- `pnpm install` **不使用**(手動symlink・独自resolver・tsconfig paths 迂回も無し)。依存追加**無し**。
- 保護対象**無変更**: physiology/・`headless-slot-resolver.ts`・心臓 `autonomous-frame-heart.ts` / `input-subsystem.ts` の merge seam/cadence・契約 JSON/TS・Runtime Export schema・package-format・Editor・lockfile。`apps/soul` に package.json/依存を置いていない。
- 実行時 `if (role === ...)` 等の**ロール分岐を新設していない**。
- 拒否コード(rejection code)を**新規追加していない**(契約 validation は触らない)。
- 既存 `setOverlay`/`setEnvelope`/`snapshot`/`releaseAll` の外部シグネチャ・既存挙動を**壊していない**(既存 store/curve テストは無変更で通過)。additive のみ。
- 無関係な既存差分の revert **無し**。変更は4ファイルのみ(全て本ドメイン scope 内)。

## 7. escalate / 質問

- **なし(escalate 不要)**。設計裁定(§7)・棚卸し(§2.2/§2.3/§2.4/§2.8)の想定通り、外周(心臓cadence・マージseam・release・smoothstep写経・母音スロット語彙)は C5 資産をそのまま流用でき、新規はグループ評価器の内部数学と store 内調停のみで完結した。グループエントリは既存 store マージ seam に問題なく乗った(Escalate 条件「グループエントリが既存storeマージseamに乗らない場合」は不発生)。
- **Domain B への申し送り(質問ではなく境界の確認)**:
  - store `setSpeech(moras, startAtMs)` が配線点。Domain B は dispatch → `store.setSpeech(moras, this.#nowMs())` を setEnvelope 分岐と同型に足す。`SpeechMora`/`SpeechVowel` 型は本モジュールから再利用可(または契約側の型と橋渡し)。
  - **最短モーラ区間の下限**と**タイムライン長上限(512)/時刻単調/母音語彙/空配列**の validation は評価器に持たせていない(§5-6)。設計通り Domain B の validation が担う。評価器は「検証済みモーラ列」を信頼する(念のため空配列は総関数として done を返すが、正規には Domain B が `invalidPayload` で弾く前提)。

---

## 8. ループ2 差分修正(test-adequacy レーン blocking 解消・テストのみ変更)

**指摘(Review-Sylph test-adequacy)**: 連続性 bound テスト(pure/store 両側)が **vacuous(常真)**。旧導出は 4つの最悪傾き(cross-fade + dip + onset + release)を**単純同時加算**しており per-tick bound が pure≈**0.744** / store=**1.2**。しかし全スロット値域上限は `OPEN_SCALE(0.8)×maxS(0.8)=0.64`。隣接 tick 差は必ず ≤0.64 なので、bound≥0.64 では**全域スナップすら検出できない** → 連続性(no-snap)の regression ガードが実質不在(凸恒等はスナップ下でも各 tick 真、golden は離散点のみ pin、ゆえに no-snap の唯一のガードがこの連続性テスト)。

**修正(実装本体は無変更・テストのみ)**:
- 新導出式(pure/store 共通、マジックナンバー無し): 境界で**同時に起こりうる2つの支配的 smoothstep 傾き**=onset(値が 0→valueRange を ONSET_MS で振る)+ dip(値が (1−FLOOR)·value を DIP_MS で振る)から per-tick 上限を導出。cross-fade(モーラ間隔 ≥ ONSET_MS)と terminal/forced release(releaseMs)の傾きは 3〜10× 浅く、同時最悪化しないため**合成から除外**(この除外が旧 4-way 過大加算の解消)。
  ```
  valueRange   = OPEN_SCALE · maxS                       (= 0.8·0.8 = 0.64)
  onsetSlope/ms = maxSlope / ONSET_MS                    (= 1.5/60   = 0.025)
  dipSlope/ms   = maxSlope·(1−DIP_FLOOR) / DIP_MS         (= 1.5·0.6/40 = 0.0225)
  boundPerTick = valueRange · (onsetSlope + dipSlope) · frameInterval
               = 0.64 · 0.0475 · 16 ≈ 0.486
  ```
- **新 bound 値 ≈ 0.486**(pure/store 同値。maxS=0.8)。**値域 0.64 との関係: 0.486 < 0.64** を**テスト内で明示 assert**(`expect(boundPerTick).toBeLessThan(valueRange)`)——将来 bound が値域を超えたら気づけるゲート性を担保。
- **実測 max tick step ≈ 0.211**(代表フレーズ+forced release 全域走査、最大は onset+dip が重なる冒頭 t≈48)。`observedMax < boundPerTick`(0.211 < 0.486)も追加 assert し、bound がデータ直上でなく実ヘッドルームを持つ=評価器が連続であることを裏取り。
- pure 側(`speech-timeline-state.test.ts`)・store 側(`control-channel-overlay-store.test.ts`、setSpeech→releaseAll 走査)の**両方**を同型に締めた。

**再実行結果**: `pnpm run typecheck` **pass**。`pnpm run test:unit` → **136 passed / 2 failed**、**879 passed / 2 failed**(2件は上記 browser-source 系 baseline のみ、無退行)。対象2ファイルは 38 tests 全 pass(締めた後も pass)。

**触っていないもの**: 実装本体(`speech-timeline-state.ts` の評価ロジック、`control-channel-overlay-store.ts` の setSpeech/snapshot/調停)は**無変更**。後着置換 direction(a) の delete vs release 裁量(§5-5)は現状維持(Undine 裁定待ちとして別途エスカレーション対象、本ループでは触らない)。他テスト(凸恒等・ディップ・undershoot・golden 等)も無変更。
