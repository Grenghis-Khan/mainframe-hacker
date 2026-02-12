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
  let zoneProgress = []; // Indices revealed per zone
  let lastProgressTime = 0;

  function init(containerEl, completionCallback) {
    onComplete = completionCallback;
    containerEl.innerHTML = "";
    chars = [];
    zoneProgress = new Array(ZONE_PHRASES.length).fill(0);

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

  function enterZone(zoneIndex, containerEl) {
    if (zoneIndex >= ZONE_PHRASES.length) return;

    // Slight glitch effect on enter
    if (containerEl) {
      containerEl.classList.add("glitch-flash");
      setTimeout(() => containerEl.classList.remove("glitch-flash"), 200);
    }

    // Reveal just one char on enter? Or only if none revealed?
    // User said: "Have the first letter be revealed 'on enter'"
    // So if progress is 0, reveal 1.
    if (zoneProgress[zoneIndex] === 0) {
      revealNextChar(zoneIndex, true);
    }
  }

  function progressZone(zoneIndex) {
    // Reveal more letters while moving
    // Throttle slightly to make it feel like "decrypting"
    const now = performance.now();
    if (now - lastProgressTime > 50) {
      // Max 20 chars/sec
      revealNextChar(zoneIndex, false);
      lastProgressTime = now;
    }
  }

  function revealNextChar(zoneIndex, isFirst) {
    if (zoneIndex >= ZONE_PHRASES.length) return;
    const phrase = ZONE_PHRASES[zoneIndex];
    const indices = getCharIndicesForPhrase(phrase);

    const currentProgress = zoneProgress[zoneIndex];

    if (currentProgress >= indices.length) return; // All done

    const charGlobalIndex = indices[currentProgress];
    const c = chars[charGlobalIndex];

    if (c && !c.locked) {
      c.locked = true;
      c.element.textContent = c.target;
      c.element.classList.add("locking");

      if (isFirst) {
        AudioEngine.playLockIn();
      } else {
        AudioEngine.playTypeClick();
      }

      setTimeout(() => {
        c.element.classList.remove("locking");
        c.element.classList.add("locked");
      }, 300);
    }

    zoneProgress[zoneIndex]++;
    checkCompletion();
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

  return { init, enterZone, progressZone, destroy };
})();
