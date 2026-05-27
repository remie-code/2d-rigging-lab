# MVP Vertical Slice Architecture

> 状態: Draft
> 目的: GUI Editor 必須の Authoring-to-Runtime MVP に必要なコンポーネント責務、Shared Runtime evaluation core の境界、loader / adapter / renderer / validator / operation core の関係を固定する。

## 1. 根拠の分離

### 1.1 リポジトリ事実

- `AC-MVP-001` は、GUI Editor をMVPの必須制作入口とし、CLI、script、AI操作、手書きJSONだけの生成をMVP達成としない。
- `AC-MVP-011` は、Editor preview、保存、再読み込みが成立することを要求する。
- `AC-MVP-012` は、Runtime / Viewer が GUI Editor で保存した package を読み込み、parameter操作に応じた表示と runtime state を返すことを要求する。
- `AC-MVP-013` は、Validator が schema、asset、mesh、drawable、parameter、rig control、mask、runtime load、代表parameter評価を構造化reportへ出すことを要求する。
- `AC-MVP-014` は、AI Agent が model structure、runtime snapshot、operation dry-run、diff、validation report、repair candidate を扱えることを要求する。
- `SC-MVP-003` は、Editor保存、再読み込み、Viewer表示、runtime state snapshot保存の一周を要求する。
- `SC-MVP-004` は、Validator実行、AI-readable report、AI dry-run、model/runtime/validation diff、repair candidate を要求する。

### 1.2 公式・参照事実

- Viewer / Preview 参照レポートは、Editor preview と Viewer を同一アプリ内の別機能とし、同じ private runtime core evaluation core を共有することを推奨している。
- Runtime評価セマンティクス参照レポートは、package loader / authoring graph adapter を Shared Runtime core の外側に置き、どちらも normalized runtime graph へ変換してから評価することを推奨している。
- RigControl参照レポートは、`rotation2d` と `warpLattice2d` を runtime-visible graph node として保存し、final vertexだけを保存する方式を避けることを推奨している。

### 1.3 設計仮定

- MVPの第一候補技術スタックは Web-first TypeScript である。
- Editor と Viewer は同一アプリ内機能だが、画面またはモードは分ける。
- Runtime core の最初の実装はTypeScript CPU evaluatorでよい。RendererがCanvas / WebGLへ進む場合も、評価意味論はCPU coreのsnapshotで検証可能にする。

## 2. 設計判断

### 2.1 縦切りの単位

MVPの縦切りは、次の一周を1つの設計単位にする。

1. 権利クリーン素材をGUI Editorで受け入れる。
2. drawable / texture / part / mesh / parameter / keyform / rig control / mask / draw order をGUI上で制作する。
3. Editor preview が dirty authoring graph を normalized runtime graph に変換し、Shared Runtime coreで評価する。
4. project-defined model package として保存する。
5. GUI Editor が同じ package を再読み込みする。
6. Viewer が保存済み package を package loader 経由で normalized runtime graph に変換し、Shared Runtime coreで評価する。
7. Validator が同じ package と代表parameter入力を検証し、AI-readable reportを出す。
8. AI Agent Interface が stable ID を使って inspection、dry-run、diff、repair candidate、再検証を扱う。

### 2.2 コンポーネント責務

| コンポーネント | MVP責務 | 持ってよい状態 | 持ってはいけない状態 |
|---|---|---|---|
| GUI Editor | 素材受け入れ、制作操作、authoring graph編集、保存、再読み込み、Editor preview起動 | dirty authoring graph、selection、lock、editor hide、active tool、undo stack、operation draft | Viewer専用load判定、runtime互換の暗黙保証 |
| Editor Preview | 制作中モデルを即時評価し、parameter、keyform、rig control、mask、draw order、警告を確認する | dirty revision、preview parameter overrides、overlay設定、Editor warning | 保存済みpackageだけを正とする状態 |
| Viewer | 保存済み package を読み込み、parameter操作、非空表示、runtime snapshot、diagnosticsを確認する | package revision、runtime parameter overrides、snapshot、load/evaluation diagnostics | authoring編集、selection、lock、未保存operation |
| Shared Runtime evaluation core | normalized runtime graph と parameter input から deterministic snapshot を返す | parameter state、keyform samples、rig control evaluated state、drawable final state、mask、draw list、diagnostics | DOM、Canvas、WebGL、file IO、Editor-only state、operation approval |
| Renderer | runtime snapshot の draw list と drawable state を描画する | renderer backend state、texture handles、viewport | model graphの正規化、validation判断 |
| Package Loader | project-defined model package を読み、ID tableと normalized runtime graph を作る | manifest、schema result、asset reference、load diagnostics | Editor-only dirty state |
| Authoring Graph Adapter | dirty authoring graphを normalized runtime graphへ変換する | dirty operation id、編集中keyform、未保存差分、adapter diagnostics | 保存済みpackageの唯一の読み込み責務 |
| Validator | schema / reference / semantic / runtime load / representative evaluation を検証する | check result、severity、target ID、evidence、repair candidate | GUI制作フローの代替 |
| Acceptance Runner | MVP scenarioの証拠を集め、Pass / Fail / Needs review / Not applicableを判定する | GUI authoring evidence、runtime snapshots、validation reports、AI diff evidence | 手書きJSONだけの成果をMVP達成扱いする判断 |
| AI Agent Interface | inspection、dry-run、diff、repair candidate、provenance、revalidationを提供する | structured command、operation draft、diff、report references | operation coreを経由しない直接破壊的変更 |

