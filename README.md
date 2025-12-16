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


## v9.2.8
- HQ Render後も探索に戻れるように改善：HQパスを中断/復帰（次の入力で自動的に軽い設定へ戻る）
- ESCでHQ中断


## v9.2.9
- HUDのDeepNav表示を改善：有効(ON/OFF)と稼働(active ON/OFF)を分けて表示（誤解防止）


## v9.3.0
- DeepNavの発動(active)閾値を早めました（log2(|scale|) > 80）
  - Bits設定とは独立で、float64の精度限界に入る前にBigFloat座標優先に切り替えます


## v9.3.1
- DeepNavの状態表示を強化：左上に『DEEPNAV ACTIVE/STANDBY/OFF』バッジ
- Always ON 追加：チェックすると深度に関係なくDeepNavを常時active（探索中の座標更新がBigFloat優先）
  - 注意：DeepNav常時activeは“描画”より“潜航”優先の挙動になります（綺麗な止め絵はHQ Render推奨）


## v9.3.2
- Fix: deepAlways初期化順序によるReferenceError（Temporal Dead Zone）を解消


## v9.3.3
- Always ON がUIに必ず表示されるようにHTML挿入を強化
- ショートカット A で Always ON 切替


## v9.4
- 小学生でも迷わないUI：大きいボタン（きれいに描く/画像保存/はじめにもどる/つかいかた）
- くわしい設定は折りたたみ（大人向け）に隔離


## v9.4.1
- ズーム中に中心がカーソル方向へ寄る「初心者向け挙動」を追加（ズームイン時のみ、少しだけ中心が近づく）


## v9.4.2
- CAD式（カーソル固定）トグル追加：ONで『カーソル位置が固定』、OFFで『中心がカーソルへ少し寄る』


## v9.4.3
- ズーム挙動をCAD式（カーソル固定）に統一（中心寄せ補助やトグルを撤去）
- ドラッグ操作：左ボタン／ホイール押し込み（中ボタン）のどちらでも移動可能


## v9.4.4
- ドラッグ修正：active pointer idでガード／ボタン解除(ev.buttons==0)で即停止／lostpointercapture対応
- CAD式：シングルクリックで中心移動を廃止（誤操作防止）、中心移動はダブルクリックのみに
- 中ボタン（ホイール押し込み）でのブラウザ自動スクロールを抑制（auxclick/contextmenu preventDefault）


## v9.4.5
- ドラッグが効かない対策：マウス操作は pointer ではなく mouse イベントで専用実装（左/中ボタン）
- canvas に touch-action:none + overscroll-behavior を追加（ブラウザのジェスチャ干渉を抑制）


## v9.4.6
- ズーム速度を高速化：ベース係数UP、スライダー上限を2.5×へ、デフォルトを0.65×へ


## v9.4.7
- 「はじめにもどる」ボタンを実装（初期位置・初期ズームへ復帰）
- 表記整理：『大人向け』を削除
- DeepNav中のドラッグ追従を強化（panプレビューを即時に近く）


## v9.5.0
- DeepNavをUIから撤去（混乱防止。超深度は後で別ブランチ化）
- 「はじめにもどる」動作を維持
- ズーム基準点の精度改善（Math.round撤去）
- Shiftでゆっくりズーム（狙い撃ち用）
- 右下にバージョン固定タグ（更新確認用）


## v9.5.1
- 『初めに戻る』を確実に実装（ボタン + Hキー）
- v1風の“面白い色”になりやすいスムーズ着色（mu）に変更
- 更新確認：右下に v9.5.1 build を表示


## v9.5.2
- 勝手に画像が変わり続ける対策：HQをワンショット（段階パス廃止）
- autoSettle をデフォルトOFF（必要な時だけON）
- HQ完了後は画像を維持したまま、操作用のstep/resを自動復帰
- build stamp: 2025-12-16T08:50:59Z
