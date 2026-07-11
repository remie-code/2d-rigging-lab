# C3 Domain B レビュー — レーン3「test adequacy」

> Review-Sylph(opus)、2026-07-11。委任元: Orch-Sylph。対象: `cohost-c3-gaze-head-posture-behaviors` / `apps/runtime-player`。
> 判定基準: [c3-wave-plan.md](../../orchestration/c3-wave-plan.md) §4.2/§6/§8/裁定5/§7、[c3-gaze-head-posture.md](../../../architecture/c3-gaze-head-posture.md) §1/§3/§4、Gnome 報告 [domain-b-gaze-head-posture-behaviors.md](../../waves/c3/domain-b-gaze-head-posture-behaviors.md) §6。

## 判定: **合格**(要修正なし。非ブロッキングの改善余地 5 点を付記)

テストは分布属性・結合・周期非検出・決定論・lerp不在・退行ゲート・quintic連続を実効的にカバーし、各アサーションは load-bearing(不正実装を実際に落とせる)。実行再現済み。

## 実行確認

```
pnpm --filter @private-2d-rigging-lab/runtime-player exec vitest run src/main/physiology src/main/role-composition
→ 12 files / 117 tests すべてパス(報告どおり再現)。既知 baseline fail(browser-source-server 系)は対象範囲外・未実行。
```

## 観点別の裏取り(実装定数まで確認)

- **lerp不在(§4-1)**: `gaze-saccade.ts` `LARGE_SACCADE_THRESHOLD=0.4`、`isLarge = distanceFromPrev>0.4`。gaze-behavior.test の `jump>threshold-0.05`(=0.35)は Ts±1(2ms)差でサッカード変位ぶんを測る。瞬時ステップは通り、lerp なら 2ms 間の delta が微小になり**確実に落ちる**。固視中 `maxWithin<0.02 かつ <jump/5` も微小揺らぎのみを固定。実効。
- **固視時間 floor が binding**: `MIN_FIXATION_MS=200` を `Math.max` で center(L158)と raw(L161)に二重適用。短dwell config(dwellMs=250, restlessness=1)で center=max(200,125)=200 となり、`atFloor>0` が空でなく**実際に floor に張り付く**ことを固定。floor無視実装を落とす。分散は std>100ms(等間隔=std0 を落とす)。
- **着地点ホーム重み**: nearHome/total>0.5、focused>restless の単調性。camera支配を固定。
- **結合1(目先頭後)**: `FOLLOW_DELAY_MIN=300/SPAN=400`(300–700ms)・`FOLLOW_RAMP=450`。テストは Ts+300 未満で `|d|<1e-9`(頭ゼロ=目が先)、発火が Ts+300〜Ts+1200 窓内、gaze着地と同符号、`|diffLate|<|large.x|`(全部向かない)を固定。過早追従・全追従・逆符号を落とす。
- **結合2(瞬き同期・切り詰め禁止)**: generator の max-abs マージ(`physiology-generator.ts` L87-90 `Math.abs(value)>Math.abs(existing)`)。テストは**全フレームで `f>=n-1e-9`** を数値固定(自然blink不減)+ 注入 blink 実在 + 注入は必ず大サッカード上(±340ms窓)。union 意味論を破る実装(置換・減算)を落とす。両眼等値(裁定4)は full-generator shape テストで `a[left]===a[right]` として固定。
- **結合3(体は頭の親)**: `POSTURE_TO_HEAD_H=0.4/TILT=0.5`。テストは `head_with−head_without` を `0.4·reseat.x`/`0.5·reseat.z` に **toBeCloseTo(_,6)** で厳密固定 + `sawNonZeroOffset`(reseat が実際に基線を動かした)。倍率のズレ・非結合を落とす。
- **周期非検出(裁定5)**: head(sway-only, 100ms×600s, 平均除去自己相関)で lag30s<0.5 + 20–90s帯 5s刻み<0.5(rebound不在=ループ不在)。posture body-x で 30–90s帯<0.6。単一正弦(周期Pが窓内なら τ=P で≈1へ rebound)を落とす。30s の倍約数周期も cos(2πk)=1 で捕捉。30秒ゲートの機械代理として成立。
- **決定論**: 同 seed/config/time→同値、異 seed/config→異列、cursor等価(gaze/head/posture 各 forward-walk = from-epoch, 巻き戻し含む)。head は coupling ring 込みで fresh-instance 等価を固定。full-generator は 2インスタンス `toEqual`。
- **quintic C¹/C²(Domain A 申し送り)**: `deterministic-noise.test.ts` に 2本追加。lattice で数値速度<1e-4(linear の velocity=(b−a)/cellMs≈2e-3 を落とす)、数値加速度<1e-7(cubic の |accel|≈|b−a|·6/cellMs²≈1e-5 を落とす)+ 内部 accel>1e-7 の生存 sanity。cubic/linear 退行を実検知。既存12を保ち14へ。
- **golden/退行ゲート**: `full-generator-snapshot.golden.json`(25時刻×8スロット, round6)で代表時刻の決定論を pin、900frame 肥大回避(§7配分)。**C2 blink golden 2本**(`blink-default`/`blink-alt-config`)・`blink-behavior.ts`・`blink-behavior-fixture.test.ts` は **tracked かつ `git diff --stat` 空=不変**を確認。critical retention gate は保持。
- **physiology 純度**: posture が `body-follow-state` を import しない構造テスト(コメント除去後 include 判定, 裁定2)。

