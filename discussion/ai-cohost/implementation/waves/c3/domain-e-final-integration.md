# C3 Domain E 実装報告: `cohost-c3-final-integration`

> 実装: Gnome(opus)、2026-07-11。委任元: Orch-Sylph。対象: `apps/runtime-player`。
> source of truth: [c3-wave-plan.md](../../orchestration/c3-wave-plan.md) §6 Domain E / §7 手動ゲート / §8 AC / §9 Contract、Domain A-D 実装報告 [waves/c3/](.)、Domain A-D レビュー [reviews/c3/](../../reviews/c3/)。
> Status: **モノレポ検証 green(既知 baseline を除く)・無変更確認クリア・test-only 1本追加・docs/map 更新済み。手動ゲート(§7、ユーザー実施)待ち。escalate / blocked なし。**

これは C3 の最終統合ドメイン(新規プロダクトコードは最小、検証と docs 整備が主)。Domain A/B/C/D は実装完了・レビュー合格済み。

---

## 1. モノレポ検証(証拠つき)

### 1.1 全体テスト

コマンド:
```
pnpm --filter @private-2d-rigging-lab/runtime-player exec vitest run
```
結果: **120 files / 731 tests → 729 passed / 2 failed**(§3 の N1 test-only 追加後。追加前は 730 tests)。

**3 連続実行**して flaky を観測: 3 回とも **2 failed(常に同2ファイル)**。physiology / stage-presence / role-composition 系は **一度も失敗せず**。

### 1.2 既知 baseline fail の明示分類

失敗している全ファイル:行:

| ファイル:テスト | 差分 |
|---|---|
| `src/main/broadcast-source/browser-source-server.test.ts`(run により `:150` "accepts the not-loaded response shape" または "serves current Runtime Export payload to authorized Browser Source clients") | `+ "effectiveDynamicsTuning": null` の**1キーのみ** |
| `src/stage/browser-source/browser-source-server-message.test.ts:216`(`readBrowserSourceRuntimeExportResponse > accepts the not-loaded response shape`) | `+ "effectiveDynamicsTuning": null` の**1キーのみ** |

- **原因**: Wave21 Dynamics Tune で応答 shape に `effectiveDynamicsTuning` が加わったが、この2つの browser-source テストの期待値が旧 shape のまま(`toStrictEqual` で1キー超過を検出)。C3 とは無関係。
- **flaky の正体**: これは live HTTP server を立てるテスト群で、`browser-source-server.test.ts` 内の**どのテストが落ちるかは run 毎に変動**(timing/順序依存)するが、**常に同2ファイル・常に同じ `effectiveDynamicsTuning` shape 差**。失敗数は 2〜3 に揺れると申し送りがあるが、本検証の3連続実行はいずれも 2 で安定した。
- **git 無変更**: 両ファイルとも `git status` 上 untouched(C3 の diff に含まれない)。physiology/stage-presence/role-composition 系は **差分にも失敗にも一切現れない**。
- 他に予期しない失敗はなし。

### 1.3 typecheck

コマンド:
```
pnpm --filter @private-2d-rigging-lab/runtime-player run typecheck   # tsc --noEmit -p tsconfig.json
```
結果: **exit 0(エラーなし)**。

### 1.4 モノレポ全体の型健全性(裁量: 対象を runtime-player に限定)

- Subagent Contract(§9)は **`pnpm install` 禁止・回避工作禁止・新規依存禁止**。root からの `pnpm -w run build` は重く、かつ本 wave の実装差分は `apps/runtime-player/` に完全に限局している(§2.4 で機械確認)。したがって型健全性の検証は **runtime-player の typecheck(§1.3、exit 0)に限定**した。他パッケージのソースは1バイトも変わっていない(§2.3)ため、runtime-player 外の型が C3 で壊れることは構造上あり得ない。この限定は裁量判断(重い全体ビルドを避け、変更限局の機械証拠で代替)。

### 1.5 `pnpm install` 不実施

