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
  let tempo = 110;
  let nextNoteTime = 0.0;
  let noteIndex = 0;
  let sequenceTimerID = null;
  let bassOsc = null;
  let padOscs = [];

  // Bass sequence: Driving 16th notes
  // C2, Eb2, F2, G2 pattern
  const bassSequence = [
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

  function scheduleNote(beatNumber, time) {
    const c = getContext();

    // --- Bass ---
    // Play on every 16th note
    const osc = c.createOscillator();
    const gain = c.createGain();
    const filter = c.createBiquadFilter();

    osc.type = "sawtooth";
    osc.frequency.value =
      bassSequence[Math.floor(beatNumber / 4) % bassSequence.length]; // Change note every 4 beats (1 bar) roughly, or let's do every 16th

    // Let's actually iterate through the sequence properly.
    // The sequence above is 16 steps long.
    const noteFreq = bassSequence[beatNumber % 16];

    // Slight detune for thickness
    osc.frequency.setValueAtTime(noteFreq, time);

    // Filter envelope (pluck)
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(0, time);
    filter.frequency.linearRampToValueAtTime(800, time + 0.01); // Attack
    filter.frequency.exponentialRampToValueAtTime(100, time + 0.15); // Decay

    // Amp envelope
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.3, time + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.15);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(c.destination);

    osc.start(time);
    osc.stop(time + 0.2);
  }

  function scheduler() {
    const c = getContext();
    // Look ahead 100ms
    while (nextNoteTime < c.currentTime + 0.1) {
      scheduleNote(noteIndex, nextNoteTime);

      // Advance time by a 16th note
      const secondsPerBeat = 60.0 / tempo;
      nextNoteTime += 0.25 * secondsPerBeat; // 16th note = 0.25 beats

      noteIndex++;
    }
    sequenceTimerID = requestAnimationFrame(scheduler); // Use RAF for smoother timing loop, or setTimeout
  }

  // Pad Synth
  function startPad() {
    const c = getContext();
    const now = c.currentTime;

    // Chord: Cm7 (C, Eb, G, Bb)
    const freqs = [130.81, 155.56, 196.0, 233.08]; // C3, Eb3, G3, Bb3

    freqs.forEach((f) => {
      const osc = c.createOscillator();
      const gain = c.createGain();

      osc.type = "sawtooth";
      osc.frequency.value = f;

      // Detune slightly for chorus effect
      osc.detune.value = Math.random() * 20 - 10;

      const filter = c.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 600;
      filter.Q.value = 1;

      // LFO for filter sweep
      const lfo = c.createOscillator();
      lfo.type = "sine";
      lfo.frequency.value = 0.1 + Math.random() * 0.1; // Slow sweep
      const lfoGain = c.createGain();
      lfoGain.gain.value = 200;

      lfo.connect(lfoGain);
      lfoGain.connect(filter.frequency);
      lfo.start();

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(c.destination);

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.03, now + 4); // Slow fade in

      osc.start(now);
      padOscs.push({ osc, gain, lfo });
    });
  }

  function startAmbient() {
    if (isPlaying) return;
    const c = getContext();

    // Resume context if suspended (browser requirements)
    if (c.state === "suspended") {
      c.resume();
    }

    isPlaying = true;
    noteIndex = 0;
    nextNoteTime = c.currentTime + 0.1;

    // Start Sequencer
    scheduler();

    // Start Pad
    startPad();
  }

  function stopAmbient() {
    if (!isPlaying) return;
    isPlaying = false;

    // Stop sequencer
    if (sequenceTimerID) {
      cancelAnimationFrame(sequenceTimerID);
      sequenceTimerID = null;
    }

    // Fade out pads
    const c = getContext();
    const now = c.currentTime;
    padOscs.forEach((p) => {
      p.gain.gain.cancelScheduledValues(now);
      p.gain.gain.setValueAtTime(p.gain.gain.value, now);
      p.gain.gain.linearRampToValueAtTime(0, now + 2);
      p.osc.stop(now + 2.1);
      p.lfo.stop(now + 2.1);
    });
    padOscs = [];
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
    stopAmbient,
    playLockIn,
    playTransition,
    playTypeClick,
    getContext,
  };
})();
