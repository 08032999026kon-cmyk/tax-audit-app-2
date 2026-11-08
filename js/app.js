/* 臨場 v3 ― 1画面に1つのことだけ。STEP 1〜5 で進む。
 *  STEP1 資料を読む → STEP2 相談タイム（伝え合う・当たりをつける）→ STEP3 お店で調べる
 *  → STEP4 社長に説明する（代表は1問ずつ／ほかの人は代表に読み上げる）→ STEP5 ふりかえり
 * 通信はしない。各自のスマホで遊び、見つけたことは口で伝え合う。
 * 保存は localStorage（"rinjo:v3"）。URL の末尾に #debug で window.__rinjo が使える。
 */
(function () {
  "use strict";
  const C = window.CASE;
  const A = window.ASSETS || { bg: {}, ch: {} };
  const SND = window.SOUND || { play() {}, bgm() {}, unlock() {}, toggle() { return false; }, on: false };
  const KEY = "rinjo:v3";
  const ORDER = ["lead", "sales", "cash", "buy"];
  const app = document.getElementById("app");
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const strip = (h) => String(h).replace(/<[^>]+>/g, "");
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  /* ---------- 担当ごとに調べること（はずれは入れない） ---------- */
  const TASKS = {
    lead: ["q:q-hours", "p:代1"],
    sales: ["q:q-night", "p:売1", "p:売2", "p:売3"],
    cash: ["q:q-deposit", "p:現1", "p:現2"],
    buy: ["q:q-pay", "q:q-price", "p:仕1", "p:仕2", "p:仕3"]
  };
  // 読み上げ用の短い文
  const TELL = {
    "代0": "今期だけ赤字。原価率（売上に対する仕入れの割合）が31%から42%に上がっている。",
    "売0": "4月から土曜の夜に貸切を始めたのに、夜の売上が0円。",
    "現0": "山海物産にだけ、現金で180万円払っている。",
    "仕0": "原価率が急に42%に。今期からの新しい仕入れ先・山海物産が180万円。",
    "代1": "シフト表では、土曜の夜19時〜23時にアルバイトが入っている。",
    "売1": "レジは毎日18時58分に締めている。夜の売上は入っていない。",
    "売2": "予約カレンダーに、土曜の「貸切」が4月から18回。",
    "売3": "ゴミ箱に、11月2日の夜の貸切 85,000円の注文票。現金で受け取り済み。",
    "現1": "通帳の入金はレジの合計と同じ。山海物産に払った30万円が、どこからも出ていない。",
    "現2": "金庫に「別」の封筒 85,000円（裏に11/2）と、貸切18回・計153万円のノート。",
    "仕1": "山海物産に30万円×6回＝180万円。領収書はそろっている。",
    "仕2": "豆の量も値段も去年と同じ。届いているのは前川コーヒーの豆だけ。",
    "仕3": "机の引き出しに、山海物産のハンコを押した白紙の領収書の束。"
  };
  const SHORT = { "代0": "決算書（赤字・原価率42%）", "売0": "夜の売上0円の資料", "現0": "支払い方法の表", "仕0": "原価率のグラフ" };
  const evName = (c) => SHORT[c] || C.codes[c].name;
  const qOf = (id) => { for (const r of ORDER) { const q = C.questions[r].find((x) => x.id === id); if (q) return q; } return null; };
  const pOf = (code) => C.places[C.codes[code].role].find((x) => x.code === code);

  /* ---------- 状態 ---------- */
  function fresh() {
    return { v: 3, screen: "title", roles: [], cur: null,
      a1: { found: [], hypo: [], stage: "read" },
      a2: { done: [] },
      a3: { idx: 0, picks: {}, won: [], tries: 0, miss: 0, hints: {} }, _last: null };
  }
  let st = load();
  function load() { try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.v === 3) return s; } catch (e) {} return fresh(); }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {} }
  const has = (r) => st.roles.includes(r);
  const isLead = () => has("lead");
  const myRoles = () => ORDER.filter(has);
  const cur = () => (st.cur && has(st.cur) ? st.cur : myRoles()[0]);
  const roleColor = (r) => C.roles[r].color;

  /* ---------- 画像 ---------- */
  const bg = (k) => (A.bg[k] ? A.bg[k].src : "");
  const ch = (k) => (A.ch[k] ? A.ch[k].src : "");
  function faceCss(k, zoom) {
    const c = A.ch[k]; if (!c) return "";
    let [cx, cy, s] = c.face || [0.5, 0.18, 0.5];
    if (zoom) { s = Math.min(1, s * zoom); cy = cy + (s * c.w / c.h) * 0.28; }
    const r = c.h / (c.w * s);
    const px = ((cx / s - 0.5) / (1 / s - 1)) * 100, py = ((cy * r - 0.5) / (r - 1)) * 100;
    return `background-image:url('${c.src}');background-size:${(100 / s).toFixed(1)}% auto;background-position:${px.toFixed(1)}% ${py.toFixed(1)}%`;
  }
  const PEOPLE = { mori: { name: "森先輩（指導役）", face: "mori" }, boss: { name: "白洲社長", face: "boss_grin" }, you: { name: "あなた", face: null } };

  /* ---------- 部品 ---------- */
  const ICON = {
    snd: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/></svg>',
    mute: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M17 9l5 6M22 9l-5 6"/></svg>',
    hint: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/></svg>',
    memo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h4"/></svg>',
    talk: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 5h11a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H9l-4 3v-3H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z"/><path d="M19 9h1a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-1v3l-3-3h-3"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5 9-10"/></svg>',
    ask: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 5h16v11H9l-5 4z"/><path d="M10 9.5a2 2 0 1 1 2.8 1.8c-.5.3-.8.7-.8 1.2M12 14.5h.01"/></svg>',
    doc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12h6M9 16h6"/></svg>',
    lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/></svg>'
  };
  const sndBtn = () => `<button class="ib ${SND.on ? "" : "off"}" data-act="sound" aria-label="音を${SND.on ? "消す" : "出す"}">${SND.on ? ICON.snd : ICON.mute}</button>`;
  const roleTag = (r) => `<span class="rt" style="--c:${roleColor(r)}">${C.roles[r].mark}</span>`;
  const codeTag = (code) => roleTag(C.codes[code] ? C.codes[code].role : "lead");
  function toast(t) { const o = document.getElementById("toast"); if (o) o.remove(); const d = document.createElement("div"); d.id = "toast"; d.innerHTML = t; document.body.appendChild(d); setTimeout(() => d.remove(), 2600); }
  function flash() { const f = document.getElementById("flash"); f && f.animate([{ opacity: 0.85 }, { opacity: 0 }], { duration: 420, easing: "ease-out" }); }

  /* ---------- STEP と見出し ---------- */
  const STEPS = ["資料を読む", "相談タイム", "お店で調べる", "社長に説明する", "ふりかえり"];
  function stepNo() {
    if (st.screen === "a1") return (st.a1.stage || "read") === "read" ? 1 : 2;
    return { a2: 3, a3: 4, result: 5 }[st.screen] || 0;
  }
  function bar() {
    const b = document.getElementById("bar");
    const n = stepNo();
    if (!n && st.screen !== "intro") { b.hidden = true; return; }
    b.hidden = false;
    const tells = myTells().length;
    b.innerHTML = `<div class="row">
        <div class="where">${n ? `<span class="sn">STEP ${n}<i>/5</i></span><span class="nm">${STEPS[n - 1]}</span>` : `<span class="nm">はじめに</span>`}</div>
        ${n && n < 5 ? `<button class="ib hint" data-act="hint">${ICON.hint}<span>ヒント</span></button>` : ""}
        ${n >= 3 && n < 5 ? `<button class="ib" data-act="notes" aria-label="班に伝えることの一覧">${ICON.memo}${tells ? `<span class="badge">${tells}</span>` : ""}</button>` : ""}
        ${sndBtn()}</div>
      <div class="segs">${STEPS.map((_, i) => `<i class="${i < n ? "on" : ""}"></i>`).join("")}</div>`;
  }
  // 画面の上の「いまやること」
  const mission = (title, sub) => `<div class="mission"><h1>${title}</h1>${sub ? `<p>${sub}</p>` : ""}</div>`;
  const cta = (inner) => `<div class="cta"><div class="in">${inner}</div></div>`;
  // 読み上げの順番（自分の担当に印）
  const order = () => `<div class="order" aria-label="読み上げる順番">${ORDER.map((r, i) => `${i ? "<i>›</i>" : ""}<span style="--c:${roleColor(r)}" class="${has(r) ? "me" : ""}">${C.roles[r].name.replace("担当", "")}${has(r) ? "<b>あなた</b>" : ""}</span>`).join("")}</div>`;
  const tellCards = (list, empty) => list.length
    ? `<div class="tells">${list.map((t, i) => `<div class="tell" style="--c:${t.color}"><span class="no">${i + 1}</span><div><small>${esc(t.kind)}</small><p>${esc(t.text)}</p></div></div>`).join("")}</div>`
    : `<p class="empty">${empty}</p>`;

  /* ---------- 会話（タップで次へ） ---------- */
  let talking = null;
  function talk(lines) {
    return new Promise((done) => {
      const box = document.getElementById("talk"), dim = document.getElementById("talkdim");
      let i = 0, typing = null;
      const show = () => {
        const L = lines[i]; const who = L.who ? PEOPLE[L.who] : null;
        box.className = L.who === "you" ? "you" : who && who.face ? "" : "narr";
        const face = L.face || (who && who.face);
        box.innerHTML = `<div class="box" role="button" tabindex="0" aria-label="タップで次へ">
          <div class="face" style="${face ? faceCss(face) : ""}"></div>
          <div><div class="who">${who ? who.name : ""}</div><div class="say"></div></div>
          <div class="next">${i < lines.length - 1 ? "タップで次へ ▶" : "タップで閉じる"}</div></div>`;
        box.hidden = false; dim.hidden = false;
        const say = box.querySelector(".say");
        if (L.sfx) SND.play(L.sfx);
        const html = L.text; let k = 0; clearInterval(typing);
        const plain = strip(html).length;
        if (plain < 2 || matchMedia("(prefers-reduced-motion: reduce)").matches) { say.innerHTML = html; typing = null; return; }
        typing = setInterval(() => {
          k += 2; if (k >= plain) { say.innerHTML = html; clearInterval(typing); typing = null; return; }
          say.innerHTML = cut(html, k);
        }, 26);
      };
      const next = () => {
        if (typing) { clearInterval(typing); typing = null; box.querySelector(".say").innerHTML = lines[i].text; return; }
        SND.play("tap"); i++;
        if (i >= lines.length) { box.hidden = true; dim.hidden = true; box.onclick = dim.onclick = null; box.onkeydown = null; talking = null; done(); return; }
        show();
      };
      box.onclick = dim.onclick = next;
      box.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); next(); } };
      talking = next; show();
      setTimeout(() => { const f = box.querySelector(".box"); f && f.focus({ preventScroll: true }); }, 30);
    });
  }
  function cut(html, n) { let out = "", c = 0; const re = /(<[^>]+>)|([^<])/g; let m; while ((m = re.exec(html)) && c < n) { if (m[1]) out += m[1]; else { out += m[2]; c++; } } return out; }

  /* ---------- シート ---------- */
  function sheet(html, bind) {
    closeSheet();
    const d = document.createElement("div"); d.className = "sheet"; d.id = "sheet";
    d.innerHTML = `<div class="in" role="dialog" aria-modal="true"><div class="grab"></div>${html}</div>`;
    d.addEventListener("click", (e) => { if (e.target === d) closeSheet(); });
    document.body.appendChild(d); bind && bind(d);
    return d;
  }
  function closeSheet() { const s = document.getElementById("sheet"); if (s) s.remove(); }
  function confirmSheet(title, body, okLabel, fn) {
    sheet(`<h2>${title}</h2><p class="lede">${body}</p><div class="acts"><button class="btn btn-main" data-x="ok">${okLabel}</button><button class="btn btn-ghost" data-x="no">もどる</button></div>`, (d) => {
      d.querySelector('[data-x="no"]').onclick = closeSheet;
      d.querySelector('[data-x="ok"]').onclick = () => { closeSheet(); fn(); };
    });
  }

  /* ---------- 画面の切り替え ---------- */
  let lastKey = null;
  function go(screen) { const t = document.getElementById("toast"); if (t) t.remove(); st.screen = screen; if (["intro", "a1", "a2", "a3", "result"].includes(screen)) st._last = screen; save(); render(); window.scrollTo(0, 0); }
  function render() {
    const r = cur(); document.documentElement.style.setProperty("--role", r ? roleColor(r) : "#f2a53a");
    const f = { title: vTitle, roles: vRoles, intro: vIntro, a1: vA1, a2: vA2, a3: vA3, result: vResult }[st.screen] || vTitle;
    app.innerHTML = f();
    const key = st.screen + (st.a1.stage || "") + st.a3.idx;
    const scr = app.querySelector(".screen,#title");
    if (scr && lastKey === key) scr.style.animation = "none";
    lastKey = key;
    bar();
    SND.bgm(st.screen === "a3" ? "tense" : st.screen === "title" || st.screen === "result" ? null : "calm");
  }

  /* ---------- タイトル ---------- */
  function vTitle() {
    const resumable = st.roles.length && st._last;
    return `<section id="title"><div class="bg" style="background-image:url('${bg("ext")}')"></div>
      <div class="wrap">
        <div class="file"><span class="stamp">調査中</span><p class="kick">税務調査 体験ゲーム</p><h1>臨場</h1><div class="case">喫茶店「浜風珈琲」の調査</div></div>
        <p class="lead">あなたは税務署の調査官。<br>班で手分けして、社長の説明が本当かを確かめよう。</p>
        <button class="btn btn-main" data-act="start">はじめる</button>
        ${resumable ? `<button class="btn btn-ghost" data-act="resume">続きから</button>` : ""}
        <div class="t-foot"><span>これはゲームです。会社・人物・資料はすべて架空です。</span>${sndBtn()}</div>
      </div></section>`;
  }

  /* ---------- 担当えらび ---------- */
  const ROLE_JOB = {
    lead: "最後に、仲間が見つけた証拠を<b>社長に示す</b>。",
    sales: "レジや予約の記録など、<b>売上</b>を調べる。",
    cash: "通帳や金庫など、<b>お金の流れ</b>を調べる。",
    buy: "帳簿や在庫など、<b>仕入れ</b>を調べる。"
  };
  function vRoles() {
    return `<section class="screen plain"><div class="wrap">
      <div class="top-row"><button class="back" data-act="home">‹ もどる</button>${sndBtn()}</div>
      ${mission("自分の担当を選ぼう", "班で相談して、4つの担当を分けます。")}
      <div class="role-grid">${ORDER.map((r) => { const R = C.roles[r]; return `<button class="role-card" style="--c:${R.color}" data-act="role" data-r="${r}" aria-pressed="${has(r)}">
        <span class="mk">${R.mark}</span><strong>${R.name}</strong><span>${ROLE_JOB[r]}</span></button>`; }).join("")}</div>
      <div class="split-help">
        <p><b>人数が4人でないとき</b></p>
        <ul><li>2〜3人：1人で2つ選ぶ（例：代表＋売上）</li><li>5〜6人：同じ担当を2人で選ぶ</li><li><b>代表は班に1人だけ</b></li></ul>
      </div>
    </div></section>
    ${cta(`<button class="btn btn-main" data-act="roles-ok" ${st.roles.length ? "" : "disabled"}>${st.roles.length ? myRoles().map((r) => C.roles[r].name).join("＋") + " で始める" : "担当をタップしてください"}</button>`)}`;
  }

  /* ---------- はじめに ---------- */
  function vIntro() {
    return `<section class="screen"><div class="wrap">
      ${mission("この順番で進みます", "全部で約25分。各STEPで、画面のいちばん上に「やること」が出ます。")}
      <ol class="flow">
        <li><span class="n">1</span><div><b>資料を読む</b><p>自分の担当の資料から、気になる点を見つける。</p></div></li>
        <li class="talk"><span class="n">2</span><div><b>相談タイム</b><p>見つけたことを班で読み上げ、どこを調べるか決める。</p></div></li>
        <li><span class="n">3</span><div><b>お店で調べる</b><p>社長に質問し、<b>承諾をもらって</b>書類などを見せてもらう。</p></div></li>
        <li class="talk"><span class="n">4</span><div><b>社長に説明する</b><p>見つけたことを代表に伝え、代表が証拠を社長に示す。</p></div></li>
        <li><span class="n">5</span><div><b>ふりかえり</b><p>本当は何があったのかを確かめる。</p></div></li>
      </ol>
      <details class="words"><summary>ことばの説明</summary>
        <dl><dt>税務調査</dt><dd>申告（税金の届け出）が正しいかを、税務署が確かめること。</dd>
        <dt>臨場（りんじょう）</dt><dd>調査官が会社やお店に出向いて調べること。</dd>
        <dt>所得</dt><dd>もうけ。売上から経費を引いた残り。税金はここにかかる。</dd>
        <dt>端緒（たんちょ）</dt><dd>調べるきっかけになる不審な点。</dd></dl></details>
    </div></section>
    ${cta(`<button class="btn btn-main" data-act="to-a1">STEP 1 へ</button>`)}`;
  }

  /* ---------- STEP 1・2 ---------- */
  function switcher() {
    const rs = myRoles(); if (rs.length < 2) return "";
    return `<div class="switch" role="group" aria-label="担当の切り替え">${rs.map((r) => `<button style="--c:${roleColor(r)}" data-act="cur" data-r="${r}" aria-pressed="${r === cur()}">${C.roles[r].name}</button>`).join("")}</div>`;
  }
  const goodHits = (r) => Object.entries(C.prep[r].hits).filter(([, H]) => H.good).map(([h]) => h);
  const goodLeft = () => myRoles().reduce((n, r) => n + goodHits(r).filter((h) => !st.a1.found.includes(r + ":" + h)).length, 0);
  function vA1() {
    const stage = st.a1.stage || "read";
    if (stage === "share") {
      const cards = myRoles().flatMap((r) => goodHits(r).map((h) => ({ color: roleColor(r), kind: C.roles[r].name + "の資料", text: strip(C.prep[r].hits[h].text) })));
      return `<section class="screen"><div class="wrap">
        <div class="talk-badge">${ICON.talk}相談タイム</div>
        ${mission("見つけたことを、順番に読み上げよう", "代表から順に、下のカードを声に出して読みます。")}
        ${order()}
        ${tellCards(cards, "")}
        <p class="after">全員が読み終えたら、班で「どこがあやしい？」と話してから次へ。</p>
      </div></section>
      ${cta(`<button class="btn btn-main" data-act="a1-stage" data-s="hypo">全員読み終えた</button>`)}`;
    }
    if (stage === "hypo") {
      return `<section class="screen"><div class="wrap">
        <div class="talk-badge">${ICON.talk}相談タイム</div>
        ${mission("班で話して、当たりをつけよう", "どこを調べるか決めるために、あやしいと思う<b>仮説</b>を選びます（2つまで）。")}
        <div class="hypo">${C.hypotheses.map((h) => `<button data-act="hypo" data-h="${h.id}" aria-pressed="${st.a1.hypo.includes(h.id)}"><span class="bx">${ICON.check}</span><span>${h.text}</span></button>`).join("")}</div>
      </div></section>
      ${cta(`<button class="btn btn-ghost" data-act="a1-stage" data-s="share">もどる</button><button class="btn btn-main" data-act="to-a2" ${st.a1.hypo.length ? "" : "disabled"}>お店へ向かう</button>`)}`;
    }
    const r = cur(), P = C.prep[r], goods = goodHits(r);
    const got = goods.filter((h) => st.a1.found.includes(r + ":" + h)).length;
    const rest = goodLeft();
    const lastK = [...st.a1.found].reverse().find((k) => k.startsWith(r + ":"));
    const lastH = lastK ? P.hits[lastK.split(":")[1]] : null;
    return `<section class="screen"><div class="wrap">
      ${mission("資料の<em>光っている所</em>をタップしよう", `気になる点が<b>${goods.length}つ</b>あります。全部見つけたら次へ。`)}
      ${switcher()}
      <div class="dots" aria-label="見つけた数 ${got} / ${goods.length}">${goods.map((h) => `<i class="${st.a1.found.includes(r + ":" + h) ? "on" : ""}"></i>`).join("")}<span>${got} / ${goods.length}</span></div>
      <div class="paper hit-mode" id="prepdoc"><p class="doc-kind">${C.roles[r].name}の資料</p><h3>${P.title}</h3>${P.html}</div>
      ${lastH ? `<div class="found-say ${lastH.good ? "" : "meh"}">${lastH.good ? "気になる！" : "これは関係なさそう"}<p>${lastH.text}</p></div>` : ""}
    </div></section>
    ${cta(`<button class="btn btn-main" data-act="a1-stage" data-s="share" ${rest ? "disabled" : ""}>${rest ? `あと ${rest} つ` : "STEP 2 相談タイムへ"}</button>`)}`;
  }

  /* ---------- STEP 3 お店で調べる ---------- */
  const SCENE = { lead: "office", sales: "shop", cash: "office", buy: "office" };
  const taskDone = (t) => st.a2.done.includes(t);
  const tasksLeft = () => myRoles().reduce((n, r) => n + TASKS[r].filter((t) => !taskDone(t)).length, 0);
  function vA2() {
    const r = cur(), list = TASKS[r];
    const n = list.filter(taskDone).length, rest = tasksLeft();
    const rows = list.map((t, i) => {
      const [k, id] = t.split(":"), done = taskDone(t);
      const next = !done && list.slice(0, i).every(taskDone);
      if (k === "q") { const q = qOf(id); return `<button class="task ${done ? "done" : ""} ${next ? "next" : ""}" data-act="task" data-t="${t}"><span class="ic">${done ? ICON.check : ICON.ask}</span><span class="tx"><small>社長に聞く</small>「${esc(q.q)}」</span></button>`; }
      const p = pOf(id);
      return `<button class="task ${done ? "done" : ""} ${next ? "next" : ""}" data-act="task" data-t="${t}"><span class="ic">${done ? ICON.check : p.open ? ICON.lock : ICON.doc}</span><span class="tx"><small>${p.open ? "開けて見せてもらう" : "見せてもらう"}（${esc(p.where)}）</small>${esc(p.name)}</span></button>`;
    }).join("");
    return `<section class="screen"><div class="wrap">
      ${mission("社長に聞いて、書類を見せてもらおう", "上から順にタップ。手がかりが出たら<b>その場で班に伝えよう</b>。")}
      ${switcher()}
      <div class="scene" style="background-image:url('${bg(SCENE[r])}')"><div class="boss" style="${faceCss("boss_grin", 1.9)}"></div><p>「どうぞ、何でも聞いてください」<small>白洲社長</small></p></div>
      <div class="dots"><span style="margin-left:0">${C.roles[r].name}：${n} / ${list.length} 調べた</span></div>
      <div class="tasks">${rows}</div>
      <p class="disclaim">これはゲームです。実際の税務調査でも、書類を見せてもらう・金庫や机を開けてもらうときは、必ず相手の<b>明示の承諾</b>を得ます。</p>
    </div></section>
    ${cta(`<button class="btn btn-main" data-act="end-a2" ${rest ? "disabled" : ""}>${rest ? `あと ${rest} つ調べよう` : "STEP 4 署にもどる"}</button>`)}`;
  }
  async function doTask(t) {
    const [k, id] = t.split(":");
    if (k === "q") {
      const q = qOf(id);
      const lines = [{ who: "you", text: q.q }, { who: "boss", text: q.a, face: q.key ? "boss_smug" : "boss_grin", sfx: q.key ? "bossTick" : null }];
      if (q.key && !taskDone(t)) lines.push({ who: null, text: `📣 <b>班にこう伝えよう</b><br>「社長は『${C.statements[q.key].text}』と言っていた」`, sfx: "paper" });
      if (!taskDone(t)) { st.a2.done.push(t); save(); }
      await talk(lines); render(); return;
    }
    const p = pOf(id);
    if (taskDone(t)) { evidence(p); return; }
    sheet(`<p class="eyebrow">${esc(p.where)}</p><h2>${esc(p.name)}</h2>
      <div class="consent"><span class="tag">承諾をもらう</span><p>見る前に、社長にお願いします。</p><blockquote>「${esc(p.consent)}」</blockquote></div>
      <p class="disclaim">実際の調査でも、見せてもらう・開けてもらうには相手の明示の承諾が必要です。</p>
      <div class="acts"><button class="btn btn-main" data-x="ok">社長にお願いする</button><button class="btn btn-ghost" data-x="no">やめる</button></div>`, (d) => {
      d.querySelector('[data-x="no"]').onclick = closeSheet;
      d.querySelector('[data-x="ok"]').onclick = async () => {
        closeSheet(); st.a2.done.push(t); save();
        await talk([{ who: "you", text: p.consent }, { who: "boss", text: p.ok, face: p.open ? "boss_shock" : "boss_grin", sfx: p.open ? "unlock" : "open" }]);
        render(); evidence(p, true);
      };
    });
  }
  function evidence(p, first) {
    if (first) SND.play("item");
    sheet(`<div class="ev-head">${codeTag(p.code)}<div><b>${esc(p.name)}</b><small>${esc(p.where)}</small></div></div>
      <div class="paper">${p.doc()}</div>
      <div class="tellbox"><small>📣 今すぐ班にこう伝えよう</small><p>「${esc(TELL[p.code])}」</p></div>
      <div class="acts"><button class="btn btn-main" data-x="close">伝えた</button></div>`, (d) => { d.querySelector('[data-x="close"]').onclick = closeSheet; });
  }

  /* 自分が班に伝えられること（社長の発言 → 準備の資料 → お店で見た物） */
  function myTells() {
    const out = [];
    st.a2.done.filter((t) => t.startsWith("q:")).forEach((t) => { const q = qOf(t.slice(2)); if (q.key) out.push({ color: roleColor(C.statements[q.key].by), kind: "社長の発言", text: `社長は「${C.statements[q.key].text}」と言っていた。` }); });
    myRoles().forEach((r) => out.push({ color: roleColor(r), kind: C.prep[r].title, text: TELL[C.prep[r].code] }));
    st.a2.done.filter((t) => t.startsWith("p:")).forEach((t) => { const c = t.slice(2); out.push({ color: roleColor(C.codes[c].role), kind: C.codes[c].name, text: TELL[c] }); });
    return out;
  }
  function notes() {
    sheet(`<h2>班に伝えること</h2><p class="lede" style="margin-bottom:10px">STEP 4で、この順に代表へ読み上げます。</p>${tellCards(myTells(), "まだありません。")}
      <div class="acts"><button class="btn btn-ghost" data-x="close">閉じる</button></div>`, (d) => { d.querySelector('[data-x="close"]').onclick = closeSheet; });
  }

  /* ---------- STEP 4 社長に説明する ---------- */
  const unsolved = () => C.board.filter((b) => !st.a3.won.includes(b.id));
  function curBoard() { const u = unsolved(); if (!u.length) return null; return u[st.a3.idx % u.length]; }
  function vA3() {
    if (!isLead()) {
      return `<section class="screen"><div class="wrap">
        <div class="talk-badge">${ICON.talk}相談タイム</div>
        ${mission("見つけたことを、代表に読み上げよう", "この順番で1人ずつ。代表に聞かれたら、もう一度読もう。")}
        ${order()}
        ${tellCards(myTells(), "")}
        <p class="after">読み終えたら、代表と一緒に「社長のどの発言と食い違う？」を考えよう。</p>
      </div></section>
      ${cta(`<button class="btn btn-ghost" data-act="to-result">STEP 5 ふりかえりへ<small>代表が説明を終えてから</small></button>`)}`;
    }
    const b = curBoard();
    if (!b) return `<section class="screen"><div class="wrap">${mission("すべての発言を崩した！")}</div></section>`;
    const S = C.statements[b.id], pk = st.a3.picks[b.id] || [];
    const done = st.a3.won.length, total = C.board.length;
    const slot = (i) => pk[i]
      ? `<button class="slot2 set" data-act="unpick" data-i="${i}" style="--c:${roleColor(C.codes[pk[i]].role)}">${codeTag(pk[i])}<span>${esc(evName(pk[i]))}</span><i>×</i></button>`
      : `<div class="slot2">証拠 ${i + 1}</div>`;
    const grid = ORDER.map((r) => `<div class="evg"><p style="color:${roleColor(r)}">${C.roles[r].name}</p><div>${[C.prep[r].code].concat(TASKS[r].filter((t) => t.startsWith("p:")).map((t) => t.slice(2))).map((c) => `<button class="ev ${pk.includes(c) ? "on" : ""}" style="--c:${roleColor(r)}" data-act="pick" data-c="${c}">${esc(evName(c))}</button>`).join("")}</div></div>`).join("");
    return `<section class="screen"><div class="wrap">
      <div class="q-head"><span>発言 ${done + 1} / ${total}</span>${unsolved().length > 1 ? `<button class="back" data-act="skip">あとにする ›</button>` : ""}</div>
      <div class="quote"><div class="boss" style="${faceCss("boss_smug", 1.9)}"></div><div><small>社長はこう言った</small><p>「${esc(S.text)}」</p></div></div>
      ${mission("この発言と食い違う証拠を、2つ選ぼう", "<b>違う担当</b>の証拠を1つずつ。仲間の読み上げを思い出そう。")}
      <div class="slots2">${slot(0)}<span>＋</span>${slot(1)}</div>
      <div class="evgrid">${grid}</div>
      <details class="words"><summary>読み上げの順番と、あなたの手がかり</summary>${order()}${tellCards(myTells(), "")}</details>
    </div></section>
    ${cta(`<button class="btn btn-red" data-act="thrust" ${pk[0] && pk[1] ? "" : "disabled"}>${pk[0] && pk[1] ? "社長にぶつける！" : "証拠を2つ選んでください"}</button>`)}`;
  }
  async function thrust() {
    const b = curBoard(); if (!b) return;
    const pk = st.a3.picks[b.id] || [];
    if (!pk[0] || !pk[1]) return;
    if (C.codes[pk[0]].role === C.codes[pk[1]].role) {
      SND.play("wrong");
      await talk([{ who: "mori", text: `2つとも<b>${C.roles[C.codes[pk[0]].role].name}</b>の証拠だ。<b>違う担当の証拠</b>を1つずつ選ぼう。` }]);
      return;
    }
    const okA = (c) => b.need[0].includes(c), okB = (c) => b.need[1].includes(c);
    const win = (okA(pk[0]) && okB(pk[1])) || (okA(pk[1]) && okB(pk[0]));
    const half = !win && pk.some((c) => okA(c) || okB(c));
    st.a3.tries++; if (!win) st.a3.miss++;
    const S = C.statements[b.id];
    const fo = document.createElement("div"); fo.id = "face-off";
    fo.innerHTML = `<div class="speed"></div><img src="${ch("boss_smug")}" alt="白洲社長">
      <div class="thrust"><small>代表が示した証拠</small><div>${codeTag(pk[0])}${esc(evName(pk[0]))}</div><div>${codeTag(pk[1])}${esc(evName(pk[1]))}</div></div>`;
    document.body.appendChild(fo); SND.play("slam");
    await wait(1000);
    const img = fo.querySelector("img");
    if (win) {
      st.a3.won.push(b.id); st.a3.idx = 0; save();
      flash(); fo.querySelector(".speed").classList.add("on"); img.src = ch("boss_shock"); fo.classList.add("shock"); SND.play("shock");
      const bn = document.createElement("div"); bn.className = "banner"; bn.innerHTML = `崩した！<small>「${esc(S.text)}」</small>`; fo.appendChild(bn);
      await wait(1300); bn.remove(); img.src = ch("boss_panic");
      await talk([{ who: "boss", text: b.win, face: "boss_panic" }]);
    } else {
      fo.classList.add("smug"); SND.play("laugh"); await wait(400);
      await talk([{ who: "boss", text: half ? b.half : b.miss, face: "boss_smug" },
        { who: "mori", text: half ? "惜しい。<b>片方は効いている</b>。もう1つを入れ替えてみよう。" : "その組み合わせでは崩せない。迷ったら上の<b>「ヒント」</b>を押そう。" }]);
    }
    fo.remove(); render(); window.scrollTo(0, 0);
    if (!unsolved().length) finale();
  }
  async function finale() {
    const fo = document.createElement("div"); fo.id = "face-off"; fo.innerHTML = `<img src="${ch("boss_sad")}" alt="白洲社長">`; document.body.appendChild(fo);
    SND.play("win");
    await talk([{ who: "boss", text: "……すべて、おっしゃるとおりです。申し訳ありませんでした。", face: "boss_sad" },
      { who: "mori", text: "よくやった。班で手分けして集めた証拠が、ひとつにつながったな。" }]);
    fo.remove(); go("result");
  }

  /* ---------- STEP 5 ふりかえり ---------- */
  const stars = (n) => "★".repeat(n) + "☆".repeat(3 - n);
  function vResult() {
    const hypoGood = st.a1.hypo.filter((h) => C.hypotheses.find((x) => x.id === h).good === true).length;
    const s1 = hypoGood >= 2 ? 3 : hypoGood === 1 ? 2 : 1;
    const w = st.a3.won.length, s3 = w >= 4 && st.a3.miss <= 2 ? 3 : w >= 3 ? 2 : 1;
    return `<section class="screen"><div class="wrap">
      <div class="r-hero"><span class="stamp">調査完了</span>
        ${isLead() ? `<p>崩した社長の発言　<b>${w} / ${C.board.length}</b></p>` : ""}</div>
      <div class="paper"><h3>本当は何があったのか</h3>
        <p>① 土曜の夜の<b>貸切パーティーの売上</b>をレジに通さず、金庫の「別」の封筒に隠していた（18回）。</p>
        <p>② 白紙の領収書に自分で書き込み、<b>山海物産からの豆の仕入れ</b>をでっち上げていた（30万円×6回）。</p></div>
      <div class="amounts"><div><small>売上除外（売上を帳簿から外す）</small><strong>153万円</strong></div><div><small>架空経費（ない経費を計上）</small><strong>180万円</strong></div>
        <div><small>申告した所得</small><strong>−57万円</strong></div><div><small>正しい所得</small><strong class="hl">276万円</strong></div></div>
      <div class="skills">
        <div class="skill"><strong>当たりをつける力</strong><span class="stars">${stars(s1)}</span><p>資料の不審な点（端緒）から、調べる所を決める。</p></div>
        ${isLead() ? `<div class="skill"><strong>立証する力</strong><span class="stars">${stars(s3)}</span><p>発言と証拠をつなげて、相手が認める説明をする。</p></div>` : ""}
      </div>
      <div class="learn"><h3>今日体験した、税務調査の流れ</h3><ol>
        <li><b>準備調査</b>：資料を読み、端緒から当たりをつける。</li>
        <li><b>臨場</b>：相手の承諾を得て、話を聞き、現物を確かめる。</li>
        <li><b>検討と説明</b>：発言と証拠をつなげ、相手が納得できるように説明する。</li></ol>
        <p class="cap">実際の調査も、チームで分担し、声をかけ合いながら進めることがあります。</p></div>
      <p class="disclaim">これはゲームです。会社・人物・資料・金額はすべて架空です。実際の税務調査では、書類を見せてもらう・金庫や机を開けてもらうなどの際に、必ず相手の明示の承諾を得ます。</p>
    </div></section>
    ${cta(`<button class="btn btn-ghost" data-act="reset">最初からやり直す</button>`)}`;
  }

  /* ---------- ヒント（森先輩） ---------- */
  function hint() {
    const r = cur();
    const say = (t) => talk((Array.isArray(t) ? t : [t]).map((x) => ({ who: "mori", text: x })));
    if (st.screen === "intro") return say("下のボタンで STEP 1 へ進もう。");
    if (st.screen === "a1") {
      const stg = st.a1.stage || "read";
      if (stg === "read") return say(`資料の<b>オレンジに光っている所</b>をタップしよう。${myRoles().length > 1 ? "全部見つけたら、上のボタンでほかの担当の資料に切り替えて。" : ""}`);
      if (stg === "share") return say("代表から順番に、カードの文を<b>そのまま読み上げれば</b>いい。全員読み終えたら下のボタンだ。");
      return say("読み上げで出た「<b>夜の売上が0円</b>」「<b>現金払いの新しい仕入れ先</b>」が気になるな。それに合う仮説を選ぼう。");
    }
    if (st.screen === "a2") {
      const nx = TASKS[r].find((t) => !taskDone(t));
      if (!nx) return say(tasksLeft() ? "この担当は調べ終わった。上のボタンで、もう1つの担当に切り替えよう。" : "全部調べた。下のボタンで署にもどろう。");
      return say(`次は、<b>光っている行</b>（${nx.startsWith("q:") ? "社長への質問" : esc(pOf(nx.slice(2)).name)}）をタップしよう。手がかりが出たら、すぐ班に読み上げて。`);
    }
    if (st.screen === "a3") {
      if (!isLead()) return say("カードの文を、代表に読み上げよう。代表が迷っていたら、「この証拠は社長の○○という発言と食い違う」と一緒に考えて。");
      const b = curBoard(); if (!b) return;
      const lv = (st.a3.hints[b.id] = Math.min(2, (st.a3.hints[b.id] || 0) + 1)); save();
      const rolesOf = (g) => [...new Set(g.map((c) => C.roles[C.codes[c].role].name))].join("か");
      const names = (g) => g.map(evName).join("」か「");
      return say(lv === 1 ? `この発言には、<b>${rolesOf(b.need[0])}</b>の証拠と、<b>${rolesOf(b.need[1])}</b>の証拠を組み合わせよう。` : `使えるのは「<b>${names(b.need[0])}</b>」と、「<b>${names(b.need[1])}</b>」だ。`);
    }
  }

  /* ---------- 操作 ---------- */
  const ACT = {
    sound() { SND.unlock(); SND.toggle(); render(); },
    start() { if (st.roles.length && st._last) { confirmSheet("最初から始めますか", "この端末の進み具合は消えます。", "最初から始める", () => { st = fresh(); go("roles"); }); return; } st = fresh(); go("roles"); },
    resume() { go(st._last || "intro"); },
    home() { go("title"); },
    role(el) { const r = el.dataset.r; st.roles = has(r) ? st.roles.filter((x) => x !== r) : st.roles.concat(r); SND.play("tap"); save(); render(); },
    "roles-ok"() {
      if (!st.roles.length) return;
      const go2 = () => { st.cur = myRoles()[0]; go("intro"); talk([{ who: "mori", text: "指導役の森だ。今日の相手は喫茶店「<b>浜風珈琲</b>」。申告は赤字だが、数字に引っかかるところがある。" }, { who: "mori", text: "迷ったら、いつでも上の<b>「ヒント」</b>を押してくれ。" }]); };
      if (!isLead()) confirmSheet("代表はいますか", "班の中に<b>代表が1人</b>必要です。ほかの人が代表を選んでいれば、このまま進めてください。", "このまま進む", go2);
      else go2();
    },
    "to-a1"() { st.a1.stage = "read"; go("a1"); },
    "a1-stage"(el) { st.a1.stage = el.dataset.s; SND.play("paper"); go("a1"); },
    cur(el) { st.cur = el.dataset.r; SND.play("tap"); save(); render(); },
    hint() { hint(); },
    hypo(el) {
      const h = el.dataset.h, on = st.a1.hypo.includes(h);
      if (!on && st.a1.hypo.length >= 2) { toast("仮説は2つまで。外してから選ぼう"); return; }
      st.a1.hypo = on ? st.a1.hypo.filter((x) => x !== h) : st.a1.hypo.concat(h); SND.play("paper"); save(); render();
    },
    async "to-a2"() {
      const good = st.a1.hypo.some((h) => C.hypotheses.find((x) => x.id === h).good === true);
      await talk([{ who: "mori", text: good ? "いい当たりだ。お店で確かめよう。" : "仮説は現場で確かめるものだ。お店へ行こう。" }]);
      st.cur = myRoles()[0]; go("a2"); SND.play("door");
      await talk([{ who: "boss", text: "税務署の方？ うちは赤字ですよ。何もやましいことはありません。", face: "boss_grin" },
        { who: "mori", text: "書類を見るときは、<b>必ず社長の承諾</b>をもらうこと。見つけたら、すぐ班に伝えよう。" }]);
    },
    task(el) { doTask(el.dataset.t); },
    notes() { notes(); },
    "end-a2"() {
      confirmSheet("署にもどりますか", "<b>班の全員</b>が調べ終わってから進みましょう。", "署にもどる", async () => {
        st.a3.idx = 0; go("a3"); SND.play("car");
        await talk([{ who: "mori", text: isLead() ? "署にもどった。社長に証拠を示せるのは<b>代表のあなただけ</b>だ。まず仲間の読み上げを聞こう。" : "署にもどった。見つけたことを、<b>代表に読み上げて</b>くれ。" }]);
      });
    },
    pick(el) {
      const b = curBoard(), c = el.dataset.c; if (!b) return;
      const pk = (st.a3.picks[b.id] = st.a3.picks[b.id] || []);
      const at = pk.indexOf(c);
      if (at >= 0) pk[at] = null; else if (!pk[0]) pk[0] = c; else pk[1] = c;
      SND.play("click"); save(); render();
    },
    unpick(el) { const b = curBoard(); if (!b) return; const pk = st.a3.picks[b.id] || []; pk[+el.dataset.i] = null; save(); render(); },
    skip() { st.a3.idx++; save(); render(); window.scrollTo(0, 0); },
    thrust() { thrust(); },
    "to-result"() { confirmSheet("ふりかえりへ進みますか", "答えが出ます。<b>代表が説明を終えてから</b>進んでください。", "ふりかえりへ", () => go("result")); },
    reset() { confirmSheet("最初からやり直しますか", "この端末の進み具合が消えます。", "やり直す", () => { st = fresh(); save(); go("title"); }); }
  };

  app.addEventListener("click", (e) => {
    SND.unlock();
    const hit = e.target.closest("[data-hit]");
    if (hit && st.screen === "a1") {
      const r = cur(), k = r + ":" + hit.dataset.hit, H = C.prep[r].hits[hit.dataset.hit];
      if (!st.a1.found.includes(k)) {
        st.a1.found.push(k); save(); SND.play(H.good ? "item" : "paper"); render();
        if (H.good && !goodHits(r).some((h) => !st.a1.found.includes(r + ":" + h)) && goodLeft()) toast("この担当は完了！上で次の担当へ");
      }
      return;
    }
    const el = e.target.closest("[data-act]"); if (!el || el.disabled) return;
    const f = ACT[el.dataset.act]; if (f) f(el);
  });
  document.getElementById("bar").addEventListener("click", (e) => { const el = e.target.closest("[data-act]"); if (el && ACT[el.dataset.act]) ACT[el.dataset.act](el); });

  // STEP 1：見つけた所に印をつける
  new MutationObserver(() => {
    if (st.screen !== "a1") return;
    const r = cur();
    app.querySelectorAll("[data-hit]").forEach((n) => { const k = r + ":" + n.dataset.hit; if (st.a1.found.includes(k)) { n.classList.add("found"); if (!C.prep[r].hits[n.dataset.hit].good) n.classList.add("meh"); } });
  }).observe(app, { childList: true });

  if (st.screen !== "title") st.screen = "title";
  render();
  if (location.hash === "#debug") window.__rinjo = { get st() { return st; }, set st(v) { st = v; }, go, render, talk, ACT, next: () => talking && talking() };
})();
