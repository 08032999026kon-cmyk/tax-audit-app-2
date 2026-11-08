/* 臨場 v4 ― 司会主導の説明会向け。
 *  スクリーン：司会が「端緒」と「社長の言い分」を説明する（host.html）
 *  スマホ：①事務所の資料（約30点）から当たりをつけて1人6点まで見る → ②班で相談（班長が言い分ごとに資料を1つ選ぶ）
 *         → 社長に示す → 結果（答え合わせはスクリーンで）
 * 通信はしない。各自のスマホで遊び、見つけたことは口で伝え合う。
 * 保存は localStorage（"rinjo:v4"）。URL の末尾に #debug で window.__rinjo が使える。
 */
(function () {
  "use strict";
  const C = window.CASE;
  const A = window.ASSETS || { bg: {}, ch: {} };
  const SND = window.SOUND || { play() {}, bgm() {}, unlock() {}, toggle() { return false; }, on: false };
  const KEY = "rinjo:v5";
  const app = document.getElementById("app");
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const strip = (h) => String(h).replace(/<[^>]+>/g, "");
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const claim = (id) => C.claims.find((c) => c.id === id);

  /* ---------- 状態 ---------- */
  function fresh() { return { v: 5, screen: "title", seen: [], allowed: [], marks: [], tags: {}, at: null, spotAt: null, leader: false, picks: {}, outcome: null, hints: {}, started: false }; }
  let st = load();
  function load() { try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.v === 5) return s; } catch (e) {} return fresh(); }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {} }
  const left = () => Math.max(0, C.LIMIT - st.seen.length);
  const seen = (id) => st.seen.includes(id);
  const allowed = (spotId) => st.allowed.includes(spotId);
  const marked = (id) => st.marks.includes(id);
  const docName = (id) => C.doc(id).name;
  const docWhere = (id) => { const d = C.doc(id), sp = C.spot(d.spot), a = C.areas.find((x) => x.id === sp.area); return `${a.name}・${sp.name}`; };

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
  const PEOPLE = { mori: { name: "森先輩（指導役）", face: "mori" }, boss: { name: "白洲社長", face: "boss_grin" }, you: { name: "あなた（調査官）", face: null } };

  /* ---------- 部品 ---------- */
  const ICON = {
    snd: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/></svg>',
    mute: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M17 9l5 6M22 9l-5 6"/></svg>',
    hint: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/></svg>',
    say: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 5h16v11H9l-5 4z"/><path d="M8 9h8M8 12.5h5"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5 9-10"/></svg>',
    doc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12h6M9 16h6"/></svg>',
    lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/></svg>',
    talk: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 5h11a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H9l-4 3v-3H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z"/><path d="M19 9h1a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-1v3l-3-3h-3"/></svg>'
  };
  const sndBtn = () => `<button class="ib ${SND.on ? "" : "off"}" data-act="sound" aria-label="音を${SND.on ? "消す" : "出す"}">${SND.on ? ICON.snd : ICON.mute}</button>`;
  const mission = (title, sub) => `<div class="mission"><h1>${title}</h1>${sub ? `<p>${sub}</p>` : ""}</div>`;
  const cta = (inner) => `<div class="cta"><div class="in">${inner}</div></div>`;
  const claimTag = (id) => id === "none" ? `<span class="ctag none">くずせなさそう</span>` : `<span class="ctag">言い分${id}</span>`;
  function toast(t) { const o = document.getElementById("toast"); if (o) o.remove(); const d = document.createElement("div"); d.id = "toast"; d.innerHTML = t; document.body.appendChild(d); setTimeout(() => d.remove(), 2600); }
  function flash() { const f = document.getElementById("flash"); f && f.animate && f.animate([{ opacity: 0.85 }, { opacity: 0 }], { duration: 420, easing: "ease-out" }); }
  const quote = (c, small) => `<div class="claim-card"><span class="cid">${c.id}</span><div><small>${small || "社長の言い分"}</small><p>「${esc(c.text)}」</p></div></div>`;

  /* ---------- 上のバー ---------- */
  const PHASES = ["調べる", "班で相談", "社長に示す"];
  function phase() { return { brief: 1, map: 1, place: 1, share: 2, answer: 2, result: 3 }[st.screen] || 0; }
  function bar() {
    const b = document.getElementById("bar"); const n = phase();
    if (!n) { b.hidden = true; return; }
    b.hidden = false;
    b.innerHTML = `<div class="row">
        <div class="where"><span class="sn">${n}<i>/3</i></span><span class="nm">${PHASES[n - 1]}</span></div>
        ${n < 3 ? `<button class="ib" data-act="claims">${ICON.say}<span>言い分</span></button><button class="ib hint" data-act="hint">${ICON.hint}<span>ヒント</span></button>` : ""}
        ${sndBtn()}</div>
      <div class="segs s3">${PHASES.map((_, i) => `<i class="${i < n ? "on" : ""}"></i>`).join("")}</div>`;
  }

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
        voice(L.v);
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
        SND.play("tap"); i++; voice(null);
        if (i >= lines.length) { box.hidden = true; dim.hidden = true; box.onclick = dim.onclick = null; box.onkeydown = null; talking = null; done(); return; }
        show();
      };
      box.onclick = dim.onclick = next;
      box.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); next(); } };
      talking = next; show();
      setTimeout(() => { const f = box.querySelector(".box"); f && f.focus({ preventScroll: true }); }, 30);
    });
  }
  // 声：voice/<id>.mp3 があれば流す（なければ何もしない）。音を消しているときは流さない
  let vEl = null;
  function voice(id) {
    if (vEl) { try { vEl.pause(); } catch (e) {} vEl = null; }
    if (!id || !SND.on) return;
    try { vEl = new Audio(`voice/${id}.mp3`); vEl.setAttribute("playsinline", ""); const p = vEl.play(); p && p.catch && p.catch(() => {}); } catch (e) {}
  }
  function cut(html, n) { let out = "", c = 0; const re = /(<[^>]+>)|([^<])/g; let m; while ((m = re.exec(html)) && c < n) { if (m[1]) out += m[1]; else { out += m[2]; c++; } } return out; }

  /* ---------- シート（下から出る紙） ---------- */
  function sheet(html, bind) {
    closeSheet();
    const d = document.createElement("div"); d.className = "sheet"; d.id = "sheet";
    d.innerHTML = `<div class="in" role="dialog" aria-modal="true"><div class="grab"></div>${html}<div class="acts"><button class="btn btn-ghost" data-x="close">閉じる</button></div></div>`;
    d.addEventListener("click", (e) => { if (e.target === d || e.target.closest('[data-x="close"]')) closeSheet(); });
    document.body.appendChild(d); bind && bind(d);
    return d;
  }
  function closeSheet() { const s = document.getElementById("sheet"); if (s) s.remove(); }
  function confirmSheet(title, body, okLabel, fn) {
    sheet(`<h2>${title}</h2><p class="lede">${body}</p><div class="acts"><button class="btn btn-main" data-x="ok">${okLabel}</button></div>`, (d) => {
      d.querySelector('[data-x="close"]').textContent = "もどる";
      d.querySelector('[data-x="ok"]').onclick = () => { closeSheet(); fn(); };
    });
  }

  /* ---------- 画面の切り替え ---------- */
  let lastKey = null;
  function go(screen) { const t = document.getElementById("toast"); if (t) t.remove(); closeSheet(); st.screen = screen; save(); render(); window.scrollTo(0, 0); }
  function render() {
    const f = { title: vTitle, brief: vBrief, map: vMap, spot: vSpot, place: vPlace, share: vShare, answer: vAnswer, result: vResult }[st.screen] || vTitle;
    if (window.SCENE3D) SCENE3D.hide();
    app.innerHTML = f();
    if (st.screen === "spot") mount3d();
    const key = st.screen + st.at + st.spotAt + st.stage;
    const scr = app.querySelector(".screen,#title");
    if (scr && lastKey === key) scr.style.animation = "none";
    lastKey = key;
    bar();
    SND.bgm(st.screen === "title" || st.screen === "result" ? null : st.screen === "answer" ? "tense" : "calm");
  }

  /* ---------- タイトル ---------- */
  function vTitle() {
    return `<section id="title"><div class="bg" style="background-image:url('${bg("office")}')"></div>
      <div class="wrap">
        <div class="file"><span class="stamp">調査中</span><p class="kick">税務調査 体験ゲーム</p><h1>臨場</h1><div class="case">白洲リフォーム株式会社の調査</div></div>
        <p class="lead">あなたは税務署の調査官。<br>社長の言い分が本当か、事務所で<b>証拠</b>を探して確かめよう。</p>
        <div class="wait-note">${ICON.talk}<span><b>スクリーンの説明を聞いてから</b>、はじめてください。</span></div>
        ${st.started ? `<button class="btn btn-main" data-act="resume">続きから</button><button class="btn btn-ghost" data-act="reset">最初からやり直す</button>` : `<button class="btn btn-main" data-act="start">はじめる</button>`}
        <div class="t-foot"><span>登場する会社・人物・資料は、すべて架空です。<br>音は右の ${ICON.snd.replace("<svg", '<svg class="inl"')} でいつでも消せます。</span>${sndBtn()}</div>
      </div></section>`;
  }

  /* ---------- 言い分の確認 ---------- */
  function vBrief() {
    return `<section class="screen"><div class="wrap">
      ${mission("社長の<em>言い分</em>を、証拠でくずそう", "スクリーンで見た3つの言い分です。事務所で証拠を探して、本当かどうか確かめます。")}
      <div class="claims">${C.claims.map((c) => quote(c)).join("")}</div>
      <details class="words"><summary>スクリーンで見た「不審な点」（端緒）</summary>
        <p class="words-lede"><b>端緒（たんちょ）</b>＝調べるきっかけになる、不審な点のこと。</p>
        <ul class="tancho">${C.tancho.map((t) => `<li><b>${esc(t.big)}</b><span>${esc(t.text)}</span></li>`).join("")}</ul>
      </details>
      <div class="rules">
        <div><span class="n">1</span><p>事務所には<b>${C.docs.length}点</b>の資料がある。でも、見られるのは<b>1人${C.LIMIT}点まで</b>。</p></div>
        <div><span class="n">2</span><p>どの資料を見れば言い分を確かめられるか、<b>当たり</b>（見当）をつけよう。その付け方を<b>班で相談</b>して、手分けしよう。</p></div>
        <div><span class="n">3</span><p>見るときは、まず社長に<b>お願いして承諾をもらう</b>。</p></div>
      </div>
    </div></section>${cta(`<button class="btn btn-main" data-act="to-map">事務所に入る</button>`)}`;
  }

  /* ---------- 事務所の中：どの資料を見る？ ---------- */
  function vMap() {
    const n = left();
    const dots = Array.from({ length: C.LIMIT }, (_, i) => `<i class="${i < st.seen.length ? "used" : ""}"></i>`).join("");
    return `<section class="screen"><div class="wrap">
      ${mission(n ? "どの資料を見る？ <em>当たり</em>をつけよう" : "見られる数を使い切りました", n ? `事務所には${C.docs.length}点の資料。どれを見れば言い分を確かめられるか、班で相談しながら選ぼう。` : "下のボタンで、班の相談へ進もう。")}
      <div class="left ${n ? "" : "zero"}"><div class="dots4">${dots}</div><p>見られるのは あと <b>${n}</b> 点</p></div>
      <p class="mark-help"><span class="star on">★</span>＝当たりの印（見なくてもつけられます）。相談のメモにどうぞ。</p>
      ${C.areas.map((a) => `<div class="area">
        <div class="area-head" style="background-image:url('${bg(a.bg)}')"><span>${esc(a.name)}</span></div>
        <div class="spots">${C.spots.filter((sp) => sp.area === a.id).map(spotCard).join("")}</div></div>`).join("")}
    </div></section>${cta(`<button class="btn ${n ? "btn-ghost" : "btn-main"}" data-act="to-share">${n ? "見終わったら：班の相談へ" : "班の相談へ進む"}</button>`)}`;
  }
  function spotCard(sp) {
    const ds = C.docs.filter((d) => d.spot === sp.id), ns = ds.filter((d) => seen(d.id)).length, nm = ds.filter((d) => marked(d.id)).length;
    return `<button class="spotcard ${ns ? "has" : ""}" data-act="spot" data-s="${sp.id}">
      <span class="sc-name">${sp.open ? ICON.lock : ""}${esc(sp.name)}</span>
      <span class="sc-sub">資料 ${ds.length}点${allowed(sp.id) ? "・承諾ずみ" : ""}${ns ? `・<b>${ns}点 見た</b>` : ""}${nm ? `・<i class="star on">★</i>${nm}` : ""}</span>
      <span class="sc-go">›</span></button>`;
  }
  /* ---------- 場所（3Dの机や棚） ---------- */
  const LAYOUT3D = { top: "desk", acct: "desk", drawer: "drawer", wall: "wall", rest: "wall", cabinet: "shelf", store: "shelf", safe: "safe", guest: "table" };
  const KIND3D = { bank: "book", ledger: "book", receiptbook: "book", payroll: "book", invoices: "stack", blank: "stack", memo: "note", letter: "note", bizcard: "card",
    news: ["paper", "news"], utility: "paper", deed: ["paper", "letter"], flyer: ["paper", "flyer"], magazine: ["paper", "news"], photo: "photo", board: "board", license: "frame",
    calendar: "poster", safety: "poster", estimate: "binder", album: "binder", contracts: "binder", lastyear: "binder", car: "binder", delivery: "binder", tools: "binder", scrap: "binder",
    nippou: "clip", attendance: "clip", bento: ["clip", "note"], safe: "envelope" };
  function mount3d() {
    const host = app.querySelector("#s3d-host"); if (!host || !window.SCENE3D || !SCENE3D.ok) return;
    const sp = C.spot(st.spotAt); if (!sp) return;
    const items = C.docs.filter((d) => d.spot === sp.id).map((d) => {
      const k = [].concat(KIND3D[d.id] || "paper");
      return { id: d.id, name: d.name, kind: k[0], style: k[1], seen: seen(d.id), marked: marked(d.id), lock: !seen(d.id) && !left() };
    });
    try { if (SCENE3D.show(host, LAYOUT3D[sp.id] || "desk", items, (id) => ACT.doc({ dataset: { d: id } }))) host.classList.add("on"); } catch (e) { console.warn(e); }
  }
  function vSpot() {
    const sp = C.spot(st.spotAt); if (!sp) return vMap();
    const a = C.areas.find((x) => x.id === sp.area), ds = C.docs.filter((d) => d.spot === sp.id);
    const back = `<button class="back" data-act="to-map">← 場所えらびにもどる</button>`;
    if (!allowed(sp.id)) {
      return `<section class="screen"><div class="wrap">${back}
        ${mission(esc(sp.name), `${esc(a.name)}・資料 ${ds.length}点`)}
        <div class="scene" style="background-image:url('${bg(a.bg)}')"><div class="boss" style="${faceCss("boss_grin", 1.9)}"></div><p>「何か見たいものでも？」<small>白洲社長</small></p></div>
        <div class="consent"><span class="tag">承諾をもらう</span>
          <p>「${esc(sp.name)}」を見る前に、社長にこうお願いします。</p>
          <blockquote>「${esc(sp.ask)}」</blockquote></div>
        <p class="disclaim">${sp.open ? "<b>これはゲームです。</b>実際の税務調査では、調査官が自分で机や金庫を開けたり、お金に触れたりはしません。必ず相手の<b>明示の承諾</b>を得て、開けて見せてもらいます。" : "実際の税務調査でも、書類は相手の<b>明示の承諾</b>を得てから見せてもらいます。"}</p>
      </div></section>${cta(`<button class="btn btn-main" data-act="ask">社長にお願いする<small>お願いするだけなら、見られる数は減りません</small></button>`)}`;
    }
    const n = left();
    return `<section class="screen"><div class="wrap">${back}
      ${mission(esc(sp.name), `気になる資料を<b>タップ</b>しよう。見られるのは あと <b>${n}</b> 点。`)}
      <div id="s3d-host"></div>
      <p class="s3d-hint">左右になぞると、少し見回せます</p>
      <p class="grp">${esc(sp.name)}にある資料（${ds.length}点）</p>
      <div class="tiles">${ds.map(tile).join("")}</div>
      <p class="disclaim">${sp.open ? "<b>ゲームの表現です。</b>実際は社長の明示の承諾を得て、開けて見せてもらいます。" : "社長の承諾を得て見せてもらっています。"}</p>
    </div></section>${cta(`<button class="btn btn-ghost" data-act="to-map">ほかの場所を見る</button>`)}`;
  }
  function tile(d) {
    const s = seen(d.id), lock = !s && !left(), tag = st.tags[d.id];
    return `<button class="tile ${s ? "seen" : ""} ${lock ? "lock" : ""} ${marked(d.id) ? "marked" : ""}" data-act="doc" data-d="${d.id}">
      <span class="t-name">${esc(d.name)}</span>
      <span class="t-foot">${s ? `<i class="ok">${ICON.check}見た</i>` : ""}${s && tag ? claimTag(tag) : ""}${marked(d.id) ? '<i class="star on">★</i>' : ""}</span></button>`;
  }

  /* ---------- 1点を見る ---------- */
  function vPlace() {
    const d = C.doc(st.at); if (!d) return vMap();
    const sp = C.spot(d.spot), a = C.areas.find((x) => x.id === sp.area);
    const back = `<button class="back" data-act="to-spot">← ${esc(sp.name)}にもどる</button>`;
    const star = `<button class="btn btn-ghost star-btn ${marked(d.id) ? "on" : ""}" data-act="mark">${marked(d.id) ? "★ 当たりの印をはずす" : "☆ 当たりの印をつける"}</button>`;
    if (!allowed(sp.id)) {
      return `<section class="screen"><div class="wrap">${back}
        ${mission(esc(d.name), esc(docWhere(d.id)))}
        <div class="scene" style="background-image:url('${bg(a.bg)}')"><div class="boss" style="${faceCss("boss_grin", 1.9)}"></div><p>「何か見たいものでも？」<small>白洲社長</small></p></div>
        <div class="consent"><span class="tag">承諾をもらう</span>
          <p>「${esc(sp.name)}」のものを見る前に、社長にこうお願いします。</p>
          <blockquote>「${esc(sp.ask)}」</blockquote></div>
        <p class="disclaim">${sp.open ? "<b>これはゲームです。</b>実際の税務調査では、調査官が自分で机や金庫を開けたり、お金に触れたりはしません。必ず相手の<b>明示の承諾</b>を得て、開けて見せてもらいます。" : "実際の税務調査でも、書類は相手の<b>明示の承諾</b>を得てから見せてもらいます。"}</p>
      </div></section>${cta(`<button class="btn btn-main" data-act="ask">社長にお願いする<small>お願いするだけなら、見られる数は減りません</small></button>`)}`;
    }
    if (!seen(d.id)) {
      const others = C.docs.filter((x) => x.spot === sp.id);
      return `<section class="screen"><div class="wrap">${back}
        ${mission(esc(d.name), esc(docWhere(d.id)))}
        <div class="closed-doc">${ICON.doc}<p>この資料を見ますか？<br><small>見られるのは あと <b>${left()}</b> 点です。</small></p></div>
        <p class="grp">${esc(sp.name)}にある資料</p>
        <div class="tiles">${others.map(tile).join("")}</div>
      </div></section>${cta(`${star}<button class="btn btn-main" data-act="view" ${left() ? "" : "disabled"}>${left() ? `見る<small>あと ${left()} 点 → ${left() - 1} 点</small>` : "もう見られません"}</button>`)}`;
    }
    const tag = st.tags[d.id];
    return `<section class="screen"><div class="wrap">${back}
      ${mission(esc(d.name), esc(docWhere(d.id)))}
      <div class="paper">${d.doc}</div>
      <div class="noticed"><small>気づいたこと</small><p>${d.note}</p></div>
      <h2 class="q">この資料で、どの言い分をくずせそう？</h2>
      <div class="pickc">${C.claims.map((c) => `<button data-act="tag" data-t="${c.id}" aria-pressed="${tag === c.id}"><span class="cid">${c.id}</span><span>${esc(c.short)}</span></button>`).join("")}
        <button data-act="tag" data-t="none" aria-pressed="${tag === "none"}" class="none"><span class="cid">－</span><span>くずせなさそう</span></button></div>
      <p class="after">あなたの考えでかまいません。あとで班に伝えるときのメモになります。</p>
    </div></section>${cta(`<button class="btn ${tag ? "btn-main" : "btn-ghost"}" data-act="to-spot">${esc(sp.name)}にもどる</button>`)}`;
  }

  /* ---------- 班で相談 ---------- */
  function vShare() {
    const list = st.seen.map(C.doc);
    return `<section class="screen"><div class="wrap">
      <div class="talk-badge">${ICON.talk}班で相談</div>
      ${mission("見つけたことを、<em>班に伝えよう</em>", "1人ずつ、下のカードを読み上げよう。")}
      ${list.length ? `<div class="tells">${list.map((p, i) => `<div class="tell"><span class="no">${i + 1}</span><div><small>${esc(p.name)}（${esc(docWhere(p.id))}）${st.tags[p.id] ? claimTag(st.tags[p.id]) : ""}</small><p>${p.note}</p></div></div>`).join("")}</div>`
        : `<p class="empty">まだ資料を見ていません。</p>`}
      ${left() ? `<button class="more" data-act="to-map">まだ ${left()} 点見られます →</button>` : ""}
      <div class="leader-box">
        <h2>次に、<b>班長</b>を1人決めよう</h2>
        <p>班長は、みんなの話を聞いて、言い分ごとに<b>決め手の資料</b>を選び、社長に示します。決まらなければ、スクリーンの指示に従ってください。</p>
        <button class="btn btn-main" data-act="be-leader">私が班長（答えを入力する）</button>
        <p class="after">班長でない人は、このまま班長のスマホをいっしょに見よう。</p>
      </div>
    </div></section>`;
  }

  /* ---------- 班長：言い分ごとに証拠を選ぶ ---------- */
  function vAnswer() {
    const all = C.claims.every((c) => st.picks[c.id]);
    return `<section class="screen"><div class="wrap">
      <button class="back" data-act="to-share">← 班で相談にもどる</button>
      <div class="talk-badge lead">班長</div>
      ${mission("言い分ごとに、<em>決め手の証拠</em>を1つ選ぼう", "みんなの話を聞いて選ぼう。あなたが見ていない資料も選べます。")}
      <div class="answers">${C.claims.map((c) => {
        const p = st.picks[c.id] && C.doc(st.picks[c.id]);
        return `<div class="ans-row">${quote(c)}
          <button class="pickbtn ${p ? "set" : ""}" data-act="choose" data-c="${c.id}">${p ? `<span>示す証拠</span><b>${esc(p.name)}</b><i>変える</i>` : `<span>示す証拠</span><b>＋ 証拠を選ぶ</b>`}</button></div>`;
      }).join("")}</div>
    </div></section>${cta(`<button class="btn btn-red" data-act="show" ${all ? "" : "disabled"}>社長に証拠を示す${all ? "" : "<small>3つとも選ぶと押せます</small>"}</button>`)}`;
  }
  function chooseSheet(cid) {
    const c = claim(cid);
    sheet(`<h2>どの資料を示しますか</h2>${quote(c)}
      ${C.spots.map((sp) => `<p class="grp">${esc(C.areas.find((a) => a.id === sp.area).name)}・${esc(sp.name)}</p><div class="choices">${C.docs.filter((d) => d.spot === sp.id).map((d) =>
        `<button data-p="${d.id}" aria-pressed="${st.picks[cid] === d.id}"><b>${esc(d.name)}</b>${seen(d.id) ? `<small>あなたが見た${st.tags[d.id] ? `・${st.tags[d.id] === "none" ? "くずせなさそう" : "言い分" + st.tags[d.id]}` : ""}</small>` : marked(d.id) ? "<small>★ 当たりの印</small>" : ""}</button>`).join("")}</div>`).join("")}`,
      (d) => d.querySelectorAll(".choices button").forEach((b) => b.onclick = () => { st.picks[cid] = b.dataset.p; SND.play("click"); save(); closeSheet(); render(); }));
  }

  /* ---------- 社長に示す ---------- */
  async function showdown() {
    const fo = document.createElement("div"); fo.id = "face-off";
    fo.innerHTML = `<div class="speed"></div><img src="${ch("boss_grin")}" alt="白洲社長">`;
    document.body.appendChild(fo);
    const img = fo.querySelector("img");
    const out = {};
    await talk([{ who: "boss", text: "それで、何か分かりましたか？ うちは赤字ですよ。", face: "boss_grin", v: "boss_start" }]);
    for (const c of C.claims) {
      const pid = st.picks[c.id], p = C.doc(pid), ok = c.ok.includes(pid);
      img.src = ch("boss_smug"); fo.classList.remove("shock", "smug");
      await talk([{ who: "boss", text: c.text, face: "boss_smug", sfx: "bossTick", v: `boss_claim_${c.id}` }]);
      const th = document.createElement("div"); th.className = "thrust";
      th.innerHTML = `<small>言い分${c.id}に示した証拠</small><div>${esc(p.name)}</div>`;
      fo.appendChild(th); SND.play("slam");
      await wait(900);
      if (ok) {
        out[c.id] = "win";
        flash(); fo.querySelector(".speed").classList.add("on"); img.src = ch("boss_shock"); fo.classList.add("shock"); SND.play("shock");
        const bn = document.createElement("div"); bn.className = "banner"; bn.innerHTML = `くずした！<small>言い分${c.id}「${esc(c.short)}」</small>`; fo.appendChild(bn);
        await wait(1300); bn.remove(); img.src = ch("boss_panic");
        await talk([{ who: "boss", text: c.win, face: "boss_panic", v: `boss_win_${c.id}` }]);
      } else {
        out[c.id] = "miss";
        fo.classList.add("smug"); SND.play("laugh"); await wait(400);
        await talk([{ who: "boss", text: (c.trap && c.trap[pid]) || c.miss, face: "boss_smug", v: c.trap && c.trap[pid] ? `boss_trap_${c.id}_${pid}` : `boss_miss_${c.id}` }]);
      }
      th.remove(); fo.querySelector(".speed").classList.remove("on");
    }
    const n = Object.values(out).filter((x) => x === "win").length;
    if (n === 3) {
      img.src = ch("boss_sad"); SND.play("win");
      await talk([{ who: "boss", text: "……すべて、おっしゃるとおりです。申し訳ありませんでした。", face: "boss_sad", v: "boss_final" },
        { who: "mori", text: "見事だ。班のみんなが別々に見つけた証拠が、ひとつにつながったな。", v: "mori_end_all" }]);
    } else {
      await talk([{ who: "mori", text: n ? `${n}つの言い分はくずせた。残りは、答え合わせで確かめよう。` : "今回はくずせなかった。どこに証拠があったのか、答え合わせで確かめよう。", v: n ? `mori_end_${n}` : "mori_end_0" }]);
    }
    fo.remove(); st.outcome = out; go("result");
  }

  /* ---------- 結果 ---------- */
  function vResult() {
    const out = st.outcome || {}; const n = Object.values(out).filter((x) => x === "win").length;
    const R = C.result;
    return `<section class="screen"><div class="wrap">
      <div class="r-hero"><span class="stamp">${n === 3 ? "立証" : "あと一歩"}</span>
        <p>社長の言い分を <b>${n} / 3</b> くずした</p></div>
      <div class="res-list">${C.claims.map((c) => `<div class="${out[c.id] === "win" ? "win" : "miss"}"><span class="cid">${c.id}</span><p>「${esc(c.short)}」<small>示した資料：${esc(docName(st.picks[c.id]))}</small></p><b>${out[c.id] === "win" ? "くずした" : "くずせず"}</b></div>`).join("")}</div>
      ${n === 3 ? `<div class="amounts"><div><small>売上除外（隠した売上）</small><strong class="hl">${R.sales}万円</strong></div><div><small>架空経費（ありもしない経費）</small><strong class="hl">${R.cost}万円</strong></div>
        <div><small>申告した所得</small><strong>${R.before}万円</strong></div><div><small>正しい所得</small><strong>${R.after}万円</strong></div></div>` : ""}
      <div class="look-up">${ICON.talk}<p><b>前のスクリーンを見てください。</b><br>これから答え合わせをします。</p></div>
      <button class="back" data-act="reset" style="margin-top:20px">最初からやり直す</button>
    </div></section>`;
  }

  /* ---------- 言い分・ヒント ---------- */
  function claimsSheet() {
    sheet(`<h2>社長の言い分</h2><div class="claims">${C.claims.map((c) => quote(c)).join("")}</div>
      <p class="grp">不審な点（端緒＝たんちょ）</p><ul class="tancho">${C.tancho.map((t) => `<li><b>${esc(t.big)}</b><span>${esc(t.text)}</span></li>`).join("")}</ul>`);
  }
  function hintSheet() {
    const draw = (d) => {
      d.querySelector(".hint-list").innerHTML = C.claims.map((c) => {
        const lv = st.hints[c.id] || 0;
        return `<div class="hint-row"><p class="h-q"><span class="cid">${c.id}</span>「${esc(c.short)}」をくずすには</p>
          ${c.hint.slice(0, lv).map((h) => `<p class="h-a">${esc(h)}</p>`).join("")}
          ${lv < c.hint.length ? `<button class="h-more" data-h="${c.id}">${lv ? "もっとヒント" : "ヒントを見る"}</button>` : ""}</div>`;
      }).join("");
      d.querySelectorAll(".h-more").forEach((b) => b.onclick = () => { st.hints[b.dataset.h] = (st.hints[b.dataset.h] || 0) + 1; SND.play("paper"); save(); draw(d); });
    };
    sheet(`<div class="mori-say"><span class="pic" style="${faceCss("mori", 1.6)}"></span><p><b>森先輩</b>どの言い分から考える？ 見たいものだけ開こう。</p></div><div class="hint-list"></div>`, draw);
  }

  /* ---------- 操作 ---------- */
  const ACT = {
    sound() { SND.unlock(); SND.toggle(); if (!SND.on) voice(null); render(); },
    async start() {
      st = fresh(); st.started = true; go("brief"); SND.play("paper");
      await talk([{ who: "mori", text: "指導役の森だ。スクリーンで見たとおり、相手は「<b>白洲リフォーム</b>」の白洲社長。", v: "mori_start_1" },
        { who: "mori", text: "社長の<b>3つの言い分</b>が本当か、事務所で証拠を探して確かめよう。迷ったら上の<b>「ヒント」</b>を押してくれ。", v: "mori_start_2" }]);
    },
    resume() { go(resumeTo && resumeTo !== "title" ? resumeTo : "brief"); },
    reset() { confirmSheet("最初からやり直しますか", "この端末の進み具合が消えます。", "やり直す", () => { st = fresh(); save(); go("title"); }); },
    async "to-map"() {
      const first = st.screen === "brief" && !st.seen.length;
      go("map");
      if (first) { SND.play("door"); await talk([{ who: "boss", text: "税務署の方？ うちは赤字ですよ。どうぞ、何でも見てください。", face: "boss_grin", v: "boss_hello" }]); }
    },
    doc(el) { const d = C.doc(el.dataset.d); if (!d) return; st.at = d.id; st.spotAt = d.spot; SND.play("tap"); go("place"); },
    spot(el) { st.spotAt = el.dataset.s; SND.play("tap"); go("spot"); },
    "to-spot"() { const d = C.doc(st.at); if (d) st.spotAt = d.spot; go(st.spotAt ? "spot" : "map"); },
    async ask() {
      const sp = st.screen === "spot" ? C.spot(st.spotAt) : C.spot((C.doc(st.at) || {}).spot); if (!sp || allowed(sp.id)) return;
      await talk([{ who: "you", text: sp.ask }, { who: "boss", text: sp.ok, face: sp.open ? "boss_shock" : "boss_grin", sfx: sp.open ? "unlock" : "open", v: `boss_ok_${sp.id}` }]);
      st.allowed.push(sp.id); save(); render(); window.scrollTo(0, 0);
    },
    view() {
      const d = C.doc(st.at); if (!d || seen(d.id)) return;
      if (!left()) { toast("もう見られません。班の相談へ進もう"); return; }
      st.seen.push(d.id); SND.play("paper"); save(); render(); window.scrollTo(0, 0);
    },
    mark() { const id = st.at; st.marks = marked(id) ? st.marks.filter((x) => x !== id) : st.marks.concat(id); SND.play("click"); save(); render(); },
    tag(el) { st.tags[st.at] = el.dataset.t; SND.play("click"); save(); render(); },
    "to-share"() {
      if (left() && st.screen === "map") { confirmSheet("班の相談へ進みますか", `まだ <b>${left()}点</b> 見られます。あとからもどって見ることもできます。`, "班の相談へ", () => go("share")); return; }
      go("share");
    },
    "be-leader"() { st.leader = true; go("answer"); talk([{ who: "mori", text: "班長、たのむぞ。みんなの話を聞いて、言い分ごとに<b>決め手の資料</b>を1つずつ選ぼう。", v: "mori_leader" }]); },
    choose(el) { chooseSheet(el.dataset.c); },
    show() {
      if (!C.claims.every((c) => st.picks[c.id])) return;
      confirmSheet("社長に証拠を示しますか", "<b>やり直しはできません。</b>班のみんなと確認してから押してください。", "社長に示す", showdown);
    },
    claims() { claimsSheet(); },
    hint() { hintSheet(); }
  };

  app.addEventListener("click", (e) => {
    SND.unlock();
    const el = e.target.closest("[data-act]"); if (!el || el.disabled) return;
    const f = ACT[el.dataset.act]; if (f) f(el);
  });
  document.getElementById("bar").addEventListener("click", (e) => { SND.unlock(); const el = e.target.closest("[data-act]"); if (el && ACT[el.dataset.act]) ACT[el.dataset.act](el); });

  // 開き直したときは、いったんタイトルを出して「続きから」で前の画面へもどす
  let resumeTo = st.screen === "place" ? "map" : st.screen;
  st.screen = "title"; render();
  if (location.hash === "#debug") window.__rinjo = { get st() { return st; }, set st(v) { st = v; }, go, render, talk, ACT, next: () => talking && talking() };
})();
