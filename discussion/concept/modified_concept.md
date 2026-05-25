# コンセプト変更メモ: AI-native Live2D Editor から Open Live2D Stack へ

## 1. 背景

当初の構想は、Cubism Editor の取説を参照オラクルとして、Cubism Editor 相当の機能を持つ AI-friendly / AI-native な Live2D Editor を作成することだった。

目的は、Cubism Editor が提供している Live2D モデル制作能力を抽出し、AI エージェントが観測・操作・検証・拡張しやすい Editor として再構築することにあった。

しかし調査の過程で、以下の制約が明確になった。

- `.moc3` は Live2D Cubism のランタイム向け独自バイナリ形式である。
- Cubism SDK/Core は `.moc3` を読み込み、parameter に応じた drawable vertices 等を評価することはできる。
- 一方で、Cubism Editor 上の deformer hierarchy、keyform、authoring state 等を `.moc3` から直接復元することは現実的ではなさそうである。
- 公開 SDK/Core は `.moc3` の読み込み・評価用であり、`.moc3` を生成するための公式エクスポート API ではない。
- 既存の VTube Studio などの周辺ツールは `.moc3` / `.model3.json` / `physics3.json` 等の Cubism runtime asset に強く依存している。
- よって、Cubism Editor のみを置換しても、`.moc3` 出力ができなければ既存 Live2D 周辺エコシステムとの互換は維持できない。
- 逆に、Cubism エコシステムから完全に脱却するなら、Editor だけでなく Runtime、Viewer、VTuber App、SDK、Model Format 等も自作対象になる。

このため、プロジェクトのコンセプトを以下のように変更する。

## 2. 旧コンセプト

旧コンセプトは以下である。

> Cubism Editor 相当の機能を持ち、かつ AI エージェントが操作・検証・拡張しやすい AI-native Live2D Editor を作る。

この時点では、Cubism Editor の置換が主目的であり、VTube Studio などの周辺ツール互換は `.moc3` 出力によって維持する想定だった。

しかし、`.moc3` 互換出力は公開 SDK/Core だけでは現実的な実装対象と見なしにくい。
そのため、Cubism Editor だけを自作しても、既存 Live2D エコシステムからの脱却にはならない。

## 3. 新コンセプト

新コンセプトは以下である。

> Open Live2D Stack を作る。

ここでいう Open Live2D Stack とは、Live2D Cubism が占有している「2Dイラストをパラメータ駆動で可動モデル化し、制作・編集・表示・配信・組み込み利用する」領域を、オープンかつ AI-native な制作・実行基盤として再構築するプロジェクトである。

目的は Cubism Editor 互換ではない。

目的は、Live2D Cubism のプロプライエタリなエコシステムに依存せず、Live2D 的な表現を実現するための制作・実行・配信・組み込みスタックを自作することである。

## 4. 新しいRoot Concept

Open Live2D Stack とは、以下の性質を持つ。

- 静的な2Dイラストを、メッシュ変形可能な可動モデルとして扱える。
- モデルは parameter によって表情・姿勢・身体・髪・衣装・装飾品などを制御できる。
- モデルは独自のオープンな model format として保存・読み込みできる。
- Runtime はその model format を読み込み、parameter 値に応じて描画結果を生成できる。
- Editor はモデルの制作・編集・検証を行える。
- Viewer はモデルの表示、parameter 操作、motion、expression、physics 等の確認を行える。
- VTuber App はトラッキング入力を parameter にマッピングし、配信に利用できる。
- SDK は Web / Native / Game Engine 等への組み込みを可能にする。
- AI エージェントはモデル構造、編集操作、差分、検証結果を構造化情報として扱える。
- 将来的に Open Source として公開可能な権利関係・依存関係・設計境界を持つ。

## 5. スコープ変更

### 5.1 旧スコープ

旧スコープでは主に以下を対象としていた。

- Cubism Editor 相当の Editor
- Cubism Editor 取説からの AC / シナリオ抽出
- `.moc3` 読み込み
- `.moc3` 再出力可能性の検討
- AI-friendly な Editor 操作体系

### 5.2 新スコープ

新スコープでは、Live2D Cubism 周辺エコシステムのうち、以下を作成対象候補とする。

1. Open Model Format
2. Open Editor
3. Open Runtime / Core
4. Open SDK
5. Open Viewer
6. Open VTuber App
9. Open Package Validator
10. Open Marketplace / Registry
11. Open External API
12. Open AI Agent Interface
13. Open Sample Model Set
14. Documentation / Tutorial / AC System

ただし、以下は当面スコープ外とする。

7. Open MotionSync / LipSync
8. Open Video Editor

MotionSync / LipSync および Video Editor は、将来的な拡張対象ではあるが、初期構想・初期AC・初期ユースケースシナリオからは外す。

## 6. 作成対象候補

### 6.1 Open Model Format

