# MAINFRAME // ACCESS TERMINAL

An interactive 80s neon outrun hacker experience built with vanilla HTML, CSS, and JavaScript.

## 🕹️ Experience

### Phase 1 — Decoder

A scrambled text puzzle. Hover over the hidden trigger zones to decode the message and unlock access to the mainframe.

### Phase 2 — Mainframe

A split-screen cyberpunk interface:

- **Top half**: A Three.js 3D cityscape with neon wireframe buildings, matrix rain, an outrun sun, and glowing data lines streaming down the road
- **Bottom half**: A hacker-typer terminal that outputs realistic C kernel code as you mash any key

### Hidden Feature

Press **Shift** or **Alt** three times to trigger the "Access Granted" overlay.

## 🛠️ Tech Stack

- **Three.js** — 3D cityscape rendering
- **Web Audio API** — All sounds synthesized in-browser (no audio files)
- **Vanilla JS/CSS** — No frameworks, no build step

## 🚀 Run Locally

```bash
npx serve . -p 3000
```

Then open [http://localhost:3000](http://localhost:3000)

## 📁 Structure

```
index.html          — Entry point
css/style.css       — All styles, CRT effects, animations
js/decoder.js       — Scrambled text puzzle logic
js/mainframe.js     — Terminal hacker-typer engine
js/cityscape.js     — Three.js 3D scene
js/audio.js         — Web Audio synthesizer
```

## 🎨 Color Palette

| Color       | Hex       | Usage                |
| ----------- | --------- | -------------------- |
| Dark BG     | `#0a0a12` | Background           |
| Deep Purple | `#1a0a2e` | Accents              |
| Neon Pink   | `#ff2d95` | Highlights, sun      |
| Neon Cyan   | `#00f0ff` | Grid, text           |
| Neon Green  | `#39ff14` | Terminal, data lines |

## 📄 License

MIT
