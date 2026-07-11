# C5 Domain C レビュー (lane2: design/development)

> Reviewer: Review-Sylph (lane2=design/development)。Orch-Sylph からの委任。読み取り専任（本レポートのみ Write）。
> 対象: Stage Presence 入力を純生成器値→合成後実効body信号へ差し替え。Domain C の変更2ファイル:
> - `apps/runtime-player/src/main/role-composition/autonomous-frame-heart.ts`(source)
> - `apps/runtime-player/src/main/role-composition/autonomous-frame-heart-channel-overlay.test.ts`(Domain C 分は Stage follow テスト1件 + import)
> 判定基準: 設計 §1-1 / 棚卸し §2.4 / wave-plan §6 Domain C。実装報告はクロスチェック用に参照(鵜呑みにせず差分で確認)。

## 判定: **合格**

design 的に健全。snapshot 位置・タイミング・coupling の意味・エッジケースいずれも設計裁定と一致。対象テスト55件 + typecheck を自分で回して pass 確認。要修正なし。非blocking nit 1点のみ(下記)。

---

## design 適合(観点ごと・根拠つき)

### 観点1: snapshot 位置/タイミング(裁定1 / 案B順序) — 適合

tick() 内の順序を差分で確認(`autonomous-frame-heart.ts:217-256`):
1. `activations = generator.sample()`(:217)
2. `overlay = getChannelOverlay(wallNowMs, activations, lastResolvedActivations)`(:233) ← **前tickの** `lastResolvedActivations`(案B re-attack START)を供給。
3. `resolvedActivations = overlay===null ? activations : {...activations, ...overlay}`(:234-235) ← merge seam **無変更**(C4 と byte 同一構造)。
4. `lastResolvedActivations = resolvedActivations`(:237) ← 次tick用に retain。
5. Stage snapshot が `resolvedActivations[BODY_*]` を読む(:248-252)。

- Stage snapshot は `resolvedActivations` 確定(:234)**後**に読む → 裁定1(合成後実効値に追従)を満たす。
- 案B の re-attack START 経路は非破壊: overlay provider(:233)は **上書き前**の `lastResolvedActivations` を読み、retain(:237)はその後。Stage snapshot(:248)は同一 tick の `resolvedActivations`(retain と同オブジェクト)を読むだけで、案B のフィードバック順序に干渉しない。retain を snapshot より前に置いた配置は re-attack 経路に無害(retain は次tick用、snapshot は現tick値の純読み取り)。
- merge seam(:234-235)は文字通り無変更。Domain A/B の合成ロジックに触れていない。BODY_* の読み出し元を pure `activations` → `resolvedActivations` に替えただけ。start/stop で `lastResolvedActivations = {}` リセット(:194,:282)も適切(新body が stale 実効値から re-attack しない)。

### 観点2: coupling の意味(§2.4・裁定1) — 適合

- `resolvedActivations` は **resolver**(`resolveSemanticSlotParameterValues`, :253-256)**と** Stage snapshot(:248-252)の**両方**に流れる。よってチャネルが body-x/body-z を駆動すると、リグの body.angle 変形(resolver 経由)と Stage オフセット(実効 body 経由)が両方追従する。これは §2.4 が述べる意図された構造的 coupling(裁定1「体は一つ」)そのもので、新たな破綻ではない。
- 二重適用手当て(strength 凸ゲイン `deriveStagePresenceStageMotionSettings`)は本 diff で無変更(git status 上も未変更を確認)。§2.4 の通り strength→settings 写像は入力出所非依存で、pure→実効の差し替えは二重適用を再オープンしない。source コメント(:245-247)がこの不変性を正しく明記。

### 観点3: エッジケース — 適合

- **body slot に曲線が無い**: overlay===null(または body-* に curve 無し)⇒ `resolvedActivations[BODY_*] === activations[BODY_*]` ⇒ C3 と byte-identical。C3 の既存 Stage テスト2件(`autonomous-frame-heart.test.ts` 内、posture 追従 / blink-only null)がアサーション無変更で pass することを実行確認。
- **null/絶対値の扱い**: blink-only config で body-* slot 不在 ⇒ `resolvedActivations[BODY_*]` は undefined ⇒ `readSignedActivation`(:325-327)が null を返す。C3 と一致。
- **非有限ガード**: `readSignedActivation` は `typeof === "number" && Number.isFinite(value)` を要求(:326)。resolved 値にも同じガードが効くため、万一 curve が NaN を出しても Stage 信号は null に落ちる(安全側)。
- **release 中間値の Stage 追従**: Stage snapshot は毎tick `resolvedActivations` を**純読み取り**するだけで、スナップを一切注入しない。curve store が release blend で滑らかに評価した中間値をそのまま Stage が追う。Domain A の release テスト(中間値 0<x<1・連続性 property)が curve 側の滑らかさを担保しており、Stage 側は追随するだけ。スナップ混入なし。

