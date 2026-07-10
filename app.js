/* ===========================================================
   Quack Pack — Classroom Toolkit
   Vanilla JS, no dependencies, no network. Everything below is
   organized as small modules that share a tiny helper layer.
   =========================================================== */
(function () {
  "use strict";

  /* -------------------- tiny helpers -------------------- */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const rand = (n) => Math.floor(Math.random() * n);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const store = {
    get(key, fallback) {
      try { const v = localStorage.getItem("qp_" + key); return v === null ? fallback : JSON.parse(v); }
      catch (e) { return fallback; }
    },
    set(key, val) { try { localStorage.setItem("qp_" + key, JSON.stringify(val)); } catch (e) {} },
  };

  /* -------------------- roster state -------------------- */
  const DEFAULT_NAMES = [
    "Ada", "Alan", "Grace", "Katherine", "Mae", "Carl", "Rosalind", "Isaac",
    "Marie", "Nikola", "Chien-Shiung", "George", "Barbara", "Percy", "Hedy", "Srinivasa",
  ];
  let roster = store.get("roster", []);

  /* -------------------- sound (Web Audio, self-contained) -------------------- */
  let audioCtx = null;
  let soundOn = store.get("sound", true);
  function ensureAudio() {
    if (!audioCtx) {
      try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
      catch (e) { audioCtx = null; }
    }
    if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
    return audioCtx;
  }
  // A synthesized "quack": a quick pitch-bent, wobbling sawtooth.
  function quack(pitch = 1) {
    if (!soundOn) return;
    const ctx = ensureAudio();
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 900 * pitch;
    filter.Q.value = 6;
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(320 * pitch, t);
    osc.frequency.exponentialRampToValueAtTime(600 * pitch, t + 0.06);
    osc.frequency.exponentialRampToValueAtTime(180 * pitch, t + 0.22);
    // vibrato-ish wobble
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 22; lfoGain.gain.value = 40;
    lfo.connect(lfoGain).connect(osc.frequency);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.35, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.26);
    osc.connect(filter).connect(gain).connect(ctx.destination);
    osc.start(t); lfo.start(t);
    osc.stop(t + 0.3); lfo.stop(t + 0.3);
  }
  function tick() {
    if (!soundOn) return;
    const ctx = ensureAudio();
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "triangle"; osc.frequency.value = 1400;
    g.gain.setValueAtTime(0.14, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    osc.connect(g).connect(ctx.destination);
    osc.start(t); osc.stop(t + 0.06);
  }
  function fanfare() {
    if (!soundOn) return;
    [1, 1.25, 1.5, 2].forEach((p, i) => setTimeout(() => quack(p), i * 130));
  }

  /* -------------------- toast -------------------- */
  let toastTimer = null;
  function toast(msg) {
    const el = $("#toast");
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 2200);
  }

  // Celebratory falling emoji — shared by the picker and the wheel.
  function rainDucks() {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const emojis = ["🦆", "⭐", "🎉", "💛"];
    for (let i = 0; i < 14; i++) {
      const d = document.createElement("div");
      d.className = "confetti-duck";
      d.textContent = emojis[rand(emojis.length)];
      d.style.left = rand(100) + "vw";
      d.style.animationDuration = 1.6 + Math.random() * 1.4 + "s";
      d.style.animationDelay = Math.random() * 0.3 + "s";
      document.body.appendChild(d);
      setTimeout(() => d.remove(), 3200);
    }
  }

  /* -------------------- routing -------------------- */
  const views = { home: "#view-home", picker: "#view-picker", wheel: "#view-wheel", teams: "#view-teams", timer: "#view-timer", stopwatch: "#view-stopwatch", traffic: "#view-traffic", dice: "#view-dice", noise: "#view-noise" };
  let current = "home";
  function go(tool) {
    if (!views[tool]) tool = "home";
    // leaving a view? let it clean up
    if (current !== tool && LEAVE[current]) LEAVE[current]();
    $$(".view").forEach((v) => { v.hidden = true; v.classList.remove("is-active"); });
    const el = $(views[tool]);
    el.hidden = false;
    el.classList.add("is-active");
    current = tool;
    if (location.hash !== "#" + tool) history.replaceState(null, "", tool === "home" ? "#" : "#" + tool);
    window.scrollTo(0, 0);
    if (ENTER[tool]) ENTER[tool]();
  }
  const ENTER = {};
  const LEAVE = {};

  /* ============================================================
     TOOL 1 — DUCK PICKER
     ============================================================ */
  const Picker = (() => {
    let pickedThisRound = [];
    const nameEl = () => $("#pickedName");

    function available() {
      const notPicked = roster.filter((n) => !pickedThisRound.includes(n));
      return $("#noRepeat").checked ? notPicked : roster.slice();
    }

    function pick() {
      if (!roster.length) { toast("Add students to your roster first 🦆"); openRoster(); return; }
      let pool = available();
      if (!pool.length) {
        toast("Everyone's had a turn! Starting a new round.");
        pickedThisRound = [];
        pool = roster.slice();
      }
      const winner = pool[rand(pool.length)];
      animateTo(winner);
    }

    function animateTo(winner) {
      const el = nameEl();
      el.classList.remove("win");
      el.classList.add("rolling");
      $("#pickBtn").disabled = true;
      let ticks = 0;
      const total = 16 + rand(6);
      const spin = () => {
        el.textContent = roster[rand(roster.length)];
        tick();
        ticks++;
        if (ticks < total) {
          setTimeout(spin, 40 + ticks * 12); // ease-out slowdown
        } else {
          el.textContent = winner;
          el.classList.remove("rolling");
          el.classList.add("win");
          $("#pickBtn").disabled = false;
          fanfare();
          rainDucks();
          if ($("#noRepeat").checked && !pickedThisRound.includes(winner)) pickedThisRound.push(winner);
          updateHint();
        }
      };
      spin();
    }

    function updateHint() {
      const h = $("#pickerHint");
      if (!roster.length) { h.textContent = ""; return; }
      if ($("#noRepeat").checked) {
        const left = roster.length - pickedThisRound.length;
        h.textContent = left === roster.length
          ? `${roster.length} ducks ready.`
          : `${left} of ${roster.length} still to be picked.`;
      } else {
        h.textContent = `${roster.length} ducks in the pond.`;
      }
    }

    function reset() {
      pickedThisRound = [];
      nameEl().textContent = "Tap “Pick” to choose";
      nameEl().classList.remove("win");
      updateHint();
      toast("Picks reset 🔄");
    }

    function init() {
      $("#pickBtn").addEventListener("click", pick);
      $("#resetPicker").addEventListener("click", reset);
      $("#noRepeat").addEventListener("change", () => { store.set("noRepeat", $("#noRepeat").checked); updateHint(); });
      $("#noRepeat").checked = store.get("noRepeat", true);
    }
    ENTER.picker = updateHint;
    return { init, updateHint };
  })();

  /* ============================================================
     TOOL 1b — SPINNER WHEEL
     ============================================================ */
  const Wheel = (() => {
    const PAL = ["#ffd23f", "#ff9f1c", "#ffbf69", "#8ae6dd", "#2ec4b6",
                 "#b8a6e6", "#ff7b8c", "#8ab6ff", "#06d6a0", "#f4a900"];
    let names = [];
    let rotation = -Math.PI / 2; // start with segment 0 under the pointer
    let spinning = false;
    let lastTickIdx = -1;
    const TAU = Math.PI * 2;

    function canvas() { return $("#wheelCanvas"); }

    function draw() {
      const c = canvas();
      if (!c) return;
      const ctx = c.getContext("2d");
      const size = c.width, R = size / 2, r = R - 6;
      ctx.clearRect(0, 0, size, size);
      const n = names.length;
      if (!n) {
        ctx.beginPath(); ctx.arc(R, R, r, 0, TAU);
        ctx.fillStyle = "#e9dcc0"; ctx.fill();
        ctx.fillStyle = "#8a7a5f"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.font = "600 26px system-ui, sans-serif";
        ctx.fillText("Add students", R, R - 16);
        ctx.fillText("to the roster", R, R + 16);
        return;
      }
      const seg = TAU / n;
      for (let i = 0; i < n; i++) {
        const a0 = rotation + i * seg;
        ctx.beginPath();
        ctx.moveTo(R, R);
        ctx.arc(R, R, r, a0, a0 + seg);
        ctx.closePath();
        ctx.fillStyle = PAL[i % PAL.length];
        ctx.fill();
        ctx.lineWidth = 2; ctx.strokeStyle = "rgba(255,255,255,.6)"; ctx.stroke();
        // label
        ctx.save();
        ctx.translate(R, R);
        ctx.rotate(a0 + seg / 2);
        ctx.textAlign = "right"; ctx.textBaseline = "middle";
        ctx.fillStyle = "#2b2118";
        const fs = clamp(Math.round(seg * 90), 12, 26);
        ctx.font = `800 ${fs}px "Baloo 2", system-ui, sans-serif`;
        let label = names[i];
        if (label.length > 13) label = label.slice(0, 12) + "…";
        ctx.fillText(label, r - 14, 0);
        ctx.restore();
      }
      // outer rim
      ctx.beginPath(); ctx.arc(R, R, r, 0, TAU);
      ctx.lineWidth = 6; ctx.strokeStyle = "rgba(0,0,0,.14)"; ctx.stroke();
    }

    // Which segment currently sits under the top pointer (screen angle -π/2)?
    function indexUnderPointer() {
      const n = names.length, seg = TAU / n;
      let a = (-Math.PI / 2 - rotation) % TAU;
      if (a < 0) a += TAU;
      return Math.floor(a / seg) % n;
    }

    function spin() {
      if (spinning) return;
      if (!names.length) { toast("Add students to your roster first 🦆"); openRoster(); return; }
      spinning = true;
      $("#wheelSpin").disabled = true;
      $("#wheelResult").classList.remove("win");
      $("#wheelResult").textContent = "…";
      ensureAudio();
      const n = names.length, seg = TAU / n;
      const winner = rand(n);
      const turns = 5 + rand(3);
      // rotation that puts winner's center under the pointer, plus full spins
      const target = -Math.PI / 2 - (winner * seg + seg / 2) - TAU * turns;
      const start = rotation;
      const dur = 4200;
      const t0 = performance.now();
      lastTickIdx = indexUnderPointer();
      const frame = (now) => {
        const t = clamp((now - t0) / dur, 0, 1);
        const e = 1 - Math.pow(1 - t, 3); // ease-out cubic
        rotation = start + (target - start) * e;
        draw();
        const idx = indexUnderPointer();
        if (idx !== lastTickIdx) { lastTickIdx = idx; if (t < 0.98) tick(); }
        if (t < 1) requestAnimationFrame(frame);
        else finish(winner);
      };
      requestAnimationFrame(frame);
    }

    function finish(winner) {
      rotation = ((rotation % TAU) + TAU) % TAU; // normalize to keep numbers small
      spinning = false;
      $("#wheelSpin").disabled = false;
      const name = names[winner];
      const res = $("#wheelResult");
      res.textContent = "🎉 " + name + "!";
      void res.offsetWidth; res.classList.add("win");
      fanfare(); rainDucks();
      if ($("#wheelRemove").checked && names.length > 1) {
        names.splice(winner, 1);
        rotation = -Math.PI / 2;
        setTimeout(draw, 900);
      }
    }

    function rebuild() {
      names = roster.slice();
      rotation = -Math.PI / 2;
      $("#wheelResult").textContent = "Give it a spin!";
      $("#wheelResult").classList.remove("win");
      draw();
    }

    function init() {
      $("#wheelSpin").addEventListener("click", spin);
      $("#wheelReset").addEventListener("click", () => { if (!spinning) { rebuild(); toast("Wheel reset 🔄"); } });
    }
    ENTER.wheel = () => { if (!spinning) rebuild(); };
    return { init };
  })();

  /* ============================================================
     TOOL 2 — TEAM MAKER
     ============================================================ */
  const Teams = (() => {
    let mode = "teams"; // or "size"
    let num = store.get("teamNum", 4);

    function shuffle(arr) {
      const a = arr.slice();
      for (let i = a.length - 1; i > 0; i--) { const j = rand(i + 1); [a[i], a[j]] = [a[j], a[i]]; }
      return a;
    }

    function render() {
      $("#teamNum").textContent = num;
      $("#teamLabel").textContent = mode === "teams" ? (num === 1 ? "team" : "teams") : "per team";
    }

    function make() {
      if (roster.length < 2) { toast("Add at least 2 students 🦆"); openRoster(); return; }
      const people = shuffle(roster);
      let groups = [];
      if (mode === "teams") {
        const t = clamp(num, 1, people.length);
        groups = Array.from({ length: t }, () => []);
        people.forEach((p, i) => groups[i % t].push(p));
      } else {
        const size = clamp(num, 1, people.length);
        for (let i = 0; i < people.length; i += size) groups.push(people.slice(i, i + size));
      }
      const palette = ["#ff9f1c", "#2ec4b6", "#e71d36", "#8367c7", "#3a86ff", "#f4a900", "#06d6a0", "#ef476f"];
      const names = ["Mallards", "Teals", "Wigeons", "Pintails", "Goldeneyes", "Mergansers", "Shovelers", "Gadwalls",
                     "Eiders", "Scaups", "Buffleheads", "Canvasbacks"];
      const out = $("#teamsOut");
      out.innerHTML = "";
      groups.forEach((g, i) => {
        const card = document.createElement("div");
        card.className = "team";
        card.style.animationDelay = i * 60 + "ms";
        const c = palette[i % palette.length];
        card.innerHTML =
          `<div class="team-head" style="background:${c}">${names[i % names.length]} <small>(${g.length})</small></div>` +
          `<ul>${g.map((n) => `<li>${escapeHtml(n)}</li>`).join("")}</ul>`;
        out.appendChild(card);
      });
      quack();
      toast(`Made ${groups.length} teams 🪺`);
    }

    function init() {
      render();
      $("#makeTeams").addEventListener("click", make);
      $("#teamPlus").addEventListener("click", () => { num = clamp(num + 1, 1, 30); store.set("teamNum", num); render(); });
      $("#teamMinus").addEventListener("click", () => { num = clamp(num - 1, 1, 30); store.set("teamNum", num); render(); });
      $("#byTeams").addEventListener("click", () => setMode("teams"));
      $("#bySize").addEventListener("click", () => setMode("size"));
    }
    function setMode(m) {
      mode = m;
      $("#byTeams").classList.toggle("is-on", m === "teams");
      $("#bySize").classList.toggle("is-on", m === "size");
      render();
    }
    return { init };
  })();

  /* ============================================================
     TOOL 3 — TIMER
     ============================================================ */
  const Timer = (() => {
    const CIRC = 2 * Math.PI * 54; // matches r=54 in svg
    let total = 300, remaining = 300;
    let running = false, endAt = 0, raf = 0;
    let lastWholeSecond = -1, ringingTimeout = 0;

    function fmt(s) {
      s = Math.max(0, Math.ceil(s));
      const m = Math.floor(s / 60);
      const sec = s % 60;
      return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
    }

    function draw() {
      $("#timerDisplay").textContent = fmt(remaining);
      const frac = total > 0 ? clamp(remaining / total, 0, 1) : 0;
      const ring = $("#ringFg");
      ring.style.strokeDashoffset = String(CIRC * (1 - frac));
      ring.classList.toggle("warn", remaining <= 10 && remaining > 0 && running);
    }

    function loop() {
      remaining = (endAt - performance.now()) / 1000;
      const whole = Math.ceil(remaining);
      if (whole !== lastWholeSecond) {
        lastWholeSecond = whole;
        if (whole <= 5 && whole > 0) tick();
      }
      draw();
      if (remaining <= 0) { finish(); return; }
      raf = requestAnimationFrame(loop);
    }

    function finish() {
      running = false;
      remaining = 0;
      draw();
      cancelAnimationFrame(raf);
      $("#timerToggle").textContent = "▶ Start";
      $("#timerSub").textContent = "Time's up!";
      $(".timer-stage").classList.add("ringing");
      fanfare();
      setTimeout(fanfare, 700);
      clearTimeout(ringingTimeout);
      ringingTimeout = setTimeout(() => $(".timer-stage").classList.remove("ringing"), 4000);
    }

    function start() {
      if (remaining <= 0) remaining = total;
      endAt = performance.now() + remaining * 1000;
      running = true;
      lastWholeSecond = -1;
      $(".timer-stage").classList.remove("ringing");
      $("#timerToggle").textContent = "⏸ Pause";
      $("#timerSub").textContent = "Counting down…";
      ensureAudio();
      raf = requestAnimationFrame(loop);
    }
    function pause() {
      running = false;
      cancelAnimationFrame(raf);
      $("#timerToggle").textContent = "▶ Resume";
      $("#timerSub").textContent = "Paused";
    }
    function toggle() { running ? pause() : start(); }

    function setTotal(sec, { silent } = {}) {
      total = clamp(Math.round(sec), 0, 5999);
      remaining = total;
      running = false;
      cancelAnimationFrame(raf);
      $(".timer-stage").classList.remove("ringing");
      $("#timerToggle").textContent = "▶ Start";
      $("#timerSub").textContent = "Ready";
      draw();
      highlightPreset();
      if (!silent) store.set("timerTotal", total);
    }
    function adjust(delta) {
      const base = running ? remaining : total;
      setTotal(clamp(base + delta, 0, 5999));
    }
    function highlightPreset() {
      $$(".presets .chip[data-sec]").forEach((c) =>
        c.classList.toggle("is-on", Number(c.dataset.sec) === total));
    }

    function reset() { setTotal(total); toast("Timer reset"); }

    function init() {
      total = remaining = store.get("timerTotal", 300);
      draw(); highlightPreset();
      $("#timerToggle").addEventListener("click", toggle);
      $("#timerReset").addEventListener("click", reset);
      $("#tPlus").addEventListener("click", () => adjust(60));
      $("#tMinus").addEventListener("click", () => adjust(-60));
      $$(".presets .chip[data-sec]").forEach((c) =>
        c.addEventListener("click", () => setTotal(Number(c.dataset.sec))));
    }
    // stop counting/ringing when navigating away
    LEAVE.timer = () => {
      cancelAnimationFrame(raf); running = false;
      $(".timer-stage").classList.remove("ringing");
      $("#timerToggle").textContent = remaining < total && remaining > 0 ? "▶ Resume" : "▶ Start";
    };
    return { init };
  })();

  /* ============================================================
     TOOL 3b — STOPWATCH
     ============================================================ */
  const Stopwatch = (() => {
    const CIRC = 2 * Math.PI * 54;
    let running = false, startAt = 0, elapsed = 0, raf = 0;
    let laps = [], lapCount = 0;

    function fmt(ms) {
      const total = Math.floor(ms / 100); // tenths
      const tenths = total % 10;
      const s = Math.floor(total / 10);
      const m = Math.floor(s / 60);
      const sec = s % 60;
      return { main: `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`, t: tenths };
    }

    function draw() {
      const ms = running ? elapsed + (performance.now() - startAt) : elapsed;
      const f = fmt(ms);
      $("#swDisplay").innerHTML = `${f.main}<small>.${f.t}</small>`;
      const frac = (ms % 60000) / 60000; // fills once per minute
      $("#swRing").style.strokeDashoffset = String(CIRC * (1 - frac));
      if (running) raf = requestAnimationFrame(draw);
    }

    function start() {
      running = true;
      startAt = performance.now();
      $("#swToggle").textContent = "⏸ Stop";
      $("#swSub").textContent = "Running…";
      ensureAudio();
      raf = requestAnimationFrame(draw);
    }
    function stop() {
      running = false;
      elapsed += performance.now() - startAt;
      cancelAnimationFrame(raf);
      $("#swToggle").textContent = "▶ Resume";
      $("#swSub").textContent = "Stopped";
      draw();
    }
    function toggle() { running ? stop() : start(); }

    function reset() {
      running = false; cancelAnimationFrame(raf);
      elapsed = 0; laps = []; lapCount = 0;
      $("#swLaps").innerHTML = "";
      $("#swToggle").textContent = "▶ Start";
      $("#swSub").textContent = "Ready";
      draw();
    }

    function lap() {
      if (!running && elapsed === 0) return;
      const ms = running ? elapsed + (performance.now() - startAt) : elapsed;
      const prev = laps.length ? laps[laps.length - 1] : 0;
      laps.push(ms);
      lapCount++;
      const split = fmt(ms - prev), total = fmt(ms);
      const li = document.createElement("li");
      li.innerHTML = `<span class="lap-n">Lap ${lapCount}</span>` +
        `<span class="lap-split">+${split.main}.${split.t}</span>` +
        `<span>${total.main}.${total.t}</span>`;
      const list = $("#swLaps");
      list.insertBefore(li, list.firstChild);
      tick();
    }

    function init() {
      $("#swToggle").addEventListener("click", toggle);
      $("#swReset").addEventListener("click", reset);
      $("#swLap").addEventListener("click", lap);
      draw();
    }
    LEAVE.stopwatch = () => { if (running) stop(); };
    return { init };
  })();

  /* ============================================================
     TOOL 3c — TRAFFIC LIGHT
     ============================================================ */
  const Traffic = (() => {
    const LABELS = {
      red: "🔴 Silent, please",
      amber: "🟡 Whisper voices",
      green: "🟢 Talk &amp; work",
    };
    const COLORS = { red: "#e71d36", amber: "#f4a900", green: "#38b000" };

    function set(state, opts) {
      $$(".lamp").forEach((l) => l.classList.toggle("on", l.dataset.state === state));
      const label = $("#trafficLabel");
      if (state && LABELS[state]) {
        label.innerHTML = LABELS[state];
        label.style.color = COLORS[state];
      } else {
        label.textContent = "Tap a light";
        label.style.color = "";
      }
      store.set("traffic", state || "");
      if (state && !(opts && opts.silent)) quack(state === "green" ? 1.4 : state === "amber" ? 1 : 0.7);
    }

    function init() {
      $$(".lamp").forEach((l) => l.addEventListener("click", () => set(l.dataset.state)));
    }
    ENTER.traffic = () => set(store.get("traffic", "") || null, { silent: true });
    return { init };
  })();

  /* ============================================================
     TOOL 4 — DICE & NUMBERS
     ============================================================ */
  const Dice = (() => {
    let count = 1;
    const PIP_MAP = {
      1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8],
      5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8],
    };

    function dieHtml(val) {
      let cells = "";
      const pips = PIP_MAP[val];
      for (let i = 0; i < 9; i++) cells += pips.includes(i) ? '<span class="pip"></span>' : "<span></span>";
      return `<div class="die" role="img" aria-label="Rolled a ${val}">${cells}</div>`;
    }

    function roll() {
      const stage = $("#diceStage");
      const vals = Array.from({ length: count }, () => 1 + rand(6));
      stage.innerHTML = vals.map(dieHtml).join("");
      const total = vals.reduce((a, b) => a + b, 0);
      $("#diceTotal").textContent = count > 1 ? `Total: ${total}` : "";
      quack(1 + (total % 4) * 0.15);
    }

    function setCount(n) {
      count = n;
      $$(".dice-count").forEach((c) => c.classList.toggle("is-on", Number(c.dataset.n) === n));
      roll();
    }

    function generate() {
      let lo = parseInt($("#numMin").value, 10);
      let hi = parseInt($("#numMax").value, 10);
      if (isNaN(lo)) lo = 1;
      if (isNaN(hi)) hi = 100;
      if (lo > hi) { [lo, hi] = [hi, lo]; }
      const out = $("#numberOut");
      out.classList.remove("pulse");
      let ticks = 0; const total = 12 + rand(6);
      const spin = () => {
        out.textContent = lo + rand(hi - lo + 1);
        tick(); ticks++;
        if (ticks < total) setTimeout(spin, 40 + ticks * 14);
        else { void out.offsetWidth; out.classList.add("pulse"); fanfare(); }
      };
      spin();
    }

    function flip() {
      const coin = $("#coin"), face = $("#coinFace");
      const heads = Math.random() < 0.5;
      coin.classList.remove("flipping");
      void coin.offsetWidth;
      coin.classList.add("flipping");
      $("#coinOut").textContent = "…";
      setTimeout(() => {
        face.textContent = heads ? "🦆" : "⭐";
        $("#coinOut").textContent = heads ? "Heads! 🦆" : "Tails! ⭐";
        quack(heads ? 1 : 1.4);
      }, 950);
    }

    function setMode(m) {
      $$('[data-dmode]').forEach((b) => b.classList.toggle("is-on", b.dataset.dmode === m));
      $("#diceMode").hidden = m !== "dice";
      $("#numberMode").hidden = m !== "number";
      $("#coinMode").hidden = m !== "coin";
    }

    function init() {
      $("#rollBtn").addEventListener("click", roll);
      $("#genNumber").addEventListener("click", generate);
      $("#flipCoin").addEventListener("click", flip);
      $$(".dice-count").forEach((c) => c.addEventListener("click", () => setCount(Number(c.dataset.n))));
      $$('[data-dmode]').forEach((b) => b.addEventListener("click", () => setMode(b.dataset.dmode)));
      roll(); // seed one die
    }
    return { init };
  })();

  /* ============================================================
     TOOL 5 — NOISE METER
     ============================================================ */
  const Noise = (() => {
    let ctx = null, analyser = null, stream = null, data = null, raf = 0, running = false;
    let alarmCooldown = 0;

    async function startMic() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false } });
      } catch (e) {
        $("#noiseLabel").textContent = "Microphone blocked — check browser permissions.";
        toast("Couldn't access the mic 🎙️");
        return false;
      }
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      const src = ctx.createMediaStreamSource(stream);
      analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.82;
      src.connect(analyser);
      data = new Uint8Array(analyser.fftSize);
      running = true;
      loop();
      return true;
    }

    function loop() {
      analyser.getByteTimeDomainData(data);
      // RMS -> rough 0..100 loudness
      let sum = 0;
      for (let i = 0; i < data.length; i++) { const v = (data[i] - 128) / 128; sum += v * v; }
      const rms = Math.sqrt(sum / data.length);
      const level = clamp(Math.round(rms * 320), 0, 100);
      render(level);
      raf = requestAnimationFrame(loop);
    }

    function render(level) {
      const bar = $("#noiseBar");
      bar.style.width = level + "%";
      const thresh = Number($("#noiseThresh").value);
      const duck = $("#noiseDuck");
      const stage = $(".noise-stage");
      const scale = 1 + (level / 100) * 0.25;
      duck.style.transform = `scale(${scale.toFixed(3)})`;
      let face, label;
      if (level < thresh * 0.5) { face = "😌"; label = "Lovely and calm"; }
      else if (level < thresh * 0.8) { face = "🙂"; label = "Nice working buzz"; }
      else if (level < thresh) { face = "😐"; label = "Getting louder…"; }
      else { face = "😫"; label = "Too loud!"; }
      duck.textContent = face;
      $("#noiseLabel").textContent = label;
      const loud = level >= thresh;
      stage.classList.toggle("loud", loud);
      if (loud && performance.now() > alarmCooldown) {
        alarmCooldown = performance.now() + 2500;
        quack(0.7);
      }
    }

    function stop() {
      running = false;
      cancelAnimationFrame(raf);
      if (stream) stream.getTracks().forEach((t) => t.stop());
      if (ctx) ctx.close();
      ctx = stream = analyser = null;
      $("#noiseBar").style.width = "0%";
      $("#noiseDuck").textContent = "😴";
      $("#noiseDuck").style.transform = "scale(1)";
      $(".noise-stage").classList.remove("loud");
      $("#noiseLabel").textContent = "Tap start to listen";
      $("#noiseToggle").textContent = "🎙️ Start listening";
    }

    async function toggle() {
      if (running) { stop(); return; }
      $("#noiseToggle").textContent = "…starting";
      const ok = await startMic();
      $("#noiseToggle").textContent = ok ? "⏹ Stop" : "🎙️ Start listening";
    }

    function init() { $("#noiseToggle").addEventListener("click", toggle); }
    LEAVE.noise = () => { if (running) stop(); };
    return { init };
  })();

  /* ============================================================
     ROSTER MODAL
     ============================================================ */
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  function parseRoster(text) {
    return text.split(/\r?\n/).map((s) => s.trim()).filter(Boolean).slice(0, 200);
  }
  function updateRosterCounts() {
    const n = roster.length;
    $("#rosterModalCount").textContent = n;
    $("#rosterCount").textContent = n ? `${n} student${n === 1 ? "" : "s"} · tap to edit` : "Add your students →";
    Picker.updateHint();
  }
  let lastFocus = null;
  function openRoster() {
    lastFocus = document.activeElement;
    $("#rosterText").value = roster.join("\n");
    $("#rosterModalCount").textContent = roster.length;
    $("#rosterModal").hidden = false;
    setTimeout(() => $("#rosterText").focus(), 50);
  }
  function closeRoster() {
    $("#rosterModal").hidden = true;
    if (lastFocus) lastFocus.focus();
  }
  function saveRoster() {
    roster = parseRoster($("#rosterText").value);
    store.set("roster", roster);
    updateRosterCounts();
    closeRoster();
    toast(roster.length ? `Saved ${roster.length} students ✅` : "Roster cleared");
  }

  /* ---- roster: share / backup / restore ---- */
  // Unicode-safe base64 so names with accents survive the round trip.
  function encodeRoster(names) {
    return btoa(unescape(encodeURIComponent(JSON.stringify(names))));
  }
  function decodeRoster(str) {
    try {
      const arr = JSON.parse(decodeURIComponent(escape(atob(str))));
      return Array.isArray(arr) ? arr.map(String) : null;
    } catch (e) { return null; }
  }
  function shareLink() {
    const base = location.origin === "null" || !location.origin
      ? location.href.split("#")[0]
      : location.origin + location.pathname;
    return base + "#roster=" + encodeRoster(parseRoster($("#rosterText").value));
  }
  async function copyShareLink() {
    const link = shareLink();
    try {
      await navigator.clipboard.writeText(link);
      toast("Share link copied 🔗");
    } catch (e) {
      // fallback: drop it into the textarea selection for manual copy
      const ta = $("#rosterText");
      ta.value += (ta.value ? "\n" : "") + link;
      toast("Copy the link at the bottom of the list");
    }
  }
  function downloadRoster() {
    const names = parseRoster($("#rosterText").value);
    if (!names.length) { toast("Nothing to back up yet"); return; }
    const blob = new Blob([names.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "class-roster.txt";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast("Roster saved as a file ⬇️");
  }
  function importFromFile(file) {
    const reader = new FileReader();
    reader.onload = () => {
      const names = parseRoster(String(reader.result));
      if (!names.length) { toast("That file had no names"); return; }
      $("#rosterText").value = names.join("\n");
      $("#rosterModalCount").textContent = names.length;
      toast(`Loaded ${names.length} names — tap Save to keep`);
    };
    reader.readAsText(file);
  }
  // If the app was opened from a share link, load those names into the editor.
  function maybeImportFromHash() {
    const m = /^#roster=(.+)$/.exec(location.hash);
    if (!m) return false;
    const names = decodeRoster(m[1]);
    history.replaceState(null, "", location.pathname); // clean the URL
    if (!names || !names.length) return false;
    openRoster();
    $("#rosterText").value = names.join("\n");
    $("#rosterModalCount").textContent = names.length;
    toast(`Shared roster loaded — tap Save to keep`);
    return true;
  }

  /* ============================================================
     GLOBAL CHROME — theme, sound, nav
     ============================================================ */
  function applyTheme(mode) {
    document.documentElement.setAttribute("data-theme", mode);
    $("#themeIcon").textContent = mode === "dark" ? "☀️" : "🌙";
    document.querySelector('meta[name="theme-color"]').setAttribute("content", mode === "dark" ? "#1a1712" : "#ffd23f");
    store.set("theme", mode);
  }
  function applySound() {
    $("#soundIcon").textContent = soundOn ? "🔊" : "🔇";
    $("#soundBtn").setAttribute("aria-pressed", String(soundOn));
  }

  function init() {
    // restore prefs
    const savedTheme = store.get("theme", window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    applyTheme(savedTheme);
    applySound();

    // wire up tools
    Picker.init(); Wheel.init(); Teams.init(); Timer.init(); Stopwatch.init(); Traffic.init(); Dice.init(); Noise.init();

    // navigation
    $$(".tool-card[data-tool]").forEach((c) => c.addEventListener("click", () => go(c.dataset.tool)));
    $$("[data-back]").forEach((b) => b.addEventListener("click", () => go("home")));
    $("#homeBtn").addEventListener("click", () => go("home"));
    $("#rosterCard").addEventListener("click", openRoster);
    $("#rosterBtn").addEventListener("click", openRoster);

    // roster modal
    $("#closeRoster").addEventListener("click", closeRoster);
    $("#saveRoster").addEventListener("click", saveRoster);
    $("#sampleRoster").addEventListener("click", () => { $("#rosterText").value = DEFAULT_NAMES.join("\n"); $("#rosterModalCount").textContent = DEFAULT_NAMES.length; });
    $("#rosterModal").addEventListener("click", (e) => { if (e.target === $("#rosterModal")) closeRoster(); });
    $("#rosterText").addEventListener("input", () => { $("#rosterModalCount").textContent = parseRoster($("#rosterText").value).length; });

    // roster share / backup / restore
    $("#copyLink").addEventListener("click", copyShareLink);
    $("#downloadRoster").addEventListener("click", downloadRoster);
    $("#importRoster").addEventListener("click", () => $("#importFile").click());
    $("#importFile").addEventListener("change", (e) => { if (e.target.files[0]) importFromFile(e.target.files[0]); e.target.value = ""; });

    // theme + sound
    $("#themeBtn").addEventListener("click", () =>
      applyTheme(document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark"));
    $("#soundBtn").addEventListener("click", () => { soundOn = !soundOn; store.set("sound", soundOn); applySound(); if (soundOn) { ensureAudio(); quack(); } });

    // keyboard: Esc closes modal
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !$("#rosterModal").hidden) closeRoster();
    });

    // browser back/forward
    window.addEventListener("hashchange", () => go((location.hash || "#home").slice(1) || "home"));

    // first-run: seed a friendly sample roster so tools work immediately
    if (!store.get("seeded", false) && roster.length === 0) {
      roster = DEFAULT_NAMES.slice();
      store.set("roster", roster);
      store.set("seeded", true);
    }
    updateRosterCounts();

    // If launched from a share link, load those names first, then land on home.
    if (maybeImportFromHash()) {
      go("home");
    } else {
      // open the view named in the URL (deep links / refresh)
      go((location.hash || "#home").slice(1) || "home");
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
