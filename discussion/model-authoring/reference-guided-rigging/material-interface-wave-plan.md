# 素材追加・置換インターフェース実装計画

2026-09-26。ユーザーがwave構成・責務分離・レビュー方針を了承し「計画を書いて起動」を指示。以下の範囲で開始する。基準HEAD a6bfc0429e642cd4c047f154d834cbd3c26ca72c。既存dirty変更は保持する。

## Basisと範囲

- material-authoring-interface.md：合意した用途・AI向けCLI＋画像比較・保存後Editor再読込。
- material-ingestion-research.md：静的な実装調査。旧rig自動保全拡張の提案部分は後続合意で対象外。
- 作業repo: C:/workspace/remie/code/ai-native-live2d-editor。
- 実素材作業: C:/workspace/remie/rigging/second-rigging-6-sol。旧Astra rigの成果は参照禁止。
- 新規追加とパーツ置換の両方を扱う。新画像の範囲増加は許容するが、旧メッシュ/キーの自動移行は作らない。
- Editorの未保存sessionへの即時反映、生成サービスの組込み、自動造形、首専用補正は対象外。
- ツール開発と技術レビューは委譲。生成・対応点・配置・変形の美的判断、実素材への適用はrootが担う。

## Accepted User Gate

### あなたが受け取るもの／行うこと
AI向けコマンド、同位置で切り替えられる比較画像、保存後Editorで再読込できる編集可能なモデルを受け取る。rootが素材取得、候補登録、位置・スケール調整、追加または置換、再rigging、結果の反映／破棄を使い、制作結果を提示する。

### あなたが判断すること
この入口で不足素材を補い、画像を見ながら制作を続けられるか。提示された造形結果の違和感や不足を判断する。

### あなたが判断しないこと
内部schema、画像bytes、参照整合性、コードやテストの正しさをユーザーに判定させない。それらは独立した技術レビューの責務。

### 合格条件
合意した制作の往復を利用でき、比較結果と保存後のモデルを見て次の制作へ進めるとユーザーが判断する。技術PASSをこの判断の代行にしない。

### 違和感や不足があった場合のフィードバック
画像のどこが不自然か、何を比較・調整できないかをrootへ返す。rootが造形・素材・配置・ツール機能を切り分ける。担当agentはこのGateを変更せず、不足をrootへ報告する。

## 共通契約（意味を固定、DTO綴りは準備担当が具体化）

1. 座標: 生成画像のpixel-edge座標（ピクセル中心はi+.5,j+.5）とrestモデルのstage座標を区別。明示変換は xStage=s*xPixel+tx, yStage=s*yPixel+ty、s>0。同じ単位/向きと仮定せず既存stage規約を調査し変換に反映。初回の自動対応点fitは正の等方scale＋translation。回転/非等方/透視fitは追加しない。
2. 新素材の画像全体を旧bboxへ押し込まない。透明余白を含むpixel位置とcontent矩形の関係を保持し、透明余白が違っても指定した点の位置を再現する。任意座標の精度は数値で返し、自然さの判定には使わない。
3. 取得: 元のパーツtextureを透過PNGで取り出し、固定stage viewportの周囲合成画像、画像↔stage写像、Drawable/mesh/Part/rig/mask/variantの関連情報を返す。合成のcropだけを素材原本として返さない。
4. 候補: 永続candidateId、base package identity/revisionと内容fingerprint、元画像hash、RGBAの寸法/alpha/content情報、rest姿勢、配置、追加/置換のintentを保存。PNG decoder/bytes登録はhost側で扱い、coreへfs依存を持ち込まない。
5. 置換: 論理Drawable IDと対象外への構造参照は維持する方針。新素材は生成由来を別記録しsource/layer mappingを整合更新。対象meshは再生成できる状態へ作り直し、旧topologyに依存する対象直属のgeometry keyformは作業候補上で明示的にリセットする。旧textureは共有先へ影響させない。名前・Part位置・描画順・visibility・mask・variant所属は必要な参照を維持する。既存deformerは黙って削除/改変しない。
6. 変形の作り直し: 候補は通常のモデルpackageとして既存のmesh/rig操作の対象になる。保持/リセットされる対象と共有関係を返す。明示した対象専用制御の再編集はできるが、他Drawableが共有するcontrol/key/parameterの一括削除は拒否して影響対象を報告する。自動的に新しい自然なrigを算出しない。
7. 新規追加: 配置、Part、前後の挿入位置、必要なdeformer/mask/visibilityを明示。親Partと運動所属を混同しない。IDは衝突しない。alphaを持つ新領域が新meshで描画できること。
8. プレビュー: Aの配置候補は新素材のalpha全域を既存積層順へ仮合成し、旧対象meshでclipしない。Bの作業候補は実メッシュ/rig評価で描画。この2種類を出力に明記。同じviewportと倍率で旧/候補を切替可能にする。
9. 反映: candidateの作業packageとbaseを区別。保存済みbaseに版/内容変更があればstaleとして拒否し候補を残す。失敗/破棄で元packageへ部分更新を残さない。承認済みcandidateだけを明示操作で反映。OS障害まで含む原子性を未検証で主張しない。
10. API出力: 操作ID/candidateId、対象モデル版、変更対象、返した画像の絶対パスと座標sidecar、状態、機械可読診断を返す。呼出側が失敗/未完了を成功と誤認しない。

