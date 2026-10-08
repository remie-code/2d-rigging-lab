# C6 統合Domain E改 完了報告: Articulationスライダー+グループre-attack+`--loop` (`cohost-c6-followup2-articulation-slider`)

> 実装者: Gnome(Orch-Sylph からのサブエージェント委任)。2026-07-12。
> スコープ: wave-plan §13補遺 の統合Domain E改 4項目(グループre-attack / Articulationスライダー / 参照ドライバ`--loop` / 性質テスト)。
> source of truth: c6-wave-plan.md §12項目2・§13・§13補遺、c6-mouth-phoneme-timeline.md §3.5改定・§7.1裁定B、c3-physiology-profile.md、domain-a-report.md、domain-c-physiology-page-profile.md。

---

## 1. 作成/変更ファイル一覧(絶対パス)

新規作成: **なし**(全て additive な既存ファイル拡張)。

変更(source):
- `C:\workspace\remie\code\ai-native-live2d-editor\apps\runtime-player\src\main\control-channel\speech-timeline-state.ts` — 評価器: `dipFloor` option 追加(floor をランタイム受領・普遍既定 0.4 は据置)、`onsetFromOpen` 追加(グループre-attack。onset を `lerp(onsetFromOpen, sNatural, onset)` へ)。
- `C:\workspace\remie\code\ai-native-live2d-editor\apps\runtime-player\src\main\control-channel\control-channel-overlay-store.ts` — `dipFloorProvider` option(snapshot毎に読む=即時反映)、`setSpeech` が現在実効値(`#effectiveStart(mouth-open)`)を `onsetFromOpen` に捕捉、`#dipFloorOption()` helper。
- `C:\workspace\remie\code\ai-native-live2d-editor\apps\runtime-player\src\main\role-composition\input-subsystem.ts` — overlay store 構築時に `dipFloorProvider: () => deps.physiologyConfigProvider?.().speech?.articulationFloor` を data で配線(role分岐なし)。
- `C:\workspace\remie\code\ai-native-live2d-editor\apps\runtime-player\src\main\physiology\physiology-config.ts` — optional `speech?: PhysiologySpeechConfig`(additive)+ 型追加。DEFAULT群不変。
- `C:\workspace\remie\code\ai-native-live2d-editor\apps\runtime-player\src\main\physiology\index.ts` — `PhysiologySpeechConfig` 型 re-export(barrel)。
- `C:\workspace\remie\code\ai-native-live2d-editor\apps\runtime-player\src\main\physiology-profiles\physiology-tone-config.ts` — `articulation` tone→floor 写像 `mapSpeechConfig`、floor 端点定数、`PHYSIOLOGY_SPEECH_TONE_FIELDS`、`physiologyOverridesToConfig` に `speech` 追加。
- `C:\workspace\remie\code\ai-native-live2d-editor\apps\runtime-player\src\main\physiology-profiles\physiology-state.ts` — `PHYSIOLOGY_SECTION_IDS` に `"speech"` 追加。
- `C:\workspace\remie\code\ai-native-live2d-editor\apps\runtime-player\src\preload\physiology-bridge-contract.ts` — `PhysiologySectionId` に `"speech"`、`PhysiologySpeechToneField="articulation"`、`PhysiologyToneOverrides.speech?` 追加。
- `C:\workspace\remie\code\ai-native-live2d-editor\apps\runtime-player\src\control\physiology-page.tsx` — Speech セクション spec(Articulation スライダー+逐語キャプション)を追加。
- `C:\workspace\remie\code\ai-native-live2d-editor\apps\soul\reference-driver\reference-driver.mjs` — `--loop` フラグ(発話フレーズを繰り返し送出)。依存ゼロ維持。

変更(test):
- `...\control-channel\speech-timeline-state.test.ts`(+8: floor範囲両端 convex/非静止/連続性 各2、re-attack 2)。
- `...\control-channel\control-channel-overlay-store.test.ts`(+2: 同時ケースre-attack、dipFloorProvider即時反映)。
- `...\physiology-profiles\physiology-tone-config.test.ts`(+2: articulation写像、speech section解決)。
- `...\physiology-profiles\physiology-state.test.ts`(+1: speech override/reset)。
- `...\control\physiology-page.test.ts`(Speech/Articulation label・caption・helper へ speech section)。

