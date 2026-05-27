# Cubism Runtime Input Layers: Motion / Expression / Physics / Pose

> 調査日: 2026-05-25  
> 対象: Cubism SDK / Cubism Viewer の runtime input layer が model evaluation に与える影響  
> 目的: Open 2D Character Rigging Stack MVP が採用するべき範囲、MVP外に置く範囲、ただし診断可能にすべき範囲を整理する。

---

## 1. Scope

このレポートは、Cubism runtime の評価時に model parameter、part opacity、drawable state へ影響する入力層を整理する。

対象は次である。

- motion
- expression
- physics
- pose
- parameter save / restore
- update ordering
- Viewer で観測できる motion / expression / physics / pose 関連情報

Cubism SDK / Viewer は Open Stack の参考資料であり、Open Stack のオラクルではない。Open Stack MVP は `.moc3` 互換、`.motion3.json` 互換、Cubism SDK/Core 必須依存を要求しない。

---

## 2. Official Facts

### 2.1 Motion

Cubism SDK では、motion playback に `CubismMotion` と `CubismMotionManager` が関わる。`.motion3.json` は `ACubismMotion` 派生の `CubismMotion` として読み込まれ、motion management class は motion の再生、model parameter 更新、motion 終了、user trigger event の受け取りを担う。

Motion の主要設定には、fade-in time、fade-out time、loop playback がある。fade-in / fade-out は秒単位で設定される。`.motion3.json` / `.model3.json` に由来する fade 値には優先順位があり、公式 manual は parameter fade、model3 override、overall motion fade の順で適用すると説明している。指定がない場合の既定 fade は 1 秒である。

Motion manager は新しい motion を開始するとき、既存 motion に fade-out 開始を設定し、新しい motion queue entry を追加する。これにより motion switch を fade 付きで行う。複数 motion が fade 中に並行して存在する場合があり、`StopAllMotions` はそれらをまとめて停止する。

Motion event は、motion 内に設定された Event が再生されたとき、`CubismMotionQueueManager` に登録した callback から受け取る。登録できる callback は 1 つで、複数処理が必要な場合はその callback 内で連鎖させる。

Cubism Viewer の Motion Settings では、fade-in / fade-out、fade override、group name、playback、motion FPS、target SDK type を確認・設定できる。`Idle` group は Viewer の Idle Motion 自動再生と関係する。Viewer の loop playback は Viewer 用設定で、`.model3.json` へ export されない。loop 中 fade-in も `.model3.json` に書き出されず、SDK sample では fade が適用されないと説明されている。

Motion reproducibility について、公式 docs は `.motion3.json` の再現性が SDK target type と SDK version に影響されるケースを説明している。特に旧 Native / Web SDK と `SDK (Others)` target で、強く操作された Bezier handle を含む motion の波形再現が悪化する場合があり、対策として target 変更、SDK上での確認、旧再生方式の再現設定が挙げられている。

出典:

- https://docs.live2d.com/en/cubism-sdk-manual/motion/
- https://docs.live2d.com/en/cubism-editor-manual/motion-setting/
- https://docs.live2d.com/en/cubism-sdk-manual/reproducibility-motion3-json/
- https://docs.live2d.com/en/cubism-editor-manual/load-model-and-motion/

### 2.2 Expression

Cubism SDK の expression motion は、通常 motion に加えて現在状態に対する相対的な表情値を設定する機能である。`CubismExpressionMotion` は `ACubismMotion` 派生で、通常 motion と同様に `CubismMotionManager` で管理できる。ただし通常 motion と同時に使うため、公式 sample は通常 motion 用 manager とは別に expression 用 manager を作成している。

Expression data は `.exp3.json` として扱われる。Cubism Viewer では、Animation View で facial expression 用に export した `.motion3.json` を Expression Motion として読み込み、`.exp3.json` に変換・出力する。Viewer で expression を選択すると、switching fade 値と expression に設定された parameter values を確認できる。fade は一括設定で、個別 parameter ごとの fade 設定ではない。Viewer 上で値を変更しても export しない限り保存されない。

Expression は通常 motion と比較して次の制約を持つ。

