/* ============================================
   DECODER — Scrambled Text Puzzle Engine
   ============================================ */

const Decoder = (() => {
  const MESSAGE_LINES = [
    "WELCOME TO THE METAVERSE",
    "YOU HAVE BEEN GRANTED ACCESS TO THE MAINFRAME",
    "ENTER",
  ];

  // Character pool for scrambling: katakana + hex + symbols
  const SCRAMBLE_CHARS =
    "アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン" +
    "0123456789ABCDEF" +
    "█▓░◆●▲►◄■□▪▫";

  // Which character indices each zone unlocks
  // We'll compute these dynamically based on the message
  const ZONE_PHRASES = [
    "WELCOME TO",
    "THE METAVERSE",
    "YOU HAVE BEEN",
    "GRANTED ACCESS",
    "TO THE MAINFRAME",
    "ENTER",
  ];

  let chars = []; // { target, current, locked, element, lineIdx, charIdx }
  let allLocked = false;
  let scrambleRAF = null;
  let lastScrambleTime = 0;
  let zonesTriggered = 0;
  let onComplete = null;

  function init(containerEl, completionCallback) {
    onComplete = completionCallback;
    containerEl.innerHTML = "";
    chars = [];

    // Build DOM
    MESSAGE_LINES.forEach((line, lineIdx) => {
      const lineEl = document.createElement("div");
      lineEl.className = "message-line";

      for (let i = 0; i < line.length; i++) {
        const span = document.createElement("span");
        span.className = "char" + (line[i] === " " ? " space" : "");
        span.textContent = randomChar();

        const charObj = {
          target: line[i],
          current: "",
          locked: line[i] === " ", // spaces are always "locked"
          element: span,
          lineIdx,
          charIdx: i,
        };

        if (line[i] === " ") {
          span.textContent = " ";
          span.classList.add("locked");
        }

        chars.push(charObj);
        lineEl.appendChild(span);
      }

      containerEl.appendChild(lineEl);
    });

    // Start scramble loop
    lastScrambleTime = performance.now();
    scrambleLoop();
  }

  function randomChar() {
    return SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)];
  }

  function scrambleLoop() {
    const now = performance.now();
    if (now - lastScrambleTime > 60) {
      lastScrambleTime = now;
      for (const c of chars) {
        if (!c.locked) {
          c.element.textContent = randomChar();
        }
      }
    }
    if (!allLocked) {
      scrambleRAF = requestAnimationFrame(scrambleLoop);
    }
  }

  // Figure out which chars a zone should unlock
  function getCharIndicesForPhrase(phrase) {
    const indices = [];
    // We need to find the phrase across our flat chars array
    // Build a flat string representation with line separators
    let flatText = "";
    const lineOffsets = [];
    let offset = 0;

    MESSAGE_LINES.forEach((line, idx) => {
      lineOffsets.push(offset);
      flatText += line;
      offset += line.length;
      if (idx < MESSAGE_LINES.length - 1) {
        flatText += "|"; // separator (won't be in chars array)
        offset++; // account for separator
      }
    });

    // But our chars array doesn't have separators.
    // Recalculate: build flat string from chars
    let charsFlatText = "";
    const charsLineStarts = [];
    let currentLine = -1;
    chars.forEach((c, i) => {
      if (c.lineIdx !== currentLine) {
        charsLineStarts.push(i);
        currentLine = c.lineIdx;
        if (charsFlatText.length > 0) charsFlatText += "|";
      }
      charsFlatText += c.target;
    });

    // Find the phrase in the joined message lines
    const fullText = MESSAGE_LINES.join("|");
    const phraseStart = fullText.indexOf(phrase);
    if (phraseStart === -1) return indices;

    // Map fullText position to chars index
    let charIdx = 0;
    let textIdx = 0;
    for (let i = 0; i < fullText.length && charIdx < chars.length; i++) {
      if (fullText[i] === "|") {
        // Skip separator - doesn't map to a char
        continue;
      }
      if (i >= phraseStart && i < phraseStart + phrase.length) {
        indices.push(charIdx);
      }
      charIdx++;
    }

    return indices;
  }

  function triggerZone(zoneIndex, containerEl) {
    if (zoneIndex >= ZONE_PHRASES.length) return;

    const phrase = ZONE_PHRASES[zoneIndex];
    const indices = getCharIndicesForPhrase(phrase);

    // Play SFX
    AudioEngine.playLockIn();

    // Glitch flash on container
    containerEl.classList.add("glitch-flash");
    setTimeout(() => containerEl.classList.remove("glitch-flash"), 200);

    // Lock characters with staggered animation
    indices.forEach((idx, i) => {
      setTimeout(() => {
        const c = chars[idx];
        if (c && !c.locked && c.target !== " ") {
          c.locked = true;
          c.element.textContent = c.target;
          c.element.classList.add("locking");
          setTimeout(() => {
            c.element.classList.remove("locking");
            c.element.classList.add("locked");
          }, 300);
        }
      }, i * 30); // 30ms stagger per character
    });

    zonesTriggered++;

    // Check completion after stagger finishes
    setTimeout(
      () => {
        checkCompletion();
      },
      indices.length * 30 + 350,
    );
  }

  function checkCompletion() {
    const unlocked = chars.filter((c) => !c.locked);
    if (unlocked.length === 0) {
      allLocked = true;
      if (scrambleRAF) cancelAnimationFrame(scrambleRAF);
      if (onComplete) onComplete();
    }
  }

  function destroy() {
    allLocked = true;
    if (scrambleRAF) cancelAnimationFrame(scrambleRAF);
  }

  return { init, triggerZone, destroy };
})();
