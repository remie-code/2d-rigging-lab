# Reference-guided Rigging Reviews

独立技術レビューの置き場。User Gateとは別。

- [Wave 1 A](wave-1-a.md): 計算基盤・専用環境・CUDA smoke、独立技術review PASS。
- [Wave 1 B](wave-1-b.md): 人工fixtureの比較ビュー、独立review PASS。実参照/User Gate未判定。
- [Wave 2](wave-2.md): 実画像2条件・統合・表示、独立技術review PASS。部位品質/User Gateは未判定。

- [棄却前推定表示](raw-view.md): source・関連14試験・artifact不変性に限定してPASS。独立browser検証は環境不可、root目視は別記。User Gate未判定。

## 点・輪郭による変形試作

- [Wave 1 A](landmark-warp-wave-1-a.md): 素材・指定契約の独立技術PASS、実画像の指定品質/User Gateとは別。
- [Wave 1 B](landmark-warp-wave-1-b.md): 計算・描画の独立PASS、15試験と人工4出力。
- [Wave 1 C](landmark-warp-wave-1-c.md): 内部19試験PASS、独立browserはprovider不在で未実施。root実scene目視を独立PASSへ読み替えない。
- [点・輪郭Wave 2 D](landmark-warp-wave-2.md): v2の承認入力・4出力・scene接続の技術PASS。自然さ未達、Gate 2未承認、独立browser未検証。

- [素材インターフェース共通契約](material-interface-contract.md): Loop 3技術PASS、27tests等成功。業務実装/実素材/User Gateとは別。

- [素材インターフェース Wave 1 A](material-interface-wave-1-a.md): Loop 2技術PASS。画像/座標/I/O、56 testsと実rendererの技術fixture。root受領済み。
- [素材インターフェース Wave 1 B](material-interface-wave-1-b.md): 正式Loop 1技術PASS。モデル変更と共有参照guard、関連を含む101 tests。root受領済み。制作往復/User Gateとは別。
- [素材インターフェース Wave 2](material-interface-wave-2.md): 正式Loop 1技術PASS（headless統合・保存互換）。独立156 tests、Editor storage reader再読込確認。UI操作未検証、User Gate未実施。root受領済み。