- 時間に沿った値変化を持たない。
- parts へ影響できない。
- parameter ごとに計算方式を指定できる。

計算方式は add、multiply、overwrite の 3 種類である。`Add` は未指定時の既定で、`.exp3.json` の値を現在 parameter value に加算する。Viewer export 時には初期値から設定値までの差分が設定される。`Multiply` は現在 parameter value に `.exp3.json` の値を乗算する。後続の add / overwrite には乗算の影響が及ばないため、適用順序に注意が必要である。`Overwrite` は Viewer では設定できないが、`.exp3.json` 側で指定でき、現在値を無視して値を上書きする。

公式 docs は、eye open/close のような blinking と expression の組み合わせでは、multiply が自然に機能しやすい一方、overwrite は blinking を無視しうる例を示している。また、motion、expression、その他 parameter 操作の計算順序が見た目に大きく影響するため、適用順序に注意するよう明示している。

Cubism 5 以降の expression transition では、複数 expression の transition 中にすべての expression 値を計算してから最後に model へ適用する方式へ修正されている。旧方式では、multiply 同士または add 同士の transition でも意図しない値変化が起きる場合があった。公式 docs は multiply と add が混在する expression transition の組み合わせを推奨していない。

出典:

- https://docs.live2d.com/en/cubism-sdk-manual/expression/
- https://docs.live2d.com/en/cubism-sdk-manual/blending-expression/
- https://docs.live2d.com/en/cubism-editor-manual/setting-and-exporting-facial-expressions/

### 2.3 Physics

Cubism physics settings は Editor で作成され、`.physics3.json` として出力される。SDK では `.physics3.json` を `CubismPhysics` に読み込み、`CubismPhysics.evaluate` / `CubismPhysics::Evaluate` によって physics calculation とその結果の model parameter 適用を同時に行う。

`.physics3.json` 内の Gravity / Wind は `CubismPhysics` の options に反映され、API で取得・設定できる。公式 sample の default options は gravity `(0, -1)`、wind `(0, 0)` として示されている。

Cubism Viewer の Physics Information では、`.physics3.json` を選択すると physics FPS、pendulum group summary、pendulum steps、input parameter IDs、output parameter IDs を確認できる。ただし pendulum length、swing influence、reaction time、speed of convergence、input influence / inversion、output pendulum number / influence / inversion / magnification など、細部の一部は Viewer 表示上は省略される。

Physics calculation の結果は FPS に依存する。Cubism 4.2 以降の Editor / OW Viewer / 対応 SDK では、physics file に FPS 情報がある場合、その FPS に基づいて計算する。FPS 情報がない場合、Viewer 表示の frame rate を用いて physics が計算される。公式 docs は、使用アプリ側で physics calculation file の FPS 情報が実際に有効か確認するよう求めている。

出典:

- https://docs.live2d.com/en/cubism-sdk-manual/physics/
- https://docs.live2d.com/en/cubism-editor-manual/check-the-physics/

### 2.4 Pose

Cubism SDK の Pose は、motion に基づいて複数の類似 part のうち 1 つを表示し、切り替えを fade する機能である。右手 A / 右手 B のように同時表示すると破綻する part switching が例として挙げられている。

OW Framework では、motion playback が part opacity を直接操作するのではなく、part と同じ ID の virtual parameter への overwrite に置き換える。model に存在しない parameter ID は virtual parameter として保持される。motion switch 時の fade はここでは行われず、overwrite のみである。

Pose function は model update process の最後の段階で適用される。`.pose3.json` の情報に基づき、virtual parameter の値を参照して group ごとに表示する part を決める。part manipulation curve は Step が推奨される。linear など他の curve type の場合、値が 0.001 を超えたとき表示状態として認識される。

表示 part と新 opacity を決めた後、Pose は group 全体に対して part opacity override を行う。表示されない part の opacity は、背景が透けすぎないように表示 part の opacity と関連付けて下げられる。Pose data は part ID、parameter index、part index、linked parameter を含む構造として保持され、parent ID による opacity link も扱う。