- **`pnpm install` は一切実行していない。** 回避工作(手動 symlink 等)もなし。既存 `node_modules` のツール(tsc / vitest / electron)のみ使用。`apps/runtime-player/package.json` は無変更(§2.3)。

---

## 2. 無変更確認(git で機械的に、証拠つき)

すべて `git status --short -- <path>` が空(= working tree 無変更)であることを確認した。

### 2.1 golden 2本 + resolver 等価 golden

| ファイル | 判定 |
|---|---|
| `apps/runtime-player/src/main/physiology/blink-default.golden.json` | 無変更 |
| `apps/runtime-player/src/main/physiology/blink-alt-config.golden.json` | 無変更 |
| `apps/runtime-player/src/main/live-mapping/runtime-parameter-frame-equivalence.golden.json` | 無変更 |

`git ls-files | grep golden.*json` の全 tracked golden(上記3本)を走査し、いずれも無変更。
(注: `full-generator-snapshot.golden.json` は Domain B が新設した untracked golden で、C3 で新規に生まれた fixture。既存 golden の改変ではない。)

### 2.2 保護対象ソース(触ってはいけない実装)

| ファイル | 判定 |
|---|---|
| `.../live-mapping/headless-slot-resolver.ts` | 無変更 |
| `.../live-mapping/body-follow-state.ts` | 無変更 |
| `.../live-mapping/semantic-slot-definitions.ts` | 無変更 |
| `.../stage-motion/stage-motion-transform.ts`(純計算器) | 無変更 |
| `.../stage-motion/stage-motion-transport.ts`(transport) | 無変更 |
| `.../window-state/window-state-stage-motion-settings.ts`(`stageMotion.settings` スキーマ) | 無変更 |
| `.../control/live-controller-page.tsx`(自律ホスト既存 Stage Motion "Motion Safety" UI、裁定8) | 無変更 |

Stage ページの Enabled トグル UI(裁定8)も無変更(C3 が変更した control ファイルは `control-window-app.tsx` / `control-window-shell.tsx` と**新設** `physiology-page.tsx` のみ)。

### 2.3 Editor / package-format / Runtime Export schema / lockfile

| 対象 | `git status --short` | 判定 |
|---|---|---|
| `apps/editor/**` | 空 | 無変更 |
| `packages/**`(package-format / contracts / runtime-core / render-* 等 = Runtime Export schema を含む) | 空 | 無変更 |
| `pnpm-lock.yaml` | 空 | 無変更 |

### 2.4 変更の限局(機械確認)

```
git status --short | grep -vE "apps/runtime-player/|discussion/"   →  空
```
= **全差分が `apps/runtime-player/` + `discussion/` に限局**。runtime-player 外のプロダクトコード(Editor・packages)・lockfile はゼロ変更。C3 全体で変更された runtime-player ソース(Domain A-D 分)は physiology / role-composition / stage-motion / presence / control / preload / physiology-profiles に閉じ、保護対象(§2.1/§2.2/§2.3)を一切含まない。

---

## 3. 軽微テスト追加(Domain D レビュー Lane3 N1 の回収 — Orch 指示、test-only)

- **追加先**: `apps/runtime-player/src/main/presence/stage-presence-drive.test.ts`(既存6 tests に +1)。
- **内容**: `deriveStagePresenceStageMotionSettings({ enabled: true, strength: 0.3 })` の**返り値全体を `toEqual` で固定**するスナップショット1本。`horizontal`/`scale` に加えて **`deadZone: 0.02` と `reaction: 6` を明示アサート**。
- **回収する隙(N1)**: 既存テストは strength スケール(horizontal px / scale delta)しか検証しておらず、`deadZone`/`reaction` を誤変更(例: deadZone を広げる)すると既定 strength 0.3 の**控えめな姿勢連動微動が無音化**し得るのに落ちるテストが無かった(設計§5「遅い drift は残す / micro-jitter のみ切る」意図に反する将来退行)。この1アサーションで塞いだ。
- **プロダクトコードは不変**(test-only)。`stage-presence-drive.ts` は1バイトも変えていない。
- **結果**:
  ```
  pnpm --filter @private-2d-rigging-lab/runtime-player exec vitest run src/main/presence
  → 1 file / 7 passed
  ```
  全体テストにも織り込み済み(§1.1、730→731 tests)。

