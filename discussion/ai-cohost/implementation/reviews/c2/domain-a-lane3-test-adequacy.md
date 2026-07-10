# C2 Domain A レビュー(Review-Sylph): レーン③ test adequacy

> レビュー担当: Review-Sylph(委任元 Orch-Sylph)。日付: 2026-07-10。ブランチ: feature/2d-rigging-eco-system。
> レーン: **test adequacy**(テストの実効性・網羅性・等価性テストが本物か)。他2レーン(spec compliance / design)は別 Review-Sylph 担当。
> 対象: `apps/runtime-player/src/main/live-mapping/`。

## 判定

**合格**(blocking なし)

このドメインの合否の背骨である「等価性 golden の実効性」を機械的に検証し、**トートロジーでないことを決定的に確認**した。網羅性・活性度直接テスト・沈黙テスト・決定論いずれも本レーン基準を満たす。

---

## 1. 等価性 golden の実効性(トートロジーでないことの根拠) — 最重要

結論: **golden はトートロジーではない。** 3層の独立証拠で確定。

### 証拠A(決定的): 現 golden を pre-refactor 実装に対して実行 → 20/20 一致

`runtime-parameter-frame.ts` は作業ツリーで `M`(変更あり)、コミット HEAD(`f0ecc21`)が pre-refactor 版。以下を実施(検証後に新版へ完全復元、作業ツリー無汚染を git status で確認済み):

1. HEAD 版 `runtime-parameter-frame.ts` を抽出。`headless-slot-resolver` を **import していない**(= 変換段がインラインの旧実装)ことを確認。
2. その旧版へ一時差し替え、**現在コミット候補の golden.json に対して** 等価性バッテリを実行。
3. 結果: `runtime-parameter-frame-equivalence.test.ts` → **20/20 pass**、既存 `runtime-parameter-frame.test.ts` → 19/19 pass。
4. 新版へ byte-identical 復元(`RESTORED-OK`)。git status は元の `M` のみ。

これにより **現 golden の全20シナリオが旧実装の出力と一致**することが証明された。golden は「新実装で再生成して自分と比較する」トートロジー構造ではなく、旧挙動を固定し新実装がそれに一致することを検証している(旧・新の双方が同一 golden を満たす)。

### 証拠B: コミット済み独立オラクルとの数値一致

既存 `runtime-parameter-frame.test.ts`(HEAD 収録・作業ツリー未変更 = pre-refactor 時に手書きされた `.toEqual` 期待値)の値が golden 値と**多数完全一致**:

| golden シナリオ | golden 値 | frame.test.ts 手書き期待値 |
|---|---|---|
| mixed-face-eyes-mouth-slots | face_x:15, eyeball_x:0.5, eye_left_open:0, mouth_open:0.5, mouth_smile:0.5 | 一致(test1 L60-66) |
| disabled-slot-and-clamped-target | face_x:-15 | 一致(test2 L92-94) |
| custom-learned-signs-and-ranges | face_x:15 | 一致(test3 L119-121) |
| nan-infinity-invalid-range-silence | {} | 一致(test4 L154) |
| body-x-and-body-z-calibrated | body_x:3.5, body_z:6.5 | 一致(test5 L190-193) |
| body-z-component-strengths-and-inversion | body_z:-2.5 | 一致(test6 L222-224) |
| body-clamp-extremes | body_x:10, body_z:10 | 一致(test7 L250-253) |
| body-z-rotation-only | face_x:15, mouth_open:0.5, body_z:2.5 | 一致(test8 L279-283) |
| body-smoothing-lag-across-frames | body_x:1.75 | 一致(laggedFrame test9 L330-332) |

これらの期待値は refactor 前に別途手書きされたオラクルであり、新実装で 19/19 pass しつつ golden と同値。golden が旧挙動を正しく捕獲していることを独立に裏付ける。

### 証拠C: env ガードの構造

`UPDATE_RESOLVER_GOLDEN=1` は「一度きり生成、既定は assert 専用」(test L425-441)。既定経路では常に committed golden と `.toEqual` 突合。生成経路と突合経路が排他で、通常テスト実行で golden を書き換えない。証拠A・Bにより、現 golden が旧実装由来であることは確定しているため、この env ガードがトートロジーの抜け穴になっていない。

---

## 2. 代表 TrackingFrame 入力群の網羅性

20 シナリオが要求チェックリストを**すべて充足**:

| 要求分岐 | 該当シナリオ |
|---|---|
| blink 単独 | blink-both-eyes-partial-and-full / blink-open-eyes-zero-activation |
| head/gaze centered | head-and-gaze-centered-with-session-neutral |
| body-x/body-z | body-x-and-body-z-calibrated / body-z-component-strengths-and-inversion / body-z-rotation-only-missing-position-calibration |
| mouth-open(jawOpen fallback) | mouth-open-jawopen-fallback |
| mouth-smile | mouth-smile-averaged(左右平均) |
| vowel(有効/gate閉/無効) | vowel-blend-enabled-a / -i-with-strength-boost / vowel-gate-closed-neutral / vowel-disabled-drops-vowel-keys |
| session neutral 有無 | 各 neutral 付き + no-session-neutral-uses-profile-neutral |
| calibration learned signs | custom-learned-signs-and-ranges |
| NaN/Infinity/無効レンジ→沈黙 | nan-infinity-invalid-range-silence(→ `{}`) |
| body smoothing フレーム跨ぎ(ステートフル) | body-smoothing-lag-across-frames |
| 複数スロット混在 | mixed-face-eyes-mouth-slots |
| clamp 極値 | head-centered-invert-strength-clamp / body-clamp-extremes / disabled-slot-and-clamped-target |

重大な抜けなし。等価性の主張は空洞ではない。

---

## 3. 活性度直接入力テスト・沈黙テスト(headless-slot-resolver.test.ts 11件)

裁定を正しく固定:

- **裁定5(0=開/1=閉、target.min=閉/max=開)**: activation 1→target.min(0)、0→target.max(1)、0.5→中間(0.5)を固定(L16-54)。非単位レンジ 0.2..0.9 でも向きを確認(L56-77)。
- **裁定4(左右同値)**: 同一活性度で `param_eye_left_open === param_eye_right_open`(L79-91)。
- **沈黙**: target=null / disabled / activation null / entry 無し(undefined) / NaN・Infinity の5経路で `{}`、混在時は無効のみ落ち有効は残る(L93-180)。
- **clamp**: strength 2 で target.max に丸め(L182-196)。
- **body smoothing**: bodyFollowState 無し=素通し / 有り=lag(L198-228)を固定。

いずれも手計算可能な期待値を assert しており(トートロジーでない)、Domain B/C の消費者接点(blink 活性度直接注入)を正しく契約化している。

---

## 4. 自分で実行したテスト結果

作業ディレクトリ `apps/runtime-player`:

- `npx vitest run src/main/live-mapping/` → **69/69 pass**(6 ファイル: equivalence 20 / headless-slot-resolver 11 / 既存 frame 19 / vowel-lipsync-estimator 10 / auto-mapping 3 / live-mapping-state 6)。
- `npx tsc --noEmit -p tsconfig.json` → **exit 0**(エラーゼロ)。
- 非トートロジー検証(pre-refactor 差し替え): equivalence 20/20 + frame 19/19 = **39/39 pass**、直後に新版へ復元し作業ツリー無汚染を確認。

既知 baseline fail(browser-source-server 系 2 件、Wave21 由来)は本レーン対象の live-mapping には非該当。live-mapping スコープは全緑。app 全体(565/2)の再検証は本レーン外のため未実施。

---

## 5. 決定論

決定論的。壁時計・乱数依存なし:
- `producedAtMs`(1000 等)・`sequence`・`timestampMs` はすべて固定。`producedAtIso` は producedAtMs から純導出(旧 frame test で `1000→"1970-01-01T00:00:01.000Z"` を確認)。
- `RuntimePlayerBodyFollowState` / `RuntimePlayerVowelLipsyncState` は各シナリオで fresh インスタンス化 → 状態は入力のみで決まる。
- vowel golden の精密 float(例 `0.9234442540521833`)は固定 capture(`vowel-captures.json`)由来で再現的。`Date.now`/`Math.random` の使用なし。

---

## blocking 差分

なし。

## 裁量注記(非 blocking)

- **直接ユニット網羅の粒度**: `headless-slot-resolver.test.ts` の公開関数直接テストは blink(weight)/head-centered/body-x に集中し、`mouth-vowel`(createVowelTargetValue)・`gaze-centered`・`body-z` の成分経路は公開 API 単体としては直接固定していない。ただし新実装では等価性バッテリがこれら全 sourceKind をリゾルバ経由で通す(69/69 pass で確認)ため、golden 経由で挙動は固定済み。等価性の実効性には影響しないため非 blocking。Domain B/C 側で vowel/centered をリゾルバへ直接注入する場合、公開 API 単体テストの追加を将来検討する価値あり(スコープ外)。
- golden 更新口(`UPDATE_RESOLVER_GOLDEN=1`)は Domain C 以降でトラッキング挙動を意図的に変える時以外は再生成しないこと(不変条件の背骨)。完了報告の申し送りと一致、妥当。

## 質問

なし。本レーン(test adequacy)に blocking 事項なし。等価性 golden の実効性は決定的に確認済み。