Cubism Viewer の Pose Settings では、JSON形式の pose setting file を作成する。同じ group number に属する複数 part のうち、表示されるのは 1 つだけである。parent ID を設定した part は親 part と同じ switching behavior を持つ。fade time は Viewer で設定でき、既定値は 500 ms である。

出典:

- https://docs.live2d.com/en/cubism-sdk-manual/pose/
- https://docs.live2d.com/en/cubism-editor-manual/pose-setting/

### 2.5 Parameter Save / Restore

Cubism SDK には、現在の model parameter values を一時保存する `SaveParameters` と、保存済み values を復元する `LoadParameters` がある。

公式 `LAppModel::Update` の説明では、Update の冒頭で `LoadParameters` により前回保存状態へ戻し、motion playback を適用し、その後 `SaveParameters` で motion 後の状態を保存する。その後に eye blink、expression、drag input、breath、physics、lip-sync、pose などを適用し、最後に `model.update()` を呼ぶ。

この save / restore の目的は、motion で再生されなかった parameter や motion に指定されていない parameter について、後続の add / multiply 計算の基準を作ることである。これがないと、motion に指定されていない parameter に add を行った場合、update ごとに値が加算され続けて範囲外になりうる。motion playback 後に save することで motion の最後の状態も保持できる。

出典:

- https://docs.live2d.com/en/cubism-sdk-manual/parameters/

### 2.6 Update Ordering

公式 `Parameter Operation` manual は、sample の `LAppModel::Update` として次の順序を示している。

1. delta time と drag state を更新する。
2. `model.loadParameters()` で前回保存値を復元する。
3. motion manager が finished の場合は idle motion を開始し、そうでなければ current motion を `updateMotion` する。
4. `model.saveParameters()` で motion 後の parameter state を保存する。
5. main motion が更新していない場合のみ eye blink を適用する。
6. expression manager を適用する。
7. drag による face / body / eye direction の add を行う。
8. breath を適用する。
9. physics を evaluate する。
10. lip-sync を add する。
11. pose を update する。
12. `model.update()` で parameter を頂点などへ反映する。

また公式 docs は、parameter set / add / multiply は parameter values を書き換えるだけで vertex calculation は行わず、parameter 変更後に `CubismModel.update()` で vertices を計算し、その後 renderer が draw すると説明している。

ただし、この順序は公式 manual と sample に明示された代表的な Framework update であり、すべての application に対する独立した形式仕様としては書かれていない。公式 docs 自身も「motion、expression、functions の計算順序を designer と共有すべき」としており、順序が表現に影響することを強調している。

出典:

- https://docs.live2d.com/en/cubism-sdk-manual/parameters/
- https://docs.live2d.com/en/cubism-sdk-manual/expression/
- https://docs.live2d.com/en/cubism-sdk-manual/pose/

---

## 3. Repository Requirements

### 3.1 MVP AC からの要求

`discussion/acceptance-criteria/03_MVP_Acceptance_Criteria.md` は、Open Stack MVP を「権利的にクリーンな素材から GUI Editor で制作し、Open Model Package として保存し、Runtime / Viewer で表示し、Validator と AI Agent が検証できる」一周として定義している。

Runtime input layers に関係する要求は次である。

- `AC-MVP-008`: parameter、範囲、keyform、補間を制作できること。
- `AC-MVP-009`: warp / rotation 相当 deformer、親子階層、parameter 接続を制作できること。
- `AC-MVP-010`: まばたき、眉、口開閉、顔Z、体、腕、髪揺れ、顔 Angle X / Y を制作・Preview・Runtime評価できること。
- `AC-MVP-012`: Runtime / Viewer が parameter 一覧、範囲、初期値、現在値を表示し、slider 操作で値を変えられること。
- `AC-MVP-012`: parameter 操作結果として、評価済み drawable state、vertex、visibility、opacity、draw order、mask 状態、diagnostics が構造化 runtime state として取得できること。
- `AC-MVP-013`: Validator は runtime load test と代表 parameter 評価を含む構造化 report を出すこと。
- `AC-MVP-014`: AI Agent は runtime state snapshot、diff、validation report を扱えること。
- `AC-MVP-015`: Cubism Editor、Cubism SDK/Core、`.cmo3` 復元、`.moc3` 互換出力を必須依存にしないこと。

