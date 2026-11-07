/* ゲームの進行：タイトル → 到着 → 調べる → 相談タイム → 対決 → 結果 */
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const C = window.CASE, SND = window.SOUND;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const SAVE_KEY = "rinjo:v1";

  if (!window.THREE || !window.WORLD) { $("loading").textContent = "3Dの読み込みに失敗しました。再読み込みしてください。"; return; }
  const W = window.WORLD, V = W.V;

  /* ---------- 状態 ---------- */
  const S = {
    role: "leader", phase: "title", room: "shop", busy: false,
    got: new Set(), seen: new Set(), solved: new Set(), visited: new Set(), unlocked: new Set(),
    hints: 0, tries: 0, t0: 0, done: false
  };
  function save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        role: S.role, room: S.room, got: [...S.got], seen: [...S.seen], solved: [...S.solved], visited: [...S.visited],
        unlocked: [...S.unlocked], hints: S.hints, tries: S.tries, t0: S.t0, done: S.done
      }));
    } catch (e) {}
  }
  function load() { try { return JSON.parse(localStorage.getItem(SAVE_KEY) || "null"); } catch (e) { return null; } }
  function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch (e) {} }

  const ROOMS = {
    shop: { name: "店内", pos: V(0.2, 1.65, 3.2), look: V(-0.6, 1.2, -3) },
    office: { name: "事務室", pos: V(1.7, 1.6, -4.6), look: V(1.7, 1.0, -8) }
  };
  const BOSS_VIEW = { pos: V(-1.3, 1.62, -1.45), look: V(-1.45, 1.72, -3.2) };
  const NAMES = { boss: "社長　白洲 守（しらす まもる）", mori: "森 先輩（調査官）", you: "あなた（代表）", narr: "" };
  const ICONS = { receipt: "🧾", register: "🖨", order: "📝", calendar: "📅", menu: "📋", key: "🔑", pc: "💻", photo: "🖼", stock: "📦", envelope: "✉", blank: "📄" };

  /* ---------- 画面の部品 ---------- */
  function soundLabel() { return SND.on ? "音 ON" : "音 OFF"; }
  function refreshSound() { $("b-sound").textContent = soundLabel(); $("t-sound").textContent = soundLabel(); }
  [$("b-sound"), $("t-sound")].forEach((b) => b.addEventListener("click", () => { SND.toggle(); refreshSound(); SND.play("tap"); }));
  refreshSound();

  let toastTimer = null;
  function toast(msg) { const t = $("toast"); t.textContent = msg; t.hidden = false; t.style.animation = "none"; void t.offsetWidth; t.style.animation = ""; clearTimeout(toastTimer); toastTimer = setTimeout(() => (t.hidden = true), 2600); }

  function fade(on) { $("fade").classList.toggle("on", on); return wait(on ? 460 : 300); }

  /* 台詞 */
  let talkDone = null, typing = null;
  function talk(who, text, expr) {
    return new Promise((res) => {
      if (W.fast) { res(); return; }
      if (who === "boss" && expr) W.people.boss.setFace(expr);
      if (who === "mori") W.people.mori.setFace(expr || "normal");
      const box = $("talk-box"); box.classList.toggle("no-face", who === "narr");
      if (who !== "narr") { const pc = W.portrait(who === "you" ? "you" : who, expr || (who === "boss" ? "normal" : "smile")); const g = $("talk-face").getContext("2d"); g.clearRect(0, 0, 160, 160); g.drawImage(pc, 0, 0); }
      $("talk-who").textContent = who === "you" ? (S.role === "leader" ? "あなた（代表）" : "代表") : NAMES[who];
      $("talk").hidden = false; box.style.animation = "none"; void box.offsetWidth; box.style.animation = "";
      const el = $("talk-say"); const plain = text.replace(/<[^>]+>/g, ""); let i = 0; el.textContent = "";
      clearInterval(typing);
      if (who === "boss") W.react("boss", "talk");
      typing = setInterval(() => { i++; el.textContent = plain.slice(0, i); if (i % 3 === 0) SND.play("tick"); if (i >= plain.length) { clearInterval(typing); typing = null; el.innerHTML = text; } }, 30);
      talkDone = () => {
        if (typing) { clearInterval(typing); typing = null; el.innerHTML = text; return; }
        talkDone = null; $("talk").hidden = true; res();
      };
    });
  }
  $("talk-box").addEventListener("click", () => { talkDone && talkDone(); });
  addEventListener("keydown", (e) => { if ((e.key === "Enter" || e.key === " ") && talkDone && !$("talk").hidden) { e.preventDefault(); talkDone(); } });
  async function lines(list) { for (const l of list) await talk(l[0], l[1], l[2]); }

  /* HUD */
  function renderHud() {
    $("role-label").textContent = S.role === "leader" ? "代表" : "メンバー";
    $("place-label").textContent = ROOMS[S.room].name;
    $("book-count").textContent = S.got.size;
    $("claims").innerHTML = C.claims.map((c) => `<div class="claim-chip ${S.solved.has(c.id) ? "solved" : ""}" data-id="${c.id}"><i></i><span>${c.label}<br><small>${S.solved.has(c.id) ? "立証" : "主張"}</small></span></div>`).join("");
    const mv = $("b-move");
    if (S.room === "office") { mv.hidden = false; mv.textContent = "← 店内へ"; }
    else if (S.visited.has("office")) { mv.hidden = false; mv.textContent = "事務室へ →"; }
    else mv.hidden = true;
  }
  function bumpBadge() { const b = $("book-count"); b.classList.remove("pop"); void b.offsetWidth; b.classList.add("pop"); }

  function setPhase(p) {
    S.phase = p;
    const exploring = p === "explore";
    $("hud").hidden = !(p === "explore");
    W.showMarkers(S.room, exploring);
    if (exploring) renderHud();
  }

  /* ---------- 見回す・タップ ---------- */
  const stage = $("stage");
  let drag = null, vel = 0, velP = 0, coachShown = false;
  stage.addEventListener("pointerdown", (e) => {
    if (S.phase !== "explore" || S.busy) return;
    drag = { x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, moved: 0, t: performance.now() }; vel = velP = 0;
    try { stage.setPointerCapture(e.pointerId); } catch (er) {}
  });
  stage.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.lx, dy = e.clientY - drag.ly; drag.lx = e.clientX; drag.ly = e.clientY;
    drag.moved = Math.max(drag.moved, Math.hypot(e.clientX - drag.x, e.clientY - drag.y));
    const k = 0.0055 * (W.camera.fov / 70);
    W.cam.yaw += dx * k; W.cam.pitch = Math.max(-0.95, Math.min(0.75, W.cam.pitch + dy * k * 0.8));
    vel = dx * k; velP = dy * k * 0.8;
    if (drag.moved > 20) hideCoach();
  });
  function endDrag(e) {
    if (!drag) return; const d = drag; drag = null;
    if (d.moved < 10 && performance.now() - d.t < 600) { vel = velP = 0; onTap(e.clientX, e.clientY); }
  }
  stage.addEventListener("pointerup", endDrag);
  stage.addEventListener("pointercancel", () => { drag = null; });
  W.onFrame.push(() => {
    if (drag || S.phase !== "explore" || S.busy) { if (!drag) vel = velP = 0; return; }
    if (Math.abs(vel) > 0.0001 || Math.abs(velP) > 0.0001) { W.cam.yaw += vel; W.cam.pitch = Math.max(-0.95, Math.min(0.75, W.cam.pitch + velP)); vel *= 0.9; velP *= 0.9; }
  });
  function showCoach() { if (coachShown) return; coachShown = true; $("coach").hidden = false; setTimeout(hideCoach, 7000); }
  function hideCoach() { $("coach").hidden = true; }

  function onTap(x, y) {
    if (S.phase !== "explore" || S.busy) return;
    const hit = W.pick(x, y); if (!hit) return;
    hideCoach();
    if (hit.door === "toOffice") goRoom("office");
    else if (hit.door === "toShop") goRoom("shop");
    else if (hit.spot) inspect(hit.spot);
  }

  /* ---------- 部屋の移動 ---------- */
  async function goRoom(room) {
    if (S.busy) return; S.busy = true; SND.play("door");
    const first = room === "office" && !S.visited.has("office");
    W.showMarkers(S.room, false);
    if (room === "office") { await W.flyTo(V(3.1, 1.6, -2.6), V(3.1, 1.4, -6), 600); await W.swingOffice(true); }
    await fade(true);
    S.room = room; S.visited.add(room);
    W.place(ROOMS[room].pos, ROOMS[room].look);
    if (room === "shop") W.doors.office.rotation.y = 0;
    await fade(false);
    S.busy = false; save();
    if (first) {
      setPhase("talk");
      await lines([["mori", "ここが事務室か。お金の管理は、たぶんこの部屋でしているはずだ。", "think"], ["mori", "パソコン、金庫、机……。気になる物を調べてみよう。", "smile"]]);
    }
    setPhase("explore");
  }
  $("b-move").addEventListener("click", () => { SND.play("tap"); goRoom(S.room === "office" ? "shop" : "office"); });

  /* ---------- 調べる ---------- */
  const COMMENTS = {
    order: [["mori", "夜7時半からの貸切パーティーで<b>85,000円</b>……。でもレジは夜7時前に締められていた。", "think"], ["mori", "<b>レジを通していない売上</b>かもしれない。相談タイムで「売上」の主張にぶつけてみよう。", "smile"]],
    register: [["mori", "レジは<b>18:58</b>に締めてある。夜の売上は記録されていないね。", "think"]],
    key: [["mori", "鉢の土に鍵が隠してあった……。どこかの<b>鍵のかかった引き出し</b>に使えそうだ。", "think"]],
    ledger: [["mori", "付箋に「金庫の番号＝お店の誕生日」。お店が開いた日が分かる物はないかな？", "think"]],
    photo: [["mori", "開店は<b>10月15日</b>。金庫の番号はこれかもしれない。", "smile"]],
    envelope: [["mori", "銀行に入れていない<b>85,000円</b>が金庫に……！ 注文票の金額と同じだ。", "shock"], ["mori", "「現金は全部銀行に入れている」という主張と食い違うね。", "think"]],
    stock: [["mori", "10月もいつもと同じ3袋。30万円も豆を買ったなら、もっと届いているはずだよね。", "think"]],
    blank: [["mori", "仕入れ先のハンコが押された<b>白紙の領収書</b>……。これがあれば、好きな金額を書けてしまう。", "shock"], ["mori", "社長が見せた30万円の領収書は、自分で書いたものかもしれない。", "think"]]
  };

  async function inspect(id) {
    if (S.busy) return; S.busy = true; hideCoach();
    const sp = C.spots[id], ws = W.spots[id]; const back = W.snapshot();
    W.showMarkers(S.room, false); $("hud").hidden = true; SND.play("tap");
    await W.flyTo(ws.camPos, ws.focus, 850);

    // 鍵のかかった引き出し
    if (sp.lock === "key" && !S.unlocked.has(id)) {
      if (!S.got.has("key")) {
        SND.play("lock"); await W.jiggleDrawer(); W.setMarker(id, "lock");
        await talk("mori", "引き出しに<b>鍵がかかっている</b>。どこかに鍵がないか探してみよう。", "think");
        await W.restore(back, 700); S.busy = false; setPhase("explore"); return;
      }
      SND.play("unlock"); toast("小さな鍵で開けた！"); await W.openDrawer(); S.unlocked.add(id);
    }
    // 金庫のダイヤル
    if (sp.lock === "dial" && !S.unlocked.has(id)) {
      const ok = await askDial(sp.code);
      if (!ok) { W.setMarker(id, "lock"); await W.restore(back, 700); S.busy = false; setPhase("explore"); return; }
      SND.play("unlock"); await W.openSafe(); S.unlocked.add(id);
    }
    if (id === "register" && !S.seen.has(id)) { SND.play("click"); W.printTape(); }
    if (id === "plant" && !S.got.has("key")) { await W.revealKey(); SND.play("item"); }

    const ev = sp.gives; const isNew = !S.got.has(ev);
    await showEvidence(ev, isNew);
    S.seen.add(id); W.setMarker(id, "done");
    if (isNew) { S.got.add(ev); bumpBadge(); toast(`手帳に「${C.evidence[ev].name}」を追加`); if (id === "plant") W.keyMesh.visible = false; }
    save();
    if (isNew && COMMENTS[ev]) await lines(COMMENTS[ev]);
    await W.restore(back, 750);
    S.busy = false; setPhase("explore");
  }

  function showEvidence(ev, isNew, label) {
    return new Promise((res) => {
      if (W.fast) { res(); return; }
      const e = C.evidence[ev];
      $("paper").innerHTML = e.html.replace("</h2>", isNew ? '<span class="new">NEW</span></h2>' : "</h2>") +
        `<div class="paper-actions"><button class="btn" id="paper-close">${label || (isNew ? "手帳にしまう" : "閉じる")}</button></div>`;
      $("evidence").hidden = false; $("paper").scrollTop = 0; SND.play("paper");
      const btn = $("paper-close"); btn.focus({ preventScroll: true });
      btn.addEventListener("click", () => { SND.play("tap"); $("evidence").hidden = true; res(); }, { once: true });
    });
  }

  /* 金庫のダイヤル */
  function askDial(code) {
    return new Promise((res) => {
      const digits = [0, 0, 0, 0];
      $("wheels").innerHTML = digits.map((_, i) => `<div class="wheel"><button data-i="${i}" data-d="1" aria-label="${i + 1}けた目を増やす">▲</button><output id="dg${i}">0</output><button data-i="${i}" data-d="-1" aria-label="${i + 1}けた目を減らす">▼</button></div>`).join("");
      $("wheels").querySelectorAll("button").forEach((b) => b.addEventListener("click", () => {
        const i = +b.dataset.i; digits[i] = (digits[i] + +b.dataset.d + 10) % 10; $("dg" + i).textContent = digits[i]; SND.play("click");
        W.safeDial.rotation.y += +b.dataset.d * 0.6;
      }));
      $("dial").hidden = false;
      const done = (v) => { $("dial").hidden = true; $("dial-ok").onclick = $("dial-cancel").onclick = null; res(v); };
      $("dial-cancel").onclick = () => { SND.play("tap"); done(false); };
      $("dial-ok").onclick = () => {
        if (digits.join("") === code) { done(true); return; }
        SND.play("wrong"); const lb = $("lockbox"); lb.classList.remove("ng"); void lb.offsetWidth; lb.classList.add("ng");
        toast("開かない……。番号のヒントを探そう");
      };
    });
  }

  /* ---------- 手帳 ---------- */
  function openBook() {
    SND.play("open");
    const claims = C.claims.map((c) => `<div class="claimrow ${S.solved.has(c.id) ? "solved" : ""}"><span class="tag">${S.solved.has(c.id) ? "立証" : c.label}</span><div>「${c.text}」${S.solved.has(c.id) ? `<small>${c.solved}</small>` : ""}</div></div>`).join("");
    const evs = Object.keys(C.evidence).map((k) => S.got.has(k)
      ? `<button class="ev" data-ev="${k}"><span class="ic" aria-hidden="true">${ICONS[C.evidence[k].icon] || "・"}</span>${C.evidence[k].name}</button>`
      : `<div class="ev empty"><span class="ic" aria-hidden="true">？</span>まだ見つけていない</div>`).join("");
    $("book").innerHTML = `<h2>調査手帳</h2><h4>社長の主張（${S.solved.size}/${C.claims.length} 立証）</h4>${claims}<h4>見つけた証拠（${S.got.size}/${Object.keys(C.evidence).length}）</h4><div class="ev-grid">${evs}</div><button class="btn btn-ghost close" id="book-close">閉じる</button>`;
    $("notebook").hidden = false;
    $("book").querySelectorAll("[data-ev]").forEach((b) => b.addEventListener("click", async () => { $("notebook").hidden = true; await showEvidence(b.dataset.ev, false, "手帳に戻る"); openBook(); }));
    $("book-close").addEventListener("click", () => { SND.play("tap"); $("notebook").hidden = true; });
  }
  $("b-book").addEventListener("click", () => { if (!S.busy) openBook(); });

  /* ---------- ヒント ---------- */
  $("b-hint").addEventListener("click", async () => {
    if (S.busy || S.phase !== "explore") return; S.busy = true; S.hints++; save();
    const h = C.hints.find((x) => x.when(S)) || { text: "あとは相談タイムで、主張と証拠を組み合わせてみよう。" };
    setPhase("talk"); await talk("mori", h.text, "think"); S.busy = false; setPhase("explore");
  });

  /* ---------- 相談タイム ---------- */
  let cTimer = null, cLeft = 120, pickedClaim = null, pickedEv = null;
  function openCouncil() {
    if (S.busy) return; SND.play("council"); setPhase("council"); pickedClaim = null; pickedEv = null;
    cLeft = 120; clearInterval(cTimer);
    cTimer = setInterval(() => { cLeft = Math.max(0, cLeft - 1); const t = $("c-timer"); if (t) t.textContent = fmt(cLeft); if (!cLeft) clearInterval(cTimer); }, 1000);
    renderCouncil(); $("council").hidden = false;
  }
  const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  function closeCouncil() { clearInterval(cTimer); $("council").hidden = true; }
  function renderCouncil() {
    const leader = S.role === "leader";
    const timer = `<div class="council-timer"><b id="c-timer">${fmt(cLeft)}</b><span>相談の目安。周りの人と画面を見せ合って、話し合おう。</span></div>`;
    let body;
    if (!pickedClaim) {
      body = `<div class="eyebrow">相談タイム　1／2</div><h2>どの主張を崩す？</h2>${timer}
        <div class="claim-pick">${C.claims.map((c) => `<button class="cpick ${S.solved.has(c.id) ? "solved" : ""}" data-c="${c.id}" ${S.solved.has(c.id) ? "disabled" : ""}><span class="lab">${S.solved.has(c.id) ? "立証済み" : c.label}</span><span>「${c.text}」</span></button>`).join("")}</div>
        <div class="council-actions"><button class="btn btn-ghost" id="c-close">もう少し調べる</button></div>`;
    } else {
      const c = C.claims.find((x) => x.id === pickedClaim);
      const evs = Object.keys(C.evidence).filter((k) => S.got.has(k)).map((k) => `<button class="ev ${pickedEv === k ? "sel" : ""}" data-ev="${k}"><span class="ic" aria-hidden="true">${ICONS[C.evidence[k].icon] || "・"}</span>${C.evidence[k].name}</button>`).join("");
      body = `<div class="eyebrow">相談タイム　2／2</div><h2>どの証拠をぶつける？</h2>
        <div class="picked"><small>崩したい社長の主張</small>「${c.text}」</div>${timer}
        <p class="lead">この主張と<b>食い違う証拠</b>はどれ？ 証拠をもう一度見たいときは、手帳から開けます。</p>
        <div class="ev-grid">${evs}</div>
        ${leader ? "" : `<div class="member-note">社長に証拠を示せるのは<b>代表だけ</b>です。「この証拠がいいと思う」と、代表に伝えよう。</div>`}
        <div class="council-actions">
          ${leader ? `<button class="btn btn-red" id="c-go" ${pickedEv ? "" : "disabled"}>${pickedEv ? `「${C.evidence[pickedEv].name}」をぶつける` : "証拠を1つ選んでください"}</button>` : ""}
          <button class="btn btn-ghost" id="c-back">主張を選び直す</button>
        </div>`;
    }
    $("council-in").innerHTML = body;
    $("council-in").querySelectorAll("[data-c]").forEach((b) => b.addEventListener("click", () => { SND.play("tap"); pickedClaim = b.dataset.c; pickedEv = null; renderCouncil(); }));
    $("council-in").querySelectorAll("[data-ev]").forEach((b) => b.addEventListener("click", () => { SND.play("tap"); pickedEv = b.dataset.ev; renderCouncil(); }));
    const cl = $("c-close"); if (cl) cl.onclick = () => { SND.play("tap"); closeCouncil(); setPhase("explore"); };
    const bk = $("c-back"); if (bk) bk.onclick = () => { SND.play("tap"); pickedClaim = null; pickedEv = null; renderCouncil(); };
    const go = $("c-go"); if (go) go.onclick = () => { if (!pickedEv) return; closeCouncil(); confront(pickedClaim, pickedEv); };
  }
  $("b-council").addEventListener("click", () => {
    if (S.busy) return;
    if (S.got.size <= 1) { toast("まずは店の中を調べて、証拠を集めよう"); SND.play("wrong"); return; }
    openCouncil();
  });

  /* ---------- 対決 ---------- */
  async function confront(cid, ev) {
    S.busy = true; setPhase("confront"); SND.bgm("tense"); S.tries++;
    const c = C.claims.find((x) => x.id === cid), ok = ev === c.answer, boss = W.people.boss;
    const fromRoom = S.room;
    if (S.room !== "shop") { await fade(true); S.room = "shop"; W.doors.office.rotation.y = 0; W.place(BOSS_VIEW.pos, BOSS_VIEW.look); await fade(false); }
    else await W.flyTo(BOSS_VIEW.pos, BOSS_VIEW.look, 1000);
    W.react("boss", "reset"); boss.setFace("normal");
    await W.turnTo("boss", W.camera.position, 400);
    await talk("you", `社長。「${c.text.replace(/。$/, "")}」とおっしゃいましたね。`);
    await talk("you", `では、<b>これ</b>を見てください！`);
    const th = $("thrust"); th.innerHTML = `<small>証拠</small><strong>${C.evidence[ev].name}</strong>`; th.hidden = false;
    const sl = $("speedlines"); sl.classList.remove("on"); void sl.offsetWidth; sl.classList.add("on");
    SND.play("slam"); W.shake = 0.03;
    await wait(700);
    if (ok) {
      const f = $("flash"); f.style.transition = "none"; f.style.opacity = ".9"; requestAnimationFrame(() => { f.style.transition = "opacity .6s"; f.style.opacity = "0"; });
      W.react("boss", "shock");
      const bn = $("banner"); bn.innerHTML = `立証！<small>「${c.label}」の主張を崩した</small>`; bn.hidden = false; bn.classList.remove("show"); void bn.offsetWidth; bn.classList.add("show");
      SND.play("win");
      await wait(1500); bn.hidden = true; th.hidden = true;
      await talk("boss", c.win, "panic");
      S.solved.add(cid); save();
      renderHud(); const chip = document.querySelector(`.claim-chip[data-id="${cid}"]`); if (chip) chip.classList.add("just");
      if (S.solved.size >= C.claims.length) return finale();
      const left = C.claims.length - S.solved.size;
      await talk("mori", `やった！ 「${c.label}」の主張を崩したよ。残りの主張はあと<b>${left}つ</b>。続けて調べよう。`, "smile");
    } else {
      SND.play("wrong"); th.hidden = true;
      await W.react("boss", "smug");
      await talk("boss", (c.near && c.near[ev]) || c.wrong, "smug");
      const near = c.near && c.near[ev];
      await talk("mori", near ? "惜しい！ 方向は合っているよ。社長が言い逃れできない、<b>もっと決定的な証拠</b>がないか探そう。" : "その証拠では崩せないみたいだ。<b>間違えても減点はない</b>よ。主張と食い違う証拠を、もう一度考えよう。", "think");
    }
    W.react("boss", "reset"); boss.setFace("normal"); W.turnTo("boss", ROOMS.shop.pos, 400);
    SND.bgm("calm");
    await fade(true); S.room = fromRoom; W.place(ROOMS[fromRoom].pos, ROOMS[fromRoom].look); await fade(false);
    S.busy = false; setPhase("explore");
  }

  /* ---------- 結末 ---------- */
  async function finale() {
    S.done = true; save();
    await W.react("boss", "sad");
    await lines([
      ["boss", "……申し訳ありません。貸切パーティーの売上を隠して、買っていない豆の仕入れを経費にしていました。", "sad"],
      ["mori", "売上を隠したり、ありもしない経費を足したりすると、払う税金が少なくなる。それは、ほかの正直な人たちに不公平だよね。", "think"],
      ["mori", "みんな、見事な調査だったよ！", "smile"]
    ]);
    SND.bgm(null); SND.play("win");
    await W.flyTo(V(2.6, 2.3, 2.8), V(-1, 1.1, -3), 2400);
    showResult();
  }
  function showResult() {
    setPhase("end"); $("hud").hidden = true;
    const mins = Math.max(1, Math.round((Date.now() - S.t0) / 60000));
    $("result-in").innerHTML = `
      <div class="r-stamp">立証</div>
      <p class="r-lead">喫茶店「浜風珈琲」の調査が終わりました。社長の3つの主張は、どれも証拠で崩れました。</p>
      <div class="found">
        <div><small>売上除外<br>（うりあげじょがい）</small><strong>85,000円</strong><p>貸切パーティーの売上をレジに通さず、金庫に隠していた。</p></div>
        <div><small>架空経費<br>（かくうけいひ）</small><strong>300,000円</strong><p>白紙の領収書を使い、買っていない豆の仕入れをでっち上げた。</p></div>
      </div>
      <div class="why">お店のもうけ（<b>所得</b>）は「<b>売上 − 経費</b>」。売上を隠したり、経費を水増ししたりすると、もうけが小さく見えて、払う税金が少なくなります。税務調査は、それを確かめる仕事です。</div>
      <ul class="learn">
        <li><b>端緒</b><span>社長の説明と、レジが夜7時前に締められていたことが食い違った。これが<b>不審な点</b>（調査のきっかけ）。</span></li>
        <li><b>当たり</b><span>カレンダーの「貸切」やメニューから、夜の売上に<b>当たりをつけた</b>。</span></li>
        <li><b>立証</b><span>注文票・「別」の封筒・白紙の領収書を、<b>社長にぶつけて</b>ごまかしを明らかにした。</span></li>
      </ul>
      <div class="stats"><span>かかった時間 <b>${mins}分</b></span><span>ヒント <b>${S.hints}回</b></span><span>調べた場所 <b>${S.seen.size}/${Object.keys(C.spots).length}</b></span></div>
      <button class="btn btn-ghost" id="again">はじめから遊ぶ</button>
      <p class="stats" style="font-size:11px">このお話の会社・人物・資料はすべて架空です。</p>`;
    $("result").hidden = false;
    $("again").onclick = () => { clearSave(); location.reload(); };
  }

  /* ---------- オープニング ---------- */
  let skipping = false;
  $("skip").addEventListener("click", () => { skipping = true; W.fast = true; W.finishAll(); if (talkDone) { talkDone(); talkDone && talkDone(); } $("skip").hidden = true; });

  async function opening() {
    setPhase("intro"); $("skip").hidden = false; SND.bgm("calm");
    W.place(V(6, 1.5, 15), V(0, 1.6, 4));
    SND.play("car"); await W.driveIn();
    await talk("narr", "土曜日の夜。駅前の喫茶店「浜風珈琲」。");
    await talk("mori", "着いたね。今日はこのお店の<b>税務調査</b>だ。", "smile");
    await talk("mori", "税務調査は、お店が<b>税金を正しく計算しているか</b>を確かめる仕事だよ。", "normal");
    await W.flyTo(V(0, 1.6, 7.2), V(0, 1.5, 4), 1400);
    SND.play("door"); await W.openFront();
    await W.flyTo(ROOMS.shop.pos, V(-1.45, 1.7, -3.2), 1800);
    await W.turnTo("boss", ROOMS.shop.pos, 500);
    await talk("boss", "いらっしゃい。社長の白洲です。うちは小さな店ですが、きちんとやってますよ。", "smile");
    await talk("mori", "社長、まずはお店のお金のことを教えてください。", "normal");
    for (const c of C.claims) {
      await talk("boss", c.text, "smile");
    }
    await talk("boss", "ほら、これが30万円の仕入れの領収書です。", "smug");
    await showEvidence("receipt", true);
    S.got.add("receipt");
    await talk("mori", "お店のもうけ（<b>所得</b>）は「売上 − 経費」で決まる。もうけが大きいほど、税金も多くなるんだ。", "normal");
    await talk("mori", "だから、売上を隠したり（<b>売上除外</b>）、ありもしない経費を足したり（<b>架空経費</b>）するごまかしが起きる。", "think");
    await talk("mori", "社長の話に<b>不審な点</b>がないか、店の中を調べよう。<b>光っている印</b>をタップすると調べられるよ。", "smile");
    await talk("mori", S.role === "leader"
      ? "証拠がそろったら<b>相談タイム</b>。みんなで相談して、代表のあなたが社長にぶつけよう。"
      : "証拠がそろったら<b>相談タイム</b>。社長に示せるのは<b>代表だけ</b>だから、見つけた証拠を代表に伝えよう。", "smile");
    finishOpening();
  }
  function finishOpening() {
    if (S.phase === "explore") return;
    W.fast = false; skipping = false; $("skip").hidden = true; $("talk").hidden = true; talkDone = null;
    S.got.add("receipt");
    W.doors.frontL.position.x = -1.15; W.doors.frontR.position.x = 1.15; W.car.position.x = -1.5;
    W.people.boss.group.rotation.y = Math.atan2(ROOMS.shop.pos.x + 1.45, ROOMS.shop.pos.z + 3.2); W.people.boss.setFace("normal");
    S.room = "shop"; S.visited.add("shop"); W.place(ROOMS.shop.pos, ROOMS.shop.look);
    save(); setPhase("explore"); showCoach();
  }

  /* ---------- 開始 ---------- */
  function begin(role, resume) {
    SND.unlock(); SND.play("open");
    S.role = role; $("title").hidden = true;
    if (resume) {
      const d = resume;
      ["got", "seen", "solved", "visited", "unlocked"].forEach((k) => { S[k] = new Set(d[k] || []); });
      S.hints = d.hints || 0; S.tries = d.tries || 0; S.t0 = d.t0 || Date.now(); S.room = d.room || "shop";
      S.seen.forEach((id) => W.setMarker(id, "done"));
      if (S.unlocked.has("safe")) W.safeDoor.rotation.y = -1.7;
      if (S.unlocked.has("desk")) W.drawer.position.z = -6.8;
      W.doors.frontL.position.x = -1.15; W.doors.frontR.position.x = 1.15; W.car.position.x = -1.5;
      W.people.boss.group.rotation.y = Math.atan2(ROOMS.shop.pos.x + 1.45, ROOMS.shop.pos.z + 3.2);
      SND.bgm("calm"); W.place(ROOMS[S.room].pos, ROOMS[S.room].look); setPhase("explore");
      if (S.solved.size >= C.claims.length) showResult();
      return;
    }
    clearSave(); S.t0 = Date.now();
    opening().then(() => { if (skipping || W.fast) finishOpening(); });
  }
  $("as-leader").addEventListener("click", () => begin("leader"));
  $("as-member").addEventListener("click", () => begin("member"));
  $("resume").addEventListener("click", () => { const d = load(); if (d) begin(d.role || "leader", d); });

  /* ---------- 起動 ---------- */
  try { W.init($("stage")); } catch (e) { $("loading").textContent = "この端末では3Dを表示できませんでした。別のブラウザーで開いてください。"; return; }
  W.place(V(5, 1.5, 14), V(0, 1.6, 4)); W.showMarkers("shop", false);
  const saved = load(); if (saved && saved.t0 && !saved.done) $("resume").hidden = false;
  // タイトル中はカメラをゆっくり動かす
  W.onFrame.push((dt, now) => { if (S.phase !== "title") return; const x = 5 + Math.sin(now / 5000) * 1.6; W.place(V(x, 1.5, 14), V(0, 1.7, 4)); });
  $("loading").hidden = true; $("title").hidden = false;
  if (/debug/.test(location.hash)) window.__rinjo = { S, inspect, goRoom, confront, openCouncil, openBook, finishOpening, showResult };
  if (/[#&]member/.test(location.hash)) { $("as-member").classList.add("btn-main"); $("as-member").classList.remove("btn-ghost"); $("as-leader").classList.remove("btn-main"); $("as-leader").classList.add("btn-ghost"); }
})();
