/* 画面の見た目：イラストの背景を見回すカメラ、調べる印、人物の立ち絵、雨やほこりの演出
 * 画像の場所は js/assets.js（tools/make_assets.py が作る）
 */
(function () {
  "use strict";
  const A = window.ASSETS;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  /* 部屋ごとの配置（画像の左上=0,0 右下=100,100 の割合） */
  const ROOMS = {
    ext: {
      start: [50, 50, 1],
      glow: [[25, 14, 9, "#ffc56b"], [53, 56, 14, "#ffb347"], [76, 55, 12, "#ffb347"], [64, 52, 10, "#ffcf7a"], [10, 48, 10, "#ffd28a"]],
      fx: "rain", tint: "rgba(20,40,80,.18)"
    },
    shop: {
      start: [50, 52, 1],
      glow: [[31.8, 21.5, 7, "#ffd28a"], [48, 26.5, 5, "#ffd28a"], [51.5, 29, 4, "#ffd28a"], [73.5, 29, 6, "#ffd28a"], [77.3, 25, 7, "#ffd28a"], [36, 6.5, 4, "#ffd28a"], [75, 3.5, 4, "#ffd28a"]],
      fx: "dust", tint: "rgba(40,20,0,.08)"
    },
    office: {
      start: [50, 50, 1],
      glow: [[40, 31, 11, "#ffcf7a"], [64, 36, 9, "#9fd3ff"]],
      fx: "dust", tint: "rgba(40,20,0,.08)"
    }
  };
  const SPOTS = {
    register: { room: "shop", x: 22, y: 47 },
    calendar: { room: "shop", x: 17, y: 28 },
    shelf: { room: "shop", x: 75.5, y: 41 },
    trash: { room: "shop", x: 48, y: 75 },
    plant: { room: "shop", x: 88, y: 60 },
    pc: { room: "office", x: 64, y: 34 },
    photo: { room: "office", x: 14, y: 32 },
    boxes: { room: "office", x: 18, y: 70 },
    desk: { room: "office", x: 65, y: 58 },
    safe: { room: "office", x: 81, y: 73 }
  };
  const DOORS = { toOffice: { room: "shop", x: 65.5, y: 40, label: "事務室" } };
  /* 表情の名前 → 画像 */
  const FACE = {
    boss: { normal: "boss_grin", smile: "boss_grin", smug: "boss_smug", shock: "boss_shock", panic: "boss_panic", sad: "boss_sad" },
    mori: {}
  };
  const chKey = (who, expr) => (who === "mori" ? "mori" : FACE.boss[expr] || "boss_grin");

  const SC = { fast: false, room: null, onPick: null, spots: SPOTS, rooms: ROOMS };
  let view, camEl, bgA, glowEl, markEl, fxCv, fxG, actorsEl, signEl, edgeL, edgeR;
  const imgs = {};
  const cam = { x: 50, y: 50, z: 1 };
  let base = 1, iw = 1600, ih = 894;

  /* ---------- 読み込み ---------- */
  function load(src) {
    return new Promise((res) => { const im = new Image(); im.decoding = "async"; im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });
  }
  SC.init = async function (stage) {
    stage.innerHTML = `<div class="sc-view"><div class="sc-cam"><img class="sc-bg" alt="">
      <div class="sc-sign" hidden>浜風珈琲</div><div class="sc-sign v" hidden>珈琲</div><div class="sc-glow"></div><div class="sc-marks"></div></div>
      <div class="sc-tint"></div><canvas class="sc-fx"></canvas><div class="sc-actors"></div><div class="sc-grain"></div>
      <button class="sc-edge l" hidden aria-label="左にも調べる所があります"></button><button class="sc-edge r" hidden aria-label="右にも調べる所があります"></button></div>`;
    view = stage.querySelector(".sc-view"); camEl = stage.querySelector(".sc-cam");
    bgA = stage.querySelector(".sc-bg"); glowEl = stage.querySelector(".sc-glow"); markEl = stage.querySelector(".sc-marks");
    fxCv = stage.querySelector(".sc-fx"); fxG = fxCv.getContext("2d"); actorsEl = stage.querySelector(".sc-actors"); signEl = stage.querySelectorAll(".sc-sign");
    edgeL = stage.querySelector(".sc-edge.l"); edgeR = stage.querySelector(".sc-edge.r");
    edgeL.onclick = () => SC.panTo(Math.max(0, cam.x - viewW() * 0.8), 500);
    edgeR.onclick = () => SC.panTo(Math.min(100, cam.x + viewW() * 0.8), 500);
    const jobs = [];
    for (const k in A.bg) jobs.push(load(A.bg[k].src).then((im) => (imgs["bg_" + k] = im)));
    for (const k in A.ch) jobs.push(load(A.ch[k].src).then((im) => (imgs[k] = im)));
    await Promise.all(jobs);
    if (!imgs.bg_shop) throw new Error("画像を読み込めませんでした");
    buildMarkers(); buildActors();
    addEventListener("resize", layout);
    bindDrag();
    requestAnimationFrame(frame);
  };

  /* ---------- カメラ ---------- */
  function layout() {
    const vw = innerWidth, vh = innerHeight;
    fxCv.width = Math.round(vw * Math.min(2, devicePixelRatio || 1)); fxCv.height = Math.round(vh * Math.min(2, devicePixelRatio || 1));
    base = Math.max(vw / iw, vh / ih) * 1.04;
    apply();
  }
  const viewW = () => (innerWidth / (iw * base * cam.z)) * 100;
  const viewH = () => (innerHeight / (ih * base * cam.z)) * 100;
  function clamp() {
    cam.z = Math.max(1, cam.z);
    const hw = viewW() / 2, hh = viewH() / 2;
    cam.x = Math.min(100 - hw, Math.max(hw, cam.x));
    cam.y = Math.min(100 - hh, Math.max(hh, cam.y));
  }
  let breathe = 0;
  function apply() {
    clamp();
    const s = base * cam.z * (1 + breathe);
    const tx = innerWidth / 2 - (cam.x / 100) * iw * s, ty = innerHeight / 2 - (cam.y / 100) * ih * s;
    camEl.style.width = iw + "px"; camEl.style.height = ih + "px";
    camEl.style.transform = `translate3d(${tx}px,${ty}px,0) scale(${s})`;
    camEl.style.setProperty("--inv", (1 / s).toFixed(4));
    updateEdges();
  }
  const tweens = new Set();
  let camT = null;
  function tween(ms, fn, isCam) {
    return new Promise((res) => {
      if (isCam && camT) { tweens.delete(camT); camT.res(); camT = null; }
      if (SC.fast || ms <= 0) { fn(1); res(); return; }
      const t = { t0: performance.now(), ms, fn, res }; tweens.add(t);
      if (isCam) camT = t;
    });
  }
  SC.finishAll = () => { tweens.forEach((t) => { t.fn(1); t.res(); }); tweens.clear(); };
  SC.look = function (x, y, z, ms) {
    const a = { ...cam }; z = z || 1;
    stopInertia();
    return tween(ms == null ? 900 : ms, (k) => { const e = ease(k); cam.x = a.x + (x - a.x) * e; cam.y = a.y + (y - a.y) * e; cam.z = a.z + (z - a.z) * e; apply(); }, true);
  };
  SC.panTo = (x, ms) => SC.look(x, cam.y, cam.z, ms);
  SC.snapshot = () => ({ ...cam });
  SC.restore = (s, ms) => SC.look(s.x, s.y, s.z, ms);
  SC.focusSpot = (id, z, ms) => { const s = SPOTS[id]; return SC.look(s.x, s.y, z || 2.1, ms == null ? 800 : ms); };

  /* ---------- 部屋の切り替え ---------- */
  SC.show = function (room, at) {
    const r = ROOMS[room], im = imgs["bg_" + room];
    if (camT) { tweens.delete(camT); camT.res(); camT = null; }
    SC.room = room; iw = im.naturalWidth; ih = im.naturalHeight;
    bgA.src = im.src; bgA.style.opacity = 1;
    signEl.forEach((e) => (e.hidden = room !== "ext"));
    view.dataset.room = room;
    glowEl.innerHTML = r.glow.map((g, i) => `<i style="left:${g[0]}%;top:${g[1]}%;width:${g[2] * 2}%;--c:${g[3]};animation-delay:${-i * 0.7}s"></i>`).join("");
    view.querySelector(".sc-tint").style.background = r.tint;
    fxMode = r.fx; parts = [];
    const p = at || r.start; cam.x = p[0]; cam.y = p[1]; cam.z = p[2] || 1;
    layout();
    markEl.querySelectorAll(".sc-mark").forEach((m) => (m.hidden = true));
  };

  /* ---------- 印（タップで調べる） ---------- */
  function buildMarkers() {
    const html = [];
    for (const id in SPOTS) { const s = SPOTS[id]; html.push(`<button class="sc-mark" data-spot="${id}" data-room="${s.room}" style="left:${s.x}%;top:${s.y}%" hidden><span class="m"><span class="ring"></span><span class="lab"></span></span></button>`); }
    for (const id in DOORS) { const d = DOORS[id]; html.push(`<button class="sc-mark door" data-door="${id}" data-room="${d.room}" style="left:${d.x}%;top:${d.y}%" hidden><span class="m"><span class="ring"></span><span class="lab">${d.label}へ →</span></span></button>`); }
    markEl.innerHTML = html.join("");
    markEl.querySelectorAll(".sc-mark").forEach((b) => b.addEventListener("click", (e) => {
      if (dragged) return;
      e.stopPropagation();
      SC.onPick && SC.onPick(b.dataset.spot ? { spot: b.dataset.spot } : { door: b.dataset.door });
    }));
  }
  SC.labels = (map) => { for (const id in map) { const el = markEl.querySelector(`[data-spot="${id}"] .lab`); if (el) el.textContent = map[id]; } };
  let marksOn = false;
  SC.showMarkers = function (room, on, doorOn) {
    marksOn = on;
    markEl.querySelectorAll(".sc-mark").forEach((m) => { m.hidden = !(on && m.dataset.room === room && (!m.dataset.door || doorOn !== false)); });
    updateEdges();
  };
  SC.setMarker = (id, state) => { const m = markEl.querySelector(`[data-spot="${id}"]`); if (m) m.dataset.state = state || ""; };
  function updateEdges() {
    if (!edgeL) return;
    if (!marksOn) { edgeL.hidden = edgeR.hidden = true; return; }
    const hw = viewW() / 2; let l = 0, r = 0;
    markEl.querySelectorAll(".sc-mark:not([hidden])").forEach((m) => {
      if (m.dataset.state === "done") return;
      const x = parseFloat(m.style.left);
      if (x < cam.x - hw + 2) l++; else if (x > cam.x + hw - 2) r++;
    });
    edgeL.hidden = !l; edgeR.hidden = !r;
    edgeL.textContent = "◀ " + l; edgeR.textContent = r + " ▶";
  }

  /* ---------- 見回す（指でなぞる） ---------- */
  let drag = null, dragged = false, vx = 0, vy = 0;
  SC.canDrag = () => false;
  function stopInertia() { vx = vy = 0; }
  function bindDrag() {
    view.addEventListener("pointerdown", (e) => {
      if (!SC.canDrag()) return;
      drag = { x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, moved: 0 }; dragged = false; vx = vy = 0;
    });
    addEventListener("pointermove", (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.lx, dy = e.clientY - drag.ly; drag.lx = e.clientX; drag.ly = e.clientY;
      drag.moved = Math.max(drag.moved, Math.hypot(e.clientX - drag.x, e.clientY - drag.y));
      if (drag.moved > 8) dragged = true;
      const kx = 100 / (iw * base * cam.z), ky = 100 / (ih * base * cam.z);
      cam.x -= dx * kx; cam.y -= dy * ky; vx = -dx * kx; vy = -dy * ky; apply();
      if (dragged && SC.onDrag) SC.onDrag();
    });
    const end = () => { if (!drag) return; drag = null; setTimeout(() => (dragged = false), 0); };
    addEventListener("pointerup", end); addEventListener("pointercancel", end);
  }

  /* ---------- 立ち絵 ---------- */
  const actors = {};
  function buildActors() {
    for (const who of ["mori", "boss"]) {
      const el = document.createElement("div"); el.className = "sc-actor " + who; el.hidden = true;
      el.innerHTML = `<div class="body"><img alt=""><img class="next" alt=""></div>`;
      actorsEl.appendChild(el); actors[who] = { el, expr: null, img: el.querySelector("img"), nx: el.querySelector("img.next") };
    }
  }
  SC.mode = "stage";
  SC.setMode = (m) => { SC.mode = m; actorsEl.dataset.mode = m; view.classList.toggle("focus", m === "stage"); };
  SC.unfocus = () => view.classList.remove("focus");
  SC.actor = function (who, expr, on) {
    const a = actors[who]; if (!a) return;
    if (on === false) { if (!a.el.hidden) { a.el.classList.add("out"); setTimeout(() => { if (a.el.classList.contains("out")) { a.el.hidden = true; a.el.classList.remove("out"); } }, SC.fast ? 0 : 260); } return; }
    const key = chKey(who, expr || "normal"), src = A.ch[key].src;
    if (a.el.hidden) { a.el.hidden = false; a.el.classList.remove("out"); a.img.src = src; a.expr = key; a.el.classList.remove("enter"); void a.el.offsetWidth; a.el.classList.add("enter"); }
    else if (a.expr !== key) {
      a.el.classList.remove("out");
      a.nx.src = src; a.nx.classList.remove("on"); void a.nx.offsetWidth; a.nx.classList.add("on"); a.expr = key;
      setTimeout(() => { a.img.src = src; a.nx.classList.remove("on"); }, 180);
    }
  };
  SC.speaker = function (who) {
    const isActor = !!actors[who];
    for (const k in actors) { actors[k].el.classList.toggle("dim", isActor && who !== k); actors[k].el.classList.toggle("soft", !isActor); }
    actorsEl.dataset.speaker = who;
  };
  SC.hideActors = () => { for (const k in actors) SC.actor(k, null, false); };
  SC.react = function (who, kind) {
    const a = actors[who]; if (!a || a.el.hidden || SC.fast) return Promise.resolve();
    const b = a.el.querySelector(".body"); b.classList.remove("r-shock", "r-smug", "r-sad", "r-talk"); void b.offsetWidth;
    if (kind === "reset") return Promise.resolve();
    b.classList.add("r-" + kind);
    if (kind === "shock") SC.shake(14);
    return wait(kind === "talk" ? 0 : 500);
  };

  /* 会話ウィンドウ用の顔（160×160） */
  const faceCv = {};
  SC.portrait = function (who, expr) {
    const key = who === "boss" || who === "mori" ? chKey(who, expr) : "you";
    if (faceCv[key]) return faceCv[key];
    const c = document.createElement("canvas"); c.width = c.height = 160; const g = c.getContext("2d");
    if (key === "you") {
      const gr = g.createLinearGradient(0, 0, 0, 160); gr.addColorStop(0, "#26304a"); gr.addColorStop(1, "#141a2b"); g.fillStyle = gr; g.fillRect(0, 0, 160, 160);
      g.fillStyle = "#f2a53a"; g.beginPath(); g.arc(80, 62, 26, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.ellipse(80, 150, 50, 46, 0, Math.PI, 0); g.fill();
      g.fillStyle = "#141a2b"; g.font = "700 22px sans-serif"; g.textAlign = "center"; g.fillText("調", 80, 136);
    } else {
      const im = imgs[key], m = A.ch[key]; const w = im.naturalWidth, h = im.naturalHeight;
      const s = m.face[2] * w, cx = m.face[0] * w, cy = m.face[1] * h;
      const gr = g.createLinearGradient(0, 0, 0, 160); gr.addColorStop(0, who === "boss" ? "#4a1a1a" : "#1d2b45"); gr.addColorStop(1, "#120d0d"); g.fillStyle = gr; g.fillRect(0, 0, 160, 160);
      g.drawImage(im, cx - s / 2, cy - s / 2, s, s, 0, 0, 160, 160);
    }
    faceCv[key] = c; return c;
  };

  /* ---------- 演出 ---------- */
  let shakeAmp = 0;
  SC.shake = (px) => { if (!SC.fast) shakeAmp = Math.max(shakeAmp, px); };
  SC.pop = function (id, html) {
    if (SC.fast) return Promise.resolve();
    const s = SPOTS[id]; const el = document.createElement("div"); el.className = "sc-pop"; el.innerHTML = html;
    el.style.left = s.x + "%"; el.style.top = s.y + "%"; markEl.appendChild(el);
    return wait(1100).then(() => el.remove());
  };
  SC.flashSpot = function (id, color) {
    if (SC.fast) return;
    const s = SPOTS[id]; const el = document.createElement("i"); el.className = "sc-burst"; el.style.left = s.x + "%"; el.style.top = s.y + "%";
    if (color) el.style.setProperty("--c", color);
    markEl.appendChild(el); setTimeout(() => el.remove(), 900);
  };

  /* 雨・ほこり */
  let fxMode = null, parts = [];
  function fx(dt) {
    const W = fxCv.width, H = fxCv.height, k = W / innerWidth;
    fxG.clearRect(0, 0, W, H);
    if (fxMode === "rain") {
      while (parts.length < 140) parts.push({ x: Math.random() * W * 1.2, y: Math.random() * H - H, v: (0.9 + Math.random() * 0.8) * H / 900, l: (14 + Math.random() * 22) * k });
      fxG.strokeStyle = "rgba(190,210,255,.28)"; fxG.lineWidth = 1 * k; fxG.beginPath();
      for (const p of parts) { p.y += p.v * dt; p.x -= p.v * dt * 0.18; if (p.y > H) { p.y = -p.l; p.x = Math.random() * W * 1.2; } fxG.moveTo(p.x, p.y); fxG.lineTo(p.x + p.l * 0.18, p.y - p.l); }
      fxG.stroke();
    } else if (fxMode === "dust") {
      while (parts.length < 46) parts.push({ x: Math.random() * W, y: Math.random() * H, r: (0.6 + Math.random() * 1.6) * k, vx: (Math.random() - 0.5) * 0.012 * k, vy: (-0.004 - Math.random() * 0.01) * k, a: Math.random() * 6 });
      for (const p of parts) {
        p.x += p.vx * dt; p.y += p.vy * dt; p.a += dt * 0.0012; if (p.y < -5) { p.y = H + 5; p.x = Math.random() * W; }
        fxG.fillStyle = `rgba(255,220,160,${0.18 + Math.sin(p.a) * 0.12})`; fxG.beginPath(); fxG.arc(p.x, p.y, p.r, 0, 7); fxG.fill();
      }
    }
  }

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(50, now - last); last = now;
    tweens.forEach((t) => { const k = Math.min(1, (now - t.t0) / t.ms); t.fn(k); if (k >= 1) { tweens.delete(t); t.res(); } });
    if (!drag && (Math.abs(vx) > 0.001 || Math.abs(vy) > 0.001)) { cam.x += vx; cam.y += vy; vx *= 0.9; vy *= 0.9; apply(); }
    breathe = view.classList.contains("focus") ? 0 : Math.sin(now / 3200) * 0.006;
    if (shakeAmp > 0.3) { shakeAmp *= 0.86; view.style.transform = `translate(${(Math.random() - 0.5) * shakeAmp}px,${(Math.random() - 0.5) * shakeAmp}px)`; }
    else if (view.style.transform) view.style.transform = "";
    if (!tweens.size && !drag) apply();
    fx(dt);
    requestAnimationFrame(frame);
  }

  window.SCENE = SC;
})();