MVP外項目として、基本チュートリアル6相当の animation mode、timeline、motion 作成、motion export は明示的に除外されている。また expression asset、motion asset、physics asset の完全制作も MVP外である。ただし MVP ミニモデル内の parameter 駆動表情と髪揺れ相当は含まれる。

### 3.2 既存設計判断からの要求

`discussion/design/initial-design-decisions-and-open-questions.md` は、Editor と Viewer を同一アプリ内機能とし、Editor preview と Viewer が Shared Runtime evaluation core を共有する方向を採用している。また、Editor-only production support state と runtime-visible model state を混同しないことを設計原則としている。

したがって Open Stack の runtime evaluation は、Cubism の motion / expression / physics / pose をそのまま実装する前に、MVP の中心である parameter / keyform / deformer / drawable state 評価を安定させる必要がある。

### 3.3 Viewer / Preview 参照レポートからの要求

`discussion/reports/viewer-preview-reference/cubism-viewer-runtime-observable-features.md` は、Cubism Viewer が motion、expression、physics、pose を確認できることを整理している。一方、Open Stack MVP Viewer では motion timeline、expression manager、physics editor、pose editor は必須にしない方針が示されている。

同レポートは、Open Stack Viewer が runtime-visible state と authoring state を分け、unsupported optional sidecar も package graph / diagnostics として扱うべきことを示唆している。

---

## 4. Assumptions and Inferences

### 4.1 Official docs から推論する評価モデル

Cubism Framework sample の update ordering は、次の抽象モデルとして読める。

1. 前フレームまたは motion 後の baseline parameter state を復元する。
2. 時間駆動 layer が parameter を更新する。
3. 相対 layer が add / multiply / overwrite で parameter を変える。
4. physics が現在 parameter を input として output parameter を set する。
5. pose が virtual parameter を参照して part opacity を確定する。
6. model update が parameter を drawable vertices / opacity などへ反映する。

ただし、これは Cubism SDK の代表 sample に基づく推論であり、Open Stack が同じ layer を MVP で採用する必要はない。

### 4.2 Open Stack MVP への推論

Open Stack MVP では、motion / expression / physics / pose の full runtime execution を入れない方がよい。理由は、MVP AC が animation / motion asset / expression asset / physics asset の完全制作を除外し、GUI Editor での parameter / keyform / deformer 制作と runtime parameter 操作を中心にしているためである。

一方で、将来 motion / expression / physics / pose を導入するときに evaluation order が破壊的変更にならないよう、MVP から次の情報は診断または拡張点として持てる設計にするべきである。

- runtime evaluation order version
- layer application log
- effective parameter values before / after each supported layer
- unsupported sidecar diagnostics
- skipped layer reason
- source labels: package / runtime input / computed / unavailable

### 4.3 Save / Restore の Open Stack 化

Cubism の `SaveParameters` / `LoadParameters` は、Open Stack では API 名として模倣する必要はない。ただし、「評価フレームの baseline parameter state」と「各 layer が書き込む scratch / effective parameter state」を分ける概念は採用価値がある。

MVP では motion がないため、Cubism のように motion 後 state を保存する必要は薄い。しかし Viewer slider や AI operation の dry-run / diff では、input parameter set、default state、evaluated state を分ける必要がある。したがって save / restore 相当は、内部 transaction / evaluation context / snapshot baseline として設計するのがよい。

---

## 5. Layer Mapping

