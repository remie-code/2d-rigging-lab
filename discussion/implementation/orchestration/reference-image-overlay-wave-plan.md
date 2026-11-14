# 参照画像を基準にモデルを編集する — 2 Wave計画

2026-11-12。ユーザーがcontext-checkとWave構成を了承し、「オーケストレーション以下は6.1 sol」「計画を書いて起動」と指示した。参照画像の表示・位置合わせ・保持をEditorとAuthoring Hostへ追加する。先行する笑み試作の再造形は、この作業面の確認後に続ける。

## 1. 目的と合意

参照の印象を記憶して汎用変形を作る手順から、参照の線とモデルの描画を同じ場所で見比べて編集する往復へ進む。今回は参照の自動位置合わせ、輪郭抽出、自動変形ではない。Editorの人間操作と、エージェントのHost/API操作が同じ参照設定を使えることが目的。

- 参照はモデル座標へ配置する。一様な拡縮、平行移動、回転で位置を合わせ、参照の形そのものは歪めない。
- **指定した基準点を、拡縮と回転の共通の中心にする。基準点を置き直すだけでは画像を動かさない。** 旧案の「対角の隅固定」「画像中心回転」は、この方式へ更新済み。
- モデルのみ／参照のみ／重ね合わせの表示。参照のopacityは0〜100%。モデルのopacityや既存keyformを変更しない。非表示にしても設定したopacityを保持する。
- 位置合わせモードでのみ参照を移動・拡縮・回転できる。終了後は参照を固定し、モデルの制御点を編集できる。Canvasのパン・ズームは参照とモデルの対応を保つ。
- 画像と配置を制作資料として保存・復元する。Runtime Exportのdrawable/atlasへ混入させない。編集用状態を追加することによるmodel revisionや既存digestへの影響はbasisで明示し、意味のない形状変更として扱わない。
- 初回は一枚の参照を登録・差替え・除去して使う経路を閉じる。複数参照の管理、姿勢と参照の自動対応、2Dキー編集GUIの新設は範囲外。
- HostとEditorのモデル版・パラメータ値を揃えて比較する。Editorの未保存状態を通常Host CLIが自動共有すると扱わない。
- 使用できたかと、笑顔が美しくなったかは別。今回の機能確認は片目の一か所を編集して同じ参照へ戻る往復。笑み全体の完成・製品接続は次段階。

## 2. Accepted User Gate

会話で了承された体験と判断を、委譲時にも保持するため以下へ整理する。内部テストの合格を本人の使い心地・造形の合格へ置き換えない。

### あなたが受け取るもの／行うこと

- 既存Editorでモデルworkspaceを開き、中央Canvasの `Reference Image` から参照画像を選べる。
- `Adjust Reference` で参照を位置合わせし、基準点を指定して拡縮・回転できる。opacityと単独/重ね合わせ表示を使い、形のずれを見られる。
- 位置合わせを終えた参照を固定したまま、既存のRig/keyform編集を行える。パン・ズームや保存再開後も対応位置を保てる。
- エージェントが同じ参照設定をHostで使い、片目の一か所を直した参照／変更前／変更後の比較を受け取れる。参照用画面と操作手順も受け取れる。

### あなたが判断すること

- 参照の配置・基準点・拡縮・回転・透明度が、形を合わせる作業として理解しやすいか。
- 参照へ戻って比較しながら編集でき、目標へ近づける作業面になっているか。
- 違和感があれば、操作感または提示した見え方のどちらにあるかを伝える。

### あなたが判断しないこと

- 保存形式、API内部、描画座標の計算やテスト網羅性の正しさ。これらは実装・独立レビュー側の責務。
- この機能の受領だけをもって、笑み全体の造形や完成モーションを合格とすること。

### 合格条件

- 同じ参照を固定した基準として、Editorとエージェントの作業で比較・編集の往復ができる。
- 拡縮・回転で意図した基準点がずれず、参照の操作とモデル編集を混同せず扱える。
- 実際の比較結果と操作を見て、ユーザーがこの作業面で進められると判断する。

### 違和感や不足があった場合のフィードバック

- ずれる、何を動かしているか分かりにくい、線を見分けにくい、編集後に同じ比較へ戻れない等をrootへ返す。
- 造形の印象が違う場合は、参照機能の不具合と制作判断の不足を切り分けて相談する。

## 3. 現行事実と確認点

限定棚卸しの根拠:

