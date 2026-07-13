# S4 追撃 Domain C: 演出強さ係数（ゲイン）の CLI 配線（`--expression-gain`）

> Status: 実装完了・soul テスト 337 緑・`check:deps`/`check:soul-zone` EXIT 0。`check:source` は
> `apps/runtime-player/src/main/physiology/index.ts` の既存 barrel 違反で EXIT 1 だが、本変更は当該ファイル
> 未 touch のため本変更由来の退行ではない（§5）。人間ゲート（再ゲート・強さ確認）待ち。
> 担当: Gnome（Orch-Sylph 委任・S4 追撃）。対象パッケージ: `apps/soul/agent`（独立 npm・lockfile 不変）。
> 前提: S4 本 wave（[domain-a.md](domain-a.md) 翻訳層 + orchestrator ／ [domain-b.md](domain-b.md) 可視化）
> 完成・人間ゲート良好。ユーザー要望「もうちょっと大きくリアクションしたい／ゲインを調整したい」に応える
> **極小 CLI 配線**（設計は S4 本 wave で完成済み・穴は CLI フラグだけだった＝s4-followup §3-4）。

## 0. この Domain が塞いだ穴（貫通経路）

S4 本 wave で強さ係数は翻訳層・orchestrator まで完成していたが CLI 未配線だった。本 Domain は
**CLI フラグ → orchestrator オプション → 翻訳層**の 1 本を最後まで通す:

```
--expression-gain <倍率>                         [C: parseCockpitArgs で数値化]
  → resolveExpressionGain(raw)                   [C: 範囲ガード純関数・域外/非有限は起動時 throw]
  → createFireOrchestrator({ expressionIntensity })  [S4 本 wave・貫通済み]
  → translateExpression(word, args, intensity)   [S4 本 wave・全 peak 一括スケール + 域クランプ]
  → 全 payload の peak が一括スケール（域はスロット別 [-1..1 / 0..1] へクランプ済み）
```

CLI フラグ名 **`--expression-gain`**（ユーザーの語「ゲイン」に合わせた）↔ 内部 orchestrator オプション
**`expressionIntensity`**（S4 本 wave の設計名を尊重）のマップ。

## 1. 実装したファイル一覧

### 改修（既存・すべて `apps/soul/agent/`）
| ファイル | 変更点 |
|---|---|
| `scripts/cockpit.mjs` | `parseCockpitArgs` に `--expression-gain`（`Number(argv[++i])`・未指定 undefined）追加・args 型注釈に 1 行。範囲ガード純関数 `resolveExpressionGain(raw)` を **export**（未指定→1.0・[0.1,3.0] inclusive はそのまま・域外/非有限は throw）。`EXPRESSION_GAIN_MIN/MAX` を export。`main()` で resolve → `createFireOrchestrator({ expressionIntensity: expressionGain })`。HELP 3 行追記。起動ログは **gain≠1.0 のときだけ** 1 行（1.0 は既存出力を一切変えない）。 |
| `scripts/cockpit.test.mjs` | 新規 6 ケース（下記 §4）。**既存ケースは 1 行も触っていない**。 |

**触っていない（無退行の対象・変更禁止だったもの）**:
`src/mind/expression-translator.mjs`（intensity 適用 + 域クランプ・防御）／
`src/mind/fire-orchestrator.mjs`（`expressionIntensity` 貫通）／
`src/mind/expression-translator.test.mjs`（ゲイン/クランプ/0/非有限の純関数テスト網羅済み）は**一切不変**。
器コード（`apps/runtime-player/**` / `packages/**`）・C4/C5 契約 JSON・`pnpm-lock.yaml`・`package.json` も
完全不変（`git status -- apps/runtime-player packages pnpm-lock.yaml '**/package.json'` が空・新規依存ゼロ・
Node 組み込みのみ）。

## 2. 設計判断（守ったこと）

1. **クランプは翻訳層で既実装＝CLI 側は範囲ガードのみ**。`translateExpression` が `peak × intensity` を
   スロット域（中央スロット head/gaze/body は [-1,1]、重みスロット eye-blink-*/mouth-smile は [0,1]）へ
   **クランプ済み**（[domain-a.md](domain-a.md) §3・[expression-translator.mjs] のヘッダ）。CLI は翻訳層の
   クランプに一切触らない。→ 高ゲイン時も演出が丸ごと欠けることはなく境界に張り付く（拒否任せの逆効果を回避）。
2. **フラグ名 ↔ オプション名のマップ**: CLI フラグ **`--expression-gain`**（ユーザー要望の語「ゲイン」）
   ↔ 内部 orchestrator オプション **`expressionIntensity`**（S4 本 wave の設計名）。既存フラグ
   （`--fire-max-chars` 等）と同型の書き方に揃えた。