上記の意味を変える必要が出た場合はrootへ報告。綴り、schemaの置場、既存型の再利用、decoder選定、test runner選定は既存repo規約を踏まえた技術裁量とし、completionへ記載する。

## 準備：共有型と所有境界の固定

Orch-Contractが必要箇所だけ棚卸しし、別Gnomeに共有DTO/validator・最小fixtureの実装を委譲、別Reviewに独立確認を委譲する。業務実装はまだ作らない。rootへA/B/Cの正確なfile/module所有一覧、schema/export入口、コマンド案、基盤テスト方法を返す。A/Bが依存する共有型を先に確定するための前段であり、業務実装は以下の2wave。

## Wave 1（準備完了後、A/Bを並列）

### A: 素材取得・候補・位置合わせ

所有責務: source texture/context取得、PNG→RGBA、候補の永続化、明示変換と対応点fit、配置プレビューのartifact。host I/Oの専用module、独立tests、domain docs。共通public registryは勝手に触らずCへ統合依頼。

入力: 契約、既存packageのread-only snapshot、画像ファイル、配置指定。
出力: 正規化済みdescriptor+bytes+候補、同位置比較用の画像/sidecar。

最小検証: resolution/透明余白が異なる同じ図形の対応点一致、等方scale+translation、非有限/退化対応点の診断、alpha境界、候補保存復元、元package不変、旧meshより広い新alphaの配置表示。

### B: モデル追加・置換・再構築

所有責務: normalized inputからcandidate session/packageを作るcore処理、source mapping/texture/binary refs/Drawable/mesh/order/mask/rig/variantsの整合。Aのdecoderや永続storeに依存せず契約fixtureで検証する。BはAの成果待ちを作らない。

最小検証: 新規追加、同領域置換、大きな画像へ置換して再mesh/再rig可能、既存source mismatch解消、対象直属geometry keysの明示リセット、他パーツと共有texture/rig参照保全、故障注入時に入力session不変。参照整合をvalidatorを緩めて通さない。

Wave 1技術受領: A/Bそれぞれ独立Review PASS、最終source版とevidence整合、契約互換。ユーザーの自然さ合格とは別。ここでユーザーへ未接続部品の合否を求めない。

## Wave 2（Wave 1のroot受領後）

### C: AIコマンド・比較・保存の統合

所有責務: ai-interface/host CLIの公開登録、A/B接続、candidate作業packageへ通常rigコマンドを通す導線、明示apply/discard、stale保護、CLIドキュメント、同位置切替viewer、保存再読込の統合検証。共通registryの更新はCが一元所有。必要な既存Editor修正は保存モデル互換に限定し、live session bridgeや新GUI編集画面を増やさない。

一連のシナリオ:
- 取得→PNG候補→異なるscale/余白の配置調整→旧/新比較→candidateで置換→mesh生成/既存rigコマンドによる再編集→比較→apply→Editor再読込。
- 新規追加→配置/order/rig bind→保存再読込。
- discard、失敗時元model不変、base更新後apply拒否。

内部レビューはsource/API・session/disk境界・本物のrenderer出力・保存再読込を扱う。atlasは変更後staleを正しく扱い、古いcacheを正しいと偽装しない。runtime exportの新UXは追加しない。

rootは実素材を使い、素材選択・対応点・位置合わせ・再riggingを自分で行う。既存試作の首を無断で再度造形したり、agentが不足判断を代行したりしない。実素材適用は元作業を保存した候補で行う。

## オーケストレーションとレビュー

root → domainごとのOrch-Sylph → Gnome（code/test）＋Review-Sylph（別context）。Orch自身は実装しない。全委譲でUser Gate全文とこのplanを継承する。subagent-call宣言必須。他者変更を戻さず、所有外の共有ファイル変更はrootへ報告する。

