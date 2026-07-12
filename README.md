# Quack Pack 🦆 — Classroom Toolkit

A free, fun, **offline-first** toolkit for K‑12 teachers. Five of the tools you
reach for every day, wrapped in a friendly duck theme. No logins, no ads, no
tracking — and it works with no internet connection.

**Open `index.html` and you're teaching** — or use the hosted version:
👉 **https://ducks-go-quack.github.io/angry-quacks/**

## The tools

| | Tool | What it does |
|---|------|--------------|
| 🎯 | **Duck Picker** | Randomly picks a student. "No repeats" mode makes sure everyone gets a turn before anyone goes twice. |
| 🎡 | **Spinner Wheel** | A big, spinnable wheel of student names with a satisfying ratchet and confetti. Optionally removes each name after it's picked. |
| 🪺 | **Team Maker** | Splits the class into teams — either _N teams_ or _N per team_ — with color‑coded, duck‑named groups. |
| ⏱️ | **Timer** | Big, glanceable countdown with a progress ring, quick presets, gentle final‑seconds ticks and a quack when time's up. |
| ⏲️ | **Stopwatch** | Count‑up timer with lap splits — great for fitness tests, fluency drills and transitions. |
| 🚦 | **Traffic Light** | A big room‑signal light. Tap red / amber / green to show whether it's silent, whisper, or talk‑and‑work time. |
| 🎲 | **Dice, Numbers & Coin** | Roll 1–4 dice, generate a random number in any range, or flip a coin. |
| 📢 | **Noise Meter** | Uses the device mic to show a live volume meter and warns the class when it gets too loud. |

## Highlights for teachers

- **Works offline.** All functionality runs in the browser. Save the folder to a
  laptop or tablet and every tool keeps working on a school Wi‑Fi dead‑spot. The
  only network request is the web fonts (Plus Jakarta Sans + JetBrains Mono) from
  Google Fonts; when they're unavailable the app falls back to system fonts and
  works exactly the same.
- **Your roster is saved** on the device (via `localStorage`) and shared across
  every tool. Edit it once from the roster button in the header.
- **Move your roster between devices** with one tap — copy a share link, or
  back it up / restore it as a plain `.txt` file. (All local; no accounts.)
- **Mobile & touch friendly.** Big tap targets, works in portrait on a phone,
  scales up to an interactive whiteboard.
- **Light & dark mode**, and it respects "reduce motion" settings.
- **Private by design.** The mic audio for the Noise Meter never leaves the
  device and is never recorded. There is no analytics or tracking of any kind —
  the sole outbound request is the Google Fonts stylesheet.
- **Accessible.** Keyboard navigable, screen‑reader labels, visible focus rings.

## Using it

1. Open `index.html` in any modern browser (Chrome, Edge, Safari, Firefox).
2. Tap 👥 to paste in your class list (one name per line), or use the sample.
3. Pick a tool and go. That's it.

To put it on classroom devices, copy the whole folder — no install, no server.
It can also be hosted on any static web host (GitHub Pages, school intranet, …).

## Files

- `index.html` — markup for every tool
- `styles.css` — all styling (mobile‑first, theme‑aware)
- `app.js` — all behavior (vanilla JS, zero dependencies)

Made with 🦆 for teachers.