3. **範囲ガード [0.1, 3.0]（inclusive）・域外/非有限は起動時エラー**。`resolveExpressionGain` は域外・非数値・
   非有限（NaN/Infinity）を**サイレント丸めせず throw** し、その throw は既存 `main().catch`
   （`[cockpit] FATAL:` → exit 1）で起動失敗になる（打ち間違いをユーザーに気づかせる）。翻訳層の
   「負値→1.0 丸め」は最終防波堤として残るが、CLI 契約は明示エラーで先に弾く二段構え。
4. **gain=1.0（既定）は挙動完全不変**。未指定→resolve が 1.0 を返し、orchestrator の `expressionIntensity`
   既定も 1.0。起動ログの追加行も **1.0 のときは出さない**ため既存出力は 1 バイトも変わらない
   （S2.5 無退行・既存テスト無退行）。

## 3. 範囲ガード [0.1, 3.0] の根拠

- **下限 0.1**: 演出がほぼ見えなくなる下限（全 peak が 1/10・実質「演出なし」に近い）。0 は throw
  （演出を完全に殺す設定は打ち間違いの可能性が高く、無効化したいなら演出語を吐かせない別経路がある）。
- **上限 3.0**: これ以上上げても**多くの peak がクランプ境界に張り付き頭打ち**になる安全上限。例えば
  smile の eye-blink 0.35 は gain 2.9 で上限 1.0 に達し、gaze-horizontal -0.6（look-away）は gain 1.67 で
  境界 -1.0 に達する。3.0 では大半の peak が飽和するため、それ以上を許しても体感は増えず打ち間違いの温床に
  なるだけ。→ 上限で切って明示エラーにするのが安全。

## 4. 追加したテスト（既存は不変）

`scripts/cockpit.test.mjs` に 6 ケース追加（各 `{ timeout: 5000 }`）:
- `parseCockpitArgs(["--expression-gain","1.5"]).expressionGain === 1.5`。
- `parseCockpitArgs([]).expressionGain === undefined`（**新規独立ケース**・既存 "no flags" ケースは不変）。
- `resolveExpressionGain(undefined) === 1.0`。
- 境界と代表値: `0.1 → 0.1`・`3.0 → 3.0`・`1.5 → 1.5`。
- 域外 throw: `0.05`（下限未満）・`3.5`（上限超過）・`0`。
- 非有限 throw: `NaN`・`Infinity`・`Number("abc")`（=NaN）。メッセージに許容域/値を含むことを軽く assert
  （`/0\.1|3|gain/i`）。

## 5. 機械ゲート生数字（無退行の確認）

`cd apps/soul/agent && node --test`（タイムアウト付きで実行）:

```
# tests 337
# pass  337
# fail  0
```

- **ベースライン 331（S4 本 wave 完了時）→ 337（+6）**。増分は本 Domain の新規 6 ケースのみ。
- 3 チェック: (a) 器コード diff 空・(b) lockfile/package.json 不変・(c) 既存テスト変更なし
  （純関数 fixture / 翻訳層 / orchestrator / 既存 cockpit ケース全緑・assert 緩めなし）。

**リポジトリルート 3 チェックの生 EXIT**（pnpm 実行）:

| コマンド | EXIT | 備考 |
|---|---|---|
| `pnpm run check:deps` | 0 | 緑 |
| `pnpm run check:soul-zone` | 0 | 緑 |
| `pnpm run check:source` | 1 | 赤の原因は `apps/runtime-player/src/main/physiology/index.ts: index.ts must remain a barrel-only entrypoint` の 1 件のみ。器コードの既存 barrel 違反で、本 Domain は当該ファイルを一切 touch していない（`git status -- apps/runtime-player` 空）ため本変更が持ち込んだ退行ではない。 |

## 6. 推奨初期ゲイン

**1.5** を推奨初期値として記録。ユーザー要望は「もうちょっと大きく」なので、まず 1.5 で様子見 →
足りなければ上げる、という運用。2.0 以上だと多くの peak がクランプ境界に張り付き頭打ちになる（§3）ため、
段階的に上げるのが良い。上限は 3.0。人間ゲートでの調整手順は
[human-gate-procedure.md](human-gate-procedure.md) §3 の再ゲート注記に記載。

## 7. §質問（Orch への申し送り）

1. **本追撃は再ゲート（人間の目で強さを確認）で完結する性質**。CLI 配線・範囲ガード・貫通は済み・
   テストで固定。残るのは「1.5 で体感が『もうちょっと大きく』を満たすか、足りなければどこまで上げるか」で、
   これは実機の見え方でしかユーザーが決められない（[human-gate-procedure.md](human-gate-procedure.md) §3）。
2. **操縦席 UI には調整ノブを置かない裁定を維持**（[domain-b.md](domain-b.md) §2・s4-followup §3-2）。
   強さ調整は CLI/設定限定（Player 側の per-model / per-slot 質感補正は器の領分＝四層昇格の②以降）。
   本 Domain は魂側の一括ゲイン（①普遍既定値の全体スケール）のみで、その方針を踏襲した。
