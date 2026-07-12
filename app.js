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

  /* -------------------- per-tool settings (persisted to browser cache) --------------------
     Each tool owns a small bag of options under settings[tool]. Tools read the
     current value at the point of use, so changes made in a tool's settings blade
     take effect immediately and survive a page reload. */
  const Settings = {
    all: store.get("settings", {}),
    // Current value for tool.key, or `fallback` if the user hasn't set it.
    value(tool, key, fallback) {
      const t = this.all[tool];
      return t && Object.prototype.hasOwnProperty.call(t, key) ? t[key] : fallback;
    },
    set(tool, key, val) {
      (this.all[tool] || (this.all[tool] = {}))[key] = val;
      store.set("settings", this.all);
    },
  };

  /* -------------------- inline SVG icons (design system) -------------------- */
  const svg = (inner, sw = 1.8) =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
  const ICONS = {
    play: svg('<path d="M7 4.5v15l12-7.5z" fill="currentColor" stroke="none"/>'),
    pause: svg('<rect x="6" y="5" width="4" height="14" rx="1.2" fill="currentColor" stroke="none"/><rect x="14" y="5" width="4" height="14" rx="1.2" fill="currentColor" stroke="none"/>'),
    mic: svg('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>'),
    stop: svg('<rect x="6" y="6" width="12" height="12" rx="2.5" fill="currentColor" stroke="none"/>'),
    sun: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4 12H2M22 12h-2M5 5l1.4 1.4M17.6 17.6 19 19M19 5l-1.4 1.4M6.4 17.6 5 19"/>'),
    moon: svg('<path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z"/>'),
    soundOn: svg('<path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 6a9 9 0 0 1 0 12"/>'),
    soundOff: svg('<path d="M11 5 6 9H2v6h4l5 4z"/><path d="M22 9l-6 6M16 9l6 6"/>'),
    duck: svg('<path d="M15.5 7.5a3 3 0 1 0-4.9 2.35"/><path d="M10.6 9.85C7.5 10.6 5.5 12.7 5.5 15.2c0 .9.7 1.6 1.6 1.6h5.4a5 5 0 0 0 5-5c0-1.2-.9-2.2-2-2.4"/><path d="M15.5 7.5 19 6l-1.3 3"/>'),
    star: svg('<path d="M12 3l2.6 6.3 6.8.5-5.2 4.4 1.6 6.6L12 17.8 6.2 21.3l1.6-6.6L2.6 9.8l6.8-.5z"/>'),
    gear: svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 13a7.6 7.6 0 0 0 0-2l2-1.5-2-3.4-2.3 1a7.6 7.6 0 0 0-1.7-1l-.3-2.5H9.9l-.3 2.5a7.6 7.6 0 0 0-1.7 1l-2.3-1-2 3.4L5.6 11a7.6 7.6 0 0 0 0 2l-2 1.5 2 3.4 2.3-1a7.6 7.6 0 0 0 1.7 1l.3 2.5h4.2l.3-2.5a7.6 7.6 0 0 0 1.7-1l2.3 1 2-3.4-2-1.5z"/>'),
  };
  const face = (mouth) => svg('<circle cx="12" cy="12" r="9"/><path d="M9 10h.01M15 10h.01" stroke-width="2.6"/>' + mouth);
  const FACES = {
    calm: face('<path d="M8.5 14a4 4 0 0 0 7 0"/>'),
    ok: face('<path d="M9 14.5c1 .7 5 .7 6 0"/>'),
    mid: face('<path d="M9 14.5h6"/>'),
    loud: face('<path d="M8.5 15.5a4 4 0 0 1 7 0"/>'),
    idle: svg('<circle cx="12" cy="12" r="9"/><path d="M8.5 10.5 10 10M14 10 15.5 10.5"/><path d="M9 14.5h6"/>'),
  };

  // Resolve a CSS custom property to a concrete color (for canvas drawing).
  function cssColor(varName) {
    const probe = document.createElement("span");
    probe.style.cssText = "position:absolute;visibility:hidden;color:var(" + varName + ")";
    document.body.appendChild(probe);
    const c = getComputedStyle(probe).color;
    probe.remove();
    return c || "#888";
  }

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

  // Celebratory falling confetti — shared by the picker and the wheel.
  const CONFETTI_COLORS = ["#0d9488", "#0ea5e9", "#7c3aed", "#22c55e", "#f59e0b", "#ef4444"];
  function rainDucks() {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    for (let i = 0; i < 16; i++) {
      const d = document.createElement("div");
      d.className = "confetti";
      d.style.background = CONFETTI_COLORS[rand(CONFETTI_COLORS.length)];
      d.style.left = rand(100) + "vw";
      d.style.borderRadius = Math.random() < 0.5 ? "2px" : "50%";
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
  // Called when a tool's settings change while its view is on screen, so the
  // tool can re-render live. Populated by each tool module below.
  const REFRESH = {};

  /* ============================================================
     TOOL 1 — DUCK PICKER
     ============================================================ */
  const Picker = (() => {
    let pickedThisRound = [];
    const nameEl = () => $("#pickedName");

    // The picker keeps its own student list; when it's empty we fall back to
    // the shared class roster so the tool still works out of the box.
    function pool() {
      const own = Settings.value("picker", "names", []);
      return (own && own.length) ? own.slice() : roster.slice();
    }

    function available() {
      const source = pool();
      const notPicked = source.filter((n) => !pickedThisRound.includes(n));
      return $("#noRepeat").checked ? notPicked : source;
    }

    function pick() {
      if (!pool().length) { toast("Add students to pick from first"); Blade.open("picker"); return; }
      let choices = available();
      if (!choices.length) {
        toast("Everyone's had a turn! Starting a new round.");
        pickedThisRound = [];
        choices = pool();
      }
      const winner = choices[rand(choices.length)];
      animateTo(winner);
    }

    function animateTo(winner) {
      const el = nameEl();
      el.classList.remove("win");
      el.classList.add("rolling");
      $("#pickBtn").disabled = true;
      const names = pool();
      let ticks = 0;
      const total = 16 + rand(6);
      const spin = () => {
        el.textContent = names[rand(names.length)];
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
          if (Settings.value("picker", "confetti", true)) rainDucks();
          if ($("#noRepeat").checked && !pickedThisRound.includes(winner)) pickedThisRound.push(winner);
          updateHint();
        }
      };
      spin();
    }

    function updateHint() {
      const h = $("#pickerHint");
      const total = pool().length;
      if (!total) { h.textContent = ""; return; }
      if ($("#noRepeat").checked) {
        const left = total - pickedThisRound.filter((n) => pool().includes(n)).length;
        h.textContent = left === total
          ? `${total} ducks ready.`
          : `${left} of ${total} still to be picked.`;
      } else {
        h.textContent = `${total} ducks in the pond.`;
      }
    }

    function reset() {
      pickedThisRound = [];
      nameEl().textContent = "Tap “Pick” to choose";
      nameEl().classList.remove("win");
      updateHint();
      toast("Picks reset");
    }

    function init() {
      $("#pickBtn").addEventListener("click", pick);
      $("#resetPicker").addEventListener("click", reset);
      $("#noRepeat").addEventListener("change", () => { store.set("noRepeat", $("#noRepeat").checked); updateHint(); });
      $("#noRepeat").checked = store.get("noRepeat", true);
    }
    ENTER.picker = updateHint;
    REFRESH.picker = () => { pickedThisRound = pickedThisRound.filter((n) => pool().includes(n)); updateHint(); };
    return { init, updateHint };
  })();

  /* ============================================================
     TOOL 1b — SPINNER WHEEL
     ============================================================ */
  const Wheel = (() => {
    const PAL = ["#5eead4", "#7dd3fc", "#c4b5fd", "#86efac", "#fde68a",
                 "#fca5a5", "#99f6e4", "#a5b4fc", "#67e8f9", "#d8b4fe"];
    const LABEL_COLOR = "#1f2430"; // fixed dark text reads on all pastel segments
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
        ctx.fillStyle = cssColor("--surface-2"); ctx.fill();
        ctx.strokeStyle = cssColor("--border"); ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = cssColor("--text-3"); ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.font = '600 26px "Plus Jakarta Sans", system-ui, sans-serif';
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
        ctx.fillStyle = LABEL_COLOR;
        const fs = clamp(Math.round(seg * 90), 12, 26);
        ctx.font = `700 ${fs}px "Plus Jakarta Sans", system-ui, sans-serif`;
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

    // The wheel keeps its own name list, falling back to the class roster.
    function source() {
      const own = Settings.value("wheel", "names", []);
      return (own && own.length) ? own.slice() : roster.slice();
    }

    function spin() {
      if (spinning) return;
      if (!names.length) { toast("Add students to the wheel first"); Blade.open("wheel"); return; }
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
      res.textContent = name;
      void res.offsetWidth; res.classList.add("win");
      fanfare();
      if (Settings.value("wheel", "confetti", true)) rainDucks();
      if ($("#wheelRemove").checked && names.length > 1) {
        names.splice(winner, 1);
        rotation = -Math.PI / 2;
        setTimeout(draw, 900);
      }
    }

    function rebuild() {
      names = source();
      rotation = -Math.PI / 2;
      $("#wheelResult").textContent = "Give it a spin!";
      $("#wheelResult").classList.remove("win");
      draw();
    }

    function init() {
      $("#wheelSpin").addEventListener("click", spin);
      $("#wheelReset").addEventListener("click", () => { if (!spinning) { rebuild(); toast("Wheel reset"); } });
      // redraw once the web font loads so segment labels use Plus Jakarta Sans
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (current === "wheel") draw(); });
    }
    ENTER.wheel = () => { if (!spinning) rebuild(); };
    REFRESH.wheel = () => { if (!spinning) rebuild(); };
    return { init };
  })();

  /* ============================================================
     TOOL 2 — TEAM MAKER
     ============================================================ */
  const Teams = (() => {
    let mode = "teams"; // or "size"
    let num = store.get("teamNum", 4);

    const THEME_NAMES = {
      ducks: ["Mallards", "Teals", "Wigeons", "Pintails", "Goldeneyes", "Mergansers", "Shovelers", "Gadwalls",
              "Eiders", "Scaups", "Buffleheads", "Canvasbacks"],
      colours: ["Red", "Blue", "Green", "Yellow", "Purple", "Orange", "Teal", "Pink",
                "Indigo", "Lime", "Amber", "Cyan"],
    };
    function teamName(theme, i) {
      if (theme === "numbers") return "Team " + (i + 1);
      const list = THEME_NAMES[theme] || THEME_NAMES.ducks;
      return list[i % list.length];
    }

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
      if (roster.length < 2) { toast("Add at least 2 students"); openRoster(); return; }
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
      const palette = ["#0d9488", "#0ea5e9", "#7c3aed", "#22c55e", "#f59e0b", "#ef4444", "#14b8a6", "#6366f1"];
      const theme = Settings.value("teams", "theme", "ducks");
      const showCount = Settings.value("teams", "counts", true);
      const out = $("#teamsOut");
      out.innerHTML = "";
      groups.forEach((g, i) => {
        const card = document.createElement("div");
        card.className = "team";
        card.style.animationDelay = i * 60 + "ms";
        const c = palette[i % palette.length];
        const size = showCount ? ` <small>(${g.length})</small>` : "";
        card.innerHTML =
          `<div class="team-head" style="background:${c}">${escapeHtml(teamName(theme, i))}${size}</div>` +
          `<ul>${g.map((n) => `<li>${escapeHtml(n)}</li>`).join("")}</ul>`;
        out.appendChild(card);
      });
      quack();
      toast(`Made ${groups.length} teams`);
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
        if (whole <= 5 && whole > 0 && Settings.value("timer", "ticks", true)) tick();
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
      $("#timerToggle").innerHTML = ICONS.play + "Start";
      $("#timerSub").textContent = "Time's up!";
      $(".timer-stage").classList.add("ringing");
      if (Settings.value("timer", "chime", true)) {
        fanfare();
        setTimeout(fanfare, 700);
      }
      clearTimeout(ringingTimeout);
      ringingTimeout = setTimeout(() => $(".timer-stage").classList.remove("ringing"), 4000);
    }

    function start() {
      if (remaining <= 0) remaining = total;
      endAt = performance.now() + remaining * 1000;
      running = true;
      lastWholeSecond = -1;
      $(".timer-stage").classList.remove("ringing");
      $("#timerToggle").innerHTML = ICONS.pause + "Pause";
      $("#timerSub").textContent = "Counting down…";
      ensureAudio();
      raf = requestAnimationFrame(loop);
    }
    function pause() {
      running = false;
      cancelAnimationFrame(raf);
      $("#timerToggle").innerHTML = ICONS.play + "Resume";
      $("#timerSub").textContent = "Paused";
    }
    function toggle() { running ? pause() : start(); }

    function setTotal(sec, { silent } = {}) {
      total = clamp(Math.round(sec), 0, 5999);
      remaining = total;
      running = false;
      cancelAnimationFrame(raf);
      $(".timer-stage").classList.remove("ringing");
      $("#timerToggle").innerHTML = ICONS.play + "Start";
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
      $("#timerToggle").innerHTML = ICONS.play + "Start";
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
      $("#timerToggle").innerHTML = ICONS.play + (remaining < total && remaining > 0 ? "Resume" : "Start");
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
      $("#swDisplay").innerHTML = Settings.value("stopwatch", "tenths", true)
        ? `${f.main}<small>.${f.t}</small>`
        : f.main;
      const frac = (ms % 60000) / 60000; // fills once per minute
      $("#swRing").style.strokeDashoffset = String(CIRC * (1 - frac));
      if (running) raf = requestAnimationFrame(draw);
    }

    function start() {
      running = true;
      startAt = performance.now();
      $("#swToggle").innerHTML = ICONS.pause + "Stop";
      $("#swSub").textContent = "Running…";
      ensureAudio();
      raf = requestAnimationFrame(draw);
    }
    function stop() {
      running = false;
      elapsed += performance.now() - startAt;
      cancelAnimationFrame(raf);
      $("#swToggle").innerHTML = ICONS.play + "Resume";
      $("#swSub").textContent = "Stopped";
      draw();
    }
    function toggle() { running ? stop() : start(); }

    function reset() {
      running = false; cancelAnimationFrame(raf);
      elapsed = 0; laps = []; lapCount = 0;
      $("#swLaps").innerHTML = "";
      $("#swToggle").innerHTML = ICONS.play + "Start";
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
      if (Settings.value("stopwatch", "lapSound", true)) tick();
    }

    function init() {
      $("#swToggle").innerHTML = ICONS.play + "Start";
      $("#swToggle").addEventListener("click", toggle);
      $("#swReset").addEventListener("click", reset);
      $("#swLap").addEventListener("click", lap);
      draw();
    }
    LEAVE.stopwatch = () => { if (running) stop(); };
    REFRESH.stopwatch = () => draw();
    return { init };
  })();

  /* ============================================================
     TOOL 3c — TRAFFIC LIGHT
     ============================================================ */
  const Traffic = (() => {
    const DEFAULT_LABELS = {
      red: "Silent, please",
      amber: "Whisper voices",
      green: "Talk & work",
    };
    const COLORS = { red: "var(--danger)", amber: "var(--warning)", green: "var(--success)" };
    function labelFor(state) {
      return Settings.value("traffic", state + "Label", DEFAULT_LABELS[state]) || DEFAULT_LABELS[state];
    }

    function set(state, opts) {
      $$(".lamp").forEach((l) => l.classList.toggle("on", l.dataset.state === state));
      const label = $("#trafficLabel");
      if (state && COLORS[state]) {
        label.textContent = labelFor(state);
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
    REFRESH.traffic = () => set(store.get("traffic", "") || null, { silent: true });
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
        face.innerHTML = heads ? ICONS.duck : ICONS.star;
        $("#coinOut").textContent = heads ? "Heads!" : "Tails!";
        quack(heads ? 1 : 1.4);
      }, 950);
    }

    function setMode(m) {
      $$('[data-dmode]').forEach((b) => b.classList.toggle("is-on", b.dataset.dmode === m));
      $("#diceMode").hidden = m !== "dice";
      $("#numberMode").hidden = m !== "number";
      $("#coinMode").hidden = m !== "coin";
    }

    // Apply the saved defaults to the UI (used at startup and when settings change).
    function syncDefaults() {
      count = clamp(Settings.value("dice", "count", 1), 1, 4);
      $$(".dice-count").forEach((c) => c.classList.toggle("is-on", Number(c.dataset.n) === count));
      $("#numMin").value = Settings.value("dice", "numMin", 1);
      $("#numMax").value = Settings.value("dice", "numMax", 100);
    }

    function init() {
      $("#rollBtn").addEventListener("click", roll);
      $("#genNumber").addEventListener("click", generate);
      $("#flipCoin").addEventListener("click", flip);
      $$(".dice-count").forEach((c) => c.addEventListener("click", () => setCount(Number(c.dataset.n))));
      $$('[data-dmode]').forEach((b) => b.addEventListener("click", () => setMode(b.dataset.dmode)));
      $("#coinFace").innerHTML = ICONS.duck; // seed coin face
      syncDefaults();
      roll(); // seed with the default number of dice
    }
    REFRESH.dice = syncDefaults;
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
        toast("Couldn't access the mic");
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
      let face, label, color;
      if (level < thresh * 0.5) { face = FACES.calm; label = "Lovely and calm"; color = "var(--success)"; }
      else if (level < thresh * 0.8) { face = FACES.ok; label = "Nice working buzz"; color = "var(--success)"; }
      else if (level < thresh) { face = FACES.mid; label = "Getting louder…"; color = "var(--warning)"; }
      else { face = FACES.loud; label = "Too loud!"; color = "var(--danger)"; }
      duck.innerHTML = face;
      duck.style.color = color;
      $("#noiseLabel").textContent = label;
      const loud = level >= thresh;
      stage.classList.toggle("loud", loud);
      if (loud && performance.now() > alarmCooldown) {
        alarmCooldown = performance.now() + 2500;
        if (Settings.value("noise", "alarm", true)) quack(0.7);
      }
    }

    function stop() {
      running = false;
      cancelAnimationFrame(raf);
      if (stream) stream.getTracks().forEach((t) => t.stop());
      if (ctx) ctx.close();
      ctx = stream = analyser = null;
      $("#noiseBar").style.width = "0%";
      $("#noiseDuck").innerHTML = FACES.idle;
      $("#noiseDuck").style.color = "";
      $("#noiseDuck").style.transform = "scale(1)";
      $(".noise-stage").classList.remove("loud");
      $("#noiseLabel").textContent = "Tap start to listen";
      $("#noiseToggle").innerHTML = ICONS.mic + "Start listening";
    }

    async function toggle() {
      if (running) { stop(); return; }
      $("#noiseToggle").textContent = "…starting";
      const ok = await startMic();
      $("#noiseToggle").innerHTML = ok ? ICONS.stop + "Stop" : ICONS.mic + "Start listening";
    }

    function init() {
      $("#noiseDuck").innerHTML = FACES.idle;
      $("#noiseToggle").addEventListener("click", toggle);
      // The inline slider and the settings blade share one persisted threshold.
      $("#noiseThresh").value = Settings.value("noise", "thresh", 65);
      $("#noiseThresh").addEventListener("input", () =>
        Settings.set("noise", "thresh", Number($("#noiseThresh").value)));
    }
    LEAVE.noise = () => { if (running) stop(); };
    REFRESH.noise = () => { $("#noiseThresh").value = Settings.value("noise", "thresh", 65); };
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
    toast(roster.length ? `Saved ${roster.length} students` : "Roster cleared");
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
      toast("Share link copied");
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
    toast("Roster saved as a file");
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
     SETTINGS BLADE — per-tool customisation
     Each tool declares a small list of fields; the blade renders
     them, persists every change to localStorage via Settings, and
     calls REFRESH[tool] so the open view updates live.
     ============================================================ */
  const TOOL_SETTINGS = {
    picker: {
      title: "Duck Picker settings",
      fields: [
        { key: "names", type: "roster", label: "Students to pick from",
          hint: "This picker's own list — one name per line. Leave it empty to use the class roster." },
        { key: "confetti", type: "toggle", label: "Celebrate the pick with confetti", default: true },
      ],
    },
    wheel: {
      title: "Spinner Wheel settings",
      fields: [
        { key: "names", type: "roster", label: "Names on the wheel",
          hint: "This wheel's own list — one name per line. Leave it empty to use the class roster." },
        { key: "confetti", type: "toggle", label: "Celebrate the spin with confetti", default: true },
      ],
    },
    teams: {
      title: "Team Maker settings",
      fields: [
        { key: "theme", type: "select", label: "Team names", default: "ducks",
          options: [{ value: "ducks", label: "Ducks" }, { value: "colours", label: "Colours" }, { value: "numbers", label: "Numbers" }] },
        { key: "counts", type: "toggle", label: "Show each team's size", default: true },
      ],
    },
    timer: {
      title: "Timer settings",
      fields: [
        { key: "ticks", type: "toggle", label: "Tick through the final 5 seconds", default: true },
        { key: "chime", type: "toggle", label: "Quack when time's up", default: true },
      ],
    },
    stopwatch: {
      title: "Stopwatch settings",
      fields: [
        { key: "tenths", type: "toggle", label: "Show tenths of a second", default: true },
        { key: "lapSound", type: "toggle", label: "Click on each lap", default: true },
      ],
    },
    traffic: {
      title: "Traffic Light settings",
      fields: [
        { key: "redLabel", type: "text", label: "Red light says", default: "Silent, please", maxlength: 40 },
        { key: "amberLabel", type: "text", label: "Amber light says", default: "Whisper voices", maxlength: 40 },
        { key: "greenLabel", type: "text", label: "Green light says", default: "Talk & work", maxlength: 40 },
      ],
    },
    dice: {
      title: "Dice & Numbers settings",
      fields: [
        { key: "count", type: "stepper", label: "Default number of dice", default: 1, min: 1, max: 4 },
        { key: "numMin", type: "number", label: "Default lowest number", default: 1 },
        { key: "numMax", type: "number", label: "Default highest number", default: 100 },
      ],
    },
    noise: {
      title: "Noise Meter settings",
      fields: [
        { key: "thresh", type: "stepper", label: "Alarm threshold", default: 65, min: 20, max: 95, step: 5, unit: "%" },
        { key: "alarm", type: "toggle", label: "Quack alarm when it gets too loud", default: true },
      ],
    },
  };

  const Blade = (() => {
    let openTool = null, lastFocus = null;
    const el = () => $("#settingsBlade");

    function sval(tool, f) { return Settings.value(tool, f.key, f.default); }
    function commit(tool, f, val) {
      Settings.set(tool, f.key, val);
      if (REFRESH[tool] && current === tool) REFRESH[tool]();
    }

    function iconBtn(sym) {
      const b = document.createElement("button");
      b.type = "button"; b.className = "btn btn-ghost step"; b.textContent = sym;
      return b;
    }

    function buildToggle(tool, f) {
      const label = document.createElement("label");
      label.className = "blade-field switch set-toggle";
      const input = document.createElement("input");
      input.type = "checkbox"; input.checked = !!sval(tool, f);
      const span = document.createElement("span");
      span.className = "switch-text"; span.textContent = f.label;
      input.addEventListener("change", () => commit(tool, f, input.checked));
      label.append(input, span);
      return label;
    }

    function buildStepper(tool, f) {
      const wrap = document.createElement("div");
      wrap.className = "blade-field row";
      const lab = document.createElement("div");
      lab.className = "field-label"; lab.textContent = f.label;
      const ctl = document.createElement("div"); ctl.className = "mini-stepper";
      const dec = iconBtn("−"), val = document.createElement("span"), inc = iconBtn("+");
      val.className = "mini-val";
      const step = f.step || 1;
      let cur = clamp(sval(tool, f), f.min, f.max);
      const show = () => { val.textContent = cur + (f.unit || ""); };
      show();
      dec.setAttribute("aria-label", "Decrease " + f.label);
      inc.setAttribute("aria-label", "Increase " + f.label);
      dec.addEventListener("click", () => { cur = clamp(cur - step, f.min, f.max); show(); commit(tool, f, cur); });
      inc.addEventListener("click", () => { cur = clamp(cur + step, f.min, f.max); show(); commit(tool, f, cur); });
      ctl.append(dec, val, inc);
      wrap.append(lab, ctl);
      return wrap;
    }

    function buildInput(tool, f, kind) {
      const wrap = document.createElement("label");
      wrap.className = "blade-field row";
      const lab = document.createElement("span");
      lab.className = "field-label"; lab.textContent = f.label;
      const input = document.createElement("input");
      input.className = "set-input";
      input.type = kind === "number" ? "number" : "text";
      if (kind === "number") input.inputMode = "numeric";
      if (f.maxlength) input.maxLength = f.maxlength;
      input.value = sval(tool, f);
      const read = () => (kind === "number" ? Number(input.value) : input.value);
      input.addEventListener("input", () => commit(tool, f, read()));
      wrap.append(lab, input);
      return wrap;
    }

    function buildSelect(tool, f) {
      const wrap = document.createElement("div");
      wrap.className = "blade-field";
      const lab = document.createElement("div");
      lab.className = "field-label"; lab.textContent = f.label;
      const seg = document.createElement("div");
      seg.className = "seg"; seg.setAttribute("role", "group"); seg.setAttribute("aria-label", f.label);
      f.options.forEach((o) => {
        const b = document.createElement("button");
        b.type = "button"; b.className = "seg-btn" + (o.value === sval(tool, f) ? " is-on" : "");
        b.textContent = o.label;
        b.addEventListener("click", () => {
          $$(".seg-btn", seg).forEach((x) => x.classList.toggle("is-on", x === b));
          commit(tool, f, o.value);
        });
        seg.append(b);
      });
      wrap.append(lab, seg);
      return wrap;
    }

    // A per-tool student list editor (independent of the shared class roster).
    function buildRoster(tool, f) {
      const wrap = document.createElement("div");
      wrap.className = "blade-field";
      const lab = document.createElement("div");
      lab.className = "field-label"; lab.textContent = f.label;
      const ta = document.createElement("textarea");
      ta.className = "set-list"; ta.spellcheck = false;
      ta.placeholder = "Ada\nGrace\nAlan\n…";
      ta.value = (sval(tool, f) || []).join("\n");
      const foot = document.createElement("div");
      foot.className = "set-list-foot";
      const load = document.createElement("button");
      load.type = "button"; load.className = "btn btn-ghost";
      load.textContent = "Load class roster";
      const count = document.createElement("span");
      count.className = "set-count";
      const refreshCount = () => {
        const n = parseRoster(ta.value).length;
        count.textContent = n ? `${n} name${n === 1 ? "" : "s"}` : "using class roster";
      };
      const save = () => { commit(tool, f, parseRoster(ta.value)); refreshCount(); };
      ta.addEventListener("input", save);
      load.addEventListener("click", () => { ta.value = roster.join("\n"); save(); });
      refreshCount();
      foot.append(count, load);
      wrap.append(lab, ta, foot);
      if (f.hint) { const h = document.createElement("p"); h.className = "field-hint"; h.textContent = f.hint; wrap.append(h); }
      return wrap;
    }

    function buildField(tool, f) {
      let node;
      switch (f.type) {
        case "toggle": node = buildToggle(tool, f); break;
        case "stepper": node = buildStepper(tool, f); break;
        case "number": node = buildInput(tool, f, "number"); break;
        case "text": node = buildInput(tool, f, "text"); break;
        case "select": node = buildSelect(tool, f); break;
        case "roster": return buildRoster(tool, f); // owns its own hint
        default: node = document.createElement("div");
      }
      if (f.hint) { const h = document.createElement("p"); h.className = "field-hint"; h.textContent = f.hint; node.append(h); }
      return node;
    }

    function open(tool) {
      const cfg = TOOL_SETTINGS[tool];
      if (!cfg) return;
      openTool = tool;
      lastFocus = document.activeElement;
      $("#bladeTitle").textContent = cfg.title;
      const body = $("#bladeBody");
      body.innerHTML = "";
      cfg.fields.forEach((f) => body.appendChild(buildField(tool, f)));
      el().hidden = false;
      setTimeout(() => $("#closeBlade").focus(), 50);
    }

    function close() {
      if (el().hidden) return;
      el().hidden = true;
      openTool = null;
      if (lastFocus) lastFocus.focus();
    }

    function isOpen() { return !el().hidden; }

    function init() {
      // Drop a settings button into the head of every tool that has settings.
      Object.keys(TOOL_SETTINGS).forEach((tool) => {
        const head = $("#view-" + tool + " .tool-head");
        if (!head || head.querySelector(".settings-btn")) return;
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "icon-btn settings-btn";
        btn.setAttribute("aria-label", "Settings");
        btn.title = "Settings";
        btn.innerHTML = ICONS.gear;
        btn.addEventListener("click", () => open(tool));
        head.appendChild(btn);
      });
      $("#closeBlade").addEventListener("click", close);
      el().addEventListener("click", (e) => { if (e.target === el()) close(); });
    }

    return { init, open, close, isOpen };
  })();

  /* ============================================================
     GLOBAL CHROME — theme, sound, nav
     ============================================================ */
  function applyTheme(mode) {
    document.documentElement.setAttribute("data-theme", mode);
    $("#themeIcon").innerHTML = mode === "dark" ? ICONS.sun : ICONS.moon;
    document.querySelector('meta[name="theme-color"]').setAttribute("content", mode === "dark" ? "#1c1f26" : "#0d9488");
    store.set("theme", mode);
  }
  function applySound() {
    $("#soundIcon").innerHTML = soundOn ? ICONS.soundOn : ICONS.soundOff;
    $("#soundBtn").setAttribute("aria-pressed", String(soundOn));
  }

  function init() {
    // restore prefs
    const savedTheme = store.get("theme", window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    applyTheme(savedTheme);
    applySound();

    // wire up tools
    Picker.init(); Wheel.init(); Teams.init(); Timer.init(); Stopwatch.init(); Traffic.init(); Dice.init(); Noise.init();
    Blade.init();

    // navigation
    $$("[data-tool]").forEach((c) => c.addEventListener("click", () => go(c.dataset.tool)));
    $$("[data-back]").forEach((b) => b.addEventListener("click", () => go("home")));
    $("#homeBtn").addEventListener("click", () => go("home"));
    $("#rosterCard").addEventListener("click", openRoster);
    $("#rosterBtn").addEventListener("click", openRoster);
    if ($("#rosterBtn2")) $("#rosterBtn2").addEventListener("click", openRoster);

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

    // keyboard: Esc closes whichever overlay is open
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      if (Blade.isOpen()) Blade.close();
      else if (!$("#rosterModal").hidden) closeRoster();
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
