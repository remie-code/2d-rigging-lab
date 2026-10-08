# C3 Domain C レビュー — レーン3: test adequacy

> Reviewer: Review-Sylph(opus)、2026-07-11。委任元: Orch-Sylph。対象: `apps/runtime-player`、Domain C `cohost-c3-physiology-page-profile`。
> 判定基準: c3-wave-plan.md §6/§8/裁定4、c3-physiology-profile.md §3/§6、Gnome報告 domain-c-physiology-page-profile.md §4。
> 判定: **合格**(blocking なし。minor な coverage 強化提案あり、非blocking)。

---

## 1. 判定サマリ

Domain C のテスト群は、レーン3の中核問い(store parse/save/stale拒否/独立性・provider参照契約・bridge生理不在契約・ページrender[空状態2つ/数字非露出]・写像/範囲正規化)を **実装可能な最弱アサーションではなく「不正実装を落とせる」形で固定** している。自分で全件実行し、報告の「706 passed / 2 failed」を再現。2 failed は browser-source-server の Wave21 `effectiveDynamicsTuning` baseline で **Domain C 対象外**であることを確認した。blink golden 2本は git 上 **無変更**(diff 空)を確認。

## 2. 実行確認(自分で実行)

- Domain C 対象 + 退行ゲート:
  `pnpm exec vitest run src/main/physiology-profiles/ physiology-bridge-handlers.test.ts src/control/physiology-page.test.ts physiology-config.test.ts blink-behavior-fixture.test.ts`
  → **7 files / 39 passed**(tone-config 6・store 7・state 8・bridge 4・page 6・config 4・blink-fixture 4)。
- 全スイート: `pnpm exec vitest run` → **119 files / 708 tests → 706 passed / 2 failed**(報告と一致)。
- **2 failed の正体**: 両方 `src/stage/browser-source/browser-source-server-message.test.ts`。差分は `effectiveDynamicsTuning: null`(Wave21 Dynamics Tune 由来の既知 baseline)。physiology とは無関係、browser-source は Domain C 未変更。→ **既知 baseline / Domain C 対象外を確認**。
- 退行ゲート git: `git diff --stat` で blink golden 2本(`blink-default.golden.json` / `blink-alt-config.golden.json`、共に tracked)は **diff 空**。

## 3. レーン観点ごとの評価

### 3.1 store(合格・強い)
`physiology-profile-store.test.ts`(7件):
- **stale 2種を独立に固定**(mutant kill 良好):
  - schemaVersion 不一致 reject(L63-95): legacy doc は fingerprint を **一致**させたうえで `schemaVersion:"v0"` のみ違える。よって schemaVersion 検査を外した実装は `loaded` になり **テストが落ちる** → 検査の存在を真に固定。`state:"read-failed"`・`profile:null`・warning "schema version" を確認。
  - fingerprint identity 不一致 reject(L97-115): 現行 schemaVersion + 正しいパス + doc が別 fingerprint を主張 → identity 検査のみが reject 理由。identity 検査を外した mutant を落とす。warning "does not match"。
- **二 export 独立**(L117-139): A save→A loaded / B missing + `identityA.fingerprint !== identityB.fingerprint` を固定(パス分離)。
- **二スロット独立**(L141-163): userData root 分離で A loaded / B missing。
- persist+reload roundtrip(L41-61)・missing + 正確な slot-scoped path(L18-39)・corrupt JSON(L165-181)。

### 3.2 provider 参照契約(合格・核を的確に固定)
`physiology-state.test.ts`:
- 既定 = full grammar かつ **STABLE ref**(L33-45): `second toBe first`、`gaze/head` が `DEFAULT_*_BASELINE` と equal、`stagePresence:{enabled:false,strength:0.3}`。
- tone 変化時のみ **NEW ref**(L47-59): `after not.toBe before` + `after.head.sway not.toBe before.head.sway` + 再度不変で `toBe after`。
- → 裁定3の heart 再構築 seam(参照比較)前提を、`toBe`/`not.toBe` を分けて厳密固定。Domain A の golden 不変とも整合。

### 3.3 bridge 生理不在契約(合格)
`physiology-bridge-handlers.test.ts`:
- tracking(`isAvailable:()=>false`)→ `status.available:false` / `status:"unavailable"`(L47-64)。available は **注入された state の isAvailable seam から data で**来る(role 問い合わせでない)ことをテスト構造が固定。
- autonomous(`isAvailable:()=>true`)→ `available:true`(L66-80)。両側固定。
- validation(未知 section/field → `validation-error`, L118-132)。

