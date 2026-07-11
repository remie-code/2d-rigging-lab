# C4 Domain D — Lane2 (design/development) レビュー

> Review-Sylph → Orch-Sylph。レーン=design/development 品質。読み取り専任。
> 対象=特区 `apps/soul` + 参照ドライバ + 持続駆動テスト + 特区方向ルール検査 + package.json。
> 判定基準=`c4-wave-plan.md` §6/§9/§10・`c4-planning-inventory.md` §2.5・憲章 §6。
> 検証方法=対象ファイル自読・`git diff`/`git status`・純関数への fixture 注入実行（リポジトリ非改変）。

## 判定: **要修正（狭い1点。他は全て合格）**

方向ルール検査の純関数に **多行 import の検出漏れ**を実測で確認した。これは blocking 観点#3（方向検査の設計・誤検知/検出漏れ評価）に該当する。ただし修正は正規表現1本の是正 + fixture 1件追加で済み、他の全 design 観点は合格。現状リポジトリは緑（実在の違反ゼロ）で、単一行 import は正しく検出されるため、機能破綻ではなく**ガードの検出網の穴**である。

---

## design観点ごとの評価

### 1. 依存ゼロの機構（blocking）: 合格
`apps/soul/reference-driver/reference-driver.mjs` の import は `node:fs` / `node:perf_hooks` / `node:url` / `node:path` の4つ（すべて Node 組込）のみ。WS クライアントはグローバル `WebSocket`（Node22 undici、import せず）で得ている。npm 依存・トランスパイラなし。`.mjs` 素で `node <path> <url>` 直実行できる設計（`await main()` トップレベル）。`apps/soul` に package.json なし（確認済）、`pnpm-lock.yaml`/`pnpm-workspace.yaml` 無変更（`git status` 空）。憲章§6.2・裁定4/5に整合。

### 2. 契約JSON参照が器コードimportでない（blocking）: 合格
契約JSONは `loadContract()` が `readFileSync`（`import.meta.url` 相対、cwd非依存）で読む。import 文ではないため方向検査の対象にすらならない。読めない環境は `FALLBACK_SLOT_IDS` へフォールバック（`contractSource` で区別可能、テストは `contract-json` を assert）。器の `.ts`/`.mjs` を import している箇所は皆無。ルール2は `.json` 参照を明示許容（下記#3）し、憲章§6.2「契約=型/fixtureは読むだけ許容」と二重に整合。

### 3. 方向検査の設計（blocking）: **要修正（多行import検出漏れ）**
**良い点**: `findSoulZoneBoundaryViolations({ files, soulZonePrefix? })` は I/O から切離した純関数で、2ルールのみ（汎用DAG・循環検出なし。裁定6遵守）。相対 specifier のみを解決し `apps/soul` 越えを判定、`node:*`/bare npm/alias は対象外（path 解決不能ゆえ）と明記。ルール2で `.json` は許容。CLI は `--root` で fixture を指せる standalone スキャナ（既存流儀）。テストの `spawn(process.execPath, [DRIVER_PATH, url])` は import specifier ではなく、`DRIVER_PATH` 変数・`path.resolve(...,"../../../../soul/...")` 文字列も import 文脈外なので**誤検知しない**（下記で実測確認）。

**問題（検出漏れ）**: pattern1 `/\b(?:import|export)\b[^;\n]*?\bfrom\s*["']…["']/g` の `[^;\n]*?` が**改行を除外**するため、prettier で折り返された**多行 named import を取りこぼす**。純関数へ fixture 注入して実測:

| ケース | importer | 期待 | 実測 findings |
|---|---|---|---|
| 単一行 器→魂 `import { foo } from "../../../../soul/…"` | `apps/runtime-player/src/main/control-channel/x.ts` | 違反1 | **1（検出）** |
| 多行 器→魂 `import {\n foo,\n bar\n} from "../../../../soul/…"` | 同上 | 違反1 | **0（見逃し）** |

ルール1（器→魂、ガードの主目的）・ルール2の双方が多行 import で回避可能。**器側は TS + prettier で多行 import が常態**であり、現実的な穴。しかも本検査が「同じ流儀を一般化」と称する先行 `scripts/check-psd-parser-import-boundary.mjs` は `(?:[^'"]*?\bfrom\s*)?`（**改行を含む** `[^'"]`）で多行を捕捉しており、**先例より退化している**。fixture も単一行のみで、この穴を露出していない（報告§7の「違反fixtureで赤」は単一行に限る実証）。

推奨修正（狭い）: pattern1 の `[^;\n]` を先例に倣い `[^'"]`（または `[\s\S]`）ベースへ是正し、`soul-zone-boundary-fixtures/invalid-*/` に**多行 import の違反 fixture** を1件追加して回帰で固定する。現状リポジトリは緑のまま通る（実在違反ゼロ）ので影響は検出網の強化のみ。

