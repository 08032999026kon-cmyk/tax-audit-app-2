/* 3Dの世界：外観・店内・事務室・人物・演出用アニメーション
 * three.js r128（js/vendor/three.min.js）を使う */
(function () {
  "use strict";
  const T = window.THREE;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- 小さな道具 ---------- */
  const V = (x, y, z) => new T.Vector3(x, y, z);
  function canvas(w, h, draw) {
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    draw(c.getContext("2d"), w, h); return c;
  }
  function tex(c, repeat) {
    const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; t.anisotropy = 4;
    if (repeat) { t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
    return t;
  }
  const rnd = (() => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
  const STD = (o) => new T.MeshStandardMaterial(Object.assign({ roughness: 0.8, metalness: 0 }, o));
  const BASIC = (o) => new T.MeshBasicMaterial(o);

  function mesh(geo, mat, x, y, z, parent) {
    const m = new T.Mesh(geo, mat); m.position.set(x || 0, y || 0, z || 0);
    m.castShadow = true; m.receiveShadow = true; (parent || world.scene).add(m); return m;
  }
  const box = (w, h, d, mat, x, y, z, p) => mesh(new T.BoxGeometry(w, h, d), mat, x, y, z, p);
  const cyl = (rt, rb, h, mat, x, y, z, p, seg) => mesh(new T.CylinderGeometry(rt, rb, h, seg || 20), mat, x, y, z, p);
  const sph = (r, mat, x, y, z, p, ws, hs) => mesh(new T.SphereGeometry(r, ws || 20, hs || 14), mat, x, y, z, p);
  function plane(w, h, mat, x, y, z, ry, p) { const m = mesh(new T.PlaneGeometry(w, h), mat, x, y, z, p); m.rotation.y = ry || 0; m.castShadow = false; return m; }

  /* ---------- テクスチャ ---------- */
  const TX = {};
  function makeTextures() {
    TX.floor = tex(canvas(512, 512, (g, w, h) => {
      const cols = ["#8a5f3c", "#946847", "#7f5634", "#9a6d49", "#86593a"];
      for (let i = 0; i < 8; i++) {
        let y = 0; const x = i * 64;
        while (y < h) { const len = 120 + rnd() * 200; g.fillStyle = cols[(rnd() * cols.length) | 0]; g.fillRect(x, y, 64, len);
          g.strokeStyle = "rgba(40,22,10,.35)"; g.lineWidth = 2; g.strokeRect(x + 1, y + 1, 62, len - 2);
          for (let k = 0; k < 6; k++) { g.strokeStyle = "rgba(60,35,18," + (0.06 + rnd() * 0.08) + ")"; g.beginPath(); const yy = y + rnd() * len; g.moveTo(x + 4, yy); g.bezierCurveTo(x + 20, yy + 6, x + 40, yy - 6, x + 60, yy + 2); g.stroke(); }
          y += len; }
      }
    }), [3, 3]);
    TX.wall = tex(canvas(256, 256, (g, w, h) => {
      g.fillStyle = "#e7d8bd"; g.fillRect(0, 0, w, h);
      for (let x = 0; x < w; x += 32) { g.fillStyle = "rgba(160,120,70,.08)"; g.fillRect(x, 0, 12, h); }
      for (let i = 0; i < 400; i++) { g.fillStyle = "rgba(90,60,30," + rnd() * 0.05 + ")"; g.fillRect(rnd() * w, rnd() * h, 2, 2); }
    }), [4, 2]);
    TX.officeWall = tex(canvas(256, 256, (g, w, h) => {
      g.fillStyle = "#c9cfc4"; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 600; i++) { g.fillStyle = "rgba(40,50,40," + rnd() * 0.05 + ")"; g.fillRect(rnd() * w, rnd() * h, 2, 2); }
    }), [3, 2]);
    TX.brick = tex(canvas(256, 256, (g, w, h) => {
      g.fillStyle = "#5a3a2c"; g.fillRect(0, 0, w, h);
      for (let r = 0; r < 16; r++) for (let c = -1; c < 5; c++) {
        const x = c * 64 + (r % 2 ? 32 : 0), y = r * 16; const v = 110 + rnd() * 40;
        g.fillStyle = `rgb(${v + 30},${v * 0.55},${v * 0.42})`; g.fillRect(x + 2, y + 2, 60, 12);
      }
    }), [5, 2]);
    TX.awning = tex(canvas(256, 64, (g, w, h) => {
      for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? "#f1e6cf" : "#1f5a4c"; g.fillRect(i * 32, 0, 32, h); }
      g.fillStyle = "rgba(0,0,0,.18)"; g.fillRect(0, h - 10, w, 10);
    }));
    TX.sign = tex(canvas(1024, 256, (g, w, h) => {
      g.fillStyle = "#1c130c"; g.fillRect(0, 0, w, h);
      g.strokeStyle = "#c9913a"; g.lineWidth = 8; g.strokeRect(14, 14, w - 28, h - 28);
      g.fillStyle = "#f2b04f"; g.font = "bold 130px 'Zen Old Mincho','Hiragino Mincho ProN',serif"; g.textAlign = "center"; g.textBaseline = "middle";
      g.shadowColor = "#f2a53a"; g.shadowBlur = 24; g.fillText("浜風珈琲", w / 2, h / 2 + 6);
    }));
    TX.chalk = tex(canvas(512, 384, (g, w, h) => {
      g.fillStyle = "#1f2a25"; g.fillRect(0, 0, w, h); g.strokeStyle = "#6b4a2b"; g.lineWidth = 18; g.strokeRect(0, 0, w, h);
      g.fillStyle = "#f3ead8"; g.font = "bold 46px sans-serif"; g.textAlign = "center"; g.fillText("MENU", w / 2, 70);
      g.font = "30px sans-serif"; g.textAlign = "left";
      [["ブレンド", "480"], ["カフェラテ", "550"], ["ランチセット", "1200"], ["ケーキセット", "950"]].forEach((r, i) => {
        g.fillStyle = "#f3ead8"; g.fillText(r[0], 50, 140 + i * 52); g.textAlign = "right"; g.fillStyle = "#f2c46f"; g.fillText(r[1], w - 50, 140 + i * 52); g.textAlign = "left"; });
    }));
    TX.night = tex(canvas(256, 256, (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, "#0b1530"); gr.addColorStop(1, "#28385e");
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 40; i++) { g.fillStyle = "rgba(255,255,255," + rnd() * 0.8 + ")"; g.fillRect(rnd() * w, rnd() * h * 0.6, 2, 2); }
      g.fillStyle = "#f6f0d0"; g.beginPath(); g.arc(190, 60, 22, 0, 7); g.fill();
      g.fillStyle = "#121a2e"; for (let i = 0; i < 6; i++) { const bw = 30 + rnd() * 30, bh = 60 + rnd() * 80; g.fillRect(i * 46, h - bh, bw, bh); }
    }));
    TX.calendar = tex(canvas(256, 320, (g, w, h) => {
      g.fillStyle = "#fbf6ea"; g.fillRect(0, 0, w, h); g.fillStyle = "#b23a2a"; g.fillRect(0, 0, w, 56);
      g.fillStyle = "#fff"; g.font = "bold 36px sans-serif"; g.textAlign = "center"; g.fillText("11月", w / 2, 42);
      g.fillStyle = "#2b2620"; g.font = "18px sans-serif";
      ["日", "月", "火", "水", "木", "金", "土"].forEach((d, i) => g.fillText(d, 22 + i * 35, 80));
      for (let i = 0; i < 30; i++) { const col = (i + 5) % 7, row = Math.floor((i + 5) / 7); g.fillStyle = col === 0 ? "#b23a2a" : "#2b2620"; g.fillText(String(i + 1), 22 + col * 35, 112 + row * 42); }
      g.strokeStyle = "#e2553f"; g.lineWidth = 4; g.beginPath(); g.arc(22 + 0 * 35, 154 - 6, 15, 0, 7); g.stroke();
      g.fillStyle = "#e2553f"; g.font = "bold 13px sans-serif"; g.fillText("貸切", 22, 170);
    }));
    TX.screen = tex(canvas(512, 320, (g, w, h) => {
      g.fillStyle = "#e9eef5"; g.fillRect(0, 0, w, h); g.fillStyle = "#2b4a7a"; g.fillRect(0, 0, w, 40);
      g.fillStyle = "#fff"; g.font = "bold 22px sans-serif"; g.fillText("かんたん会計  帳簿", 14, 28);
      g.fillStyle = "#2b2620"; g.font = "20px sans-serif";
      [["10/28", "仕入 山海物産", "300,000"], ["11/2", "売上 レジ", "68,400"], ["11/4", "銀行 入金", "68,400"]].forEach((r, i) => {
        const y = 82 + i * 40; g.fillText(r[0], 16, y); g.fillText(r[1], 96, y); g.textAlign = "right"; g.fillText(r[2], w - 16, y); g.textAlign = "left";
        g.strokeStyle = "#c3ccd8"; g.beginPath(); g.moveTo(10, y + 12); g.lineTo(w - 10, y + 12); g.stroke(); });
    }));
    TX.photo = tex(canvas(256, 200, (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, "#9ad0ec"); gr.addColorStop(1, "#f7e1b5"); g.fillStyle = gr; g.fillRect(0, 0, w, h);
      g.fillStyle = "#e7d8bd"; g.fillRect(50, 70, 156, 110); g.fillStyle = "#1f5a4c"; g.fillRect(40, 60, 176, 22);
      g.fillStyle = "#3a2516"; g.fillRect(112, 120, 32, 60); g.fillStyle = "#e2553f"; g.font = "bold 22px serif"; g.textAlign = "center"; g.fillText("祝 開店", w / 2, 40);
    }));
    TX.box = tex(canvas(256, 256, (g, w, h) => {
      g.fillStyle = "#b98a55"; g.fillRect(0, 0, w, h); g.fillStyle = "rgba(0,0,0,.1)"; g.fillRect(0, h / 2 - 8, w, 16);
      g.fillStyle = "#5a3a1c"; g.font = "bold 34px sans-serif"; g.textAlign = "center"; g.fillText("COFFEE", w / 2, 100); g.font = "24px sans-serif"; g.fillText("山海物産", w / 2, 190);
    }));
    TX.clip = tex(canvas(200, 260, (g, w, h) => {
      g.fillStyle = "#fbf6ea"; g.fillRect(0, 0, w, h); g.fillStyle = "#2b2620"; g.font = "bold 22px sans-serif"; g.fillText("入荷記録", 20, 36);
      g.font = "18px sans-serif"; ["8月  3袋", "9月  3袋", "10月 3袋"].forEach((t, i) => g.fillText(t, 24, 84 + i * 44));
    }));
    TX.blind = tex(canvas(64, 256, (g, w, h) => { for (let y = 0; y < h; y += 16) { g.fillStyle = "#e8e4da"; g.fillRect(0, y, w, 12); g.fillStyle = "#9aa3b5"; g.fillRect(0, y + 12, w, 4); } }));
  }

  /* ---------- 表情（顔のテクスチャを描き替える） ---------- */
  function drawFace(g, w, h, expr, who) {
    g.clearRect(0, 0, w, h);
    const cx = w / 2, ey = h * 0.44, ex = w * 0.17;
    g.lineCap = "round"; g.lineJoin = "round";
    const ink = "#22180f";
    // ほお
    if (expr === "panic" || expr === "shock") { g.fillStyle = "rgba(120,170,230,.35)"; g.fillRect(cx - ex - 24, ey - 40, 2 * ex + 48, 22); }
    else { g.fillStyle = "rgba(230,120,100,.25)"; g.beginPath(); g.ellipse(cx - ex - 6, ey + 34, 18, 10, 0, 0, 7); g.ellipse(cx + ex + 6, ey + 34, 18, 10, 0, 0, 7); g.fill(); }
    // まゆ
    g.strokeStyle = ink; g.lineWidth = 9;
    const brow = { normal: [-4, 0], smile: [-6, 0], smug: [-10, 0.25], shock: [-22, -0.1], panic: [-16, -0.35], sad: [-10, -0.4], think: [-8, 0.15] }[expr] || [-4, 0];
    [-1, 1].forEach(sd => { g.save(); g.translate(cx + sd * ex, ey - 34 + brow[0]); g.rotate(sd * brow[1]); g.beginPath(); g.moveTo(-18, 0); g.lineTo(18, 0); g.stroke(); g.restore(); });
    // 目
    g.fillStyle = ink; g.strokeStyle = ink; g.lineWidth = 7;
    [-1, 1].forEach(sd => {
      const x = cx + sd * ex;
      if (expr === "smile") { g.beginPath(); g.arc(x, ey + 6, 13, Math.PI * 1.1, Math.PI * 1.9); g.stroke(); }
      else if (expr === "smug") { g.beginPath(); g.moveTo(x - 14, ey); g.lineTo(x + 14, ey); g.stroke(); g.beginPath(); g.arc(x, ey + 2, 7, 0, Math.PI); g.fill(); }
      else if (expr === "shock") { g.fillStyle = "#fff"; g.beginPath(); g.arc(x, ey, 17, 0, 7); g.fill(); g.lineWidth = 4; g.stroke(); g.fillStyle = ink; g.beginPath(); g.arc(x, ey, 5, 0, 7); g.fill(); g.lineWidth = 7; }
      else if (expr === "panic") { g.beginPath(); g.moveTo(x - 12, ey - 8); g.lineTo(x + 12, ey); g.lineTo(x - 12, ey + 8); if (sd > 0) { g.beginPath(); g.moveTo(x + 12, ey - 8); g.lineTo(x - 12, ey); g.lineTo(x + 12, ey + 8); } g.stroke(); }
      else if (expr === "sad") { g.beginPath(); g.arc(x, ey - 2, 12, Math.PI * 0.15, Math.PI * 0.85); g.stroke(); }
      else { g.beginPath(); g.ellipse(x, ey, 8, 11, 0, 0, 7); g.fill(); g.fillStyle = "#fff"; g.beginPath(); g.arc(x + 3, ey - 4, 3, 0, 7); g.fill(); g.fillStyle = ink; }
    });
    // めがね（森先輩）
    if (who === "mori") { g.strokeStyle = "#3a3f4a"; g.lineWidth = 5; [-1, 1].forEach(sd => { g.beginPath(); g.arc(cx + sd * ex, ey, 22, 0, 7); g.stroke(); }); g.beginPath(); g.moveTo(cx - ex + 22, ey); g.lineTo(cx + ex - 22, ey); g.stroke(); }
    // 口
    const my = h * 0.7; g.strokeStyle = ink; g.lineWidth = 7; g.fillStyle = "#7a2e22";
    if (expr === "smile") { g.beginPath(); g.moveTo(cx - 26, my - 6); g.quadraticCurveTo(cx, my + 22, cx + 26, my - 6); g.closePath(); g.fill(); g.stroke(); }
    else if (expr === "smug") { g.beginPath(); g.moveTo(cx - 22, my); g.quadraticCurveTo(cx + 4, my + 8, cx + 26, my - 12); g.stroke(); }
    else if (expr === "shock") { g.beginPath(); g.ellipse(cx, my + 4, 15, 22, 0, 0, 7); g.fill(); g.stroke(); }
    else if (expr === "panic") { g.beginPath(); g.moveTo(cx - 28, my); for (let i = 0; i < 6; i++) g.lineTo(cx - 28 + (i + 1) * 9.3, my + (i % 2 ? 0 : -9)); g.stroke(); }
    else if (expr === "sad") { g.beginPath(); g.moveTo(cx - 20, my + 8); g.quadraticCurveTo(cx, my - 10, cx + 20, my + 8); g.stroke(); }
    else if (expr === "think") { g.beginPath(); g.moveTo(cx - 14, my + 2); g.lineTo(cx + 14, my - 2); g.stroke(); }
    else { g.beginPath(); g.moveTo(cx - 20, my - 2); g.quadraticCurveTo(cx, my + 12, cx + 20, my - 2); g.stroke(); }
    // 汗
    if (expr === "panic" || expr === "shock") { g.fillStyle = "#8fd0ff"; g.beginPath(); g.moveTo(w * 0.86, h * 0.2); g.quadraticCurveTo(w * 0.94, h * 0.34, w * 0.86, h * 0.38); g.quadraticCurveTo(w * 0.78, h * 0.34, w * 0.86, h * 0.2); g.fill(); }
  }
  /* 吹き出しの横に出す顔アイコン（2D） */
  function portrait(who, expr) {
    return canvas(160, 160, (g, w, h) => {
      g.fillStyle = who === "boss" ? "#3a2c2c" : who === "mori" ? "#24384f" : "#3b3326"; g.fillRect(0, 0, w, h);
      g.fillStyle = who === "boss" ? "#2d2f3a" : "#3c4a60"; g.beginPath(); g.ellipse(w / 2, h + 10, 62, 44, 0, 0, 7); g.fill();
      if (who === "boss") { g.fillStyle = "#b23a2a"; g.beginPath(); g.moveTo(w / 2 - 8, h - 34); g.lineTo(w / 2 + 8, h - 34); g.lineTo(w / 2, h); g.fill(); }
      g.fillStyle = "#e9bf98"; g.beginPath(); g.arc(w / 2, 70, 46, 0, 7); g.fill();
      g.fillStyle = who === "boss" ? "#2a2a2a" : "#1d1b19";
      if (who === "boss") { g.beginPath(); g.arc(w / 2, 58, 47, Math.PI * 1.05, Math.PI * 1.95); g.fill(); g.fillStyle = "#2a2a2a"; g.fillRect(w / 2 - 20, 92, 40, 7); }
      else { g.beginPath(); g.arc(w / 2, 62, 48, Math.PI, 0); g.fill(); g.fillRect(w / 2 - 48, 52, 14, 34); }
      const f = canvas(256, 256, (gg, ww, hh) => drawFace(gg, ww, hh, expr, who));
      g.drawImage(f, w / 2 - 46, 26, 92, 92);
    });
  }

  /* ---------- 人物 ---------- */
  function person(opt) {
    const g = new T.Group();
    const suit = STD({ color: opt.suit, roughness: 0.65 }), skin = STD({ color: 0xd99a6c, roughness: 0.75 });
    const legs = box(0.34, 0.8, 0.22, STD({ color: opt.pants || 0x22242c }), 0, 0.4, 0, g);
    const torso = new T.Group(); torso.position.y = 0.8; g.add(torso);
    const body = mesh(new T.CylinderGeometry(0.24, 0.27, 0.72, 20), suit, 0, 0.36, 0, torso);
    if (opt.tie) { box(0.07, 0.42, 0.02, STD({ color: opt.tie }), 0, 0.44, 0.255, torso); box(0.16, 0.2, 0.02, STD({ color: 0xf3ead8 }), 0, 0.62, 0.245, torso); }
    const arms = [-1, 1].map(sd => { const a = new T.Group(); a.position.set(sd * 0.31, 0.66, 0); torso.add(a); cyl(0.07, 0.07, 0.6, suit, 0, -0.28, 0, a, 10); sph(0.075, skin, 0, -0.6, 0, a, 10, 8); return a; });
    const head = new T.Group(); head.position.set(0, 0.95, 0); torso.add(head);
    sph(0.2, skin, 0, 0, 0, head, 24, 18);
    const hair = mesh(new T.SphereGeometry(0.212, 24, 12, 0, Math.PI * 2, 0, Math.PI / (opt.bald ? 3.2 : 2.1)), STD({ color: opt.hair || 0x1d1d1d }), 0, 0.01, -0.01, head);
    hair.rotation.x = opt.bald ? -0.2 : -0.35;
    if (opt.mustache) box(0.1, 0.025, 0.03, STD({ color: 0x2a2a2a }), 0, -0.07, 0.19, head);
    [-1, 1].forEach(sd => sph(0.05, skin, sd * 0.2, -0.01, 0, head, 10, 8));
    if (opt.bald) [-1, 1].forEach(sd => { const h = sph(0.07, STD({ color: opt.hair || 0x1d1d1d }), sd * 0.17, 0.06, -0.06, head, 10, 8); h.scale.set(0.7, 1, 1.2); });
    const fc = canvas(256, 256, () => {}); const ft = tex(fc);
    const face = mesh(new T.PlaneGeometry(0.34, 0.34), new T.MeshBasicMaterial({ map: ft, transparent: true, depthWrite: false }), 0, 0.0, 0.201, head);
    face.castShadow = false;
    const p = { group: g, torso, head, arms, body, face, expr: "", who: opt.who, base: 0 };
    p.setFace = (e) => { if (p.expr === e) return; p.expr = e; drawFace(fc.getContext("2d"), 256, 256, e, opt.who); ft.needsUpdate = true; };
    p.setFace(opt.expr || "normal");
    return p;
  }

  /* ---------- マーカー（調べられる印） ---------- */
  function markerTex(kind) {
    return tex(canvas(128, 128, (g, w, h) => {
      const col = kind === "done" ? "#8a8f98" : kind === "door" ? "#7fc4ff" : "#f2a53a";
      g.fillStyle = "rgba(0,0,0,.45)"; g.beginPath(); g.arc(64, 64, 54, 0, 7); g.fill();
      g.strokeStyle = col; g.lineWidth = 8; g.beginPath(); g.arc(64, 64, 48, 0, 7); g.stroke();
      g.strokeStyle = col; g.fillStyle = col; g.lineWidth = 9; g.lineCap = "round";
      if (kind === "done") { g.beginPath(); g.moveTo(40, 66); g.lineTo(58, 84); g.lineTo(90, 46); g.stroke(); }
      else if (kind === "lock") { g.lineWidth = 7; g.beginPath(); g.arc(64, 54, 14, Math.PI, 0); g.stroke(); g.fillRect(44, 56, 40, 30); }
      else if (kind === "door") { g.beginPath(); g.moveTo(46, 64); g.lineTo(84, 64); g.moveTo(70, 48); g.lineTo(86, 64); g.lineTo(70, 80); g.stroke(); }
      else { g.beginPath(); g.arc(58, 58, 18, 0, 7); g.stroke(); g.beginPath(); g.moveTo(72, 72); g.lineTo(88, 88); g.stroke(); }
    }));
  }

  /* ---------- 世界 ---------- */
  const world = {
    scene: null, camera: null, renderer: null,
    spots: {}, doors: {}, people: {}, cam: { x: 0, y: 1.6, z: 14, yaw: 0, pitch: 0 },
    shake: 0, tweens: [], onFrame: [], portrait, V
  };

  world.init = function (container) {
    makeTextures();
    const r = new T.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    r.shadowMap.enabled = true; r.shadowMap.type = T.PCFSoftShadowMap;
    r.outputEncoding = T.sRGBEncoding; r.toneMapping = T.ACESFilmicToneMapping; r.toneMappingExposure = 0.95;
    container.appendChild(r.domElement); world.renderer = r;
    const s = new T.Scene(); s.background = new T.Color(0x0b1020); s.fog = new T.Fog(0x0b1020, 12, 34); world.scene = s;
    const c = new T.PerspectiveCamera(62, 1, 0.05, 80); c.rotation.order = "YXZ"; world.camera = c;
    world.resize(); addEventListener("resize", world.resize);
    build();
    requestAnimationFrame(loop);
  };
  world.resize = function () {
    const w = innerWidth, h = innerHeight; world.renderer.setSize(w, h);
    world.camera.aspect = w / h; world.camera.fov = w < h ? 80 : 58; world.camera.updateProjectionMatrix();
  };

  function build() {
    const s = world.scene;
    /* 光 */
    s.add(new T.HemisphereLight(0x9fb2d8, 0x3a2614, 0.55));
    const moon = new T.DirectionalLight(0x9fb8ff, 0.35); moon.position.set(-6, 10, 10); s.add(moon);
    const spot = new T.SpotLight(0xffd8a0, 1.5, 13, Math.PI / 2.8, 0.55, 1.3);
    spot.position.set(0.2, 2.95, 0.4); spot.target.position.set(-0.6, 0, -1.4); spot.castShadow = true;
    spot.shadow.mapSize.set(1024, 1024); spot.shadow.bias = -0.0006; s.add(spot, spot.target);
    const warm = new T.PointLight(0xffb066, 1.0, 7, 1.6); warm.position.set(-1.6, 2.2, -2.4); s.add(warm);
    const lamp = new T.PointLight(0xffd59a, 1.3, 6, 1.6); lamp.position.set(2.4, 1.9, -7.2); s.add(lamp);
    const street = new T.PointLight(0x9fc3ff, 1.4, 14, 1.4); street.position.set(4.6, 3.7, 8.5); s.add(street);

    const wallM = STD({ map: TX.wall, roughness: 0.95 }), offWallM = STD({ map: TX.officeWall, roughness: 0.95 });
    const wood = STD({ color: 0x7a4f2e, roughness: 0.55 }), dark = STD({ color: 0x3b2617, roughness: 0.55 });
    const metal = STD({ color: 0x3a434f, metalness: 0.7, roughness: 0.35 }), cream = STD({ color: 0xf3ead8 });

    /* 外 */
    box(40, 0.05, 30, STD({ color: 0x1c212b, roughness: 1 }), 0, -0.03, 10);
    box(40, 0.12, 3, STD({ color: 0x3a3f4a }), 0, 0.04, 5.8);
    for (let i = -4; i < 5; i++) box(1.2, 0.01, 0.15, BASIC({ color: 0xcfd6e0 }), i * 3.5, 0.0, 11);
    // 建物の外壁（2部屋ぶん）
    const brick = STD({ map: TX.brick, roughness: 0.95 });
    box(3.3, 3.4, 0.2, brick, -2.55, 1.7, 4.1); box(3.3, 3.4, 0.2, brick, 2.55, 1.7, 4.1); box(1.8, 1.0, 0.2, brick, 0, 2.9, 4.1);
    box(0.2, 3.4, 12.8, brick, -4.3, 1.7, -2.2); box(0.2, 3.4, 12.8, brick, 4.3, 1.7, -2.2);
    box(8.8, 0.25, 13, STD({ color: 0x2b2420 }), 0, 3.5, -2.1);
    plane(3.0, 0.75, BASIC({ map: TX.sign }), 0, 3.05, 4.22);
    const awn = box(8.4, 0.05, 1.1, STD({ map: TX.awning, roughness: 0.9 }), 0, 2.6, 4.7); awn.rotation.x = 0.32;
    // 窓（外から：明るい／中から：夜の景色）
    [-2.5, 2.5].forEach(x => {
      plane(2.2, 1.3, BASIC({ color: 0xffcf8a }), x, 1.55, 4.215);
      box(2.3, 0.08, 0.3, dark, x, 0.86, 4.25);
      plane(2.2, 1.3, BASIC({ map: TX.night }), x, 1.55, 3.98, Math.PI);
    });
    // 入口のドア（2枚）
    world.doors.frontL = box(0.8, 2.3, 0.06, wood, -0.4, 1.15, 4.08);
    world.doors.frontR = box(0.8, 2.3, 0.06, wood, 0.4, 1.15, 4.08);
    [world.doors.frontL, world.doors.frontR].forEach(d => { const gl = mesh(new T.PlaneGeometry(0.5, 0.9), BASIC({ color: 0xffd9a0 }), 0, 0.35, 0.035, d); gl.castShadow = false; });
    // 街灯
    cyl(0.05, 0.07, 3.8, metal, 4.6, 1.9, 8.5); sph(0.2, BASIC({ color: 0xdfe8ff }), 4.6, 3.85, 8.5);
    // 調査車
    const car = new T.Group(); s.add(car); world.car = car;
    const carM = STD({ color: 0x2c3e5c, metalness: 0.5, roughness: 0.35 });
    box(2.0, 0.62, 4.2, carM, 0, 0.6, 0, car); box(1.75, 0.55, 2.3, STD({ color: 0x141a26, metalness: 0.6, roughness: 0.15 }), 0, 1.18, -0.2, car);
    [[-1.0, 1.35], [1.0, 1.35], [-1.0, -1.35], [1.0, -1.35]].forEach(([x, z]) => { const w = cyl(0.33, 0.33, 0.24, STD({ color: 0x111111 }), x, 0.33, z, car); w.rotation.z = Math.PI / 2; });
    [-0.65, 0.65].forEach(x => { sph(0.09, BASIC({ color: 0xfff2c0 }), x, 0.7, 2.1, car); sph(0.07, BASIC({ color: 0xff4030 }), x, 0.7, -2.1, car); });
    car.position.set(-12, 0, 8.2); car.rotation.y = Math.PI / 2;

    /* 店内 */
    box(8.4, 0.05, 8.2, STD({ map: TX.floor, roughness: 0.7 }), 0, 0.02, 0);
    box(8.4, 0.05, 8.2, STD({ color: 0x2e2722 }), 0, 3.02, 0);
    box(6.7, 3, 0.2, wallM, -0.75, 1.5, -4); // 奥の壁（ドアの左）
    box(0.5, 3, 0.2, wallM, 3.85, 1.5, -4); box(1.0, 0.9, 0.2, wallM, 3.1, 2.55, -4); // ドアの右と上
    box(0.2, 3, 8.2, wallM, -4.1, 1.5, 0); box(0.2, 3, 8.2, wallM, 4.1, 1.5, 0);
    box(8.2, 0.9, 0.05, STD({ color: 0x5b3a22 }), -0.1, 0.45, -3.88);
    // 天井の梁
    for (let i = -3; i <= 3; i += 3) box(8.2, 0.12, 0.14, dark, 0, 2.94, i); // 天井の梁（横向き）
    // 黒板メニュー
    plane(1.4, 1.05, STD({ map: TX.chalk, roughness: 0.9 }), -1.4, 2.15, -3.88);
    // カウンター
    box(3.4, 1.0, 0.8, dark, -1.6, 0.5, -2.4); box(3.6, 0.08, 1.0, wood, -1.6, 1.04, -2.4);
    // エスプレッソマシン
    const em = new T.Group(); s.add(em); em.position.set(0.05, 1.08, -2.55);
    box(0.6, 0.45, 0.4, STD({ color: 0xb8bcc4, metalness: 0.85, roughness: 0.25 }), 0, 0.22, 0, em);
    box(0.62, 0.06, 0.42, STD({ color: 0x222222 }), 0, 0.47, 0, em);
    [-0.15, 0.15].forEach(x => cyl(0.04, 0.04, 0.12, STD({ color: 0x222222 }), x, 0.1, 0.22, em, 10));
    // 奥の棚とカップ・瓶
    [1.75, 2.35].forEach(y => box(3.4, 0.05, 0.3, wood, -1.6, y, -3.82));
    for (let i = 0; i < 8; i++) cyl(0.07, 0.06, 0.12, STD({ color: i % 2 ? 0xf3ead8 : 0x2f6f8f }), -3.0 + i * 0.4, 1.84, -3.8, null, 12);
    for (let i = 0; i < 6; i++) { cyl(0.09, 0.09, 0.24, STD({ color: 0xcfe3e0, transparent: true, opacity: 0.55, roughness: 0.1 }), -2.9 + i * 0.55, 2.5, -3.8, null, 12); cyl(0.08, 0.08, 0.14, STD({ color: [0x4a2a18, 0x6b3a1c, 0x3a2212][i % 3] }), -2.9 + i * 0.55, 2.45, -3.8, null, 12); }
    // ペンダントライト
    [-2.4, -0.8].forEach(x => { cyl(0.006, 0.006, 0.7, STD({ color: 0x111111 }), x, 2.65, -2.4); cyl(0.2, 0.06, 0.2, STD({ color: 0x1f5a4c, metalness: 0.3 }), x, 2.25, -2.4); sph(0.07, BASIC({ color: 0xffe1a8 }), x, 2.14, -2.4, null, 12, 8); });
    // テーブルと椅子
    function table(x, z) {
      cyl(0.55, 0.55, 0.05, wood, x, 0.75, z); cyl(0.05, 0.05, 0.72, metal, x, 0.37, z, null, 10); cyl(0.3, 0.3, 0.03, metal, x, 0.02, z);
      [[0.85, 0], [-0.85, 0]].forEach(([dx]) => {
        const ch = new T.Group(); ch.position.set(x + dx, 0, z); s.add(ch);
        box(0.44, 0.05, 0.44, dark, 0, 0.46, 0, ch); box(0.05, 0.5, 0.44, dark, dx > 0 ? 0.2 : -0.2, 0.72, 0, ch);
        [[0.18, 0.18], [-0.18, 0.18], [0.18, -0.18], [-0.18, -0.18]].forEach(([a, b]) => box(0.04, 0.44, 0.04, dark, a, 0.22, b, ch));
      });
      cyl(0.06, 0.05, 0.1, cream, x + 0.15, 0.83, z - 0.1, null, 12);
    }
    table(1.7, 0.6); table(1.7, -1.9);

    /* 店内の調べられる物 */
    // レジ
    { const g = group("register", -2.5, 1.08, -2.4);
      box(0.5, 0.26, 0.42, STD({ color: 0x2b2f36, metalness: 0.5, roughness: 0.4 }), 0, 0.13, 0, g);
      const scr = box(0.34, 0.2, 0.03, BASIC({ color: 0x7fe0a8 }), 0, 0.38, -0.08, g); scr.rotation.x = -0.4;
      const roll = cyl(0.06, 0.06, 0.16, cream, 0.17, 0.3, 0.13, g, 12); roll.rotation.z = Math.PI / 2;
      const tape = plane(0.12, 0.01, cream, 0.17, 0.3, 0.2, 0, g); tape.rotation.x = -Math.PI / 2; world.registerTape = tape;
      addSpot("register", g, V(-2.5, 1.3, -2.4), V(-2.15, 1.85, -1.3)); }
    // ゴミ箱
    { const g = group("trash", 0.45, 0, -2.0);
      cyl(0.2, 0.16, 0.5, STD({ color: 0x4b5563, metalness: 0.35 }), 0, 0.25, 0, g);
      [[0, 0.52, 0], [0.08, 0.55, 0.05], [-0.07, 0.5, -0.06]].forEach(p => { const m = mesh(new T.IcosahedronGeometry(0.075, 0), cream, p[0], p[1], p[2], g); });
      addSpot("trash", g, V(0.45, 0.45, -2.0), V(0.6, 1.4, -0.9)); }
    // カレンダー
    { const g = group("calendar", -4.0, 1.75, -0.6); g.rotation.y = Math.PI / 2;
      plane(0.5, 0.62, STD({ map: TX.calendar, roughness: 0.9 }), 0, 0, 0, 0, g);
      addSpot("calendar", g, V(-3.95, 1.75, -0.6), V(-2.85, 1.75, -0.6)); }
    // 本棚
    { const g = group("shelf", 3.85, 0, 1.6);
      box(0.4, 2.0, 1.4, dark, 0, 1.0, 0, g);
      const cols = [0x8f3b2e, 0x2f6f8f, 0xd9b44a, 0x445a3a, 0x6d4c7d];
      for (let rr = 0; rr < 3; rr++) for (let i = 0; i < 6; i++) box(0.26, 0.32 + (i % 2) * 0.04, 0.12, STD({ color: cols[(rr * 6 + i) % 5] }), -0.04, 0.35 + rr * 0.6, -0.52 + i * 0.2, g);
      addSpot("shelf", g, V(3.7, 1.4, 1.6), V(2.6, 1.6, 1.6)); }
    // 観葉植物
    { const g = group("plant", -3.4, 0, 3.3);
      cyl(0.26, 0.2, 0.46, STD({ color: 0xb8754a }), 0, 0.23, 0, g); cyl(0.24, 0.24, 0.03, STD({ color: 0x3a2618 }), 0, 0.45, 0, g);
      for (let i = 0; i < 11; i++) { const l = mesh(new T.ConeGeometry(0.12, 0.8, 6), STD({ color: i % 2 ? 0x3f7a4a : 0x2f6a3e, roughness: 0.9 }), Math.cos(i * 1.7) * 0.12, 0.8 + (i % 3) * 0.13, Math.sin(i * 1.7) * 0.12, g); l.rotation.set(Math.sin(i * 1.7) * 0.6, 0, Math.cos(i * 1.7) * 0.6); }
      const key = new T.Group(); key.position.set(0.05, 0.44, 0.08); g.add(key); key.visible = false; world.keyMesh = key;
      const gold = STD({ color: 0xe0b44a, metalness: 0.9, roughness: 0.25 });
      mesh(new T.TorusGeometry(0.04, 0.012, 8, 16), gold, 0, 0, 0, key); box(0.012, 0.012, 0.1, gold, 0, 0, 0.08, key); box(0.012, 0.03, 0.012, gold, 0, -0.015, 0.12, key);
      addSpot("plant", g, V(-3.4, 0.9, 3.3), V(-2.4, 1.5, 2.3)); }
    // 事務室へのドア
    { const frame = box(1.24, 2.3, 0.08, dark, 3.1, 1.15, -4.02); frame.visible = false;
      const pivot = new T.Group(); pivot.position.set(2.6, 0, -4.0); s.add(pivot); world.doors.office = pivot;
      const d = box(1.0, 2.1, 0.05, wood, 0.5, 1.05, 0, pivot); sph(0.04, STD({ color: 0xd9b44a, metalness: 0.9 }), 0.88, 1.0, 0.05, pivot, 10, 8);
      plane(0.5, 0.2, BASIC({ map: tex(canvas(256, 100, (g, w, h) => { g.fillStyle = "#f3ead8"; g.fillRect(0, 0, w, h); g.fillStyle = "#2b2620"; g.font = "bold 46px sans-serif"; g.textAlign = "center"; g.fillText("事務室", w / 2, 66); })) }), 0.5, 1.65, 0.03, 0, pivot);
      addDoor("toOffice", V(3.1, 1.5, -3.9)); }

    /* 事務室（z: -4 〜 -8.4, x: -0.6 〜 4.0） */
    box(4.8, 0.05, 4.4, STD({ color: 0x6f7268, roughness: 0.85 }), 1.7, 0.02, -6.2);
    box(4.8, 0.05, 4.4, STD({ color: 0x2a2a28 }), 1.7, 3.02, -6.2);
    box(4.8, 3, 0.2, offWallM, 1.7, 1.5, -8.45); box(0.2, 3, 4.4, offWallM, -0.65, 1.5, -6.2); box(0.2, 3, 4.4, offWallM, 4.05, 1.5, -6.2);
    // 窓とブラインド
    plane(1.3, 1.0, BASIC({ map: TX.night }), 1.7, 1.95, -8.33);
    plane(1.3, 1.0, STD({ map: TX.blind, transparent: true, opacity: 0.85 }), 1.7, 1.95, -8.31);
    // 机
    box(1.8, 0.06, 0.8, wood, 1.7, 0.76, -7.6); box(0.06, 0.74, 0.76, dark, 0.84, 0.37, -7.6);
    const drawerBody = box(0.6, 0.6, 0.74, dark, 2.25, 0.4, -7.6);
    const drawer = new T.Group(); drawer.position.set(2.25, 0.58, -7.22); s.add(drawer); world.drawer = drawer;
    box(0.54, 0.18, 0.04, wood, 0, 0, 0, drawer); box(0.14, 0.03, 0.03, STD({ color: 0xd9b44a, metalness: 0.9 }), 0, 0, 0.03, drawer);
    const dIn = box(0.5, 0.14, 0.6, dark, 0, 0, -0.32, drawer);
    const papers = box(0.36, 0.06, 0.3, cream, 0, 0.05, -0.3, drawer);
    box(0.12, 0.05, 0.02, STD({ color: 0xc23a2a }), 0.1, 0.09, -0.16, drawer);
    addSpot("desk", drawer, V(2.25, 0.62, -7.2), V(2.05, 1.35, -6.15));
    // 椅子
    { const ch = new T.Group(); ch.position.set(1.6, 0, -6.8); s.add(ch); cyl(0.26, 0.26, 0.08, STD({ color: 0x222831 }), 0, 0.5, 0, ch); box(0.46, 0.5, 0.06, STD({ color: 0x222831 }), 0, 0.8, -0.24, ch); cyl(0.03, 0.03, 0.45, metal, 0, 0.25, 0, ch, 8); ch.rotation.y = 0.4; }
    // デスクライト
    { cyl(0.08, 0.1, 0.03, metal, 2.6, 0.8, -7.85); const arm = cyl(0.015, 0.015, 0.5, metal, 2.6, 1.04, -7.85, null, 8); arm.rotation.z = 0.3; cyl(0.04, 0.12, 0.12, STD({ color: 0x1f5a4c }), 2.5, 1.3, -7.8); sph(0.04, BASIC({ color: 0xffe9b0 }), 2.5, 1.24, -7.8, null, 8, 6); }
    // パソコン
    { const g = group("pc", 1.45, 0.79, -7.75);
      box(0.08, 0.3, 0.08, metal, 0, 0.15, -0.05, g); box(0.25, 0.02, 0.18, metal, 0, 0.01, -0.05, g);
      box(0.72, 0.46, 0.04, STD({ color: 0x1b1f27 }), 0, 0.5, 0, g);
      plane(0.66, 0.4, BASIC({ map: TX.screen }), 0, 0.5, 0.022, 0, g);
      plane(0.09, 0.09, BASIC({ color: 0xf6e36b }), 0.31, 0.29, 0.03, 0, g);
      box(0.5, 0.02, 0.16, STD({ color: 0x2a2f38 }), 0, 0.01, 0.3, g);
      addSpot("pc", g, V(1.45, 1.3, -7.75), V(1.45, 1.4, -6.75)); }
    // 写真立て（左の壁の棚）
    { box(0.3, 0.04, 1.0, wood, -0.45, 1.4, -6.4);
      const g = group("photo", -0.45, 1.42, -6.2); g.rotation.y = Math.PI / 2;
      box(0.36, 0.3, 0.03, STD({ color: 0x8a6a3a }), 0, 0.15, 0, g); plane(0.3, 0.24, BASIC({ map: TX.photo }), 0, 0.15, 0.017, 0, g);
      g.children[0].rotation.x = -0.12; g.children[1].rotation.x = -0.12;
      for (let i = 0; i < 3; i++) box(0.22, 0.28, 0.06, STD({ color: [0x2f6f8f, 0x8f3b2e, 0x445a3a][i] }), -0.45, 1.56, -6.7 + i * 0.08);
      addSpot("photo", g, V(-0.45, 1.6, -6.2), V(0.6, 1.65, -6.2)); }
    // 段ボール
    { const g = group("boxes", 0.0, 0, -7.6);
      const bm = STD({ map: TX.box, roughness: 0.95 });
      box(0.6, 0.45, 0.5, bm, 0, 0.225, 0, g); box(0.6, 0.45, 0.5, bm, 0.05, 0.675, 0.02, g).rotation.y = 0.1; box(0.5, 0.4, 0.45, bm, 0.0, 0.2, 0.6, g);
      const clip = plane(0.22, 0.29, STD({ map: TX.clip }), 0.0, 0.62, 0.86, 0, g); clip.rotation.x = -0.15;
      addSpot("boxes", g, V(0.0, 0.8, -7.4), V(0.9, 1.45, -6.2)); }
    // 金庫
    { const g = group("safe", 3.5, 0, -7.7); g.rotation.y = -Math.PI / 5;
      box(0.75, 0.85, 0.65, metal, 0, 0.425, 0, g);
      const hinge = new T.Group(); hinge.position.set(-0.34, 0.425, 0.33); g.add(hinge); world.safeDoor = hinge;
      box(0.68, 0.78, 0.04, STD({ color: 0x4a5563, metalness: 0.75, roughness: 0.3 }), 0.34, 0, 0, hinge);
      const dial = cyl(0.1, 0.1, 0.04, STD({ color: 0xc8c8c8, metalness: 0.9, roughness: 0.2 }), 0.42, 0.08, 0.03, hinge); dial.rotation.x = Math.PI / 2; world.safeDial = dial;
      box(0.04, 0.2, 0.04, STD({ color: 0xc8c8c8, metalness: 0.9 }), 0.16, -0.08, 0.04, hinge);
      const env = box(0.3, 0.04, 0.2, STD({ color: 0xd9c49a }), 0, 0.3, 0.05, g); world.envelope = env;
      addSpot("safe", g, V(3.5, 0.7, -7.7), V(2.75, 1.35, -6.6)); }
    // 壁の時計
    { const c = cyl(0.22, 0.22, 0.04, cream, 4.0, 2.2, -6.0, null, 24); c.rotation.z = Math.PI / 2; }
    // 事務室から店へ戻るドア（事務室側の目印）
    addDoor("toShop", V(3.1, 1.5, -4.15));

    /* 人物 */
    const boss = person({ who: "boss", suit: 0x2d2f3a, tie: 0xb23a2a, hair: 0x2a2a2a, bald: true, mustache: true, expr: "smile" });
    boss.group.position.set(-1.45, 0, -3.2); s.add(boss.group); world.people.boss = boss;
    const mori = person({ who: "mori", suit: 0x3c4a60, tie: 0x1f5a4c, hair: 0x1d1b19, pants: 0x2a3140, expr: "normal" });
    mori.group.position.set(2.0, 0, 2.2); mori.group.rotation.y = -2.4; s.add(mori.group); world.people.mori = mori;
    mori.arms[1].rotation.x = -0.6; box(0.2, 0.28, 0.02, cream, 0.0, -0.55, 0.12, mori.arms[1]).rotation.x = 0.6;

    /* ほこりの粒 */
    const n = 120, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { pos[i * 3] = (rnd() - 0.5) * 7; pos[i * 3 + 1] = rnd() * 2.8; pos[i * 3 + 2] = (rnd() - 0.5) * 7; }
    const pg = new T.BufferGeometry(); pg.setAttribute("position", new T.BufferAttribute(pos, 3));
    const dust = new T.Points(pg, new T.PointsMaterial({ color: 0xffe2b0, size: 0.018, transparent: true, opacity: 0.6, depthWrite: false, map: tex(canvas(32, 32, (g) => { const r = g.createRadialGradient(16, 16, 0, 16, 16, 16); r.addColorStop(0, "rgba(255,255,255,1)"); r.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = r; g.fillRect(0, 0, 32, 32); })) }));
    s.add(dust); world.dust = dust;
  }

  function group(id, x, y, z) { const g = new T.Group(); g.position.set(x, y, z); world.scene.add(g); return g; }
  const MT = {};
  function addSpot(id, g, focus, camPos) {
    g.traverse(o => { if (o.isMesh) o.userData.spot = id; });
    MT.search = MT.search || markerTex("search"); MT.done = MT.done || markerTex("done"); MT.lock = MT.lock || markerTex("lock");
    const sp = new T.Sprite(new T.SpriteMaterial({ map: MT.search, depthTest: false, transparent: true }));
    sp.scale.set(0.26, 0.26, 1); sp.position.copy(focus).add(V(0, 0.36, 0)); sp.renderOrder = 20; sp.userData.spot = id;
    world.scene.add(sp);
    world.spots[id] = { group: g, focus, camPos, marker: sp, state: "new" };
  }
  function addDoor(id, at) {
    MT.door = MT.door || markerTex("door");
    const sp = new T.Sprite(new T.SpriteMaterial({ map: MT.door, depthTest: false, transparent: true }));
    sp.scale.set(0.34, 0.34, 1); sp.position.copy(at); sp.renderOrder = 20; sp.userData.door = id; world.scene.add(sp);
    world.doors[id + "Marker"] = sp;
  }
  world.setMarker = function (id, kind) {
    const s = world.spots[id]; if (!s) return; s.state = kind;
    s.marker.material.map = MT[kind === "done" ? "done" : kind === "lock" ? "lock" : "search"]; s.marker.material.needsUpdate = true;
  };
  world.showMarkers = function (room, on) {
    const C = window.CASE;
    for (const id in world.spots) world.spots[id].marker.visible = on && C.spots[id].room === room;
    world.doors.toOfficeMarker.visible = on && room === "shop";
    world.doors.toShopMarker.visible = false; // 事務室からは画面下のボタンで戻る
  };

  /* ---------- カメラ・アニメーション ---------- */
  const ease = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  world.ease = ease;
  world.fast = false;
  world.tween = function (ms, fn) {
    return new Promise(res => world.tweens.push({ t0: performance.now(), ms: world.fast ? 1 : reduce ? Math.min(ms, 120) : ms, fn, res }));
  };
  world.finishAll = function () { world.tweens.forEach(t => { t.ms = 1; }); };
  function angTo(from, to) { let d = to - from; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return from + d; }
  world.lookAngles = function (p, t) { const dx = t.x - p.x, dy = t.y - p.y, dz = t.z - p.z; return { yaw: Math.atan2(-dx, -dz), pitch: Math.atan2(dy, Math.hypot(dx, dz)) }; };
  world.place = function (p, t) { const c = world.cam; c.x = p.x; c.y = p.y; c.z = p.z; const a = world.lookAngles(p, t); c.yaw = a.yaw; c.pitch = a.pitch; };
  world.flyTo = function (p, t, ms) {
    const c = world.cam, s = { ...c }, a = world.lookAngles(p, t), ey = angTo(s.yaw, a.yaw);
    return world.tween(ms || 1000, k => { const e = ease(k); c.x = s.x + (p.x - s.x) * e; c.y = s.y + (p.y - s.y) * e; c.z = s.z + (p.z - s.z) * e; c.yaw = s.yaw + (ey - s.yaw) * e; c.pitch = s.pitch + (a.pitch - s.pitch) * e; });
  };
  world.snapshot = () => ({ ...world.cam });
  world.restore = function (snap, ms) {
    const c = world.cam, s = { ...c }, ey = angTo(s.yaw, snap.yaw);
    return world.tween(ms || 800, k => { const e = ease(k); c.x = s.x + (snap.x - s.x) * e; c.y = s.y + (snap.y - s.y) * e; c.z = s.z + (snap.z - s.z) * e; c.yaw = s.yaw + (ey - s.yaw) * e; c.pitch = s.pitch + (snap.pitch - s.pitch) * e; });
  };

  /* 演出 */
  world.openFront = () => world.tween(1000, k => { const e = ease(k); world.doors.frontL.position.x = -0.4 - 0.75 * e; world.doors.frontR.position.x = 0.4 + 0.75 * e; });
  world.swingOffice = (open) => world.tween(700, k => { const e = ease(k); world.doors.office.rotation.y = open ? -1.9 * e : -1.9 * (1 - e); });
  world.driveIn = () => world.tween(2600, k => { const e = 1 - Math.pow(1 - k, 3); world.car.position.x = -12 + 10.5 * e; });
  world.openSafe = async () => {
    await world.tween(900, k => { world.safeDial.rotation.y = k * Math.PI * 4; });
    await world.tween(800, k => { world.safeDoor.rotation.y = -1.7 * ease(k); });
  };
  world.jiggleDrawer = () => world.tween(500, k => { world.drawer.position.z = -7.22 + Math.sin(k * Math.PI * 6) * 0.012 * (1 - k); });
  world.openDrawer = () => world.tween(800, k => { world.drawer.position.z = -7.22 + 0.42 * ease(k); });
  world.revealKey = async () => {
    const k3 = world.keyMesh; k3.visible = true;
    await world.tween(900, k => { const e = ease(k); k3.position.y = 0.44 + 0.35 * e; k3.rotation.y = k * Math.PI * 3; });
  };
  world.printTape = () => world.tween(900, k => { world.registerTape.scale.y = 1 + k * 30; world.registerTape.position.z = 0.2 + k * 0.15; });

  /* 人物の動き */
  world.react = function (who, kind) {
    const p = world.people[who]; if (!p) return Promise.resolve();
    if (kind === "shock") {
      p.setFace("shock"); world.shake = 0.06;
      return world.tween(1100, k => { const e = Math.sin(k * Math.PI); p.torso.rotation.x = -0.28 * e; p.head.rotation.z = Math.sin(k * 40) * 0.08 * (1 - k); p.arms.forEach((a, i) => { a.rotation.z = (i ? -1 : 1) * 1.1 * e; a.rotation.x = -0.5 * e; }); })
        .then(() => p.setFace("panic"));
    }
    if (kind === "smug") {
      p.setFace("smug");
      return world.tween(1000, k => { const e = Math.sin(k * Math.PI); p.torso.rotation.x = -0.12 * e; p.head.rotation.x = -0.25 * e; p.arms.forEach((a, i) => { a.rotation.x = -1.0 * e; a.rotation.z = (i ? 0.6 : -0.6) * e; }); });
    }
    if (kind === "sad") {
      p.setFace("sad");
      return world.tween(1200, k => { const e = ease(k); p.torso.rotation.x = 0.35 * e; p.head.rotation.x = 0.3 * e; p.arms.forEach(a => { a.rotation.z = 0; a.rotation.x = 0; }); });
    }
    if (kind === "talk") {
      return world.tween(600, k => { p.head.rotation.x = Math.sin(k * Math.PI * 2) * 0.06; });
    }
    if (kind === "reset") { p.torso.rotation.set(0, 0, 0); p.head.rotation.set(0, 0, 0); p.arms.forEach(a => a.rotation.set(0, 0, 0)); return Promise.resolve(); }
    return Promise.resolve();
  };
  world.turnTo = function (who, target, ms) {
    const p = world.people[who]; const g = p.group; const a0 = g.rotation.y;
    const a1 = angTo(a0, Math.atan2(target.x - g.position.x, target.z - g.position.z));
    return world.tween(ms || 500, k => { g.rotation.y = a0 + (a1 - a0) * ease(k); });
  };

  /* ---------- 毎フレーム ---------- */
  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    for (let i = world.tweens.length - 1; i >= 0; i--) {
      const tw = world.tweens[i]; const k = Math.min(1, (now - tw.t0) / tw.ms); tw.fn(k);
      if (k >= 1) { world.tweens.splice(i, 1); tw.res(); }
    }
    const c = world.cam, cam = world.camera;
    cam.position.set(c.x, c.y, c.z); cam.rotation.set(c.pitch, c.yaw, 0);
    if (world.shake > 0) { cam.position.x += (Math.random() - 0.5) * world.shake; cam.position.y += (Math.random() - 0.5) * world.shake; world.shake = Math.max(0, world.shake - dt * 0.2); }
    const pulse = 1 + Math.sin(now / 280) * 0.14;
    for (const id in world.spots) { const s = world.spots[id]; const sc = (s.state === "done" ? 0.22 : 0.27 * pulse); s.marker.scale.set(sc, sc, 1); s.marker.position.y = s.focus.y + 0.36 + Math.sin(now / 500 + s.focus.x) * 0.03; }
    ["toOfficeMarker", "toShopMarker"].forEach(k => { const m = world.doors[k]; if (m) { const sc = 0.36 * pulse; m.scale.set(sc, sc, 1); } });
    if (!reduce) {
      const b = world.people.boss; if (b) b.body.scale.y = 1 + Math.sin(now / 650) * 0.012;
      const m = world.people.mori; if (m) m.body.scale.y = 1 + Math.sin(now / 720 + 1) * 0.012;
      if (world.dust) world.dust.rotation.y += dt * 0.02;
    }
    world.onFrame.forEach(f => f(dt, now));
    world.renderer.render(world.scene, cam);
    requestAnimationFrame(loop);
  }

  /* タップした物を調べる */
  const ray = new T.Raycaster(), ndc = new T.Vector2();
  world.pick = function (x, y) {
    ndc.set(x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1); ray.setFromCamera(ndc, world.camera);
    // まずマーカー（少し大きめに当たり判定）
    const sprites = [];
    for (const id in world.spots) if (world.spots[id].marker.visible) sprites.push(world.spots[id].marker);
    ["toOfficeMarker", "toShopMarker"].forEach(k => world.doors[k].visible && sprites.push(world.doors[k]));
    let best = null, bestD = 1e9;
    sprites.forEach(sp => { const p = sp.position.clone().project(world.camera); if (p.z > 1) return; const sx = (p.x + 1) / 2 * innerWidth, sy = (1 - p.y) / 2 * innerHeight; const d = Math.hypot(sx - x, sy - y); if (d < 44 && d < bestD) { bestD = d; best = sp; } });
    if (best) return best.userData.door ? { door: best.userData.door } : { spot: best.userData.spot };
    const hits = ray.intersectObjects(world.scene.children, true);
    for (const h of hits) {
      if (h.object.isSprite || h.object.isPoints) continue;
      let o = h.object; while (o && !o.userData.spot) o = o.parent;
      if (o && o.userData.spot && world.spots[o.userData.spot].marker.visible) return { spot: o.userData.spot };
      if (h.distance < 30) return null;
    }
    return null;
  };

  window.WORLD = world;
})();
