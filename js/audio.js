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

  // --- Ambient Synth Hum ---
  function startAmbient() {
    if (isAmbientPlaying) return;
    const c = getContext();

    // Deep bass drone
    ambientOsc = c.createOscillator();
    ambientOsc.type = "sawtooth";
    ambientOsc.frequency.value = 55; // Low A

    const filter = c.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 200;
    filter.Q.value = 5;

    // Slow filter sweep
    const now = c.currentTime;
    filter.frequency.setValueAtTime(100, now);
    filter.frequency.linearRampToValueAtTime(300, now + 8);
    filter.frequency.linearRampToValueAtTime(100, now + 16);
    filter.frequency.setValueAtTime(100, now + 16);

    // LFO for wobble
    const lfo = c.createOscillator();
    lfo.type = "sine";
    lfo.frequency.value = 0.3;
    const lfoGain = c.createGain();
    lfoGain.gain.value = 30;
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    lfo.start();

    ambientGain = c.createGain();
    ambientGain.gain.value = 0;
    ambientGain.gain.linearRampToValueAtTime(0.06, now + 3);

    ambientOsc.connect(filter);
    filter.connect(ambientGain);
    ambientGain.connect(c.destination);
    ambientOsc.start();

    isAmbientPlaying = true;

    // Loop the filter sweep
    setInterval(() => {
      if (!isAmbientPlaying) return;
      const t = c.currentTime;
      filter.frequency.cancelScheduledValues(t);
      filter.frequency.setValueAtTime(filter.frequency.value, t);
      filter.frequency.linearRampToValueAtTime(300, t + 8);
      filter.frequency.linearRampToValueAtTime(100, t + 16);
    }, 16000);
  }

  function stopAmbient() {
    if (ambientOsc) {
      const c = getContext();
      ambientGain.gain.linearRampToValueAtTime(0, c.currentTime + 1);
      setTimeout(() => {
        ambientOsc.stop();
        isAmbientPlaying = false;
      }, 1100);
    }
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
