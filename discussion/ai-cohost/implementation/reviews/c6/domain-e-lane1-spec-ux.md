# C6 統合Domain E改 レビュー Lane1(spec/UX突合)

> レビュー担当: Review-Sylph(Orch-Sylph からのサブエージェント委任、Lane1=spec/UX)。2026-07-12。
> 対象: `cohost-c6-followup2-articulation-slider`(未コミット作業ツリー)。
> 判定基準: c6-wave-plan.md §12項目2・§13・§13補遺 / c6-mouth-phoneme-timeline.md §3.5改定・§7.1裁定B / c3-physiology-profile.md / domain-a-report.md。
> 手法: Gnome報告(domain-e-followup2.md)は参考に留め、`git diff`・対象ファイル Read・原典逐条突合で自力裏取り。

## ループ番号

**1**(初回レビュー)

## 判定

**合格**(blocking差分なし)

---

## 9観点の適合状況

### 観点1: キャプション逐語一致 — 適合

`physiology-page.tsx` L135 の Articulation キャプションは実測:

```
How sharply the mouth re-forms between beats. Right = crisper.
```

委任指示の要求文字列と一字一句一致(先頭 `How`、`re-forms`、`between beats.` のピリオド+スペース、`Right = crisper.` のイコール前後スペース・末尾ピリオド、全て一致)。
UX doc `c3-physiology-profile.md` §3.1 追記行(L75)も同一文字列:「`| Speech: Articulation | How sharply the mouth re-forms between beats. Right = crisper. |`」。二箇所で完全一致。

### 観点2: 数字非露出 — 適合

Speech セクションの UI 表示要素(`physiology-page.tsx`)は label=`Articulation`、caption=上記逐語のみ。ms/Hz/floor値(0.4等)/確率いずれも露出なし。スライダーは既存 `ToneSlider`(min0/max1/step0.01、value readout無し)を再利用。工学数字は tone-config 内部定数(`ARTICULATION_FLOOR_*`)に閉じ、UI へ漏れていない。UX doc §2 追記の日本語解説は「口の作り直しの鋭さ」等の質感語で、`0.75`/`0.4` 等の数値露出なし(「弱値」「器側普遍既定値層」は設計概念で数字ではない)。

### 観点3: キャプションの方向整合 — 適合

`mapSpeechConfig` は `anchoredLerp(articulationTone, SOFT=0.9, DEFAULT=0.75, CRISP=0.4)`。`anchoredLerp`(L111-122)は tone0→atZero, tone0.5→atHalf, tone1→atOne の単調3点補間。よって floor は tone上昇で 0.9→0.75→0.4 と**単調減少**。低floor=深いディップ=くっきり(評価器 `dipFactor(dt, floor)` は境界で `floor` まで沈む)。「Right = crisper」= 右で floor が低く=くっきり、で写像方向一致。左端 floor=0.9 = barely dips = 沈まない、も一致。

### 観点4: 既定値=弱値が範囲内 — 適合

既定 tone0.5 → `ARTICULATION_FLOOR_DEFAULT=0.75`(anchoredLerp の tone0.5 は atHalf を厳密返却)。範囲は [左端0.9 … 右端0.4]。0.75 はこの範囲内。右端 `ARTICULATION_FLOOR_CRISP = RUNTIME_PLAYER_SPEECH_DIP_FLOOR`(=0.4、マジックリテラルでなく評価器定数を import)で「現行値 floor 0.4 を範囲の中に含める(右端)」を充足。§13補遺②「既定値=弱値(floor 0.75相当)を範囲内に」の逐語要求に一致。

### 観点5: グループre-attack(裁定B) — 適合

- `setSpeech`(overlay-store)は per-slot 曲線 delete の**前**に `onsetFromOpen = #effectiveStart(RUNTIME_PLAYER_SPEECH_MOUTH_OPEN_SLOT)` を捕捉し `SpeechTimelineState.onsetFromOpen` に載せる。
- `#effectiveStart` は `#lastResolved[slotId]` を読む**既存の C5案B(prevResolved)機構そのもの**。新機構の発明なし(diff で helper 本体は既存のまま流用)。逆方向 re-attack(`#yieldSpeechForSlot`)と対の順方向で、コメントも「the forward version of the existing reverse re-attack機構; no new machine」と明記。
- 評価器: 旧 `s = sRaw*dip*onset*term*SCALE` を `sNatural = sRaw*dip*term*SCALE` / `s = lerp(onsetFrom, sNatural, onset)` に分解。**単一 s** から6スロットを代数導出する構造は不変=凸恒等 Σvowel=s=mouth.open は re-attack 中も**構造保証**(後段補正・辻褄合わせなし)。
- golden無退行の根拠が代数的に妥当: idle常況 `onsetFromOpen=0` で `lerp(0,sNatural,onset) === sNatural*onset` = 旧式と厳密一致。domain-a の決定論golden・凸恒等・ディップ・undershoot・onset・連続性テストが無変更で通る主張は、この代数恒等により裏付けられる。

