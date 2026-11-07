/* 効果音とBGM（音のファイルは使わず、ブラウザーの中で合成する）
 * iPhone はマナーモードのとき Web Audio が鳴らないことがあるため、
 * ① audioSession を "playback" にする ② 無音の <audio> を流して再生モードに切り替える、の2つで対策する */
(function () {
  "use strict";
  let ctx = null, master = null, sfxBus = null, bgmBus = null, comp = null, on = true, silentEl = null;
  try { on = localStorage.getItem("rinjo:sound") !== "off"; } catch (e) {}

  /* 無音のWAV（0.5秒）を作る */
  function silentWavUrl() {
    const sr = 8000, n = sr / 2, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
    const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    w(0, "RIFF"); v.setUint32(4, 36 + n * 2, true); w(8, "WAVE"); w(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, "data"); v.setUint32(40, n * 2, true);
    return URL.createObjectURL(new Blob([buf], { type: "audio/wav" }));
  }

  function ensure() {
    try { if (navigator.audioSession) navigator.audioSession.type = "playback"; } catch (e) {}
    if (!silentEl) { try { silentEl = new Audio(silentWavUrl()); silentEl.loop = true; silentEl.setAttribute("playsinline", ""); silentEl.volume = 0.01; } catch (e) {} }
    if (silentEl && silentEl.paused && on) { const p = silentEl.play(); if (p && p.catch) p.catch(() => {}); }
    if (ctx) { if (ctx.state !== "running") ctx.resume(); return true; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return false;
    ctx = new AC();
    comp = ctx.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 4; comp.connect(ctx.destination);
    master = ctx.createGain(); master.gain.value = on ? 0.9 : 0; master.connect(comp);
    sfxBus = ctx.createGain(); sfxBus.gain.value = 1; sfxBus.connect(master);
    bgmBus = ctx.createGain(); bgmBus.gain.value = 0.55; bgmBus.connect(master);
    // 小さな残響（BGMを部屋で鳴っているように）
    const conv = ctx.createConvolver(), len = ctx.sampleRate * 1.4, ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3); }
    conv.buffer = ir; const wet = ctx.createGain(); wet.gain.value = 0.22; bgmBus.connect(conv); conv.connect(wet); wet.connect(master);
    return true;
  }
  /* 波形を1音鳴らす */
  function tone(f, dur, o) {
    o = o || {}; if (!ensure()) return;
    const t = ctx.currentTime + (o.when || 0), osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = o.type || "sine"; osc.frequency.setValueAtTime(f, t); if (o.detune) osc.detune.value = o.detune;
    if (o.slide) osc.frequency.exponentialRampToValueAtTime(o.slide, t + dur);
    const a = o.attack || 0.008, vol = o.vol || 0.2;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = osc;
    if (o.lp) { const f2 = ctx.createBiquadFilter(); f2.type = "lowpass"; f2.frequency.value = o.lp; f2.Q.value = o.q || 0.7; osc.connect(f2); node = f2; }
    node.connect(g); g.connect(o.bus || sfxBus); osc.start(t); osc.stop(t + dur + 0.05);
  }
  let noiseBuf = null;
  function noise(dur, o) {
    o = o || {}; if (!ensure()) return;
    if (!noiseBuf) { noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
    const t = ctx.currentTime + (o.when || 0), src = ctx.createBufferSource(); src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = o.ftype || "bandpass"; f.frequency.value = o.f || 1200; f.Q.value = o.q || 0.8;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(o.vol || 0.2, t + (o.attack || 0.005)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(o.bus || sfxBus); src.start(t, Math.random()); src.stop(t + dur + 0.05);
  }

  const SFX = {
    tap: () => tone(1046, 0.07, { type: "triangle", vol: 0.12 }),
    open: () => { tone(660, 0.09, { type: "triangle", vol: 0.14 }); tone(990, 0.12, { type: "triangle", vol: 0.12, when: 0.06 }); },
    paper: () => { noise(0.16, { f: 3200, q: 0.5, vol: 0.3 }); noise(0.14, { f: 2000, q: 0.5, vol: 0.22, when: 0.1 }); noise(0.1, { f: 4200, q: 0.6, vol: 0.15, when: 0.2 }); },
    item: () => { [784, 988, 1175, 1568, 2093].forEach((f, i) => tone(f, 0.35, { vol: 0.16, when: i * 0.07 })); },
    lock: () => { noise(0.05, { f: 2500, q: 3, vol: 0.4 }); noise(0.05, { f: 1800, q: 3, vol: 0.35, when: 0.1 }); tone(140, 0.12, { type: "square", vol: 0.06, lp: 600, when: 0.02 }); },
    click: () => noise(0.025, { f: 4200, q: 4, vol: 0.4 }),
    unlock: () => { noise(0.04, { f: 3000, q: 3, vol: 0.4 }); noise(0.05, { f: 2000, q: 3, vol: 0.4, when: 0.15 }); tone(196, 0.5, { vol: 0.2, when: 0.25, slide: 98 }); tone(1568, 0.4, { type: "triangle", vol: 0.08, when: 0.3 }); },
    door: () => { noise(0.7, { f: 500, q: 2, vol: 0.12, attack: 0.1 }); tone(220, 0.6, { type: "sawtooth", vol: 0.025, lp: 900, slide: 160, when: 0.05 }); tone(1318, 0.5, { vol: 0.06, when: 0.02 }); tone(1760, 0.6, { vol: 0.05, when: 0.08 }); },
    car: () => { noise(2.4, { f: 160, q: 0.6, vol: 0.18, ftype: "lowpass", attack: 0.3 }); tone(48, 2.2, { type: "sawtooth", vol: 0.07, lp: 200, slide: 36 }); noise(0.15, { f: 2000, q: 1, vol: 0.12, when: 2.3 }); },
    wrong: () => { tone(330, 0.18, { type: "square", vol: 0.08, lp: 1500 }); tone(233, 0.4, { type: "square", vol: 0.08, lp: 1200, when: 0.16 }); },
    slam: () => { tone(80, 0.8, { vol: 0.7, slide: 30 }); noise(0.5, { f: 500, q: 0.4, vol: 0.5, ftype: "lowpass" }); noise(0.25, { f: 5000, q: 0.5, vol: 0.2 }); tone(1320, 0.6, { type: "triangle", vol: 0.1, when: 0.04 }); },
    win: () => { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.25, { type: "triangle", vol: 0.18, when: i * 0.1 })); [784, 1047, 1319].forEach(f => tone(f, 1.2, { type: "triangle", vol: 0.1, when: 0.45 })); noise(1.0, { f: 7000, q: 0.5, vol: 0.06, when: 0.45, attack: 0.02 }); },
    tick: () => tone(1800, 0.025, { type: "square", vol: 0.025, lp: 3000 }),
    bossTick: () => tone(420, 0.04, { type: "square", vol: 0.04, lp: 900 }),
    council: () => { [392, 523, 659, 784].forEach((f, i) => tone(f, 0.6, { vol: 0.13, when: i * 0.09 })); },
    shock: () => { tone(1200, 0.5, { type: "sawtooth", vol: 0.06, lp: 2500, slide: 300 }); noise(0.3, { f: 900, q: 1, vol: 0.2 }); },
    laugh: () => { [0, 0.16, 0.32].forEach((w, i) => tone(300 - i * 30, 0.12, { type: "sawtooth", vol: 0.05, lp: 1200, when: w, slide: 220 - i * 20 })); }
  };

  /* ---------- BGM ---------- */
  // calm：夜の喫茶店のジャズ　tense：対決の緊張感　finale：解決のあと
  const N = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const SONGS = {
    calm: { bpm: 84, bars: [
      { ch: [57, 60, 64, 67], bass: [45, 48, 52, 55] },    // Am7
      { ch: [55, 59, 62, 65], bass: [43, 47, 50, 53] },    // G7
      { ch: [53, 57, 60, 64], bass: [41, 45, 48, 52] },    // Fmaj7
      { ch: [52, 56, 59, 62], bass: [40, 44, 47, 50] }     // E7
    ] },
    tense: { bpm: 112, bars: [
      { ch: [45, 48, 52], bass: [33, 33, 33, 33] },
      { ch: [44, 48, 51], bass: [32, 32, 32, 32] },
      { ch: [45, 48, 52], bass: [33, 33, 33, 33] },
      { ch: [46, 50, 53], bass: [34, 34, 35, 35] }
    ] }
  };
  let song = null, nextBar = 0, barIdx = 0, sched = null;
  function scheduleBar(t0) {
    const s = SONGS[song], beat = 60 / s.bpm, bar = s.bars[barIdx % s.bars.length]; barIdx++;
    const rel = (t) => t - ctx.currentTime;
    if (song === "calm") {
      // エレピ風の和音（2拍目の裏と4拍目）
      [0.5, 2.5].forEach((b, k) => bar.ch.forEach((m, i) => { tone(N(m + 12), beat * (k ? 1.6 : 1.4), { vol: 0.045, when: rel(t0 + b * beat) + i * 0.012, lp: 2400, bus: bgmBus }); tone(N(m + 12), beat * 1.2, { vol: 0.015, type: "triangle", detune: 7, when: rel(t0 + b * beat), bus: bgmBus }); }));
      // ウォーキングベース
      bar.bass.forEach((m, i) => tone(N(m), beat * 0.9, { type: "triangle", vol: 0.16, lp: 700, when: rel(t0 + i * beat), bus: bgmBus }));
      // ブラシのハイハット（スウィング）
      for (let i = 0; i < 4; i++) { noise(0.08, { f: 8000, q: 0.6, vol: 0.035, ftype: "highpass", when: rel(t0 + i * beat), bus: bgmBus }); noise(0.05, { f: 8000, q: 0.6, vol: 0.022, ftype: "highpass", when: rel(t0 + (i + 0.66) * beat), bus: bgmBus }); }
      // ときどきメロディ
      if (barIdx % 2 === 0) [0, 1, 1.5, 3].forEach((b, i) => tone(N(bar.ch[(i + 1) % bar.ch.length] + 24), beat * 0.6, { vol: 0.03, type: "sine", when: rel(t0 + b * beat), bus: bgmBus }));
    } else if (song === "tense") {
      // 低い刻みと弦のような和音、時計の音
      for (let i = 0; i < 8; i++) tone(N(bar.bass[i >> 1]), beat * 0.4, { type: "sawtooth", vol: 0.07, lp: 500, when: rel(t0 + i * beat / 2), bus: bgmBus });
      bar.ch.forEach((m) => tone(N(m + 12), beat * 4, { type: "sawtooth", vol: 0.022, lp: 1400, attack: 0.4, when: rel(t0), bus: bgmBus }));
      for (let i = 0; i < 4; i++) noise(0.03, { f: 3500, q: 6, vol: 0.06, when: rel(t0 + i * beat), bus: bgmBus });
      tone(55, 0.5, { vol: 0.25, slide: 35, when: rel(t0), bus: bgmBus });
    }
    return t0 + 4 * beat;
  }
  function pump() { if (!ctx || !song) return; while (nextBar < ctx.currentTime + 0.6) nextBar = scheduleBar(nextBar); }
  function setBgm(m) {
    if (song === m) return; song = m; clearInterval(sched); barIdx = 0;
    if (!m || !ensure()) return; nextBar = ctx.currentTime + 0.1; pump(); sched = setInterval(pump, 200);
  }
  document.addEventListener("visibilitychange", () => { if (!ctx) return; if (document.hidden) ctx.suspend(); else if (on) ctx.resume(); });

  window.SOUND = {
    play(name) { if (!on) return; try { SFX[name] && SFX[name](); } catch (e) {} },
    bgm(m) { try { setBgm(m); } catch (e) {} },
    unlock() { try { ensure(); } catch (e) {} },
    get on() { return on; },
    toggle() {
      on = !on; try { localStorage.setItem("rinjo:sound", on ? "on" : "off"); } catch (e) {}
      if (ensure()) master.gain.setTargetAtTime(on ? 0.9 : 0, ctx.currentTime, 0.05);
      if (silentEl) { if (on) { const p = silentEl.play(); p && p.catch && p.catch(() => {}); } else silentEl.pause(); }
      return on;
    }
  };
})();
