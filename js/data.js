/* 事件データ（すべて架空）
 * 喫茶店「浜風珈琲」　社長：白洲 守（しらす まもる）
 * 不正：①貸切パーティーの売上85,000円をレジに通さず金庫に隠した（売上除外）
 *       ②コーヒー豆の仕入れ30万円を、白紙の領収書を使ってでっち上げた（架空経費）
 */
window.CASE = {
  title: "浜風珈琲",
  boss: "白洲社長",
  partner: "森先輩",

  /* 社長の主張。answer が正解の証拠。near は「惜しい」証拠への社長の反論 */
  claims: [
    {
      id: "c1",
      label: "売上",
      text: "売上は、全部レジを通して記録しています。",
      answer: "order",
      win: "そ、その注文票は……。ええと、レジを打ち忘れただけで……。",
      wrong: "それが何か？ 売上は全部レジに入っていますよ。",
      near: {
        register: "レジの記録？ 夜は店を閉めているんだから、記録がないのは当然でしょう。",
        calendar: "それは予定を書いただけ。その貸切はキャンセルになったんですよ。",
        menu: "メニューに貸切コースがあっても、やったとは限らないでしょう？"
      },
      solved: "レジを通していない売上があった"
    },
    {
      id: "c2",
      label: "現金",
      text: "お客さんからもらった現金は、その日のうちに全部銀行に入れています。",
      answer: "envelope",
      win: "そ、その封筒は……！ ちょっと預かっているだけで……。",
      wrong: "ふふ、それで何が分かるんです？ 現金は全部銀行ですよ。",
      near: {
        order: "注文票は……まあ、認めましょう。でも、そのお金はちゃんと銀行に入れましたよ。",
        ledger: "パソコンの帳簿を見たでしょう？ 銀行に入れた分はきちんと書いてあります。",
        photo: "開店の写真がどうかしました？"
      },
      solved: "銀行に入れていない現金が金庫にあった"
    },
    {
      id: "c3",
      label: "仕入れ",
      text: "先月の30万円は、コーヒー豆の仕入れ代です。領収書もありますよ。",
      answer: "blank",
      win: "あっ……その領収書の束は……。わ、私が書いたものです……。",
      wrong: "領収書があるんだから、正しい経費ですよ。",
      near: {
        stock: "在庫表？ 豆は別の倉庫に置いてあるんですよ。ここにないのは当然です。",
        ledger: "帳簿にもちゃんと書いてあるでしょう。正しい仕入れです。",
        receipt: "ほら、山海物産の領収書。ハンコもあるし、本物ですよ。"
      },
      solved: "仕入れ先の白紙の領収書を社長が持っていた"
    }
  ],

  /* 調べられる物（spot）と、そこで手に入る証拠（evidence） */
  evidence: {
    receipt: {
      name: "社長が見せた領収書", room: "intro", icon: "receipt",
      html: `<h3>社長が見せた領収書</h3><h2>領収書　山海物産</h2>
        <div class="doc receipt"><div class="r-head">領 収 書</div>
        <div class="r-to">浜風珈琲 様</div><div class="r-amt">¥300,000-</div>
        <div class="r-for">但　コーヒー豆代として</div>
        <div class="r-foot">10月28日　<b>山海物産株式会社</b><span class="hanko">山海</span></div></div>
        <p class="note">社長が「仕入れの証拠」として見せてきた領収書。</p>`
    },
    register: {
      name: "レジの記録", room: "shop", icon: "register",
      html: `<h3>証拠　レジ</h3><h2>レジの記録（11月2日 土曜）</h2>
        <table class="doc"><tr><td>10:12</td><td>ブレンド ×2</td><td>¥960</td></tr>
        <tr><td>12:40</td><td>ランチセット ×6</td><td>¥7,200</td></tr>
        <tr><td>15:05</td><td>ケーキセット ×3</td><td>¥2,850</td></tr>
        <tr><td>…</td><td>ほか 52件</td><td>…</td></tr>
        <tr class="hl"><td>18:58</td><td><b>レジ締め　1日の合計</b></td><td><b>¥68,400</b></td></tr></table>
        <p class="note">この日のレジは <b>18:58</b> に締められている。<b>19時より後の売上は記録されていない。</b></p>`
    },
    order: {
      name: "手書きの注文票", room: "shop", icon: "order", key: true,
      html: `<h3>証拠　ゴミ箱の中</h3><h2>くしゃくしゃの手書き注文票</h2>
        <div class="doc hand crumple"><div>11/2（土）19:30〜</div><div>貸切パーティー　山田様　20名</div>
        <div>貸切コース 4,250円 × 20名</div><div class="big">合計 ¥85,000</div><div>現金で受け取り済み <span class="hanko red">済</span></div></div>
        <p class="note">捨てられていた注文票。11月2日の夜に、<b>85,000円の売上</b>があったようだ。</p>`
    },
    calendar: {
      name: "カレンダー", room: "shop", icon: "calendar",
      html: `<h3>証拠　壁</h3><h2>11月のカレンダー</h2>
        <div class="doc hand">11月2日（土）に赤ペンで<br><b>「夜 貸切　山田様 20名」</b></div>
        <p class="note">11月2日の夜に、貸切の予定があったようだ。</p>`
    },
    menu: {
      name: "メニュー表", room: "shop", icon: "menu",
      html: `<h3>証拠　本棚</h3><h2>メニュー表</h2>
        <table class="doc"><tr><td>ブレンド</td><td>¥480</td></tr><tr><td>ランチセット</td><td>¥1,200</td></tr>
        <tr><td>ケーキセット</td><td>¥950</td></tr><tr class="hl"><td><b>夜の貸切コース（1名）</b></td><td><b>¥4,250</b></td></tr></table>
        <p class="note">夜は貸切営業もしているらしい。</p>`
    },
    key: {
      name: "小さな鍵", room: "shop", icon: "key", item: true,
      html: `<h3>見つけた物　観葉植物の鉢</h3><h2>小さな鍵</h2>
        <div class="doc center"><div class="key-art" aria-hidden="true"></div></div>
        <p class="note">鉢の土に埋められていた。<b>どこかの引き出しの鍵</b>かもしれない。</p>`
    },
    ledger: {
      name: "パソコンの帳簿", room: "office", icon: "pc",
      html: `<h3>証拠　事務室のパソコン</h3><h2>会計ソフトの帳簿</h2>
        <table class="doc"><tr><th>日付</th><th>内容</th><th>金額</th></tr>
        <tr><td>10/28</td><td>仕入れ　山海物産（コーヒー豆）</td><td>¥300,000</td></tr>
        <tr><td>11/2</td><td>売上（レジ）</td><td>¥68,400</td></tr>
        <tr><td>11/4</td><td>銀行に入金</td><td>¥68,400</td></tr></table>
        <p class="note">モニターの端に付箋：<b>「金庫の番号＝お店の誕生日」</b></p>`
    },
    photo: {
      name: "写真立て", room: "office", icon: "photo",
      html: `<h3>証拠　事務室の棚</h3><h2>開店の日の写真</h2>
        <div class="doc center photo-art"><div class="ph-frame"><div class="ph-sky"></div><div class="ph-shop">浜風珈琲</div></div>
        <div class="hand">祝 開店　<b>2019年 10月 15日</b></div></div>
        <p class="note">お店の誕生日は <b>10月15日</b>。</p>`
    },
    stock: {
      name: "豆の在庫表", room: "office", icon: "stock",
      html: `<h3>証拠　段ボールの横</h3><h2>コーヒー豆の入荷記録</h2>
        <table class="doc"><tr><th>月</th><th>入荷</th><th>金額の目安</th></tr>
        <tr><td>8月</td><td>3袋</td><td>約45,000円</td></tr><tr><td>9月</td><td>3袋</td><td>約45,000円</td></tr>
        <tr class="hl"><td>10月</td><td>3袋</td><td>約45,000円</td></tr></table>
        <p class="note">10月も<b>いつもと同じ3袋</b>しか入っていない。30万円分も買ったはずなのに……？</p>`
    },
    envelope: {
      name: "「別」の封筒", room: "office", icon: "envelope", key: true,
      html: `<h3>証拠　金庫の中</h3><h2>「別」と書かれた封筒</h2>
        <div class="doc"><div class="env"><span>別</span></div>
        <table><tr><td>一万円札</td><td>8枚</td></tr><tr><td>千円札</td><td>5枚</td></tr><tr class="hl"><td><b>合計</b></td><td><b>¥85,000</b></td></tr></table></div>
        <p class="note">封筒の裏に鉛筆で<b>「11/2 貸切分」</b>。銀行に入れずに、金庫にしまわれていた。</p>`
    },
    blank: {
      name: "白紙の領収書の束", room: "office", icon: "blank", key: true,
      html: `<h3>証拠　机の引き出し</h3><h2>白紙の領収書の束</h2>
        <div class="doc receipt blank"><div class="r-head">領 収 書</div><div class="r-to">　　　　様</div><div class="r-amt">¥　　　　　-</div>
        <div class="r-for">但</div><div class="r-foot"><b>山海物産株式会社</b><span class="hanko">山海</span></div></div>
        <p class="note">仕入れ先「山海物産」のハンコが押された<b>白紙の領収書が20枚</b>。1枚目だけ切り取られている。社長が自分で書いたのでは……？</p>`
    }
  },

  /* 3D空間で調べられる場所。gives に入っている証拠が手に入る */
  spots: {
    register: { room: "shop", label: "レジ", gives: "register" },
    trash:    { room: "shop", label: "ゴミ箱", gives: "order" },
    calendar: { room: "shop", label: "カレンダー", gives: "calendar" },
    shelf:    { room: "shop", label: "本棚", gives: "menu" },
    plant:    { room: "shop", label: "観葉植物", gives: "key" },
    pc:       { room: "office", label: "パソコン", gives: "ledger" },
    photo:    { room: "office", label: "写真立て", gives: "photo" },
    boxes:    { room: "office", label: "段ボール", gives: "stock" },
    safe:     { room: "office", label: "金庫", gives: "envelope", lock: "dial", code: "1015" },
    desk:     { room: "office", label: "机の引き出し", gives: "blank", lock: "key" }
  },

  /* ヒント：上から順に、条件に当てはまる最初の1つを出す */
  hints: [
    { when: s => s.seen.size === 0, text: "まずは光っている物をタップして、店の中を調べてみよう。" },
    { when: s => !s.solved.has("c1") && !s.got.has("register"), text: "社長は「売上は全部レジ」と言っていた。まずはレジの記録を見てみよう。" },
    { when: s => !s.solved.has("c1") && !s.got.has("order"), text: "レジは夜7時前に締められていた。夜の売上の手がかりが、捨てられていないかな？" },
    { when: s => !s.solved.has("c1"), text: "「手書きの注文票」はレジに記録されていない売上だ。相談タイムで「売上」の主張にぶつけよう。" },
    { when: s => !s.visited.has("office"), text: "店の奥に事務室がある。カウンターの奥のドアをタップしてみよう。" },
    { when: s => !s.solved.has("c2") && !s.got.has("ledger"), text: "事務室のパソコンを調べてみよう。何かメモが貼ってあるかも。" },
    { when: s => !s.solved.has("c2") && !s.got.has("photo"), text: "金庫の番号は「お店の誕生日」。お店が開いた日が分かる物はないかな？" },
    { when: s => !s.solved.has("c2") && !s.got.has("envelope"), text: "開店の日は 10月15日。金庫に「1015」を入れてみよう。" },
    { when: s => !s.solved.has("c2"), text: "「別」の封筒は、銀行に入れていない現金だ。「現金」の主張にぶつけよう。" },
    { when: s => !s.solved.has("c3") && !s.got.has("stock"), text: "本当に30万円分も豆を買ったのかな？ 事務室の段ボールを調べてみよう。" },
    { when: s => !s.solved.has("c3") && !s.got.has("key"), text: "机の引き出しには鍵がかかっている。店の中に鍵が隠されていないかな？ 植物のあたりが怪しい。" },
    { when: s => !s.solved.has("c3") && !s.got.has("blank"), text: "鍵を持っていれば、事務室の机の引き出しを開けられる。" },
    { when: s => !s.solved.has("c3"), text: "「白紙の領収書の束」があれば、領収書は自分で書けてしまう。「仕入れ」の主張にぶつけよう。" }
  ]
};