Cubism の `.cmo3` / `.moc3` / `.model3.json` 等に相当する、独自のオープンなモデル形式を定義する。

この形式は、少なくとも以下を表現できる必要がある。

- texture
- drawable
- mesh
- vertex
- uv
- triangle index
- part
- draw order
- clipping / mask
- parameter
- keyform
- deformer相当の変形構造
- expression
- physics
- motion
- metadata
- AI向けの構造化情報

重要なのは、モデル形式自体が AI-friendly であること。
すなわち、人間だけでなく AI エージェントが読める、差分を理解できる、編集意図を追跡できる、検証できる形式であること。

### 6.2 Open Editor

Cubism Editor 相当の制作・リギング環境を作成する。

対象機能には以下を含む。

- 画像素材の読み込み
- drawable / mesh 編集
- deformer相当の編集
- parameter / keyform 編集
- 表情編集
- 顔・身体・髪・衣装・装飾品の可動編集
- physics 編集
- motion 編集の基本機能
- model package 保存
- runtime preview
- AI agent による観測・操作・レビュー

ただし、Cubism Editor の UI を模倣することは目的ではない。
目的は、Live2D 的なモデル制作能力を AI-native な形で再構築することである。

### 6.3 Open Runtime / Core

Cubism Core 相当の runtime を作成する。

対象機能には以下を含む。

- Open Model Format の読み込み
- parameter 値の保持
- parameter に応じた vertex 変形評価
- drawable の描画
- texture の適用
- draw order の反映
- clipping / mask の反映
- expression の適用
- physics の評価
- motion の再生
- runtime state の取得
- WebGL 等による表示

Cubism Core と異なり、内部状態や評価結果を AI エージェントが観測できる構造を持つことを重視する。

### 6.4 Open SDK

Open Runtime を外部アプリから利用するための SDK を作成する。

対象候補は以下。

- Web / TypeScript SDK
- Native SDK
- Game Engine plugin
- Unity plugin
- Unreal plugin
- API specification
- sample implementation
- model loading API
- parameter control API
- rendering integration API

初期段階では Web / TypeScript を優先する。
理由は、検証・UI作成・AIエージェントによる操作・ブラウザベースの確認と相性がよいためである。

### 6.5 Open Viewer

Cubism Viewer 相当のモデル確認環境を作成する。

対象機能には以下を含む。

- モデル読み込み
- parameter slider
- expression 確認
- motion 確認
- physics 確認
- draw order / clipping / mask 確認
- texture / drawable 確認
- model package validation
- runtime behavior inspection
- AI向けの検証レポート出力

Editor と統合してもよいが、概念上は Runtime / Model Package の検証環境として独立した役割を持つ。

### 6.6 Open VTuber App

VTube Studio / nizima LIVE 相当の VTuber 配信アプリを作成する。

対象機能には以下を含む。

- Open Model Format の読み込み
- webcam / tracking input の受け取り
- tracking input から model parameter への mapping
- smoothing
- expression hotkey
- model position / scale / rotation
- physics strength
- idle motion
- background transparency
- OBS 向け出力
- 外部API
- plugin 連携
- AI agent による設定補助

Cubism / VTube Studio 互換ではなく、Open Model Format を前提とした配信アプリとして定義する。

### 6.7 Open Package Validator

モデルパッケージの整合性を検証するツールを作成する。

対象機能には以下を含む。

- 必須ファイル存在確認
- texture 参照確認
- model format schema validation
- parameter 定義確認
- drawable / mesh / vertex 整合性確認
- clipping / mask 整合性確認
- expression / motion / physics 参照確認
- runtime load test
- AI-readable validation report 出力

Marketplace や納品ワークフローを作る前に、まず package validation を成立させる。

### 6.8 Open Marketplace / Registry

nizima 相当のモデル流通基盤は、長期的な作成対象候補とする。

ただし初期段階では marketplace 自体は作成しない。
まずは registry / sample catalog / package metadata の整備を優先する。

将来的な対象機能は以下。

- model package 登録
- preview
- license metadata
- author metadata
- version compatibility
- sample model distribution
- package validation integration

### 6.9 Open External API

外部アプリや AI エージェントが Open Live2D Stack を操作するための API を作成する。

対象機能には以下を含む。

- parameter 送受信
- tracking data 送信
- model state 取得
- expression / motion 操作
- editor preview synchronization
- runtime control
- WebSocket / HTTP API
- plugin API
- automation API

これは AI-native operation layer の基盤でもある。

### 6.10 Open AI Agent Interface

AI エージェントがモデル制作・編集・検証を行うための構造化インターフェースを作成する。

対象機能には以下を含む。

- model structure inspection
- operation command
- diff extraction
- validation report
- scenario-based test execution
- AC-based review
- repair suggestion
- editing plan generation
- provenance tracking

