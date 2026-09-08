# GPT-6 Astra — 独立実装レビュー

- Review-Sylph、2026-09-08、loop 1 / 1（上限5）。
- 判定: **合格（今回の bounded machine gate）**。blocking 差分 0 件。
- broad suite 全体の合格および人間の音声・会話品質 acceptance は、この判定に含めない。

## Basis とレビュー範囲

- [Wave plan](../orchestration/gpt-6-astra-wave-plan.md) を合否基準とし、[integration inventory](../../research/gpt-6-astra-integration-inventory.md)、[CLI compatibility probe](../../research/gpt-6-astra-cli-compatibility-probe.md)、[reasoning inventory](../../research/gpt-6-astra-reasoning-inventory.md) と [implementation evidence](../waves/gpt-6-astra-implementation.md) を照合した。先行 inventory の未承認・旧版記述は、その調査時点の記録として扱う。
- implementation-orchestration に従い実装者と別コンテキストで actual source、15ファイルの Git diff、変更テストと既存関連テスト、installed dependency を確認。source 編集、stage/commit、追加実 turn、broad 再実行は行っていない。
- discussion-management に従い repository facts、独立実行結果、実装者の実測記録、未確認を以下で分ける。共有 worktree の `.codex`、expo その他の差分は今回の成果物と混同せず、変更・復元していない。map 登録は plan の root ownership に従い親へ返す。
- OpenAI Docs の検索後に [GPT-6 Astra Model](https://developers.openai.com/api/docs/models/gpt-6-astra) の本文を open。`gpt-6-astra`、reasoning `low`、画像入力の公式 API baseline は、subscription 実行環境の可用性・品質保証とは区別する。

## 設計適合 — 7 / 7

| 観点 | 照合した実コード・テスト | 判定 |
|---|---|---|
| 既存 UI での可視選択 | `health.mjs:95` に `codex-astra: GPT-6 Astra`。既存 `ui/settings-drawer.mjs:83` の options 自動導出と `:650` の POST 経路に乗る。UI vnode と label tests も5選択を固定 | 適合 |
| API 受理・choice 保存・再起動復元 | `cockpit-server.mjs:1203` の既存 allowlist に1値追加。`scripts/cockpit.mjs:669` は registry による保存値復元、`:1037` は従来の保存/currentBrain/revision 更新。`cockpit-settings-store.mjs:244` の保存キーは不変。API 200/Chappy、file round-trip、initial choice テストを確認 | 適合 |
| モデル別 instruction save/load/reset | `fire-orchestrator.mjs:192` と view-logic の ID 列に同じ1値追加。store の既存読み書き反復に追随する。5頭の round-trip、Astra reset、既存4頭 override・既存 choice 保全のテストあり | 適合 |
| next-accepted-Fire と session 継続 | `scripts/cockpit.mjs:906` の revision 比較・置換、`:308` の proxy、`:845` の新 session 生成を照合。設定更新で in-flight session/TTS player を変更せず、次 Fire で Astra、さらに Claude に戻す既存テストを拡張。変更のない通常 Fire は stale 判定にならず、adapter `ensureThread` は既存 thread を返す | 適合 |
| exact model / effort / identity | `brains.mjs:89` は `codex-astra`、`gpt-6-astra`、`low`、共有 frozen `MODEL_IDENTITIES.chappy`。options より後ろに model/effort を設定する。fake App Server の実 `turn/start` パラメータと canonical 自己名のテストで固定 | 適合 |
| subscription / vision / progressive 経路維持 | `codex-session.mjs`、`env-guard.mjs`、Cockpit lifecycle 本体は無変更。guard、`forced_login_method=chatgpt`、read-only/network false、localImage 変換、delta/final 検証を確認。`fire-orchestrator.mjs:574` の既存 non-Claude progressive 適格条件に Astra も入る。新規 transport・validation はない | 適合 |
| 依存・既定・scope | package diff は SDK と Codex family のみ。lock の8 package entries はすべて 0.153.4 系、他依存は不変。Claude default、既存4 ID/label/model/effort、既定 instruction 本文は無変更。対象 source/tests は報告どおり15ファイル | 適合 |

パスは表内では `apps/soul/agent/` を基準とし、`src/` 配下のファイルは先頭を省略している。

## テスト適合

計画の registry / identity / labels / API / instruction persistence / next-Fire / adapter / subscription の全観点に対応するテストがあり、期待値だけでなく実際の入力・保存値・返却値を確認している。Astra 独自の振る舞いを追加せず、既存の共通経路に追加した変更として妥当な粒度。

- `brains.test.mjs`: exact model/effort を fake App Server の `turn/start` から検査。全 entry の frozen identity、credential path を確認。
- `cockpit-server.test.mjs`: 実 HTTP server の POST 受理、Astra instruction 保存・再取得・reset、既存 override 保全。hooks は fake なので、永続化は別の実 file store test と合わせて判断。
- `cockpit-settings-store.test.mjs`: 実 scratch file を再オープンし5頭の override、Astra choice、reset 後 default、既存 choice/override 不変を検査。
- view-logic / UI tests: selector の exact ID/label、instruction editor の選択肢を検査。実ブラウザ・音声体感の証明ではない。
- `scripts/cockpit.test.mjs`: Astra 保存値の初期復元、Chappy system prompt、Astra を含む in-flight → next Fire → Claude 復帰と TTS player 保全。
- 既存 adapter/guard と Fire tests も独立再実行して、画像、delta、同 thread、失敗回復、subscription、progressive を含む共通経路を照合。

## 独立実行結果

cwd: `apps/soul/agent`。Reviewer が実行:

```powershell
node --test --test-isolation=none --test-reporter=tap src/mind/brains.test.mjs src/mind/fire-orchestrator.test.mjs src/mind/codex-session.test.mjs src/mind/env-guard.test.mjs src/cockpit/view-logic/health.test.mjs src/cockpit/view-logic/conversation-instruction.test.mjs src/cockpit/cockpit-server.test.mjs src/cockpit/cockpit-settings-store.test.mjs src/cockpit/cockpit-ui.test.mjs scripts/cockpit.test.mjs | Select-String -Pattern '^not ok|^# (tests|suites|pass|fail|cancelled|skipped|todo|duration_ms)|failureType:|error:'
exit $LASTEXITCODE
```

**461 / 461 pass、0 fail / cancelled / skipped / todo、exit 0、7650.8686 ms**。実装者最終461件の結果を独立再現した。

```powershell
npm ls @openai/codex-sdk @openai/codex @openai/codex-win32-x64
& ./node_modules/@openai/codex-win32-x64/vendor/x86_64-pc-windows-msvc/bin/codex.exe --version
```

SDK `0.153.4` → CLI package `0.153.4` → Windows x64 alias `0.153.4-win32-x64`、実 executable `codex-cli 0.153.4`。version command は arg0 temp cleanup / PATH alias の access-denied warning を出したが exit 0。個人 temp の修復や設定変更はしていない。`codex-session.mjs:40` の default resolver はこの installed platform package を参照する。

repo root の `git -c core.safecrlf=false diff --check -- apps/soul/agent` も exit 0。

## Installed subscription smoke — 引き継いだ実測証拠

追加実 turn は禁止されており、Reviewer は実行していない。以下は implementation evidence の実装者測定値で、今回独立再現した値ではない。actual registry/adapter/resolver と installed version が記録の経路に一致することを独立確認した。

| Turn | elapsed ms | delta 件数 / 文字数 | completed / expected-match / delta-final 一致 |
|---|---:|---:|---|
| Astra low 自作画像 | 8255 | 1 / 3 | 全 true |
| Astra 同 thread 継続 | 4151 | 6 / 8 | 全 true |
| Sol low 回帰 | 5881 | 1 / 2 | 全 true |

専用 cwd/ledger、製品 `BRAINS.create`、既定 binary resolver、subscription guard を使った計3成功 turn。本文・nonce・transport payload は保存しておらず、検証専用 script も削除済みのため、raw payload/script を再監査できる証跡ではない。限定 protocol smoke として採用し、semantic vision、長期記憶、一般的な streaming 粒度、音声品質は認定しない。

cleanup の報告は2プロセス終了・両 adapter cwd 削除・専用 ledger IDs 空。`thread/delete` 成功/エラー応答はともに0で、RPC 削除成功・DB 残留不存在は未確認。adapter warning 35件は未分類。Reviewer は DB を読み書きしていない。

## 裁量判断

- package の既存 caret 形式を維持した `^0.153.4` は、lock/install が検証済み 0.153.4 family に固定されている現在の gate に適合する。将来の lock 再解決を保証する判定ではない。
- Astra の保存・reset・既存4頭保全を組み合わせた追加テストは scope 内の補強。一般化した検証基盤や追加の malformed-wire hardening を要求しない。

## 差分・残課題

blocking 差分なし。次の残課題は今回の bounded scope 合格と併記して維持する。

1. **Broad suite は未合格・分類不完全。** 実装者の1回の実行は1084件中1063 pass / 21 fail。末尾25行のみを保持したため全 failed 名・原因を復元できない。全21件を環境原因、既存失敗、今回非関連とは断定しない。対象15ファイルおよび共有 adapter/guard を含む focused 461件が独立 pass し、差分に具体的な関連 failure を認めないため、追加 broad / baseline 比較は行わない。
2. 保存された broad 末尾で確認できた audio-player の5 test は、終了後の非同期活動で `timed out; got []` / `unhandledRejection` を出している。これは21件の全一覧ではない: `play は PLAY 行を送り STARTED を受け取る（往復・無音）`（103行）、`複数 play は順に往復する（常駐 1 プロセスで連続指示・Source 差し替え）`（115行）、`play は改行を除去して 1 行プロトコルを守る`（129行）、`stop は STOP 行を送り STOPPED を受け取る（barge-in の途中停止）`（142行）、`deviceName は env SOUL_AUDIO_DEVICE_NAME で子プロセスへ渡る（出力デバイス指定）`（187行）。audio-player source/tests は今回無変更。別実行の worker `spawn EPERM` をもって全21件の原因とはしない。
3. 実 smoke の cleanup / warning 不確実性は前節どおり。既存 best-effort cleanup の変更・DB 調査は本件では要求しない。
4. **人間の通常会話 acceptance は未実施。** package script は `node scripts/cockpit.mjs`、UI は既存 `.mjs` 静的配信で、新しい build は不要。依存 install 済みのため、通常の Cockpit 再起動と必要に応じた browser reload 後、既存の選択・適用操作から Astra を使う。Reviewer は稼働 Cockpit を再起動・操作していない。

## 最終判定

**合格 — loop 1、要修正0。** 可視選択 → choice/instruction 保存 → 次 Fire → `gpt-6-astra` / `low` / Chappy / 共通 session 経路という今回の単位は、source と focused tests、installed evidence に適合する。全体 suite の健康証明と人間の音声品質合格に拡張しない。