変更(docs):
- `C:\workspace\remie\code\ai-native-live2d-editor\discussion\ai-cohost\implementation\screens\c3-physiology-profile.md` — §2 mock に Speech セクション、§3.1 に Articulation キャプション行を追加。

**無変更(scope外)**: physiology golden(空)・`headless-slot-resolver.ts`・pnpm-lock.yaml・control-channel の契約 JSON(schema/examples)・`apps/soul` package.json(不在維持)・DEFAULT_PHYSIOLOGY_CONFIG / DEFAULT_FULL_PHYSIOLOGY_CONFIG・心臓/merge seam。

## 2. 4項目の実装要旨

### 項目1: グループre-attack(§12項目2 / 裁定B)
`setSpeech` は per-slot 曲線を6口スロットから delete(グループ専有=単一所有の invariant 維持)する点は据置きつつ、delete前に **現在実効値** `onsetFromOpen = #effectiveStart(mouth-open)`(= `#lastResolved[mouth-open]`、C5案B の既存 prevResolved フィードバック。無ければ livingBase=0)を捕捉して `SpeechTimelineState` に載せる。評価器の onset を `s = lerp(onsetFromOpen, sNatural, onset)` に変更(旧: `s = sRaw*dip*onset*term*SCALE`)。
- **凸恒等の保存**: 6スロットは依然 **単一 s と単一 p** から代数導出するため `Σvowel = s = mouth.open` は re-attack 中も構造保証(後段補正なし)。実効値からの立ち上げは s(=mouth.open の値)に対してのみ働き、母音配分は p 由来のまま。個別母音スロットは第一モーラの形へ再形成される(=再調音そのもの)が、口の開き量(mouth.open)は連続。逆方向(発話中 per-slot 到来→グループ forced-release→per-slot が prevResolved から re-attack)は既存機構のまま。新機構は発明していない(順方向は同じ案B信号を使う)。
- **golden無退行の根拠**: idle常況では `onsetFromOpen=0`。`lerp(0, sNatural, onset) === sNatural*onset` は旧式と **代数的に同一**。よって domain-a の決定論golden・凸恒等・ディップ・undershoot・onset・連続性テストは無変更で通過。

### 項目2: Articulationスライダー(§13項目1)→ floor 写像と供給経路
- **写像(範囲正規化)**: `physiology-tone-config.ts` の `anchoredLerp(articulationTone, SOFT, DEFAULT, CRISP)`。端点: `ARTICULATION_FLOOR_SOFT=0.9`(tone0=左端≈沈まない)、`ARTICULATION_FLOOR_DEFAULT=0.75`(tone0.5=既定=弱値)、`ARTICULATION_FLOOR_CRISP=RUNTIME_PLAYER_SPEECH_DIP_FLOOR=0.4`(tone1=右端=くっきり=現行値)。**既定tone0.5→floor0.75** が範囲(0.4〜0.9)内に収まる。右=crisper=深いディップ=低floor(キャプション方向一致)。
- **左端を 1.0 でなく 0.9 にした裁量**: floor=1.0 は「のところど」を完全静止させ、絶対条件「非静止が範囲両端で成立」を破る。設計の「floor≈1.0=沈まない」の "≈/ほぼ無し" に従い、**strictly < 1 の 0.9**(10%ディップ=barely dips)を採用。非静止テストは floor から導出した閾値で両端検証。
- **供給経路**: `PhysiologyConfig.speech.articulationFloor`(optional additive, stagePresence の前例に倣う)を tone-config が算出 → `physiology-state` の provider(既存 config seam・revision キャッシュ)経由 → `input-subsystem` が overlay store の `dipFloorProvider` へ `physiologyConfigProvider().speech?.articulationFloor` を配線(data、role分岐なし) → store が **snapshot毎に** floor を読み `sampleSpeechTimeline({dipFloor})` へ渡す(即時反映)。評価器の `RUNTIME_PLAYER_SPEECH_DIP_FLOOR=0.4` は普遍既定値層として据置き(floor未供給時のfallback=器側普遍既定、契約非露出)。control-channel の契約 schema/validation/拒否語彙には floor を一切出していない。
- **UI**: Physiology ページに Speech セクション新設、スライダー1本 `Articulation`、キャプション **`How sharply the mouth re-forms between beats. Right = crisper.`**(逐語、数字非露出)。per-export自動保存(debounce)・即時反映は C3 機構をそのまま噛ませ(新経路なし)。トラッキングホストは空状態②のまま(既存分岐)。

