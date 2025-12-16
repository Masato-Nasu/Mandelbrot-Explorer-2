# Mandelbrot Explorer UltraDeep v7

黒画面を潰すために、app.jsを全面書き直した安定版です。

特徴
- UltraDeep(BigInt) / Standard(float64) 切替
- 操作中プレビュー（粗く・軽い）→停止後に高精細（任意）
- 画面下にエラーを赤表示（DevTools不要）
- app.js/worker.js はクエリ付きで読み込み（キャッシュ混線を減らす）

GitHub Pages 手順
1) ZIPの中身をリポジトリ直下へ全部上書き
2) /reset.html を一度開いてキャッシュ掃除
3) / を開く

操作
- ドラッグ：移動
- ホイール：ズーム（Alt/Ctrl/Shift で倍率）
- R：リセット
- HQ Render：一発だけ高精細（重い）


## v7.4 additions
- HQ Render: progressive refinement (step 6→3→2→1)
- Save PNG button / S key


## v9.0 DeepNav (BigFloat coords)
- center/scale を BigFloat(BigInt×2^e) で保持し、超深度で Number が止まる問題を回避します。
- ある深さを超えると **DeepNav が自動で ON** になり、ホイール/ドラッグでは描画せず座標だけ更新します（高速に潜れます）。
- DeepNav 中は **Pキー**で軽いプレビュー、または **HQ Render**（段階精細化）で最終描画してください。
- HUD に `scaleBF log2=...` が出るので、超深度でも深さが把握できます。


## v9.0.1
- bfFromNumber が未定義になるケースを修正（BigFloat関数群を初期化より前に配置）


## v9.0.2
- DeepNav中でも「Follow ON」で低負荷プレビュー追従（操作しやすさ向上）
- プレビューはデバウンスして1回だけ描画（forceRes/forceStep/forceIterCap）


## v9.1 (Simple Controls)
- ホイール速度をスライダー（Zoom Speed）に一本化（Alt/Ctrl/Shift不要）
- クリックで中心合わせ、ダブルクリックで中心合わせ＋少しズームイン
- DeepNav中は Follow で自動追従（Pキー不要）


## v9.1.1
- ドラッグ改善：touch-action:none + pointerイベントをpassive:false + preventDefault
- クリック判定を「短いタップのみ」にして、ドラッグ後の誤中心合わせを抑制


## v9.2 (First-time Friendly)
- 初回起動でQuick Startオーバーレイ表示（? / H で再表示）
- 操作を単文化（説明文を現在の挙動に合わせて整理）


## v9.2.1
- Zoom Speed のレンジを低速側へ拡張（0.05×〜2.00×）
- 現在値をラベル表示


## v9.2.2
- Zoom Speedをさらに低速レンジへ（0.005×〜0.30× / 初期0.08×）
- wheel deltaのスパイクを抑制してズームの跳ねを防止


## v9.2.3
- Zoom Speed を中速寄りに再調整（0.02×〜1.20× / 初期0.35×）
- ズームdelta抑制を少し緩めて反応を戻す