これが C3 統合ドメインで作った唯一のプロダクト隣接差分(§9「新規変更は §3 のテスト追加のみ」を厳守)。それ以外の実装差分は作っていない。

---

## 4. 更新した docs / maps

「実装事実に合わせて関連ドキュメントを更新する」に従い、**実装事実の反映と索引更新に留め、新規設計は書いていない**。`discussion/_conventions.md` の情報分離(事実 / 判断 / 未決を混ぜない)に従い、手動ゲートは「未実施(ユーザー待ち)」として分離。

| ファイル | 更新要点 |
|---|---|
| `discussion/ai-cohost/implementation/orchestration/c3-wave-plan.md` | §1 Status を「Ready to launch」→「**実装完了・機械ゲート green・3レーンレビュー全 PASS・手動ゲート待ち**」に更新。Domain A-E の実装事実・レビュー判定(全12レーン最終 PASS、Domain C lane2 は F1 修正で解消)・全体テスト 729/2・既知 baseline の分類を明記。 |
| `discussion/ai-cohost/implementation/orchestration/_map.md` | `c3-wave-plan.md` 行の Status を実装完了・レビュー全PASSへ更新。 |
| `discussion/ai-cohost/implementation/_map.md` | `orchestration/` 行に C3 実装完了を追記。**`waves/c3/` / `reviews/c3/` の行を新設**(Domain A-E 実装・全12レーンレビュー結果)。「次の行動」に C3=実装完了・手動ゲート待ちを追加。**(Domain E clean review Lane2 索引取りこぼし回収、2026-07-11)** `screens/` 行の stale「C3未作成」を実態(`screens/c3-physiology-profile.md` 作成済み・Accepted・C3 実装の source of truth)へ修正。 |
| `discussion/ai-cohost/_map.md` | §2 `implementation/` 行を C3 実装完了へ更新。§4 Current State に C3 の実装事実サマリ行を追加。§5 Next Actions を「次の一手=C3 §7 手動ゲート(ユーザー)→ 合格で完全閉鎖 → C4」へ更新。 |
| `discussion/_map.md`(root) | ai-cohost 行末の stale な「実装未着手」を「C1・C2 完全閉鎖、C3 実装完了・レビュー全PASS・機械ゲートgreen(手動ゲート待ち)」へ修正し、詳細は `ai-cohost/_map.md` へ委譲。 |

- **触れていない docs**: Editor / package-format / Runtime Export schema のドキュメント(実装が変わっていないため)。C3 設計討議 `c3-gaze-head-posture.md`・UX定義 `c3-physiology-profile.md`・棚卸し `c3-planning-inventory.md`(設計文書であり実装事実の追記対象でない)。`discussion/runtime-player/_map.md`(ai-cohost への control-channel 委譲ポインタのみで、physiology/C-wave の実装事実を保持していない=更新不要。議論の正は ai-cohost トピックという既存規約合意どおり)。

---

## 5. 手動ゲート手順(§7 の7項目、起動コマンドつき)

> これは C3 の**美的ゲート本体**(機械では判定できない「30秒眺めて機械のループに見えないか」等)。Orch-Sylph → Undine → ユーザーへ渡す。dev 版とパッケージ版の両起動方法を添える。

### 5.0 role 指定の仕組み(dev / パッケージ版 共通)

役割は **`--role=<role>` CLI 引数**で指定(`profile-slots/role-launch-resolution.ts` が composition root 入口で `process.argv` を一度パース。`--role=trackingHost` / `--role=autonomousHost`)。dev もパッケージ版も同一機構。`--profile=<slotName>` で既定スロット以外も選べる(2窓運用では不要。省略時は `tracking-default` / `autonomous-default`)。Browser Source の既定ポートはスロット固定: **trackingHost=17308 / autonomousHost=17309**(実 URL+token は Control ウインドウの Browser Source パネルに表示)。