## 3. Shared Runtime Evaluation Core の境界

Shared Runtime core は、次だけを入力にする。

- normalized runtime graph
- parameter overrides
- evaluation profile: `preview`, `viewer`, `validatorStrict`, `aiDryRun`
- snapshot detail: `summary`, `targeted`, `full`
- evaluator version policy

Shared Runtime core は、次だけを出力する。

- runtime snapshot
- diagnostics
- optional trace

Shared Runtime core から除外するものは次である。

- packageファイルの読み書き
- dirty authoring graphの編集
- Canvas / WebGL / DOM
- GUI selection、lock、editor hide、overlay、active tool
- operation logへのcommit
- AI修復方針の選択

この境界により、Editor preview と Viewer は同じ評価意味論を使える一方で、制作支援状態が保存済みruntime結果へ漏れない。

## 4. Core / Adapter / Renderer / Validator / Operation の関係

```text
GUI Editor operation
  -> operation core
  -> authoring model core
  -> authoring graph adapter
  -> normalized runtime graph
  -> shared runtime evaluation core
  -> preview snapshot
  -> preview renderer + Editor warning

project-defined model package
  -> package loader adapter
  -> normalized runtime graph
  -> shared runtime evaluation core
  -> viewer snapshot
  -> viewer renderer + diagnostics panel

project-defined model package + representative parameters
  -> validator core
  -> package loader adapter
  -> shared runtime evaluation core
  -> validation report
  -> AI-readable report / acceptance evidence

AI Agent structured command
  -> operation core dry-run
  -> temporary authoring model core
  -> runtime snapshot diff
  -> validation diff
  -> repair candidate + provenance
```

### 4.1 Operation core

Operation core は、GUI操作、AI structured command、migration、repair candidate適用の共通入口にする。

- `createDrawable`
- `generateMesh`
- `moveMeshVertex`
- `createParameter`
- `addKeyform`
- `createRotation2dRigControl`
- `createWarpLattice2dRigControl`
- `bindRigControlChild`
- `setMaskRelation`
- `setDrawOrder`
- `setRuntimeVisibility`
- `setRightsMetadata`

GUIもAIも同じoperation coreを経由する。これにより operation log、undo/redo、dry-run、diff、validation再実行を同じ語彙で扱える。

### 4.2 Model core

Model core は、authoring graph の正規データを保持する。stable ID、参照関係、runtime-visible state、Editor再編集に必要なauthoring metadataを扱う。

Model core はRendererを知らない。RendererはRuntime snapshotを読む。

### 4.3 Validator core

Validator core は、Package Loader、Authoring Graph Adapter、Shared Runtime coreを呼び出せるが、GUIやRendererへ依存しない。

Editor内警告は Validator core の incremental profile を使う。Acceptance Runnerは Validator core の strict / scenario profile を使う。

## 5. Design Completion Conditions

実装前に、このアーキテクチャ設計で完了しているべき条件は次である。

- Editor preview と Viewer が共有する Runtime core の入力・出力型が決まっている。
- package loader と authoring graph adapter の責務差が決まっている。
- Renderer が model package ではなく runtime snapshot を消費することが決まっている。
- Validator が static schema check だけでなく runtime load test と代表parameter評価を行うことが決まっている。
- AI Agent Interface が operation core / model core / validator core を正として使うことが決まっている。
- Editor-only state と runtime-visible state の境界が全コンポーネントで一致している。

## 6. 実装前に決めるべき未決事項

- normalized runtime graph の最小型とファイル分割の対応。
- Editor preview が dirty authoring graph を毎回adapter変換するか、incremental normalized graph cacheを持つか。
- Runtime core の初期backendを CPU TypeScript のみで固定するか、Renderer向けGPU pathと同時に設計するか。
- Acceptance RunnerがGUI authoring evidenceをどう取得するか。operation log、Playwright trace、Editor session metadataのどれを必須証拠にするか。
- `parameter-grid-2d-v1` のGUI編集最小UIとfixture期待値。MVP採用は確定済みであり、未決は操作導線とテスト粒度に限定する。

## 7. Post-MVPでよい未決事項

- desktop shellをElectronにするかTauriにするか。
- 第三者形式比較機能（MVP外・権利確認前提）。
- motion / expression / physics / pose の本格runtime layer。
- WebGL最適化、multi-backend conformance suite、profiling UI。
- 自動修復の承認ポリシーと複数案比較UI。