### 観点6: `--loop` — 適合

- `reference-driver.mjs` の `--loop` は `flags.includes("--loop")` で分離。依存ゼロ `.mjs` のまま(import追加なし)。
- 既存の非loop経路: `--print-timeline`(WS/URL不要 dry-run)は無変更。機械テスト spawn(`--loop`無し)の `runSpeechScenario` 本体は、`speechSpanMs` 宣言を関数冒頭へ引き上げた以外ロジック不変で通る(loop分岐は早期 return する別ブロック)。
- `apps/soul/package.json` は不在確認済(`ls`→No such file)。新設なし。
- loop停止意味論: kill まで継続=report/exit0 に到達しない調整用、想定外拒否/接続断は `fail`(exit1)。委任スコープ(手動再ゲート用)に合致。

### 観点7: UX doc 追記の妥当性 — 適合

- §2 mock: `Speech` セクション(`Articulation --o------ (口の作り直しの鋭さ)` + `[Reset]`)を Posture と Stage Presence の間に追加。既存 mock の記法・質感語・数字非露出規律に沿う。セクション一覧行も「Blink / Gaze / Head / Posture / Speech / Stage Presence」へ更新。
- §3.1: キャプション表に Articulation 行を追加(観点1で逐語一致確認済)。
- 追記が実装事実と一致: スライダー1本・Reset・空状態②(トラッキングホスト生理不在)言及、いずれも実装(physiology-page.tsx / physiology-state.ts)と符合。

### 観点8: role分岐ゼロ / config seam 再利用 — 適合

`input-subsystem.ts` は overlay store 構築時に `dipFloorProvider: () => deps.physiologyConfigProvider?.().speech?.articulationFloor` を配線。実行時 `if (role === ...)` 分岐なし=**data 供給**(既存 physiology config provider seam に相乗り、stagePresence の前例に倣う additive)。provider/speech 欠如時は `undefined`→評価器普遍既定へ fallback。トラッキングホストは空状態②の既存分岐のまま(physiology-page.tsx L220-229 無変更)。

### 観点9: 契約非露出 — 適合

- control-channel の intent 契約 `contract/channel-protocol-contract.ts`・`channel-intent-validation.ts` は `git status` 上**無変更**。floor は intent.speech payload・schema・validation・拒否語彙に一切露出なし。
- `SpeechTimelineState.onsetFromOpen` / `SpeechTimelineSampleOptions.dipFloor` は評価器・store の**内部状態/オプション型**であり wire 契約ではない。
- `physiology-bridge-contract.ts` の変更は physiology **UI bridge** 契約(`articulation` **tone** [0,1] を運ぶ正規経路)であって、control-channel の発話 intent 契約とは別系統。floor **値**そのものは bridge にも載らず(tone のみ)、写像は Player 側 tone-config 内に閉じる。

---

## blocking 差分

**なし。**

## 裁量判断(設計未定義だが合理と認めるもの)

1. **左端 floor=0.9**(exactly 1.0 でなく): 「floor≈1.0=沈まない」の "≈" に従い strictly<1 を採用。floor=1.0 は o×5 連続を完全静止させ「非静止が範囲両端で成立」の絶対条件を破るため、0.9(barely dips)が妥当。非静止テスト閾値を floor から導出しており、後日 `ARTICULATION_FLOOR_SOFT` を 0.95 等へ寄せても閾値自動追従=規律を壊さない設計。妥当。
2. **既定 floor=0.75 / 評価器普遍既定 0.4 据置**: §13補遺で Domain D の「評価器floor 0.4→0.7〜0.8弱体化」は Articulation スライダーへ統合され、走行時弱化は**プロファイル補正層**(既定tone0.5→0.75)で実現、評価器普遍既定は範囲右端0.4のまま。結果 golden は評価器普遍既定を使い続け更新不要。§13補遺②の逐語意図(既定0.75相当・現行0.4を右端に)に忠実で、Domain D 単独案の「golden意図的置換」より副作用が小さい。spec準拠として妥当。
3. **`--loop` の非終端意味論**: kill 依存の調整用。手動ゲート専用フラグとして合理。

## 質問(人間ゲート向け申し送り、Lane1判定には非影響)

1. 走行時の既定ディップが 0.4→0.75 に弱まる(設計意図どおり)。`--loop`+スライダーでの「ちらつかず・凍らず」最終位置探索はユーザー人間ゲート(本波未実施)。見つかった位置が既定 0.75 と乖離する場合、Reset位置(既定tone)の再調整が別途論点になり得る。
2. 左端 floor=0.9(10%ディップ)が人間ゲートで「まだ効きすぎ」なら `ARTICULATION_FLOOR_SOFT` を 1.0 直下へ寄せる余地あり(閾値自動追従)。本波は 0.9 を据える。

以上、Lane1(spec/UX突合)として全9観点適合・blockingゼロにつき **合格**。
