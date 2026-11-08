/* 角度を固定した3Dの「机・棚・壁・金庫」。資料を置いて、タップで選ぶ。
 * カメラは動かさない（酔い対策）。動くのはタップした資料が少し浮く動きだけ。
 * 使い方：SCENE3D.show(要素, 場所の種類, [{id, name, kind, seen, marked}], 選んだときの関数)
 * WebGL が使えない端末では SCENE3D.ok が false になり、呼び出し側は一覧だけを出す。
 */
(function () {
  "use strict";
  const T = window.THREE;
  const ok = (() => { try { if (!T) return false; const c = document.createElement("canvas"); return !!(c.getContext("webgl") || c.getContext("experimental-webgl")); } catch (e) { return false; } })();
  const reduce = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  let cur = null; // いま表示中のもの

  /* ---------- 手作りの模様（画像ファイルを使わない） ---------- */
  const texCache = {};
  function canvasTex(key, w, h, draw) {
    if (texCache[key]) return texCache[key];
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    draw(c.getContext("2d"), w, h);
    const t = new T.CanvasTexture(c); t.anisotropy = 4; texCache[key] = t; return t;
  }
  function rnd(seed) { let s = seed; return () => (s = (s * 9301 + 49297) % 233280) / 233280; }
  const wood = (key, base, dark) => canvasTex("wood" + key, 512, 512, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h); const r = rnd(key.length * 77 + 3);
    for (let i = 0; i < 70; i++) { g.strokeStyle = `rgba(${dark},${0.05 + r() * 0.12})`; g.lineWidth = 1 + r() * 3; g.beginPath(); const y = r() * h; g.moveTo(0, y); g.bezierCurveTo(w * 0.3, y + (r() - 0.5) * 30, w * 0.7, y + (r() - 0.5) * 30, w, y + (r() - 0.5) * 20); g.stroke(); }
  });
  const plaster = () => canvasTex("plaster", 256, 256, (g, w, h) => {
    g.fillStyle = "#cfc6b4"; g.fillRect(0, 0, w, h); const r = rnd(5);
    for (let i = 0; i < 3000; i++) { g.fillStyle = `rgba(90,80,60,${r() * 0.06})`; g.fillRect(r() * w, r() * h, 2, 2); }
  });
  // 紙の表面：罫線や表の線だけ（文字は上に重ねるラベルで出す）
  const paperTex = (style) => canvasTex("paper" + style, 256, 340, (g, w, h) => {
    g.fillStyle = { news: "#e3dfd3", flyer: "#fff1c9", note: "#fff3a6", letter: "#fbf7ee" }[style] || "#f8f4ea"; g.fillRect(0, 0, w, h);
    g.strokeStyle = "rgba(60,50,40,.35)"; g.lineWidth = 2;
    if (style === "note" || style === "letter") { for (let y = 60; y < h - 20; y += 34) { g.beginPath(); g.moveTo(24, y); g.lineTo(w - 24, y); g.stroke(); } }
    else if (style === "news") { g.fillStyle = "rgba(40,40,40,.55)"; g.fillRect(20, 24, w - 40, 26); for (let y = 70; y < h - 20; y += 12) { g.fillStyle = "rgba(40,40,40,.18)"; g.fillRect(20, y, (w - 50) / 2, 5); g.fillRect(w / 2 + 5, y, (w - 50) / 2, 5); } }
    else { g.fillStyle = "rgba(40,40,40,.6)"; g.fillRect(40, 28, w - 80, 12); for (let y = 66; y < h - 30; y += 24) { g.strokeRect(24, y, w - 48, 24); } }
  });

  /* ---------- 材質 ---------- */
  const M = (o) => new T.MeshStandardMaterial(Object.assign({ roughness: 0.8, metalness: 0 }, o));
  function box(w, h, d, mat) { const m = new T.Mesh(new T.BoxGeometry(w, h, d), mat); m.castShadow = true; m.receiveShadow = true; return m; }

  /* ---------- 資料の形 ---------- */
  // kind: paper / stack / book / note / card / photo / envelope / binder / board / poster / frame / clip
  const COVER = ["#2f5d8a", "#7a2f2f", "#2f6a4f", "#5b4a8a", "#8a6a2f"];
  function makeItem(it, i, where) {
    const g = new T.Group();
    const k = it.kind;
    if (k === "book") {
      const c = box(0.34, 0.035, 0.48, M({ color: COVER[i % COVER.length], roughness: 0.6 }));
      const pages = box(0.32, 0.03, 0.46, M({ color: "#efe8d6" })); pages.position.y = -0.002; pages.position.x = 0.01;
      g.add(pages, c); c.position.y = 0.004;
      const lab = box(0.2, 0.002, 0.08, M({ color: "#f3eddc" })); lab.position.set(0, 0.023, -0.1); g.add(lab);
    } else if (k === "stack") {
      for (let s = 0; s < 4; s++) { const p = box(0.42, 0.006, 0.56, M({ color: "#f6f1e4", map: paperTex("form") })); p.position.y = s * 0.007; p.rotation.y = (s - 1.5) * 0.04; g.add(p); }
      const clip = box(0.12, 0.012, 0.04, M({ color: "#9a9a9a", metalness: 0.7, roughness: 0.3 })); clip.position.set(0, 0.032, -0.27); g.add(clip);
    } else if (k === "note") {
      const p = box(0.3, 0.004, 0.3, M({ color: "#fff3a6", map: paperTex("note") })); g.add(p);
    } else if (k === "card") {
      for (let s = 0; s < 3; s++) { const p = box(0.3, 0.004, 0.18, M({ color: "#ffffff" })); p.position.y = s * 0.005; p.rotation.y = s * 0.08; g.add(p); }
    } else if (k === "photo") {
      const p = box(0.32, 0.004, 0.24, M({ color: "#ffffff" })); const ph = box(0.27, 0.002, 0.17, M({ color: "#8c6b47", roughness: 0.4 })); ph.position.set(0, 0.003, -0.015); g.add(p, ph);
    } else if (k === "envelope") {
      const p = box(0.46, 0.03, 0.28, M({ color: "#d9bf8c" })); g.add(p);
      const fl = box(0.46, 0.002, 0.12, M({ color: "#c9ad78" })); fl.position.set(0, 0.017, -0.08); g.add(fl);
    } else if (k === "binder") {
      const b = box(0.13, 0.46, 0.34, M({ color: COVER[i % COVER.length], roughness: 0.5 })); b.position.y = 0.23; g.add(b);
      const lab = box(0.09, 0.22, 0.004, M({ color: "#f3eddc" })); lab.position.set(0, 0.26, 0.172); g.add(lab);
    } else if (k === "board") {
      const f = box(1.1, 0.7, 0.03, M({ color: "#b8b8b8", metalness: 0.5, roughness: 0.4 })); const s = box(1.04, 0.64, 0.01, M({ color: "#f7f8f7", roughness: 0.2 })); s.position.z = 0.02; g.add(f, s);
      const r = rnd(9); for (let l = 0; l < 4; l++) { const ln = box(0.5 + r() * 0.3, 0.02, 0.002, M({ color: l === 2 ? "#c0392b" : "#2b4a7a" })); ln.position.set(-0.1, 0.2 - l * 0.13, 0.026); g.add(ln); }
    } else if (k === "poster" || k === "clip" || k === "frame") {
      const color = k === "frame" ? "#5a4630" : "#f8f4ea";
      const back = box(k === "frame" ? 0.44 : 0.4, k === "frame" ? 0.34 : 0.54, 0.015, M({ color }));
      g.add(back);
      const face = box(k === "frame" ? 0.38 : 0.38, k === "frame" ? 0.28 : 0.52, 0.004, M({ color: "#f8f4ea", map: paperTex(it.style || "form") })); face.position.z = 0.01; g.add(face);
      if (k === "clip") { const c = box(0.14, 0.05, 0.03, M({ color: "#8a8a8a", metalness: 0.7, roughness: 0.3 })); c.position.set(0, 0.26, 0.02); g.add(c); }
      if (k === "poster") { const pin = new T.Mesh(new T.SphereGeometry(0.018, 12, 8), M({ color: "#c0392b", roughness: 0.3 })); pin.position.set(0, 0.24, 0.025); g.add(pin); }
    } else {
      const p = box(0.42, 0.005, 0.56, M({ color: "#f8f4ea", map: paperTex(it.style || "form") })); g.add(p);
    }
    g.userData.id = it.id;
    return g;
  }

  /* ---------- 場所ごとの家具 ---------- */
  function room(scene, wallZ) {
    const wall = new T.Mesh(new T.PlaneGeometry(12, 6), M({ map: plaster(), color: "#d8cfbd" })); wall.position.set(0, 2.5, wallZ); wall.receiveShadow = true; scene.add(wall);
    const floorT = wood("floor", "#6b4f36", "40,25,10"); floorT.wrapS = floorT.wrapT = T.RepeatWrapping; floorT.repeat.set(4, 4);
    const floor = new T.Mesh(new T.PlaneGeometry(12, 12), M({ map: floorT })); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  }
  function desk(scene, color) {
    const wt = wood("desk" + color, color, "50,30,10");
    const top = box(2.6, 0.08, 1.5, M({ map: wt, roughness: 0.55 })); top.position.y = 0.76; scene.add(top);
    [[-1.2, -0.65], [1.2, -0.65], [-1.2, 0.65], [1.2, 0.65]].forEach(([x, z]) => { const l = box(0.08, 0.72, 0.08, M({ map: wt })); l.position.set(x, 0.36, z); scene.add(l); });
    return 0.8; // 天板の高さ
  }
  // 机の上にN個を2列で並べる
  function layoutFlat(items, y, opt) {
    const n = items.length, cols = Math.min(n, opt.cols || 3), rows = Math.ceil(n / cols);
    return items.map((it, i) => {
      const r = Math.floor(i / cols), c = i % cols, inRow = Math.min(cols, n - r * cols);
      const x = (c - (inRow - 1) / 2) * (opt.dx || 0.72), z = (r - (rows - 1) / 2) * (opt.dz || 0.62) + (opt.oz || 0);
      const rr = rnd(i * 13 + 7);
      return { x, y, z, ry: (rr() - 0.5) * 0.5 };
    });
  }

  /* ---------- 事務所全体（場所えらび用） ---------- */
  function officeRoom(scene, items) {
    const pl = plaster();
    const floorT = wood("floor", "#6b4f36", "40,25,10"); floorT.wrapS = floorT.wrapT = T.RepeatWrapping; floorT.repeat.set(4, 3);
    const floor = new T.Mesh(new T.PlaneGeometry(6.8, 6.4), M({ map: floorT })); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
    const back = box(6.8, 2.6, 0.1, M({ map: pl, color: "#d8cfbd" })); back.position.set(0, 1.3, -3.2); scene.add(back);
    const left = box(0.1, 2.6, 6.4, M({ map: pl, color: "#cfc6b4" })); left.position.set(-3.4, 1.3, 0); scene.add(left);
    const right = box(0.1, 2.6, 6.4, M({ map: pl, color: "#cfc6b4" })); right.position.set(3.4, 1.3, 0); scene.add(right);
    const wt = wood("desk#8a5f3a", "#8a5f3a", "50,30,10"), wt2 = wood("acct", "#9a7048", "50,30,10"), dark = wood("table", "#3b2a1e", "20,10,5");
    const paper = M({ color: "#f6f1e4" });
    const G = {};
    const grp = (id, x, z) => { const g = new T.Group(); g.position.set(x, 0, z); g.userData.id = id; scene.add(g); G[id] = g; return g; };
    const deskAt = (g, w, d, mat) => { const t = box(w, 0.08, d, M({ map: mat, roughness: 0.55 })); t.position.y = 0.76; g.add(t); [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => { const l = box(0.07, 0.72, 0.07, M({ map: mat })); l.position.set(a * (w / 2 - 0.08), 0.36, b * (d / 2 - 0.08)); g.add(l); }); };
    // 社長の机の上
    let g = grp("top", -1.25, -1.9); deskAt(g, 2.0, 1.0, wt);
    [[-0.5, 0.1, "#2f5d8a"], [0.1, -0.05, null], [0.55, 0.15, null]].forEach(([x, z, c]) => { const p = box(0.34, 0.03, 0.44, c ? M({ color: c }) : paper); p.position.set(x, 0.82, z); p.rotation.y = x * 0.4; g.add(p); });
    const chair = box(0.5, 0.9, 0.5, M({ color: "#2a2a2a", roughness: 0.6 })); chair.position.set(0, 0.45, -0.85); g.add(chair);
    // 社長の机の引き出し（机の右下を少し引き出した形）
    g = grp("drawer", -0.75, -1.32);
    const dr = box(0.7, 0.2, 0.5, M({ map: wood("drawer", "#7a5232", "40,25,10") })); dr.position.set(0, 0.55, 0.1); g.add(dr);
    const kn = box(0.18, 0.03, 0.03, M({ color: "#c8b08a", metalness: 0.6, roughness: 0.3 })); kn.position.set(0, 0.57, 0.37); g.add(kn);
    // 経理の机
    g = grp("acct", 1.45, -1.9); deskAt(g, 1.6, 0.9, wt2);
    ["#2f5d8a", "#7a2f2f", "#2f6a4f"].forEach((c, i) => { const b = box(0.3, 0.05, 0.42, M({ color: c })); b.position.set(-0.45 + i * 0.42, 0.83, 0.05); g.add(b); });
    const mon = box(0.5, 0.36, 0.05, M({ color: "#222", roughness: 0.4 })); mon.position.set(0.1, 1.05, -0.3); g.add(mon);
    const ch2 = box(0.45, 0.85, 0.45, M({ color: "#3a3a3a" })); ch2.position.set(0, 0.42, 0.75); g.add(ch2);
    // 事務所の壁（ホワイトボードと掲示物）
    g = grp("wall", 0, -3.12);
    const wb = box(1.6, 0.9, 0.04, M({ color: "#f3f4f2", roughness: 0.2 })); wb.position.set(0, 1.65, 0); g.add(wb);
    const wf = box(1.68, 0.98, 0.03, M({ color: "#b8b8b8", metalness: 0.5 })); wf.position.set(0, 1.65, -0.01); g.add(wf);
    [[-0.3, 1.85, "#2b4a7a"], [-0.2, 1.7, "#2b4a7a"], [-0.1, 1.55, "#c0392b"]].forEach(([x, y, c]) => { const l = box(0.9, 0.025, 0.01, M({ color: c })); l.position.set(x, y, 0.025); g.add(l); });
    const ps = box(0.4, 0.55, 0.02, M({ color: "#f8f4ea", map: paperTex("form") })); ps.position.set(1.15, 1.6, 0.01); g.add(ps);
    // 書類棚
    g = grp("cabinet", -3.1, 0.5); g.rotation.y = Math.PI / 2;
    const sw = wood("shelf", "#6e4a2c", "40,25,10");
    const sb = box(1.8, 2.0, 0.05, M({ map: sw })); sb.position.set(0, 1.0, -0.2); g.add(sb);
    [0.02, 0.68, 1.34, 2.0].forEach((y) => { const sh = box(1.8, 0.04, 0.4, M({ map: sw })); sh.position.set(0, y, 0); g.add(sh); });
    [-0.9, 0.9].forEach((x) => { const sd = box(0.04, 2.0, 0.4, M({ map: sw })); sd.position.set(x, 1.0, 0); g.add(sd); });
    [0.06, 0.72, 1.38].forEach((y, r) => { for (let k = 0; k < 7; k++) { const f = box(0.16, 0.5, 0.3, M({ color: COVER[(k + r) % COVER.length], roughness: 0.6 })); f.position.set(-0.7 + k * 0.22, y + 0.27, 0); g.add(f); } });
    // 金庫
    g = grp("safe", -2.85, -2.65);
    const sf = box(0.8, 0.95, 0.7, M({ color: "#3a3f45", metalness: 0.6, roughness: 0.45 })); sf.position.y = 0.475; g.add(sf);
    const dial = new T.Mesh(new T.CylinderGeometry(0.09, 0.09, 0.04, 20), M({ color: "#bbb", metalness: 0.8, roughness: 0.2 })); dial.rotation.x = Math.PI / 2; dial.position.set(0.1, 0.55, 0.37); g.add(dial);
    // 応接コーナー
    g = grp("guest", 1.6, 1.4);
    const tb = box(1.3, 0.06, 0.8, M({ map: dark, roughness: 0.35 })); tb.position.y = 0.42; g.add(tb);
    const tl = box(1.1, 0.38, 0.6, M({ color: "#222" })); tl.position.y = 0.2; g.add(tl);
    [-1, 1].forEach((sgn) => { const so = box(1.5, 0.45, 0.6, M({ color: "#5a2f2a", roughness: 0.9 })); so.position.set(0, 0.23, sgn * 0.95); g.add(so); const sbk = box(1.5, 0.4, 0.18, M({ color: "#4e2925", roughness: 0.9 })); sbk.position.set(0, 0.6, sgn * 1.2); g.add(sbk); });
    const fl = box(0.3, 0.004, 0.4, M({ color: "#fff1c9" })); fl.position.set(-0.3, 0.455, 0); g.add(fl);
    // 資材置き場（右奥：材木と段ボール）
    g = grp("store", 2.85, -0.55);
    for (let k = 0; k < 5; k++) { const lm = box(0.12, 0.1, 1.6, M({ map: wood("lumber", "#c79a62", "90,60,30") })); lm.position.set(-0.3 + (k % 3) * 0.14, 0.05 + Math.floor(k / 3) * 0.1, 0); g.add(lm); }
    [[0.35, 0.25, 0.3], [0.35, 0.7, 0.2], [0.3, 0.25, -0.45]].forEach(([x, y, z]) => { const cb = box(0.45, 0.45, 0.45, M({ color: "#b08a5a" })); cb.position.set(x, y - 0.02, z); g.add(cb); });
    // 職人の休憩室（右の壁のドア）
    g = grp("rest", 3.32, 1.9);
    const door = box(0.06, 2.0, 0.95, M({ map: wood("door", "#7b5a3c", "40,25,10") })); door.position.set(0, 1.0, 0); g.add(door);
    const nob = box(0.06, 0.06, 0.06, M({ color: "#c8b08a", metalness: 0.7 })); nob.position.set(-0.06, 1.0, 0.35); g.add(nob);
    const sign = box(0.03, 0.18, 0.5, M({ color: "#f3eddc" })); sign.position.set(-0.04, 1.75, 0); g.add(sign);
    return items.map((it) => G[it.id]).filter(Boolean);
  }

  const LAYOUT = {
    office(scene, items) {
      const groups = officeRoom(scene, items);
      return { cam: [0, 7.0, 6.0], look: [0, 0.1, -0.35], groups, fov: 50 };
    },
    desk(scene, items, opt) {
      room(scene, -1.4); const y = desk(scene, opt.wood || "#8a5f3a");
      // 卓上ライトの代わりに、マグカップとペン立てで雰囲気を出す
      const mug = new T.Mesh(new T.CylinderGeometry(0.06, 0.055, 0.12, 20), M({ color: "#e8e2d6", roughness: 0.3 })); mug.position.set(1.05, y + 0.06, -0.55); mug.castShadow = true; scene.add(mug);
      return { cam: [0, 2.55, 1.75], look: [0, 0.7, -0.05], pos: layoutFlat(items, y + 0.006, { cols: 3, dx: 0.8, dz: 0.64 }) };
    },
    table(scene, items) {
      room(scene, -1.6);
      const wt = wood("table", "#3b2a1e", "20,10,5");
      const top = box(2.2, 0.06, 1.2, M({ map: wt, roughness: 0.35 })); top.position.y = 0.45; scene.add(top);
      [[-1, -0.5], [1, -0.5], [-1, 0.5], [1, 0.5]].forEach(([x, z]) => { const l = box(0.06, 0.42, 0.06, M({ color: "#222" })); l.position.set(x, 0.21, z); scene.add(l); });
      const sofa = box(2.4, 0.5, 0.6, M({ color: "#5a2f2a", roughness: 0.9 })); sofa.position.set(0, 0.25, -1.15); scene.add(sofa);
      const back = box(2.4, 0.5, 0.2, M({ color: "#4e2925", roughness: 0.9 })); back.position.set(0, 0.7, -1.35); scene.add(back);
      return { cam: [0, 2.1, 1.6], look: [0, 0.4, -0.05], pos: layoutFlat(items, 0.486, { cols: 3, dx: 0.7 }) };
    },
    drawer(scene, items) {
      room(scene, -1.6); const y = desk(scene, "#8a5f3a");
      // 引き出しを手前に引き出した形
      const wt = wood("drawer", "#7a5232", "40,25,10");
      const dy = y - 0.2, W = 1.5, D = 0.9;
      const bottom = box(W, 0.02, D, M({ map: wt })); bottom.position.set(0, dy, 0.9); scene.add(bottom);
      [[-W / 2, 0], [W / 2, 0]].forEach(([x]) => { const s = box(0.03, 0.16, D, M({ map: wt })); s.position.set(x, dy + 0.08, 0.9); scene.add(s); });
      const front = box(W + 0.04, 0.2, 0.03, M({ map: wt })); front.position.set(0, dy + 0.08, 0.9 + D / 2); scene.add(front);
      const knob = box(0.2, 0.03, 0.03, M({ color: "#c8b08a", metalness: 0.6, roughness: 0.3 })); knob.position.set(0, dy + 0.1, 0.9 + D / 2 + 0.03); scene.add(knob);
      return { cam: [0, 2.0, 2.3], look: [0, dy, 0.85], pos: layoutFlat(items, dy + 0.016, { cols: 2, dx: 0.66, oz: 0.9 }) };
    },
    wall(scene, items) {
      room(scene, 0);
      const cork = box(2.6, 1.5, 0.04, M({ color: "#b58a5a", roughness: 0.95 })); cork.position.set(0, 1.55, 0.02); scene.add(cork);
      const frame = box(2.7, 1.6, 0.02, M({ color: "#4a3626" })); frame.position.set(0, 1.55, 0.005); scene.add(frame);
      const n = items.length, cols = Math.min(n, 3), rows = Math.ceil(n / cols);
      const pos = items.map((it, i) => {
        const r = Math.floor(i / cols), c = i % cols, inRow = Math.min(cols, n - r * cols);
        const big = it.kind === "board";
        return { x: (c - (inRow - 1) / 2) * (big ? 0.95 : 0.78), y: 1.55 + ((rows - 1) / 2 - r) * 0.72, z: 0.06, rz: (rnd(i * 31 + 5)() - 0.5) * 0.08, upright: true };
      });
      return { cam: [0, 1.6, 3.3], look: [0, 1.5, 0], pos };
    },
    shelf(scene, items) {
      room(scene, -0.4);
      const wt = wood("shelf", "#6e4a2c", "40,25,10");
      const W = 2.4, H = 2.0, D = 0.38;
      const back = box(W, H, 0.02, M({ map: wt })); back.position.set(0, H / 2, -0.38); scene.add(back);
      [-W / 2, W / 2].forEach((x) => { const s = box(0.04, H, D, M({ map: wt })); s.position.set(x, H / 2, -0.2); scene.add(s); });
      const levels = [0.35, 0.95, 1.55];
      levels.concat([H]).forEach((y) => { const s = box(W, 0.035, D, M({ map: wt })); s.position.set(0, y - 0.02, -0.2); scene.add(s); });
      // 1段に2冊まで。上の段から並べる（名前の札が重ならないように）
      const pos = items.map((it, i) => {
        const lv = 2 - Math.floor(i / 2), cnt = Math.min(2, items.length - Math.floor(i / 2) * 2), idx = i % 2;
        return { x: (idx - (cnt - 1) / 2) * 1.0, y: levels[lv], z: -0.2, ry: 0, shelf: true };
      });
      // 飾り：ラベルのない古いファイル（タップしても何も起きない）
      const dull = ["#4a4a44", "#5c554a", "#3f4a52"];
      pos.forEach((p, i) => [-0.19, 0.17, 0.31].forEach((dx, j) => { const f = box(0.12, 0.42 - j * 0.03, 0.32, M({ color: dull[(i + j) % 3], roughness: 0.7 })); f.position.set(p.x + dx, p.y + (0.42 - j * 0.03) / 2, -0.2); scene.add(f); }));
      const cb = box(0.6, 0.35, 0.34, M({ color: "#b08a5a" })); cb.position.set(0.75, levels[0] + 0.175, -0.2); if (items.length < 5) scene.add(cb);
      return { cam: [0, 1.3, 2.8], look: [0, 1.17, -0.2], pos };
    },
    safe(scene, items) {
      room(scene, -0.8);
      const steel = M({ color: "#3a3f45", metalness: 0.6, roughness: 0.45 });
      const W = 1.1, H = 1.2, D = 0.7;
      const parts = [[W, 0.06, D, 0, 0.03, 0], [W, 0.06, D, 0, H - 0.03, 0], [0.06, H, D, -W / 2 + 0.03, H / 2, 0], [0.06, H, D, W / 2 - 0.03, H / 2, 0], [W, H, 0.06, 0, H / 2, -D / 2 + 0.03]];
      parts.forEach(([w, h, d, x, y, z]) => { const b = box(w, h, d, steel); b.position.set(x, y, z - 0.3); scene.add(b); });
      const shelfIn = box(W - 0.1, 0.03, D - 0.1, steel); shelfIn.position.set(0, 0.55, -0.3); scene.add(shelfIn);
      const door = box(W, H, 0.1, M({ color: "#2f3439", metalness: 0.65, roughness: 0.4 })); door.position.set(W / 2 + 0.45, H / 2, 0.15); door.rotation.y = -1.25; scene.add(door);
      const dial = new T.Mesh(new T.CylinderGeometry(0.1, 0.1, 0.04, 24), M({ color: "#b9b9b9", metalness: 0.8, roughness: 0.2 })); dial.rotation.x = Math.PI / 2; dial.position.set(W / 2 + 0.43, H / 2, 0.22); dial.rotation.z = 0.3; scene.add(dial);
      const pos = items.map((it, i) => ({ x: (i - (items.length - 1) / 2) * 0.48, y: i === 0 ? 0.585 : 0.08, z: -0.3, ry: (i - 0.5) * 0.2 }));
      if (items.length === 2) { pos[0] = { x: 0, y: 0.585, z: -0.28, ry: 0.1 }; pos[1] = { x: 0, y: 0.075, z: -0.28, ry: -0.15 }; }
      return { cam: [0, 1.25, 2.1], look: [0, 0.45, -0.3], pos };
    }
  };

  /* ---------- 表示 ---------- */
  function show(el, type, items, onPick) {
    hide();
    if (!ok) return false;
    const wrap = document.createElement("div"); wrap.className = "s3d";
    el.appendChild(wrap);
    const w = Math.max(280, el.clientWidth || 340), h = Math.round(w * (type === "office" ? 0.95 : 0.78));
    wrap.style.height = h + "px";
    const renderer = new T.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h); renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
    wrap.appendChild(renderer.domElement);
    const scene = new T.Scene(); scene.background = new T.Color("#1c1a17"); scene.fog = new T.Fog("#1c1a17", 6, 12);
    const L = LAYOUT[type] || LAYOUT.desk;
    const lay = L(scene, items, {});
    const cam = new T.PerspectiveCamera(lay.fov || 42, w / h, 0.1, 30); cam.position.set(...lay.cam); cam.lookAt(...lay.look); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
    // 光：あたたかい部屋の明かり＋影を落とす主光
    scene.add(new T.HemisphereLight("#fff3dd", "#3a2a1c", lay.groups ? 0.95 : 0.75));
    const key = new T.DirectionalLight("#fff0d6", 0.95); key.position.set(-2.5, 4.5, 2.5); key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024); const sc = lay.groups ? 6 : 3; key.shadow.camera.left = -sc; key.shadow.camera.right = sc; key.shadow.camera.top = sc; key.shadow.camera.bottom = -sc; key.shadow.bias = -0.0008; key.shadow.radius = 4;
    scene.add(key);
    const warm = new T.PointLight("#ffb46b", 0.4, 6); warm.position.set(1.5, 2.2, 1); scene.add(warm);

    const meshes = lay.groups ? lay.groups.slice() : [];
    if (lay.groups) meshes.forEach((g) => { g.userData.base = g.position.clone(); g.traverse((m) => { if (m.isMesh) { m.userData.id = g.userData.id; m.castShadow = m.receiveShadow = true; } }); });
    else items.forEach((it, i) => {
      const g = makeItem(it, i);
      const p = lay.pos[i];
      g.position.set(p.x, p.y, p.z);
      if (p.ry) g.rotation.y = p.ry;
      if (p.upright && !["board", "poster", "clip", "frame"].includes(it.kind)) g.rotation.x = Math.PI / 2;
      if (p.rz) g.rotation.z = p.rz;
      if (p.shelf && it.kind !== "binder") { g.rotation.x = 0; }
      g.traverse((m) => { if (m.isMesh) m.userData.id = it.id; });
      g.userData.base = g.position.clone();
      scene.add(g); meshes.push(g);
    });

    // 名前のラベル（HTML。文字をくっきり読めるように）
    const labels = document.createElement("div"); labels.className = "s3d-labels"; wrap.appendChild(labels);
    const v = new T.Vector3(), anchors = [], btns = [];
    items.forEach((it, i) => {
      const b = document.createElement("button"); b.className = "s3d-label" + (it.seen ? " seen" : "") + (it.marked ? " marked" : "") + (it.lock ? " lock" : "");
      b.dataset.d = it.id; b.innerHTML = `${it.seen ? "<i>✓</i>" : ""}${it.marked ? "<em>★</em>" : ""}<span></span>`;
      b.querySelector("span").textContent = it.name;
      const g = meshes[i]; const bb = new T.Box3().setFromObject(g); bb.getCenter(v);
      if (lay.groups) v.y = bb.max.y + 0.15; else if (["board", "poster", "clip", "frame"].includes(it.kind) || lay.pos[i].upright) v.y = bb.min.y - 0.02; else if (it.kind === "binder") v.y = bb.max.y + 0.05; else v.z = bb.max.z + 0.02;
      anchors.push(v.clone()); btns.push(b);
      b.onclick = (e) => { e.stopPropagation(); pick(it.id); };
      labels.appendChild(b);
    });

    let busy = false;
    function placeLabels() {
      const W = wrap.clientWidth || w, H = wrap.clientHeight || h;
      anchors.forEach((a, i) => {
        v.copy(a).project(cam); const bw = btns[i].offsetWidth || 80, bh = btns[i].offsetHeight || 24;
        const x = Math.max(bw / 2 + 4, Math.min(W - bw / 2 - 4, (v.x + 1) / 2 * W)), y = Math.max(bh / 2 + 4, Math.min(H - bh / 2 - 4, (1 - v.y) / 2 * H));
        btns[i].style.left = x.toFixed(1) + "px"; btns[i].style.top = y.toFixed(1) + "px";
      });
    }
    function render() { renderer.render(scene, cam); }
    // 指で左右になぞると、少しだけ見回せる（ゆっくり。手を離すとそこで止まる）
    const look = new T.Vector3(...lay.look), off = new T.Vector3(...lay.cam).sub(look);
    const r0 = Math.hypot(off.x, off.z), yaw0 = Math.atan2(off.x, off.z), MAX = 0.26;
    let yaw = 0, drag = null, moved = false;
    function aim() {
      cam.position.set(look.x + r0 * Math.sin(yaw0 + yaw), lay.cam[1], look.z + r0 * Math.cos(yaw0 + yaw));
      cam.lookAt(look); cam.updateMatrixWorld(); placeLabels(); render();
    }
    wrap.addEventListener("pointerdown", (e) => { drag = { x: e.clientX, yaw }; moved = false; });
    wrap.addEventListener("pointermove", (e) => {
      if (!drag) return; const dx = e.clientX - drag.x; if (Math.abs(dx) > 6) moved = true; if (!moved) return;
      yaw = Math.max(-MAX, Math.min(MAX, drag.yaw - dx / wrap.clientWidth * 0.8)); aim();
    });
    ["pointerup", "pointercancel", "pointerleave"].forEach((t) => wrap.addEventListener(t, () => { drag = null; }));
    wrap.addEventListener("click", (e) => { if (moved) { e.stopPropagation(); e.preventDefault(); moved = false; } }, true);
    function pick(id) {
      if (busy) return; busy = true;
      const g = meshes.find((m) => m.userData.id === id);
      if (!g || reduce() || lay.groups) { onPick(id); busy = false; return; }
      const from = g.position.clone(), to = from.clone().lerp(cam.position, 0.25);
      const t0 = performance.now();
      const step = (t) => {
        const k = Math.min(1, (t - t0) / 260), e = 1 - Math.pow(1 - k, 3);
        g.position.lerpVectors(from, to, e); render();
        if (k < 1) requestAnimationFrame(step); else { busy = false; onPick(id); }
      };
      requestAnimationFrame(step);
    }
    // 画面を直接タップしたとき
    const ray = new T.Raycaster(), mv = new T.Vector2();
    renderer.domElement.addEventListener("click", (e) => {
      const r = renderer.domElement.getBoundingClientRect();
      mv.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(mv, cam);
      const hit = ray.intersectObjects(meshes, true).find((x) => x.object.userData.id);
      if (hit) pick(hit.object.userData.id);
    });
    placeLabels(); render();
    cur = { renderer, scene, wrap };
    return true;
  }
  function hide() {
    if (!cur) return;
    try {
      cur.scene.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); [].concat(o.material).forEach((m) => m.dispose()); } });
      cur.renderer.dispose(); cur.renderer.forceContextLoss && cur.renderer.forceContextLoss();
    } catch (e) {}
    cur.wrap.remove(); cur = null;
  }

  window.SCENE3D = { ok, show, hide };
})();
