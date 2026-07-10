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

  /* -------------------- routing -------------------- */
  const views = { home: "#view-home", picker: "#view-picker", teams: "#view-teams", timer: "#view-timer", dice: "#view-dice", noise: "#view-noise" };
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

    function setMode(m) {
      $$('[data-dmode]').forEach((b) => b.classList.toggle("is-on", b.dataset.dmode === m));
      $("#diceMode").hidden = m !== "dice";
      $("#numberMode").hidden = m !== "number";
    }

    function init() {
      $("#rollBtn").addEventListener("click", roll);
      $("#genNumber").addEventListener("click", generate);
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
    Picker.init(); Teams.init(); Timer.init(); Dice.init(); Noise.init();

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

    // open the view named in the URL (deep links / refresh)
    go((location.hash || "#home").slice(1) || "home");
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
