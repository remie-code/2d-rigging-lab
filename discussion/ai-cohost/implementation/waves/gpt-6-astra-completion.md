# GPT-6 Astra — domain completion

Status: bounded machine gate PASS / human audio-conversation acceptance PASS. 2026-09-08.

## User acceptance

2026-09-08、ユーザーが「完璧だ、あとやっぱりAstraは会話が自然だな」「動作確認できたよ」と報告し、コミットを依頼した。通常利用でのAstra動作・会話体験を合格として記録する。以下のbroad失敗未分類・cleanup不確実性まで解消されたとは扱わない。

## Basis / orchestration

- Accepted [wave plan](../orchestration/gpt-6-astra-wave-plan.md) の単一 domain を実行した。
- Orch-Sylph は source を編集せず、別コンテキストの Gnome が実装・検証、別コンテキストの Review-Sylph が actual source/diff/tests/installed dependency を独立レビューした。
- **1 implementation/review loop、blocking 0、修正ループ0。** [実装証拠](gpt-6-astra-implementation.md) と [独立レビュー](../reviews/gpt-6-astra-review.md) を正とする。計画・map の更新は root が所有する。

## Delivered repository changes

`apps/soul/agent/` の関連15ファイルを変更（全一覧は実装報告）。package/lockを **0.153.4 family** に更新し、registry・API・label・instruction IDs・関連testsへ `codex-astra` / `GPT-6 Astra` / `gpt-6-astra` / `low` / shared Chappy identity を追加した。

既定 Claude、既存選択/指示と保存値を保持。next accepted Fire・通常session/thread継続・subscription・vision・progressiveは既存経路を使用。Editor/Runtime/個人設定/global App/他差分を変更せず、stage/commitなし。

## Verification

exact commands は [実装証拠](gpt-6-astra-implementation.md#focused-verification) と [独立レビュー](../reviews/gpt-6-astra-review.md#独立実行結果) に保存した。主要実行は Soul agent cwd で `node --test --test-isolation=none --test-reporter=tap` に対象10ファイルを指定するもの。

| Evidence | Result |
|---|---|
| Gnome 最終 focused / 10 files | **461 / 461 pass**, 0 fail、6901.4698 ms |
| Reviewer 独立 focused / 同10 files | **461 / 461 pass**, 0 fail、7650.8686 ms |
| `npm ls @openai/codex-sdk @openai/codex @openai/codex-win32-x64` | 両担当が installed 0.153.4 family を確認 |
| installed `codex.exe --version` | 両担当が **codex-cli 0.153.4**、exit 0 を確認 |
| `git -c core.safecrlf=false diff --check -- apps/soul/agent` | 両担当 pass |
| broad worker-free / 一回のみ | **1063 / 1084 pass、21 fail**。全体合格ではない |

registry、UI/API、instruction保存/reset/既存保全、next-Fire、adapter/subscriptionの全観点が適合。通常 worker runner の `spawn EPERM` は worker-free 切替で回避した。

### Installed subscription smoke — Gnome の実測

`node scripts/.astra-installed-smoke.mjs` を1回実行（検証後削除）。製品registry/default resolver・subscription guardを使用、retryなしで上限3成功。Reviewerの追加実turnなし。

| Turn | elapsed ms | delta 件数 / 文字数 | completed / expected-match / delta-final 一致 |
|---|---:|---:|---|
| Astra low 自作1×1画像 | 8255 | 1 / 3 | 全 true |
| Astra 同 thread 継続 | 4151 | 6 / 8 | 全 true |
| Sol low 回帰 | 5881 | 1 / 2 | 全 true |

Astraは同一thread。合成画像/nonce、isolated cwd/ledger、read-only/approval never/network disabled、subscriptionを使用。個人画面・ユーザー会話を送らず、本文を保存していない。

## Residuals / evidence limits

- **Broad 21 fail の全名/原因は未分類。** 末尾25行のみ保存のため復元不可。audio-player 5 testの post-test timeout/unhandledRejection だけ確定（詳細は実装報告）。全21件を環境原因/既存/非関連と断定しない。独立focusedと差分に具体的関連failureがなく bounded gate は合格、broad全体は未合格。再broadなし。
- **Cleanup:** 子2process、両cwd、専用ledger、所有scratch/scriptのcleanupを確認。`thread/delete` 成功/エラー応答は0、DB残留不存在は未確認。DB/既定ledger/他rolloutを直接操作していない。adapter warning35件は未分類。
- smoke本文/削除済みscriptは再監査可能な永続証拠ではない。protocolの限定実測であり、意味的画像理解・長期記憶・streaming一般品質・音声/会話品質・他account/platformの保証ではない。

## User handoff

**依存 install 済み、追加 build は不要。通常の Cockpit 再起動で反映する。** `package.json` の `cockpit` は `node scripts/cockpit.mjs`、UI は既存 `.mjs` 静的配信。実起動案内は `npm run cockpit --prefix apps/soul/agent`。

通常再起動と必要時page reload後、既存selectorで GPT-6 Astra を選択する。人間の音声/会話acceptanceは上記ユーザー報告で合格。稼働Cockpit/browserはこちらから操作していない。
