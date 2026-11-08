/* 事件データ（すべて架空）　喫茶店「浜風珈琲」（株式会社浜風珈琲・社長 白洲 守）
 * 答え：①土曜夜の貸切パーティーの売上をレジに通さず金庫に隠した（売上除外 153万円＝18回）
 *       ②山海物産の白紙の領収書で、豆の仕入れ30万円×6回をでっち上げた（架空経費 180万円）
 * v5：お店の机・壁・棚に資料が33点。班で「どの資料を見れば確かめられるか」当たりの付け方を相談し、
 *     各自が1人6点まで見る → 班で持ち寄り、班長が言い分ごとに決め手の資料を1つ選んで社長に示す。
 */
window.CASE = (function () {
  /* 1人が見られる資料の数 */
  const LIMIT = 6;

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
  // ok：決め手になる資料。trap：社長の言い分と食い違わない資料への特別な返事
  const claims = [
    { id: "A", short: "夜は営業していない", text: "夜は営業していません。お店は夕方7時までです。",
      ok: ["trash", "calendar", "poster", "memo", "shift", "payroll", "clean"],
      win: "……夜のことまで。わ、分かりました。土曜の夜は、貸切パーティーをやっていました。",
      miss: "それが夜の営業と何の関係があるんです？",
      trap: { register: "レジに夜の売上がないのは、夜は営業していないからですよ。", permit: "許可証のどこに、夜やっているなんて書いてあります？", wine: "ワインは料理に使うんですよ。夜の営業とは関係ありません。" },
      why: "夜の動きが残る資料ならどれでもくずせる：捨てられた注文票・予約カレンダー・求人の貼り紙・電話メモ・シフト表・給与台帳・清掃チェック表。",
      hint: ["夜に人やお客さんが動いた跡が残っていそうな資料は？", "予定（カレンダー・メモ）や、人の働いた記録（シフト・給与）を探そう。"] },
    { id: "B", short: "売上は全部銀行へ", text: "売上は毎日、全部銀行に入れています。",
      ok: ["safe"],
      win: "……その封筒まで。はい、貸切の売上は銀行に入れずに、金庫にしまっていました。",
      miss: "ふふ、それで何が分かるんです？ 売上は全部銀行ですよ。",
      trap: { bank: "通帳を見てください。毎日ちゃんと入金しているでしょう？", trash: "その注文票のお金も、ちゃんと銀行に入れましたよ。", change: "両替は釣り銭のためです。売上とは関係ありません。" },
      why: "金庫の「別」の封筒とノート。銀行に入れずに隠していた現金が、そのまま残っていた。",
      hint: ["銀行に入れなかったお金は、どこに置いておく？", "お金をしまっておけそうな場所を、社長に開けてもらおう。"] },
    { id: "C", short: "豆が値上がりした", text: "仕入れが増えたのは、豆が値上がりしたからです。",
      ok: ["stock", "beans", "desk", "bank"],
      win: "……そこまで。豆は値上がりしていません。山海物産の領収書は、私が書きました。",
      miss: "豆の値段なんて、いろいろですからね。",
      trap: { ledger: "ほら、領収書は全部そろっていますよ。ちゃんと払っています。", bizcard: "山海物産さんの名刺ですよ。それが何か？" },
      why: "豆の入荷記録（値段は去年と同じ）・倉庫の豆の袋（山海物産の豆が1つもない）・机の白紙の領収書・通帳（山海物産へ払った跡がない）のどれでもくずせる。",
      hint: ["豆が本当に値上がりしたのか、山海物産から本当に買ったのか、確かめられる資料は？", "倉庫の豆や入荷の記録、お金の出入り、机の中を見てみよう。"] }
  ];

  /* ---------- お店の中：場所（社長に承諾をもらう単位）と、そこにある資料 ---------- */
  const areas = [
    { id: "shop", name: "店内", bg: "shop" },
    { id: "office", name: "事務室", bg: "office" },
    { id: "back", name: "倉庫・厨房", bg: "shop" }
  ];
  // open:true は社長に開けてもらう場所
  const spots = [
    { id: "reg", area: "shop", name: "レジまわり", ask: "レジまわりの書類を見せていただけますか。", ok: "どうぞ。毎日きちんと締めていますよ。" },
    { id: "wall", area: "shop", name: "店内の壁", ask: "壁に貼ってあるものを拝見してもよろしいですか。", ok: "どうぞどうぞ。" },
    { id: "under", area: "shop", name: "カウンターの下", ask: "カウンターの下と、ゴミ箱の中を確認させていただいてもよろしいですか。", ok: "ゴ、ゴミ箱？ ……まあ、どうぞ。" },
    { id: "top", area: "office", name: "机の上", ask: "机の上の書類を見せていただけますか。", ok: "どうぞ。散らかっていますがね。" },
    { id: "drawer", area: "office", name: "机の引き出し", open: true, ask: "机の引き出しを開けて、中を見せていただけますか。", ok: "……か、構いませんよ。（社長が鍵で引き出しを開ける）" },
    { id: "owall", area: "office", name: "事務室の壁", ask: "事務室の壁のものを拝見してもよろしいですか。", ok: "……どうぞ。" },
    { id: "shelf", area: "office", name: "本棚", ask: "本棚のファイルを見せていただけますか。", ok: "古いものばかりですよ。どうぞ。" },
    { id: "safe", area: "office", name: "金庫", open: true, ask: "金庫を開けて、中を見せていただけますか。", ok: "……釣り銭と私物だけですよ。（社長がしぶしぶ金庫を開ける）" },
    { id: "store", area: "back", name: "倉庫の棚", ask: "倉庫の棚を見せていただけますか。", ok: "豆と備品ですよ。どうぞ。" },
    { id: "kitchen", area: "back", name: "厨房", ask: "厨房の記録を拝見してもよろしいですか。", ok: "どうぞ。衛生管理はきちんとしています。" }
  ];

  const L = (cap, rows, hl) => `<table class="ledger"><caption>${cap}</caption>${rows.map((r, i) => `<tr class="${hl === i ? "hl" : ""}">${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</table>`;
  const docs = [
    /* 店内：レジまわり */
    { id: "register", spot: "reg", name: "レジの日計表",
      doc: `<div class="receipt-roll"><b>日計表 11/2（土）</b><span>ブレンド ×64</span><span>ランチ ×21</span><span>ケーキセット ×18</span><span>…</span><b>合計 ¥68,400</b><em>レジ締め 18:58</em></div>`,
      note: "レジは毎日<b>夕方6時58分</b>に締めている。夜の売上は入っていない。" },
    { id: "pointcard", spot: "reg", name: "ポイントカードの控え",
      doc: L("ポイントカード発行数", [["9月", "41枚"], ["10月", "38枚"], ["11月", "12枚（途中）"]]),
      note: "常連さんは毎月同じくらい。特に気になる点はない。" },
    { id: "change", spot: "reg", name: "両替の記録",
      doc: L("両替メモ", [["11/1", "千円札 20枚"], ["11/2", "千円札 20枚"], ["11/5", "百円玉 50枚"]]),
      note: "釣り銭用の両替。特に気になる点はない。" },
    /* 店内の壁 */
    { id: "calendar", spot: "wall", name: "予約カレンダー",
      doc: `<div class="calendar"><b>11月</b><div class="cal">${Array.from({ length: 30 }, (_, i) => { const d = i + 1, sat = (d + 4) % 7 === 6; return `<span class="${sat ? "sat" : ""}">${d}${sat && d !== 30 ? "<i>貸切</i>" : ""}</span>`; }).join("")}</div><p class="hand">4月から 貸切 計18回</p></div>`,
      note: "土曜日ごとに<b>「貸切」</b>の書き込み。<b>4月から18回</b>と手書きのメモもある。" },
    { id: "menu", spot: "wall", name: "メニュー表",
      doc: L("メニュー", [["ブレンド", "¥480"], ["ランチセット", "¥1,200"], ["ケーキセット", "¥950"]]),
      note: "値段は去年と同じ。特に気になる点はない。" },
    { id: "permit", spot: "wall", name: "営業許可証",
      doc: `<div class="cert"><b>飲食店営業許可証</b><span>株式会社浜風珈琲</span><span>許可の期限 2029年3月31日</span><small>（保健所）</small></div>`,
      note: "ふつうの営業許可証。営業時間は書かれていない。" },
    { id: "poster", spot: "wall", name: "求人の貼り紙",
      doc: `<div class="poster"><b>スタッフ募集！</b><span>ホール・キッチン</span><span class="big">土曜 19時〜23時</span><span>時給 1,300円</span><small>くわしくは店長まで</small></div>`,
      note: "<b>土曜の夜7時〜11時</b>のスタッフを募集している。" },
    /* カウンターの下 */
    { id: "trash", spot: "under", name: "ゴミ箱の中の紙",
      doc: `<div class="order-slip hand"><div>11/2（土）19:30〜</div><div>貸切パーティー　山田様 20名</div><div>コース 4,250円 × 20名</div><div class="big">合計 ¥85,000</div><div>現金にて受領 <span class="hanko">済</span></div></div>`,
      note: "11月2日（土）の<b>夜7時半から</b>、20名の貸切で<b>85,000円</b>。現金で受け取り済み。" },
    { id: "flyer", spot: "under", name: "業者のチラシ",
      doc: `<div class="poster plain"><b>業務用コーヒーマシン</b><span>リース月々 9,800円〜</span><small>浜辺厨房機器</small></div>`,
      note: "売り込みのチラシ。特に気になる点はない。" },
    { id: "news", spot: "under", name: "古新聞",
      doc: `<div class="poster plain"><b>浜辺新聞</b><span>商店街の夏祭り、来場者が過去最多</span></div>`,
      note: "ただの古新聞。特に気になる点はない。" },
    /* 事務室：机の上 */
    { id: "bank", spot: "top", name: "預金通帳",
      doc: `<table class="ledger bank"><caption>普通預金　浜風珈琲</caption><tr><th>日付</th><th>摘要</th><th>出金</th><th>入金</th></tr>
        <tr><td>11/1</td><td>入金</td><td></td><td>61,200</td></tr><tr><td>11/2</td><td>入金</td><td></td><td>68,400</td></tr>
        <tr><td>11/5</td><td>振込 丸浜食品</td><td>264,000</td><td></td></tr><tr><td>11/5</td><td>振込 前川コーヒー</td><td>98,000</td><td></td></tr>
        <tr class="hl"><td colspan="4">1年分を見ても、山海物産への支払いも、30万円の引き出しも一度もない</td></tr></table>`,
      note: "入金はレジの合計と同じ額。<b>山海物産に払ったはずの30万円</b>は、通帳のどこからも出ていない。" },
    { id: "ledger", spot: "top", name: "仕入帳と領収書",
      doc: L("仕入帳（山海物産）", [["5/10", "豆", "300,000", "現金"], ["6/14", "豆", "300,000", "現金"], ["…", "", "", ""], ["6回", "計", "1,800,000", ""]], 3) + `<div class="receipt-mini hand">領収書　¥300,000-　山海物産<span class="hanko">山海</span></div>`,
      note: "山海物産から豆を<b>30万円ずつ6回</b>。領収書は全部そろっている。" },
    { id: "memo", spot: "top", name: "電話のメモ",
      doc: `<div class="memo-note hand"><b>TEL</b><span>山田様　11/2（土）夜7時半〜</span><span>20名　コース</span><span>→ OK！</span></div>`,
      note: "<b>11月2日の夜7時半から20名</b>の予約を受けたメモ。" },
    { id: "utility", spot: "top", name: "電気代の請求書",
      doc: L("電気料金のお知らせ", [["10月分", "48,200円"], ["前年同月", "47,900円"]]),
      note: "去年とほぼ同じ。特に気になる点はない。" },
    { id: "bizcard", spot: "top", name: "名刺の束",
      doc: `<div class="biz"><small>山海物産株式会社</small><b>代表 海野 一郎</b><span>浜辺市潮見町3-4-5 潮見ハイツ201</span></div>`,
      note: "山海物産の名刺。住所はアパートの一室だ。" },
    /* 机の引き出し */
    { id: "desk", spot: "drawer", name: "領収書の束",
      doc: `<div class="receipt-blank"><b>領 収 書</b><span>　　　　様</span><span>¥　　　　　-</span><span>但</span><em>山海物産株式会社<span class="hanko">山海</span></em><small>× 14枚（使った跡あり）</small></div>`,
      note: "山海物産のハンコが押された<b>白紙の領収書の束</b>。金額を好きに書けてしまう。" },
    { id: "photo", spot: "drawer", name: "古い写真",
      doc: `<div class="photo-print"><div class="ph"></div><p>祝 開店 2019.10.15</p></div>`,
      note: "開店の日の記念写真。特に気になる点はない。" },
    /* 事務室の壁 */
    { id: "shift", spot: "owall", name: "アルバイトのシフト表",
      doc: `<table class="ledger shift"><caption>11月 シフト表</caption><tr><th>日</th><th>佐藤</th><th>田中</th></tr>
        <tr><td>11/1（金）</td><td>8–15</td><td>12–19</td></tr><tr class="hl"><td>11/2（土）</td><td>8–15</td><td><b>19–23</b></td></tr>
        <tr><td>11/3（日）</td><td>8–15</td><td>12–19</td></tr><tr><td>…</td><td></td><td></td></tr>
        <tr class="hl"><td>11/9（土）</td><td>12–19</td><td><b>19–23</b></td></tr></table>`,
      note: "土曜日だけ、<b>夜7時〜11時</b>にアルバイトが入っている。" },
    { id: "insure", spot: "owall", name: "火災保険の証書",
      doc: `<div class="cert"><b>火災保険 証券</b><span>浜風珈琲 店舗一式</span><span>保険期間 1年</span></div>`,
      note: "ふつうの保険の証書。特に気になる点はない。" },
    { id: "contacts", spot: "owall", name: "業者の連絡先一覧",
      doc: L("連絡先", [["丸浜食品", "0X-XXXX-1111"], ["前川コーヒー", "0X-XXXX-2222"], ["設備の修理", "0X-XXXX-3333"]]),
      note: "取引先の電話番号。山海物産の番号は書かれていない。" },
    /* 本棚 */
    { id: "payroll", spot: "shelf", name: "給与の台帳",
      doc: L("給与台帳 11月（田中）", [["ふつうの時間", "64時間"], ["夜10時以降（深夜）", "8時間"], ["支給額", "98,600円"]], 1),
      note: "アルバイトの田中さんに、<b>夜10時以降の深夜手当</b>が出ている。" },
    { id: "lease", spot: "shelf", name: "店舗の賃貸借契約書",
      doc: L("賃貸借契約書（抜き書き）", [["家賃", "月 22万円"], ["契約期間", "2年ごとに更新"]]),
      note: "店の借り方の契約。特に気になる点はない。" },
    { id: "lastyear", spot: "shelf", name: "前期の帳簿",
      doc: L("前期 仕入帳（豆）", [["前川コーヒー", "月 3袋", "1袋 15,000円"], ["山海物産", "取引なし", ""]]),
      note: "前期は前川コーヒーだけ。山海物産とは取引がなかった。" },
    { id: "manual", spot: "shelf", name: "機械の説明書",
      doc: `<div class="poster plain"><b>エスプレッソマシン 取扱説明書</b><span>お手入れは毎日行ってください</span></div>`,
      note: "ただの説明書。特に気になる点はない。" },
    /* 金庫 */
    { id: "safe", spot: "safe", name: "「別」と書いた封筒とノート",
      doc: `<div class="envelope"><span>別</span><small>裏に鉛筆で「11/2」</small><b>¥85,000</b></div>
        <table class="ledger hand small"><caption>小さなノート</caption><tr><td>4/6 貸切</td><td>78,000</td></tr><tr><td>4/20 貸切</td><td>91,000</td></tr><tr><td>…</td><td>…</td></tr><tr><td>11/2 貸切</td><td>85,000</td></tr><tr class="hl"><td>18回 計</td><td>1,530,000</td></tr></table>`,
      note: "「別」と書かれた封筒に<b>現金85,000円</b>（裏に11/2）。ノートには<b>貸切18回・計153万円</b>。" },
    { id: "deed", spot: "safe", name: "登記の書類",
      doc: `<div class="cert"><b>履歴事項全部証明書</b><span>株式会社浜風珈琲</span><span>代表取締役 白洲 守</span></div>`,
      note: "会社の登記の書類。特に気になる点はない。" },
    /* 倉庫の棚 */
    { id: "stock", spot: "store", name: "豆の入荷記録",
      doc: L("豆の入荷記録", [["", "前期", "今期"], ["入荷量", "月 3袋", "月 3袋"], ["1袋の値段", "15,000円", "15,000円"], ["届いた豆", "前川コーヒー", "前川コーヒーのみ"]], 2),
      note: "豆の量も<b>値段も去年と同じ</b>。届いているのは前川コーヒーの豆だけ。" },
    { id: "beans", spot: "store", name: "豆の袋",
      doc: `<div class="bags"><span>前川コーヒー<br>ブレンド用</span><span>前川コーヒー<br>ブレンド用</span><span>前川コーヒー<br>深煎り</span></div><p class="cap">山海物産の袋は1つもない</p>`,
      note: "棚の豆は<b>全部 前川コーヒー</b>。山海物産の豆は1袋もない。" },
    { id: "wine", spot: "store", name: "酒屋の納品書",
      doc: L("納品書　潮見酒店", [["10/31", "白ワイン", "12本"], ["10/31", "赤ワイン", "12本"], ["", "合計", "43,200円"]]),
      note: "ワインを24本。昼の喫茶店で、こんなに使うだろうか。" },
    /* 厨房 */
    { id: "clean", spot: "kitchen", name: "清掃チェック表",
      doc: L("清掃チェック 11月", [["11/1（金）", "19:10 済"], ["11/2（土）", "23:20 済"], ["11/3（日）", "19:05 済"]], 1),
      note: "土曜日だけ、片づけが<b>夜11時20分</b>。" },
    { id: "fridge", spot: "kitchen", name: "冷蔵庫の温度記録",
      doc: L("冷蔵庫 温度", [["朝", "3℃"], ["夕方", "4℃"]]),
      note: "毎日きちんと記録している。特に気になる点はない。" },
    { id: "recipe", spot: "kitchen", name: "レシピノート",
      doc: `<div class="memo-note hand"><b>ナポリタン</b><span>ケチャップ多め、最後にバター</span></div>`,
      note: "料理のメモ。特に気になる点はない。" }
  ];

  const doc = (id) => docs.find((d) => d.id === id);
  const spot = (id) => spots.find((s) => s.id === id);
  const result = { sales: 153, cost: 180, before: -57, after: 276 };

  return { LIMIT, tancho, statement, claims, areas, spots, docs, doc, spot, result };
})();