### 5.1 dev 起動(`apps/runtime-player` から)

```
pnpm exec electron-vite dev -- --role=autonomousHost
pnpm exec electron-vite dev -- --role=trackingHost
```

- **`--role` を必ず明示**(既知制限)。**dev の引数なし起動は真っ黒になる**——役割選択スタブの relaunch が electron-vite の dev server と非両立(C1 既知制限)。`electron-vite dev -- <args>` の `--`(ダブルダッシュ)が後続を electron へ転送するため、`--role` はこの `--` の後ろに置く。
- **dev は二重起動時に userData / renderer dev server を共有**するため、**二体並走(項目6・7 の同時比較)には無効**。単一ロールの各項目は dev でも可。

### 5.2 パッケージ版起動(二体並走に必須)

ビルド/パッケージ(`apps/runtime-player` から。`pnpm install` 不要):
```
pnpm run build      # typecheck + electron-vite build → out/
pnpm run dist:win   # build + electron-builder --win --x64 → dist/ に portable exe
```
- 生成物: `apps/runtime-player/dist/` に portable の単一 exe(既定命名 `Runtime Player 0.0.0.exe`。正確なファイル名はビルド後 `dist/` で確認)。
- 注意(環境依存): electron-builder は初回に winCodeSign / nsis 等をキャッシュへネットワークダウンロードする場合あり(`pnpm install` ではない)。未署名 exe のため SmartScreen 警告が出得る(ゲート実施に支障なし)。

role 指定つき起動(PowerShell、または exe のショートカットに引数を付す):
```
& ".\dist\Runtime Player 0.0.0.exe" --role=autonomousHost
& ".\dist\Runtime Player 0.0.0.exe" --role=trackingHost
```
- ショートカット運用: exe のショートカットを2つ作り、リンク先の後ろに `--role=autonomousHost` / `--role=trackingHost` を付す(C1 で確立)。
- **二体並走(トラッキングホスト+自律ホスト同時)は必ずパッケージ版**(dev は userData / dev server 共有のため無効)。別スロット= 別 userData / 別 port / 別 token で干渉しない(C1 で確立)。

### 5.3 §7 ゲート項目別の実施手順

**項目1 — 設定なしで生きている**
1. 自律ホストを起動(dev: `pnpm exec electron-vite dev -- --role=autonomousHost`)。
2. Control ウインドウで Runtime Export をロード(自律ホストのモデル)。
3. **見るもの**: 設定を一切いじらずに、まばたき+視線(跳んで留まる)+頭(揺れる)+姿勢(たまに座り直す)が動いていれば合格。既定 = フル4系統生理が土台(Domain C: 空 override → `DEFAULT_FULL_PHYSIOLOGY_CONFIG` 相当)。

**項目2 — 30秒眺めて「機械のループに見えない」**
1. 項目1 の状態のまま **30秒間** ステージを凝視。
2. **合格条件**: 次のアンチパターンが**出ていない**こと——(a) 単一周波数の往復、(b) 完全な中心回帰(必ず正面に戻る)、(c) 目・頭・体が各々バラバラの機械、(d) 動きすぎ。目が先・頭が後の協調、大サッカードへの瞬き同期、体が頭の親、が感じられれば理想。機械側代理(周期非検出テスト)は green だが、最終判定は人間の目。

**項目3 — ツマミ即時反映(Blink/Gaze/Head/Posture 各1本以上)**
1. Control ウインドウのナビで **`Physiology`** ページを開く(`Dynamics Tune` の隣)。
2. Blink / Gaze / Head / Posture 各セクションの質感語スライダーを**掴んで動かす**(数値 readout は無い=質感語のみ)。
3. **見るもの**: スライダーを動かすと、隣で生きている体の空気が**その場で**変わる(config 変更→heart が生成器を同一 seed で再構築、位相不連続は許容=活性度が跳んでよい)。各ファミリー最低1本。

