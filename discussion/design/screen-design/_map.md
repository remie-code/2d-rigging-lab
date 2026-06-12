# Screen Design Map

> `discussion/design/screen-design/` の入口地図。GUI Editorを中心とする画面設計、画面遷移、主要領域、表示情報分類、人間向けUIとCodex/evidence surface境界を扱う。

## 位置付け

このディレクトリは、特定wave専用ではなく、GUI Editorの画面設計トピックを保持する。

Wave51前のdiscussionをきっかけに作成されたが、内容としてはもっと早い段階で固定しておくべきだった基礎設計である。以後のwave計画では、必要に応じてこのディレクトリをscreen designの正本として参照する。

## ファイル一覧

| Path | Role | Status |
|---|---|---|
| [_map.md](_map.md) | このディレクトリの入口地図 | Active |
| [scope-and-principles.md](scope-and-principles.md) | Editor UX画面設計の目的、非ゴール、問題設定、設計体系、ユーザー判断論点 | Active design basis |
| [overview.md](overview.md) | 画面体系全体、Global UX Flow、画面一覧、機能IDの大まかな配置 | Draft screen design |
| [e2e-oracle.md](e2e-oracle.md) | Playwright E2Eが保証する範囲と保証しない範囲。人間のvisual checkとの境界 | Accepted oracle |
| [screens/](screens/_map.md) | 各画面固有のレイアウト、Task-Local Flow、表示情報、非表示情報、関連機能ID | In discussion |
| [components/](components/_map.md) | 複数画面で共有するUI概念、常設領域、共通操作部品 | In discussion |
| [inventories/](inventories/_map.md) | 画面設計の根拠となる現状UI・依存・機能分類の棚卸 | Inventory |
| [editor-rebuild-purge-policy.md](editor-rebuild-purge-policy.md) | 旧 `apps/editor` GUI / e2e / GUI由来ドキュメントを削除対象として扱い、UX駆動でEditorを再構築する方針 | Accepted / Wave56 basis |
| [react-editor-foundation-oracle.md](react-editor-foundation-oracle.md) | React Editor再構築の技術スタック、source構成、validation境界、非ゴールに関する合意済みオラクル | Accepted / Wave57+ active basis |

## 現在の焦点

