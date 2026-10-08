# Wave 105 Plan: Variant Visibility Gate for Perception + Artifact-Wait Protocol Experiment

> Wave105 は二重目的の小 wave。①知覚経路（renderView / 測量 / フレーミング）に Variant（差分管理）可視性ゲートを組み込み、Fable の視覚とユーザーの視覚を一致させる（wave104 の仕様伝達漏れの解消）。②Orch-Sylph の子待機を「成果物待ち（artifact-wait）プロトコル」で自己完結させる統制実験を行い、L0 中継への依存を解消する。

## 1. Status

- Status: Planned / ready for orchestration
- Target wave: Wave105
- Wave name: `variant-visibility-gate-perception`
- Primary objective:
  - 知覚評価に `base visible AND variantVisibilityPredicate(activeSelections)` の二層合成を適用する（snapshot レベル）。
  - `renderView` / `inspectEvaluatedGeometry` に optional な variant selection 指定を追加し、解決済み selection をサイドカー・測量結果に記録する。
  - ref の目視 gate 成果物（PNG 3 枚）を正しい Default 衣装で再生成する。
  - Orch-Sylph が L0 中継なしでドメインループを完走できるか、artifact-wait プロトコルで実測する。

## 2. Planning Gate Result

Planning Gate result: `Inventory first` — 完了済み。

- Inventory: Variant 機能調査（opus）を [../../model-authoring/research/variant-feature-survey.md](../../model-authoring/research/variant-feature-survey.md) に固定済み。
- ユーザー確認済み: 仕様伝達漏れとしての位置づけ / L0 裁定 2 件の追認（§3.1）/ artifact-wait 実験の実施 / **死亡推定経路の撤廃**。
- Uncertainty: factual low（純関数・参照実装・ref 実データまで確認済み）、decision low、cost of wrong plan low（単一ドメインの狭い変更）。

## 3. Accepted Decisions / Oracles

### 3.1 Variant ゲートの意味論（survey の L0 裁定、ユーザー追認済み）

Required:

- **適用点は snapshot レベル**（evaluation-adapter）。snapshot の drawable 可視性に `base && predicate` を合成してから、描画・測量・bounds・drawableFocus のすべてが消費する。目と巻尺が同一の可視性世界を共有すること。
- predicate / default selection は **authoring-core の純関数を消費する**（`createVariantVisibilityPredicate` / `resolveDefaultVariantActiveSelections`）。再実装禁止。参照実装は Runtime Export materialization の二層合成（`runtime-export-materialization.ts:93-102,146,154-155`）だが、Export は経由しない。
- **payload に optional `variantSelections` を追加**（renderView / inspectEvaluatedGeometry 共通の形）。省略時 = パッケージの defaultActive。存在しないグループ / variant への参照は決定論的 reject。
- **解決済み selection をサイドカーと測量結果に記録する**（空の場合も空として記録。「どの衣装で撮った写真か」の証明）。
- **空ケース不変**: variantGroups 無しのパッケージでは挙動・出力バイトとも従来と完全一致であること（純関数は空で恒等を返すことを調査で確認済み。これをテストで固定する）。
- 測量: ゲートで非表示になった drawable もジオメトリは計算・返却してよいが、**ゲート適用後の可視性フラグを結果に含める**（隠れたものを意図的に測る用途は正当。ただし隠れていることを黙らせない）。

Forbidden:

- runtime-core への variant 概念の導入（variant を知らないのは設計であり、ゲートはアダプタ層の責務）。
- authoring-core の変更（純関数の消費のみ）。
- Editor / Viewer の selection 状態（セッションローカル）への依存・模倣。知覚経路の正は defaultActive + 明示 override のみ。

### 3.2 Artifact-Wait プロトコル（統制実験。ユーザー合意済み）

本 wave の Orch-Sylph は次のプロトコルで子を扱い、**その観測結果をドメイン報告書に記録する**（実験データ）:

1. **委任契約に完了成果物パスを必須で含める**: Gnome には「完了時に報告ファイルを所定パス（`discussion/implementation/waves/wave105/wave105-domain-a-gnome-report.md` 等）へ書き出す」を義務付ける。Review-Sylph は従来通りレビューレポートファイル。
2. **Orch-Sylph は子の完了を Monitor で待つ**: 契約パスのファイル出現を条件とし、成立で自己再開する。
3. **待機は無期限**。「長時間静止 + 成果物なし → 死亡疑い」という推定経路は**存在しない**（ユーザー決定。Codex 時代に健常な子を殺す事故が多発した経緯による）。子を終わらせてよいのは、子自身の完了 / エラー返答、またはユーザーの明示指示のみ。沈黙・遅延を理由とする再起動・代替実装は禁止。
4. **L0（Undine）への完了浮上はフォールバック**: Monitor が機能しない場合も、子の完了は L0 に浮上し L0 が中継するため系はデッドロックしない。Orch は中継を要求する状況を作らないことを目指すが、中継が来た場合は正常に受けてよい。
5. 記録事項: Monitor 自己再開が機能したか / L0 中継が何回必要だったか / 発生した想定外挙動。