| Cubism layer | Affects what | Official input / operation | Open Stack MVP handling |
|---|---|---|---|
| Direct parameter operation | parameter values | set / add / multiply, ID or index access | 採用。Viewer slider、operation core、AI dry-run で deterministic に扱う。 |
| Parameter save / restore | evaluation baseline | `SaveParameters` / `LoadParameters` | 採用。ただし Cubism API 模倣ではなく evaluation context / snapshot baseline として扱う。 |
| Motion | parameter values, virtual part-opacity parameters, events | `.motion3.json`, fade, loop, motion manager, group, event | MVP外。optional sidecar として検出し、unsupported / ignored / metadata diagnostics を出す。 |
| Expression | parameter values | `.exp3.json`, add / multiply / overwrite, fade transition | asset system は MVP外。MVP内の表情は parameter / keyform として制作する。将来用に calculation method enum は設計余地を残す。 |
| Physics | output parameter values | `.physics3.json`, inputs / outputs, FPS, gravity / wind, evaluate | full physics は MVP外。髪揺れ相当は parameter-driven または簡易 deformer。physics sidecar は FPS / input / output metadata を診断対象にできる。 |
| Pose | part opacity / effective visibility | `.pose3.json`, group switching, parent ID, fade, virtual parameters | MVP外。MVPの腕や表示切替は通常 parameter / keyform / visibility として扱う。pose sidecar は part group diagnostics だけ先行可能。 |
| Eye blink / breath / lip-sync / drag | parameter values | Framework helper layer | MVPでは Viewer slider / explicit parameter operation に限定。自動 layer は Post-MVP。 |
| `model.update()` | drawable vertices, evaluated draw state | parameter values を vertex calculation に反映 | 採用。Shared Runtime evaluation core の中心 API として、parameter state から evaluated drawable state を作る。 |

---

## 6. Design Implications

### 6.1 MVP runtime evaluation core

MVP の runtime evaluation core は、Cubism の runtime input layers をすべて再現するのではなく、次を安定した契約にするべきである。

- input parameter values: slider / operation / default 由来の明示値。
- parameter constraints: min / default / max、range diagnostics。
- keyform / deformer evaluation: parameter values から deformation state を決める。
- drawable evaluation: vertices、opacity、visibility、draw order、mask state を出す。
- snapshot: input、effective parameter state、evaluated drawable state、diagnostics を構造化する。

Motion / expression / physics / pose は、MVP runtime において active layer ではなく optional unsupported layer として記録する。

### 6.2 Update order を versioned contract にする

Cubism 公式 docs は、計算順序が表現に大きく影響することを明示している。Open Stack でも、将来 layer を追加するときに順序が暗黙化すると、Viewer、Validator、AI Agent の結果がずれる。

MVP から `evaluationOrderVersion` のような概念を持ち、snapshot に次を含めることを推奨する。

- `orderVersion`
- `appliedLayers[]`
- `skippedLayers[]`
- `parameterState.beforeCore`
- `parameterState.afterCore`
- `drawableState.afterModelUpdate`

Post-MVP で motion / expression / physics / pose を導入する場合も、`layerBefore` / `layerAfter` を diff できるようにする。

### 6.3 Unsupported sidecar diagnostics

Open Model Package が将来 motion / expression / physics / pose 相当 sidecar を持つ可能性を残す場合、MVP Viewer / Validator は実行せずに次を診断できるべきである。

| Diagnostic ID | Meaning |
|---|---|
| `runtime.layer.motion.unsupported` | motion sidecar は存在するが MVP runtime は再生しない。 |
| `runtime.layer.motion.targetSdkObserved` | Cubism由来 motion metadata に target SDK type がある。互換評価は未対応。 |
| `runtime.layer.motion.eventIgnored` | event track は存在するが callback / action dispatch は未対応。 |
| `runtime.layer.expression.unsupported` | expression sidecar は存在するが MVP runtime は適用しない。 |
| `runtime.layer.expression.methodObserved` | add / multiply / overwrite の指定を検出したが未評価。 |
| `runtime.layer.physics.unsupported` | physics sidecar は存在するが simulation は未実行。 |
| `runtime.layer.physics.fpsObserved` | physics FPS を検出したが MVP runtime は未使用。 |
| `runtime.layer.pose.unsupported` | pose sidecar は存在するが part switching は未実行。 |
| `runtime.layer.pose.groupObserved` | pose group / parent ID を検出したが MVP runtime は未適用。 |

### 6.4 AI Agent への渡し方

AI Agent に渡す runtime state では、Cubism風 layer の結果を曖昧に混ぜない。

- `authoringState`: keyform、deformer、GUI制作構造。
- `runtimeInput`: parameter overrides、time、optional layer settings。
- `runtimeComputed`: evaluated parameters、vertices、opacity、mask、draw order。
- `unsupportedRuntimeLayer`: motion / expression / physics / pose の存在と未対応理由。
- `assumption`: unsupported layer を無視したため、Cubism Viewer と見た目が一致する保証はない。