Review粒度はファイル単位でなく操作責務: A=画像と座標、B=一回のモデル変更、C=制作往復全体。Reviewは説明だけでなく実diff/対象コードと独立実行evidenceを見る。実browserが使えない場合は未検証と記し、rootの確認は別証拠として扱う。

修正は最大5loop。非収束や仕様判断はrootへ。wait timeoutで子を中断しない。domain完成前にrootが代替実装しない。rootは計画、受領、契約変更、ユーザー判断と実素材の造形を持つ。

技術報告とUser Gateを分離。自然さの判定を数値/testsへ置換しない。

## 永続成果物と状態

各domain completion: reference-guided-rigging/experiments/material-interface-{contract,wave-1-a,wave-1-b,wave-2}-completion.md。
各独立review: discussion/implementation/reviews/reference-guided-rigging/material-interface-{contract,wave-1-a,wave-1-b,wave-2}.md。
rootが地図登録を担当。source hash/commitまたは対象版、試験command/result、残課題、技術裁量、browser状況を記録する。

現在: 計画保存済み、準備Orch起動予定。Wave 1 A/B・Wave 2未起動。
起動記録: /root/material_contract をOrch-Sylphとして起動。共有型・限定調査・独立技術レビューを進行。Wave 1 A/Bはその契約を受領してから起動する。

## 準備受領・Wave 1起動（2026-09-26）

rootが共通契約、completion、独立Reviewを読んで準備成果を受領。独立Review PASS Loop 3、27 tests/typecheck/deps/contracts限定source guard PASS。全体source guardのruntime-player physiology/index.ts既存違反は未解消であり全体PASSとはしない。素材契約の受領を阻む指摘はない。

Wave 1 A (/root/material_wave1_a) と B (/root/material_wave1_b) を並列起動。共通契約 material-interface-contract.md §7のfile ownershipを継承し、public registryはC所有。各OrchがGnome/Reviewを分離する。Wave 2は両domainの受領後。実素材/User Gateは未実施。
## Wave 1受領・Wave 2起動（2026-09-26）

rootがA/Bのcompletionと独立Reviewを確認し、両domainの技術PASSを受領した。AはLoop 2、56 testsとhost/root型検査・deps・担当source guard成功。Bは正式Loop 1、関連試験を含む101 testsと型検査・deps・担当source guard成功。全repo source guardの既存runtime-player physiology/index.ts違反は未解消。A/Bは技術fixtureでの検証であり、制作往復全体・実素材・User Gateは未実施。

/root/material_wave2 をCのOrch-Sylphとして起動した。別Gnome実装・別Review-Sylphの分離、契約§7 C所有、Accepted User Gate全文を継承。AIコマンド、候補への通常mesh/rig操作、同位置比較、approve/apply/discard/stale、保存再読込を統合する。

Cへ特に引き継いだ条件: same-revision approve/discardを含む操作間排他と状態再確認、保存snapshotとbyte-exact fingerprintの一致、全candidate編集でのB guardと承認失効、既存共有参照保護。controlはcreate→bind→edit、parameterはcreate→target keyform関連付け→editを対応範囲とし、未所属要素の編集を保証しない。OS障害原子性・未実施のbrowser/Editor確認を技術PASSに含めない。実素材の選択・生成・配置・再riggingとユーザー提示はroot責務。
## Wave 2受領（2026-09-26）

rootがwait_agentでOrchの完了まで待機し、material-interface-wave-2-completion.mdと独立Reviewを読んで受領した。正式Loop 1の技術PASSはheadless統合・保存互換の範囲。公開10コマンドによる取得・登録・配置・比較・build・候補編集・承認・反映・破棄とstale拒否を接続。独立host32＋AI interface124＝156 tests、型検査、依存境界、担当source guardがPASS。対象24fileの確定hash一致を担当間で確認済み。rootはsource/testsや大規模差分へ入らず、実装/独立レビューの分離を維持した。

add/replace双方の実rendererと通常保存再読込に加え、Editor本体storage readerでも版・bytes・候補rig保持を確認。ただしEditor UIのOpen Workspace・canvas操作はComputer Use app approval timed outにより未実施。比較viewerの実クリックも未検証。Editor build/専用起動成功やstorage readerの検証をUI合格に読み替えない。専用Editorプロセスはレビュー担当が終了済み。

残件: 比較viewer実操作、Editor画面上の再読込、root自身による実素材選択/生成/位置合わせ/再riggingとUser Gate。実素材・既存rig・8769 previewは変更していない。技術実装の受領を最終的な制作合格とは扱わない。既存所有外physiology/index.tsによる全repo source guard失敗は残る。OS crash原子性/放置lock回収は保証していない。