- Editor起動直後は、PSD import画面でもlegacy/debug/evidence/Codex-heavy panel stackでもなく、Primary Human UIとしてのauthoring workspaceに見えるべきである。
- 旧 `apps/editor` GUI / e2e は再利用候補ではなく削除対象として扱う。以後の再構築は [editor-rebuild-purge-policy.md](editor-rebuild-purge-policy.md) を基準に、目標UXとheadless baselineから組み直す。
- Wave56は破棄する。ただしWave56 Domain B/Cで完了したheadless baseline / package分離は後続事実として引き継ぐ。
- Wave57は [react-editor-foundation-oracle.md](react-editor-foundation-oracle.md) に従い、`apps/editor` をReact stackで再削除・再作成し、起動直後のAuthoring Workspace placeholderまでを `pass` 記録済みである。Wave57後もこのoracleをEditor再構築のactive basisとして扱う。
- PSD importは通常workspaceから呼び出すtaskであり、既存panel延命ではなくclean human task UIとして扱う。PSD Import Taskの目標UXはAuthoring Workspace上に重なる大きめのmodalである。Wave58で、fixture PSD選択からImport Review、placeholder preview、planned Editor Parts構造、Import後のWorkspace Parts Tree反映までのv0導線がpass記録済みである。次のPSD Import UXでは、Import Review右側のPSD単体previewをplaceholderからvisible layer / visible groupの確認表示へ進め、hidden PSD groupはPart Containerのeditor-only hidden gateへ写す。Import Review previewではclipping再現を必須要件にしない。
- Canvas / PreviewはPSD由来drawableをEditor rendererで表示する中心領域であり、PSD描画を後回しにしない。MVPではPSD canvas基準、visible drawable配置、source order描画、opacity、normal alpha blend、clipping、selection overlay、zoom / pan / fit、Canvas toolbarを扱う。Photoshop pixel perfect parityやペイント機能は非ゴールである。
- PSD Import / structural scaffoldは、Human UI、Codex-facing surface、test-facing surface、Evidence surfaceを分離する。Human UIはPSD Import Task、Codexはdeterministic command / operation API、testはstable IDs / structured state、evidenceはDiagnostics / Evidence Viewを主に使う。Human UIの主役は、作成予定Parts構造、PSD単体preview、行単位Issue badge、Import / Cancelである。
- Playwright E2Eは主要ユーザー導線とworkspaceへの状態反映だけを確認する。レイアウト、視認性、余白、pixel差分、Canvas描画品質は人間のvisual check領域であり、E2E oracleにしない。
- Wave51 はこの screen-design 実装負債への最初の基盤整備として final integration `pass` 記録済み。対象は production `data-testid` behavior coupling 除去、minimal Task/View Shell metadata、PSD Import Task structured observation projector、production `data-testid` guard、focused PSD regression preservation に限られる。
- Wave52 final integration report/review は PSD Import Task Migration v0 の bounded implementation baseline として `pass` 記録済み。PSD Import は Empty / Authoring Workspace から Task Shell task として開け、default では常設の巨大 workspace panel ではなくなった。Generic Task Shell / Task Chrome、PSD Import Task Human UI、narrow observation consumption、focused PSD regressions、standard `check` への `check:testids` 統合までが範囲である。
- `check:testids:fixtures` は利用可能だが、standard `check` には含めない。
- Wave53 final integration report/review は Workspace Layout Migration v0 の bounded implementation baseline として `pass` 記録済み。Authoring Workspace v0 skeleton、App Bar / Toolbox / Structure・Parts Tree / Canvas・Preview / Inspector / Parameter Bar / Diagnostics Strip の実配置、Toolbox経由の PSD Import Task entry、desktop/mobile smoke、既存 PSD focused paths、production `data-testid` guard、source/dependency guards の pass 記録を持つ。
- Wave54 Domains A-H reports/reviews と Domain H verification は `pass` 記録済み。workspace-scoped Task Window Shell v0、Toolboxから開く PSD Import task-window route、Diagnostics / Evidence skeleton route、Codex / Automation skeleton route、selector/test-facing scope hardening、`taskWindowRoutingFocused`、desktop/mobile smoke、既存 PSD focused paths、guard pass が記録済みである。Wave54 final / Domain J は未完了である。
- Wave54 A-H 後も、full visual redesign、full panel migration、最終的な Diagnostics / Evidence View または Codex / Automation View、Mesh / Atlas / Parameter Manager / Variant UI は未完了である。PSD Import Taskは大きめのmodalを目標UXとする。legacy support panels には旧 evidence/debug/Codex-heavy UI が残る。
- Texture Atlasは専用Task画面として扱う。最低限はvisible drawableをpadding付きで決定的に自動配置し、layout previewをApplyしてからViewer / Runtime確認へ進む。
- Parts Treeはpart / drawable hierarchy、drawable list、draw order、row操作、manual drawable create入口を扱う。`UX-FEAT-010` のdrawable list / layer orderはParts Treeを主ホームにする。
- Parts Tree / Inspector v0では、Part ContainerとDrawableの基本UXを分ける。Part Container Inspectorはnameとvisibility gateを扱い、子Drawable個別のvisibilityを破壊しない。Drawable Inspectorはname、visibility、opacity、clipping / maskを扱う。Parts Treeはファイルツリーではなく描画順つきの階層スタックとして扱い、同じ親配下のPart ContainerとDrawableは混在ordered children listとして表示する。Tree順 = Draw Orderであり、Part Containerは配下Drawable群を持つ描画順ブロックとして順序に参加する。DnDは所属Container変更だけでなく、前 / 後 / 中 dropによるreorder / reparentを扱う。子要素数サマリ、subtree一括表示 / 非表示、container opacity、右クリックmenu、search / filterは初期UXに含めない。
- Mesh Toolは単一Drawable中心のpreset-based initial mesh generationを扱う。Container選択中は配下Drawable pickerを出し、Container自体や配下一括にはmeshを作らない。画面側はpreset選択、preview -> Apply、Regenerate、fallback表示を扱い、詳細な生成アルゴリズムは [../mesh-generation/](../mesh-generation/_map.md) に分離する。Wave63の `auto-outline-v2` は自然なtriangular meshへかなり近づいたが、Large Motionでも細かすぎる印象と外周の輪郭追従過多が残るため、次候補は外側包絡線で包む [../mesh-generation/auto-outline-v3-envelope.md](../mesh-generation/auto-outline-v3-envelope.md) とする。手動頂点編集、辺/頂点追加削除、詳細分割数UI、高度品質調整、一括生成は当面扱わない。
- PSD hidden groupはPart Containerのeditor-only hidden gateへ写す。`@webtoon/psd` v0.4.0 のpublic APIはGroup hiddenを公開していないため、当面はPSD Import adapter内に閉じたprivate shape shimで `layerFrame.layerProperties.hidden` を読む方針を [screens/psd-import-task.md](screens/psd-import-task.md) に記録済み。
- Dynamicsは専用TaskではなくAuthoring Workspace上のActive Toolとして扱う。Inspectorでgroup / binding / coefficientを編集し、常設の大きなSimulation Controlsは置かず、本格確認はViewer / Runtime Viewへ委譲する。
- Drawable Inspectorは選択中drawableの基本属性を扱う。Draw OrderはParts Tree上で上にあるdrawableほど前面、VisibilityはEditor visibilityとRuntime visibilityを分け、OpacityとClipping / MaskはDrawable Inspector内sectionとして扱う。
- `UX-FEAT-020` / `UX-FEAT-021` は当面Drawable Inspector内のClipping / Mask sectionとSingle Drawable Opacity Keyform sectionで扱い、専用Composition / Opacity Toolは初期画面設計では作らない。
- rig control / deformer配下の要素をparameter値でまとめてfadeさせる場合は、単体drawable opacityではなくRig ToolのSubtree Visibility / Opacity effectとして扱う。
- Rig ToolのWarp Deformerは、別primitiveとしてBezier Warpを作るのではなく、Warp Deformer自身がTransform divisionsとBezier divisionsを持つ構造として扱う。Deformer TreeはParts Treeとは別のbinding viewであり、折りたたみ可能かつ初期collapsedのDrawable Poolから未バインドDrawableを既存DeformerへDnDする。Drawable選択時はRotation Deformer / Warp Deformerの作成入口を出し、既存Deformer配下のDrawableにCreateする場合は親DeformerとDrawableの間に新Deformerを挿入する。詳細は [components/rig-tool.md](components/rig-tool.md)。
- Parameter ManagerはPreset parameterとCustom parameterを区別して管理する専用画面である。Preset parameterは初期状態からTableに全て表示し、個別にFrom Presetで追加するUXは置かない。Groupは左ペインではなく上部label filterで扱い、中央Parameter Tableと右Parameter Detailsを主構成にする。TableにはRole列を出さず、Name / Kind / Range / Usedを主表示にする。Preset parameterはrole / group / range / sign conventionをlockし削除不可、Custom parameterはroleなしで作成・編集・削除可能とする。Usageはsummary + details、warning/errorはCheck Stripで扱う。上位設計は [../parameter-preset-ecosystem.md](../parameter-preset-ecosystem.md)。
- Parameter / Keyform authoringでは、Parameter Barは1つのactive parameterを横長1行で操作し、Keyform専用Inspectorは作らない。選択中Drawable / Deformer / Tool Inspectorをparameter-awareにし、current valueに対するAdd / Update / Delete、Ends、Ends + Centerを扱う。keyform位置以外では補間値を表示しつつproperty編集をlockし、`Add Keyform Here` だけを許可する。
- v0のkeyform対象は、Drawable opacity、Warp Deformer lattice / opacity multiplier、Rotation Deformer angle / opacity multiplierに絞る。Parts Container、Mesh、Parameter definition自体、visibility、clipping、draw order、mesh topologyはkeyform対象にしない。
- Variant / Expression Managerは表情差分、パーツ差分、衣装差分のstate setを専用画面で管理する。初期はexclusive setを基本とし、同時適用 / additive setは将来候補として扱う。
- Viewer / Runtime Viewはmodalではなく、Toolbox / App Barから開く専用画面として扱う。編集overlayを出さず、runtime表示、parameter override、warning / diff summaryを確認する。
- 人間向けUI、debug/evidence表示、Codex-facing surface、test-facing surfaceを分離する必要がある。
- `UX-FEAT-001`〜`UX-FEAT-037` の機能IDを、今後の画面仕様議論の参照軸として使う。

