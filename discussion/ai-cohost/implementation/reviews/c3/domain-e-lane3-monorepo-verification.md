# C3 Domain E クリーンレビュー — レーン3: monorepo verification

> レビュー: Review-Sylph、2026-07-11。委任元: Orch-Sylph。対象: `apps/runtime-player`。
> basis: `discussion/ai-cohost/implementation/waves/c3/domain-e-final-integration.md` §1 / §2 / §3。
> 方式: Gnome 報告に依存せず、自分でテスト/typecheck/git を実行して独立再現(読み取り+コマンド実行のみ、ソース無改変)。

## 判定: **合格 (PASS)**

Domain E が主張するモノレポ検証結果を、すべて自分の手で再現・独立検証できた。緑の主張は本物。数値・git 状態のズレなし。

---

## 1. 全体テスト再現(2連続実行)

コマンド: `pnpm --filter @private-2d-rigging-lab/runtime-player exec vitest run`

| run | Test Files | Tests | 結果 | 失敗ファイル |
|---|---|---|---|---|
| 1 | 2 failed / 118 passed (120) | **729 passed / 2 failed (731)** | 報告一致 | browser-source-server.test.ts + browser-source-server-message.test.ts |
| 2 | 2 failed / 118 passed (120) | **729 passed / 2 failed (731)** | 報告一致 | 同上 |

- 報告(§1.1)の「120 files / 731 tests → 729 passed / 2 failed」を**2回とも完全再現**。flaky なし(2連続で 2 failed 安定)。
- physiology / stage-presence / role-composition / physiology-profiles / control 系は**両 run とも一度も失敗せず**(失敗は常に同2ファイルのみ)。

## 2. 2 failed の正体

- 失敗は `src/main/broadcast-source/browser-source-server.test.ts` と `src/stage/browser-source/browser-source-server-message.test.ts` の**2ファイルに限定**。
- 差分は両者とも `+ "effectiveDynamicsTuning": null` の**1キーのみ**(`toStrictEqual` が旧 shape の期待値で1キー超過を検出)。Wave21 Dynamics Tune 由来の先在 baseline で、C3 とは無関係。報告(§1.2)一致。
- **両ファイルとも git 無変更**(`git status --short` 上 untouched)。C3 の diff に含まれない。
- 他に予期しない失敗はゼロ。physiology/stage-presence/role-composition 系は差分にも失敗にも一切現れない。

## 3. typecheck

コマンド: `pnpm --filter @private-2d-rigging-lab/runtime-player run typecheck`(`tsc --noEmit -p tsconfig.json`)
結果: **exit 0(エラーなし)**。報告(§1.3)一致。

## 4. 無変更確認(§2)の git 独立再現

`git status --short -- <path>` で以下すべて**空(無変更)**を確認:

- golden: `physiology/blink-default.golden.json`, `physiology/blink-alt-config.golden.json`, `live-mapping/runtime-parameter-frame-equivalence.golden.json` — いずれも無変更。
- 保護対象ソース: `live-mapping/headless-slot-resolver.ts`, `body-follow-state.ts`, `semantic-slot-definitions.ts`, `stage-motion/stage-motion-transform.ts`, `stage-motion-transport.ts`, `window-state/window-state-stage-motion-settings.ts`, `control/live-controller-page.tsx` — いずれも無変更。
- `apps/editor/**`, `packages/**`, `pnpm-lock.yaml` — いずれも無変更。
- **変更の限局**: `git status --short | grep -vE "apps/runtime-player/|discussion/"` は**空**(全差分が `apps/runtime-player/` + `discussion/` に限局)。報告(§2.4)一致。
- `full-generator-snapshot.golden.json` は untracked(`??`)= C3 新設 fixture であり既存 golden の改変ではない。報告(§2.1 注記)一致。

## 5. N1 test(§3)

- `src/main/presence/stage-presence-drive.test.ts` に該当スナップショット追加を確認(L113 `"pins the full derived settings incl. deadZone/reaction (Domain D Lane3 N1)"`)。`toEqual` で返り値全体を固定し、**`deadZone: 0.02` と `reaction: 6` を明示アサート**(L134-135)。報告(§3)一致。
- コマンド: `pnpm --filter @private-2d-rigging-lab/runtime-player exec vitest run src/main/presence` → **1 file / 7 passed**(exit 0)。報告一致。

## 6. `pnpm install` 不実施の痕跡

- `apps/runtime-player/package.json` 無変更、`pnpm-lock.yaml` 無変更。install が走った形跡なし。報告(§1.5)一致。

---

## 質問 / 留意点(要修正ではない)

1. **N1 の "test-only" は git だけでは独立確定できない**(要修正ではない・情報共有)。`apps/runtime-player/src/main/presence/` ディレクトリは**全体が untracked(C3 新設、Domain D 由来)**。したがって `stage-presence-drive.ts`(プロダクト)が Domain E の test 追加で1バイトも変わっていないことを、git baseline との diff では機械的に証明できない(トラッキング対象外のため履歴がない)。ただし: (a) 該当プロダクト定数(deadZone 0.02 / reaction 6)は N1 test の `toEqual` で固定され 7 passed で緑、(b) presence のプロダクトロジック自体は Domain D レビューの領分。Domain E レーン3(モノレポ検証)の合否には影響しないため**合格判定は維持**。念のための申し送りとして記す。

## escalate / blocked
- なし。全6観点を独立再現し、報告値との**ズレなし**。