- Editor配置: `apps/editor/src/workspace/authoring-workspace.tsx`、`app-bar.tsx`、`panels/canvas-preview-panel.tsx`。
- Host: `apps/authoring-host/src/run-authoring-host-command.ts`、`perception/render-view-sidecar.ts`、`packages/ai-interface/src/ai-render-view-command.ts`。
- 座標: Canvas `canvas/canvas-renderer.ts`、Host `packages/render-software/src/view/view-transform.ts`。
- Editor-only保存の前例: `packages/authoring-core/src/package-document-editor-state.ts`。現実に保存されるフィールドと型だけの宣言を混同しない。
- モデル保存からHostが再読込する経路と、未保存AuthoringSessionを直接描く経路がある。後者だけでCLI利用まで成功したと言わない。
- 外部PNGの参照レイヤー、共通設定、画像登録/再読込とHost参照表示契約は未実装。
- 既知の懸念: 既存1D replaceとr815追加Grid2D additiveがともにorder0。Canvasは同順位ID順、snapshotはbinding順で、描画が異なる可能性。GUI再現未確認。これは参照表示と独立した評価整合の確認項目である。
- 人の既存キー編集GUIは1D。既存キー位置でwarp点を操作し、新規なら `Add keyform at current value`。2DをGUIから編集できるとは案内しない。
- 先行のモデル試作と参照は [笑みの議論](../../ai-cohost/concept/shared-laughter-expression.md)。参照入力は `discussion/ai-cohost/concept/shared-laughter-expression/laugh-relaxed-v2.png`。
- モデル基点は外部 `C:/workspace/remie/rigging/astra-chan/workspace`、7ac9841/r804上の未commit r815試作。現用Exportはr804のまま。検証にはrepo内のコピーを用い、外部source/現用exportを変更しない。

## 4. Wave 1 — 共通の参照状態・保存・Host描画

一人のOrch-Sylphが契約と実装順序を管理する。

1. packageの制作補助情報として画像・表示状態・一様変換・基準点を扱う共通契約を定める。原画像の縦横比とalphaを保持する。既存workspaceは参照なしのまま開ける。
2. 登録・差替え・除去・表示/opacity/配置/基準点の更新をHost/APIから操作でき、保存・再読込できる経路を通す。画像は元の外部パスが後で消えても制作を再開できるようworkspace内に保持する。既存のバイナリ/文書境界を尊重する。
3. 基準点を変えても描画位置が変わらず、拡縮/回転時にはその基準点のモデル座標を保持する共通演算を作る。既定基準点等の小さな技術・UI初期値はbasisへ明記。
4. Host `renderView` でモデル単独・参照単独・overlayを固定viewport/parametersで出せる。参照はモデル座標から描画へ同じ変換を受ける。sidecar等で比較に使ったモデル/parameter/参照状態を復元できる範囲を示す。
5. 参照操作の保存と既存モデル/Exportの非干渉、失敗時に既存参照を壊さないこと、欠落/不正画像の分かる応答を検証する。フル外部素材管理への拡大はしない。
6. 実PNG・非中心pivot・複数viewportで、登録→位置合わせ→保存再開→モデル操作→再描画を実Hostから確認する。shape編集は検証用workspaceコピーに限定。
7. 独立レビュー後、Wave 2へ共有契約と利用例を渡す。必要な設計判断・検証結果をwave basis/completionに保存する。

Wave 1 internal gate: 参照が保存され、実Hostから同じ比較を再現でき、pivotとopacityの契約・非干渉が実物で確認できる。独立レビュー合格。

## 5. Wave 2 — Editor操作と制作の往復

Wave 1受領後に起動する。

1. 中央 `Canvas / Preview` toolbarのGrid/Deformer overlay付近に `Reference Image` の入口を置く。既存Import PSDと混同しない。常設大型パネルや別画面を増やさず、画像選択/差替え/除去、表示モード、opacity、位置合わせへの入口を設ける。
2. `Adjust Reference` 中だけ移動・一様拡縮・回転の枠/handleと基準点指定を有効にする。基準点の配置は画像の見た目を動かさない。数値による倍率/角度等の微調整も可能にする。完了後の参照は固定し、クリック/ドラッグは既存Rig編集へ戻す。pan/zoomは両モードで従来操作を維持する。
3. 参照操作とモデル編集の状態を明示し、既存選択/Undo/Redo/Saveとの整合を実UIで確認する。参照設定はWave 1と共通の表現/演算を使い、EditorとHostに二重の意味を作らない。
4. 保存した参照をHostで再読込し、同じモデル/parameter/viewportで比較する。未保存モデルと保存済みモデルの違いを隠さない。完全な未保存セッション自動同期は今回導入しない。
5. 既知Grid2D順序差を限定fixture/実描画で確認。再現した場合、同じモデルの比較に必要な最小の整合修正を独立レビューする。大きな評価規約変更・互換性判断が必要ならrootへescalateし、参照機能へ紛れ込ませない。
6. 実Electron Editorで参照選択→pivot拡縮/回転→opacity→固定→既存1D warp点編集→Undo/保存再開を確認する。Hostでも同じ参照を使って片目一か所の変更前後を示す。頭全体bboxだけで合わせた画像を「目標の線へ合った証拠」にしない。必要なら制作判断をrootへ渡す。
7. 利用可能なEditor/Hostの起動入口と操作手順を用意する。既存のEditor配布・開発起動方針を調べ、ユーザーが実際に開ける候補を渡す。無関係なRuntime Player exeは再配布しない。
8. 独立レビュー後、ユーザーに画面と操作手順、参照/変更前/変更後の比較を渡す。機能の人間ゲートと後続の笑み造形を分ける。

