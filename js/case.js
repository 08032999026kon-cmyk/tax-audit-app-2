/* 事件データ（すべて架空）　リフォーム会社「白洲リフォーム株式会社」（社長 白洲 守）
 * 答え：①現金でもらった工事代（6件・180万円）を帳簿に載せず、金庫に隠した（売上除外）
 *       ②「海野工業」への外注費 30万円×8回＝240万円をでっち上げ、家族名義の口座に振り込んだ（架空経費）
 * v6：事務所の机・棚・壁などに資料31点。班で「どの資料を見れば確かめられるか」当たりの付け方を相談し、
 *     各自が1人6点まで見る → 班で持ち寄り、班長が言い分ごとに決め手の資料を1つ選んで社長に示す。
 */
window.CASE = (function () {
  /* 1人が見られる資料の数 */
  const LIMIT = 6;

  const company = { name: "白洲リフォーム株式会社", short: "白洲リフォーム", boss: "白洲 守", kind: "家の修理やリフォームをする小さな会社" };

  /* ---------- 端緒（たんちょ）：決算書などから気づく不審な点 ---------- */
  const tancho = [
    { big: "今期だけ赤字", text: "工事の数は去年とほぼ同じなのに、もうけが −40万円。" },
    { big: "外注費が 240万円 増えた", text: "外注費＝ほかの会社に工事を頼んだ代金。仕事の量は同じなのに、急に増えている。" },
    { big: "新しい外注先「海野工業」", text: "今期から取引が始まり、ちょうど240万円を支払っている。" },
    { big: "「現金払いなら5%引き」", text: "会社のチラシで、現金で払うお客さんを集めている。" }
  ];

  /* 決算書（スクリーンとスマホで同じものを見せる） */
  const statement = `<table class="fs"><thead><tr><th>（万円）</th><th>前々期</th><th>前期</th><th>今期</th></tr></thead><tbody>
    <tr><th>売上</th><td>5,240</td><td>5,310</td><td>5,130</td></tr>
    <tr><th>材料費</th><td>1,830</td><td>1,850</td><td>1,800</td></tr>
    <tr><th>外注費</th><td>920</td><td>930</td><td class="mark">1,170</td></tr>
    <tr><th>人件費</th><td>1,420</td><td>1,440</td><td>1,450</td></tr>
    <tr><th>家賃・その他</th><td>710</td><td>720</td><td>750</td></tr>
    <tr class="total"><th>所得（もうけ）</th><td>360</td><td>370</td><td class="mark">−40</td></tr></tbody></table>
    <p class="cap">外注費＝ほかの会社に工事の一部を頼んだ代金。</p>`;

  /* ---------- 社長の言い分（これを証拠でくずす） ---------- */
  // ok：決め手になる資料。trap：社長の言い分と食い違わない資料への特別な返事
  const claims = [
    { id: "A", short: "工事は帳簿にあるだけ", text: "工事は、帳簿に載っているもので全部です。",
      ok: ["receiptbook", "board", "estimate", "album", "letter", "delivery", "memo"],
      win: "……山田さんの浴室まで。わ、分かりました。現金でもらった工事は、帳簿に載せていませんでした。",
      miss: "それが帳簿と何の関係があるんです？",
      trap: { ledger: "ほら、工事台帳にきちんと全部書いてあるでしょう。", license: "許可証があるから何だと言うんです？", flyer: "現金で払うお客さんが多いだけですよ。" },
      why: "帳簿に載っていない「山田様の浴室工事」の跡が残る資料ならどれでもくずせる：領収書の控え・ホワイトボードの予定・見積書の控え・工事写真・お礼の手紙・材料の納品書・電話メモ。",
      hint: ["帳簿に載っていない工事の跡が、どこかに残っていない？", "予定・見積もり・写真・材料の届け先など、工事をすると必ず残るものを探そう。"] },
    { id: "B", short: "現金も全部銀行へ", text: "現金でいただいた工事代も、全部銀行に入れています。",
      ok: ["safe"],
      win: "……その封筒まで。はい、現金の工事代は銀行に入れずに、金庫にしまっていました。",
      miss: "ふふ、それで何が分かるんです？ お金は全部銀行ですよ。",
      trap: { bank: "通帳を見てください。ちゃんと入金しているでしょう？", receiptbook: "その領収書のお金も、ちゃんと銀行に入れましたよ。" },
      why: "金庫の「現金工事」の封筒とノート。銀行に入れずに隠していた現金が、そのまま残っていた。",
      hint: ["銀行に入れなかった現金は、どこに置いておく？", "お金をしまっておけそうな場所を、社長に開けてもらおう。"] },
    { id: "C", short: "外注費は本物", text: "外注費は、海野工業さんに実際に工事をお願いした代金です。",
      ok: ["bank", "blank", "nippou"],
      win: "……そこまで。海野工業には何も頼んでいません。請求書は、私が書きました。",
      miss: "外注なんて、どこの会社でもやっていることですよ。",
      trap: { invoices: "ほら、請求書は全部そろっていますよ。", bizcard: "海野工業さんの名刺ですよ。それが何か？", lastyear: "去年は頼まなかっただけです。" },
      why: "通帳（外注費の振込先が社長の家族名義）・机の白紙の請求書とハンコ・作業日報（海野工業の人は一度も現場に来ていない）のどれでもくずせる。",
      hint: ["海野工業が本当に工事をしたのか、お金が本当に海野工業に行ったのか、確かめられる資料は？", "お金の出入り、現場の人の記録、机の中を見てみよう。"] }
  ];

  /* ---------- 事務所の中：場所（社長に承諾をもらう単位）と、そこにある資料 ---------- */
  const areas = [
    { id: "office", name: "事務所", bg: "office" },
    { id: "guest", name: "応接コーナー", bg: "office" },
    { id: "back", name: "資材置き場・休憩室", bg: "office" }
  ];
  // open:true は社長に開けてもらう場所
  const spots = [
    { id: "top", area: "office", name: "社長の机の上", ask: "机の上の書類を見せていただけますか。", ok: "どうぞ。散らかっていますがね。" },
    { id: "drawer", area: "office", name: "社長の机の引き出し", open: true, ask: "机の引き出しを開けて、中を見せていただけますか。", ok: "……か、構いませんよ。（社長が鍵で引き出しを開ける）" },
    { id: "acct", area: "office", name: "経理の机", ask: "経理の机の帳簿を見せていただけますか。", ok: "帳簿は全部、私がつけています。どうぞ。" },
    { id: "wall", area: "office", name: "事務所の壁", ask: "壁のホワイトボードや掲示物を拝見してもよろしいですか。", ok: "……どうぞ。" },
    { id: "cabinet", area: "office", name: "書類棚", ask: "書類棚のファイルを見せていただけますか。", ok: "古いものばかりですよ。どうぞ。" },
    { id: "safe", area: "office", name: "金庫", open: true, ask: "金庫を開けて、中を見せていただけますか。", ok: "……釣り銭と私物だけですよ。（社長がしぶしぶ金庫を開ける）" },
    { id: "guest", area: "guest", name: "応接テーブル", ask: "応接テーブルのものを拝見してもよろしいですか。", ok: "お客さん用のものですよ。どうぞ。" },
    { id: "store", area: "back", name: "資材置き場", ask: "資材置き場の書類を見せていただけますか。", ok: "材料しかありませんよ。どうぞ。" },
    { id: "rest", area: "back", name: "職人の休憩室", ask: "休憩室の記録を拝見してもよろしいですか。", ok: "職人たちの部屋ですよ。どうぞ。" }
  ];

  const L = (cap, rows, hl) => `<table class="ledger"><caption>${cap}</caption>${rows.map((r, i) => `<tr class="${hl === i ? "hl" : ""}">${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</table>`;
  const docs = [
    /* 社長の机の上 */
    { id: "bank", spot: "top", name: "預金通帳",
      doc: `<table class="ledger bank"><caption>普通預金　白洲リフォーム</caption><tr><th>日付</th><th>摘要</th><th>出金</th><th>入金</th></tr>
        <tr><td>10/31</td><td>振込入金 佐藤様</td><td></td><td>860,000</td></tr>
        <tr class="hl"><td>11/5</td><td>振込 シラス ミチコ</td><td>300,000</td><td></td></tr>
        <tr><td>11/5</td><td>振込 浜辺建材</td><td>412,000</td><td></td></tr>
        <tr class="hl"><td colspan="4">海野工業への外注費8回は、すべて「シラス ミチコ」名義の口座へ振り込まれている</td></tr></table>`,
      note: "海野工業に払ったはずの外注費が、<b>社長と同じ名字「シラス ミチコ」名義の口座</b>に振り込まれている。" },
    { id: "invoices", spot: "top", name: "外注費の請求書つづり",
      doc: L("海野工業からの請求書", [["5月", "外注工事", "300,000"], ["6月", "外注工事", "300,000"], ["…", "", ""], ["8回", "計", "2,400,000"]], 3) + `<div class="receipt-mini">請求書　¥300,000-　海野工業<span class="hanko">海野</span></div>`,
      note: "海野工業から<b>30万円ずつ8回</b>の請求書。全部そろっている。" },
    { id: "memo", spot: "top", name: "電話のメモ",
      doc: `<div class="memo-note hand"><b>TEL</b><span>山田様　浴室の改修</span><span>10/20〜10/24</span><span>現金で → 5%引き</span></div>`,
      note: "<b>山田様の浴室工事</b>を、10月20日から<b>現金払い</b>で受けたメモ。" },
    { id: "bizcard", spot: "top", name: "名刺の束",
      doc: `<div class="biz"><small>海野工業</small><b>代表 海野 一郎</b><span>浜辺市潮見町3-4-5 潮見ハイツ201</span></div>`,
      note: "海野工業の名刺。住所はアパートの一室だ。" },
    { id: "news", spot: "top", name: "業界新聞",
      doc: `<div class="poster plain"><b>住まいの新聞</b><span>浴室リフォームの需要、今年も好調</span></div>`,
      note: "ただの新聞。特に気になる点はない。" },
    /* 社長の机の引き出し */
    { id: "blank", spot: "drawer", name: "請求書の束とハンコ",
      doc: `<div class="receipt-blank"><b>請 求 書</b><span>白洲リフォーム 様</span><span>¥　　　　　-</span><span>但　外注工事</span><em>海野工業<span class="hanko">海野</span></em><small>× 12枚（白紙）＋「海野」のハンコ</small></div>`,
      note: "海野工業の<b>白紙の請求書</b>と、<b>「海野」のハンコ</b>が社長の引き出しに。" },
    { id: "photo", spot: "drawer", name: "古い写真",
      doc: `<div class="photo-print"><div class="ph"></div><p>創業記念 2012.4.1</p></div>`,
      note: "会社を始めたときの記念写真。特に気になる点はない。" },
    /* 経理の机 */
    { id: "ledger", spot: "acct", name: "工事台帳（売上の帳簿）",
      doc: L("工事台帳 10月", [["佐藤様", "外壁塗装", "860,000"], ["田村様", "キッチン", "1,240,000"], ["鈴木様", "屋根修理", "380,000"]]),
      note: "10月の工事は3件。<b>山田様の名前はない</b>。" },
    { id: "receiptbook", spot: "acct", name: "領収書の控え帳",
      doc: `<div class="receipt-blank"><b>領収書（控え）</b><span>山田 様</span><span>¥320,000-</span><span>但　浴室改修工事代　現金にて</span><em>白洲リフォーム<span class="hanko">白洲</span></em><small>10/24</small></div>`,
      note: "<b>山田様から浴室工事代32万円を現金で</b>受け取った控え。" },
    { id: "payroll", spot: "acct", name: "給与の台帳",
      doc: L("給与台帳 10月", [["職人 3名", "計 1,050,000"], ["事務 1名", "210,000"]]),
      note: "毎月ほぼ同じ。特に気になる点はない。" },
    { id: "utility", spot: "acct", name: "電気代の請求書",
      doc: L("電気料金のお知らせ", [["10月分", "28,400円"], ["前年同月", "28,100円"]]),
      note: "去年とほぼ同じ。特に気になる点はない。" },
    /* 事務所の壁 */
    { id: "board", spot: "wall", name: "ホワイトボードの予定表",
      doc: L("10月の現場", [["10/1〜", "佐藤様 外壁"], ["10/9〜", "田村様 キッチン"], ["10/20〜", "山田様 浴室"], ["10/27〜", "鈴木様 屋根"]], 2),
      note: "10月の現場に<b>「山田様 浴室」</b>。工事台帳には載っていない現場だ。" },
    { id: "license", spot: "wall", name: "建設業の許可証",
      doc: `<div class="cert"><b>建設業許可証</b><span>白洲リフォーム株式会社</span><span>内装仕上工事業</span></div>`,
      note: "ふつうの許可証。特に気になる点はない。" },
    { id: "calendar", spot: "wall", name: "カレンダー",
      doc: `<div class="poster plain"><b>10月</b><span>定休日：日曜</span></div>`,
      note: "定休日が書いてあるだけ。特に気になる点はない。" },
    { id: "safety", spot: "wall", name: "安全標語のポスター",
      doc: `<div class="poster"><b>安全第一</b><span>声かけ・指さし・確認よし！</span></div>`,
      note: "ただの標語。特に気になる点はない。" },
    /* 書類棚 */
    { id: "estimate", spot: "cabinet", name: "見積書の控え",
      doc: L("見積書（控え）山田様", [["浴室改修一式", "336,000"], ["現金払い 5%引き", "−16,000"], ["合計", "320,000"]], 2),
      note: "<b>山田様の浴室工事 32万円</b>（現金払いで値引き）の見積書。" },
    { id: "album", spot: "cabinet", name: "工事写真のアルバム",
      doc: `<div class="photo-print"><div class="ph"></div><p>10/24 山田様邸 浴室 完成</p></div>`,
      note: "<b>山田様の家の浴室が完成した</b>写真。" },
    { id: "contracts", spot: "cabinet", name: "契約書のファイル",
      doc: L("工事請負契約書（一覧）", [["佐藤様", "外壁塗装"], ["田村様", "キッチン"], ["鈴木様", "屋根修理"]]),
      note: "契約書は台帳と同じ3件。特に気になる点はない。" },
    { id: "lastyear", spot: "cabinet", name: "前期の帳簿",
      doc: L("前期 外注費", [["浜辺設備", "520,000"], ["潮見電工", "410,000"], ["海野工業", "取引なし"]]),
      note: "前期は海野工業との取引がなかった。" },
    { id: "car", spot: "cabinet", name: "車検証",
      doc: `<div class="cert"><b>自動車検査証</b><span>軽トラック 1台</span></div>`,
      note: "社用車の書類。特に気になる点はない。" },
    /* 金庫 */
    { id: "safe", spot: "safe", name: "「現金工事」の封筒とノート",
      doc: `<div class="envelope"><span>現金</span><small>「現金工事」　裏に鉛筆で「山田」</small><b>¥320,000</b></div>
        <table class="ledger hand small"><caption>小さなノート</caption><tr><td>4月 小林様</td><td>280,000</td></tr><tr><td>6月 森田様</td><td>350,000</td></tr><tr><td>…</td><td>…</td></tr><tr><td>10月 山田様</td><td>320,000</td></tr><tr class="hl"><td>6件 計</td><td>1,800,000</td></tr></table>`,
      note: "「現金工事」の封筒に<b>現金32万円</b>（裏に「山田」）。ノートには<b>6件・計180万円</b>。" },
    { id: "deed", spot: "safe", name: "登記の書類",
      doc: `<div class="cert"><b>履歴事項全部証明書</b><span>白洲リフォーム株式会社</span><span>代表取締役 白洲 守</span></div>`,
      note: "会社の登記の書類。特に気になる点はない。" },
    /* 応接テーブル */
    { id: "flyer", spot: "guest", name: "会社のチラシ",
      doc: `<div class="poster"><b>白洲リフォーム</b><span>浴室・キッチン・外壁</span><span class="big">現金払いなら 5%引き！</span></div>`,
      note: "「<b>現金払いなら5%引き</b>」と書いてある。" },
    { id: "letter", spot: "guest", name: "お客さんからの手紙",
      doc: `<div class="memo-note hand"><b>白洲リフォームさまへ</b><span>浴室がとてもきれいになりました。</span><span>ありがとうございました。　山田</span></div>`,
      note: "<b>山田様から浴室工事のお礼</b>の手紙。" },
    { id: "magazine", spot: "guest", name: "住宅雑誌",
      doc: `<div class="poster plain"><b>月刊 すまいと暮らし</b><span>特集：収納のアイデア</span></div>`,
      note: "ただの雑誌。特に気になる点はない。" },
    /* 資材置き場 */
    { id: "delivery", spot: "store", name: "材料の納品書",
      doc: L("納品書　浜辺建材", [["10/19", "浴室パネル 一式", "届け先：山田様邸"], ["10/26", "屋根材", "届け先：鈴木様邸"]], 0),
      note: "<b>山田様の家に浴室の材料を届けた</b>納品書。" },
    { id: "tools", spot: "store", name: "工具の貸出表",
      doc: L("工具の貸出", [["電動ドリル", "職人A"], ["脚立", "職人B"]]),
      note: "工具の管理表。特に気になる点はない。" },
    { id: "scrap", spot: "store", name: "端材のリスト",
      doc: L("端材", [["合板", "4枚"], ["タイル", "1箱"]]),
      note: "余った材料のメモ。特に気になる点はない。" },
    /* 職人の休憩室 */
    { id: "nippou", spot: "rest", name: "職人の作業日報",
      doc: L("作業日報（今期・抜き書き）", [["現場に来た人", "白洲リフォームの職人 3名のみ"], ["海野工業の人", "一度も記録なし"]], 1),
      note: "どの現場にも、<b>海野工業の人が来た記録は一度もない</b>。" },
    { id: "attendance", spot: "rest", name: "出勤簿",
      doc: L("出勤簿 10月", [["職人A", "22日"], ["職人B", "21日"], ["職人C", "22日"]]),
      note: "ふつうの出勤簿。特に気になる点はない。" },
    { id: "bento", spot: "rest", name: "弁当の注文表",
      doc: L("弁当の注文", [["月", "3個"], ["火", "3個"], ["水", "4個"]]),
      note: "ただの注文表。特に気になる点はない。" }
  ];

  const doc = (id) => docs.find((d) => d.id === id);
  const spot = (id) => spots.find((s) => s.id === id);
  const result = { sales: 180, cost: 240, before: -40, after: 380 };

  return { LIMIT, company, tancho, statement, claims, areas, spots, docs, doc, spot, result };
})();