## 非ブロッキングの改善余地(将来退行の隙・低〜中severity)

1. **結合2の確率性(p=0.3)が未 pin**: 「注入 blink は必ず大サッカード上」は**必要条件のみ**。大サッカード**全部**に同期 blink を出す過注入実装でもパスする(subset 性を固定していない)。load-bearing な「自然blink不減」は固定済みなので severity 低だが、§3-2「確率的」の意味は落とせない。改善案: 大サッカード数に対する注入数の比が 1 未満(例 <0.7)であることを一本追加。
2. **Gaze Restlessness の「空間的広がり」未 pin**: landing テストは home-share 単調性(focused>restless)のみで、§6「着地点の空間的広がり」= 脇バケツの分散増を直接アサートしていない(テスト名は "widens spread" だが検証は home-share)。改善案: restless config で `Math.hypot(x,y)` の分散/95pct が focused より大、を一本。
3. **結合1「Ts+300 未満で全 t ゼロ」の seed 依存脆さ**: firstLargeWithX(0.2) が選ぶサッカードより前に、変位>0.4 だが |x|<0.2 の(縦優勢)大サッカードが存在すると、follow.x が Ts 以前に >1e-9 を出し得る(follow は x/y 両軸をランプ, L204-205)。本 seed では通るが、seed/config 変更で脆い。改善案: 「本 saccade が最初の大サッカードである」ことを明示 assert するか、判定を最初の大サッカード基準に統一。
4. **Domain A 退行ゲートの git 機械検証不能**: `physiology-config.test.ts`/`deterministic-noise.test.ts` は untracked(C3 全体が本ブランチ未コミット)ため、「Domain A 無変更」は working-tree レベルの主張で git diff で機械確認できない。ただし真に load-bearing な C2 blink golden 2本 + blink-behavior 系は tracked かつ不変を確認済みで、§8 の retention gate(C2 blink golden 不変)は満たす。commit 後に Domain A ファイルの diff を確認するのが望ましい(Domain E で回収可)。
5. **quintic 判別力の局所依存**: 速度/加速度差分は channel 15 の 4 lattice cell の |b−a| に依存。内部 accel>1e-7 の sanity で緩和済みだが、選定 cell の変位が小さいと cubic/quintic の識別余裕が縮む。現状は十分な余裕(1e-5 vs 1e-7)。

## 質問(Orch/Undine 判断)

- なし(ブロッキング事項なし)。上記 1–4 は Domain E か将来 wave で回収可能な質改善で、Domain B の合否を左右しない。

## 結論

test adequacy レーンとして **合格**。分布属性・結合・周期非検出・決定論・lerp不在・退行ゲート・quintic 連続のいずれも、対応する不正実装(等間隔・floor無視・全追従・逆符号・blink切り詰め・倍率ズレ・単一周波数・lerp・cubic/linear 退行)を実際に落とすアサーションで固定されており、117 tests パスを再現。C2 blink golden 2本の不変も git で確認。付記 5 点はいずれも非ブロッキング。