**項目4 — Stage Presence を on にして比較**
1. `Physiology` ページの **Stage Presence** セクション(既定 **Off**)のトグルを **on**、Strength スライダーを上げる。
2. **見るもの**: 姿勢に連動して画面上の位置がわずかに動く(既定 strength 0.3 で控えめ。二重適用手当てで camera-follow 既定 80px/0.06 より小さい 60px/0.05 上限)。過剰・不気味なら Strength を下げる/Off に戻す——**Off のまま運用でも C3 は合格**。

**項目5 — プロファイル復元 / Reset**
1. 項目3 でスライダーを変更 → いったんアプリを終了 → 同じ Runtime Export で再起動。
2. **見るもの**: 変更した質感が**復元**される(fingerprint 別自動保存、Save ボタン不在=debounce 自動保存)。各セクションの **Reset** で普遍既定に戻る。

**項目6 — トラッキングホスト退行なし / 空状態**
1. トラッキングホストを起動(dev: `pnpm exec electron-vite dev -- --role=trackingHost`)。
2. **見るもの**: 従来どおりフェイストラッキングで動く(生理生成器は載らない=退行なし)。トラッキングホストの `Physiology` ページは**空状態の一文**「This host has no physiology; the body is driven by tracking.」(nav からは消えない=劣化ページ方式、実行時 role 分岐ではなく `available:false` data で分岐)。

**項目7 — OBS Browser Source parity(二体並走はパッケージ版)**
1. パッケージ版で自律ホスト(`--role=autonomousHost`)を起動、Control の Browser Source パネルに表示される URL(既定ポート 17309)を OBS の Browser Source に設定。
2. **見るもの**: OBS 側でもステージと同じ動き(視線・頭・姿勢 + Stage Presence on 時の transform)。transport 無改変なので composed transform が同経路で届く(sanitized transform のみ、seed/raw slot は境界を越えない)。
3. 二体並走の非干渉(項目6+7 同時)を見る場合は**必ずパッケージ版**で trackingHost/autonomousHost を別スロット起動。

---

## 6. 裁量判断 / 質問 / escalate・blocked

### 裁量判断
1. **モノレポ全体ビルドを runtime-player typecheck に限定**(§1.4)。`pnpm install` 禁止・変更が runtime-player に完全限局(機械確認済み)という2点から、重い root ビルドを避け変更限局の証拠で代替した。
2. **N1 回収を `toEqual` 全体スナップショット**で実装(§3)。vitest の外部 snapshot ファイルではなくインライン `toEqual` を選択(deadZone/reaction の意図した値を**明示リテラル**でレビュー可能にするため。strength 0.3 の horizontal/scale は `MAX * 0.3` の同一式で表現し浮動小数の等価を保証)。
3. **root `discussion/_map.md` の stale 修正**(§4)。「実装未着手」は C1/C2 完了時点で既に事実誤り。索引の正確性のため最小修正し、詳細は子マップへ委譲(規約: 親マップは子の詳細を再掲しない)。

### 質問
- なし。§6 Domain E のスコープ(検証・無変更確認・test-only 追加・docs 更新・手動ゲート手順)は設計・申し送りで完全に規定されており、埋めるべき設計分岐はなかった。

### escalate / blocked
- **なし。** 予期しない失敗・退行はゼロ(2 failed は既知 Wave21 baseline のみ、C3 対象外・git 無変更)。§9 Contract(`pnpm install` 禁止・保護対象無変更・test-only のみ・無関係 revert 禁止・role 分岐不増・physiology 純度/sanitization 境界維持)を全て遵守。

---

## 付録: C3 完全閉鎖への残タスク(Orch/Undine/ユーザー向け)

- 残るは **§7 手動ゲート(ユーザー実施)** のみ(§5 に起動コマンドつき手順)。合格すれば C3「視線と頭が生きる」完全閉鎖 → 次は C4。
- 既知 baseline fail(browser-source の `effectiveDynamicsTuning` shape、Wave21 由来)は C3 と無関係の先在債務。C3 のスコープで直すべきものではない(別途 Wave21 baseline 修正の領分)。