Wave 2 internal gate: 人のEditor操作とHost操作の両方で共通参照を使える。実UI/保存復帰/Host描画を確認し、独立レビュー合格。ユーザーの体験評価は別。

## 6. 検証とオーケストレーション

- 各WaveのOrch / Gnome / 独立Review-Sylphは **GPT-6.1 Sol（gpt-6.1-sol、fork none）**。
- 1 Waveにつき独立Reviewer一人の簡易構成。契約・座標・保存・表示・試験を横断する。spec/design/test三系統に機械的に増やさない。最大5修正巡。
- 実装はGnome、レビューは別コンテキストのSylph。Orch自身はsource実装をしない。rootは計画・受領・ユーザー判断を保持し、大きなsource読取や実装へ潜らない。
- 全委譲に `[subagent-call] 呼び出し元: ...` と次の必須文を含める:
  **Orch-Sylph自身は実装担当ではない。source implementation は必ず別コンテキストの Gnome に委譲し、レビューは必ず別コンテキストの Review-Sylph に委譲すること。これを分離できない場合は実装せず escalate / blocked として報告すること。**
- User Gate節を後続へそのまま渡す。内部test/reviewは候補を渡せるための別基準。自然さや美しさの本人判断を代行しない。
- 実画像の表示結果と変換値を同じ条件で照合する。対角/非中心pivot、拡縮+回転+pan/zoom、opacity0/1/中間、元alpha、表示切替、画像差替え/除去/保存再開を重点確認。コードをなぞるだけのtestを増やさない。
- required checksは該当規約に沿い実施。基点由来の失敗と新規回帰を区別し、理由のない全体反復はしない。実Electron描画とHost描画は別経路として確認する。
- 通常のGUIで難しい部分を内部APIだけで通し、ユーザー操作も成功したと報告しない。GUI環境の制約は事実として記録する。

## 7. 所有・実行条件

- branch `codex/intent-motion`、大量の先行未commit差分を保持して継続。無断commit/checkout/reset/merge/pushは禁止。他者の編集をrevertしない。
- root所有: 本計画、`discussion/implementation/orchestration/_map.md`、`discussion/implementation/_map.md`、笑み概念文書からの入口。
- Orch所有: `discussion/implementation/waves/reference-image-overlay/` のbasis/completion/contract/human-gateとmap。
- Reviewer所有: `discussion/implementation/reviews/reference-image-overlay/` とmap。
- Gnomeのsource/test/domain docs所有はOrchが具体的に限定する。既存CODEX/AGENTS/規約を確認する。無関係なSoul/Runtimeの先行作業は触らない。
- 外部astra workspace（r815）と現用export（r804）は読取のみ。演技・造形の本番差分を本waveで増やさない。検証用コピーはrepo内の専用tmpに置く。
- ユーザーの実Editor/配信アプリ/OBSを無断終了しない。隔離プロファイル・検証workspaceを使う。Start-ProcessはHidden。ネット/loopback/外部読取等の必要権限は適切なrequire_escalatedを使う。
- pnpm wrapperのEPERMには既存npm/local CLIによる等価実行可。Windows削除は絶対pathが検証用領域内と確かめ、同一shellのLiteralPathで行う。

## 8. 状態

| 項目 | 状態 | 入口 |
|---|---|---|
| Wave 1 | 内部gate合格・root受領 (2026-11-12) | [completion](../waves/reference-image-overlay/wave1-completion.md) / [契約](../waves/reference-image-overlay/wave1-contract.md) |
| Wave 1レビュー | 独立レビュー合格、rootが比較PNGを目視 | [review](../reviews/reference-image-overlay/wave1.md) |
| Wave 2 | 内部gate合格・root受領 (2026-11-12) | [completion](../waves/reference-image-overlay/wave2-completion.md) |
| Wave 2レビュー | 独立レビュー合格。実Electron操作・保存再開・Host共有・最終portable確認済み | [review](../reviews/reference-image-overlay/wave2.md) |
| 制作での比較・本人確認 | 片目一か所の比較と操作手順を用意、本人確認待ち | [human-gate](../waves/reference-image-overlay/human-gate.md) |

### Wave 2の限定確認

既知のGrid2D順序差は、Hostの後段が再整列するため、実r815の笑み値0/.7/1・両目open=1でCanvas/Host最終頂点が浮動小数点誤差の範囲で一致した（最大差5.684341886080802e-14）。独立Reviewerも再現し、この対象について評価順の変更は不要と判断した。一般の全モデルへの保証や、造形の良さの判定ではない。

rootは実Editorの位置合わせ・保存再開・狭幅画面、Hostの参照/編集前後比較、最終portable起動画面を目視した。最終配布候補は `tmp/reference-overlay-wave2/candidate-final/Private 2D Rigging Lab 0.0.0.exe`。途中版 `candidate` と区別する。既存のEditor型診断・diagnosticsテスト、Host guard、Runtime構成チェックの失敗はcompletionに残す。実UIで参照固定の編集往復が通ったことを、笑み造形の合格へ置き換えない。今回の作業は未commit。