これは本プロジェクトの中核的な差別化要素である。
Open Live2D Stack は、単なる Live2D 代替ではなく、AI-native な制作基盤である。

### 6.11 Open Sample Model Set

権利的にクリーンなサンプルモデル群を作成する。

対象には以下を含む。

- 最小サンプルモデル
- mesh deformation sample
- parameter sample
- face sample
- body sample
- physics sample
- expression sample
- motion sample
- VTuber app sample
- validation failure sample

Open Source として公開するためには、公式Live2Dサンプルや既存商用モデルに依存しない独自サンプルが必要になる。

### 6.12 Documentation / Tutorial / AC System

Open Live2D Stack の取説、仕様、AC、ユースケースシナリオ、チュートリアルを整備する。

対象には以下を含む。

- concept document
- AC system
- use case scenario
- model format specification
- editor manual
- runtime manual
- SDK manual
- VTuber app manual
- package validation guide
- AI agent operation guide
- contributor guide

この文書体系は、後続の Undine / Gnome / Sylph が作業するための行動可能な正解として機能しなければならない。

## 7. 当面スコープ外とするもの

### 7.1 Open MotionSync / LipSync

MotionSync / LipSync は重要な周辺機能だが、初期スコープからは外す。

理由は以下。

- Open Model Format / Runtime / Editor / VTuber App の成立後に追加可能である。
- 音声解析、音素推定、口形状 mapping など別領域の複雑性を含む。
- 初期段階で入れると、モデル表現基盤の確立より先に音声処理へスコープが拡散する。

将来的な拡張候補としては保持する。

### 7.2 Open Video Editor

nizima ACTION!! 相当の動画制作エディタも初期スコープからは外す。

理由は以下。

- Timeline / video export / composition / audio sync など、Editor / Runtime とは別系統の大きな機能群を含む。
- VTuber App や Runtime が成立した後に、別アプリとして拡張できる。
- 初期段階では、モデル制作・表示・配信利用の基盤を優先する。

将来的な拡張候補としては保持する。

## 8. 新しいプロジェクト定義

本プロジェクトは、Live2D Cubism の互換実装を目的としない。

本プロジェクトは、Live2D Cubism が提供している表現領域を、オープンかつ AI-native な制作・実行スタックとして再構築することを目的とする。

そのため、Cubism Editor、Cubism Core、Cubism SDK、VTube Studio、nizima LIVE 等は、実装対象の参照オラクルではあるが、互換性のために従属すべき仕様ではない。

本プロジェクトの正は、Open Live2D Stack 自身の AC / 仕様 / シナリオである。

## 9. 変更後の初期方針

初期方針は以下とする。

1. Cubism 取説および既存エコシステムを参照し、Live2D 的表現に必要なユースケースシナリオを抽出する。
2. ただし、`.moc3` 互換出力や Cubism Editor 内部構造復元を初期成功条件に置かない。
3. 最初に Open Model Format と Open Runtime / Viewer の成立を目指す。
4. 次に Open Editor によって制作・編集可能性を確立する。
5. その後、Open VTuber App によって配信利用を成立させる。
6. SDK / External API / AI Agent Interface によって、外部利用と AI-native operation を拡張する。
7. MotionSync / LipSync および Video Editor は当面スコープ外とし、基盤成立後の拡張候補とする。

## 10. 現時点の重要な問い

今後、Undine と検討すべき主要な問いは以下である。

1. Open Live2D Stack における最小モデルとは何か。
2. Open Model Format は、どの概念を第一級要素として持つべきか。
3. Deformer 相当の概念を、Cubism と同じ構造で持つべきか、AI-native な別構造として定義すべきか。
4. Runtime は parameter から vertex をどのように評価すべきか。
5. Editor と Runtime は同じ model format を扱うべきか、authoring format と runtime format を分けるべきか。
6. AI エージェントが観測・操作・検証するために、model format と operation API は何を公開すべきか。
7. 既存 `.moc3` は完全互換対象ではなく、移行元・参照元としてどこまで扱うべきか。
8. Open Source 公開を前提とした場合、権利的にクリーンなサンプルモデルと検証データをどう用意するか。

## 11. コンセプト変更の結論

プロジェクトは、AI-native Live2D Editor 開発から、Open Live2D Stack 開発へ拡張された。

この変更により、作成対象は Editor 単体ではなく、Model Format、Runtime、SDK、Viewer、VTuber App、Package Validator、External API、AI Agent Interface、Sample Model、Documentation を含むエコシステム全体となる。

ただし、MotionSync / LipSync と Video Editor は当面スコープ外とする。

後戻りは小さい。
現時点ではまだユースケースシナリオ抽出段階であり、具体設計には入っていないためである。

むしろ、Cubism Editor のみを対象にしたAC体系を確定する前に、Cubism 周辺エコシステム全体を対象とする Open Live2D Stack へコンセプト変更できたことは、後続設計における大きな手戻りを避ける判断である。
