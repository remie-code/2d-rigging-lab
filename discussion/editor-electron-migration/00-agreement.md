# 合意: apps/editor の Web → Electron 移行

> 本トピックの why と スコープの確定記録。how(分解・設計)は [01-decomposition.md](01-decomposition.md) 以降。
> 情報分離(_conventions.md §6): 以下の「背景」「確定した設計判断」はユーザー合意に基づく**設計判断**、根拠となる**リポジトリ事実**は 01-decomposition.md に集約する。

## 背景(なぜ今 editor は Web なのか)

- 本プロジェクトの目的は「LLM に 2D リギングそのものを実施させる」こと。Cubism はバイナリ保存 + LLM フレンドリーな API 無しのため、LLM が扱える土台を一から構築した。それが apps/editor。
- **技術スタックに Web が選ばれた当初の理由 = LLM アクセシビリティ**(Playwright で叩ける / スクリーンショットで視認できる、という読み)。
- だが実装は別経路へ結実した: **LLM の実行経路は apps/authoring-host(ブラウザレスの JSON コマンド CLI + `render-software` の CPU 描画で視認)**が担う。→ apps/editor の Web 性は、LLM に対しては用をなさず、**人間用 GUI としてのみ機能**している。
- ワークスペース(ローカルディレクトリ)保存を導入した時点で、責務(ローカル FS 所有)に対し Electron へ移るべきだった(apps/runtime-player は既に Electron)。だが当時は制作作業を優先し、移行コストを意図的に繰り延べた。
- 制作が一段落した(Fable/Opus によるリギング再現性検証まで到達)ため、繰り延べた負債を払う。

## 確定した設計判断(why)

| 論点 | 判断 |
|---|---|
| LLM の editor GUI 駆動 | **構想なし(確実)**。LLM 経路は CLI(authoring-host)で必要十分。→ Electron 殻に `_electron` 駆動性の制約は乗せない(※ E2E テストの `_electron` 移設は別問題。decomposition WS4) |
| GUI の位置づけ | 人間が LLM の作業結果を閲覧・微調整するインターフェース。**豪華さは温存**(削減は別議題) |
| Web ターゲット | **廃棄**(不要かつ不適切) |
| 保存形式 | **温存**。応急処置から「LLM-Readable であること」に価値が昇格済み |
| 移行のスコープ | **殻(host)と永続化機構のみ差し替え**。React UI・保存形式・共通コアパッケージは温存 |
| 下敷き | apps/runtime-player の Electron 構成(main/preload/renderer + 型付き IPC + electron-builder)を鏡写し |

## スコープ境界

- **In**: Electron 殻の新設、永続化の node:fs/IPC 化、Web ターゲット廃棄、E2E の `_electron` 移設。
- **Out(別議題)**: GUI の豪華さ削減、GUI の LLM 駆動化、保存形式そのものの再設計。
- **触らない**: apps/authoring-host(LLM の CLI 経路)。
