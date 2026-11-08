/* 臨場 v2 ― 進行（画面の切り替え・保存・会話・検討の板）
 * 通信はしない。各自のスマホで遊び、見つけたことは口で伝え合う。代表が一覧から発言と証拠を選んで社長にぶつける。
 * 保存は localStorage（"rinjo:v2"）。URL の末尾に #debug で window.__rinjo が使える。
 */
(function () {
  "use strict";
  const C = window.CASE;
  const A = window.ASSETS || { bg: {}, ch: {} };
  const SND = window.SOUND || { play() {}, bgm() {}, unlock() {}, toggle() { return false; }, on: false };
  const KEY = "rinjo:v2";
  const ORDER = ["lead", "sales", "cash", "buy"];
  const app = document.getElementById("app");
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const strip = (h) => String(h).replace(/<[^>]+>/g, "");
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  /* ---------- 状態 ---------- */
  function fresh() {
    return { v: 2, screen: "title", roles: [], cur: null,
      a1: { found: [], hypo: [], hint: false },
      a2: { used: {}, asked: [], seen: [], tab: "ask", last: null },
      a3: { open: [], picks: {}, won: [], tries: 0, miss: 0 }, ended: false };
  }
  let st = load();
  function load() { try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.v === 2) return s; } catch (e) {} return fresh(); }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {} }
  const has = (r) => st.roles.includes(r);
  const isLead = () => has("lead");
  const myRoles = () => ORDER.filter(has);
  const cur = () => (st.cur && has(st.cur) ? st.cur : myRoles()[0]);
  const roleColor = (r) => C.roles[r].color;
  const left = (r) => C.TIME - (st.a2.used[r] || 0);

  /* ---------- 画像 ---------- */
  const bg = (k) => (A.bg[k] ? A.bg[k].src : "");
  const ch = (k) => (A.ch[k] ? A.ch[k].src : "");
  // 立ち絵から顔の部分を四角く切り出して見せる（背景画像の位置で調整）
  function faceCss(k, zoom) {
    const c = A.ch[k]; if (!c) return "";
    let [cx, cy, s] = c.face || [0.5, 0.18, 0.5];
    if (zoom) { s = Math.min(1, s * zoom); cy = cy + (s * c.w / c.h) * 0.28; }
    const r = c.h / (c.w * s);
    const px = ((cx / s - 0.5) / (1 / s - 1)) * 100, py = ((cy * r - 0.5) / (r - 1)) * 100;
    return `background-image:url('${c.src}');background-size:${(100 / s).toFixed(1)}% auto;background-position:${px.toFixed(1)}% ${py.toFixed(1)}%`;
  }
  const PEOPLE = {
    mori: { name: "森先輩（指導役の調査官）", face: "mori" },
    boss: { name: "白洲社長", face: "boss_grin" },
    you: { name: "あなた", face: null }
  };

  /* ---------- 小さな部品 ---------- */
  const ICON = {
    snd: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/></svg>',
    mute: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M17 9l5 6M22 9l-5 6"/></svg>',
    memo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h4"/></svg>',
    talk: '<svg viewBox="0 0 24 24" fill="none" stroke="#9fe3da" stroke-width="2" stroke-linecap="round"><path d="M4 5h11a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H9l-4 3v-3H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z"/><path d="M19 9h1a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-1v3l-3-3h-3"/></svg>'
  };
  const sndBtn = () => `<button class="icon-btn ${SND.on ? "" : "muted-snd"}" data-act="sound" aria-label="音のオンとオフ（いまは${SND.on ? "オン" : "オフ"}）">${SND.on ? ICON.snd : ICON.mute}<span class="t">音 ${SND.on ? "オン" : "オフ"}</span></button>`;
  // 担当の色の小さな札（番号は見せない）
  const codeTag = (code, big) => { const r = C.codes[code] ? C.codes[code].role : "lead"; return `<span class="code${big ? " big" : ""}" style="--c:${roleColor(r)}">${C.roles[r].mark}</span>`; };
  const numTag = (num, by, big) => `<span class="code${big ? " big" : ""}" style="--c:${roleColor(by)}">発言</span>`;
  const huddle = (html) => `<div class="huddle"><div class="ic">${ICON.talk}</div><p>${html}</p></div>`;
  const todo = (t, s) => `<div class="todo"><p>${t}${s ? `<small>${s}</small>` : ""}</p></div>`;
  function toast(t) { const o = document.getElementById("toast"); if (o) o.remove(); const d = document.createElement("div"); d.id = "toast"; d.innerHTML = t; document.body.appendChild(d); setTimeout(() => d.remove(), 2700); }
  function flash() { const f = document.getElementById("flash"); if (!f) return; f.animate([{ opacity: 0.9 }, { opacity: 0 }], { duration: 420, easing: "ease-out" }); }

  /* ---------- 上の帯 ---------- */
  const ACTS = { a1: [0, "第1幕　準備調査"], a2: [1, "第2幕　臨場"], a3: [2, "第3幕　検討と説明"], result: [3, "ふりかえり"] };
  function bar() {
    const b = document.getElementById("bar");
    const a = ACTS[st.screen];
    if (!a && st.screen !== "intro") { b.hidden = true; return; }
    b.hidden = false;
    const n = notesCount();
    const label = a ? a[1] : "導入";
    b.innerHTML = `<div class="row"><div class="act"><small>${label}</small><strong>${myRoles().map((r) => C.roles[r].name).join("・") || "担当なし"}</strong></div>
      ${st.screen === "a2" || st.screen === "a3" ? `<button class="icon-btn" data-act="notes">${ICON.memo}<span class="t">メモ</span>${n ? `<span class="badge">${n}</span>` : ""}</button>` : ""}
      ${sndBtn()}</div>
      <div class="steps">${[0, 1, 2, 3].map((i) => `<i class="${a && i <= a[0] ? "on" : ""}"></i>`).join("")}</div>`;
  }
  const notesCount = () => st.a2.seen.length + saidList().length;

  /* ---------- 会話（タップで次へ） ---------- */
  let talking = null;
  function talk(lines) {
    return new Promise((done) => {
      const box = document.getElementById("talk"), dim = document.getElementById("talkdim");
      let i = 0, typing = null;
      const show = () => {
        const L = lines[i]; const who = L.who ? PEOPLE[L.who] : null;
        box.className = who && who.face ? "" : "narr";
        const face = L.face || (who && who.face);
        box.innerHTML = `<div class="box" role="button" tabindex="0" aria-label="タップで次へ">
          <div class="face" style="${face ? faceCss(face) : ""}"></div>
          <div><div class="who">${who ? who.name : ""}</div><div class="say"></div></div>
          <div class="next">${i < lines.length - 1 ? "タップで次へ ▶" : "タップで閉じる"}</div></div>`;
        box.hidden = false; dim.hidden = false;
        const say = box.querySelector(".say");
        if (L.sfx) SND.play(L.sfx);
        // 1文字ずつ表示（タグは崩さない）
        const html = L.text; let k = 0; clearInterval(typing);
        const plain = strip(html).length;
        if (plain < 2 || matchMedia("(prefers-reduced-motion: reduce)").matches) { say.innerHTML = html; typing = null; return; }
        typing = setInterval(() => {
          k += 2; if (k >= plain) { say.innerHTML = html; clearInterval(typing); typing = null; return; }
          say.innerHTML = cut(html, k);
        }, 28);
      };
      const next = () => {
        if (typing) { clearInterval(typing); typing = null; box.querySelector(".say").innerHTML = lines[i].text; return; }
        SND.play("tap"); i++;
        if (i >= lines.length) { box.hidden = true; dim.hidden = true; box.onclick = dim.onclick = null; box.onkeydown = null; talking = null; done(); return; }
        show();
      };
      box.onclick = dim.onclick = next;
      box.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); next(); } };
      talking = next;
      show();
      setTimeout(() => { const f = box.querySelector(".box"); f && f.focus({ preventScroll: true }); }, 30);
    });
  }
  function cut(html, n) { let out = "", c = 0; const re = /(<[^>]+>)|([^<])/g; let m; while ((m = re.exec(html)) && c < n) { if (m[1]) out += m[1]; else { out += m[2]; c++; } } return out; }

  /* ---------- シート（下から出る画面） ---------- */
  function sheet(html, bind) {
    closeSheet();
    const d = document.createElement("div"); d.className = "sheet"; d.id = "sheet";
    d.innerHTML = `<div class="in" role="dialog" aria-modal="true"><div class="grab"></div>${html}</div>`;
    d.addEventListener("click", (e) => { if (e.target === d) closeSheet(); });
    document.body.appendChild(d); bind && bind(d);
    const f = d.querySelector("button"); f && f.focus({ preventScroll: true });
    return d;
  }
  function closeSheet() { const s = document.getElementById("sheet"); if (s) s.remove(); }

  /* ---------- 画面の切り替え ---------- */
  function go(screen) { st.screen = screen; save(); render(); window.scrollTo(0, 0); }
  let lastScreen = null;
  function render() {
    const r = cur(); document.documentElement.style.setProperty("--role", r ? roleColor(r) : "#f2a53a");
    const f = { title: vTitle, roles: vRoles, intro: vIntro, a1: vA1, a2: vA2, a3: vA3, result: vResult }[st.screen] || vTitle;
    app.innerHTML = f();
    // 画面が変わったときだけ入場アニメーション（同じ画面の更新ではちらつかせない）
    const scr = app.querySelector(".screen,#title");
    if (scr && lastScreen === st.screen) scr.style.animation = "none";
    lastScreen = st.screen;
    bar();
    SND.bgm(st.screen === "a3" ? "tense" : st.screen === "title" || st.screen === "result" ? null : "calm");
  }

  /* ---------- タイトル ---------- */
  function vTitle() {
    const resumable = st.roles.length && st._last && st._last !== "roles";
    return `<section id="title"><div class="bg" style="background-image:url('${bg("ext")}')"></div>
      <div class="wrap">
        <div class="file"><span class="stamp">調査中</span><h1>臨場</h1><div class="case">株式会社 浜風珈琲（喫茶店）の調査</div></div>
        <p class="lead">あなたは税務署の調査官。班の仲間と<b>手分けして</b>、喫茶店の社長の説明が本当かどうかを確かめます。</p>
        <button class="btn btn-main" data-act="start">はじめる</button>
        ${resumable ? `<button class="btn btn-ghost" data-act="resume">続きから再開する</button>` : ""}
        <div class="t-foot"><span>これはゲームです。会社・人物・資料はすべて架空です。<br>所要 約30分。班ごとに、各自のスマホで遊びます。</span>${sndBtn()}</div>
      </div></section>`;
  }

  /* ---------- 担当えらび ---------- */
  function vRoles() {
    return `<section class="screen plain"><div class="wrap">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px"><p class="eyebrow">担当えらび</p>${sndBtn()}</div>
      <h2 style="font-size:22px">班で相談して、担当を分けよう</h2>
      ${todo("自分の担当をタップ（2つ以上選んでもOK）", "見られる資料・聞ける質問は担当ごとに違います。")}
      <div class="role-grid">${ORDER.map((r) => { const R = C.roles[r]; return `<button class="role-card" style="--c:${R.color}" data-act="role" data-r="${r}" aria-pressed="${has(r)}">
        <span class="mk">${R.mark}</span><strong>${R.name}</strong><span>${R.desc}</span></button>`; }).join("")}</div>
      <div class="also"><p><b>人数に合わせた分け方の例</b></p>
        <p class="muted" style="margin:0;font-size:12.5px;line-height:1.8">2人：代表＋売上／現金＋仕入れ<br>3人：代表＋売上／現金／仕入れ<br>4人：1人1つずつ<br>5〜6人：売上・仕入れなどを2人で持つ<br><b style="color:var(--amber)">代表は班に1人</b>。社長に証拠を示せるのは代表だけです。</p></div>
    </div></section>
    <div class="foot-act"><div class="in"><button class="btn btn-ghost" data-act="home">もどる</button><button class="btn btn-main" data-act="roles-ok" ${st.roles.length ? "" : "disabled"}>この担当で始める</button></div></div>`;
  }

  /* ---------- 導入 ---------- */
  function vIntro() {
    return `<section class="screen"><div class="wrap">
      <div class="scene-strip" data-label="〇〇税務署　調査部門" style="background-image:url('${bg("office")}')"></div>
      <div class="paper"><h3>今日の調査の流れ</h3>
        <table class="ledger"><tr><td><b>第1幕　準備調査</b><br><span class="cap">署で資料を読み、当たりをつける</span></td><td>約5分</td></tr>
        <tr><td><b>第2幕　臨場</b><br><span class="cap">お店に行き、話を聞き、現物を確かめる</span></td><td>約12分</td></tr>
        <tr><td><b>第3幕　検討と説明</b><br><span class="cap">証拠を組み合わせて、社長に説明する</span></td><td>約7分</td></tr></table></div>
      <div class="paper" style="margin-top:14px"><h3>このゲームの言葉</h3>
        <table class="ledger"><tr><td><b>税務調査</b></td><td style="text-align:left">申告（税金の届け出）が正しいかを、税務署が確かめること。</td></tr>
        <tr><td><b>臨場</b></td><td style="text-align:left">調査官が会社やお店に出向いて調べること。</td></tr>
        <tr><td><b>所得</b></td><td style="text-align:left">もうけ。売上から経費を引いた残り。税金はここにかかる。</td></tr>
        <tr><td><b>端緒</b></td><td style="text-align:left">（たんしょ）調べるきっかけになる不審な点。</td></tr></table></div>
    </div></section>
    <div class="foot-act"><div class="in"><button class="btn btn-ghost" data-act="intro-again">説明</button><button class="btn btn-main" data-act="to-a1">第1幕へ</button></div></div>`;
  }
  const INTRO = [
    { who: "mori", text: "指導役の森だ。今日はよろしく。" },
    { who: "mori", text: "相手は喫茶店「<b>浜風珈琲</b>」。今期の申告は<b>赤字</b>だが、数字にどうも引っかかるところがある。" },
    { who: "mori", text: "まずは署で資料を読んで、当たりをつける。それから店に行く。これを<b>臨場</b>という。" },
    { who: "mori", text: "資料は担当ごとに違う。<b>あなたしか持っていない手がかり</b>がある。見つけたら、声に出して班に伝えてくれ。" }
  ];

  /* ---------- 第1幕 ---------- */
  function switcher(screen) {
    const rs = myRoles(); if (rs.length < 2) return "";
    return `<div class="who-switch" role="group" aria-label="担当の切り替え">${rs.map((r) => `<button style="--c:${roleColor(r)}" data-act="cur" data-r="${r}" aria-pressed="${r === cur()}">${C.roles[r].name}</button>`).join("")}</div>`;
  }
  function vA1() {
    const r = cur(), P = C.prep[r];
    const found = st.a1.found.filter((k) => k.startsWith(r + ":"));
    const total = Object.keys(P.hits).length;
    const all = st.a1.found;
    return `<section class="screen"><div class="wrap">
      ${todo("気になる数字や文をタップしよう", `${C.roles[r].name}の資料です。見つけた点：${found.length} / ${total}`)}
      ${switcher()}
      <div class="paper ${st.a1.hint ? "hit-mode" : ""}" id="prepdoc"><span class="tag">${codeTag(P.code)}</span><h3>${P.title}</h3>${P.html}</div>
      ${st.a1.hint ? "" : `<button class="btn btn-ghost" style="margin-top:10px;min-height:44px;font-size:14px" data-act="hint1">森先輩のヒント（タップできる所を光らせる）</button>`}
      <div class="finds">${all.map((k) => { const [rr, h] = k.split(":"); const H = C.prep[rr].hits[h]; return `<div class="find ${H.good ? "" : "meh"}"><span class="dot"></span><span><span class="muted" style="font-size:11.5px">${C.roles[rr].name}</span><br>${H.text}</span></div>`; }).join("")}</div>
      ${huddle("<b>相談タイム</b>：担当ごとに、見つけた点を順番に読み上げよう。ほかの担当の資料とつながる点はある？")}
      <p class="eyebrow" style="margin-top:18px">当たりをつける</p>
      <h2 style="font-size:18px;margin:4px 0 10px">班で話して、確かめたい仮説を選ぼう（2つまで）</h2>
      <div class="hypo">${C.hypotheses.map((h) => `<button data-act="hypo" data-h="${h.id}" aria-pressed="${st.a1.hypo.includes(h.id)}">${h.text}</button>${st.a1.hypo.includes(h.id) ? `<div class="note" style="margin-top:0"><span>${h.note}</span></div>` : ""}`).join("")}</div>
    </div></section>
    <div class="foot-act"><div class="in"><button class="btn btn-main" data-act="to-a2" ${st.a1.hypo.length ? "" : "disabled"}>仮説を持って、お店へ向かう</button></div></div>`;
  }

  /* ---------- 第2幕 ---------- */
  const SCENE = { lead: ["office", "事務室"], sales: ["shop", "店内"], cash: ["office", "事務室"], buy: ["office", "事務室と倉庫"] };
  const HINT = {
    "代1": "土曜の夜にアルバイト？ <b>売上担当</b>が聞いた話と食い違わないか、確かめよう。",
    "売2": "土曜の夜に貸切が18回。<b>代表</b>にも伝えておこう。",
    "売3": "現金で受け取った85,000円は、どこへ行った？ <b>現金担当</b>に伝えよう。",
    "現1": "山海物産に払ったはずの30万円の出どころがない。<b>仕入れ担当</b>に伝えよう。",
    "現2": "85,000円……どこかで見た金額では？ <b>売上担当</b>に聞いてみよう。",
    "仕1": "領収書の字が気になる。事務室の机の中も調べたい。",
    "仕2": "量も値段も同じ。決算書の原価率と比べると……<b>代表</b>に伝えよう。",
    "仕3": "金額を好きに書ける領収書。お金は本当に払われたのか？ <b>現金担当</b>に聞いてみよう。"
  };
  function vA2() {
    const r = cur(), L = left(r), w = Math.max(0, (L / C.TIME) * 100);
    const last = st.a2.last && st.a2.last.r === r ? st.a2.last : null;
    const lastQ = last ? C.questions[r].find((q) => q.id === last.id) : null;
    const key = lastQ && lastQ.key ? C.statements[lastQ.key] : null;
    const tab = st.a2.tab;
    const qs = C.questions[r].map((q) => {
      const done = st.a2.asked.includes(q.id), no = !done && q.cost > L;
      return `<button class="q ${done ? "done" : ""}" data-act="ask" data-q="${q.id}" ${no ? "disabled" : ""}><span>${esc(q.q)}</span><span class="cost">${done ? "聞いた" : q.cost + "分"}</span></button>`;
    }).join("");
    const ps = C.places[r].map((p) => {
      const done = st.a2.seen.includes(p.code), no = !done && p.cost > L;
      return `<button class="place ${done ? "done" : ""}" data-act="place" data-p="${p.code}" ${no ? "disabled" : ""}>
        <span class="ph" style="background-color:${roleColor(r)}22">${p.open ? "🔒" : "📄"}</span>
        <span class="tx"><small>${esc(p.where)}</small><strong>${esc(p.name)}</strong></span>
        <span class="cost">${done ? `見た<br>${codeTag(p.code)}` : p.cost + "分" + (p.open ? "<br>開けてもらう" : "")}</span></button>`;
    }).join("");
    return `<section class="screen"><div class="wrap">
      ${switcher()}
      <div class="clock"><b>持ち時間</b><div class="bar"><i style="--w:${w}%"></i></div><b>あと${L}分</b></div>
      <div class="scene-strip" data-label="${SCENE[r][1]}" style="background-image:url('${bg(SCENE[r][0])}')"></div>
      <div class="boss-card"><div class="pic" role="img" aria-label="白洲社長" style="${faceCss(key ? "boss_smug" : "boss_grin", 1.9)}"></div>
        <div class="say"><small>白洲社長</small><p>${lastQ ? esc(lastQ.a) : "どうぞ、何でも聞いてください。うちは何もやましいことはありませんよ。"}</p>
        ${key ? `<span class="key">${numTag(key.num, key.by)}</span>` : ""}</div></div>
      <div class="tabs" role="tablist"><button role="tab" data-act="tab" data-t="ask" aria-selected="${tab === "ask"}">社長に聞く</button><button role="tab" data-act="tab" data-t="look" aria-selected="${tab === "look"}">現場を見る</button></div>
      ${tab === "ask" ? `<div class="qlist">${qs}</div>` : `<div class="places">${ps}</div><p class="disclaim">これはゲームです。実際の税務調査でも、書類を見せてもらったり、金庫や机を開けてもらったりするときは、必ず相手の<b>明示の承諾</b>を得ます。調査官が勝手に開けたり、お金や書類に触れたりはしません。</p>`}
      ${L < 10 ? `<p class="note">${C.roles[r].name}の持ち時間を使い切りました。${myRoles().length > 1 ? "ほかの担当に切り替えるか、" : ""}班の仲間に分かったことを伝えよう。</p>` : ""}
      ${huddle("<b>声をかけ合おう</b>：分かったことは、その場で班に伝えよう。<br>例「夜の売上は0円だった」「金庫に85,000円あった」")}
    </div></section>
    <div class="foot-act"><div class="in"><button class="btn btn-ghost" data-act="notes">メモ</button><button class="btn btn-main" data-act="end-a2">臨場を終えて署にもどる</button></div></div>`;
  }

  async function ask(id) {
    const r = cur(), q = C.questions[r].find((x) => x.id === id); if (!q) return;
    if (st.a2.asked.includes(id)) { st.a2.last = { r, id }; save(); render(); return; }
    if (q.cost > left(r)) return;
    st.a2.used[r] = (st.a2.used[r] || 0) + q.cost; st.a2.asked.push(id); st.a2.last = { r, id }; save();
    const lines = [{ who: "you", text: q.q }, { who: "boss", text: q.a, face: q.key ? "boss_smug" : "boss_grin", sfx: q.key ? "bossTick" : null }];
    if (q.key) { const S = C.statements[q.key]; lines.push({ who: null, text: `社長の発言を<b>メモに記録</b>した。<br>第3幕で、この発言のことを代表に伝えよう。`, sfx: "paper" }); }
    await talk(lines); render();
  }

  function place(code) {
    const r = C.codes[code].role, p = C.places[r].find((x) => x.code === code);
    if (st.a2.seen.includes(code)) { evidence(p, r); return; }
    if (p.cost > left(r)) return;
    sheet(`<p class="eyebrow">${esc(p.where)}</p><h2>${esc(p.name)}</h2>
      <p class="consent-lede">見る前に、社長の承諾をもらいます。<br>「<b>${esc(p.consent)}</b>」</p>
      <p class="muted" style="font-size:13px;margin:10px 0 0">持ち時間を<b>${p.cost}分</b>使います。</p>
      <p class="disclaim">これはゲームです。実際の調査でも、見せてもらう・開けてもらうには相手の明示の承諾が必要です。</p>
      <div class="acts"><button class="btn btn-main" data-x="ok">承諾をお願いする</button><button class="btn btn-ghost" data-x="no">やめておく</button></div>`, (d) => {
      d.querySelector('[data-x="no"]').onclick = closeSheet;
      d.querySelector('[data-x="ok"]').onclick = async () => {
        closeSheet();
        st.a2.used[r] = (st.a2.used[r] || 0) + p.cost; st.a2.seen.push(code); save();
        await talk([{ who: "you", text: p.consent }, { who: "boss", text: p.ok, face: p.open ? "boss_shock" : "boss_grin", sfx: p.open ? "unlock" : "open" }]);
        render(); evidence(p, r, true);
      };
    });
  }
  function evidence(p, r, first) {
    if (first) SND.play(p.decoy ? "paper" : "item");
    const hint = HINT[p.code];
    sheet(`<div class="ev-head">${codeTag(p.code, true)}<p><b style="color:var(--ink)">${esc(p.name)}</b><br>メモに入りました。第3幕で、代表に伝えよう。</p></div>
      <div class="paper">${p.doc()}</div>
      <div class="note"><span class="face-s" style="${faceCss("mori")}"></span><span>${p.note}${hint ? `<br><span class="muted">${hint}</span>` : ""}</span></div>
      <div class="acts"><button class="btn btn-main" data-x="close">メモに入れて閉じる</button></div>`, (d) => { d.querySelector('[data-x="close"]').onclick = closeSheet; });
  }

  /* 自分のメモ（聞いた発言・見た証拠・準備調査の資料） */
  function saidList() {
    return Object.keys(C.statements).filter((k) => { const S = C.statements[k]; const q = C.questions[S.by].find((x) => x.key === k); return q && st.a2.asked.includes(q.id); });
  }
  function myCodes() {
    const out = [];
    saidList().forEach((k) => { const S = C.statements[k]; out.push(`<div class="mycode">${numTag(S.num, S.by)}<span class="tx">「${esc(S.text)}」<small>社長の発言（${C.roles[S.by].name}が聞いた）</small></span></div>`); });
    myRoles().forEach((r) => { const P = C.prep[r]; out.push(`<div class="mycode">${codeTag(P.code)}<span class="tx">${esc(P.title)}<small>準備調査の資料</small></span></div>`); });
    st.a2.seen.forEach((c) => { const r = C.codes[c].role, p = C.places[r].find((x) => x.code === c); out.push(`<button class="mycode" data-act="ev" data-p="${c}">${codeTag(c)}<span class="tx">${esc(p.name)}<small>${strip(p.note)}</small></span></button>`); });
    return out.join("");
  }
  function notes() {
    sheet(`<h2>メモ</h2><p class="muted" style="font-size:13px;margin:0 0 10px">第3幕で、見つけたことを代表に口で伝えます。</p><div class="mycodes">${myCodes()}</div>
      <div class="acts"><button class="btn btn-ghost" data-x="close">閉じる</button></div>`, (d) => {
      d.querySelector('[data-x="close"]').onclick = closeSheet;
      d.querySelectorAll('[data-act="ev"]').forEach((b) => (b.onclick = () => { const c = b.dataset.p, r = C.codes[c].role; evidence(C.places[r].find((x) => x.code === c), r); }));
    });
  }

  /* ---------- 第3幕 ---------- */
  function vA3() {
    const lead = isLead();
    const mine = `<p class="eyebrow" style="margin-top:18px">あなたのメモ</p><div class="mycodes" style="margin-top:8px">${myCodes()}</div>`;
    if (!lead) {
      return `<section class="screen"><div class="wrap">
        ${todo("見つけたことを、代表に伝えよう", "「社長はこう言っていたけど、この証拠と食い違う」と話そう。")}
        ${huddle("<b>作戦会議</b>：社長のどの発言が、どの証拠と食い違う？ 違う担当の証拠を<b>2つ</b>組み合わせると、社長は言い逃れできません。")}
        ${mine}
      </div></section>
      <div class="foot-act"><div class="in"><button class="btn btn-ghost" data-act="to-result">ふりかえりへ<small>代表の説明が終わってから</small></button></div></div>`;
    }
    const slots = C.board.map(slotHtml).join("");
    return `<section class="screen"><div class="wrap">
      ${todo("仲間の話を聞いて、社長の発言を崩そう", "発言ごとに「証拠を選ぶ」を2回押し、「社長にぶつける」を押す")}
      ${huddle("<b>代表だけ</b>が社長に証拠を示せます。仲間に「何を見つけた？」と聞いて、組み合わせを決めよう。")}
      <div style="margin-top:14px">${slots}</div>
      ${mine}
    </div></section>
    <div class="foot-act"><div class="in"><button class="btn btn-ghost" data-act="end-a3" ${st.a3.won.length ? "" : "disabled"}>説明を終える</button></div></div>`;
  }
  function slotHtml(b) {
    const S = C.statements[b.id], won = st.a3.won.includes(b.id), pk = st.a3.picks[b.id] || [];
    const pick = (i) => { const c = pk[i]; return c ? `<button class="pick set" data-act="pick" data-s="${b.id}" data-i="${i}" ${won ? "disabled" : ""}>${codeTag(c)}<span>${esc(C.codes[c].name)}</span></button>` : `<button class="pick" data-act="pick" data-s="${b.id}" data-i="${i}">証拠を選ぶ</button>`; };
    return `<div class="slot ${won ? "won" : ""}">${won ? `<span class="won-tag">崩した！</span>` : ""}
      ${numTag(S.num, S.by)}<p class="st">社長「${esc(S.text)}」</p>
      <div class="pair">${pick(0)}<span class="plus">＋</span>${pick(1)}</div>
      ${won ? "" : `<button class="btn btn-red go" data-act="thrust" data-s="${b.id}" ${pk[0] && pk[1] ? "" : "disabled"}>社長にぶつける</button>`}</div>`;
  }
  // 証拠を一覧から選ぶ（担当ごとにまとめて表示）
  function evPick(sid, idx) {
    const pk = st.a3.picks[sid] || [], other = pk[1 - idx];
    const item = (code, name, sub) => `<button class="mycode" data-c="${code}" ${code === other ? "disabled style=\"opacity:.35\"" : ""}>${codeTag(code)}<span class="tx">${esc(name)}<small>${esc(sub)}</small></span></button>`;
    const groups = ORDER.map((r) => `<p class="eyebrow" style="margin:14px 0 6px;color:${roleColor(r)}">${C.roles[r].name}が調べた物</p><div class="mycodes">
      ${item(C.prep[r].code, C.prep[r].title, "準備調査の資料")}${C.places[r].map((p) => item(p.code, p.name, p.where)).join("")}</div>`).join("");
    sheet(`<h2>証拠を選ぶ</h2><p class="muted" style="font-size:13px;margin:0">仲間に「何を見つけた？」と聞いて選ぼう。</p>${groups}
      <div class="acts"><button class="btn btn-ghost" data-x="no">やめる</button></div>`, (d) => {
      d.querySelector('[data-x="no"]').onclick = closeSheet;
      d.querySelectorAll("[data-c]").forEach((btn) => (btn.onclick = () => {
        const p2 = (st.a3.picks[sid] = st.a3.picks[sid] || []); p2[idx] = btn.dataset.c; SND.play("click"); save(); closeSheet(); render();
      }));
    });
  }
  async function thrust(sid) {
    const b = C.board.find((x) => x.id === sid), pk = st.a3.picks[sid] || [];
    if (!pk[0] || !pk[1]) return;
    if (C.codes[pk[0]].role === C.codes[pk[1]].role) { toast("違う担当の証拠を組み合わせよう"); SND.play("wrong"); return; }
    const okA = (c) => b.need[0].includes(c), okB = (c) => b.need[1].includes(c);
    const win = (okA(pk[0]) && okB(pk[1])) || (okA(pk[1]) && okB(pk[0]));
    const half = !win && pk.some((c) => okA(c) || okB(c));
    st.a3.tries++; if (!win) st.a3.miss++;
    const S = C.statements[sid];
    const fo = document.createElement("div"); fo.id = "face-off";
    fo.innerHTML = `<div class="speed"></div><img src="${ch("boss_smug")}" alt="白洲社長">
      <div class="thrust"><small>代表が示した証拠</small><div>${codeTag(pk[0])}${esc(C.codes[pk[0]].name)}</div><div>${codeTag(pk[1])}${esc(C.codes[pk[1]].name)}</div></div>`;
    document.body.appendChild(fo); SND.play("slam");
    await wait(1100);
    const img = fo.querySelector("img");
    if (win) {
      st.a3.won.push(sid); save();
      flash(); fo.querySelector(".speed").classList.add("on"); img.src = ch("boss_shock"); fo.classList.add("shock"); SND.play("shock");
      const bn = document.createElement("div"); bn.className = "banner"; bn.innerHTML = `崩した！<small>発言${S.num}「${esc(S.text)}」</small>`; fo.appendChild(bn);
      await wait(1400); bn.remove();
      img.src = ch("boss_panic");
      await talk([{ who: "boss", text: b.win, face: "boss_panic" }]);
    } else {
      fo.classList.add("smug"); SND.play("laugh");
      await wait(500);
      await talk([{ who: "boss", text: half ? b.half : b.miss, face: "boss_smug" },
        { who: "mori", text: half ? "惜しい。<b>片方の証拠は効いている</b>。もう一つを、ほかの担当の証拠から探そう。" : "その組み合わせでは崩せないようだ。社長の発言と<b>直接食い違う</b>証拠はどれだろう？" }]);
    }
    fo.remove(); render();
    if (st.a3.won.length === C.board.length) finale();
  }
  async function finale() {
    const fo = document.createElement("div"); fo.id = "face-off"; fo.innerHTML = `<img src="${ch("boss_sad")}" alt="白洲社長">`; document.body.appendChild(fo);
    SND.play("win");
    await talk([{ who: "boss", text: "……すべて、おっしゃるとおりです。申し訳ありませんでした。", face: "boss_sad" },
      { who: "mori", text: "よくやった。班で手分けして集めた証拠が、ひとつにつながったな。" }]);
    fo.remove(); st.ended = true; go("result");
  }

  /* ---------- ふりかえり ---------- */
  function stars(n) { return "★".repeat(n) + "☆".repeat(3 - n); }
  function vResult() {
    const rs = myRoles();
    // 分析力：自分の資料で見つけた大事な点 ＋ 仮説
    let good = 0, goodAll = 0;
    rs.forEach((r) => Object.entries(C.prep[r].hits).forEach(([h, H]) => { if (H.good) { goodAll++; if (st.a1.found.includes(r + ":" + h)) good++; } }));
    const hypoOk = st.a1.hypo.some((h) => C.hypotheses.find((x) => x.id === h).good === true);
    const s1 = Math.max(1, Math.min(3, Math.round((goodAll ? good / goodAll : 0) * 2) + (hypoOk ? 1 : 0)));
    // 現場力：大事な発言・証拠をどれだけ集めたか（関係ない物を見た数は少しだけ引く）
    let key = 0, keyAll = 0, decoy = 0;
    rs.forEach((r) => {
      C.questions[r].forEach((q) => { if (q.key) { keyAll++; if (st.a2.asked.includes(q.id)) key++; } });
      C.places[r].forEach((p) => { if (p.decoy) { if (st.a2.seen.includes(p.code)) decoy++; } else { keyAll++; if (st.a2.seen.includes(p.code)) key++; } });
    });
    const s2 = Math.max(1, Math.min(3, Math.round((keyAll ? key / keyAll : 0) * 3) - (decoy > 1 ? 1 : 0)));
    const w = st.a3.won.length, s3 = w >= 4 && st.a3.miss <= 2 ? 3 : w >= 2 ? 2 : 1;
    return `<section class="screen"><div class="wrap">
      <div class="r-hero"><span class="stamp">調査完了</span>
        ${isLead() ? `<p style="margin:14px 0 0">崩した社長の発言　<b style="font-size:22px">${w} / ${C.board.length}</b></p>` : `<p class="muted" style="margin:14px 0 0;font-size:13px">崩した発言の数は、代表の画面で確認できます。</p>`}</div>
      <div class="paper"><h3>本当は何があったのか</h3>
        <p>① 土曜の夜の<b>貸切パーティーの売上</b>をレジに通さず、金庫の「別」の封筒に隠していた（18回）。</p>
        <p>② 白紙の領収書に自分で書き込み、<b>山海物産からの豆の仕入れ</b>をでっち上げていた（30万円×6回）。</p></div>
      <div class="amounts"><div><small>売上除外（売上を帳簿から外す）</small><strong>153万円</strong></div><div><small>架空経費（ない経費を計上）</small><strong>180万円</strong></div>
        <div><small>申告した所得</small><strong>−57万円</strong></div><div><small>正しい所得</small><strong style="color:var(--amber)">276万円</strong></div></div>
      <p class="eyebrow" style="margin-top:18px">あなたの調査</p>
      <div class="skills">
        <div class="skill"><strong>分析力</strong><span class="stars">${stars(s1)}</span><p>資料の数字から、不審な点（端緒）を見つけて当たりをつける力。</p></div>
        <div class="skill"><strong>現場力</strong><span class="stars">${stars(s2)}</span><p>承諾を得て話を聞き、現物を確かめる力。</p></div>
        ${isLead() ? `<div class="skill"><strong>立証力</strong><span class="stars">${stars(s3)}</span><p>発言と証拠をつなげて、相手が認める説明をする力。</p></div>` : ""}
      </div>
      <div class="learn"><h3>税務調査の仕事で大事なこと</h3><ol>
        <li><b>準備調査</b>：資料を読み、不審な点から当たりをつける。</li>
        <li><b>臨場</b>：相手の承諾を得て、話を聞き、現物を確かめる。</li>
        <li><b>検討と説明</b>：発言と証拠をつなげ、相手が納得できるように説明する。</li></ol>
        <p class="cap" style="margin-top:10px">実際の調査も、チームで分担し、声をかけ合いながら進めることがあります。</p></div>
      <p class="disclaim">これはゲームです。会社・人物・資料・金額はすべて架空です。実際の税務調査では、書類を見せてもらう・金庫や机を開けてもらうなどの際に、必ず相手の明示の承諾を得ます。</p>
    </div></section>
    <div class="foot-act"><div class="in"><button class="btn btn-ghost" data-act="reset">最初からやり直す</button></div></div>`;
  }

  /* ---------- 操作 ---------- */
  function confirmSheet(title, body, okLabel, fn) {
    sheet(`<h2>${title}</h2><p class="consent-lede">${body}</p><div class="acts"><button class="btn btn-main" data-x="ok">${okLabel}</button><button class="btn btn-ghost" data-x="no">もどる</button></div>`, (d) => {
      d.querySelector('[data-x="no"]').onclick = closeSheet;
      d.querySelector('[data-x="ok"]').onclick = () => { closeSheet(); fn(); };
    });
  }
  const ACT = {
    sound() { SND.unlock(); SND.toggle(); render(); },
    start() { if (st.roles.length && st._last && st._last !== "roles") { confirmSheet("最初から始めますか", "前回の進み具合は消えます。", "最初から始める", () => { st = fresh(); go("roles"); }); return; } st = fresh(); go("roles"); },
    resume() { const s = st._last || "a1"; go(s); },
    home() { go("title"); },
    role(el) { const r = el.dataset.r; st.roles = has(r) ? st.roles.filter((x) => x !== r) : st.roles.concat(r); SND.play("tap"); save(); render(); },
    "roles-ok"() {
      if (!st.roles.length) return;
      const go2 = () => { st.cur = myRoles()[0]; go("intro"); talk(INTRO); };
      if (!isLead()) confirmSheet("代表は決まっていますか", "班の中に<b>代表が1人</b>必要です。ほかの人が代表を選んでいれば、このまま進めてください。", "このまま進む", go2);
      else go2();
    },
    "intro-again"() { talk(INTRO); },
    async "to-a1"() { go("a1"); await talk([{ who: "mori", text: "まずは<b>準備調査</b>だ。手元の資料で、気になる数字や文をタップしてくれ。" }, { who: "mori", text: "見つけたら、<b>班のみんなに読み上げる</b>こと。ほかの担当の資料とつながるかもしれない。" }]); },
    cur(el) { st.cur = el.dataset.r; SND.play("tap"); save(); render(); },
    hint1() { st.a1.hint = true; save(); render(); },
    hypo(el) {
      const h = el.dataset.h, on = st.a1.hypo.includes(h);
      if (!on && st.a1.hypo.length >= 2) { toast("仮説は2つまで。外してから選ぼう"); return; }
      st.a1.hypo = on ? st.a1.hypo.filter((x) => x !== h) : st.a1.hypo.concat(h); SND.play("paper"); save(); render();
    },
    async "to-a2"() {
      const good = st.a1.hypo.some((h) => C.hypotheses.find((x) => x.id === h).good === true);
      await talk([{ who: "mori", text: good ? "いい当たりのつけ方だ。現場で確かめよう。" : "なるほど。仮説は現場で確かめるものだ。行ってみよう。" }]);
      go("a2"); SND.play("door");
      await talk([{ who: null, text: "浜風珈琲。社長の白洲が、笑顔で出迎えた。" },
        { who: "boss", text: "税務署の方？ うちは赤字ですよ。何もやましいことはありません。", face: "boss_grin" },
        { who: "mori", text: "社長の大事な発言と、見つけた証拠は<b>メモ</b>に残る。あとで代表が、それを社長にぶつけるんだ。" },
        { who: "mori", text: "持ち時間は担当ごとに<b>" + C.TIME + "分</b>。質問は10分、資料を見るのは20分かかる。何から調べるか、よく考えて。" },
        { who: "mori", text: "それから、書類を見る・金庫を開けるときは、<b>必ず社長の承諾</b>をもらうこと。勝手に触ってはいけない。" }]);
    },
    tab(el) { st.a2.tab = el.dataset.t; SND.play("tap"); save(); render(); },
    ask(el) { ask(el.dataset.q); },
    place(el) { place(el.dataset.p); },
    notes() { notes(); },
    "end-a2"() {
      confirmSheet("署にもどりますか", "もどると、もう現場は調べられません。<br><b>班の全員</b>がそろってから進みましょう。", "署にもどる", async () => {
        go("a3"); SND.play("car");
        await talk([{ who: "mori", text: "署にもどった。ここからは<b>検討と説明</b>だ。" },
          { who: "mori", text: "社長の発言のうち、証拠で崩せるものを探す。崩すには<b>違う担当の証拠を2つ</b>組み合わせること。" },
          { who: "mori", text: isLead() ? "社長に証拠を示せるのは<b>代表のあなただけ</b>。仲間の話を聞き取って、組み立ててくれ。" : "社長に証拠を示せるのは<b>代表だけ</b>だ。あなたが見つけたことを、代表に伝えてくれ。" }]);
      });
    },
    pick(el) { evPick(el.dataset.s, +el.dataset.i); },
    thrust(el) { thrust(el.dataset.s); },
    "end-a3"() { confirmSheet("説明を終えますか", `崩した発言は ${st.a3.won.length} / ${C.board.length} です。終えると、ふりかえりの画面に進みます。`, "説明を終える", () => { st.ended = true; go("result"); }); },
    "to-result"() { confirmSheet("ふりかえりへ進みますか", "答えが出ます。<b>代表の説明が終わってから</b>進んでください。", "ふりかえりへ", () => go("result")); },
    reset() { confirmSheet("最初からやり直しますか", "この端末の進み具合が消えます。", "やり直す", () => { st = fresh(); save(); go("title"); }); }
  };

  app.addEventListener("click", (e) => {
    SND.unlock();
    const hit = e.target.closest("[data-hit]");
    if (hit && st.screen === "a1") {
      const k = cur() + ":" + hit.dataset.hit, H = C.prep[cur()].hits[hit.dataset.hit];
      if (!st.a1.found.includes(k)) { st.a1.found.push(k); save(); SND.play(H.good ? "item" : "paper"); render(); toast(H.good ? "気になる点を見つけた" : "メモした"); }
      return;
    }
    const el = e.target.closest("[data-act]"); if (!el || el.disabled) return;
    const f = ACT[el.dataset.act]; if (f) f(el);
  });
  document.getElementById("bar").addEventListener("click", (e) => { const el = e.target.closest("[data-act]"); if (el && ACT[el.dataset.act]) ACT[el.dataset.act](el); });

  // 第1幕で見つけた所に印をつける（描画のあと）
  new MutationObserver(() => {
    if (st.screen !== "a1") return;
    const r = cur();
    app.querySelectorAll("[data-hit]").forEach((n) => { const k = r + ":" + n.dataset.hit; if (st.a1.found.includes(k)) { n.classList.add("found"); if (!C.prep[r].hits[n.dataset.hit].good) n.classList.add("meh"); } });
  }).observe(app, { childList: true });

  // 再開できるよう、最後の幕を覚えておく
  const _go = go; go = function (s) { if (["intro", "a1", "a2", "a3", "result"].includes(s)) st._last = s; _go(s); };
  if (st.screen !== "title") { st._last = st.screen; st.screen = "title"; }
  render();

  if (location.hash === "#debug") window.__rinjo = { get st() { return st; }, set st(v) { st = v; }, go, render, talk, ACT, next: () => talking && talking() };
})();
