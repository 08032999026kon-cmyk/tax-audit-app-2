/* 効果音とBGM（音のファイルは使わず、ブラウザーの中で合成する） */
(function () {
  "use strict";
  let ctx = null, master = null, bgm = null, on = true;
  try { on = localStorage.getItem("rinjo:sound") !== "off"; } catch (e) {}

  function ensure() {
    if (ctx) { if (ctx.state === "suspended") ctx.resume(); return true; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return false;
    ctx = new AC(); master = ctx.createGain(); master.gain.value = on ? 0.6 : 0; master.connect(ctx.destination); return true;
  }
  function tone(freq, dur, type, vol, when, slide) {
    if (!ensure()) return; const t = ctx.currentTime + (when || 0);
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type || "sine"; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol || 0.2, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.05);
  }
  function noise(dur, vol, filt, when, q) {
    if (!ensure()) return; const t = ctx.currentTime + (when || 0);
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur)), b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource(); src.buffer = b; const f = ctx.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = filt || 1200; f.Q.value = q || 0.8;
    const g = ctx.createGain(); g.gain.setValueAtTime(vol || 0.2, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(master); src.start(t);
  }

  const SFX = {
    tap: () => tone(880, 0.06, "triangle", 0.12),
    open: () => { tone(520, 0.08, "triangle", 0.12); tone(780, 0.1, "triangle", 0.1, 0.06); },
    paper: () => { noise(0.18, 0.25, 2600, 0, 0.6); noise(0.12, 0.18, 1800, 0.12, 0.6); },
    item: () => { [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.25, "sine", 0.16, i * 0.08)); },
    lock: () => { tone(160, 0.08, "square", 0.12); tone(140, 0.1, "square", 0.1, 0.09); },
    click: () => { noise(0.03, 0.3, 3500, 0, 2); },
    unlock: () => { noise(0.04, 0.3, 3000, 0, 2); noise(0.05, 0.3, 2200, 0.12, 2); tone(220, 0.3, "sine", 0.18, 0.2, 110); },
    door: () => { noise(0.5, 0.12, 400, 0, 1.5); tone(180, 0.4, "sawtooth", 0.03, 0.05, 140); },
    car: () => { noise(2.2, 0.08, 180, 0, 0.7); tone(55, 2.0, "sawtooth", 0.05, 0, 40); },
    wrong: () => { tone(330, 0.18, "square", 0.08); tone(247, 0.3, "square", 0.08, 0.16); },
    slam: () => { tone(90, 0.6, "sine", 0.5, 0, 40); noise(0.4, 0.4, 600, 0, 0.5); tone(1320, 0.5, "triangle", 0.12, 0.05); },
    win: () => { [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, i > 3 ? 0.5 : 0.18, "triangle", 0.16, i * 0.11)); },
    tick: () => tone(1400, 0.03, "square", 0.05),
    council: () => { [392, 523, 659].forEach((f, i) => tone(f, 0.5, "sine", 0.12, i * 0.12)); }
  };

  /* BGM：静かなジャズ風のコードをゆっくり鳴らす。mode で雰囲気を変える */
  const MODES = {
    calm: { chords: [[220, 277, 330, 415], [196, 247, 294, 370], [175, 220, 262, 330], [196, 247, 294, 349]], vol: 0.035, beat: 2.4 },
    tense: { chords: [[110, 131, 165, 208], [104, 123, 156, 196], [110, 131, 165, 220], [98, 117, 147, 185]], vol: 0.05, beat: 1.2 }
  };
  let mode = null, timer = null, step = 0;
  function playBar() {
    if (!ctx || !mode) return; const m = MODES[mode]; const ch = m.chords[step % m.chords.length]; step++;
    ch.forEach((f, i) => tone(f, m.beat * 1.1, "sine", m.vol, i * 0.03));
    if (mode === "tense") { tone(ch[0] / 2, 0.25, "triangle", 0.08); tone(ch[0] / 2, 0.25, "triangle", 0.06, m.beat / 2); }
    else { tone(ch[3] * 2, 0.3, "triangle", 0.02, m.beat * 0.5); }
  }
  function setBgm(m) {
    if (mode === m) return; mode = m; clearInterval(timer); step = 0;
    if (!m) return; if (!ensure()) return; playBar(); timer = setInterval(playBar, MODES[m].beat * 1000);
  }

  window.SOUND = {
    play(name) { if (!on) return; try { SFX[name] && SFX[name](); } catch (e) {} },
    bgm(m) { try { setBgm(m); } catch (e) {} },
    unlock() { ensure(); },
    get on() { return on; },
    toggle() {
      on = !on; try { localStorage.setItem("rinjo:sound", on ? "on" : "off"); } catch (e) {}
      if (ensure()) master.gain.setTargetAtTime(on ? 0.6 : 0, ctx.currentTime, 0.05);
      return on;
    }
  };
})();