### 4. package.json 変更の妥当性（blocking）: 合格（軽微な注記あり）
`git diff package.json` は最小: `check:soul-zone`（ガード）と `check:soul-zone:fixtures`（自己テスト）の2定義追加 + composite `check` 末尾に `&& pnpm run check:soul-zone` を1つ連結。既存 `check:deps`/`check:source` と同型で、ガードは標準 `check`（CI 経路）に統合・`:fixtures` は分離という分割も妥当。他スクリプト定義への破壊なし。
注記（非blocking）: 報告§7/§9-6が根拠に挙げる「`check:testids` 先例（ガードは標準checkに統合・`:fixtures`分離）」は、root/`apps/runtime-player` の package.json に `check:testids` が見当たらず**引用が不正確**。ただし実際の変更は現存する `check:deps`/`check:source` と同型で妥当なので、可否には影響しない。

### 5. 決定論スタブ生成器注入（blocking）: 合格
持続駆動テストは heart の**既存** `createGenerator` seam（`autonomous-frame-heart.ts` の `deps.createGenerator ?? createPhysiologyGenerator`、diff 上は**context 行=D以前から存在**、C2由来）へ、テスト内定義の `baselineGenerator()`（`sample: () => ({ "head-horizontal": 0 })`）を注入するのみ。
- **physiology/ 無変更**を確認（`git status --short apps/runtime-player/src/main/physiology/` 空）。生成器の純度・golden を汚していない。
- スタブはこのテストの heart インスタンスに渡すだけで、**本番経路へ漏れない**（`createGenerator` 未指定時の既定は本番 `createPhysiologyGenerator`）。
- `autonomous-frame-heart.ts` の diff は Domain **B** の `getChannelOverlay` overlay seam 追加のみ（D の変更ではない）。baseline=0 witness により、published frame の非0 `ParamAngleX` は overlay 経由の外部駆動に一意帰属できる縦貫通の証人設計として妥当。

### 6. flaky対策（design観点）: 合格
- 実時間圧縮: 位相定数（沈黙200ms・間30ms・再接続60ms）を `SOUL_DRIVER_PHASE_SCALE` で伸縮可能に外出し、既定=1で ~0.9秒完了。
- `port: 0`（ephemeral）で競合回避。
- **停滞の非沈黙化**: `withTimeout` は active タイマ（unref せず `clearTimeout` で後始末）。応答/hello 不着を沈黙 exit ではなく記述的 reject で surface（`REPLY_TIMEOUT_MS`/`HELLO_TIMEOUT_MS`=4000ms、テスト timeout 30000ms と十分な余裕）。
- 緩い閾値: RTT p95<100ms・frame前進>20（実測 baseline≈7 → drive中≈56で余裕）・単調増加・witness≥5。実時計 `delay(120)` に依存するが閾値マージンが広く、設計として妥当。CI 高負荷時は `SOUL_DRIVER_PHASE_SCALE` 調整余地あり。

### 7. 無関係変更・退行の不在: 合格
- physiology/ 無変更・`headless-slot-resolver.ts` 無変更（`git status` 空）を確認。
- lockfile/workspace 無変更、`apps/soul` に package.json なしを確認。
- `autonomous-frame-heart.ts` の変更は Domain B の overlay seam（D は既存 seam を使うのみ）。Domain A/B/C の control-channel 本体・bridge・ページ・`runtime-player-main.ts` は D の新規追加 + package.json 3行に限られ、D による再変更は認められない（本ブランチの他 modified はA/B/C由来の未コミット群）。

---

## 差分

### blocking
- **方向ルール検査の多行 import 検出漏れ**（観点#3）: pattern1 の `[^;\n]` が改行を除外し、器TSで常態の多行 named import を器→魂/魂→器の双方で取りこぼす。純関数への fixture 注入で実測確認（単一行=検出1／多行=検出0）。先行 `check-psd-parser-import-boundary.mjs`（`[^'"]` で改行込み）より退化。fixture も多行を露出せず。→ 正規表現の是正 + 多行違反 fixture 1件追加を要する。

### non-blocking
- package.json の「`check:testids` 先例」引用が不正確（当該スクリプト不在）。実変更は妥当なので注記のみ。
- 持続駆動テストが実時計 `delay(120)` に依存（閾値マージン広く、実害の観測なし。将来 CI が重い場合の監視点）。

---

## package.json 変更・decision-stub 生成器注入の可否判断（明示）
- **package.json 変更: 可**。最小・既存 `check:deps`/`check:source` と同型・composite `check` へ統合・他定義非破壊。CI が回る形。
- **decision-stub 生成器注入: 可**。既存 `createGenerator` seam 経由・physiology/ 無変更・本番経路へ非漏出・生成器純度と golden を汚さない。

---

## 質問（Orch/後続判断）
1. 多行 import 検出漏れは blocking 観点#3 に該当するため **要修正** とした。ただし現状リポジトリは緑・単一行は検出・ガードは多層防御（package.json不在・check:depsと併存）の一枚である点を踏まえ、Orch が「follow-up 起票で C4 は閉じる」判断も取り得る。Lane2 としての推奨は「小修正ゆえ本 wave 内で是正」。方針を確認したい。
2. `check:soul-zone:fixtures`（自己テスト）は標準 `check` に含めず分離。既存 `check-source-organization-fixtures.mjs` 等と同流儀だが、多行 fixture 追加後も CI で回る経路（手動/別ジョブ）が確保されるか、パイプライン設計を Orch 側で確認されたい。