## 次の作業候補

1. Wave57後に、UI verification / browser check strategyを議論してから、validation拡張またはfeature workを増やす。
2. Wave58のPSD Import E2E v0 baselineを前提に、Mesh、Rig、Atlas、Parameter、Variant / Expression、Dynamics、Viewerを新GUIのplaceholder導線から順に実装対象へ昇格する。
3. Diagnostics / Evidence View と Codex / Automation View は、旧GUI再利用ではなく新GUI方針で必要になった時点で再設計する。

## 未決事項

- Toolboxの最終配置は、Wave53 v0 では左側配置で実装済みで、Wave54 A-H では PSD Import / Diagnostics / Codex の task-window route が接続済みだが、final visual / accessibility polish としては未確定。
- Tool起動時の最終表現は、Wave54 A-H の workspace-scoped task window v0 を前提にしつつ、modal、task window、side panel、dedicated viewのどれを各tool/viewの基本にするか。
- PSD Import taskは、目標UXとしてはAuthoring Workspace上の大きめのmodalで開く。全task/view共通の最終policyは、PSD Import以外については未決。
- Product PreflightとCodex/Automationの通常UI上の位置付け。
- 通常UIから外したevidence情報を、どの構造化surfaceに残すか。
- `check:testids:fixtures` を標準 quality gate または CI-only guard path に広げるか。
