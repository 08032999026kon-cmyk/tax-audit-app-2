/* 事件データ（すべて架空）　喫茶店「浜風珈琲」（株式会社浜風珈琲・社長 白洲 守）
 * 答え：①土曜夜の貸切パーティーの売上をレジに通さず金庫に隠した（売上除外 153万円＝18回）
 *       ②山海物産の白紙の領収書で、豆の仕入れ30万円×6回をでっち上げた（架空経費 180万円）
 * v4：司会がスクリーンで「端緒」と「社長の言い分」を説明 → 各自が当たりをつけて調べる場所を選ぶ
 *     → 班で相談し、班長が言い分ごとに決め手の証拠を1つ選ぶ。
 */
window.CASE = (function () {
  /* 1人が調べられる場所の数 */
  const LIMIT = 4;

  /* ---------- 端緒（たんちょ）：決算書などから気づく不審な点 ---------- */
  const tancho = [
    { big: "今期だけ赤字", text: "お客さんの数は毎月ほぼ同じなのに、もうけが −57万円。" },
    { big: "原価率 31% → 42%", text: "値段も席数も同じなのに、仕入れの割合だけが急に上がった。" },
    { big: "山海物産に現金で180万円", text: "今期からの新しい仕入れ先。ほかの仕入れ先は全部銀行振込。" },
    { big: "夜の売上が0円", text: "ホームページでは「4月から土曜の夜は貸切OK」と宣伝している。" }
  ];

  /* 決算書（スクリーンとスマホで同じものを見せる） */
  const statement = `<table class="fs"><thead><tr><th>（万円）</th><th>前々期</th><th>前期</th><th>今期</th></tr></thead><tbody>
    <tr><th>売上</th><td>1,820</td><td>1,850</td><td>1,790</td></tr>
    <tr><th>仕入れ</th><td>564</td><td>574</td><td class="mark">752</td></tr>
    <tr class="sub"><th>原価率</th><td>31.0%</td><td>31.0%</td><td class="mark">42.0%</td></tr>
    <tr><th>人件費</th><td>610</td><td>620</td><td>625</td></tr>
    <tr><th>家賃・その他</th><td>456</td><td>460</td><td>470</td></tr>
    <tr class="total"><th>所得（もうけ）</th><td>190</td><td>196</td><td class="mark">−57</td></tr></tbody></table>
    <p class="cap">原価率＝売上に対する仕入れの割合。喫茶店ではふつう30%前後。</p>`;

  /* ---------- 社長の言い分（これを証拠でくずす） ---------- */
  // ok：決め手になる場所。trap：社長の言い分と食い違わない（くずせない）場所への特別な返事
  const claims = [
    { id: "A", short: "夜は営業していない", text: "夜は営業していません。お店は夕方7時までです。",
      ok: ["trash", "calendar", "shift"],
      win: "……夜の予定まで。わ、分かりました。土曜の夜は、貸切パーティーをやっていました。",
      miss: "それが夜の営業と何の関係があるんです？",
      trap: { register: "レジに夜の売上がないのは、夜は営業していないからですよ。" },
      why: "ゴミ箱の注文票・予約カレンダー・シフト表のどれかで、土曜の夜に貸切をしていたことが分かる。",
      hint: ["「夜」の予定や、夜のお客さんの記録が残っていそうな物は？", "店内の壁のカレンダーや、捨てられた紙を見てみよう。"] },
    { id: "B", short: "売上は全部銀行へ", text: "売上は毎日、全部銀行に入れています。",
      ok: ["safe"],
      win: "……その封筒まで。はい、貸切の売上は銀行に入れずに、金庫にしまっていました。",
      miss: "ふふ、それで何が分かるんです？ 売上は全部銀行ですよ。",
      trap: { bank: "通帳を見てください。毎日ちゃんと入金しているでしょう？", trash: "その注文票のお金も、ちゃんと銀行に入れましたよ。" },
      why: "金庫の「別」の封筒とノート。銀行に入れずに隠していた現金が、そのまま残っていた。",
      hint: ["銀行に入れなかったお金は、どこに置いておく？", "お金をしまっておけそうな場所を、社長に開けてもらおう。"] },
    { id: "C", short: "豆が値上がりした", text: "仕入れが増えたのは、豆が値上がりしたからです。",
      ok: ["stock", "desk", "bank"],
      win: "……そこまで。豆は値上がりしていません。山海物産の領収書は、私が書きました。",
      miss: "豆の値段なんて、いろいろですからね。",
      trap: { ledger: "ほら、領収書は全部そろっていますよ。ちゃんと払っています。" },
      why: "豆の入荷記録（値段は去年と同じ）、机の白紙の領収書、通帳（山海物産へ払った跡がない）のどれでもくずせる。",
      hint: ["豆が本当に値上がりしたのか、確かめられる記録は？", "倉庫の入荷記録や、事務室の机の中を見てみよう。"] }
  ];

  /* ---------- 調べられる場所 ---------- */
  // ask：調査官のお願い。ok：社長の返事。open：社長に開けてもらう物（承諾が特に大事）
  const areas = [
    { id: "shop", name: "店内", bg: "shop" },
    { id: "office", name: "事務室", bg: "office" },
    { id: "back", name: "倉庫・厨房", bg: "shop" }
  ];
  const places = [
    { id: "register", area: "shop", name: "レジの記録", where: "店内のレジ",
      ask: "レジの記録を見せていただけますか。", ok: "どうぞ。毎日きちんと締めていますよ。",
      doc: `<div class="receipt-roll"><b>日計表 11/2（土）</b><span>ブレンド ×64</span><span>ランチ ×21</span><span>ケーキセット ×18</span><span>…</span><b>合計 ¥68,400</b><em>レジ締め 18:58</em></div>`,
      note: "レジは毎日<b>夕方6時58分</b>に締めている。夜の売上は入っていない。" },
    { id: "menu", area: "shop", name: "メニュー表", where: "カウンター",
      ask: "メニュー表を拝見してもよろしいですか。", ok: "どうぞどうぞ。",
      doc: `<table class="ledger"><caption>メニュー</caption><tr><td>ブレンド</td><td>¥480</td></tr><tr><td>ランチセット</td><td>¥1,200</td></tr><tr><td>ケーキセット</td><td>¥950</td></tr></table>`,
      note: "値段は去年と同じ。特に気になる点はない。" },
    { id: "calendar", area: "shop", name: "壁のカレンダー", where: "店内の壁",
      ask: "壁のカレンダーを拝見してもよろしいですか。", ok: "ただのカレンダーですよ。",
      doc: `<div class="calendar"><b>11月</b><div class="cal">${Array.from({ length: 30 }, (_, i) => { const d = i + 1, sat = (d + 4) % 7 === 6; return `<span class="${sat ? "sat" : ""}">${d}${sat && d !== 30 ? "<i>貸切</i>" : ""}</span>`; }).join("")}</div><p class="hand">4月から 貸切 計18回</p></div>`,
      note: "土曜日ごとに<b>「貸切」</b>の書き込み。<b>4月から18回</b>と手書きのメモもある。" },
    { id: "trash", area: "shop", name: "ゴミ箱の中", where: "カウンターの下",
      ask: "ゴミ箱の中を確認させていただいてもよろしいですか。", ok: "ゴ、ゴミ箱？ ……まあ、どうぞ。", open: true,
      doc: `<div class="order-slip hand"><div>11/2（土）19:30〜</div><div>貸切パーティー　山田様 20名</div><div>コース 4,250円 × 20名</div><div class="big">合計 ¥85,000</div><div>現金にて受領 <span class="hanko">済</span></div></div>`,
      note: "11月2日（土）の<b>夜7時半から</b>、20名の貸切で<b>85,000円</b>。現金で受け取り済み。" },
    { id: "shift", area: "office", name: "アルバイトのシフト表", where: "事務室の壁",
      ask: "壁のシフト表を見せていただけますか。", ok: "……どうぞ。",
      doc: `<table class="ledger shift"><caption>11月 シフト表</caption><tr><th>日</th><th>佐藤</th><th>田中</th></tr>
        <tr><td>11/1（金）</td><td>8–15</td><td>12–19</td></tr><tr class="hl"><td>11/2（土）</td><td>8–15</td><td><b>19–23</b></td></tr>
        <tr><td>11/3（日）</td><td>8–15</td><td>12–19</td></tr><tr><td>…</td><td></td><td></td></tr>
        <tr class="hl"><td>11/9（土）</td><td>12–19</td><td><b>19–23</b></td></tr></table>`,
      note: "土曜日だけ、<b>夜7時〜11時</b>にアルバイトが入っている。" },
    { id: "bank", area: "office", name: "預金通帳", where: "事務室の机の上",
      ask: "預金通帳を見せていただけますか。", ok: "どうぞ。入金はきちんとしています。",
      doc: `<table class="ledger bank"><caption>普通預金　浜風珈琲</caption><tr><th>日付</th><th>摘要</th><th>出金</th><th>入金</th></tr>
        <tr><td>11/1</td><td>入金</td><td></td><td>61,200</td></tr><tr><td>11/2</td><td>入金</td><td></td><td>68,400</td></tr>
        <tr><td>11/5</td><td>振込 丸浜食品</td><td>264,000</td><td></td></tr><tr><td>11/5</td><td>振込 前川コーヒー</td><td>98,000</td><td></td></tr>
        <tr class="hl"><td colspan="4">1年分を見ても、山海物産への支払いも、30万円の引き出しも一度もない</td></tr></table>`,
      note: "入金はレジの合計と同じ額。<b>山海物産に払ったはずの30万円</b>は、通帳のどこからも出ていない。" },
    { id: "safe", area: "office", name: "金庫の中", where: "事務室のすみ",
      ask: "金庫を開けて、中を見せていただけますか。", ok: "……釣り銭と私物だけですよ。（社長がしぶしぶ金庫を開ける）", open: true,
      doc: `<div class="envelope"><span>別</span><small>裏に鉛筆で「11/2」</small><b>¥85,000</b></div>
        <table class="ledger hand small"><caption>小さなノート</caption><tr><td>4/6 貸切</td><td>78,000</td></tr><tr><td>4/20 貸切</td><td>91,000</td></tr><tr><td>…</td><td>…</td></tr><tr><td>11/2 貸切</td><td>85,000</td></tr><tr class="hl"><td>18回 計</td><td>1,530,000</td></tr></table>`,
      note: "「別」と書かれた封筒に<b>現金85,000円</b>（裏に11/2）。ノートには<b>貸切18回・計153万円</b>。" },
    { id: "desk", area: "office", name: "机の引き出し", where: "事務室の机",
      ask: "机の引き出しを開けて、中を見せていただけますか。", ok: "……か、構いませんよ。（社長が鍵で引き出しを開ける）", open: true,
      doc: `<div class="receipt-blank"><b>領 収 書</b><span>　　　　様</span><span>¥　　　　　-</span><span>但</span><em>山海物産株式会社<span class="hanko">山海</span></em><small>× 14枚（使った跡あり）</small></div>`,
      note: "山海物産のハンコが押された<b>白紙の領収書の束</b>。金額を好きに書けてしまう。" },
    { id: "ledger", area: "office", name: "仕入れの帳簿と領収書", where: "事務室の本棚",
      ask: "仕入れの帳簿と領収書を見せていただけますか。", ok: "どうぞ。領収書は全部そろっていますよ。",
      doc: `<table class="ledger"><caption>仕入帳（山海物産）</caption><tr><td>5/10</td><td>豆</td><td>300,000</td><td>現金</td></tr><tr><td>6/14</td><td>豆</td><td>300,000</td><td>現金</td></tr><tr><td>…</td><td></td><td></td><td></td></tr><tr class="hl"><td>6回</td><td>計</td><td>1,800,000</td><td></td></tr></table>
        <div class="receipt-mini hand">領収書　¥300,000-　山海物産<span class="hanko">山海</span></div>`,
      note: "山海物産から豆を<b>30万円ずつ6回</b>。領収書は全部そろっている。" },
    { id: "stock", area: "back", name: "豆の入荷記録", where: "倉庫の棚",
      ask: "豆の入荷記録を見せていただけますか。", ok: "豆ですか？ どうぞ。",
      doc: `<table class="ledger"><caption>豆の入荷記録</caption><tr><th></th><th>前期</th><th>今期</th></tr><tr><td>入荷量</td><td>月 3袋</td><td>月 3袋</td></tr><tr class="hl"><td>1袋の値段</td><td>15,000円</td><td>15,000円</td></tr><tr><td>届いた豆</td><td>前川コーヒー</td><td>前川コーヒーのみ</td></tr></table>`,
      note: "豆の量も<b>値段も去年と同じ</b>。届いているのは前川コーヒーの豆だけ。" },
    { id: "fridge", area: "back", name: "冷蔵庫の中", where: "厨房",
      ask: "冷蔵庫の中を拝見してもよろしいですか。", ok: "食材しかありませんよ。",
      doc: `<table class="ledger"><caption>冷蔵庫</caption><tr><td>牛乳</td><td>12本</td></tr><tr><td>ケーキ</td><td>3種</td></tr><tr><td>サンドイッチの具</td><td>少し</td></tr></table>`,
      note: "ふつうの食材。特に気になる点はない。" }
  ];

  const place = (id) => places.find((p) => p.id === id);
  const result = { sales: 153, cost: 180, before: -57, after: 276 };

  return { LIMIT, tancho, statement, claims, areas, places, place, result };
})();