### 3.3 Model Allocation（従来通り）

L0 = fable / Orch-Sylph・Gnome・Review-Sylph = **opus**（Agent 呼び出しで `model` 明示必須）。較正ログ Round 1-3 を basis とする。

### 3.4 目視 gate の順序

wave104 生成の PNG 3 枚は**約 9 drawable の余分描画を含む既知の不完全版**であり、ユーザー目視 gate は wave105 の再生成後に実施する（[../../model-authoring/_map.md](../../model-authoring/_map.md) の次の行動を更新済みの前提）。

## 4. Primary Basis

- [../../model-authoring/research/variant-feature-survey.md](../../model-authoring/research/variant-feature-survey.md)（本 wave の直接根拠。概念モデル・再利用点・ref 実データ・空ケース）
- [../waves/wave104/wave104-final-integration-report.md](../waves/wave104/wave104-final-integration-report.md)（知覚経路の現状と引き継ぎ）
- [wave104-plan.md](wave104-plan.md) §3.2（サイドカー仕様）・§3.3（測量仕様）
- `.claude/skills/implementation-orchestration/SKILL.md`（ハンドリング規則。§3.2 の実験は規則 1-3 の次期改訂の実証データとなる）
- Required conventions: 開発規約 4 本（wave104 §4 と同一）

Known source facts（証拠パスは survey 内）:

- `createVariantVisibilityPredicate({variantGroups?, activeSelections?})` — 空で恒等、selections 省略で defaultActive 導出。authoring-core から import 可能（authoring-host は依存済み）。
- runtime-core は variant 非認知（grep 0 件）。snapshot の visible は base のみ。
- 適用対象: `apps/authoring-host/src/perception/evaluation-adapter.ts`（snapshot 生成点）。
- ref: グループ 1（Ware / singleSelect / 3 variants）、targets 15、Default 通過 6。ゲート無しでは約 9 drawable 余分描画。

## 5. Wave Strategy

```text
Batch 1:
  Domain A: Variant Visibility Gate（単一実装ドメイン）
Batch 2:
  Domain B: Final Integration / Clean Review / Map Closeout
```

単一ドメインの理由: 変更は evaluation-adapter を頂点に知覚スタック内で完結し、分割は調整コストだけ増やす（wave102 型）。

## 6. Domain A: Variant Visibility Gate

Domain id: `wave105-variant-visibility-gate`

Allowed write scope:

- `apps/authoring-host/**`（evaluation-adapter のゲート適用、payload 解決・validation、サイドカー / 測量結果への selection 記録、テスト、ref e2e 更新、perception-fixtures への variant 付きフィクスチャ追加）
- `packages/ai-interface/src/**` — `variantSelections` の payload / result / サイドカースキーマ追加（純 zod）とテストに限る狭い追加。boundary allowlist 無変更
- `discussion/model-authoring/experiments/ref-render-gate/**`（PNG 3 枚 + サイドカーの再生成、README 更新 = Default 衣装で描画されている旨・selection 記録の読み方）
- ルート `package.json` — scripts 追加のみ
- Domain A report / review files（`discussion/implementation/waves/wave105/`, `discussion/implementation/reviews/wave105/`）

Forbidden write scope:

- `packages/runtime-core/**`、`packages/authoring-core/**`、`packages/render-software/**`、`packages/render-webgl2/**`、`packages/operation-core/**`、`packages/validator-core/**`、`packages/package-format/**`
- `apps/editor/**`、`apps/runtime-player/**`、**`ref/**`（read-only）**
- 新規外部依存 / lockfile / `pnpm install`（必要時 escalate。代替配線での回避も禁止）

Required implementation:

- evaluation-adapter: `session.graph.variantGroups` から predicate を生成し（明示 selections があればそれを、無ければ defaultActive）、snapshot の drawable 可視性に AND 合成する
- payload: `variantSelections`（optional）の zod スキーマ、defaultActive への解決、不正参照（未知の group / variant、mode 不一致）の決定論的 reject
- サイドカー: 解決済み selections（空含む）を必須記録。測量結果: ゲート適用後可視性フラグ + 解決済み selections
- ref e2e 更新: ①default selection で「Default 衣装の 6 target のみ通過、他 9 が snapshot 非表示」をデータで assert ②PNG 3 枚 + サイドカー再生成（決定論 2 回バイト一致は維持）③override テスト（例: Rodos 指定で通過集合が変わる）
- README 更新

Required tests:

- **空ケース不変**: variant 無しフィクスチャで、ゲート導入前後の render 出力がバイト同一（既存 golden の無変更 pass で実証してよい）
- 合成フィクスチャ（variant group 付き）: default selection での通過 / 遮断が membership 通りであること（描画バイト差 + snapshot 可視性の両方で）
- override selection で通過集合が変わる / singleSelect に複数指定等の不正は reject
- 未知 group / variant 参照の決定論的 reject
- サイドカーの selections 記録（省略時 = defaultActive 解決値、明示時 = その値、空 = 空）
- 測量の可視性フラグ（ゲートで隠れた drawable のジオメトリは返るがフラグ false）
- ref e2e の上記 3 点
- 既存テスト非退行（authoring-host / ai-interface / render-software）

