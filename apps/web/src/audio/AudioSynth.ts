/**
 * NEXUS RELAY — procedural Web Audio synth & foley
 * (Blueprint §3). Zero external audio files; everything is
 * synthesized in real time:
 *
 *  Mechanical Switch Click: white noise burst (12 ms) through a
 *    steep high-pass filter (3.5 kHz) with exponential gain decay.
 *  Tape Relay Whir: 40 Hz triangle-wave modulation + band-pass noise.
 *  Proximity Sonar Ping: f = 220 + 880 * (1 - min(1, Distance/10000)).
 *  Dynamic Synthwave Stems: bass, arpeggio and lead layers join as
 *    Phase 2 progresses toward target resolution.
 */
export class AudioSynth {
  enabled = true;
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicTimer: number | null = null;
  private musicLevel = 0;
  private step = 0;

  private ensure(): AudioContext | null {
    if (!this.enabled) return null;
    try {
      if (!this.ctx) {
        const AC =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext;
        if (!AC) return null;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.4;
        this.master.connect(this.ctx.destination);
      }
      if (this.ctx.state === "suspended") void this.ctx.resume();
      return this.ctx;
    } catch {
      return null;
    }
  }

  /** Mechanical Switch Click — 12 ms noise burst, HP 3.5 kHz. */
  click(): void {
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const dur = 0.012;
    const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 3500;
    const gain = ctx.createGain();
    const t = ctx.currentTime;
    gain.gain.setValueAtTime(0.9, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur * 6);
    src.connect(hp).connect(gain).connect(this.master);
    src.start(t);
    src.stop(t + dur * 6);
  }

  /** Tape Relay Whir — 40 Hz triangle modulation + band-pass noise. */
  whir(): void {
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.value = 40;
    const oscGain = ctx.createGain();
    oscGain.gain.setValueAtTime(0.0001, t);
    oscGain.gain.exponentialRampToValueAtTime(0.22, t + 0.05);
    oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    osc.connect(oscGain).connect(this.master);
    osc.start(t);
    osc.stop(t + 0.55);

    const dur = 0.45;
    const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 900;
    bp.Q.value = 1.2;
    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(0.12, t);
    nGain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(bp).connect(nGain).connect(this.master);
    src.start(t);
    src.stop(t + dur);
  }

  /**
   * Proximity Sonar Ping — exact blueprint formula:
   * f_ping = 220 + 880 * (1 - min(1, Distance / 10000)) Hz.
   * Non-spatial pings have no distance term; a neutral 660 Hz is used.
   */
  ping(distanceKm: number | null): void {
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const f =
      distanceKm == null
        ? 660
        : 220 + 880 * (1.0 - Math.min(1.0, distanceKm / 10000));
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = f;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.5, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
    osc.connect(gain).connect(this.master);
    osc.start(t);
    osc.stop(t + 0.4);
  }

  private blip(freq: number, at: number, dur: number, type: OscillatorType, vol = 0.3): void {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, at);
    gain.gain.exponentialRampToValueAtTime(0.001, at + dur);
    osc.connect(gain).connect(this.master);
    osc.start(at);
    osc.stop(at + dur);
  }

  /** Target lock fanfare — rising synth arpeggio. */
  victory(): void {
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
      this.blip(f, t + i * 0.09, 0.24, "square", 0.25)
    );
  }

  /** Capacitor overload — descending saw buzz. */
  fail(): void {
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(160, t);
    osc.frequency.exponentialRampToValueAtTime(55, t + 0.5);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
    osc.connect(gain).connect(this.master);
    osc.start(t);
    osc.stop(t + 0.6);
  }

  /** Overclock link zap. */
  zap(): void {
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = "square";
    osc.frequency.setValueAtTime(880, t);
    osc.frequency.exponentialRampToValueAtTime(220, t + 0.08);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.28, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    osc.connect(gain).connect(this.master);
    osc.start(t);
    osc.stop(t + 0.12);
  }

  /**
   * Dynamic Synthwave Stems (Blueprint §3): a 112 BPM 16th-note loop.
   * Level 0: bass stem. Level 1: + arpeggio. Level 2: + lead synth.
   * Layers join as Phase 2 progresses toward target resolution.
   */
  startMusic(): void {
    const ctx = this.ensure();
    if (!ctx || this.musicTimer !== null) return;
    this.step = 0;
    const bassLine = [55, 0, 55, 0, 65.41, 0, 55, 0, 49, 0, 49, 0, 73.42, 0, 82.41, 0];
    const arp = [220, 261.63, 329.63, 440, 220, 261.63, 329.63, 440,
                 196, 246.94, 293.66, 392, 220, 261.63, 329.63, 440];
    const lead = [440, 0, 0, 523.25, 0, 0, 659.25, 0, 587.33, 0, 0, 523.25, 0, 0, 0, 0];
    const stepDur = 60 / 112 / 4;
    this.musicTimer = window.setInterval(() => {
      if (!this.ctx || !this.enabled) return;
      const t = this.ctx.currentTime + 0.03;
      const i = this.step % 16;
      if (bassLine[i]) this.blip(bassLine[i], t, stepDur * 1.8, "triangle", 0.32);
      if (this.musicLevel >= 1 && arp[i]) this.blip(arp[i], t, stepDur * 0.9, "square", 0.1);
      if (this.musicLevel >= 2 && lead[i]) this.blip(lead[i], t, stepDur * 2.2, "sawtooth", 0.07);
      this.step++;
    }, stepDur * 1000);
  }

  setMusicLevel(level: number): void {
    this.musicLevel = Math.max(0, Math.min(2, level));
  }

  stopMusic(): void {
    if (this.musicTimer !== null) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
    this.musicLevel = 0;
  }
}
