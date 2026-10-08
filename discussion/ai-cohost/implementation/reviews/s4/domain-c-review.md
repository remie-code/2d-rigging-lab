# S4 追撃 Domain C レビュー: 演出強さ係数の CLI 配線（`--expression-gain`）

> Reviewer: Review-Sylph（Orch-Sylph 委任）。読み取り専任。
> 対象: `apps/soul/agent/scripts/cockpit.mjs` / `cockpit.test.mjs` / 記録 4 点。
> 判定: **合格（1 点の注意事項あり — check:source は器の既存違反で赤・本変更とは無関係）**。
> ループ番号: 1（初回レビューで合格）。

## 判定サマリ

CLI フラグ `--expression-gain` → orchestrator `expressionIntensity` → 翻訳層 `translateExpression`
の 1 本が最後まで通っており、Orch-Sylph が確定した 4 つの設計判断すべてが実装に正しく反映されている。
翻訳層は不変、gain=1.0 で挙動完全不変、境界不変。テスト 337 緑（+6）。**実装は合格**。

唯一の注意点は機械ゲートの `check:source` が EXIT 1 だが、これは**器コード
`apps/runtime-player/src/main/physiology/index.ts` の既存 barrel 違反**であり、本変更が触れていない
ファイル（working tree で unchanged・最終改修は commit ed49b5d）に由来する。soul 特区外のため
domain-c では修正できず、本変更が持ち込んだ退行でもない。詳細は §実行生数字と §注意事項。

## 1. 設計適合（4 つの設計判断）

| # | 設計判断 | 実装確認 | 判定 |
|---|---|---|---|
| 1 | 範囲ガード [0.1,3.0] inclusive・域外/非有限は起動時エラー（サイレント丸めしない） | `resolveExpressionGain`（cockpit.mjs L97-111）: `Number.isFinite` かつ `>=0.1` かつ `<=3.0` のみ通す。それ以外は throw。`main()` L269 で resolve→throw は L438 `main().catch`（`[cockpit] FATAL:`→exit 1）に落ちて起動失敗になる経路が繋がっている。resolve は L269（server.listen 前・eager ensureFireResources L357 前）で fail-fast | ✓ |
| 2 | フラグ名 `--expression-gain` ↔ 内部 `expressionIntensity` のマップ | parseCockpitArgs L75 で `--expression-gain`→`args.expressionGain`。main L269→L328 `createFireOrchestrator({ expressionIntensity: expressionGain })` | ✓ |
| 3 | クランプは翻訳層で既実装＝CLI は範囲ガードのみ・翻訳層不変 | `src/mind/expression-translator.mjs` は working tree で unchanged（git status で soul 内の変更は scripts 2 ファイルのみ）。CLI はクランプに一切触れない | ✓ |
| 4 | gain=1.0（既定）で挙動完全不変・S2.5 無退行 | 未指定→resolve が 1.0 を返す（L98）。orchestrator の `expressionIntensity` 既定も 1.0（fire-orchestrator.mjs L115-116）。起動ログの追加行は `if (expressionGain !== 1.0)`（L389）で 1.0 のときは 1 バイトも出さない | ✓ |

### 配線の実在（Gnome 説明に依存せず裏取り）
`src/mind/fire-orchestrator.mjs` を直接確認:
- L83/L115-116: `options.expressionIntensity`（number なら採用・既定 1.0）を受ける口が実在。
- L152: `translateExpression(ev.word, ev.args, expressionIntensity)` へ実際に渡している。

→ CLI → orchestrator → 翻訳層の貫通は名前だけでなく値として通っている。`resolveExpressionGain` の
境界判定（0.1 と 3.0 が inclusive で通り、0.05/3.5/0/NaN/Infinity/`Number("abc")` が throw）はコードと
テスト両方で確認。フラグ値省略時は `Number(undefined)=NaN`→throw で握り潰さない（安全側）。

## 2. テスト適合

- 新規 6 ケース（cockpit.test.mjs L46-74）が要件を正しく突いている:
  - parseCockpitArgs の数値化（`"1.5"`→1.5）／未指定 undefined
  - resolve の既定 1.0／境界 0.1・3.0・代表 1.5／域外 throw（0.05・3.5・0）／非有限 throw（NaN・Infinity・`Number("abc")`）
  - throw メッセージに許容域/gain を含むことを `/0\.1|3|gain/i` で assert
- **既存ケースは本体不変**。差分は import 行への `resolveExpressionGain` 追加 1 行のみ（テスト assertion の改変なし）。既存の parseCockpitArgs/createLazyChannel ケースは 1 行も変わっていない。