Escalate if:

- snapshot の可視性合成が runtime-core の評価結果の構造上不可能（読み取り専用等）で、runtime-core 変更が必要に見える場合（→ 実装せず報告。恒等 predicate の空ケースで挙動不変にできない場合も同様）
- multiToggle の意味論が purely-consumed 関数から一意に定まらない場合

## 7. Domain B: Final Integration / Clean Review / Map Closeout

Domain id: `wave105-final-integration-clean-review-map-closeout`

Wave104 Domain D と同型。Required checks:

- Domain A report + 3 レビューレーンの存在・pass
- focused テスト: authoring-host（ref e2e 含む）/ ai-interface / render-software
- root tsc / **app tsc（`npx tsc --noEmit -p apps/authoring-host/tsconfig.json`）** 両方 exit 0
- check-source-organization / check-dependencies（cmo3 = line 2486 の既知先行偽陽性分類を継続。新規 finding ゼロ確認）/ `git diff --check`
- Forbidden-scope diff check（runtime-core / authoring-core / render-* / editor / player / ref/ 無変更、boundary 非緩和、新規依存ゼロ）
- 最終統合報告書 / 独立 Review-Sylph による final clean integration review / waves・reviews の `_map.md` / orchestration `_map.md` の Wave105 エントリ更新
- **§3.2 プロトコル実験の観測結果**が Domain A 報告書に記録されていることの確認

## 8. Review Policy

Domain A に独立レビューレーン 3 本（すべて Review-Sylph, opus）:

- **Spec Compliance**: ゲート意味論が survey / Editor 適用実態（`canvas-evaluation.ts:242,321-323`）/ Export 参照実装と整合すること、空ケース不変（バイト同一）の実証、snapshot レベル適用（RenderScene だけでない）こと、サイドカー / 測量の selection 記録、ref e2e の「6 通過 / 9 遮断」assert が実データ由来であること
- **Design / Development**: authoring-core 純関数の消費（再実装なし）、runtime-core / authoring-core 無変更、boundary 非緩和、命名規約
- **Test Adequacy**: 各 Required test の実効性（オウム返し・弱いテストの検出。wave104 の前例に倣い、必要なら独自プローブ可。ただしプローブは完全復元し残渣ゼロを git で実証すること）

## 9. Verification Matrix

| Requirement | Minimum evidence |
|---|---|
| 目と巻尺が同じ可視性世界を見る | snapshot レベル適用のコード確認 + 測量フラグ);テスト |
| default selection で正しい衣装だけ描かれる | ref e2e の 6/9 assert + 再生成 PNG |
| 差分ゼロのパッケージで挙動不変 | 空ケースバイト同一テスト |
| 「どの衣装で撮ったか」が証明可能 | サイドカー selections 記録テスト |
| override で別衣装を見られる | override テスト |
| 不正 selection は黙って通らない | reject テスト |
| L0 中継なしでドメインループが回るか | Domain A 報告書のプロトコル観測記録（実験であり pass 条件ではない） |

## 10. Expected Persistent Artifacts

- `discussion/implementation/waves/wave105/wave105-domain-a-variant-visibility-gate-report.md`（Gnome 報告ファイル・プロトコル観測記録含む）
- `discussion/implementation/waves/wave105/wave105-final-integration-report.md`、`_map.md`
- `discussion/implementation/reviews/wave105/wave105-domain-a-{spec-compliance,design-development,test-adequacy}-review.md`、`wave105-final-clean-integration-review.md`、`_map.md`
- `discussion/model-authoring/experiments/ref-render-gate/`（再生成 PNG + サイドカー + README）

## 11. Subagent Contract

- 共通義務は wave104 §13 と同一（分離・model 明示・スコープ厳守・Basis Coverage Self-Report・install 禁止 + 回避工作禁止）。
- **本 wave 固有（§3.2 実験）**: Orch-Sylph は子への委任契約に完了成果物パスを含め、Monitor によるファイル出現待ちで自己再開を試みること。待機は無期限。沈黙を理由とする再起動・代替作業は禁止。L0 からの中継が来た場合は正常に受けること。観測結果（Monitor 自己再開の成否 / L0 中継回数 / 想定外挙動）をドメイン報告書に記録すること。
- Gnome: 完了時に最終メッセージとは別に、報告ファイルを契約パスへ書き出すこと。

## 12. Out of Scope

- Variant の編集操作（グループ / membership の作成・変更）— 将来の閉問題候補
- Editor / Viewer の selection UX、Runtime Player の variant 切替（別トピック）
- multiToggle 固有の UI 的関心（predicate 意味論は純関数が扱うため実装は自然にカバーされる）
- 閉問題 01 の実験実行そのもの
- 新規外部依存、Cubism 互換