### 項目3: 参照ドライバ `--loop`
`reference-driver.mjs` に `--loop` を追加。`--scenario=speech --loop` で一本の接続を張り、fixture フレーズ「これじっさいのところどうなってるの」を **終端release尺(speechSpan+600ms)ごとに繰り返し送出**(kill まで継続)。想定外拒否/接続断は exit1。`--print-timeline`・機械テストの spawn(`--loop`無し)経路は不変。依存ゼロ(package.json不在)維持。

### 項目4: 性質テストの導出bound
- **floor範囲両端(0.4/0.9)**で pure 評価器の ①凸恒等(全tick) ②o×5非静止(閾値 `0.5·OPEN_SCALE·minS·(1-floor)` 導出) ③連続性bound(`valueRange·(maxSlope/ONSET_MS + maxSlope·(1-floor)/DIP_MS)·frame`。floor に応じて dip傾き項が伸縮、gate `bound<valueRange`)。端点は physiology-tone-config の実定数を import(恣意リテラル回避)。
- **同時ケースre-attack**(pure+store両方): 発話開始時に mouth-open が非0(pure=`onsetFromOpen=0.5`、store=per-slot `setOverlay(mouth-open,0.5)` を prevResolved で threading)→ setSpeech → onset instant で mouth.open が **捕捉値0.5から連続**(≈0.5, >0.4=非snap)、凸恒等保持、`onsetRange=max(valueRange, from)` から導出した bound 内。旧delete挙動(0へsnap-down)との対比も assert。
- **即時反映**(store): 同一nowMs・同一位相で floor だけ変えて再snapshot → boundary の mouth-open が深floor<浅floor(provider が snapshot毎に読まれる証明)。

## 3. テスト結果(実測)

typecheck: `pnpm --filter @private-2d-rigging-lab/runtime-player run typecheck` → **0 error(pass)**(test含む再実行も0)。

対象テストファイル(focused 実行、実測):
- `speech-timeline-state.test.ts` = **20 pass**(domain-a 12 + 本波 8)。
- `control-channel-overlay-store.test.ts` = **28 pass**(+2)。
- `physiology-tone-config.test.ts` = **8 pass**(+2)。
- `physiology-state.test.ts` = **11 pass**(+1)。
- `physiology-page.test.ts` = **8 pass**。
- 合計 focused = **75 pass**。
- reference-driver speech/perceptual timeline = **2 pass**(`--loop` 変更後も無退行)。

全体スイート: `pnpm --filter @private-2d-rigging-lab/runtime-player exec vitest run` → **139 files / 919 tests → 917 passed / 2 failed**。
- **2 failed = 既知 baseline のみ**(Domain E無関係・実装前 baseline):
  1. `src/main/broadcast-source/browser-source-server.test.ts`
  2. `src/stage/browser-source/browser-source-server-message.test.ts`(`effectiveDynamicsTuning` shape。dynamics-tuning由来)。
- 私の変更対象(control-channel / physiology-profiles / physiology / role-composition / control / preload / reference-driver)に失敗なし。

check: `check:soul-zone` **pass**(1248 files、器↔魂 import なし)。`check:deps` **pass**(新規 physiology-profiles→control-channel 依存辺は方向規律に適合)。`check:source` = **既知 C3 baseline 1件のみ**(`physiology/index.ts: index.ts must remain a barrel-only entrypoint`)——**私のindex.ts変更を stash して原本で再実行しても同一に失敗**することを実測確認(pre-existing、本波は新規違反ゼロ)。

参照ドライバ実行可否: `node reference-driver.mjs --scenario=speech --print-timeline` → 15モーラ timeline を1行JSONで出力・exit0(実測)。`--scenario=speech --loop`(URL無し)→ usage を出して arg解釈で停止(hangなし=`--loop` は flag として正しく分離)。WS実機接続はドライバ単体では不要のため引数解釈レベルで確認。

## 4. 無変更確認(git 実出力)

