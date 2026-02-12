/* ============================================
   AUDIO ENGINE — Web Audio API
   All sounds synthesized, no external files
   ============================================ */

const AudioEngine = (() => {
  let ctx = null;
  let ambientOsc = null;
  let ambientGain = null;
  let isAmbientPlaying = false;

  function getContext() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    return ctx;
  }

  // --- Synthwave Soundtrack ---
  let isPlaying = false;
  let currentTheme = "none"; // 'decoder' | 'mainframe'

  // Scheduler state
  let tempo = 110;
  let nextNoteTime = 0.0;
  let noteIndex = 0;
  let sequenceTimerID = null;

  // Active nodes
  let padOscs = [];

  // --- Sequences ---

  // Decoder Bass: Driving 16th notes (C2, Eb2, F2, G2)
  const decoderBassSeq = [
    65.41,
    65.41,
    65.41,
    65.41, // C2
    65.41,
    65.41,
    65.41,
    65.41,
    77.78,
    77.78,
    77.78,
    77.78, // Eb2
    87.31,
    87.31,
    98.0,
    98.0, // F2, G2
  ];

  // Mainframe Bass pattern helpers
  // Mainframe Arp: Cm Pentatonic up/down
  const mainframeArpSeq = [
    130.81, 155.56, 174.61, 196.0, 233.08, 261.63, 233.08, 196.0, 130.81,
    155.56, 174.61, 196.0, 233.08, 261.63, 311.13, 261.63,
  ];

  function scheduleNote(beatNumber, time) {
    const c = getContext();
    const beatIndex = beatNumber % 16;
    const barIndex = Math.floor(beatNumber / 16);

    if (currentTheme === "decoder") {
      // --- DECODER THEME ---
      // Bass: 16th notes
      playBassNote(c, time, decoderBassSeq[beatIndex], 0.2, "sawtooth", 800);
    } else if (currentTheme === "mainframe") {
      // --- MAINFRAME THEME ---

      // Bass: Galloping rhythm
      // Play on 0, 1, 2, 4, 5, 6, 8, 9, 10, 12, 13, 14 (16th notes)
      // Skip 3, 7, 11, 15
      const gallopExclusions = [3, 7, 11, 15];
      if (!gallopExclusions.includes(beatIndex)) {
        // Occasional octave drop on the "1" of the bar
        const freq = beatIndex === 0 && barIndex % 2 === 0 ? 32.7 : 65.41;
        playBassNote(c, time, freq, 0.15, "sawtooth", 1200);
      }

      // Arp: Constant 16ths highpass
      const arpFreq = mainframeArpSeq[beatIndex % mainframeArpSeq.length];
      playArpNote(c, time, arpFreq);

      // Hi-hat / Shaker noise (every off-beat 8th note)
      if (beatIndex % 2 !== 0) {
        playNoiseHiHat(c, time);
      }
    }
  }

  function playBassNote(c, time, freq, duration, type, filterCutoff) {
    const osc = c.createOscillator();
    const gain = c.createGain();
    const filter = c.createBiquadFilter();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, time);

    filter.type = "lowpass";
    filter.frequency.setValueAtTime(0, time);
    filter.frequency.linearRampToValueAtTime(filterCutoff, time + 0.01);
    filter.frequency.exponentialRampToValueAtTime(100, time + duration);

    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.4, time + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(c.destination);

    osc.start(time);
    osc.stop(time + duration + 0.1);

    // Clean up
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
      filter.disconnect();
    };
  }

  function playArpNote(c, time, freq) {
    const osc = c.createOscillator();
    const gain = c.createGain();
    const filter = c.createBiquadFilter();

    osc.type = "square";
    osc.frequency.setValueAtTime(freq, time);

    filter.type = "highpass"; // Thin, glitzy sound
    filter.frequency.value = 800;

    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.08, time + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.15);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(c.destination);

    osc.start(time);
    osc.stop(time + 0.2);

    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
      filter.disconnect();
    };
  }

  function playNoiseHiHat(c, time) {
    const bufferSize = c.sampleRate * 0.05;
    const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = c.createBufferSource();
    noise.buffer = buffer;

    const filter = c.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = 8000;

    const gain = c.createGain();
    gain.gain.setValueAtTime(0.05, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.03);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(c.destination);

    noise.start(time);
  }

  function scheduler() {
    const c = getContext();
    // Look ahead 100ms
    while (nextNoteTime < c.currentTime + 0.1) {
      scheduleNote(noteIndex, nextNoteTime);

      // Advance time by a 16th note
      const secondsPerBeat = 60.0 / tempo;
      nextNoteTime += 0.25 * secondsPerBeat;

      noteIndex++;
    }
    sequenceTimerID = requestAnimationFrame(scheduler);
  }

  // Pad Synth (Re-used for both, but maybe brighter for mainframe?)
  function startPad(mix = 0.03) {
    stopPads(); // Clear existing
    const c = getContext();
    const now = c.currentTime;

    // Chord: Cm7 (C, Eb, G, Bb)
    const freqs = [130.81, 155.56, 196.0, 233.08];
    if (currentTheme === "mainframe") {
      // Add a higher extension for excitement
      freqs.push(392.0); // G4
    }

    freqs.forEach((f) => {
      const osc = c.createOscillator();
      const gain = c.createGain();

      osc.type = "sawtooth";
      osc.frequency.value = f;
      osc.detune.value = Math.random() * 20 - 10;

      const filter = c.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = currentTheme === "mainframe" ? 1200 : 600; // Open up filter for mainframe
      filter.Q.value = 1;

      // LFO
      const lfo = c.createOscillator();
      lfo.type = "sine";
      lfo.frequency.value = 0.1 + Math.random() * 0.1;
      const lfoGain = c.createGain();
      lfoGain.gain.value = 200;
      lfo.connect(lfoGain);
      lfoGain.connect(filter.frequency);
      lfo.start();

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(c.destination);

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(mix, now + 4);

      osc.start(now);
      padOscs.push({ osc, gain, lfo });
    });
  }

  function stopPads() {
    const c = getContext();
    const now = c.currentTime;
    padOscs.forEach((p) => {
      p.gain.gain.cancelScheduledValues(now);
      p.gain.gain.linearRampToValueAtTime(0, now + 1); // Fast fade
      p.osc.stop(now + 1.1);
      p.lfo.stop(now + 1.1);
    });
    padOscs = [];
  }

  function stopSequencer() {
    if (sequenceTimerID) {
      cancelAnimationFrame(sequenceTimerID);
      sequenceTimerID = null;
    }
  }

  // --- Public API ---

  function startAmbient() {
    if (currentTheme === "decoder") return;
    const c = getContext();

    if (c.state === "suspended") {
      c.resume()
        .then(() => {
          // Only proceed if resume was successful or context is running
          _playDecoderTheme(c);
        })
        .catch((err) => {
          console.warn(
            "AudioContext resume failed (waiting for user gesture):",
            err,
          );
        });
    } else {
      _playDecoderTheme(c);
    }
  }

  function _playDecoderTheme(c) {
    if (currentTheme === "decoder") return; // double check inside async flow

    // Reset if switching tracks
    stopSequencer();
    stopPads();

    currentTheme = "decoder";
    isPlaying = true;
    tempo = 110;
    noteIndex = 0;
    nextNoteTime = c.currentTime + 0.1;

    scheduler();
    startPad(0.03); // Darker mix
  }

  function startMainframeTheme() {
    if (currentTheme === "mainframe") return;
    const c = getContext();
    if (c.state === "suspended") c.resume();

    // Transition smoothly
    // We keep the scheduler running but change state
    // Or restart for simplicity to sync tempo
    stopSequencer();
    stopPads();

    currentTheme = "mainframe";
    isPlaying = true;
    tempo = 125; // Faster!
    noteIndex = 0;
    nextNoteTime = c.currentTime + 0.1;

    scheduler();
    startPad(0.04); // Brighter mix
  }

  function stopAmbient() {
    isPlaying = false;
    currentTheme = "none";
    stopSequencer();
    stopPads();
  }

  // --- Lock-in Click SFX ---
  function playLockIn() {
    const c = getContext();
    const now = c.currentTime;

    // Noise burst
    const bufferSize = c.sampleRate * 0.08;
    const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 3);
    }

    const noise = c.createBufferSource();
    noise.buffer = buffer;

    // Bandpass for "digital click" character
    const bp = c.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 4000;
    bp.Q.value = 2;

    const gain = c.createGain();
    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    noise.connect(bp);
    bp.connect(gain);
    gain.connect(c.destination);
    noise.start(now);

    // Add a tonal "blip"
    const blip = c.createOscillator();
    blip.type = "square";
    blip.frequency.setValueAtTime(1800, now);
    blip.frequency.exponentialRampToValueAtTime(600, now + 0.06);

    const blipGain = c.createGain();
    blipGain.gain.setValueAtTime(0.15, now);
    blipGain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

    blip.connect(blipGain);
    blipGain.connect(c.destination);
    blip.start(now);
    blip.stop(now + 0.06);
  }

  // --- Transition Glitch SFX ---
  function playTransition() {
    const c = getContext();
    const now = c.currentTime;

    const bufferSize = c.sampleRate * 0.6;
    const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 1.5);
    }

    const noise = c.createBufferSource();
    noise.buffer = buffer;

    const hp = c.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 800;

    const gain = c.createGain();
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

    noise.connect(hp);
    hp.connect(gain);
    gain.connect(c.destination);
    noise.start(now);

    // CRT power-down tone
    const osc = c.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(2000, now);
    osc.frequency.exponentialRampToValueAtTime(60, now + 0.4);

    const oscGain = c.createGain();
    oscGain.gain.setValueAtTime(0.12, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

    osc.connect(oscGain);
    oscGain.connect(c.destination);
    osc.start(now);
    osc.stop(now + 0.4);
  }

  // --- Type Click (subtle) ---
  function playTypeClick() {
    const c = getContext();
    const now = c.currentTime;

    const bufferSize = c.sampleRate * 0.02;
    const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 6);
    }

    const noise = c.createBufferSource();
    noise.buffer = buffer;

    const hp = c.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 3000;

    const gain = c.createGain();
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.02);

    noise.connect(hp);
    hp.connect(gain);
    gain.connect(c.destination);
    noise.start(now);
  }

  return {
    startAmbient,
    startMainframeTheme,
    stopAmbient,
    playLockIn,
    playTransition,
    playTypeClick,
    getContext,
  };
})();