### 観点4: コメント品質 — おおむね適合(nit 1点)

- 型 doc(`AutonomousStageMotionSignal`, :56-64)と getter doc(`getLatestStageMotionSignal`, :81-88)は「pure read of last sampled」→「合成後 EFFECTIVE body-x/body-z, channel curves included」へ正しく更新。実態(EFFECTIVE body を読む)に合致。
- merge ブロックの旧コメント「Stage Presence snapshot above intentionally reads the PURE activations」等は削除済み(誤りにならない)。snapshot 直上の新コメント(:238-247)は追従・無退行・二重適用不変を正確に説明。
- **nit(非blocking)**: 内部変数宣言のコメント `autonomous-frame-heart.ts:186-188` が依然 "Updated each tick from **the sampled** body-x/body-z" と記す。実態は resolved(実効)値なので "sampled" は僅かに stale。型/getter doc は丁寧に更新されている中、この宣言サイト1行だけ旧表現が残る。誤読リスクは低く合否に影響しないが、"the effective (resolved) body-x/body-z" 等に揃えると完全。

### 観点5: 無変更の健全性(deriveStagePresenceStageMotionSettings 不介入) — 適合

- `stage-presence-drive.ts`(deriveStagePresenceStageMotionSettings)は本 diff の対象外で、現 `git status` の modified 一覧にも不在(=Domain 由来 diff なし)。触らない判断は正しい: 当関数は strength→settings 写像のみで Stage 信号の**出所(pure/resolved)に非依存**。差し替えは入力の意味を精緻化するだけで、settings 導出には波及しない。`stage-presence-drive.test.ts`(7件)無変更 pass を実行確認。
- 唯一の消費者 `getStageMotionDrive`(`input-subsystem.ts`)のインタフェース `AutonomousStageMotionSignal` は不変で、値の意味だけが pure→実効に変わる。他消費者への波及なし(escalate 不要の判断は妥当)。

---

## Domain C 追加テスト(Stage follow)の design 評価

`autonomous-frame-heart-channel-overlay.test.ts:487-532`「Stage Presence follows the合成後 effective body signal…」:
- 実 `RuntimePlayerControlChannelOverlayStore` を `storeProvider` で配線し、store curve → resolved 合成 → snapshot → `getLatestStageMotionSignal()` の end-to-end 実経路を通す。モックでなく実 store を通すのは追従証拠として強い。
- `slots: []` で resolver mapping を排し、Stage snapshot 単体を分離。generator が定数 `{body-x:0.4, body-z:-0.2}`、チャネル無し tick で `{0.4,-0.2,16}`、`setOverlay(body-x, 0.9, ...)` 後 sustain tick で `{0.9,-0.2,32}`。生成器が決して出さない 0.9 に horizontal が追従=裁定1 の追従を機械証明。body-z は curve 無し ⇒ -0.2 維持=無関係 slot の無退行を同一テストで示す。design 的に的確。
- 注記(lane1/lane3 向け・lane2 では非指摘): 本テストは `slots:[]` のため観点2 の coupling(resolver 変形と Stage の**同時**追従)自体は実演しない。coupling は `resolvedActivations` を resolver と snapshot の両方へ流す source 構造から必然に導かれるもので、design 上の担保は十分。coupling の end-to-end 実演テスト要否は test-adequacy(lane3)の判断領域。

---

## 差分・要修正

- **要修正: なし。**
- 非blocking nit 1点: `autonomous-frame-heart.ts:186-188` の宣言サイトコメント "from the sampled body-x/body-z" が実効値化に伴い僅かに stale。任意修正。

## リスク/エッジケース評価

- **release 中間値の Stage 追従**: Stage snapshot は resolved の純読み取りでスナップ注入なし。curve の滑らかさをそのまま反映。リスク低。
- **coupling の意味**: 意図された構造的 coupling(裁定1)。二重適用手当ては入力出所非依存で維持。新破綻なし。リスク低。
- **案B retain 順序**: snapshot を retain 後に配置しても re-attack START 経路(前tick値供給)に干渉しない。リスクなし。
- `lastResolvedActivations` は毎tick 全置換 + start/stop で {} リセット。stale slot 蓄積・leak なし。overlay===null 時は generator sample 出力の参照を保持するが prevResolved は read-only 供給で純度不変。

## テスト/typecheck 結果(自分で実行)

- `npx vitest run -c vitest.config.ts autonomous-frame-heart input-subsystem stage-presence-drive stage-motion-runtime` → **5 files / 55 tests 全 pass**(channel-overlay は Stage follow 追加で 10 件)。
- `pnpm run typecheck`(tsc --noEmit)→ **pass(クリーン、出力なし)**。
- `pnpm install` 不使用(既存 node_modules)。

## 質問

- なし。design 的に局所差し替え1点で完結し、裁定・棚卸し・設計 §1-1 と整合。
