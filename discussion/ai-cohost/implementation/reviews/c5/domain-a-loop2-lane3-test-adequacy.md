# C5 Domain A レビュー (loop-2, lane3: test adequacy 再確認・狭域) — 追加連続性テスト4本

> Review-Sylph (test adequacy) → Orch-Sylph。対象: **loop-2 の追加テスト4本 + コメント2箇所のみ**(source 曲線ロジックは無変更)。loop-1 の合格結論は再検証しない。
> 全主張を自分でコード確認・テスト自走・数学検算した(Gnome報告§3の「連続で pass」も自分で再現・検算)。

## 判定: **合格**(loop-2 追加分)

loop-1 test adequacy が指摘した「re-attack・切断(releaseAll)が点検査止まりで bound-walk 化されていない」穴(#1/#3)と、動く非零base×decay の未走査(#2/質問2)、案B end-to-end 未通し(#5)を、追加4本が**性質テスト(全域 walk)**として正しく閉じている。4本とも導出bound はマジックナンバー不在で、上界がタイト(真のスナップを捕捉する頭上数%〜同値)。既存テストは非破壊(4本すべて新規 `it()` の追加であり、置換ではない)。

追加分を特定できたことの確認: git diff は loop-1 分も混在するが、loop-2 の4本は describe/it 名と「coverage穴#…」コメントで一意に識別できた。store は連続性describe に **テスト1(seam)** と **テスト4(非零base)** を追加(13→15)、heart は **テスト2(releaseAll walk)** と **テスト3(release中re-attack)** を追加(7→9)。計+4、report §5 の内訳と一致。

---

## 4本それぞれの妥当性

### テスト1: re-attack seam の bound-walk (store層, 穴#1) — 妥当
`control-channel-overlay-store.test.ts` "continuity property" describe:「keeps every adjacent step within the DERIVED bound across a re-attack seam (重ねがけ)」。
- **walk網羅性**: `for now = 0…endMs(=96+240+160+240+400=1136) step16` で **re-attack(t=96)を跨ぐ全域**を walk。点検査でない。seam の1tick前後も連続として含まれる。
- **seam threading の正しさ**: 私は store 実装で `setEnvelope` の `startValue = #effectiveStart = #lastResolved[slot]`(直近 snapshot でキャッシュした prevResolved)を確認。テストは now===96 で **先に** `snapshot(96,…,prevResolved)` を呼んで `#lastResolved` を value@80 に更新→**その後** `setEnvelope(specB,96)` を呼ぶ順序。これは load-bearing で正しい(順序が逆だと startValue が古い値になる)。よって seam step ≈ 0(startValue=prevResolved)で連続、案B(prevResolved 起点)を正しく再現。
- **bound導出・マジックナンバー不在**: `maxPeak=max(0.8,0.5)=0.8`、`attackStep=maxPeak/min(attackMsA,attackMsB)×MAX_SLOPE×frameInterval=0.8/240×1.5×16=0.08`、decayStep 同=0.08、releaseStep=0.8/400×1.5×16=0.048、bound=0.08。全因子が spec フィールド or 公開定数。最広スパン÷最短相の保守上界。
- **タイトさ**: bound=0.08 は specA の attack 最大per-tick step(=0.08)に一致。真のスナップ(1tickで0.8跳躍)は 0.08 で確実捕捉(10倍差)。緩すぎない。

### テスト2: releaseAll(切断) の per-tick bound-walk (心臓層, 穴#3) — 妥当
`autonomous-frame-heart-channel-overlay.test.ts`:「keeps every adjacent frame step within a DERIVED bound across releaseAll (切断)」。
- **walk網羅性**: 2スロット(eye-blink-left/right)を open(activation0)長TTL稼働→`releaseAll(16)`→`for now=16…16+400+16 step16` で**両スロットの release窓全域**の隣接published-frame差を walk、終端で基底(0,0)復帰も assert。隣接frame差の性質テストで、点検査でない。
- **bound導出**: `handOff=0`(open activation)、`base=1`(closed generator activation)。`|0−1|/400×1.5×16=0.06`。`handOffActivation=0`/`baseActivation=1` はチューニング閾値でなく fixture の意味値(open/closed activation)で、コメントに `|Δparam|=|Δactivation|`(invert・単位域)の根拠あり。マジックナンバーとは見なさない。
- **タイトさ**: bound=0.06 は forced-release smoothstep の中点最大step(=0.06)に一致。真のスナップ(1tickで1跳躍)を捕捉。

### テスト3: release中 re-attack + 案B end-to-end (心臓層, 穴#4/#5) — 妥当
`autonomous-frame-heart-channel-overlay.test.ts`:「keeps continuity across a re-attack that lands mid-release (release中re-attack, 案B end-to-end)」。
- **実フィードバックループ経由の確認(手動注入でない)**: 私はコードで確認した。storeProvider が heart に `getChannelOverlay:(nowMs,baseValues,prevResolved)=>store.snapshot(…)` を配線し、heart が `lastResolvedActivations` を prevResolved として供給する。テストは **prevResolved を手動注入していない**——`setEnvelope(specB,640)` の startValue は heart の snapshot が populate した `#lastResolved` を消費する。よって「案B end-to-end(retain経由)」の主張は成立。テスト1(手動 threading)との差別化も明確。
- **seam跨ぎ**: specA(peak0/attack160/sustain100/decay160, start32)の release窓は [452,852)、re-attack(640)は窓内。walk は `for now=16…endMs(=640+160+100+160+400=1460)+16 step16` で seam を跨ぐ全域。終端で closed基底(0)復帰を assert。
- **bound導出**: `maxSpan=1`、attackStep=1/160×1.5×16=0.15(specA attack: startValue=base1→peak0, 振幅1が支配)、decayStep=max(0,0.2)/160×…=0.03、releaseStep=1/400×…=0.06、bound=0.15。activation単位域由来でマジックナンバー不在。startValue=1 は tick16 の baseline resolved(closed=1)由来であることをコードで確認。

### テスト4: 非零・動くbase × decay characterization (store層, 穴#2/質問2) — 妥当
`control-channel-overlay-store.test.ts`:「stays continuous through envelope decay over a NON-ZERO moving base (characterization)」。
- **base移動項を含む bound導出の正当性**: livingBase は 0.3→0.5 の有界線形ramp(`baseSlopePerMs=0.2/700`)。`baseMovementStep=baseSlopePerMs×16≈0.004571` を全相に保守加算。base移動由来もマジックナンバーでなく ramp 定義から導出。全相への一律加算は安全な上界(過大でなく実質 decayStep が支配)。
- **`sawDipBelowBase` を assert しつつ全walk bound内を固定**: `for now=0…700 step16` で base を毎tick動かし、各 `|value−previous|≤bound` を検査、かつ `value<b` を観測して `sawDipBelowBase===true` を assert。dip観測と連続性を**同時に**固定している。

## テスト4 の dip×連続性 自己検算(Gnome §3 の結論を独立再現)

- **bound**: attackStep=|0.8−0.3|/100×1.5×16=**0.12**、decayStep=|0.8−0|/100×1.5×16=**0.192**、releaseStep=|0−0.5|/400×1.5×16=**0.03**、baseMovementStep≈**0.004571**。`bound=max(0.12,0.192,0.03)+0.004571≈**0.19657**`(report §3 の「約0.197」と一致)。
- **decay の最大per-tick step(検算)**: decay相 [200,300)、振幅0.8。中点を跨ぐ tick 240→256 で自分で計算: value@240=0.8·(1−smoothstep(0.4))=0.8·0.648=**0.5184**、value@256=0.8·(1−smoothstep(0.56))=0.8·0.4104=**0.3283**、Δ=**0.1901** ≤ bound 0.19657(頭上約3.4%)。**bound内で連続**を確認。
- **dip の観測(検算)**: decay終端(e=300)で value=0、その時 base=0.3+0.000286·300≈**0.386** → value(0) < base(0.386) で dip 発生。decay中点(t≈250)でも value≈0.26 < base≈0.371 で dip。`sawDipBelowBase===true` は正当。
- **decay→release境界の連続性**: decay終端 value=0、release始端 `lerp(base,releaseFrom=0,w=1)=0` で値連続(スナップ不能)。release は 0→livingBase を smoothstep blend、per-tick ≤ releaseStep+baseMovement。
- → Gnome §3「bound超過 observe されず・連続で pass・escalate不要」を**独立に再現・検算し一致**。decay が非零base下へ dip する現行挙動は bound内で連続。

## 決定論性・非破壊性

- **決定論性(4本とも)**: 合格。全 walk が固定 nowMs列(16の倍数)・heart は seed=1・手動scheduler(`vi.fn`相当)で時刻注入。乱数・実時計・非単調時刻依存なし。store.snapshot は純評価。再現的。
- **非破壊性(追加であり置換でない)**: 合格。4本はいずれも既存 describe への新規 `it()` 追加で、既存テストの削除・改変を伴わない(diff上 pure addition)。既存の C5化リネーム/置換は loop-1 分で本ループ対象外。store 13→15 / heart 7→9(+4)、report §5 内訳と一致。source(`slot-curve-state.ts`/`control-channel-overlay-store.ts`/`autonomous-frame-heart.ts`)は無編集をコードで確認。

## 差分・要修正

なし。

## テスト結果(自走)

- 対象2ファイル: `npx vitest run -c vitest.config.ts control-channel-overlay-store autonomous-frame-heart-channel-overlay` → **24 passed**(store **15** / heart-overlay **9**、追加4本すべて green)。
- 全体: `npx vitest run -c vitest.config.ts` → **832 passed / 2 failed / 136 files**(loop-1 の 828 から +4、失敗数不変)。
- **既知baseline fail 2件を自分で分離確認**: `src/main/broadcast-source/browser-source-server.test.ts`(serves current Runtime Export payload…)と `src/stage/browser-source/browser-source-server-message.test.ts:216`(not-loaded response shape)。両者とも `effectiveDynamicsTuning: null` の schema drift で、overlay/曲線と無関係・Domain A の diff 対象外。委任の「browser-source系2件」に一致。
- smoothstep max slope 再検算: `f'(x)=6x(1−x)`、x=0.5 で `6·0.25=1.5` → 定数 `RUNTIME_PLAYER_SMOOTHSTEP_MAX_SLOPE=1.5` 一致。

## 質問 / test adequacy 視点の追加所見

1. **decay意味論の open 論点**(peak→0 か peak→livingBase か)は依然 lane2/設計(Undine)の裁定事項で、本ループは現状挙動を無害に固定しただけ——この扱いは test adequacy 上妥当(連続性は保たれ、挙動変更なし)。**追加所見(非blocking)**: テスト4の tripwire は `sawDipBelowBase===true`(dip が起きたことのみ)で、dip の**深さ・持続**は pin していない。将来 decay を peak→livingBase/2 のような部分変更にした場合、依然わずかな dip が残れば assertion が pass してしまい tripwire が発火しない可能性がある。完全な peak→livingBase 化なら dip 消滅で発火するので主目的は満たすが、意味論変更に対する感度を上げたいなら「decay終端 value が base 由来の期待値に近いこと」を1点 pin する余地がある。ただし depth の厳密固定は over-fit になるため、現状は**推奨止まり**で合格を妨げない。
2. テスト2/3 の `handOffActivation=0`/`baseActivation=1`/`maxSpan=1` は fixture の open/closed activation・単位域に由来する意味値で、チューニング閾値ではないためマジックナンバー不在の判定に影響しないと見なした。異論があれば Orch で確認されたい。