- `git diff --stat -- '*golden*.json'` → **空**(physiology golden 不変)。
- `git status --porcelain -- '**/headless-slot-resolver.ts' 'pnpm-lock.yaml' '**/control-channel/contract/*.json'` → **空**(resolver・lockfile・契約JSON 不変)。
- `ls apps/soul/package.json` → **No such file or directory**(不在維持)。
- 変更ファイルは15件のみ、全て scope 内(§1)。DEFAULT_PHYSIOLOGY_CONFIG / DEFAULT_FULL_PHYSIOLOGY_CONFIG は不変(tone-config は additive に `speech` を付す)。実行時 `if (role === ...)` 新設ゼロ(供給は `providesPhysiology`/config seam の data)。新規 rejection code なし。`pnpm install` 未実行・依存追加なし。

## 5. golden・観測値テストの意図的置換

- **golden置換=なし**。項目1の onset 変更は idle常況(`onsetFromOpen=0`)で `lerp(0,sNatural,onset)===sNatural*onset` と旧式に代数的一致するため、domain-a の決定論golden・観測値テストは **無変更で通過**(pure評価器の普遍既定 floor も 0.4 のまま据置)。
- **走行時の実効既定 floor は 0.4→0.75 に変わる**が、これは器側普遍既定値層(0.4=評価器定数、テストのfallback)から **Player側プロファイル補正層(既定tone0.5→floor0.75)** への昇格であり(四層優先順位どおり、§13の狙い)、golden を pin しているファイルは評価器の普遍既定(0.4)を使い続けるため golden 更新は発生しない。この「走行時既定の弱体化」は設計意図(ちらつきにくい弱値を既定に)であり本報告に記録。

## 6. 裁量判断(設計未定義の合理実装)

1. **floor供給経路**: `PhysiologyConfig.speech.articulationFloor`(optional additive)を tone-config が算出、既存 physiology provider seam を再利用し `input-subsystem` で overlay store の `dipFloorProvider` に配線。store は snapshot毎に読む(長い/ループ発話中の即時反映)。speech評価器は control-channel(心臓系と別系統)だが、Articulation の値供給に限り physiology config seam に相乗り(§13の指示どおり。fan-out は無視、floor は器側内部量で契約非露出)。
2. **re-attackの凸恒等保存の実装形**: 実効値の反映を **単一 s に対する onset の blend 起点**(`lerp(onsetFromOpen, sNatural, onset)`)としてのみ行い、6スロットは従来どおり単一s・単一pから導出。理由=6スロットを個別に blend すると捕捉状態(per-slot駆動は Σvowel=mouth.open を満たさない)が中間 tick で凸恒等を破る(blocking)。単一s経路のみが凸恒等を構造保証しつつ mouth.open を連続にできる。個別母音の再形成(=再調音)は許容し、連続性は「グループの代表値 mouth.open」で担保。
3. **左端 floor=0.9**(1.0でなく): 非静止(範囲両端)の絶対条件と「floor≈1.0=沈まない」の両立。exactly 1.0 は o×5 を凍らせるため strictly<1 を採用。
4. **`--loop` の停止意味論**: ループは kill まで継続=report/exit0 に到達しない調整用挙動。想定外拒否/接続断は既存同様 fail(exit1)。`--print-timeline`・非loop・機械テスト spawn は完全に不変。

## 7. escalate / 質問

- **escalate/blocked: なし**。`pnpm install` を要する事態は発生せず(依存追加なし)。保護対象の変更は不要だった。
- **質問(ユーザー人間ゲート向けの申し送り、判断は本波スコープ外)**:
  1. Articulation の既定 floor を **0.75(tone0.5)** に設定した。走行時の既定ディップが 0.4→0.75 に弱まる(設計意図どおり)。`--loop` で喋らせながらスライダーで「ちらつかず・凍らず」の位置を探す最終ゲートは未実施(ユーザー人間ゲート)。見つかった位置が既定と乖離する場合、既定tone(=Reset位置)の再調整を別途検討され得る(本波は 0.75 を据える)。
  2. 左端 floor=0.9 は「barely dips(10%)」。もし人間ゲートで左端が「まだ効きすぎ」なら `ARTICULATION_FLOOR_SOFT` を 1.0 直下(例 0.95)へ寄せる余地あり(非静止テスト閾値は floor 導出のため自動追従)。この微調整は本波では 0.9 を採用。