これにより、AI Agent が「physics を実行していないのに髪揺れが壊れている」と誤診断することを避けられる。

---

## 7. MVP vs Post-MVP

### 7.1 MVPに採用する

| Item | Reason |
|---|---|
| Direct parameter operation | MVP Viewer slider、AI operation、Runtime snapshot の基本である。 |
| Deterministic keyform / deformer evaluation | MVPミニモデルの可動を成立させる中心機能である。 |
| Evaluation context / baseline | save / restore 相当を内部化し、dry-run、diff、snapshot を安定させる。 |
| `model.update()` 相当の明示 phase | parameter 変更と drawable state 計算を分け、Validator と AI が比較できるようにする。 |
| Unsupported layer diagnostics | Cubism由来 package や将来 sidecar を読んだとき、無視した事実を明示するため。 |
| Runtime snapshot fields | parameter、drawable、part、mask、diagnostics を構造化して返す必要がある。 |

### 7.2 MVP外だが診断可能にする

| Item | MVP外にする理由 | MVPでの診断 |
|---|---|---|
| Motion playback / motion manager | animation mode、timeline、motion作成はMVP外。 | sidecar existence、group、fade、FPS、target SDK type、event presence。 |
| Expression asset playback | expression asset 完全制作はMVP外。 | expression list、fade、parameter targets、add/multiply/overwrite metadata。 |
| Full physics simulation | 髪揺れは parameter-driven / 簡易 deformer でよい。 | FPS、input IDs、output IDs、gravity/wind、unsupported reason。 |
| Pose switching runtime | MVPミニモデルの必須一周には不要。 | pose groups、parent IDs、fade ms、part references。 |
| Eye blink / breath / lip-sync automatic layers | MVPは明示 parameter 操作と制作済み keyform を優先する。 | future layer slots として未適用を記録。 |
| Motion event callback | action dispatch 設計が必要で MVP中心ではない。 | event track detected / ignored。 |

### 7.3 Post-MVP候補

Post-MVP では次の順で導入するのが妥当である。

1. Expression asset playback: add / multiply / overwrite と fade transition は比較的局所的で、parameter evaluation layer として導入しやすい。
2. Motion playback: time、fade、group、event、target behavior を扱う必要があり、timeline / animation authoring との連携が必要である。
3. Pose switching: part opacity / visibility の runtime layer として有用だが、authoring側の切替構造と virtual parameter 設計が必要である。
4. Physics simulation: FPS、stateful simulation、input / output mapping、gravity / wind を扱うため、determinism と snapshot 設計を固めてからがよい。

---

## 8. Explicit vs Inferred Ordering

| Ordering fact | Status | Notes |
|---|---|---|
| set / add / multiply の順序は結果に影響する | Explicit official fact | Parameter manual が overwrite / add / multiply の違いと順序の重要性を説明している。 |
| 一般に overwrite、add、multiply の順で適用される | Explicit official fact | Parameter manual が common order として説明している。 |
| sample `LAppModel::Update` は `load -> motion -> save -> eyeBlink -> expression -> drag -> breath -> physics -> lipSync -> pose -> model.update` | Explicit sample/manual fact | Native / Web / Java の sample update として掲載されている。 |
| save / restore は add / multiply の baseline を作る | Explicit official fact | Parameter manual が目的を説明している。 |
| pose は model update process の最後の段階に適用する | Explicit official fact | Pose manual が明示している。 |
| physics は breath 後、lip-sync 前に置くべき | Sample-based fact | Parameter manual sample ではそうだが、独立仕様として強制されているとは読まない。 |
| Open Stack MVP でも Cubism と同順にすべき | Inference rejected for MVP | MVPでは該当 layer を実行しないため、同順再現は不要。将来のため order version を持つ。 |

---

## 9. Recommendations

### 9.1 MVP設計への推奨