### 3.4 ページ render(合格)
`physiology-page.test.ts`:
- **空状態2つを別文言で固定**: tracking(available:false)= "This host has no physiology; the body is driven by tracking." かつ `not "Camera Focus"`(L21-34)/ export未ロード(available:true,status:unavailable)= "Physiology comes alive once a Runtime Export is loaded."(L36-48)。
- 全セクション/スライダー描画(L50-71)。
- **数字非露出**(L73-87): 単位語("Hz"/"probability"/"/min"/"blinks")+ 内部 ms/比("3529"/"1400"/"6000"/"0.55"/"0.12")の不在。**"3529" は実 `DEFAULT_BLINK_BASELINE.meanBlinkIntervalMs`、6000/1800 は frequency 端点**であることを確認済み → 実在の leakable 値を狙った有効なガード(質感語のみの規律を保つ)。
- セクション別 Reset の enable/disable(override 有=fire、無=disabled、L89-111)・スライダー onChange・Stage Presence トグル(L113-137)。

### 3.5 写像/範囲正規化(合格・回帰アンカーとして重要)
`physiology-tone-config.test.ts`:
- **all-default tones = 普遍 full baseline を deep-equal 固定**(L17-33): `DEFAULT_*_BASELINE` かつ `DEFAULT_FULL_PHYSIOLOGY_CONFIG.*` と一致。「Reset=普遍既定」「default=full」を同一構成に縛り、**blink golden 不変(Domain A)の前提**を守る。
- Head Follow 上限(L45-53): `maxFollow.head.follow===1` かつ `*0.6 < 1` →「全部は向かない」条件を固定。
- Frequency 逆写像(L55-68)・clamp [0,1](L70-80)・resolveEffectiveSectionTones/sectionHasOverride(0.5=非override, 0.9=override 含む, L82-99)。

### 3.6 退行ゲート(合格・一部は非git検証)
- blink golden 2本: git diff 空(tracked、検証済み)。
- Domain A `physiology-config.test.ts`(4件)・`blink-behavior-fixture.test.ts`(4件)パス。
- 注意: physiology-config.test.ts / physiology-config.ts は **untracked**(Domain A の未コミット新規)。よって「Domain C が触っていない」を `git diff` で厳密証明できない(コミットが無い)。ただし ①blink golden diff 空 ②tone-config が default=baseline を deep-equal で固定 ③config テスト green の三点で、DEFAULT 群・golden 出力が保たれている実質を確認。

## 4. カバレッジの穴(全て minor / 非blocking)

1. **debounce の coalescing 未固定(最も指摘したい点)**: bridge テスト(L82-116)は「1 edit → debounce 後 1 save」を見るが、**窓内の複数連続 edit が 1 save に畳まれること**を固定しない。debounce を外して edit 毎 save する実装でも本テストは通る。レーンは "save(debounce)" を明示するので、`saveNow` 抑止(N edits/窓内 → saveCount 1)の 1 アサーション追加が望ましい。save-controller 専用テストは存在しない(Gnome の並列複製元 Dynamics Tune 側の証明に依存)。→ blocking 不変条件(role分岐/純度/golden/数字露出)は脅かさないため非blocking。
2. **profileStatus の未カバー種**: `saving` / `saved`(save 完了遷移)/ `save-failed`(fs エラー)/ `load-warning` は state テストで固定されていない(default/restored/stale/unsaved/unavailable のみ)。bridge テストも edit 後 "unsaved" 確認で止まり、"saved" 遷移は未固定。
3. **flush on unload/change/quit 未テスト**: runtime export 切替・quit 時の未保存 flush(Gnome §2.4 配線)がユニット固定されていない(main 配線・統合寄り)。
4. **ページの save-failed バナー / onRetryProfileSave** を通す経路が未テスト(prop は存在)。
5. **Stage Presence トグルの視覚反映**: `stagePresenceEnabled` を checked に反映する側が未アサート(コールバック発火のみ)。

いずれも §6 必須項目そのものの欠落ではなく、周辺の状態遷移・耐障害の固定不足。将来退行を許す隙として記録するが、合格を妨げない。

## 5. 質問(Orch-Sylph へ)

- Q1: 上記穴1(debounce coalescing の未固定)を **本 Domain で 1 アサーション追加**するか、Dynamics Tune 側の既存証明で足りるとして **申し送り**扱いにするか。レーン基準の "save(debounce)" 充足度としては現状「debounce の存在は間接的にしか固定されていない」ことを Orch 判断に委ねたい。

## 6. 結論

**合格**。中核問い(parse/save/stale×2独立/二export・二スロット独立/provider toBe・not.toBe/bridge data absence/空状態2つ/数字非露出[実在値アンカー]/default=full baseline/head follow上限)は不正実装を落とせるアサーションで固定され、全件パス。退行ゲート(blink golden 無変更)確認済み。2 failed は browser-source Wave21 baseline で Domain C 対象外。指摘は全て非blocking な coverage 強化提案。