## 3. 記録適合

- `s4-followup.md §3-4`: **【CLOSED・S4 追撃 domain-c で配線済み】**に更新。フラグ名は §3-4 例示の
  `--expression-intensity` ではなく **`--expression-gain`** を採用した旨を明記（ユーザーの語「ゲイン」に合わせた）。✓
- `domain-c.md`（新規）: 貫通経路・4 設計判断・範囲ガード根拠・テスト・機械ゲート・推奨初期値 1.5・
  Orch への申し送りを網羅。設計判断を正しく記録。✓
- `README.md`（L147 付近）: `--expression-gain <倍率>`（強さ・全 peak 一括スケール・既定 1.0・許容 0.1〜3.0・
  域外/非数値は起動時エラー）を追記。正確。✓
- `human-gate-procedure.md`: 再ゲート手順に **推奨初期値 1.5** と起動コマンド例・gain≠1.0 時のログ行注記あり。正確。✓

## 4. 実行生数字（自分で実行）

- **node --test（`apps/soul/agent`・タイムアウト付き）**: `# tests 337 / # pass 337 / # fail 0`。
  ベースライン 331 → 337（+6・本 Domain の新規 6 ケースのみ）。**無退行**。
- **3 チェック（リポジトリルート・install せず）**:
  - `pnpm run check:deps` → **EXIT 0** ✓
  - `pnpm run check:soul-zone` → **EXIT 0** ✓（soul 特区境界・肝）
  - `pnpm run check:source` → **EXIT 1**（`apps/runtime-player/src/main/physiology/index.ts: index.ts must remain a barrel-only entrypoint`）。
    **本変更とは無関係の既存違反**: 当該ファイルは working tree で unchanged（本変更は soul 特区と discussion のみ）・
    最終改修は commit ed49b5d（C6 統合追撃）で本 wave 以前。器コードのため soul 特区の domain-c では修正不可。
- **境界不変**（git status --porcelain / git diff --stat）: 変更は
  `apps/soul/README.md`・`apps/soul/agent/scripts/cockpit.mjs`・`apps/soul/agent/scripts/cockpit.test.mjs`・
  `discussion/**`（human-gate-procedure.md・s4-followup.md・新規 domain-c.md）に限られる。
  器コード（`apps/runtime-player/**`・`packages/**`）・C4/C5 契約 JSON・`pnpm-lock.yaml`・
  ルート/各 `package.json` は**一切変わっていない**。✓
  （`.tmp/` 配下の untracked ファイル群は facex 別作業で本 wave と無関係・src 外。）

## 5. 裁量判断（設計未定義だが合理的）

- フラグ値省略時（`--expression-gain` の後に値なし）は `Number(undefined)=NaN`→throw で起動失敗。
  明示 throw に落ちるため安全側で妥当。
- 起動ログの gain 行を `!== 1.0` 判定で出す設計は「既定は完全無退行・非既定は 1 行だけ可視化」で
  S2.5 無退行と操作可視性を両立しており妥当。

## 6. 差分（要修正）

なし（実装・テスト・記録に修正指摘なし）。

## 7. 残課題 / Orch への申し送り

1. **`check:source` の既存赤（要 Orch 判断）**: domain-c.md の Status 行「機械ゲート緑（2026-07-13）」は、
   pnpm の `check:source` が赤である点で厳密には過剰主張になり得る。ただしこの赤は器コード
   `apps/runtime-player/src/main/physiology/index.ts` の**既存 barrel 違反**（本変更が触れていない・
   soul 特区外で domain-c では修正不能）。domain-c.md §5 自身は「3 チェック」を diff ベース（器 diff 空 /
   lockfile 不変 / 既存テスト不変）で定義しており、その 3 条件はすべて成立している。
   → 本変更の合否には影響しないが、Status 表記を「soul 特区の機械ゲート緑・`check:source` は器の既存違反で
   赤・本変更と無関係」と限定するか、器側の barrel 違反を別途起票するかは Orch の裁量に委ねる（本レビューでは
   実装退行ではないと判断し合格とした）。
2. **本追撃は再ゲート（実機で強さ体感を確認）で完結する性質**。CLI 配線・範囲ガード・貫通は完了しテストで固定。
   残るのは「1.5 で『もうちょっと大きく』を満たすか・足りなければどこまで上げるか」で、実機の見え方でしか
   決められない（human-gate-procedure.md §3 の再ゲート手順に沿う）。

## 判定

**合格**（要修正なし）。§7-1 の Status 表記のみ Orch の裁量事項として申し送る。