- Runtime evaluation core は、parameter input から keyform / deformer / drawable state を決定する単純な deterministic pipeline に限定する。
- Motion / expression / physics / pose は MVP execution layer に入れず、optional unsupported layer として manifest / diagnostics に残す。
- Save / restore は Cubism API 名ではなく、`evaluationContext.baselineParameters` と `effectiveParameters` のような概念で表現する。
- Snapshot には、入力 parameter、評価後 parameter、drawable state、part state、mask state、diagnostics、skipped layer を含める。
- MVP Viewer は Cubism Viewer 互換ではなく、Open Model Package の runtime verification 面として設計する。
- Validator は「unsupported layer を無視した結果の評価」と「sidecar を含めれば変わる可能性」を分けて報告する。

### 9.2 Future compatibility への推奨

- `evaluationOrderVersion` を package または runtime snapshot に含める。
- layer registry を持ち、将来 `motion-v1`、`expression-v1`、`physics-v1`、`pose-v1` を追加できるようにする。
- expression の add / multiply / overwrite は、Post-MVP で最初に導入しやすい layer として schema enum を先行検討する。
- physics は FPS と stateful simulation の determinism が難所になるため、実装前に test fixture と snapshot diff 仕様を作る。
- pose は part opacity と visibility の扱いが MVP の runtime state と衝突しやすいため、part visibility / opacity の ownership を先に決める。

---

## 10. Open Questions

- Open Stack の package schema は、MVP時点で motion / expression / physics / pose sidecar slot を持つか。それとも将来 migration で追加するか。
- MVP runtime snapshot に `evaluationOrderVersion` を必須で入れるか、runtime implementation metadata に留めるか。
- MVP の表情可動は parameter / keyform として扱うが、Post-MVP expression asset と同じ parameter に同時適用された場合の優先順をどう定義するか。
- Physics を導入する場合、Open Stack は fixed timestep を採用するか、Cubism の physics FPS file semantics に近づけるか。
- Pose を導入する場合、Cubism の virtual parameter 方式を参考にするか、Open Stack 固有の part switching graph として表現するか。
- Part opacity、visibility、draw order のうち、motion / pose / keyform / editor hide がそれぞれどの state を所有するか。
- AI Agent が unsupported sidecar を検出したとき、severity を `info`、`warning`、`not_applicable` のどれにするか。MVP review と一般 Validator で severity を分けるか。
- Cubism 標準 parameter ID を Open Stack の alias としてどこまで採用するか。特に expression / physics / pose の将来連携で互換 alias が必要になるか。

---

## 11. Sources

Official Live2D sources:

- About Motion: https://docs.live2d.com/en/cubism-sdk-manual/motion/
- Motion Settings: https://docs.live2d.com/en/cubism-editor-manual/motion-setting/
- Loading Models and Motion: https://docs.live2d.com/en/cubism-editor-manual/load-model-and-motion/
- Reproducibility of `.motion3.json`: https://docs.live2d.com/en/cubism-sdk-manual/reproducibility-motion3-json/
- About Expression Motion: https://docs.live2d.com/en/cubism-sdk-manual/expression/
- Expression transition processing: https://docs.live2d.com/en/cubism-sdk-manual/blending-expression/
- Expression Settings and Export: https://docs.live2d.com/en/cubism-editor-manual/setting-and-exporting-facial-expressions/
- Physics: https://docs.live2d.com/en/cubism-sdk-manual/physics/
- Check Physics Information: https://docs.live2d.com/en/cubism-editor-manual/check-the-physics/
- About Pose: https://docs.live2d.com/en/cubism-sdk-manual/pose/
- Pose Settings: https://docs.live2d.com/en/cubism-editor-manual/pose-setting/
- Parameter Operation: https://docs.live2d.com/en/cubism-sdk-manual/parameters/

Repository basis documents:

- `discussion/_conventions.md`
- `discussion/reports/runtime-evaluation-semantics-reference/_map.md`
- `discussion/design/initial-design-decisions-and-open-questions.md`
- `discussion/acceptance-criteria/03_MVP_Acceptance_Criteria.md`
- `discussion/scenarios/03_MVP_Acceptance_Criteria.md`
- `discussion/reports/viewer-preview-reference/cubism-viewer-runtime-observable-features.md`
