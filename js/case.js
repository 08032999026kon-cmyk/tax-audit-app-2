/* 事件データ（すべて架空）　喫茶店「浜風珈琲」（株式会社浜風珈琲・社長 白洲 守）
 * 答え：①土曜夜の貸切パーティーの売上をレジに通さず金庫に隠した（売上除外 153万円＝18回）
 *       ②山海物産の白紙の領収書で、豆の仕入れ30万円×6回をでっち上げた（架空経費 180万円）
 * 担当（班長・売上・現金・仕入れ）ごとに見られる物が違う。証拠には「番号」があり、口で伝え合う。
 */
window.CASE = (function () {
  const yen = (n) => n.toLocaleString("ja-JP");

  /* ---------- 担当 ---------- */
  const roles = {
    lead: { name: "班長", sub: "調査の責任者", color: "#f2a53a", mark: "班",
      desc: "決算書の全体を見て、最後に社長へ説明する。仲間から証拠の番号を聞き取って組み立てる。" },
    sales: { name: "売上担当", sub: "売上を調べる", color: "#e2553f", mark: "売",
      desc: "レジや予約の記録を調べる。売上について社長に質問できる。" },
    cash: { name: "現金担当", sub: "お金の流れを調べる", color: "#4fb3a9", mark: "現",
      desc: "通帳や金庫を調べる。現金の扱いについて社長に質問できる。" },
    buy: { name: "仕入れ担当", sub: "経費を調べる", color: "#8f8cf0", mark: "仕",
      desc: "仕入れの帳簿や在庫を調べる。仕入れ先について社長に質問できる。" }
  };

  /* ---------- 第1幕：準備調査（担当ごとの資料と「気になる点」） ---------- */
  const prep = {
    lead: {
      title: "決算書（3期くらべ）", code: "代0",
      html: `<table class="fs"><thead><tr><th>（万円）</th><th>前々期</th><th>前期</th><th>今期</th></tr></thead><tbody>
        <tr><th>売上</th><td>1,820</td><td>1,850</td><td data-hit="sales">1,790</td></tr>
        <tr><th>仕入れ</th><td>564</td><td>574</td><td data-hit="buy">752</td></tr>
        <tr class="sub"><th>原価率</th><td>31.0%</td><td>31.0%</td><td data-hit="rate">42.0%</td></tr>
        <tr><th>人件費</th><td>610</td><td>620</td><td data-hit="staff">625</td></tr>
        <tr><th>家賃・その他</th><td>456</td><td>460</td><td>470</td></tr>
        <tr class="total"><th>所得（もうけ）</th><td>190</td><td>196</td><td data-hit="loss">−57</td></tr></tbody></table>
        <p class="cap">原価率＝売上に対する仕入れの割合。喫茶店ではふつう30%前後。</p>`,
      hits: {
        loss: { good: true, text: "今期だけ<b>赤字</b>。お客さんが減ったわけでもないのに？" },
        rate: { good: true, text: "<b>原価率が31%→42%</b>。値段も席数も同じなのに、仕入れの割合だけ急に上がっている。" },
        sales: { good: false, text: "売上は少し下がっただけ。これだけでは何とも言えない。" },
        buy: { good: true, text: "仕入れが<b>約180万円</b>増えている。何が増えたのかな。" },
        staff: { good: false, text: "人件費はほとんど変わっていない。" }
      }
    },
    sales: {
      title: "月ごとの売上と客数／お店のホームページ", code: "売0",
      html: `<div class="mini-chart" aria-label="月ごとの客数はほぼ横ばい">
          <div class="bars">${[96, 98, 97, 99, 100, 98, 97, 99, 98, 100, 99, 97].map((v, i) => `<i style="--h:${v}%"><span>${i + 1}</span></i>`).join("")}</div>
          <p>客数：毎月ほぼ同じ（1日 約60人）</p></div>
        <div class="web" data-hit="web"><div class="web-bar">hamakaze-coffee.example</div>
          <h4>浜風珈琲からのお知らせ</h4><p><b>4月より、土曜の夜は貸切パーティー承ります！</b><br>（20名さままで・コース 4,250円）</p></div>
        <table class="fs small"><tr><th>時間帯別の売上（今期）</th><td>朝〜夕方</td><td data-hit="night">夜（19時〜）</td></tr>
        <tr><th></th><td>1,790万円</td><td>0円</td></tr></table>`,
      hits: {
        web: { good: true, text: "4月から<b>土曜の夜の貸切</b>を始めたらしい。" },
        night: { good: true, text: "なのに<b>夜の売上が0円</b>。貸切の売上はどこへ？" }
      }
    },
    cash: {
      title: "支払い方法のうちわけ", code: "現0",
      html: `<table class="fs"><thead><tr><th>仕入れ先</th><th>今期の金額</th><th>支払い方法</th></tr></thead><tbody>
        <tr><td>丸浜食品</td><td>312万円</td><td>銀行振込</td></tr>
        <tr><td>海辺ベーカリー</td><td>140万円</td><td>銀行振込</td></tr>
        <tr><td>前川コーヒー（豆）</td><td>120万円</td><td>銀行振込</td></tr>
        <tr data-hit="sankai"><td><b>山海物産（豆）</b></td><td><b>180万円</b></td><td><b>現金</b></td></tr></tbody></table>
        <p class="cap">売上はほとんどが現金。毎日の入金額は、レジの合計と同じと説明されている。</p>`,
      hits: { sankai: { good: true, text: "<b>山海物産だけ現金払い</b>。しかも今期から急に180万円。" } }
    },
    buy: {
      title: "原価率の動きと同業の目安", code: "仕0",
      html: `<div class="line-chart" aria-label="原価率は31%から42%に上がった">
          <svg viewBox="0 0 300 140"><line x1="30" y1="110" x2="290" y2="110" class="ax"/>
          <line x1="30" y1="80" x2="290" y2="80" class="ref"/><text x="292" y="76" class="reft" text-anchor="end">同業の目安 30%</text>
          <polyline points="60,78 160,78 260,36" class="ln"/><circle cx="60" cy="78" r="4"/><circle cx="160" cy="78" r="4"/><circle cx="260" cy="36" r="6" class="hot" data-hit="rate"/>
          <text x="60" y="128" text-anchor="middle">前々期</text><text x="160" y="128" text-anchor="middle">前期</text><text x="260" y="128" text-anchor="middle">今期</text>
          <text x="60" y="68" text-anchor="middle">31%</text><text x="160" y="68" text-anchor="middle">31%</text><text x="260" y="24" text-anchor="middle" class="hot-t">42%</text></svg></div>
        <table class="fs small"><tr><th>新しい仕入れ先</th><td data-hit="new">山海物産（今期から）180万円</td></tr></table>`,
      hits: {
        rate: { good: true, text: "<b>今期だけ原価率が42%</b>。同業の目安（30%前後）よりかなり高い。" },
        new: { good: true, text: "今期からの<b>新しい仕入れ先</b>が180万円。増えた分とほぼ同じ額だ。" }
      }
    }
  };

  const hypotheses = [
    { id: "h1", text: "売上の一部が、帳簿に載っていないのでは？", good: true, note: "夜の貸切の売上はどこへ行ったのか、確かめよう。" },
    { id: "h2", text: "仕入れが、実際より多く記録されているのでは？", good: true, note: "現金払いの山海物産が気になる。" },
    { id: "h3", text: "豆が値上がりしただけでは？", good: "maybe", note: "あり得る。仮説は現場で確かめるもの。入荷の記録を見よう。" },
    { id: "h4", text: "家賃が高すぎるのでは？", good: false, note: "家賃はごまかしとは関係がなさそうだ。" },
    { id: "h5", text: "人を雇いすぎているのでは？", good: false, note: "人件費はほとんど変わっていない。" }
  ];

  /* ---------- 第2幕：臨場（質問と、調べられる物） ---------- */
  // cost は調査の持ち時間（分）。open:true は「社長に開けてもらう」物。
  const questions = {
    lead: [
      { id: "q-hours", q: "お店の営業時間を教えてください。", a: "朝8時から夕方7時までです。夜はやっていませんよ。", cost: 10 },
      { id: "q-books", q: "帳簿はどなたがつけていますか。", a: "全部、私がつけています。税理士さんには年に一度見てもらうだけです。", cost: 10 },
      { id: "q-staff", q: "従業員は何人いらっしゃいますか。", a: "私とアルバイトが2人です。", cost: 10 }
    ],
    sales: [
      { id: "q-night", q: "夜の営業はしていますか。", a: "夜は閉めています。", key: "S1", cost: 10 },
      { id: "q-party", q: "ホームページにある貸切パーティーは、実際にやっていますか。", a: "載せてはみたんですがね。申し込みはほとんどありませんよ。", cost: 10 },
      { id: "q-reg", q: "売上はどのように記録していますか。", a: "全部レジを通しています。レジは閉店のときに締めます。", cost: 10 }
    ],
    cash: [
      { id: "q-deposit", q: "お客さんからの現金は、どうしていますか。", a: "毎日、全部銀行に入れています。", key: "S2", cost: 10 },
      { id: "q-safe", q: "金庫には何が入っていますか。", a: "釣り銭と、私の私物だけですよ。", cost: 10 },
      { id: "q-who", q: "お金の管理は、どなたがしていますか。", a: "私だけです。アルバイトには触らせません。", cost: 10 }
    ],
    buy: [
      { id: "q-pay", q: "山海物産さんへの支払いは、どのようにしていますか。", a: "現金で払って、その場で領収書をもらっています。", key: "S3", cost: 10 },
      { id: "q-price", q: "今期は仕入れが増えていますが、なぜでしょう。", a: "豆がだいぶ値上がりしましてね。困ったものです。", key: "S4", cost: 10 },
      { id: "q-sankai", q: "山海物産さんとは、いつからの取引ですか。", a: "今年からです。知り合いの紹介でね。", cost: 10 }
    ]
  };

  const statements = {
    // num は「発言の番号」。聞いた人が班長に口で伝え、班長が入力すると検討の板に出る
    S1: { text: "夜は閉めています。", by: "sales", num: "31" },
    S2: { text: "毎日、全部銀行に入れています。", by: "cash", num: "58" },
    S3: { text: "現金で払って、その場で領収書をもらっています。", by: "buy", num: "74" },
    S4: { text: "豆がだいぶ値上がりしましてね。", by: "buy", num: "16" }
  };

  const places = {
    lead: [
      { id: "shift", code: "代1", where: "事務室の壁", name: "アルバイトのシフト表", cost: 20, consent: "壁のシフト表を見せていただけますか。", ok: "……どうぞ。",
        doc: () => `<table class="ledger shift"><caption>11月 シフト表</caption><tr><th>日</th><th>佐藤</th><th>田中</th></tr>
          <tr><td>11/1（金）</td><td>8–15</td><td>12–19</td></tr><tr class="hl"><td>11/2（土）</td><td>8–15</td><td><b>19–23</b></td></tr>
          <tr><td>11/3（日）</td><td>8–15</td><td>12–19</td></tr><tr><td>…</td><td></td><td></td></tr>
          <tr class="hl"><td>11/9（土）</td><td>12–19</td><td><b>19–23</b></td></tr></table>`,
        note: "土曜の<b>19時〜23時</b>にアルバイトが入っている。夜は閉めているはずでは？" },
      { id: "photo", code: "代2", where: "事務室の棚", name: "開店の日の写真", cost: 20, decoy: true, consent: "棚の写真を拝見してもよろしいですか。", ok: "開店の日の写真ですよ。どうぞ。",
        doc: () => `<div class="photo-print"><div class="ph"></div><p>祝 開店 2019.10.15</p></div>`,
        note: "開店の日の記念写真。今回の調査には関係なさそうだ。" }
    ],
    sales: [
      { id: "register", code: "売1", where: "店内のレジ", name: "レジの日計表", cost: 20, consent: "レジの記録を見せていただけますか。", ok: "どうぞ。毎日きちんと締めていますよ。",
        doc: () => `<div class="receipt-roll"><b>日計表 11/2（土）</b><span>ブレンド ×64</span><span>ランチ ×21</span><span>ケーキセット ×18</span><span>…</span><b>合計 ¥68,400</b><em>レジ締め 18:58</em></div>`,
        note: "レジは毎日<b>18:58</b>に締められている。夜の売上は1円も入っていない。" },
      { id: "calendar", code: "売2", where: "店内の壁", name: "予約カレンダー", cost: 20, consent: "壁のカレンダーを拝見してもよろしいですか。", ok: "ただのカレンダーですよ。",
        doc: () => `<div class="calendar"><b>11月</b><div class="cal">${Array.from({ length: 30 }, (_, i) => { const d = i + 1, sat = (d + 4) % 7 === 6; return `<span class="${sat ? "sat" : ""}">${d}${sat && d !== 30 ? '<i>貸切</i>' : ""}</span>`; }).join("")}</div><p class="hand">4月から 貸切 計18回</p></div>`,
        note: "土曜日に<b>「貸切」</b>の書き込み。4月から<b>18回</b>と手書きのメモもある。" },
      { id: "trash", code: "売3", where: "カウンター下のゴミ箱", name: "手書きの注文票", cost: 20, consent: "ゴミ箱の中を確認させていただいてもよろしいですか。", ok: "ゴ、ゴミ箱？ ……まあ、どうぞ。",
        doc: () => `<div class="order-slip hand"><div>11/2（土）19:30〜</div><div>貸切パーティー　山田様 20名</div><div>コース 4,250円 × 20名</div><div class="big">合計 ¥85,000</div><div>現金にて受領 <span class="hanko">済</span></div></div>`,
        note: "11月2日の夜に<b>85,000円</b>の貸切。<b>現金で受け取り済み</b>。" },
      { id: "menu", code: "売4", where: "カウンター", name: "メニュー表", cost: 20, decoy: true, consent: "メニュー表を拝見してもよろしいですか。", ok: "どうぞどうぞ。",
        doc: () => `<table class="ledger"><tr><td>ブレンド</td><td>¥480</td></tr><tr><td>ランチセット</td><td>¥1,200</td></tr><tr><td>ケーキセット</td><td>¥950</td></tr></table>`,
        note: "値段は前の年と同じ。ここには手がかりはなさそうだ。" }
    ],
    cash: [
      { id: "bank", code: "現1", where: "事務室の机の上", name: "預金通帳", cost: 20, consent: "預金通帳を見せていただけますか。", ok: "どうぞ。入金はきちんとしています。",
        doc: () => `<table class="ledger bank"><caption>普通預金　浜風珈琲</caption><tr><th>日付</th><th>摘要</th><th>出金</th><th>入金</th></tr>
          <tr><td>11/1</td><td>入金</td><td></td><td>61,200</td></tr><tr><td>11/2</td><td>入金</td><td></td><td>68,400</td></tr>
          <tr><td>11/5</td><td>振込 丸浜食品</td><td>264,000</td><td></td></tr><tr><td>11/5</td><td>振込 前川コーヒー</td><td>98,000</td><td></td></tr>
          <tr class="hl"><td colspan="4">山海物産への支払いも、30万円の引き出しも、1年間一度もない</td></tr></table>`,
        note: "入金額は<b>レジの合計とぴったり同じ</b>。<b>山海物産に払った30万円</b>の出どころが、通帳のどこにもない。" },
      { id: "safe", code: "現2", where: "事務室の金庫", name: "「別」の封筒とノート", cost: 30, open: true, consent: "金庫を開けて、中を見せていただけますか。", ok: "……釣り銭と私物だけですよ。（社長がしぶしぶ金庫を開ける）",
        doc: () => `<div class="envelope"><span>別</span><small>裏に鉛筆で「11/2」</small><b>¥85,000</b></div>
          <table class="ledger hand small"><caption>小さなノート</caption><tr><td>4/6 貸切</td><td>78,000</td></tr><tr><td>4/20 貸切</td><td>91,000</td></tr><tr><td>…</td><td>…</td></tr><tr><td>11/2 貸切</td><td>85,000</td></tr><tr class="hl"><td>18回 計</td><td>1,530,000</td></tr></table>`,
        note: "「別」の封筒に<b>85,000円</b>（裏に11/2）。ノートには<b>貸切18回・計153万円</b>。" },
      { id: "change", code: "現3", where: "レジの引き出し", name: "釣り銭", cost: 20, decoy: true, consent: "レジの釣り銭を確認させていただいてもよろしいですか。", ok: "どうぞ。",
        doc: () => `<table class="ledger"><tr><td>千円札</td><td>20枚</td></tr><tr><td>硬貨</td><td>¥8,640</td></tr></table>`,
        note: "ふつうの釣り銭。気になる点はない。" }
    ],
    buy: [
      { id: "ledger", code: "仕1", where: "事務室の本棚", name: "仕入帳と山海物産の領収書", cost: 20, consent: "仕入帳と領収書を見せていただけますか。", ok: "どうぞ。領収書は全部そろっていますよ。",
        doc: () => `<table class="ledger"><caption>仕入帳（山海物産）</caption><tr><td>5/10</td><td>豆</td><td>300,000</td><td>現金</td></tr><tr><td>6/14</td><td>豆</td><td>300,000</td><td>現金</td></tr><tr><td>…</td><td></td><td></td><td></td></tr><tr class="hl"><td>6回</td><td>計</td><td>1,800,000</td><td></td></tr></table>
          <div class="receipt-mini hand">領収書　¥300,000-　山海物産<span class="hanko">山海</span></div>`,
        note: "30万円ずつ<b>6回、計180万円</b>。領収書の字が、社長のメモの字と似ている……？" },
      { id: "stock", code: "仕2", where: "倉庫の棚", name: "豆の入荷記録", cost: 20, consent: "豆の入荷記録を見せていただけますか。", ok: "豆ですか？ どうぞ。",
        doc: () => `<table class="ledger"><caption>豆の入荷記録</caption><tr><th></th><th>前期</th><th>今期</th></tr><tr><td>入荷量</td><td>月 3袋</td><td>月 3袋</td></tr><tr class="hl"><td>1袋の値段</td><td>15,000円</td><td>15,000円</td></tr><tr><td>仕入れ先</td><td>前川コーヒー</td><td>前川コーヒーのみ</td></tr></table>`,
        note: "豆の量も<b>値段も前期と同じ</b>。しかも届いているのは前川コーヒーの豆だけ。" },
      { id: "desk", code: "仕3", where: "事務室の机の引き出し", name: "白紙の領収書の束", cost: 30, open: true, consent: "机の引き出しを開けて、中を見せていただけますか。", ok: "……か、構いませんよ。（社長が鍵で引き出しを開ける）",
        doc: () => `<div class="receipt-blank"><b>領 収 書</b><span>　　　　様</span><span>¥　　　　　-</span><span>但</span><em>山海物産株式会社<span class="hanko">山海</span></em><small>× 14枚（使った跡あり）</small></div>`,
        note: "山海物産のハンコが押された<b>白紙の領収書</b>。これがあれば、金額を好きに書けてしまう。" },
      { id: "fridge", code: "仕4", where: "厨房", name: "冷蔵庫の中", cost: 20, decoy: true, consent: "冷蔵庫の中を拝見してもよろしいですか。", ok: "食材しかありませんよ。",
        doc: () => `<table class="ledger"><tr><td>牛乳</td><td>12本</td></tr><tr><td>ケーキ</td><td>3種</td></tr></table>`,
        note: "ふつうの食材。手がかりはない。" }
    ]
  };

  /* ---------- 第3幕：崩す発言と、認めさせる組み合わせ ---------- */
  // need: [Aのどれか, Bのどれか] の2つ（違う担当）がそろうと社長が認める
  const board = [
    { id: "S1", need: [["売3", "売2"], ["代1"]],
      half: "その注文票？ ああ、それはキャンセルになった予約ですよ。",
      win: "……アルバイトのシフトまで。わ、分かりました。夜も、貸切をやっていました。",
      miss: "それが夜の営業と何の関係があるんです？" },
    { id: "S2", need: [["現2"], ["売3"]],
      half: "この封筒は私の個人的なお金です。売上とは関係ありません。",
      win: "注文票と同じ85,000円……。はい、貸切の売上は、銀行に入れずに金庫にしまっていました。",
      miss: "ふふ、それで何が分かるんです？ 現金は全部銀行ですよ。" },
    { id: "S3", need: [["仕3"], ["現1"]],
      half: "その白紙の領収書は、山海さんが置いていっただけ。使ってなんかいませんよ。",
      win: "通帳に30万円の引き出しが一度もない……。払っていません。領収書は、私が書きました。",
      miss: "領収書があるんだから、ちゃんと払っていますよ。" },
    { id: "S4", need: [["仕2"], ["代0", "仕0"]],
      half: "入荷の記録？ 豆は別の倉庫に置いてあるんです。",
      win: "原価率が急に上がったのは……値上がりのせいではありません。",
      miss: "豆の値段なんて、いろいろですからね。" }
  ];

  // 番号 → 名前（第3幕で班長が入力したときに表示する）
  const codes = {};
  Object.keys(prep).forEach((r) => { codes[prep[r].code] = { name: prep[r].title, role: r }; });
  Object.keys(places).forEach((r) => places[r].forEach((p) => { codes[p.code] = { name: p.name, role: r }; }));

  return { yen, roles, prep, hypotheses, questions, statements, places, board, codes, TIME: 90 };
})();
